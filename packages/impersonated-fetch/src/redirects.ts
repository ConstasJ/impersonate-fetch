export const defaultMaxRedirects = 20;

export interface RedirectDecision {
  readonly body?: BodyInit | null;
  readonly headers: Headers;
  readonly method: string;
  readonly url: URL;
}

export function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

export function resolveRedirectUrl(response: {
  headers: Headers;
  status: number;
  url: string;
}): URL | undefined {
  if (!isRedirectStatus(response.status)) {
    return undefined;
  }
  const location = response.headers.get('location');
  return location ? new URL(location, response.url) : undefined;
}

export function nextRedirectRequest(options: {
  readonly body?: BodyInit | null;
  readonly headers: HeadersInit | undefined;
  readonly method: string;
  readonly status: number;
  readonly to: URL;
  readonly from: URL;
}): RedirectDecision {
  const headers = new Headers(options.headers);
  let method = options.method;
  let body = options.body;

  if (
    options.status === 303 ||
    ((options.status === 301 || options.status === 302) && method.toUpperCase() === 'POST')
  ) {
    method = 'GET';
    body = undefined;
    stripBodyHeaders(headers);
  }

  if (!sameOrigin(options.from, options.to)) {
    stripSensitiveHeaders(headers);
  }

  return { body, headers, method, url: options.to };
}

export function stripSensitiveHeaders(headers: Headers): void {
  for (const name of ['authorization', 'cookie', 'cookie2', 'proxy-authorization']) {
    headers.delete(name);
  }
}

function stripBodyHeaders(headers: Headers): void {
  for (const name of [
    'content-encoding',
    'content-language',
    'content-length',
    'content-location',
    'content-type',
  ]) {
    headers.delete(name);
  }
}

function sameOrigin(left: URL, right: URL): boolean {
  return (
    left.protocol === right.protocol && left.hostname === right.hostname && left.port === right.port
  );
}
