---
name: review
description: Review the branch's changes before opening a pull request on the pattern designer, with the checks this codebase needs beyond the usual ones. Use when finishing a ticket, before opening a PR, or when asked to review the work or look for bugs in the changes.
---

# Review the branch

Run the built-in review on everything this branch adds:

```
/code-review high
```

It reads the commits ahead of the upstream plus the uncommitted working tree. `high` is the right level here: the domain logic is dense, and a wrong stitch count reaches someone holding a hook.

Other forms: `/code-review high src/core/layout.ts` for one file, `/code-review high develop...HEAD` for a range, `/code-review high --fix` to apply the findings, `/code-review --comment <PR>` to post them on a pull request.

## Then check what a general review does not know about this repo

These are the failures that have actually happened here.

**Is the core still DOM-free?** `npm run check` proves it — the second pass drops the DOM lib entirely. If it passes, the boundary held.

**Did anything reach a frozen path?**

```bash
git diff --name-only develop... | grep -E '^(src/ui/i18n/|tests/fixtures/)'
```

Must be empty unless the ticket was about the interface text. No test compares dictionary values, so a changed string ships silently. In `e2e/` the rule is positional, not by path: a test title is developer text, but everything inside `getByRole`, `toHaveText` and friends is the interface the test drives.

**A new validation rule?** It needs `severity`, a developer `summary`, a user-facing `message` and a `reference` into the knowledge base — and at least one failing example, which an `after()` hook enforces. The `message` may not leak `réteg`, `darab` or a `§` code: the user never sees the knowledge base.

**Does a comment fight a meta-test?** `core-boundary.test.mjs` greps source with a regex that is not comment-aware, so an `import … from '…'` written in a comment reads as a real import. A block-comment continuation line without its leading `*` gets scanned as code. Deleting a comment can orphan an i18n key and fail the dead-key check.

**Did the count of non-null assertions rise?** `tests/non-null.test.mjs` fails if it did. Narrow the type or throw rather than raising the ceiling.

**Did the change make a `docs/kb/` or `docs/knowledge-base/` section stale?** Update it in the same PR.

**Did a conflict resolution touch the interface?** Green tests are not evidence that the app works — on 2026-09-15 a resolution dropped one `}` in `styles.css`, CI stayed green and the designer was unusable. Open it in a browser, once wide and once short.

## New comments earn their place

The policy is in `.claude/rules/comments.md`. A comment that restates the code, or repeats a decision already in `docs/kb/`, should not survive review. Point at the knowledge base by section instead — `// KB: 03 §10 B11`.

## Before the PR

Run `/pre-pr-check` for the type check, build, unit suite and the browser tests.
