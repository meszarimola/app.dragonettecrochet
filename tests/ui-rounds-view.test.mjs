/*
 * A „Kör és motívum” szakasz tartalma (PQW-861): a választások, a mezők
 * állapota a formához, és a szaporítás magyarázata az eredetével.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { emptyPattern } from '../src/core/editor.ts';
import { DEFAULT_MOTIF, motifIncreases } from '../src/core/round-generator.ts';
import {
  CLOSING_CHOICES,
  JOG_CHOICES,
  SHAPE_CHOICES,
  START_CHOICES,
  STITCH_CHOICES,
  fieldState,
  generatedMessage,
  increaseNote,
  normalizeMotif,
} from '../src/ui/rounds-view.ts';

const options = (patch = {}) => ({ ...DEFAULT_MOTIF, ...patch });

/** Minta profillal, amelyben a rövidpálca körben mérve 20 szem és 20 kör 10 cm-en. */
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

describe('választások', () => {
  test('forma, szem, kezdés, körvég és lépcsőjavítás magyar felirattal', () => {
    assert.deepEqual(
      SHAPE_CHOICES.map((choice) => choice.label),
      ['Lapos kör', 'Négyzet', 'Hatszög', 'Nyolcszög', 'Nagymama-négyzet'],
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

  test('a tulajdonos döntése szerint az alapértelmezés a zárt kör (amigurumi a PQW-863)', () => {
    assert.equal(DEFAULT_MOTIF.closing, 'join-slip');
  });
});

describe('a mezők a formához', () => {
  test('a nagymama-négyzet pálcás, zárt kör, és nem kezdhető láncszembe', () => {
    const granny = normalizeMotif(options({ shape: 'granny-square', stitch: 'sc', closing: 'spiral', start: 'chain' }));
    assert.equal(granny.stitch, 'dc');
    assert.equal(granny.closing, 'join-slip');
    assert.equal(granny.start, 'magic-ring');
    // A bordás perem a kúszószemes záráshoz kötött, ezért a nagymama-négyzetnél is választható (PQW-909).
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

  test('eltolt szaporítás csak lapos körnél, lépcsőjavítás csak spirálban, színváltással', () => {
    assert.equal(fieldState(options({ shape: 'square' })).stagger, false);
    assert.equal(fieldState(options()).stagger, true);
    assert.equal(fieldState(options({ closing: 'spiral' })).jogFix, false);
    assert.equal(fieldState(options({ closing: 'spiral', colorEvery: 2 })).jogFix, true);
    assert.equal(normalizeMotif(options({ jogFix: 'slip-stitch' })).jogFix, null);
    assert.equal(normalizeMotif(options({ closing: 'spiral', colorEvery: 2, jogFix: 'slip-stitch' })).jogFix, 'slip-stitch');
  });
});

describe('a szaporítás magyarázata', () => {
  test('profil nélkül becslés, jelölve, a szem szokásos körös arányából', () => {
    const sc = options();
    const note = increaseNote(motifIncreases(emptyPattern(), sc), sc);
    assert.match(note, /^Körönként 6 szaporítás: 2π × 1 ≈ 6,3, páros számra kerekítve\./);
    assert.match(note, /Becslés a rövidpálca szokásos körös magasság\/szélesség arányából/);

    const dc = options({ stitch: 'dc' });
    assert.match(increaseNote(motifIncreases(emptyPattern(), dc), dc), /^Körönként 12 szaporítás[\s\S]*Becslés az egyráhajtásos pálca/);
  });

  test('körben mért mintasűrűségből, más szemnél átszámolva', () => {
    const pattern = measuredSc();
    const sc = options();
    assert.match(increaseNote(motifIncreases(pattern, sc), sc), /A rövidpálca körben mért mintasűrűségéből\.$/);
    const dc = options({ stitch: 'dc' });
    assert.match(increaseNote(motifIncreases(pattern, dc), dc), /A rövidpálca körben mért mintasűrűségéből, az egyráhajtásos pálca arányára átszámolva\.$/);
  });

  test('sokszögnél a sarkokban, a nagymama-négyzetnél a sarokszabály', () => {
    const square = options({ shape: 'square' });
    assert.match(increaseNote(motifIncreases(emptyPattern(), square), square), /^Körönként kb\. 8 szaporítás a 4 sarokban, egymás fölé kerülve/);
    const granny = normalizeMotif(options({ shape: 'granny-square' }));
    assert.match(increaseNote(motifIncreases(emptyPattern(), granny), granny), /^Sarkonként 3 erp, 2 lsz, 3 erp, oldalanként 3 erp, 1 lsz/);
  });

  test('az állapotsor üzenete a formával és a körszámmal', () => {
    assert.equal(
      generatedMessage(options({ rounds: 4 })),
      'Lapos kör, 4 kör elkészült; visszavonással a korábbi minta visszajön.',
    );
  });
});
