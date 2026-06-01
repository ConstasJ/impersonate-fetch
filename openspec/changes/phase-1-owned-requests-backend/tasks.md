## 1. Baseline and Workspace Setup

- [x] 1.1 Convert the repository into an Nx-managed pnpm monorepo with explicit source workspace globs
- [x] 1.2 Define Nx projects for `packages/impersonated-fetch` (pure JS package), `packages/native-backend` (Go backend), and native package generation workflow
- [x] 1.3 Move the main `impersonated-fetch` package source to `packages/impersonated-fetch`
- [x] 1.4 Define the Phase 1 Go backend directory at `packages/native-backend` with module layout for a single unified backend source package
- [x] 1.5 Add Go toolchain documentation and local build prerequisites for contributors
- [x] 1.6 Add backend build scripts for the current host platform without changing default package loading behavior
- [x] 1.7 Document the Phase 1 license gate for `wangluozhe/requests` before public artifact publishing

## 2. Phase 1 Native ABI Implementation

- [x] 2.1 Create an implementation reference map from `refs/psuedocodes/*.c` to each exported Phase 1 ABI function
- [x] 2.2 Implement exported `request` symbol in Go using the existing `NativeRequestPayload` JSON contract and `main.request.c` / `main.buildRequest.c` as behavioral references
- [x] 2.3 Implement exported `stream_request` symbol with current stream metadata response shape using `main.streamRequest.c` as behavioral reference
- [x] 2.4 Implement exported `stream_read` symbol with base64 chunk, previous-read cleanup, and EOF semantics using `main.streamRead.c` as behavioral reference
- [x] 2.5 Implement exported `stream_close` symbol with response body, stream pool, and pointer cleanup using `main.streamClose.c` as behavioral reference
- [ ] 2.6 Implement exported `freeMemory` symbol with response-id-based C string cleanup using `main.freeMemory.c` as behavioral reference
- [ ] 2.7 Preserve current error JSON/message compatibility for request construction, transport, stream, and marshal failures

## 3. Node Loader and Backend Resolution

- [ ] 3.1 Add source-built backend asset discovery without removing current native asset fallback
- [ ] 3.2 Add scoped platform backend package resolution for `@impersonated-fetch/backend-*` packages
- [ ] 3.3 Preserve explicit backend path and shim command override behavior
- [ ] 3.4 Ensure missing backend packages fail with clear native asset errors and no silent degradation

## 4. Contract and Differential Tests

- [ ] 4.1 Add ABI symbol smoke tests for the source-built backend artifact
- [ ] 4.2 Add buffered request contract fixtures for successful responses and native errors
- [ ] 4.3 Add streaming contract fixtures for open, read, EOF, and close behavior
- [ ] 4.4 Add memory cleanup tests covering `freeMemory`, repeated `stream_read`, and `stream_close`
- [ ] 4.5 Add differential oracle tests comparing the source-built backend with the current closed backend
- [ ] 4.6 Add tests or review checks for pseudocode-derived lifecycle details: response id pointer map, stream pool, `${stream_id}_read` cleanup, and error prefix compatibility
- [ ] 4.7 Record any differential mismatches as either implementation bugs or explicit compatibility decisions

## 5. Native Build Matrix and Packaging

- [ ] 5.1 Add cross-build scripts for supported Linux, macOS, and Windows targets
- [ ] 5.2 Set up GitHub Actions Matrix workflow for parallel cross-platform builds (Linux x64/x32/ARM64, macOS x64/ARM64, Windows x64/x32/ARM64)
- [ ] 5.3 Configure CI artifact upload for native build outputs from matrix jobs
- [ ] 5.4 Generate native artifact filenames matching the platform mapping consumed by the Node loader (including linux-x32, win32-x32, win32-arm64)
- [ ] 5.5 Add release-time templates for scoped backend npm packages
- [ ] 5.6 Generate package metadata for platform backend packages from a single source of truth
- [ ] 5.7 Add package validation for the pure JS main package and generated platform backend packages
- [ ] 5.8 Declare Nx cache outputs for Go binaries, JS package output, and generated native package directories

## 6. CI and Release Gates

- [ ] 6.1 Add Nx affected CI targets for JavaScript build, typecheck, lint, and Vitest tests
- [ ] 6.2 Add Nx-wrapped CI targets for Go build and Go tests on the host platform
- [ ] 6.3 Configure GitHub Actions Matrix for parallel native builds across all supported platforms
- [ ] 6.4 Add CI artifact upload for source-built backend binaries from matrix jobs
- [ ] 6.5 Add release workflow tasks for generated scoped backend package artifacts using matrix build outputs
- [ ] 6.6 Add a release gate that blocks public Phase 1 publishing until license/shipping approval is recorded
- [ ] 6.7 Add optional/manual fingerprint smoke test workflow for network-dependent verification

## 7. Documentation and Handoff

- [ ] 7.1 Document the Phase 1 backend as a transitional `requests`-based compatibility backend
- [ ] 7.2 Document the generated scoped backend package naming scheme and runtime resolution order
- [ ] 7.3 Document rollback behavior to the current closed backend while Phase 1 parity is being validated
- [ ] 7.4 Update contributor notes with the Phase 2 refactor direction toward direct `chttp` usage
