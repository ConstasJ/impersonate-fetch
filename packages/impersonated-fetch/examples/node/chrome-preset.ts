/**
 * Chrome Browser Preset Example
 *
 * Demonstrates using built-in Chrome browser presets.
 * This mirrors Python requests_go TLS_CHROME_LATEST usage.
 */

import {
  fetch,
  TLS_CHROME_101,
  TLS_CHROME_110,
  TLS_CHROME_LATEST,
  TLS_EDGE_LATEST,
} from '../../src/index.js';

async function main() {
  console.log('=== Chrome Browser Preset Example ===\n');

  const presets = [
    { name: 'TLS_CHROME_LATEST', config: TLS_CHROME_LATEST },
    { name: 'TLS_CHROME_110', config: TLS_CHROME_110 },
    { name: 'TLS_CHROME_101', config: TLS_CHROME_101 },
    { name: 'TLS_EDGE_LATEST', config: TLS_EDGE_LATEST },
  ];

  for (const { name, config } of presets) {
    try {
      console.log(`Testing ${name}...`);

      const response = await fetch('https://tls.peet.ws/api/all', {
        tls: config,
      });

      const data = (await response.json()) as { tls?: { ja3?: string; ja3_hash?: string } };
      console.log(`  Status: ${response.status}`);
      console.log(`  JA3: ${data.tls?.ja3}`);
      console.log(`  JA3 Hash: ${data.tls?.ja3_hash}`);
      console.log('');
    } catch (error) {
      console.error(`  Error with ${name}:`, error);
    }
  }

  console.log('✓ Chrome preset example completed successfully');
}

main();
