/*
 * A paletta a könyvtárból épül, és a jelek a design tokenekkel rajzolódnak
 * (PQW-867 elfogadási feltétel).
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { STITCHES, STITCH_SECTIONS } from '../src/core/stitches.ts';
import { buildPalette } from '../src/ui/palette.ts';

const palette = buildPalette();
const items = palette.flatMap((section) => section.items);

test('a paletta minden öltést pontosan egyszer mutat, a könyvtár sorrendjében', () => {
  assert.deepEqual(
    items.map((item) => item.def.id),
    STITCHES.map((stitch) => stitch.id),
  );
});

test('a paletta csoportjai a könyvtár csoportjai, mindnek van címe', () => {
  assert.deepEqual(
    palette.map((section) => section.id),
    STITCH_SECTIONS.map((section) => section.id),
  );
  const titles = palette.map((section) => section.title);
  assert.ok(titles.every((title) => title.trim()));
  assert.equal(new Set(titles).size, titles.length);
});

test('az első kilenc öltésnek 1–9 a gyorsbillentyűje, a többinek nincs', () => {
  assert.deepEqual(
    items.map((item) => item.key),
    items.map((_, i) => (i < 9 ? String(i + 1) : null)),
  );
});

test('a feliratok nagybetűvel kezdődnek, és nincs bennük „hamispálca”', () => {
  for (const item of items) {
    assert.match(item.name, /^\p{Lu}/u, item.def.id);
    for (const text of [item.name, item.structure ?? '', item.english]) {
      assert.doesNotMatch(text, /hamis/i, item.def.id);
    }
  }
});

test('a szerkezet csak az összetett öltéseknél jelenik meg', () => {
  for (const item of items) {
    const compound = item.def.kind === 'group' || (item.def.kind === 'joined' && item.def.closure !== 'loops');
    assert.equal(item.structure !== null, compound, item.def.id);
  }
});

/* ---- Design tokenek ---- */

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const DRAWING = ['src/ui/symbols.ts', 'src/ui/board.ts', 'src/ui/main.ts', 'src/ui/palette.ts'];

test('a rajzoló kódban nincs konkrét szín', () => {
  for (const path of DRAWING) {
    assert.doesNotMatch(read(path), /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, path);
  }
});

test('a tintaszín a --c-ink tokenből jön, és csak a symbols.ts állít színt', () => {
  assert.match(read('src/ui/styles.css'), /--c-ink:\s*#[0-9a-f]{6};/i);
  assert.match(read('src/ui/symbols.ts'), /getPropertyValue\('--c-ink'\)/);
  for (const path of DRAWING.filter((p) => p !== 'src/ui/symbols.ts')) {
    assert.doesNotMatch(read(path), /strokeStyle|fillStyle/, path);
  }
});
