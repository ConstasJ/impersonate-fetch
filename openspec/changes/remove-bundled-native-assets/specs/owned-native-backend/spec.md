## MODIFIED Requirements

### Requirement: Platform backend package generation
The system SHALL generate scoped platform-specific npm backend packages from compiled artifacts during CI/release flow using artifacts produced by the GitHub Actions Matrix builds, and those generated packages SHALL be the production native artifact source for the main package.

#### Scenario: Platform package is generated
- **WHEN** release packaging runs for a supported platform target
- **THEN** the system generates a scoped npm package such as `@impersonated-fetch/backend-linux-x64` containing the corresponding backend artifact and package metadata
- **AND** packages are generated from CI artifacts produced by the matrix build workflow

#### Scenario: Main package remains pure JavaScript
- **WHEN** the main `impersonated-fetch` npm package at `packages/impersonated-fetch` is packed
- **THEN** it contains JavaScript/TypeScript build output and metadata but does not directly bundle any platform backend binaries

#### Scenario: Generated backend package contains the native artifact
- **WHEN** generated backend package validation runs for a supported target
- **THEN** the package contains exactly the expected `impersonated-fetch-backend-<target>.<ext>` artifact
- **AND** the package metadata declares matching `os` and `cpu` restrictions for that target

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
