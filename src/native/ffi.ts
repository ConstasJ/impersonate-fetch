import {
  NativeAbiUnavailableError,
  NativeTransportError,
  TransportProtocolError,
} from '../errors.js';
import type {
  NativeRequestPayload,
  NativeResponsePayload,
  NativeStreamOpenPayload,
  NativeStreamReadPayload,
} from './abi.js';
import {
  createNativeBindings,
  NativeBindingError,
  NativeBindingNativeError,
  type NativeBindingOptions,
  type NativeBindings,
} from './bindings.js';

export interface NativeFfiClientOptions extends NativeBindingOptions {
  readonly bindings?: NativeBindings;
}

export class NativeFfiClient {
  private readonly bindings: NativeBindings;

  constructor(options: NativeFfiClientOptions = {}) {
    this.bindings = options.bindings ?? createNativeBindings(options);
  }

  async request(payload: NativeRequestPayload): Promise<NativeResponsePayload> {
    try {
      return validateResponse(await this.bindings.request(payload));
    } catch (error) {
      throw toNativeTransportError(error, 'Native request failed');
    }
  }

  async streamRequest(payload: NativeRequestPayload): Promise<NativeStreamOpenPayload> {
    try {
      return validateStreamOpen(await this.bindings.streamRequest(payload));
    } catch (error) {
      throw toNativeTransportError(error, 'Native stream request failed');
    }
  }

  async streamRead(streamId: string, size: number): Promise<NativeStreamReadPayload> {
    try {
      return validateStreamRead(await this.bindings.streamRead(streamId, size));
    } catch (error) {
      throw toNativeTransportError(error, `Native stream read failed for ${streamId}`);
    }
  }

  async streamClose(streamId: string): Promise<void> {
    try {
      await this.bindings.streamClose(streamId);
    } catch (error) {
      throw toNativeTransportError(error, `Native stream close failed for ${streamId}`);
    }
  }

  async free(responseId: string): Promise<void> {
    try {
      await this.bindings.free(responseId);
    } catch (error) {
      throw toNativeTransportError(error, `Native response cleanup failed for ${responseId}`);
    }
  }
}

export function toNativeTransportError(
  error: unknown,
  message: string,
): NativeTransportError | TransportProtocolError {
  if (error instanceof TransportProtocolError || error instanceof NativeTransportError) {
    return error;
  }

  if (error instanceof NativeBindingNativeError) {
    return new NativeTransportError(error.message || message, { cause: error });
  }

  if (error instanceof NativeBindingError) {
    return new TransportProtocolError(error.message || message, { cause: error });
  }

  return new NativeTransportError(message, { cause: error });
}

function validateResponse(payload: NativeResponsePayload): NativeResponsePayload {
  if (
    !isRecord(payload) ||
    typeof payload.status_code !== 'number' ||
    typeof payload.url !== 'string'
  ) {
    throw new NativeAbiUnavailableError('Native request returned an invalid response payload');
  }

  return payload;
}

function validateStreamOpen(payload: NativeStreamOpenPayload): NativeStreamOpenPayload {
  if (
    !isRecord(payload) ||
    typeof payload.stream_id !== 'string' ||
    typeof payload.status_code !== 'number' ||
    typeof payload.url !== 'string'
  ) {
    throw new NativeAbiUnavailableError('Native stream_request returned an invalid stream payload');
  }

  return payload;
}

function validateStreamRead(payload: NativeStreamReadPayload): NativeStreamReadPayload {
  if (!isRecord(payload)) {
    throw new NativeAbiUnavailableError('Native stream_read returned an invalid chunk payload');
  }

  return payload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
