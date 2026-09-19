/*
 * The stitch order within one row of the free-form chart (PQW-963): the
 * automatic reading of the positions, and the crocheter's own order on top of
 * it. Every operation is pure, and one that moves nothing gives back the very
 * same object so the editor records no undo step.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { addStitch, emptyIrregularPattern } from '../src/core/irregular-document.ts';
import {
  isManualOrder,
  moveInOrder,
  orderPosition,
  resetOrder,
  rowOrder,
  setManualOrder,
  setOrderPosition,
} from '../src/core/irregular-order.ts';

const base = () => emptyIrregularPattern({ title: 'Free-form chart', layerNames: ['Drawing', 'Labels'] });

/** One stitch with sensible defaults; the spec fields override them. */
const stitch = (pattern, spec) =>
  addStitch(pattern, { keyEntryId: 'sc', insertion: 'both-loops', x: 0, y: 0, width: 20, height: 20, ...spec });

const place = (pattern, specs) => specs.reduce((current, spec) => stitch(current, spec).pattern, pattern);

const withRow = (pattern, id, patch) => ({
  ...pattern,
  rows: pattern.rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
});

const withSecondRow = (pattern) => ({
  ...pattern,
  rows: [...pattern.rows, { id: 'r2', kind: 'row', direction: 'ltr', color: null, visible: true, locked: false }],
});

/** A round of stitches about a chosen centre, given as clock positions. */
const round = (direction, centre, offsets) =>
  withRow(
    place(
      base(),
      offsets.map(([dx, dy]) => ({ x: centre.x + dx, y: centre.y + dy })),
    ),
    'r1',
    { kind: 'round', direction },
  );

describe('rowOrder on a row', () => {
  test('a left-to-right row reads across, whatever order the stitches were drawn in', () => {
    const pattern = place(base(), [{ x: 60 }, { x: 0 }, { x: 30 }]);

    assert.deepEqual(rowOrder(pattern, 'r1'), ['i2', 'i3', 'i1']);
  });

  test('a right-to-left row reads the other way', () => {
    const pattern = withRow(place(base(), [{ x: 60 }, { x: 0 }, { x: 30 }]), 'r1', { direction: 'rtl' });

    assert.deepEqual(rowOrder(pattern, 'r1'), ['i1', 'i3', 'i2']);
  });

  test('stitches sharing an x come in order of y, the lower one first', () => {
    const pattern = place(base(), [
      { x: 0, y: 30 },
      { x: 0, y: 0 },
      { x: 20, y: 0 },
    ]);

    assert.deepEqual(rowOrder(pattern, 'r1'), ['i2', 'i1', 'i3'], 'y breaks the tie on x');
    assert.deepEqual(
      rowOrder(withRow(pattern, 'r1', { direction: 'rtl' }), 'r1'),
      ['i3', 'i2', 'i1'],
      'the tie on x is broken by y the same way whichever way the row runs',
    );
  });

  test('only the stitches of the named row take part', () => {
    const first = place(base(), [{ x: 0 }, { x: 30 }]);
    const pattern = place({ ...withSecondRow(first), activeRowId: 'r2' }, [{ x: 60 }]);

    assert.deepEqual(rowOrder(pattern, 'r1'), ['i1', 'i2']);
    assert.deepEqual(rowOrder(pattern, 'r2'), ['i3']);
  });

  test('a row id that names nothing gives an empty order instead of throwing', () => {
    const pattern = place(base(), [{ x: 0 }]);

    assert.deepEqual(rowOrder(pattern, 'r9'), []);
    assert.deepEqual(rowOrder(base(), 'r1'), [], 'a row with no stitches is empty too');
  });
});

describe('rowOrder on a round', () => {
  // Four stitches at twelve, three, six and nine o'clock, drawn in that order.
  const clock = [
    [0, -40],
    [40, 0],
    [0, 40],
    [-40, 0],
  ];

  test("a clockwise round starts at twelve and goes on to three o'clock", () => {
    const pattern = round('cw', { x: 0, y: 0 }, clock);

    assert.deepEqual(rowOrder(pattern, 'r1'), ['i1', 'i2', 'i3', 'i4']);
  });

  test("a counter-clockwise round starts at twelve and goes on to nine o'clock", () => {
    const pattern = round('ccw', { x: 0, y: 0 }, clock);

    assert.deepEqual(rowOrder(pattern, 'r1'), ['i1', 'i4', 'i3', 'i2']);
  });

  test("the angles are read about the centre of the round's own stitches, not about the origin", () => {
    const pattern = round('cw', { x: 500, y: 300 }, clock);

    assert.deepEqual(rowOrder(pattern, 'r1'), ['i1', 'i2', 'i3', 'i4']);
  });

  test('a round reads the angle, not the place across the chart', () => {
    // Eight stitches an eighth of a turn apart, drawn counter-clockwise from three o'clock.
    const eighths = [
      [40, 0],
      [28, -28],
      [0, -40],
      [-28, -28],
      [-40, 0],
      [-28, 28],
      [0, 40],
      [28, 28],
    ];
    const pattern = round('cw', { x: 0, y: 0 }, eighths);

    assert.deepEqual(rowOrder(pattern, 'r1'), ['i3', 'i2', 'i1', 'i8', 'i7', 'i6', 'i5', 'i4']);
  });
});

describe('coinciding stitches', () => {
  test('stitches on the same spot keep the order they were drawn in, and never change it', () => {
    const pattern = place(base(), [
      { x: 10, y: 10 },
      { x: 10, y: 10 },
      { x: 0, y: 0 },
    ]);

    assert.deepEqual(rowOrder(pattern, 'r1'), ['i3', 'i1', 'i2']);
    assert.deepEqual(rowOrder(pattern, 'r1'), rowOrder(pattern, 'r1'), 'the same input gives the same order');
  });

  test('stitches on the same spot in a round keep the order they were drawn in', () => {
    const pattern = round('cw', { x: 0, y: 0 }, [
      [0, 40],
      [0, -40],
      [0, 40],
    ]);

    assert.deepEqual(rowOrder(pattern, 'r1'), ['i2', 'i1', 'i3']);
  });
});

describe('setManualOrder and resetOrder', () => {
  const three = () => place(base(), [{ x: 0 }, { x: 30 }, { x: 60 }]);

  test("the crocheter's own order is kept and read back, and the pattern given in is untouched", () => {
    const pattern = three();
    const next = setManualOrder(pattern, 'r1', ['i3', 'i1', 'i2']);

    assert.equal(isManualOrder(pattern, 'r1'), false);
    assert.equal(isManualOrder(next, 'r1'), true);
    assert.deepEqual(rowOrder(next, 'r1'), ['i3', 'i1', 'i2']);
    assert.deepEqual(rowOrder(pattern, 'r1'), ['i1', 'i2', 'i3'], 'the pattern given in still reads the positions');
    assert.deepEqual([orderPosition(next, 'r1', 'i3'), orderPosition(next, 'r1', 'i2')], [1, 3]);
  });

  test('the same order again, and an unknown row, give back the same object', () => {
    const pattern = setManualOrder(three(), 'r1', ['i3', 'i1', 'i2']);

    assert.equal(setManualOrder(pattern, 'r1', ['i3', 'i1', 'i2']), pattern);
    assert.equal(setManualOrder(pattern, 'r9', ['i1']), pattern);
    assert.equal(resetOrder(pattern, 'r9'), pattern);
  });

  test('ids that no longer belong to the row are passed over', () => {
    const pattern = setManualOrder(three(), 'r1', ['i9', 'i3', 'i1', 'i3', 'i2']);

    assert.deepEqual(rowOrder(pattern, 'r1'), ['i3', 'i1', 'i2'], 'a stale id and a repeat are both ignored');
  });

  test('resetting goes back to the positions and leaves no order behind', () => {
    const manual = setManualOrder(three(), 'r1', ['i3', 'i1', 'i2']);
    const next = resetOrder(manual, 'r1');

    assert.equal(isManualOrder(next, 'r1'), false);
    assert.deepEqual(rowOrder(next, 'r1'), ['i1', 'i2', 'i3']);
    assert.equal(Object.hasOwn(next.rows[0], 'order'), false, 'the order is gone, not merely emptied');
    assert.equal(isManualOrder(manual, 'r1'), true, 'the pattern given in keeps its order');
  });

  test('resetting a row that never had an order gives back the same object', () => {
    const pattern = three();

    assert.equal(resetOrder(pattern, 'r1'), pattern);
  });
});

describe('a stitch added to a row the crocheter has ordered', () => {
  const ordered = () => setManualOrder(place(base(), [{ x: 0 }, { x: 10 }, { x: 20 }]), 'r1', ['i3', 'i1', 'i2']);

  test('lands between the neighbours the positions give it, not at the end', () => {
    const pattern = place(ordered(), [{ x: 5 }]);

    assert.deepEqual(rowOrder(pattern, 'r1'), ['i3', 'i1', 'i4', 'i2'], 'the new stitch sits between i1 and i2');
    assert.equal(orderPosition(pattern, 'r1', 'i4'), 3);
  });

  test('lands before the first of its neighbours when nothing comes earlier', () => {
    const pattern = place(ordered(), [{ x: -5 }]);

    assert.deepEqual(rowOrder(pattern, 'r1'), ['i3', 'i4', 'i1', 'i2']);
  });

  test('several new stitches keep their own order between the neighbours', () => {
    const pattern = place(ordered(), [{ x: 6 }, { x: 4 }]);

    assert.deepEqual(
      rowOrder(pattern, 'r1'),
      ['i3', 'i1', 'i5', 'i4', 'i2'],
      'the pair reads across between i1 and i2',
    );
  });

  test('a stitch that goes takes its place with it', () => {
    const pattern = setManualOrder(place(base(), [{ x: 0 }, { x: 10 }, { x: 20 }]), 'r1', ['i3', 'i1', 'i2']);
    const pruned = { ...pattern, items: pattern.items.filter((item) => item.id !== 'i1') };

    assert.deepEqual(rowOrder(pruned, 'r1'), ['i3', 'i2']);
    assert.equal(orderPosition(pruned, 'r1', 'i1'), null);
  });
});

describe('moveInOrder', () => {
  const three = () => place(base(), [{ x: 0 }, { x: 30 }, { x: 60 }]);

  test('a step later swaps a stitch with the one after it and writes the order down', () => {
    const pattern = three();
    const next = moveInOrder(pattern, 'r1', 'i1', 1);

    assert.deepEqual(rowOrder(next, 'r1'), ['i2', 'i1', 'i3']);
    assert.equal(isManualOrder(next, 'r1'), true, "moving makes the order the crocheter's own");
    assert.deepEqual(rowOrder(pattern, 'r1'), ['i1', 'i2', 'i3'], 'the pattern given in is untouched');
  });

  test('a step earlier does the same the other way', () => {
    const next = moveInOrder(three(), 'r1', 'i3', -1);

    assert.deepEqual(rowOrder(next, 'r1'), ['i1', 'i3', 'i2']);
  });

  test('a big step clamps to the end it is heading for', () => {
    assert.deepEqual(rowOrder(moveInOrder(three(), 'r1', 'i1', 9), 'r1'), ['i2', 'i3', 'i1']);
    assert.deepEqual(rowOrder(moveInOrder(three(), 'r1', 'i3', -9), 'r1'), ['i3', 'i1', 'i2']);
  });

  test('at either end, a step off the end gives back the same object', () => {
    const pattern = three();

    assert.equal(moveInOrder(pattern, 'r1', 'i1', -1), pattern, 'the first stitch cannot go earlier');
    assert.equal(moveInOrder(pattern, 'r1', 'i3', 1), pattern, 'the last stitch cannot go later');
    assert.equal(moveInOrder(pattern, 'r1', 'i2', 0), pattern, 'a step of nothing moves nothing');
    assert.equal(moveInOrder(pattern, 'r1', 'i9', 1), pattern, 'an id that is not in the row moves nothing');
    assert.equal(moveInOrder(pattern, 'r9', 'i1', 1), pattern, 'a row that does not exist moves nothing');
  });

  test('moving a second time builds on the order already written down', () => {
    const once = moveInOrder(three(), 'r1', 'i1', 2);
    const twice = moveInOrder(once, 'r1', 'i3', -2);

    assert.deepEqual(rowOrder(twice, 'r1'), ['i3', 'i2', 'i1']);
  });
});

describe('setOrderPosition and orderPosition', () => {
  const three = () => place(base(), [{ x: 0 }, { x: 30 }, { x: 60 }]);

  test('the places are counted from one', () => {
    const pattern = three();

    assert.deepEqual(
      ['i1', 'i2', 'i3'].map((id) => orderPosition(pattern, 'r1', id)),
      [1, 2, 3],
    );
    assert.equal(orderPosition(pattern, 'r1', 'i9'), null, 'a stitch outside the row has no place');
    assert.equal(orderPosition(pattern, 'r9', 'i1'), null, 'a row that does not exist has no places');
  });

  test('a stitch takes the place it is given', () => {
    const next = setOrderPosition(three(), 'r1', 'i3', 1);

    assert.deepEqual(rowOrder(next, 'r1'), ['i3', 'i1', 'i2']);
    assert.equal(orderPosition(next, 'r1', 'i3'), 1);
    assert.equal(isManualOrder(next, 'r1'), true);
  });

  test('a place below one or above the count clamps into range', () => {
    assert.deepEqual(rowOrder(setOrderPosition(three(), 'r1', 'i3', 0), 'r1'), ['i3', 'i1', 'i2']);
    assert.deepEqual(rowOrder(setOrderPosition(three(), 'r1', 'i3', -7), 'r1'), ['i3', 'i1', 'i2']);
    assert.deepEqual(rowOrder(setOrderPosition(three(), 'r1', 'i1', 99), 'r1'), ['i2', 'i3', 'i1']);
  });

  test('the place a stitch already holds gives back the same object', () => {
    const pattern = three();

    assert.equal(setOrderPosition(pattern, 'r1', 'i2', 2), pattern);
    assert.equal(setOrderPosition(pattern, 'r1', 'i1', 0), pattern, 'clamping onto the place it holds moves nothing');
    assert.equal(setOrderPosition(pattern, 'r1', 'i9', 1), pattern, 'an id that is not in the row moves nothing');
    assert.equal(setOrderPosition(pattern, 'r9', 'i1', 1), pattern, 'a row that does not exist moves nothing');
  });
});
