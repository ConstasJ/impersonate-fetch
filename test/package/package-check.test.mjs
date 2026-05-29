import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const npmPackInvocation =
  process.platform === 'win32'
    ? {
        command: process.env.ComSpec ?? 'cmd.exe',
        args: ['/d', '/s', '/c', 'npm pack --dry-run --json'],
      }
    : { command: 'npm', args: ['pack', '--dry-run', '--json'] };
const nativeDependenciesDir = resolve(
  root,
  'requests-go',
  'requests_go',
  'tls_client',
  'dependencies',
);

const expectedNativeAssets = new Map([
  [
    'requests-go-amd64.so',
    {
      platform: 'linux',
      arch: 'x64',
      size: 12013112,
      sha256: '3163ef51d0084dbead667452cae6cb3d46f5cf1f0800fb81d1cbc5c9e4e7addf',
    },
  ],
  [
    'requests-go-arm64.dylib',
    {
      platform: 'darwin',
      arch: 'arm64',
      size: 8147714,
      sha256: 'e972a41ea098a1c031087ec73e12881123feecc5d41860a8b20d9785e90911bd',
    },
  ],
  [
    'requests-go-arm64.so',
    {
      platform: 'linux',
      arch: 'arm64',
      size: 11255024,
      sha256: 'dd13af5613e703f32aaf46cf0284bba31595467880fd4e7426dd5e8ef07b4d38',
    },
  ],
  [
    'requests-go-win64.dll',
    {
      platform: 'win32',
      arch: 'x64',
      size: 15590294,
      sha256: 'a7dc00a1592ede6d1dfb5f9f09ccc940e897a390612cb8ae7f14e9653a8eac7e',
    },
  ],
  [
    'requests-go-x86.dylib',
    {
      platform: 'darwin',
      arch: 'x64',
      size: 8608128,
      sha256: 'ebb22d28585938fea488e0050bf67cc1506d589653a5b2414422a071c309f01c',
    },
  ],
  [
    'requests-go-x86.so',
    {
      platform: 'linux',
      arch: 'ia32',
      size: 12013112,
      sha256: '3163ef51d0084dbead667452cae6cb3d46f5cf1f0800fb81d1cbc5c9e4e7addf',
    },
  ],
]);

describe('package contents', () => {
  it('package contents include built entrypoints and native assets', () => {
    const result = execFileSync(npmPackInvocation.command, npmPackInvocation.args, {
      cwd: root,
      encoding: 'utf8',
    });
    const packEntries = JSON.parse(result);
    const packagedPaths = new Set(
      packEntries.flatMap((entry) => entry.files ?? []).map((file) => normalizePackPath(file.path)),
    );

    for (const path of ['dist/index.mjs', 'dist/index.d.mts']) {
      assert.equal(packagedPaths.has(path), true, `npm pack is missing ${path}`);
    }

    assert.equal(
      packagedPaths.has('dist/index.cjs'),
      false,
      'npm pack should not include CommonJS bundle',
    );
    assert.equal(
      packagedPaths.has('dist/index.d.cts'),
      false,
      'npm pack should not include CommonJS declaration re-export',
    );

    for (const filename of expectedNativeAssets.keys()) {
      const path = `requests-go/requests_go/tls_client/dependencies/${filename}`;
      assert.equal(packagedPaths.has(path), true, `npm pack is missing ${path}`);
    }
  });
});

describe('native packaged assets', () => {
  it('native packaged assets have expected checksums and resolver behavior', async () => {
    assert.equal(
      existsSync(nativeDependenciesDir),
      true,
      'native dependencies directory is missing',
    );

    const actualNativeFiles = readdirSync(nativeDependenciesDir)
      .filter((filename) => /\.(so|dll|dylib)$/.test(filename))
      .sort();
    assert.deepEqual(actualNativeFiles, [...expectedNativeAssets.keys()].sort());

    for (const [filename, expected] of expectedNativeAssets) {
      const path = resolve(nativeDependenciesDir, filename);
      const bytes = readFileSync(path);
      const size = statSync(path).size;
      const sha256 = createHash('sha256').update(bytes).digest('hex');

      assert.equal(size, expected.size, `${filename} size changed`);
      assert.equal(sha256, expected.sha256, `${filename} sha256 changed`);
    }

    const packageEntry = await import(pathToFileURL(resolve(root, 'dist', 'index.mjs')).href);

    validateResolver(packageEntry, 'ESM bundle');
  });

  it('native packaged assets resolve outside the package cwd', async () => {
    const originalCwd = process.cwd();

    try {
      process.chdir(tmpdir());
      const packageEntry = await import(
        `${pathToFileURL(resolve(root, 'dist', 'index.mjs')).href}?cwd-independent`
      );

      validateResolver(packageEntry, 'ESM bundle from unrelated cwd');
    } finally {
      process.chdir(originalCwd);
    }
  });
});

function validateResolver(module, label) {
  for (const [filename, expected] of expectedNativeAssets) {
    const info = module.getCapabilities({ platform: expected.platform, arch: expected.arch });

    assert.equal(info.nativeAssetFilename, filename, `${label} resolver filename mismatch`);
    assert.equal(basename(info.nativeAssetPath), filename, `${label} resolver path mismatch`);
    assert.equal(existsSync(info.nativeAssetPath), true, `${label} resolver returned missing path`);
  }

  const unsupported = module.getCapabilities({ platform: 'freebsd', arch: 'riscv64' });
  assert.equal(
    unsupported.nativeAssetPath,
    undefined,
    `${label} unsupported platform path mismatch`,
  );
}

function normalizePackPath(path) {
  return path.replace(/\\/g, '/').replace(/^package\//, '');
}
