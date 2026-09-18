/*
 * Az SVG-export (PQW-857): olvasható diagram sorszámmal, szemszámmal, a két
 * oldal színével és jelmagyarázattal.
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

test('a téglalap SVG-je: sorszámok, szemszámok, mindkét oldal színe, jelmagyarázat', () => {
  const svg = render(hdcRectangle({ rows: 3 }).pattern);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.equal(svg.match(/<svg/g).length, 1);
  assert.match(svg, /<\/svg>\n$/);
  assert.doesNotMatch(svg, /NaN|undefined|Infinity/);
  /*
   * A sorszám és a szemszám egy feliraton (PQW-923), ugyanúgy, ahogy a tervező
   * vásznán; külön „(15)” szöveg már nem kerül a mintára. A láncalap az 1. sor.
   */
  assert.match(svg, />1\. sor – alapsor \(\d+\)</);
  for (const row of [2, 3, 4]) assert.match(svg, new RegExp(`>${row}\\. sor \\(16\\)</text>`));
  assert.doesNotMatch(svg, />\(16\)</);
  // Mindkét oldal csoportjában van szár.
  assert.match(svg, /data-side="right"[^>]*>\n(?:<(?!\/g>)[^\n]*\n)*<line/);
  assert.match(svg, /data-side="wrong"[^>]*>\n(?:<(?!\/g>)[^\n]*\n)*<line/);
  /*
   * A felirat a sor VÉGÉNEK oldalán áll (PQW-916/923), nem a kezdetén: ezért a
   * 2. sor felirata a bal, a 3. soré a jobb oldalon van — a korábbi elvárás
   * fordítva szólt, mert akkor a sorszám a kezdő oldalon állt.
   */
  const x = (row) => Number(svg.match(new RegExp(`x="(-?[\\d.]+)"[^>]*>${row}\\. sor \\(16\\)</text>`))[1]);
  assert.ok(x(3) > x(2));
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
  assert.deepEqual(ids, ['ch', 'sc', 'shell-5dc', 'inc-3dc']);
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

test('rácsminta: az ismétlő egység szaggatott kerettel, a lejjebb horgolt szem talpa pöttyel, jelmagyarázattal (PQW-894)', () => {
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
 * Az exportált kép rácsa ugyanaz, mint a tervezőé (PQW-924).
 *
 * A hiba azért maradt benn, mert a teszt hatóköre szűk volt: csak a tervezőt
 * néztük. Az export a közös `gridPaths`-ból és ugyanabból a súlytáblából
 * dolgozik, ezért itt a kimenetén ellenőrizzük, hogy nincs vastag függőleges
 * vonal — vagyis a minta nincs ötösével tagolva.
 */
test('az exportált rácsban nincs vastag függőleges cellavonal (PQW-924)', () => {
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
  assert.deepEqual(thickVertical.map((match) => match[4]), [], 'az exportban minden függőleges cellavonal vékony');
});


/*
 * Az export sorszámozása ugyanaz, mint a tervezőé (PQW-923, PQW-924).
 *
 * A tulajdonos a kiélesített képen a bal szélen egy kék „0”-t látott: a régi
 * export a réteg indexét írta ki sorszámként, így a láncalap „0” lett. Azóta a
 * láncalap az 1. sor, és a szemszámát a rajz a saját jeleiből számolja. Ez a
 * teszt őrzi, hogy a számozás ne csúszhasson vissza.
 */
test('az exportban a láncalap az 1. sor, és nincs „0” sorszám (PQW-924)', () => {
  const { pattern } = hdcRectangle({ rows: 6 });
  const library = libraryFor(pattern);
  const grid = chartGrid(pattern, library, 'rows', contextOf(pattern));
  const svg = chartSvg(pattern, layoutPattern(pattern, library, {}), library, {
    colors: COLORS,
    grid: { grid, colors: { rowA: '#eee', rowB: '#ddd', cell: '#ccc', row: '#bbb', emphasis: '#999' } },
  });
  const texts = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((match) => match[1].trim());
  assert.deepEqual(texts.filter((text) => text === '0'), [], 'nincs önálló „0” felirat');
  assert.ok(
    texts.some((text) => text.startsWith('1. sor – alapsor')),
    `a láncalap az 1. sor: ${JSON.stringify(texts.slice(0, 3))}`,
  );
  // A sorok a láncalaptól folytonosan számozódnak, kihagyás nélkül.
  const rows = texts.filter((text) => /^\d+\. sor/.test(text)).map((text) => Number.parseInt(text, 10));
  assert.deepEqual(rows, [1, 2, 3, 4, 5, 6, 7], 'folytonos sorszámozás a láncalaptól');
});
