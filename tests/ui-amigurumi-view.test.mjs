/*
 * Contents of the „Amigurumi” section (PQW-863): the choices, the fields per
 * shape, the shape built from the text of the fields, the round-plan preview,
 * the origin of the gauge, the parts and height of the figure, and the messages.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';
import { diagnoseRounds, roundGaugeOf } from '../src/core/amigurumi.ts';
import { addAmigurumiPart, createAmigurumi } from '../src/core/amigurumi-generator.ts';
import { emptyPattern } from '../src/core/editor.ts';
import {
  addedMessage,
  BOTTOM_CHOICES,
  createdMessage,
  curvatureRuns,
  fieldState,
  figureNote,
  gaugeNote,
  JOIN_CHOICES,
  METHOD_CHOICES,
  parseNumber,
  parseProfile,
  partOf,
  previewNote,
  SHAPE_CHOICES,
  STITCH_CHOICES,
  safetyNote,
  shapeOf,
  TOP_CHOICES,
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

describe('choices and fields', () => {
  test('shapes, the round plan of the sphere, the ends and the joining method all carry Hungarian labels', () => {
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

  test('which fields belong to each shape', () => {
    const none = { stitch: false };
    assert.deepEqual(fieldState('sphere'), {
      method: true,
      diameter: true,
      height: false,
      length: false,
      width: false,
      ...none,
      increases: false,
      profile: false,
      bottom: false,
      top: false,
    });
    assert.deepEqual(fieldState('cone'), {
      method: false,
      diameter: true,
      height: true,
      length: false,
      width: false,
      ...none,
      increases: true,
      profile: false,
      bottom: false,
      top: true,
    });
    assert.deepEqual(fieldState('cylinder'), {
      method: false,
      diameter: true,
      height: true,
      length: false,
      width: false,
      ...none,
      increases: false,
      profile: false,
      bottom: true,
      top: true,
    });
    assert.deepEqual(fieldState('revolution'), {
      method: false,
      diameter: false,
      height: false,
      length: false,
      width: false,
      ...none,
      increases: false,
      profile: true,
      bottom: true,
      top: true,
    });
    assert.deepEqual(fieldState('oval'), {
      method: false,
      diameter: false,
      height: false,
      length: true,
      width: true,
      stitch: true,
      increases: false,
      profile: false,
      bottom: false,
      top: false,
    });
  });
});

describe('building the shape from the fields', () => {
  test('numbers parse with a decimal comma too, and an empty field gives NaN', () => {
    assert.equal(parseNumber('2,5'), 2.5);
    assert.equal(parseNumber(' 6 '), 6);
    assert.ok(Number.isNaN(parseNumber('')));
  });

  test('the profile is a radius and a height per line, and a bad line is reported with its line number', () => {
    assert.deepEqual(parseProfile('0 0\n\n2,5 1\n1;2'), [
      { radiusCm: 0, heightCm: 0 },
      { radiusCm: 2.5, heightCm: 1 },
      { radiusCm: 1, heightCm: 2 },
    ]);
    assert.match(parseProfile('0 0\n2,5'), /A profil 2\. sorában két szám kell/);
  });

  test('an empty increase on a cone is derived from the height, and a bad number comes back as a message', () => {
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

  test('the part built from the fields: name, shape, stagger and safety eyes', () => {
    assert.deepEqual(partOf(form({ name: 'Fej' })), {
      name: 'Fej',
      shape: { kind: 'sphere', diameterCm: 6, method: '6n' },
      stagger: true,
      eyes: true,
    });
    assert.match(partOf(form({ shape: 'revolution', profile: 'a b' })), /két szám kell/);
  });
});

describe('preview and notes', () => {
  test('a 6 cm sphere: the number of rounds, the size, and the curvature round by round', () => {
    assert.equal(
      previewNote(form(), DK),
      '18 kör, legfeljebb 36 szem; szélesség kb. 6 cm, magasság kb. 6 cm. Görbület: 1–6. kör lapos, 7–13. kör henger, 14–18. kör fogyó (záródik).',
    );
  });

  test('a cylinder names its back-loop round, and an open start raises a warning', () => {
    assert.match(
      previewNote(form({ shape: 'cylinder', diameter: '5', height: '5', top: 'open' }), DK),
      /Hátsó szálba \(éles törés\): 6\. kör\./,
    );
    assert.match(
      previewNote(form({ shape: 'cylinder', diameter: '5', height: '5', bottom: 'open' }), DK),
      /Nyitott kezdés: csak folytatólagosan/,
    );
  });

  test('oval (PQW-890): length and width come from the fields, and the summary gives the chain count', () => {
    assert.deepEqual(shapeOf(form({ shape: 'oval', length: '8', width: '5' })), {
      kind: 'oval',
      lengthCm: 8,
      widthCm: 5,
    });
    assert.match(
      previewNote(form({ shape: 'oval', length: '8', width: '5' }), DK),
      /^\d+ kör, legfeljebb \d+ szem; hossz kb\. [\d,]+ cm, szélesség kb\. [\d,]+ cm, \d+ láncszemből\. Görbület: /,
    );
    assert.match(previewNote(form({ shape: 'oval', length: '3', width: '5' }), DK), /hossza legalább akkora/);
  });

  test('a double crochet oval (PQW-899): the stitch is part of the shape, the preview uses the gauge of that stitch, and the figure note gives length × width, flat', () => {
    assert.deepEqual(shapeOf(form({ shape: 'oval', stitch: 'dc' })), {
      kind: 'oval',
      lengthCm: 8,
      widthCm: 5,
      stitch: 'dc',
    });
    const base = emptyPattern();
    const dc = roundGaugeOf(base, 'dc');
    const note = previewNote(form({ shape: 'oval', stitch: 'dc' }), roundGaugeOf(base), () => dc);
    const counts = /^(\d+) kör, legfeljebb (\d+) szem/.exec(note);
    assert.ok(counts, note);
    const sole = createAmigurumi(
      base,
      { name: 'Talp', shape: { kind: 'oval', lengthCm: 8, widthCm: 5, stitch: 'dc' }, stagger: true, eyes: false },
      false,
    );
    assert.ok(sole.ok, sole.ok ? '' : sole.reason.code);
    assert.equal(Number(counts[2]), Math.max(...sole.schedule.counts));
    assert.match(
      figureNote(sole.pattern, roundGaugeOf(base)),
      /^A minta részei: Talp \([\d,]+ × [\d,]+ cm, lapos\)\. A figura magassága kb\. 0,\d cm/,
    );
  });

  test('a bad size surfaces the message from the core', () => {
    assert.equal(previewNote(form({ diameter: '0' }), DK), 'Az átmérő 0 és 100 cm közötti szám lehet.');
  });

  test('consecutive rounds of the same curvature collapse into a single run', () => {
    assert.deepEqual(curvatureRuns(diagnoseRounds([6, 12, 12, 12, 6], DK)), [
      { from: 1, to: 2, curvature: 'flat' },
      { from: 3, to: 4, curvature: 'tube' },
      { from: 5, to: 5, curvature: 'closing' },
    ]);
  });

  test('the origin of the gauge: estimated from the hook, or measured in the round', () => {
    assert.match(gaugeNote(roundGaugeOf(emptyPattern())), /^Becslés a tűből: .* kb\. két tűmérettel kisebb tűvel\./);
    assert.equal(gaugeNote(DK), 'A körben mért mintasűrűségből: 19 szem és 20 kör 10 cm-en.');
    assert.match(gaugeNote({ ...DK, source: 'label' }), /^A címkén megadott mintasűrűségből/);
  });

  test('the parts and the height of the figure, and no note at all without a part', () => {
    const base = emptyPattern();
    const gauge = roundGaugeOf(base);
    assert.equal(figureNote(base, gauge), null);
    const head = createAmigurumi(
      base,
      { name: 'Fej', shape: { kind: 'sphere', diameterCm: 6, method: '6n' }, stagger: true, eyes: true },
      false,
    );
    assert.ok(head.ok);
    const body = {
      name: 'Test',
      shape: { kind: 'cylinder', diameterCm: 5, heightCm: 5, bottom: 'closed', top: 'open' },
      stagger: true,
      eyes: false,
    };
    const figure = addAmigurumiPart(head.pattern, body, { method: 'sewn', distribute: true }, false);
    assert.ok(figure.ok, figure.ok ? '' : figure.reason.code);
    assert.match(
      figureNote(figure.pattern, gauge),
      /^A minta részei: Fej \(6,5 × 6,5 cm\), Test \(5 × 5,1 cm\)\. A figura magassága kb\. \d+(,\d)? cm/,
    );
  });

  test('toy safety and messages', () => {
    assert.equal(safetyNote(false), null);
    assert.match(safetyNote(true), /hímzett szemet ír/);
    assert.equal(createdMessage('Fej'), 'Fej elkészült; visszavonással a korábbi minta visszajön.');
    assert.equal(
      addedMessage('Test', 'continuous'),
      'Test hozzáadva, folytatólagosan; visszavonással a korábbi minta visszajön.',
    );
  });
});
