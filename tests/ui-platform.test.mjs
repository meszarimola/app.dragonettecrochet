/*
 * The modifier key label (PQW-911): ⌥ on a Mac, Alt everywhere else.
 *
 * Key handling is the same everywhere (`event.altKey`), only the printed name
 * differs — a Mac has no key labelled Alt, there it is the Option key.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { applePlatform, modifierCombo, modifierName } from '../src/ui/platform.ts';

test('recognises the Mac and iOS platforms', () => {
  for (const platform of ['macOS', 'MacIntel', 'Mac OS X', 'iPhone', 'iPad', 'iPod touch']) {
    assert.equal(applePlatform(platform), true, platform);
  }
  for (const platform of ['Windows', 'Win32', 'Linux x86_64', 'Android', 'Chrome OS', '']) {
    assert.equal(applePlatform(platform), false, platform);
  }
});

test('the modifier name per operating system', () => {
  assert.equal(modifierName('MacIntel'), '⌥');
  assert.equal(modifierName('Windows'), 'Alt');
  assert.equal(modifierName(''), 'Alt', 'Alt is the safe fallback on an unknown system');
});

test('the combo label: ⌥1 on a Mac, Alt+1 elsewhere', () => {
  assert.equal(modifierCombo('1', 'macOS'), '⌥1');
  assert.equal(modifierCombo('1', 'Win32'), 'Alt+1');
  assert.equal(modifierCombo('F', 'MacIntel'), '⌥F');
  assert.equal(modifierCombo('F', 'Linux x86_64'), 'Alt+F');
});
