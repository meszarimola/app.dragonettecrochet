/*
 * The running version (PQW-903): the number shown in the interface is the
 * `package.json` version, baked in at build time (`vite.config.ts` `define`),
 * and no hand-written version number exists in the HTML or in the source.
 */

import { strict as assert } from 'node:assert';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

import config from '../vite.config.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const pkg = JSON.parse(read('package.json'));

test('the version constant is the package.json version', () => {
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  assert.equal(config.define.__APP_VERSION__, JSON.stringify(pkg.version));
});

test('the HTML holds the slot for the label but not the number: the build bakes that in', () => {
  const index = read('index.html');
  assert.match(index, /id="version"/);
  assert.match(index, /aria-hidden="true"/);
  assert.equal(/v\d+\.\d+\.\d+/.test(index), false, 'the version comes from the build, not from the HTML');
  assert.match(read('src/ui/main.ts'), /__APP_VERSION__/);
});

test('the built output has the version baked in', () => {
  const assets = new URL('../dist/assets/', import.meta.url);
  assert.ok(existsSync(assets), 'No dist/ — run `npm run build` first.');
  const bundles = readdirSync(assets).filter((name) => name.endsWith('.js'));
  assert.ok(bundles.length > 0, 'no built JS');
  const found = bundles.some((name) => readFileSync(new URL(name, assets), 'utf8').includes(pkg.version));
  assert.ok(found, `version ${pkg.version} is not in the built code`);
});
