import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { platforms } from './platform-assets.mjs';

const outputDir = resolve('dist', 'native-packages');
mkdirSync(outputDir, { recursive: true });
writeFileSync(
  resolve(outputDir, 'plan.json'),
  `${JSON.stringify({ generatedOutsideWorkspace: true, platforms }, null, 2)}\n`,
);

console.log(`Wrote ${resolve(outputDir, 'plan.json')}`);
