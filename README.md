# impersonated-fetch

A Node.js Fetch-style HTTP client with TLS fingerprint impersonation capabilities. This project ports the [requests-go](https://github.com/wangluozhe/requests-go) Python library to Node.js, providing TLS/JA3 fingerprint spoofing and JA4-oriented header controls through a native Go backend.

## Overview

`impersonated-fetch` combines the familiar Fetch API interface with advanced TLS fingerprinting capabilities. It allows you to make HTTP requests that mimic specific browser fingerprints, helping you bypass bot detection systems that rely on TLS and HTTP/2 fingerprinting.

The project uses a native Go backend accessed via Koffi FFI to achieve low-level TLS control that is not possible with pure JavaScript.

## Installation

```bash
npm install impersonated-fetch
```

The package uses optional dependencies to install the correct native backend for your platform automatically. If optional dependencies are disabled, install the backend manually:

```bash
npm install impersonated-fetch @impersonated-fetch/backend-linux-x64
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

### Session with Cookie Persistence

```typescript
import { Client, TLS_CHROME_LATEST } from 'impersonated-fetch';

const client = new Client({
  tls: TLS_CHROME_LATEST,
});

// Cookies are automatically persisted across requests
await client.fetch('https://example.com/login', {
  method: 'POST',
  body: JSON.stringify({ username: 'user', password: 'pass' }),
});

const response = await client.fetch('https://example.com/profile');
await client.close();
```

## Key Features

- **TLS Fingerprint Spoofing**: JA3 fingerprint support with JA4-oriented header controls
- **HTTP/2 Settings Control**: Full control over HTTP/2 SETTINGS, WINDOW_UPDATE, and PRIORITY frames
- **Cookie Persistence**: Built-in cookie jar via `Client`/`Session` class using tough-cookie
- **Browser Presets**: Pre-configured fingerprints for Chrome, Firefox, Edge, and Safari
- **JA3 Randomization**: Built-in option to randomize JA3 signatures
- **Proxy Support**: HTTP, HTTPS, and SOCKS5 proxy support
- **Streaming Responses**: Native ReadableStream support for response streaming
- **Custom Header Order**: Control the order of HTTP headers
- **Promise-based API**: Native async/await support with standard Fetch API compatibility

## Project Structure

This is a pnpm/Nx monorepo with the following packages:

```
impersonated-fetch/
├── packages/
│   ├── impersonated-fetch/    # Main TypeScript package
│   └── native-backend/        # Go native backend package
├── examples/                  # Usage examples
└── .github/workflows/          # CI/CD workflows
```

### Packages

- **[impersonated-fetch](./packages/impersonated-fetch/README.md)**: The main TypeScript package providing the Fetch API with TLS impersonation
- **[native-backend](./packages/native-backend/README.md)**: Go source package for building the native shared library backend

## Development

### Prerequisites

- Node.js 18+ and pnpm 11+
- Go 1.25+ (for native backend development)
- Nx (for monorepo task orchestration)

### Setup

```bash
# Install dependencies
pnpm install

# Build the main package
pnpm run build

# Build the native backend (requires Go)
pnpm run native-backend:build

# Run tests
pnpm test
```

### Available Scripts

- `pnpm run build` - Build the main TypeScript package
- `pnpm run test` - Run all tests
- `pnpm run lint` - Run linting
- `pnpm run typecheck` - Run TypeScript type checking
- `pnpm run native-backend:build` - Build the native Go backend
- `pnpm run native-backend:package-generate` - Generate platform-specific npm packages

## Supported Platforms

- **Linux**: x64, x32, ARM64
- **macOS**: x64, ARM64 (Apple Silicon)
- **Windows**: x64, x32, ARM64

## Security Notice

This package is designed for legitimate use cases such as web scraping, automated testing, and security research with proper authorization. Do not use it to circumvent security measures on systems you do not own or have permission to test.

## Contributing

Contributions are welcome. Please ensure your code follows the existing patterns and includes appropriate tests.

## License

MIT

## Acknowledgments

- [@wangluozhe](https://github.com/wangluozhe) for developing the original requests-go library
