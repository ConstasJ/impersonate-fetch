import type { TransportCookie } from './transport/types.js';

export type CookieCredentials = RequestCredentials | undefined;

interface StoredCookie extends TransportCookie {
  domain: string;
  hostOnly: boolean;
  path: string;
  expiresAt?: number;
  creationIndex: number;
}

export class CookieJar {
  private readonly cookies = new Map<string, StoredCookie>();
  private nextCreationIndex = 0;

  constructor(cookies: Iterable<string | TransportCookie> = []) {
    for (const cookie of cookies) {
      if (typeof cookie === 'string') {
        this.setCookie(cookie, 'http://localhost/');
      } else {
        this.storeCookie(cookie, 'http://localhost/');
      }
    }
  }

  setCookie(header: string, url: string | URL): void {
    const cookie = parseSetCookie(header);
    if (cookie) {
      this.storeCookie(cookie, url);
    }
  }

  storeCookies(
    cookies: Iterable<string | TransportCookie>,
    url: string | URL,
    credentials: CookieCredentials = 'same-origin',
    origin: URL = new URL(url),
  ): void {
    if (!allowsCredentials(credentials, new URL(url), origin)) {
      return;
    }

    for (const cookie of cookies) {
      if (typeof cookie === 'string') {
        this.setCookie(cookie, url);
      } else {
        this.storeCookie(cookie, url);
      }
    }
  }

  getCookieHeader(
    url: string | URL,
    credentials: CookieCredentials = 'same-origin',
    origin: URL = new URL(url),
  ): string | undefined {
    const requestUrl = new URL(url);
    if (!allowsCredentials(credentials, requestUrl, origin)) {
      return undefined;
    }

    const now = Date.now();
    const matching: StoredCookie[] = [];
    for (const [key, cookie] of this.cookies) {
      if (isExpired(cookie, now)) {
        this.cookies.delete(key);
        continue;
      }
      if (matchesCookie(cookie, requestUrl)) {
        matching.push(cookie);
      }
    }

    if (matching.length === 0) {
      return undefined;
    }

    matching.sort(
      (left, right) =>
        right.path.length - left.path.length || left.creationIndex - right.creationIndex,
    );
    return matching.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
  }

  clear(): void {
    this.cookies.clear();
  }

  private storeCookie(cookie: TransportCookie, url: string | URL): void {
    if (!cookie.name) {
      return;
    }

    const requestUrl = new URL(url);
    const host = canonicalHost(requestUrl.hostname);
    const normalizedDomain = cookie.domain ? canonicalHost(cookie.domain.replace(/^\./, '')) : host;
    const hostOnly = !cookie.domain;
    if (cookie.domain && !domainMatches(host, normalizedDomain)) {
      return;
    }

    const path = cookie.path?.startsWith('/') ? cookie.path : defaultPath(requestUrl.pathname);
    const expiresAt = expiresToTime(cookie.expires);
    const key = cookieKey(normalizedDomain, path, cookie.name, hostOnly);

    if (expiresAt !== undefined && expiresAt <= Date.now()) {
      this.cookies.delete(key);
      return;
    }

    this.cookies.set(key, {
      ...cookie,
      domain: normalizedDomain,
      hostOnly,
      path,
      expiresAt,
      creationIndex: this.nextCreationIndex,
    });
    this.nextCreationIndex += 1;
  }
}

export function parseSetCookie(header: string): TransportCookie | undefined {
  const [pair, ...attributes] = header.split(';').map((part) => part.trim());
  if (!pair) {
    return undefined;
  }

  const separator = pair.indexOf('=');
  const name = separator === -1 ? pair : pair.slice(0, separator);
  if (!name) {
    return undefined;
  }

  const cookie: TransportCookie = {
    name,
    value: separator === -1 ? '' : pair.slice(separator + 1),
  };

  for (const attribute of attributes) {
    const separatorIndex = attribute.indexOf('=');
    const key = (separatorIndex === -1 ? attribute : attribute.slice(0, separatorIndex))
      .trim()
      .toLowerCase();
    const value = separatorIndex === -1 ? '' : attribute.slice(separatorIndex + 1).trim();

    if (key === 'domain') cookie.domain = value;
    if (key === 'path') cookie.path = value;
    if (key === 'expires') cookie.expires = value;
    if (key === 'max-age') cookie.expires = new Date(Date.now() + Number(value) * 1000);
    if (key === 'secure') cookie.secure = true;
    if (key === 'httponly') cookie.httpOnly = true;
  }

  return cookie;
}

export function allowsCredentials(credentials: CookieCredentials, url: URL, origin: URL): boolean {
  if (credentials === 'omit') {
    return false;
  }
  if (credentials === 'include') {
    return true;
  }
  return sameOrigin(url, origin);
}

function matchesCookie(cookie: StoredCookie, url: URL): boolean {
  const host = canonicalHost(url.hostname);
  if (cookie.hostOnly ? host !== cookie.domain : !domainMatches(host, cookie.domain)) {
    return false;
  }
  if (!pathMatches(url.pathname || '/', cookie.path)) {
    return false;
  }
  return !cookie.secure || url.protocol === 'https:';
}

function domainMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

function pathMatches(requestPath: string, cookiePath: string): boolean {
  if (requestPath === cookiePath || requestPath.startsWith(cookiePath)) {
    return (
      cookiePath.endsWith('/') ||
      requestPath.charAt(cookiePath.length) === '/' ||
      requestPath.length === cookiePath.length
    );
  }
  return false;
}

function defaultPath(pathname: string): string {
  if (!pathname?.startsWith('/')) {
    return '/';
  }
  const lastSlash = pathname.lastIndexOf('/');
  return lastSlash <= 0 ? '/' : pathname.slice(0, lastSlash);
}

function expiresToTime(expires: TransportCookie['expires']): number | undefined {
  if (expires === undefined) {
    return undefined;
  }
  const time = expires instanceof Date ? expires.getTime() : Date.parse(expires);
  return Number.isNaN(time) ? undefined : time;
}

function isExpired(cookie: StoredCookie, now: number): boolean {
  return cookie.expiresAt !== undefined && cookie.expiresAt <= now;
}

function cookieKey(domain: string, path: string, name: string, hostOnly: boolean): string {
  return `${hostOnly ? 'host' : 'domain'}\t${domain}\t${path}\t${name}`;
}

function canonicalHost(host: string): string {
  return host.toLowerCase();
}

function sameOrigin(left: URL, right: URL): boolean {
  return (
    left.protocol === right.protocol && left.hostname === right.hostname && left.port === right.port
  );
}
