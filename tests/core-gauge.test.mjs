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
  assert.ok(actual, 'tartományt vártunk');
  near(actual[0], expected[0], epsilon);
  near(actual[1], expected[1], epsilon);
}

describe('gauge ↔ cm (02 §3.3, §8)', () => {
  test('140 öltés 16, 14 és 12 öltés/4" gauge-dzsel 35, 40 és 46,7 hüvelyk', () => {
    for (const [stitches, inches] of [
      [16, 35],
      [14, 40],
      [12, 46.7],
    ]) {
      near(widthForStitches(140, { stitches, rows: 1, overCm: INCH_4 }) / 2.54, inches, 0.05);
    }
  });

  test('15 erp/4" mintához 14-es gauge-dzsel a 40"-os darabból kb. 43" lesz', () => {
    const pattern = { stitches: 15, rows: 12, overCm: INCH_4 };
    const actual = { stitches: 14, rows: 12, overCm: INCH_4 };
    const stitches = stitchesForWidth(40 * 2.54, pattern);
    assert.equal(stitches, 150);
    near(widthForStitches(stitches, actual) / 2.54, 43, 0.2);
    near(gaugeDeviation(actual, pattern).stitches, -1 / 15);
    assert.equal(gaugeMatches(actual, pattern), false);
  });

  test('13 öltés/4" mintához 14-es gauge-dzsel az 52"-os darab közelebb van a 48"-hoz', () => {
    const stitches = stitchesForWidth(52 * 2.54, { stitches: 13, rows: 1, overCm: INCH_4 });
    near(widthForStitches(stitches, { stitches: 14, rows: 1, overCm: INCH_4 }) / 2.54, 48, 0.5);
  });

  test('a gauge 5 %-on belül egyezik, a sor-gauge nem számít bele (02 §3.1)', () => {
    const target = { stitches: 20, rows: 24, overCm: 10 };
    assert.equal(gaugeMatches({ stitches: 19.2, rows: 30, overCm: 10 }, target), true);
    assert.equal(gaugeMatches({ stitches: 18.8, rows: 24, overCm: 10 }, target), false);
  });

  test('Red Heart címke: 12 rp × 15 sor / 4" → 8,47 mm széles, 6,77 mm magas, arány 0,80 (02 §3.4)', () => {
    const gauge = { stitches: 12, rows: 15, overCm: INCH_4 };
    near(stitchWidthMm(gauge), 8.47, 0.01);
    near(rowHeightMm(gauge), 6.77, 0.01);
    near(rowHeightMm(gauge) / stitchWidthMm(gauge), 0.8, 1e-9);
    assert.equal(rowsForHeight(heightForRows(30, gauge), gauge), 30);
  });

  test('a tűből becsült szélességarány a CYC-illesztésből jön: 101,6 mm / 72 ≈ 1,41 (02 §3.4)', () => {
    near(101.6 / 72, SC_WIDTH_PER_HOOK_MM.value, 0.01);
  });
});

describe('becslés mérés nélkül', () => {
  const context = { library, profile: null, hookMm: 4 };

  test('02 §4.2 kidolgozott példa: 4 mm-es tű, rövidpálca → 17,7 öltés és 22 sor / 10 cm, 50 cm ≈ 89 öltés', () => {
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

  test('02 §4.2 kidolgozott példa: 12 rp × 15 sor / 4" gauge-ből félpálca 9,8, pálca ≈ 7,4 (6–7,5), kétráhajtásos 4,9 sor / 10 cm', () => {
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

  test('a könyvtár becsült magasságaránya tartománnyal jön, és a tartomány lefedi a tudásbázis pálca-tartományát', () => {
    for (const def of STITCHES.filter((stitch) => ['basic', 'joined', 'group', 'slip', 'chain'].includes(stitch.kind))) {
      const factor = stitchHeightFactor(def);
      assert.equal(factor.source, 'estimated', def.id);
      assert.ok(factor.range[0] <= factor.value && factor.value <= factor.range[1], def.id);
    }
    assert.deepEqual(stitchHeightFactor(stitchById('sc')).range, [1, 1]);
    const dc = stitchHeightFactor(stitchById('dc'));
    assert.ok(dc.range[0] <= 2 && dc.range[1] >= 2.5, `${dc.range}`);
  });

  test('mért magasságarányt változatlanul ad, tartomány nélkül', () => {
    const def = { ...stitchById('dc'), heightFactor: { value: 2.3, source: 'measured' } };
    assert.deepEqual(stitchHeightFactor(def), { value: 2.3, source: 'measured', range: null });
  });

  test('profil nélkül minden alapöltés becsült, tartománnyal; körben az arány más, mint síkban', () => {
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

  test('a pikónak, a láncívnek és a varázskörnek nincs saját mérete', () => {
    for (const def of STITCHES.filter((stitch) => ['picot', 'space', 'ring'].includes(stitch.kind))) {
      assert.equal(stitchDimensions(def, 'row', context), null, def.id);
    }
  });
});

describe('méret a gauge-profilból', () => {
  const { unblocked, blocked } = exampleProfiles();
  const withProfile = (profile) => ({ library, profile, hookMm: 99 });

  test('a mért öltés mért értéket ad, tartomány nélkül; körben a cső mérése számít', () => {
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

  test('az összehorgolt öltést a részöltése méri', () => {
    const decrease = STITCHES.find((stitch) => stitch.kind === 'joined' && stitch.part === 'sc' && stitch.base === 'spread');
    assert.equal(stitchDimensions(decrease, 'row', withProfile(unblocked)).basis, 'measured');
  });

  test('a nem mért öltés a mért rövidpálcából becsül, és ezt jelöli', () => {
    const dc = stitchDimensions(stitchById('dc'), 'row', withProfile(unblocked));
    assert.equal(dc.basis, 'profile-stitch');
    assert.equal(dc.heightMm.source, 'estimated');
    near(dc.heightMm.value, 4.55 * 2.6);
    nearRange(dc.heightMm.range, [4.55 * 2, 4.55 * 2.6]);
    nearRange(dc.widthMm.range, [5.65 * 0.9, 5.65 * 1.1]);
  });

  test('ha csak más öltés van mérve, a rövidpálcát a magasságarányával számolja vissza', () => {
    const file = exampleJson(ROWS_EXAMPLE);
    file.stitch.id = 'dc';
    const [profile] = buildGaugeProfiles(samplesFrom(JSON.stringify(file))).filter((each) => !each.blocked);
    const sc = stitchDimensions(stitchById('sc'), 'row', withProfile(profile));
    assert.equal(sc.basis, 'profile-stitch');
    near(sc.heightMm.value, 4.55 / 2.6);
    nearRange(sc.heightMm.range, [4.55 / 2.6, 4.55 / 2]);
  });

  test('a másik formában mért rövidpálca szélességéből becsül, a forma arányával', () => {
    const round = stitchDimensions(stitchById('sc'), 'round', withProfile(blocked));
    assert.equal(round.basis, 'profile-other-form');
    near(round.widthMm.value, 5.7);
    assert.equal(round.heightMm.source, 'estimated');
  });

  test('profil mellett a tű a profilé, nem a megadott', () => {
    const profile = { ...unblocked, perStitch: {} };
    const size = stitchDimensions(stitchById('sc'), 'row', withProfile(profile));
    assert.equal(size.basis, 'hook');
    near(size.widthMm.value, 4 * 1.41);
  });

  test('a láncszem hossza mért, ha van láncszemsor-mérés', () => {
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
