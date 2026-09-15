/*
 * A minta mérete és fonala a mintával mentett profilból (PQW-859): a
 * felületen megadott profil a mag profiljaként, a méret rétegei, a
 * fonalbecslés, a profilok kezelése és az arányhelyes szárhossz.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { contextOf, emptyPattern } from '../src/core/editor.ts';
import { ROW_GAP } from '../src/core/layout.ts';
import {
  DEFAULT_HOOK_MM,
  activeProfile,
  aspectStem,
  ballLengthM,
  estimatedGauge,
  gaugeContextOf,
  gaugeProfileOf,
  newProfile,
  patternSize,
  sizeLayers,
  swatchMassPerArea,
  withActiveProfile,
  withProfile,
  withoutProfile,
} from '../src/core/pattern-size.ts';
import { yarnFromMassPerArea } from '../src/core/yarn-estimate.ts';
import { dcRectangle, grannySquare, hdcRectangle } from './fixtures/examples.ts';
import { testLibrary } from './fixtures/library.ts';

function near(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} ≠ ${expected} (±${epsilon})`);
}

const entry = (stitch, form, stitchesPer10cm, rowsPer10cm, source = 'measured') => ({ stitch, form, stitchesPer10cm, rowsPer10cm, source });

function profile(overrides = {}) {
  return {
    ...newProfile(emptyPattern()),
    yarn: { name: 'Pamut 125', cycWeight: null, metersPer100g: 200, ballMassG: 100 },
    ...overrides,
  };
}

function sized(pattern) {
  const context = contextOf(pattern);
  return patternSize(pattern, context.graph, context.library);
}

describe('a felületen megadott profil a mag profiljaként', () => {
  test('szem/10 cm és sor/10 cm mm-re váltva; a körben mért a cső, a címkéről vett címkeként', () => {
    const converted = gaugeProfileOf(
      profile({
        gauges: [entry('sc', 'rows', 20, 25, 'label'), entry('sc', 'rounds', 18, 16), entry('hdc', 'rows', null, 15)],
        swatch: { widthCm: 15, heightCm: 15, massG: 14.2 },
      }),
    );
    const flat = converted.perStitch.sc.rows;
    near(flat.widthMm.mean, 5);
    near(flat.heightMm.mean, 4);
    assert.equal(flat.source, 'label');
    near(flat.massPerAreaGPerCm2, 14.2 / 225);
    near(converted.perStitch.sc['rounds-tube'].widthMm.mean, 100 / 18);
    assert.equal(converted.perStitch.sc['rounds-tube'].source, 'measured');
    // A hiányos sor nem mérés.
    assert.equal(converted.perStitch.hdc, undefined);
  });

  test('a fonal: m/100 g a címkéről, a vastagság a m/100 g-ből becsülve, a gombolyag hossza', () => {
    const converted = gaugeProfileOf(profile());
    assert.deepEqual(converted.yarn.metersPer100g, { value: 200, source: 'label' });
    assert.deepEqual(converted.yarn.cycWeight, { value: 4, source: 'estimated' });
    assert.deepEqual(converted.yarn.label, { lengthM: 200, massG: 100 });
    const labelled = gaugeProfileOf(profile({ yarn: { name: '', cycWeight: 3, metersPer100g: null, ballMassG: null } }));
    assert.deepEqual(labelled.yarn.cycWeight, { value: 3, source: 'label' });
    assert.equal(labelled.yarn.label.lengthM, null);
  });

  test('02 §4.2 kidolgozott példa: 4 mm-es tű, rövidpálca mérés nélkül ≈ 17,7 szem és 22 sor 10 cm-en', () => {
    assert.deepEqual(estimatedGauge(profile(), testLibrary, 'sc', 'rows'), { stitchesPer10cm: 17.7, rowsPer10cm: 22.2 });
    // Mért rövidpálcából a félpálca szélessége ugyanaz, a sor magasabb.
    const measured = profile({ gauges: [entry('sc', 'rows', 20, 25)] });
    const hdc = estimatedGauge(measured, testLibrary, 'hdc', 'rows');
    assert.equal(hdc.stitchesPer10cm, 20);
    assert.ok(hdc.rowsPer10cm < 25);
  });
});

describe('a minta mérete', () => {
  test('profil nélkül becslés az alapértelmezett tűből, tartománnyal; a régi mentésnek sincs profilja', () => {
    const size = sized(hdcRectangle().pattern);
    assert.equal(size.profile, null);
    assert.equal(size.hookMm, DEFAULT_HOOK_MM);
    assert.equal(size.size.estimated, true);
    const { widthCm, heightCm } = size.size.total;
    for (const quantity of [widthCm, heightCm]) {
      assert.equal(quantity.source, 'estimated');
      assert.ok(quantity.range[0] < quantity.value && quantity.value < quantity.range[1]);
    }
    assert.deepEqual(size.yarn, { kind: 'missing', missing: ['profile'] });
  });

  test('mért profillal a méret mért; a címkéről vett gauge címkeként jelölt', () => {
    const { pattern } = hdcRectangle();
    const measured = sized(withProfile(pattern, profile({ gauges: [entry('hdc', 'rows', 17.7, 15)] })));
    assert.equal(measured.size.estimated, false);
    assert.equal(measured.size.source, 'measured');
    near(measured.size.total.widthCm.value, (15 * 100) / 17.7 / 10);
    near(measured.size.total.heightCm.value, (measured.size.layers.length * 100) / 15 / 10);

    const label = sized(withProfile(pattern, profile({ gauges: [entry('hdc', 'rows', 17.7, 15, 'label')] })));
    assert.equal(label.size.source, 'label');
  });

  test('a rétegek: a nem számító fordulólánc kimarad, a számító egy szem; a sorszámok megmaradnak', () => {
    for (const make of [hdcRectangle, dcRectangle]) {
      const { graph } = contextOf(make().pattern);
      const layers = sizeLayers(graph);
      assert.deepEqual(
        layers.map((layer) => layer.stitches.length),
        graph.layers.slice(1).map((layer) => layer.stitchCount),
      );
      assert.deepEqual(
        layers.map((layer) => layer.index),
        graph.layers.slice(1).map((layer) => layer.index),
      );
    }
  });

  test('körben a kör záró és továbbvezető kúszószeme nem ad kerületet; a darab lapos kör', () => {
    const { pattern } = grannySquare();
    const { graph } = contextOf(pattern);
    const layers = sizeLayers(graph);
    assert.ok(layers.length > 0 && layers.every((layer) => layer.shape === 'round'));
    for (const layer of layers) {
      const info = graph.layers[layer.index];
      const slips = info.travelSlips.length + (info.joinSlip ? 1 : 0);
      assert.ok(slips > 0, `${layer.index}. kör: a példában van kúszószem`);
      const turning = info.turningChainCounts && info.turningChain.length > 0 ? 1 : 0;
      assert.equal(layer.stitches.length, info.stitches.length - slips - info.turningChain.length + turning);
    }
    assert.equal(sized(pattern).size.total.form, 'circle');
  });

  test('üres minta: nincs méret, és a fonalhoz a profil és a méret is hiányzik', () => {
    const size = sized(emptyPattern());
    assert.equal(size.size, null);
    assert.deepEqual(size.yarn, { kind: 'missing', missing: ['profile', 'size'] });
  });
});

describe('fonalbecslés a próbadarab tömegéből', () => {
  test('02 §6.5 metrikus példa: 15 × 15 cm, 14,2 g; 100 × 130 cm, 200 m/100 g → 820 g, 1640 m, 10 gombolyag', () => {
    const swatch = profile({ swatch: { widthCm: 15, heightCm: 15, massG: 14.2 } });
    near(swatchMassPerArea(swatch), 0.0631, 1e-4);
    assert.equal(ballLengthM(swatch), 200);
    const yarn = yarnFromMassPerArea(swatchMassPerArea(swatch), 100 * 130, { lengthM: ballLengthM(swatch), massG: 100 });
    near(yarn.massG.value, 820, 1);
    near(yarn.lengthM.value, 1640, 2);
    near(yarn.lengthWithBufferM.value, 1804, 2);
    assert.equal(yarn.balls.value, 10);
  });

  test('a minta területéből, tartalékkal, egész gombolyagra kerekítve', () => {
    const { pattern } = hdcRectangle();
    const size = sized(
      withProfile(pattern, profile({ gauges: [entry('hdc', 'rows', 17.7, 15)], swatch: { widthCm: 15, heightCm: 15, massG: 14.2 } })),
    );
    assert.equal(size.yarn.kind, 'estimate');
    const { estimate, ballLengthM: ball } = size.yarn;
    near(estimate.massG.value, (14.2 / 225) * size.size.total.areaCm2.value, 1e-9);
    assert.equal(estimate.balls.value, Math.ceil(estimate.lengthWithBufferM.value / ball));
    assert.equal(estimate.balls.source, 'estimated');
  });

  test('hiányzó adatnál megmondja, mi hiányzik', () => {
    const { pattern } = hdcRectangle();
    const bare = profile({ yarn: { name: '', cycWeight: null, metersPer100g: null, ballMassG: null } });
    assert.deepEqual(sized(withProfile(pattern, bare)).yarn, { kind: 'missing', missing: ['swatch', 'meterage', 'ball'] });
  });
});

describe('profilok a mintában', () => {
  test('új, váltás, törlés; az utolsó törlése után a mintában nincs gauge mező', () => {
    let pattern = emptyPattern();
    const first = newProfile(pattern);
    assert.equal(first.id, 'p1');
    assert.equal(first.hookMm, DEFAULT_HOOK_MM);
    pattern = withProfile(pattern, { ...first, hookMm: 5 });
    const second = newProfile(pattern);
    assert.equal(second.id, 'p2');
    assert.equal(second.hookMm, 5, 'az új profil a kiválasztott tűjével indul');
    pattern = withProfile(pattern, second);
    assert.equal(activeProfile(pattern).id, 'p2');

    pattern = withActiveProfile(pattern, 'p1');
    assert.equal(activeProfile(pattern).hookMm, 5);
    assert.equal(activeProfile(withActiveProfile(pattern, null)), null);
    assert.throws(() => withActiveProfile(pattern, 'p9'), RangeError);

    pattern = withoutProfile(pattern, 'p1');
    assert.deepEqual(pattern.gauge, { active: null, profiles: [second] });
    pattern = withoutProfile(pattern, 'p2');
    assert.equal('gauge' in pattern, false);
  });
});

describe('arányhelyes nézet', () => {
  const stemFor = (pattern, shape) => aspectStem(gaugeContextOf(pattern, testLibrary), shape);

  test('profil nélkül síkban a rövidpálcás sor osztása 0,8 oszlopszélesség, körben 1', () => {
    near(stemFor(emptyPattern(), 'row')(1) + ROW_GAP, 24 * 0.8);
    near(stemFor(emptyPattern(), 'round')(1) + ROW_GAP, 24);
  });

  test('a mért szemarány: 20 szem és 25 sor 10 cm-en → 0,8; a mért pálca a saját magasságával', () => {
    const pattern = withProfile(emptyPattern(), profile({ gauges: [entry('sc', 'rows', 20, 25), entry('dc', 'rows', 20, 10)] }));
    const stem = stemFor(pattern, 'row');
    near(stem(1) + ROW_GAP, 24 * 0.8);
    near(stem(3) + ROW_GAP, 24 * 2);
    // Kúszószem-magasságon (nincs ilyen alapszem) a legrövidebb szár.
    assert.equal(stem(0), 4);
  });
});
