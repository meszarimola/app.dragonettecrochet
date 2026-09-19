/*
 * Contents of the „Forma” section (PQW-862): the choices, the field states per
 * shape, the plan printout with the actual size and the estimate notice, and
 * the preview outline.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { emptyPattern } from '../src/core/editor.ts';
import { DEFAULT_SHAPE, planShape, shapeProblem } from '../src/core/shapes.ts';
import { SHAPE_CORE_TEXTS } from '../src/ui/i18n/core/shape.ts';
import {
  MEASURE_CHOICES,
  ROUNDING_CHOICES,
  SHAPE_CHOICES,
  STITCH_CHOICES,
  generatedMessage,
  normalizeShape,
  shapeFieldState,
  shapeOutline,
  shapeReason,
  shapeView,
  widthLabel,
} from '../src/ui/shapes-view.ts';
import { formatNumber } from '../src/ui/size-view.ts';

const options = (patch = {}) => ({ ...DEFAULT_SHAPE, ...patch });
const planOf = (pattern, patch = {}) => {
  const result = planShape(pattern, options(patch));
  assert.ok(result.ok, result.reason);
  return result.plan;
};

/** Pattern with a profile in which the stitch measures the given stitches and rows per 10 cm worked flat. */
function withRowGauge(stitch, stitchesPer10cm, rowsPer10cm) {
  const profile = {
    id: 'sik',
    yarn: { name: 'Pamut', cycWeight: 4, metersPer100g: null, ballMassG: null },
    hookMm: 5,
    blocked: false,
    gauges: [{ stitch, form: 'rows', stitchesPer10cm, rowsPer10cm, source: 'measured' }],
    swatch: { widthCm: null, heightCm: null, massG: null },
  };
  return { ...emptyPattern(), gauge: { active: 'sik', profiles: [profile] } };
}

describe('choices', () => {
  test('shapes and stitches carry Hungarian labels, with height or angle and a rounding choice', () => {
    assert.deepEqual(
      SHAPE_CHOICES.map((choice) => choice.label),
      ['Téglalap', 'Derékszögű háromszög', 'Egyenlő szárú háromszög', 'Trapéz', 'Rombusz'],
    );
    assert.deepEqual(
      STITCH_CHOICES.map((choice) => choice.label),
      ['Rövidpálca', 'Félpálca', 'Egyráhajtásos pálca', 'Kétráhajtásos pálca'],
    );
    assert.deepEqual(MEASURE_CHOICES.map((choice) => choice.value), ['height', 'angle']);
    assert.deepEqual(ROUNDING_CHOICES.map((choice) => choice.value), ['nearest', 'up', 'down']);
  });
});

describe('fields per shape', () => {
  test('a rectangle offers height and pattern repeat, but no angle, top edge or height mode', () => {
    assert.deepEqual(shapeFieldState(options()), {
      topWidth: false,
      measure: false,
      height: true,
      angle: false,
      repeat: true,
      // Ribbed edging on the top edge (PQW-909).
      ribbing: true,
      ribbingFields: false,
    });
    assert.equal(shapeFieldState(options({ measure: 'angle' })).height, true);
  });

  test('a trapezoid adds the top edge, and in angle mode the angle replaces the height', () => {
    const state = shapeFieldState(options({ shape: 'trapezoid', measure: 'angle' }));
    assert.deepEqual([state.topWidth, state.measure, state.height, state.angle, state.repeat], [true, true, false, true, false]);
  });

  test('anything but a rectangle drops the pattern repeat, and the width label follows the shape', () => {
    const chosen = options({ repeat: { width: 6, edge: 2 } });
    assert.equal(normalizeShape(chosen), chosen);
    const triangle = normalizeShape({ ...chosen, shape: 'isosceles-triangle' });
    assert.equal(triangle.repeat, null);
    assert.deepEqual(['rectangle', 'trapezoid', 'diamond'].map(widthLabel), ['Szélesség, cm', 'Alsó él, cm', 'Legszélesebb sor, cm']);
  });
});

describe('the plan printout', () => {
  test('a 20 × 30 cm half double crochet rectangle without a profile: the „≈” prefix and the estimate notice', () => {
    const plan = planOf(emptyPattern());
    const view = shapeView(plan, options(), false);
    assert.match(view.size, /^Tényleges méret: ≈ \d+,\d × \d+,\d cm, \d+ sor\.$/);
    assert.equal(view.details[0], `Soronként ${plan.counts[0]} szem.`);
    assert.match(view.source, /^Nincs profil: a méret becslés 4 mm-es tűből\. Pontosabb, ha próbadarabot mérsz/);
  });

  test('with a measured profile: the exact size and the origin of the gauge', () => {
    const plan = planOf(withRowGauge('hdc', 15, 11));
    const view = shapeView(plan, options(), true);
    assert.equal(view.size, `Tényleges méret: ${formatNumber(20, 1)} × ${formatNumber(30, 1)} cm, 33 sor.`);
    assert.equal(view.source, 'A félpálca síkban mért mintasűrűségéből.');
  });

  test('isosceles triangle (03 §3.2 D): bottom and top row, the edge angle and the apex angle, evenly spread shaping', () => {
    const patch = { shape: 'isosceles-triangle', stitch: 'dc', widthCm: 20, heightCm: 15 };
    const view = shapeView(planOf(withRowGauge('dc', 16, 8), patch), options(patch), true);
    assert.equal(view.details[0], `Az alsó sor 32 szem (${formatNumber(20, 1)} cm), a felső 2 szem (${formatNumber(1.25, 1)} cm).`);
    assert.ok(view.details.includes('Az él szöge a függőlegestől kb. 32°, a csúcsszög kb. 64°.'), view.details.join('\n'));
    assert.ok(view.details.includes('A szaporítás és a fogyasztás egyenletesen elosztva, élenként soronként legfeljebb 2 egy szembe.'));
  });

  test('a steep diamond: the rows with a chain extension and the rows with stitches left unworked', () => {
    const patch = { shape: 'diamond', stitch: 'sc', widthCm: 30, heightCm: 5 };
    const view = shapeView(planOf(emptyPattern(), patch), options(patch), false);
    assert.ok(view.details.some((line) => /^Láncos hosszabbítás az? \d+\.(, \d+\.)*( és \d+\.)? sor végén\.$/.test(line)), view.details.join('\n'));
    assert.ok(view.details.some((line) => /^Meghagyott szemek az? .* sor végén: lépcsős él\.$/.test(line)), view.details.join('\n'));
  });

  test('the creation message mentions that undo brings the previous pattern back', () => {
    const plan = planOf(withRowGauge('hdc', 15, 11));
    assert.equal(generatedMessage(options(), plan), 'Téglalap, 33 sor elkészült; visszavonással a korábbi minta visszajön.');
  });
});

describe('turning a core reason into a sentence (PQW-904)', () => {
  test('the Hungarian sentence stays word for word what it is today, with the limit and the ordinal filled in from the data', () => {
    assert.equal(shapeReason(shapeProblem(options({ widthCm: Number.NaN }))), 'A szélesség 0 és 300 cm közötti szám legyen.');
    assert.equal(shapeReason({ code: 'shape-too-steep' }), 'Ilyen meredek élt ennyi sorban nem lehet horgolni: adj meg nagyobb magasságot.');
    assert.equal(
      shapeReason({ code: 'shape-row-too-narrow', data: { row: 7 } }),
      'A(z) 7. sor túl keskeny ehhez az alakításhoz: adj meg nagyobb méretet vagy laposabb élt.',
    );
  });

  test('the „ez a program hibája” cases share one code, and the data decides which sentence comes out', () => {
    assert.equal(
      shapeReason({ code: 'internal-error', data: { rule: 'unused-position' } }),
      'A generált minta nem ment át az ellenőrzőn (unused-position): ez a program hibája, kérlek, jelezd.',
    );
    assert.equal(shapeReason({ code: 'internal-error', data: { row: 4 } }), 'A(z) 4. sor szemszáma nem a terv szerinti: ez a program hibája, kérlek, jelezd.');
    assert.equal(
      shapeReason({ code: 'internal-error', data: { row: 4, shape: 'round' } }),
      'A(z) 4. kör szemszáma nem a terv szerinti: ez a program hibája, kérlek, jelezd.',
    );
    assert.equal(shapeReason({ code: 'internal-error' }), 'A sorok terve hiányos: ez a program hibája, kérlek, jelezd.');
  });

  test('the dictionary exposes the same set of codes in both languages, and the English branch carries no Hungarian accents', () => {
    const { hu, en } = SHAPE_CORE_TEXTS;
    assert.deepEqual(Object.keys(en).sort(), Object.keys(hu).sort());
    assert.ok(Object.keys(hu).length > 30, `too few codes: ${Object.keys(hu).length}`);
    // Every code has an entry of the same kind, with the same number of parameters, in both languages.
    // The rule id is raw data and is not translated: the sample value carries no accents so that the guard over the English branch does not trip on its own data.
    const sample = { max: 3, min: 2, rows: 2, row: 2, count: 2, rule: 'rule-id', shape: 'row', unit: 2, nearest: 4 };
    const render = (entry) => (typeof entry === 'string' ? entry : entry(sample));
    for (const [code, entry] of Object.entries(hu)) {
      assert.equal(typeof en[code], typeof entry, `${code}: different kind`);
      if (typeof entry === 'function') assert.equal(en[code].length, entry.length, `${code}: different parameter count`);
      assert.ok(render(entry).length > 0, `${code}: empty Hungarian text`);
      assert.doesNotMatch(render(en[code]), /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/, `${code}: Hungarian accent in the English branch`);
    }
  });
});

describe('preview', () => {
  test('rectangle: an outline at the actual size, with no stepping', () => {
    const outline = shapeOutline(planOf(withRowGauge('hdc', 15, 11)));
    assert.deepEqual([outline.width, outline.height], [20, 30]);
    const xs = new Set(outline.points.split(' ').map((point) => point.split(',')[0]));
    assert.deepEqual([...xs].sort(), ['0', '20']);
  });

  test('right triangle: the right edge is straight and the left one is stepped', () => {
    const outline = shapeOutline(planOf(withRowGauge('sc', 16, 18), { shape: 'right-triangle', stitch: 'sc', widthCm: 15, heightCm: 20 }));
    const points = outline.points.split(' ').map((point) => point.split(',').map(Number));
    assert.equal(Math.max(...points.map(([x]) => x)), outline.width);
    assert.ok(new Set(points.map(([x]) => x)).size > 10);
    assert.equal(points.filter(([x]) => x === outline.width).length, 72);
  });
});
