---
name: ticket-workflow
description: The Linear ticket, git branch and worktree workflow for Dragonette Crochet. Use when starting new work, creating a branch or worktree, opening a PR, merging into develop, or releasing to main.
---

# Ticket, branch and worktree workflow

## 1. The ticket comes first

Team `pearlyquality-web`, project **Dragonette Crochet**. Create it from the
session with the Linear MCP — do not leave it to the user.

Hungarian title and description, assignee set, **one** label (`Feature`,
`Improvement`, `Bug`, `Legal`, `Accessibility`, `Research`). Describe *what* and
*why*; list the concrete work under `## Tartalom`.

If work was requested without a ticket, create it first, then name the branch
after it.

**States:** `Dev` / `Todo` = backlog · `In Progress` as soon as the branch exists
· `In Review` when the PR is open, and it stays there after the merge into
`develop` · `Released` **only** once the change is on production. Never mark a
ticket `Released` because it reached `develop`.

**Scope stays fixed.** Work discovered mid-ticket becomes a **new** ticket
(`Dev`), linked with *related* or *blocks*. Decisions that need the owner —
removing a URL, loosening the CSP, changing legal text — go into a ticket, never
made silently.

## 2. Once per clone

The commit gate lives in `.githooks/`, and git does not pick that up on its own:

```bash
git config core.hooksPath .githooks
```

A worktree inherits it, because worktrees share the repository config — so this
is needed once per clone, not once per branch. Without it the pre-commit checks
simply never run, silently.

## 3. The branch

```bash
git worktree add ../app-app-dc-<short-name> -b feature/PQW-<n>-<short-name> develop
cd ../app-app-dc-<short-name>
npm ci
```

Branch names: ASCII, lowercase, Hungarian without accents. Do **not** use the
`imolameszar/pqw-…` name Linear suggests.

**Never symlink `node_modules`.** Removing such a worktree destroyed the main
checkout's install on 2026-09-16 — see `docs/kb/incidents.md` §1. Each worktree
runs its own `npm ci`.

**The git stash is shared** across worktrees. Use a temporary WIP commit instead
of a bare `git stash` / `git stash pop`.

Work in a worktree when the task touches **more than 5 files** or splits into
independent parts. Independent parts can run in parallel agents, each with its
own worktree.

## 4. Commits and the PR

```
feat: <Hungarian message> (PQW-<n>)
```

Prefixes: `feat:` / `fix:` / `docs:` / `chore:`. **Commit messages are in
English from 2026-09-19 onward** — older Hungarian messages stay as they are, the
history is not rewritten.

Open the PR into `develop` with `PQW-<n>` in the description so Linear links it,
and attach the PR URL to the ticket as a link titled `PR #<n>`.

Run `/pre-pr-check` before opening it. Never merge while CI is red. This repo
is public, so branch protection is available and the CI check is required on
`develop` and `main`; the local pre-commit hook catches problems earlier.

## 5. On merge into `develop`

Comment on the ticket with what shipped and what is still open. Then clean up:

```bash
git worktree remove ../app-app-dc-<short-name>
git branch -d feature/PQW-<n>-<short-name>
```

A branch session cannot remove its own worktree — the coordinating session does
it.

## 6. On release (`develop` → `main` + deploy)

The release is **one command** — do not do the steps by hand:

```bash
git checkout develop && git pull
npm run kiadas -- --proba      # full rehearsal: every check and the build, changes nothing
npm run kiadas -- <version>    # version bump, both merges, build, deploy, verify
```

If something goes wrong: `npm run visszaallitas -- <previous>` restores the last
release, `npm run kiadas -- <version> --ujra` reinstalls the same one. Full
runbook: `docs/kiadas.md`.

Version numbering: 0.x releases go in order; **the owner alone decides when 1.0
happens.** Never declare GA.

**When a release ships, update the main site's designer landing page in the same
cycle** — its version and feature list describe this app, and they have already
drifted by 30 minor versions once (`docs/kb/incidents.md` §4).

Move every ticket that went out to `Released`, with the deploy date in a comment.
Releases go through the coordinating session with the owner's go-ahead — never
from a branch session.
