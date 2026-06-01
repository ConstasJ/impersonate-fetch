import type { CapabilityName } from './transport/capabilities.js';
import type { TransportBackendName } from './transport/types.js';

export { NativeAssetNotFoundError } from './native/assets.js';

export interface UnsupportedCapabilityErrorOptions {
  backend: TransportBackendName | string;
  capability: CapabilityName;
  platform: string;
  requestedOption?: string;
}

export class ImpersonatedFetchError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'ImpersonatedFetchError';
    this.cause = options?.cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AbortError extends ImpersonatedFetchError {
  constructor(message = 'The operation was aborted', options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AbortError';
  }
}

export class TimeoutError extends ImpersonatedFetchError {
  readonly timeoutMs: number;

  constructor(timeoutMs: number, options?: { cause?: unknown }) {
    super(`The operation timed out after ${timeoutMs}ms`, options);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export class UnsupportedCapabilityError extends ImpersonatedFetchError {
  readonly backend: TransportBackendName | string;
  readonly capability: CapabilityName;
  readonly platform: string;
  readonly requestedOption?: string;

  constructor(options: UnsupportedCapabilityErrorOptions) {
    const option = options.requestedOption ? ` requestedOption=${options.requestedOption}` : '';
    super(
      `Unsupported transport capability ${options.capability} for backend=${options.backend} platform=${options.platform}${option}`,
    );
    this.name = 'UnsupportedCapabilityError';
    this.backend = options.backend;
    this.capability = options.capability;
    this.platform = options.platform;
    this.requestedOption = options.requestedOption;
  }
}

export class NativeTransportError extends ImpersonatedFetchError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'NativeTransportError';
  }
}

export class NativeAbiUnavailableError extends NativeTransportError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'NativeAbiUnavailableError';
  }
}

export class FetchBodyUsedError extends ImpersonatedFetchError {
  constructor(message = 'Body has already been consumed') {
    super(message);
    this.name = 'FetchBodyUsedError';
  }
}

export class ValidationError extends ImpersonatedFetchError {
  readonly field?: string;

  constructor(message: string, options?: { field?: string; cause?: unknown }) {
    super(message, options);
    this.name = 'ValidationError';
    this.field = options?.field;
  }
}

export class TransportProtocolError extends ImpersonatedFetchError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'TransportProtocolError';
  }
}
