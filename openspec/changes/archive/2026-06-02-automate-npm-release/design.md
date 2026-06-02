## Context

The current release path is split in two. `.github/workflows/native-backend.yml` builds and uploads
the eight trusted platform artifacts, while `.github/workflows/release-native-packages.yml` consumes
a caller-provided `native_run_id`, runs native package generation/validation, and uploads the
generated package tree as another artifact. Nothing publishes to npm yet.

The main package is `packages/impersonated-fetch` with source version `0.0-development`. Its
`prepack` script injects exact-version `optionalDependencies` for every generated
`@impersonated-fetch/backend-*` package, then strips pack lifecycle scripts from the packed
manifest. Generated backend package metadata comes from
`packages/native-backend/scripts/generate-native-packages.mjs`, which can already accept an explicit
`--version`. The release design must keep those versions identical.

## Goals / Non-Goals

**Goals:**
- Replace the native-package-only release workflow with `.github/workflows/release.yml` that
  publishes the main package and all generated backend packages to npm.
- Retain the explicit trusted `native_run_id` and license/shipping gate from the existing workflow.
- Add a required manual `version` input to `workflow_dispatch` for the first implementation and
  validate it before generating or publishing packages.
- Keep generated backend packages outside the pnpm workspace while making their release metadata
  match the main package version exactly.
- Validate the release candidate before any publish step runs.

**Non-Goals:**
- Publishing to GitHub Packages.
- Tag-path or release-asset routing.
- Renaming the unscoped `impersonated-fetch` npm package.
- Changing the native matrix build workflow beyond whatever release.yml needs to consume its
  artifacts.

## Decisions

### Use a manual release version input for the first implementation

Add a required `version` string input to `workflow_dispatch`. The release workflow validates that the
input is a legal semver value, is not `0.0-development`, and has not already been published for the
packages that will be released before any publish step runs.

Alternatives considered:
- **Changesets**: useful for later stable and snapshot/dev release automation, but more moving parts
  than the first release workflow needs.
- **`npm version` in the release job**: changes git state and may create commits/tags unless
  carefully configured, which is out of scope for this first manual-dispatch release.
- **release-please**: viable for single-package repositories, but less direct for this repo's
  generated package set and future snapshot/dev channels.

### Apply the dispatch version before packing

The publish path uses the dispatch `version` as the single release version. It passes that value into
native package generation with `--version`, temporarily writes the same value into
`packages/impersonated-fetch/package.json` before the main package is packed, and verifies generated
package metadata before publishing. This is required because the main package's `prepack` script
injects exact optional backend dependencies from the current package version.

### Keep npm publishing token-based for the first implementation

Use `actions/setup-node` with `registry-url: https://registry.npmjs.org` and publish with
`NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`. Add `--provenance` where supported by the package
publish command. Trusted publishing/OIDC can be adopted later without changing the package graph,
but token-based publishing is the smallest path compatible with the user's "configured npm token"
constraint.

### Publish generated backend packages before the main package

The release workflow publishes every generated `@impersonated-fetch/backend-*` package first, then
publishes `packages/impersonated-fetch`. If the main package publishes first, users may briefly
install a version whose exact optional backend dependencies are not available yet. Backend-first
ordering narrows that failure window to the main package not being visible until all backend
packages succeed.

### Preserve validation gates before publish

Release validation should include install, artifact download, native package generation,
native package validation, main package build, and package metadata checks. Publish steps should not
run if the generated package manifest, native assets, or main package pack metadata are invalid.

## Risks / Trade-offs

- Npm publish is not idempotent once a package/version exists -> the workflow should fail early when
  a target package version already exists or clearly report the already-published package.
- Publishing eight backend packages before the main package can leave a partial backend-only publish
  if a later package fails -> publish order minimizes broken user installs, and retry should skip or
  detect already-published backend packages before publishing the main package.
- Token-based npm publishing is operationally simple but depends on secret management -> document
  required `NPM_TOKEN` and keep permissions minimal.
- Manual version input can be mistyped -> validate semver, reject `0.0-development`, and check
  target package versions before publishing.
- Phase 2 may change backend internals -> release automation should continue to use the existing
  generated package names and `platform-assets.mjs` mapping as the source of truth.

## Migration Plan

1. Replace `.github/workflows/release-native-packages.yml` with `.github/workflows/release.yml`.
2. Add the required manual release `version` dispatch input and validate it before publish work.
3. Generate backend packages with the dispatch version and validate every generated package.
4. Apply the dispatch version to the main package before pack/publish so prepack metadata uses the
   release version.
5. Publish generated backend packages to npm, then publish the main package to npm.
6. Update documentation for required release inputs, npm token setup, manual versioning, and retry
   behavior.

Rollback: disable or revert `.github/workflows/release.yml`; previously generated native artifacts
and package generation scripts remain usable locally and in CI.

## Open Questions

- Whether the first implementation should proactively query npm for existing versions before
  publish, or rely on `npm publish` failure and clear logs.
- Whether Changesets or another automatic versioning tool should replace manual version input in a
  follow-up once the npm release surface is proven.
