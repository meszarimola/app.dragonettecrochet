# Testing

## §1 Shape of the suite

`node:test` for units (89 files, 1756 cases), Playwright for E2E (39 specs, 195
tests).
`npm test` needs `dist/` — the analytics test reads the built `index.html`, so
**build first**. `npm run kapu` runs everything in the right order; §4 is why
there is no "run a subset" mode.

CI runs two jobs in parallel: `build` (check, build, test) and `e2e` (browser
install, build, Playwright). The `e2e` job is the critical path.

## §2 Meta-tests read the source as raw text

Several tests grep the source rather than importing it, and none of them is
comment-aware. This makes the usual assumption "a comment-only change cannot
break anything" **false in this repository**.

The full table, with the trap each one sets, is in `.claude/rules/tests.md`,
which loads whenever you open a test file. The short version:

- a comment containing `import … from '…'` fails the core boundary test;
- a block-comment continuation line without its leading `*` is scanned as code;
- **deleting** a comment can orphan an i18n key and fail the dead-key test;
- renaming a file listed in `CORE_EXCEPTIONS` silently removes its exemption.

**Run the full `npm test` on every batch of comment or text changes.**

## §3 Every rule needs a failing example

`tests/core-validate.test.mjs` ends with an `after()` hook asserting that the set
of rules exercised by the tests equals the set defined in `src/core/rules.ts`. A
new rule without a test fails the suite — this is deliberate.

## §4 The suite is cheap; a failing browser run is what costs

Measured on 2026-10-02, on the owner's machine (10 cores):

| Step | Time |
|---|---|
| `npm run check` (two `tsc` passes) | 1.7 s |
| `npm run build` | 2 s |
| `npm test` — 89 files, 1756 cases | **4.7 s** |
| `npx playwright test` — 39 specs, 195 tests | **33 s** |
| the whole gate, `npm run kapu` | **~45 s** |

So **do not split the suite to make it cheaper** — there is nothing to win.
Running the unit files one at a time is in fact slower (21.8 s), because Node
starts 89 times. `--gyors` exists for the editing loop, not for saving a gate.

What does cost is a run where the locators no longer match. Before this section
was written the config set no limits, so Playwright's defaults applied: 30 s per
test and 5 s per assertion, with no action timeout. During the PQW-1100 language
migration that turned a 33-second suite into a run still going after **ten
minutes**, which was then killed — the work it would have reported was lost.

The config therefore sets its limits explicitly:

- `maxFailures` 5 locally, unlimited in CI. **This is the one that matters.**
  Locally the fifth failure already tells you the change is wrong; CI must report
  everything.
- `actionTimeout` 10 s locally, unlimited in CI. This is what used to let a single
  missing locator burn the whole 30-second test timeout.
- `timeout` 20 s locally, 30 s in CI. The slowest real test is 6.9 s locally; the
  CI runner has two cores and is roughly five times slower, so it keeps the wider
  limit.
- `expect.timeout` 5 s everywhere — Playwright's own default, written down rather
  than assumed.

Measured with eight deliberately broken locators: 12 s with these limits against
22 s with the defaults. The gap grows with the number of broken tests, because
`maxFailures` caps the run at five failures however large the suite is — which is
why a fully broken migration now reports in seconds rather than the ten minutes
it took in PQW-1100.

**No limit may go below the interface's own timers.** The warning box hides itself
after three seconds and a chart marking after five, and the tests that assert
that have to wait them out. A first attempt at a 2-second `expect` timeout failed
`figyelmeztetes.spec.ts` for exactly this reason; `tests/kapu.test.mjs` now
asserts the floor so the mistake cannot come back.

## §5 One ticket pays for six CI runs

Measured from the v0.75.0 and v0.76.x releases: the `build` job is about 50 s and
the `e2e` job about 3 min, and they run in parallel, so one run is ~3 min of wall
clock. Gitflow then asks for six of them per ticket — feature PR, merge into
`develop`, release-branch version bump, release merge, `develop` release commit,
`develop` → `main` — which is **~18 minutes per ticket regardless of how small
the change is**.

Two things follow:

- `concurrency: cancel-in-progress` is already set, so re-pushing a branch is
  free. Push early and often rather than batching.
- `paths-ignore` is **not** the way to skip the docs-only runs. `develop` and
  `main` both require the `Build and tests` and `Browser tests` checks, and a
  skipped workflow never reports them, so the PR would wait forever. Cutting the
  six runs down means changing the release flow itself, which is the owner's
  call, not a CI tweak.
