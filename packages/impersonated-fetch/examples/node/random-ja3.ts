/**
 * Random JA3 Fingerprint Example
 *
 * Demonstrates JA3 fingerprint randomization to avoid tracking.
 * This mirrors Python requests_go random_ja3 feature.
 */

import { createRandomJa3Preset, fetch, TLS_CHROME_LATEST } from '../../src/index.js';

async function main() {
  console.log('=== Random JA3 Fingerprint Example ===\n');

  // Method 1: Enable random_ja3 on existing preset
  console.log('Method 1: Using random_ja3 on TLS_CHROME_LATEST');
  const randomizedChrome = { ...TLS_CHROME_LATEST, randomJa3: true };

  for (let i = 0; i < 3; i++) {
    try {
      const response = await fetch('https://tls.peet.ws/api/all', {
        tls: randomizedChrome,
      });

      const data = (await response.json()) as { tls?: { ja3?: string; ja3_hash?: string } };
      console.log(`  Request ${i + 1}:`);
      console.log(`    JA3: ${data.tls?.ja3}`);
      console.log(`    JA3 Hash: ${data.tls?.ja3_hash}`);
    } catch (error) {
      console.error(`  Error on request ${i + 1}:`, error);
    }
  }

  console.log('');

  // Method 2: Create a preset with random JA3 from a base JA3 string
  console.log('Method 2: Using createRandomJa3Preset');
  const baseJa3 =
    '771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-17513-21,29-23-24,0';
  const randomPreset = createRandomJa3Preset(baseJa3, {
    pseudoHeaderOrder: [':method', ':authority', ':scheme', ':path'],
  });

  for (let i = 0; i < 3; i++) {
    try {
      const response = await fetch('https://tls.peet.ws/api/all', {
        tls: randomPreset,
      });

      const data = (await response.json()) as { tls?: { ja3?: string; ja3_hash?: string } };
      console.log(`  Request ${i + 1}:`);
      console.log(`    JA3: ${data.tls?.ja3}`);
      console.log(`    JA3 Hash: ${data.tls?.ja3_hash}`);
    } catch (error) {
      console.error(`  Error on request ${i + 1}:`, error);
    }
  }

  console.log('\n✓ Random JA3 example completed successfully');
  console.log(
    '\nNote: Each request should have a different JA3 hash due to randomized extensions order',
  );
}

main();
