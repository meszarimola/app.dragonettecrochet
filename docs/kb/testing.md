# Testing

## §1 Shape of the suite

`node:test` for units (89 files, 1756 cases), Playwright for E2E (39 specs, 195
tests).
`npm test` needs `dist/` — the analytics test reads the built `index.html`, so
**build first**. `npm run kapu` runs everything in the right order, and §4 says
which tests it deliberately leaves out and where those run instead.

The pull-request CI is one job: format, check, build, unit tests, about 50 s. The
browser suite runs nightly and before every release, not on a pull request (§4).

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

## §4 Where each kind of test runs, and why

Measured on 2026-10-02, on the owner's machine (10 cores):

| Step | Time | Runs |
|---|---|---|
| `npx biome ci .` | 2 s | gate, CI |
| `npm run check` (two `tsc` passes) | 1.7 s | gate, CI |
| `npm run build` | 2 s | gate, CI |
| `npm test` — 89 files, 1756 cases | 4.7 s | gate, CI |
| **`npm run kapu`** | **~8 s** | before every commit |
| `npm run fustteszt` — the 20-test `@kiadas` set | **~8 s** | every release, and by hand |
| `npx playwright test` — 39 specs, 195 tests | 33 s | nightly only |

**The gate opens no browser.** That is the owner's decision (PQW-1123), and the
numbers are why it is a sound one: the browser suite is 33 s of what would be a
41-second gate — five times everything else together — and it is the part the
editing loop does not need on every pass.

What replaces it, so that nothing reaches production unchecked:

- **Nightly**, `.github/workflows/nightly.yml`: the full suite against `develop`,
  once a day. A regression surfaces within a day, and the failure mails the owner.
- **Every release**, in `scripts/kiadas.sh`: the `@kiadas` set, which the release
  **cannot skip** — a failure stops the release. `--bongeszo` widens it to the full
  suite; nothing narrows it. The cap is five minutes (`--global-timeout 300000`);
  it runs in about eight seconds, so the cap is a tripwire, not a budget.
- **By hand**, `npm run fustteszt` when you touched the interface and want to know
  now rather than tomorrow morning.

The pull-request CI no longer has a browser job either, and the `Browser tests`
required check was removed from `develop` and `main` in the same change. Leaving a
required check in place for a job that no longer reports would have left every pull
request waiting forever — that is also why `paths-ignore` is not an option here
(§5).

### The release set

Twenty tests, one per spec, chosen for breadth rather than depth: language,
interface, rounds, amigurumi, garments, shawls, grid, grid pattern, written panel,
generated title, free-form, editor, panels, warnings, stitch counts, backwards,
insertion, shapes, size, granny square. Two of them skip on this platform, so
eighteen actually run.

They carry Playwright's `{ tag: '@kiadas' }`, and `tests/kapu.test.mjs` asserts the
set stays at or under twenty, that each tagged test is top-level (one inside a
viewport loop would run more than once and make the count a lie), and that the
release still cannot ship without it.

### A failing browser run, and why the limits exist

Before this section was written the config set no limits, so Playwright's defaults
applied: 30 s per test and 5 s per assertion, with no action timeout. During the
PQW-1100 language migration that turned a 33-second suite into a run still going
after **ten minutes**, which was then killed — the work it would have reported was
lost.

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
`maxFailures` caps the run at five failures however large the suite is.

**No limit may go below the interface's own timers.** The warning box hides itself
after three seconds and a chart marking after five, and the tests that assert that
have to wait them out. A first attempt at a 2-second `expect` timeout failed
`figyelmeztetes.spec.ts` for exactly this reason; `tests/kapu.test.mjs` now asserts
the floor so the mistake cannot come back.

### The port

Every browser entry point shares one port, read by `playwright.config.ts` from the
worktree's own `.env.local` (written by `npm run munkafa`), with `PORT` in the
environment winning. The config reads it rather than the caller because there are
now several entry points, and a port read in only one of them is a collision in the
others.

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
