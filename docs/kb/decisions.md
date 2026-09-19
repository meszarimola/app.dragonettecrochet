# Engineering decisions

## §1 The core is DOM-free, and that is type-checked

`src/core/` holds pure domain logic. `npm run check` type-checks it twice: once
normally, once through `tsconfig.core.json`, which drops the DOM lib and sets
`types: []`. The second pass is what makes the boundary real rather than a
convention — a stray `document` reference cannot compile.

`tests/core-boundary.test.mjs` adds the other half: the core may not import from
`src/ui/`.

## §2 The core returns codes, never sentences

A `Finding` carries a rule id, a severity and data — not text. The UI dictionary
turns it into a sentence. Two consequences: the core stays language-independent,
and adding a language touches only `src/ui/i18n/`.

## §3 The user never sees the knowledge base

Rule messages use the user's vocabulary ("szem"), never an internal term
(`réteg`, `darab`) and never a knowledge-base code. The reference appears only in
a collapsible detail.

The owner put it plainly during UAT (PQW-930): the end user *"fogalma sincs a
tudásbázisról és egyébként nem is érdekli"*. `tests/core-validate.test.mjs`
enforces it with a regex on every rule message.

## §4 Do not announce, confirm or guard unasked

No toast after an operation, no confirmation dialog before something the user
clicked, no progress markers, no error circles drawn on the chart. All of these
were added at some point and all were removed at the owner's request.

The reasoning (owner, 2026-09-17): every one of them was the program deciding the
user needed telling. She is the expert; unasked feedback is not helpfulness, it is
noise she then has to pay to remove.

The same applies to workflow: a pattern is created in whatever order the user
likes, so sequential progress is never required.

## §5 The version is never written by hand

`vite.config.ts` reads `package.json`'s `version` into `__APP_VERSION__` at build
time, and the UI renders it in the corner. After a deploy you can see at a glance
whether the page actually updated. `tests/version.test.mjs` fails on any literal
version string in the source or `index.html`.

## §6 Validation strictness is a product decision, not a correctness one

The owner's UAT verdict (PQW-930): *"nagyon szigorúan vetted a minták
elkészítését. a való életben ez sokkal lazábban működik"*. A long unworked tail
from the foundation chain is a **warning**, not an error. A gap in the **middle**
of a row stays an error — there the hole is not a matter of style.

When in doubt about severity, that is the test: is it a choice a crocheter could
plausibly make on purpose?

## §7 Biome here, ESLint on the main site

Biome and oxlint parse only the frontmatter fence of an `.astro` file, which is
why the main site uses ESLint. This repo has no `.astro` at all: 217 files of
plain TypeScript with zero runtime dependencies. Biome checks all of it in about
**a tenth of a second**, against ESLint's several seconds, and needs one binary
and one config instead of five packages and a plugin graph.

The two repos share the **style contract** — 120 columns, single quotes,
semicolons, trailing commas, always-parenthesised arrows — not the binary. There
is no monorepo and no shared code, so a shared config would be two copies that
drift anyway.

The step runs inside the existing `build` job, before the type check. The `e2e`
job owns the critical path, so this adds nothing to the wall clock.

**Excluded:** `tests/fixtures/**` and `src/ui/i18n/**`. A formatter does not
change a string value, but those are the frozen paths and keeping them outside
the tool means no one has to reason about whether a reformat was safe.

Two rules are lowered rather than switched off, so the findings stay visible:

- `useIterableCallbackReturn` (31) and `noVoidTypeReturn` (10) are warnings until
  PQW-956 decides how many are real bugs. **Do not turn them off** — a callback
  in `.map` or `.filter` that returns nothing gives a silently wrong result.
- `noAssignInExpressions` (6) is a warning. Five are the `(arr[i] ??= []).push(x)`
  idiom, which is clear. The sixth, in `round-generator.ts`, uses `reduce` with a
  comma operator purely for its side effect, and that one is worth rewriting.

## §8 The non-null assertion ceiling

`noNonNullAssertion` is off, and `tests/non-null.test.mjs` caps the total at 777
instead. A warn-level rule would emit 777 warnings that nobody reads and would
train everyone to ignore the warning channel; an error-level rule would be a
permanently red build. Neither is auto-fixable: every fix is a real decision, and
in `layout.ts` they sit in canvas render paths where a runtime guard changes both
behaviour and cost.

The count comes from the TypeScript compiler API, not a regex — a regex cannot
tell `a!.b` from `a !== b`, and undercounted by four.

The test also fails if the count drops by more than 40 without the ceiling being
lowered, so a real improvement gets locked in rather than quietly leaving room to
regress.
