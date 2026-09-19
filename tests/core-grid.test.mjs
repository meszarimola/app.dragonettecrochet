/*
 * The grid on the canvas (PQW-874): cells on the computed positions, aiming at
 * cells, a clear message where there is nothing to crochet into, bands in
 * alternating tones with an emphasised 5th and 10th line, a concentric grid in
 * rounds, polygon-shaped rings in a polygon (PQW-888), and the chart bounds
 * where the drawing and the grid meet (PQW-887).
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
/** The core returns a code and data; the sentence is built in the UI dictionary (PQW-904). */
const hu = (message) => renderCoreText(GRID_CORE_TEXTS.hu, message);

describe('row grid: cells sit exactly on the computed positions', () => {
  const cases = [
    ['with increases (shell stitch)', () => shellStitch({ repeats: 2 })],
    ['with decreases (chevron)', () => chevron()],
    ['with a chain space (V-stitch)', () => vStitchPattern({ repeats: 2 })],
  ];
  for (const [name, make] of cases) {
    test(name, () => {
      const { grid, layout, context } = build(make().pattern);
      assert.equal(grid.kind, 'rows');
      for (const layer of context.graph.layers) {
        const cells = grid.cells.filter((cell) => cell.layer === layer.index);
        for (const id of layer.positions) {
          const cell = cells.find((candidate) => candidate.node === id);
          assert.ok(cell, `row ${layer.index}, ${id}: has a cell`);
          const top = layout.nodes.get(id).top;
          assert.ok(near(cell.center.x, top.x), `${id}: the cell centre is in the column of the position`);
          assert.ok(contains(cell.area, top), `${id}: the position lies inside its cell`);
        }
        // The cells of one row do not overlap.
        const areas = cells.map((cell) => cell.area).sort((a, b) => a.x0 - b.x0);
        areas.forEach((area, i) => assert.ok(i === 0 || area.x0 >= areas[i - 1].x1 - 1e-6, `row ${layer.index}: overlap`));
      }
    });
  }

  test('every symbol of a turned row sits in its own band, the turning chain included (PQW-946)', () => {
    const example = hdcRectangle({ rows: 3 });
    const { grid, layout } = build(example.pattern);
    const foundationTurning = new Set(example.turningChains[1]);
    for (const node of layout.nodes.values()) {
      // The FOUNDATION turning chain reaches across the row boundary: that is where the work starts.
      if (foundationTurning.has(node.id)) continue;
      const band = grid.bands.find((candidate) => candidate.layer === node.layer);
      assert.ok(contains(band.area, node.top), `${node.id} (row ${node.layer})`);
    }

    /*
     * The owner on v0.35.0: the bottom stitch of the 3 chains slides onto the
     * second row; lift it out so that it stands on its own. In the first row
     * sliding down makes sense, because the work starts there, but here the
     * third row is entirely separate.
     */
    const stack = example.turningChains[2];
    const own = grid.bands.find((candidate) => candidate.layer === 2);
    assert.ok(contains(own.area, layout.nodes.get(stack[0]).top), 'the bottom chain stitch is in its own band too');
    assert.ok(contains(own.area, layout.nodes.get(stack.at(-1)).top), 'and so is the top chain stitch');
  });

  test('nudging a stitch by hand leaves the grid where it was', () => {
    const { pattern, rows } = hdcRectangle({ rows: 2 });
    const moved = ok(setPinned(pattern, rows[1][0], { x: 5, y: -7 }));
    assert.deepEqual(build(moved).grid, build(pattern).grid);
  });

  test('the grid mirrors along with the mirrored view', () => {
    const { pattern } = hdcRectangle({ rows: 2 });
    const plain = build(pattern).grid;
    const mirrored = build(pattern, 'rows', { mirror: true }).grid;
    assert.ok(near(mirrored.bounds.minX, -plain.bounds.maxX));
    plain.cells.forEach((cell, i) => assert.ok(near(mirrored.cells[i].center.x, -cell.center.x)));
  });
});

describe('aiming on the grid', () => {
  test('a target of the working row is reachable both from the cell below it and from the one above', () => {
    const { grid, context } = build(hdcRectangle({ rows: 2 }).pattern);
    assert.equal(grid.layer, 3);
    const below = grid.cells.filter((cell) => cell.layer === 2);
    const above = grid.cells.filter((cell) => cell.layer === 3);
    assert.equal(above.length, context.slots.length);
    context.slots.forEach((_, i) => {
      const own = below.find((cell) => cell.slot === i);
      const up = above.find((cell) => cell.slot === i);
      assert.ok(own && up, `target ${i}`);
      assert.ok(near(own.center.x, up.center.x));
      assert.deepEqual(aim(grid, own.center), { kind: 'target', slot: i });
      assert.deepEqual(aim(grid, up.center), { kind: 'target', slot: i });
    });
  });

  test('clicking a cell of an earlier row yields a message, not a target', () => {
    const { grid } = build(hdcRectangle({ rows: 2 }).pattern);
    const old = grid.cells.find((cell) => cell.layer === 1);
    assert.deepEqual(aim(grid, old.center), { kind: 'refused', message: { code: 'aim-other-layer', data: { layer: 1, current: 3, shape: 'row' } } });
    // The article, the inflection and the word for a row belong to the UI; the Hungarian sentence is the current one.
    assert.equal(
      hu(aim(grid, old.center).message),
      'Ez a 2. sor egyik helye. Most a 4. sor készül: csak a 3. sor szemeibe horgolhatsz. Nem került le szem.',
    );
    const foundation = grid.cells.find((cell) => cell.layer === 0);
    // In rows layer 0 is called „az 1. sor” (PQW-923: the foundation chain is row 1); in rounds it is the magic ring.
    assert.deepEqual(aim(grid, foundation.center).message.data, { layer: 0, current: 3, shape: 'row', start: 'chain' });
    assert.match(hu(aim(grid, foundation.center).message), /^Ez az 1\. sor egyik helye\. Most a 4\. sor készül/);
  });

  test('the bottom stitch of the turning chain is no target, but its top is (PQW-944)', () => {
    // In the V-stitch pattern the turning chain explicitly does not count.
    const example = vStitchPattern();
    const { grid, layout } = build(example.pattern);
    assert.equal(grid.layer, 3);
    /*
     * Since PQW-931 the bottom stitch of the turning chain hangs into the band
     * of the row BELOW it, so a click reports that row's context — not a target,
     * but it does say which row it is in. That is more precise than the earlier
     * blanket refusal, and the point is unchanged: you cannot crochet here.
     */
    const chain = layout.nodes.get(example.turningChains[2][0]).top;
    const hit = gridHit(grid, chain);
    // The turned row's chain sits in its OWN band (PQW-946), but its cell is still no target.
    assert.equal(aimAt(grid, hit).kind, 'refused');
    assert.equal(aimAt(grid, hit).message.code, 'aim-not-target');

    // The TOP of the turning chain is a target (PQW-944): the last stitch of the next row goes there.
    const counting = hdcRectangle({ rows: 2 });
    const built = build(counting.pattern);
    const top = counting.turningChains[2].at(-1);
    const slot = built.context.slots.findIndex((candidate) => candidate.id === top);
    assert.ok(slot >= 0, 'the top of the turning chain is among the targets');
  });

  test('in a half-finished row, where nothing sits below, there is nothing to crochet into', () => {
    // A non-counting turning chain set explicitly: in rows it counts by default and stands above the skipped stitch (PQW-891).
    const empty = emptyPattern();
    let pattern = ok(work({ ...empty, conventions: { ...empty.conventions, turningChainCounts: false } }, { def: 'ch', count: 7 }, 0));
    for (let slot = 1; slot <= 6; slot += 1) pattern = ok(work(pattern, { def: 'sc', count: 1 }, slot));
    pattern = ok(endRow(pattern));
    // Here the turning chain is not a stitch, so it takes no stitch's place: the crocheter places it herself (PQW-944).
    pattern = ok(work(pattern, { def: 'ch', count: 1 }, 0));
    pattern = ok(work(pattern, { def: 'sc', count: 1 }, 0));

    const { grid, layout, context } = build(pattern);
    assert.equal(grid.layer, 2);
    // Row 2's non-counting turning chain stands outside, next to the first stitch of the row: there is no target below it.
    /*
     * The turned row's chain sits in its own band (PQW-946), at the start of the
     * row, where the row below has no stitch: there is nothing to crochet into.
     */
    const chain = layout.nodes.get(context.graph.layers[2].turningChain[0]).top;
    assert.deepEqual(aim(grid, chain), { kind: 'refused', message: { code: 'aim-no-stitch' } });
    // Even in a half-finished row the target cells point at the targets.
    const cells = grid.cells.filter((cell) => cell.layer === 2);
    assert.deepEqual(cells.map((cell) => cell.slot).sort((a, b) => a - b), context.slots.map((_, i) => i));
  });

  test('no hit outside the grid, and an empty pattern has no grid at all', () => {
    const { grid } = build(hdcRectangle({ rows: 1 }).pattern);
    assert.equal(gridHit(grid, { x: grid.bounds.maxX + 50, y: 0 }), null);
    const empty = build(emptyPattern()).grid;
    assert.deepEqual([empty.bands.length, empty.cells.length], [0, 0]);
  });
});

describe('bands and lines', () => {
  test('alternating row tones stacked without gaps, with the 5th and 10th line emphasised', () => {
    const { grid } = build(hdcRectangle({ rows: 11 }).pattern);
    const bands = [...grid.bands].sort((a, b) => a.layer - b.layer);
    assert.deepEqual(bands.map((band) => band.layer), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    assert.deepEqual(bands.filter((band) => band.working).map((band) => band.layer), [12]);
    bands.forEach((band, i) => {
      assert.equal(band.tone, band.layer % 2);
      assert.ok(band.area.y0 < band.area.y1);
      // y decreases upwards: the bottom of a band is the top of the band below it.
      if (i > 0) assert.ok(near(band.area.y1, bands[i - 1].area.y0), `band ${band.layer}`);
    });
    assert.deepEqual(
      bands.filter((band) => band.emphasis !== 'none').map((band) => [band.layer, band.emphasis]),
      [[5, 'five'], [10, 'ten']],
    );
    assert.deepEqual([0, 4, 5, 10, 15, 20].map(emphasisOf), ['none', 'none', 'five', 'ten', 'five', 'ten']);
  });

  test('cells are counted from the start of the row: row 1 runs right to left, with an emphasised line after every 5th cell', () => {
    const { grid } = build(hdcRectangle({ rows: 2 }).pattern);
    const row1 = grid.cells.filter((cell) => cell.layer === 1).sort((a, b) => a.index - b.index);
    // 15 half double crochets plus the column of the turning chain (PQW-944).
    assert.equal(row1.length, 16);
    assert.ok(row1.every((cell, i) => i === 0 || cell.center.x < row1[i - 1].center.x));
    assert.deepEqual(row1.filter((cell) => cell.emphasis !== 'none').map((cell) => [cell.index + 1, cell.emphasis]), [
      [5, 'five'],
      [10, 'ten'],
      [15, 'five'],
    ]);
    const row2 = grid.cells.filter((cell) => cell.layer === 2).sort((a, b) => a.index - b.index);
    assert.ok(row2[0].center.x < row2[1].center.x, 'row 2 runs left to right');
  });
});

describe('the grid by pattern kind', () => {
  test('concentric grid: one annulus per round, with cells at the positions of the round', () => {
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
        assert.ok(cell, `round ${layer.index}, ${id}`);
        assert.ok(contains(cell.area, layout.nodes.get(id).top), `${id}: the position lies inside its cell`);
      }
    }
    // The magic ring is one single, full-circle cell.
    const ring = grid.cells.filter((cell) => cell.layer === 0);
    assert.equal(ring.length, 1);
    assert.deepEqual(ring[0].center, { x: 0, y: 0 });
    // The targets of the working round are reachable from the sectors as well.
    context.slots.forEach((_, i) => {
      const up = grid.cells.find((cell) => cell.layer === grid.layer && cell.slot === i);
      assert.deepEqual(aim(grid, up.center), { kind: 'target', slot: i });
    });
    const inner = grid.cells.find((cell) => cell.layer === 1);
    assert.deepEqual(aim(grid, inner.center).message.data, { layer: 1, current: 4, shape: 'round' });
    assert.match(hu(aim(grid, inner.center).message), /^Ez az 1\. kör egyik helye\. Most a 4\. kör készül: csak a 3\. kör szemeibe/);
  });

  test('after a magic ring the target is the ring itself: the working round is one full ring', () => {
    const pattern = ok(work(emptyPattern(), { def: 'magic-ring', count: 1 }, 0));
    const { grid } = build(pattern, 'rounds');
    const working = grid.cells.filter((cell) => cell.layer === 1);
    assert.equal(working.length, 1);
    const { area } = working[0];
    assert.deepEqual([area.a0, area.a1], [0, 2 * Math.PI]);
    assert.deepEqual(aim(grid, { x: 0, y: -(area.r0 + area.r1) / 2 }), { kind: 'target', slot: 0 });
  });

  test('polygon grid (PQW-888): the rings follow the polygon outline, the cells sit at the positions, and the bounds reach the vertices', () => {
    const granny = ok(generateMotif(emptyPattern(), { ...DEFAULT_MOTIF, shape: 'granny-square', rounds: 3 }));
    const { grid, layout, context } = build(granny, 'rounds');
    for (const band of grid.bands) assert.equal(band.area.frame?.sides, 4, `band ${band.layer}`);
    for (const layer of context.graph.layers) {
      for (const id of layer.positions) {
        const cell = grid.cells.find((candidate) => candidate.layer === layer.index && candidate.node === id);
        assert.ok(cell, `round ${layer.index}, ${id}`);
        assert.ok(contains(cell.area, layout.nodes.get(id).top), `${id}: the position lies inside its cell`);
      }
    }
    // The corner lies inside the square band; in a circular annulus it would fall outside.
    const band = grid.bands.find((candidate) => candidate.layer === 3).area;
    const corner = framePoint(band.frame, (band.r0 + band.r1) / 2, band.frame.corner);
    assert.ok(contains(band, corner));
    assert.ok(!contains({ ...band, frame: undefined }, corner));

    // A hexagon with a horizontal top edge: the bounding box reaches the vertex at the sides and the edge at the top.
    const hexagon = ok(generateMotif(emptyPattern(), { ...DEFAULT_MOTIF, shape: 'hexagon', rounds: 2 }));
    const hex = build(hexagon, 'rounds').grid;
    const outer = Math.max(...hex.bands.map((candidate) => candidate.area.r1));
    assert.ok(near(hex.bounds.maxX, outer / Math.cos(Math.PI / 6)));
    assert.ok(near(-hex.bounds.minY, outer));
  });

  test('the chart bounds are the union of the drawing and the enabled grid (PQW-887)', () => {
    const { grid, layout } = build(grannySquare().pattern, 'rounds');
    assert.ok(grid.bounds.minY < layout.bounds.minY, 'with the band of the working round the grid is larger than the drawing');
    assert.deepEqual(chartBounds(layout, grid), {
      minX: Math.min(layout.bounds.minX, grid.bounds.minX),
      minY: Math.min(layout.bounds.minY, grid.bounds.minY),
      maxX: Math.max(layout.bounds.maxX, grid.bounds.maxX),
      maxY: Math.max(layout.bounds.maxY, grid.bounds.maxY),
    });
    assert.deepEqual(chartBounds(layout, null), layout.bounds, 'with the grid off, the drawing bounds stand');
    assert.deepEqual(chartBounds(layout, { ...grid, bands: [] }), layout.bounds, 'with an empty grid, the drawing bounds stand');
  });

  test('cell grid (filet base): cells of equal width; text view (amigurumi): no grid', () => {
    const { pattern } = hdcRectangle({ rows: 2 });
    const cells = build(pattern, 'cells').grid;
    assert.equal(cells.kind, 'cells');
    assert.ok(cells.cells.every((cell) => near(cell.area.x1 - cell.area.x0, 24)));
    const text = build(pattern, 'text').grid;
    assert.equal(text.kind, 'text');
    assert.deepEqual([text.bands.length, text.cells.length], [0, 0]);
  });
});

test('the definite article before a number written in digits: az 1., a 2., az 5., az 50.', () => {
  const cases = { 0: 'a', 1: 'az', 2: 'a', 5: 'az', 10: 'a', 15: 'a', 50: 'az', 59: 'az', 100: 'a', 501: 'az', 1000: 'az', 2000: 'a', 5000: 'az' };
  for (const [n, expected] of Object.entries(cases)) assert.equal(article(Number(n)), expected, n);
  assert.throws(() => article(-1), RangeError);
});

/*
 * One single cell for the vertical turning chain (PQW-943).
 *
 * The owner's report: in row 2, where the vertical chain stitch at the end of
 * row 1 sits, there are two cells and there should be one. The stitches of the
 * turning chain stand above each other, yet they appear as separate targets;
 * projected onto the horizontal, that is what tore the cell apart.
 *
 * Her other request belongs here too: when the first stitch of the row is taller
 * than the rest (a larger loop at the end of the row), the cell height of row 2
 * should match the tallest one — the band must not cut into the chain.
 */
describe('the vertical turning chain gets one cell (PQW-943)', () => {
  /** `chains` chain stitches, a turn, then one `tool` into target `cursor`. */
  const started = (chains, tool, cursor) => {
    let pattern = ok(work(emptyPattern(), { def: 'ch', count: chains }, 0));
    pattern = ok(endRow(pattern));
    pattern = ok(work(pattern, { def: tool, count: 1 }, cursor));
    const library = libraryFor(pattern);
    const context = contextOf(pattern);
    const layout = layoutPattern(pattern, library, {});
    return { grid: chartGrid(pattern, library, 'rows', context, {}), layout, context, pattern, library };
  };
  /** The cells of the working row, in the order of the drawing. */
  const rowCells = (grid, layer) => grid.cells.filter((cell) => cell.layer === layer);

  test('a two-chain turning chain gets one cell, not two', () => {
    const { grid, context } = started(10, 'sc', 2);
    const turning = new Set(context.graph.layers[1].turningChain);
    const onChain = rowCells(grid, 1).filter((cell) => cell.slot !== null && turning.has(context.slots[cell.slot].id));
    assert.equal(onChain.length, 1, 'a single cell stands in the column of the turning chain');
    assert.ok(onChain[0].area.x1 - onChain[0].area.x0 > 20, `the cell is full width: ${onChain[0].area.x1 - onChain[0].area.x0}`);
  });

  test('a four-chain turning chain still gets one cell, and no cell collapses to zero width', () => {
    const { grid, context } = started(10, 'sc', 4);
    assert.equal(context.graph.layers[1].turningChain.length, 4);
    const cells = rowCells(grid, 1);
    for (const cell of cells) assert.ok(cell.area.x1 - cell.area.x0 > 0, `cell ${cell.index} is not zero wide`);
    const turning = new Set(context.graph.layers[1].turningChain);
    assert.equal(cells.filter((cell) => cell.slot !== null && turning.has(context.slots[cell.slot].id)).length, 1);
  });

  test('a taller turning chain lifts the top of the band instead of sticking out of it', () => {
    const { grid, layout, context } = started(10, 'sc', 4);
    const band = grid.bands.find((candidate) => candidate.layer === 1);
    const tops = context.graph.layers[1].turningChain.map((id) => layout.nodes.get(id).top.y);
    assert.ok(band.area.y0 < Math.min(...tops), `the band top (${band.area.y0}) is above the chain (${Math.min(...tops)})`);
    for (const cell of rowCells(grid, 1)) assert.equal(cell.area.y0, band.area.y0, 'the cells grow taller together with the band');
  });

  test('the turning chain does not pull the band downwards: the foundation band stays put', () => {
    const { grid } = started(10, 'sc', 4);
    const base = grid.bands.find((candidate) => candidate.layer === 0);
    const row = grid.bands.find((candidate) => candidate.layer === 1);
    assert.equal(row.area.y1, base.area.y0, 'the two bands meet exactly, without overlapping');
  });
});

/*
 * The insertion point on the grid (PQW-941): the line between two cells of the
 * foundation chain. The owner's choice: she clicks between two stitches.
 */
describe('foundation cell boundaries for insertion (PQW-941)', () => {
  const started = () => {
    let pattern = ok(work(emptyPattern(), { def: 'ch', count: 8 }, 0));
    pattern = ok(endRow(pattern));
    return ok(work(pattern, { def: 'sc', count: 1 }, contextOf(pattern).slots.length - 6));
  };

  test('on the line between two cells it returns both neighbours', () => {
    const pattern = started();
    const { grid } = build(pattern);
    const cells = grid.cells.filter((cell) => cell.layer === 0).sort((a, b) => a.area.x0 - b.area.x0);
    const boundary = { x: cells[1].area.x1, y: (grid.bands[0].area.y0 + grid.bands[0].area.y1) / 2 };
    const seam = seamAt(grid, boundary);
    assert.ok(seam, 'the boundary line is an insertion point');
    assert.equal(seam.left, cells[1].node);
    assert.equal(seam.right, cells[2].node);
  });

  test('at either end of the chain one of the neighbours is missing', () => {
    const pattern = started();
    const { grid } = build(pattern);
    const cells = grid.cells.filter((cell) => cell.layer === 0).sort((a, b) => a.area.x0 - b.area.x0);
    const y = (grid.bands[0].area.y0 + grid.bands[0].area.y1) / 2;
    assert.deepEqual(
      [seamAt(grid, { x: cells[0].area.x0, y }).left, seamAt(grid, { x: cells.at(-1).area.x1, y }).right],
      [null, null],
    );
  });

  test('there is no insertion point at a cell centre, nor in another row', () => {
    const pattern = started();
    const { grid } = build(pattern);
    const cells = grid.cells.filter((cell) => cell.layer === 0).sort((a, b) => a.area.x0 - b.area.x0);
    const y = (grid.bands[0].area.y0 + grid.bands[0].area.y1) / 2;
    assert.equal(seamAt(grid, { x: cells[1].center.x, y }), null, 'not at the cell centre');
    const above = grid.bands.find((band) => band.layer === 1);
    assert.equal(seamAt(grid, { x: cells[1].area.x1, y: (above.area.y0 + above.area.y1) / 2 }), null, 'not in row 2');
  });
});

/*
 * PQW-951: the chain space gets cells of its own. The owner: if more cells are
 * needed, then so be it — it is just that there are 3 below and 5 above.
 */
describe('the cells of a chain space (PQW-951)', () => {
  const arcPattern = () => {
    let pattern = ok(work(emptyPattern(), { def: 'ch', count: 24 }, 0));
    pattern = ok(endRow(pattern));
    pattern = ok(work(pattern, { def: 'sc', count: 1 }, 0));
    pattern = ok(work(pattern, { def: 'ch', count: 5 }, 1));
    return ok(work(pattern, { def: 'sc', count: 1 }, 4));
  };
  const rowCells = (grid, layer) => grid.cells.filter((cell) => cell.layer === layer);

  test('the 5 chain stitches get 5 cells over the 3 cells below, on the same span', () => {
    const pattern = arcPattern();
    const { grid } = build(pattern);
    const stitches = rowCells(grid, 1).filter((cell) => cell.node !== null && cell.slot !== null);
    const arc = rowCells(grid, 1).slice(1, 6);
    assert.equal(arc.length, 5);
    assert.ok(
      arc.every((cell) => cell.node !== null),
      'all five cells have a stitch',
    );
    // They divide the span between the two anchored stitches; three stitches sit below it.
    const below = rowCells(grid, 0).slice(1, 4);
    assert.ok(near(arc[0].area.x1, below[0].area.x1) || arc[0].area.x1 <= below[0].area.x1 + 24, 'the span does not grow');
    const widths = arc.map((cell) => cell.area.x1 - cell.area.x0);
    assert.ok(
      widths.every((width) => width < below[0].area.x1 - below[0].area.x0),
      `the arc cells are narrower than the ones below them: ${widths}`,
    );
    assert.ok(stitches.length >= 7, 'every symbol of the row got a cell');
  });

  test('the order of the cells and their targets do not get scrambled', () => {
    const { grid } = build(arcPattern());
    const cells = rowCells(grid, 1);
    const slots = cells.map((cell) => cell.slot).filter((slot) => slot !== null);
    assert.deepEqual(
      slots,
      [...slots].sort((a, b) => a - b),
      `the targets increase along the row: ${slots}`,
    );
    const widths = cells.map((cell) => cell.area.x1 - cell.area.x0);
    assert.ok(Math.min(...widths) > 5, `no degenerate cell: ${Math.min(...widths)}`);
  });

  test('the band of the working row is no wider than the foundation band', () => {
    const { grid } = build(arcPattern());
    const base = grid.bands.find((band) => band.layer === 0);
    const row = grid.bands.find((band) => band.layer === 1);
    assert.ok(row.area.x1 <= base.area.x1 + 1e-6 && row.area.x0 >= base.area.x0 - 1e-6, 'the band stays within the foundation');
  });

  test('a stitch bridged under the arc gets no empty cell even in a closed row, while an unworked row end does', () => {
    const pattern = ok(endRow(arcPattern()));
    const { grid } = build(pattern);
    const piece = pattern.pieces[0];
    // The bridged stitches between the two single crochets: the arc runs above them.
    const worked = new Set(piece.stitches.flatMap((stitch) => stitch.anchors.map((anchor) => anchor.id)));
    const base = piece.stitches.filter((stitch) => stitch.def === 'ch').map((stitch) => stitch.id).slice(0, 24);
    const marks = base.map((id, index) => (worked.has(id) ? index : -1)).filter((index) => index >= 0);
    const inside = new Set(base.filter((id, index) => index > marks[0] && index < marks.at(-1) && piece.skipped.includes(id)));
    assert.ok(inside.size === 3, `the arc bridges three stitches: ${inside.size}`);
    const gaps = rowCells(grid, 1).filter((cell) => cell.gap !== null);
    assert.ok(
      gaps.every((cell) => !inside.has(cell.gap)),
      'the stitches under the arc are not gaps',
    );
    assert.ok(gaps.length > 0, 'but the unworked stitches at the end of the row are');
  });
});
