/*
 * The size and yarn of a pattern, taken from the profile saved with it
 * (PQW-859): the profile entered in the UI seen as a core profile, the layers
 * that make up the size, the yarn estimate, managing profiles, and the stem
 * length in the true-to-proportion view.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { contextOf, emptyPattern } from '../src/core/editor.ts';
import { ROW_GAP } from '../src/core/layout.ts';
import {
  activeProfile,
  aspectStem,
  ballLengthM,
  DEFAULT_HOOK_MM,
  estimatedGauge,
  gaugeContextOf,
  gaugeProfileOf,
  newProfile,
  patternSize,
  sizeLayers,
  swatchMassPerArea,
  withActiveProfile,
  withoutProfile,
  withProfile,
} from '../src/core/pattern-size.ts';
import { yarnFromMassPerArea } from '../src/core/yarn-estimate.ts';
import { dcRectangle, grannySquare, hdcRectangle } from './fixtures/examples.ts';
import { testLibrary } from './fixtures/library.ts';

function near(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} ≠ ${expected} (±${epsilon})`);
}

const entry = (stitch, form, stitchesPer10cm, rowsPer10cm, source = 'measured') => ({
  stitch,
  form,
  stitchesPer10cm,
  rowsPer10cm,
  source,
});

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

describe('a profile entered in the UI, seen as a core profile', () => {
  test('stitches/10 cm and rows/10 cm converted to mm; a gauge measured in the round becomes the tube, one taken from the label stays label-sourced', () => {
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
    // An incomplete row is not a measurement.
    assert.equal(converted.perStitch.hdc, undefined);
  });

  test('the yarn: m/100 g from the label, the weight class estimated from that m/100 g, and the length of the ball', () => {
    const converted = gaugeProfileOf(profile());
    assert.deepEqual(converted.yarn.metersPer100g, { value: 200, source: 'label' });
    assert.deepEqual(converted.yarn.cycWeight, { value: 4, source: 'estimated' });
    assert.deepEqual(converted.yarn.label, { lengthM: 200, massG: 100 });
    const labelled = gaugeProfileOf(
      profile({ yarn: { name: '', cycWeight: 3, metersPer100g: null, ballMassG: null } }),
    );
    assert.deepEqual(labelled.yarn.cycWeight, { value: 3, source: 'label' });
    assert.equal(labelled.yarn.label.lengthM, null);
  });

  test('02 §4.2 worked example: on a 4 mm hook, single crochet without a measurement gives ≈ 17,7 sts and 22 rows over 10 cm', () => {
    assert.deepEqual(estimatedGauge(profile(), testLibrary, 'sc', 'rows'), {
      stitchesPer10cm: 17.7,
      rowsPer10cm: 22.2,
    });
    // Starting from a measured single crochet, half double crochet keeps the width and gets a taller row.
    const measured = profile({ gauges: [entry('sc', 'rows', 20, 25)] });
    const hdc = estimatedGauge(measured, testLibrary, 'hdc', 'rows');
    assert.equal(hdc.stitchesPer10cm, 20);
    assert.ok(hdc.rowsPer10cm < 25);
  });
});

describe('the size of the pattern', () => {
  test('without a profile the size is estimated from the default hook, with a range; an old save has no profile either', () => {
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

  test('with a measured profile the size is measured; a gauge taken from the label is marked as label-sourced', () => {
    const { pattern } = hdcRectangle();
    const measured = sized(withProfile(pattern, profile({ gauges: [entry('hdc', 'rows', 17.7, 15)] })));
    assert.equal(measured.size.estimated, false);
    assert.equal(measured.size.source, 'measured');
    near(measured.size.total.widthCm.value, (15 * 100) / 17.7 / 10);
    near(measured.size.total.heightCm.value, (measured.size.layers.length * 100) / 15 / 10);

    const label = sized(withProfile(pattern, profile({ gauges: [entry('hdc', 'rows', 17.7, 15, 'label')] })));
    assert.equal(label.size.source, 'label');
  });

  test('the layers: a non-counting turning chain is left out and a counting one is one stitch, while the row indexes are kept', () => {
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

  test('in the round the joining and travelling slip stitches add no circumference, and the piece is a flat circle', () => {
    const { pattern } = grannySquare();
    const { graph } = contextOf(pattern);
    const layers = sizeLayers(graph);
    assert.ok(layers.length > 0 && layers.every((layer) => layer.shape === 'round'));
    for (const layer of layers) {
      const info = graph.layers[layer.index];
      const slips = info.travelSlips.length + (info.joinSlip ? 1 : 0);
      assert.ok(slips > 0, `round ${layer.index}: the example does have a slip stitch`);
      const turning = info.turningChainCounts && info.turningChain.length > 0 ? 1 : 0;
      assert.equal(layer.stitches.length, info.stitches.length - slips - info.turningChain.length + turning);
    }
    assert.equal(sized(pattern).size.total.form, 'circle');
  });

  test('an empty pattern has no size, and the yarn is missing both the profile and the size', () => {
    const size = sized(emptyPattern());
    assert.equal(size.size, null);
    assert.deepEqual(size.yarn, { kind: 'missing', missing: ['profile', 'size'] });
  });
});

describe('yarn estimated from the mass of the swatch', () => {
  test('02 §6.5 metric example: 15 × 15 cm, 14,2 g; 100 × 130 cm at 200 m/100 g → 820 g, 1640 m, 10 balls', () => {
    const swatch = profile({ swatch: { widthCm: 15, heightCm: 15, massG: 14.2 } });
    near(swatchMassPerArea(swatch), 0.0631, 1e-4);
    assert.equal(ballLengthM(swatch), 200);
    const yarn = yarnFromMassPerArea(swatchMassPerArea(swatch), 100 * 130, {
      lengthM: ballLengthM(swatch),
      massG: 100,
    });
    near(yarn.massG.value, 820, 1);
    near(yarn.lengthM.value, 1640, 2);
    near(yarn.lengthWithBufferM.value, 1804, 2);
    assert.equal(yarn.balls.value, 10);
  });

  test('from the area of the pattern, with buffer, rounded up to whole balls', () => {
    const { pattern } = hdcRectangle();
    const size = sized(
      withProfile(
        pattern,
        profile({ gauges: [entry('hdc', 'rows', 17.7, 15)], swatch: { widthCm: 15, heightCm: 15, massG: 14.2 } }),
      ),
    );
    assert.equal(size.yarn.kind, 'estimate');
    const { estimate, ballLengthM: ball } = size.yarn;
    near(estimate.massG.value, (14.2 / 225) * size.size.total.areaCm2.value, 1e-9);
    assert.equal(estimate.balls.value, Math.ceil(estimate.lengthWithBufferM.value / ball));
    assert.equal(estimate.balls.source, 'estimated');
  });

  test('when data is missing it says what is missing', () => {
    const { pattern } = hdcRectangle();
    const bare = profile({ yarn: { name: '', cycWeight: null, metersPer100g: null, ballMassG: null } });
    assert.deepEqual(sized(withProfile(pattern, bare)).yarn, {
      kind: 'missing',
      missing: ['swatch', 'meterage', 'ball'],
    });
  });
});

describe('profiles inside the pattern', () => {
  test('creating, switching and deleting; after the last one is deleted the pattern has no gauge field', () => {
    let pattern = emptyPattern();
    const first = newProfile(pattern);
    assert.equal(first.id, 'p1');
    assert.equal(first.hookMm, DEFAULT_HOOK_MM);
    pattern = withProfile(pattern, { ...first, hookMm: 5 });
    const second = newProfile(pattern);
    assert.equal(second.id, 'p2');
    assert.equal(second.hookMm, 5, 'a new profile starts with the hook of the selected one');
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

describe('the true-to-proportion view', () => {
  const stemFor = (pattern, shape) => aspectStem(gaugeContextOf(pattern, testLibrary), shape);

  test('without a profile a flat single crochet row spans 0,8 column widths, and 1 in the round', () => {
    near(stemFor(emptyPattern(), 'row')(1) + ROW_GAP, 24 * 0.8);
    near(stemFor(emptyPattern(), 'round')(1) + ROW_GAP, 24);
  });

  test('the measured stitch ratio: 20 sts and 25 rows over 10 cm → 0,8; a measured double crochet uses its own height', () => {
    const pattern = withProfile(
      emptyPattern(),
      profile({ gauges: [entry('sc', 'rows', 20, 25), entry('dc', 'rows', 20, 10)] }),
    );
    const stem = stemFor(pattern, 'row');
    near(stem(1) + ROW_GAP, 24 * 0.8);
    near(stem(3) + ROW_GAP, 24 * 2);
    // At slip stitch height (there is no such basic stitch) the shortest stem applies.
    assert.equal(stem(0), 4);
  });
});
