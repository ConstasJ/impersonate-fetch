## Why

The current native layer depends on closed, prebuilt `requests-go`-style Go artifacts, which prevents this project from controlling compilation targets, reproducible native releases, and upstream update cadence. Phase 1 introduces a source-owned native backend that intentionally preserves the current ABI and behavior while using `wangluozhe/requests` as a transitional implementation bridge.

## What Changes

- Add a unified Go native backend source package at `packages/native-backend` that exports the existing C ABI: `request`, `stream_request`, `stream_read`, `stream_close`, and `freeMemory`.
- Move the main `impersonated-fetch` package to `packages/impersonated-fetch`.
- Implement Phase 1 backend behavior through `wangluozhe/requests` to match the currently bundled closed native binary as closely as possible.
- Add reproducible native build tasks for supported platform/architecture targets.
- Convert the repository into an Nx-managed pnpm monorepo with separate projects for:
  - `packages/impersonated-fetch` - the pure JS package
  - `packages/native-backend` - unified Go backend source
  - release-time native package generation tasks
- Add release-time generation for scoped platform backend npm packages, following the esbuild/swc optional native package model.
- Use GitHub Actions Matrix for parallel cross-platform builds (Linux x64/x32/ARM64, macOS x64/ARM64, Windows x64/x32/ARM64).
- Keep the public `impersonated-fetch` npm package pure JavaScript/TypeScript and load platform backend packages at runtime.
- Add ABI contract and differential oracle tests comparing the self-built backend with the current closed native binary.
- Preserve the current Node-facing request/stream/free-memory protocol in Phase 1; no Fetch API breaking changes are intended.

## Capabilities

### New Capabilities
- `owned-native-backend`: Source-owned Go native backend, ABI compatibility, platform builds, generated native npm package artifacts, and oracle-based parity verification.
- `nx-monorepo-workspace`: Nx-managed pnpm monorepo structure for coordinating JS package tasks, Go backend tasks, generated native package artifacts, affected builds, and CI orchestration.

### Modified Capabilities
- None.

## Impact

- Affects native loading, native asset packaging, package validation, CI/release workflow, and test strategy.
- Affects repository layout and task orchestration by:
  - Moving main JS package to `packages/impersonated-fetch`
  - Adding Go backend at `packages/native-backend`
  - Introducing Nx project graph configuration for all packages
- Introduces Go source and build tooling into the repository.
- Introduces scoped platform backend npm package artifacts such as `@impersonated-fetch/backend-linux-x64`, `@impersonated-fetch/backend-linux-x32`, `@impersonated-fetch/backend-linux-arm64`, `@impersonated-fetch/backend-darwin-x64`, `@impersonated-fetch/backend-darwin-arm64`, `@impersonated-fetch/backend-win32-x64`, `@impersonated-fetch/backend-win32-x32`, and `@impersonated-fetch/backend-win32-arm64`.
- Uses GitHub Actions Matrix for parallel cross-platform native builds.
- Keeps `wangluozhe/requests` as a transitional Phase 1 backend dependency only; Phase 2 will refactor the same backend lineage toward direct `chttp` usage.
- Requires an explicit license/shipping decision for Phase 1 use of `wangluozhe/requests` before public release.
