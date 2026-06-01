# Differential oracle record

Phase 1 keeps a closed backend as the behavioral oracle while the source-owned Go backend reaches
parity, but the oracle is supplied only through maintainer-controlled test configuration and is not
shipped in the main `impersonated-fetch` package.

Current automated oracle coverage lives in
`packages/native-backend/scripts/native-artifact.test.mjs`:

- loads the source-built host artifact from `packages/native-backend/dist`;
- smoke-loads the exported C ABI symbols;
- verifies buffered request success, native error JSON prefixes, stream open/read/EOF/close,
  repeated read cleanup, and closed-stream error behavior;
- compares baseline buffered behavior against the closed backend path named by
  `IMPERSONATED_FETCH_CLOSED_BACKEND_ORACLE` when that environment variable is set.

If `IMPERSONATED_FETCH_CLOSED_BACKEND_ORACLE` is unset, the differential comparison is skipped with
a clear message. If it is set to a missing path, the test fails clearly so release validation does
not silently ignore a misconfigured oracle.

Current mismatch status: no differential mismatches are recorded for the covered host
baseline. Future mismatches MUST be classified as either implementation bugs or explicit
compatibility decisions before release.
