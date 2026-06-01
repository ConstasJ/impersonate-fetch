import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
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

export interface NativeAssetResolverOptions {
  readonly root?: string;
  readonly sourceBuilt?: boolean;
  readonly backendPackages?: boolean;
}

interface NativeAssetMapping {
  platform: NativePlatform;
  arch: NativeArchitecture;
  filename: string;
}

interface BackendPackageMapping extends NativeAssetMapping {
  packageName: string;
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

const sourceBuiltNativeAssetMappings: readonly NativeAssetMapping[] = [
  { platform: 'linux', arch: 'x64', filename: 'impersonated-fetch-backend-linux-x64.so' },
  { platform: 'linux', arch: 'ia32', filename: 'impersonated-fetch-backend-linux-x32.so' },
  { platform: 'linux', arch: 'arm64', filename: 'impersonated-fetch-backend-linux-arm64.so' },
  { platform: 'darwin', arch: 'x64', filename: 'impersonated-fetch-backend-darwin-x64.dylib' },
  { platform: 'darwin', arch: 'arm64', filename: 'impersonated-fetch-backend-darwin-arm64.dylib' },
  { platform: 'win32', arch: 'x64', filename: 'impersonated-fetch-backend-win32-x64.dll' },
  { platform: 'win32', arch: 'ia32', filename: 'impersonated-fetch-backend-win32-x32.dll' },
  { platform: 'win32', arch: 'arm64', filename: 'impersonated-fetch-backend-win32-arm64.dll' },
];

const backendPackageMappings: readonly BackendPackageMapping[] = [
  {
    platform: 'linux',
    arch: 'x64',
    filename: 'impersonated-fetch-backend-linux-x64.so',
    packageName: '@impersonated-fetch/backend-linux-x64',
  },
  {
    platform: 'linux',
    arch: 'ia32',
    filename: 'impersonated-fetch-backend-linux-x32.so',
    packageName: '@impersonated-fetch/backend-linux-x32',
  },
  {
    platform: 'linux',
    arch: 'arm64',
    filename: 'impersonated-fetch-backend-linux-arm64.so',
    packageName: '@impersonated-fetch/backend-linux-arm64',
  },
  {
    platform: 'darwin',
    arch: 'x64',
    filename: 'impersonated-fetch-backend-darwin-x64.dylib',
    packageName: '@impersonated-fetch/backend-darwin-x64',
  },
  {
    platform: 'darwin',
    arch: 'arm64',
    filename: 'impersonated-fetch-backend-darwin-arm64.dylib',
    packageName: '@impersonated-fetch/backend-darwin-arm64',
  },
  {
    platform: 'win32',
    arch: 'x64',
    filename: 'impersonated-fetch-backend-win32-x64.dll',
    packageName: '@impersonated-fetch/backend-win32-x64',
  },
  {
    platform: 'win32',
    arch: 'ia32',
    filename: 'impersonated-fetch-backend-win32-x32.dll',
    packageName: '@impersonated-fetch/backend-win32-x32',
  },
  {
    platform: 'win32',
    arch: 'arm64',
    filename: 'impersonated-fetch-backend-win32-arm64.dll',
    packageName: '@impersonated-fetch/backend-win32-arm64',
  },
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
  options: NativeAssetResolverOptions = {},
): NativeAssetInfo {
  const root = options.root ?? repositoryRoot;
  const sourceBuiltAsset =
    options.sourceBuilt === false
      ? undefined
      : resolveNativeAsset(
          getSourceBuiltBackendDir(root),
          sourceBuiltNativeAssetMappings,
          platform,
          arch,
        );

  if (sourceBuiltAsset) {
    return sourceBuiltAsset;
  }

  const packageAsset =
    options.backendPackages === false
      ? undefined
      : resolveBackendPackageAsset(root, platform, arch);

  if (packageAsset) {
    return packageAsset;
  }

  const fallbackDependenciesDir = getDependenciesDir(root);
  const fallbackAsset = resolveNativeAsset(
    fallbackDependenciesDir,
    nativeAssetMappings,
    platform,
    arch,
  );

  if (fallbackAsset) {
    return fallbackAsset;
  }

  const mapping = nativeAssetMappings.find(
    (asset) => asset.platform === platform && asset.arch === arch,
  );

  if (!mapping) {
    throw new NativeAssetNotFoundError(platform, arch, 'unsupported platform or architecture');
  }

  const assetPath = resolve(fallbackDependenciesDir, mapping.filename);

  if (!isPathInside(assetPath, fallbackDependenciesDir)) {
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
    dependenciesDir: fallbackDependenciesDir,
  };
}

function resolveBackendPackageAsset(
  root: string,
  platform: NativePlatform,
  arch: NativeArchitecture,
): NativeAssetInfo | undefined {
  const mapping = backendPackageMappings.find(
    (asset) => asset.platform === platform && asset.arch === arch,
  );

  if (!mapping) {
    return undefined;
  }

  const packageRoot = findBackendPackageRoot(root, mapping.packageName);

  if (!packageRoot) {
    return undefined;
  }

  const asset = resolveNativeAsset(packageRoot, [mapping], platform, arch);

  if (!asset) {
    throw new NativeAssetNotFoundError(
      platform,
      arch,
      `${mapping.packageName} is installed but ${mapping.filename} is missing`,
    );
  }

  return asset;
}

function findBackendPackageRoot(root: string, packageName: string): string | undefined {
  try {
    const requireFromRoot = createRequire(resolve(root, 'package.json'));
    return dirname(requireFromRoot.resolve(`${packageName}/package.json`));
  } catch {
    return undefined;
  }
}

function resolveNativeAsset(
  assetDir: string,
  mappings: readonly NativeAssetMapping[],
  platform: NativePlatform,
  arch: NativeArchitecture,
): NativeAssetInfo | undefined {
  const mapping = mappings.find((asset) => asset.platform === platform && asset.arch === arch);

  if (!mapping) {
    return undefined;
  }

  const assetPath = resolve(assetDir, mapping.filename);

  if (!isPathInside(assetPath, assetDir)) {
    return undefined;
  }

  if (!existsSync(assetPath)) {
    return undefined;
  }

  return {
    platform,
    arch,
    filename: mapping.filename,
    path: assetPath,
    dependenciesDir: assetDir,
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

function getSourceBuiltBackendDir(root: string): string {
  return resolve(root, '..', 'native-backend', 'dist');
}

export const nativeAssetDependenciesDir = dependenciesDir;
export const nativeAssetFilenames = nativeAssetMappings.map((asset) => asset.filename);
export const sourceBuiltNativeAssetFilenames = sourceBuiltNativeAssetMappings.map(
  (asset) => asset.filename,
);
export const backendPackageNames = backendPackageMappings.map((asset) => asset.packageName);
