## Why

The repository can already build native matrix artifacts and generate platform backend package
directories, but publishing still stops at an uploaded artifact and requires manual follow-up.
Automating the npm release path now turns the existing release-native workflow into a repeatable
end-to-end release process for the main JavaScript package and all generated native backend
packages.

## What Changes

- Replace the existing `.github/workflows/release-native-packages.yml` release entrypoint with a
  full `.github/workflows/release.yml` workflow.
- Keep the trusted `native_run_id` artifact-consumption model and the license/shipping approval
  gate from the existing workflow.
- Publish only to the npm registry in this change; GitHub Packages and tag-path release routing are
  explicitly out of scope.
- Add a required manual `version` input to the release workflow for the first implementation, with
  validation before any package is generated or published.
- Ensure the generated `@impersonated-fetch/backend-*` packages and the `impersonated-fetch` main
  package publish with one identical version, so the main package's exact optional backend
  dependencies remain installable.
- Verify release candidates before publish by generating and validating native packages, building
  the main package, and running the package metadata checks.

## Capabilities

### New Capabilities
- `release-automation`: npm-only release workflow, version management, validation, and publishing
  behavior for the main package and generated native backend packages.

### Modified Capabilities
- `owned-native-backend`: Release packaging requirements change from generating native package
  artifacts only to publishing the generated platform backend packages as part of the npm release.

## Impact

- `.github/workflows/release-native-packages.yml` will be renamed or replaced by
  `.github/workflows/release.yml`.
- `.github/workflows/release.yml` will temporarily apply the dispatch `version` to the main package
  before packing so its prepack-time optional dependency injection uses the release version.
- `packages/impersonated-fetch/package.json` pack-time optional dependency behavior must remain
  compatible with exact-version generated backend packages.
- `packages/native-backend/scripts/generate-native-packages.mjs` and related tests may need release
  version injection or validation updates.
- npm publishing requires an npm automation token or trusted publishing configuration exposed to
  GitHub Actions as the release credential.
