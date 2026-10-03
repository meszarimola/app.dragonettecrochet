/*
 * The free-form board's view (PQW-1158, PQW-1160): a zoom between 50% and 800%,
 * and the part of the sheet on screen, which may move a whole screen past the
 * default view on every side but never off the sheet. KB: interface.md §87
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  clampView,
  DEFAULT_VIEW,
  MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  sheetOf,
  toBoard,
  toScreen,
  viewFromJson,
  visibleRect,
  ZOOM_STEPS,
  zoomAt,
  zoomStep,
} from '../src/core/view.ts';

const SCREEN = { width: 800, height: 600 };

test('at the default view a screen point is the board point', () => {
  assert.deepEqual(toBoard(DEFAULT_VIEW, { x: 120, y: 45 }), { x: 120, y: 45 });
  assert.deepEqual(visibleRect(DEFAULT_VIEW, SCREEN), { minX: 0, minY: 0, maxX: 800, maxY: 600 });
});

test('the sheet is the default view and one more screen on every side', () => {
  assert.deepEqual(sheetOf(SCREEN), { minX: -800, minY: -600, maxX: 1600, maxY: 1200 });
});

test('the sheet grows to take in a stitch left outside it, and the view can reach it', () => {
  const stranded = { x: -1500, y: 100 };
  const sheet = sheetOf(SCREEN, [stranded, { x: 10, y: 10 }]);
  assert.deepEqual(sheet, { minX: -1500, minY: -600, maxX: 1600, maxY: 1200 });
  const seen = visibleRect(panBy(DEFAULT_VIEW, 10_000, 0, SCREEN, sheet), SCREEN);
  assert.ok(seen.minX <= stranded.x && stranded.x <= seen.maxX);
});

test('toBoard and toScreen undo each other', () => {
  const view = { zoom: 2.5, origin: { x: 100, y: 40 } };
  const back = toScreen(view, toBoard(view, { x: 33, y: 71 }));
  assert.ok(Math.abs(back.x - 33) < 1e-9 && Math.abs(back.y - 71) < 1e-9);
});

test('zooming keeps the board point under the anchor where it is', () => {
  const anchor = { x: 200, y: 150 };
  const before = toBoard(DEFAULT_VIEW, anchor);
  for (const zoom of [2, 0.5]) {
    const view = zoomAt(DEFAULT_VIEW, zoom, anchor, SCREEN);
    assert.equal(view.zoom, zoom);
    const after = toBoard(view, anchor);
    assert.ok(Math.abs(after.x - before.x) < 1e-9 && Math.abs(after.y - before.y) < 1e-9, `at ${zoom}`);
  }
});

test('the zoom stays between 50% and 800%', () => {
  const centre = { x: 400, y: 300 };
  assert.equal(zoomAt(DEFAULT_VIEW, 0.1, centre, SCREEN).zoom, MIN_ZOOM);
  assert.equal(zoomAt(DEFAULT_VIEW, 50, centre, SCREEN).zoom, MAX_ZOOM);
  assert.equal(clampView({ zoom: Number.NaN, origin: { x: 0, y: 0 } }, SCREEN).zoom, 1);
});

test('at 100% the view moves up to a whole screen each way, and no further', () => {
  const down = panBy(DEFAULT_VIEW, 0, 250, SCREEN);
  assert.deepEqual(down.origin, { x: 0, y: -250 }, 'dragged down, the drawing goes down the screen');
  assert.deepEqual(panBy(DEFAULT_VIEW, 10_000, 10_000, SCREEN).origin, { x: -800, y: -600 });
  assert.deepEqual(panBy(DEFAULT_VIEW, -10_000, -10_000, SCREEN).origin, { x: 800, y: 600 });
});

test('what is on screen never leaves the sheet, whatever the zoom', () => {
  const sheet = sheetOf(SCREEN);
  for (const zoom of [0.5, 0.75, 1, 3, 8]) {
    for (const [dx, dy] of [
      [10_000, 10_000],
      [-10_000, -10_000],
      [10_000, -10_000],
    ]) {
      const seen = visibleRect(panBy(zoomAt(DEFAULT_VIEW, zoom, { x: 0, y: 0 }, SCREEN), dx, dy, SCREEN), SCREEN);
      assert.ok(
        seen.minX >= sheet.minX - 1e-9 &&
          seen.minY >= sheet.minY - 1e-9 &&
          seen.maxX <= sheet.maxX + 1e-9 &&
          seen.maxY <= sheet.maxY + 1e-9,
        `at ${zoom}, ${dx}, ${dy}`,
      );
    }
  }
});

test('panning moves the sheet with the pointer', () => {
  const view = { zoom: 2, origin: { x: 100, y: 100 } };
  assert.deepEqual(panBy(view, 40, -20, SCREEN).origin, { x: 80, y: 110 });
});

test('the zoom steps go up and down from anywhere, and stop at the ends', () => {
  assert.deepEqual(ZOOM_STEPS[0], MIN_ZOOM);
  assert.deepEqual(ZOOM_STEPS.at(-1), MAX_ZOOM);
  assert.ok(ZOOM_STEPS.includes(1), '100% is a step');
  assert.equal(zoomStep(1, 1), 1.25);
  assert.equal(zoomStep(1, -1), 0.75);
  assert.equal(zoomStep(1.7, 1), 2);
  assert.equal(zoomStep(1.7, -1), 1.5);
  assert.equal(zoomStep(MAX_ZOOM, 1), MAX_ZOOM);
  assert.equal(zoomStep(MIN_ZOOM, -1), MIN_ZOOM);
});

test('a stored view reads back as written; anything else reads as none', () => {
  const view = { zoom: 2, origin: { x: 640, y: -120 } };
  assert.deepEqual(viewFromJson(JSON.stringify(view)), view);
  for (const text of [null, '', 'not json', 'null', '{"zoom":2}', '{"zoom":"2","origin":{"x":0,"y":0}}']) {
    assert.equal(viewFromJson(text), null, String(text));
  }
});
