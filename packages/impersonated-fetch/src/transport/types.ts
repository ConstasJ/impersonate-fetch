import type { ImpersonationOptions } from '@/impersonation/types.js';

export type TransportBackendName = 'native';

export type TransportBody = string | Uint8Array | ArrayBuffer | ReadableStream<Uint8Array> | null;

export interface TransportCookie {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  expires?: Date | string;
  secure?: boolean;
  httpOnly?: boolean;
}

export interface TransportProxyOptions {
  http?: string;
  https?: string;
  all?: string;
}

export interface TransportRequest {
  url: string | URL;
  method?: string;
  headers?: Record<string, string>;
  body?: TransportBody;
  cookies?: Record<string, string> | TransportCookie[];
  proxy?: string | TransportProxyOptions;
  timeoutMs?: number;
  redirects?: boolean | number;
  signal?: AbortSignal;
  impersonation?: ImpersonationOptions;
  streamResponse?: boolean;
}

export interface TransportResponse {
  url: string;
  status: number;
  statusText?: string;
  headers: Record<string, string[]>;
  rawHeaders?: Array<[string, string]>;
  body: Uint8Array;
  bodyStream?: ReadableStream<Uint8Array>;
  cookies: TransportCookie[];
  protocol?: string;
  fingerprint?: Record<string, unknown>;
}

export interface TransportStream extends AsyncIterable<Uint8Array> {
  readonly url: string;
  readonly status: number;
  readonly statusText?: string;
  readonly headers: Record<string, string[]>;
  readonly rawHeaders?: Array<[string, string]>;
  readonly cookies: TransportCookie[];
  readonly protocol?: string;
  readonly fingerprint?: Record<string, unknown>;
  read(size?: number): Promise<Uint8Array | null>;
  close(): Promise<void>;
}

export interface TransportBackend {
  readonly name: TransportBackendName;
  request(request: TransportRequest): Promise<TransportResponse>;
  stream(request: TransportRequest): Promise<TransportStream>;
}
