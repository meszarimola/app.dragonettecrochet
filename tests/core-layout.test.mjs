/*
 * A számolt elrendezés (PQW-857): hely, irány, legyező, összefutás, sorszám,
 * színe és visszája, stabilitás szerkesztés közben, tükrözés, kézi igazítás;
 * sokszögben a körök a sokszög oldalai mentén (PQW-888).
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { contextOf, defaultCursor, deleteLast, emptyPattern, endRow, setPinned, work, workIntoSame } from '../src/core/editor.ts';
import { buildPieceGraph } from '../src/core/graph.ts';
import { isotonic, layoutPattern, ROW_GAP } from '../src/core/layout.ts';
import { frameCoords } from '../src/core/polygon.ts';
import { DEFAULT_MOTIF, generateMotif } from '../src/core/round-generator.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { chevron, dcRectangle, grannySquare, hdcRectangle, shellStitch, vStitchPattern, wave } from './fixtures/examples.ts';
import { editNode } from './fixtures/builder.ts';
import { testLibrary } from './fixtures/library.ts';

const layout = (pattern, options) => layoutPattern(pattern, testLibrary, options);
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
/** Láncalap a tesztekhez. */
const chains = (pattern, count) => ok(work(pattern, { def: 'ch', count }, 0));
const ok = (result) => {
  assert.ok(result.ok, result.reason);
  return result.pattern;
};

describe('sorok', () => {
  const example = hdcRectangle({ rows: 3 });
  const chart = layout(example.pattern);
  const at = (id) => chart.nodes.get(id);

  test('a szem az alatta lévő szem oszlopában áll, függőleges szárral (01 §8.4 szabály 18)', () => {
    for (let row = 2; row <= 3; row += 1) {
      // A sor az alatta lévő sor minden szemébe horgol; a fordulólánc nem célpont (PQW-924).
      const below = [...example.rows[row - 1]].reverse();
      example.rows[row].forEach((id, i) => {
        const node = at(id);
        assert.equal(node.role, 'stitch');
        assert.equal(node.feet.length, 1);
        assert.ok(near(node.feet[0].x, node.top.x), `${id} szára függőleges`);
        assert.ok(near(node.top.x, at(below[i]).top.x), `${id} a célpontja fölött`);
      });
    }
  });

  test('a sorok alulról felfelé, kígyózva haladnak: az 1. sor jobbról balra (01 §6.3)', () => {
    const xs = (row) => example.rows[row].map((id) => at(id).top.x);
    const decreasing = (values) => values.every((v, i) => i === 0 || v < values[i - 1]);
    assert.ok(decreasing(xs(1)));
    assert.ok(decreasing([...xs(2)].reverse()));
    assert.ok(decreasing(xs(3)));
    const y = (row) => at(example.rows[row][0]).top.y;
    assert.ok(y(1) > y(2) && y(2) > y(3));
    assert.ok(example.rows[1].every((id) => near(at(id).top.y, y(1))));
  });

  test('a sorszám a sor kezdő oldalán, a szemszám a végén; a sorok oldala váltakozik (03 §10 I42)', () => {
    const [, row1, row2, row3] = chart.layers;
    assert.ok(row1.start.x > row1.end.x);
    assert.ok(row2.start.x < row2.end.x);
    assert.deepEqual(
      chart.layers.map((layer) => [layer.index, layer.side, layer.stitchCount]),
      [[0, 'right', 0], [1, 'right', 15], [2, 'wrong', 15], [3, 'right', 15]],
    );
    assert.ok(example.rows[2].every((id) => at(id).side === 'wrong'));
  });

  test('a nem számító fordulólánc függőlegesen, az első szem mellett kívül áll', () => {
    const [first] = example.rows[2];
    const chains = example.turningChains[2].map(at);
    assert.ok(chains.every((chain) => chain.role === 'chain' && near(chain.angle, Math.PI / 2)));
    assert.ok(chains.every((chain) => near(chain.top.x, chains[0].top.x)));
    // A 2. sor balról jobbra halad, a fordulólánc tőle balra van.
    assert.ok(near(chains[0].top.x, at(first).top.x - 24));
    assert.ok(chains[0].top.y > chains[1].top.y);
  });

  test('a fordulólánc a sor első szeme mellett, kívül áll (PQW-924)', () => {
    /*
     * A fordulólánc nem szem, ezért nem ül az alatta lévő szem oszlopában: a
     * sor minden szeme az alatta lévő sor egy-egy szemébe megy, a fordulólánc
     * pedig a sor szélén kívülre kerül.
     */
    const dc = dcRectangle({ rows: 3 });
    const dcChart = layout(dc.pattern);
    const chain = dcChart.nodes.get(dc.turningChains[2][2]);
    const xs = dc.rows[2].map((id) => dcChart.nodes.get(id).top.x);
    assert.ok(chain.top.x > Math.max(...xs) || chain.top.x < Math.min(...xs), 'a fordulólánc a sor szemein kívül áll');
  });

  test('a sormagasság a legmagasabb szemből jön; a jelek közös talpvonalon állnak (03 §2.2)', () => {
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

describe('legyező és összefutás', () => {
  test('a kagyló szárai egy talpból indulnak, a tetők a talp körül szimmetrikusan nyílnak (01 §6.1)', () => {
    const example = shellStitch({ repeats: 2 });
    const chart = layout(example.pattern);
    const shell = example.pattern.pieces[0].groups[0].members.map((id) => chart.nodes.get(id));
    const foot = shell[0].feet[0];
    assert.ok(shell.every((node) => near(node.feet[0].x, foot.x) && near(node.feet[0].y, foot.y)));
    const tops = shell.map((node) => node.top.x);
    assert.equal(new Set(tops.map((x) => x.toFixed(3))).size, 5);
    assert.ok(near(tops.reduce((a, b) => a + b, 0) / tops.length, foot.x, 1e-3));
  });

  test('a fogyasztás talpai a célpontjaiban vannak, a teteje közöttük (01 §8.4 szabály 18)', () => {
    const example = chevron();
    const chart = layout(example.pattern);
    const valley = chart.nodes.get(example.valley.node);
    const targets = example.valley.targets.map((id) => chart.nodes.get(id).top.x);
    assert.deepEqual(valley.feet.map((foot) => foot.x.toFixed(3)), targets.map((x) => x.toFixed(3)));
    assert.ok(valley.top.x > Math.min(...targets) && valley.top.x < Math.max(...targets));
  });

  test('a láncívbe horgolt szem talpa az ív láncszemei fölött van (03 §4.4)', () => {
    const example = vStitchPattern({ repeats: 2 });
    const chart = layout(example.pattern);
    const piece = example.pattern.pieces[0];
    const node = piece.stitches.find((s) => s.anchors[0]?.into === 'space');
    const space = piece.spaces.find((s) => s.id === node.anchors[0].id);
    const chainX = space.chains.map((id) => chart.nodes.get(id).top.x);
    assert.ok(near(chart.nodes.get(node.id).feet[0].x, chainX.reduce((a, b) => a + b, 0) / chainX.length));
  });
});

test('körben a jelek sugárirányban kifelé mutatnak, a varázskör középen (01 §6.1)', () => {
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
  // A 2. kör a láncívekbe horgol: a talp az ív láncszemei között, a valódi helyükön.
  const piece = example.pattern.pieces[0];
  for (const id of example.rows[2]) {
    const anchor = piece.stitches.find((s) => s.id === id).anchors[0];
    if (anchor?.into !== 'space') continue;
    const chains = piece.spaces.find((s) => s.id === anchor.id).chains.map((c) => chart.nodes.get(c).top);
    const foot = chart.nodes.get(id).feet[0];
    assert.ok(near(foot.x, chains.reduce((a, p) => a + p.x, 0) / chains.length), id);
    assert.ok(near(foot.y, chains.reduce((a, p) => a + p.y, 0) / chains.length), id);
  }
  const radius = (row) => Math.max(...example.rows[row].map((id) => Math.hypot(chart.nodes.get(id).top.x, chart.nodes.get(id).top.y)));
  assert.ok(radius(1) < radius(2) && radius(2) < radius(3));
});

test('az elrendezés szerkesztés közben nem ugrál: az utolsó szem törlése a korábbi sorokat nem mozdítja', () => {
  const { pattern, rows } = dcRectangle({ rows: 3 });
  let edited = pattern;
  for (let i = 0; i < 6; i += 1) edited = ok(deleteLast(edited));
  const before = layout(pattern);
  const after = layout(edited);
  for (const id of [...rows[0], ...rows[1], ...rows[2]]) assert.deepEqual(after.nodes.get(id), before.nodes.get(id), id);
});

test('tükrözött nézet: minden vízszintesen tükröződik, a sorszám a másik oldalra kerül (01 §8.4 szabály 22)', () => {
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

test('kézi igazítás: a jel és a bele horgolt szemek talpa elmozdul, az oszlopok nem', () => {
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

test('üres minta: üres elrendezés', () => {
  const chart = layout(emptyPattern());
  assert.equal(chart.nodes.size, 0);
  assert.deepEqual(chart.layers, []);
});

describe('sokszög (PQW-888)', () => {
  const W = 24;
  const DEGREE = Math.PI / 180;
  const motif = (patch) => {
    const pattern = ok(generateMotif(emptyPattern(), { ...DEFAULT_MOTIF, rounds: 6, ...patch }));
    const library = libraryFor(pattern);
    return { pattern, chart: layoutPattern(pattern, library), graph: buildPieceGraph(pattern, pattern.pieces[0], library) };
  };
  const angleOf = (p) => Math.atan2(-p.y, p.x);
  /** Két szög különbsége −π és π között. */
  const turn = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  /** A sokszög csúcsainak szöge: vízszintes felső oldal. */
  const cornersOf = (n) => Array.from({ length: n }, (_, j) => Math.PI / 2 + Math.PI / n + (2 * Math.PI * j) / n);
  const cornerAt = (n, angle, eps) => cornersOf(n).findIndex((corner) => Math.abs(turn(angle, corner)) < eps);
  const stitchesIn = (chart, layer) => [...chart.nodes.values()].filter((node) => node.layer === layer && node.role === 'stitch');
  const mean = (points) => ({ x: points.reduce((s, p) => s + p.x, 0) / points.length, y: points.reduce((s, p) => s + p.y, 0) / points.length });
  const lastRound = (chart) => Math.max(...[...chart.nodes.values()].map((node) => node.layer));

  test('nagymama-négyzet: a 3. kör sarokcsoportjai a négyzet négy sarkában, az oldalcsoportok az oldalak mentén (03 §8)', () => {
    const { chart, graph } = motif({ shape: 'granny-square', rounds: 3 });
    assert.equal(chart.frame?.sides, 4);
    const inRound = (layer) => graph.piece.spaces.filter((space) => space.chains.every((id) => graph.layers[layer].stitches.includes(id)));
    const childrenOf = (space) =>
      graph.layers[3].stitches.filter((id) => graph.nodes.get(id).anchors.some((anchor) => anchor.into === 'space' && anchor.id === space.id));
    const corners = inRound(2).filter((space) => space.chains.length === 2);
    const sides = inRound(2).filter((space) => space.chains.length === 1);
    assert.deepEqual([corners.length, sides.length], [4, 4]);

    // A sarokívbe horgolt csoport a sarok két oldalán, a sarok közelében áll.
    const hit = new Set();
    for (const space of corners) {
      const tops = childrenOf(space).map((id) => chart.nodes.get(id).top);
      const angles = tops.map(angleOf);
      const corner = cornerAt(4, angleOf(mean(tops)), 15 * DEGREE);
      assert.ok(corner >= 0, `${space.id}: a csoport a sarokban`);
      const c = cornersOf(4)[corner];
      assert.ok(angles.some((a) => turn(a, c) < 0) && angles.some((a) => turn(a, c) > 0), `${space.id}: a csoport a sarok két oldalán`);
      hit.add(corner);
    }
    assert.equal(hit.size, 4, 'mind a négy sarokban csoport');
    // A 3. kör sarokíve pontosan a sarokban.
    for (const space of inRound(3).filter((candidate) => candidate.chains.length === 2)) {
      const center = mean(space.chains.map((id) => chart.nodes.get(id).top));
      assert.ok(cornerAt(4, angleOf(center), 3 * DEGREE) >= 0, `${space.id}: a sarokív a sarokban`);
    }
    // Az oldalcsoportok egyenes oldalon: a tetejük a négyzet oldalától egyforma messze, a sarkoktól távol.
    const top = frameCoords(chart.frame, stitchesIn(chart, 3)[0].top).r;
    for (const space of sides) {
      for (const id of childrenOf(space)) {
        const p = chart.nodes.get(id).top;
        assert.ok(near(frameCoords(chart.frame, p).r, top), `${id}: egyenes oldal`);
        assert.equal(cornerAt(4, angleOf(p), 10 * DEGREE), -1, `${id}: az oldalon, nem a sarokban`);
      }
    }
  });

  for (const [shape, n] of [
    ['hexagon', 6],
    ['octagon', 8],
  ]) {
    test(`${n} sarok: a csúcsok a várt szögeknél, a szaporítások egymás fölött a sarkokban, az oldalak egyenesek (04 §6.1)`, () => {
      for (const stitch of ['sc', 'dc']) {
        const { chart, pattern } = motif({ shape, stitch });
        assert.equal(chart.frame?.sides, n);
        assert.ok(near(chart.frame.corner, Math.PI / 2 + Math.PI / n), 'vízszintes felső oldal');
        const rounds = lastRound(chart);
        const hit = new Set();
        for (const group of pattern.pieces[0].groups) {
          const corner = group.members
            .map((id) => cornerAt(n, angleOf(chart.nodes.get(id).top), 0.5 * DEGREE))
            .find((index) => index >= 0);
          assert.ok(corner !== undefined, `${stitch} ${group.id}: a szaporítás egyik szeme a sarokban`);
          if (chart.nodes.get(group.members[0]).layer === rounds) hit.add(corner);
        }
        if (stitch === 'dc') assert.equal(hit.size, n, 'az utolsó körben minden sarokban szaporítás');
        for (let layer = 1; layer <= rounds; layer += 1) {
          const radii = stitchesIn(chart, layer).map((node) => frameCoords(chart.frame, node.top).r);
          assert.ok(radii.every((r) => near(r, radii[0])), `${stitch} ${layer}. kör: egyenes oldalak`);
        }
      }
    });
  }

  test('a lapos kör kör marad: nincs sokszög-alak, egy kör tetői egy körön', () => {
    const { chart } = motif({ shape: 'circle' });
    assert.equal(chart.frame, undefined);
    for (let layer = 1; layer <= 6; layer += 1) {
      const radii = stitchesIn(chart, layer).map((node) => Math.hypot(node.top.x, node.top.y));
      assert.ok(radii.every((r) => near(r, radii[0])), `${layer}. kör`);
    }
  });

  test('a körök távolsága a jelek magasságából jön: rövidpálcás négyzetben pontosan egy jelmagasság és a sorköz', () => {
    const { chart } = motif({ shape: 'square', stitch: 'sc' });
    const tops = [1, 2, 3, 4, 5, 6].map((layer) => frameCoords(chart.frame, stitchesIn(chart, layer)[0].top).r);
    // A rövidpálca szára 18 egység (layout.ts `defaultStem`).
    tops.slice(1).forEach((r, i) => assert.ok(near(r - tops[i], 18 + ROW_GAP), `${i + 2}. kör`));
    const granny = motif({ shape: 'granny-square' }).chart;
    const grannyTops = [1, 2, 3, 4, 5, 6].map((layer) => frameCoords(granny.frame, stitchesIn(granny, layer)[0].top).r);
    grannyTops.slice(1).forEach((r, i) => assert.ok(r - grannyTops[i] >= 34 + ROW_GAP - 1e-6, `nagymama-négyzet ${i + 2}. kör`));
  });

  test('új kör nem mozdítja a korábbi köröket (06 §5.3)', () => {
    const five = motif({ shape: 'granny-square', rounds: 5 }).chart;
    const six = motif({ shape: 'granny-square', rounds: 6 }).chart;
    for (const [id, node] of five.nodes) {
      if (node.layer < 5) assert.deepEqual(six.nodes.get(id), node, id);
    }
  });

  for (const [name, patch] of [
    ['nagymama-négyzet', { shape: 'granny-square' }],
    ['rövidpálcás hatszög', { shape: 'hexagon', stitch: 'sc' }],
    ['pálcás nyolcszög', { shape: 'octagon', stitch: 'dc' }],
  ]) {
    test(`${name}, 6 kör: a jelek nem torlódnak, a láncív és a szár nem keresztez más csoportot, a körszámok elkülönülnek`, () => {
      const { chart, graph } = motif(patch);
      const nodes = [...chart.nodes.values()].filter((node) => node.layer > 0);

      // A kúszószem a talpán ül; a többi jel teteje legalább harmad oszlopnyira a kör többi jelétől.
      for (const a of nodes) {
        for (const b of nodes) {
          if (a.id >= b.id || a.layer !== b.layer || a.role === 'slip' || b.role === 'slip') continue;
          assert.ok(Math.hypot(a.top.x - b.top.x, a.top.y - b.top.y) >= W / 3, `${a.id} és ${b.id} (${a.layer}. kör)`);
        }
      }

      const end = (node, sign) => ({
        x: node.top.x + (sign * node.size * Math.cos(node.angle)) / 2,
        y: node.top.y + (sign * node.size * Math.sin(node.angle)) / 2,
      });
      const segment = (node) => (node.role === 'stitch' ? [node.feet[0], node.top] : node.role === 'chain' ? [end(node, -1), end(node, 1)] : null);
      const side = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      const crosses = ([p1, p2], [q1, q2]) => side(q1, q2, p1) * side(q1, q2, p2) < -1e-9 && side(p1, p2, q1) * side(p1, p2, q2) < -1e-9;
      const targets = (id) => graph.nodes.get(id).anchors.map((anchor) => anchor.id).join();
      const into = (stitch, chain) => {
        const space = graph.spaceOfChain.get(chain.id);
        return graph.nodes.get(stitch.id).anchors.some((anchor) => anchor.id === chain.id || anchor.id === space?.id);
      };
      for (const a of nodes) {
        for (const b of nodes) {
          const [sa, sb] = [segment(a), segment(b)];
          if (!sa || !sb || a.id === b.id || a.role === 'chain') continue;
          // Egy körön belül két különböző célpontú szár, vagy szár és lánc; a láncív és a következő kör nem bele horgolt szára.
          const sameRound = a.layer === b.layer && a.id < b.id && !(b.role === 'stitch' && targets(a.id) === targets(b.id));
          const nextRound = b.role === 'chain' && a.layer === b.layer + 1 && !into(a, b);
          if (sameRound || nextRound) assert.ok(!crosses(sa, sb), `${a.id} × ${b.id}`);
        }
      }

      // A körszámok címkéi (a vásznon legfeljebb 40 × 16 egység, board.ts) nem fedik egymást.
      const labels = chart.layers.slice(1).map((layer) => {
        const x0 = layer.start.x <= layer.end.x ? layer.start.x + 4 - 40 : layer.start.x - 4;
        return { index: layer.index, x0, x1: x0 + 40, y0: layer.start.y - 8, y1: layer.start.y + 8 };
      });
      for (const a of labels) {
        for (const b of labels) {
          if (a.index >= b.index) continue;
          assert.ok(a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0, `${a.index}. és ${b.index}. körszám`);
        }
      }
    });
  }
});

test('monoton regresszió: a sorrendet sértő szomszédok átlaguk körül egyesülnek', () => {
  assert.deepEqual(isotonic([1, 3, 2, 4], [1, 1, 1, 1]), [1, 2.5, 2.5, 4]);
  assert.deepEqual(isotonic([5, 0, 0], [1, 1, 1]), [5 / 3, 5 / 3, 5 / 3]);
  assert.deepEqual(isotonic([2, 1], [3, 1]), [1.75, 1.75]);
});

describe('hibás célpontú szem: normál méret a saját helyén (PQW-879)', () => {
  const stemOf = (node) => Math.hypot(node.feet[0].x - node.top.x, node.feet[0].y - node.top.y);
  // A félpálca ép, függőleges szárának hossza a hibátlan mintából, a képlettől függetlenül.
  const normalHdcStem = (() => {
    const clean = hdcRectangle({ rows: 3 });
    return stemOf(layout(clean.pattern).nodes.get(clean.rows[3][6]));
  })();

  test('korábbi sorba mutató célpontnál a szár függőleges, a saját sora talpvonalán, normál hosszal', () => {
    const example = hdcRectangle({ rows: 3 });
    const victim = example.rows[3][7];
    const farTarget = example.rows[1][7];
    const bad = editNode(example.pattern, victim, { anchors: [farTarget] });

    const chart = layout(bad);
    const node = chart.nodes.get(victim);

    // A talp a saját tető alatt, egy talpponttal: a jel nem esik szét.
    assert.equal(node.feet.length, 1);
    assert.ok(near(node.feet[0].x, node.top.x), 'a szár függőleges');
    // Normál méret: ugyanaz a szárhossz, mint egy ép félpálcáé.
    assert.ok(near(stemOf(node), normalHdcStem), 'normál szárhossz');
    // Nem nyúlik a két sorral lejjebb lévő célpontig: a talp a saját sora talpvonalán van.
    assert.ok(node.top.y < chart.nodes.get(farTarget).top.y, 'a jel a saját sorában, nem a célpontnál');
    assert.ok(chart.nodes.get(farTarget).top.y - node.feet[0].y > normalHdcStem, 'a talp nem a távoli sorban van');
  });

  test('a haladási irány ellen mutató, távoli célpontnál is normál, függőleges szár', () => {
    const example = hdcRectangle({ rows: 1 });
    const victim = example.rows[1][8];
    // A sor elején felhasznált (már rég elhagyott) célpont: erősen a haladási irány ellen.
    const behind = example.rows[0][example.rows[0].length - 1];
    const bad = editNode(example.pattern, victim, { anchors: [behind] });

    const chart = layout(bad);
    const node = chart.nodes.get(victim);
    assert.equal(node.feet.length, 1);
    assert.ok(near(node.feet[0].x, node.top.x), 'a szár függőleges');
    assert.ok(near(stemOf(node), normalHdcStem), 'normál szárhossz');
  });
});

/*
 * A fordulólánc annak a szemnek a magassága, amelyik helyett áll (PQW-934).
 *
 * A tulajdonos jelentése: rövidpálcával indított sorba tett egy egyráhajtásos
 * pálcát, mire a sort kezdő két láncszem lecsúszott, és a jelük kilógott az
 * alsó sáv aljából. Szó szerint: „az eredeti helyzete jó volt, nem kell
 * magasságot állítani, hiszen ő a rövidpálca magassága lesz — helyesen.”
 */
describe('a fordulólánc magassága a sajátja, nem a soré (PQW-934)', () => {
  /** 22 láncszem, fordulás rövidpálcára, majd a felsorolt szemek a sor elejétől. */
  const row = (defs) => {
    let pattern = ok(work(emptyPattern(), { def: 'ch', count: 22 }, 0));
    pattern = ok(endRow(pattern, 'sc'));
    for (const def of defs) {
      const context = contextOf(pattern);
      pattern = ok(work(pattern, { def, count: 1 }, defaultCursor(pattern, context, def)));
    }
    return pattern;
  };

  /** A sort kezdő láncszemek helye a rajzon. */
  const turningChain = (pattern) => {
    const graph = buildPieceGraph(pattern, pattern.pieces[0], testLibrary);
    const chart = layout(pattern);
    return graph.layers[1].turningChain.map((id) => chart.nodes.get(id));
  };

  test('a sorba tett magasabb szem nem mozdítja el a sort kezdő láncszemeket', () => {
    const short = turningChain(row(['sc', 'sc']));
    const tall = turningChain(row(['sc', 'sc', 'dc']));

    assert.equal(short.length, tall.length, 'ugyanannyi láncszem kezdi a sort');
    for (const [i, chain] of short.entries()) {
      assert.ok(near(tall[i].top.y, chain.top.y), `a(z) ${i + 1}. láncszem helyben maradt`);
      assert.ok(near(tall[i].size, chain.size), `a(z) ${i + 1}. láncszem mérete nem változott`);
    }
  });

  test('a sor viszont megnő a magasabb szemtől: csak a fordulólánc marad', () => {
    const short = layout(row(['sc', 'sc']));
    const tall = layout(row(['sc', 'sc', 'dc']));
    // A pálca teteje magasabbra kerül, mint a rövidpálcáé: a sor tényleg nőtt.
    const highest = (chart) => Math.min(...[...chart.nodes.values()].filter((node) => node.role === 'stitch').map((node) => node.top.y));
    assert.ok(highest(tall) < highest(short), 'a sor teteje feljebb került');
  });
});

/*
 * Az ismétlődő minta láncszemei (PQW-936).
 *
 * A tulajdonos mintája: „(3 erp 1 szembe, egy kihagy, 3 láncszem, egy kihagy)”
 * ismételve. A jelentés: a második szaporítócsomó után a láncszem már nem oda
 * került, ahová mutatott — „köti a láncszemet a következő cellához az erp
 * után” —, és jól mondta, hogy ez ismétlődve újra és újra előjön.
 *
 * Az ok: a láncszemek és az áthidalt helyek a sor elejétől végigszámolva
 * párosultak. Ha egy résben elcsúszott a szám, onnantól MINDEN későbbi
 * láncszem elcsúszott. A párosítás ezért résenként megy.
 */
describe('a láncszemek résenként párosulnak az áthidalt helyekkel (PQW-936)', () => {
  const cluster = (pattern, slot) => {
    const first = ok(work(pattern, { def: 'dc', count: 1 }, slot));
    return ok(workIntoSame(ok(workIntoSame(first, 'dc', slot)), 'dc', slot));
  };

  /** 22 láncszem, fordulás, két rövidpálca és két pálca, majd a kért ismétlések. */
  const repeats = (units) => {
    let pattern = ok(endRow(chains(emptyPattern(), 22), 'sc'));
    for (const def of ['sc', 'sc', 'dc', 'dc']) {
      pattern = ok(work(pattern, { def, count: 1 }, defaultCursor(pattern, contextOf(pattern), def)));
    }
    for (const slot of units) {
      pattern = cluster(pattern, slot);
      pattern = ok(work(pattern, { def: 'ch', count: 3 }, slot + 2));
    }
    return pattern;
  };

  /** A sor láncszemei a haladási irányban, a sort kezdő fordulóláncot elhagyva. */
  const rowChains = (pattern) => {
    const chart = layout(pattern);
    const all = [...chart.nodes.values()].filter((node) => node.layer === 1 && node.role === 'chain');
    const edge = Math.max(...all.map((node) => node.top.x));
    return all.filter((node) => node.top.x < edge - 1).map((node) => node.top.x).sort((a, b) => b - a);
  };

  /** A célpontok oszlopai a rajzon. */
  const columns = (pattern, slots) => {
    const chart = layout(pattern);
    const context = contextOf(pattern);
    return slots.map((i) => chart.nodes.get(context.slots[i].id).top.x);
  };

  test('minden ismétlés láncszemei a saját oszlopukba kerülnek', () => {
    const pattern = repeats([6, 12]);
    const wanted = columns(pattern, [8, 9, 10, 14, 15, 16]);
    for (const [i, x] of rowChains(pattern).entries()) {
      assert.ok(near(x, wanted[i], 1), `a(z) ${i + 1}. láncszem a saját oszlopában: ${x} ≉ ${wanted[i]}`);
    }
  });

  test('az egyik rés változása nem mozdítja el a többi rés láncszemeit', () => {
    const pattern = repeats([6, 12]);
    const second = rowChains(pattern).slice(3);

    // Az első rés egyik áthidalt helyére mégis szem kerül: az a rés átrendeződik.
    const changed = ok(work(pattern, { def: 'dc', count: 1 }, 9));
    const after = rowChains(changed).slice(3);

    assert.equal(after.length, 3, 'a második futam megmaradt');
    for (const [i, x] of after.entries()) {
      assert.ok(near(x, second[i], 1e-6), `a második futam ${i + 1}. láncszeme nem mozdult: ${x} ≉ ${second[i]}`);
    }
  });
});
