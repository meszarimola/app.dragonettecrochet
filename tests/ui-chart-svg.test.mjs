/*
 * Az SVG-export (PQW-857): olvasható diagram sorszámmal, öltésszámmal, a két
 * oldal színével és jelmagyarázattal.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { layoutPattern } from '../src/core/layout.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { chartSvg, escapeXml, legendStitches } from '../src/ui/chart-svg.ts';
import { hdcRectangle, shellStitch } from './fixtures/examples.ts';

const COLORS = { right: '#241f2b', wrong: '#2f5f9e', text: '#3f3949', background: '#faf7f3' };

function render(pattern, options = {}) {
  const library = libraryFor(pattern);
  return chartSvg(pattern, layoutPattern(pattern, library, options), library, { colors: COLORS, ...options });
}

test('a téglalap SVG-je: sorszámok, öltésszámok, mindkét oldal színe, jelmagyarázat', () => {
  const svg = render(hdcRectangle({ rows: 3 }).pattern);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.equal(svg.match(/<svg/g).length, 1);
  assert.match(svg, /<\/svg>\n$/);
  assert.doesNotMatch(svg, /NaN|undefined|Infinity/);
  for (const row of [1, 2, 3]) assert.match(svg, new RegExp(`>${row}</text>`));
  assert.equal(svg.match(/>\(15\)</g).length, 3);
  // Mindkét oldal csoportjában van szár.
  assert.match(svg, /data-side="right"[^>]*>\n(?:<(?!\/g>)[^\n]*\n)*<line/);
  assert.match(svg, /data-side="wrong"[^>]*>\n(?:<(?!\/g>)[^\n]*\n)*<line/);
  // Az 1. sor száma a jobb oldalon, a 2. soré a bal oldalon (03 §2.1).
  const x = (row) => Number(svg.match(new RegExp(`x="(-?[\\d.]+)"[^>]*>${row}</text>`))[1]);
  assert.ok(x(1) > x(2));
  assert.match(svg, /Jelmagyarázat/);
  assert.match(svg, /félpálca \(fp\) · half double crochet \(hdc\)/);
  assert.match(svg, /láncszem \(lsz\) · chain \(ch\)/);
  assert.match(svg, /Visszai sor/);
  assert.match(svg, /A sorszám a sor kezdő oldalán áll/);
  // A kúszószem pontja a csoport színével telik ki, nem tűnik el a `fill:none` miatt.
  assert.match(svg, /\.ink \.fill\{stroke:none;fill:currentColor\}/);
  assert.match(svg, /class="ink" stroke="#241f2b" color="#241f2b"/);
  // A jelmagyarázat leghosszabb felirata is kifér.
  const width = Number(svg.match(/width="([\d.]+)"/)[1]);
  assert.ok(width >= 7 * 'félpálca (fp) · half double crochet (hdc)'.length);
});

test('a jelmagyarázat a csoportot mutatja, nem a tagjait', () => {
  const { pattern } = shellStitch({ repeats: 2 });
  const ids = legendStitches(pattern, libraryFor(pattern)).map((def) => def.id);
  assert.deepEqual(ids, ['ch', 'sc', 'shell-5dc', 'inc-2dc', 'inc-3dc']);
  assert.match(render(pattern), /kagyló: 5 erp egy öltésbe/);
});

test('tükrözött nézetben a jelmagyarázat jelzi a tükrözést', () => {
  const { pattern } = hdcRectangle({ rows: 1 });
  assert.doesNotMatch(render(pattern), /Tükrözött/);
  assert.match(render(pattern, { mirror: true }), /Tükrözött nézet balkezeseknek\./);
});

test('a cím XML-biztos', () => {
  const { pattern } = hdcRectangle({ rows: 1 });
  const svg = render({ ...pattern, title: 'Kendő <1> & „próba”' });
  assert.match(svg, /Kendő &lt;1&gt; &amp; „próba”/);
  assert.equal(escapeXml(`'"`), '&apos;&quot;');
});
