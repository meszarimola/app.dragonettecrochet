/*
 * Seating a stitch in the rectangular grid (PQW-1172): how many cells a stitch
 * takes, which way a row fills, replacing what is covered, the row heights and
 * where a seated stitch stands; and a stitch moved by hand leaving its cells.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  chartFromJson,
  chartToJson,
  emptyChart,
  moveStitches,
  pasteStitches,
  rotateStitches,
  sameChart,
  scaleStitches,
} from '../src/core/freeform.ts';
import { GRID_CELL, rectGrid } from '../src/core/grid.ts';
import { cellSpan, placeInGrid, rowHeights, seat, spansFrom, workDirection } from '../src/core/seat.ts';

/** Ink at scale 1, from the symbols' measured sizes: sc is 27 tall, dc 51, tr 63. */
const SIZES = {
  ch: { width: 27, height: 15, drop: 7.5 },
  sc: { width: 27, height: 27, drop: 13.5 },
  dc: { width: 21, height: 51, drop: 25.5 },
  tr: { width: 21, height: 63, drop: 31.5 },
  'shell-5dc': { width: 79.5, height: 51, drop: 25.5 },
  'ch-sp': { width: 43.6, height: 20, drop: 10 },
  /** Ink reaching further up than down from where it is drawn. */
  'rev-sc': { width: 27, height: 40, drop: 12 },
};
const size = (placed) => SIZES[placed.stitch] ?? { width: 20, height: 20, drop: 10 };

const gridChart = (stitches = 10, rows = 4) => ({ ...emptyChart(), grid: rectGrid(stitches, rows) });

function laid(chart, stitch, row, col, count = 1) {
  const placed = placeInGrid(chart, stitch, { row, col }, count);
  assert.ok(placed, `${stitch} fits at ${row}/${col}`);
  return seat(placed.chart, size);
}

test('a stitch takes as many cells as its symbol has parts', () => {
  const spans = Object.fromEntries(
    ['sc', 'dc', 'ch', 'shell-5dc', 'v-st-dc', 'inc-2sc', 'dc3tog', 'bobble-5dc', 'puff-3', 'cl-3dc', 'inc-4dc'].map(
      (id) => [id, cellSpan(id)],
    ),
  );
  assert.deepEqual(spans, {
    sc: 1,
    dc: 1,
    ch: 1,
    'shell-5dc': 5,
    'v-st-dc': 3,
    'inc-2sc': 2,
    dc3tog: 3,
    'bobble-5dc': 5,
    'puff-3': 3,
    'cl-3dc': 3,
    'inc-4dc': 4,
  });
});

test('an odd row is worked from the right, an even row from the left', () => {
  assert.equal(workDirection(0), -1, 'row 1');
  assert.equal(workDirection(1), 1, 'row 2');
  assert.equal(workDirection(2), -1, 'row 3');
});

test('a row fills from the clicked cell in its working direction and stops at its end', () => {
  assert.deepEqual(
    spansFrom(10, { row: 0, col: 5 }, 1, 3).map(({ col }) => col),
    [5, 4, 3],
    'row 1 goes left',
  );
  assert.deepEqual(
    spansFrom(10, { row: 1, col: 5 }, 1, 3).map(({ col }) => col),
    [5, 6, 7],
    'row 2 goes right',
  );
  assert.deepEqual(
    spansFrom(10, { row: 0, col: 1 }, 1, 5).map(({ col }) => col),
    [1, 0],
    'stops at the row’s end',
  );
});

test('a stitch of several cells grows the working way from the clicked cell, pushed back to fit', () => {
  assert.deepEqual(spansFrom(10, { row: 0, col: 5 }, 3, 1), [{ row: 0, col: 3, span: 3 }], 'row 1: cells 3–5');
  assert.deepEqual(spansFrom(10, { row: 1, col: 5 }, 3, 1), [{ row: 1, col: 5, span: 3 }], 'row 2: cells 5–7');
  assert.deepEqual(spansFrom(10, { row: 0, col: 1 }, 5, 1), [{ row: 0, col: 0, span: 5 }], 'pushed back on the left');
  assert.deepEqual(spansFrom(10, { row: 1, col: 8 }, 5, 1), [{ row: 1, col: 5, span: 5 }], 'pushed back on the right');
  assert.deepEqual(spansFrom(3, { row: 0, col: 1 }, 5, 1), [], 'a row too short takes none');
});

test('a seated stitch stands in the middle of its cells with its foot on the row’s bottom line', () => {
  const chart = laid(gridChart(), 'sc', 0, 2);
  const [sc] = chart.stitches;
  assert.equal(sc.x, 2.5 * GRID_CELL);
  assert.equal(sc.y + SIZES.sc.drop, 0, 'foot on row 1’s bottom, y = 0');
  assert.equal(sc.rotation, 0);
  assert.equal(sc.scale, 1);
  assert.deepEqual(sc.cell, { row: 0, col: 2, span: 1 });
});

test('an off-centre symbol still has its foot on the line, and its row is as tall as its ink', () => {
  const chart = laid(gridChart(), 'rev-sc', 0, 0);
  assert.equal(chart.stitches[0].y, -SIZES['rev-sc'].drop, 'the foot, not the middle, on y = 0');
  assert.deepEqual(rowHeights(chart, size)[0], GRID_CELL, '40 tall: exactly one cell');
});

test('a row is as tall as its tallest seated stitch, and never less than a cell', () => {
  let chart = laid(gridChart(), 'sc', 0, 0);
  chart = laid(chart, 'dc', 1, 0);
  chart = laid(chart, 'ch', 2, 0);
  assert.deepEqual(rowHeights(chart, size), [GRID_CELL, 51, GRID_CELL, GRID_CELL]);
  chart = laid(chart, 'tr', 1, 4);
  assert.deepEqual(rowHeights(chart, size), [GRID_CELL, 63, GRID_CELL, GRID_CELL], 'the tallest wins');
});

test('a taller row lifts the stitches of every row above it', () => {
  let chart = laid(gridChart(), 'sc', 2, 0);
  const before = chart.stitches[0].y;
  chart = laid(chart, 'dc', 1, 0);
  const sc = chart.stitches.find(({ stitch }) => stitch === 'sc');
  assert.equal(sc.y, before - (51 - GRID_CELL), 'row 3 moved up by what row 2 grew');
});

test('a symbol wider than its cells is shrunk to their width, and the row takes the shrunk height', () => {
  const chart = laid(gridChart(), 'ch-sp', 0, 3);
  const [space] = chart.stitches;
  assert.equal(space.scale, GRID_CELL / SIZES['ch-sp'].width);
  const shell = laid(gridChart(), 'shell-5dc', 1, 2).stitches[0];
  assert.equal(shell.scale, 1, 'a shell is narrower than its five cells');
  assert.equal(shell.x, 4.5 * GRID_CELL, 'in the middle of cells 2–6');
});

test('a stitch laid over seated ones replaces every one whose cells it covers', () => {
  let chart = laid(gridChart(), 'sc', 1, 3, 3);
  assert.deepEqual(
    chart.stitches.map(({ cell }) => cell.col),
    [3, 4, 5],
  );
  chart = laid(chart, 'dc', 1, 4);
  assert.deepEqual(
    chart.stitches.map(({ stitch, cell }) => [stitch, cell.col]),
    [
      ['sc', 3],
      ['sc', 5],
      ['dc', 4],
    ],
  );
  chart = laid(chart, 'shell-5dc', 1, 2);
  assert.deepEqual(
    chart.stitches.map(({ stitch }) => stitch),
    ['shell-5dc'],
    'a shell over cells 2–6 takes all three',
  );
});

test('a stitch in another row, or a free one, is never replaced', () => {
  let chart = laid(gridChart(), 'sc', 0, 4);
  chart = { ...chart, stitches: [...chart.stitches, { id: 99, stitch: 'dc', x: 170, y: -50, rotation: 0, scale: 1 }] };
  chart = laid({ ...chart, nextId: 100 }, 'dc', 1, 4);
  assert.equal(chart.stitches.length, 3);
});

test('seating twice changes nothing, and gives back the same chart', () => {
  const chart = laid(gridChart(), 'dc', 0, 0);
  assert.equal(seat(chart, size), chart);
});

test('a stitch moved, turned, resized or pasted leaves its cells and stays where it is put', () => {
  const chart = laid(gridChart(), 'sc', 0, 2);
  const ids = new Set([chart.stitches[0].id]);
  for (const [name, next] of [
    ['moved', moveStitches(chart, ids, 5, 0)],
    ['turned', rotateStitches(chart, ids, { x: 0, y: 0 }, 0.3)],
    ['resized', scaleStitches(chart, ids, { x: 0, y: 0 }, 1.2)],
  ]) {
    assert.equal(next.stitches[0].cell, undefined, name);
    assert.equal(seat(next, size), next, `${name}: seat leaves it alone`);
  }
  const pasted = pasteStitches(chart, chart.stitches, 20, { minX: -999, minY: -999, maxX: 999, maxY: 999 });
  assert.equal(pasted.copied[0].cell, undefined, 'a copy is free');
  assert.deepEqual(pasted.chart.stitches[0].cell, { row: 0, col: 2, span: 1 }, 'the original keeps its cell');
});

test('a seated stitch keeps its cell through saving; a cell the grid lacks lets it go free', () => {
  const chart = laid(gridChart(), 'shell-5dc', 1, 2);
  const read = chartFromJson(chartToJson(chart));
  assert.ok(sameChart(read, chart));
  assert.deepEqual(read.stitches[0].cell, { row: 1, col: 2, span: 5 });
  const outside = JSON.stringify({
    ...chart,
    stitches: [{ ...chart.stitches[0], cell: { row: 1, col: 7, span: 5 } }],
  });
  assert.equal(chartFromJson(outside).stitches[0].cell, undefined, 'past the row’s end');
  const broken = JSON.stringify({ ...chart, stitches: [{ ...chart.stitches[0], cell: { row: -1, col: 0, span: 1 } }] });
  assert.equal(chartFromJson(broken).stitches[0].cell, undefined, 'a malformed cell');
  const freeform = JSON.stringify({ stitches: [{ ...chart.stitches[0] }], nextId: chart.nextId });
  assert.equal(chartFromJson(freeform).stitches[0].cell, undefined, 'no grid, no cell');
});

test('two charts that differ only in a cell are different charts', () => {
  const chart = laid(gridChart(), 'sc', 0, 2);
  const other = { ...chart, stitches: [{ ...chart.stitches[0], cell: { row: 0, col: 3, span: 1 } }] };
  assert.ok(!sameChart(chart, other));
});

test('nothing is placed off the grid’s rows, or where no span fits', () => {
  assert.equal(placeInGrid(gridChart(10, 4), 'sc', { row: 4, col: 0 }, 1), null);
  assert.equal(placeInGrid(gridChart(3, 4), 'shell-5dc', { row: 0, col: 0 }, 1), null);
  assert.equal(placeInGrid(emptyChart(), 'sc', { row: 0, col: 0 }, 1), null);
});
