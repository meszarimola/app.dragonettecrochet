/*
 * The free-form chart (PQW-1141, PQW-1143, PQW-1144): a new chart is empty, every
 * placed stitch keeps its stitch, its position, its turn, its size and an id of
 * its own, and a selection is found by a point or an area, framed, moved, turned
 * and resized; PQW-1146 and PQW-1147 arrange a selection in a row or around one point.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  allInside,
  arrangeStitches,
  boundedFactor,
  boundedMove,
  copyStitches,
  deleteStitches,
  emptyChart,
  frameHolds,
  MAX_SCALE,
  MIN_SCALE,
  moveStitches,
  pasteStitches,
  placeStitch,
  rotateStitches,
  scaleStitches,
  selectionFrame,
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

test('a placed stitch keeps its stitch and its position, unturned and at its own size', () => {
  const chart = placeStitch(emptyChart(), 'sc', 120, 80);
  assert.deepEqual(chart.stitches, [{ id: 1, stitch: 'sc', x: 120, y: 80, rotation: 0, scale: 1 }]);
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

const reachOf = (placed) => 10 * placed.scale;

test('an upright frame holds every selected stitch with its reach, centred on them', () => {
  const chart = chartOf([0, 0], [100, 40], [20, 10]);
  const frame = selectionFrame(chart, new Set([1, 2, 3]), reachOf);
  assert.deepEqual(frame, { center: { x: 50, y: 20 }, angle: 0, halfWidth: 60, halfHeight: 30 });
  assert.equal(selectionFrame(chart, new Set(), reachOf), null);
});

test('the frame turns with stitches turned together, and stays upright for mixed turns', () => {
  const chart = chartOf([0, 0], [100, 0]);
  const both = new Set([1, 2]);
  const turned = rotateStitches(chart, both, { x: 50, y: 0 }, Math.PI / 2);
  const frame = selectionFrame(turned, both, reachOf);
  close(frame.angle, Math.PI / 2, 'angle');
  close(frame.center.x, 50, 'center.x');
  close(frame.center.y, 0, 'center.y');
  close(frame.halfWidth, 60, 'the frame is as long as before, along the turned row');
  close(frame.halfHeight, 10, 'and as thin');

  const mixed = rotateStitches(chart, new Set([1]), { x: 0, y: 0 }, 0.3);
  assert.equal(selectionFrame(mixed, both, reachOf).angle, 0);
});

test('a point is in the frame anywhere inside its edges, turned with the frame', () => {
  const upright = { center: { x: 50, y: 20 }, angle: 0, halfWidth: 60, halfHeight: 30 };
  assert.equal(frameHolds(upright, { x: 50, y: 20 }), true, 'the centre');
  assert.equal(frameHolds(upright, { x: -9, y: 49 }), true, 'just inside a corner');
  assert.equal(frameHolds(upright, { x: 111, y: 20 }), false, 'past the right edge');
  assert.equal(frameHolds(upright, { x: 50, y: 51 }), false, 'below the bottom edge');

  const turned = { ...upright, angle: Math.PI / 2 };
  assert.equal(frameHolds(turned, { x: 50, y: 75 }), true, 'along the turned long side');
  assert.equal(frameHolds(turned, { x: 100, y: 20 }), false, 'where the upright frame would have reached');
});

test('a full turn counts as the same turn', () => {
  let chart = chartOf([0, 0], [50, 0]);
  chart = rotateStitches(chart, new Set([1]), { x: 0, y: 0 }, Math.PI * 2);
  assert.equal(selectionFrame(chart, new Set([1, 2]), reachOf).angle, chart.stitches[0].rotation);
});

test('one stitch turned about its own centre stays in place and gains the angle', () => {
  const chart = chartOf([40, 40]);
  const [turned] = rotateStitches(chart, new Set([1]), { x: 40, y: 40 }, Math.PI / 4).stitches;
  assert.deepEqual([turned.x, turned.y], [40, 40]);
  close(turned.rotation, Math.PI / 4, 'rotation');
});

test('several stitches turn together around their centre, each by the same angle', () => {
  const chart = chartOf([0, 0], [100, 0], [500, 500]);
  const { center } = selectionFrame(chart, new Set([1, 2]), reachOf);
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

test('resizing grows the stitches and the gaps between them by the same factor', () => {
  const chart = chartOf([0, 0], [100, 0], [500, 500]);
  const [a, b, c] = scaleStitches(chart, new Set([1, 2]), { x: 50, y: 0 }, 2).stitches;
  assert.deepEqual([a.x, a.y, a.scale], [-50, 0, 2]);
  assert.deepEqual([b.x, b.y, b.scale], [150, 0, 2]);
  assert.deepEqual([c.x, c.y, c.scale], [500, 500, 1], 'an unselected stitch stays');
});

test('one stitch resized about its own centre stays in place', () => {
  const [only] = scaleStitches(chartOf([40, 40]), new Set([1]), { x: 40, y: 40 }, 0.5).stitches;
  assert.deepEqual([only.x, only.y, only.scale], [40, 40, 0.5]);
});

test('a resize stops at the smallest and the largest size, for the most extreme selected stitch', () => {
  let chart = chartOf([0, 0], [10, 0]);
  chart = scaleStitches(chart, new Set([2]), { x: 10, y: 0 }, 2);
  const both = new Set([1, 2]);
  assert.equal(boundedFactor(chart, both, 10), MAX_SCALE / 2, 'the larger one reaches the top');
  assert.equal(boundedFactor(chart, both, 0.01), MIN_SCALE, 'the smaller one reaches the bottom');
  assert.equal(boundedFactor(chart, both, 1.5), 1.5);
  assert.equal(boundedFactor(chart, new Set(), 3), 1);
});

test('deleting takes out only the selected stitches', () => {
  const chart = deleteStitches(chartOf([10, 10], [20, 20], [30, 30]), new Set([1, 3]));
  assert.deepEqual(
    chart.stitches.map(({ id }) => id),
    [2],
  );
});

test('a paste places copies with new ids, shifted, turns and sizes kept', () => {
  let chart = chartOf([10, 10], [50, 10]);
  chart = scaleStitches(rotateStitches(chart, new Set([2]), { x: 50, y: 10 }, 0.5), new Set([2]), { x: 50, y: 10 }, 2);
  const copied = copyStitches(chart, new Set([2]));
  const { chart: after, ids, copied: next } = pasteStitches(chart, copied, 20, BOARD);
  assert.deepEqual([...ids], [3]);
  const pasted = after.stitches.at(-1);
  assert.deepEqual([pasted.id, pasted.stitch, pasted.x, pasted.y, pasted.scale], [3, 'sc', 70, 30, 2]);
  close(pasted.rotation, 0.5, 'rotation');
  assert.equal(after.nextId, 4);
  assert.equal(after.stitches.length, 3, 'the original stays');
  assert.deepEqual(next, [pasted], 'the next paste starts from the copy');
});

test('where the edge leaves no room, the copy goes the other way on that axis, never onto its source', () => {
  const chart = chartOf([380, 100], [390, 120]);
  const { chart: after } = pasteStitches(chart, copyStitches(chart, new Set([1, 2])), 20, BOARD);
  assert.deepEqual(
    after.stitches.slice(2).map(({ x, y }) => [x, y]),
    [
      [360, 120],
      [370, 140],
    ],
    'left instead of right, still down',
  );

  const corner = chartOf([400, 300]);
  const { chart: cornered } = pasteStitches(corner, copyStitches(corner, new Set([1])), 20, BOARD);
  assert.deepEqual([cornered.stitches[1].x, cornered.stitches[1].y], [380, 280], 'up and left from the corner');
});

test('repeated pastes walk on from the last copy, and turn back at the edge', () => {
  let chart = chartOf([340, 100]);
  let copied = copyStitches(chart, new Set([1]));
  const xs = [];
  for (let i = 0; i < 4; i += 1) {
    const pasted = pasteStitches(chart, copied, 20, BOARD);
    chart = pasted.chart;
    copied = pasted.copied;
    xs.push(copied[0].x);
  }
  assert.deepEqual(xs, [360, 380, 400, 380]);
});

/** Every stitch 10 wide and 20 tall, so its foot is 10 under its centre. */
const EXTENT = () => ({ halfWidth: 5, halfHeight: 10 });
const ALL = new Set([1, 2, 3]);
const OPTIONS = { gap: 4, radius: 12, angle: Math.PI / 2 };

/** Where the stitch's foot is, and which way its top points. */
function footOf(placed) {
  const up = { x: Math.sin(placed.rotation), y: -Math.cos(placed.rotation) };
  return { x: placed.x - up.x * 10, y: placed.y - up.y * 10, up };
}

const byId = (chart, ...ids) => ids.map((id) => chart.stitches.find((placed) => placed.id === id));

test('a row stands the stitches upright, foot to foot, the gap apart, left to right, around where they stood', () => {
  const chart = chartOf([300, 50], [100, 90], [200, 10]);
  const turned = rotateStitches(chart, ALL, { x: 200, y: 50 }, 1);
  const arranged = arrangeStitches(turned, ALL, 'row', EXTENT, { ...OPTIONS, gap: 7 });
  const [first, second, third] = byId(arranged, 2, 3, 1);
  for (const placed of [first, second, third]) close(placed.rotation, 0, 'upright');
  close(second.x - first.x, 10 + 7, 'one stitch and one gap apart');
  close(third.x - second.x, 10 + 7, 'one stitch and one gap apart');
  close(second.x, 200, 'centred where the selection was');
  assert.ok(
    [first, second, third].every((placed) => placed.y === first.y),
    'on one line',
  );
});

test('a row of stitches of different heights shares one foot line', () => {
  const chart = chartOf([0, 0], [50, 0]);
  const extent = (placed) => ({ halfWidth: 5, halfHeight: placed.id === 1 ? 10 : 30 });
  const [short, tall] = arrangeStitches(chart, new Set([1, 2]), 'row', extent, OPTIONS).stitches;
  close(short.y + 10, tall.y + 30, 'the feet');
});

/** The point every foot faces: found from two stitches' lines, each foot `radius` back along its own direction. */
function sharedPoint(placed, radius) {
  const foot = footOf(placed);
  return { x: foot.x - foot.up.x * radius, y: foot.y - foot.up.y * radius };
}

test('around points every foot at one shared point, keeps them the radius away and spreads the angle', () => {
  const arranged = arrangeStitches(chartOf([0, 0], [50, 0], [100, 0]), ALL, 'around', EXTENT, OPTIONS);
  const [left, middle, right] = arranged.stitches;
  const point = sharedPoint(middle, 12);
  for (const placed of arranged.stitches) {
    const other = sharedPoint(placed, 12);
    close(other.x, point.x, 'one shared point');
    close(other.y, point.y, 'one shared point');
  }
  close(middle.rotation, 0, 'the middle one stands upright');
  close(left.rotation, -Math.PI / 4, 'the first leans left by half the angle');
  close(right.rotation, Math.PI / 4, 'the last leans right by half the angle');
});

test('around keeps the stitches centred where the selection was', () => {
  const arranged = arrangeStitches(chartOf([0, 0], [50, 0], [100, 0]), ALL, 'around', EXTENT, OPTIONS);
  const xs = arranged.stitches.map(({ x }) => x);
  const ys = arranged.stitches.map(({ y }) => y);
  close((Math.min(...xs) + Math.max(...xs)) / 2, 50, 'across');
  close((Math.min(...ys) + Math.max(...ys)) / 2, 0, 'up and down');
});

test('around never spreads wider than evenly all the way round, so the first and the last never meet', () => {
  const nearlyWhole = (359 * Math.PI) / 180;
  const arranged = arrangeStitches(
    chartOf([0, 0], [50, 0], [100, 0], [150, 0]),
    new Set([1, 2, 3, 4]),
    'around',
    EXTENT,
    {
      ...OPTIONS,
      angle: nearlyWhole,
    },
  );
  const turns = arranged.stitches.map(({ rotation }) => rotation);
  for (let i = 1; i < turns.length; i += 1) close(turns[i] - turns[i - 1], Math.PI / 2, 'a quarter turn apart');
  close(turns[0] + Math.PI * 2 - turns[3], Math.PI / 2, 'and a quarter between the last and the first');
});

test('the feet of an arrangement around do not meet, however small the stitches', () => {
  const chart = chartOf([0, 0], [10, 0]);
  const [a, b] = arrangeStitches(chart, new Set([1, 2]), 'around', EXTENT, { ...OPTIONS, angle: 1 }).stitches;
  const [footA, footB] = [footOf(a), footOf(b)];
  assert.ok(Math.hypot(footA.x - footB.x, footA.y - footB.y) > 1, 'the feet are apart');
});

test('a single stitch around stands upright, and an arrangement leaves the rest of the chart alone', () => {
  const chart = chartOf([0, 0], [70, 70]);
  const arranged = arrangeStitches(chart, new Set([1]), 'around', EXTENT, OPTIONS);
  close(arranged.stitches[0].rotation, 0, 'upright');
  assert.deepEqual(arranged.stitches[1], chart.stitches[1]);
  assert.equal(arrangeStitches(chart, new Set(), 'row', EXTENT, OPTIONS), chart);
});

test('an arrangement keeps every stitch, its stitch, its size and its id', () => {
  const chart = scaleStitches(chartOf([0, 0], [40, 0], [80, 0]), ALL, { x: 40, y: 0 }, 2);
  for (const arrangement of ['row', 'around']) {
    const arranged = arrangeStitches(chart, ALL, arrangement, EXTENT, OPTIONS);
    assert.deepEqual(
      arranged.stitches.map(({ id, stitch, scale }) => [id, stitch, scale]),
      chart.stitches.map(({ id, stitch, scale }) => [id, stitch, scale]),
      arrangement,
    );
    assert.equal(arranged.nextId, chart.nextId);
  }
});
