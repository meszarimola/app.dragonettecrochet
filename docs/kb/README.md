# Developer knowledge base — index

Engineering decisions and incidents. **Crochet domain knowledge lives elsewhere**:
`docs/knowledge-base/`, cited by section code (`06 §5.2`).

Read **only the section your task touches**. This index exists so you never have
to load the whole knowledge base into context.

| File | Read it when |
|---|---|
| [decisions.md](decisions.md) | Wondering why something is built the way it is |
| [core-geometry.md](core-geometry.md) | Layout, grid, graph, editing, the technique generators |
| [core-domain.md](core-domain.md) | Stitches, garments, gauge, validation, the written pattern |
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
