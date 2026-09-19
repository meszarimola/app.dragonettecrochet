/*
 * Rows and rounds of the free-form chart (FR-ROW-1…10): a row's number is its
 * place in the list, and every operation is pure — a no-op gives back the very
 * same object so the editor records no undo step.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { addStitch, emptyIrregularPattern } from '../src/core/irregular-document.ts';
import {
  addRow,
  deleteRow,
  insertRowAfterActive,
  itemsOfRow,
  moveItemsToRow,
  reorderRows,
  rowNumber,
  setActiveRow,
  updateRow,
} from '../src/core/irregular-rows.ts';

const base = () => emptyIrregularPattern({ title: 'Free-form chart', layerNames: ['Drawing', 'Labels'] });

/** One stitch in the active row, with defaults the spec fields override. */
const stitch = (pattern, spec) =>
  addStitch(pattern, { keyEntryId: 'sc', insertion: 'both-loops', x: 0, y: 0, width: 20, height: 20, ...spec }).pattern;

const place = (pattern, count) =>
  Array.from({ length: count }).reduce((current, _unused, index) => stitch(current, { x: index * 30 }), pattern);

const ids = (pattern) => pattern.rows.map((candidate) => candidate.id);
const row = (pattern, id) => pattern.rows.find((candidate) => candidate.id === id);
const directions = (pattern) => pattern.rows.map((candidate) => candidate.direction);
const itemIds = (pattern, rowId) => itemsOfRow(pattern, rowId).map((item) => item.id);

/** Three rows: r1, r2, r3, each taking its kind and direction from the one before. */
const three = () => addRow(addRow(base()).pattern).pattern;

const withOrder = (pattern, rowId, order) => ({
  ...pattern,
  rows: pattern.rows.map((candidate) => (candidate.id === rowId ? { ...candidate, order } : candidate)),
});

describe('rowNumber and itemsOfRow', () => {
  test('the number is the place in the list, and an unknown row has none', () => {
    const pattern = three();

    assert.deepEqual(
      ids(pattern).map((id) => rowNumber(pattern, id)),
      [1, 2, 3],
    );
    assert.equal(rowNumber(pattern, 'r9'), 0, 'a row that does not exist has no number');
  });

  test('the stitches of a row come back in the order they were placed', () => {
    const first = place(base(), 2);
    const pattern = place({ ...addRow(first).pattern, activeRowId: 'r2' }, 3);

    assert.deepEqual(itemIds(pattern, 'r1'), ['i1', 'i2']);
    assert.deepEqual(itemIds(pattern, 'r2'), ['i3', 'i4', 'i5']);
    assert.deepEqual(itemsOfRow(pattern, 'r9'), [], 'a row that does not exist holds nothing');
  });
});

describe('addRow', () => {
  test('a new row turns the work over, and the next one turns it back', () => {
    const { pattern: second, id } = addRow(base());

    assert.equal(id, 'r2');
    assert.deepEqual(directions(second), ['ltr', 'rtl']);
    assert.deepEqual(directions(addRow(second).pattern), ['ltr', 'rtl', 'ltr']);
    assert.deepEqual(ids(base()), ['r1'], 'the pattern given in keeps its single row');
  });

  test('a new row is plain: no colour, visible and unlocked', () => {
    const { pattern: next, id } = addRow(base());
    const added = row(next, id);

    assert.deepEqual([added.kind, added.color, added.visible, added.locked], ['row', null, true, false]);
    assert.equal(Object.hasOwn(added, 'order'), false, 'the order is left to the automatic rules');
  });

  test('a row takes the kind of the one before it', () => {
    const { pattern: started, id } = addRow(base(), 'round');
    assert.equal(row(started, id).kind, 'round');

    const { pattern: next, id: third } = addRow(started);
    assert.equal(row(next, third).kind, 'round', 'the kind carries on without being asked for');
  });

  test('the first round goes anticlockwise, and every round after it follows the one before', () => {
    const { pattern: first, id } = addRow(base(), 'round');
    assert.equal(row(first, id).direction, 'ccw');

    const { pattern: second, id: next } = addRow(first);
    assert.equal(row(second, next).direction, 'ccw', 'a round does not turn the work over');

    const clockwise = updateRow(second, next, { direction: 'cw' });
    const { pattern: third, id: last } = addRow(clockwise);
    assert.equal(row(third, last).direction, 'cw', 'the new round follows the round before it');
  });

  test('a row after a round still turns over relative to the previous row', () => {
    const rounds = addRow(base(), 'round').pattern;
    const { pattern: next, id } = addRow(rounds, 'row');

    assert.equal(row(next, id).direction, 'rtl', 'r1 went left to right, so this row goes right to left');
  });

  test('the new id never reuses one that is still alive', () => {
    const pattern = three();
    const pruned = deleteRow(pattern, 'r2', 'delete');
    const { id } = addRow(pruned);

    assert.deepEqual(ids(pruned), ['r1', 'r3']);
    assert.equal(id, 'r4');
  });
});

describe('insertRowAfterActive', () => {
  test('the row lands right after the active one and renumbers the rest', () => {
    const pattern = setActiveRow(three(), 'r1');
    const { pattern: next, id } = insertRowAfterActive(pattern);

    assert.deepEqual(ids(next), ['r1', 'r4', 'r2', 'r3']);
    assert.equal(id, 'r4');
    assert.equal(rowNumber(next, 'r4'), 2);
    assert.equal(rowNumber(next, 'r3'), 4, 'the rows below take the next numbers');
  });

  test('the inserted row reads its kind and direction from the row above it, not from the end', () => {
    const pattern = setActiveRow(three(), 'r1');
    const { pattern: next, id } = insertRowAfterActive(pattern);

    assert.deepEqual([row(next, id).kind, row(next, id).direction], ['row', 'rtl']);
  });

  test('with the last row active it is the same as adding one', () => {
    const pattern = setActiveRow(three(), 'r3');
    const { pattern: next, id } = insertRowAfterActive(pattern);

    assert.deepEqual(ids(next), ['r1', 'r2', 'r3', 'r4']);
    assert.equal(row(next, id).direction, 'rtl');
  });
});

describe('deleteRow', () => {
  /** Two stitches in r1 and one in r2, so it is plain where they end up. */
  const drawn = () => place({ ...addRow(place(base(), 2)).pattern, activeRowId: 'r2' }, 1);

  test('with `delete` the stitches go with the row', () => {
    const next = deleteRow(drawn(), 'r1', 'delete');

    assert.deepEqual(ids(next), ['r2']);
    assert.deepEqual(itemIds(next, 'r2'), ['i3']);
    assert.equal(next.items.length, 1, 'the stitches of the deleted row are gone');
  });

  test('with `move` the stitches join the previous row', () => {
    const next = deleteRow(drawn(), 'r2', 'move');

    assert.deepEqual(ids(next), ['r1']);
    assert.deepEqual(itemIds(next, 'r1'), ['i1', 'i2', 'i3']);
  });

  test('deleting the first row moves its stitches down to the next one', () => {
    const next = deleteRow(drawn(), 'r1', 'move');

    assert.deepEqual(ids(next), ['r2']);
    assert.deepEqual(itemIds(next, 'r2'), ['i1', 'i2', 'i3'], 'the first row has no row above it');
  });

  test('deleting the active row hands the active place to the row above', () => {
    const pattern = setActiveRow(three(), 'r3');

    assert.equal(deleteRow(pattern, 'r3', 'delete').activeRowId, 'r2');
    assert.equal(deleteRow(pattern, 'r2', 'delete').activeRowId, 'r3', 'a row that was not active leaves it alone');
  });

  test('deleting the first row while it is active hands the active place to the row below', () => {
    const pattern = setActiveRow(three(), 'r1');

    assert.equal(deleteRow(pattern, 'r1', 'delete').activeRowId, 'r2');
  });

  test('the only remaining row cannot be deleted, and an unknown row deletes nothing', () => {
    const pattern = place(base(), 2);

    assert.equal(deleteRow(pattern, 'r1', 'delete'), pattern);
    assert.equal(deleteRow(pattern, 'r1', 'move'), pattern);
    const several = three();
    assert.equal(deleteRow(several, 'r9', 'delete'), several);
  });

  test('the pattern given in is untouched', () => {
    const pattern = drawn();
    deleteRow(pattern, 'r1', 'delete');

    assert.deepEqual(ids(pattern), ['r1', 'r2']);
    assert.equal(pattern.items.length, 3);
  });
});

describe('reorderRows', () => {
  test('moving a row renumbers the others; nothing is stored', () => {
    const pattern = three();
    const next = reorderRows(pattern, 'r3', 0);

    assert.deepEqual(ids(next), ['r3', 'r1', 'r2']);
    assert.deepEqual(
      ['r3', 'r1', 'r2'].map((id) => rowNumber(next, id)),
      [1, 2, 3],
    );
    assert.deepEqual(ids(pattern), ['r1', 'r2', 'r3'], 'the pattern given in keeps its order');
  });

  test('a place past the ends is pulled back into range', () => {
    const pattern = three();

    assert.deepEqual(ids(reorderRows(pattern, 'r1', 9)), ['r2', 'r3', 'r1']);
    assert.deepEqual(ids(reorderRows(pattern, 'r3', -4)), ['r3', 'r1', 'r2']);
  });

  test('a row already in that place, and an unknown row, give back the same object', () => {
    const pattern = three();

    assert.equal(reorderRows(pattern, 'r2', 1), pattern);
    assert.equal(reorderRows(pattern, 'r3', 5), pattern, 'clamping lands on the place it already holds');
    assert.equal(reorderRows(pattern, 'r9', 0), pattern);
  });

  test('the stitches stay with their rows', () => {
    const first = place(base(), 2);
    const pattern = place({ ...addRow(first).pattern, activeRowId: 'r2' }, 1);
    const next = reorderRows(pattern, 'r2', 0);

    assert.deepEqual(itemIds(next, 'r1'), ['i1', 'i2']);
    assert.deepEqual(itemIds(next, 'r2'), ['i3']);
    assert.equal(rowNumber(next, 'r2'), 1, 'only the numbering changed');
  });
});

describe('setActiveRow', () => {
  test('the named row becomes the active one', () => {
    const pattern = three();

    assert.equal(setActiveRow(pattern, 'r3').activeRowId, 'r3');
  });

  test('the row already active, and a row that does not exist, give back the same object', () => {
    const pattern = three();

    assert.equal(setActiveRow(pattern, 'r1'), pattern);
    assert.equal(setActiveRow(pattern, 'r9'), pattern, 'the active row always names a row that exists');
  });
});

describe('updateRow', () => {
  test('only the named row takes the patch', () => {
    const pattern = three();
    const next = updateRow(pattern, 'r2', { color: '#c0392b', locked: true, visible: false });
    const changed = row(next, 'r2');

    assert.deepEqual([changed.color, changed.locked, changed.visible], ['#c0392b', true, false]);
    assert.deepEqual([changed.id, changed.kind, changed.direction], ['r2', 'row', 'rtl'], 'the rest is left alone');
    assert.equal(row(next, 'r1').color, null);
    assert.equal(row(pattern, 'r2').color, null, 'the pattern given in is untouched');
  });

  test('a row can become a round', () => {
    const next = updateRow(three(), 'r2', { kind: 'round', direction: 'cw' });

    assert.deepEqual([row(next, 'r2').kind, row(next, 'r2').direction], ['round', 'cw']);
  });

  test('a patch that changes nothing, an empty patch and an unknown row give back the same object', () => {
    const pattern = three();

    assert.equal(updateRow(pattern, 'r2', { direction: 'rtl', visible: true }), pattern);
    assert.equal(updateRow(pattern, 'r2', {}), pattern);
    assert.equal(updateRow(pattern, 'r9', { locked: true }), pattern);
  });
});

describe('moveItemsToRow', () => {
  const drawn = () => place({ ...addRow(place(base(), 2)).pattern, activeRowId: 'r2' }, 1);

  test('the named stitches join the row, the others stay where they are', () => {
    const next = moveItemsToRow(drawn(), ['i1'], 'r2');

    assert.deepEqual(itemIds(next, 'r1'), ['i2']);
    assert.deepEqual(itemIds(next, 'r2'), ['i1', 'i3']);
  });

  test('nothing to move, a row that does not exist, and stitches already there give back the same object', () => {
    const pattern = drawn();

    assert.equal(moveItemsToRow(pattern, [], 'r2'), pattern);
    assert.equal(moveItemsToRow(pattern, ['i1'], 'r9'), pattern);
    assert.equal(moveItemsToRow(pattern, ['i3'], 'r2'), pattern, 'the stitch is in that row already');
    assert.equal(moveItemsToRow(pattern, ['i9'], 'r2'), pattern, 'an id that names nothing moves nothing');
  });
});

describe('an explicit order stays consistent', () => {
  const drawn = () => place({ ...addRow(place(base(), 2)).pattern, activeRowId: 'r2' }, 1);

  test('moving a stitch drops it from the order it left and appends it to the order it joined', () => {
    const pattern = withOrder(withOrder(drawn(), 'r1', ['i2', 'i1']), 'r2', ['i3']);
    const next = moveItemsToRow(pattern, ['i1'], 'r2');

    assert.deepEqual(row(next, 'r1').order, ['i2']);
    assert.deepEqual(row(next, 'r2').order, ['i3', 'i1'], 'the arriving stitch joins at the end');
    assert.deepEqual(row(pattern, 'r1').order, ['i2', 'i1'], 'the pattern given in is untouched');
  });

  test('a row left on `auto` is not given a list of its own', () => {
    const pattern = withOrder(drawn(), 'r2', 'auto');
    const next = moveItemsToRow(pattern, ['i1'], 'r2');

    assert.equal(row(next, 'r2').order, 'auto');
    assert.equal(Object.hasOwn(row(next, 'r1'), 'order'), false);
  });

  test('deleting a row with `move` appends its stitches to the order of the row that takes them', () => {
    const pattern = withOrder(drawn(), 'r1', ['i2', 'i1']);
    const next = deleteRow(pattern, 'r2', 'move');

    assert.deepEqual(row(next, 'r1').order, ['i2', 'i1', 'i3']);
  });

  test('deleting a row with `delete` drops its stitches from every order', () => {
    const pattern = withOrder(moveItemsToRow(drawn(), ['i3'], 'r1'), 'r1', ['i3', 'i1', 'i2']);
    const next = deleteRow(pattern, 'r2', 'delete');

    assert.deepEqual(row(next, 'r1').order, ['i3', 'i1', 'i2'], 'r2 held nothing, so the order is left alone');

    const emptied = deleteRow(moveItemsToRow(pattern, ['i1'], 'r2'), 'r2', 'delete');
    assert.deepEqual(row(emptied, 'r1').order, ['i3', 'i2'], 'the deleted stitch leaves the order behind');
  });
});
