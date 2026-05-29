/**
 * Narrow native ABI contract for the vendored requests-go TLS client library.
 *
 * Source of truth inspected for this contract:
 * - requests-go/requests_go/tls_client/client.py
 * - requests-go/requests_go/tls_client/request.py
 * - requests-go/requests_go/tls_client/response.py
 * - requests-go/requests_go/tls_client/stream.py
 *
 * The native library is a C ABI dynamic library (`.dll`, `.so`, `.dylib`), not
 * a Node addon. Task 3b must either prove these declarations can be loaded by a
 * Node FFI package on every supported platform or provide a shim adapter.
 */
/** biome-ignore-all lint/style/useNamingConvention: 考虑到需要兼容requests-go的结构，所以需要特别豁免 */

export const nativeAbiSymbolNames = [
  'request',
  'freeMemory',
  'freeSession',
  'stream_request',
  'stream_read',
  'stream_close',
] as const;

export type NativeAbiSymbolName = (typeof nativeAbiSymbolNames)[number];

export const nativeAbiKoffiSignatures = {
  request: 'char *request(char *request_json)',
  freeMemory: 'void freeMemory(char *response_id)',
  freeSession: 'void freeSession(char *session_id)',
  stream_request: 'char *stream_request(char *request_json)',
  stream_read: 'char *stream_read(char *stream_id, int size)',
  stream_close: 'void stream_close(char *stream_id)',
} satisfies Record<NativeAbiSymbolName, string>;

/**
 * Opaque pointer to a NUL-terminated UTF-8 C string at the FFI boundary.
 *
 * Python passes request JSON as `ctypes.c_char_p` and decodes returned values as
 * UTF-8 JSON. The wrapper does not expose raw pointer values to Python callers.
 * In Node this should be represented by the chosen FFI package's pointer/buffer
 * type, not by a JavaScript string when ownership needs to be preserved.
 */
export type NativeCStringPointer = unknown;

/** UTF-8 JSON string encoded as a NUL-terminated C string. */
export type NativeJsonCString = NativeCStringPointer;

/** UTF-8 stream id/session id encoded as a NUL-terminated C string. */
export type NativeIdCString = NativeCStringPointer;

/**
 * Minimal FFI function table exported by the native asset.
 *
 * C signatures inferred from the Python ctypes wrapper:
 * - `char* request(char* request_json)`
 * - `void freeMemory(char* response_id)`
 * - `void freeSession(char* session_id)`
 * - `char* stream_request(char* request_json)`
 * - `char* stream_read(char* stream_id, int size)`
 * - `void stream_close(char* stream_id)`
 *
 * Do not bind broader native internals unless a later task documents them from
 * the Go source or an exported-header equivalent.
 */
export interface NativeTlsClientAbi {
  request(payload: NativeJsonCString): NativeJsonCString;
  freeMemory(responseId: NativeIdCString): void;
  freeSession(sessionId: NativeIdCString): void;
  stream_request(payload: NativeJsonCString): NativeJsonCString;
  stream_read(streamId: NativeIdCString, size: number): NativeJsonCString;
  stream_close(streamId: NativeIdCString): void;
}

/** Request JSON accepted by `request` and `stream_request`. */
export interface NativeRequestPayload {
  /** Session/client identifier. Python sends `""` when no TLSConfig id exists. */
  Id: string;
  Method: string;
  Url: string;
  Ja3?: string | null;
  RandomJA3: boolean;
  Params?: Record<string, unknown> | string;
  Headers?: Record<string, string>;
  /** Lower-case header ordering; Python lower-cases this before native call. */
  HeadersOrder?: string[];
  /** Header names whose original casing must be preserved by native code. */
  UnChangedHeaderKey?: string[];
  Cookies?: Record<string, string> | Array<Record<string, unknown>>;
  Timeout?: number;
  AllowRedirects: boolean;
  /** Single proxy URL selected by scheme (`http`, `https`, or `all`). */
  Proxies?: string;
  Verify?: boolean | string;
  Cert?: string | string[];
  /** Base64-encoded request body bytes. */
  Body?: string;
  Data?: unknown;
  Json?: unknown;
  ForceHTTP1?: boolean;
  PseudoHeaderOrder?: string[];
  /** JSON string produced by Python `tls_extensions.toMap()`, not an object. */
  TLSExtensions?: string;
  /** JSON string produced by Python `http2_settings.toMap()`, not an object. */
  HTTP2Settings?: string;
  /** Added only for `stream_request`; normal `request` omits it. */
  Stream?: true;
}

export interface NativeCookiePayload {
  Name: string;
  Value: string;
  Path: string;
  Domain: string;
  Expires?: string;
  Secure: boolean;
  HttpOnly: boolean;
}

/** Successful JSON payload returned by `request`. */
export interface NativeResponsePayload {
  id?: string;
  url: string;
  status_code: number;
  headers: Record<string, string[]>;
  cookies?: NativeCookiePayload[];
  /** Base64-encoded full response body bytes. */
  content: string;
  /** Base64-encoded raw HTTP response bytes, possibly HTTP/2 pseudo headers. */
  raw: string;
  err?: '' | undefined;
}

/** JSON payload returned by `stream_request` before body reads begin. */
export interface NativeStreamOpenPayload {
  stream_id: string;
  status_code: number;
  url: string;
  headers: Record<string, string[]>;
  cookies?: NativeCookiePayload[];
  err?: '' | undefined;
}

/** JSON payload returned by `stream_read(stream_id, size)`. */
export interface NativeStreamReadPayload {
  /** Base64-encoded body chunk. Empty or absent means no bytes for this read. */
  data?: string;
  /** True when the native stream reached EOF; caller should stop reading. */
  eof?: boolean;
  err?: '' | undefined;
}

/** Error schema shared by normal request, stream open, and stream read. */
export interface NativeErrorPayload {
  /** Non-empty string means the call failed; Python raises TLSClientExeption. */
  err: string;
}

export type NativeRequestResultPayload = NativeResponsePayload | NativeErrorPayload;
export type NativeStreamOpenResultPayload = NativeStreamOpenPayload | NativeErrorPayload;
export type NativeStreamReadResultPayload = NativeStreamReadPayload | NativeErrorPayload;

/**
 * Memory and cleanup contract observed from Python.
 *
 * - Input JSON/id strings are caller-owned. The native call must not retain the
 *   input pointer after returning unless a later source audit proves otherwise.
 * - `request` returns a native-owned UTF-8 JSON string. Python copies it with
 *   `.decode("utf-8")`, parses JSON, then calls `freeMemory(res["id"])` when
 *   the parsed response contains `id`. Python does not pass the returned pointer
 *   to `freeMemory`, so the `id` field is part of the native cleanup protocol.
 * - `stream_request` returns metadata containing `stream_id`; Python does not
 *   call `freeMemory` for that metadata response. This is an explicit unknown:
 *   Task 3b/Go-source audit must verify whether stream metadata memory is freed
 *   internally, intentionally leaked until `stream_close`, or requires a missing
 *   cleanup call.
 * - `stream_read` returns a native-owned UTF-8 JSON string for each chunk;
 *   Python does not free those read-result strings. This is also an explicit
 *   investigation assertion for Task 3b before long-running streaming support.
 * - `stream_close(stream_id)` is idempotently attempted by Python `close()` and
 *   suppresses native exceptions. Call it exactly once per opened stream in the
 *   Node wrapper, and tolerate double-close at wrapper level.
 * - `freeSession(session_id)` is exported and takes a C string id, but the four
 *   inspected Python files do not call it. Treat it as session cleanup only for
 *   ids allocated by native/session code documented by a later task.
 */
export const nativeAbiMemoryContract = {
  inputStrings: 'caller-owned utf8 c strings',
  requestResultCleanup:
    'call freeMemory(response.id) after copying/parsing request result JSON when id is present',
  streamCloseCleanup: 'call stream_close(stream_id) for every successful stream_request',
  streamResultCleanupUnknown: true,
  streamReadResultCleanupUnknown: true,
} as const;

/**
 * Thread-safety assumptions until the Go source is audited.
 *
 * The Python wrapper sets global ctypes function handles and performs no locking.
 * That proves only that the Python layer makes no thread-safety guarantees. The
 * Node binding should serialize calls per stream id, allow at most one pending
 * `stream_read` per stream, and avoid concurrent `stream_close` with a read. It
 * may issue independent non-stream `request` calls concurrently only after Task
 * 3b verifies the native library is safe under the selected FFI/shim runtime.
 */
export const nativeAbiThreadSafetyContract = {
  pythonWrapperLocks: false,
  serializeReadsPerStream: true,
  noReadCloseRacePerStream: true,
  concurrentRequestsRequireShimVerification: true,
} as const;

/** FFI declaration shape used by common Node FFI packages such as ffi-napi. */
export const nativeAbiFfiDeclarations = {
  request: ['string', ['string']],
  freeMemory: ['void', ['string']],
  freeSession: ['void', ['string']],
  stream_request: ['string', ['string']],
  stream_read: ['string', ['string', 'int']],
  stream_close: ['void', ['string']],
} as const;
