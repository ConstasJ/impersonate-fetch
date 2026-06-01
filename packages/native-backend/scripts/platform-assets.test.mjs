import assert from 'node:assert/strict';
import { test } from 'node:test';

import { assetNameForTarget, platforms } from './platform-assets.mjs';

const expectedAssets = new Map([
  ['linux-x64', 'impersonated-fetch-backend-linux-x64.so'],
  ['linux-x32', 'impersonated-fetch-backend-linux-x32.so'],
  ['linux-arm64', 'impersonated-fetch-backend-linux-arm64.so'],
  ['darwin-x64', 'impersonated-fetch-backend-darwin-x64.dylib'],
  ['darwin-arm64', 'impersonated-fetch-backend-darwin-arm64.dylib'],
  ['win32-x64', 'impersonated-fetch-backend-win32-x64.dll'],
  ['win32-x32', 'impersonated-fetch-backend-win32-x32.dll'],
  ['win32-arm64', 'impersonated-fetch-backend-win32-arm64.dll'],
]);

test('defines all generated backend package targets with impersonated-fetch-backend assets', () => {
  assert.deepEqual(
    platforms.map((platform) => platform.target),
    [...expectedAssets.keys()],
  );
  assert.deepEqual(
    platforms.map((platform) => platform.assetName),
    [...expectedAssets.values()],
  );
});

test('resolves asset names by target', () => {
  for (const [target, assetName] of expectedAssets) {
    assert.equal(assetNameForTarget(target), assetName);
  }
});
