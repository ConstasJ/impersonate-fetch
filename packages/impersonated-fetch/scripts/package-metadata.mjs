import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const backendPackageNames = [
  '@impersonated-fetch/backend-darwin-arm64',
  '@impersonated-fetch/backend-darwin-x64',
  '@impersonated-fetch/backend-linux-arm64',
  '@impersonated-fetch/backend-linux-x32',
  '@impersonated-fetch/backend-linux-x64',
  '@impersonated-fetch/backend-win32-arm64',
  '@impersonated-fetch/backend-win32-x32',
  '@impersonated-fetch/backend-win32-x64',
];

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(scriptDir, '..');

export function applyPrepackMetadata(root = defaultRoot) {
  const paths = metadataPaths(root);
  const original = readFileSync(paths.packageJson, 'utf8');
  const packageJson = JSON.parse(original);

  if (!existsSync(paths.backup)) {
    writeFileSync(paths.backup, original);
  }

  packageJson.optionalDependencies = Object.fromEntries(
    backendPackageNames.map((packageName) => [packageName, packageJson.version]),
  );
  delete packageJson.scripts?.prepack;
  delete packageJson.scripts?.postpack;
  writeFileSync(paths.packageJson, `${JSON.stringify(packageJson, null, 2)}\n`);
}

export function restorePostpackMetadata(root = defaultRoot) {
  const paths = metadataPaths(root);

  if (!existsSync(paths.backup)) {
    return;
  }

  writeFileSync(paths.packageJson, readFileSync(paths.backup, 'utf8'));
  rmSync(paths.backup);
}

function metadataPaths(root) {
  return {
    backup: resolve(root, '.package-json.before-prepack'),
    packageJson: resolve(root, 'package.json'),
  };
}

const command = process.argv[2];
if (command === 'prepack') {
  applyPrepackMetadata();
} else if (command === 'postpack') {
  restorePostpackMetadata();
} else if (command !== undefined) {
  throw new Error(`unknown package metadata command: ${command}`);
}
