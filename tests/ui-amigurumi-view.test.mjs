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
import { setUiLanguage } from '../src/ui/i18n.ts';
import { setTermsLocale } from '../src/ui/notation.ts';

/** Runs `run` with the interface in `language`, then restores the default. KB: interface.md §4 */
function inLanguage(language, run) {
  try {
    setUiLanguage(language);
    return run();
  } finally {
    setUiLanguage('en');
  }
}

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
  test('shapes, the round plan of the sphere, the ends and the joining method carry labels in both interface languages', () => {
    assert.deepEqual(
      inLanguage('en', () => SHAPE_CHOICES.map((choice) => choice.label)),
      ['Sphere', 'Hemisphere', 'Egg', 'Cylinder', 'Cone', 'Solid of revolution (from a profile)', 'Oval'],
    );
    assert.deepEqual(
      inLanguage('hu', () => SHAPE_CHOICES.map((choice) => choice.label)),
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
      inLanguage('en', () => JOIN_CHOICES.map((choice) => choice.label)),
      ['Sewn', 'Worked on'],
    );
    assert.deepEqual(
      inLanguage('hu', () => JOIN_CHOICES.map((choice) => choice.label)),
      ['Varrva', 'Folytatólagosan'],
    );
  });

  test('the stitch choices follow the notation, not the interface language (PQW-920)', () => {
    const inTerms = (terms) => {
      try {
        setTermsLocale(terms);
        return inLanguage('en', () => STITCH_CHOICES.map((choice) => [choice.value, choice.label]));
      } finally {
        setTermsLocale('en-US');
      }
    };
    assert.deepEqual(inTerms('hu'), [
      ['sc', 'Rövidpálca'],
      ['hdc', 'Félpálca'],
      ['dc', 'Egyráhajtásos pálca'],
      ['tr', 'Kétráhajtásos pálca'],
    ]);
    assert.deepEqual(inTerms('en-US'), [
      ['sc', 'Single crochet'],
      ['hdc', 'Half double crochet'],
      ['dc', 'Double crochet'],
      ['tr', 'Treble'],
    ]);
    assert.deepEqual(inTerms('en-GB'), [
      ['sc', 'Double crochet'],
      ['hdc', 'Half treble'],
      ['dc', 'Treble'],
      ['tr', 'Double treble'],
    ]);
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
    assert.match(parseProfile('0 0\n2,5'), /^Line 2 of the profile needs two numbers separated by a space/);
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
    assert.match(shapeOf(form({ shape: 'cone', increases: 'sok' })), /must be a number/);
  });

  test('the part built from the fields: name, shape, stagger and safety eyes', () => {
    assert.deepEqual(partOf(form({ name: 'Fej' })), {
      name: 'Fej',
      shape: { kind: 'sphere', diameterCm: 6, method: '6n' },
      stagger: true,
      eyes: true,
    });
    assert.match(partOf(form({ shape: 'revolution', profile: 'a b' })), /needs two numbers/);
  });
});

describe('preview and notes', () => {
  test('a 6 cm sphere: the number of rounds, the size, and the curvature round by round', () => {
    assert.equal(
      previewNote(form(), DK),
      '18 rounds, at most 36 stitches; width about 6 cm, height about 6 cm. Curvature: rounds 1–6 flat, rounds 7–13 tube, rounds 14–18 decreasing (closing).',
    );
  });

  test('a cylinder names its back-loop round, and an open start raises a warning', () => {
    assert.match(
      previewNote(form({ shape: 'cylinder', diameter: '5', height: '5', top: 'open' }), DK),
      /Into the back loop \(sharp fold\): round 6\./,
    );
    assert.match(
      previewNote(form({ shape: 'cylinder', diameter: '5', height: '5', bottom: 'open' }), DK),
      /Open start: only as a continuation/,
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
      /^\d+ rounds, at most \d+ stitches; length about [\d.]+ cm, width about [\d.]+ cm, from \d+ chains\. Curvature: /,
    );
    assert.match(
      previewNote(form({ shape: 'oval', length: '3', width: '5' }), DK),
      /must be at least as large as its width/,
    );
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
    const counts = /^(\d+) rounds, at most (\d+) stitches/.exec(note);
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
      /^Pieces of the pattern: Talp \([\d.]+ × [\d.]+ cm, flat\)\. The figure is about 0\.\d cm tall/,
    );
  });

  test('a bad size surfaces the message from the core', () => {
    assert.equal(previewNote(form({ diameter: '0' }), DK), 'The diameter must be a number between 0 and 100 cm.');
  });

  test('consecutive rounds of the same curvature collapse into a single run', () => {
    assert.deepEqual(curvatureRuns(diagnoseRounds([6, 12, 12, 12, 6], DK)), [
      { from: 1, to: 2, curvature: 'flat' },
      { from: 3, to: 4, curvature: 'tube' },
      { from: 5, to: 5, curvature: 'closing' },
    ]);
  });

  test('the origin of the gauge: estimated from the hook, or measured in the round', () => {
    assert.match(
      gaugeNote(roundGaugeOf(emptyPattern())),
      /^Estimate from the hook: .* with a hook about two sizes smaller\./,
    );
    assert.equal(gaugeNote(DK), 'From the in the round gauge: 19 stitches and 20 rounds over 10 cm.');
    assert.match(gaugeNote({ ...DK, source: 'label' }), /^From the label gauge/);
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
      /^Pieces of the pattern: Fej \(6\.5 × 6\.5 cm\), Test \(5 × 5\.1 cm\)\. The figure is about \d+(\.\d)? cm tall/,
    );
  });

  test('toy safety and messages', () => {
    assert.equal(safetyNote(false), null);
    assert.match(safetyNote(true), /the pattern writes embroidered eyes/);
    assert.equal(createdMessage('Fej'), 'Fej done; undo brings the previous one back.');
    assert.equal(addedMessage('Test', 'continuous'), 'Test added, worked on; undo brings the previous one back.');
  });
});
