import assert from 'node:assert/strict';

const pkg = await import(new URL('../../dist/index.mjs', import.meta.url).href);

assert.equal(typeof pkg.fetch, 'function');
assert.equal(typeof pkg.Client, 'function');
assert.equal(typeof pkg.Session, 'function');

console.log('ESM package smoke test passed');
