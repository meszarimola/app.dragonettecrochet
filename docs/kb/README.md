# Developer knowledge base — index

Engineering decisions and incidents. **Crochet domain knowledge lives elsewhere**:
`docs/knowledge-base/`, cited by section code (`06 §5.2`).

Read **only the section your task touches**, and address it with the command
rather than opening a file:

```bash
npm run kb                     # every developer section, one line each
npm run kb -- interface        # the sections of one file
npm run kb -- interface 4 51   # those two sections, in full
npm run kb -- --horgolas       # the crochet index
npm run kb -- 04 4.4           # one crochet section
```

The whole developer index is about 4k tokens and an average section about 350;
`interface.md` read whole is 25k. That is the entire reason this index exists.

| File | Read it when |
|---|---|
| [decisions.md](decisions.md) | Wondering why something is built the way it is |
| [core-geometry.md](core-geometry.md) | Layout, grid, graph, editing, the technique generators |
| [core-domain.md](core-domain.md) | Stitches, gauge, validation, the written pattern |
| [core-support.md](core-support.md) | Quantities, yarn estimates, polygons, colourwork, history |
| [interface.md](interface.md) | Working on `src/ui/`, the canvas, the panels or the stylesheet |
| [dictionaries.md](dictionaries.md) | Working on `src/ui/i18n/` — how a core code becomes a sentence |
| [incidents.md](incidents.md) | Before any worktree, release or bulk change |
| [owner-decisions.md](owner-decisions.md) | A test asserts a behaviour and you want to know who asked for it |
| [testing.md](testing.md) | A test fails in a way you did not expect |

## Conventions

- One heading per decision, numbered `§N`, so code can cite it stably.
- Never renumber a section. Mark it `(withdrawn)` and add a new one.
- Write down the **why** and the evidence, not the what. The code is the what.
- A citation may address a **numbered item inside** a section: `03 §9.8` is the
  eighth item of §9 where the crochet knowledge base has no §9.8 heading. The
  command resolves both forms, and prints which item was meant.
- `tests/kb-references.test.mjs` checks every citation in the repository — source,
  docs, rules, skills — so a renumbered section fails the suite rather than
  rotting quietly.
