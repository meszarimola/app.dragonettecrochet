/*
 * A bal oldali mintatípus-menü tartalma (PQW-873). Az átvételi tesztelés első
 * körében egyedül a „szabályos horgolás” aktív (PQW-925): a filéhorgolás
 * (PQW-864) és az amigurumi (PQW-863) ideiglenesen kikapcsolva, a szabálytalan
 * horgolás pedig a saját jegyére vár — mind a három „hamarosan” jelzéssel,
 * inaktívan látszik.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  DEFAULT_PATTERN_TYPE,
  PATTERN_TYPES,
  gridKind,
  isAvailableType,
  writtenShareFor,
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

test('az UAT első körében csak a szabályos horgolás aktív (PQW-925)', () => {
  const available = PATTERN_TYPES.filter((type) => type.available).map((type) => type.id);
  assert.deepEqual(available, ['regular']);
});

test('a kikapcsolt típusok a listában maradnak, nem törölve (PQW-925)', () => {
  // A letiltás ideiglenes: a menüpont látszik, csak nem választható.
  const soon = PATTERN_TYPES.filter((type) => !type.available).map((type) => type.id);
  assert.deepEqual(soon, ['filet', 'amigurumi', 'irregular']);
});

test('amigurumiban az írott minta nagyban, keskeny ablakban teljes nézetben nyílik; máshol nem változik (PQW-863)', () => {
  assert.equal(writtenShareFor('amigurumi', false), 0.7);
  assert.equal(writtenShareFor('amigurumi', true), 1);
  assert.equal(writtenShareFor('regular', false), null);
  assert.equal(writtenShareFor('filet', true), null);
});

test('az alapértelmezett típus aktív', () => {
  assert.ok(isAvailableType(DEFAULT_PATTERN_TYPE));
});

test('isAvailableType csak a bekapcsolt, ismert azonosítóra igaz', () => {
  assert.ok(isAvailableType('regular'));
  // PQW-925: kikapcsolva, ezért tárolt értékből sem állhat vissza.
  assert.ok(!isAvailableType('amigurumi'));
  assert.ok(!isAvailableType('filet'));
  assert.ok(!isAvailableType('irregular'));
  assert.ok(!isAvailableType('nincs-ilyen'));
});
