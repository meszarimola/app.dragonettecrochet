/*
 * A magból jövő üzenetek szótárai (PQW-904).
 *
 * A mag kódot és adatot ad (`CoreText`), a mondat a felületen készül. Ez a
 * teszt azt őrzi, hogy minden kódhoz tartozzon szöveg MINDKÉT nyelven, és ne
 * maradjon fordítatlan tétel. A szótárak szerkezetét nem ismerjük előre
 * (területenként külön fájl), ezért bejárjuk őket.
 *
 * A második rész a mag felől néz: a felhasználónak szánt fájlokban ne maradjon
 * magyar mondat. Amit szándékosan magyarul hagyunk (fejlesztői hibák, a mentett
 * mintába íródó nevek, az írott minta szókészlete), az névvel szerepel a
 * kivételek között — így egy új magyar mondat feltűnik, a régiek viszont nem
 * adnak zajt.
 */

import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const HUNGARIAN = /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/;
const CORE_DIR = new URL('../src/ui/i18n/core/', import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

/** A területi szótármodulok: minden fájl a `render.ts` kivételével. */
const modules = readdirSync(CORE_DIR)
  .filter((name) => name.endsWith('.ts') && name !== 'render.ts')
  .sort();

/** Az exportált szótárak: `{ hu, en }` alakú objektumok, területenként több is lehet. */
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

test('van legalább egy területi szótár, és mind a két nyelvet tartalmazza', async () => {
  const found = await dictionaries();
  assert.ok(modules.length >= 1, 'nincs szótármodul a src/ui/i18n/core/ alatt');
  assert.ok(found.length >= 1, `nincs { hu, en } alakú export: ${modules.join(', ')}`);
});

test('minden kódhoz mindkét nyelven tartozik szöveg, azonos fajtával', async () => {
  for (const { name, value } of await dictionaries()) {
    const hu = Object.keys(value.hu).sort();
    const en = Object.keys(value.en).sort();
    assert.deepEqual(en, hu, `${name}: eltérő kódkészlet`);
    for (const code of hu) {
      const a = value.hu[code];
      const b = value.en[code];
      assert.equal(typeof b, typeof a, `${name}/${code}: eltérő fajta`);
      assert.ok(typeof a === 'string' || typeof a === 'function', `${name}/${code}: se nem szöveg, se nem függvény`);
      if (typeof a === 'function') assert.equal(b.length, a.length, `${name}/${code}: eltérő paraméterszám`);
      else assert.ok(a.length > 0 && b.length > 0, `${name}/${code}: üres szöveg`);
    }
  }
});

test('nincs fordítatlan kód: ahol a magyar ékezetes, ott az angol más', async () => {
  const untranslated = [];
  for (const { name, value } of await dictionaries()) {
    for (const [code, hu] of Object.entries(value.hu)) {
      if (typeof hu === 'string' && HUNGARIAN.test(hu) && hu === value.en[code]) untranslated.push(`${name}/${code}`);
    }
  }
  assert.deepEqual(untranslated, []);
});

test('az angol ágban nincs magyar ékezetes szöveg', async () => {
  const leftovers = [];
  for (const { name, value } of await dictionaries()) {
    for (const [code, en] of Object.entries(value.en)) {
      if (typeof en === 'string' && HUNGARIAN.test(en)) leftovers.push(`${name}/${code}: ${en}`);
    }
  }
  assert.deepEqual(leftovers, []);
});

/*
 * A mag felől: hol maradhat magyar mondat.
 *
 * - Fejlesztői hibák: a felületre nem jutnak ki (belső invariáns, kalibrációs
 *   fájlok betöltése), ezért magyarul maradnak.
 * - Az írott minta és a szemnevek a JELÖLÉS nyelvét követik (PQW-868), nem a
 *   felületét: a szókészletük nem fordul a felülettel.
 * - A generátorok nevei a minta CÍMÉBE és a darab nevébe kerülnek, tehát a
 *   mentett fájl adatai; a felület a listákhoz a saját szótárát használja.
 */
const CORE_EXCEPTIONS = new Set([
  'gauge-profile.ts', // kalibrációs fájlok betöltése, a felület nem importálja
  'finished-size.ts', // RangeError, csak teszt hívja
  'pattern-size.ts', // RangeError, belső invariáns
  'pattern-text.ts', // az írott minta szókészlete: a jelölés nyelve
  'garment-text.ts', // ugyanaz, ruhadarabra
  'stitchText.ts', // ugyanaz: a szem leírása az írott mintában, nyelvenként
  'hungarian.ts', // magyar nyelvtani segédek az írott mintához
  'stitches.ts', // szemnevek nyelvenként
  'stitch-library.ts',
  'tradition.ts',
  'hook-sizes.ts', // forrásmegjelölés, nem jut a képernyőre
  'insertion.ts', // a felület saját szótárat használ (PQW-900)
  'rules.ts', // az ellenőrző szövegei: src/ui/i18n/rules.ts (PQW-900)
  'body-sizes.ts', // méretnevek: a felület a locale-lal kéri (hatSizeName, bodySizeName)
  // A visszaolvasó hibái ma nem jutnak a képernyőre: a `src/ui/` egyetlen fájlja
  // sem importálja a `pattern-read.ts`-t. Ha a visszaolvasás felületet kap, a
  // `ReadFailure` üzenetei is kóddá és adattá válnak (PQW-904 folytatása).
  'pattern-read.ts',
]);

/**
 * A `*_NAMES` táblák sorai kimaradnak: a generátorok nevei a minta CÍMÉBE és a
 * darab nevébe kerülnek, tehát a mentett fájl adatai, nem felületi feliratok (a
 * listákhoz a felület a saját szótárát használja). Egész fájlt nem engedünk el
 * miattuk, hogy ugyanabban a fájlban egy új magyar MONDAT feltűnjön.
 */
function withoutNameTables(source) {
  const rows = [];
  let inNames = false;
  let depth = 0;
  for (const [index, line] of source.split('\n').entries()) {
    if (!inNames && /(const|readonly)\s+[A-Z][A-Z0-9_]*NAMES?\b[^=]*=/.test(line)) {
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

test('a mag felhasználói fájljaiban nem marad magyar mondat', () => {
  const offenders = [];
  for (const name of readdirSync(new URL('../src/core/', import.meta.url))) {
    if (!name.endsWith('.ts') || CORE_EXCEPTIONS.has(name)) continue;
    const source = read(`src/core/${name}`);
    for (const [number, line] of withoutNameTables(source)) {
      if (/^\s*(\*|\/\/|\/\*)/.test(line)) continue; // megjegyzés, egysoros és blokk is
      const code = line.replace(/\/\/.*$/, '');
      // A dobott hibák a fejlesztőnek szólnak, nem a felhasználónak.
      if (/throw new (Error|RangeError|TypeError)/.test(code)) continue;
      // A minta ADATAI magyarul maradnak: az alapértelmezett cím a mentett
      // fájlba, a darabok és szakaszok neve az írott mintába kerül, tehát a
      // jelölés nyelvéhez tartoznak, nem a felülethez.
      if (/DEFAULT_TITLE|title = '|\bname: '/.test(code)) continue;
      const literals = code.match(/'[^']*'|`[^`]*`/g) ?? [];
      if (literals.some((literal) => HUNGARIAN.test(literal))) {
        offenders.push(`src/core/${name}:${number}: ${line.trim()}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `magyar mondat maradt a magban:\n${offenders.join('\n')}`);
});
