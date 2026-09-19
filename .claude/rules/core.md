---
paths:
  - "src/core/**"
---

# The core

`src/core/` is **pure domain logic with no browser**. No `document`, `window`,
canvas or timer. `npm run check` type-checks it twice: once with the DOM, once
through `tsconfig.core.json` which drops the DOM lib entirely — that second pass
is the proof, and `tests/core-boundary.test.mjs` also refuses an import that
reaches into `src/ui/`.

## Rules

- **Return a code and data, never a sentence.** The core is language-independent;
  the UI dictionary turns a code into text. This is what lets a new language touch
  only `src/ui/i18n/`.
- **A new validation rule goes into `src/core/rules.ts` first**, with its
  `severity`, a developer `summary`, a user-facing `message` and a `reference`
  pointing at the knowledge-base section it comes from.
  `tests/core-validate.test.mjs` fails without a valid `reference`, and fails if
  the `message` leaks an internal term (`réteg`, `darab`) or a `§` code — the
  user never sees the knowledge base.
- **Every rule needs a failing example in the tests.** An `after()` hook asserts
  that the set of tested rules equals the set of defined rules.
- **Read the knowledge base before changing domain behaviour**, by section code,
  never whole. The crochet rules are sourced there, not invented here.
- Hungarian string literals in the core are a test failure, except in the files
  listed in `CORE_EXCEPTIONS` — those hold the marking-language vocabulary
  deliberately. **Never rename those files**: the exemption is keyed by filename.
- Non-null assertions (`!`) are common here and many are load-bearing. A ratchet
  test caps the total — you may lower it, never raise it.
