import { allowsCredentials, CookieJar } from './cookies.js';
import { fetch } from './fetch.js';
import {
  defaultMaxRedirects,
  isRedirectStatus,
  nextRedirectRequest,
  resolveRedirectUrl,
} from './redirects.js';
import type { TransportCookie } from './transport/types.js';
import type { ClientOptions, FetchResponse, RequestInput } from './types.js';

export class Client {
  readonly cookies: CookieJar;
  private readonly defaultCookieHeader?: string;
  private closed = false;

  constructor(private readonly defaults: ClientOptions = {}) {
    this.cookies = defaults.cookieJar ?? new CookieJar(normalizeInitialCookies(defaults.cookies));
    this.defaultCookieHeader = defaultCookiesHeader(defaults.cookies);
  }

  async fetch(input: RequestInput, init: ClientOptions = {}): Promise<FetchResponse> {
    if (this.closed) {
      throw new TypeError('Client has been closed');
    }

    const base = requestUrl(input, init.baseUrl ?? this.defaults.baseUrl);
    const origin = new URL(base);
    const redirectMode = requestRedirect(input, this.defaults, init);
    const maxRedirects = init.maxRedirects ?? this.defaults.maxRedirects ?? defaultMaxRedirects;
    let url = base;
    let method = requestMethod(input, init);
    let headers = requestHeaders(input, this.defaults.headers, init.headers);
    let body = requestBody(init);

    for (let redirectCount = 0; ; redirectCount += 1) {
      const credentials =
        init.credentials ?? this.defaults.credentials ?? requestCredentials(input);
      const requestUrl = new URL(url);
      const defaultCookieHeader = allowsCredentials(credentials, requestUrl, origin)
        ? this.defaultCookieHeader
        : undefined;
      const cookieHeader = joinCookieHeaders(
        defaultCookieHeader,
        this.cookies.getCookieHeader(requestUrl, credentials, origin),
      );
      const requestHeaders = new Headers(headers);
      if (cookieHeader && !requestHeaders.has('cookie')) {
        requestHeaders.set('cookie', cookieHeader);
      }

      const response = await fetch(url, {
        ...this.defaults,
        ...init,
        body,
        headers: requestHeaders,
        method,
        redirect: 'manual',
        native: { ...(this.defaults.native ?? {}), ...(init.native ?? {}) },
        proxy: init.proxy ?? this.defaults.proxy,
        timeout: init.timeout ?? this.defaults.timeout,
        timeoutMs: init.timeoutMs ?? this.defaults.timeoutMs,
      });

      this.storeResponseCookies(response, credentials, origin);
      const nextUrl = resolveRedirectUrl(response);
      if (!nextUrl || redirectMode === 'manual') {
        return markRedirected(response, redirectCount > 0);
      }
      if (redirectMode === 'error') {
        await discardBody(response);
        throw new TypeError(`Redirect encountered for ${response.url}`);
      }
      if (!isRedirectStatus(response.status)) {
        return markRedirected(response, redirectCount > 0);
      }
      if (redirectCount >= maxRedirects) {
        await discardBody(response);
        throw new TypeError(`Maximum redirects exceeded (${maxRedirects})`);
      }

      const next = nextRedirectRequest({
        body,
        headers,
        method,
        status: response.status,
        from: new URL(response.url),
        to: nextUrl,
      });
      await discardBody(response);
      url = next.url.toString();
      method = next.method;
      headers = next.headers;
      body = next.body;
    }
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.cookies.clear();

    const backend = this.defaults.native?.backend;
    if (backend && typeof (backend as { close?: unknown }).close === 'function') {
      await (backend as unknown as { close: () => Promise<void> | void }).close();
    }
  }

  async cleanup(): Promise<void> {
    await this.close();
  }

  private storeResponseCookies(
    response: FetchResponse,
    credentials: RequestCredentials | undefined,
    origin: URL,
  ): void {
    const setCookieHeaders = (response.rawHeaders ?? [])
      .filter(([name]) => name.toLowerCase() === 'set-cookie')
      .map(([, value]) => value);
    this.cookies.storeCookies(
      [...response.cookies, ...setCookieHeaders],
      response.url,
      credentials,
      origin,
    );
  }
}

export class Session extends Client {}

function requestUrl(input: RequestInput, baseUrl: string | undefined): string {
  if (isRequest(input)) {
    return input.url;
  }
  return baseUrl ? new URL(String(input), baseUrl).toString() : String(input);
}

function requestMethod(input: RequestInput, init: ClientOptions): string {
  return init.method ?? (isRequest(input) ? input.method : undefined) ?? 'GET';
}

function requestHeaders(
  input: RequestInput,
  defaults: HeadersInit | undefined,
  init: HeadersInit | undefined,
): Headers {
  const headers = new Headers(defaults);
  if (isRequest(input) && init === undefined) {
    input.headers.forEach((value, name) => {
      headers.set(name, value);
    });
  }
  if (init !== undefined) {
    new Headers(init).forEach((value, name) => {
      headers.set(name, value);
    });
  }
  return headers;
}

function requestBody(init: ClientOptions): BodyInit | null | undefined {
  return hasOwn(init, 'body') ? init.body : undefined;
}

function requestRedirect(
  input: RequestInput,
  defaults: ClientOptions,
  init: ClientOptions,
): RequestRedirect {
  return (
    init.redirect ??
    defaults.redirect ??
    (isRequest(input) ? input.redirect : undefined) ??
    'follow'
  );
}

function requestCredentials(input: RequestInput): RequestCredentials | undefined {
  return isRequest(input) ? input.credentials : undefined;
}

function normalizeInitialCookies(
  cookies: ClientOptions['cookies'],
): Array<string | TransportCookie> {
  if (!(cookies && Array.isArray(cookies))) {
    return [];
  }
  return [...cookies];
}

function defaultCookiesHeader(cookies: ClientOptions['cookies']): string | undefined {
  if (!cookies || Array.isArray(cookies)) {
    return undefined;
  }
  const pairs = Object.entries(cookies).map(([name, value]) => `${name}=${value}`);
  return pairs.length > 0 ? pairs.join('; ') : undefined;
}

function joinCookieHeaders(
  left: string | undefined,
  right: string | undefined,
): string | undefined {
  if (left && right) {
    return `${left}; ${right}`;
  }
  return left ?? right;
}

function markRedirected(response: FetchResponse, redirected: boolean): FetchResponse {
  if (redirected) {
    (response as { redirected: boolean }).redirected = true;
  }
  return response;
}

async function discardBody(response: FetchResponse): Promise<void> {
  if (!response.bodyUsed) {
    await response.arrayBuffer().catch(() => undefined);
  }
}

function isRequest(input: RequestInput): input is Request {
  return typeof Request !== 'undefined' && input instanceof Request;
}

function hasOwn<T extends object>(value: T, key: PropertyKey): boolean {
  return Object.hasOwn(value, key);
}
