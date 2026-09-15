/*
 * A japán számolási hagyomány (PQW-876): a fordulólánc a félpálcától felfelé
 * számít szemnek, a számító fordulólánc egy alapláncszemen áll, ezért az 1. sor
 * egy láncszemmel később kezd. A gráf, az ellenőrző, a szerkesztő, az írott
 * minta és a visszaolvasás is ezzel számol.
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
import { firstChainFromHook, stitchTurningChainCounts, traditionOf, withTradition } from '../src/core/tradition.ts';
import { validatePattern } from '../src/core/validate.ts';
import { PieceBuilder, patternOf } from './fixtures/builder.ts';
import { testLibrary } from './fixtures/library.ts';

/**
 * Téglalap a hagyomány szabályai szerint: láncalap, az 1. sor a szabály szerinti
 * láncszemtől, utána soronként fordulólánc; számító fordulóláncnál a sor első
 * pozíciója kimarad, az utolsó szem az előző fordulólánc tetejébe megy.
 */
function rectangle(id, stitches, rows, tradition) {
  const def = stitchById(id);
  const chains = def.turningChain;
  const counts = stitchTurningChainCounts(def, tradition);
  const length = foundationChainLength(stitches, chains, counts, tradition);
  const b = new PieceBuilder('p1', 'Téglalap');
  const foundation = b.chain(length);
  const fromHook = (k) => foundation[length - k];

  let row = [];
  for (let k = firstChainFromHook(chains, counts, tradition); k <= length; k += 1) row.push(b.stitch(id, fromHook(k)));
  b.event('turn', stitches);
  let top = fromHook(1);
  for (let r = 2; r <= rows; r += 1) {
    const turning = b.chain(chains);
    const below = [...row].reverse();
    row = (counts ? [...below.slice(1), top] : below).map((target) => b.stitch(id, target));
    top = turning[chains - 1];
    b.event(r === rows ? 'fasten-off' : 'turn', stitches);
  }
  return patternOf(`${id} téglalap`, [b.build()], tradition === 'japanese' ? { tradition } : {});
}

const textOf = (pattern, locale = 'hu') => formatWrittenPattern(writePattern(pattern, testLibrary, locale));
const findings = (pattern) => validatePattern(pattern, testLibrary);
const rules = (pattern) => [...new Set(findings(pattern).map((finding) => finding.rule))];
const stitchCounts = (pattern) => computeLayers(pattern, testLibrary).map((layer) => layer.stitchCount);

function ok(result) {
  assert.ok(result.ok, result.reason);
  return result.pattern;
}

/* ---- A szabály ---- */

// prettier-ignore
const STANDING = [
  // szem   fordulólánc  CYC: számít  japán: számít
  ['sc',    1,           false,       false],
  ['hdc',   2,           false,       true],
  ['dc',    3,           true,        true],
  ['tr',    4,           true,        true],
  ['dtr',   5,           true,        true],
];

test('japánban a fordulólánc a félpálcától felfelé számít szemnek, CYC szerint az egyráhajtásos pálcától (01 §3.3)', () => {
  for (const [id, chains, cyc, japanese] of STANDING) {
    const def = stitchById(id);
    assert.equal(def.turningChain, chains, id);
    assert.equal(stitchTurningChainCounts(def, 'cyc'), cyc, `${id}, CYC`);
    assert.equal(stitchTurningChainCounts(def, 'japanese'), japanese, `${id}, japán`);
  }
  // Az összetett szem a részszemét követi; a láncszem, a kúszószem és a varázskör sosem számít.
  assert.equal(stitchTurningChainCounts(stitchById('inc-2sc'), 'japanese'), false);
  assert.equal(stitchTurningChainCounts(testLibrary.get('inc-2hdc'), 'japanese'), true);
  assert.equal(stitchTurningChainCounts(stitchById('dc2tog'), 'japanese'), true);
  for (const id of ['ch', 'sl-st', 'magic-ring']) assert.equal(stitchTurningChainCounts(stitchById(id), 'japanese'), false, id);
});

// prettier-ignore
const FOUNDATION = [
  // szem   N    CYC: lsz  horogtól   japán: lsz  horogtól
  ['sc',    20,  21,       2,         21,         2],
  ['hdc',   20,  22,       3,         22,         4],
  ['dc',    20,  22,       4,         23,         5],
  ['tr',    20,  23,       5,         24,         6],
  ['dtr',   20,  24,       6,         25,         7],
];

test('láncalap N szemhez: japánban N + T, a félpálca a 4., a pálca az 5., a három ráhajtásos a 7. láncszemtől (01 §2.2, §8.3)', () => {
  for (const [id, n, cycChains, cycFrom, japaneseChains, japaneseFrom] of FOUNDATION) {
    const def = stitchById(id);
    for (const [tradition, chains, from] of [
      ['cyc', cycChains, cycFrom],
      ['japanese', japaneseChains, japaneseFrom],
    ]) {
      const counts = stitchTurningChainCounts(def, tradition);
      assert.equal(foundationChainLength(n, def.turningChain, counts, tradition), chains, `${id}, ${tradition}: láncalap`);
      assert.equal(firstChainFromHook(def.turningChain, counts, tradition), from, `${id}, ${tradition}: horogtól`);
    }
  }
});

test('ismétlésnél a japán láncalap az alapláncszemmel hosszabb, az 1. sor pozíciói nem változnak', () => {
  const spec = { repeatWidth: 6, edgeStitches: 1, turningChainIncluded: false };
  const cyc = repeatCounts(spec, 3, 3, true);
  const japanese = repeatCounts(spec, 3, 3, true, 'japanese');
  assert.equal(japanese.chains, cyc.chains + 1);
  assert.equal(japanese.firstRowPositions, cyc.firstRowPositions);
  // Nem számító fordulóláncnál a két hagyomány egyezik.
  assert.deepEqual(repeatCounts(spec, 3, 1, false, 'japanese'), repeatCounts(spec, 3, 1, false));
});

/* ---- A gráf, az ellenőrző és az írott minta ---- */

describe('japán előbeállítással a téglalap a japán konvenció szerint számol', () => {
  for (const [id, n] of [['sc', 10], ['hdc', 15], ['dc', 16], ['tr', 12]]) {
    test(`${id}: hibátlan, soronként ${n} szem, a láncalap és a fordulólánc a japán szabály szerint`, () => {
      const pattern = rectangle(id, n, 4, 'japanese');
      assert.deepEqual(findings(pattern), []);
      assert.deepEqual(stitchCounts(pattern), [0, n, n, n, n]);

      const { turningChain } = stitchById(id);
      const graph = buildPieceGraph(pattern, pattern.pieces[0], testLibrary);
      assert.equal(graph.layers[1].turningChain.length, turningChain, 'az alapláncszem nem a fordulólánc része');
      assert.equal(graph.layers[0].stitches.length + turningChain, n + turningChain);

      const from = firstChainFromHook(turningChain, stitchTurningChainCounts(stitchById(id), 'japanese'), 'japanese');
      const text = textOf(pattern);
      assert.match(text, new RegExp(`Láncalap: ${n + turningChain} lsz\\.`));
      assert.match(text, new RegExp(`a horogtól számított ${from}\\. láncszemtől kezdve`));
    });
  }
});

test('a CYC szerinti félpálcás láncalap japán hagyományban hiba, a japán CYC-ben szintén', () => {
  const cyc = rectangle('hdc', 15, 3, 'cyc');
  const japanese = rectangle('hdc', 15, 3, 'japanese');
  assert.ok(rules({ ...cyc, conventions: withTradition(cyc.conventions, 'japanese') }).includes('foundation-chain'));
  assert.ok(rules({ ...japanese, conventions: withTradition(japanese.conventions, 'cyc') }).includes('foundation-chain'));
});

test('ugyanaz a félpálcás darab CYC és japán előbeállítással: ugyanannyi láncszem, sor és szem, csak a számolás módja tér el', () => {
  const cyc = rectangle('hdc', 15, 3, 'cyc');
  const japanese = rectangle('hdc', 15, 3, 'japanese');
  for (const pattern of [cyc, japanese]) assert.deepEqual(findings(pattern), []);

  const shape = (pattern) =>
    computeLayers(pattern, testLibrary).map(({ shape, side, stitchCount, positionCount }) => ({ shape, side, stitchCount, positionCount }));
  assert.deepEqual(shape(japanese), shape(cyc));
  assert.equal(japanese.pieces[0].stitches.length, cyc.pieces[0].stitches.length - 3, 'soronként egy félpálcát a fordulólánc helyettesít');

  // A szöveg csak a sorok elején tér el: honnan indul az 1. sor, és számít-e a fordulólánc.
  const [a, b] = [textOf(cyc).split('\n'), textOf(japanese).split('\n')];
  assert.equal(a.length, b.length);
  const differing = a.map((line, i) => [line, b[i]]).filter(([x, y]) => x !== y);
  assert.ok(differing.length > 0);
  for (const [x, y] of differing) {
    assert.match(x, /^\d+(–\d+)?\. sor: /);
    assert.equal(x.split(':')[0], y.split(':')[0]);
    assert.equal(x.match(/\(\d+ szem\)/)[0], y.match(/\(\d+ szem\)/)[0]);
  }
  assert.ok(a.includes('Láncalap: 17 lsz.') && b.includes('Láncalap: 17 lsz.'));
  assert.match(textOf(cyc), /3\. láncszemtől kezdve 15 fp/);
  assert.match(textOf(japanese), /4\. láncszemtől kezdve \(a kihagyott láncszemek 1 fp-nek számítanak\) 14 fp/);
  assert.match(textOf(japanese), /2 lsz \(1 fp-nek számít\)/);
});

test('a pálcás darab japánban eggyel hosszabb láncalappal indul, a szemszám ugyanaz', () => {
  const cyc = rectangle('dc', 16, 2, 'cyc');
  const japanese = rectangle('dc', 16, 2, 'japanese');
  assert.deepEqual(stitchCounts(japanese), stitchCounts(cyc));
  assert.match(textOf(cyc), /Láncalap: 18 lsz\./);
  assert.match(textOf(japanese), /Láncalap: 19 lsz\./);
});

test('a japán írott minta visszaolvasva ugyanazt a gráfot adja, mindhárom jelöléssel', () => {
  for (const id of ['sc', 'hdc', 'dc']) {
    const pattern = rectangle(id, 8, 3, 'japanese');
    for (const locale of ['hu', 'en-US', 'en-GB']) {
      const result = readPattern(textOf(pattern, locale), { library: testLibrary, locale, conventions: pattern.conventions });
      assert.equal(result.ok, true, `${id}, ${locale}: ${JSON.stringify(result.error)}`);
      assert.deepEqual(canonicalPattern(result.pattern), canonicalPattern(pattern), `${id}, ${locale}`);
    }
  }
});

/* ---- A szerkesztő és a mentés ---- */

describe('a szerkesztő japán előbeállítással', () => {
  const foundation = (count) => ok(work(ok(setTradition(emptyPattern(), 'japanese')), { def: 'ch', count }, 0));

  test('a vezetett kurzor a félpálcát a 4., a pálcát az 5. láncszembe teszi, a rövidpálcát a 2.-ba', () => {
    const pattern = foundation(12);
    assert.equal(defaultCursor(pattern, contextOf(pattern), 'hdc'), 3);
    assert.equal(defaultCursor(pattern, contextOf(pattern), 'dc'), 4);
    assert.equal(defaultCursor(pattern, contextOf(pattern), 'sc'), 1);
  });

  test('sorkitöltéssel: 12 láncszemből hibátlan félpálcás téglalap, soronként 10 szem', () => {
    let pattern = foundation(12);
    for (let row = 1; row <= 4; row += 1) {
      if (row > 1) pattern = ok(endRow(pattern, 'hdc'));
      pattern = ok(fillRow(pattern, { def: 'hdc', count: 1 }));
    }
    assert.deepEqual(validatePattern(pattern, libraryFor(pattern)), []);
    assert.deepEqual(
      computeLayers(pattern, libraryFor(pattern)).map((layer) => layer.stitchCount),
      [0, 10, 10, 10, 10],
    );
  });

  test('a hagyomány a mintában marad: menthető, visszatölthető, a CYC nem íródik ki', () => {
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
