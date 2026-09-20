/*
 * Control inventory (PQW-977): machine proof that a rearrangement loses no control.
 *
 * The redesign moves controls from one section to another. Nothing proves today
 * that such a move did not drop a field: `must<T>()` throws only at run time on
 * a missing element, and the production smoke suite demands zero console errors,
 * so an orphaned identifier would surface on the live page first.
 *
 * The inventory therefore records every control of index.html as a stable
 * triple and compares it sorted, so neither document order nor nesting is
 * asserted: moving a node passes, deleting or renaming one fails.
 *
 * index.html is read as raw text, the way `markupUses()` of ui-i18n.test.mjs
 * reads it.
 */

import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const INDEX = read('index.html');
const INVENTORY = JSON.parse(read('tests/fixtures/control-inventory.json'));

/**
 * Identifiers of index.html that neither the interface code nor a markup
 * reference addresses. They are the three always-visible `details` sections,
 * reached only by e2e selectors. PQW-960 owns dead interface; this list records
 * what is already unreferenced, it does not license new cases.
 */
const UNREFERENCED = ['section-notation', 'section-pattern', 'section-stitches'];

const order = (control) => `${control.id} ${control.tag} ${control.type}`;
const sorted = (controls) =>
  [...controls].sort((a, b) => {
    const [left, right] = [order(a), order(b)];
    return left < right ? -1 : left > right ? 1 : 0;
  });

/** Every control of index.html as `{ id, tag, type }`, in a canonical order. */
function controls() {
  const found = [];
  for (const match of INDEX.matchAll(/<(input|select|button|textarea|fieldset|details)\b([^>]*)>/g)) {
    const [, tag, attributes] = match;
    found.push({
      id: /\sid="([^"]*)"/.exec(attributes)?.[1] ?? '',
      tag,
      type: /\stype="([^"]*)"/.exec(attributes)?.[1] ?? '',
    });
  }
  return sorted(found);
}

/** The identifiers one element of index.html points at from another: `for`, `aria-controls`, `aria-describedby`. */
function markupReferences() {
  const targets = new Set();
  for (const match of INDEX.matchAll(/\s(?:for|aria-controls|aria-describedby)="([^"]*)"/g)) {
    for (const target of match[1].split(/\s+/)) targets.add(target);
  }
  return targets;
}

/** Every TypeScript source of src/ui/, concatenated. */
function interfaceSources() {
  const files = (directory) =>
    readdirSync(directory).flatMap((name) => {
      const entry = new URL(`${directory.href}/${name}`);
      return statSync(entry).isDirectory() ? files(entry) : [entry];
    });
  return files(new URL('../src/ui', import.meta.url))
    .filter((entry) => entry.pathname.endsWith('.ts'))
    .map((entry) => readFileSync(entry, 'utf8'))
    .join('\n');
}

/** A `must('#id')`, a `field('id')` or any other quoted mention of the identifier. */
const referenced = (sources, id) =>
  [`'${id}'`, `"${id}"`, `\`${id}\``, `'#${id}'`, `"#${id}"`, `\`#${id}\``].some((form) => sources.includes(form));

test('index.html holds the frozen set of controls, whatever their order and their nesting', () => {
  const actual = controls();
  assert.ok(actual.length > 200, `too few controls: ${actual.length}`);
  const identifiers = (inventory) => inventory.map((control) => control.id).filter((id) => id.length > 0);
  assert.deepEqual(identifiers(actual), identifiers(sorted(INVENTORY)), 'identifier deleted, renamed or added');
  assert.deepEqual(actual, sorted(INVENTORY));
});

test('every inventoried identifier is reachable from the interface code or from a markup reference', () => {
  const sources = interfaceSources();
  const targets = markupReferences();
  const orphans = controls()
    .map((control) => control.id)
    .filter((id) => id.length > 0 && !UNREFERENCED.includes(id))
    .filter((id) => !referenced(sources, id) && !targets.has(id));
  assert.deepEqual(orphans, [], 'identifier nothing reaches any more');
});

test('the exception list stays honest: each entry is still an unreferenced control of index.html', () => {
  const sources = interfaceSources();
  const targets = markupReferences();
  const inventoried = new Set(controls().map((control) => control.id));
  const stale = UNREFERENCED.filter((id) => !inventoried.has(id) || referenced(sources, id) || targets.has(id));
  assert.deepEqual(stale, [], 'exception no longer needed — remove it from UNREFERENCED');
});
