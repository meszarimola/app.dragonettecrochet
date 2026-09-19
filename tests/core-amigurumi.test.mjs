/*
 * Amigurumi and 3D shapes (PQW-863): the round plan from the gauge measured in
 * the round (04 §4, §9.2, §9.3), the worked example of the 6 cm DK ball
 * (04 §4.4), the limits, curvature round by round, size estimation, joining
 * parts, the notes in the written pattern, reading back and saving.
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
import { AMIGURUMI_CORE_TEXTS } from '../src/ui/i18n/core/amigurumi.ts';
import { renderCoreText } from '../src/ui/i18n/core/render.ts';

/** The gauge of 04 §4.4: DK cotton, 3.5 mm hook; the 5-round single crochet circle is 5 cm. */
const DK = { stitchesPerCm: 1.9, roundsPerCm: 2, source: 'measured', hookMm: 3.5 };

/** A pattern with a profile whose single crochet, measured in the round, has the given stitches and rounds over 10 cm. */
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

/** The core returns a code and data (PQW-904); the Hungarian sentence comes from the UI dictionary. */
const hu = (message) => renderCoreText(AMIGURUMI_CORE_TEXTS.hu, message);
const why = (result) => (result.ok ? '' : typeof result.reason === 'string' ? result.reason : hu(result.reason));

const plan = (shape, gauge = DK) => {
  const result = shapeSchedule(shape, gauge);
  assert.ok(result.ok, why(result));
  return result.schedule;
};
const ok = (result) => {
  assert.ok(result.ok, why(result));
  return result.pattern;
};
const part = (shape, patch = {}) => ({ name: '', shape, stagger: true, eyes: false, ...patch });
const rules = (pattern) => validatePattern(pattern, libraryFor(pattern)).map((finding) => finding.rule);
const lines = (pattern, locale, piece = 0) => writePattern(pattern, libraryFor(pattern), locale).pieces[piece].lines;
const graphOf = (pattern, piece = 0) => buildPieceGraph(pattern, pattern.pieces[piece], libraryFor(pattern));

const SPHERE_6N = { kind: 'sphere', diameterCm: 6, method: '6n' };
const SPHERE_SINE = { kind: 'sphere', diameterCm: 6, method: 'sine' };
const BODY = { kind: 'cylinder', diameterCm: 5, heightCm: 5, bottom: 'closed', top: 'open' };

/** Head (6 cm 6n sphere) and body (5 cm cylinder with an open top), sewn, on the DK gauge. */
function headAndBody(join = { method: 'sewn', distribute: false }, body = BODY) {
  const head = ok(createAmigurumi(dkPattern(), part(SPHERE_6N, { name: 'Fej', eyes: true }), false));
  return addAmigurumiPart(head, part(body, { name: 'Test' }), join, false);
}

describe('gauge in the round (02 §5, 04 §0)', () => {
  test('without a profile the gauge is estimated from the hook: in the round a single crochet is as tall as it is wide, s = 6', () => {
    const gauge = roundGaugeOf(emptyPattern());
    assert.equal(gauge.source, 'estimated');
    assert.ok(Math.abs(gauge.stitchesPerCm - gauge.roundsPerCm) < 1e-9);
    assert.equal(startCount(gauge), 6);
  });

  test('from the gauge measured in the round: 19 stitches and 20 rounds over 10 cm', () => {
    const gauge = roundGaugeOf(dkPattern());
    assert.equal(gauge.source, 'measured');
    assert.ok(Math.abs(gauge.stitchesPerCm - 1.9) < 1e-9);
    assert.ok(Math.abs(gauge.roundsPerCm - 2) < 1e-9);
  });
});

describe('the worked example of the 6 cm DK ball (04 §4.4)', () => {
  test('6n: k = 6, 7 straight rounds, 18 rounds in all, stitch counts as in the example, diameter 6.03 cm', () => {
    const ball = plan(SPHERE_6N);
    assert.deepEqual(ball.counts, [6, 12, 18, 24, 30, 36, 36, 36, 36, 36, 36, 36, 36, 30, 24, 18, 12, 6]);
    assert.equal(ball.start, 'ring');
    assert.equal(ball.end, 'closed');
    assert.ok(Math.abs(ball.widthCm - 36 / (Math.PI * 1.9)) < 1e-9);
    assert.equal(ball.widthCm.toFixed(2), '6.03');
  });

  test('straight rounds: the 04 §9.2 formula would give 8 here, rounded toward the customary k + 1 it is 7', () => {
    const exact = 3 * 6 * (2 / 1.9) - (2 * 6 - 1);
    assert.equal(Math.round(exact), 8);
    assert.equal(towardConsensus(7, exact), 7);
    // A whole round of difference does change it: at g_r/g_s = 1.2 there are 10 straight rounds.
    assert.equal(towardConsensus(7, 18 * 1.2 - 11), 10);
    assert.equal(towardConsensus(7, 18 * 0.8 - 11), 4);
  });

  test('sine method: 19 rounds, exactly the workable sequence of the example, d′ = 6.05 cm', () => {
    const ball = plan(SPHERE_SINE);
    assert.deepEqual(ball.counts, [6, 12, 16, 20, 24, 28, 31, 34, 35, 36, 35, 34, 31, 28, 24, 20, 16, 12, 6]);
    assert.equal(ball.heightCm.toFixed(2), '6.05');
  });

  test('the written pattern in English follows the example; the instruction for rounds 15–17 was aligned to the stitch count', () => {
    // In the text of 04 §4.4 the instruction for rounds 15–17 runs one round ahead of the stitch count
    // printed beside it (e.g. "sc, (dec, 2 sc) x5, dec, sc" turns 24 stitches into 18, not 30 into 24):
    // the stitch count is what governs.
    const pattern = ok(createAmigurumi(dkPattern(), part(SPHERE_6N, { name: 'Ball', eyes: true }), false));
    assert.deepEqual(lines(pattern, 'en-US'), [
      'Magic ring.',
      'Work in a continuous spiral; do not join. Place a marker in first st of rnd and move it up each rnd.',
      'Rnd 1: ch 1 (turning chain), 6 sc in ring (6).',
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

  test('in Hungarian: invisible decrease, and the eye and stuffing notes', () => {
    const pattern = ok(createAmigurumi(dkPattern(), part(SPHERE_6N, { name: 'Fej', eyes: true }), false));
    const hu = lines(pattern, 'hu');
    assert.equal(hu[9], '14. kör: (4 rp, láthatatlan fogyasztás) ×6 (30).');
    assert.equal(
      hu[10],
      '15. kör: 1 rp, (láthatatlan fogyasztás, 3 rp) ×5, láthatatlan fogyasztás, 2 rp (24). Tedd be a biztonsági szemeket. Kezdd el a tömést, és a nyílás bezárásáig tömd tovább.',
    );
    assert.equal(hu.at(-1), '18. kör: (láthatatlan fogyasztás) ×6 (6). A fonal elvágása. A fonalat fűzd át a maradék szemek első szálán, és húzd össze a nyílást.');
  });

  test('the generated sphere is error-free, the graph stitch counts match the round plan, and the note lands on round 15', () => {
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

describe('shapes (04 §4.1–§4.6, §9.3)', () => {
  test('hemisphere 6n: k increase rounds and k/2 straight rounds; a closed end gives a flat base with the first decrease round in the back loop', () => {
    const open = plan({ kind: 'hemisphere', diameterCm: 6, method: '6n', top: 'open' });
    assert.deepEqual(open.counts, [6, 12, 18, 24, 30, 36, 36, 36, 36]);
    assert.equal(open.end, 'open');
    assert.ok(Math.abs(open.heightCm - open.widthCm / 2) < 1e-9);
    const closed = plan({ kind: 'hemisphere', diameterCm: 6, method: '6n', top: 'closed' });
    assert.deepEqual(closed.counts, [...open.counts, 30, 24, 18, 12, 6]);
    assert.deepEqual(closed.backLoop, [9]);
  });

  test('cylinder with a flat base: a flat circle up to the wall stitch count, the first wall round in the back loop (04 §4.1)', () => {
    const tube = plan(BODY);
    assert.deepEqual(tube.counts, [6, 12, 18, 24, 30, ...Array(10).fill(30)]);
    assert.deepEqual(tube.backLoop, [5]);
    assert.equal(tube.start, 'ring');
    assert.equal(tube.end, 'open');
    assert.equal(tube.heightCm, 5);
  });

  test('cylinder with an open start: the wall only, and it cannot be created as a standalone part', () => {
    const shape = { ...BODY, bottom: 'open' };
    assert.equal(plan(shape).start, 'open');
    const result = createAmigurumi(dkPattern(), part(shape), false);
    assert.equal(result.ok, false);
    assert.equal(result.reason.code, 'open-start-piece');
  });

  test('cone from the height: increasing evenly from s at the tip down to the base', () => {
    const cone = plan({ kind: 'cone', diameterCm: 5, heightCm: 6, increases: null, top: 'open' });
    assert.deepEqual(cone.counts, [6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30]);
  });

  test('cone with a fractional increase rate: 3 and 2 alternating every 2.5 rounds; a closed base gives a back-loop crease (04 §4.2)', () => {
    const cone = plan({ kind: 'cone', diameterCm: 5, heightCm: 1, increases: 2.5, top: 'closed' });
    assert.deepEqual(cone.counts.slice(0, 11), [6, 9, 11, 14, 16, 19, 21, 24, 26, 29, 30]);
    const changes = cone.counts.slice(1, 10).map((count, i) => count - cone.counts[i]);
    assert.deepEqual(changes, [3, 2, 3, 2, 3, 2, 3, 2, 3]);
    assert.deepEqual(cone.backLoop, [11]);
  });

  test('egg: both ends closed, the top end decreasing more slowly (04 §4.6)', () => {
    const egg = plan({ kind: 'egg', diameterCm: 5, heightCm: 7 });
    assert.equal(egg.start, 'ring');
    assert.equal(egg.end, 'closed');
    const max = Math.max(...egg.counts);
    const up = egg.counts.indexOf(max);
    const down = egg.counts.length - 1 - egg.counts.lastIndexOf(max);
    assert.ok(down > up, `${up} increase rounds, ${down} decrease rounds`);
    assert.equal(egg.heightCm.toFixed(1), '7.0');
  });

  test('solid of revolution from a profile: the radius sets the stitch count, with a back-loop round after each of the two sharp corners', () => {
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

  test('solid of revolution with non-zero radii at both ends: a flat base and an open rim', () => {
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

  test('invalid input gives an understandable message, an oversized shape hits the round limit', () => {
    const reason = (shape) => shapeSchedule(shape, DK).reason;
    // The core returns a code and data; the field name and the article belong to the dictionary (PQW-904).
    assert.deepEqual(reason({ ...SPHERE_6N, diameterCm: Number.NaN }), { code: 'size-range', data: { field: 'diameter', max: 100 } });
    assert.equal(hu(reason({ ...SPHERE_6N, diameterCm: Number.NaN })), 'Az átmérő 0 és 100 cm közötti szám lehet.');
    assert.equal(reason({ kind: 'cone', diameterCm: 5, heightCm: 5, increases: 20, top: 'open' }).code, 'cone-increases-range');
    assert.match(hu(reason({ kind: 'cone', diameterCm: 5, heightCm: 5, increases: 20, top: 'open' })), /szaporítás 0 és 12/);
    assert.equal(reason({ kind: 'revolution', profile: [{ radiusCm: 1, heightCm: 0 }], bottom: 'closed', top: 'open' }).code, 'profile-points');
    assert.equal(reason({ ...SPHERE_6N, diameterCm: 60 }).code, 'too-many-rounds');
    assert.match(hu(reason({ ...SPHERE_6N, diameterCm: 60 })), /legfeljebb 120 kör/);
  });

  test('every shape produces an error-free pattern, with and without stagger, on estimated and measured gauge', () => {
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
          assert.deepEqual(rules(pattern), [], `${shape.kind}, stagger: ${stagger}`);
        }
      }
    }
  });
});

describe('limits (04 §3, §9.0)', () => {
  test('a single round may at most double or halve the stitch count', () => {
    assert.deepEqual(clampGrowth([6, 20, 5]), [6, 12, 6]);
    assert.equal(roundOps(6, 13, false), null);
    assert.equal(roundOps(12, 5, false), null);
  });

  test('without stagger the increase and the decrease sit at the end of the segment, staggered they sit in its middle', () => {
    const times = (unit, n) => Array.from({ length: n }, () => unit).flat();
    assert.deepEqual(roundOps(18, 24, false), times(['sc', 'sc', 'inc'], 6));
    assert.deepEqual(roundOps(18, 24, true), times(['sc', 'inc', 'sc'], 6));
    assert.deepEqual(roundOps(36, 30, false), times(['sc', 'sc', 'sc', 'sc', 'dec'], 6));
    assert.deepEqual(roundOps(30, 24, true), times(['sc', 'dec', 'sc', 'sc'], 6));
    assert.deepEqual(roundOps(10, 10, true), Array(10).fill('sc'));
  });

  test('a third increase is not stacked on top of the previous two', () => {
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

  test('lifting the pole: on a sphere 3, 9, 14 → 6, 12, 16; on a pointed profile it stays at the pole stitch count', () => {
    assert.deepEqual(liftStart([3, 9, 14, 20, 24], 6, 'sphere'), [6, 12, 16, 20, 24]);
    assert.deepEqual(liftStart([1, 3, 5, 7, 9], 6, 'hold'), [6, 6, 6, 7, 9]);
    assert.deepEqual(liftStart([6, 12], 6, 'sphere'), [6, 12]);
  });

  test('flat base and top grow in steps of s, spread evenly', () => {
    assert.deepEqual(flatUp(28, 6), [6, 12, 18, 24, 28]);
    assert.deepEqual(flatDown(36, 6), [30, 24, 18, 12, 6]);
    assert.deepEqual(flatDown(6, 6), []);
    assert.deepEqual(spread(24, 4), [6, 6, 6, 6]);
    assert.deepEqual(spread(10, 4), [3, 2, 3, 2]);
  });
});

describe('curvature round by round (04 §8, §9.6)', () => {
  test('flat, cupping, tube, ruffled and closing', () => {
    const curvature = diagnoseRounds([6, 12, 15, 15, 24, 18], DK).map((round) => round.curvature);
    assert.deepEqual(curvature, ['flat', 'flat', 'cupping', 'tube', 'ruffled', 'closing']);
  });

  test('with an open start, round 1 is judged against the previous rim', () => {
    assert.equal(diagnoseRounds([30], DK, 30)[0].curvature, 'tube');
    assert.equal(diagnoseRounds([30], DK, 36)[0].curvature, 'closing');
  });

  test('the 6n sphere: rounds 1–6 flat, 7–13 tube, 14–18 closing', () => {
    const curvature = diagnoseRounds(plan(SPHERE_6N).counts, DK).map((round) => round.curvature);
    assert.deepEqual(curvature, [...Array(6).fill('flat'), ...Array(7).fill('tube'), ...Array(5).fill('closing')]);
  });

  test('cupping raises no warning on a piece built from parts, while the same round sequence without parts does', () => {
    const pattern = ok(createAmigurumi(dkPattern(), part(SPHERE_6N), false));
    assert.deepEqual(rules(pattern), []);
    const { sections: _sections, ...plain } = pattern.pieces[0];
    assert.ok(rules({ ...pattern, pieces: [plain] }).includes('round-cupping'));
  });
});

describe('joining parts (04 §5.4)', () => {
  test('sewn with matching counts and no distribution: the open edge of the body meets the 30-stitch round 14 of the head', () => {
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

  test('sewn with differing counts: an error without distribution, passing with even distribution', () => {
    const body = { ...BODY, diameterCm: 4.5 };
    const refused = headAndBody({ method: 'sewn', distribute: false }, body);
    assert.equal(refused.ok, false);
    assert.equal(refused.reason.code, 'sewn-count-differs');
    assert.equal(hu(refused.reason), 'Az új rész 15. körén 27 szem van, az előző rész 15. körén 24. Kapcsold be az egyenletes elosztást, vagy igazítsd a méretet.');

    const pattern = ok(headAndBody({ method: 'sewn', distribute: true }, body));
    assert.deepEqual(pattern.joins[0].distribution, evenDistribution(27, 24));
    assert.deepEqual(rules(pattern), []);
    assert.match(writePattern(pattern, libraryFor(pattern), 'hu').assembly[0], /, a szemeket egyenletesen elosztva\.$/);
  });

  test('validation: a differing count without distribution, a wrong distribution and a non-existent round are all errors', () => {
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

  test('distribution: at least 1 for every stitch of the smaller edge, summing to the larger count', () => {
    assert.deepEqual(evenDistribution(18, 24), [2, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1].map((n, i) => spread(24, 18)[i]));
    assert.equal(evenDistribution(24, 18).reduce((sum, n) => sum + n, 0), 24);
    assert.equal(distributionProblem(30, 30, undefined), null);
    assert.equal(distributionProblem(30, 24, undefined).code, 'join-count-differs');
    assert.match(hu(distributionProblem(30, 24, undefined)), /eltér \(30 és 24 szem\)/);
    assert.equal(distributionProblem(24, 30, evenDistribution(24, 30)), null);
    assert.equal(distributionProblem(24, 30, [1, 1]).code, 'distribution-mismatch');
    assert.match(hu(distributionProblem(24, 30, [1, 1])), /nem illik/);
  });

  test('continuous: the new part works into the open end of the previous one, one piece with two sections, error-free', () => {
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

  test('continuous with differing counts is an error and passes with distribution; it is refused onto a closed end and with a closed-start part', () => {
    const head = ok(createAmigurumi(dkPattern(), part({ kind: 'hemisphere', diameterCm: 6, method: '6n', top: 'open' }), false));
    const narrow = { kind: 'cylinder', diameterCm: 5, heightCm: 3, bottom: 'open', top: 'closed' };
    const refused = addAmigurumiPart(head, part(narrow), { method: 'continuous', distribute: false }, false);
    assert.equal(refused.reason.code, 'continuous-count-differs');
    assert.equal(hu(refused.reason), 'Az előző rész utolsó köre 36 szem, az új rész első köre 30 szem. Kapcsold be az egyenletes elosztást, vagy igazítsd a méretet.');
    const pattern = ok(addAmigurumiPart(head, part(narrow), { method: 'continuous', distribute: true }, false));
    assert.equal(graphOf(pattern).layers[10].stitchCount, 30);
    assert.deepEqual(rules(pattern), []);

    const closedHead = ok(createAmigurumi(dkPattern(), part(SPHERE_6N), false));
    assert.equal(addAmigurumiPart(closedHead, part(narrow), { method: 'continuous', distribute: true }, false).reason.code, 'continuous-closed-end');
    assert.equal(addAmigurumiPart(head, part(BODY), { method: 'continuous', distribute: true }, false).reason.code, 'continuous-needs-open-start');
    const first = addAmigurumiPart(emptyPattern(), part(BODY), { method: 'sewn', distribute: true }, false);
    assert.equal(first.reason.code, 'no-previous-piece');
    // The button name belongs to the UI: it enters the sentence from the dictionary (PQW-904).
    assert.match(hu(first.reason), /^Előbb hozz létre egy részt az „Új minta ebből” gombbal/);
  });
});

describe('size estimation (04 §5.8, §9.7)', () => {
  test('the spherical cap: how deep a part sinks into the rim', () => {
    assert.equal(capHeight(3, 5), 3);
    assert.equal(capHeight(5, 3), 1);
  });

  test('the height of a head-and-body figure: the two part heights, with the head sinking into the body rim at the seam', () => {
    const size = figureSize(ok(headAndBody()));
    const head = 36 / (Math.PI * 1.9);
    const rim = 30 / 1.9 / (2 * Math.PI);
    assert.equal(size.parts.length, 2);
    assert.ok(Math.abs(size.heightCm - (head + 5 - capHeight(head / 2, rim))) < 1e-9);
    assert.ok(Math.abs(size.widthCm - head) < 1e-9);
  });

  test('a single part: its own size; with no part at all there is no estimate', () => {
    const size = figureSize(ok(createAmigurumi(dkPattern(), part(SPHERE_6N), false)));
    assert.equal(size.heightCm.toFixed(2), '6.03');
    assert.equal(figureSize(emptyPattern()), null);
  });

  test('continuous: the part heights add up', () => {
    const head = ok(createAmigurumi(dkPattern(), part({ kind: 'hemisphere', diameterCm: 6, method: '6n', top: 'open' }), false));
    const body = { kind: 'cylinder', diameterCm: 6, heightCm: 3, bottom: 'open', top: 'closed' };
    const size = figureSize(ok(addAmigurumiPart(head, part(body), { method: 'continuous', distribute: false }, false)));
    assert.ok(Math.abs(size.heightCm - (36 / (Math.PI * 1.9) / 2 + 3)) < 1e-9);
  });
});

describe('notes and toy safety (04 §5.7)', () => {
  test('for a child under 3 the eyes are embroidered, and there is no warning', () => {
    const pattern = ok(createAmigurumi(dkPattern(), part(SPHERE_6N, { eyes: true }), true));
    const marks = pattern.pieces[0].events.flatMap((event) => event.marks ?? []);
    assert.deepEqual(marks, ['embroider-eyes', 'stuffing', 'close-opening']);
    assert.deepEqual(pattern.toy, { under3: true });
    assert.deepEqual(rules(pattern), []);
    assert.match(lines(pattern, 'hu')[10], /Hímezd ki a szemeket: 3 év alatti gyereknek szánt játékba nem kerülhet biztonsági szem\./);
  });

  test('a toy marked for under 3 that still has safety eyes raises a warning', () => {
    const pattern = ok(createAmigurumi(dkPattern(), part(SPHERE_6N, { eyes: true }), false));
    const findings = validatePattern({ ...pattern, toy: { under3: true } }, libraryFor(pattern));
    assert.deepEqual(
      findings.map(({ rule, severity }) => ({ rule, severity })),
      [{ rule: 'toy-safety-eyes', severity: 'warning' }],
    );
  });

  test('a part without eyes gets the stuffing note only, after the last round when the end is open', () => {
    const pattern = ok(createAmigurumi(dkPattern(), part(BODY), false));
    const events = pattern.pieces[0].events;
    assert.deepEqual(events.at(-1).marks, ['stuffing']);
    assert.equal(events.filter((event) => event.marks).length, 1);
  });
});

describe('reading back and saving', () => {
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

  test('the written pattern reads back in all three notations, notes included', () => {
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

  test('parts, notes, joins and toy data all survive a save', () => {
    for (const pattern of patterns()) {
      const loaded = loadPattern(savePattern(pattern));
      assert.ok(loaded.ok, JSON.stringify(loaded.error));
      assert.deepEqual(loaded.pattern, pattern);
    }
  });

  test('an unknown shape, a bad join and a bad note each fail with the field path', () => {
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
