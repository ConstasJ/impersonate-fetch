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
