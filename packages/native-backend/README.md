# @impersonated-fetch/native-backend

Source-owned Go backend for the Phase 1 native implementation. This package is a pnpm/Nx
source project only; generated platform npm packages must be emitted under `dist/` and must not
be added to `pnpm-workspace.yaml`.

## Layout

- `cmd/native-backend`: `package main` entrypoint for the c-shared library ABI.
- `internal/compat`: helpers for JSON payloads that match the current Node native ABI contract.
- `scripts/build-host.mjs`: host-platform build wrapper for the shared library artifact.
- `scripts/native-package-plan.mjs`: writes the release-time platform package plan to `dist/`.

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

The host build writes the artifact to `packages/native-backend/dist/<asset-name>`. It does not
change the default runtime loader in `packages/impersonated-fetch`.

## License gate

Phase 1 is a transitional compatibility backend that may use `wangluozhe/requests` while parity is
validated. Do not publish public generated backend artifacts until the license/shipping approval is
recorded in the change artifacts or release notes.
