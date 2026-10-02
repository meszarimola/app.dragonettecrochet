# Pattern designer — app.dragonettecrochet.com

A crochet stitch-chart editor for the [Dragonette Crochet](https://dragonettecrochet.com)
patterns. Vanilla TypeScript and canvas, built with Vite. A separate repository
from the main site, because it runs on its own subdomain.

## What it does

PQW-1141 rewrote the app from scratch, and kept only this:

- the **stitch palette** on the left, with the running version under it;
- a **bar**: Home, the brand mark and title, **New**, and on the right the
  CYC/JIS symbol style and the interface language;
- **New** opens an empty free-form chart: pick a stitch in the palette (or with
  Alt+1…9), click the drawing area, and the stitch lands there.

## Running it

```bash
npm install
git config core.hooksPath .githooks   # the pre-commit checks; once per clone
npm run dev      # http://localhost:5173
npm run kapu     # the gate: format, types, build, unit tests
npm run test:e2e # build, then Playwright on the built output
```

Node 22.18 or newer (`package.json` `engines`): the tests run TypeScript through
Node's built-in type stripping, with no compile step and no extra dependency.

## Releasing

`npm run kiadas -- <version>` from `develop` — see `docs/kiadas.md`. The running
version is shown under the palette; it comes from `package.json`, baked in at
build time (`__APP_VERSION__`), and `tests/version.test.mjs` guards that no
version number is hand-written anywhere.

## Files

| File | What it owns |
|---|---|
| `src/core/stitches.ts`, `src/core/stitchText.ts`, `src/core/types.ts` | The stitch library: names per notation, structure, the palette sections. |
| `src/core/freeform.ts` | The free-form chart: placed stitches with their positions. |
| `src/ui/main.ts` | Entry point: language, symbol style, palette, New, keyboard shortcuts. |
| `src/ui/freeform-board.ts` | The drawing area: draws the chart and reports clicks. |
| `src/ui/symbols.ts` | The parametric stitch symbols, CYC and JIS. |
| `src/ui/palette.ts` | The palette built from the stitch library. |
| `src/ui/notation.ts`, `src/ui/i18n.ts`, `src/ui/i18n/` | Symbol style, interface language, and every user-facing string. |
| `public/.htaccess` | Security headers and caching. |

## Core and interface

`src/core/` is DOM-free and imports only from its own folder
(`tests/core-boundary.test.mjs`, `tsconfig.core.json`). Only erasable TypeScript
syntax is allowed (`erasableSyntaxOnly`), because Node strips the types itself.
