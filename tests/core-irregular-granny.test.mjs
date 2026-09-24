/*
 * The granny square's grid (PQW-1040, PQW-1043). The designer gives the grid and
 * the crocheter fills it: every round is a band one step deep, cut into as many
 * cells as the round's grid count, and a stitch goes into the cell nearest where
 * it was dropped.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { emptyIrregularPattern } from '../src/core/irregular-document.ts';
import {
  clampGrannyCount,
  grannyBands,
  grannyCells,
  grannyRings,
  nearestGrannyCell,
  squareStop,
} from '../src/core/irregular-granny.ts';
import { loadIrregular, saveIrregular } from '../src/core/irregular-json.ts';
import { GRANNY_COUNT_RANGE } from '../src/core/irregular-types.ts';

const near = (actual, expected, message, slack = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= slack, `${message}: ${actual} vs ${expected}`);

const STEP = 40;

/** A granny square whose rounds hold the given grid counts. */
function granny(...cells) {
  const base = emptyIrregularPattern({ title: 'Nagymama-négyzet', layerNames: ['Réteg'] });
  return {
    ...base,
    motif: 'granny-square',
    rows: cells.map((count, index) => ({
      id: `r${index + 1}`,
      kind: 'round',
      direction: 'cw',
      color: null,
      visible: true,
      locked: false,
      cells: count,
    })),
    activeRowId: 'r1',
  };
}

describe('squareStop', () => {
  test('the corners face diagonally out, the middle of a side straight out', () => {
    const half = 10;
    assert.deepEqual(squareStop(half, 0), { at: { x: -10, y: -10 }, angle: 315 });
    assert.deepEqual(squareStop(half, 10), { at: { x: 0, y: -10 }, angle: 0 });
    assert.deepEqual(squareStop(half, 20), { at: { x: 10, y: -10 }, angle: 45 });
    assert.deepEqual(squareStop(half, 30), { at: { x: 10, y: 0 }, angle: 90 });
    assert.deepEqual(squareStop(half, 50), { at: { x: 0, y: 10 }, angle: 180 });
    assert.deepEqual(squareStop(half, 70), { at: { x: -10, y: 0 }, angle: 270 });
  });
});

describe('the rounds of the grid', () => {
  test('every round is one step deep, whatever is in it', () => {
    assert.deepEqual(grannyRings(granny(8, 16, 24), STEP), [
      { rowId: 'r1', round: 1, cells: 8, inner: 0, outer: 40 },
      { rowId: 'r2', round: 2, cells: 16, inner: 40, outer: 80 },
      { rowId: 'r3', round: 3, cells: 24, inner: 80, outer: 120 },
    ]);
  });

  test('a row without a grid count is not a round of the square', () => {
    const pattern = granny(8);
    const withPlainRow = {
      ...pattern,
      rows: [...pattern.rows, { id: 'r9', kind: 'row', direction: 'ltr', color: null, visible: true, locked: false }],
    };
    assert.equal(grannyRings(withPlainRow, STEP).length, 1);
  });

  test('a pattern that is not a granny square has no rounds', () => {
    const { motif: _gone, ...plain } = granny(8);
    assert.deepEqual(grannyRings(plain, STEP), []);
  });

  test('the grid count stays within its range', () => {
    assert.equal(clampGrannyCount(0), GRANNY_COUNT_RANGE.min);
    assert.equal(clampGrannyCount(10_000), GRANNY_COUNT_RANGE.max);
    assert.equal(clampGrannyCount(Number.NaN), GRANNY_COUNT_RANGE.min);
  });
});

describe('the cells of a round', () => {
  test('as many cells as the count asks for, the first on the top-left corner', () => {
    const [ring] = grannyRings(granny(8), STEP);
    const cells = grannyCells(ring);
    assert.equal(cells.length, 8);
    assert.deepEqual(cells[0].at, { x: -20, y: -20 });
    assert.deepEqual(
      cells.map((cell) => cell.angle),
      [315, 0, 45, 90, 135, 180, 225, 270],
    );
    assert.ok(cells.every((cell) => cell.rowId === 'r1'));
  });

  test('the cells sit on the middle square of the band', () => {
    const [, ring] = grannyRings(granny(8, 16), STEP);
    const cells = grannyCells(ring);
    near(cells[0].at.x, -60, 'the second round runs between 40 and 80');
    assert.equal(cells.length, 16);
  });

  test('a stitch goes into the cell nearest where it was dropped, round and all', () => {
    const pattern = granny(8, 16);
    const middleOfTop = nearestGrannyCell(pattern, STEP, { x: 2, y: -19 });
    assert.equal(middleOfTop.rowId, 'r1');
    assert.equal(middleOfTop.angle, 0);
    const outer = nearestGrannyCell(pattern, STEP, { x: 0, y: -62 });
    assert.equal(outer.rowId, 'r2');
    assert.equal(nearestGrannyCell(granny(), STEP, { x: 0, y: 0 }), undefined);
  });
});

describe('the background bands', () => {
  test('one cell per round, and the first band reaches the middle', () => {
    const [first, second] = grannyBands(granny(8, 16), STEP);
    assert.equal(first.inner, null);
    assert.equal(first.tone, 0);
    assert.equal(first.dividers.length, 8);
    assert.deepEqual(first.outer[0], { x: -40, y: -40 });
    assert.equal(second.tone, 1);
    assert.deepEqual(second.inner[0], { x: -40, y: -40 });
    assert.deepEqual(second.outer[0], { x: -80, y: -80 });
    assert.equal(second.dividers.length, 16);
  });

  test('a divider stands between two cells', () => {
    const [, band] = grannyBands(granny(8, 8), STEP);
    const [from, to] = band.dividers[0];
    near(from.x, -20, 'inner end, half a cell along the top side');
    near(from.y, -40, 'inner end on the inner square');
    near(to.x, -40, 'outer end');
    near(to.y, -80, 'outer end on the outer square');
  });
});

describe('the file', () => {
  test('a granny square keeps its rounds and the way its stitches face', () => {
    const pattern = { ...granny(8, 16), grannyRadial: false };
    const loaded = loadIrregular(saveIrregular(pattern));
    assert.ok(loaded.ok);
    assert.equal(loaded.pattern.motif, 'granny-square');
    assert.equal(loaded.pattern.grannyRadial, false);
    assert.deepEqual(grannyRings(loaded.pattern, STEP), grannyRings(pattern, STEP));
  });

  test('a grid count outside the range is refused', () => {
    const raw = JSON.parse(saveIrregular(granny(8)));
    raw.rows[0].cells = 0;
    assert.equal(loadIrregular(JSON.stringify(raw)).ok, false);
  });
});
