/*
 * The free-form board's view (PQW-1158): a zoom between 100% and 800% and the
 * part of the sheet on screen, which never leaves the sheet. KB: interface.md §87
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  clampView,
  DEFAULT_VIEW,
  MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  toBoard,
  toScreen,
  visibleRect,
  ZOOM_STEPS,
  zoomAt,
  zoomStep,
} from '../src/core/view.ts';

const SHEET = { width: 800, height: 600 };

test('at 100% a screen point is the board point', () => {
  assert.deepEqual(toBoard(DEFAULT_VIEW, { x: 120, y: 45 }), { x: 120, y: 45 });
  assert.deepEqual(visibleRect(DEFAULT_VIEW, SHEET), { minX: 0, minY: 0, maxX: 800, maxY: 600 });
});

test('toBoard and toScreen undo each other', () => {
  const view = { zoom: 2.5, origin: { x: 100, y: 40 } };
  const back = toScreen(view, toBoard(view, { x: 33, y: 71 }));
  assert.ok(Math.abs(back.x - 33) < 1e-9 && Math.abs(back.y - 71) < 1e-9);
});

test('zooming keeps the board point under the anchor where it is', () => {
  const anchor = { x: 200, y: 150 };
  const before = toBoard(DEFAULT_VIEW, anchor);
  const view = zoomAt(DEFAULT_VIEW, 2, anchor, SHEET);
  assert.equal(view.zoom, 2);
  const after = toBoard(view, anchor);
  assert.ok(Math.abs(after.x - before.x) < 1e-9 && Math.abs(after.y - before.y) < 1e-9);
});

test('the zoom stays between 100% and 800%', () => {
  const centre = { x: 400, y: 300 };
  assert.equal(zoomAt(DEFAULT_VIEW, 0.2, centre, SHEET).zoom, MIN_ZOOM);
  assert.equal(zoomAt(DEFAULT_VIEW, 50, centre, SHEET).zoom, MAX_ZOOM);
  assert.equal(clampView({ zoom: Number.NaN, origin: { x: 0, y: 0 } }, SHEET).zoom, MIN_ZOOM);
});

test('the view never leaves the sheet', () => {
  const view = zoomAt(DEFAULT_VIEW, 2, { x: 790, y: 590 }, SHEET);
  const seen = visibleRect(view, SHEET);
  assert.ok(seen.minX >= 0 && seen.minY >= 0 && seen.maxX <= 800 + 1e-9 && seen.maxY <= 600 + 1e-9);
  const far = panBy(view, -10_000, -10_000, SHEET);
  assert.deepEqual(far.origin, { x: 400, y: 300 }, 'dragged far left and up, it stops at the bottom right');
  assert.deepEqual(panBy(view, 10_000, 10_000, SHEET).origin, { x: 0, y: 0 });
  assert.deepEqual(panBy(DEFAULT_VIEW, 50, 50, SHEET), DEFAULT_VIEW, 'at 100% there is nowhere to move');
});

test('zooming back out to 100% brings the whole sheet back', () => {
  const zoomed = panBy(zoomAt(DEFAULT_VIEW, 4, { x: 600, y: 500 }, SHEET), -100, -100, SHEET);
  assert.deepEqual(zoomAt(zoomed, 1, { x: 10, y: 10 }, SHEET), DEFAULT_VIEW);
});

test('panning moves the sheet with the pointer', () => {
  const view = { zoom: 2, origin: { x: 100, y: 100 } };
  const moved = panBy(view, 40, -20, SHEET);
  assert.deepEqual(moved.origin, { x: 80, y: 110 });
});

test('the zoom steps go up and down from anywhere, and stop at the ends', () => {
  assert.deepEqual(ZOOM_STEPS[0], MIN_ZOOM);
  assert.deepEqual(ZOOM_STEPS.at(-1), MAX_ZOOM);
  assert.equal(zoomStep(1, 1), 1.25);
  assert.equal(zoomStep(1.7, 1), 2);
  assert.equal(zoomStep(1.7, -1), 1.5);
  assert.equal(zoomStep(2, -1), 1.5);
  assert.equal(zoomStep(MAX_ZOOM, 1), MAX_ZOOM);
  assert.equal(zoomStep(MIN_ZOOM, -1), MIN_ZOOM);
});
