# 03 — Flat Crochet Worked in Rows: Construction Rules for a Pattern Designer

Research compiled 2026-09-14 for a stitch-chart editor that must emit realistic, row-by-row crochetable patterns with correct stitch counts. US terminology throughout (sc, hdc, dc, tr).

**Evidence labels used in this document**

- **[CONSENSUS]**: stated the same way by several independent reputable sources (Craft Yarn Council, several established designers or teaching sites).
- **[RULE OF THUMB]**: a common heuristic that depends on tension, yarn or designer habit.
- **[CONTESTED]**: sources disagree, or one source contradicts itself.
- **[DERIVED]**: my own arithmetic or geometry built on sourced facts. It is not a quote, but you can check it against the cited premises.

A numbered source list is at the end. Inline citations use `[S#]` plus the URL the first time a source appears in a section.

---

## Table of contents

1. Foundation chains, turning chains and edges
2. Rows: turning, RS/WS, chart direction, row height, mixed stitch heights
3. Regular shapes in rows (gauge math, triangles, trapezoids, diamonds, circles, even distribution)
4. Stitch patterns and repeats ("multiple of X + Y", balance, chain spaces, chart repeats)
5. Grid-based techniques (filet, tapestry, graphgan, C2C, mosaic, aspect ratio)
6. Colorwork in rows
7. Edges, borders and seaming
8. Granny squares and motifs in rounds (corner math)
9. Common mistakes that make a chart uncrochetable
10. **Encodable rules / validation checks**
11. Sources

---

## 1. Foundation chains, turning chains and edges

### 1.1 Turning-chain height per stitch

| Stitch | Turning chain (standard) | Counts as a stitch? (traditional default) | First stitch of Row 1 goes into… |
|---|---|---|---|
| sc | ch 1 | **No** | 2nd ch from hook |
| hdc | ch 2 | Varies (often **no**) | 3rd ch from hook |
| dc | ch 3 | **Yes** (CYC default) | 4th ch from hook (the 3 skipped ch = 1st dc) |
| tr | ch 4 | **Yes** (CYC default) | 5th ch from hook |
| dtr | ch 5 | Varies | 6th ch from hook |

- **[CONSENSUS]** sc uses ch 1, hdc ch 2, dc ch 3, tr ch 4. Sources: CYC [S1] https://www.craftyarncouncil.com/standards/how-to-read-crochet-pattern; B.hooked [S12] https://bhookedcrochet.com/2016/04/05/crochet-straight-edges/; Sweet Bee [S13] https://sweetbeecrochet.com/turning-chains/; American Crochet Association [S14] https://americancrochetassociation.blog/how-to-count-crochet-stitches/.
- **[CONSENSUS]** The CYC says the sc turning ch-1 is never counted as a stitch. It also says: "On all stitches taller than a single crochet, the turning chain is counted as the first stitch of the row" unless the pattern says otherwise [S1]. For dc, the CYC works "into the 4th chain from the hook, skipping the first 3 chains", which count as the first dc [S1], [S2] https://www.craftyarncouncil.com/mar06_dc.html.
- **[CONTESTED]** Whether hdc/dc turning chains count is a designer choice. B.hooked lists hdc, dc, tr and dtr as "Variable" [S12]. Sweet Bee separates non-counting "turning chains" from counting "beginning chains". Its designer often uses **ch 2 for a dc row** to shrink the edge gap, and notes that "each designer has their own style" [S13]. The ACA says: always check the pattern notes, e.g. "Ch 3 (does not count as a stitch, here and throughout)" [S14].
- **[RULE OF THUMB]** Some designers shorten the turning chain to suit their tension (for example ch 2 for dc) when the standard chain makes a bumpy, too-tall edge [S12], [S13].

### 1.2 Foundation chain formula

**[CONSENSUS]** Foundation chain = number of stitches wanted + turning-chain allowance. The slip knot is never counted [S1].

- Stitchsums [S15] https://www.stitchsums.com/articles/crochet-pattern-math: sc +1, hdc +2, dc +3, tr +4. Example: "a 100-stitch double crochet project starts with a 103-chain foundation, and the first dc is worked into the 4th chain from the hook."
- **[DERIVED] Watch the off-by-one.** The +3 formula only gives exactly 100 dc if the 3 skipped chains **do not** count as a stitch. If they **do** count (CYC convention), 103 chains give 1 (skipped ch) + 100 dc = **101 stitches**. So:
  - Turning chain does **not** count: `chains = N + T`, first stitch in chain `T+1` from hook, row has N stitches.
  - Turning chain **counts**: `chains = N + T − 1`, first real stitch in chain `T+1` from hook, row has N stitches including the skipped chains.
  - T = 1 (sc), 2 (hdc), 3 (dc), 4 (tr). sc is effectively always the first case.
  - The editor must store a per-row flag `turningChainCountsAsStitch` and compute counts from it. It must never assume one convention silently.
- Stitch-pattern chains are different. "Multiple of X + Y" may or may not already include the turning chain (see §4.1).

### 1.3 Where the last stitch of the row goes

**[CONSENSUS]** The placement depends on the counting convention [S12], [S13], [S16] https://www.ilikecrochet.com/magazine/crochet-articles-and-interviews/crochet-corner/stitch-markers/:

| Convention | First stitch of new row | Last stitch of new row |
|---|---|---|
| Turning chain **counts** | Skip the first stitch at the base (the turning chain stands in for it); work the first real stitch into the **2nd** stitch | Into the **top of the previous row's turning chain** |
| Turning chain **does not count** | Into the **first** stitch (the one at the base of the turning chain) | Into the **last real stitch** of the previous row; ignore the old turning chain |

- **[CONSENSUS]** Growing and shrinking edges come from breaking these rules. Every stitch you miss narrows the piece; every stitch you add widens it. Missing the stitch into the top of a counted turning chain is the classic cause [S12], [S17] https://www.allfreecrochet.com/Tips-for-Crochet/Crochet-Tips-for-Beginners-How-to-Stop-Crochet-From-Getting-Smaller. B.hooked diagnoses the symptoms like this: a slanted edge means a stitch is gained or lost consistently every row; an isolated bump or dip is a one-off error; a generally bumpy edge means the turning chains are taller than the stitches [S12].
- **[RULE OF THUMB]** Put a stitch marker in the turning chain so the last stitch of the next row is easy to find [S16].

### 1.4 Edge gaps and modern alternatives

- **[CONSENSUS]** On dc fabric, "a chain 3 … counted as the first double crochet" leaves **gaps** at the edges. A ch 2 that doesn't count makes **wavy** edges [S18] https://hearthookhome.com/stacked-single-crochet-for-gapless-double-crochet-row-ends/, [S19] https://www.ourdailycraft.com/2024/02/06/crochet-straight-edges/.
- **Stacked single crochet ("stacked dc", chainless start)** [S18], [S20] https://mallooknits.com/chainless-starting-double-crochet/: turn without chaining, sc in the first stitch, then sc into the left leg of that sc. Two stacked sc are about one dc tall.
  - **[CONTESTED] Does it count as a stitch?** Heart Hook Home treats it as the substitute **first dc** that counts. On the next row you work into its top as normal [S18]. My fetched summary of the Mallooknits tutorial described it as *not* counting [S20]. The underlying structure supports counting it, because it sits in the first stitch and has a top that is worked into. **Treat it as a configurable flag. The default is "counts as first stitch".**
  - Heart Hook Home does not use it when a row starts with a decrease (dc2tog). There it uses ch 2 plus a normal decrease [S18].
  - Height equivalents [RULE OF THUMB]: 2 stacked sc ≈ ch 2 or hdc, 3 stacked sc ≈ ch 3 or dc [S21] https://stitchandhound.com/blog/crochet-stitch-height-chart.
- **Extended first stitch**: work an extended version of the stitch into the first stitch, then work the last stitch of the next row into its top [S17].
- **Foundation stitches (fsc, fhdc, fdc)** make the chain and the first row in one pass. The edge is stretchier and neater, and counting is easier [S22] https://blog.treasurie.com/foundation-single-crochet/, [S23] https://www.craftsy.com/post/foundation-single-crochet-how-to. **[CONSENSUS] Conversion rule:** base the number of foundation stitches on the pattern's *stitch count*, not its chain count. "ch 26, sc in 2nd ch from hook" (25 sc) becomes **25 fsc**. The fsc row *is* Row 1 [S22], [S23].

---

## 2. Rows: turning, RS/WS, chart direction, row height

### 2.1 Direction and sides

- **[CONSENSUS]** Row charts are read **bottom to top**. For a right-handed crocheter, Row 1 goes **right to left**, Row 2 left to right, and so on in a boustrophedon ("snake") [S24] https://www.yarnspirations.com/blogs/how-to/how-to-read-crochet-chart-symbols, [S25] https://yourcrochet.com/how-to/how-to-read-and-write-crochet-diagrams/, [S26] https://learn.crochetpop.app/learn/filet-crochet.
- **[CONSENSUS]** Row numbers are placed on the side where that row **starts**. The turning chain is drawn at the start of each row. RS rows are often drawn in one color (black) and WS rows in another (blue or red). Some charts number only the RS rows [S24], [S25].
- **[CONSENSUS]** "Each symbol represents a stitch as it looks on the right side of the work" (CYC) [S27] https://www.craftyarncouncil.com/standards/crochet-chart-symbols.
- **[CONSENSUS]** Left-handers read odd rows left to right and even rows right to left, or mirror the chart. Asymmetric colorwork comes out mirrored [S28] https://doradoes.co.uk/2022/06/07/the-truth-about-left-handed-crochet-the-differences-for-left-handed-crocheters/, [S29] https://www.yarnspirations.com/blogs/how-to/ultimate-guide-to-left-handed-crochet.
- **[DERIVED]** Because symbols show the RS view, a "back loop only" symbol drawn on a WS row is physically worked through the loop that is the *front* loop from the worker's point of view. The editor should convert loop instructions when it generates written text for WS rows. (Inference from the CYC RS convention [S27]; verify against your symbol set.)
- **[CONSENSUS]** Rows lean alternately. Single crochet has a slight slant, and turning every row cancels it, while continuous rounds drift [S30] https://sarahmaker.com/tapestry-crochet/, [S31] https://www.interweave.com/article/crochet/single-crochet-tapestry-crochet/. So flat, turned work keeps vertical color lines straighter than spiral rounds.

### 2.2 Row height and relative stitch heights

- **[CONSENSUS]** Taller stitches have more yarn-overs. The turning chain matches the height of the row's stitch [S21], [S14].
- **[CONTESTED] Height ratios** (useful for the editor's default drawing scale):
  - dc is "a bit more than twice as tall as" sc, and hdc is in between. Sample measurements: sc ≈ 6–8 mm, hdc ≈ 10–12 mm, dc ≈ 16–20 mm, tr ≈ 24–30 mm. 10 rows of sc ≈ 3 in, 10 rows of dc ≈ 7 in [S21].
  - Stitchsums: "a treble climbs ~2.5× as fast as a single crochet" [S15]. The mm figures in [S21] suggest about 3.75×.
  - **Recommendation:** default heights sc = 1, hdc = 1.6, dc = 2.4, tr = 3.2 (in sc units), but let the user override them from their measured row gauge.
- **[DERIVED]** A row's effective height is set by its tallest stitch when all stitches share a baseline. Shorter stitches leave a "valley" that the *next* row must fill with taller stitches (see §2.3), or the fabric's top edge stays scalloped.

### 2.3 Mixing heights in a row: waves, and compensating with chains

- **[CONSENSUS]** Mixing heights in one row makes the top edge undulate. Wave patterns stay flat because the next wave row puts **tall stitches over short ones** ("the tallest stitch, the treble crochet, is worked into the shortest stitch, the single crochet") [S32] https://blog.treasurie.com/crochet-wave-stitch/, [S33] https://hearthookhome.com/how-to-crochet-the-wave-stitch/.
- Worked wave example (Treasurie, via search excerpt [S32]):
  - Row 1: sc in 2nd ch from hook, sc in next ch, *hdc, dc, tr, tr, dc, hdc, sc, sc*; rep across.
  - Row 2: ch 1 (does not count), sc in each st across.
  - Row 3: ch 4 (counts as tr), tr in next, *dc, hdc, sc, sc, hdc, dc, tr, tr*; rep. This is the inverse height profile over the same positions.
  - **[DERIVED] Count check:** a repeat is 8 stitches plus 2 edge sc, so N = 8n + 2 and chain = 8n + 3. Each row makes exactly one stitch per stitch below, so the count stays constant. Only the heights change.
- Heart Hook Home version: multiple of 16 + 2, an 8-row repeat. Wave rows 1 and 8 go short→tall→short. Rows 2, 3, 6 and 7 are sc. Rows 4 and 5 are inverted. "Check that each Treble Crochet stitch is positioned directly above a Single Crochet stitch from two rows below" [S33].
- **[CONSENSUS]** Chains keep a row level wherever a stitch is skipped or a valley would form:
  - Mosaic: when you skip stitches, chain *(number skipped + 1)* by one source's convention [S34] https://www.crochet.com/learning-center/mosaic-crochet (search excerpt).
  - Filet: ch 2 bridges 2 skipped stitches [S26].
  - Short rows: graduate the heights (sc→hdc→dc … dc→hdc→sc) at the row ends to hide the "steps" [S35] https://doradoes.co.uk/2023/09/20/crochet-short-rows-what-they-are-when-and-how-to-use-them/.

---

## 3. Regular shapes in rows

### 3.1 Gauge → stitch and row counts

- **[CONSENSUS]** Measure gauge on a blocked swatch, counting stitches and rows over 4 in / 10 cm. Stitchsums adds a crochet-specific tip: read the row gauge at the top, middle and bottom, and use the middle if they differ [S15].
- CYC reference gauges, **sc over 4 in** (guidelines only) [S36] https://www.craftyarncouncil.com/standards/yarn-weight-system:

| CYC cat. | Name | sc per 4 in | Hook (mm) |
|---|---|---|---|
| 0 | Lace | 32–42 **dc** | steel 1.4–1.6 / 2.25 |
| 1 | Super fine | 21–32 | 2.25–3.5 |
| 2 | Fine | 16–20 | 3.5–4.5 |
| 3 | Light | 12–17 | 4.5–5.5 |
| 4 | Medium | 11–14 | 5.5–6.5 |
| 5 | Bulky | 8–11 | 6.5–9 |
| 6 | Super bulky | 7–9 | 9–15 |
| 7 | Jumbo | ≤6 | ≥15 |

Formulas **[DERIVED]**:
- `stitches = round(width_cm × stitchGauge_per10cm / 10)`
- `rows = round(height_cm × rowGauge_per10cm / 10)`
- Then round the stitch count to the stitch pattern's multiple (§4.1).

**Worked example A: 10 cm × 20 cm rectangle in hdc**, gauge 15 hdc × 11 rows = 10 cm (hypothetical; within category 4 ranges).

1. Stitches: 10 × 15/10 = **15 hdc**.
2. Rows: 20 × 11/10 = **22 rows**.
3. Foundation, turning chain **not** counted: ch 15 + 2 = **17**. Hdc in the 3rd ch from hook, then 1 hdc in each ch. 17 − 2 = 15 hdc.
   - Alternative, ch-2 **counts**: ch 16, hdc in 3rd ch from hook. That gives 1 (skipped ch) + 14 = 15.
4. Rows 2–22: ch 2 (doesn't count), turn, hdc in first st and each st across = 15 hdc. The last hdc goes in the last real hdc, not the turning chain.
5. Validation: every row = 15. The foundation is consumed exactly: 15 anchors on 15 chains.

**Worked example B: the same rectangle in dc with a stacked-sc start**, gauge 16 dc × 8 rows = 10 cm.

1. 16 stitches, 16 rows.
2. Ch 18 (16 + 3 − 1, treating the ch-3 as a counting first dc). Dc in the 4th ch from hook and each ch across: 1 + 15 = 16.
3. Rows 2–16: turn, stacked sc in the first st (counts as dc), dc in each of the next 14 sts, dc in the top of the turning ch / stacked sc = 16.

### 3.2 Increase/decrease rate → edge angle (triangles, trapezoids)

**Sourced heuristics**

- **[CONSENSUS]** Triangles in rows are either started at the point and increased, or started at the base and decreased. Shaping is done at one edge (right triangle) or both edges (isosceles) [S37] https://innerchildcrochet.com/resources/how_to_design/triangles_rows.html, [S38] https://www.handylittleme.com/how-to-crochet-a-triangle/.
- **[RULE OF THUMB]** In sc, shaping at both edges **every other row** is the "standard" triangle. Every row gives a shorter, blunter triangle; every 3rd row or less gives a narrower, pointier one [S37]. The angle also depends on stitch height [S38].
- **[RULE OF THUMB, knitting, not directly transferable]** For top-down knit triangle shawls, increasing at both edges every other row gives about 90° at the point, and every row gives about 130° [S39] (search excerpt from https://www.interweave.com/article/knitting/knitters-geometry-triangular-shawls/ — page returned 403, so this was not fully verified).

**Geometry [DERIVED]** (applies to any stitch once you have gauge)

- Stitch width `w = 10 / stitchGauge` (cm per stitch).
- Row height `h = 10 / rowGauge` (cm per row).
- Adding `a` stitches at one edge every `k` rows moves the edge `a·w` sideways for every `k·h` of height.
- Edge angle from vertical: `θ = atan( (a·w) / (k·h) )`.
- To hit a target angle θ: `a/k = tan(θ) · h / w`.

Worked numbers (computed):

| Fabric (gauge /10 cm) | 1 st every row | 1 st every 2 rows | 1 st every 3 rows | 2 sts every row |
|---|---|---|---|---|
| sc 16 st × 18 rows | 48.4° | 29.4° | 20.6° | 66.0° |
| hdc 15 st × 11 rows | 36.3° | 20.1° | 13.7° | 55.7° |
| dc 16 st × 8 rows | 26.6° | 14.0° | 9.5° | **45.0°** |

Consequences:
1. An isosceles triangle's apex angle is 2θ. In sc, shaping 1 st per edge every row gives about a 97° apex. In dc it gives about 53°, and dc needs 2 sts per edge per row to reach a 90° apex. This fits the sourced claim that angles depend on stitch height [S38].
2. **A right triangle with a 45° hypotenuse** needs `a/k = h/w`. For sc 16×18 that is 0.889 sts per row, i.e. about 8 increases every 9 rows, distributed with the algorithm in §3.4.

**Worked example C: right triangle, base 15 cm × height 20 cm, sc 16 × 18.**

1. Base = 24 sts, height = 36 rows.
2. Work from the base up: shrink from 24 sts to 1 st over 35 row transitions, so 23 decreases over 35 rows (one edge only).
3. Rate 23/35 ≈ 0.657. Spread the 23 decrease rows over the 35 transitions (§3.4). Decreases never exceed 1 per row, so an ordinary edge sc2tog works.

**Worked example D: isosceles triangle, base 20 cm × height 15 cm, dc 16 × 8.**

1. 32 sts, 12 rows.
2. The linear target shrinks 32→2 over 11 transitions: counts 32, 29, 27, 24, 21, 18, 16, 13, 10, 7, 5, 2.
3. The differences come out 3 or 2. An **odd difference can't be split evenly between two edges**. Either alternate which edge takes the extra decrease, or round the targets so each row changes by an even number (e.g. 32, 28, 26, 22, 20, 16, 14, 10, 8, 4, 2 — rows of 4 and 2). **Symmetric shapes need even row-to-row differences.**
4. Decreasing 2 per edge in one dc row = dc3tog at each edge, or skip/slip-stitch the edge stitches and start with a shorter turning chain.

**Trapezoid:** a rectangle core with edge shaping at the angle rate above. It keeps a minimum stitch count > 0.

**Diamond:** increase to the widest row, then decrease at the same rate. **[DERIVED]** In the increase half the widest row happens once; in mirror-symmetric designs repeat it only if the chart calls for it.

**Sleeve-style distribution of shaping rows** (Dora Does [S40] https://doradoes.co.uk/2022/03/31/how-to-work-out-sleeve-shaping-for-crochet-garments/):
- Gauge 1.8 st/cm, 1.2 rows/cm. Upper arm 64 sts, wrist 44 sts, length 60 rows.
- Decrease 20 sts at 2 per row = 10 decrease rows. 60 ÷ 10 = 6, so "one decrease row every 6 rows … 10 times in total".

### 3.3 Circles, ovals and curves in rows

- **[CONSENSUS]** True circles are normally worked in rounds. Ovals start from a chain with increases at the two ends [S41] https://bhookedcrochet.com/2017/07/02/crochet-oval/. Short rows give curves and crescents inside flat fabric [S35].
- **[CONSENSUS]** Ruffling means too many stitches for the perimeter; cupping or curling means too few [S42] https://sarahmaker.com/crochet-flat-circle/.
- **[DERIVED] Circle approximated in rows** (diameter 10 cm, sc 16×18): sample each row at its vertical centre. The row width is `2·√(R² − y²)`, divided by w.

  Row counts: 5, 9, 11, 13, 14, 15, 15, 16, 16, 16, 16, 15, 15, 14, 13, 11, 9, 5 (18 rows).
  Differences: +4, +2, +2, +1, +1, 0, +1, 0, 0, 0, −1, 0, −1, −1, −2, −2, −4.

  Practical rules that follow:
  - Near the poles the width jumps by 4 per row, i.e. **2 per edge**. In sc that needs a 3-in-1 at each edge, or a chain extension at the row start plus 2 stitches added at the row end. Going beyond 2 per edge per row usually means **extending with chains/foundation stitches** at the row start and working extra stitches at the end, not stacking increases.
  - Odd differences (+1) mean the shaping alternates between left and right edges, or the counts are re-rounded to even steps.
  - Row-based circles look **stepped**. The editor should warn that rounds give a smoother result.

### 3.4 Even distribution ("evenly spaced") = Bresenham

Sourced formulas:
- **[CONSENSUS]** interval ≈ total stitches ÷ number of increases. 30 sts with 6 increases gives *(4 sc, 2 sc in next) ×6* → 36 [S43] https://www.knitpro.eu/en/blog/how-to-increase-crochet-stitches, [S44] https://blog.lionbrand.com/how-to-evenly-space-your-increasesdecreases/.
- Dora Does, **increases**: `(sts after ÷ number of increases) − 2 = sts between increases`. 20→24: 24/4 = 6, 6 − 2 = 4.
- Dora Does, **decreases**: `(sts before ÷ number of decreases) − 2 = sts between decreases`. 24→18: 24/6 = 4, 4 − 2 = 2. Remainders go at the row edges [S45] https://doradoes.co.uk/2021/01/16/how-to-evenly-space-increases-and-decreases-in-crochet/.
- **[RULE OF THUMB]** When the division isn't whole, alternate between the two nearest intervals (e.g. 23 and 24) [S46] https://www.garnstudio.com/lesson.php?id=28&cid=19 (via search excerpt).

**[DERIVED] Unit balance behind these formulas**
- Increase unit = *(p plain, 2-in-1)*: **consumes p+1, produces p+2**.
- Decrease unit = *(p plain, 2tog)*: **consumes p+2, produces p+1**.
- Check: Dora's 20→24 uses p = 4: 4 units × 5 consumed = 20, 4 × 6 produced = 24. ✓

**[DERIVED] Algorithm (Bresenham-style, symmetric):**
- Across a row of N sts with I single increases, put the increases on stitch indices (1-based) `floor((i + 0.5) · N / I) + 1` for i = 0..I−1.
- Example N = 40, I = 7 → stitches 3, 9, 15, 21, 26, 32, 38. The gaps are 2 | 5 5 5 4 5 5 | 2, so the half-interval sits at each edge and the shaping never stacks at the row ends.
- Across rows: to place D shaping rows among R rows, use the same formula with N = R and I = D.
- Add a per-row offset (e.g. shift by half an interval on alternate rows) so increases don't stack into a visible column. Stacking causes corners or bias, as with circles [S42].

---

## 4. Stitch patterns and repeats

### 4.1 "Multiple of X + Y"

- **[CONSENSUS]** X = stitches in one repeat. Y = extra stitches to balance or finish the edges. Pattern chain = X·n + Y [S47] https://doradoes.co.uk/2020/02/29/crochet-explained-what-is-a-stitch-multiple/, [S48] https://oombawkadesigncrochet.com/using-stitch-pattern-multiples/.
- **[CONTESTED] Is the turning chain inside Y?** Sources use both conventions:
  - Oombawka: "multiple of 8 + 2 … additional chains (2) added for the turning chain". Its example: 70 sts wanted, multiple 6 + 2 → 6 × 11 + 2 = 68 [S48].
  - Search excerpt of a similar page: "multiple of 4 + 3 … These 3 extra stitches act as the turning chain" [S49] https://www.thestitchinmommy.com/what-are-multiples-and-why-are-they-important/.
  - Dora Does: turning chains are **not** included in the multiple. V-stitch 3 + 2 with 20 Vs = 62 ch, *then* add the turning chain [S47].
  - Shell stitch: "multiples of 6 plus 1 stitch … and 1 additional stitch for your turning chain" [S50] https://lovelifeyarn.com/crochet-shell-stitch/ (plus search excerpt).
  - **Editor rule:** store `repeatWidth X`, `edgeStitches Y` and `turningChainIncluded: bool` explicitly. Always show the resulting chain count **and** the Row 1 stitch count.
- **[CONSENSUS]** Rows repeat the same way. Alternating sc/dc rows is a 2-row multiple; setup rows give things like "2 + 2" [S47].

### 4.2 Balance: consume = produce

**[DERIVED from CONSENSUS]** In a stitch pattern whose width stays constant, every row must produce as many stitch positions as it consumes. That can happen row by row or across a two-row pair. Positions include chain-space chains if the pattern counts them (§4.3).

**Worked example E: shell stitch, multiple 6 + 1 (+1 turning ch)** [S50]
- Ch 6n + 2.
- Row 1: sc in 2nd ch from hook, *skip 2 ch, 5 dc in next ch, skip 2 ch, sc in next ch*; rep n times.
  - Consumes 1 + 6n chains. Produces n shells (5n dc) + (n+1) sc = **6n + 1**. ✓
- Row 2: ch 3 (counts as dc), 2 dc in first sc (half shell), *sc in centre dc of next shell, 5 dc in next sc*, (n−1) times; sc in centre dc of last shell, 3 dc in last sc.
  - Produces 3 + 6(n−1) + 1 + 3 = **6n + 1**. ✓
  - Shells sit above sc and sc sit above shell centres, so the pattern tiles in a half-drop.
- A skip of 2 with no chain works because a 5-dc fan is wide enough to cover the gap. **Reach rule:** a fan of k stitches in one stitch can span roughly k−1 skipped neighbours on each side combined.

**Worked example F: V-stitch** (dc, ch 1, dc) in the same st, skip 2. Multiple 3 + 2. 20 Vs → 62 ch + turning chain [S47].

**Worked example G: chevron/ripple** (Yarnspirations [S51] https://www.yarnspirations.com/blogs/how-to/ultimate-guide-to-chevron-crochet)
- Repeat = `spacing × 2 + 4`, where the 4 covers 1 st consumed by the 3-in-1 increase and 3 by the 3-together decrease.
  - Spacing 4 → 12 sts per repeat. Spacing 10 → 24.
- Foundation for 2 repeats in dc: 2 × 12 + 4 = 28 ch. The turning allowance they use is sc +2, hdc +3, dc +4, tr +5. That is one more than §1.2 because it includes an edge stitch.
- **[CONSENSUS]** The number of stitches decreased at the valleys equals the number increased at the peaks, so the row count stays constant. Uneven sides make the peaks "list" [S51], [S52] https://www.marymaxim.com/blogs/tutorials/how-to-work-a-ripple-technique.
- **[DERIVED]** A peak (3-in-1) adds +2 and a valley (3tog) removes −2. So #peaks = #valleys per row, with half-valleys (2tog) or half-peaks at the edges to finish a straight side.

### 4.3 Chain spaces: do they count?

- **[CONTESTED]** Some designers list stitches and chain spaces separately. Others count every chain as a stitch. The pattern's stitch-count note decides [S53] https://shelleyhusbandcrochet.com/how-to-count-crochet-stitches/, [S54] https://www.crochetspot.com/what-is-a-chain-space-ch-sp/.
- **[CONSENSUS]** Work stitches placed "in the ch-sp" **around** the chains, into the space, not into individual chains [S55] https://lucykatecrochet.com/how-to-crochet-a-border-on-a-double-crochet-blanket.
- **[CONSENSUS]** Slip stitches that join rounds do **not** count [S14].
- **[DERIVED] Editor model:** a ch-k space is **one anchor** for the next row, whatever k is. It occupies **k positions** of width in the current row. Keep two counts: `stitchCount` (excluding chains) and `positionCount` (including chains), and let the pattern choose which one to print.
- **Owner decision (PQW-870):** the default for `stitchCount` is in §10 B10.

### 4.4 How charts show repeats

- **[CONSENSUS]** Written patterns use `*…; rep from *`, `[ ] × n` (repeat n times) and `( )` (group worked into one stitch or space) [S1].
- **[CONSENSUS] Chart symbol conventions** (CYC and diagram guides [S27], [S25], [S56] https://makeanddocrew.com/crochet-patterns-diagram/):
  - Standard symbols exist for ch (oval), sl st (filled dot), sc (+ or ×), hdc, dc and tr (a crossbar per yarn-over), sc2tog/sc3tog, dc2tog/dc3tog, clusters, puff, popcorn, 5-dc shell, picot, FPdc/BPdc, and BLO/FLO arcs at the base.
  - A symbol's **base marks where the hook goes in**.
  - **Bases converging** = several stitches in one stitch (increase or shell). **Tops converging** = stitches worked together (decrease or cluster).
  - Stitches worked into a chain *space* are drawn with bases over the space, not touching a specific chain.
  - Charts often show one repeat plus the edge stitches, with a bracket or shaded box around the repeat. Tech editors check brackets and repeat notation and spell repeats out [S57] https://techeditor.co.uk/crochet-designer-resources-toolkit/52-crochet-tech-editing-tips/.

---

## 5. Grid-based techniques

### 5.1 Stitch aspect ratio and chart distortion (applies to all pixel charts)

- **[CONSENSUS]** Chart cells are square but stitches are not, so a design drawn on a square grid gets stretched or squashed. Curves and lettering suffer most. Fixes: graph paper proportioned to your gauge, or software that draws cells at the gauge ratio [S58] https://www.stitchsums.com/calculators/stitch-aspect-ratio.
- **[CONTESTED] How big the sc ratio is:**
  - Stitchsums calculator: sc "close to square (aspect ≈ 1.0)" [S58].
  - Stitchsums tapestry article: sc is wider than tall, about 1 : 1.2–1.3, so "add roughly 20–30% more rows" [S59] https://www.stitchsums.com/articles/tapestry-crochet-patterns/.
  - Stitchsums maths article: sc 1 wide × 1.0–1.2 tall, hdc 1 × 1.0, dc 1 × 0.7, tr 1 × 0.5 [S15]. That contradicts its own tapestry page on which way sc deviates.
  - **Conclusion:** the direction and size of the distortion depend on yarn, hook and tension. **The editor must take measured stitch gauge and row gauge and render cells at `cellHeight/cellWidth = stitchGauge / rowGauge`** (in the same length units), not use a hard-coded ratio.
- **[DERIVED] Correction formula.** For a motif W stitches wide that should look H_true tall relative to its width:
  - `rows = round( W × (rowGauge / stitchGauge) × (H_true / W_true) )`.
  - Example: sc 16 st × 18 rows /10 cm, a visually square motif 32 sts wide: rows = 32 × 18/16 = **36 rows**.
- **[CONSENSUS]** Substituting hdc for sc in a graphgan elongates the image. Graphgans default to sc for proportion accuracy [S60] https://www.willowcrochet.com/which-stitch-is-best-for-graphgans-single-crochet-vs-half-double-crochet/, [S61] https://www.willowcrochet.com/5-beginner-tips-for-crocheters-tackling-their-first-graphgan-blanket/.

### 5.2 Filet crochet

- **[CONSENSUS] Composition (standard 3-stitch mesh):**
  - Filled block = 3 dc.
  - Open space = dc, ch 2, skip 2.
  - Neighbouring cells share a dc "post". Chart cell = 3 stitch positions + 1 row [S26], [S62] https://doradoes.co.uk/2022/06/12/an-introduction-to-filet-crochet-tips-tricks-and-modifications/, [S63] https://en.wikipedia.org/wiki/Filet_crochet.
- **[CONSENSUS] Row width** = **3N + 1** positions for N cells (1 block = 4 dc, 2 blocks = 7, 3 blocks = 10) [S26].
- **Foundation** (CrochetPop [S26]):
  - Block start: ch 3N + 3, first dc in the 4th ch from hook.
  - Space start: ch 3N + 5, first dc in the 8th ch from hook.
  - Turning chains for later rows: ch 3 (counts as the edge dc) when the row starts with a block; ch 5 (dc + ch-2) when it starts with a space.
  - **[DERIVED] Check, space start:** chains 1–3 = post, 4–5 = the ch-2, 6–7 are skipped, dc in the 8th. That is 4 positions = 1 complete cell, and 3N + 5 − 8 = 3N − 3 chains remain for the other N − 1 cells. ✓
- **[CONTESTED] Turning chain:** Dora Does prefers a non-counting ch 2; others use a counting ch 3. The advice is to stay consistent [S62].
- **Variants:** a 2-stitch mesh (dc + ch 1 / 2 dc), a "4-dc" mesh (ch 3 spaces / 4 dc), and historical tr posts with ch 2 "to prevent distortion" [S62], [S63], [S64] https://hookedonhakelmaschen.com/good-to-know/filet-crochet-the-basics/, [S65] https://www.crochetspot.com/when-your-filet-crochet-squares-look-rectangular/.
- **[CONTESTED] Mesh aspect:**
  - Dora Does: "the width of three double crochet is often slightly wider than the height of one double crochet", so cells are wider than tall. Fixes: edc or tr posts [S62].
  - Crochet Spot addresses cells that look elongated (e.g. with the 4-dc mesh). Its fixes: blocking, switching mesh type, edc or tr, tension [S65].
  - **Editor:** make the mesh aspect a gauge input.
- **[CONSENSUS]** Read filet charts bottom-up in a snake; right-handers start at the lower right [S64], [S26].
- **Filet edge shaping:** Interweave's article (https://www.interweave.com/article/crochet/shaping-filet-crochet/) returned 403 and could not be verified. **[DERIVED]** Structurally, removing a cell at a row start means slip-stitching across 3 positions before the new post. Adding a cell means extending with chains (or a tall stitch) worth 3 positions.

### 5.3 Tapestry crochet

- **[CONSENSUS]** Usually sc. Non-working colors are **carried inside** the stitches, dropped and picked up (intarsia), or floated along the back. Colors can change mid-row, unlike mosaic [S66] https://en.wikipedia.org/wiki/Tapestry_crochet, [S30].
- **[CONSENSUS]** The color switch happens with 2 loops of the unfinished sc still on the hook, i.e. on the last yarn-over (Carol Ventura, via [S67] https://www.tapestrycrochet.com/ and a search excerpt).
- **[CONSENSUS]** When turning in flat work, move the carried strand so it stays inside the stitches (back on RS rows, front on WS rows) [S30]. Tight stitches hide carried yarn and make a stiff fabric; loose stitches let it show [S66].
- **[RULE OF THUMB]** Carry 2–3 colors per row at most for beginners; 5+ is advanced [S59].
- One chart cell = one sc [S59].

### 5.4 Graphgans (sc pixel charts)

- One cell = one stitch, usually sc. Rows: odd rows read right to left, even rows left to right [S61], [S68] https://pattern-paradise.com/2016/10/03/tutorial-read-graph/.
- **[CONSENSUS]** Use intarsia bobbins per color block. Don't carry across the back, because it shows through and distorts stitches [S61], [S69] https://cypresstextiles.net/2013/01/09/two-color-image-chart-tutorial/.

### 5.5 Corner-to-corner (C2C)

- **[CONSENSUS] Tile** = ch-3 + 3 dc (hdc variants exist). One graph cell = one tile [S70] https://sarahmaker.com/c2c-crochet/, [S71] https://makeanddocrew.com/how-to-corner-to-corner-crochet-c2c-for-beginners/.
- Start: ch 6, dc in 4th ch from hook, dc in next 2 ch = tile 1 [S70].
- **Increase row** (adds a tile at the row start): ch 6, dc in 4th ch from hook and next 2 ch. Then *sl st into the ch-3 sp of the next tile of the previous row, ch 3, 3 dc in the same sp* across [S70], [S71].
  - Tighter option: ch 5, dc in 3rd ch from hook (from [S70]).
- **Decrease row:** sl st across the 3 dc and into the ch-3 sp, ch 3, 3 dc in that space, then continue. This removes a tile and leaves a straight edge [S70], [S71].
- **Order:** start at the **bottom-right** of the graph and finish at the top-left. Diagonal row d contains d tiles while both edges are still increasing [S70], [S72] https://www.pixelperfectcrochet.com/master-crochet-graphs-part-ii-c2c-graphs/ (search excerpt).
- **Rectangles:** increase at both edges until one dimension is reached, then **decrease on that side while still increasing on the other**. After that, decrease on both [S70], [S71].
- **Diagonal row count** for W × H tiles: **W + H − 1** [S71]. Total tiles = W × H.
- **[DERIVED] Tiles in diagonal row d** (1-indexed) = `min(d, W, H, W + H − d)`. Along a diagonal, each tile sits in exactly one (column, row) cell of the graph.
- **[RULE OF THUMB]** Worsted-weight dc tile ≈ 0.5 in [S71]. The tile is close to square, so the C2C graph distortion is smaller than for sc rows. **[CONTESTED]** No source gave measured ratios.

### 5.6 Mosaic crochet

- **[CONSENSUS]** One color per row. The pattern comes from skipping stitches (chaining over them) and later working tall stitches down into the skipped stitches of an earlier row of the same color [S73] https://en.wikipedia.org/wiki/Mosaic_crochet, [S34].
- **Overlay mosaic:** the color changes every row. Yarn is usually cut each row and the RS always faces you. sc go in the back loops; dc drop down into the front loops of the row below of the same color. It can make diagonals [S73], [S74] (crochet.com overlay mosaic, search excerpt https://www.crochet.com/learning-center/overlay-mosaic-crochet).
- **Inset mosaic:** each color is worked for 2 rows (RS + WS), so yarn can be carried up the side. **One chart row = 2 crochet rows** [S75] https://www.hanjancrochet.com/2-row-mosaic-crochet-technique/.
  - Stitches into the previous row's dc are dc. Stitches into the skipped stitches **three rows below** are tr. A different-color cell = chain and skip.
  - The stitch count stays constant [S75].
- **Chart reading:** the first cell of each row shows the row color. A cell in the row's color = sc or mosaic-dc; a different color = skip and chain [S34]. The chain-count convention for skips varies by designer (that source uses skipped + 1).
- **[DERIVED] Structural implication:** mosaic stitches anchor to row r − 2 (overlay) or r − 3 (inset), not r − 1. The validator must allow multi-row anchors only for stitches flagged as "spike/drop/mosaic". It must also check that the target stitch was actually left unworked (skipped under a chain) in the intermediate row(s).

---

## 6. Colorwork in rows

- **[CONSENSUS] Color change on the last yarn-over of the previous stitch.** Stop before the final yarn-over of the last stitch in the old color, then yarn over with the new color and pull through the remaining loops. "No matter which stitch you're working, the color change always happens on the last yarn over before the new color should appear" [S76] https://sarahmaker.com/change-colors-crochet/, [S77] https://bhookedcrochet.com/2019/01/23/change-colors-in-crochet/, [S61]. For C2C: finish the third dc of the tile by pulling the new color through the last two loops [S70].
- **[DERIVED] Chart encoding:** the color attribute of stitch *i* belongs to stitch *i*, but the written instruction must tell the crocheter to switch during the final yarn-over of stitch *i−1* (in working order, which flips on WS rows). For the first stitch of a row, the change happens on the last yarn-over of the previous row's final stitch, before turning.
- **[CONSENSUS] Stripes and carrying up the side:** for 2-row stripes, carry the unused yarn up the edge and change at the start of every second row. Leave enough slack for the edge to lie flat [S76], [S77], [S78] https://theloopylamb.com/how-to-seamlessly-change-yarn-colors-in-crochet-tutorial/.
- **[CONSENSUS] Carry vs. bobbins:**
  - Tapestry crochet carries inside the stitches [S30], [S66].
  - Graphgans use bobbins or intarsia, since carrying shows through [S61].
  - Mosaic uses one color per row: inset carries up the side, overlay is cut [S73].
- **[RULE OF THUMB]** Taller stitches (dc) hide carried strands poorly and make gappier fabric. That is why C2C and graphgans for detail prefer sc or hdc [S60] (search excerpt of Willow/others).

---

## 7. Edges, borders and seaming

### 7.1 Border stitches per row end

| Row stitch | Border sc per row end | Confidence |
|---|---|---|
| sc | 1 | **[CONSENSUS]** [S79] https://hearthookhome.com/how-to-add-a-border-in-crochet/, [S80] https://www.crochetspot.com/crochet-finish-technique-crochet-evenly-around/, [S81] https://www.dreamalittlebigger.com/post/single-crochet-border-edge-clean-ugly-edges.html |
| hdc | 1 or 2 | **[CONTESTED]** Crochet Spot says 2 [S80]; Dream a Little Bigger says 1 ("single or half double") [S81] |
| dc | 2 | **[CONSENSUS]** [S79], [S80], [S55] ("each row is equal to two stitch spaces"), [S82] https://craftinghappiness.com/single-crochet-blanket-edging/ |
| tr | 3 | **[CONSENSUS]** [S79], [S80], [S83] https://craftinghappiness.com/single-crochet-blanket-border/ |

- **Top and bottom edges:** 1 sc per stitch. Along the foundation chain, 1 sc per remaining chain loop [S80], [S55].
- **Corners [CONSENSUS]:** **3 sc in the corner stitch** [S79], [S80], [S81]. Alternatives: (sc, ch 1, sc) [S84] https://ambassadorcrochet.com/sc-border/ (search excerpt), or (sc, ch 2, sc) in linen-stitch borders [S55].
- **[RULE OF THUMB]** Work a base round of sc first, then the decorative rounds [S79].
- **[CONSENSUS]** A ruffling border has too many stitches; a curling or pulling one has too few. Adjust by skipping every 4th or 5th row end or adding stitches [S84], [S80].
- **Ratio method** (Betsy Desmond via Daisy Farm Crafts [S85] https://daisyfarmcrafts.com/how-to-calculate-an-even-crochet-blanket-border-by-betsy-desmond/):
  1. Border sts per inch along the top = top sts ÷ width.
  2. Side sts = sts/in × length.
  3. Per row = side sts ÷ rows.
  4. Turn decimals into fractions: 1.33 → 1 per row + 1 extra every 3 rows; 0.8 → 4 sts per 5 rows.
- **[DERIVED] Worked example H: sc border on a 60-st × 40-row dc blanket.**
  - Top and bottom: 60 each.
  - Sides: 2 × 40 = 80 each.
  - Corners: the 3-sc group replaces the single corner stitch, adding 2 extra per corner.
  - Total = 2·60 + 2·80 + 4·2 = **288 sc**.
  - If the next border round uses a multiple (e.g. a 4 + 0 shell border), adjust the side counts evenly (§3.4) so each edge between corners is a multiple of 4.

### 7.2 Seaming

- **Whipstitch:** needle always goes front to back. Fast, medium strength, slight ridge [S86] https://www.yarnspirations.com/blogs/how-to/methods-for-seaming-crochet, [S87] https://easycrochet.com/the-best-ways-to-seam-crochet-projects-together/.
- **Mattress stitch:** nearly invisible, strong, low flexibility, flat. Good for garments. Reverse mattress (wrong sides together) makes a decorative visible seam [S86], [S88] https://www.acrochetedsimplicity.com/how-to-sew-a-mattress-stitch-seam/.
- **Slip-stitch seam:** strong. The **flat slip-stitch seam** is one of the flattest and decorative in a contrast color, ideal for blankets and granny squares [S89] https://www.acrochetedsimplicity.com/how-to-crochet-a-flat-slip-stitch-seam/, [S86].
- **Single-crochet seam:** slightly textured. Worked wrong sides together, it becomes a visible ridge [S86].
- **[CONSENSUS]** When seaming along row ends, use the same ratios as borders: 1 stitch per sc row side, 2 per dc row side [S86]. Block the pieces before seaming [S86].
- **[DERIVED]** Two edges can only be seamed stitch-for-stitch if their "edge unit counts" match (stitches or row-end equivalents). Otherwise the seam needs an even-distribution ratio (§3.4), and the validator should flag the mismatch.

---

## 8. Granny squares and motifs in rounds

- **Classic square** (Joy of Motion [S90] https://joyofmotioncrochet.com/granny-squares/):
  - R1: ch 3 (counts as dc), 2 dc, *ch 2, 3 dc* ×3, ch 2, join = 4 clusters + 4 corner ch-2 = **20** (counting chains).
  - R2: (3 dc, ch 2, 3 dc) in each corner = **40**.
  - Each later round adds one more side space per side, **+20 stitches per round** in that version, where every space is ch 2.
- **[DERIVED] General square formulas:**
  - Round n has **4n clusters** = 12n dc and 4n spaces.
  - If every space is ch 2 (Joy of Motion): total = 12n + 8n = **20n**.
  - Classic ch-1 side spaces with ch-2 corners: chains = 4·2 + (4n − 4)·1, so total = **16n + 4** (R1 = 20, R2 = 36, R3 = 52).
  - Corner rule: every corner ch-2 space receives **(3 dc, ch 2, 3 dc)**. Every side ch-1 space receives **(3 dc, ch 1)**. So the clusters per side in round n = n + 1, counting both corner halves.
- **Hexagon** (6 corners) [S91] https://joyofmotioncrochet.com/hexagon-granny-square/: R1 = 18 (6 × 2 dc + 6 ch-1), R2 = 54, R3 = 78, R4 = 102. After R2 it grows by **+24** per round (6 new clusters of 3 dc + 6 ch-1).
- **Octagon** (8 corners) [S92] https://joyofmotioncrochet.com/octagon-granny-square/: R1 = 20, R2 = 40, R3 = 72, R4 = 104, R5 = 136, i.e. **+32** per round from R2.
- **[DERIVED] General rule for a k-cornered granny motif** with 3-dc clusters and ch-1 side spaces: after the corner round is set up, each round adds k clusters + k ch-1 = **+4k** positions. Square k = 4: +16. Hexagon: +24. Octagon: +32. The source figures match for hexagon and octagon.
- **[DERIVED] Flatness:** a regular k-gon worked in rounds lies flat when its perimeter growth per round ≈ 2π × row height, scaled by how close the polygon is to a circle. More corners means a rounder, flatter motif. Fewer corners concentrate the increases, which gives sharp corners. (Geometric reasoning; no single source.)
- **Joining** [S90]: whipstitch, flat slip-stitch join, join-as-you-go. **[DERIVED] Join compatibility:** edges must have the same number of edge positions. For squares of the same round count that is automatic.

---

## 9. Common mistakes that make a chart unrealistic or uncrochetable

Tech editors check stitch counts, starting-chain length, turning-chain clarity, repeats and brackets, math for stitch patterns, and standard symbols [S57]. The most common reader-reported error signs are row-end counts that don't match and symbols that are missing or misplaced [S93] https://hooksneedles.com/blogs/news/mastering-pattern-typos-how-to-spot-and-fix-errors-quickly-to-finish-confidently.

Structural failure modes. Each item notes whether it is sourced or derived.

1. **Stitch-count mismatch between rows** without explicit shaping. It makes edges grow or shrink [S12], [S17].
2. **Turning-chain convention inconsistent.** A counted turning chain with no stitch worked into its top, or a non-counted one that gets worked into [S12], [S13].
3. **Missing turning chain or wrong height.** The row edge sags, or gets bumpy if the chain is too tall [S12].
4. **A stitch with nothing to work into [DERIVED].** Its base sits over a position that doesn't exist in the row below (past the row end, over a gap that isn't a chain space, over a slip stitch nobody can work into cleanly), or over a position already consumed by a non-increase stitch.
5. **A stitch in row r−1 left unworked with no chain covering it [DERIVED].** It opens an unintended hole. Fine in lace if shown as a skip under a chain or next to a fan; wrong in solid fabric.
6. **Impossible reach [DERIVED].** Consecutive stitches whose anchors are far apart with no chain or fan to bridge the distance. Filet bridges a skip of 2 with ch 2 [S26], mosaic uses chains ≈ skipped + 1 [S34], and a 5-dc shell covers skip-2 on either side [S50]. A row can't jump backwards (anchors must follow the row's working direction), apart from crossed or post stitches that are explicitly marked.
7. **Height mismatch [DERIVED from S32/S33].** Mixed heights not compensated in later rows leave permanent scallops. Adjacent stitches that differ in height by more than 2 levels (e.g. sc beside tr) with no transition stitch are visually abrupt. Allowed, but flag them.
8. **Chains that don't connect [DERIVED].** A chain run must start at a live stitch, end by being anchored (the next stitch is worked into something), and be consumed or bridged by the next row, either as a chain-space anchor or by being worked into.
9. **Unbalanced repeat [S51].** Increases ≠ decreases per repeat in ripple patterns, a multiple that doesn't match the row width, or a repeat that doesn't tile with its edge stitches.
10. **Asymmetric shaping with odd differences** in shapes meant to be symmetric (§3.2, derived).
11. **Pixel chart drawn on square cells** without gauge correction [S58], [S59].
12. **Color change placed on the wrong stitch** (the change should be on the last yarn-over of the previous stitch) [S76].
13. **Border ratios wrong for the row height**: ruffles or cupping [S79], [S80].
14. **Mosaic or spike stitch anchored into a stitch that was worked into** in the intermediate row. It must have been skipped under a chain [S75], [S73].

---

## 10. Encodable rules / validation checks

Model the chart as a directed graph. **Nodes** are stitches, each with `type`, `height`, `row`, `positionIndex`, `color`, `loop` (both/BLO/FLO), and flags `countsAsStitch`, `isTurningChain`, `isChain`, `isSkipAnchor`. **Edges** are anchor links from a stitch to the thing it is worked into:
- a stitch top in row r−1,
- a chain space (a node group) in row r−1,
- a foundation chain,
- a row end (borders),
- a stitch in row r−k, only for spike/mosaic/drop stitches.

The rules are grouped by what they check. Each is marked either **[S]** (sourced: the rule itself comes from the cited research) or **[D]** (derived from sourced facts). Violations are ERROR (uncrochetable or inconsistent) or WARN (crochetable but likely unintended).

### A. Foundation and turning chains

1. **[S] ERROR:** every row after the foundation starts with either a turning chain of height `T(tallest first-stitch type)` (sc 1, hdc 2, dc 3, tr 4, dtr 5) or an explicit alternative (stacked sc, chainless standing dc, extended first stitch, standing stitch after a color join). With a user-defined tension override, ±1 chain is allowed as WARN [S1], [S12], [S13].
2. **[D] ERROR:** foundation chain length = `N + T` if the turning chain doesn't count, `N + T − 1` if it counts. Row 1's first stitch anchors at chain index `T + 1` from the hook [S1], [S15].
3. **[S] ERROR:** sc turning chains never count as stitches [S1].
4. **[S] ERROR:** if row r's turning chain `countsAsStitch`, the last stitch of row r+1 must anchor to the top of that turning chain. If not, nothing in row r+1 may anchor to it, and the first stitch of row r+1 anchors to the first real stitch [S12], [S13], [S16].
5. **[S] ERROR:** foundation-stitch rows (fsc/fdc) count as Row 1. Their count = stitch count, not chain count [S22].
6. **[D] WARN:** turning-chain counting conventions mixed across rows without explicit per-row notes.

### B. Stitch counts and conservation

7. **[S] ERROR:** declared end-of-row stitch count = computed count [S1], [S57].
8. **[D] ERROR, conservation:** for row r, `produced(r) = consumedAnchors(r−1) + Σ(increase extras) − Σ(decrease savings)`. Every stitch position of row r−1 must be (a) anchored into exactly once, (b) part of exactly one decrease group, (c) covered by a chain bridge (skipped under chains or next to a fan), or (d) explicitly marked unworked (short row, shaped edge, mosaic skip).
9. **[D] ERROR:** without shaping marks, `count(r) = count(r−1)`. With shaping, `count(r) − count(r−1)` must equal the sum of increase/decrease deltas on the row.
10. **[D] ERROR:** a chain-k space is one anchor target. It occupies k positions in `positionCount`, and it contributes 0 or k to `stitchCount` according to a global pattern setting [S53].
    - **Owner decision (PQW-870, 2026-09-14):** by default the chains count when a later row or round is worked into them, one chain at a time or as a whole chain space (a granny-square corner, a V-stitch or filet space). Chains nothing is worked into, such as the decorative loops of a last row, do not count. Turning chains follow rule 4 instead. A pattern can override the default: every chain counts, or none does. The written pattern still names a chain space as a chain space; only the count changes.
11. **[S] ERROR:** join slip stitches (rounds) contribute 0 to counts [S14].

### C. Anchors and reach

12. **[D] ERROR:** every non-chain stitch except foundation stitches has ≥ 1 anchor. Decrease or cluster `…Ntog` has exactly N anchors on N consecutive anchorable positions.
13. **[D] ERROR:** anchors of consecutive stitches in a row are monotonic along the row's working direction (non-decreasing position index). Crossed or post stitches must be explicitly flagged to break this.
14. **[D] ERROR:** several stitches sharing one anchor must be declared an increase or fan/shell/V group (bases converge on the chart). Several anchors feeding one stitch must be declared a decrease or cluster (tops converge) [S25], [S56].
15. **[D] ERROR, reach:** between the anchors of consecutive stitches a and b in row r, the number of skipped positions s must be bridged. Either `s ≤ chainsBetween(a,b) + 1`, or a or b belongs to a fan of width ≥ s+1. Default tolerance for plain stitches with no chain: s ≤ 1 (WARN at 1, ERROR at ≥ 2). Calibration: filet ch 2 over skip 2 [S26]; shell 5 dc covers skip 2 each side [S50]; mosaic ch = skipped + 1 [S34].
16. **[D] ERROR:** anchors must reference an existing position (no anchors past the row end or into empty space). A stitch placed "in the ch-sp" must anchor to a chain-space group, not to a single chain inside it [S55].
17. **[D] ERROR:** multi-row anchors (row r−k, k ≥ 2) are only allowed on stitches flagged spike/mosaic/drop. The target must be unworked in every row between, i.e. covered by a chain in rows r−1…r−k+1 [S73], [S75].
18. **[D] ERROR:** chain nodes must form a connected run from a live stitch to the next stitch in working order. No free-floating chains.

### D. Height

19. **[S/D] WARN:** row height = max height of its stitches (sc 1, hdc ≈1.6, dc ≈2.4, tr ≈3.2, user-calibrated). If a row has more than one height level and the rows above don't compensate within the next 1–3 rows (tall over short), flag a permanent scalloped edge [S21], [S32], [S33].
20. **[D] WARN:** a turning chain shorter than the row's first stitch by more than 1 chain, or taller by more than 1 chain, gives sagging or bumpy edges [S12].
21. **[S] WARN:** at short-row ends in rows of dc or taller, suggest graduated heights (sc→hdc→dc) [S35].

### E. Repeats

22. **[S] ERROR:** row-1 width = `X·n + Y` for a declared multiple. Store and display whether the turning chain is included [S47], [S48].
23. **[D] ERROR:** within one repeat, produced positions = consumed positions (e.g. shell 6+1 → 6n+1 per row), unless the repeat is declared as shaping [S50].
24. **[S] ERROR, ripple/chevron:** per row, #peak-increase stitches added = #valley-decrease stitches removed. Repeat width = `2·spacing + 4` for the 3-in-1/3-tog form [S51].
25. **[D] WARN:** edge half-repeats (half shells, half valleys) must restore a straight edge. The end-of-row count must equal the row below.

### F. Shaping

26. **[D] INFO/WARN, edge angle:** `θ = atan(a·w / (k·h))` with `w = 10/stitchGauge`, `h = 10/rowGauge`. When the user draws an edge line, compute the required `a/k = tan θ · h/w` and place the shaping rows with Bresenham.
27. **[D] WARN:** more than 2 increases or decreases per edge per row on a sc/hdc row. Suggest chain extension or slip-stitch-across instead of stacked increases.
28. **[D] WARN:** for mirror-symmetric shapes, `count(r) − count(r−1)` must be even.
29. **[S/D] WARN:** evenly spaced increases/decreases use `floor((i+0.5)·N/I)+1`. Warn if increases stack vertically in the same column on consecutive shaping rows (makes corners or bias) [S42], [S45].
30. **[D] WARN:** on the C2C or filet grid, shaping must happen in whole cells (1 tile, or 3 positions for filet).

### G. Grids and colorwork

31. **[S] ERROR:** pixel chart cells are rendered with aspect `stitchGauge/rowGauge` taken from the user's gauge, not a constant. Offer vertical re-sampling: `rows = W × rowGauge/stitchGauge × (H_true/W_true)` [S58], [S59].
32. **[S] ERROR, filet:** row positions = 3N + 1 (3-st mesh; configurable to 2N+1 or 4N+1 for other meshes). An open cell = post, ch 2, skip 2. The foundation is 3N+3 (block start) or 3N+5 (space start). The turning chain is ch 3 (block) or ch 5 (space) [S26], [S62].
33. **[S] ERROR, C2C:** diagonal rows = W + H − 1. Tiles in diagonal d = `min(d, W, H, W+H−d)`. A dimension switches from increase to decrease independently once it is reached [S70], [S71].
34. **[S] ERROR, inset mosaic:** chart row ↔ 2 crochet rows of the same color. Overlay: color changes every row. Dropped stitches anchor 2 (overlay) or 3 (inset) rows down into skipped stitches [S73], [S75].
35. **[S] ERROR, color change:** when stitch i has a different color from stitch i−1 (in working order), emit "change color on the last yarn-over of stitch i−1". For the first stitch of a row, emit it on the last stitch of the previous row [S76], [S77].
36. **[S] WARN:** in tapestry, more than 3 colors carried in one row is "advanced". In graphgan/intarsia mode, carrying colors across the back is discouraged [S59], [S61].
37. **[D] WARN:** in 2-row stripe mode, carry yarn up the side. If a color is unused for more than 2–4 rows (designer threshold), suggest cutting.

### H. Borders, seams and motifs

38. **[S] ERROR/WARN, border row-end ratio:** sc rows 1, dc rows 2, tr rows 3; hdc configurable 1 or 2 (contested). Corners take 3 sc (or sc-ch1-sc). Border total = `2·W + 2·Σ rowEndRatio + 4·2` for the 3-sc corner [S79], [S80].
39. **[S] WARN:** fractional ratios are expressed as "x per y rows" (e.g. 4 per 5) and distributed evenly [S85].
40. **[D] ERROR:** seamed or joined edges must have matching edge-unit counts, or an explicit distribution ratio [S86].
41. **[S/D] ERROR, granny motifs:** a k-cornered 3-dc motif gains 4k positions per round after setup (ch-1 sides). The classic square with all-ch-2 spaces gains 20 per round. Each corner space gets (3 dc, ch 2, 3 dc) and each side space (3 dc, ch 1) [S90], [S91], [S92].

### I. Chart presentation

42. **[S] ERROR:** row numbers sit at the row's starting side. Row 1 reads right to left for right-handers and rows alternate direction. RS and WS rows are distinguishable. A symbol key is included. Symbols show the RS view [S24], [S25], [S27].
43. **[D] WARN:** loop-specific stitches (BLO/FLO) on WS rows are translated when the written instructions are generated.
44. **[S] WARN:** repeats are bracketed on the chart and spelled out in the text [S57].

---

## 11. Sources

1. [S1] Craft Yarn Council — How to Read a Crochet Pattern: https://www.craftyarncouncil.com/standards/how-to-read-crochet-pattern
2. [S2] Craft Yarn Council — Double Crochet: https://www.craftyarncouncil.com/mar06_dc.html
3. [S12] B.hooked Crochet — Uneven Crochet Edges: https://bhookedcrochet.com/2016/04/05/crochet-straight-edges/
4. [S13] Sweet Bee Crochet — Turning Chains: https://sweetbeecrochet.com/turning-chains/
5. [S14] American Crochet Association — How to Count Crochet Stitches: https://americancrochetassociation.blog/how-to-count-crochet-stitches/
6. [S15] Stitchsums — Crochet Pattern Maths: https://www.stitchsums.com/articles/crochet-pattern-math
7. [S16] I Like Crochet — Stitch markers / uneven edges: https://www.ilikecrochet.com/magazine/crochet-articles-and-interviews/crochet-corner/stitch-markers/
8. [S17] AllFreeCrochet — How to Stop Crochet From Getting Smaller: https://www.allfreecrochet.com/Tips-for-Crochet/Crochet-Tips-for-Beginners-How-to-Stop-Crochet-From-Getting-Smaller
9. [S18] Heart Hook Home — Stacked Single Crochet: https://hearthookhome.com/stacked-single-crochet-for-gapless-double-crochet-row-ends/
10. [S19] Our Daily Craft — Straight Edges with Stacked Stitches: https://www.ourdailycraft.com/2024/02/06/crochet-straight-edges/
11. [S20] Mallooknits — Chainless starting double crochet: https://mallooknits.com/chainless-starting-double-crochet/
12. [S21] Stitch and Hound — Crochet Stitch Height Chart: https://stitchandhound.com/blog/crochet-stitch-height-chart
13. [S22] Treasurie — Foundation Single Crochet: https://blog.treasurie.com/foundation-single-crochet/
14. [S23] Craftsy — Foundation Single Crochet: https://www.craftsy.com/post/foundation-single-crochet-how-to
15. [S24] Yarnspirations — How to Read Crochet Symbol Charts: https://www.yarnspirations.com/blogs/how-to/how-to-read-crochet-chart-symbols
16. [S25] Your Crochet — How to Read and Write Crochet Diagrams: https://yourcrochet.com/how-to/how-to-read-and-write-crochet-diagrams/
17. [S26] CrochetPop — Filet Crochet: https://learn.crochetpop.app/learn/filet-crochet
18. [S27] Craft Yarn Council — Crochet Chart Symbols: https://www.craftyarncouncil.com/standards/crochet-chart-symbols
19. [S28] Dora Does — Left-handed crochet: https://doradoes.co.uk/2022/06/07/the-truth-about-left-handed-crochet-the-differences-for-left-handed-crocheters/
20. [S29] Yarnspirations — Left-Handed Crochet: https://www.yarnspirations.com/blogs/how-to/ultimate-guide-to-left-handed-crochet
21. [S30] Sarah Maker — Tapestry Crochet: https://sarahmaker.com/tapestry-crochet/
22. [S31] Interweave — Single Crochet Variations for Tapestry Crochet: https://www.interweave.com/article/crochet/single-crochet-tapestry-crochet/
23. [S32] Treasurie — Crochet Wave Stitch: https://blog.treasurie.com/crochet-wave-stitch/
24. [S33] Heart Hook Home — Wave Stitch: https://hearthookhome.com/how-to-crochet-the-wave-stitch/
25. [S34] Crochet.com — Mosaic Crochet (search excerpt): https://www.crochet.com/learning-center/mosaic-crochet
26. [S35] Dora Does — Crochet Short Rows: https://doradoes.co.uk/2023/09/20/crochet-short-rows-what-they-are-when-and-how-to-use-them/
27. [S36] Craft Yarn Council — Standard Yarn Weight System: https://www.craftyarncouncil.com/standards/yarn-weight-system
28. [S37] Inner Child Crochet — Triangles in Rows: https://innerchildcrochet.com/resources/how_to_design/triangles_rows.html
29. [S38] Handy Little Me — How to Crochet a Triangle (search excerpt): https://www.handylittleme.com/how-to-crochet-a-triangle/
30. [S39] Interweave — Knitter's Geometry: Triangular Shawls (search excerpt only; page 403): https://www.interweave.com/article/knitting/knitters-geometry-triangular-shawls/
31. [S40] Dora Does — Sleeve Shaping: https://doradoes.co.uk/2022/03/31/how-to-work-out-sleeve-shaping-for-crochet-garments/
32. [S41] B.hooked — Crochet Oval: https://bhookedcrochet.com/2017/07/02/crochet-oval/
33. [S42] Sarah Maker — Flat Circle: https://sarahmaker.com/crochet-flat-circle/
34. [S43] KnitPro — Increase crochet stitches evenly: https://www.knitpro.eu/en/blog/how-to-increase-crochet-stitches
35. [S44] Lion Brand — Evenly Space Increases/Decreases: https://blog.lionbrand.com/how-to-evenly-space-your-increasesdecreases/
36. [S45] Dora Does — Evenly space increases and decreases: https://doradoes.co.uk/2021/01/16/how-to-evenly-space-increases-and-decreases-in-crochet/
37. [S46] DROPS/Garnstudio — Increase or decrease evenly: https://www.garnstudio.com/lesson.php?id=28&cid=19
38. [S47] Dora Does — What is a stitch multiple: https://doradoes.co.uk/2020/02/29/crochet-explained-what-is-a-stitch-multiple/
39. [S48] Oombawka Design — Stitch Pattern Multiples: https://oombawkadesigncrochet.com/using-stitch-pattern-multiples/
40. [S49] The Stitchin Mommy — Multiples (search excerpt): https://www.thestitchinmommy.com/what-are-multiples-and-why-are-they-important/
41. [S50] love. life. yarn. — Crochet Shell Stitch: https://lovelifeyarn.com/crochet-shell-stitch/
42. [S51] Yarnspirations — Ultimate Guide to Chevron Crochet: https://www.yarnspirations.com/blogs/how-to/ultimate-guide-to-chevron-crochet
43. [S52] Mary Maxim — Ripple Technique (search excerpt): https://www.marymaxim.com/blogs/tutorials/how-to-work-a-ripple-technique
44. [S53] Shelley Husband — How to count crochet stitches (search excerpt): https://shelleyhusbandcrochet.com/how-to-count-crochet-stitches/
45. [S54] Crochet Spot — What is a Chain Space: https://www.crochetspot.com/what-is-a-chain-space-ch-sp/
46. [S55] Lucy Kate Crochet — Border on a Double Crochet Blanket: https://lucykatecrochet.com/how-to-crochet-a-border-on-a-double-crochet-blanket
47. [S56] Make and Do Crew — How to Read Crochet Charts: https://makeanddocrew.com/crochet-patterns-diagram/
48. [S57] Artisan Tech Editor — 52 Crochet Tech Editing Tips: https://techeditor.co.uk/crochet-designer-resources-toolkit/52-crochet-tech-editing-tips/
49. [S58] Stitchsums — Stitch Aspect Ratio Calculator: https://www.stitchsums.com/calculators/stitch-aspect-ratio
50. [S59] Stitchsums — Tapestry Crochet Patterns: https://www.stitchsums.com/articles/tapestry-crochet-patterns/
51. [S60] Willow Crochet — SC vs HDC for Graphgans: https://www.willowcrochet.com/which-stitch-is-best-for-graphgans-single-crochet-vs-half-double-crochet/
52. [S61] Willow Crochet — Graphgan beginner tips: https://www.willowcrochet.com/5-beginner-tips-for-crocheters-tackling-their-first-graphgan-blanket/
53. [S62] Dora Does — Introduction to filet crochet: https://doradoes.co.uk/2022/06/12/an-introduction-to-filet-crochet-tips-tricks-and-modifications/
54. [S63] Wikipedia — Filet crochet: https://en.wikipedia.org/wiki/Filet_crochet
55. [S64] Hooked on Häkelmaschen — Filet Crochet Basics: https://hookedonhakelmaschen.com/good-to-know/filet-crochet-the-basics/
56. [S65] Crochet Spot — Filet squares look rectangular: https://www.crochetspot.com/when-your-filet-crochet-squares-look-rectangular/
57. [S66] Wikipedia — Tapestry crochet: https://en.wikipedia.org/wiki/Tapestry_crochet
58. [S67] Carol Ventura — Tapestry Crochet (search excerpt): https://www.tapestrycrochet.com/
59. [S68] Pattern Paradise — How to Read a Graph: https://pattern-paradise.com/2016/10/03/tutorial-read-graph/
60. [S69] cypress|textiles — Single Crochet Graphghan Tutorial: https://cypresstextiles.net/2013/01/09/two-color-image-chart-tutorial/
61. [S70] Sarah Maker — C2C Crochet: https://sarahmaker.com/c2c-crochet/
62. [S71] Make and Do Crew — Corner to Corner Crochet: https://makeanddocrew.com/how-to-corner-to-corner-crochet-c2c-for-beginners/
63. [S72] Pixel Perfect Crochet — C2C Graphs (search excerpt; page 403): https://www.pixelperfectcrochet.com/master-crochet-graphs-part-ii-c2c-graphs/
64. [S73] Wikipedia — Mosaic crochet: https://en.wikipedia.org/wiki/Mosaic_crochet
65. [S74] Crochet.com — Overlay Mosaic Crochet (search excerpt): https://www.crochet.com/learning-center/overlay-mosaic-crochet
66. [S75] HanJan Crochet — Inset (2-row) Mosaic: https://www.hanjancrochet.com/2-row-mosaic-crochet-technique/
67. [S76] Sarah Maker — Change Colors in Crochet: https://sarahmaker.com/change-colors-crochet/
68. [S77] B.hooked — Change Colors in Crochet: https://bhookedcrochet.com/2019/01/23/change-colors-in-crochet/
69. [S78] The Loopy Lamb — Seamless color changes: https://theloopylamb.com/how-to-seamlessly-change-yarn-colors-in-crochet-tutorial/
70. [S79] Heart Hook Home — Adding a Border: https://hearthookhome.com/how-to-add-a-border-in-crochet/
71. [S80] Crochet Spot — Crochet Evenly Around: https://www.crochetspot.com/crochet-finish-technique-crochet-evenly-around/
72. [S81] Dream a Little Bigger — Single Crochet Border (search excerpt): https://www.dreamalittlebigger.com/post/single-crochet-border-edge-clean-ugly-edges.html
73. [S82] Crafting Happiness — SC Edging for DC blankets (search excerpt): https://craftinghappiness.com/single-crochet-blanket-edging/
74. [S83] Crafting Happiness — SC Border for Treble rows (search excerpt): https://craftinghappiness.com/single-crochet-blanket-border/
75. [S84] Ambassador Crochet — SC Border (search excerpt): https://ambassadorcrochet.com/sc-border/
76. [S85] Daisy Farm Crafts / Betsy Desmond — Calculate an Even Border: https://daisyfarmcrafts.com/how-to-calculate-an-even-crochet-blanket-border-by-betsy-desmond/
77. [S86] Yarnspirations — Methods for Seaming Crochet: https://www.yarnspirations.com/blogs/how-to/methods-for-seaming-crochet
78. [S87] Easy Crochet — Best Ways to Seam (search excerpt): https://easycrochet.com/the-best-ways-to-seam-crochet-projects-together/
79. [S88] A Crocheted Simplicity — Mattress Stitch Seam (search excerpt): https://www.acrochetedsimplicity.com/how-to-sew-a-mattress-stitch-seam/
80. [S89] A Crocheted Simplicity — Flat Slip Stitch Seam (search excerpt): https://www.acrochetedsimplicity.com/how-to-crochet-a-flat-slip-stitch-seam/
81. [S90] Joy of Motion Crochet — Granny Squares 101: https://joyofmotioncrochet.com/granny-squares/
82. [S91] Joy of Motion Crochet — Hexagon Granny: https://joyofmotioncrochet.com/hexagon-granny-square/
83. [S92] Joy of Motion Crochet — Octagon Granny (search excerpt): https://joyofmotioncrochet.com/octagon-granny-square/
84. [S93] Hooks & Needles — Handling Pattern Errors (search excerpt): https://hooksneedles.com/blogs/news/mastering-pattern-typos-how-to-spot-and-fix-errors-quickly-to-finish-confidently

**Verification notes:**
- Pages fetched and read in full (via summarizer): S1, S2, S12–S16, S18, S20, S26, S27, S30, S33, S35, S36, S37, S40, S45, S47, S48, S50, S51, S55, S57–S59, S61–S66, S70, S71, S73, S75, S79, S80, S85, S86, S90, S91.
- Items marked "search excerpt" were seen only as search-result summaries.
- Interweave (filet shaping, triangle geometry, C2C), Crochet.com (filet) and Pixel Perfect Crochet returned HTTP 403.
- The CYC chart-symbol PDF could not be parsed as text; the HTML page was used instead.
