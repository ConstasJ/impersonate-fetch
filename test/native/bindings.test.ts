import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { describe, it } from 'node:test';

import {
  createNativeBindings,
  NativeBindingLoadError,
  NativeBindingNativeError,
} from '../../src/native/bindings.ts';
import type { NativeAssetInfo } from '../../src/native/assets.ts';

const asset: NativeAssetInfo = {
  platform: 'test',
  arch: 'x64',
  filename: 'requests-go-test.so',
  path: '/native/requests-go-test.so',
  dependenciesDir: '/native',
};

const requestPayload = {
  Id: '',
  Method: 'GET',
  Url: 'https://example.test/',
  RandomJA3: false,
  AllowRedirects: true,
};

describe('native-bindings stable facade', () => {
  it('native-bindings exposes direct FFI through stable typed methods', async () => {
    const calls: string[] = [];
    const bindings = createNativeBindings({
      asset,
      mode: 'direct',
      ffiLoader: () => ({
        Library(path: string) {
          assert.equal(path, asset.path);

          return {
            request(payload: string) {
              calls.push(`request:${payload}`);
              return JSON.stringify({
                id: 'response-1',
                url: requestPayload.Url,
                status_code: 200,
                headers: {},
                content: '',
                raw: '',
              });
            },
            freeMemory(responseId: string) {
              calls.push(`free:${responseId}`);
            },
            stream_request(payload: string) {
              calls.push(`stream_request:${payload}`);
              return JSON.stringify({
                stream_id: 'stream-1',
                url: requestPayload.Url,
                status_code: 200,
                headers: {},
              });
            },
            stream_read(streamId: string, size: number) {
              calls.push(`stream_read:${streamId}:${size}`);
              return JSON.stringify({ data: Buffer.from('ok').toString('base64'), eof: false });
            },
            stream_close(streamId: string) {
              calls.push(`stream_close:${streamId}`);
            },
          };
        },
      }),
    });

    assert.equal(bindings.mode, 'direct');
    assert.equal((await bindings.request(requestPayload)).status_code, 200);
    assert.equal((await bindings.streamRequest(requestPayload)).stream_id, 'stream-1');
    assert.deepEqual(await bindings.streamRead('stream-1', 2), {
      data: Buffer.from('ok').toString('base64'),
      eof: false,
    });
    await bindings.streamClose('stream-1');
    await bindings.free('response-1');
    assert.equal(
      calls.some((call) => call.includes('"Stream":true')),
      true,
    );
  });

  it('native-bindings exposes requiresShim subprocess protocol through the same methods', async () => {
    const child = new FakeChildProcess();
    const bindings = createNativeBindings({
      asset,
      mode: 'requiresShim',
      shimCommand: 'fake-shim',
      spawnProcess(command, args) {
        assert.equal(command, 'fake-shim');
        assert.deepEqual(args, [asset.path]);
        return child as never;
      },
    });

    assert.equal(bindings.mode, 'requiresShim');
    assert.equal((await bindings.request(requestPayload)).url, requestPayload.Url);
    assert.equal((await bindings.streamRequest(requestPayload)).stream_id, 'stream-1');
    assert.deepEqual(await bindings.streamRead('stream-1', 8), { data: 'Y2h1bms=', eof: false });
    await bindings.streamClose('stream-1');
    await bindings.free('response-1');

    assert.deepEqual(child.methods, [
      'request',
      'streamRequest',
      'streamRead',
      'streamClose',
      'free',
    ]);
  });

  it('native-bindings throws typed native errors instead of returning err payloads', async () => {
    const bindings = createNativeBindings({
      asset,
      mode: 'direct',
      ffiLoader: () => ({
        Library() {
          return {
            request() {
              return JSON.stringify({ err: 'native failed' });
            },
            freeMemory() {},
            stream_request() {
              return JSON.stringify({ err: '' });
            },
            stream_read() {
              return JSON.stringify({ eof: true });
            },
            stream_close() {},
          };
        },
      }),
    });

    await assert.rejects(() => bindings.request(requestPayload), NativeBindingNativeError);
  });

  it('native-bindings throws typed load errors when direct loading fails', () => {
    assert.throws(
      () =>
        createNativeBindings({
          asset,
          mode: 'direct',
          ffiLoader: () => ({
            Library() {
              throw new Error('corrupt asset');
            },
          }),
        }),
      NativeBindingLoadError,
    );
  });
});

class FakeChildProcess extends EventEmitter {
  readonly methods: string[] = [];
  readonly stdout = new EventEmitter() as EventEmitter & {
    setEncoding(encoding: string): typeof this.stdout;
  };
  readonly stderr = new EventEmitter() as EventEmitter & {
    setEncoding(encoding: string): typeof this.stderr;
  };
  readonly stdin = {
    write: (line: string) => {
      const message = JSON.parse(line) as { id: number; method: string; params: unknown[] };
      this.methods.push(message.method);
      queueMicrotask(() =>
        this.stdout.emit(
          'data',
          `${JSON.stringify({ id: message.id, ok: true, result: resultFor(message.method) })}\n`,
        ),
      );
      return true;
    },
    end() {},
    on() {
      return this;
    },
    once() {
      return this;
    },
  };

  constructor() {
    super();
    this.stdout.setEncoding = () => this.stdout;
    this.stderr.setEncoding = () => this.stderr;
  }

  kill() {
    return true;
  }
}

function resultFor(method: string): unknown {
  if (method === 'request') {
    return {
      id: 'response-1',
      url: requestPayload.Url,
      status_code: 200,
      headers: {},
      content: '',
      raw: '',
    };
  }

  if (method === 'streamRequest') {
    return { stream_id: 'stream-1', url: requestPayload.Url, status_code: 200, headers: {} };
  }

  if (method === 'streamRead') {
    return { data: 'Y2h1bms=', eof: false };
  }

  return {};
}
