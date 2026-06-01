import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';

import {
  getNativeAssetInfo,
  NativeAssetNotFoundError,
  nativeAssetDependenciesDir,
} from '@/native/assets.js';

const supportedAssets = [
  ['linux', 'x64', 'requests-go-amd64.so'],
  ['linux', 'arm64', 'requests-go-arm64.so'],
  ['linux', 'ia32', 'requests-go-x86.so'],
  ['win32', 'x64', 'requests-go-win64.dll'],
  ['darwin', 'x64', 'requests-go-x86.dylib'],
  ['darwin', 'arm64', 'requests-go-arm64.dylib'],
] as const;

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));

describe('native-assets resolver', () => {
  for (const [platform, arch, filename] of supportedAssets) {
    it(`native-assets maps ${platform}/${arch} to ${filename}`, () => {
      const info = getNativeAssetInfo(platform, arch, { sourceBuilt: false });
      const pathWithinDependencies = relative(nativeAssetDependenciesDir, info.path);
      const dependenciesWithinPackage = relative(root, nativeAssetDependenciesDir);

      assert.equal(info.platform, platform);
      assert.equal(info.arch, arch);
      assert.equal(info.filename, filename);
      assert.equal(basename(info.path), filename);
      assert.equal(info.dependenciesDir, nativeAssetDependenciesDir);
      assert.equal(dependenciesWithinPackage, 'native');
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

  it('native-assets prefers source-built backend asset when it exists', () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), 'impersonated-fetch-assets-'));

    try {
      const packageRoot = resolve(tempRoot, 'impersonated-fetch');
      const fallbackDir = resolve(packageRoot, 'native');
      const sourceBuiltDir = resolve(tempRoot, 'native-backend', 'dist');
      const sourceBuiltFilename = 'impersonated-fetch-backend-win32-x64.dll';

      mkdirSync(fallbackDir, { recursive: true });
      mkdirSync(sourceBuiltDir, { recursive: true });
      writeFileSync(resolve(fallbackDir, 'requests-go-win64.dll'), 'closed-backend');
      writeFileSync(resolve(sourceBuiltDir, sourceBuiltFilename), 'source-built-backend');

      const info = getNativeAssetInfo('win32', 'x64', { root: packageRoot });

      assert.equal(info.filename, sourceBuiltFilename);
      assert.equal(info.dependenciesDir, sourceBuiltDir);
      assert.equal(basename(info.path), sourceBuiltFilename);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('native-assets falls back to current bundled native asset when source-built asset is absent', () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), 'impersonated-fetch-assets-'));

    try {
      const packageRoot = resolve(tempRoot, 'impersonated-fetch');
      const fallbackDir = resolve(packageRoot, 'native');
      const fallbackFilename = 'requests-go-win64.dll';

      mkdirSync(fallbackDir, { recursive: true });
      writeFileSync(resolve(fallbackDir, fallbackFilename), 'closed-backend');

      const info = getNativeAssetInfo('win32', 'x64', { root: packageRoot });

      assert.equal(info.filename, fallbackFilename);
      assert.equal(info.dependenciesDir, fallbackDir);
      assert.equal(basename(info.path), fallbackFilename);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
