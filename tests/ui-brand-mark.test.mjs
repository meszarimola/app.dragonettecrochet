/*
 * A D6 szitakötő-jel (PQW-922): a favicon és a menüsor márkajele ugyanaz a
 * jóváhagyott rajz, a márkapaletta színeivel; az ikonfájlok a megadott
 * méretűek; a jel díszítő elem, a név szövegként marad; a kontraszt nem romlik.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url));
const INDEX = read('index.html').toString('utf8');
const FAVICON = read('public/favicon.svg').toString('utf8');
const CSS = read('src/ui/styles.css').toString('utf8');
const ROOT = CSS.match(/:root\s*\{([\s\S]*?)\n\}/)[1];

/** Egy design token értéke a :root-ból. */
function token(name) {
  const match = ROOT.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'));
  assert.ok(match, `hiányzó token: --${name}`);
  return match[1].toLowerCase();
}

/** Az alakzatok geometriája (elem neve és a színen kívüli attribútumai), sorrendben. */
function shapes(svg) {
  return [...svg.matchAll(/<(ellipse|circle)\s([^>]*?)\/?>/g)].map(([, tag, attrs]) => {
    const pairs = [...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].filter(([, name]) => !['fill', 'class'].includes(name));
    return `${tag} ${pairs.map(([, name, value]) => `${name}=${value}`).sort().join(' ')}`;
  });
}

/** Az alakzatok kitöltőszíne, sorrendben. */
function fills(svg) {
  return [...svg.matchAll(/<(?:ellipse|circle)\s[^>]*fill="([^"]*)"/g)].map(([, fill]) => fill.toLowerCase());
}

const MARK = /<svg class="brand-mark"[\s\S]*?<\/svg>/.exec(INDEX)?.[0] ?? '';

/** A PNG szélessége és magassága az IHDR blokkból. */
function pngSize(buffer) {
  assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG', 'nem PNG');
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

test('a favicon.svg a jóváhagyott D6 rajz, a márkapaletta színeivel', () => {
  assert.equal(shapes(FAVICON).length, 9);
  assert.deepEqual(fills(FAVICON), ['#c5b2e4', '#c5b2e4', '#8a6fb8', '#8a6fb8', '#241f2b', '#241f2b', '#241f2b', '#fdfbf8', '#fdfbf8']);
  assert.match(FAVICON, /viewBox="40 36 120 120"/);
});

test('a menüsor márkajele ugyanaz a rajz és kivágás, mint a favicon', () => {
  assert.ok(MARK, 'nincs .brand-mark a menüsorban');
  assert.deepEqual(shapes(MARK), shapes(FAVICON));
  assert.equal(/viewBox="([^"]*)"/.exec(MARK)?.[1], /viewBox="([^"]*)"/.exec(FAVICON)?.[1]);
});

test('a márkajel díszítő elem, és a név szövegként marad mellette', () => {
  assert.match(MARK, /aria-hidden="true"/);
  assert.match(MARK, /focusable="false"/);
  assert.match(INDEX, /<\/svg>\s*<h1 class="bar__title" data-i18n="barTitle">Mintatervező<\/h1>/);
});

test('a márkajel színei a design tokenekből jönnek, és a palettával egyeznek', () => {
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

test('az ikonfájlok mérete: 32 px-es ICO (PNG-vel), 180 px-es apple-touch-icon', () => {
  const ico = read('public/favicon.ico');
  assert.equal(ico.readUInt16LE(2), 1, 'nem ikon');
  assert.equal(ico.readUInt16LE(4), 1, 'egy kép kell');
  const offset = ico.readUInt32LE(18);
  assert.deepEqual(pngSize(ico.subarray(offset)), [32, 32]);
  assert.deepEqual(pngSize(read('public/apple-touch-icon.png')), [180, 180]);
});
