export class NativeBindingError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'NativeBindingError';
    this.cause = options?.cause;
  }
}

export class NativeBindingLoadError extends NativeBindingError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'NativeBindingLoadError';
  }
}

export class NativeBindingProtocolError extends NativeBindingError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'NativeBindingProtocolError';
  }
}

export class NativeBindingNativeError extends NativeBindingError {
  constructor(message: string) {
    super(message);
    this.name = 'NativeBindingNativeError';
  }
}
