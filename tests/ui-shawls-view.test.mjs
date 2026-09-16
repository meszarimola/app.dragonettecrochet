/*
 * A „Kendő” szakasz tartalma (PQW-865): a választások, a mezők a kendőhöz, a
 * terv kiírása a szöggel, a blokkolt és blokkolatlan mérettel, a
 * figyelmeztetések szövege és az előnézet körvonalai.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { emptyPattern } from '../src/core/editor.ts';
import { DEFAULT_SHAWL, planShawl, shawlSizes } from '../src/core/shawls.ts';
import {
  KIND_CHOICES,
  RATE_CHOICES,
  edgingLabel,
  generatedMessage,
  normalizeShawl,
  rateLabel,
  shawlFieldState,
  shawlOutline,
  shawlReason,
  shawlView,
  sizeLabel,
} from '../src/ui/shawls-view.ts';

const options = (patch = {}) => ({ ...DEFAULT_SHAWL, ...patch });

function withGauge(stitch, stitchesPer10cm, rowsPer10cm, blocked) {
  const profile = {
    id: 'kendo',
    yarn: { name: 'Merinó', cycWeight: 1, metersPer100g: null, ballMassG: null },
    hookMm: 3.5,
    blocked,
    gauges: [{ stitch, form: 'rows', stitchesPer10cm, rowsPer10cm, source: 'measured' }],
    swatch: { widthCm: null, heightCm: null, massG: null },
  };
  return { ...emptyPattern(), gauge: { active: 'kendo', profiles: [profile] } };
}

const viewOf = (pattern, patch, hasProfile = true) => {
  const chosen = options(patch);
  const planned = planShawl(pattern, chosen);
  assert.ok(planned.ok, planned.reason);
  const sizes = shawlSizes(planned.plan, chosen.blocking);
  return { view: shawlView(planned.plan, chosen, sizes, hasProfile), plan: planned.plan, sizes };
};

describe('választások és mezők', () => {
  test('a kendők magyar néven, a tudásbázis sorrendjében; elméleti vagy saját arány', () => {
    assert.deepEqual(
      KIND_CHOICES.map((choice) => choice.label),
      ['Fentről induló háromszög', 'Aszimmetrikus háromszög', 'Félhold', 'Félkör', 'Kör', 'Pi-kendő', 'Eltolt Pi-kendő', 'Téglalap stóla'],
    );
    assert.deepEqual(RATE_CHOICES.map((choice) => choice.value), ['theory', 'custom']);
  });

  test('a mezők a kendőhöz: szárny csak háromszögnél, hossz csak stólánál, saját arány csak választva', () => {
    assert.deepEqual(shawlFieldState(options()), { length: false, rate: true, custom: false, wings: true });
    assert.deepEqual(shawlFieldState(options({ kind: 'stole', rate: 'custom' })), { length: true, rate: false, custom: false, wings: false });
    assert.deepEqual(shawlFieldState(options({ kind: 'semicircle', rate: 'custom' })), { length: false, rate: true, custom: true, wings: false });
    assert.equal(normalizeShawl(options({ kind: 'crescent', wings: true })).wings, false);
  });

  test('a feliratok a kendőhöz: mélység, él, sugár; mire vonatkozik az arány; a szegély félenként a szimmetrikus kendőben', () => {
    assert.deepEqual(
      ['triangle', 'asymmetric-triangle', 'semicircle', 'pi', 'stole'].map(sizeLabel),
      ['Mélység a gerincen, cm', 'Az egyenes él, cm', 'Sugár, cm', 'Sugár, cm', 'Szélesség, cm'],
    );
    assert.equal(rateLabel('triangle'), 'Szaporítás soronként, az egész sorra');
    assert.equal(rateLabel('pi'), 'Szem az 1. körben');
    assert.equal(edgingLabel('triangle'), 'Az utolsó sor a szegély ismétléséhez: „X többszöröse + Y”, félenként');
    assert.equal(edgingLabel('circle'), 'Az utolsó kör a szegély ismétléséhez: „X többszöröse + Y”');
  });
});

describe('a terv kiírása', () => {
  test('„A” példa: blokkolt mért méret, blokkolás nélkül becslés; az arány, a szög és a sorok', () => {
    const { view } = viewOf(withGauge('dc', 16, 8, true), { kind: 'triangle', stitch: 'dc', sizeCm: 80 });
    assert.match(view.size, /^Blokkolva 159 × 80 cm, blokkolás nélkül ≈ \d+ × \d+ cm; 45 sor\.$/);
    assert.ok(view.details.includes('Az 1. sor 8 szem, az utolsó 360 szem.'), view.details.join('\n'));
    assert.ok(view.details.some((line) => line.startsWith('Szaporítás soronként: elméletileg 8 (4 · h/w), választva 8; élenként átlagosan 2, a gerincen 4')));
    assert.ok(view.details.includes('A nyakél szöge kb. 180° (egyenes nyakélnél 180°), az alsó csúcsé kb. 90°.'));
    assert.deepEqual(view.warnings, []);
    assert.match(view.source, /^Az egyráhajtásos pálca síkban mért mintasűrűségéből\. A profil blokkolva mért/);
  });

  test('saját arány: figyelmeztetés, nem hiba, a százalékkal', () => {
    const { view } = viewOf(withGauge('dc', 16, 8, true), { kind: 'triangle', stitch: 'dc', sizeCm: 80, rate: 'custom', customRate: 6 });
    assert.equal(view.warnings.length, 1);
    assert.match(view.warnings[0], /^A választott szaporítás az elméletinek kb\. 75%-a: a kendő mélyebb és keskenyebb lesz.*Ez figyelmeztetés, nem hiba\./);
  });

  test('Pi-kendő: a duplázó körök, az ideálishoz mért tartomány, és a blokkolás figyelmeztetése; profil nélkül becslés', () => {
    const { view } = viewOf(emptyPattern(), { kind: 'pi', stitch: 'sc', sizeCm: 10 }, false);
    assert.ok(view.details.includes('Duplázás a 2., 4., 8., 16. körben, közte sima körök.'), view.details.join('\n'));
    assert.ok(view.details.some((line) => /^A körök szemszáma az ideálishoz képest \d+–\d+%\.$/.test(line)));
    assert.match(view.warnings[0], /^A duplázás előtti körben a szemszám az ideálisnak csak kb\. \d+%-a: tömör szemmel kunkorodik/);
    assert.match(view.size, /^Blokkolás nélkül ≈ \d+ cm átmérő, blokkolva ≈ \d+ cm átmérő; \d+ kör\.$/);
    assert.match(view.source, /^Nincs profil: a méret becslés 4 mm-es tűből\./);
  });

  test('szegélyhez igazítás: a változás félenként', () => {
    const { view } = viewOf(withGauge('dc', 16, 8, true), { kind: 'triangle', stitch: 'dc', sizeCm: 80, edging: { width: 6, edge: 3 } });
    assert.ok(view.details.includes('Szegélyhez: 6 többszöröse + 3 félenként, 30 ismétlés (+3 szem félenként).'), view.details.join('\n'));
  });
});

describe('a mag indoka mondattá (PQW-904)', () => {
  test('a sor és a kör szava a szótáré: a mag csak a `shape`-et adja', () => {
    assert.equal(shawlReason({ code: 'shawl-min-rows', data: { rows: 2, shape: 'row' } }), 'Ehhez a kendőhöz legalább 2 sor kell: adj meg nagyobb méretet.');
    assert.equal(shawlReason({ code: 'shawl-min-rows', data: { rows: 2, shape: 'round' } }), 'Ehhez a kendőhöz legalább 2 kör kell: adj meg nagyobb méretet.');
    assert.equal(
      shawlReason({ code: 'shawl-max-stitches', data: { max: 1200, shape: 'round' } }),
      'Egy körben legfeljebb 1200 szem lehet: adj meg kisebb méretet.',
    );
    assert.equal(
      shawlReason({ code: 'shawl-max-stitches', data: { max: 1200, shape: 'row' } }),
      'Egy sorban legfeljebb 1200 szem lehet: adj meg kisebb méretet.',
    );
  });

  test('a névelő és a sorszám a felületen kerül a mondatba; a stóla a forma kódjait is átveszi', () => {
    assert.equal(
      shawlReason({ code: 'shawl-too-many-into-one', data: { row: 3, count: 14 } }),
      'A(z) 3. sorban egy szembe 14 szem kerülne: válassz kisebb szaporítást, vagy nagyobb méretet.',
    );
    assert.equal(shawlReason({ code: 'shape-too-steep' }), 'Ilyen meredek élt ennyi sorban nem lehet horgolni: adj meg nagyobb magasságot.');
  });

  test('a tervező elutasítása a felületen a mai mondat', () => {
    const planned = planShawl(emptyPattern(), options({ sizeCm: 0.5 }));
    assert.equal(planned.ok, false);
    assert.equal(shawlReason(planned.reason), 'Ehhez a kendőhöz legalább 2 sor kell: adj meg nagyobb mélységet.');
  });
});

describe('előnézet és üzenet', () => {
  test('a blokkolt és a blokkolatlan körvonal ugyanabban a keretben, a felső szél közepéhez igazítva', () => {
    const { sizes, plan } = viewOf(withGauge('dc', 16, 8, true), { kind: 'triangle', stitch: 'dc', sizeCm: 80 });
    const outline = shawlOutline(sizes);
    assert.equal(outline.blocked.split(' ').length, 4);
    assert.equal(outline.unblocked.split(' ').length, 4);
    assert.ok(outline.width >= sizes.unblocked.widthCm && outline.height >= sizes.unblocked.depthCm);
    // A nyak pontja mindkét körvonalon középen.
    const neck = (points) => Number(points.split(' ')[0].split(',')[0]);
    assert.ok(Math.abs(neck(outline.blocked) - outline.width / 2) < 0.01);
    assert.ok(Math.abs(neck(outline.unblocked) - outline.width / 2) < 0.01);
    assert.equal(generatedMessage(plan), 'Fentről induló háromszög, 45 sor elkészült; visszavonással a korábbi minta visszajön.');
  });
});
