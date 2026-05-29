import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  platform: 'node',
  target: 'es2022',
  sourcemap: false,
  report: false,
  dts: true,
  clean: true,
});
