/*
 * Shawl shapes (PQW-865): worked example A of the knowledge base (05 §1.4),
 * even symmetry and the spreading of a fractional rate, the wings, adjusting
 * the last row to the edging, the schedules of the semicircle, the circle and
 * the pi shawl (05 §1.2, §1.3), the warning on a custom rate (README §4.7),
 * the blocked and unblocked size, and that every generated shawl validates
 * cleanly, writes out and reads back.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { canonicalPattern } from '../src/core/canonical.ts';
import { emptyPattern } from '../src/core/editor.ts';
import { readPattern } from '../src/core/pattern-read.ts';
import { formatWrittenPattern, writePattern } from '../src/core/pattern-text.ts';
import {
  DEFAULT_SHAWL,
  generateShawl,
  MAX_INTO_ONE,
  MAX_SHAWL_CM,
  piRounds,
  planShawl,
  SHAWL_KINDS,
  SHAWL_STITCHES,
  shawlProblem,
  shawlSizes,
} from '../src/core/shawls.ts';
import { libraryFor, resolveStitch } from '../src/core/stitch-variants.ts';
import { firstChainFromHook, traditionOf, turningChainCountsFor, withTradition } from '../src/core/tradition.ts';
import { validatePattern } from '../src/core/validate.ts';

/** A pattern whose profile puts the stitch at the given stitches and rows/rounds per 10 cm. */
function withGauge(
  stitch,
  stitchesPer10cm,
  rowsPer10cm,
  { blocked = false, form = 'rows', pattern = emptyPattern() } = {},
) {
  const profile = {
    id: 'kendo',
    yarn: { name: 'Merinó', cycWeight: 1, metersPer100g: null, ballMassG: null },
    hookMm: 3.5,
    blocked,
    gauges: [{ stitch, form, stitchesPer10cm, rowsPer10cm, source: 'measured' }],
    swatch: { widthCm: null, heightCm: null, massG: null },
  };
  return { ...pattern, gauge: { active: 'kendo', profiles: [profile] } };
}

const japanese = () => ({ ...emptyPattern(), conventions: withTradition(emptyPattern().conventions, 'japanese') });
const options = (patch) => ({ ...DEFAULT_SHAWL, ...patch });
/** The core gives a code and data as the reason (PQW-904); that is enough for the failure message. */
const why = (result) => (result.ok ? '' : JSON.stringify(result.reason));
const shawl = (pattern, patch) => {
  const result = generateShawl(pattern, options(patch));
  assert.ok(result.ok, why(result));
  return result;
};
const plan = (pattern, patch) => {
  const result = planShawl(pattern, options(patch));
  assert.ok(result.ok, why(result));
  return result.plan;
};
const changes = (counts) => counts.slice(1).map((count, i) => count - counts[i]);
const findings = (pattern) => validatePattern(pattern, libraryFor(pattern));
const errors = (pattern) => findings(pattern).filter((finding) => finding.severity === 'error');
const near = (actual, expected, tolerance, name) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${name}: ${actual} ≉ ${expected}`);
const sameGraph = (a, b) => {
  const [x, y] = [canonicalPattern(a).pieces[0], canonicalPattern(b).pieces[0]];
  assert.deepEqual(x.stitches, y.stitches);
  assert.deepEqual(x.groups, y.groups);
  assert.deepEqual(x.events, y.events);
};

/** Worked example A: a dc triangle at a blocked 16 × 8 gauge, 160 cm wingspan, 80 cm deep. */
const exampleA = () => withGauge('dc', 16, 8, { blocked: true });

describe('top-down triangle (05 §1.4)', () => {
  test('worked example A: 45 rows, 8 increases per row, row n has 8n stitches and the last has 360; it validates cleanly', () => {
    const { pattern, plan } = shawl(exampleA(), { kind: 'triangle', stitch: 'dc', sizeCm: 80 });
    assert.equal(plan.counts.length, 45);
    assert.deepEqual(
      plan.counts,
      Array.from({ length: 45 }, (_, i) => 8 * (i + 1)),
    );
    assert.equal(plan.counts.at(-1), 360);
    assert.equal(plan.theoryRate, 8);
    assert.deepEqual([plan.edgeRate, plan.spineRate], [2, 2]);
    assert.deepEqual(plan.warnings, []);
    assert.deepEqual(findings(pattern), []);
  });

  test('worked example A row by row: +2 on each edge, +4 on the spine, 3 dc into each of the two centre stitches', () => {
    const { layout } = plan(exampleA(), { kind: 'triangle', stitch: 'dc', sizeCm: 80 });
    assert.equal(layout.first, 8);
    const row2 = layout.rounds[0];
    assert.deepEqual(row2, [3, 1, 1, 3, 3, 1, 1, 3]);
    for (const into of layout.rounds) {
      const p = into.length;
      assert.deepEqual([into[0], into[p - 1], into[p / 2 - 1], into[p / 2]], [3, 3, 3, 3]);
      assert.equal(into.filter((n) => n === 3).length, 4);
    }
  });

  test('worked example A blocks to about 160 × 80 cm, with a straight neck edge (180°) and a right-angled bottom tip', () => {
    const sizes = shawlSizes(plan(exampleA(), { kind: 'triangle', stitch: 'dc', sizeCm: 80 }), DEFAULT_SHAWL.blocking);
    assert.equal(sizes.measured, 'blocked');
    near(sizes.blocked.widthCm, 160, 1.5, 'wingspan');
    near(sizes.blocked.depthCm, 80, 1, 'depth');
    near(sizes.blocked.neckAngleDeg, 180, 0.01, 'neck edge');
    near(sizes.blocked.tipAngleDeg, 90, 0.01, 'bottom tip');
    // The unblocked size is smaller by the stretch.
    assert.ok(sizes.unblocked.widthCm < sizes.blocked.widthCm && sizes.unblocked.depthCm < sizes.blocked.depthCm);
  });

  test('worked example A written out: row 2 starts in the chain the tradition dictates, row 3 reads „3 lsz, 2 erp ugyanabba a szembe”', () => {
    const { pattern } = shawl(exampleA(), { kind: 'triangle', stitch: 'dc', sizeCm: 80 });
    const dc = resolveStitch('dc');
    const tradition = traditionOf(pattern.conventions);
    const from = firstChainFromHook(
      dc.turningChain,
      turningChainCountsFor(pattern.conventions.turningChainCounts, dc, tradition, 'row'),
      tradition,
    );
    const hu = formatWrittenPattern(writePattern(pattern, libraryFor(pattern), 'hu'));
    // The stated stitch count includes the turning chain (PQW-940); the row works into every stitch of the row below.
    assert.match(hu, new RegExp(`2\\. sor: hagyj ki ${from - 1} láncszemet, majd .*\\(9 szem\\)\\. Fordítás\\.`));
    assert.match(hu, /3\. sor: 3 lsz \(1 erp-nek számít\), .* \(17 szem\)\. Fordítás\./);
    assert.match(hu, /46\. sor: .* \(361 szem\)\. A fonal elvágása\./);
  });

  test('in sc at 20 × 22 the rate is 3.64: 124 rows of +4 and +2 only, the +2 alternating between the edges and the spine', () => {
    const result = plan(withGauge('sc', 20, 22), { kind: 'triangle', stitch: 'sc', sizeCm: 80 });
    assert.equal(result.counts.length, 124);
    const steps = changes(result.counts);
    assert.ok(
      steps.every((step) => step === 2 || step === 4),
      steps.join(','),
    );
    near(steps.reduce((sum, step) => sum + step, 0) / steps.length, (4 * 2) / 2.2, 0.02, 'mean');
    // Every +2 row increases either on the edges only (one each) or on the spine only (the two centre stitches), alternating.
    const twos = result.layout.rounds.filter((into) => into.reduce((sum, n) => sum + n, 0) - into.length === 2);
    const where = twos.map((into) => (into[0] === 2 ? 'élek' : 'gerinc'));
    assert.ok(where.length > 10);
    where.forEach((side, i) => i > 0 && assert.notEqual(side, where[i - 1], `+2 row ${i}`));
  });

  test('a smaller custom rate: deeper and narrower, the neck edge curves down, a warning is raised but the pattern is still generated', () => {
    const { pattern, plan: custom } = shawl(exampleA(), {
      kind: 'triangle',
      stitch: 'dc',
      sizeCm: 80,
      rate: 'custom',
      customRate: 6,
    });
    assert.deepEqual(
      custom.warnings.map((warning) => warning.kind),
      ['narrow'],
    );
    near(custom.warnings[0].ratio, 0.75, 0.01, 'ratio');
    assert.ok(changes(custom.counts).every((step) => step === 6));
    const sizes = shawlSizes(custom, DEFAULT_SHAWL.blocking);
    assert.ok(sizes.blocked.neckAngleDeg < 180);
    near(sizes.blocked.spineCm, 80, 1.5, 'the spine is the requested depth');
    assert.deepEqual(errors(pattern), []);
    // A larger rate: flatter.
    assert.deepEqual(
      plan(exampleA(), { kind: 'triangle', stitch: 'dc', sizeCm: 80, rate: 'custom', customRate: 10 }).warnings.map(
        (w) => w.kind,
      ),
      ['wide'],
    );
    // Within 15% there is no warning.
    assert.deepEqual(
      plan(exampleA(), { kind: 'triangle', stitch: 'dc', sizeCm: 80, rate: 'custom', customRate: 7.2 }).warnings,
      [],
    );
  });

  test('wings: over the second half the edges increase twice as fast, while the spine is unchanged', () => {
    const winged = plan(exampleA(), { kind: 'triangle', stitch: 'dc', sizeCm: 80, wings: true });
    assert.equal(winged.wingsFromRow, 23);
    const steps = changes(winged.counts);
    assert.ok(steps.slice(0, 21).every((step) => step === 8));
    assert.ok(steps.slice(21).every((step) => step === 12));
    const plain = shawlSizes(plan(exampleA(), { kind: 'triangle', stitch: 'dc', sizeCm: 80 }), DEFAULT_SHAWL.blocking);
    assert.ok(shawlSizes(winged, DEFAULT_SHAWL.blocking).blocked.widthCm >= plain.blocked.widthCm - 1e-9);
  });

  test('the last row adjusts to the edging: a multiple of 6 + 3 per half, changing by at most +2 per half over the last two rows', () => {
    const adjusted = plan(exampleA(), { kind: 'triangle', stitch: 'dc', sizeCm: 80, edging: { width: 6, edge: 3 } });
    const half = adjusted.counts.at(-1) / 2;
    assert.equal((half - 3) % 6, 0);
    assert.deepEqual(adjusted.edging, { repeats: (half - 3) / 6, change: 3 });
    const steps = changes(adjusted.counts);
    assert.ok(steps.slice(0, -2).every((step) => step === 8));
    assert.ok(steps.slice(-2).every((step) => step >= 8 && step <= 12));
    assert.ok(changes(adjusted.counts).every((step) => step % 2 === 0));
  });
});

describe('asymmetric triangle and crescent (05 §1.5, §1.6)', () => {
  test('asymmetric: h/w increases per row, always on the same edge, at about 45°', () => {
    const result = plan(withGauge('sc', 20, 22), { kind: 'asymmetric-triangle', stitch: 'sc', sizeCm: 40 });
    near(result.theoryRate, 2 / 2.2, 1e-9, 'h/w');
    result.layout.rounds.forEach((into, i) => {
      const row = i + 2;
      const middle = row % 2 === 0 ? into.slice(2) : into.slice(0, -2);
      assert.ok(
        middle.every((n) => n === 1),
        `row ${row}: on the sloped edge only`,
      );
    });
    near(shawlSizes(result, DEFAULT_SHAWL.blocking).unblocked.tipAngleDeg, 45, 1.5, 'angle');
  });

  test('crescent: it increases on the edges only, never on the spine, and the neck edge bends to less than 180°', () => {
    const result = plan(withGauge('dc', 16, 8), { kind: 'crescent', stitch: 'dc', sizeCm: 30 });
    assert.equal(result.spineRate, 0);
    for (const into of result.layout.rounds) {
      const p = into.length;
      assert.deepEqual([into[p / 2 - 1], into[p / 2]], [1, 1]);
    }
    assert.ok(changes(result.counts).every((step) => step % 2 === 0));
    assert.ok(shawlSizes(result, DEFAULT_SHAWL.blocking).unblocked.neckAngleDeg < 180);
  });
});

describe('semicircle, circle and pi shawl (05 §1.2, §1.3)', () => {
  test('semicircle the Omdahl way: +9 per row in dc and row n has 9n stitches; Inner Child: +3 in sc', () => {
    const omdahl = plan(withGauge('dc', 16, 8), {
      kind: 'semicircle',
      stitch: 'dc',
      sizeCm: 20,
      rate: 'custom',
      customRate: 9,
    });
    assert.deepEqual(
      omdahl.counts,
      omdahl.counts.map((_, i) => 9 * (i + 1)),
    );
    const inner = plan(withGauge('sc', 20, 20), {
      kind: 'semicircle',
      stitch: 'sc',
      sizeCm: 5,
      rate: 'custom',
      customRate: 3,
    });
    assert.deepEqual(
      inner.counts,
      inner.counts.map((_, i) => 3 * (i + 1)),
    );
    // In sc at 20 × 20, π · h/w = 3.14: a rate of 3 is still within 15%.
    near(inner.theoryRate, Math.PI, 1e-9, 'π · h/w');
    assert.deepEqual(inner.warnings, []);
  });

  test('semicircle: the increases are spread evenly along the row; too few warns about cupping, too many about ruffling', () => {
    const cupped = plan(withGauge('dc', 16, 8), {
      kind: 'semicircle',
      stitch: 'dc',
      sizeCm: 20,
      rate: 'custom',
      customRate: 4,
    });
    assert.deepEqual(
      cupped.warnings.map((warning) => warning.kind),
      ['cupping'],
    );
    const ruffled = plan(withGauge('dc', 16, 8), {
      kind: 'semicircle',
      stitch: 'dc',
      sizeCm: 20,
      rate: 'custom',
      customRate: 9,
    });
    assert.deepEqual(
      ruffled.warnings.map((warning) => warning.kind),
      ['ruffling'],
    );
    for (const into of cupped.layout.rounds.slice(4)) {
      const at = into.flatMap((n, i) => (n === 2 ? [i] : []));
      const gaps = at.slice(1).map((i, j) => i - at[j]);
      assert.ok(Math.max(...gaps) - Math.min(...gaps) <= 1, gaps.join(','));
    }
  });

  test('circle worked in rounds: the round rate rounds to a whole increase, and round k is k times it', () => {
    const result = plan(emptyPattern(), { kind: 'circle', stitch: 'sc', sizeCm: 6 });
    assert.equal(result.worked, 'rounds');
    assert.equal(result.chosenRate, 6);
    assert.deepEqual(
      result.counts,
      result.counts.map((_, i) => 6 * (i + 1)),
    );
  });

  test('pi shawl: doubling on rounds 2, 4, 8 and 16, and just before a doubling it sits at about half the ideal (05 §1.3 [DERIVED])', () => {
    assert.deepEqual([...piRounds(false, 40)], [2, 4, 8, 16, 32]);
    const pi = plan(emptyPattern(), { kind: 'pi', stitch: 'sc', sizeCm: 10 });
    assert.deepEqual(pi.counts.slice(0, 16), [6, 12, 12, 24, 24, 24, 24, 48, 48, 48, 48, 48, 48, 48, 48, 96]);
    assert.ok(pi.ratio.min < 0.55, String(pi.ratio.min));
    assert.deepEqual(
      pi.warnings.map((warning) => warning.kind),
      ['pi-blocking'],
    );
  });

  test('shifted pi shawl: doubling on round round(2^k · 0.75), staying closer to the ideal than the plain pi', () => {
    assert.deepEqual([...piRounds(true, 40)], [2, 3, 6, 12, 24]);
    const pure = plan(emptyPattern(), { kind: 'pi', stitch: 'sc', sizeCm: 10 });
    const shifted = plan(emptyPattern(), { kind: 'shifted-pi', stitch: 'sc', sizeCm: 10 });
    assert.deepEqual(shifted.counts.slice(0, 6), [6, 12, 24, 24, 24, 48]);
    assert.ok(shifted.ratio.min > pure.ratio.min + 0.1);
    assert.ok(shifted.ratio.min > 0.65 && shifted.ratio.max < 1.35, JSON.stringify(shifted.ratio));
  });

  test('the last round adjusts to the edging, by at most a doubling', () => {
    const result = plan(emptyPattern(), { kind: 'circle', stitch: 'sc', sizeCm: 6, edging: { width: 8, edge: 4 } });
    assert.equal((result.counts.at(-1) - 4) % 8, 0);
    assert.ok(Math.abs(result.edging.change) <= 4);
    const pi = plan(emptyPattern(), { kind: 'pi', stitch: 'sc', sizeCm: 10, edging: { width: 5, edge: 1 } });
    assert.equal((pi.counts.at(-1) - 1) % 5, 0);
    assert.ok(pi.counts.at(-1) <= 2 * pi.counts.at(-2));
  });
});

describe('rectangular stole and finished size (05 §1.7, §1.8)', () => {
  test('a stole is a flat rectangle: the same stitch count every row, with the width rounded to the edging repeat', () => {
    const { pattern, plan: stole } = shawl(withGauge('dc', 16, 8), {
      kind: 'stole',
      stitch: 'dc',
      sizeCm: 37.5,
      lengthCm: 50,
      edging: { width: 6, edge: 2 },
    });
    assert.equal(stole.counts.length, 40);
    assert.ok(stole.counts.every((count) => count === stole.counts[0]));
    assert.ok(stole.edging.repeats > 0);
    assert.deepEqual(pattern.conventions.repeat, { repeatWidth: 6, edgeStitches: 2, turningChainIncluded: false });
    assert.equal(pattern.pieces[0].name, 'Téglalap stóla');
    assert.deepEqual(findings(pattern), []);
  });

  test('from an unblocked profile the blocked size is larger by the stretch, and from a blocked profile the unblocked size is smaller', () => {
    const unblocked = shawlSizes(
      plan(withGauge('dc', 16, 8), { kind: 'stole', stitch: 'dc', sizeCm: 40, lengthCm: 100 }),
      { widthPct: 10, heightPct: 5 },
    );
    assert.equal(unblocked.measured, 'unblocked');
    near(unblocked.blocked.widthCm, unblocked.unblocked.widthCm * 1.1, 1e-9, 'width');
    near(unblocked.blocked.depthCm, unblocked.unblocked.depthCm * 1.05, 1e-9, 'length');
    const blocked = shawlSizes(
      plan(withGauge('dc', 16, 8, { blocked: true }), { kind: 'stole', stitch: 'dc', sizeCm: 40, lengthCm: 100 }),
      { widthPct: 10, heightPct: 5 },
    );
    assert.equal(blocked.measured, 'blocked');
    near(blocked.unblocked.widthCm, blocked.blocked.widthCm / 1.1, 1e-9, 'width');
  });

  test('without a profile the gauge is estimated; the shawl name replaces the default title and an earlier generated one, but a user-given title is kept', () => {
    assert.equal(plan(emptyPattern(), {}).gauge.source, 'estimated');
    assert.equal(shawl(emptyPattern(), { sizeCm: 10 }).pattern.title, 'Fentről induló háromszög');
    assert.equal(shawl(emptyPattern('Téglalap'), { kind: 'semicircle', sizeCm: 10 }).pattern.title, 'Félkör');
    assert.equal(shawl(emptyPattern('Nyári kendő'), { sizeCm: 10 }).pattern.title, 'Nyári kendő');
  });
});

describe('validating the options', () => {
  test('size, rate, edging repeat and stretch must stay in range, with a readable code and data (PQW-904)', () => {
    assert.equal(shawlProblem(DEFAULT_SHAWL), null);
    assert.equal(shawlProblem(options({ stitch: 'sc2tog' })).code, 'shawl-basic-stitch-only');
    assert.deepEqual(shawlProblem(options({ sizeCm: Number.NaN })), {
      code: 'shawl-size-range',
      data: { max: MAX_SHAWL_CM },
    });
    assert.equal(shawlProblem(options({ kind: 'stole', lengthCm: 0 })).code, 'shawl-length-range');
    assert.equal(shawlProblem(options({ rate: 'custom', customRate: 0 })).code, 'shawl-rate-range');
    assert.equal(shawlProblem(options({ edging: { width: 0, edge: 1 } })).code, 'shawl-edging-width-range');
    assert.equal(
      shawlProblem(options({ blocking: { widthPct: Number.NaN, heightPct: 5 } })).code,
      'shawl-blocking-range',
    );
    const refuse = (patch) => {
      const result = planShawl(emptyPattern(), options(patch));
      assert.equal(result.ok, false);
      return result.reason;
    };
    assert.equal(refuse({ sizeCm: 0.5 }).code, 'shawl-min-rows-depth');
    // The stitch-count limit travels in the data, not in a sentence.
    assert.deepEqual(refuse({ kind: 'semicircle', rate: 'custom', customRate: 20 }), {
      code: 'shawl-first-row-into-one',
      data: { max: MAX_INTO_ONE },
    });
    assert.ok(
      /^shawl-max-/.test(refuse({ kind: 'pi', stitch: 'sc', sizeCm: 300 }).code),
      refuse({ kind: 'pi', stitch: 'sc', sizeCm: 300 }).code,
    );
  });

  test('the words for row and round stay out of the core: the data carries `shape` instead (PQW-904)', () => {
    // Where the sentence says row or round, the core gives the raw `shape` and the dictionary supplies the word.
    const withShape = ['shawl-min-rows', 'shawl-max-rows', 'shawl-max-stitches'];
    for (const patch of [
      { kind: 'circle', stitch: 'sc', sizeCm: 300 },
      { kind: 'semicircle', stitch: 'sc', sizeCm: 300 },
      { kind: 'triangle', stitch: 'sc', sizeCm: 0.5 },
    ]) {
      const result = planShawl(emptyPattern(), options(patch));
      assert.equal(result.ok, false);
      if (withShape.includes(result.reason.code)) {
        assert.ok(['row', 'round'].includes(result.reason.data.shape), why(result));
      }
      // No Hungarian sentence fragment may reach a message coming out of the core.
      assert.doesNotMatch(JSON.stringify(result.reason), /sor|kör/, why(result));
    }
  });
});

describe('every generated shawl validates cleanly, writes out and reads back', () => {
  // A counting turning chain on every stitch, single crochet included: after the foundation-chain fix (PQW-891) that is the rule for sc.
  const counting = () => ({
    ...emptyPattern(),
    conventions: { ...emptyPattern().conventions, turningChainCounts: true },
  });
  for (const [tradition, base] of [
    ['CYC', emptyPattern],
    ['Japanese', japanese],
    ['counting turning chain', counting],
  ]) {
    for (const kind of SHAWL_KINDS) {
      test(`${kind}, ${tradition} tradition: every stitch, theoretical and custom rate, adjusted to the edging`, () => {
        for (const stitch of SHAWL_STITCHES) {
          for (const patch of [
            { sizeCm: 12 },
            { sizeCm: 6, rate: 'custom', customRate: 5, wings: true, edging: { width: 4, edge: 1 } },
          ]) {
            const name = `${stitch} ${JSON.stringify(patch)}`;
            const result = generateShawl(base(), options({ kind, stitch, lengthCm: 8, ...patch }));
            if (!result.ok) {
              assert.ok(/^(shawl|shape)-(min|max|too|first)/.test(result.reason.code), `${name}: ${why(result)}`);
              continue;
            }
            const { pattern, plan } = result;
            assert.deepEqual(errors(pattern), [], name);
            if (kind === 'triangle' || kind === 'crescent')
              assert.ok(
                changes(plan.counts).every((step) => step % 2 === 0),
                `${name}: even steps`,
              );
            const library = libraryFor(pattern);
            for (const locale of ['hu', 'en-US']) {
              const back = readPattern(formatWrittenPattern(writePattern(pattern, library, locale)), {
                library,
                locale,
                conventions: pattern.conventions,
              });
              assert.ok(back.ok, `${name} ${locale}: ${JSON.stringify(back.error)}`);
              sameGraph(back.pattern, pattern);
            }
          }
        }
      });
    }
  }
});
