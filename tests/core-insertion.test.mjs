/*
 * Insertion mode when placing stitches (PQW-869): the mode chosen from the
 * crocheter's side is stored in the graph as a right-side mode; every path
 * that places a stitch (working, filling a row, duplicating) honours it; the
 * written pattern spells it out with the abbreviations of the vocabulary and
 * reads it back; and a forbidden mode is refused with an understandable
 * reason.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { canonicalPattern } from '../src/core/canonical.ts';
import { contextOf, defaultCursor, emptyPattern, endRow, fillRow, work } from '../src/core/editor.ts';
import {
  effectiveInsertion,
  INSERTION_NAMES,
  modeAsWorked,
  nodeInsertions,
  STITCH_INSERTIONS,
  stitchInsertions,
} from '../src/core/insertion.ts';
import { readPattern } from '../src/core/pattern-read.ts';
import { formatWrittenPattern, writePattern } from '../src/core/pattern-text.ts';
import { duplicateSelection, layerSelection } from '../src/core/selection.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { stitchById } from '../src/core/stitches.ts';
import { validatePattern } from '../src/core/validate.ts';
import { EDITOR_CORE_TEXTS } from '../src/ui/i18n/core/editor.ts';
import { renderCoreText } from '../src/ui/i18n/core/render.ts';

/** The core hands over a code and data (PQW-904); the Hungarian sentence comes from the UI dictionary. */
const huText = (reason) => renderCoreText(EDITOR_CORE_TEXTS.hu, reason);

function ok(result) {
  assert.ok(result.ok, result.ok ? '' : huText(result.reason));
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
  pieces: pattern.pieces.map((piece) => ({
    ...piece,
    events: piece.events.map(({ statedCount: _, ...event }) => event),
  })),
});

/** The stored right-side mode of the stitches of a layer, leaving the chains out. */
function storedModes(pattern, layer) {
  const modes = nodeInsertions(pattern.pieces[0]);
  return layerSelection(pattern, layer)
    .filter((id) => modes.has(id))
    .map((id) => modes.get(id));
}

/** Two rows in the same mode as seen from the crocheter's side; the turning chain is the first stitch of the row and carries no stored mode (PQW-891). */
function twoRows(def, insertion, chainCount = 7) {
  let pattern = fill(chains(emptyPattern(), chainCount), def, insertion);
  pattern = ok(endRow(pattern));
  return fill(pattern, def, insertion);
}

describe('the helper functions of the core', () => {
  test('the allowed modes come from the insertionModes list of the library, without chain spaces and rings', () => {
    assert.deepEqual(stitchInsertions(stitchById('dc')), STITCH_INSERTIONS);
    assert.deepEqual(stitchInsertions(stitchById('sl-st')), ['both-loops', 'front-loop', 'back-loop']);
    assert.deepEqual(stitchInsertions(stitchById('rev-sc')), ['both-loops']);
    assert.deepEqual(stitchInsertions(stitchById('ch')), []);
  });

  test('the effective mode is the requested one when it is allowed, otherwise the default of the stitch', () => {
    assert.equal(effectiveInsertion(stitchById('sc'), 'back-post'), 'back-post');
    assert.equal(effectiveInsertion(stitchById('sl-st'), 'back-post'), 'both-loops');
    assert.equal(effectiveInsertion(stitchById('invdec'), null), 'front-loop');
    assert.equal(effectiveInsertion(stitchById('ch'), 'back-loop'), undefined);
  });

  test('flipping a wrong-side row is its own inverse and leaves the right side untouched', () => {
    for (const mode of STITCH_INSERTIONS) {
      assert.equal(modeAsWorked(mode, 'right'), mode);
      assert.equal(modeAsWorked(modeAsWorked(mode, 'wrong'), 'wrong'), mode);
    }
    assert.equal(modeAsWorked('back-loop', 'wrong'), 'front-loop');
    assert.equal(modeAsWorked('front-post', 'wrong'), 'back-post');
  });

  test('every mode carries its Hungarian name from the vocabulary', () => {
    assert.deepEqual(Object.values(INSERTION_NAMES), [
      'mindkét szál',
      'első szál',
      'hátsó szál',
      'első relief',
      'hátsó relief',
    ]);
  });
});

describe('placing stitches in the chosen mode', () => {
  test('filling a row into the back loop: on a right-side row the stored mode is back loop too, on a wrong-side row it is front loop', () => {
    // 7 chains: after 2 skips that is 5 single crochets per row; the turning chain is not a stitch (PQW-924).
    const pattern = twoRows('sc', 'back-loop');
    assert.deepEqual(storedModes(pattern, 1), Array(5).fill('back-loop'));
    assert.deepEqual(storedModes(pattern, 2), Array(5).fill('front-loop'));
    assert.deepEqual(findings(pattern), []);
  });

  test('a single stitch at the cursor, worked as a post stitch; with no mode given the default of the stitch applies', () => {
    // The double crochet starts at the 5th chain: two of them need 6 chains (PQW-891).
    let pattern = chains(emptyPattern(), 6);
    const at = (p) => defaultCursor(p, contextOf(p), 'dc');
    pattern = ok(work(pattern, { def: 'dc', count: 1, insertion: 'front-post' }, at(pattern)));
    pattern = ok(work(pattern, { def: 'dc', count: 1 }, at(pattern)));
    assert.deepEqual(storedModes(pattern, 1), ['front-post', 'both-loops']);
  });

  test('every target of a decrease and every member of an increase uses the chosen mode', () => {
    let pattern = chains(emptyPattern(), 6);
    pattern = ok(
      work(
        pattern,
        { def: 'sc2tog', count: 1, insertion: 'front-loop' },
        defaultCursor(pattern, contextOf(pattern), 'sc2tog'),
      ),
    );
    pattern = ok(
      work(
        pattern,
        { def: 'inc-2sc', count: 1, insertion: 'back-loop' },
        defaultCursor(pattern, contextOf(pattern), 'inc-2sc'),
      ),
    );
    const [decrease, ...members] = pattern.pieces[0].stitches.slice(6);
    assert.deepEqual(
      decrease.anchors.map((anchor) => anchor.mode),
      ['front-loop', 'front-loop'],
    );
    assert.deepEqual(
      members.map((node) => node.anchors[0].mode),
      ['back-loop', 'back-loop'],
    );
  });

  test('a forbidden mode gives an understandable reason and leaves the pattern unchanged', () => {
    const pattern = chains(emptyPattern(), 5);
    const at = defaultCursor(pattern, contextOf(pattern), 'sl-st');
    const result = work(pattern, { def: 'sl-st', count: 1, insertion: 'front-post' }, at);
    assert.equal(result.ok, false);
    // The core hands over the ids of the stitch and the modes; the sentence is built in the dictionary, with the stitch name in the language of the notation.
    assert.equal(result.reason.code, 'insertion-not-allowed');
    assert.deepEqual(result.reason.data, {
      stitch: 'sl-st',
      requested: 'front-post',
      allowed: ['both-loops', 'front-loop', 'back-loop'],
    });
    assert.equal(
      huText(result.reason),
      'A(z) kúszószem nem horgolható így: első relief. Választható: mindkét szál, első szál, hátsó szál.',
    );
    const filled = fillRow(pattern, { def: 'rev-sc', count: 1, insertion: 'back-loop' });
    assert.equal(filled.ok, false);
  });

  test('into a magic ring the loop choice does not matter: the stitch goes into the ring', () => {
    let pattern = ok(work(emptyPattern(), { def: 'magic-ring', count: 1 }, 0));
    pattern = ok(work(pattern, { def: 'sc', count: 1, insertion: 'back-loop' }, 0));
    assert.deepEqual(pattern.pieces[0].stitches[1].anchors, [{ into: 'ring', id: 'r1' }]);
  });

  test('the invisible decrease is clean on a wrong-side row too: front loop from the crocheter, stored as back loop', () => {
    let pattern = fill(chains(emptyPattern(), 7), 'sc');
    pattern = ok(endRow(pattern));
    pattern = ok(work(pattern, { def: 'invdec', count: 1 }, defaultCursor(pattern, contextOf(pattern), 'invdec')));
    assert.deepEqual(
      pattern.pieces[0].stitches.at(-1).anchors.map((anchor) => anchor.mode),
      ['back-loop', 'back-loop'],
    );
    assert.deepEqual(
      findings(pattern).filter((finding) => finding.rule === 'insertion-mode'),
      [],
    );
  });
});

describe('duplicating: the mode as seen from the crocheter stays put', () => {
  test('a wrong-side row is stored flipped, as a right-side row', () => {
    const pattern = twoRows('hdc', 'back-loop');
    const copy = ok(duplicateSelection(pattern, layerSelection(pattern, 2)));
    // The turning chain is not a stitch (PQW-924): all five stitches of the row land in the copy.
    assert.deepEqual(storedModes(copy, 3), Array(5).fill('back-loop'));
    assert.deepEqual(findings(copy), []);
    // Row 3 is followed by a turn and the duplicated row 4 ends the pattern, so we compare them without the closing sentence.
    // The written row number is one more than the layer index (PQW-923): the foundation is row 1.
    const row = (n) =>
      text(copy, 'hu')
        .split('\n')
        .find((line) => line.startsWith(`${n}. sor:`))
        .slice(2)
        .replace(/ Fordítás\.$/, '');
    assert.equal(row(4), row(3));
  });

  test('into a row of the same side it copies unchanged', () => {
    let pattern = twoRows('hdc', 'back-loop');
    pattern = ok(duplicateSelection(pattern, layerSelection(pattern, 2)));
    const copy = ok(duplicateSelection(pattern, layerSelection(pattern, 2)));
    assert.deepEqual(storedModes(copy, 4), storedModes(copy, 2));
  });
});

describe('written pattern and reading it back (szókészlet §3)', () => {
  const cases = [
    // The turning chain sits where the first stitch of the row would be, so the text spells out the skip (PQW-944).
    [
      'sc',
      'back-loop',
      'hu',
      /3\. sor: 1 lsz \(1 rp-nek számít\), 1 szem kihagyása, 7 rp \(hsz\)/,
      'hsz – hátsó szálba',
    ],
    ['sc', 'front-loop', 'hu', /7 rp \(esz\)/, 'esz – első szálba'],
    ['dc', 'front-post', 'hu', /\d Eerp/, 'Eerp – első relief egyráhajtásos pálca (elölről hurkolt)'],
    ['dc', 'back-post', 'hu', /\d Herp/, 'Herp – hátsó relief egyráhajtásos pálca (hátulról hurkolt)'],
    ['hdc', 'front-post', 'hu', /\d fp \(első relief\)/, null],
    ['sc', 'back-loop', 'en-US', /7 sc BLO/, 'BLO – back loop only'],
    ['sc', 'front-loop', 'en-GB', /7 dc FLO/, 'FLO – front loop only'],
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
      // Read back, the stitch count in the text becomes a stated count; the editor never writes one, so we compare without it.
      assert.deepEqual(
        withoutStatedCounts(canonicalPattern(result.pattern)),
        withoutStatedCounts(canonicalPattern(pattern)),
      );
    });
  }
});
