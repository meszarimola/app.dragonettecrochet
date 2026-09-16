/*
 * Az „Amigurumi” szakasz tartalma (PQW-863): a választások, a mezők a
 * formához, a forma a mezők szövegéből, a körterv előnézete, a mintasűrűség
 * eredete, a figura részei és magassága, az üzenetek.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { addAmigurumiPart, createAmigurumi } from '../src/core/amigurumi-generator.ts';
import { diagnoseRounds, roundGaugeOf } from '../src/core/amigurumi.ts';
import { emptyPattern } from '../src/core/editor.ts';
import {
  BOTTOM_CHOICES,
  JOIN_CHOICES,
  METHOD_CHOICES,
  SHAPE_CHOICES,
  STITCH_CHOICES,
  TOP_CHOICES,
  addedMessage,
  createdMessage,
  curvatureRuns,
  fieldState,
  figureNote,
  gaugeNote,
  parseNumber,
  parseProfile,
  partOf,
  previewNote,
  safetyNote,
  shapeOf,
} from '../src/ui/amigurumi-view.ts';

const DK = { stitchesPerCm: 1.9, roundsPerCm: 2, source: 'measured', hookMm: 3.5 };

const form = (patch = {}) => ({
  name: 'Fej',
  shape: 'sphere',
  method: '6n',
  diameter: '6',
  height: '8',
  length: '8',
  width: '5',
  stitch: 'sc',
  increases: '',
  profile: '0 0\n2,5 1\n2,5 5\n0 6',
  bottom: 'closed',
  top: 'closed',
  stagger: true,
  eyes: true,
  under3: false,
  join: 'sewn',
  distribute: false,
  ...patch,
});

describe('választások és mezők', () => {
  test('formák, a gömb körterve, a végek és a kapcsolás magyar felirattal', () => {
    assert.deepEqual(
      SHAPE_CHOICES.map((choice) => choice.label),
      ['Gömb', 'Félgömb', 'Tojás', 'Henger', 'Kúp', 'Forgástest (profilból)', 'Ovális'],
    );
    assert.deepEqual(
      METHOD_CHOICES.map((choice) => choice.value),
      ['6n', 'sine'],
    );
    assert.deepEqual(
      [...BOTTOM_CHOICES, ...TOP_CHOICES].map((choice) => choice.value),
      ['closed', 'open', 'closed', 'open'],
    );
    assert.deepEqual(
      JOIN_CHOICES.map((choice) => choice.label),
      ['Varrva', 'Folytatólagosan'],
    );
    assert.deepEqual(
      STITCH_CHOICES.map((choice) => [choice.value, choice.label]),
      [
        ['sc', 'Rövidpálca'],
        ['hdc', 'Félpálca'],
        ['dc', 'Egyráhajtásos pálca'],
        ['tr', 'Kétráhajtásos pálca'],
      ],
    );
  });

  test('a formához tartozó mezők', () => {
    const none = { stitch: false };
    assert.deepEqual(fieldState('sphere'), { method: true, diameter: true, height: false, length: false, width: false, ...none, increases: false, profile: false, bottom: false, top: false });
    assert.deepEqual(fieldState('cone'), { method: false, diameter: true, height: true, length: false, width: false, ...none, increases: true, profile: false, bottom: false, top: true });
    assert.deepEqual(fieldState('cylinder'), { method: false, diameter: true, height: true, length: false, width: false, ...none, increases: false, profile: false, bottom: true, top: true });
    assert.deepEqual(fieldState('revolution'), { method: false, diameter: false, height: false, length: false, width: false, ...none, increases: false, profile: true, bottom: true, top: true });
    assert.deepEqual(fieldState('oval'), { method: false, diameter: false, height: false, length: true, width: true, stitch: true, increases: false, profile: false, bottom: false, top: false });
  });
});

describe('a forma a mezőkből', () => {
  test('szám tizedesvesszővel is; üresen NaN', () => {
    assert.equal(parseNumber('2,5'), 2.5);
    assert.equal(parseNumber(' 6 '), 6);
    assert.ok(Number.isNaN(parseNumber('')));
  });

  test('a profil soronként sugár és magasság; hibás sornál a sor száma', () => {
    assert.deepEqual(parseProfile('0 0\n\n2,5 1\n1;2'), [
      { radiusCm: 0, heightCm: 0 },
      { radiusCm: 2.5, heightCm: 1 },
      { radiusCm: 1, heightCm: 2 },
    ]);
    assert.match(parseProfile('0 0\n2,5'), /A profil 2\. sorában két szám kell/);
  });

  test('a kúp üres szaporítása a magasságból számol, a hibás szám üzenet', () => {
    assert.deepEqual(shapeOf(form({ shape: 'cone', diameter: '5', height: '6', top: 'open' })), {
      kind: 'cone',
      diameterCm: 5,
      heightCm: 6,
      increases: null,
      top: 'open',
    });
    assert.equal(shapeOf(form({ shape: 'cone', increases: '2,5' })).increases, 2.5);
    assert.match(shapeOf(form({ shape: 'cone', increases: 'sok' })), /szám legyen/);
  });

  test('a rész a mezőkből: név, forma, eltolás, szem', () => {
    assert.deepEqual(partOf(form({ name: 'Fej' })), { name: 'Fej', shape: { kind: 'sphere', diameterCm: 6, method: '6n' }, stagger: true, eyes: true });
    assert.match(partOf(form({ shape: 'revolution', profile: 'a b' })), /két szám kell/);
  });
});

describe('előnézet és megjegyzések', () => {
  test('a 6 cm-es gömb: körszám, méret, görbület körönként', () => {
    assert.equal(
      previewNote(form(), DK),
      '18 kör, legfeljebb 36 szem; szélesség kb. 6 cm, magasság kb. 6 cm. Görbület: 1–6. kör lapos, 7–13. kör henger, 14–18. kör fogyó (záródik).',
    );
  });

  test('a henger a hátsó szálas körrel; a nyitott kezdés figyelmeztet', () => {
    assert.match(previewNote(form({ shape: 'cylinder', diameter: '5', height: '5', top: 'open' }), DK), /Hátsó szálba \(éles törés\): 6\. kör\./);
    assert.match(previewNote(form({ shape: 'cylinder', diameter: '5', height: '5', bottom: 'open' }), DK), /Nyitott kezdés: csak folytatólagosan/);
  });

  test('az ovális (PQW-890): hossz és szélesség a mezőkből, az összefoglaló a láncszemek számával', () => {
    assert.deepEqual(shapeOf(form({ shape: 'oval', length: '8', width: '5' })), { kind: 'oval', lengthCm: 8, widthCm: 5 });
    assert.match(
      previewNote(form({ shape: 'oval', length: '8', width: '5' }), DK),
      /^\d+ kör, legfeljebb \d+ szem; hossz kb\. [\d,]+ cm, szélesség kb\. [\d,]+ cm, \d+ láncszemből\. Görbület: /,
    );
    assert.match(previewNote(form({ shape: 'oval', length: '3', width: '5' }), DK), /hossza legalább akkora/);
  });

  test('a pálcás ovális (PQW-899): a szem a formában, az előnézet a szem mintasűrűségével; a figura-jegyzetben hossz × szélesség, lapos', () => {
    assert.deepEqual(shapeOf(form({ shape: 'oval', stitch: 'dc' })), { kind: 'oval', lengthCm: 8, widthCm: 5, stitch: 'dc' });
    const base = emptyPattern();
    const dc = roundGaugeOf(base, 'dc');
    const note = previewNote(form({ shape: 'oval', stitch: 'dc' }), roundGaugeOf(base), () => dc);
    const counts = /^(\d+) kör, legfeljebb (\d+) szem/.exec(note);
    assert.ok(counts, note);
    const sole = createAmigurumi(base, { name: 'Talp', shape: { kind: 'oval', lengthCm: 8, widthCm: 5, stitch: 'dc' }, stagger: true, eyes: false }, false);
    assert.ok(sole.ok, sole.reason);
    assert.equal(Number(counts[2]), Math.max(...sole.schedule.counts));
    assert.match(figureNote(sole.pattern, roundGaugeOf(base)), /^A minta részei: Talp \([\d,]+ × [\d,]+ cm, lapos\)\. A figura magassága kb\. 0,\d cm/);
  });

  test('hibás méretnél a mag üzenete', () => {
    assert.equal(previewNote(form({ diameter: '0' }), DK), 'Az átmérő 0 és 100 cm közötti szám lehet.');
  });

  test('az egymás utáni azonos görbületű körök egy tételben', () => {
    assert.deepEqual(curvatureRuns(diagnoseRounds([6, 12, 12, 12, 6], DK)), [
      { from: 1, to: 2, curvature: 'flat' },
      { from: 3, to: 4, curvature: 'tube' },
      { from: 5, to: 5, curvature: 'closing' },
    ]);
  });

  test('a mintasűrűség eredete: becslés a tűből vagy a körben mért', () => {
    assert.match(gaugeNote(roundGaugeOf(emptyPattern())), /^Becslés a tűből: .* kb\. két tűmérettel kisebb tűvel\./);
    assert.equal(gaugeNote(DK), 'A körben mért mintasűrűségből: 19 szem és 20 kör 10 cm-en.');
    assert.match(gaugeNote({ ...DK, source: 'label' }), /^A címkén megadott mintasűrűségből/);
  });

  test('a figura részei és magassága; rész nélkül nincs megjegyzés', () => {
    const base = emptyPattern();
    const gauge = roundGaugeOf(base);
    assert.equal(figureNote(base, gauge), null);
    const head = createAmigurumi(base, { name: 'Fej', shape: { kind: 'sphere', diameterCm: 6, method: '6n' }, stagger: true, eyes: true }, false);
    assert.ok(head.ok);
    const body = { name: 'Test', shape: { kind: 'cylinder', diameterCm: 5, heightCm: 5, bottom: 'closed', top: 'open' }, stagger: true, eyes: false };
    const figure = addAmigurumiPart(head.pattern, body, { method: 'sewn', distribute: true }, false);
    assert.ok(figure.ok, figure.reason);
    assert.match(figureNote(figure.pattern, gauge), /^A minta részei: Fej \(6,5 × 6,5 cm\), Test \(5 × 5,1 cm\)\. A figura magassága kb\. \d+(,\d)? cm/);
  });

  test('játékbiztonság és üzenetek', () => {
    assert.equal(safetyNote(false), null);
    assert.match(safetyNote(true), /hímzett szemet ír/);
    assert.equal(createdMessage('Fej'), 'Fej elkészült; visszavonással a korábbi minta visszajön.');
    assert.equal(addedMessage('Test', 'continuous'), 'Test hozzáadva, folytatólagosan; visszavonással a korábbi minta visszajön.');
  });
});
