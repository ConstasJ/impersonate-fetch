import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import { Client } from '@/client.js';
import { fetch } from '@/fetch.js';
import { getCapabilities } from '@/transport/capabilities.js';
import type {
  TransportBackend,
  TransportRequest,
  TransportResponse,
  TransportStream,
} from '@/transport/types.js';

const capabilities = getCapabilities({ platform: 'linux', arch: 'x64' });

describe('client-session', () => {
  it('client-session keeps bare fetch stateless while client.fetch persists matching cookies', async () => {
    const bareRequests: TransportRequest[] = [];
    const bareBackend = scriptedBackend(bareRequests, [
      response({
        url: 'https://example.test/login',
        headers: { 'set-cookie': ['sid=bare; Path=/'] },
      }),
      response({ url: 'https://example.test/profile' }),
    ]);

    await fetch('https://example.test/login', { native: { backend: bareBackend, capabilities } });
    await fetch('https://example.test/profile', { native: { backend: bareBackend, capabilities } });

    assert.equal(bareRequests[1].headers?.cookie, undefined);

    const clientRequests: TransportRequest[] = [];
    const clientBackend = scriptedBackend(clientRequests, [
      response({
        url: 'https://example.test/login',
        headers: { 'set-cookie': ['sid=client; Path=/'] },
      }),
      response({ url: 'https://example.test/profile' }),
    ]);
    const client = new Client({ native: { backend: clientBackend, capabilities } });

    await client.fetch('https://example.test/login');
    await client.fetch('https://example.test/profile');

    assert.equal(clientRequests[1].headers?.cookie, 'sid=client');
  });

  it('client-session applies defaults and honors credentials omit', async () => {
    const requests: TransportRequest[] = [];
    const backend = scriptedBackend(requests, [
      response({
        url: 'https://example.test/login',
        headers: { 'set-cookie': ['sid=hidden; Path=/'] },
      }),
      response({ url: 'https://example.test/profile' }),
    ]);
    const client = new Client({
      cookies: { pref: 'dark' },
      headers: { 'X-Client': 'yes' },
      http2: { settings: { HEADER_TABLE_SIZE: 123 } },
      impersonate: 'chrome',
      native: { backend, capabilities },
      proxy: 'http://proxy.example:8080',
      timeout: 250,
      tls: { ja3: '771,4865,0,29,0' },
    });

    await client.fetch('https://example.test/login', { credentials: 'omit' });
    await client.fetch('https://example.test/profile', { credentials: 'omit' });

    const tlsConfig = requests[0].impersonation?.tlsConfig as {
      http2Settings?: { settings?: Record<string, number> };
      ja3?: string;
    };
    assert.equal(requests[0].headers?.['x-client'], 'yes');
    assert.equal(requests[0].headers?.cookie, undefined);
    assert.equal(requests[0].proxy, 'http://proxy.example:8080');
    assert.equal(requests[0].timeoutMs, 250);
    assert.equal(requests[0].impersonation?.preset, 'chrome');
    assert.equal(tlsConfig.ja3, '771,4865,0,29,0');
    assert.deepEqual(tlsConfig.http2Settings?.settings, { HEADER_TABLE_SIZE: 123 });
    assert.equal(requests[1].headers?.cookie, undefined);
  });

  it('client-session converts 301/302/303 POST redirects to GET and strips sensitive cross-origin headers', async () => {
    const requests: TransportRequest[] = [];
    const backend = scriptedBackend(requests, [
      response({
        status: 302,
        url: 'https://source.test/form',
        headers: { location: ['https://target.test/final'], 'set-cookie': ['sid=source; Path=/'] },
      }),
      response({ url: 'https://target.test/final' }),
    ]);
    const client = new Client({
      impersonate: { preset: 'chrome', headersOrder: ['authorization'] },
      native: { backend, capabilities },
    });

    const final = await client.fetch('https://source.test/form', {
      body: 'payload',
      headers: { authorization: 'Bearer secret', 'content-type': 'text/plain' },
      method: 'POST',
    });

    assert.equal(final.redirected, true);
    assert.equal(requests[1].url, 'https://target.test/final');
    assert.equal(requests[1].method, 'GET');
    assert.equal(requests[1].body, undefined);
    assert.equal(requests[1].headers?.authorization, undefined);
    assert.equal(requests[1].headers?.cookie, undefined);
    assert.equal(requests[1].headers?.['content-type'], undefined);
    assert.deepEqual(requests[1].impersonation?.headersOrder, ['authorization']);
  });

  it('client-session preserves 307/308 method and body across redirects', async () => {
    const requests: TransportRequest[] = [];
    const backend = scriptedBackend(requests, [
      response({
        status: 307,
        url: 'https://example.test/upload',
        headers: { location: ['/stored'] },
      }),
      response({ url: 'https://example.test/stored' }),
    ]);
    const client = new Client({ native: { backend, capabilities } });

    await client.fetch('https://example.test/upload', { body: 'payload', method: 'PUT' });

    assert.equal(requests[1].url, 'https://example.test/stored');
    assert.equal(requests[1].method, 'PUT');
    assert.equal(requests[1].body, 'payload');
  });

  it('client-session enforces redirect mode and max redirect limit', async () => {
    const manualRequests: TransportRequest[] = [];
    const manualClient = new Client({
      native: {
        backend: scriptedBackend(manualRequests, [
          response({ status: 302, headers: { location: ['/next'] } }),
        ]),
        capabilities,
      },
    });
    const manual = await manualClient.fetch('https://example.test/start', { redirect: 'manual' });

    assert.equal(manual.status, 302);
    assert.equal(manualRequests.length, 1);

    const limitClient = new Client({
      maxRedirects: 0,
      native: {
        backend: scriptedBackend([], [response({ status: 302, headers: { location: ['/loop'] } })]),
        capabilities,
      },
    });

    await assert.rejects(
      () => limitClient.fetch('https://example.test/start'),
      /Maximum redirects exceeded/,
    );
  });
});

function scriptedBackend(
  requests: TransportRequest[],
  responses: TransportResponse[],
): TransportBackend {
  return {
    name: 'native',
    async request(request: TransportRequest): Promise<TransportResponse> {
      requests.push(request);
      return nextResponse(request, responses);
    },
    async stream(request: TransportRequest): Promise<TransportStream> {
      requests.push(request);
      return responseToStream(nextResponse(request, responses));
    },
  };
}

function nextResponse(
  request: TransportRequest,
  responses: TransportResponse[],
): TransportResponse {
  return responses.shift() ?? response({ url: String(request.url) });
}

function response(options: {
  body?: string;
  headers?: Record<string, string[]>;
  status?: number;
  url?: string;
}): TransportResponse {
  const headers = normalizeHeaders(options.headers ?? { 'content-type': ['text/plain'] });
  return {
    body: encodeBytes(options.body ?? 'ok'),
    cookies: [],
    headers,
    protocol: 'HTTP/2',
    rawHeaders: Object.entries(headers).flatMap(([name, values]) =>
      values.map((value) => [name, value] as [string, string]),
    ),
    status: options.status ?? 200,
    statusText: options.status && options.status >= 300 ? 'Found' : 'OK',
    url: options.url ?? 'https://example.test/',
  };
}

function responseToStream(source: TransportResponse): TransportStream {
  let sent = false;
  return {
    url: source.url,
    status: source.status,
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

function normalizeHeaders(headers: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(headers).map(([name, values]) => [name.toLowerCase(), values]),
  );
}

function encodeBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}
