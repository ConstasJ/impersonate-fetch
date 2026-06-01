/**
 * POST JSON Data Example
 *
 * Demonstrates sending JSON data in POST requests.
 * This mirrors Python requests_go POST with json parameter.
 */

import { fetch, TLS_CHROME_LATEST } from '../../src/index.js';

async function main() {
  console.log('=== POST JSON Data Example ===\n');

  try {
    // POST JSON data
    const jsonData = {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
      hobbies: ['reading', 'coding', 'gaming'],
    };

    console.log('Sending JSON data:', JSON.stringify(jsonData, null, 2));
    console.log('');

    const response = await fetch('https://httpbin.org/post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(jsonData),
      tls: TLS_CHROME_LATEST,
    });

    console.log('Response Status:', response.status);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));

    const data = (await response.json()) as { json?: unknown };
    console.log('\nResponse Body:');
    console.log(JSON.stringify(data, null, 2));

    // Verify the data was echoed back correctly
    console.log('\nVerification:');
    console.log(
      '  Sent data matches received:',
      JSON.stringify(data.json) === JSON.stringify(jsonData),
    );

    console.log('\n✓ POST JSON example completed successfully');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
