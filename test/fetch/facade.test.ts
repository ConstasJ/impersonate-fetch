import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { type FetchInit, fetch, getCapabilities } from '../../dist/index.mjs';
import type {
  TransportBackend,
  TransportRequest,
  TransportResponse,
  TransportStream,
} from '../../src/transport/types.ts';

const capabilities = getCapabilities({ platform: 'linux', arch: 'x64' });

describe('fetch-facade', () => {
  it('fetch-facade text() decodes response body and rejects reuse', async () => {
    const backend = fakeBackend({ body: 'hello', headers: { 'content-type': ['text/plain'] } });
    const response = await fetch('https://example.test/text', {
      native: { backend, capabilities },
    });

    assert.equal(response.status, 200);
    assert.equal(response.statusText, 'OK');
    assert.equal(response.headers.get('content-type'), 'text/plain');
    assert.equal(await response.text(), 'hello');
    await assert.rejects(() => response.text(), /Body has already been consumed/);
  });

  it('fetch-facade json() parses response JSON', async () => {
    const backend = fakeBackend({
      body: '{"ok":true}',
      headers: { 'content-type': ['application/json'] },
    });
    const response = await fetch('https://example.test/json', {
      native: { backend, capabilities },
    });

    assert.deepEqual(await response.json(), { ok: true });
  });

  it('fetch-facade arrayBuffer() and blob() expose response bytes', async () => {
    const arrayBufferResponse = await fetch('https://example.test/bytes', {
      native: { backend: fakeBackend({ body: 'bytes' }), capabilities },
    });
    const arrayBuffer = await arrayBufferResponse.arrayBuffer();

    assert.equal(decodeBytes(new Uint8Array(arrayBuffer)), 'bytes');

    const blobResponse = await fetch('https://example.test/blob', {
      native: { backend: fakeBackend({ body: 'blob' }), capabilities },
    });
    const blob = await blobResponse.blob();

    assert.equal(await blob.text(), 'blob');
  });

  it('fetch-facade rejects reused Request bodies', async () => {
    const request = new Request('https://example.test/reused', { method: 'POST', body: 'once' });
    const backend = fakeBackend();

    await fetch(request, { native: { backend, capabilities } });
    await assert.rejects(
      () => fetch(request, { native: { backend, capabilities } }),
      /Request body has already been consumed/,
    );
  });

  it('fetch-facade accepts Request input and keeps extension ordering separate from Headers', async () => {
    const requests: TransportRequest[] = [];
    const request = new Request('https://example.test/request', {
      body: 'payload',
      headers: { 'X-Req': '1' },
      method: 'POST',
    });

    await fetch(request, {
      headersOrder: ['X-Req', 'accept'],
      http2: { settings: { HEADER_TABLE_SIZE: 65536 } },
      impersonate: { preset: 'chrome' },
      native: { backend: fakeBackend({ requests }), capabilities },
      proxy: 'http://proxy.example:8080',
      timeout: 1234,
      tls: { ja3: '771,4865,0,29,0' },
    });

    const captured = requests[0];
    const tlsConfig = captured.impersonation?.tlsConfig as {
      http2Settings?: { settings?: Record<string, number> };
      ja3?: string;
    };

    assert.equal(captured.url, 'https://example.test/request');
    assert.equal(captured.method, 'POST');
    assert.equal(captured.headers?.['x-req'], '1');
    assert.equal('headersOrder' in (captured.headers ?? {}), false);
    assert.equal(decodeTransportBody(captured.body), 'payload');
    assert.equal(captured.proxy, 'http://proxy.example:8080');
    assert.equal(captured.timeoutMs, 1234);
    assert.equal(captured.impersonation?.preset, 'chrome');
    assert.deepEqual(captured.impersonation?.headersOrder, ['X-Req', 'accept']);
    assert.equal(tlsConfig.ja3, '771,4865,0,29,0');
    assert.deepEqual(tlsConfig.http2Settings?.settings, { HEADER_TABLE_SIZE: 65536 });
  });

  it('fetch-facade accepts URL string input with standard init fields', async () => {
    const requests: TransportRequest[] = [];

    await fetch('https://example.test/string', {
      body: 'hello',
      headers: [
        ['X-First', '1'],
        ['X-First', '2'],
        ['Accept', 'application/json'],
      ],
      method: 'PUT',
      native: { backend: fakeBackend({ requests }), capabilities },
    });

    assert.equal(requests[0].url, 'https://example.test/string');
    assert.equal(requests[0].method, 'PUT');
    assert.equal(requests[0].headers?.['X-First'], '1, 2');
    assert.equal(requests[0].headers?.Accept, 'application/json');
    assert.equal(decodeTransportBody(requests[0].body), 'hello');
  });

  it('fetch-facade rejects unsupported browser-only init fields instead of emulating them', async () => {
    const requests: TransportRequest[] = [];
    const backend = fakeBackend({ requests });
    const fields = [
      ['mode', 'cors'],
      ['cache', 'reload'],
      ['integrity', 'sha256-deadbeef'],
      ['referrerPolicy', 'no-referrer'],
    ] as const;

    for (const [field, value] of fields) {
      await assert.rejects(
        () =>
          fetch('https://example.test/unsupported', {
            [field]: value,
            native: { backend, capabilities },
          } as FetchInit),
        new RegExp(`RequestInit\\.${field} is not supported`),
      );
    }
    assert.equal(requests.length, 0);
  });

  it('fetch-facade supports AbortSignal before and during a transport request', async () => {
    const never = new Promise<TransportResponse>(() => undefined);
    const requests: TransportRequest[] = [];
    const backend = fakeBackend({ requests, responsePromise: never });
    const alreadyAborted = new AbortController();
    alreadyAborted.abort();

    await assert.rejects(
      () =>
        fetch('https://example.test/aborted', {
          native: { backend, capabilities },
          signal: alreadyAborted.signal,
        }),
      { name: 'AbortError' },
    );
    assert.equal(requests.length, 0);

    const controller = new AbortController();
    const pending = fetch('https://example.test/pending', {
      native: { backend, capabilities },
      signal: controller.signal,
    });
    controller.abort();

    await assert.rejects(() => pending, { name: 'AbortError' });
    assert.equal(requests.length, 1);
  });
});

function fakeBackend(
  options: {
    body?: string;
    headers?: Record<string, string[]>;
    requests?: TransportRequest[];
    responsePromise?: Promise<TransportResponse>;
  } = {},
): TransportBackend {
  return {
    name: 'native',
    async request(request: TransportRequest): Promise<TransportResponse> {
      options.requests?.push(request);
      if (options.responsePromise) {
        return options.responsePromise;
      }
      return buildResponse(request, options);
    },
    async stream(request: TransportRequest): Promise<TransportStream> {
      return responseToStream(await this.request(request));
    },
  };

  function buildResponse(request: TransportRequest, state: typeof options): TransportResponse {
    return {
      body: encodeBytes(state.body ?? 'ok'),
      cookies: [],
      headers: state.headers ?? { 'content-type': ['text/plain'] },
      protocol: 'HTTP/2',
      rawHeaders: Object.entries(state.headers ?? { 'content-type': ['text/plain'] }).flatMap(
        ([name, values]) => values.map((value) => [name, value] as [string, string]),
      ),
      status: 200,
      statusText: 'OK',
      url: String(request.url),
    };
  }

  function responseToStream(source: TransportResponse): TransportStream {
    let sent = false;
    return {
      url: source.url,
      status: source.status,
      statusText: source.statusText,
      headers: source.headers,
      rawHeaders: source.rawHeaders,
      cookies: source.cookies,
      protocol: source.protocol,
      fingerprint: source.fingerprint,
      async read(): Promise<Uint8Array | null> {
        if (sent) {
          return null;
        }
        sent = true;
        return source.body;
      },
      async close(): Promise<void> {},
      async *[Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
        const chunk = await this.read();
        if (chunk) {
          yield chunk;
        }
      },
    };
  }
}

function encodeBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function decodeBytes(value: Uint8Array): string {
  return new TextDecoder().decode(value);
}

function decodeTransportBody(body: TransportRequest['body']): string {
  if (body === undefined || body === null) {
    return '';
  }
  if (typeof body === 'string') {
    return body;
  }
  if (body instanceof Uint8Array) {
    return decodeBytes(body);
  }
  if (body instanceof ArrayBuffer) {
    return decodeBytes(new Uint8Array(body));
  }
  throw new Error('unexpected streaming request body');
}
