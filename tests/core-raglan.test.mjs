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
import { layoutPattern } from '../src/core/layout.ts';
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
  assert.equal(typeof plan, 'object', typeof plan === 'string' ? plan : '');
  return plan;
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
    assert.match(plan.warnings.join(' '), /A sarkok szaporítása 32 szemmel kevesebbet ad a törzsnek/);
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
    assert.ok(result.ok, result.ok ? '' : result.reason);
    assert.equal(result.plan.checksPassed, result.plan.checksTotal);
    assert.deepEqual(result.plan.monotonic, []);
  });

  test('a legnagyobb méreteknél a raglán mélysége kevés: az elutasítás megmondja, mit kell állítani', () => {
    // A CYC táblázatban a karöltőmélység jóval lassabban nő, mint a mellbőség (05 §3.8), ezért a 3X fölötti
    // méretekhez mélyebb raglán vagy más szabásmód kell.
    const result = planGarment(withGauge(), { ...options, size: '5X', from: '5X', to: '5X' });
    assert.equal(result.ok, false);
    assert.match(result.reason, /adj meg mélyebb raglánt/);
  });

  test('a generált raglán hibátlan: vállrész, szétosztás hónaljlánccal, törzs', () => {
    const result = generateGarment(withGauge(), options);
    assert.ok(result.ok, result.ok ? '' : result.reason);
    const { pattern, plan } = result;
    const base = plan.sizes[plan.base].plan;
    assert.deepEqual(validatePattern(pattern, libraryFor(pattern)), []);
    assert.equal(pattern.pieces.length, 1);
    assert.equal(pattern.garment.kind, 'raglan');
    // Az ujjak szemeit a szétosztásnál kihagyjuk: azok külön készülnek.
    assert.equal(pattern.pieces[0].skipped.length, 2 * base.target.sleeve);
    const graph = buildPieceGraph(pattern, pattern.pieces[0], libraryFor(pattern));
    // A vállrész körei, a szétosztás köre, a törzs körei, végül a két ujj első köre (PQW-908).
    assert.equal(graph.layers.length - 1, base.yokeRounds + 1 + base.bodyRoundsBelow + 2);
    assert.equal(graph.layers[base.yokeRounds + 2].stitchCount, base.bodyStitches);

    // Az ujjak: a vállrész utolsó körének kihagyott szemeibe és a szétosztás hónaljláncába horgolnak.
    const sleeves = graph.layers.slice(-2);
    for (const sleeve of sleeves) {
      assert.equal(sleeve.stitchCount, base.sleeveStitches, 'az ujj körmérete a terv szerinti');
      assert.equal(sleeve.below, base.yokeRounds + 1, 'az ujj a vállrész utolsó körénél folytatódik');
      assert.equal(sleeve.alsoBelow, base.yokeRounds + 2, 'a hónaljlánc a szétosztás köréből jön');
      // Az alapgyűrű (PQW-908): a saját kihagyott szemei és a hónaljlánc érnek össze a hónaljnál. A két
      // forrásréteg többi szeme (a törzs) nem tartozik a csőbe, ezért nincs benne a gyűrűben.
      assert.equal(sleeve.basePositions.length, base.sleeveStitches, 'az ujj alapgyűrűje a terv szerinti');
      assert.deepEqual(
        [...new Set(sleeve.basePositions.map((id) => graph.layerOf.get(id)))].sort(),
        [base.yokeRounds + 1, base.yokeRounds + 2],
        'az alapgyűrű csak a két forrásrétegből áll',
      );
      // Minden szem célpontot kap, és csak a két forrásból.
      const targets = sleeve.stitches
        .filter((id) => graph.defs.get(id).kind === 'basic')
        .flatMap((id) => graph.nodes.get(id).anchors.map((anchor) => graph.layerOf.get(anchor.id)));
      assert.ok(targets.length > 0);
      assert.deepEqual([...new Set(targets)].sort(), [base.yokeRounds + 1, base.yokeRounds + 2]);
    }
  });

  test('a vállrész kúp: a rajz kör alapú, a négy raglánvonal nem motívumsarok', () => {
    const result = generateGarment(withGauge(), options);
    assert.ok(result.ok, result.ok ? '' : result.reason);
    const { pattern } = result;
    // A négy raglánvonal szaporítási pont marad: a lapos növekedés ehhez méri magát.
    assert.equal(pattern.pieces[0].corners, 4);
    assert.equal(pattern.pieces[0].roundShape.kind, 'cone');
    // A rajz mégis kör alapú (PQW-908): sarkos keretre húzva négyzetté torzult, pedig a vállrész a
    // valóságban körbefutó kúp. Lapos körnél a keret hiányzik (PQW-888), sokszögnél áll csak.
    // A többi körös rajz (kör, motívum, amigurumi) keretét ez nem érinti.
    const chart = layoutPattern(pattern, libraryFor(pattern));
    assert.equal(chart.frame, undefined);
    // A vállrész egyik köre: minden szeme közel egyforma távol a közepétől. Négyzetes kereten a sarok
    // és az oldal közepe gyökkettő arányban állna, azaz ez a próba megbukna.
    const yoke = [...chart.nodes.values()].filter((node) => node.layer === 8 && node.role === 'stitch');
    assert.ok(yoke.length > 20, `a 8. kör szemei: ${yoke.length}`);
    const radii = yoke.map((node) => Math.hypot(node.top.x, node.top.y));
    const min = Math.min(...radii);
    const max = Math.max(...radii);
    assert.ok(max / min < 1.1, `a vállrész köre nem kör alakú: ${min.toFixed(1)}–${max.toFixed(1)}`);
  });

  test('az írott minta „Méretek” blokkja a raglán számait sorolja', () => {
    const result = generateGarment(withGauge(), options);
    assert.ok(result.ok, result.ok ? '' : result.reason);
    const text = formatWrittenPattern(writePattern(result.pattern, libraryFor(result.pattern), 'hu'));
    assert.match(text, /Nyak: \d+ \(\d+, \d+\) lsz körbe zárva/);
    assert.match(text, /Raglán: \d+ \(\d+, \d+\) kör, körönként a négy raglánvonal mellett szaporítva/);
    assert.match(text, /Szétosztás: elöl és hátul \d+ \(\d+, \d+\) szem/);
  });

  test('becsült mintasűrűséggel a nagy méretek elutasítása megmondja a megoldást', () => {
    const result = planGarment(emptyPattern(), options);
    assert.equal(result.ok, false);
    assert.match(result.reason, /mérd meg a körben horgolt mintasűrűséget/);
  });
});

describe('a raglán elutasításai', () => {
  test('túl mély raglán: a szakaszok túlnőnek a célon', () => {
    assert.match(raglanPlan({ ...C, yokeDepthCm: 40 }, gauge), /túl sok szemet ad/);
  });

  test('túl sekély raglán: az ujj nem jön ki a sarkok szaporításából', () => {
    assert.match(raglanPlan({ ...C, yokeDepthCm: 4 }, gauge), /túl kevés szemet ad az ujjnak|nem férnek el a raglánkörökben/);
  });

  test('15%-nál nagyobb negatív bőséget nem tervez', () => {
    assert.match(raglanPlan({ ...C, easeCm: -20 }, gauge), /legfeljebb a mellbőség 15%-a/);
  });

  test('a pulóver hossza legyen nagyobb a raglán mélységénél', () => {
    assert.match(raglanPlan({ ...C, bodyLengthCm: 21 }, gauge), /hossza legyen nagyobb a raglán mélységénél/);
  });
});
