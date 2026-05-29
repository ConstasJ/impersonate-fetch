# Node Fetch Port with requests_go Impersonation Backend

## TL;DR
> **Summary**: Port `requests_go` into a TypeScript Node.js package that exposes a Fetch-first API while preserving advanced TLS fingerprint and HTTP/2 impersonation through the existing native transport assets loaded by FFI.
> **Deliverables**:
> - TypeScript npm package with ESM + CJS output and `.d.ts` declarations
> - `fetch(input, init)` facade with namespaced impersonation extensions
> - Stateful `Client` / `Session` API for cookies, defaults, redirects, proxy, and TLS presets
> - FFI shared-library transport using existing `requests_go/tls_client/dependencies/*` assets
> - Capability matrix and no-silent-degradation errors
> - Full CI with unit, fixture, native binary, and fingerprint/protocol tests
> **Effort**: XL
> **Parallel**: YES - 3 implementation waves + final verification wave
> **Critical Path**: Task 2 → Task 3 → Task 3b → Task 5 → Task 6 → Task 9 → Task 11 → Task 12

## Context
### Original Request
用户计划把 `requests_go` 库移植到 Node.js 平台，使用 Fetch API 风格，同时复刻 `requests_go` 的自定义 TLS 指纹、JA3/JA4、HTTP/2 参数和浏览器伪装能力。

### Interview Summary
- Product shape: Fetch facade + native backend.
- Backend route: directly use existing `requests_go` native transport assets via FFI shared library loading.
- Package shape: TypeScript source, ESM + CJS builds, generated type declarations.
- API exposure: support both `Client` / `Session` and namespaced `fetch(input, init)` extensions.
- Fetch policy: Fetch-first with extensions, not Python `requests` behavior first.
- v1 scope: full HTTP/2 impersonation is required.
- Platform scope: only platforms/architectures already present in repository native assets.
- Verification: full CI plus fingerprint/protocol tests.

### Metis Review (gaps addressed)
- Added strict native transport boundary before TypeScript API implementation.
- Added mandatory capability matrix: platform, native binary, HTTP/1.1, HTTP/2, JA3, JA4, browser presets, custom ClientHello, ordered headers, proxy, cookies, streaming, redirects, AbortSignal.
- Added no-silent-degradation rule: impersonation requests must throw typed errors if unsupported.
- Separated stateless global `fetch()` from stateful `Client` / `Session` cookies and defaults.
- Treat header ordering and HTTP/2 pseudo-header ordering as native wire instructions, not ordinary `Headers` behavior.
- Added explicit Fetch edge cases: one-shot bodies, clone behavior, abort, redirects, streaming, unsupported browser-only fields.

## Work Objectives
### Core Objective
Build a Node.js package that feels like Fetch but can route requests through the current `requests_go` native TLS/HTTP2 engine for browser-grade impersonation.

### Deliverables
- `package.json`, TypeScript config, build/test scripts, ESM/CJS export map.
- Native asset resolver for existing `.dll`, `.so`, `.dylib` files under `requests_go/tls_client/dependencies`.
- FFI transport adapter with typed request/response serialization.
- Fetch facade and `Client` / `Session` APIs.
- TypeScript models for TLS, HTTP/2, presets, header order, proxy, cookies, redirects, abort/timeout, and capability errors.
- Tests and CI for Fetch behavior, native loading, protocol fingerprinting, and package consumption.

### Definition of Done (verifiable conditions with commands)
- `npm run build` emits ESM, CJS, and `.d.ts` outputs.
- `npm test` passes unit, fixture, and integration tests.
- `npm run test:fingerprint` verifies at least Chrome and Firefox presets against a fingerprint endpoint or local capture harness.
- `npm run test:package` verifies both `require()` and `import()` consumption.
- `npm run lint` and `npm run typecheck` pass.
- Unsupported native platform or unsupported impersonation capability throws a typed `UnsupportedCapabilityError` and never falls back silently.

### Must Have
- Fetch-first API: returns standard-like `Response`; accepts `RequestInfo` / `RequestInit` where practical.
- Namespaced advanced extensions: `impersonate`, `tls`, `http2`, `headersOrder`, `native`, `proxy`, `timeout`.
- `Client` / `Session` owns cookies, defaults, native backend selection, proxy, redirects, and lifecycle.
- Native FFI path supports existing platform assets only.
- Full HTTP/2 impersonation in v1 where the existing native backend supports it.
- Capability matrix is executable and exposed in the API.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No pure JS/Undici fallback that pretends impersonation succeeded.
- No expansion to unsupported OS/arch in v1.
- No browser CORS/cache emulation beyond documented Fetch-compatible behavior.
- No full Python `requests` API parity requirement in v1.
- No global implicit cookie jar for bare `fetch()`.
- No vague “works like Fetch” acceptance criteria; every claim must be command-verified.

## Verification Strategy
> ZERO HUMAN INTERVENTION for technical verification - all tests/reviews/evidence collection are agent-executed. Final user approval in the Final Verification Wave is a workflow completion gate, not a manual test step.
- Test decision: tests-after with TypeScript test runner + CI because no formal test suite exists in the source repository.
- QA policy: Every task has agent-executed scenarios.
- Evidence: `.omo/evidence/task-{N}-{slug}.{ext}`.

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: Tasks 1-5 plus Task 3b — package scaffold, native assets, ABI spec, FFI binding shim, option models, capability matrix.
Wave 2: Tasks 6-10 — FFI transport, Fetch facade, Client/Session, advanced option mapping, abort/error policy.
Wave 3: Tasks 11-13 — fingerprint tests, CI/package validation, examples/docs/release readiness.

Within-wave serial gates:
- Wave 1 parallel start: Tasks 1, 2, and 4 can start together.
- Wave 1 gate A: Task 3 starts only after Task 2.
- Wave 1 gate B: Task 3b starts only after Task 3.
- Wave 1 gate C: Task 5 starts only after Tasks 2, 3b, and 4.
- Wave 2 gate A: Task 6 starts first after Wave 1 completion.
- Wave 2 gate B: Tasks 7, 9, and 10 start after Task 6; Task 8 starts after Tasks 6 and 7.

### Dependency Matrix (full, all tasks)
- Task 1: no blockers; blocks Tasks 7, 11, 12, 13.
- Task 2: no blockers; blocks Tasks 3, 5, 6, 12.
- Task 3: blocked by Task 2; blocks Task 3b.
- Task 3b: blocked by Task 3; blocks Tasks 5 and 6.
- Task 4: no blockers; blocks Tasks 5, 6, 8, 9, 11.
- Task 5: blocked by Tasks 2, 3b, and 4; blocks Tasks 6, 9, 10, 12.
- Task 6: blocked by Tasks 3b, 4, 5; blocks Tasks 7, 8, 9, 10, 11.
- Task 7: blocked by Tasks 1, 5, 6; blocks Tasks 8, 10, 11.
- Task 8: blocked by Tasks 4, 6, 7; blocks Tasks 11, 13.
- Task 9: blocked by Tasks 4, 5, 6; blocks Task 11.
- Task 10: blocked by Tasks 5, 6, 7; blocks Tasks 11, 12.
- Task 11: blocked by Tasks 1, 6, 7, 8, 9, 10; blocks Task 12.
- Task 12: blocked by Tasks 1, 2, 5, 10, 11; blocks Task 13.
- Task 13: blocked by Tasks 1, 8, 12.

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 6 tasks → quick, unspecified-high, deep.
- Wave 2 → 5 tasks → deep, unspecified-high.
- Wave 3 → 3 tasks → unspecified-high, writing.
- Final Verification → 4 tasks → oracle, unspecified-high, unspecified-high, deep.

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Scaffold TypeScript npm package with dual ESM/CJS output

  **What to do**: Add Node package scaffolding in repository root without modifying Python behavior: `package.json`, `tsconfig.json`, `tsconfig.build.json`, test config, `src/index.ts`, `src/fetch.ts`, `src/client.ts`, and `src/types.ts`. Configure scripts: `build`, `test`, `test:fingerprint`, `test:package`, `typecheck`, `lint`. Configure exports so `import` resolves ESM and `require` resolves CJS. Add package-consumption smoke scripts under `test/package/`.
  **Must NOT do**: Do not remove or rewrite existing Python package files. Do not publish or commit. Do not add unsupported platform binaries.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: bounded package/config scaffold with clear outputs.
  - Skills: [] - no special skill needed.
  - Omitted: [`frontend-ui-ux`] - no UI work.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 7, 11, 12, 13 | Blocked By: none

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `setup.py` - existing packaging metadata is Python-only; Node package must be additive.
  - Pattern: `requests_go/__init__.py` - public export surface to mirror at a high level.
  - External: Node/Undici Fetch docs - keep Fetch globals as a matched set.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run build` exits 0 and creates ESM, CJS, and `.d.ts` output directories.
  - [ ] `npm run typecheck` exits 0.
  - [ ] `npm run test:package` exits 0 and verifies both `require()` and dynamic `import()`.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Dual package import works
    Tool: Bash
    Steps: Run `npm run build && npm run test:package`.
    Expected: Command exits 0; evidence log shows both CJS and ESM entrypoints imported.
    Evidence: .omo/evidence/task-1-package-import.log

  Scenario: Python package remains untouched
    Tool: Bash
    Steps: Run `git diff -- requests_go setup.py README.md`.
    Expected: No diff for existing Python source files unless explicitly documented as additive metadata.
    Evidence: .omo/evidence/task-1-python-untouched.diff
  ```

  **Commit**: YES | Message: `feat(node): scaffold fetch port package` | Files: `package.json`, `tsconfig*.json`, `src/**`, `test/package/**`

- [x] 2. Inventory and resolve existing native transport assets

  **What to do**: Implement `src/native/assets.ts` that inventories existing files under `requests_go/tls_client/dependencies`, maps Node `process.platform` + `process.arch` to the correct `.dll`, `.so`, or `.dylib`, validates existence, exposes `getNativeAssetInfo()`, and throws `NativeAssetNotFoundError` for unsupported platforms. Add tests for every existing asset mapping and one unsupported platform simulation.
  **Must NOT do**: Do not download binaries. Do not invent support for OS/arch combinations not present in the repository.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: native asset mapping affects packaging correctness.
  - Skills: [] - no special skill needed.
  - Omitted: [`git-master`] - no git history operation required.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 3, 5, 6, 12 | Blocked By: none

  **References**:
  - Pattern: `requests_go/tls_client/dependencies/requests-go-amd64.so` - existing Linux x64 native asset.
  - Pattern: `requests_go/tls_client/dependencies/requests-go-arm64.so` - existing Linux arm64 native asset.
  - Pattern: `requests_go/tls_client/dependencies/requests-go-x86.so` - existing Linux x86 native asset.
  - Pattern: `requests_go/tls_client/dependencies/requests-go-win64.dll` - existing Windows x64 native asset.
  - Pattern: `requests_go/tls_client/dependencies/requests-go-x86.dylib` - existing macOS x64 native asset.
  - Pattern: `requests_go/tls_client/dependencies/requests-go-arm64.dylib` - existing macOS arm64 native asset.
  - Pattern: `requests_go/tls_client/client.py` - current native loader behavior.

  **Acceptance Criteria**:
  - [ ] `npm test -- native-assets` exits 0.
  - [ ] Unsupported platform simulation throws `NativeAssetNotFoundError` with platform and arch in message.
  - [ ] Asset resolver never returns a path outside `requests_go/tls_client/dependencies`.

  **QA Scenarios**:
  ```
  Scenario: Current platform resolves native asset
    Tool: Bash
    Steps: Run `npm test -- native-assets --runInBand`.
    Expected: Test prints/resolves one existing native asset path and asserts file existence.
    Evidence: .omo/evidence/task-2-native-assets.log

  Scenario: Unsupported platform fails loudly
    Tool: Bash
    Steps: Run test case that simulates `platform=freebsd` and `arch=riscv64`.
    Expected: `NativeAssetNotFoundError` is thrown; no fallback asset path is returned.
    Evidence: .omo/evidence/task-2-unsupported-platform.log
  ```

  **Commit**: YES | Message: `feat(native): resolve bundled transport assets` | Files: `src/native/assets.ts`, `test/native/assets.test.ts`

- [x] 3. Define narrow FFI native transport ABI and memory contract

  **What to do**: Inspect `requests_go/tls_client/client.py`, `requests_go/tls_client/request.py`, `requests_go/tls_client/response.py`, and `requests_go/tls_client/stream.py`; then create `src/native/abi.ts` and `docs`-style comments in code defining the exact FFI functions, string/buffer ownership, JSON payload format, streaming handles, close semantics, error schema, and thread-safety assumptions. Add a contract test that loads the asset and reports one of two expected states: `mode=direct` when required native symbols are callable from Node FFI, or `mode=requiresShim` when Task 3b must provide the binding declarations/shim adapter before Task 6.
  **Must NOT do**: Do not bind a broad set of internals. Do not assume undocumented memory ownership; encode unknowns as explicit investigation assertions/tests.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: native FFI boundary and memory/cancellation semantics are high-risk architecture work.
  - Skills: [] - no special skill needed.
  - Omitted: [`frontend-ui-ux`] - no UI work.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 6 | Blocked By: 2

  **References**:
  - Pattern: `requests_go/tls_client/client.py` - native library loading and exported function names.
  - Pattern: `requests_go/tls_client/request.py` - request JSON/options serialization.
  - Pattern: `requests_go/tls_client/response.py` - native response parsing and cookie extraction.
  - Pattern: `requests_go/tls_client/stream.py` - native streaming functions and close behavior.
  - Guardrail: Metis directive — define narrow native transport ABI before TypeScript API implementation.

  **Acceptance Criteria**:
  - [ ] `npm test -- native-abi` exits 0 and reports exactly one expected state: `mode=direct` or `mode=requiresShim`.
  - [ ] ABI contract documents request payload, response payload, error payload, stream handle, and cleanup ownership.
  - [ ] If current native binary lacks direct callable ABI for Node FFI, the test passes with `mode=requiresShim`; Task 3b becomes mandatory before Task 6.

  **QA Scenarios**:
  ```
  Scenario: ABI contract validates against available native symbols
    Tool: Bash
    Steps: Run `npm test -- native-abi --runInBand`.
    Expected: Test exits 0 and prints `mode=direct` with detected symbols or `mode=requiresShim` with missing-symbol details; process does not crash.
    Evidence: .omo/evidence/task-3-native-abi.log

  Scenario: Native cleanup is deterministic
    Tool: Bash
    Steps: Run ABI test that opens and closes a dummy/unsupported stream handle path.
    Expected: Close operation is idempotent or throws a typed error; no unhandled rejection or process crash.
    Evidence: .omo/evidence/task-3-native-cleanup.log
  ```

  **Commit**: YES | Message: `feat(native): define ffi transport abi` | Files: `src/native/abi.ts`, `test/native/abi.test.ts`

- [x] 3b. Implement Node FFI binding declarations and shim adapter required by ABI probe

  **What to do**: Implement `src/native/bindings.ts` so the rest of the package always calls one stable TypeScript binding layer regardless of whether Task 3 reported `mode=direct` or `mode=requiresShim`. For `mode=direct`, bind the native symbols discovered in Task 3 using the selected FFI loader and typed wrappers. For `mode=requiresShim`, implement the minimal adapter required to expose the same stable methods (`request`, `streamRequest`, `streamRead`, `streamClose`, `free`) over the current native asset contract; if a compiled shim is unavoidable, add the shim source/build script and native smoke test as part of this task. The output contract must be identical for both states.
  **Must NOT do**: Do not let Task 6 call raw FFI symbols directly. Do not continue to Task 6 until `src/native/bindings.ts` exports the stable binding layer and tests pass.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: binding/shim work is the highest-risk implementation boundary.
  - Skills: [] - no special skill needed.
  - Omitted: [`frontend-ui-ux`] - no UI work.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 5, 6 | Blocked By: 3

  **References**:
  - Pattern: `requests_go/tls_client/client.py` - current dynamic library loading and callable surface.
  - Pattern: `requests_go/tls_client/request.py` - expected request function behavior.
  - Pattern: `requests_go/tls_client/stream.py` - expected streaming function behavior.
  - Pattern: `src/native/abi.ts` from Task 3 - required stable ABI contract.

  **Acceptance Criteria**:
  - [ ] `npm test -- native-bindings` exits 0.
  - [ ] `src/native/bindings.ts` exports stable typed functions independent of direct/shim mode.
  - [ ] A missing/corrupt native asset throws `NativeAssetNotFoundError` or `NativeAbiUnavailableError`; it never segfaults or falls back silently.

  **QA Scenarios**:
  ```
  Scenario: Stable binding layer loads current native asset
    Tool: Bash
    Steps: Run `npm test -- native-bindings --runInBand`.
    Expected: Binding layer initializes in `direct` or `shim` mode and exposes request/stream/close wrappers.
    Evidence: .omo/evidence/task-3b-native-bindings.log

  Scenario: Corrupt asset fails safely
    Tool: Bash
    Steps: Run binding test with asset path pointed to a temporary invalid file.
    Expected: Typed native ABI/asset error is thrown; Node process remains alive.
    Evidence: .omo/evidence/task-3b-corrupt-asset.log
  ```

  **Commit**: YES | Message: `feat(native): add ffi binding shim layer` | Files: `src/native/bindings.ts`, `test/native/bindings.test.ts`, optional `native-shim/**`

- [x] 4. Port TLSConfig, HTTP2Settings, and impersonation option types

  **What to do**: Create TypeScript models in `src/impersonation/types.ts` and presets in `src/impersonation/presets.ts` that represent `TLSConfig`, `TLSExtensions`, `HTTP2Settings`, browser presets, JA3/random JA3, JA4-related header controls, `forceHttp1`, `headersOrder`, `pseudoHeaderOrder`, `unChangedHeaderKey`, and `clientHelloHexStream`. Include conversion helpers from Python-style snake_case JSON to TypeScript camelCase and back to native snake_case payloads. Add tests with fixture JSON copied from README examples and existing examples.
  **Must NOT do**: Do not omit HTTP/2 fields because v1 requires full HTTP/2 impersonation. Do not let standard Fetch `Headers` erase ordering metadata.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: type parity and option serialization determine impersonation fidelity.
  - Skills: [] - no special skill needed.
  - Omitted: [`ai-slop-remover`] - not a cleanup-only task.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 5, 6, 8, 9, 11 | Blocked By: none

  **References**:
  - Pattern: `requests_go/tls_config/config.py` - core TLSConfig and browser presets.
  - Pattern: `requests_go/tls_config/extensions.py` - TLS extensions and HTTP/2 settings model.
  - Pattern: `requests_go/tls_config/convert_config.py` - browser JSON to TLSConfig conversion.
  - Pattern: `requests_go/tls_config/ciphers.py` - cipher conversion helpers.
  - Pattern: `example/custom_tls.py`, `example/tls_config_test.py`, `example/ja4.py`, `example/random_ja3.py` - usage fixtures.
  - Pattern: `README.md` - documents pseudo-header order, HTTP/2 settings order, `connection_flow`, priority frames, and `client_hello_hex_stream`.

  **Acceptance Criteria**:
  - [ ] `npm test -- impersonation-types` exits 0.
  - [ ] Snake_case → camelCase → native payload round-trip preserves TLS and HTTP/2 fields.
  - [ ] Header order, pseudo-header order, and unchanged header keys are preserved outside standard `Headers` normalization.

  **QA Scenarios**:
  ```
  Scenario: README TLSConfig example serializes to native payload
    Tool: Bash
    Steps: Run `npm test -- impersonation-types --runInBand`.
    Expected: Serialized payload includes `ja3`, `pseudo_header_order`, `http2_settings.settings_order`, and `connection_flow` exactly as fixture expects.
    Evidence: .omo/evidence/task-4-tlsconfig-serialization.log

  Scenario: Header order survives Fetch Headers normalization
    Tool: Bash
    Steps: Run test that passes mixed-case headers plus `headersOrder` and `unChangedHeaderKey`.
    Expected: Native payload includes ordered wire header list and unchanged key list exactly; ordinary Headers object may be normalized separately.
    Evidence: .omo/evidence/task-4-header-order.log
  ```

  **Commit**: YES | Message: `feat(impersonation): add tls and http2 option models` | Files: `src/impersonation/**`, `test/impersonation/**`

- [x] 5. Implement transport interface and capability matrix

  **What to do**: Create `src/transport/types.ts`, `src/transport/capabilities.ts`, and `src/errors.ts`. Define `TransportRequest`, `TransportResponse`, `TransportStream`, and `TransportBackend`. Implement `getCapabilities()` for native backend based on asset availability and ABI findings. Include capabilities for platform, native binary, HTTP/1.1, HTTP/2, JA3, JA4, browser presets, custom ClientHello, custom HTTP/2 settings, ordered headers, proxy, cookies, streaming upload, streaming response, redirects, and AbortSignal. Add `assertCapability()` that throws `UnsupportedCapabilityError` with backend, capability, platform, and requested option.
  **Must NOT do**: Do not silently downgrade impersonation requests to ordinary Fetch or Undici. Do not mark a capability true unless backed by current native asset/ABI evidence.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: this is the central safety boundary for all later work.
  - Skills: [] - no special skill needed.
  - Omitted: [`frontend-ui-ux`] - no UI work.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 6, 9, 10, 12 | Blocked By: 2, 3b, 4

  **References**:
  - Pattern: `requests_go/tls_client/dependencies/*` - available platform capabilities.
  - Pattern: `requests_go/tls_client/request.py` - native request feature payload.
  - Pattern: `requests_go/tls_config/config.py` and `extensions.py` - impersonation features to expose.
  - Guardrail: Oracle/Metis — no silent degradation.

  **Acceptance Criteria**:
  - [ ] `npm test -- capabilities` exits 0.
  - [ ] Unsupported capability requests throw `UnsupportedCapabilityError` before network I/O.
  - [ ] Capability matrix can be imported and printed by `node -e` after build.

  **QA Scenarios**:
  ```
  Scenario: Capability matrix reports native support
    Tool: Bash
    Steps: Run `npm run build && node -e "console.log(require('./dist/cjs').getCapabilities())"`.
    Expected: Output includes current platform, asset path, and boolean flags for HTTP/2, JA3, JA4, ordered headers, proxy, cookies, streams.
    Evidence: .omo/evidence/task-5-capabilities.json

  Scenario: Unsupported capability fails before request
    Tool: Bash
    Steps: Run test that disables `http2Settings` in a fake backend then requests `http2.settings`.
    Expected: `UnsupportedCapabilityError` is thrown; no native call mock is invoked.
    Evidence: .omo/evidence/task-5-no-silent-degrade.log
  ```

  **Commit**: YES | Message: `feat(transport): add capability matrix` | Files: `src/transport/**`, `src/errors.ts`, `test/transport/capabilities.test.ts`

- [x] 6. Implement FFI native transport adapter

  **What to do**: Implement `src/native/ffi.ts` and `src/transport/native.ts` using the selected FFI loader. Convert `TransportRequest` into the native payload format from Task 3, including method, URL, ordered headers, body, proxy, timeout, verify/cert options, TLSConfig, HTTP2Settings, redirect settings, and stream flag. Convert native responses into `TransportResponse` with status, status text, raw header list, set-cookie preservation, body stream or body buffer, protocol/fingerprint metadata when available, and typed native errors. Add deterministic cleanup for request handles and stream handles.
  **Must NOT do**: Do not buffer streaming responses unless the request explicitly asks for non-stream body consumption. Do not crash process on native errors; wrap them in typed errors.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: native bridge, streaming, and error handling are high-risk.
  - Skills: [] - no special skill needed.
  - Omitted: [`git-master`] - no git operation required.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 7, 8, 9, 10, 11 | Blocked By: 3b, 4, 5

  **References**:
  - Pattern: `requests_go/tls_client/request.py` - request serialization and native call execution.
  - Pattern: `requests_go/tls_client/response.py` - response parsing and cookie extraction.
  - Pattern: `requests_go/tls_client/stream.py` - stream request/read/close behavior.
  - Pattern: `requests_go/request.py` - low-level TLSRequest wrapper.
  - Pattern: `requests_go/response.py` - response adaptation behavior.

  **Acceptance Criteria**:
  - [ ] `npm test -- native-transport` exits 0.
  - [ ] Native transport performs a GET to a fixture endpoint through the stable binding layer; if ABI is unavailable, execution must have stopped earlier in Task 3b with a typed ABI failure.
  - [ ] Stream response path exposes a Web `ReadableStream` or documented adapter and closes native resources on completion/abort.

  **QA Scenarios**:
  ```
  Scenario: Native GET returns transport response
    Tool: Bash
    Steps: Run `npm test -- native-transport --runInBand` with fixture server URL.
    Expected: Response status is 200; headers and body are available; native handle cleanup is asserted.
    Evidence: .omo/evidence/task-6-native-get.log

  Scenario: Native error is typed
    Tool: Bash
    Steps: Run native transport test against invalid domain or mocked native error payload.
    Expected: Throws typed `NativeTransportError` with native code/message; process remains alive.
    Evidence: .omo/evidence/task-6-native-error.log
  ```

  **Commit**: YES | Message: `feat(native): add ffi transport adapter` | Files: `src/native/**`, `src/transport/native.ts`, `test/native/transport.test.ts`

- [x] 7. Implement Fetch facade with standard body semantics and extensions

  **What to do**: Implement exported `fetch(input, init)` in `src/fetch.ts`. Accept standard `RequestInfo` / `RequestInit` where practical and namespaced extensions for `impersonate`, `tls`, `http2`, `headersOrder`, `proxy`, `timeout`, and `native`. Normalize into `TransportRequest`, enforce one-shot body behavior, preserve extension ordering metadata separately from `Headers`, return a standard-like `Response`, and support `AbortSignal`. Add tests for `text()`, `json()`, body reuse rejection, `Request` input, URL string input, and unsupported browser-only fields (`mode`, `cache`, `integrity`, `referrerPolicy`) with documented no-op or rejection behavior.
  **Must NOT do**: Do not implement CORS/cache/browser security emulation. Do not make bare `fetch()` persist cookies.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: Fetch body semantics are subtle and central.
  - Skills: [] - no special skill needed.
  - Omitted: [`frontend-ui-ux`] - no UI work.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 8, 10, 11 | Blocked By: 1, 5, 6

  **References**:
  - External: WHATWG Fetch body model — bodies are one-shot streams.
  - External: Undici Request streaming — stream upload requires duplex behavior.
  - Pattern: `requests_go/api.py` - public function entrypoint concepts.
  - Guardrail: Metis — Fetch semantics above transport, fingerprint controls below transport.

  **Acceptance Criteria**:
  - [ ] `npm test -- fetch-facade` exits 0.
  - [ ] `await response.text()` works once; second read rejects.
  - [ ] `AbortController` aborts in-flight request with typed abort error.
  - [ ] Advanced options are validated and passed to transport, not dropped.

  **QA Scenarios**:
  ```
  Scenario: Standard text response works once
    Tool: Bash
    Steps: Run `npm test -- fetch-facade --runInBand`.
    Expected: First `response.text()` returns fixture body; second read rejects with body-used error.
    Evidence: .omo/evidence/task-7-body-once.log

  Scenario: Impersonation extension is capability-gated
    Tool: Bash
    Steps: Run test with fake backend lacking JA3 then call `fetch(url, { tls: { ja3: '...' } })`.
    Expected: `UnsupportedCapabilityError`; fake backend network method not called.
    Evidence: .omo/evidence/task-7-extension-gate.log
  ```

  **Commit**: YES | Message: `feat(fetch): add fetch facade` | Files: `src/fetch.ts`, `src/body.ts`, `test/fetch/**`

- [x] 8. Implement Client/Session state for cookies, defaults, redirects, proxy, and lifecycle

  **What to do**: Implement `Client` / `Session` in `src/client.ts` with per-client defaults: headers, cookies, TLSConfig/preset, HTTP2Settings, proxy, timeout, redirect policy, native backend, and cleanup. Add cookie jar semantics: bare exported `fetch()` is stateless by default; `client.fetch()` stores `Set-Cookie` and sends matching cookies on later requests when credentials policy allows it. Implement Fetch-compatible redirect defaults: method conversion for 301/302/303, method preservation for 307/308, max redirects, sensitive header stripping across origins, and preservation of impersonation settings across redirects.
  **Must NOT do**: Do not create an implicit global cookie jar. Do not ignore redirect header stripping.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: session state interacts with Fetch semantics and security-sensitive redirects.
  - Skills: [] - no special skill needed.
  - Omitted: [`frontend-ui-ux`] - no UI work.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 11, 13 | Blocked By: 4, 6, 7

  **References**:
  - Pattern: `requests_go/sessions.py` - session lifecycle, cookies, proxies, verify/cert, adapter selection.
  - Pattern: `requests_go/adapters.py` - proxy routing and response building.
  - Pattern: `example/example_session.py` - session + custom TLS usage.
  - Metis default: global fetch stateless; Client/Session owns cookies.

  **Acceptance Criteria**:
  - [ ] `npm test -- client-session` exits 0.
  - [ ] Two requests through same client persist cookie; bare `fetch()` does not.
  - [ ] Redirect tests pass for 301/302/303/307/308 and cross-origin sensitive header stripping.

  **QA Scenarios**:
  ```
  Scenario: Client cookie jar persists state
    Tool: Bash
    Steps: Run client-session tests against fixture server `/set-cookie` then `/echo-cookie`.
    Expected: `client.fetch()` sends stored cookie on second request; exported `fetch()` sends none.
    Evidence: .omo/evidence/task-8-cookie-jar.log

  Scenario: Redirect policy strips sensitive headers
    Tool: Bash
    Steps: Run redirect fixture from origin A to origin B with `Authorization` and `Cookie` headers.
    Expected: Redirect follows documented policy and strips sensitive headers on cross-origin hop.
    Evidence: .omo/evidence/task-8-redirects.log
  ```

  **Commit**: YES | Message: `feat(fetch): add client session state` | Files: `src/client.ts`, `src/cookies.ts`, `src/redirects.ts`, `test/client/**`

- [x] 9. Map advanced TLS, JA3/JA4, HTTP/2, and header-order options to native wire payloads

  **What to do**: Implement `src/impersonation/serialize.ts` that turns `fetch()` extensions and `Client` defaults into the exact native payload expected by the FFI transport. Include browser presets, custom JA3, `randomJa3`, JA4 header controls, `forceHttp1`, ALPN-related fields if supported, TLS extensions, `clientHelloHexStream`, HTTP/2 settings, settings order, connection flow, header priority, priority frames, pseudo-header order, header order, and unchanged header keys. Add snapshot tests for Chrome, Firefox, custom README TLSConfig, JA4, and random JA3.
  **Must NOT do**: Do not rely on ordinary `Headers` iteration for wire ordering. Do not silently omit unknown TLS/HTTP2 fields.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: this task preserves the library's core anti-fingerprint value.
  - Skills: [] - no special skill needed.
  - Omitted: [`frontend-ui-ux`] - no UI work.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 11 | Blocked By: 4, 5, 6

  **References**:
  - Pattern: `requests_go/tls_config/config.py` - preset and TLSConfig fields.
  - Pattern: `requests_go/tls_config/extensions.py` - HTTP2Settings and extension fields.
  - Pattern: `requests_go/tls_client/request.py` - native parameter assembly.
  - Pattern: `example/ja4.py` - JA4 header order and unchanged key usage.
  - Pattern: `example/client_hello_hex_stream_test.py` - raw ClientHello hex behavior.
  - Pattern: `README.md` - warns `content-length` should not be manually set and explains pseudo-header order for HTTP/2.

  **Acceptance Criteria**:
  - [ ] `npm test -- impersonation-serialize` exits 0.
  - [ ] Snapshot payloads include every supported TLS/HTTP2 field with native naming.
  - [ ] Unknown advanced option throws validation error instead of being dropped.
  - [ ] Manual `content-length` is rejected or overwritten according to documented policy.

  **QA Scenarios**:
  ```
  Scenario: Chrome preset payload includes TLS and HTTP/2 impersonation fields
    Tool: Bash
    Steps: Run `npm test -- impersonation-serialize --runInBand`.
    Expected: Snapshot contains preset, JA3/JA4-related fields, pseudo-header order, HTTP/2 settings order, and ordered headers.
    Evidence: .omo/evidence/task-9-chrome-payload.snap

  Scenario: Unknown option fails validation
    Tool: Bash
    Steps: Run serialization test with `tls: { madeUpField: true }`.
    Expected: Throws typed validation error naming `madeUpField`; native transport not called.
    Evidence: .omo/evidence/task-9-unknown-option.log
  ```

  **Commit**: YES | Message: `feat(impersonation): serialize tls http2 payloads` | Files: `src/impersonation/serialize.ts`, `test/impersonation/serialize.test.ts`, `test/fixtures/**`

- [x] 10. Implement abort, timeout, typed errors, and resource cleanup policy

  **What to do**: Implement typed errors in `src/errors.ts`: `AbortError`, `TimeoutError`, `NativeTransportError`, `NativeAssetNotFoundError`, `NativeAbiUnavailableError`, `UnsupportedCapabilityError`, `FetchBodyUsedError`, and validation errors. Wire `AbortSignal` and timeout into Fetch facade, Client, and native transport. Ensure abort before start, during TLS handshake, during upload, during response body, and after completion all have deterministic cleanup. Add tests for all phases using fixture server and native/mock transport.
  **Must NOT do**: Do not leave native handles open after abort or stream errors. Do not convert all failures into generic `Error`.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: errors and cleanup affect reliability across every API.
  - Skills: [] - no special skill needed.
  - Omitted: [`frontend-ui-ux`] - no UI work.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 11, 12 | Blocked By: 5, 6, 7

  **References**:
  - Pattern: `requests_go/tls_client/exceptions.py` - native exception concepts.
  - Pattern: `requests_go/tls_client/stream.py` - stream close behavior.
  - External: WHATWG Fetch/Undici abort and body lifecycle semantics.
  - Metis edge cases: abort before request, during TLS handshake, during upload, during response body.

  **Acceptance Criteria**:
  - [ ] `npm test -- errors-abort` exits 0.
  - [ ] Abort tests cover before start, in-flight, mid-stream, and post-completion.
  - [ ] Timeout test produces `TimeoutError` and closes transport handle.

  **QA Scenarios**:
  ```
  Scenario: Abort mid-stream closes native resource
    Tool: Bash
    Steps: Run `npm test -- errors-abort --runInBand` against slow streaming fixture.
    Expected: Request rejects with `AbortError`; cleanup spy confirms native close called once.
    Evidence: .omo/evidence/task-10-abort-midstream.log

  Scenario: Timeout during handshake/request is typed
    Tool: Bash
    Steps: Run test with fixture delay greater than configured timeout.
    Expected: Throws `TimeoutError`; no unhandled rejection; native handle closed.
    Evidence: .omo/evidence/task-10-timeout.log
  ```

  **Commit**: YES | Message: `feat(fetch): add abort timeout and typed errors` | Files: `src/errors.ts`, `src/timeout.ts`, `test/errors/**`

- [x] 11. Build fixture and fingerprint/protocol verification suite

  **What to do**: Add tests under `test/fingerprint/` and fixture server under `test/fixtures/server.ts`. Cover local Fetch behavior with fixture endpoints and real fingerprint smoke with `https://tls.peet.ws/api/all` or a local capture harness if available. Validate JA3, JA4-related response fields, HTTP version, HTTP/2 settings/order where observable, ALPN/protocol metadata, header order, pseudo-header order, proxy behavior, cookies, redirects, binary body, non-UTF8 body, compressed response, large response streaming, and large upload policy.
  **Must NOT do**: Do not require human visual inspection of fingerprint output. Do not make all tests depend on external network; separate unit/fixture tests from smoke tests.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: test design must distinguish deterministic CI tests from network smoke tests.
  - Skills: [] - no special skill needed.
  - Omitted: [`frontend-ui-ux`] - no UI work.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: 12 | Blocked By: 1, 6, 7, 8, 9, 10

  **References**:
  - Pattern: `example/tls_config_test.py`, `example/random_ja3.py`, `example/ja4.py`, `example/stream_test.py`, `example/post_json.py`, `example/post_data.py`, `example/post_bytes.py` - smoke baseline.
  - Existing remote endpoints from examples: `https://tls.peet.ws/api/all`, `https://httpbin.org/post`.
  - Metis directive: fingerprint tests must inspect JA3/JA4, ALPN, HTTP version, H2 settings, and header ordering.

  **Acceptance Criteria**:
  - [ ] `npm test` exits 0 without external network.
  - [ ] `npm run test:fingerprint` exits 0 when network is available and records parsed fingerprint JSON.
  - [ ] Fingerprint tests assert expected fields for at least Chrome and Firefox presets and one custom config.

  **QA Scenarios**:
  ```
  Scenario: Local fixture suite is deterministic
    Tool: Bash
    Steps: Run `npm test -- --runInBand` with network disabled/unneeded.
    Expected: Unit and fixture tests pass without contacting external endpoints.
    Evidence: .omo/evidence/task-11-fixture-tests.log

  Scenario: Real fingerprint smoke validates impersonation
    Tool: Bash
    Steps: Run `npm run test:fingerprint`.
    Expected: Parsed response includes JA3/JA4/protocol fields; assertions pass for Chrome, Firefox, and custom HTTP/2 settings fixtures.
    Evidence: .omo/evidence/task-11-fingerprint.json
  ```

  **Commit**: YES | Message: `test(fetch): add fingerprint protocol suite` | Files: `test/fingerprint/**`, `test/fixtures/**`, `package.json`

- [x] 12. Add CI, package validation, and native binary checks

  **What to do**: Add CI workflow that runs install, build, typecheck, lint, tests, package consumption, and native asset resolution on supported OS/arch runners available from current asset scope. Include optional/manual fingerprint smoke job because it uses real network. Add `npm pack --dry-run` validation to ensure native assets are included and unsupported assets are not invented. Add checksum or file-size sanity checks for bundled native assets.
  **Must NOT do**: Do not add CI matrix entries for unsupported platforms. Do not make external fingerprint smoke a mandatory offline unit-test dependency.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: CI and native packaging prevent broken npm releases.
  - Skills: [] - no special skill needed.
  - Omitted: [`git-master`] - no commit/history operation needed unless user explicitly asks.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: 13 | Blocked By: 1, 2, 5, 10, 11

  **References**:
  - Current finding: no `.github/workflows` or formal CI exists.
  - Pattern: `requests_go/tls_client/dependencies/*` - native assets to package.
  - Acceptance from Metis: verify ESM, CJS, TypeScript declarations, and native binary resolution in CI.

  **Acceptance Criteria**:
  - [ ] `npm run ci:local` exits 0 and runs build/typecheck/lint/test/package checks.
  - [ ] `npm pack --dry-run` output includes TypeScript build outputs and required native assets.
  - [ ] CI workflow has mandatory offline jobs and optional fingerprint smoke job.

  **QA Scenarios**:
  ```
  Scenario: Local CI script passes
    Tool: Bash
    Steps: Run `npm run ci:local`.
    Expected: Build, typecheck, lint, tests, package import tests, and native asset checks all pass.
    Evidence: .omo/evidence/task-12-ci-local.log

  Scenario: Package contains native assets
    Tool: Bash
    Steps: Run `npm pack --dry-run --json` and inspect file list.
    Expected: ESM/CJS/d.ts outputs and existing native assets are included; no unsupported generated binaries appear.
    Evidence: .omo/evidence/task-12-pack-files.json
  ```

  **Commit**: YES | Message: `ci(node): add package and native verification` | Files: `.github/workflows/**`, `package.json`, `scripts/**`, `test/package/**`

- [x] 13. Add examples, migration notes, and release guardrails

  **What to do**: Add examples mirroring current Python examples in Node: basic GET, Client/Session cookies, custom TLSConfig, Chrome preset, random JA3, JA4 headers, POST JSON/data/bytes, streaming, proxy, and HTTP/2 settings. Add README section for Node package usage, explicit unsupported scope, capability matrix usage, no-silent-degradation behavior, native asset support, and security/ethics warning. Add migration notes from Python `requests_go` to Node Fetch facade.
  **Must NOT do**: Do not claim strict browser equivalence beyond tested fingerprint assertions. Do not document unsupported platforms or features as available.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: documentation and examples must be precise and user-facing.
  - Skills: [] - no special skill needed.
  - Omitted: [`frontend-ui-ux`] - no UI work.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: none | Blocked By: 1, 8, 12

  **References**:
  - Pattern: `README.md` - current Chinese documentation and feature descriptions.
  - Pattern: `example/*.py` - source examples to mirror in TypeScript.
  - Guardrail: no unsupported-platform claims; no silent degradation.

  **Acceptance Criteria**:
  - [ ] `npm run examples:smoke` exits 0 for non-network examples and prints command list for network examples.
  - [ ] README documents `fetch()` extensions and `Client` usage with concrete code snippets.
  - [ ] README includes capability matrix and native asset platform limitations.

  **QA Scenarios**:
  ```
  Scenario: Examples compile and smoke-run
    Tool: Bash
    Steps: Run `npm run build && npm run examples:smoke`.
    Expected: Local/non-network examples execute; network examples are listed and skipped unless `RUN_NETWORK=1` is set.
    Evidence: .omo/evidence/task-13-examples.log

  Scenario: Docs do not overclaim unsupported capability
    Tool: Bash
    Steps: Grep README and examples for unsupported platform claims and silent fallback language.
    Expected: No text claims pure JS/Undici impersonation fallback; docs say unsupported capability throws typed error.
    Evidence: .omo/evidence/task-13-doc-guardrails.log
  ```

  **Commit**: YES | Message: `docs(node): add fetch port examples` | Files: `examples/node/**`, `README.md`, `docs/**`, `package.json`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE with evidence files before technical verification passes. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [x] F1. Plan Compliance Audit — oracle

  **Tool**: task subagent `oracle`
  **Steps**: Review `.omo/plans/node-fetch-port.md` against the completed implementation diff, evidence files, and confirmed decisions. Verify every task acceptance criterion has matching evidence and no implementation silently downgraded impersonation.
  **Expected**: Oracle returns `APPROVED` with no critical findings; any `NO-GO` requires fixes and re-running F1-F4.
  **Evidence**: `.omo/evidence/final-f1-plan-compliance.md`

- [x] F2. Code Quality Review — unspecified-high

  **Tool**: task category `unspecified-high`
  **Steps**: Inspect TypeScript API design, FFI/native binding code, error handling, package exports, tests, and CI config. Run `npm run ci:local` and inspect changed files for duplication, unsafe native lifecycle, and type holes.
  **Expected**: Reviewer returns `APPROVED`; `npm run ci:local` exits 0; no unhandled native resource leaks, silent fallbacks, or public API type gaps remain.
  **Evidence**: `.omo/evidence/final-f2-code-quality.md`

- [x] F3. Real Manual QA — unspecified-high

  **Tool**: task category `unspecified-high` using Bash and network smoke commands
  **Steps**: Execute package consumption smoke, local examples, and `RUN_NETWORK=1 npm run test:fingerprint` on a supported native platform. Capture JA3/JA4/protocol JSON for Chrome, Firefox, and custom HTTP/2 settings.
  **Expected**: All commands exit 0; fingerprint JSON contains asserted JA3/JA4/protocol fields; missing network is reported only as an environment failure, not a product pass.
  **Evidence**: `.omo/evidence/final-f3-real-qa.md` and `.omo/evidence/final-f3-fingerprint.json`

- [x] F4. Scope Fidelity Check — deep

  **Tool**: task category `deep`
  **Steps**: Compare final implementation against the original scope: Fetch facade + native FFI backend, existing assets only, full HTTP/2 impersonation v1, ESM+CJS TypeScript package, Client/Session plus fetch extensions, full CI/fingerprint tests. Search for scope creep: browser CORS/cache emulation, unsupported platforms, pure JS impersonation fallback, Python requests parity overreach.
  **Expected**: Reviewer returns `APPROVED`; any scope creep is either removed or explicitly documented as out-of-scope before completion.
  **Evidence**: `.omo/evidence/final-f4-scope-fidelity.md`


## Commit Strategy
- Commit per execution wave if repository policy allows commits; otherwise leave changes unstaged and summarize.
- Suggested commits:
  - `feat(node): scaffold fetch port package`
  - `feat(native): add requests-go ffi transport`
  - `feat(fetch): add client session and impersonation api`
  - `test(node): add fingerprint and packaging verification`

## Success Criteria
- A Node consumer can call standard-like `fetch()` and receive a `Response`.
- A Node consumer can call `fetch(url, { impersonate: { preset: "chrome-latest" }, http2: {...} })` and observe expected JA3/JA4/H2 settings.
- A `Client` instance persists cookies across requests; bare exported `fetch()` does not persist cookies unless explicitly configured.
- Missing native assets or unsupported capabilities fail loudly with typed errors.
- ESM, CJS, and TypeScript declarations all work in clean package-consumption tests.
