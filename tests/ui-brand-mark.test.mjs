/*
 * The D6 dragonfly mark (PQW-922): the favicon and the menu-bar brand mark are
 * the same approved drawing in the brand palette colours; the icon files have
 * the required sizes; the mark is decorative and the name stays as text; the
 * contrast does not degrade.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url));
const INDEX = read('index.html').toString('utf8');
const FAVICON = read('public/favicon.svg').toString('utf8');
const CSS = read('src/ui/styles.css').toString('utf8');
const ROOT = CSS.match(/:root\s*\{([\s\S]*?)\n\}/)[1];

/** The value of one design token from :root. */
function token(name) {
  const match = ROOT.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'));
  assert.ok(match, `missing token: --${name}`);
  return match[1].toLowerCase();
}

/** Shape geometry (element name and its attributes other than colour), in order. */
function shapes(svg) {
  return [...svg.matchAll(/<(ellipse|circle)\s([^>]*?)\/?>/g)].map(([, tag, attrs]) => {
    const pairs = [...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].filter(([, name]) => !['fill', 'class'].includes(name));
    return `${tag} ${pairs.map(([, name, value]) => `${name}=${value}`).sort().join(' ')}`;
  });
}

/** Shape fill colours, in order. */
function fills(svg) {
  return [...svg.matchAll(/<(?:ellipse|circle)\s[^>]*fill="([^"]*)"/g)].map(([, fill]) => fill.toLowerCase());
}

const MARK = /<svg class="brand-mark"[\s\S]*?<\/svg>/.exec(INDEX)?.[0] ?? '';

/** PNG width and height from the IHDR block. */
function pngSize(buffer) {
  assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG', 'not a PNG');
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

test('favicon.svg is the approved D6 drawing in the brand palette colours', () => {
  assert.equal(shapes(FAVICON).length, 9);
  assert.deepEqual(fills(FAVICON), ['#c5b2e4', '#c5b2e4', '#8a6fb8', '#8a6fb8', '#241f2b', '#241f2b', '#241f2b', '#fdfbf8', '#fdfbf8']);
  assert.match(FAVICON, /viewBox="40 36 120 120"/);
});

test('the menu-bar brand mark uses the same drawing and crop as the favicon', () => {
  assert.ok(MARK, 'no .brand-mark in the menu bar');
  assert.deepEqual(shapes(MARK), shapes(FAVICON));
  assert.equal(/viewBox="([^"]*)"/.exec(MARK)?.[1], /viewBox="([^"]*)"/.exec(FAVICON)?.[1]);
});

test('the brand mark is decorative and the name stays as text beside it', () => {
  assert.match(MARK, /aria-hidden="true"/);
  assert.match(MARK, /focusable="false"/);
  assert.match(INDEX, /<\/svg>\s*<h1 class="bar__title" data-i18n="barTitle">Mintatervező<\/h1>/);
});

test('the brand mark colours come from the design tokens and match the palette', () => {
  assert.equal(token('c-ink'), '#241f2b');
  assert.equal(token('c-accent'), '#6e5a92');
  assert.equal(token('c-bg'), '#faf7f3');
  assert.equal(token('c-brand-wing'), '#c5b2e4');
  assert.equal(token('c-brand-wing-inner'), '#8a6fb8');
  assert.equal(token('c-brand-eye'), '#fdfbf8');
  for (const [part, name] of [['wing', 'c-brand-wing'], ['wing-inner', 'c-brand-wing-inner'], ['body', 'c-ink'], ['eye', 'c-brand-eye']]) {
    assert.match(CSS, new RegExp(`\\.brand-mark__${part}\\s*\\{\\s*fill:\\s*var\\(--${name}\\);`), part);
  }
});

test('icon file sizes: a 32 px ICO holding a PNG, and a 180 px apple-touch-icon', () => {
  const ico = read('public/favicon.ico');
  assert.equal(ico.readUInt16LE(2), 1, 'not an icon file');
  assert.equal(ico.readUInt16LE(4), 1, 'exactly one image expected');
  const offset = ico.readUInt32LE(18);
  assert.deepEqual(pngSize(ico.subarray(offset)), [32, 32]);
  assert.deepEqual(pngSize(read('public/apple-touch-icon.png')), [180, 180]);
});
