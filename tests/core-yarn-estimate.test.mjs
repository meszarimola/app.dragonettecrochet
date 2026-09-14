import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { estimate } from '../src/core/quantity.ts';
import { DEFAULT_BUFFER, ballsNeeded, massPerArea, yarnFromMassPerArea, yarnFromSwatch } from '../src/core/yarn-estimate.ts';
import { exampleProfiles } from './fixtures/calibration.ts';

function near(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} ≠ ${expected} (±${epsilon})`);
}

test('02 §6.5 metrikus példa: 15 × 15 cm, 14,2 g → 100 × 130 cm-es takaró 820 g, 1640 m, tartalékkal 1804 m, 10 gombolyag', () => {
  near(massPerArea(14.2, 225), 0.0631, 0.0001);
  const estimate = yarnFromSwatch({ massG: 14.2, areaCm2: 15 * 15 }, 100 * 130, { lengthM: 200, massG: 100 });
  near(estimate.massG.value, 820, 1);
  near(estimate.lengthM.value, 1640, 1);
  near(estimate.lengthWithBufferM.value, 1804, 1);
  assert.equal(estimate.balls.value, 10);
});

test('02 §6.5 Petals to Picots: 6 × 6"-es, 18 g-os próbadarab → 50 × 60"-es takaró 3630 yd, 17 gombolyag', () => {
  const estimate = yarnFromSwatch({ massG: 18, areaCm2: 36 }, 50 * 60, { lengthM: 220, massG: 100 });
  near(estimate.massG.value, 1500);
  near(estimate.lengthM.value, 3300);
  near(estimate.lengthWithBufferM.value, 3630);
  assert.equal(estimate.balls.value, 17);
});

test('a tartalék becslés 10–15 %: a hossz és a gombolyagszám tartománnyal jön', () => {
  assert.deepEqual(DEFAULT_BUFFER, { value: 0.1, source: 'estimated', range: [0.1, 0.15] });
  const estimate = yarnFromSwatch({ massG: 18, areaCm2: 36 }, 50 * 60, { lengthM: 220, massG: 100 });
  assert.equal(estimate.lengthM.source, 'label');
  assert.equal(estimate.lengthWithBufferM.source, 'estimated');
  near(estimate.lengthWithBufferM.range[0], 3630);
  near(estimate.lengthWithBufferM.range[1], 3795);
  assert.deepEqual(estimate.balls.range, [17, 18]);
});

test('más tartalékkal is számol, pl. a crochetcalc 15 %-ával', () => {
  const estimate = yarnFromSwatch({ massG: 14.2, areaCm2: 225 }, 13000, { lengthM: 200, massG: 100 }, estimate15());
  near(estimate.lengthWithBufferM.value, 1640.9 * 1.15, 1);
});

function estimate15() {
  return estimate(0.15, [0.15, 0.15]);
}

test('a gombolyagszám felfelé kerekít, de pontos többszörösnél nem ad egy fölöslegeset', () => {
  assert.equal(ballsNeeded(2000, 200), 10);
  assert.equal(ballsNeeded(2000.5, 200), 11);
  assert.equal(ballsNeeded(0.1 + 0.2, 0.3), 1);
});

test('a profil blokkolt próbadarabjából: a becsült terület tartománya továbbvivődik', () => {
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
