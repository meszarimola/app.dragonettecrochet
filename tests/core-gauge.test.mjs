import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { buildGaugeProfiles } from '../src/core/gauge-profile.ts';
import {
  SC_WIDTH_PER_HOOK_MM,
  countForLength,
  gaugeDeviation,
  gaugeMatches,
  heightForRows,
  per10cm,
  rowHeightMm,
  rowsForHeight,
  scaleRowHeight,
  stitchDimensions,
  stitchHeightFactor,
  stitchWidthMm,
  stitchesForWidth,
  widthForStitches,
} from '../src/core/gauge.ts';
import { estimate, measured } from '../src/core/quantity.ts';
import { createStitchLibrary } from '../src/core/stitch-library.ts';
import { STITCHES, stitchById } from '../src/core/stitches.ts';
import { ROWS_EXAMPLE, exampleJson, exampleProfiles, samplesFrom } from './fixtures/calibration.ts';

const library = createStitchLibrary(STITCHES);
const INCH_4 = 10.16;

function near(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} ≠ ${expected} (±${epsilon})`);
}

function nearRange(actual, expected, epsilon = 1e-9) {
  assert.ok(actual, 'expected a range');
  near(actual[0], expected[0], epsilon);
  near(actual[1], expected[1], epsilon);
}

describe('gauge ↔ cm (02 §3.3, §8)', () => {
  test('140 stitches measure 35, 40 and 46.7 inches at 16, 14 and 12 st/4"', () => {
    for (const [stitches, inches] of [
      [16, 35],
      [14, 40],
      [12, 46.7],
    ]) {
      near(widthForStitches(140, { stitches, rows: 1, overCm: INCH_4 }) / 2.54, inches, 0.05);
    }
  });

  test('a 40" piece written for 15 dc/4" comes out around 43" when the gauge is 14', () => {
    const pattern = { stitches: 15, rows: 12, overCm: INCH_4 };
    const actual = { stitches: 14, rows: 12, overCm: INCH_4 };
    const stitches = stitchesForWidth(40 * 2.54, pattern);
    assert.equal(stitches, 150);
    near(widthForStitches(stitches, actual) / 2.54, 43, 0.2);
    near(gaugeDeviation(actual, pattern).stitches, -1 / 15);
    assert.equal(gaugeMatches(actual, pattern), false);
  });

  test('a 52" piece written for 13 st/4" lands nearer 48" when the gauge is 14', () => {
    const stitches = stitchesForWidth(52 * 2.54, { stitches: 13, rows: 1, overCm: INCH_4 });
    near(widthForStitches(stitches, { stitches: 14, rows: 1, overCm: INCH_4 }) / 2.54, 48, 0.5);
  });

  test('gauge matches within 5 %, and row gauge is left out of the match (02 §3.1)', () => {
    const target = { stitches: 20, rows: 24, overCm: 10 };
    assert.equal(gaugeMatches({ stitches: 19.2, rows: 30, overCm: 10 }, target), true);
    assert.equal(gaugeMatches({ stitches: 18.8, rows: 24, overCm: 10 }, target), false);
  });

  test('Red Heart label: 12 sc × 15 rows / 4" gives a stitch 8.47 mm wide and 6.77 mm tall, ratio 0.80 (02 §3.4)', () => {
    const gauge = { stitches: 12, rows: 15, overCm: INCH_4 };
    near(stitchWidthMm(gauge), 8.47, 0.01);
    near(rowHeightMm(gauge), 6.77, 0.01);
    near(rowHeightMm(gauge) / stitchWidthMm(gauge), 0.8, 1e-9);
    assert.equal(rowsForHeight(heightForRows(30, gauge), gauge), 30);
  });

  test('the width-per-hook estimate comes from the CYC fit: 101.6 mm / 72 ≈ 1.41 (02 §3.4)', () => {
    near(101.6 / 72, SC_WIDTH_PER_HOOK_MM.value, 0.01);
  });
});

describe('estimating without a measurement', () => {
  const context = { library, profile: null, hookMm: 4 };

  test('02 §4.2 worked example: a 4 mm hook and single crochet give 17.7 stitches and 22 rows / 10 cm, so 50 cm ≈ 89 stitches', () => {
    const sc = stitchDimensions(stitchById('sc'), 'row', context);
    assert.equal(sc.basis, 'hook');
    assert.equal(sc.widthMm.source, 'estimated');
    assert.equal(sc.heightMm.source, 'estimated');
    near(sc.widthMm.value, 5.64);
    nearRange(sc.widthMm.range, [4.8, 6.8]);
    near(per10cm(sc.widthMm).value, 17.7, 0.05);
    near(sc.heightMm.value, 4.512);
    near(per10cm(sc.heightMm).value, 22, 0.2);
    assert.equal(countForLength(500, sc.widthMm).value, 89);
    assert.equal(countForLength(500, sc.widthMm).source, 'estimated');
    nearRange(countForLength(500, sc.widthMm).range, [74, 104]);
  });

  test('02 §4.2 worked example: from a 12 sc × 15 row / 4" gauge, hdc gives 9.8, dc ≈ 7.4 (6–7.5) and tr 4.9 rows / 10 cm', () => {
    const scHeight = measured(rowHeightMm({ stitches: 12, rows: 15, overCm: INCH_4 }));
    const sc = stitchHeightFactor(stitchById('sc'));

    const hdc = scaleRowHeight(scHeight, sc, estimate(1.5, [1.3, 1.7]));
    near(hdc.value, 10.2, 0.05);
    near(per10cm(hdc).value, 9.8, 0.05);

    const dc = scaleRowHeight(scHeight, sc, estimate(2, [2, 2.5]));
    assert.equal(dc.source, 'estimated');
    near(dc.value, 13.5, 0.05);
    nearRange(dc.range, [13.5, 16.9], 0.05);
    near(per10cm(dc).value, 7.4, 0.05);
    nearRange(per10cm(dc).range, [6, 7.4], 0.1);

    const tr = scaleRowHeight(scHeight, sc, estimate(3, [2.7, 3.3]));
    near(tr.value, 20.3, 0.05);
    near(per10cm(tr).value, 4.9, 0.05);
  });

  test('every estimated height factor carries a range, and the dc range covers the knowledge base range', () => {
    for (const def of STITCHES.filter((stitch) => ['basic', 'joined', 'group', 'slip', 'chain'].includes(stitch.kind))) {
      const factor = stitchHeightFactor(def);
      assert.equal(factor.source, 'estimated', def.id);
      assert.ok(factor.range[0] <= factor.value && factor.value <= factor.range[1], def.id);
    }
    assert.deepEqual(stitchHeightFactor(stitchById('sc')).range, [1, 1]);
    const dc = stitchHeightFactor(stitchById('dc'));
    assert.ok(dc.range[0] <= 2 && dc.range[1] >= 2.5, `${dc.range}`);
  });

  test('a measured height factor comes back unchanged, with no range', () => {
    const def = { ...stitchById('dc'), heightFactor: { value: 2.3, source: 'measured' } };
    assert.deepEqual(stitchHeightFactor(def), { value: 2.3, source: 'measured', range: null });
  });

  test('without a profile every basic stitch is estimated with a range, and rounds use a different ratio than rows', () => {
    for (const id of ['sc', 'hdc', 'dc', 'tr', 'sl-st', 'ch', 'sc2tog']) {
      const def = library.get(id);
      if (!def) continue;
      for (const shape of ['row', 'round']) {
        const size = stitchDimensions(def, shape, context);
        assert.equal(size.basis, 'hook', `${id} ${shape}`);
        assert.equal(size.heightMm.source, 'estimated', `${id} ${shape}`);
        assert.ok(size.widthMm.range && size.heightMm.range, `${id} ${shape}`);
      }
    }
    const row = stitchDimensions(stitchById('sc'), 'row', context);
    const round = stitchDimensions(stitchById('sc'), 'round', context);
    assert.ok(round.heightMm.value > row.heightMm.value);
  });

  test('picot, chain space and magic ring have no size of their own', () => {
    for (const def of STITCHES.filter((stitch) => ['picot', 'space', 'ring'].includes(stitch.kind))) {
      assert.equal(stitchDimensions(def, 'row', context), null, def.id);
    }
  });
});

describe('stitch size from a gauge profile', () => {
  const { unblocked, blocked } = exampleProfiles();
  const withProfile = (profile) => ({ library, profile, hookMm: 99 });

  test('a measured stitch gives a measured value with no range, and rounds use the tube measurement', () => {
    const row = stitchDimensions(stitchById('sc'), 'row', withProfile(unblocked));
    assert.equal(row.basis, 'measured');
    assert.equal(row.widthMm.source, 'measured');
    assert.equal(row.widthMm.range, null);
    near(row.widthMm.value, 5.65);
    near(row.heightMm.value, 4.55);

    const round = stitchDimensions(stitchById('sc'), 'round', withProfile(unblocked));
    assert.equal(round.basis, 'measured');
    near(round.widthMm.value, 5.5);
    near(round.heightMm.value, 5);
  });

  test('a joined stitch takes the size of its part stitch', () => {
    const decrease = STITCHES.find((stitch) => stitch.kind === 'joined' && stitch.part === 'sc' && stitch.base === 'spread');
    assert.equal(stitchDimensions(decrease, 'row', withProfile(unblocked)).basis, 'measured');
  });

  test('an unmeasured stitch is estimated from the measured single crochet, and says so', () => {
    const dc = stitchDimensions(stitchById('dc'), 'row', withProfile(unblocked));
    assert.equal(dc.basis, 'profile-stitch');
    assert.equal(dc.heightMm.source, 'estimated');
    near(dc.heightMm.value, 4.55 * 2.6);
    nearRange(dc.heightMm.range, [4.55 * 2, 4.55 * 2.6]);
    nearRange(dc.widthMm.range, [5.65 * 0.9, 5.65 * 1.1]);
  });

  test('when only another stitch was measured, single crochet is derived back through its height factor', () => {
    const file = exampleJson(ROWS_EXAMPLE);
    file.stitch.id = 'dc';
    const [profile] = buildGaugeProfiles(samplesFrom(JSON.stringify(file))).filter((each) => !each.blocked);
    const sc = stitchDimensions(stitchById('sc'), 'row', withProfile(profile));
    assert.equal(sc.basis, 'profile-stitch');
    near(sc.heightMm.value, 4.55 / 2.6);
    nearRange(sc.heightMm.range, [4.55 / 2.6, 4.55 / 2]);
  });

  test('a stitch measured only in the other form is scaled by the form ratio', () => {
    const round = stitchDimensions(stitchById('sc'), 'round', withProfile(blocked));
    assert.equal(round.basis, 'profile-other-form');
    near(round.widthMm.value, 5.7);
    assert.equal(round.heightMm.source, 'estimated');
  });

  test('with a profile the hook comes from the profile, not from the context', () => {
    const profile = { ...unblocked, perStitch: {} };
    const size = stitchDimensions(stitchById('sc'), 'row', withProfile(profile));
    assert.equal(size.basis, 'hook');
    near(size.widthMm.value, 4 * 1.41);
  });

  test('chain length is measured when the profile has a chain-row measurement', () => {
    const estimated = stitchDimensions(stitchById('ch'), 'row', withProfile(unblocked));
    assert.equal(estimated.widthMm.source, 'estimated');
    const profile = { ...unblocked, chainLengthMm: { mean: 5.2, sd: 0.1, n: 3 } };
    assert.deepEqual(stitchDimensions(stitchById('ch'), 'row', withProfile(profile)).widthMm, {
      value: 5.2,
      source: 'measured',
      range: null,
    });
  });
});
