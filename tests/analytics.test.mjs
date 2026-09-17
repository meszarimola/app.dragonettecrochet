import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import { GA_MEASUREMENT_ID } from '../src/config.ts';
import {
  CONSENT_COOKIE,
  CONSENT_VERSION,
  parseConsent,
  serializeConsent,
  sharedCookieDomain,
} from '../src/ui/consent.ts';

const HTACCESS = readFileSync(new URL('../public/.htaccess', import.meta.url), 'utf8');
const BUILT_INDEX = new URL('../dist/index.html', import.meta.url);

const GOOGLE_ANALYTICS_CSP_SOURCES_WITHOUT_SIGNALS = {
  'script-src': ['https://www.googletagmanager.com'],
  'img-src': ['https://*.google-analytics.com', 'https://www.googletagmanager.com'],
  'connect-src': [
    'https://*.google-analytics.com',
    'https://*.analytics.google.com',
    'https://www.googletagmanager.com',
  ],
};

function activeCspDirectives() {
  const cspLine = HTACCESS.split('\n').find((line) =>
    /^\s*Header\s+always\s+set\s+Content-Security-Policy\b/.test(line),
  );
  assert.ok(cspLine, 'nincs aktív Content-Security-Policy sor a public/.htaccess-ben');

  const policy = cspLine.match(/Content-Security-Policy\s+"([^"]+)"/)[1];
  return Object.fromEntries(
    policy
      .split(';')
      .map((directive) => directive.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name, ...sources]) => [name, sources]),
  );
}

test('a mérési azonosító üres vagy érvényes GA4 azonosító', () => {
  assert.match(GA_MEASUREMENT_ID, /^(G-[A-Z0-9]{4,})?$/);
});

test('a CSP pontosan akkor engedi a Google Analyticset, ha van mérési azonosító', () => {
  const csp = activeCspDirectives();

  if (GA_MEASUREMENT_ID) {
    for (const [directive, sources] of Object.entries(GOOGLE_ANALYTICS_CSP_SOURCES_WITHOUT_SIGNALS)) {
      for (const source of sources) {
        assert.ok(
          csp[directive]?.includes(source),
          `a GA_MEASUREMENT_ID be van állítva, de a public/.htaccess CSP ${directive} nem engedi: ${source} — ` +
            'élesben a mérés némán nem indulna el',
        );
      }
    }
  } else {
    const googleSources = Object.values(csp).flat().filter((source) => /google/.test(source));
    assert.deepEqual(googleSources, [], 'nincs GA_MEASUREMENT_ID, a CSP mégis enged Google forrást');
  }
});

test('a buildelt oldal nem tölti be a gtag.js-t hozzájárulás előtt, és nincs benne inline szkript', () => {
  assert.ok(existsSync(BUILT_INDEX), 'Nincs dist/ — előbb futtasd a `npm run build`-ot.');

  const html = readFileSync(BUILT_INDEX, 'utf8');
  assert.ok(!html.includes('googletagmanager.com'));

  // A JSON-LD adatblokk nem fut, a CSP nem érinti (PQW-918); minden más beágyazott szkript tilos.
  const inlineScripts = [...html.matchAll(/<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/g)].filter(
    ([, attributes, body]) => body.trim() && !/^\s*type="application\/ld\+json"\s*$/.test(attributes),
  );
  assert.deepEqual(inlineScripts, [], 'a CSP script-src élesben blokkolná a beágyazott szkriptet');
});

test('a mintatervező ugyanabba a fő domaines sütibe írja a döntést, mint a fő oldal', () => {
  assert.equal(sharedCookieDomain('app.dragonettecrochet.com'), 'dragonettecrochet.com');

  const setCookieLine = serializeConsent('granted', {
    hostname: 'app.dragonettecrochet.com',
    secure: true,
  });
  assert.match(setCookieLine, new RegExp(`^${CONSENT_COOKIE}=${CONSENT_VERSION}:granted:\\d+;`));
  assert.match(setCookieLine, /; Domain=dragonettecrochet\.com/);
  assert.equal(parseConsent(setCookieLine.split(';')[0])?.choice, 'granted');
});
