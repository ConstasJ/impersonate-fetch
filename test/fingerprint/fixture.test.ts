import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { Client, fetch } from '../../dist/index.mjs';
import { type FixtureServer, startFixtureServer } from '../fixtures/server.ts';

const fixtureCapabilities = {
  backend: 'native',
  platformName: 'fixture',
  arch: 'test',
  nativeAbiSymbols: [],
  platform: true,
  nativeBinary: true,
  http1_1: true,
  http2: true,
  ja3: true,
  ja4: true,
  browserPresets: true,
  customClientHello: true,
  customHttp2Settings: true,
  orderedHeaders: true,
  proxy: true,
  cookies: true,
  streamingUpload: true,
  streamingResponse: true,
  redirects: true,
  abortSignal: true,
} as const;

describe('fingerprint fixture suite', () => {
  let fixture: FixtureServer;

  before(async () => {
    fixture = await startFixtureServer();
  });

  beforeEach(() => {
    fixture.reset();
  });

  after(async () => {
    await fixture.close();
  });

  it('fingerprint-fixture validates HTTP version, ALPN metadata, header order, JA3 intent, HTTP/2 order, pseudo-header order, and proxy metadata', async () => {
    const response = await fetch(fixture.url('/echo'), {
      headers: [
        ['X-First', '1'],
        ['X-Second', '2'],
        ['Accept', 'application/json'],
      ],
      headersOrder: ['X-First', 'X-Second', 'Accept'],
      http2: {
        settings: { HEADER_TABLE_SIZE: 65536, INITIAL_WINDOW_SIZE: 6291456 },
        settingsOrder: ['HEADER_TABLE_SIZE', 'INITIAL_WINDOW_SIZE'],
      },
      impersonate: {
        ja3: '771,4865-4866,0-23-65281,29-23-24,0',
        pseudoHeaderOrder: [':method', ':authority', ':scheme', ':path'],
      },
      native: { backend: fixture.backend, capabilities: fixtureCapabilities },
      proxy: 'http://127.0.0.1:8080',
    });
    const payload = (await response.json()) as { rawHeaders: string[]; protocol: string };
    const firstIndex = payload.rawHeaders.findIndex((header) => header.toLowerCase() === 'x-first');
    const secondIndex = payload.rawHeaders.findIndex(
      (header) => header.toLowerCase() === 'x-second',
    );
    const captured = fixture.backend.requests[0];
    const fingerprint = response.fingerprint as Record<string, unknown>;

    assert.equal(response.protocol, 'HTTP/1.1');
    assert.equal(fingerprint.httpVersion, 'HTTP/1.1');
    assert.equal(payload.protocol, 'HTTP/1.1');
    assert.ok(firstIndex >= 0 && secondIndex > firstIndex);
    assert.equal(captured.proxy, 'http://127.0.0.1:8080');
    assert.deepEqual(captured.impersonation?.headersOrder, ['X-First', 'X-Second', 'Accept']);
    assert.deepEqual(fingerprint.requestedHttp2SettingsOrder, [
      'HEADER_TABLE_SIZE',
      'INITIAL_WINDOW_SIZE',
    ]);
    assert.deepEqual(fingerprint.requestedPseudoHeaderOrder, [
      ':method',
      ':authority',
      ':scheme',
      ':path',
    ]);
    assert.equal(fingerprint.requestedJa3, '771,4865-4866,0-23-65281,29-23-24,0');

    const httpsResponse = await fetch(fixture.url('/echo', 'https'), {
      native: { backend: fixture.backend, capabilities: fixtureCapabilities },
    });
    const httpsFingerprint = httpsResponse.fingerprint as Record<string, unknown>;
    assert.equal(httpsResponse.protocol, 'HTTP/1.1');
    assert.equal(httpsFingerprint.alpnProtocol, 'http/1.1');
  });

  it('fingerprint-fixture validates cookie handling and redirect behavior without network', async () => {
    const client = new Client({
      native: { backend: fixture.backend, capabilities: fixtureCapabilities },
    });

    const firstCookie = await client.fetch(fixture.url('/cookies'));
    assert.equal(((await firstCookie.json()) as { cookie: string | null }).cookie, null);

    const secondCookie = await client.fetch(fixture.url('/cookies'));
    assert.match(((await secondCookie.json()) as { cookie: string }).cookie, /sid=fixture/);

    const redirected = await client.fetch(fixture.url('/redirect'));
    const redirectedPayload = (await redirected.json()) as { final: boolean; cookie: string };

    assert.equal(redirected.redirected, true);
    assert.equal(redirected.url, fixture.url('/final'));
    assert.equal(redirectedPayload.final, true);
    assert.match(redirectedPayload.cookie, /redirected=yes/);
  });

  it('fingerprint-fixture validates binary, non-UTF8, and compressed response bodies', async () => {
    const binary = await fetch(fixture.url('/binary'), {
      native: { backend: fixture.backend, capabilities: fixtureCapabilities },
    });
    assert.deepEqual([...new Uint8Array(await binary.arrayBuffer())], [0, 1, 2, 3, 253, 254, 255]);

    const nonUtf8 = await fetch(fixture.url('/non-utf8'), {
      native: { backend: fixture.backend, capabilities: fixtureCapabilities },
    });
    assert.deepEqual([...new Uint8Array(await nonUtf8.arrayBuffer())], [0x63, 0x61, 0x66, 0xe9]);

    const compressed = await fetch(fixture.url('/compressed'), {
      native: { backend: fixture.backend, capabilities: fixtureCapabilities },
    });
    assert.equal(await compressed.text(), 'compressed fixture');
  });

  it('fingerprint-fixture validates large response streaming', async () => {
    const response = await fetch(fixture.url('/large'), {
      native: { backend: fixture.backend, capabilities: fixtureCapabilities },
    });
    const reader = response.body?.getReader();
    assert.ok(reader);

    let total = 0;
    let chunks = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks += 1;
      total += value.byteLength;
    }

    assert.equal(total, 1024 * 1024);
    assert.ok(chunks >= 1);
    assert.equal(response.bodyUsed, true);
  });

  it('fingerprint-fixture validates large upload buffering policy', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let index = 0; index < 32; index += 1) {
          controller.enqueue(new Uint8Array(32 * 1024).fill(index));
        }
        controller.close();
      },
    });

    const response = await fetch(fixture.url('/upload-policy'), {
      body,
      method: 'POST',
      native: { backend: fixture.backend, capabilities: fixtureCapabilities },
    });
    const payload = (await response.json()) as { accepted: boolean; size: number };
    const capturedBody = fixture.backend.requests[0].body;

    assert.equal(payload.accepted, true);
    assert.equal(payload.size, 1024 * 1024);
    assert.ok(capturedBody instanceof Uint8Array);
    assert.equal(capturedBody.byteLength, 1024 * 1024);
  });
});
