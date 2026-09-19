/*
 * Garments (PQW-866): the basics of the schematic maths (05 §4.2–4.5), the
 * knowledge base's worked example „B” (drop-shoulder sweater) and „D” (hat),
 * the size-series checks for every size, the soundness of the generated
 * pattern, the seams, the size-series text, saving, and yarn per size.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { WOMEN } from '../src/core/body-sizes.ts';
import { emptyPattern } from '../src/core/editor.ts';
import {
  evenIncreases,
  eventRows,
  mirrorShaping,
  reversedEventRows,
  roundEven,
  roundToRepeat,
  shapingRuns,
  slopeSchedule,
} from '../src/core/garment-math.ts';
import {
  DEFAULT_GARMENT,
  DEFAULT_HAT,
  dropShoulderMeasures,
  dropShoulderPlan,
  generateGarment,
  garmentSizes,
  hatPlan,
  neckSplitRow,
  planGarment,
  sleeveRowsOf,
} from '../src/core/garments.ts';
import { buildPieceGraph } from '../src/core/graph.ts';
import { canonicalPattern } from '../src/core/canonical.ts';
import { loadPattern, savePattern } from '../src/core/pattern-json.ts';
import { readPattern } from '../src/core/pattern-read.ts';
import { formatWrittenPattern, writePattern } from '../src/core/pattern-text.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { validatePattern } from '../src/core/validate.ts';

const gauge = { stitchCm: 1 / 1.5, rowCm: 1 / 0.8 };
const dc = { turningChain: 3, counting: true, tradition: 'cyc' };
const options = (patch) => ({ ...DEFAULT_GARMENT, ...patch });
const hat = (patch) => ({ ...DEFAULT_HAT, ...patch });
const findings = (pattern) => validatePattern(pattern, libraryFor(pattern));
const generated = (opts, pattern = emptyPattern()) => {
  const result = generateGarment(pattern, opts);
  assert.ok(result.ok, result.ok ? '' : result.reason.code);
  return result;
};
const planned = (opts, pattern = emptyPattern()) => {
  const result = planGarment(pattern, opts);
  assert.ok(result.ok, result.ok ? '' : result.reason.code);
  return result.plan;
};
/** The core's plan rather than a refusal: a refusal returns a code and data (PQW-904). */
const made = (plan) => {
  assert.ok(!('code' in plan), 'code' in plan ? plan.code : '');
  return plan;
};

/** The input of worked example „B” (05 §4, „Worked example B”). */
const B = {
  bustCm: 96,
  easeCm: 10,
  neckToWristCm: 71.75,
  upperArmCm: 28,
  armholeDepthCm: 21,
  bodyLengthCm: 58,
  hemCm: 5,
  neckWidthCm: 18.5,
  frontNeckDepthCm: 8,
  backNeckDepthCm: 2,
  cuffWidthCm: 26,
  crossBackCm: 41,
};

describe('the basics of the schematic maths', () => {
  test('rounding to the stitch repeat in the direction of the ease: 79.5 stitches on 4 + 2 give 82 upwards, 78 downwards', () => {
    assert.equal(roundToRepeat(79.5, { width: 4, edge: 2 }, 'up'), 82);
    assert.equal(roundToRepeat(79.5, { width: 4, edge: 2 }, 'down'), 78);
    assert.equal(roundToRepeat(1, { width: 4, edge: 2 }, 'down'), 6);
  });

  test('even row counts: 42.4 → 42, 16.8 → 16, 1.6 → 2; rounding up 63 → 64', () => {
    assert.deepEqual([42.4, 16.8, 1.6, 32.2].map((x) => roundEven(x)), [42, 16, 2, 32]);
    assert.equal(roundEven(63, 'up'), 64);
    assert.equal(roundEven(62, 'up'), 62);
  });

  test('the magic formula (Midnight Purl): 142 rounds, 16 changes → every 8 rounds twice, every 9 rounds 14 times', () => {
    const schedule = slopeSchedule(142, 16, false);
    assert.deepEqual(schedule.intervals, [...Array(2).fill(8), ...Array(14).fill(9)]);
    assert.equal(schedule.tail, 0);
  });

  test('with a straight tail (KCG): 90 rows, 15 pairs → every 5 rows 6 times, every 6 rows 9 times, then 6 straight rows', () => {
    const schedule = slopeSchedule(90, 15, true);
    assert.deepEqual(schedule.intervals, [...Array(6).fill(5), ...Array(9).fill(6)]);
    assert.equal(schedule.tail, 6);
    assert.equal(eventRows(schedule).at(-1), 84);
  });

  test('too many changes in too few rows: no plan at all', () => {
    assert.equal(slopeSchedule(5, 10, true), null);
    assert.equal(reversedEventRows(slopeSchedule(3, 1, true), 3), null);
  });

  test('the increase rows counted from the bottom, and the groups of intervals', () => {
    const rows = reversedEventRows(slopeSchedule(32, 12, true), 32);
    assert.deepEqual(rows, [5, 8, 11, 14, 17, 20, 22, 24, 26, 28, 30, 32]);
    assert.deepEqual(shapingRuns(rows), {
      first: 5,
      runs: [
        { every: 3, times: 5 },
        { every: 2, times: 6 },
      ],
    });
  });

  test('even increases around a round, doubling at most', () => {
    assert.deepEqual(evenIncreases(8, 2), [1, 1, 2, 1, 1, 1, 2, 1]);
    assert.equal(evenIncreases(4, 5), null);
  });

  test('mirroring swaps the start and the end of a row; mirrored twice it is the original again', () => {
    const shaping = [{ start: 1, end: 0 }, { start: 0, end: -2 }];
    assert.deepEqual(mirrorShaping(shaping), [{ start: 0, end: 1 }, { start: -2, end: 0 }]);
    assert.deepEqual(mirrorShaping(mirrorShaping(shaping)), shaping);
  });
});

describe('worked example „B”: drop-shoulder sweater, 96 cm bust, +10 cm ease', () => {
  const plan = dropShoulderPlan(B, gauge, dc, null);

  test('back and front panel: 80 stitches, 42 rows above the hem, 82 stitches with a 4 + 2 repeat', () => {
    made(plan);
    assert.equal(plan.panel.exact, 79.5);
    assert.equal(plan.panel.stitches, 80);
    assert.equal(plan.panel.bodyRows, 42);
    assert.equal(plan.panel.hemRows, 4);
    // Since PQW-891 N stitches need N + T chains: 83 (the knowledge base's older 82-chain foundation predates that).
    assert.equal(plan.panel.foundation, 83);
    const repeated = dropShoulderPlan(B, gauge, dc, { width: 4, edge: 2 });
    assert.equal(repeated.panel.stitches, 82);
    assert.equal(repeated.panel.repeats, 20);
    // The finished ease: 53.3 cm panels, +10.7 cm.
    assert.ok(Math.abs(plan.finished.easeCm - 10.67) < 0.01);
  });

  test('neck: 28 stitches, 26 per shoulder; shaped neck: 14 at the centre, a decrease of 2 then 1 five times over 6 rows; 24 at the back over 2 rows', () => {
    assert.equal(plan.neck.stitches, 28);
    assert.equal(plan.neck.shoulder, 26);
    assert.deepEqual(plan.neck.front, { center: 14, perSide: 7, first: 2, later: 5, rows: 6 });
    assert.deepEqual(plan.neck.back, { center: 24, rows: 2, perRow: 1 });
  });

  test('sleeve: 64 stitches at the top, 40 at the cuff, 32 rows, 12 increase pairs', () => {
    assert.equal(plan.sleeve.top, 64);
    assert.equal(plan.sleeve.cuff, 40);
    assert.equal(plan.sleeve.shapedRows, 32);
    assert.equal(plan.sleeve.increases, 12);
    assert.equal(plan.sleeve.lengthCm, 45.25);
    assert.ok(Math.abs(plan.finished.upperArmEaseCm - 14.67) < 0.01);
  });

  test('sleeve from the top: every 3rd row 7 times, every 4th row 5 times, then 3 straight rows (32 ÷ 13 = 2 remainder 6)', () => {
    const { schedule } = plan.sleeve;
    assert.equal(schedule.every, 2);
    assert.equal(schedule.remainder, 6);
    assert.deepEqual(schedule.intervals, [...Array(7).fill(2), ...Array(5).fill(3)]);
    assert.equal(schedule.tail, 3);
    assert.equal(7 * 2 + 5 * 3 + 3, 32);
    assert.equal(64 - 2 * 12, 40);
  });

  test('upwards from the cuff after the 4 hem rows: the first increase falls in row 10 and the top edge has 64 stitches', () => {
    assert.equal(plan.sleeve.first, 9);
    assert.equal(plan.sleeve.increaseRows.length, 12);
    const { counts } = sleeveRowsOf(plan);
    assert.equal(counts.length, 36);
    assert.equal(counts[0], 40);
    assert.equal(counts.at(-1), 64);
  });

  test('every check passes', () => {
    assert.deepEqual(
      plan.checks.filter((check) => !check.ok).map((check) => check.id),
      [],
    );
    assert.ok(plan.checks.length >= 8);
  });
});

describe('worked example „D”: adult women hat in half double crochet', () => {
  const plan = hatPlan({ headCm: 56, easeCm: -5, heightCm: 19, brimCm: 3 }, { stitchCm: 1 / 1.5, rowCm: 1 / 1.1 });

  test('51 cm, 76 stitches; the crown is 9 rounds, the side 12 rounds', () => {
    made(plan);
    assert.equal(plan.hatCm, 51);
    assert.equal(plan.stitches, 76);
    assert.ok(Math.abs(plan.exactIncreases - 8.57) < 0.01);
    // Of the candidates (8, 9, 10) it is 9 that puts the crown's round count closest to the radius (05 „D” step 4).
    assert.equal(plan.increases, 9);
    assert.deepEqual(plan.counts.slice(0, 9), [9, 18, 27, 36, 45, 54, 63, 72, 76]);
    assert.equal(plan.crownRounds, 9);
    assert.equal(plan.sideRounds, 12);
    assert.equal(plan.brimRounds, 3);
    assert.deepEqual(plan.checks.filter((check) => !check.ok), []);
  });

  test('negative ease above 15% is refused, above 10% it warns', () => {
    // The core returns a code and data; the sentence belongs to the UI (PQW-904).
    const refused = hatPlan({ headCm: 50, easeCm: -8, heightCm: 19, brimCm: 3 }, gauge);
    assert.equal(refused.code, 'negative-ease-head');
    assert.deepEqual(refused.data, { limit: 15, actual: 16 });
    const tight = hatPlan({ headCm: 50, easeCm: -6, heightCm: 19, brimCm: 3 }, gauge);
    assert.equal(tight.checks.find((check) => check.id === 'negative-ease').ok, false);
    assert.deepEqual(
      tight.warnings.map((warning) => warning.code),
      ['negative-ease-warning'],
    );
  });
});

describe('size series', () => {
  test('women XS–5X: every check passes for every size and the stitch counts never decrease', () => {
    const plan = planned(options({ from: 'XS', to: '5X' }));
    assert.equal(plan.sizes.length, 9);
    assert.equal(plan.checksPassed, plan.checksTotal);
    assert.deepEqual(plan.monotonic, []);
    const neck = plan.values.neck;
    assert.ok(neck.every((n, i) => i === 0 || n >= neck[i - 1]), neck.join(' '));
  });

  test('men, child and baby tables: every size can be planned and every check passes', () => {
    for (const table of ['men', 'child', 'baby']) {
      const ids = garmentSizes('drop-shoulder', table);
      const plan = planned(options({ table, size: ids[0], from: ids[0], to: ids.at(-1), belowWaistCm: table === 'men' ? 0 : 6 }));
      assert.equal(plan.checksPassed, plan.checksTotal, table);
      assert.deepEqual(plan.monotonic, [], table);
    }
  });

  test('the armhole depth and cuff missing from the men table are estimated', () => {
    const plan = planned(options({ table: 'men', size: 'M', from: 'M', to: 'M', belowWaistCm: 0 }));
    assert.deepEqual(
      plan.sizes[0].estimated.map((item) => item.code),
      ['estimated-armhole-depth', 'estimated-cuff'],
    );
  });

  test('hat in every size: every check passes', () => {
    const plan = planned(hat({ from: 'preemie', to: 'adult-l' }));
    assert.equal(plan.sizes.length, 10);
    assert.equal(plan.checksPassed, plan.checksTotal);
    assert.deepEqual(plan.monotonic, []);
  });

  test('growth: the lengths shrink by the stretch of the hung swatch (05 §7.2, PQW-901)', () => {
    const plain = planned(options({ from: 'M', to: 'M' }));
    const grown = planned(options({ from: 'M', to: 'M', growthPct: 10 }));
    assert.ok(grown.sizes[0].plan.panel.rows < plain.sizes[0].plan.panel.rows, 'the sweater comes out shorter');
    const hatPlain = planned(hat({ from: 'adult-m', to: 'adult-m' }));
    const hatGrown = planned(hat({ from: 'adult-m', to: 'adult-m', growthPct: 10 }));
    assert.ok(hatGrown.sizes[0].plan.counts.length < hatPlain.sizes[0].plan.counts.length, 'the hat comes out shorter');
    assert.equal(planGarment(emptyPattern(), options({ growthPct: 80 })).reason.code, 'growth-range');
  });

  test('a failing check comes with a suggested fix (05 §9.6, PQW-901)', () => {
    // Negative ease over 10% of the bust: the plan is still produced, but the check fails.
    const plan = planned(options({ easeCm: -10, from: 'M', to: 'M' }));
    const failing = plan.sizes[0].plan.checks.filter((check) => !check.ok);
    assert.deepEqual(failing.map((check) => check.id), ['negative-ease']);
    assert.equal(failing[0].label.code, 'check-negative-ease');
    assert.equal(failing[0].suggestion.code, 'suggest-negative-ease-bust');
    assert.equal(failing[0].suggestion.data.cm, 9);
  });

  test('suspicious table data surfaces as a flag on the size', () => {
    const plan = planned(options({ size: '2X', from: 'XL', to: '2X' }));
    assert.ok(plan.sizes[1].flags.some((flag) => flag.kind === 'identical-rows'));
  });

  test('a size takes the middle of the table range', () => {
    const graded = dropShoulderMeasures(WOMEN, 'M', { easeCm: 10, hemCm: 5, belowWaistCm: 14.5 });
    assert.equal(graded.measures.bustCm, 94);
    assert.equal(graded.measures.bodyLengthCm, 58);
    assert.equal(graded.measures.neckToWristCm, 71.75);
  });

  test('bad choices: the series does not contain the chart size, and the negative ease is too large', () => {
    assert.equal(planGarment(emptyPattern(), options({ from: 'L', to: 'XL' })).reason.code, 'series-range');
    // For a series the size id and the reason code go to the UI; the UI fills in the size name itself.
    const tight = planGarment(emptyPattern(), options({ easeCm: -20 })).reason;
    assert.equal(tight.code, 'size-problem');
    assert.equal(tight.data.size, 'S');
    assert.equal(tight.data.table, 'women');
    assert.equal(tight.data.inner, 'negative-ease-bust');
  });
});

describe('generated pattern', () => {
  test('sweater in size M: four pieces, ten seams, no errors', () => {
    const { pattern, plan } = generated(DEFAULT_GARMENT);
    assert.deepEqual(
      pattern.pieces.map((piece) => piece.name),
      ['Hátrész', 'Elejerész', 'Bal ujj', 'Jobb ujj'],
    );
    assert.equal(pattern.joins.length, 10);
    assert.equal(pattern.title, 'Ledobott vállú pulóver');
    assert.deepEqual(pattern.garment.sizes, ['S', 'M', 'L']);
    assert.equal(pattern.garment.base, 1);
    assert.deepEqual(findings(pattern).filter((finding) => finding.severity === 'error'), []);
    const base = plan.sizes[1].plan;
    // The sleeve is seamed into the armhole with even distribution, its two halves onto the back and the front.
    // With a shaped neck the armhole runs to the top of the body and the shoulders are worked above the split (PQW-901).
    const sleeveJoin = pattern.joins.find((join) => join.a.piece === 'p3' && join.b.piece === 'p1');
    const split = neckSplitRow(base, 'back');
    assert.deepEqual(sleeveJoin.a.stitches, { from: 0, count: base.sleeve.top / 2 });
    assert.deepEqual(sleeveJoin.b.rows, { to: split, side: 'left' });
    assert.equal(sleeveJoin.distribution.reduce((sum, n) => sum + n, 0), Math.max(base.sleeve.top / 2, split - (base.panel.rows - base.panel.armholeRows)));
  });

  test('the right sleeve mirrors the left one: the rows have identical stitch counts', () => {
    const { pattern } = generated(DEFAULT_GARMENT);
    const text = formatWrittenPattern(writePattern(pattern, libraryFor(pattern), 'hu'));
    const block = (name) => text.split('\n\n').find((part) => part.startsWith(`${name}\n`));
    const counts = (name) => [...block(name).matchAll(/\((\d+) szem\)/g)].map((match) => match[1]);
    assert.ok(counts('Bal ujj').length > 0);
    assert.deepEqual(counts('Jobb ujj'), counts('Bal ujj'));
  });

  test('shaped neckline: both shoulders within one piece, and the text reads back (PQW-901)', () => {
    const { pattern, plan } = generated(DEFAULT_GARMENT);
    const base = plan.sizes[1].plan;
    const { joins: _joins, garment: _garment, ...rest } = pattern;
    // The piece on its own: the „Méretek” and „Összeállítás” blocks are not part of the row text.
    const front = { ...rest, pieces: [pattern.pieces[1]] };
    const library = libraryFor(front);
    const text = formatWrittenPattern(writePattern(front, library, 'hu'));
    const split = neckSplitRow(base, 'front');
    // Above the split both shoulders carry the same row numbers; the section name is what tells them apart.
    // The printed row number is one greater than its layer (PQW-923): the foundation chain is row 1.
    assert.match(text, new RegExp(`A másik váll \\(a ${split + 1}\\. sor fölött\\):`));
    // Both shoulders start on the row after the one referenced: after „(a 45. sor fölött)” each begins with row 46.
    assert.equal(text.match(new RegExp(`^${split + 2}\\. sor: `, 'gm')).length, 2);
    const result = readPattern(text, { library, locale: 'hu', conventions: front.conventions });
    assert.ok(result.ok, result.ok ? '' : `${result.error.line}: ${result.error.message}`);
    // The reader assigns the piece id itself: that does not make the graph any different.
    const sameId = (piece) => ({ ...piece, id: 'p1' });
    assert.deepEqual(canonicalPattern(result.pattern).pieces.map(sameId), canonicalPattern(front).pieces.map(sameId));
    assert.deepEqual(validatePattern(result.pattern, library).filter((finding) => finding.severity === 'error'), []);
  });

  test('hat: no findings, and the straight side raises no curling warning', () => {
    const { pattern } = generated(DEFAULT_HAT);
    assert.deepEqual(findings(pattern), []);
    assert.equal(pattern.garment.kind, 'hat');
  });

  test('a seam pointing at an edge that does not exist is an error', () => {
    const { pattern } = generated(DEFAULT_GARMENT);
    const broken = { ...pattern, joins: [{ ...pattern.joins[0], a: { ...pattern.joins[0].a, stitches: { from: 1000, count: 5 } } }] };
    assert.ok(findings(broken).some((finding) => finding.rule === 'join-edge'));
    const rows = { ...pattern, joins: [{ a: { piece: 'p1', layer: 1, rows: { to: 999, side: 'left' } }, b: pattern.joins[2].b }] };
    assert.ok(findings(rows).some((finding) => finding.rule === 'join-edge'));
  });

  test('written pattern: „Méretek” after the title, „S (M, L)”, and the seams by row and by section', () => {
    const { pattern } = generated(DEFAULT_GARMENT);
    const text = formatWrittenPattern(writePattern(pattern, libraryFor(pattern), 'hu'));
    assert.match(text, /^Ledobott vállú pulóver\n\nMéretek\nS \(M, L\)\nA sorok és a rajz az M méretre készültek;/);
    assert.match(text, /Hátrész és elejerész \(2 db\): láncalap \d+ \(\d+, \d+\) lsz; \d+ \(\d+, \d+\) szem/);
    assert.match(text, /Szaporíts mindkét szélen 1-1 szemet a \d+\. \(\d+\., \d+\.\) sorban/);
    // With a shaped neck each shoulder is a full row, and the section name tells identical row numbers apart (PQW-901).
    assert.match(text, /Varrás: Hátrész, \d+\. sor 1–\d+\. szeme \(\d+\) → Elejerész, A másik váll, \d+\. sor 1–\d+\. szeme \(\d+\)\./);
    assert.match(text, /Varrás: Hátrész, 1–\d+\. sor bal széle \(\d+ sorvég\) → Elejerész, 1–\d+\. sor jobb széle \(\d+ sorvég\)\./);
    assert.match(text, /Varrás: Bal ujj, \d+\. sor 1–\d+\. szeme \(\d+\) → Hátrész, \d+–\d+\. sor bal széle \(\d+ sorvég\), a szemeket egyenletesen elosztva\./);
    const english = formatWrittenPattern(writePattern(pattern, libraryFor(pattern), 'en-US'));
    assert.match(english, /\n\nSizes\nS \(M, L\)\nThe rows and chart are for size M;/);
    assert.match(english, /Sew: Back|Sew: Hátrész, Rows 1–\d+, left edge \(\d+ row ends\) to Elejerész/);
  });

  test('the hat written pattern: crown and side with the size series', () => {
    const { pattern } = generated(DEFAULT_HAT);
    const text = formatWrittenPattern(writePattern(pattern, libraryFor(pattern), 'hu'));
    assert.match(text, /Méretek\nFelnőtt S \(Felnőtt M, Felnőtt L\)\nA sorok és a rajz a Felnőtt M méretre készültek;/);
    assert.match(text, /Korona: \d+ \(\d+, \d+\) kör, körönként \d+ \(\d+, \d+\) szaporítással/);
    assert.match(text, /ebből az utolsó \d+ \(\d+, \d+\) kör a perem/);
  });

  test('save and load: the size series and the seams survive', () => {
    const { pattern } = generated(DEFAULT_GARMENT);
    const loaded = loadPattern(savePattern(pattern));
    assert.ok(loaded.ok, loaded.ok ? '' : loaded.error.message);
    assert.deepStrictEqual(loaded.pattern, pattern);
  });

  test('loading: a wrong per-size array length, and both edge kinds on one seam, are rejected', () => {
    const { pattern } = generated(DEFAULT_HAT);
    const raw = JSON.parse(savePattern(pattern));
    raw.garment.values.hatStitches = [1];
    assert.equal(loadPattern(JSON.stringify(raw)).ok, false);
    const sweater = JSON.parse(savePattern(generated(DEFAULT_GARMENT).pattern));
    sweater.joins[0].a.rows = { to: 3, side: 'left' };
    assert.equal(loadPattern(JSON.stringify(sweater)).ok, false);
  });

  test('yarn per size computed from the swatch, and a larger size needs more', () => {
    const profile = {
      id: 'pulover',
      yarn: { name: 'Merinó', cycWeight: 4, metersPer100g: 200, ballMassG: 100 },
      hookMm: 5,
      blocked: true,
      gauges: [{ stitch: 'dc', form: 'rows', stitchesPer10cm: 15, rowsPer10cm: 8, source: 'measured' }],
      swatch: { widthCm: 10, heightCm: 10, massG: 6 },
    };
    const pattern = { ...emptyPattern(), gauge: { active: 'pulover', profiles: [profile] } };
    const plan = planned(DEFAULT_GARMENT, pattern);
    assert.equal(plan.yarnMissing, null);
    const yarn = plan.values.yarnM;
    assert.ok(yarn[0] < yarn[1] && yarn[1] < yarn[2], yarn.join(' '));
    const { pattern: made } = generated(DEFAULT_GARMENT, pattern);
    assert.match(formatWrittenPattern(writePattern(made, libraryFor(made), 'hu')), /Fonal tartalékkal: kb\. \d+ \(\d+, \d+\) m, \d+ \(\d+, \d+\) gombolyag\./);
    // With the gauge of worked example „B”, size M (94 + 10 cm, a 52 cm panel) is exactly 78 stitches.
    assert.equal(plan.sizes[1].plan.panel.stitches, 78);
  });
});

describe('the written pattern of a garment reads back (PQW-913)', () => {
  /** Measured gauge in rounds and in rows: the raglan and the hat need a round gauge. */
  const measured = () => {
    const profile = {
      id: 'meres',
      yarn: { name: 'Pamut', cycWeight: 4, metersPer100g: null, ballMassG: null },
      hookMm: 5,
      blocked: false,
      gauges: [
        { stitch: 'dc', form: 'rounds', stitchesPer10cm: 15, rowsPer10cm: 8, source: 'measured' },
        { stitch: 'dc', form: 'rows', stitchesPer10cm: 15, rowsPer10cm: 8, source: 'measured' },
        { stitch: 'hdc', form: 'rounds', stitchesPer10cm: 18, rowsPer10cm: 14, source: 'measured' },
      ],
      swatch: { widthCm: null, heightCm: null, massG: null },
    };
    return { ...emptyPattern(), gauge: { active: 'meres', profiles: [profile] } };
  };

  /** The pattern written out and read back again; the piece names match. */
  const roundTrip = (garmentOptions) => {
    const result = generateGarment(measured(), garmentOptions);
    assert.ok(result.ok, JSON.stringify(result.reason));
    const { pattern } = result;
    const library = libraryFor(pattern);
    const written = formatWrittenPattern(writePattern(pattern, library, 'hu'));
    // The size-series block is descriptive text, not a piece: without this the reader tripped on the „S (M, L)” heading.
    assert.match(written, /\nMéretek\n/);
    const back = readPattern(written, { library, locale: 'hu', conventions: pattern.conventions });
    assert.ok(back.ok, back.ok ? '' : JSON.stringify(back.error));
    assert.deepEqual(
      back.pattern.pieces.map((piece) => piece.name),
      pattern.pieces.map((piece) => piece.name),
    );
    return back.pattern;
  };

  test('the top-down raglan reads back', () => {
    assert.equal(roundTrip(options({ kind: 'raglan' })).pieces.length, 1);
  });

  test('all four pieces of the drop-shoulder sweater read back', () => {
    assert.equal(roundTrip(options({})).pieces.length, 4);
  });

  test('the hat reads back', () => {
    assert.equal(roundTrip(hat({})).pieces.length, 1);
  });
});

describe('ribbed hem and cuff on the drop-shoulder sweater (PQW-913)', () => {
  const made = (patch) => {
    const result = generateGarment(emptyPattern(), options(patch));
    assert.ok(result.ok, result.ok ? '' : JSON.stringify(result.reason));
    return result.pattern;
  };
  const written = (pattern) => formatWrittenPattern(writePattern(pattern, libraryFor(pattern), 'hu'));
  const rowLines = (text) => text.split('\n').filter((line) => /^\d+([–-]\d+)?\. sor:/.test(line));

  /** The layer stitch counts per piece: ribbing must not change these. */
  const counts = (pattern) =>
    pattern.pieces.map((piece) => buildPieceGraph(pattern, piece, libraryFor(pattern)).layers.map((layer) => layer.stitchCount));

  for (const neckline of ['boat', 'shaped']) {
    test(`with a ${neckline === 'boat' ? 'boat' : 'shaped'} neckline the ribbing is sound and the stitch counts stay unchanged`, () => {
      const plain = made({ neckline, ribbing: null });
      const ribbed = made({ neckline, ribbing: { rows: 2, width: 1 } });
      assert.deepEqual(validatePattern(ribbed, libraryFor(ribbed)), []);
      // A post stitch goes around the post and does not consume its top: the same stitch count per layer.
      assert.deepEqual(counts(ribbed), counts(plain));
      assert.doesNotMatch(written(plain), /Eerp|Herp/);
    });
  }

  test('the hem and cuff rows use post stitches, a shorter turning chain, and a repeat', () => {
    const text = written(made({ neckline: 'shaped', ribbing: { rows: 2, width: 1 } }));
    const ribbed = rowLines(text).filter((line) => /Eerp|Herp/.test(line));
    // Two panels and two sleeves, row by row: every piece has ribbing at its bottom.
    assert.ok(ribbed.length >= 4, ribbed.join('\n'));
    // The turning chain of a ribbing row is a turning chain (01 §2.2 [S25]), and the ribbing is written as a repeat.
    assert.ok(ribbed.every((line) => line.includes('fordulólánc')), ribbed.join('\n'));
    assert.ok(ribbed.some((line) => /\[1 (Eerp|Herp), 1 (Eerp|Herp)\]/.test(line)), ribbed.join('\n'));
    // Row 1 stays plain: you cannot work a post stitch around the foundation chain.
    assert.ok(!/^2\. sor:.*(Eerp|Herp)/m.test(text), 'row 2 must not be ribbed');
  });
});
