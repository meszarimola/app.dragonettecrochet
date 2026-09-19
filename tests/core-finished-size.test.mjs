import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { pieceSize, sizeDeviation } from '../src/core/finished-size.ts';
import { createStitchLibrary } from '../src/core/stitch-library.ts';
import { STITCHES } from '../src/core/stitches.ts';
import { WORKED_EXAMPLE, exampleJson, exampleProfiles } from './fixtures/calibration.ts';

const library = createStitchLibrary(STITCHES);
const { unblocked } = exampleProfiles();

function near(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} ≠ ${expected} (±${epsilon})`);
}

const rows = (count, stitches) => Array.from({ length: count }, () => ({ shape: 'row', stitches }));
const scRow = (count) => Array.from({ length: count }, () => 'sc');

describe('piece worked in rows', () => {
  test('20 × 20 single crochet with a profile: measured width and height per row and in total', () => {
    const size = pieceSize(rows(20, scRow(20)), { library, profile: unblocked, hookMm: 4 });
    assert.equal(size.source, 'measured');
    assert.equal(size.estimated, false);
    assert.equal(size.layers.length, 20);

    const first = size.layers[0];
    near(first.widthCm.value, 11.3);
    near(first.heightCm.value, 0.455);
    near(first.totalHeightCm.value, 0.455);
    assert.deepEqual(first.basis, ['measured']);
    near(size.layers[19].totalHeightCm.value, 9.1);

    assert.equal(size.total.form, 'rows');
    near(size.total.widthCm.value, 11.3);
    near(size.total.heightCm.value, 9.1);
    near(size.total.areaCm2.value, 11.3 * 9.1);
    assert.equal(size.total.widthCm.range, null);
  });

  test('without a profile the size is an estimate with a range, and says so', () => {
    const size = pieceSize(rows(20, scRow(20)), { library, profile: null, hookMm: 4 });
    assert.equal(size.estimated, true);
    assert.equal(size.source, 'estimated');
    for (const layer of size.layers) {
      assert.equal(layer.source, 'estimated');
      assert.deepEqual(layer.basis, ['hook']);
    }
    const { widthCm, heightCm } = size.total;
    near(widthCm.value, 20 * 0.564);
    assert.ok(widthCm.range[0] < widthCm.value && widthCm.value < widthCm.range[1]);
    assert.ok(heightCm.range[0] < heightCm.value && heightCm.value < heightCm.range[1]);
  });

  test('in a mixed row the height comes from the tallest stitch and the width from all the stitches', () => {
    const [row] = pieceSize([{ shape: 'row', stitches: ['sc', 'dc', 'sc'] }], { library, profile: unblocked, hookMm: 4 }).layers;
    assert.equal(row.source, 'estimated');
    assert.deepEqual(row.basis, ['measured', 'profile-stitch']);
    near(row.heightCm.value, 0.455 * 2.6);
    near(row.widthCm.value, 0.565 * 3);
    near(row.widthCm.range[0], 0.565 * 2.9);
    near(row.widthCm.range[1], 0.565 * 3.1);
  });

  test('a picot adds no width and no height', () => {
    const context = { library, profile: unblocked, hookMm: 4 };
    const plain = pieceSize([{ shape: 'row', stitches: ['sc', 'sc'] }], context).layers[0];
    const withPicot = pieceSize([{ shape: 'row', stitches: ['sc', 'picot', 'sc'] }], context).layers[0];
    assert.deepEqual(withPicot, plain);
  });
});

describe('piece worked in rounds', () => {
  const circle = Array.from({ length: 8 }, (_, i) => ({ shape: 'round', stitches: scRow(6 * (i + 1)) }));

  test('WE-001: 8 rounds of single crochet from the in-the-round gauge give an 80 mm diameter, within ±5 % of the measured 78.5–80 mm', () => {
    const size = pieceSize(circle, { library, profile: unblocked, hookMm: 4 });
    assert.equal(size.source, 'measured');
    assert.equal(size.total.form, 'circle');
    near(size.total.widthCm.value, 8);
    near(size.total.heightCm.value, 8);
    near(size.total.areaCm2.value, Math.PI * 16);
    near(size.layers[7].widthCm.value, 48 * 0.55);

    const example = exampleJson(WORKED_EXAMPLE);
    const [prediction] = example.predictions;
    near(size.total.widthCm.value * 10, prediction.valueMm);
    const [measurement] = example.measurements;
    const deviation = sizeDeviation(prediction.valueMm, measurement.valuesMm);
    near(deviation.meanMm, 237.5 / 3);
    near(deviation.deviation, (237.5 / 3 - 80) / 80);
    assert.equal(deviation.withinTolerance, true);
  });

  test('without a profile the circle is an estimate too', () => {
    const size = pieceSize(circle, { library, profile: null, hookMm: 4 });
    assert.equal(size.estimated, true);
    assert.ok(size.total.widthCm.range);
  });

  test('the magic ring adds no size', () => {
    const withRing = pieceSize([{ shape: 'round', stitches: ['magic-ring'] }, ...circle], { library, profile: unblocked, hookMm: 4 });
    near(withRing.total.widthCm.value, 8);
  });
});

describe('edge cases', () => {
  const context = { library, profile: unblocked, hookMm: 4 };

  test('a piece mixing rows and rounds has per-layer sizes only', () => {
    const size = pieceSize([...rows(1, scRow(4)), { shape: 'round', stitches: scRow(6) }], context);
    assert.equal(size.layers.length, 2);
    assert.equal(size.total, null);
  });

  test('empty piece', () => {
    assert.deepEqual(pieceSize([], context), { layers: [], total: null, source: 'measured', estimated: false });
  });

  test('an unknown stitch throws', () => {
    assert.throws(() => pieceSize(rows(1, ['nincs-ilyen']), context), RangeError);
  });

  test('a deviation over 5 % is out of tolerance', () => {
    assert.equal(sizeDeviation(80, [84, 85, 86]).withinTolerance, false);
    assert.equal(sizeDeviation(80, [84, 84, 84]).withinTolerance, true);
  });
});
