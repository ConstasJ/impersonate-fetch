import assert from 'node:assert/strict';
import koffi from 'koffi';
import { describe, it } from 'vitest';
import { nativeAbiKoffiSignatures, nativeAbiSymbolNames } from '@/native/abi.js';
import { getNativeAssetInfo } from '@/native/assets.js';

type NativeAbiProbeMode = 'direct' | 'requiresShim';

interface NativeAbiProbeResult {
  mode: NativeAbiProbeMode;
  assetPath: string;
  checkedSymbols: readonly string[];
  reason?: string;
}

describe('native-abi contract', () => {
  it('native-abi loads the current platform asset with Koffi and exposes symbols', () => {
    const result = probeNativeAbi();

    assert.match(result.assetPath, /requests-go.*\.(dll|so|dylib)$/);
    assert.deepEqual(result.checkedSymbols, nativeAbiSymbolNames);
    assert.equal(result.mode, 'direct');
  });
});

function probeNativeAbi(): NativeAbiProbeResult {
  const asset = getNativeAssetInfo();

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

function errorName(error: unknown): string {
  if (error instanceof Error) {
    return error.name;
  }

  return typeof error;
}
