/*
 * A számolt elrendezés (PQW-857): hely, irány, legyező, összefutás, sorszám,
 * színe és visszája, stabilitás szerkesztés közben, tükrözés, kézi igazítás.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { deleteLast, emptyPattern, setPinned } from '../src/core/editor.ts';
import { isotonic, layoutPattern } from '../src/core/layout.ts';
import { chevron, dcRectangle, grannySquare, hdcRectangle, shellStitch, vStitchPattern, wave } from './fixtures/examples.ts';
import { testLibrary } from './fixtures/library.ts';

const layout = (pattern, options) => layoutPattern(pattern, testLibrary, options);
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const ok = (result) => {
  assert.ok(result.ok, result.reason);
  return result.pattern;
};

describe('sorok', () => {
  const example = hdcRectangle({ rows: 3 });
  const chart = layout(example.pattern);
  const at = (id) => chart.nodes.get(id);

  test('az öltés az alatta lévő öltés oszlopában áll, függőleges szárral (01 §8.4 szabály 18)', () => {
    for (let row = 2; row <= 3; row += 1) {
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

  test('a sorszám a sor kezdő oldalán, az öltésszám a végén; a sorok oldala váltakozik (03 §10 I42)', () => {
    const [, row1, row2, row3] = chart.layers;
    assert.ok(row1.start.x > row1.end.x);
    assert.ok(row2.start.x < row2.end.x);
    assert.deepEqual(
      chart.layers.map((layer) => [layer.index, layer.side, layer.stitchCount]),
      [[0, 'right', 0], [1, 'right', 15], [2, 'wrong', 15], [3, 'right', 15]],
    );
    assert.ok(example.rows[2].every((id) => at(id).side === 'wrong'));
  });

  test('a nem számító fordulólánc függőlegesen, az első öltés mellett kívül áll', () => {
    const [first] = example.rows[2];
    const chains = example.turningChains[2].map(at);
    assert.ok(chains.every((chain) => chain.role === 'chain' && near(chain.angle, Math.PI / 2)));
    assert.ok(chains.every((chain) => near(chain.top.x, chains[0].top.x)));
    // A 2. sor balról jobbra halad, a fordulólánc tőle balra van.
    assert.ok(near(chains[0].top.x, at(first).top.x - 24));
    assert.ok(chains[0].top.y > chains[1].top.y);
  });

  test('a számító fordulólánc az alatta lévő öltés oszlopában áll (03 §1.3)', () => {
    const dc = dcRectangle({ rows: 3 });
    const dcChart = layout(dc.pattern);
    const below = dc.rows[1];
    const chain = dcChart.nodes.get(dc.turningChains[2][2]);
    assert.ok(near(chain.top.x, dcChart.nodes.get(below[below.length - 1]).top.x));
  });

  test('a sormagasság a legmagasabb öltésből jön; a jelek közös talpvonalon állnak (03 §2.2)', () => {
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

  test('a láncívbe horgolt öltés talpa az ív láncszemei fölött van (03 §4.4)', () => {
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

test('az elrendezés szerkesztés közben nem ugrál: az utolsó öltés törlése a korábbi sorokat nem mozdítja', () => {
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

test('kézi igazítás: a jel és a bele horgolt öltések talpa elmozdul, az oszlopok nem', () => {
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

test('monoton regresszió: a sorrendet sértő szomszédok átlaguk körül egyesülnek', () => {
  assert.deepEqual(isotonic([1, 3, 2, 4], [1, 1, 1, 1]), [1, 2.5, 2.5, 4]);
  assert.deepEqual(isotonic([5, 0, 0], [1, 1, 1]), [5 / 3, 5 / 3, 5 / 3]);
  assert.deepEqual(isotonic([2, 1], [3, 1]), [1.75, 1.75]);
});
