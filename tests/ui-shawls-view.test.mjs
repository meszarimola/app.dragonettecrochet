/*
 * Contents of the „Kendő” section (PQW-865): the choices, the fields per
 * shawl, the plan printout with its angle and its blocked and unblocked size,
 * the wording of the warnings, and the preview outlines.
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

describe('choices and fields', () => {
  test('shawl kinds appear with Hungarian names in knowledge-base order, with a theoretical or a custom rate', () => {
    assert.deepEqual(
      KIND_CHOICES.map((choice) => choice.label),
      ['Fentről induló háromszög', 'Aszimmetrikus háromszög', 'Félhold', 'Félkör', 'Kör', 'Pi-kendő', 'Eltolt Pi-kendő', 'Téglalap stóla'],
    );
    assert.deepEqual(RATE_CHOICES.map((choice) => choice.value), ['theory', 'custom']);
  });

  test('fields per shawl: wings only on a triangle, length only on a stole, the custom rate only once it is selected', () => {
    assert.deepEqual(shawlFieldState(options()), { length: false, rate: true, custom: false, wings: true });
    assert.deepEqual(shawlFieldState(options({ kind: 'stole', rate: 'custom' })), { length: true, rate: false, custom: false, wings: false });
    assert.deepEqual(shawlFieldState(options({ kind: 'semicircle', rate: 'custom' })), { length: false, rate: true, custom: true, wings: false });
    assert.equal(normalizeShawl(options({ kind: 'crescent', wings: true })).wings, false);
  });

  test('labels per shawl: depth, edge, radius; what the rate applies to; edging counted per half on a symmetric shawl', () => {
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

describe('the plan printout', () => {
  test('example „A”: the blocked size is measured and the unblocked one estimated, with the rate, the angle and the rows', () => {
    const { view } = viewOf(withGauge('dc', 16, 8, true), { kind: 'triangle', stitch: 'dc', sizeCm: 80 });
    assert.match(view.size, /^Blokkolva 159 × 80 cm, blokkolás nélkül ≈ \d+ × \d+ cm; 45 sor\.$/);
    assert.ok(view.details.includes('Az 1. sor 8 szem, az utolsó 360 szem.'), view.details.join('\n'));
    assert.ok(view.details.some((line) => line.startsWith('Szaporítás soronként: elméletileg 8 (4 · h/w), választva 8; élenként átlagosan 2, a gerincen 4')));
    assert.ok(view.details.includes('A nyakél szöge kb. 180° (egyenes nyakélnél 180°), az alsó csúcsé kb. 90°.'));
    assert.deepEqual(view.warnings, []);
    assert.match(view.source, /^Az egyráhajtásos pálca síkban mért mintasűrűségéből\. A profil blokkolva mért/);
  });

  test('a custom rate gives a warning with the percentage, not an error', () => {
    const { view } = viewOf(withGauge('dc', 16, 8, true), { kind: 'triangle', stitch: 'dc', sizeCm: 80, rate: 'custom', customRate: 6 });
    assert.equal(view.warnings.length, 1);
    assert.match(view.warnings[0], /^A választott szaporítás az elméletinek kb\. 75%-a: a kendő mélyebb és keskenyebb lesz.*Ez figyelmeztetés, nem hiba\./);
  });

  test('Pi shawl: the doubling rounds, the range against the ideal, and the blocking warning; estimated without a profile', () => {
    const { view } = viewOf(emptyPattern(), { kind: 'pi', stitch: 'sc', sizeCm: 10 }, false);
    assert.ok(view.details.includes('Duplázás a 2., 4., 8., 16. körben, közte sima körök.'), view.details.join('\n'));
    assert.ok(view.details.some((line) => /^A körök szemszáma az ideálishoz képest \d+–\d+%\.$/.test(line)));
    assert.match(view.warnings[0], /^A duplázás előtti körben a szemszám az ideálisnak csak kb\. \d+%-a: tömör szemmel kunkorodik/);
    assert.match(view.size, /^Blokkolás nélkül ≈ \d+ cm átmérő, blokkolva ≈ \d+ cm átmérő; \d+ kör\.$/);
    assert.match(view.source, /^Nincs profil: a méret becslés 4 mm-es tűből\./);
  });

  test('fitting to the edging: the adjustment is counted per half', () => {
    const { view } = viewOf(withGauge('dc', 16, 8, true), { kind: 'triangle', stitch: 'dc', sizeCm: 80, edging: { width: 6, edge: 3 } });
    assert.ok(view.details.includes('Szegélyhez: 6 többszöröse + 3 félenként, 30 ismétlés (+3 szem félenként).'), view.details.join('\n'));
  });
});

describe('turning a core reason into a sentence (PQW-904)', () => {
  test('the words for row and round come from the dictionary: the core only supplies `shape`', () => {
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

  test('the article and the ordinal are put into the sentence by the UI, and the stole reuses the shape codes too', () => {
    assert.equal(
      shawlReason({ code: 'shawl-too-many-into-one', data: { row: 3, count: 14 } }),
      'A(z) 3. sorban egy szembe 14 szem kerülne: válassz kisebb szaporítást, vagy nagyobb méretet.',
    );
    assert.equal(shawlReason({ code: 'shape-too-steep' }), 'Ilyen meredek élt ennyi sorban nem lehet horgolni: adj meg nagyobb magasságot.');
  });

  test('a rejection from the planner renders as the sentence used today', () => {
    const planned = planShawl(emptyPattern(), options({ sizeCm: 0.5 }));
    assert.equal(planned.ok, false);
    assert.equal(shawlReason(planned.reason), 'Ehhez a kendőhöz legalább 2 sor kell: adj meg nagyobb mélységet.');
  });
});

describe('preview and message', () => {
  test('the blocked and the unblocked outline share one frame, aligned to the middle of the top edge', () => {
    const { sizes, plan } = viewOf(withGauge('dc', 16, 8, true), { kind: 'triangle', stitch: 'dc', sizeCm: 80 });
    const outline = shawlOutline(sizes);
    assert.equal(outline.blocked.split(' ').length, 4);
    assert.equal(outline.unblocked.split(' ').length, 4);
    assert.ok(outline.width >= sizes.unblocked.widthCm && outline.height >= sizes.unblocked.depthCm);
    // The neck point sits in the middle on both outlines.
    const neck = (points) => Number(points.split(' ')[0].split(',')[0]);
    assert.ok(Math.abs(neck(outline.blocked) - outline.width / 2) < 0.01);
    assert.ok(Math.abs(neck(outline.unblocked) - outline.width / 2) < 0.01);
    assert.equal(generatedMessage(plan), 'Fentről induló háromszög, 45 sor elkészült; visszavonással a korábbi minta visszajön.');
  });
});
