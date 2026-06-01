import {
  createServer as createHttpServer,
  request as httpRequest,
  type IncomingMessage,
  type RequestOptions,
  type ServerResponse,
} from 'node:http';
import { createServer as createHttpsServer, request as httpsRequest } from 'node:https';
import type { AddressInfo } from 'node:net';
import { createGunzip, gzipSync } from 'node:zlib';

import type {
  TransportBackend,
  TransportRequest,
  TransportResponse,
  TransportStream,
} from '@/transport/types.js';

export interface FixtureRequestRecord {
  body: Uint8Array;
  headers: Record<string, string | string[] | undefined>;
  httpVersion: string;
  method: string;
  protocol: string;
  rawHeaders: string[];
  url: string;
}

export interface FixtureServer {
  readonly backend: FixtureTransportBackend;
  readonly httpBaseUrl: string;
  readonly httpsBaseUrl: string;
  readonly requests: FixtureRequestRecord[];
  close(): Promise<void>;
  reset(): void;
  url(path: string, scheme?: 'http' | 'https'): string;
}

export interface FixtureTransportBackend extends TransportBackend {
  readonly requests: TransportRequest[];
}

export async function startFixtureServer(): Promise<FixtureServer> {
  const requests: FixtureRequestRecord[] = [];
  const httpServer = createHttpServer((request, response) =>
    handleRequest('http', requests, request, response),
  );
  const httpsServer = createHttpsServer(
    { key: localhostKey, cert: localhostCert, ALPNProtocols: ['http/1.1'] },
    (request, response) => handleRequest('https', requests, request, response),
  );

  const [httpPort, httpsPort] = await Promise.all([listen(httpServer), listen(httpsServer)]);
  const server: FixtureServer = {
    backend: createFixtureBackend(),
    httpBaseUrl: `http://127.0.0.1:${httpPort}`,
    httpsBaseUrl: `https://127.0.0.1:${httpsPort}`,
    requests,
    async close() {
      await Promise.all([closeServer(httpServer), closeServer(httpsServer)]);
    },
    reset() {
      requests.length = 0;
      server.backend.requests.length = 0;
    },
    url(path: string, scheme: 'http' | 'https' = 'http') {
      return `${scheme === 'https' ? server.httpsBaseUrl : server.httpBaseUrl}${path}`;
    },
  };

  return server;
}

function createFixtureBackend(): FixtureTransportBackend {
  const requests: TransportRequest[] = [];

  return {
    name: 'native',
    requests,
    async request(request: TransportRequest): Promise<TransportResponse> {
      requests.push(request);
      const stream = await openFixtureStream(request);
      const chunks: Uint8Array[] = [];
      let total = 0;

      try {
        for (;;) {
          const chunk = await stream.read();
          if (chunk === null) {
            return {
              url: stream.url,
              status: stream.status,
              statusText: statusText(stream.status),
              headers: stream.headers,
              rawHeaders: stream.rawHeaders,
              body: concatBytes(chunks, total),
              cookies: stream.cookies,
              protocol: stream.protocol,
              fingerprint: stream.fingerprint,
            };
          }
          chunks.push(chunk);
          total += chunk.byteLength;
        }
      } finally {
        await stream.close();
      }
    },
    async stream(request: TransportRequest): Promise<TransportStream> {
      requests.push(request);
      return openFixtureStream(request);
    },
  };
}

async function openFixtureStream(request: TransportRequest): Promise<TransportStream> {
  const url = new URL(String(request.url));
  const body = await bodyToBuffer(request.body);
  const requestOptions: RequestOptions = {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port,
    path: `${url.pathname}${url.search}`,
    method: request.method ?? 'GET',
    headers: request.headers,
  };

  return new Promise((resolve, reject) => {
    const handleResponse = (response: IncomingMessage) => {
      const source =
        response.headers['content-encoding'] === 'gzip' ? response.pipe(createGunzip()) : response;
      const iterator = source[Symbol.asyncIterator]();
      const protocol = `HTTP/${response.httpVersion}`;
      const alpnProtocol =
        'alpnProtocol' in response.socket && response.socket.alpnProtocol
          ? response.socket.alpnProtocol
          : url.protocol === 'https:'
            ? 'http/1.1'
            : undefined;
      let closed = false;

      const stream: TransportStream = {
        url: request.url.toString(),
        status: response.statusCode ?? 0,
        headers: normalizeResponseHeaders(response.headers),
        rawHeaders: rawHeaderPairs(response.rawHeaders),
        cookies: [],
        protocol,
        fingerprint: {
          alpnProtocol,
          httpVersion: protocol,
          requestedHttp2SettingsOrder: readHttp2SettingsOrder(request),
          requestedJa3: readRequestedJa3(request),
          requestedPseudoHeaderOrder: request.impersonation?.pseudoHeaderOrder,
          proxy: request.proxy,
        },
        async read(): Promise<Uint8Array | null> {
          if (closed) {
            return null;
          }
          const next = await iterator.next();
          if (next.done) {
            return null;
          }
          return toUint8Array(next.value);
        },
        async close(): Promise<void> {
          if (closed) {
            return;
          }
          closed = true;
          source.destroy();
          response.destroy();
        },
        async *[Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
          for (;;) {
            const chunk = await stream.read();
            if (chunk === null) {
              return;
            }
            yield chunk;
          }
        },
      };
      resolve(stream);
    };
    const outgoing =
      url.protocol === 'https:'
        ? httpsRequest(
            {
              ...requestOptions,
              rejectUnauthorized: false,
            },
            handleResponse,
          )
        : httpRequest(requestOptions, handleResponse);

    outgoing.once('error', reject);
    if (body.byteLength > 0) {
      outgoing.write(body);
    }
    outgoing.end();
  });
}

async function handleRequest(
  scheme: 'http' | 'https',
  requests: FixtureRequestRecord[],
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const body = await readNodeStream(request);
  const record: FixtureRequestRecord = {
    body,
    headers: request.headers,
    httpVersion: request.httpVersion,
    method: request.method ?? 'GET',
    protocol: `${scheme.toUpperCase()}/${request.httpVersion}`,
    rawHeaders: [...request.rawHeaders],
    url: request.url ?? '/',
  };
  requests.push(record);

  const url = new URL(request.url ?? '/', `${scheme}://fixture.test`);

  if (url.pathname === '/echo') {
    sendJson(response, 200, {
      bodyBase64: Buffer.from(body).toString('base64'),
      cookie: request.headers.cookie ?? null,
      headers: request.headers,
      httpVersion: request.httpVersion,
      method: request.method,
      protocol: record.protocol,
      rawHeaders: request.rawHeaders,
      url: request.url,
    });
    return;
  }

  if (url.pathname === '/cookies') {
    response.setHeader('set-cookie', ['sid=fixture; Path=/; HttpOnly', 'theme=dark; Path=/']);
    sendJson(response, 200, { cookie: request.headers.cookie ?? null });
    return;
  }

  if (url.pathname === '/redirect') {
    response.writeHead(302, { location: '/final', 'set-cookie': 'redirected=yes; Path=/' });
    response.end('redirecting');
    return;
  }

  if (url.pathname === '/final') {
    sendJson(response, 200, {
      final: true,
      cookie: request.headers.cookie ?? null,
      url: request.url,
    });
    return;
  }

  if (url.pathname === '/binary') {
    response.writeHead(200, { 'content-type': 'application/octet-stream' });
    response.end(Buffer.from([0, 1, 2, 3, 253, 254, 255]));
    return;
  }

  if (url.pathname === '/non-utf8') {
    response.writeHead(200, { 'content-type': 'text/plain; charset=iso-8859-1' });
    response.end(Buffer.from([0x63, 0x61, 0x66, 0xe9]));
    return;
  }

  if (url.pathname === '/compressed') {
    response.writeHead(200, { 'content-encoding': 'gzip', 'content-type': 'text/plain' });
    response.end(gzipSync('compressed fixture'));
    return;
  }

  if (url.pathname === '/large') {
    response.writeHead(200, { 'content-type': 'application/octet-stream' });
    await writeLargeResponse(response);
    return;
  }

  if (url.pathname === '/upload-policy') {
    sendJson(response, 200, {
      accepted: body.byteLength <= 2 * 1024 * 1024,
      size: body.byteLength,
    });
    return;
  }

  sendJson(response, 404, { error: 'not found' });
}

function listen(server: ReturnType<typeof createHttpServer>): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve((server.address() as AddressInfo).port);
    });
  });
}

function closeServer(server: ReturnType<typeof createHttpServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(value));
}

async function writeLargeResponse(response: ServerResponse): Promise<void> {
  const chunk = Buffer.alloc(16 * 1024, 0x61);
  for (let index = 0; index < 64; index += 1) {
    if (!response.write(chunk)) {
      await new Promise<void>((resolve) => response.once('drain', resolve));
    }
  }
  response.end();
}

async function readNodeStream(stream: AsyncIterable<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const bytes = toUint8Array(chunk);
    chunks.push(bytes);
    total += bytes.byteLength;
  }
  return concatBytes(chunks, total);
}

async function bodyToBuffer(body: TransportRequest['body']): Promise<Buffer> {
  if (body === undefined || body === null) {
    return Buffer.alloc(0);
  }
  if (typeof body === 'string') {
    return Buffer.from(body);
  }
  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }
  if (body instanceof ArrayBuffer) {
    return Buffer.from(body);
  }
  return Buffer.from(await readWebStream(body));
}

async function readWebStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  return concatBytes(chunks, total);
}

function concatBytes(chunks: Uint8Array[], total: number): Uint8Array {
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function toUint8Array(value: Uint8Array | Buffer): Uint8Array {
  return value instanceof Uint8Array
    ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    : new Uint8Array(value);
}

function normalizeResponseHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string[]> {
  const normalized: Record<string, string[]> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }
    normalized[name.toLowerCase()] = Array.isArray(value) ? value.map(String) : [String(value)];
  }
  return normalized;
}

function rawHeaderPairs(rawHeaders: string[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let index = 0; index < rawHeaders.length; index += 2) {
    pairs.push([rawHeaders[index], rawHeaders[index + 1] ?? '']);
  }
  return pairs;
}

function readRequestedJa3(request: TransportRequest): unknown {
  const tlsConfig = request.impersonation?.tlsConfig as { ja3?: unknown } | undefined;
  return request.impersonation?.ja3 ?? tlsConfig?.ja3;
}

function readHttp2SettingsOrder(request: TransportRequest): unknown {
  const tlsConfig = request.impersonation?.tlsConfig as
    | { http2Settings?: { settingsOrder?: unknown }; http2_settings?: { settings_order?: unknown } }
    | undefined;
  return tlsConfig?.http2Settings?.settingsOrder ?? tlsConfig?.http2_settings?.settings_order;
}

function statusText(status: number): string {
  if (status === 200) return 'OK';
  if (status === 302) return 'Found';
  if (status === 404) return 'Not Found';
  return '';
}

const localhostKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCpSJukRvo93kdA
s1aifIIF3E6NA0rJungnA5wjWqFZ7VBrBMcdxzkMPB95FrNXN0xN94Nb01As4lsy
apFrZvgGTifJSttwibLTDq3vd5+lFcQ1MnLgxE9SzBeY2KA1uxolNKJzzP1hwqSF
mTN32LXPFVihnzGpmtzOsdhPd9McCrpuvsX9eIL+wbc2PgH11Bu/BZuMQV/a/GE0
FIz25wnlXPWgpk7/xrE3DeHqmGyGJiPJWOOtMyvbwZsV+Wu9siVmflguADQXHYVs
+xHY/ecUmzBMk1lgqWV82Khg9ZrCFvJhTg0LoiLNRUkU+8QGsXQt8wKfDT5o68Oz
fHLILu8JAgMBAAECggEANC1VC8V0zCz++UpNobeOvA+zhnNFUfhPoHbUYXFF2lnz
N4k5dkw5oTPG36PHk1JQCpgHvP3c8Hi0c021lM0gFZFxYfHYwU8v9y3HHtBYPKIA
4AS0s+LOME8H1uyuNOF+pYkbqWW9k6xS2XrnCkGZiEKkFuziecxp0quuaJAeWb3U
N9k34r2+l5NiXdfvF1ddkYMrpiFLGPi05QMcsDAmKbI5GLo2kVDbgnCGTEPc1bne
sZAmywpYhB+zxhmJlK3VSfCIDPzErfmm4cENAFfRqO9846Up0XPMBeeiV7BxGpEn
OuD1wTPIsKUlJvvx+WKv4UYxjcc9Um8EiZscj1TKIQKBgQDdMjA9fukcmwwpmduX
vU/D0jYH1AY7PzVuMg7HfFNaOordWJW9ZCrt6nAu6MdhJNSIwxUZpP6LXdvNglPD
vbs8En2ddG8w79g6Kd/xPgijaVM1Y+rXdv7mn3AmqSilpGevlyzEEniSIwjWpyA9
ScvruRbXyXuqW1Ktt+MkXrKqvwKBgQDD62EDoNvUBZkJ/wEFjbNtAJJgMvJu/0pF
drfIrmzgTymoNmGvxrRwoLcjSECoGl1pZzRfvSpXg16oF3uvulHUcgpv7u+VnyFX
fJe/J9LeeeQ+ZGy4x7tbj5lFMvMRkTx4EUz5dYstDDPbaa/RFnZ/ydiVPUbRROZa
6t/k8IPANwKBgDrWs+BX1viGAdk7FR+q+wHS9A5nBvVRngvfAvFrj9yLgA7bFpHX
iFfbKdZAk3Cy1FpA0mcM7azy3ZowFcoWuSyEmqd8pms1EaZ/JxPL9Y5KYRjtqDWC
cNG2DaYrDyXosrARnZXWd/4flaVLtZa3/6eHh50E+oFZY4fUR3aQPiSPAoGBAKNn
Oa7RBwe6831G1g9PtAqBo5PgahrxiXyOG5KhB+W9oLzPPoJgdDZLlPM0W9jYxHgY
v7HqD9qVkukXTO2vtHg/9TyOR/y+kAxruhSQnms3tonjMFqdG0KubeMtL1XDkG+D
3nNg+gdEWivx5dW5qnPCYYV3ag04Lfg+VSaZAwnZAoGAcfO8HDZYo2iXw6W/UcAb
3YwU4gNpjOpXGYz/WiuycGMSHVPWPAxcU1v0p5KzmuPuBaKQFuSw547E7tpJz454
F8+909ikeOlFEJnYlLK/vPlwQINk7WdyodjREWKjdkAyXL/0iJcQMjdOzox+8F7K
WZNJ2P+UTRGW5CuqmevR4mQ=
-----END PRIVATE KEY-----
`;

const localhostCert = `-----BEGIN CERTIFICATE-----
MIIDJTCCAg2gAwIBAgIULFNOZGkHSU74EMjcTgd82XBqWHkwDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTI2MDUyODExMTY1MVoXDTM2MDUy
NTExMTY1MVowFDESMBAGA1UEAwwJbG9jYWxob3N0MIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAqUibpEb6Pd5HQLNWonyCBdxOjQNKybp4JwOcI1qhWe1Q
awTHHcc5DDwfeRazVzdMTfeDW9NQLOJbMmqRa2b4Bk4nyUrbcImy0w6t73efpRXE
NTJy4MRPUswXmNigNbsaJTSic8z9YcKkhZkzd9i1zxVYoZ8xqZrczrHYT3fTHAq6
br7F/XiC/sG3Nj4B9dQbvwWbjEFf2vxhNBSM9ucJ5Vz1oKZO/8axNw3h6phshiYj
yVjjrTMr28GbFflrvbIlZn5YLgA0Fx2FbPsR2P3nFJswTJNZYKllfNioYPWawhby
YU4NC6IizUVJFPvEBrF0LfMCnw0+aOvDs3xyyC7vCQIDAQABo28wbTAdBgNVHQ4E
FgQUZdRzE2hKVsnjdr11J4GGCxPInUcwHwYDVR0jBBgwFoAUZdRzE2hKVsnjdr11
J4GGCxPInUcwDwYDVR0TAQH/BAUwAwEB/zAaBgNVHREEEzARgglsb2NhbGhvc3SH
BH8AAAEwDQYJKoZIhvcNAQELBQADggEBABx/D0LmOGLajfM36S2KLNVfCy+8XSAZ
mROpHN+ZZONBO1dukf7KpUTRj7dbcfutqrXPWjc8UgtqvBCgXlm4NC/Ge9dwBCmx
4Wc3iOcKHIEIKQrOZj6hMM0xyEpfCOn3yt97j+VrZ0WoTcfAYohHWlxFN0fiYeZt
lk+zuDbSFOlmYAKiErD4zeeKYFNTqYFro3V+x4SNGbJH58JCIJR0fMwykH4T65Be
twLosAnQ8KBw+ECMnbB2SbZVFiD7caq6JKgcl0oxFfoCJgU5zX8bNZXqQtUc9XSB
GQV1wFM74s75pfBX1LOhH6l3bSGJxuBHEDA0fUyJkk3n9WQsWqbbIdQ=
-----END CERTIFICATE-----
`;
