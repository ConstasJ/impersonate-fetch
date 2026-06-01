# impersonated-fetch

A Node.js Fetch-style HTTP client with TLS fingerprint impersonation capabilities. This package ports the [requests-go](https://github.com/wangluozhe/requests-go) Python library to Node.js, providing TLS/JA3 fingerprint spoofing and JA4-oriented header controls through a modern, Promise-based API.

## Overview

`impersonated-fetch` combines the familiar Fetch API interface with advanced TLS fingerprinting capabilities. It allows you to make HTTP requests that mimic specific browser fingerprints, helping you bypass bot detection systems that rely on TLS and HTTP/2 fingerprinting.

## Installation

```bash
npm install impersonated-fetch
```

## Quick Start

```typescript
import { fetch, TLS_CHROME_LATEST } from 'impersonated-fetch';

// Simple GET request with Chrome TLS fingerprint
const response = await fetch('https://httpbin.org/get', {
  tls: TLS_CHROME_LATEST,
});

const data = await response.json();
console.log(data);
```

## Node Package Usage

### Basic Usage

The package exports a `fetch` function that is API-compatible with the standard Fetch API, with additional options for TLS impersonation:

```typescript
import { fetch, TLS_CHROME_LATEST } from 'impersonated-fetch';

const response = await fetch('https://example.com', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ key: 'value' }),
  tls: TLS_CHROME_LATEST,
});
```

### Client/Session with Cookie Persistence

For maintaining cookies across requests, use the `Client` or `Session` class:

```typescript
import { Client, TLS_CHROME_LATEST } from 'impersonated-fetch';

const client = new Client({
  tls: TLS_CHROME_LATEST,
});

// Cookies are automatically persisted
await client.fetch('https://example.com/login', {
  method: 'POST',
  body: JSON.stringify({ username: 'user', password: 'pass' }),
});

// Subsequent requests include cookies
const response = await client.fetch('https://example.com/profile');

// Clean up when done
await client.close();
```

### Browser Presets

The package includes pre-configured TLS fingerprints for popular browsers:

```typescript
import {
  TLS_CHROME_LATEST,
  TLS_CHROME_110,
  TLS_CHROME_101,
  TLS_EDGE_LATEST,
  TLS_FIREFOX_LATEST,
  TLS_FIREFOX_105,
  TLS_SAFARI_MAC_OS_18_3,
  TLS_SAFARI_IOS_18_3_1,
} from 'impersonated-fetch';
```

### Custom TLS Configuration

Create custom TLS configurations for specific fingerprinting needs:

```typescript
import { createTLSConfig } from 'impersonated-fetch';

const customTLS = createTLSConfig({
  ja3: '771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,16-18-5-27-0-13-11-43-45-35-51-23-10-65281-17513-21,29-23-24,0',
  pseudoHeaderOrder: [':method', ':authority', ':scheme', ':path'],
  tlsExtensions: {
    supportedSignatureAlgorithms: [
      'ecdsa_secp256r1_sha256',
      'rsa_pss_rsae_sha256',
      'rsa_pkcs1_sha256',
    ],
    certCompressionAlgo: ['brotli'],
    supportedVersions: ['GREASE', '1.3', '1.2'],
    keyShareCurves: ['GREASE', 'X25519'],
  },
  http2Settings: {
    settings: {
      HEADER_TABLE_SIZE: 65536,
      ENABLE_PUSH: 0,
      MAX_CONCURRENT_STREAMS: 1000,
      INITIAL_WINDOW_SIZE: 6291456,
    },
    settingsOrder: ['HEADER_TABLE_SIZE', 'ENABLE_PUSH', 'MAX_CONCURRENT_STREAMS', 'INITIAL_WINDOW_SIZE'],
    connectionFlow: 15663105,
  },
});
```

## Unsupported Scope

The following features from `requests_go` are **not supported** in the Node.js port:

- **Async/await Session API**: The Python `AsyncSession` is replaced by standard Promise-based `Client`
- **Python-specific cipher utilities**: The `ciphers` module for cipher suite conversion is not available
- **Direct Wireshark hex stream**: The `client_hello_hex_stream` feature for raw TLS packets is not supported
- **Python pickle serialization**: Session persistence via pickle is not available

## Capability Matrix

| Feature | Python requests_go | Node impersonated-fetch | Notes |
|---------|-------------------|------------------------|-------|
| TLS fingerprint spoofing | Yes | Yes | JA3 support; JA4-oriented controls |
| HTTP/2 settings control | Yes | Yes | SETTINGS, WINDOW_UPDATE, PRIORITY |
| Cookie persistence | Yes | Yes | Via Client/Session class |
| Browser presets | Yes | Yes | Chrome, Firefox, Edge, Safari |
| JA3 randomization | Yes | Yes | `randomJa3` option |
| Proxy support | Yes | Yes | HTTP, HTTPS, SOCKS5 |
| Streaming responses | Yes | Yes | Via ReadableStream |
| Custom headers order | Yes | Yes | `headersOrder` option |
| Async/await | Yes | Yes | Native Promise-based |
| HTTP/1.1 force mode | Yes | Yes | `forceHttp1` option |

## No-Silent-Degradation Behavior

This package follows a strict "no silent degradation" policy:

- If a requested TLS feature cannot be applied, the request will **fail with an error** rather than silently falling back to default behavior
- Native transport capabilities are checked at runtime, and missing capabilities result in clear error messages
- Invalid TLS configurations throw `ValidationError` with descriptive messages
- Network errors are wrapped in `ImpersonatedFetchError` with context about what operation failed

Example error handling:

```typescript
import { fetch, ImpersonatedFetchError, UnsupportedCapabilityError } from 'impersonated-fetch';

try {
  const response = await fetch('https://example.com', {
    tls: customConfig,
  });
} catch (error) {
  if (error instanceof UnsupportedCapabilityError) {
    console.error('Native transport does not support:', error.capability);
  } else if (error instanceof ImpersonatedFetchError) {
    console.error('Request failed:', error.message);
  }
}
```

## Native Asset Support

The package uses native bindings to achieve TLS fingerprint impersonation. Production installs use
generated optional backend packages such as `@impersonated-fetch/backend-win32-x64`; the main
`impersonated-fetch` package does not ship `native/*.dll`, `native/*.so`, or `native/*.dylib`
fallback binaries.

Runtime resolution order:

1. Explicit native asset paths and shim command overrides passed through advanced native binding
   options.
2. A sibling source-built backend at `packages/native-backend/dist`, when present in a monorepo
   checkout.
3. A generated scoped backend package such as `@impersonated-fetch/backend-win32-x64`, when
   installed.

Generated backend packages use the naming scheme
`@impersonated-fetch/backend-<platform>-<arch>` and contain one artifact named
`impersonated-fetch-backend-<platform>-<arch>.<ext>`.

### Supported Platforms

- **Linux**: x64, x32, ARM64
- **macOS**: x64, ARM64 (Apple Silicon)
- **Windows**: x64, x32, ARM64

### Platform Limitations

The following platforms are **not supported**:

- ARM32 architectures
- FreeBSD, OpenBSD, or other Unix variants
- Web browsers (this is a Node.js package only)
- Deno or Bun runtimes (Node.js only)

If you attempt to use the package on an unsupported platform, you will receive a `NativeAssetNotFoundError` with instructions on supported platforms.

If a supported platform is missing its optional backend dependency, reinstall with optional
dependencies enabled or install the matching generated package explicitly, for example:

```bash
npm install impersonated-fetch @impersonated-fetch/backend-linux-x64
```

If a generated package is installed but its native artifact is missing, loading fails with a clear
native asset error so a broken package cannot silently degrade to a different backend.

### Phase 1 backend rollback

The source-owned Go backend is currently a transitional `wangluozhe/requests`-based compatibility
backend. If Phase 1 parity validation finds a regression, rollback by pinning or regenerating the
affected `@impersonated-fetch/backend-*` package, or by using an explicit native asset override for
controlled testing. There is no bundled closed-backend fallback in the main package.

Phase 2 is expected to move the owned backend toward direct `chttp` usage once the Phase 1 package,
CI, and differential oracle gates are stable.

## Security and Ethics Warning

**IMPORTANT**: This package is designed for legitimate use cases such as:

- Web scraping for data collection and research
- Automated testing of web applications
- Security research and penetration testing with proper authorization
- Bypassing overly aggressive bot detection for legitimate automation

**You must NOT use this package for**:

- Circumventing security measures on systems you do not own or have explicit permission to test
- Automated attacks, credential stuffing, or unauthorized access attempts
- Violating terms of service of websites
- Any illegal activities

**Responsibilities**:

- Always respect robots.txt and rate limits
- Ensure you have proper authorization before testing any system
- Be aware that TLS fingerprint spoofing may violate some services' terms of use
- The authors are not responsible for misuse of this software

## Migration from Python requests_go

If you are migrating from Python `requests_go`, here is a mapping guide:

### Import and Basic Request

**Python:**
```python
import requests_go as requests

response = requests.get('https://httpbin.org/get', tls_config=requests.tls_config.TLS_CHROME_LATEST)
```

**Node.js:**
```typescript
import { fetch, TLS_CHROME_LATEST } from 'impersonated-fetch';

const response = await fetch('https://httpbin.org/get', {
  tls: TLS_CHROME_LATEST,
});
```

### Session with Cookies

**Python:**
```python
session = requests.Session()
session.tls_config = TLS_CHROME_LATEST
response = session.get('https://httpbin.org/get')
```

**Node.js:**
```typescript
const client = new Client({
  tls: TLS_CHROME_LATEST,
});
const response = await client.fetch('https://httpbin.org/get');
```

### Custom TLS Configuration

**Python:**
```python
conf = tls_config.TLSConfig()
conf.ja3 = "771,4865-4866-4867-..."
conf.pseudo_header_order = [":method", ":authority", ":scheme", ":path"]
```

**Node.js:**
```typescript
const conf = createTLSConfig({
  ja3: "771,4865-4866-4867-...",
  pseudoHeaderOrder: [":method", ":authority", ":scheme", ":path"],
});
```

### POST Requests

**Python:**
```python
response = requests.post(
    'https://httpbin.org/post',
    json={'key': 'value'},
    tls_config=TLS_CHROME_LATEST
)
```

**Node.js:**
```typescript
const response = await fetch('https://httpbin.org/post', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: 'value' }),
  tls: TLS_CHROME_LATEST,
});
```

### JA3 Randomization

**Python:**
```python
TLS_CHROME_LATEST.random_ja3 = True
```

**Node.js:**
```typescript
const config = { ...TLS_CHROME_LATEST, randomJa3: true };
```

### Proxy Configuration

**Python:**
```python
proxies = {
    'http': 'http://127.0.0.1:7890',
    'https': 'http://127.0.0.1:7890',
}
response = requests.get('https://httpbin.org/ip', proxies=proxies, tls_config=TLS_CHROME_LATEST)
```

**Node.js:**
```typescript
const response = await fetch('https://httpbin.org/ip', {
  tls: TLS_CHROME_LATEST,
  proxy: 'http://127.0.0.1:7890',
});
```

## Examples

See the `examples/node/` directory for complete working examples:

- `basic-get.ts` - Simple GET request
- `client-cookies.ts` - Client with cookie persistence
- `custom-tls.ts` - Custom TLS configuration
- `chrome-preset.ts` - Chrome browser preset
- `random-ja3.ts` - Random JA3 generation
- `ja4-headers.ts` - JA4 header controls
- `post-json.ts` - POST JSON data
- `post-data.ts` - POST form data
- `post-bytes.ts` - POST binary data
- `streaming.ts` - Streaming response
- `proxy.ts` - Proxy configuration
- `http2-settings.ts` - HTTP/2 settings

Type-check examples:

```bash
npm run typecheck:examples
```

## API Reference

### fetch(input, init)

Makes an HTTP request with optional TLS impersonation.

**Parameters:**
- `input: string | URL | Request` - The resource to fetch
- `init?: FetchInit` - Optional request configuration

**Returns:** `Promise<FetchResponse>`

### Client

A class for maintaining session state including cookies.

**Constructor:**
- `new Client(options?: ClientOptions)`

**Methods:**
- `fetch(input, init): Promise<FetchResponse>` - Make a request
- `close(): Promise<void>` - Clean up resources

### createTLSConfig(options)

Creates a custom TLS configuration.

**Parameters:**
- `options: Partial<TLSConfig>` - TLS configuration options

**Returns:** `TLSConfig`

### Browser Presets

Pre-configured TLS fingerprints:

- `TLS_CHROME_LATEST`
- `TLS_CHROME_131`, `TLS_CHROME_130`, `TLS_CHROME_122`, `TLS_CHROME_110`, `TLS_CHROME_103`, `TLS_CHROME_101`
- `TLS_EDGE_LATEST`, `TLS_EDGE_131`
- `TLS_FIREFOX_LATEST`, `TLS_FIREFOX_135`, `TLS_FIREFOX_134`, `TLS_FIREFOX_126`, `TLS_FIREFOX_105`
- `TLS_SAFARI_MAC_OS_18_3`, `TLS_SAFARI_IOS_18_3_1`

## License

MIT

## Contributing

Contributions are welcome. Please ensure your code follows the existing patterns and includes appropriate tests.

## Thnaks

- @wangluozhe: Developing the original requests-go library
