# AGENTS.md: src/impersonation

**Scope:** TLS fingerprint configuration and browser presets

## OVERVIEW

Impersonation module defines TLS configurations that mimic browser fingerprints. Includes JA3 strings, HTTP/2 settings, TLS extensions, and header ordering.

## STRUCTURE

```
src/impersonation/
├── presets.ts    # Browser presets (Chrome, Firefox, Edge, Safari)
├── types.ts      # TLSConfig, HTTP2Settings, TLSExtensions types
├── config.ts     # createTLSConfig() factory
├── convert.ts    # Snake_case <-> camelCase conversion
├── serialize.ts  # Config serialization
└── fingerprint.ts # JA3 randomization
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Add new preset | `presets.ts` | Copy Chrome/Firefox pattern, use `tlsConfigFromSnakeCase` |
| Modify config structure | `types.ts` | Both camelCase and snake_case variants |
| Create custom config | `config.ts` | `createTLSConfig()` with overrides |
| Convert from Python | `convert.ts` | Snake/camel case converters |
| Randomize JA3 | `fingerprint.ts` | `randomizeJa3()` function |

## CONVENTIONS

- **Two naming styles**: Internal uses camelCase (`TLSConfig`), native uses snake_case (`TLSConfigPayload`)
- **Presets are frozen**: Use `cloneTLSConfig()` to modify
- **JA3 format**: Comma-separated cipher suites, extensions, curves
- **HTTP/2 settings**: Full control over SETTINGS frames

## ANTI-PATTERNS

- Don't modify presets directly - clone first
- Don't use raw JA3 strings without validation
- Don't assume all TLS extensions are supported by native layer
