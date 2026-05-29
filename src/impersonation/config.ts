// TLS Config creation and cloning utilities

import { randomizeJa3 } from './fingerprint.js';
import type {
  HeaderPriority,
  HTTP2Settings,
  PriorityFrame,
  TLSConfig,
  TLSExtensions,
} from './types.js';
import { defaultHTTP2Settings, defaultPseudoHeaderOrder, defaultTLSExtensions } from './types.js';

type Nullable<T> = T | null;

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

function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? '00000000-0000-4000-8000-000000000000';
}

export function createTLSExtensions(overrides: Partial<TLSExtensions> = {}): TLSExtensions {
  return {
    supportedSignatureAlgorithms: cloneNullableArray(
      overrides.supportedSignatureAlgorithms === undefined
        ? defaultTLSExtensions.supportedSignatureAlgorithms
        : overrides.supportedSignatureAlgorithms,
    ),
    certCompressionAlgo: cloneNullableArray(
      overrides.certCompressionAlgo === undefined
        ? defaultTLSExtensions.certCompressionAlgo
        : overrides.certCompressionAlgo,
    ),
    recordSizeLimit:
      overrides.recordSizeLimit === undefined
        ? defaultTLSExtensions.recordSizeLimit
        : overrides.recordSizeLimit,
    supportedDelegatedCredentialsAlgorithms: cloneNullableArray(
      overrides.supportedDelegatedCredentialsAlgorithms === undefined
        ? defaultTLSExtensions.supportedDelegatedCredentialsAlgorithms
        : overrides.supportedDelegatedCredentialsAlgorithms,
    ),
    supportedVersions: cloneNullableArray(
      overrides.supportedVersions === undefined
        ? defaultTLSExtensions.supportedVersions
        : overrides.supportedVersions,
    ),
    pskKeyExchangeModes: cloneNullableArray(
      overrides.pskKeyExchangeModes === undefined
        ? defaultTLSExtensions.pskKeyExchangeModes
        : overrides.pskKeyExchangeModes,
    ),
    signatureAlgorithmsCert: cloneNullableArray(
      overrides.signatureAlgorithmsCert === undefined
        ? defaultTLSExtensions.signatureAlgorithmsCert
        : overrides.signatureAlgorithmsCert,
    ),
    keyShareCurves: cloneNullableArray(
      overrides.keyShareCurves === undefined
        ? defaultTLSExtensions.keyShareCurves
        : overrides.keyShareCurves,
    ),
    notUsedGrease: overrides.notUsedGrease ?? defaultTLSExtensions.notUsedGrease,
    clientHelloHexStream:
      overrides.clientHelloHexStream ?? defaultTLSExtensions.clientHelloHexStream,
  };
}

export function createHTTP2Settings(overrides: Partial<HTTP2Settings> = {}): HTTP2Settings {
  return {
    settings: cloneNullableRecord(
      overrides.settings === undefined ? defaultHTTP2Settings.settings : overrides.settings,
    ),
    settingsAck: overrides.settingsAck ?? defaultHTTP2Settings.settingsAck,
    settingsOrder: cloneNullableArray(
      overrides.settingsOrder === undefined
        ? defaultHTTP2Settings.settingsOrder
        : overrides.settingsOrder,
    ),
    connectionFlow:
      overrides.connectionFlow === undefined
        ? defaultHTTP2Settings.connectionFlow
        : overrides.connectionFlow,
    headersId: overrides.headersId ?? defaultHTTP2Settings.headersId,
    headerPriority: cloneNullableHeaderPriority(
      overrides.headerPriority === undefined
        ? defaultHTTP2Settings.headerPriority
        : overrides.headerPriority,
    ),
    priorityFrames: cloneNullablePriorityFrames(
      overrides.priorityFrames === undefined
        ? defaultHTTP2Settings.priorityFrames
        : overrides.priorityFrames,
    ),
  };
}

export interface CreateTLSConfigOptions
  extends Omit<Partial<TLSConfig>, 'tlsExtensions' | 'http2Settings'> {
  tlsExtensions?: Partial<TLSExtensions>;
  http2Settings?: Partial<HTTP2Settings>;
  randomizeJa3?: boolean;
}

export function createTLSConfig(overrides: CreateTLSConfigOptions = {}): TLSConfig {
  const config: TLSConfig = {
    id: overrides.id ?? randomId(),
    ja3: overrides.ja3 ?? null,
    randomJa3: overrides.randomJa3 ?? false,
    headersOrder: cloneNullableArray(overrides.headersOrder ?? null),
    unChangedHeaderKey: cloneNullableArray(overrides.unChangedHeaderKey ?? null),
    forceHttp1: overrides.forceHttp1 ?? false,
    pseudoHeaderOrder: cloneArray(overrides.pseudoHeaderOrder ?? defaultPseudoHeaderOrder),
    tlsExtensions: createTLSExtensions(overrides.tlsExtensions),
    http2Settings: createHTTP2Settings(overrides.http2Settings),
    userAgent: overrides.userAgent ?? '',
  };

  // Apply JA3 randomization if requested
  if (overrides.randomizeJa3 && config.ja3) {
    config.ja3 = randomizeJa3(config.ja3);
  }

  return config;
}

export function cloneTLSConfig(config: TLSConfig): TLSConfig {
  return createTLSConfig(config);
}

export function createOrderedHeaderMetadata(
  headers: Record<string, string>,
  controls: Partial<Pick<TLSConfig, 'headersOrder' | 'unChangedHeaderKey'>> = {},
): {
  headers: Record<string, string>;
  headersOrder: Nullable<string[]>;
  unChangedHeaderKey: Nullable<string[]>;
} {
  return {
    headers: { ...headers },
    headersOrder: cloneNullableArray(controls.headersOrder ?? null),
    unChangedHeaderKey: cloneNullableArray(controls.unChangedHeaderKey ?? null),
  };
}
