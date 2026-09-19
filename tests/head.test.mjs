/*
 * The designer's HTTP headers and document head (PQW-853, PQW-918): the root
 * is indexable (no X-Robots-Tag, no meta robots noindex), robots.txt allows
 * everything, and the head carries a title and description written around the
 * target search terms, a canonical, Open Graph, a SoftwareApplication JSON-LD,
 * a description that works without JS, an own favicon, and a theme-color equal
 * to the design token.
 */

import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const HTACCESS = read('public/.htaccess');
const INDEX = read('index.html');
const HEAD = /<head>([\s\S]*?)<\/head>/.exec(INDEX)?.[1] ?? '';

/** The value of the active (not commented out) `Header ... set <name> "<value>"` line. */
function headerValue(htaccess, name) {
  const line = htaccess
    .split('\n')
    .find((candidate) => new RegExp(`^\\s*Header\\s+(always\\s+)?set\\s+${name}\\s`).test(candidate));
  return line ? /"([^"]*)"/.exec(line)?.[1] : undefined;
}

/** The `content` value of a meta element in the head. */
function meta(name) {
  const tag = HEAD.match(new RegExp(`<meta\\s[^>]*name="${name}"[^>]*>`, 's'))?.[0];
  // Matched as a standalone attribute: the name `data-i18n-content` also contains the `content="` fragment (PQW-905).
  return tag ? /\scontent="([^"]*)"/.exec(tag)?.[1] : undefined;
}

const ROBOTS = new URL('../public/robots.txt', import.meta.url);
const BUILT_INDEX = new URL('../dist/index.html', import.meta.url);

/** The `content` value of a meta element carrying a `property` attribute (Open Graph) in the head. */
function property(name) {
  const tag = HEAD.match(new RegExp(`<meta\\s[^>]*property="${name}"[^>]*>`, 's'))?.[0];
  return tag ? /\scontent="([^"]*)"/.exec(tag)?.[1] : undefined;
}

/** The JSON-LD data blocks of the head, parsed. */
function jsonLd(html) {
  return [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(([, body]) =>
    JSON.parse(body),
  );
}

test('the .htaccess sends no noindex: the root stays indexable (PQW-918)', () => {
  assert.equal(headerValue(HTACCESS, 'X-Robots-Tag'), undefined);
});

test('the built .htaccess sends no noindex either, and robots.txt makes it into the build', () => {
  const built = new URL('../dist/.htaccess', import.meta.url);
  assert.ok(existsSync(built), 'No dist/ — run `npm run build` first.');
  assert.equal(headerValue(readFileSync(built, 'utf8'), 'X-Robots-Tag'), undefined);
  assert.equal(readFileSync(new URL('../dist/robots.txt', import.meta.url), 'utf8'), readFileSync(ROBOTS, 'utf8'));
});

test('robots.txt allows everything, and search engines and AI crawlers each get their own group', () => {
  const robots = readFileSync(ROBOTS, 'utf8');
  assert.doesNotMatch(robots, /^\s*Disallow:\s*\S/im);
  const groups = new Map();
  let agent;
  for (const line of robots
    .split('\n')
    .map((candidate) => candidate.replace(/#.*/, '').trim())
    .filter(Boolean)) {
    const [field, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    if (/^user-agent$/i.test(field)) groups.set((agent = value), []);
    else groups.get(agent)?.push(`${field.trim()}: ${value}`);
  }
  const bots = [
    '*',
    'GPTBot',
    'OAI-SearchBot',
    'ChatGPT-User',
    'ClaudeBot',
    'Claude-SearchBot',
    'Claude-User',
    'PerplexityBot',
    'Perplexity-User',
    'Google-Extended',
    'Applebot-Extended',
    'Bingbot',
  ];
  for (const bot of bots) assert.deepEqual(groups.get(bot), ['Allow: /'], bot);
});

test('the head carries no meta robots noindex, the description and title use the target search terms, and the language is Hungarian', () => {
  assert.match(INDEX, /<html lang="hu">/);
  assert.doesNotMatch(INDEX, /noindex/);
  const description = meta('description');
  assert.ok(description && description.length >= 50 && description.length <= 160, description);
  assert.match(description, /horgolásminta-tervező/i);
  assert.match(
    /<title[^>]*>([^<]*)<\/title>/.exec(HEAD)?.[1] ?? '',
    /^Ingyenes horgolásminta-tervező és jeldiagram-készítő/,
  );
});

test('the canonical points to the root, and the Open Graph head is complete with an absolute https image', () => {
  assert.match(HEAD, /<link rel="canonical" href="https:\/\/app\.dragonettecrochet\.com\/" \/>/);
  assert.equal(property('og:type'), 'website');
  assert.equal(property('og:url'), 'https://app.dragonettecrochet.com/');
  assert.equal(property('og:site_name'), 'Dragonette Crochet');
  assert.equal(property('og:title'), /<title[^>]*>([^<]*)<\/title>/.exec(HEAD)?.[1]);
  assert.equal(property('og:description'), meta('description'));
  assert.match(property('og:image') ?? '', /^https:\/\/dragonettecrochet\.com\/img\/og-(hu|en)\.png$/);
});

test('the SoftwareApplication JSON-LD points at the main site Organization and its landing page', () => {
  const blocks = jsonLd(HEAD);
  assert.equal(blocks.length, 1);
  const [app] = blocks;
  assert.equal(app['@context'], 'https://schema.org');
  assert.equal(app['@type'], 'SoftwareApplication');
  assert.equal(app['@id'], 'https://dragonettecrochet.com/#designer');
  assert.ok(app.name && app.alternateName, 'a name and a Hungarian alternate name are required');
  assert.equal(app.applicationCategory, 'DesignApplication');
  assert.equal(app.operatingSystem, 'Web browser');
  assert.equal(app.url, 'https://app.dragonettecrochet.com/');
  assert.deepEqual(app.inLanguage, ['hu', 'en']);
  assert.deepEqual(app.offers, { '@type': 'Offer', price: '0', priceCurrency: 'HUF' });
  // The main site home page describes the organization under the id `${siteRoot}#organization`.
  assert.deepEqual(app.publisher, { '@id': 'https://dragonettecrochet.com/#organization' });
  assert.equal(app.mainEntityOfPage, 'https://dragonettecrochet.com/en/crochet-pattern-designer/');
});

test('the built page head still carries the JSON-LD and the canonical unchanged', () => {
  assert.ok(existsSync(BUILT_INDEX), 'No dist/ — run `npm run build` first.');
  const built = readFileSync(BUILT_INDEX, 'utf8');
  assert.deepEqual(jsonLd(built), jsonLd(HEAD));
  assert.match(built, /<link rel="canonical" href="https:\/\/app\.dragonettecrochet\.com\/"/);
  assert.doesNotMatch(built, /noindex/);
});

test('there is text without JS: a Hungarian and an English description linking to the landing pages', () => {
  const noscript = /<body>\s*(?:<!--[\s\S]*?-->\s*)?<noscript>([\s\S]*?)<\/noscript>/.exec(INDEX)?.[1];
  assert.ok(noscript, 'no <noscript> at the start of the body');
  assert.match(noscript, /lang="hu"[\s\S]*horgolásminta-tervező/i);
  assert.match(noscript, /lang="en"[\s\S]*crochet pattern designer/i);
  assert.match(noscript, /href="https:\/\/dragonettecrochet\.com\/hu\/horgolasminta-tervezo\/"/);
  assert.match(noscript, /href="https:\/\/dragonettecrochet\.com\/en\/crochet-pattern-designer\/"/);
});

test('own favicon and apple-touch-icon with no external reference, and the files live in public/', () => {
  const links = [...HEAD.matchAll(/<link\s[^>]*rel="(icon|apple-touch-icon)"[^>]*>/g)].map((match) => ({
    rel: match[1],
    href: /href="([^"]*)"/.exec(match[0])?.[1],
  }));
  assert.deepEqual(links.map((link) => link.rel).sort(), ['apple-touch-icon', 'icon', 'icon']);
  for (const { href } of links) {
    assert.match(href, /^\/[\w.-]+$/, `${href}: must be a same-origin, relative path`);
    assert.ok(existsSync(new URL(`../public${href}`, import.meta.url)), `${href} is missing from public/`);
  }
});

test('theme-color equals the value of the --c-bg design token', () => {
  const token = /--c-bg:\s*(#[0-9a-f]{6})/i.exec(read('src/ui/styles.css'))?.[1];
  assert.ok(token, 'no --c-bg token');
  assert.equal(meta('theme-color')?.toLowerCase(), token.toLowerCase());
});

test('an SVG favicon with the D6 mark, and the 32 px ICO stays as a fallback (PQW-922)', () => {
  assert.match(HEAD, /<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg" \/>/);
  assert.match(HEAD, /<link rel="icon" href="\/favicon\.ico" sizes="32x32" \/>/);
});
