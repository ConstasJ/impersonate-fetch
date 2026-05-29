import type {
  NativeRequestPayload,
  NativeResponsePayload,
  NativeStreamOpenPayload,
  NativeStreamReadPayload,
} from './abi.js';
import { getNativeAssetInfo, type NativeAssetInfo } from './assets.js';
import { NativeBindingLoadError } from './bindings-errors.js';
import { type NativeBindingLoaderOptions, tryCreateDirectBindings } from './bindings-loader.js';
import { createShimBindings } from './bindings-shim.js';

export type NativeBindingMode = 'direct' | 'requiresShim';

export interface NativeBindings {
  readonly mode: NativeBindingMode;
  readonly asset: NativeAssetInfo;
  request(payload: NativeRequestPayload | string): Promise<NativeResponsePayload>;
  streamRequest(payload: NativeRequestPayload | string): Promise<NativeStreamOpenPayload>;
  streamRead(streamId: string, size: number): Promise<NativeStreamReadPayload>;
  streamClose(streamId: string): Promise<void>;
  free(responseId: string): Promise<void>;
}

export interface NativeBindingOptions {
  readonly mode?: NativeBindingMode | 'auto';
  readonly asset?: NativeAssetInfo;
  readonly ffiLoader?: NativeBindingLoaderOptions['ffiLoader'];
  readonly shimCommand?: string;
  readonly spawnProcess?: typeof import('node:child_process').spawn;
}

export {
  NativeBindingError,
  NativeBindingLoadError,
  NativeBindingNativeError,
  NativeBindingProtocolError,
} from './bindings-errors.js';

let defaultBindings: NativeBindings | undefined;

export function createNativeBindings(options: NativeBindingOptions = {}): NativeBindings {
  const asset = options.asset ?? getNativeAssetInfo();
  const requestedMode = options.mode ?? 'auto';

  if (requestedMode === 'direct') {
    const direct = tryCreateDirectBindings(asset, { ffiLoader: options.ffiLoader });

    if (!direct) {
      throw new NativeBindingLoadError(
        'Native FFI loader is unavailable or does not expose load()/Library()',
      );
    }

    return direct;
  }

  if (requestedMode === 'auto') {
    try {
      const direct = tryCreateDirectBindings(asset, { ffiLoader: options.ffiLoader });

      if (direct) {
        return direct;
      }
    } catch (error) {
      if (!(error instanceof NativeBindingLoadError)) {
        throw error;
      }
    }
  }

  return createShimBindings(asset, {
    shimCommand: options.shimCommand,
    spawnProcess: options.spawnProcess,
  });
}

export function request(payload: NativeRequestPayload | string): Promise<NativeResponsePayload> {
  return getDefaultBindings().request(payload);
}

export function streamRequest(
  payload: NativeRequestPayload | string,
): Promise<NativeStreamOpenPayload> {
  return getDefaultBindings().streamRequest(payload);
}

export function streamRead(streamId: string, size: number): Promise<NativeStreamReadPayload> {
  return getDefaultBindings().streamRead(streamId, size);
}

export function streamClose(streamId: string): Promise<void> {
  return getDefaultBindings().streamClose(streamId);
}

export function free(responseId: string): Promise<void> {
  return getDefaultBindings().free(responseId);
}

function getDefaultBindings(): NativeBindings {
  defaultBindings ??= createNativeBindings();

  return defaultBindings;
}
