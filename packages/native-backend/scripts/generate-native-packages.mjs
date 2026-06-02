import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { platforms } from './platform-assets.mjs';

export function generateNativePackages(options = {}) {
  const artifactsDir = resolve(options.artifactsDir ?? 'dist');
  const outputDir = resolve(options.outputDir ?? 'dist/native-packages/packages');
  const version = options.version ?? readMainPackageVersion();
  const packages = [];

  mkdirSync(outputDir, { recursive: true });

  for (const platform of platforms) {
    const packageDir = resolve(outputDir, packageDirectoryName(platform.packageName));
    const sourceAsset = resolve(artifactsDir, platform.assetName);
    const targetAsset = resolve(packageDir, platform.assetName);
    mkdirSync(packageDir, { recursive: true });

    writeFileSync(
      resolve(packageDir, 'package.json'),
      `${JSON.stringify(packageJson(platform, version), null, 2)}\n`,
    );
    writeFileSync(resolve(packageDir, 'README.md'), readme(platform));

    if (existsSync(sourceAsset)) {
      copyFileSync(sourceAsset, targetAsset);
    }

    packages.push({
      assetName: platform.assetName,
      packageDir,
      packageName: platform.packageName,
      target: platform.target,
    });
  }

  const manifest = { generatedOutsideWorkspace: true, packages };
  writeFileSync(
    resolve(outputDir, '..', 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  return manifest;
}

export function validateNativePackages(options = {}) {
  const outputDir = resolve(options.outputDir ?? 'dist/native-packages/packages');
  const expectedVersion = options.expectedVersion;
  const packages = [];

  for (const platform of platforms) {
    const packageDir = resolve(outputDir, packageDirectoryName(platform.packageName));
    const metadataPath = resolve(packageDir, 'package.json');
    const assetPath = resolve(packageDir, platform.assetName);

    if (!existsSync(metadataPath)) {
      throw new Error(`missing generated package metadata for ${platform.packageName}`);
    }

    const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
    if (metadata.name !== platform.packageName) {
      throw new Error(`generated package name mismatch for ${platform.target}`);
    }
    if (expectedVersion !== undefined && metadata.version !== expectedVersion) {
      throw new Error(`generated package version mismatch for ${platform.target}`);
    }
    if (!existsSync(assetPath)) {
      throw new Error(`missing generated package asset ${platform.assetName}`);
    }

    packages.push({ packageDir, packageName: platform.packageName, target: platform.target });
  }

  return { packages };
}

function packageJson(platform, version) {
  return {
    name: platform.packageName,
    version,
    description: `Native backend binary for impersonated-fetch on ${platform.target}`,
    license: 'SEE LICENSE IN ../../LICENSE',
    os: [platform.npmOS],
    cpu: [platform.npmCPU],
    files: [platform.assetName],
  };
}

function readme(platform) {
  return `# ${platform.packageName}\n\nPlatform backend binary for \`${platform.target}\`.\n`;
}

function packageDirectoryName(packageName) {
  return basename(packageName);
}

function readMainPackageVersion() {
  const packageJsonPath = resolve('..', 'impersonated-fetch', 'package.json');
  const metadata = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

  return metadata.version;
}

function parseArgs(argv) {
  const version = readOption(argv, '--version');

  return {
    artifactsDir: readOption(argv, '--artifacts-dir'),
    expectedVersion: version,
    outputDir: readOption(argv, '--output-dir'),
    version,
    validate: argv.includes('--validate'),
  };
}

function readOption(argv, name) {
  const index = argv.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  return argv[index + 1];
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArgs(process.argv.slice(2));
  const manifest = generateNativePackages(options);
  if (options.validate) {
    validateNativePackages(options);
  }
  console.log(`Generated ${manifest.packages.length} native backend packages`);
}
