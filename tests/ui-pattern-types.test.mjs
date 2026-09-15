/*
 * A bal oldali mintatípus-menü tartalma (PQW-873). Most csak a „szabályos
 * horgolás” aktív; a többi típus „hamarosan” jelzéssel, inaktívan látszik.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  DEFAULT_PATTERN_TYPE,
  PATTERN_TYPES,
  gridKind,
  isAvailableType,
} from '../src/ui/pattern-types.ts';

test('a rács típusa a mintatípussal együtt vált (PQW-874)', () => {
  assert.deepEqual(PATTERN_TYPES.map((type) => gridKind(type.id, 'row')), ['rows', 'cells', 'text', 'rows']);
  // Szabályos horgolásban a kör és a motívum koncentrikus rácsot kap.
  assert.equal(gridKind('regular', 'round'), 'rounds');
  assert.equal(gridKind('irregular', 'round'), 'rounds');
  // Filében mindig cellás rács, amigurumiban az írott minta az elsődleges nézet.
  assert.equal(gridKind('filet', 'round'), 'cells');
  assert.equal(gridKind('amigurumi', 'round'), 'text');
});

test('a négy tulajdonosi mintatípus szerepel, egyedi azonosítóval', () => {
  const ids = PATTERN_TYPES.map((type) => type.id);
  assert.deepEqual(ids, ['regular', 'filet', 'amigurumi', 'irregular']);
  assert.equal(new Set(ids).size, ids.length);
});

test('minden típusnak van neve és magyarázata', () => {
  for (const type of PATTERN_TYPES) {
    assert.ok(type.name.trim(), type.id);
    assert.ok(type.detail.trim(), type.id);
  }
});

test('most csak a szabályos horgolás aktív, a többi hamarosan', () => {
  const available = PATTERN_TYPES.filter((type) => type.available).map((type) => type.id);
  assert.deepEqual(available, ['regular']);
});

test('az alapértelmezett típus aktív', () => {
  assert.ok(isAvailableType(DEFAULT_PATTERN_TYPE));
});

test('isAvailableType csak a bekapcsolt, ismert azonosítóra igaz', () => {
  assert.ok(isAvailableType('regular'));
  assert.ok(!isAvailableType('amigurumi'));
  assert.ok(!isAvailableType('nincs-ilyen'));
});
