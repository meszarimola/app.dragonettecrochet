# Core support modules — engineering decisions

Why the supporting half of `src/core/` is built the way it is: the measurement
calculus (`quantity.ts`), yarn estimation (`yarn-estimate.ts`, `yarn-weight.ts`),
the round frame (`polygon.ts`), the shawl row curve (`row-curve.ts`), the shared
grid-technique writer (`grid-pattern.ts`, `colorwork.ts`), the canonical pattern
form (`canonical.ts`), garment shaping arithmetic (`garment-math.ts`) and undo
(`history.ts`).

This file holds **engineering** decisions only. Crochet domain knowledge stays in
`docs/knowledge-base/`, cited by section code (`02 §6.5`); the source cites it the
same way, as `// KB: 02 §6.5`. A section here is cited from the source as
`// KB: core-support §4`. Sibling files `core-geometry.md` and `core-domain.md`
cover the geometry/editing and the domain/output halves; where they already say
something, this file points at them instead of repeating it.

Written 2026-09-19 (PQW-958), by moving out of `src/core/` every comment that
recorded a decision, a constraint, a past bug or a trade-off. The rest of the
comments were deleted: the code is the source of truth.

Convention, as in the rest of `docs/kb/`: one heading per decision, numbered `§N`,
never renumbered. A superseded section is marked `(withdrawn)` and replaced by a
new one.

## §1 Every physical quantity carries where it came from and how wide it is

`quantity.ts` (PQW-859). A `Quantity` is a number plus a `ValueSource` — measured,
read off a label, or estimated — and a probable range. The point is that the
interface can tell the crocheter *"about 3 balls"* apart from *"3 balls"*, and that
the distinction survives arithmetic instead of being re-derived at the end.

Rules the module enforces, and why each is the way it is:

- **An estimate always has a range.** A single estimated number claims a precision
  the data does not have. Measured and label values have `range: null`, and that
  `null` is the marker of an exact value, not a missing one. Crochet source:
  02 §8 (implementation notes), README §2 "Calibration", §6.
- **The result's source is the weakest input's.** `measured` > `label` >
  `estimated`; anything with an estimate in it is an estimate. `weakestSource([])`
  is `measured` deliberately: with no inputs there is nothing to weaken.
- **Exactness is preserved.** If every operand has `range: null`, so does the
  result — the range is not manufactured out of equal bounds.
- **Every operation assumes a non-negative quantity.** That is what lets the
  bounds come straight from the products, quotients and sums of the operand
  bounds with no sign analysis. `scale` with a negative factor and `inverse` or
  `divide` through zero are outside the contract and will swap or blow up the
  bounds; every caller in the core passes a physical measurement.
- **`estimate()` throws when the value falls outside its own range.** That is a
  programming error, and it is cheaper to catch at construction than to chase
  through a chain of multiplications.

## §2 Yarn is estimated from a weighed swatch, not from published ratios

`yarn-estimate.ts` (PQW-859). Published yarn-per-area figures disagree by a factor
of three (02 §6.2, §6.5), so the only input worth trusting is a swatch the
crocheter weighed. The chain is: g/cm² × the piece's area → grams; × the label's
m/g → metres; + a buffer; balls rounded up (02 §6.5, 02 §8 `yarnFromSwatch`).

- **The default buffer is 10–15 %**, for gauge drift, the swatch itself and
  mistakes (02 §6.5). It is an estimate, so it widens the result's range.
- **The arithmetic is unit-agnostic**, as long as the caller is consistent. The
  metric names (cm², g, m) are the default case, not a requirement: square inches
  and yards work the same.
- **A plain `number` argument is taken as exact** (`measured`), because it is
  either the weighed swatch or a size the user typed. A `Quantity` argument keeps
  whatever range it arrived with, which is how an estimated project area widens
  the ball count.
- **`ballsNeeded` subtracts an epsilon before rounding up**, so a length that is
  exactly a whole number of balls in real arithmetic does not buy a spare ball
  because of floating-point error.

## §3 The CYC weight table is a guideline, and classification by meterage is ours

`yarn-weight.ts`.

- **The CYC table is a standard that calls itself "guidelines only"** (02 §1.1).
  Its ranges describe the yarns people actually sell in each category; they are
  not tolerances, and a yarn outside a range is not wrong. So a category never
  overrides a measured gauge — it only supplies a default.
- **Open-ended rows are modelled with `null` at the open end.** The table really
  does say "≤ 6" and "≥ 15". Rather than invent a bound, `cycGaugePer10cm`
  returns `null` for a category that has one (Jumbo), and the caller decides what
  to do with no default.
- **The m/100 g boundaries are derived, not published.** They were drawn through
  the middle of sources that disagree (02 §1.4, DERIVED), which is why
  `classifyByMeterage` always reports `source: 'estimated'` and hands back a
  `candidates` list — near a boundary (the worsted/aran/bulky region) more than
  one category is honest. The user can override it.
- **It is only valid for yarns of similar density.** A lofty or fuzzy yarn is much
  thicker per gram than a dense one, so the same meterage lands in the wrong
  category (02 §1.4). This is a documented limitation, not a bug to fix by
  moving a boundary.

## §4 A round frame is a circle or a regular polygon in one coordinate system

`polygon.ts` (PQW-888). The round layout and the concentric grid address a point
in a round with two numbers: the **inner radius** and the **along-round
parameter**.

- In a circle the inner radius is the radius and the parameter is the angle.
- In a polygon the inner radius is the **apothem** — the distance from the centre
  to a side, not to a corner — and the parameter agrees with the angle at the
  corners and advances linearly along each side.

That is the whole reason for the parametrisation: corner groups worked over one
another land in the same corner, and the sides come out straight (03 §8, 04 §6.1).
How the corners of a given round are chosen, and what happens at the seam where a
round starts and ends, is core-geometry §18; how the radius grows, and the
perimeter formula `2n·tan(π/n)`, is core-geometry §19.

Orientation is fixed once: the polygon's top side is horizontal, and the circle
starts from the middle of that top side. That arrangement is its own mirror image,
so the left-handed view needs no second shape and no flag.

Degenerate cases are answered with sentinels rather than errors, because the
callers are drawing code that must not stop: fewer than three corners is a circle,
a circle has no side (the side interval is infinite), a circle has no outline
(empty), and the parameter at the exact centre is `NaN`.

## §5 A shawl's rows are curved by remapping a straight layout

`row-curve.ts` (PQW-893). A shawl worked in rows is drawn in its real shape — the
semicircle and the crescent on arcs, the top-down triangle broken at the spine —
but nothing curved is ever laid out from scratch. The straight layout is computed
first and then mapped point by point.

- **Distance along the row is preserved**, on the arc and on each half of a broken
  row. That is what keeps stitch widths, fanning and converging identical to the
  straight chart: the curve changes where a row is, never what is in it.
- **A row's radius comes from its own width**, so the arc subtends the piece's
  neck angle — 180° for a semicircle, less for a crescent (05 §1.2, §1.6). The
  two halves of a broken row close half the piece's tip angle against the spine,
  45° for a top-down triangle, so the halves meet at a right angle (05 §1.4).
- **The drawing runs bottom-up**, as charts do: the neck point at the bottom, the
  rows above it.
- **A row depends only on itself and the rows below** (06 §5.3), so adding a
  stitch reorders that row alone.
- **The centre is the feet of row 1's stitches**, and a row's half-width is taken
  from its full extent. A row shifts one or two columns to one side of centre as
  the turning chain alternates sides; measuring the full width instead of a
  half means the arc still subtends exactly the neck angle.
- **Radius is piecewise linear between knots at the row tops**, with the rise
  between two rows clamped to between a quarter and six times the radius growth.
  The consequence, and the trade-off: the gap between rows does not stretch but
  the stitch height does, so when the chart's aspect differs from the real fabric
  the stem stretches or shortens and the *shape* survives. In the aspect-correct
  view (PQW-859) and against the theoretical increase the stem is its real length
  too.
- **The foundation gets a minimum radius of one column width.** A foundation of a
  few chains would otherwise sit at a radius small enough for the grid band below
  it to turn inside out through the centre. That constant is copied from the
  layout's default column width, not imported, and has to be kept in step with it
  — the same duplication core-geometry §3 records for the grid.
- **Curved edges are produced by bisection** until the chord follows the true line
  to within half a chart unit, with a depth cap. A broken row also gets a forced
  stop at the spine, where the line is not smooth.

The curve is computed from the layout **without manual pins** — core-geometry §11
— and `rowShape` itself is saved with the piece, core-domain §13.

## §6 One graph writer for the grid techniques

`grid-pattern.ts` (PQW-864). Filet, C2C and colorwork assemble a piece the same
way, so they share one writer and one finishing step, and the result goes through
the same validator as a hand-drawn pattern. A generated pattern that fails a
validation **error** is a bug in the generator, so `finishGridPattern` refuses it
rather than handing the user a broken piece.

- **Ids are handed out in yarn order** (`n1`, `n2`…, `s1`, `s2`…). This is the
  same order `canonical.ts` re-derives (§7), so a freshly generated pattern is
  already in canonical shape.
- **Colour 0 is the first colour and is not written out.** Leaving it off keeps a
  save and a canonical comparison identical whether or not the caller passed the
  first colour explicitly.
- **The end-of-row stated count is the graph's own count**, not a number the
  generator kept while building (06 §5.3 V3). A generator that counted for itself
  would be a second source of truth for stitch counts.
- **A failure is a code plus data, never a sentence** (PQW-904) — core-domain §2.
  Each technique declares its own narrow code union, and `fail` is shared so the
  shape of a failure is identical across the generators.
- The title is kept only if the user typed it — core-domain §1.

## §7 The canonical pattern is the graph with its identifiers erased

`canonical.ts`. Two patterns are the same graph exactly when their canonical forms
are equal. Identifiers cannot be compared directly: the editor and the
written-pattern reader hand them out freely, so the same fabric arrives with
different names depending on how it was made.

Canonicalising renumbers everything by position instead:

- stitches `n1`, `n2`… along the yarn path — the order they are already stored in;
- chain spaces, rings and groups by the position of their **first** stitch;
- skipped stitches and layer events in stitch order;
- a stitch's flags sorted, so flag order cannot make two identical stitches differ.

Two things are deliberately not in the canonical form:

- **`pinned` is dropped.** A manual pin belongs to the drawing, not to the graph;
  two patterns that differ only in where a symbol was nudged are the same pattern.
  Core-geometry §11 is the same principle applied to the row curve.
- **Colour 0 is equivalent to no colour**, matching the writer in §6 (PQW-864).

The piece's own `id` and `name` are kept: they are content, not generated
identifiers. Crochet source for the graph model: core-domain §8.

## §8 Shaping arithmetic: rounding intent, epsilon, and impossible schedules

`garment-math.ts` (PQW-866). The crochet rules here are sourced — the rounding
direction and the even row count are 05 §4.2, the repeat multiple is 05 §4.7, the
"magic formula" that spreads a slope is 05 §4.4, even distribution is 05 §4.3, and
mirroring a left/right piece is 05 §4.5, §9.3. What is ours:

- **Rounding direction follows the sign of the ease.** Positive ease rounds the
  stitch count up, negative rounds it down, so rounding never works against the
  fit the user asked for.
- **Every rounding goes through one epsilon-guarded helper.** A centimetre
  calculation lands on `13.999999999` often enough that `ceil` without a guard
  buys a whole extra stitch. The same guard on the floor side stops an exact value
  dropping one.
- **A schedule that cannot be worked returns `null`, it is not clamped.**
  `slopeSchedule` returns `null` when fewer than one row would fall in an
  interval, and `reversedEventRows` returns `null` when reversing would put a
  shaping event on row 1. Squeezing those into something workable would silently
  change the garment's measurements; the caller has to widen the section or drop
  a shaping event, and only the caller knows which.
- **Shorter intervals come first**, and a shaping event happens on the **last**
  row of its interval. Both are arbitrary but fixed, so two runs of the same
  numbers produce the same written pattern.
- **Reversing a schedule is `rows + 2 − d`.** A piece planned top-down but worked
  bottom-up — a sleeve from the cuff — turns the decrease in top-down row `d` into
  an increase in row `rows + 2 − d`, and the list is re-sorted ascending because
  the reversal flips the order.

## §9 Undo is a stack of two hundred whole patterns

`history.ts`. Every edit returns a whole new pattern rather than mutating the old
one (core-geometry §29), so history needs no diffing and no inverse operation: it
keeps the previous states and a multi-step operation undoes in one step.

Three consequences that are choices, not arithmetic:

- **Identity, not equality, decides whether something happened.** Recording a
  state that is the same object as the present one is not a step. This works only
  because the editor returns a new object for every real change — an edit that
  mutated in place would be silently unrecorded.
- **Two hundred steps, oldest dropped.** A pattern is plain JSON and a large one
  is not small; an unbounded stack grows with every stroke of a fill. The limit is
  a memory trade-off, not a domain rule.
- **A new change clears the redo stack**, as in every editor. There is no
  branching history.

## §10 Colorwork: one cell, one stitch, and the turning chain is not a cell

`colorwork.ts` (PQW-864). Tapestry and graphgan both turn a coloured grid into
rows of single crochet, one cell per stitch (03 §5.3, §5.4). The techniques differ
in how the yarn is handled, not in the fabric: tapestry carries the unused colours
inside the stitches and the validator warns above three carried colours per row
(03 §5.3, 03 §10 G36), graphgan uses a separate ball per colour and carries
nothing (03 §5.4).

- **The rows alternate direction.** A row's cells are stored in the direction of
  travel, odd rows running right to left (01 §8.4, 03 §5.4), so a generator index
  is never a left-to-right grid column.
- **Neither the skipped foundation chains nor the turning chain is a cell.** Every
  cell must get a real stitch, or the colour the crocheter sees at the edge would
  not be the colour in the chart. PQW-924: the worked part of the foundation is
  the chain length *minus* the skipped chains, from the same single skip
  calculation core-geometry §1 and §42 describe — and in the Japanese tradition
  the counting turning chain stands on its own base chain, which is why row 1
  starts at a different offset from the later rows.
- **A counting turning chain forces a minimum width of two cells.** With one cell
  and a counting turning chain there would be nothing left in the row.
- The colour change itself happens on the last yarn-over of the preceding stitch
  (03 §6, 03 §10 G35); that is written text, not graph structure, so it does not
  appear here.
