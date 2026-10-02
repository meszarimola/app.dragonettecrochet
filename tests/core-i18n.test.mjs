/*
 * The core returns codes and data, never sentences (PQW-904): no Hungarian
 * sentence should be left in the core files. Whatever we keep in Hungarian on
 * purpose (the stitch names, per language) is listed by name among the
 * exceptions — so a new Hungarian sentence stands out while the old ones stay
 * quiet.
 */

import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const HUNGARIAN = /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/;
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const CORE_EXCEPTIONS = new Set([
  'stitchText.ts', // the stitch description, per language
  'stitches.ts', // stitch names, per language
]);

test('no Hungarian sentence is left in the core files that face the user', () => {
  const offenders = [];
  for (const name of readdirSync(new URL('../src/core/', import.meta.url))) {
    if (!name.endsWith('.ts') || CORE_EXCEPTIONS.has(name)) continue;
    const source = read(`src/core/${name}`);
    for (const [index, line] of source.split('\n').entries()) {
      if (/^\s*(\*|\/\/|\/\*)/.test(line)) continue; // a comment, single-line or block
      const code = line.replace(/\/\/.*$/, '');
      // Thrown errors speak to the developer, not to the user.
      if (/throw new (Error|RangeError|TypeError)/.test(code)) continue;
      const literals = code.match(/'[^']*'|`[^`]*`/g) ?? [];
      if (literals.some((literal) => HUNGARIAN.test(literal))) {
        offenders.push(`src/core/${name}:${index + 1}: ${line.trim()}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `a Hungarian sentence was left in the core:\n${offenders.join('\n')}`);
});

test('the check spots a Hungarian literal', () => {
  const line = "  return 'Szép munka';";
  const literals = line.match(/'[^']*'|`[^`]*`/g) ?? [];
  assert.ok(literals.some((literal) => HUNGARIAN.test(literal)));
});
