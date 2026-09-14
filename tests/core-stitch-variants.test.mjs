import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { STITCHES } from '../src/core/stitches.ts';
import { libraryFor, resolveStitch } from '../src/core/stitch-variants.ts';
import { validatePattern } from '../src/core/validate.ts';
import { shellStitch, chevron } from './fixtures/examples.ts';

test('a könyvtár minden öltése azonosítóval feloldható', () => {
  for (const def of STITCHES) assert.equal(resolveStitch(def.id), def);
});

// prettier-ignore
const VARIANTS = [
  ['inc-3dc',       'group',  1, 3],
  ['inc-4hdc',      'group',  1, 4],
  ['shell-7dc',     'group',  1, 7],
  ['sc4tog',        'joined', 4, 1],
  ['tr2tog',        'joined', 2, 1],
  ['cl-4tr',        'joined', 1, 1],
  ['cl-2dc-spread', 'joined', 2, 1],
];

test('a változat az azonosítóból épül, a szerkezete az építőfüggvényé', () => {
  for (const [id, kind, consumes, produces] of VARIANTS) {
    const def = resolveStitch(id);
    assert.ok(def, id);
    assert.equal(def.id, id);
    assert.deepEqual([def.kind, def.consumes, def.produces], [kind, consumes, produces], id);
  }
});

test('ismeretlen vagy értelmetlen azonosítóra nincs öltés', () => {
  for (const id of ['xyz', 'inc-1dc', 'inc-99dc', 'inc-2ch', 'inc-2rev', 'ch2tog', 'shell-3picot', 'cl-3dc-wide']) {
    assert.equal(resolveStitch(id), undefined, id);
  }
});

test('a minta könyvtára tartalmazza a használt változatokat, így az ellenőrző hibátlannak látja', () => {
  // A kagyló és a cikcakk `inc-3dc`-t használ, ami a palettán nincs.
  for (const example of [shellStitch(), chevron()]) {
    const library = libraryFor(example.pattern);
    assert.ok(library.has('inc-3dc'));
    assert.deepEqual(validatePattern(example.pattern, library), []);
  }
});
