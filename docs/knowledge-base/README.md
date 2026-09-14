# Crochet knowledge base — overview and synthesis

Research for the pattern designer at app.dragonettecrochet.com (Linear PQW-854),
compiled 2026-09-14. The goal is a rule system that lets the designer produce
patterns that can actually be crocheted, row by row or round by round, with
physical dimensions that follow from yarn, hook and the crocheter's own gauge.

The knowledge base is reference knowledge only. The designer has no code or
runtime dependency on any tool, library or paper mentioned in it: every rule,
generator and view is implemented in this repository.

This file is the entry point. It reconciles the six reports, states which
conflicts are real, and lists what has to be decided or measured before the
product is planned. The reports themselves keep every source URL; this file
cites them by report and section (e.g. `02 §3.4`).

| # | Report | Covers |
|---|---|---|
| 01 | [Stitches](01-stitches.md) | Anatomy, heights, turning chains, US/UK/HU/JP terms, consume/produce model, chart symbols, written syntax |
| 02 | [Yarn, hooks, gauge](02-yarn-hook-gauge.md) | CYC weight system, hook conversion, gauge, stitch dimensions, yarn consumption, what must be measured |
| 03 | [Flat rows](03-flat-rows.md) | Foundation/turning chains, shapes in rows, repeats, filet, C2C, tapestry, mosaic, borders, 44 validation checks |
| 04 | [Rounds and amigurumi](04-rounds-amigurumi.md) | Flat circles, staggering, spheres, cones, surfaces of revolution, polygons, AmiGo, cupping/ruffling detection |
| 05 | [Garments, shawls, free-form](05-garments-shawls-freeform.md) | Shawl geometry, CYC body tables, ease, schematic → rows, grading, hats, drape and growth |
| 06 | [Software, models, knowledge capture](06-software-models-knowledge-capture.md) | Competitors, CrochetPARADE and other DSLs, research data models, proposed data model, expert-knowledge protocol |

## Evidence labels

The reports were written in parallel and use slightly different tags. They map
to one scale:

| Meaning | 01 | 02 | 03, 04 | 05 |
|---|---|---|---|---|
| Standard / consensus of several reputable sources | [C] | STANDARD | [CONSENSUS] | [STD] |
| Rule of thumb; varies with crocheter, yarn, hook | [R] | RULE OF THUMB | [RULE OF THUMB] | [RoT] |
| Sources disagree | [X] | CONTESTED | [CONTESTED] | [CONTESTED] |
| Derived by the researcher from cited data; not tested in yarn | [E] | DERIVED | [DERIVED] | [DERIVED] |
| Manufacturer label data / single anecdote | — | MANUFACTURER | — | [ANECDOTE] |

A `DERIVED` value is a hypothesis. Nothing derived may become a hard validation
error until a worked example in real yarn confirms it (see *Knowledge capture*).

---

## 1. The core insight

Every serious source — the research systems (CrochetPARADE, Digital Crochet,
AmiGo, stitch-grapher) and the tech-editor checklists — converges on the same
picture:

1. **Structure is a graph, not a picture.** Each stitch has a *previous* edge
   (the yarn path) and one or more *anchor* edges (what it is worked into).
   Increases are several stitches on one anchor; decreases are one stitch on
   several anchors; chain spaces and rings are special anchor targets. Rows and
   rounds are derived from this, not stored as the primary structure (`06 §4.3`,
   `03 §10`).
2. **Shape is arithmetic on stitch counts.** Whether fabric lies flat, cups,
   ruffles, or forms a sphere, cone or triangle follows from how the stitch
   count changes per row or round, relative to the stitch's height/width ratio
   (`04 §0`, `05 §1.1`, `03 §3.2`).
3. **Dimensions need the crocheter's real gauge.** The formulas are well known
   but "quite sensitive" to real stitch height and width, and row height in
   particular depends on how the individual lifts the loop (`02 §3.6`, `06 §4.2`).
   No program can predict one person's gauge from yarn and hook alone.

No commercial tool models (1). Stitch Fiddle, Chart Minder and Hookchart are
grids; Crochet Charts and the iOS apps place symbols freely (`06 §2`). LLM
generated patterns fail on exactly (1) and (2): CrochetBench reports that
closed models rarely exceed 6% project-level validity (`06 §2.3`). A designer
that validates against a stitch graph and computes geometry from measured gauge
is therefore both technically sound and a real differentiator.

## 2. Model layers (proposal for planning)

This is a synthesis to plan from, not a decision.

| Layer | What it holds | Grounded in |
|---|---|---|
| **Vocabulary** | Data-driven stitch library: names and abbreviations (HU, EN-US, EN-UK, JP), yarn-overs, *consumes → produces*, insertion modes, chart symbols, nominal height, whether the top is workable | `01 §4, §8`, `06 §5.2` |
| **Topology** | The stitch graph: nodes, previous edge, ordered anchors, spaces/rings, layer events (turn, join, spiral, fasten off), pieces and joins | `06 §3.2, §5.2`, `03 §10` |
| **Calibration** | Gauge profiles per crocheter × yarn × hook × stitch × construction mode, each value tagged `measured`, `label` or `estimated` | `02 §8–9`, `06 §6.2` |
| **Geometry** | Layout computed from topology + calibration; strain (too tight/loose); curvature per round; finished size; yarn estimate | `04 §9.6`, `06 §5.3`, `02 §6` |
| **Generators** | Rectangles/triangles in rows, circles/spheres/cones/lathe profiles, polygons and motifs, filet/C2C/tapestry/mosaic grids, shawl shapes, garment schematic → row plan, grading | `03 §3–8`, `04 §9`, `05 §9` |
| **Validation** | ERROR (uncrochetable/inconsistent) and WARN (crochetable but likely unintended) rules, each with provenance | `03 §10`, `04 §9.6`, `06 §5.3` |
| **Views** | Symbol chart (CYC or JIS, RS-appearance semantics, left-hand mirror), written instructions HU/EN with round-trip parsing, schematic, yardage | `01 §6–7`, `06 §5.3` |
| **Rule register** | Every rule with statement, scope, kind, rationale, provenance, confidence, worked-example tests, status | `06 §6.2` phase 5 |

The chart stays a *view*. Manual nudging of a symbol for a nicer chart must not
change what the stitch is worked into.

## 3. Construction modes

Each mode needs different generators and validators. Difficulty is the
researchers' estimate of how hard it is to generate *correct* output.

| Mode | Examples | Key rules | Difficulty |
|---|---|---|---|
| Flat rows, constant width | Scarf, blanket, rectangle panels | Foundation chain formula, turning chain convention, last-stitch placement, repeat multiples | Low |
| Flat rows, shaped | Triangle, trapezoid, diamond, sleeve taper, neckline | Edge-angle formula, even-difference symmetry, Bresenham distribution, max shaping per edge per row | Medium |
| Stitch patterns / lace | Shells, V-stitch, chevron, waves | Consume = produce per repeat, reach rule, chain spaces as single anchors, height compensation | Medium |
| Grid techniques | Filet, C2C, tapestry, graphgan, mosaic | Aspect ratio from gauge, 3N+1 filet width, W+H−1 C2C diagonals, multi-row anchors for mosaic only | Medium |
| Flat rounds and motifs | Coasters, mandalas, granny squares, hexagons | Δ_flat = 2π·h/w, staggering, polygon corner stacking, +4k per granny round | Medium |
| 3D in the round | Amigurumi, hats, bags, baskets | 6n ball vs sine sphere, cones, lathe profiles, BLO edges, curvature diagnostics, max doubling/halving per round | Medium–high |
| Shawls | Triangle, crescent, semicircle, Pi | Increase rate ∝ h/w, designer-intent override, blocked gauge for lace | Medium |
| Garments | Drop shoulder → raglan → yoke → set-in sleeve | Body tables + ease, stitch multiples with fit-intent rounding, slope distribution, section targets on yokes, mirroring, grading checks | High |
| Free-form | Scrumbles | Not generated row by row; at most layout, coverage and filler suggestions | Out of scope for generation |
| Tunisian | — | Separate model: no turning, forward + return pass | Separate mode |

## 4. Reconciled conflicts

These are the places where sources genuinely disagree. Each has a proposed
handling; none is final until the owner decides and the swatches are in.

### 4.1 Stitch height: chain scale vs millimetres

Your working knowledge (sl st ≈ 0, sc ≈ 1, hdc ≈ 2, dc ≈ 3) is **correct as the
chain-equivalent convention** — it is what turning chains and chart symbols use
(`01 §2.1`). It is not a physical ratio. Measured and taught ratios, with sc row
height = 1:

| Source | hdc | dc | tr |
|---|---|---|---|
| Chain-equivalent convention (`01 §2.1`) | 2 | 3 | 4 |
| Measured mm, worsted, 5 mm hook (`01 §2.3`) | ≈1.6 | ≈2.6 | ≈3.9 |
| Hungarian teaching sources (`01 §3.2`, `02 §3.4`) | ≈1.5 | 2 | 3 |
| Label/swatch example, 14 dc × 7 rows (`02 §3.4`) | — | ≈2.5 | — |
| Default suggested in `03 §2.2` | 1.6 | 2.4 | 3.2 |

**Handling:** keep two separate properties per stitch — `chainHeight` (integer,
for turning chains and symbols) and `heightFactor` (physical, relative to sc).
Default `heightFactor` until calibrated: hdc 1.5, dc 2.4, tr 3.2, flagged as an
estimate. Replace with measured values per profile.

### 4.2 Stitch width and aspect ratio

- Stitch width is roughly the same for sc, hdc and dc in the same yarn and hook;
  what changes is row height (`01 §2.3`, `02 §3.4`).
- From CYC data, sc width ≈ 1.41 × hook diameter, and sc per 4 in ≈ 72 ÷ hook mm
  for weights 1–5 (`02 §3.4`, derived).
- Flat row swatches give sc height/width ≈ 0.8 (`02 §3.4`). But a flat sc
  circle needs 6–8 increases per round, which implies an *effective* h/w of
  ≈ 1.0–1.2 (`04 §1.2`, `05 §1.1`).
- Stitchsums publishes an aspect table that contradicts itself (`01 §2.3`, `03 §5.1`).

**Handling:** gauge must be measured **in the construction mode it will be used
for** — a flat swatch for rows, a tube or flat circle for rounds (Kekkonen,
`06 §4.2`; amigurumi 5-round circle, `04 §5.1`). Never hard-code 6/8/12; compute
Δ_flat from the round gauge and round to a "nice" number.

### 4.3 Does the turning chain count as a stitch?

sc: never. dc and taller: usually yes (CYC). hdc: US often no, Japanese yes. Many
modern designers use a non-counting ch 2 for dc, or stacked sc / standing
stitches (`01 §2.2`, `03 §1`).

**Handling:** explicit per-pattern setting with a per-row override. It changes
the foundation chain by one (`N + T` vs `N + T − 1`) and decides where the last
stitch of the next row goes. Never assume silently.

### 4.4 "Multiple of X + Y"

Whether Y already includes the turning chain varies by designer (`03 §4.1`).
**Handling:** store `repeatWidth`, `edgeStitches` and `turningChainIncluded`
explicitly; always show both the chain count and the Row 1 stitch count.

### 4.5 Hungarian terminology

- *Hamispálca* means slip stitch in some sources and half double in others;
  avoid emitting it (`01 §3.2`).
- *Rövidpálca* and *kispálca* are the same stitch in most sources; one search
  result treated them as different (`02 §1.8`). Needs native confirmation.
- dc is *egyráhajtásos pálca (erp)*, tr is *kétráhajtásos pálca (krp)*.
- The current prototype labels dc as "Pálca (p)". That abbreviation does not
  appear in the Hungarian sources found; the glossary ticket PQW-847 should fix
  the canonical set.

### 4.6 Sphere even rounds

A 6k ball: k+1 even rounds (Supergurumi), k (Pulled Stitch), 3–4 (others), 1
(FiberTools). For square stitches, k+1 matches the true meridian length
(`04 §4.3`, derived). **Handling:** offer both the 6n schedule and the sine
schedule; compute even rounds from the round gauge.

### 4.7 Theory vs practice in shawl and semicircle increase rates

Published crochet shawls often use rates 30–50% away from the geometric ideal
and rely on blocking (`05 §1.2, §1.4`). **Handling:** compute the theoretical
rate, let the designer choose a stylised rate, preview the resulting angle and
flag the deviation as WARN, not ERROR.

### 4.8 Smaller contested points

| Point | Positions | Handling |
|---|---|---|
| Border sc per hdc row end | 1 or 2 (`03 §7.1`) | Configurable |
| Picot in stitch count | Usually not counted (`01 §4.4`) | Toggle |
| "Cluster" | In one stitch (1→1) or across N (N→1) (`01 §4.4`) | Require explicit `base` field |
| sc symbol | + or × (`01 §6.1`) | User preference |
| Left-handed round direction | One source reverses the wording (`01 §6.3`) | Mirror mode; follow the majority |
| Lace blocking growth | Not quantified anywhere (`02 §3.7`, `05 §1.8`) | Measure blocked gauge |
| Negative ease in crochet | 5–10%, ribbing up to 15% (`05 §3.5`) | Cap with WARN |
| CYC body tables | Some rows look copy-pasted (`05 §3.1–3.2`) | Store with validation flags |

## 5. Validation catalogue (consolidated)

Full lists: `03 §10` (44 rules for rows), `04 §9.6` (rounds), `06 §5.3` item 7.
The groups below are the planning-level summary.

**Structure (ERROR)**
- No anchor points to a stitch made later in yarn order; one yarn path per
  segment (`06` V1–V2).
- Every stitch of the previous row is worked exactly once, part of exactly one
  decrease, bridged by a chain, or explicitly left unworked (`03` B8).
- Several stitches on one anchor must be a declared increase/shell; several
  anchors on one stitch must be a declared decrease/cluster (`03` C14).
- Anchors move monotonically along the working direction, except explicitly
  flagged crossed/post stitches (`03` C13).
- Reach: a gap of two or more skipped positions must be bridged by chains or a
  fan (`03` C15).
- Multi-row anchors only for spike/mosaic/drop stitches, into stitches left
  unworked in between (`03` C17).
- Chains start at a live stitch and are consumed or bridged (`03` C18).
- Stitches with non-workable tops (crab stitch) are not worked into (`01 §8` rule 10).

**Counts (ERROR)**
- Stated count = computed count on every row/round (`03` B7, `06` V3).
- Foundation chain and turning chain convention consistent (`03` A1–A6).
- Repeats balance: consumed = produced per repeat; ripple peaks = valleys (`03` E22–E24).
- Joined pieces have matching edge counts or an explicit distribution (`03` H40, `06` V6).
- Round-to-round change within one doubling or halving (`04 §9.0`).

**Shape (WARN)**
- Cupping: Δ/Δ_flat < ≈0.85 for two or more rounds; ruffling: > ≈1.3 (`04 §8`).
- Stacked increases on three or more rounds → polygon look; suggest staggering (`04 §9.6`).
- Mixed stitch heights not compensated within 1–3 rows → scalloped edge (`03` D19).
- Asymmetric count changes in a shape meant to be symmetric (`03` F28).
- More than about 2 shaping stitches per edge per row (`03` F27, `05 §9.3`).
- Pixel charts drawn on square cells instead of the gauge aspect ratio (`03` G31).

**Presentation and safety (WARN)**
- Terminology declared; every abbreviation in the key; no mixed dialects (`01 §8` rule 24, `06` V10).
- WS rows: post and loop stitches translated from RS-appearance symbols (`01 §8` rule 21).
- Colour change emitted on the last yarn-over of the previous stitch (`03` G35).
- Toys for under 36 months: no safety eyes or beads; suggest embroidery (`04 §5.7`).

## 6. What must be measured

These cannot be derived from a yarn label and hook (`02 §9`, `04 §5.1`, `05 §7`):

1. Stitch gauge in the actual stitch, from a blocked swatch of at least 15 cm, measured in the centre.
2. Row gauge **per stitch type** — the least predictable number in crochet.
3. Round gauge for circles and amigurumi, from a tube or 5-round circle.
4. Blocked vs unblocked dimensions; for lace, always blocked.
5. Hung (and optionally weighted) growth for garments.
6. Swatch mass over a known area — the only reliable yarn-per-area figure.
7. Foundation chain length vs stitch width.
8. The real hook diameter in mm (steel and vintage numbers differ by brand).
9. Colourwork gauge, if used.
10. A second measurement elsewhere on the swatch, to see tension drift.

Until measured, every derived dimension is shown as an estimate with a range.

## 7. Knowledge capture — turning empirical skill into rules

Proposed protocol (`06 §6.2`), based on Cognitive Task Analysis, craft-video
elicitation and the pattern-tester workflow the industry already uses:

| Phase | What happens | Output |
|---|---|---|
| 0 Vocabulary workshop | Walk through CYC/JIS symbols and HU terms; decide names, aliases, recipes, conventions | Reviewed stitch library |
| 1 Interviews | Critical Decision Method: "a pattern that didn't come out as written — what did you notice, what did you change?" | Candidate rules |
| 2 Think-aloud video | Crochet from a published pattern, a generated pattern and a chart while speaking | Event log; clarity fixes vs domain rules |
| 3 Swatch dataset | Minimum matrix: 3 yarns × 2 hooks × 9 stitch variants = 54 swatches, flat and tube, measured and photographed | Calibration profiles |
| 4 Worked examples | Small diagnostic pieces from generated patterns (discs, spheres, cylinders, motifs, a deliberately mismatched join); predicted vs measured | Calibration updates, new rules, regression tests |
| 5 Rule register | Each rule with provenance, confidence, tests and status; monthly review | Active rule set |
| 6 Tester loop | Tech-edit checklist, then external testers with a structured feedback form | Broader calibration beyond one pair of hands |

Estimated effort for phases 3–4: about 20–25 hours of crocheting for the swatch
matrix, plus 15–30 small worked examples.

## 8. Known gaps

- DROPS/Garnstudio yarn groups, Interweave's yarn-consumption and filet-shaping pages (blocked).
- No measured tables of yarn length per stitch type; `02 §6.4` is a derived model (±30%).
- No quantified lace blocking growth.
- Garment yardage by size and weight.
- Japanese hook sizes; exact US toy tension-test values; the EN 71 50 N small-part figure.
- The CYC symbol PDF could not be machine-read; symbol shapes come from secondary guides.
- Hungarian terminology beyond the basic stitches (post stitches, tr and taller) is thinly sourced.

## 9. Open questions for the product owner

To settle during planning. Grouped by what they unblock.

**Scope**
1. Which construction modes go into the first release (§3)? Which later, which never?
2. Is the product a *chart editor with validation*, a *pattern generator from shapes and measurements*, or both — and in which order?
3. Garments: in scope at all? If yes, starting with drop shoulder?
4. Is a 3D preview a first-release differentiator or later?

**Conventions**
5. Canonical Hungarian vocabulary and abbreviations, plus accepted aliases (PQW-847).
6. Output languages: HU and EN-US only, or EN-UK too?
7. Default chart standard: CYC or JIS style? sc as + or ×?
8. Default turning-chain convention and round closure (joined vs spiral) — per pattern or per user?

**Editing philosophy**
9. Free placement with validation, or layout computed from the graph with manual nudges?
10. Import of other designers' written patterns: needed, or only round-trip of our own output?

**Calibration and knowledge capture**
11. Whose gauge drives the geometry: yours only, or each user's own profile?
12. Time and yarn budget for the swatch matrix and worked examples.
13. Should the product host the pattern-testing workflow (tester mode)?

**Risk and integrations**
14. Any use of language models, and if so only behind the validator?
15. Ravelry integration: a goal or not?