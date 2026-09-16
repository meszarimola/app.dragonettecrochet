/*
 * A „Forma” szakasz tartalma (PQW-862): a választások, a mezők állapota a
 * formához, a terv kiírása a tényleges mérettel és a becslés jelzésével, és az
 * előnézet körvonala.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { emptyPattern } from '../src/core/editor.ts';
import { DEFAULT_SHAPE, planShape } from '../src/core/shapes.ts';
import {
  HDC_ROW_END_CHOICES,
  MEASURE_CHOICES,
  ROUNDING_CHOICES,
  SHAPE_CHOICES,
  STITCH_CHOICES,
  generatedMessage,
  normalizeShape,
  shapeFieldState,
  shapeOutline,
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

/** Minta profillal, amelyben a szem síkban mérve adott szem és sor 10 cm-en. */
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

describe('választások', () => {
  test('forma és szem magyar felirattal; magasság vagy szög, kerekítés, félpálcás sorvég', () => {
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
    assert.deepEqual(HDC_ROW_END_CHOICES.map((choice) => choice.value), ['2', '1']);
  });
});

describe('a mezők a formához', () => {
  test('téglalapnál magasság, mintaismétlés és szegély; szög, felső él és a magasság módja nincs', () => {
    assert.deepEqual(shapeFieldState(options()), {
      topWidth: false,
      measure: false,
      height: true,
      angle: false,
      repeat: true,
      border: true,
      hdcRowEnd: false,
      borderRepeat: false,
    });
    assert.equal(shapeFieldState(options({ measure: 'angle' })).height, true);
  });

  test('trapéznál a felső él és a szegély (PQW-898); szögből a magasság helyett a szög', () => {
    const state = shapeFieldState(options({ shape: 'trapezoid', measure: 'angle' }));
    assert.deepEqual([state.topWidth, state.measure, state.height, state.angle, state.repeat, state.border], [true, true, false, true, false, true]);
  });

  test('a félpálcás sorvégi választás félpálcás, szegélyes formánál; a szegélysor ismétlése szegéllyel', () => {
    const border = { stitch: 'sc', hdcRowEnd: 2 };
    assert.equal(shapeFieldState(options({ border })).hdcRowEnd, true);
    assert.equal(shapeFieldState(options({ border, stitch: 'dc' })).hdcRowEnd, false);
    assert.equal(shapeFieldState(options({ border, shape: 'diamond' })).hdcRowEnd, true);
    assert.deepEqual([shapeFieldState(options({ border })).borderRepeat, shapeFieldState(options()).borderRepeat], [true, false]);
  });

  test('nem téglalapnál a mintaismétlés kimarad, a szegély marad (PQW-898); a szélesség felirata a formához', () => {
    const chosen = options({ repeat: { width: 6, edge: 2 }, border: { stitch: 'sc', hdcRowEnd: 2 } });
    assert.equal(normalizeShape(chosen), chosen);
    const triangle = normalizeShape({ ...chosen, shape: 'isosceles-triangle' });
    assert.deepEqual([triangle.repeat, triangle.border], [null, { stitch: 'sc', hdcRowEnd: 2 }]);
    assert.deepEqual(['rectangle', 'trapezoid', 'diamond'].map(widthLabel), ['Szélesség, cm', 'Alsó él, cm', 'Legszélesebb sor, cm']);
  });
});

describe('a terv kiírása', () => {
  test('20 × 30 cm félpálcás téglalap profil nélkül: „≈” előtag, és a becslés jelzése', () => {
    const plan = planOf(emptyPattern());
    const view = shapeView(plan, options(), false);
    assert.match(view.size, /^Tényleges méret: ≈ \d+,\d × \d+,\d cm, \d+ sor\.$/);
    assert.equal(view.details[0], `Soronként ${plan.counts[0]} szem.`);
    assert.match(view.source, /^Nincs profil: a méret becslés 4 mm-es tűből\. Pontosabb, ha próbadarabot mérsz/);
  });

  test('mért profillal: pontos méret, a mintasűrűség eredete', () => {
    const plan = planOf(withRowGauge('hdc', 15, 11));
    const view = shapeView(plan, options(), true);
    assert.equal(view.size, `Tényleges méret: ${formatNumber(20, 1)} × ${formatNumber(30, 1)} cm, 33 sor.`);
    assert.equal(view.source, 'A félpálca síkban mért mintasűrűségéből.');
  });

  test('egyenlő szárú háromszög (03 §3.2 D): alsó és felső sor, az él szöge és a csúcsszög, egyenletes alakítás', () => {
    const patch = { shape: 'isosceles-triangle', stitch: 'dc', widthCm: 20, heightCm: 15 };
    const view = shapeView(planOf(withRowGauge('dc', 16, 8), patch), options(patch), true);
    assert.equal(view.details[0], `Az alsó sor 32 szem (${formatNumber(20, 1)} cm), a felső 2 szem (${formatNumber(1.25, 1)} cm).`);
    assert.ok(view.details.includes('Az él szöge a függőlegestől kb. 32°, a csúcsszög kb. 64°.'), view.details.join('\n'));
    assert.ok(view.details.includes('A szaporítás és a fogyasztás egyenletesen elosztva, élenként soronként legfeljebb 2 egy szembe.'));
  });

  test('meredek rombusz: a láncos hosszabbítás és a meghagyott szemek sorai', () => {
    const patch = { shape: 'diamond', stitch: 'sc', widthCm: 30, heightCm: 5 };
    const view = shapeView(planOf(emptyPattern(), patch), options(patch), false);
    assert.ok(view.details.some((line) => /^Láncos hosszabbítás az? \d+\.(, \d+\.)*( és \d+\.)? sor végén\.$/.test(line)), view.details.join('\n'));
    assert.ok(view.details.some((line) => /^Meghagyott szemek az? .* sor végén: lépcsős él\.$/.test(line)), view.details.join('\n'));
  });

  test('szegély: szemszám körben, a méret a szegéllyel, és hogy a diagramon is látszik (PQW-889)', () => {
    const patch = { border: { stitch: 'sc', hdcRowEnd: 2 } };
    const plan = planOf(withRowGauge('hdc', 15, 11), patch);
    const view = shapeView(plan, options(patch), true);
    const line = view.details.find((text) => text.startsWith('Szegély: '));
    assert.ok(line);
    assert.match(line, /^Szegély: 200 rp körben, sarkonként 3, sorvégenként 2; a szegéllyel ≈ \d+,\d × \d+,\d cm\. A diagramon, a rácson és a kész méretben is látszik\.$/);
  });

  test('a létrehozás üzenete a visszavonás lehetőségével', () => {
    const plan = planOf(withRowGauge('hdc', 15, 11));
    assert.equal(generatedMessage(options(), plan), 'Téglalap, 33 sor elkészült; visszavonással a korábbi minta visszajön.');
  });
});

describe('előnézet', () => {
  test('téglalap: a tényleges méretű téglalap, lépcső nélkül', () => {
    const outline = shapeOutline(planOf(withRowGauge('hdc', 15, 11)));
    assert.deepEqual([outline.width, outline.height, outline.border], [20, 30, 0]);
    const xs = new Set(outline.points.split(' ').map((point) => point.split(',')[0]));
    assert.deepEqual([...xs].sort(), ['0', '20']);
  });

  test('derékszögű háromszög: a jobb szél egyenes, a bal lépcsős', () => {
    const outline = shapeOutline(planOf(withRowGauge('sc', 16, 18), { shape: 'right-triangle', stitch: 'sc', widthCm: 15, heightCm: 20 }));
    const points = outline.points.split(' ').map((point) => point.split(',').map(Number));
    assert.equal(Math.max(...points.map(([x]) => x)), outline.width);
    assert.ok(new Set(points.map(([x]) => x)).size > 10);
    assert.equal(points.filter(([x]) => x === outline.width).length, 72);
  });

  test('szegéllyel az előnézet a szegéllyel együtt, a darab a szegély vastagságával beljebb', () => {
    const plan = planOf(withRowGauge('hdc', 15, 11), { border: { stitch: 'sc', hdcRowEnd: 2 } });
    const outline = shapeOutline(plan);
    assert.ok(outline.border > 0);
    assert.ok(Math.abs(outline.width - plan.borderedCm.widthCm) < 0.01);
    const xs = outline.points.split(' ').map((point) => Number(point.split(',')[0]));
    assert.ok(Math.abs(Math.min(...xs) - outline.border) < 0.01);
  });
});
