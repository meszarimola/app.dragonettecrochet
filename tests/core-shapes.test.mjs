/*
 * Flat shapes from centimetres (PQW-862): the worked examples of the knowledge
 * base (03 §3.1 A–D, §7.1 H), even shaping along the edges, chain extensions
 * and unworked stitches, rounding to the stitch repeat, and that every
 * generated pattern validates cleanly, writes out and reads back.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { canonicalPattern } from '../src/core/canonical.ts';
import { emptyPattern } from '../src/core/editor.ts';
import { buildPieceGraph } from '../src/core/graph.ts';
import { readPattern } from '../src/core/pattern-read.ts';
import { formatWrittenPattern, writePattern } from '../src/core/pattern-text.ts';
import {
  DEFAULT_SHAPE,
  FLAT_SHAPES,
  MAX_EDGE_CHANGE,
  MAX_SHAPE_CM,
  SHAPE_STITCHES,
  generateShape,
  planShape,
  rowExtents,
  shapeProblem,
} from '../src/core/shapes.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { withTradition } from '../src/core/tradition.ts';
import { validatePattern } from '../src/core/validate.ts';
import { dcRectangle, hdcRectangle } from './fixtures/examples.ts';

/** A pattern whose profile measures the stitch at the given stitches and rows per 10 cm in rows. */
function withRowGauge(stitch, stitchesPer10cm, rowsPer10cm, pattern = emptyPattern()) {
  const profile = {
    id: 'sik',
    yarn: { name: 'Pamut', cycWeight: 4, metersPer100g: null, ballMassG: null },
    hookMm: 5,
    blocked: false,
    gauges: [{ stitch, form: 'rows', stitchesPer10cm, rowsPer10cm, source: 'measured' }],
    swatch: { widthCm: null, heightCm: null, massG: null },
  };
  return { ...pattern, gauge: { active: 'sik', profiles: [profile] } };
}

const japanese = () => ({ ...emptyPattern(), conventions: withTradition(emptyPattern().conventions, 'japanese') });

/** The core gives a code and data as the reason (PQW-904); that is enough for the failure message. */
const why = (result) => (result.ok ? '' : JSON.stringify(result.reason));
const shape = (pattern, patch) => {
  const result = generateShape(pattern, { ...DEFAULT_SHAPE, ...patch });
  assert.ok(result.ok, why(result));
  return result;
};
const plan = (pattern, patch) => {
  const result = planShape(pattern, { ...DEFAULT_SHAPE, ...patch });
  assert.ok(result.ok, why(result));
  return result.plan;
};
const changes = (counts) => counts.slice(1).map((count, i) => count - counts[i]);
const findings = (pattern) => validatePattern(pattern, libraryFor(pattern));
const leadingChains = (piece) => piece.stitches.findIndex((node) => node.def !== 'ch');
const pieceOf = (pattern) => canonicalPattern(pattern).pieces[0];
const sameGraph = (a, b) => {
  const [x, y] = [pieceOf(a), pieceOf(b)];
  assert.deepEqual(x.stitches, y.stitches);
  assert.deepEqual(x.groups, y.groups);
  assert.deepEqual(x.events, y.events);
  assert.deepEqual(x.skipped, y.skipped);
};

describe('rectangle (03 §3.1 A, B)', () => {
  test('A: 10 × 20 cm in hdc at a 15 × 11 gauge is 15 stitches × 22 rows on a 17-chain foundation, matching the worked example graph', () => {
    const { pattern, plan } = shape(withRowGauge('hdc', 15, 11), { stitch: 'hdc', widthCm: 10, heightCm: 20 });
    assert.deepEqual(plan.counts, Array(22).fill(15));
    assert.equal(leadingChains(pattern.pieces[0]), 17);
    assert.deepEqual(findings(pattern), []);
    sameGraph(pattern, hdcRectangle().pattern);
  });

  test('B: in dc at a 16 × 8 gauge it is 16 stitches × 16 rows, and the counting turning chain plus its foundation chain make 19 chains (PQW-891)', () => {
    const { pattern, plan } = shape(withRowGauge('dc', 16, 8), { stitch: 'dc', widthCm: 10, heightCm: 20 });
    assert.deepEqual(plan.counts, Array(16).fill(16));
    assert.equal(leadingChains(pattern.pieces[0]), 19);
    assert.deepEqual(findings(pattern), []);
    sameGraph(pattern, dcRectangle().pattern);
  });

  test('the finished size follows from the rounded stitch and row counts', () => {
    const result = plan(withRowGauge('hdc', 15, 11), { stitch: 'hdc', widthCm: 20.3, heightCm: 30 });
    assert.equal(result.counts[0], 30);
    assert.equal(result.counts.length, 33);
    assert.ok(Math.abs(result.widthCm - 20) < 1e-9);
    assert.ok(Math.abs(result.heightCm - 30) < 1e-9);
    assert.equal(result.angleDeg, null);
  });

  test('without a profile the gauge is estimated from the hook, with a measured profile it is measured', () => {
    assert.equal(plan(emptyPattern(), {}).gauge.source, 'estimated');
    assert.equal(plan(emptyPattern(), {}).gauge.basis, 'hook');
    assert.equal(plan(withRowGauge('hdc', 15, 11), {}).gauge.source, 'measured');
  });

  test('the shape name replaces the default title and an earlier generated one, but a user-given title is kept', () => {
    assert.equal(shape(emptyPattern(), {}).pattern.title, 'Téglalap');
    assert.equal(shape(emptyPattern('Lapos kör'), { shape: 'right-triangle', widthCm: 10, heightCm: 10 }).pattern.title, 'Derékszögű háromszög');
    assert.equal(shape(emptyPattern('Nyári takaró'), {}).pattern.title, 'Nyári takaró');
  });
});

describe('stitch repeat: "multiple of X + Y" (03 §4.1, 05 §4.2)', () => {
  // Single crochet at 20 stitches / 10 cm: exactly 40 stitches over 20 cm; the multiples of 6 + 2 with the counting turning chain (+1) are 39 and 45.
  const sc = () => withRowGauge('sc', 20, 20);
  const width = (patch) => plan(sc(), { stitch: 'sc', widthCm: 20, heightCm: 5, repeat: { width: 6, edge: 2 }, ...patch });

  test('rounding to the nearest, up (wider) and down (narrower)', () => {
    assert.deepEqual([width({}).counts[0], width({}).repeats], [38, 6]);
    assert.deepEqual([width({ rounding: 'up' }).counts[0], width({ rounding: 'up' }).repeats], [44, 7]);
    assert.equal(width({ rounding: 'down' }).counts[0], 38);
  });

  test('a tie rounds towards the wider side', () => {
    // 21 cm = 42 stitches, exactly halfway between 39 and 45.
    assert.equal(width({ widthCm: 21 }).counts[0], 44);
  });

  test('the repeat becomes a pattern convention, and the validator finds the repeat balanced', () => {
    const { pattern } = shape(sc(), { stitch: 'sc', widthCm: 20, heightCm: 5, repeat: { width: 6, edge: 2 } });
    assert.deepEqual(pattern.conventions.repeat, { repeatWidth: 6, edgeStitches: 2, turningChainIncluded: false });
    assert.deepEqual(findings(pattern), []);
  });
});

describe('sloped edge (03 §3.2, §3.4; 05 §4.4)', () => {
  test('C: a 15 × 20 cm right triangle in sc at 16 × 18 runs from 24 stitches to 2 over 36 rows, 22 decreases, at most one per row; the counting turning chain keeps the smallest row at 2 stitches', () => {
    const { pattern, plan } = shape(withRowGauge('sc', 16, 18), { shape: 'right-triangle', stitch: 'sc', widthCm: 15, heightCm: 20 });
    assert.equal(plan.counts.length, 36);
    assert.equal(plan.counts[0], 24);
    assert.equal(plan.counts.at(-1), 2);
    const steps = changes(plan.counts);
    assert.ok(steps.every((step) => step === 0 || step === -1));
    assert.equal(steps.filter((step) => step === -1).length, 22);
    // One edge stays straight: each row changes at one end only.
    assert.ok(plan.shaping.every((row) => row.start === 0 || row.end === 0));
    assert.deepEqual(findings(pattern), []);
  });

  test('D: a 20 × 15 cm isosceles triangle in dc at 16 × 8 runs from 32 stitches to 2 over 12 rows, in even steps, using dc3tog', () => {
    const { pattern, plan } = shape(withRowGauge('dc', 16, 8), { shape: 'isosceles-triangle', stitch: 'dc', widthCm: 20, heightCm: 15 });
    assert.equal(plan.counts.length, 12);
    assert.deepEqual([plan.counts[0], plan.counts.at(-1)], [32, 2]);
    assert.ok(changes(plan.counts).every((step) => step === -2 || step === -4));
    // Every row stays within one stitch per edge of the linear target (32 → 2).
    plan.counts.forEach((count, k) => assert.ok(Math.abs(count - (32 - (30 * k) / 11)) <= 2, `row ${k + 1}: ${count}`));
    assert.ok(pattern.pieces[0].stitches.some((node) => node.def === 'dc3tog'));
    assert.deepEqual(findings(pattern), []);
  });

  test('from an angle: in sc at 16 × 18 one decrease per row is about 48.4° (03 §3.2 table)', () => {
    const result = plan(withRowGauge('sc', 16, 18), { shape: 'right-triangle', stitch: 'sc', widthCm: 15, measure: 'angle', angleDeg: 48.4 });
    const steps = changes(result.counts);
    assert.ok(steps.filter((step) => step === -1).length >= steps.length - 1, steps.join(','));
    assert.ok(Math.abs(result.angleDeg - 48.4) < 1.5, String(result.angleDeg));
  });

  test('trapezoid: the top edge lands near the requested width in even steps, widening as well as narrowing', () => {
    const narrowing = plan(withRowGauge('sc', 20, 20), { shape: 'trapezoid', stitch: 'sc', widthCm: 20, topWidthCm: 12, heightCm: 10 });
    assert.deepEqual([narrowing.counts[0], narrowing.counts.at(-1)], [40, 24]);
    const widening = plan(withRowGauge('sc', 20, 20), { shape: 'trapezoid', stitch: 'sc', widthCm: 12, topWidthCm: 20, heightCm: 10 });
    assert.deepEqual([widening.counts[0], widening.counts.at(-1)], [24, 40]);
    for (const result of [narrowing, widening]) assert.ok(changes(result.counts).every((step) => step % 2 === 0));
  });

  test('diamond: it increases from the tip to the widest row and mirrors that decreasing; the tip is 2 or 3 stitches by parity, never under 2 because of the counting turning chain', () => {
    const odd = plan(withRowGauge('sc', 20, 20), { shape: 'diamond', stitch: 'sc', widthCm: 10.5, heightCm: 10.5 });
    const { counts } = odd;
    assert.equal(counts.length, 21);
    assert.deepEqual([counts[0], counts[10], counts.at(-1)], [3, 21, 3]);
    assert.equal(counts.indexOf(Math.max(...counts)), 10);
    assert.deepEqual(counts.slice(0, 11), [...counts.slice(10)].reverse());
    assert.ok(changes(counts).every((step) => step % 2 === 0));
    const even = plan(withRowGauge('sc', 20, 20), { shape: 'diamond', stitch: 'sc', widthCm: 10, heightCm: 10.5 });
    assert.deepEqual([even.counts[0], Math.max(...even.counts), even.counts.at(-1)], [2, 20, 2]);
  });

  test('row extents: an odd row starts at the right edge and ends at the left, and the width is the stitch count', () => {
    const result = plan(withRowGauge('sc', 16, 18), { shape: 'right-triangle', stitch: 'sc', widthCm: 15, heightCm: 20 });
    const extents = rowExtents(result);
    extents.forEach((row, k) => assert.equal(row.right - row.left, result.counts[k]));
    // The sloped edge is the left one: the right edge stays straight.
    assert.ok(extents.every((row) => row.right === 24));
  });

  test('at most 2 into one stitch per edge per row: a steep decrease leaves stitches unworked at the end of the row, along with the top of the counting turning chain', () => {
    const { pattern, plan } = shape(emptyPattern(), { shape: 'isosceles-triangle', stitch: 'dc', widthCm: 30, heightCm: 6 });
    assert.ok(plan.shaping.every((row) => row.start >= -MAX_EDGE_CHANGE && row.end <= MAX_EDGE_CHANGE));
    assert.ok(plan.unworkedRows.length > 0);
    assert.ok(changes(plan.counts).every((step) => step % 2 === 0));
    const piece = pattern.pieces[0];
    assert.ok(piece.skipped.length > 0);
    assert.deepEqual(findings(pattern), []);
    assert.match(formatWrittenPattern(writePattern(pattern, libraryFor(pattern), 'hu')), /\d+ szem kihagyása \(\d+ szem\)\. Fordítás\./);

    // Without the unworked stitches marked the validator reports a finding: that marking is what makes the row end sound.
    const unmarked = { ...pattern, pieces: [{ ...piece, skipped: [] }] };
    const rules = new Set(findings(unmarked).map((finding) => finding.rule));
    assert.ok(rules.has('turning-chain-placement') || rules.has('unused-position'), [...rules].join(', '));
  });

  test('at most 2 into one stitch per edge per row: a steep increase extends the end of the previous row with chains', () => {
    const { pattern, plan } = shape(emptyPattern(), { shape: 'diamond', stitch: 'sc', widthCm: 30, heightCm: 5 });
    assert.ok(plan.chainExtensionRows.length > 0);
    assert.ok(plan.shaping.every((row) => row.start >= -MAX_EDGE_CHANGE && row.end <= MAX_EDGE_CHANGE));
    for (const row of plan.chainExtensionRows) {
      const graph = buildPieceGraph(pattern, pattern.pieces[0], libraryFor(pattern));
      const layer = graph.layers[row];
      assert.equal(graph.defs.get(layer.stitches.at(-1)).kind, 'chain', `chain at the end of row ${row}`);
    }
    assert.deepEqual(findings(pattern), []);
  });

  test('what cannot be crocheted comes back as a readable code with data (PQW-904)', () => {
    const refuse = (patch) => {
      const result = planShape(emptyPattern(), { ...DEFAULT_SHAPE, ...patch });
      assert.equal(result.ok, false);
      return result.reason;
    };
    assert.equal(refuse({ shape: 'right-triangle', stitch: 'tr', widthCm: 30, heightCm: 4 }).code, 'shape-too-steep');
    assert.equal(refuse({ widthCm: 0.2 }).code, 'shape-too-narrow');
    // The row count travels in the data: a diamond needs at least 3 rows.
    assert.deepEqual(refuse({ shape: 'diamond', heightCm: 0.5 }), { code: 'shape-min-rows', data: { rows: 3 } });
    assert.equal(refuse({ shape: 'trapezoid', widthCm: 10, topWidthCm: 10, measure: 'angle' }).code, 'shape-trapezoid-equal-edges');
  });
});

describe('validating the options', () => {
  test('a stitch repeat is rectangle-only for now, and size and angle must stay in range', () => {
    assert.equal(shapeProblem({ ...DEFAULT_SHAPE, shape: 'diamond', repeat: { width: 4, edge: 1 } }).code, 'shape-repeat-rectangle-only');
    assert.equal(shapeProblem({ ...DEFAULT_SHAPE, shape: 'trapezoid' }), null);
    // The limit travels in the data, not in a sentence (PQW-904).
    assert.deepEqual(shapeProblem({ ...DEFAULT_SHAPE, widthCm: Number.NaN }), { code: 'shape-width-range', data: { max: MAX_SHAPE_CM } });
    assert.equal(shapeProblem({ ...DEFAULT_SHAPE, shape: 'isosceles-triangle', measure: 'angle', angleDeg: 90 }).code, 'shape-angle-range');
    assert.equal(shapeProblem({ ...DEFAULT_SHAPE, repeat: { width: 0, edge: 1 } }).code, 'shape-repeat-width-range');
    assert.equal(shapeProblem({ ...DEFAULT_SHAPE, stitch: 'sc2tog' }).code, 'shape-basic-stitch-only');
    assert.equal(shapeProblem(DEFAULT_SHAPE), null);
  });
});

describe('every generated pattern validates cleanly, writes out and reads back', () => {
  const sizes = [
    [20, 30],
    [30, 5],
    [6, 20],
  ];
  for (const [tradition, base] of [
    ['CYC', emptyPattern],
    ['Japanese', japanese],
  ]) {
    for (const flat of FLAT_SHAPES) {
      test(`${flat}, ${tradition} tradition: every stitch and every size`, () => {
        for (const stitch of SHAPE_STITCHES) {
          for (const [widthCm, heightCm] of sizes) {
            const name = `${stitch} ${widthCm} × ${heightCm}`;
            const result = generateShape(base(), { ...DEFAULT_SHAPE, shape: flat, stitch, widthCm, heightCm, topWidthCm: widthCm / 3 });
            if (!result.ok) {
              const expected = ['shape-too-steep', 'shape-min-rows', 'shape-too-narrow', 'shape-row-too-narrow'];
              assert.ok(expected.includes(result.reason.code), `${name}: ${why(result)}`);
              continue;
            }
            const { pattern, plan } = result;
            assert.deepEqual(findings(pattern), [], name);
            if (flat !== 'right-triangle') assert.ok(changes(plan.counts).every((step) => step % 2 === 0), `${name}: even steps`);
            const library = libraryFor(pattern);
            for (const locale of ['hu', 'en-US', 'en-GB']) {
              const back = readPattern(formatWrittenPattern(writePattern(pattern, library, locale)), { library, locale, conventions: pattern.conventions });
              assert.ok(back.ok, `${name} ${locale}: ${JSON.stringify(back.error)}`);
              sameGraph(back.pattern, pattern);
            }
          }
        }
      });
    }
  }
});
