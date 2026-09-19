import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { HISTORY_LIMIT, canRedo, canUndo, createHistory, record, redo, undo } from '../src/core/history.ts';

test('undo and redo walk the same sequence of states', () => {
  let history = record(record(createHistory('a'), 'b'), 'c');
  assert.equal(history.present, 'c');

  history = undo(history);
  assert.equal(history.present, 'b');
  history = undo(history);
  assert.equal(history.present, 'a');
  assert.equal(canUndo(history), false);

  history = redo(redo(history));
  assert.equal(history.present, 'c');
  assert.equal(canRedo(history), false);
});

test('a new change after an undo clears the redo stack', () => {
  const history = record(undo(record(createHistory(1), 2)), 3);
  assert.equal(history.present, 3);
  assert.deepEqual(history.past, [1]);
  assert.equal(canRedo(history), false);
});

test('recording an unchanged state is not a step, and undo or redo on an empty stack changes nothing', () => {
  const start = createHistory({ n: 1 });
  assert.equal(record(start, start.present), start);
  assert.equal(undo(start), start);
  assert.equal(redo(start), start);
});

test(`at most ${HISTORY_LIMIT} steps can be undone`, () => {
  let history = createHistory(0);
  for (let i = 1; i <= HISTORY_LIMIT + 50; i += 1) history = record(history, i);
  assert.equal(history.past.length, HISTORY_LIMIT);
  assert.equal(history.past[0], 50);
});
