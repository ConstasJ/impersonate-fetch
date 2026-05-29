# Scripts Cleanup Design

## Goal

Reduce script sprawl without changing the public build, lint, test, package, or CI behavior.

## Chosen Approach

Use the low-risk cleanup path:

- Keep stable user-facing npm entries such as `build`, `test`, `typecheck`, `lint`, and `examples:smoke`.
- Route the default test commands through Node's built-in test runner, matching the existing test files' `node:test` API and excluding native-direct/network smoke tests that require local FFI support or a shim.
- Expose CI-only validation modes as named npm scripts instead of requiring CI to call `node scripts/ci-local.mjs` directly.
- Remove the unused `scripts/test.mjs` aggregate runner because the package now exposes the stable local test set directly through npm scripts, and no project file references `scripts/test.mjs`.

## Alternatives Considered

1. Inline most commands in `package.json`. This would delete more files, but it would make package and native asset validation harder to read.
2. Split `scripts/ci-local.mjs` into shared modules. This may be worthwhile later, but it is larger than needed for the current cleanup.
3. Keep all scripts unchanged. This avoids churn but leaves an unused 292-line test runner and bare CI script invocations.

## Resulting Script Surface

`scripts/` keeps only active helpers:

- `build.mjs` for dual ESM/CJS/type output.
- `ci-local.mjs` for package and native asset validation.
- `test-fingerprint.mjs` for the manual network-backed smoke test.
- `examples-smoke.mjs` for example validation.

CI calls named npm scripts for package and native asset checks, so maintainers can discover and run the same checks from `package.json`.

## Verification

Verify the cleanup by running the renamed npm script surfaces plus the normal build/test/lint checks that depend on them.
