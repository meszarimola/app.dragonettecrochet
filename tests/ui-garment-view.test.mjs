/*
 * The contents of the garment section (PQW-866): the choices, the defaults,
 * a consistent size series, the plan printed with its checks, suspicious
 * entries in the size table, and the message shown after generating.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { emptyPattern } from '../src/core/editor.ts';
import { DEFAULT_GARMENT, DEFAULT_HAT, planGarment } from '../src/core/garments.ts';
import {
  defaultsFor,
  easeLabel,
  easeNote,
  garmentFieldState,
  garmentView,
  generatedMessage,
  hemLabel,
  KIND_CHOICES,
  normalizeGarment,
  sizeChoices,
  TABLE_CHOICES,
} from '../src/ui/garment-view.ts';

const plan = (options) => {
  const result = planGarment(emptyPattern(), options);
  assert.ok(result.ok, result.reason);
  return result.plan;
};

test('the selectable garments, size tables and sizes', () => {
  assert.deepEqual(
    KIND_CHOICES.map((choice) => choice.label),
    ['Hat', 'Drop-shoulder sweater', 'Top-down raglan'],
  );
  assert.deepEqual(
    TABLE_CHOICES.map((choice) => choice.label),
    ['Women', 'Men', 'Child', 'Baby'],
  );
  assert.deepEqual(
    sizeChoices('drop-shoulder', 'baby').map((choice) => choice.label),
    ['3 mo', '6 mo', '12 mo', '18 mo', '24 mo'],
  );
  assert.equal(sizeChoices('hat', 'women')[8].label, 'Adult M');
});

test('fields: table, below-waist length and repeat appear only for a sweater, and the labels follow the garment', () => {
  // Ribbing is worked on the hem and cuff rows: a hat has no such rows (PQW-913).
  assert.deepEqual(garmentFieldState('hat'), {
    table: false,
    belowWaist: false,
    neckline: false,
    repeat: false,
    ribbing: false,
  });
  assert.deepEqual(garmentFieldState('drop-shoulder'), {
    table: true,
    belowWaist: true,
    neckline: true,
    repeat: true,
    ribbing: true,
  });
  assert.equal(garmentFieldState('raglan').ribbing, true);
  assert.equal(easeLabel('hat'), 'Ease at the head circumference, cm');
  assert.equal(hemLabel('hat'), 'Brim, cm');
  assert.match(easeNote('hat'), /−2\.5 cm below 46 cm, −5 cm above/);
  assert.match(easeNote('drop-shoulder'), /usually has 15–30 cm of ease/);
});

test('defaults: the middle of the table with its neighbouring sizes, and a per-table below-waist length', () => {
  assert.deepEqual(defaultsFor('drop-shoulder', 'women'), DEFAULT_GARMENT);
  const men = defaultsFor('drop-shoulder', 'men');
  assert.deepEqual([men.from, men.size, men.to, men.belowWaistCm], ['S', 'M', 'L', 0]);
  const child = defaultsFor('drop-shoulder', 'child');
  assert.deepEqual([child.from, child.size, child.to], ['6', '8', '10']);
  assert.equal(defaultsFor('hat', 'women').size, 'adult-m');
});

test('the size series always contains the charted size', () => {
  const normalized = normalizeGarment({ ...DEFAULT_GARMENT, from: 'L', to: 'XS' });
  assert.deepEqual([normalized.from, normalized.size, normalized.to], ['M', 'M', 'M']);
  assert.equal(normalizeGarment({ ...DEFAULT_HAT, repeat: { width: 4, edge: 2 } }).repeat, null);
});

test('sweater report: estimated finished size, shaped neckline, all checks true, and the series text', () => {
  const view = garmentView(plan(DEFAULT_GARMENT), false);
  assert.match(view.size, /^M: finished bust ≈ \d+ cm, length ≈ \d+ cm, sleeve length ≈ \d+ cm\.$/);
  assert.ok(
    view.details.some((line) => /^Shoulder: \d+ stitches at each edge; the neck is \d+ stitches\.$/.test(line)),
  );
  assert.ok(view.details.some((line) => /^Shaped neck: \d+ stitches stay at the centre front/.test(line)));
  assert.match(view.checks, /^Every check is true: (\d+)\/\1, 3 sizes\.$/);
  assert.deepEqual(view.failed, []);
  assert.equal(view.series[0], 'S (M, L)');
  assert.match(view.source, /^No profile: the size is an estimate/);
  assert.ok(view.details.some((line) => /For a yarn estimate, give/.test(line)));
});

test('a suspicious table entry raises a warning on that size', () => {
  const view = garmentView(plan({ ...DEFAULT_GARMENT, size: '2X', from: '2X', to: '3X' }), false);
  assert.ok(
    view.warnings.some((line) => /^Suspicious data in the table \(2X\): back waist length and cross back/.test(line)),
    view.warnings.join('\n'),
  );
});

test('hat report and the message shown after generating', () => {
  const series = plan(DEFAULT_HAT);
  const view = garmentView(series, false);
  assert.match(view.size, /^Adult M: finished circumference ≈ \d+ cm, height ≈ \d+ cm; \d+ rounds\.$/);
  assert.ok(view.details.some((line) => /^Crown: \d+ rounds, \d+ increases per round/.test(line)));
  assert.equal(
    generatedMessage(series),
    'Hat, size Adult M (with a 3 size range) done; undo brings the previous one back.',
  );
});
