# owned-native-backend Specification

## Purpose
TBD - created by archiving change phase-1-owned-requests-backend. Update Purpose after archive.
## Requirements
### Requirement: Source-owned native backend
The system SHALL provide a Go native backend source package at `packages/native-backend` that can build the native request engine from source without relying on closed prebuilt upstream artifacts.

#### Scenario: Native backend builds from source
- **WHEN** the backend build command is run for a supported host platform
- **THEN** the system produces a native dynamic library or executable artifact compatible with the Node native loader for that platform
- **AND** the source is located at `packages/native-backend`

#### Scenario: Closed artifact is not required for backend build
- **WHEN** the Go backend source build runs in CI
- **THEN** the build MUST NOT require any closed native binary as an input
- **AND** CI uses GitHub Actions Matrix to build across all supported platforms in parallel

### Requirement: Existing ABI compatibility
The source-owned backend SHALL export the same Phase 1 native ABI expected by the current Node binding layer: `request`, `stream_request`, `stream_read`, `stream_close`, and `freeMemory`.

#### Scenario: ABI symbols are present
- **WHEN** the built backend artifact is inspected by the native binding smoke test
- **THEN** all required Phase 1 symbols are available to direct FFI or shim loading

#### Scenario: Request payload remains compatible
- **WHEN** Node sends an existing `NativeRequestPayload` JSON payload to the source-owned backend
- **THEN** the backend accepts the payload without requiring a Node-side schema change

### Requirement: Buffered request parity
The source-owned backend SHALL return buffered response payloads using the current response JSON shape, including `id`, `url`, `status_code`, `headers`, `cookies`, `content`, `raw`, and `err` semantics where applicable.

#### Scenario: Successful buffered request
- **WHEN** a valid non-streaming request completes successfully
- **THEN** the backend returns response metadata and base64-encoded response content using the current `NativeResponsePayload` shape

#### Scenario: Buffered request error
- **WHEN** request construction or transport execution fails
- **THEN** the backend returns or raises an error compatible with the current native error mapping behavior

### Requirement: Streaming lifecycle parity
The source-owned backend SHALL support the existing streaming lifecycle: open stream, read chunks, report EOF, and close stream.

#### Scenario: Stream opens successfully
- **WHEN** Node sends a streaming request payload
- **THEN** the backend returns `stream_id`, `url`, `status_code`, `headers`, and `cookies` without buffering the full response body

#### Scenario: Stream reads chunks
- **WHEN** Node calls `stream_read` with a valid `stream_id` and positive chunk size
- **THEN** the backend returns a base64-encoded chunk in `data` or an empty chunk when no bytes are read

#### Scenario: Stream reaches EOF
- **WHEN** the underlying response body reaches end-of-file
- **THEN** the backend returns `eof: true` using the current stream read payload semantics

#### Scenario: Stream closes
- **WHEN** Node calls `stream_close` for an open stream
- **THEN** the backend closes the underlying response body and releases stream-associated resources

### Requirement: Native memory cleanup parity
The source-owned backend SHALL preserve the current response memory cleanup protocol used by the Node binding layer.

#### Scenario: Buffered response memory is freed
- **WHEN** Node calls `freeMemory` with a response id returned by `request`
- **THEN** the backend releases the stored C string pointer associated with that id

#### Scenario: Stream read memory is replaced safely
- **WHEN** Node calls `stream_read` repeatedly for the same stream
- **THEN** the backend releases the previous read-result C string before storing the next read-result pointer

#### Scenario: Closing stream releases stream pointers
- **WHEN** Node calls `stream_close` for a stream that has returned metadata or read results
- **THEN** the backend releases stored pointers associated with the stream id and read-result key

### Requirement: Differential oracle verification
The system SHALL include tests that compare the source-owned backend against the current closed backend for Phase 1 compatibility, while keeping the closed backend oracle outside the main package runtime bundle.

#### Scenario: ABI contract comparison passes
- **WHEN** deterministic ABI contract tests run against both backends
- **THEN** request, stream, close, and free-memory behavior produce compatible results for the same fixtures

#### Scenario: Parity differences are recorded
- **WHEN** a differential test identifies a behavioral difference
- **THEN** the difference is recorded as either a bug to fix or an explicit compatibility decision before default backend switching

#### Scenario: Closed backend oracle is test-only
- **WHEN** the main `impersonated-fetch` package is packed
- **THEN** closed backend oracle binaries are absent from the main package artifact
- **AND** differential tests load the closed oracle from a test fixture path or explicit environment variable instead of `packages/impersonated-fetch/native/*`

### Requirement: Platform backend package generation
The system SHALL generate scoped platform-specific npm backend packages from compiled artifacts during
CI/release flow using artifacts produced by the GitHub Actions Matrix builds, and those generated
packages SHALL be published as part of the npm release so they are the production native artifact
source for the main package.

#### Scenario: Platform package is generated
- **WHEN** release packaging runs for a supported platform target
- **THEN** the system generates a scoped npm package such as `@impersonated-fetch/backend-linux-x64` containing the corresponding backend artifact and package metadata
- **AND** packages are generated from CI artifacts produced by the matrix build workflow

#### Scenario: Platform package is published to npm
- **WHEN** the npm release workflow publishes a release version
- **THEN** each generated scoped backend package for the supported platform matrix is published to npm with that release version
- **AND** the release version matches the main `impersonated-fetch` package version

#### Scenario: Main package remains pure JavaScript
- **WHEN** the main `impersonated-fetch` npm package at `packages/impersonated-fetch` is packed
- **THEN** it contains JavaScript/TypeScript build output and metadata but does not directly bundle any platform backend binaries

### Requirement: GitHub Actions Matrix build support
The system SHALL support parallel cross-platform builds via GitHub Actions Matrix for Linux (x64, x32, ARM64), macOS (x64, ARM64), and Windows (x64, x32, ARM64).

#### Scenario: CI builds native artifacts for all platforms
- **WHEN** the CI workflow triggers a native backend build
- **THEN** a matrix job runs in parallel for each platform/architecture combination
- **AND** each job produces a platform-specific artifact
- **AND** artifacts are uploaded for subsequent release packaging steps

#### Scenario: Matrix build includes all supported targets
- **WHEN** contributors inspect the CI configuration
- **THEN** they see matrix entries for:
  - `linux-x64`
  - `linux-x32` (Linux 32-bit)
  - `linux-arm64`
  - `darwin-x64` (macOS Intel)
  - `darwin-arm64` (macOS Apple Silicon)
  - `win32-x64` (Windows 64-bit)
  - `win32-x32` (Windows 32-bit)
  - `win32-arm64` (Windows ARM64)

### Requirement: Runtime backend resolution
The Node package SHALL resolve the correct generated backend package for the current platform and architecture while preserving existing explicit backend path overrides and without falling back to bundled main-package native binaries.

#### Scenario: Matching backend package is installed
- **WHEN** the package runs on a supported platform with its matching scoped backend package installed
- **THEN** the loader resolves and uses that backend artifact

#### Scenario: Backend package is missing
- **WHEN** the matching scoped backend package is unavailable and no explicit backend override or source-built development artifact is configured
- **THEN** the loader fails with a clear native asset error naming the expected scoped backend package or artifact
- **AND** it does not fall back to `packages/impersonated-fetch/native/*`

#### Scenario: Explicit backend override is provided
- **WHEN** an explicit backend path or shim command is configured
- **THEN** the loader uses the configured backend path according to the existing override behavior

#### Scenario: Source-built development artifact is present
- **WHEN** a monorepo checkout has a matching artifact under `packages/native-backend/dist`
- **THEN** the loader can use that source-built artifact for local development before resolving generated scoped backend packages

#### Scenario: Installed backend package is broken
- **WHEN** the matching scoped backend package is installed but its native artifact is missing
- **THEN** the loader fails with a clear native asset error
- **AND** it does not silently degrade to a different backend implementation

### Requirement: Transitional dependency boundary
The Phase 1 backend SHALL treat `wangluozhe/requests` as a transitional backend implementation detail, not as the final native architecture.

#### Scenario: Phase 1 dependency is documented
- **WHEN** contributors inspect the Phase 1 backend documentation or design notes
- **THEN** they can see that `wangluozhe/requests` is used for compatibility and is expected to be refactored away in Phase 2

#### Scenario: Release is blocked on license decision
- **WHEN** public release artifacts would include or depend on `wangluozhe/requests`
- **THEN** the release process requires an explicit license/shipping approval decision before publishing

### Requirement: Pseudocode-guided wrapper behavior
The Phase 1 backend SHALL use the extracted IDA pseudocode files under `refs/psuedocodes/` as implementation references for observable wrapper behavior while validating compatibility through tests.

#### Scenario: Exported function reference mapping is documented
- **WHEN** contributors inspect the Phase 1 backend implementation notes
- **THEN** they can map each exported ABI function to its corresponding pseudocode reference file

#### Scenario: Wrapper lifecycle follows observed behavior
- **WHEN** the backend implements response id storage, stream pool management, stream read replacement, or memory cleanup
- **THEN** the implementation uses the pseudocode-derived lifecycle as a checklist and verifies behavior with contract or differential tests

#### Scenario: Pseudocode conflicts with tests
- **WHEN** pseudocode-derived behavior conflicts with runnable oracle or contract tests
- **THEN** the implementation treats the executable test result as authoritative and records the compatibility decision
