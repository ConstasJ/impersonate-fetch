import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import { createOrderedHeaderMetadata } from '@/impersonation/config.js';
import { tlsConfigFromSnakeCase, tlsConfigToSnakeCase } from '@/impersonation/convert.js';
import { randomizeJa3, tlsConfigFromBrowserFingerprint } from '@/impersonation/fingerprint.js';
import {
  getBrowserPreset,
  getTLSPreset,
  TLS_CHROME_148,
  TLS_CHROME_LATEST,
  TLS_FIREFOX_105,
} from '@/impersonation/presets.js';

const chrome148Ja3 =
  '771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,18-5-65281-27-43-0-51-13-65037-10-23-35-16-11-45-17613-41,4588-29-23-24,0';

const chrome148UserAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

const readmeTlsConfigFixture = {
  id: 'readme-example',
  ja3: '771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,16-18-5-27-0-13-11-43-45-35-51-23-10-65281-17513-21,29-23-24,0',
  random_ja3: false,
  headers_order: null,
  un_changed_header_key: null,
  force_http1: false,
  pseudo_header_order: [':method', ':authority', ':scheme', ':path'],
  tls_extensions: {
    supported_signature_algorithms: [
      'ecdsa_secp256r1_sha256',
      'rsa_pss_rsae_sha256',
      'rsa_pkcs1_sha256',
      'ecdsa_secp384r1_sha384',
      'rsa_pss_rsae_sha384',
      'rsa_pkcs1_sha384',
      'rsa_pss_rsae_sha512',
      'rsa_pkcs1_sha512',
    ],
    cert_compression_algo: ['brotli'],
    record_size_limit: 4001,
    supported_delegated_credentials_algorithms: null,
    supported_versions: ['GREASE', '1.3', '1.2'],
    psk_key_exchange_modes: ['PskModeDHE'],
    signature_algorithms_cert: null,
    key_share_curves: ['GREASE', 'X25519'],
    not_used_grease: false,
    client_hello_hex_stream: '16030107b4010007b00303',
  },
  http2_settings: {
    settings: {
      HEADER_TABLE_SIZE: 65536,
      ENABLE_PUSH: 0,
      MAX_CONCURRENT_STREAMS: 1000,
      INITIAL_WINDOW_SIZE: 6291456,
      MAX_HEADER_LIST_SIZE: 262144,
    },
    settings_ack: false,
    settings_order: [
      'HEADER_TABLE_SIZE',
      'ENABLE_PUSH',
      'MAX_CONCURRENT_STREAMS',
      'INITIAL_WINDOW_SIZE',
      'MAX_HEADER_LIST_SIZE',
    ],
    connection_flow: 15663105,
    headers_id: 1,
    header_priority: {
      streamDep: 0,
      exclusive: true,
      weight: 256,
    },
    priority_frames: null,
  },
  user_agent: '',
};

const ja4HeaderFixture = {
  id: 'ja4-example',
  ja3: '772,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-17513-21-41,29-23-24,0',
  random_ja3: false,
  headers_order: [
    'HOST',
    'connection',
    'pragma',
    'Cache-Control',
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
  ],
  un_changed_header_key: ['sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform'],
  force_http1: true,
  pseudo_header_order: [':method', ':authority', ':scheme', ':path'],
  tls_extensions: {
    ...readmeTlsConfigFixture.tls_extensions,
    record_size_limit: null,
    client_hello_hex_stream: '',
  },
  http2_settings: readmeTlsConfigFixture.http2_settings,
  user_agent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36',
};

const browserFingerprintFixture = {
  http_version: 'h2',
  user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:105.0) Gecko/20100101 Firefox/105.0',
  tls: {
    ja3: '771,4865-4867-4866-49195-49199-52393-52392-49196-49200-49162-49161-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-34-51-43-13-45-28-21,29-23-24-25-256-257,0',
    extensions: [
      { name: 'server_name (0)', server_name: 'tls.peet.ws' },
      {
        name: 'delegated_credentials (34)',
        signature_hash_algorithms: ['ecdsa_secp256r1_sha256', 'ecdsa_sha1'],
      },
      {
        name: 'key_share (51)',
        shared_keys: [
          { 'X25519 (29)': '318c61501ecc8cbb47e9f29e508e71eae0819128737c2d6a59d5cd175fc12a64' },
          {
            'P-256 (23)':
              '04c39fb8c4c41aa3abf877bf6561bafbbd133aedf872a6d7201a3f51075862298571c8fe27a5d60d579afe63a968341b95e452cd03be7dd2d054b2cf42d92006c9',
          },
        ],
      },
      { name: 'supported_versions (43)', versions: ['TLS 1.3', 'TLS 1.2'] },
      {
        name: 'signature_algorithms (13)',
        signature_algorithms: ['ecdsa_secp256r1_sha256', 'rsa_pss_rsae_sha256', 'rsa_pkcs1_sha256'],
      },
      {
        name: 'psk_key_exchange_modes (45)',
        PSK_Key_Exchange_Mode: 'PSK with (EC)DHE key establishment (psk_dhe_ke) (1)',
      },
      { name: 'record_size_limit (28)', data: '4001' },
    ],
  },
  http2: {
    sent_frames: [
      {
        frame_type: 'SETTINGS',
        settings: [
          'HEADER_TABLE_SIZE = 65536',
          'INITIAL_WINDOW_SIZE = 131072',
          'MAX_FRAME_SIZE = 16384',
        ],
      },
      { frame_type: 'WINDOW_UPDATE', increment: 12517377 },
      {
        frame_type: 'PRIORITY',
        stream_id: 3,
        priority: { weight: 201, depends_on: 0, exclusive: 0 },
      },
      {
        frame_type: 'PRIORITY',
        stream_id: 5,
        priority: { weight: 101, depends_on: 0, exclusive: 0 },
      },
      {
        frame_type: 'HEADERS',
        stream_id: 15,
        headers: [
          ':method: GET',
          ':path: /api/all',
          ':authority: tls.peet.ws',
          ':scheme: https',
          'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:105.0) Gecko/20100101 Firefox/105.0',
          'accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'accept-language: zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
          'accept-encoding: deflate, br',
          'upgrade-insecure-requests: 1',
          'sec-fetch-dest: document',
          'sec-fetch-mode: navigate',
          'sec-fetch-site: none',
          'sec-fetch-user: ?1',
          'te: trailers',
        ],
        priority: { weight: 42, depends_on: 13, exclusive: 0 },
      },
    ],
  },
};

describe('impersonation-types', () => {
  it('converts Python snake_case TLSConfig JSON to camelCase and back', () => {
    const config = tlsConfigFromSnakeCase(readmeTlsConfigFixture);

    assert.equal(config.randomJa3, false);
    assert.equal(config.forceHttp1, false);
    assert.equal(config.tlsExtensions.clientHelloHexStream, '16030107b4010007b00303');
    assert.deepEqual(
      config.http2Settings.settingsOrder,
      readmeTlsConfigFixture.http2_settings.settings_order,
    );
    assert.deepEqual(tlsConfigToSnakeCase(config), readmeTlsConfigFixture);
  });

  it('ports browser-captured JSON into HTTP/2 settings and priority frames', () => {
    const config = tlsConfigFromBrowserFingerprint(browserFingerprintFixture);

    assert.deepEqual(config.pseudoHeaderOrder, [':method', ':path', ':authority', ':scheme']);
    assert.deepEqual(config.headersOrder, [
      'user-agent',
      'accept',
      'accept-language',
      'accept-encoding',
      'upgrade-insecure-requests',
      'sec-fetch-dest',
      'sec-fetch-mode',
      'sec-fetch-site',
      'sec-fetch-user',
      'te',
    ]);
    assert.deepEqual(config.tlsExtensions.keyShareCurves, ['X25519', 'P256']);
    assert.deepEqual(config.tlsExtensions.supportedVersions, ['1.3', '1.2']);
    assert.equal(config.tlsExtensions.recordSizeLimit, 4001);
    assert.equal(config.tlsExtensions.notUsedGrease, true);
    assert.deepEqual(config.http2Settings.settingsOrder, [
      'HEADER_TABLE_SIZE',
      'INITIAL_WINDOW_SIZE',
      'MAX_FRAME_SIZE',
    ]);
    assert.equal(config.http2Settings.connectionFlow, 12517377);
    assert.equal(config.http2Settings.headersId, 15);
    assert.deepEqual(config.http2Settings.headerPriority, {
      weight: 42,
      streamDep: 13,
      exclusive: false,
    });
    assert.deepEqual(config.http2Settings.priorityFrames, [
      { streamID: 3, priorityParam: { weight: 201, streamDep: 0, exclusive: false } },
      { streamID: 5, priorityParam: { weight: 101, streamDep: 0, exclusive: false } },
    ]);
  });

  it('preserves JA4 header ordering and unchanged header key metadata outside Headers', () => {
    const config = tlsConfigFromSnakeCase(ja4HeaderFixture);
    const metadata = createOrderedHeaderMetadata(
      {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9',
        'Sec-Fetch-Dest': 'document',
        'User-Agent': ja4HeaderFixture.user_agent,
      },
      config,
    );

    assert.equal(config.forceHttp1, true);
    assert.deepEqual(metadata.headersOrder, ja4HeaderFixture.headers_order);
    assert.deepEqual(metadata.unChangedHeaderKey, ja4HeaderFixture.un_changed_header_key);
    assert.equal(metadata.headers['Sec-Fetch-Dest'], 'document');
    assert.equal(metadata.headers['User-Agent'], ja4HeaderFixture.user_agent);
  });

  it('exposes browser presets with complete TLS/HTTP2 payload fields', () => {
    const chrome = getTLSPreset('TLS_CHROME_LATEST');
    const firefoxNative = tlsConfigToSnakeCase(TLS_FIREFOX_105);
    const safariIos = getBrowserPreset('safariIos');

    assert.notEqual(chrome, TLS_CHROME_LATEST);
    assert.equal(chrome.randomJa3, true);
    assert.equal(chrome.http2Settings.settings?.HEADER_TABLE_SIZE, 65536);
    assert.equal(firefoxNative.http2_settings.priority_frames?.length, 6);
    assert.equal(firefoxNative.http2_settings.priority_frames?.[5]?.streamID, 13);
    assert.deepEqual(safariIos.pseudoHeaderOrder, [':method', ':scheme', ':path', ':authority']);
    assert.equal(tlsConfigToSnakeCase(safariIos).tls_extensions.client_hello_hex_stream, '');
  });

  it('exposes Chrome 148 as the latest Chrome TLS preset', () => {
    const latestChrome = getTLSPreset('TLS_CHROME_LATEST');
    const explicitChrome = getTLSPreset('TLS_CHROME_148');
    const browserChrome = getBrowserPreset('chrome');

    assert.notEqual(latestChrome, TLS_CHROME_LATEST);
    assert.notEqual(explicitChrome, TLS_CHROME_148);
    assert.equal(TLS_CHROME_148.ja3, chrome148Ja3);
    assert.equal(TLS_CHROME_148.userAgent, chrome148UserAgent);
    assert.equal(latestChrome.ja3, chrome148Ja3);
    assert.equal(browserChrome.ja3, chrome148Ja3);
    assert.deepEqual(TLS_CHROME_148.tlsExtensions.keyShareCurves, ['GREASE', '4588', 'X25519']);
    assert.deepEqual(TLS_CHROME_148.http2Settings.settingsOrder, [
      'HEADER_TABLE_SIZE',
      'ENABLE_PUSH',
      'INITIAL_WINDOW_SIZE',
      'MAX_HEADER_LIST_SIZE',
    ]);
    assert.deepEqual(TLS_CHROME_148.http2Settings.headerPriority, {
      weight: 256,
      streamDep: 0,
      exclusive: true,
    });
  });

  it('randomizes JA3 extension order while keeping PSK extension 41 last', () => {
    const ja3 = TLS_CHROME_LATEST.ja3;
    assert.ok(ja3);
    const randomized = randomizeJa3(ja3, () => 0);
    const originalExtensions = ja3.split(',')[2].split('-').toSorted();
    const randomizedExtensions = randomized.split(',')[2].split('-');

    assert.notEqual(randomized, ja3);
    assert.equal(randomizedExtensions.at(-1), '41');
    assert.deepEqual(randomizedExtensions.toSorted(), originalExtensions);
  });
});
