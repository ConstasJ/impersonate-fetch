## ADDED Requirements

### Requirement: npm release workflow
The system SHALL provide a GitHub Actions workflow at `.github/workflows/release.yml` that publishes
the `impersonated-fetch` main package and all generated `@impersonated-fetch/backend-*` platform
packages to the npm registry.

#### Scenario: Release workflow is manually dispatchable
- **WHEN** maintainers inspect `.github/workflows/release.yml`
- **THEN** the workflow exposes a manual dispatch release path
- **AND** the dispatch inputs include the trusted native backend workflow run id to consume
- **AND** the dispatch inputs include a required release version field

#### Scenario: Existing native release workflow is replaced
- **WHEN** contributors inspect release workflows after this change
- **THEN** the old native-package-only release entrypoint is no longer the published release path
- **AND** `.github/workflows/release.yml` is the release workflow for npm publishing

### Requirement: Release version is provided manually
The system SHALL accept one manually provided release version through `workflow_dispatch` for the
first release automation implementation.

#### Scenario: Release version input is validated
- **WHEN** the release workflow starts with a package version input
- **THEN** it validates that the version is a legal semver value
- **AND** it rejects `0.0-development`
- **AND** it fails before publishing if any target npm package already has that version published

#### Scenario: Release uses dispatch package version
- **WHEN** the release workflow prepares packages for publishing
- **THEN** it uses the dispatch release version for every generated native backend package
- **AND** it applies the same version to `packages/impersonated-fetch/package.json` before packing the main package
- **AND** the main package prepack metadata injects exact optional backend dependency versions matching the dispatch version

### Requirement: Release consumes trusted native artifacts
The release workflow SHALL consume native backend artifacts from an explicit successful native backend
workflow run before generating npm backend packages.

#### Scenario: Native artifacts are downloaded from run id
- **WHEN** the release workflow runs with a `native_run_id`
- **THEN** it downloads `native-backend-*` artifacts from that run id
- **AND** it writes them to a release artifact directory used by native package generation

#### Scenario: License approval remains required
- **WHEN** the release workflow runs without the required license/shipping approval value
- **THEN** the workflow fails before downloading artifacts or publishing packages

### Requirement: Release validates packages before publish
The release workflow SHALL validate generated native backend packages and the main package pack
metadata before publishing any npm package.

#### Scenario: Generated backend packages are validated
- **WHEN** the release workflow prepares native backend packages
- **THEN** it runs native package generation with the release version
- **AND** it validates every generated package metadata file and native asset

#### Scenario: Main package pack metadata is validated
- **WHEN** the release workflow prepares the main package
- **THEN** it builds the main package
- **AND** it runs the package check that verifies pack contents and exact optional backend dependency metadata

### Requirement: npm publishing order protects installs
The release workflow SHALL publish generated backend packages before publishing the main
`impersonated-fetch` package.

#### Scenario: Backend packages publish first
- **WHEN** the release workflow reaches npm publishing
- **THEN** it publishes every generated `@impersonated-fetch/backend-*` package to npm before
  publishing `impersonated-fetch`
- **AND** the main package is published only after all generated backend package publish steps succeed

### Requirement: Release is npm-only for this change
The release workflow SHALL publish only to the npm registry in this change.

#### Scenario: GitHub Packages is not configured
- **WHEN** contributors inspect the release workflow
- **THEN** it does not publish packages to GitHub Packages
- **AND** it does not require GitHub Packages registry configuration

#### Scenario: Tag-path routing is out of scope
- **WHEN** contributors inspect release triggers and conditions
- **THEN** the workflow does not implement tag-path based release routing
