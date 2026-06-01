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
It does not
change the default runtime loader in `packages/impersonated-fetch`.

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

## Rollback and parity posture

The main package keeps the existing bundled closed backend as a fallback while Phase 1 parity is
being validated. If a generated backend package is missing, users can still rely on the bundled
closed backend unless an installed generated package is broken. A broken generated package fails
with a clear native asset error instead of silently degrading.

The closed backend remains the differential oracle for Phase 1. Mismatches discovered by
`scripts/native-artifact.test.mjs` must be recorded as implementation bugs or explicit
compatibility decisions before publishing generated backend artifacts.
