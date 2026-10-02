/*
 * The gate and the browser-test tiers (PQW-1104, scope set in PQW-1123).
 *
 * The owner's decision: `npm run kapu` runs no browser tests at all. The full
 * suite runs nightly, and a 20-test release set runs before every release. That
 * only holds while three things stay true, and each has a test here:
 *
 *   1. the gate still runs everything the pull-request CI runs;
 *   2. the release set is at most 20 tests, and the release cannot skip it;
 *   3. the nightly workflow actually runs the full suite.
 *
 * Without 2 and 3, moving the browser tests out of the gate would mean nothing
 * checks them before production. KB: testing.md §4
 */

import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import playwrightConfig from '../playwright.config.ts';

const ROOT = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), 'utf8');

const gate = read('scripts/kapu.sh');
const release = read('scripts/kiadas.sh');
const workflow = read('.github/workflows/ci.yml');
const nightly = read('.github/workflows/nightly.yml');
const pkg = JSON.parse(read('package.json'));

/** The tag that marks a test as part of the release set. */
const TAG = '@kiadas';

/** Steps CI runs that prepare the runner rather than check anything. */
const SETUP = [/^npm ci$/, /^npx playwright install\b/];

/** Every command the workflow actually runs, setup steps dropped. */
function ciChecks(yaml) {
  return yaml
    .split('\n')
    .map((line) => /^\s*(?:-\s+)?run:\s*(\S.*?)\s*$/.exec(line))
    .filter(Boolean)
    .map(([, command]) => command)
    .filter((command) => !SETUP.some((pattern) => pattern.test(command)));
}

test('the pull-request CI is still parsed into the checks we expect', () => {
  assert.deepEqual(ciChecks(workflow), ['npx biome ci .', 'npm run check', 'npm run build', 'npm test']);
});

test('the gate runs every check the pull-request CI runs', () => {
  for (const command of ciChecks(workflow)) {
    assert.ok(gate.includes(command), `npm run kapu does not run "${command}", which CI runs`);
  }
});

test('neither the gate nor the pull-request CI opens a browser', () => {
  // An invocation, not a mention: the gate's help text names the commands that do
  // run the browser, and that line must not trip this.
  const invokesPlaywright = gate
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .some((line) => /^\s*(?:\w+=\S+\s+)*npx playwright\b/.test(line));

  assert.ok(!invokesPlaywright, 'the browser suite left the gate in PQW-1123');
  assert.ok(!ciChecks(workflow).some((command) => /playwright|test:e2e/.test(command)));
});

test('the gate takes no flags, so there is no second way to run it', () => {
  assert.match(gate, /Ismeretlen kapcsoló/);
  for (const flag of ['--gyors', '--bongeszo']) {
    assert.ok(!gate.includes(`${flag})`), `${flag} is gone from the gate; a leftover branch would confuse`);
  }
});

test('npm run kapu and npm run fustteszt are wired', () => {
  assert.equal(pkg.scripts.kapu, 'bash scripts/kapu.sh');
  assert.equal(pkg.scripts.fustteszt, `npm run build && playwright test --grep ${TAG}`);
});

/**
 * Every tagged test, with the spec it lives in and the `test(` line that owns it.
 * The formatter may put the tag on a continuation line, so the declaration is
 * found by walking back to the nearest `test(`.
 */
function taggedTests() {
  const found = [];
  for (const file of readdirSync(new URL('e2e/', ROOT)).filter((name) => name.endsWith('.spec.ts'))) {
    const lines = read(`e2e/${file}`).split('\n');
    lines.forEach((line, index) => {
      if (!line.includes(`tag: '${TAG}'`)) return;
      const declaration = lines
        .slice(0, index + 1)
        .reverse()
        .find((earlier) => /^\s*test\(/.test(earlier));
      found.push({ file, declaration });
    });
  }
  return found;
}

test('the release set is at most 20 tests, spread over as many areas', () => {
  const tagged = taggedTests();
  assert.ok(tagged.length > 0, 'nothing carries the release tag any more');
  assert.ok(tagged.length <= 20, `the release set grew to ${tagged.length} tests; the owner's limit is 20`);

  const areas = new Set(tagged.map(({ file }) => file));
  assert.equal(areas.size, tagged.length, 'one tagged test per spec keeps the set a breadth check');
});

test('every tagged test is top-level, so the static count is the real count', () => {
  // A tagged test inside a `for (const viewport of …)` loop runs once per
  // iteration, and then counting the source would understate the set. A top-level
  // declaration starts at column zero; one inside a loop is indented.
  for (const { file, declaration } of taggedTests()) {
    assert.ok(declaration, `${file}: a tag with no test( declaration above it`);
    assert.ok(
      declaration.startsWith('test('),
      `${file}: a tagged test must be top-level, not nested in a loop — found "${declaration.trim().slice(0, 40)}…"`,
    );
  }
});

test('the release cannot ship without the release set, and caps it at five minutes', () => {
  assert.match(release, new RegExp(`playwright test --grep ${TAG}`));
  assert.match(release, /--global-timeout 300000/, "the owner's limit is five minutes");

  // The run must sit on the failure path of the release, not behind a flag.
  const at = release.indexOf(`--grep ${TAG}`);
  const guard = release.indexOf('if (( BONGESZO ))');
  assert.ok(at > guard, 'the release set belongs in the else branch: --bongeszo widens it, never skips it');
  assert.match(release.slice(at, at + 400), /megall/, 'a failing release set must stop the release');
});

test('the release is a tag on develop, with no main and no release branch', () => {
  // The release train (PQW-1125): develop is the trunk, and what is on it goes out.
  // KB: decisions.md §11
  assert.match(release, /git tag -a "v\$VERZIO"/, 'a release must tag what it ships');
  assert.match(release, /git push --atomic origin develop "v\$VERZIO"/, 'branch and tag go out together');
  assert.ok(!release.includes('release/v'), 'the release branch is gone with the flow that used it');

  for (const text of ['--base main', 'origin/main', 'a main ágon']) {
    assert.ok(!release.includes(text), `the release still mentions main: "${text}"`);
  }

  // The tag has to exist before the upload, or --ujra has nothing to rebuild from.
  // The indented occurrence is the call; the first one is the function definition.
  assert.ok(
    release.indexOf('git tag -a') < release.indexOf('\n  epits_es_ellenorizd\n'),
    'the tag must be created before the build',
  );
});

test('the pull-request CI no longer watches main either', () => {
  assert.match(workflow, /branches: \[develop\]/);
  assert.ok(!workflow.includes('main'), 'a push trigger on a branch nothing updates is noise');
});

test('the nightly workflow runs the full suite on a schedule', () => {
  assert.match(nightly, /schedule:/);
  assert.match(nightly, /cron:/);
  assert.match(nightly, /npm run test:e2e/, 'the nightly run is the one place the full suite still runs');
  assert.ok(!nightly.includes(`--grep ${TAG}`), 'the nightly run is the full suite, not the release set');
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
