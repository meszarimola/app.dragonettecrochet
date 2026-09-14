/*
 * Az írott minta panelje (PQW-868): a rögzített szöveg a választott
 * jelöléssel, a félkész és a hibás minta megjegyzése, és érthető üzenet, ha a
 * minta még nem írható ki.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { contextOf, defaultCursor, emptyPattern, endRow, liveCheck, work } from '../src/core/editor.ts';
import { writtenView } from '../src/ui/written.ts';
import { hdcRectangle } from './fixtures/examples.ts';

const view = (pattern, terms = 'hu') => writtenView(pattern, contextOf(pattern), liveCheck(pattern), terms);
const fixture = (locale, name) => readFileSync(new URL(`./fixtures/written/${locale}/${name}.txt`, import.meta.url), 'utf8');

function ok(result) {
  if (!result.ok) throw new Error(result.reason);
  return result.pattern;
}

/** Láncalap, egy teljes rövidpálcás sor, fordulás, és a 2. sorból `done` öltés. */
function halfRow(done) {
  let pattern = ok(work(emptyPattern(), { def: 'ch', count: 6 }, 0));
  const sc = () => {
    pattern = ok(work(pattern, { def: 'sc', count: 1 }, defaultCursor(pattern, contextOf(pattern), 'sc')));
  };
  for (let i = 0; i < 5; i += 1) sc();
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
  assert.match(british, /15 htr \(15 sts\)/);
  assert.doesNotMatch(british, /\b(sc|hdc|sl st)\b/);
});

test('névtelen mintánál a szöveg címe „Névtelen minta”', () => {
  const { pattern } = hdcRectangle({ rows: 1 });
  assert.match(view({ ...pattern, title: '  ' }).text, /^Névtelen minta\n/);
});

test('félkész sor: a szöveg látszik, megjegyzéssel', () => {
  const result = view(halfRow(2));
  assert.equal(result.kind, 'text');
  assert.match(result.text, /2\. sor: 1 lsz \(nem számít öltésnek\), 2 rp \(2 öltés\)\.$/m);
  assert.deepEqual(result.notices, ['A 2. sor félkész, még 3 célpont van hátra: a szöveg a mostani állapotot írja le.']);
});

test('hibás minta: a szöveg mellett megjegyzés a hibák számával', () => {
  let pattern = halfRow(1);
  // Két öltés kihagyása a sor közepén: az ellenőrző hibát jelez.
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
  assert.match(result.message, /^Ez a minta még nem írható ki\. .*keresztezett vagy hosszú öltés/);
});
