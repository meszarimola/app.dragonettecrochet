import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { estimate } from '../src/core/quantity.ts';
import { DEFAULT_BUFFER, ballsNeeded, massPerArea, yarnFromMassPerArea, yarnFromSwatch } from '../src/core/yarn-estimate.ts';
import { exampleProfiles } from './fixtures/calibration.ts';

function near(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} ≠ ${expected} (±${epsilon})`);
}

test('02 §6.5 metric example: a 15 × 15 cm, 14,2 g swatch → a 100 × 130 cm blanket needs 820 g, 1640 m, 1804 m with buffer, 10 balls', () => {
  near(massPerArea(14.2, 225), 0.0631, 0.0001);
  const estimate = yarnFromSwatch({ massG: 14.2, areaCm2: 15 * 15 }, 100 * 130, { lengthM: 200, massG: 100 });
  near(estimate.massG.value, 820, 1);
  near(estimate.lengthM.value, 1640, 1);
  near(estimate.lengthWithBufferM.value, 1804, 1);
  assert.equal(estimate.balls.value, 10);
});

test('02 §6.5 Petals to Picots: a 6 × 6", 18 g swatch → a 50 × 60" blanket needs 3630 yd, 17 balls', () => {
  const estimate = yarnFromSwatch({ massG: 18, areaCm2: 36 }, 50 * 60, { lengthM: 220, massG: 100 });
  near(estimate.massG.value, 1500);
  near(estimate.lengthM.value, 3300);
  near(estimate.lengthWithBufferM.value, 3630);
  assert.equal(estimate.balls.value, 17);
});

test('the buffer is an estimate of 10–15 %: the length and the ball count come with a range', () => {
  assert.deepEqual(DEFAULT_BUFFER, { value: 0.1, source: 'estimated', range: [0.1, 0.15] });
  const estimate = yarnFromSwatch({ massG: 18, areaCm2: 36 }, 50 * 60, { lengthM: 220, massG: 100 });
  assert.equal(estimate.lengthM.source, 'label');
  assert.equal(estimate.lengthWithBufferM.source, 'estimated');
  near(estimate.lengthWithBufferM.range[0], 3630);
  near(estimate.lengthWithBufferM.range[1], 3795);
  assert.deepEqual(estimate.balls.range, [17, 18]);
});

test('it also computes with another buffer, such as the 15 % used by crochetcalc', () => {
  const estimate = yarnFromSwatch({ massG: 14.2, areaCm2: 225 }, 13000, { lengthM: 200, massG: 100 }, estimate15());
  near(estimate.lengthWithBufferM.value, 1640.9 * 1.15, 1);
});

function estimate15() {
  return estimate(0.15, [0.15, 0.15]);
}

test('the ball count rounds up, but an exact multiple does not add a spare ball', () => {
  assert.equal(ballsNeeded(2000, 200), 10);
  assert.equal(ballsNeeded(2000.5, 200), 11);
  assert.equal(ballsNeeded(0.1 + 0.2, 0.3), 1);
});

test('from the blocked swatch of a profile: the range of the estimated area carries through', () => {
  const { blocked } = exampleProfiles();
  const { massPerAreaGPerCm2 } = blocked.perStitch.sc.rows;
  const area = estimate(900, [800, 1000]);
  const result = yarnFromMassPerArea(massPerAreaGPerCm2, area, { lengthM: 125, massG: 50 });
  near(result.massG.value, (8.6 / 144.9) * 900);
  assert.equal(result.massG.source, 'estimated');
  near(result.massG.range[0], (8.6 / 144.9) * 800);
  near(result.lengthM.value, result.massG.value * 2.5);
  assert.equal(result.balls.value, Math.ceil((result.lengthM.value * 1.1) / 125));
});
