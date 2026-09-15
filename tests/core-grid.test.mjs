/*
 * A rács a vásznon (PQW-874): a cellák a számolt pozíciókon, célzás a
 * cellákra, érthető üzenet ott, ahol nincs mibe horgolni, sávok váltakozó
 * színnel és hangsúlyos 5. és 10. vonallal, koncentrikus rács körben,
 * sokszögben sokszög alakú gyűrűk (PQW-888), az illesztés határa (PQW-887).
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { contextOf, emptyPattern, endRow, setPinned, work } from '../src/core/editor.ts';
import { aimAt, chartBounds, chartGrid, contains, emphasisOf, gridHit } from '../src/core/grid.ts';
import { article } from '../src/core/hungarian.ts';
import { layoutPattern } from '../src/core/layout.ts';
import { framePoint } from '../src/core/polygon.ts';
import { DEFAULT_MOTIF, generateMotif } from '../src/core/round-generator.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { chevron, grannySquare, hdcRectangle, shellStitch, vStitchPattern } from './fixtures/examples.ts';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const ok = (result) => {
  assert.ok(result.ok, result.reason);
  return result.pattern;
};

function build(pattern, kind = 'rows', options = {}) {
  const library = libraryFor(pattern);
  const context = contextOf(pattern);
  return { grid: chartGrid(pattern, library, kind, context, options), layout: layoutPattern(pattern, library, options), context };
}

const aim = (grid, point) => aimAt(grid, gridHit(grid, point));

describe('sorrács: a cellák pontosan a számolt pozíciókon', () => {
  const cases = [
    ['szaporításnál (kagyló)', () => shellStitch({ repeats: 2 })],
    ['fogyasztásnál (cikcakk)', () => chevron()],
    ['láncívnél (V-szem)', () => vStitchPattern({ repeats: 2 })],
  ];
  for (const [name, make] of cases) {
    test(name, () => {
      const { grid, layout, context } = build(make().pattern);
      assert.equal(grid.kind, 'rows');
      for (const layer of context.graph.layers) {
        const cells = grid.cells.filter((cell) => cell.layer === layer.index);
        for (const id of layer.positions) {
          const cell = cells.find((candidate) => candidate.node === id);
          assert.ok(cell, `${layer.index}. sor, ${id}: van cellája`);
          const top = layout.nodes.get(id).top;
          assert.ok(near(cell.center.x, top.x), `${id}: a cella közepe a pozíció oszlopában`);
          assert.ok(contains(cell.area, top), `${id}: a pozíció a cellájában`);
        }
        // Egy sor cellái nem fedik egymást.
        const areas = cells.map((cell) => cell.area).sort((a, b) => a.x0 - b.x0);
        areas.forEach((area, i) => assert.ok(i === 0 || area.x0 >= areas[i - 1].x1 - 1e-6, `${layer.index}. sor: átfedés`));
      }
    });
  }

  test('a sor minden jele a saját sávjában áll', () => {
    const { grid, layout } = build(hdcRectangle({ rows: 3 }).pattern);
    for (const node of layout.nodes.values()) {
      const band = grid.bands.find((candidate) => candidate.layer === node.layer);
      assert.ok(contains(band.area, node.top), `${node.id} (${node.layer}. sor)`);
    }
  });

  test('a kézi igazítás a rácsot nem mozdítja', () => {
    const { pattern, rows } = hdcRectangle({ rows: 2 });
    const moved = ok(setPinned(pattern, rows[1][0], { x: 5, y: -7 }));
    assert.deepEqual(build(moved).grid, build(pattern).grid);
  });

  test('tükrözött nézetben a rács is tükröződik', () => {
    const { pattern } = hdcRectangle({ rows: 2 });
    const plain = build(pattern).grid;
    const mirrored = build(pattern, 'rows', { mirror: true }).grid;
    assert.ok(near(mirrored.bounds.minX, -plain.bounds.maxX));
    plain.cells.forEach((cell, i) => assert.ok(near(mirrored.cells[i].center.x, -cell.center.x)));
  });
});

describe('célzás a rácson', () => {
  test('a készülő sor célpontja az alsó sor cellájából és a fölötte lévőből is elérhető', () => {
    const { grid, context } = build(hdcRectangle({ rows: 2 }).pattern);
    assert.equal(grid.layer, 3);
    const below = grid.cells.filter((cell) => cell.layer === 2);
    const above = grid.cells.filter((cell) => cell.layer === 3);
    assert.equal(above.length, context.slots.length);
    context.slots.forEach((_, i) => {
      const own = below.find((cell) => cell.slot === i);
      const up = above.find((cell) => cell.slot === i);
      assert.ok(own && up, `${i}. célpont`);
      assert.ok(near(own.center.x, up.center.x));
      assert.deepEqual(aim(grid, own.center), { kind: 'target', slot: i });
      assert.deepEqual(aim(grid, up.center), { kind: 'target', slot: i });
    });
  });

  test('korábbi sor cellájára kattintva üzenet jön, és nem célpont', () => {
    const { grid } = build(hdcRectangle({ rows: 2 }).pattern);
    const old = grid.cells.find((cell) => cell.layer === 1);
    assert.deepEqual(aim(grid, old.center), {
      kind: 'refused',
      message: 'Ez az 1. sor egyik helye. Most a 3. sor készül: csak a 2. sor szemeibe horgolhatsz. Nem került le szem.',
    });
    const foundation = grid.cells.find((cell) => cell.layer === 0);
    assert.match(aim(grid, foundation.center).message, /^Ez a láncalap egyik helye\. Most a 3\. sor készül/);
  });

  test('a nem számító fordulólánc helye a célpontok sorában sem célpont', () => {
    // A V-szem mintában a fordulólánc kifejezetten nem számít.
    const example = vStitchPattern();
    const { grid, layout } = build(example.pattern);
    assert.equal(grid.layer, 3);
    const chain = layout.nodes.get(example.turningChains[2][0]).top;
    const hit = gridHit(grid, chain);
    assert.equal(hit.kind, 'band');
    assert.match(aimAt(grid, hit).message, /^Ide nem horgolhatsz: ez a hely nem célpont/);

    // A számító fordulólánc teteje viszont célpont: a következő sor utolsó szeme oda megy (PQW-891).
    const counting = hdcRectangle({ rows: 2 });
    const built = build(counting.pattern);
    const top = counting.turningChains[2].at(-1);
    const slot = built.context.slots.findIndex((candidate) => candidate.id === top);
    assert.ok(slot >= 0, 'a fordulólánc teteje a célpontok között');
    assert.deepEqual(aim(built.grid, built.layout.nodes.get(top).top), { kind: 'target', slot });
  });

  test('a félkész sorban, ahol alatta nincs szem, nincs mibe horgolni', () => {
    // Nem számító fordulólánc kifejezett beállítással: sorban alapértelmezésben számít, és a kihagyott szem fölött áll (PQW-891).
    const empty = emptyPattern();
    let pattern = ok(work({ ...empty, conventions: { ...empty.conventions, turningChainCounts: false } }, { def: 'ch', count: 7 }, 0));
    for (let slot = 1; slot <= 6; slot += 1) pattern = ok(work(pattern, { def: 'sc', count: 1 }, slot));
    pattern = ok(endRow(pattern, 'sc'));
    pattern = ok(work(pattern, { def: 'sc', count: 1 }, 0));

    const { grid, layout, context } = build(pattern);
    assert.equal(grid.layer, 2);
    // A 2. sor nem számító fordulólánca a sor első szeme mellett kívül áll: alatta nincs célpont.
    const chain = layout.nodes.get(context.graph.layers[2].turningChain[0]).top;
    assert.deepEqual(aim(grid, chain), { kind: 'refused', message: 'Ebben a cellában nincs mibe horgolni: alatta nincs szem. Nem került le szem.' });
    // A célpontok cellái a félkész sorban is a célpontokra mutatnak.
    const cells = grid.cells.filter((cell) => cell.layer === 2);
    assert.deepEqual(cells.map((cell) => cell.slot).sort((a, b) => a - b), context.slots.map((_, i) => i));
  });

  test('a rácson kívül nincs találat; üres mintán nincs rács', () => {
    const { grid } = build(hdcRectangle({ rows: 1 }).pattern);
    assert.equal(gridHit(grid, { x: grid.bounds.maxX + 50, y: 0 }), null);
    const empty = build(emptyPattern()).grid;
    assert.deepEqual([empty.bands.length, empty.cells.length], [0, 0]);
  });
});

describe('sávok és vonalak', () => {
  test('váltakozó sorszín, hézag nélkül egymáson; az 5. és a 10. vonal hangsúlyos', () => {
    const { grid } = build(hdcRectangle({ rows: 11 }).pattern);
    const bands = [...grid.bands].sort((a, b) => a.layer - b.layer);
    assert.deepEqual(bands.map((band) => band.layer), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    assert.deepEqual(bands.filter((band) => band.working).map((band) => band.layer), [12]);
    bands.forEach((band, i) => {
      assert.equal(band.tone, band.layer % 2);
      assert.ok(band.area.y0 < band.area.y1);
      // Felfelé csökken az y: a sáv alja az alatta lévő sáv teteje.
      if (i > 0) assert.ok(near(band.area.y1, bands[i - 1].area.y0), `${band.layer}. sáv`);
    });
    assert.deepEqual(
      bands.filter((band) => band.emphasis !== 'none').map((band) => [band.layer, band.emphasis]),
      [[5, 'five'], [10, 'ten']],
    );
    assert.deepEqual([0, 4, 5, 10, 15, 20].map(emphasisOf), ['none', 'none', 'five', 'ten', 'five', 'ten']);
  });

  test('a cellák a sor elejétől számolva: az 1. sor jobbról balra, minden 5. cella után hangsúlyos vonal', () => {
    const { grid } = build(hdcRectangle({ rows: 2 }).pattern);
    const row1 = grid.cells.filter((cell) => cell.layer === 1).sort((a, b) => a.index - b.index);
    assert.equal(row1.length, 15);
    assert.ok(row1.every((cell, i) => i === 0 || cell.center.x < row1[i - 1].center.x));
    assert.deepEqual(row1.filter((cell) => cell.emphasis !== 'none').map((cell) => [cell.index + 1, cell.emphasis]), [
      [5, 'five'],
      [10, 'ten'],
      [15, 'five'],
    ]);
    const row2 = grid.cells.filter((cell) => cell.layer === 2).sort((a, b) => a.index - b.index);
    assert.ok(row2[0].center.x < row2[1].center.x, 'a 2. sor balról jobbra');
  });
});

describe('a rács a mintatípus szerint', () => {
  test('koncentrikus rács: körgyűrű körönként, a cellák a kör pozícióinál', () => {
    const { grid, layout, context } = build(grannySquare().pattern, 'rounds');
    assert.equal(grid.shape, 'round');
    const bands = [...grid.bands].sort((a, b) => a.layer - b.layer);
    assert.equal(bands[0].area.r0, 0);
    bands.forEach((band, i) => {
      assert.equal(band.area.kind, 'sector');
      assert.ok(band.area.r0 < band.area.r1);
      if (i > 0) assert.ok(near(band.area.r0, bands[i - 1].area.r1));
    });
    for (const layer of context.graph.layers) {
      for (const id of layer.positions) {
        const cell = grid.cells.find((candidate) => candidate.layer === layer.index && candidate.node === id);
        assert.ok(cell, `${layer.index}. kör, ${id}`);
        assert.ok(contains(cell.area, layout.nodes.get(id).top), `${id}: a pozíció a cellájában`);
      }
    }
    // A varázskör egyetlen, teljes kör cella.
    const ring = grid.cells.filter((cell) => cell.layer === 0);
    assert.equal(ring.length, 1);
    assert.deepEqual(ring[0].center, { x: 0, y: 0 });
    // A készülő kör célpontjai a körcikkekből is elérhetők.
    context.slots.forEach((_, i) => {
      const up = grid.cells.find((cell) => cell.layer === grid.layer && cell.slot === i);
      assert.deepEqual(aim(grid, up.center), { kind: 'target', slot: i });
    });
    const inner = grid.cells.find((cell) => cell.layer === 1);
    assert.match(aim(grid, inner.center).message, /^Ez az 1\. kör egyik helye\. Most a 4\. kör készül: csak a 3\. kör szemeibe/);
  });

  test('varázskör után a célpont a varázskörbe: a készülő kör egyetlen teljes gyűrű', () => {
    const pattern = ok(work(emptyPattern(), { def: 'magic-ring', count: 1 }, 0));
    const { grid } = build(pattern, 'rounds');
    const working = grid.cells.filter((cell) => cell.layer === 1);
    assert.equal(working.length, 1);
    const { area } = working[0];
    assert.deepEqual([area.a0, area.a1], [0, 2 * Math.PI]);
    assert.deepEqual(aim(grid, { x: 0, y: -(area.r0 + area.r1) / 2 }), { kind: 'target', slot: 0 });
  });

  test('sokszög-rács (PQW-888): a gyűrűk a sokszög alakját követik, a cellák a pozícióknál, a határ a csúcsokig ér', () => {
    const granny = ok(generateMotif(emptyPattern(), { ...DEFAULT_MOTIF, shape: 'granny-square', rounds: 3 }));
    const { grid, layout, context } = build(granny, 'rounds');
    for (const band of grid.bands) assert.equal(band.area.frame?.sides, 4, `${band.layer}. sáv`);
    for (const layer of context.graph.layers) {
      for (const id of layer.positions) {
        const cell = grid.cells.find((candidate) => candidate.layer === layer.index && candidate.node === id);
        assert.ok(cell, `${layer.index}. kör, ${id}`);
        assert.ok(contains(cell.area, layout.nodes.get(id).top), `${id}: a pozíció a cellájában`);
      }
    }
    // A sarok a négyzetes sávban van; körgyűrűben kilógna belőle.
    const band = grid.bands.find((candidate) => candidate.layer === 3).area;
    const corner = framePoint(band.frame, (band.r0 + band.r1) / 2, band.frame.corner);
    assert.ok(contains(band, corner));
    assert.ok(!contains({ ...band, frame: undefined }, corner));

    // Vízszintes felső oldalú hatszög: a befoglaló téglalap oldalt a csúcsig, felül az oldalig ér.
    const hexagon = ok(generateMotif(emptyPattern(), { ...DEFAULT_MOTIF, shape: 'hexagon', rounds: 2 }));
    const hex = build(hexagon, 'rounds').grid;
    const outer = Math.max(...hex.bands.map((candidate) => candidate.area.r1));
    assert.ok(near(hex.bounds.maxX, outer / Math.cos(Math.PI / 6)));
    assert.ok(near(-hex.bounds.minY, outer));
  });

  test('az illesztés határa a rajz és a bekapcsolt rács uniója (PQW-887)', () => {
    const { grid, layout } = build(grannySquare().pattern, 'rounds');
    assert.ok(grid.bounds.minY < layout.bounds.minY, 'a rács a készülő kör sávjával nagyobb a rajznál');
    assert.deepEqual(chartBounds(layout, grid), {
      minX: Math.min(layout.bounds.minX, grid.bounds.minX),
      minY: Math.min(layout.bounds.minY, grid.bounds.minY),
      maxX: Math.max(layout.bounds.maxX, grid.bounds.maxX),
      maxY: Math.max(layout.bounds.maxY, grid.bounds.maxY),
    });
    assert.deepEqual(chartBounds(layout, null), layout.bounds, 'kikapcsolt rácsnál a rajz határa');
    assert.deepEqual(chartBounds(layout, { ...grid, bands: [] }), layout.bounds, 'üres rácsnál a rajz határa');
  });

  test('cellás rács (filé alap): egyforma szélességű cellák; szöveges nézet (amigurumi): nincs rács', () => {
    const { pattern } = hdcRectangle({ rows: 2 });
    const cells = build(pattern, 'cells').grid;
    assert.equal(cells.kind, 'cells');
    assert.ok(cells.cells.every((cell) => near(cell.area.x1 - cell.area.x0, 24)));
    const text = build(pattern, 'text').grid;
    assert.equal(text.kind, 'text');
    assert.deepEqual([text.bands.length, text.cells.length], [0, 0]);
  });
});

test('határozott névelő a számjeggyel írt szám előtt: az 1., a 2., az 5., az 50.', () => {
  const cases = { 0: 'a', 1: 'az', 2: 'a', 5: 'az', 10: 'a', 15: 'a', 50: 'az', 59: 'az', 100: 'a', 501: 'az', 1000: 'az', 2000: 'a', 5000: 'az' };
  for (const [n, expected] of Object.entries(cases)) assert.equal(article(Number(n)), expected, n);
  assert.throws(() => article(-1), RangeError);
});
