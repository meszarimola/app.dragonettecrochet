/*
 * The gate (PQW-1104). Two things are guarded here.
 *
 * One: `npm run kapu` must stay a superset of CI. If CI grows a check and the
 * gate does not, a branch goes green on the machine and red on the server, and
 * the author finds out three minutes later instead of now.
 *
 * Two: the browser config must keep its own limits. Without them Playwright's
 * defaults apply, and a run whose locators no longer match takes ten minutes
 * instead of forty seconds. KB: testing.md §4
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import playwrightConfig from '../playwright.config.ts';

const ROOT = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), 'utf8');

const gate = read('scripts/kapu.sh');
const workflow = read('.github/workflows/ci.yml');
const pkg = JSON.parse(read('package.json'));

/** Steps CI runs that prepare the runner rather than check anything. */
const SETUP = [/^npm ci$/, /^npx playwright install\b/];

/**
 * The gate builds once and then calls Playwright directly, where CI uses the
 * script that builds again first. The same check behind a different wrapper.
 */
const EQUIVALENT = new Map([['npm run test:e2e', 'npx playwright test']]);

/** Every command the workflow actually runs, setup steps dropped. */
function ciChecks(yaml) {
  const commands = yaml
    .split('\n')
    .map((line) => /^\s*(?:-\s+)?run:\s*(\S.*?)\s*$/.exec(line))
    .filter(Boolean)
    .map(([, command]) => command);
  return commands.filter((command) => !SETUP.some((pattern) => pattern.test(command)));
}

test('the workflow is still parsed into the checks we expect', () => {
  assert.deepEqual(ciChecks(workflow), [
    'npx biome ci .',
    'npm run check',
    'npm run build',
    'npm test',
    'npm run test:e2e',
  ]);
});

test('the gate runs every check CI runs', () => {
  for (const command of ciChecks(workflow)) {
    const expected = EQUIVALENT.get(command) ?? command;
    assert.ok(gate.includes(expected), `npm run kapu does not run "${expected}", which CI runs as "${command}"`);
  }
});

test('npm run kapu is wired to the script', () => {
  assert.equal(pkg.scripts.kapu, 'bash scripts/kapu.sh');
});

test('the fast tier drops the browser tests and nothing else', () => {
  const guard = gate.indexOf('if (( GYORS ))');
  assert.ok(guard > 0, 'the fast tier guard is gone from the gate');

  for (const command of ['npx biome ci .', 'npm run check', 'npm run build', 'npm test']) {
    const at = gate.indexOf(command);
    assert.ok(at > 0 && at < guard, `npm run kapu -- --gyors would skip "${command}"`);
  }

  const browsers = gate.indexOf('PORT="$PORT" npx playwright test');
  assert.ok(browsers > guard, 'the browser tests must run after the fast tier has exited');
});

test('an unknown flag is refused instead of silently running the full gate', () => {
  assert.match(gate, /Ismeretlen kapcsoló/);
});

test('the browser config keeps its own limits, tighter than the defaults', () => {
  const { timeout, expect: expectations, maxFailures, use } = playwrightConfig;

  // No limit may go below the deliberate interface timers: 3 s for a warning,
  // 5 s for a chart marking. That is what keeps `expect` at five seconds.
  assert.ok(expectations.timeout >= 5_000, 'below 5 s the tests that wait out an interface timer break');

  if (process.env.CI) {
    assert.equal(timeout, 30_000);
    assert.equal(use.actionTimeout, 0, 'CI reports every failure, so it keeps no action timeout');
    assert.equal(maxFailures, 0, 'CI reports every failure, so it stops at none');
    return;
  }

  assert.equal(timeout, 20_000);
  assert.equal(use.actionTimeout, 10_000, 'a missing locator must fail here, not at the test timeout');
  assert.equal(maxFailures, 5, 'five failures are enough to say the change is wrong');
});
