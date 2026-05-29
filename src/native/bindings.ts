import type {
  NativeRequestPayload,
  NativeResponsePayload,
  NativeStreamOpenPayload,
  NativeStreamReadPayload,
} from './abi.js';
import { getNativeAssetInfo, type NativeAssetInfo } from './assets.js';
import { NativeBindingLoadError } from './bindings-errors.js';
import { tryCreateDirectBindings } from './bindings-loader.js';
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
  readonly shimCommand?: string;
  readonly spawnProcess?: typeof import('node:child_process').spawn;
}

export { NativeBindingError, NativeBindingLoadError, NativeBindingProtocolError, NativeBindingNativeError } from './bindings-errors.js';

let defaultBindings: NativeBindings | undefined;

export function createNativeBindings(options: NativeBindingOptions = {}): NativeBindings {
  const asset = options.asset ?? getNativeAssetInfo();
  const requestedMode = options.mode ?? 'auto';

  if (requestedMode !== 'requiresShim') {
    const direct = tryCreateDirectBindings(asset);

    if (direct || requestedMode === 'direct') {
      if (!direct) {
        throw new NativeBindingLoadError(
          'Native FFI loader is unavailable or does not expose koffi Library()',
        );
      }

      return direct;
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
