import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import { nativeAbiFfiDeclarations, nativeAbiSymbolNames } from '../../src/native/abi.ts';
import { getNativeAssetInfo } from '../../src/native/assets.ts';

type NativeAbiProbeMode = 'direct' | 'requiresShim';

interface NativeAbiProbeResult {
  mode: NativeAbiProbeMode;
  assetPath: string;
  checkedSymbols: readonly string[];
  reason?: string;
}

const require = createRequire(import.meta.url);

describe('native-abi contract', () => {
  it('native-abi reports direct FFI availability or shim requirement', () => {
    const result = probeNativeAbi();

    assert.match(result.assetPath, /requests-go.*\.(dll|so|dylib)$/);
    assert.deepEqual(result.checkedSymbols, nativeAbiSymbolNames);
    assert.ok(result.mode === 'direct' || result.mode === 'requiresShim');

    console.log(`mode=${result.mode}`);
    if (result.reason) {
      console.log(`reason=${result.reason}`);
    }
  });
});

function probeNativeAbi(): NativeAbiProbeResult {
  const asset = getNativeAssetInfo();

  let ffi: unknown;
  try {
    ffi = require('ffi-napi');
  } catch (error) {
    return {
      mode: 'requiresShim',
      assetPath: asset.path,
      checkedSymbols: nativeAbiSymbolNames,
      reason: `ffi-napi-unavailable:${errorName(error)}`,
    };
  }

  if (!isFfiNapi(ffi)) {
    return {
      mode: 'requiresShim',
      assetPath: asset.path,
      checkedSymbols: nativeAbiSymbolNames,
      reason: 'ffi-napi-missing-Library',
    };
  }

  try {
    const library = ffi.Library(asset.path, nativeAbiFfiDeclarations);
    const missingSymbol = nativeAbiSymbolNames.find(
      (symbolName) => typeof library[symbolName] !== 'function',
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

function isFfiNapi(value: unknown): value is {
  Library(path: string, declarations: typeof nativeAbiFfiDeclarations): Record<string, unknown>;
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'Library' in value &&
    typeof value.Library === 'function'
  );
}

function errorName(error: unknown): string {
  if (error instanceof Error) {
    return error.name;
  }

  return typeof error;
}
