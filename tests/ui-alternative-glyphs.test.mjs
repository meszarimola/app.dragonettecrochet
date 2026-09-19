/*
 * The alternative glyph library a free-form pattern draws its own stitch key
 * from: every id yields shapes of the expected kinds, in the local space of
 * `symbolShapes` (the foot is the origin, the glyph stands above it), with a
 * measurable bounding box.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { ALTERNATIVE_GLYPHS, alternativeGlyphShapes, shapesBounds } from '../src/ui/symbols.ts';

const near = (a, b) => Math.abs(a - b) < 1e-9;
const isHorizontal = (shape) => near(shape.from.y, shape.to.y) && !near(shape.from.x, shape.to.x);
const isVertical = (shape) => near(shape.from.x, shape.to.x) && !near(shape.from.y, shape.to.y);
const length = (shape) => Math.hypot(shape.to.x - shape.from.x, shape.to.y - shape.from.y);
const midpoint = (shape) => ({ x: (shape.from.x + shape.to.x) / 2, y: (shape.from.y + shape.to.y) / 2 });

function kindCounts(shapes) {
  const counts = { line: 0, curve: 0, ellipse: 0, dot: 0 };
  for (const shape of shapes) counts[shape.kind] += 1;
  return counts;
}

function only(counts) {
  return { line: 0, curve: 0, ellipse: 0, dot: 0, ...counts };
}

// prettier-ignore
const GLYPHS = [
  ['oval', { ellipse: 1 }],
  ['zero', { ellipse: 1 }],
  ['dot', { dot: 1 }],
  ['arc', { curve: 1 }],
  ['plus', { line: 2 }],
  ['cross', { line: 2 }],
  ['asterisk', { line: 3 }],
  ['bar', { line: 1 }],
  ['dagger', { line: 2 }],
];

// A single upright line has no width, so only this one glyph has a flat box.
const FLAT = ['bar'];
const GLYPH_LIMIT = 20;

test('the exported list covers the union, in order and without duplicates', () => {
  assert.deepEqual(
    [...ALTERNATIVE_GLYPHS],
    GLYPHS.map(([id]) => id),
  );
  assert.equal(new Set(ALTERNATIVE_GLYPHS).size, ALTERNATIVE_GLYPHS.length);
});

for (const [id, expected] of GLYPHS) {
  test(`${id}: the parts of the glyph`, () => {
    const shapes = alternativeGlyphShapes(id);
    assert.ok(shapes.length > 0);
    assert.deepEqual(kindCounts(shapes), only(expected));
  });
}

for (const id of ALTERNATIVE_GLYPHS) {
  test(`${id}: the free-form editor can measure it`, () => {
    const bounds = shapesBounds(alternativeGlyphShapes(id));
    assert.ok(bounds !== null, 'no bounding box');
    const { minX, minY, maxX, maxY } = bounds;
    assert.ok([minX, minY, maxX, maxY].every(Number.isFinite), id);

    const [width, height] = [maxX - minX, maxY - minY];
    assert.ok(height > 0, `${id}: flat box`);
    assert.ok(FLAT.includes(id) ? width === 0 : width > 0, `${id}: flat box`);
    assert.ok(Math.hypot(width, height) > 1, `${id}: degenerate box`);
    assert.ok(width <= GLYPH_LIMIT && height <= GLYPH_LIMIT, `${id}: bigger than a single stitch symbol`);
  });
}

for (const id of ALTERNATIVE_GLYPHS) {
  test(`${id}: stands centred over the foot, so one glyph can replace another`, () => {
    const { minX, minY, maxX, maxY } = shapesBounds(alternativeGlyphShapes(id));
    assert.ok(near((minX + maxX) / 2, 0), `${id}: off the vertical axis`);
    // The foot is the origin and the glyph rises from it, as in `symbolShapes`.
    assert.ok(minY <= 0 && maxY >= 0, `${id}: does not sit on the foot`);
    assert.ok(Math.abs((minY + maxY) / 2) <= GLYPH_LIMIT / 2, `${id}: drifts off the origin`);
  });
}

test('the oval lies flat and the zero stands upright: the same ellipse, axes swapped', () => {
  const [oval] = alternativeGlyphShapes('oval');
  const [zero] = alternativeGlyphShapes('zero');
  assert.equal(oval.kind, 'ellipse');
  assert.equal(zero.kind, 'ellipse');
  assert.ok(oval.rx > oval.ry, 'the oval is wider than it is tall');
  assert.ok(zero.ry > zero.rx, 'the zero is taller than it is wide');
  assert.ok(near(oval.rx, zero.ry) && near(oval.ry, zero.rx));
});

test('the dot is one filled dot', () => {
  const [dot, ...rest] = alternativeGlyphShapes('dot');
  assert.equal(rest.length, 0);
  assert.equal(dot.kind, 'dot');
  assert.ok(dot.r > 0);
});

test('the arc opens downward: both ends sit on the foot line and it bulges upward', () => {
  const [arc] = alternativeGlyphShapes('arc');
  assert.equal(arc.kind, 'curve');
  assert.ok(near(arc.from.y, arc.to.y));
  assert.ok(arc.from.x < 0 && arc.to.x > 0);
  assert.ok(arc.control.y < arc.from.y, 'the control point pulls the arc upward');
});

test('the plus is one upright and one crossing line of equal arms', () => {
  const shapes = alternativeGlyphShapes('plus');
  assert.equal(shapes.filter(isVertical).length, 1);
  assert.equal(shapes.filter(isHorizontal).length, 1);
  const [first, second] = shapes;
  assert.ok(near(length(first), length(second)), 'equal arms');
  const [a, b] = [midpoint(first), midpoint(second)];
  assert.ok(near(a.x, b.x) && near(a.y, b.y), 'the arms cross in the middle');
});

test('the cross is two slanted lines crossing in the middle', () => {
  const shapes = alternativeGlyphShapes('cross');
  assert.equal(shapes.length, 2);
  for (const arm of shapes) {
    assert.ok(!isHorizontal(arm) && !isVertical(arm), 'a diagonal');
    assert.ok(near(Math.abs(arm.to.x - arm.from.x), Math.abs(arm.to.y - arm.from.y)), 'a true diagonal');
  }
  const [a, b] = shapes.map(midpoint);
  assert.ok(near(a.x, b.x) && near(a.y, b.y));
});

test('the asterisk is three lines through one centre: six arms, all different directions', () => {
  const shapes = alternativeGlyphShapes('asterisk');
  assert.equal(shapes.length, 3);
  const [centre, ...rest] = shapes.map(midpoint);
  for (const point of rest) assert.ok(near(point.x, centre.x) && near(point.y, centre.y));
  for (const arm of shapes) assert.ok(near(length(arm), length(shapes[0])), 'equal arms');
  const angles = shapes.map((arm) =>
    Math.round((Math.atan2(arm.to.y - arm.from.y, arm.to.x - arm.from.x) * 180) / Math.PI),
  );
  assert.equal(new Set(angles.map((angle) => ((angle % 180) + 180) % 180)).size, 3);
});

test('the bar is a single short upright line standing on the foot', () => {
  const [line, ...rest] = alternativeGlyphShapes('bar');
  assert.equal(rest.length, 0);
  assert.ok(isVertical(line));
  assert.ok(Math.min(line.from.y, line.to.y) < 0 && Math.max(line.from.y, line.to.y) <= 0);
});

test('the dagger is an upright line with one shorter cross bar near its top', () => {
  const shapes = alternativeGlyphShapes('dagger');
  const [stem] = shapes.filter(isVertical);
  const [bar] = shapes.filter(isHorizontal);
  assert.ok(stem !== undefined && bar !== undefined);
  assert.ok(length(bar) < length(stem));
  const top = Math.min(stem.from.y, stem.to.y);
  assert.ok(bar.from.y < top / 2, 'the bar sits in the upper half of the stem');
  assert.ok(bar.from.y > top, 'and stays below the top');
  assert.ok(near((bar.from.x + bar.to.x) / 2, stem.from.x), 'the bar is centred on the stem');
});
