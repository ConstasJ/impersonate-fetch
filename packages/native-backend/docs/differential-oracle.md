# Differential oracle record

Phase 1 keeps the bundled closed backend as the behavioral oracle while the
source-owned Go backend reaches parity.

Current automated oracle coverage lives in
`packages/native-backend/scripts/native-artifact.test.mjs`:

- loads the source-built host artifact from `packages/native-backend/dist`;
- smoke-loads the exported C ABI symbols;
- verifies buffered request success, native error JSON prefixes, stream open/read/EOF/close,
  repeated read cleanup, and closed-stream error behavior;
- compares baseline buffered behavior against the current closed backend under
  `packages/impersonated-fetch/native` when the host oracle artifact exists.

Current mismatch status: no differential mismatches are recorded for the covered host
baseline. Future mismatches MUST be classified as either implementation bugs or explicit
compatibility decisions before release.
