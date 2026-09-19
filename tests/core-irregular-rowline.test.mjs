/*
 * The shape a row sits on, and moving whole rows about (FR-ROWPOS-1, FR-ROWPOS-2).
 * Chart coordinates grow downward and the left normal of a direction (dx, dy) is
 * (dy, -dx), so a row worked left to right steps upward as the spacing grows.
 * Every operation is pure: one that changes nothing gives back the very same
 * object, which is how the editor decides whether to record an undo step.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { addStitch, emptyIrregularPattern } from '../src/core/irregular-document.ts';
import {
  alignRows,
  lineOffset,
  moveRow,
  moveRowLine,
  rowLine,
  setRowLine,
  spaceRows,
} from '../src/core/irregular-rowline.ts';
import { addRow, updateRow } from '../src/core/irregular-rows.ts';

const SLACK = 1e-9;

const near = (actual, expected, message, slack = SLACK) =>
  assert.ok(Math.abs(actual - expected) <= slack, `${message}: ${actual} vs ${expected}`);

const nearPoint = (actual, expected, message, slack = SLACK) => {
  near(actual.x, expected.x, `${message} (x)`, slack);
  near(actual.y, expected.y, `${message} (y)`, slack);
};

const base = () => emptyIrregularPattern({ title: 'Free-form chart', layerNames: ['Drawing', 'Labels'] });

/** Three rows, r1 to r3, all of them plain rows. */
const three = () => addRow(addRow(base()).pattern).pattern;

/** One stitch of a fixed size in the named row, wherever the active row happens to be. */
const stitchIn = (pattern, rowId, x, y) => {
  const placed = addStitch(
    { ...pattern, activeRowId: rowId },
    { keyEntryId: 'sc', insertion: 'both-loops', x, y, width: 20, height: 20 },
  ).pattern;
  return { ...placed, activeRowId: pattern.activeRowId };
};

const straight = (y, spec) => ({
  shape: 'line',
  start: { x: 0, y },
  end: { x: 100, y },
  side: 'left',
  perpendicular: true,
  ...spec,
});

const bowed = (y, bulge, spec) => ({
  shape: 'arc',
  start: { x: 0, y },
  end: { x: 100, y },
  bulge,
  side: 'left',
  perpendicular: true,
  ...spec,
});

const ring = (center, radius, spec) => ({
  shape: 'circle',
  center,
  radius,
  startAngle: 0,
  side: 'outside',
  perpendicular: true,
  ...spec,
});

const rowOf = (pattern, rowId) => pattern.rows.find((row) => row.id === rowId);
const itemsIn = (pattern, rowId) => pattern.items.filter((item) => item.rowId === rowId);
const oneItem = (pattern, rowId) => itemsIn(pattern, rowId)[0];
const lineY = (pattern, rowId) => rowLine(pattern, rowId).start.y;
const lock = (pattern, rowId) => updateRow(pattern, rowId, { locked: true });
const asRound = (pattern, rowId) => updateRow(pattern, rowId, { kind: 'round', direction: 'ccw' });

/** Three rows carrying a straight line each, and one stitch sitting on every line. */
const stacked = (ys) =>
  ys.reduce((current, y, index) => {
    const id = `r${index + 1}`;
    return stitchIn(setRowLine(current, id, straight(y)), id, 10, y);
  }, three());

const assertFinite = (pattern, message) => {
  for (const item of pattern.items) {
    assert.ok(Number.isFinite(item.x) && Number.isFinite(item.y), `${message}: ${item.id} is at ${item.x},${item.y}`);
  }
  for (const row of pattern.rows) {
    const line = row.line;
    if (line === undefined) continue;
    const numbers =
      line.shape === 'circle'
        ? [line.center.x, line.center.y, line.radius]
        : [line.start.x, line.start.y, line.end.x, line.end.y];
    for (const value of numbers) assert.ok(Number.isFinite(value), `${message}: ${row.id} holds ${value}`);
  }
};

describe('setRowLine and rowLine', () => {
  test('a row takes the shape it is given, and hands it back', () => {
    const pattern = three();
    const next = setRowLine(pattern, 'r2', straight(40));

    assert.deepEqual(rowLine(next, 'r2'), straight(40));
    assert.equal(rowLine(next, 'r1'), undefined, 'the other rows are left bare');
    assert.equal(rowLine(pattern, 'r2'), undefined, 'the pattern given in is untouched');
    assert.equal(rowLine(next, 'r9'), undefined, 'a row that does not exist has no shape');
  });

  test('setting the same shape again gives back the very same pattern', () => {
    const pattern = setRowLine(three(), 'r2', straight(40));

    assert.equal(setRowLine(pattern, 'r2', straight(40)), pattern, 'an equal shape is not a change');
    assert.equal(setRowLine(pattern, 'r2', { ...straight(40) }), pattern, 'field by field, not object by object');
  });

  test('a shape that differs in any field replaces the one on the row', () => {
    const pattern = setRowLine(three(), 'r2', straight(40));

    assert.notEqual(setRowLine(pattern, 'r2', { ...straight(40), side: 'right' }), pattern);
    assert.notEqual(setRowLine(pattern, 'r2', { ...straight(40), perpendicular: false }), pattern);
    assert.notEqual(setRowLine(pattern, 'r2', bowed(40, 0)), pattern, 'an arc is not the line through its ends');
    assert.notEqual(setRowLine(pattern, 'r2', straight(41)), pattern);
  });

  test('null takes the shape off and leaves no line key behind', () => {
    const pattern = setRowLine(three(), 'r2', straight(40));
    const next = setRowLine(pattern, 'r2', null);

    assert.equal(rowLine(next, 'r2'), undefined);
    assert.equal(Object.hasOwn(rowOf(next, 'r2'), 'line'), false, 'the row is bare again, not holding an empty shape');
  });

  test('clearing a bare row, and an unknown row, give back the very same pattern', () => {
    const pattern = setRowLine(three(), 'r2', straight(40));

    assert.equal(setRowLine(pattern, 'r1', null), pattern);
    assert.equal(setRowLine(pattern, 'r9', null), pattern);
    assert.equal(setRowLine(pattern, 'r9', straight(0)), pattern);
  });
});

describe('moveRowLine', () => {
  test('a straight line moves both its ends by the offset', () => {
    const pattern = setRowLine(three(), 'r1', straight(40));
    const line = rowLine(moveRowLine(pattern, 'r1', 5, -12), 'r1');

    nearPoint(line.start, { x: 5, y: 28 }, 'the start');
    nearPoint(line.end, { x: 105, y: 28 }, 'the end');
  });

  test('an arc moves by the offset and keeps its bulge', () => {
    const pattern = setRowLine(three(), 'r1', bowed(40, 30));
    const line = rowLine(moveRowLine(pattern, 'r1', -5, 10), 'r1');

    nearPoint(line.start, { x: -5, y: 50 }, 'the start');
    nearPoint(line.end, { x: 95, y: 50 }, 'the end');
    near(line.bulge, 30, 'the bow is the same bow');
  });

  test('a circle moves its centre and keeps its radius', () => {
    const pattern = setRowLine(three(), 'r1', ring({ x: 10, y: 10 }, 40));
    const line = rowLine(moveRowLine(pattern, 'r1', 7, -3), 'r1');

    nearPoint(line.center, { x: 17, y: 7 }, 'the centre');
    near(line.radius, 40, 'the radius');
  });

  test('the stitches of the row stay where they are', () => {
    const pattern = stitchIn(setRowLine(three(), 'r1', straight(40)), 'r1', 10, 40);
    const next = moveRowLine(pattern, 'r1', 0, -20);

    nearPoint(oneItem(next, 'r1'), { x: 10, y: 40 }, 'only the shape moved');
  });

  test('a move of nothing, a bare row, a locked row and an unknown row give back the very same pattern', () => {
    const pattern = setRowLine(three(), 'r1', straight(40));

    assert.equal(moveRowLine(pattern, 'r1', 0, 0), pattern);
    assert.equal(moveRowLine(pattern, 'r2', 5, 5), pattern, 'r2 has no shape to move');
    assert.equal(moveRowLine(pattern, 'r9', 5, 5), pattern);
    const locked = lock(pattern, 'r1');
    assert.equal(moveRowLine(locked, 'r1', 5, 5), locked, 'a locked row does not move');
  });
});

describe('lineOffset', () => {
  test('a line steps along its own left normal, which is upward for a row worked left to right', () => {
    const moved = lineOffset(straight(40), 25);

    nearPoint(moved.start, { x: 0, y: 15 }, 'the start');
    nearPoint(moved.end, { x: 100, y: 15 }, 'the end');
    near(lineOffset(straight(40), -25).start.y, 65, 'a negative distance steps the other way');
  });

  test('an arc steps along the normal of its chord and keeps its bow', () => {
    const moved = lineOffset(bowed(40, 12), 25);

    nearPoint(moved.start, { x: 0, y: 15 }, 'the start');
    near(moved.bulge, 12, 'the bow is the same bow');
  });

  test('a circle steps its radius and keeps its centre', () => {
    const moved = lineOffset(ring({ x: 5, y: 5 }, 30), 20);

    nearPoint(moved.center, { x: 5, y: 5 }, 'the centre');
    near(moved.radius, 50, 'the radius');
  });

  test('a circle never takes a negative radius', () => {
    near(lineOffset(ring({ x: 0, y: 0 }, 30), -100).radius, 0, 'the circle shrinks to a point and stops');
  });

  test('a step of nothing, and a line with no length, give back the very same shape', () => {
    const line = straight(40);
    const point = { ...straight(40), end: { x: 0, y: 40 } };

    assert.equal(lineOffset(line, 0), line);
    assert.equal(lineOffset(line, Number.NaN), line);
    assert.equal(lineOffset(point, 25), point, 'a line of no length has no normal to step along');
  });
});

describe('spaceRows', () => {
  test('rows with shapes end up exactly the spacing apart, their stitches moving with them', () => {
    const pattern = stitchIn(setRowLine(stacked([0, 17]), 'r3', bowed(40, 12)), 'r3', 10, 40);
    const { pattern: next, skipped } = spaceRows(pattern, ['r1', 'r2', 'r3'], 30);

    assert.deepEqual(skipped, []);
    near(lineY(next, 'r1'), 0, 'the first row keeps its place');
    near(lineY(next, 'r2'), -30, 'the second row stands one spacing along the normal');
    near(lineY(next, 'r3'), -60, 'the third row stands two spacings along it');
    near(rowLine(next, 'r3').bulge, 12, 'the arc keeps its bow');
  });

  test('the stitches move by the same offset as the shape they sit on', () => {
    const { pattern: next } = spaceRows(stacked([0, 17, 40]), ['r1', 'r2', 'r3'], 30);

    nearPoint(oneItem(next, 'r1'), { x: 10, y: 0 }, 'the stitch of the first row');
    nearPoint(oneItem(next, 'r2'), { x: 10, y: -30 }, 'the stitch moved by -47 with its line');
    nearPoint(oneItem(next, 'r3'), { x: 10, y: -60 }, 'the stitch moved by -100 with its line');
  });

  test('the first row given never moves', () => {
    const pattern = stacked([25, 17, 40]);
    const { pattern: next } = spaceRows(pattern, ['r1', 'r2', 'r3'], 30);

    near(lineY(next, 'r1'), 25, 'the shape of the first row');
    nearPoint(oneItem(next, 'r1'), { x: 10, y: 25 }, 'and its stitch');
    near(lineY(next, 'r2'), -5, 'the rest step away from where it stands');
  });

  test('row order decides, not the order the ids arrive in', () => {
    const pattern = stacked([0, 17, 40]);

    assert.deepEqual(spaceRows(pattern, ['r3', 'r1', 'r2'], 30), spaceRows(pattern, ['r1', 'r2', 'r3'], 30));
    assert.deepEqual(spaceRows(pattern, ['r3', 'r3', 'r2', 'r1'], 30), spaceRows(pattern, ['r1', 'r2', 'r3'], 30));
  });

  test('circles become concentric with the first one, their radii stepping by the spacing', () => {
    const rounds = ['r1', 'r2', 'r3'].reduce((current, id) => asRound(current, id), three());
    const pattern = stitchIn(
      ['r1', 'r2', 'r3'].reduce(
        (current, id, index) => setRowLine(current, id, ring({ x: index * 5, y: index * 9 }, 10 + index * 13)),
        rounds,
      ),
      'r2',
      5,
      9,
    );
    const { pattern: next, skipped } = spaceRows(pattern, ['r1', 'r2', 'r3'], 20);

    assert.deepEqual(skipped, []);
    nearPoint(rowLine(next, 'r1').center, { x: 0, y: 0 }, 'the first circle keeps its centre');
    near(rowLine(next, 'r1').radius, 10, 'and its radius');
    nearPoint(rowLine(next, 'r2').center, { x: 0, y: 0 }, 'the second circle shares that centre');
    near(rowLine(next, 'r2').radius, 30, 'and stands one spacing further out');
    nearPoint(rowLine(next, 'r3').center, { x: 0, y: 0 }, 'the third circle shares it too');
    near(rowLine(next, 'r3').radius, 50, 'and stands two spacings out');
    nearPoint(oneItem(next, 'r2'), { x: 0, y: 0 }, 'the stitches follow the centre they were drawn around');
  });

  test('a round without a shape is skipped and reported, and the rows after it still move', () => {
    const pattern = stitchIn(asRound(setRowLine(stacked([0, 17, 40]), 'r2', null), 'r2'), 'r2', 10, 17);
    const { pattern: next, skipped } = spaceRows(pattern, ['r1', 'r2', 'r3'], 30);

    assert.deepEqual(skipped, [{ rowId: 'r2', code: 'round-without-line' }]);
    assert.equal(rowLine(next, 'r2'), undefined, 'the round is still bare');
    nearPoint(oneItem(next, 'r2'), { x: 10, y: 17 }, 'the round stays where it was drawn');
    near(lineY(next, 'r3'), -30, 'only the rows that were placed count towards the spacing');
  });

  test('rows without shapes are stacked by their bounding boxes', () => {
    const pattern = [
      [0, 0],
      [0, 50],
      [0, 100],
    ].reduce((current, [x, y], index) => stitchIn(current, `r${index + 1}`, x, y), three());
    const { pattern: next, skipped } = spaceRows(pattern, ['r1', 'r2', 'r3'], 25);

    assert.deepEqual(skipped, []);
    nearPoint(oneItem(next, 'r1'), { x: 0, y: 0 }, 'the first row keeps its place');
    nearPoint(oneItem(next, 'r2'), { x: 0, y: 45 }, 'its box starts a spacing below the box above it');
    nearPoint(oneItem(next, 'r3'), { x: 0, y: 90 }, 'and so does the next one');
  });

  test('a row with no stitches and no shape has nothing to move', () => {
    const pattern = stacked([0, 17]);
    const { pattern: next, skipped } = spaceRows(pattern, ['r1', 'r2', 'r3'], 30);

    assert.deepEqual(skipped, [{ rowId: 'r3', code: 'nothing-to-move' }]);
    near(lineY(next, 'r2'), -30, 'the row that could move still moved');
  });

  test('a locked row stays where it is and is reported', () => {
    const pattern = lock(stacked([0, 17, 40]), 'r2');
    const { pattern: next, skipped } = spaceRows(pattern, ['r1', 'r2', 'r3'], 30);

    assert.deepEqual(skipped, [{ rowId: 'r2', code: 'nothing-to-move' }]);
    near(lineY(next, 'r2'), 17, 'the locked row is where it was');
    nearPoint(oneItem(next, 'r2'), { x: 10, y: 17 }, 'and so are its stitches');
    near(lineY(next, 'r3'), -30, 'the row after it takes the first free place');
  });

  test('fewer than two rows report that there are none, and the pattern comes back untouched', () => {
    const pattern = stacked([0, 17, 40]);

    assert.deepEqual(spaceRows(pattern, [], 30), { pattern, skipped: [{ rowId: '', code: 'no-rows' }] });
    assert.deepEqual(spaceRows(pattern, ['r2'], 30), { pattern, skipped: [{ rowId: 'r2', code: 'no-rows' }] });
    assert.deepEqual(spaceRows(pattern, ['r9'], 30), { pattern, skipped: [{ rowId: '', code: 'no-rows' }] });
    assert.equal(spaceRows(pattern, [], 30).pattern, pattern, 'the very same object');
  });

  test('a spacing that is not a number moves nothing and says so', () => {
    const pattern = stacked([0, 17, 40]);
    const { pattern: next, skipped } = spaceRows(pattern, ['r1', 'r2', 'r3'], Number.NaN);

    assert.equal(next, pattern, 'the very same object');
    assert.deepEqual(skipped, [
      { rowId: 'r2', code: 'nothing-to-move' },
      { rowId: 'r3', code: 'nothing-to-move' },
    ]);
  });

  test('rows already the spacing apart give back the very same pattern', () => {
    const pattern = stacked([0, -30, -60]);

    assert.equal(spaceRows(pattern, ['r1', 'r2', 'r3'], 30).pattern, pattern);
  });
});

describe('alignRows', () => {
  /** Three rows with one stitch each, standing 50 apart across the chart. */
  const spread = () =>
    [0, 50, 100].reduce((current, x, index) => stitchIn(current, `r${index + 1}`, x, index * 40), three());

  test('start lines the rows up on the left edge of them all', () => {
    const next = alignRows(spread(), ['r1', 'r2', 'r3'], 'start');

    assert.deepEqual(
      ['r1', 'r2', 'r3'].map((id) => oneItem(next, id).x),
      [0, 0, 0],
    );
    near(oneItem(next, 'r1').y, 0, 'nothing moves up or down');
    near(oneItem(next, 'r3').y, 80, 'nothing moves up or down');
  });

  test('center lines the rows up on their shared middle', () => {
    const next = alignRows(spread(), ['r1', 'r2', 'r3'], 'center');

    assert.deepEqual(
      ['r1', 'r2', 'r3'].map((id) => oneItem(next, id).x),
      [50, 50, 50],
    );
  });

  test('end lines the rows up on the right edge of them all', () => {
    const next = alignRows(spread(), ['r1', 'r2', 'r3'], 'end');

    assert.deepEqual(
      ['r1', 'r2', 'r3'].map((id) => oneItem(next, id).x),
      [100, 100, 100],
    );
  });

  test('the row shape moves with the stitches', () => {
    const pattern = setRowLine(stitchIn(stitchIn(addRow(base()).pattern, 'r1', 0, 0), 'r2', 50, 40), 'r2', {
      ...straight(40),
      start: { x: 40, y: 40 },
      end: { x: 60, y: 40 },
    });
    const next = alignRows(pattern, ['r1', 'r2'], 'start');

    near(oneItem(next, 'r2').x, 0, 'the stitch');
    nearPoint(rowLine(next, 'r2').start, { x: -10, y: 40 }, 'the shape moved by the same amount');
    nearPoint(rowLine(next, 'r2').end, { x: 10, y: 40 }, 'both ends of it');
  });

  test('a row that is only a shape is aligned by that shape', () => {
    const pattern = setRowLine(setRowLine(addRow(base()).pattern, 'r1', straight(0)), 'r2', {
      ...straight(40),
      start: { x: 200, y: 40 },
      end: { x: 300, y: 40 },
    });
    const next = alignRows(pattern, ['r1', 'r2'], 'start');

    nearPoint(rowLine(next, 'r2').start, { x: 0, y: 40 }, 'the second line starts where the first one does');
    nearPoint(rowLine(next, 'r1').start, { x: 0, y: 0 }, 'the leftmost row is already there');
  });

  test('concentric moves every round onto the centre of the first one', () => {
    const rounds = asRound(asRound(three(), 'r1'), 'r2');
    const pattern = stitchIn(
      setRowLine(setRowLine(rounds, 'r1', ring({ x: 0, y: 0 }, 10)), 'r2', ring({ x: 20, y: 30 }, 25)),
      'r2',
      20,
      55,
    );
    const next = alignRows(pattern, ['r1', 'r2'], 'concentric');

    nearPoint(rowLine(next, 'r2').center, { x: 0, y: 0 }, 'the second round shares the centre');
    near(rowLine(next, 'r2').radius, 25, 'and keeps its own size');
    nearPoint(oneItem(next, 'r2'), { x: 0, y: 25 }, 'its stitches came along');
    nearPoint(rowLine(next, 'r1').center, { x: 0, y: 0 }, 'the first round did not move');
  });

  test('concentric leaves a row alone', () => {
    const rounds = asRound(asRound(three(), 'r1'), 'r2');
    const pattern = stitchIn(
      setRowLine(setRowLine(rounds, 'r1', ring({ x: 0, y: 0 }, 10)), 'r2', ring({ x: 20, y: 30 }, 25)),
      'r3',
      200,
      200,
    );
    const next = alignRows(pattern, ['r1', 'r2', 'r3'], 'concentric');

    nearPoint(oneItem(next, 'r3'), { x: 200, y: 200 }, 'r3 is a row, not a round, so it stays where it is');
    nearPoint(rowLine(next, 'r2').center, { x: 0, y: 0 }, 'the rounds still moved');
  });

  test('a locked row is not aligned, and still counts towards the edge the others meet at', () => {
    const next = alignRows(lock(spread(), 'r2'), ['r1', 'r2', 'r3'], 'start');

    assert.deepEqual(
      ['r1', 'r2', 'r3'].map((id) => oneItem(next, id).x),
      [0, 50, 0],
      'the locked row stays put while the others line up on the leftmost edge',
    );
    near(alignRows(lock(spread(), 'r1'), ['r1', 'r2', 'r3'], 'end').items[0].x, 0, 'a locked row is left where it is');
  });

  test('rows already aligned, one row alone and unknown rows give back the very same pattern', () => {
    const pattern = stitchIn(stitchIn(addRow(base()).pattern, 'r1', 0, 0), 'r2', 0, 40);

    assert.equal(alignRows(pattern, ['r1', 'r2'], 'start'), pattern);
    assert.equal(alignRows(pattern, ['r1', 'r2'], 'center'), pattern);
    assert.equal(alignRows(pattern, ['r1', 'r2'], 'end'), pattern);
    assert.equal(alignRows(pattern, ['r1'], 'start'), pattern, 'one row is aligned with itself');
    assert.equal(alignRows(pattern, [], 'center'), pattern);
    assert.equal(alignRows(pattern, ['r8', 'r9'], 'end'), pattern);
    assert.equal(alignRows(pattern, ['r1', 'r2'], 'concentric'), pattern, 'neither of them is a round');
  });
});

describe('moveRow', () => {
  test('the stitches and the shape move together', () => {
    const pattern = stacked([0, 17]);
    const next = moveRow(pattern, 'r2', 5, -7);

    nearPoint(oneItem(next, 'r2'), { x: 15, y: 10 }, 'the stitch');
    nearPoint(rowLine(next, 'r2').start, { x: 5, y: 10 }, 'the shape');
    nearPoint(oneItem(next, 'r1'), { x: 10, y: 0 }, 'the other rows are left alone');
  });

  test('a move of nothing, an unknown row, a locked row and an empty row give back the very same pattern', () => {
    const pattern = stacked([0, 17]);

    assert.equal(moveRow(pattern, 'r2', 0, 0), pattern);
    assert.equal(moveRow(pattern, 'r9', 5, 5), pattern);
    assert.equal(moveRow(pattern, 'r3', 5, 5), pattern, 'r3 holds neither stitches nor a shape');
    const locked = lock(pattern, 'r2');
    assert.equal(moveRow(locked, 'r2', 5, 5), locked);
  });
});

describe('broken input', () => {
  test('every broken call comes back finite and throws nothing', () => {
    const drawn = stacked([0, 17, 40]);
    const bent = setRowLine(drawn, 'r2', { ...straight(17), end: { x: 0, y: 17 } });
    const calls = [
      ['a spacing of infinity', () => spaceRows(drawn, ['r1', 'r2', 'r3'], Number.POSITIVE_INFINITY).pattern],
      ['a spacing of nothing at all', () => spaceRows(drawn, ['r1', 'r2', 'r3'], Number.NaN).pattern],
      ['a spacing of zero', () => spaceRows(drawn, ['r1', 'r2', 'r3'], 0).pattern],
      ['rows that do not exist', () => spaceRows(drawn, ['r8', 'r9'], 30).pattern],
      ['a shape with no length', () => spaceRows(bent, ['r1', 'r2', 'r3'], 30).pattern],
      ['an alignment of nothing', () => alignRows(drawn, [], 'start')],
      ['an alignment of a line with no length', () => alignRows(bent, ['r1', 'r2', 'r3'], 'center')],
      ['rounds that are not rounds', () => alignRows(drawn, ['r1', 'r2', 'r3'], 'concentric')],
      ['a move by nothing at all', () => moveRow(drawn, 'r2', Number.NaN, Number.POSITIVE_INFINITY)],
      ['a shape moved by nothing at all', () => moveRowLine(drawn, 'r2', Number.NaN, Number.NEGATIVE_INFINITY)],
      ['a shape put on a row that does not exist', () => setRowLine(drawn, 'r9', straight(0))],
    ];

    for (const [message, call] of calls) {
      let result;
      assert.doesNotThrow(() => {
        result = call();
      }, message);
      assertFinite(result, message);
    }
  });

  test('a shape that holds no number cannot be placed, and says so', () => {
    const wrong = setRowLine(stacked([0, 17, 40]), 'r2', { ...straight(17), start: { x: Number.NaN, y: 17 } });
    const { pattern: next, skipped } = spaceRows(wrong, ['r1', 'r2', 'r3'], 30);

    assert.deepEqual(skipped, [{ rowId: 'r2', code: 'nothing-to-move' }]);
    assert.deepEqual(rowLine(next, 'r2'), rowLine(wrong, 'r2'), 'the shape it could not read is left alone');
    near(lineY(next, 'r3'), -30, 'the rows it could read still moved');
    assert.doesNotThrow(() => alignRows(wrong, ['r1', 'r2', 'r3'], 'center'), 'aligning it throws nothing either');
  });
});
