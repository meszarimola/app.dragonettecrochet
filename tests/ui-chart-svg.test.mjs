/*
 * The SVG export (PQW-857): a readable chart with row numbers, stitch counts,
 * the colour of the two sides, and a legend.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { contextOf, emptyPattern, endRow, fillRow, work } from '../src/core/editor.ts';
import { chartGrid } from '../src/core/grid.ts';
import { layoutPattern } from '../src/core/layout.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { chartSvg, escapeXml, legendInsertions, legendStitches } from '../src/ui/chart-svg.ts';
import { defaultState, generateFromState, spikeNodes, unitFrames } from '../src/ui/grid-chart-view.ts';
import { hdcRectangle, shellStitch } from './fixtures/examples.ts';

const COLORS = { right: '#241f2b', wrong: '#2f5f9e', text: '#3f3949', background: '#faf7f3' };

function render(pattern, options = {}) {
  const library = libraryFor(pattern);
  return chartSvg(pattern, layoutPattern(pattern, library, options), library, { colors: COLORS, ...options });
}

test('the SVG of a rectangle: row numbers, stitch counts, the colour of both sides, and a legend', () => {
  const svg = render(hdcRectangle({ rows: 3 }).pattern);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.equal(svg.match(/<svg/g).length, 1);
  assert.match(svg, /<\/svg>\n$/);
  assert.doesNotMatch(svg, /NaN|undefined|Infinity/);
  /*
   * Row number and stitch count share one label (PQW-923), just as on the canvas
   * of the designer; a separate „(15)” text is no longer drawn onto the chart.
   * The foundation chain counts as row 1.
   */
  assert.match(svg, />1\. sor – alapsor \(\d+\)</);
  for (const row of [2, 3, 4]) assert.match(svg, new RegExp(`>${row}\\. sor \\(16\\)</text>`));
  assert.doesNotMatch(svg, />\(16\)</);
  // Both side groups contain a stem.
  assert.match(svg, /data-side="right"[^>]*>\n(?:<(?!\/g>)[^\n]*\n)*<line/);
  assert.match(svg, /data-side="wrong"[^>]*>\n(?:<(?!\/g>)[^\n]*\n)*<line/);
  /*
   * The label stands on the side where the row ENDS (PQW-916/923), not where it
   * starts: that is why the label of row 2 is on the left and the one of row 3 on
   * the right — the earlier expectation said the opposite, back when the row
   * number stood on the starting side.
   */
  const x = (row) => Number(svg.match(new RegExp(`x="(-?[\\d.]+)"[^>]*>${row}\\. sor \\(16\\)</text>`))[1]);
  assert.ok(x(3) > x(2));
  assert.match(svg, /Jelmagyarázat/);
  assert.match(svg, />félpálca \(fp\)</);
  assert.match(svg, />láncszem \(lsz\)</);
  assert.match(svg, /Jelölés: magyar; jelek: CYC\./);
  assert.match(svg, /Visszai sor/);
  assert.match(svg, /A sorszám a sor kezdő oldalán áll/);
  // The slip stitch dot is filled with the colour of its group, so `fill:none` does not make it vanish.
  assert.match(svg, /\.ink \.fill\{stroke:none;fill:currentColor\}/);
  assert.match(svg, /class="ink" stroke="#241f2b" color="#241f2b"/);
  // Even the longest label of the legend fits.
  const width = Number(svg.match(/width="([\d.]+)"/)[1]);
  assert.ok(width >= 7 * 'A sorszám a sor kezdő oldalán áll, zárójelben a szemszám.'.length);
});

test('the legend shows the group, not its members', () => {
  const { pattern } = shellStitch({ repeats: 2 });
  const ids = legendStitches(pattern, libraryFor(pattern)).map((def) => def.id);
  assert.deepEqual(ids, ['ch', 'sc', 'shell-5dc', 'inc-3dc']);
  assert.match(render(pattern), /kagyló: 5 erp egy szembe/);
});

test('in mirrored view the legend says that the chart is mirrored', () => {
  const { pattern } = hdcRectangle({ rows: 1 });
  assert.doesNotMatch(render(pattern), /Tükrözött/);
  assert.match(render(pattern, { mirror: true }), /Tükrözött nézet balkezeseknek\./);
});

test('the title is XML-safe', () => {
  const { pattern } = hdcRectangle({ rows: 1 });
  const svg = render({ ...pattern, title: 'Kendő <1> & „próba”' });
  assert.match(svg, /Kendő &lt;1&gt; &amp; „próba”/);
  assert.equal(escapeXml(`'"`), '&apos;&quot;');
});

/* ---- Terminology and symbol style (PQW-868) ---- */

test('with English terms the legend names the system and prints only the names of that terminology', () => {
  const { pattern } = hdcRectangle({ rows: 1 });
  const us = render(pattern, { terms: 'en-US' });
  assert.match(us, /data-terms="en-US"/);
  assert.match(us, />Jelmagyarázat \(US terms\)</);
  assert.match(us, /lang="en">half double crochet \(hdc\)</);
  assert.match(us, /Jelölés: amerikai angol \(US terms\); jelek: CYC\./);
  assert.doesNotMatch(us, /félpálca/);

  const gb = render(pattern, { terms: 'en-GB' });
  assert.match(gb, />Jelmagyarázat \(UK terms\)</);
  assert.match(gb, />half treble \(htr\)</);
  assert.doesNotMatch(gb, /\b(sc|hdc|sl st)\b/);
});

test('in JIS symbol style single crochet is an ×, and the export names the style', () => {
  const { pattern } = shellStitch({ repeats: 1 });
  const jis = render(pattern, { symbols: { singleCrochet: 'plus', style: 'jis' } });
  assert.match(jis, /data-chart-style="jis"/);
  assert.match(jis, /jelek: japán \(JIS\)\./);
  assert.notEqual(jis, render(pattern));
  const crossed = render(pattern, { symbols: { singleCrochet: 'cross' } });
  assert.equal(jis.replace('data-chart-style="jis"', '').replace('japán (JIS)', ''), crossed.replace('data-chart-style="cyc"', '').replace('CYC', ''));
});

test('the insertion mode shows on the foot and in the legend, in CYC and in JIS symbol style alike (PQW-869)', () => {
  const done = (result) => {
    assert.ok(result.ok, result.reason);
    return result.pattern;
  };
  let pattern = done(work(emptyPattern(), { def: 'ch', count: 6 }, 0));
  pattern = done(fillRow(pattern, { def: 'sc', count: 1, insertion: 'back-loop' }));
  pattern = done(endRow(pattern));
  pattern = done(fillRow(pattern, { def: 'sc', count: 1, insertion: 'back-loop' }));
  const library = libraryFor(pattern);

  // Seen from the right side the wrong-side row is front loop: two legend rows.
  assert.deepEqual(
    legendInsertions(pattern, library).map(({ def, mode }) => `${def.id}/${mode}`),
    ['sc/back-loop', 'sc/front-loop'],
  );
  const svg = render(pattern);
  assert.match(svg, /<tspan lang="hu">[^<]+<\/tspan> – hátsó szál<\/text>/);
  assert.match(svg, /<tspan lang="hu">[^<]+<\/tspan> – első szál<\/text>/);
  assert.match(svg, /színoldalról nézve/);
  // Curves of the insertion mark: 4 + 4 in the rows (the counting turning chain stands in for the first stitch of the row, PQW-891) and 2 in the legend.
  const curves = (text) => (text.match(/<path d="M[^"]*Q/g) ?? []).length;
  assert.equal(curves(svg), 10);
  // In JIS the back loop is a horizontal line while the front loop keeps its curve.
  assert.equal(curves(render(pattern, { symbols: { singleCrochet: 'plus', style: 'jis' } })), 5);
  assert.doesNotMatch(svg, /NaN|undefined/);
});

test('a pattern with no insertion mode gets neither an insertion legend row nor a note', () => {
  const pattern = hdcRectangle({ rows: 2 }).pattern;
  assert.deepEqual(legendInsertions(pattern, libraryFor(pattern)), []);
  assert.doesNotMatch(render(pattern), /színoldalról nézve/);
});

test('grid pattern: a dashed frame around the repeat unit, a dot on the foot of the spike stitch, and both explained in the legend (PQW-894)', () => {
  const state = {
    ...defaultState('mosaic', 5, 4),
    draft: [
      [0, 0, 0, 0, 0],
      [1, 1, 0, 1, 1],
      [0, 0, 0, 0, 0],
      [1, 1, 1, 1, 1],
    ],
    manualUnit: { x: 0, y: 0, width: 5, height: 2 },
  };
  const { pattern } = generateFromState(emptyPattern(), state);
  const library = libraryFor(pattern);
  const layout = layoutPattern(pattern, library);
  const svg = chartSvg(pattern, layout, library, { colors: COLORS, unitFrames: unitFrames(pattern, layout, false), spikes: spikeNodes(pattern) });
  assert.equal(svg.match(/data-unit-frame/g).length, 1);
  assert.equal(svg.match(/data-spike/g).length, 1);
  assert.match(svg, /Szaggatott keret: az ismétlő egység\./);
  assert.match(svg, /Pötty a szár végén: a lejjebb, a kihagyott szembe horgolt szem\./);
  assert.doesNotMatch(svg, /NaN|undefined|Infinity/);
  const plain = render(hdcRectangle({ rows: 2 }).pattern);
  assert.doesNotMatch(plain, /data-unit-frame|data-spike|Szaggatott keret|Pötty a szár/);
});


/*
 * The grid of the exported image is the same as the one in the designer (PQW-924).
 *
 * The bug survived because the scope of the test was too narrow: it only looked
 * at the designer. The export works from the shared `gridPaths` and from the same
 * weight table, so here we check on its output that there is no thick vertical
 * line — that is, the chart is not divided into groups of five.
 */
test('the exported grid has no thick vertical cell line (PQW-924)', () => {
  const { pattern } = hdcRectangle({ rows: 6 });
  const library = libraryFor(pattern);
  const grid = chartGrid(pattern, library, 'rows', contextOf(pattern));
  const svg = chartSvg(pattern, layoutPattern(pattern, library, {}), library, {
    colors: COLORS,
    grid: { grid, colors: { rowA: '#eee', rowB: '#ddd', cell: '#ccc', row: '#bbb', emphasis: '#999' } },
  });
  const thickVertical = [...svg.matchAll(/<path d="M([-\d.]+) ([-\d.]+)V([-\d.]+)"[^>]*stroke-width="([\d.]+)"/g)].filter(
    (match) => Number(match[4]) > 1,
  );
  assert.deepEqual(thickVertical.map((match) => match[4]), [], 'every vertical cell line in the export is thin');
});


/*
 * Row numbering in the export is the same as in the designer (PQW-923, PQW-924).
 *
 * On the sharpened image the owner saw a blue „0” at the left edge: the old
 * export printed the layer index as the row number, so the foundation chain came
 * out as „0”. Since then the foundation chain is row 1, and the drawing counts
 * its stitches from its own symbols. This test keeps the numbering from slipping
 * back.
 */
test('in the export the foundation chain is row 1 and no „0” row number appears (PQW-924)', () => {
  const { pattern } = hdcRectangle({ rows: 6 });
  const library = libraryFor(pattern);
  const grid = chartGrid(pattern, library, 'rows', contextOf(pattern));
  const svg = chartSvg(pattern, layoutPattern(pattern, library, {}), library, {
    colors: COLORS,
    grid: { grid, colors: { rowA: '#eee', rowB: '#ddd', cell: '#ccc', row: '#bbb', emphasis: '#999' } },
  });
  const texts = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((match) => match[1].trim());
  assert.deepEqual(texts.filter((text) => text === '0'), [], 'no standalone „0” label');
  assert.ok(
    texts.some((text) => text.startsWith('1. sor – alapsor')),
    `the foundation chain is row 1: ${JSON.stringify(texts.slice(0, 3))}`,
  );
  // Rows are numbered continuously from the foundation chain, with no gaps.
  const rows = texts.filter((text) => /^\d+\. sor/.test(text)).map((text) => Number.parseInt(text, 10));
  assert.deepEqual(rows, [1, 2, 3, 4, 5, 6, 7], 'continuous row numbering from the foundation chain');
});
