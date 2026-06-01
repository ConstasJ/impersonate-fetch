import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import vitestConfig from '../../vitest.config.js';

describe('vitest config', () => {
  it('vitest config keeps network fingerprint smoke out of the default test suite', () => {
    const exclude = vitestConfig.test?.exclude ?? [];

    assert.ok(exclude.includes('test/fingerprint/smoke.test.ts'));
  });
});
