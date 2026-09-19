import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { libraryFor, resolveStitch } from '../src/core/stitch-variants.ts';
import { STITCHES } from '../src/core/stitches.ts';
import { validatePattern } from '../src/core/validate.ts';
import { chevron, shellStitch } from './fixtures/examples.ts';

test('every stitch in the library resolves by its id', () => {
  for (const def of STITCHES) assert.equal(resolveStitch(def.id), def);
});

// prettier-ignore
const VARIANTS = [
  ['inc-3dc', 'group', 1, 3],
  ['inc-4hdc', 'group', 1, 4],
  ['shell-7dc', 'group', 1, 7],
  ['sc4tog', 'joined', 4, 1],
  ['tr2tog', 'joined', 2, 1],
  ['cl-4tr', 'joined', 1, 1],
  ['cl-2dc-spread', 'joined', 2, 1],
];

test('a variant is built from its id, and its structure comes from the builder', () => {
  for (const [id, kind, consumes, produces] of VARIANTS) {
    const def = resolveStitch(id);
    assert.ok(def, id);
    assert.equal(def.id, id);
    assert.deepEqual([def.kind, def.consumes, def.produces], [kind, consumes, produces], id);
  }
});

test('an unknown or nonsensical id resolves to no stitch', () => {
  for (const id of ['xyz', 'inc-1dc', 'inc-99dc', 'inc-2ch', 'inc-2rev', 'ch2tog', 'shell-3picot', 'cl-3dc-wide']) {
    assert.equal(resolveStitch(id), undefined, id);
  }
});

test('the library derived from a pattern holds the variants it uses, so validation finds nothing', () => {
  // The shell and the chevron use `inc-3dc`, which is not on the palette.
  for (const example of [shellStitch(), chevron()]) {
    const library = libraryFor(example.pattern);
    assert.ok(library.has('inc-3dc'));
    assert.deepEqual(validatePattern(example.pattern, library), []);
  }
});
