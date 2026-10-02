# Incidents — things that already went wrong

## §1 A `node_modules` symlink in a worktree destroyed the shared install (2026-09-16)

In the sibling repo, dependencies were shared by symlinking the main checkout's
`node_modules` into each worktree. After `git worktree remove --force`, the main
checkout's `node_modules` was left as a symlink pointing at itself and the real
directory was gone.

Every npm script then failed with **exit code 194 and no output**, which read
exactly like "the merge broke the build".

**Rule:** every worktree gets its own `npm ci`. Never symlink `node_modules`.
**Recovery:** `rm -f node_modules && npm ci`.
**Symptom:** npm scripts failing with no compiler output — check `ls -ld node_modules`
before believing the code is broken.

## §2 A merge conflict dropped one brace and CI stayed green (2026-09-15, PQW-881)

Resolving a conflict in `styles.css` lost a single `}`. Every test passed, CI was
green, and the owner found the designer unusable.

**Rule:** when a branch merges `develop` with conflicts, **look at the running UI
in a browser** before merging — a wide window and a short one. Green CI is not
evidence that the interface works.

## §3 Two worktrees collide on the E2E port (ongoing)

`playwright.config.ts` serves on port 5181 with `--strictPort`, deliberately, so a
sibling worktree's server cannot be measured by mistake. The flip side is that two
worktrees running E2E at once will fail. Pass a different `PORT`.

## §4 The main site's version claim drifted by 30 minor versions (found 2026-09-19)

The main site's designer landing page — public and indexed — claimed this app was
at 0.14.0 while `package.json` said 0.44.0. Nothing detected it because nothing
compared the two repos.

**Rule:** when this app ships a release, the main site's landing page and its
feature list are updated in the same cycle.

## §5 Four ways the free-form build fooled itself (2026-09-19/20, PQW-966…975)

Nine tickets in one night, each reviewed before release. The same four mistakes
came back often enough to be worth naming.

**A test that cannot fail.** Three of them shipped: an export test asserting on
`data-row`, an attribute the exporter has never written; a render-timing test
dispatching a `resize` event nothing listens for; and a save test asserting that
storage had not changed, when no code path could have changed it. Each was
written to prove the feature beside it and proved nothing. **When a test is
meant to guard a rule, break the rule and watch it go red** — that is the only
thing that makes it a guard.

**Dead machinery that looks like care.** A debounced autosave was written for
"drags write on every frame". Drags do not write at all: they build a draft and
redraw. The debounce could never run, and its test could never fail. It was
deleted rather than polished. A performance fix that cannot fire is worse than
none, because it stops anyone looking again.

**A rule that only fits the gesture nobody uses.** ⌘ bypassed snapping "during a
drag", exactly as the spec words it. The owner places stitches; she found it
useless the first day. Read a requirement's wording against how the person
actually works, and when they disagree, say so before building it.

**The word that quietly changed meaning.** Making annotations items of the
`items` list broke every place that said *item* and meant *stitch* — counts in
two panels, the crochet order, a round's centre, arranging, a row's box, "this
row is empty". The type checker caught only the few that touched a stitch's own
fields. **When a union gains a member, grep every use of the union's name**, not
only the ones the compiler complains about.

Related: `interface.md §43, §51` and `core-geometry.md §52`.

## §6 `/review` from a worktree reviewed the wrong branch (2026-09-20, PQW-988)

Twice in one evening, during the UI redesign's three parallel worktrees.

`/code-review` reads the commits ahead of the current branch's upstream. Called
from a worktree it forks into the session's own working directory — the main
checkout, sitting on `develop`, where nothing is ahead of `origin/develop`
because everything is merged.

Once it reviewed **the previously merged pull request** and handed those findings
back to the author of a different branch. Once it stopped with "the current
branch has no commits yet" and asked which branch to look at. The first is the
dangerous one: a competent review of somebody else's merged work reads exactly
like a review of yours.

**Rule:** from a worktree, name the range — `/code-review high develop...HEAD` —
and check that the report names your files before believing it.

With one worktree this never shows. `CLAUDE.md` asks for a worktree on anything
over five files, so it will keep coming back whenever work runs in parallel.

## §7 Six agents in one worktree took each other's stash (2026-10-02, PQW-1100)

Six agents were dispatched into the **same** worktree. They shared one git index,
one stash, one `node_modules` and one port, which is contention rather than
parallelism.

Two of them collided on the stash: one ran `git stash push --keep-index` while
another ran `git stash pop`. The stash belongs to the repository, not to the
worktree, so each saw the other's entry. Recovering took 9.5 minutes. A browser
run was killed for its port after ten minutes, and what it would have reported went
with it.

The main session spent **34 of its 78 minutes waiting** on agents. The work they
were sharing — rewriting 28 browser specs with the same substitution — was
mechanical, and the locator inventory needed to script it had been built an hour
earlier.

**Rule:** one agent, one worktree, or the agents only read and the main session
writes. Never `git stash`, `git commit` or the test suite inside an agent. A
mechanical rewrite is a script. See `.claude/rules/agents.md`.

## §8 A fix that was ready in sixteen minutes shipped in none (2026-10-02, PQW-1100)

The report was that the app shows Hungarian after a switch to English. The fix — an
English default and an English fallback, 14 files — was committed at minute 16 and
worked.

It did not ship. The ticket had meanwhile taken on the migration of ~110 test files
to English, the locator-inventory infrastructure that needed, PQW-920 (the
generated title) and PQW-1102 (the main site's landing page). After 78 minutes it
stood at 137 files and 2650 changed lines, with nothing released and the browser
suite half migrated.

Migrating the tests was the owner's decision, offered against the cheaper option of
pinning the specs to `?lang=hu`. What the offer left out was its **price**: roughly
two hours rather than fifteen minutes, and the fix waiting behind it.

**Rule:** the fix and the clean-up are two tickets, and the fix goes out first. Over
15 files or more than one commit, split before starting. When the owner is offered
a choice, each option carries what it costs and what it delays.

## §9 The worktree close measured the local `develop` (2026-10-02, PQW-1121)

`npm run munkafa -- --zar <n>` refuses to delete a branch that is not in `develop`,
which is right. It measured the **local** `develop` ref, which right after a merge
is behind: the merge happens on the remote, and the local ref only follows a
`git pull`.

So the first real close after a merge failed — *"még nincs benne a develop-ban"* —
on a branch that had in fact been merged minutes earlier. The guard let nothing
dangerous through; it refused something safe, and the manual `git fetch && git pull`
it forced back is exactly what the command exists to remove.

**Rule:** a check about "has this been merged" measures the **remote** ref, with the
local one only as the offline fallback. `mergeBase()` decides that, and
`tests/munkafa.test.mjs` pins both branches of it.

The wider lesson is the one §5 already names from the other side: a guard that
refuses safe work gets worked around, and a worked-around guard protects nothing.
