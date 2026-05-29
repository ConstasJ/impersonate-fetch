import type {
  NativeRequestPayload,
  NativeResponsePayload,
  NativeStreamOpenPayload,
  NativeStreamReadPayload,
} from './abi.js';
import {
  NativeBindingNativeError,
  NativeBindingProtocolError,
} from './bindings-errors.js';

export interface ShimRequestMessage {
  id: number;
  method: 'request' | 'streamRequest' | 'streamRead' | 'streamClose' | 'free';
  params: readonly unknown[];
}

export interface ShimResponseMessage {
  id: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export type PendingShimCall = {
  resolve(value: unknown): void;
  reject(error: Error): void;
};

export function serializePayload(payload: NativeRequestPayload | string): string {
  return typeof payload === 'string' ? payload : JSON.stringify(payload);
}

export function deserializePayload(payload: NativeRequestPayload | string): NativeRequestPayload {
  if (typeof payload !== 'string') {
    return payload;
  }

  return JSON.parse(payload) as NativeRequestPayload;
}

export function parseNativeResult<T>(rawJson: string, method: string): T {
  let result: unknown;

  try {
    result = JSON.parse(rawJson);
  } catch (error) {
    throw new NativeBindingProtocolError(`Native ${method} returned invalid JSON`, {
      cause: error,
    });
  }

  return parseShimResult<T>(result, method);
}

export function parseShimResult<T>(result: unknown, method: string): T {
  if (!isRecord(result)) {
    throw new NativeBindingProtocolError(`Native ${method} returned a non-object payload`);
  }

  if (typeof result.err === 'string' && result.err.length > 0) {
    throw new NativeBindingNativeError(result.err);
  }

  return result as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
