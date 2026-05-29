// Type definitions for impersonation module

export type Nullable<T> = T | null;

export type HTTP2SettingName =
  | 'HEADER_TABLE_SIZE'
  | 'ENABLE_PUSH'
  | 'MAX_CONCURRENT_STREAMS'
  | 'INITIAL_WINDOW_SIZE'
  | 'MAX_FRAME_SIZE'
  | 'MAX_HEADER_LIST_SIZE'
  | 'UNKNOWN_SETTING_8'
  | 'NO_RFC7540_PRIORITIES'
  | (string & {});

export type PseudoHeaderName = ':method' | ':authority' | ':scheme' | ':path' | (string & {});

export interface HeaderPriority {
  weight: number;
  streamDep: number;
  exclusive: boolean;
}

export interface PriorityFrame {
  streamID: number;
  priorityParam: HeaderPriority;
}

export interface HTTP2Settings {
  settings: Nullable<Record<string, number>>;
  settingsAck: boolean;
  settingsOrder: Nullable<HTTP2SettingName[]>;
  connectionFlow: Nullable<number>;
  headersId: number;
  headerPriority: Nullable<HeaderPriority>;
  priorityFrames: Nullable<PriorityFrame[]>;
}

export interface HTTP2SettingsPayload {
  settings: Nullable<Record<string, number>>;
  settings_ack: boolean;
  settings_order: Nullable<HTTP2SettingName[]>;
  connection_flow: Nullable<number>;
  headers_id: number;
  header_priority: Nullable<HeaderPriority>;
  priority_frames: Nullable<PriorityFrame[]>;
}

export interface TLSExtensions {
  supportedSignatureAlgorithms: Nullable<string[]>;
  certCompressionAlgo: Nullable<string[]>;
  recordSizeLimit: Nullable<number>;
  supportedDelegatedCredentialsAlgorithms: Nullable<string[]>;
  supportedVersions: Nullable<string[]>;
  pskKeyExchangeModes: Nullable<string[]>;
  signatureAlgorithmsCert: Nullable<string[]>;
  keyShareCurves: Nullable<string[]>;
  notUsedGrease: boolean;
  clientHelloHexStream: string;
}

export interface TLSExtensionsPayload {
  supported_signature_algorithms: Nullable<string[]>;
  cert_compression_algo: Nullable<string[]>;
  record_size_limit: Nullable<number>;
  supported_delegated_credentials_algorithms: Nullable<string[]>;
  supported_versions: Nullable<string[]>;
  psk_key_exchange_modes: Nullable<string[]>;
  signature_algorithms_cert: Nullable<string[]>;
  key_share_curves: Nullable<string[]>;
  not_used_grease: boolean;
  client_hello_hex_stream: string;
}

export interface HeaderOrderControls {
  headersOrder: Nullable<string[]>;
  pseudoHeaderOrder: PseudoHeaderName[];
  unChangedHeaderKey: Nullable<string[]>;
}

export interface TLSConfig extends HeaderOrderControls {
  id: string;
  ja3: Nullable<string>;
  randomJa3: boolean;
  forceHttp1: boolean;
  tlsExtensions: TLSExtensions;
  http2Settings: HTTP2Settings;
  userAgent: string;
}

export interface TLSConfigPayload {
  id: string;
  ja3: Nullable<string>;
  random_ja3: boolean;
  headers_order: Nullable<string[]>;
  un_changed_header_key: Nullable<string[]>;
  force_http1: boolean;
  pseudo_header_order: PseudoHeaderName[];
  tls_extensions: TLSExtensionsPayload;
  http2_settings: HTTP2SettingsPayload;
  user_agent: string;
}

export interface ImpersonationOptions extends Partial<HeaderOrderControls> {
  tlsConfig?: TLSConfig | Partial<TLSConfigPayload>;
  preset?: string;
  ja3?: string;
  randomJa3?: boolean;
  forceHttp1?: boolean;
  clientHelloHexStream?: string;
}

export interface OrderedHeaderMetadata {
  headers: Record<string, string>;
  headersOrder: Nullable<string[]>;
  unChangedHeaderKey: Nullable<string[]>;
}

export interface BrowserFingerprintPayload {
  http_version?: string;
  user_agent?: string;
  tls?: {
    ja3?: string;
    extensions?: Array<Record<string, unknown>>;
  };
  http2?: {
    sent_frames?: Array<Record<string, unknown>>;
  };
}

// Default values (these are data, not logic)
export const defaultPseudoHeaderOrder: PseudoHeaderName[] = [
  ':method',
  ':authority',
  ':scheme',
  ':path',
];

export const defaultTLSExtensions: TLSExtensions = {
  supportedSignatureAlgorithms: [
    'ECDSAWithP256AndSHA256',
    'PSSWithSHA256',
    'PKCS1WithSHA256',
    'ECDSAWithP384AndSHA384',
    'PSSWithSHA384',
    'PKCS1WithSHA384',
    'PSSWithSHA512',
    'PKCS1WithSHA512',
  ],
  certCompressionAlgo: ['brotli'],
  recordSizeLimit: 4001,
  supportedDelegatedCredentialsAlgorithms: [
    'ECDSAWithP256AndSHA256',
    'ECDSAWithP384AndSHA384',
    'ECDSAWithP521AndSHA512',
    'ECDSAWithSHA1',
  ],
  supportedVersions: ['1.3', '1.2'],
  pskKeyExchangeModes: ['PskModeDHE'],
  signatureAlgorithmsCert: [
    'ECDSAWithP256AndSHA256',
    'ECDSAWithP384AndSHA384',
    'ECDSAWithP521AndSHA512',
    'PSSWithSHA256',
    'PSSWithSHA384',
    'PSSWithSHA512',
    'PKCS1WithSHA256',
    'PKCS1WithSHA384',
    'PKCS1WithSHA512',
    'ECDSAWithSHA1',
    'PKCS1WithSHA1',
  ],
  keyShareCurves: ['GREASE', 'X25519'],
  notUsedGrease: false,
  clientHelloHexStream: '',
};

export const defaultHTTP2Settings: HTTP2Settings = {
  settings: {
    HEADER_TABLE_SIZE: 65536,
    MAX_CONCURRENT_STREAMS: 1000,
    INITIAL_WINDOW_SIZE: 6291456,
    MAX_HEADER_LIST_SIZE: 262144,
  },
  settingsAck: false,
  settingsOrder: [
    'HEADER_TABLE_SIZE',
    'MAX_CONCURRENT_STREAMS',
    'INITIAL_WINDOW_SIZE',
    'MAX_HEADER_LIST_SIZE',
  ],
  connectionFlow: 15663105,
  headersId: 1,
  headerPriority: {
    streamDep: 0,
    exclusive: true,
    weight: 256,
  },
  priorityFrames: null,
};
