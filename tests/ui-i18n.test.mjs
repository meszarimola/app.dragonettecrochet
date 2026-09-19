/*
 * The language of the interface (PQW-900): completeness of the dictionary and
 * the logic that picks a language.
 *
 * The shape of the dictionary is not known up front (one file per area), so we
 * walk it: every key path has to exist in both languages, with the same kind
 * (text or function) and, for functions, the same parameter count. This is the
 * test that catches untranslated and missing interface text.
 *
 * The Hungarian interface must not change: the Hungarian labels standing in
 * index.html today are compared with the Hungarian branch of the dictionary, so
 * the substitution prints exactly what the markup says today.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { test } from 'node:test';

import { MARKUP_TEXTS } from '../src/ui/i18n/markup.ts';
import { UI_LANGUAGES, UI_TEXTS, homeUrl, languageFromSearch, resolveUiLanguage, urlWithLanguage } from '../src/ui/i18n.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const INDEX = read('index.html');
/** The accented letters typical of the Hungarian interface: wherever one shows up, that text still needs translating. */
const HUNGARIAN = /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/;

/** Key path and value of every leaf of the dictionary: `{ 'status.next': fn }`. */
function leaves(value, prefix = '', into = new Map()) {
  for (const [key, item] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (item !== null && typeof item === 'object' && !Array.isArray(item)) leaves(item, path, into);
    else into.set(path, item);
  }
  return into;
}

test('every area of the dictionary exposes the same set of keys in both languages', () => {
  const [first, ...rest] = UI_LANGUAGES.map((language) => leaves(UI_TEXTS[language]));
  assert.ok(first.size > 100, `too few keys: ${first.size}`);
  for (const other of rest) {
    assert.deepEqual([...other.keys()].sort(), [...first.keys()].sort());
  }
});

test('matching keys also agree on kind and parameter count across the languages', () => {
  const hu = leaves(UI_TEXTS.hu);
  const en = leaves(UI_TEXTS.en);
  for (const [path, value] of hu) {
    const other = en.get(path);
    assert.equal(typeof other, typeof value, `${path}: different kind`);
    assert.ok(typeof value === 'string' || typeof value === 'function', `${path}: neither a string nor a function`);
    if (typeof value === 'function') assert.equal(other.length, value.length, `${path}: different parameter count`);
    else assert.ok(value.length > 0 && other.length > 0, `${path}: empty text`);
  }
});

test('no interface text is left untranslated: wherever the Hungarian is accented the English differs', () => {
  const hu = leaves(UI_TEXTS.hu);
  const en = leaves(UI_TEXTS.en);
  const untranslated = [...hu]
    .filter(([path, value]) => typeof value === 'string' && HUNGARIAN.test(value) && value === en.get(path))
    .map(([path]) => path);
  assert.deepEqual(untranslated, [], `untranslated keys: ${untranslated.join(', ')}`);
});

test('the English branch holds no accented Hungarian text', () => {
  const leftovers = [...leaves(UI_TEXTS.en)]
    .filter(([, value]) => typeof value === 'string' && HUNGARIAN.test(value))
    .map(([path, value]) => `${path}: ${value}`);
  assert.deepEqual(leftovers, []);
});

test('dictionaries live in one file per area so that further languages can be added', () => {
  const files = readdirSync(new URL('../src/ui/i18n/', import.meta.url)).filter((name) => name.endsWith('.ts'));
  assert.ok(files.length >= 5, files.join(', '));
});

/** The `data-i18n*` references of index.html: `[{ key, kind, tag, attributes, body }]`. */
function markupUses() {
  const uses = [];
  for (const match of INDEX.matchAll(/<(\w+)\s([^>]*data-i18n[^>]*)>/g)) {
    const [, tag, attributes] = match;
    const rest = INDEX.slice(match.index + match[0].length);
    // A self-closing element (the meta in the head) has no body; there we read the `content` attribute.
    const end = rest.indexOf(`</${tag}>`);
    const body = end === -1 ? '' : rest.slice(0, end);
    for (const kind of ['i18n', 'i18n-tip', 'i18n-label', 'i18n-content']) {
      const key = new RegExp(`data-${kind}="([^"]+)"`).exec(attributes)?.[1];
      if (key) uses.push({ key, kind, tag, attributes, body });
    }
  }
  return uses;
}

test('every label referenced from index.html is present in the dictionary', () => {
  const uses = markupUses();
  assert.ok(uses.length > 40, `too few labels in the markup: ${uses.length}`);
  const missing = uses.filter((use) => MARKUP_TEXTS.hu[use.key] === undefined).map((use) => use.key);
  assert.deepEqual([...new Set(missing)], []);
});

test('every label in the dictionary is in use, in the markup or in the interface code', () => {
  const used = new Set(markupUses().map((use) => use.key));
  const sources = readdirSync(new URL('../src/ui/', import.meta.url))
    .filter((name) => name.endsWith('.ts'))
    .map((name) => read(`src/ui/${name}`))
    .join('\n');
  const dead = Object.keys(MARKUP_TEXTS.hu).filter((key) => !used.has(key) && !sources.includes(`'${key}'`) && !sources.includes(`"${key}"`));
  assert.deepEqual(dead, []);
});

test('the Hungarian interface does not change: the Hungarian branch matches the text in the markup today', () => {
  const differences = [];
  for (const { key, kind, attributes, body } of markupUses()) {
    const expected = MARKUP_TEXTS.hu[key];
    if (expected === undefined) continue;
    if (kind === 'i18n') {
      if (/[<&]/.test(body)) continue; // rich content: cannot be compared as plain text
      // Whitespace is normalised: the line wrapping of the markup and the deliberate
      // trailing space (the one standing before a `<kbd>` element) are not text differences.
      const text = body.replace(/\s+/g, ' ').trim();
      if (text && text !== expected.replace(/\s+/g, ' ').trim()) differences.push(`${key}: „${text}” ≠ „${expected}”`);
      continue;
    }
    const attribute = kind === 'i18n-tip' ? 'data-tip' : kind === 'i18n-content' ? 'content' : 'aria-label';
    // As a standalone attribute: the names `data-i18n-tip` and `data-i18n-content` also
    // contain the attribute name we are looking for, so we anchor on whitespace.
    const value = new RegExp(`(?:^|\\s)${attribute}="([^"]*)"`).exec(attributes)?.[1];
    if (value !== undefined && value !== expected) differences.push(`${key} (${attribute}): „${value}” ≠ „${expected}”`);
  }
  assert.deepEqual(differences, []);
});

test('the `?lang` parameter switches to Hungarian or English and accepts nothing else', () => {
  assert.equal(languageFromSearch('?lang=en'), 'en');
  assert.equal(languageFromSearch('?lang=EN-GB'), 'en');
  assert.equal(languageFromSearch('?lang=hu'), 'hu');
  assert.equal(languageFromSearch('?lang=ja'), null);
  assert.equal(languageFromSearch('?lang='), null);
  assert.equal(languageFromSearch(''), null);
  assert.equal(languageFromSearch('?other=en'), null);
});

test('with no parameter and no stored value the document language decides, defaulting to Hungarian', () => {
  assert.equal(resolveUiLanguage('', null, 'hu'), 'hu');
  assert.equal(resolveUiLanguage('', null, 'en'), 'en');
  assert.equal(resolveUiLanguage('', null, 'en-GB'), 'en');
  assert.equal(resolveUiLanguage('', null, ''), 'hu');
});

test('resolution order: `?lang` outranks the stored value, and the stored value outranks the document language (PQW-906)', () => {
  assert.equal(resolveUiLanguage('?lang=en', 'hu', 'hu'), 'en', 'a shared link always serves its own language');
  assert.equal(resolveUiLanguage('?lang=hu', 'en', 'en'), 'hu');
  assert.equal(resolveUiLanguage('', 'en', 'hu'), 'en', 'the stored choice outranks the document language');
  assert.equal(resolveUiLanguage('', 'hu', 'en'), 'hu');
});

test('a corrupt or unknown stored value does not break startup (PQW-906)', () => {
  for (const stored of [null, '', ' ', 'ja', 'de-DE', '{"lang":"en"}', 'HU', ' en ']) {
    const resolved = resolveUiLanguage('', stored, 'hu');
    assert.ok(resolved === 'hu' || resolved === 'en', `${stored}: ${resolved}`);
  }
  assert.equal(resolveUiLanguage('', 'ja', 'hu'), 'hu', 'an unknown value falls back to the default language');
  assert.equal(resolveUiLanguage('', 'HU', 'en'), 'hu', 'case and surrounding whitespace do not matter');
  assert.equal(resolveUiLanguage('', ' en ', 'hu'), 'en');
});

test('the home link and the shareable URL use the chosen language', () => {
  assert.match(homeUrl('hu'), /\/hu\/$/);
  assert.match(homeUrl('en'), /\/en\/$/);
  assert.equal(urlWithLanguage('https://app.dragonettecrochet.com/', 'en'), 'https://app.dragonettecrochet.com/?lang=en');
  assert.equal(urlWithLanguage('https://app.dragonettecrochet.com/?lang=en', 'hu'), 'https://app.dragonettecrochet.com/?lang=hu');
});
