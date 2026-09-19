/*
 * Filet crochet (PQW-864): a row is 3N + 1 wide, the foundation and the
 * turning chain for a filled and for an open start (03 §5.2, §10 G32,
 * 01 §4.4), shaping by whole cells (03 §10 F30), the repeat unit in the
 * written pattern, and that every filet pattern passes the validator cleanly
 * and can be saved.
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

/** A chart from text, written top row first: `#` filled, `.` open, `-` no cell. */
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
/** The core hands over a code and data; the sentence is built in the UI dictionary (PQW-904). */
const hu = (message) => renderCoreText(GRID_CORE_TEXTS.hu, message);
const findings = (pattern) => validatePattern(pattern, libraryFor(pattern));
const lines = (pattern, locale = 'hu') => writePattern(pattern, libraryFor(pattern), locale).pieces[0].lines;
const graphOf = (pattern) => buildPieceGraph(pattern, pattern.pieces[0], libraryFor(pattern));

/** The number of chains at the start of the piece, and which chain from the hook the first double crochet goes into. */
function foundationOf(pattern) {
  const { stitches } = pattern.pieces[0];
  const chains = stitches.findIndex((node) => node.def !== 'ch');
  const anchor = stitches[chains].anchors[0].id;
  return { chains, fromHook: chains - stitches.findIndex((node) => node.id === anchor) };
}

/** Reproducible pseudo-randomness: the test always looks at the same charts. */
function random(seed) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe('the row, the foundation and the turning chain (03 §5.2, §10 G32)', () => {
  test('a row of N cells has 3N + 1 positions: 1 cell 4, 2 cells 7, 3 cells 10; in a filled row every position is a stitch', () => {
    assert.deepEqual([1, 2, 3].map(filetRowPositions), [4, 7, 10]);
    const { pattern } = make(cyc(), chart('###', '###'));
    const layers = graphOf(pattern).layers.slice(1);
    assert.deepEqual(
      // The top of the turning chain counts among the positions (PQW-944).
      layers.map((layer) => [layer.positionCount, layer.stitchCount]),
      [
        [11, 10],
        [11, 10],
      ],
    );
  });

  test('a filled and an open start: 3N + 4 chains, with the first double crochet going into the 4th chain (PQW-924)', () => {
    // The first column of the row is a real double crochet, and the chains of an open cell belong to the row.
    const filled = make(cyc(), chart('#####'));
    assert.deepEqual(filled.plan.foundation, { chains: 19, fromHook: 4 });
    assert.deepEqual(foundationOf(filled.pattern), filled.plan.foundation);

    const open = make(cyc(), chart('.####'));
    // Row 1 runs right to left: the rightmost cell comes first.
    assert.equal(open.plan.rows[0].start, 'filled');
    const openStart = make(cyc(), chart('####.'));
    assert.equal(openStart.plan.rows[0].start, 'open');
    assert.deepEqual(openStart.plan.foundation, { chains: 19, fromHook: 4 });
    assert.deepEqual(foundationOf(openStart.pattern), openStart.plan.foundation);
    assert.deepEqual(findings(openStart.pattern), []);
  });

  test('the foundation and the turning chain come from the tradition helpers, for Japanese and non-counting turning chains too', () => {
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

  test('a later row: 3 ch for a filled start, and after the turning chain the 2 chains of the cell for an open start', () => {
    const { pattern } = make(cyc(), chart('.##', '###'));
    const [, , row2] = lines(pattern);
    // The first column of the row is a real double crochet, followed by the two chains of the open cell (PQW-924).
    assert.match(row2, /^3\. sor: 3 lsz \(1 erp-nek számít\), 1 erp, 2 lsz, 2 szem kihagyása, /);
    assert.equal(graphOf(pattern).layers[2].turningChain.length, 3);
    assert.deepEqual(findings(pattern), []);
  });

  test('an open-start row 2 in the written pattern: the foundation is 3N + 4 and work starts at the 4th chain (PQW-924)', () => {
    const { pattern } = make(cyc(), chart('###.'));
    const [foundation, row1] = lines(pattern);
    assert.equal(foundation, '1. sor – alapsor: 16 lsz.');
    /*
     * The skip covers the 3 chains the double crochet calls for (PQW-924); the
     * two chains of the open cell and its two skipped chains already belong to
     * the row.
     */
    assert.equal(row1, '2. sor: hagyj ki 3 láncszemet, majd 1 erp, 2 lsz, 2 láncszem kihagyása, 10 erp (14 szem). A fonal elvágása.');
    assert.match(lines(pattern, 'en-US')[1], /^Row 2: skip 3 ch, /);
  });
});

describe('every filet pattern is clean and can be saved', () => {
  test('random filled and open charts under CYC, Japanese and non-counting turning chains', () => {
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

describe('shaping by whole cells (03 §10 F30)', () => {
  test('an increase at the start of the row extends it with chains, while cells are left off at the end', () => {
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
    assert.match(row2, /^3\. sor: 3 lsz \(1 erp-nek számít\), 13 erp /);
  });

  test('a decrease at the start of the row walks over the cells with slip stitches, and the turning chain stands on the column (PQW-894)', () => {
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
    // The turning chain does not sit on a column, so there is one slip stitch fewer and one double crochet more (PQW-924).
    assert.match(row2, /^3\. sor: 3 ksz, 3 lsz \(1 erp-nek számít\), 10 erp \(11 szem\)\. A fonal elvágása\.$/);
  });

  test('widening at the end of the row takes three chains, just as at the start of the row (03 §5.2, PQW-924)', () => {
    const { pattern, plan } = make(cyc(), chart('####', '###.', '###-'));
    assert.deepEqual(plan.rows.map((row) => row.extended), [0, 1, 0]);
    assert.deepEqual(findings(pattern), []);
    const [, , row2] = lines(pattern);
    assert.match(row2, /, 3 lsz \(\d+ szem\)\. Fordítás\.$/);
    /*
     * The earlier solution reached into the stitch below the turning chain
     * with a long dropped stitch; that stitch has been gone since PQW-924, and
     * the knowledge base allows widening to be built from chains as well
     * (03 §5.2).
     */
    assert.deepEqual(pattern.pieces[0].stitches.filter((node) => node.def === 'dtr'), []);
    assert.deepEqual(pattern.pieces[0].stitches.filter((node) => node.flags?.includes('spike')), []);
  });

  test('the dropped stitch can be read back from the written pattern in all three notations (PQW-902)', () => {
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

  test('a diamond: increases and decreases at both ends of the row, clean, writable and saveable', () => {
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

  test('shaping that cannot be crocheted and a bad chart are both rejected with an understandable reason', () => {
    const reason = (cells, pattern = cyc()) => {
      const result = planFilet(pattern, cells);
      assert.equal(result.ok, false);
      return result.reason;
    };
    // The core hands over a code and a row number; the name of the row and its inflection belong to the UI (PQW-904).
    assert.deepEqual(reason(chart('####', '###-')), { code: 'filet-extend-open', data: { row: 2 } });
    assert.deepEqual(reason(chart('.###', '-###', '####')), { code: 'filet-extend-reach', data: { row: 3 } });
    assert.deepEqual(reason(chart('###.', '###-'), notCounting()), { code: 'filet-extend-counting', data: { row: 2 } });
    assert.deepEqual(reason(chart('#-#')), { code: 'filet-gap-row', data: { row: 1 } });
    assert.deepEqual(reason(chart('###', '---')), { code: 'filet-empty-row', data: { row: 1 } });
    assert.equal(reason([]).code, 'filet-no-rows');
    assert.equal(reason([[1, 2]]).code, 'filet-cell-kind');

    // The Hungarian sentence is the one we ship today: article, row number and inflection come from the dictionary.
    assert.match(hu(reason(chart('####', '###-'))), /^A 3\. sor végén az új cella csak nyitott lehet/);
    assert.match(hu(reason(chart('.###', '-###', '####'))), /^A 4\. sor végén a szaporítás nem éri el a két sorral lejjebbi szemet/);
    assert.match(hu(reason(chart('###.', '###-'), notCounting())), /fordulóláncnak szemnek kell számítania/);
    assert.match(hu(reason(chart('#-#'))), /^A 2\. sorban a cellák között üres hely van/);
    assert.equal(hu(reason(chart('###', '---'))), 'A 2. sorban nincs cella: a filé minden sora legalább egy cella.');
    assert.match(hu(reason([])), /legalább egy sort/);
    assert.match(hu(reason([[1, 2]])), /teli, nyitott vagy üres/);
  });
});

describe('the repeat unit (owner clarification, 2026-09-15)', () => {
  test('the graph is built from the expanded chart, the row is written out as a repeat, and the unit is saved with the piece', () => {
    // The chart as the designer drew it: `?` is a cell that was not given.
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
