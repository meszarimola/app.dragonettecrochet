/*
 * The rectangular design's guide grid (PQW-1168): the two counts the dialog
 * reads, where the rows stand and their numbers go, which points the grid
 * takes a stitch on, and a grid that survives saving and every edit.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  chartFromJson,
  chartToJson,
  emptyChart,
  pasteStitches,
  placeStitch,
  placeStitches,
  sameChart,
} from '../src/core/freeform.ts';
import {
  cellAt,
  GRID_CELL,
  GRID_LABEL_ROOM,
  gridExtent,
  gridFrom,
  gridHome,
  gridRect,
  gridRows,
  MAX_GRID_ROWS,
  MAX_GRID_STITCHES,
  readGridCount,
  rectGrid,
  rowBottoms,
} from '../src/core/grid.ts';

const onGrid = (grid, point) => cellAt(grid, point) !== null;

test('a count is a whole number from 1 to the limit, surrounding spaces ignored', () => {
  assert.deepEqual(readGridCount(' 20 ', MAX_GRID_STITCHES), { ok: true, value: 20 });
  assert.deepEqual(readGridCount('1', MAX_GRID_ROWS), { ok: true, value: 1 });
  assert.deepEqual(readGridCount('200', MAX_GRID_STITCHES), { ok: true, value: 200 });
  assert.deepEqual(readGridCount('500', MAX_GRID_ROWS), { ok: true, value: 500 });
});

test('each way a count can be wrong has its own code', () => {
  assert.deepEqual(readGridCount('', 200), { ok: false, code: 'grid-count-empty' });
  assert.deepEqual(readGridCount('   ', 200), { ok: false, code: 'grid-count-empty' });
  for (const text of ['2.5', '2,5', '-3', 'abc', '1e2', '20 sor']) {
    assert.deepEqual(readGridCount(text, 200), { ok: false, code: 'grid-count-not-whole' }, text);
  }
  assert.deepEqual(readGridCount('0', 200), { ok: false, code: 'grid-count-too-small' });
  assert.deepEqual(readGridCount('201', MAX_GRID_STITCHES), { ok: false, code: 'grid-count-too-large' });
  assert.deepEqual(readGridCount('501', MAX_GRID_ROWS), { ok: false, code: 'grid-count-too-large' });
});

test('the limits are the owner’s: 200 stitches by 500 rows', () => {
  assert.equal(MAX_GRID_STITCHES, 200);
  assert.equal(MAX_GRID_ROWS, 500);
});

test('every row of a new grid has the stitch count as its cells', () => {
  assert.deepEqual(rectGrid(3, 4).rows, [3, 3, 3, 3]);
});

test('row 1 is at the bottom, standing on y = 0, and each row sits on the one before', () => {
  const rows = gridRows(rectGrid(20, 80));
  assert.equal(rows.length, 80);
  assert.deepEqual(
    rows.slice(0, 2).map(({ number, top, bottom, right }) => ({ number, top, bottom, right })),
    [
      { number: 1, top: -GRID_CELL, bottom: 0, right: 20 * GRID_CELL },
      { number: 2, top: -2 * GRID_CELL, bottom: -GRID_CELL, right: 20 * GRID_CELL },
    ],
  );
  assert.deepEqual(gridRect(rectGrid(20, 80)), { minX: 0, minY: -80 * GRID_CELL, maxX: 20 * GRID_CELL, maxY: 0 });
});

test('a band of the board gives only the rows reaching into it', () => {
  const grid = rectGrid(4, 500);
  assert.deepEqual(
    gridRows(grid, undefined, -3.5 * GRID_CELL, -1.5 * GRID_CELL).map(({ number }) => number),
    [2, 3, 4],
  );
  assert.deepEqual(gridRows(grid, undefined, 10, 100), [], 'below row 1 there is no row');
  assert.equal(gridRows(grid, undefined, -1e9, 1e9).length, 500);
  assert.deepEqual(gridRows(grid, undefined, -1.5 * GRID_CELL, 1e9)[0], gridRows(grid)[0]);
});

test('a taller row pushes every row above it up, and the band follows the heights', () => {
  const grid = rectGrid(4, 3);
  const heights = [GRID_CELL, 60, GRID_CELL];
  const rows = gridRows(grid, heights);
  assert.deepEqual(
    rows.map(({ top, bottom }) => [top, bottom]),
    [
      [-40, 0],
      [-100, -40],
      [-140, -100],
    ],
  );
  assert.equal(rows[1].label.y, -70, 'the number stands in the middle of its row');
  assert.deepEqual(rowBottoms(grid, heights), [0, -40, -100]);
  assert.deepEqual(gridRect(grid, heights).minY, -140);
  assert.deepEqual(cellAt(grid, { x: 50, y: -90 }, heights), { row: 1, col: 1 });
  assert.deepEqual(cellAt(grid, { x: 50, y: -90 }), { row: 2, col: 1 }, 'without heights every row is a cell');
  assert.equal(cellAt(grid, { x: 50, y: -141 }, heights), null);
  assert.deepEqual(cellAt(grid, { x: 4 * GRID_CELL, y: -1 }), { row: 0, col: 3 }, 'the right edge is the last cell');
});

test('an odd row is numbered on the right, an even row on the left, both in the middle of the row', () => {
  const [first, second] = gridRows(rectGrid(5, 2));
  assert.deepEqual(first.label, { x: 5 * GRID_CELL + GRID_LABEL_ROOM / 2, y: -GRID_CELL / 2 });
  assert.deepEqual(second.label, { x: -GRID_LABEL_ROOM / 2, y: -1.5 * GRID_CELL });
});

test('the grid takes a point in any of its cells, edges included, and nothing outside', () => {
  const grid = rectGrid(3, 2);
  for (const point of [
    { x: 0, y: 0 },
    { x: 60, y: -20 },
    { x: 3 * GRID_CELL, y: -2 * GRID_CELL },
    { x: 100, y: -79 },
  ]) {
    assert.equal(onGrid(grid, point), true, JSON.stringify(point));
  }
  for (const point of [
    { x: -1, y: -20 },
    { x: 3 * GRID_CELL + 1, y: -20 },
    { x: 60, y: 1 },
    { x: 60, y: -2 * GRID_CELL - 1 },
  ]) {
    assert.equal(onGrid(grid, point), false, JSON.stringify(point));
  }
});

test('a row of its own count is as wide as its own cells', () => {
  const grid = { rows: [2, 4] };
  assert.equal(onGrid(grid, { x: 3 * GRID_CELL, y: -GRID_CELL / 2 }), false);
  assert.equal(onGrid(grid, { x: 3 * GRID_CELL, y: -1.5 * GRID_CELL }), true);
});

test('the extent takes in the row numbers on both sides', () => {
  assert.deepEqual(gridExtent(rectGrid(2, 3)), {
    minX: -GRID_LABEL_ROOM,
    minY: -3 * GRID_CELL,
    maxX: 2 * GRID_CELL + GRID_LABEL_ROOM,
    maxY: 0,
  });
});

test('a new grid opens at 100% with row 1 and its numbers just inside the bottom left of the screen', () => {
  const view = gridHome(rectGrid(20, 80), { width: 800, height: 600 });
  assert.equal(view.zoom, 1);
  assert.ok(view.origin.x < -GRID_LABEL_ROOM, 'the even rows’ numbers are on screen');
  const bottom = view.origin.y + 600;
  assert.ok(bottom > 0 && bottom < GRID_CELL, 'row 1’s foot is near the bottom edge');
});

test('a stored grid is read back only if every row is a count within the limits', () => {
  assert.deepEqual(gridFrom({ rows: [20, 20] }), { rows: [20, 20] });
  for (const bad of [
    null,
    7,
    {},
    { rows: [] },
    { rows: [0] },
    { rows: [2.5] },
    { rows: ['20'] },
    { rows: [MAX_GRID_STITCHES + 1] },
    { rows: Array.from({ length: MAX_GRID_ROWS + 1 }, () => 1) },
  ]) {
    assert.equal(gridFrom(bad), null, JSON.stringify(bad)?.slice(0, 40));
  }
});

test('a chart keeps its grid through saving, and a broken grid reads as no chart', () => {
  const chart = placeStitch({ ...emptyChart(), grid: rectGrid(20, 80) }, 'sc', 10, -10);
  const read = chartFromJson(chartToJson(chart));
  assert.deepEqual(read?.grid, { rows: chart.grid.rows });
  assert.ok(sameChart(read, chart));
  assert.equal(chartFromJson(chartToJson(emptyChart()))?.grid, undefined, 'a free-form chart stays without one');
  assert.equal(chartFromJson(JSON.stringify({ stitches: [], nextId: 1, grid: { rows: [0] } })), null);
});

test('two charts with different grids are different charts', () => {
  const a = { ...emptyChart(), grid: rectGrid(20, 20) };
  assert.ok(sameChart(a, { ...emptyChart(), grid: rectGrid(20, 20) }));
  assert.ok(!sameChart(a, { ...emptyChart(), grid: rectGrid(20, 21) }));
  assert.ok(!sameChart(a, emptyChart()));
});

test('placing and pasting keep the grid', () => {
  const grid = rectGrid(5, 5);
  const start = { ...emptyChart(), grid };
  const extent = () => ({ halfWidth: 5, halfHeight: 5 });
  const bounds = gridRect(grid);
  const placed = placeStitches(start, 'sc', { x: 20, y: -20 }, 3, extent, 4, bounds);
  assert.equal(placed?.chart.grid, grid);
  assert.equal(placeStitch(start, 'sc', 1, -1).grid, grid);
  assert.equal(pasteStitches(placed.chart, placed.chart.stitches, 20, bounds).chart.grid, grid);
});
