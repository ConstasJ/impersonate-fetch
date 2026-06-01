import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { platformForTarget } from './platform-assets.mjs';

export function buildEnvironmentForTarget(target) {
  const platform = platformForTarget(target);

  return {
    CGO_ENABLED: '1',
    GOARCH: platform.goarch,
    GOOS: platform.goos,
  };
}

export function buildCommandForTarget(target, outputDir = resolve('dist')) {
  const platform = platformForTarget(target);

  return {
    args: [
      'build',
      '-buildmode=c-shared',
      '-o',
      resolve(outputDir, platform.assetName),
      './cmd/native-backend',
    ],
    env: buildEnvironmentForTarget(target),
    outputPath: resolve(outputDir, platform.assetName),
  };
}

export function buildTarget(target, options = {}) {
  const outputDir = options.outputDir ?? resolve('dist');
  const command = buildCommandForTarget(target, outputDir);
  mkdirSync(outputDir, { recursive: true });

  if (options.dryRun) {
    return command;
  }

  const result = spawnSync('go', command.args, {
    env: { ...process.env, ...command.env },
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(`go build failed for ${target} with exit code ${result.status}`);
  }

  return command;
}

function parseArgs(argv) {
  const target = readOption(argv, '--target') ?? hostTarget();
  const outputDir = readOption(argv, '--output-dir') ?? resolve('dist');
  const dryRun = argv.includes('--dry-run');

  return { dryRun, outputDir, target };
}

function readOption(argv, name) {
  const index = argv.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  return argv[index + 1];
}

function hostTarget() {
  const arch = process.arch === 'ia32' ? 'x32' : process.arch;

  return `${process.platform}-${arch}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = parseArgs(process.argv.slice(2));
  const command = buildTarget(options.target, options);
  console.log(`Built ${command.outputPath}`);
}
