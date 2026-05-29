## Task 5 - Transport capability matrix

- Added transport contracts in `src/transport/types.ts`: `TransportRequest`, `TransportResponse`, `TransportStream`, and `TransportBackend`; request options preserve impersonation, ordered headers, cookies, proxies, redirects, streaming response intent, streaming upload bodies, and AbortSignal so unsupported options can be rejected before backend calls.
- Native capabilities are intentionally evidence-backed: `getCapabilities()` requires `getNativeAssetInfo()` success and the documented ABI symbols from `src/native/abi.ts`; request-backed flags are true for HTTP/1.1, HTTP/2, JA3, browser presets, custom ClientHello, custom HTTP/2 settings, ordered headers, proxy, cookies, redirects, and streaming response.
- Current evidence does not prove JA4, streaming upload, or AbortSignal support, so those flags remain false and `assertCapability()` raises `UnsupportedCapabilityError` instead of silently downgrading to ordinary Fetch/Undici behavior.
- Compiled transport tests revealed native asset resolution must work from built ESM/CJS output as well as source; `src/native/assets.ts` now resolves dependencies from the repository working directory candidate roots without `import.meta`, allowing `npm run build` to pass.
- Evidence captured in `.omo/evidence/task-5-capabilities.json` and `.omo/evidence/task-5-no-silent-degrade.log`; `npm test -- capabilities` passed 7/7 subtests and `npm run build` exited 0.

## Task 4 - TLSConfig serialization port

- Python `TLSConfig` fields ported to TypeScript camelCase with native snake_case payload conversion: `id`, `ja3`, `random_ja3`, `headers_order`, `un_changed_header_key`, `force_http1`, `pseudo_header_order`, `tls_extensions`, `http2_settings`, and `user_agent`.
- Python `TLSExtensions` includes `client_hello_hex_stream`; keep it under `tlsExtensions.clientHelloHexStream` and serialize to `tls_extensions.client_hello_hex_stream`.
- Python `HTTP2Settings` includes `settings_ack` and `headers_id` in addition to settings order, connection flow, header priority, and priority frames. SETTINGS maps must be sparse records because browsers do not send every possible HTTP/2 setting.
- Header order and unchanged-key metadata must stay as arrays on impersonation config / ordered metadata; do not convert them through standard Fetch `Headers`, which normalizes casing and erases ordering intent.
- Evidence captured in `.omo/evidence/task-4-tlsconfig-serialization.log` and `.omo/evidence/task-4-header-order.log`; `npm test -- impersonation-types` passed 5/5 subtests.

## Task 3 - Native ABI contract

- Python `requests-go/requests_go/tls_client/client.py` exposes only six ctypes symbols: `request(char*) -> char*`, `freeMemory(char*)`, `freeSession(char*)`, `stream_request(char*) -> char*`, `stream_read(char*, int) -> char*`, and `stream_close(char*)`.
- Normal request payload is UTF-8 JSON with PascalCase keys (`Id`, `Method`, `Url`, `Headers`, `Body`, `TLSExtensions`, `HTTP2Settings`, etc.); request bodies are base64 strings and TLS/HTTP2 config subdocuments are JSON strings, not nested objects at the native boundary.
- Normal response JSON contains `url`, `status_code`, `headers`, optional `cookies`, base64 `content`, base64 `raw`, and optional `id`; Python raises on non-empty `err` and calls `freeMemory(res["id"])` after parsing when `id` exists.
- Streaming uses `stream_request` metadata with `stream_id`, then repeated `stream_read(stream_id, size)` returning `{data?: base64, eof?: boolean, err?: string}`, and cleanup through `stream_close(stream_id)`.
- Unknowns intentionally encoded in `src/native/abi.ts`: Python does not free returned `stream_request` or `stream_read` JSON strings, and does not prove native thread safety; Task 3b must audit/prove those before long-running streaming or concurrent direct FFI use.

## Task 3b - Native bindings facade

- `src/native/bindings.ts` exports the only stable native binding layer for later fetch/client code: async `request`, `streamRequest`, `streamRead`, `streamClose`, and `free` methods.
- Direct mode uses `ffi-napi` declarations from `src/native/abi.ts` when available; requires-shim mode uses a line-delimited JSON subprocess protocol and can be enabled with `IMPERSONATED_FETCH_NATIVE_SHIM` or a bundled shim executable next to the native assets.
- The facade parses native JSON, adds `Stream: true` for streaming opens, and raises typed `NativeBindingLoadError`, `NativeBindingProtocolError`, or `NativeBindingNativeError` instead of leaking corrupt assets, invalid JSON, or native `err` payloads to callers.

## Task 6 - Native transport adapter

- Added `src/native/ffi.ts` as the low-level adapter above `src/native/bindings.ts`; it validates native payload shapes and wraps binding/native failures as `NativeTransportError` or `TransportProtocolError` so native `err` payloads do not crash or leak untyped.
- Added `src/transport/native.ts` implementing `TransportBackend`: request conversion emits native PascalCase fields (`Method`, `Url`, ordered `Headers`, base64 `Body`, selected `Proxies`, second-based `Timeout`, redirect flag, verify/cert options, `TLSExtensions`/`HTTP2Settings` JSON strings, and `Stream` only for streaming opens).
- Native response conversion preserves raw header pairs including repeated `set-cookie`, parses Set-Cookie values into transport cookies in addition to native cookie payloads, decodes buffered content, derives status text/protocol from raw response bytes when present, and calls `free(id)` in a `finally` block after normal responses are copied.
- Streaming responses use `stream_request` + serialized `stream_read` calls and close exactly once through `stream_close`; the adapter rejects streaming upload bodies and AbortSignal until native support is proven instead of silently buffering or degrading.
- Evidence captured in `.omo/evidence/task-6-native-get.log` and `.omo/evidence/task-6-native-error.log`; `npm test -- native-transport` passed 4/4 subtests with typecheck.

## Task 10 - Abort, timeout, typed errors, and cleanup

- Added typed public errors in `src/errors.ts`: `AbortError`, `TimeoutError`, `NativeTransportError`, `NativeAssetNotFoundError`, `NativeAbiUnavailableError`, `UnsupportedCapabilityError`, `FetchBodyUsedError`, and `ValidationError`; native ABI shape failures now surface as `NativeAbiUnavailableError` instead of generic protocol failures.
- Added `src/timeout.ts` as the shared cancellation policy: it composes caller `AbortSignal` with `timeoutMs`, normalizes abort reasons into typed errors, validates timeout values, and provides `raceAbort()` for pending native/fetch/body phases.
- The fetch facade now buffers streaming upload bodies with abort-aware reads before native handoff, opens response bodies through streaming transport, races response body reads against cancellation, and closes streams on EOF, abort, or stream errors; abort after body completion only leaves the body marked used.
- Native transport now strips signals from native JSON payloads but keeps JS-side cancellation around `request`, `streamRequest`, and `streamRead`; late normal responses are `free(id)`-ed and late stream opens/read aborts call `streamClose()` exactly once.
- Evidence captured in `.omo/evidence/task-10-timeout.log` and `.omo/evidence/task-10-abort-midstream.log`; `npm test -- errors-abort` passed 9/9 subtests with typecheck.

## Task 7 - Fetch facade and body semantics

- Added `src/body.ts` as the shared one-shot Body implementation; `text()`, `json()`, `arrayBuffer()`, `blob()`, and direct `body` stream access all claim the body once and later reads reject with `TypeError`.
- Added `src/fetch.ts` as the public facade over `TransportBackend`: string/URL/Request inputs and practical `RequestInit` fields normalize into `TransportRequest`, while extension metadata (`headersOrder`, TLS, HTTP/2, impersonation preset/config) stays under `impersonation` instead of being encoded in standard `Headers`.
- `proxy`, millisecond `timeout`, and `native` backend options are facade extensions; injected native backends make tests deterministic, and `assertCapability()` still gates normalized transport features before I/O.
- Browser-only `mode`, `cache`, `integrity`, and `referrerPolicy` are explicit rejections, not silent CORS/cache/security emulation. AbortSignal is handled at the facade layer by rejecting before dispatch or racing the transport promise, without passing unsupported native abort through to the current backend.

## Task 9 - Impersonation native serialization

- Added `src/impersonation/serialize.ts` as the single request-to-native-payload mapper for advanced impersonation; `src/transport/native.ts` now delegates to it instead of maintaining a partial duplicate serializer.
- Serializer resolves browser/TLS presets, custom JA3, deterministic random-JA3 testing hooks, JA4 header order controls, unchanged header keys, `forceHttp1`, `clientHelloHexStream`, TLS extension payloads, HTTP/2 settings/order/connection flow/header priority/priority frames, and pseudo-header order into the FFI ABI shape.
- Native boundary remains PascalCase at the top level and keeps `TLSExtensions` / `HTTP2Settings` as JSON strings with snake_case fields, matching `src/native/abi.ts` and Python wrapper behavior.
- Unknown top-level impersonation, TLS extension, or HTTP/2 fields throw `ImpersonationSerializationError`; manual `content-length` is rejected so native/body serialization owns the wire length.
- Evidence captured in `.omo/evidence/task-9-chrome-payload.snap` and `.omo/evidence/task-9-unknown-option.log`; `npm test -- impersonation-serialize` passed 6/6 subtests with typecheck.

## Task 8 - Client/session state, cookies, and redirects

- Added `src/cookies.ts` as a per-client `CookieJar`; there is intentionally no global jar, so bare exported `fetch()` remains stateless while `Client.fetch()` stores response `Set-Cookie` values and sends domain/path/secure matching cookies on later eligible requests.
- Client defaults now include headers, default cookies, TLS/HTTP2/impersonation options, proxy, timeout, native backend options, redirect mode, max redirects, base URL, and cleanup. `Session` remains an alias subclass for Python-style session naming.
- Redirect following is implemented at the client layer by forcing backend requests to `redirect: "manual"`; 301/302 POST and 303 convert to GET and drop body/content headers, 307/308 preserve method/body, sensitive headers are stripped across origins, and impersonation settings are carried through each hop.
- Evidence captured in `.omo/evidence/task-8-cookie-jar.log` and `.omo/evidence/task-8-redirects.log`; `npm test -- client-session` passed 5/5 subtests with typecheck, and `npm run build` exited 0.

## Task 11 - Fixture and fingerprint verification suite

- Added localhost fixture coverage under `test/fingerprint/fixture.test.ts` backed by `test/fixtures/server.ts`; the fixture starts HTTP and self-signed HTTPS servers and exposes a transport backend so facade/client tests exercise real local endpoints without external network.
- The fixture suite validates HTTP version and ALPN/protocol metadata, ordered request headers, pseudo-header order and HTTP/2 settings intent, JA3 intent, proxy metadata, cookies, redirects, binary and non-UTF8 bodies, gzip decompression, large response streaming, and large upload buffering policy.
- Added `test/fingerprint/smoke.test.ts` and `npm run test:fingerprint` for `https://tls.peet.ws/api/all`; it writes `.omo/evidence/task-11-fingerprint.json` and validates JA3, JA3 hash, JA4-related fields, protocol metadata, HTTP/2 settings order when h2 is observed, header order, and pseudo-header order when the endpoint reports them. If native FFI/shim is unavailable, the smoke test records that reason and falls back to Node fetch so the real endpoint schema is still machine-validated.

## Task 12 - CI, package validation, and native asset checks

- Added GitHub Actions CI with build/typecheck/lint, unit tests, package validation, native asset checks on `ubuntu-latest`, `windows-latest`, and `macos-latest`; the real-network fingerprint smoke stays manual-only behind `workflow_dispatch` input `run_fingerprint_smoke`.
- `scripts/ci-local.mjs` is the shared local/CI validator: full mode runs install, build, typecheck, lint, tests, package consumption, `npm pack --dry-run --json`, and native resolver checks; package/native-only modes support focused CI jobs.
- `npm pack` is intentionally limited to `dist` plus the six current native binaries under `requests-go/requests_go/tls_client/dependencies`; the validator requires ESM/CJS/d.ts outputs, rejects unexpected native binary names, and writes pack contents to `.omo/evidence/task-12-pack-files.json`.
- Native asset sanity checks pin both file size and SHA-256 for linux x64/arm64/ia32, win32 x64, and darwin x64/arm64 assets, and validate both built ESM and CJS `getNativeAssetInfo()` behavior including unsupported platform rejection.

## Task 13 - Examples, migration notes, and release guardrails

- Created 12 Node.js examples in `examples/node/` mirroring Python `requests_go` patterns: basic GET, Client/Session cookies, custom TLSConfig, Chrome preset, random JA3, JA4 headers, POST JSON/data/bytes, streaming, proxy, and HTTP/2 settings.
- Updated `README.md` with comprehensive Node package usage section, explicit unsupported scope (no Python ciphers module, no async Session API, no Wireshark hex stream), capability matrix comparing Python vs Node features, no-silent-degradation behavior documentation, native asset platform limitations, security/ethics warning, and complete migration guide from Python `requests_go`.
- Added `npm run examples:smoke` script that validates all examples exist, have correct import structure, and pass TypeScript type checking; evidence captured in `.omo/evidence/task-13-examples.log` and `.omo/evidence/task-13-doc-guardrails.log`.
- Migration guide covers import/basic request, Session/cookies, custom TLS config, POST requests, JA3 randomization, and proxy configuration mappings from Python to Node.js syntax.
