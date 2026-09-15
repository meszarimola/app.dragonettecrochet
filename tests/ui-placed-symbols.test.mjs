/*
 * A jel a diagram helyén (PQW-857): a szár a talptól a tetőig tart, a
 * fogyasztás szárai egy tetőbe futnak, a láncszem a megadott irányban áll.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { STITCHES, stitchById } from '../src/core/stitches.ts';
import { placedShapes, shapeBounds, stemLength, symbolShapes } from '../src/ui/symbols.ts';

const near = (a, b) => Math.abs(a - b) < 1e-9;
const samePoint = (p, q) => near(p.x, q.x) && near(p.y, q.y);
const byRole = (shapes, role) => shapes.filter((shape) => shape.role === role);
const stitchAt = (feet, top) => ({ role: 'stitch', feet, top, angle: 0, size: 0 });

test('alapszem: a szár a talptól a tetőig tart, ferdén is, a tetővonal a tetőn', () => {
  const foot = { x: 10, y: 0 };
  const top = { x: 30, y: -40 };
  const shapes = placedShapes(stitchById('dc'), stitchAt([foot], top));
  const [stem] = byRole(shapes, 'stem');
  assert.ok(samePoint(stem.from, foot) && samePoint(stem.to, top));
  assert.equal(byRole(shapes, 'hatch').length, 1);
  const [bar] = byRole(shapes, 'bar');
  assert.ok(samePoint({ x: (bar.from.x + bar.to.x) / 2, y: (bar.from.y + bar.to.y) / 2 }, top));
});

test('fogyasztás: minden talpból egy szár, mind ugyanabba a tetőbe fut', () => {
  const feet = [{ x: 0, y: 0 }, { x: 24, y: 0 }, { x: 48, y: 0 }];
  const top = { x: 24, y: -34 };
  const shapes = placedShapes(stitchById('dc3tog'), stitchAt(feet, top));
  const stems = byRole(shapes, 'stem');
  assert.equal(stems.length, 3);
  stems.forEach((stem, i) => assert.ok(samePoint(stem.from, feet[i]) && samePoint(stem.to, top)));
  assert.equal(byRole(shapes, 'bar').length, 1);
});

test('láthatatlan fogyasztás: az első szál jele minden talpon', () => {
  const shapes = placedShapes(stitchById('invdec'), stitchAt([{ x: 0, y: 0 }, { x: 24, y: 0 }], { x: 12, y: -18 }));
  assert.equal(byRole(shapes, 'front-loop').length, 2);
});

test('egy alapba horgolt összetett jel függőlegesen a könyvtári jel, eltolva a talpra', () => {
  const def = stitchById('bobble-5dc');
  const foot = { x: 5, y: 7 };
  const top = { x: 5, y: 7 - stemLength(3) };
  const placed = shapeBounds(placedShapes(def, stitchAt([foot], top)));
  const canonical = shapeBounds(symbolShapes(def));
  for (const key of ['minX', 'maxX']) assert.ok(Math.abs(placed[key] - canonical[key] - 5) < 1e-9);
  for (const key of ['minY', 'maxY']) assert.ok(Math.abs(placed[key] - canonical[key] - 7) < 1e-9);
});

test('láncszem: ellipszis a középpontban, a megadott szögben, a hosszánál nem hosszabb', () => {
  const [oval] = placedShapes(stitchById('ch'), { role: 'chain', feet: [], top: { x: 3, y: 4 }, angle: Math.PI / 2, size: 10 });
  assert.equal(oval.kind, 'ellipse');
  assert.deepEqual(oval.center, { x: 3, y: 4 });
  assert.equal(oval.rotation, Math.PI / 2);
  assert.ok(oval.rx <= 5);
});

test('rákhurok hullámvonallal; minden szem véges alakzatot ad a diagramon', () => {
  const rev = placedShapes(stitchById('rev-sc'), stitchAt([{ x: 0, y: 0 }], { x: 0, y: -18 }));
  assert.equal(byRole(rev, 'tilde').length, 2);
  for (const def of STITCHES) {
    const role = def.kind === 'chain' || def.kind === 'space' ? 'chain' : def.kind === 'slip' ? 'slip' : def.kind === 'picot' ? 'picot' : def.kind === 'ring' ? 'ring' : 'stitch';
    const feet = def.kind === 'joined' && def.base === 'spread' ? Array.from({ length: def.consumes }, (_, i) => ({ x: i * 24, y: 0 })) : [{ x: 0, y: 0 }];
    const shapes = placedShapes(def, { role, feet, top: { x: 10, y: -30 }, angle: 0.3, size: 18 });
    assert.ok(shapes.length > 0, def.id);
    assert.ok(Object.values(shapeBounds(shapes)).every(Number.isFinite), def.id);
  }
});

test('a vászon a tárolt, színoldali módot rajzolja, a szem listájával össze nem vetve, hibát nem dobva (PQW-869)', () => {
  const crab = placedShapes(stitchById('rev-sc'), stitchAt([{ x: 0, y: 0 }], { x: 0, y: -18 }), { singleCrochet: 'plus', insertion: 'back-loop' });
  assert.equal(byRole(crab, 'back-loop').length, 1);
  // Visszai soron a láthatatlan fogyasztás színoldalról hátsó szálas.
  const invdec = placedShapes(stitchById('invdec'), stitchAt([{ x: 0, y: 0 }, { x: 24, y: 0 }], { x: 12, y: -18 }), {
    singleCrochet: 'plus',
    insertion: 'back-loop',
  });
  assert.equal(byRole(invdec, 'back-loop').length, 2);
  assert.equal(byRole(invdec, 'front-loop').length, 0);
});

test('egy alapba horgolt összetett jel a választott mód jelölésével a talpon, JIS-ben a hátsó szál vonal (PQW-869)', () => {
  const foot = { x: 0, y: 0 };
  const top = { x: 0, y: -stemLength(3) };
  for (const style of ['cyc', 'jis']) {
    const shapes = placedShapes(stitchById('bobble-5dc'), stitchAt([foot], top), { singleCrochet: 'plus', style, insertion: 'back-loop' });
    const marks = byRole(shapes, 'back-loop');
    assert.equal(marks.length, 1, style);
    assert.equal(marks[0].kind, style === 'jis' ? 'line' : 'curve');
    assert.ok(marks.every((mark) => (mark.kind === 'line' ? mark.from.y : mark.control.y) > -6), `${style}: a jelölés a talpnál`);
  }
  // A jelmagyarázat és a paletta jele továbbra is hibát dob tiltott módra, a vászon jele nem.
  const relief = { singleCrochet: 'plus', insertion: 'front-post' };
  assert.throws(() => symbolShapes(stitchById('bobble-5dc'), relief), RangeError);
  assert.doesNotThrow(() => placedShapes(stitchById('bobble-5dc'), stitchAt([foot], top), relief));
});
