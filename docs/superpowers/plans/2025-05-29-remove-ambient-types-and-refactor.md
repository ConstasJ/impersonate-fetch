# Remove node-ambient.d.ts and Refactor Code Organization

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Remove the redundant `node-ambient.d.ts` file and refactor oversized modules into focused, well-organized units.

**Architecture:** Eliminate fake ambient Node.js types (project already has @types/node), split monolithic files (`bindings.ts`, `types.ts`) into cohesive modules with single responsibilities.

**Tech Stack:** TypeScript, Node.js, Vitest, Biome

---

## Current State Analysis

### Problem 1: Redundant Ambient Types
- `src/native/node-ambient.d.ts` manually declares Node.js globals (`process`, `Buffer`) and built-in modules (`node:fs`, `node:path`, etc.)
- Project already has `@types/node` in devDependencies
- This file also duplicates Koffi's own type definitions
- `src/native/assets.ts` has `/// <reference path="./node-ambient.d.ts" />`
- `src/native/assets.ts` defines local `NodeJSPlatform` and `NodeJSArchitecture` instead of using Node's built-in types

### Problem 2: Monolithic Files
- `src/native/bindings.ts` (443 lines) handles: Koffi loading, shim process, protocol parsing, result parsing, singleton management, error classes
- `src/impersonation/types.ts` combines: domain types, defaults, snake/camel conversion, browser fingerprint parsing, JA3 randomization, cloning utilities
- `src/impersonation/presets.ts` mixes static data with public APIs

### Target File Structure

```
src/native/
├── node-ambient.d.ts          # DELETE
├── assets.ts                  # Remove reference, use NodeJS.Platform/Arch
├── bindings.ts                # Split into focused modules
├── bindings-loader.ts         # NEW: Direct Koffi FFI loading
├── bindings-shim.ts          # NEW: Shim process management
├── bindings-protocol.ts       # NEW: Protocol serialization/parsing
├── bindings-errors.ts         # NEW: Error classes
├── ffi.ts                     # Already exists, keep as-is
├── abi.ts                     # Already exists, keep as-is

src/impersonation/
├── types.ts                   # Split: keep only interfaces/types
├── config.ts                  # NEW: createTLSConfig, defaults, clone helpers
├── convert.ts                 # NEW: snake/camel conversion
├── fingerprint.ts             # NEW: browser fingerprint parsing, JA3 randomization
├── presets.ts                 # Keep public preset exports
└── preset-data.ts             # OPTIONAL: move raw preset payloads here
```

---

## Phase 1: Remove node-ambient.d.ts

### Task 1.1: Read Current assets.ts

**Files:**
- Read: `src/native/assets.ts`

**Purpose:** Understand current usage of ambient types.

---

### Task 1.2: Remove Reference from assets.ts

**Files:**
- Modify: `src/native/assets.ts` (lines 1-5 typically)

**Changes:**
1. Remove line: `/// <reference path="./node-ambient.d.ts" />`
2. Change type definitions from local aliases to Node types:
   - `NodeJSPlatform` → `NodeJS.Platform`
   - `NodeJSArchitecture` → `NodeJS.Architecture`

**Code:**
```typescript
// BEFORE (remove this):
/// <reference path="./node-ambient.d.ts" />
export type NodeJSPlatform = 'aix' | 'darwin' | 'freebsd' | 'linux' | 'openbsd' | 'sunos' | 'win32' | 'cygwin' | 'netbsd';
export type NodeJSArchitecture = 'arm' | 'arm64' | 'ia32' | 'loong64' | 'mips' | 'mipsel' | 'ppc' | 'ppc64' | 'riscv64' | 's390' | 's390x' | 'x64';

// AFTER:
export type NativePlatform = NodeJS.Platform | string;
export type NativeArchitecture = NodeJS.Architecture | string;
```

---

### Task 1.3: Delete node-ambient.d.ts

**Files:**
- Delete: `src/native/node-ambient.d.ts`

**Command:**
```bash
git rm src/native/node-ambient.d.ts
```

---

### Task 1.4: Run Type Check

**Command:**
```bash
npm run typecheck
```

**Expected:** PASS with no errors

---

### Task 1.5: Commit

```bash
git add src/native/assets.ts
rm src/native/node-ambient.d.ts  # or git rm
# Remove any references in other files
npm run typecheck
git commit -m "refactor: remove redundant node-ambient.d.ts types"
```

---

## Phase 2: Split native/bindings.ts

### Task 2.1: Read Current bindings.ts

**Files:**
- Read: `src/native/bindings.ts`

**Purpose:** Identify sections to split:
1. Error classes (lines ~1-50)
2. Direct FFI loading (lines ~51-150)
3. Shim process management (lines ~151-300)
4. Protocol serialization/parsing (lines ~301-400)
5. Public API and singleton (lines ~401-443)

---

### Task 2.2: Create bindings-errors.ts

**Files:**
- Create: `src/native/bindings-errors.ts`

**Content:** Extract error classes from bindings.ts

```typescript
// src/native/bindings-errors.ts
export class NativeBindingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NativeBindingError';
  }
}

export class NativeBindingLoadError extends NativeBindingError {
  constructor(
    public readonly libraryPath: string,
    public readonly cause: Error,
  ) {
    super(`Failed to load native binding from ${libraryPath}: ${cause.message}`);
    this.name = 'NativeBindingLoadError';
  }
}

export class NativeBindingProtocolError extends NativeBindingError {
  constructor(
    public readonly message: string,
    public readonly rawResponse?: string,
  ) {
    super(message);
    this.name = 'NativeBindingProtocolError';
  }
}

export class NativeBindingNativeError extends NativeBindingError {
  constructor(
    public readonly code: string,
    public readonly nativeMessage: string,
  ) {
    super(`Native error [${code}]: ${nativeMessage}`);
    this.name = 'NativeBindingNativeError';
  }
}
```

---

### Task 2.3: Create bindings-loader.ts

**Files:**
- Create: `src/native/bindings-loader.ts`

**Content:** Extract Koffi direct loading logic

```typescript
// src/native/bindings-loader.ts
import * as koffi from 'koffi';
import type { NativeRequestPayload, NativeResponsePayload } from '../transport/types.js';
import { NativeBindingLoadError, NativeBindingNativeError, NativeBindingProtocolError } from './bindings-errors.js';

export interface DirectBindings {
  request(payload: NativeRequestPayload): NativeResponsePayload;
}

export function createDirectBindings(libraryPath: string): DirectBindings {
  try {
    const lib = koffi.load(libraryPath);
    // Define the function signature based on native ABI
    const requestFn = lib.func('request', 'int', ['string']);
    
    return {
      request(payload: NativeRequestPayload): NativeResponsePayload {
        const jsonPayload = JSON.stringify(payload);
        const result = requestFn(jsonPayload);
        
        if (typeof result !== 'string') {
          throw new NativeBindingProtocolError('Invalid response type from native library');
        }
        
        try {
          const parsed = JSON.parse(result);
          if (parsed.error) {
            throw new NativeBindingNativeError(parsed.error.code, parsed.error.message);
          }
          return parsed as NativeResponsePayload;
        } catch (e) {
          throw new NativeBindingProtocolError('Failed to parse native response', result);
        }
      },
    };
  } catch (e) {
    throw new NativeBindingLoadError(libraryPath, e as Error);
  }
}
```

**Note:** Verify actual function signature with `src/native/abi.ts` - adjust as needed.

---

### Task 2.4: Create bindings-shim.ts

**Files:**
- Create: `src/native/bindings-shim.ts`

**Content:** Extract shim process management

```typescript
// src/native/bindings-shim.ts
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { NativeRequestPayload, NativeResponsePayload } from '../transport/types.js';
import { NativeBindingProtocolError, NativeBindingNativeError } from './bindings-errors.js';

export interface ShimBindings {
  request(payload: NativeRequestPayload): Promise<NativeResponsePayload>;
  close(): void;
}

interface ShimProcess {
  process: ReturnType<typeof spawn>;
  requestQueue: Map<string, { resolve: Function; reject: Function }>;
  seq: number;
}

export function createShimBindings(shimPath: string): ShimBindings {
  const shim: ShimProcess = {
    process: spawn('node', [shimPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    }),
    requestQueue: new Map(),
    seq: 0,
  };

  shim.process.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    for (const line of lines) {
      try {
        const response = JSON.parse(line);
        const request = shim.requestQueue.get(response.id);
        if (request) {
          shim.requestQueue.delete(response.id);
          if (response.error) {
            request.reject(new NativeBindingNativeError(response.error.code, response.error.message));
          } else {
            request.resolve(response);
          }
        }
      } catch (e) {
        // Log invalid response
      }
    }
  });

  return {
    async request(payload: NativeRequestPayload): Promise<NativeResponsePayload> {
      const id = `${++shim.seq}`;
      const envelope = { id, payload };
      
      return new Promise((resolve, reject) => {
        shim.requestQueue.set(id, { resolve, reject });
        shim.process.stdin?.write(`${JSON.stringify(envelope)}\n`);
      });
    },
    
    close(): void {
      shim.process.kill();
    },
  };
}

export function findShimPath(): string | undefined {
  try {
    const require = createRequire(import.meta.url);
    const shimPath = require.resolve('./shim.js');
    return shimPath;
  } catch {
    return undefined;
  }
}
```

---

### Task 2.5: Refactor bindings.ts to Use New Modules

**Files:**
- Modify: `src/native/bindings.ts`

**Content:** Simplify to public API using the split modules

```typescript
// src/native/bindings.ts
import { getNativeAssetPath } from './assets.js';
import { createDirectBindings } from './bindings-loader.js';
import { createShimBindings, findShimPath } from './bindings-shim.js';
import { NativeBindingError, NativeBindingLoadError } from './bindings-errors.js';
import type { DirectBindings } from './bindings-loader.js';
import type { ShimBindings } from './bindings-shim.js';
import type { NativeRequestPayload, NativeResponsePayload } from '../transport/types.js';

export { 
  NativeBindingError, 
  NativeBindingLoadError, 
  NativeBindingProtocolError, 
  NativeBindingNativeError 
} from './bindings-errors.js';

export interface NativeBindingOptions {
  libraryPath?: string;
  useShim?: boolean;
}

export type NativeBindings = DirectBindings | ShimBindings;

let defaultBindings: NativeBindings | undefined;

export function createNativeBindings(options?: NativeBindingOptions): NativeBindings {
  if (options?.useShim) {
    const shimPath = options.libraryPath ?? findShimPath();
    if (!shimPath) {
      throw new NativeBindingError('Shim path not found and no library path provided');
    }
    return createShimBindings(shimPath);
  }
  
  const libraryPath = options?.libraryPath ?? getNativeAssetPath();
  return createDirectBindings(libraryPath);
}

export function getDefaultBindings(): NativeBindings {
  if (!defaultBindings) {
    defaultBindings = createNativeBindings();
  }
  return defaultBindings;
}

export function resetDefaultBindings(): void {
  if (defaultBindings && 'close' in defaultBindings) {
    defaultBindings.close();
  }
  defaultBindings = undefined;
}
```

---

### Task 2.6: Update exports from native/index or native.ts

**Files:**
- Check: How are bindings exported? Via `src/native/index.ts` or directly?

If there's an index file, update it to re-export from bindings.ts:

```typescript
// src/native/index.ts (if exists)
export * from './bindings.js';
export * from './bindings-errors.js';
```

---

### Task 2.7: Run Type Check

**Command:**
```bash
npm run typecheck
```

**Expected:** PASS

---

### Task 2.8: Run Tests

**Command:**
```bash
npm test
```

**Expected:** All tests pass (or identify which ones fail due to changes)

---

### Task 2.9: Commit

```bash
git add src/native/bindings-*.ts
git commit -m "refactor: split native/bindings.ts into focused modules

- bindings-errors.ts: Error classes
- bindings-loader.ts: Direct FFI loading
- bindings-shim.ts: Shim process management
- bindings.ts: Public API and singleton management"
```

---

## Phase 3: Split impersonation/modules

### Task 3.1: Read Current impersonation/types.ts

**Files:**
- Read: `src/impersonation/types.ts`

**Purpose:** Identify sections:
1. Type definitions (interfaces/types)
2. createTLSConfig function
3. Default values
4. Snake/camel conversion utilities
5. Browser fingerprint parsing
6. JA3 randomization
7. Cloning utilities

---

### Task 3.2: Create impersonation/convert.ts

**Files:**
- Create: `src/impersonation/convert.ts`

**Content:** Snake/camel case conversion utilities

```typescript
// src/impersonation/convert.ts

export type SnakeToCamel<S extends string> = 
  S extends `${infer T}_${infer U}` 
    ? `${T}${Capitalize<SnakeToCamel<U>>}` 
    : S;

export type CamelToSnake<S extends string> = 
  S extends `${infer T}${infer U}` 
    ? T extends Capitalize<T> 
      ? `_${Lowercase<T>}${CamelToSnake<U>}` 
      : `${T}${CamelToSnake<U>}` 
    : S;

export function toCamelCase<T extends Record<string, unknown>>(
  obj: T
): { [K in keyof T as SnakeToCamel<string & K>]: T[K] } {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }
  return result as { [K in keyof T as SnakeToCamel<string & K>]: T[K] };
}

export function toSnakeCase<T extends Record<string, unknown>>(
  obj: T
): { [K in keyof T as CamelToSnake<string & K>]: T[K] } {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result as { [K in keyof T as CamelToSnake<string & K>]: T[K] };
}
```

**Note:** Verify actual implementation in current types.ts - the above is a template.

---

### Task 3.3: Create impersonation/fingerprint.ts

**Files:**
- Create: `src/impersonation/fingerprint.ts`

**Content:** JA3 parsing and randomization

```typescript
// src/impersonation/fingerprint.ts

export interface JA3Components {
  version: string;
  ciphers: string[];
  extensions: string[];
  curves: string[];
  pointFormats: string[];
}

export function parseJA3(ja3: string): JA3Components {
  const parts = ja3.split(',');
  return {
    version: parts[0],
    ciphers: parts[1]?.split('-') ?? [],
    extensions: parts[2]?.split('-') ?? [],
    curves: parts[3]?.split('-') ?? [],
    pointFormats: parts[4]?.split('-') ?? [],
  };
}

export function buildJA3(components: JA3Components): string {
  return [
    components.version,
    components.ciphers.join('-'),
    components.extensions.join('-'),
    components.curves.join('-'),
    components.pointFormats.join('-'),
  ].join(',');
}

export function randomizeJA3(ja3: string): string {
  const components = parseJA3(ja3);
  
  // Shuffle ciphers while maintaining some ordering constraints
  const shuffledCiphers = [...components.ciphers].sort(() => Math.random() - 0.5);
  
  // Shuffle extensions
  const shuffledExtensions = [...components.extensions].sort(() => Math.random() - 0.5);
  
  return buildJA3({
    ...components,
    ciphers: shuffledCiphers,
    extensions: shuffledExtensions,
  });
}

export function randomizeSignatureAlgorithms(algorithms: string[]): string[] {
  return [...algorithms].sort(() => Math.random() - 0.5);
}
```

**Note:** Verify actual implementation in current types.ts.

---

### Task 3.4: Create impersonation/config.ts

**Files:**
- Create: `src/impersonation/config.ts`

**Content:** createTLSConfig and defaults

```typescript
// src/impersonation/config.ts
import type { TLSConfig, TLSConfigInput } from './types.js';
import { randomizeJA3, randomizeSignatureAlgorithms } from './fingerprint.js';

export const DEFAULT_TLS_CONFIG: TLSConfig = {
  ja3: '',
  h2Settings: {},
  h2Headers: [],
  pseudoHeaderOrder: [],
  supportedSignatureAlgorithms: [],
  supportedVersions: [],
  keyShareCurves: [],
  certCompressionAlgo: [],
  // ... other defaults
};

export function createTLSConfig(input: TLSConfigInput): TLSConfig {
  const config: TLSConfig = {
    ...DEFAULT_TLS_CONFIG,
    ...input,
  };
  
  if (input.randomizeJa3 && config.ja3) {
    config.ja3 = randomizeJA3(config.ja3);
  }
  
  if (input.randomizeSigAlg && config.supportedSignatureAlgorithms) {
    config.supportedSignatureAlgorithms = randomizeSignatureAlgorithms(
      config.supportedSignatureAlgorithms
    );
  }
  
  return config;
}

export function cloneTLSConfig(config: TLSConfig): TLSConfig {
  return {
    ...config,
    h2Settings: config.h2Settings ? { ...config.h2Settings } : undefined,
    h2Headers: config.h2Headers ? [...config.h2Headers] : undefined,
    pseudoHeaderOrder: config.pseudoHeaderOrder ? [...config.pseudoHeaderOrder] : undefined,
    supportedSignatureAlgorithms: config.supportedSignatureAlgorithms 
      ? [...config.supportedSignatureAlgorithms] 
      : undefined,
    supportedVersions: config.supportedVersions ? [...config.supportedVersions] : undefined,
    keyShareCurves: config.keyShareCurves ? [...config.keyShareCurves] : undefined,
    certCompressionAlgo: config.certCompressionAlgo ? [...config.certCompressionAlgo] : undefined,
  };
}
```

**Note:** Verify actual types and defaults from current types.ts.

---

### Task 3.5: Refactor impersonation/types.ts

**Files:**
- Modify: `src/impersonation/types.ts`

**Content:** Keep only type definitions, remove implementation

```typescript
// src/impersonation/types.ts
// Type definitions only - implementations moved to separate modules

export interface TLSConfig {
  ja3: string;
  h2Settings: H2Settings;
  h2Headers: string[];
  pseudoHeaderOrder: string[];
  supportedSignatureAlgorithms: string[];
  supportedVersions: string[];
  keyShareCurves: string[];
  certCompressionAlgo: string[];
  // ... other fields from original
}

export interface TLSConfigInput extends Partial<TLSConfig> {
  randomizeJa3?: boolean;
  randomizeSigAlg?: boolean;
}

export interface H2Settings {
  settings?: Record<string, number>;
  settingsOrder?: string[];
  connectionFlow?: number;
}

// Re-export from other modules for backward compatibility
export { createTLSConfig, cloneTLSConfig, DEFAULT_TLS_CONFIG } from './config.js';
export { parseJA3, buildJA3, randomizeJA3, randomizeSignatureAlgorithms } from './fingerprint.js';
export { toCamelCase, toSnakeCase } from './convert.js';
```

**Note:** This maintains backward compatibility while splitting the code.

---

### Task 3.6: Run Type Check

**Command:**
```bash
npm run typecheck
```

**Expected:** PASS

---

### Task 3.7: Run Tests

**Command:**
```bash
npm test
```

**Expected:** PASS (tests may need import updates)

---

### Task 3.8: Commit

```bash
git add src/impersonation/
git commit -m "refactor: split impersonation types into focused modules

- types.ts: Type definitions only
- config.ts: createTLSConfig, defaults, cloning
- fingerprint.ts: JA3 parsing and randomization
- convert.ts: Snake/camel case conversion
- Maintains backward compatibility via re-exports"
```

---

## Phase 4: Optional - Split impersonation/presets.ts

### Task 4.1: Evaluate presets.ts size

**If >300 lines:**

**Files:**
- Create: `src/impersonation/preset-data.ts`
- Modify: `src/impersonation/presets.ts`

**Content:**

`preset-data.ts` - Raw preset objects:
```typescript
// src/impersonation/preset-data.ts
import type { TLSConfig } from './types.js';

export const TLS_CHROME_LATEST: TLSConfig = {
  // ... raw data
};

export const TLS_FIREFOX_LATEST: TLSConfig = {
  // ... raw data
};

// ... other presets
```

`presets.ts` - Public API:
```typescript
// src/impersonation/presets.ts
import { TLS_CHROME_LATEST, TLS_FIREFOX_LATEST } from './preset-data.js';

export * from './preset-data.js';

export function getPreset(name: string): TLSConfig | undefined {
  // ... lookup logic
}

export const PRESET_NAMES = [
  'chrome-latest',
  'firefox-latest',
  // ...
] as const;
```

---

## Phase 5: Verification

### Task 5.1: Full Type Check

**Command:**
```bash
npm run typecheck
```

**Expected:** PASS with 0 errors

---

### Task 5.2: Full Test Suite

**Command:**
```bash
npm test
```

**Expected:** All tests pass

---

### Task 5.3: Build Check

**Command:**
```bash
npm run build
```

**Expected:** Build succeeds

---

### Task 5.4: Lint Check

**Command:**
```bash
npm run lint
```

**Expected:** PASS (or run `npm run lint:fix` if needed)

---

### Task 5.5: Final Review

**Manual verification:**
1. Check `node-ambient.d.ts` is deleted
2. Check new files have correct exports
3. Check backward compatibility (re-exports work)
4. Verify no circular imports introduced

---

### Task 5.6: Final Commit

```bash
git add .
# If any remaining changes
git commit -m "chore: clean up and finalize refactoring"
```

---

## Summary

This refactoring:

1. **Removes technical debt:** Eliminates redundant `node-ambient.d.ts`
2. **Improves maintainability:** Files have single responsibilities
3. **Maintains compatibility:** Re-exports preserve existing API
4. **Enables testing:** Smaller modules are easier to unit test

**Risk mitigation:**
- All changes preserve existing API via re-exports
- Comprehensive test coverage before and after
- Incremental commits allow easy rollback
