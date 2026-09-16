/*
 * A felület nyelve (PQW-900): a szótár teljessége és a nyelvválasztás logikája.
 *
 * A szótár szerkezetét nem ismerjük előre (területenként külön fájl), ezért
 * bejárjuk: minden kulcsútnak mindkét nyelven léteznie kell, azonos fajtával
 * (szöveg vagy függvény) és a függvényeknél azonos paraméterszámmal. Ez az a
 * teszt, amely megfogja a fordítatlan és a kimaradt felületi szöveget.
 *
 * A magyar felület nem változhat: az index.html mai magyar feliratait
 * összevetjük a szótár magyar ágával, tehát a behelyettesítés ugyanazt írja ki,
 * mint ami ma a jelölésben áll.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { test } from 'node:test';

import { MARKUP_TEXTS } from '../src/ui/i18n/markup.ts';
import { UI_LANGUAGES, UI_TEXTS, homeUrl, languageFromSearch, resolveUiLanguage, urlWithLanguage } from '../src/ui/i18n.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const INDEX = read('index.html');
/** A magyar felületre jellemző ékezetes betűk: ahol ilyen van, ott fordítani kell. */
const HUNGARIAN = /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/;

/** A szótár leveleinek kulcsútja és értéke: `{ 'status.next': fn }`. */
function leaves(value, prefix = '', into = new Map()) {
  for (const [key, item] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (item !== null && typeof item === 'object' && !Array.isArray(item)) leaves(item, path, into);
    else into.set(path, item);
  }
  return into;
}

test('a szótár minden területe ugyanazt a kulcskészletet adja mindkét nyelven', () => {
  const [first, ...rest] = UI_LANGUAGES.map((language) => leaves(UI_TEXTS[language]));
  assert.ok(first.size > 100, `túl kevés kulcs: ${first.size}`);
  for (const other of rest) {
    assert.deepEqual([...other.keys()].sort(), [...first.keys()].sort());
  }
});

test('az azonos kulcsok fajtája és paraméterszáma is egyezik a nyelvek között', () => {
  const hu = leaves(UI_TEXTS.hu);
  const en = leaves(UI_TEXTS.en);
  for (const [path, value] of hu) {
    const other = en.get(path);
    assert.equal(typeof other, typeof value, `${path}: eltérő fajta`);
    assert.ok(typeof value === 'string' || typeof value === 'function', `${path}: se nem szöveg, se nem függvény`);
    if (typeof value === 'function') assert.equal(other.length, value.length, `${path}: eltérő paraméterszám`);
    else assert.ok(value.length > 0 && other.length > 0, `${path}: üres szöveg`);
  }
});

test('nincs fordítatlan felületi szöveg: ahol a magyar ékezetes, ott az angol más', () => {
  const hu = leaves(UI_TEXTS.hu);
  const en = leaves(UI_TEXTS.en);
  const untranslated = [...hu]
    .filter(([path, value]) => typeof value === 'string' && HUNGARIAN.test(value) && value === en.get(path))
    .map(([path]) => path);
  assert.deepEqual(untranslated, [], `fordítatlan kulcsok: ${untranslated.join(', ')}`);
});

test('az angol ágban nincs magyar ékezetes szöveg', () => {
  const leftovers = [...leaves(UI_TEXTS.en)]
    .filter(([, value]) => typeof value === 'string' && HUNGARIAN.test(value))
    .map(([path, value]) => `${path}: ${value}`);
  assert.deepEqual(leftovers, []);
});

test('a szótárak területenként külön fájlban vannak, hogy a nyelvek bővíthetők legyenek', () => {
  const files = readdirSync(new URL('../src/ui/i18n/', import.meta.url)).filter((name) => name.endsWith('.ts'));
  assert.ok(files.length >= 5, files.join(', '));
});

/** Az index.html `data-i18n*` hivatkozásai: `[{ key, kind, tag, attributes, body }]`. */
function markupUses() {
  const uses = [];
  for (const match of INDEX.matchAll(/<(\w+)\s([^>]*data-i18n[^>]*)>/g)) {
    const [, tag, attributes] = match;
    const rest = INDEX.slice(match.index + match[0].length);
    const body = rest.slice(0, rest.indexOf(`</${tag}>`));
    for (const kind of ['i18n', 'i18n-tip', 'i18n-label']) {
      const key = new RegExp(`data-${kind}="([^"]+)"`).exec(attributes)?.[1];
      if (key) uses.push({ key, kind, tag, attributes, body });
    }
  }
  return uses;
}

test('az index.html minden hivatkozott felirata benne van a szótárban', () => {
  const uses = markupUses();
  assert.ok(uses.length > 40, `túl kevés felirat a jelölésben: ${uses.length}`);
  const missing = uses.filter((use) => MARKUP_TEXTS.hu[use.key] === undefined).map((use) => use.key);
  assert.deepEqual([...new Set(missing)], []);
});

test('a szótár minden felirata használatban van (jelölésben vagy a felület kódjában)', () => {
  const used = new Set(markupUses().map((use) => use.key));
  const sources = readdirSync(new URL('../src/ui/', import.meta.url))
    .filter((name) => name.endsWith('.ts'))
    .map((name) => read(`src/ui/${name}`))
    .join('\n');
  const dead = Object.keys(MARKUP_TEXTS.hu).filter((key) => !used.has(key) && !sources.includes(`'${key}'`) && !sources.includes(`"${key}"`));
  assert.deepEqual(dead, []);
});

test('a magyar felület nem változik: a szótár magyar ága egyezik a jelölés mai szövegével', () => {
  const differences = [];
  for (const { key, kind, attributes, body } of markupUses()) {
    const expected = MARKUP_TEXTS.hu[key];
    if (expected === undefined) continue;
    if (kind === 'i18n') {
      if (/[<&]/.test(body)) continue; // összetett tartalom: nem hasonlítható össze szövegként
      // A szóközök normalizálva: a jelölés tördelése és a szándékos záró szóköz
      // (ami egy `<kbd>` elem előtt áll) nem szövegeltérés.
      const text = body.replace(/\s+/g, ' ').trim();
      if (text && text !== expected.replace(/\s+/g, ' ').trim()) differences.push(`${key}: „${text}” ≠ „${expected}”`);
      continue;
    }
    const attribute = kind === 'i18n-tip' ? 'data-tip' : 'aria-label';
    const value = new RegExp(`${attribute}="([^"]*)"`).exec(attributes)?.[1];
    if (value !== undefined && value !== expected) differences.push(`${key} (${attribute}): „${value}” ≠ „${expected}”`);
  }
  assert.deepEqual(differences, []);
});

test('a `?lang` paraméter magyarra és angolra állít, mást nem fogad el', () => {
  assert.equal(languageFromSearch('?lang=en'), 'en');
  assert.equal(languageFromSearch('?lang=EN-GB'), 'en');
  assert.equal(languageFromSearch('?lang=hu'), 'hu');
  assert.equal(languageFromSearch('?lang=ja'), null);
  assert.equal(languageFromSearch('?lang='), null);
  assert.equal(languageFromSearch(''), null);
  assert.equal(languageFromSearch('?other=en'), null);
});

test('paraméter nélkül a dokumentum nyelve dönt, és az alapértelmezés a magyar', () => {
  assert.equal(resolveUiLanguage('', 'hu'), 'hu');
  assert.equal(resolveUiLanguage('', 'en'), 'en');
  assert.equal(resolveUiLanguage('', 'en-GB'), 'en');
  assert.equal(resolveUiLanguage('', ''), 'hu');
  assert.equal(resolveUiLanguage('?lang=en', 'hu'), 'en', 'a paraméter erősebb a dokumentum nyelvénél');
  assert.equal(resolveUiLanguage('?lang=hu', 'en'), 'hu');
});

test('a főoldal linkje és a megosztható cím a választott nyelven', () => {
  assert.match(homeUrl('hu'), /\/hu\/$/);
  assert.match(homeUrl('en'), /\/en\/$/);
  assert.equal(urlWithLanguage('https://app.dragonettecrochet.com/', 'en'), 'https://app.dragonettecrochet.com/?lang=en');
  assert.equal(urlWithLanguage('https://app.dragonettecrochet.com/?lang=en', 'hu'), 'https://app.dragonettecrochet.com/?lang=hu');
});
