import { UnsupportedCapabilityError } from '@/errors.js';
import { nativeAbiSymbolNames } from '@/native/abi.js';
import {
  getNativeAssetInfo,
  type NativeArchitecture,
  type NativePlatform,
} from '@/native/assets.js';
import type { TransportBackendName, TransportRequest } from './types.js';

export const capabilityNames = [
  'platform',
  'nativeBinary',
  'http1_1',
  'http2',
  'ja3',
  'ja4',
  'browserPresets',
  'customClientHello',
  'customHttp2Settings',
  'orderedHeaders',
  'proxy',
  'cookies',
  'streamingUpload',
  'streamingResponse',
  'redirects',
  'abortSignal',
] as const;

export type CapabilityName = (typeof capabilityNames)[number];
export type CapabilityFlags = Record<CapabilityName, boolean>;

export interface TransportCapabilities extends CapabilityFlags {
  backend: TransportBackendName;
  platformName: string;
  arch: string;
  nativeAssetPath?: string;
  nativeAssetFilename?: string;
  nativeAbiSymbols: readonly string[];
}

export interface GetCapabilitiesOptions {
  backend?: TransportBackendName;
  platform?: NativePlatform;
  arch?: NativeArchitecture;
  root?: string;
  sourceBuilt?: boolean;
  backendPackages?: boolean;
}

export interface AssertCapabilityOptions extends GetCapabilitiesOptions {
  capabilities?: TransportCapabilities;
}

export function getCapabilities(options: GetCapabilitiesOptions = {}): TransportCapabilities {
  const backend = options.backend ?? 'native';
  const platformName = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const symbols = nativeAbiSymbolNames;

  if (backend !== 'native') {
    return unsupportedCapabilities(backend, platformName, arch, symbols);
  }

  try {
    const asset = getNativeAssetInfo(platformName, arch, {
      root: options.root,
      sourceBuilt: options.sourceBuilt,
      backendPackages: options.backendPackages,
    });
    const hasRequest = symbols.includes('request');
    const hasStreaming =
      symbols.includes('stream_request') &&
      symbols.includes('stream_read') &&
      symbols.includes('stream_close');
    const hasNativeBinary = Boolean(asset.path && asset.filename);
    const requestBacked = hasNativeBinary && hasRequest;

    return {
      backend,
      platformName: asset.platform,
      arch: asset.arch,
      nativeAssetPath: asset.path,
      nativeAssetFilename: asset.filename,
      nativeAbiSymbols: symbols,
      platform: true,
      nativeBinary: hasNativeBinary,
      http1_1: requestBacked,
      http2: requestBacked,
      ja3: requestBacked,
      ja4: false,
      browserPresets: requestBacked,
      customClientHello: requestBacked,
      customHttp2Settings: requestBacked,
      orderedHeaders: requestBacked,
      proxy: requestBacked,
      cookies: requestBacked,
      streamingUpload: false,
      streamingResponse: hasNativeBinary && hasStreaming,
      redirects: requestBacked,
      abortSignal: false,
    };
  } catch {
    return unsupportedCapabilities(backend, platformName, arch, symbols);
  }
}

export function assertCapability(
  requestOrCapability: TransportRequest | CapabilityName,
  options: AssertCapabilityOptions = {},
): void {
  const capabilities = options.capabilities ?? getCapabilities(options);
  const requestedCapabilities =
    typeof requestOrCapability === 'string'
      ? [{ capability: requestOrCapability, requestedOption: requestOrCapability }]
      : getRequestedCapabilities(requestOrCapability);

  for (const requested of requestedCapabilities) {
    if (!capabilities[requested.capability]) {
      throw new UnsupportedCapabilityError({
        backend: capabilities.backend,
        capability: requested.capability,
        platform: `${capabilities.platformName}/${capabilities.arch}`,
        requestedOption: requested.requestedOption,
      });
    }
  }
}

function getRequestedCapabilities(request: TransportRequest): Array<{
  capability: CapabilityName;
  requestedOption: string;
}> {
  const requested: Array<{ capability: CapabilityName; requestedOption: string }> = [
    { capability: 'platform', requestedOption: 'platform' },
    { capability: 'nativeBinary', requestedOption: 'nativeBinary' },
  ];
  const impersonation = request.impersonation;
  const tlsConfig: Record<string, unknown> | undefined = isRecord(impersonation?.tlsConfig)
    ? (impersonation.tlsConfig as Record<string, unknown>)
    : undefined;
  const tlsExtensions =
    tlsConfig && isRecord(tlsConfig.tls_extensions) ? tlsConfig.tls_extensions : undefined;
  const camelTlsExtensions =
    tlsConfig && isRecord(tlsConfig.tlsExtensions) ? tlsConfig.tlsExtensions : undefined;
  const http2Settings = Boolean(
    tlsConfig && (isRecord(tlsConfig.http2_settings) || isRecord(tlsConfig.http2Settings)),
  );

  if (impersonation) {
    requested.push({ capability: 'ja3', requestedOption: 'impersonation' });
  }
  if (impersonation?.preset) {
    requested.push({ capability: 'browserPresets', requestedOption: 'impersonation.preset' });
  }
  if (impersonation?.ja3 || impersonation?.randomJa3 || typeof tlsConfig?.ja3 === 'string') {
    requested.push({ capability: 'ja3', requestedOption: 'impersonation.ja3' });
  }
  if (
    impersonation?.clientHelloHexStream ||
    typeof tlsExtensions?.client_hello_hex_stream === 'string' ||
    typeof camelTlsExtensions?.clientHelloHexStream === 'string'
  ) {
    requested.push({
      capability: 'customClientHello',
      requestedOption: 'impersonation.clientHelloHexStream',
    });
  }
  if (http2Settings) {
    requested.push({
      capability: 'customHttp2Settings',
      requestedOption: 'impersonation.http2Settings',
    });
  }
  if (
    impersonation?.headersOrder ||
    impersonation?.pseudoHeaderOrder ||
    impersonation?.unChangedHeaderKey
  ) {
    requested.push({ capability: 'orderedHeaders', requestedOption: 'impersonation.headerOrder' });
  }
  if (
    tlsConfig &&
    (tlsConfig.headers_order ||
      tlsConfig.headersOrder ||
      tlsConfig.pseudo_header_order ||
      tlsConfig.pseudoHeaderOrder ||
      tlsConfig.un_changed_header_key ||
      tlsConfig.unChangedHeaderKey)
  ) {
    requested.push({
      capability: 'orderedHeaders',
      requestedOption: 'impersonation.tlsConfig.headerOrder',
    });
  }
  if (request.proxy) {
    requested.push({ capability: 'proxy', requestedOption: 'proxy' });
  }
  if (request.cookies) {
    requested.push({ capability: 'cookies', requestedOption: 'cookies' });
  }
  if (isStreamingBody(request.body)) {
    requested.push({ capability: 'streamingUpload', requestedOption: 'body' });
  }
  if (request.streamResponse) {
    requested.push({ capability: 'streamingResponse', requestedOption: 'streamResponse' });
  }
  if (request.redirects !== undefined) {
    requested.push({ capability: 'redirects', requestedOption: 'redirects' });
  }
  if (request.signal) {
    requested.push({ capability: 'abortSignal', requestedOption: 'signal' });
  }

  return requested;
}

function unsupportedCapabilities(
  backend: TransportBackendName,
  platformName: string,
  arch: string,
  symbols: readonly string[],
): TransportCapabilities {
  return {
    backend,
    platformName,
    arch,
    nativeAbiSymbols: symbols,
    platform: false,
    nativeBinary: false,
    http1_1: false,
    http2: false,
    ja3: false,
    ja4: false,
    browserPresets: false,
    customClientHello: false,
    customHttp2Settings: false,
    orderedHeaders: false,
    proxy: false,
    cookies: false,
    streamingUpload: false,
    streamingResponse: false,
    redirects: false,
    abortSignal: false,
  };
}

function isStreamingBody(body: TransportRequest['body']): body is ReadableStream<Uint8Array> {
  return typeof ReadableStream !== 'undefined' && body instanceof ReadableStream;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
