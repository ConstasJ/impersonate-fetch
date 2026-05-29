import type { CookieJar } from './cookies.js';
import type { FetchInit } from './fetch.js';
import type { TransportCookie } from './transport/types.js';

export type {
  FetchInit,
  FetchInput as RequestInput,
  FetchResponse,
  NativeFetchOptions,
} from './fetch.js';

export interface ClientOptions extends FetchInit {
  readonly baseUrl?: string;
  readonly cookies?: ReadonlyArray<string | TransportCookie> | Record<string, string>;
  readonly cookieJar?: CookieJar;
  readonly maxRedirects?: number;
}
