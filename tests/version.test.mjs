/*
 * A futó verzió (PQW-903): a felületen látszó szám a `package.json` verziója,
 * build időben beégetve (`vite.config.ts` `define`), és kézzel írt verziószám
 * sem a HTML-ben, sem a forrásban nincs.
 */

import { strict as assert } from 'node:assert';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

import config from '../vite.config.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const pkg = JSON.parse(read('package.json'));

test('a verzió-konstans a package.json verziója', () => {
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  assert.equal(config.define.__APP_VERSION__, JSON.stringify(pkg.version));
});

test('a felirat helye a HTML-ben van, a szám nem: azt a build égeti be', () => {
  const index = read('index.html');
  assert.match(index, /id="version"/);
  assert.match(index, /aria-hidden="true"/);
  assert.equal(/v\d+\.\d+\.\d+/.test(index), false, 'a verzió a buildből jön, nem a HTML-ből');
  assert.match(read('src/ui/main.ts'), /__APP_VERSION__/);
});

test('a buildelt kimenetben a verzió beégett', () => {
  const assets = new URL('../dist/assets/', import.meta.url);
  assert.ok(existsSync(assets), 'Nincs dist/ — előbb futtasd a `npm run build`-ot.');
  const bundles = readdirSync(assets).filter((name) => name.endsWith('.js'));
  assert.ok(bundles.length > 0, 'nincs buildelt JS');
  const found = bundles.some((name) => readFileSync(new URL(name, assets), 'utf8').includes(pkg.version));
  assert.ok(found, `a ${pkg.version} verzió nincs a buildelt kódban`);
});
