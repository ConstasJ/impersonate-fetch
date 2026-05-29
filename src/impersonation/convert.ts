// Snake/Camel case conversion utilities for TLS config
import type {
  HTTP2Settings,
  HTTP2SettingsPayload,
  HeaderPriority,
  PriorityFrame,
  TLSConfig,
  TLSConfigPayload,
  TLSExtensions,
  TLSExtensionsPayload,
} from './types.js';

export type Nullable<T> = T | null;

function cloneArray<T>(items: readonly T[]): T[] {
  return [...items];
}

function cloneNullableArray<T>(items: Nullable<readonly T[] | undefined>): Nullable<T[]> {
  return items ? [...items] : null;
}

function cloneNullableRecord<T>(
  record: Nullable<Record<string, T> | undefined>,
): Nullable<Record<string, T>> {
  return record ? { ...record } : null;
}

function cloneNullableHeaderPriority(
  priority: Nullable<HeaderPriority | undefined>,
): Nullable<HeaderPriority> {
  return priority ? { ...priority } : null;
}

function cloneNullablePriorityFrames(
  frames: Nullable<readonly PriorityFrame[] | undefined>,
): Nullable<PriorityFrame[]> {
  return frames
    ? frames.map((frame) => ({
        streamID: frame.streamID,
        priorityParam: { ...frame.priorityParam },
      }))
    : null;
}

// Conversion from snake_case to camelCase
export function tlsExtensionsFromSnakeCase(payload: Partial<TLSExtensionsPayload>): TLSExtensions {
  return {
    supportedSignatureAlgorithms: cloneNullableArray(payload.supported_signature_algorithms),
    certCompressionAlgo: cloneNullableArray(payload.cert_compression_algo),
    recordSizeLimit: payload.record_size_limit ?? null,
    supportedDelegatedCredentialsAlgorithms: cloneNullableArray(
      payload.supported_delegated_credentials_algorithms,
    ),
    supportedVersions: cloneNullableArray(payload.supported_versions),
    pskKeyExchangeModes: cloneNullableArray(payload.psk_key_exchange_modes),
    signatureAlgorithmsCert: cloneNullableArray(payload.signature_algorithms_cert),
    keyShareCurves: cloneNullableArray(payload.key_share_curves),
    notUsedGrease: payload.not_used_grease ?? false,
    clientHelloHexStream: payload.client_hello_hex_stream ?? '',
  };
}

export function tlsExtensionsToSnakeCase(extensions: TLSExtensions): TLSExtensionsPayload {
  return {
    supported_signature_algorithms: cloneNullableArray(extensions.supportedSignatureAlgorithms),
    cert_compression_algo: cloneNullableArray(extensions.certCompressionAlgo),
    record_size_limit: extensions.recordSizeLimit,
    supported_delegated_credentials_algorithms: cloneNullableArray(
      extensions.supportedDelegatedCredentialsAlgorithms,
    ),
    supported_versions: cloneNullableArray(extensions.supportedVersions),
    psk_key_exchange_modes: cloneNullableArray(extensions.pskKeyExchangeModes),
    signature_algorithms_cert: cloneNullableArray(extensions.signatureAlgorithmsCert),
    key_share_curves: cloneNullableArray(extensions.keyShareCurves),
    not_used_grease: extensions.notUsedGrease,
    client_hello_hex_stream: extensions.clientHelloHexStream,
  };
}

export function http2SettingsFromSnakeCase(payload: Partial<HTTP2SettingsPayload>): HTTP2Settings {
  return {
    settings: cloneNullableRecord(payload.settings),
    settingsAck: payload.settings_ack ?? false,
    settingsOrder: cloneNullableArray(payload.settings_order),
    connectionFlow: payload.connection_flow ?? null,
    headersId: payload.headers_id ?? 1,
    headerPriority: cloneNullableHeaderPriority(payload.header_priority),
    priorityFrames: cloneNullablePriorityFrames(payload.priority_frames),
  };
}

export function http2SettingsToSnakeCase(settings: HTTP2Settings): HTTP2SettingsPayload {
  return {
    settings: cloneNullableRecord(settings.settings),
    settings_ack: settings.settingsAck,
    settings_order: cloneNullableArray(settings.settingsOrder),
    connection_flow: settings.connectionFlow,
    headers_id: settings.headersId,
    header_priority: cloneNullableHeaderPriority(settings.headerPriority),
    priority_frames: cloneNullablePriorityFrames(settings.priorityFrames),
  };
}

export function tlsConfigFromSnakeCase(payload: Partial<TLSConfigPayload>): TLSConfig {
  return {
    id: payload.id ?? randomId(),
    ja3: payload.ja3 ?? null,
    randomJa3: payload.random_ja3 ?? false,
    headersOrder: cloneNullableArray(payload.headers_order),
    unChangedHeaderKey: cloneNullableArray(payload.un_changed_header_key),
    forceHttp1: payload.force_http1 ?? false,
    pseudoHeaderOrder: payload.pseudo_header_order ?? [...defaultPseudoHeaderOrder],
    tlsExtensions: payload.tls_extensions
      ? tlsExtensionsFromSnakeCase(payload.tls_extensions)
      : createDefaultTLSExtensions(),
    http2Settings: payload.http2_settings
      ? http2SettingsFromSnakeCase(payload.http2_settings)
      : createDefaultHTTP2Settings(),
    userAgent: payload.user_agent ?? '',
  };
}

export function tlsConfigToSnakeCase(config: TLSConfig): TLSConfigPayload {
  return {
    id: config.id,
    ja3: config.ja3,
    random_ja3: config.randomJa3,
    headers_order: cloneNullableArray(config.headersOrder),
    un_changed_header_key: cloneNullableArray(config.unChangedHeaderKey),
    force_http1: config.forceHttp1,
    pseudo_header_order: cloneArray(config.pseudoHeaderOrder),
    tls_extensions: tlsExtensionsToSnakeCase(config.tlsExtensions),
    http2_settings: http2SettingsToSnakeCase(config.http2Settings),
    user_agent: config.userAgent,
  };
}

// Aliases for compatibility
export const fromPythonTLSConfig = tlsConfigFromSnakeCase;
export const toNativeTLSConfigPayload = tlsConfigToSnakeCase;

// Import from types.ts for defaults
import {
  defaultHTTP2Settings,
  defaultPseudoHeaderOrder,
  defaultTLSExtensions,
  type PseudoHeaderName,
} from './types.js';

function createDefaultTLSExtensions(): TLSExtensions {
  return {
    supportedSignatureAlgorithms: cloneNullableArray(defaultTLSExtensions.supportedSignatureAlgorithms),
    certCompressionAlgo: cloneNullableArray(defaultTLSExtensions.certCompressionAlgo),
    recordSizeLimit: defaultTLSExtensions.recordSizeLimit,
    supportedDelegatedCredentialsAlgorithms: cloneNullableArray(
      defaultTLSExtensions.supportedDelegatedCredentialsAlgorithms,
    ),
    supportedVersions: cloneNullableArray(defaultTLSExtensions.supportedVersions),
    pskKeyExchangeModes: cloneNullableArray(defaultTLSExtensions.pskKeyExchangeModes),
    signatureAlgorithmsCert: cloneNullableArray(defaultTLSExtensions.signatureAlgorithmsCert),
    keyShareCurves: cloneNullableArray(defaultTLSExtensions.keyShareCurves),
    notUsedGrease: defaultTLSExtensions.notUsedGrease,
    clientHelloHexStream: defaultTLSExtensions.clientHelloHexStream,
  };
}

function createDefaultHTTP2Settings(): HTTP2Settings {
  return {
    settings: cloneNullableRecord(defaultHTTP2Settings.settings),
    settingsAck: defaultHTTP2Settings.settingsAck,
    settingsOrder: cloneNullableArray(defaultHTTP2Settings.settingsOrder),
    connectionFlow: defaultHTTP2Settings.connectionFlow,
    headersId: defaultHTTP2Settings.headersId,
    headerPriority: cloneNullableHeaderPriority(defaultHTTP2Settings.headerPriority),
    priorityFrames: cloneNullablePriorityFrames(defaultHTTP2Settings.priorityFrames),
  };
}

function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? '00000000-0000-4000-8000-000000000000';
}
