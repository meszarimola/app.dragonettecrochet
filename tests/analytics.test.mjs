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
  assert.ok(cspLine, 'no active Content-Security-Policy line in public/.htaccess');

  const policy = cspLine.match(/Content-Security-Policy\s+"([^"]+)"/)[1];
  return Object.fromEntries(
    policy
      .split(';')
      .map((directive) => directive.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name, ...sources]) => [name, sources]),
  );
}

test('the measurement id is either empty or a valid GA4 id', () => {
  assert.match(GA_MEASUREMENT_ID, /^(G-[A-Z0-9]{4,})?$/);
});

test('the CSP allows Google Analytics exactly when a measurement id is set', () => {
  const csp = activeCspDirectives();

  if (GA_MEASUREMENT_ID) {
    for (const [directive, sources] of Object.entries(GOOGLE_ANALYTICS_CSP_SOURCES_WITHOUT_SIGNALS)) {
      for (const source of sources) {
        assert.ok(
          csp[directive]?.includes(source),
          `GA_MEASUREMENT_ID is set, but the public/.htaccess CSP ${directive} does not allow: ${source} — ` +
            'in production the measurement would silently fail to start',
        );
      }
    }
  } else {
    const googleSources = Object.values(csp).flat().filter((source) => /google/.test(source));
    assert.deepEqual(googleSources, [], 'there is no GA_MEASUREMENT_ID, yet the CSP allows a Google source');
  }
});

test('the built page loads no gtag.js before consent and carries no inline script', () => {
  assert.ok(existsSync(BUILT_INDEX), 'No dist/ — run `npm run build` first.');

  const html = readFileSync(BUILT_INDEX, 'utf8');
  assert.ok(!html.includes('googletagmanager.com'));

  // The JSON-LD data block never executes, so the CSP does not touch it (PQW-918); every other inline script is forbidden.
  const inlineScripts = [...html.matchAll(/<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/g)].filter(
    ([, attributes, body]) => body.trim() && !/^\s*type="application\/ld\+json"\s*$/.test(attributes),
  );
  assert.deepEqual(inlineScripts, [], 'the CSP script-src would block an inline script in production');
});

test('the designer writes the decision into the same root-domain cookie as the main site', () => {
  assert.equal(sharedCookieDomain('app.dragonettecrochet.com'), 'dragonettecrochet.com');

  const setCookieLine = serializeConsent('granted', {
    hostname: 'app.dragonettecrochet.com',
    secure: true,
  });
  assert.match(setCookieLine, new RegExp(`^${CONSENT_COOKIE}=${CONSENT_VERSION}:granted:\\d+;`));
  assert.match(setCookieLine, /; Domain=dragonettecrochet\.com/);
  assert.equal(parseConsent(setCookieLine.split(';')[0])?.choice, 'granted');
});
