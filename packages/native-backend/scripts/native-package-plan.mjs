import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const platforms = [
  { packageName: '@impersonated-fetch/backend-linux-x64', assetName: 'requests-go-amd64.so' },
  { packageName: '@impersonated-fetch/backend-linux-x32', assetName: 'requests-go-x86.so' },
  { packageName: '@impersonated-fetch/backend-linux-arm64', assetName: 'requests-go-arm64.so' },
  { packageName: '@impersonated-fetch/backend-darwin-x64', assetName: 'requests-go-x86.dylib' },
  { packageName: '@impersonated-fetch/backend-darwin-arm64', assetName: 'requests-go-arm64.dylib' },
  { packageName: '@impersonated-fetch/backend-win32-x64', assetName: 'requests-go-win64.dll' },
  { packageName: '@impersonated-fetch/backend-win32-x32', assetName: 'requests-go-win32.dll' },
  {
    packageName: '@impersonated-fetch/backend-win32-arm64',
    assetName: 'requests-go-win-arm64.dll',
  },
];

const outputDir = resolve('dist', 'native-packages');
mkdirSync(outputDir, { recursive: true });
writeFileSync(
  resolve(outputDir, 'plan.json'),
  `${JSON.stringify({ generatedOutsideWorkspace: true, platforms }, null, 2)}\n`,
);

console.log(`Wrote ${resolve(outputDir, 'plan.json')}`);
