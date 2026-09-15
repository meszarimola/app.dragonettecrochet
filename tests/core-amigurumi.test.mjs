/*
 * Amigurumi és 3D formák (PQW-863): a körterv a körben mért mintasűrűségből
 * (04 §4, §9.2, §9.3), a 6 cm-es DK-gömb kidolgozott példája (04 §4.4), a
 * korlátok, a görbület körönként, a méretbecslés, a részek összekapcsolása,
 * a jelölések az írott mintában, a visszaolvasás és a mentés.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { addAmigurumiPart, createAmigurumi, markRound } from '../src/core/amigurumi-generator.ts';
import {
  capHeight,
  clampGrowth,
  diagnoseRounds,
  distributionProblem,
  evenDistribution,
  figureSize,
  flatDown,
  flatUp,
  liftStart,
  roundGaugeOf,
  roundOps,
  shapeSchedule,
  spread,
  startCount,
  towardConsensus,
} from '../src/core/amigurumi.ts';
import { canonicalPattern } from '../src/core/canonical.ts';
import { emptyPattern } from '../src/core/editor.ts';
import { buildPieceGraph } from '../src/core/graph.ts';
import { loadPattern, savePattern } from '../src/core/pattern-json.ts';
import { readPattern } from '../src/core/pattern-read.ts';
import { formatWrittenPattern, writePattern } from '../src/core/pattern-text.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { validatePattern } from '../src/core/validate.ts';

/** A 04 §4.4 mintasűrűsége: DK pamut, 3,5 mm-es tű; az 5 körös rövidpálcás kör 5 cm. */
const DK = { stitchesPerCm: 1.9, roundsPerCm: 2, source: 'measured' };

/** Minta profillal, amelyben a rövidpálca körben mérve adott szem és kör 10 cm-en. */
function withRoundGauge(stitchesPer10cm, rowsPer10cm, pattern = emptyPattern()) {
  const profile = {
    id: 'dk',
    yarn: { name: 'DK pamut', cycWeight: 3, metersPer100g: null, ballMassG: null },
    hookMm: 3.5,
    blocked: false,
    gauges: [{ stitch: 'sc', form: 'rounds', stitchesPer10cm, rowsPer10cm, source: 'measured' }],
    swatch: { widthCm: null, heightCm: null, massG: null },
  };
  return { ...pattern, gauge: { active: 'dk', profiles: [profile] } };
}

const dkPattern = () => withRoundGauge(19, 20);

const plan = (shape, gauge = DK) => {
  const result = shapeSchedule(shape, gauge);
  assert.ok(result.ok, result.reason);
  return result.schedule;
};
const ok = (result) => {
  assert.ok(result.ok, result.reason);
  return result.pattern;
};
const part = (shape, patch = {}) => ({ name: '', shape, stagger: true, eyes: false, ...patch });
const rules = (pattern) => validatePattern(pattern, libraryFor(pattern)).map((finding) => finding.rule);
const lines = (pattern, locale, piece = 0) => writePattern(pattern, libraryFor(pattern), locale).pieces[piece].lines;
const graphOf = (pattern, piece = 0) => buildPieceGraph(pattern, pattern.pieces[piece], libraryFor(pattern));

const SPHERE_6N = { kind: 'sphere', diameterCm: 6, method: '6n' };
const SPHERE_SINE = { kind: 'sphere', diameterCm: 6, method: 'sine' };
const BODY = { kind: 'cylinder', diameterCm: 5, heightCm: 5, bottom: 'closed', top: 'open' };

/** Fej (6 cm-es 6n gömb) és test (5 cm-es henger, nyitott tetővel), varrva, a DK-mintasűrűséggel. */
function headAndBody(join = { method: 'sewn', distribute: false }, body = BODY) {
  const head = ok(createAmigurumi(dkPattern(), part(SPHERE_6N, { name: 'Fej', eyes: true }), false));
  return addAmigurumiPart(head, part(body, { name: 'Test' }), join, false);
}

describe('mintasűrűség körben (02 §5, 04 §0)', () => {
  test('profil nélkül becslés a tűből: a rövidpálca körben ugyanolyan magas, mint széles, s = 6', () => {
    const gauge = roundGaugeOf(emptyPattern());
    assert.equal(gauge.source, 'estimated');
    assert.ok(Math.abs(gauge.stitchesPerCm - gauge.roundsPerCm) < 1e-9);
    assert.equal(startCount(gauge), 6);
  });

  test('a körben mért mintasűrűségből: 19 szem és 20 kör 10 cm-en', () => {
    const gauge = roundGaugeOf(dkPattern());
    assert.equal(gauge.source, 'measured');
    assert.ok(Math.abs(gauge.stitchesPerCm - 1.9) < 1e-9);
    assert.ok(Math.abs(gauge.roundsPerCm - 2) < 1e-9);
  });
});

describe('a 6 cm-es DK-gömb kidolgozott példája (04 §4.4)', () => {
  test('6n: k = 6, 7 egyenes kör, 18 kör, a szemszámok a példa szerint, átmérő 6,03 cm', () => {
    const ball = plan(SPHERE_6N);
    assert.deepEqual(ball.counts, [6, 12, 18, 24, 30, 36, 36, 36, 36, 36, 36, 36, 36, 30, 24, 18, 12, 6]);
    assert.equal(ball.start, 'ring');
    assert.equal(ball.end, 'closed');
    assert.ok(Math.abs(ball.widthCm - 36 / (Math.PI * 1.9)) < 1e-9);
    assert.equal(ball.widthCm.toFixed(2), '6.03');
  });

  test('az egyenes körök: a 04 §9.2 képlete itt 8-at adna, a bevett k + 1 felé kerekítve 7', () => {
    const exact = 3 * 6 * (2 / 1.9) - (2 * 6 - 1);
    assert.equal(Math.round(exact), 8);
    assert.equal(towardConsensus(7, exact), 7);
    // Egész környi eltérésnél már változik: g_r/g_s = 1,2 mellett 10 egyenes kör.
    assert.equal(towardConsensus(7, 18 * 1.2 - 11), 10);
    assert.equal(towardConsensus(7, 18 * 0.8 - 11), 4);
  });

  test('szinuszos: 19 kör, pontosan a példa horgolható sora, d′ = 6,05 cm', () => {
    const ball = plan(SPHERE_SINE);
    assert.deepEqual(ball.counts, [6, 12, 16, 20, 24, 28, 31, 34, 35, 36, 35, 34, 31, 28, 24, 20, 16, 12, 6]);
    assert.equal(ball.heightCm.toFixed(2), '6.05');
  });

  test('az írott minta angolul a példa szerint; a 15–17. kör utasítását a szemszámhoz igazítottuk', () => {
    // A 04 §4.4 szövegében a 15–17. kör utasítása egy körrel előrébb jár, mint a mellette álló szemszám
    // (pl. „sc, (dec, 2 sc) x5, dec, sc” 24 szemből 18-at ad, nem 30-ból 24-et): a szemszám a mérvadó.
    const pattern = ok(createAmigurumi(dkPattern(), part(SPHERE_6N, { name: 'Ball', eyes: true }), false));
    assert.deepEqual(lines(pattern, 'en-US'), [
      'Magic ring.',
      'Work in a continuous spiral; do not join. Place a marker in first st of rnd and move it up each rnd.',
      'Rnd 1: ch 1 (does not count as a st), 6 sc in ring (6).',
      'Rnd 2: inc x6 (12).',
      'Rnd 3: (sc, inc) x6 (18).',
      'Rnd 4: sc, (inc, 2 sc) x5, inc, sc (24).',
      'Rnd 5: (3 sc, inc) x6 (30).',
      'Rnd 6: 2 sc, (inc, 4 sc) x5, inc, 2 sc (36).',
      'Rnds 7–13: 36 sc (36).',
      'Rnd 14: (4 sc, invdec) x6 (30).',
      'Rnd 15: sc, (invdec, 3 sc) x5, invdec, 2 sc (24). Insert safety eyes. Begin stuffing and keep stuffing until closed.',
      'Rnd 16: (2 sc, invdec) x6 (18).',
      'Rnd 17: (invdec, sc) x6 (12).',
      'Rnd 18: invdec x6 (6). Fasten off. Weave the tail through the front loops of the remaining sts and pull tight.',
    ]);
  });

  test('magyarul: láthatatlan fogyasztás, a szem és a tömés jelölése', () => {
    const pattern = ok(createAmigurumi(dkPattern(), part(SPHERE_6N, { name: 'Fej', eyes: true }), false));
    const hu = lines(pattern, 'hu');
    assert.equal(hu[9], '14. kör: (4 rp, láthatatlan fogyasztás) ×6 (30).');
    assert.equal(
      hu[10],
      '15. kör: 1 rp, (láthatatlan fogyasztás, 3 rp) ×5, láthatatlan fogyasztás, 2 rp (24). Tedd be a biztonsági szemeket. Kezdd el a tömést, és a nyílás bezárásáig tömd tovább.',
    );
    assert.equal(hu.at(-1), '18. kör: (láthatatlan fogyasztás) ×6 (6). A fonal elvágása. A fonalat fűzd át a maradék szemek első szálán, és húzd össze a nyílást.');
  });

  test('a generált gömb hibátlan, a gráf szemszámai a körtervéi, a jelölés a 15. kör után', () => {
    for (const shape of [SPHERE_6N, SPHERE_SINE]) {
      const pattern = ok(createAmigurumi(dkPattern(), part(shape), false));
      assert.deepEqual(rules(pattern), []);
      assert.deepEqual(
        graphOf(pattern).layers.slice(1).map((layer) => layer.stitchCount),
        plan(shape).counts,
      );
    }
    assert.equal(markRound(plan(SPHERE_6N)), 14);
  });
});

describe('formák (04 §4.1–§4.6, §9.3)', () => {
  test('félgömb 6n: k szaporító és k/2 egyenes kör; zárt véggel lapos alj, az első fogyasztó kör hátsó szálba', () => {
    const open = plan({ kind: 'hemisphere', diameterCm: 6, method: '6n', top: 'open' });
    assert.deepEqual(open.counts, [6, 12, 18, 24, 30, 36, 36, 36, 36]);
    assert.equal(open.end, 'open');
    assert.ok(Math.abs(open.heightCm - open.widthCm / 2) < 1e-9);
    const closed = plan({ kind: 'hemisphere', diameterCm: 6, method: '6n', top: 'closed' });
    assert.deepEqual(closed.counts, [...open.counts, 30, 24, 18, 12, 6]);
    assert.deepEqual(closed.backLoop, [9]);
  });

  test('henger lapos aljjal: lapos kör a fal szemszámáig, a fal első köre hátsó szálba (04 §4.1)', () => {
    const tube = plan(BODY);
    assert.deepEqual(tube.counts, [6, 12, 18, 24, 30, ...Array(10).fill(30)]);
    assert.deepEqual(tube.backLoop, [5]);
    assert.equal(tube.start, 'ring');
    assert.equal(tube.end, 'open');
    assert.equal(tube.heightCm, 5);
  });

  test('nyitott kezdésű henger: csak a fal, és önálló részként nem hozható létre', () => {
    const shape = { ...BODY, bottom: 'open' };
    assert.equal(plan(shape).start, 'open');
    const result = createAmigurumi(dkPattern(), part(shape), false);
    assert.equal(result.ok, false);
    assert.match(result.reason, /csak folytatólagosan/);
  });

  test('kúp a magasságból: a csúcstól s-ről egyenletesen az alapig', () => {
    const cone = plan({ kind: 'cone', diameterCm: 5, heightCm: 6, increases: null, top: 'open' });
    assert.deepEqual(cone.counts, [6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30]);
  });

  test('kúp tört szaporítással: 2,5 körönként 3 és 2 váltakozva; zárt aljjal hátsó szálas törés (04 §4.2)', () => {
    const cone = plan({ kind: 'cone', diameterCm: 5, heightCm: 1, increases: 2.5, top: 'closed' });
    assert.deepEqual(cone.counts.slice(0, 11), [6, 9, 11, 14, 16, 19, 21, 24, 26, 29, 30]);
    const changes = cone.counts.slice(1, 10).map((count, i) => count - cone.counts[i]);
    assert.deepEqual(changes, [3, 2, 3, 2, 3, 2, 3, 2, 3]);
    assert.deepEqual(cone.backLoop, [11]);
  });

  test('tojás: mindkét vége zárt, a felső vége lassabban fogy (04 §4.6)', () => {
    const egg = plan({ kind: 'egg', diameterCm: 5, heightCm: 7 });
    assert.equal(egg.start, 'ring');
    assert.equal(egg.end, 'closed');
    const max = Math.max(...egg.counts);
    const up = egg.counts.indexOf(max);
    const down = egg.counts.length - 1 - egg.counts.lastIndexOf(max);
    assert.ok(down > up, `${up} szaporító, ${down} fogyasztó kör`);
    assert.equal(egg.heightCm.toFixed(1), '7.0');
  });

  test('forgástest profilból: a sugár adja a szemszámot, a két éles törés után hátsó szálas kör', () => {
    const profile = [
      { radiusCm: 0, heightCm: 0 },
      { radiusCm: 2.5, heightCm: 0 },
      { radiusCm: 2.5, heightCm: 4 },
      { radiusCm: 0, heightCm: 4 },
    ];
    const lathe = plan({ kind: 'revolution', profile, bottom: 'closed', top: 'closed' });
    assert.equal(Math.max(...lathe.counts), Math.round(2 * Math.PI * 2.5 * 1.9));
    assert.equal(lathe.backLoop.length, 2);
    assert.equal(lathe.start, 'ring');
    assert.equal(lathe.end, 'closed');
  });

  test('forgástest nem nulla sugarú végekkel: lapos alj és nyitott szél', () => {
    const profile = [
      { radiusCm: 2, heightCm: 0 },
      { radiusCm: 2, heightCm: 3 },
    ];
    const lathe = plan({ kind: 'revolution', profile, bottom: 'closed', top: 'open' });
    const wall = Math.round(2 * Math.PI * 2 * 1.9);
    assert.deepEqual(lathe.counts.slice(0, 4), flatUp(wall, 6));
    assert.deepEqual(lathe.backLoop, [4]);
    assert.equal(lathe.end, 'open');
  });

  test('hibás adatnál érthető üzenet, túl nagy formánál a körszám korlátja', () => {
    const reason = (shape) => shapeSchedule(shape, DK).reason;
    assert.equal(reason({ ...SPHERE_6N, diameterCm: Number.NaN }), 'Az átmérő 0 és 100 cm közötti szám lehet.');
    assert.match(reason({ kind: 'cone', diameterCm: 5, heightCm: 5, increases: 20, top: 'open' }), /szaporítás 0 és 12/);
    assert.match(reason({ kind: 'revolution', profile: [{ radiusCm: 1, heightCm: 0 }], bottom: 'closed', top: 'open' }), /legalább két pont/);
    assert.match(reason({ ...SPHERE_6N, diameterCm: 60 }), /legfeljebb 120 kör/);
  });

  test('minden forma hibátlan mintát ad, eltolással és anélkül, becsült és mért mintasűrűséggel', () => {
    const shapes = [
      SPHERE_6N,
      SPHERE_SINE,
      { kind: 'hemisphere', diameterCm: 7, method: '6n', top: 'closed' },
      { kind: 'hemisphere', diameterCm: 7, method: 'sine', top: 'open' },
      { kind: 'egg', diameterCm: 5, heightCm: 7 },
      { kind: 'cylinder', diameterCm: 4, heightCm: 6, bottom: 'closed', top: 'closed' },
      BODY,
      { kind: 'cone', diameterCm: 5, heightCm: 6, increases: null, top: 'closed' },
      { kind: 'cone', diameterCm: 4, heightCm: 1, increases: 1.5, top: 'open' },
      {
        kind: 'revolution',
        profile: [
          { radiusCm: 0, heightCm: 0 },
          { radiusCm: 2.5, heightCm: 1 },
          { radiusCm: 2.5, heightCm: 5 },
          { radiusCm: 0, heightCm: 6 },
        ],
        bottom: 'closed',
        top: 'closed',
      },
    ];
    for (const base of [emptyPattern(), dkPattern()]) {
      for (const shape of shapes) {
        for (const stagger of [true, false]) {
          const pattern = ok(createAmigurumi(base, part(shape, { stagger, eyes: true }), false));
          assert.deepEqual(rules(pattern), [], `${shape.kind}, eltolás: ${stagger}`);
        }
      }
    }
  });
});

describe('korlátok (04 §3, §9.0)', () => {
  test('egy körben legfeljebb duplázás vagy felezés', () => {
    assert.deepEqual(clampGrowth([6, 20, 5]), [6, 12, 6]);
    assert.equal(roundOps(6, 13, false), null);
    assert.equal(roundOps(12, 5, false), null);
  });

  test('a szaporítás és a fogyasztás eltolás nélkül a szakasz végén, eltolva a közepén', () => {
    const times = (unit, n) => Array.from({ length: n }, () => unit).flat();
    assert.deepEqual(roundOps(18, 24, false), times(['sc', 'sc', 'inc'], 6));
    assert.deepEqual(roundOps(18, 24, true), times(['sc', 'inc', 'sc'], 6));
    assert.deepEqual(roundOps(36, 30, false), times(['sc', 'sc', 'sc', 'sc', 'dec'], 6));
    assert.deepEqual(roundOps(30, 24, true), times(['sc', 'dec', 'sc', 'sc'], 6));
    assert.deepEqual(roundOps(10, 10, true), Array(10).fill('sc'));
  });

  test('a harmadik egymás fölötti szaporítás nem kerül az előző kettő fölé', () => {
    const blocked = new Set([1, 2, 5, 6, 9, 10, 13, 14, 17, 18, 21, 22]);
    const ops = roundOps(24, 28, false, (position) => (blocked.has(position) ? 1 : 0));
    let position = 0;
    const increases = [];
    for (const op of ops) {
      if (op === 'inc') increases.push(position);
      position += op === 'dec' ? 2 : 1;
    }
    assert.equal(increases.length, 4);
    assert.ok(increases.every((at) => !blocked.has(at)), increases.join(', '));
  });

  test('a pólus emelése: a gömbnél 3, 9, 14 → 6, 12, 16; a hegyes profilnál a pólus szemszámán marad', () => {
    assert.deepEqual(liftStart([3, 9, 14, 20, 24], 6, 'sphere'), [6, 12, 16, 20, 24]);
    assert.deepEqual(liftStart([1, 3, 5, 7, 9], 6, 'hold'), [6, 6, 6, 7, 9]);
    assert.deepEqual(liftStart([6, 12], 6, 'sphere'), [6, 12]);
  });

  test('lapos alj és tető s-esével, egyenletes elosztás', () => {
    assert.deepEqual(flatUp(28, 6), [6, 12, 18, 24, 28]);
    assert.deepEqual(flatDown(36, 6), [30, 24, 18, 12, 6]);
    assert.deepEqual(flatDown(6, 6), []);
    assert.deepEqual(spread(24, 4), [6, 6, 6, 6]);
    assert.deepEqual(spread(10, 4), [3, 2, 3, 2]);
  });
});

describe('görbület körönként (04 §8, §9.6)', () => {
  test('lapos, kunkorodó, henger, fodros és fogyó', () => {
    const curvature = diagnoseRounds([6, 12, 15, 15, 24, 18], DK).map((round) => round.curvature);
    assert.deepEqual(curvature, ['flat', 'flat', 'cupping', 'tube', 'ruffled', 'closing']);
  });

  test('nyitott kezdésnél az 1. kör az előző szélhez képest számít', () => {
    assert.equal(diagnoseRounds([30], DK, 30)[0].curvature, 'tube');
    assert.equal(diagnoseRounds([30], DK, 36)[0].curvature, 'closing');
  });

  test('a 6n gömb: 1–6. kör lapos, 7–13. henger, 14–18. fogyó', () => {
    const curvature = diagnoseRounds(plan(SPHERE_6N).counts, DK).map((round) => round.curvature);
    assert.deepEqual(curvature, [...Array(6).fill('flat'), ...Array(7).fill('tube'), ...Array(5).fill('closing')]);
  });

  test('a részekből készült darabon a kunkorodás nem figyelmeztet, ugyanaz a körsor részek nélkül igen', () => {
    const pattern = ok(createAmigurumi(dkPattern(), part(SPHERE_6N), false));
    assert.deepEqual(rules(pattern), []);
    const { sections: _sections, ...plain } = pattern.pieces[0];
    assert.ok(rules({ ...pattern, pieces: [plain] }).includes('round-cupping'));
  });
});

describe('részek összekapcsolása (04 §5.4)', () => {
  test('varrva, egyező szemszámmal elosztás nélkül: a test nyitott széle a fej 30 szemes 14. körére', () => {
    const pattern = ok(headAndBody());
    assert.deepEqual(pattern.joins, [{ a: { piece: 'p2', layer: 15 }, b: { piece: 'p1', layer: 14 } }]);
    assert.deepEqual(rules(pattern), []);
    assert.deepEqual(
      pattern.pieces.map((piece) => piece.name),
      ['Fej', 'Test'],
    );
    const written = writePattern(pattern, libraryFor(pattern), 'hu');
    assert.deepEqual(written.assembly, ['Varrás: Test, 15. kör (30) → Fej, 14. kör (30).']);
    assert.match(formatWrittenPattern(written), /\n\nÖsszeállítás\nVarrás: Test, 15\. kör \(30\) → Fej, 14\. kör \(30\)\.\n$/);
  });

  test('varrva, eltérő szemszámmal: elosztás nélkül hiba, egyenletes elosztással átmegy', () => {
    const body = { ...BODY, diameterCm: 4.5 };
    const refused = headAndBody({ method: 'sewn', distribute: false }, body);
    assert.equal(refused.ok, false);
    assert.equal(refused.reason, 'Az új rész 15. körén 27 szem van, az előző rész 15. körén 24. Kapcsold be az egyenletes elosztást, vagy igazítsd a méretet.');

    const pattern = ok(headAndBody({ method: 'sewn', distribute: true }, body));
    assert.deepEqual(pattern.joins[0].distribution, evenDistribution(27, 24));
    assert.deepEqual(rules(pattern), []);
    assert.match(writePattern(pattern, libraryFor(pattern), 'hu').assembly[0], /, a szemeket egyenletesen elosztva\.$/);
  });

  test('az ellenőrző: eltérő szemszám elosztás nélkül és rossz elosztás hiba, nem létező kör is', () => {
    const pattern = ok(headAndBody({ method: 'sewn', distribute: true }, { ...BODY, diameterCm: 4.5 }));
    const [join] = pattern.joins;
    const { distribution: _distribution, ...bare } = join;
    assert.deepEqual(rules({ ...pattern, joins: [bare] }), ['join-count']);
    assert.deepEqual(rules({ ...pattern, joins: [{ ...join, distribution: [1, 2, 3] }] }), ['join-count']);
    assert.deepEqual(rules({ ...pattern, joins: [{ ...join, b: { piece: 'p1', layer: 99 } }] }), ['join-edge']);
    assert.deepEqual(rules({ ...pattern, joins: [{ ...join, b: { piece: 'nincs', layer: 1 } }] }), ['join-edge']);
    const finding = validatePattern({ ...pattern, joins: [bare] }, libraryFor(pattern))[0];
    assert.equal(finding.severity, 'error');
  });

  test('elosztás: a kisebb szél minden szeméhez legalább 1, összesen a nagyobbik szemszáma', () => {
    assert.deepEqual(evenDistribution(18, 24), [2, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1].map((n, i) => spread(24, 18)[i]));
    assert.equal(evenDistribution(24, 18).reduce((sum, n) => sum + n, 0), 24);
    assert.equal(distributionProblem(30, 30, undefined), null);
    assert.match(distributionProblem(30, 24, undefined), /eltér \(30 és 24 szem\)/);
    assert.equal(distributionProblem(24, 30, evenDistribution(24, 30)), null);
    assert.match(distributionProblem(24, 30, [1, 1]), /nem illik/);
  });

  test('folytatólagosan: az új rész az előző nyitott végébe horgol, egy darab két résszel, hibátlanul', () => {
    const head = ok(createAmigurumi(dkPattern(), part({ kind: 'hemisphere', diameterCm: 6, method: '6n', top: 'open' }, { name: 'Fej', eyes: true }), false));
    const body = { kind: 'cylinder', diameterCm: 6, heightCm: 3, bottom: 'open', top: 'closed' };
    const pattern = ok(addAmigurumiPart(head, part(body, { name: 'Test' }), { method: 'continuous', distribute: false }, false));
    assert.equal(pattern.pieces.length, 1);
    assert.equal(pattern.joins, undefined);
    assert.deepEqual(
      pattern.pieces[0].sections.map(({ name, layer }) => ({ name, layer })),
      [
        { name: 'Fej', layer: 1 },
        { name: 'Test', layer: 10 },
      ],
    );
    assert.deepEqual(rules(pattern), []);
    const hu = lines(pattern, 'hu');
    const at = hu.indexOf('Test, folytatólagosan:');
    assert.ok(at > 0, hu.join('\n'));
    assert.match(hu[at - 1], /^9\. kör: /);
    assert.match(hu[at + 1], /^10–15\. kör: 36 rp \(36\)\.$/);
  });

  test('folytatólagosan eltérő szemszámmal hiba, elosztással átmegy; zárt végű részhez és zárt kezdésű résszel nem', () => {
    const head = ok(createAmigurumi(dkPattern(), part({ kind: 'hemisphere', diameterCm: 6, method: '6n', top: 'open' }), false));
    const narrow = { kind: 'cylinder', diameterCm: 5, heightCm: 3, bottom: 'open', top: 'closed' };
    const refused = addAmigurumiPart(head, part(narrow), { method: 'continuous', distribute: false }, false);
    assert.equal(refused.reason, 'Az előző rész utolsó köre 36 szem, az új rész első köre 30 szem. Kapcsold be az egyenletes elosztást, vagy igazítsd a méretet.');
    const pattern = ok(addAmigurumiPart(head, part(narrow), { method: 'continuous', distribute: true }, false));
    assert.equal(graphOf(pattern).layers[10].stitchCount, 30);
    assert.deepEqual(rules(pattern), []);

    const closedHead = ok(createAmigurumi(dkPattern(), part(SPHERE_6N), false));
    assert.match(addAmigurumiPart(closedHead, part(narrow), { method: 'continuous', distribute: true }, false).reason, /nyitott végű részhez/);
    assert.match(addAmigurumiPart(head, part(BODY), { method: 'continuous', distribute: true }, false).reason, /nyitott kezdésű/);
    assert.match(addAmigurumiPart(emptyPattern(), part(BODY), { method: 'sewn', distribute: true }, false).reason, /Előbb hozz létre/);
  });
});

describe('méretbecslés (04 §5.8, §9.7)', () => {
  test('a gömbsüveg: ennyit süllyed a rész a szélbe', () => {
    assert.equal(capHeight(3, 5), 3);
    assert.equal(capHeight(5, 3), 1);
  });

  test('a fej-test figura magassága: a két rész magassága, a varrásnál a fej besüllyed a test szélébe', () => {
    const size = figureSize(ok(headAndBody()));
    const head = 36 / (Math.PI * 1.9);
    const rim = 30 / 1.9 / (2 * Math.PI);
    assert.equal(size.parts.length, 2);
    assert.ok(Math.abs(size.heightCm - (head + 5 - capHeight(head / 2, rim))) < 1e-9);
    assert.ok(Math.abs(size.widthCm - head) < 1e-9);
  });

  test('egyetlen rész: a saját mérete; rész nélkül nincs becslés', () => {
    const size = figureSize(ok(createAmigurumi(dkPattern(), part(SPHERE_6N), false)));
    assert.equal(size.heightCm.toFixed(2), '6.03');
    assert.equal(figureSize(emptyPattern()), null);
  });

  test('folytatólagosan: a részek magassága összeadódik', () => {
    const head = ok(createAmigurumi(dkPattern(), part({ kind: 'hemisphere', diameterCm: 6, method: '6n', top: 'open' }), false));
    const body = { kind: 'cylinder', diameterCm: 6, heightCm: 3, bottom: 'open', top: 'closed' };
    const size = figureSize(ok(addAmigurumiPart(head, part(body), { method: 'continuous', distribute: false }, false)));
    assert.ok(Math.abs(size.heightCm - (36 / (Math.PI * 1.9) / 2 + 3)) < 1e-9);
  });
});

describe('jelölések és játékbiztonság (04 §5.7)', () => {
  test('3 év alatti gyereknek hímzett szem, és nincs figyelmeztetés', () => {
    const pattern = ok(createAmigurumi(dkPattern(), part(SPHERE_6N, { eyes: true }), true));
    const marks = pattern.pieces[0].events.flatMap((event) => event.marks ?? []);
    assert.deepEqual(marks, ['embroider-eyes', 'stuffing', 'close-opening']);
    assert.deepEqual(pattern.toy, { under3: true });
    assert.deepEqual(rules(pattern), []);
    assert.match(lines(pattern, 'hu')[10], /Hímezd ki a szemeket: 3 év alatti gyereknek szánt játékba nem kerülhet biztonsági szem\./);
  });

  test('ha a játék 3 év alattinak jelölt, de biztonsági szem van benne: figyelmeztetés', () => {
    const pattern = ok(createAmigurumi(dkPattern(), part(SPHERE_6N, { eyes: true }), false));
    const findings = validatePattern({ ...pattern, toy: { under3: true } }, libraryFor(pattern));
    assert.deepEqual(
      findings.map(({ rule, severity }) => ({ rule, severity })),
      [{ rule: 'toy-safety-eyes', severity: 'warning' }],
    );
  });

  test('szem nélküli résznél csak a tömés; nyitott végnél az utolsó kör után', () => {
    const pattern = ok(createAmigurumi(dkPattern(), part(BODY), false));
    const events = pattern.pieces[0].events;
    assert.deepEqual(events.at(-1).marks, ['stuffing']);
    assert.equal(events.filter((event) => event.marks).length, 1);
  });
});

describe('visszaolvasás és mentés', () => {
  const patterns = () => [
    ok(createAmigurumi(dkPattern(), part(SPHERE_6N, { eyes: true }), false)),
    ok(createAmigurumi(emptyPattern(), part({ kind: 'cone', diameterCm: 5, heightCm: 6, increases: 2.5, top: 'closed' }), true)),
    ok(headAndBody({ method: 'sewn', distribute: true }, { ...BODY, diameterCm: 4.5 })),
    ok(
      addAmigurumiPart(
        ok(createAmigurumi(dkPattern(), part({ kind: 'hemisphere', diameterCm: 6, method: '6n', top: 'open' }, { name: 'Fej', eyes: true }), false)),
        part({ kind: 'cylinder', diameterCm: 5, heightCm: 3, bottom: 'open', top: 'closed' }, { name: 'Test' }),
        { method: 'continuous', distribute: true },
        false,
      ),
    ),
  ];

  test('az írott minta mindhárom jelöléssel visszaolvasható, a jelölésekkel együtt', () => {
    for (const pattern of patterns()) {
      const library = libraryFor(pattern);
      for (const locale of ['hu', 'en-US', 'en-GB']) {
        const text = formatWrittenPattern(writePattern(pattern, library, locale));
        const result = readPattern(text, { library, locale, conventions: pattern.conventions });
        assert.ok(result.ok, `${pattern.title}, ${locale}: ${JSON.stringify(result.error)}`);
        assert.deepEqual(canonicalPattern(result.pattern).pieces, canonicalPattern(pattern).pieces, `${pattern.title}, ${locale}`);
      }
    }
  });

  test('a részek, a jelölések, a kapcsolás és a játék adatai a mentésben megmaradnak', () => {
    for (const pattern of patterns()) {
      const loaded = loadPattern(savePattern(pattern));
      assert.ok(loaded.ok, JSON.stringify(loaded.error));
      assert.deepEqual(loaded.pattern, pattern);
    }
  });

  test('ismeretlen forma, hibás kapcsolás és jelölés: hiba a mező útvonalával', () => {
    const json = JSON.parse(savePattern(ok(headAndBody())));
    const fails = (edit) => {
      const copy = structuredClone(json);
      edit(copy);
      const result = loadPattern(JSON.stringify(copy));
      assert.equal(result.ok, false);
      return result.error.path;
    };
    assert.equal(fails((p) => (p.pieces[0].sections[0].shape.kind = 'torus')), '$.pieces[0].sections[0].shape.kind');
    assert.equal(fails((p) => (p.joins[0].a.layer = 0)), '$.joins[0].a.layer');
    assert.equal(fails((p) => (p.pieces[0].events[0].marks = ['glitter'])), '$.pieces[0].events[0].marks[0]');
    assert.equal(fails((p) => (p.toy = { under3: 'igen' })), '$.toy.under3');
  });
});
