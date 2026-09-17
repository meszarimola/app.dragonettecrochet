/*
 * A rács rajza útvonalakként (PQW-874): a vászon és az SVG-export ugyanezt
 * rajzolja.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { contextOf, emptyPattern } from '../src/core/editor.ts';
import { chartGrid } from '../src/core/grid.ts';
import { DEFAULT_MOTIF, generateMotif } from '../src/core/round-generator.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { gridPaths, LINE_WIDTH } from '../src/ui/grid-paths.ts';
import { grannySquare, hdcRectangle } from './fixtures/examples.ts';

const gridOf = (pattern, kind) => chartGrid(pattern, libraryFor(pattern), kind, contextOf(pattern));

test('sorrács: sávonként egy kitöltés, a vonalak gyengébbtől az erősebbig, szám hiba nélkül', () => {
  const grid = gridOf(hdcRectangle({ rows: 11 }).pattern, 'rows');
  const paths = gridPaths(grid);
  assert.equal(paths.bands.length, grid.bands.length);
  assert.deepEqual(paths.bands.slice(0, 3).map((band) => band.tone), [0, 1, 0]);
  const text = JSON.stringify(paths);
  assert.doesNotMatch(text, /NaN|undefined|Infinity/);
  const order = ['cell', 'row', 'five', 'ten'];
  const weights = paths.lines.map((line) => order.indexOf(line.weight));
  assert.ok(weights.every((w, i) => i === 0 || w >= weights[i - 1]), 'a hangsúlyos vonal a végén rajzolódik');
  for (const weight of order) assert.ok(paths.lines.some((line) => line.weight === weight), weight);
  // A készülő, még üres sor vonalai szaggatottak.
  assert.ok(paths.lines.some((line) => line.dashed));
  assert.ok(LINE_WIDTH.ten > LINE_WIDTH.five && LINE_WIDTH.five > LINE_WIDTH.row);
});

test('koncentrikus rács: körívek és evenodd kitöltésű körgyűrűk', () => {
  const paths = gridPaths(gridOf(grannySquare().pattern, 'rounds'));
  assert.equal(paths.bands[0].evenOdd, false, 'a varázskör teli kör');
  assert.ok(paths.bands.slice(1).every((band) => band.evenOdd && /A/.test(band.d)));
  assert.ok(paths.lines.some((line) => /L/.test(line.d)), 'sugárirányú cellahatár');
  assert.doesNotMatch(JSON.stringify(paths), /NaN|undefined|Infinity/);
});

test('sokszög-rács (PQW-888): egyenes oldalú gyűrűk, körív nélkül', () => {
  const { pattern } = generateMotif(emptyPattern(), { ...DEFAULT_MOTIF, shape: 'hexagon', rounds: 3 });
  const paths = gridPaths(gridOf(pattern, 'rounds'));
  const corners = (d) => (d.match(/[ML]/g) ?? []).length;
  assert.ok(paths.bands.every((band) => !/A/.test(band.d)), 'nincs körív');
  assert.equal(corners(paths.bands[0].d), 6, 'a középső sáv teli hatszög');
  assert.ok(paths.bands.slice(1).every((band) => band.evenOdd && corners(band.d) === 12), 'a gyűrű két hatszög');
  assert.doesNotMatch(JSON.stringify(paths), /NaN|undefined|Infinity/);
});

/*
 * A láncalapnak nincsenek cellavonalai (PQW-923).
 *
 * A tulajdonos hosszú láncalapon szabálytalan, 3–5 szemes csoportokra tagolt
 * vastag függőleges vonalakat látott. Ezek a rács cellahatárai voltak: a cellák
 * a szemek tényleges helyéből kapják a szélességüket, a láncszemek pedig
 * egyenetlen közűek, és akkor még minden 5. és 10. cellavonal vastagabb is
 * volt. (A cellavonalak kiemelését azóta a PQW-924 teljesen megszüntette.) A
 * cella megmarad — rá kattintva továbbra is lehet horgolni —, csak a vonala nem.
 */
test('a láncalap cellái nem kapnak elválasztó vonalat, a többi sor igen', () => {
  const grid = gridOf(hdcRectangle({ rows: 4 }).pattern, 'rows');
  const paths = gridPaths(grid);
  const foundationCells = grid.cells.filter((cell) => cell.layer === 0);
  assert.ok(foundationCells.length > 0, 'a láncalapnak vannak cellái: a kattintás továbbra is működik');

  // A cellavonalak a cella jobb szélén, függőlegesen futnak: „M<x> <y>V<y2>”.
  const verticals = paths.lines.filter((line) => /^M[-\d.]+ [-\d.]+V[-\d.]+$/.test(line.d));
  const xOf = (line) => Number(/^M([-\d.]+) /.exec(line.d)[1]);
  const yOf = (line) => Number(/^M[-\d.]+ ([-\d.]+)V/.exec(line.d)[1]);

  const band = grid.bands.find((candidate) => candidate.layer === 0);
  assert.ok(band && band.area.kind === 'rect');
  const inFoundation = verticals.filter((line) => {
    const y = yOf(line);
    return y >= Math.min(band.area.y0, band.area.y1) - 0.01 && y <= Math.max(band.area.y0, band.area.y1) + 0.01;
  });
  assert.deepEqual(inFoundation.map(xOf), [], 'a láncalap sávjában nincs cellavonal');

  // A többi sorban viszont megmaradnak: a rács ott továbbra is segít számolni.
  assert.ok(verticals.length > 0, 'a sorokban maradnak cellavonalak');
});


/*
 * A cellák közötti vonalak soha nem kapnak számoló kiemelést (PQW-924).
 *
 * A PQW-923-ban csak a készülő sorból vettem ki a kiemelést, a kész sorokban
 * meghagytam — a tulajdonos viszont az exportált képen továbbra is ötös
 * csoportosítást látott. A tervező és az export ugyanezt a kódot használja,
 * ezért itt egy helyen zárjuk ki mindkettőre.
 */
test('egyetlen függőleges cellavonal sem kiemelt súlyú, sem készülő, sem kész sorban', () => {
  for (const rows of [2, 6, 11]) {
    const grid = gridOf(hdcRectangle({ rows }).pattern, 'rows');
    const vertical = gridPaths(grid).lines.filter((line) => /^M[-\d.]+ [-\d.]+V[-\d.]+$/.test(line.d));
    assert.ok(vertical.length > 0, `${rows} sor: vannak cellavonalak`);
    assert.deepEqual(
      [...new Set(vertical.map((line) => line.weight))],
      ['cell'],
      `${rows} sor: a cellavonalak egységesen vékonyak`,
    );
    /*
     * A sorok vízszintes vonalai megtartják a kiemelést: azok a sorokat
     * számolják, nem a szemeket tagolják. Ez csak ott látszik, ahol van
     * legalább öt sor.
     */
    if (rows >= 5) {
      const horizontal = gridPaths(grid).lines.filter((line) => !/^M[-\d.]+ [-\d.]+V[-\d.]+$/.test(line.d));
      assert.ok(horizontal.some((line) => line.weight === 'five' || line.weight === 'ten'), `${rows} sor: a sorvonalak kiemelése megmarad`);
    }
  }
});
