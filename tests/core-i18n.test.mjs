/*
 * The dictionaries for the messages that come out of the core (PQW-904).
 *
 * The core hands over a code and data (`CoreText`); the sentence is built in
 * the UI. This test guards that every code has text in BOTH languages and that
 * no entry is left untranslated. We do not know the shape of the dictionaries
 * up front (one file per area), so we walk them.
 *
 * The second part looks the other way, from the core: no Hungarian sentence
 * should be left in the files meant for the user. Whatever we keep in
 * Hungarian on purpose (developer errors, names written into the saved
 * pattern, the vocabulary of the written pattern) is listed by name among the
 * exceptions — so a new Hungarian sentence stands out while the old ones stay
 * quiet.
 */

import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import { renderCoreText } from '../src/ui/i18n/core/render.ts';

const HUNGARIAN = /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/;
const CORE_DIR = new URL('../src/ui/i18n/core/', import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

/** The per-area dictionary modules: every file except `render.ts`. */
const modules = readdirSync(CORE_DIR)
  .filter((name) => name.endsWith('.ts') && name !== 'render.ts')
  .sort();

/** The exported dictionaries: `{ hu, en }` shaped objects; one area may hold several. */
async function dictionaries() {
  const found = [];
  for (const name of modules) {
    const module = await import(new URL(name, CORE_DIR).href);
    for (const [exported, value] of Object.entries(module)) {
      if (value && typeof value === 'object' && 'hu' in value && 'en' in value) {
        found.push({ name: `${name}:${exported}`, value });
      }
    }
  }
  return found;
}

test('there is at least one area dictionary, and it carries both languages', async () => {
  const found = await dictionaries();
  assert.ok(modules.length >= 1, 'no dictionary module under src/ui/i18n/core/');
  assert.ok(found.length >= 1, `no { hu, en } shaped export: ${modules.join(', ')}`);
});

test('every code has text in both languages, and of the same kind', async () => {
  for (const { name, value } of await dictionaries()) {
    const hu = Object.keys(value.hu).sort();
    const en = Object.keys(value.en).sort();
    assert.deepEqual(en, hu, `${name}: the code sets differ`);
    for (const code of hu) {
      const a = value.hu[code];
      const b = value.en[code];
      assert.equal(typeof b, typeof a, `${name}/${code}: different kind`);
      assert.ok(typeof a === 'string' || typeof a === 'function', `${name}/${code}: neither a string nor a function`);
      if (typeof a === 'function') assert.equal(b.length, a.length, `${name}/${code}: different parameter count`);
      else assert.ok(a.length > 0 && b.length > 0, `${name}/${code}: empty text`);
    }
  }
});

test('no code is left untranslated: where the Hungarian is accented, the English differs', async () => {
  const untranslated = [];
  for (const { name, value } of await dictionaries()) {
    for (const [code, hu] of Object.entries(value.hu)) {
      if (typeof hu === 'string' && HUNGARIAN.test(hu) && hu === value.en[code]) untranslated.push(`${name}/${code}`);
    }
  }
  assert.deepEqual(untranslated, []);
});

test('the English branch holds no accented Hungarian text', async () => {
  const leftovers = [];
  for (const { name, value } of await dictionaries()) {
    for (const [code, en] of Object.entries(value.en)) {
      if (typeof en === 'string' && HUNGARIAN.test(en)) leftovers.push(`${name}/${code}: ${en}`);
    }
  }
  assert.deepEqual(leftovers, []);
});

/*
 * From the core: where a Hungarian sentence may remain.
 *
 * - The written pattern and the stitch names follow the language of the
 *   NOTATION (PQW-868), not that of the UI: their vocabulary does not turn
 *   with the interface.
 * - A name the UI asks for with a locale, and the wording the UI already owns
 *   a dictionary for.
 * - Generator names go into the pattern TITLE and into the piece name, so they
 *   are data of the saved file; for its lists the UI uses its own dictionary.
 * - A handful of internal invariants whose Hungarian sits inside a `throw`.
 *
 * Developer-facing text is English (PQW-1100): a message that only a developer
 * ever reads is translated, not exempted. That is why the calibration reader
 * and the pattern reader are no longer listed here.
 */
const CORE_EXCEPTIONS = new Set([
  'finished-size.ts', // RangeError, only tests call it
  'pattern-size.ts', // RangeError, internal invariant
  'pattern-text.ts', // the vocabulary of the written pattern: the language of the notation
  'stitchText.ts', // the same: the stitch description in the written pattern, per language
  'hungarian.ts', // Hungarian grammar helpers for the written pattern
  'stitches.ts', // stitch names, per language
  'stitch-library.ts',
  'tradition.ts',
  'hook-sizes.ts', // source attribution; it never reaches the screen
  'insertion.ts', // the UI uses its own dictionary (PQW-900)
  'rules.ts', // the validator texts live in src/ui/i18n/rules.ts (PQW-900)
  'body-sizes.ts', // size names: the UI asks for them with the locale (hatSizeName, bodySizeName)
]);

/**
 * The rows of the `*_NAMES` tables and of `DEFAULT_TITLE` are skipped:
 * generator names and the default title go into the pattern TITLE and into the
 * piece name, so they are data of the saved file, not UI labels (for its lists
 * the UI uses its own dictionary). Each table carries every locale since
 * PQW-920, so the Hungarian row sits one level deeper; the brace counting
 * follows it to the end of the whole table. We do not exempt a whole file for
 * their sake, so that a new Hungarian SENTENCE in the same file still stands
 * out.
 */
function withoutNameTables(source) {
  const rows = [];
  let inNames = false;
  let depth = 0;
  for (const [index, line] of source.split('\n').entries()) {
    if (!inNames && /(const|readonly)\s+([A-Z][A-Z0-9_]*NAMES?|DEFAULT_TITLE)\b[^=]*=/.test(line)) {
      inNames = true;
      depth = 0;
    }
    if (inNames) {
      depth += (line.match(/[{[]/g) ?? []).length - (line.match(/[}\]]/g) ?? []).length;
      if (depth <= 0) inNames = false;
      continue;
    }
    rows.push([index + 1, line]);
  }
  return rows;
}

test('no Hungarian sentence is left in the core files that face the user', () => {
  const offenders = [];
  for (const name of readdirSync(new URL('../src/core/', import.meta.url))) {
    if (!name.endsWith('.ts') || CORE_EXCEPTIONS.has(name)) continue;
    const source = read(`src/core/${name}`);
    for (const [number, line] of withoutNameTables(source)) {
      if (/^\s*(\*|\/\/|\/\*)/.test(line)) continue; // a comment, single-line or block
      const code = line.replace(/\/\/.*$/, '');
      // Thrown errors speak to the developer, not to the user.
      if (/throw new (Error|RangeError|TypeError)/.test(code)) continue;
      // The pattern DATA stays Hungarian: the default title goes into the
      // saved file and the names of pieces and sections go into the written
      // pattern, so they belong to the language of the notation, not the UI.
      if (/DEFAULT_TITLE|title = '|\bname: '/.test(code)) continue;
      const literals = code.match(/'[^']*'|`[^`]*`/g) ?? [];
      if (literals.some((literal) => HUNGARIAN.test(literal))) {
        offenders.push(`src/core/${name}:${number}: ${line.trim()}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `a Hungarian sentence was left in the core:\n${offenders.join('\n')}`);
});

test('a core code missing from the chosen language falls back to English, then to the code (PQW-1100)', () => {
  const dictionary = { hu: {}, en: { known: 'An English sentence.' } };
  assert.equal(
    renderCoreText(dictionary, 'hu', { code: 'known' }),
    'An English sentence.',
    'the English branch answers for a code the chosen language has not got',
  );
  assert.equal(
    renderCoreText(dictionary, 'hu', { code: 'absent' }),
    'absent',
    'KB: dictionaries.md §1 — a core ahead of every dictionary degrades to the code, it does not break the interface',
  );
  assert.equal(
    renderCoreText({ hu: { known: 'Magyar mondat.' }, en: { known: 'English.' } }, 'hu', { code: 'known' }),
    'Magyar mondat.',
    'the chosen language still wins where it has the code',
  );
});
