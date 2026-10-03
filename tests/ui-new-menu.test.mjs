/*
 * The „New” menu's arrow keys (PQW-1165): up and down wrap, Home and End jump,
 * and every other key is left to the caller.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { stepIndex } from '../src/ui/new-menu.ts';

test('down moves to the next item and wraps from the last to the first', () => {
  assert.equal(stepIndex(0, 2, 'ArrowDown'), 1);
  assert.equal(stepIndex(1, 2, 'ArrowDown'), 0);
});

test('up moves to the previous item and wraps from the first to the last', () => {
  assert.equal(stepIndex(3, 5, 'ArrowUp'), 2);
  assert.equal(stepIndex(0, 5, 'ArrowUp'), 4);
});

test('Home and End jump to the ends', () => {
  assert.equal(stepIndex(2, 5, 'Home'), 0);
  assert.equal(stepIndex(2, 5, 'End'), 4);
});

test('any other key is not a move', () => {
  for (const key of ['ArrowLeft', 'ArrowRight', 'Escape', 'Enter', 'a']) {
    assert.equal(stepIndex(0, 5, key), null, key);
  }
});

test('an empty menu has nowhere to move', () => {
  assert.equal(stepIndex(0, 0, 'ArrowDown'), null);
});
