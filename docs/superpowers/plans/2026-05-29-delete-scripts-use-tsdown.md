# Delete Scripts Use Tsdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the custom `scripts/` build and validation layer in favor of tsdown, direct npm scripts, Vitest files, and GitHub Actions.

**Architecture:** tsdown owns build output in a flat `dist/` layout with `.mjs`, `.cjs`, `.d.mts`, and `.d.cts` files. Package/native validation moves into a Vitest file, and examples get a real TypeScript project instead of a fake smoke script.

**Tech Stack:** tsdown, TypeScript, Vitest, GitHub Actions, npm scripts.

---

### Task 1: Replace custom build with tsdown

**Files:**
- Create: `tsdown.config.mjs`
- Modify: `package.json`
- Modify: `test/package/package-check.test.mjs`
- Modify: test imports under `test/**/*.ts`

- [ ] **Step 1: Add tsdown config**

Create `tsdown.config.mjs` with unbundled ESM/CJS output from `src/**/*.ts`, `root: 'src'`, `dts: { cjsReexport: true }`, and `outDir: 'dist'`.

- [ ] **Step 2: Update package exports**

Point `main` to `dist/index.cjs`, `types` to `dist/index.d.mts`, and export `import`/`require` to `dist/index.mjs`/`dist/index.cjs`.

- [ ] **Step 3: Update tests**

Replace `dist/esm/*.js` imports with `dist/*.mjs` imports.

### Task 2: Replace ci-local with Node tests

**Files:**
- Create: `test/package/package-check.test.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add package/native assertions**

Create a Vitest test that validates `npm pack --dry-run --json`, required dist files, native asset pack entries, native asset checksums, ESM/CJS resolver exports, and unsupported platform errors.

- [ ] **Step 2: Wire npm and CI**

Make `package:check` and `native-assets:check` run the Vitest package/native validation test. Remove `ci:local`.

### Task 3: Replace examples-smoke with real example typecheck

**Files:**
- Create: `tsconfig.examples.json`
- Modify: `package.json`
- Modify: `examples/node/*.ts`
- Modify: `README.md`

- [ ] **Step 1: Add example typecheck config**

Create `tsconfig.examples.json` that extends the root config and includes `src/**/*.ts` and `examples/node/**/*.ts`.

- [ ] **Step 2: Fix example API usage**

Move TLS configuration from `native.tlsConfig` to top-level `tls`, update proxy examples to current `proxy` type, and cast `response.json()` values before property access.

- [ ] **Step 3: Remove fake smoke command**

Remove `examples:smoke` and document `npm run typecheck:examples` instead.

### Task 4: Delete scripts directory and verify

**Files:**
- Delete: `scripts/build.mjs`
- Delete: `scripts/ci-local.mjs`
- Delete: `scripts/examples-smoke.mjs`
- Delete: `scripts/test-fingerprint.mjs`

- [ ] **Step 1: Delete scripts**

Remove every remaining `scripts/*.mjs` file.

- [ ] **Step 2: Verify surfaces**

Run `npm run build`, `npm run typecheck`, `npm run typecheck:examples`, `npm test`, `npm run test:package`, `npm run package:check`, and `npm run native-assets:check`.
