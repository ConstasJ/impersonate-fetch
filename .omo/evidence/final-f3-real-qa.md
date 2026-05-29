# Final Verification Wave F3: Real Manual QA

Date: 2026-05-28
Platform: Windows `win32 x64`, Node `v24.15.0`
Endpoint: `https://tls.peet.ws/api/all`

## Verdict

**NOT APPROVED**

`npm run test:package` passed and `npm run examples:smoke` passed. `RUN_NETWORK=1 npm run test:fingerprint` was executed on this supported native platform, but it failed with `SyntaxError: Unterminated string in JSON at position 3423 (line 96 column 828)` while parsing the fingerprint endpoint response. Because the required fingerprint command did not pass, F3 cannot be approved.

## Commands Run

### `npm run test:package`

Status: **PASS**

```text
> impersonated-fetch@0.0.0 test:package
> npm run build && node test/package/cjs-test.js && node test/package/esm-test.mjs

> impersonated-fetch@0.0.0 build
> node scripts/build.mjs

CJS package smoke test passed
ESM package smoke test passed
```

### `npm run examples:smoke`

Status: **PASS**

```text
> impersonated-fetch@0.0.0 examples:smoke
> node scripts/examples-smoke.mjs

✓ All 12 expected example files exist
✓ basic-get.ts: Valid structure
✓ client-cookies.ts: Valid structure
✓ custom-tls.ts: Valid structure
✓ chrome-preset.ts: Valid structure
✓ random-ja3.ts: Valid structure
✓ ja4-headers.ts: Valid structure
✓ post-json.ts: Valid structure
✓ post-data.ts: Valid structure
✓ post-bytes.ts: Valid structure
✓ streaming.ts: Valid structure
✓ proxy.ts: Valid structure
✓ http2-settings.ts: Valid structure
✓ All examples pass TypeScript type checking
✓ All examples smoke tests passed
```

### `RUN_NETWORK=1 npm run test:fingerprint`

Status: **FAIL**

```text
> impersonated-fetch@0.0.0 test:fingerprint
> node scripts/test-fingerprint.mjs

TAP version 13
# 2026/05/28 20:13:25 Unsolicited response received on idle HTTP channel starting with "\\r\\n\\r\\n"; err=<nil>
# Subtest: fingerprint smoke suite
    # Subtest: fingerprint-smoke validates JA3, JA4-related fields, protocol metadata, HTTP/2 settings, and request ordering against tls.peet.ws
    not ok 1 - fingerprint-smoke validates JA3, JA4-related fields, protocol metadata, HTTP/2 settings, and request ordering against tls.peet.ws
      ---
      duration_ms: 7972.5348
      type: 'test'
      location: 'D:\\Coding\\impersonated-fetch\\test\\fingerprint\\smoke.test.ts:13:3'
      failureType: 'testCodeFailure'
      error: 'Unterminated string in JSON at position 3423 (line 96 column 828)'
      code: 'ERR_TEST_FAILURE'
      name: 'SyntaxError'
      stack: |-
        JSON.parse (<anonymous>)
        FetchResponse.json (file:///D:/Coding/impersonated-fetch/dist/esm/body.js:33:21)
        async TestContext.<anonymous> (file:///D:/Coding/impersonated-fetch/test/fingerprint/smoke.test.ts:39:21)
      ...
1..1
# tests 1
# suites 1
# pass 0
# fail 1
```

## Global Fetch Fallback Check

Status: **NO CURRENT FALLBACK MARKER FOUND**

- Current `test/fingerprint/smoke.test.ts` sets `transport = 'impersonated-fetch'` and throws `NativeAbiUnavailableError` if native transport is unavailable.
- Source/runtime grep for `global-fetch-fallback`, `globalThis.fetch`, and `global.fetch` in `src`, `dist`, and `test` found no matches.
- `.omo/evidence/task-11-fingerprint.json` still contains stale prior-run fallback evidence (`transport: "global-fetch-fallback"`), but this F3 re-run failed before overwriting that file.

## Blocking Failure

The required network fingerprint smoke did not exit 0, so the required Chrome/JA3/JA4/protocol fingerprint evidence was not captured in this final verification wave. This is a real command failure, not an approval-blocking fallback pass.
