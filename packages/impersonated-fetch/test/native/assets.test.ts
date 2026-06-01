import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';
import { describe, it } from 'vitest';

import { getNativeAssetInfo, NativeAssetNotFoundError } from '@/native/assets.js';

const supportedAssets = [
  [
    'linux',
    'x64',
    'impersonated-fetch-backend-linux-x64.so',
    '@impersonated-fetch/backend-linux-x64',
  ],
  [
    'linux',
    'arm64',
    'impersonated-fetch-backend-linux-arm64.so',
    '@impersonated-fetch/backend-linux-arm64',
  ],
  [
    'linux',
    'ia32',
    'impersonated-fetch-backend-linux-x32.so',
    '@impersonated-fetch/backend-linux-x32',
  ],
  [
    'win32',
    'x64',
    'impersonated-fetch-backend-win32-x64.dll',
    '@impersonated-fetch/backend-win32-x64',
  ],
  [
    'win32',
    'ia32',
    'impersonated-fetch-backend-win32-x32.dll',
    '@impersonated-fetch/backend-win32-x32',
  ],
  [
    'win32',
    'arm64',
    'impersonated-fetch-backend-win32-arm64.dll',
    '@impersonated-fetch/backend-win32-arm64',
  ],
  [
    'darwin',
    'x64',
    'impersonated-fetch-backend-darwin-x64.dylib',
    '@impersonated-fetch/backend-darwin-x64',
  ],
  [
    'darwin',
    'arm64',
    'impersonated-fetch-backend-darwin-arm64.dylib',
    '@impersonated-fetch/backend-darwin-arm64',
  ],
] as const;

describe('native-assets resolver', () => {
  for (const [platform, arch, filename, packageName] of supportedAssets) {
    it(`native-assets maps ${platform}/${arch} to ${packageName}`, () => {
      const tempRoot = mkdtempSync(resolve(tmpdir(), 'impersonated-fetch-assets-'));

      try {
        const packageRoot = createPackageRoot(tempRoot);
        const scopedPackageDir = writeScopedBackendPackage(packageRoot, packageName, filename);

        const info = getNativeAssetInfo(platform, arch, { root: packageRoot, sourceBuilt: false });

        assert.equal(info.platform, platform);
        assert.equal(info.arch, arch);
        assert.equal(info.filename, filename);
        assert.equal(basename(info.path), filename);
        assert.equal(realpathSync(info.dependenciesDir), realpathSync(scopedPackageDir));
      } finally {
        rmSync(tempRoot, { recursive: true, force: true });
      }
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
      const packageRoot = createPackageRoot(tempRoot);
      const sourceBuiltDir = resolve(tempRoot, 'native-backend', 'dist');
      const sourceBuiltFilename = 'impersonated-fetch-backend-win32-x64.dll';

      mkdirSync(sourceBuiltDir, { recursive: true });
      writeScopedBackendPackage(
        packageRoot,
        '@impersonated-fetch/backend-win32-x64',
        sourceBuiltFilename,
      );
      writeFileSync(resolve(sourceBuiltDir, sourceBuiltFilename), 'source-built-backend');

      const info = getNativeAssetInfo('win32', 'x64', { root: packageRoot });

      assert.equal(info.filename, sourceBuiltFilename);
      assert.equal(realpathSync(info.dependenciesDir), realpathSync(sourceBuiltDir));
      assert.equal(basename(info.path), sourceBuiltFilename);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('native-assets resolves scoped backend package without a bundled native directory', () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), 'impersonated-fetch-assets-'));

    try {
      const packageRoot = createPackageRoot(tempRoot);
      const sourceFilename = 'impersonated-fetch-backend-win32-x64.dll';
      const scopedPackageDir = writeScopedBackendPackage(
        packageRoot,
        '@impersonated-fetch/backend-win32-x64',
        sourceFilename,
      );

      const info = getNativeAssetInfo('win32', 'x64', { root: packageRoot });

      assert.equal(info.filename, sourceFilename);
      assert.equal(realpathSync(info.dependenciesDir), realpathSync(scopedPackageDir));
      assert.equal(basename(info.path), sourceFilename);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('native-assets reports a clear error when the matching scoped backend package is missing', () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), 'impersonated-fetch-assets-'));

    try {
      const packageRoot = createPackageRoot(tempRoot);

      assert.throws(
        () => getNativeAssetInfo('win32', 'x64', { root: packageRoot, sourceBuilt: false }),
        (error) => {
          assert.equal(error instanceof NativeAssetNotFoundError, true);
          assert.match(String(error), /@impersonated-fetch\/backend-win32-x64/);
          assert.match(String(error), /impersonated-fetch-backend-win32-x64\.dll is missing/);
          return true;
        },
      );
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('native-assets reports a clear error when an installed scoped backend package lacks its asset', () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), 'impersonated-fetch-assets-'));

    try {
      const packageRoot = createPackageRoot(tempRoot);
      const scopedPackageDir = resolve(
        packageRoot,
        'node_modules',
        '@impersonated-fetch',
        'backend-win32-x64',
      );

      mkdirSync(scopedPackageDir, { recursive: true });
      writeFileSync(
        resolve(scopedPackageDir, 'package.json'),
        '{"name":"@impersonated-fetch/backend-win32-x64"}\n',
      );

      assert.throws(
        () => getNativeAssetInfo('win32', 'x64', { root: packageRoot }),
        (error) => {
          assert.equal(error instanceof NativeAssetNotFoundError, true);
          assert.match(String(error), /@impersonated-fetch\/backend-win32-x64/);
          assert.match(String(error), /impersonated-fetch-backend-win32-x64\.dll is missing/);
          return true;
        },
      );
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

function createPackageRoot(tempRoot: string): string {
  const packageRoot = resolve(tempRoot, 'impersonated-fetch');

  mkdirSync(packageRoot, { recursive: true });
  writeFileSync(resolve(packageRoot, 'package.json'), '{"type":"module"}\n');

  return packageRoot;
}

function writeScopedBackendPackage(
  packageRoot: string,
  packageName: string,
  filename: string,
): string {
  const match = /^(@[^/]+)\/(.+)$/.exec(packageName);

  assert.ok(match, `expected scoped package name: ${packageName}`);

  const [, scope, name] = match;
  const packageDir = resolve(packageRoot, 'node_modules', scope, name);

  mkdirSync(packageDir, { recursive: true });
  writeFileSync(resolve(packageDir, 'package.json'), JSON.stringify({ name: packageName }));
  writeFileSync(resolve(packageDir, filename), 'scoped-backend');

  return packageDir;
}
