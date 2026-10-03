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

## §2 The notation's terms follow the interface language; its chart style does not

Two settings, no longer free of each other (PQW-868, PQW-900, **PQW-1122**).
The **terms** belong to the interface language: English gives US terms unless
`en-GB` is stored, Hungarian gives Hungarian ones, and terms stored for the
other language are dropped on load and on a language switch. The **chart style**
is a display choice of its own and survives both.

`owner-decisions.md` §17 says why the independence went: PQW-1048 took the
terminology chooser off the interface, so a stored `terms: hu` under an English
interface was a state the user could neither have chosen nor leave.

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
stays shareable and reloadable.

**English is the default** (PQW-1100). Hungarian is chosen only when something
asks for it: `?lang=hu`, a stored choice, or a document whose `lang` starts with
`hu`. Anything else — no document language, a language the app does not speak —
resolves to English. `index.html` therefore ships English, which is also what a
visitor sees before the script runs and what a crawler indexes.

A missing key no longer throws first: it falls back to English, and only a key
missing from English too is an error. `dictionaries.md` §9 says why the fallback
sits at those two boundaries and nowhere else.

## §5 No new `localStorage` key without an owner decision

Keys are added deliberately, not per feature. The language key (PQW-906) and the
pattern-type bar's open state (PQW-912; retired by PQW-989, §56 — the bar is a
menu now and the key is no longer read) were approved as *operational* settings:
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

Every generator section (shape, shawl, amigurumi, grid, size)
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
motif. The granny square came back on in PQW-1038 (`owner-decisions.md` §15).

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

**The selection's commands are the two exceptions** (PQW-1145). They act only on
a selection, so a key that finds nothing selected is left to the browser:

- `Delete` and `Backspace` (by `event.key`, the meaning rather than the place)
  delete the selection — the one single-key command, because it is the
  universal one for it;
- `Ctrl`/`⌘` + `C`, `V`, `D` (by `event.code`) copy, paste and duplicate. A
  command that did nothing does not `preventDefault`, so `Ctrl`/`⌘` + `C` with
  nothing selected still copies text and `Ctrl`/`⌘` + `D` still bookmarks.

Neither fires while a `<select>` has focus; the `Alt`+digit stitches still do.

**Undo and redo go by the letter, not the place** (PQW-1149): `Ctrl`/`⌘` + `Z`
undoes, `Ctrl`/`⌘` + `Y` and `Ctrl`/`⌘` + `Shift` + `Z` redo. Z and Y swap places
on a Hungarian keyboard, so by `event.code` the key marked Z would redo. The
letter is `event.key`, and only a layout that gives no Latin letter falls back to
the position (`historyCommand`, `ui/platform.ts`). They act on a `<select>`, a
range and the dial's handle too; only a typed field keeps them for its own text.
Unlike the selection's commands they are always `preventDefault`ed, even with
nothing to undo: `⌘` + `Y` is the browser's history page on a Mac.

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
  passes their widths in (`setInsets`), because `--side-start` comes back as the
  unresolved `min(…, 80vw)` expression it is declared as, from which no pixel
  value can be read. Since PQW-979 that declaration is `var(--types-width)`, and
  since PQW-989 `var(--stitches-width)`, the column that replaced the bar (§56); §38
  says why the bars' widths must not be written out twice.
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
- Where a box is only as tall as its content happens to be, the 44 px is written
  out rather than left to chance. The pattern-type card carries its own
  `min-block-size: 44px` (PQW-985): before it, the card cleared 44 px only
  because the icon is 1.4rem and the padding was `0.6rem`, and compressing the
  padding would have taken the shortest card to 33 px without a single rule
  saying so.

## §37 The status line is a screen-reader live region, not a visible box

PQW-916. It no longer floats over the canvas, where it covered the drawing
(PQW-883 and PQW-884 were spent adjusting that floating box). The live region
itself has to stay: without it a blind user gets no feedback about the editing.
That is why it is clipped rather than `display: none` — assistive technology
only reads changes in an element that is still rendered.

It is pinned to the corner: left in its static position the clipped element
overflowed and the page began to scroll by one pixel.

## §38 Layout incidents in the stylesheet

PQW-989 changed the ground under several of these: the bar is one line with the
panel toggles at its end, the type bar is a menu and its cards are menu items,
and the stitches hold the left column (§56). The entries below are kept for
their reasons; where they describe the old shape, §56 is the current one.

- The menu bar is a chrome half and a context half (PQW-983). `.tools__chrome`
  holds what every pattern type has — the type-bar toggle, the file group, the
  edit group and the panel toggles — and `.tools__context` what the type brings:
  the row group, the drawing tools, the selection and the view. The tools used to
  be one wrapping row of eight groups on a line of their own under the title, and
  in the owner's 1000 × 506 window that made the bar 157 px, 31 % of the window,
  with the groups already wrapped into two rows. From 60rem the chrome stands
  beside the title instead and the context takes the line under it, which gives
  the canvas a whole row back: the bar is 107 px at 1000 × 506 and 57 px at
  1440 × 900, where everything fits on the one line. Below 60rem the tools go
  back to a line of their own, the way they were, so a phone-sized window is
  unchanged.

  `.tools__group--end` keeps its `margin-inline-start: auto`, but it now resolves
  inside the chrome rather than inside `.tools`. Where the context has a line of
  its own the chrome fills the title's line and the panel toggles still sit at
  the bar's right edge; on the single line of a 1440 px window they sit at the
  end of the chrome, before the context, because flexbox cannot order a box
  across two parents. That is the visible cost of the split, and it is the price
  of the chrome being one box that never wraps.

  The two constraints that decide the shape are tests, not taste. One Tab from
  `[data-action="new"]` has to reach `#file-toggle`, so the two stay DOM
  neighbours inside the file group; and „Fordulás" has to be visible on load in
  both windows, so under 68.75rem the context drops its labels and keeps the
  icon, the 44 px target and the `data-tip` bubble. An overflow menu would have
  broken the second one, which is why there is none. The split is nesting only —
  `.tools__group > .tool` and `.tools .tool` still address the same buttons, so
  no browser test moved, and `tests/fixtures/control-inventory.json` and
  `tests/fixtures/e2e-locators.json` stayed byte-identical.
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
  makes the card one line taller. With `0.6rem` of block padding the card stood
  57 px and the four of them plus the three 8 px gaps wanted 252 px, which was
  more than the list had in a 506 px-high window — 215 px before PQW-982, 221 px
  after it — so the list scrolled and clipped the fourth card (PQW-979).

  PQW-983 gave the list 271 px at 1000 × 506 by taking a row out of the bar, and
  that alone made all four fit at that width. It did not fix the card: below
  60rem the tools take a line of their own again and the list is back to 221 px.
  So PQW-985 compressed the card as the owner asked — block padding down to
  `--sp-0` and the intro sentence's margins to `--sp-2`, the sentence itself
  untouched because it is frozen product text. The card is now 44–46 px and the
  four of them 204–208 px, which fits at every width in a 506 px-high window, in
  Hungarian and in English. The floor is `min-block-size: 44px` on `.type`,
  written out rather than left to the icon's height to produce by accident (§36):
  the shortest card, the one-line English name with no badge, would otherwise
  have come out at 33 px. The earlier two-line trouble was the list stretching,
  not the badge's place.
  (An earlier comment claiming the badge belongs beside the name is withdrawn.)
- The version label is the last item in the bar's column and `margin-block-start:
  auto` pushes it to the bottom (PQW-903, PQW-912); the list above it scrolls, so
  it never covers text and takes nothing from the canvas. It is not clickable and
  is `aria-hidden`, so the screen reader is not read a pointless token.

  It also carries a hairline above it (PQW-979). The two boxes never overlapped,
  but in a 506 px-high window the list ran out of room and clipped its last card
  mid-word, and the label sitting flush under that cut read as part of the card
  rather than as chrome. The rule separates the two; it did not make the fourth
  card fit. PQW-983 did at 1000 × 506, by taking a row out of the menu bar, and
  PQW-985 did at every width, by compressing the card.
- In a wide view the open written panel and the status line stand between the
  side bars rather than sliding under them (PQW-884); in a narrow view the side
  bars open over the panel and the status line.
- Each side bar's width is written once, as `--types-width` and `--panel-width`
  on `:root` (PQW-979). `.types`, `.panel` and the `--side-start` / `--side-end`
  pair all read those. They used to be four separate literals, and they had
  already drifted: `--side-start` said `16rem` while `.types` was `13rem`, so the
  written panel and the alert started 48 px to the right of where the bar ended.
  The canvas insets that `board.setInsets` passes in come from
  `getBoundingClientRect` and were always right, which is why the row captions
  never showed the bug — only the written panel did.

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

The right panel was the same trap in a slower form (PQW-976). `showIrregularView`
swapped the canvas and the toolbar groups but left the regular type's generator
sections — „Méret és fonal”, „Forma”, „Kendő”, „Ruhadarab”, „Kör és motívum” —
standing in the panel. A „Minta létrehozása” there ran the regular `commit()`,
which replaced the hidden regular document and `persist()`-ed the replacement
over the user's earlier work in the same breath; the status line then promised
that undo would bring the old pattern back, while undo was routed to the
free-form stack. **Anything that edits the regular document leaves with the
regular editor**, so `showIrregularView` toggles those sections' `hidden`
together with the tool groups. The list is collected *after* `panelFor` (§9) has
run and drops whatever it already hid, because a switched-off type's section must
never reappear on the way back. `e2e/szabalytalan-generatorok.spec.ts` guards
both halves: the sections are gone in free-form mode, and the regular pattern
returns untouched.

PQW-980 closed three such paths, and the shape of each says where a guard has to
sit. `e2e/szabalytalan-vezerlok.spec.ts` guards all three by watching the
autosave slot, since `commit()` `persist()`s in the same breath and that slot is
what silently replaced the user's earlier work.

The „Előbeállítás” select of `#section-notation` is the one whose section must
stay: the notation is genuinely shared, and its „Jelkészlet” and „Jelstílus”
selects go on working in both types. The preset does not, because it is the
pattern's `conventions` — its own note says so. It therefore takes the
`titleInput` guard exactly: return, change nothing. Running only the symbol half
was tried and rejected, because it lands the panel in a state the preset cannot
undo — the pattern keeps `cyc` while `chartStyle` is left at `jis`, `refresh()`
resets the select to „Nemzetközi” on the way back, and re-choosing it fires no
`change` event.

The „Kijelölt jel igazítása” box was the simpler kind: `#adjust` was hidden only
from `updateControls()`, which `refresh()` does not reach in this type, so a box
left open in regular mode came straight through. `showIrregularView` now hides it
with the rest, and `updateControls()` recomputes it on the way back. `nudge` and
`unpin` took the `irregular.active` branch as well. The keyboard behind them was
never exposed: `irregularKey` swallows Alt+arrow by default, above.

The third was found in review and is the reason the other two are not the end of
it. `#section-stitches` is shared like the notation, so the palette stays in
free-form mode — and the keydown handler answers Enter in `#chain-count`
**before** `irregularKey` can swallow it, to keep the promise the palette hint
makes. `workAtCursor` crocheted that into the hidden document. Since PQW-1135
the count field is in `#panel` rather than in that shared column (§81), which
changes nothing here: `showIrregularView` hides the regular type's sections one
by one and the count field is not among them, so it is still shared — by
omission now rather than by its parent.

**What is left is held by visibility, not by a guard.** `delete-last`, `same`,
`fill-row`, `end-row`, `close-round` and `spiral-round` all reach `commit()`
unguarded; they are out of reach today only because their buttons live in the
hidden `#tools-row` and `irregularKey` swallows Alt+F, Alt+K and Alt+S. Moving
any of them into a shared section, or answering their key above `irregularKey`,
reopens this bug — which is exactly how the third path came about.

**The guard still stays at the caller, not at the top of `commit()`** (PQW-980),
though the margin is narrower than it looks. A central gate would have to drop
silently, and §4 of `decisions.md` forbids the alternative of telling the user;
it would also govern two dozen callers, including the import path, which commits
a regular file from free-form mode and is correct only because `selectType`
unmounts first — an ordering nothing tests. The deciding reason is that dropping
is not what these callers want: `titleInput` **redirects** to
`irregular.setTitle`, and `select()` already branches on `irregular.active` to
change its hint. A gate in `commit()` cannot express either, so those branches
would stay and the central one would be a second, duplicated policy. The price
of the decision is the paragraph above: each new `commit()` caller has to
remember, and only the reachable ones are tested.

## §40 The free-form type does not confirm and does not chat

The specification asked for a dialog before deleting a row that still holds
stitches. §4 and `decisions.md §4` say the program does not ask about an action
the user clicked. The decision stands: nothing is confirmed, the status line
names what happened, and undo takes it back. Raised with the owner in the plan
for PQW-963 and left for her to overrule if she wants the dialog.

## §41 In the free-form type the stitch key decides the symbol, not the stitch

*Since PQW-1013 (§62) the key has no interface: nothing can add an override or
an entry of her own any more. The data, and what follows below for files that
already carry one, stands.*

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
  carries no key at all and its file stays short.
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

## §43 Snapping steps aside for ⌘, everywhere

Holding ⌘ (Ctrl on Windows) means **"not this one"**: while it is down nothing
snaps — placing a stitch, the ghost that shows where it would land, drawing a
chain arc, a fan or an annotation, and dragging something that already exists.
It is not a mode and there is no third state to get stuck in: let go and the
next gesture snaps again.

It was built the way the spec words it — "during a drag" — and the owner found
it useless within a day, because she places stitches rather than dragging
existing ones. The rule it left behind: **a modifier that only works in the
gesture nobody uses is the same as no modifier at all.** One rule, every
gesture, is also less code: the check lives in `#snap` itself rather than at
each call site, so no future gesture can forget it.

Because the key can go down before or after the pointer, **both report it** —
every pointer event carries `metaKey`/`ctrlKey`, and the window's key handlers
set it too, with a reset on blur so a key released outside the page cannot
leave it stuck on. Two rules keep that honest:

- **A pointer may only raise the flag, never lower it.** Touch and pen always
  report no modifier at all, so on a tablet with a keyboard the finger would
  otherwise undo what the held key just said.
- **A gesture that finishes on pointer-up remembers what the key said while it
  was drawn.** Letting go of the key just before the mouse button is the natural
  order for one hand, and the arc that lands must be the arc that was previewed.
  Every other gesture is safe already, because it commits a draft built while
  moving.

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

## §45 Isolating is a view

*Removed in PQW-1015 (§63): the owner found it did not work and had no use for it.*

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

**Whatever is made while isolating joins the isolation** — a placed, pasted
or copied stitch. Otherwise it would be selected and faded at once:
movable from the panel, unclickable on the canvas.

The circular repeat that stood beside it was removed in PQW-1006; see §57.

Cited from: `src/ui/irregular-editor.ts` (`toggleIsolate`) and
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

**There is no legend on the image any more** (PQW-1013, §62); the PDF never had
one and keeps no room for it.

**The PDF is written by hand**, because the repo has no runtime dependencies and
is not taking one for this. Base-14 Helvetica, no embedded font: the four
Hungarian double-acute letters have no place in WinAnsi, so they take four of its
undefined codes by their standard glyph names. The chart is scaled uniformly
across the chosen page grid, with an overlap so a taped-together chart has no
gap, and the title on every page.

Cited from: `src/ui/irregular-svg.ts`, `src/ui/pdf.ts` and `src/ui/main.ts`
(`exportPng`, the `export-*` actions).

## §49 Annotations are one kind with a discriminator

The spec sketches five item types — row number, start marker, repeat bracket,
text, arrow. They are **one** kind with a `note` discriminator: one reader
branch, one drawing pass, one panel block instead of five of each. They differ
in what they draw, not in what they are.

**An annotation is never a stitch.** The row's count and the pattern's count
both skip them, which is what D12 asks for and what makes the number in the rows
panel trustworthy. Counting all of a row's items, rather than its stitches, was
the bug this rule exists to prevent.

**A row number belongs to its row twice over**: `linkedRowId` says which row it
names, so the number and the arrow are rebuilt on every commit and follow
reordering and a change of direction; and `rowId` puts it *on* that row, so
hiding the row hides its number too.

**No dialog asks for the words.** A text or a bracket lands empty and the
panel's text field takes the focus, so typing goes straight in — `§40` forbids
interrupting an action the crocheter already chose, and a prompt is exactly that.

Cited from: `src/core/irregular-types.ts` (`AnnotationItem`),
`src/ui/irregular-note.ts` and `src/ui/irregular-editor.ts` (`#refreshLabels`).

## §50 What keeps a big chart usable on a tablet

**One finger uses the armed tool; two zoom and move the drawing area.** The
canvas takes `touch-action: none` so the browser never steals the gesture. A
second finger arriving mid-drag cancels that drag, so a pinch can never leave a
half-made stitch behind.

**Only what is on screen is drawn.** A chart of thousands otherwise redraws
every stitch on every frame. Items are culled against the visible rectangle with
a little slack, so nothing pops in during a pan.

**There is no delayed autosave, and there is no need for one.** A drag builds a
draft and redraws; it does not commit, so nothing is written until the pointer
comes up. A debounce was written for this and then removed: it could never run,
and its test could never fail. A write that never happens needs no optimising,
and dead machinery that looks like care is worse than none.

**A pinch takes back what the first finger did.** The first finger acts at once,
because waiting to see whether a second one is coming would make every tap feel
slow — so when a second finger does arrive, the undo steps the first one made
are unwound and its selection is put back. Otherwise pinching to zoom with a
stitch armed drops a stray stitch into the pattern, and pinching over empty
canvas silently clears the selection.

Lifting one of three fingers leaves a **different pair**, so the gesture is
re-seeded rather than measured against the pair that just changed, and a finger
still down when the view closes is forgotten — otherwise it looks like one half
of a pinch forever and single-finger drawing never works again.

Cited from: `src/ui/irregular-editor.ts` (`#startPinch`, the touch handlers) and
`src/ui/irregular-board.ts` (`#visibleBox`, `zoomAndPan`).

## §51 "Item" is not a synonym for "stitch"

Making annotations items of the same list made every place that said *item* and
meant *stitch* wrong at once, and the type checker caught only the ones that
touched a stitch's own fields. The rest had to be found by reading:

- the counts in the rows **and layers** panels,
- the crochet order, which decides the order overlay, a round's centre and
  therefore a round's whole reading order,
- what an arrange acts on when nothing is selected,
- a row's bounding box, which even row spacing measures from,
- and what "this row is empty" means.

Every one of them is about stitches. The rule to carry forward: **when a
function says `items` and the answer is about crochet, it wants `isStitch`.**

A copied row number drops the row it named: a label that sits on one row and
forever reads another's number is worse than one with no number at all.

Cited from: `src/core/irregular-order.ts`, `src/core/irregular-layers.ts`,
`src/core/irregular-rowline.ts` and `src/core/irregular-document.ts` (`unlinked`).

## §52 The stylesheet's spacing, radius and shadow scale

PQW-982. Before it the stylesheet had colour and font tokens and nothing else:
ten ad-hoc spacing values between `0.1rem` and `0.75rem`, nine border radii, two
box shadows written in two different colour languages, and seven hardcoded
`#fff` on a warm cream page.

**The spacing scale is the main site's, copied value for value** so the two
products are one system; only `--sp-0: 0.25rem` is this app's own, because the
editor is denser than a marketing page. The scale therefore starts at
`0.375rem`, and there is nothing between `--sp-0` and `--sp-1`.

**Mapping rule.** Each old value went to the nearest step, and **an exact tie
goes down**: `0.5rem` → `--sp-1`, `0.75rem` → `--sp-2`, `1rem` → `--sp-3`. This
is a rule about this app, not about arithmetic: the editor is a dense tool, and
the 1000 × 506 window is already short of room (§38).

The rule bounds the damage but does not remove it. Every tie went down, and the
only values that grew are the three that sit a rounding hair under a step —
`0.35rem` → `0.375rem`, `0.6rem` → `0.625rem`, `0.85rem` → `0.875rem` — each
0.4 px. Nothing grew by more than that, which is why the conversion could not
push a box into a new row on its own; where it did move something, the boxes
were measured rather than argued about.

**The toolbar is a deliberate exception.** `.tools` sits below the scale on
purpose (`.tools__group` gap, `.tools .tool` gap and padding), and rounding it
up to `--sp-1` would push it into a third row at 1000 px — the opposite of what
PQW-983 is for. Those values take `--sp-0`, and the two that fall under even
that (`0.1rem` between a toolbar icon and its label, `0.2rem` of block padding
inside a 44 px target) stay literals. The exception is the toolbar's own
density, not a licence to shrink whatever hangs off it: the tooltips take the
ordinary steps, and `e2e/panel.spec.ts` is what settles whether a bubble still
fits — it hovers every visible button in a 1000 px window and fails if
`document.documentElement.scrollWidth` moves. PQW-983 took the same step for the
context half: under 68.75rem its group gap and the hairline's lead-in drop to
`--sp-0` as well, because a label-less group needs less air around it than a
labelled one. Nothing else moved onto that step.

**`min-inline-size: 44px` and `min-block-size: 44px` are not spacing.** They are
the WCAG 2.5.8 target size (§36) and are never tokenised — a target that follows
a spacing scale stops being a guarantee.

**Radius.** Nine values became four: `--radius-sm` for chips and keys,
`--radius-md` for controls and notices, `--radius-lg` for cards, popovers and
dialogs, `--radius-pill` for fully rounded ends. `50%` stays where a circle is
meant, because a circle is not a step on a scale.

**One shadow.** `--shadow-1` is the ink-tinted one; the pure-black variant is
gone. Both places that had a shadow are the same thing — a surface floating over
the canvas — so they get the same elevation.

**`--c-surface`** is the main site's cream, the value this file already carried
as the logo's eye. It replaces `#fff` on the form controls, which read cold
against `--c-bg`. The grid chart keeps real white: there `#fff` is an empty
cell, chart ink rather than a surface, and it has to stay distinguishable from
the cream page behind it.

## §53 The stitch palette is split by how it is used, not by what it contains

*Partly superseded by §56 (PQW-989): the palette is in the left column, every
section is a tile grid, and the tile prints the full name. What still holds from
here is why the structure line stays and why the order must not change.*

PQW-984. Measured at 1000 × 506 on v0.56.0, the palette put every one of the
twenty-five stitches in its own full-width row — icon, full name, structure line,
key cap — so `#palette` was **1870 px** tall inside a 343 px panel, the first
stitch started at y = 324 because 68 px of `#hint` prose stood above it, and
**two** stitches were reachable without scrolling. It is the most-used control
in the editor.

**The obvious fix does not work, and the stitch data is why.** A grid of icon
plus abbreviation was the first design. `src/core/stitches.ts` rules it out:

- **Nineteen of the twenty-five have no Hungarian abbreviation.** That is
  deliberate — `types.ts` writes `null` for "no approved abbreviation, the name
  is spelled out" (`docs/knowledge-base/01 §8.5`), and the longest spelled name
  is 22 characters.
- **Six names are not unique.** "szaporítás" twice, "fogyasztás" four times,
  "fürt" twice. Only `stitchStructure()` tells them apart — "2 rp egy szembe"
  against "3 erp 3 szemen át". An icon-or-name grid would show four identical
  "fogyasztás" buttons. English does not rescue it either: US terms abbreviate
  the same six as `inc` ×2, `dec` ×4 and `CL` ×2.

**So the palette is split where the data already splits it.** The seven `basic`
stitches — exactly the ones that carry `Alt`+1–7 (§11), and six of the seven the
only ones with a Hungarian abbreviation — are a four-column grid that is always
open. The other eighteen keep **today's row layout unchanged**, structure line
included, inside three `<details>` groups that start closed. The result is about
280 px against 1870, and the three group headers are still in the window at
1000 × 506.

**The structure line is not decoration.** Whatever else the non-basic groups
get, they keep it: it is the only thing distinguishing six of the stitches. The
row itself is the old one to within the §52 conversion the palette block had
been missed by — `0.5rem` of padding and `0.75rem` of gap became `--sp-1` and
`--sp-2`, so a row is 2 px tighter than it was.

**A group that is open stays open, and an armed stitch is always on screen.**
`renderPalette()` rebuilds the whole palette on a notation or interface-language
change (§6), which would otherwise snap every group shut; it carries the open
flags across by the sections' ids. `select()` opens the group of the stitch it
arms, because `Alt`+8 and `Alt`+9 reach into a collapsed group (§11) and an
`aria-pressed` button nobody can see is not feedback.

**What still pushes the grid down.** `#insertion` stands above `#palette` and is
205 px tall at 1000 × 506, so arming a stitch that takes insertion modes moves
the grid from y = 219 to y = 440 and the seven cells leave the window again.
That is the old markup order, not something the split introduced, and moving
that panel was not part of this ticket — it is the next thing to measure.

**The abbreviation is printed, the full name is announced.** The visible label
in a grid cell is `def.terms[notation].abbr` — so it follows the *notation*, not
the interface language (§2, §6) — but the accessible name stays the full name,
carried by a visually hidden span, and the tooltip repeats it. Eighteen e2e
locators search by `getByRole('button', { name: /Láncszem \(lsz\)/ })` and
`#palette` is asserted to contain `Half double crochet (hdc)`; both still hold.

**The one basic stitch with no abbreviation gets a shortened name, not an
invented one.** `dtr` is "háromráhajtásos pálca" in Hungarian and
`docs/stitch-vocabulary-proposal.md` marks "hrp" unverified, so the cell prints
"háromráhajtásos". The label lives in `src/ui/i18n/palette.ts`, keyed by
notation locale rather than by interface language, which is why it is not part
of `UI_TEXTS` — `tests/ui-i18n.test.mjs` requires the English branch of that
dictionary to hold no accented Hungarian.

**The bubble is positioned against the grid, not the cell.** `.palette__grid` is
the positioned ancestor, so a long name spans the grid's width and cannot hang
off the right edge of the panel the way a cell-centred bubble would (§12). The
toolbar's own tooltip rules are untouched.

**`#hint` moved below the palette**, and its empty-state string was split into
three sentences with the instruction first. The help text is still a promise
(`owner-decisions.md §12`): the three *chosen-stitch* hints, the ones that say a
stitch is worked with Enter or by clicking the canvas, are unchanged.

**The order must not change.** `buildPalette()` hands out `Alt`+1–9 by the
stitches' global position, so reordering the sections would move the shortcuts.

## §54 The make-a-pattern sheet, and why its opener is in the file menu

*Its toolbar opener was removed in PQW-1129; §79 has the reasoning that replaces the
paragraph below on where the opener belongs.*

The generators — shape, shawl, round and motif, and the two switched-off
ones — replace the whole pattern when their button is pressed. That is a way to
*start*, not a control used while drawing, and in the panel they were 58 of the
104 controls a regular pattern showed. They live in `#setup` now: a sheet that
stands where the panel stands, `min(34rem, 92vw)` wide, so the previews they
already draw finally have room.

**The opener is a file-menu item, not a toolbar button, because the bar has no
space.** Measured on the built output at 1440 × 900 after PQW-983: the chrome row
is 491 px and the context row 631 px against 1132 px. One more button — even
with a label as short as „Készítés" — wraps the bar into a second row and costs
50 px of canvas at *every* width. The file menu is where „Új minta" already
starts a pattern, so the two ways to begin one sit together.

**The notation stayed in the panel.** It was moved into the sheet first and moved
back: `#ui-language` is the only interface-language control there is, and behind
a menu and a sheet it sat two levels deep. Four controls do not crowd a panel;
burying the language switcher is a worse trade than the one it buys.

**The sheet takes focus when it opens.** Its opener is inside the file menu,
which closes on the click, so the focus would otherwise fall to the body. Closing
it from its own „Lecsukás" hands the focus back to `#file-toggle` — the same
shape as the file menu's own Esc (PQW-911).

**It holds no state and is always closed on load.** A settings sheet that reopens
itself is the program talking when nobody asked (`owner-decisions.md` §3). It
also keeps the layout specs valid without a precondition, and `#panel` visible on
load for the production smoke test. No new `localStorage` key (§5).

**It participates in the insets.** `insetRight` measures whichever of the panel
and the sheet is open, and the `--side-end` variable follows `--setup-width`
while it is open, so the row captions, the written panel and the alert clear it
(§15). Its width is written once, beside `--panel-width` and `--types-width` (now `--stitches-width`, §56)
(PQW-979).

**While it is open it covers the panel.** They stand in the same place and the
sheet is above. A spec that needs the panel afterwards closes the sheet first.

**It reserves its width only above 67 rem, and takes turns with the written panel
below that.** At 34 rem the sheet plus the type bar leave a 768 px window 16 px
of stage: the written panel came out 40 px wide, its own close button landed
outside its box and under the sheet, and it could not be closed at all. So
`--side-end` follows the sheet only from 67 rem — that rule has to sit *after*
the 48 rem block, or the panel's own `--side-end` wins on order — and below it
opening the sheet closes the written panel, exactly as opening the right panel
already does in a narrow window. The alert sits above the sheet (`z-index: 8`),
because a warning behind it would be a warning nobody sees.

**Opening it does not refit the board.** `fitBoard` recomputes scale and offset
from scratch and would throw away the pan and zoom. `#panel-toggle` covers the
canvas too and does not refit; the sheet follows it.

**Escape closes it.** The sheet is focused, and `#setup` is not an input or an
open menu, so without this the key fell through to the handler that clears the
stitch selection: opening the sheet and pressing Escape to dismiss it wiped the
selection and left the sheet open.

**In the free-form type the opener is hidden.** Every section of the sheet
belongs to the regular type and `showIrregularView` hides them (PQW-976), so the
sheet would open showing its title and a promise with nothing under it.

**Making a pattern does not close it.** A shape is found by trying numbers, and
the opener is two clicks away through the file menu, so closing after every
attempt would tax the loop the sheet exists for. The four generator callbacks
became one `generated` function to say so in one place. If the sheet ever gets a
toolbar button, this is worth revisiting.

## §55 What the panel shows first, and what it scrolls to

*Since PQW-989 „Szemek” is the left column rather than the panel's first section
(§56); the order inside it — palette, then the insertion — is this section's.
`#count-field` left that column for the head of the right panel in PQW-1135
(§81), because below a 904 px palette it was out of sight.*

Two orderings inside the right panel, both measured at 1000 × 506 after the
generators left for the sheet (§54).

**The palette leads „Szemek”.** `#insertion` is 205 px tall and stood above it, so
arming a stitch that takes insertion modes pushed the grid from y 169 to y 390
and three of the seven basic cells left the window. It follows the palette now —
as `#count-field` did until PQW-1135 took it to the right panel (§81). That is
also the order of the task: you pick the stitch first and say where it goes
second.

**`#adjust` follows „Szemek”, and scrolls itself into view.** It used to stand
after every setting, so in a 506 px window it appeared 436 px below the fold —
the answer to a click the user had just made, out of sight, with nothing saying
so. It is moved up, and revealing it calls `scrollIntoView({ block: 'nearest' })`.

The scroll runs **after** the box's name is written into it. Called before, the
box is still one line tall, and it is scrolled to a height it no longer has: the
measurement came out 21 px past the panel's edge. `.panel` also carries
`scroll-padding-block`, so a box scrolled into view lands clear of the edge
rather than flush against it.

**The pattern name is still below the fold, and that is left alone.** At 506 px
the palette alone fills the panel, so nothing after „Szemek” is visible without
scrolling. Lifting `#title` above the palette would cost the most-used control
50 px to save a field that is typed once. The full head-and-body split the
redesign considered does not change this either: the body is still below the
fold. If it ever matters, the measurement to beat is `#title` at y 681.

## §56 One line of tools, the stitches on the left

PQW-989. The owner's verdict on v0.57.0: the right panel still took a lot of
scrolling to find anything, and the stitches still sat behind collapsed groups.
Measured in the free-form type at 1440 × 900 before the change: the bar was two
lines (107 px), the panel's content 3242 px in a 793 px panel, and eighteen of
the twenty-five stitches were one click away inside `<details>`.

**The type bar became the „Típusok” menu.** Four cards, three of them switched
off, do not earn a 13 rem column for the whole session. `#types` is a
`.menu__pop` now, opened from `#types-toggle` like the file menu; a choice closes
it, and opening it puts the focus on the current type. The open-state key of the
old bar (`dc-mintatervezo:mintatipus`, §5) is no longer read or written. The
irregular type is called „Szabad tervező” in the interface — the type name, and
the heading of its shortcut list; the pattern it makes is still an irregular one,
so „Új szabálytalan minta” stays. The owner asked for it to lead the menu
(PQW-990); the default for a first visit is still „Szabályos horgolás”, which
`DEFAULT_PATTERN_TYPE` holds apart from the list order.

**The stitches took the left column.** `#section-stitches` is an `<aside>` where
the type bar stood, `--stitches-width` wide (17 rem: 18 and 19 rem measured only
25 px less palette height, not worth the canvas). Nothing in it folds: every
section is a three-column grid of tiles with its title above, and the tile
prints the full name and, where there is one, the structure line — the only
thing that tells the four „fogyasztás” apart (§53). The tooltip repeats both.
The palette is 935 px tall, so in a 506 px window the column scrolls; an armed
stitch is scrolled into it (`revealStitch`), because `Alt`+8 and 9 reach below
the fold. The abbreviation-only label and its shortened-name dictionary
(`i18n/palette.ts`) went with the compact cell.

**One button for both columns.** `#panel-toggle` („Szemek és beállítások”)
opens and closes the stitch column and the panel together — its name already
said both. `insetLeft` measures the stitch column.

**The version label moved into that column's corner** (`decisions.md` §5: it is
read at a glance after a deploy). It is `position: sticky` at the bottom, so the
stitches scroll under it and it never leaves the corner.

**The bar is one line, and gives way in steps rather than wrapping.** The chrome,
the context and the panel toggles are siblings in `.tools`, the toggles last with
`margin-inline-start: auto`, so they sit at the right edge again (§38's cost is
gone). Everything is 44 px (§36), and 21 buttons do not fit a 1000 px line with
labels, so `fitBar()` tries the steps in order and keeps the first that does not
overflow `.tools`, writing it to `.bar[data-fit]`:

| step | what gives way |
|---|---|
| 0 | nothing |
| 1 | the labels go; the icon, the target and the `data-tip` bubble stay |
| 2 | the title and the home link's text go (the mark stays), and the gaps shrink |

(Until PQW-1006 there was a step before the labels that folded the view group
into the „Nézet” menu. The view group is a menu in every width now — §57 — so
that step is gone and the numbers above moved down by one.)

The steps are measured, not set by media query, because the width that needs
them depends on the type and the language: the free-form bar with labels wants
1531 px in Hungarian, the regular one 1409 px, and the English labels differ
again. Measured on this branch, the step taken:

| width | regular hu | free-form hu | regular en | free-form en |
|---|---|---|---|---|
| 1920–1536 | 0 | 0 | 0 | 0 |
| 1440 | 0 | 1 | 0 | 1 |
| 1280 | 1 | 2 | 1 | 2 |
| 1200 | 2 | 3 | 2 | 3 |
| 1100–1000 | 3 | 3 | 3 | 3 |

Where even step 3 overflows — the free-form bar below about 1000 px, the
regular one below about 900 — `data-wrap` lets it wrap the way it did before PQW-983. The
owner chose the order (the view group before the labels, with the zoom still on
the wheel) when told the line could not hold every labelled button. `fitBar`
runs from a `ResizeObserver` on the bar and on `#error-toggle`, whose label
changes with the findings, and after a type or a language change.

**The „Nézet” menu is a class, not `hidden`.** In a wide window the same four
buttons are the bar's own, and the global `[hidden] { display: none !important }`
cannot be overridden for one state and not the other. `#view-menu.is-open` opens
it, `closeAllPopovers` and Escape close it like the other menus (the Escape
lookup reads `aria-expanded` for that reason), and a click on a zoom step leaves
it open, because zooming is several clicks. A change of step closes it.

**What the review found (PQW-989).** Three things a change like this breaks
without a single test going red, worth checking the next time a control moves
into a menu or two panels start opening together:

- *A menu that closes on a choice drops the focus.* The card the user pressed
  Enter on is inside the popover that `selectType` hides, so the focus fell to
  `<body>` and the next Tab started at the top of the page. `selectType` hands it
  back to `#types-toggle` when it was inside the menu, the way Escape does.
- *A rule that hides captions hides data too.* `#error-count` is a label by
  markup and a findings count by meaning, and the step-2 rule took it away with
  the captions. It now goes only while it says „Nincs hiba”; while there are
  findings it stays, even if that tips the bar into `data-wrap`.
- *Two overlays opened by one button share the width.* Below 48 rem the columns
  are overlays, and at `80vw` each the panel covered three quarters of the
  palette on a phone. There both are `50vw`, side by side; the tiles stay above
  44 px.

**What the tests pin.** `e2e/egysoros-sav.spec.ts`: one line and every visible
tool on screen at 1440 × 900 and 1000 × 506 in both types, the menu at the
owner's size, the labelled group at 1920, the shared toggle. The specs that
click a pattern type now open `#types-toggle` first, and the free-form specs that
click „Rács” at 1440 open `#view-toggle` first, because that bar is at step 1.

## §57 The free-form bar: tools in the bar, settings in menus

PQW-1006, the first step of the free-form redesign. The owner's reading of
v0.58.0: the arc and fan tools looked highlighted, „láncív” was on the palette
and on the bar meaning two things, „Duplikálás” and „Ismétlés” could not be told
apart, „Nézet” did not look like a menu, and the panel mixed the selection with
export, background picture, guides and row numbers.

**What moved where.**

| was | is |
|---|---|
| „Láncív”, „Legyező” in the bar | „Ív húzása”, „Legyező húzása” — the palette keeps its „láncív” symbol |
| „Felirat”, „Nyíl”, „Zárójel” in the bar | the „Jelölések” menu (`#notes-toggle`), with „Sorszámok minden sorhoz” and „Kezdőpont az aktív körre” from the panel |
| „Duplikálás” | „Másolás” — the same action, `duplicate-selection`, Ctrl+D |
| „Ismétlés” and the panel's „Körkörös ismétlés” | removed, with `src/core/irregular-repeat.ts` |
| the panel's „Segédvonalak” | the „Nézet” menu: Körrács and Illesztés on top, the numbers behind „Segédvonalak beállításai” |
| PNG and SVG in the file menu, „Kép és PDF” in the panel | „Exportálás…” in the file menu opens `#export-dialog`: picture options, PNG, SVG; print options, PDF; and the grid option from „Minta” |
| „Kép betöltése / eltávolítása” in the panel | „Háttérkép betöltése… / eltávolítása” in the file menu; the picture's own fields stay in the panel, shown only while there is a picture |

**Why the circular repeat went.** The owner: „gyakorlati értelme nincs. ha
valaki másolni szeretne körben - ott már a szemek száma nem fog stimmelni.” A
round has more stitches than the one before it, so a motif copied around the
centre never has the right count. See `owner-decisions.md`.

**Why the icons looked highlighted.** Nothing highlighted them. The arc's three
tiny chain ovals and the fan's five rays met in a few pixels and printed as a
dark blob next to the outline icons. The new ones have fewer, longer strokes.
The only real emphasis is `aria-pressed`; a menu of tools shows it with
`.is-armed` while one of its tools is armed, and „Terület” is no longer pressed
at the same time as an armed annotation tool.

**„Nézet” is a menu in every width** and carries a caret, as „Fájl” and
„Jelölések” do. The caret sits in the button's corner, not in the label, so it
survives the step that drops the labels; that step also leaves the labels of
menu items alone. The regular type shares the menu, so its zoom buttons are one
click further than before — the wheel still zooms.

**The moved controls are found in the page, not the section.**
`IrregularPanel` reads the guides, the export options and the annotation
commands from `section.ownerDocument`, because they no longer live inside
`#section-irregular`. `showIrregularView` hides the free-form-only parts of the
menus and of the dialog in the other types.

**What the tests pin.** The specs open `#view-toggle`, `#notes-toggle` or
`#export-open` before the control they drive; `e2e/egysoros-sav.spec.ts` pins
the menu at 1920 px and `data-fit` 2 at the owner's size.

## §58 The selection block says what it is for

PQW-1009, the second step of the free-form redesign. The owner could not tell
what „Tulajdonságok” did or why it was there.

- **It is called „Kijelölés”**, and with nothing selected it shows one line
  saying so: select stitches and set their place, size and colour here.
- **Place and size are a two-by-two grid; rotation and colour share a row.**
  „Alapszín” sits next to the colour it resets.
- **Flip, align and spread are icon buttons** (`.ib`, 44 px, §36) with the bar's
  tooltip bubble; the panel runs `alignTooltips` too, so a bubble near the right
  edge does not hang off it. Their names are the old button labels, now the
  accessible name and the tip.
- **The rectangle mode left the panel** for a caret button beside „Terület”
  (`#select-mode-toggle`, free-form only). It is how the marquee behaves, so it
  belongs to the marquee tool; in the panel it was the only thing visible with
  nothing selected, which made the empty block look like a settings page.
  `IrregularPanel` finds `#prop-rect-mode` in the page, like the moved controls
  of §57.
- **The caret is 28 px wide, not 44.** It is the one exception to §36: at 44 px the
  free-form bar no longer fits 1440 px with labels. It stays above WCAG 2.5.8's
  24 px and has its own gap. „Terület” sits outside the caret's `.menu`, because
  a click inside a `.menu` does not close the other menus.

What the tests pin: `e2e/szabalytalan.spec.ts` (PQW-1009) — the empty line, the
caret menu, the mode surviving a reload, and the caret hidden in the regular type.

## §59 Rows, layers and key behind tabs, as compact lists

*The fade and order switches, and the order buttons, went in PQW-1015 (§63).*

*The key tab went in PQW-1013 (§62); two tabs remain.*

PQW-1010, the third step of the free-form redesign. The owner asked for layers
and rows „hasonló felépítésben, mint a photoshop esetén … csak persze
kompaktabb formában”.

**Three tabs, one place.** `#irregular-tabs` (`#tab-rows`, `#tab-layers`,
`#tab-key`, pressed buttons rather than an ARIA tab widget, so no arrow-key
contract) sits under the selection block. The three sections keep their
`<details>` and ids; in the tab row their `summary` is hidden and the section not
picked gets `.is-off`. `wireTabs` (`irregular-tabs.ts`) owns that, and nothing is
stored: the tab starts on „Sorok” every time.

**A list entry is one 44 px line:** eye (shown), lock (locked), then the pick
button with the colour, the name, the direction arrow and the count. Pressed
means shown or locked; the off state is faded, not a different glyph. The active
entry has the selection background. The per-entry ↑/↓ buttons went to the
footer, where they move the active row or layer: at three 44 px buttons per
entry the name had no room.

**The footer** holds what is used all the time — new row, new round (new layer
and „kijelöltek ide” on the layers tab), up, down — and „⋯” (`#rows-more-toggle`)
opens `#rows-more` in place with the rest: insert after, select the row, move
the selection here, both deletes, spacing and alignment. It opens in place, not
as a popover, because the panel scrolls and a popover would be cut by it.

**The active row's settings** (kind, direction, colour) and the active layer's
name (`#layer-name`) sit under the footer, always visible. The layer name used
to be a text field in every entry.

**The background picture is the bottom row of the layers tab** (`#layer-bg`,
outside `#layers-list`, so the list still counts only real layers). It is not a
pattern layer: picking it is panel state (`#backgroundPicked`), and it swaps the
layer-name editor for the picture's own block (`#props-background`, moved here
from the selection block): load, or opacity, size, rotation, export and remove.
Its eye and lock patch the picture; they are disabled while there is none. The
old „Látszik” and „Zárolva” checkboxes went, the eye and lock replace them.

**„A többi sor halványítása” and „Szemsorrend mutatása”** are view switches, so
they moved to the „Nézet” menu (`#view-work`, free-form only). The order buttons
for one selected stitch stay under the rows list, next to the row they reorder.

What the tests pin: `e2e/szabalytalan.spec.ts` (PQW-1010) — one list at a time,
the footer moving the active row, the „⋯” box, the background row swapping the
editor, renaming, and the view switches present only in this type.

## §60 The pattern settings leave the free-form panel

PQW-1011, the last step of the free-form redesign. With „Kijelölés” and the
three tabs in place, the panel still ended in „Jelölés és jelek” and „Minta” —
language, notation, the pattern name and the key list — which the owner filed
under „a többi rész is érthetetlen”: settings made once, sitting among the
tools used all the time.

**In the free-form type they live in a dialog**, „Fájl → Minta beállításai…”
(`#settings-open`, `#settings-dialog`). **The regular type is unchanged**: the
two sections are shared nodes, so `placeSharedSections` moves them into the
dialog when the free-form view opens and back before `[data-consent-open]` when
it closes, remembering how they were folded. Moving the nodes keeps every
listener, which is why this is a move and not a copy. The sections stay
foldable in the dialog, open when they arrive.

The class is `settings-dialog`, not `settings`: `.settings` is the notation
block's own grid, and on the dialog it displayed the closed dialog and grew the
page past the window — `e2e/elrendezes.spec.ts` caught it.

What the tests pin: `e2e/szabalytalan.spec.ts` (PQW-1011) — hidden from the
free-form panel, editable in the dialog, focus back on „Fájl”, and back in the
regular panel folded as before. `e2e/szabalytalan-vezerlok.spec.ts` opens the
dialog before it reaches the notation in free-form mode.

## §61 No new row after an empty one; the row trash is in the footer

PQW-1012. The owner: „tudok úgy új sort létrehozni, hogy az előzőben 0 szem van
… de törölni nem tudok sort.”

- **No new row opens after an empty one.** „Új sor” and „Új kör” add at the end,
  so they are disabled while the **last** row has no stitches; „Beszúrás az aktív
  után” adds after the active row, so it looks at **that** one. A row without
  stitches is not a row yet; letting another open after it only piles up empty
  rows. The empty row's kind and direction can still be changed. (The first
  version looked at the active row for all three; /code-review caught that
  picking a filled row still let empty rows pile up at the end.)
- **Deleting was there, but behind „⋯”.** The trash (`#row-delete`, the row with
  its stitches, one undo step) now sits in the footer beside up and down, as it
  does on the layers tab. The gentler „Törlés, szemek az előző sorba” stays
  behind „⋯”.

## §62 The stitch key has no interface

PQW-1013. The owner: „a jelkulcsnak semmi értelme, töröld az egészet”.

Gone: the „Jelkulcs” tab and its panel (`irregular-key-panel.ts`) — per-stitch
symbol, abbreviation and legend-text overrides, „Saját szem”, „Visszaállítás az
előbeállításra” — and the legend on the image, from the canvas, the PNG and the
SVG, with the core functions only they used (`updateKeyEntry`,
`addCustomEntry`, `removeCustomEntry`, `resetToPreset`, `hasOverrides`,
`entryLabel`, `entryAbbreviation`).

**What stays, because it is the pattern's data, not a feature:** every stitch
points at its key entry (`keyEntryId`), which is how the program knows what the
stitch is. The file format keeps `stitchKey` and `legend`, so an older file
still loads, a stitch of her own in it still draws with its symbol, and an
override still applies. The ambiguity check of §41 stays for the same reason:
such a file can still draw two stitches with one symbol.

## §63 „Méretezés” and „Segédrács”; one guide size; less to switch

PQW-1015. The owner, on v0.61.0: „a nézetet nevezzük át segédrácsnak”, „a
kiemelésből vegyük külön a nagyítás/kicsinyítés/teljes méret részeket -
méretezés menüpont alá”, „a rács négyzetei aránytalanul kisebbek, mint a
körrácsé”, „a kiemelés funkció nem működik … töröljük”, „tobbi sor halványítása
és szemsorrend kijelölése teljesen felesleges”, „körrácsnál a kezdőszögnek semmi
értelme”, and that an empty first row showed before a single stitch.

- **Two menus instead of „Nézet”.** „Méretezés” (`#zoom-toggle`, `#zoom-pop`)
  holds zoom in, zoom out and the whole pattern, and stays open between steps
  like §57's menu did. „Segédrács” (still `#view-toggle`) holds the grid, and in
  the free-form type the circle guide, snapping and the guide settings. Both
  types share them.
- **The square grid and the circle guide can show together.** The first reading
  of the report made them alternatives; the owner took that back the same day
  („van annak értelme hogy a körrács és a rács is egyformán legyen aktív”).
- **One size for both** — „Rácsméret”, the square's side and the ring step.
  `#setGuideSize` writes both in one undo step, a circle guide switched on takes
  the grid's size, and the default is 40, the row spacing (it was 20 against a
  40 ring step, which is what looked disproportionate). A file from before
  keeps two sizes; `oneGuideSize` makes the grid take the ring step when it
  loads. The two ranges differ (grid 2–200, ring step 4–400), so `guideSize`
  rounds the one number and keeps it in 4–200, which both accept — otherwise a
  2 would be stored as 2 and 4 and part again on the next load (/code-review).
  The separate ring-spacing field and the start angle left the settings; an
  older file's start angle goes back to 0 on load, since nothing could reset it.
- **Removed:** isolating (§45), fading the other rows, the stitch-order overlay
  and its buttons (earlier, later, automatic, place in the row). The order data
  stays in the file; nothing edits it by hand any more.
- **No row before the first stitch.** While the pattern is one row with no items
  the rows tab shows `#rows-empty` in place of `#rows-body`; the row is still in
  the model, since every item needs one to go into.

## §64 One layer, an edit block only for a selection, and a selection you can hold anywhere

PQW-1022. The owner: „legyen egy [réteg], és az "réteg" néven fusson”, „a
kijelölésnek semmi értelme úgy, hogy nincs semmi kijelölve”, a fan „nem tudom
odébbvinni … ha nem pont a vonalra kattintok”, „az a pont nem fordul vele
együtt”, and a pointer next to „Terület” for Ctrl/⌘-click selection.

- **One starting layer, „Réteg”.** `emptyIrregularPattern` takes any number of
  names now; the editor passes one. A pattern that still has exactly the two
  old starting layers („Mintarajz” and „Feliratok”, or „Chart” and „Labels”),
  both shown and unlocked, becomes one layer on load or import
  (`oneStartingLayer`), groups included, or a saved file would name a layer that
  is gone; layers she named or changed are left alone.
- **„Kijelölt módosítása”** is the old selection block (§58), renamed, moved
  under the rows and layers tabs, and hidden (`.is-off`) while nothing is
  selected. Arranging a whole row therefore starts from selecting it; with the
  whole row selected it still remembers the shape (§46).
- **The frame is the handle.** A press inside the selection frame that hits no
  item moves the whole selection — checked before the tracing photo and the
  circle guide's knob, which lie behind it (/code-review). A still click on one of several selected
  items narrows the selection to it (with its group); a drag moves them all.
- **The free-form board's frame (PQW-1148).** The free-form board (PQW-1143)
  has no layers, groups or guides, but keeps this rule and takes it further:
  without Shift/Ctrl/⌘, any press inside the frame, on empty ground or on a
  stitch that is *not* selected, moves the selection and leaves it unchanged.
  The owner: „amíg a kiválasztás él, csak az eredetileg kiválasztott szemek
  mozgathatóak”. So a click inside the frame neither clears the selection nor
  takes the stitch under it. A click outside the frame (or Escape) clears it,
  and a new area takes every stitch in it. With a modifier held, the press
  toggles a stitch or draws an area, as before, and the cursor says so.
- **The frame turns with the drawing.** While the rotate knob is dragged the
  board draws the frame it started from, turned by the same angle
  (`setSelectionTurn`); on release it is the upright box of the result again.
- **„Kijelölés” (pointer) beside „Terület”.** Click takes one item, Ctrl/⌘ or
  Shift + click adds or removes one, and a drag on empty ground draws no
  rectangle. „Terület” keeps the rectangle. Both lay a drawing tool down. The
  pointer is the default; either one's frame resizes at its corners.

## §65 The regular type lists its subcategories in the type menu (withdrawn)

Withdrawn in PQW-1038: replaced by the side menu of §66.

PQW-1037. The owner could not find the granny square: the motifs sit in the
„Kör és motívum” section of the make-a-pattern sheet, which opens from the file
menu, and only in the regular type. Three hops, none of them labelled with what
the user was looking for. The owner's verdict: „egy cseppet sem intuitív”.

A „>” button (`.type__more`, „Alkategóriák”) sits beside the „Szabályos
horgolás” card and folds a list open below it: Forma, Kendő, Ruhadarab, Kör és
motívum — the sheet's sections, under their own titles, so no new names. A
choice switches to the regular type, opens the sheet, opens that section and
closes the other sheet sections, then scrolls to it and focuses its summary.

The toggle's name must not contain „Szabályos horgolás”: the specs find the card
with `getByRole('button', { name: /Szabályos horgolás/ })`, and a second match
would fail them in strict mode. The fold state lives only for the page's life;
it is not worth a storage key. The owner first asked for a separate top-bar menu
that appears only in the regular type, then withdrew it for this submenu.

## §66 The regular type's side menu

PQW-1038, replacing §65. A standard cascading menu: the „›” sits inside the
„Szabályos horgolás” card, and `#types-regular-menu` (`role="menu"`) opens beside
the type menu on hover, on a click on the card or the „›”, or with the right arrow
on the card. Up and down move, left and Escape close it and give the focus back to
the card.

**The card does not start a pattern (PQW-1126).** It used to: a click on it ran
`startType('regular')`, so the owner got the default shape without having chosen
one — „I can click on the regular crochet without choosing the type. that's not
good.” The card is the menu's opener now (`aria-haspopup="menu"`,
its own `aria-expanded`), and only an entry of the menu starts anything. It opens
rather than toggles: hovering the card has already opened the menu, so a toggle
would close what the click was aiming at.

Every spec that starts a regular pattern therefore goes through the menu — the
card, then „Rectangular”, then `[data-action="close-setup"]` to put back the sheet
the choice opens.

The menu is `position: fixed`, placed from the card's rectangle, because
`.menu__pop` scrolls (`overflow-y: auto`) and would clip anything absolute inside
it. Where there is no room beside the type menu — a phone — it opens below the
card instead. Leaving the card closes it after 300 ms, so the pointer can cross
the gap to it.

The entries were the owner's four, in the owner's words (`owner-decisions.md` §15).
PQW-1128 dropped the flat triangles from the Shape generator, so „Triangle” went
with them and three are left. The second line of each names the generator it
opens, from the existing dictionary — „Forma: Téglalap”, „Kendő: Félkör”,
„Kör és motívum” — so nothing is invented. A choice opens the sheet on
that section, sets its shape select and fires `change` so the panel redraws, and
focuses the select.

## §67 The granny square is drawn on choice, and shows only its own fields (partly withdrawn)

The drawing on choice is withdrawn in PQW-1040: see §68. Hiding the fields that do
not apply stays.

PQW-1039. The owner chose the granny square from the §66 menu and got a form:
„fogalmam nincs, hogy mi ez, és mit kellene vele csinálni”. Nothing was on the
canvas, „Minta létrehozása” sat below the fold, and half the fields were greyed
out because they do not apply to a granny square.

**Drawn at once.** The „Nagymama-négyzet” entry of the side menu clicks
`#rounds-create` after setting the shape, so the square (6 rounds, magic ring by
default) is on the canvas straight away and the form is there to change it. Only
this entry does so; the owner asked for it on the granny square alone. Undo brings
back the earlier pattern, as with any generator.

**Its own fields only.** With the granny square selected, `RoundsPanel` hides
„Szem”, „Kör vége” with its note, „Eltolt szaporítás” and „Lépcsőjavítás
spirálban” instead of disabling them. Left: „Kezdés”, „Körök száma”,
„Színváltás” and „Bordás perem”. The other shapes keep the §9-era behaviour, a
disabled field where it does not apply.

## §68 The granny square designer (superseded in part by §71)

PQW-1040, replacing the drawing on choice of §67. The owner, on v0.66.0: „SENKI
NEM KÉRT TÖLED EGY MÁR KÉSZ TERVET … EGY KIBASZOTT GRANNY SUQARE-T AKAROK
TERVEZNI”. What was wanted is a blank canvas where the crocheter gives each
round's stitch count: „a felhasználó beírja, hogy 8 szem. ezek körbe
elrendeződnek. Megnyomja az új kört … tudja megadni, hogy hány szem megy a
második körbe”.

- **Where.** On the free-form canvas, so saving, undo, export and editing single
  stitches all come from code that exists. „Szabályos horgolás › Nagymama-négyzet”
  switches to the free-form type and calls `newGranny()`. That is a commit, not a
  new history, so undo brings back the work it replaced. The pattern carries
  `motif: 'granny-square'`, and its first row is a clockwise round. The square grid
  stays off: the background is the round bands of §69.
- **The panel.** `#section-granny` replaces the rows and layers tabs while
  `grannyMode` holds (`syncGrannyView` in `main.ts`, run from `refreshControls`).
  One line per round: its name, its count as a field you can change, and its
  stitch abbreviation. Below: the count for the next round (Enter works),
  „Új kör” and „Utolsó kör törlése”. A hint shows until the first round.
- **The stitch** of a new round is the one armed on the palette. There is no
  default: see §70. Chains in the corners are placed by hand with the free-form
  tools.
- **Defaults taken without the owner's answer:** the first round is a square too,
  the stitches spread evenly with no marked corner spaces, and a round is one
  kind of stitch. The owner said „jó lesz, próbáld meg megcsinálni” to the plan
  that listed these as open questions.

The geometry is `core-geometry.md` §55.

## §69 The granny square draws the round bands, not the square grid

PQW-1041, correcting §68. „Az alaprajz nem rossz” meant the round generator's
background, and PQW-1040 read it as the layout and switched the square grid on.
`newGranny()` leaves the grid off. The editor passes `granny` bands to the board
(`#grannyBands`), which fills them in alternating tones right above the tracing
photo and below the stitches, strokes the cell dividers in `--c-grid` and each
band's outline in `--c-grid-row`. The bands are canvas-only. They are not in the
PNG, SVG or PDF export yet. Geometry: `core-geometry.md` §56.

## §70 The palette decides the round's stitch, and the turn can be switched off

PQW-1042. The owner, on v0.68.0: „alapértelmezetten erp-t tesz a »körbe«. miért?
és ha én mást akarok? a felhasználó kell eldöntse, hogy mit tesz”, and „a
sugárirányú fordítást tudja kikapcsolni ha kell”.

**No default stitch.** `GRANNY_STITCH` is gone. `addGrannyRound` returns without
doing anything while nothing is armed, „Új kör” is disabled, and `#granny-stitch`
says either which stitch the round will be made of or to pick one. Arming a
stitch already refreshes the editor, so the panel follows the palette by itself.
The owner chose the palette over a chooser of its own in the panel: one place to
pick a stitch, not two.

**The turn is a switch.** „Sugárirányú fordítás” (`#granny-radial`), on to begin
with, as the owner asked. Off leaves every stitch upright, and only the rotation
changes: the places, the ids and the selection stay. It turns the whole square,
not one round, because a granny square is read as one. Unlike the circle guide's
`radial`, which only steers stitches as they are dropped (§63), this one re-lays
out what is already there.

**Where it is kept.** On each round in the file (`radial`), so another browser
draws the square the same way; a round from before PQW-1042 reads as facing out.
The editor also keeps the last choice in its preferences, which is what a new
round takes.

## §71 The designer gives the grid; the crocheter fills it in

PQW-1043. v0.69.0 still drew the stitches. The owner: „a sablon már jó, de NEM TE
TÖLTÖD KI ELŐRE, hanem a felhasználó. te csak a rácsot adod. az jó. de a
felhasználó mondja meg a szemek számát … a felhasználó ez alapján teszi oda a
szemeket.”

**A round is a ring of cells, not a run of stitches.** The generator is gone. A
round is a row carrying `cells`, its grid count; the band behind it is cut into
that many cells (`core-geometry.md` §55). „Új kör” adds an empty ring that starts
from the count of the one before it. A granny round is empty by design, so it
does not raise the empty-row finding and does not block „Új kör”.

**A stitch belongs to the round it lands in.** `#place` files it under that
round, not merely the active one, so working into an inner round later still
files the stitch correctly. The turn of §70 decides how a dropped stitch faces,
and it no longer moves stitches that are already down. Where exactly a stitch
goes, and how the turn is worked out, is §72.

**The panel is the rows panel.** The owner: „legyen olyan, mint a sortervező …
ugyanaz legyen a felhasználói felület, csak az aktív fajtája dropdownnak és az
iránynak semmi értelme. helyette maradjon a szemek száma az adott sorban és
lehessen módosítani. ne szemek számának nevezzük, hanem rács szám.” So
`#section-irregular-rows` itself serves the granny square, without the tabs and
the layers: the same list, the same toolbar, the same more-menu. Hidden in granny
mode: „Az aktív fajtája”, „Irány”, the direction arrow in the list, „Új sor” and
„Sorok egymáshoz”. In their place: „Rács szám” for the active round, and the turn.
A round's line reads `stitches/cells`, so how full it is shows at a glance. The
title of the section becomes „Körök”. The separate rounds panel of §68 is gone.

**A file from v0.67–v0.69** is converted as it is read (`grannyGridRounds`): each
round takes its group's count as its grid count, the pattern takes the turn, and
the generated stitches are let go to stand on their own. Nothing is lost, and
nothing writes a `grannyRound` group again.

## §72 The crocheter places freely, and the turn is the circle guide's

PQW-1044, correcting §71 on three counts.

**No snapping to a cell.** The grid says where the cells are; it does not decide
where a stitch goes. „a felhasználó a soron belül oda teszi le ahova akarja - a
sugárfordítást meg kell tartani.” `#snap` has no granny branch any more, so a
stitch lands exactly where it was dropped. Which round it joins comes from
`grannyRingAt`, the band the point falls in — the bands are squares, so how far
out a point is, is its larger coordinate.

**The turn is `angleFromCenter`**, the circle guide's own (§63): away from the
middle of the square. §71 turned a stitch by the normal of the side its cell sat
on, which is right only where a cell happens to sit on a corner or the middle of
a side. „használd a körnél implementált sugárfordítást. az nagyon jól működött.”

**The grid count sits in the round's line**, as a counter beside „1. kör”, and
the properties block loses its „Rács szám” field: „a rács száma inkább a körökhöz
menjen mint számláló”. The name keeps its room and the stitch count gives way
instead, because the list is 285 px wide at its narrowest. „Új kör” is the one
button of the bar that carries its name („legyen kicsit nagyobb és legyen kiírva,
hogy mit csinál”); `.ib__label` shows only on `.ib.is-wide`.

## §73 „Új” is the type menu, and a granny round's line is rebalanced

PQW-1045.

**One move to a new pattern.** „ha a felhasználó új file-t akar nyitni, akkor 2
mozdulatot kell tegyen: új file és típusválasztás. ez hülyeség. az új legyen a
dropdown és a típusokat nyissa le.” So the separate „Típusok” button is gone:
`#types-toggle` is the „Új” button now, with the new-pattern icon, and picking a
type runs `startType` — the type is switched, then that type's own „new” empties
it. The owner chose this over keeping a second button for switching without
emptying.

Because the menu's intro says the work comes back, it has to: the free-form
`newPattern()` commits the empty pattern instead of starting a fresh history, so
undo restores what was there. The regular type's „new” already committed.
`data-action="new"` no longer exists; the browser tests start a pattern the way
the interface does.

**The round's line.** The owner: „a számok kilógnak és a felfele-lefele gomb csak
akkor látható ha fölé viszem az egeret”, and „egy kicsit több helyet kellene
hagyni a jobb oldaltól … a bal oldalon sok a hely, jobbra meg összezsúfolódik”.
The line is 267 px wide at the panel's own width, and it was 17 px short. Where
the room came from, without taking a target under 44 px (§36):

- the empty direction arrow is not built at all for a granny round (it has no
  direction, §71), which frees its gap as well;
- the eye and the lock keep their 44 px but overlap their neighbours by 3 px each
  (`margin-inline: -3px`), so only their boxes give way, not their targets;
- the counter is 3.25 rem, centred, and its stepper is always shown
  (`::-webkit-inner-spin-button { opacity: 1 }`) rather than appearing on hover.

Measured afterwards at the worst case — „24 szem” beside a grid count of 400 —
nothing clips, and the counter keeps 22 px from the panel edge.

## §74 The drawing tools join the palette, and the magic ring gets a symbol

PQW-1046.

**The chain arc and the fan left the toolbar.** The owner: „innen a felső menüből
az ív húzását és a legyező nyitását át tudnánk tenni a bal oldali menübe? … a
láncív és varázskör részlegnek nincs semmi értelme. tegyük át 4 elemet az
összetett szemekhez, és 3 legyen belőle: láncív (ez a régi ív húzása elem),
varázskör és legyező.” So „Összetett szemek” ends with Láncív, Varázskör and
Legyező. The two tools are tiles like any stitch — armed, pressed, and laid down
when a stitch is armed — but they draw instead of placing, and they are hidden
outside the free-form type, since that is where they work.

**The palette is no longer the library.** `offPalette` marks a section the
palette does not show as its own; `buildPalette` skips it and appends the magic
ring to the compound section. The library order itself is untouched on purpose:
the written pattern's stitch key follows it, and moving the ring there would have
reordered the key of every granny square (`core-pattern-text` fixtures). The
chain space has no tile at all any more, because the chain arc tool draws it.

**The magic ring is drawn, not merely circled.** „ez legyen a varázskör jele, ne
csak karika.” `magicRingShapes` draws the ring, the working loop inside it as an
arc open at the top right, and the tail leaving through that gap. The JIS „わ”
is untouched.

**The rectangle mode is one menu, not a chooser inside one.** „a terület mellett
nem látszik, hogy a lefele mutató nyíl az ahhoz a gombhoz tartozik, illetve
dropdownból van dropdown … egy dropdown legyen csak.” The caret now joins the
„Terület” button into one control (`.tools__split` shares their border and
highlights together), and the popover holds two `menuitemradio` buttons instead
of a `<select>`. Their labels and tooltips are static markup, so they read
correctly in the regular type too, where the free-form panel never runs.

Still open: a tooltip inside a menu popover is clipped by the popover's own
scrolling box, so it is cut off — the owner reported it and it wants a shared
tooltip element on the body, which is a change of its own.

## §75 The file menu leads with export, and the export window acts

PQW-1047. The owner: „a fájl menü: exportálás legyen az első … a következő
menüpont a json legyen, alkategóriával, ahogy a szabályos horgolásnál is
lenyílnak az elemek … a pdf-et vedd ki, a png vagy svg pedig választható legyen
egy dropdownból, png a default. x-el lehessen bezárni az ablakot, és a bezárás
gomb helyett exportálás legyen - ami a valós exportot megcsinálja.”

**The menu** reads: Exportálás, JSON ›, Háttérkép betöltése (and its removal),
Minta készítése. The JSON flyout (`#json-toggle`, `#json-pop`) opens beside its
item, the way the regular type's shapes do (§66); its click stops short of the
file menu, which would otherwise close underneath it.

**The window** holds one format chooser — PNG first, as asked — and shows the
PNG-only fields for that format. They stay out of the regular type, which has
never had a scale of its own: the switch reads `patternType`, not the editor's
`active`, because the editor mounts after the view changes. „Exportálás” runs the
export and closes; the × only closes. One button exports, so one button greys out
on an empty pattern.

**The PDF is gone**, from the interface and from the code, as the owner chose:
`pdf.ts`, its tests, the page size, orientation and page-grid fields, `savePdf`
on both hosts, and the strings. Two acceptance specs kept their subject and moved
it to SVG: AS-13 exports SVG and PNG, and AS-9 reads the row numbers out of the
SVG rather than the PDF.
## §76 The work-in-progress line

PQW-1051. The owner: „tegyél ki az oldalra, az app.dragonettre felülre egy
bannert, hogy work in progress - és hogy nézz vissza később, mert az oldal
folyamatos fejlesztés alatt van”.

One line above the menu bar, inside `.app` so it takes its height from the
layout and the canvas keeps the rest. It is a `<p>`, not a live region or an
alert: it says the same thing on every visit and must not interrupt a screen
reader at work. It is not dismissible, because the crocheter would lose it on
the next reload anyway and the note is meant to greet every visit.

## §77 The language and the symbol set move to the bar; the settings window goes

PQW-1048. The owner: „legyen egy nyelvválasztó a jobb felső sarokban - dropdown,
zászlókkal és rövidítésekkel, pl HU vagy EN, valamint mellette egy jelkészletről
egy dropdown, hogy CYC és JIS”, and „a minta beállításait töröld”.

**Two pickers in the bar's corner.** `#ui-language` (🇭🇺 HU / 🇬🇧 EN) closes the
line, with `#chart-style` (CYC / JIS) beside it. They carry no visible label: the
name is on `aria-label`, and the tooltip repeats it.

**Where they go when the bar is full.** At 1000 px the two pickers cost 110 px and
the bar cannot hold them beside the title, so `placePickers` moves the pair into
the file menu, and the bar stays one line (§56). One node is moved, never
duplicated, the way the notation sections used to move into the settings dialog.
`fitBar` puts them back first, so their room is measured rather than guessed.

**What was deleted with the settings window**, at the owner's choice: the preset
(CYC / Japanese), the terminology (hu / en-US / en-GB), the pattern name and the
key list, together with `#settings-dialog`, `#section-notation` and
`#section-pattern`. The cookie settings button stays.

**What that cost in tests.** The data behind the deleted controls is untouched, so
the browser tests set it where the app keeps it (`dc-mintatervezo:jeloles`) and
load the page again: the written pattern in three terminologies and the Japanese
counting rule are still covered end to end. Two tests were lost with their
subject: writing a pattern title by hand (no field any more) and changing the
preset from the free-form type (no chooser any more). `core-pattern-title` and
`tradition.ts` keep both rules under test in the core.

## §78 The generators offer only the shapes the owner named

PQW-1128, the owner's decision of 2026-10-02. The designer offered 21 generator
kinds; the owner named the ones worth keeping and asked for the rest to go, code
included:

| Generator | What is left |
|---|---|
| Forma (`FLAT_SHAPES`) | rectangle, trapezoid, rhombus |
| Kendő (`SHAWL_KINDS`) | triangle, asymmetric triangle, crescent, semicircle, circle, pi |
| Kör és motívum (`MOTIF_SHAPES`) | granny square |

Gone: the right and the isosceles triangle, the stole, the shifted pi, and the
circle, square, hexagon and octagon motifs. The triangles were **not** moved to the
Kendő — the shawl has triangles of its own, and the owner chose not to carry two
kinds of triangle.

**`round-generator.ts` and `ribbing.ts` stay, and so do their type unions.** Only
`MOTIF_SHAPES` — the list the interface offers — shrank. The shawl generator is
built on `circlePlan`, the Shape and the grid generators import `MOTIF_NAMES`, and
`allLocaleNames(MOTIF_NAMES)` is how a pattern saved before this prune is still
recognised as having a *generated* title rather than one the user typed. Shrinking
the union would have taken the shawl with it.

**What the removal took with it:**

- The right triangle was the only shape with an asymmetric edge, so `edgeChanges`
  and the one-edge branch of `generateShape` are gone. `shape-too-steep` was the
  code they returned; the guard in `generateShape` stays, but no size the user can
  ask for reaches it any more.
- The isosceles triangle owned the apex angle, so `shapeAngleNote` and
  `panels.shape.apexAngle` are gone. The angle measure itself stays — the trapezoid
  and the rhombus still use it.
- The stole was the only shawl worked as a flat rectangle, so `stolePlan`,
  `stoleShape` and the `length` field state are gone, and `piRounds` lost its
  `shifted` parameter with the shifted pi.

Old saves made with any of these no longer load. The owner accepted that: the
designer is pre-release and says so in its own banner.

## §79 One way into the generators: a family from „Új”, and the sheet shows only it

PQW-1129, the owner's decision of 2026-10-02. Two complaints, one cause.

**The choice did not mean anything.** The side menu's „Négyszögletes” only preset
`#shape-kind`; the select still offered every flat shape, so after choosing a
rectangle the sheet invited the user to choose a triangle. „after selecting the
regular crochet type, at the make pattern the user can choose again. and this is
redundant.”

**The sheet on its own said nothing.** Opened from its toolbar button it showed
four collapsed section titles and a promise, with no indication of what it did:
„this make a pattern does not make sense at all.”

**The entries are families now, not shapes.** „Forma”, „Kendő” and
„Nagymama-négyzet”. The second line lists that family's kinds, built from
`FLAT_SHAPES` and `SHAWL_KINDS` rather than written out, so a kind added or
dropped in the core shows up in the menu without a dictionary change. No entry
presets a kind any more: the family is the choice, and the kind is made inside
the section.

**The sheet shows the chosen family and nothing else.** `openRegularEntry` sets
`hidden` on every other section of the sheet, not just `open = false`. A collapsed
„Kendő” under an open „Forma” is still an invitation to contradict the choice that
opened it.

**The toolbar button is gone**, and with it `#setup-toggle`, `setupToggle` and
`toolSetupTip`. It was the only way to reach the sheet without choosing a family,
so it was the only way to reach the state the owner called senseless. The sheet is
reachable from „Új” alone, always scoped. §54 argued the opener belonged in a menu
rather than the bar for want of space; this goes further and gives it no button at
all.

`setOpen` needed a button to carry `aria-expanded`, so the sheet gets
`setSetupOpen` instead. Closing it — its own „Lecsukás” or Escape — now returns
the focus to `#types-toggle`, the menu that opened it, rather than to
`#file-toggle`, which has not opened it since §73.

**The granny square is still the odd one out, deliberately.** It does not generate:
it switches to the free-form editor with the round guide (§68, §71). The owner
confirmed that stays.

**„Kör és motívum” left the sheet, and that follows from the two decisions above.**
PQW-1128 reduced `MOTIF_SHAPES` to the granny square alone, and the granny square is
made on the free-form canvas, not by that generator. So the section had one kind, and
its one kind had another home: with three families in the menu and the sheet scoped to
whichever is chosen, nothing could open it. Dead interface is what §9 and PQW-960 exist
to prevent, so `#section-rounds`, `rounds-panel.ts`, `rounds-view.ts` and the 17 markup
keys are gone.

`generateMotif` itself **stays in the core.** It is what six test files build their
round, layout, grid, ribbing, validation and row-curve fixtures with, and it is the
only generator that produces a closed round for them. It has no caller in `src/ui/`
any more; `Choice`, which `rounds-view.ts` exported, has a second definition in
`shapes-view.ts` that the amigurumi views now use.

## §80 The editor is closed until there is a pattern

PQW-1133, the owner's decision of 2026-10-02: *„addig amíg nem választom ki a
minta típusát, addig ne tudjak szemeket letenni… a mintatervezőhöz érkezve az
első dolog az új minta létrehozása.”*

§73 made „Új” the type menu so that starting a pattern is one move. It did not
make it a *required* move: the app opened on an empty regular pattern that was
fully editable, so the type menu was something a visitor could simply never
find. The first stitch then landed in a pattern whose type nobody had chosen.

**The gate is „is there a pattern”, not „is this a new tab”.** A visitor who has
work to come back to is not sent through „Új” again, so `readStarted` answers yes
when any of three marks is there: a stored type, a stored free-form pattern, or a
restored regular pattern with a stitch in it. The third mark exists because a
pattern can arrive from a JSON file that never wrote a type — which is also why
opening a JSON is the second way in, beside choosing a type.

**The stored type is the type of the pattern, so it is written when one is made**
(PQW-1137). It used to be written by the choice itself, and that is what made the
first mark a lie: after „Új → Forma” the key was there with nothing behind it, so
a reload opened the editor on an empty canvas — the very state §80 exists to
prevent. `persistType` therefore writes it only while the gate is open, and
`setStarted(true)` writes it as it opens. No new key, so §5 is untouched.

**It closes again, because making the next pattern is not having one** (PQW-1137).
The owner, with the editor live behind the open chooser: „a bal oldali panel él
akkor, ha már előtte volt egy minta tervezve. ez így nem jó.” So `markStarted`
became `setStarted`, and choosing a family in the type menu closes the gate until
„Minta létrehozása” opens it. This is not the program asking twice
(`owner-decisions.md` §3): it asks nothing, it only waits for the pattern the
visitor has already started making.

**Choosing a family no longer empties the pattern; creating one replaces it**
(PQW-1137, the owner's decision). `openRegularEntry` used to run `startType`,
which emptied the pattern before the sheet was even read, so stepping back out of
the sheet cost the work and „Lecsukás” had to be paid for with an undo.

**What the sheet gives back is the type *and* the gate, and only „Lecsukás” gives
anything back** (PQW-1139, from the review of PQW-1137). `openRegularEntry`
records both — `typeBeforeSetup`, `startedBeforeSetup` — before it switches
anything, and `dismissSetup` restores both. Three things forced that shape:

- **The free-form pattern is not in `history`.** It lives in the editor's own
  state and its own key, so a flag computed from `isEmptyPattern(history.present)`
  reads a visitor arriving from the granny-square canvas as having nothing. They
  then got the gate closed over a pattern that was off screen, and the only route
  offered — „Új” → „Szabadkézi tervező” — empties it.
- **The gate has to close before the type switches.** `persistType` writes the
  stored type while the gate is open, so switching first wrote `regular` for a
  family that was only looked at, and the next load opened the editor on an empty
  regular canvas — the state this section exists to prevent.
- **Restoring is for the way out, not for every close.** Switching back to the
  free-form type closes the sheet itself (`showIrregularView`), so a restoring
  close called from there came straight back into itself. The ways that
  *supersede* the sheet — another type, a file, an armed stitch — close it with
  `setSetupOpen(false)` and carry their own state; `patternMade` is where a new
  pattern, however it arrived, says that it is what the sheet would give back.

**The gate hides the written panel; it does not forget it** (PQW-1139). Closing
it with `setWrittenOpen` persisted `zarva`, so one trip through „Új” threw away a
visitor's stored „nyitva” for good. `setOpen(written, writtenToggle, false)` is
the form every other programmatic close in the file uses, for exactly this reason
(§10).

**The regular type is always generated; the free-form type is the hand-drawn one.**
That follows from the paragraph above, and the owner confirmed it: „új —
free form designer — és szabadot nyit meg, nincs popup. új — regular crochet és
kiválasztja a megfelelőt — popup.” An empty regular canvas is no longer a place
the interface can take you, so `ACTIONS['new']` has only the free-form caller left
(`startType`), and that one opens the gate before it runs, because `new` commits.

**Where the gate bites.** The buttons are disabled, and behind them three guards
catch the paths a disabled button does not cover:

- `commit` refuses while closed. Every edit of the regular pattern goes through
  it, including the ones the keyboard reaches directly — `Alt+F`, `Alt+K`,
  `Delete`, `Enter` — so one `return` closes them all.
- `select` refuses a stitch, so `Alt+1`…`Alt+9` arms nothing. Clearing one
  (`select(null)`) stays allowed: the startup path calls it.
- the canvas `pointerdown` and the document `keydown` return early. The keyboard
  guard sits *after* the Escape-closes-a-menu block, because the type menu is the
  one menu that is open while the editor is closed. The sheet's own Escape had to
  move up there with it (PQW-1137): the sheet is now open *while* the gate is
  closed, and from below the guard its Escape never ran. `Alt+R` passes it: the
  guide grid is a view control whose button stays enabled, so the shortcut has to
  match the button. It is the only exception, and the only view control with a
  shortcut.

The free-form editor needs no guard of its own: it is mounted by `selectType`,
which has opened the gate before it runs.

**The view controls stay live** — zoom, the guide grid, the panels, the language
and the symbol set. They decide what is shown, and showing nothing is not an
edit.

**„Méret és fonal” does not, and that follows from the guard rather than from the
decision.** Gauge, yarn and hook are the *pattern's* settings and `SizePanel`
writes every one of them through `commit`, which now refuses — so leaving the
section live would have made it a panel that accepts input and drops it, with
„Valódi arányok” still working because that one goes through `setAspect`. A half-live
panel is worse than a closed one, so `#section-size` is `inert` until the gate
opens. The written-pattern panel is closed for the plainer reason that an empty
written pattern is a panel with nothing in it.

**The stage says so.** `#start-note` is a centred line and one button over the
empty canvas; the button clicks `#types-toggle`, so there is still exactly one
way to start a pattern. It clears the open side bars the way the alert above it
does (§15), and it is `hidden` the moment the gate opens.

**Only its button takes the pointer.** The box is `pointer-events: none` and the
button `auto`. `--side-start` and `--side-end` are only given the column widths
above 48 rem, so below that the note spans the whole stage: without this, opening
the side columns with `#panel-toggle` — which the gate leaves enabled — would
show two columns that no tap could reach.

**The chosen card is marked in one place.** `markChosenType` writes `aria-pressed`
for both ways in, because opening a JSON starts a pattern without going through
`selectType`, and the cards would otherwise say no type was chosen. Before the
first pattern none is pressed, so the type menu focuses the first card that can
be chosen rather than nothing.

**The regular card is never marked** (PQW-1137). The owner on the menu opening
with „Szabályos horgolás” already filled in: it „looks selected, though I have not
chosen anything on it”. Since §66 the card is a menu opener — `aria-haspopup`,
its own `aria-expanded` — and the choice is an entry inside the menu, so
`aria-pressed` on it marked something the visitor had not done. A button cannot
honestly be both a menu opener and a toggle, and `.type[aria-pressed="true"]`
gives it the selection background that caused the complaint. The other cards keep
the mark: there the card *is* the choice.

**The start note and the sheet are two answers to the same question**, so the note
is hidden while the sheet is open (PQW-1137). Without it, closing the gate on a
family choice put „Pick a type to start an empty pattern” over the canvas beside
the sheet that had just been opened to do exactly that. `setSetupOpen` therefore
runs `applyStartGate`, which is the one place that decides what the stage shows.

**The browser suite opens as a returning visitor.** A spec that measures the
editor seeds the stored type in an init script (`e2e/kezdet.ts`) rather than
clicking its way through the type menu first: the specs are about the editor, and
the arrival itself has its own spec. `kezdet.ts` is not a `*.spec.ts`, so
Playwright's default `testMatch` leaves it alone.

## §81 The chain count stands at the head of the right panel, and starts at one

PQW-1135, the owner's report: *„amikor kiválasztok egy láncszemet, akkor van
arra lehetőség, hogy láncszemsort tegyek le, pl 12 szemet. viszont a szemhez
tartozó szám az lenn van a szemkiválasztó panel alján.”*

§55 put `#count-field` under the palette, in the order of the task: pick the
stitch first, say where it goes second. §56 then moved the palette into a left
column of its own, and the order survived the move while the reason for it did
not. Measured at 1440 × 900 with the chain stitch armed:

| | |
|---|---|
| visible band of `#section-stitches` | y 236 – 900 |
| height of `#palette` | 904 px |
| `#count-field` | **y 1179** |

So the field stood 279 px below the fold of its own column. Arming the chain
stitch is the one action that needs it, and it answered by being out of sight.

**It leads `#panel` instead.** The right column is the one that is empty at the
top — „Méret és fonal” is a closed `<details>` — so the field lands at y 103 in
a panel that starts at y 85, whole and without a scroll at 1440 × 900 and at
1000 × 506 alike. It is still `hidden` unless the armed stitch is `chain` or
`space`, which is the rule it already had; `ch-sp` has no palette tile today, so
in practice the chain stitch is what brings it.

**The nudge box keeps its flush top.** `#adjust` was `.check:first-child` and is
not any more, and `[hidden]` does not change that — `:first-child` is structural.
`.panel > .count:first-child + .check` carries the same margin, so with the count
hidden „Méret és fonal” starts at the same y 103 the count would have had.

**Arming a stitch used to close the make-a-pattern sheet; PQW-1138 removed the
problem instead.** The sheet was `min(34rem, 92vw)` at `z-index: 7` against the
panel's `min(19rem, 80vw)` at 6, so it covered the panel whole (§54): „Új” →
„Lapos forma” left it open with the palette live, a count field at the head of
the panel un-hid behind it, `elementFromPoint` over the input answered with the
sheet's own `summary`, and Enter would have laid the new default of one chain
with no way to say otherwise. Found in review, not by a test. `select` therefore
closed the sheet, guarded by `id !== tool` so that the re-arming after a notation
or interface-language change (§6) did not take away a sheet opened after the
arming.

Both are gone with §82: the chooser is a modal window now, so while it is open
the palette is neither reachable nor live, and there is no stitch to arm behind
it. The spec that measured the field from under the open sheet went with them.

**The default is 1, not 12.** The owner asked for it in the same report:
*„alapértelmezetten 1 legyen, ne 12”*. Twelve was an arbitrary row width that
every one-chain user had to overwrite, and the field is in sight now, so there
is nothing to be saved by guessing one. `owner-decisions.md` §18 holds the
decision.

**That default was load-bearing in the browser suite, in two ways.**

- `elrendezes.spec.ts` armed the chain stitch and pressed Enter without setting
  a count, and got its twelve-chain foundation by accident, at both window
  sizes. It says 12 now, where it means ten stitches plus the skip of two. Three
  other specs lay a foundation the same way and do not care how long it is;
  `szabalytalan.spec.ts` was commenting on a chain of three while getting
  twenty-four, and gets two now.
- `rectangle()` in `meret.spec.ts` focused `#chain-count` *before* arming the
  chain stitch, so it typed into a `display: none` field: the keystrokes went
  nowhere and every rectangle it built was twelve chains wide whatever the
  caller asked for. Playwright's `focus()` does not demand a visible element the
  way `fill()` does, which is why nothing failed. The helper arms first and
  fills now, and a hidden field would fail the spec rather than be ignored.

**What the tests pin.** `e2e/elrendezes.spec.ts`: at both window sizes the field
is hidden until the chain stitch is armed, then stands whole inside an unscrolled
`#panel` above `#section-size`, its value is `1`, and arming a single crochet
takes it away again and gives the head back to „Méret és fonal”.

## §82 The chooser is a modal window, and the choice has to be made

PQW-1138, the owner's decision of 2026-10-02: *„ez a jobb oldali mintaválasztó
egy popup kellene legyen, amit muszáj kiválasszon a felhasználó… amikor rányom
arra, hogy új, akkor a jobb oldali shape meg egyéb választo popupként jelenjen
meg, nem jobb oldali menüként.”*

§54 put the generators in a sheet that stands where the panel stands. It was the
right move away from a 104-control panel, but it kept the shape of a side panel:
something beside the work, which the eye may pass over and the hand may close
without answering it. §80 and PQW-1137 then closed the editor behind it, and a
side panel in front of a dead editor says nothing about why the editor is dead.

**It is a `<dialog>` opened with `showModal`.** The browser gives what the
decision asks for: a backdrop over the whole page, the focus held inside, the
rest of the document inert, and Escape as a real way out rather than a key the
app has to catch. `#setup` keeps its class and its sections; what changes is the
element, `position: absolute` for `margin: auto`, and `::backdrop`.

**Two ways out, and both answer the question.** „Minta létrehozása” makes the
pattern and closes the window (§80 opens the editor on it); „Vissza” closes it
and reopens the type menu, where the visitor came from. Escape is „Vissza”: the
`cancel` event is taken and `setupBack` runs. The window cannot be left standing
over an editor nobody chose, and nothing leads from it sideways into the editor.

**The creation closes it, which reverses §54.** That section kept the sheet open
after a generation, because a shape is found by trying numbers and reopening the
sheet cost two clicks through the file menu. A modal window changes both halves:
numbers are tried against the preview and the size line *inside* the window,
since behind the backdrop there is nothing of the pattern to see, and it reopens
from „Új” in two clicks that are now the only way in anyway (§79). Leaving a
modal window standing over the pattern it has just made is the worse trade.

**The focus after a creation goes to the canvas.** A closing dialog gives the
focus back to what opened it, and that is a menu item inside a menu that has
closed — so it would fall to the body, and the keyboard would start the new
pattern with nothing selected.

**It takes no width from the stage.** `insetRight` measured whichever of the
panel and the sheet was open (§54); a modal window is above the stage, not beside
it, so it measures the panel alone. With it go `--side-end: var(--setup-width)`,
the 67 rem rule that let the sheet and the written panel take turns, and
`SETUP_TIGHT` — a window that covers everything has nothing to share.

**The button is „Vissza”, not „Lecsukás”.** It was `writtenClose` borrowed from
the written panel; a window with one way back deserves its own word, and
`setupBack` is that key in both languages. The `data-action` stays `close-setup`:
it still says what the action does, and renaming it would have moved a value in
`tests/fixtures/control-inventory.json`, which is frozen for content the owner
owns, not for a rename of mine (`frozen-paths.md`).

## §83 The right panel follows the selection, and arranges it

PQW-1146, reshaped in PQW-1147. `#inspector` is the free-form board's right
column, and what it shows depends on what is in focus. With nothing selected
and no basic stitch armed (§85) it is empty — the owner's choice over a hint or a
hidden column. With one or more
stitches selected it offers two arrangements side by side (`arrangeStitches`,
`core/freeform.ts`), both taking the stitches left to right:

- **In a row** („Sorba”): upright, foot to foot on one line, `gap` apart,
  centred where the selection was.
- **Around** („Ívbe”): the feet point at one shared point and each stands
  `radius` away from it, so the feet do not cover each other — the owner asked
  for that gap, against a fan whose feet all meet. `angle` is the spread from
  the first stitch to the last, and the result is centred where the selection
  was.

**Feet or tops towards the point** (PQW-1152). A toggle under the dial —
„A pont felé: Talp | Csúcs” — chooses which end faces the shared point. With the
tops facing it the stitches hang below the point, tops in and feet spread, as in
a cluster or a decrease worked together; `radius` then runs from the point to
each top, so stitches of mixed heights still meet. The owner first asked whether
a negative radius would do it; it was turned down because the right value is
`−(the stitch's height + the gap)`, which nobody can type, mixed heights would
not meet, and between 0 and minus a stitch's height the stitches cross the point
in an X. The toggle looks like one pill but is two buttons with `aria-pressed` in a
group named „A pont felé”. As a single switch, a press on the side already
lit flipped it to the other, and a screen reader never said „Talp”. A side is
lit only once its arrangement is taken. The tops layout is the feet one
mirrored top to bottom around the same middle, so it takes the same room on the
board.
At the default radius of 24 the wide top bars of neighbouring doubles touch with
the tops in; asked in PQW-1152, the owner chose one default for both ends
all the same.

**There is no circle.** PQW-1146 had „Körbe” beside „Legyezőbe”; the owner saw
they did the same thing with other angles, dropped the circle and renamed the
fan. So that around can still close a ring, the step between neighbours never
grows past `360° / n`: past `360° · (n − 1) / n` a larger angle gives the same
even circle, and at 359° the first and the last stitch do not land on each
other. The owner agreed to this.

**The settings appear only for the arrangement made**, under the two buttons,
and its button stays pressed. They go when the selected set changes — the board
reports every change of the set, not only of its size, for this — so a new
selection starts with the two buttons alone.

**The settings sit in a frame** whose small arrow on the top edge points at the
middle of the chosen button (PQW-1153), so the button and its settings read as
one thing. The owner chose this over a tab look, in which the pressed button
grows into the frame below it: that left an empty space under „Sorba”. It is a
look, not ARIA tabs — with `tablist` the arrow keys would re-arrange the stitches
at every step. The arrow is placed from `--arrange-gap`, the one variable the
button grid's gap also reads, and `--column`, the frame's button; the frame's
border is counted, so the arrow is on the button's middle to the pixel. The
frame has its own background, which the arrow's inner triangle repeats to hide
the border under it. In a window under 36rem tall the dial is 6rem instead of
7.75rem, so the frame of Around, switch included, fits 1000 × 506 without
scrolling; at that size the handle's 44 px reaches over the field in the middle,
so the handle is drawn above it and can be grabbed anywhere.

- Row: **Spacing**, a 1–10 slider with a field on its right, default 4 px.
- Around: **Radius**, a 1–150 slider with its field, default 24 px — the owner
  asked for a recommendation and accepted this: 24 is the look they approved in
  PQW-1146 (at 12, five half-doubles at 90° touched at the tops), and 150 leaves
  room for a full ring of many stitches. **Angle**, a dial of 0–359 with its
  field in the middle, default 90.

The slider moves the field; the field may go past the slider's maximum, and
the slider then stays at its end. The dial is dragged anywhere on its ring or
turned from its handle (`role="slider"`) with the arrow keys, Page Up/Down,
Home and End, and it wraps round past the top. Every field takes **digits
only** — `type="text"` with `inputmode="numeric"`, filtered on input, because
`type="number"` accepts `-`, `e` and `.`. An angle above 359 becomes 359; an
emptied field gets its last value back when it is left. The pure parts are in
`ui/number-input.ts`.

A changed setting re-arranges at once. While the chart is still, by identity,
the one the arrangement produced, it starts from the chart **before** it —
re-arranging an arranged fan from its own centroid drifted it downward with
every keystroke; matching the ids alone brought an old chart back after New, a
paste or a placed stitch reused them. A plain move of the arranged stitches
carries that earlier chart along by the same shift, so a setting changed after
the move neither jumps the stitches nor reorders them — starting from where they
stand would sort an arc wider than 180° by x and swap its two halves. A turn or a
resize ends the arrangement and hides its settings; the button makes a new one.
A typed value below the slider's minimum counts as the minimum, so a radius of 0
can never stack the feet. An angle of 0 does stack the stitches: that is the
range the owner set. An arrangement larger than the board is not taken, as a turn or a
resize is not (a stitch left off the board can no longer be moved); one that
only reaches past an edge is shifted back on. Below 40rem the column takes no
width and appears over the board only while it has something to show.

Keys typed in the panel's fields and on the dial's handle are theirs: Delete,
Backspace, Escape and the Ctrl/⌘ commands do not reach the chart. The arrange
buttons keep no keys, so after a click on one the chart's shortcuts still work. Before that, Backspace in the radius
deleted the selection.

The grid columns in the panel are `minmax(0, 1fr)`: a range input's built-in
minimum width otherwise pushed the field and the second button out of the
12rem column, which a screenshot showed at 1000 px and no test did.

## §84 Undo and redo: what is one step

PQW-1149. „Visszavonás” and „Újra” (Undo, Redo) are a toolbar group of their
own between New and the selection's group, each with its label, disabled while
there is nothing to take back or forward. The keys are in §11; the stack, a
hundred deep, in core-support §9.

**One action, one step** — the owner's rule:

- a placed stitch, a delete, a duplicate, a paste, and New;
- a drag: a move, a turn or a resize is recorded once, when it is let go
  (`settled` on the board's host), however many pointer moves it took. A drag the
  browser cancels goes back by itself and records nothing, and so does one that
  ends with every stitch where it was (`sameChart`);
- **an arrangement**: from the In a row or Around button for as long as the same
  selection is being adjusted, every slider, field and dial change folds into the
  one step, so the numbers running past while a slider is dragged are not steps.
  Switching between row and around on the same untouched selection stays in it.
  A plain move of the arranged stitches is a step of its own, and a setting
  changed after it folds into that move.

**Selecting is not a step**, but the selection travels with the chart: an undo
brings back the stitches *and* what was selected just before the change, so an
undone delete comes back selected, with the Select tool on. An undo or redo ends
an arrangement in progress and hides its settings — the restored chart is not
the one the arrangement produced. History starts at the first New; New on a
blank chart replaces it rather than adding a blank step — unless there is
something to redo, which New, like any change, clears. Neither an undo nor New
acts mid-drag.

## §85 An armed basic stitch brings a count to the right panel

PQW-1154, the owner's request: *„ha alapszemet választ ki: akkor egy számláló,
hogy hány alapszemet tegyen le. alapértelmezetten ez 1 és nem lehet kisebb, mint
1. és maximum ez a szám 10.”* The right panel (§83) now follows the armed stitch
as well as the selection. Arming and selecting exclude each other, so at most one
of its two sections, „Lerakás” and „Rendezés”, is ever shown.

**Which stitches.** The seven of the palette's basic section, chain and slip
stitch included — read from `STITCH_SECTIONS`, not from `kind`. Increases,
decreases and compound stitches show nothing and lay one stitch; the owner left
their options for later.

**The control** is the spacing control's twin: a 1–10 slider with a field on its
right, default 1. Unlike the arrange fields, this one is **capped**: as it is
typed, a number above 10 becomes 10 and a 0 becomes 1, and a leading zero goes
(`bindPair(…, capped)`, `cappedText`), because the owner asked that more than 10
never be accepted — so the field never shows a number other than the one a
click lays. Digits only, and an emptied field gets its last value back when it
is left, as in §83. The bounds are `MIN_COUNT` and `MAX_COUNT` in the core; the
slider takes them from there, not from the markup. The count is kept for the
session across stitches; it is not stored.

**What a click lays.** `placeStitches` (`core/freeform.ts`): the stitches side by
side, upright, centred on the click, laid out by the In a row arrangement with
its default spacing (read from `#arrange-gap`'s default value, 4 px). One stitch
lands exactly where a single placement always did. A row reaching past an edge
of the board is shifted back on, as an arrangement is, and one wider than the
board is not laid at all, as an arrangement is not taken (§83). The row is one
undo step (§84).

**Below 40rem** the right panel lies over the board (§83). For an arrangement it
takes the whole column; for the count it takes only its own height, because
arming a stitch is the placing state and the board under the column has to stay
clickable.

## §86 An increase or a decrease is a tile and a menu, and the panel sets its parts

PQW-1155, the owner's request: *„jelenleg bele van »égetve« vagyis dedikáltan
egy típusú szemre megy a fogyasztás”* — the palette listed six fixed ones (two
increases, four decreases), each tied to one stitch.

**The section is two blocks.** Decrease first, then Increase, as the
owner listed them; each is a full-width tile with, under it, a menu of the
stitch it is made of: sc, hdc, dc, tr, dtr (`SHAPING_PARTS`), default sc. The
tile and the menu share one border, square where they meet, so they read as one
control. A choice in the menu arms its tile. The tile's icon and structure line
follow the choice, redrawn in place so the menu keeps its focus (§8). `Alt`+8 is
the decrease and `Alt`+9 the increase. Both keys changed meaning: until v0.93.0
they armed the sc and the dc increase. The compound stitches had no shortcut
before and have none now. The parts field is labelled „Szemek száma” / „Number
of stitches”: „Stitches” alone was already the name of the palette's group.

**The menu prints whole names** in the notation („Rövidpálca” … „Háromráhajtásos
pálca”, „Single crochet” …), not abbreviations — the owner's request in
PQW-1156. In PQW-1155 the menu stood beside the tile and printed abbreviations;
whole names need about 170 px of the column's 240, which beside the tile left
too little for the tile, so the menu moved under it (owner's choice over a
narrower tile or names only in the open list). The invisible decrease stays a
tile of its own — it is worked through the front loops only, so it is not „sc2tog
from a menu” (owner's choice) — and since PQW-1157 it stands among the compound
stitches, just before the magic ring, at the owner's request; the library order
is untouched (§74).

**One focus ring for the block** (PQW-1157). The tile and its menu each drew
the global `:focus-visible` ring, so after a choice the ring hugged the menu
alone. The owner liked the ring and asked for it round the whole block: the
block takes the ring when either of them holds the focus, and they draw none of
their own. The offset is 1 px, not the global 2, so the ring stays inside the
4 px gap and does not touch the next block. Both rules sit behind `:has()`: a
browser without it keeps the children's own rings rather than losing the ring.

**The parts: 2–5, not 2–10.** The owner asked for 2–10 and then asked whether
10 was too many. Drawn, an increase of more than five runs its legs into one
blot, and a decrease of ten is four or five stitches wide; the owner chose 2–5
for both (`MIN_SHAPING`, `MAX_SHAPING`). The control is the count's (§85):
slider and digits-only field, capped as it is typed, default 2. One value serves
both tiles. A click lays **one** increase or decrease — the parts are inside
the stitch, not copies of it.

**The ids are built, not listed.** `stitchById` builds `inc-<n><part>` and
`<part><n>tog` for a menu part on demand (core-domain §4), so any of the fifty
combinations can be drawn. The library sections are untouched: the written
pattern's key still follows them (§74), and the palette simply shows this
section its own way.

## §87 Zoom and moving the view in the free-form board

PQW-1158. The owner: „a delete mellett legyen zoom in/zoom out egy külön
ikoncsoport, illetve egérrel is lehessen ezt megtenni”, and moving the drawing
area „úgy, hogy a select opcióval ne csússzon össze”.

**The sheet stays the drawing area at 100%.** The board's coordinates did not
change: the sheet is still the canvas's own size (`size()`), and every edge rule
— a stitch placed, moved, pasted or arranged stays on it — is measured against
the sheet, not against what is on screen. The view (`core/view.ts`) only says
which part of the sheet is shown and how large: 100% to 800%, never below 100%,
so the view is always inside the sheet and there is never an empty margin to
place into. A larger sheet than the window is a separate decision, because it
changes those edge rules and the specs that pin them.

**Zooming.** The group beside „Törlés”: zoom out, the level (a click returns to
100%), zoom in, and „Nézet mozgatása”. The buttons step through `ZOOM_STEPS`;
the mouse wheel zooms smoothly about the pointer, and a trackpad pinch, which
arrives as a wheel with Ctrl, does the same at its own rate. Ctrl/⌘ + plus,
minus and 0 are taken from the browser's page zoom while there is a chart; they
go by the character, not the key position, because the Hungarian layout has
them elsewhere. „Új” starts at 100%.

**Icons only, and the title gives way below 66rem.** With labels the group
pushed the bar 73 px past a 1000 px window (`felulet.spec.ts` pins that the
page does not scroll there). The magnifiers and the hand carry their name in
`aria-label` and the tooltip instead; even so the bar was 27 px (English) and
40 px (Hungarian) too wide at 1000 px, so below 66rem the title is clipped
visually and stays in the accessibility tree. The brand mark and Home remain.

**Moving the view never selects.** Three ways, none of which passes through the
selection's press handling:

- „Nézet mozgatása”, a third mode beside „Kijelölés” and placing: arming any one
  puts the others down. The selection stays as it was, and the panel with it.
- Space held while the pointer is over the drawing, with any tool. Only over
  the drawing: elsewhere Space still presses the focused button, which keyboard
  users need. The release is taken too, or a focused button would fire.
- The middle mouse button, with any tool.

A pan that moved more than the drag slop swallows the click that follows it, so
panning with a stitch armed lays nothing.

**What stays the same size on screen.** The selection frame's line, its dash,
the corners, the rotation knob, their hit areas and the drag slop are screen
pixels, divided by the zoom. The stitches, their lines and the frame's padding
zoom with the drawing.

**What the tests pin.** `tests/core-view.test.mjs` the arithmetic;
`tests/ui-platform.test.mjs` the shortcuts; `e2e/nagyitas.spec.ts` the buttons,
the wheel about the pointer, a click placing at the board point under it when
zoomed, and the pan tool and Space-drag moving the view without touching the
chart or the selection.
