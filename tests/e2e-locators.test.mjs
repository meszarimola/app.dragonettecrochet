/*
 * Locator inventory (PQW-978): machine guard for the frozen product strings of
 * the browser tests. The reading itself lives in `tests/e2e-locators.mjs`, so
 * `scripts/freeze-e2e-locators.mjs` can regenerate the fixture from exactly the
 * same code the guard compares against — a hand-maintained fixture was the one
 * part of this guard nobody could update without guessing (PQW-1100).
 *
 * What the reading does and does not see is documented in that module.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { callLiterals, inventory, specFiles } from './e2e-locators.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const FIXTURE = JSON.parse(read('tests/fixtures/e2e-locators.json'));

test('the browser suite drives and asserts the frozen product strings', () => {
  const files = specFiles();
  assert.ok(files.length > 30, `too few spec files: ${files.length}`);
  const actual = inventory();
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
    "await page.locator('#key-list li').filter({ hasText: 'láncszem' }).click();",
    "const late = rows.filter((row) => row.kind === 'annotation');",
  ].join('\n');
  assert.deepEqual(callLiterals(sample), {
    locator: { '#chain-count': 1, '#count': 1, '#row': 1, li: 1, '#key-list li': 1 },
    fill: { 12: 1 },
    getByRole: { button: 1, Fordulás: 1 },
    toHaveText: { '/Láncszem \\(lsz\\)/': 1 },
    toContainText: { '3 szem': 1 },
    hasText: { láncszem: 1 },
  });
});

test('a comment neither adds a literal nor swallows the file', () => {
  const sample = [
    '// A prose line that names locator( and never closes it.',
    "await expect(page.locator('#status')).toContainText(",
    "  'Kész', // the wording is frozen",
    ');',
    '/* A block that mentions getByRole( too. */',
    "await page.locator('https://example.test//path');",
  ].join('\n');
  assert.deepEqual(callLiterals(sample), {
    locator: { '#status': 1, 'https://example.test//path': 1 },
    toContainText: { Kész: 1 },
  });
});

test('a literal handed to a local helper is collected at the helper call site, one hop', () => {
  const sample = [
    'const pick = async (page: Page, name: RegExp): Promise<void> => {',
    "  await page.locator('#palette').getByRole('button', { name }).first().click();",
    '};',
    'async function enter(page: Page, selector: string, value: string): Promise<void> {',
    '  await page.locator(selector).fill(value);',
    '}',
    'await pick(page, /Láncszem \\(lsz\\)/);',
    'await pick(page, /Rövidpálca \\(rp\\)/);',
    "await enter(page, '#chain-count', '12');",
  ].join('\n');
  assert.deepEqual(callLiterals(sample), {
    locator: { '#palette': 1, '#chain-count': 1 },
    getByRole: { button: 1, '/Láncszem \\(lsz\\)/': 1, '/Rövidpálca \\(rp\\)/': 1 },
    fill: { 12: 1 },
  });
});

test('a second hop is named rather than followed, and a parameter property is left alone', () => {
  const sample = [
    'async function enter(page: Page, selector: string, value: string): Promise<void> {',
    '  await page.locator(selector).fill(value);',
    '}',
    'async function ribbing(page: Page, rows: string): Promise<void> {',
    "  await enter(page, '#garment-ribbing-rows', rows);",
    '}',
    'async function generate(page: Page, choices: { shape: string }): Promise<void> {',
    "  await page.locator('#rounds-shape').selectOption({ label: choices.shape });",
    '}',
    "await ribbing(page, '2');",
    "await generate(page, { shape: 'Nagymama-négyzet' });",
  ].join('\n');
  assert.deepEqual(callLiterals(sample), {
    locator: { '#garment-ribbing-rows': 1, '#rounds-shape': 1 },
    '(second hop)': { 'ribbing(rows) -> enter': 1 },
  });
});

test('a helper call site is read by position, wherever it stands and whatever the other arguments look like', () => {
  // Each of these three shapes silently misread the call site before PQW-981's review: a comma inside an object or an
  // array opened a new argument, a call above a hoisted declaration was taken for the declaration itself, and a comma
  // inside a generic type added a parameter. All three moved the selector out from under the reading.
  const withSecond = (second) =>
    [
      'async function go(page: Page, first: Second, selector: string) {',
      '  await page.locator(selector).click();',
      '}',
      `await go(page, ${second}, '#real-selector');`,
    ].join('\n');
  assert.deepEqual(callLiterals(withSecond("{ a: 'AAA', b: 'BBB' }")), { locator: { '#real-selector': 1 } });
  assert.deepEqual(callLiterals(withSecond("['X', 'Y']")), { locator: { '#real-selector': 1 } });
  assert.deepEqual(
    callLiterals(
      [
        'async function go(page: Page, sizes: Record<string, number>, selector: string) {',
        '  await page.locator(selector).click();',
        '}',
        "await go(page, sizes, '#real-selector');",
      ].join('\n'),
    ),
    { locator: { '#real-selector': 1 } },
  );
  assert.deepEqual(
    callLiterals(
      [
        "await go(page, '#early-selector');",
        'async function go(page: Page, selector: string) {',
        '  await page.locator(selector).click();',
        '}',
        "await go(page, '#late-selector');",
      ].join('\n'),
    ),
    { locator: { '#early-selector': 1, '#late-selector': 1 } },
  );
});

test('two helpers of one name are named rather than resolved, and an expression is not a helper', () => {
  const twice = [
    'async function pick(page: Page, selector: string) { await page.locator(selector).click(); }',
    "await pick(page, '#one');",
    'async function pick(page: Page, selector: string) { await page.locator(selector).click(); }',
  ].join('\n');
  // Both definitions used to claim the one call site, so `#one` was frozen twice over.
  assert.deepEqual(callLiterals(twice), { '(repeated name)': { pick: 2 } });

  // `const items = (…)` is an expression. Reading it as a helper is how a repeated name arises unwritten.
  const expression = [
    "const group = (parsed.groups ?? [])[0] ?? { count: 0, rowId: '' };",
    'async function group(page: Page, selector: string) { await page.locator(selector).click(); }',
    "await group(page, '#real-selector');",
  ].join('\n');
  assert.deepEqual(callLiterals(expression), { locator: { '#real-selector': 1 } });
});
