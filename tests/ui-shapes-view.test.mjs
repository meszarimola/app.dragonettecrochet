/*
 * A „Forma” szakasz tartalma (PQW-862): a választások, a mezők állapota a
 * formához, a terv kiírása a tényleges mérettel és a becslés jelzésével, és az
 * előnézet körvonala.
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
  test('forma és szem magyar felirattal; magasság vagy szög, kerekítés', () => {
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

describe('a mezők a formához', () => {
  test('téglalapnál magasság és mintaismétlés; szög, felső él és a magasság módja nincs', () => {
    assert.deepEqual(shapeFieldState(options()), {
      topWidth: false,
      measure: false,
      height: true,
      angle: false,
      repeat: true,
      // Bordás szegély a felső élen (PQW-909).
      ribbing: true,
      ribbingFields: false,
    });
    assert.equal(shapeFieldState(options({ measure: 'angle' })).height, true);
  });

  test('trapéznál a felső él; szögből a magasság helyett a szög', () => {
    const state = shapeFieldState(options({ shape: 'trapezoid', measure: 'angle' }));
    assert.deepEqual([state.topWidth, state.measure, state.height, state.angle, state.repeat], [true, true, false, true, false]);
  });

  test('nem téglalapnál a mintaismétlés kimarad; a szélesség felirata a formához', () => {
    const chosen = options({ repeat: { width: 6, edge: 2 } });
    assert.equal(normalizeShape(chosen), chosen);
    const triangle = normalizeShape({ ...chosen, shape: 'isosceles-triangle' });
    assert.equal(triangle.repeat, null);
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

  test('a létrehozás üzenete a visszavonás lehetőségével', () => {
    const plan = planOf(withRowGauge('hdc', 15, 11));
    assert.equal(generatedMessage(options(), plan), 'Téglalap, 33 sor elkészült; visszavonással a korábbi minta visszajön.');
  });
});

describe('a mag indoka mondattá (PQW-904)', () => {
  test('a magyar mondat betűre a mai: a határ és a sorszám az adatból kerül a helyére', () => {
    assert.equal(shapeReason(shapeProblem(options({ widthCm: Number.NaN }))), 'A szélesség 0 és 300 cm közötti szám legyen.');
    assert.equal(shapeReason({ code: 'shape-too-steep' }), 'Ilyen meredek élt ennyi sorban nem lehet horgolni: adj meg nagyobb magasságot.');
    assert.equal(
      shapeReason({ code: 'shape-row-too-narrow', data: { row: 7 } }),
      'A(z) 7. sor túl keskeny ehhez az alakításhoz: adj meg nagyobb méretet vagy laposabb élt.',
    );
  });

  test('a „ez a program hibája” esetek közös kódja: az adat dönti el, melyik mondat', () => {
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

  test('a szótár mindkét nyelven ugyanazt a kódkészletet adja, és az angolban nincs magyar ékezet', () => {
    const { hu, en } = SHAPE_CORE_TEXTS;
    assert.deepEqual(Object.keys(en).sort(), Object.keys(hu).sort());
    assert.ok(Object.keys(hu).length > 30, `túl kevés kód: ${Object.keys(hu).length}`);
    // Minden kódhoz mindkét nyelven ugyanolyan fajtájú, ugyanannyi paraméteres tétel tartozik.
    // A szabály azonosítója nyers adat, nem fordítjuk: ékezet nélküli mintaérték, hogy az angol ágat vizsgáló őr ne a saját adatán bukjon.
    const sample = { max: 3, min: 2, rows: 2, row: 2, count: 2, rule: 'rule-id', shape: 'row', unit: 2, nearest: 4 };
    const render = (entry) => (typeof entry === 'string' ? entry : entry(sample));
    for (const [code, entry] of Object.entries(hu)) {
      assert.equal(typeof en[code], typeof entry, `${code}: eltérő fajta`);
      if (typeof entry === 'function') assert.equal(en[code].length, entry.length, `${code}: eltérő paraméterszám`);
      assert.ok(render(entry).length > 0, `${code}: üres magyar szöveg`);
      assert.doesNotMatch(render(en[code]), /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/, `${code}: magyar ékezet az angol ágban`);
    }
  });
});

describe('előnézet', () => {
  test('téglalap: a tényleges méretű téglalap, lépcső nélkül', () => {
    const outline = shapeOutline(planOf(withRowGauge('hdc', 15, 11)));
    assert.deepEqual([outline.width, outline.height], [20, 30]);
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
});
