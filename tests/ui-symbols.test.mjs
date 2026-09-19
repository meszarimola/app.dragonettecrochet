/*
 * Table-driven tests of the parametric symbol drawing (PQW-867): hatch lines =
 * yarn overs, stem length from the chain height, shared foot and shared top,
 * the insertion mark on the foot, and single crochet as + or ×.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { STITCHES, stitchById } from '../src/core/stitches.ts';
import { hatchCount, placedShapes, shapeBounds, stemLength, symbolShapes } from '../src/ui/symbols.ts';

const ROLES = [
  'stem',
  'bar',
  'hatch',
  'cross',
  'chain',
  'dot',
  'ring',
  'closure',
  'tilde',
  'front-loop',
  'back-loop',
  'front-post',
  'back-post',
];

function roleCounts(shapes) {
  const counts = Object.fromEntries(ROLES.map((role) => [role, 0]));
  for (const shape of shapes) counts[shape.role] += 1;
  return counts;
}

function only(counts) {
  return { ...Object.fromEntries(ROLES.map((role) => [role, 0])), ...counts };
}

const near = (a, b) => Math.abs(a - b) < 1e-9;
const samePoint = (p, q) => near(p.x, q.x) && near(p.y, q.y);
const stems = (shapes) => shapes.filter((shape) => shape.role === 'stem');

// prettier-ignore
const SYMBOLS = [
  ['ch', { chain: 1 }],
  ['sl-st', { dot: 1 }],
  ['sc', { stem: 1, cross: 1 }],
  ['hdc', { stem: 1, bar: 1 }],
  ['dc', { stem: 1, bar: 1, hatch: 1 }],
  ['tr', { stem: 1, bar: 1, hatch: 2 }],
  ['dtr', { stem: 1, bar: 1, hatch: 3 }],
  ['inc-2sc', { stem: 2, cross: 2 }],
  ['inc-2dc', { stem: 2, bar: 2, hatch: 2 }],
  ['sc2tog', { stem: 2, cross: 2 }],
  ['sc3tog', { stem: 3, cross: 3 }],
  ['dc2tog', { stem: 2, bar: 1, hatch: 2 }],
  ['dc3tog', { stem: 3, bar: 1, hatch: 3 }],
  ['invdec', { stem: 2, cross: 2, 'front-loop': 2 }],
  ['shell-5dc', { stem: 5, bar: 5, hatch: 5 }],
  ['v-st-dc', { stem: 2, bar: 2, hatch: 2, chain: 1 }],
  ['cl-3dc', { stem: 3, bar: 1, hatch: 3 }],
  ['cl-3dc-spread', { stem: 3, bar: 1, hatch: 3 }],
  ['puff-3', { stem: 3, bar: 1 }],
  ['bobble-5dc', { stem: 5, bar: 1, hatch: 5 }],
  ['popcorn-5dc', { stem: 5, hatch: 5, closure: 1 }],
  ['picot', { chain: 3, dot: 1 }],
  ['rev-sc', { stem: 1, cross: 1, tilde: 2 }],
  ['ch-sp', { chain: 3 }],
  ['magic-ring', { ring: 1 }],
];

test('the symbol table covers every stitch in the library', () => {
  assert.deepEqual(
    SYMBOLS.map(([id]) => id),
    STITCHES.map((stitch) => stitch.id),
  );
});

for (const [id, expected] of SYMBOLS) {
  test(`${id}: the parts of the symbol`, () => {
    assert.deepEqual(roleCounts(symbolShapes(stitchById(id))), only(expected));
  });
}

test('every stem gets as many hatch lines as the component stitch has yarn overs', () => {
  for (const def of STITCHES) {
    const shapes = symbolShapes(def);
    const part = def.kind === 'joined' ? stitchById(def.part) : def;
    assert.equal(roleCounts(shapes).hatch, stems(shapes).length * hatchCount(part), def.id);
  }
});

// prettier-ignore
const HATCHES = [
  // id         yarn overs  hatch lines
  ['sc', 0, 0],
  ['hdc', 1, 0], // half double crochet is a plain T (01 §8.1 szabály 1–2)
  ['dc', 1, 1],
  ['tr', 2, 2],
  ['dtr', 3, 3],
];

for (const [id, yarnOvers, hatches] of HATCHES) {
  test(`${id}: hatch lines = yarn overs, half double crochet excepted`, () => {
    const def = stitchById(id);
    assert.equal(def.yarnOvers, yarnOvers);
    assert.equal(hatchCount(def), hatches);
    assert.equal(roleCounts(symbolShapes(def)).hatch, hatches);
  });
}

test('a hatch line really is slanted: neither horizontal nor vertical', () => {
  for (const shape of symbolShapes(stitchById('tr')).filter((s) => s.role === 'hatch')) {
    assert.ok(!near(shape.from.x, shape.to.x) && !near(shape.from.y, shape.to.y));
  }
});

// prettier-ignore
const STEMS = [
  // id         chain height  stem length
  ['sc', 1, 18],
  ['hdc', 2, 26],
  ['dc', 3, 34],
  ['tr', 4, 42],
  ['dtr', 5, 50],
];

for (const [id, chainHeight, length] of STEMS) {
  test(`${id}: the stem length comes from the chain height`, () => {
    const def = stitchById(id);
    const [stem] = stems(symbolShapes(def));
    assert.equal(def.chainHeight, chainHeight);
    assert.equal(stemLength(def.chainHeight), length);
    assert.ok(near(Math.hypot(stem.to.x - stem.from.x, stem.to.y - stem.from.y), length));
  });
}

test('increases, shells and V-stitches share one foot for all their stems', () => {
  for (const id of ['inc-2sc', 'inc-2dc', 'shell-5dc', 'v-st-dc']) {
    const [first, ...rest] = stems(symbolShapes(stitchById(id)));
    for (const stem of rest) assert.ok(samePoint(stem.from, first.from), id);
    assert.ok(
      rest.some((stem) => !samePoint(stem.to, first.to)),
      `${id}: the tops fan out`,
    );
  }
});

test('decreases share one top while every stem keeps its own foot', () => {
  for (const id of ['sc2tog', 'sc3tog', 'dc2tog', 'dc3tog', 'invdec', 'cl-3dc-spread']) {
    const [first, ...rest] = stems(symbolShapes(stitchById(id)));
    for (const stem of rest) {
      assert.ok(samePoint(stem.to, first.to), `${id}: shared top`);
      assert.ok(!samePoint(stem.from, first.from), `${id}: separate foot`);
    }
  }
});

test('clusters, bobbles and puffs worked into one stitch share both the foot and the top', () => {
  for (const id of ['cl-3dc', 'bobble-5dc', 'puff-3']) {
    const [first, ...rest] = stems(symbolShapes(stitchById(id)));
    for (const stem of rest) assert.ok(samePoint(stem.from, first.from) && samePoint(stem.to, first.to), id);
  }
});

/* ---- Insertion mark on the foot ---- */

const MARKS = ['front-loop', 'back-loop', 'front-post', 'back-post'];

for (const id of ['sc', 'hdc', 'dc', 'tr']) {
  for (const insertion of MARKS) {
    test(`${id}, ${insertion}: one mark on the foot`, () => {
      const shapes = symbolShapes(stitchById(id), { singleCrochet: 'plus', insertion });
      const marks = shapes.filter((shape) => MARKS.includes(shape.role));
      assert.equal(marks.length, 1);
      assert.equal(marks[0].role, insertion);
      for (const point of [marks[0].from, marks[0].control, marks[0].to]) {
        assert.ok(Math.hypot(point.x, point.y) <= 10, `too far from the foot: ${point.x}, ${point.y}`);
      }
    });
  }
}

test('the front post mark opens to the right and the back post mark to the left', () => {
  const mark = (insertion) =>
    symbolShapes(stitchById('dc'), { singleCrochet: 'plus', insertion }).find((s) => s.role === insertion);
  assert.ok(mark('front-post').to.x > 0);
  assert.ok(mark('back-post').to.x < 0);
});

test('both loops, chain space and ring get no insertion mark', () => {
  for (const insertion of ['both-loops', 'space', 'ring']) {
    const shapes = symbolShapes(stitchById('dc'), { singleCrochet: 'plus', insertion });
    assert.equal(shapes.filter((shape) => MARKS.includes(shape.role)).length, 0, insertion);
  }
});

test('a stitch worked across several stitches marks every one of its feet', () => {
  const shapes = symbolShapes(stitchById('sc2tog'), { singleCrochet: 'plus', insertion: 'back-loop' });
  const feet = stems(shapes).map((stem) => stem.from.x);
  const marks = shapes.filter((shape) => shape.role === 'back-loop');
  assert.deepEqual(
    marks.map((mark) => (mark.from.x + mark.to.x) / 2),
    feet,
  );
});

test('a forbidden insertion mode throws', () => {
  const cases = [
    ['ch', 'front-loop'],
    ['sl-st', 'front-post'],
    ['rev-sc', 'back-loop'],
    ['invdec', 'both-loops'],
  ];
  for (const [id, insertion] of cases) {
    assert.throws(() => symbolShapes(stitchById(id), { singleCrochet: 'plus', insertion }), RangeError, id);
  }
});

/* ---- Single crochet: + or × ---- */

test('single crochet defaults to +, with the cross bar lying on the axis of the row', () => {
  const shapes = symbolShapes(stitchById('sc'));
  const cross = shapes.find((shape) => shape.role === 'cross');
  // In the own space of the symbol the axis of the row is the horizontal (PQW-931).
  assert.ok(near(cross.from.y, cross.to.y));
  assert.ok(Math.abs(cross.to.x - cross.from.x) > 1);
  // With an upright stem this is perpendicular to the stem as well: the earlier assertion still holds.
  const [stem] = stems(shapes);
  const dot =
    (stem.to.x - stem.from.x) * (cross.to.x - cross.from.x) + (stem.to.y - stem.from.y) * (cross.to.y - cross.from.y);
  assert.ok(near(dot, 0));
});

test('in an increase fan the cross bar stays horizontal even on the slanted stems', () => {
  const shapes = symbolShapes(stitchById('inc-2sc'));
  const crosses = shapes.filter((shape) => shape.role === 'cross');
  assert.equal(crosses.length, 2);
  // The + does not rotate with the lean of the fan stems (PQW-929, PQW-931).
  for (const cross of crosses) assert.ok(near(cross.from.y, cross.to.y), JSON.stringify(cross));
  // The stems did stay slanted, though: the symbol was not straightened out.
  assert.ok(stems(shapes).every((stem) => Math.abs(stem.to.x - stem.from.x) > 1));
});

test('with the × setting there are two diagonals and no upright stem, in compound symbols too', () => {
  const options = { singleCrochet: 'cross' };
  const sc = symbolShapes(stitchById('sc'), options);
  assert.deepEqual(roleCounts(sc), only({ cross: 2 }));
  for (const arm of sc) assert.ok(near(Math.abs(arm.to.x - arm.from.x), Math.abs(arm.to.y - arm.from.y)));

  assert.deepEqual(roleCounts(symbolShapes(stitchById('inc-2sc'), options)), only({ cross: 4 }));
  assert.deepEqual(roleCounts(symbolShapes(stitchById('dc'), options)), roleCounts(symbolShapes(stitchById('dc'))));
});

/* ---- Japanese (JIS) symbol style (PQW-868) ---- */

test('in JIS style single crochet is always an ×, whatever the + setting says, in compound symbols too', () => {
  const jis = { singleCrochet: 'plus', style: 'jis' };
  assert.deepEqual(roleCounts(symbolShapes(stitchById('sc'), jis)), only({ cross: 2 }));
  assert.deepEqual(roleCounts(symbolShapes(stitchById('sc2tog'), jis)), only({ cross: 4 }));
});

test('in JIS style the back loop is a horizontal line below the foot', () => {
  const [mark] = symbolShapes(stitchById('dc'), { singleCrochet: 'plus', style: 'jis', insertion: 'back-loop' }).filter(
    (shape) => shape.role === 'back-loop',
  );
  assert.equal(mark.kind, 'line');
  assert.ok(near(mark.from.y, mark.to.y) && mark.from.y > 0);
  assert.ok(mark.from.x < 0 && mark.to.x > 0);
  assert.ok(Math.hypot(mark.from.x, mark.from.y) <= 10);
});

test('in JIS style every stitch uses the CYC symbol with × single crochet; only the back loop and the magic ring differ', () => {
  for (const def of STITCHES.filter((stitch) => stitch.kind !== 'ring')) {
    for (const singleCrochet of ['plus', 'cross']) {
      const jis = symbolShapes(def, { singleCrochet, style: 'jis' });
      assert.deepEqual(jis, symbolShapes(def, { singleCrochet: 'cross' }), `${def.id}, ${singleCrochet}`);
    }
  }
  for (const insertion of ['front-loop', 'front-post', 'back-post']) {
    const jis = symbolShapes(stitchById('hdc'), { singleCrochet: 'plus', style: 'jis', insertion });
    assert.deepEqual(jis, symbolShapes(stitchById('hdc'), { singleCrochet: 'cross', insertion }), insertion);
  }
});

/* ---- Filling out the JIS symbol set (PQW-876) ---- */

test('in JIS style the magic ring is the „わ” symbol: drawn from its own lines, with no circle, in the place and size of the circle', () => {
  const ring = stitchById('magic-ring');
  const jis = symbolShapes(ring, { singleCrochet: 'plus', style: 'jis' });
  assert.ok(jis.length >= 4);
  assert.ok(jis.every((shape) => shape.role === 'ring' && (shape.kind === 'line' || shape.kind === 'curve')));
  const [circle, wa] = [shapeBounds(symbolShapes(ring)), shapeBounds(jis)];
  assert.ok(wa.minX >= circle.minX && wa.maxX <= circle.maxX && wa.minY >= circle.minY && wa.maxY <= circle.maxY);
  assert.ok(wa.maxX - wa.minX > 10 && wa.maxY - wa.minY > 10, 'big enough to read');
});

test('the same on the chart: in JIS style the magic ring is „わ”, in CYC a circle', () => {
  const ring = stitchById('magic-ring');
  const placement = { role: 'ring', feet: [], top: { x: 50, y: 40 }, angle: 0, size: 20 };
  assert.deepEqual(roleCounts(placedShapes(ring, placement)), only({ ring: 1 }));
  const jis = placedShapes(ring, placement, { singleCrochet: 'plus', style: 'jis' });
  assert.ok(jis.length >= 4 && jis.every((shape) => shape.kind !== 'ellipse'));
  const { minX, maxX, minY, maxY } = shapeBounds(jis);
  assert.ok(minX >= 40 && maxX <= 60 && minY >= 30 && maxY <= 50);
});

test('in JIS style reverse single crochet is the × single crochet with a wavy line above it', () => {
  const shapes = symbolShapes(stitchById('rev-sc'), { singleCrochet: 'plus', style: 'jis' });
  assert.deepEqual(roleCounts(shapes), only({ cross: 2, tilde: 2 }));
  const top = Math.min(...shapes.filter((s) => s.role === 'cross').flatMap((s) => [s.from.y, s.to.y]));
  assert.ok(shapes.filter((s) => s.role === 'tilde').every((s) => s.from.y < top && s.to.y < top));
});

test('every symbol has a finite, non-empty bounding box', () => {
  for (const def of STITCHES) {
    const { minX, minY, maxX, maxY } = shapeBounds(symbolShapes(def));
    assert.ok([minX, minY, maxX, maxY].every(Number.isFinite), def.id);
    assert.ok(maxX > minX && maxY > minY, def.id);
  }
});
