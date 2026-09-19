---
paths:
  - "src/ui/**"
  - "index.html"
  - "vite.config.ts"
---

# The interface

`src/ui/` owns everything that touches the browser: canvas drawing, DOM, events,
dialogs and the language dictionaries.

## Rules

- **Every user-facing string lives in `src/ui/i18n/`.** Never a literal in a
  component. The dictionary values are frozen product content — see
  `.claude/rules/frozen-paths.md`.
- **The user never sees the knowledge base.** No `§` codes, no rule ids, no
  internal terms (`réteg`, `darab`) in a message. The reference may appear only
  in a collapsible detail. Tests enforce this.
- **Do not announce, confirm or guard what the user did not ask for.** No toast
  after an operation, no confirmation dialog before an action the user clicked,
  no progress markers. The owner is the expert; the program's job is to get out
  of the way.
- **The version is never hand-written.** It comes from `package.json` via
  `__APP_VERSION__`, injected by `vite.config.ts` at build time.
  `tests/version.test.mjs` fails on a literal version string in `index.html` or
  the source.
- Import the core with an explicit extension; the core must never import back.
- Chart coordinates come from the core's layout units; the view applies scale and
  offset. Do not mix the two coordinate systems.
