/*
 * Consistent Hungarian vocabulary (PQW-872): a stitch is „szem” in Hungarian.
 * The word „öltés” may never appear as a unit in the Hungarian interface.
 * „Töltés” (betöltés, újratöltés) is a different word and is not examined.
 */

import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import { STITCHES } from '../src/core/stitches.ts';
import { stitchLabel, stitchName, stitchStructure } from '../src/core/stitchText.ts';
import { buildPalette } from '../src/ui/palette.ts';

/** Every form and compound of „öltés” used as a unit (öltést, alapöltés, V-öltés), but never „töltés”. */
const UNIT_WORD = /[\p{L}-]*(?<!t)öltés\p{L}*/giu;

function assertNoUnitWord(text, where) {
  assert.deepEqual(text.match(UNIT_WORD) ?? [], [], `${where}: use „szem” here instead of „öltés”`);
}

const ROOT = new URL('../', import.meta.url);

/** The files of the directory, recursively, with the given extensions, as paths relative to the root. */
function filesIn(dir, extensions) {
  return readdirSync(new URL(dir, ROOT), { recursive: true })
    .filter((file) => extensions.some((extension) => file.endsWith(extension)))
    .map((file) => `${dir}${file}`);
}

const read = (path) => readFileSync(new URL(path, ROOT), 'utf8');

test('the search finds every form of the unit word, but never „töltés”', () => {
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

test('no „öltés” in the Hungarian names and structures of the stitch library', () => {
  for (const def of STITCHES) {
    assertNoUnitWord(
      [stitchName(def, 'hu'), stitchLabel(def, 'hu'), stitchStructure(def, 'hu') ?? ''].join('\n'),
      def.id,
    );
  }
});

test('no „öltés” in the palette section titles or item labels', () => {
  for (const section of buildPalette('hu')) {
    assertNoUnitWord(section.title, section.id);
    for (const item of section.items) assertNoUnitWord(`${item.name}\n${item.structure ?? ''}`, item.def.id);
  }
});

test('no „öltés” in the source of the interface and the Hungarian documentation', () => {
  const files = [
    'index.html',
    'README.md',
    ...filesIn('src/', ['.ts', '.css']),
    ...filesIn('docs/calibration/', ['.md', '.json']),
  ];
  for (const file of files) assertNoUnitWord(read(file), file);
});
