import { NativeTransportError } from '../errors.js';
import { serializeNativeRequest } from '../impersonation/serialize.js';
import type {
  NativeCookiePayload,
  NativeRequestPayload,
  NativeResponsePayload,
  NativeStreamOpenPayload,
} from '../native/abi.js';
import { NativeFfiClient } from '../native/ffi.js';
import {
  createRequestAbortController,
  type RequestAbortController,
  raceAbort,
  throwIfAborted,
} from '../timeout.js';
import type {
  TransportBackend,
  TransportCookie,
  TransportRequest,
  TransportResponse,
  TransportStream,
} from './types.js';

const defaultReadSize = 64 * 1024;

export interface NativeTransportBackendOptions {
  readonly ffi?: NativeFfiClient;
}

export class NativeTransportBackend implements TransportBackend {
  readonly name = 'native' as const;
  private readonly ffi: NativeFfiClient;

  constructor(options: NativeTransportBackendOptions = {}) {
    this.ffi = options.ffi ?? new NativeFfiClient();
  }

  async request(request: TransportRequest): Promise<TransportResponse> {
    const abort = createRequestAbortController({
      signal: request.signal,
      timeoutMs: request.timeoutMs,
    });
    let pendingResponse: Promise<NativeResponsePayload> | undefined;

    try {
      abort.throwIfAborted();
      const payload = await toNativeRequestPayload(
        { ...request, signal: undefined, timeoutMs: abort.timeoutMs },
        false,
      );
      pendingResponse = this.ffi.request(payload);
      const response = await raceAbort(pendingResponse, abort.signal);

      try {
        return toTransportResponse(response);
      } finally {
        if (response.id) {
          await this.ffi.free(response.id);
        }
      }
    } catch (error) {
      if (pendingResponse && abort.signal.aborted) {
        pendingResponse
          .then((response) => {
            if (response.id) {
              return this.ffi.free(response.id);
            }
            return undefined;
          })
          .catch(() => undefined);
      }
      throw error;
    } finally {
      abort.cleanup();
    }
  }

  async stream(request: TransportRequest): Promise<TransportStream> {
    const abort = createRequestAbortController({
      signal: request.signal,
      timeoutMs: request.timeoutMs,
    });
    let pendingOpen: Promise<NativeStreamOpenPayload> | undefined;

    try {
      abort.throwIfAborted();
      const payload = await toNativeRequestPayload(
        { ...request, signal: undefined, timeoutMs: abort.timeoutMs, streamResponse: true },
        true,
      );
      pendingOpen = this.ffi.streamRequest(payload);
      const response = await raceAbort(pendingOpen, abort.signal);

      return new NativeTransportStream(this.ffi, response, abort);
    } catch (error) {
      if (pendingOpen && abort.signal.aborted) {
        pendingOpen
          .then((response) => this.ffi.streamClose(response.stream_id))
          .catch(() => undefined);
      }
      abort.cleanup();
      throw error;
    }
  }
}

export function createNativeTransportBackend(
  options: NativeTransportBackendOptions = {},
): NativeTransportBackend {
  return new NativeTransportBackend(options);
}

export async function toNativeRequestPayload(
  request: TransportRequest,
  stream: boolean = Boolean(request.streamResponse),
): Promise<NativeRequestPayload> {
  return serializeNativeRequest({ ...request, signal: undefined }, { stream });
}

export function toTransportResponse(response: NativeResponsePayload): TransportResponse {
  const body = base64ToBytes(response.content ?? '');
  const rawHeaders = rawHeaderList(response);
  const metadata = responseMetadata(response.raw);

  return {
    url: response.url,
    status: response.status_code,
    statusText: metadata.statusText,
    headers: normalizeHeaders(response.headers),
    rawHeaders,
    body,
    cookies: nativeCookiesToTransport(response.cookies, rawHeaders),
    protocol: metadata.protocol,
    fingerprint: metadata.fingerprint,
  };
}

class NativeTransportStream implements TransportStream {
  readonly url: string;
  readonly status: number;
  readonly headers: Record<string, string[]>;
  readonly rawHeaders: Array<[string, string]>;
  readonly cookies: TransportCookie[];
  readonly protocol?: string;
  readonly fingerprint?: Record<string, unknown>;
  private closed = false;
  private pendingRead: Promise<Uint8Array | null> = Promise.resolve(null);
  private readonly abortListener: () => void;

  constructor(
    private readonly ffi: NativeFfiClient,
    private readonly open: NativeStreamOpenPayload,
    private readonly abort: RequestAbortController,
  ) {
    this.url = open.url;
    this.status = open.status_code;
    this.headers = normalizeHeaders(open.headers);
    this.rawHeaders = rawHeaderList(open);
    this.cookies = nativeCookiesToTransport(open.cookies, this.rawHeaders);
    this.abortListener = () => {
      void this.close().catch(() => undefined);
    };
    this.abort.signal.addEventListener('abort', this.abortListener, { once: true });
  }

  async read(size: number = defaultReadSize): Promise<Uint8Array | null> {
    if (this.closed) {
      return null;
    }
    throwIfAborted(this.abort.signal);

    this.pendingRead = this.pendingRead.then(async () => {
      try {
        const chunk = await raceAbort(
          this.ffi.streamRead(this.open.stream_id, size),
          this.abort.signal,
        );
        if (chunk.eof) {
          await this.close();
          return null;
        }
        return chunk.data ? base64ToBytes(chunk.data) : new Uint8Array();
      } catch (error) {
        await this.close();
        throw error;
      }
    });

    return this.pendingRead;
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.abort.signal.removeEventListener('abort', this.abortListener);
    this.abort.cleanup();
    await this.ffi.streamClose(this.open.stream_id);
  }

  async *[Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
    try {
      for (;;) {
        const chunk = await this.read();
        if (chunk === null) {
          return;
        }
        if (chunk.byteLength > 0) {
          yield chunk;
        }
      }
    } finally {
      await this.close();
    }
  }
}

function normalizeHeaders(headers: Record<string, string[]> | undefined): Record<string, string[]> {
  const normalized: Record<string, string[]> = {};
  for (const [name, values] of Object.entries(headers ?? {})) {
    normalized[name.toLowerCase()] = Array.isArray(values) ? [...values] : [String(values)];
  }
  return normalized;
}

function rawHeaderList(
  response: Pick<NativeResponsePayload | NativeStreamOpenPayload, 'headers'>,
): Array<[string, string]> {
  return Object.entries(response.headers ?? {}).flatMap(([name, values]) =>
    (Array.isArray(values) ? values : [String(values)]).map(
      (value) => [name, value] as [string, string],
    ),
  );
}

function nativeCookiesToTransport(
  cookies: NativeCookiePayload[] | undefined,
  rawHeaders: Array<[string, string]>,
): TransportCookie[] {
  const nativeCookies = (cookies ?? []).map((cookie) => ({
    name: cookie.Name,
    value: cookie.Value,
    path: cookie.Path,
    domain: cookie.Domain,
    expires: cookie.Expires,
    secure: cookie.Secure,
    httpOnly: cookie.HttpOnly,
  }));
  const headerCookies = rawHeaders
    .filter(([name]) => name.toLowerCase() === 'set-cookie')
    .map(([, value]) => parseSetCookie(value));

  return [...nativeCookies, ...headerCookies];
}

function parseSetCookie(value: string): TransportCookie {
  const [pair, ...attributes] = value.split(';').map((part) => part.trim());
  const separator = pair.indexOf('=');
  const cookie: TransportCookie = {
    name: separator === -1 ? pair : pair.slice(0, separator),
    value: separator === -1 ? '' : pair.slice(separator + 1),
  };

  for (const attribute of attributes) {
    const [key, attrValue = ''] = attribute.split('=', 2);
    const lowerKey = key.toLowerCase();
    if (lowerKey === 'path') cookie.path = attrValue;
    if (lowerKey === 'domain') cookie.domain = attrValue;
    if (lowerKey === 'expires') cookie.expires = attrValue;
    if (lowerKey === 'secure') cookie.secure = true;
    if (lowerKey === 'httponly') cookie.httpOnly = true;
  }

  return cookie;
}

function responseMetadata(raw: string | undefined): {
  statusText?: string;
  protocol?: string;
  fingerprint?: Record<string, unknown>;
} {
  if (!raw) {
    return {};
  }

  const text = new TextDecoder().decode(base64ToBytes(raw));
  const statusLine = text.split('\r\n', 1)[0] ?? '';
  const match = /^(HTTP\/\S+)\s+\d{3}\s*(.*)$/.exec(statusLine);

  return {
    protocol: match?.[1],
    statusText: match?.[2] || undefined,
  };
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
