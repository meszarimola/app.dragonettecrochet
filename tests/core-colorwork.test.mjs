/*
 * Tapestry and graphgan (PQW-864): one single crochet per cell, the foundation
 * chain from the tradition helpers, a stitch taking its cell colour in the
 * direction of work (03 §5.3, §5.4), the warning for carrying more than 3
 * colours (03 §10 G36), and that every pattern passes the validator cleanly
 * and can be saved.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { COLORWORK_STITCH, generateColorwork, planColorwork } from '../src/core/colorwork.ts';
import { emptyPattern } from '../src/core/editor.ts';
import { buildPieceGraph } from '../src/core/graph.ts';
import { loadPattern, savePattern } from '../src/core/pattern-json.ts';
import { formatWrittenPattern, writePattern } from '../src/core/pattern-text.ts';
import { foundationChainLength } from '../src/core/repeat.ts';
import { libraryFor, resolveStitch } from '../src/core/stitch-variants.ts';
import { firstChainFromHook, traditionOf, turningChainCountsFor, withTradition } from '../src/core/tradition.ts';
import { validatePattern } from '../src/core/validate.ts';
import { GRID_CORE_TEXTS } from '../src/ui/i18n/core/grid.ts';
import { renderCoreText } from '../src/ui/i18n/core/render.ts';

const COLORS = ['Fehér', 'Piros', 'Kék', 'Zöld', 'Sárga'].map((name, i) => ({
  name,
  hex: `#${String(i * 2).repeat(6)}`,
}));

const cyc = () => emptyPattern();
const japanese = () => ({ ...emptyPattern(), conventions: withTradition(emptyPattern().conventions, 'japanese') });
/** A counting single crochet turning chain: it stands in for the first stitch of the row. */
const counting = () => ({
  ...emptyPattern(),
  conventions: { ...emptyPattern().conventions, turningChainCounts: true },
});

const make = (pattern, cells, technique = 'tapestry') => {
  const result = generateColorwork(pattern, { technique, cells, colors: COLORS, unit: null, lettering: false });
  assert.ok(result.ok, JSON.stringify(result.reason));
  return result;
};
/** The core hands over a code and data; the sentence is built in the UI dictionary (PQW-904). */
const hu = (message) => renderCoreText(GRID_CORE_TEXTS.hu, message);
const findings = (pattern) => validatePattern(pattern, libraryFor(pattern));
const graphOf = (pattern) => buildPieceGraph(pattern, pattern.pieces[0], libraryFor(pattern));

function random(seed) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe('rows, foundation chain and colours (03 §5.3, §5.4)', () => {
  test('one cell is one single crochet: W stitches per row; the foundation and the first stitch come from the tradition helpers', () => {
    const def = resolveStitch(COLORWORK_STITCH);
    for (const base of [cyc, japanese, counting]) {
      const pattern = base();
      const tradition = traditionOf(pattern.conventions);
      const counts = turningChainCountsFor(pattern.conventions.turningChainCounts, def, tradition, 'row');
      const cells = [
        [0, 1, 1, 0, 2],
        [1, 1, 0, 0, 2],
        [2, 0, 0, 1, 1],
      ];
      const result = make(pattern, cells);
      assert.deepEqual(result.plan.foundation, {
        chains: foundationChainLength(5, def.turningChain, counts, tradition),
        fromHook: firstChainFromHook(def.turningChain, counts, tradition),
      });
      const leading = result.pattern.pieces[0].stitches.findIndex((node) => node.def !== 'ch');
      assert.equal(leading, result.plan.foundation.chains);
      assert.deepEqual(
        graphOf(result.pattern)
          .layers.slice(1)
          .map((layer) => layer.stitchCount),
        [5, 5, 5],
      );
      assert.deepEqual(findings(result.pattern), []);
    }
  });

  test('a stitch takes its cell colour in the direction of work: odd rows run right to left, even rows left to right', () => {
    const cells = [
      [0, 1, 2, 3],
      [3, 2, 1, 0],
    ];
    const { pattern } = make(cyc(), cells, 'graphgan');
    const graph = graphOf(pattern);
    // The turning chain is not a cell (PQW-924): the colours of a row belong to its stitches.
    const colorsOf = (layer) => {
      const color = (id) => graph.nodes.get(id).color ?? 0;
      return layer.stitches.filter((id) => graph.defs.get(id).kind !== 'chain').map(color);
    };
    assert.deepEqual(colorsOf(graph.layers[1]), [3, 2, 1, 0]);
    assert.deepEqual(colorsOf(graph.layers[2]), [3, 2, 1, 0]);
    // The turning chain is worked in the colour of the first cell of the row.
    assert.equal(graph.nodes.get(graph.layers[2].turningChain[0]).color, 3);
    assert.equal(pattern.pieces[0].grid.technique, 'graphgan');
  });

  test('every cell gets a real stitch, and the turning chain is not a cell (PQW-924)', () => {
    const { pattern } = make(counting(), [[0, 1, 2]]);
    const [layer] = graphOf(pattern).layers.slice(1);
    assert.equal(
      layer.stitches.filter((id) => pattern.pieces[0].stitches.find((node) => node.id === id).def === COLORWORK_STITCH)
        .length,
      3,
    );
  });
});

describe('validator and saving', () => {
  test('in tapestry a row with more than 3 colours is warned about, in graphgan it is not (03 §10 G36)', () => {
    const cells = [
      [0, 1, 2, 3, 0],
      [0, 1, 2, 0, 0],
    ];
    const tapestry = findings(make(cyc(), cells).pattern);
    assert.deepEqual(
      tapestry.map((finding) => [finding.rule, finding.severity]),
      [['carried-colors', 'warning']],
    );
    assert.deepEqual(findings(make(cyc(), cells, 'graphgan').pattern), []);
  });

  test('every tapestry and graphgan pattern is clean, writable and saveable: random charts under three conventions', () => {
    const next = random(36);
    for (const base of [cyc, japanese, counting]) {
      for (const technique of ['tapestry', 'graphgan']) {
        for (let run = 0; run < 6; run += 1) {
          const width = 2 + Math.floor(next() * 6);
          const height = 1 + Math.floor(next() * 5);
          const cells = Array.from({ length: height }, () =>
            Array.from({ length: width }, () => Math.floor(next() * 3)),
          );
          const label = `${technique} ${JSON.stringify(cells)}`;
          const { pattern } = make(base(), cells, technique);
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

  test('a bad chart is rejected with an understandable reason', () => {
    // The core hands over a code; the sentence comes from the UI dictionary (PQW-904).
    assert.equal(planColorwork(cyc(), 'tapestry', [[0, 9]], COLORS).reason.code, 'chart-color-index');
    assert.equal(planColorwork(counting(), 'tapestry', [[0]], COLORS).reason.code, 'colorwork-min-width');
    assert.match(hu(planColorwork(cyc(), 'tapestry', [[0, 9]], COLORS).reason), /színlista egyik színe/);
    assert.equal(
      hu(planColorwork(counting(), 'tapestry', [[0]], COLORS).reason),
      'Ha a fordulólánc szemnek számít, a sor legalább 2 cella legyen.',
    );
  });
});
