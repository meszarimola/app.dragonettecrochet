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
    ['Sapka', 'Ledobott vállú pulóver', 'Felülről horgolt raglán'],
  );
  assert.deepEqual(
    TABLE_CHOICES.map((choice) => choice.label),
    ['Női', 'Férfi', 'Gyerek', 'Baba'],
  );
  assert.deepEqual(
    sizeChoices('drop-shoulder', 'baby').map((choice) => choice.label),
    ['3 hó', '6 hó', '12 hó', '18 hó', '24 hó'],
  );
  assert.equal(sizeChoices('hat', 'women')[8].label, 'Felnőtt M');
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
  assert.equal(easeLabel('hat'), 'Bőség a fejkörfogathoz, cm');
  assert.equal(hemLabel('hat'), 'Perem, cm');
  assert.match(easeNote('hat'), /46 cm alatt −2,5 cm, fölötte −5 cm/);
  assert.match(easeNote('drop-shoulder'), /15–30 cm bőség a szokásos/);
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
  assert.match(view.size, /^M: kész mellbőség ≈ \d+ cm, hossz ≈ \d+ cm, ujjhossz ≈ \d+ cm\.$/);
  assert.ok(view.details.some((line) => /^Váll: szélenként \d+ szem; a nyak \d+ szem\.$/.test(line)));
  assert.ok(view.details.some((line) => /^Formázott nyak: elöl középen \d+ szem marad/.test(line)));
  assert.match(view.checks, /^Minden ellenőrzés igaz: (\d+)\/\1, 3 méret\.$/);
  assert.deepEqual(view.failed, []);
  assert.equal(view.series[0], 'S (M, L)');
  assert.match(view.source, /^Nincs profil: a méret becslés/);
  assert.ok(view.details.some((line) => /Fonalbecsléshez add meg/.test(line)));
});

test('a suspicious table entry raises a warning on that size', () => {
  const view = garmentView(plan({ ...DEFAULT_GARMENT, size: '2X', from: '2X', to: '3X' }), false);
  assert.ok(
    view.warnings.some((line) =>
      /^A táblázat gyanús adata \(2X\): háthossz a derékig és keresztháti szélesség/.test(line),
    ),
    view.warnings.join('\n'),
  );
});

test('hat report and the message shown after generating', () => {
  const series = plan(DEFAULT_HAT);
  const view = garmentView(series, false);
  assert.match(view.size, /^Felnőtt M: kész körméret ≈ \d+ cm, magasság ≈ \d+ cm; \d+ kör\.$/);
  assert.ok(view.details.some((line) => /^Korona: \d+ kör, körönként \d+ szaporítás/.test(line)));
  assert.equal(
    generatedMessage(series),
    'Sapka, Felnőtt M méret (3 méretes sorozattal) elkészült; visszavonással a korábbi minta visszajön.',
  );
});
