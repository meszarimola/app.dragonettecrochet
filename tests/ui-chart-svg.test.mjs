/*
 * Az SVG-export (PQW-857): olvasható diagram sorszámmal, szemszámmal, a két
 * oldal színével és jelmagyarázattal.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { emptyPattern, endRow, fillRow, work } from '../src/core/editor.ts';
import { layoutPattern } from '../src/core/layout.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { chartSvg, escapeXml, legendInsertions, legendStitches } from '../src/ui/chart-svg.ts';
import { hdcRectangle, shellStitch } from './fixtures/examples.ts';

const COLORS = { right: '#241f2b', wrong: '#2f5f9e', text: '#3f3949', background: '#faf7f3' };

function render(pattern, options = {}) {
  const library = libraryFor(pattern);
  return chartSvg(pattern, layoutPattern(pattern, library, options), library, { colors: COLORS, ...options });
}

test('a téglalap SVG-je: sorszámok, szemszámok, mindkét oldal színe, jelmagyarázat', () => {
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
  assert.match(svg, />félpálca \(fp\)</);
  assert.match(svg, />láncszem \(lsz\)</);
  assert.match(svg, /Jelölés: magyar; jelek: CYC\./);
  assert.match(svg, /Visszai sor/);
  assert.match(svg, /A sorszám a sor kezdő oldalán áll/);
  // A kúszószem pontja a csoport színével telik ki, nem tűnik el a `fill:none` miatt.
  assert.match(svg, /\.ink \.fill\{stroke:none;fill:currentColor\}/);
  assert.match(svg, /class="ink" stroke="#241f2b" color="#241f2b"/);
  // A jelmagyarázat leghosszabb felirata is kifér.
  const width = Number(svg.match(/width="([\d.]+)"/)[1]);
  assert.ok(width >= 7 * 'A sorszám a sor kezdő oldalán áll, zárójelben a szemszám.'.length);
});

test('a jelmagyarázat a csoportot mutatja, nem a tagjait', () => {
  const { pattern } = shellStitch({ repeats: 2 });
  const ids = legendStitches(pattern, libraryFor(pattern)).map((def) => def.id);
  assert.deepEqual(ids, ['ch', 'sc', 'shell-5dc', 'inc-2dc', 'inc-3dc']);
  assert.match(render(pattern), /kagyló: 5 erp egy szembe/);
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

/* ---- Jelölés és jelstílus (PQW-868) ---- */

test('angol jelöléssel a jelmagyarázat megnevezi a rendszert, és csak az adott jelölés neveit írja', () => {
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

test('JIS jelstílussal a rövidpálca ×, és az export megnevezi a stílust', () => {
  const { pattern } = shellStitch({ repeats: 1 });
  const jis = render(pattern, { symbols: { singleCrochet: 'plus', style: 'jis' } });
  assert.match(jis, /data-chart-style="jis"/);
  assert.match(jis, /jelek: japán \(JIS\)\./);
  assert.notEqual(jis, render(pattern));
  const crossed = render(pattern, { symbols: { singleCrochet: 'cross' } });
  assert.equal(jis.replace('data-chart-style="jis"', '').replace('japán (JIS)', ''), crossed.replace('data-chart-style="cyc"', '').replace('CYC', ''));
});

test('a beszúrási mód a talpon és a jelmagyarázatban, CYC és JIS jelstílusban is (PQW-869)', () => {
  const done = (result) => {
    assert.ok(result.ok, result.reason);
    return result.pattern;
  };
  let pattern = done(work(emptyPattern(), { def: 'ch', count: 6 }, 0));
  pattern = done(fillRow(pattern, { def: 'sc', count: 1, insertion: 'back-loop' }));
  pattern = done(endRow(pattern, 'sc'));
  pattern = done(fillRow(pattern, { def: 'sc', count: 1, insertion: 'back-loop' }));
  const library = libraryFor(pattern);

  // Színoldalról nézve a visszai sor első szálas: két jelmagyarázat-sor.
  assert.deepEqual(
    legendInsertions(pattern, library).map(({ def, mode }) => `${def.id}/${mode}`),
    ['sc/back-loop', 'sc/front-loop'],
  );
  const svg = render(pattern);
  assert.match(svg, /<tspan lang="hu">[^<]+<\/tspan> – hátsó szál<\/text>/);
  assert.match(svg, /<tspan lang="hu">[^<]+<\/tspan> – első szál<\/text>/);
  assert.match(svg, /színoldalról nézve/);
  // A jelölés íve: sorokban 4 + 4 (a sor első szeme helyett a számító fordulólánc áll, PQW-891), a jelmagyarázatban 2.
  const curves = (text) => (text.match(/<path d="M[^"]*Q/g) ?? []).length;
  assert.equal(curves(svg), 10);
  // JIS-ben a hátsó szál vízszintes vonal, az első szál íve marad.
  assert.equal(curves(render(pattern, { symbols: { singleCrochet: 'plus', style: 'jis' } })), 5);
  assert.doesNotMatch(svg, /NaN|undefined/);
});

test('mód nélküli mintában nincs módos jelmagyarázat-sor és megjegyzés', () => {
  const pattern = hdcRectangle({ rows: 2 }).pattern;
  assert.deepEqual(legendInsertions(pattern, libraryFor(pattern)), []);
  assert.doesNotMatch(render(pattern), /színoldalról nézve/);
});
