/*
 * A tervező fejlécei és feje (PQW-853): a noindex (nofollow nélkül) az
 * .htaccess-ben és a buildelt kimenetben, a robots.txt nem tiltja a bejárást,
 * és a fejben ott a magyar leírás, a meta robots, a saját favicon és a
 * design token színével egyező theme-color.
 */

import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const HTACCESS = read('public/.htaccess');
const INDEX = read('index.html');
const HEAD = /<head>([\s\S]*?)<\/head>/.exec(INDEX)?.[1] ?? '';

/** Az aktív (nem kommentelt) `Header ... set <név> "<érték>"` sor értéke. */
function headerValue(htaccess, name) {
  const line = htaccess.split('\n').find((candidate) => new RegExp(`^\\s*Header\\s+(always\\s+)?set\\s+${name}\\s`).test(candidate));
  return line ? /"([^"]*)"/.exec(line)?.[1] : undefined;
}

/** Egy meta elem `content` értéke a fejben. */
function meta(name) {
  const tag = HEAD.match(new RegExp(`<meta\\s[^>]*name="${name}"[^>]*>`, 's'))?.[0];
  return tag ? /content="([^"]*)"/.exec(tag)?.[1] : undefined;
}

test('az X-Robots-Tag noindex, nofollow nélkül', () => {
  assert.equal(headerValue(HTACCESS, 'X-Robots-Tag'), 'noindex');
});

test('a buildelt kimenet .htaccess-e ugyanezt küldi', () => {
  const built = new URL('../dist/.htaccess', import.meta.url);
  assert.ok(existsSync(built), 'Nincs dist/ — előbb futtasd a `npm run build`-ot.');
  assert.equal(headerValue(readFileSync(built, 'utf8'), 'X-Robots-Tag'), 'noindex');
});

test('a robots.txt, ha van, nem tiltja a bejárást (különben a noindex nem látszana)', () => {
  const robots = new URL('../public/robots.txt', import.meta.url);
  if (!existsSync(robots)) return;
  assert.doesNotMatch(readFileSync(robots, 'utf8'), /^\s*Disallow:\s*\S/im);
});

test('a fejben magyar leírás és meta robots noindex; a dokumentum nyelve magyar', () => {
  assert.match(INDEX, /<html lang="hu">/);
  const description = meta('description');
  assert.ok(description && description.length >= 50 && description.length <= 160, description);
  assert.match(description, /mintatervező/i);
  assert.equal(meta('robots'), 'noindex');
});

test('saját favicon és apple-touch-icon, külső hivatkozás nélkül; a fájlok a public/-ban', () => {
  const links = [...HEAD.matchAll(/<link\s[^>]*rel="(icon|apple-touch-icon)"[^>]*>/g)].map((match) => ({ rel: match[1], href: /href="([^"]*)"/.exec(match[0])?.[1] }));
  assert.deepEqual(links.map((link) => link.rel).sort(), ['apple-touch-icon', 'icon']);
  for (const { href } of links) {
    assert.match(href, /^\/[\w.-]+$/, `${href}: saját származású, relatív út`);
    assert.ok(existsSync(new URL(`../public${href}`, import.meta.url)), `${href} hiányzik a public/-ból`);
  }
});

test('a theme-color a --c-bg design token értéke', () => {
  const token = /--c-bg:\s*(#[0-9a-f]{6})/i.exec(read('src/ui/styles.css'))?.[1];
  assert.ok(token, 'nincs --c-bg token');
  assert.equal(meta('theme-color')?.toLowerCase(), token.toLowerCase());
});
