/*
 * Layers of the free-form drawing: the list order is the z-order, bottom first,
 * and every operation is pure — a no-op gives back the very same object so the
 * editor can tell that nothing happened and records no undo step.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { addStitch, emptyIrregularPattern } from '../src/core/irregular-document.ts';
import {
  addLayer,
  deleteLayer,
  itemsOfLayer,
  layerIndex,
  moveItemsToLayer,
  reorderLayers,
  setActiveLayer,
  updateLayer,
} from '../src/core/irregular-layers.ts';

const base = () => emptyIrregularPattern({ title: 'Free-form chart', layerNames: ['Drawing', 'Labels'] });

/** One stitch in the active layer, with defaults the spec fields override. */
const stitch = (pattern, spec) =>
  addStitch(pattern, { keyEntryId: 'sc', insertion: 'both-loops', x: 0, y: 0, width: 20, height: 20, ...spec }).pattern;

const place = (pattern, count) =>
  Array.from({ length: count }).reduce((current, _unused, index) => stitch(current, { x: index * 30 }), pattern);

const ids = (pattern) => pattern.layers.map((candidate) => candidate.id);
const names = (pattern) => pattern.layers.map((candidate) => candidate.name);
const itemIds = (pattern) => pattern.items.map((item) => item.id);

/** The layer, with a clear failure when the list does not hold it at all. */
const layer = (pattern, id) => {
  const found = pattern.layers.find((candidate) => candidate.id === id);
  assert.ok(found !== undefined, `the pattern has no layer ${id}`);
  return found;
};

/** Three layers, bottom first: l1 "Drawing", l2 "Labels", l3 "Notes". */
const three = () => addLayer(base(), 'Notes').pattern;

/** Two stitches on l1 and one on l2, so it is plain where they end up. */
const drawn = () => place({ ...place(base(), 2), activeLayerId: 'l2' }, 1);

describe('layerIndex and itemsOfLayer', () => {
  test('the index is the place in the list, bottom first, and an unknown layer has none', () => {
    const pattern = three();

    assert.deepEqual(ids(pattern), ['l1', 'l2', 'l3']);
    assert.deepEqual(
      ids(pattern).map((id) => layerIndex(pattern, id)),
      [0, 1, 2],
    );
    assert.equal(layerIndex(pattern, 'l9'), -1, 'a layer that does not exist has no place');
  });

  test('a layer counts the stitches drawn on it', () => {
    const pattern = drawn();

    assert.equal(itemsOfLayer(pattern, 'l1'), 2);
    assert.equal(itemsOfLayer(pattern, 'l2'), 1);
    assert.equal(itemsOfLayer(pattern, 'l9'), 0, 'a layer that does not exist holds nothing');
    assert.equal(itemsOfLayer(base(), 'l1'), 0);
  });
});

describe('addLayer', () => {
  test('the new layer goes on top, visible and unlocked, and the pattern given in is untouched', () => {
    const pattern = base();
    const { pattern: next, id } = addLayer(pattern, 'Notes');
    const added = layer(next, id);

    assert.equal(id, 'l3');
    assert.deepEqual(names(next), ['Drawing', 'Labels', 'Notes'], 'the last layer is the topmost one');
    assert.deepEqual([added.name, added.visible, added.locked], ['Notes', true, false]);
    assert.equal(next.activeLayerId, 'l1', 'a new layer does not take the active place');
    assert.deepEqual(ids(pattern), ['l1', 'l2'], 'the pattern given in keeps its two layers');
  });

  test('the new id never reuses one that is still alive after a deletion', () => {
    const pruned = deleteLayer(three(), 'l2');
    const { pattern: next, id } = addLayer(pruned, 'Charts');

    assert.deepEqual(ids(pruned), ['l1', 'l3']);
    assert.ok(!ids(pruned).includes(id), `the new id ${id} collides with a live one`);
    assert.equal(id, 'l4');
    assert.deepEqual(ids(next), ['l1', 'l3', 'l4']);
  });
});

describe('updateLayer', () => {
  test('only the named layer takes the patch', () => {
    const pattern = three();
    const next = updateLayer(pattern, 'l2', { name: 'Notes to self', visible: false, locked: true });
    const changed = layer(next, 'l2');

    assert.deepEqual([changed.name, changed.visible, changed.locked], ['Notes to self', false, true]);
    assert.equal(changed.id, 'l2', 'the rest is left alone');
    assert.deepEqual([layer(next, 'l1').visible, layer(next, 'l3').visible], [true, true]);
    assert.equal(layer(pattern, 'l2').name, 'Labels', 'the pattern given in is untouched');
  });

  test('a layer can be hidden and locked one field at a time', () => {
    const hidden = updateLayer(three(), 'l3', { visible: false });
    assert.deepEqual([layer(hidden, 'l3').visible, layer(hidden, 'l3').locked], [false, false]);

    const locked = updateLayer(hidden, 'l3', { locked: true });
    assert.deepEqual([layer(locked, 'l3').visible, layer(locked, 'l3').locked], [false, true]);
  });

  test('a patch that changes nothing, an empty patch and an unknown layer give back the same object', () => {
    const pattern = three();

    assert.equal(updateLayer(pattern, 'l2', { name: 'Labels', visible: true, locked: false }), pattern);
    assert.equal(updateLayer(pattern, 'l2', {}), pattern);
    assert.equal(updateLayer(pattern, 'l9', { locked: true }), pattern);
  });
});

describe('setActiveLayer', () => {
  test('the named layer becomes the active one', () => {
    const pattern = three();

    assert.equal(setActiveLayer(pattern, 'l3').activeLayerId, 'l3');
    assert.equal(pattern.activeLayerId, 'l1', 'the pattern given in is untouched');
  });

  test('the layer already active, and a layer that does not exist, give back the same object', () => {
    const pattern = three();

    assert.equal(setActiveLayer(pattern, 'l1'), pattern);
    assert.equal(setActiveLayer(pattern, 'l9'), pattern, 'the active layer always names a layer that exists');
  });
});

describe('deleteLayer', () => {
  test('the layer goes and takes its stitches with it', () => {
    const pattern = drawn();
    const next = deleteLayer(pattern, 'l1');

    assert.deepEqual(ids(next), ['l2']);
    assert.deepEqual(itemIds(next), ['i3'], 'the two stitches of l1 are gone');
    assert.deepEqual(ids(pattern), ['l1', 'l2'], 'the pattern given in is untouched');
    assert.equal(pattern.items.length, 3);
  });

  test('deleting the active layer hands the active place to the layer below it', () => {
    const pattern = setActiveLayer(three(), 'l3');

    assert.equal(deleteLayer(pattern, 'l3').activeLayerId, 'l2');
    assert.equal(deleteLayer(pattern, 'l2').activeLayerId, 'l3', 'a layer that was not active leaves it alone');
  });

  test('deleting the bottom layer while it is active hands the active place to the new bottom one', () => {
    const pattern = setActiveLayer(three(), 'l1');
    const next = deleteLayer(pattern, 'l1');

    assert.deepEqual(ids(next), ['l2', 'l3']);
    assert.equal(next.activeLayerId, 'l2', 'the bottom layer has no layer below it');
  });

  test('the only remaining layer cannot be deleted, and an unknown layer deletes nothing', () => {
    const pattern = three();
    assert.equal(deleteLayer(pattern, 'l9'), pattern);

    const only = deleteLayer(deleteLayer(pattern, 'l3'), 'l2');
    assert.deepEqual(ids(only), ['l1']);
    assert.equal(deleteLayer(only, 'l1'), only, 'there is always exactly one active layer, so one layer must remain');
  });
});

describe('reorderLayers', () => {
  test('moving a layer changes the z-order and nothing else', () => {
    const pattern = three();
    const next = reorderLayers(pattern, 'l3', 0);

    assert.deepEqual(ids(next), ['l3', 'l1', 'l2']);
    assert.deepEqual(names(next), ['Notes', 'Drawing', 'Labels'], 'the topmost layer is now drawn at the bottom');
    assert.equal(layerIndex(next, 'l3'), 0);
    assert.deepEqual(ids(pattern), ['l1', 'l2', 'l3'], 'the pattern given in keeps its order');
  });

  test('a place past the ends is pulled back into range', () => {
    const pattern = three();

    assert.deepEqual(ids(reorderLayers(pattern, 'l1', 9)), ['l2', 'l3', 'l1']);
    assert.deepEqual(ids(reorderLayers(pattern, 'l3', -4)), ['l3', 'l1', 'l2']);
  });

  test('a layer already in that place, and an unknown layer, give back the same object', () => {
    const pattern = three();

    assert.equal(reorderLayers(pattern, 'l2', 1), pattern);
    assert.equal(reorderLayers(pattern, 'l3', 5), pattern, 'clamping lands on the place it already holds');
    assert.equal(reorderLayers(pattern, 'l9', 0), pattern);
  });

  test('the stitches stay with their layers', () => {
    const next = reorderLayers(drawn(), 'l2', 0);

    assert.deepEqual(ids(next), ['l2', 'l1']);
    assert.equal(itemsOfLayer(next, 'l1'), 2);
    assert.equal(itemsOfLayer(next, 'l2'), 1, 'only the z-order changed');
  });
});

describe('moveItemsToLayer', () => {
  test('the named stitches join the layer, the others stay where they are', () => {
    const pattern = drawn();
    const next = moveItemsToLayer(pattern, ['i1'], 'l2');

    assert.deepEqual(
      next.items.map((item) => [item.id, item.layerId]),
      [
        ['i1', 'l2'],
        ['i2', 'l1'],
        ['i3', 'l2'],
      ],
    );
    assert.equal(itemsOfLayer(pattern, 'l1'), 2, 'the pattern given in is untouched');
  });

  test('nothing to move, a layer that does not exist, and stitches already there give back the same object', () => {
    const pattern = drawn();

    assert.equal(moveItemsToLayer(pattern, [], 'l2'), pattern);
    assert.equal(moveItemsToLayer(pattern, ['i1'], 'l9'), pattern);
    assert.equal(moveItemsToLayer(pattern, ['i3'], 'l2'), pattern, 'the stitch is on that layer already');
    assert.equal(moveItemsToLayer(pattern, ['i9'], 'l2'), pattern, 'an id that names nothing moves nothing');
  });
});
