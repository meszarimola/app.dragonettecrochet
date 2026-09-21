# Owner decisions

Decisions the owner made about how the editor should behave, recorded **in the
owner's own words**. They used to sit in the header comments of the e2e specs;
`.claude/rules/comments.md` says rationale belongs here, and a decision is the
clearest case of that rule — those comments were not explaining the code, they
were recording why a behaviour was chosen.

**The quotations stay in Hungarian on purpose.** A translated quotation is no
longer evidence of what was said; it is a paraphrase wearing quotation marks.
Everything around a quotation — the decision, the ticket, what the tests check —
is English. Quotations are marked with „ ” guillemets, which is also what the
`.githooks/pre-commit` language check strips before judging a line.

Each section states the decision in English and, where the owner put it in their
own words, quotes them verbatim. Cite a section from a spec as:

```ts
// KB: owner-decisions.md §5
```

## Conventions

- One heading per decision, numbered `§N`, so a spec can cite it stably.
- Never renumber a section. Mark it `(withdrawn)` and add a new one.
- Several specs may cite the same section. Prefer that over a near-duplicate.

---

## §1 The foundation chain stays editable while the work goes on

**Decided:** a chain stitch can be inserted into the foundation chain by
clicking between two stitches, at any point in the work. Undoing back to the
foundation must not be the only way to lengthen it.

**Ticket:** PQW-941.

> „a második sor végéhez érve jövök rá, hogy az alap az nem elég hosszú, még
> kéne láncszem – viszont ezt csak úgy tudom módosítani, hogy ha undo-val
> visszamegyek az alaphoz… használhatóság szempontjából borzasztó rossz.”

**What the tests check** (`e2e/beszuras-alapsor.spec.ts`): with row 2
half-finished, a click on the line between chain stitches 2 and 3 inserts one
chain stitch, row 2 keeps the stitches already worked, and a single undo takes
the insertion back. The insertion leaves an empty cell above it in row 2, and a
stitch can still be placed into that cell afterwards (PQW-950).

## §2 The single crochet symbol is the plus sign

**Decided:** the single crochet is drawn as `+`, not `×`, and the symbol is no
longer a separate choice — it follows from the symbol style.

**Ticket:** PQW-929.

> „a rövidpálca jele legyen a + jel. ne az x”

**What the tests check** (`e2e/felulet.spec.ts`): the interface offers no
separate single crochet symbol chooser, and an earlier „×” left behind in the
browser storage cannot bring the old symbol back. The geometry of the symbol
itself is a unit test (`tests/ui-symbols.test.mjs`); the spec is about the
interface.

## §3 The program does not chat

**Decided:** the message box carries warnings only. Ordinary actions get no
feedback, and a tooltip appears only when it is explicitly asked for. A message
nobody reads is worse than no message.

**Tickets:** PQW-929 (first round of the UAT), PQW-932.

> „ne üzengess. a felhasználó nem figyel egy pillanatra, és nem látja az
> üzenetet.”

> „csak akkor írj ki tooltipet ha explicit kérem… senkit nem érdekel”

**What the tests check** (`e2e/figyelmeztetes.spec.ts`): turning and starting a
new pattern raise no pop-up — the state has to be read off the chart — while the
hidden live region still announces them to a screen reader. Laying stitches down
raises no message either. The warning asked for in PQW-923 stays, and the
mechanism is measured on it: the box pops up at the top, below the menu bar and
not over it, and disappears on its own after three seconds, while the persistent
indicator at the right end of the menu bar stays.

## §4 Findings are shown in the corner, not on the chart

**Decided:** errors and warnings are not marked on the chart by default; they
are only counted in the top right corner. Clicking a finding marks the stitch
on the chart in red dashes, and the marking disappears after five seconds.

This partly reverses PQW-923, where the click did not highlight because every
circle was on the chart by default anyway — and that is what made it crowded.

**Ticket:** PQW-930.

> „a rajzon ne is legyen megjelölve a hiba, vagy figyelmeztetés, csak a jobb
> felső sarokban… ha rákattint a felhasználó és kiválasztja a hibát, akkor a
> mintán jelölje meg pirossal, de piros szaggatottal és 5 mp múlva tűnjön el”

**What the tests check** (`e2e/figyelmeztetes.spec.ts`): the chart carries no
highlight until a finding is clicked. The click marks but does not *select* —
the buttons tied to a selection stay inactive — and after five seconds the
marking is gone, so it does not stay there in the way. An unworked tail left on
the foundation chain is a warning, not an error, and the finding card carries no
knowledge-base reference.

## §5 Making a pattern is not continuous

**Decided:** stitches may be placed in any order. Going back to a place skipped
earlier is filling a gap, not a crossed stitch, so there is nothing to ask
about; and an increase goes into the stitch that was clicked even when that
means moving backwards along the row. This is pattern *making*, not crocheting
in real time.

**Tickets:** PQW-932, PQW-933.

> „a sort úgy és olyan formában hozza létre, olyan sorrendben, ahogy csak
> akarja”

> „abba szaporítson, amelyikbe kattintok, még ha az visszafele haladást is
> jelentene — de ez mintakészítés, nem aktuális horgolás, tehát szabadon lehet
> visszafele módosítani”

**What the tests check** (`e2e/figyelmeztetes.spec.ts`,
`e2e/visszafele.spec.ts`): stepping back onto a target skipped earlier puts the
stitch down without a question and raises no finding. Clicking a target that
already holds a double crochet increases *there*, not at the end of the row, and
the stitches already laid down keep their places.

## §6 A stitch keeps the base it was crocheted into

**Decided:** the two legs of an increase open from the one chain stitch that was
clicked. Nothing may slide off its original base, and the whole stitch stays
inside its own cell.

**Ticket:** PQW-933.

> „ne csússzon el a pálca eredetileg horgolt helye: maradjon a megfelelő
> láncszemből kiindulás és az egész ugyanabba a négyzetben/cellában maradjon”

**What the tests check** (`e2e/visszafele.spec.ts`): a leaning stitch is
revealed by the bounding rectangle of its symbol — an upright double crochet is
one symbol wide (21 pixels), a leaning one reaches from its base to its top.
After an increase only the two legs lean, and each of their symbols sits over
the clicked column. Before the fix three stitches leaned, and the double crochet
next to the filled-in stitch grew to 46.5 pixels wide, because its base stayed
on one chain stitch while its top moved onto another.

## §7 Turning lays down nothing; the first stitch brings the turning chain

**Decided:** turning must not drop a floating chain into the new row. It opens
the grid of the next row and nothing else. The first stitch added then appears
as the turning chain that suits it: a single crochet as one chain stitch, a half
double as two, a double crochet as three.

**Ticket:** PQW-944.

> „a program nyit egy új sort, aminek az elejére egy ilyen lebegőként beletesz
> egy láncot. ez így nem jó, vedd ezt ki és a 3. sor gridje jelenjen meg… ha
> rövidpálcát tesz hozzá, akkor ne rövidpálca jelenjen meg, hanem egy láncszem;
> ha félpálcát, akkor két láncszem; ha erp-t, akkor három láncszem.”

**What the tests check** (`e2e/fordulas.spec.ts`): after turning there is not a
single symbol in row 3, but its grid is there with all 11 of its cells. The
first single crochet added comes out as one chain stitch, and the next stitch is
already a single crochet — the swap applies to the first one only. After turning,
the arrow marker and the row's own label make it visible that row 3 is next
(PQW-946).

## §8 The vertical turning chain occupies a single cell

**Decided:** the turning chain that stands up at the start of a row is one cell
in the row in progress, not one per chain stitch.

The chain stitches of the turning chain stand one above the other, but as
targets they appeared separately, so the drawing cut the same column
horizontally into several cells — including zero-width ones in between.

**Ticket:** PQW-943.

> „a 2. sorban ott két cella van, és egy kellene legyen.”

**What the tests check** (`e2e/fordulolanc-cella.spec.ts`): with 10 chain
stitches of which 3 stand up vertically into one column, the row in progress
gets 10 − 3 + 1 = 8 cells. Before the fix it was 10, because all three chain
stitches of the turning chain asked for a separate cell on the same x. The
printed stitch count of the foundation chain follows the same arithmetic (§11).

## §9 The chain stitch goes where the crocheter points

**Decided:** a chain stitch lands in the cell that was clicked, exactly like a
double crochet. Skipping worked for the double crochet but not for the chain
stitch.

**Ticket:** PQW-935.

> „azt vártam volna, hogy ha a másodikba klikkelek, amit a köröcske jelöl, hogy
> ott az egér, akkor abba a cellába tegye a láncszemet.”

The measurement before the fix: the chain stitch always went to the end of the
row regardless of the cursor — bit for bit the same place with the cursor set to
target 9 and to target 6.

**What the tests check** (`e2e/lancszem-helye.spec.ts`): the chain stitch goes
into the clicked cell rather than to the end of the row, and clicking two
different cells puts the chain stitch in two separate places.

## §10 The chain arc stretches; the single crochet is what is fixed

**Decided:** in a shell pattern the single crochets are anchored to the stitches
below them and may not be compressed; the chain stitches between them bridge the
gap as an arc, each getting its own cell.

The owner's example: one single crochet, 5 chain stitches, and the next single
crochet into stitch 5 of the row below — 3 skipped stitches below, 5 chain
stitches above.

**Ticket:** PQW-951 (with PQW-952 and PQW-953).

> „ha beillesztem a következő rövidpálcát, akkor ilyen csúnyán adja ki a
> mintakészítő… a rövidpálca az ami rögzített, azt nem tudjuk tömöríteni.”

**What the tests check** (`e2e/lancszem-iv.spec.ts`): the single crochets stay
in their own columns above the foundation chain, the row does not hang over the
foundation chain at either end, the five chain stitches do not slide into one
another (the arc gets five cells, not three), and the middle of the arc stands
higher than its two ends. The same holds when the chain stitches are placed
between already finished single crochets afterwards (PQW-952), and a fan worked
into the chain arc keeps row 3 on the fabric (PQW-953).

## §11 The stitch count of a row counts every stitch in it

**Decided:** the number printed on a row's label includes the stitch that came
from the row below and the chain stitches as well.

**Tickets:** PQW-940, and PQW-942 for the foundation chain.

> „úgy gondolom, hogy nem számolja a kezdő szemet, ami az 1. sorból jött, és nem
> számolja a láncszemeket sem, pedig azt is kellene.”

The owner's row in v0.31.0 was labelled (13). From right to left it holds:
1 turning chain, 2 single crochets, 2 double crochets, 3 dc into one stitch,
3 chain stitches, 3 dc into one stitch, 3 chain stitches, 3 dc into one stitch,
2 chain stitches — 22 in total.

**What the tests check** (`e2e/szemszam.spec.ts`): the label of row 2 says 22,
and the written pattern says the same number as the label on the chart. The
foundation chain counts the column of the vertical turning chain too: after
10 chain stitches and one double crochet, 3 chain stitches stand up and the
foundation chain is 10 − 3 + 1 = 8 stitches (PQW-942, the arithmetic of §8).

## §12 The help text of the stitch palette is a promise

**Decided:** what the owner's own help text in the product says must be true.
It promises two ways to lay down the chain stitches, so Enter pressed **in the
chain count field** has to crochet them.

**Tickets:** PQW-915, with PQW-911.

> „Enterrel vagy a vászonra kattintva horgolod, a megadott számú láncszemmel.”

The global key handler bails out in every text field (PQW-911), so the Enter
pressed in the field was swallowed: the user typed 12, pressed Enter, and
nothing happened.

**What the tests check** (`e2e/irott-panel.spec.ts`): the stitches go down from
the keyboard alone, without a click on the canvas.

## §13 Filet and the grid section are switched off for the first round of the UAT

**Decided:** the „Filéhorgolás” pattern type — and with it every technique of
the „Rácsminta” section (filet, C2C, tapestry, graphgan, mosaic) — is switched
off for the first round of acceptance testing, together with the granny square.
The tests are **not** deleted: one skip block per spec is what goes away when
the type is switched back on.

No verbatim quotation is on record for this one; it is kept here because two
specs carried the same paragraph.

**Ticket:** PQW-925.

**What the tests check** (`e2e/racsminta.spec.ts`, `e2e/racsminta-2.spec.ts`,
`e2e/felulet.spec.ts`, `e2e/korok.spec.ts`): the grid specs are skipped by a
single block each, so they stay ready to run. In the interface only the regular
pattern type is active, the rest are inactive and marked; the sections of the
switched-off crochet kinds are not built into the panel at all; and the granny
square cannot be chosen in the motif chooser.

## §14 No circular repeat in the free-form designer

**Decided:** the free-form designer copies with „Másolás” only. The circular
repeat („Ismétlés”, „Körkörös ismétlés”) is removed.

> „értem, a körmásolást, de gyakorlati értelme nincs. ha valaki másolni szeretne
> körben - ott már a szemek száma nem fog stimmelni”

Every round has more stitches than the one before it, so a motif copied around
the centre can never have the right count. Two buttons for copying only
confused the user.

**Ticket:** PQW-1006. See `interface.md` §57.
