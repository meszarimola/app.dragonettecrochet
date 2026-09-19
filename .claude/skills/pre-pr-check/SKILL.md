---
name: pre-pr-check
description: Run the full verification suite before opening a pull request on the pattern designer — type check, build, unit tests and the Playwright E2E suite. Use when finishing a ticket, before opening or updating a PR, or when asked to verify or check the work.
---

# Pre-PR verification

Run these in order. Stop at the first failure and fix it.

```bash
npm run check      # type check: all of src/, then src/core/ again without the DOM
npm run build      # tsc --noEmit + vite build
npm test           # node:test — NEEDS dist/, so build first
npm run test:e2e   # builds, then Playwright on the built output
```

`npm test` reads `dist/index.html` in the analytics test. Skipping the build makes
it fail against a stale build, and the failure is misleading.

**Two worktrees running E2E collide on port 5181** — the config uses
`--strictPort` on purpose. Pass a different `PORT` if a sibling is running.

## Look at the running UI, not only at green CI

Green tests are not evidence that the interface works. On 2026-09-15 a conflict
resolution in `styles.css` dropped a single `}`, every test passed, and the app
was unusable (PQW-881, `docs/kb/incidents.md` §2).

**If your branch merged `develop` with conflicts, open the app in a browser**
before merging — once at a wide window and once at a short one.

## If you touched validation

`tests/core-validate.test.mjs` asserts that every rule in `src/core/rules.ts` has:

- a `reference` matching `/^0[1-6] §\d/` — the knowledge-base section it comes from;
- a non-empty `summary`;
- a `message` free of internal terms (`réteg`, `darab`) and of `§` codes;
- **at least one failing example in the tests** — an `after()` hook compares the
  tested set to the defined set.

## Before you open the PR

- Did the change make any `docs/kb/` or `docs/knowledge-base/` section stale?
  Update it **in this PR**.
- Does the PR description carry `PQW-<n>`?
- Is every new or changed comment in English, and does it earn its place?
