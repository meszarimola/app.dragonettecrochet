/*
 * Edit operations on the free-form chart document (PQW-963): every operation is
 * pure, and a no-op gives back the very same object so the editor can tell that
 * nothing happened and records no undo step.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import {
  addStitch,
  alignItems,
  deleteItems,
  distributeItems,
  duplicateItems,
  duplicateOffset,
  emptyIrregularPattern,
  flipItems,
  isSelectable,
  isVisible,
  itemBox,
  moveItems,
  normalizeAngle,
  pasteItems,
  rotateItems,
  rowCount,
  setTitle,
  stitchCount,
  updateItems,
} from '../src/core/irregular-document.ts';
import { DEFAULT_GRID_SIZE, IRREGULAR_FORMAT_VERSION } from '../src/core/irregular-types.ts';

const base = () => emptyIrregularPattern({ title: 'Free-form chart', layerNames: ['Drawing', 'Labels'] });

/** One stitch with sensible defaults; the spec fields override them. */
const stitch = (pattern, spec) =>
  addStitch(pattern, { keyEntryId: 'sc', insertion: 'both-loops', x: 0, y: 0, width: 20, height: 20, ...spec });

const place = (pattern, specs) => specs.reduce((current, spec) => stitch(current, spec).pattern, pattern);
const item = (pattern, id) => pattern.items.find((candidate) => candidate.id === id);
const ids = (pattern) => pattern.items.map((candidate) => candidate.id);
const xs = (pattern) => pattern.items.map((candidate) => candidate.x);
const ys = (pattern) => pattern.items.map((candidate) => candidate.y);

const near = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} instead of ${expected}`);

const withRow = (pattern, id, patch) => ({
  ...pattern,
  rows: pattern.rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
});

const withLayer = (pattern, id, patch) => ({
  ...pattern,
  layers: pattern.layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)),
});

/** A second row, so row-bound behaviour has something to tell apart. */
const withSecondRow = (pattern) => ({
  ...pattern,
  rows: [...pattern.rows, { id: 'r2', kind: 'row', direction: 'ltr', color: null, visible: true, locked: false }],
});

describe('emptyIrregularPattern', () => {
  test('one row, the two given layers, nothing drawn and no grid', () => {
    const pattern = base();

    assert.equal(pattern.type, 'irregular');
    assert.equal(pattern.formatVersion, IRREGULAR_FORMAT_VERSION);
    assert.equal(pattern.title, 'Free-form chart');
    assert.deepEqual(
      pattern.rows.map((row) => [row.id, row.kind, row.visible, row.locked]),
      [['r1', 'row', true, false]],
    );
    assert.deepEqual(
      pattern.layers.map((layer) => layer.name),
      ['Drawing', 'Labels'],
      'the layers keep the order they were given, bottom first',
    );
    assert.deepEqual(pattern.items, []);
    assert.equal(pattern.activeRowId, 'r1');
    assert.equal(pattern.activeLayerId, 'l1', 'the first layer is the active one');
    assert.equal(pattern.guides.grid.visible, false);
    assert.equal(pattern.guides.grid.size, DEFAULT_GRID_SIZE);
  });
});

describe('addStitch', () => {
  test('the stitch lands in the active row and the active layer', () => {
    const pattern = { ...withSecondRow(base()), activeRowId: 'r2', activeLayerId: 'l2' };
    const { pattern: next, id } = stitch(pattern, { x: 5, y: 7 });
    const added = item(next, id);

    assert.equal(added.rowId, 'r2');
    assert.equal(added.layerId, 'l2');
    assert.equal(added.kind, 'stitch');
    assert.deepEqual([added.x, added.y, added.width, added.height], [5, 7, 20, 20]);
    assert.deepEqual([added.rotation, added.flipX, added.flipY, added.color], [0, false, false, null]);
  });

  test('the returned id names the new item and the original pattern is untouched', () => {
    const pattern = base();
    const { pattern: next, id } = stitch(pattern, { x: 1, y: 2 });

    assert.equal(next.items.length, 1);
    assert.equal(next.items[0].id, id);
    assert.deepEqual(pattern.items, [], 'the pattern given in keeps no stitch');
  });

  test('a new id never reuses one that is still alive after a deletion', () => {
    const three = place(base(), [{ x: 0 }, { x: 30 }, { x: 60 }]);
    assert.deepEqual(ids(three), ['i1', 'i2', 'i3']);

    const pruned = deleteItems(three, ['i2']);
    const { pattern: next, id } = stitch(pruned, { x: 90 });

    assert.ok(!ids(pruned).includes(id), `the new id ${id} collides with a live one`);
    assert.equal(id, 'i4');
    assert.deepEqual(ids(next), ['i1', 'i3', 'i4']);
  });
});

describe('updateItems and moveItems', () => {
  const three = () => place(base(), [{ x: 0 }, { x: 30 }, { x: 60 }]);

  test('several items take the patch at once and the rest stay as they were', () => {
    const pattern = three();
    const next = updateItems(pattern, ['i1', 'i3'], { color: '#c0392b', rotation: 45 });

    assert.deepEqual(
      next.items.map((candidate) => [candidate.color, candidate.rotation]),
      [
        ['#c0392b', 45],
        [null, 0],
        ['#c0392b', 45],
      ],
    );
    assert.deepEqual(
      pattern.items.map((candidate) => candidate.color),
      [null, null, null],
      'the pattern given in is untouched',
    );
  });

  test('moving shifts only the named items, and the source pattern keeps its places', () => {
    const pattern = three();
    const next = moveItems(pattern, ['i2'], 10, -5);

    assert.deepEqual(xs(next), [0, 40, 60]);
    assert.deepEqual(ys(next), [0, -5, 0]);
    assert.deepEqual(xs(pattern), [0, 30, 60]);
  });

  test('an empty id list and a move by nothing give back the same object', () => {
    const pattern = three();

    assert.equal(updateItems(pattern, [], { color: '#000000' }), pattern);
    assert.equal(moveItems(pattern, [], 10, 10), pattern);
    assert.equal(moveItems(pattern, ['i1', 'i2'], 0, 0), pattern);
  });
});

describe('rotateItems', () => {
  test('with no pivot only the turn changes', () => {
    const pattern = place(base(), [{ x: 30, y: 40 }]);
    const next = rotateItems(pattern, ['i1'], 90, null);
    const turned = item(next, 'i1');

    assert.equal(turned.rotation, 90);
    assert.deepEqual([turned.x, turned.y], [30, 40], 'the place stays where it was');
    assert.equal(item(pattern, 'i1').rotation, 0, 'the pattern given in is untouched');
  });

  test('with a pivot the place turns about it as well', () => {
    const pattern = place(base(), [
      { x: 10, y: 0 },
      { x: 40, y: 0 },
    ]);
    const next = rotateItems(pattern, ['i1'], 90, { x: 0, y: 0 });
    const turned = item(next, 'i1');

    // The y axis points down, so a quarter turn takes (10, 0) to (0, 10).
    near(turned.x, 0, 'x after a quarter turn about the origin');
    near(turned.y, 10, 'y after a quarter turn about the origin');
    assert.equal(turned.rotation, 90);
    assert.deepEqual([item(next, 'i2').x, item(next, 'i2').y], [40, 0], 'an item outside the selection stays put');
  });

  test('the turn stays between 0 and 360', () => {
    const pattern = place(base(), [{ x: 0 }]);

    assert.equal(item(rotateItems(pattern, ['i1'], -90, null), 'i1').rotation, 270);
    const full = rotateItems(rotateItems(pattern, ['i1'], 350, null), ['i1'], 20, null);
    assert.equal(item(full, 'i1').rotation, 10);

    assert.equal(normalizeAngle(-90), 270);
    assert.equal(normalizeAngle(370), 10);
    assert.equal(normalizeAngle(360), 0);
  });

  test('a turn of nothing, and a turn by nothing, give back the same object', () => {
    const pattern = place(base(), [{ x: 0 }]);

    assert.equal(rotateItems(pattern, ['i1'], 0, null), pattern);
    assert.equal(rotateItems(pattern, [], 90, null), pattern);
  });
});

describe('deleteItems', () => {
  test('only the named items go', () => {
    const pattern = place(base(), [{ x: 0 }, { x: 30 }, { x: 60 }]);
    const next = deleteItems(pattern, ['i1', 'i3']);

    assert.deepEqual(ids(next), ['i2']);
    assert.deepEqual(ids(pattern), ['i1', 'i2', 'i3'], 'the pattern given in keeps all three');
  });

  test('deleting nothing gives back the same object', () => {
    const pattern = place(base(), [{ x: 0 }]);

    assert.equal(deleteItems(pattern, []), pattern);
    assert.equal(deleteItems(pattern, ['i9']), pattern, 'an id that names nothing deletes nothing');
  });
});

describe('itemBox', () => {
  test('an upright item fills its width and height about its centre', () => {
    const pattern = place(base(), [{ x: 10, y: 20, width: 30, height: 12 }]);

    assert.deepEqual(itemBox(item(pattern, 'i1')), { minX: -5, minY: 14, maxX: 25, maxY: 26 });
  });

  test('a quarter turn swaps the extents', () => {
    const pattern = place(base(), [{ x: 0, y: 0, width: 30, height: 12 }]);
    const box = itemBox(item(updateItems(pattern, ['i1'], { rotation: 90 }), 'i1'));

    near(box.maxX - box.minX, 12, 'the turned width');
    near(box.maxY - box.minY, 30, 'the turned height');
  });

  test('a square turned by 45° grows by the square root of two', () => {
    const pattern = updateItems(place(base(), [{ x: 0, y: 0, width: 20, height: 20 }]), ['i1'], { rotation: 45 });
    const box = itemBox(item(pattern, 'i1'));

    near(box.maxX - box.minX, 20 * Math.SQRT2, 'the width of the diamond');
    near(box.maxY - box.minY, 20 * Math.SQRT2, 'the height of the diamond');
  });
});

describe('duplicateOffset and duplicateItems', () => {
  test('a single stitch is copied its own width plus ten to the right', () => {
    const pattern = place(base(), [{ x: 0, y: 0, width: 24 }]);

    assert.deepEqual(duplicateOffset(pattern.items), { x: 34, y: 0 });
  });

  test('a run of stitches is copied one whole run further along, keeping the rhythm', () => {
    // Three stitches 30 apart: the copies continue the same 30 spacing, not a wider gap.
    const pattern = place(base(), [{ x: 0 }, { x: 30 }, { x: 60 }]);
    const offset = duplicateOffset(pattern.items);

    assert.deepEqual(offset, { x: 90, y: 0 });

    const { pattern: next } = duplicateItems(pattern, ['i1', 'i2', 'i3'], offset);
    assert.deepEqual(xs(next), [0, 30, 60, 90, 120, 150]);
  });

  test('stitches stacked on one spot step by their width instead, so the copies do not land on them', () => {
    const pattern = place(base(), [
      { x: 0, y: 0, width: 24 },
      { x: 0, y: 40, width: 24 },
    ]);

    assert.deepEqual(duplicateOffset(pattern.items), { x: 34, y: 0 });
  });

  test('several stitches keep their arrangement, land to the right and take fresh ids', () => {
    const drawn = place(base(), [{ x: 0 }, { x: 30 }, { x: 60 }]);
    // The copy belongs to the row and layer it was made from, not to whatever is active now.
    const pattern = { ...withSecondRow(drawn), activeRowId: 'r2', activeLayerId: 'l2' };
    const offset = duplicateOffset(pattern.items);
    const { pattern: next, ids: made } = duplicateItems(pattern, ['i1', 'i2', 'i3'], offset);

    assert.equal(offset.y, 0);
    assert.deepEqual(made, ['i4', 'i5', 'i6']);
    assert.deepEqual(xs(next).slice(0, 3), [0, 30, 60], 'the source stitches do not move');
    assert.deepEqual(
      xs(next).slice(3),
      [offset.x, offset.x + 30, offset.x + 60],
      'the copies keep the spacing of the originals',
    );
    assert.ok(offset.x > 60, 'the copy lands to the right of the selection');
    assert.deepEqual(
      next.items.slice(3).map((candidate) => [candidate.rowId, candidate.layerId]),
      [
        ['r1', 'l1'],
        ['r1', 'l1'],
        ['r1', 'l1'],
      ],
    );
  });

  test('duplicating nothing gives back the same object', () => {
    const pattern = place(base(), [{ x: 0 }]);
    const { pattern: next, ids: made } = duplicateItems(pattern, [], { x: 10, y: 0 });

    assert.equal(next, pattern);
    assert.deepEqual(made, []);
  });
});

describe('pasteItems', () => {
  test('pasted stitches join the active row and layer and take fresh ids', () => {
    const drawn = place(base(), [{ x: 0 }]);
    const pattern = { ...withSecondRow(drawn), activeRowId: 'r2', activeLayerId: 'l2' };
    const carried = [
      { ...item(drawn, 'i1'), id: 'i1', rowId: 'r1', layerId: 'l1', x: 100, y: 100 },
      { ...item(drawn, 'i1'), id: 'i2', rowId: 'r1', layerId: 'l1', x: 130, y: 100 },
    ];
    const { pattern: next, ids: made } = pasteItems(pattern, carried, { x: 5, y: -5 });

    assert.deepEqual(made, ['i2', 'i3']);
    assert.deepEqual(
      next.items.slice(1).map((candidate) => [candidate.id, candidate.rowId, candidate.layerId]),
      [
        ['i2', 'r2', 'l2'],
        ['i3', 'r2', 'l2'],
      ],
    );
    assert.deepEqual(xs(next), [0, 105, 135]);
    assert.deepEqual(ys(next), [0, 95, 95]);
    assert.equal(pasteItems(pattern, [], { x: 5, y: 5 }).pattern, pattern, 'pasting nothing changes nothing');
  });
});

describe('flipItems', () => {
  test('mirroring left to right turns the arrangement over and each stitch with it', () => {
    const pattern = place(base(), [
      { x: 0, y: 10 },
      { x: 100, y: 40 },
    ]);
    const next = flipItems(pattern, ['i1', 'i2'], 'horizontal');

    assert.deepEqual(xs(next), [100, 0], 'the two stitches swap sides about the centre of the selection');
    assert.deepEqual(ys(next), [10, 40], 'mirroring left to right leaves the heights alone');
    assert.deepEqual(
      next.items.map((candidate) => candidate.flipX),
      [true, true],
    );
    assert.deepEqual(xs(pattern), [0, 100], 'the pattern given in is untouched');
  });

  test('mirroring left to right mirrors the turn of each stitch', () => {
    const pattern = updateItems(place(base(), [{ x: 20, y: 10 }]), ['i1'], { rotation: 30 });
    const next = flipItems(pattern, ['i1'], 'horizontal');
    const only = item(next, 'i1');

    assert.equal(only.rotation, 330, 'a stitch turned by 30° comes back at 330°');
    assert.equal(only.flipX, true);
    assert.equal(only.x, 20, 'a lone stitch is mirrored about its own centre, so it stays put');
  });

  test('mirroring top to bottom does the same on the other axis', () => {
    const pattern = place(base(), [
      { x: 10, y: 0 },
      { x: 40, y: 60 },
    ]);
    const next = flipItems(pattern, ['i1', 'i2'], 'vertical');

    assert.deepEqual(ys(next), [60, 0], 'the two stitches swap places about the centre of the selection');
    assert.deepEqual(xs(next), [10, 40], 'mirroring top to bottom leaves the places across alone');
    assert.deepEqual(
      next.items.map((candidate) => candidate.flipY),
      [true, true],
    );
  });

  test('mirroring top to bottom mirrors the turn, it does not add half a turn', () => {
    const drawn = place(base(), [
      { x: 0, y: 0 },
      { x: 0, y: 60 },
    ]);
    const pattern = updateItems(drawn, ['i2'], { rotation: 30 });
    const next = flipItems(pattern, ['i1', 'i2'], 'vertical');

    // A mirror about a horizontal axis is `flipY` with the turn negated; 180 − turn
    // belongs to the other reading of the same mirror, the one that sets `flipX`.
    assert.equal(item(next, 'i1').rotation, 0, 'an upright stitch stays upright');
    assert.equal(item(next, 'i2').rotation, 330, 'a stitch turned by 30° comes back at 330°');
  });

  test('mirroring nothing gives back the same object', () => {
    const pattern = place(base(), [{ x: 0 }]);

    assert.equal(flipItems(pattern, [], 'horizontal'), pattern);
  });
});

describe('alignItems', () => {
  /** Three stitches of different widths, so edges and centres cannot be confused. */
  const three = () =>
    place(base(), [
      { x: 0, y: 0, width: 20, height: 10 },
      { x: 50, y: 30, width: 40, height: 10 },
      { x: 100, y: 60, width: 20, height: 10 },
    ]);

  test('left, centre and right line the stitches up across', () => {
    const pattern = three();

    assert.deepEqual(xs(alignItems(pattern, ids(pattern), 'left')), [0, 10, 0], 'the left edges meet');
    assert.deepEqual(xs(alignItems(pattern, ids(pattern), 'center')), [50, 50, 50], 'the centres meet');
    assert.deepEqual(xs(alignItems(pattern, ids(pattern), 'right')), [100, 90, 100], 'the right edges meet');
    assert.deepEqual(ys(alignItems(pattern, ids(pattern), 'left')), [0, 30, 60], 'lining up across leaves the heights');
  });

  test('top, middle and bottom line the stitches up down the chart', () => {
    const pattern = three();

    assert.deepEqual(ys(alignItems(pattern, ids(pattern), 'top')), [0, 0, 0], 'the top edges meet');
    assert.deepEqual(ys(alignItems(pattern, ids(pattern), 'middle')), [30, 30, 30], 'the middles meet');
    assert.deepEqual(ys(alignItems(pattern, ids(pattern), 'bottom')), [60, 60, 60], 'the bottom edges meet');
    assert.deepEqual(
      xs(alignItems(pattern, ids(pattern), 'top')),
      [0, 50, 100],
      'lining up downwards leaves the places across',
    );
  });

  test('fewer than two stitches leave the pattern as it is', () => {
    const pattern = three();

    assert.equal(alignItems(pattern, ['i1'], 'left'), pattern);
    assert.equal(alignItems(pattern, [], 'left'), pattern);
  });
});

describe('distributeItems', () => {
  test('five unevenly spaced stitches spread evenly between the outer two', () => {
    const pattern = place(base(), [{ x: 0 }, { x: 5 }, { x: 40 }, { x: 42 }, { x: 100 }]);
    const next = distributeItems(pattern, ids(pattern), 'horizontal');

    assert.deepEqual(xs(next), [0, 25, 50, 75, 100]);
    assert.deepEqual([xs(next)[0], xs(next)[4]], [0, 100], 'the outer two do not move');
    assert.deepEqual(xs(pattern), [0, 5, 40, 42, 100], 'the pattern given in is untouched');
  });

  test('spreading downwards works the same way', () => {
    const pattern = place(base(), [{ y: 0 }, { y: 70 }, { y: 80 }]);
    const next = distributeItems(pattern, ids(pattern), 'vertical');

    assert.deepEqual(ys(next), [0, 40, 80]);
  });

  test('fewer than three stitches leave the pattern as it is', () => {
    const pattern = place(base(), [{ x: 0 }, { x: 100 }]);

    assert.equal(distributeItems(pattern, ids(pattern), 'horizontal'), pattern);
    assert.equal(distributeItems(pattern, [], 'horizontal'), pattern);
  });
});

describe('rowCount and stitchCount', () => {
  test('every placed symbol counts as one', () => {
    const first = place(base(), [{ x: 0 }, { x: 30 }]);
    const pattern = place({ ...withSecondRow(first), activeRowId: 'r2' }, [
      { x: 0, y: 40 },
      { x: 30, y: 40 },
      { x: 60, y: 40 },
    ]);

    assert.equal(rowCount(pattern, 'r1'), 2);
    assert.equal(rowCount(pattern, 'r2'), 3);
    assert.equal(rowCount(pattern, 'r9'), 0, 'a row that does not exist holds nothing');
    assert.equal(stitchCount(pattern), 5);
    assert.equal(stitchCount(base()), 0);
  });
});

describe('isSelectable and isVisible', () => {
  const drawn = () => place(base(), [{ x: 0 }]);

  test('a hidden row takes its stitches out of sight and out of reach', () => {
    const pattern = withRow(drawn(), 'r1', { visible: false });
    const only = item(pattern, 'i1');

    assert.equal(isVisible(pattern, only), false);
    assert.equal(isSelectable(pattern, only), false);
  });

  test('a locked row keeps its stitches in sight but out of reach', () => {
    const pattern = withRow(drawn(), 'r1', { locked: true });
    const only = item(pattern, 'i1');

    assert.equal(isVisible(pattern, only), true);
    assert.equal(isSelectable(pattern, only), false);
  });

  test('a hidden layer takes its stitches out of sight and out of reach', () => {
    const pattern = withLayer(drawn(), 'l1', { visible: false });
    const only = item(pattern, 'i1');

    assert.equal(isVisible(pattern, only), false);
    assert.equal(isSelectable(pattern, only), false);
  });

  test('a locked layer keeps its stitches in sight but out of reach', () => {
    const pattern = withLayer(drawn(), 'l1', { locked: true });
    const only = item(pattern, 'i1');

    assert.equal(isVisible(pattern, only), true);
    assert.equal(isSelectable(pattern, only), false);
  });

  test('on an open row and an open layer a stitch is both visible and selectable', () => {
    const pattern = drawn();
    const only = item(pattern, 'i1');

    assert.equal(isVisible(pattern, only), true);
    assert.equal(isSelectable(pattern, only), true);
  });
});

describe('setTitle', () => {
  test('the same title gives back the same object', () => {
    const pattern = base();

    assert.equal(setTitle(pattern, 'Free-form chart'), pattern);
  });

  test('a title from the crocheter is no longer a generated one', () => {
    const pattern = { ...base(), titleGenerated: true };
    const next = setTitle(pattern, 'Shell shawl');

    assert.equal(next.title, 'Shell shawl');
    assert.equal(Object.hasOwn(next, 'titleGenerated'), false, 'the generated mark is gone, not merely false');
    assert.equal(pattern.titleGenerated, true, 'the pattern given in is untouched');
  });
});
