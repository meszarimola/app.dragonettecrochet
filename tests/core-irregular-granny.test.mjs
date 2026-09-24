/*
 * The granny square rounds (PQW-1040). Every stitch keeps its glyph's natural
 * size; a round spreads its stitches evenly round a square, from the top-left
 * corner clockwise, facing outwards. The next round starts one stitch height
 * further out.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { emptyIrregularPattern } from '../src/core/irregular-document.ts';
import { grannyBand, grannyOuter, grannyShapes, squareStop } from '../src/core/irregular-granny.ts';
import {
  addGrannyRound,
  clampGrannyCount,
  grannyRounds,
  setGrannyCount,
  translateGroups,
} from '../src/core/irregular-groups.ts';
import { loadIrregular, saveIrregular } from '../src/core/irregular-json.ts';
import { GRANNY_COUNT_RANGE } from '../src/core/irregular-types.ts';

const near = (actual, expected, message, slack = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= slack, `${message}: ${actual} vs ${expected}`);

const DC = { width: 12, height: 40 };

function granny() {
  return {
    ...emptyIrregularPattern({ title: 'Nagymama-négyzet', layerNames: ['Réteg'] }),
    motif: 'granny-square',
  };
}

describe('squareStop', () => {
  test('the corners face diagonally out, the middle of a side straight out', () => {
    const half = 10;
    assert.deepEqual(squareStop(half, 0), { at: { x: -10, y: -10 }, angle: 315 });
    assert.deepEqual(squareStop(half, 10), { at: { x: 0, y: -10 }, angle: 0 });
    assert.deepEqual(squareStop(half, 20), { at: { x: 10, y: -10 }, angle: 45 });
    assert.deepEqual(squareStop(half, 30), { at: { x: 10, y: 0 }, angle: 90 });
    assert.deepEqual(squareStop(half, 50), { at: { x: 0, y: 10 }, angle: 180 });
    assert.deepEqual(squareStop(half, 70), { at: { x: -10, y: 0 }, angle: 270 });
  });
});

describe('grannyShapes', () => {
  test('8 stitches: one on each corner and one in the middle of each side', () => {
    const shapes = grannyShapes({ center: { x: 0, y: 0 }, inner: 0, count: 8 }, DC);
    assert.equal(shapes.length, 8);
    assert.deepEqual(
      shapes.map((shape) => shape.rotation),
      [315, 0, 45, 90, 135, 180, 225, 270],
    );
    near(shapes[1].at.y, -20, 'the middle of the top side sits half a stitch out');
  });

  test('no stitch is ever stretched: every member keeps the natural glyph size', () => {
    for (const count of [1, 4, 8, 13, 40]) {
      for (const shape of grannyShapes({ center: { x: 5, y: 7 }, inner: 40, count }, DC)) {
        assert.equal(shape.width, DC.width);
        assert.equal(shape.height, DC.height);
      }
    }
  });

  test('the base of a stitch stands on the inner square, its top one stitch height out', () => {
    const [, middle] = grannyShapes({ center: { x: 0, y: 0 }, inner: 40, count: 8 }, DC);
    near(middle.at.y, -(40 + DC.height / 2), 'centre of the top middle stitch');
    assert.equal(grannyOuter({ inner: 40 }, DC), 80);
  });

  test('the round follows its centre', () => {
    const shapes = grannyShapes({ center: { x: 100, y: -50 }, inner: 0, count: 4 }, DC);
    assert.deepEqual(shapes[0].at, { x: 80, y: -70 });
  });
});

describe('granny rounds in a pattern', () => {
  test('a round is a group; its count lays the members out again and keeps their ids', () => {
    const start = granny();
    const made = addGrannyRound(
      start,
      { rowId: 'r1', layerId: 'l1', keyEntryId: 'dc', center: { x: 0, y: 0 }, inner: 0, count: 8 },
      DC,
    );
    const [round] = grannyRounds(made.pattern);
    assert.equal(round.count, 8);
    assert.equal(made.pattern.items.length, 8);
    const more = setGrannyCount(made.pattern, round.id, 12, DC);
    const [grown] = grannyRounds(more);
    assert.equal(grown.count, 12);
    assert.deepEqual(grown.memberIds.slice(0, 8), round.memberIds);
    assert.equal(more.items.length, 12);
  });

  test('the count stays within its range', () => {
    assert.equal(clampGrannyCount(0), GRANNY_COUNT_RANGE.min);
    assert.equal(clampGrannyCount(10_000), GRANNY_COUNT_RANGE.max);
    assert.equal(clampGrannyCount(Number.NaN), GRANNY_COUNT_RANGE.min);
  });

  test('moving the stitches carries the round centre along', () => {
    const made = addGrannyRound(
      granny(),
      { rowId: 'r1', layerId: 'l1', keyEntryId: 'dc', center: { x: 0, y: 0 }, inner: 0, count: 4 },
      DC,
    );
    const ids = new Set(made.pattern.items.map((item) => item.id));
    const moved = translateGroups(made.pattern, ids, 10, 5);
    assert.deepEqual(grannyRounds(moved)[0].center, { x: 10, y: 5 });
  });

  test('a granny square and its rounds survive the file', () => {
    const made = addGrannyRound(
      granny(),
      { rowId: 'r1', layerId: 'l1', keyEntryId: 'dc', center: { x: 0, y: 0 }, inner: 0, count: 8 },
      DC,
    );
    const loaded = loadIrregular(saveIrregular(made.pattern));
    assert.ok(loaded.ok);
    assert.equal(loaded.pattern.motif, 'granny-square');
    assert.deepEqual(grannyRounds(loaded.pattern), grannyRounds(made.pattern));
  });

  test('a file with a negative inner square is refused', () => {
    const made = addGrannyRound(
      granny(),
      { rowId: 'r1', layerId: 'l1', keyEntryId: 'dc', center: { x: 0, y: 0 }, inner: 0, count: 4 },
      DC,
    );
    const raw = JSON.parse(saveIrregular(made.pattern));
    raw.groups[0].inner = -1;
    const loaded = loadIrregular(JSON.stringify(raw));
    assert.equal(loaded.ok, false);
  });
});

describe('grannyBand', () => {
  test('one cell per stitch: the dividers follow the round count, round by round', () => {
    for (const count of [8, 16, 24]) {
      assert.equal(grannyBand({ center: { x: 0, y: 0 }, inner: 40, count }, DC, 0).dividers.length, count);
    }
    assert.equal(grannyBand({ center: { x: 0, y: 0 }, inner: 0, count: 1 }, DC, 0).dividers.length, 0);
  });

  test('the band runs from the round base to its top, and the first reaches the centre', () => {
    const first = grannyBand({ center: { x: 0, y: 0 }, inner: 0, count: 8 }, DC, 0);
    assert.equal(first.inner, null);
    assert.deepEqual(first.outer[0], { x: -40, y: -40 });
    assert.deepEqual(first.dividers[0][0], { x: 0, y: 0 });
    const second = grannyBand({ center: { x: 0, y: 0 }, inner: 40, count: 16 }, DC, 1);
    assert.equal(second.tone, 1);
    assert.deepEqual(second.inner?.[0], { x: -40, y: -40 });
    assert.deepEqual(second.outer[0], { x: -80, y: -80 });
  });

  test('a divider stands halfway between two stitches', () => {
    const band = grannyBand({ center: { x: 0, y: 0 }, inner: 40, count: 8 }, DC, 0);
    const [from, to] = band.dividers[0];
    near(from.x, -20, 'inner end, half a stitch step along the top side');
    near(from.y, -40, 'inner end on the base square');
    near(to.x, -40, 'outer end');
    near(to.y, -80, 'outer end on the top square');
  });
});
