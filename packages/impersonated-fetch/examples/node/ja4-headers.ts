/**
 * JA4 Headers Example
 *
 * Demonstrates JA4 fingerprint control via header ordering and TLS settings.
 * This mirrors Python requests_go JA4 configuration.
 */

import { createTLSConfig, fetch } from '../../src/index.js';

async function main() {
  console.log('=== JA4 Headers Example ===\n');

  try {
    // Create a TLS config optimized for JA4 fingerprinting
    const ja4Config = createTLSConfig({
      ja3: '772,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-17513-21-41,29-23-24,0',
      forceHttp1: true, // JA4 often requires HTTP/1.1 for specific fingerprinting
      headersOrder: [
        'host',
        'connection',
        'pragma',
        'cache-control',
        'sec-ch-ua',
        'sec-ch-ua-mobile',
        'sec-ch-ua-platform',
        'upgrade-insecure-requests',
        'user-agent',
        'accept',
        'sec-fetch-site',
        'sec-fetch-mode',
        'sec-fetch-user',
        'sec-fetch-dest',
        'accept-encoding',
        'accept-language',
      ],
      unChangedHeaderKey: ['sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform'],
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
      },
    });

    console.log('JA4-optimized TLS Configuration:');
    console.log('  JA3:', ja4Config.ja3);
    console.log('  Force HTTP/1:', ja4Config.forceHttp1);
    console.log('  Headers Order:', ja4Config.headersOrder);
    console.log('');

    const headers = {
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      Pragma: 'no-cache',
      'sec-ch-ua': '".Not/A)Brand";v="99", "Google Chrome";v="103", "Chromium";v="103"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36',
    };

    const response = await fetch('https://tls.peet.ws/api/all', {
      headers,
      tls: ja4Config,
    });

    const data = (await response.json()) as {
      tls?: { ja3?: string; ja3_hash?: string; ja4?: string };
      http2?: { ja4h?: string };
    };
    console.log('Response:');
    console.log('  Status:', response.status);
    console.log('  JA3:', data.tls?.ja3);
    console.log('  JA3 Hash:', data.tls?.ja3_hash);
    console.log('  JA4:', data.tls?.ja4);
    console.log('  JA4H:', data.http2?.ja4h);

    console.log('\n✓ JA4 headers example completed successfully');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
