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
import { firstChainFromHook, skippedChains, stitchTurningChainCounts, traditionOf, withTradition } from '../src/core/tradition.ts';
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
  // A kiírt szemszám a fordulólánccal együtt értendő, ha az szem (PQW-940).
  const stated = stitches + (counts ? 1 : 0);
  const b = new PieceBuilder('p1', 'Téglalap');
  const foundation = b.chain(length);
  const fromHook = (k) => foundation[length - k];

  let row = [];
  for (let k = firstChainFromHook(chains, counts, tradition); k <= length; k += 1) row.push(b.stitch(id, fromHook(k)));
  b.event('turn', stated);
  for (let r = 2; r <= rows; r += 1) {
    b.chain(chains);
    // A fordulólánc a sor első szeme (PQW-940), de nem célpont: az előző sor minden szemébe megy egy szem.
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
  // A kihagyott láncszemek száma a tulajdonos táblázata szerint (PQW-924): rp 2,
  // fp 2, erp 3, krp 4, hrp 5. A láncalap a kért szemszám és a kihagyás összege,
  // és a kihagyás után minden láncszembe egy szem megy — így pontosan N szem lesz.
  // Japán hagyományban a rövidpálca fordulólánca nem számít: ott 1 a kihagyás.
  ['sc',    20,  22,       3,         21,         2],
  ['hdc',   20,  22,       3,         22,         3],
  ['dc',    20,  23,       4,         23,         4],
  ['tr',    20,  24,       5,         24,         5],
  ['dtr',   20,  25,       6,         25,         6],
];

test('láncalap N szemhez sorban: a kért szemszám és a kihagyás összege; az első szem a kihagyás utáni láncszembe megy (PQW-924)', () => {
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

test('CYC sorban a kihagyás: rövidpálcánál és félpálcánál 2, pálcánál 3, kétráhajtásos pálcánál 4 — a láncalap ennyivel hosszabb a szemszámnál (PQW-924)', () => {
  for (const [id, from] of [['sc', 3], ['hdc', 3], ['dc', 4], ['tr', 5]]) {
    const def = stitchById(id);
    const counts = stitchTurningChainCounts(def, 'cyc', 'row');
    assert.equal(counts, true, `${id}: számít`);
    assert.equal(firstChainFromHook(def.turningChain, counts, 'cyc'), from, `${id}: horogtól`);
    for (const n of [10, 20, 39]) {
      const chains = n + skippedChains(def.turningChain, true);
      assert.equal(foundationChainLength(n, def.turningChain, true), chains, `${id}, ${n} szem: láncalap`);
      assert.equal(foundationChainLength(n, def.turningChain, true, 'cyc'), chains, `${id}, ${n} szem, CYC: láncalap`);
      // A kihagyás után minden láncszembe egy szem megy: pontosan a kért szemszám.
      assert.equal(chains - (firstChainFromHook(def.turningChain, counts, 'cyc') - 1), n, `${id}, ${n} szem: belehorgolt`);
    }
  }
});

test('körben a kezdőlánc CYC szerint változatlanul a szemkönyvtár alapértelmezését követi', () => {
  for (const id of ['sc', 'hdc', 'dc', 'tr', 'dtr', 'inc-2sc', 'dc2tog', 'ch', 'sl-st', 'magic-ring']) {
    const def = stitchById(id);
    assert.equal(stitchTurningChainCounts(def, 'cyc', 'round'), def.turningChainCounts, id);
  }
});

test('ismétlésnél a láncalap a kihagyással hosszabb, és a sor annyi helyet ad, ahány szeme van (PQW-924)', () => {
  const spec = { repeatWidth: 6, edgeStitches: 1, turningChainIncluded: false };
  const cyc = repeatCounts(spec, 3, 3, true);
  const japanese = repeatCounts(spec, 3, 3, true, 'japanese');
  assert.deepEqual(japanese, cyc);
  // 19 szem, pálca: 3 kihagyás, 22 láncszem, és a sor 19 helyet ad a következőnek.
  assert.deepEqual(cyc, { chains: 22, workedChains: 19, firstRowPositions: 19 });

  /*
   * Pálcánál a kihagyás akkor is 3, ha a fordulólánc nem számít, ezért a két
   * eset egybeesik. A különbség a rövidpálcánál látszik: ott a számító
   * fordulólánc 2 láncszemet hagy ki, a nem számító csak egyet.
   */
  assert.deepEqual(repeatCounts(spec, 3, 3, false), cyc);
  const scCounting = repeatCounts(spec, 3, 1, true);
  const scNot = repeatCounts(spec, 3, 1, false);
  assert.equal(scCounting.chains, scNot.chains + 1);
  assert.equal(scCounting.firstRowPositions, scNot.firstRowPositions, 'a szemszám egyik esetben sem változik');
  // Nem számító fordulóláncnál a két hagyomány egyezik.
  assert.deepEqual(repeatCounts(spec, 3, 1, false, 'japanese'), scNot);
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
      assert.equal(graph.layers[1].turningChain.length, turningChain, 'a fordulólánc hossza a szem szerinti');
      assert.equal(graph.layers[0].stitches.length + turningChain, n + turningChain);

      const from = firstChainFromHook(turningChain, stitchTurningChainCounts(stitchById(id), 'japanese', 'row'), 'japanese');
      const text = textOf(pattern);
      assert.match(text, new RegExp(`1. sor – alapsor: ${n + turningChain} lsz\\.`));
      assert.match(text, new RegExp(`2\\. sor: hagyj ki ${from - 1} láncszemet, majd minden láncszembe 1 `));
    });
  }
});

test('a tulajdonos sála: 41 láncszem, fordulás, 2 láncszem kihagyása, utána minden láncszembe 1 rövidpálca (PQW-924)', () => {
  const pattern = rectangle('sc', 39, 3, 'cyc');
  assert.deepEqual(findings(pattern), []);
  assert.equal(pattern.pieces[0].stitches.findIndex((node) => node.def !== 'ch'), 41, 'a láncalap 41 láncszem');
  assert.deepEqual(stitchCounts(pattern), [0, 39, 39, 39]);
  // A kiírt szemszám a fordulólánccal együtt (PQW-940).
  assert.deepEqual(computeLayers(pattern, testLibrary).map((layer) => layer.writtenCount), [40, 40, 40, 40]);

  const text = textOf(pattern);
  assert.ok(text.includes('1. sor – alapsor: 41 lsz.'), text);
  // A tulajdonos mondata (PQW-895): a kihagyott láncszemek száma, és hogy minden láncszembe 1 rp megy.
  assert.ok(text.split('\n').includes('2. sor: hagyj ki 2 láncszemet, majd minden láncszembe 1 rp (40 szem). Fordítás.'), text);
  assert.ok(textOf(pattern, 'en-US').split('\n').includes('Row 2: skip 2 ch, sc in each ch across (40 sts). Turn.'));
  // Britül a „miss” és a brit név: az amerikai sc a brit dc.
  assert.ok(textOf(pattern, 'en-GB').split('\n').includes('Row 2: miss 2 ch, dc in each ch across (40 sts). Turn.'));
  for (const locale of ['hu', 'en-US', 'en-GB']) {
    const result = readPattern(textOf(pattern, locale), { library: testLibrary, locale, conventions: pattern.conventions });
    assert.equal(result.ok, true, `${locale}: ${JSON.stringify(result.error)}`);
    assert.deepEqual(canonicalPattern(result.pattern), canonicalPattern(pattern), locale);
  }
});

describe('a láncalapra horgolt 2. sor egyszerű mondata (PQW-895)', () => {
  const firstRow = (pattern, locale) => textOf(pattern, locale).split('\n').find((line) => /^(2\. sor|Row 2):/.test(line));

  test('a kihagyott láncszemek száma a tulajdonos táblázata szerint: rp 2, fp 2, erp 3, krp 4 (PQW-924)', () => {
    const skips = [];
    for (const [id, n] of [['sc', 12], ['hdc', 12], ['dc', 12], ['tr', 12]]) {
      const pattern = rectangle(id, n, 2, 'cyc');
      assert.deepEqual(findings(pattern), [], id);
      const def = stitchById(id);
      const skip = firstChainFromHook(def.turningChain, stitchTurningChainCounts(def, 'cyc', 'row'), 'cyc') - 1;
      skips.push(skip);
      // A kiírt szemszám a fordulólánccal együtt (PQW-940).
      const stated = n + 1;
      assert.equal(firstRow(pattern, 'hu'), `2. sor: hagyj ki ${skip} láncszemet, majd minden láncszembe 1 ${def.terms.hu.abbr} (${stated} szem). Fordítás.`);
      assert.equal(firstRow(pattern, 'en-US'), `Row 2: skip ${skip} ch, ${def.terms['en-US'].abbr} in each ch across (${stated} sts). Turn.`);
      assert.equal(firstRow(pattern, 'en-GB'), `Row 2: miss ${skip} ch, ${def.terms['en-GB'].abbr} in each ch across (${stated} sts). Turn.`);
      // A régi „a kihagyott láncszemek 1 rp-nek számítanak” mondat nincs többé; a fordulólánc viszont szem (PQW-940).
      assert.doesNotMatch(textOf(pattern), /kihagyott láncszemek/);
      assert.match(textOf(pattern), new RegExp(`3\\. sor: ${def.turningChain} lsz \\(1 ${def.terms.hu.abbr}-nek számít\\),`));
    }
    assert.deepEqual(skips, [2, 2, 3, 4]);
  });

  test('félpálca és pálca: „hagyj ki 2 láncszemet” és „hagyj ki 3 láncszemet”, és mindhárom jelöléssel visszaolvasható', () => {
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

  test('japán hagyományban a nem számító rövidpálcás fordulólánc: „hagyj ki 1 láncszemet”, és visszaolvasható', () => {
    const pattern = rectangle('sc', 15, 3, 'japanese');
    assert.equal(firstRow(pattern, 'hu'), '2. sor: hagyj ki 1 láncszemet, majd minden láncszembe 1 rp (15 szem). Fordítás.');
    for (const locale of ['hu', 'en-US', 'en-GB']) {
      const result = readPattern(textOf(pattern, locale), { library: testLibrary, locale, conventions: pattern.conventions });
      assert.equal(result.ok, true, `${locale}: ${JSON.stringify(result.error)}`);
      assert.deepEqual(canonicalPattern(result.pattern), canonicalPattern(pattern), locale);
    }
  });

  /*
   * A PQW-895 előtti mentés a megszűnt fogalomra épül: a sor eleji láncszemeket
   * szemnek számolja. Az ilyen szöveget nem értelmezzük át csendben (PQW-924,
   * a PQW-911-es szegélyek precedense szerint), hanem érthetően elutasítjuk.
   */
  test('a PQW-895 előtti mondattal mentett szöveget a betöltő elutasítja, megmondva az okot és a teendőt', () => {
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
      // A hibás sor helyét is megmondja: a láncalap után következő sor.
      assert.equal(result.error.line, 2 + text.split('\n').indexOf(firstRow(pattern, locale)) - 1);
      // A teendő is benne van, nem csak az ok.
      assert.match(result.error.message, locale === 'hu' ? /Írd át a sort|generáld újra/ : /Rewrite the row|generate the pattern again/);
    }
  });

  test('a régi mondat megjegyzés nélkül is elutasított: az sem a mai alak', () => {
    const pattern = rectangle('sc', 15, 3, 'cyc');
    const old = textOf(pattern).replace(firstRow(pattern, 'hu'), '2. sor: a horogtól számított 3. láncszemtől kezdve 14 rp (15 szem). Fordítás.');
    const result = readPattern(old, { library: testLibrary, locale: 'hu', conventions: pattern.conventions });
    assert.equal(result.ok, false);
    assert.match(result.error.message, /korábbi szabály szerint készült/);
  });
});

test('a CYC szerinti rövidpálcás darab japán hagyományban hiba, a japán CYC-ben szintén; a félpálcás és a pálcás darab mindkettőben hibátlan', () => {
  const cyc = rectangle('sc', 15, 3, 'cyc');
  const japanese = rectangle('sc', 15, 3, 'japanese');
  assert.ok(rules(asTradition(cyc, 'japanese')).includes('foundation-chain'));
  // A japán darab 1 kihagyással készült; CYC-ben 2 járna, ezért a láncalap hibás (PQW-924).
  assert.ok(rules(asTradition(japanese, 'cyc')).includes('foundation-chain'));
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
  // Japánban a rövidpálca fordulólánca nem számít, ezért ott 1 a kihagyás és eggyel rövidebb a láncalap (PQW-924).
  assert.equal(japanese.pieces[0].stitches.length, cyc.pieces[0].stitches.length - 1, 'japánban eggyel rövidebb a láncalap');

  // A szöveg csak a sorok elején tér el: honnan indul az 1. sor, és számít-e a fordulólánc.
  const [a, b] = [textOf(cyc).split('\n'), textOf(japanese).split('\n')];
  assert.equal(a.length, b.length);
  const differing = a.map((line, i) => [line, b[i]]).filter(([x, y]) => x !== y);
  assert.ok(differing.length > 0);
  for (const [x, y] of differing) {
    // A láncalap hossza is eltér: rövidpálcánál CYC-ben 2, japánban 1 a kihagyás (PQW-924).
    assert.match(x, /^\d+(–\d+)?\. sor(: | – alapsor: )/);
    assert.equal(x.split(':')[0], y.split(':')[0]);
    /*
      * A szemszám is eltér: a fordulólánc a sor első szeme (PQW-940), és
      * japánban a rövidpálcáé nem számít, CYC-ben igen — ezért CYC-ben eggyel
      * több. A szerkezet (a belehorgolt szemek száma) ettől ugyanaz.
      */
    if (!x.includes(' – alapsor: ')) {
      assert.equal(Number(x.match(/\((\d+) szem\)/)[1]), Number(y.match(/\((\d+) szem\)/)[1]) + 1);
    }
  }
  // CYC-ben 2, japánban 1 a kihagyás, ezért a láncalap 17, illetve 16 láncszem (PQW-924).
  assert.ok(a.includes('1. sor – alapsor: 17 lsz.') && b.includes('1. sor – alapsor: 16 lsz.'));
  assert.match(textOf(cyc), /2\. sor: hagyj ki 2 láncszemet, majd minden láncszembe 1 rp \(16 szem\)/);
  assert.match(textOf(cyc), /1 lsz \(1 rp-nek számít\)/);
  assert.match(textOf(japanese), /2\. sor: hagyj ki 1 láncszemet, majd minden láncszembe 1 rp \(15 szem\)/);
  assert.match(textOf(japanese), /1 lsz \(fordulólánc\)/);
});

test('a félpálcás darab CYC és japán előbeállítással azonos: ugyanaz a gráf és ugyanaz a szöveg', () => {
  const cyc = rectangle('hdc', 15, 3, 'cyc');
  const japanese = rectangle('hdc', 15, 3, 'japanese');
  for (const pattern of [cyc, japanese]) assert.deepEqual(findings(pattern), []);
  assert.deepEqual(japanese.pieces, cyc.pieces);
  assert.equal(textOf(japanese), textOf(cyc));
  assert.ok(textOf(japanese).split('\n').includes('1. sor – alapsor: 17 lsz.'));
  // Japánban a félpálca fordulólánca számít, ezért ott is 2 a kihagyás (PQW-924).
  assert.match(textOf(japanese), /2\. sor: hagyj ki 2 láncszemet, majd minden láncszembe 1 fp \(16 szem\)/);
  assert.match(textOf(japanese), /2 lsz \(1 fp-nek számít\)/);
});

test('a pálcás darab láncalapja CYC-ben és japánban is N + T, a szemszám ugyanaz', () => {
  const cyc = rectangle('dc', 16, 2, 'cyc');
  const japanese = rectangle('dc', 16, 2, 'japanese');
  assert.deepEqual(stitchCounts(japanese), stitchCounts(cyc));
  assert.match(textOf(cyc), /1. sor – alapsor: 19 lsz\./);
  assert.match(textOf(japanese), /1. sor – alapsor: 19 lsz\./);
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

  test('a vezetett kurzor a félpálcát a 3., a pálcát a 4. láncszembe teszi, a rövidpálcát a 2.-ba (PQW-924)', () => {
    // Japánban a rövidpálca fordulólánca nem számít, ezért ott 1 a kihagyás.
    const pattern = foundation(12);
    assert.equal(defaultCursor(pattern, contextOf(pattern), 'hdc'), 2);
    assert.equal(defaultCursor(pattern, contextOf(pattern), 'dc'), 3);
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


/*
 * A kihagyott láncszemek száma az 1. sor kezdésénél (PQW-924).
 *
 * A tulajdonos táblázata az irányadó, és felülírja a PQW-891 „fordulólánc + 2”
 * szabályát: a félpálcától kezdve eggyel kevesebb láncszemet hagyunk ki. A
 * fordulólánc hossza nem változik, csak a kihagyás.
 */
test('a kihagyott láncszemek: rp 2, fp 2, erp 3, krp 4, hrp 5 (PQW-924)', () => {
  for (const [id, skipped] of [
    ['sc', 2],
    ['hdc', 2],
    ['dc', 3],
    ['tr', 4],
    ['dtr', 5],
  ]) {
    const def = stitchById(id);
    const counts = stitchTurningChainCounts(def, 'cyc', 'row');
    // Az első szem a kihagyott láncszemek utáni láncszembe megy.
    assert.equal(firstChainFromHook(def.turningChain, counts, 'cyc') - 1, skipped, `${id}: kihagyott láncszemek`);
  }
});
