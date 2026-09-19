/*
 * Parametric groups (PQW-967). A chain arc keeps the recipe, not the drawing:
 * the stitches are made again whenever the path or the count changes, and the
 * group is forgotten the moment it would describe stitches that moved on their own.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { addStitch, deleteItems, emptyIrregularPattern, moveItems } from '../src/core/irregular-document.ts';
import {
  addChainArc,
  addFan,
  arcRotation,
  clampCount,
  explodeGroups,
  forgetBrokenGroups,
  groupById,
  groupOfItem,
  groupsOf,
  holdsWholeGroups,
  relayoutGroup,
  reseatGroups,
  translateGroups,
  updateChainArc,
  updateFan,
  withWholeGroups,
} from '../src/core/irregular-groups.ts';
import { saveIrregular } from '../src/core/irregular-json.ts';
import { addLayer, deleteLayer, moveItemsToLayer, setActiveLayer } from '../src/core/irregular-layers.ts';
import { addRow, deleteRow, moveItemsToRow, setActiveRow } from '../src/core/irregular-rows.ts';
import { ARC_COUNT_RANGE } from '../src/core/irregular-types.ts';

const base = () => emptyIrregularPattern({ title: 'Free-form chart', layerNames: ['Drawing', 'Labels'] });

const FLAT = { width: 24, height: 12 };
const UPRIGHT = { width: 12, height: 24 };

/** A five-chain arc bowing up from (0,0) to (100,0). */
function withArc(pattern = base(), spec = {}, glyph = FLAT) {
  const start = pattern;
  return addChainArc(
    start,
    {
      rowId: start.activeRowId,
      layerId: start.activeLayerId,
      keyEntryId: 'ch',
      shape: 'arc',
      start: { x: 0, y: 0 },
      end: { x: 100, y: 0 },
      bulge: 25,
      count: 5,
      ...spec,
    },
    glyph,
  );
}

const members = (pattern, id) => {
  const group = groupById(pattern, id);
  const byId = new Map(pattern.items.map((item) => [item.id, item]));
  return group === undefined ? [] : group.memberIds.map((member) => byId.get(member));
};

describe('making a chain arc', () => {
  test('it puts one stitch per count into the active row and layer', () => {
    const { pattern, id } = withArc();
    assert.equal(pattern.items.length, 5, 'five chains');
    assert.equal(groupsOf(pattern).length, 1, 'one group');
    const group = groupById(pattern, id);
    assert.equal(group?.memberIds.length, 5, 'the group lists all five');
    for (const item of members(pattern, id)) {
      assert.equal(item?.rowId, pattern.activeRowId, 'the active row');
      assert.equal(item?.layerId, pattern.activeLayerId, 'the active layer');
      assert.equal(item?.keyEntryId, 'ch', 'chains');
    }
  });

  test('the stitches are drawn at the size the glyph was measured at', () => {
    const { pattern, id } = withArc(base(), {}, UPRIGHT);
    for (const item of members(pattern, id)) {
      assert.equal(item?.width, UPRIGHT.width, 'width');
      assert.equal(item?.height, UPRIGHT.height, 'height');
    }
  });

  test('a stitch already on the canvas is left alone', () => {
    const placed = addStitch(base(), {
      keyEntryId: 'dc',
      insertion: 'both-loops',
      x: 500,
      y: 500,
      width: 20,
      height: 40,
    }).pattern;
    const { pattern } = withArc(placed);
    assert.equal(pattern.items.length, 6, 'the loose stitch plus five chains');
    assert.equal(groupOfItem(pattern, placed.items[0].id), undefined, 'and it belongs to no group');
  });
});

describe('the turn follows the glyph', () => {
  test('an upright glyph turns to the tangent, a flat one a quarter less', () => {
    assert.equal(arcRotation(90, UPRIGHT), 90, 'upright follows the tangent');
    assert.equal(arcRotation(90, FLAT), 0, 'flat already lies along the path');
    assert.equal(arcRotation(0, FLAT), 270, 'and it wraps around, never goes negative');
  });
});

describe('changing an arc', () => {
  test('raising the count keeps the stitches that were already there', () => {
    const { pattern, id } = withArc();
    const before = groupById(pattern, id)?.memberIds ?? [];
    const next = updateChainArc(pattern, id, { count: 7 }, FLAT);
    const after = groupById(next, id)?.memberIds ?? [];
    assert.equal(after.length, 7, 'seven now');
    assert.deepEqual(after.slice(0, 5), before, 'the first five are the same stitches');
    assert.equal(next.items.length, 7, 'and the pattern holds seven');
  });

  test('lowering the count drops the extra stitches from the pattern too', () => {
    const { pattern, id } = withArc();
    const next = updateChainArc(pattern, id, { count: 3 }, FLAT);
    assert.equal(next.items.length, 3, 'three stitches left');
    assert.equal(groupById(next, id)?.memberIds.length, 3, 'and the group agrees');
  });

  test('moving an end lays the stitches out again along the new path', () => {
    const { pattern, id } = withArc();
    const before = members(pattern, id).map((item) => item?.x);
    const next = updateChainArc(pattern, id, { end: { x: 200, y: 0 } }, FLAT);
    const after = members(next, id).map((item) => item?.x);
    assert.notDeepEqual(after, before, 'the stitches moved');
    assert.equal(next.items.length, 5, 'and there are still five');
  });

  test('a change that changes nothing gives back the very same pattern', () => {
    const { pattern, id } = withArc();
    assert.equal(updateChainArc(pattern, id, { count: 5 }, FLAT), pattern, 'same count');
    assert.equal(updateChainArc(pattern, id, {}, FLAT), pattern, 'nothing at all');
    assert.equal(updateChainArc(pattern, 'nope', { count: 9 }, FLAT), pattern, 'a group that is not there');
  });

  test('a new glyph size redraws the run without moving the path', () => {
    const { pattern, id } = withArc();
    const next = relayoutGroup(pattern, id, UPRIGHT);
    assert.equal(groupById(next, id)?.bulge, 25, 'the path is untouched');
    for (const item of members(next, id)) assert.equal(item?.width, UPRIGHT.width, 'drawn at the new size');
  });

  test('the count stays inside its range', () => {
    assert.equal(clampCount(0), ARC_COUNT_RANGE.min, 'too few');
    assert.equal(clampCount(10_000), ARC_COUNT_RANGE.max, 'too many');
    assert.equal(clampCount(Number.NaN), ARC_COUNT_RANGE.min, 'not a number');
    assert.equal(clampCount(6.4), 6, 'rounded');
  });
});

describe('a group is selected and moved as one', () => {
  test('one member pulls the whole group into the selection', () => {
    const { pattern, id } = withArc();
    const first = groupById(pattern, id)?.memberIds[0] ?? '';
    assert.equal(withWholeGroups(pattern, [first]).size, 5, 'all five');
  });

  test('holding every member is what lets a move stay parametric', () => {
    const { pattern, id } = withArc();
    const all = new Set(groupById(pattern, id)?.memberIds ?? []);
    assert.equal(holdsWholeGroups(pattern, all), true, 'the whole group');
    all.delete([...all][0]);
    assert.equal(holdsWholeGroups(pattern, all), false, 'part of it');
  });

  test('moving the whole group carries its path with it', () => {
    const { pattern, id } = withArc();
    const all = new Set(groupById(pattern, id)?.memberIds ?? []);
    const moved = translateGroups(moveItems(pattern, all, 10, -5), all, 10, -5);
    const group = groupById(moved, id);
    assert.deepEqual(group?.start, { x: 10, y: -5 }, 'the start followed');
    assert.deepEqual(group?.end, { x: 110, y: -5 }, 'and the end');
    assert.equal(translateGroups(pattern, all, 0, 0), pattern, 'a move of nothing changes nothing');
  });
});

describe('forgetting a group', () => {
  test('breaking it apart leaves every stitch where it was', () => {
    const { pattern, id } = withArc();
    const before = pattern.items.map((item) => ({ ...item }));
    const next = explodeGroups(pattern, [id]);
    assert.equal(groupsOf(next).length, 0, 'no group left');
    assert.deepEqual(next.items, before, 'and not one stitch moved');
    assert.equal(next.groups, undefined, 'the empty list is dropped, not written');
  });

  test('breaking apart a group that is not there changes nothing', () => {
    const { pattern } = withArc();
    assert.equal(explodeGroups(pattern, ['nope']), pattern, 'the very same pattern');
  });

  test('deleting one stitch forgets the group, because it no longer describes it', () => {
    const { pattern, id } = withArc();
    const first = groupById(pattern, id)?.memberIds[0] ?? '';
    const next = forgetBrokenGroups(deleteItems(pattern, new Set([first])));
    assert.equal(next.items.length, 4, 'four stitches left');
    assert.equal(groupsOf(next).length, 0, 'and no group claiming five');
  });

  test('an untouched group survives the check', () => {
    const { pattern } = withArc();
    assert.equal(forgetBrokenGroups(pattern), pattern, 'the very same pattern');
  });
});

describe('a group can never name a row, layer or stitch that is gone (PQW-967)', () => {
  const save = (pattern) => saveIrregular(pattern);

  test('deleting the layer an arc was drawn on forgets the group, and the pattern still saves', () => {
    const extra = addLayer(base(), 'Second');
    const { pattern } = withArc(setActiveLayer(extra.pattern, extra.id));
    const gone = deleteLayer(pattern, extra.id);
    assert.throws(() => save(gone), /unknown-/, 'without the repair the file cannot be written');
    const fixed = reseatGroups(gone);
    assert.equal(groupsOf(fixed).length, 0, 'the group is forgotten');
    assert.ok(save(fixed).length > 0, 'and the pattern saves again');
  });

  test('deleting the row an arc was drawn on, keeping its stitches, moves the group with them', () => {
    const second = addRow(base(), 'row');
    const { pattern, id } = withArc(setActiveRow(second.pattern, second.id));
    const gone = deleteRow(pattern, second.id, 'move');
    assert.throws(() => save(gone), /unknown-row/, 'without the repair the file cannot be written');
    const fixed = reseatGroups(gone);
    assert.equal(groupById(fixed, id)?.rowId, fixed.items[0]?.rowId, 'the group sits where its stitches sit');
    assert.ok(save(fixed).length > 0, 'and the pattern saves again');
  });

  test('moving a whole arc to another row takes the recipe with it', () => {
    const { pattern, id } = withArc();
    const second = addRow(pattern, 'row');
    const moved = reseatGroups(moveItemsToRow(second.pattern, new Set(pattern.items.map((i) => i.id)), second.id));
    assert.equal(groupById(moved, id)?.rowId, second.id, 'the group followed');
    const again = updateChainArc(moved, id, { count: 6 }, FLAT);
    for (const item of members(again, id)) assert.equal(item?.rowId, second.id, 'so a relayout does not drag it back');
  });

  test('stitches pulled apart onto different rows forget their group', () => {
    const { pattern } = withArc();
    const second = addRow(pattern, 'row');
    const split = moveItemsToRow(second.pattern, new Set([pattern.items[0].id]), second.id);
    assert.equal(groupsOf(reseatGroups(split)).length, 0, 'a group over two rows is no group');
  });

  test('a pattern that is already seated right is given back unchanged', () => {
    const { pattern } = withArc();
    assert.equal(reseatGroups(pattern), pattern, 'the very same pattern');
    const plain = base();
    assert.equal(reseatGroups(plain), plain, 'and one with no group at all');
  });
});

describe('a fan is a group like any other (PQW-968)', () => {
  const fanned = (pattern = base(), spec = {}) => {
    const start = pattern;
    return addFan(
      start,
      {
        rowId: start.activeRowId,
        layerId: start.activeLayerId,
        keyEntryId: 'dc',
        mode: 'spread',
        origin: { x: 0, y: 0 },
        direction: 0,
        spreadAngle: 120,
        length: 60,
        count: 5,
        ...spec,
      },
      UPRIGHT,
    );
  };

  test('it puts one stitch per count into the active row', () => {
    const { pattern, id } = fanned();
    assert.equal(pattern.items.length, 5, 'five stitches');
    assert.equal(groupById(pattern, id)?.kind, 'fan', 'and they are a fan');
    for (const item of members(pattern, id)) assert.equal(item?.rowId, pattern.activeRowId, 'the active row');
  });

  test('changing the count keeps the stitches that were already there', () => {
    const { pattern, id } = fanned();
    const before = groupById(pattern, id)?.memberIds ?? [];
    const next = updateFan(pattern, id, { count: 7 }, UPRIGHT);
    assert.deepEqual(groupById(next, id)?.memberIds.slice(0, 5), before, 'the first five are the same');
    assert.equal(next.items.length, 7, 'and the pattern holds seven');
  });

  test('the length and the spread stay inside their range', () => {
    const { pattern, id } = fanned();
    assert.equal(updateFan(pattern, id, { spreadAngle: 5000 }, UPRIGHT).groups?.[0]?.spreadAngle, 350, 'capped');
    assert.equal(updateFan(pattern, id, { length: 0 }, UPRIGHT).groups?.[0]?.length, 4, 'a fan has to have a length');
  });

  test('a change that changes nothing gives back the very same pattern', () => {
    const { pattern, id } = fanned();
    assert.equal(updateFan(pattern, id, {}, UPRIGHT), pattern, 'nothing at all');
    assert.equal(updateFan(pattern, id, { count: 5 }, UPRIGHT), pattern, 'the same count');
  });

  test('a fan patch never touches a chain arc, and the other way round', () => {
    const { pattern, id } = withArc();
    assert.equal(updateFan(pattern, id, { count: 9 }, FLAT), pattern, 'an arc is not a fan');
    const fan = fanned();
    assert.equal(updateChainArc(fan.pattern, fan.id, { count: 9 }, UPRIGHT), fan.pattern, 'and a fan is not an arc');
  });

  test('moving a whole fan carries its middle with it', () => {
    const { pattern, id } = fanned();
    const all = new Set(groupById(pattern, id)?.memberIds ?? []);
    const moved = translateGroups(pattern, all, 12, -8);
    assert.deepEqual(groupById(moved, id)?.origin, { x: 12, y: -8 }, 'the origin followed');
  });

  test('deleting one of its stitches forgets the fan', () => {
    const { pattern, id } = fanned();
    const first = groupById(pattern, id)?.memberIds[0] ?? '';
    assert.equal(groupsOf(forgetBrokenGroups(deleteItems(pattern, new Set([first])))).length, 0, 'forgotten');
  });
});
