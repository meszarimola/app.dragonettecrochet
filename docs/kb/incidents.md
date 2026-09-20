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
