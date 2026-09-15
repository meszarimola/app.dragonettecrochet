/*
 * A rács rajza útvonalakként (PQW-874): a vászon és az SVG-export ugyanezt
 * rajzolja.
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

test('sorrács: sávonként egy kitöltés, a vonalak gyengébbtől az erősebbig, szám hiba nélkül', () => {
  const grid = gridOf(hdcRectangle({ rows: 11 }).pattern, 'rows');
  const paths = gridPaths(grid);
  assert.equal(paths.bands.length, grid.bands.length);
  assert.deepEqual(paths.bands.slice(0, 3).map((band) => band.tone), [0, 1, 0]);
  const text = JSON.stringify(paths);
  assert.doesNotMatch(text, /NaN|undefined|Infinity/);
  const order = ['cell', 'row', 'five', 'ten'];
  const weights = paths.lines.map((line) => order.indexOf(line.weight));
  assert.ok(weights.every((w, i) => i === 0 || w >= weights[i - 1]), 'a hangsúlyos vonal a végén rajzolódik');
  for (const weight of order) assert.ok(paths.lines.some((line) => line.weight === weight), weight);
  // A készülő, még üres sor vonalai szaggatottak.
  assert.ok(paths.lines.some((line) => line.dashed));
  assert.ok(LINE_WIDTH.ten > LINE_WIDTH.five && LINE_WIDTH.five > LINE_WIDTH.row);
});

test('koncentrikus rács: körívek és evenodd kitöltésű körgyűrűk', () => {
  const paths = gridPaths(gridOf(grannySquare().pattern, 'rounds'));
  assert.equal(paths.bands[0].evenOdd, false, 'a varázskör teli kör');
  assert.ok(paths.bands.slice(1).every((band) => band.evenOdd && /A/.test(band.d)));
  assert.ok(paths.lines.some((line) => /L/.test(line.d)), 'sugárirányú cellahatár');
  assert.doesNotMatch(JSON.stringify(paths), /NaN|undefined|Infinity/);
});

test('sokszög-rács (PQW-888): egyenes oldalú gyűrűk, körív nélkül', () => {
  const { pattern } = generateMotif(emptyPattern(), { ...DEFAULT_MOTIF, shape: 'hexagon', rounds: 3 });
  const paths = gridPaths(gridOf(pattern, 'rounds'));
  const corners = (d) => (d.match(/[ML]/g) ?? []).length;
  assert.ok(paths.bands.every((band) => !/A/.test(band.d)), 'nincs körív');
  assert.equal(corners(paths.bands[0].d), 6, 'a középső sáv teli hatszög');
  assert.ok(paths.bands.slice(1).every((band) => band.evenOdd && corners(band.d) === 12), 'a gyűrű két hatszög');
  assert.doesNotMatch(JSON.stringify(paths), /NaN|undefined|Infinity/);
});
