/*
 * Mozaik (PQW-894): a sorok színe, a kihagyás és a lejjebb horgolt szem az egy-
 * és a kétsoros változatban (03 §5.6, §10 G34), a rács hibáinak oka, az írott
 * minta jelölése, és hogy minden mozaikminta hibátlanul átmegy az ellenőrzőn,
 * kiírható és menthető.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { emptyPattern } from '../src/core/editor.ts';
import { buildPieceGraph } from '../src/core/graph.ts';
import { DROP_STITCH, generateMosaic, mosaicProblem, mosaicRowColor, planMosaic } from '../src/core/mosaic.ts';
import { loadPattern, savePattern } from '../src/core/pattern-json.ts';
import { formatWrittenPattern, writePattern } from '../src/core/pattern-text.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { withTradition } from '../src/core/tradition.ts';
import { validatePattern } from '../src/core/validate.ts';

const COLORS = [
  { name: 'Fehér', hex: '#ffffff' },
  { name: 'Kék', hex: '#2e86c1' },
];

/** Rács szövegből, felülről lefelé: `a` az A, `b` a B szín. */
const chart = (...lines) =>
  lines
    .slice()
    .reverse()
    .map((line) => [...line].map((ch) => (ch === 'a' ? 0 : 1)));

/** Kis mozaikmotívum: a 2., 3. és 4. sorban kihagyás van, a 3., 4. és 5. sorban lejjebb horgolt szem kerül föléjük (4 db). */
const MOTIF = chart('bbbbbbb', 'aaaaaaa', 'bbbabbb', 'abaaaba', 'bbbabbb', 'aaaaaaa');

const cyc = () => emptyPattern();
const japanese = () => ({ ...emptyPattern(), conventions: withTradition(emptyPattern().conventions, 'japanese') });

const make = (pattern, cells, variant) => {
  const result = generateMosaic(pattern, { cells, colors: COLORS, variant, unit: null, lettering: false });
  assert.ok(result.ok, result.reason);
  return result;
};
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

/** Véletlen, horgolható mozaikrács: szélén és az 1. sorban a sor színe, két kihagyás nem kerül egymás fölé. */
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

describe('sorok, kihagyás, lejjebb horgolt szem (03 §5.6, §10 G34)', () => {
  test('egysoros: rácssoronként egy sor, a sor színe váltakozik; a kihagyás fölött egyráhajtásos pálca 2 sorral lejjebb', () => {
    const { pattern, plan } = make(cyc(), MOTIF, 1);
    assert.equal(plan.rows.length, 6);
    assert.deepEqual(plan.rows.map((row) => row.color), [0, 1, 0, 1, 0, 1]);
    assert.equal(plan.depth, 2);
    assert.equal(plan.drops, 4);
    const graph = graphOf(pattern);
    for (const node of spikes(pattern)) {
      assert.equal(node.def, DROP_STITCH[2]);
      assert.equal(graph.layerOf.get(node.id) - graph.layerOf.get(node.anchors[0].id), 2);
      // A célpont fölötti sorban a célpont helyén kihagyás volt: abba a sorba senki nem horgolt bele.
      assert.ok(pattern.pieces[0].skipped.length > 0);
    }
    assert.deepEqual(findings(pattern), []);
  });

  test('kétsoros: rácssoronként két sor ugyanazzal a színnel; a lejjebb horgolt szem kétráhajtásos pálca 3 sorral lejjebb', () => {
    const { pattern, plan } = make(cyc(), MOTIF, 2);
    assert.equal(plan.rows.length, 12);
    assert.deepEqual(plan.rows.map((row) => row.color), [0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1]);
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

  test('az írott minta a kihagyást és a lejjebb horgolt szemet is jelöli; a színeket és a mozaik módját is írja', () => {
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

describe('a rács hibái', () => {
  test('két szín, az 1. sor alapsor, a szélen nincs kihagyás, két kihagyás nem kerül egymás fölé', () => {
    assert.match(mosaicProblem(chart('aaa'), [COLORS[0]]), /két színnel/);
    assert.match(mosaicProblem(chart('aba'), COLORS), /^Az 1\. sor az alapsor: minden cellája az A szín legyen\.$/);
    assert.match(mosaicProblem(chart('abb', 'aaa'), COLORS), /^A 2\. sor két szélső cellája a B szín legyen/);
    assert.match(mosaicProblem(chart('aabaa', 'bbabb', 'aaaaa'), COLORS), /^A 3\. sor 3\. cellája alatt is kihagyás van/);
    assert.match(mosaicProblem(chart('aa'), COLORS), /legalább 3 cella/);
    assert.equal(mosaicProblem(MOTIF, COLORS), null);
    assert.equal(planMosaic(cyc(), chart('aba'), COLORS, 1).ok, false);
  });
});

describe('minden mozaikminta hibátlan és menthető', () => {
  test('véletlen rácsok egy- és kétsoros változatban, CYC és japán hagyománnyal', () => {
    const next = random(894);
    for (const base of [cyc, japanese]) {
      for (const variant of [1, 2]) {
        for (let run = 0; run < 8; run += 1) {
          const cells = randomChart(next, 3 + Math.floor(next() * 6), 2 + Math.floor(next() * 6));
          const label = `${variant} ${JSON.stringify(cells)}`;
          const { pattern } = make(base(), cells, variant);
          assert.deepEqual(findings(pattern), [], label);
          for (const locale of ['hu', 'en-US', 'en-GB']) assert.ok(formatWrittenPattern(writePattern(pattern, libraryFor(pattern), locale)), label);
          const loaded = loadPattern(savePattern(pattern));
          assert.ok(loaded.ok, label);
          assert.deepEqual(loaded.pattern, pattern, label);
        }
      }
    }
  });
});
