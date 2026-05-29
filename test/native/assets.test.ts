import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { basename, relative } from 'node:path';
import { describe, it } from 'node:test';

import {
  getNativeAssetInfo,
  NativeAssetNotFoundError,
  nativeAssetDependenciesDir,
} from '../../src/native/assets.ts';

const supportedAssets = [
  ['linux', 'x64', 'requests-go-amd64.so'],
  ['linux', 'arm64', 'requests-go-arm64.so'],
  ['linux', 'ia32', 'requests-go-x86.so'],
  ['win32', 'x64', 'requests-go-win64.dll'],
  ['darwin', 'x64', 'requests-go-x86.dylib'],
  ['darwin', 'arm64', 'requests-go-arm64.dylib'],
] as const;

describe('native-assets resolver', () => {
  for (const [platform, arch, filename] of supportedAssets) {
    it(`native-assets maps ${platform}/${arch} to ${filename}`, () => {
      const info = getNativeAssetInfo(platform, arch);
      const pathWithinDependencies = relative(nativeAssetDependenciesDir, info.path);

      assert.equal(info.platform, platform);
      assert.equal(info.arch, arch);
      assert.equal(info.filename, filename);
      assert.equal(basename(info.path), filename);
      assert.equal(info.dependenciesDir, nativeAssetDependenciesDir);
      assert.equal(pathWithinDependencies, filename);
      assert.equal(existsSync(info.path), true);
    });
  }

  it('native-assets throws NativeAssetNotFoundError for freebsd/riscv64', () => {
    assert.throws(
      () => getNativeAssetInfo('freebsd', 'riscv64'),
      (error) => {
        assert.equal(error instanceof NativeAssetNotFoundError, true);
        assert.match(String(error), /platform=freebsd/);
        assert.match(String(error), /arch=riscv64/);
        return true;
      },
    );
  });
});
