/*
 * Top-down raglan (PQW-901): worked example C of the knowledge base (05 §4),
 * the underarm chain counting towards both body and sleeve, the separate body
 * increases, and the refusals the planner can return.
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

/** The gauge of worked example C: 15 stitches × 8 rounds / 10 cm. */
const gauge = { stitchCm: 1 / 1.5, rowCm: 1 / 0.8 };

/** The input of worked example C (05 §4 „Worked example C”). */
const C = {
  bustCm: 96,
  easeCm: 8,
  upperArmCm: 33,
  neckCm: 48,
  yokeDepthCm: 20,
  underarmCm: 4,
  bodyLengthCm: 58,
  // The sleeve tube from underarm to cuff (PQW-913): the CYC women M arm length and a cuff derived from the upper arm.
  sleeveLengthCm: 44.5,
  cuffCm: 26,
  hemCm: 5,
};

const planned = (patch = {}) => {
  const plan = raglanPlan({ ...C, ...patch }, gauge);
  // A refusal returns a code and data in place of a plan (PQW-904).
  assert.ok(!('code' in plan), 'code' in plan ? plan.code : '');
  return plan;
};
/** The refusal code. */
const refused = (patch) => {
  const plan = raglanPlan({ ...C, ...patch }, gauge);
  assert.ok('code' in plan, 'the plan came back, but a refusal was expected');
  return plan.code;
};

describe('worked example C: top-down raglan, 96 cm bust, +8 cm ease', () => {
  const plan = planned();

  test('the body is 156 and one sleeve 50 stitches, and the 6-stitch underarm chain counts towards both', () => {
    assert.equal(plan.bodyStitches, 156);
    assert.equal(plan.sleeveStitches, 50);
    assert.equal(plan.underarm, 6);
    // The underarm chain counts towards the body and the sleeve alike (05 §2.3).
    assert.equal(plan.target.front + plan.target.back + 2 * plan.underarm, plan.bodyStitches);
    assert.equal(plan.target.sleeve + plan.underarm, plan.sleeveStitches);
  });

  test('the neck is 72 stitches: 24 front, 24 back and 12 per sleeve', () => {
    assert.deepEqual(plan.neck, { stitches: 72, front: 24, back: 24, sleeve: 12 });
  });

  test('at the divide the front and the back are 72 and each sleeve 44 stitches, after 16 raglan rounds', () => {
    assert.deepEqual(plan.target, { front: 72, back: 72, sleeve: 44 });
    assert.equal(plan.yokeRounds, 16);
    assert.deepEqual(plan.rounds.at(-1), { front: 72, back: 72, sleeve: 44 });
  });

  test('the corner increases leave the body 32 stitches short, so 8 rounds carry a separate body increase', () => {
    // +8 stitches per round across the four corners; that lands the sleeves exactly.
    assert.equal(RAGLAN_PER_ROUND, 8);
    assert.equal(plan.neck.sleeve + 2 * plan.yokeRounds, plan.target.sleeve);
    // The front and the back are 16 stitches short each: +2 on each of 8 rounds.
    assert.equal(plan.target.front - (plan.neck.front + 2 * plan.yokeRounds), 16);
    assert.equal(plan.bodyRounds.length, 8);
    assert.deepEqual(plan.bodyRounds, [2, 4, 6, 8, 10, 12, 14, 16]);
  });

  test('every check passes, and a warning names the missing stitches', () => {
    assert.deepEqual(plan.checks.filter((check) => !check.ok), []);
    const warning = plan.warnings.find((item) => item.code === 'raglan-extra-rounds');
    assert.deepEqual(warning.data, { missing: 32, rounds: 8 });
  });

  test('the finished bust is the planned 104 cm', () => {
    assert.ok(Math.abs(plan.finished.chestCm - 104) < 0.01);
    assert.ok(Math.abs(plan.finished.easeCm - 8) < 0.01);
  });
});

describe('raglan from the generator, with a measured gauge', () => {
  /** The gauge of worked example C as a profile: 15 stitches × 8 rounds / 10 cm, measured in the round. */
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

  test('every check passes for every size from XS to 2X, and the stitch counts never shrink', () => {
    const result = planGarment(withGauge(), { ...options, size: 'M', from: 'XS', to: '2X' });
    assert.ok(result.ok, result.ok ? '' : result.reason.code);
    assert.equal(result.plan.checksPassed, result.plan.checksTotal);
    assert.deepEqual(result.plan.monotonic, []);
  });

  test('at the largest sizes the yoke is too shallow, and the refusal says what to adjust', () => {
    // In the CYC table the armhole depth grows far more slowly than the bust (05 §3.8), so sizes above 3X
    // need a deeper yoke or a different construction.
    const result = planGarment(withGauge(), { ...options, size: '5X', from: '5X', to: '5X' });
    assert.equal(result.ok, false);
    assert.equal(result.reason.code, 'body-short-gauge');
  });

  test('the generated raglan validates cleanly: yoke, divide with underarm chain, body', () => {
    const result = generateGarment(withGauge(), options);
    assert.ok(result.ok, result.ok ? '' : result.reason.code);
    const { pattern, plan } = result;
    const base = plan.sizes[plan.base].plan;
    assert.deepEqual(validatePattern(pattern, libraryFor(pattern)), []);
    assert.equal(pattern.pieces.length, 1);
    assert.equal(pattern.garment.kind, 'raglan');
    // The sleeve stitches are skipped at the divide: they are worked separately.
    assert.equal(pattern.pieces[0].skipped.length, 2 * base.target.sleeve);
    const graph = buildPieceGraph(pattern, pattern.pieces[0], libraryFor(pattern));
    // The yoke rounds, the divide round, the body rounds, and finally the two sleeve tubes down to the cuff (PQW-908, PQW-913).
    assert.equal(graph.layers.length - 1, base.yokeRounds + 1 + base.bodyRoundsBelow + 2 * base.sleeve.rounds);
    // The sleeve decreases down to the cuff stitch count: the last round is the second sleeve cuff.
    assert.equal(graph.layers.at(-1).stitchCount, base.sleeve.cuffStitches, 'the sleeve decreases down to the cuff');
    assert.equal(graph.layers[base.yokeRounds + 2].stitchCount, base.bodyStitches);

    // The sleeves are worked into the skipped stitches of the last yoke round and into the underarm chain of the divide.
    // The first sleeve rounds: only those also hold on to the underarm chain of the divide.
    const sleeves = graph.layers.filter((layer) => layer.alsoBelow === base.yokeRounds + 2);
    assert.equal(sleeves.length, 2, 'two sleeves start from the underarm chain');
    for (const sleeve of sleeves) {
      assert.equal(sleeve.stitchCount, base.sleeveStitches, 'the sleeve circumference matches the plan');
      assert.equal(sleeve.below, base.yokeRounds + 1, 'the sleeve continues from the last yoke round');
      assert.equal(sleeve.alsoBelow, base.yokeRounds + 2, 'the underarm chain comes from the divide round');
      // The base ring (PQW-908): its own skipped stitches and the underarm chain meet at the underarm. The
      // remaining stitches of the two source layers (the body) are not part of the tube, so they stay out of the ring.
      assert.equal(sleeve.basePositions.length, base.sleeveStitches, 'the sleeve base ring matches the plan');
      assert.deepEqual(
        [...new Set(sleeve.basePositions.map((id) => graph.layerOf.get(id)))].sort(),
        [base.yokeRounds + 1, base.yokeRounds + 2],
        'the base ring is made of the two source layers only',
      );
      // Every stitch gets an anchor, and only from the two sources.
      const targets = sleeve.stitches
        .filter((id) => graph.defs.get(id).kind === 'basic')
        .flatMap((id) => graph.nodes.get(id).anchors.map((anchor) => graph.layerOf.get(anchor.id)));
      assert.ok(targets.length > 0);
      assert.deepEqual([...new Set(targets)].sort(), [base.yokeRounds + 1, base.yokeRounds + 2]);
    }
  });

  test('the yoke is a cone: the chart is circle-based, and the four raglan lines are not motif corners', () => {
    const result = generateGarment(withGauge(), options);
    assert.ok(result.ok, result.ok ? '' : result.reason);
    const { pattern } = result;
    // The four raglan lines stay increase points: flat growth is measured against them.
    assert.equal(pattern.pieces[0].corners, 4);
    assert.equal(pattern.pieces[0].roundShape.kind, 'cone');
    // The chart stays circle-based (PQW-908): pulled onto a cornered frame it came out square, while the
    // yoke is really a cone running all the way round. A flat circle has no frame (PQW-888); only a polygon does.
    // The frames of the other round charts (circle, motif, amigurumi) are untouched by this.
    const chart = layoutPattern(pattern, libraryFor(pattern));
    assert.equal(chart.frame, undefined);
    // One round of the yoke: every stitch sits nearly the same distance from the centre. On a square frame
    // the corner and the middle of a side would differ by a factor of root two, so this check would fail.
    const yoke = [...chart.nodes.values()].filter((node) => node.layer === 8 && node.role === 'stitch');
    assert.ok(yoke.length > 20, `stitches on round 8: ${yoke.length}`);
    const radii = yoke.map((node) => Math.hypot(node.top.x, node.top.y));
    const min = Math.min(...radii);
    const max = Math.max(...radii);
    assert.ok(max / min < 1.1, `the yoke round is not circular: ${min.toFixed(1)}–${max.toFixed(1)}`);
  });

  test('the „Méretek” block of the written pattern lists the raglan numbers', () => {
    const result = generateGarment(withGauge(), options);
    assert.ok(result.ok, result.ok ? '' : result.reason.code);
    const text = formatWrittenPattern(writePattern(result.pattern, libraryFor(result.pattern), 'hu'));
    assert.match(text, /Nyak: \d+ \(\d+, \d+\) lsz körbe zárva/);
    assert.match(text, /Raglán: \d+ \(\d+, \d+\) kör, körönként a négy raglánvonal mellett szaporítva/);
    assert.match(text, /Szétosztás: elöl és hátul \d+ \(\d+, \d+\) szem/);
  });

  test('with an estimated gauge the refusal for the large sizes still names the fix', () => {
    const result = planGarment(emptyPattern(), options);
    assert.equal(result.ok, false);
    // In a size run the size id travels together with the reason code.
    assert.equal(result.reason.code, 'size-problem');
    assert.equal(result.reason.data.inner, 'body-short-gauge');
  });
});

describe('the raglan refusals', () => {
  test('too deep a yoke: the sections overshoot their target', () => {
    assert.equal(refused({ yokeDepthCm: 40 }), 'yoke-body-many');
  });

  test('too shallow a yoke: the corner increases do not add up to a sleeve', () => {
    assert.equal(refused({ yokeDepthCm: 4 }), 'yoke-sleeve-few');
  });

  test('it refuses to plan more than 15% negative ease', () => {
    assert.equal(refused({ easeCm: -20 }), 'negative-ease-bust');
  });

  test('the body length has to exceed the yoke depth', () => {
    assert.equal(refused({ bodyLengthCm: 21 }), 'body-length-yoke');
  });
});

describe('the sleeve tube from underarm to cuff (PQW-913)', () => {
  const plan = planned();

  test('the sleeve of worked example C is 36 rounds with a 40-stitch cuff and 5 decrease rounds', () => {
    // 44.5 cm arm length / 1.25 cm per round = 35.6 → rounded to an even round count; the cuff is 26 cm / 0.67 cm, rounded up to even.
    assert.equal(plan.sleeve.rounds, 36);
    assert.equal(plan.sleeve.cuffStitches, 40);
    assert.equal(plan.sleeve.decreases, 5);
  });

  test('the cuff plus the decreases add back up to the sleeve circumference at the divide', () => {
    assert.equal(plan.sleeve.cuffStitches + 2 * plan.sleeve.decreases, plan.sleeveStitches);
    assert.equal(plan.sleeve.decreaseRounds.length, plan.sleeve.decreases);
    assert.equal(plan.checks.find((check) => check.id === 'raglan-sleeve').ok, true);
  });

  test('the decreases start after the divide round, and the cuff rounds stay straight', () => {
    const shaped = plan.sleeve.rounds - plan.sleeve.cuffRounds;
    assert.ok(
      plan.sleeve.decreaseRounds.every((round) => round >= 2 && round <= shaped),
      plan.sleeve.decreaseRounds.join(', '),
    );
    // Evenly spread: the gaps differ from each other by at most one round (05 §4.4).
    const gaps = plan.sleeve.decreaseRounds.slice(1).map((round, i) => round - plan.sleeve.decreaseRounds[i]);
    assert.ok(Math.max(...gaps) - Math.min(...gaps) <= 1, gaps.join(', '));
  });

  test('the cuff arithmetic adds up for every size in the men size run', () => {
    const profile = {
      id: 'meres',
      yarn: { name: 'Pamut', cycWeight: 4, metersPer100g: null, ballMassG: null },
      hookMm: 5,
      blocked: false,
      gauges: [{ stitch: 'dc', form: 'rounds', stitchesPer10cm: 15, rowsPer10cm: 8, source: 'measured' }],
      swatch: { widthCm: null, heightCm: null, massG: null },
    };
    const pattern = { ...emptyPattern(), gauge: { active: 'meres', profiles: [profile] } };
    const result = planGarment(pattern, { ...DEFAULT_GARMENT, kind: 'raglan', table: 'men', size: 'M', from: 'S', to: '2X' });
    assert.ok(result.ok, result.ok ? '' : JSON.stringify(result.reason));
    for (const entry of result.plan.sizes) {
      const size = entry.plan;
      assert.equal(size.sleeve.cuffStitches + 2 * size.sleeve.decreases, size.sleeveStitches, entry.id);
      assert.equal(size.sleeve.decreaseRounds.length, size.sleeve.decreases, entry.id);
      assert.equal(size.checks.find((check) => check.id === 'raglan-sleeve').ok, true, entry.id);
    }
  });
});

describe('ribbed hem and cuff on the raglan (PQW-913)', () => {
  const measured = () => {
    const profile = {
      id: 'meres',
      yarn: { name: 'Pamut', cycWeight: 4, metersPer100g: null, ballMassG: null },
      hookMm: 5,
      blocked: false,
      gauges: [{ stitch: 'dc', form: 'rounds', stitchesPer10cm: 15, rowsPer10cm: 8, source: 'measured' }],
      swatch: { widthCm: null, heightCm: null, massG: null },
    };
    return { ...emptyPattern(), gauge: { active: 'meres', profiles: [profile] } };
  };
  const made = (ribbing) => {
    const result = generateGarment(measured(), { ...DEFAULT_GARMENT, kind: 'raglan', ribbing });
    assert.ok(result.ok, result.ok ? '' : JSON.stringify(result.reason));
    return result;
  };
  const written = (pattern) => formatWrittenPattern(writePattern(pattern, libraryFor(pattern), 'hu'));

  test('the ribbed piece validates cleanly, and its stitch counts match the plain piece', () => {
    const plainPiece = made(null);
    const ribbedPiece = made({ rows: 2, width: 1 });
    assert.deepEqual(validatePattern(ribbedPiece.pattern, libraryFor(ribbedPiece.pattern)), []);
    const counts = (result) => {
      const pattern = result.pattern;
      const graph = buildPieceGraph(pattern, pattern.pieces[0], libraryFor(pattern));
      return graph.layers.map((layer) => layer.stitchCount);
    };
    // A post stitch wraps the dc without using up its top: the stitch counts stay identical throughout.
    assert.deepEqual(counts(ribbedPiece), counts(plainPiece));
  });

  test('the body hem and the cuff are written out as a repeat of post stitches', () => {
    const text = written(made({ rows: 2, width: 1 }).pattern);
    const ribbed = text.split('\n').filter((line) => /^\d+([–-]\d+)?\. kör:/.test(line) && /Eerp|Herp/.test(line));
    // The body hem and the two sleeve cuffs: at least three ribbed rounds.
    assert.ok(ribbed.length >= 3, ribbed.join('\n'));
    // The turning chain of a ribbed round is a turning chain, and the ribbing stands as a repeat.
    assert.ok(ribbed.every((line) => line.includes('fordulólánc')), ribbed.join('\n'));
    assert.ok(
      ribbed.some((line) => /\(1 (Eerp|Herp), 1 (Eerp|Herp)\) ×\d+/.test(line)),
      ribbed.join('\n'),
    );
  });

  test('without ribbing the pattern holds no post stitches', () => {
    assert.doesNotMatch(written(made(null).pattern), /Eerp|Herp/);
  });
});
