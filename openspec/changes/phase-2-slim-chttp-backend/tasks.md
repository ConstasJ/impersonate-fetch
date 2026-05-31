## 1. Phase 1 Baseline Validation

- [ ] 1.1 Verify Phase 1 artifacts exist: Nx monorepo projects, unified Go backend, generated backend package workflow, and contract tests
- [ ] 1.2 Capture Phase 1 self-built backend artifacts or fixtures as the Phase 2 parity baseline
- [ ] 1.3 Inventory current Phase 1 `wangluozhe/requests` behavior used by Node-facing APIs
- [ ] 1.4 Classify each inventoried behavior as Node-owned policy or native-owned wire mechanic

## 2. Node-Owned Policy Coverage

- [ ] 2.1 Add or strengthen Node redirect policy tests independent of Go `requests` automatic redirects
- [ ] 2.2 Add or strengthen Node cookie/session policy tests independent of Go `requests` session behavior
- [ ] 2.3 Add or strengthen Node timeout and AbortSignal policy tests independent of Go `requests` timeout handling
- [ ] 2.4 Add or strengthen Node error mapping tests for native transport failures after direct `chttp` refactor
- [ ] 2.5 Add a body/decompression ownership audit and decide which behavior remains native during Phase 2

## 3. Direct chttp Backend Refactor

- [ ] 3.1 Select the external `chttp` Go module path/version to consume for Phase 2
- [ ] 3.2 Replace production request construction that currently uses `wangluozhe/requests` with direct `chttp` request construction
- [ ] 3.3 Map existing native payload fields to direct `chttp` transport/request fields
- [ ] 3.4 Apply TLS fingerprint controls through `chttp`/uTLS mechanisms
- [ ] 3.5 Apply HTTP/2 settings, settings order, flow/window, and pseudo-header controls through `chttp`
- [ ] 3.6 Apply header order and unchanged header casing controls through `chttp`
- [ ] 3.7 Preserve low-level proxy transport behavior where it affects the wire transaction

## 4. Streaming and Resource Lifecycle

- [ ] 4.1 Preserve Phase 1 stream open response shape while using direct `chttp` response bodies
- [ ] 4.2 Preserve Phase 1 `stream_read` base64 chunk and EOF behavior
- [ ] 4.3 Preserve Phase 1 `stream_close` response body and stream resource cleanup behavior
- [ ] 4.4 Preserve native pointer/string cleanup behavior required by the Node binding layer

## 5. Dependency and Packaging Continuity

- [ ] 5.1 Remove `wangluozhe/requests` from the production backend dependency graph after direct `chttp` path passes tests
- [ ] 5.2 Keep the unified Go backend as the only production backend project in the Nx graph
- [ ] 5.3 Preserve generated scoped platform backend package names and package metadata shape
- [ ] 5.4 Verify the pure JavaScript main package still resolves generated backend packages at runtime
- [ ] 5.5 Confirm the separate `chttp` repository is consumed as an external dependency and not vendored as a monorepo source project

## 6. Phase 1 vs Phase 2 Verification

- [ ] 6.1 Add buffered request parity tests comparing Phase 1 and Phase 2 backend behavior
- [ ] 6.2 Add streaming parity tests comparing Phase 1 and Phase 2 open/read/EOF/close behavior
- [ ] 6.3 Add TLS fingerprint parity fixtures for JA3, random JA3, TLS extension, and ClientHello-related controls
- [ ] 6.4 Add HTTP/2 parity fixtures for settings, settings order, flow/window controls, and pseudo-header order
- [ ] 6.5 Add header ordering parity fixtures for normal header order and unchanged header casing
- [ ] 6.6 Record all accepted compatibility differences with rationale and test coverage

## 7. CI, Documentation, and Migration Completion

- [ ] 7.1 Update Nx affected targets so Go backend changes run Phase 2 parity checks and package validation
- [ ] 7.2 Document the Phase 2 native boundary: Node owns policy, native owns wire mechanics
- [ ] 7.3 Document rollback to the last Phase 1 backend artifact during Phase 2 validation
- [ ] 7.4 Update contributor documentation to state that `wangluozhe/requests` is no longer production backend architecture after Phase 2
- [ ] 7.5 Document the remaining Phase 3 path toward the authorized Go `net/http` patch stack
