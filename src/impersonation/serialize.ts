import { NativeTransportError } from '@/errors.js';
import type { NativeRequestPayload } from '@/native/abi.js';
import type { TransportRequest } from '@/transport/types.js';
import { createTLSConfig } from './config.js';
import { tlsConfigFromSnakeCase, tlsConfigToSnakeCase } from './convert.js';
import { randomizeJa3 } from './fingerprint.js';
import { browserPresets, getBrowserPreset, getTLSPreset, tlsPresets } from './presets.js';
import type { ImpersonationOptions, TLSConfig, TLSConfigPayload } from './types.js';

export interface SerializeImpersonationOptions {
  readonly random?: () => number;
  readonly stream?: boolean;
}

export class ImpersonationSerializationError extends NativeTransportError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ImpersonationSerializationError';
  }
}

export function serializeNativeRequest(
  request: TransportRequest,
  options: SerializeImpersonationOptions = {},
): NativeRequestPayload {
  if (request.signal) {
    throw new NativeTransportError('Native transport does not support AbortSignal yet');
  }

  if (isReadableStream(request.body)) {
    throw new NativeTransportError('Native transport does not support streaming upload bodies yet');
  }

  const headers = { ...(request.headers ?? {}) };
  rejectManualContentLength(headers);

  const method = (request.method ?? 'GET').toUpperCase();
  const url = String(request.url);
  const resolved = resolveImpersonation(request.impersonation, options.random);
  const tlsPayload = resolved.tlsConfig ? tlsConfigToSnakeCase(resolved.tlsConfig) : undefined;
  const body =
    request.body === undefined || request.body === null
      ? undefined
      : bytesToBase64(toBodyBytes(request.body));

  return omitUndefined({
    Id: resolved.tlsConfig?.id ?? '',
    Method: method,
    Url: url,
    Ja3: resolved.ja3,
    RandomJA3: resolved.randomJa3,
    Headers: Object.keys(headers).length > 0 ? headers : undefined,
    HeadersOrder: resolved.headersOrder ?? orderedHeaderNames(headers),
    UnChangedHeaderKey: resolved.unChangedHeaderKey ?? undefined,
    Cookies: request.cookies as NativeRequestPayload['Cookies'],
    Timeout: request.timeoutMs === undefined ? undefined : request.timeoutMs / 1000,
    AllowRedirects: request.redirects === undefined ? true : request.redirects !== false,
    Proxies: selectProxy(request.proxy, url),
    Verify: getNativeVerifyOption(request),
    Cert: getNativeCertOption(request),
    Body: body,
    ForceHTTP1: resolved.forceHttp1,
    PseudoHeaderOrder: resolved.pseudoHeaderOrder,
    TLSExtensions: tlsPayload ? JSON.stringify(tlsPayload.tls_extensions) : undefined,
    HTTP2Settings: tlsPayload ? JSON.stringify(tlsPayload.http2_settings) : undefined,
    Stream: options.stream ? (true as const) : undefined,
  });
}

export function serializeImpersonation(
  impersonation: ImpersonationOptions | undefined,
  random?: () => number,
): Pick<
  NativeRequestPayload,
  | 'Id'
  | 'Ja3'
  | 'RandomJA3'
  | 'HeadersOrder'
  | 'UnChangedHeaderKey'
  | 'ForceHTTP1'
  | 'PseudoHeaderOrder'
  | 'TLSExtensions'
  | 'HTTP2Settings'
> {
  const resolved = resolveImpersonation(impersonation, random);
  const tlsPayload = resolved.tlsConfig ? tlsConfigToSnakeCase(resolved.tlsConfig) : undefined;

  return omitUndefined({
    Id: resolved.tlsConfig?.id ?? '',
    Ja3: resolved.ja3,
    RandomJA3: resolved.randomJa3,
    HeadersOrder: resolved.headersOrder ?? undefined,
    UnChangedHeaderKey: resolved.unChangedHeaderKey ?? undefined,
    ForceHTTP1: resolved.forceHttp1,
    PseudoHeaderOrder: resolved.pseudoHeaderOrder,
    TLSExtensions: tlsPayload ? JSON.stringify(tlsPayload.tls_extensions) : undefined,
    HTTP2Settings: tlsPayload ? JSON.stringify(tlsPayload.http2_settings) : undefined,
  });
}

interface ResolvedImpersonation {
  tlsConfig?: TLSConfig;
  ja3: string | null;
  randomJa3: boolean;
  forceHttp1?: boolean;
  headersOrder: string[] | null;
  unChangedHeaderKey: string[] | null;
  pseudoHeaderOrder?: string[];
}

function resolveImpersonation(
  impersonation: ImpersonationOptions | undefined,
  random?: () => number,
): ResolvedImpersonation {
  validateImpersonationOptions(impersonation);

  const tlsConfig = resolveTlsConfig(impersonation);
  const explicitRandomJa3 = impersonation?.randomJa3;
  const randomJa3 = explicitRandomJa3 ?? tlsConfig?.randomJa3 ?? false;
  const explicitJa3 = impersonation?.ja3;
  const sourceJa3 = explicitJa3 ?? tlsConfig?.ja3 ?? null;
  const ja3 = sourceJa3 && randomJa3 && random ? randomizeJa3(sourceJa3, random) : sourceJa3;

  return {
    tlsConfig,
    ja3,
    randomJa3,
    forceHttp1: impersonation?.forceHttp1 ?? tlsConfig?.forceHttp1,
    headersOrder: cloneNullableArray(
      impersonation?.headersOrder ?? tlsConfig?.headersOrder ?? null,
    ),
    unChangedHeaderKey: cloneNullableArray(
      impersonation?.unChangedHeaderKey ?? tlsConfig?.unChangedHeaderKey ?? null,
    ),
    pseudoHeaderOrder: cloneArray(
      impersonation?.pseudoHeaderOrder ?? tlsConfig?.pseudoHeaderOrder ?? undefined,
    ),
  };
}

function resolveTlsConfig(impersonation: ImpersonationOptions | undefined): TLSConfig | undefined {
  const preset = impersonation?.preset ? resolvePreset(impersonation.preset) : undefined;
  const source = impersonation?.tlsConfig;
  let config = preset;

  if (source) {
    config = isSnakeTlsConfig(source)
      ? tlsConfigFromSnakeCase(source)
      : createTLSConfig(source as Partial<TLSConfig>);
  }

  if (!config && impersonation?.clientHelloHexStream) {
    config = tlsConfigFromSnakeCase({});
  }

  if (config && impersonation?.clientHelloHexStream) {
    config.tlsExtensions.clientHelloHexStream = impersonation.clientHelloHexStream;
  }

  return config;
}

function resolvePreset(name: string): TLSConfig {
  if (isBrowserPresetName(name)) {
    return getBrowserPreset(name);
  }
  if (isTLSPresetName(name)) {
    return getTLSPreset(name);
  }
  throw new ImpersonationSerializationError(`Unknown impersonation preset: ${name}`);
}

function validateImpersonationOptions(impersonation: ImpersonationOptions | undefined): void {
  if (!impersonation) return;
  validateKeys('impersonation', impersonation as Record<string, unknown>, [
    'tlsConfig',
    'preset',
    'ja3',
    'randomJa3',
    'forceHttp1',
    'clientHelloHexStream',
    'headersOrder',
    'pseudoHeaderOrder',
    'unChangedHeaderKey',
  ]);

  if (impersonation.tlsConfig && isRecord(impersonation.tlsConfig)) {
    validateTlsConfig(impersonation.tlsConfig as Record<string, unknown>);
  }
}

function validateTlsConfig(config: Record<string, unknown>): void {
  validateKeys('tlsConfig', config, [
    'id',
    'ja3',
    'randomJa3',
    'random_ja3',
    'headersOrder',
    'headers_order',
    'unChangedHeaderKey',
    'un_changed_header_key',
    'forceHttp1',
    'force_http1',
    'pseudoHeaderOrder',
    'pseudo_header_order',
    'tlsExtensions',
    'tls_extensions',
    'http2Settings',
    'http2_settings',
    'userAgent',
    'user_agent',
  ]);

  const tlsExtensions = config.tlsExtensions ?? config.tls_extensions;
  if (isRecord(tlsExtensions)) {
    validateKeys('tlsConfig.tlsExtensions', tlsExtensions, [
      'supportedSignatureAlgorithms',
      'supported_signature_algorithms',
      'certCompressionAlgo',
      'cert_compression_algo',
      'recordSizeLimit',
      'record_size_limit',
      'supportedDelegatedCredentialsAlgorithms',
      'supported_delegated_credentials_algorithms',
      'supportedVersions',
      'supported_versions',
      'pskKeyExchangeModes',
      'psk_key_exchange_modes',
      'signatureAlgorithmsCert',
      'signature_algorithms_cert',
      'keyShareCurves',
      'key_share_curves',
      'notUsedGrease',
      'not_used_grease',
      'clientHelloHexStream',
      'client_hello_hex_stream',
    ]);
  }

  const http2Settings = config.http2Settings ?? config.http2_settings;
  if (isRecord(http2Settings)) {
    validateKeys('tlsConfig.http2Settings', http2Settings, [
      'settings',
      'settingsAck',
      'settings_ack',
      'settingsOrder',
      'settings_order',
      'connectionFlow',
      'connection_flow',
      'headersId',
      'headers_id',
      'headerPriority',
      'header_priority',
      'priorityFrames',
      'priority_frames',
    ]);
  }
}

function validateKeys(context: string, record: Record<string, unknown>, allowed: string[]): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(record)) {
    if (!allowedSet.has(key)) {
      throw new ImpersonationSerializationError(`Unknown ${context} option: ${key}`);
    }
  }
}

function rejectManualContentLength(headers: Record<string, string>): void {
  for (const name of Object.keys(headers)) {
    if (name.toLowerCase() === 'content-length') {
      throw new ImpersonationSerializationError(
        'Manual content-length header is not supported; native transport computes it from the body',
      );
    }
  }
}

function selectProxy(proxy: TransportRequest['proxy'], url: string): string | undefined {
  if (!proxy) return undefined;
  if (typeof proxy === 'string') return proxy;
  const scheme = new URL(url).protocol.replace(':', '');
  return scheme === 'https' ? (proxy.https ?? proxy.all) : (proxy.http ?? proxy.all);
}

function toBodyBytes(body: string | Uint8Array | ArrayBuffer): Uint8Array {
  if (typeof body === 'string') return new TextEncoder().encode(body);
  if (body instanceof Uint8Array) return body;
  return new Uint8Array(body);
}

function orderedHeaderNames(headers: Record<string, string>): string[] | undefined {
  const names = Object.keys(headers).map((name) => name.toLowerCase());
  return names.length > 0 ? names : undefined;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function getNativeVerifyOption(request: TransportRequest): boolean | string | undefined {
  const value = (request as unknown as Record<string, unknown>).verify;
  return typeof value === 'boolean' || typeof value === 'string' ? value : undefined;
}

function getNativeCertOption(request: TransportRequest): string | string[] | undefined {
  const value = (request as unknown as Record<string, unknown>).cert;
  if (typeof value === 'string') return value;
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : undefined;
}

function omitUndefined<T extends Record<string, unknown>>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as T;
}

function isReadableStream(value: unknown): value is ReadableStream<Uint8Array> {
  return typeof ReadableStream !== 'undefined' && value instanceof ReadableStream;
}

function isSnakeTlsConfig(
  value: Partial<TLSConfig> | Partial<TLSConfigPayload>,
): value is Partial<TLSConfigPayload> {
  return 'random_ja3' in value || 'tls_extensions' in value || 'http2_settings' in value;
}

function isBrowserPresetName(name: string): name is keyof typeof browserPresets {
  return name in browserPresets;
}

function isTLSPresetName(name: string): name is keyof typeof tlsPresets {
  return name in tlsPresets;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneArray<T>(value: T[] | undefined): T[] | undefined {
  return value ? [...value] : undefined;
}

function cloneNullableArray<T>(value: T[] | null): T[] | null {
  return value ? [...value] : null;
}
