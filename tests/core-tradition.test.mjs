/*
 * A fordulólánc számolása (PQW-876, PQW-891): sorban CYC szerint minden szem
 * fordulólánca számít szemnek, japánban a félpálcától felfelé; a számító
 * fordulólánc egy alapláncszemen áll, ezért az 1. sor a horogtól számított
 * T + 2. láncszemtől kezd. Körben a kezdőlánc a szemkönyvtár alapértelmezését
 * követi. A gráf, az ellenőrző, a szerkesztő, az írott minta és a visszaolvasás
 * is ezzel számol.
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
  const counts = stitchTurningChainCounts(def, tradition, 'row');
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
const asTradition = (pattern, tradition) => ({ ...pattern, conventions: withTradition(pattern.conventions, tradition) });

function ok(result) {
  assert.ok(result.ok, result.reason);
  return result.pattern;
}

/* ---- A szabály ---- */

// prettier-ignore
const STANDING = [
  // szem   fordulólánc  CYC sor: számít  CYC kör: számít  japán: számít
  ['sc',    1,           true,            false,           false],
  ['hdc',   2,           true,            false,           true],
  ['dc',    3,           true,            true,            true],
  ['tr',    4,           true,            true,            true],
  ['dtr',   5,           true,            true,            true],
];

test('sorban CYC szerint minden szem fordulólánca számít szemnek, japánban a félpálcától felfelé; körben CYC szerint az egyráhajtásos pálcától (01 §3.3, PQW-891)', () => {
  for (const [id, chains, cycRow, cycRound, japanese] of STANDING) {
    const def = stitchById(id);
    assert.equal(def.turningChain, chains, id);
    assert.equal(stitchTurningChainCounts(def, 'cyc', 'row'), cycRow, `${id}, CYC, sor`);
    assert.equal(stitchTurningChainCounts(def, 'cyc', 'round'), cycRound, `${id}, CYC, kör`);
    assert.equal(stitchTurningChainCounts(def, 'japanese', 'row'), japanese, `${id}, japán, sor`);
    assert.equal(stitchTurningChainCounts(def, 'japanese', 'round'), japanese, `${id}, japán, kör`);
  }
  // Az összetett szem a részszemét követi; a láncszem, a kúszószem és a varázskör sosem számít.
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
  // szem   N    CYC: lsz  horogtól   japán: lsz  horogtól
  ['sc',    20,  21,       3,         21,         2],
  ['hdc',   20,  22,       4,         22,         4],
  ['dc',    20,  23,       5,         23,         5],
  ['tr',    20,  24,       6,         24,         6],
  ['dtr',   20,  25,       7,         25,         7],
];

test('láncalap N szemhez sorban: mindkét hagyományban N + T; a rövidpálca CYC-ben a 3., japánban a 2., a félpálca a 4., a pálca az 5., a három ráhajtásos a 7. láncszemtől (01 §2.2, §8.3, PQW-891)', () => {
  for (const [id, n, cycChains, cycFrom, japaneseChains, japaneseFrom] of FOUNDATION) {
    const def = stitchById(id);
    for (const [tradition, chains, from] of [
      ['cyc', cycChains, cycFrom],
      ['japanese', japaneseChains, japaneseFrom],
    ]) {
      const counts = stitchTurningChainCounts(def, tradition, 'row');
      assert.equal(foundationChainLength(n, def.turningChain, counts, tradition), chains, `${id}, ${tradition}: láncalap`);
      assert.equal(firstChainFromHook(def.turningChain, counts, tradition), from, `${id}, ${tradition}: horogtól`);
    }
  }
});

test('CYC sorban a fordulólánc mindig számít: az 1. sor a rövidpálcánál a 3., félpálcánál a 4., pálcánál az 5., kétráhajtásos pálcánál a 6. láncszemtől, a láncalap N + T (PQW-891)', () => {
  for (const [id, from] of [['sc', 3], ['hdc', 4], ['dc', 5], ['tr', 6]]) {
    const def = stitchById(id);
    const counts = stitchTurningChainCounts(def, 'cyc', 'row');
    assert.equal(counts, true, `${id}: számít`);
    assert.equal(firstChainFromHook(def.turningChain, counts, 'cyc'), from, `${id}: horogtól`);
    for (const n of [10, 20, 39]) {
      assert.equal(foundationChainLength(n, def.turningChain, true), n + def.turningChain, `${id}, ${n} szem: láncalap`);
      assert.equal(foundationChainLength(n, def.turningChain, true, 'cyc'), n + def.turningChain, `${id}, ${n} szem, CYC: láncalap`);
    }
  }
});

test('körben a kezdőlánc CYC szerint változatlanul a szemkönyvtár alapértelmezését követi', () => {
  for (const id of ['sc', 'hdc', 'dc', 'tr', 'dtr', 'inc-2sc', 'dc2tog', 'ch', 'sl-st', 'magic-ring']) {
    const def = stitchById(id);
    assert.equal(stitchTurningChainCounts(def, 'cyc', 'round'), def.turningChainCounts, id);
  }
});

test('ismétlésnél a számító fordulólánc mindkét hagyományban alapláncszemen áll: a láncalap és az 1. sor pozíciói eggyel többek', () => {
  const spec = { repeatWidth: 6, edgeStitches: 1, turningChainIncluded: false };
  const cyc = repeatCounts(spec, 3, 3, true);
  const japanese = repeatCounts(spec, 3, 3, true, 'japanese');
  assert.deepEqual(japanese, cyc);
  assert.deepEqual(cyc, { chains: 23, workedChains: 19, firstRowPositions: 20 });
  const notCounting = repeatCounts(spec, 3, 3, false);
  assert.equal(cyc.chains, notCounting.chains + 1);
  assert.equal(cyc.workedChains, notCounting.workedChains);
  assert.equal(cyc.firstRowPositions, notCounting.firstRowPositions + 1);
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

      const from = firstChainFromHook(turningChain, stitchTurningChainCounts(stitchById(id), 'japanese', 'row'), 'japanese');
      const text = textOf(pattern);
      assert.match(text, new RegExp(`Láncalap: ${n + turningChain} lsz\\.`));
      assert.match(text, new RegExp(`1\\. sor: hagyj ki ${from - 1} láncszemet, majd minden láncszembe 1 `));
    });
  }
});

test('a tulajdonos sála: 40 láncszem, fordulás, 2 láncszem kihagyása, utána minden láncszembe 1 rövidpálca (PQW-891)', () => {
  const pattern = rectangle('sc', 39, 3, 'cyc');
  assert.deepEqual(findings(pattern), []);
  assert.equal(pattern.pieces[0].stitches.findIndex((node) => node.def !== 'ch'), 40, 'a láncalap 40 láncszem');
  assert.deepEqual(stitchCounts(pattern), [0, 39, 39, 39]);

  const text = textOf(pattern);
  assert.ok(text.includes('Láncalap: 40 lsz.'), text);
  // A tulajdonos mondata (PQW-895): a kihagyott láncszemek száma, és hogy minden láncszembe 1 rp megy.
  assert.ok(text.split('\n').includes('1. sor: hagyj ki 2 láncszemet, majd minden láncszembe 1 rp (39 szem). Fordítás.'), text);
  assert.ok(textOf(pattern, 'en-US').split('\n').includes('Row 1: skip 2 ch, sc in each ch across (39 sts). Turn.'));
  // Britül a „miss” és a brit név: az amerikai sc a brit dc.
  assert.ok(textOf(pattern, 'en-GB').split('\n').includes('Row 1: miss 2 ch, dc in each ch across (39 sts). Turn.'));
  for (const locale of ['hu', 'en-US', 'en-GB']) {
    const result = readPattern(textOf(pattern, locale), { library: testLibrary, locale, conventions: pattern.conventions });
    assert.equal(result.ok, true, `${locale}: ${JSON.stringify(result.error)}`);
    assert.deepEqual(canonicalPattern(result.pattern), canonicalPattern(pattern), locale);
  }
});

describe('a láncalapra horgolt 1. sor egyszerű mondata (PQW-895)', () => {
  const firstRow = (pattern, locale) => textOf(pattern, locale).split('\n').find((line) => /^(1\. sor|Row 1):/.test(line));

  test('a kihagyott láncszemek száma a horogtól számított első láncszem mínusz 1: rp 2, fp 3, erp 4, krp 5', () => {
    const skips = [];
    for (const [id, n] of [['sc', 12], ['hdc', 12], ['dc', 12], ['tr', 12]]) {
      const pattern = rectangle(id, n, 2, 'cyc');
      assert.deepEqual(findings(pattern), [], id);
      const def = stitchById(id);
      const skip = firstChainFromHook(def.turningChain, stitchTurningChainCounts(def, 'cyc', 'row'), 'cyc') - 1;
      skips.push(skip);
      assert.equal(firstRow(pattern, 'hu'), `1. sor: hagyj ki ${skip} láncszemet, majd minden láncszembe 1 ${def.terms.hu.abbr} (${n} szem). Fordítás.`);
      assert.equal(firstRow(pattern, 'en-US'), `Row 1: skip ${skip} ch, ${def.terms['en-US'].abbr} in each ch across (${n} sts). Turn.`);
      assert.equal(firstRow(pattern, 'en-GB'), `Row 1: miss ${skip} ch, ${def.terms['en-GB'].abbr} in each ch across (${n} sts). Turn.`);
      // A számolásról nincs megjegyzés az 1. sorban; a 2. sor fordulólánca megmarad.
      assert.doesNotMatch(textOf(pattern), /kihagyott láncszemek|számítanak/);
      assert.match(textOf(pattern), new RegExp(`2\\. sor: ${def.turningChain} lsz \\(1 ${def.terms.hu.abbr}-[a-z]+ számít\\)`));
    }
    assert.deepEqual(skips, [2, 3, 4, 5]);
  });

  test('félpálca és pálca: „hagyj ki 3 láncszemet” és „hagyj ki 4 láncszemet”, és mindhárom jelöléssel visszaolvasható', () => {
    for (const [id, expected] of [
      ['hdc', '1. sor: hagyj ki 3 láncszemet, majd minden láncszembe 1 fp (15 szem). Fordítás.'],
      ['dc', '1. sor: hagyj ki 4 láncszemet, majd minden láncszembe 1 erp (15 szem). Fordítás.'],
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

  test('japán hagyományban a nem számító rövidpálcás fordulólánc: „hagyj ki 1 láncszemet”, és visszaolvasható', () => {
    const pattern = rectangle('sc', 15, 3, 'japanese');
    assert.equal(firstRow(pattern, 'hu'), '1. sor: hagyj ki 1 láncszemet, majd minden láncszembe 1 rp (15 szem). Fordítás.');
    for (const locale of ['hu', 'en-US', 'en-GB']) {
      const result = readPattern(textOf(pattern, locale), { library: testLibrary, locale, conventions: pattern.conventions });
      assert.equal(result.ok, true, `${locale}: ${JSON.stringify(result.error)}`);
      assert.deepEqual(canonicalPattern(result.pattern), canonicalPattern(pattern), locale);
    }
  });

  test('a PQW-895 előtti mondattal mentett sál szövege is visszaolvasható, ugyanarra a gráfra', () => {
    const pattern = rectangle('sc', 39, 3, 'cyc');
    for (const [locale, oldLine] of [
      ['hu', '1. sor: a horogtól számított 3. láncszemtől kezdve (a kihagyott láncszemek 1 rp-nek számítanak) 38 rp (39 szem). Fordítás.'],
      ['en-US', 'Row 1: Starting in 3rd ch from hook (skipped ch count as 1 sc), 38 sc (39 sts). Turn.'],
      ['en-GB', 'Row 1: Starting in 3rd ch from hook (skipped ch count as 1 dc), 38 dc (39 sts). Turn.'],
    ]) {
      const text = textOf(pattern, locale);
      const old = text.replace(firstRow(pattern, locale), oldLine);
      assert.notEqual(old, text);
      const result = readPattern(old, { library: testLibrary, locale, conventions: pattern.conventions });
      assert.equal(result.ok, true, `${locale}: ${JSON.stringify(result.error)}`);
      assert.deepEqual(canonicalPattern(result.pattern), canonicalPattern(pattern), locale);
    }
  });

  test('a régi mondatban a beállítástól eltérő számolás továbbra is hiba', () => {
    const pattern = rectangle('sc', 15, 3, 'cyc');
    const old = textOf(pattern).replace(firstRow(pattern, 'hu'), '1. sor: a horogtól számított 3. láncszemtől kezdve 14 rp (15 szem). Fordítás.');
    const result = readPattern(old, { library: testLibrary, locale: 'hu', conventions: pattern.conventions });
    assert.equal(result.ok, false);
    assert.match(result.error.message, /fordulóláncának számolása eltér/);
  });
});

test('a CYC szerinti rövidpálcás darab japán hagyományban hiba, a japán CYC-ben szintén; a félpálcás és a pálcás darab mindkettőben hibátlan', () => {
  const cyc = rectangle('sc', 15, 3, 'cyc');
  const japanese = rectangle('sc', 15, 3, 'japanese');
  assert.ok(rules(asTradition(cyc, 'japanese')).includes('foundation-chain'));
  assert.ok(rules(asTradition(japanese, 'cyc')).includes('turning-chain-placement'));
  for (const id of ['hdc', 'dc']) {
    assert.deepEqual(findings(asTradition(rectangle(id, 15, 3, 'cyc'), 'japanese')), [], `${id}: CYC japánként`);
    assert.deepEqual(findings(asTradition(rectangle(id, 15, 3, 'japanese'), 'cyc')), [], `${id}: japán CYC-ként`);
  }
});

test('ugyanaz a rövidpálcás darab CYC és japán előbeállítással: ugyanannyi láncszem, sor és szem, csak a számolás módja tér el', () => {
  const cyc = rectangle('sc', 15, 3, 'cyc');
  const japanese = rectangle('sc', 15, 3, 'japanese');
  for (const pattern of [cyc, japanese]) assert.deepEqual(findings(pattern), []);

  const shape = (pattern) =>
    computeLayers(pattern, testLibrary).map(({ shape, side, stitchCount, positionCount }) => ({ shape, side, stitchCount, positionCount }));
  assert.deepEqual(shape(japanese), shape(cyc));
  assert.equal(japanese.pieces[0].stitches.length, cyc.pieces[0].stitches.length + 3, 'CYC-ben soronként egy rövidpálcát a fordulólánc helyettesít');

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
  assert.ok(a.includes('Láncalap: 16 lsz.') && b.includes('Láncalap: 16 lsz.'));
  assert.match(textOf(cyc), /1\. sor: hagyj ki 2 láncszemet, majd minden láncszembe 1 rp \(15 szem\)/);
  assert.match(textOf(cyc), /1 lsz \(1 rp-nek számít\)/);
  assert.match(textOf(japanese), /1\. sor: hagyj ki 1 láncszemet, majd minden láncszembe 1 rp \(15 szem\)/);
  assert.match(textOf(japanese), /1 lsz \(nem számít szemnek\)/);
});

test('a félpálcás darab CYC és japán előbeállítással azonos: ugyanaz a gráf és ugyanaz a szöveg', () => {
  const cyc = rectangle('hdc', 15, 3, 'cyc');
  const japanese = rectangle('hdc', 15, 3, 'japanese');
  for (const pattern of [cyc, japanese]) assert.deepEqual(findings(pattern), []);
  assert.deepEqual(japanese.pieces, cyc.pieces);
  assert.equal(textOf(japanese), textOf(cyc));
  assert.ok(textOf(japanese).split('\n').includes('Láncalap: 17 lsz.'));
  assert.match(textOf(japanese), /1\. sor: hagyj ki 3 láncszemet, majd minden láncszembe 1 fp \(15 szem\)/);
  assert.match(textOf(japanese), /2 lsz \(1 fp-nek számít\)/);
});

test('a pálcás darab láncalapja CYC-ben és japánban is N + T, a szemszám ugyanaz', () => {
  const cyc = rectangle('dc', 16, 2, 'cyc');
  const japanese = rectangle('dc', 16, 2, 'japanese');
  assert.deepEqual(stitchCounts(japanese), stitchCounts(cyc));
  assert.match(textOf(cyc), /Láncalap: 19 lsz\./);
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
