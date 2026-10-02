/*
 * Control inventory (PQW-977): machine proof that a rearrangement loses no control.
 *
 * `must<T>()` throws only at run time on a missing element, so the inventory
 * records every control of index.html as a stable key and compares it sorted:
 * neither document order nor nesting is asserted, so moving a node passes,
 * deleting or renaming one fails. PQW-1141 cut the interface down to three
 * controls, and the inventory with it.
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

const order = (control) => `${control.id} ${control.tag} ${control.type}`;
const sorted = (controls) =>
  [...controls].sort((a, b) => {
    const [left, right] = [order(a), order(b)];
    return left < right ? -1 : left > right ? 1 : 0;
  });

/** Every control of index.html as `{ id, tag, type }`. */
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

test('index.html holds the frozen set of controls, whatever their order and their nesting', () => {
  const actual = controls();
  assert.ok(actual.length >= 3, `too few controls: ${actual.length}`);
  assert.deepEqual(actual, sorted(INVENTORY), 'control deleted, renamed or added');
});

test('every control has an identifier the interface code reaches', () => {
  const sources = interfaceSources();
  const orphans = controls()
    .map((control) => control.id)
    .filter((id) => id.length === 0 || ![`'#${id}'`, `"#${id}"`, `\`#${id}\``].some((form) => sources.includes(form)));
  assert.deepEqual(orphans, [], 'control nothing reaches');
});
