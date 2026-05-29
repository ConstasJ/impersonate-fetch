import { type BodySource, FetchBody } from './body.js';
import { ValidationError } from './errors.js';
import type {
  HTTP2Settings,
  HTTP2SettingsPayload,
  ImpersonationOptions,
  TLSConfig,
  TLSConfigPayload,
} from './impersonation/types.js';
import { createRequestAbortController, raceAbort, throwIfAborted } from './timeout.js';
import { assertCapability, type TransportCapabilities } from './transport/capabilities.js';
import {
  createNativeTransportBackend,
  type NativeTransportBackendOptions,
} from './transport/native.js';
import type {
  TransportBackend,
  TransportProxyOptions,
  TransportRequest,
  TransportResponse,
  TransportStream,
} from './transport/types.js';

export type FetchInput = RequestInfo | URL;

export type ImpersonateInit =
  | string
  | (ImpersonationOptions & {
      http2?: Partial<HTTP2Settings | HTTP2SettingsPayload>;
      tls?: Partial<TLSConfig | TLSConfigPayload>;
    });

export interface NativeFetchOptions extends NativeTransportBackendOptions {
  readonly backend?: TransportBackend;
  readonly capabilities?: TransportCapabilities | false;
}

export interface FetchInit extends Omit<RequestInit, 'body'> {
  readonly body?: BodyInit | null;
  readonly headersOrder?: readonly string[];
  readonly http2?: Partial<HTTP2Settings | HTTP2SettingsPayload>;
  readonly impersonate?: ImpersonateInit;
  readonly native?: NativeFetchOptions;
  readonly proxy?: string | TransportProxyOptions;
  readonly timeout?: number;
  readonly timeoutMs?: number;
  readonly tls?: Partial<TLSConfig | TLSConfigPayload>;
}

export class FetchResponse extends FetchBody {
  readonly headers: Headers;
  readonly ok: boolean;
  readonly redirected = false;
  readonly status: number;
  readonly statusText: string;
  readonly type = 'basic';
  readonly url: string;
  readonly rawHeaders?: Array<[string, string]>;
  readonly cookies: TransportResponse['cookies'];
  readonly protocol?: string;
  readonly fingerprint?: Record<string, unknown>;

  constructor(response: TransportResponse, cleanup?: () => void, signal?: AbortSignal) {
    super(response.bodyStream ?? response.body, cleanup, signal);
    this.headers = transportHeadersToHeaders(response);
    this.ok = response.status >= 200 && response.status <= 299;
    this.status = response.status;
    this.statusText = response.statusText ?? '';
    this.url = response.url;
    this.rawHeaders = response.rawHeaders;
    this.cookies = response.cookies;
    this.protocol = response.protocol;
    this.fingerprint = response.fingerprint;
  }
}

const unsupportedBrowserFields = ['mode', 'cache', 'integrity', 'referrerPolicy'] as const;

export async function fetch(input: FetchInput, init: FetchInit = {}): Promise<FetchResponse> {
  rejectUnsupportedBrowserFields(init);

  const signal = init.signal ?? (isRequest(input) ? input.signal : undefined);
  const timeoutMs = init.timeoutMs ?? init.timeout;
  const abort = createRequestAbortController({ signal, timeoutMs });

  try {
    abort.throwIfAborted();
    const request = await normalizeRequest(input, init, abort.signal, abort.timeoutMs);
    const { backend, capabilities, ...nativeOptions } = init.native ?? {};

    if (capabilities !== false) {
      const { signal: _signal, ...capabilityRequest } = request;
      assertCapability(capabilityRequest, capabilities ? { capabilities } : undefined);
    }

    const transport = backend ?? createNativeTransportBackend(nativeOptions);
    const stream = await raceAbort(
      transport.stream({ ...request, streamResponse: true }),
      abort.signal,
    );
    return new FetchResponse(
      streamToResponse(stream),
      () => abort.cleanup(),
      signal ?? abort.signal,
    );
  } catch (error) {
    abort.cleanup();
    throw error;
  }
}

async function normalizeRequest(
  input: FetchInput,
  init: FetchInit,
  signal: AbortSignal,
  timeoutMs: number | undefined,
): Promise<TransportRequest> {
  const requestInput = isRequest(input) ? input : undefined;
  const method = init.method ?? requestInput?.method ?? 'GET';
  validateMethod(method);
  const bodyProvided = hasOwn(init, 'body');
  const body = bodyProvided
    ? await bodyInitToTransportBody(init.body, signal)
    : await requestBodyToTransportBody(requestInput, signal);

  if (body !== undefined && body !== null && /^(GET|HEAD)$/i.test(method)) {
    throw new TypeError('Request with GET or HEAD method cannot have a body');
  }

  return {
    url: requestInput?.url ?? String(input),
    method,
    headers: normalizeHeaders(init.headers ?? requestInput?.headers).headers,
    body,
    proxy: init.proxy,
    timeoutMs,
    redirects: normalizeRedirect(init.redirect ?? requestInput?.redirect),
    signal,
    impersonation: normalizeImpersonation(init),
  };
}

function normalizeHeaders(headers: HeadersInit | undefined): {
  headers: Record<string, string>;
  order: string[];
} {
  const output: Record<string, string> = {};
  const order: string[] = [];

  const append = (name: string, value: string): void => {
    if (!order.includes(name)) {
      order.push(name);
    }
    output[name] = output[name] === undefined ? value : `${output[name]}, ${value}`;
  };

  if (headers === undefined) {
    return { headers: output, order };
  }
  if (headers instanceof Headers) {
    headers.forEach((value, name) => {
      append(name, value);
    });
    return { headers: output, order };
  }
  if (Array.isArray(headers)) {
    for (const [name, value] of headers) {
      append(String(name), String(value));
    }
    return { headers: output, order };
  }

  for (const [name, value] of Object.entries(headers)) {
    append(name, String(value));
  }
  return { headers: output, order };
}

function normalizeImpersonation(init: FetchInit): ImpersonationOptions | undefined {
  const extension = init.impersonate;
  const nested = typeof extension === 'object' && extension !== null ? extension : undefined;
  const impersonation: ImpersonationOptions =
    typeof extension === 'string' ? { preset: extension } : nested ? { ...nested } : {};

  const tls = init.tls ?? nested?.tls ?? impersonation.tlsConfig;
  const http2 = init.http2 ?? nested?.http2;
  if (tls !== undefined || http2 !== undefined) {
    const tlsConfig: Record<string, unknown> = isRecord(tls) ? { ...tls } : {};
    if (http2 !== undefined) {
      tlsConfig.http2Settings = http2;
    }
    impersonation.tlsConfig = tlsConfig as ImpersonationOptions['tlsConfig'];
  }
  if (init.headersOrder !== undefined) {
    impersonation.headersOrder = [...init.headersOrder];
  }

  return Object.keys(impersonation).length > 0 ? impersonation : undefined;
}

function normalizeRedirect(redirect: RequestRedirect | undefined): TransportRequest['redirects'] {
  if (redirect === undefined || redirect === 'follow') {
    return undefined;
  }
  if (redirect === 'manual' || redirect === 'error') {
    return false;
  }
  return undefined;
}

async function requestBodyToTransportBody(
  request: Request | undefined,
  signal: AbortSignal,
): Promise<TransportRequest['body'] | undefined> {
  if (!request || request.body === null) {
    return undefined;
  }
  if (request.bodyUsed) {
    throw new ValidationError('Request body has already been consumed', { field: 'body' });
  }
  return raceAbort(request.arrayBuffer(), signal);
}

async function bodyInitToTransportBody(
  body: BodyInit | null | undefined,
  signal: AbortSignal,
): Promise<TransportRequest['body'] | undefined> {
  throwIfAborted(signal);
  if (body === undefined || body === null) {
    return undefined;
  }
  if (typeof body === 'string') {
    return body;
  }
  if (body instanceof Uint8Array) {
    return copyBytes(body);
  }
  if (body instanceof ArrayBuffer) {
    return body.slice(0);
  }
  if (ArrayBuffer.isView(body)) {
    return copyBytes(new Uint8Array(body.buffer, body.byteOffset, body.byteLength));
  }
  if (body instanceof URLSearchParams) {
    return body.toString();
  }
  if (body instanceof Blob) {
    return raceAbort(body.arrayBuffer(), signal);
  }
  if (body instanceof ReadableStream) {
    return readRequestStream(body as ReadableStream<Uint8Array>, signal);
  }
  if (body instanceof FormData && typeof globalThis.Response !== 'undefined') {
    return new Uint8Array(await raceAbort(new globalThis.Response(body).arrayBuffer(), signal));
  }

  throw new TypeError('Unsupported request body type');
}

function streamToResponse(stream: TransportStream): TransportResponse {
  return {
    url: stream.url,
    status: stream.status,
    statusText: stream.statusText,
    headers: stream.headers,
    rawHeaders: stream.rawHeaders,
    body: new Uint8Array(),
    bodyStream: new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const chunk = await stream.read();
          if (chunk === null) {
            await stream.close();
            controller.close();
            return;
          }
          controller.enqueue(chunk);
        } catch (error) {
          await stream.close().catch(() => undefined);
          controller.error(error);
        }
      },
      async cancel() {
        await stream.close();
      },
    }),
    cookies: stream.cookies,
    protocol: stream.protocol,
    fingerprint: stream.fingerprint,
  };
}

async function readRequestStream(
  stream: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): Promise<Uint8Array> {
  if (stream.locked) {
    throw new ValidationError('Request body stream has already been consumed', { field: 'body' });
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      throwIfAborted(signal);
      const { done, value } = await raceAbort(reader.read(), signal);
      if (done) {
        return concatBytes(chunks, total);
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } catch (error) {
    await reader.cancel(error).catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

function concatBytes(chunks: Uint8Array[], total: number): Uint8Array {
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function transportHeadersToHeaders(response: TransportResponse): Headers {
  const headers = new Headers();
  const rawHeaders =
    response.rawHeaders && response.rawHeaders.length > 0
      ? response.rawHeaders
      : Object.entries(response.headers).flatMap(([name, values]) =>
          values.map((value) => [name, value] as [string, string]),
        );

  for (const [name, value] of rawHeaders) {
    headers.append(name, value);
  }
  return headers;
}

function rejectUnsupportedBrowserFields(init: FetchInit): void {
  for (const field of unsupportedBrowserFields) {
    if (hasOwn(init, field) && init[field] !== undefined) {
      throw new TypeError(
        `RequestInit.${field} is not supported; impersonated-fetch does not emulate browser security or cache policy`,
      );
    }
  }
}

function validateMethod(method: string): void {
  if (method.trim() === '') {
    throw new ValidationError('method must not be empty', { field: 'method' });
  }
}

function isRequest(input: FetchInput): input is Request {
  return typeof Request !== 'undefined' && input instanceof Request;
}

function hasOwn<T extends object>(value: T, key: PropertyKey): boolean {
  return Object.hasOwn(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  const output = new Uint8Array(bytes.byteLength);
  output.set(bytes);
  return output;
}

export type { BodySource };
