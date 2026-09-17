/*
 * A tervező fejlécei és feje (PQW-853, PQW-918): a gyökér indexelhető (se
 * X-Robots-Tag, se meta robots noindex), a robots.txt mindent enged, a fejben
 * a keresett kifejezésekkel írt cím és leírás, canonical, Open Graph,
 * SoftwareApplication JSON-LD, JS nélküli leírás, saját favicon és a design
 * token színével egyező theme-color.
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
  // Önálló attribútumként keressük: a `data-i18n-content` neve is tartalmazza a `content="` részt (PQW-905).
  return tag ? /\scontent="([^"]*)"/.exec(tag)?.[1] : undefined;
}

const ROBOTS = new URL('../public/robots.txt', import.meta.url);
const BUILT_INDEX = new URL('../dist/index.html', import.meta.url);

/** Egy `property` attribútumú (Open Graph) meta elem `content` értéke a fejben. */
function property(name) {
  const tag = HEAD.match(new RegExp(`<meta\\s[^>]*property="${name}"[^>]*>`, 's'))?.[0];
  return tag ? /\scontent="([^"]*)"/.exec(tag)?.[1] : undefined;
}

/** A fej JSON-LD adatblokkjai, értelmezve. */
function jsonLd(html) {
  return [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(([, body]) => JSON.parse(body));
}

test('az .htaccess nem küld noindexet: a gyökér indexelhető (PQW-918)', () => {
  assert.equal(headerValue(HTACCESS, 'X-Robots-Tag'), undefined);
});

test('a buildelt kimenet .htaccess-e sem küld noindexet, és a robots.txt is a buildbe kerül', () => {
  const built = new URL('../dist/.htaccess', import.meta.url);
  assert.ok(existsSync(built), 'Nincs dist/ — előbb futtasd a `npm run build`-ot.');
  assert.equal(headerValue(readFileSync(built, 'utf8'), 'X-Robots-Tag'), undefined);
  assert.equal(readFileSync(new URL('../dist/robots.txt', import.meta.url), 'utf8'), readFileSync(ROBOTS, 'utf8'));
});

test('a robots.txt mindent enged, és a keresők meg az AI-bejárók saját csoportot kapnak', () => {
  const robots = readFileSync(ROBOTS, 'utf8');
  assert.doesNotMatch(robots, /^\s*Disallow:\s*\S/im);
  const groups = new Map();
  let agent;
  for (const line of robots.split('\n').map((candidate) => candidate.replace(/#.*/, '').trim()).filter(Boolean)) {
    const [field, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    if (/^user-agent$/i.test(field)) groups.set((agent = value), []);
    else groups.get(agent)?.push(`${field.trim()}: ${value}`);
  }
  const bots = ['*', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'Bingbot'];
  for (const bot of bots) assert.deepEqual(groups.get(bot), ['Allow: /'], bot);
});

test('a fejben nincs meta robots noindex; a leírás és a cím a keresett kifejezésekkel; a nyelv magyar', () => {
  assert.match(INDEX, /<html lang="hu">/);
  assert.doesNotMatch(INDEX, /noindex/);
  const description = meta('description');
  assert.ok(description && description.length >= 50 && description.length <= 160, description);
  assert.match(description, /horgolásminta-tervező/i);
  assert.match(/<title[^>]*>([^<]*)<\/title>/.exec(HEAD)?.[1] ?? '', /^Ingyenes horgolásminta-tervező és jeldiagram-készítő/);
});

test('canonical a gyökérre, és teljes Open Graph fej abszolút, https képpel', () => {
  assert.match(HEAD, /<link rel="canonical" href="https:\/\/app\.dragonettecrochet\.com\/" \/>/);
  assert.equal(property('og:type'), 'website');
  assert.equal(property('og:url'), 'https://app.dragonettecrochet.com/');
  assert.equal(property('og:site_name'), 'Dragonette Crochet');
  assert.equal(property('og:title'), /<title[^>]*>([^<]*)<\/title>/.exec(HEAD)?.[1]);
  assert.equal(property('og:description'), meta('description'));
  assert.match(property('og:image') ?? '', /^https:\/\/dragonettecrochet\.com\/img\/og-(hu|en)\.png$/);
});

test('a SoftwareApplication JSON-LD a főoldal Organization-jére és leíró oldalára mutat', () => {
  const blocks = jsonLd(HEAD);
  assert.equal(blocks.length, 1);
  const [app] = blocks;
  assert.equal(app['@context'], 'https://schema.org');
  assert.equal(app['@type'], 'SoftwareApplication');
  assert.equal(app['@id'], 'https://dragonettecrochet.com/#designer');
  assert.ok(app.name && app.alternateName, 'név és magyar alternatív név kell');
  assert.equal(app.applicationCategory, 'DesignApplication');
  assert.equal(app.operatingSystem, 'Web browser');
  assert.equal(app.url, 'https://app.dragonettecrochet.com/');
  assert.deepEqual(app.inLanguage, ['hu', 'en']);
  assert.deepEqual(app.offers, { '@type': 'Offer', price: '0', priceCurrency: 'HUF' });
  // A főoldal kezdőlapja `${siteRoot}#organization` azonosítóval írja le a szervezetet.
  assert.deepEqual(app.publisher, { '@id': 'https://dragonettecrochet.com/#organization' });
  assert.equal(app.mainEntityOfPage, 'https://dragonettecrochet.com/en/crochet-pattern-designer/');
});

test('a buildelt oldal fejében változatlanul ott a JSON-LD és a canonical', () => {
  assert.ok(existsSync(BUILT_INDEX), 'Nincs dist/ — előbb futtasd a `npm run build`-ot.');
  const built = readFileSync(BUILT_INDEX, 'utf8');
  assert.deepEqual(jsonLd(built), jsonLd(HEAD));
  assert.match(built, /<link rel="canonical" href="https:\/\/app\.dragonettecrochet\.com\/"/);
  assert.doesNotMatch(built, /noindex/);
});

test('JS nélkül is van szöveg: magyar és angol leírás a főoldali leíró oldalak linkjével', () => {
  const noscript = /<body>\s*(?:<!--[\s\S]*?-->\s*)?<noscript>([\s\S]*?)<\/noscript>/.exec(INDEX)?.[1];
  assert.ok(noscript, 'nincs <noscript> a body elején');
  assert.match(noscript, /lang="hu"[\s\S]*horgolásminta-tervező/i);
  assert.match(noscript, /lang="en"[\s\S]*crochet pattern designer/i);
  assert.match(noscript, /href="https:\/\/dragonettecrochet\.com\/hu\/horgolasminta-tervezo\/"/);
  assert.match(noscript, /href="https:\/\/dragonettecrochet\.com\/en\/crochet-pattern-designer\/"/);
});

test('saját favicon és apple-touch-icon, külső hivatkozás nélkül; a fájlok a public/-ban', () => {
  const links = [...HEAD.matchAll(/<link\s[^>]*rel="(icon|apple-touch-icon)"[^>]*>/g)].map((match) => ({ rel: match[1], href: /href="([^"]*)"/.exec(match[0])?.[1] }));
  assert.deepEqual(links.map((link) => link.rel).sort(), ['apple-touch-icon', 'icon', 'icon']);
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

test('SVG favicon a D6 jellel, a 32 px-es ICO megmarad tartalékként (PQW-922)', () => {
  assert.match(HEAD, /<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg" \/>/);
  assert.match(HEAD, /<link rel="icon" href="\/favicon\.ico" sizes="32x32" \/>/);
});
