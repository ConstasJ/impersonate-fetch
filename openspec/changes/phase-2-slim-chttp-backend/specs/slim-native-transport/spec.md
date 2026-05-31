## ADDED Requirements

### Requirement: Direct chttp production path
The Phase 2 backend SHALL execute production request and stream operations directly through `chttp` without depending on `wangluozhe/requests` as the production request orchestration layer.

#### Scenario: Requests dependency removed from production path
- **WHEN** the Phase 2 backend builds for production
- **THEN** request execution does not call `wangluozhe/requests` session or request orchestration APIs

#### Scenario: chttp executes wire transaction
- **WHEN** Node sends a normalized native transaction payload
- **THEN** the backend constructs and executes the wire transaction through `chttp` transport primitives

### Requirement: Unified backend lineage
The Phase 2 backend SHALL refactor the Phase 1 backend lineage rather than introduce a second production backend family.

#### Scenario: One production backend project exists
- **WHEN** contributors inspect the Nx project graph after Phase 2
- **THEN** there is one production Go backend project for native artifact generation

#### Scenario: Phase 1 behavior remains test baseline
- **WHEN** Phase 2 compatibility tests run
- **THEN** they compare Phase 2 behavior against Phase 1 self-built backend fixtures or artifacts

### Requirement: Node-owned client policy
The system SHALL keep high-level HTTP client policy in Node unless native participation is required for fingerprint-sensitive wire behavior.

#### Scenario: Redirect policy is Node-owned
- **WHEN** a response requires redirect handling
- **THEN** Node applies the redirect policy rather than relying on `chttp` or `requests` automatic redirect behavior

#### Scenario: Cookie/session policy is Node-owned
- **WHEN** a response includes cookies or a subsequent request needs cookies
- **THEN** Node updates and applies the cookie/session policy through the existing Node client layer

#### Scenario: Timeout and abort policy is Node-owned
- **WHEN** a request is aborted or times out through the Fetch API
- **THEN** Node coordinates cancellation and maps errors according to the public API contract

### Requirement: Native-owned fingerprint mechanics
The native backend SHALL own only transport mechanics that require low-level wire control.

#### Scenario: TLS fingerprint controls are native-owned
- **WHEN** a payload specifies JA3, random JA3, TLS extensions, or ClientHello-related controls
- **THEN** the native backend applies those controls through `chttp`/uTLS mechanisms

#### Scenario: HTTP/2 fingerprint controls are native-owned
- **WHEN** a payload specifies HTTP/2 settings, settings order, flow/window controls, or pseudo-header order
- **THEN** the native backend applies those controls through `chttp` HTTP/2 mechanisms

#### Scenario: Header order controls are native-owned
- **WHEN** a payload specifies header order or unchanged header key casing
- **THEN** the native backend preserves those wire-level header controls through `chttp`

### Requirement: Stable Node-facing backend protocol
The Phase 2 refactor SHALL preserve the Node-facing request/response/stream protocol unless an explicit compatibility decision is recorded.

#### Scenario: Buffered response shape remains stable
- **WHEN** a buffered request succeeds through the Phase 2 backend
- **THEN** Node receives response metadata and base64 body content compatible with the Phase 1 response payload shape

#### Scenario: Stream lifecycle remains stable
- **WHEN** Node opens, reads, and closes a stream through the Phase 2 backend
- **THEN** stream metadata, chunk, EOF, and close semantics remain compatible with Phase 1 behavior

#### Scenario: Compatibility exception is recorded
- **WHEN** Phase 2 intentionally changes behavior from Phase 1
- **THEN** the change is recorded with rationale and corresponding tests before becoming default behavior

### Requirement: Phase 1 parity verification
The Phase 2 backend SHALL include compatibility tests that compare Phase 2 behavior with the Phase 1 source-owned backend.

#### Scenario: Buffered parity passes
- **WHEN** deterministic buffered request fixtures run against Phase 1 and Phase 2 backends
- **THEN** public response behavior is compatible or differences are explicitly recorded

#### Scenario: Streaming parity passes
- **WHEN** deterministic streaming fixtures run against Phase 1 and Phase 2 backends
- **THEN** stream open, read, EOF, and close behavior is compatible or differences are explicitly recorded

#### Scenario: Fingerprint parity passes
- **WHEN** fingerprint fixtures run for TLS, HTTP/2 settings/order, and header ordering controls
- **THEN** Phase 2 produces behavior compatible with Phase 1 for supported controls

### Requirement: Packaging continuity
The Phase 2 backend SHALL continue using the Nx monorepo and generated scoped platform backend package model introduced in Phase 1.

#### Scenario: Generated package names remain stable
- **WHEN** Phase 2 release packaging runs
- **THEN** it generates the same scoped platform backend package names used by Phase 1

#### Scenario: Main package remains pure JavaScript
- **WHEN** the main package is packed after Phase 2
- **THEN** it remains a pure JavaScript/TypeScript package that resolves platform backend packages at runtime

#### Scenario: chttp is external
- **WHEN** contributors inspect the monorepo after Phase 2
- **THEN** the separate `chttp` fork repository is not vendored as a source project inside this monorepo
