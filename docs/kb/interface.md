# The interface

Decisions, constraints and past incidents behind `src/ui/`. The code is the
source of truth for *what* happens; this file records *why*, so the source
itself carries pointers (`// KB: interface.md §N`) instead of prose.

Sections are never renumbered. A withdrawn decision is marked `(withdrawn)` and
replaced by a new section.

## §1 UI modules that Node runs import the core with a `.ts` extension

The DOM-free modules (the `*-view.ts` files, `palette.ts`, `notation.ts`,
`written.ts`, `symbols.ts`, `grid-paths.ts`, `chart-labels.ts`, `chart-svg.ts`,
`pattern-types.ts`, `i18n.ts` and the dictionaries) are executed directly by
`node:test`, not through Vite. They therefore reference core files by the name
they actually have on disk. The modules only the browser ever loads keep the
built `.js` extension.

Rewriting one form into the other "for consistency" breaks either the test
runner or the bundle, so the extension in these files is load-bearing.

## §2 The interface language and the pattern's notation are independent

Two separate settings (PQW-868, PQW-900). An English interface can work in
Hungarian notation. The notation's default is derived from the interface
language, but a stored choice wins over it.

The choice is presentation only: the graph does not change, and the pattern
records the notation it was made with when it is saved or exported. The palette,
the stitch names, the canvas symbols, the written pattern and the export all
follow the notation.

Because the views are pure functions and the `<select>` label constants are
module-level, the current notation is held as module state in `notation.ts`,
mirroring how the interface language is held. `main.ts` sets it in
`syncNotationControls`, so every notation change reaches the lists and the
sentences.

## §3 The number format follows the interface language; units do not

Hungarian writes a decimal comma ("19,7"), English a decimal point ("19.7")
— PQW-905. The units (cm, g, m, mm) are the same in both languages and come from
the dictionary. Stitch names follow the notation, not the interface language
(§2), which is why a stitch name is not read from the dictionary.

A stitch name therefore gets its own `lang` attribute inside a sentence
(PQW-853): the sentence is in the interface language, the name is not. Words
that are not stitch names — "chain space", "magic ring" — stay in the interface
language and need no marker.

## §4 The interface language resolves from `?lang`, then storage, then the document

In that order (PQW-906). A shared link always opens in the language it names,
which is why the query parameter outranks the stored choice; the stored choice
outranks the document's `lang`. A corrupt or unknown stored value falls back
rather than failing to start.

`resolveUiLanguage` does not read storage itself: the caller passes the value in,
so the function stays pure and Node can run it.

Changing the language in the page rewrites the address bar's `?lang` so the link
stays shareable and reloadable. Substituting a missing dictionary key throws, so
an untranslated label fails the browser test immediately instead of rendering
blank.

## §5 No new `localStorage` key without an owner decision

Keys are added deliberately, not per feature. The language key (PQW-906) and the
pattern-type bar's open state (PQW-912) were approved as *operational* settings:
they do not identify the visitor, so they survive a refusal of the cookie
banner. The generator panels' choices, the proportional view and the grid editor
deliberately live only in the page — persisting them would mean a new key.

The free-form type (PQW-963) added two more, approved with it: its own pattern
slot, so switching types never overwrites the other type's work, and one key
holding its interface preferences as a small JSON object rather than a key per
preference.

Every storage access is wrapped in `try/catch`: in a private window or with
storage blocked the call throws, and the editor must still start. When a write
fails the setting simply does not survive a reload.

## §6 Already-filled `<select>` labels are rewritten in place

The generator panels fill their selects when the section is first opened, from
module-level label constants. Those labels track two things: the interface
language and the notation (§2, §3). When either changes inside the page, the
already-filled options have to be rewritten, or the dropdowns keep the old
language until a reload (PQW-900).

The rewrite matches by option *value*, so the user's selection survives and
options filled from elsewhere (a size series, for instance) are left alone.

## §7 Generator panels share one shape

Every generator section (round, shape, shawl, garment, amigurumi, grid, size)
follows the same rules:

- The fields live in `index.html`; the panel only reads and writes them.
- Generating replaces the pattern, so it is undoable in a single step.
- No new storage key (§5); the choices live only in the page, and what the
  generator produced is saved with the pattern.
- A section computes only while it is open, because the canvas already redraws on
  mouse movement.
- A choice the chosen shape forces is written into the field rather than hidden,
  and a not-yet-available option is rendered disabled rather than omitted
  (PQW-925, §9) — the user sees what exists.
- The sentence for a refusal is the interface's: the core returns a code and data
  (PQW-904, `docs/kb/decisions.md` §2).

In the size section the origin of each value sits in the row header so a narrow
panel needs no horizontal scrolling.

## §8 A field the user is typing in is never overwritten

Re-rendering a panel writes values back into its inputs. The one that currently
has focus is skipped, otherwise the value jumps under the user's hands
mid-typing. The same applies to rebuilt option buttons: the insertion chooser
rebuilds only when the selected stitch or the notation actually changed, so the
focus is not lost (§14 of `.claude/rules/ui.md` has the broader interaction rule,
and `docs/kb/decisions.md` §4 the reasoning).

The grid editor's section builds its board only on the first open, so a `toggle`
arriving late cannot overwrite a size typed in the meantime.

## §9 Unfinished pattern types and motifs are disabled, not removed

The owner's decision for the first round of acceptance testing (PQW-925): get
regular crochet right first, and do not let the rest draw attention. Filet
(PQW-864) and amigurumi (PQW-863) are switched off, and so is the granny square
motif.

The code stays where it is. Re-enabling a pattern type is a `true` in the list in
`pattern-types.ts`; re-enabling a motif is an empty `DISABLED_MOTIFS` list.
`main.ts` also hides a disabled type's section and does not build its panel at
all, so the disabled path is unreachable at run time while the files remain.

Irregular crochet left this list in PQW-963: it is an active type now, with its
own editor. See §39.

A disabled motif's label reuses the dictionary key the "soon" badge already uses,
so it is correct in both languages without new text.

## §10 Amigurumi is a text-first pattern type

The owner's clarification (PQW-874, 2026-09-15): in amigurumi the written
pattern is the primary view and the chart is the supplement, so the panel opens
large — full height in a narrow window — and the chart grid for that type is the
text grid rather than rows or rounds. Other types leave the panel alone.

The proportion applies at the moment the panel is opened (PQW-912) and only if
the user has not set a height themselves with the separator: a type change must
not take away a size the user chose, and must not pop the panel open by itself
(§18).

## §11 `Alt` is the command modifier; only its label is platform-dependent

A single character cannot be a command, and `Ctrl`/`Cmd`+digit is the browser's
tab switch, so the shortcuts use `Alt` (PQW-911). The first nine palette stitches
get `Alt`+digit; the rest are reachable by click or Tab.

On a Mac the same physical key is labelled Option (⌥), so only the *display*
varies — `⌥1` with the symbol against the key, `Alt+1` elsewhere. Key handling
never varies: it is `event.altKey` plus the physical position of the key
(`event.code`), because `Alt`+letter produces a different character on macOS. The
dictionary writes "Alt" everywhere and the substitution is corrected once, after
the static labels are applied.

Detection happens in one place, and takes the platform string as a parameter so
Node can run it.

## §12 Tooltips are drawn by CSS

`:hover` and `:focus-visible` in the stylesheet show them (PQW-882), which means
a *disabled* button still has a tooltip — an event-driven tooltip would not. The
TypeScript only decides which way the label is aligned so it does not leave the
window; the half-width constant it compares against is half of the tooltip's
maximum width in `styles.css`, and has to move with it.

## §13 The written-pattern panel and the status line share the stage

The panel is resizable from its header (title and buttons only) to the whole
stage, by dragging the separator and from the keyboard (PQW-885). Keyboard steps
snap to 5 % divisions of the stage so the value a screen reader announces is a
round number; the browser rounds heights to 1/64 px, so half a pixel still counts
as the same division. Dragged well below the header, releasing collapses the
panel, and reopening restores the height it had before the drag.

The status line sits above the panel. When the panel is nearly the whole stage
there is no room, so the panel's top gives way instead — otherwise the status
line would cover either the panel's header or, floating over the canvas, the
toolbar. A panel covering the entire stage has nothing behind it to fit, so the
view is not realigned then.

## §14 The canvas and the export draw the same labels

Which layer gets a caption, and what it says, is computed once (`rowCaptions`,
PQW-923) and used by both the designer's canvas and the SVG export — and so by
the PNG rasterised from it. They used to be computed separately and diverged: the
export wrote the stitch count as separate text over the pattern. Only placement
stays separate: on the canvas the caption is fixed-size in screen pixels, in the
export it scales with the drawing.

A layer gets a caption once it has stitches. A newly opened row is not yet a row
from its turning chain alone — the symbols are there but the count is still 0 —
except that the turning chain *is* the row's first stitch (PQW-944), so from it
the row does count. A magic ring has no meaningful stitch count; the foundation
chain's count is the graph's, which includes the turning chain's column
(PQW-942).

## §15 Row labels are fixed-size, beside the chart, inside the open side panels

The captions stand outside the two edges of the drawing (PQW-916), and several
rules had to hold at once:

- They are drawn at their own screen size, with the transform reset. Scaling them
  with the drawing grew them to about 130 px when zoomed in and pushed them under
  the side panels. Box-overlap measurement did not notice; a screenshot did.
- They must stay between the panels that open over the canvas. The interface
  passes their widths in (`setInsets`), because the `--side-start` CSS variable
  comes back as `min(16rem, 80vw)`, from which no pixel value can be read.
- Hugging the edge of the visible band must not push a caption over the symbols:
  in a narrow window the longer (English) caption slid onto the foundation
  chain's stitches. Covering is forbidden, overflowing is allowed — "fit whole
  pattern" cleans up the overflow, because it accounts for the captions.
- "Fit whole pattern" subtracts the caption room from the available band instead
  of adding it to the drawing's bounds; otherwise the outermost caption slid
  under the panel afterwards.
- The caption is positioned against the *drawing's* edge, not the row's end
  point: on a half-finished row the end point is in the middle of the chart, and
  the caption sat on earlier rows' stitches.
- On an empty pattern the view starts one caption's width to the right, or row
  1's number would land under the side bar.

Fitting may go below the smallest zoom step, so that the whole pattern — with the
grid, PQW-887 — still fits; zooming out from there does not snap back up.

## §16 A row-number label is a 24 × 24 target that never steals a grid cell

The label is its own click target: it selects the whole row or round. It is
padded out to the 24 × 24 px minimum target size (WCAG 2.5.8), and because the
label is fixed-size the padding is too.

The padding overlaps neighbouring grid cells, where a click means "crochet here",
not "select the row" (PQW-916). So outside the label's own box a grid hit wins;
inside it the label wins.

## §17 Export width is estimated from the text length

The SVG export has no text metrics available, so it estimates: at 12–13 px about
7.4 px per character. The same estimate reserves room for the row captions on
both sides — without it the export cut them off.

## §18 The next row is shown on the chart, not announced

The owner's decision in the first round of acceptance testing (PQW-929): a turn
must not be reported in a popup — *"the user looks away for a second and does not
see it"* — but where the row numbers already are: *"where you wrote row 1, put
another row there, with the arrow."* See `docs/kb/decisions.md` §4 for the
general rule.

The marker is drawn by the same label routine as the row numbers, so the same
clamping applies to it and the arrow can no longer climb onto the drawing. It
used to be drawn over the chart and landed in the *next* row's grid band and
rectangle, which the code did not check at all. The direction comes from the
current row, so the pill is lifted by one label height: a row that has not been
started is not in the layout and its own height is unknown, and without the lift
the pill sat exactly on the current row's caption.

A marker only makes sense for an open, still empty row; once a stitch is in it,
the row gets its own caption (§14). After a finished piece there is no next row
(PQW-897), just as there is none in the progress sentence.

## §19 The turn is remembered by pattern identity

On the foundation chain a turn produces no event, so the pattern before and after
it is identical byte for byte (PQW-931). The owner still wants the next-row label
to appear only *after* the turn: *"I have just laid down a row of chain stitches
— and the row 2 marker is already there."*

So the interface remembers *which pattern* the crocheter turned on, by reference
identity. After an undo or a new pattern the current pattern is a different
object, the reference no longer matches, and the label disappears on its own with
no separate reset.

## §20 A warning is announced once, briefly

The hidden live region always receives every message — it belongs to the screen
reader. The popup box does not: it was built for warnings (PQW-923), then given
every operation's feedback (PQW-924), and the owner withdrew that in the first
round of acceptance testing (PQW-929): *"do not keep messaging. the user looks
away for a second and does not see the message."* Operations are read off the
drawing instead. See `docs/kb/decisions.md` §4.

What survives: a *new* warning flashes the box at the top of the canvas for three
seconds and disappears by itself. The permanent indicator at the right of the
toolbar stays, so the problem can be looked up at any time. The live region is
polite and does not interrupt the screen reader.

A finding's card shows the message and the number of stitches affected — nothing
else. The "details" disclosure was removed (PQW-930) because it held only the
knowledge-base code (`docs/kb/decisions.md` §3), and the rule's own explanation
speaks in internal terms. Selecting a finding scrolls to it *and* marks it on the
pattern in red dashes for five seconds, at the owner's request: *"in red, but in
a red dash, and let it disappear after 5 s"*. The chart itself stays clean
(`docs/kb/decisions.md` §4).

## §21 The row axis, not the stem, orients a symbol's cross and bar

PQW-931. A stem can be slanted: on an increase the foot stays in the target's
column while the top is at the stitch's own position. If the cross of the single
crochet followed the stem, it would be rotated by about 53°, and a `+` would read
as an `×` — a *different symbol*, and the single crochet's symbol is `+`
(PQW-929). So the cross and the top bar are measured against the row's axis at
that point, while the yarn-over hatches, which are markings sitting *on* the
stem, keep following the stem.

An `×` stays an `×` on a slanted stem for the same reason: it must not turn into
a `+`.

The symbol for the single crochet follows from the chart style, not from a stored
setting (PQW-929). The owner settled it during acceptance testing: *"the single
crochet symbol should be the + sign. not the x"*. It had been a separate stored
preference, and that was a trap: an old "×" came back out of the browser's
storage and every chart showed a saltire from then on. Nothing is read back for
it now.

## §22 Symbols are geometry first, and never throw on a stored mode

`symbolShapes` returns only geometry (line, curve, ellipse, dot), so it is
testable without a browser; `drawShapes` puts it on the canvas. The origin is the
symbol's foot and y grows downward, so a stem runs towards negative y. The colour
comes from the `--c-ink` design token — no literal colour in the code — and the
line width from the caller.

The insertion mode reaching the chart is the *stored*, right-side mode (PQW-869).
On a wrong-side row that differs from the crocheter's point of view, so it is not
checked against the stitch's list of allowed modes and never throws: the drawing
always completes, and the validator is what reports the problem. (The editor's
entry point, which does work from the crocheter's point of view, does validate.)

## §23 A symbol's bounding box errs large

For a curve the control point is included, so the box is bigger than the shape
rather than smaller. The browser tests measure with it whether the arrow or a row
caption covers a stitch (PQW-916), and for an overlap check, too large is the
safe direction.

## §24 The grid editor is a keyboard grid, and its rows run bottom-up

The editor is a `role="grid"` with roving `tabindex`: arrows move, space or Enter
paint, Delete clears, and dragging with the mouse paints several cells. The keys
it handles never reach the canvas shortcuts. Focus may arrive at a cell any way
at all — Tab, a screen reader, a click — and the keys then apply to that cell, so
the focus handler adopts it rather than forcing focus back.

Rows are numbered from the bottom, as crochet works them: ArrowUp moves to the
*higher* row index. A loaded image runs top-down, and is flipped when it is read
into the draft.

The insertion chooser in the stitches section is a native radio group (PQW-869),
so Tab and the arrow keys behave as the platform defines and the screen reader
reads the group's name with the mode's name. The last chosen mode carries over to
another stitch when that stitch allows it.

## §25 Grid colours: a built-in id, or the user's own name

A built-in colour is saved into the pattern by its language-independent id
(PQW-905) and displayed from the dictionary. As soon as the user types a name of
their own, the id is dropped so the saved pattern carries exactly what they
wrote, and it is never translated; changing a colour's hex leaves the id alone.

The fallback colour, which is named in the interface language rather than by an
id, is effectively unreachable: there are eight built-in colours and `MAX_COLORS`
is also eight, so only a user-made hex collision can reach it. If the limit ever
grows and the branch becomes real, it needs an id too.

Mosaic always works in exactly two colours.

## §26 An image loaded into the grid never leaves the browser

It is drawn to a canvas, scaled down to the grid's size and read back pixel by
pixel (PQW-894). Nothing is uploaded; the CSP allows the `blob:` image for this.
The width is the cell count the user gave, and the height follows from the real
proportion of the image and of a cell.

## §27 Repeat-unit frames, and what the chart's cell lines may not show

The frames are in chart coordinates. A row-worked grid gets one frame; C2C's
diagonal rows get one per tile, around the tile's three double crochets. In
mosaic one grid row is one or two worked rows, and the foot of a stitch worked
into a lower row must not stretch the frame downwards. A chain extension at the
end of a row already belongs to the next row. In filet the cell boundary is the
column itself; in a coloured grid it lies between two stitches, which is what the
half-step in the mapping is for.

Two things the cell lines deliberately do not do:

- The foundation chain's cells have no separator lines (PQW-923). Cells take
  their width from where the stitches actually are, and chain stitches are
  unevenly spaced, so the vertical lines cut a long chain into ragged groups of
  three to five, every fifth one heavier still. The cell stays — clicking it still
  crochets — only its line is gone, so a long chain reads as one row.
- Cell lines never carry counting emphasis (PQW-924). PQW-923 removed it only
  from the row being worked and left it in finished rows; the owner still saw
  grouping by fives in the exported image, and the designer had it too. The rows'
  horizontal lines keep the emphasis: those do not subdivide a row.

Weaker lines are drawn first so they cannot cover an emphasised one. At a band's
edge the band's own outline closes the cell, so the cell emits no line there.

## §28 Placing a stitch never asks

`docs/kb/decisions.md` §4 is the general rule; these are the specific cases the
owner ruled on.

- An occupied target increases without a question (PQW-931). The crocheter moved
  the cursor there *because* they want another stitch in it; the confirmation
  dialog only repeated their own intent back at them. The increase goes into the
  stitch that was clicked (PQW-933), even if it is further back in the row —
  it used to go into the most recently placed one.
- A free target already passed is not a question either (PQW-932). The owner:
  *"you assume the maker proceeds in order… when someone creates a pattern there
  is no continuity. they build the row in whatever form and order they like."*
  Returning to a skipped spot is a *fill-in*, not a crossed stitch.
- Clicking between two stitches of the foundation chain inserts a chain stitch
  there (PQW-941). The owner's request: it is during the second row that a short
  foundation becomes apparent, and undoing the whole row should not be necessary.
  The row above does not move — the new chain simply has no stitch on it, so an
  empty cell is left above it.
- An empty cell in a *closed* row can still be filled (PQW-950): the space left
  above an inserted chain. The owner: *"if I want to go back into the second row
  to put a stitch above the chain stitch newly inserted into row 1, I cannot."*
  The rest of the row does not move.
- A chain stitch is placed even with no grid to aim at (PQW-935): the foundation
  is laid on an empty canvas. For a target-bound stitch, a click outside the grid
  pans the drawing instead.

With the grid on, the cell decides where a stitch goes (PQW-874); where there is
nothing to work into, a message comes back and no stitch is placed.

## §29 A hand-written title, and gauge profiles, survive

A title the user typed is their own and a generator never overwrites it
(PQW-896). Gauge profiles belong to the crocheter rather than to the pattern, so
starting a new pattern carries them over (PQW-859).

A saved pattern also keeps its shape: a default that was not written out stays
unwritten, so a pattern saved before PQW-899 and one saved after it are the same
file.

## §30 The mirrored view was removed from the interface

PQW-911. It did not give a real left-handed view, so it was misleading. The
`mirror` parameter of the renderer and the export remains — the core can lay a
pattern out mirrored — but the interface always asks for the straight one.

## §31 Browser-test hooks live on `window` behind `navigator.webdriver`

Cell positions, row-label boxes, the arrow's box, stitch boxes, the highlighted
finding and the cursor's target are exposed for the browser tests only when an
automated browser is driving (PQW-874, PQW-883, PQW-916). Overlap has to be
measured, not eyeballed.

## §32 Open questions

- The Japanese (JIS) symbol for front-loop insertion is not confirmed by a
  Japanese source (`docs/knowledge-base/` 01 §6.2 marks it open), so it keeps the
  CYC arc. Back-loop insertion in JIS is the straight line below the foot.
- The curvature name for a closing decrease is a new term and is still waiting
  for the owner's approval.

## §33 The written pattern's row number is shifted by the dictionary

`layerLabel` in the dictionary does the shifting (PQW-923): the foundation chain
is row 1, so in rows the printed number is one higher than the layer index.
Callers therefore pass the raw layer index. The shift was once applied at the
call site as well and the two added up.

## §34 The document head

The app itself is `noindex`, but the root is indexable — the owner's decision,
2026-09-16 (PQW-918). The canonical URL is the root without a query, so the
`?lang=en` variant is not a separate result. The Open Graph image is the main
site's, with an absolute URL, because the sharing previews read the static
Hungarian head.

The structured data is a data block, not a running script, so the CSP's
`script-src 'self'` does not affect it. Its publisher points at the main site's
Organization, and `mainEntityOfPage` at the main site's descriptive page.

The icons follow the main site's and are generated from the D6 dragonfly mark
(`scripts/generate-icons.mjs`); being same-origin, the CSP's `img-src 'self'`
allows them. `theme-color` repeats the `--c-bg` token's value, because a meta
tag cannot use a CSS variable — `tests/head.test.mjs` guards the match.

## §35 Fonts are self-hosted, never loaded from the Google CDN

In the EU the CDN would pass the visitor's IP address on without consent. While
the files are not present the system fonts stand in for them.

## §36 Colour contrast and target size are fixed in the stylesheet

- Every interactive element is at least 44 px, the target-size rule taken from
  the main site. The written panel's separator is a 24 px target (WCAG 2.5.8)
  with the handle in the middle, and the handle itself holds at least 3:1
  against the background (WCAG 1.4.11).
- The wrong-side ink holds at least 3:1 on the background
  (`docs/knowledge-base/` 03 §2.1).
- On both alternating grid row colours the symbols, the row number and the
  stitch count hold at least 4.5:1, and the row boundary and the emphasised
  fifth and tenth lines at least 3:1. The cells' side lines are a faint guide
  and carry no information of their own. `tests/ui-grid-colors.test.mjs` checks
  all of it.
- The origin of a value is shown in words, not by colour alone, and an estimate
  additionally gets a dashed border. A repeat unit's cell is marked by a white
  inner and a dark outer ring so it reads on a dark and a light cell alike, and
  the cell's accessible name says so too.
- A disabled toolbar button keeps its text colour and only fades its icon, so
  its tooltip stays readable (§12).

## §37 The status line is a screen-reader live region, not a visible box

PQW-916. It no longer floats over the canvas, where it covered the drawing
(PQW-883 and PQW-884 were spent adjusting that floating box). The live region
itself has to stay: without it a blind user gets no feedback about the editing.
That is why it is clipped rather than `display: none` — assistive technology
only reads changes in an element that is still rendered.

It is pinned to the corner: left in its static position the clipped element
overflowed and the page began to scroll by one pixel.

## §38 Layout incidents in the stylesheet

- The file menu's popover is positioned against its own button, not the right
  edge (PQW-912). `.menu__pop` pins right with a fixed width, which suits the
  findings list at the right of the bar, but the file button sits at the left
  and its panel ran off screen with only its empty right edge visible. Two
  classes are used so the override wins regardless of rule order.
- The pattern-type cards stand at their own height (PQW-912). The list is a grid
  box, so its `gap` does not stretch; an earlier `flex: 1 1 auto` stretched its
  rows instead. The box itself takes the remaining space (`1 1 0`), so a long
  list scrolls inside the bar and the version label really does sit at the
  bottom: with `flex: 0 1 auto` the list absorbed the remainder and the label's
  `auto` margin had nothing left to take, which is why it stuck to the list.
- The "soon" badge sits inside the label box, *below* the name (PQW-912). Beside
  the name it did not fit in the narrow bar and drew over it. A row of its own
  makes the card one line taller and all four cards still fit without scrolling
  — the earlier two-line trouble was the list stretching, not the badge's place.
  (An earlier comment claiming the badge belongs beside the name is withdrawn.)
- The version label is the last item in the bar's column and `margin-block-start:
  auto` pushes it to the bottom (PQW-903, PQW-912); the list above it scrolls, so
  it never covers text and takes nothing from the canvas. It is not clickable and
  is `aria-hidden`, so the screen reader is not read a pointless token.
- In a wide view the open written panel and the status line stand between the
  side bars rather than sliding under them (PQW-884); in a narrow view the side
  bars open over the panel and the status line.

## §39 The free-form type is a second editor, not a second mode

Irregular crochet (PQW-963) works on geometry: a symbol carries its own place,
size and turn. Regular crochet works on topology — a stitch carries `prev` and
`anchors`, and `layoutPattern` derives the picture. Neither model can express
the other, so the free-form type brings its own document (`IrregularPattern`),
its own reader and writer with its own format version, its own undo stack and
its own autosave slot. `src/core/history.ts` was already generic and is shared
untouched.

Two things are deliberately shared rather than copied: the glyph engine and the
notation. `placedShapes` and `symbolShapes` in `symbols.ts` take any placement
the caller builds, so the free-form renderer hands them a transform of its own
and gets back the same `Shape[]` the regular chart draws. `stretchShapes` was
added beside `transformShapes` for the one thing the regular chart never needed:
scaling a glyph differently along each axis.

The two editors own **separate canvases**, `#board` and `#board-irregular`, and
the inactive one is hidden. They were on one canvas first, and the regular
board's own `ResizeObserver` repainted over the free-form drawing. A hidden
canvas cannot race.

`main.ts` keeps one branch each in `refresh()` and `updateControls()`, and the
shared toolbar actions route on `irregular.active`.

The keyboard is the trap. Hiding a toolbar group hides the buttons, not the
shortcuts behind them, and the regular pattern is only hidden, not gone — so a
stray Alt+F, Enter or Delete used to crochet into it silently, with the free-form
canvas unchanged and a row-shaped status line as the only sign. `irregularKey`
therefore **swallows by default**: it lets through only the palette digits, the
grid and the shared undo and redo, and returns `true` for everything else the
regular handler would act on. `e2e/szabalytalan.spec.ts` guards it. The file menu routes on what
the file *is*, not on the type that is showing: a free-form JSON switches to
this type, a regular one switches back.

## §40 The free-form type does not confirm and does not chat

The specification asked for a dialog before deleting a row that still holds
stitches. §4 and `decisions.md §4` say the program does not ask about an action
the user clicked. The decision stands: nothing is confirmed, the status line
names what happened, and undo takes it back. Raised with the owner in the plan
for PQW-963 and left for her to overrule if she wants the dialog.

## §41 In the free-form type the stitch key decides the symbol, not the stitch

A regular chart draws a stitch from its definition and the notation. A free-form
pattern carries its own key (PQW-965): an entry may override the symbol, the
abbreviation and the legend text, and an entry of the crocheter's own has no
library stitch behind it at all. So the view never asks "what is this stitch?"
without also asking "what does this pattern draw it with?" — `naturalGlyph` takes
the override, and `irregular-key.ts` resolves the name, the abbreviation and the
legend text.

Two consequences worth knowing:

- **An entry exists only when it says something the library does not.** Clearing
  the last override deletes the entry, so a pattern that accepts the preset
  carries no key at all and its file stays short. This is also why the preset
  reads "Saját" from `hasOverrides` rather than from the key's mere presence.
- **`stitchById` throws on an unknown id**, and a key entry may legitimately name
  a stitch this build does not have — a file from a newer version, or one of the
  crocheter's own. `findStitch` in `irregular-key.ts` is the lookup that returns
  `undefined` instead, and the free-form view uses only that one.
- **A stitch stores the size it is drawn at**, measured from its symbol when it
  was placed. Change the symbol and that size belongs to the old one, so the new
  symbol would be squeezed into the old one's box — a chain's oval is wide, the
  "0" that replaces it is tall. `#setGlyph` rescales every stitch of the entry,
  keeping whatever stretch the crocheter gave it. A browser test pins this down
  by the drawn proportions, because a test that only reads the saved key passes
  either way.
- **The ambiguity check compares what is drawn**, not what the entries are
  called. The library's own symbols never collide, so only the alternatives need
  naming: `drawnGlyph` maps a chain to `oval` and a slip stitch to `dot`, which
  is what lets it notice that a chain redrawn as `dot` now shares the slip
  stitch's symbol.

The alternative symbols (`ALTERNATIVE_GLYPHS` in `symbols.ts`) exist for the same
reason: the reference charts draw a chain as "0" or as a dot, a single crochet as
"+" or "×", a double crochet as a dagger. Without them the key could only swap one
library stitch's symbol for another's.

## §42 The free-form panels reorder with buttons, not by dragging

The specification asks for rows to be reordered by dragging. They are reordered
with up and down buttons instead, and so are layers.

Dragging a list item is a mouse gesture: it needs a keyboard equivalent for
WCAG 2.2 (§36) and a separate touch path for the tablet this type is meant for
(D8), and it would still have to keep the row numbers live while the pointer
moves. Buttons are one control that works for all three. Raised with the owner
when the panel shipped; the drag gesture can be added on top later without
changing anything else.

## §43 Snapping steps aside for ⌘, and only during a drag

Holding ⌘ (Ctrl on Windows) **while dragging** puts snapping aside for that
drag. It is not a mode and there is no third state to get stuck in: let go and
the next drag snaps again.

The same key also means "add to or take out of the selection" on a press, and
that **is** a conflict: a ⌘-press on a stitch that is already selected used to
take it out at pointer-down, so the ⌘-drag then moved everything except the
stitch under the hand. The rule is therefore: **taking a stitch out of the
selection waits for the pointer to come up.** A ⌘-press starts an ordinary
drag; if the pointer never moved, the stitch leaves the selection on release,
which is the click gesture unchanged. Adding an unselected stitch still happens
at pointer-down, because there is nothing to undo about it.

A drag snaps the item the drag **started on**, not the middle of the selection
box. Dragging a stitch by the one under the pointer is what the hand expects,
and with several stitches selected the rest follow by the same offset, so the
block keeps its shape.

The circle guide's middle is dragged by the dot drawn on it. The dot is only
grabbable while **no stitch is armed** — with a stitch on the pointer a click
places it, because that is what the click was for — and a stitch drawn over the
middle wins over the dot, so a magic ring's first stitch never becomes
unclickable. To get a guide back that has
been dragged off-screen, use "Illeszd a képernyőre": the fit takes the guide in
as well as the stitches.

A resize handle's hit box never grows past a third of the selection box. A
chain is about fourteen units wide, so a fixed fourteen-pixel hit box covered
the whole stitch and every drag resized it instead of moving it. The middle of
the selection always belongs to the drag.

Cited from: `src/ui/irregular-editor.ts` (`#snap`, `#onMove`) and
`src/ui/irregular-board.ts` (`polarCenterAt`, `handleAt`, `#contentBox`).

## §44 A group is selected, edited and broken as one

Clicking any stitch of a chain arc selects the **whole** arc: a group is the
thing the crocheter made, and half an arc is not a thing. From there:

- **Moving** the whole group carries its path with it, so it stays the arc it
  was.
- **Anything else** — rotating, resizing, flipping, aligning, spreading, typing
  a coordinate, or moving only part of it — makes the recipe a lie, so the group
  is forgotten and its stitches stay exactly where they are. That is what
  "Szétbontás" does deliberately, and it is what these edits do quietly, because
  the alternative is a group that claims stitches it no longer describes.
- **Deleting** a stitch forgets its group for the same reason.

Because a group that named a deleted row or layer could not be written to a file
at all — and the failure was silent, so every later autosave failed too — the
repair runs on **every commit**, not at the few places that could break it. See
`core-geometry §52`.

With an arc selected the **digit keys set the stitch count**, and digits typed
one after the other build one number, so "1" then "2" is twelve; a pause of
about a second starts a new one. The typed digits are kept as they were typed,
not read back from the count — the count has a floor of two, so reading it back
made every number starting with 0 or 1 unreachable. The digits are free to mean this because the
palette's shortcuts are ⌥+digit.

The arc tool stays armed after an arc, the way the palette stays armed after a
stitch, so several arcs come one after another. The **grips of the selected arc
win over the armed tool**, so the arc just drawn can be nudged without laying
the tool down and arming it again.

Cited from: `src/ui/irregular-editor.ts` (`#loose`, `#shifted`, `typeArcCount`,
`#onDown`) and `src/ui/main.ts` (`irregularKey`).

## §45 Isolating is a view; repeating is an edit

**Kiemelés** puts the rest of the pattern out of reach so one part of a busy
chart can be worked on. It is a view and nothing else: it records no undo step,
it is not saved with the pattern, and leaving it changes nothing. Escape leaves
it, which is why Escape checks isolation before it clears the selection.

While isolating, the stitches outside are faded **and unreachable** — not only
dimmed. A marquee that sweeps across them takes none of them. Dimming without
locking would be a lie: the point is to be able to drag across a crowded area
without catching what is underneath.

Isolating the last stitch and deleting it leaves no cage behind: when nothing
isolated survives, isolation ends by itself. That check runs on **every commit**,
not only on undo — otherwise deleting the isolated stitches leaves a cage full of
dead ids, and the whole chart becomes faded and unclickable with no way out but
Escape. A new pattern clears it for the same reason.

**Unreachable means unreachable from every direction**, including "select all".
A cage that a keyboard shortcut steps over is not a cage: isolating three
stitches and pressing Ctrl+A then Delete would have emptied the chart.

**Whatever is made while isolating joins the isolation** — a placed, pasted,
duplicated or repeated stitch. Otherwise it would be selected and faded at once:
movable from the panel, unclickable on the canvas.

**Körkörös ismétlés** is the opposite — an ordinary edit, one undo step. Its
centre is the circle guide's middle when the guide is showing, because that is
the wheel being worked around; otherwise the middle of what is selected. The
count includes the original, so eight means a doily of eight sectors, and the
label says so.

Cited from: `src/ui/irregular-editor.ts` (`toggleIsolate`, `repeatAround`) and
`src/ui/irregular-board.ts` (`#reachable`).

## §46 A row line is reshaped on its own; the stitches follow on a button

Dragging a row line's grips changes **only the line**. The stitches stay where
they are until "Egyenletessé tesz" puts them on the new shape. That is the
spec's own flow, and it is what makes the row line a live parameter panel: you
see the shape you are aiming at before the stitches commit to it.

The row line is a guide behind the work, so its grips are hit-tested **after**
the selection's own grips and handles, and only when no group is selected. A
selected arc's endpoint always wins over the row line's, because the arc is the
thing under the hand.

This is why the spec's popup parameter panel per arrange button (P70) is not
built. Arranging happens from where the stitches are now, and the shape it
produced stays on the canvas to be adjusted. One less modal, and the same
result.

Cited from: `src/ui/irregular-editor.ts` (`#grippedRowLine`) and
`src/ui/irregular-board.ts` (`rowLineGripAt`).

## §47 The tracing photo lives outside the pattern

A photo to trace is megabytes; the pattern's autosave slot is `localStorage`,
which is small and throws when it is full. So the **bytes go to IndexedDB** and
only the id and the placement go into the chart. If the picture cannot be kept —
too big, no room, no IndexedDB at all — the **pattern still saves**, and the
issues list says the picture will not come back on a reload. Losing a tracing
photo is a nuisance; losing the chart is not.

The photo is drawn under every layer and is never part of an export unless its
own switch says so: a tracing photo has no place in a finished chart.

It is grabbed only when nothing else was — a stitch over it, and the circle
guide's knob, which often sits right on top of it — and only while it is
unlocked, which is what locking is for. Dropping an image file on the drawing
area loads it, because that is how a photo usually arrives; a dropped pattern
file loads as a pattern, and **anything else dropped is swallowed** rather than
opened by the browser over the editor.

**Removing the picture does not delete its bytes.** Removing is undoable, and a
blob thrown away on the way out could not come back. The bytes go when nothing
in the undo history points at them any more, which is checked when a new picture
is loaded.

Cited from: `src/ui/background-store.ts`, `src/ui/irregular-editor.ts`
(`loadBackground`) and `src/ui/irregular-board.ts` (`backgroundAt`).

## §48 The free-form chart's own way out

The regular type's SVG comes from its layout engine; the free-form type's comes
from the same shapes the canvas draws, so what is exported is what was on
screen. PNG is that SVG rasterised, as it already is for the regular type.

**A hidden row or layer is not in the file at all** — not hidden with an
attribute, not drawn transparent. It must not be recoverable from what is shared.
The tracing photo is out unless its own switch says otherwise, and the guides
follow the existing "Rács a PNG- és SVG-exportban" setting.

**Colour survives into the PDF.** A chart that tells its rounds apart by colour
would otherwise print black, with nothing to say so. Each run of stitches
sharing an ink is written once with that ink.

**Every tile is clipped.** Without it each page draws the whole chart, so a
neighbour's stitches land in this page's margins and straight through its title.

**The legend is on the SVG and the PNG, not yet on the PDF** — and the PDF no
longer keeps room for it, which used to push the chart off-centre to make space
for a blank region.

**The PDF is written by hand**, because the repo has no runtime dependencies and
is not taking one for this. Base-14 Helvetica, no embedded font: the four
Hungarian double-acute letters have no place in WinAnsi, so they take four of its
undefined codes by their standard glyph names. The chart is scaled uniformly
across the chosen page grid, with an overlap so a taped-together chart has no
gap, and the title on every page.

Cited from: `src/ui/irregular-svg.ts`, `src/ui/pdf.ts` and `src/ui/main.ts`
(`exportPng`, the `export-*` actions).
