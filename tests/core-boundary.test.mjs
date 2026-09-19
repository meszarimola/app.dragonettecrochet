/*
 * The core runs without a browser, so it may only pull in modules that live in
 * its own folder. Use of the DOM globals (document, window, canvas) is caught
 * by tsconfig.core.json during `npm run check`.
 */

import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const CORE = new URL('../src/core/', import.meta.url);

const IMPORT_SPECIFIER =
  /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(?\s*['"]([^'"]+)['"]/g;

function coreFiles() {
  return readdirSync(CORE, { recursive: true }).filter((file) => file.endsWith('.ts'));
}

test('src/core/ is not empty', () => {
  assert.ok(coreFiles().length > 0);
});

test('src/core/ only pulls in modules within its own folder', () => {
  for (const file of coreFiles()) {
    const fileUrl = new URL(file, CORE);
    const source = readFileSync(fileUrl, 'utf8');

    for (const [, from, bare] of source.matchAll(IMPORT_SPECIFIER)) {
      const specifier = from ?? bare;
      const staysInCore = specifier.startsWith('.') && new URL(specifier, fileUrl).href.startsWith(CORE.href);
      assert.ok(staysInCore, `src/core/${file}: reaches outside the core: ${specifier}`);
    }
  }
});
