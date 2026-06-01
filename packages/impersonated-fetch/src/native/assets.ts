import { existsSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type NativePlatform = NodeJS.Platform | string;
export type NativeArchitecture = NodeJS.Architecture | string;

export interface NativeAssetInfo {
  platform: NativePlatform;
  arch: NativeArchitecture;
  filename: string;
  path: string;
  dependenciesDir: string;
}

interface NativeAssetMapping {
  platform: NativePlatform;
  arch: NativeArchitecture;
  filename: string;
}

const moduleDir = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = findRepositoryRoot(moduleDir);
const dependenciesDir = getDependenciesDir(repositoryRoot);

const nativeAssetMappings: readonly NativeAssetMapping[] = [
  { platform: 'linux', arch: 'x64', filename: 'requests-go-amd64.so' },
  { platform: 'linux', arch: 'arm64', filename: 'requests-go-arm64.so' },
  { platform: 'linux', arch: 'ia32', filename: 'requests-go-x86.so' },
  { platform: 'win32', arch: 'x64', filename: 'requests-go-win64.dll' },
  { platform: 'darwin', arch: 'x64', filename: 'requests-go-x86.dylib' },
  { platform: 'darwin', arch: 'arm64', filename: 'requests-go-arm64.dylib' },
];

export class NativeAssetNotFoundError extends Error {
  constructor(platform: NativePlatform, arch: NativeArchitecture, detail?: string) {
    const suffix = detail ? `: ${detail}` : '';

    super(`Native asset not found for platform=${platform} arch=${arch}${suffix}`);
    this.name = 'NativeAssetNotFoundError';
  }
}

export function getNativeAssetInfo(
  platform: NativePlatform = process.platform,
  arch: NativeArchitecture = process.arch,
): NativeAssetInfo {
  const mapping = nativeAssetMappings.find(
    (asset) => asset.platform === platform && asset.arch === arch,
  );

  if (!mapping) {
    throw new NativeAssetNotFoundError(platform, arch, 'unsupported platform or architecture');
  }

  const assetPath = resolve(dependenciesDir, mapping.filename);

  if (!isPathInside(assetPath, dependenciesDir)) {
    throw new NativeAssetNotFoundError(
      platform,
      arch,
      'resolved path escapes dependencies directory',
    );
  }

  if (!existsSync(assetPath)) {
    throw new NativeAssetNotFoundError(platform, arch, `${mapping.filename} is missing`);
  }

  return {
    platform,
    arch,
    filename: mapping.filename,
    path: assetPath,
    dependenciesDir,
  };
}

function isPathInside(path: string, parentDir: string): boolean {
  const relativePath = relative(parentDir, path);

  return relativePath !== '' && !relativePath.startsWith('..') && !isAbsolute(relativePath);
}

function findRepositoryRoot(fromDir: string): string {
  const candidates = [
    resolve(fromDir),
    resolve(fromDir, '..'),
    resolve(fromDir, '..', '..'),
    resolve(fromDir, '..', '..', '..', '..'),
  ];

  return (
    candidates.find((candidate) => existsSync(resolve(candidate, 'package.json'))) ?? candidates[0]
  );
}

function getDependenciesDir(root: string): string {
  return resolve(root, 'native');
}

export const nativeAssetDependenciesDir = dependenciesDir;
export const nativeAssetFilenames = nativeAssetMappings.map((asset) => asset.filename);
