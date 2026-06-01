## 1. Resolver and Package Metadata

- [ ] 1.1 Add tests that prove `impersonated-fetch` resolves an installed matching `@impersonated-fetch/backend-*` package without relying on `packages/impersonated-fetch/native/*`
- [ ] 1.2 Add tests that prove missing generated backend packages fail with a clear `NativeAssetNotFoundError` when no explicit override or source-built development artifact is available
- [ ] 1.3 Add `optionalDependencies` entries in `packages/impersonated-fetch/package.json` for every supported generated backend package from the native platform mapping
- [ ] 1.4 Remove bundled native fallback mappings and exported bundled fallback filename lists from `packages/impersonated-fetch/src/native/assets.ts`
- [ ] 1.5 Preserve explicit native asset path and shim command override tests while removing assumptions about bundled fallback assets

## 2. Main Package Binary Removal

- [ ] 2.1 Remove `native/*.dll`, `native/*.so`, and `native/*.dylib` entries from the main package `files` list
- [ ] 2.2 Delete `packages/impersonated-fetch/native/*` from the main package source tree
- [ ] 2.3 Remove obsolete LFS or `.gitattributes` rules that only apply to `packages/impersonated-fetch/native/*`
- [ ] 2.4 Update package validation so packed `impersonated-fetch` artifacts fail if any native backend binary is included

## 3. Closed Backend Oracle Relocation

- [ ] 3.1 Move differential oracle discovery away from `packages/impersonated-fetch/native/*` to a test-only fixture path or explicit environment variable
- [ ] 3.2 Update native artifact differential tests to skip or fail clearly when the closed oracle is unavailable according to the chosen test-only source
- [ ] 3.3 Document how maintainers provide the closed oracle for compatibility checks without shipping it in the main package

## 4. Documentation and Release Validation

- [ ] 4.1 Update `packages/impersonated-fetch/README.md` to document generated backend packages as the production native delivery path and remove bundled fallback instructions
- [ ] 4.2 Update `packages/native-backend/README.md` and release docs to describe generated package installation, missing optional dependency troubleshooting, and rollback via explicit override or regenerated backend package
- [ ] 4.3 Verify generated native package creation and validation still produce all supported `@impersonated-fetch/backend-*` packages
- [ ] 4.4 Run JS package typecheck, lint, tests, and package validation after native bundle removal
- [ ] 4.5 Run native backend build, test, artifact contract tests, lint, and package generation validation after oracle relocation
