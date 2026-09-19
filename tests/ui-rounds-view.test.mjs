/*
 * Contents of the „Kör és motívum” section (PQW-861): the choices, the field
 * states per shape, and the increase note with its origin.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { emptyPattern } from '../src/core/editor.ts';
import { DEFAULT_MOTIF, motifIncreases, motifProblem } from '../src/core/round-generator.ts';
import { amigurumiCoreText } from '../src/ui/i18n/core/amigurumi.ts';
import {
  CLOSING_CHOICES,
  fieldState,
  generatedMessage,
  increaseNote,
  JOG_CHOICES,
  normalizeMotif,
  SHAPE_CHOICES,
  START_CHOICES,
  STITCH_CHOICES,
} from '../src/ui/rounds-view.ts';

const options = (patch = {}) => ({ ...DEFAULT_MOTIF, ...patch });

/** Pattern with a profile in which single crochet measures 20 stitches and 20 rounds per 10 cm in the round. */
function measuredSc() {
  const profile = {
    id: 'meres',
    yarn: { name: 'Pamut', cycWeight: 3, metersPer100g: null, ballMassG: null },
    hookMm: 4,
    blocked: false,
    gauges: [{ stitch: 'sc', form: 'rounds', stitchesPer10cm: 20, rowsPer10cm: 20, source: 'measured' }],
    swatch: { widthCm: null, heightCm: null, massG: null },
  };
  return { ...emptyPattern(), gauge: { active: 'meres', profiles: [profile] } };
}

describe('choices', () => {
  test('shape, stitch, start, round closing and jog fix all offer Hungarian labels', () => {
    assert.deepEqual(
      SHAPE_CHOICES.map((choice) => choice.label),
      ['Lapos kör', 'Négyzet', 'Hatszög', 'Nyolcszög', 'Nagymama-négyzet — Hamarosan'],
    );
    // PQW-925: the granny square stays visible but unselectable until the first UAT round.
    assert.deepEqual(
      SHAPE_CHOICES.filter((choice) => choice.soon).map((choice) => choice.value),
      ['granny-square'],
    );
    assert.deepEqual(
      STITCH_CHOICES.map((choice) => choice.label),
      ['Rövidpálca', 'Félpálca', 'Egyráhajtásos pálca', 'Kétráhajtásos pálca'],
    );
    assert.deepEqual(
      START_CHOICES.map((choice) => choice.value),
      ['magic-ring', 'chain-ring', 'chain'],
    );
    assert.deepEqual(
      CLOSING_CHOICES.map((choice) => choice.value),
      ['join-slip', 'spiral'],
    );
    assert.equal(JOG_CHOICES[0].value, 'none');
  });

  test('the owner chose the joined round as the default (amigurumi lives in PQW-863)', () => {
    assert.equal(DEFAULT_MOTIF.closing, 'join-slip');
  });
});

describe('fields per shape', () => {
  test('the granny square is forced to double crochet and a joined round, and cannot start from a chain', () => {
    const granny = normalizeMotif(options({ shape: 'granny-square', stitch: 'sc', closing: 'spiral', start: 'chain' }));
    assert.equal(granny.stitch, 'dc');
    assert.equal(granny.closing, 'join-slip');
    assert.equal(granny.start, 'magic-ring');
    // Ribbing is tied to the slip-stitch join, so it stays available for the granny square too (PQW-909).
    assert.deepEqual(fieldState(granny), {
      stitch: false,
      chainStart: false,
      closing: false,
      stagger: false,
      jogFix: false,
      ribbing: true,
      ribbingFields: false,
    });
  });

  test('staggered increases only on a flat circle, jog fix only in a spiral with colour changes', () => {
    assert.equal(fieldState(options({ shape: 'square' })).stagger, false);
    assert.equal(fieldState(options()).stagger, true);
    assert.equal(fieldState(options({ closing: 'spiral' })).jogFix, false);
    assert.equal(fieldState(options({ closing: 'spiral', colorEvery: 2 })).jogFix, true);
    assert.equal(normalizeMotif(options({ jogFix: 'slip-stitch' })).jogFix, null);
    assert.equal(
      normalizeMotif(options({ closing: 'spiral', colorEvery: 2, jogFix: 'slip-stitch' })).jogFix,
      'slip-stitch',
    );
  });
});

describe('the increase note', () => {
  test('without a profile the note is a flagged estimate from the usual in-the-round ratio of the stitch', () => {
    const sc = options();
    const note = increaseNote(motifIncreases(emptyPattern(), sc), sc);
    assert.match(note, /^Körönként 6 szaporítás: 2π × 1 ≈ 6,3, páros számra kerekítve\./);
    assert.match(note, /Becslés a rövidpálca szokásos körös magasság\/szélesség arányából/);

    const dc = options({ stitch: 'dc' });
    assert.match(
      increaseNote(motifIncreases(emptyPattern(), dc), dc),
      /^Körönként 12 szaporítás[\s\S]*Becslés az egyráhajtásos pálca/,
    );
  });

  test('from the gauge measured in the round, converted when another stitch is chosen', () => {
    const pattern = measuredSc();
    const sc = options();
    assert.match(increaseNote(motifIncreases(pattern, sc), sc), /A rövidpálca körben mért mintasűrűségéből\.$/);
    const dc = options({ stitch: 'dc' });
    assert.match(
      increaseNote(motifIncreases(pattern, dc), dc),
      /A rövidpálca körben mért mintasűrűségéből, az egyráhajtásos pálca arányára átszámolva\.$/,
    );
  });

  test('polygons increase in the corners, the granny square follows its own corner rule', () => {
    const square = options({ shape: 'square' });
    assert.match(
      increaseNote(motifIncreases(emptyPattern(), square), square),
      /^Körönként kb\. 8 szaporítás a 4 sarokban, egymás fölé kerülve/,
    );
    const granny = normalizeMotif(options({ shape: 'granny-square' }));
    assert.match(
      increaseNote(motifIncreases(emptyPattern(), granny), granny),
      /^Sarkonként 3 erp, 2 lsz, 3 erp, oldalanként 3 erp, 1 lsz/,
    );
  });

  test('the status message names the shape and the number of rounds', () => {
    assert.equal(
      generatedMessage(options({ rounds: 4 })),
      'Lapos kör, 4 kör elkészült; visszavonással a korábbi minta visszajön.',
    );
  });

  test('the core returns a code and the dictionary assembles the sentence (PQW-904)', () => {
    const problem = motifProblem(options({ rounds: 0 }));
    assert.deepEqual(problem, { code: 'rounds-range', data: { max: 30 } });
    assert.equal(amigurumiCoreText(problem), 'A körök száma 1 és 30 között lehet.');
    // The Hungarian article belongs to the UI as well: the core carries only the round number.
    assert.equal(
      amigurumiCoreText({ code: 'round-plan-mismatch', data: { round: 3 } }),
      'A(z) 3. kör terve nem illik az előző körhöz.',
    );
  });
});
