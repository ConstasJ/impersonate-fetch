export const platforms = [
  {
    target: 'linux-x64',
    goos: 'linux',
    goarch: 'amd64',
    npmOS: 'linux',
    npmCPU: 'x64',
    packageName: '@impersonated-fetch/backend-linux-x64',
    assetName: 'impersonated-fetch-backend-linux-x64.so',
  },
  {
    target: 'linux-x32',
    goos: 'linux',
    goarch: '386',
    npmOS: 'linux',
    npmCPU: 'ia32',
    packageName: '@impersonated-fetch/backend-linux-x32',
    assetName: 'impersonated-fetch-backend-linux-x32.so',
  },
  {
    target: 'linux-arm64',
    goos: 'linux',
    goarch: 'arm64',
    npmOS: 'linux',
    npmCPU: 'arm64',
    packageName: '@impersonated-fetch/backend-linux-arm64',
    assetName: 'impersonated-fetch-backend-linux-arm64.so',
  },
  {
    target: 'darwin-x64',
    goos: 'darwin',
    goarch: 'amd64',
    npmOS: 'darwin',
    npmCPU: 'x64',
    packageName: '@impersonated-fetch/backend-darwin-x64',
    assetName: 'impersonated-fetch-backend-darwin-x64.dylib',
  },
  {
    target: 'darwin-arm64',
    goos: 'darwin',
    goarch: 'arm64',
    npmOS: 'darwin',
    npmCPU: 'arm64',
    packageName: '@impersonated-fetch/backend-darwin-arm64',
    assetName: 'impersonated-fetch-backend-darwin-arm64.dylib',
  },
  {
    target: 'win32-x64',
    goos: 'windows',
    goarch: 'amd64',
    npmOS: 'win32',
    npmCPU: 'x64',
    packageName: '@impersonated-fetch/backend-win32-x64',
    assetName: 'impersonated-fetch-backend-win32-x64.dll',
  },
  {
    target: 'win32-x32',
    goos: 'windows',
    goarch: '386',
    npmOS: 'win32',
    npmCPU: 'ia32',
    packageName: '@impersonated-fetch/backend-win32-x32',
    assetName: 'impersonated-fetch-backend-win32-x32.dll',
  },
  {
    target: 'win32-arm64',
    goos: 'windows',
    goarch: 'arm64',
    npmOS: 'win32',
    npmCPU: 'arm64',
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

export function platformForTarget(target) {
  const platform = platforms.find((candidate) => candidate.target === target);

  if (!platform) {
    throw new Error(`unsupported native backend target ${target}`);
  }

  return platform;
}
