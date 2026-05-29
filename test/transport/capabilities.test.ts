import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, it } from 'vitest';

import {
  assertCapability,
  capabilityNames,
  getCapabilities,
  UnsupportedCapabilityError,
} from '../../dist/index.mjs';
import { nativeAbiSymbolNames } from '../../src/native/abi.ts';
import type { TransportRequest } from '../../src/transport/types.ts';

describe('transport capabilities', () => {
  it('reports native request capabilities from asset and ABI evidence', () => {
    const capabilities = getCapabilities({ platform: 'linux', arch: 'x64' });

    assert.equal(capabilities.backend, 'native');
    assert.equal(capabilities.platformName, 'linux');
    assert.equal(capabilities.arch, 'x64');
    assert.equal(capabilities.nativeAssetFilename, 'requests-go-amd64.so');
    assert.equal(capabilities.nativeAssetPath && existsSync(capabilities.nativeAssetPath), true);
    assert.deepEqual(capabilities.nativeAbiSymbols, nativeAbiSymbolNames);

    for (const capability of capabilityNames) {
      assert.equal(typeof capabilities[capability], 'boolean', capability);
    }

    assert.equal(capabilities.platform, true);
    assert.equal(capabilities.nativeBinary, true);
    assert.equal(capabilities.http1_1, true);
    assert.equal(capabilities.http2, true);
    assert.equal(capabilities.ja3, true);
    assert.equal(capabilities.browserPresets, true);
    assert.equal(capabilities.customClientHello, true);
    assert.equal(capabilities.customHttp2Settings, true);
    assert.equal(capabilities.orderedHeaders, true);
    assert.equal(capabilities.proxy, true);
    assert.equal(capabilities.cookies, true);
    assert.equal(capabilities.streamingResponse, true);
    assert.equal(capabilities.redirects, true);
  });

  it('does not mark unsupported capabilities true without native evidence', () => {
    const capabilities = getCapabilities({ platform: 'linux', arch: 'x64' });

    assert.equal(capabilities.ja4, false);
    assert.equal(capabilities.streamingUpload, false);
    assert.equal(capabilities.abortSignal, false);
  });

  it('reports all capabilities unsupported when no native asset is available', () => {
    const capabilities = getCapabilities({ platform: 'freebsd', arch: 'riscv64' });

    assert.equal(capabilities.platformName, 'freebsd');
    assert.equal(capabilities.arch, 'riscv64');
    assert.equal(capabilities.nativeAssetPath, undefined);

    for (const capability of capabilityNames) {
      assert.equal(capabilities[capability], false, capability);
    }
  });

  it('allows supported native request options before network I/O', () => {
    const request: TransportRequest = {
      url: 'https://example.test/',
      headers: { accept: '*/*' },
      cookies: { session: 'abc' },
      proxy: 'http://proxy.example:8080',
      redirects: 3,
      streamResponse: true,
      impersonation: {
        preset: 'chrome',
        ja3: '771,4865,0,29,0',
        headersOrder: ['accept', 'user-agent'],
        clientHelloHexStream: '160301',
        tlsConfig: {
          http2_settings: {
            settings: { HEADER_TABLE_SIZE: 65536 },
            settings_ack: false,
            settings_order: ['HEADER_TABLE_SIZE'],
            connection_flow: 15663105,
            headers_id: 1,
            header_priority: null,
            priority_frames: null,
          },
        },
      },
    };

    assert.doesNotThrow(() => assertCapability(request, { platform: 'linux', arch: 'x64' }));
  });

  it('throws UnsupportedCapabilityError with backend, capability, platform, and option', () => {
    assert.throws(
      () =>
        assertCapability(
          { url: 'https://example.test/', signal: AbortSignal.timeout(1) },
          { platform: 'linux', arch: 'x64' },
        ),
      (error) => {
        assert.equal(error instanceof UnsupportedCapabilityError, true);
        assert.equal((error as UnsupportedCapabilityError).backend, 'native');
        assert.equal((error as UnsupportedCapabilityError).capability, 'abortSignal');
        assert.equal((error as UnsupportedCapabilityError).platform, 'linux/x64');
        assert.equal((error as UnsupportedCapabilityError).requestedOption, 'signal');
        return true;
      },
    );
  });

  it('throws before unsupported streaming upload requests can reach a backend', () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      },
    });

    assert.throws(
      () =>
        assertCapability(
          { url: 'https://example.test/', body },
          { platform: 'linux', arch: 'x64' },
        ),
      (error) => {
        assert.equal(error instanceof UnsupportedCapabilityError, true);
        assert.equal((error as UnsupportedCapabilityError).capability, 'streamingUpload');
        assert.equal((error as UnsupportedCapabilityError).requestedOption, 'body');
        return true;
      },
    );
  });

  it('throws for any request when the current platform has no native binary', () => {
    assert.throws(
      () =>
        assertCapability(
          { url: 'https://example.test/' },
          { platform: 'freebsd', arch: 'riscv64' },
        ),
      (error) => {
        assert.equal(error instanceof UnsupportedCapabilityError, true);
        assert.equal((error as UnsupportedCapabilityError).capability, 'platform');
        assert.equal((error as UnsupportedCapabilityError).platform, 'freebsd/riscv64');
        return true;
      },
    );
  });
});
