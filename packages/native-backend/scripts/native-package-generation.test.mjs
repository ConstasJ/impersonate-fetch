import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import { buildEnvironmentForTarget } from './build-target.mjs';
import { generateNativePackages, validateNativePackages } from './generate-native-packages.mjs';
import { platforms } from './platform-assets.mjs';

test('cross-build metadata covers every supported native backend target', () => {
  const expectedTargets = [
    ['linux-x64', 'linux', 'amd64'],
    ['linux-x32', 'linux', '386'],
    ['linux-arm64', 'linux', 'arm64'],
    ['darwin-x64', 'darwin', 'amd64'],
    ['darwin-arm64', 'darwin', 'arm64'],
    ['win32-x64', 'windows', 'amd64'],
    ['win32-x32', 'windows', '386'],
    ['win32-arm64', 'windows', 'arm64'],
  ];

  assert.deepEqual(
    platforms.map((platform) => platform.target),
    expectedTargets.map(([target]) => target),
  );

  for (const [target, goos, goarch] of expectedTargets) {
    assert.deepEqual(buildEnvironmentForTarget(target), {
      CGO_ENABLED: '1',
      GOARCH: goarch,
      GOOS: goos,
    });
  }
});

test('generated backend packages use shared platform metadata and copied artifacts', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'native-packages-'));
  const artifactsDir = join(workspace, 'artifacts');
  const outputDir = join(workspace, 'packages');
  mkdirSync(artifactsDir, { recursive: true });

  for (const platform of platforms) {
    writeFileSync(join(artifactsDir, platform.assetName), `artifact:${platform.target}`);
  }

  const manifest = generateNativePackages({
    artifactsDir,
    outputDir,
    version: '1.2.3-test',
  });
  const validation = validateNativePackages({ outputDir });

  assert.equal(manifest.packages.length, platforms.length);
  assert.equal(validation.packages.length, platforms.length);

  for (const platform of platforms) {
    const generated = manifest.packages.find((candidate) => candidate.target === platform.target);
    assert.ok(generated, `missing generated package for ${platform.target}`);

    const packageJson = JSON.parse(
      readFileSync(resolve(generated.packageDir, 'package.json'), 'utf8'),
    );
    assert.equal(packageJson.name, platform.packageName);
    assert.equal(packageJson.version, '1.2.3-test');
    assert.deepEqual(packageJson.files, [platform.assetName]);
    assert.equal(packageJson.os[0], platform.npmOS);
    assert.equal(packageJson.cpu[0], platform.npmCPU);
    assert.equal(
      readFileSync(resolve(generated.packageDir, platform.assetName), 'utf8'),
      `artifact:${platform.target}`,
    );
  }
});
