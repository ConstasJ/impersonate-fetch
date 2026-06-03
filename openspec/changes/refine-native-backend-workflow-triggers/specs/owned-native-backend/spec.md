## MODIFIED Requirements

### Requirement: GitHub Actions Matrix build support
The system SHALL support parallel cross-platform builds via GitHub Actions Matrix for Linux (x64, x32, ARM64), macOS (x64, ARM64), and Windows (x64, x32, ARM64), and trusted full-matrix artifact production SHALL be limited to explicit manual dispatch or path-filtered changes on the default branch.

#### Scenario: Trusted runs build native artifacts for all platforms
- **WHEN** the native backend workflow runs from `workflow_dispatch` or from a path-filtered push to `master`
- **THEN** a matrix job runs in parallel for each platform/architecture combination
- **AND** each job produces a platform-specific artifact
- **AND** artifacts are uploaded for subsequent release packaging steps

#### Scenario: Pull requests avoid broad release-candidate artifact production
- **WHEN** a pull request changes only general JavaScript package files, root package metadata, or dependency lockfiles
- **THEN** the native backend full artifact matrix is not required to run automatically for that pull request
- **AND** ordinary CI remains responsible for package, host native backend, and OS compatibility validation

#### Scenario: Matrix build includes all supported targets
- **WHEN** contributors inspect the trusted native backend workflow configuration
- **THEN** they see matrix entries for:
  - `linux-x64`
  - `linux-x32` (Linux 32-bit)
  - `linux-arm64`
  - `darwin-x64` (macOS Intel)
  - `darwin-arm64` (macOS Apple Silicon)
  - `win32-x64` (Windows 64-bit)
  - `win32-x32` (Windows 32-bit)
  - `win32-arm64` (Windows ARM64)
