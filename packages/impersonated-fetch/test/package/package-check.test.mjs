import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it } from 'vitest';

import {
  applyPrepackMetadata,
  backendPackageNames,
  restorePostpackMetadata,
} from '../../scripts/package-metadata.mjs';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const requireFromHere = createRequire(import.meta.url);
const npmPackInvocation =
  process.platform === 'win32'
    ? {
        command: process.env.ComSpec ?? 'cmd.exe',
        args: ['/d', '/s', '/c', 'npm pack --dry-run --json'],
      }
    : { command: 'npm', args: ['pack', '--dry-run', '--json'] };

const expectedBackendPackages = [...backendPackageNames].sort();

describe('package contents', () => {
  it('package contents include built entrypoints and exclude native backend binaries', () => {
    let result;
    try {
      result = execFileSync(npmPackInvocation.command, npmPackInvocation.args, {
        cwd: root,
        encoding: 'utf8',
      });
    } finally {
      restorePostpackMetadata(root);
    }
    const packEntries = JSON.parse(result);
    const packagedPaths = new Set(
      packEntries.flatMap((entry) => entry.files ?? []).map((file) => normalizePackPath(file.path)),
    );

    for (const path of ['dist/index.mjs', 'dist/index.d.mts']) {
      assert.equal(packagedPaths.has(path), true, `npm pack is missing ${path}`);
    }

    for (const path of ['dist/index.cjs', 'dist/index.d.cts']) {
      assert.equal(packagedPaths.has(path), false, `npm pack should not include ${path}`);
    }

    for (const path of packagedPaths) {
      assert.doesNotMatch(path, /^native\/.*\.(dll|so|dylib)$/);
      assert.doesNotMatch(path, /impersonated-fetch-backend-.*\.(dll|so|dylib)$/);
      assert.doesNotMatch(path, /requests-go-.*\.(dll|so|dylib)$/);
    }
  }, 60_000);

  it('source package metadata does not declare generated backend packages during workspace install', () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

    for (const packageName of expectedBackendPackages) {
      assert.equal(packageJson.optionalDependencies?.[packageName], undefined);
    }
  });

  it('prepack metadata declares every generated backend package as optional', () => {
    try {
      applyPrepackMetadata(root);
      const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

      assert.deepEqual(
        Object.keys(packageJson.optionalDependencies).sort(),
        expectedBackendPackages,
      );

      for (const packageName of expectedBackendPackages) {
        assert.equal(packageJson.optionalDependencies[packageName], packageJson.version);
      }
      assert.equal(packageJson.scripts.prepack, undefined);
      assert.equal(packageJson.scripts.postpack, undefined);
    } finally {
      restorePostpackMetadata(root);
    }

    const restoredPackageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    assert.equal(restoredPackageJson.optionalDependencies, undefined);
  });

  it('release workflow publishes the packed main package tarball', () => {
    const workflow = readFileSync(
      resolve(root, '..', '..', '.github', 'workflows', 'release.yml'),
      'utf8',
    );

    assert.match(workflow, /npm pack \.\/packages\/impersonated-fetch --pack-destination/);
    assert.match(workflow, /npm publish "\$MAIN_PACKAGE_TARBALL" --access public/);
    assert.doesNotMatch(workflow, /npm publish \.\/packages\/impersonated-fetch --access public/);
  });

  it('release workflow uses npm 11 capable Node for trusted publishing', () => {
    const workflow = readFileSync(
      resolve(root, '..', '..', '.github', 'workflows', 'release.yml'),
      'utf8',
    );

    assert.match(workflow, /node-version: 24/);
    assert.doesNotMatch(workflow, /node-version: 22/);
  });
});

describe('package entrypoints', () => {
  it('package entrypoints expose ESM exports and reject CommonJS require', async () => {
    const packageEntry = await import(pathToFileURL(resolve(root, 'dist', 'index.mjs')).href);

    assert.equal(typeof packageEntry.fetch, 'function');
    assert.equal(typeof packageEntry.Client, 'function');
    assert.equal(typeof packageEntry.Session, 'function');
    assert.throws(
      () => requireFromHere('impersonated-fetch'),
      (error) => error && error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
    );
  });
});

function normalizePackPath(path) {
  return path.replace(/\\/g, '/').replace(/^package\//, '');
}
