# Scripts Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce script sprawl while preserving existing behavior.

**Architecture:** Keep npm scripts as the discoverable command surface. Retain focused helper scripts only when their logic is too complex for an inline command, and route CI through npm script names instead of direct `node scripts/...` calls.

**Tech Stack:** Node.js, npm scripts, GitHub Actions, TypeScript, Node built-in test runner.

---

### Task 1: Expose CI validation modes as npm scripts

**Files:**
- Modify: `package.json`

- [x] **Step 1: Add `package:check`**

Add:

```json
"package:check": "node scripts/ci-local.mjs --package-only"
```

- [x] **Step 2: Add `native-assets:check`**

Add:

```json
"native-assets:check": "node scripts/ci-local.mjs --native-assets-only"
```

### Task 2: Route CI through npm scripts

**Files:**
- Modify: `.github/workflows/ci.yml`

- [x] **Step 1: Replace package validation command**

Use:

```yaml
run: npm run package:check
```

- [x] **Step 2: Replace native asset validation command**

Use:

```yaml
run: npm run native-assets:check
```

### Task 3: Route tests through Node's built-in runner

**Files:**
- Modify: `package.json`

- [x] **Step 1: Replace the default test command**

Use Node's `node:test` runner for the stable local test set:

```json
"test": "npm run build && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test --test-reporter=tap test/client/client-session.test.ts test/errors/errors-abort.test.ts test/fetch/facade.test.ts test/fingerprint/fixture.test.ts test/impersonation/serialize.test.ts test/impersonation/types.test.ts test/native/abi.test.ts test/native/assets.test.ts test/native/transport.test.ts test/transport/capabilities.test.ts"
```

- [x] **Step 2: Replace the native assets test command**

Use:

```json
"test:native-assets": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test --test-reporter=tap test/native/assets.test.ts"
```

### Task 4: Remove unused aggregate runner

**Files:**
- Delete: `scripts/test.mjs`

- [x] **Step 1: Delete the unused file**

Remove `scripts/test.mjs` after verifying no project file references it.

### Task 5: Verify behavior

**Files:**
- Validate: `package.json`, `.github/workflows/ci.yml`, `scripts/`

- [ ] **Step 1: Run diagnostics**

Run LSP diagnostics on changed files. Expected: no new errors.

- [ ] **Step 2: Run package checks through npm scripts**

Run `npm run package:check` and `npm run native-assets:check`. Expected: both commands use `scripts/ci-local.mjs` and exit 0 when required native assets are present.

- [ ] **Step 3: Run normal verification**

Run `npm run build`, `npm run typecheck`, `npm run lint`, and `npm test`. Expected: unchanged command behavior.
