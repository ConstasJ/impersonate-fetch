import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { NativeTransportError } from '@/errors.js';
import type {
  NativeRequestPayload,
  NativeResponsePayload,
  NativeStreamOpenPayload,
  NativeStreamReadPayload,
} from '@/native/abi.js';
import type { NativeFfiClient } from '@/native/ffi.js';
import { NativeTransportBackend } from '@/transport/native.js';
import type { TransportRequest } from '@/transport/types.js';

describe('native-transport adapter', () => {
  it('native-transport converts TransportRequest into native payload shape', async () => {
    const payloads: NativeRequestPayload[] = [];
    const backend = new NativeTransportBackend({ ffi: fakeFfi({ payloads }) });

    await backend.request({
      url: new URL('https://example.test/path'),
      method: 'post',
      headers: { 'User-Agent': 'agent', Accept: '*/*' },
      body: 'hello',
      cookies: { session: 'abc' },
      proxy: { https: 'http://proxy.example:8080', all: 'http://fallback.example:8080' },
      timeoutMs: 1500,
      redirects: 2,
      impersonation: {
        headersOrder: ['user-agent', 'accept'],
        pseudoHeaderOrder: [':method', ':authority', ':scheme', ':path'],
        unChangedHeaderKey: ['User-Agent'],
        ja3: '771,4865,0,29,0',
        tlsConfig: {
          id: 'tls-1',
          ja3: '771,old,0,29,0',
          randomJa3: false,
          forceHttp1: true,
          headersOrder: ['accept'],
          unChangedHeaderKey: null,
          pseudoHeaderOrder: [':method', ':path'],
          userAgent: 'agent',
          tlsExtensions: { clientHelloHexStream: '160301' },
          http2Settings: {
            settings: { HEADER_TABLE_SIZE: 65536 },
            settingsOrder: ['HEADER_TABLE_SIZE'],
          },
        },
      },
    } as TransportRequest);
    const payload = payloads[0];

    assert.equal(payload.Id, 'tls-1');
    assert.equal(payload.Method, 'POST');
    assert.equal(payload.Url, 'https://example.test/path');
    assert.deepEqual(payload.Headers, { 'User-Agent': 'agent', Accept: '*/*' });
    assert.deepEqual(payload.HeadersOrder, ['user-agent', 'accept']);
    assert.deepEqual(payload.UnChangedHeaderKey, ['User-Agent']);
    assert.equal(payload.Body, 'aGVsbG8=');
    assert.equal(payload.Proxies, 'http://proxy.example:8080');
    assert.equal(payload.Timeout, 1.5);
    assert.equal(payload.AllowRedirects, true);
    assert.equal(payload.ForceHTTP1, true);
    assert.equal(payload.Stream, undefined);
    assert.equal(JSON.parse(payload.TLSExtensions ?? '{}').client_hello_hex_stream, '160301');
    assert.deepEqual(JSON.parse(payload.HTTP2Settings ?? '{}').settings, {
      HEADER_TABLE_SIZE: 65536,
    });
  });

  it('native-transport converts native responses, preserves set-cookie, and frees response handles', async () => {
    const calls: string[] = [];
    const backend = new NativeTransportBackend({ ffi: fakeFfi({ calls }) });

    const response = await backend.request({ url: 'https://example.test/' });

    assert.equal(response.status, 201);
    assert.equal(response.statusText, 'Created');
    assert.equal(response.protocol, 'HTTP/2');
    assert.deepEqual(response.rawHeaders, [
      ['content-type', 'text/plain'],
      ['set-cookie', 'a=1; Path=/; HttpOnly'],
      ['set-cookie', 'b=2; Secure'],
    ]);
    assert.equal(new TextDecoder().decode(response.body), 'ok');
    assert.deepEqual(
      response.cookies.map((cookie) => [cookie.name, cookie.value]),
      [
        ['native', 'cookie'],
        ['a', '1'],
        ['b', '2'],
      ],
    );
    assert.deepEqual(calls, ['request', 'free:response-1']);
  });

  it('native-transport streams response chunks without buffering and closes once', async () => {
    const calls: string[] = [];
    const backend = new NativeTransportBackend({ ffi: fakeFfi({ calls }) });
    const stream = await backend.stream({ url: 'https://example.test/', streamResponse: true });

    assert.equal(stream.status, 200);
    assert.equal(new TextDecoder().decode((await stream.read(3)) ?? new Uint8Array()), 'one');
    assert.equal(new TextDecoder().decode((await stream.read(3)) ?? new Uint8Array()), 'two');
    assert.equal(await stream.read(3), null);
    await stream.close();

    assert.deepEqual(calls, [
      'streamRequest',
      'streamRead:stream-1:3',
      'streamRead:stream-1:3',
      'streamRead:stream-1:3',
      'streamClose:stream-1',
    ]);
  });

  it('native-transport wraps native errors in typed transport errors', async () => {
    const backend = new NativeTransportBackend({ ffi: fakeFfi({ failRequest: true }) });

    await assert.rejects(
      () => backend.request({ url: 'https://example.test/' }),
      NativeTransportError,
    );
  });
});

function fakeFfi(
  options: { calls?: string[]; failRequest?: boolean; payloads?: NativeRequestPayload[] } = {},
): NativeFfiClient {
  const calls = options.calls ?? [];
  let readCount = 0;

  return {
    async request(payload: NativeRequestPayload): Promise<NativeResponsePayload> {
      options.payloads?.push(payload);
      calls.push('request');
      if (options.failRequest) {
        throw new NativeTransportError('native failed');
      }
      return {
        id: 'response-1',
        url: 'https://example.test/',
        status_code: 201,
        headers: {
          'content-type': ['text/plain'],
          'set-cookie': ['a=1; Path=/; HttpOnly', 'b=2; Secure'],
        },
        cookies: [
          {
            Name: 'native',
            Value: 'cookie',
            Path: '/',
            Domain: 'example.test',
            Secure: false,
            HttpOnly: true,
          },
        ],
        content: btoa('ok'),
        raw: btoa('HTTP/2 201 Created\r\ncontent-type: text/plain\r\n\r\n'),
      };
    },
    async streamRequest(_payload: NativeRequestPayload): Promise<NativeStreamOpenPayload> {
      calls.push('streamRequest');
      return { stream_id: 'stream-1', url: 'https://example.test/', status_code: 200, headers: {} };
    },
    async streamRead(streamId: string, size: number): Promise<NativeStreamReadPayload> {
      calls.push(`streamRead:${streamId}:${size}`);
      readCount += 1;
      if (readCount === 1) return { data: btoa('one'), eof: false };
      if (readCount === 2) return { data: btoa('two'), eof: false };
      return { eof: true };
    },
    async streamClose(streamId: string): Promise<void> {
      calls.push(`streamClose:${streamId}`);
    },
    async free(responseId: string): Promise<void> {
      calls.push(`free:${responseId}`);
    },
  } as NativeFfiClient;
}
