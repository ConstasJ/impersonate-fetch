export const platforms = [
  {
    target: 'linux-x64',
    packageName: '@impersonated-fetch/backend-linux-x64',
    assetName: 'impersonated-fetch-backend-linux-x64.so',
  },
  {
    target: 'linux-x32',
    packageName: '@impersonated-fetch/backend-linux-x32',
    assetName: 'impersonated-fetch-backend-linux-x32.so',
  },
  {
    target: 'linux-arm64',
    packageName: '@impersonated-fetch/backend-linux-arm64',
    assetName: 'impersonated-fetch-backend-linux-arm64.so',
  },
  {
    target: 'darwin-x64',
    packageName: '@impersonated-fetch/backend-darwin-x64',
    assetName: 'impersonated-fetch-backend-darwin-x64.dylib',
  },
  {
    target: 'darwin-arm64',
    packageName: '@impersonated-fetch/backend-darwin-arm64',
    assetName: 'impersonated-fetch-backend-darwin-arm64.dylib',
  },
  {
    target: 'win32-x64',
    packageName: '@impersonated-fetch/backend-win32-x64',
    assetName: 'impersonated-fetch-backend-win32-x64.dll',
  },
  {
    target: 'win32-x32',
    packageName: '@impersonated-fetch/backend-win32-x32',
    assetName: 'impersonated-fetch-backend-win32-x32.dll',
  },
  {
    target: 'win32-arm64',
    packageName: '@impersonated-fetch/backend-win32-arm64',
    assetName: 'impersonated-fetch-backend-win32-arm64.dll',
  },
];

export function assetNameForTarget(target) {
  const platform = platforms.find((candidate) => candidate.target === target);

  if (!platform) {
    throw new Error(`unsupported native backend target ${target}`);
  }

  return platform.assetName;
}
