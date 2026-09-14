/*
 * A mag böngésző nélkül fut, ezért csak a saját mappájából importálhat.
 * A DOM-globálisok (document, window, canvas) használatát a
 * tsconfig.core.json fogja meg az `npm run check`-ben.
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

test('a src/core/ nem üres', () => {
  assert.ok(coreFiles().length > 0);
});

test('a src/core/ csak a saját mappájából importál', () => {
  for (const file of coreFiles()) {
    const fileUrl = new URL(file, CORE);
    const source = readFileSync(fileUrl, 'utf8');

    for (const [, from, bare] of source.matchAll(IMPORT_SPECIFIER)) {
      const specifier = from ?? bare;
      const staysInCore = specifier.startsWith('.') && new URL(specifier, fileUrl).href.startsWith(CORE.href);
      assert.ok(staysInCore, `src/core/${file}: a magon kívülről importál: ${specifier}`);
    }
  }
});
