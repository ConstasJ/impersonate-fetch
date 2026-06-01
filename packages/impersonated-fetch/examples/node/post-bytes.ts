/**
 * POST Binary Data Example
 *
 * Demonstrates sending binary data in POST requests.
 * This mirrors Python requests_go POST with bytes/data parameter.
 */

import { fetch, TLS_CHROME_LATEST } from '../../src/index.js';

async function main() {
  console.log('=== POST Binary Data Example ===\n');

  try {
    // Method 1: Sending raw bytes (ArrayBuffer)
    console.log('Method 1: Sending ArrayBuffer');
    const binaryData = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe, 0xfd, 0xfc]);

    const response1 = await fetch('https://httpbin.org/post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: binaryData,
      tls: TLS_CHROME_LATEST,
    });

    const data1 = (await response1.json()) as { data?: unknown };
    console.log('Response Status:', response1.status);
    console.log('Data length sent:', binaryData.length);
    console.log('Data received (base64):', data1.data);
    console.log('');

    // Method 2: Sending a Blob
    console.log('Method 2: Sending Blob');
    const blobData = new Blob(['Hello, World!'], { type: 'text/plain' });

    const response2 = await fetch('https://httpbin.org/post', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: blobData,
      tls: TLS_CHROME_LATEST,
    });

    const data2 = (await response2.json()) as { data?: unknown };
    console.log('Response Status:', response2.status);
    console.log('Data received:', data2.data);
    console.log('');

    // Method 3: Sending protobuf-like binary (simulated)
    console.log('Method 3: Sending protobuf-like binary');
    // Simulate a protobuf message
    const protobufData = new Uint8Array([
      0x08,
      0x96,
      0x01, // field 1, varint 150
      0x12,
      0x0b,
      0x48,
      0x65,
      0x6c,
      0x6c,
      0x6f,
      0x20,
      0x57,
      0x6f,
      0x72,
      0x6c,
      0x64, // field 2, string "Hello World"
    ]);

    const response3 = await fetch('https://httpbin.org/post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-protobuf',
      },
      body: protobufData,
      tls: TLS_CHROME_LATEST,
    });

    const data3 = (await response3.json()) as { data?: unknown };
    console.log('Response Status:', response3.status);
    console.log('Protobuf data length:', protobufData.length);
    console.log('Data received (base64):', data3.data);

    console.log('\n✓ POST binary data example completed successfully');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
