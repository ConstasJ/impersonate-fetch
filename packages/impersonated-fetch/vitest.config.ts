import { configDefaults, defineConfig } from 'vitest/config';

const fingerprintSmokeTest = 'test/fingerprint/smoke.test.ts';
const runsFingerprintSmoke = process.argv.some((argument) =>
  argument.replaceAll('\\', '/').includes(fingerprintSmokeTest),
);

export default defineConfig({
  test: {
    exclude: runsFingerprintSmoke
      ? configDefaults.exclude
      : [...configDefaults.exclude, fingerprintSmokeTest],
    globals: true,
    environment: 'node',
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
});
