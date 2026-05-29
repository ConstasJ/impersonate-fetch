# ESM-only Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `impersonated-fetch` to a publishable ESM-only package.

**Architecture:** The npm package metadata becomes the source of truth for an ESM-only surface: no `require` export and no CJS entrypoint. The build emits only `dist/index.mjs` and `dist/index.d.mts`; package tests verify both the positive ESM import path and the negative CommonJS require path.

**Tech Stack:** Node.js package exports, TypeScript, tsdown, Node test runner, npm pack dry-run.

---

### Task 1: Package metadata

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update publish metadata**

Replace the package metadata top section with ESM-only fields:

```json
{
  "name": "impersonated-fetch",
  "version": "0.0.0",
  "type": "module",
  "description": "Node.js fetch port scaffold for requests_go impersonation backend",
  "main": "./dist/index.mjs",
  "types": "./dist/index.d.mts",
  "exports": {
    ".": {
      "types": "./dist/index.d.mts",
      "import": "./dist/index.mjs"
    },
    "./package.json": "./package.json"
  },
```

Expected: `private` and the `require` export condition are gone.

### Task 2: ESM-only build

**Files:**
- Modify: `tsdown.config.mjs`

- [ ] **Step 1: Emit only ESM output**

Use one runtime build and one declaration-only build, both ESM:

```js
export default defineConfig([
  {
    ...baseConfig,
    format: 'esm',
    dts: false,
    clean: true,
  },
  {
    ...baseConfig,
    format: 'esm',
    dts: {
      emitDtsOnly: true,
    },
    clean: false,
  },
]);
```

Expected: `npm run build` no longer emits `dist/index.cjs`.

### Task 3: Package tests

**Files:**
- Modify: `test/package/package-check.test.mjs`
- Delete: `test/package/cjs-test.js`
- Create: `test/package/cjs-require-test.cjs`
- Modify: `package.json`

- [ ] **Step 1: Update packed artifact assertions**

In `test/package/package-check.test.mjs`, assert that `dist/index.mjs` and `dist/index.d.mts` are present, and `dist/index.cjs` plus `dist/index.d.cts` are absent.

- [ ] **Step 2: Add CJS rejection smoke test**

Create `test/package/cjs-require-test.cjs`:

```js
const assert = require('node:assert/strict');

assert.throws(
  () => require('impersonated-fetch'),
  (error) => error && error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
);

console.log('CJS package rejection test passed');
```

- [ ] **Step 3: Update package test script**

Change `test:package` to run the new rejection test and the existing ESM smoke test:

```json
"test:package": "npm run build && node test/package/cjs-require-test.cjs && node test/package/esm-test.mjs"
```

Expected: CommonJS consumers get an unsupported-package-surface failure, and ESM import still works.

### Task 4: Verification and manual package QA

**Files:**
- Verify: `package.json`
- Verify: `tsdown.config.mjs`
- Verify: `test/package/package-check.test.mjs`
- Verify: `test/package/cjs-require-test.cjs`
- Verify: `test/package/esm-test.mjs`

- [ ] **Step 1: Run static checks**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both commands exit 0.

- [ ] **Step 2: Run package tests**

Run:

```bash
npm run test:package
npm run package:check
```

Expected: ESM smoke test passes, CJS rejection test passes, and `npm pack --dry-run` contains no CJS artifact.

- [ ] **Step 3: Manual QA through package surface**

Run direct Node commands against the built package:

```bash
node --input-type=module -e "import { fetch, Client, Session } from './dist/index.mjs'; console.log(typeof fetch, typeof Client, typeof Session)"
node -e "try { require('impersonated-fetch') } catch (error) { console.log(error.code) }"
```

Expected: the first command prints `function function function`; the second prints `ERR_PACKAGE_PATH_NOT_EXPORTED`.
