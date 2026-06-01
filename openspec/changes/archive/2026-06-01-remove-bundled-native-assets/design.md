## Context

Phase 1 moved the project into an Nx/pnpm workspace, added `packages/native-backend`, and introduced generated scoped backend packages such as `@impersonated-fetch/backend-win32-x64`. The runtime loader currently resolves native assets in this order: explicit caller overrides, sibling source-built artifacts, scoped backend packages, and finally the bundled closed backend binaries under `packages/impersonated-fetch/native/`.

That fallback was useful during Phase 1 rollout and differential validation, but it now conflicts with the intended pure JavaScript main package boundary. If the main package continues to ship `native/*`, users can install `impersonated-fetch` without the generated backend packages and still succeed through the closed fallback, masking packaging regressions and keeping large platform binaries in the main tarball.

The closed backend should remain available for compatibility testing and rollback decisions, but it should no longer be part of the production main package artifact.

## Goals / Non-Goals

**Goals:**

- Make generated `@impersonated-fetch/backend-*` packages the normal production delivery path for native artifacts.
- Remove `packages/impersonated-fetch/native/*` from source, package files, and runtime fallback behavior.
- Add optional dependency metadata for all supported generated backend packages so package managers can install the platform-specific backend alongside the main package.
- Keep explicit native asset path and shim command overrides working for advanced callers and tests.
- Preserve closed backend differential/oracle coverage from a test-only or release-only fixture location outside the main package tarball.
- Make missing or broken generated backend packages fail with clear `NativeAssetNotFoundError` messages.

**Non-Goals:**

- Do not change the public Fetch-style API.
- Do not implement Phase 2 direct `chttp` refactoring.
- Do not publish packages or perform a real npm release as part of this change.
- Do not remove differential oracle testing; only move the oracle out of the main package bundle.

## Decisions

1. **Generated backend packages become required runtime delivery, represented as optional dependencies.**
   - The main package will list every supported `@impersonated-fetch/backend-*` package in `optionalDependencies` using the same version as the main package.
   - Rationale: optional dependencies are the standard npm mechanism for platform-specific native packages. Unsupported platform packages can be skipped by package managers via `os`/`cpu` metadata while the matching package remains available for the runtime loader.
   - Alternative considered: keep the closed bundled fallback for users without optional dependencies. Rejected because it preserves silent packaging degradation and keeps binaries in the pure JS package.

2. **Runtime resolver order becomes explicit override, source-built development artifact, scoped backend package.**
   - Explicit asset path and shim command overrides stay outside `assets.ts` and remain highest priority through the existing native binding options.
   - `packages/native-backend/dist` remains a monorepo development convenience when present.
   - Scoped backend packages become the only production package resolution path.
   - The `packages/impersonated-fetch/native` fallback branch and bundled filename exports are removed.

3. **Closed backend oracle moves out of `packages/impersonated-fetch/native`.**
   - Differential tests should use either a test fixture directory outside the main package tarball or an explicit environment variable pointing to a closed backend artifact.
   - Rationale: tests still need the closed backend as an oracle while the package boundary must stop shipping it.
   - The oracle location must be ignored or excluded from package files unless a deliberate internal fixture is committed.

4. **Packaging validation must prove the main package is binary-free.**
   - `package:check` should fail if `native/*.dll`, `native/*.so`, or `native/*.dylib` appears in the main package tarball.
   - Native package validation remains responsible for checking generated scoped packages include exactly one expected backend artifact.

5. **Error behavior should be fail-fast for missing generated backend packages.**
   - If no matching scoped backend package is installed and no source-built artifact or explicit override is configured, runtime capability detection and binding creation should raise a clear native asset error naming the expected package and artifact.
   - If a scoped backend package is installed but missing its artifact, the existing broken-package error behavior remains authoritative.

## Risks / Trade-offs

- **Optional dependency installation varies by package manager** → Add package-check and resolver tests that simulate installed/missing scoped backend packages, and document troubleshooting for skipped optional dependencies.
- **Removing bundled fallback is a breaking packaging change** → Mark the change as breaking in the proposal, document migration, and ensure generated package metadata is validated before release.
- **Closed oracle may be unavailable on contributor machines** → Keep differential oracle tests conditional on an explicit fixture/env path while preserving non-oracle contract tests for normal CI.
- **Local development could fail before building native-backend** → Keep source-built discovery for `packages/native-backend/dist` and document running the native build target locally.
- **Dirty existing LFS/native files could obscure implementation diffs** → Scope implementation commits to package metadata, resolver/tests/docs, and explicit deletion of `packages/impersonated-fetch/native/*` only when intentionally executing this change.

## Migration Plan

1. Add tests proving the main package can resolve an installed scoped backend package and fails clearly when no generated backend is installed.
2. Add `optionalDependencies` entries for all supported generated backend packages.
3. Remove bundled native asset mappings, `nativeAssetFilenames`, package `files` entries for `native/*`, and tests that require bundled fallback assets.
4. Move or rewire closed backend oracle tests to a non-packaged fixture or explicit environment variable.
5. Delete `packages/impersonated-fetch/native/*` and remove now-obsolete LFS/package attributes for that path.
6. Update README and release docs with the new installation and troubleshooting model.
7. Verify JS package checks, native backend package generation/validation, and artifact contract tests.

Rollback, if needed, is to reinstall or rebuild the generated scoped backend package for the current platform, or use an explicit native asset override. Reintroducing bundled binaries should require a new compatibility decision rather than being the default fallback.

## Open Questions

- Should closed oracle binaries be committed under a test fixture path, or should differential tests require an environment variable pointing to a private artifact store?
- Should `optionalDependencies` use exact versions, workspace protocol during development, or a release-time version rewrite step?
