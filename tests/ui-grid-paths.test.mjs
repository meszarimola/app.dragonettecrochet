/*
 * The grid drawn as paths (PQW-874): the canvas and the SVG export draw the
 * very same thing.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { contextOf, emptyPattern } from '../src/core/editor.ts';
import { chartGrid } from '../src/core/grid.ts';
import { DEFAULT_MOTIF, generateMotif } from '../src/core/round-generator.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { gridPaths, LINE_WIDTH } from '../src/ui/grid-paths.ts';
import { grannySquare, hdcRectangle } from './fixtures/examples.ts';

const gridOf = (pattern, kind) => chartGrid(pattern, libraryFor(pattern), kind, contextOf(pattern));

test('row grid: one fill per band, lines from lightest to heaviest, and no broken number', () => {
  const grid = gridOf(hdcRectangle({ rows: 11 }).pattern, 'rows');
  const paths = gridPaths(grid);
  assert.equal(paths.bands.length, grid.bands.length);
  assert.deepEqual(
    paths.bands.slice(0, 3).map((band) => band.tone),
    [0, 1, 0],
  );
  const text = JSON.stringify(paths);
  assert.doesNotMatch(text, /NaN|undefined|Infinity/);
  const order = ['cell', 'row', 'five', 'ten'];
  const weights = paths.lines.map((line) => order.indexOf(line.weight));
  assert.ok(
    weights.every((w, i) => i === 0 || w >= weights[i - 1]),
    'the emphasised line is drawn last',
  );
  for (const weight of order)
    assert.ok(
      paths.lines.some((line) => line.weight === weight),
      weight,
    );
  // The lines of the row in progress, still empty, are dashed.
  assert.ok(paths.lines.some((line) => line.dashed));
  assert.ok(LINE_WIDTH.ten > LINE_WIDTH.five && LINE_WIDTH.five > LINE_WIDTH.row);
});

test('concentric grid: arcs and evenodd-filled annuli', () => {
  const paths = gridPaths(gridOf(grannySquare().pattern, 'rounds'));
  assert.equal(paths.bands[0].evenOdd, false, 'the magic ring is a solid disc');
  assert.ok(paths.bands.slice(1).every((band) => band.evenOdd && /A/.test(band.d)));
  assert.ok(
    paths.lines.some((line) => /L/.test(line.d)),
    'radial cell boundary',
  );
  assert.doesNotMatch(JSON.stringify(paths), /NaN|undefined|Infinity/);
});

test('polygon grid (PQW-888): straight-sided rings with no arc', () => {
  const { pattern } = generateMotif(emptyPattern(), { ...DEFAULT_MOTIF, shape: 'hexagon', rounds: 3 });
  const paths = gridPaths(gridOf(pattern, 'rounds'));
  const corners = (d) => (d.match(/[ML]/g) ?? []).length;
  assert.ok(
    paths.bands.every((band) => !/A/.test(band.d)),
    'no arc',
  );
  assert.equal(corners(paths.bands[0].d), 6, 'the centre band is a solid hexagon');
  assert.ok(
    paths.bands.slice(1).every((band) => band.evenOdd && corners(band.d) === 12),
    'a ring is two hexagons',
  );
  assert.doesNotMatch(JSON.stringify(paths), /NaN|undefined|Infinity/);
});

/*
 * The foundation chain has no cell lines (PQW-923).
 *
 * On a long foundation chain the owner saw thick vertical lines chopping the
 * work into irregular groups of three to five stitches. Those were the cell
 * boundaries of the grid: cells take their width from the actual position of
 * the stitches, chain stitches sit at uneven spacing, and back then every 5th
 * and 10th cell line was thicker as well. (PQW-924 has since removed cell-line
 * emphasis altogether.) The cell stays — clicking it still crochets — only
 * its line goes.
 */
test('the foundation chain cells get no separator line, while the other rows do', () => {
  const grid = gridOf(hdcRectangle({ rows: 4 }).pattern, 'rows');
  const paths = gridPaths(grid);
  const foundationCells = grid.cells.filter((cell) => cell.layer === 0);
  assert.ok(foundationCells.length > 0, 'the foundation chain does have cells: clicking still works');

  // Cell lines run vertically along the right edge of a cell: „M<x> <y>V<y2>”.
  const verticals = paths.lines.filter((line) => /^M[-\d.]+ [-\d.]+V[-\d.]+$/.test(line.d));
  const xOf = (line) => Number(/^M([-\d.]+) /.exec(line.d)[1]);
  const yOf = (line) => Number(/^M[-\d.]+ ([-\d.]+)V/.exec(line.d)[1]);

  const band = grid.bands.find((candidate) => candidate.layer === 0);
  assert.ok(band && band.area.kind === 'rect');
  const inFoundation = verticals.filter((line) => {
    const y = yOf(line);
    return y >= Math.min(band.area.y0, band.area.y1) - 0.01 && y <= Math.max(band.area.y0, band.area.y1) + 0.01;
  });
  assert.deepEqual(inFoundation.map(xOf), [], 'no cell line inside the foundation band');

  // In the other rows they stay: there the grid still helps with counting.
  assert.ok(verticals.length > 0, 'cell lines remain in the rows');
});

/*
 * Lines between cells never get counting emphasis (PQW-924).
 *
 * In PQW-923 the emphasis was removed only from the row in progress and kept
 * in the finished rows — but the owner still saw groups of five on the
 * exported image. The designer and the export run the same code, so both are
 * ruled out here, in one place.
 */
test('no vertical cell line carries an emphasised weight, in a row in progress or a finished one', () => {
  for (const rows of [2, 6, 11]) {
    const grid = gridOf(hdcRectangle({ rows }).pattern, 'rows');
    const vertical = gridPaths(grid).lines.filter((line) => /^M[-\d.]+ [-\d.]+V[-\d.]+$/.test(line.d));
    assert.ok(vertical.length > 0, `${rows} rows: cell lines are present`);
    assert.deepEqual(
      [...new Set(vertical.map((line) => line.weight))],
      ['cell'],
      `${rows} rows: the cell lines are uniformly thin`,
    );
    /*
     * The horizontal row lines keep their emphasis: those count rows, they do
     * not chop up stitches. It only shows where there are at least five rows.
     */
    if (rows >= 5) {
      const horizontal = gridPaths(grid).lines.filter((line) => !/^M[-\d.]+ [-\d.]+V[-\d.]+$/.test(line.d));
      assert.ok(
        horizontal.some((line) => line.weight === 'five' || line.weight === 'ten'),
        `${rows} rows: the row lines keep their emphasis`,
      );
    }
  }
});
