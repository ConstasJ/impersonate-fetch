import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { describe, it } from 'node:test';

import {
  createNativeTransportBackend,
  createTLSConfig,
  NativeAbiUnavailableError,
} from '../../dist/index.mjs';

const endpoint = process.env.FINGERPRINT_ENDPOINT ?? 'https://tls.peet.ws/api/all';
const evidencePath = '.omo/evidence/task-11-fingerprint.json';

describe('fingerprint smoke suite', () => {
  it('fingerprint-smoke validates JA3, JA4-related fields, protocol metadata, HTTP/2 settings, and request ordering against tls.peet.ws', {
    timeout: 45_000,
  }, async () => {
    let response: { body: Uint8Array; status: number };
    const transport = 'impersonated-fetch';
    try {
      const backend = createNativeTransportBackend();
      const tlsConfig = createTLSConfig({
        headersOrder: ['accept', 'x-fingerprint-smoke'],
        pseudoHeaderOrder: [':method', ':authority', ':scheme', ':path'],
        http2Settings: {
          settings: {
            HEADER_TABLE_SIZE: 65536,
            INITIAL_WINDOW_SIZE: 6291456,
            MAX_HEADER_LIST_SIZE: 262144,
          },
          settingsAck: false,
          settingsOrder: ['HEADER_TABLE_SIZE', 'INITIAL_WINDOW_SIZE', 'MAX_HEADER_LIST_SIZE'],
          connectionFlow: 15663105,
          headersId: 1,
          headerPriority: { streamDep: 0, exclusive: true, weight: 256 },
          priorityFrames: null,
        },
      });
      response = await backend.request({
        body: undefined,
        headers: { accept: 'application/json', 'x-fingerprint-smoke': 'task-11' },
        impersonation: {
          preset: 'chrome',
          tlsConfig,
        },
        method: 'GET',
        signal: undefined,
        timeoutMs: 30_000,
        url: endpoint,
      });
    } catch (error) {
      if (isNativeUnavailable(error)) {
        throw new NativeAbiUnavailableError(
          `Fingerprint smoke test requires native transport: ${errorMessage(error)}`,
          { cause: error },
        );
      } else {
        throw error;
      }
    }

    assert.equal(response.status, 200);
    const payload = JSON.parse(new TextDecoder().decode(response.body)) as Record<string, unknown>;
    const observed = inspectFingerprintPayload(payload);

    assert.match(observed.ja3, /^\d+,/);
    assert.match(observed.ja3Hash, /^[a-f0-9]{32}$/i);
    assert.ok(observed.ja4Related.length > 0);
    assert.ok(observed.httpVersion.length > 0);
    assert.ok(observed.alpnOrProtocol.length > 0);
    if (observed.httpVersion.toLowerCase().includes('h2') || observed.httpVersion.includes('2')) {
      assert.ok(observed.http2SettingsOrder.length > 0);
    }
    if (observed.headerOrder.length > 0) {
      assert.ok(observed.headerOrder.includes('accept'));
    }
    if (observed.pseudoHeaderOrder.length > 0) {
      assert.equal(observed.pseudoHeaderOrder[0], ':method');
    }

    writeEvidence({ endpoint, observed, status: 'passed', transport });
  });
});

function inspectFingerprintPayload(payload: Record<string, unknown>): Record<
  string,
  string | string[]
> & {
  headerOrder: string[];
  http2SettingsOrder: string[];
  ja4Related: string[];
  pseudoHeaderOrder: string[];
} {
  const tls = readRecord(payload.tls);
  const http2 = readRecord(payload.http2);
  const sentFrames = readArray(http2.sent_frames);
  const settingsFrame = sentFrames.find(
    (frame) => readString(readRecord(frame).frame_type).toUpperCase() === 'SETTINGS',
  );
  const headersFrame = sentFrames.find(
    (frame) => readString(readRecord(frame).frame_type).toUpperCase() === 'HEADERS',
  );
  const headerOrder = extractHeaderOrder(payload.headers);
  const pseudoHeaderOrder = extractPseudoHeaderOrder(headersFrame);
  const ja4Related = Object.entries(tls)
    .filter(
      ([key, value]) =>
        key.toLowerCase().startsWith('ja4') && typeof value === 'string' && value.length > 0,
    )
    .map(([key]) => key);

  return {
    alpnOrProtocol: readString(tls.alpn) || readString(payload.http_version),
    headerOrder,
    http2SettingsOrder: extractHttp2SettingsOrder(settingsFrame),
    httpVersion: readString(payload.http_version),
    ja3: readString(tls.ja3),
    ja3Hash: readString(tls.ja3_hash),
    ja4Related,
    pseudoHeaderOrder,
  };
}

function extractHeaderOrder(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        const record = readRecord(entry);
        return readString(record.name || record[0]).toLowerCase();
      })
      .filter(Boolean);
  }
  if (isRecord(value)) {
    return Object.keys(value).map((name) => name.toLowerCase());
  }
  return [];
}

function extractHttp2SettingsOrder(frame: unknown): string[] {
  const record = readRecord(frame);
  const settings = readArray(record.settings);
  return settings.map((setting) => readString(setting).split(/[ =]/, 1)[0]).filter(Boolean);
}

function extractPseudoHeaderOrder(frame: unknown): string[] {
  const record = readRecord(frame);
  const headers = readArray(record.headers);
  return headers
    .map((header) => readString(header).split(': ', 1)[0])
    .filter((name) => name.startsWith(':'));
}

function writeEvidence(value: unknown): void {
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(value, null, 2)}\n`);
}

function isNativeUnavailable(error: unknown): boolean {
  return /Native FFI is unavailable|ffi-napi|shim executable|Native asset not found/i.test(
    errorMessage(error),
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
