/*
 * Counting the turning chain (PQW-876, PQW-891): in rows every turning chain
 * counts as a stitch under CYC, in Japanese only from half double crochet up; a
 * counting turning chain stands on one foundation chain, so row 1 starts at the
 * T + 2nd chain from the hook. In rounds the turning chain follows the stitch
 * library default. The graph, the validator, the editor, the written pattern and
 * reading it back all work from this.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { canonicalPattern } from '../src/core/canonical.ts';
import { contextOf, defaultCursor, emptyPattern, endRow, fillRow, setTradition, work } from '../src/core/editor.ts';
import { buildPieceGraph, computeLayers } from '../src/core/graph.ts';
import { loadPattern, savePattern } from '../src/core/pattern-json.ts';
import { readPattern } from '../src/core/pattern-read.ts';
import { formatWrittenPattern, writePattern } from '../src/core/pattern-text.ts';
import { foundationChainLength, repeatCounts } from '../src/core/repeat.ts';
import { stitchById } from '../src/core/stitches.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { firstChainFromHook, skippedChains, stitchTurningChainCounts, traditionOf, withTradition } from '../src/core/tradition.ts';
import { validatePattern } from '../src/core/validate.ts';
import { PieceBuilder, patternOf } from './fixtures/builder.ts';
import { testLibrary } from './fixtures/library.ts';

/**
 * A rectangle by the rules of a tradition: a foundation chain, row 1 starting at
 * the chain the rule picks, then a turning chain per row; with a counting turning
 * chain the first position of the row is skipped and the last stitch goes into the
 * top of the previous turning chain.
 */
function rectangle(id, stitches, rows, tradition) {
  const def = stitchById(id);
  const chains = def.turningChain;
  const counts = stitchTurningChainCounts(def, tradition, 'row');
  const length = foundationChainLength(stitches, chains, counts, tradition);
  // The written stitch count includes the turning chain when that counts as a stitch (PQW-940).
  const stated = stitches + (counts ? 1 : 0);
  const b = new PieceBuilder('p1', 'Téglalap');
  const foundation = b.chain(length);
  const fromHook = (k) => foundation[length - k];

  let row = [];
  for (let k = firstChainFromHook(chains, counts, tradition); k <= length; k += 1) row.push(b.stitch(id, fromHook(k)));
  b.event('turn', stated);
  for (let r = 2; r <= rows; r += 1) {
    b.chain(chains);
    // The turning chain is the first stitch of the row (PQW-940) but not a target: one stitch goes into every stitch of the previous row.
    const below = [...row].reverse();
    row = below.map((target) => b.stitch(id, target));
    b.event(r === rows ? 'fasten-off' : 'turn', stated);
  }
  return patternOf(`${id} téglalap`, [b.build()], tradition === 'japanese' ? { tradition } : {});
}

const textOf = (pattern, locale = 'hu') => formatWrittenPattern(writePattern(pattern, testLibrary, locale));
const findings = (pattern) => validatePattern(pattern, testLibrary);
const rules = (pattern) => [...new Set(findings(pattern).map((finding) => finding.rule))];
const stitchCounts = (pattern) => computeLayers(pattern, testLibrary).map((layer) => layer.stitchCount);
const asTradition = (pattern, tradition) => ({ ...pattern, conventions: withTradition(pattern.conventions, tradition) });

function ok(result) {
  assert.ok(result.ok, result.reason);
  return result.pattern;
}

/* ---- The rule ---- */

// prettier-ignore
const STANDING = [
  // stitch turning ch   CYC row: counts  CYC round: counts  Japanese: counts
  ['sc',    1,           true,            false,           false],
  ['hdc',   2,           true,            false,           true],
  ['dc',    3,           true,            true,            true],
  ['tr',    4,           true,            true,            true],
  ['dtr',   5,           true,            true,            true],
];

test('in rows every turning chain counts as a stitch under CYC and in Japanese only from half double crochet up; in rounds CYC counts from double crochet up (01 §3.3, PQW-891)', () => {
  for (const [id, chains, cycRow, cycRound, japanese] of STANDING) {
    const def = stitchById(id);
    assert.equal(def.turningChain, chains, id);
    assert.equal(stitchTurningChainCounts(def, 'cyc', 'row'), cycRow, `${id}, CYC, row`);
    assert.equal(stitchTurningChainCounts(def, 'cyc', 'round'), cycRound, `${id}, CYC, round`);
    assert.equal(stitchTurningChainCounts(def, 'japanese', 'row'), japanese, `${id}, Japanese, row`);
    assert.equal(stitchTurningChainCounts(def, 'japanese', 'round'), japanese, `${id}, Japanese, round`);
  }
  // A compound stitch follows its component stitch; chain, slip stitch and magic ring never count.
  assert.equal(stitchTurningChainCounts(stitchById('inc-2sc'), 'japanese', 'row'), false);
  assert.equal(stitchTurningChainCounts(stitchById('inc-2sc'), 'cyc', 'row'), true);
  assert.equal(stitchTurningChainCounts(testLibrary.get('inc-2hdc'), 'japanese', 'row'), true);
  assert.equal(stitchTurningChainCounts(stitchById('dc2tog'), 'japanese', 'row'), true);
  for (const id of ['ch', 'sl-st', 'magic-ring']) {
    for (const tradition of ['cyc', 'japanese']) {
      for (const shape of ['row', 'round']) assert.equal(stitchTurningChainCounts(stitchById(id), tradition, shape), false, `${id}, ${tradition}, ${shape}`);
    }
  }
});

// prettier-ignore
const FOUNDATION = [
  // stitch N    CYC: ch   from hook  Japanese: ch  from hook
  // Skipped chains follow the owner's table (PQW-924): sc 2, hdc 2, dc 3, tr 4,
  // dtr 5. The foundation chain is the requested stitch count plus the skip, and
  // after the skip one stitch goes into every chain — so it lands on exactly N.
  // In Japanese tradition the sc turning chain does not count: there the skip is 1.
  ['sc',    20,  22,       3,         21,         2],
  ['hdc',   20,  22,       3,         22,         3],
  ['dc',    20,  23,       4,         23,         4],
  ['tr',    20,  24,       5,         24,         5],
  ['dtr',   20,  25,       6,         25,         6],
];

test('a foundation chain for N stitches in a row is the requested count plus the skip, and the first stitch goes into the chain after the skip (PQW-924)', () => {
  for (const [id, n, cycChains, cycFrom, japaneseChains, japaneseFrom] of FOUNDATION) {
    const def = stitchById(id);
    for (const [tradition, chains, from] of [
      ['cyc', cycChains, cycFrom],
      ['japanese', japaneseChains, japaneseFrom],
    ]) {
      const counts = stitchTurningChainCounts(def, tradition, 'row');
      assert.equal(foundationChainLength(n, def.turningChain, counts, tradition), chains, `${id}, ${tradition}: foundation chain`);
      assert.equal(firstChainFromHook(def.turningChain, counts, tradition), from, `${id}, ${tradition}: from the hook`);
    }
  }
});

test('the CYC row skip is 2 for sc and hdc, 3 for dc and 4 for tr, and the foundation chain is exactly that much longer than the stitch count (PQW-924)', () => {
  for (const [id, from] of [['sc', 3], ['hdc', 3], ['dc', 4], ['tr', 5]]) {
    const def = stitchById(id);
    const counts = stitchTurningChainCounts(def, 'cyc', 'row');
    assert.equal(counts, true, `${id}: counts as a stitch`);
    assert.equal(firstChainFromHook(def.turningChain, counts, 'cyc'), from, `${id}: from the hook`);
    for (const n of [10, 20, 39]) {
      const chains = n + skippedChains(def.turningChain, true);
      assert.equal(foundationChainLength(n, def.turningChain, true), chains, `${id}, ${n} sts: foundation chain`);
      assert.equal(foundationChainLength(n, def.turningChain, true, 'cyc'), chains, `${id}, ${n} sts, CYC: foundation chain`);
      // After the skip one stitch goes into every chain: exactly the requested count.
      assert.equal(chains - (firstChainFromHook(def.turningChain, counts, 'cyc') - 1), n, `${id}, ${n} sts: worked into the chain`);
    }
  }
});

test('in rounds the turning chain under CYC still follows the stitch library default', () => {
  for (const id of ['sc', 'hdc', 'dc', 'tr', 'dtr', 'inc-2sc', 'dc2tog', 'ch', 'sl-st', 'magic-ring']) {
    const def = stitchById(id);
    assert.equal(stitchTurningChainCounts(def, 'cyc', 'round'), def.turningChainCounts, id);
  }
});

test('with a repeat the foundation chain grows by the skip, and the row offers as many positions as it has stitches (PQW-924)', () => {
  const spec = { repeatWidth: 6, edgeStitches: 1, turningChainIncluded: false };
  const cyc = repeatCounts(spec, 3, 3, true);
  const japanese = repeatCounts(spec, 3, 3, true, 'japanese');
  assert.deepEqual(japanese, cyc);
  // 19 dc stitches: a skip of 3, 22 chains, and the row offers 19 positions to the next one.
  assert.deepEqual(cyc, { chains: 22, workedChains: 19, firstRowPositions: 19 });

  /*
   * For dc the skip is 3 even when the turning chain does not count, so the two
   * cases coincide. The difference shows on sc: there a counting turning chain
   * skips 2 chains and a non-counting one only one.
   */
  assert.deepEqual(repeatCounts(spec, 3, 3, false), cyc);
  const scCounting = repeatCounts(spec, 3, 1, true);
  const scNot = repeatCounts(spec, 3, 1, false);
  assert.equal(scCounting.chains, scNot.chains + 1);
  assert.equal(scCounting.firstRowPositions, scNot.firstRowPositions, 'the stitch count does not change either way');
  // With a non-counting turning chain the two traditions agree.
  assert.deepEqual(repeatCounts(spec, 3, 1, false, 'japanese'), scNot);
});

/* ---- The graph, the validator and the written pattern ---- */

describe('with the Japanese preset a rectangle counts by the Japanese convention', () => {
  for (const [id, n] of [['sc', 10], ['hdc', 15], ['dc', 16], ['tr', 12]]) {
    test(`${id}: validates clean with ${n} stitches per row, and the foundation chain and turning chain follow the Japanese rule`, () => {
      const pattern = rectangle(id, n, 4, 'japanese');
      assert.deepEqual(findings(pattern), []);
      assert.deepEqual(stitchCounts(pattern), [0, n, n, n, n]);

      const { turningChain } = stitchById(id);
      const graph = buildPieceGraph(pattern, pattern.pieces[0], testLibrary);
      assert.equal(graph.layers[1].turningChain.length, turningChain, 'the turning chain length comes from the stitch');
      assert.equal(graph.layers[0].stitches.length + turningChain, n + turningChain);

      const from = firstChainFromHook(turningChain, stitchTurningChainCounts(stitchById(id), 'japanese', 'row'), 'japanese');
      const text = textOf(pattern);
      assert.match(text, new RegExp(`1. sor – alapsor: ${n + turningChain} lsz\\.`));
      assert.match(text, new RegExp(`2\\. sor: hagyj ki ${from - 1} láncszemet, majd minden láncszembe 1 `));
    });
  }
});

test("the owner's scarf: 41 chains, turn, skip 2 chains, then 1 single crochet into every chain (PQW-924)", () => {
  const pattern = rectangle('sc', 39, 3, 'cyc');
  assert.deepEqual(findings(pattern), []);
  assert.equal(pattern.pieces[0].stitches.findIndex((node) => node.def !== 'ch'), 41, 'the foundation chain is 41 chains');
  assert.deepEqual(stitchCounts(pattern), [0, 39, 39, 39]);
  // The written stitch count includes the turning chain (PQW-940).
  assert.deepEqual(computeLayers(pattern, testLibrary).map((layer) => layer.writtenCount), [40, 40, 40, 40]);

  const text = textOf(pattern);
  assert.ok(text.includes('1. sor – alapsor: 41 lsz.'), text);
  // The owner's sentence (PQW-895): how many chains to skip, and that one single crochet goes into every chain.
  assert.ok(text.split('\n').includes('2. sor: hagyj ki 2 láncszemet, majd minden láncszembe 1 rp (40 szem). Fordítás.'), text);
  assert.ok(textOf(pattern, 'en-US').split('\n').includes('Row 2: skip 2 ch, sc in each ch across (40 sts). Turn.'));
  // British English uses its own verb and stitch name: a US sc is a UK dc.
  assert.ok(textOf(pattern, 'en-GB').split('\n').includes('Row 2: miss 2 ch, dc in each ch across (40 sts). Turn.'));
  for (const locale of ['hu', 'en-US', 'en-GB']) {
    const result = readPattern(textOf(pattern, locale), { library: testLibrary, locale, conventions: pattern.conventions });
    assert.equal(result.ok, true, `${locale}: ${JSON.stringify(result.error)}`);
    assert.deepEqual(canonicalPattern(result.pattern), canonicalPattern(pattern), locale);
  }
});

describe('the plain sentence for row 2 worked into the foundation chain (PQW-895)', () => {
  const firstRow = (pattern, locale) => textOf(pattern, locale).split('\n').find((line) => /^(2\. sor|Row 2):/.test(line));

  test("skipped chains follow the owner's table: sc 2, hdc 2, dc 3, tr 4 (PQW-924)", () => {
    const skips = [];
    for (const [id, n] of [['sc', 12], ['hdc', 12], ['dc', 12], ['tr', 12]]) {
      const pattern = rectangle(id, n, 2, 'cyc');
      assert.deepEqual(findings(pattern), [], id);
      const def = stitchById(id);
      const skip = firstChainFromHook(def.turningChain, stitchTurningChainCounts(def, 'cyc', 'row'), 'cyc') - 1;
      skips.push(skip);
      // The written stitch count includes the turning chain (PQW-940).
      const stated = n + 1;
      assert.equal(firstRow(pattern, 'hu'), `2. sor: hagyj ki ${skip} láncszemet, majd minden láncszembe 1 ${def.terms.hu.abbr} (${stated} szem). Fordítás.`);
      assert.equal(firstRow(pattern, 'en-US'), `Row 2: skip ${skip} ch, ${def.terms['en-US'].abbr} in each ch across (${stated} sts). Turn.`);
      assert.equal(firstRow(pattern, 'en-GB'), `Row 2: miss ${skip} ch, ${def.terms['en-GB'].abbr} in each ch across (${stated} sts). Turn.`);
      // The old sentence claiming the skipped chains count as one stitch is gone; the turning chain, however, is a stitch (PQW-940).
      assert.doesNotMatch(textOf(pattern), /kihagyott láncszemek/);
      assert.match(textOf(pattern), new RegExp(`3\\. sor: ${def.turningChain} lsz \\(1 ${def.terms.hu.abbr}-nek számít\\),`));
    }
    assert.deepEqual(skips, [2, 2, 3, 4]);
  });

  test('half double crochet skips 2 chains and double crochet skips 3 in the written sentence, and both read back in all three notations', () => {
    for (const [id, expected] of [
      ['hdc', '2. sor: hagyj ki 2 láncszemet, majd minden láncszembe 1 fp (16 szem). Fordítás.'],
      ['dc', '2. sor: hagyj ki 3 láncszemet, majd minden láncszembe 1 erp (16 szem). Fordítás.'],
    ]) {
      const pattern = rectangle(id, 15, 3, 'cyc');
      assert.equal(firstRow(pattern, 'hu'), expected);
      for (const locale of ['hu', 'en-US', 'en-GB']) {
        const result = readPattern(textOf(pattern, locale), { library: testLibrary, locale, conventions: pattern.conventions });
        assert.equal(result.ok, true, `${id} ${locale}: ${JSON.stringify(result.error)}`);
        assert.deepEqual(canonicalPattern(result.pattern), canonicalPattern(pattern), `${id} ${locale}`);
      }
    }
  });

  test('in Japanese tradition the non-counting single crochet turning chain skips only 1 chain, and it reads back', () => {
    const pattern = rectangle('sc', 15, 3, 'japanese');
    assert.equal(firstRow(pattern, 'hu'), '2. sor: hagyj ki 1 láncszemet, majd minden láncszembe 1 rp (15 szem). Fordítás.');
    for (const locale of ['hu', 'en-US', 'en-GB']) {
      const result = readPattern(textOf(pattern, locale), { library: testLibrary, locale, conventions: pattern.conventions });
      assert.equal(result.ok, true, `${locale}: ${JSON.stringify(result.error)}`);
      assert.deepEqual(canonicalPattern(result.pattern), canonicalPattern(pattern), locale);
    }
  });

  /*
   * A save from before PQW-895 rests on a concept that no longer exists: it counts
   * the chains at the start of the row as stitches. We do not silently reinterpret
   * such text (PQW-924, following the precedent of the PQW-911 edgings) — we reject
   * it with a reason the reader can act on.
   */
  test('text saved with the pre-PQW-895 sentence is rejected on load, naming both the reason and the remedy', () => {
    const pattern = rectangle('sc', 39, 3, 'cyc');
    for (const [locale, oldLine, expected] of [
      ['hu', '2. sor: a horogtól számított 3. láncszemtől kezdve (a kihagyott láncszemek 1 rp-nek számítanak) 38 rp (39 szem). Fordítás.', /korábbi szabály szerint készült/],
      ['en-US', 'Row 2: Starting in 3rd ch from hook (skipped ch count as 1 sc), 38 sc (39 sts). Turn.', /earlier rule/],
      ['en-GB', 'Row 2: Starting in 3rd ch from hook (skipped ch count as 1 dc), 38 dc (39 sts). Turn.', /earlier rule/],
    ]) {
      const text = textOf(pattern, locale);
      const old = text.replace(firstRow(pattern, locale), oldLine);
      assert.notEqual(old, text);
      const result = readPattern(old, { library: testLibrary, locale, conventions: pattern.conventions });
      assert.equal(result.ok, false, locale);
      assert.match(result.error.message, expected, locale);
      // It reports where the bad line is, too: the row after the foundation chain.
      assert.equal(result.error.line, 2 + text.split('\n').indexOf(firstRow(pattern, locale)) - 1);
      // The remedy is in there as well, not only the reason.
      assert.match(result.error.message, locale === 'hu' ? /Írd át a sort|generáld újra/ : /Rewrite the row|generate the pattern again/);
    }
  });

  test('the old sentence is rejected without its parenthetical too: that is not the current form either', () => {
    const pattern = rectangle('sc', 15, 3, 'cyc');
    const old = textOf(pattern).replace(firstRow(pattern, 'hu'), '2. sor: a horogtól számított 3. láncszemtől kezdve 14 rp (15 szem). Fordítás.');
    const result = readPattern(old, { library: testLibrary, locale: 'hu', conventions: pattern.conventions });
    assert.equal(result.ok, false);
    assert.match(result.error.message, /korábbi szabály szerint készült/);
  });
});

test('a CYC single crochet piece is a fault under Japanese tradition and the Japanese one is a fault under CYC, while hdc and dc pieces are clean in both', () => {
  const cyc = rectangle('sc', 15, 3, 'cyc');
  const japanese = rectangle('sc', 15, 3, 'japanese');
  assert.ok(rules(asTradition(cyc, 'japanese')).includes('foundation-chain'));
  // The Japanese piece was made with a skip of 1; CYC wants 2, so its foundation chain is a fault (PQW-924).
  assert.ok(rules(asTradition(japanese, 'cyc')).includes('foundation-chain'));
  for (const id of ['hdc', 'dc']) {
    assert.deepEqual(findings(asTradition(rectangle(id, 15, 3, 'cyc'), 'japanese')), [], `${id}: CYC read as Japanese`);
    assert.deepEqual(findings(asTradition(rectangle(id, 15, 3, 'japanese'), 'cyc')), [], `${id}: Japanese read as CYC`);
  }
});

test('the same single crochet piece under the CYC and the Japanese preset: the same chains, rows and stitches, only the counting differs', () => {
  const cyc = rectangle('sc', 15, 3, 'cyc');
  const japanese = rectangle('sc', 15, 3, 'japanese');
  for (const pattern of [cyc, japanese]) assert.deepEqual(findings(pattern), []);

  const shape = (pattern) =>
    computeLayers(pattern, testLibrary).map(({ shape, side, stitchCount }) => ({ shape, side, stitchCount }));
  assert.deepEqual(shape(japanese), shape(cyc));
  // In Japanese the sc turning chain does not count, so the skip is 1 and the foundation chain is one shorter (PQW-924).
  assert.equal(japanese.pieces[0].stitches.length, cyc.pieces[0].stitches.length - 1, 'the Japanese foundation chain is one chain shorter');

  // The text differs only at the start of the rows: where row 1 begins, and whether the turning chain counts.
  const [a, b] = [textOf(cyc).split('\n'), textOf(japanese).split('\n')];
  assert.equal(a.length, b.length);
  const differing = a.map((line, i) => [line, b[i]]).filter(([x, y]) => x !== y);
  assert.ok(differing.length > 0);
  for (const [x, y] of differing) {
    // The foundation chain length differs too: for sc the skip is 2 under CYC and 1 under Japanese (PQW-924).
    assert.match(x, /^\d+(–\d+)?\. sor(: | – alapsor: )/);
    assert.equal(x.split(':')[0], y.split(':')[0]);
    /*
      * The stitch count differs too: the turning chain is the first stitch of the
      * row (PQW-940), and in Japanese the sc one does not count while under CYC it
      * does — so CYC reads one higher. The structure (how many stitches are worked
      * into the row) is the same either way.
      */
    if (!x.includes(' – alapsor: ')) {
      assert.equal(Number(x.match(/\((\d+) szem\)/)[1]), Number(y.match(/\((\d+) szem\)/)[1]) + 1);
    }
  }
  // The skip is 2 under CYC and 1 under Japanese, so the foundation chain is 17 and 16 chains (PQW-924).
  assert.ok(a.includes('1. sor – alapsor: 17 lsz.') && b.includes('1. sor – alapsor: 16 lsz.'));
  assert.match(textOf(cyc), /2\. sor: hagyj ki 2 láncszemet, majd minden láncszembe 1 rp \(16 szem\)/);
  assert.match(textOf(cyc), /1 lsz \(1 rp-nek számít\)/);
  assert.match(textOf(japanese), /2\. sor: hagyj ki 1 láncszemet, majd minden láncszembe 1 rp \(15 szem\)/);
  assert.match(textOf(japanese), /1 lsz \(fordulólánc\)/);
});

test('a half double crochet piece is identical under the CYC and the Japanese preset: same graph, same text', () => {
  const cyc = rectangle('hdc', 15, 3, 'cyc');
  const japanese = rectangle('hdc', 15, 3, 'japanese');
  for (const pattern of [cyc, japanese]) assert.deepEqual(findings(pattern), []);
  assert.deepEqual(japanese.pieces, cyc.pieces);
  assert.equal(textOf(japanese), textOf(cyc));
  assert.ok(textOf(japanese).split('\n').includes('1. sor – alapsor: 17 lsz.'));
  // In Japanese the hdc turning chain counts, so the skip is 2 there as well (PQW-924).
  assert.match(textOf(japanese), /2\. sor: hagyj ki 2 láncszemet, majd minden láncszembe 1 fp \(16 szem\)/);
  assert.match(textOf(japanese), /2 lsz \(1 fp-nek számít\)/);
});

test('a double crochet piece has an N + T foundation chain under both CYC and Japanese, with the same stitch count', () => {
  const cyc = rectangle('dc', 16, 2, 'cyc');
  const japanese = rectangle('dc', 16, 2, 'japanese');
  assert.deepEqual(stitchCounts(japanese), stitchCounts(cyc));
  assert.match(textOf(cyc), /1. sor – alapsor: 19 lsz\./);
  assert.match(textOf(japanese), /1. sor – alapsor: 19 lsz\./);
});

test('reading the Japanese written pattern back gives the same graph in all three notations', () => {
  for (const id of ['sc', 'hdc', 'dc']) {
    const pattern = rectangle(id, 8, 3, 'japanese');
    for (const locale of ['hu', 'en-US', 'en-GB']) {
      const result = readPattern(textOf(pattern, locale), { library: testLibrary, locale, conventions: pattern.conventions });
      assert.equal(result.ok, true, `${id}, ${locale}: ${JSON.stringify(result.error)}`);
      assert.deepEqual(canonicalPattern(result.pattern), canonicalPattern(pattern), `${id}, ${locale}`);
    }
  }
});

/* ---- The editor and saving ---- */

describe('the editor with the Japanese preset', () => {
  const foundation = (count) => ok(work(ok(setTradition(emptyPattern(), 'japanese')), { def: 'ch', count }, 0));

  test('the guided cursor puts hdc in the 3rd chain, dc in the 4th and sc in the 2nd (PQW-924)', () => {
    // In Japanese the sc turning chain does not count, so the skip there is 1.
    const pattern = foundation(12);
    assert.equal(defaultCursor(pattern, contextOf(pattern), 'hdc'), 2);
    assert.equal(defaultCursor(pattern, contextOf(pattern), 'dc'), 3);
    assert.equal(defaultCursor(pattern, contextOf(pattern), 'sc'), 1);
  });

  test('fill row turns 12 chains into a clean half double crochet rectangle of 10 stitches per row', () => {
    let pattern = foundation(12);
    for (let row = 1; row <= 4; row += 1) {
      if (row > 1) pattern = ok(endRow(pattern));
      pattern = ok(fillRow(pattern, { def: 'hdc', count: 1 }));
    }
    assert.deepEqual(validatePattern(pattern, libraryFor(pattern)), []);
    assert.deepEqual(
      computeLayers(pattern, libraryFor(pattern)).map((layer) => layer.stitchCount),
      [0, 10, 10, 10, 10],
    );
  });

  test('the tradition stays in the pattern: it saves, it loads back, and CYC is never written out', () => {
    const japanese = ok(setTradition(emptyPattern(), 'japanese'));
    assert.equal(traditionOf(japanese.conventions), 'japanese');
    assert.equal(setTradition(japanese, 'japanese').ok, false);

    const loaded = loadPattern(savePattern(japanese));
    assert.equal(loaded.ok, true);
    assert.equal(loaded.pattern.conventions.tradition, 'japanese');
    assert.equal(savePattern(loaded.pattern), savePattern(japanese));

    const back = ok(setTradition(japanese, 'cyc'));
    assert.equal('tradition' in back.conventions, false);
    assert.equal(savePattern(back), savePattern(emptyPattern()));

    const raw = JSON.parse(savePattern(japanese));
    raw.conventions.tradition = 'jis';
    const bad = loadPattern(JSON.stringify(raw));
    assert.equal(bad.ok, false);
    assert.equal(bad.error.path, '$.conventions.tradition');
  });
});


/*
 * How many chains are skipped when row 1 starts (PQW-924).
 *
 * The owner's table governs, and it overrides the "turning chain + 2" rule of
 * PQW-891: from half double crochet up we skip one chain fewer. The length of the
 * turning chain does not change, only the skip.
 */
test('skipped chains: sc 2, hdc 2, dc 3, tr 4, dtr 5 (PQW-924)', () => {
  for (const [id, skipped] of [
    ['sc', 2],
    ['hdc', 2],
    ['dc', 3],
    ['tr', 4],
    ['dtr', 5],
  ]) {
    const def = stitchById(id);
    const counts = stitchTurningChainCounts(def, 'cyc', 'row');
    // The first stitch goes into the chain after the skipped ones.
    assert.equal(firstChainFromHook(def.turningChain, counts, 'cyc') - 1, skipped, `${id}: skipped chains`);
  }
});
