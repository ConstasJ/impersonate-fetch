const assert = require('node:assert/strict');

assert.throws(
  () => require('impersonated-fetch'),
  (error) => error && error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED',
);

console.log('CJS package rejection test passed');
