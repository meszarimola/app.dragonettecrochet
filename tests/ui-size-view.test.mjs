/*
 * Copy in the „Méret és fonal” section (PQW-859): values with their origin,
 * estimates with a range, a clear notice when there is no profile, hook size
 * conversion, and yarn rounded up to whole balls.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { contextOf, emptyPattern } from '../src/core/editor.ts';
import { newProfile, patternSize, withProfile } from '../src/core/pattern-size.ts';
import { estimate, measured } from '../src/core/quantity.ts';
import {
  cmText,
  formatNumber,
  gaugeEntryNote,
  hookSizesText,
  profileLabel,
  profileOrigins,
  quantityText,
  sizeView,
  valueLine,
} from '../src/ui/size-view.ts';
import { hdcRectangle } from './fixtures/examples.ts';

const entry = (stitch, form, stitchesPer10cm, rowsPer10cm, source = 'measured') => ({ stitch, form, stitchesPer10cm, rowsPer10cm, source });

function viewOf(pattern) {
  const context = contextOf(pattern);
  return sizeView(patternSize(pattern, context.graph, context.library));
}

function withGauge(pattern, overrides) {
  return withProfile(pattern, {
    ...newProfile(pattern),
    yarn: { name: 'Pamut', cycWeight: null, metersPer100g: 200, ballMassG: 50 },
    ...overrides,
  });
}

test('hook sizes list the US and old UK size next to the mm, and name the nearest one when it is non-standard', () => {
  assert.equal(hookSizesText(4), 'US G-6 · régi UK 8');
  assert.equal(hookSizesText(2), 'régi UK 14');
  assert.equal(hookSizesText(12), 'Nincs amerikai és régi brit megfelelője.');
  assert.equal(hookSizesText(4.2), 'Nem szabványos méret; a legközelebbi 4,25 mm (US G).');
  assert.match(hookSizesText(1.5), /^Acéltű/);
});

test('values carry their origin and a Hungarian decimal comma; an estimate gets a ≈ sign and a range', () => {
  assert.deepEqual(cmText(measured(8.47457)), { value: '8,5 cm', source: 'measured', range: null });
  const estimated = cmText(estimate(8.46, [6.48, 11.22]));
  assert.deepEqual(estimated, { value: '≈ 8,5 cm', source: 'estimated', range: '6,5–11,2 cm' });
  assert.equal(valueLine(estimated), '≈ 8,5 cm (becsült: 6,5–11,2 cm)');
  assert.equal(cmText(measured(0.456)).value, '0,46 cm');
  // When the two bounds round to the same number, no separate range is shown.
  assert.equal(quantityText(estimate(1, [1, 1.2]), 'db', 0).range, null);
  assert.equal(formatNumber(1804.4, 0), '1804');
});

test('without a profile the section says the size is an estimate and shows a range on every value', () => {
  const view = viewOf(hdcRectangle().pattern);
  assert.equal(
    view.notice,
    'Nincs profil: a méret becslés 4 mm-es tűből, tartománnyal. Pontosabb lesz, ha próbadarabot mérsz, és profilként megadod.',
  );
  assert.deepEqual(
    view.total.map((row) => row.label),
    ['Szélesség', 'Magasság'],
  );
  for (const row of view.total) {
    assert.equal(row.text.source, 'estimated');
    assert.ok(row.text.range);
  }
  assert.deepEqual(view.headers, ['Sor', 'Szélesség, cm', 'Magasság, cm', 'Eddig, cm']);
  assert.equal(view.layers[0].label, '2. sor');
  assert.equal(view.layers[0].source, 'estimated');
  // The width may come out a whole number: the row has 15 stitches (PQW-924).
  assert.match(view.layers[0].width, /^≈ \d+(,\d)?$/);
  assert.deepEqual(view.yarn, []);
  assert.equal(view.yarnNote, 'A fonalbecsléshez hiányzik: egy profil a próbadarab tömegével.');
});

test('a measured profile drops the notice and rounds the yarn up to whole balls', () => {
  const { pattern } = hdcRectangle();
  const view = viewOf(
    withGauge(pattern, { gauges: [entry('hdc', 'rows', 17.7, 15)], swatch: { widthCm: 15, heightCm: 15, massG: 14.2 } }),
  );
  assert.equal(view.notice, null);
  assert.deepEqual(
    view.total.map((row) => [row.label, row.text.value, row.text.source]),
    [
      ['Szélesség', '8,5 cm', 'measured'],
      ['Magasság', '14,7 cm', 'measured'],
    ],
  );
  assert.deepEqual(
    view.yarn.map((row) => row.label),
    ['Fonal a darabban', 'Hossz tartalékkal', 'Gombolyag'],
  );
  assert.equal(view.yarn[2].text.value, '≈ 1 db');
  assert.match(view.yarnNote, /^Egy gombolyag 50 g, 100 m\./);
});

test('a partly measured profile spells out which part of the size is estimated', () => {
  const view = viewOf(withGauge(hdcRectangle().pattern, { gauges: [entry('sc', 'rows', 20, 25)] }));
  assert.equal(view.notice, 'A méret egy része becslés (a nem mért szemek más mért szemből átszámolva), tartománnyal.');
});

test('profile fields report their origin: from the label, measured, or a weight estimated from m/100 g', () => {
  const profile = { ...newProfile(emptyPattern()), yarn: { name: '', cycWeight: null, metersPer100g: 200, ballMassG: null } };
  const origins = profileOrigins(profile);
  assert.deepEqual(origins.cycWeight, { text: 'becsült a m/100 g-ből: 4 – Medium', source: 'estimated' });
  assert.deepEqual(origins.metersPer100g, { text: 'címkéről', source: 'label' });
  assert.equal(origins.ballMassG, null);
  assert.deepEqual(origins.hookMm, { text: 'mért', source: 'measured' });
  assert.equal(origins.swatch, null);
  assert.deepEqual(profileOrigins({ ...profile, yarn: { ...profile.yarn, cycWeight: 3 } }).cycWeight, { text: 'címkéről', source: 'label' });
  assert.equal(profileLabel(profile), 'Névtelen fonal · 4 mm · blokkolás nélkül');
});

test('an incomplete gauge row shows the estimate while a complete one shows nothing', () => {
  const partial = entry('sc', 'rounds', 18, null);
  assert.equal(
    gaugeEntryNote(partial, { stitchesPer10cm: 17.7, rowsPer10cm: 17.7 }),
    'Hiányos, a méretbe még nem számít. Becslés ehhez a profilhoz: 17,7 szem és 17,7 kör 10 cm-en.',
  );
  assert.equal(gaugeEntryNote({ ...partial, rowsPer10cm: 18 }, { stitchesPer10cm: 17.7, rowsPer10cm: 17.7 }), '');
});
