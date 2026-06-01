## Why

`impersonated-fetch` still ships closed native binaries under `packages/impersonated-fetch/native/` even though Phase 1 introduced source-built artifacts and generated `@impersonated-fetch/backend-*` platform packages. Keeping those binaries in the main package makes the package heavier, weakens the pure-JavaScript package boundary, and preserves a fallback path that can hide missing generated backend package coverage.

This change turns generated scoped backend packages into the production native delivery mechanism and removes bundled native binaries from the main package.

## What Changes

- **BREAKING**: The main `impersonated-fetch` npm package will no longer include `packages/impersonated-fetch/native/*` bundled backend binaries.
- Add optional platform backend dependencies for every supported `@impersonated-fetch/backend-*` package so package managers install the matching native backend when available.
- Update runtime native asset resolution to prefer explicit overrides, source-built monorepo artifacts for local development, then generated scoped backend packages; remove the bundled native directory fallback from production resolution.
- Move closed backend oracle usage out of the main package bundle into a test-only or release-only fixture location so differential tests can still compare against it without shipping it to users.
- Update package validation, native asset tests, documentation, and release checks to fail when generated backend packages are missing or broken instead of relying on bundled fallback binaries.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `nx-monorepo-workspace`: The main package boundary changes from optionally consuming generated backend packages to depending on generated platform backend packages for runtime native delivery, while keeping generated packages outside the source workspace.
- `owned-native-backend`: Runtime backend resolution and packaging requirements change so scoped generated backend packages replace bundled main-package native binaries, while explicit overrides and development source-built artifacts remain supported.

## Impact

- `packages/impersonated-fetch/package.json` package files and optional dependency metadata.
- `packages/impersonated-fetch/src/native/assets.ts` resolver ordering and fallback behavior.
- `packages/impersonated-fetch/test/native`, `test/transport`, and `test/package` coverage for package resolution and missing backend errors.
- `packages/impersonated-fetch/native/` removal and any LFS attributes that only exist for that directory.
- `packages/native-backend` artifact/package generation and differential oracle fixture location.
- README and release documentation describing native backend installation, rollback, and troubleshooting.
