import assert from 'node:assert/strict';
import koffi from 'koffi';
import { describe, it } from 'vitest';
import { nativeAbiKoffiSignatures, nativeAbiSymbolNames } from '@/native/abi.js';
import type { NativeAssetInfo } from '@/native/assets.js';
import { getNativeAssetInfo, NativeAssetNotFoundError } from '@/native/assets.js';

type NativeAbiProbeMode = 'direct' | 'requiresShim';

interface NativeAbiProbeResult {
  mode: NativeAbiProbeMode;
  assetPath: string;
  checkedSymbols: readonly string[];
  reason?: string;
}

const currentNativeAsset = getCurrentNativeAssetInfo();
const nativeAbiIt = currentNativeAsset ? it : it.skip;

describe('native-abi contract', () => {
  nativeAbiIt('native-abi loads the current platform asset with Koffi and exposes symbols', () => {
    assert.ok(currentNativeAsset);

    const result = probeNativeAbi(currentNativeAsset);

    assert.match(result.assetPath, /(requests-go|impersonated-fetch-backend).*\.(dll|so|dylib)$/);
    assert.deepEqual(result.checkedSymbols, nativeAbiSymbolNames);
    assert.equal(result.mode, 'direct');
  });
});

function probeNativeAbi(asset: NativeAssetInfo): NativeAbiProbeResult {
  try {
    const library = koffi.load(asset.path);
    const missingSymbol = nativeAbiSymbolNames.find(
      (symbolName) => typeof library.func(nativeAbiKoffiSignatures[symbolName]) !== 'function',
    );

    if (missingSymbol) {
      return {
        mode: 'requiresShim',
        assetPath: asset.path,
        checkedSymbols: nativeAbiSymbolNames,
        reason: `symbol-not-callable:${missingSymbol}`,
      };
    }
  } catch (error) {
    return {
      mode: 'requiresShim',
      assetPath: asset.path,
      checkedSymbols: nativeAbiSymbolNames,
      reason: `ffi-load-failed:${errorName(error)}`,
    };
  }

  return {
    mode: 'direct',
    assetPath: asset.path,
    checkedSymbols: nativeAbiSymbolNames,
  };
}

function getCurrentNativeAssetInfo(): NativeAssetInfo | undefined {
  try {
    return getNativeAssetInfo();
  } catch (error) {
    if (error instanceof NativeAssetNotFoundError) {
      return undefined;
    }

    throw error;
  }
}

function errorName(error: unknown): string {
  if (error instanceof Error) {
    return error.name;
  }

  return typeof error;
}
