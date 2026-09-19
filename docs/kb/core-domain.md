# Core domain and pattern output — engineering decisions

Decisions, constraints and past incidents that used to live as comments in the
domain and pattern-output half of `src/core/`. **Crochet domain knowledge is
not here**: that is `docs/knowledge-base/`, cited by section code (`03 §10 C16`).

One heading per decision, numbered `§N`, so code can cite it stably
(`// KB: core-domain §12`). Never renumber a section — mark it `(withdrawn)`
and add a new one.

## §1 A generated title belongs to the generator, a typed one to the user

`pattern-title.ts`, `Pattern.titleGenerated`. Every generator names the pattern
after the shape it made, unless the user typed a title of their own. The
pattern itself records which it is: the generator sets the flag, editing the
title field clears it.

Saves written before the flag existed do not carry it. For those, a title
counts as generated when it is empty, when it is the default title, when it
equals a piece name (generators name the piece after the shape), or when it is
one of the generator names the caller passes in. This is why `hasOwnTitle`
takes a `generatedNames` argument that looks redundant.

## §2 The core returns codes and data, never sentences

The core hands back an identifier plus the values to substitute (`CoreText` in
`messages.ts`); the UI dictionary in `src/ui/i18n/core/` builds the sentence in
its own language. That is what keeps the core language-independent and DOM-free,
and what makes a new language touch only the dictionary.

Consequences that are easy to get wrong:

- The article, the inflection and the word for row or round belong to the UI.
  The core puts the raw value in `data` — a layer number, a `shape`, a field
  name — never a Hungarian word and never a finished phrase.
- `data` keys are language-neutral names, and its values are numbers,
  identifiers or lists.
- A narrow string union per area describes the code set, so a dictionary
  cannot silently lose an entry.
- Some areas still return a finished Hungarian sentence on a branch that is
  unreachable in practice (the round generator's legacy path). Callers that
  cannot reach it take it as an internal error rather than translating it.

`ShawlWarning` in `shawls.ts` was the first area built this way; the rest
followed it.

## §3 Hungarian inflection lives in one place

`hungarian.ts`, plus `sizeArticle` in `garment-text.ts`. The numbers are written
as digits, so the suffix attaches with a hyphen (`3-szor`), and its vowel
harmony is decided by the **last word of the number's spoken form**. Hence:

- `DIGIT_SUFFIX` is indexed by the last digit, `TENS_SUFFIX` by the tens digit;
  index 0 is unused.
- For a round number the place-value word decides: hundreds and millions take
  `-szor`, thousands take `-szer`. That is the lowest non-zero place value, not
  the highest.
- The definite article follows the start of the spoken form: `egy`, `öt`,
  `ötven`, `ötszáz` and `ezer` begin with a vowel, so they take `az`.
- A size name that is a letter code is read out letter by letter, so
  `A E F I L M N O R S X` take `az` (ef, el, em, en, er, es, iksz).
- A dative suffix on an abbreviation is always front-vowel and hyphenated,
  because the letters are pronounced separately (er-pé, el-esz).

## §4 A compound stitch id describes its own structure

`stitch-variants.ts`. The library lists the common variants only, but the
builder functions in `stitches.ts` make the compound stitch for any `n` — the
editor turns an `inc-2dc` into an `inc-3dc`, which is not on the palette. The
id is therefore parseable (`inc-<n><part>`, `<part><n>tog`, `cl-<n><part>`), so
a saved pattern can be reconstructed without storing the definition.

`MAX_PARTS` caps the part count at 12: beyond that the id is a typo, not a
pattern.

## §5 The foundation chain skips `max(2, turningChain)` chains

`tradition.ts` `skippedChains`, owner's table (PQW-924): single crochet 2, half
double 2, double 3, treble 4, double treble 5. See `03 §1.2` for the source
formula.

This function is the single source. The chain length, the position of the first
stitch, the editor, the generators, the validator and the pattern reader all
derive from it, so they cannot drift apart. The skipped chains are **not**
stitches: a row's stitch count is the number of stitches worked into them, which
is exactly the requested count (20 half doubles: 22 chains, 2 skipped, 20
stitches). When the turning chain does not count as a stitch (Japanese single
crochet), the skip is just the turning-chain length.

Written text produced under the older rule is **refused, not silently
reinterpreted**: the reader says what is wrong and what the crocheter can do.

## §6 The aspect-correct view scales stems from real stitch size

`pattern-size.ts` `aspectStem`. The column width is the real width of a single
crochet, so a row's pitch (stem + row gap) is the row's real height at the same
scale. The height comes from the basic stitch of that chain height; where there
is none, it is the single crochet's height multiplied by the chain height.

## §7 Body-size tables are flagged, never corrected

`body-sizes.ts`. Some rows of the published CYC tables look wrong (see
`05 §3.1`–`3.2`, "Do not trust them blindly"). The tables are stored with their
source and checked at run time; `tableFlags` raises three kinds of suspicion:

1. the inch and the centimetre value disagree by more than the source's own
   rounding (~1.2 cm);
2. a value is smaller than the previous size's;
3. two different sizes are identical across at least three consecutive
   measurements — the knowledge base assumes a copy error in the women's
   2X–5X cross-back, back length and arm length rows.

A flag does not change anything. The generator uses the value as published; the
UI shows the suspicion. Every value is in centimetres with a range, and sizing
uses the midpoint of the range.

## §8 The pattern is a stitch graph, stored as plain JSON

`types.ts`. Every stitch knows which stitch it follows and what it is worked
into. Rows, rounds, stitch counts, right/wrong side, symbol placement and the
written pattern are all **derived** from that, never stored.

Two consequences:

- The topology is independent of gauge, so there are no millimetres in
  `types.ts`. Real size comes from the gauge profile.
- Every value is plain JSON — no `Map`, no `Date`, no class — so a pattern can
  be saved and loaded as versioned JSON.

## §9 Counting conventions and their owner-chosen defaults

What counts as a stitch is a pattern-level setting, because crocheters disagree
and the owner picked a default for each.

| Setting | Default | Why |
|---|---|---|
| `roundEnd` | joined round; amigurumi patterns supply spiral | The pattern type decides, not the stitch height |
| `chainCounts` | `true` — every chain counts | The designer counts the chains in the row, and nothing has been worked into the row above yet |
| `picotCounts` | false | A picot is decoration |
| `joinSlipStitchCounts` | per pattern | A joining or travelling slip stitch may or may not be counted |
| `turningChainCounts` | `stitch-default` | Rows: always counts and stands on one foundation chain. Rounds: the stitch's own default, double crochet and up. Japanese: half double and up |

`chainCounts: 'worked-into'` (count a chain only if a later row works into it)
remains available per pattern, but is no longer the default.

## §10 Structural stitch count and written stitch count are different numbers

`Layer.stitchCount` vs `Layer.writtenCount` in `types.ts`.

- **`stitchCount` is the structure**: how many stitches stand in the row for the
  next row to work into. In rows the turning chain is not one of them, and a
  chain is one only if something works into it. No convention tilts this number;
  the generators and the validator depend on it.
- **`writtenCount` is what the pattern says**: the number printed in the written
  pattern and on the chart, and the number the crocheter counts along the row.
  The turning chain is the row's first stitch, and chains count according to
  `chainCounts` — by default all of them.

They are deliberately allowed to differ. The `"3 ch (counts as 1 dc)"` note
therefore also appears in rows, except where the row's own setting says the
turning chain is not a stitch (a ribbed row).

## §11 Optional fields are how older saves stay loadable

`pattern-json.ts`, `types.ts`. `formatVersion` rises only on a change that is
**not** backwards compatible. A newer version is refused on load, because data
would be silently lost.

Anything added since is an optional field instead: a save written before the
feature simply does not have it, and the reader falls back to the behaviour
that was correct at the time. That is why so many fields are optional and why
`formatVersion` has not moved. Loading is otherwise strict — an unknown field, a
missing field or a wrong type is an error carrying the field's path — but the
graph's *contents* are checked by `validatePattern`, not by the reader.

The written-pattern reader keeps a few retired phrases for the same reason: it
must still read back text the program itself printed.

## §12 A section can be resumed above an earlier row

`LayerEvent.resume`, `Layer.below` / `alsoBelow` / `basePositions` / `row`.

After fastening off, the next section does not have to continue above the last
row. It names the row it continues above, plus a name for the written pattern.
That is what makes two shoulders on either side of a neckline possible inside
one piece, and a raglan sleeve worked into the underarm stitches.

- `with` names a **second** source layer. The raglan sleeve works into the
  shoulder section's held stitches *and* the divide's underarm chain at once:
  `layer` gives the first source, `with` the second, and their positions follow
  in that order. Rounds only, and `with` must point after `layer`.
- `basePositions` exists because such a sleeve does not sit on the *whole*
  round of the two sources — the body stitches between them are not part of its
  tube.
- The printed row number restarts in a resumed section, so two sections can
  share a number and only the name tells them apart. Seams therefore carry the
  section name whenever the number alone is ambiguous.
- Positions used by *another* section over the same row are not "unused": the
  other shoulder works them.
- A bad `resume` stops validation immediately. The graph falls back to the
  previous row, so every later rule would report a consequence rather than the
  cause.

## §13 Drawing hints are data, and they travel with the piece

`Piece.rowShape`, `Piece.roundShape`, `Piece.grid`. None of them changes the
topology; all of them are saved with the piece.

- `rowShape` bends the rows of a shawl worked in rows: an arc for the semicircle
  and the crescent, a break at the spine for the top-down triangle. The shawl
  generator supplies it; without it the rows are straight.
- `roundShape` marks the rounds that form a cone — a raglan yoke is not a flat
  circle, so its rounds open out into a circular sector. `throughRound` is the
  last such round. The raglan generator supplies it; without it the rounds are
  drawn flat.
- `grid` is the grid pattern the piece was generated from. The graph is built
  from it, and it is saved so that the technique's rules (C2C, tapestry) and the
  marked repeat unit survive a save.

A 3D piece (`Piece.sections`) is the same idea in reverse: because the piece is
a spatial form, cupping is intentional and the validator stays quiet about it.

## §14 `rules.ts` has three text fields and they are not alike

| Field | Audience | Treatment |
|---|---|---|
| `summary` | the editor and the tests — developer | English |
| `message` | the user, in the editor | frozen Hungarian |
| `reference` | knowledge-base code, e.g. `06 §5.2` | frozen, format-locked |

`tests/core-validate.test.mjs` requires `reference` to match `/^0[1-6] §\d/` and
`message` to contain none of `réteg`, `darab`, `§`, `0X `. Moving a
knowledge-base citation into `message` fails the build: the user never sees the
knowledge base.

`summary` is developer-only. `src/ui/i18n/rules.ts` derives the Hungarian
`RuleText` from `RULES`, but every UI call site reads `.message`; nothing
renders `.summary`.

The structural rules come first in the file on purpose: if any of them reports,
the piece's layers cannot be computed and the other checks do not run.

## §15 A missed position at the ends of a row is a warning, not an error

`rules.ts`, `unused-position` and `floating-chain` (PQW-930). The owner's
decision from the first round of UAT: the program was treating pattern-making
far more strictly than real crochet, which is a loose and creative process. An
un-worked "tail" hanging off the foundation chain can be intentional, so it is
reported but not called a mistake.

A position missed in the **middle** of a row stays an error (`reach`,
`reach-single`): there the hole is not a matter of style.

## §16 Validation order, and what suppresses what

`validate.ts`. Each finding belongs to a rule in `RULES` and takes its severity
and knowledge-base reference from there. The order exists so that one mistake
produces one finding:

1. **Structure** — unknown stitch, dangling reference, yarn path. If this fails,
   the piece's layers cannot be computed and nothing else runs.
2. **Targets** — if any target in a layer is invalid (worked later, wrong row,
   into a non-counting turning chain), then for that layer the rules built on
   order, reach, usage and repeat do not run: they would only be consequences.
3. **Per layer** — usage, order, foundation chain, counts; finally the height
   warnings.

## §17 Where the turning chain sits, and what that does to the rules

The counting turning chain occupies the place of the row's first stitch
(PQW-944, PQW-924). Everything below follows from that:

- Only the **top** of the turning chain is a target — the row's last stitch goes
  there. Its lower chains are not targets.
- Reaching that top is allowed but **not required**. Patterns made under the
  older rule, including today's generator output, run past the turning chain and
  are still correct.
- The position under the turning chain gets no stitch, and that is not a missing
  stitch. In a shared row the same applies to the section's own first position.
- In rows the turning chain is not a stitch, so no position can be left out
  because of it: every stitch of the row below needs a stitch. In a round the
  stitch under the beginning chain may still be skipped (`03 §1.3`).
- In a round the top of the beginning chain stays a target — the closing slip
  stitch goes there. In a row the turning chain does not.
- A row uses as many places as it has stitches. Its own turning chain is a
  position, but it consumes no place from the row below, so it is left out of
  the repeat-balance comparison.
- In the step language, rounds start the cursor at position 1 (the beginning
  chain sits on position 0); rows start it at the beginning, because the text
  states the skip explicitly. Writing and reading back therefore count from the
  same place.
- The reader must not mark the single leading skip of a row as an intentional
  skip: the chain sits there, and the editor does not mark it either. Marking it
  would make the two graphs diverge.

## §18 There is no height check

Removed with PQW-924. Stitches of different heights in one row are a deliberate
design tool — that is how a wave pattern is made — not a mistake. If you are
looking for the rule that used to flag it, this is why it is gone.

## §19 The retired border generator

The `border` field (PQW-911) may still appear in older saves. The reader
**accepts the field and ignores it**: the piece loads without its border.

Border *stitches*, which are worked into row ends, are a different matter. Such
a save is neither truncated nor reinterpreted — it is rejected with its own
clear error.

## §20 Shape and generator names stay Hungarian in the core

`amigurumi.ts` `SHAPE_NAMES` and friends. These names go into the pattern
**title** and into the piece name, so they are data in the saved file, not
interface labels. The core therefore keeps them in Hungarian regardless of the
UI language; the panel's own list uses the UI dictionary. This is also why
several files in this half are listed in `CORE_EXCEPTIONS` in
`tests/core-i18n.test.mjs` — and why none of them may be renamed.

## §21 How a round places its increases

`amigurumi.ts` `roundOps`. Increases and decreases are spread evenly
(`04 §3.1`, `§3.3`, `§9.1`). Without stagger they land at the end of each
segment; staggered they land in the middle (`04 §3.2`).

`cost` is what a position of the previous round costs — for example when two
increases already stack on it and a third would land there. When the chosen
place is taken, these win in order:

1. the first cheap place from the end of the segment, the **same** in every
   segment, so the repeat stays printable;
2. per segment, the cheapest nearest place;
3. over the whole round, the cheapest nearest place.

`null` when the round would be more than a doubling or a halving.

## §22 Row numbering in the written pattern

The foundation chain is **row 1** (PQW-923), so the row worked into it is row 2:
a row's printed number is one more than its layer index. In rounds the
numbering is unchanged, because the magic ring, the chain ring and the oval
start kept their existing names.

The reader decides from the **shape of the first heading** where the printed
numbering starts, and requires it to be continuous from there. A resumed
section's first heading says where its numbering continues: it is not always
"the row after the one referenced" — a raglan sleeve starts with the same number
as the shoulder row it sits above, while the two shoulders of a neckline start
one higher. Continuity *within* a section is still checked.

Error messages quote the printed row number, so the reader can find the place in
the text.

## §23 Hungarian wording that is not approved yet

Several Hungarian phrases in `pattern-text.ts` are provisional and waiting for
the owner: the insertion-mode names (`esz` is not in the approved vocabulary and
has no source), and the sentences added for amigurumi and for the grid
techniques. The British output is provisional too — `miss` is an editorial
inference from `01 §3.1`.

Where the owner has already ruled, the code follows the ruling: the skip at the
start of row 1 is spelled out as a verb ("hagyj ki 2 láncszemet", "skip 2 ch",
"miss 2 ch").

## §24 The step language: what a target means

`pattern-steps.ts` produces a language-independent step list from the graph;
`pattern-text.ts` renders it and `pattern-read.ts` reads the same meaning back.
A target is relative to a **cursor** travelling along the previous layer's
positions in the working direction:

- `next` — the position under the cursor; the cursor then advances. Nothing is
  printed: "5 sc" goes into five consecutive positions.
- `same` — the same position as the previous target. With a counting turning
  chain this is the stitch under the turning chain at the start of the row
  (`03 §1.3`), which is why the cursor starts on position 1.
- `next-space` — the first chain space from the cursor; the stitches in between
  are skipped, the way patterns write it.
- `same-space`, `ring`, `chain-ring` — the previous chain space, the magic ring,
  the chain ring.
- `none` — worked into nothing (a picot).

Conventions that exist so reading back is unambiguous:

- Chains in the middle of a row always form one chain space (`01 §8.2` rule 11).
- On a wrong-side row the front and back loop, and the post side, are flipped,
  because the graph stores the right-side view (`03 §2.1`, `01 §8.4` rule 21).

Still not expressible in text: crossed and spike stitches, a multi-target stitch
other than a decrease, a piece without a foundation chain, and joins between
pieces.

## §25 A plain chain run is expressible

PQW-937. A chain space is only the yardstick when there is one. Crocheters put
plain chains in the middle of a row as well — that is how a wave pattern is
made — and the written pattern used to stop there and say it could not express
the row, even though the chart was correct.

## §26 Choosing the repeated unit

`pattern-steps.ts`. The shortest repeating unit wins, meaning the adjacent
repeat that saves the most steps. On a tie:

- **In rows**: the unit that does not end in a skip wins, then the one starting
  later, so the edge stitches stand before the repeat, the way patterns are
  written (`03 §2.3`, `§4.2`).
- **In rounds** (`preferEarly`): the unit ending in a chain wins, then the one
  starting earlier, so the half-finished repeat lands at the end — "1 sc,
  (inc, 2 sc) ×5, inc, 1 sc" (`04 §3.2`).

The search continues in the parts before and after the repeat. Repeats are never
nested.

## §27 The reader accepts only what the writer would print

`pattern-read.ts` is **not** a general pattern parser. It reads the output of
`pattern-text.ts` and accepts an item only if the writer would print it exactly
that way. Anything the writer would word differently is reported as an error, so
the two can never drift apart.

What is deliberately not read back: the sizes block (`S (M, L)`), which is
descriptive, and the assembly seams. The sizes block still has to be recognised
and skipped — without that, garment patterns failed on their own heading.

Where a number sits in a sentence is not enough to identify it. A chain count is
found by asking whether the writer would print *this row* with it, because the
foundation row reads "Row 1 - base: 17 ch", where the first number is the row
number and a positional match would have taken the 1.
