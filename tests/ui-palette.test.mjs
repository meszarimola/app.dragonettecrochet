/*
 * The palette is built from the stitch library, and the symbols are drawn with
 * the design tokens (PQW-867 acceptance criterion).
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { STITCH_SECTIONS, STITCHES } from '../src/core/stitches.ts';
import { stitchName, stitchStructure } from '../src/core/stitchText.ts';
import { buildPalette } from '../src/ui/palette.ts';

const palette = buildPalette();
const items = palette.flatMap((section) => section.items);

test('the palette shows every stitch exactly once, in library order', () => {
  assert.deepEqual(
    items.map((item) => item.def.id),
    STITCHES.map((stitch) => stitch.id),
  );
});

test('the palette sections are the library sections, each with a title', () => {
  assert.deepEqual(
    palette.map((section) => section.id),
    STITCH_SECTIONS.map((section) => section.id),
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
const DRAWING = ['src/ui/symbols.ts', 'src/ui/board.ts', 'src/ui/main.ts', 'src/ui/palette.ts', 'src/ui/chart-svg.ts'];

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
