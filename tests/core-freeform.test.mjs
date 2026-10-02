/*
 * The free-form chart (PQW-1141): a new chart is empty, and every placed stitch
 * keeps its stitch, its position and an id of its own.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { emptyChart, placeStitch } from '../src/core/freeform.ts';

test('a new chart holds no stitch', () => {
  assert.deepEqual(emptyChart().stitches, []);
});

test('a placed stitch keeps its stitch and its position', () => {
  const chart = placeStitch(emptyChart(), 'sc', 120, 80);
  assert.deepEqual(chart.stitches, [{ id: 1, stitch: 'sc', x: 120, y: 80 }]);
});

test('stitches keep their order, and every one gets a new id', () => {
  let chart = emptyChart();
  for (const [stitch, x] of [
    ['ch', 10],
    ['ch', 30],
    ['dc', 20],
  ]) {
    chart = placeStitch(chart, stitch, x, 0);
  }
  assert.deepEqual(
    chart.stitches.map(({ id, stitch }) => [id, stitch]),
    [
      [1, 'ch'],
      [2, 'ch'],
      [3, 'dc'],
    ],
  );
});

test('placing a stitch leaves the earlier chart untouched', () => {
  const before = emptyChart();
  const after = placeStitch(before, 'sc', 0, 0);
  assert.equal(before.stitches.length, 0);
  assert.equal(after.stitches.length, 1);
});
