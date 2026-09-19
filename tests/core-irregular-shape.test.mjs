/*
 * The shape a row is arranged on (PQW-969). Chart coordinates grow downward and
 * angles are degrees clockwise from straight up, so a stop's direction and a
 * stitch's rotation read the same way. A stitch is stored by the centre of its
 * glyph box, but it is worked from its base up, so arranging places base points.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import {
  basePoint,
  fitShape,
  placeOnShape,
  shapeAt,
  shapeLength,
  shapeRotation,
  shapeStops,
  suggestShape,
} from '../src/core/irregular-shape.ts';
import { FIT_TOLERANCE } from '../src/core/irregular-types.ts';

const near = (actual, expected, message, slack = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= slack, `${message}: ${actual} vs ${expected}`);

const nearPoint = (actual, expected, message, slack = 1e-9) => {
  near(actual.x, expected.x, `${message} (x)`, slack);
  near(actual.y, expected.y, `${message} (y)`, slack);
};

const line = (spec) => ({
  shape: 'line',
  start: { x: 0, y: 0 },
  end: { x: 100, y: 0 },
  side: 'left',
  perpendicular: true,
  ...spec,
});

const arc = (spec) => ({
  shape: 'arc',
  start: { x: 0, y: 0 },
  end: { x: 200, y: 0 },
  bulge: 40,
  side: 'left',
  perpendicular: true,
  ...spec,
});

const circle = (spec) => ({
  shape: 'circle',
  center: { x: 0, y: 0 },
  radius: 50,
  startAngle: 0,
  side: 'outside',
  perpendicular: true,
  ...spec,
});

let made = 0;
const nextStitchId = () => {
  made += 1;
  return `i${made}`;
};

const stitch = (spec) => ({
  id: nextStitchId(),
  kind: 'stitch',
  keyEntryId: 'dc',
  insertion: 'both-loops',
  rowId: 'r1',
  layerId: 'l1',
  color: null,
  x: 0,
  y: 0,
  width: 12,
  height: 20,
  rotation: 0,
  flipX: false,
  flipY: false,
  ...spec,
});

/** A stitch whose base lands exactly on `base`, built the way the editor builds one. */
const standing = (base, rotation, height = 20) => {
  const radians = (rotation * Math.PI) / 180;
  return stitch({
    x: base.x + Math.sin(radians) * (height / 2),
    y: base.y - Math.cos(radians) * (height / 2),
    rotation,
    height,
  });
};

const isFiniteStop = (stop, message) => {
  assert.ok(Number.isFinite(stop.at.x), `${message}: x is ${stop.at.x}`);
  assert.ok(Number.isFinite(stop.at.y), `${message}: y is ${stop.at.y}`);
  assert.ok(Number.isFinite(stop.along), `${message}: along is ${stop.along}`);
};

describe('the base point of a stitch', () => {
  test('sits half a height below the centre when the stitch stands upright', () => {
    nearPoint(basePoint({ x: 30, y: 50, rotation: 0, height: 20 }), { x: 30, y: 60 }, 'below the centre');
  });

  test('swings round with the rotation', () => {
    nearPoint(basePoint({ x: 30, y: 50, rotation: 90, height: 20 }), { x: 20, y: 50 }, 'a quarter turn');
    nearPoint(basePoint({ x: 30, y: 50, rotation: 180, height: 20 }), { x: 30, y: 40 }, 'upside down', 1e-12);
  });

  test('is the formula at every rotation', () => {
    const item = { x: 7, y: -3, height: 18 };
    for (const rotation of [0, 15, 45, 90, 137.5, 180, 264, 359]) {
      const radians = (rotation * Math.PI) / 180;
      const expected = {
        x: item.x - Math.sin(radians) * (item.height / 2),
        y: item.y + Math.cos(radians) * (item.height / 2),
      };
      nearPoint(basePoint({ ...item, rotation }), expected, `rotation ${rotation}`);
    }
  });

  test('a stitch of no height has its base at its centre', () => {
    nearPoint(basePoint({ x: 4, y: 5, rotation: 33, height: 0 }), { x: 4, y: 5 }, 'nowhere else to be');
  });
});

describe('the length of a shape', () => {
  test('a line is the distance between its ends', () => {
    near(shapeLength(line()), 100, 'a hundred across');
    near(shapeLength(line({ end: { x: 30, y: 40 } })), 50, 'a three four five triangle');
  });

  test('an arc is longer than its chord', () => {
    assert.ok(shapeLength(arc()) > 200, `the arc outruns its chord: ${shapeLength(arc())}`);
    near(shapeLength(arc({ bulge: 0 })), 200, 'a flat arc is the chord itself');
  });

  test('a circle is the whole way round', () => {
    near(shapeLength(circle()), 2 * Math.PI * 50, 'two pi r');
    near(shapeLength(circle({ radius: 0 })), 0, 'a circle of no size');
  });
});

describe('where the stitches go on a shape', () => {
  test('five stitches on a line of a hundred sit at 0, 25, 50, 75 and 100 along it', () => {
    const stops = shapeStops(line(), 5);
    assert.equal(stops.length, 5, 'five places');
    for (const [index, x] of [0, 25, 50, 75, 100].entries()) {
      nearPoint(stops[index].at, { x, y: 0 }, `stop ${index}`);
      near(stops[index].along, 90, `stop ${index} runs rightwards`);
    }
  });

  test('the first sits at the start of an open shape and the last at its end', () => {
    const stops = shapeStops(arc(), 7);
    nearPoint(stops[0].at, arc().start, 'the first is at the start');
    nearPoint(stops[6].at, arc().end, 'the last is at the end');
  });

  test('the stitches on an arc are a constant step apart', () => {
    const stops = shapeStops(arc(), 9);
    const steps = stops
      .slice(1)
      .map((stop, index) => Math.hypot(stop.at.x - stops[index].at.x, stop.at.y - stops[index].at.y));
    for (const [index, step] of steps.entries()) near(step, steps[0], `step ${index}`, 1e-9);
  });

  test('four stitches on a circle sit at twelve, three, six and nine o’clock, clockwise', () => {
    const stops = shapeStops(circle(), 4);
    const expected = [
      { x: 0, y: -50 },
      { x: 50, y: 0 },
      { x: 0, y: 50 },
      { x: -50, y: 0 },
    ];
    for (const [index, at] of expected.entries()) nearPoint(stops[index].at, at, `stop ${index}`, 1e-12);
  });

  test('the last stitch of a round does not land on the first', () => {
    const stops = shapeStops(circle(), 8);
    const apart = Math.hypot(stops[7].at.x - stops[0].at.x, stops[7].at.y - stops[0].at.y);
    assert.ok(apart > 1, `the round is left open for the next one: ${apart}`);
    near(apart, Math.hypot(stops[1].at.x - stops[0].at.x, stops[1].at.y - stops[0].at.y), 'by one even step');
  });

  test('a round starts where its start angle says', () => {
    nearPoint(shapeStops(circle({ startAngle: 90 }), 4)[0].at, { x: 50, y: 0 }, 'three o’clock');
    nearPoint(shapeStops(circle({ startAngle: 180 }), 4)[0].at, { x: 0, y: 50 }, 'six o’clock', 1e-12);
  });

  test('a single stitch on an open shape stands at the start', () => {
    nearPoint(shapeStops(line(), 1)[0].at, line().start, 'the start of the line');
  });

  test('a count below one asks for nothing and gets nothing', () => {
    for (const count of [0, -4, Number.NaN]) {
      assert.deepEqual(shapeStops(line(), count), [], `count ${count}`);
      assert.deepEqual(shapeStops(circle(), count), [], `count ${count} on a circle`);
    }
  });

  test('a fraction along the shape agrees with the stops it would give', () => {
    nearPoint(shapeAt(line(), 0.5).at, { x: 50, y: 0 }, 'halfway along the line');
    nearPoint(shapeAt(circle(), 0.5).at, { x: 0, y: 50 }, 'halfway round the circle', 1e-12);
  });
});

describe('how far a stitch turns to stand on a shape', () => {
  test('on a rightward line the stitches stand up, and flipping the side turns them over', () => {
    const stop = shapeStops(line(), 3)[1];
    near(shapeRotation(line(), stop), 0, 'standing up on the left of the line');
    near(shapeRotation(line({ side: 'right' }), stop), 180, 'upside down on the right');
  });

  test('on a downward line the stitches lie across it', () => {
    const down = line({ end: { x: 0, y: 100 } });
    const stop = shapeStops(down, 3)[1];
    near(shapeRotation(down, stop), 90, 'a quarter turn off the way down');
    near(shapeRotation({ ...down, side: 'right' }, stop), 270, 'the other way');
  });

  test('on a circle each stitch points straight out from the centre', () => {
    const round = circle();
    for (const [index, stop] of shapeStops(round, 8).entries()) {
      const fromCenter = (Math.atan2(stop.at.x - round.center.x, round.center.y - stop.at.y) * 180) / Math.PI;
      const expected = (fromCenter + 360) % 360;
      near(shapeRotation(round, stop), expected, `stop ${index} faces out`, 1e-9);
    }
  });

  test('inside a circle the stitches face the centre instead', () => {
    const round = circle({ side: 'inside' });
    for (const [index, stop] of shapeStops(round, 4).entries()) {
      near(shapeRotation(round, stop), (index * 90 + 180) % 360, `stop ${index} faces in`, 1e-9);
    }
  });

  test('every rotation is normalised into a whole turn', () => {
    for (const along of [-720, -90, 0, 359.5, 1080]) {
      const rotation = shapeRotation(line(), { at: { x: 0, y: 0 }, along });
      assert.ok(rotation >= 0 && rotation < 360, `a rotation of ${rotation} for a direction of ${along}`);
    }
  });
});

describe('laying a row out on a shape', () => {
  test('moves the stitches by their base points, not by their centres', () => {
    const items = [standing({ x: 3, y: 4 }, 0), standing({ x: 80, y: 90 }, 40), standing({ x: -5, y: 12 }, 200)];
    const placed = placeOnShape(items, line());
    const stops = shapeStops(line(), 3);
    for (const [index, item] of placed.entries()) {
      nearPoint(basePoint(item), stops[index].at, `the base of stitch ${index} lands on its place`);
    }
    nearPoint(placed[0], { x: 0, y: -10 }, 'the centre stands half a height above the base', 1e-12);
  });

  test('turns every stitch perpendicular to the shape it stands on', () => {
    const items = [standing({ x: 0, y: 0 }, 17), standing({ x: 5, y: 5 }, 200), standing({ x: 9, y: 9 }, 300)];
    for (const item of placeOnShape(items, line())) near(item.rotation, 0, 'standing up on a rightward line');
    for (const item of placeOnShape(items, line({ side: 'right' }))) near(item.rotation, 180, 'upside down');
  });

  test('keeps every rotation untouched when the shape is not perpendicular', () => {
    const rotations = [17, 200, 300];
    const items = rotations.map((rotation, index) => standing({ x: index * 10, y: 0 }, rotation));
    const placed = placeOnShape(items, line({ perpendicular: false }));
    assert.deepEqual(
      placed.map((item) => item.rotation),
      rotations,
      'the crocheter keeps the angles she chose',
    );
    const stops = shapeStops(line(), 3);
    for (const [index, item] of placed.entries()) {
      nearPoint(basePoint(item), stops[index].at, `stitch ${index} still moves to its place`);
    }
  });

  test('stitches sharing a base point take one place together', () => {
    const shared = { x: 40, y: 40 };
    const items = [
      standing({ x: 0, y: 0 }, 0),
      standing(shared, 330),
      standing(shared, 0),
      standing(shared, 30),
      standing({ x: 90, y: 0 }, 0),
    ];
    const placed = placeOnShape(items, line({ perpendicular: false }));
    const bases = placed.map((item) => basePoint(item));
    const stops = shapeStops(line(), 3);
    nearPoint(bases[0], stops[0].at, 'the single stitch before the fan');
    for (const index of [1, 2, 3]) nearPoint(bases[index], stops[1].at, `fan member ${index} shares the place`);
    nearPoint(bases[4], stops[2].at, 'the single stitch after the fan');
    near(bases[4].x, 100, 'a fan of three and two singles fill three places, not five');
  });

  test('an empty row has nothing to lay out', () => {
    assert.deepEqual(placeOnShape([], line()), [], 'nothing in, nothing out');
  });

  test('deleting a stitch from the middle closes the gap evenly over the same span', () => {
    const items = [0, 1, 2, 3, 4].map((index) => standing({ x: index * 7, y: index * 3 }, 0));
    const placed = placeOnShape(items, line());
    const before = placed.map((item) => basePoint(item).x);
    assert.deepEqual(before, [0, 25, 50, 75, 100], 'five stitches evenly across the line');

    const kept = placed.filter((_, index) => index !== 2);
    const after = placeOnShape(kept, line()).map((item) => basePoint(item).x);
    near(after[0], 0, 'the row still starts where it started');
    near(after[3], 100, 'and still ends where it ended');
    const steps = after.slice(1).map((x, index) => x - after[index]);
    for (const [index, step] of steps.entries()) near(step, 100 / 3, `step ${index} is even`);
  });

  test('a row laid round a circle keeps its stitches on the circle', () => {
    const items = [0, 1, 2, 3, 4, 5].map((index) => standing({ x: index, y: index }, index * 11));
    for (const [index, item] of placeOnShape(items, circle()).entries()) {
      const base = basePoint(item);
      near(Math.hypot(base.x, base.y), 50, `stitch ${index} stands on the circle`, 1e-9);
    }
  });
});

describe('fitting a shape to where the stitches are', () => {
  test('points on a line fit the line and not the arc', () => {
    const points = [0, 1, 2, 3, 4].map((index) => ({ x: index * 10, y: index * 10 }));
    const fitted = fitShape(points);
    assert.equal(fitted?.shape, 'line', 'the simplest shape that fits');
    nearPoint(fitted.start, { x: 0, y: 0 }, 'spanning from the first point', 1e-9);
    nearPoint(fitted.end, { x: 40, y: 40 }, 'to the last', 1e-9);
    assert.equal(fitted.side, 'left', 'a fitted open shape carries the left side');
    assert.equal(fitted.perpendicular, true, 'and stands its stitches up');
  });

  test('a line fits even when the stitches wobble inside the tolerance', () => {
    const wobble = [0, 2, -3, 1, -1];
    const points = wobble.map((dy, index) => ({ x: index * 25, y: dy }));
    assert.equal(fitShape(points)?.shape, 'line', 'still a line');
    assert.equal(fitShape(points, 0.5), null, 'but not to a stricter eye');
  });

  test('points on a gentle arc fit the arc', () => {
    const points = shapeStops(arc(), 7).map((stop) => stop.at);
    const fitted = fitShape(points);
    assert.equal(fitted?.shape, 'arc', 'bent too far to be a line');
    assert.ok(Math.abs(fitted.bulge) > FIT_TOLERANCE, `and bent meaningfully: ${fitted.bulge}`);
  });

  test('points all the way round fit the circle', () => {
    const round = circle({ center: { x: 50, y: 50 }, radius: 80, startAngle: 0 });
    const fitted = fitShape(shapeStops(round, 12).map((stop) => stop.at));
    assert.equal(fitted?.shape, 'circle', 'the stitches closed the round');
    nearPoint(fitted.center, round.center, 'around the same centre', 1e-6);
    near(fitted.radius, round.radius, 'at the same radius', 1e-6);
    assert.equal(fitted.side, 'outside', 'a fitted circle faces out');
  });

  test('three quarters of a circle is still read as an arc', () => {
    const points = [0, 1, 2, 3, 4, 5, 6].map((index) => {
      const radians = ((index * 45 - 90) * Math.PI) / 180;
      return { x: 100 * Math.cos(radians), y: 100 * Math.sin(radians) };
    });
    assert.equal(fitShape(points)?.shape, 'arc', 'the gap they left is too wide to close');
  });

  test('a scattered handful fits nothing', () => {
    const scatter = [
      { x: 0, y: 0 },
      { x: 50, y: 4 },
      { x: 12, y: 61 },
      { x: 83, y: 19 },
      { x: 31, y: -44 },
      { x: 70, y: 72 },
    ];
    assert.equal(fitShape(scatter), null, 'no shape describes them');
  });

  test('fewer than two places cannot be fitted', () => {
    assert.equal(fitShape([]), null, 'nothing at all');
    assert.equal(fitShape([{ x: 5, y: 5 }]), null, 'a single stitch');
    assert.equal(
      fitShape([
        { x: 5, y: 5 },
        { x: 5, y: 5 },
        { x: 5, y: 5 },
      ]),
      null,
      'the same place three times',
    );
  });

  test('two places can only be a line', () => {
    const fitted = fitShape([
      { x: 10, y: 10 },
      { x: 60, y: 30 },
    ]);
    assert.equal(fitted?.shape, 'line', 'two points bend nothing');
    nearPoint(fitted.start, { x: 10, y: 10 }, 'from the first', 1e-9);
    nearPoint(fitted.end, { x: 60, y: 30 }, 'to the second', 1e-9);
  });

  test('a line is fitted in the direction the row was worked', () => {
    const points = [0, 1, 2, 3].map((index) => ({ x: 90 - index * 30, y: 0 }));
    const fitted = fitShape(points);
    nearPoint(fitted.start, { x: 90, y: 0 }, 'starting where the row starts', 1e-9);
    nearPoint(fitted.end, { x: 0, y: 0 }, 'ending where it ends', 1e-9);
  });

  test('the default tolerance is the shared one', () => {
    const points = [0, 1, 2, 3, 4].map((index) => ({ x: index * 25, y: index % 2 === 0 ? 0 : FIT_TOLERANCE - 0.5 }));
    assert.equal(fitShape(points)?.shape, 'line', 'a wobble inside the shared tolerance is still a line');
    assert.equal(fitShape(points, FIT_TOLERANCE)?.shape, 'line', 'and so it is when the caller names it');
    assert.equal(fitShape(points, 1)?.shape, undefined, 'a stricter eye refuses the same wobble');
  });

  test('fitting is stable: the stops of a shape fit back to that shape', () => {
    const straight = line({ start: { x: -20, y: 5 }, end: { x: 130, y: 65 } });
    const fittedLine = fitShape(shapeStops(straight, 7).map((stop) => stop.at));
    assert.equal(fittedLine?.shape, 'line', 'a line comes back a line');
    nearPoint(fittedLine.start, straight.start, 'the same start', 1e-6);
    nearPoint(fittedLine.end, straight.end, 'the same end', 1e-6);

    const bowed = arc({ start: { x: 10, y: 10 }, end: { x: 210, y: 40 }, bulge: 45 });
    const fittedArc = fitShape(shapeStops(bowed, 9).map((stop) => stop.at));
    assert.equal(fittedArc?.shape, 'arc', 'an arc comes back an arc');
    nearPoint(fittedArc.start, bowed.start, 'the same start', 1e-6);
    nearPoint(fittedArc.end, bowed.end, 'the same end', 1e-6);
    near(fittedArc.bulge, bowed.bulge, 'the same bow', 1e-6);

    const round = circle({ center: { x: -30, y: 20 }, radius: 65, startAngle: 137 });
    const fittedCircle = fitShape(shapeStops(round, 14).map((stop) => stop.at));
    assert.equal(fittedCircle?.shape, 'circle', 'a circle comes back a circle');
    nearPoint(fittedCircle.center, round.center, 'the same centre', 1e-6);
    near(fittedCircle.radius, round.radius, 'the same radius', 1e-6);
    near(fittedCircle.startAngle, round.startAngle, 'starting at the same stitch', 1e-6);
  });

  test('a bow bows the same way it was fitted from', () => {
    for (const bulge of [40, -40]) {
      const bowed = arc({ bulge });
      const fitted = fitShape(shapeStops(bowed, 9).map((stop) => stop.at));
      near(fitted.bulge, bulge, `a bulge of ${bulge} comes back`, 1e-6);
    }
  });
});

describe('suggesting a shape for a fresh arrange', () => {
  test('a line runs through the two stitches standing furthest apart', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 30, y: 40 },
      { x: 80, y: 10 },
    ];
    const suggested = suggestShape(points, 'line');
    assert.equal(suggested?.shape, 'line', 'a line was asked for');
    nearPoint(suggested.start, { x: 0, y: 0 }, 'from the first extreme');
    nearPoint(suggested.end, { x: 80, y: 10 }, 'to the other');
    assert.equal(suggested.perpendicular, true, 'standing its stitches up');
  });

  test('an arc takes the same ends and the preset bow', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 50, y: 2 },
      { x: 100, y: 0 },
    ];
    const suggested = suggestShape(points, 'arc');
    assert.equal(suggested?.shape, 'arc', 'an arc was asked for');
    near(suggested.bulge, 25, 'a quarter of the chord');
    assert.equal(suggested.side, 'left', 'bowing to the left of the row');
  });

  test('a circle takes the middle of the stitches and their average reach', () => {
    const points = [
      { x: 10, y: 0 },
      { x: -10, y: 0 },
      { x: 0, y: 20 },
      { x: 0, y: -20 },
    ];
    const suggested = suggestShape(points, 'circle');
    assert.equal(suggested?.shape, 'circle', 'a circle was asked for');
    nearPoint(suggested.center, { x: 0, y: 0 }, 'the middle of them all');
    near(suggested.radius, 15, 'the average distance out');
    assert.equal(suggested.side, 'outside', 'a suggested circle faces out');
  });

  test('suggests a shape even for stitches that do not fit it', () => {
    const scatter = [
      { x: 0, y: 0 },
      { x: 50, y: 4 },
      { x: 12, y: 61 },
      { x: 83, y: 19 },
      { x: 31, y: -44 },
    ];
    assert.equal(fitShape(scatter), null, 'nothing fits them');
    for (const kind of ['line', 'arc', 'circle']) {
      const suggested = suggestShape(scatter, kind);
      assert.equal(suggested?.shape, kind, `a ${kind} is still offered`);
    }
  });

  test('a suggested round starts at the first stitch of the row', () => {
    const points = [
      { x: 0, y: -50 },
      { x: 50, y: 0 },
      { x: 0, y: 50 },
      { x: -50, y: 0 },
    ];
    near(suggestShape(points, 'circle').startAngle, 0, 'twelve o’clock, where the round begins');
  });

  test('too few places to span cannot be suggested either', () => {
    for (const kind of ['line', 'arc', 'circle']) {
      assert.equal(suggestShape([], kind), null, `nothing to hang a ${kind} on`);
      assert.equal(suggestShape([{ x: 3, y: 3 }], kind), null, `one stitch is not a ${kind}`);
      assert.equal(
        suggestShape(
          [
            { x: 3, y: 3 },
            { x: 3, y: 3 },
          ],
          kind,
        ),
        null,
        `the same place twice is not a ${kind}`,
      );
    }
  });
});

describe('a broken input cannot poison the layout', () => {
  const broken = [
    { what: 'a line starting nowhere', shape: line({ start: { x: Number.NaN, y: 0 } }) },
    { what: 'a line ending at infinity', shape: line({ end: { x: Number.POSITIVE_INFINITY, y: 0 } }) },
    { what: 'a line of no length', shape: line({ end: { x: 0, y: 0 } }) },
    { what: 'an arc with no bow at all', shape: arc({ bulge: 0 }) },
    { what: 'an arc bowed by something that is not a number', shape: arc({ bulge: Number.NaN }) },
    { what: 'an arc bowed to infinity', shape: arc({ bulge: Number.POSITIVE_INFINITY }) },
    { what: 'an arc of no length', shape: arc({ end: { x: 0, y: 0 } }) },
    { what: 'a circle of no radius', shape: circle({ radius: 0 }) },
    { what: 'a circle of a radius that is not a number', shape: circle({ radius: Number.NaN }) },
    { what: 'a circle turned inside out by a negative radius', shape: circle({ radius: -50 }) },
    { what: 'a circle starting at an angle that is not a number', shape: circle({ startAngle: Number.NaN }) },
    { what: 'a circle centred nowhere', shape: circle({ center: { x: Number.NaN, y: Number.NaN } }) },
  ];

  for (const { what, shape } of broken) {
    test(`${what} still answers with numbers`, () => {
      assert.ok(Number.isFinite(shapeLength(shape)), `the length is ${shapeLength(shape)}`);
      for (const t of [0, 0.5, 1, Number.NaN, Number.POSITIVE_INFINITY]) {
        const stop = shapeAt(shape, t);
        isFiniteStop(stop, `${what} at ${t}`);
        assert.ok(Number.isFinite(shapeRotation(shape, stop)), `${what} turns to a number at ${t}`);
      }
      for (const [index, stop] of shapeStops(shape, 5).entries()) isFiniteStop(stop, `${what}, stop ${index}`);
    });
  }

  test('a broken stitch is still laid out somewhere real', () => {
    const items = [
      stitch({ x: Number.NaN, y: 0 }),
      stitch({ x: 0, y: Number.POSITIVE_INFINITY }),
      stitch({ rotation: Number.NaN }),
      stitch({ height: Number.NaN }),
      stitch({ x: 1e308, y: -1e308, height: 1e308 }),
    ];
    for (const [index, item] of placeOnShape(items, line()).entries()) {
      assert.ok(Number.isFinite(item.x), `stitch ${index} has an x of ${item.x}`);
      assert.ok(Number.isFinite(item.y), `stitch ${index} has a y of ${item.y}`);
      assert.ok(Number.isFinite(item.rotation), `stitch ${index} has a rotation of ${item.rotation}`);
      const base = basePoint(item);
      assert.ok(Number.isFinite(base.x) && Number.isFinite(base.y), `stitch ${index} has a base point`);
    }
  });

  test('broken places are left out of a fit rather than breaking it', () => {
    const points = [
      { x: 0, y: 0 },
      { x: Number.NaN, y: 10 },
      { x: 20, y: 20 },
      { x: 30, y: Number.POSITIVE_INFINITY },
      { x: 40, y: 40 },
    ];
    const fitted = fitShape(points);
    assert.equal(fitted?.shape, 'line', 'the places that are real still line up');
    nearPoint(fitted.end, { x: 40, y: 40 }, 'spanning the last real place', 1e-9);
    assert.equal(
      fitShape([
        { x: Number.NaN, y: 0 },
        { x: 0, y: Number.NaN },
      ]),
      null,
      'nothing real is left',
    );
  });

  test('a broken tolerance falls back to the shared one', () => {
    const points = [0, 1, 2, 3, 4].map((index) => ({ x: index * 25, y: index % 2 === 0 ? 0 : 3 }));
    assert.equal(fitShape(points, Number.NaN)?.shape, fitShape(points)?.shape, 'a tolerance that is not a number');
    assert.equal(fitShape(points, -5)?.shape, fitShape(points)?.shape, 'a negative tolerance');
  });

  test('a suggestion for broken places is finite or nothing', () => {
    const points = [
      { x: Number.NaN, y: 0 },
      { x: 0, y: 0 },
      { x: 60, y: 80 },
      { x: Number.POSITIVE_INFINITY, y: 1 },
    ];
    for (const kind of ['line', 'arc', 'circle']) {
      const suggested = suggestShape(points, kind);
      assert.notEqual(suggested, null, `a ${kind} was still found`);
      for (const stop of shapeStops(suggested, 4)) isFiniteStop(stop, `a suggested ${kind}`);
    }
  });
});
