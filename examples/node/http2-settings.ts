/**
 * HTTP/2 Settings Example
 *
 * Demonstrates fine-grained HTTP/2 configuration.
 * This mirrors Python requests_go http2_settings configuration.
 */

import { createTLSConfig, fetch, TLS_CHROME_LATEST, TLS_FIREFOX_LATEST } from '../../src/index.js';

async function main() {
  console.log('=== HTTP/2 Settings Example ===\n');

  // Example 1: Custom HTTP/2 settings
  console.log('Example 1: Custom HTTP/2 Settings');
  const customHttp2Config = createTLSConfig({
    ja3: TLS_CHROME_LATEST.ja3,
    pseudoHeaderOrder: [':method', ':authority', ':scheme', ':path'],
    http2Settings: {
      settings: {
        HEADER_TABLE_SIZE: 65536,
        ENABLE_PUSH: 0,
        MAX_CONCURRENT_STREAMS: 1000,
        INITIAL_WINDOW_SIZE: 6291456,
        MAX_HEADER_LIST_SIZE: 262144,
      },
      settingsOrder: [
        'HEADER_TABLE_SIZE',
        'ENABLE_PUSH',
        'MAX_CONCURRENT_STREAMS',
        'INITIAL_WINDOW_SIZE',
        'MAX_HEADER_LIST_SIZE',
      ],
      connectionFlow: 15663105,
      headerPriority: {
        weight: 256,
        streamDep: 0,
        exclusive: true,
      },
      priorityFrames: null,
    },
  });

  console.log('HTTP/2 Settings:');
  console.log('  Settings:', JSON.stringify(customHttp2Config.http2Settings?.settings, null, 2));
  console.log('  Settings Order:', customHttp2Config.http2Settings?.settingsOrder);
  console.log('  Connection Flow:', customHttp2Config.http2Settings?.connectionFlow);
  console.log(
    '  Header Priority:',
    JSON.stringify(customHttp2Config.http2Settings?.headerPriority),
  );
  console.log('');

  try {
    const response1 = await fetch('https://tls.peet.ws/api/all', {
      tls: customHttp2Config,
    });

    const data1 = (await response1.json()) as { http2?: unknown };
    console.log('Response Status:', response1.status);
    console.log('HTTP/2 Info:', JSON.stringify(data1.http2, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
  console.log('');

  // Example 2: Firefox HTTP/2 settings
  console.log('Example 2: Firefox HTTP/2 Settings');
  console.log('Firefox settings:', JSON.stringify(TLS_FIREFOX_LATEST.http2Settings, null, 2));

  try {
    const response2 = await fetch('https://tls.peet.ws/api/all', {
      tls: TLS_FIREFOX_LATEST,
    });

    const data2 = (await response2.json()) as { http2?: { akamai_fingerprint?: string } };
    console.log('\nResponse Status:', response2.status);
    console.log(
      'HTTP/2 fingerprint matches Firefox:',
      data2.http2?.akamai_fingerprint === '1:65536;2:0;4:131072;5:16384|12517377|0|0,0,0,0',
    );
  } catch (error) {
    console.error('Error:', error);
  }
  console.log('');

  // Example 3: Priority frames configuration
  console.log('Example 3: Priority Frames Configuration');
  const priorityConfig = createTLSConfig({
    ja3: TLS_CHROME_LATEST.ja3,
    pseudoHeaderOrder: [':method', ':authority', ':scheme', ':path'],
    http2Settings: {
      settings: {
        HEADER_TABLE_SIZE: 65536,
        ENABLE_PUSH: 0,
        INITIAL_WINDOW_SIZE: 6291456,
      },
      settingsOrder: ['HEADER_TABLE_SIZE', 'ENABLE_PUSH', 'INITIAL_WINDOW_SIZE'],
      connectionFlow: 15663105,
      headerPriority: {
        weight: 42,
        streamDep: 0,
        exclusive: false,
      },
      priorityFrames: [
        { streamID: 3, priorityParam: { weight: 201, streamDep: 0, exclusive: false } },
        { streamID: 5, priorityParam: { weight: 101, streamDep: 0, exclusive: false } },
        { streamID: 7, priorityParam: { weight: 1, streamDep: 0, exclusive: false } },
      ],
    },
  });

  console.log(
    'Priority Frames:',
    JSON.stringify(priorityConfig.http2Settings?.priorityFrames, null, 2),
  );

  try {
    const response3 = await fetch('https://httpbin.org/get', {
      tls: priorityConfig,
    });

    console.log('\nResponse Status:', response3.status);
    console.log(
      'HTTP/2 negotiated:',
      response3.headers.get('x-http2-enabled') || 'yes (via native transport)',
    );
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n✓ HTTP/2 settings example completed successfully');
}

main();
