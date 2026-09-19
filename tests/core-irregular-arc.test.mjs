/*
 * The geometry of a chain arc (PQW-967). Chart coordinates grow downward and
 * angles are degrees clockwise from straight up, so a stop's angle reads like
 * a stitch's rotation. A positive bulge bows the path to the left of the
 * direction start → end, which on screen is upward for a left-to-right drag.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { arcAt, arcHandle, arcLength, arcStops, bulgeThrough, presetBulge } from '../src/core/irregular-arc.ts';
import { DEFAULT_ARC_BULGE } from '../src/core/irregular-types.ts';

const near = (actual, expected, message, slack = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= slack, `${message}: ${actual} vs ${expected}`);

const nearPoint = (actual, expected, message, slack = 1e-9) => {
  near(actual.x, expected.x, `${message} (x)`, slack);
  near(actual.y, expected.y, `${message} (y)`, slack);
};

const group = (spec) => ({ shape: 'arc', start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, bulge: 0, count: 5, ...spec });

const isFiniteStop = (stop, message) => {
  assert.ok(Number.isFinite(stop.at.x), `${message}: x is ${stop.at.x}`);
  assert.ok(Number.isFinite(stop.at.y), `${message}: y is ${stop.at.y}`);
  assert.ok(Number.isFinite(stop.angle), `${message}: angle is ${stop.angle}`);
};

describe('the preset bulge', () => {
  test('is a quarter of the chord', () => {
    near(presetBulge({ x: 0, y: 0 }, { x: 100, y: 0 }), 25, 'a quarter of a hundred');
    near(presetBulge({ x: 0, y: 0 }, { x: 0, y: 80 }), 20, 'a quarter of eighty, downwards');
    near(presetBulge({ x: 10, y: 10 }, { x: 10, y: 10 }), 0, 'nothing to bow');
    near(DEFAULT_ARC_BULGE, 0.25, 'the preset share');
  });

  test('takes a share the caller chooses instead', () => {
    near(presetBulge({ x: 0, y: 0 }, { x: 100, y: 0 }, 0.5), 50, 'half the chord');
    near(presetBulge({ x: 0, y: 0 }, { x: 100, y: 0 }, 0), 0, 'no bow at all');
  });

  test('bows to the left of the drag, so dragging left to right bows upward', () => {
    const bulge = presetBulge({ x: 0, y: 0 }, { x: 100, y: 0 });
    assert.ok(bulge > 0, `the preset bulge is positive: ${bulge}`);
    const handle = arcHandle(group({ bulge }));
    assert.ok(handle.y < 0, `the middle of the arc stands above the chord: ${handle.y}`);
    nearPoint(handle, { x: 50, y: -25 }, 'a quarter of the chord above the middle');
  });

  test('dragging right to left bows downward, the same side of the drag', () => {
    const bowed = group({ start: { x: 100, y: 0 }, end: { x: 0, y: 0 }, bulge: 25 });
    const handle = arcHandle(bowed);
    assert.ok(handle.y > 0, `the middle of the arc stands below the chord: ${handle.y}`);
    nearPoint(handle, { x: 50, y: 25 }, 'a quarter of the chord below the middle');
  });
});

describe('where the stitches sit', () => {
  test('are evenly spaced by arc length, inset half a spacing at each end', () => {
    const stops = arcStops(group({ shape: 'straight', count: 4 }));
    assert.equal(stops.length, 4, 'four stitches');
    const expected = [12.5, 37.5, 62.5, 87.5];
    for (const [index, x] of expected.entries()) {
      nearPoint(stops[index].at, { x, y: 0 }, `stop ${index}`);
    }
  });

  test('run in working order from the start end to the finish', () => {
    const stops = arcStops(group({ shape: 'straight', start: { x: 100, y: 0 }, end: { x: 0, y: 0 }, count: 4 }));
    const xs = stops.map((stop) => stop.at.x);
    assert.deepEqual(xs, [87.5, 62.5, 37.5, 12.5], 'backwards along the chord');
  });

  test('a single stitch sits in the middle of the path', () => {
    nearPoint(arcStops(group({ shape: 'straight', count: 1 }))[0].at, { x: 50, y: 0 }, 'the middle of the chord');
    nearPoint(arcStops(group({ bulge: 25, count: 1 }))[0].at, arcHandle(group({ bulge: 25 })), 'the middle of the arc');
  });

  test('every count gets exactly that many stops', () => {
    for (const count of [1, 2, 3, 7, 40]) {
      assert.equal(arcStops(group({ bulge: 30, count })).length, count, `${count} stitches`);
      assert.equal(arcStops(group({ shape: 'straight', count })).length, count, `${count} stitches on the chord`);
    }
  });
});

describe('the angle a stitch takes on a straight path', () => {
  test('is the angle of the chord, the same at every stop', () => {
    const cases = [
      { end: { x: 100, y: 0 }, angle: 90, what: 'rightwards' },
      { end: { x: 0, y: 100 }, angle: 180, what: 'downwards' },
      { end: { x: 0, y: -100 }, angle: 0, what: 'upwards' },
      { end: { x: -100, y: 0 }, angle: 270, what: 'leftwards' },
    ];
    for (const { end, angle, what } of cases) {
      for (const stop of arcStops(group({ shape: 'straight', end, count: 4 }))) {
        near(stop.angle, angle, `${what}`);
      }
    }
  });

  test('a straight shape ignores the bulge altogether', () => {
    const straight = group({ shape: 'straight', bulge: 40, count: 4 });
    assert.deepEqual(arcStops(straight), arcStops(group({ shape: 'straight', bulge: 0, count: 4 })), 'the same stops');
    nearPoint(arcHandle(straight), { x: 50, y: 0 }, 'the handle stays on the chord');
    near(arcLength(straight), 100, 'the chord itself');
  });
});

describe('a bowed arc', () => {
  const bowed = group({ bulge: 25, count: 5 });
  const chord = 100;
  const sagitta = 25;
  const radius = ((chord / 2) ** 2 + sagitta ** 2) / (2 * sagitta);
  const center = { x: 50, y: radius - sagitta };

  test('turns the stitches along the path, the middle one square to the chord', () => {
    const angles = arcStops(bowed).map((stop) => stop.angle);
    for (const [index, angle] of angles.entries()) {
      if (index > 0) assert.ok(angle > angles[index - 1], `the angle keeps turning at stop ${index}: ${angle}`);
    }
    near(angles[2], 90, 'the middle stitch follows the chord');
    assert.ok(angles[0] < 90, `the first stitch is still climbing: ${angles[0]}`);
    assert.ok(angles[4] > 90, `the last stitch is already falling: ${angles[4]}`);
    near(angles[0] + angles[4], 180, 'the two ends turn by the same amount');
  });

  test('is a circle: every stop stands the same distance from its centre', () => {
    for (const [index, stop] of arcStops(group({ bulge: 25, count: 9 })).entries()) {
      near(Math.hypot(stop.at.x - center.x, stop.at.y - center.y), radius, `stop ${index} sits on the circle`, 1e-9);
    }
  });

  test('the first and last stops are mirror images about the middle of the chord', () => {
    const stops = arcStops(group({ bulge: 25, count: 6 }));
    const last = stops[stops.length - 1];
    near(stops[0].at.x + last.at.x, 100, 'the same distance in from each end');
    near(stops[0].at.y, last.at.y, 'and the same height');
  });

  test('the stops are a constant step apart, which is what even by arc length means', () => {
    const stops = arcStops(group({ bulge: 40, count: 8 }));
    const steps = stops
      .slice(1)
      .map((stop, index) => Math.hypot(stop.at.x - stops[index].at.x, stop.at.y - stops[index].at.y));
    for (const [index, step] of steps.entries()) near(step, steps[0], `step ${index}`);
  });

  test('runs from the start to the end, through the handle', () => {
    nearPoint(arcAt(bowed, 0).at, bowed.start, 'the start');
    nearPoint(arcAt(bowed, 1).at, bowed.end, 'the end');
    nearPoint(arcAt(bowed, 0.5).at, arcHandle(bowed), 'the middle');
  });

  test('a bulge of half the chord is a half circle, and is pi times the radius long', () => {
    const half = group({ bulge: 50 });
    near(arcLength(half), Math.PI * 50, 'half a circle of radius fifty', 1e-9);
    nearPoint(arcHandle(half), { x: 50, y: -50 }, 'the top of the circle');
  });

  test('is longer than the chord, and the deeper the bow the longer it gets', () => {
    const lengths = [10, 25, 50, 90].map((bulge) => arcLength(group({ bulge })));
    assert.ok(lengths[0] > 100, `even a shallow bow is longer than the chord: ${lengths[0]}`);
    for (const [index, length] of lengths.entries()) {
      if (index > 0) assert.ok(length > lengths[index - 1], `a deeper bow is longer at ${index}: ${length}`);
    }
  });

  test('bowing the other way mirrors the path across the chord', () => {
    const up = arcStops(group({ bulge: 25, count: 5 }));
    const down = arcStops(group({ bulge: -25, count: 5 }));
    for (const [index, stop] of up.entries()) {
      nearPoint(down[index].at, { x: stop.at.x, y: -stop.at.y }, `stop ${index} mirrored`);
    }
    near(arcLength(group({ bulge: -25 })), arcLength(group({ bulge: 25 })), 'the same length either way');
  });
});

describe('the handle that adjusts the bulge', () => {
  test('stands the bulge off the middle of the chord, on the left of the drag', () => {
    nearPoint(arcHandle(group({ bulge: 30 })), { x: 50, y: -30 }, 'above a rightward chord');
    nearPoint(arcHandle(group({ bulge: -30 })), { x: 50, y: 30 }, 'below it when the bulge turns negative');
    const down = group({ end: { x: 0, y: 100 }, bulge: 20 });
    nearPoint(arcHandle(down), { x: 20, y: 50 }, 'to the left of a downward chord, which is to the right on screen');
  });

  test('a drag onto it gives back the very bulge it was drawn from', () => {
    const cases = [
      { start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, bulge: 25 },
      { start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, bulge: -25 },
      { start: { x: 40, y: 10 }, end: { x: -20, y: 70 }, bulge: 13.5 },
      { start: { x: -5, y: -5 }, end: { x: -5, y: 45 }, bulge: -7.25 },
    ];
    for (const spec of cases) {
      const arc = group(spec);
      near(bulgeThrough(arc.start, arc.end, arcHandle(arc)), arc.bulge, `the round trip for ${arc.bulge}`);
    }
  });

  test('dragged across to the other side of the chord, the bulge changes sign', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 100, y: 0 };
    assert.ok(bulgeThrough(start, end, { x: 50, y: -30 }) > 0, 'above the chord is the left side');
    assert.ok(bulgeThrough(start, end, { x: 50, y: 30 }) < 0, 'below the chord is the right side');
    near(bulgeThrough(start, end, { x: 50, y: 30 }), -bulgeThrough(start, end, { x: 50, y: -30 }), 'mirrored');
    near(bulgeThrough(start, end, { x: 50, y: 0 }), 0, 'on the chord there is no bow');
  });

  test('only the offset across the chord counts, not how far along it the drag lands', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 100, y: 0 };
    near(bulgeThrough(start, end, { x: 10, y: -18 }), 18, 'near the start');
    near(bulgeThrough(start, end, { x: 95, y: -18 }), 18, 'near the end');
  });
});

describe('degenerate paths still answer', () => {
  test('a zero bulge draws exactly the straight chord', () => {
    const flat = group({ bulge: 0, count: 5 });
    assert.deepEqual(arcStops(flat), arcStops(group({ shape: 'straight', count: 5 })), 'the same stops');
    near(arcLength(flat), 100, 'the chord');
    nearPoint(arcHandle(flat), { x: 50, y: 0 }, 'the middle of the chord');
  });

  test('a bulge too small to bend anything degrades to the chord instead of exploding', () => {
    const hair = group({ bulge: 1e-14, count: 4 });
    assert.deepEqual(arcStops(hair), arcStops(group({ shape: 'straight', count: 4 })), 'the same stops');
    near(arcLength(hair), 100, 'still the chord');
  });

  test('a chord of no length gives its count of stops, all at the start', () => {
    const point = group({ start: { x: 7, y: 9 }, end: { x: 7, y: 9 }, bulge: 20, count: 4 });
    const stops = arcStops(point);
    assert.equal(stops.length, 4, 'four stitches all the same');
    for (const [index, stop] of stops.entries()) {
      isFiniteStop(stop, `stop ${index}`);
      nearPoint(stop.at, { x: 7, y: 9 }, `stop ${index} sits on the start`);
      near(stop.angle, 0, `stop ${index} takes a settled angle`);
    }
    near(arcLength(point), 0, 'no path to walk');
    nearPoint(arcHandle(point), { x: 7, y: 9 }, 'the handle has nowhere else to be');
    near(bulgeThrough(point.start, point.end, { x: 50, y: 50 }), 0, 'no chord to measure across');
  });

  test('a count below one asks for nothing and gets nothing', () => {
    assert.deepEqual(arcStops(group({ bulge: 25, count: 0 })), [], 'no stitches');
    assert.deepEqual(arcStops(group({ bulge: 25, count: -3 })), [], 'no stitches');
  });
});

describe('a broken input cannot poison the geometry', () => {
  const broken = [
    { what: 'a start that is not a number', spec: { start: { x: Number.NaN, y: 0 }, bulge: 25 } },
    { what: 'an end at infinity', spec: { end: { x: Number.POSITIVE_INFINITY, y: 0 }, bulge: 25 } },
    { what: 'a bulge that is not a number', spec: { bulge: Number.NaN } },
    { what: 'an infinite bulge', spec: { bulge: Number.POSITIVE_INFINITY } },
    { what: 'an enormous bulge', spec: { bulge: 1e308 } },
    { what: 'a count that is not a number', spec: { bulge: 25, count: Number.NaN } },
    { what: 'a straight shape with a broken bulge', spec: { shape: 'straight', bulge: Number.NaN } },
  ];

  for (const { what, spec } of broken) {
    test(`${what} falls back instead of returning NaN`, () => {
      const arc = group(spec);
      assert.ok(Number.isFinite(arcLength(arc)), `the length is ${arcLength(arc)}`);
      const handle = arcHandle(arc);
      assert.ok(Number.isFinite(handle.x) && Number.isFinite(handle.y), `the handle is ${handle.x}, ${handle.y}`);
      assert.ok(Number.isFinite(bulgeThrough(arc.start, arc.end, handle)), 'the bulge read back is a number');
      for (const t of [0, 0.25, 0.5, 1]) isFiniteStop(arcAt(arc, t), `${what} at ${t}`);
      for (const [index, stop] of arcStops(arc).entries()) isFiniteStop(stop, `${what}, stop ${index}`);
    });
  }

  test('a fraction that is not a number lands on the start of the path', () => {
    const arc = group({ bulge: 25 });
    nearPoint(arcAt(arc, Number.NaN).at, arc.start, 'the start');
    isFiniteStop(arcAt(arc, Number.POSITIVE_INFINITY), 'an infinite fraction');
  });

  test('a drag onto a broken point reads back as a number', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 100, y: 0 };
    assert.ok(Number.isFinite(bulgeThrough(start, end, { x: Number.NaN, y: -20 })), 'a broken x');
    assert.ok(Number.isFinite(bulgeThrough(start, end, { x: 50, y: Number.POSITIVE_INFINITY })), 'a broken y');
  });
});
