/*
 * Undo and redo (PQW-1149): whole states on two stacks, a hundred steps deep,
 * and a step that may be continued instead of repeated.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { amend, canRedo, canUndo, createHistory, HISTORY_LIMIT, record, redo, undo } from '../src/core/history.ts';

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

test('the limit is a hundred steps, and the oldest are dropped', () => {
  assert.equal(HISTORY_LIMIT, 100);
  let history = createHistory(0);
  for (let i = 1; i <= HISTORY_LIMIT + 50; i += 1) history = record(history, i);
  assert.equal(history.past.length, HISTORY_LIMIT);
  assert.equal(history.past[0], 50);
});

test('amending continues the last step: however many times, one undo goes back before it', () => {
  let history = record(createHistory('start'), 'arranged 4');
  for (const gap of [5, 6, 7, 8]) history = amend(history, `arranged ${gap}`);
  assert.equal(history.present, 'arranged 8');
  assert.deepEqual(history.past, ['start']);
  assert.equal(undo(history).present, 'start');
});

test('amending keeps the redo stack, and an unchanged state returns the same history', () => {
  const undone = undo(record(createHistory('a'), 'b'));
  const amended = amend(undone, 'a, reselected');
  assert.deepEqual(amended.future, ['b']);
  assert.equal(amend(amended, amended.present), amended);
});
