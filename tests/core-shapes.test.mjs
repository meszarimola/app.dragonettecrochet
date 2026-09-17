/*
 * Sík formák cm-ből (PQW-862): a tudásbázis kidolgozott példái (03 §3.1 A–D,
 * §7.1 H), az élek egyenletes alakítása, a láncos hosszabbítás és a meghagyott
 * szemek, a mintaismétlés kerekítése, és hogy minden generált minta
 * hibátlanul átmegy az ellenőrzőn, kiírható és visszaolvasható.
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

/** Minta profillal, amelyben a szem síkban mérve adott szem és sor 10 cm-en. */
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

/** A mag kódot és adatot ad az indokra (PQW-904); a hibaüzenethez ez elég. */
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

describe('téglalap (03 §3.1 A, B)', () => {
  test('A: 10 × 20 cm félpálcával, 15 × 11 mintasűrűséggel 15 szem × 22 sor, 17 láncszemes láncalap: a kidolgozott példa gráfja', () => {
    const { pattern, plan } = shape(withRowGauge('hdc', 15, 11), { stitch: 'hdc', widthCm: 10, heightCm: 20 });
    assert.deepEqual(plan.counts, Array(22).fill(15));
    assert.equal(leadingChains(pattern.pieces[0]), 17);
    assert.deepEqual(findings(pattern), []);
    sameGraph(pattern, hdcRectangle().pattern);
  });

  test('B: pálcával 16 × 8 mintasűrűséggel 16 szem × 16 sor; a számító fordulólánc és az alapláncszeme miatt 19 láncszem (PQW-891)', () => {
    const { pattern, plan } = shape(withRowGauge('dc', 16, 8), { stitch: 'dc', widthCm: 10, heightCm: 20 });
    assert.deepEqual(plan.counts, Array(16).fill(16));
    assert.equal(leadingChains(pattern.pieces[0]), 19);
    assert.deepEqual(findings(pattern), []);
    sameGraph(pattern, dcRectangle().pattern);
  });

  test('a tényleges méret a kerekített szem- és sorszámból', () => {
    const result = plan(withRowGauge('hdc', 15, 11), { stitch: 'hdc', widthCm: 20.3, heightCm: 30 });
    assert.equal(result.counts[0], 30);
    assert.equal(result.counts.length, 33);
    assert.ok(Math.abs(result.widthCm - 20) < 1e-9);
    assert.ok(Math.abs(result.heightCm - 30) < 1e-9);
    assert.equal(result.angleDeg, null);
  });

  test('profil nélkül becslés a tűből, mért profillal mérés', () => {
    assert.equal(plan(emptyPattern(), {}).gauge.source, 'estimated');
    assert.equal(plan(emptyPattern(), {}).gauge.basis, 'hook');
    assert.equal(plan(withRowGauge('hdc', 15, 11), {}).gauge.source, 'measured');
  });

  test('a cím: az alapértelmezett és a generátor adta cím helyett a forma neve, a saját cím marad', () => {
    assert.equal(shape(emptyPattern(), {}).pattern.title, 'Téglalap');
    assert.equal(shape(emptyPattern('Lapos kör'), { shape: 'right-triangle', widthCm: 10, heightCm: 10 }).pattern.title, 'Derékszögű háromszög');
    assert.equal(shape(emptyPattern('Nyári takaró'), {}).pattern.title, 'Nyári takaró');
  });
});

describe('mintaismétlés: „X többszöröse + Y” (03 §4.1, 05 §4.2)', () => {
  // Rövidpálca 20 szem / 10 cm: 20 cm-en pontosan 40 szem; 6 + 2 többszörösei a számító fordulólánccal (+1): 39, 45.
  const sc = () => withRowGauge('sc', 20, 20);
  const width = (patch) => plan(sc(), { stitch: 'sc', widthCm: 20, heightCm: 5, repeat: { width: 6, edge: 2 }, ...patch });

  test('a legközelebbi, felfelé (bővebb) és lefelé (szűkebb) kerekítés', () => {
    assert.deepEqual([width({}).counts[0], width({}).repeats], [38, 6]);
    assert.deepEqual([width({ rounding: 'up' }).counts[0], width({ rounding: 'up' }).repeats], [44, 7]);
    assert.equal(width({ rounding: 'down' }).counts[0], 38);
  });

  test('félúton a bővebb irányba', () => {
    // 21 cm = 42 szem, pontosan 39 és 45 között.
    assert.equal(width({ widthCm: 21 }).counts[0], 44);
  });

  test('a minta konvenciója az ismétlés lesz, és az ellenőrző ismétlési egyensúlya is rendben', () => {
    const { pattern } = shape(sc(), { stitch: 'sc', widthCm: 20, heightCm: 5, repeat: { width: 6, edge: 2 } });
    assert.deepEqual(pattern.conventions.repeat, { repeatWidth: 6, edgeStitches: 2, turningChainIncluded: false });
    assert.deepEqual(findings(pattern), []);
  });
});

describe('ferde él (03 §3.2, §3.4; 05 §4.4)', () => {
  test('C: derékszögű háromszög 15 × 20 cm, rövidpálca 16 × 18: 24 szemről 2-re 36 soron, 22 fogyasztás, soronként legfeljebb 1; a számító fordulólánc miatt a legkisebb sor 2 szem', () => {
    const { pattern, plan } = shape(withRowGauge('sc', 16, 18), { shape: 'right-triangle', stitch: 'sc', widthCm: 15, heightCm: 20 });
    assert.equal(plan.counts.length, 36);
    assert.equal(plan.counts[0], 24);
    assert.equal(plan.counts.at(-1), 2);
    const steps = changes(plan.counts);
    assert.ok(steps.every((step) => step === 0 || step === -1));
    assert.equal(steps.filter((step) => step === -1).length, 22);
    // Az egyik él egyenes: a változás soronként csak a sor egyik végén van.
    assert.ok(plan.shaping.every((row) => row.start === 0 || row.end === 0));
    assert.deepEqual(findings(pattern), []);
  });

  test('D: egyenlő szárú háromszög 20 × 15 cm, pálca 16 × 8: 32 szemről 2-re 12 soron, páros változással, 3 pálca összehorgolásával', () => {
    const { pattern, plan } = shape(withRowGauge('dc', 16, 8), { shape: 'isosceles-triangle', stitch: 'dc', widthCm: 20, heightCm: 15 });
    assert.equal(plan.counts.length, 12);
    assert.deepEqual([plan.counts[0], plan.counts.at(-1)], [32, 2]);
    assert.ok(changes(plan.counts).every((step) => step === -2 || step === -4));
    // A lineáris céltól (32 → 2) soronként legfeljebb egy szemnyit tér el élenként.
    plan.counts.forEach((count, k) => assert.ok(Math.abs(count - (32 - (30 * k) / 11)) <= 2, `${k + 1}. sor: ${count}`));
    assert.ok(pattern.pieces[0].stitches.some((node) => node.def === 'dc3tog'));
    assert.deepEqual(findings(pattern), []);
  });

  test('szögből: rövidpálcánál 16 × 18-nál soronként 1 fogyasztás kb. 48,4° (03 §3.2 táblázat)', () => {
    const result = plan(withRowGauge('sc', 16, 18), { shape: 'right-triangle', stitch: 'sc', widthCm: 15, measure: 'angle', angleDeg: 48.4 });
    const steps = changes(result.counts);
    assert.ok(steps.filter((step) => step === -1).length >= steps.length - 1, steps.join(','));
    assert.ok(Math.abs(result.angleDeg - 48.4) < 1.5, String(result.angleDeg));
  });

  test('trapéz: a felső él a megadott szélesség közelében, páros változással; szélesedő trapéz is', () => {
    const narrowing = plan(withRowGauge('sc', 20, 20), { shape: 'trapezoid', stitch: 'sc', widthCm: 20, topWidthCm: 12, heightCm: 10 });
    assert.deepEqual([narrowing.counts[0], narrowing.counts.at(-1)], [40, 24]);
    const widening = plan(withRowGauge('sc', 20, 20), { shape: 'trapezoid', stitch: 'sc', widthCm: 12, topWidthCm: 20, heightCm: 10 });
    assert.deepEqual([widening.counts[0], widening.counts.at(-1)], [24, 40]);
    for (const result of [narrowing, widening]) assert.ok(changes(result.counts).every((step) => step % 2 === 0));
  });

  test('rombusz: csúcsról a legszélesebb sorig szaporít, onnan ugyanúgy fogyaszt; a csúcs a sor párosságától 2 vagy 3 szem, mert a számító fordulólánc miatt legalább 2', () => {
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

  test('a sorok széle: a páratlan sor eleje a jobb, a vége a bal szélen; a szélesség a szemszám', () => {
    const result = plan(withRowGauge('sc', 16, 18), { shape: 'right-triangle', stitch: 'sc', widthCm: 15, heightCm: 20 });
    const extents = rowExtents(result);
    extents.forEach((row, k) => assert.equal(row.right - row.left, result.counts[k]));
    // A ferde él a bal oldali: a jobb szél egyenes.
    assert.ok(extents.every((row) => row.right === 24));
  });

  test('élenként soronként legfeljebb 2 egy szembe: meredek fogyasztásnál a sor végén meghagyott szemek, a számító fordulólánc tetejével', () => {
    const { pattern, plan } = shape(emptyPattern(), { shape: 'isosceles-triangle', stitch: 'dc', widthCm: 30, heightCm: 6 });
    assert.ok(plan.shaping.every((row) => row.start >= -MAX_EDGE_CHANGE && row.end <= MAX_EDGE_CHANGE));
    assert.ok(plan.unworkedRows.length > 0);
    assert.ok(changes(plan.counts).every((step) => step % 2 === 0));
    const piece = pattern.pieces[0];
    assert.ok(piece.skipped.length > 0);
    assert.deepEqual(findings(pattern), []);
    assert.match(formatWrittenPattern(writePattern(pattern, libraryFor(pattern), 'hu')), /\d+ szem kihagyása \(\d+ szem\)\. Fordítás\./);

    // A meghagyott szemek jelölése nélkül az ellenőrző hibát jelez: ettől jó a sor vége.
    const unmarked = { ...pattern, pieces: [{ ...piece, skipped: [] }] };
    const rules = new Set(findings(unmarked).map((finding) => finding.rule));
    assert.ok(rules.has('turning-chain-placement') || rules.has('unused-position'), [...rules].join(', '));
  });

  test('élenként soronként legfeljebb 2 egy szembe: meredek szaporításnál láncos hosszabbítás az előző sor végén', () => {
    const { pattern, plan } = shape(emptyPattern(), { shape: 'diamond', stitch: 'sc', widthCm: 30, heightCm: 5 });
    assert.ok(plan.chainExtensionRows.length > 0);
    assert.ok(plan.shaping.every((row) => row.start >= -MAX_EDGE_CHANGE && row.end <= MAX_EDGE_CHANGE));
    for (const row of plan.chainExtensionRows) {
      const graph = buildPieceGraph(pattern, pattern.pieces[0], libraryFor(pattern));
      const layer = graph.layers[row];
      assert.equal(graph.defs.get(layer.stitches.at(-1)).kind, 'chain', `${row}. sor végén láncszem`);
    }
    assert.deepEqual(findings(pattern), []);
  });

  test('ami nem horgolható, arra érthető kód és adat jön (PQW-904)', () => {
    const refuse = (patch) => {
      const result = planShape(emptyPattern(), { ...DEFAULT_SHAPE, ...patch });
      assert.equal(result.ok, false);
      return result.reason;
    };
    assert.equal(refuse({ shape: 'right-triangle', stitch: 'tr', widthCm: 30, heightCm: 4 }).code, 'shape-too-steep');
    assert.equal(refuse({ widthCm: 0.2 }).code, 'shape-too-narrow');
    // A sorok száma az adatba kerül: a rombuszhoz legalább 3 sor kell.
    assert.deepEqual(refuse({ shape: 'diamond', heightCm: 0.5 }), { code: 'shape-min-rows', data: { rows: 3 } });
    assert.equal(refuse({ shape: 'trapezoid', widthCm: 10, topWidthCm: 10, measure: 'angle' }).code, 'shape-trapezoid-equal-edges');
  });
});

describe('a választások ellenőrzése', () => {
  test('mintaismétlés most csak téglalapnál; a méret és a szög tartományban', () => {
    assert.equal(shapeProblem({ ...DEFAULT_SHAPE, shape: 'diamond', repeat: { width: 4, edge: 1 } }).code, 'shape-repeat-rectangle-only');
    assert.equal(shapeProblem({ ...DEFAULT_SHAPE, shape: 'trapezoid' }), null);
    // A határ az adatba kerül, nem a mondatba (PQW-904).
    assert.deepEqual(shapeProblem({ ...DEFAULT_SHAPE, widthCm: Number.NaN }), { code: 'shape-width-range', data: { max: MAX_SHAPE_CM } });
    assert.equal(shapeProblem({ ...DEFAULT_SHAPE, shape: 'isosceles-triangle', measure: 'angle', angleDeg: 90 }).code, 'shape-angle-range');
    assert.equal(shapeProblem({ ...DEFAULT_SHAPE, repeat: { width: 0, edge: 1 } }).code, 'shape-repeat-width-range');
    assert.equal(shapeProblem({ ...DEFAULT_SHAPE, stitch: 'sc2tog' }).code, 'shape-basic-stitch-only');
    assert.equal(shapeProblem(DEFAULT_SHAPE), null);
  });
});

describe('minden generált minta hibátlan, kiírható és visszaolvasható', () => {
  const sizes = [
    [20, 30],
    [30, 5],
    [6, 20],
  ];
  for (const [tradition, base] of [
    ['CYC', emptyPattern],
    ['japán', japanese],
  ]) {
    for (const flat of FLAT_SHAPES) {
      test(`${flat}, ${tradition} hagyomány: minden szemmel és mérettel`, () => {
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
            if (flat !== 'right-triangle') assert.ok(changes(plan.counts).every((step) => step % 2 === 0), `${name}: páros változás`);
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
