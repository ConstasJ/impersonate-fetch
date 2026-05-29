/**
 * Proxy Configuration Example
 *
 * Demonstrates using proxy servers with requests.
 * This mirrors Python requests_go proxy configuration.
 */

import { Client, fetch, TLS_CHROME_LATEST } from '../../src/index.js';

async function main() {
  console.log('=== Proxy Configuration Example ===\n');

  console.log('Note: This example requires a proxy server to be running.');
  console.log('The proxy settings shown here demonstrate the API usage.\n');

  // Example 1: HTTP proxy with fetch
  console.log('Example 1: HTTP Proxy with fetch');
  try {
    const response1 = await fetch('https://httpbin.org/ip', {
      tls: TLS_CHROME_LATEST,
      proxy: 'http://127.0.0.1:7890',
    });

    console.log('Status:', response1.status);
    const data1 = await response1.json();
    console.log('Response:', JSON.stringify(data1, null, 2));
  } catch (error) {
    console.log('Expected error (no proxy running):', (error as Error).message);
  }
  console.log('');

  // Example 2: SOCKS5 proxy
  console.log('Example 2: SOCKS5 Proxy');
  try {
    const response2 = await fetch('https://httpbin.org/ip', {
      tls: TLS_CHROME_LATEST,
      proxy: 'socks5://127.0.0.1:1080',
    });

    console.log('Status:', response2.status);
    const data2 = await response2.json();
    console.log('Response:', JSON.stringify(data2, null, 2));
  } catch (error) {
    console.log('Expected error (no proxy running):', (error as Error).message);
  }
  console.log('');

  // Example 3: Client with default proxy
  console.log('Example 3: Client with default proxy');
  const client = new Client({
    tls: TLS_CHROME_LATEST,
    proxy: 'http://127.0.0.1:7890',
  });

  try {
    const response3 = await client.fetch('https://httpbin.org/ip');
    console.log('Status:', response3.status);
    const data3 = await response3.json();
    console.log('Response:', JSON.stringify(data3, null, 2));
  } catch (error) {
    console.log('Expected error (no proxy running):', (error as Error).message);
  }

  await client.close();
  console.log('');

  // Example 4: Per-request proxy override
  console.log('Example 4: Per-request proxy override');
  const client2 = new Client({
    tls: TLS_CHROME_LATEST,
    // Default proxy
    proxy: 'http://default-proxy:8080',
  });

  console.log('Client has default proxy, but we can override per request:');
  console.log('  await client.fetch(url, { proxy: "http://special-proxy:8080" })');

  await client2.close();

  console.log('\n✓ Proxy configuration example completed');
  console.log('\nProxy URL formats supported:');
  console.log('  - http://host:port');
  console.log('  - https://host:port');
  console.log('  - socks5://host:port');
  console.log('  - http://user:pass@host:port (with auth)');
}

main();
