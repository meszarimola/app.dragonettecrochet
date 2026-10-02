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
   descriptions, docs, skills and rules. User-facing strings live in
   `src/ui/i18n/**` (and the rule `message` fields) in **both** languages;
   **English is the default and the fallback** (PQW-1100). Linear tickets stay
   Hungarian.
7. **Comments are a last resort.** Write one only where the code alone would
   mislead, and prefer a `KB: <section>` pointer over prose. See
   `.claude/rules/comments.md`.
8. **No hand-written version number anywhere.** The version comes from
   `package.json` through `__APP_VERSION__` at build time; `tests/version.test.mjs`
   guards it.

## Every ticket

1. **Read the knowledge bases, addressed — with `npm run kb`, not by opening a
   file.** `npm run kb` lists every developer section in about 4k tokens;
   `npm run kb -- interface 4 51` prints just those two. For the crochet domain,
   `npm run kb -- --horgolas` and `npm run kb -- 04 4.4`; it is ~5000 lines, so
   **never load it whole**. Put the sections you used in the ticket comment, so
   what was read — and what was not — is on the record.
2. **Size it, and split before starting.** More than 5 files → a worktree
   (`npm run munkafa`). **More than ~15 files, or more than one commit → two
   tickets:** a `fix` for the reported problem and a `chore`/`refactor` for the
   clean-up it reveals, and **the fix ships first**. Work found mid-ticket is a new
   ticket, never an extra commit on this branch. KB: incidents.md §8
   Independent parts may run in parallel agents — `.claude/rules/agents.md` says
   under what conditions, and a mechanical rewrite is a script, not an agent.
3. **Work.** Read files with `Read` and change them with `Edit` or `Write` — not
   `cat`, `sed -i` or a `python3` heredoc. Half as many steps, an undo history,
   and the frozen-path guard actually runs. A new validation rule gets a
   `reference` pointing at the knowledge base section it comes from —
   `tests/core-validate.test.mjs` enforces this.
4. **Verify** — `npm run kapu` (about 45 s), then `/review` and `/pre-pr-check`.
5. **Update the knowledge base in the same PR** if the change made any section
   stale. This is what stops the docs drifting away from the code.
6. **PR**, update the Linear ticket, merge into `develop` when green.

## Worktrees

- **One command, not six steps:** `npm run munkafa -- <n> <short-name>`, with
  `--fix` for a bug fix. It branches from `develop`, gives the worktree its own
  `node_modules` in about a second, and writes it a port of its own that
  `npm run kapu` reads. `npm run munkafa -- --zar <n>` closes it, and refuses
  while the tree is dirty or the branch is not yet in `develop`.
- **Each worktree gets its own `node_modules`. Never symlink it** — that destroyed
  the shared install in the sibling repo on 2026-09-16. A copy-on-write clone is
  not a link, which is why the command is allowed to use one.
- **The git stash is shared** across worktrees: use a temporary WIP commit.
- Two worktrees running E2E **collide on port 5181** — that is what the port in
  `.env.local` exists to prevent. Never hard-code a port into a run.

## Where to find more

| Topic | Where | Loads |
|---|---|---|
| Frozen paths — never edit these | `.claude/rules/frozen-paths.md` | always |
| Comment policy | `.claude/rules/comments.md` | always |
| When a parallel agent helps, and when it costs | `.claude/rules/agents.md` | always |
| The core/UI boundary, domain logic | `.claude/rules/core.md` | with `src/core/**` |
| Interface, canvas, i18n | `.claude/rules/ui.md` | with `src/ui/**` |
| Test conventions and their traps | `.claude/rules/tests.md` | with tests and E2E |
| Decisions, rationale, past incidents | `docs/kb/` | `npm run kb`, by section |
| **Crochet domain knowledge** | `docs/knowledge-base/` | `npm run kb -- --horgolas` |
| The gate: every check CI runs | `npm run kapu` | before every commit |
| Reviewing the branch before a PR | `/review` | on invocation |
| Pre-PR verification | `/pre-pr-check` | on invocation |
| Ticket, branch and worktree workflow | `/ticket-workflow` | on invocation |
| Releasing and rolling back | `docs/kiadas.md` | read before releasing |

Single sources of truth: `package.json` (version), `src/core/rules.ts` (validation
rules and their knowledge-base references), `src/ui/i18n/` (every user-facing
string), `docs/knowledge-base/` (crochet domain).
