import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';
import { UnsupportedCapabilityError } from '@/errors.js';
import { nativeAbiSymbolNames } from '@/native/abi.js';
import type { TransportCapabilities } from '@/transport/capabilities.js';
import { assertCapability, capabilityNames, getCapabilities } from '@/transport/capabilities.js';
import type { TransportRequest } from '@/transport/types.js';

describe('transport capabilities', () => {
  it('reports native request capabilities from asset and ABI evidence', () => {
    const fixture = createLinuxX64BackendPackageRoot();

    try {
      const capabilities = getCapabilities({
        platform: 'linux',
        arch: 'x64',
        root: fixture.packageRoot,
        sourceBuilt: false,
      });

      assert.equal(capabilities.backend, 'native');
      assert.equal(capabilities.platformName, 'linux');
      assert.equal(capabilities.arch, 'x64');
      assert.equal(capabilities.nativeAssetFilename, 'impersonated-fetch-backend-linux-x64.so');
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
    } finally {
      rmSync(fixture.tempRoot, { recursive: true, force: true });
    }
  });

  it('does not mark unsupported capabilities true without native evidence', () => {
    const fixture = createLinuxX64BackendPackageRoot();

    try {
      const capabilities = getCapabilities({
        platform: 'linux',
        arch: 'x64',
        root: fixture.packageRoot,
        sourceBuilt: false,
      });

      assert.equal(capabilities.ja4, false);
      assert.equal(capabilities.streamingUpload, false);
      assert.equal(capabilities.abortSignal, false);
    } finally {
      rmSync(fixture.tempRoot, { recursive: true, force: true });
    }
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

    const fixture = createLinuxX64BackendPackageRoot();

    try {
      assert.doesNotThrow(() =>
        assertCapability(request, {
          platform: 'linux',
          arch: 'x64',
          root: fixture.packageRoot,
          sourceBuilt: false,
        }),
      );
    } finally {
      rmSync(fixture.tempRoot, { recursive: true, force: true });
    }
  });

  it('throws UnsupportedCapabilityError with backend, capability, platform, and option', () => {
    assert.throws(
      () =>
        assertCapability(
          { url: 'https://example.test/', signal: AbortSignal.timeout(1) },
          nativeLinuxX64Capabilities(),
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
      () => assertCapability({ url: 'https://example.test/', body }, nativeLinuxX64Capabilities()),
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

function createLinuxX64BackendPackageRoot(): { tempRoot: string; packageRoot: string } {
  const tempRoot = mkdtempSync(resolve(tmpdir(), 'impersonated-fetch-capabilities-'));
  const packageRoot = resolve(tempRoot, 'impersonated-fetch');
  const backendPackageRoot = resolve(
    packageRoot,
    'node_modules',
    '@impersonated-fetch',
    'backend-linux-x64',
  );

  mkdirSync(backendPackageRoot, { recursive: true });
  writeFileSync(resolve(packageRoot, 'package.json'), '{"type":"module"}\n');
  writeFileSync(
    resolve(backendPackageRoot, 'package.json'),
    '{"name":"@impersonated-fetch/backend-linux-x64"}\n',
  );
  writeFileSync(resolve(backendPackageRoot, 'impersonated-fetch-backend-linux-x64.so'), 'fixture');

  return { tempRoot, packageRoot };
}

function nativeLinuxX64Capabilities(): { capabilities: TransportCapabilities } {
  return {
    capabilities: {
      backend: 'native',
      platformName: 'linux',
      arch: 'x64',
      nativeAssetPath: '/fixture/impersonated-fetch-backend-linux-x64.so',
      nativeAssetFilename: 'impersonated-fetch-backend-linux-x64.so',
      nativeAbiSymbols: nativeAbiSymbolNames,
      platform: true,
      nativeBinary: true,
      http1_1: true,
      http2: true,
      ja3: true,
      ja4: false,
      browserPresets: true,
      customClientHello: true,
      customHttp2Settings: true,
      orderedHeaders: true,
      proxy: true,
      cookies: true,
      streamingUpload: false,
      streamingResponse: true,
      redirects: true,
      abortSignal: false,
    },
  };
}
