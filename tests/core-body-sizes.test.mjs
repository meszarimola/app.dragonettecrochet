/*
 * Body measurements and ease (PQW-866): checking the CYC tables against the
 * suspicions raised in the knowledge base (05 §3.1–3.2), head circumference
 * and hat sizes, the fit levels, and hat ease.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  BABY,
  BODY_TABLES,
  bodySizeName,
  CHILD,
  FIT_EASE,
  fitLevelOf,
  HAT_SIZES,
  HEAD_CIRCUMFERENCE,
  hatEase,
  inchToCm,
  MEN,
  mid,
  tableFlags,
  WOMEN,
} from '../src/core/body-sizes.ts';

const flagKeys = (table) => tableFlags(table).map((flag) => `${flag.size}:${flag.measure}:${flag.kind}`);

test('the WOMEN table: the 5X upper-arm inch value disagrees with its cm value (18½" ≠ 49,5 cm)', () => {
  const inch = tableFlags(WOMEN).filter((flag) => flag.kind === 'inch-mismatch');
  assert.deepEqual(
    inch.map((flag) => `${flag.size}:${flag.measure}`),
    ['5X:upperArm'],
  );
  // The suspicion reaches the UI as a code plus data; the dictionary supplies the measure name and the number format (PQW-904).
  assert.equal(inch[0].note.code, 'flag-inch-mismatch');
  assert.deepEqual(inch[0].note.data, {
    measure: 'upperArm',
    inch: [18.5, 18.5],
    converted: [47, 47],
    cm: [49.5, 49.5],
  });
});

test('the WOMEN table: back waist, cross back and arm length repeat unchanged from 2X to 5X, which looks like a copy-paste error', () => {
  const keys = flagKeys(WOMEN);
  for (const size of ['2X', '3X', '4X', '5X']) {
    for (const measure of ['backWaist', 'crossBack', 'armLength'])
      assert.ok(keys.includes(`${size}:${measure}:identical-rows`), `${size} ${measure}`);
  }
  // Sizes XS–L raise no suspicion.
  assert.ok(
    keys.every((key) => !/^(XS|S|M|L):/.test(key)),
    keys.join(' '),
  );
});

test('the MEN table: the 4X arm length is shorter than 3X and disagrees with its inch value; the hip-length label is called out in a note', () => {
  assert.deepEqual(flagKeys(MEN).sort(), ['4X:armLength:inch-mismatch', '4X:armLength:not-monotonic']);
  assert.ok(MEN.notes.some((note) => /csípőig mért háthosszt/.test(note)));
  assert.equal(MEN.sizes[0].values.upperArm, undefined);
});

test('the CHILD table holds no suspicious data; in BABY the back waist and arm length repeat from 12 to 24 months', () => {
  assert.deepEqual(flagKeys(CHILD), []);
  assert.deepEqual(flagKeys(BABY).sort(), [
    '12:armLength:identical-rows',
    '12:backWaist:identical-rows',
    '18:armLength:identical-rows',
    '18:backWaist:identical-rows',
    '24:armLength:identical-rows',
    '24:backWaist:identical-rows',
  ]);
});

test('every table cites a source, and its sizes are ordered by increasing chest measurement', () => {
  for (const table of Object.values(BODY_TABLES)) {
    assert.match(table.source, /^https:\/\/www\.craftyarncouncil\.com\//);
    const chest = table.sizes.map((size) => mid(size.values.chest));
    assert.deepEqual(
      [...chest].sort((a, b) => a - b),
      chest,
      table.id,
    );
  }
  assert.equal(mid(WOMEN.sizes[2].values.chest), 94);
});

test('head circumference in cm agrees with the inch value and grows with each age group', () => {
  let previous = [0, 0];
  for (const head of HEAD_CIRCUMFERENCE) {
    assert.ok(
      Math.abs(head.cm[0] - head.inch[0] * 2.54) <= 1.5 && Math.abs(head.cm[1] - head.inch[1] * 2.54) <= 1.5,
      head.id,
    );
    assert.ok(head.cm[0] >= previous[0] && head.cm[1] >= previous[1], head.id);
    previous = head.cm;
  }
});

test('hat sizes: the crown diameter is about the hat circumference / π (05 §5.2)', () => {
  for (const size of HAT_SIZES) assert.ok(Math.abs(size.crownIn - size.hatIn / Math.PI) <= 0.3, size.id);
  assert.equal(inchToCm(22), 55.9);
});

test('hat ease: −2,5 cm on a head under 46 cm, −5 cm above that, but never more than 10% of the head circumference', () => {
  assert.equal(hatEase(45.7), -2.5);
  assert.equal(hatEase(55.9), -5);
  // On a 48,3 cm head, −5 cm would come to 10,4%.
  assert.equal(hatEase(48.3), -4.8);
});

test('the fit levels follow the CYC table', () => {
  assert.deepEqual([-6, 0, 8, 12, 20].map(fitLevelOf), ['very-close', 'close', 'classic', 'loose', 'oversized']);
  assert.deepEqual(FIT_EASE.classic, { name: 'klasszikus', min: 5, max: 10 });
});

test('size names: years for a child, months for a baby, in English too', () => {
  assert.equal(bodySizeName('women', 'M', 'hu'), 'M');
  assert.equal(bodySizeName('child', '8', 'hu'), '8 év');
  assert.equal(bodySizeName('baby', '6', 'en-US'), '6 mo');
});
