/*
 * Rewrites `tests/fixtures/e2e-locators.json` from the browser suite as it
 * stands. The fixture is a frozen path, so run this only when the product
 * strings really did move — a language migration, say — and read the diff.
 *
 * KB: testing.md §2
 */

import { writeFileSync } from 'node:fs';

import { inventory } from '../tests/e2e-locators.mjs';

/** Keys sorted at both levels, so a regeneration diffs as the strings that moved and nothing else. */
function canonical(bag) {
  return Object.fromEntries(
    Object.entries(bag)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([name, counts]) => [name, Object.fromEntries(Object.entries(counts).sort(([a], [b]) => (a < b ? -1 : 1)))]),
  );
}

const target = new URL('../tests/fixtures/e2e-locators.json', import.meta.url);
writeFileSync(target, `${JSON.stringify(canonical(inventory()), null, 2)}\n`);
console.log(`wrote ${target.pathname}`);
