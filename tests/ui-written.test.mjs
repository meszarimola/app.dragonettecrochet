/*
 * Az írott minta panelje (PQW-868): a rögzített szöveg a választott
 * jelöléssel, a félkész és a hibás minta megjegyzése, és érthető üzenet, ha a
 * minta még nem írható ki.
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

/** Láncalap, egy teljes rövidpálcás sor (a fordulólánc az első szem, PQW-891), fordulás, és a 3. sorból `done` szem. */
function halfRow(done) {
  let pattern = ok(work(emptyPattern(), { def: 'ch', count: 6 }, 0));
  const sc = () => {
    pattern = ok(work(pattern, { def: 'sc', count: 1 }, defaultCursor(pattern, contextOf(pattern), 'sc')));
  };
  for (let i = 0; i < 4; i += 1) sc();
  pattern = ok(endRow(pattern, 'sc'));
  for (let i = 0; i < done; i += 1) sc();
  return pattern;
}

test('üres mintánál üzenet, nem hiba', () => {
  assert.deepEqual(view(emptyPattern()), {
    kind: 'message',
    message: 'Még nincs mit kiírni: kezdd láncalappal vagy varázskörrel.',
  });
});

test('a kész téglalapnál a rögzített szöveg áll, megjegyzés nélkül', () => {
  const { pattern } = hdcRectangle();
  assert.deepEqual(view(pattern), { kind: 'text', text: fixture('hu', 'felpalcas-teglalap'), notices: [] });
});

test('jelölésváltáskor a szöveg is vált', () => {
  const { pattern } = hdcRectangle();
  assert.equal(view(pattern, 'en-US').text, fixture('en-US', 'felpalcas-teglalap'));
  const british = view(pattern, 'en-GB').text;
  assert.match(british, /^Abbreviations \(UK terms\)$/m);
  assert.match(british, /15 htr \(16 sts\)/);
  assert.doesNotMatch(british, /\b(sc|hdc|sl st)\b/);
});

test('névtelen mintánál a szöveg címe „Névtelen minta”', () => {
  const { pattern } = hdcRectangle({ rows: 1 });
  assert.match(view({ ...pattern, title: '  ' }).text, /^Névtelen minta\n/);
});

test('félkész sor: a szöveg látszik, megjegyzéssel', () => {
  const result = view(halfRow(2));
  assert.equal(result.kind, 'text');
  assert.match(result.text, /3\. sor: 1 lsz \(1 rp-nek számít\), 2 rp \(3 szem\)\.$/m);
  assert.deepEqual(result.notices, ['A 3. sor félkész, még 2 célpont van hátra: a szöveg a mostani állapotot írja le.']);
});

test('hibás minta: a szöveg mellett megjegyzés a hibák számával', () => {
  let pattern = halfRow(1);
  // Két szem kihagyása a sor közepén: az ellenőrző hibát jelez. A sor négyszemes (PQW-924).
  pattern = ok(work(pattern, { def: 'sc', count: 1 }, 3));
  const result = view(pattern);
  assert.equal(result.kind, 'text');
  assert.ok(result.notices.some((notice) => /^A mintában \d+ hiba van \(lásd Ellenőrzés\)/.test(notice)), result.notices.join(' | '));
});

test('amit a szöveg még nem tud kifejezni: érthető üzenet, nem kivétel', () => {
  const { pattern, rows } = hdcRectangle({ rows: 2 });
  const piece = pattern.pieces[0];
  const crossed = {
    ...pattern,
    pieces: [{ ...piece, stitches: piece.stitches.map((node) => (node.id === rows[2][3] ? { ...node, flags: ['crossed'] } : node)) }],
  };
  const result = view(crossed);
  assert.equal(result.kind, 'message');
  // A magyar mondat betűre ugyanaz, mint a PQW-904 előtt: a névelőt, a sor szavát
  // és a mondatvéget a felületi szótár illeszti össze a mag kódjaiból.
  assert.equal(result.message, 'Ez a minta még nem írható ki. A(z) 3. sor keresztezett szemet tartalmaz.');
  // A felhasználói üzenetben nincs belső fogalom (PQW-879).
  assert.doesNotMatch(result.message, /réteg|darab/i);
});

test('a mag kódot és adatot ad, a mondatot a felület rakja össze (PQW-904)', () => {
  const { pattern, rows } = hdcRectangle({ rows: 2 });
  const piece = pattern.pieces[0];
  const crossed = {
    ...pattern,
    pieces: [{ ...piece, stitches: piece.stitches.map((node) => (node.id === rows[2][3] ? { ...node, flags: ['crossed'] } : node)) }],
  };
  assert.throws(
    () => writtenPieces(crossed, testLibrary),
    (error) => {
      // A sorszám és a sor/kör formája adat, a mondatvég külön kód: magyar mondat nincs a magban.
      assert.equal(error.code, 'layer-unsupported');
      assert.deepEqual(error.data, { inner: 'crossed', index: 2, shape: 'row' });
      assert.deepEqual(error.nodes, [rows[2][3]]);
      return true;
    },
  );
});
