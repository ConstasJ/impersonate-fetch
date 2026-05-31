# ESM-only Publishing Design

## Goal

Publish `impersonated-fetch` as an ESM-only Node.js package. Consumers should import it with ESM syntax, and CommonJS `require('impersonated-fetch')` should no longer be advertised or supported.

## Chosen approach

Use the publishable ESM-only path:

- Mark the package as ESM with `"type": "module"`.
- Remove `"private": true` so the package metadata is suitable for publication.
- Point `main`, `types`, and `exports["."]` at the ESM bundle and `.d.mts` declarations only.
- Remove the `require` export condition.
- Configure `tsdown` to emit only the ESM JavaScript bundle and ESM declarations.
- Replace package tests that expect CommonJS support with checks that no CJS build artifact is packed and that CommonJS `require()` fails.

## Package surface

The supported package surface is:

```js
import { fetch, Client, Session } from 'impersonated-fetch';
```

The package keeps `./package.json` exported for metadata consumers. Native assets remain included exactly as before.

## Validation

Validation should prove the published surface, not just the source tree:

- `npm run build` emits `dist/index.mjs` and `dist/index.d.mts` only for JavaScript/declaration entrypoints.
- `npm run test:package` verifies ESM import works and CommonJS require is rejected.
- `npm run package:check` dry-runs `npm pack` and confirms the tarball contains ESM output plus native assets and excludes CJS output.
- Type-check and the relevant package tests remain green.

## Non-goals

- No compatibility shim for CommonJS consumers.
- No dual-package conditional export support.
- No changes to runtime fetch/client behavior.
