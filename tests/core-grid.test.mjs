/*
 * A rács a vásznon (PQW-874): a cellák a számolt pozíciókon, célzás a
 * cellákra, érthető üzenet ott, ahol nincs mibe horgolni, sávok váltakozó
 * színnel és hangsúlyos 5. és 10. vonallal, koncentrikus rács körben,
 * sokszögben sokszög alakú gyűrűk (PQW-888), az illesztés határa (PQW-887).
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { contextOf, emptyPattern, endRow, setPinned, work } from '../src/core/editor.ts';
import { aimAt, chartBounds, chartGrid, contains, emphasisOf, gridHit, seamAt } from '../src/core/grid.ts';
import { article } from '../src/core/hungarian.ts';
import { layoutPattern } from '../src/core/layout.ts';
import { framePoint } from '../src/core/polygon.ts';
import { DEFAULT_MOTIF, generateMotif } from '../src/core/round-generator.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { GRID_CORE_TEXTS } from '../src/ui/i18n/core/grid.ts';
import { renderCoreText } from '../src/ui/i18n/core/render.ts';
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
/** A mag kódot és adatot ad; a mondat a felület szótárában készül (PQW-904). */
const hu = (message) => renderCoreText(GRID_CORE_TEXTS.hu, message);

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

  test('a fordult sor minden jele a saját sávjában áll, a fordulólánc is (PQW-946)', () => {
    const example = hdcRectangle({ rows: 3 });
    const { grid, layout } = build(example.pattern);
    const foundationTurning = new Set(example.turningChains[1]);
    for (const node of layout.nodes.values()) {
      // A LÁNCALAP fordulólánca átnyúlik a sorhatáron: onnan indul a munka.
      if (foundationTurning.has(node.id)) continue;
      const band = grid.bands.find((candidate) => candidate.layer === node.layer);
      assert.ok(contains(band.area, node.top), `${node.id} (${node.layer}. sor)`);
    }

    /*
     * A tulajdonos szava a v0.35.0-ról: „a 3 lánc legalsó szeme rácsúszik a
     * második sorra. emeld ki, hogy külön álljon. az első sornál ez érthető,
     * hogy rácsúszik, mert onnan indul, viszont itt a 3. sor teljesen
     * különálló.”
     */
    const stack = example.turningChains[2];
    const own = grid.bands.find((candidate) => candidate.layer === 2);
    assert.ok(contains(own.area, layout.nodes.get(stack[0]).top), 'az alsó láncszem is a saját sávjában áll');
    assert.ok(contains(own.area, layout.nodes.get(stack.at(-1)).top), 'a felső láncszem is');
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
    assert.deepEqual(aim(grid, old.center), { kind: 'refused', message: { code: 'aim-other-layer', data: { layer: 1, current: 3, shape: 'row' } } });
    // A névelő, a ragozás és a „sor” szava a felületé; a magyar mondat a mai.
    assert.equal(
      hu(aim(grid, old.center).message),
      'Ez a 2. sor egyik helye. Most a 4. sor készül: csak a 3. sor szemeibe horgolhatsz. Nem került le szem.',
    );
    const foundation = grid.cells.find((cell) => cell.layer === 0);
    // A 0. réteg neve sorban „az 1. sor” (PQW-923: a láncalap az 1. sor), körben a varázskör.
    assert.deepEqual(aim(grid, foundation.center).message.data, { layer: 0, current: 3, shape: 'row', start: 'chain' });
    assert.match(hu(aim(grid, foundation.center).message), /^Ez az 1\. sor egyik helye\. Most a 4\. sor készül/);
  });

  test('a fordulólánc alsó szeme nem célpont, a teteje viszont az (PQW-944)', () => {
    // A V-szem mintában a fordulólánc kifejezetten nem számít.
    const example = vStitchPattern();
    const { grid, layout } = build(example.pattern);
    assert.equal(grid.layer, 3);
    /*
     * A fordulólánc alsó szeme a PQW-931 óta az ALATTA lévő sor sávjába lóg le,
     * ezért a kattintás annak a sornak a kontextusát mondja — nem célpont, de
     * megmondja, melyik sorban van. Ez pontosabb, mint a korábbi általános
     * elutasítás, és a lényeg változatlan: ide nem lehet horgolni.
     */
    const chain = layout.nodes.get(example.turningChains[2][0]).top;
    const hit = gridHit(grid, chain);
    // A fordult sor lánca a SAJÁT sávjában áll (PQW-946), a cellája viszont nem célpont.
    assert.equal(aimAt(grid, hit).kind, 'refused');
    assert.equal(aimAt(grid, hit).message.code, 'aim-not-target');

    // A fordulólánc TETEJE célpont (PQW-944): oda megy a következő sor utolsó szeme.
    const counting = hdcRectangle({ rows: 2 });
    const built = build(counting.pattern);
    const top = counting.turningChains[2].at(-1);
    const slot = built.context.slots.findIndex((candidate) => candidate.id === top);
    assert.ok(slot >= 0, 'a fordulólánc teteje a célpontok között van');
  });

  test('a félkész sorban, ahol alatta nincs szem, nincs mibe horgolni', () => {
    // Nem számító fordulólánc kifejezett beállítással: sorban alapértelmezésben számít, és a kihagyott szem fölött áll (PQW-891).
    const empty = emptyPattern();
    let pattern = ok(work({ ...empty, conventions: { ...empty.conventions, turningChainCounts: false } }, { def: 'ch', count: 7 }, 0));
    for (let slot = 1; slot <= 6; slot += 1) pattern = ok(work(pattern, { def: 'sc', count: 1 }, slot));
    pattern = ok(endRow(pattern));
    // A fordulólánc itt nem szem, ezért nem áll szem helyére: a horgoló maga teszi le (PQW-944).
    pattern = ok(work(pattern, { def: 'ch', count: 1 }, 0));
    pattern = ok(work(pattern, { def: 'sc', count: 1 }, 0));

    const { grid, layout, context } = build(pattern);
    assert.equal(grid.layer, 2);
    // A 2. sor nem számító fordulólánca a sor első szeme mellett kívül áll: alatta nincs célpont.
    /*
     * A fordult sor lánca a saját sávjában áll (PQW-946), a sor elején, ahol az
     * alatta lévő sorban nincs szem: oda nem lehet horgolni.
     */
    const chain = layout.nodes.get(context.graph.layers[2].turningChain[0]).top;
    assert.deepEqual(aim(grid, chain), { kind: 'refused', message: { code: 'aim-no-stitch' } });
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
    // 15 félpálca és a fordulólánc oszlopa (PQW-944).
    assert.equal(row1.length, 16);
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
    assert.deepEqual(aim(grid, inner.center).message.data, { layer: 1, current: 4, shape: 'round' });
    assert.match(hu(aim(grid, inner.center).message), /^Ez az 1\. kör egyik helye\. Most a 4\. kör készül: csak a 3\. kör szemeibe/);
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

/*
 * A függőleges fordulólánc egyetlen cellája (PQW-943).
 *
 * A tulajdonos jelentése: „itt a 2. sorban, ahol az 1. sor végén lévő
 * függőleges láncszem van: a 2. sorban ott két cella van, és egy kellene
 * legyen.” A fordulólánc láncszemei egymás fölött állnak, célpontként viszont
 * külön-külön szerepelnek; vízszintesre vetítve ezért esett szét a cella.
 *
 * A másik kérése ugyanide tartozik: ha a sor első szeme magasabb a többinél
 * (nagyobb hurok a sor végére), „a 2. sor cellamagasságát a legmagasabbhoz
 * igazítsa” — a sáv ne vágjon bele a láncba.
 */
describe('a függőleges fordulólánc egy cellát kap (PQW-943)', () => {
  /** `chains` láncszem, fordulás, majd egy `tool` a `cursor`. célpontba. */
  const started = (chains, tool, cursor) => {
    let pattern = ok(work(emptyPattern(), { def: 'ch', count: chains }, 0));
    pattern = ok(endRow(pattern));
    pattern = ok(work(pattern, { def: tool, count: 1 }, cursor));
    const library = libraryFor(pattern);
    const context = contextOf(pattern);
    const layout = layoutPattern(pattern, library, {});
    return { grid: chartGrid(pattern, library, 'rows', context, {}), layout, context, pattern, library };
  };
  /** A készülő sor cellái a rajz szerinti sorrendben. */
  const rowCells = (grid, layer) => grid.cells.filter((cell) => cell.layer === layer);

  test('két láncszemes fordulólánc: egy cella, nem kettő', () => {
    const { grid, context } = started(10, 'sc', 2);
    const turning = new Set(context.graph.layers[1].turningChain);
    const onChain = rowCells(grid, 1).filter((cell) => cell.slot !== null && turning.has(context.slots[cell.slot].id));
    assert.equal(onChain.length, 1, 'a fordulólánc oszlopában egyetlen cella áll');
    assert.ok(onChain[0].area.x1 - onChain[0].area.x0 > 20, `a cella teljes szélességű: ${onChain[0].area.x1 - onChain[0].area.x0}`);
  });

  test('négy láncszemes fordulólánc: akkor is egy cella, nulla szélesség nélkül', () => {
    const { grid, context } = started(10, 'sc', 4);
    assert.equal(context.graph.layers[1].turningChain.length, 4);
    const cells = rowCells(grid, 1);
    for (const cell of cells) assert.ok(cell.area.x1 - cell.area.x0 > 0, `a(z) ${cell.index}. cella nem nulla széles`);
    const turning = new Set(context.graph.layers[1].turningChain);
    assert.equal(cells.filter((cell) => cell.slot !== null && turning.has(context.slots[cell.slot].id)).length, 1);
  });

  test('a magasabb fordulólánc a sáv tetejét is megemeli, nem lóg ki', () => {
    const { grid, layout, context } = started(10, 'sc', 4);
    const band = grid.bands.find((candidate) => candidate.layer === 1);
    const tops = context.graph.layers[1].turningChain.map((id) => layout.nodes.get(id).top.y);
    assert.ok(band.area.y0 < Math.min(...tops), `a sáv teteje (${band.area.y0}) a lánc fölött (${Math.min(...tops)})`);
    for (const cell of rowCells(grid, 1)) assert.equal(cell.area.y0, band.area.y0, 'a cellák a sávval együtt magasodnak');
  });

  test('a fordulólánc lefelé nem húzza a sávot: a láncalap sávja a helyén marad', () => {
    const { grid } = started(10, 'sc', 4);
    const base = grid.bands.find((candidate) => candidate.layer === 0);
    const row = grid.bands.find((candidate) => candidate.layer === 1);
    assert.equal(row.area.y1, base.area.y0, 'a két sáv pontosan találkozik, nem lóg egymásra');
  });
});

/*
 * A beszúrás helye a rácson (PQW-941): a láncalap két cellája közötti vonal.
 * A tulajdonos választása: „két szem közé kattintok”.
 */
describe('a láncalap cellahatárai a beszúráshoz (PQW-941)', () => {
  const started = () => {
    let pattern = ok(work(emptyPattern(), { def: 'ch', count: 8 }, 0));
    pattern = ok(endRow(pattern));
    return ok(work(pattern, { def: 'sc', count: 1 }, contextOf(pattern).slots.length - 6));
  };

  test('a két cella közötti vonalon a két szomszédot adja vissza', () => {
    const pattern = started();
    const { grid } = build(pattern);
    const cells = grid.cells.filter((cell) => cell.layer === 0).sort((a, b) => a.area.x0 - b.area.x0);
    const boundary = { x: cells[1].area.x1, y: (grid.bands[0].area.y0 + grid.bands[0].area.y1) / 2 };
    const seam = seamAt(grid, boundary);
    assert.ok(seam, 'a határvonalon van beszúrási hely');
    assert.equal(seam.left, cells[1].node);
    assert.equal(seam.right, cells[2].node);
  });

  test('a lánc két szélén az egyik szomszéd hiányzik', () => {
    const pattern = started();
    const { grid } = build(pattern);
    const cells = grid.cells.filter((cell) => cell.layer === 0).sort((a, b) => a.area.x0 - b.area.x0);
    const y = (grid.bands[0].area.y0 + grid.bands[0].area.y1) / 2;
    assert.deepEqual(
      [seamAt(grid, { x: cells[0].area.x0, y }).left, seamAt(grid, { x: cells.at(-1).area.x1, y }).right],
      [null, null],
    );
  });

  test('a cella közepén nincs beszúrási hely, és más sorban sem', () => {
    const pattern = started();
    const { grid } = build(pattern);
    const cells = grid.cells.filter((cell) => cell.layer === 0).sort((a, b) => a.area.x0 - b.area.x0);
    const y = (grid.bands[0].area.y0 + grid.bands[0].area.y1) / 2;
    assert.equal(seamAt(grid, { x: cells[1].center.x, y }), null, 'a cella közepén nem');
    const above = grid.bands.find((band) => band.layer === 1);
    assert.equal(seamAt(grid, { x: cells[1].area.x1, y: (above.area.y0 + above.area.y1) / 2 }), null, 'a 2. sorban nem');
  });
});

/*
 * PQW-951: a láncív saját cellái. A tulajdonos: „ha több cellára van szükség,
 * akkor legyen úgy… csak hogy lenn pl van 3, felül meg 5.”
 */
describe('a láncív cellái (PQW-951)', () => {
  const arcPattern = () => {
    let pattern = ok(work(emptyPattern(), { def: 'ch', count: 24 }, 0));
    pattern = ok(endRow(pattern));
    pattern = ok(work(pattern, { def: 'sc', count: 1 }, 0));
    pattern = ok(work(pattern, { def: 'ch', count: 5 }, 1));
    return ok(work(pattern, { def: 'sc', count: 1 }, 4));
  };
  const rowCells = (grid, layer) => grid.cells.filter((cell) => cell.layer === layer);

  test('az 5 láncszem 5 cellát kap az alsó 3 cella helyén, ugyanazon a szakaszon', () => {
    const pattern = arcPattern();
    const { grid } = build(pattern);
    const stitches = rowCells(grid, 1).filter((cell) => cell.node !== null && cell.slot !== null);
    const arc = rowCells(grid, 1).slice(1, 6);
    assert.equal(arc.length, 5);
    assert.ok(
      arc.every((cell) => cell.node !== null),
      'mind az öt cellának van szeme',
    );
    // A két rögzített szem közötti szakaszt osztják fel, lent három szem áll alatta.
    const below = rowCells(grid, 0).slice(1, 4);
    assert.ok(near(arc[0].area.x1, below[0].area.x1) || arc[0].area.x1 <= below[0].area.x1 + 24, 'a szakasz nem nő');
    const widths = arc.map((cell) => cell.area.x1 - cell.area.x0);
    assert.ok(
      widths.every((width) => width < below[0].area.x1 - below[0].area.x0),
      `az ív cellái keskenyebbek az alattuk lévőknél: ${widths}`,
    );
    assert.ok(stitches.length >= 7, 'a sor minden jele cellát kapott');
  });

  test('a cellák sorrendje és célpontja nem borul fel', () => {
    const { grid } = build(arcPattern());
    const cells = rowCells(grid, 1);
    const slots = cells.map((cell) => cell.slot).filter((slot) => slot !== null);
    assert.deepEqual(
      slots,
      [...slots].sort((a, b) => a - b),
      `a célpontok a sor mentén nőnek: ${slots}`,
    );
    const widths = cells.map((cell) => cell.area.x1 - cell.area.x0);
    assert.ok(Math.min(...widths) > 5, `nincs elfajult cella: ${Math.min(...widths)}`);
  });

  test('a készülő sor sávja nem szélesebb a láncalapénál', () => {
    const { grid } = build(arcPattern());
    const base = grid.bands.find((band) => band.layer === 0);
    const row = grid.bands.find((band) => band.layer === 1);
    assert.ok(row.area.x1 <= base.area.x1 + 1e-6 && row.area.x0 >= base.area.x0 - 1e-6, 'a sáv a láncalapon belül');
  });

  test('az ív alatt áthidalt szem lezárt sorban sem kap üres cellát, a ki nem horgolt sorvég igen', () => {
    const pattern = ok(endRow(arcPattern()));
    const { grid } = build(pattern);
    const piece = pattern.pieces[0];
    // A két rövidpálca közé eső, áthidalt szemek: fölöttük ott az ív.
    const worked = new Set(piece.stitches.flatMap((stitch) => stitch.anchors.map((anchor) => anchor.id)));
    const base = piece.stitches.filter((stitch) => stitch.def === 'ch').map((stitch) => stitch.id).slice(0, 24);
    const marks = base.map((id, index) => (worked.has(id) ? index : -1)).filter((index) => index >= 0);
    const inside = new Set(base.filter((id, index) => index > marks[0] && index < marks.at(-1) && piece.skipped.includes(id)));
    assert.ok(inside.size === 3, `az ív három szemet hidal át: ${inside.size}`);
    const gaps = rowCells(grid, 1).filter((cell) => cell.gap !== null);
    assert.ok(
      gaps.every((cell) => !inside.has(cell.gap)),
      'az ív alatti szemek nem lyukak',
    );
    assert.ok(gaps.length > 0, 'a sor végén ki nem horgolt szemek viszont azok');
  });
});
