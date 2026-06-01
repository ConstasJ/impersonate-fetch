/**
 * Streaming Response Example
 *
 * Demonstrates handling streaming responses.
 * This mirrors Python requests_go streaming responses.
 */

import { fetch, TLS_CHROME_LATEST } from '../../src/index.js';

async function main() {
  console.log('=== Streaming Response Example ===\n');

  try {
    // Example 1: Streaming JSON lines (NDJSON)
    console.log('Example 1: Streaming NDJSON');
    const response1 = await fetch('https://httpbin.org/stream/5', {
      tls: TLS_CHROME_LATEST,
    });

    console.log('Status:', response1.status);
    console.log('Content-Type:', response1.headers.get('content-type'));

    if (response1.body) {
      const reader1 = response1.body.getReader();
      const decoder1 = new TextDecoder();
      let chunkCount = 0;

      console.log('Reading stream chunks:');
      while (true) {
        const { done, value } = await reader1.read();
        if (done) break;

        chunkCount++;
        const text = decoder1.decode(value, { stream: true });
        console.log(`  Chunk ${chunkCount}: ${text.length} bytes`);
      }
      console.log(`Total chunks received: ${chunkCount}`);
    }
    console.log('');

    // Example 2: Streaming with progress tracking
    console.log('Example 2: Streaming with progress tracking');
    const response2 = await fetch('https://httpbin.org/bytes/1024', {
      tls: TLS_CHROME_LATEST,
    });

    console.log('Status:', response2.status);
    console.log('Content-Length:', response2.headers.get('content-length'));

    if (response2.body) {
      const reader2 = response2.body.getReader();
      const contentLength = parseInt(response2.headers.get('content-length') || '0', 10);
      let receivedLength = 0;

      console.log('Downloading with progress:');
      while (true) {
        const { done, value } = await reader2.read();
        if (done) break;

        receivedLength += value.length;
        const progress = contentLength ? Math.round((receivedLength / contentLength) * 100) : 0;
        process.stdout.write(
          `\r  Progress: ${progress}% (${receivedLength}/${contentLength} bytes)`,
        );
      }
      console.log('\nDownload complete!');
    }
    console.log('');

    // Example 3: Streaming to buffer
    console.log('Example 3: Streaming to buffer');
    const response3 = await fetch('https://httpbin.org/bytes/256', {
      tls: TLS_CHROME_LATEST,
    });

    if (response3.body) {
      const reader3 = response3.body.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader3.read();
        if (done) break;
        chunks.push(value);
      }

      // Combine all chunks
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let position = 0;
      for (const chunk of chunks) {
        result.set(chunk, position);
        position += chunk.length;
      }

      console.log('Total bytes collected:', result.length);
      console.log(
        'First 16 bytes (hex):',
        Array.from(result.slice(0, 16))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(' '),
      );
    }

    console.log('\n✓ Streaming example completed successfully');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
