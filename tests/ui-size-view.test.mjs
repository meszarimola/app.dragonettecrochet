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
import { setUiLanguage } from '../src/ui/i18n.ts';
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

/** Runs `run` with the interface in `language`, then restores the default. KB: interface.md §4 */
function inLanguage(language, run) {
  try {
    setUiLanguage(language);
    return run();
  } finally {
    setUiLanguage('en');
  }
}

const entry = (stitch, form, stitchesPer10cm, rowsPer10cm, source = 'measured') => ({
  stitch,
  form,
  stitchesPer10cm,
  rowsPer10cm,
  source,
});

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
  assert.equal(hookSizesText(4), 'US G-6 · old UK 8');
  assert.equal(hookSizesText(2), 'old UK 14');
  assert.equal(hookSizesText(12), 'No US or old UK equivalent.');
  assert.equal(hookSizesText(4.2), 'Not a standard size; the nearest is 4.25 mm (US G).');
  assert.match(hookSizesText(1.5), /^Steel hook/);
  assert.equal(
    inLanguage('hu', () => hookSizesText(4.2)),
    'Nem szabványos méret; a legközelebbi 4,25 mm (US G).',
  );
});

test('values carry their origin; an estimate gets a ≈ sign and a range, with the decimal mark of the language', () => {
  assert.deepEqual(cmText(measured(8.47457)), { value: '8.5 cm', source: 'measured', range: null });
  const estimated = cmText(estimate(8.46, [6.48, 11.22]));
  assert.deepEqual(estimated, { value: '≈ 8.5 cm', source: 'estimated', range: '6.5–11.2 cm' });
  assert.equal(valueLine(estimated), '≈ 8.5 cm (estimated: 6.5–11.2 cm)');
  assert.equal(cmText(measured(0.456)).value, '0.46 cm');
  assert.equal(
    inLanguage('hu', () => valueLine(cmText(estimate(8.46, [6.48, 11.22])))),
    '≈ 8,5 cm (becsült: 6,5–11,2 cm)',
  );
  // When the two bounds round to the same number, no separate range is shown.
  assert.equal(quantityText(estimate(1, [1, 1.2]), 'db', 0).range, null);
  assert.equal(formatNumber(1804.4, 0), '1804');
});

test('without a profile the section says the size is an estimate and shows a range on every value', () => {
  const view = viewOf(hdcRectangle().pattern);
  assert.equal(
    view.notice,
    'No profile: the size is estimated from a 4 mm hook, with a range. It gets more accurate once you measure a swatch and save it as a profile.',
  );
  assert.deepEqual(
    view.total.map((row) => row.label),
    ['Width', 'Height'],
  );
  for (const row of view.total) {
    assert.equal(row.text.source, 'estimated');
    assert.ok(row.text.range);
  }
  assert.deepEqual(view.headers, ['Row', 'Width, cm', 'Height, cm', 'Total, cm']);
  assert.equal(view.layers[0].label, 'Row 2');
  assert.equal(view.layers[0].source, 'estimated');
  // The width may come out a whole number: the row has 15 stitches (PQW-924).
  assert.match(view.layers[0].width, /^≈ \d+(\.\d)?$/);
  assert.deepEqual(view.yarn, []);
  assert.equal(view.yarnNote, 'The yarn estimate is missing: a profile with the mass of the swatch.');
});

test('a measured profile drops the notice and rounds the yarn up to whole balls', () => {
  const { pattern } = hdcRectangle();
  const view = viewOf(
    withGauge(pattern, {
      gauges: [entry('hdc', 'rows', 17.7, 15)],
      swatch: { widthCm: 15, heightCm: 15, massG: 14.2 },
    }),
  );
  assert.equal(view.notice, null);
  assert.deepEqual(
    view.total.map((row) => [row.label, row.text.value, row.text.source]),
    [
      ['Width', '8.5 cm', 'measured'],
      ['Height', '14.7 cm', 'measured'],
    ],
  );
  assert.deepEqual(
    view.yarn.map((row) => row.label),
    ['Yarn in the piece', 'Length with extra', 'Balls'],
  );
  assert.equal(view.yarn[2].text.value, '≈ 1 ball', 'the English unit agrees with the number (PQW-1100)');
  assert.match(view.yarnNote, /^One ball is 50 g, 100 m\./);
});

test('a partly measured profile spells out which part of the size is estimated', () => {
  const view = viewOf(withGauge(hdcRectangle().pattern, { gauges: [entry('sc', 'rows', 20, 25)] }));
  assert.equal(
    view.notice,
    'Part of the size is an estimate (the stitches that were not measured converted from another measured stitch), with a range.',
  );
});

test('profile fields report their origin: from the label, measured, or a weight estimated from m/100 g', () => {
  const profile = {
    ...newProfile(emptyPattern()),
    yarn: { name: '', cycWeight: null, metersPer100g: 200, ballMassG: null },
  };
  const origins = profileOrigins(profile);
  assert.deepEqual(origins.cycWeight, { text: 'estimated from m/100 g: 4 – Medium', source: 'estimated' });
  assert.deepEqual(origins.metersPer100g, { text: 'from the label', source: 'label' });
  assert.equal(origins.ballMassG, null);
  assert.deepEqual(origins.hookMm, { text: 'measured', source: 'measured' });
  assert.equal(origins.swatch, null);
  assert.deepEqual(profileOrigins({ ...profile, yarn: { ...profile.yarn, cycWeight: 3 } }).cycWeight, {
    text: 'from the label',
    source: 'label',
  });
  assert.equal(profileLabel(profile), 'Unnamed yarn · 4 mm · unblocked');
});

test('an incomplete gauge row shows the estimate while a complete one shows nothing', () => {
  const partial = entry('sc', 'rounds', 18, null);
  assert.equal(
    gaugeEntryNote(partial, { stitchesPer10cm: 17.7, rowsPer10cm: 17.7 }),
    'Incomplete, not counted in the size yet. Estimate for this profile: 17.7 stitches and 17.7 rounds per 10 cm.',
  );
  assert.equal(gaugeEntryNote({ ...partial, rowsPer10cm: 18 }, { stitchesPer10cm: 17.7, rowsPer10cm: 17.7 }), '');
});
