# @impersonated-fetch/native-backend

Source-owned Go backend for the Phase 1 native implementation. This package is a pnpm/Nx
source project only; generated platform npm packages must be emitted under `dist/` and must not
be added to `pnpm-workspace.yaml`.

Phase 1 is a transitional compatibility backend. It intentionally uses `wangluozhe/requests` as
the behavior-preserving bridge while source ownership, packaging, and differential parity checks
are established. Phase 2 should reduce this dependency surface and move toward direct `chttp`
usage after Phase 1 parity and release gates are stable.

## Layout

- `cmd/native-backend`: `package main` entrypoint for the c-shared library ABI.
- `internal/compat`: helpers for JSON payloads that match the current Node native ABI contract.
- `scripts/build-host.mjs`: host-platform build wrapper for the shared library artifact.
- `scripts/build-target.mjs`: target-platform c-shared build wrapper for CI matrix jobs.
- `scripts/native-package-plan.mjs`: writes the release-time platform package plan to `dist/`.
- `scripts/generate-native-packages.mjs`: generates scoped backend package directories from
  matrix build outputs.

## Local prerequisites

- Go 1.25 or newer.
- CGO enabled for shared-library builds: `CGO_ENABLED=1`.
- A C compiler on `PATH` for the target platform.
  - Windows: install a MinGW-w64/GCC toolchain and ensure `gcc.exe` is on `PATH`.
  - Linux: install the distribution `gcc`/`build-essential` package.
  - macOS: install Xcode Command Line Tools.

`go test ./...` does not require CGO. `pnpm run build` compiles the current host shared library
and fails early with a prerequisite message when CGO or the compiler is unavailable.

## Current host build

```powershell
pnpm --filter @impersonated-fetch/native-backend run build
```

The host build writes `packages/native-backend/dist/impersonated-fetch-backend-<target>.<ext>`.
In a monorepo checkout, `packages/impersonated-fetch` prefers this source-built artifact before
generated scoped backend packages.

## License gate

Phase 1 is a transitional compatibility backend that may use `wangluozhe/requests` while parity is
validated. Do not publish public generated backend artifacts until the license/shipping approval is
recorded in the change artifacts or release notes.

## Generated package scheme

Release-time scoped packages are generated from `scripts/platform-assets.mjs` and use the
`@impersonated-fetch/backend-<platform>-<arch>` naming pattern. Each package contains exactly one
native artifact named `impersonated-fetch-backend-<platform>-<arch>.<ext>` and package metadata
with matching `os` and `cpu` restrictions.

Generated package directories are written below `packages/native-backend/dist/native-packages`.
They are release artifacts, not source workspace packages, and must stay outside
`pnpm-workspace.yaml`.

For production installs, the main `impersonated-fetch` package declares every supported generated
backend package as an optional dependency. Package managers normally install the matching package
for the current `os`/`cpu`. If optional dependencies are disabled or pruned, install the matching
package explicitly, for example:

```powershell
pnpm add impersonated-fetch @impersonated-fetch/backend-win32-x64
```

Validate generated package output with:

```powershell
pnpm --filter @impersonated-fetch/native-backend run package:generate
pnpm --filter @impersonated-fetch/native-backend run package:validate
```

## CI and release artifact workflow

The root `CI` workflow is the ordinary validation surface for pull requests and `master` pushes. It
runs Nx affected JavaScript checks, the host native backend build/test, package validation, native
asset checks, and OS build/test matrices. Root package metadata, lockfile-only, and JavaScript-only
pull requests should rely on CI instead of automatically producing the full native backend artifact
matrix.

The `Native backend` workflow is the cross-platform artifact producer. It keeps the full eight-target
matrix for manual `workflow_dispatch` runs and path-filtered pushes to `master` that affect native
artifact inputs. Pull request triggers are intentionally limited to native-critical files: the native
workflow itself, `packages/native-backend/**`, and runtime native loader/package mapping files under
`packages/impersonated-fetch/src/native/**`.

Use manual `workflow_dispatch` on `Native backend` when maintainers need fresh trusted artifacts for a
release candidate, when validating high-risk dependency/toolchain changes before release, or when a
release rebuild is needed without another source change. Use the successful run id from that trusted
workflow as the release `native_run_id`.

For a release, run the GitHub Actions `Release` workflow manually from `.github/workflows/release.yml`.
The workflow requires:

- `version`: the exact npm semver version to publish. It must not be `0.0-development`, and the
  workflow checks that `impersonated-fetch` and every generated `@impersonated-fetch/backend-*`
  package do not already have that version on npm.
- `native_run_id`: a successful `Native backend` workflow run id. The release workflow downloads
  its `native-backend-*` artifacts and uses them as the package source.
- `license_approval`: the literal value `approved` after the Phase 1 license/shipping approval has
  been recorded.
- `NPM_TOKEN`: an npm publishing credential configured as a repository secret for npm registry
  authentication.

The workflow generates backend packages with the dispatch `version`, validates their metadata and
artifacts, temporarily writes the same version into `packages/impersonated-fetch/package.json`, runs
the main package pack check, publishes all generated backend packages to npm first, and publishes the
main `impersonated-fetch` package last. Automatic version management is intentionally left for a
follow-up workflow once the manual release path is proven.

## Rollback and parity posture

The main package no longer ships the bundled closed backend as a fallback. If a generated backend
package is missing, users receive a clear native asset error naming the expected
`@impersonated-fetch/backend-*` package and artifact. Roll back a bad backend by pinning the last
known-good generated package, regenerating and republishing the affected package, or using an
explicit native asset override in controlled deployments.

The closed backend remains the differential oracle for Phase 1. Mismatches discovered by
`scripts/native-artifact.test.mjs` must be recorded as implementation bugs or explicit
compatibility decisions before publishing generated backend artifacts. Provide the closed oracle for
local compatibility checks with `IMPERSONATED_FETCH_CLOSED_BACKEND_ORACLE`; do not place it under
`packages/impersonated-fetch/native` or ship it in the main package.
