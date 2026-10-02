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
import { setUiLanguage } from '../src/ui/i18n.ts';
import { setTermsLocale } from '../src/ui/notation.ts';
import {
  generatedMessage,
  MEASURE_CHOICES,
  normalizeShape,
  ROUNDING_CHOICES,
  SHAPE_CHOICES,
  STITCH_CHOICES,
  shapeFieldState,
  shapeOutline,
  shapeReason,
  shapeView,
  widthLabel,
} from '../src/ui/shapes-view.ts';
import { formatNumber } from '../src/ui/size-view.ts';

/** Runs `run` with the interface in `language`, then restores the default. KB: interface.md §4 */
function inLanguage(language, run) {
  try {
    setUiLanguage(language);
    return run();
  } finally {
    setUiLanguage('en');
  }
}

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
  test('shapes carry labels in both interface languages, with height or angle and a rounding choice', () => {
    assert.deepEqual(
      inLanguage('en', () => SHAPE_CHOICES.map((choice) => choice.label)),
      ['Rectangle', 'Right triangle', 'Isosceles triangle', 'Trapezoid', 'Rhombus'],
    );
    assert.deepEqual(
      inLanguage('hu', () => SHAPE_CHOICES.map((choice) => choice.label)),
      ['Téglalap', 'Derékszögű háromszög', 'Egyenlő szárú háromszög', 'Trapéz', 'Rombusz'],
    );
    assert.deepEqual(
      MEASURE_CHOICES.map((choice) => choice.value),
      ['height', 'angle'],
    );
    assert.deepEqual(
      ROUNDING_CHOICES.map((choice) => choice.value),
      ['nearest', 'up', 'down'],
    );
  });

  test('the stitch names follow the notation, not the interface language (PQW-920)', () => {
    const inTerms = (terms) => {
      try {
        setTermsLocale(terms);
        return inLanguage('en', () => STITCH_CHOICES.map((choice) => choice.label));
      } finally {
        setTermsLocale('en-US');
      }
    };
    assert.deepEqual(inTerms('hu'), ['Rövidpálca', 'Félpálca', 'Egyráhajtásos pálca', 'Kétráhajtásos pálca']);
    assert.deepEqual(inTerms('en-US'), ['Single crochet', 'Half double crochet', 'Double crochet', 'Treble']);
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
    assert.deepEqual(
      [state.topWidth, state.measure, state.height, state.angle, state.repeat],
      [true, true, false, true, false],
    );
  });

  test('anything but a rectangle drops the pattern repeat, and the width label follows the shape', () => {
    const chosen = options({ repeat: { width: 6, edge: 2 } });
    assert.equal(normalizeShape(chosen), chosen);
    const triangle = normalizeShape({ ...chosen, shape: 'isosceles-triangle' });
    assert.equal(triangle.repeat, null);
    assert.deepEqual(['rectangle', 'trapezoid', 'diamond'].map(widthLabel), [
      'Width, cm',
      'Bottom edge, cm',
      'Widest row, cm',
    ]);
  });
});

describe('the plan printout', () => {
  test('a 20 × 30 cm half double crochet rectangle without a profile: the „≈” prefix and the estimate notice', () => {
    const plan = planOf(emptyPattern());
    const view = shapeView(plan, options(), false);
    assert.match(view.size, /^Finished size: ≈ \d+\.\d × \d+\.\d cm, \d+ rows\.$/);
    assert.equal(view.details[0], `${plan.counts[0]} stitches per row.`);
    assert.match(
      view.source,
      /^No profile: the size is an estimate from a 4 mm hook\. It is more accurate if you measure a swatch/,
    );
  });

  test('with a measured profile: the exact size and the origin of the gauge', () => {
    const plan = planOf(withRowGauge('hdc', 15, 11));
    const view = shapeView(plan, options(), true);
    assert.equal(view.size, `Finished size: ${formatNumber(20, 1)} × ${formatNumber(30, 1)} cm, 33 rows.`);
    assert.equal(view.source, 'From the gauge measured in rows gauge of half double crochet.');
  });

  test('isosceles triangle (03 §3.2 D): bottom and top row, the edge angle and the apex angle, evenly spread shaping', () => {
    const patch = { shape: 'isosceles-triangle', stitch: 'dc', widthCm: 20, heightCm: 15 };
    const view = shapeView(planOf(withRowGauge('dc', 16, 8), patch), options(patch), true);
    assert.equal(
      view.details[0],
      `The bottom row is 32 stitches (${formatNumber(20, 1)} cm), the top 2 stitches (${formatNumber(1.25, 1)} cm).`,
    );
    assert.ok(
      view.details.includes('The edge is about 32° from the vertical, the apex angle about 64°.'),
      view.details.join('\n'),
    );
    assert.ok(
      view.details.includes('Increases and decreases spread evenly, at most 2 into one stitch per edge and row.'),
    );
  });

  test('a steep diamond: the rows with a chain extension and the rows with stitches left unworked', () => {
    const patch = { shape: 'diamond', stitch: 'sc', widthCm: 30, heightCm: 5 };
    const view = shapeView(planOf(emptyPattern(), patch), options(patch), false);
    assert.ok(
      view.details.some((line) => /^Chain extension at the end of rows \d+(, \d+)*( and \d+)?\.$/.test(line)),
      view.details.join('\n'),
    );
    assert.ok(
      view.details.some((line) => /^Stitches left unworked at the end of rows .*: a stepped edge\.$/.test(line)),
      view.details.join('\n'),
    );
  });

  test('the creation message mentions that undo brings the previous pattern back', () => {
    const plan = planOf(withRowGauge('hdc', 15, 11));
    assert.equal(generatedMessage(options(), plan), 'Rectangle: 33 rows done; undo brings the previous one back.');
  });
});

describe('turning a core reason into a sentence (PQW-904)', () => {
  test('the Hungarian sentence stays word for word what it is today, with the limit and the ordinal filled in from the data', () => {
    inLanguage('hu', () => {
      assert.equal(
        shapeReason(shapeProblem(options({ widthCm: Number.NaN }))),
        'A szélesség 0 és 300 cm közötti szám legyen.',
      );
      assert.equal(
        shapeReason({ code: 'shape-too-steep' }),
        'Ilyen meredek élt ennyi sorban nem lehet horgolni: adj meg nagyobb magasságot.',
      );
      assert.equal(
        shapeReason({ code: 'shape-row-too-narrow', data: { row: 7 } }),
        'A(z) 7. sor túl keskeny ehhez az alakításhoz: adj meg nagyobb méretet vagy laposabb élt.',
      );
    });
  });

  test('the English sentence is what the default interface shows, with the limit filled in from the data (PQW-1100)', () => {
    assert.equal(
      shapeReason(shapeProblem(options({ widthCm: Number.NaN }))),
      'The width should be a number between 0 and 300 cm.',
    );
    assert.equal(
      shapeReason({ code: 'shape-too-steep' }),
      'Such a steep edge cannot be crocheted in this many rows: give a larger height.',
    );
    assert.equal(
      shapeReason({ code: 'shape-row-too-narrow', data: { row: 7 } }),
      'Row 7 is too narrow for this shaping: give a larger size or a flatter edge.',
    );
  });

  test('the „this is a bug” cases share one code, and the data decides which sentence comes out', () => {
    inLanguage('hu', () => {
      assert.equal(
        shapeReason({ code: 'internal-error', data: { rule: 'unused-position' } }),
        'A generált minta nem ment át az ellenőrzőn (unused-position): ez a program hibája, kérlek, jelezd.',
      );
      assert.equal(
        shapeReason({ code: 'internal-error', data: { row: 4 } }),
        'A(z) 4. sor szemszáma nem a terv szerinti: ez a program hibája, kérlek, jelezd.',
      );
      assert.equal(
        shapeReason({ code: 'internal-error', data: { row: 4, shape: 'round' } }),
        'A(z) 4. kör szemszáma nem a terv szerinti: ez a program hibája, kérlek, jelezd.',
      );
      assert.equal(
        shapeReason({ code: 'internal-error' }),
        'A sorok terve hiányos: ez a program hibája, kérlek, jelezd.',
      );
    });
    assert.equal(
      shapeReason({ code: 'internal-error', data: { rule: 'unused-position' } }),
      'The generated pattern did not pass the checker (unused-position): this is a bug, please report it.',
    );
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
      if (typeof entry === 'function')
        assert.equal(en[code].length, entry.length, `${code}: different parameter count`);
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
    const outline = shapeOutline(
      planOf(withRowGauge('sc', 16, 18), { shape: 'right-triangle', stitch: 'sc', widthCm: 15, heightCm: 20 }),
    );
    const points = outline.points.split(' ').map((point) => point.split(',').map(Number));
    assert.equal(Math.max(...points.map(([x]) => x)), outline.width);
    assert.ok(new Set(points.map(([x]) => x)).size > 10);
    assert.equal(points.filter(([x]) => x === outline.width).length, 72);
  });
});
