/*
 * Symbols placed on the chart (PQW-857): the stem runs from foot to top,
 * decrease stems meet in a single top, and the chain sits at the given angle.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { STITCHES, stitchById } from '../src/core/stitches.ts';
import { placedShapes, shapeBounds, stemLength, symbolShapes } from '../src/ui/symbols.ts';

const near = (a, b) => Math.abs(a - b) < 1e-9;
const samePoint = (p, q) => near(p.x, q.x) && near(p.y, q.y);
const byRole = (shapes, role) => shapes.filter((shape) => shape.role === role);
const stitchAt = (feet, top) => ({ role: 'stitch', feet, top, angle: 0, size: 0 });

test('basic stitch: the stem runs from foot to top even when slanted, and the top bar sits on the top', () => {
  const foot = { x: 10, y: 0 };
  const top = { x: 30, y: -40 };
  const shapes = placedShapes(stitchById('dc'), stitchAt([foot], top));
  const [stem] = byRole(shapes, 'stem');
  assert.ok(samePoint(stem.from, foot) && samePoint(stem.to, top));
  assert.equal(byRole(shapes, 'hatch').length, 1);
  const [bar] = byRole(shapes, 'bar');
  assert.ok(samePoint({ x: (bar.from.x + bar.to.x) / 2, y: (bar.from.y + bar.to.y) / 2 }, top));
});

test('increase: a single crochet on a slanted stem keeps its + symbol and does not turn into an × (PQW-931)', () => {
  // Second stitch into the same target: the foot stays in the column of the target
  // while the top slides to the position of the stitch, so the stem leans.
  const shapes = placedShapes(stitchById('sc'), stitchAt([{ x: 0, y: 0 }], { x: 24, y: -18 }));
  const [stem] = byRole(shapes, 'stem');
  assert.ok(Math.abs(stem.to.x - stem.from.x) > 1, 'the stem stays slanted');

  const [cross] = byRole(shapes, 'cross');
  assert.ok(near(cross.from.y, cross.to.y), `the cross bar is horizontal: ${JSON.stringify(cross)}`);
  assert.ok(Math.abs(cross.to.x - cross.from.x) > 1);
});

test('increase in × mode: both diagonals stay at 45° and do not turn into a +', () => {
  const shapes = placedShapes(stitchById('sc'), stitchAt([{ x: 0, y: 0 }], { x: 24, y: -18 }), {
    singleCrochet: 'cross',
  });
  const crosses = byRole(shapes, 'cross');
  assert.equal(crosses.length, 2);
  assert.equal(byRole(shapes, 'stem').length, 0);
  for (const arm of crosses) {
    assert.ok(near(Math.abs(arm.to.x - arm.from.x), Math.abs(arm.to.y - arm.from.y)), JSON.stringify(arm));
  }
});

test('in the round the cross bar and the top bar follow the angle of the row, not the stem', () => {
  const angle = Math.PI / 3;
  const along = { x: Math.cos(angle), y: Math.sin(angle) };
  const direction = (shape) => {
    const delta = { x: shape.to.x - shape.from.x, y: shape.to.y - shape.from.y };
    const length = Math.hypot(delta.x, delta.y);
    return { x: delta.x / length, y: delta.y / length };
  };

  // Upright stem, rotated row: the symbol has to turn with the row.
  const sc = { ...stitchAt([{ x: 0, y: 0 }], { x: 0, y: -18 }), angle };
  assert.ok(samePoint(direction(byRole(placedShapes(stitchById('sc'), sc), 'cross')[0]), along));

  const dc = { ...stitchAt([{ x: 0, y: 0 }], { x: 0, y: -34 }), angle };
  assert.ok(samePoint(direction(byRole(placedShapes(stitchById('dc'), dc), 'bar')[0]), along));
});

test('decrease: one stem from every foot, all running into the same top', () => {
  const feet = [
    { x: 0, y: 0 },
    { x: 24, y: 0 },
    { x: 48, y: 0 },
  ];
  const top = { x: 24, y: -34 };
  const shapes = placedShapes(stitchById('dc3tog'), stitchAt(feet, top));
  const stems = byRole(shapes, 'stem');
  assert.equal(stems.length, 3);
  stems.forEach((stem, i) => assert.ok(samePoint(stem.from, feet[i]) && samePoint(stem.to, top)));
  assert.equal(byRole(shapes, 'bar').length, 1);
});

test('invisible decrease: the front loop mark appears on every foot', () => {
  const shapes = placedShapes(
    stitchById('invdec'),
    stitchAt(
      [
        { x: 0, y: 0 },
        { x: 24, y: 0 },
      ],
      { x: 12, y: -18 },
    ),
  );
  assert.equal(byRole(shapes, 'front-loop').length, 2);
});

test('a compound symbol worked into one base stays the upright library symbol, shifted onto its foot', () => {
  const def = stitchById('bobble-5dc');
  const foot = { x: 5, y: 7 };
  const top = { x: 5, y: 7 - stemLength(3) };
  const placed = shapeBounds(placedShapes(def, stitchAt([foot], top)));
  const canonical = shapeBounds(symbolShapes(def));
  for (const key of ['minX', 'maxX']) assert.ok(Math.abs(placed[key] - canonical[key] - 5) < 1e-9);
  for (const key of ['minY', 'maxY']) assert.ok(Math.abs(placed[key] - canonical[key] - 7) < 1e-9);
});

test('chain: an ellipse on the centre point, at the given angle, never longer than its span', () => {
  const [oval] = placedShapes(stitchById('ch'), {
    role: 'chain',
    feet: [],
    top: { x: 3, y: 4 },
    angle: Math.PI / 2,
    size: 10,
  });
  assert.equal(oval.kind, 'ellipse');
  assert.deepEqual(oval.center, { x: 3, y: 4 });
  assert.equal(oval.rotation, Math.PI / 2);
  assert.ok(oval.rx <= 5);
});

test('reverse single crochet gets a wavy line, and every stitch yields finite shapes on the chart', () => {
  const rev = placedShapes(stitchById('rev-sc'), stitchAt([{ x: 0, y: 0 }], { x: 0, y: -18 }));
  assert.equal(byRole(rev, 'tilde').length, 2);
  for (const def of STITCHES) {
    const role =
      def.kind === 'chain' || def.kind === 'space'
        ? 'chain'
        : def.kind === 'slip'
          ? 'slip'
          : def.kind === 'picot'
            ? 'picot'
            : def.kind === 'ring'
              ? 'ring'
              : 'stitch';
    const feet =
      def.kind === 'joined' && def.base === 'spread'
        ? Array.from({ length: def.consumes }, (_, i) => ({ x: i * 24, y: 0 }))
        : [{ x: 0, y: 0 }];
    const shapes = placedShapes(def, { role, feet, top: { x: 10, y: -30 }, angle: 0.3, size: 18 });
    assert.ok(shapes.length > 0, def.id);
    assert.ok(Object.values(shapeBounds(shapes)).every(Number.isFinite), def.id);
  }
});

test('the canvas draws the stored right-side insertion mode without checking it against the stitch and without throwing (PQW-869)', () => {
  const crab = placedShapes(stitchById('rev-sc'), stitchAt([{ x: 0, y: 0 }], { x: 0, y: -18 }), {
    singleCrochet: 'plus',
    insertion: 'back-loop',
  });
  assert.equal(byRole(crab, 'back-loop').length, 1);
  // On a wrong-side row the invisible decrease reads as back loop from the right side.
  const invdec = placedShapes(
    stitchById('invdec'),
    stitchAt(
      [
        { x: 0, y: 0 },
        { x: 24, y: 0 },
      ],
      { x: 12, y: -18 },
    ),
    {
      singleCrochet: 'plus',
      insertion: 'back-loop',
    },
  );
  assert.equal(byRole(invdec, 'back-loop').length, 2);
  assert.equal(byRole(invdec, 'front-loop').length, 0);
});

test('a compound symbol worked into one base marks the chosen mode on its foot, and in JIS the back loop is a line (PQW-869)', () => {
  const foot = { x: 0, y: 0 };
  const top = { x: 0, y: -stemLength(3) };
  for (const style of ['cyc', 'jis']) {
    const shapes = placedShapes(stitchById('bobble-5dc'), stitchAt([foot], top), {
      singleCrochet: 'plus',
      style,
      insertion: 'back-loop',
    });
    const marks = byRole(shapes, 'back-loop');
    assert.equal(marks.length, 1, style);
    assert.equal(marks[0].kind, style === 'jis' ? 'line' : 'curve');
    assert.ok(
      marks.every((mark) => (mark.kind === 'line' ? mark.from.y : mark.control.y) > -6),
      `${style}: the mark sits at the foot`,
    );
  }
  // The legend and palette symbols still throw on a forbidden mode; the canvas symbol does not.
  const relief = { singleCrochet: 'plus', insertion: 'front-post' };
  assert.throws(() => symbolShapes(stitchById('bobble-5dc'), relief), RangeError);
  assert.doesNotThrow(() => placedShapes(stitchById('bobble-5dc'), stitchAt([foot], top), relief));
});
