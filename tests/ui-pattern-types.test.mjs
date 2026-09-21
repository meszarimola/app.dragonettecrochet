/*
 * The contents of the pattern-type menu (PQW-873, PQW-989). In the first
 * round of acceptance testing only regular crochet was active (PQW-925): filet
 * crochet (PQW-864) and amigurumi (PQW-863) are switched off for now and stay
 * visible but inactive, marked as coming soon. Irregular crochet joined them as
 * an active type with its own free-form editor (PQW-963).
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  DEFAULT_PATTERN_TYPE,
  gridKind,
  isAvailableType,
  PATTERN_TYPES,
  writtenShareFor,
} from '../src/ui/pattern-types.ts';

test('the grid kind switches together with the pattern type (PQW-874)', () => {
  assert.deepEqual(
    PATTERN_TYPES.map((type) => gridKind(type.id, 'row')),
    ['rows', 'rows', 'cells', 'text'],
  );
  // In regular crochet a round and a motif get a concentric grid.
  assert.equal(gridKind('regular', 'round'), 'rounds');
  assert.equal(gridKind('irregular', 'round'), 'rounds');
  // Filet always uses a cell grid; in amigurumi the written pattern is the primary view.
  assert.equal(gridKind('filet', 'round'), 'cells');
  assert.equal(gridKind('amigurumi', 'round'), 'text');
});

test('all four owner pattern types are present, with unique ids, the free-form designer first (PQW-990)', () => {
  const ids = PATTERN_TYPES.map((type) => type.id);
  assert.deepEqual(ids, ['irregular', 'regular', 'filet', 'amigurumi']);
  assert.equal(new Set(ids).size, ids.length);
});

test('every type has a name and an explanation', () => {
  for (const type of PATTERN_TYPES) {
    assert.ok(type.name.trim(), type.id);
    assert.ok(type.detail.trim(), type.id);
  }
});

test('regular and irregular crochet are the active types (PQW-925, PQW-963)', () => {
  const available = PATTERN_TYPES.filter((type) => type.available).map((type) => type.id);
  assert.deepEqual(available, ['irregular', 'regular']);
});

test('the switched-off types stay in the list instead of being removed (PQW-925)', () => {
  // The block is temporary: the menu item is visible, only not selectable.
  const soon = PATTERN_TYPES.filter((type) => !type.available).map((type) => type.id);
  assert.deepEqual(soon, ['filet', 'amigurumi']);
});

test('amigurumi opens the written pattern large, full width in a narrow window, and leaves other types unchanged (PQW-863)', () => {
  assert.equal(writtenShareFor('amigurumi', false), 0.7);
  assert.equal(writtenShareFor('amigurumi', true), 1);
  assert.equal(writtenShareFor('regular', false), null);
  assert.equal(writtenShareFor('filet', true), null);
});

test('the default pattern type is an active one, and leading the menu did not make it the default (PQW-990)', () => {
  assert.ok(isAvailableType(DEFAULT_PATTERN_TYPE));
  assert.equal(DEFAULT_PATTERN_TYPE, 'regular');
});

test('isAvailableType is true only for an enabled, known id', () => {
  assert.ok(isAvailableType('regular'));
  // PQW-925: switched off, so not even a stored value may bring it back.
  assert.ok(!isAvailableType('amigurumi'));
  assert.ok(!isAvailableType('filet'));
  // PQW-963: the free-form editor makes this one a real choice.
  assert.ok(isAvailableType('irregular'));
  assert.ok(!isAvailableType('nincs-ilyen'));
});
