/*
 * The pixel chart (PQW-864): cell proportions derived from the gauge
 * (03 §5.1), the worked example of the proportional row count, resampling,
 * detecting, marking and expanding the repeat unit (owner clarification,
 * 2026-09-15), the mirroring warning, the carried colours, and the yarn needed
 * per colour.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import {
  cellCounts,
  cellSize,
  detectUnit,
  expandDraft,
  hasGaps,
  isMirrorSymmetric,
  mirrorRows,
  mirrorWarning,
  overCarriedRows,
  proportionalRows,
  resample,
  rowColors,
  unitConflicts,
  unitProblem,
  yarnByColor,
} from '../src/core/pixel-chart.ts';
import { estimate, measured } from '../src/core/quantity.ts';
import { GRID_CORE_TEXTS } from '../src/ui/i18n/core/grid.ts';
import { renderCoreText } from '../src/ui/i18n/core/render.ts';

/** The core hands over a code and data; the sentence is built in the UI dictionary (PQW-904). */
const hu = (message) => renderCoreText(GRID_CORE_TEXTS.hu, message);

/** A chart from text: rows run bottom to top, `#` filled (1), `.` open (0), `?` not given. */
const draft = (...lines) =>
  lines
    .slice()
    .reverse()
    .map((line) => [...line].map((ch) => (ch === '#' ? 1 : ch === '.' ? 0 : ch === '?' ? null : Number(ch))));

describe('cell proportions and the proportional row count (03 §5.1, §10 G31)', () => {
  test('in a single crochet chart a cell is one stitch; the worked example: at 16 sts × 18 rows/10 cm a square 32 cells wide needs 36 rows', () => {
    const stitch = { stitchCm: 10 / 16, rowCm: 10 / 18 };
    const cell = cellSize('tapestry', stitch);
    assert.equal(cell.widthCm, stitch.stitchCm);
    assert.equal(cell.heightCm, stitch.rowCm);
    assert.equal(proportionalRows(32, cell, 1, 1), 36);
  });

  test('a filet cell is 3 positions wide and one row tall, while the C2C tile is square', () => {
    const stitch = { stitchCm: 0.5, rowCm: 1.25 };
    assert.deepEqual(cellSize('filet', stitch), { widthCm: 1.5, heightCm: 1.25 });
    const tile = cellSize('c2c', stitch);
    assert.equal(tile.widthCm, tile.heightCm);
    assert.equal(proportionalRows(20, tile, 2, 1), 10);
  });

  test('resampling takes the nearest cell, keeping the row order and the edges', () => {
    const rows = draft('#.', '.#');
    assert.deepEqual(resample(rows, 4, 4), [
      [0, 0, 1, 1],
      [0, 0, 1, 1],
      [1, 1, 0, 0],
      [1, 1, 0, 0],
    ]);
    assert.deepEqual(resample(resample(rows, 4, 4), 2, 2), rows);
  });
});

describe('the repeat unit (owner clarification, 2026-09-15)', () => {
  test('the first rows drawn in full and the rest only as far as the repeat: a 2 × 2 unit is detected', () => {
    const rows = draft('#.??????', '.#??????', '#.#.#.#.', '.#.#.#.#');
    const result = detectUnit(rows);
    assert.ok(result.ok, JSON.stringify(result.reason));
    assert.deepEqual(result.unit, { x: 0, y: 0, width: 2, height: 2 });
    assert.ok(hasGaps(rows));
    const full = expandDraft(rows, result.unit, 8, 6);
    assert.equal(full.length, 6);
    assert.deepEqual(full[4], [0, 1, 0, 1, 0, 1, 0, 1]);
    assert.deepEqual(full[5], [1, 0, 1, 0, 1, 0, 1, 0]);
    assert.ok(full.every((row) => row.length === 8));
  });

  test('rows that repeat only horizontally: the unit is as tall as the rows that were given', () => {
    const rows = draft('##.##.', '#..#..', '.#..#.');
    const result = detectUnit(rows);
    assert.ok(result.ok, JSON.stringify(result.reason));
    assert.deepEqual(result.unit, { x: 0, y: 0, width: 3, height: 3 });
  });

  test('no repeat and an incomplete unit are both rejected with an understandable reason; the errors of a marked unit', () => {
    const none = detectUnit(draft('#..', '.##'));
    assert.equal(none.ok, false);
    assert.equal(none.reason.code, 'unit-not-found');
    assert.match(hu(none.reason), /Nem találtam ismétlődést/);
    assert.equal(detectUnit([]).ok, false);
    assert.equal(detectUnit([]).reason.code, 'unit-empty-grid');

    const rows = draft('?.??', '#.#.', '.#.#');
    // The core hands over the place of the missing cell; the article and the sentence belong to the dictionary (PQW-904).
    assert.deepEqual(unitProblem(rows, { x: 0, y: 0, width: 2, height: 3 }), {
      code: 'unit-incomplete',
      data: { width: 2, height: 3, row: 3, cell: 1 },
    });
    assert.equal(
      hu(unitProblem(rows, { x: 0, y: 0, width: 2, height: 3 })),
      'Az ismétlő egység (2 × 3 cella) nem teljes: add meg a 4. sor 1. celláját.',
    );
    assert.equal(unitProblem(rows, { x: 3, y: 0, width: 2, height: 1 }).code, 'unit-outside');
    assert.match(hu(unitProblem(rows, { x: 3, y: 0, width: 2, height: 1 })), /rácson belül/);
    assert.equal(unitProblem(rows, { x: 0, y: 0, width: 0, height: 1 }).code, 'unit-size');
    assert.match(hu(unitProblem(rows, { x: 0, y: 0, width: 0, height: 1 })), /pozitív egész/);
    assert.equal(unitProblem(rows, { x: 0, y: 0, width: 2, height: 2 }), null);
  });

  test('a marked unit with a border: the given cells that differ are kept, and they are counted', () => {
    const rows = draft('########', '#.#.#.#.', '########');
    const unit = { x: 0, y: 1, width: 2, height: 1 };
    assert.equal(unitProblem(rows, unit), null);
    assert.equal(unitConflicts(rows, unit), 8);
    const full = expandDraft(rows, unit, 10, 3);
    assert.deepEqual(full[1], [1, 0, 1, 0, 1, 0, 1, 0, 1, 0]);
    assert.deepEqual(full[0].slice(0, 8), Array(8).fill(1));
  });
});

describe('mirroring, colours and yarn', () => {
  test('in mirrored view it always warns for a lettered motif, and warns for an asymmetric one too', () => {
    const symmetric = draft('#.#', '.#.');
    const asymmetric = draft('##.', '#..');
    assert.ok(isMirrorSymmetric(symmetric));
    assert.equal(isMirrorSymmetric(asymmetric), false);
    assert.deepEqual(mirrorRows(asymmetric), draft('.##', '..#'));
    assert.equal(mirrorWarning(asymmetric, true, false), null);
    assert.deepEqual(mirrorWarning(symmetric, true, true), { code: 'mirror-lettering' });
    assert.deepEqual(mirrorWarning(asymmetric, false, true), { code: 'mirror-asymmetric' });
    assert.match(hu(mirrorWarning(symmetric, true, true)), /feliratos motívumban a betűk fordítva/);
    assert.match(hu(mirrorWarning(asymmetric, false, true)), /nem szimmetrikus/);
    assert.equal(mirrorWarning(symmetric, false, true), null);
  });

  test('in tapestry a row with more than 3 colours is warned about (03 §10 G36)', () => {
    const rows = [
      [0, 1, 2, 0],
      [0, 1, 2, 3],
    ];
    assert.deepEqual(rowColors(rows[1]), [0, 1, 2, 3]);
    assert.deepEqual(overCarriedRows(rows), [2]);
  });

  test('yarn per colour follows the share of cells; the no-cell marker is left out; in tapestry the carried strand leaves the range open upwards', () => {
    const rows = [
      [0, 0, 1, -1],
      [0, 1, 1, -1],
    ];
    assert.deepEqual([...cellCounts(rows)], [
      [0, 3],
      [1, 3],
    ]);
    const graphgan = yarnByColor(rows, 'graphgan', measured(100));
    assert.equal(graphgan.get(0).value, 50);
    assert.equal(graphgan.get(1).value, 50);
    const tapestry = yarnByColor(rows, 'tapestry', estimate(100, [90, 110]));
    assert.equal(tapestry.get(0).value, 50);
    assert.deepEqual(tapestry.get(0).range, [45, 68.75]);
    assert.equal(yarnByColor([[-1]], 'filet', measured(10)).size, 0);
  });
});
