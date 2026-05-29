# Final Verification Wave F4: Scope Fidelity Check

Date: 2026-05-28
Verdict: NOT APPROVED

## Scope Baseline

Original scope from `.omo/plans/node-fetch-port.md`:

- Fetch-first Node package using native `requests_go` transport assets through FFI (`lines 3-11`, `21-28`, `38-48`, `58-65`).
- Capability matrix and no-silent-degradation errors (`lines 10`, `30-36`, `50-56`, `64`).
- Guardrails: no pure JS/Undici fallback that pretends impersonation succeeded, no unsupported OS/arch expansion, no browser CORS/cache emulation, no full Python `requests` API parity requirement (`lines 66-72`).

## Required Checks

| Check | Finding | Evidence |
| --- | --- | --- |
| No `global.fetch` / pure JS impersonation fallback | Aligned after fixes. Search for `global.fetch`, `globalThis.fetch`, `undici`, `node-fetch`, and `cross-fetch` returned no matches. The fingerprint smoke test catches native-unavailable errors and throws `NativeAbiUnavailableError`; it no longer falls back to global fetch. | `test/fingerprint/smoke.test.ts:14-36`, grep result: no matches |
| `ffi-napi` is proper native binding | Aligned. `ffi-napi` is a runtime dependency; `createNativeBindings()` loads it with `createRequire(...)("ffi-napi")`, requires a `Library()` loader, and binds the vendored `.dll/.so/.dylib` with the narrow ABI declarations. Missing direct FFI can use an explicit shim path, not a JS fetch fallback. | `package.json:33-35`, `src/native/bindings.ts:98-188`, `src/native/abi.ts:202-210` |
| JA4 capability matches documentation | **Scope issue.** Runtime capability matrix reports `ja4: false` and tests assert unsupported-by-current-evidence; README documents `Full JA3/JA4 support`. These disagree, so unsupported JA4 is still documented as supported. | `src/transport/capabilities.ts:6-23`, `src/transport/capabilities.ts:66-89`, `test/transport/capabilities.test.ts:40-46`, `README.md:139-142` |
| Browser CORS/cache emulation absent | Aligned. `mode`, `cache`, `integrity`, and `referrerPolicy` are rejected before transport with an explicit non-emulation error; tests assert no backend request is made. Header values like `cache-control` in presets/examples are ordinary wire headers, not Fetch cache emulation. | `src/fetch.ts:60-64`, `src/fetch.ts:305-309`, `test/fetch/facade.test.ts:110-130` |
| Unsupported platform expansion absent | Aligned to the plan/source asset inventory. Resolver maps only listed existing assets and rejects unknown platform/arch. Note: README claims all 32-bit architectures are unsupported while source maps `linux/ia32` because the plan listed `requests-go-x86.so`; this is a docs inconsistency, not source scope creep. | `.omo/plans/node-fetch-port.md:27`, `.omo/plans/node-fetch-port.md:162-180`, `src/native/assets.ts:53-60`, `test/native/assets.test.ts:12-47` |
| Python `requests` parity overreach absent | Aligned. README contains migration examples for selected features, but source exports Fetch/Client/Session-oriented APIs and no Python-style top-level `get/post` parity surface was found. | `README.md:225-331`, grep for `requests.get`/`requests.post`, `src/index.ts` scope by source inventory |

## Blocking Scope Issue

1. **JA4 support is over-documented relative to executable capability evidence.** The implementation deliberately reports `ja4: false` in `getCapabilities()` and tests assert that JA4 must not be marked true without native evidence, but README line 141 claims `Full JA3/JA4 support`. This violates scope fidelity because the documented public capability exceeds the runtime capability matrix.

## Final Decision

NOT APPROVED.

The prior pure JS/global fetch fallback scope creep is fixed, and no browser CORS/cache emulation, unsupported platform expansion, or Python requests parity overreach was found. Approval is blocked by the JA4 documentation/capability mismatch.
