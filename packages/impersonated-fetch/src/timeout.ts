import { AbortError, TimeoutError, ValidationError } from './errors.js';

export interface RequestAbortController {
  readonly signal: AbortSignal;
  readonly timeoutMs?: number;
  throwIfAborted(): void;
  cleanup(): void;
}

export interface RequestAbortOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

export function createRequestAbortController(
  options: RequestAbortOptions = {},
): RequestAbortController {
  const timeoutMs = normalizeTimeoutMs(options.timeoutMs);
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const abortFromSignal = (): void => {
    abortController(controller, toAbortError(options.signal?.reason));
  };

  if (options.signal?.aborted) {
    abortFromSignal();
  } else if (options.signal) {
    options.signal.addEventListener('abort', abortFromSignal, { once: true });
  }

  if (timeoutMs !== undefined && !controller.signal.aborted) {
    timeout = setTimeout(() => {
      abortController(controller, new TimeoutError(timeoutMs));
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    timeoutMs,
    throwIfAborted() {
      throwIfAborted(controller.signal);
    },
    cleanup() {
      if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
      }
      options.signal?.removeEventListener('abort', abortFromSignal);
    },
  };
}

export async function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  throwIfAborted(signal);

  return new Promise<T>((resolve, reject) => {
    const abort = (): void => {
      reject(toAbortError(signal.reason));
    };

    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', abort);
    });
  });
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw toAbortError(signal.reason);
  }
}

export function toAbortError(reason: unknown): AbortError | TimeoutError {
  if (reason instanceof TimeoutError) {
    return reason;
  }
  if (reason instanceof AbortError) {
    return reason;
  }
  return new AbortError(undefined, { cause: reason });
}

function abortController(controller: AbortController, reason: AbortError | TimeoutError): void {
  if (!controller.signal.aborted) {
    controller.abort(reason);
  }
}

function normalizeTimeoutMs(timeoutMs: number | undefined): number | undefined {
  if (timeoutMs === undefined) {
    return undefined;
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new ValidationError('timeoutMs must be a non-negative finite number', {
      field: 'timeoutMs',
    });
  }
  return timeoutMs;
}
