import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  CYC_WEIGHTS,
  classifyByMeterage,
  cycGaugePer10cm,
  cycWeightClass,
  metersPer100g,
  metersPer100gFromNm,
  parseMetricCount,
  per10cmFromPer4in,
  texFromNm,
} from '../src/core/yarn-weight.ts';

function near(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} ≠ ${expected} (±${epsilon})`);
}

test('the CYC table lists categories 0–7 in order, with increasing hook size (02 §1.1)', () => {
  assert.deepEqual(
    CYC_WEIGHTS.map((entry) => entry.weight),
    [0, 1, 2, 3, 4, 5, 6, 7],
  );
  for (let i = 1; i < CYC_WEIGHTS.length; i++) {
    assert.ok(CYC_WEIGHTS[i].hookMm[0] >= CYC_WEIGHTS[i - 1].hookMm[0], `category ${i}`);
  }
  assert.deepEqual(cycWeightClass(4).stitchesPer4in, [11, 14]);
  assert.deepEqual(cycWeightClass(4).hookMm, [5.5, 6.5]);
  assert.equal(cycWeightClass(0).gaugeStitch, 'dc');
});

test('in the CYC pairing stitches/4" × hook mm stays nearly constant, ≈ 72 in categories 1–5 (02 §3.4)', () => {
  for (const { weight, stitchesPer4in, hookMm } of CYC_WEIGHTS.filter((entry) => entry.weight >= 1 && entry.weight <= 5)) {
    for (const product of [stitchesPer4in[1] * hookMm[0], stitchesPer4in[0] * hookMm[1]]) {
      assert.ok(Math.abs(product - 72) / 72 <= 0.09, `category ${weight}: ${product}`);
    }
  }
});

test('the gauge of a category converted to 10 cm, as an estimate with a range', () => {
  near(per10cmFromPer4in(14), 13.78, 0.01);
  const medium = cycGaugePer10cm(4);
  assert.equal(medium.stitch, 'sc');
  assert.equal(medium.perTenCm.source, 'estimated');
  near(medium.perTenCm.range[0], 10.83, 0.01);
  near(medium.perTenCm.range[1], 13.78, 0.01);
  near(medium.perTenCm.value, (medium.perTenCm.range[0] + medium.perTenCm.range[1]) / 2);
  assert.equal(cycGaugePer10cm(0).stitch, 'dc');
  assert.equal(cycGaugePer10cm(7), null);
});

test('m/100 g from the label: for a 50 g ball it is twice the stated length (02 §1.4)', () => {
  assert.equal(metersPer100g(125, 50), 250);
  assert.equal(metersPer100g(200, 100), 200);
});

test('the category estimated from meterage uses the suggested bounds, and a value on a bound yields several candidates (02 §1.4)', () => {
  assert.equal(classifyByMeterage(800).weight, 0);
  assert.equal(classifyByMeterage(400).weight, 1);
  assert.equal(classifyByMeterage(300).weight, 2);
  assert.equal(classifyByMeterage(250).weight, 3);
  assert.equal(classifyByMeterage(180).weight, 4);
  assert.deepEqual(classifyByMeterage(130), { weight: 4, candidates: [4, 5], source: 'estimated' });
  assert.equal(classifyByMeterage(90).weight, 5);
  assert.equal(classifyByMeterage(50).weight, 6);
  assert.equal(classifyByMeterage(30).weight, 7);
  assert.throws(() => classifyByMeterage(0), RangeError);
});

test('02 §1.5 worked example: the „Nm 2/8” cone is 400 m/100 g and 250 tex', () => {
  const nm = parseMetricCount('Nm 2/8'.replace('Nm', ''));
  assert.equal(nm, 4);
  assert.equal(metersPer100gFromNm(nm), 400);
  assert.equal(texFromNm(nm), 250);
  assert.equal(parseMetricCount('2/28'), 14);
  assert.equal(parseMetricCount('14'), 14);
  assert.equal(parseMetricCount('kettő'), null);
});
