/*
 * Beszúrási mód lerakáskor (PQW-869): a horgoló felől választott mód a gráfban
 * színoldali módként tárolódik; minden lerakási út (horgolás, sor kitöltése,
 * duplikálás) tiszteletben tartja; az írott minta a szókészlet rövidítéseivel
 * írja ki és visszaolvassa; a tiltott mód érthető okkal elutasított.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { canonicalPattern } from '../src/core/canonical.ts';
import { contextOf, defaultCursor, emptyPattern, endRow, fillRow, work } from '../src/core/editor.ts';
import {
  INSERTION_NAMES,
  STITCH_INSERTIONS,
  effectiveInsertion,
  modeAsWorked,
  nodeInsertions,
  stitchInsertions,
} from '../src/core/insertion.ts';
import { readPattern } from '../src/core/pattern-read.ts';
import { formatWrittenPattern, writePattern } from '../src/core/pattern-text.ts';
import { duplicateSelection, layerSelection } from '../src/core/selection.ts';
import { stitchById } from '../src/core/stitches.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { validatePattern } from '../src/core/validate.ts';

function ok(result) {
  assert.ok(result.ok, result.reason);
  return result.pattern;
}

const chains = (pattern, count) => ok(work(pattern, { def: 'ch', count }, 0));
const fill = (pattern, def, insertion) => ok(fillRow(pattern, { def, count: 1, insertion }));
const findings = (pattern) => validatePattern(pattern, libraryFor(pattern));
const text = (pattern, locale) => formatWrittenPattern(writePattern(pattern, libraryFor(pattern), locale));
const readBack = (written, pattern, locale) =>
  readPattern(written, { library: libraryFor(pattern), locale, conventions: pattern.conventions });

const withoutStatedCounts = (pattern) => ({
  ...pattern,
  pieces: pattern.pieces.map((piece) => ({ ...piece, events: piece.events.map(({ statedCount: _, ...event }) => event) })),
});

/** A réteg szemeinek tárolt, színoldali módja, a láncszemek nélkül. */
function storedModes(pattern, layer) {
  const modes = nodeInsertions(pattern.pieces[0]);
  return layerSelection(pattern, layer).filter((id) => modes.has(id)).map((id) => modes.get(id));
}

/** Két sor ugyanazzal a horgoló felől nézett móddal. */
function twoRows(def, insertion, chainCount = 7) {
  let pattern = fill(chains(emptyPattern(), chainCount), def, insertion);
  pattern = ok(endRow(pattern, def));
  return fill(pattern, def, insertion);
}

describe('a mag segédfüggvényei', () => {
  test('a megengedett módok a könyvtár insertionModes listájából, láncív és gyűrű nélkül', () => {
    assert.deepEqual(stitchInsertions(stitchById('dc')), STITCH_INSERTIONS);
    assert.deepEqual(stitchInsertions(stitchById('sl-st')), ['both-loops', 'front-loop', 'back-loop']);
    assert.deepEqual(stitchInsertions(stitchById('rev-sc')), ['both-loops']);
    assert.deepEqual(stitchInsertions(stitchById('ch')), []);
  });

  test('az érvényes mód a kért, ha megengedett, különben a szem alapértelmezése', () => {
    assert.equal(effectiveInsertion(stitchById('sc'), 'back-post'), 'back-post');
    assert.equal(effectiveInsertion(stitchById('sl-st'), 'back-post'), 'both-loops');
    assert.equal(effectiveInsertion(stitchById('invdec'), null), 'front-loop');
    assert.equal(effectiveInsertion(stitchById('ch'), 'back-loop'), undefined);
  });

  test('a visszai sor megfordítása önmaga inverze, a színoldalon nem változtat', () => {
    for (const mode of STITCH_INSERTIONS) {
      assert.equal(modeAsWorked(mode, 'right'), mode);
      assert.equal(modeAsWorked(modeAsWorked(mode, 'wrong'), 'wrong'), mode);
    }
    assert.equal(modeAsWorked('back-loop', 'wrong'), 'front-loop');
    assert.equal(modeAsWorked('front-post', 'wrong'), 'back-post');
  });

  test('minden módnak a szókészlet szerinti magyar neve van', () => {
    assert.deepEqual(Object.values(INSERTION_NAMES), ['mindkét szál', 'első szál', 'hátsó szál', 'első relief', 'hátsó relief']);
  });
});

describe('lerakás a választott móddal', () => {
  test('sor kitöltése hátsó szálba: színoldali soron a tárolt mód is hátsó szál, visszai soron első szál', () => {
    const pattern = twoRows('sc', 'back-loop');
    assert.deepEqual(storedModes(pattern, 1), Array(6).fill('back-loop'));
    assert.deepEqual(storedModes(pattern, 2), Array(6).fill('front-loop'));
    assert.deepEqual(findings(pattern), []);
  });

  test('egy szem a kurzorhoz, relieffel; mód nélkül a szem alapértelmezése', () => {
    let pattern = chains(emptyPattern(), 5);
    const at = (p) => defaultCursor(p, contextOf(p), 'dc');
    pattern = ok(work(pattern, { def: 'dc', count: 1, insertion: 'front-post' }, at(pattern)));
    pattern = ok(work(pattern, { def: 'dc', count: 1 }, at(pattern)));
    assert.deepEqual(storedModes(pattern, 1), ['front-post', 'both-loops']);
  });

  test('a fogyasztás minden célpontja és a szaporítás minden tagja a választott móddal', () => {
    let pattern = chains(emptyPattern(), 6);
    pattern = ok(work(pattern, { def: 'sc2tog', count: 1, insertion: 'front-loop' }, defaultCursor(pattern, contextOf(pattern), 'sc2tog')));
    pattern = ok(work(pattern, { def: 'inc-2sc', count: 1, insertion: 'back-loop' }, defaultCursor(pattern, contextOf(pattern), 'inc-2sc')));
    const [decrease, ...members] = pattern.pieces[0].stitches.slice(6);
    assert.deepEqual(decrease.anchors.map((anchor) => anchor.mode), ['front-loop', 'front-loop']);
    assert.deepEqual(members.map((node) => node.anchors[0].mode), ['back-loop', 'back-loop']);
  });

  test('tiltott módra érthető ok, és a minta nem változik', () => {
    const pattern = chains(emptyPattern(), 5);
    const at = defaultCursor(pattern, contextOf(pattern), 'sl-st');
    const result = work(pattern, { def: 'sl-st', count: 1, insertion: 'front-post' }, at);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'A(z) kúszószem nem horgolható így: első relief. Választható: mindkét szál, első szál, hátsó szál.');
    const filled = fillRow(pattern, { def: 'rev-sc', count: 1, insertion: 'back-loop' });
    assert.equal(filled.ok, false);
  });

  test('varázskörbe a szálválasztás nem számít: a szem a gyűrűbe kerül', () => {
    let pattern = ok(work(emptyPattern(), { def: 'magic-ring', count: 1 }, 0));
    pattern = ok(work(pattern, { def: 'sc', count: 1, insertion: 'back-loop' }, 0));
    assert.deepEqual(pattern.pieces[0].stitches[1].anchors, [{ into: 'ring', id: 'r1' }]);
  });

  test('a láthatatlan fogyasztás visszai soron is hibátlan: a horgoló felől első szál, tárolva hátsó', () => {
    let pattern = fill(chains(emptyPattern(), 7), 'sc');
    pattern = ok(endRow(pattern, 'sc'));
    pattern = ok(work(pattern, { def: 'invdec', count: 1 }, defaultCursor(pattern, contextOf(pattern), 'invdec')));
    assert.deepEqual(pattern.pieces[0].stitches.at(-1).anchors.map((anchor) => anchor.mode), ['back-loop', 'back-loop']);
    assert.deepEqual(findings(pattern).filter((finding) => finding.rule === 'insertion-mode'), []);
  });
});

describe('duplikálás: a horgoló felől nézett mód marad', () => {
  test('a visszai sor színoldali sorként megfordítva tárolódik', () => {
    const pattern = twoRows('hdc', 'back-loop');
    const copy = ok(duplicateSelection(pattern, layerSelection(pattern, 2)));
    assert.deepEqual(storedModes(copy, 3), Array(5).fill('back-loop'));
    assert.deepEqual(findings(copy), []);
    // A 2. sor után fordulás áll, a duplikált 3. sor a minta vége: a záró mondat nélkül vetjük össze.
    const row = (n) => text(copy, 'hu').split('\n').find((line) => line.startsWith(`${n}. sor:`)).slice(2).replace(/ Fordítás\.$/, '');
    assert.equal(row(3), row(2));
  });

  test('azonos oldalú sorba változatlanul', () => {
    let pattern = twoRows('hdc', 'back-loop');
    pattern = ok(duplicateSelection(pattern, layerSelection(pattern, 2)));
    const copy = ok(duplicateSelection(pattern, layerSelection(pattern, 2)));
    assert.deepEqual(storedModes(copy, 4), storedModes(copy, 2));
  });
});

describe('írott minta és visszaolvasás (szókészlet §3)', () => {
  const cases = [
    ['sc', 'back-loop', 'hu', /2\. sor: 1 lsz \(nem számít szemnek\), 8 rp \(hsz\)/, 'hsz – hátsó szálba'],
    ['sc', 'front-loop', 'hu', /8 rp \(esz\)/, 'esz – első szálba'],
    ['dc', 'front-post', 'hu', /\d Eerp/, 'Eerp – első relief egyráhajtásos pálca (elölről hurkolt)'],
    ['dc', 'back-post', 'hu', /\d Herp/, 'Herp – hátsó relief egyráhajtásos pálca (hátulról hurkolt)'],
    ['hdc', 'front-post', 'hu', /\d fp \(első relief\)/, null],
    ['sc', 'back-loop', 'en-US', /8 sc BLO/, 'BLO – back loop only'],
    ['sc', 'front-loop', 'en-GB', /8 dc FLO/, 'FLO – front loop only'],
    ['dc', 'back-post', 'en-US', /\d BPdc/, 'BP – back post'],
  ];
  for (const [def, mode, locale, expected, abbreviation] of cases) {
    test(`${def}, ${INSERTION_NAMES[mode]}, ${locale}`, () => {
      const pattern = twoRows(def, mode, 9);
      assert.deepEqual(findings(pattern), []);
      const written = text(pattern, locale);
      assert.match(written, expected);
      if (abbreviation) assert.ok(written.split('\n').includes(abbreviation), written);
      const result = readBack(written, pattern, locale);
      assert.ok(result.ok, JSON.stringify(result.error));
      // A szöveg szemszáma visszaolvasva megadott szemszám lesz; a szerkesztő nem ír ilyet, ezért nélküle vetjük össze.
      assert.deepEqual(withoutStatedCounts(canonicalPattern(result.pattern)), withoutStatedCounts(canonicalPattern(pattern)));
    });
  }
});
