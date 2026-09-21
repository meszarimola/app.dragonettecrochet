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
  entryGlyph,
  entryName,
  findStitch,
  isCustom,
  keyEntries,
  keyEntry,
  keyUsage,
  sharedGlyphs,
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

/** A key entry for a library stitch with its own symbol, as an older file may carry. */
const withGlyph = (pattern, id, glyphOverride) => ({
  ...pattern,
  stitchKey: [
    ...keyEntries(pattern),
    { id, stitch: id, customName: null, glyphOverride, abbreviationOverride: null, labelOverride: null },
  ],
});

/** A stitch of her own, as an older file may carry. */
const withOwn = (pattern, name, glyph) => {
  const id = `k${keyEntries(pattern).length + 1}`;
  const entry = {
    id,
    stitch: null,
    customName: name,
    glyphOverride: glyph,
    abbreviationOverride: null,
    labelOverride: null,
  };
  return { pattern: { ...pattern, stitchKey: [...keyEntries(pattern), entry] }, id };
};
const usage = (pattern) => keyUsage(pattern).map((line) => [line.keyEntryId, line.count]);

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
    const library = withGlyph(base(), 'sc', '✚');
    assert.equal(isCustom(entryOf(library, 'sc')), false);

    const { pattern: own, id } = withOwn(base(), 'Twisted puff', '✳');
    assert.equal(isCustom(entryOf(own, id)), true);
  });
});

describe('entryName', () => {
  test('without an entry the library name for the locale is used', () => {
    const pattern = base();

    assert.equal(entryName(pattern, 'sc', 'hu'), 'rövidpálca (rp)');
    assert.equal(entryName(pattern, 'sc', 'en-US'), 'single crochet (sc)');
  });

  test('an entry of her own is known by her name alone', () => {
    const { pattern, id } = withOwn(base(), 'Twisted puff', '✳');

    assert.equal(entryName(pattern, id, 'hu'), 'Twisted puff');
  });

  test('an id nothing knows falls back to the id itself instead of throwing', () => {
    assert.equal(entryName(base(), 'no-such-stitch', 'hu'), 'no-such-stitch');
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
    const first = withOwn(base(), 'Twisted puff', '✳');
    const second = withOwn(first.pattern, 'Corded edge', '◆');
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
    const { pattern: own, id } = withOwn(base(), 'Twisted puff', '✳');
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
