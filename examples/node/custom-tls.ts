/**
 * Custom TLS Configuration Example
 *
 * Demonstrates creating a custom TLSConfig with specific settings.
 * This mirrors Python requests_go TLSConfig customization.
 */

import { createTLSConfig, fetch, TLS_CHROME_LATEST } from '../../src/index.js';

async function main() {
  console.log('=== Custom TLS Configuration Example ===\n');

  try {
    // Create a custom TLS configuration
    const customTLS = createTLSConfig({
      ja3: '771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,16-18-5-27-0-13-11-43-45-35-51-23-10-65281-17513-21,29-23-24,0',
      pseudoHeaderOrder: [':method', ':authority', ':scheme', ':path'],
      tlsExtensions: {
        supportedSignatureAlgorithms: [
          'ecdsa_secp256r1_sha256',
          'rsa_pss_rsae_sha256',
          'rsa_pkcs1_sha256',
          'ecdsa_secp384r1_sha384',
          'rsa_pss_rsae_sha384',
          'rsa_pkcs1_sha384',
          'rsa_pss_rsae_sha512',
          'rsa_pkcs1_sha512',
        ],
        certCompressionAlgo: ['brotli'],
        supportedVersions: ['GREASE', '1.3', '1.2'],
        pskKeyExchangeModes: ['PskModeDHE'],
        keyShareCurves: ['GREASE', 'X25519'],
      },
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
      },
    });

    console.log('Custom TLS Configuration created:');
    console.log('  JA3:', customTLS.ja3);
    console.log('  Pseudo Header Order:', customTLS.pseudoHeaderOrder);
    console.log('  Force HTTP/1:', customTLS.forceHttp1);
    console.log('');

    // Use the custom TLS configuration
    const response = await fetch('https://tls.peet.ws/api/all', {
      tls: customTLS,
    });

    console.log('Response Status:', response.status);

    const data = (await response.json()) as { tls?: { ja3?: string; ja3_hash?: string } };
    console.log('\nTLS Fingerprint Info:');
    console.log('  JA3:', data.tls?.ja3);
    console.log('  JA3 Hash:', data.tls?.ja3_hash);

    console.log('\n✓ Custom TLS configuration example completed successfully');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
