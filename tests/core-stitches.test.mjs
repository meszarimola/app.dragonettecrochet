import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { STITCHES, stitchById } from '../src/core/stitches.ts';

test('a prototípus négy öltése egyedi azonosítóval szerepel', () => {
  assert.deepEqual(
    STITCHES.map((stitch) => stitch.id),
    ['chain', 'single', 'halfDouble', 'double'],
  );
});

test('minden öltésnek van magyar és angol neve, rövidítése', () => {
  for (const stitch of STITCHES) {
    for (const field of ['hu', 'abbrHu', 'en', 'abbrEn']) {
      assert.ok(stitch[field].trim(), `${stitch.id}: üres a(z) ${field} mező`);
    }
  }
});

test('az azonosítóból visszakapjuk az öltést', () => {
  assert.equal(stitchById('single').hu, 'Rövidpálca');
});

test('ismeretlen azonosítóra hibát dob', () => {
  assert.throws(() => stitchById('nincs-ilyen'), /Ismeretlen jel: nincs-ilyen/);
});
