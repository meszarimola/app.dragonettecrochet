/*
 * The palette is built from the stitch library, and the symbols are drawn with
 * the design tokens (PQW-867 acceptance criterion).
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { SHAPING_PARTS, STITCH_SECTIONS, STITCHES, stitchById } from '../src/core/stitches.ts';
import { stitchName, stitchStructure } from '../src/core/stitchText.ts';
import { buildPalette, DEFAULT_SHAPING, partLabel, SHAPINGS } from '../src/ui/palette.ts';

const palette = buildPalette();
const items = palette.flatMap((section) => section.items);

/*
 * KB: interface.md §74 — the palette is not the library any more. The chain space
 * is drawn by the chain arc tool, so it has no tile; the magic ring is shown among
 * the compound stitches. The library order itself is untouched, because the written
 * pattern's key follows it.
 */
test('the palette shows every stitch once, save the chain space, and the magic ring with the compound ones', () => {
  const shown = items.map((item) => item.def.id);
  assert.equal(new Set(shown).size, shown.length, 'no stitch twice');
  // KB: interface.md §86 — the listed increases and decreases give way to two tiles built from a menu.
  const listed = STITCH_SECTIONS.find((section) => section.id === 'increase-decrease').stitches;
  const menuBuilt = new Set(listed.filter((stitch) => stitch.id !== 'invdec').map((stitch) => stitch.id));
  assert.deepEqual(
    new Set(shown),
    new Set([
      ...STITCHES.filter((stitch) => stitch.id !== 'ch-sp' && !menuBuilt.has(stitch.id)).map((stitch) => stitch.id),
      'sc2tog',
      'inc-2sc',
    ]),
    'every stitch but the chain space, and the default decrease and increase',
  );
  assert.equal(
    palette.find((section) => section.id === 'compound')?.items.at(-1)?.def.id,
    'magic-ring',
    'the magic ring closes the compound section',
  );
});

test('the palette sections are the library sections that have tiles, each with a title', () => {
  assert.deepEqual(
    palette.map((section) => section.id),
    STITCH_SECTIONS.filter((section) => section.offPalette !== true).map((section) => section.id),
  );
  const titles = palette.map((section) => section.title);
  assert.ok(titles.every((title) => title.trim()));
  assert.equal(new Set(titles).size, titles.length);
});

test('the first nine stitches get shortcuts 1–9 and the rest get none', () => {
  assert.deepEqual(
    items.map((item) => item.key),
    items.map((_, i) => (i < 9 ? String(i + 1) : null)),
  );
});

test('labels start with a capital letter and never contain „hamispálca”', () => {
  for (const item of items) {
    assert.match(item.name, /^\p{Lu}/u, item.def.id);
    for (const text of [item.name, item.structure ?? '']) {
      assert.doesNotMatch(text, /hamis/i, item.def.id);
    }
  }
});

test('the structure line appears only for compound stitches', () => {
  for (const item of items) {
    const compound = item.def.kind === 'group' || (item.def.kind === 'joined' && item.def.closure !== 'loops');
    assert.equal(item.structure !== null, compound, item.def.id);
  }
});

/* ---- Notation (PQW-868) ---- */

for (const terms of ['hu', 'en-US', 'en-GB']) {
  test(`palette names and structures follow the chosen notation: ${terms}`, () => {
    for (const item of buildPalette(terms).flatMap((section) => section.items)) {
      const name = stitchName(item.def, terms);
      assert.equal(item.name, name.charAt(0).toUpperCase() + name.slice(1), item.def.id);
      assert.equal(item.structure, stitchStructure(item.def, terms), item.def.id);
    }
  });
}

test('the palette defaults to Hungarian notation, and „dc” means different things in US and UK terms', () => {
  const name = (terms, id) =>
    buildPalette(terms)
      .flatMap((s) => s.items)
      .find((item) => item.def.id === id).name;
  assert.equal(name(undefined, 'sc'), 'Rövidpálca (rp)');
  assert.equal(name('en-US', 'sc'), 'Single crochet (sc)');
  assert.equal(name('en-GB', 'sc'), 'Double crochet (dc)');
  assert.equal(name('en-US', 'dc'), 'Double crochet (dc)');
  assert.equal(name('en-GB', 'dc'), 'Treble (tr)');
});

test('a UK-notation palette shows no sc, hdc or sl st', () => {
  for (const item of buildPalette('en-GB').flatMap((section) => section.items)) {
    assert.doesNotMatch(`${item.name} ${item.structure ?? ''}`, /\b(sc|hdc)(?=\d|\b)|sl st/, item.def.id);
  }
});

/* ---- Design tokens ---- */

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const DRAWING = ['src/ui/symbols.ts', 'src/ui/freeform-board.ts', 'src/ui/main.ts', 'src/ui/palette.ts'];

test('the drawing code holds no literal colour', () => {
  for (const path of DRAWING) {
    assert.doesNotMatch(read(path), /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, path);
  }
});

test('the ink colour comes from the --c-ink token, and only symbols.ts sets a colour', () => {
  assert.match(read('src/ui/styles.css'), /--c-ink:\s*#[0-9a-f]{6};/i);
  assert.match(read('src/ui/symbols.ts'), /getPropertyValue\('--c-ink'\)/);
  for (const path of DRAWING.filter((p) => p !== 'src/ui/symbols.ts')) {
    assert.doesNotMatch(read(path), /strokeStyle|fillStyle/, path);
  }
});

/* ---- Increases and decreases from a menu (PQW-1155) ---- */

test('the increase and decrease section is a decrease, an increase, then the invisible decrease', () => {
  const section = buildPalette('en-US').find(({ id }) => id === 'increase-decrease');
  assert.deepEqual(
    section.items.map(({ def, shaping }) => [def.id, shaping]),
    [
      ['sc2tog', 'decrease'],
      ['inc-2sc', 'increase'],
      ['invdec', null],
    ],
  );
  assert.deepEqual(SHAPINGS, ['decrease', 'increase']);
  assert.deepEqual(
    section.items.map(({ key }) => key),
    ['8', '9', null],
    'Alt+8 is the decrease, Alt+9 the increase',
  );
});

test('the tiles follow the chosen part and count, and say so on the structure line', () => {
  const choice = { parts: { decrease: stitchById('dc'), increase: stitchById('dtr') }, n: 3 };
  const [dec, inc] = buildPalette('en-US', choice).find(({ id }) => id === 'increase-decrease').items;
  assert.equal(dec.def.id, 'dc3tog');
  assert.equal(dec.structure, 'dc3tog');
  assert.equal(inc.def.id, 'inc-3dtr');
  assert.equal(inc.structure, '3 dtr in same st');
  assert.deepEqual(
    [DEFAULT_SHAPING.parts.decrease.id, DEFAULT_SHAPING.parts.increase.id, DEFAULT_SHAPING.n],
    ['sc', 'sc', 2],
  );
});

test('the menu offers sc to dtr by their whole names in the notation, never an abbreviation', () => {
  assert.deepEqual(
    SHAPING_PARTS.map((part) => partLabel(part, 'en-US')),
    ['Single crochet', 'Half double crochet', 'Double crochet', 'Treble', 'Double treble'],
  );
  assert.deepEqual(
    SHAPING_PARTS.map((part) => partLabel(part, 'en-GB')),
    ['Double crochet', 'Half treble', 'Treble', 'Double treble', 'Triple treble'],
  );
  assert.deepEqual(
    SHAPING_PARTS.map((part) => partLabel(part, 'hu')),
    ['Rövidpálca', 'Félpálca', 'Egyráhajtásos pálca', 'Kétráhajtásos pálca', 'Háromráhajtásos pálca'],
  );
});
