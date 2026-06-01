import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { assetNameForTarget } from './platform-assets.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const requireFromJsPackage = createRequire(
  resolve(root, '..', 'impersonated-fetch', 'package.json'),
);
const koffi = requireFromJsPackage('koffi');
const sourceAsset = resolve(root, 'dist', assetNameForTarget(hostTarget()));
const closedAsset = resolve(root, '..', 'impersonated-fetch', 'native', closedAssetNameForHost());

test('source-built backend artifact exports the supported C ABI symbols', () => {
  assert.equal(existsSync(sourceAsset), true, `source-built asset is missing: ${sourceAsset}`);

  const native = loadNative(sourceAsset);

  assert.equal(typeof native.request, 'function');
  assert.equal(typeof native.freeMemory, 'function');
  assert.equal(typeof native.freeSession, 'function');
  assert.equal(typeof native.stream_request, 'function');
  assert.equal(typeof native.stream_read, 'function');
  assert.equal(typeof native.stream_close, 'function');
});

test('source-built backend artifact satisfies buffered request and native error contracts', async () => {
  const native = loadNative(sourceAsset);
  const server = await startServer((request, response) => {
    response.writeHead(201, { 'x-contract': 'buffered' });
    response.end(`buffered:${request.url}`);
  });

  try {
    const payload = requestPayload(server.url, { Params: { q: 'value' } });
    const result = JSON.parse(native.request(JSON.stringify(payload)));

    assert.equal(result.status_code, 201);
    assert.equal(result.headers['X-Contract']?.[0], 'buffered');
    assert.equal(Buffer.from(result.content, 'base64').toString(), 'buffered:/contract?q=value');
    assert.equal(typeof result.raw, 'string');
    assert.match(result.id, /^[0-9a-f-]{36}$/i);

    native.freeMemory(result.id);

    const error = JSON.parse(native.request('{'));
    assert.match(
      error.err,
      /^request->err := json\.Unmarshal\(\[\]byte\(requestParamsString\), &requestParams\) failed: /,
    );
  } finally {
    await server.close();
  }
});

test('source-built backend artifact satisfies streaming read, EOF, and close contracts', async () => {
  const native = loadNative(sourceAsset);
  const server = await startServer((_request, response) => {
    response.writeHead(206, { 'x-contract': 'stream' });
    response.write('hello');
    setTimeout(() => response.end(' stream'), 20);
  });

  try {
    const opened = JSON.parse(native.stream_request(JSON.stringify(requestPayload(server.url))));
    assert.equal(opened.status_code, 206);
    assert.match(opened.stream_id, /^[0-9a-f-]{36}$/i);

    const first = JSON.parse(native.stream_read(opened.stream_id, 5));
    assert.equal(Buffer.from(first.data, 'base64').toString(), 'hello');
    assert.equal(first.eof, false);

    let collected = 'hello';
    for (;;) {
      const next = JSON.parse(native.stream_read(opened.stream_id, 0));
      collected += Buffer.from(next.data || '', 'base64').toString();
      if (next.eof) {
        break;
      }
    }

    assert.equal(collected, 'hello stream');

    native.stream_close(opened.stream_id);
    const afterClose = JSON.parse(native.stream_read(opened.stream_id, 1));
    assert.match(afterClose.err, new RegExp(`^stream_read->stream not found: ${opened.stream_id}`));
  } finally {
    await server.close();
  }
});

test('source-built and closed backend artifacts agree on baseline buffered behavior', async (context) => {
  if (!existsSync(closedAsset)) {
    context.skip(`closed backend oracle is missing: ${closedAsset}`);
    return;
  }

  const source = loadNative(sourceAsset);
  const oracle = loadNative(closedAsset);
  const server = await startServer((_request, response) => {
    response.writeHead(200, { 'x-contract': 'oracle' });
    response.end('oracle-body');
  });

  try {
    const payload = JSON.stringify(requestPayload(server.url));
    const sourceResult = JSON.parse(source.request(payload));
    const oracleResult = JSON.parse(oracle.request(payload));

    assert.equal(sourceResult.status_code, oracleResult.status_code);
    assert.equal(
      Buffer.from(sourceResult.content, 'base64').toString(),
      Buffer.from(oracleResult.content, 'base64').toString(),
    );

    source.freeMemory(sourceResult.id);
    oracle.freeMemory(oracleResult.id);
  } finally {
    await server.close();
  }
});

function loadNative(assetPath) {
  const library = koffi.load(assetPath);

  return {
    request: library.func('char *request(char *request_json)'),
    freeMemory: library.func('void freeMemory(char *response_id)'),
    freeSession: library.func('void freeSession(char *session_id)'),
    stream_request: library.func('char *stream_request(char *request_json)'),
    stream_read: library.func('char *stream_read(char *stream_id, int size)'),
    stream_close: library.func('void stream_close(char *stream_id)'),
  };
}

function requestPayload(baseUrl, overrides = {}) {
  return {
    Id: '',
    Method: 'GET',
    Url: `${baseUrl}/contract`,
    RandomJA3: false,
    AllowRedirects: true,
    Timeout: 5,
    ...overrides,
  };
}

function startServer(handler) {
  const source = `
    const http = require('node:http');
    const server = http.createServer((${handler.toString()}));
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      process.stdout.write(JSON.stringify({ url: 'http://127.0.0.1:' + address.port }) + '\\n');
    });
    process.on('SIGTERM', () => server.close(() => process.exit(0)));
  `;
  const child = spawn(process.execPath, ['-e', source], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += String(chunk);
  });

  return new Promise((resolveServer, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`fixture server did not start: ${stderr}`));
    }, 5_000);

    child.stdout.once('data', (chunk) => {
      clearTimeout(timeout);
      const { url } = JSON.parse(String(chunk));
      resolveServer({
        url,
        close: () => closeServer(child),
      });
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`fixture server exited before start: ${stderr}`));
      }
    });
  });
}

function closeServer(child) {
  return new Promise((resolveClose) => {
    child.once('exit', () => resolveClose());
    child.kill();
  });
}

function hostTarget() {
  const arch = process.arch === 'ia32' ? 'x32' : process.arch;

  return `${process.platform}-${arch}`;
}

function closedAssetNameForHost() {
  const target = hostTarget();
  const names = new Map([
    ['linux-x64', 'requests-go-amd64.so'],
    ['linux-x32', 'requests-go-x86.so'],
    ['linux-arm64', 'requests-go-arm64.so'],
    ['darwin-x64', 'requests-go-x86.dylib'],
    ['darwin-arm64', 'requests-go-arm64.dylib'],
    ['win32-x64', 'requests-go-win64.dll'],
  ]);

  return names.get(target) ?? 'unsupported-closed-backend-oracle';
}
