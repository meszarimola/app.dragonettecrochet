/*
 * Curved and bent rows (PQW-893): the rows of a semicircle and a crescent lie
 * on an arc and span the neck angle; the two halves of a top-down triangle
 * meet at the spine at the angle the design calls for; feet land on their
 * targets; a new row does not move the earlier ones; mirroring, the
 * true-to-proportion view, the bands of the grid and hit testing; and saving.
 * Every other drawing (flat shapes, hand-worked rows, rounds, filet) keeps the
 * digest it had on develop before PQW-893 (`5fd2292`).
 */

import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import { contextOf, emptyPattern } from '../src/core/editor.ts';
import { generateFilet } from '../src/core/filet.ts';
import { chartBounds, chartGrid, gridHit } from '../src/core/grid.ts';
import { layoutPattern } from '../src/core/layout.ts';
import { loadPattern, savePattern } from '../src/core/pattern-json.ts';
import { DEFAULT_MOTIF, generateMotif } from '../src/core/round-generator.ts';
import { rowCurve } from '../src/core/row-curve.ts';
import { DEFAULT_SHAPE, generateShape } from '../src/core/shapes.ts';
import { DEFAULT_SHAWL, generateShawl } from '../src/core/shawls.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { gridPaths } from '../src/ui/grid-paths.ts';
import { chevron, dcRectangle, grannySquare, hdcRectangle, shellStitch, vStitchPattern, wave } from './fixtures/examples.ts';

const ok = (result) => {
  assert.ok(result.ok, result.reason);
  return result.pattern;
};
const degrees = (radians) => (radians * 180) / Math.PI;
const near = (actual, expected, tolerance, name) => assert.ok(Math.abs(actual - expected) <= tolerance, `${name}: ${actual} ≉ ${expected}`);

/** A pattern with a profile whose stitch, measured flat, has the given stitches and rows over 10 cm. */
function withGauge(stitch, stitchesPer10cm, rowsPer10cm) {
  const profile = {
    id: 'kendo',
    yarn: { name: 'Merinó', cycWeight: 1, metersPer100g: null, ballMassG: null },
    hookMm: 3.5,
    blocked: true,
    gauges: [{ stitch, form: 'rows', stitchesPer10cm, rowsPer10cm, source: 'measured' }],
    swatch: { widthCm: null, heightCm: null, massG: null },
  };
  return { ...emptyPattern(), gauge: { active: 'kendo', profiles: [profile] } };
}

const shawl = (patch, pattern = emptyPattern()) => ok(generateShawl(pattern, { ...DEFAULT_SHAWL, ...patch }));
const nodesOf = (layout, layer) => [...layout.nodes.values()].filter((node) => node.layer === layer);
const rowsOf = (pattern) => pattern.pieces[0].events.length;
/** The centre of the mapping, taken from the straight layout, as layout.ts does it. */
const centerOf = (pattern, options = {}) => rowCurve(layoutPattern(pattern, libraryFor(pattern), { ...options, straight: true }), pattern.pieces[0].rowShape).center;
/** The angle of a point seen from the centre of the dome, measured from the vertical. */
const angleOf = (p, center) => degrees(Math.atan2(p.x - center, -p.y));

describe('every other drawing stays the same (regression)', () => {
  const expected = JSON.parse(readFileSync(new URL('./fixtures/layout-digests.json', import.meta.url), 'utf8'));
  const patterns = {
    hdcRectangle: [hdcRectangle().pattern, 'rows'],
    dcRectangle: [dcRectangle().pattern, 'rows'],
    shell: [shellStitch().pattern, 'rows'],
    vStitch: [vStitchPattern().pattern, 'rows'],
    chevron: [chevron().pattern, 'rows'],
    wave: [wave().pattern, 'rows'],
    granny: [grannySquare().pattern, 'rounds'],
    ...Object.fromEntries(
      ['rectangle', 'right-triangle', 'isosceles-triangle', 'trapezoid', 'diamond'].map((shape) => [
        `shape-${shape}`,
        [ok(generateShape(emptyPattern(), { ...DEFAULT_SHAPE, shape, stitch: 'dc', widthCm: 15, heightCm: 12, topWidthCm: 5 })), 'rows'],
      ]),
    ),
    ...Object.fromEntries(
      ['circle', 'hexagon', 'granny-square'].map((shape) => [`motif-${shape}`, [ok(generateMotif(emptyPattern(), { ...DEFAULT_MOTIF, shape, rounds: 5 })), 'rounds']]),
    ),
    filet: [ok(generateFilet(emptyPattern(), { cells: [[1, 0, 1], [0, 1, 0], [1, 1, 1]], unit: null, lettering: false })), 'cells'],
    ...Object.fromEntries(
      ['stole', 'asymmetric-triangle', 'circle', 'pi'].map((kind) => [
        `shawl-${kind}`,
        [shawl({ kind, stitch: 'sc', sizeCm: 6, lengthCm: 6 }), kind === 'circle' || kind === 'pi' ? 'rounds' : 'rows'],
      ]),
    ),
  };
  const views = { plain: {}, mirror: { mirror: true }, aspect: { stemLength: (chainHeight) => 6 + 12 * chainHeight, columnWidth: 30 } };
  const clean = (value) => {
    if (typeof value === 'number') {
      const rounded = Math.round(value * 1e4) / 1e4;
      return Object.is(rounded, -0) ? 0 : rounded;
    }
    if (typeof value === 'function') return undefined;
    if (value instanceof Map) return [...value.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, item]) => [key, clean(item)]);
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, clean(value[key])]));
    return value;
  };
  const digest = (value) => createHash('sha256').update(JSON.stringify(clean(value))).digest('hex').slice(0, 16);

  for (const [name, [pattern, kind]] of Object.entries(patterns)) {
    test(`${name}: layout and grid match the pre-PQW-893 result in the plain, mirrored and true-to-proportion views`, () => {
      const library = libraryFor(pattern);
      assert.equal(pattern.pieces[0].rowShape, undefined);
      for (const [view, options] of Object.entries(views)) {
        assert.equal(digest(layoutPattern(pattern, library, options)), expected[`${name}/${view}/layout`], `${view} layout`);
        const grid = chartGrid(pattern, library, kind, contextOf(pattern), options);
        assert.equal(digest({ bands: grid.bands, cells: grid.cells, bounds: grid.bounds, shape: grid.shape }), expected[`${name}/${view}/grid`], `${view} grid`);
      }
    });
  }
});

describe('semicircle and crescent on an arc (05 §1.2, §1.6)', () => {
  test('semicircle: the last row sits on a single radius and spans 180°', () => {
    const pattern = shawl({ kind: 'semicircle', stitch: 'dc', sizeCm: 15 });
    assert.deepEqual(pattern.pieces[0].rowShape, { kind: 'arc', neckAngle: 180 });
    const layout = layoutPattern(pattern, libraryFor(pattern));
    const center = centerOf(pattern);
    const last = nodesOf(layout, rowsOf(pattern));
    const radii = last.filter((node) => node.role === 'stitch').map((node) => Math.hypot(node.top.x - center, node.top.y));
    assert.ok(Math.max(...radii) / Math.min(...radii) < 1.03, `${Math.min(...radii)}–${Math.max(...radii)}`);
    // The tops of the stitches; the turning chain stands below the top line of the row, on a smaller radius.
    const angles = last.filter((node) => node.role === 'stitch').map((node) => angleOf(node.top, center));
    near(Math.max(...angles) - Math.min(...angles), 180, 3, 'spanned angle');
    // The dome sits above the neck point, so the stitches are above the horizontal; the row shifts toward the turning chain, so its end may fall a few degrees below.
    const radius = Math.max(...radii);
    assert.ok(last.filter((node) => node.role === 'stitch').every((node) => node.top.y < 0.1 * radius));
  });

  test('crescent: the arc spans the neck angle of the design, smaller than the one of a semicircle', () => {
    const pattern = shawl({ kind: 'crescent', stitch: 'sc', sizeCm: 8 });
    const { kind, neckAngle } = pattern.pieces[0].rowShape;
    assert.equal(kind, 'arc');
    assert.ok(neckAngle > 90 && neckAngle < 180, String(neckAngle));
    const layout = layoutPattern(pattern, libraryFor(pattern));
    const center = centerOf(pattern);
    const angles = nodesOf(layout, rowsOf(pattern))
      .filter((node) => node.role === 'stitch')
      .map((node) => angleOf(node.top, center));
    near(Math.max(...angles) - Math.min(...angles), neckAngle, 4, 'spanned angle');
  });

  // Near the centre, in the first rows, the stem at the end of a row runs at a slant on a small radius, so we do not
  // measure there. Further out the stem at the end of a row leans by at most three quarters of a column (most of all
  // for a stitch worked into the top of the turning chain).
  test('from row 4 on the feet sit on top of their targets: the gap is at most three quarters of a column wider than in the straight drawing', () => {
    for (const pattern of [shawl({ kind: 'semicircle', stitch: 'dc', sizeCm: 15 }), shawl({ kind: 'triangle', stitch: 'hdc', sizeCm: 12 })]) {
      const library = libraryFor(pattern);
      const [curved, straight] = [layoutPattern(pattern, library), layoutPattern(pattern, library, { straight: true })];
      const gap = (layout, stitch, anchor, i) => {
        const [foot, target] = [layout.nodes.get(stitch.id).feet[i], layout.nodes.get(anchor.id).top];
        return Math.hypot(foot.x - target.x, foot.y - target.y);
      };
      for (const stitch of pattern.pieces[0].stitches) {
        if (curved.nodes.get(stitch.id).role !== 'stitch' || curved.nodes.get(stitch.id).layer < 4) continue;
        stitch.anchors.forEach((anchor, i) => {
          if (anchor.into !== 'stitch' || curved.nodes.get(anchor.id).layer === 0) return;
          const [bent, flat] = [gap(curved, stitch, anchor, i), gap(straight, stitch, anchor, i)];
          assert.ok(bent <= flat + 18, `the foot of ${stitch.id} is ${bent.toFixed(1)} units from its target (straight: ${flat.toFixed(1)})`);
        });
      }
    }
  });

  test('a new row does not move the rows that came before it (06 §5.3)', () => {
    const pattern = shawl({ kind: 'semicircle', stitch: 'sc', sizeCm: 6 });
    const piece = pattern.pieces[0];
    // Without the last row: stitches up to the last turn, events including that turn.
    const turn = piece.events.findLast((event) => event.kind === 'turn');
    const cut = piece.stitches.findIndex((node) => node.id === turn.after) + 1;
    const shorter = { ...pattern, pieces: [{ ...piece, stitches: piece.stitches.slice(0, cut), groups: piece.groups.filter((group) => group.members.every((id) => piece.stitches.slice(0, cut).some((node) => node.id === id))), events: piece.events.slice(0, piece.events.indexOf(turn) + 1) }] };
    const [full, partial] = [layoutPattern(pattern, libraryFor(pattern)), layoutPattern(shorter, libraryFor(shorter))];
    for (const [id, node] of partial.nodes) {
      const before = full.nodes.get(id);
      near(node.top.x, before.top.x, 1e-6, `${id} x`);
      near(node.top.y, before.top.y, 1e-6, `${id} y`);
    }
  });

  test('in mirrored view the drawing flips horizontally, and in true-to-proportion view it is still a semicircle', () => {
    const pattern = shawl({ kind: 'semicircle', stitch: 'dc', sizeCm: 12 });
    const library = libraryFor(pattern);
    const [plain, mirrored] = [layoutPattern(pattern, library), layoutPattern(pattern, library, { mirror: true })];
    for (const [id, node] of plain.nodes) {
      near(mirrored.nodes.get(id).top.x, -node.top.x, 1e-6, `${id} x`);
      near(mirrored.nodes.get(id).top.y, node.top.y, 1e-6, `${id} y`);
    }
    const aspect = { stemLength: (chainHeight) => 4 + 20 * chainHeight };
    const layout = layoutPattern(pattern, library, aspect);
    const center = centerOf(pattern, aspect);
    const angles = nodesOf(layout, rowsOf(pattern))
      .filter((node) => node.role === 'stitch')
      .map((node) => angleOf(node.top, center));
    near(Math.max(...angles) - Math.min(...angles), 180, 3, 'spanned angle in true-to-proportion view');
  });
});

describe('a top-down triangle bent at the spine (05 §1.4)', () => {
  test('at the gauge of worked example „A” the two halves meet at a right angle at the spine, and the neck edge is horizontal', () => {
    const pattern = shawl({ kind: 'triangle', stitch: 'dc', sizeCm: 20 }, withGauge('dc', 16, 8));
    assert.deepEqual(pattern.pieces[0].rowShape, { kind: 'chevron', neckAngle: 180, tipAngle: 90 });
    const layout = layoutPattern(pattern, libraryFor(pattern));
    const center = centerOf(pattern);
    const last = nodesOf(layout, rowsOf(pattern)).filter((node) => node.role === 'stitch');
    const spine = last.reduce((best, node) => (Math.abs(node.top.x - center) < Math.abs(best.top.x - center) ? node : best));
    const [left, right] = [last.reduce((a, b) => (b.top.x < a.top.x ? b : a)), last.reduce((a, b) => (b.top.x > a.top.x ? b : a))];
    const toward = (node) => [node.top.x - spine.top.x, node.top.y - spine.top.y];
    const [a, b] = [toward(left), toward(right)];
    const angle = degrees(Math.acos((a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b))));
    near(angle, 90, 3, 'angle between the two halves');
    // The spine points up, and the two ends of the row sit low, at the same height.
    assert.ok(spine.top.y < left.top.y && spine.top.y < right.top.y);
    near(left.top.y, right.top.y, 0.1 * Math.abs(spine.top.y - left.top.y), 'height of the two ends');
  });

  test('the stole, the asymmetric triangle and the shawls worked in the round stay straight or circular', () => {
    for (const kind of ['stole', 'asymmetric-triangle', 'circle', 'pi']) {
      assert.equal(shawl({ kind, stitch: 'sc', sizeCm: 6, lengthCm: 6 }).pieces[0].rowShape, undefined, kind);
    }
  });
});

describe('the grid over a curved drawing', () => {
  for (const kind of ['semicircle', 'crescent', 'triangle']) {
    test(`${kind}: bands and cells are curved strips; the centre of every cell hits its own cell; the bounds enclose both the drawing and the grid`, () => {
      const pattern = shawl({ kind, stitch: 'sc', sizeCm: 8 });
      const library = libraryFor(pattern);
      const context = contextOf(pattern);
      const grid = chartGrid(pattern, library, 'rows', context);
      assert.ok(grid.bands.length > 2);
      assert.ok(grid.bands.every((band) => band.area.kind === 'strip'));
      for (const cell of grid.cells) {
        const hit = gridHit(grid, cell.center);
        assert.ok(hit && hit.kind === 'cell' && hit.cell === cell, `row ${cell.layer}, cell ${cell.index}`);
      }
      const layout = layoutPattern(pattern, library);
      const bounds = chartBounds(layout, grid);
      for (const node of layout.nodes.values()) assert.ok(node.top.x >= bounds.minX && node.top.x <= bounds.maxX && node.top.y >= bounds.minY && node.top.y <= bounds.maxY);
      // The paths of the drawing: closed bands and lines.
      const paths = gridPaths(grid);
      assert.equal(paths.bands.length, grid.bands.length);
      assert.ok(paths.bands.every((band) => /^M[-\d.]+ [-\d.]+(L[-\d.]+ [-\d.]+)+Z$/.test(band.d)));
      assert.ok(paths.lines.length > grid.bands.length * 3);
    });
  }
});

describe('saving', () => {
  test('the row shape survives a JSON save, an invalid shape does not load, and an old save without a shape stays straight', () => {
    const pattern = shawl({ kind: 'triangle', stitch: 'dc', sizeCm: 10 }, withGauge('dc', 16, 8));
    const loaded = loadPattern(savePattern(pattern));
    assert.ok(loaded.ok);
    assert.deepEqual(loaded.pattern.pieces[0].rowShape, { kind: 'chevron', neckAngle: 180, tipAngle: 90 });
    for (const rowShape of [{ kind: 'spiral', neckAngle: 180 }, { kind: 'arc', neckAngle: 400 }, { kind: 'chevron', neckAngle: 180 }]) {
      const wrong = JSON.parse(savePattern(pattern));
      wrong.pieces[0].rowShape = rowShape;
      assert.equal(loadPattern(JSON.stringify(wrong)).ok, false, JSON.stringify(rowShape));
    }
    const old = JSON.parse(savePattern(pattern));
    delete old.pieces[0].rowShape;
    assert.equal(loadPattern(JSON.stringify(old)).pattern.pieces[0].rowShape, undefined);
  });
});
