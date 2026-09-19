# Pattern designer (app.dragonettecrochet.com) — project guide

## What this project is

A crochet **stitch-chart editor** for the patterns of
[Dragonette Crochet](https://dragonettecrochet.com). Vanilla TypeScript and
canvas, built with Vite. A separate repo from the main site because it gets its
own subdomain. The app itself is `noindex`; its indexable description is a
landing page on the main site.

| | |
|---|---|
| Live app | https://app.dragonettecrochet.com |
| Main site | https://dragonettecrochet.com — repo `meszarimola/dragonettecrochet` |
| Linear | project **Dragonette Crochet**, team `pearlyquality-web`, key `PQW` |
| Stack | TypeScript + canvas + Vite, Node ≥ 22.18, **zero runtime dependencies** |

## Non-negotiable rules

1. **A Linear ticket before any work.** `PQW-<n>` goes in the branch name, the
   commit message and the PR description.
2. **Gitflow:** `feature/PQW-<n>-<short-name>` or `fix/PQW-<n>-<short-name>` →
   PR into `develop` → release branch → `main`. Never commit directly to either.
3. **Every feature ships with tests**, in the same PR. All tests pass before merge.
4. **`src/core/` is DOM-free.** No `document`, `window` or canvas — it is pure
   domain logic, and `tsconfig.core.json` type-checks it without the DOM lib to
   prove it. `src/ui/` owns everything that touches the browser.
5. **The core returns codes and data, never sentences.** User-facing text lives
   in `src/ui/i18n/`, so a new language touches only the dictionary.
6. **Developer text is English**: code, comments, test names, commit messages, PR
   descriptions, docs, skills and rules. **Hungarian stays** in user-facing
   strings (`src/ui/i18n/**`, rule `message` fields) and Linear tickets.
7. **Comments are a last resort.** Write one only where the code alone would
   mislead, and prefer a `KB: <section>` pointer over prose. See
   `.claude/rules/comments.md`.
8. **No hand-written version number anywhere.** The version comes from
   `package.json` through `__APP_VERSION__` at build time; `tests/version.test.mjs`
   guards it.

## Every ticket

1. **Read the knowledge bases, addressed.**
   - Developer decisions: the `docs/kb/README.md` index → only the section your
     task touches.
   - **Crochet domain:** if the change touches stitch, row, round, garment or
     validation logic, read the relevant `§` of `docs/knowledge-base/`. It is
     ~5000 lines — **never load it whole**, follow the section code.
2. **Size it.** More than 5 files, or independent parts → work in a worktree and
   split the parts across parallel agents.
3. **Work.** A new validation rule gets a `reference` pointing at the knowledge
   base section it comes from — `tests/core-validate.test.mjs` enforces this.
4. **Verify** — run `/pre-pr-check`.
5. **Update the knowledge base in the same PR** if the change made any section
   stale. This is what stops the docs drifting away from the code.
6. **PR**, update the Linear ticket, merge into `develop` when green.

## Worktrees

- One worktree per branch:
  `git worktree add ../app-dc-<short-name> -b fix/PQW-<n>-<short-name> develop`
- **Each worktree gets its own `npm ci`. Never symlink `node_modules`** — that
  destroyed the shared install in the sibling repo on 2026-09-16.
- **The git stash is shared** across worktrees: use a temporary WIP commit.
- Two worktrees running E2E **collide on port 5181**. Pass a different `PORT`.

## Where to find more

| Topic | Where | Loads |
|---|---|---|
| Frozen paths — never edit these | `.claude/rules/frozen-paths.md` | always |
| Comment policy | `.claude/rules/comments.md` | always |
| The core/UI boundary, domain logic | `.claude/rules/core.md` | with `src/core/**` |
| Interface, canvas, i18n | `.claude/rules/ui.md` | with `src/ui/**` |
| Test conventions and their traps | `.claude/rules/tests.md` | with tests and E2E |
| Decisions, rationale, past incidents | `docs/kb/` | **on demand only** |
| **Crochet domain knowledge** | `docs/knowledge-base/` | **on demand, by `§` code** |
| Pre-PR verification | `/pre-pr-check` | on invocation |
| Ticket, branch and worktree workflow | `/ticket-workflow` | on invocation |
| Releasing and rolling back | `docs/kiadas.md` | read before releasing |

Single sources of truth: `package.json` (version), `src/core/rules.ts` (validation
rules and their knowledge-base references), `src/ui/i18n/` (every user-facing
string), `docs/knowledge-base/` (crochet domain).
