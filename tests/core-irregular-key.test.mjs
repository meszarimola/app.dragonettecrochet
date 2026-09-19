/*
 * The pattern's own stitch key: an entry exists only when it says something the
 * library does not, so a pattern that accepts the preset carries no key at all.
 * Every operation is pure — a no-op gives back the very same object so the
 * editor records no undo step.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { addStitch, emptyIrregularPattern } from '../src/core/irregular-document.ts';
import {
  addCustomEntry,
  entryAbbreviation,
  entryGlyph,
  entryLabel,
  entryName,
  findStitch,
  hasOverrides,
  isCustom,
  keyEntries,
  keyEntry,
  keyUsage,
  removeCustomEntry,
  resetToPreset,
  sharedGlyphs,
  updateKeyEntry,
} from '../src/core/irregular-key.ts';
import { stitchById } from '../src/core/stitches.ts';

const base = () => emptyIrregularPattern({ title: 'Free-form chart', layerNames: ['Drawing', 'Labels'] });

/** One stitch drawn from each of the given key entries, laid out in a row. */
const place = (pattern, keyEntryIds) =>
  keyEntryIds.reduce(
    (current, keyEntryId, index) =>
      addStitch(current, { keyEntryId, insertion: 'both-loops', x: index * 30, y: 0, width: 20, height: 20 }).pattern,
    pattern,
  );

/** The entry, with a clear failure when the key does not hold it at all. */
const entryOf = (pattern, id) => {
  const found = keyEntry(pattern, id);
  assert.ok(found !== undefined, `the key has no entry ${id}`);
  return found;
};

const entryIds = (pattern) => keyEntries(pattern).map((entry) => entry.id);
const usage = (pattern) => keyUsage(pattern).map((line) => [line.keyEntryId, line.count]);
const drawnFrom = (pattern) => pattern.items.map((item) => item.keyEntryId);

const allRowsHidden = (pattern) => ({
  ...pattern,
  rows: pattern.rows.map((row) => ({ ...row, visible: false })),
});

describe('findStitch', () => {
  test('a library id gives its definition and an unknown id gives nothing back instead of throwing', () => {
    assert.equal(findStitch('sc')?.id, 'sc');
    assert.equal(findStitch('magic-ring')?.kind, 'ring');
    assert.equal(findStitch('no-such-stitch'), undefined);

    // A key entry may name a stitch this build does not have, and `stitchById`
    // throws on one — which is the whole reason `findStitch` exists.
    assert.throws(() => stitchById('no-such-stitch'));
  });
});

describe('keyEntries, keyEntry and isCustom', () => {
  test('a pattern happy with the preset carries no key at all', () => {
    const pattern = base();

    assert.equal(pattern.stitchKey, undefined);
    assert.deepEqual(keyEntries(pattern), []);
    assert.equal(keyEntry(pattern, 'sc'), undefined);
    assert.equal(keyEntry(pattern, 'no-such-stitch'), undefined);
  });

  test('an entry standing for a library stitch is not custom, an entry of her own is', () => {
    const library = updateKeyEntry(base(), 'sc', { glyphOverride: '✚' });
    assert.equal(isCustom(entryOf(library, 'sc')), false);

    const { pattern: own, id } = addCustomEntry(base(), 'Twisted puff', '✳');
    assert.equal(isCustom(entryOf(own, id)), true);
  });
});

describe('hasOverrides', () => {
  test('a bare pattern says nothing the library does not', () => {
    assert.equal(hasOverrides(base()), false);
  });

  test('a glyph override and an entry of her own both make the key her own', () => {
    assert.equal(hasOverrides(updateKeyEntry(base(), 'sc', { glyphOverride: '✚' })), true);
    assert.equal(hasOverrides(addCustomEntry(base(), 'Twisted puff', '✳').pattern), true);
    assert.equal(
      hasOverrides(updateKeyEntry(base(), 'twisted-puff', { customName: 'Twisted puff' })),
      true,
      'an entry with no override at all is still one of her own',
    );
  });
});

describe('updateKeyEntry', () => {
  test('an override for a library stitch makes an entry that still stands for it', () => {
    const pattern = base();
    const next = updateKeyEntry(pattern, 'sc', { glyphOverride: '✚' });
    const entry = entryOf(next, 'sc');

    assert.deepEqual(entryIds(next), ['sc']);
    assert.equal(entry.stitch, 'sc');
    assert.equal(entry.glyphOverride, '✚');
    assert.deepEqual([entry.customName, entry.abbreviationOverride, entry.labelOverride], [null, null, null]);
    assert.equal(isCustom(entry), false);
    assert.equal(entryGlyph(next, 'sc'), '✚');
    assert.equal(entryGlyph(pattern, 'sc'), null, 'without an entry the glyph is left to the library');
    assert.equal(pattern.stitchKey, undefined, 'the pattern given in is untouched');
  });

  test('changing an override replaces it instead of adding a second entry', () => {
    const first = updateKeyEntry(base(), 'sc', { glyphOverride: '✚' });
    const next = updateKeyEntry(first, 'sc', { glyphOverride: '✖' });

    assert.deepEqual(entryIds(next), ['sc']);
    assert.equal(entryOf(next, 'sc').glyphOverride, '✖');
    assert.equal(entryOf(first, 'sc').glyphOverride, '✚', 'the pattern given in is untouched');
  });

  test('clearing the last override drops the entry, so the file stays quiet', () => {
    const pattern = updateKeyEntry(base(), 'sc', { glyphOverride: '✚' });
    const cleared = updateKeyEntry(pattern, 'sc', { glyphOverride: null });

    assert.deepEqual(keyEntries(cleared), []);
    assert.equal(keyEntry(cleared, 'sc'), undefined);
    assert.equal(hasOverrides(cleared), false);
  });

  test('clearing one of two overrides keeps the entry for the other', () => {
    const both = updateKeyEntry(updateKeyEntry(base(), 'sc', { glyphOverride: '✚' }), 'sc', {
      labelOverride: 'Tight single crochet',
    });
    const one = updateKeyEntry(both, 'sc', { glyphOverride: null });

    assert.deepEqual(entryIds(one), ['sc']);
    assert.equal(entryOf(one, 'sc').labelOverride, 'Tight single crochet');
    assert.equal(entryOf(one, 'sc').glyphOverride, null);
  });

  test('a patch that changes nothing, and an empty patch, give back the same object', () => {
    const pattern = updateKeyEntry(base(), 'sc', { glyphOverride: '✚' });

    assert.equal(updateKeyEntry(pattern, 'sc', { glyphOverride: '✚' }), pattern);
    assert.equal(updateKeyEntry(pattern, 'sc', {}), pattern);
  });

  test('clearing an override that was never there gives back the same object', () => {
    const bare = base();
    assert.equal(updateKeyEntry(bare, 'sc', { glyphOverride: null }), bare, 'there is no key to write to');

    const pattern = updateKeyEntry(bare, 'sc', { glyphOverride: '✚' });
    assert.equal(
      updateKeyEntry(pattern, 'dc', { glyphOverride: null }),
      pattern,
      'another stitch has no override to clear, so the key is left exactly as it was',
    );

    const cleared = updateKeyEntry(pattern, 'sc', { glyphOverride: null });
    assert.equal(updateKeyEntry(cleared, 'dc', { glyphOverride: null }), cleared, 'an emptied key is left alone too');
  });

  test('an override on an id the library does not know is one of her own', () => {
    const next = updateKeyEntry(base(), 'twisted-puff', { glyphOverride: '✳' });
    const entry = entryOf(next, 'twisted-puff');

    assert.equal(entry.stitch, null);
    assert.equal(isCustom(entry), true);
    assert.equal(hasOverrides(next), true);
  });
});

describe('addCustomEntry', () => {
  test('the entry is marked as her own and carries her name and glyph', () => {
    const pattern = base();
    const { pattern: next, id } = addCustomEntry(pattern, 'Twisted puff', '✳');
    const entry = entryOf(next, id);

    assert.equal(id, 'k1');
    assert.equal(entry.stitch, null);
    assert.equal(isCustom(entry), true);
    assert.deepEqual([entry.customName, entry.glyphOverride], ['Twisted puff', '✳']);
    assert.deepEqual([entry.abbreviationOverride, entry.labelOverride], [null, null]);
    assert.equal(pattern.stitchKey, undefined, 'the pattern given in is untouched');
  });

  test('every entry takes a fresh id, and a library entry does not take a k number', () => {
    const library = updateKeyEntry(base(), 'sc', { glyphOverride: '✚' });
    const first = addCustomEntry(library, 'Twisted puff', '✳');
    const second = addCustomEntry(first.pattern, 'Corded edge', '◆');

    assert.deepEqual([first.id, second.id], ['k1', 'k2']);
    assert.deepEqual(entryIds(second.pattern), ['sc', 'k1', 'k2']);

    const pruned = removeCustomEntry(second.pattern, 'k1');
    const third = addCustomEntry(pruned, 'Crab stitch edge', '●');
    assert.ok(!entryIds(pruned).includes(third.id), `the new id ${third.id} collides with a live one`);
    assert.equal(third.id, 'k3');
  });
});

describe('removeCustomEntry', () => {
  test('the entry goes and takes every stitch drawn from it with it', () => {
    const { pattern: own, id } = addCustomEntry(base(), 'Twisted puff', '✳');
    const pattern = place(own, ['sc', id, 'dc', id]);
    const next = removeCustomEntry(pattern, id);

    assert.deepEqual(entryIds(next), []);
    assert.deepEqual(drawnFrom(next), ['sc', 'dc']);
    assert.deepEqual(drawnFrom(pattern), ['sc', id, 'dc', id], 'the pattern given in is untouched');
  });

  test('a library entry and an unknown id give back the same object', () => {
    const library = updateKeyEntry(base(), 'sc', { glyphOverride: '✚' });

    assert.equal(removeCustomEntry(library, 'sc'), library, 'a library stitch is not hers to remove');
    assert.equal(removeCustomEntry(library, 'k9'), library);

    const bare = base();
    assert.equal(removeCustomEntry(bare, 'k1'), bare);
  });
});

describe('resetToPreset', () => {
  test('the library overrides go and her own entries stay', () => {
    const { pattern: own, id } = addCustomEntry(base(), 'Twisted puff', '✳');
    const overridden = updateKeyEntry(updateKeyEntry(own, 'sc', { glyphOverride: '✚' }), 'dc', {
      labelOverride: 'The tall one',
    });
    const pattern = place(overridden, ['sc', id]);
    const next = resetToPreset(pattern);

    assert.deepEqual(entryIds(next), [id]);
    assert.equal(entryOf(next, id).customName, 'Twisted puff');
    assert.equal(hasOverrides(next), true, 'her own entries still depart from the preset');
    assert.deepEqual(drawnFrom(next), ['sc', id], 'resetting the key does not touch what is drawn');
    assert.deepEqual(entryIds(pattern), [id, 'sc', 'dc'], 'the pattern given in is untouched');
  });

  test('a pattern with nothing to reset gives back the same object', () => {
    const bare = base();
    assert.equal(resetToPreset(bare), bare);

    const own = addCustomEntry(bare, 'Twisted puff', '✳').pattern;
    assert.equal(resetToPreset(own), own, 'a key of her own entries alone holds no override to drop');
  });
});

describe('entryName, entryLabel and entryAbbreviation', () => {
  test('without an entry the library text for the locale is used', () => {
    const pattern = base();

    assert.equal(entryName(pattern, 'sc', 'hu'), 'rövidpálca (rp)');
    assert.equal(entryName(pattern, 'sc', 'en-US'), 'single crochet (sc)');
    assert.equal(entryLabel(pattern, 'inc-2dc', 'hu'), 'szaporítás: 2 erp egy szembe');
    assert.equal(entryLabel(pattern, 'inc-2dc', 'en-US'), 'increase (inc): 2 dc in same st');
    assert.equal(entryLabel(pattern, 'sc', 'en-US'), 'single crochet (sc)', 'a basic stitch has no structure to add');
    assert.deepEqual([entryAbbreviation(pattern, 'sc', 'hu'), entryAbbreviation(pattern, 'sc', 'en-US')], ['rp', 'sc']);
    assert.equal(entryAbbreviation(pattern, 'dtr', 'hu'), null, 'not every stitch has a Hungarian abbreviation');
  });

  test('an override wins over everything else', () => {
    const pattern = updateKeyEntry(base(), 'sc', {
      customName: 'Tight single crochet',
      labelOverride: 'Tight sc: into the back loop',
      abbreviationOverride: 'tsc',
    });

    assert.equal(entryName(pattern, 'sc', 'hu'), 'Tight single crochet');
    assert.equal(entryLabel(pattern, 'sc', 'hu'), 'Tight sc: into the back loop');
    assert.equal(entryAbbreviation(pattern, 'sc', 'hu'), 'tsc');
    assert.equal(entryLabel(pattern, 'sc', 'en-US'), 'Tight sc: into the back loop', 'an override is not translated');
  });

  test('a name of her own stands in for the label, but leaves the abbreviation to the library', () => {
    const pattern = updateKeyEntry(base(), 'sc', { customName: 'Tight single crochet', glyphOverride: '✚' });

    assert.equal(entryName(pattern, 'sc', 'en-US'), 'Tight single crochet');
    assert.equal(entryLabel(pattern, 'sc', 'en-US'), 'Tight single crochet', 'with no label of her own the name does');
    assert.equal(entryAbbreviation(pattern, 'sc', 'en-US'), 'sc');
    assert.equal(entryName(pattern, 'sc', 'hu'), 'Tight single crochet', 'a name of her own is not translated');
  });

  test('an entry of her own is known by her name alone', () => {
    const { pattern, id } = addCustomEntry(base(), 'Twisted puff', '✳');

    assert.equal(entryName(pattern, id, 'hu'), 'Twisted puff');
    assert.equal(entryLabel(pattern, id, 'en-US'), 'Twisted puff');
    assert.equal(entryAbbreviation(pattern, id, 'en-US'), null, 'she gave no abbreviation');
  });

  test('an id nothing knows falls back to the id itself instead of throwing', () => {
    const pattern = base();

    assert.equal(entryName(pattern, 'no-such-stitch', 'hu'), 'no-such-stitch');
    assert.equal(entryLabel(pattern, 'no-such-stitch', 'en-US'), 'no-such-stitch');
    assert.equal(entryAbbreviation(pattern, 'no-such-stitch', 'hu'), null, 'there is no abbreviation to fall back on');
  });
});

describe('keyUsage', () => {
  test('every placed stitch counts, and the entries come in palette order', () => {
    // The palette lists ch before sc and sc before dc; magic-ring comes last of all.
    const pattern = place(base(), ['magic-ring', 'dc', 'sc', 'ch', 'sc']);

    assert.deepEqual(usage(pattern), [
      ['ch', 1],
      ['sc', 2],
      ['dc', 1],
      ['magic-ring', 1],
    ]);
    assert.deepEqual(keyUsage(base()), [], 'nothing drawn, nothing listed');
  });

  test('her own entries come last, in the order they were first drawn', () => {
    const first = addCustomEntry(base(), 'Twisted puff', '✳');
    const second = addCustomEntry(first.pattern, 'Corded edge', '◆');
    const pattern = place(second.pattern, [second.id, 'dc', first.id, second.id]);

    assert.deepEqual(usage(pattern), [
      ['dc', 1],
      [second.id, 2],
      [first.id, 1],
    ]);
  });

  test('stitches on a hidden row count too, so hiding a row never shortens the legend', () => {
    const pattern = place(base(), ['sc', 'sc', 'dc']);

    assert.deepEqual(
      usage(allRowsHidden(pattern)),
      [
        ['sc', 2],
        ['dc', 1],
      ],
      'the legend still lists both',
    );
    assert.deepEqual(usage(allRowsHidden(pattern)), usage(pattern));
  });
});

describe('sharedGlyphs', () => {
  const glyphResolver = (glyphs) => (keyEntryId) => glyphs[keyEntryId] ?? '?';

  test('two entries drawn with one glyph are reported together', () => {
    const { pattern: own, id } = addCustomEntry(base(), 'Twisted puff', '✳');
    const pattern = place(own, ['sc', 'dc', id, 'dc']);
    const shared = sharedGlyphs(pattern, glyphResolver({ sc: '✕', dc: '✳', [id]: '✳' }));

    assert.deepEqual(shared, [{ glyph: '✳', keyEntryIds: ['dc', id] }]);
  });

  test('distinct glyphs leave nothing to report', () => {
    const pattern = place(base(), ['sc', 'dc', 'ch']);

    assert.deepEqual(sharedGlyphs(pattern, glyphResolver({ sc: '✕', dc: '✳', ch: '○' })), []);
    assert.deepEqual(sharedGlyphs(base(), glyphResolver({})), [], 'nothing drawn, nothing ambiguous');
  });
});
