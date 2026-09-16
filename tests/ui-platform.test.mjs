/*
 * A módosítóbillentyű felirata (PQW-911): Mac gépen ⌥, máshol Alt.
 *
 * A billentyűkezelés mindenhol ugyanaz (`event.altKey`), csak a kiírt név tér
 * el — a Macen nincs „Alt” feliratú billentyű, ott ez az Option.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { applePlatform, modifierCombo, modifierName } from '../src/ui/platform.ts';

test('a Mac és az iOS platformok felismerése', () => {
  for (const platform of ['macOS', 'MacIntel', 'Mac OS X', 'iPhone', 'iPad', 'iPod touch']) {
    assert.equal(applePlatform(platform), true, platform);
  }
  for (const platform of ['Windows', 'Win32', 'Linux x86_64', 'Android', 'Chrome OS', '']) {
    assert.equal(applePlatform(platform), false, platform);
  }
});

test('a módosító neve rendszerenként', () => {
  assert.equal(modifierName('MacIntel'), '⌥');
  assert.equal(modifierName('Windows'), 'Alt');
  assert.equal(modifierName(''), 'Alt', 'ismeretlen rendszeren az Alt a biztos');
});

test('a kombináció felirata: Macen ⌥1, máshol Alt+1', () => {
  assert.equal(modifierCombo('1', 'macOS'), '⌥1');
  assert.equal(modifierCombo('1', 'Win32'), 'Alt+1');
  assert.equal(modifierCombo('F', 'MacIntel'), '⌥F');
  assert.equal(modifierCombo('F', 'Linux x86_64'), 'Alt+F');
});
