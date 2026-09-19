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
