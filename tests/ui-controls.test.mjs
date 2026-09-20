/*
 * Control inventory (PQW-977): machine proof that a rearrangement loses no control.
 *
 * The redesign moves controls from one section to another. Nothing proves today
 * that such a move did not drop a field: `must<T>()` throws only at run time on
 * a missing element, and the production smoke suite demands zero console errors,
 * so an orphaned identifier would surface on the live page first.
 *
 * The inventory therefore records every control of index.html as a stable key
 * and compares it sorted, so neither document order nor nesting is asserted:
 * moving a node passes, deleting or renaming one fails. The key is the
 * identifier, and for the toolbar and the alignment rows — which carry none —
 * the attribute the interface addresses them by, `[data-action="fan"]` and its
 * kind. Six controls carry neither: four layout `fieldset`s, the `amigurumi`
 * one and the keyboard-shortcut `details`. Those the inventory counts.
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

/** The attributes src/ui/ addresses a control by when it has no identifier. Their selectors are asserted below. */
const ADDRESSING_ATTRIBUTES = [
  'data-action',
  'data-align',
  'data-arrange',
  'data-consent',
  'data-consent-open',
  'data-distribute',
  'data-nudge',
  'data-row-align',
];

/**
 * Of those, the one whose values the interface names one by one — as a key of its action record, or in a
 * `[data-action="…"]` selector. The others it reads through `dataset` and forwards: the nudge value is a pair of
 * coordinates split on the comma, the alignment and arrangement modes go to the core as they stand. For those the
 * value is data, not a name, so only the attribute itself is asserted to be addressed.
 */
const NAMED_VALUES = ['data-action'];

const order = (control) => `${control.id} ${control.attr ?? ''} ${control.value ?? ''} ${control.tag} ${control.type}`;
const sorted = (controls) =>
  [...controls].sort((a, b) => {
    const [left, right] = [order(a), order(b)];
    return left < right ? -1 : left > right ? 1 : 0;
  });

/** Every control of index.html as `{ id, tag, type }`, widened with `{ attr, value }` where one addresses it. */
function controls() {
  const found = [];
  for (const match of INDEX.matchAll(/<(input|select|button|textarea|fieldset|details)\b([^>]*)>/g)) {
    const [, tag, attributes] = match;
    const control = {
      id: /\sid="([^"]*)"/.exec(attributes)?.[1] ?? '',
      tag,
      type: /\stype="([^"]*)"/.exec(attributes)?.[1] ?? '',
    };
    for (const attribute of ADDRESSING_ATTRIBUTES) {
      const written = new RegExp(`\\s${attribute}(?:="([^"]*)")?(?=[\\s/>])`).exec(attributes);
      if (written) {
        control.attr = attribute;
        control.value = written[1] ?? '';
        break;
      }
    }
    found.push(control);
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

/**
 * The two ways src/ui/ addresses an element: a `#id` selector handed to `must()` or `querySelector()`, and the bare
 * identifier handed to a `field()` or `find()` lookup. A plain quoted occurrence is not enough — `'summary'` and
 * `'insertion'` stand in the sources for other reasons, and would vouch for an element nothing reaches any more.
 */
const referenced = (sources, id) =>
  [`'#${id}'`, `"#${id}"`, `\`#${id}\``].some((form) => sources.includes(form)) ||
  new RegExp(`\\b(?:field|find)(?:<[^<>()]*>)?\\(['"\`]${id}['"\`]\\)`).test(sources);

/** A `[data-action="fan"]` selector, or the value standing as a key of the record the click dispatch looks it up in. */
const named = (sources, control) =>
  sources.includes(`[${control.attr}="${control.value}"]`) ||
  new RegExp(`(^|[\\s{,])(${control.value}|'${control.value}')\\s*:`, 'm').test(sources);

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

test('every control addressed by an attribute rather than by an identifier is reachable too', () => {
  const sources = interfaceSources();
  const keyed = controls().filter((control) => control.attr !== undefined);
  assert.ok(keyed.length > 40, `too few attribute-keyed controls: ${keyed.length}`);
  const unaddressed = ADDRESSING_ATTRIBUTES.filter((attribute) => !sources.includes(`[${attribute}`));
  assert.deepEqual(unaddressed, [], 'attribute no selector of src/ui/ uses any more');
  const orphans = keyed
    .filter((control) => NAMED_VALUES.includes(control.attr) && !named(sources, control))
    .map((control) => `[${control.attr}="${control.value}"]`);
  assert.deepEqual(orphans, [], 'value nothing names any more');
});

test('the exception list stays honest: each entry is still an unreferenced control of index.html', () => {
  const sources = interfaceSources();
  const targets = markupReferences();
  const inventoried = new Set(controls().map((control) => control.id));
  const stale = UNREFERENCED.filter((id) => !inventoried.has(id) || referenced(sources, id) || targets.has(id));
  assert.deepEqual(stale, [], 'exception no longer needed — remove it from UNREFERENCED');
});
