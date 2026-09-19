---
paths:
  - "tests/**"
  - "e2e/**"
  - "playwright.config.ts"
  - "playwright.prod.config.ts"
---

# Tests

`node:test` for units (`npm test`), Playwright for E2E (`npm run test:e2e`, which
builds first and serves on port 5181). **Build before `npm test`** — the
analytics test reads `dist/index.html`.

## Rules

- A bug fix ships with a test that fails without it.
- **Every validation rule needs a failing example.** An `after()` hook asserts the
  tested set equals the defined set, so a new rule without a test fails the suite.
- E2E covers a few critical journeys only. Keep that suite small.
- Two worktrees running E2E **collide on port 5181** — pass a different `PORT`.

## Meta-tests read the source as raw text

Several tests grep the source instead of importing it, and they are **not
comment-aware**. This makes "a comment change cannot break anything" false here.

| Test | What it scans | The trap |
|---|---|---|
| `core-boundary.test.mjs` | `src/core/**` for import specifiers | A comment containing `import … from '…'` is read as a real import |
| `core-i18n.test.mjs` | `src/core/*.ts` for Hungarian literals | Skips lines starting with `*`, `//`, `/*` — a continuation line without the leading `*` is scanned as code |
| `core-i18n.test.mjs` | `CORE_EXCEPTIONS`, a set of **filenames** | Renaming an exempt file silently removes its exemption |
| `ui-i18n.test.mjs` | concatenated `src/ui/*.ts` for `'key'` | **Deleting** a comment can orphan an i18n key and fail the dead-key test |
| `hu-vocabulary.test.mjs` | source, `index.html`, `README.md`, docs | Its own `UNIT_WORD` regex is frozen |

**Run the full `npm test` on every batch of comment or text changes**, never just
the type check.
