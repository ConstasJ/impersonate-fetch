// JA3 fingerprinting and browser fingerprint parsing
import type {
  BrowserFingerprintPayload,
  HeaderPriority,
  HTTP2SettingName,
  HTTP2Settings,
  PriorityFrame,
  PseudoHeaderName,
  TLSConfig,
  TLSExtensions,
} from './types.js';
import { defaultPseudoHeaderOrder } from './types.js';
import { createHTTP2Settings, createTLSExtensions } from './config.js';

type Nullable<T> = T | null;

// JA3 parsing and randomization
export function randomizeJa3(ja3: string, random: () => number = Math.random): string {
  const parts = ja3.split(',');
  if (parts.length !== 5) {
    throw new TypeError('JA3 must contain five comma-separated sections');
  }

  const extensions = parts[2].split('-').filter(Boolean);
  const hasPreSharedKey = extensions.includes('41');
  const shuffled = hasPreSharedKey
    ? extensions.filter((extension) => extension !== '41')
    : extensions;

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  parts[2] = [...shuffled, ...(hasPreSharedKey ? ['41'] : [])].join('-');
  return parts.join(',');
}

// Browser fingerprint parsing
export function tlsConfigFromBrowserFingerprint(payload: BrowserFingerprintPayload): TLSConfig {
  const sentFrames = payload.http2?.sent_frames ?? [];
  const extensions = payload.tls?.extensions ?? [];
  const forceHttp1 = payload.http_version !== undefined && payload.http_version !== 'h2';

  const config: TLSConfig = {
    id: globalThis.crypto?.randomUUID?.() ?? '00000000-0000-4000-8000-000000000000',
    ja3: payload.tls?.ja3 ?? null,
    randomJa3: false,
    headersOrder: getHeaderOrder(sentFrames),
    unChangedHeaderKey: null,
    forceHttp1,
    pseudoHeaderOrder: getPseudoHeaderOrder(sentFrames),
    userAgent: payload.user_agent ?? '',
    tlsExtensions: createTLSExtensions({
      supportedSignatureAlgorithms: getSupportedSignatureAlgorithms(extensions),
      certCompressionAlgo: getCertCompressionAlgo(extensions),
      recordSizeLimit: getRecordSizeLimit(extensions),
      supportedDelegatedCredentialsAlgorithms:
        getSupportedDelegatedCredentialsAlgorithms(extensions),
      supportedVersions: getSupportedVersions(extensions),
      pskKeyExchangeModes: getPskKeyExchangeModes(extensions),
      signatureAlgorithmsCert: null,
      keyShareCurves: getKeyShareCurves(extensions),
      notUsedGrease: getNotUsedGrease(extensions),
      clientHelloHexStream: '',
    }),
    http2Settings: createHTTP2Settings({}),
  };

  if (!forceHttp1) {
    config.http2Settings = createHTTP2Settings({
      settings: getH2Settings(sentFrames),
      settingsAck: getH2SettingsAck(sentFrames),
      settingsOrder: getH2SettingsOrder(sentFrames),
      connectionFlow: getConnectionFlow(sentFrames),
      headersId: getHeadersId(sentFrames),
      headerPriority: getHeaderPriority(sentFrames),
      priorityFrames: getPriorityFrames(sentFrames),
    });
  }

  return config;
}

// Helper functions for fingerprint parsing
function getHeaderOrder(sentFrames: Array<Record<string, unknown>>): Nullable<string[]> {
  const headers = getHeadersFrameHeaders(sentFrames);
  const order = headers
    .map(parseHeaderLine)
    .filter((header): header is [string, string] => header !== null && !header[0].startsWith(':'))
    .map(([name]) => name);

  return order.length > 0 ? order : null;
}

function getPseudoHeaderOrder(sentFrames: Array<Record<string, unknown>>): PseudoHeaderName[] {
  const headers = getHeadersFrameHeaders(sentFrames);
  const order = headers
    .map(parseHeaderLine)
    .filter(
      (header): header is [PseudoHeaderName, string] =>
        header !== null && header[0].startsWith(':'),
    )
    .map(([name]) => name);

  return order.length > 0 ? order : [...defaultPseudoHeaderOrder];
}

function getSupportedSignatureAlgorithms(
  extensions: Array<Record<string, unknown>>,
): Nullable<string[]> {
  return getStringListFromExtension(extensions, 'signature_algorithms');
}

function getCertCompressionAlgo(extensions: Array<Record<string, unknown>>): Nullable<string[]> {
  const algorithms = extensions.flatMap((extension) => {
    if (!String(extension.name ?? '').includes('compress_certificate')) {
      return [];
    }
    return asStringArray(extension.algorithms).map((algorithm) =>
      algorithm.split('(', 1)[0].trim(),
    );
  });

  return algorithms.length > 0 ? algorithms : null;
}

function getRecordSizeLimit(extensions: Array<Record<string, unknown>>): Nullable<number> {
  const extension = extensions.find((item) =>
    String(item.name ?? '').includes('record_size_limit'),
  );
  if (!extension) {
    return null;
  }

  const value = String(extension.data ?? '');
  if (!value) {
    return null;
  }

  return /^[0-9]+$/.test(value) ? Number.parseInt(value, 10) : Number.parseInt(value, 16);
}

function getSupportedDelegatedCredentialsAlgorithms(
  extensions: Array<Record<string, unknown>>,
): Nullable<string[]> {
  return getStringListFromExtension(extensions, 'signature_hash_algorithms');
}

function getSupportedVersions(extensions: Array<Record<string, unknown>>): Nullable<string[]> {
  const versions = extensions.flatMap((extension) => {
    if (!String(extension.name ?? '').includes('supported_versions')) {
      return [];
    }
    return asStringArray(extension.versions).map((version) =>
      version.replace(/^TLS_/, '').replace(/^TLS /, '').split('(', 1)[0].trim(),
    );
  });

  return versions.length > 0 ? versions : null;
}

function getPskKeyExchangeModes(extensions: Array<Record<string, unknown>>): Nullable<string[]> {
  const modes = extensions.flatMap((extension) => {
    if (!String(extension.name ?? '').includes('psk_key_exchange_modes')) {
      return [];
    }
    const mode = String(extension.PSK_Key_Exchange_Mode ?? '');
    if (!mode) {
      return [];
    }
    return [mode.endsWith('(0)') ? 'PskModePlain' : 'PskModeDHE'];
  });

  return modes.length > 0 ? modes : null;
}

function getKeyShareCurves(extensions: Array<Record<string, unknown>>): Nullable<string[]> {
  const curves = extensions.flatMap((extension) => {
    if (!String(extension.name ?? '').includes('key_share')) {
      return [];
    }

    return asRecordArray(extension.shared_keys).map((sharedKey) => {
      const key = Object.keys(sharedKey)[0] ?? '';
      const normalized = key.replace(/^TLS_/, '').split('(', 1)[0].trim().replace('-', '');

      if (['GREASE', 'P256', 'P384', 'P521', 'X25519'].includes(normalized)) {
        return normalized;
      }

      const parenthesized = key.split('(').at(-1)?.replace(')', '').split(' ').at(-1) ?? normalized;
      return parenthesized.includes('0x')
        ? String(Number.parseInt(parenthesized, 16))
        : parenthesized;
    });
  });

  return curves.length > 0 ? curves : null;
}

function getNotUsedGrease(extensions: Array<Record<string, unknown>>): boolean {
  return !String(extensions[0]?.name ?? '').includes('TLS_GREASE');
}

function getH2Settings(
  sentFrames: Array<Record<string, unknown>>,
): Nullable<Record<string, number>> {
  const settingsFrame = sentFrames.find((frame) => frame.frame_type === 'SETTINGS');
  const settingsList = asStringArray(settingsFrame?.settings);
  if (settingsList.length === 0) {
    return null;
  }

  const settings: Record<string, number> = {};
  for (const setting of settingsList) {
    const [key, value] = setting.split('=', 2).map((part) => part.trim());
    if (key && value) {
      settings[key] = Number.parseInt(value, 10);
    }
  }

  return settings;
}

function getH2SettingsAck(sentFrames: Array<Record<string, unknown>>): boolean {
  return sentFrames.some(
    (frame) =>
      frame.frame_type === 'SETTINGS' &&
      asStringArray(frame.flags).some((flag) => flag.toUpperCase().includes('ACK')),
  );
}

function getH2SettingsOrder(
  sentFrames: Array<Record<string, unknown>>,
): Nullable<HTTP2SettingName[]> {
  const settings = getH2Settings(sentFrames);
  return settings ? (Object.keys(settings) as HTTP2SettingName[]) : null;
}

function getConnectionFlow(sentFrames: Array<Record<string, unknown>>): Nullable<number> {
  const frame = sentFrames.find((item) => item.frame_type === 'WINDOW_UPDATE');
  return typeof frame?.increment === 'number' ? frame.increment : null;
}

function getHeadersId(sentFrames: Array<Record<string, unknown>>): number {
  const frame = sentFrames.find((item) => item.frame_type === 'HEADERS');
  return typeof frame?.stream_id === 'number' ? frame.stream_id : 1;
}

function getHeaderPriority(
  sentFrames: Array<Record<string, unknown>>,
): Nullable<HeaderPriority> {
  const frame = sentFrames.find((item) => item.frame_type === 'HEADERS' && isRecord(item.priority));
  if (!(frame && isRecord(frame.priority))) {
    return null;
  }

  return priorityFromCapturedFrame(frame.priority);
}

function getPriorityFrames(
  sentFrames: Array<Record<string, unknown>>,
): Nullable<PriorityFrame[]> {
  const frames = sentFrames
    .filter((frame) => frame.frame_type === 'PRIORITY' && isRecord(frame.priority))
    .map((frame) => ({
      streamID: typeof frame.stream_id === 'number' ? frame.stream_id : 0,
      priorityParam: priorityFromCapturedFrame(frame.priority as Record<string, unknown>),
    }));

  return frames.length > 0 ? frames : null;
}

function priorityFromCapturedFrame(priority: Record<string, unknown>): HeaderPriority {
  return {
    weight: typeof priority.weight === 'number' ? priority.weight : 0,
    streamDep: typeof priority.depends_on === 'number' ? priority.depends_on : 0,
    exclusive: Boolean(priority.exclusive),
  };
}

function getStringListFromExtension(
  extensions: Array<Record<string, unknown>>,
  key: string,
): Nullable<string[]> {
  const values = extensions.flatMap((extension) => asStringArray(extension[key]));
  return values.length > 0 ? values : null;
}

function getHeadersFrameHeaders(sentFrames: Array<Record<string, unknown>>): string[] {
  const headersFrame = sentFrames.find((frame) => frame.frame_type === 'HEADERS');
  return asStringArray(headersFrame?.headers);
}

function parseHeaderLine(line: string): Nullable<[string, string]> {
  const separator = line.startsWith(':') ? line.indexOf(':', 1) : line.indexOf(':');
  if (separator === -1) {
    return null;
  }
  return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
