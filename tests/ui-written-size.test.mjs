/*
 * The height of the written pattern panel (PQW-885): from the header up to
 * the full work area, by keyboard in 5 % steps, by dragging, and where the
 * status bar sits above the panel.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { clampSize, dragCollapses, dragSize, isFull, keySize, percentOf, statusPlace } from '../src/ui/written-size.ts';

const range = { min: 80, max: 400 };

test('the height is clamped between the header and the work area', () => {
  assert.equal(clampSize(20, range), 80);
  assert.equal(clampSize(500, range), 400);
  assert.equal(clampSize(250, range), 250);
});

test('when the header is taller than the work area, the work area is the limit', () => {
  assert.equal(clampSize(100, { min: 120, max: 90 }), 90);
});

test('the arrows step to the next 5 % mark: up and right grow it, down and left shrink it', () => {
  assert.equal(keySize('ArrowUp', 200, range), 220);
  assert.equal(keySize('ArrowRight', 200, range), 220);
  assert.equal(keySize('ArrowDown', 200, range), 180);
  assert.equal(keySize('ArrowLeft', 200, range), 180);
  // From between two marks it moves on to the next round value.
  assert.equal(keySize('ArrowUp', 205, range), 220);
  assert.equal(keySize('ArrowDown', 205, range), 200);
});

test('a height rounded by the browser also steps to the next mark', () => {
  // At 1000×506 the 75 % mark is 257.546875 px of the 343.40625 px work area, not exactly 257.5546875.
  const small = { min: 93, max: 343.40625 };
  assert.ok(Math.abs(keySize('ArrowUp', 257.546875, small) - 0.8 * small.max) < 1e-9);
  assert.equal(keySize('PageUp', 257.546875, small), small.max);
  assert.ok(Math.abs(keySize('ArrowDown', 257.5625, small) - 0.7 * small.max) < 1e-9);
});

test('PageUp and PageDown step by a quarter', () => {
  assert.equal(keySize('PageUp', 120, range), 200);
  assert.equal(keySize('PageDown', 300, range), 200);
});

test('Home goes down to the header, End up to the full work area, and no step overshoots', () => {
  assert.equal(keySize('Home', 250, range), 80);
  assert.equal(keySize('End', 250, range), 400);
  assert.equal(keySize('ArrowUp', 400, range), 400);
  assert.equal(keySize('ArrowDown', 90, range), 80);
});

test('any other key leaves the height alone', () => {
  assert.equal(keySize('Enter', 200, range), null);
  assert.equal(keySize('a', 200, range), null);
  assert.equal(keySize('ArrowUp', 0, { min: 0, max: 0 }), null);
});

test('the announced value is a percentage of the work area', () => {
  assert.equal(percentOf(200, range), 50);
  assert.equal(percentOf(400, range), 100);
  assert.equal(percentOf(80, range), 20);
  assert.equal(percentOf(10, { min: 0, max: 0 }), 0);
});

test('full view: the work area height, within a pixel of tolerance', () => {
  assert.equal(isFull(400, range), true);
  assert.equal(isFull(399.4, range), true);
  assert.equal(isFull(390, range), false);
});

test('dragging the splitter upwards grows the panel', () => {
  assert.equal(dragSize(200, 50, range), 250);
  assert.equal(dragSize(200, -150, range), 80);
  assert.equal(dragSize(200, 400, range), 400);
});

test('the panel collapses only when the drag reaches well below the header', () => {
  assert.equal(dragCollapses(200, -130, range), false);
  assert.equal(dragCollapses(200, -161, range), true);
});

test('the status bar sits above the panel when it fits there', () => {
  assert.deepEqual(statusPlace(200, 30, 400), { block: 200, lift: 0 });
  assert.deepEqual(statusPlace(0, 30, 400), { block: 0, lift: 0 });
});

test('with a nearly full panel the top of the panel makes room for the status bar', () => {
  assert.deepEqual(statusPlace(390, 30, 400), { block: 370, lift: 20 });
  assert.deepEqual(statusPlace(400, 30, 400), { block: 370, lift: 30 });
  // With an empty status bar there is nothing to make room for.
  assert.deepEqual(statusPlace(400, 0, 400), { block: 400, lift: 0 });
});
