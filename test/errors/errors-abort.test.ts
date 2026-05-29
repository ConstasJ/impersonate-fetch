import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AbortError,
  FetchBodyUsedError,
  fetch,
  NativeAbiUnavailableError,
  NativeTransportError,
  TimeoutError,
  ValidationError,
} from '../../dist/index.mjs';
import type {
  NativeRequestPayload,
  NativeResponsePayload,
  NativeStreamOpenPayload,
  NativeStreamReadPayload,
} from '../../src/native/abi.ts';
import type { NativeFfiClient } from '../../src/native/ffi.ts';
import { NativeTransportBackend } from '../../dist/index.mjs';
import type {
  TransportBackend,
  TransportRequest,
  TransportStream,
} from '../../src/transport/types.ts';

describe('errors-abort typed errors', () => {
  it('errors-abort exports typed cancellation, native, body-used, and validation errors', () => {
    assert.equal(new AbortError() instanceof Error, true);
    assert.equal(new TimeoutError(10).name, 'TimeoutError');
    assert.equal(new NativeAbiUnavailableError('bad abi') instanceof NativeTransportError, true);
    assert.equal(new FetchBodyUsedError().name, 'FetchBodyUsedError');
    assert.equal(new ValidationError('bad').name, 'ValidationError');
  });
});

describe('errors-abort fetch facade', () => {
  it('errors-abort rejects before request starts without touching transport', async () => {
    const controller = new AbortController();
    const transport = mockTransport();

    controller.abort('pre-start');

    await assert.rejects(
      () =>
        fetch('https://fixture.test/', {
          signal: controller.signal,
          native: { backend: transport, capabilities: false },
        }),
      AbortError,
    );
    assert.deepEqual(transport.calls, []);
  });

  it('errors-abort cancels streaming upload body before transport starts', async () => {
    const controller = new AbortController();
    const transport = mockTransport();
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      async pull() {
        await wait(50);
      },
      cancel() {
        cancelled = true;
      },
    });

    const pending = fetch('https://fixture.test/upload', {
      method: 'POST',
      body,
      signal: controller.signal,
      native: { backend: transport, capabilities: false },
    });
    controller.abort('upload-abort');

    await assert.rejects(() => pending, AbortError);
    assert.equal(cancelled, true);
    assert.deepEqual(transport.calls, []);
  });

  it('errors-abort times out while waiting for transport handshake', async () => {
    const transport = mockTransport({ openDelayMs: 50 });

    await assert.rejects(
      () =>
        fetch('https://fixture.test/slow-handshake', {
          timeoutMs: 1,
          native: { backend: transport, capabilities: false },
        }),
      TimeoutError,
    );
    console.log('task-10-timeout: timeout during transport handshake produced TimeoutError');
  });

  it('errors-abort aborts while reading response body and closes stream', async () => {
    const controller = new AbortController();
    const transport = mockTransport({ stallBody: true });
    const response = await fetch('https://fixture.test/body', {
      signal: controller.signal,
      native: { backend: transport, capabilities: false },
    });
    const pendingText = response.text();

    controller.abort('midstream');

    await assert.rejects(() => pendingText, AbortError);
    assert.deepEqual(transport.calls, ['stream', 'read', 'close']);
    console.log('task-10-abort-midstream: response body abort closed mock stream');
  });

  it('errors-abort ignores abort after response body completes and rejects body reuse', async () => {
    const controller = new AbortController();
    const transport = mockTransport({ chunks: ['done'] });
    const response = await fetch('https://fixture.test/done', {
      signal: controller.signal,
      native: { backend: transport, capabilities: false },
    });

    assert.equal(await response.text(), 'done');
    controller.abort('after-complete');

    await assert.rejects(() => response.text(), FetchBodyUsedError);
    assert.deepEqual(transport.calls, ['stream', 'read', 'read', 'close']);
  });
});

describe('errors-abort native transport cleanup', () => {
  it('errors-abort frees late native response handles after request abort', async () => {
    const calls: string[] = [];
    const deferred = createDeferred<NativeResponsePayload>();
    const controller = new AbortController();
    const backend = new NativeTransportBackend({
      ffi: fakeFfi({ calls, request: deferred.promise }),
    });
    const pending = backend.request({ url: 'https://fixture.test/', signal: controller.signal });

    controller.abort('request-abort');

    await assert.rejects(() => pending, AbortError);
    deferred.resolve(nativeResponse('late-response'));
    await wait(0);

    assert.deepEqual(calls, ['request', 'free:late-response']);
  });

  it('errors-abort closes late native streams after stream open abort', async () => {
    const calls: string[] = [];
    const deferred = createDeferred<NativeStreamOpenPayload>();
    const controller = new AbortController();
    const backend = new NativeTransportBackend({
      ffi: fakeFfi({ calls, streamOpen: deferred.promise }),
    });
    const pending = backend.stream({ url: 'https://fixture.test/', signal: controller.signal });

    controller.abort('stream-open-abort');

    await assert.rejects(() => pending, AbortError);
    deferred.resolve(nativeStreamOpen('late-stream'));
    await wait(0);

    assert.deepEqual(calls, ['streamRequest', 'streamClose:late-stream']);
  });

  it('errors-abort closes native stream during response body read abort', async () => {
    const calls: string[] = [];
    const read = createDeferred<NativeStreamReadPayload>();
    const controller = new AbortController();
    const backend = new NativeTransportBackend({
      ffi: fakeFfi({ calls, streamRead: read.promise }),
    });
    const stream = await backend.stream({
      url: 'https://fixture.test/',
      signal: controller.signal,
    });
    const pending = stream.read();

    controller.abort('read-abort');

    await assert.rejects(() => pending, AbortError);
    assert.deepEqual(
      calls.sort(),
      ['streamClose:stream-1', 'streamRead:stream-1:65536', 'streamRequest'].sort(),
    );
  });
});

function mockTransport(
  options: { chunks?: string[]; openDelayMs?: number; stallBody?: boolean } = {},
): TransportBackend & { calls: string[]; lastSignal?: AbortSignal } {
  const calls: string[] = [];
  const chunks = [...(options.chunks ?? ['ok'])];

  return {
    name: 'native',
    calls,
    async request(_request: TransportRequest) {
      throw new Error('mock transport request should not be used by fetch facade');
    },
    async stream(request: TransportRequest): Promise<TransportStream> {
      calls.push('stream');
      this.lastSignal = request.signal;
      if (options.openDelayMs) {
        await wait(options.openDelayMs);
      }
      return {
        url: String(request.url),
        status: 200,
        headers: { 'content-type': ['text/plain'] },
        cookies: [],
        async read() {
          calls.push('read');
          if (options.stallBody) {
            return new Promise<Uint8Array | null>((_resolve, reject) => {
              if (request.signal?.aborted) {
                reject(new AbortError());
                return;
              }
              request.signal?.addEventListener('abort', () => reject(new AbortError()), {
                once: true,
              });
            });
          }
          const chunk = chunks.shift();
          return chunk === undefined ? null : new TextEncoder().encode(chunk);
        },
        async close() {
          calls.push('close');
        },
        async *[Symbol.asyncIterator]() {
          for (;;) {
            const chunk = await this.read();
            if (chunk === null) return;
            yield chunk;
          }
        },
      };
    },
  };
}

function fakeFfi(options: {
  calls: string[];
  request?: Promise<NativeResponsePayload>;
  streamOpen?: Promise<NativeStreamOpenPayload>;
  streamRead?: Promise<NativeStreamReadPayload>;
}): NativeFfiClient {
  return {
    async request(_payload: NativeRequestPayload): Promise<NativeResponsePayload> {
      options.calls.push('request');
      return options.request ?? nativeResponse('response-1');
    },
    async streamRequest(_payload: NativeRequestPayload): Promise<NativeStreamOpenPayload> {
      options.calls.push('streamRequest');
      return options.streamOpen ?? nativeStreamOpen('stream-1');
    },
    async streamRead(streamId: string, size: number): Promise<NativeStreamReadPayload> {
      options.calls.push(`streamRead:${streamId}:${size}`);
      return options.streamRead ?? { eof: true };
    },
    async streamClose(streamId: string): Promise<void> {
      options.calls.push(`streamClose:${streamId}`);
    },
    async free(responseId: string): Promise<void> {
      options.calls.push(`free:${responseId}`);
    },
  } as NativeFfiClient;
}

function nativeResponse(id: string): NativeResponsePayload {
  return {
    id,
    url: 'https://fixture.test/',
    status_code: 200,
    headers: {},
    content: btoa('ok'),
  };
}

function nativeStreamOpen(streamId: string): NativeStreamOpenPayload {
  return {
    stream_id: streamId,
    url: 'https://fixture.test/',
    status_code: 200,
    headers: {},
  };
}

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
