/*
 * Mosaic (PQW-894): the colour of the rows, the skips and the dropped stitches
 * in the single- and two-row variants (03 §5.6, §10 G34), the reasons a chart
 * is rejected, how the written pattern notes it all, and that every mosaic
 * pattern passes the validator cleanly and can be written out and saved.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { emptyPattern } from '../src/core/editor.ts';
import { buildPieceGraph } from '../src/core/graph.ts';
import {
  DROP_STITCH,
  generateMosaic,
  mosaicProblem,
  mosaicRowColor,
  planMosaic,
  repairMosaic,
} from '../src/core/mosaic.ts';
import { loadPattern, savePattern } from '../src/core/pattern-json.ts';
import { formatWrittenPattern, writePattern } from '../src/core/pattern-text.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { withTradition } from '../src/core/tradition.ts';
import { validatePattern } from '../src/core/validate.ts';
import { GRID_CORE_TEXTS } from '../src/ui/i18n/core/grid.ts';
import { renderCoreText } from '../src/ui/i18n/core/render.ts';

const COLORS = [
  { name: 'Fehér', hex: '#ffffff' },
  { name: 'Kék', hex: '#2e86c1' },
];

/** A chart from text, written top row first: `a` is colour A, `b` is colour B. */
const chart = (...lines) =>
  lines
    .slice()
    .reverse()
    .map((line) => [...line].map((ch) => (ch === 'a' ? 0 : 1)));

/** A small mosaic motif: rows 2, 3 and 4 hold skips, and rows 3, 4 and 5 put a dropped stitch above them (4 in all). */
const MOTIF = chart('bbbbbbb', 'aaaaaaa', 'bbbabbb', 'abaaaba', 'bbbabbb', 'aaaaaaa');

const cyc = () => emptyPattern();
const japanese = () => ({ ...emptyPattern(), conventions: withTradition(emptyPattern().conventions, 'japanese') });

const make = (pattern, cells, variant) => {
  const result = generateMosaic(pattern, { cells, colors: COLORS, variant, unit: null, lettering: false });
  assert.ok(result.ok, JSON.stringify(result.reason));
  return result;
};
/** The core hands over a code and data; the sentence is built in the UI dictionary (PQW-904). */
const hu = (message) => renderCoreText(GRID_CORE_TEXTS.hu, message);
const findings = (pattern) => validatePattern(pattern, libraryFor(pattern));
const graphOf = (pattern) => buildPieceGraph(pattern, pattern.pieces[0], libraryFor(pattern));
const spikes = (pattern) => pattern.pieces[0].stitches.filter((node) => node.flags?.includes('spike'));

function random(seed) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

/** A random but crochetable mosaic chart: the edges and row 1 take the row colour, and no two skips stack. */
function randomChart(next, width, height) {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const own = mosaicRowColor(y + 1);
    rows.push(
      Array.from({ length: width }, (_, x) => {
        if (y === 0 || x === 0 || x === width - 1) return own;
        const belowSkipped = rows[y - 1][x] !== mosaicRowColor(y);
        return !belowSkipped && next() < 0.4 ? 1 - own : own;
      }),
    );
  }
  return rows;
}

describe('rows, skips and dropped stitches (03 §5.6, §10 G34)', () => {
  test('single-row: one row per chart row with alternating row colours; above a skip a double crochet reaches 2 rows down', () => {
    const { pattern, plan } = make(cyc(), MOTIF, 1);
    assert.equal(plan.rows.length, 6);
    assert.deepEqual(
      plan.rows.map((row) => row.color),
      [0, 1, 0, 1, 0, 1],
    );
    assert.equal(plan.depth, 2);
    assert.equal(plan.drops, 4);
    const graph = graphOf(pattern);
    for (const node of spikes(pattern)) {
      assert.equal(node.def, DROP_STITCH[2]);
      assert.equal(graph.layerOf.get(node.id) - graph.layerOf.get(node.anchors[0].id), 2);
      // The row above the target held a skip at that spot: nothing was worked into that row there.
      assert.ok(pattern.pieces[0].skipped.length > 0);
    }
    assert.deepEqual(findings(pattern), []);
  });

  test('two-row: two rows per chart row in the same colour; the dropped stitch is a treble reaching 3 rows down', () => {
    const { pattern, plan } = make(cyc(), MOTIF, 2);
    assert.equal(plan.rows.length, 12);
    assert.deepEqual(
      plan.rows.map((row) => row.color),
      [0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1],
    );
    assert.equal(plan.depth, 3);
    const graph = graphOf(pattern);
    const drops = spikes(pattern);
    assert.equal(drops.length, 4);
    for (const node of drops) {
      assert.equal(node.def, DROP_STITCH[3]);
      assert.equal(graph.layerOf.get(node.id) - graph.layerOf.get(node.anchors[0].id), 3);
    }
    assert.deepEqual(findings(pattern), []);
    assert.equal(pattern.pieces[0].grid.mosaicRows, 2);
  });

  test('the written pattern notes both the skip and the dropped stitch, and states the colours and the mosaic mode', () => {
    const { pattern } = make(cyc(), MOTIF, 1);
    const text = formatWrittenPattern(writePattern(pattern, libraryFor(pattern), 'hu'));
    assert.match(text, /1 lsz, 1 szem kihagyása/);
    assert.match(text, /1 erp 2 sorral lejjebb/);
    assert.match(text, /^Mozaik: soronként egy szín\./m);
    assert.match(text, /\(az utolsó ráhajtásnál válts a B színre\)/);
    const english = formatWrittenPattern(writePattern(pattern, libraryFor(pattern), 'en-US'));
    assert.match(english, /dc in st 2 rows below/);
  });
});

describe('the errors of a chart', () => {
  test('two colours, row 1 is the base row, no skip at the edges, and no two skips stack', () => {
    // The core hands over a code, a row number, a cell number and a colour index (PQW-904).
    assert.equal(mosaicProblem(chart('aaa'), [COLORS[0]]).code, 'mosaic-two-colors');
    assert.deepEqual(mosaicProblem(chart('aba'), COLORS), { code: 'mosaic-base-row', data: { color: 0 } });
    assert.deepEqual(mosaicProblem(chart('abb', 'aaa'), COLORS), {
      code: 'mosaic-edge-colors',
      data: { row: 2, color: 1 },
    });
    assert.deepEqual(mosaicProblem(chart('aabaa', 'bbabb', 'aaaaa'), COLORS), {
      code: 'mosaic-stacked-skip',
      data: { row: 3, cell: 3 },
    });
    assert.equal(mosaicProblem(chart('aa'), COLORS).code, 'mosaic-min-width');

    // The Hungarian sentence is the one we ship today: the article, the word for the colour and the name of the row come from the dictionary.
    assert.match(hu(mosaicProblem(chart('aaa'), [COLORS[0]])), /két színnel/);
    assert.equal(hu(mosaicProblem(chart('aba'), COLORS)), 'Az 1. sor az alapsor: minden cellája az A szín legyen.');
    assert.match(hu(mosaicProblem(chart('abb', 'aaa'), COLORS)), /^A 3\. sor két szélső cellája a B szín legyen/);
    assert.match(
      hu(mosaicProblem(chart('aabaa', 'bbabb', 'aaaaa'), COLORS)),
      /^A 4\. sor 3\. cellája alatt is kihagyás van/,
    );
    assert.match(hu(mosaicProblem(chart('aa'), COLORS)), /legalább 3 cella/);
    assert.equal(mosaicProblem(MOTIF, COLORS), null);
    assert.equal(planMosaic(cyc(), chart('aba'), COLORS, 1).ok, false);
  });
});

describe('a loaded chart', () => {
  test('a two-colour chart is repaired into a crochetable mosaic: row 1 and the edges take the row colour, and no two skips stack', () => {
    const repaired = repairMosaic(chart('bbbbb', 'aabaa', 'bbabb', 'babab'));
    assert.equal(mosaicProblem(repaired, COLORS), null);
    assert.deepEqual(repaired, chart('bbbbb', 'aaaaa', 'bbabb', 'aaaaa'));
  });
});

describe('every mosaic pattern is clean and can be saved', () => {
  test('random charts in the single- and two-row variants, under the CYC and Japanese traditions', () => {
    const next = random(894);
    for (const base of [cyc, japanese]) {
      for (const variant of [1, 2]) {
        for (let run = 0; run < 8; run += 1) {
          const cells = randomChart(next, 3 + Math.floor(next() * 6), 2 + Math.floor(next() * 6));
          const label = `${variant} ${JSON.stringify(cells)}`;
          const { pattern } = make(base(), cells, variant);
          assert.deepEqual(findings(pattern), [], label);
          for (const locale of ['hu', 'en-US', 'en-GB'])
            assert.ok(formatWrittenPattern(writePattern(pattern, libraryFor(pattern), locale)), label);
          const loaded = loadPattern(savePattern(pattern));
          assert.ok(loaded.ok, label);
          assert.deepEqual(loaded.pattern, pattern, label);
        }
      }
    }
  });
});
