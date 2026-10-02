# Parallel agents

Agents are for work that is genuinely independent. Six of them in one working
tree is not parallelism, it is contention: they share one git index, one stash,
one `node_modules` and one port.

## The rule

**One agent, one worktree — or the agents only read.**

`npm run munkafa -- <n> <short-name>` takes about three seconds, so there is no
longer an excuse for sharing a tree. If agents do share one, they may read,
search and report; the main session makes every change.

**Never in an agent**, in a shared tree or its own:

- `git stash` in any form. The stash belongs to the repository, not to the
  worktree, so one agent's `pop` takes another's work. Use a WIP commit.
- `git commit`. The main session owns the history and the ticket number.
- the test suite. One run at the end beats six overlapping ones, and two
  Playwright runs collide on a port even with separate trees.

## Not every fan-out wants an agent

A mechanical rewrite — the same substitution across forty files — is a **script**.
It is faster, it is reviewable as a diff, and it either applies everywhere or
fails loudly. An agent will instead make forty judgement calls you cannot see.

Reach for agents when the parts need judgement and do not touch the same files.
Say in the prompt which files each one owns.

## What this is based on

PQW-1100 ran six agents in one worktree. Two collided on the stash — one pushed
while another popped — and recovering took 9.5 minutes. A browser run was killed
for its port after ten minutes, losing what it would have reported. The main
session spent 34 of its 78 minutes waiting. The rewrite of 28 browser specs that
the agents were sharing was mechanical, and the inventory needed to script it had
just been built. KB: incidents.md §7
