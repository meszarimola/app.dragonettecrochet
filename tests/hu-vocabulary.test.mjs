/*
 * Consistent Hungarian vocabulary (PQW-872): a stitch is „szem” in Hungarian,
 * a stitch count is „szemszám”, and „hurok” names only the loop on the hook.
 * The word „öltés” may never appear as a unit in the Hungarian output:
 * interface, written pattern, chart key, checker messages. „Töltés”
 * (betöltés, újratöltés) is a different word and is not examined.
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

test('the written pattern uses the approved terms: „szem”, „szemszám”', () => {
  const hu = VOCABULARIES.hu;
  assert.equal(hu.count(15), '(15 szem)');
  assert.equal(hu.skip(2, 'stitch'), '2 szem kihagyása');
  assert.equal(hu.phrases['next-stitch'], 'a következő szembe');
  assert.equal(hu.phrases['same-stitch'], 'ugyanabba a szembe');
  assert.equal(hu.turningChainNotCounted, 'fordulólánc');
});

test('no „öltés” in the Hungarian written pattern or chart key of the worked examples', () => {
  for (const [name, make] of Object.entries(WORKED_EXAMPLES)) {
    assertNoUnitWord(formatWrittenPattern(writePattern(make().pattern, testLibrary, 'hu')), name);
  }
});

test('no „öltés” in the recorded Hungarian pattern texts', () => {
  const files = filesIn('tests/fixtures/written/hu/', ['.txt']);
  assert.ok(files.length > 0);
  for (const file of files) assertNoUnitWord(read(file), file);
});

test('no „öltés” in the Hungarian names and structures of the stitch library', () => {
  for (const def of STITCHES) {
    assertNoUnitWord([stitchName(def, 'hu'), stitchLabel(def, 'hu'), stitchStructure(def, 'hu') ?? ''].join('\n'), def.id);
  }
});

test('no „öltés” in the palette section titles or item labels', () => {
  for (const section of buildPalette('hu')) {
    assertNoUnitWord(section.title, section.id);
    for (const item of section.items) assertNoUnitWord(`${item.name}\n${item.structure ?? ''}`, item.def.id);
  }
});

test('no „öltés” in the messages of the checker rules', () => {
  assertNoUnitWord(JSON.stringify(RULES), 'src/core/rules.ts');
});

test('no „öltés” in the Hungarian chart key of the exported SVG', () => {
  for (const [name, make] of Object.entries(WORKED_EXAMPLES)) {
    const { pattern } = make();
    const library = libraryFor(pattern);
    const colors = { right: '#241f2b', wrong: '#2f5f9e', text: '#3f3949', background: '#faf7f3' };
    assertNoUnitWord(chartSvg(pattern, layoutPattern(pattern, library), library, { colors }), name);
  }
});

test('no „öltés” in the source of the interface, the messages and the Hungarian documentation', () => {
  const files = [
    'index.html',
    'README.md',
    ...filesIn('src/', ['.ts', '.css']),
    ...filesIn('docs/calibration/', ['.md', '.json']),
  ];
  for (const file of files) assertNoUnitWord(read(file), file);
});
