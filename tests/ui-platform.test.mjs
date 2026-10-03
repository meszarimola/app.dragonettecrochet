/*
 * The modifier key label (PQW-911): ⌥ on a Mac, Alt everywhere else.
 *
 * Key handling is the same everywhere (`event.altKey`), only the printed name
 * differs — a Mac has no key labelled Alt, there it is the Option key.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { applePlatform, historyCommand, modifierCombo } from '../src/ui/platform.ts';

test('recognises the Mac and iOS platforms', () => {
  for (const platform of ['macOS', 'MacIntel', 'Mac OS X', 'iPhone', 'iPad', 'iPod touch']) {
    assert.equal(applePlatform(platform), true, platform);
  }
  for (const platform of ['Windows', 'Win32', 'Linux x86_64', 'Android', 'Chrome OS', '']) {
    assert.equal(applePlatform(platform), false, platform);
  }
});

test('the combo label: ⌥1 on a Mac, Alt+1 elsewhere', () => {
  assert.equal(modifierCombo('1', 'macOS'), '⌥1');
  assert.equal(modifierCombo('1', 'Win32'), 'Alt+1');
  assert.equal(modifierCombo('F', 'MacIntel'), '⌥F');
  assert.equal(modifierCombo('F', 'Linux x86_64'), 'Alt+F');
});

test('undo and redo go by the letter printed on the key (PQW-1149)', () => {
  const press = (key, code, shiftKey = false) => historyCommand({ key, code, shiftKey });
  assert.equal(press('z', 'KeyZ'), 'undo', 'English layout');
  assert.equal(press('z', 'KeyY'), 'undo', 'Hungarian layout: Z sits where English has Y');
  assert.equal(press('y', 'KeyZ'), 'redo', 'Hungarian layout: Y sits where English has Z');
  assert.equal(press('Z', 'KeyZ', true), 'redo', 'Shift + Z');
  assert.equal(press('я', 'KeyZ'), 'undo', 'a non-Latin layout falls back to the key position');
  assert.equal(press('y', 'KeyY', true), null);
  assert.equal(press('c', 'KeyC'), null);
});
