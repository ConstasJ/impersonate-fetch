import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assetNameForTarget } from './platform-assets.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist', hostAssetName());
const goEnv = readGoEnv();

if (goEnv.CGO_ENABLED !== '1') {
  fail('CGO_ENABLED=1 is required to build the native shared library.');
}

if (!commandAvailable(goEnv.CC)) {
  fail(`C compiler "${goEnv.CC}" was not found on PATH.`);
}

mkdirSync(dirname(output), { recursive: true });

const result = spawnSync(
  'go',
  ['build', '-buildmode=c-shared', '-o', output, './cmd/native-backend'],
  {
    cwd: root,
    env: { ...process.env, CGO_ENABLED: '1' },
    stdio: 'inherit',
  },
);

if (result.error) {
  fail(result.error.message);
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Built ${output}`);

function hostAssetName() {
  return assetNameForTarget(hostTarget());
}

function hostTarget() {
  const arch = process.arch === 'ia32' ? 'x32' : process.arch;

  return `${process.platform}-${arch}`;
}

function commandAvailable(command) {
  const result = spawnSync(command, ['--version'], { stdio: 'ignore' });
  return !result.error && result.status === 0;
}

function readGoEnv() {
  const result = spawnSync('go', ['env', 'CGO_ENABLED', 'CC'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    fail(result.error.message);
  }
  if (result.status !== 0) {
    fail(result.stderr.trim() || 'go env failed');
  }

  const [CGO_ENABLED, CC] = result.stdout.trim().split(/\r?\n/);

  return { CGO_ENABLED, CC: CC || 'gcc' };
}

function fail(message) {
  console.error(`native-backend build: ${message}`);
  process.exit(1);
}
