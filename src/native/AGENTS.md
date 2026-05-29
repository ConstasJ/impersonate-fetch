# AGENTS.md: src/native

**Scope:** FFI bindings and native Go interop layer

## OVERVIEW

Native module handles FFI communication with the Go TLS client. Supports two modes: direct (via Koffi) or shim (subprocess fallback).

## STRUCTURE

```
src/native/
├── bindings.ts        # Main bindings factory, mode selection
├── bindings-loader.ts # Direct FFI via koffi
├── bindings-shim.ts   # Subprocess fallback
├── bindings-errors.ts # Binding-specific errors
├── bindings-protocol.ts # Protocol validation
├── ffi.ts            # High-level FFI client wrapper
├── abi.ts            # FFI ABI definitions
└── assets.ts         # Native asset discovery
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Add new FFI call | `bindings-loader.ts` | Add to koffi lib definition |
| Fix shim mode | `bindings-shim.ts` | Subprocess protocol handling |
| Native asset path | `assets.ts` | Platform detection logic |
| Error wrapping | `bindings-errors.ts` | NativeBindingError hierarchy |
| High-level FFI | `ffi.ts` | NativeFfiClient class |

## CONVENTIONS

- **Async only**: All native calls return Promises
- **Stream IDs**: String identifiers for native stream handles
- **Payload validation**: Always validate native response structure
- **Mode selection**: `auto` tries direct first, falls back to shim

## ANTI-PATTERNS

- Never call native bindings synchronously
- Never assume direct mode is available
- Never pass unvalidated data to native layer
