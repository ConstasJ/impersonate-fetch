/**
 * Basic GET Request Example
 *
 * Demonstrates a simple GET request using the impersonated-fetch library.
 * This mirrors the Python requests_go basic usage pattern.
 */

import { fetch, TLS_CHROME_LATEST } from '../../src/index.js';

async function main() {
  console.log('=== Basic GET Request Example ===\n');

  try {
    // Simple GET request with Chrome TLS fingerprint
    const response = await fetch('https://httpbin.org/get', {
      tls: TLS_CHROME_LATEST,
    });

    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));

    const data = await response.json();
    console.log('\nResponse Body:');
    console.log(JSON.stringify(data, null, 2));

    console.log('\n✓ Basic GET request completed successfully');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
