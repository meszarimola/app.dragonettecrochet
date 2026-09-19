/*
 * The geometry of a fan (PQW-968). Chart coordinates grow downward and angles
 * are degrees clockwise from straight up, so a member's rotation reads like a
 * stitch's. A stitch is stored by the centre of its glyph box: its base is the
 * end a crocheter works from, its top the end the hook leaves.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { fanAngles, fanShapes, memberSize } from '../src/core/irregular-fan.ts';
import { DEFAULT_FAN_COUNT, DEFAULT_FAN_SPREAD } from '../src/core/irregular-types.ts';

const near = (actual, expected, message, slack = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= slack, `${message}: ${actual} vs ${expected}`);

const nearPoint = (actual, expected, message, slack = 1e-9) => {
  near(actual.x, expected.x, `${message} (x)`, slack);
  near(actual.y, expected.y, `${message} (y)`, slack);
};

const radians = (degrees) => (degrees * Math.PI) / 180;

const turn = (degrees) => ((degrees % 360) + 360) % 360;

const baseOf = (shape) => ({
  x: shape.at.x - Math.sin(radians(shape.rotation)) * (shape.height / 2),
  y: shape.at.y + Math.cos(radians(shape.rotation)) * (shape.height / 2),
});

const topOf = (shape) => ({
  x: shape.at.x + Math.sin(radians(shape.rotation)) * (shape.height / 2),
  y: shape.at.y - Math.cos(radians(shape.rotation)) * (shape.height / 2),
});

const glyph = { width: 12, height: 30 };

const fan = (spec) => ({
  mode: 'spread',
  origin: { x: 0, y: 0 },
  direction: 0,
  spreadAngle: DEFAULT_FAN_SPREAD,
  length: 60,
  count: DEFAULT_FAN_COUNT,
  ...spec,
});

const isFiniteShape = (shape, message) => {
  assert.ok(Number.isFinite(shape.at.x), `${message}: x is ${shape.at.x}`);
  assert.ok(Number.isFinite(shape.at.y), `${message}: y is ${shape.at.y}`);
  assert.ok(Number.isFinite(shape.rotation), `${message}: rotation is ${shape.rotation}`);
  assert.ok(Number.isFinite(shape.width), `${message}: width is ${shape.width}`);
  assert.ok(Number.isFinite(shape.height), `${message}: height is ${shape.height}`);
};

describe('the rays of a fan', () => {
  test('a five stitch fan pointing up over 120 degrees runs 300, 330, 0, 30, 60', () => {
    const angles = fanAngles(fan({}));
    assert.equal(angles.length, 5, 'five rays');
    for (const [index, expected] of [300, 330, 0, 30, 60].entries()) {
      near(angles[index], expected, `ray ${index}`);
    }
  });

  test('are normalised into a single turn whichever way the fan points', () => {
    for (const angle of fanAngles(fan({ direction: 350, spreadAngle: 340, count: 7 }))) {
      assert.ok(angle >= 0 && angle < 360, `inside one turn: ${angle}`);
    }
  });

  test('run in a stable order from one outer stitch to the other', () => {
    const angles = fanAngles(fan({ direction: 180, spreadAngle: 120, count: 5 }));
    near(angles[0], 120, 'the first outer stitch');
    near(angles[angles.length - 1], 240, 'the other outer stitch');
    for (const [index, angle] of angles.entries()) {
      if (index > 0) assert.ok(angle > angles[index - 1], `the fan keeps opening at ray ${index}: ${angle}`);
    }
    assert.deepEqual(fanAngles(fan({ direction: 180, count: 5 })), angles, 'the same order every call');
  });

  test('a single stitch takes the direction of the fan and ignores the spread', () => {
    assert.deepEqual(fanAngles(fan({ direction: 40, count: 1 })), [40], 'one ray along the direction');
    assert.deepEqual(fanAngles(fan({ direction: 40, spreadAngle: 300, count: 1 })), [40], 'still the one ray');
  });

  test('two stitches stand exactly the spread angle apart, half of it either side of the direction', () => {
    for (const spreadAngle of [5, 60, 120, 350]) {
      const [first, second] = fanAngles(fan({ direction: 20, spreadAngle, count: 2 }));
      near(turn(second - first), spreadAngle % 360, `${spreadAngle} degrees apart`);
      near(turn(20 - first), spreadAngle / 2, `half the spread short of the direction at ${spreadAngle}`);
      near(turn(second - 20), spreadAngle / 2, `half the spread past it at ${spreadAngle}`);
    }
  });

  test('every count gets exactly that many rays, rounded to whole stitches', () => {
    for (const count of [1, 2, 3, 7, 40]) {
      assert.equal(fanAngles(fan({ count })).length, count, `${count} rays`);
    }
    assert.equal(fanAngles(fan({ count: 4.6 })).length, 5, 'a fractional count is rounded');
    assert.equal(fanAngles(fan({ count: 4.2 })).length, 4, 'and rounded down when it is nearer the lower count');
  });
});

describe('a spread fan', () => {
  test('works every stitch into the origin', () => {
    const origin = { x: 25, y: -40 };
    for (const [index, shape] of fanShapes(fan({ origin }), glyph).entries()) {
      nearPoint(baseOf(shape), origin, `the base of stitch ${index}`);
    }
  });

  test('tops the middle stitch of an upward fan directly above the origin by its length', () => {
    const shapes = fanShapes(fan({ origin: { x: 10, y: 10 }, length: 60 }), glyph);
    const middle = shapes[2];
    near(middle.rotation, 0, 'the middle stitch points straight up');
    nearPoint(topOf(middle), { x: 10, y: -50 }, 'a length above the origin');
    nearPoint(middle.at, { x: 10, y: -20 }, 'and its centre is half a length up');
  });

  test('sends every top a length away from the origin, along its own ray', () => {
    const origin = { x: -12, y: 7 };
    const spec = fan({ origin, direction: 200, spreadAngle: 90, length: 45 });
    const angles = fanAngles(spec);
    for (const [index, shape] of fanShapes(spec, glyph).entries()) {
      near(Math.hypot(topOf(shape).x - origin.x, topOf(shape).y - origin.y), 45, `top ${index} stands a length off`);
      near(shape.rotation, angles[index], `stitch ${index} points along its ray`);
    }
  });
});

describe('a converge fan', () => {
  const origin = { x: 30, y: 12 };
  const spec = fan({ mode: 'converge', origin, direction: 180, spreadAngle: 100, length: 50 });

  test('meets every stitch at the origin with its top', () => {
    for (const [index, shape] of fanShapes(spec, glyph).entries()) {
      nearPoint(topOf(shape), origin, `the top of stitch ${index}`);
    }
  });

  test('stands every base a length away from the origin', () => {
    for (const [index, shape] of fanShapes(spec, glyph).entries()) {
      const base = baseOf(shape);
      near(Math.hypot(base.x - origin.x, base.y - origin.y), 50, `base ${index} stands a length off`);
    }
  });

  test('turns each stitch by half a turn against its spread counterpart', () => {
    const spread = fanShapes({ ...spec, mode: 'spread' }, glyph);
    for (const [index, shape] of fanShapes(spec, glyph).entries()) {
      near(shape.rotation, (spread[index].rotation + 180) % 360, `stitch ${index} points the other way`);
    }
  });

  test('puts its members at the same centres as a spread fan, only sharing the other end', () => {
    const spread = fanShapes({ ...spec, mode: 'spread' }, glyph);
    for (const [index, shape] of fanShapes(spec, glyph).entries()) {
      nearPoint(shape.at, spread[index].at, `the centre of stitch ${index}`);
      nearPoint(baseOf(shape), topOf(spread[index]), `the ends of stitch ${index} swap`);
      nearPoint(topOf(shape), baseOf(spread[index]), `the ends of stitch ${index} swap back`);
    }
  });
});

describe('how big a member is drawn', () => {
  test('is as tall as the fan is long, in either mode', () => {
    for (const mode of ['spread', 'converge']) {
      for (const length of [4, 60, 2000]) {
        for (const shape of fanShapes(fan({ mode, length }), glyph)) {
          near(shape.height, length, `a member of a ${mode} fan ${length} long`);
        }
      }
    }
  });

  test('keeps the natural proportions of the glyph as it stretches', () => {
    const ratio = glyph.width / glyph.height;
    for (const length of [4, 15, 60, 2000]) {
      for (const shape of fanShapes(fan({ length }), glyph)) {
        near(shape.width / shape.height, ratio, `the aspect ratio at ${length}`);
        near(shape.width, glyph.width * (length / glyph.height), `the width at ${length}`);
      }
    }
  });

  test('a glyph of no height still reaches the length, instead of dividing by zero', () => {
    const flat = { width: 9, height: 0 };
    const spec = fan({});
    const shapes = fanShapes(spec, flat);
    assert.equal(shapes.length, 5, 'still a whole fan');
    for (const [index, shape] of shapes.entries()) {
      isFiniteShape(shape, `member ${index}`);
      near(shape.width, 9, `member ${index} keeps the natural width`);
      // A glyph with no height of its own has no proportions to keep, but a
      // stitch with no height could not be seen at all.
      near(shape.height, spec.length, `member ${index} is as tall as the fan is long`);
    }
  });

  test('a glyph that is not a number falls back to a size a chart can draw', () => {
    const broken = [
      { width: Number.NaN, height: 30 },
      { width: 12, height: Number.NaN },
      { width: Number.POSITIVE_INFINITY, height: Number.POSITIVE_INFINITY },
    ];
    for (const size of broken) {
      const { width, height } = memberSize(size, 60);
      assert.ok(Number.isFinite(width), `the width is ${width}`);
      assert.ok(Number.isFinite(height), `the height is ${height}`);
    }
  });
});

describe('a broken fan cannot poison the geometry', () => {
  const broken = [
    { what: 'a direction that is not a number', spec: { direction: Number.NaN } },
    { what: 'an infinite direction', spec: { direction: Number.POSITIVE_INFINITY } },
    { what: 'a spread that is not a number', spec: { spreadAngle: Number.NaN } },
    { what: 'an infinite spread', spec: { spreadAngle: Number.NEGATIVE_INFINITY } },
    { what: 'a length that is not a number', spec: { length: Number.NaN } },
    { what: 'an infinite length', spec: { length: Number.POSITIVE_INFINITY } },
    { what: 'an origin that is not a number', spec: { origin: { x: Number.NaN, y: 0 } } },
    { what: 'an origin at infinity', spec: { origin: { x: 0, y: Number.POSITIVE_INFINITY } } },
    { what: 'a count that is not a number', spec: { count: Number.NaN } },
    { what: 'an infinite count', spec: { count: Number.POSITIVE_INFINITY } },
    { what: 'a count of none', spec: { count: 0 } },
    { what: 'a count below none', spec: { count: -3 } },
    { what: 'every field at once', spec: { direction: Number.NaN, spreadAngle: Number.NaN, length: Number.NaN } },
  ];

  for (const { what, spec } of broken) {
    for (const mode of ['spread', 'converge']) {
      test(`${what} gives a ${mode} fan finite members or none, and never throws`, () => {
        const shapes = fanShapes(fan({ ...spec, mode }), glyph);
        assert.ok(Array.isArray(shapes), 'an array either way');
        for (const [index, shape] of shapes.entries()) {
          isFiniteShape(shape, `${what}, member ${index}`);
          isFiniteShape({ ...shape, at: baseOf(shape) }, `${what}, the base of member ${index}`);
          isFiniteShape({ ...shape, at: topOf(shape) }, `${what}, the top of member ${index}`);
        }
      });
    }
  }

  test('a count below one asks for nothing and gets nothing', () => {
    assert.deepEqual(fanShapes(fan({ count: 0 }), glyph), [], 'no stitches');
    assert.deepEqual(fanShapes(fan({ count: -3 }), glyph), [], 'no stitches');
    assert.deepEqual(fanAngles(fan({ count: Number.NaN })), [], 'no rays to draw');
  });
});
