import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { HISTORY_LIMIT, canRedo, canUndo, createHistory, record, redo, undo } from '../src/core/history.ts';

test('visszavonás és újra ugyanazt az állapotsort járja be', () => {
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

test('új változás visszavonás után törli az újra-vermet', () => {
  const history = record(undo(record(createHistory(1), 2)), 3);
  assert.equal(history.present, 3);
  assert.deepEqual(history.past, [1]);
  assert.equal(canRedo(history), false);
});

test('azonos állapotból nem lesz lépés, üres veremnél a művelet nem változtat', () => {
  const start = createHistory({ n: 1 });
  assert.equal(record(start, start.present), start);
  assert.equal(undo(start), start);
  assert.equal(redo(start), start);
});

test(`legfeljebb ${HISTORY_LIMIT} lépés vonható vissza`, () => {
  let history = createHistory(0);
  for (let i = 1; i <= HISTORY_LIMIT + 50; i += 1) history = record(history, i);
  assert.equal(history.past.length, HISTORY_LIMIT);
  assert.equal(history.past[0], 50);
});
