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

`renderCoreText` prints the code itself when a dictionary has no entry for it.
That is deliberate: a core that is ahead of its dictionary degrades to an
unhelpful message rather than breaking the interface.

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
  not the interface language (`interface.md` §2, §3).
- **The Japanese tradition's chart labels** ("18目", "縁編み"). They belong to the
  notation (`01 §6.2`); only the note explaining them is bilingual.
- **Shape and motif names** (`SHAPE_NAMES`, `MOTIF_NAMES` in the core). They end
  up in the pattern's title and in the piece's name, so they stay in the core.
- **Units** (cm, g, m, mm, °) — the same text in both languages.

Where a sentence has to name an interface element, it takes the label from the
dictionary that owns it instead of repeating the words.

## §7 `markup.ts` mirrors `index.html` exactly

`applyStaticTexts` (`i18n.ts`) substitutes by key from the `data-i18n` (text),
`data-i18n-tip` (own tooltip) and `data-i18n-label` (`aria-label`) attributes,
and **throws on an unknown key**. A key in the HTML and a key here therefore
have to match exactly, and a label corrected in the HTML has to be corrected
here too.

A label built from several elements — the text beside a checkbox, the sentence
before a link, the key table — sits in its own `<span>`, because `data-i18n`
replaces the whole `textContent` and would delete the child `input`, `kbd` or
`a`.

## §8 The two languages share one key set, one kind and one arity

`tests/ui-i18n.test.mjs` requires both branches to have the same keys, each key
to be a function in both or a string in both, and the functions to take the same
number of parameters. A parameter that one language does not use is therefore
kept and named with a leading underscore.
