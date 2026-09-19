/*
 * The computed layout (PQW-857): placement, direction, fanning, converging,
 * row numbering, right and wrong side, stability while editing, mirroring,
 * manual nudging; in a polygon the rounds follow the sides (PQW-888).
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import {
  contextOf,
  defaultCursor,
  deleteLast,
  emptyPattern,
  endRow,
  setPinned,
  work,
  workIntoSame,
} from '../src/core/editor.ts';
import { buildPieceGraph } from '../src/core/graph.ts';
import { isotonic, layoutPattern, ROW_GAP } from '../src/core/layout.ts';
import { frameCoords } from '../src/core/polygon.ts';
import { DEFAULT_MOTIF, generateMotif } from '../src/core/round-generator.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { editNode } from './fixtures/builder.ts';
import {
  chevron,
  dcRectangle,
  grannySquare,
  hdcRectangle,
  shellStitch,
  vStitchPattern,
  wave,
} from './fixtures/examples.ts';
import { testLibrary } from './fixtures/library.ts';

const layout = (pattern, options) => layoutPattern(pattern, testLibrary, options);
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
/** Foundation chain for the tests. */
const chains = (pattern, count) => ok(work(pattern, { def: 'ch', count }, 0));
const ok = (result) => {
  assert.ok(result.ok, result.reason);
  return result.pattern;
};

describe('rows', () => {
  const example = hdcRectangle({ rows: 3 });
  const chart = layout(example.pattern);
  const at = (id) => chart.nodes.get(id);

  test('a stitch stands in the column of the stitch below it, with a vertical stem (01 §8.4 szabály 18)', () => {
    for (let row = 2; row <= 3; row += 1) {
      // The row works into every stitch of the row below; the turning chain is not a target (PQW-924).
      const below = [...example.rows[row - 1]].reverse();
      example.rows[row].forEach((id, i) => {
        const node = at(id);
        assert.equal(node.role, 'stitch');
        assert.equal(node.feet.length, 1);
        assert.ok(near(node.feet[0].x, node.top.x), `${id} has a vertical stem`);
        assert.ok(near(node.top.x, at(below[i]).top.x), `${id} sits above its target`);
      });
    }
  });

  test('rows run bottom to top, alternating direction: row 1 goes right to left (01 §6.3)', () => {
    const xs = (row) => example.rows[row].map((id) => at(id).top.x);
    const decreasing = (values) => values.every((v, i) => i === 0 || v < values[i - 1]);
    assert.ok(decreasing(xs(1)));
    assert.ok(decreasing([...xs(2)].reverse()));
    assert.ok(decreasing(xs(3)));
    const y = (row) => at(example.rows[row][0]).top.y;
    assert.ok(y(1) > y(2) && y(2) > y(3));
    assert.ok(example.rows[1].every((id) => near(at(id).top.y, y(1))));
  });

  test('the row number sits at the start of the row and the stitch count at its end; the side of the rows alternates (03 §10 I42)', () => {
    const [, row1, row2, row3] = chart.layers;
    assert.ok(row1.start.x > row1.end.x);
    assert.ok(row2.start.x < row2.end.x);
    assert.deepEqual(
      chart.layers.map((layer) => [layer.index, layer.side, layer.stitchCount]),
      [
        [0, 'right', 0],
        [1, 'right', 15],
        [2, 'wrong', 15],
        [3, 'right', 15],
      ],
    );
    assert.ok(example.rows[2].every((id) => at(id).side === 'wrong'));
  });

  test('a turning chain that does not count stands vertically, outside the first stitch', () => {
    const [first] = example.rows[2];
    const chains = example.turningChains[2].map(at);
    assert.ok(chains.every((chain) => chain.role === 'chain' && near(chain.angle, Math.PI / 2)));
    assert.ok(chains.every((chain) => near(chain.top.x, chains[0].top.x)));
    // Row 2 runs left to right, so the turning chain sits to its left.
    assert.ok(near(chains[0].top.x, at(first).top.x - 24));
    assert.ok(chains[0].top.y > chains[1].top.y);
  });

  test('the turning chain stands outside, next to the first stitch of the row (PQW-924)', () => {
    /*
     * A turning chain is not a stitch, so it does not sit in the column of the
     * stitch below: every stitch of the row goes into one stitch of the row
     * below, while the turning chain lands outside the edge of the row.
     */
    const dc = dcRectangle({ rows: 3 });
    const dcChart = layout(dc.pattern);
    const chain = dcChart.nodes.get(dc.turningChains[2][2]);
    const xs = dc.rows[2].map((id) => dcChart.nodes.get(id).top.x);
    assert.ok(
      chain.top.x > Math.max(...xs) || chain.top.x < Math.min(...xs),
      'the turning chain stands outside the stitches of the row',
    );
  });

  test('row height comes from the tallest stitch; the symbols stand on a common baseline (03 §2.2)', () => {
    const w = wave({ repeats: 1 });
    const wChart = layout(w.pattern);
    const row1 = w.rows[1].map((id) => wChart.nodes.get(id));
    const feet = row1.map((node) => node.feet[0].y);
    assert.ok(feet.every((y) => near(y, feet[0])));
    const tops = row1.map((node) => node.top.y);
    const tallest = Math.min(...tops);
    assert.ok(tallest < Math.max(...tops));
    const row2Foot = wChart.nodes.get(w.rows[2][0]).feet[0].y;
    assert.ok(row2Foot < tallest);
  });
});

describe('fanning and converging', () => {
  test('the stems of a shell start from one foot and the tops open symmetrically around it (01 §6.1)', () => {
    const example = shellStitch({ repeats: 2 });
    const chart = layout(example.pattern);
    const shell = example.pattern.pieces[0].groups[0].members.map((id) => chart.nodes.get(id));
    const foot = shell[0].feet[0];
    assert.ok(shell.every((node) => near(node.feet[0].x, foot.x) && near(node.feet[0].y, foot.y)));
    const tops = shell.map((node) => node.top.x);
    assert.equal(new Set(tops.map((x) => x.toFixed(3))).size, 5);
    assert.ok(near(tops.reduce((a, b) => a + b, 0) / tops.length, foot.x, 1e-3));
  });

  test('the feet of a decrease sit in its targets and its top between them (01 §8.4 szabály 18)', () => {
    const example = chevron();
    const chart = layout(example.pattern);
    const valley = chart.nodes.get(example.valley.node);
    const targets = example.valley.targets.map((id) => chart.nodes.get(id).top.x);
    assert.deepEqual(
      valley.feet.map((foot) => foot.x.toFixed(3)),
      targets.map((x) => x.toFixed(3)),
    );
    assert.ok(valley.top.x > Math.min(...targets) && valley.top.x < Math.max(...targets));
  });

  test('a stitch worked into a chain space has its foot above the chains of that space (03 §4.4)', () => {
    const example = vStitchPattern({ repeats: 2 });
    const chart = layout(example.pattern);
    const piece = example.pattern.pieces[0];
    const node = piece.stitches.find((s) => s.anchors[0]?.into === 'space');
    const space = piece.spaces.find((s) => s.id === node.anchors[0].id);
    const chainX = space.chains.map((id) => chart.nodes.get(id).top.x);
    assert.ok(near(chart.nodes.get(node.id).feet[0].x, chainX.reduce((a, b) => a + b, 0) / chainX.length));
  });
});

test('in the round the symbols point radially outward, with the magic ring at the centre (01 §6.1)', () => {
  const example = grannySquare();
  const chart = layout(example.pattern);
  const ring = chart.nodes.get(example.rows[0][0]);
  assert.deepEqual([ring.role, ring.top], ['ring', { x: 0, y: 0 }]);
  const stitches = [...chart.nodes.values()].filter((node) => node.role === 'stitch');
  assert.ok(stitches.length > 0);
  for (const node of stitches) {
    const r = Math.hypot(node.top.x, node.top.y);
    assert.ok(r > Math.hypot(node.feet[0].x, node.feet[0].y), node.id);
  }
  // Round 2 works into the chain spaces: the foot sits between the chains of the space, at their real positions.
  const piece = example.pattern.pieces[0];
  for (const id of example.rows[2]) {
    const anchor = piece.stitches.find((s) => s.id === id).anchors[0];
    if (anchor?.into !== 'space') continue;
    const chains = piece.spaces.find((s) => s.id === anchor.id).chains.map((c) => chart.nodes.get(c).top);
    const foot = chart.nodes.get(id).feet[0];
    assert.ok(near(foot.x, chains.reduce((a, p) => a + p.x, 0) / chains.length), id);
    assert.ok(near(foot.y, chains.reduce((a, p) => a + p.y, 0) / chains.length), id);
  }
  const radius = (row) =>
    Math.max(...example.rows[row].map((id) => Math.hypot(chart.nodes.get(id).top.x, chart.nodes.get(id).top.y)));
  assert.ok(radius(1) < radius(2) && radius(2) < radius(3));
});

test('the layout does not jump while editing: deleting the last stitch leaves the earlier rows in place', () => {
  const { pattern, rows } = dcRectangle({ rows: 3 });
  let edited = pattern;
  for (let i = 0; i < 6; i += 1) edited = ok(deleteLast(edited));
  const before = layout(pattern);
  const after = layout(edited);
  for (const id of [...rows[0], ...rows[1], ...rows[2]])
    assert.deepEqual(after.nodes.get(id), before.nodes.get(id), id);
});

test('mirrored view: everything flips horizontally and the row number moves to the other side (01 §8.4 szabály 22)', () => {
  const { pattern } = hdcRectangle({ rows: 2 });
  const plain = layout(pattern);
  const mirrored = layout(pattern, { mirror: true });
  for (const [id, node] of plain.nodes) {
    const other = mirrored.nodes.get(id);
    assert.ok(near(other.top.x, -node.top.x) && near(other.top.y, node.top.y), id);
  }
  assert.ok(mirrored.layers[1].start.x < mirrored.layers[1].end.x);
  assert.ok(near(mirrored.bounds.minX, -plain.bounds.maxX));
});

test('manual nudge: the symbol and the feet of the stitches worked into it move, the columns do not', () => {
  const { pattern, rows } = hdcRectangle({ rows: 2 });
  const target = rows[1][0];
  const plain = layout(pattern);
  const moved = layout(ok(setPinned(pattern, target, { x: 3, y: -4 })));
  const t0 = plain.nodes.get(target).top;
  assert.deepEqual(moved.nodes.get(target).top, { x: t0.x + 3, y: t0.y - 4 });

  const above = [...pattern.pieces[0].stitches].find((node) => node.anchors[0]?.id === target);
  const f0 = plain.nodes.get(above.id).feet[0];
  assert.deepEqual(moved.nodes.get(above.id).feet[0], { x: f0.x + 3, y: f0.y - 4 });
  assert.deepEqual(moved.nodes.get(above.id).top, plain.nodes.get(above.id).top);
});

test('an empty pattern gives an empty layout', () => {
  const chart = layout(emptyPattern());
  assert.equal(chart.nodes.size, 0);
  assert.deepEqual(chart.layers, []);
});

describe('polygon (PQW-888)', () => {
  const W = 24;
  const DEGREE = Math.PI / 180;
  const motif = (patch) => {
    const pattern = ok(generateMotif(emptyPattern(), { ...DEFAULT_MOTIF, rounds: 6, ...patch }));
    const library = libraryFor(pattern);
    return {
      pattern,
      chart: layoutPattern(pattern, library),
      graph: buildPieceGraph(pattern, pattern.pieces[0], library),
    };
  };
  const angleOf = (p) => Math.atan2(-p.y, p.x);
  /** The difference of two angles, between −π and π. */
  const turn = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  /** The angles of the polygon corners: a horizontal top side. */
  const cornersOf = (n) => Array.from({ length: n }, (_, j) => Math.PI / 2 + Math.PI / n + (2 * Math.PI * j) / n);
  const cornerAt = (n, angle, eps) => cornersOf(n).findIndex((corner) => Math.abs(turn(angle, corner)) < eps);
  const stitchesIn = (chart, layer) =>
    [...chart.nodes.values()].filter((node) => node.layer === layer && node.role === 'stitch');
  const mean = (points) => ({
    x: points.reduce((s, p) => s + p.x, 0) / points.length,
    y: points.reduce((s, p) => s + p.y, 0) / points.length,
  });
  const lastRound = (chart) => Math.max(...[...chart.nodes.values()].map((node) => node.layer));

  test('granny square: the corner groups of round 3 sit in the four corners of the square and the side groups along its sides (03 §8)', () => {
    const { chart, graph } = motif({ shape: 'granny-square', rounds: 3 });
    assert.equal(chart.frame?.sides, 4);
    const inRound = (layer) =>
      graph.piece.spaces.filter((space) => space.chains.every((id) => graph.layers[layer].stitches.includes(id)));
    const childrenOf = (space) =>
      graph.layers[3].stitches.filter((id) =>
        graph.nodes.get(id).anchors.some((anchor) => anchor.into === 'space' && anchor.id === space.id),
      );
    const corners = inRound(2).filter((space) => space.chains.length === 2);
    const sides = inRound(2).filter((space) => space.chains.length === 1);
    assert.deepEqual([corners.length, sides.length], [4, 4]);

    // A group worked into a corner space straddles the corner, standing close to it.
    const hit = new Set();
    for (const space of corners) {
      const tops = childrenOf(space).map((id) => chart.nodes.get(id).top);
      const angles = tops.map(angleOf);
      const corner = cornerAt(4, angleOf(mean(tops)), 15 * DEGREE);
      assert.ok(corner >= 0, `${space.id}: the group is in the corner`);
      const c = cornersOf(4)[corner];
      assert.ok(
        angles.some((a) => turn(a, c) < 0) && angles.some((a) => turn(a, c) > 0),
        `${space.id}: the group straddles the corner`,
      );
      hit.add(corner);
    }
    assert.equal(hit.size, 4, 'a group in all four corners');
    // The corner space of round 3 sits exactly in the corner.
    for (const space of inRound(3).filter((candidate) => candidate.chains.length === 2)) {
      const center = mean(space.chains.map((id) => chart.nodes.get(id).top));
      assert.ok(cornerAt(4, angleOf(center), 3 * DEGREE) >= 0, `${space.id}: the corner space is in the corner`);
    }
    // The side groups lie on a straight side: their tops are equally far from the side of the square and away from the corners.
    const top = frameCoords(chart.frame, stitchesIn(chart, 3)[0].top).r;
    for (const space of sides) {
      for (const id of childrenOf(space)) {
        const p = chart.nodes.get(id).top;
        assert.ok(near(frameCoords(chart.frame, p).r, top), `${id}: straight side`);
        assert.equal(cornerAt(4, angleOf(p), 10 * DEGREE), -1, `${id}: on the side, not in the corner`);
      }
    }
  });

  for (const [shape, n] of [
    ['hexagon', 6],
    ['octagon', 8],
  ]) {
    test(`${n} corners: the vertices sit at the expected angles, the increases stack in the corners, and the sides stay straight (04 §6.1)`, () => {
      for (const stitch of ['sc', 'dc']) {
        const { chart, pattern } = motif({ shape, stitch });
        assert.equal(chart.frame?.sides, n);
        assert.ok(near(chart.frame.corner, Math.PI / 2 + Math.PI / n), 'horizontal top side');
        const rounds = lastRound(chart);
        const hit = new Set();
        for (const group of pattern.pieces[0].groups) {
          const corner = group.members
            .map((id) => cornerAt(n, angleOf(chart.nodes.get(id).top), 0.5 * DEGREE))
            .find((index) => index >= 0);
          assert.ok(corner !== undefined, `${stitch} ${group.id}: one stitch of the increase is in the corner`);
          if (chart.nodes.get(group.members[0]).layer === rounds) hit.add(corner);
        }
        if (stitch === 'dc') assert.equal(hit.size, n, 'an increase in every corner of the last round');
        for (let layer = 1; layer <= rounds; layer += 1) {
          const radii = stitchesIn(chart, layer).map((node) => frameCoords(chart.frame, node.top).r);
          assert.ok(
            radii.every((r) => near(r, radii[0])),
            `${stitch} round ${layer}: straight sides`,
          );
        }
      }
    });
  }

  test('a flat circle stays a circle: no polygon frame, and the tops of a round lie on one circle', () => {
    const { chart } = motif({ shape: 'circle' });
    assert.equal(chart.frame, undefined);
    for (let layer = 1; layer <= 6; layer += 1) {
      const radii = stitchesIn(chart, layer).map((node) => Math.hypot(node.top.x, node.top.y));
      assert.ok(
        radii.every((r) => near(r, radii[0])),
        `round ${layer}`,
      );
    }
  });

  test('round spacing comes from the symbol height: in a single crochet square exactly one symbol height plus the row gap', () => {
    const { chart } = motif({ shape: 'square', stitch: 'sc' });
    const tops = [1, 2, 3, 4, 5, 6].map((layer) => frameCoords(chart.frame, stitchesIn(chart, layer)[0].top).r);
    // A single crochet stem is 18 units (layout.ts `defaultStem`).
    tops.slice(1).forEach((r, i) => assert.ok(near(r - tops[i], 18 + ROW_GAP), `round ${i + 2}`));
    const granny = motif({ shape: 'granny-square' }).chart;
    const grannyTops = [1, 2, 3, 4, 5, 6].map((layer) => frameCoords(granny.frame, stitchesIn(granny, layer)[0].top).r);
    grannyTops
      .slice(1)
      .forEach((r, i) => assert.ok(r - grannyTops[i] >= 34 + ROW_GAP - 1e-6, `granny square round ${i + 2}`));
  });

  test('a new round does not move the earlier rounds (06 §5.3)', () => {
    const five = motif({ shape: 'granny-square', rounds: 5 }).chart;
    const six = motif({ shape: 'granny-square', rounds: 6 }).chart;
    for (const [id, node] of five.nodes) {
      if (node.layer < 5) assert.deepEqual(six.nodes.get(id), node, id);
    }
  });

  for (const [name, patch] of [
    ['granny square', { shape: 'granny-square' }],
    ['single crochet hexagon', { shape: 'hexagon', stitch: 'sc' }],
    ['double crochet octagon', { shape: 'octagon', stitch: 'dc' }],
  ]) {
    test(`${name}, 6 rounds: the symbols do not crowd, chain spaces and stems cross no other group, and the round numbers stay apart`, () => {
      const { chart, graph } = motif(patch);
      const nodes = [...chart.nodes.values()].filter((node) => node.layer > 0);

      // A slip stitch sits on its own foot; every other symbol's top is at least a third of a column away from the rest of the round.
      for (const a of nodes) {
        for (const b of nodes) {
          if (a.id >= b.id || a.layer !== b.layer || a.role === 'slip' || b.role === 'slip') continue;
          assert.ok(
            Math.hypot(a.top.x - b.top.x, a.top.y - b.top.y) >= W / 3,
            `${a.id} and ${b.id} (round ${a.layer})`,
          );
        }
      }

      const end = (node, sign) => ({
        x: node.top.x + (sign * node.size * Math.cos(node.angle)) / 2,
        y: node.top.y + (sign * node.size * Math.sin(node.angle)) / 2,
      });
      const segment = (node) =>
        node.role === 'stitch'
          ? [node.feet[0], node.top]
          : node.role === 'chain'
            ? [end(node, -1), end(node, 1)]
            : null;
      const side = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      const crosses = ([p1, p2], [q1, q2]) =>
        side(q1, q2, p1) * side(q1, q2, p2) < -1e-9 && side(p1, p2, q1) * side(p1, p2, q2) < -1e-9;
      const targets = (id) =>
        graph.nodes
          .get(id)
          .anchors.map((anchor) => anchor.id)
          .join();
      const into = (stitch, chain) => {
        const space = graph.spaceOfChain.get(chain.id);
        return graph.nodes.get(stitch.id).anchors.some((anchor) => anchor.id === chain.id || anchor.id === space?.id);
      };
      for (const a of nodes) {
        for (const b of nodes) {
          const [sa, sb] = [segment(a), segment(b)];
          if (!sa || !sb || a.id === b.id || a.role === 'chain') continue;
          // Within one round, two stems with different targets, or a stem and a chain; plus a chain space and a stem of the next round not worked into it.
          const sameRound =
            a.layer === b.layer && a.id < b.id && !(b.role === 'stitch' && targets(a.id) === targets(b.id));
          const nextRound = b.role === 'chain' && a.layer === b.layer + 1 && !into(a, b);
          if (sameRound || nextRound) assert.ok(!crosses(sa, sb), `${a.id} × ${b.id}`);
        }
      }

      // The round-number labels (at most 40 × 16 units on the canvas, board.ts) do not overlap.
      const labels = chart.layers.slice(1).map((layer) => {
        const x0 = layer.start.x <= layer.end.x ? layer.start.x + 4 - 40 : layer.start.x - 4;
        return { index: layer.index, x0, x1: x0 + 40, y0: layer.start.y - 8, y1: layer.start.y + 8 };
      });
      for (const a of labels) {
        for (const b of labels) {
          if (a.index >= b.index) continue;
          assert.ok(
            a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0,
            `round numbers ${a.index} and ${b.index}`,
          );
        }
      }
    });
  }
});

test('isotonic regression: neighbours that break the order merge onto their mean', () => {
  assert.deepEqual(isotonic([1, 3, 2, 4], [1, 1, 1, 1]), [1, 2.5, 2.5, 4]);
  assert.deepEqual(isotonic([5, 0, 0], [1, 1, 1]), [5 / 3, 5 / 3, 5 / 3]);
  assert.deepEqual(isotonic([2, 1], [3, 1]), [1.75, 1.75]);
});

describe('a stitch with a bad target: normal size in its own place (PQW-879)', () => {
  const stemOf = (node) => Math.hypot(node.feet[0].x - node.top.x, node.feet[0].y - node.top.y);
  // The length of an intact, vertical half double crochet stem, taken from a clean pattern rather than from a formula.
  const normalHdcStem = (() => {
    const clean = hdcRectangle({ rows: 3 });
    return stemOf(layout(clean.pattern).nodes.get(clean.rows[3][6]));
  })();

  test('with a target pointing into an earlier row the stem stays vertical, on its own row baseline, at normal length', () => {
    const example = hdcRectangle({ rows: 3 });
    const victim = example.rows[3][7];
    const farTarget = example.rows[1][7];
    const bad = editNode(example.pattern, victim, { anchors: [farTarget] });

    const chart = layout(bad);
    const node = chart.nodes.get(victim);

    // The foot sits under its own top, as a single foot point: the symbol does not fall apart.
    assert.equal(node.feet.length, 1);
    assert.ok(near(node.feet[0].x, node.top.x), 'the stem is vertical');
    // Normal size: the same stem length as an intact half double crochet.
    assert.ok(near(stemOf(node), normalHdcStem), 'normal stem length');
    // It does not stretch down to the target two rows below: the foot stays on the baseline of its own row.
    assert.ok(node.top.y < chart.nodes.get(farTarget).top.y, 'the symbol is in its own row, not at the target');
    assert.ok(chart.nodes.get(farTarget).top.y - node.feet[0].y > normalHdcStem, 'the foot is not in the distant row');
  });

  test('a distant target against the direction of travel also gets a normal, vertical stem', () => {
    const example = hdcRectangle({ rows: 1 });
    const victim = example.rows[1][8];
    // A target used at the start of the row and long since passed: strongly against the direction of travel.
    const behind = example.rows[0][example.rows[0].length - 1];
    const bad = editNode(example.pattern, victim, { anchors: [behind] });

    const chart = layout(bad);
    const node = chart.nodes.get(victim);
    assert.equal(node.feet.length, 1);
    assert.ok(near(node.feet[0].x, node.top.x), 'the stem is vertical');
    assert.ok(near(stemOf(node), normalHdcStem), 'normal stem length');
  });
});

/*
 * A turning chain has the height of the stitch it stands in for (PQW-934).
 *
 * The owner's report: she put a double crochet into a row started with single
 * crochet, whereupon the two chains that start the row slid down and their
 * symbols hung out below the bottom of the lower band. In her words: "its
 * original position was fine, no height needs adjusting, since it takes the
 * height of the single crochet — correctly."
 */
describe('the turning chain keeps its own height, not the height of the row (PQW-934)', () => {
  /** 22 chains, a turn for single crochet, then the listed stitches from the start of the row. */
  const row = (defs) => {
    let pattern = ok(work(emptyPattern(), { def: 'ch', count: 22 }, 0));
    pattern = ok(endRow(pattern));
    for (const def of defs) {
      const context = contextOf(pattern);
      pattern = ok(work(pattern, { def, count: 1 }, defaultCursor(pattern, context, def)));
    }
    return pattern;
  };

  /** The positions of the chains that start the row, in the chart. */
  const turningChain = (pattern) => {
    const graph = buildPieceGraph(pattern, pattern.pieces[0], testLibrary);
    const chart = layout(pattern);
    return graph.layers[1].turningChain.map((id) => chart.nodes.get(id));
  };

  test('a taller stitch added to the row does not move the chains that start it', () => {
    const short = turningChain(row(['sc', 'sc']));
    const tall = turningChain(row(['sc', 'sc', 'dc']));

    assert.equal(short.length, tall.length, 'the same number of chains starts the row');
    for (const [i, chain] of short.entries()) {
      assert.ok(near(tall[i].top.y, chain.top.y), `chain ${i + 1} stayed in place`);
      assert.ok(near(tall[i].size, chain.size), `chain ${i + 1} kept its size`);
    }
  });

  test('the row itself does grow with the taller stitch: only the turning chain stays put', () => {
    const short = layout(row(['sc', 'sc']));
    const tall = layout(row(['sc', 'sc', 'dc']));
    // The top of the double crochet ends up higher than that of the single crochet: the row really did grow.
    const highest = (chart) =>
      Math.min(...[...chart.nodes.values()].filter((node) => node.role === 'stitch').map((node) => node.top.y));
    assert.ok(highest(tall) < highest(short), 'the top of the row moved up');
  });
});

/*
 * The chains of a repeating pattern (PQW-936).
 *
 * The owner's pattern: "(3 dc in 1 stitch, skip one, 3 chains, skip one)"
 * repeated. Her report: after the second cluster the chain no longer landed
 * where she had pointed it — "it ties the chain to the next cell after the
 * dc" — and she rightly said that it comes back again with every repeat.
 *
 * The cause: chains and spanned slots were paired by counting through from the
 * start of the row. Once the count slipped in one gap, EVERY later chain
 * slipped with it. Pairing is therefore done gap by gap.
 */
describe('chains pair with the spanned slots gap by gap (PQW-936)', () => {
  const cluster = (pattern, slot) => {
    const first = ok(work(pattern, { def: 'dc', count: 1 }, slot));
    return ok(workIntoSame(ok(workIntoSame(first, 'dc', slot)), 'dc', slot));
  };

  /** 22 chains, a turn, two single and two double crochet, then the requested repeats. */
  const repeats = (units) => {
    let pattern = ok(endRow(chains(emptyPattern(), 22)));
    for (const def of ['sc', 'sc', 'dc', 'dc']) {
      pattern = ok(work(pattern, { def, count: 1 }, defaultCursor(pattern, contextOf(pattern), def)));
    }
    for (const slot of units) {
      pattern = cluster(pattern, slot);
      pattern = ok(work(pattern, { def: 'ch', count: 3 }, slot + 2));
    }
    return pattern;
  };

  /** The chains of the row in the direction of travel, leaving out the turning chain that starts it. */
  const rowChains = (pattern) => {
    const chart = layout(pattern);
    const all = [...chart.nodes.values()].filter((node) => node.layer === 1 && node.role === 'chain');
    const edge = Math.max(...all.map((node) => node.top.x));
    return all
      .filter((node) => node.top.x < edge - 1)
      .map((node) => node.top.x)
      .sort((a, b) => b - a);
  };

  /** The columns of the targets in the chart. */
  const columns = (pattern, slots) => {
    const chart = layout(pattern);
    const context = contextOf(pattern);
    return slots.map((i) => chart.nodes.get(context.slots[i].id).top.x);
  };

  test('the chains of every repeat land in their own columns', () => {
    const pattern = repeats([6, 12]);
    const wanted = columns(pattern, [8, 9, 10, 14, 15, 16]);
    for (const [i, x] of rowChains(pattern).entries()) {
      assert.ok(near(x, wanted[i], 1), `chain ${i + 1} is in its own column: ${x} ≉ ${wanted[i]}`);
    }
  });

  test('changing one gap does not move the chains of the other gaps', () => {
    const pattern = repeats([6, 12]);
    const second = rowChains(pattern).slice(3);

    // A stitch after all lands on one of the spanned slots of the first gap: that gap rearranges.
    const changed = ok(work(pattern, { def: 'dc', count: 1 }, 9));
    const after = rowChains(changed).slice(3);

    assert.equal(after.length, 3, 'the second run is intact');
    for (const [i, x] of after.entries()) {
      assert.ok(near(x, second[i], 1e-6), `chain ${i + 1} of the second run did not move: ${x} ≉ ${second[i]}`);
    }
  });
});

/*
 * Orphaned skip markers (PQW-938).
 *
 * The owner put down a single chain after a cluster and it ended up on the far
 * side of the row: "something is very wrong now… look where it put the first
 * chain after the 3 dc", then "but I clicked in the second cell".
 *
 * The cause: a marker points at the STITCH below it, which deleting the chain
 * does not touch, so the marker was left behind with no owner. The chart then
 * spread the chain BETWEEN the markers of the gap — with thirty orphans, into
 * the middle of the row.
 *
 * Two gates guard it: deletion drops the ownerless markers (core-editor), and
 * the chart takes the FIRST markers of the gap, not its middle. The latter is
 * what is measured here.
 */
describe('an orphaned marker does not drag the chain away (PQW-938)', () => {
  /** 40 chains, a turn, two single crochet, then three double crochet into one target. */
  const cluster = () => {
    let pattern = ok(endRow(chains(emptyPattern(), 40)));
    for (const def of ['sc', 'sc']) {
      pattern = ok(work(pattern, { def, count: 1 }, defaultCursor(pattern, contextOf(pattern), def)));
    }
    const slot = defaultCursor(pattern, contextOf(pattern), 'dc');
    const first = ok(work(pattern, { def: 'dc', count: 1 }, slot));
    return { pattern: ok(workIntoSame(ok(workIntoSame(first, 'dc', slot)), 'dc', slot)), slot };
  };

  /** The same pattern, but full of ownerless markers over the rest of the row. */
  const withOrphans = (pattern, from, count) => {
    const piece = pattern.pieces[0];
    const orphans = contextOf(pattern)
      .slots.slice(from, from + count)
      .map((slot) => slot.id);
    return { ...pattern, pieces: [{ ...piece, skipped: [...piece.skipped, ...orphans] }, ...pattern.pieces.slice(1)] };
  };

  test('the chain stays in the column it was placed in, even among orphaned markers', () => {
    const { pattern, slot } = cluster();
    const placed = ok(work(pattern, { def: 'ch', count: 1 }, slot + 2));

    const column = layout(placed).nodes.get(contextOf(placed).slots[slot + 2].id).top.x;
    const chainX = (candidate) => {
      const all = [...layout(candidate).nodes.values()].filter((node) => node.layer === 1 && node.role === 'chain');
      const edge = Math.max(...all.map((node) => node.top.x));
      return all.filter((node) => node.top.x < edge - 1).map((node) => node.top.x);
    };

    assert.deepEqual(chainX(placed).length, 1, 'one chain stands in the row');
    assert.ok(near(chainX(placed)[0], column, 1), 'in the column it was placed in');

    // Twenty orphaned markers over the rest of the row: the chain does not move.
    const dirty = withOrphans(placed, slot + 5, 20);
    assert.ok(near(chainX(dirty)[0], column, 1), 'still in the column it was placed in, orphaned markers and all');
  });
});

/*
 * PQW-951: more chains than the stitches they span — that is an arc.
 *
 * The owner drew the shell pattern: single crochet, 5 chains, and the next
 * single crochet into the 5th stitch of the row below. The chains used to push
 * the single crochet out of its column ("this is how ugly the pattern maker
 * renders it"); now the gap is theirs, and whatever does not fit goes upward.
 */
describe('the arc of a run of chains (PQW-951)', () => {
  /** Foundation chain, then: single crochet, `chainCount` chains, single crochet into slot 4. */
  const arcPattern = (chainCount = 5) => {
    let pattern = chains(emptyPattern(), 24);
    pattern = ok(endRow(pattern));
    pattern = ok(work(pattern, { def: 'sc', count: 1 }, 0));
    pattern = ok(work(pattern, { def: 'ch', count: chainCount }, 1));
    return ok(work(pattern, { def: 'sc', count: 1 }, 4));
  };
  const parts = (pattern) => {
    const placed = layout(pattern);
    const row = [...placed.nodes.values()].filter((node) => node.layer === 1);
    return {
      placed,
      base: [...placed.nodes.values()].filter((node) => node.layer === 0).map((node) => node.top.x),
      stitches: row.filter((node) => node.role === 'stitch'),
      chains: row.filter((node) => node.role === 'chain'),
    };
  };

  test('the anchored stitch stays in its own column; the chains do not push it out', () => {
    const { base, stitches } = parts(arcPattern());
    // The foundation chain runs right to left: its last stitch is the first target, the fourth one along the second.
    assert.deepEqual(
      stitches.map((node) => node.top.x),
      [base.at(-1), base.at(-5)],
    );
  });

  test('the chains spread evenly between the two stitches and do not touch each other', () => {
    const { stitches, chains: arc } = parts(arcPattern());
    const xs = arc.map((node) => node.top.x);
    const steps = xs.slice(1).map((x, i) => xs[i] - x);
    assert.equal(arc.length, 5);
    assert.ok(
      steps.every((step) => near(step, steps[0])),
      `evenly spaced: ${steps}`,
    );
    assert.ok(
      xs.every((x) => x < stitches[0].top.x && x > stitches[1].top.x),
      'between the two stitches',
    );
    assert.ok(
      arc.every((node) => node.size <= steps[0] + 1e-6),
      `the symbol is no wider than the step: ${arc[0].size} > ${steps[0]}`,
    );
  });

  test('the arc rises highest at its middle and tilts at its ends', () => {
    const { chains: arc } = parts(arcPattern());
    const ys = arc.map((node) => node.top.y);
    const middle = ys[2];
    assert.ok(middle < ys[0] && middle < ys[4], `the middle sits higher: ${ys}`);
    assert.ok(near(ys[0], ys[4]) && near(ys[1], ys[3]), `symmetric: ${ys}`);
    assert.ok(near(arc[2].angle, 0), 'horizontal at the top');
    assert.ok(arc[0].angle > 0.1 && arc[4].angle < -0.1, `the ends tilt: ${arc.map((n) => n.angle)}`);
  });

  test('the row does not overhang the foundation chain', () => {
    const { base, placed } = parts(arcPattern());
    const row = [...placed.nodes.values()].filter((node) => node.layer === 1).map((node) => node.top.x);
    assert.ok(Math.max(...row) <= Math.max(...base) + 1e-6, 'not to the right');
    assert.ok(Math.min(...row) >= Math.min(...base) - 1e-6, 'not to the left');
  });

  test('where the chains fit they stay flat: 3 chains over 3 skipped stitches', () => {
    let pattern = chains(emptyPattern(), 24);
    pattern = ok(endRow(pattern));
    pattern = ok(work(pattern, { def: 'sc', count: 1 }, 0));
    pattern = ok(work(pattern, { def: 'ch', count: 3 }, 1));
    pattern = ok(work(pattern, { def: 'sc', count: 1 }, 4));
    const { chains: flat } = parts(pattern);
    assert.equal(flat.length, 3);
    assert.ok(
      flat.every((node) => near(node.top.y, flat[0].top.y) && node.angle === 0),
      'in one line, with no tilt',
    );
  });
});

/*
 * PQW-952: pattern making is not row-sequential. The owner: "I put the single
 * crochet in first and add the chains between them afterwards, and then it
 * falls apart." `piece.skipped` only records the chain made up front, so the
 * spanned stitches have to be read out of the fabric.
 */
describe('the chain space comes out the same whatever the editing order (PQW-952)', () => {
  const started = () => ok(endRow(chains(emptyPattern(), 25)));
  const columns = [0, 4, 8, 12, 16, 20];

  /** Sequentially: single crochet, 5 chains, single crochet, … */
  const inOrder = () => {
    let pattern = started();
    let cursor = 0;
    for (let i = 0; i < columns.length; i += 1) {
      pattern = ok(work(pattern, { def: 'sc', count: 1 }, cursor));
      if (i === columns.length - 1) break;
      pattern = ok(work(pattern, { def: 'ch', count: 5 }, cursor + 1));
      cursor += 4;
    }
    return pattern;
  };

  /** First every single crochet, then the chains into the gaps. */
  const afterwards = () => {
    let pattern = started();
    for (const slot of columns) pattern = ok(work(pattern, { def: 'sc', count: 1 }, slot));
    for (const slot of [1, 5, 9, 13, 17]) pattern = ok(work(pattern, { def: 'ch', count: 5 }, slot));
    return pattern;
  };

  const row = (pattern) =>
    [...layout(pattern).nodes.values()]
      .filter((node) => node.layer === 1)
      .sort((a, b) => b.top.x - a.top.x)
      .map((node) => [node.def, node.top.x, node.top.y, node.angle, node.size]);

  test('the two orders give the same chart', () => {
    assert.deepEqual(row(afterwards()), row(inOrder()));
  });

  test('the single crochet stays in its own column even when the chains are added afterwards', () => {
    const pattern = afterwards();
    const placed = layout(pattern);
    const base = [...placed.nodes.values()].filter((node) => node.layer === 0).sort((a, b) => b.top.x - a.top.x);
    const stitches = [...placed.nodes.values()]
      .filter((node) => node.layer === 1 && node.role === 'stitch')
      .sort((a, b) => b.top.x - a.top.x);
    stitches.forEach((node, i) => {
      assert.ok(near(node.top.x, base[columns[i]].top.x, 1e-6), `single crochet ${i}: ${node.top.x}`);
    });
    assert.equal(stitches.length, columns.length);
  });

  test('chains added afterwards do not push the row past the foundation chain either', () => {
    const placed = layout(afterwards());
    const all = [...placed.nodes.values()];
    const base = all.filter((node) => node.layer === 0).map((node) => node.top.x);
    const above = all.filter((node) => node.layer === 1).map((node) => node.top.x);
    assert.ok(Math.max(...above) <= Math.max(...base) + 1e-6, 'not to the right');
    assert.ok(Math.min(...above) >= Math.min(...base) - 1e-6, 'not to the left');
  });
});

/*
 * PQW-953: a fan worked into a chain space. The owner: "by the third row it
 * already slides out like this." The arc has to hold as much room as the
 * stitches built on it ask for — otherwise the row pushes its own turning
 * chain off the fabric.
 */
describe('a fan built on a chain space fits (PQW-953)', () => {
  /** Shell start: 12 foundation stitches, 4 single crochet with 5 chains between each pair. */
  const shell = () => {
    let pattern = ok(endRow(chains(emptyPattern(), 12)));
    let cursor = 0;
    for (let i = 0; i < 4; i += 1) {
      pattern = ok(work(pattern, { def: 'sc', count: 1 }, cursor));
      if (i === 3) break;
      pattern = ok(work(pattern, { def: 'ch', count: 5 }, cursor + 1));
      cursor += 3;
    }
    return ok(endRow(pattern));
  };
  /** A turning chain, then `count` double crochet into the same chain. */
  const fan = (count = 6) => {
    let pattern = ok(work(shell(), { def: 'dc', count: 1 }, 0));
    for (let i = 0; i < count; i += 1) pattern = ok(work(pattern, { def: 'dc', count: 1 }, 3));
    return pattern;
  };
  const nodesOf = (placed, layer) => [...placed.nodes.values()].filter((node) => node.layer === layer);

  test('the turning chain of row 3 stands on the last stitch of row 2', () => {
    const placed = layout(fan());
    const below = nodesOf(placed, 1).map((node) => node.top.x);
    const chainTop = nodesOf(placed, 2)
      .filter((node) => node.role === 'chain')
      .map((node) => node.top.x);
    assert.ok(chainTop.length === 3, 'the turning chain is made of three chains');
    assert.ok(
      chainTop.every((x) => near(x, chainTop[0])),
      'in one column',
    );
    assert.ok(
      near(chainTop[0], Math.min(...below)),
      `on the last stitch of row 2: ${chainTop[0]} ≠ ${Math.min(...below)}`,
    );
  });

  test('row 3 does not overhang row 2', () => {
    const placed = layout(fan());
    const below = nodesOf(placed, 1).map((node) => node.top.x);
    const above = nodesOf(placed, 2).map((node) => node.top.x);
    assert.ok(
      Math.min(...above) >= Math.min(...below) - 1e-6,
      `to the left: ${Math.min(...above)} < ${Math.min(...below)}`,
    );
    assert.ok(
      Math.max(...above) <= Math.max(...below) + 1e-6,
      `to the right: ${Math.max(...above)} > ${Math.max(...below)}`,
    );
  });

  test('the stems of the fan converge to one point while their tops spread apart', () => {
    const placed = layout(fan());
    const stems = nodesOf(placed, 2)
      .filter((node) => node.role === 'stitch')
      .sort((a, b) => a.top.x - b.top.x);
    assert.equal(stems.length, 6);
    const feet = stems.map((node) => node.feet[0].x);
    assert.ok(
      feet.every((x) => near(x, feet[0])),
      `shared foot: ${feet}`,
    );
    assert.ok(stems.at(-1).top.x - stems[0].top.x > 100, 'the tops spread apart');
  });

  test('the gap under the fan widens while the others stay as they were', () => {
    const wide = layout(fan());
    const plain = layout(shell());
    const gaps = (placed) => {
      const xs = [...placed.nodes.values()]
        .filter((node) => node.layer === 0)
        .map((node) => node.top.x)
        .sort((a, b) => a - b);
      return xs.slice(1).map((x, i) => Math.round((x - xs[i]) * 10) / 10);
    };
    const widened = gaps(wide);
    const before = gaps(plain);
    assert.ok(Math.max(...widened) > Math.max(...before), 'it widens under the fan');
    // The columns of the two spanned stitches grow, so three neighbouring gaps widen.
    const surplus = widened.map((gap, i) => gap - before[i]);
    assert.equal(surplus.filter((extra) => extra > 0.001).length, 3, `only under the fan: ${surplus}`);
    assert.ok(
      near(
        surplus.reduce((sum, extra) => sum + extra, 0),
        120,
        0.5,
      ),
      `the surplus matches what the fan needs: ${surplus}`,
    );
    assert.ok(
      before.every((gap) => near(gap, 24)),
      'without a fan every column is the same',
    );
  });
});
