## Why

Phase 1 establishes a source-owned native backend and Nx monorepo while intentionally preserving the existing `requests`-based wrapper behavior. Phase 2 removes that transitional duplicated HTTP-client layer by refactoring the same Go backend lineage into a slim `chttp`-based transport where Node owns Fetch/client policy and native owns fingerprint-sensitive wire mechanics.

## What Changes

- Refactor the unified Phase 1 Go backend to remove direct `wangluozhe/requests` orchestration from the production request path.
- Implement native request/response/stream execution directly on `chttp` while preserving the Node-facing backend package and runtime loading model introduced in Phase 1.
- Define a slimmer native responsibility boundary: one wire transaction, response metadata/body stream, TLS ClientHello controls, HTTP/2 settings/order controls, header/pseudo-header ordering, and low-level proxy mechanics when required.
- Move or confirm high-level HTTP client policy in Node: Fetch semantics, Request/Response/Headers/Body abstractions, cookies/session policy, redirects, validation, errors, timeout/AbortSignal policy, and body normalization where feasible.
- Reuse Phase 1 contract/differential tests as a compatibility baseline, but compare Phase 2 primarily against Phase 1 self-built behavior instead of the closed binary.
- Keep the Nx monorepo, generated scoped backend packages, and single unified backend lineage from Phase 1.
- Keep `chttp` as an external Go module/repository; do not vendor the future `chttp` fork repository into this monorepo.
- No public Fetch API breaking changes are intended.

## Capabilities

### New Capabilities
- `slim-native-transport`: `chttp`-based native transport boundary, Node-owned client policy, transport-level fingerprint controls, and Phase 1 parity verification.

### Modified Capabilities
- None.

## Impact

- Depends on Phase 1 outputs: Nx monorepo structure, unified Go backend source, generated scoped backend package workflow, ABI/contract tests, and source-built backend artifacts.
- Affects the Go backend internals by replacing `wangluozhe/requests` usage with direct `chttp` usage.
- Affects Node policy ownership where behavior previously depended on the Go `requests` layer.
- Affects test strategy by adding Phase 1-vs-Phase 2 parity checks and Node-owned policy tests for redirects, cookies/session, timeout/abort, and body behavior.
- Reduces Phase 1 licensing exposure by removing `wangluozhe/requests` from the production backend path, while retaining `chttp` as the Phase 2 substrate.
