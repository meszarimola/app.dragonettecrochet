/*
 * The circular repeat of the free-form chart (PQW-970): a motif copied around a
 * centre. Chart coordinates grow downward and angles are degrees clockwise from
 * straight up, so a copy's own turn reads like the angle it travelled. `count`
 * is the total including the original, so eight asks for seven new stitches.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { addStitch, deleteItems, emptyIrregularPattern } from '../src/core/irregular-document.ts';
import { addChainArc, groupById, groupOfItem, groupsOf } from '../src/core/irregular-groups.ts';
import { circularRepeat, REPEAT_COUNT_RANGE, REPEAT_RANGE_LIMITS, repeatAngles } from '../src/core/irregular-repeat.ts';
import { angleFromCenter, directionOf } from '../src/core/irregular-snap.ts';

const base = () => emptyIrregularPattern({ title: 'Free-form chart', layerNames: ['Drawing', 'Labels'] });

/** One stitch with sensible defaults; the spec fields override them. */
const stitch = (pattern, spec) =>
  addStitch(pattern, { keyEntryId: 'sc', insertion: 'both-loops', x: 0, y: 0, width: 20, height: 20, ...spec });

const place = (pattern, specs) => specs.reduce((current, spec) => stitch(current, spec).pattern, pattern);
const found = (pattern, id) => pattern.items.find((candidate) => candidate.id === id);
const ids = (pattern) => pattern.items.map((candidate) => candidate.id);

const near = (actual, expected, message, slack = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= slack, `${message}: ${actual} vs ${expected}`);

const nearPoint = (actual, expected, message, slack = 1e-9) => {
  near(actual.x, expected.x, `${message} (x)`, slack);
  near(actual.y, expected.y, `${message} (y)`, slack);
};

const CENTER = { x: 0, y: 0 };

/** Eight copies around the whole circle unless the case says otherwise. */
const around = (patch) => ({ center: CENTER, count: 8, range: 360, ...patch });

const distance = (point, center) => Math.hypot(point.x - center.x, point.y - center.y);

/** A second row and a stitch on it, so row-bound behaviour has something to tell apart. */
const withSecondRow = (pattern) => ({
  ...pattern,
  rows: [...pattern.rows, { id: 'r2', kind: 'row', direction: 'ltr', color: null, visible: true, locked: false }],
});

/** A three-chain arc bowing above the centre, so a group member can be copied. */
const withArc = (pattern) =>
  addChainArc(
    pattern,
    {
      rowId: pattern.activeRowId,
      layerId: pattern.activeLayerId,
      keyEntryId: 'ch',
      shape: 'arc',
      start: { x: -50, y: -100 },
      end: { x: 50, y: -100 },
      bulge: 20,
      count: 3,
    },
    { width: 24, height: 12 },
  );

describe('repeatAngles', () => {
  test('a full circle leaves no copy on the original: eight copies step by 45 up to 315', () => {
    const angles = repeatAngles(around({}));

    assert.equal(angles.length, 7, 'the original is one of the eight');
    for (const [index, angle] of angles.entries()) near(angle, 45 * (index + 1), `angle ${index}`);
  });

  test('a 90 degree range with four copies steps by 30, so the last copy is 90 degrees round', () => {
    const angles = repeatAngles(around({ count: 4, range: 90 }));

    assert.equal(angles.length, 3);
    for (const [index, angle] of angles.entries()) near(angle, 30 * (index + 1), `angle ${index}`);
    near(angles[angles.length - 1], 90, 'the last copy sits on the end of the range');
  });

  test('two copies over a full circle stand opposite each other', () => {
    const angles = repeatAngles(around({ count: 2 }));

    assert.equal(angles.length, 1);
    near(angles[0], 180, 'half a turn away');
  });

  test('a count above the most allowed is clamped, not refused', () => {
    const angles = repeatAngles(around({ count: 5000 }));

    assert.equal(angles.length, REPEAT_COUNT_RANGE.max - 1, 'the most copies there may be, less the original');
    near(angles[0], 360 / REPEAT_COUNT_RANGE.max, 'the step of the largest full circle');
  });

  test('a range past the circle is a full circle, and a range below the least is the least', () => {
    const whole = repeatAngles(around({ count: 4, range: 720 }));
    for (const [index, angle] of whole.entries()) near(angle, 90 * (index + 1), `angle ${index} of a clamped circle`);

    const pinched = repeatAngles(around({ count: 3, range: -90 }));
    near(pinched[pinched.length - 1], REPEAT_RANGE_LIMITS.min, 'the narrowest range there may be');
  });

  test('a count of one has nothing to copy, and neither has a broken count or range', () => {
    assert.deepEqual(repeatAngles(around({ count: 1 })), []);
    assert.deepEqual(repeatAngles(around({ count: 0 })), []);
    assert.deepEqual(repeatAngles(around({ count: -4 })), []);
    assert.deepEqual(repeatAngles(around({ count: Number.NaN })), []);
    assert.deepEqual(repeatAngles(around({ count: Number.POSITIVE_INFINITY })), []);
    assert.deepEqual(repeatAngles(around({ range: Number.NaN })), []);
    assert.deepEqual(repeatAngles(around({ range: Number.NEGATIVE_INFINITY })), []);
  });
});

describe('circularRepeat around a full circle', () => {
  const above = () => place(base(), [{ x: 0, y: -100 }]);

  test('eight copies of one stitch add seven, at 45 degree steps and the same distance out', () => {
    const pattern = above();
    const { pattern: next, ids: made } = circularRepeat(pattern, new Set(['i1']), around({}));

    assert.equal(made.length, 7, 'the eighth is the original itself');
    assert.equal(next.items.length, 8);
    for (const [index, id] of made.entries()) {
      const copy = found(next, id);
      near(angleFromCenter(CENTER, copy), 45 * (index + 1), `copy ${index} stands at its own angle`);
      near(distance(copy, CENTER), 100, `copy ${index} keeps the distance from the centre`);
    }
  });

  test('a quarter turn takes a stitch above the centre to the right of it', () => {
    const { pattern: next, ids: made } = circularRepeat(above(), new Set(['i1']), around({ count: 4 }));

    nearPoint(found(next, made[0]), { x: 100, y: 0 }, 'the first copy of a four-fold repeat');
    nearPoint(found(next, made[1]), { x: 0, y: 100 }, 'the second');
    nearPoint(found(next, made[2]), { x: -100, y: 0 }, 'the third');
  });

  test('the original neither moves nor gains a copy on top of itself', () => {
    const pattern = place(base(), [{ x: 0, y: -100, rotation: 20 }]);
    const { pattern: next, ids: made } = circularRepeat(pattern, new Set(['i1']), around({}));
    const original = found(next, 'i1');

    nearPoint(original, { x: 0, y: -100 }, 'the original stays where it was');
    assert.equal(original.rotation, 20, 'and keeps its own turn');
    assert.ok(!made.includes('i1'), 'the original is not one of the copies');
    for (const [index, id] of made.entries()) {
      assert.ok(distance(found(next, id), original) > 1, `copy ${index} sits away from the original`);
    }
  });
});

describe('the turn of a copy', () => {
  test('a copy turns as far as it travelled, so a stitch pointing outwards still does', () => {
    const pattern = place(base(), [{ x: 0, y: -100 }]);
    const { pattern: next, ids: made } = circularRepeat(pattern, new Set(['i1']), around({ count: 4 }));

    for (const [index, id] of made.entries()) {
      const copy = found(next, id);
      near(copy.rotation, 90 * (index + 1), `copy ${index} turned by its own step`);
      nearPoint(
        directionOf(copy.rotation),
        directionOf(angleFromCenter(CENTER, copy)),
        `copy ${index} still points away from the centre`,
      );
    }
  });

  test('a stitch that was already turned keeps that turn and adds its step', () => {
    const pattern = place(base(), [{ x: 0, y: -100, rotation: 20 }]);
    const { pattern: next, ids: made } = circularRepeat(pattern, new Set(['i1']), around({ count: 4 }));

    for (const [index, id] of made.entries())
      near(found(next, id).rotation, (20 + 90 * (index + 1)) % 360, `copy ${index}`);
  });
});

describe('what a copy belongs to', () => {
  test('every copy keeps the row and the layer of the stitch it came from', () => {
    const first = place(base(), [{ x: 0, y: -100 }]);
    const second = place({ ...withSecondRow(first), activeRowId: 'r2', activeLayerId: 'l2' }, [{ x: 0, y: -60 }]);
    // The active row and layer are elsewhere: a copy follows its source, not them.
    const pattern = { ...second, activeRowId: 'r1', activeLayerId: 'l1' };
    const { pattern: next, ids: made } = circularRepeat(pattern, new Set(['i1', 'i2']), around({ count: 2 }));

    assert.deepEqual(made, ['i3', 'i4'], 'one copy of each stitch');
    assert.deepEqual(
      made.map((id) => [found(next, id).rowId, found(next, id).layerId]),
      [
        ['r1', 'l1'],
        ['r2', 'l2'],
      ],
    );
  });

  test('copying a stitch of a chain arc makes plain stitches and leaves the group alone', () => {
    const { pattern, id } = withArc(base());
    const member = groupById(pattern, id).memberIds[0];
    const { pattern: next, ids: made } = circularRepeat(pattern, new Set([member]), around({ count: 3 }));

    assert.equal(groupsOf(next).length, 1, 'no second group is made');
    assert.deepEqual(groupById(next, id).memberIds, groupById(pattern, id).memberIds, 'the group lists only its own');
    for (const [index, copy] of made.entries()) {
      assert.equal(found(next, copy).kind, 'stitch', `copy ${index} is a plain stitch`);
      assert.equal(groupOfItem(next, copy), undefined, `copy ${index} belongs to no group`);
    }
  });
});

describe('the pattern that comes back', () => {
  test('new ids never collide with the ones already there', () => {
    const drawn = place(base(), [
      { x: 0, y: -100 },
      { x: 0, y: -60 },
      { x: 0, y: -20 },
    ]);
    const pattern = deleteItems(drawn, ['i2']);
    const { pattern: next, ids: made } = circularRepeat(pattern, new Set(['i1']), around({ count: 5 }));

    assert.deepEqual(made, ['i4', 'i5', 'i6', 'i7'], 'the id of the deleted stitch is not handed out again');
    assert.equal(new Set(ids(next)).size, next.items.length, 'every id in the chart is its own');
  });

  test('it differs from the one given in by exactly the new items, which is one undo step', () => {
    const pattern = place(base(), [{ x: 0, y: -100 }]);
    const { pattern: next, ids: made } = circularRepeat(pattern, new Set(['i1']), around({ count: 3 }));

    assert.equal(next.items.length, pattern.items.length + made.length);
    assert.deepEqual(
      next.items.slice(0, pattern.items.length),
      pattern.items,
      'the stitches already drawn are untouched',
    );
    assert.deepEqual(
      next.items.slice(pattern.items.length).map((candidate) => candidate.id),
      made,
      'the new items are the copies, in the order they were made',
    );
    assert.deepEqual({ ...next, items: [] }, { ...pattern, items: [] }, 'nothing outside the items changed');
    assert.deepEqual(ids(pattern), ['i1'], 'the pattern given in gained nothing');
  });
});

describe('nothing to do', () => {
  const pattern = place(base(), [{ x: 0, y: -100 }]);
  const unchanged = (result, what) => {
    assert.equal(result.pattern, pattern, `${what}: the very same object comes back`);
    assert.deepEqual(result.ids, [], `${what}: no new ids`);
  };

  test('an empty selection gives back the very same object', () => {
    unchanged(circularRepeat(pattern, new Set(), around({})), 'an empty selection');
  });

  test('ids that name nothing give back the very same object', () => {
    unchanged(circularRepeat(pattern, new Set(['i9', 'i10']), around({})), 'ids that are not in the pattern');
  });

  test('a count of one has nothing to copy and gives back the very same object', () => {
    unchanged(circularRepeat(pattern, new Set(['i1']), around({ count: 1 })), 'a count of one');
    unchanged(circularRepeat(pattern, new Set(['i1']), around({ count: 0 })), 'a count of none');
  });

  test('a broken count or range gives back the very same object', () => {
    unchanged(circularRepeat(pattern, new Set(['i1']), around({ count: Number.NaN })), 'a count that is not a number');
    unchanged(
      circularRepeat(pattern, new Set(['i1']), around({ count: Number.POSITIVE_INFINITY })),
      'an infinite count',
    );
    unchanged(circularRepeat(pattern, new Set(['i1']), around({ range: Number.NaN })), 'a range that is not a number');
    unchanged(
      circularRepeat(pattern, new Set(['i1']), around({ range: Number.NEGATIVE_INFINITY })),
      'an infinite range',
    );
  });

  test('a centre that is not a number gives back the very same object', () => {
    unchanged(circularRepeat(pattern, new Set(['i1']), around({ center: { x: Number.NaN, y: 0 } })), 'a broken centre');
    unchanged(
      circularRepeat(pattern, new Set(['i1']), around({ center: { x: 0, y: Number.POSITIVE_INFINITY } })),
      'a centre at infinity',
    );
  });
});

describe('a broken spec cannot poison the chart', () => {
  const broken = [
    { what: 'a centre that is not a number', patch: { center: { x: Number.NaN, y: 0 } } },
    { what: 'a centre at infinity', patch: { center: { x: 0, y: Number.POSITIVE_INFINITY } } },
    { what: 'a count that is not a number', patch: { count: Number.NaN } },
    { what: 'an infinite count', patch: { count: Number.POSITIVE_INFINITY } },
    { what: 'a count of none', patch: { count: 0 } },
    { what: 'a count below none', patch: { count: -5 } },
    { what: 'a count far above the most', patch: { count: 5000 } },
    { what: 'a fractional count', patch: { count: 6.4 } },
    { what: 'a range that is not a number', patch: { range: Number.NaN } },
    { what: 'an infinite range', patch: { range: Number.NEGATIVE_INFINITY } },
    { what: 'a range of none', patch: { range: 0 } },
    { what: 'a range below none', patch: { range: -90 } },
    { what: 'a range past the circle', patch: { range: 720 } },
    {
      what: 'every field at once',
      patch: { center: { x: Number.NaN, y: Number.NaN }, count: Number.NaN, range: Number.NaN },
    },
  ];

  for (const { what, patch } of broken) {
    test(`${what} leaves every stitch finite, and never throws`, () => {
      const pattern = place(base(), [{ x: 0, y: -100, rotation: 30 }]);
      const spec = around(patch);
      const { pattern: next, ids: made } = circularRepeat(pattern, new Set(['i1']), spec);

      assert.ok(Array.isArray(made), 'an array of ids either way');
      assert.equal(next.items.length, pattern.items.length + made.length, 'as many new stitches as new ids');
      for (const [index, angle] of repeatAngles(spec).entries()) {
        assert.ok(Number.isFinite(angle), `${what}: angle ${index} is ${angle}`);
      }
      for (const [index, candidate] of next.items.entries()) {
        assert.ok(Number.isFinite(candidate.x), `${what}: x of stitch ${index} is ${candidate.x}`);
        assert.ok(Number.isFinite(candidate.y), `${what}: y of stitch ${index} is ${candidate.y}`);
        assert.ok(Number.isFinite(candidate.rotation), `${what}: the turn of stitch ${index} is ${candidate.rotation}`);
      }
    });
  }
});
