/*
 * Felülről horgolt raglán (PQW-901): a tudásbázis „C” kidolgozott példája
 * (05 §4), a hónaljlánc kettős beszámítása, a külön törzsszaporítás és a
 * tervezés elutasításai.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { emptyPattern } from '../src/core/editor.ts';
import { DEFAULT_GARMENT, generateGarment, planGarment } from '../src/core/garments.ts';
import { buildPieceGraph } from '../src/core/graph.ts';
import { formatWrittenPattern, writePattern } from '../src/core/pattern-text.ts';
import { RAGLAN_PER_ROUND, raglanPlan } from '../src/core/raglan.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { validatePattern } from '../src/core/validate.ts';

/** A „C” példa mintasűrűsége: 15 szem × 8 kör / 10 cm. */
const gauge = { stitchCm: 1 / 1.5, rowCm: 1 / 0.8 };

/** A „C” példa bemenete (05 §4 „Worked example C”). */
const C = {
  bustCm: 96,
  easeCm: 8,
  upperArmCm: 33,
  neckCm: 48,
  yokeDepthCm: 20,
  underarmCm: 4,
  bodyLengthCm: 58,
  hemCm: 5,
};

const planned = (patch = {}) => {
  const plan = raglanPlan({ ...C, ...patch }, gauge);
  // Elutasításnál kód és adat jön a terv helyett (PQW-904).
  assert.ok(!('code' in plan), 'code' in plan ? plan.code : '');
  return plan;
};
/** Az elutasítás kódja. */
const refused = (patch) => {
  const plan = raglanPlan({ ...C, ...patch }, gauge);
  assert.ok('code' in plan, 'a terv elkészült, pedig elutasítást vártunk');
  return plan.code;
};

describe('„C” példa: felülről horgolt raglán, mellbőség 96 cm, +8 cm bőség', () => {
  const plan = planned();

  test('a törzs 156, egy ujj 50 szem, a hónaljlánc 6 szem, és mindkettőbe beleszámít', () => {
    assert.equal(plan.bodyStitches, 156);
    assert.equal(plan.sleeveStitches, 50);
    assert.equal(plan.underarm, 6);
    // A hónaljlánc a törzsbe és az ujjba is beleszámít (05 §2.3).
    assert.equal(plan.target.front + plan.target.back + 2 * plan.underarm, plan.bodyStitches);
    assert.equal(plan.target.sleeve + plan.underarm, plan.sleeveStitches);
  });

  test('a nyak 72 szem: elöl és hátul 24, ujjanként 12', () => {
    assert.deepEqual(plan.neck, { stitches: 72, front: 24, back: 24, sleeve: 12 });
  });

  test('a szétosztásnál elöl és hátul 72, ujjanként 44 szem, 16 raglánkör után', () => {
    assert.deepEqual(plan.target, { front: 72, back: 72, sleeve: 44 });
    assert.equal(plan.yokeRounds, 16);
    assert.deepEqual(plan.rounds.at(-1), { front: 72, back: 72, sleeve: 44 });
  });

  test('a sarkok szaporítása 32 szemmel kevesebbet ad a törzsnek: 8 körben külön törzsszaporítás', () => {
    // Körönként +8 szem a négy sarokban; az ujjak ebből pontosan kijönnek.
    assert.equal(RAGLAN_PER_ROUND, 8);
    assert.equal(plan.neck.sleeve + 2 * plan.yokeRounds, plan.target.sleeve);
    // Az elején és a hátán 16-16 szem hiányzik: 8 körben +2-2.
    assert.equal(plan.target.front - (plan.neck.front + 2 * plan.yokeRounds), 16);
    assert.equal(plan.bodyRounds.length, 8);
    assert.deepEqual(plan.bodyRounds, [2, 4, 6, 8, 10, 12, 14, 16]);
  });

  test('minden ellenőrzés igaz, és a hiányzó szemekről figyelmeztetés szól', () => {
    assert.deepEqual(plan.checks.filter((check) => !check.ok), []);
    const warning = plan.warnings.find((item) => item.code === 'raglan-extra-rounds');
    assert.deepEqual(warning.data, { missing: 32, rounds: 8 });
  });

  test('a kész mellbőség a tervezett 104 cm', () => {
    assert.ok(Math.abs(plan.finished.chestCm - 104) < 0.01);
    assert.ok(Math.abs(plan.finished.easeCm - 8) < 0.01);
  });
});

describe('raglán a generátorból, mért mintasűrűséggel', () => {
  /** A „C” példa mintasűrűsége profilként: 15 szem × 8 kör / 10 cm, körben mérve. */
  const withGauge = () => {
    const profile = {
      id: 'raglan',
      yarn: { name: 'Merinó', cycWeight: 4, metersPer100g: 200, ballMassG: 100 },
      hookMm: 5,
      blocked: true,
      gauges: [{ stitch: 'dc', form: 'rounds', stitchesPer10cm: 15, rowsPer10cm: 8, source: 'measured' }],
      swatch: { widthCm: 10, heightCm: 10, massG: 6 },
    };
    return { ...emptyPattern(), gauge: { active: 'raglan', profiles: [profile] } };
  };
  const options = { ...DEFAULT_GARMENT, kind: 'raglan', easeCm: 8 };

  test('XS-től 2X-ig minden méretre minden ellenőrzés igaz, és a szemszámok nem csökkennek', () => {
    const result = planGarment(withGauge(), { ...options, size: 'M', from: 'XS', to: '2X' });
    assert.ok(result.ok, result.ok ? '' : result.reason.code);
    assert.equal(result.plan.checksPassed, result.plan.checksTotal);
    assert.deepEqual(result.plan.monotonic, []);
  });

  test('a legnagyobb méreteknél a raglán mélysége kevés: az elutasítás megmondja, mit kell állítani', () => {
    // A CYC táblázatban a karöltőmélység jóval lassabban nő, mint a mellbőség (05 §3.8), ezért a 3X fölötti
    // méretekhez mélyebb raglán vagy más szabásmód kell.
    const result = planGarment(withGauge(), { ...options, size: '5X', from: '5X', to: '5X' });
    assert.equal(result.ok, false);
    assert.equal(result.reason.code, 'body-short-gauge');
  });

  test('a generált raglán hibátlan: vállrész, szétosztás hónaljlánccal, törzs', () => {
    const result = generateGarment(withGauge(), options);
    assert.ok(result.ok, result.ok ? '' : result.reason.code);
    const { pattern, plan } = result;
    const base = plan.sizes[plan.base].plan;
    assert.deepEqual(validatePattern(pattern, libraryFor(pattern)), []);
    assert.equal(pattern.pieces.length, 1);
    assert.equal(pattern.garment.kind, 'raglan');
    // Az ujjak szemeit a szétosztásnál kihagyjuk: azok külön készülnek.
    assert.equal(pattern.pieces[0].skipped.length, 2 * base.target.sleeve);
    const graph = buildPieceGraph(pattern, pattern.pieces[0], libraryFor(pattern));
    // A vállrész körei, a szétosztás köre és a törzs körei.
    assert.equal(graph.layers.length - 1, base.yokeRounds + 1 + base.bodyRoundsBelow);
    assert.equal(graph.layers[base.yokeRounds + 2].stitchCount, base.bodyStitches);
  });

  test('az írott minta „Méretek” blokkja a raglán számait sorolja', () => {
    const result = generateGarment(withGauge(), options);
    assert.ok(result.ok, result.ok ? '' : result.reason.code);
    const text = formatWrittenPattern(writePattern(result.pattern, libraryFor(result.pattern), 'hu'));
    assert.match(text, /Nyak: \d+ \(\d+, \d+\) lsz körbe zárva/);
    assert.match(text, /Raglán: \d+ \(\d+, \d+\) kör, körönként a négy raglánvonal mellett szaporítva/);
    assert.match(text, /Szétosztás: elöl és hátul \d+ \(\d+, \d+\) szem/);
  });

  test('becsült mintasűrűséggel a nagy méretek elutasítása megmondja a megoldást', () => {
    const result = planGarment(emptyPattern(), options);
    assert.equal(result.ok, false);
    // Sorozatban a méret azonosítója és az ok kódja utazik együtt.
    assert.equal(result.reason.code, 'size-problem');
    assert.equal(result.reason.data.inner, 'body-short-gauge');
  });
});

describe('a raglán elutasításai', () => {
  test('túl mély raglán: a szakaszok túlnőnek a célon', () => {
    assert.equal(refused({ yokeDepthCm: 40 }), 'yoke-body-many');
  });

  test('túl sekély raglán: az ujj nem jön ki a sarkok szaporításából', () => {
    assert.equal(refused({ yokeDepthCm: 4 }), 'yoke-sleeve-few');
  });

  test('15%-nál nagyobb negatív bőséget nem tervez', () => {
    assert.equal(refused({ easeCm: -20 }), 'negative-ease-bust');
  });

  test('a pulóver hossza legyen nagyobb a raglán mélységénél', () => {
    assert.equal(refused({ bodyLengthCm: 21 }), 'body-length-yoke');
  });
});
