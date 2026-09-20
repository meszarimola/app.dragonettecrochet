/*
 * Locator inventory (PQW-978): machine guard for the frozen product strings of the browser tests.
 *
 * `.claude/rules/frozen-paths.md` freezes every locator argument and expected
 * value under e2e/, but until now that was a reviewer's judgement: someone had
 * to decide whether a change to a spec moved product text or only the
 * navigation leading to it. The redesign inserts a navigation call into many
 * specs at once, which is exactly the change that judgement scales worst on.
 *
 * So: collect the multiset of string literals handed to the calls that drive or
 * assert the interface, and freeze it. A navigation line added to twenty specs
 * leaves the fixture byte-identical; an invented selector or a reworded
 * expectation changes it, and tests/fixtures/ is gated by .githooks/pre-commit.
 *
 * The sources are read as raw text, the way `markupUses()` of ui-i18n.test.mjs
 * reads index.html — no AST.
 */

import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const FIXTURE = JSON.parse(read('tests/fixtures/e2e-locators.json'));

/** The calls whose arguments are interface text: what a test drives, and what it expects to see. */
const DRIVING_CALLS = [
  'locator',
  'getByRole',
  'getByText',
  'getByLabel',
  'fill',
  'selectOption',
  'toHaveText',
  'toContainText',
  'toHaveValue',
  'toHaveAttribute',
];

/** After these, a `/` opens a regular expression rather than dividing. */
const BEFORE_A_REGEX = new Set(['(', ',', ':', '[', '{', '=', '!', '&', '|', '?', '+', ';']);

const endOfString = (source, start, quote) => {
  for (let i = start + 1; i < source.length; i += 1) {
    if (source[i] === '\\') i += 1;
    else if (source[i] === quote) return i;
  }
  throw new Error(`unterminated literal at ${start}`);
};

const endOfRegex = (source, start) => {
  for (let i = start + 1; i < source.length; i += 1) {
    if (source[i] === '\\') i += 1;
    else if (source[i] === '[') while (i < source.length && source[i] !== ']') i += source[i] === '\\' ? 2 : 1;
    else if (source[i] === '/') {
      let end = i + 1;
      while (/[a-z]/.test(source[end] ?? '')) end += 1;
      return end;
    }
  }
  throw new Error(`unterminated regular expression at ${start}`);
};

/**
 * The literals of one argument list, from just after its `(`. Only the literals of the call itself are read: a nested
 * call sits one parenthesis deeper and is collected at its own site instead, while an options object is transparent,
 * so the `name` of `getByRole('button', { name: 'Fordulás' })` comes out beside the role. A string yields its text, a
 * regular expression its source with the slashes, which is what keeps it comparable.
 */
function argumentLiterals(source, start) {
  const literals = [];
  let depth = 0;
  let previous = '(';
  for (let i = start; i < source.length; i += 1) {
    const character = source[i];
    if (/\s/.test(character)) continue;
    if (character === ')' && depth === 0) return literals;
    if (character === '(') depth += 1;
    else if (character === ')') depth -= 1;
    else if (character === "'" || character === '"' || character === '`') {
      const end = endOfString(source, i, character);
      if (depth === 0) literals.push(source.slice(i + 1, end));
      i = end;
    } else if (character === '/' && BEFORE_A_REGEX.has(previous)) {
      const end = endOfRegex(source, i);
      if (depth === 0) literals.push(source.slice(i, end));
      i = end - 1;
    }
    previous = character;
  }
  throw new Error(`unbalanced argument list at ${start}`);
}

/** The literals of one source, counted per call: `{ getByRole: { button: 168, Fordulás: 15 } }`. */
function callLiterals(source, into = {}) {
  const calls = new RegExp(`\\b(${DRIVING_CALLS.join('|')})\\(`, 'g');
  for (const match of source.matchAll(calls)) {
    const name = match[1];
    if (into[name] === undefined) into[name] = {};
    const counts = into[name];
    for (const literal of argumentLiterals(source, match.index + match[0].length)) {
      counts[literal] = (counts[literal] ?? 0) + 1;
    }
  }
  return into;
}

/** Every file of e2e/ and e2e-prod/, in a stable order. */
function specFiles() {
  const files = (directory) =>
    readdirSync(directory).flatMap((name) => {
      const entry = new URL(`${directory.href}/${name}`);
      return statSync(entry).isDirectory() ? files(entry) : [entry];
    });
  return [...files(new URL('../e2e', import.meta.url)), ...files(new URL('../e2e-prod', import.meta.url))].sort(
    (a, b) => (a.pathname < b.pathname ? -1 : 1),
  );
}

/** The inventory of the whole browser suite. */
function inventory() {
  const found = {};
  for (const file of specFiles()) callLiterals(readFileSync(file, 'utf8'), found);
  return found;
}

test('the browser suite drives and asserts the frozen product strings', () => {
  const files = specFiles();
  assert.ok(files.length > 30, `too few spec files: ${files.length}`);
  const actual = inventory();
  assert.deepEqual(Object.keys(actual).sort(), [...DRIVING_CALLS].sort(), 'a call is missing from the suite');
  assert.ok(Object.keys(actual.locator).length > 150, `too few selectors: ${Object.keys(actual.locator).length}`);
  // One line per literal first: on a failure that prints the few lines that moved, where two nested objects print whole.
  const lines = (bag) =>
    Object.entries(bag)
      .flatMap(([name, counts]) => Object.entries(counts).map(([literal, times]) => `${name} ${literal} ×${times}`))
      .sort();
  assert.deepEqual(lines(actual), lines(FIXTURE), 'a driven or asserted product string changed');
  assert.deepEqual(actual, FIXTURE);
});

test('the reading covers the plain, the options-object and the regular-expression forms', () => {
  const sample = [
    "await page.locator('#chain-count').fill('12');",
    "await page.getByRole('button', { name: 'Fordulás' }).click();",
    "await expect(page.locator('#count')).toHaveText(/Láncszem \\(lsz\\)/);",
    "await expect(page.locator('#row', { has: page.locator('li') })).toContainText('3 szem');",
  ].join('\n');
  assert.deepEqual(callLiterals(sample), {
    locator: { '#chain-count': 1, '#count': 1, '#row': 1, li: 1 },
    fill: { 12: 1 },
    getByRole: { button: 1, Fordulás: 1 },
    toHaveText: { '/Láncszem \\(lsz\\)/': 1 },
    toContainText: { '3 szem': 1 },
  });
});
