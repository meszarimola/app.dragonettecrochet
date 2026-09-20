# Testing

## §1 Shape of the suite

`node:test` for units (90 files, ~955 cases), Playwright for E2E (36 specs).
`npm test` needs `dist/` — the analytics test reads the built `index.html`, so
**build first**.

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
