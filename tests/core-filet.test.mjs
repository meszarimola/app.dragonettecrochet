/*
 * Filéhorgolás (PQW-864): a sor szélessége 3N + 1, a láncalap és a
 * fordulólánc teli és nyitott kezdésnél (03 §5.2, §10 G32, 01 §4.4), az
 * alakítás egész cellánként (03 §10 F30), az ismétlő egység az írott mintában,
 * és hogy minden filéminta hibátlanul átmegy az ellenőrzőn és menthető.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { emptyPattern } from '../src/core/editor.ts';
import { FILET_STITCH, filetRowPositions, generateFilet, planFilet } from '../src/core/filet.ts';
import { buildPieceGraph } from '../src/core/graph.ts';
import { loadPattern, savePattern } from '../src/core/pattern-json.ts';
import { formatWrittenPattern, writePattern } from '../src/core/pattern-text.ts';
import { expandDraft } from '../src/core/pixel-chart.ts';
import { foundationChainLength } from '../src/core/repeat.ts';
import { libraryFor, resolveStitch } from '../src/core/stitch-variants.ts';
import { firstChainFromHook, traditionOf, turningChainCountsFor, withTradition } from '../src/core/tradition.ts';
import { validatePattern } from '../src/core/validate.ts';

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
  assert.ok(result.ok, result.reason);
  return result;
};
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

  test('teli kezdés: 3N + 4 láncszem, az első pálca az 5. láncszembe; nyitott kezdés: 3N + 6, a 9. láncszembe (PQW-891)', () => {
    // A fordulólánc az első oszlop helyett áll, egy alapláncszemen (tradition.ts).
    const filled = make(cyc(), chart('#####'));
    assert.deepEqual(filled.plan.foundation, { chains: 19, fromHook: 5 });
    assert.deepEqual(foundationOf(filled.pattern), filled.plan.foundation);

    const open = make(cyc(), chart('.####'));
    // Az 1. sor jobbról balra halad: a jobb szélső cella az első.
    assert.equal(open.plan.rows[0].start, 'filled');
    const openStart = make(cyc(), chart('####.'));
    assert.equal(openStart.plan.rows[0].start, 'open');
    assert.deepEqual(openStart.plan.foundation, { chains: 21, fromHook: 9 });
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
    assert.match(row2, /^2\. sor: 3 lsz \(1 erp-nek számít\), 2 lsz, 2 szem kihagyása, /);
    assert.equal(graphOf(pattern).layers[2].turningChain.length, 3);
    assert.deepEqual(findings(pattern), []);
  });

  test('nyitott kezdésű 1. sor az írott mintában: a láncalap 3N + 6, és a 9. láncszemtől indul', () => {
    const { pattern } = make(cyc(), chart('###.'));
    const [foundation, row1] = lines(pattern);
    assert.equal(foundation, 'Láncalap: 18 lsz.');
    // A kihagyott 8 láncszem: 3 lsz fordulólánc, 1 alapláncszem, a nyitott cella 2 lsz-e és 2 kihagyott láncszeme (PQW-895).
    assert.equal(row1, '1. sor: hagyj ki 8 láncszemet, majd minden láncszembe 1 erp (11 szem). A fonal elvágása.');
    assert.match(lines(pattern, 'en-US')[1], /^Row 1: skip 8 ch, dc in each ch across \(11 sts\)\./);
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
    assert.match(row2, /^2\. sor: 3 lsz \(1 erp-nek számít\), 12 erp /);
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
    assert.match(row2, /^2\. sor: 4 ksz, 3 lsz \(1 erp-nek számít\), 9 erp \(10 szem\)\. A fonal elvágása\.$/);
  });

  test('a sor végén szaporítás: 2 lsz és háromráhajtásos pálca a fordulólánc alatti szembe, jelölt hosszú szemként (PQW-894)', () => {
    const { pattern, plan } = make(cyc(), chart('####', '###.', '###-'));
    assert.deepEqual(plan.rows.map((row) => row.extended), [0, 1, 0]);
    assert.deepEqual(findings(pattern), []);
    const [, , row2] = lines(pattern);
    assert.match(row2, /, 2 lsz, 1 háromráhajtásos pálca 2 sorral lejjebb \(\d+ szem\)\. Fordítás\.$/);
    const long = pattern.pieces[0].stitches.filter((node) => node.def === 'dtr');
    assert.equal(long.length, 1);
    assert.deepEqual(long[0].flags, ['spike']);
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
    assert.match(reason(chart('####', '###-')), /^A 2\. sor végén az új cella csak nyitott lehet/);
    assert.match(reason(chart('.###', '-###', '####')), /^A 3\. sor végén szaporítás az előző sor eleji fogyasztás fölött még nem készül/);
    assert.match(reason(chart('###.', '###-'), notCounting()), /fordulóláncnak szemnek kell számítania/);
    assert.match(reason(chart('#-#')), /^Az 1\. sorban a cellák között üres hely van/);
    assert.match(reason(chart('###', '---')), /^Az 1\. sorban nincs cella/);
    assert.match(reason([]), /legalább egy sort/);
    assert.match(reason([[1, 2]]), /teli, nyitott vagy üres/);
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
