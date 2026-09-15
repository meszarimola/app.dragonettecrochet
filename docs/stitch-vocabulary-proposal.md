# Stitch vocabulary proposal (PQW-867)

**Approved by the owner on 2026-09-14.** Every *Proposal* in §4 (D1–D8) is
accepted as written, and the default conventions are in §5. The stitch library
in PQW-867 is built from this list. The [T] compound-stitch names are approved
as listed, written out in full with no Hungarian abbreviation for now.

Based on `knowledge-base/01-stitches.md` §3–§4 and `knowledge-base/README.md`
§4.5, plus `02 §1.8`, `03 §1`, `04 §1.1` and `04 §2` where noted. Source tags
such as [S27] refer to the source list in `01-stitches.md`.

**Legend**

| Mark | Meaning |
|---|---|
| ⚠ | Disputed: needs an owner decision (see *Disputed points*) |
| [T] | The Hungarian name comes from the PQW-867 ticket. The knowledge base has no Hungarian source for it (README §8: Hungarian terms beyond the basic stitches are thinly sourced) |
| [E] | Editor inference: derived with the US ↔ UK shift rule or from general practice, with no direct citation |
| Chain height | Chain-equivalent height (`01 §2.1`, `§8.1` rule 1). It sets the default turning chain and the stem length of the symbol. It is **not** the physical height ratio (README §4.1) |
| c → p | Positions this element **c**onsumes from the previous row → countable positions it **p**roduces for the next row (`01 §4.1`) |

"Accepted alternatives" are names the program understands on input. It never
writes them out. Hungarian output always uses the approved name and
abbreviation.

The user chooses the output notation (Hungarian, US or UK), independently of
the interface language: PQW-868. Every stitch therefore carries all three
names; the choice changes only how a pattern is shown, never its data.
Defaults: Hungarian notation on the Hungarian interface, US notation on the
English one. The chart style is CYC by default, and the user can switch to
Japanese (JIS) symbols.

## 1. Basic stitches

| Hungarian (proposed) | Abbr. | Accepted alternatives | US | UK | Chain height | c → p |
|---|---|---|---|---|---|---|
| láncszem | lsz | LSZ; légszem (one source, [S26]) | chain (ch) | chain (ch) | 1 (the unit) | 0 → 1 |
| kúszószem | ksz | KSZ; ⚠ *hamispálca (hp)*, *hamis kispálca*: see D1 | slip stitch (sl st) | slip stitch (ss) | 0 | 1 → 1 ⚠ often left out of the count when used for joins or travel (`01 §4.2`) |
| rövidpálca | rp | RP; ⚠ *kispálca*: see D2 | single crochet (sc) | **double crochet (dc)** | 1 | 1 → 1 |
| félpálca | fp | FP; egyráhajtásos félpálca (`02 §1.8`); ⚠ *hamispálca*: see D1 | half double crochet (hdc) | half treble (htr) | 2 | 1 → 1 |
| egyráhajtásos pálca | erp | ERP; nagypálca [S35]; ⚠ *pálca (p)*: see D3 | double crochet (dc) | **treble (tr)** | 3 | 1 → 1 |
| kétráhajtásos pálca | krp | KRP | treble (tr) | double treble (dtr) | 4 | 1 → 1 |
| háromráhajtásos pálca | ⚠ hrp (unverified, D4) | — | double treble (dtr) | triple treble (trtr) | 5 | 1 → 1 |
| *(optional)* négyráhajtásos pálca [E] | — | — | triple treble (trtr) | quadruple treble (qtr) [E] | 6 | 1 → 1 |

- The UK names are the US names shifted by one step. "dc" and "tr" exist in both
  systems and mean different stitches (`01 §3.1`).
- Default turning chain = the chain height of the first stitch of the row:
  rp 1, fp 2, erp 3, krp 4, háromráhajtásos 5 (`01 §8.3` rule 12).
- The négyráhajtásos pálca is not in the ticket's stitch set. It is listed only
  so the owner can decide whether to add it.

## 2. Increases, decreases and compound stitches

The knowledge base has no Hungarian abbreviations for these, so the proposal is
to **write them out in full** until the owner chooses abbreviations.

| Hungarian (proposed) | Abbr. | US | UK | Chain height | c → p |
|---|---|---|---|---|---|
| szaporítás (n szem egy szembe) [T] | — | increase (inc): "2 sc in next st" | increase (inc): "2 dc in next st" | same as the base stitch | 1 → n |
| fogyasztás (n szemből egy) [T] | — | decrease (dec): sc2tog, dc2tog, sc3tog… | decrease (dec): dc2tog, tr2tog, dc3tog… [E] | same as the base stitch | n → 1 |
| láthatatlan fogyasztás [T] | — | invisible decrease (invdec) | invisible decrease [E] | 1 (worked as rp) | 2 → 1 |
| kagyló [T] | — | shell (sh): e.g. 5 dc in same st | shell: e.g. 5 tr in same st [E] | 3 (erp-based) | 1 → n; with k skipped stitches on each side 1 + 2k → n |
| V-szem [T] | — | V-stitch (V-st): (dc, ch 1, dc) in same st | V-stitch: (tr, ch 1, tr) [E] | 3 | 1 → 2 stitches + 1 chain space |
| ⚠ fürt [T] | — | cluster (CL) | cluster (CL) | same as the base stitch | ⚠ in one stitch: 1 → 1; over n stitches: n → 1 (D6) |
| puff [T] | — | puff stitch (ps / puff) | puff stitch | ≈ 2 (≈ fp) | 1 → 1 |
| bogyó [T] | — | bobble (bo) | bobble | ≈ 3 (≈ erp) | 1 → 1 |
| popcorn [T] | — | popcorn (pc) | popcorn | ≥ 3 (tallest of the three) | 1 → 1 |
| pikó [T] | — | picot (p): "ch 3, sl st in 3rd ch from hook" | picot | none (a 1–2 chain loop, not a row height) | ⚠ 0 → 0; some patterns count it (D7) |
| rákhurok [T] | — | reverse single crochet (rev sc), crab stitch | reverse double crochet [E], crab stitch | 1 | 1 → 1; **the top cannot be worked into** |
| láncív [T] | — | chain space (ch-sp), chain loop (ch-lp) | chain space (ch-sp) | none (k chains) | m skipped → 1 space made of k chains |
| varázskör [S24] | — | magic ring (MR) | magic ring (MR) [E] | 0 | 0 → 1 insertion point. It is not a stitch (`04 §1.1`) |

## 3. Insertion modes (for reference)

| Hungarian | Abbr. | US | Notes |
|---|---|---|---|
| mindkét szálba | — | both loops (default) | No mark in the pattern text |
| hátsó szálba | hsz [S32] | back loop only (BLO / BL) | |
| első szálba | — (none found) | front loop only (FLO / FL) | |
| elölről hurkolt / első relief | Eerp [S38] (for erp) | front post (FPdc) | The E- prefix is attested only for erp. Other stitches (Erp? Efp?) are unverified |
| hátulról hurkolt / hátsó relief | Herp [S38] (for erp) | back post (BPdc) | Same as above |
| láncívbe | — | in ch-sp | |
| gyűrűbe | — | in ring | |

## 4. Disputed points

**D1. Hamispálca.** The sources split on which stitch this means. Horgoljmagadnak, Bármitartó and Magyarhorgolás use it for the kúszószem [S27], [S32], [S26]. Hol vetted? Én csináltam uses it for the félpálca [S24]. Zöld Pamuk recommends dropping the "hamis" names altogether [S34].
*Proposal:* the program never writes the word (PQW-867 acceptance criterion). On input it does not map the word to either stitch silently; it asks which one is meant.

**D2. Rövidpálca / kispálca.** Most sources say they are the same stitch ("ugyanazt jelenti", [S35], [S36]). One search excerpt (`02 §1.8`, seen as a snippet only) lists kispálca as the single crochet and rövidpálca as a separate "short stitch".
*Proposal:* rövidpálca (rp) is canonical, as the prototype already uses it. Kispálca is an accepted alternative on input. **Needs the owner's native confirmation.**

**D3. The "Pálca (p)" label in the prototype.** The stitch is the egyráhajtásos pálca (erp). Neither "pálca" alone nor "p" appears as its name in the Hungarian sources (README §4.5). There are also two clashes. "Pálca" is the family name for rp, fp, erp and krp. "p" is the US abbreviation for picot (`01 §4.4`).
*Proposal:* egyráhajtásos pálca (erp); nagypálca stays an accepted alternative. The owner decides whether a bare "pálca" is accepted on input at all.

**D4. Háromráhajtásos pálca abbreviation.** "hrp" is backed only by one low-reliability search summary [S37].
*Proposal:* write the name out in full until confirmed.

**D5. Case of abbreviations.** Both RP/ERP and rp/erp occur (`01 §3.2`, point 3).
*Proposal:* lower case in output; both cases are accepted on input.

**D6. Fürt (cluster).** The word is used both for "partial stitches in one stitch" (1 → 1) and for "over n stitches" (n → 1) (`01 §4.4`).
*Proposal:* a required field for the base, "same stitch" or "spread over n", never inferred from the name (ticket: *Fürt*).

**D7. Counting pikó and kúszószem.** A picot is usually decorative (0 → 0), but some patterns count it. A slip stitch used for joins is often left out of the count.
*Proposal:* the defaults as in the tables, with a per-pattern toggle (README §4.8).
*Decision on the picot top (2026-09-14):* see §6.

**D8. Names of the compound stitches.** All names marked [T] come from the ticket. None of them could be checked against a Hungarian source.
*Proposal:* the owner confirms or corrects each one and chooses abbreviations, if there should be any.

## 5. Default conventions (owner's answers)

Each of these stays a per-pattern setting. The question is only the default.
Answered by the owner on 2026-09-14.

| # | Question | Options (knowledge base) | Answer |
|---|---|---|---|
| K1 | Does the turning chain count as a stitch? | CYC: rp no, fp no, erp and taller yes (`01 §2.1`, `03 §1.1`) · never, with erp on a ch 2 (`01 §2.2`) · Japanese: fp and taller yes (`01 §3.3`) | **CYC**: rp and fp no, erp and taller yes. Per-pattern setting with a per-row override (README §4.3). **Corrected for rows on 2026-09-15 (PQW-891), see §6:** in rows the turning chain always counts and stands on one base chain; the rule above stays for the starting chain of a round |
| K2 | Joined rounds or a spiral? | by stitch: spiral for rp/amigurumi, joined for erp and motifs (`04 §2`, `§10`) · always joined · always spiral | **By what is being made** (refined on 2026-09-14, see below): amigurumi in a spiral, every other piece worked in rounds in joined rounds, whatever the stitch. The library default follows this since PQW-892 |
| K3 | Symbol for the rövidpálca | + or ×; both are common (`01 §6.1`). The prototype draws + | **+** by default; × stays a user setting |

The disputed points D1–D8 were decided as proposed on 2026-09-14.

## 6. Follow-up decisions (owner, 2026-09-14)

Answers to the two questions the stitch library (PQW-867) left open.

**Round closure (refines K2).**
- Amigurumi is worked in a spiral. Every other piece worked in rounds uses
  joined rounds.
- This holds for the félpálca and the rövidpálca as well. Round closure
  depends on what is being made, not on the stitch.
- Implemented in PQW-892: the library default is a joined round for every
  stitch, and `stitch-default` resolves from the pattern type (amigurumi:
  spiral, everything else: joined; `roundEndFor` in `src/core/rounds.ts`). An
  explicit closure saved in a pattern is kept. The round and amigurumi
  generators already set the closure explicitly, so their output is unchanged.

**Starting a row on a foundation chain (corrects K1 for rows, 2026-09-15, PQW-891).**
- The owner's description for a scarf: about 40 chains, turn the work, skip
  2 chains (one is the base, one stands in for the first rövidpálca so the
  height stays), then 1 rövidpálca into every chain.
- The previous rule (first rp into the 2nd chain, the turning chain not
  counted) was a bug, not a second convention.
- Turning chain length per stitch (owner): rp 1, fp 2, erp 3, krp 4 chains,
  one more per yarn over.
- The coordinator derived the rule for every stitch from this answer: in
  rows the turning chain counts as the first stitch and stands on one base
  chain. The first stitch of row 1 goes into chain `T + 2` from the hook (rp
  3rd, fp 4th, erp 5th, krp 6th); the foundation is `N + T` chains for N
  stitches; the last stitch of every later row goes into the top of the
  previous turning chain.
- The starting chain of a round keeps the K1 default above, and the Japanese
  preset (PQW-876) keeps its own rule.

**Picot (D7).**
- A picot is usually on the last, decorative row, but it may be worked into.
  The program must not warn about it.
- The current behaviour (the picot top is workable) is correct and stays.

## 7. Unit words (owner, 2026-09-14, PQW-872)

The finished crochet unit is a **szem** in Hungarian, as in *láncszem* and
*kúszószem*. The seven Hungarian crochet sites cited in PQW-872 use it that
way ("minden szembe 2 pálca kerül", "a szemszámot ellenőrizd a sor végén"),
and *öltés* hardly occurs there as a unit.

| Hungarian | English | Use |
|---|---|---|
| szem | stitch | "a következő szembe", "ugyanabba a szembe", "2 szem kihagyása", "(15 szem)" |
| szemszám | stitch count | "a szemszám a sor végén" |
| hurok | loop on the hook | Only this meaning: "2 hurok van a horgon"; puff, bobble and decreases |
| első szál / hátsó szál | front loop / back loop | Unchanged (§3) |

- Hungarian output never uses *öltés* for the unit: interface, written
  pattern, legend, validator messages. `tests/hu-vocabulary.test.mjs` guards
  it.
- For the same reason the [T] name *V-öltés* in §2 is now **V-szem**.
- Compounds follow the unit: *alapszem* (basic stitch), *részszem* (a partial
  stitch inside a compound stitch), *szemkönyvtár* (stitch library),
  *szemgráf* (stitch graph).
- *Rákhurok* (crab stitch) is a stitch name, not a loop, and keeps its §2 name.
- Code identifiers (`StitchDef`, `stitchCount`) and English text are unchanged.
