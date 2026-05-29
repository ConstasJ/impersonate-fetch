import * as koffi from 'koffi';
import type {
  NativeRequestPayload,
  NativeResponsePayload,
  NativeStreamOpenPayload,
  NativeStreamReadPayload,
} from './abi.js';
import type { NativeAssetInfo } from './assets.js';
import { NativeBindingLoadError } from './bindings-errors.js';
import {
  deserializePayload,
  parseNativeResult,
  serializePayload,
} from './bindings-protocol.js';

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
  /** Optional koffi instance for testing */
  readonly koffi?: typeof import('koffi');
}

export function tryCreateDirectBindings(
  asset: NativeAssetInfo,
  options: NativeBindingLoaderOptions = {},
): NativeBindingsDirect | undefined {
  // Use injected koffi for testing, otherwise use the imported module
  const koffiInstance = options.koffi ?? koffi;

  if (!koffiInstance?.load) {
    return undefined;
  }

  try {
    const lib = koffiInstance.load(asset.path);

    // Define functions using koffi C-like syntax
    const requestFn = lib.func('char *request(char *request_json)');
    const freeMemoryFn = lib.func('void freeMemory(char *response_id)');
    const freeSessionFn = lib.func('void freeSession(char *session_id)');
    const streamRequestFn = lib.func('char *stream_request(char *request_json)');
    const streamReadFn = lib.func('char *stream_read(char *stream_id, int size)');
    const streamCloseFn = lib.func('void stream_close(char *stream_id)');

    const library = {
      request: requestFn as (payload: string) => string,
      freeMemory: freeMemoryFn as (responseId: string) => void,
      freeSession: freeSessionFn as (sessionId: string) => void,
      stream_request: streamRequestFn as (payload: string) => string,
      stream_read: streamReadFn as (streamId: string, size: number) => string,
      stream_close: streamCloseFn as (streamId: string) => void,
    };

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
