import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';

import {
  ImpersonationSerializationError,
  serializeNativeRequest,
} from '@/impersonation/serialize.js';
import type { TLSConfigPayload } from '@/impersonation/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const fixtures = resolve(root, 'test', 'fixtures', 'impersonation');
const evidence = resolve(root, '.omo', 'evidence');

describe('impersonation-serialize', () => {
  it('impersonation-serialize snapshots Chrome preset native payload', () => {
    const payload = serializeNativeRequest(baseRequest({ preset: 'chrome' }));
    const tlsExtensions = parseNativeJson(payload.TLSExtensions);
    const http2Settings = parseNativeJson(payload.HTTP2Settings);

    writeEvidence('task-9-chrome-payload.snap', payload);
    assert.equal(payload.Id, 'a1695ccf-1445-4a0e-ae83-f817c64027e5');
    assert.equal(payload.RandomJA3, true);
    assert.deepEqual(payload.HeadersOrder, [
      'cache-control',
      'sec-ch-ua',
      'sec-ch-ua-mobile',
      'sec-ch-ua-platform',
      'upgrade-insecure-requests',
      'user-agent',
      'accept',
      'sec-fetch-site',
      'sec-fetch-mode',
      'sec-fetch-user',
      'sec-fetch-dest',
      'accept-encoding',
      'accept-language',
      'priority',
    ]);
    assert.deepEqual(Object.keys(tlsExtensions), [
      'supported_signature_algorithms',
      'cert_compression_algo',
      'record_size_limit',
      'supported_delegated_credentials_algorithms',
      'supported_versions',
      'psk_key_exchange_modes',
      'signature_algorithms_cert',
      'key_share_curves',
      'not_used_grease',
      'client_hello_hex_stream',
    ]);
    assert.deepEqual(http2Settings.settings_order, [
      'HEADER_TABLE_SIZE',
      'ENABLE_PUSH',
      'INITIAL_WINDOW_SIZE',
      'MAX_HEADER_LIST_SIZE',
    ]);
    assert.deepEqual(http2Settings.header_priority, { weight: 256, streamDep: 0, exclusive: true });
  });

  it('impersonation-serialize snapshots Firefox preset native payload', () => {
    const payload = serializeNativeRequest(baseRequest({ preset: 'firefox' }));
    const http2Settings = parseNativeJson(payload.HTTP2Settings);
    const tlsExtensions = parseNativeJson(payload.TLSExtensions);

    assert.equal(payload.Id, '63b08610-8ff8-44ac-8405-b37828e9d834');
    assert.equal(payload.RandomJA3, false);
    assert.deepEqual(payload.PseudoHeaderOrder, [':method', ':path', ':authority', ':scheme']);
    assert.deepEqual(tlsExtensions.cert_compression_algo, ['zlib', 'brotli', 'zstd']);
    assert.equal(tlsExtensions.not_used_grease, true);
    assert.equal(http2Settings.settings_ack, true);
    assert.equal(http2Settings.headers_id, 3);
  });

  it('impersonation-serialize snapshots custom README TLSConfig native payload', () => {
    const tlsConfig = readFixture('readme-tls-config.json');
    const payload = serializeNativeRequest(baseRequest({ tlsConfig }));

    assert.equal(payload.Id, 'readme-example');
    assert.equal(payload.Ja3, tlsConfig.ja3);
    assert.equal(
      parseNativeJson(payload.TLSExtensions).client_hello_hex_stream,
      '16030107b4010007b00303',
    );
    assert.deepEqual(
      parseNativeJson(payload.HTTP2Settings).settings_order,
      tlsConfig.http2_settings.settings_order,
    );
  });

  it('impersonation-serialize snapshots JA4 header controls', () => {
    const tlsConfig = readFixture('ja4-tls-config.json');
    const payload = serializeNativeRequest(baseRequest({ tlsConfig }));

    assert.equal(payload.ForceHTTP1, true);
    assert.deepEqual(payload.HeadersOrder, tlsConfig.headers_order);
    assert.deepEqual(payload.UnChangedHeaderKey, tlsConfig.un_changed_header_key);
    assert.deepEqual(payload.Headers, { 'User-Agent': 'agent', Accept: '*/*' });
  });

  it('impersonation-serialize snapshots deterministic random JA3', () => {
    const payload = serializeNativeRequest(
      baseRequest({
        ja3: '771,1-2-3,10-11-41,29,0',
        randomJa3: true,
        forceHttp1: true,
        headersOrder: ['accept', 'user-agent'],
        unChangedHeaderKey: ['User-Agent'],
      }),
      { random: () => 0 },
    );

    assert.equal(payload.Ja3, '771,1-2-3,11-10-41,29,0');
    assert.equal(payload.RandomJA3, true);
    assert.equal(payload.ForceHTTP1, true);
    assert.deepEqual(payload.HeadersOrder, ['accept', 'user-agent']);
    assert.deepEqual(payload.UnChangedHeaderKey, ['User-Agent']);
  });

  it('impersonation-serialize rejects unknown TLS fields and manual content-length', () => {
    assert.throws(
      () =>
        serializeNativeRequest(
          baseRequest({
            tlsConfig: { tls_extensions: { madeUpField: true } } as unknown as TLSConfigPayload,
          }),
        ),
      (error) => {
        writeUnknownOptionEvidence(error);
        return (
          error instanceof ImpersonationSerializationError && /madeUpField/.test(error.message)
        );
      },
    );

    assert.throws(
      () =>
        serializeNativeRequest({ ...baseRequest(undefined), headers: { 'content-length': '1' } }),
      /content-length/,
    );
  });
});

function baseRequest(
  impersonation: Parameters<typeof serializeNativeRequest>[0]['impersonation'],
): Parameters<typeof serializeNativeRequest>[0] {
  return {
    url: 'https://tls.peet.ws/api/all',
    method: 'GET',
    headers: { 'User-Agent': 'agent', Accept: '*/*' },
    impersonation,
  };
}

function readFixture(name: string): TLSConfigPayload {
  return JSON.parse(readFileSync(resolve(fixtures, name), 'utf8')) as TLSConfigPayload;
}

function parseNativeJson(value: string | null | undefined): Record<string, unknown> {
  assert.equal(typeof value, 'string');
  return JSON.parse(value) as Record<string, unknown>;
}

function writeEvidence(name: string, payload: unknown): void {
  mkdirSync(evidence, { recursive: true });
  writeFileSync(resolve(evidence, name), `${JSON.stringify(payload, null, 2)}\n`);
}

function writeUnknownOptionEvidence(error: unknown): void {
  mkdirSync(evidence, { recursive: true });
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  writeFileSync(resolve(evidence, 'task-9-unknown-option.log'), `${message}\n`);
}
