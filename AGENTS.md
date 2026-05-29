# PROJECT KNOWLEDGE BASE: impersonated-fetch

**Generated:** 2025-05-29
**Project:** Node.js HTTP client with TLS fingerprint impersonation

## OVERVIEW

impersonated-fetch is a Node.js Fetch-style HTTP client that ports Python's `requests_go` to Node.js. It provides TLS/JA3 fingerprint spoofing and JA4-oriented header controls through a native Go backend accessed via Koffi FFI.

## STRUCTURE

```
impersonated-fetch/
├── src/                    # Source code
│   ├── impersonation/      # TLS fingerprint configuration
│   ├── native/             # FFI bindings to Go backend
│   ├── transport/          # Transport abstraction layer
│   ├── index.ts            # Main exports
│   ├── client.ts           # Client/Session with cookie persistence
│   ├── fetch.ts            # Core fetch implementation
│   └── errors.ts           # Error classes
├── test/                   # Vitest tests
├── examples/node/          # Usage examples
├── requests-go/            # Native Go backend (git submodule)
└── dist/                   # Build output (ESM)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add browser preset | `src/impersonation/presets.ts` | Copy existing Chrome/Firefox pattern |
| Custom TLS config | `src/impersonation/config.ts` | `createTLSConfig()` factory |
| Native asset loading | `src/native/assets.ts` | Platform detection logic |
| FFI bindings | `src/native/bindings*.ts` | Koffi interop layer |
| Error handling | `src/errors.ts` | Error class hierarchy |
| Cookie handling | `src/cookies.ts` | tough-cookie wrapper |
| Response body | `src/body.ts` | FetchBody base class |

## CODE MAP

| Symbol | Type | File | Role |
|--------|------|------|------|
| fetch | Function | `fetch.ts` | Main API entry point |
| Client | Class | `client.ts` | Session with cookie jar |
| Session | Class | `client.ts` | Alias for Client |
| TLSConfig | Interface | `impersonation/types.ts` | TLS fingerprint config |
| NativeFfiClient | Class | `native/ffi.ts` | FFI wrapper |
| createTLSConfig | Function | `impersonation/config.ts` | Config factory |
| browserPresets | Object | `impersonation/presets.ts` | Chrome/Firefox/Edge/Safari presets |

## CONVENTIONS

### Code Style (Biome enforced)
- Single quotes, 100 char line width, 2-space indent
- Trailing commas in objects/arrays
- LF line endings
- `verbatimModuleSyntax: true` - use `import type` for types

### Import Patterns
- All imports use `.js` extension (Node ESM)
- Type imports: `import type { X } from './file.js'`
- Re-exports: `export * from './file.js'`

### Error Handling
- Custom error hierarchy under `ImpersonatedFetchError`
- Native errors wrapped with context
- Validation errors include field name

### Naming
- Types: PascalCase
- Functions: camelCase
- Constants: UPPER_SNAKE_CASE for presets
- Private: `private readonly` prefix, not `_`

## ANTI-PATTERNS (THIS PROJECT)

- **No `@ts-ignore` or `as any`** - Strict TypeScript throughout
- **No browser-only RequestInit fields** - `mode`, `cache`, `integrity`, `referrerPolicy` throw
- **No sync native calls** - All FFI is async
- **No pickle/hex stream** - Unlike Python version
- **No direct Go calls** - Always use bindings abstraction

## COMMANDS

```bash
# Development
pnpm install
pnpm run build          # tsdown bundler
pnpm run typecheck      # tsc --noEmit
pnpm run lint           # biome check
pnpm run lint:fix       # biome check --write

# Testing
pnpm test               # Build + vitest
pnpm run test:watch     # Vitest watch mode
pnpm run test:fingerprint  # Network smoke tests (manual)

# Package validation
pnpm run package:check  # npm pack dry-run
pnpm run native-assets:check  # Verify .so/.dll files
```

## NOTES

- **Native assets**: Platform-specific .so/.dll/.dylib in `requests-go/.../dependencies/`
- **FFI modes**: Direct (koffi) or shim (subprocess fallback)
- **Cookie jar**: Uses `tough-cookie` with automatic Set-Cookie handling
- **Streaming**: Native streams wrapped in Web Streams API
- **JA3 randomization**: Built-in via `randomJa3: true` option
- **HTTP/2**: Full settings control via `http2Settings`
