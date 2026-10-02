# The interface dictionaries

`src/ui/i18n/` — how the sentences the user reads are assembled, and what may
never go into them. The dictionary **values** are a frozen path
(`.claude/rules/frozen-paths.md`); this file is about their structure, not their
wording.

## §1 One dictionary per core area, complete in both languages

The core returns a code and data, never a sentence (`decisions.md` §2). Each
area of the core has a dictionary file in `src/ui/i18n/core/`, typed on that
area's code union, so a new code in the core is a **type error** until both
languages have a sentence for it.

`renderCoreText` tries the chosen language, then English, then prints the code
itself (§9). That last step is deliberate: a core that is ahead of **every**
dictionary degrades to an unhelpful message rather than breaking the interface.

These files are DOM-free, so Node runs them directly, which is why they import
the core with a `.ts` extension (`interface.md` §1).

## §2 The Hungarian branch is a transfer, not a rewording

PQW-900 and PQW-904 moved the sentences out of `main.ts` and out of the core
into the dictionaries. Every Hungarian value was carried over **character for
character**, so the Hungarian interface did not change by one character at the
migration. A later Hungarian rewording is a separate, deliberate act — and the
values are frozen, so it needs the owner.

`rules.ts` goes one step further: its Hungarian branch is not copied at all, it
is derived from the core's `RULES` (`summary` and `message`). It therefore
cannot drift from the core, and a Hungarian fix happens in one place. Only the
English branch is hand-written, rule by rule. `severity` and `reference` are not
text and are not translated. What the `summary`/`message` split means for their
audiences is in `.claude/rules/frozen-paths.md`.

## §3 `core/layer-counts.ts` is a leaf module, to break an import cycle

The per-layer breakdown ("row 2: 1 stitch, row 3: 1 stitch", PQW-904) is needed
in two places: the editor's core messages (`core/editor.ts`) and the status line
and the delete dialog (`messages.ts`). `messages.ts` cannot import the editor
dictionary, because that reaches `notation.ts` and from there back to `i18n.ts`,
which is a cycle. The shared sentence therefore lives in a module with no
runtime import of its own.

## §4 Ribbing sentences exist once, for three dictionaries

A ribbed edge is offered by three generators — Shape, Round-and-motif and the
garments (PQW-909, PQW-913) — so `RibbingCode` is part of three code unions and
all three dictionaries have to be complete. `core/ribbing.ts` holds the single
copy they all spread in. Two copies would drift apart.

## §5 What the dictionary adds that the core cannot

The core has a layer index, a `shape`, an id and numbers. Everything that is
language rather than data is added here: the Hungarian article and suffixes, the
word for row or round, the name of a size or a body measurement, the decimal
separator, and the capitalisation that a sentence start or a label needs. The
row number is shifted here as well (`interface.md` §33).

Grammar helpers are per-branch: the Hungarian ones live only on the Hungarian
side and are never called from the English one.

## §6 What never comes from the dictionary

- **Stitch names and the written pattern.** They follow the pattern's notation,
  not the interface dictionary (`interface.md` §2, §3). Since PQW-1122 the
  notation's terms follow the interface language, so in practice the two agree —
  but the words still come from `pattern-text.ts` and `stitches.ts`, which is
  what keeps US and UK terms apart.
- **The Japanese tradition's chart labels** ("18目", "縁編み"). They belong to the
  notation (`01 §6.2`); only the note explaining them is bilingual.
- **Shape and motif names** (`SHAPE_NAMES`, `MOTIF_NAMES` in the core, and the
  rest of the `*_NAMES` tables beside them). They end up in the pattern's title
  and in the piece's name, so they stay in the core. Each one carries every
  locale, in the shape `VOCABULARIES` uses, and the generator picks the
  pattern's own notation (owner-decisions.md §16).
- **Units** (cm, g, m, mm, °) — the same text in both languages.

Where a sentence has to name an interface element, it takes the label from the
dictionary that owns it instead of repeating the words.

## §7 `markup.ts` mirrors `index.html` exactly

`applyStaticTexts` (`i18n.ts`) substitutes by key from the `data-i18n` (text),
`data-i18n-tip` (own tooltip), `data-i18n-label` (`aria-label`),
`data-i18n-content` (`content`), `data-i18n-roledescription`
(`aria-roledescription`) and `data-i18n-value` (an input's default) attributes.
A key in the HTML and a key here therefore have to match exactly, and a label
corrected in the HTML has to be corrected here too.

`data-i18n-value` is the one that does not simply overwrite. An input may hold
something the user typed, and `interface.md` §8 says such a field is never
overwritten, so the swap happens only while the field is empty or still holds
one of the languages' defaults for that key. That is also why the Hungarian
decimal of `garmentBelowValue` is a dictionary value rather than a number
formatted at runtime: it is a default the user then edits.

Since PQW-1100 the markup carries the **English** branch, because English is the
default language: `ui-i18n.test.mjs` compares `index.html` with `MARKUP_TEXTS.en`.
What stands in the file is what a visitor sees before the script runs.

A label built from several elements — the text beside a checkbox, the sentence
before a link, the key table — sits in its own `<span>`, because `data-i18n`
replaces the whole `textContent` and would delete the child `input`, `kbd` or
`a`.

## §8 The two languages share one key set, one kind and one arity

`tests/ui-i18n.test.mjs` requires both branches to have the same keys, each key
to be a function in both or a string in both, and the functions to take the same
number of parameters. A parameter that one language does not use is therefore
kept and named with a leading underscore.

## §9 The English fallback sits at the two boundaries where a key can be missing

English is the default language and the fallback (PQW-1100), but a dictionary
lookup cannot go missing in most of the code: `satisfies Dictionary<typeof hu>`
and the per-area `CoreDictionary` types make a gap a **compile error**, and §8's
test checks keys, kind and arity on top of that. Adding a runtime fallback to
`texts()` would therefore guard nothing and would hide the type error that is
the real protection.

Two boundaries escape the type system, because the key arrives as a string:

- **`applyStaticTexts`** — the key comes from a `data-i18n*` attribute in
  `index.html`, which TypeScript never sees. It falls back to `MARKUP_TEXTS.en`
  and throws only when English has no entry either.
- **`renderCoreText`** — the code comes from the core at runtime and may be
  ahead of its dictionary (§1). It tries the chosen language, then English, then
  prints the code itself.

That is why `renderCoreText` takes the dictionary **pair** and the language
rather than an already-resolved branch: a resolved branch cannot fall back.

## §10 Two Hungarian literals shipped in the English markup, and the scan could not see them

PQW-1100 translated `index.html` from the dictionary and then checked the result
by scanning for accented letters. `Fej` (the default amigurumi piece name) and
`Nincs hiba` (the first paint of the error bar) both survived that scan, because
neither word carries an accent. Both reached the built English page.

An accent scan answers "is this Hungarian text", which is not the question. The
question is "does this text come from the dictionary", and `ui-i18n.test.mjs`
now asks it two ways: no Hungarian dictionary **value** may stand in the markup
(matched on word boundaries, or `Profil` reads out of the English `Profile`),
and no `<input>` may carry a non-numeric `value` without a `data-i18n-value`
key. The accent scan stays as the cheap first net.
