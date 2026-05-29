import { FetchBodyUsedError } from './errors.js';
import { raceAbort, throwIfAborted } from './timeout.js';

export type BodySource =
  | ArrayBuffer
  | ReadableStream<Uint8Array>
  | Uint8Array
  | null
  | string
  | undefined;

export class FetchBody {
  private consumed = false;

  constructor(
    private readonly source: BodySource,
    private readonly cleanup: () => void = () => undefined,
    private readonly signal?: AbortSignal,
  ) {}

  get bodyUsed(): boolean {
    return this.consumed;
  }

  get body(): ReadableStream<Uint8Array> | null {
    if (this.source === undefined || this.source === null) {
      return null;
    }

    this.claimBody();
    return sourceToStream(this.source);
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    const bytes = await this.consumeBytes();
    const output = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(output).set(bytes);
    return output;
  }

  async blob(): Promise<Blob> {
    return new Blob([await this.arrayBuffer()]);
  }

  async json<T = unknown>(): Promise<T> {
    return JSON.parse(await this.text()) as T;
  }

  async text(): Promise<string> {
    return new TextDecoder().decode(await this.consumeBytes());
  }

  protected async consumeBytes(): Promise<Uint8Array> {
    this.claimBody();

    try {
      if (this.source === undefined || this.source === null) {
        return new Uint8Array();
      }
      if (typeof this.source === 'string') {
        return new TextEncoder().encode(this.source);
      }
      if (this.source instanceof Uint8Array) {
        return copyBytes(this.source);
      }
      if (this.source instanceof ArrayBuffer) {
        return new Uint8Array(this.source.slice(0));
      }

      return readStream(this.source, this.signal);
    } finally {
      this.cleanup();
    }
  }

  private claimBody(): void {
    if (this.consumed) {
      throw new FetchBodyUsedError();
    }
    this.consumed = true;
  }
}

function sourceToStream(source: Exclude<BodySource, null | undefined>): ReadableStream<Uint8Array> {
  if (typeof source !== 'string' && source instanceof ReadableStream) {
    return source;
  }

  const bytes =
    typeof source === 'string'
      ? new TextEncoder().encode(source)
      : source instanceof Uint8Array
        ? copyBytes(source)
        : new Uint8Array(source.slice(0));

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

async function readStream(
  stream: ReadableStream<Uint8Array>,
  signal: AbortSignal | undefined,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      throwIfAborted(signal);
      const { done, value } = signal ? await raceAbort(reader.read(), signal) : await reader.read();
      if (done) {
        break;
      }
      if (value) {
        chunks.push(value);
        total += value.byteLength;
      }
    }
  } catch (error) {
    await reader.cancel(error).catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  const output = new Uint8Array(bytes.byteLength);
  output.set(bytes);
  return output;
}
