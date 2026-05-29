/** biome-ignore-all lint/style/useNamingConvention: Native FFI mirrors Koffi and ABI symbol names. */
import koffi from 'koffi';
import type {
  NativeAbiSymbolName,
  NativeRequestPayload,
  NativeResponsePayload,
  NativeStreamOpenPayload,
  NativeStreamReadPayload,
} from './abi.js';
import { nativeAbiKoffiSignatures } from './abi.js';
import type { NativeAssetInfo } from './assets.js';
import { NativeBindingLoadError } from './bindings-errors.js';
import { deserializePayload, parseNativeResult, serializePayload } from './bindings-protocol.js';

export interface NativeBindingsDirect {
  readonly mode: 'direct';
  readonly asset: NativeAssetInfo;
  request(payload: NativeRequestPayload | string): Promise<NativeResponsePayload>;
  streamRequest(payload: NativeRequestPayload | string): Promise<NativeStreamOpenPayload>;
  streamRead(streamId: string, size: number): Promise<NativeStreamReadPayload>;
  streamClose(streamId: string): Promise<void>;
  free(responseId: string): Promise<void>;
}

export interface NativeBindingLoaderOptions {
  /** Optional FFI loader for testing */
  readonly ffiLoader?: NativeBindingLoader | (() => NativeBindingLoader);
}

export interface NativeBindingLoader {
  load?(path: string): NativeKoffiLibrary;
  Library?(path: string): NativeDirectLibrary;
}

interface NativeKoffiLibrary {
  func(signature: string): unknown;
}

interface NativeDirectLibrary {
  request(payload: string): string;
  freeMemory(responseId: string): void;
  freeSession?(sessionId: string): void;
  stream_request(payload: string): string;
  stream_read(streamId: string, size: number): string;
  stream_close(streamId: string): void;
}

export function tryCreateDirectBindings(
  asset: NativeAssetInfo,
  options: NativeBindingLoaderOptions = {},
): NativeBindingsDirect | undefined {
  const ffiLoader = getNativeBindingLoader(options.ffiLoader);

  if (!(ffiLoader.load || ffiLoader.Library)) {
    return undefined;
  }

  try {
    const library = createDirectLibrary(ffiLoader, asset.path);

    return {
      mode: 'direct',
      asset,
      async request(payload) {
        return parseNativeResult<NativeResponsePayload>(
          library.request(serializePayload(payload)),
          'request',
        );
      },
      async streamRequest(payload) {
        return parseNativeResult<NativeStreamOpenPayload>(
          library.stream_request(
            serializePayload({ ...deserializePayload(payload), Stream: true }),
          ),
          'streamRequest',
        );
      },
      async streamRead(streamId, size) {
        return parseNativeResult<NativeStreamReadPayload>(
          library.stream_read(streamId, size),
          'streamRead',
        );
      },
      async streamClose(streamId) {
        library.stream_close(streamId);
      },
      async free(responseId) {
        library.freeMemory(responseId);
      },
    };
  } catch (error) {
    throw new NativeBindingLoadError(`Failed to load native asset ${asset.path}`, { cause: error });
  }
}

function getNativeBindingLoader(
  loader: NativeBindingLoaderOptions['ffiLoader'],
): NativeBindingLoader {
  if (typeof loader === 'function') {
    return loader();
  }

  if (loader) {
    return loader;
  }

  return {
    load(path) {
      return koffi.load(path) as NativeKoffiLibrary;
    },
  };
}

function createDirectLibrary(loader: NativeBindingLoader, assetPath: string): NativeDirectLibrary {
  if (loader.Library) {
    return loader.Library(assetPath);
  }

  if (!loader.load) {
    throw new NativeBindingLoadError('Native FFI loader is unavailable');
  }

  const lib = loader.load(assetPath);

  return {
    request: bindKoffiFunction(lib, 'request') as (payload: string) => string,
    freeMemory: bindKoffiFunction(lib, 'freeMemory') as (responseId: string) => void,
    freeSession: bindKoffiFunction(lib, 'freeSession') as (sessionId: string) => void,
    stream_request: bindKoffiFunction(lib, 'stream_request') as (payload: string) => string,
    stream_read: bindKoffiFunction(lib, 'stream_read') as (
      streamId: string,
      size: number,
    ) => string,
    stream_close: bindKoffiFunction(lib, 'stream_close') as (streamId: string) => void,
  };
}

function bindKoffiFunction(library: NativeKoffiLibrary, symbol: NativeAbiSymbolName): unknown {
  return library.func(nativeAbiKoffiSignatures[symbol]);
}
