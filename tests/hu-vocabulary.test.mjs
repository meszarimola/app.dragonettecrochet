/*
 * Egységes magyar szóhasználat (PQW-872): a stitch magyarul szem, a stitch
 * count szemszám, a hurok csak a horgon lévő hurok. Az „öltés” szó egységként
 * nem szerepelhet a magyar kimenetben: felület, írott minta, jelmagyarázat,
 * ellenőrző üzenetek. A „töltés” (betöltés, újratöltés) más szó, azt nem nézzük.
 */

import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import { layoutPattern } from '../src/core/layout.ts';
import { VOCABULARIES, formatWrittenPattern, writePattern } from '../src/core/pattern-text.ts';
import { RULES } from '../src/core/rules.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { STITCHES } from '../src/core/stitches.ts';
import { stitchLabel, stitchName, stitchStructure } from '../src/core/stitchText.ts';
import { chartSvg } from '../src/ui/chart-svg.ts';
import { buildPalette } from '../src/ui/palette.ts';
import { WORKED_EXAMPLES } from './fixtures/examples.ts';
import { testLibrary } from './fixtures/library.ts';

/** Az „öltés” mint egység minden alakja és összetétele (öltést, alapöltés, V-öltés), a „töltés” nélkül. */
const UNIT_WORD = /[\p{L}-]*(?<!t)öltés\p{L}*/giu;

function assertNoUnitWord(text, where) {
  assert.deepEqual(text.match(UNIT_WORD) ?? [], [], `${where}: „öltés” helyett „szem” kell`);
}

const ROOT = new URL('../', import.meta.url);

/** A mappa fájljai rekurzívan, a megadott kiterjesztésekkel, a gyökérhez képesti úttal. */
function filesIn(dir, extensions) {
  return readdirSync(new URL(dir, ROOT), { recursive: true })
    .filter((file) => extensions.some((extension) => file.endsWith(extension)))
    .map((file) => `${dir}${file}`);
}

const read = (path) => readFileSync(new URL(path, ROOT), 'utf8');

test('a keresés az egység minden alakját megtalálja, a töltést nem', () => {
  assert.deepEqual('öltés, öltést, Öltések, alapöltés, V-öltésbe, öltésszám'.match(UNIT_WORD), [
    'öltés',
    'öltést',
    'Öltések',
    'alapöltés',
    'V-öltésbe',
    'öltésszám',
  ]);
  assert.equal('betöltés, újratöltés, kitöltése, feltöltésével, JSON betöltése'.match(UNIT_WORD), null);
});

test('az írott minta a jóváhagyott kifejezésekkel: szem, szemszám', () => {
  const hu = VOCABULARIES.hu;
  assert.equal(hu.count(15), '(15 szem)');
  assert.equal(hu.skip(2, 'stitch'), '2 szem kihagyása');
  assert.equal(hu.phrases['next-stitch'], 'a következő szembe');
  assert.equal(hu.phrases['same-stitch'], 'ugyanabba a szembe');
  assert.equal(hu.turningChainNotCounted, 'nem számít szemnek');
});

test('a kidolgozott példák magyar írott mintájában és jelmagyarázatában nincs „öltés”', () => {
  for (const [name, make] of Object.entries(WORKED_EXAMPLES)) {
    assertNoUnitWord(formatWrittenPattern(writePattern(make().pattern, testLibrary, 'hu')), name);
  }
});

test('a rögzített magyar mintaszövegekben nincs „öltés”', () => {
  const files = filesIn('tests/fixtures/written/hu/', ['.txt']);
  assert.ok(files.length > 0);
  for (const file of files) assertNoUnitWord(read(file), file);
});

test('a könyvtár magyar neveiben és szerkezeteiben nincs „öltés”', () => {
  for (const def of STITCHES) {
    assertNoUnitWord([stitchName(def, 'hu'), stitchLabel(def, 'hu'), stitchStructure(def, 'hu') ?? ''].join('\n'), def.id);
  }
});

test('a paletta csoportcímeiben és feliratain nincs „öltés”', () => {
  for (const section of buildPalette('hu')) {
    assertNoUnitWord(section.title, section.id);
    for (const item of section.items) assertNoUnitWord(`${item.name}\n${item.structure ?? ''}`, item.def.id);
  }
});

test('az ellenőrző szabályainak üzeneteiben nincs „öltés”', () => {
  assertNoUnitWord(JSON.stringify(RULES), 'src/core/rules.ts');
});

test('a diagram SVG-jének magyar jelmagyarázatában nincs „öltés”', () => {
  for (const [name, make] of Object.entries(WORKED_EXAMPLES)) {
    const { pattern } = make();
    const library = libraryFor(pattern);
    const colors = { right: '#241f2b', wrong: '#2f5f9e', text: '#3f3949', background: '#faf7f3' };
    assertNoUnitWord(chartSvg(pattern, layoutPattern(pattern, library), library, { colors }), name);
  }
});

test('a felület, az üzenetek és a magyar dokumentáció forrásában nincs „öltés”', () => {
  const files = [
    'index.html',
    'README.md',
    ...filesIn('src/', ['.ts', '.css']),
    ...filesIn('docs/calibration/', ['.md', '.json']),
  ];
  for (const file of files) assertNoUnitWord(read(file), file);
});
