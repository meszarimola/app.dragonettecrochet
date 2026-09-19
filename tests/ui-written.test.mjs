/*
 * The written pattern panel (PQW-868): the recorded text in the chosen
 * notation, the notices for a half-finished and for an invalid pattern, and a
 * readable message when the pattern cannot be written out yet.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { contextOf, defaultCursor, emptyPattern, endRow, liveCheck, work } from '../src/core/editor.ts';
import { writtenPieces } from '../src/core/pattern-steps.ts';
import { writtenView } from '../src/ui/written.ts';
import { hdcRectangle } from './fixtures/examples.ts';
import { testLibrary } from './fixtures/library.ts';

const view = (pattern, terms = 'hu') => writtenView(pattern, contextOf(pattern), liveCheck(pattern), terms);
const fixture = (locale, name) => readFileSync(new URL(`./fixtures/written/${locale}/${name}.txt`, import.meta.url), 'utf8');

function ok(result) {
  if (!result.ok) throw new Error(result.reason);
  return result.pattern;
}

/** Foundation chain, one complete single crochet row (the turning chain is the first stitch, PQW-891), a turn, then `done` stitches of row 3. */
function halfRow(done) {
  let pattern = ok(work(emptyPattern(), { def: 'ch', count: 6 }, 0));
  const sc = () => {
    pattern = ok(work(pattern, { def: 'sc', count: 1 }, defaultCursor(pattern, contextOf(pattern), 'sc')));
  };
  for (let i = 0; i < 4; i += 1) sc();
  pattern = ok(endRow(pattern));
  for (let i = 0; i < done; i += 1) sc();
  return pattern;
}

test('an empty pattern gets a message, not an error', () => {
  assert.deepEqual(view(emptyPattern()), {
    kind: 'message',
    message: 'Még nincs mit kiírni: kezdd láncalappal vagy varázskörrel.',
  });
});

test('a finished rectangle renders the recorded text, with no notice', () => {
  const { pattern } = hdcRectangle();
  assert.deepEqual(view(pattern), { kind: 'text', text: fixture('hu', 'felpalcas-teglalap'), notices: [] });
});

test('switching notation switches the written text as well', () => {
  const { pattern } = hdcRectangle();
  assert.equal(view(pattern, 'en-US').text, fixture('en-US', 'felpalcas-teglalap'));
  const british = view(pattern, 'en-GB').text;
  assert.match(british, /^Abbreviations \(UK terms\)$/m);
  assert.match(british, /15 htr \(16 sts\)/);
  assert.doesNotMatch(british, /\b(sc|hdc|sl st)\b/);
});

test('an untitled pattern gets „Névtelen minta” as the heading of the text', () => {
  const { pattern } = hdcRectangle({ rows: 1 });
  assert.match(view({ ...pattern, title: '  ' }).text, /^Névtelen minta\n/);
});

test('a half-finished row still renders the text, with a notice', () => {
  const result = view(halfRow(2));
  assert.equal(result.kind, 'text');
  // The turning chain sits where the first stitch of the row would be, so the text spells out the skip (PQW-944).
  assert.match(result.text, /3\. sor: 1 lsz \(1 rp-nek számít\), 1 szem kihagyása, 1 rp \(2 szem\)\.$/m);
  assert.deepEqual(result.notices, ['A 3. sor félkész, még 3 célpont van hátra: a szöveg a mostani állapotot írja le.']);
});

test('an invalid pattern renders the text plus a notice counting the errors', () => {
  let pattern = halfRow(2);
  // Skipping two stitches mid-row: the checker reports an error (PQW-944: the first stitch is the turning chain).
  pattern = ok(work(pattern, { def: 'sc', count: 1 }, 4));
  const result = view(pattern);
  assert.equal(result.kind, 'text');
  assert.ok(result.notices.some((notice) => /^A mintában \d+ hiba van \(lásd Ellenőrzés\)/.test(notice)), result.notices.join(' | '));
});

test('what the written text cannot express yet gets a readable message, not an exception', () => {
  const { pattern, rows } = hdcRectangle({ rows: 2 });
  const piece = pattern.pieces[0];
  const crossed = {
    ...pattern,
    pieces: [{ ...piece, stitches: piece.stitches.map((node) => (node.id === rows[2][3] ? { ...node, flags: ['crossed'] } : node)) }],
  };
  const result = view(crossed);
  assert.equal(result.kind, 'message');
  // The Hungarian sentence is the same to the letter as before PQW-904: the article,
  // the word for the row and the closing clause are assembled by the UI dictionary from the core codes.
  assert.equal(result.message, 'Ez a minta még nem írható ki. A(z) 3. sor keresztezett szemet tartalmaz.');
  // No internal concept leaks into the user-facing message (PQW-879).
  assert.doesNotMatch(result.message, /réteg|darab/i);
});

test('the core supplies a code and data, and the interface assembles the sentence (PQW-904)', () => {
  const { pattern, rows } = hdcRectangle({ rows: 2 });
  const piece = pattern.pieces[0];
  const crossed = {
    ...pattern,
    pieces: [{ ...piece, stitches: piece.stitches.map((node) => (node.id === rows[2][3] ? { ...node, flags: ['crossed'] } : node)) }],
  };
  assert.throws(
    () => writtenPieces(crossed, testLibrary),
    (error) => {
      // The row number and the row/round shape are data, the closing clause is a separate code: the core holds no Hungarian sentence.
      assert.equal(error.code, 'layer-unsupported');
      assert.deepEqual(error.data, { inner: 'crossed', index: 2, shape: 'row' });
      assert.deepEqual(error.nodes, [rows[2][3]]);
      return true;
    },
  );
});
