import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import type {
  NativeRequestPayload,
  NativeResponsePayload,
  NativeStreamOpenPayload,
  NativeStreamReadPayload,
} from './abi.js';
import type { NativeAssetInfo } from './assets.js';
import {
  NativeBindingLoadError,
  NativeBindingProtocolError,
} from './bindings-errors.js';
import {
  parseShimResult,
  serializePayload,
  type PendingShimCall,
  type ShimRequestMessage,
  type ShimResponseMessage,
} from './bindings-protocol.js';

export interface NativeBindingsShim {
  readonly mode: 'requiresShim';
  readonly asset: NativeAssetInfo;
  request(payload: NativeRequestPayload | string): Promise<NativeResponsePayload>;
  streamRequest(payload: NativeRequestPayload | string): Promise<NativeStreamOpenPayload>;
  streamRead(streamId: string, size: number): Promise<NativeStreamReadPayload>;
  streamClose(streamId: string): Promise<void>;
  free(responseId: string): Promise<void>;
}

export interface NativeBindingShimOptions {
  readonly shimCommand?: string;
  readonly spawnProcess?: typeof spawn;
}

export function createShimBindings(
  asset: NativeAssetInfo,
  options: NativeBindingShimOptions = {},
): NativeBindingsShim {
  const shimCommand =
    options.shimCommand ?? process.env.IMPERSONATED_FETCH_NATIVE_SHIM ?? findBundledShim(asset);

  if (!shimCommand) {
    throw new NativeBindingLoadError(
      `Native FFI is unavailable and no shim executable was found for ${basename(asset.path)}. ` +
        'Set IMPERSONATED_FETCH_NATIVE_SHIM to a line-delimited JSON shim executable.',
    );
  }

  const shim = new NativeShimProcess(shimCommand, asset, options.spawnProcess ?? spawn);

  return {
    mode: 'requiresShim',
    asset,
    request(payload) {
      return shim.call<NativeResponsePayload>('request', [serializePayload(payload)]);
    },
    streamRequest(payload) {
      return shim.call<NativeStreamOpenPayload>('streamRequest', [
        serializePayload({ ...JSON.parse(serializePayload(payload)), Stream: true }),
      ]);
    },
    streamRead(streamId, size) {
      return shim.call<NativeStreamReadPayload>('streamRead', [streamId, size]);
    },
    async streamClose(streamId) {
      await shim.call('streamClose', [streamId]);
    },
    async free(responseId) {
      await shim.call('free', [responseId]);
    },
  };
}

class NativeShimProcess {
  private nextId = 1;
  private stdoutBuffer = '';
  private stderrBuffer = '';
  private closed = false;
  private readonly pending = new Map<number, PendingShimCall>();
  private readonly child: ReturnType<typeof spawn>;

  constructor(command: string, asset: NativeAssetInfo, spawnProcess: typeof spawn) {
    this.child = spawnProcess(command, [asset.path], { stdio: 'pipe', windowsHide: true });
    this.child.stdout!.setEncoding('utf8');
    this.child.stderr!.setEncoding('utf8');
    this.child.stdout!.on('data', (chunk) => this.handleStdout(String(chunk)));
    this.child.stderr!.on('data', (chunk) => {
      this.stderrBuffer += String(chunk);
    });
    this.child.once('error', (error) =>
      this.rejectAll(new NativeBindingLoadError('Native shim process failed', { cause: error })),
    );
    this.child.once('exit', (code, signal) => {
      this.closed = true;
      this.rejectAll(
        new NativeBindingLoadError(
          `Native shim exited before completing pending calls: code=${String(code)} signal=${String(signal)}`,
        ),
      );
    });
  }

  call<T>(method: ShimRequestMessage['method'], params: readonly unknown[]): Promise<T> {
    if (this.closed) {
      return Promise.reject(new NativeBindingLoadError('Native shim process is not running'));
    }

    const id = this.nextId;
    this.nextId += 1;

    const message: ShimRequestMessage = { id, method, params };

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });

      try {
        this.child.stdin!.write(`${JSON.stringify(message)}\n`);
      } catch (error) {
        this.pending.delete(id);
        reject(
          new NativeBindingProtocolError(`Failed to write ${method} request to native shim`, {
            cause: error,
          }),
        );
      }
    }).then((value) => parseShimResult<T>(value, method));
  }

  private handleStdout(chunk: string): void {
    this.stdoutBuffer += chunk;

    for (;;) {
      const newlineIndex = this.stdoutBuffer.indexOf('\n');

      if (newlineIndex === -1) {
        return;
      }

      const line = this.stdoutBuffer.slice(0, newlineIndex).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);

      if (line) {
        this.handleLine(line);
      }
    }
  }

  private handleLine(line: string): void {
    let message: ShimResponseMessage;

    try {
      message = JSON.parse(line) as ShimResponseMessage;
    } catch (error) {
      this.rejectAll(
        new NativeBindingProtocolError('Native shim wrote invalid JSON', { cause: error }),
      );
      return;
    }

    const pending = this.pending.get(message.id);

    if (!pending) {
      this.rejectAll(
        new NativeBindingProtocolError(
          `Native shim returned unknown response id ${String(message.id)}`,
        ),
      );
      return;
    }

    this.pending.delete(message.id);

    if (message.ok) {
      pending.resolve(message.result);
      return;
    }

    pending.reject(
      new NativeBindingProtocolError(message.error || `Native shim failed call ${message.id}`),
    );
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }

    this.pending.clear();
  }
}

function findBundledShim(asset: NativeAssetInfo): string | undefined {
  const extension = asset.platform === 'win32' ? '.exe' : '';
  const nativeExtension = extname(asset.filename);
  const nativeStem = nativeExtension
    ? asset.filename.slice(0, -nativeExtension.length)
    : asset.filename;
  const candidates = [
    join(asset.dependenciesDir, `requests-go-shim${extension}`),
    join(asset.dependenciesDir, `${nativeStem}-shim${extension}`),
    join(asset.dependenciesDir, `native-bindings-shim${extension}`),
  ];

  return candidates.find((candidate) => existsSync(candidate));
}
