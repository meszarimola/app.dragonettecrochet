/*
 * Filéhorgolás (PQW-864): a sor szélessége 3N + 1, a láncalap és a
 * fordulólánc teli és nyitott kezdésnél (03 §5.2, §10 G32, 01 §4.4), az
 * alakítás egész cellánként (03 §10 F30), az ismétlő egység az írott mintában,
 * és hogy minden filéminta hibátlanul átmegy az ellenőrzőn és menthető.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { canonicalPattern } from '../src/core/canonical.ts';
import { emptyPattern } from '../src/core/editor.ts';
import { FILET_STITCH, filetRowPositions, generateFilet, planFilet } from '../src/core/filet.ts';
import { buildPieceGraph } from '../src/core/graph.ts';
import { loadPattern, savePattern } from '../src/core/pattern-json.ts';
import { readPattern } from '../src/core/pattern-read.ts';
import { formatWrittenPattern, writePattern } from '../src/core/pattern-text.ts';
import { expandDraft } from '../src/core/pixel-chart.ts';
import { foundationChainLength } from '../src/core/repeat.ts';
import { libraryFor, resolveStitch } from '../src/core/stitch-variants.ts';
import { firstChainFromHook, traditionOf, turningChainCountsFor, withTradition } from '../src/core/tradition.ts';
import { validatePattern } from '../src/core/validate.ts';
import { GRID_CORE_TEXTS } from '../src/ui/i18n/core/grid.ts';
import { renderCoreText } from '../src/ui/i18n/core/render.ts';

/** Rács szövegből, felülről lefelé írva: `#` teli, `.` nyitott, `-` nincs cella. */
const chart = (...lines) =>
  lines
    .slice()
    .reverse()
    .map((line) => [...line].map((ch) => (ch === '#' ? 1 : ch === '.' ? 0 : -1)));

const cyc = () => emptyPattern();
const japanese = () => ({ ...emptyPattern(), conventions: withTradition(emptyPattern().conventions, 'japanese') });
const notCounting = () => ({ ...emptyPattern(), conventions: { ...emptyPattern().conventions, turningChainCounts: false } });

const make = (pattern, cells, unit = null) => {
  const result = generateFilet(pattern, { cells, unit, lettering: false });
  assert.ok(result.ok, JSON.stringify(result.reason));
  return result;
};
/** A mag kódot és adatot ad; a mondat a felület szótárában készül (PQW-904). */
const hu = (message) => renderCoreText(GRID_CORE_TEXTS.hu, message);
const findings = (pattern) => validatePattern(pattern, libraryFor(pattern));
const lines = (pattern, locale = 'hu') => writePattern(pattern, libraryFor(pattern), locale).pieces[0].lines;
const graphOf = (pattern) => buildPieceGraph(pattern, pattern.pieces[0], libraryFor(pattern));

/** A darab eleji láncszemek száma, és hogy az első pálca a horogtól számított hányadik láncszembe megy. */
function foundationOf(pattern) {
  const { stitches } = pattern.pieces[0];
  const chains = stitches.findIndex((node) => node.def !== 'ch');
  const anchor = stitches[chains].anchors[0].id;
  return { chains, fromHook: chains - stitches.findIndex((node) => node.id === anchor) };
}

/** Kiszámítható álvéletlen: a teszt mindig ugyanazokat a rácsokat nézi. */
function random(seed) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe('sor, láncalap és fordulólánc (03 §5.2, §10 G32)', () => {
  test('N cellás sor 3N + 1 pozíció: 1 cella 4, 2 cella 7, 3 cella 10; a teli sor minden pozíciója szem', () => {
    assert.deepEqual([1, 2, 3].map(filetRowPositions), [4, 7, 10]);
    const { pattern } = make(cyc(), chart('###', '###'));
    const layers = graphOf(pattern).layers.slice(1);
    assert.deepEqual(
      layers.map((layer) => [layer.positionCount, layer.stitchCount]),
      [
        [10, 10],
        [10, 10],
      ],
    );
  });

  test('teli és nyitott kezdés: 3N + 4 láncszem, és az első pálca a 4. láncszembe megy (PQW-924)', () => {
    // A sor első oszlopa valódi pálca, a nyitott cella láncszemei a sorhoz tartoznak.
    const filled = make(cyc(), chart('#####'));
    assert.deepEqual(filled.plan.foundation, { chains: 19, fromHook: 4 });
    assert.deepEqual(foundationOf(filled.pattern), filled.plan.foundation);

    const open = make(cyc(), chart('.####'));
    // Az 1. sor jobbról balra halad: a jobb szélső cella az első.
    assert.equal(open.plan.rows[0].start, 'filled');
    const openStart = make(cyc(), chart('####.'));
    assert.equal(openStart.plan.rows[0].start, 'open');
    assert.deepEqual(openStart.plan.foundation, { chains: 19, fromHook: 4 });
    assert.deepEqual(foundationOf(openStart.pattern), openStart.plan.foundation);
    assert.deepEqual(findings(openStart.pattern), []);
  });

  test('a láncalap és a fordulólánc a hagyomány függvényeiből: japán és nem számító fordulóláncnál is', () => {
    const def = resolveStitch(FILET_STITCH);
    for (const base of [cyc, japanese, notCounting]) {
      const pattern = base();
      const tradition = traditionOf(pattern.conventions);
      const counts = turningChainCountsFor(pattern.conventions.turningChainCounts, def, tradition, 'row');
      const result = make(pattern, chart('####'));
      assert.equal(result.plan.turningChain, def.turningChain);
      assert.equal(result.plan.foundation.chains, foundationChainLength(13, def.turningChain, counts, tradition));
      assert.equal(result.plan.foundation.fromHook, firstChainFromHook(def.turningChain, counts, tradition));
      assert.deepEqual(foundationOf(result.pattern), result.plan.foundation);
      assert.deepEqual(findings(result.pattern), []);
    }
  });

  test('későbbi sor: teli kezdésnél 3 lsz, nyitott kezdésnél a fordulólánc után a cella 2 láncszeme', () => {
    const { pattern } = make(cyc(), chart('.##', '###'));
    const [, , row2] = lines(pattern);
    // A sor első oszlopa valódi pálca, utána a nyitott cella két láncszeme (PQW-924).
    assert.match(row2, /^3\. sor: 3 lsz \(fordulólánc\), 1 erp, 2 lsz, 2 szem kihagyása, /);
    assert.equal(graphOf(pattern).layers[2].turningChain.length, 3);
    assert.deepEqual(findings(pattern), []);
  });

  test('nyitott kezdésű 2. sor az írott mintában: a láncalap 3N + 4, és a 4. láncszemtől indul (PQW-924)', () => {
    const { pattern } = make(cyc(), chart('###.'));
    const [foundation, row1] = lines(pattern);
    assert.equal(foundation, '1. sor – alapsor: 16 lsz.');
    /*
     * A kihagyás a pálca szerinti 3 láncszem (PQW-924); a nyitott cella két
     * láncszeme és két kihagyott láncszeme már a sorhoz tartozik.
     */
    assert.equal(row1, '2. sor: hagyj ki 3 láncszemet, majd 1 erp, 2 lsz, 2 láncszem kihagyása, 10 erp (11 szem). A fonal elvágása.');
    assert.match(lines(pattern, 'en-US')[1], /^Row 2: skip 3 ch, /);
  });
});

describe('minden filéminta hibátlan és menthető', () => {
  test('véletlen teli és nyitott rácsok CYC, japán és nem számító fordulóláncnál', () => {
    const next = random(864);
    for (const [name, base] of Object.entries({ cyc, japanese, notCounting })) {
      for (let run = 0; run < 12; run += 1) {
        const width = 1 + Math.floor(next() * 6);
        const height = 1 + Math.floor(next() * 5);
        const cells = Array.from({ length: height }, () => Array.from({ length: width }, () => (next() < 0.5 ? 1 : 0)));
        const label = `${name} ${JSON.stringify(cells)}`;
        const { pattern } = make(base(), cells);
        assert.deepEqual(findings(pattern), [], label);
        for (const locale of ['hu', 'en-US', 'en-GB']) assert.ok(formatWrittenPattern(writePattern(pattern, libraryFor(pattern), locale)), label);
        const loaded = loadPattern(savePattern(pattern));
        assert.ok(loaded.ok, label);
        assert.deepEqual(loaded.pattern, pattern, label);
      }
    }
  });
});

describe('alakítás egész cellánként (03 §10 F30)', () => {
  test('a sor elején szaporítás láncos hosszabbítással, a sor végén meghagyott cellák', () => {
    const { pattern, plan } = make(cyc(), chart('-###', '####', '-###'));
    assert.deepEqual(
      plan.rows.map((row) => [row.added, row.left, row.cells.length]),
      [
        [0, 0, 3],
        [1, 0, 4],
        [0, 1, 3],
      ],
    );
    assert.deepEqual(findings(pattern), []);
    const [, row1, row2] = lines(pattern);
    assert.match(row1, /, 3 lsz \(\d+ szem\)\. Fordítás\.$/);
    assert.match(row2, /^3\. sor: 3 lsz \(fordulólánc\), 13 erp /);
  });

  test('a sor elején fogyasztás kúszószemekkel a cellák fölött; a fordulólánc az oszlopon áll (PQW-894)', () => {
    const { pattern, plan } = make(cyc(), chart('-###', '####'));
    assert.deepEqual(
      plan.rows.map((row) => [row.removed, row.extended]),
      [
        [0, 0],
        [1, 0],
      ],
    );
    assert.deepEqual(findings(pattern), []);
    const [, , row2] = lines(pattern);
    // A fordulólánc nem ül oszlopon, ezért eggyel kevesebb kúszószem és eggyel több pálca (PQW-924).
    assert.match(row2, /^3\. sor: 3 ksz, 3 lsz \(fordulólánc\), 10 erp \(10 szem\)\. A fonal elvágása\.$/);
  });

  test('a sor végén szélesítés: három láncszem, ahogy a sor elején is (03 §5.2, PQW-924)', () => {
    const { pattern, plan } = make(cyc(), chart('####', '###.', '###-'));
    assert.deepEqual(plan.rows.map((row) => row.extended), [0, 1, 0]);
    assert.deepEqual(findings(pattern), []);
    const [, , row2] = lines(pattern);
    assert.match(row2, /, 3 lsz \(\d+ szem\)\. Fordítás\.$/);
    /*
     * A korábbi megoldás egy lejjebb horgolt hosszú szemmel kapaszkodott a
     * fordulólánc alatti szembe; az a szem a PQW-924 óta nincs meg, és a
     * tudásbázis szerint a szélesítés láncból is épülhet (03 §5.2).
     */
    assert.deepEqual(pattern.pieces[0].stitches.filter((node) => node.def === 'dtr'), []);
    assert.deepEqual(pattern.pieces[0].stitches.filter((node) => node.flags?.includes('spike')), []);
  });

  test('a lejjebb horgolt szem visszaolvasható az írott mintából, mindhárom jelöléssel (PQW-902)', () => {
    const { pattern } = make(cyc(), chart('####', '###.', '###-'));
    const library = libraryFor(pattern);
    for (const locale of ['hu', 'en-US', 'en-GB']) {
      const text = formatWrittenPattern(writePattern(pattern, library, locale));
      const back = readPattern(text, { library, locale, conventions: pattern.conventions });
      assert.ok(back.ok, `${locale}: ${JSON.stringify(back.error)}`);
      assert.deepEqual(canonicalPattern(back.pattern).pieces, canonicalPattern(pattern).pieces, locale);
      assert.deepEqual(findings(back.pattern), [], locale);
    }
  });

  test('rombusz: szaporítás és fogyasztás a sor mindkét végén, hibátlanul, kiírható és menthető', () => {
    const { pattern, plan } = make(cyc(), chart('--#--', '-###-', '.###.', '-.#.-', '--#--'));
    assert.deepEqual(
      plan.rows.map((row) => [row.added, row.extended, row.removed, row.left]),
      [
        [0, 0, 0, 0],
        [1, 1, 0, 0],
        [1, 1, 0, 0],
        [0, 0, 1, 1],
        [0, 0, 1, 1],
      ],
    );
    assert.deepEqual(findings(pattern), []);
    for (const locale of ['hu', 'en-US', 'en-GB']) assert.ok(formatWrittenPattern(writePattern(pattern, libraryFor(pattern), locale)));
    assert.deepEqual(loadPattern(savePattern(pattern)).pattern, pattern);
  });

  test('a nem horgolható alakításnál és a hibás rácsnál érthető ok', () => {
    const reason = (cells, pattern = cyc()) => {
      const result = planFilet(pattern, cells);
      assert.equal(result.ok, false);
      return result.reason;
    };
    // A mag kódot és sorszámot ad; a sor neve és a ragozás a felületé (PQW-904).
    assert.deepEqual(reason(chart('####', '###-')), { code: 'filet-extend-open', data: { row: 2 } });
    assert.deepEqual(reason(chart('.###', '-###', '####')), { code: 'filet-extend-reach', data: { row: 3 } });
    assert.deepEqual(reason(chart('###.', '###-'), notCounting()), { code: 'filet-extend-counting', data: { row: 2 } });
    assert.deepEqual(reason(chart('#-#')), { code: 'filet-gap-row', data: { row: 1 } });
    assert.deepEqual(reason(chart('###', '---')), { code: 'filet-empty-row', data: { row: 1 } });
    assert.equal(reason([]).code, 'filet-no-rows');
    assert.equal(reason([[1, 2]]).code, 'filet-cell-kind');

    // A magyar mondat a mai: névelő, sorszám és ragozás a szótárból.
    assert.match(hu(reason(chart('####', '###-'))), /^A 3\. sor végén az új cella csak nyitott lehet/);
    assert.match(hu(reason(chart('.###', '-###', '####'))), /^A 4\. sor végén a szaporítás nem éri el a két sorral lejjebbi szemet/);
    assert.match(hu(reason(chart('###.', '###-'), notCounting())), /fordulóláncnak szemnek kell számítania/);
    assert.match(hu(reason(chart('#-#'))), /^A 2\. sorban a cellák között üres hely van/);
    assert.equal(hu(reason(chart('###', '---'))), 'A 2. sorban nincs cella: a filé minden sora legalább egy cella.');
    assert.match(hu(reason([])), /legalább egy sort/);
    assert.match(hu(reason([[1, 2]])), /teli, nyitott vagy üres/);
  });
});

describe('ismétlő egység (tulajdonosi pontosítás, 2026-09-15)', () => {
  test('a kiterjesztett rácsból készül a gráf, a sor ismétlésként íródik, és az egység a darabbal mentődik', () => {
    // A tervező rácsa: `?` a meg nem adott cella.
    const drawn = chart('#.------', '.#.#.#.#', '#.#.#.#.').map((row, y) => row.map((cell, x) => (y === 2 && x >= 2 ? null : cell)));
    const unit = { x: 0, y: 0, width: 2, height: 2 };
    const cells = expandDraft(drawn, unit, 12, 6);
    const { pattern } = make(cyc(), cells, unit);
    assert.deepEqual(pattern.pieces[0].grid.unit, unit);
    assert.equal(pattern.pieces[0].grid.technique, 'filet');
    assert.deepEqual(findings(pattern), []);
    assert.equal(graphOf(pattern).layers.length, 7);
    assert.ok(lines(pattern).some((line) => /\[[^\]]+\] \d+-(szor|szer|ször)/.test(line)));
  });
});
