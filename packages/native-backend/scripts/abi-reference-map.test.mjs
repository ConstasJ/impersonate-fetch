import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const referenceMapPath = new URL('../docs/abi-reference-map.md', import.meta.url);

const expectedReferences = [
  ['request', 'refs/psuedocodes/main.request.c'],
  ['stream_request', 'refs/psuedocodes/main.streamRequest.c'],
  ['stream_read', 'refs/psuedocodes/main.streamRead.c'],
  ['stream_close', 'refs/psuedocodes/main.streamClose.c'],
  ['freeMemory', 'refs/psuedocodes/main.freeMemory.c'],
  ['request construction', 'refs/psuedocodes/main.buildRequest.c'],
  ['session behavior', 'refs/psuedocodes/main.GetSession.c'],
];

test('documents pseudocode references for every Phase 1 ABI behavior', async () => {
  const map = await readFile(referenceMapPath, 'utf8');

  for (const [behavior, reference] of expectedReferences) {
    assert.match(map, new RegExp('\\\\| `' + escapeRegExp(behavior) + '`'));
    assert.match(map, new RegExp('\\\\| `' + escapeRegExp(reference) + '`'));
  }
});

test('records missing checked-in pseudocode files explicitly', async () => {
  const map = await readFile(referenceMapPath, 'utf8');

  assert.match(map, /Current source status: `refs\/psuedocodes\/` is not checked in/);
  assert.match(map, /Do not implement parity-sensitive wrapper\s+behavior from memory/);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
