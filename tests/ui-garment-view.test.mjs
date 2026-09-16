/*
 * A „Ruhadarab” szakasz tartalma (PQW-866): választások, alapértékek, a
 * sorozat összhangja, a terv kiírása az ellenőrzésekkel, a táblázat gyanús
 * adatai és a létrehozás üzenete.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { emptyPattern } from '../src/core/editor.ts';
import { DEFAULT_GARMENT, DEFAULT_HAT, planGarment } from '../src/core/garments.ts';
import {
  KIND_CHOICES,
  TABLE_CHOICES,
  defaultsFor,
  easeLabel,
  easeNote,
  garmentFieldState,
  garmentView,
  generatedMessage,
  hemLabel,
  normalizeGarment,
  sizeChoices,
} from '../src/ui/garment-view.ts';

const plan = (options) => {
  const result = planGarment(emptyPattern(), options);
  assert.ok(result.ok, result.reason);
  return result.plan;
};

test('választható ruhadarabok, táblázatok és méretek', () => {
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

test('a mezők: a táblázat, a derék alatti hossz és az ismétlés csak pulóvernél; a feliratok a ruhadarabhoz', () => {
  // A bordázat a szegély és a mandzsetta sorain készül: a sapkának nincs ilyen sora (PQW-913).
  assert.deepEqual(garmentFieldState('hat'), { table: false, belowWaist: false, neckline: false, repeat: false, ribbing: false });
  assert.deepEqual(garmentFieldState('drop-shoulder'), { table: true, belowWaist: true, neckline: true, repeat: true, ribbing: true });
  assert.equal(garmentFieldState('raglan').ribbing, true);
  assert.equal(easeLabel('hat'), 'Bőség a fejkörfogathoz, cm');
  assert.equal(hemLabel('hat'), 'Perem, cm');
  assert.match(easeNote('hat'), /46 cm alatt −2,5 cm, fölötte −5 cm/);
  assert.match(easeNote('drop-shoulder'), /15–30 cm bőség a szokásos/);
});

test('alapértékek: a táblázat közepe a szomszédos méretekkel, a derék alatti hossz táblázatonként', () => {
  assert.deepEqual(defaultsFor('drop-shoulder', 'women'), DEFAULT_GARMENT);
  const men = defaultsFor('drop-shoulder', 'men');
  assert.deepEqual([men.from, men.size, men.to, men.belowWaistCm], ['S', 'M', 'L', 0]);
  const child = defaultsFor('drop-shoulder', 'child');
  assert.deepEqual([child.from, child.size, child.to], ['6', '8', '10']);
  assert.equal(defaultsFor('hat', 'women').size, 'adult-m');
});

test('a sorozat mindig tartalmazza a rajz méretét', () => {
  const normalized = normalizeGarment({ ...DEFAULT_GARMENT, from: 'L', to: 'XS' });
  assert.deepEqual([normalized.from, normalized.size, normalized.to], ['M', 'M', 'M']);
  assert.equal(normalizeGarment({ ...DEFAULT_HAT, repeat: { width: 4, edge: 2 } }).repeat, null);
});

test('pulóver kiírása: kész méret becsléssel, formázott nyak, minden ellenőrzés igaz, a sorozat szövege', () => {
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

test('a táblázat gyanús adata figyelmeztetés a méretnél', () => {
  const view = garmentView(plan({ ...DEFAULT_GARMENT, size: '2X', from: '2X', to: '3X' }), false);
  assert.ok(view.warnings.some((line) => /^A táblázat gyanús adata \(2X\): háthossz a derékig és keresztháti szélesség/.test(line)), view.warnings.join('\n'));
});

test('sapka kiírása és a létrehozás üzenete', () => {
  const series = plan(DEFAULT_HAT);
  const view = garmentView(series, false);
  assert.match(view.size, /^Felnőtt M: kész körméret ≈ \d+ cm, magasság ≈ \d+ cm; \d+ kör\.$/);
  assert.ok(view.details.some((line) => /^Korona: \d+ kör, körönként \d+ szaporítás/.test(line)));
  assert.equal(generatedMessage(series), 'Sapka, Felnőtt M méret (3 méretes sorozattal) elkészült; visszavonással a korábbi minta visszajön.');
});
