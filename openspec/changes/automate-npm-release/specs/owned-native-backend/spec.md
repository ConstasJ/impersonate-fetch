## MODIFIED Requirements

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
