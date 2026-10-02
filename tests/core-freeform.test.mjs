/*
 * The free-form chart (PQW-1141, PQW-1143): a new chart is empty, every placed
 * stitch keeps its stitch, its position, its turn and an id of its own, and a
 * selection is found by a point or an area, moved and turned.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  allInside,
  boundedMove,
  emptyChart,
  moveStitches,
  placeStitch,
  rotateStitches,
  selectionCenter,
  stitchAt,
  stitchesIn,
} from '../src/core/freeform.ts';

/** A chart with the stitches placed at the given points, ids 1, 2, 3… */
function chartOf(...points) {
  return points.reduce((chart, [x, y]) => placeStitch(chart, 'sc', x, y), emptyChart());
}

const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual}`);

test('a new chart holds no stitch', () => {
  assert.deepEqual(emptyChart().stitches, []);
});

test('a placed stitch keeps its stitch and its position, unturned', () => {
  const chart = placeStitch(emptyChart(), 'sc', 120, 80);
  assert.deepEqual(chart.stitches, [{ id: 1, stitch: 'sc', x: 120, y: 80, rotation: 0 }]);
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

test('a point finds the stitch within reach, and the topmost of two that overlap', () => {
  const chart = chartOf([100, 100], [108, 100], [300, 300]);
  const reach = () => 10;
  assert.equal(stitchAt(chart, { x: 300, y: 305 }, reach), 3);
  assert.equal(stitchAt(chart, { x: 104, y: 100 }, reach), 2, 'the later stitch is drawn on top');
  assert.equal(stitchAt(chart, { x: 200, y: 200 }, reach), null);
});

test('an area takes the stitches whose centre it holds, from either corner', () => {
  const chart = chartOf([10, 10], [50, 50], [90, 90]);
  assert.deepEqual(stitchesIn(chart, { x: 0, y: 0 }, { x: 60, y: 60 }), [1, 2]);
  assert.deepEqual(stitchesIn(chart, { x: 100, y: 100 }, { x: 40, y: 40 }), [2, 3]);
  assert.deepEqual(stitchesIn(chart, { x: 20, y: 20 }, { x: 30, y: 30 }), []);
});

test('moving shifts only the selected stitches', () => {
  const moved = moveStitches(chartOf([10, 10], [50, 50]), new Set([2]), 5, -3);
  assert.deepEqual(
    moved.stitches.map(({ x, y }) => [x, y]),
    [
      [10, 10],
      [55, 47],
    ],
  );
});

test('the centre of a selection is the middle of its bounding box', () => {
  const chart = chartOf([0, 0], [100, 40], [20, 10]);
  assert.deepEqual(selectionCenter(chart, new Set([1, 2, 3])), { x: 50, y: 20 });
  assert.equal(selectionCenter(chart, new Set()), null);
});

test('one stitch turned about its own centre stays in place and gains the angle', () => {
  const chart = chartOf([40, 40]);
  const [turned] = rotateStitches(chart, new Set([1]), { x: 40, y: 40 }, Math.PI / 4).stitches;
  assert.deepEqual([turned.x, turned.y], [40, 40]);
  close(turned.rotation, Math.PI / 4, 'rotation');
});

test('several stitches turn together around their centre, each by the same angle', () => {
  const chart = chartOf([0, 0], [100, 0], [500, 500]);
  const center = selectionCenter(chart, new Set([1, 2]));
  const [a, b, c] = rotateStitches(chart, new Set([1, 2]), center, Math.PI / 2).stitches;
  close(a.x, 50, 'a.x');
  close(a.y, -50, 'a.y');
  close(b.x, 50, 'b.x');
  close(b.y, 50, 'b.y');
  close(a.rotation, Math.PI / 2, 'a.rotation');
  close(b.rotation, Math.PI / 2, 'b.rotation');
  assert.deepEqual([c.x, c.y, c.rotation], [500, 500, 0], 'an unselected stitch stays');
});

test('turns add up', () => {
  let chart = chartOf([0, 0]);
  for (let i = 0; i < 3; i += 1) chart = rotateStitches(chart, new Set([1]), { x: 0, y: 0 }, 0.5);
  close(chart.stitches[0].rotation, 1.5, 'rotation');
});

const BOARD = { width: 400, height: 300 };

test('a move stops at the edge of the board, for the outermost selected stitch', () => {
  const chart = chartOf([50, 50], [100, 80], [390, 290]);
  const both = new Set([1, 2]);
  assert.deepEqual(boundedMove(chart, both, -500, 10, BOARD), [-50, 10], 'the left one reaches x = 0');
  assert.deepEqual(boundedMove(chart, both, 10, 500, BOARD), [10, 220], 'the lower one reaches the bottom');
  assert.deepEqual(boundedMove(chart, both, 20, -20, BOARD), [20, -20], 'a move that fits is kept');
  assert.deepEqual(boundedMove(chart, new Set(), 20, 20, BOARD), [0, 0]);
});

test('only the selected stitches have to stay on the board', () => {
  const chart = chartOf([50, 50], [-10, 50]);
  assert.equal(allInside(chart, new Set([1]), BOARD), true);
  assert.equal(allInside(chart, new Set([1, 2]), BOARD), false);
});
