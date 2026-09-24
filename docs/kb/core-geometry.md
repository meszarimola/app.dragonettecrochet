# Core geometry and editing — engineering decisions

Why the geometry and editing half of `src/core/` is built the way it is: the
layout, the grid, the graph, the editor, selection, shapes, and the technique
generators (rounds, raglan, ribbing, filet, C2C, mosaic, pixel charts).

This file holds **engineering** decisions only. Crochet domain knowledge stays
in `docs/knowledge-base/`, cited by section code (`03 §5.5`); the source cites
it the same way, as `// KB: 03 §5.5`. A section here is cited from the source as
`// KB: core-geometry §7`.

Written 2026-09-19 (PQW-958), by moving out of `src/core/` every comment that
recorded a decision, a constraint, a past bug or a trade-off. The rest of the
comments were deleted: the code is the source of truth.

Convention, as in the rest of `docs/kb/`: one heading per decision, numbered
`§N`, never renumbered. A superseded section is marked `(withdrawn)` and
replaced by a new one.

## §1 The two foundation-chain counts must come from one skip calculation

`repeat.ts` reports a foundation chain from two entry points: `foundationChainLength`
for a plain row and `repeatCounts().chains` for a stitch pattern. **PQW-924:** the two
drifted apart, so the same pattern reported two different chain counts depending on
which one the editor asked. Both now derive the allowance from a single call to
`skippedChains(turningChain, turningChainCounts)`; changing one without the other
brings the bug back.

The same ticket fixed `firstRowPositions`. Skipped chains are not stitches, so row 1
offers exactly as many positions as there are chains actually worked into — it equals
`workedChains` and never gains one for a counting turning chain. An earlier comment
claimed it did; the code never agreed, and a `+1` there would make the position count
disagree with the row's real anchors.

## §2 Insertion mode is stored in the right-side view, not the crocheter's

There are two views of the same mode and both are needed. The crocheter's view is what
the user picks, what the written pattern says and what a stitch definition lists in
`insertionModes`. The right-side view is what an anchor stores and what the chart
draws, because charts depict the right side of the fabric.

On a wrong-side row the two differ: loops and posts swap. `modeAsWorked` converts
between them, and because the swap is its own inverse (front loop ↔ back loop,
front post ↔ back post, both loops fixed) one function serves both directions —
there is deliberately no second, "unflip" function. Crochet source: 03 §2.1,
01 §4.3, 01 §8.4 rule 21.

`insertion.ts` is listed in `CORE_EXCEPTIONS` (PQW-900), which is why its Hungarian
name table is allowed to stay in the core.

## §3 The grid is derived from the layout, and the two share one bounding box

`grid.ts` never computes geometry of its own. It calls the layout and reads cells off
it, with two deliberate restrictions:

- **Manual pins are removed first.** A pin moves a symbol on the drawing only; if the
  grid followed it, the cells would drift away from the positions the editor targets.
  So the grid is built from the pattern with `pinned` stripped and does not move with a
  pin.
- **The layout is requested straight** (PQW-893). For a curved or broken row shape the
  grid is computed on straight rows and curved afterwards, so cell geometry and row
  geometry come from the same source.

Because of this the spacing constants in `grid.ts` (`DEFAULT_COLUMN`, `HALF_GAP`,
`CHAIN_REACH`, `RING_REACH`) have to track the layout's own defaults. They are
duplicated, not imported, and a change to the layout defaults has to be mirrored here
or the bands stop lining up with the symbols.

**PQW-887:** fit-to-view and export use `chartBounds`, the union of the drawing's box
and the grid's. The working row's band extends beyond the last drawn symbol, so using
the drawing's box alone clipped the band the crocheter is working in.

## §4 Columns of a closed row, and the empty cells in them

A closed (already finished) row gets one column per position, plus two additions.

**Target stitches that stand elsewhere.** In the row directly below the working row,
a target may be drawn outside that row's own positions — the unworked end of the
foundation chain is drawn inside row 1's turning chain but is still a target. Those get
a column too, otherwise they would be unclickable. Chain stitches stacked at the same
place collapse into one column and the first one is the target.

**Empty cells (PQW-950).** A position of the row below that this row did not work into
gets a cell with no stitch, so the crocheter can go back and fill it. The owner's
report: *"if I want to go back to the second row to put a stitch above the chain I just
inserted into row 1, I cannot."*

Two positions are deliberately excluded, because neither is a hole in the fabric:

- **The top of the row below's turning chain** (PQW-944). It is a legal target but not a
  required one, and patterns made under the earlier rule run past it.
- **A stitch bridged by a chain** (PQW-951) — but only one bridged *between* the two ends
  of the row. A stitch skipped before the row's first or after its last stitch is the
  edge of shaping (a decrease), and the crocheter can still come back to it, so it keeps
  its empty cell.

## §5 A foundation chain's underside shares its chain's cell

**PQW-899.** The underside of a foundation chain is a separate target, but it is drawn
at the same place as the chain itself. Giving it a cell of its own would put two cells
on one spot, so it contributes none and the chain keeps the cell.

For drawing, the underside point is placed one chain-width across the chain, on the
side opposite the stitch worked into the front of it. With no such stitch yet, it falls
below the chain.

## §6 The working row gets one column per placed stitch, not per target

**PQW-931.** The working row used to get one column per target, so the members of an
increase shared their target's cell: with 11 stitches placed the owner saw only 9
squares. Measurement showed the row got its 11 cells correctly *after* turning — the
fault existed only in the working row, which is exactly the state the crocheter is
looking at. Now every placed stitch gets its own column at its own position, and each
still-empty target gets one above the target.

Every one of those columns keeps its `slot`, so clicking anywhere in the widened area
keeps increasing into the same target.

**The turning chain is the exception (PQW-943).** Its chains stand above one another in
one column but are separate targets. Projected onto the horizontal axis each would ask
for its own column at the same x, and the row split into two or three cells, some of
zero width — the owner's report: *"there are two cells there and there should be one."*
The turning chain therefore gets exactly one cell, pointing at the top of the stack,
because targets start at the topmost chain.

## §7 A chain arc takes over the cells of the stitches it bridges

**PQW-951.** An arc is made of more chains than the stitches it bridges, so the cells of
the targets underneath are not enough: five symbols do not fit into three cells. The
owner: *"if more cells are needed, then let it be so… it is just that there are 3 below
and 5 above."*

The arc's chains take those cells over — as many cells as there are chains, spread
evenly over the same stretch. Each keeps a `slot` pointing at the nearest bridged
stitch, so clicking the arc still works into the stitch below it.

## §8 The turning chain sets the band's width but not its height

**PQW-931.** The turning chain crosses the row boundary: its lowest chain sits in the
band of the row below (see §15). If it also set the band's height it would drag the band
down with it, the band would overlap the row below, cells would collide and targeting
would break. The trial showed this immediately. So the band's vertical extent is
measured from the row's stitches with the turning chain filtered out — unless the row
holds *only* a turning chain so far, in which case it is the only yardstick available.

Horizontally the opposite holds. The chain must be inside a band sideways or a click on
it lands in a gap with no band: vertically it is inside the row below, horizontally
outside its band, and the click would be silent with no message. So the band below
widens to include the chain dipping into it, and the row's own band includes its
chain's x.

**One exception upward (PQW-943).** The topmost row's band ceiling does include the
turning chain. If the row's first stitch is taller than the rest — a deliberately larger
loop at the row end — the band and its cells grow to the tallest symbol instead of
cutting through the chain. Downward the chain still sets nothing, so the band never
overlaps the row below.

## §9 Placing a row: weighted monotone regression

Every element of a row wants to be where it was worked, but they must stay in yarn
order and at least the sum of their half-widths apart. That is a weighted isotonic
(non-decreasing) regression, solved with pool-adjacent-violators.

The consequences are the reason this algorithm was chosen and not, say, a greedy pass:
a fan settles around its target, a decrease settles between its targets, and a chain
with no target of its own interpolates between its neighbours. Elements with no target
get weight 0.01 so anchored elements win every conflict.

## §10 A stitch asks for as much room as the stitches worked into it

**PQW-931.** The owner's requirement: *"one square in the first row should correspond to
3 squares in the second row if I increase by 3"*, and *"the chain that the increase is
attached to should slide to the middle of its square as I add to the increase and it
widens."*

So width is summed upward: the top row's stitches ask for one column each, and lower
down each stitch asks for the sum of what is built on it, but never less than one
column. A decrease (one stitch with several targets) **divides** its demand among its
targets; otherwise it would appear at full width under each of them and the row would
splay open for nothing.

**Only one level is passed on, not the whole subtree.** A stitch hands on its own base
demand `W`, not its already accumulated width. Measurement showed why: summing the whole
subtree made the lower rows as wide as the topmost ones and flattened the fan-shaped
shawl into a rectangle — the semicircle spanned 157° instead of 180°. The owner's
request is about one level only, so widening by the count of the stitches worked
*directly* into it is enough.

**The accepted cost.** Adding a stitch now rearranges earlier rows too, because the
demand of the stitch below it grows. The earlier stability guarantee (06 §5.3 point 2 —
a layer depends only on the layer below and its own stitches) no longer holds for
widths. Any comment or doc still claiming it is stale.

**Chain arcs pass their surplus on (PQW-953).** A chain has no target, so demand built on
it used to stop there: six double crochets in row 3 asked for 144 px while the arc stood
at 38, and the row pushed its turning chain off the fabric. The owner: *"by the third
row it already drifts."* Worked directly into a stitch the same case is fine, because the
increase widens the cell below it; under a chain the gap has to carry it. Only the
**surplus** travels — what the stitches built on the chains ask for beyond their own
column. The chain itself keeps its width, or every arc would prise the row below apart
and the compaction of §14 would be lost. Rows only: in rounds (granny squares, motifs)
corner chains behave differently.

## §11 Width spreading applies only to hand-drawn charts

**PQW-931.** A piece with a generated row shape (a shawl) must keep its layout
bit-identical: the first UAT round is about making ordinary crochet correct, and the
shawl geometry is not being worked on. So the width map is left empty for any piece with
a `rowShape`, and an empty map means everyone asks for their base width — the previous
behaviour exactly.

Related (PQW-893): the curve a shawl's rows are bent along is computed from the layout
**without manual pins**. A pin is a correction on top of the curve, so feeding pinned
positions back into the curve would let a pin bend the whole piece.

## §12 A stitch with a wrong target is drawn in its own column

**PQW-879.** A stitch whose target is wrong (undone or misplaced) is drawn at normal size
in its own column, with its feet on this row's baseline, rather than stretched to the
distant target. Otherwise one mistake drags a symbol across the chart and the drawing
becomes unreadable.

"Wrong" means what the validator calls wrong: a target in a row made later, a target in
an earlier layer, a target against the direction of travel, and a misplaced turning
chain. Controlled, marked stretching — crossed stitches, spike stitches, post stitches —
is not in this set, precisely because the validator does not flag it either.

One quirk of the finding data: the `against-direction` finding lists the preceding
(correct) stitch as well, and the offending one is **last**, so that rule takes the last
node while every other rule takes the first.

## §13 A chain sits over the stitch it bridges

**PQW-935.** A chain has no target, so it used to interpolate between its neighbours —
and at the end of a row it simply landed next to the last stitch, wherever the crocheter
had put it. The owner: *"I would have expected that if I click into the second one… then
it puts the chain into that cell."* Now each chain is placed over the stitch it bridges.

**Which stitches are bridged comes from the fabric, not the editing order (PQW-952).**
`piece.skipped` only records chains made *ahead* of the work; the crocheter can also drop
chains between two finished stitches afterwards, and there the record stays empty. Where
the record is silent, the bridged stitches are derived from the fabric instead; where it
speaks, it stays authoritative (PQW-936, PQW-938).

**Matching runs gap by gap, not counted from the start of the row (PQW-936).** The first
version walked the row with a single cursor, so if one gap had a different number of
chains than bridged stitches — because a stitch was later put into one, or two chain runs
reached the same place — then *every* later chain was off from there on, and at the very
end it fell back next to the preceding stitch for want of room. The owner saw exactly
this: *"it ties the chain to the next cell after the sc"*, and correctly said it would
recur in a repeating pattern. A gap between two stitches is touched only by its own
bridged stitches, so one gap's error no longer propagates.

**Within a gap, the first marks are used, not the middle ones (PQW-938).** Chains take
places one after another from the cursor, so the first ones are theirs. Distributing them
around an orphan mark threw a chain to the far side of the row — which is what the owner
saw.

## §14 A chain arc: the chains compact and rise, the anchors do not move

**PQW-951.** The owner drew a shell pattern: a single crochet, 5 chains, the next single
crochet into the 5th stitch of the row below — 3 skipped stitches underneath, 5 chains
above. *"If I insert the next single crochet, the pattern maker produces it this ugly."*

It was ugly because the chains only got room where a bridged stitch was available: 3 out
of 5. The remaining two drifted into the neighbouring single crochet's column and pushed
it out — measured, the row's first stitch moved from x=564 to 587.6, outside the edge of
the fabric.

In real crochet the stitch does not move, the chain arcs. So the space between the gap's
two anchored stitches is given to the chains **together**: divided by their number, with
their symbols compacted to match. The owner's decision: *"the double crochet does not
move, the chains compact, they go round on a flat arc."* Neighbours' room is therefore
never taken.

**The rise comes from the shortfall, not from decoration.** The natural length of n
chains is `n · 0.7W`; the amount by which that exceeds the chord is what bulges. For a
parabola the excess length is `8h²/3c`, so `h = √(3·c·shortfall/8)`. The owner asked for a
*flat* arc, so the height is capped at half the row height; whatever still does not fit is
absorbed by the compaction.

**With a widened gap there is no shortfall (PQW-953).** Where the gap has been stretched by
the fan standing above it, the chains still share it evenly — the room the fan needs comes
from the gap's width (see §10), not from a chain below growing fat, since the fan's stems
converge on their target anyway. There is no shortfall there, but a chain run is still an
arc, so a minimum flat bulge remains.

A flat chain that is not part of an arc stays where it always was: on top of the row's
stitches.

## §15 The turning chain crosses the row boundary, and its height is its own

**It spans the boundary (PQW-931).** The owner: *"the bottom chain of the three-element
vertical chain belongs to row 1 (the lower row), the other two belong to the upper row."*
Previously all of them stood inside the row's own band, so working into the chain's foot
made the whole stack jump up together.

The step is closed-form, not estimated. Two constraints: the **top** of the stack reaches
its own height, and the **first** chain's top sits exactly on the row boundary, so that
chain itself is in the row below. With n elements and the i-th centred at
`base + (i − 0.5) · step`, the two together give `step = span / (n − 1)`. Three chains
therefore put one below and two above; two (half double crochet) one each; one (single
crochet) leaves the chain in the lower row.

**The yardstick is the turning chain's own height, not the row's (PQW-934).** The row can
grow later; the turning chain stands in place of the stitch that starts the row, so it is
as tall as that stitch. The owner's report: putting the first double crochet into a row
begun with a single crochet grew the row and the turning chain slid down with it —
measured from y=1.0 to 5.0, where its symbol already hung out of the bottom of the lower
band (the band ends at 9, the 19.2-tall chain reached 14.6). Verbatim: *"its original
position was good, no height adjustment is needed, since it will be the height of the
single crochet — correctly."*

**A turned row's chain stays inside its own row (PQW-947, PQW-948).** Only the foundation
chain's turning chain sits half in the row below, because that is where the work starts
and its lowest chain *is* the end of the foundation chain. For a turned row the chain and
its symbol stay in the row's own band, and the height is **divided** instead: each of n
chains gets an n-th of the height and its symbol is slightly smaller, so the lowest sits
on the row's baseline, the highest on its top, and a gap shows between them. Two owner
reports drove this: *"it still hangs out of the row 3 cell"*, and *"anything more than one
ring collapses into itself."* (PQW-946 recorded the first half of this rule and was
superseded; a stale duplicate comment describing only PQW-946 survived in the source
until this migration.)

## §16 Which column the turning chain stands in

**In rows the turning chain is not a stitch (PQW-924)**, so it does not sit in the column
of the stitch below it; it stands outside, beside the row's first stitch. In rounds the
starting chain keeps its own position.

**Unless it counts as a stitch (PQW-944):** then it stands in the column of the row's
first target, in rows and rounds alike — but only if the row really does skip that place.
Patterns made under the earlier rule, which is still what the generators emit, work their
first stitch into it, and there the chain has to stay beside the fabric or two symbols
would land in one column.

## §17 The foundation chain is not on a fixed grid

**PQW-931.** Every chain of the foundation gets as much room as the stitches worked into
it ask for together, and stands in the **middle** of its own widened span. This is the
owner's request: as the increase grows, the chain should slide to the middle of its
square, and there should be as many squares above it as stitches went into it.

Without spreading (see §11) the old fixed grid applies — `i · W` — which is what keeps a
generated curved piece's drawing from moving.

**PQW-942:** the foundation chain's printed count is the graph's `writtenCount`, which
counts its remaining chains plus the turning chain's column. It is not the number of
placements, and it is not `stitchCount` (which is 0 for layer 0).

## §18 Polygon corners, and the seam where a round starts and ends

**PQW-888.** In a polygon the corner stitches of a round must land on the polygon's
corners. The round's positions are mapped corner to corner by piecewise-linear
interpolation, so their order and their relative spacing survive.

The corners of round 1 come from the round's own structure: the chain spaces if there are
exactly as many as the polygon has sides (a granny square), otherwise the positions split
into equal sides with each side ending on its corner stitch. Every later round takes the
middle of the group worked into the previous round's corner: the chain space inside the
group for a granny square, or the middle stitch. So a layer depends only on itself and the
layer below (06 §5.3). The corner axes themselves are fixed from round 1 onward — round
1's first corner snaps to the nearest polygon corner and the rest follow in order — so the
polygon does not rotate from round to round.

**The seam.** A round starts and ends on the same side, between the last corner and the
first. The along-row distribution cannot see that wrap, so the start can slide backwards
and the end forwards until the two ends sit on top of each other. When that happens, the
elements on that side are redistributed between the two corners.

**The round's number is placed on the side of the round's first stitch**, which keeps the
round numbers stacked above one another and separated instead of scattered around the
polygon.

**Counting turning chain:** where the turning chain counts as a stitch, its top is treated
as a stitch worked into the previous round's first position, so it joins the corner group
it belongs to.

## §19 How a round's radius grows, and the shapes that opt out

**A flat circle grows to fit.** The radius of a round grows until the round's stitches fit
around its circumference: the perimeter at unit inner radius is `2π` in a circle and
`2n·tan(π/n)` in a polygon, and the along-round parameter is measured on the circumference
at the middle of the round. Round 1 always starts from its own circumference, or there
would be nothing to measure against. Because the radius grows with the room demanded, a
foot in a round is placed at the target's real position rather than on the baseline
circle.

**A cone does not (PQW-908).** For rounds 2 through the given round of a cone — the
raglan yoke — the radius comes from the fabric instead (the top of the previous round),
so that flattened out the round is a sector, as it is in reality. A cone is also always
drawn on a circular frame, never a cornered one: its four raglan lines are increase
points, not motif corners, and forcing it onto a cornered frame would distort a piece that
is physically a tube into a square.

**An oval start (PQW-890).** The foundation chain lies straight across the middle. The
parameter grows away from the hook (0 to π) and the chain's underside is its mirror
(π to 2π), so round 1 closes around both sides of the chain.

**A chain ring (PQW-861).** The chains sit on a small circle around the centre; a "ch 2"
start with a single chain sits at the centre. The chain ring stays round even inside a
polygon.

Also PQW-861: in a round the end of the round comes back next to its start, so the stitch
count label is pulled back behind the round number to stop the two overlapping.

## §20 Layers are computed from the yarn path, never stored

A row or round is not a field on the piece. `buildPieceGraph` derives it from the
order of the stitches plus the end-of-layer events: layer 0 is the foundation
chain or the magic ring, and every later layer runs from the stitch after the
previous event to the stitch carrying the next one.

Storing the layer would give a second source of truth that every insertion,
deletion and paste would have to keep in step; deriving it means an edit can only
move stitches and events, never desynchronise the row structure. This is why
`selection.ts`, the chart and the written pattern all rebuild the graph instead
of reading a stored row number, and why an edit that produces a structurally
impossible piece surfaces as a graph exception rather than as a wrong row count.

Not handled by the model yet: foundation stitches (fsc/fdc, no starting chain)
and joining separate pieces.

Crochet sources: 06 §5.1, 06 §3.2.

## §21 Where a layer begins: round starts and row-start slip stitches

Three starts make a piece begin in the round, all three recognised structurally,
not from a flag (PQW-861):

- a magic ring;
- a chain ring — chains closed into a ring with a slip stitch. The closing event
  is placed after the **last chain**, and the slip stitch itself belongs to round
  1 as travel, not to the ring;
- the "ch 2, 6 sc in the 2nd chain" start, where round 1 is worked into a single
  chain and an event closes it. The oval first round (worked into both sides of
  the foundation) counts as a round too, even when the piece ends there.

Because the chain-ring slip stitch is travel and the closing slip stitch is the
event's stitch, a slip stitch at the end of an **unclosed** round is not yet a
closing stitch — the graph must look at the event, not at the stitch kind.

After a turn, a slip stitch at the start of a row is only travel when a turning
chain follows it (filet decreasing at the row start, PQW-894). If a chain space
follows instead, the slip stitches are part of the row — this is the C2C case,
where slip stitches travel across the tile into the chain space. Without that
distinction the C2C tile lost its first stitches to the turning chain.

The same "the graph still sees a row" problem appears before a round is closed:
`canEndRound` and `roundOnChainStart` cannot ask the layer whether it is a round,
because it only becomes one when the closing event exists. They ask the
structural question instead — does every stitch go into the very first chain —
and they resolve the starting chain with the **round** counting rule.

Crochet sources: 04 §1.1, 03 §5.5.

## §22 The foundation chain has no "base chain" stitch

The concept of a separate "base chain" under the turning chain was removed
(PQW-924). The foundation chain is the chains at the start of the piece; the
chains at its far end that row 1 does not work into are row 1's turning chain and
belong to layer 1. Only row 1's own targets decide this, because row 2 may
legitimately work into the top of that turning chain when it counts.

In a row there is no seat for the turning chain: every stitch of the row below
gets a stitch, and the turning chain only adds height. Deliberately skipped
chains at the foundation end (a filet row starting with an open cell) stay with
the foundation.

The foundation's **written** count is not its chain count (PQW-942). Row 1's
turning chain is made of the foundation's own chains; they leave the foundation
and stand up vertically into a single column, and that column is the
foundation's too — the turning chain stands on it. So the written count is the
remaining chains plus one: 10 chains with a 3-chain turning chain gives
10 − 3 + 1 = 8. With no turning chain the foundation states its own length.

Targets on the foundation keep the chains row 1 does not work into, so the
target numbering the crocheter sees while working does not shift (they count
from the hook).

Crochet sources: 03 §1.2, 03 §1.3, 03 §5.2.

## §23 Two counts per layer: structure and written

A layer carries two numbers because there are two different questions (PQW-940):

- `stitchCount` is **structure**: how many stitches the next row can work into. A
  chain is such a stitch only when something is worked into it. No pattern
  convention tilts this — the generators and the validator depend on it.
- `writtenCount` is what the pattern **prints** and what the crocheter counts on
  the row: the turning chain is the row's first stitch, and chains count
  according to the `chainCounts` convention (by default, all of them).

The turning chain stands in the place of the row's first stitch (PQW-944), in
rows as well as in rounds, so its top is a position — the last target of the next
row. The editor therefore marks that first target as used: without it the chart
showed a free cell, the target dot stayed visible, and the crocheter could have
placed a second stitch on top of the turning chain.

The same rule makes the editor lay down chains instead of the chosen stitch as
the first stitch of a turned row, at the stitch's own height (1 for sc, 2 for
hdc, 3 for dc). It applies only to **basic** stitches: a decrease, cluster or
shell shapes the row and is never replaced by chains. It also does not apply to
row 1 on a foundation chain, where the turning chain comes out of the foundation
(PQW-891), nor when the pattern says the turning chain is not a stitch.

If a row so far contains only the turning chain, that chain is itself the row's
first stitch.

Crochet sources: 03 §10 A4, 03 §10 B10, 01 §8.3.

## §24 Chain bridges are read from the fabric, not from the edit order

`piece.skipped` only records bridged stitches when the chain is made **forward**
from the working edge. The owner does not work row-by-row: *"I put the double
crochets in first and add the chains between them afterwards, and then it slips
apart."* In that order the mark stays empty, the chart does not know the chains
span a gap, and the measurement showed the row's first double crochet landing
120 px outside the fabric.

The fabric itself is unambiguous: between two consecutively anchored stitches the
chains bridge everything that lies between the two targets. `chainBridges`
returns that, computed from the anchors of the surrounding stitches rather than
from any stored mark, and ignores chains at the very start and end of a row,
where there is no gap bounded on both sides (PQW-952).

## §25 Resumed sections and the two-source round

After the yarn is cut, work can resume **above a given row** somewhere else
(PQW-901). That is how one piece carries both shoulders on either side of a
neckline: the `fasten-off` event names the row the next section continues above,
and its own name. A resumed section starts like a row after a turn — from the
other side — and its printed row number follows the row below it, so numbering
restarts inside the section. Positions in the shared row that no section uses are
deliberately skipped: that is the middle of the neck. A section's first position
holds its turning chain and is not worked into, so it is not a skipped stitch.

A round can also draw on **two** sources (PQW-908): a raglan sleeve hangs on the
shoulder's skipped stitches and on the underarm chains of the split. Those two
runs meet at the underarm, and the body stitches between them are not part of the
tube. The runs are selected structurally — skipped stitches on one side, chains
on the other — and the worked stitches only decide *which* run is meant, so the
validator still notices a round that skips a stitch inside its own ring. Such a
round continues in the round: same direction, same side, unlike a resumed row.

One consequence in the graph: when a round is followed by a fasten-off that
resumes elsewhere, the same slip stitch carries both the join and the cut. It is
still the closing stitch of the round.

Crochet sources: 03 §10 B8, 03 §1.3.

## §26 New stitches land in fabric order, not at the end of the list

The owner's words: *"this is pattern making, not actual crocheting, so you must
be able to change things backwards freely."* Someone designing a pattern does not
move strictly forward — they leave a gap and fill it later, or go back to an
earlier stitch to increase.

A stitch added that way goes into the **fabric's** order, next to its target, not
at the end of the list (PQW-933). Without this the yarn order parted from the
fabric order and the chart followed the yarn: filling a gap put the new stitch at
the end of the row (measured x=132 instead of its own 156), pushed the stitch
before it along and tilted it (base 132, top 156); the validator called the same
thing an "against the working direction" error, and the written pattern read the
row backwards.

The rule: a new stitch goes **before** the first stitch of the row that already
reaches further than it does. Working forward there is no such stitch, so the end
of the row is its place — exactly the old append.

The same rule serves two later requests:

- inserting a chain into the finished foundation (PQW-941), because *"I only
  notice at the end of row 2 that the base is too short, and the only way to fix
  it is to undo back to the base… functionally correct, but terrible to use."*
  The neighbours are the chart's left and right chain; either may be missing at
  the ends. Rows above do not move: the new chain simply has no stitch above it,
  so the cell stays empty.
- working into an empty cell of an **earlier** row (PQW-950): *"if I want to go
  back to the second row to put a stitch above the chain newly inserted into row
  1, I can't."*

## §27 Chains occupy columns, and stale skip marks are dropped on every edit

A chain has no target, but it has a place (PQW-935). The owner's report: the
chain always went to the end of the row wherever they clicked — measured
bit-identical with the cursor on target 9 and on target 6. *"I would have
expected that if I click into the second one… it puts the chain into that cell."*

So a chain occupies as many columns as it has chains, starting at the clicked
one, and the stitches under those columns are **skipped** — the chain bridges
them. `piece.skipped` holds that, and the chart and the written pattern ("skip N
stitches") read it. On the foundation and on the default cursor nothing changes:
the chain stays at the end of the row. A chain bridges **forward** only; reaching
back behind the working edge, or onto a used target, it merely follows the stitch.
Two chains may not sit in the same column. A target that receives a stitch is no
longer skipped: the two states exclude each other.

Stale marks are the other half (PQW-938, PQW-939). A place counts as bridged only
while there **is** a chain above it. On deletion the chain disappears, but the
mark points at the stitch below, which nobody deleted — so the mark is orphaned.
The owner saw a single chain jump to the far side of the row because the chart
distributed it among orphaned marks; two orphans were enough to move a chain from
the column the crocheter pointed at (x=84) to right next to the preceding stitch
(x=132): *"it puts the last chain of row 2 directly after the extended post
stitch… even though I skipped cells."*

The rule: between two stitches at most as many marks survive as there are chains
standing there; the surplus falls off the end in the working direction, and marks
in earlier rows are left alone. The cleanup runs on **every** edit, not only on
deletion, so a pattern inherited from an older version heals as it is worked on.

The cursor honours the same idea: it steps over bridged places (PQW-936), because
the work has already passed above them. Without that, Enter placed a stitch
*behind* the chains and the chain was left with no home.

## §28 A copied fragment carries target offsets, not identifiers

A crochet pattern is not a drawing: every stitch is built on what it was worked
into, so a copy has to be re-anchored rather than re-identified (PQW-875).

- The selection is made of whole units. A group (shell, increase, V-stitch) and a
  chain space can only be selected as a whole.
- Deletion shows which stitches work into the ones being deleted and removes them
  only together with those.
- The clipboard is plain JSON with no identifiers. Anchors inside the selection
  are kept as indices; anchors outside it become **offsets** between the targets
  of the row below, so on paste the stitches re-anchor from the current target.
  Only the first layer may anchor outside the selection.
- If there are not enough targets, a target is of the wrong kind, is taken, or the
  stitch count does not come out, the pattern does not change — not even
  partially.

The offset of a whole row counts from the row's **natural starting place**, so a
difference in turning chain or foundation does not shift the stitches; from the
middle of a row it counts from the earliest target used. A pasted turning chain
that the target row already has is dropped and the existing chains are reused.

Insertion modes are stored as seen from the **right side** (PQW-869). Pasting
into a row of the opposite side therefore flips the stored mode, so that from the
crocheter's point of view the mode stays the same. The oval's first round works
into both sides of the foundation chain and can only be copied together with the
foundation (PQW-890, PQW-899); the underside of a chain takes a stitch that can
be worked into a stitch, with no loop choice.

Crochet sources: 06 §3.2, 04 §3.4.

## §29 Every edit returns a whole new pattern

Every editor and selection operation returns a new pattern and never mutates the
old one, so undo is simply a stack of previous patterns (`history.ts`) and any
multi-step operation is undone in one step. This is why filling a row places
every stitch into a single resulting pattern (PQW-879) rather than emitting one
edit per stitch.

The editor works on one piece, the pattern's first. Not handled yet: a foundation
without chains, cutting the yarn mid-edit, and spike stitches reaching into an
earlier row.

Crochet source: 06 §5.3.

## §30 Edge shaping: at most two per row, and where the overflow goes

The flat-shape generator turns centimetres into stitches and rows and then shapes
the edges. Per edge, per row, at most two increases or decreases may go into one
stitch (3 stitches in one stitch, or 3 stitches worked together). More than that
is moved, not clamped:

- an increase at the **start** of a row becomes a chain extension (chains at the
  end of the previous row, which the row then works into);
- a decrease at the **end** of a row becomes unworked stitches, a stepped edge;
- anything that still does not fit goes to the neighbouring row on the same edge,
  where the method applies. Increases move to the next row, decreases to the
  previous one; at the outer rows, the other way.

In a symmetric shape both edges follow the same target, so the row's total change
is the sum of two targets and therefore even. When one edge would take more than
fits there, the surplus moves in the **same** row to the other edge, where a chain
extension or unworked stitches can absorb it; in the next row the edges swap
roles and the lag evens out. If nothing can absorb it, the shape is refused as
too steep.

Ribbing on the bottom border starts at row 2 (PQW-913): a post stitch cannot be
worked around a foundation chain, so row 1 stays plain. A ribbed row has a
shorter turning chain, and the post mode follows the target's **column**, so the
ribs run all the way up. A chain — a chain extension — always takes a plain
stitch.

Crochet sources: 03 §3.1, 03 §3.2, 03 §3.4, 03 §4.1, 03 §10 F27, 03 §10 F28,
05 §4.2, 05 §4.4.

## §31 One layer event per stitch

A `LayerEvent` is keyed by the stitch it follows (`after`), so a stitch can carry
exactly one event. When a round that already closes with a join-slip also has to
fasten off and name where the work resumes, the builder must **rewrite** that
join-slip event into a `fasten-off` with the `resume` on it, not push a second
event onto the same stitch. `raglan.ts` does this in three places: `closeAndCut`,
and both branches of the per-sleeve loop, where a `fasten-off` that already names
this sleeve is left alone rather than duplicated.

Why it matters: a second event on the same `after` id is silently dropped or
double-counted by the layer builder, which moves the stated stitch counts.

Cited from: `src/core/raglan.ts` — `closeAndCut`, and the sleeve loop's
`closing?.after === last.id` branch.

## §32 A resumed sleeve round anchors into two earlier layers

PQW-908. A top-down raglan sleeve starts after the yarn is cut: its first round
works into the yoke's skipped stitches **and** into the underarm chain made at the
split — two different earlier layers in one round. The resume event therefore
carries both sources, `resume.layer` (the yoke round) and `resume.with` (the split
round). This is also why the underarm chain counts into the body and into the
sleeve at the same time.

A single-source resume would make the sleeve's first round look like an
over-increase against the yoke alone, and the underarm chain would be
double-counted or lost.

Cited from: `src/core/raglan.ts` — the sleeve-building loop.

## §33 Sleeve decreases never fall inside the ribbed cuff

PQW-913. In `raglanPiece` a ribbed cuff round takes an early `continue` and never
reaches the decrease branch, so any decrease scheduled on a cuff round would be
silently dropped. The plan guarantees this cannot happen: `cuffRounds` is capped at
`sleeveRounds - 2` and the decrease schedule is spread over `shapedRounds =
sleeveRounds - cuffRounds` only. The shaping is always **above** the cuff.

If the cuff length ever becomes independent of the shaped length, the ribbed branch
must handle decreases instead of skipping them.

Cited from: `src/core/raglan.ts` — `ribCuffFrom` in the sleeve tube loop.

## §34 Round checks run only on closed rounds

A round is checked only when an event stands after it (`layer.closing !== null`).
A round still being drawn is by definition half-width, so measuring its growth
against the round below would make the editor warn at every stitch while the user
works. Both the growth check and the stacked-increase walk reset their state on an
incomplete layer rather than carrying it across.

Cited from: `src/core/rounds.ts` — `complete()` in `roundFindings` and
`stackedIncreases`.

## §35 Deliberately non-flat pieces are exempt from the flatness checks

Cupping (increase rate under ~85% of flat) and ruffling (over ~130%) are warnings
about an *accidentally* non-flat circle. Several shapes are non-flat on purpose and
must not warn:

- a piece with sections — a 3D amigurumi assembled from parts (PQW-863);
- a hat (PQW-866): after the crown the side is deliberately straight, i.e. cupping;
- a raglan yoke (PQW-901): it curves towards the body, it is not a flat circle;
- a ribbed round (PQW-909): post stitches pull the fabric in and the round does not
  increase at all, so its ratio is not measured in the first place.

The first three are switched off by the `solid` flag over the whole piece; the
ribbed round is excluded per round, because ribbing sits on top of an otherwise
ordinary piece.

Cited from: `src/core/rounds.ts` — the `ribbed` test and the `solid` flag.

## §36 A resumed section measures growth against its own base

PQW-908. A section that resumes after a fasten-off (the raglan sleeve) does not sit
on the round written immediately before it — that is the last body round. It sits on
its own base: the yoke's skipped stitches plus the underarm chain. The growth check
therefore compares against `layer.basePositions` when the layer has them, and falls
back to the previous layer's `positionCount` only for ordinary rounds.

Without this, every sleeve produced a spurious `round-growth` finding, because the
body's last round is much wider than the sleeve's first.

Cited from: `src/core/rounds.ts` — `previous` in `roundFindings`.

## §37 Hungarian names in the core are persisted pattern content

PQW-904. `src/core/` returns codes, not sentences — with one deliberate exception.
Names that are written **into the saved pattern** (the pattern title, a piece name,
a sleeve's name in the written instructions) are Hungarian string literals in the
core, because they become part of the user's document and must not change when the
interface language changes. The panels that merely *list* these shapes use their own
dictionary instead.

The affected files are listed in `CORE_EXCEPTIONS` in `tests/core-i18n.test.mjs`;
that exemption is keyed by filename, so these files must never be renamed.

Cited from: `src/core/round-generator.ts` (`MOTIF_NAMES`), `src/core/raglan.ts`
(`SLEEVE_NAMES`), and the same rule covers `TECHNIQUE_NAMES` in
`src/core/pixel-chart.ts`.

## §38 `plannedRounds` still returns a raw code string

PQW-904 debt. Every other core generator returns a `CoreText` code plus data.
`plannedRounds` returns a bare `string` because its callers (the shawl and garment
generators) still expect one; their own message migration is a separate ticket. Both
callers treat the value as an internal error, so no sentence is ever built from it.

The branches that would produce it are in practice unreachable: both callers start
from a magic ring, and a finished round plan never asks for more than a doubling.
Delete this conversion together with the callers' migration, and let the function
return `CoreText` like the rest.

Cited from: `src/core/round-generator.ts` — `plannedRounds`.

## §39 A closed round is the default round ending

Owner decision, PQW-892. `roundEnd: 'stitch-default'` is resolved by the **pattern
type**, not by the height of the stitch: amigurumi spirals, everything else worked in
rounds closes with a slip stitch and starts with a turning chain. The motif generator
defaults to the closed round for the same reason. An explicitly chosen ending is
always kept.

Cited from: `src/core/rounds.ts` (`roundEndFor`) and `src/core/round-generator.ts`
(module header).

## §40 A draft grid may be partly unspecified

Owner clarification, 2026-09-15. The designer's grid allows unspecified cells
(`null`). The user is expected to draw the first 4–5 rows fully and then only part of
a row; the program detects the repeating unit — or lets the user mark it — and
expands it to the full width and height.

Two rules make the detection predictable:

- **At least two whole repeats must be visible** before a period is accepted, and the
  unit is anchored at the bottom-left corner. A single repeat is not evidence of a
  repeat, and without an anchor the same grid would yield different units.
- **Cells the user actually drew always win** over the unit when the grid is expanded.
  That is what lets a border or a one-off motif survive an expansion; the count of
  such cells is reported so the user can see the deviation was intended.

Cited from: `src/core/pixel-chart.ts` — the module header, `detectUnit`,
`unitConflicts` and `expandDraft`.

## §41 Two grid estimates the knowledge base does not give

Both are ours, derived rather than sourced, and both should be replaced if a measured
figure appears:

- **A C2C tile is treated as square.** The tile is 3 dc wide and one dc tall and lies
  on the diagonal, so on the grid we use the mean of the two directions,
  `(3·stitchCm + rowCm) / 2`, for both cell dimensions. Close enough to square in
  practice; the knowledge base gives no tile aspect.
- **Tapestry yarn-by-colour is a lower bound.** Carried yarn adds length that the
  cell-share calculation cannot see, so for tapestry the estimate's range is opened
  25% upwards. The knowledge base gives no per-colour carry allowance.

Cited from: `src/core/pixel-chart.ts` — `cellSize` and `yarnByColor`.

## §42 The counting turning chain stands on a base chain

PQW-891, PQW-924. Our foundations are **one chain longer** than the CYC figures
quoted in the knowledge base, because we stand the counting turning chain on a base
chain rather than letting it grow out of the foundation.

| | knowledge-base source (03 §5.2) | ours |
|---|---|---|
| Filet, filled start | 3N + 3, first dc in chain 4 | 3N + 4, first dc in chain 5 |
| Filet, open start | 3N + 5, first dc in chain 8 | 3N + 6, first dc in chain 9 |
| C2C, row 1 | ch 6, 3 dc from chain 4 | ch 7, 3 dc from chain 5 |

Consequences the code depends on:

- The first column of a row is a **real stitch**, never the turning chain. The open
  first cell's two chains belong to the row, not to the foundation; the earlier
  "merged start" concept is gone.
- A row-start decrease puts slip stitches over the cells only, never onto the column
  the turning chain would have stood on.
- The "worked" part of the foundation excludes the chains that are skipped under the
  turning chain, so row 1's cells sit at the **end** of the worked run.

All of it flows from `foundationChainLength`, `firstChainFromHook` and
`skippedChains` in `tradition.ts`/`repeat.ts`, so a change there moves every grid
technique at once.

Cited from: `src/core/filet.ts` (module header, `planFilet`, `buildFilet`),
`src/core/c2c.ts` (module header, `buildC2C`) and `src/core/mosaic.ts` (module
header, `buildMosaic`).

## §43 A filet row-end extension needs an unshifted row below it

PQW-894 introduced widening at the end of a filet row: the new cell stands on a long
(tr) stitch worked into the stitch under the turning chain, so it only exists when the
turning chain counts as a stitch, and the extended cells must all be open.

PQW-902 is the bug that completes the rule: the long stitch reaches **two rows down**,
to the end of that row. If the previous row started with a decrease, its end moved
inwards and there is nothing to reach. The plan rejects that shape with its own reason
instead of building a pattern that fails validation.

Cited from: `src/core/filet.ts` — the `extended > 0` branch in `planFilet`.

## §44 One chain space carries a row's widening and the next row's lead-in

A filet row's trailing chains serve two purposes: this row's own edge widening
(03 §5.2, "Filet edge shaping") and the lead-in that the next row starts from. They
are emitted as a **single** chain space, not two adjacent ones, because the written-
pattern writer reads one space as one run — two spaces would be printed as two
separate chain instructions for what the crocheter makes in one go.

Cited from: `src/core/filet.ts` — the `tail` space in `buildFilet`.

## §45 A C2C increase row starts with its own chains

PQW-924. An increasing diagonal row begins with its own `ch 6`: the first three
chains are the new tile's chain space, the next three are worked into — exactly how
the very first tile is built. Earlier these three chains were appended to the end of
the *previous* row, where they stuck to the end of the foundation chain and made the
tile's space indistinguishable from the foundation's tail.

Cited from: `src/core/c2c.ts` — the `row.start === 'increase'` branch in `buildC2C`.

## §46 Two consecutive C2C increase diagonals are unsupported, not a bug

PQW-926. When two increasing diagonal rows follow each other, the new tile's chain
space and the end of the foundation chain run together and the generated pattern
fails validation with `foundation-chain` or `anchor-layer`. This is a shape we do not
support yet, not a defect in the generator, so the failure is translated into its own
reason for the user rather than surfacing a raw rule name.

If the shape is ever supported, remove the translation as well — otherwise it will
hide a genuine `anchor-layer` regression.

Cited from: `src/core/c2c.ts` — `generateC2C`.

## §47 The ribbing rules live in one module

PQW-909, PQW-913. Ribbing is built along two different paths: the garment generators
write it inline while they build a piece, and `appendRibbing` bolts it onto a finished
piece. `ribbingColumnMode`, `ribbedTurningChain` and `ribbedOpening` exist so both
paths compute the same thing and cannot drift apart.

`ribbedOpening` in particular is why the convention override rides on the **event that
opens the row** rather than on the pattern: the pattern's own
`turningChainCounts` convention stays untouched and only the ribbed rows are affected.
The pattern reader writes the same override back when it parses the text.

Cited from: `src/core/ribbing.ts` (the three shared helpers) and
`src/core/raglan.ts` (`ribbedRound`).

## §48 Ribbing skips the top of a counting turning chain

PQW-944. On a row, the top of a counting turning chain is a real position, but a post
stitch cannot be worked into it — it has no post. The ribbing therefore removes that
one position from the row it builds on. A plain stitch is used wherever a target has
no post, which on a turned row lands as the row's last stitch, matching the source's
advice to finish a ribbed row with a shorter stitch.

Cited from: `src/core/ribbing.ts` — `top` / `last` in `appendRibbing`, and the
`postable` test in its row loop.

## §49 Increase stacking is not counted where there is nowhere to stagger

Stacked increases (04 §3.2) are found by chaining each increase to the increase it was
worked into. Two starts are deliberately not counted as the bottom of such a chain:

- **A round whose every position is an increase** — round 2 of a flat circle is 6
  increases, so every increase in round 3 necessarily sits on one. There is no
  alternative placement, so it is not the designer's mistake.
- **The ends of an oval's first round** (PQW-890): the group there is part of the
  *start*, like the ring of a magic circle, not a shaping decision.

Each run reports one finding, on the first round where the chain reaches the limit,
so a long stacked column does not produce a finding per round.

Cited from: `src/core/rounds.ts` — `stackedIncreases`.

## §50 The graph stores the right-side insertion mode

PQW-869. An anchor's `mode` always records the mode as seen from the right side of
the fabric, so one rib column carries the same stored mode in every row: a stitch
inherits its target's column. On a wrong-side row the crocheter's view is the
opposite, and `insertion.ts` flips it when the written pattern is generated — which is
what makes a row correctly say front-post in one row and back-post in the next while
the chart shows one continuous rib.

Storing the crocheter-facing mode instead would make a rib column alternate in the
data and break every reader that walks columns.

Cited from: `src/core/ribbing.ts` (module header and the `column` map) and
`src/core/raglan.ts` (`ribbedRound`).

## §51 Guides snap differently from stitches

A guide — the square grid, the circle guide — is a lattice: every point in the
plane has a nearest crossing, so when snapping is on and the guide is showing,
the guide **always** takes the point. "Showing" means drawn, not merely switched
on: the renderer gives up on a grid finer than four screen pixels, and an
invisible lattice must not quietly move a stitch, so the interface passes
`gridDrawn` and the core honours it. A tolerance there would catch some clicks
and drop others, and with a wide grid most of the plane is further from a
crossing than any sensible tolerance, so the tool would feel broken.

A neighbouring stitch is a single point. It takes the stitch only from within
the tolerance, and only when it is nearer than the guide's crossing. The
tolerance arrives in chart units: the interface divides a fixed screen distance
by the zoom, so snapping feels the same however far in you are.

Each stitch offers three targets: its middle, and the two ends of its own
upright axis, turned with it. Stacking is how crochet works, so a turned stitch
has to offer turned ends.

Angles around the circle guide are **degrees clockwise from straight up**, the
same convention as an item's rotation — so a spoke angle and the turn of a
stitch sitting on it are the same number, and "turn the stitch outwards" is
simply "set its rotation to its angle from the middle".

Cited from: `src/core/irregular-snap.ts`.

## §52 A chain arc is a recipe, not a drawing

A chain arc stores the path and the count, never the stitches' coordinates. The
stitches are made from it, and are made again whenever an end moves, the bulge
changes, the count changes or the key's chain symbol changes. `memberIds` is the
run in working order, and ids are kept where the new run overlaps the old one —
so raising the count keeps every stitch that was already there, and the
selection survives.

**Sign.** With y growing down, the left normal of a direction `(dx, dy)` is
`(dy, -dx)`. A positive bulge puts the arc's apex at `chordMid + leftNormal *
bulge`, so a left-to-right drag bows **upward**. Reverse the drag and the same
positive bulge bows downward: the side follows the drag, not the screen.

**Fallbacks, never exceptions.** A zero-length chord gives every stitch at the
start. A bulge near zero, a non-finite bulge, or a radius that overflows gives
the straight chord. `shape: 'straight'` ignores the bulge. Nothing throws, and
nothing returns `NaN` — a chart that cannot be drawn is worse than a chart drawn
plainly.

**The turn follows the glyph, not the stitch.** A glyph wider than it is tall — a
chain drawn as a flat oval — already lies along its own long axis, so it turns a
quarter less than an upright one such as "0". The interface measures the glyph;
the core owns the rule, so it can be tested.

**A group is seated by its stitches, not by what it remembers.** `reseatGroups`
runs on every edit: it puts each group on the row and layer its stitches
actually sit on, and forgets any group whose stitches are gone or have been
pulled apart onto different rows. Without it, deleting a row or a layer left a
group naming something that no longer existed, the writer refused the pattern,
and the autosave failed silently from then on.

**A fan is the same recipe with a different path.** In `spread` mode `origin` is
the shared base point every stitch is worked into; in `converge` it is the
shared top point they meet at, and the base points lie a `length` away around
it. Both modes put the members at the **same centres** — only the shared end and
the half-turn differ, which is why one module serves both. A fan's length
stretches the whole glyph (D11), so the width keeps the glyph's proportions.

**Kinds share one layout path.** `memberShapes` is the only place that knows
which kind a group is; everything else — laying out, reseating, translating,
forgetting — works on any group. Adding a third kind means adding a case there
and a reader branch, nothing more.

Cited from: `src/core/irregular-arc.ts`, `src/core/irregular-fan.ts` and
`src/core/irregular-groups.ts`.

## §53 Fitting a shape to stitches, and what "fits" means

Arranging places stitches by their **base points**, because that is where a
stitch is worked and what a crocheter reads. `placeOnShape` moves the base
point; the centre follows from it.

**Spacing differs from a chain arc's on purpose.** A chain arc insets half a
spacing at each end, because the chains sit *between* the two ends. A row sits
*on* the ends of its shape, so `shapeStops` walks the path at `i/(count-1)` and
the first and last stitches land exactly on the ends. On a circle the stitches
spread all the way round from the start angle, so the last does not land on the
first.

**One rotation formula covers every shape.** A circle is walked clockwise, so
the left of the direction of travel already points outwards: the rotation is
`along − 90` for `left`/`outside` and `along + 90` for `right`/`inside`,
whatever the shape. An open shape therefore accepts all four sides rather than
rejecting two of them.

**What counts as fitting.**

| Shape | Accepted when |
|---|---|
| Line | every base point is within the tolerance of a total-least-squares fit |
| Arc | the same, and the bulge is bigger than the tolerance — a flatter arc says nothing a line did not |
| Circle | the same, and the points span at least **300°** of it |

The simplest that fits wins, in that order. The 300° threshold is the judgement
call: it makes a round of six or more read as a circle, while a three-quarter
arc still reads as an arc. Reading a deliberate three-quarter arc as a closed
round would push stitches into a gap the crocheter left on purpose, which is the
more visible mistake, so the threshold leans that way. A round of four or five
stitches is read as an arc.

**Stitches sharing a base point take one position together** — a fan worked into
one stitch is one place in the row, not five.

Cited from: `src/core/irregular-shape.ts` and `src/core/irregular-rowline.ts`.

## §54 (removed) A circular repeat

The circular repeat was removed in PQW-1006, with `src/core/irregular-repeat.ts`:
copied around a centre, a motif never has the right stitch count for the next
round. See `interface.md` §57 and `owner-decisions.md`.

## §55 The granny square's grid (rewritten in PQW-1043)

PQW-1040 made a granny round a parametric group that generated its stitches.
PQW-1043 took that away: the designer gives the grid, the crocheter fills it in
(`interface.md` §71). A round is no longer a group at all.

A round is a row carrying `cells`, its grid count. `grannyRings` walks the rows
in order and gives each one a band: round *n* runs from `(n-1)·step` to `n·step`,
where `step` is the guide size. A round's depth never depends on what was put in
it, so changing a count never moves another round.

`grannyCells` puts the cells on the middle square of the band, the first on the
top-left corner and the rest clockwise (`squareStop`). A count divisible by four
therefore lands one cell on each corner. The cells are where the dividers are
drawn, and what the browser tests click; nothing snaps to them (`interface.md`
§72). `grannyRingAt` gives the round a point falls in, which is how a placed
stitch finds its row.

## §56 The granny square's background bands

PQW-1041. Under a granny square the free-form board draws the round generator's
background, not the square grid. The owner: „az előző háttérképe jó volt … erre
beraktál egy kibaszott négyzetrácsot”, with „változó számú négyzetszám
körönként!”.

`grannyBands` gives each round a square band between its two squares. The first
round's band reaches the middle (`inner: null`). The band is cut into one cell per
grid count: a divider joins the two squares halfway between two cells, so the
cell count follows each round's own. The tones alternate round by round, as
`--c-row-a` and `--c-row-b` do on the regular chart.
