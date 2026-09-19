/*
 * Menu-bar tooltip alignment (PQW-882): the tooltip aligns left, centre or
 * right depending on where the button sits, so it never spills off screen.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { tipAlign } from '../src/ui/tooltip.ts';

test('aligns to the start near the left edge', () => {
  assert.equal(tipAlign(38, 1440), 'start');
});

test('centres a button in the middle of the window', () => {
  assert.equal(tipAlign(600, 1440), 'center');
});

test('aligns to the end near the right edge', () => {
  assert.equal(tipAlign(980, 1000), 'end');
});

test('falls back to start alignment when a narrow window fits neither side', () => {
  assert.equal(tipAlign(150, 300), 'start');
});
