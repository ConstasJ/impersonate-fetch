/**
 * Client/Session with Cookie Persistence Example
 *
 * Demonstrates using a Client/Session to maintain cookies across requests.
 * This mirrors Python requests_go Session behavior.
 */

import { Client, TLS_CHROME_LATEST } from '../../src/index.js';

async function main() {
  console.log('=== Client/Session Cookie Persistence Example ===\n');

  // Create a client with cookie persistence
  const client = new Client({
    tls: TLS_CHROME_LATEST,
  });

  try {
    // First request: Set cookies via httpbin
    console.log('1. Setting cookies...');
    const response1 = await client.fetch(
      'https://httpbin.org/cookies/set?session_id=abc123&user=john_doe',
    );
    console.log('   Status:', response1.status);
    console.log(
      '   Cookies stored:',
      client.cookies.getCookieHeader(
        new URL('https://httpbin.org'),
        'include',
        new URL('https://httpbin.org'),
      ),
    );

    // Second request: Cookies should be automatically sent
    console.log('\n2. Making second request (cookies should persist)...');
    const response2 = await client.fetch('https://httpbin.org/cookies');
    const data2 = await response2.json();
    console.log('   Response:', JSON.stringify(data2, null, 2));

    // Third request: Set additional cookies
    console.log('\n3. Setting additional cookies...');
    const response3 = await client.fetch('https://httpbin.org/cookies/set?theme=dark&lang=en');
    console.log('   Status:', response3.status);

    // Fourth request: Verify all cookies are present
    console.log('\n4. Verifying all cookies...');
    const response4 = await client.fetch('https://httpbin.org/cookies');
    const data4 = await response4.json();
    console.log('   All cookies:', JSON.stringify(data4, null, 2));

    // Cleanup
    await client.close();
    console.log('\n✓ Cookie persistence example completed successfully');
  } catch (error) {
    console.error('Error:', error);
    await client.close();
    process.exit(1);
  }
}

main();
