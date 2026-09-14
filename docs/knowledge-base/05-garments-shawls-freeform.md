# 05 — Shawls, Garments and Free-form Shapes: from Schematic to Rows

Research report for the crochet pattern designer knowledge base.
Compiled 2026-09-14. English. All figures in cm unless noted; inches given where the source uses them.

## How to read this report

Every factual claim carries a source URL in square brackets. Claims are tagged:

| Tag | Meaning |
|---|---|
| **[STD]** | Published industry standard (Craft Yarn Council, CYC) or a standard convention stated by a standards body |
| **[RoT]** | Rule of thumb used by designers or tech editors; widely repeated but not a formal standard |
| **[DERIVED]** | Geometry or arithmetic worked out for this report from the cited premises. The maths can be checked, but it has not been tested in yarn. |
| **[CONTESTED]** | Sources disagree, or the value depends heavily on the maker's tension, yarn or stitch |
| **[ANECDOTE]** | A single designer's reported experience |

Notation: `w` = the width of one stitch (cm/st) = 1 / stitch gauge (st/cm). `h` = the height of one row (cm/row) = 1 / row gauge (rows/cm). Gauge "15 sts × 8 rows = 10 cm" gives `stG = 1.5 st/cm`, `rG = 0.8 row/cm`, `w = 0.667 cm`, `h = 1.25 cm`.

---

## 0. Executive summary

1. **Gauge ratio drives the geometry.** For any flat shape, the number of increases a row needs is proportional to **h/w**: row height divided by stitch width. Crochet stitches range from roughly square (sc) to about twice as tall as wide (dc), so a crochet increase rate cannot be copied from knitting. This is why a flat circle starts with 6 sc, 8 hdc, 12 dc or about 16 tr ([Sarah Maker](https://sarahmaker.com/crochet-flat-circle/), [Dora Does](https://doradoes.co.uk/2020/12/12/how-to-crochet-a-flat-circle/)).
2. **Body sizing has a published standard.** The CYC Standard Body Measurements cover babies, children, youth, women (XS–5X) and men (S–5X). CYC also publishes a five-level ease chart ([CYC body sizing](https://www.craftyarncouncil.com/standards/body-sizing)).
3. **Schematic to rows is a small set of algorithms.** They are: stitches = width × stitch gauge, rounded to a stitch multiple; rows = height × row gauge; slopes spread with the "magic formula" or a Bresenham-style distribution; grading by repeating the calculation per size and running consistency checks ([Sister Mountain grading](https://www.sistermountain.com/blog/grading-knitting-patterns-stitch-row-counts), [Midnight Purl](https://www.midnightpurl.com/news-notes/taperedsleeves), [Knitting & Crochet Guild](https://kcguild.org.uk/learn/design/calculate-increases/)).
4. **Drop shoulder is the easiest construction to generate.** It is made only of rectangles. Top-down raglan comes next ([Dora Does, 6 constructions](https://doradoes.co.uk/2019/03/17/crochet-garment-making-demystified-6-common-ways-to-construct-a-crochet-sweater/)).
5. **Crochet fabric behaves differently from knit.** It is thicker, stretches less and drapes less, and it grows lengthwise with gravity and washing. Designers compensate with larger hooks, taller or more open stitches, blocked and hanging swatches, and more cautious negative ease ([Dora Does, drape](https://doradoes.co.uk/2020/01/18/its-all-about-that-drape-bout-that-drape-no-treble-how-to-find-the-right-drape-in-crochet-fabric/), [Interweave ease](https://www.interweave.com/article/crochet/garment-ease-crocheters-knitters/), [Blue Star Boutique](https://thebluestarboutique.com/2018/08/12/fighting-the-growth-in-your-crochet-garments/)).
6. **Free-form and 3D shapes are only partly automatable.** Research systems cover the surface of a 3D mesh with iso-contour rows spaced one row-height apart and sample stitches at stitch-width spacing, so increases and decreases fall out of the geometry. Examples are [Igarashi 2008](https://www-ui.is.s.u-tokyo.ac.jp/~takeo/papers/yuki_pg08_knit.pdf) and [AmiGo 2022](https://arxiv.org/abs/2211.01178). Garments add body fit, drape, seams and wearer preference, which these systems do not model.

---

## 1. Shawl geometries and their increase logic

### 1.1 The universal principle: increases per row scale with h/w

**Flat circle formula** [STD-like practitioner formula, DERIVED from circle geometry]:
`increases per round = 2π × row height / stitch width = 2π·h/w` ([Dora Does](https://doradoes.co.uk/2020/12/12/how-to-crochet-a-flat-circle/)).
Reason: each round adds one row-height to the radius, and the circumference grows by 2π for each unit of radius.

Worked example from that source: sc at 20 sts × 20 rows per 10 cm gives a stitch 0.5 × 0.5 cm, so after 5 rounds the diameter is 5 cm, the circumference 15.7 cm, and the stitch count 31.4. That is **6.28 increases per round, rounded to 6** ([Dora Does](https://doradoes.co.uk/2020/12/12/how-to-crochet-a-flat-circle/)).

Typical starting counts, which equal the increases per round:

| Stitch | Dora Does | Sarah Maker | Implied h/w if count = 2π·h/w [DERIVED] |
|---|---|---|---|
| sc | 6–7 | 6–8 | ≈ 1.0–1.2 |
| hdc | 8–10 | 8–10 | ≈ 1.3–1.6 |
| dc | 10–12 | 10–12 | ≈ 1.6–1.9 |
| tr | 14–18 | (16 per [FiberTools](https://fibertools.app/blog/crochet-circle-guide)) | ≈ 2.2–2.9 |

Sources: [Dora Does](https://doradoes.co.uk/2020/12/12/how-to-crochet-a-flat-circle/), [Sarah Maker](https://sarahmaker.com/crochet-flat-circle/). **[CONTESTED]** The ranges exist because tension varies. Sarah Maker: "tighter tension may require larger starting counts". Ruffling means too many stitches or loose tension; cupping means too few or tight tension ([Sarah Maker](https://sarahmaker.com/crochet-flat-circle/)).

Other circle rules:
- **Stagger the increases.** Stacking them in the same place every round turns the circle into a polygon (a hexagon for 6 increases). Offset them from about round 6 ([Sarah Maker](https://sarahmaker.com/crochet-flat-circle/), [Dora Does](https://doradoes.co.uk/2020/12/12/how-to-crochet-a-flat-circle/)). [RoT]
- **Large circles.** As the fabric relaxes, large circles tend to ruffle. Fixes are to increase less often (every 3–4 rounds) and to block ([Dora Does](https://doradoes.co.uk/2020/12/12/how-to-crochet-a-flat-circle/)). [RoT]

**Software implication [DERIVED]:** measure (or ask for) the user's **stitch gauge and row gauge in the chosen stitch**. Compute `I = 2π·stG/rG` (note that h/w = stG/rG). Round it, then show the user a range to test with a swatch.

### 1.2 Circle and semicircle shawls

- **Full circle:** `I_circle = 2π·h/w` per round, in 4–8+ equal wedges that each get one increase ([Creative Crochet Corner](https://www.creativecrochetcorner.com/post/two-easy-shawl-shapes)) [RoT].
- **Semicircle, worked flat in turned rows:** half the increases, `I_semi = π·h/w`. For sc that is **3 evenly spaced increases per row**, compared with 6 for a full circle. Start with ch 2 and 3 sc in the 2nd chain from the hook; each row adds 3 ([Inner Child Crochet](https://innerchildcrochet.com/resources/how_to_design/semicircle.html)).
- **Increase ranges given for circular/semicircular crochet:** sc 6–8, hdc 8–10, dc 10–12 per round, evenly spaced ([search summary citing Kristin Omdahl / Annie Design Crochet](https://www.kristinomdahl.com/crochet-half-circle-shawl-pattern/)). [RoT]
- **Kristin Omdahl's dc half-circle formula:** 3 foundation "ovals". Row 1 = 9 dc, Row 2 = 18, then **+9 per row** (27, 36, 45 …). The sample is 28 rows = 252 sts. Adjust the last row to the multiple the edging needs ([Kristin Omdahl](https://www.kristinomdahl.com/crochet-half-circle-shawl-pattern/)).
  **[CONTESTED]** Theory gives π·h/w ≈ 6 for dc at h/w ≈ 1.9. Omdahl's 9 implies a taller dc, or deliberate fullness that blocking removes. The engine must let designers override the theoretical rate.
- **Semicircle wedges:** the six-wedge method is preferred; four or eight also work. All wedges must have the same stitch count, with the increase at the start of each wedge ([Creative Crochet Corner](https://www.creativecrochetcorner.com/post/two-easy-shawl-shapes)). [RoT]

### 1.3 The Pi shawl (Elizabeth Zimmermann) and a crochet adaptation

**Principle [STD in knitting lore]:** C = π·d, so doubling the radius doubles the circumference. Zimmermann therefore doubled the stitch count each time the radius doubled, leaving plain rounds in between ([Interweave search summary](https://www.interweave.com/article/knitting/demystifying-the-pi-shawl-create-your-own-one-of-a-kind-circular-shawl/), [In the Loop Knitting](https://intheloopknitting.com/pi-shawl-knitting-patterns.php)). It appeared in *Knitter's Almanac* (same sources).

Knit example schedule ([verypink](https://verypink.com/2019/08/28/knitting-a-pi-circle/)):

| Round | Action | Sts |
|---|---|---|
| CO | cast on | 8 |
| 1 | knit | 8 |
| 2 | kfb all | 16 |
| 3–4 | knit (2) | 16 |
| 5 | kfb all | 32 |
| 6–9 | knit (4) | 32 |
| 10 | kfb all | 64 |
| 11–18 | knit (8) | 64 |
| 19 | kfb all | 128 |
| 20–35 | knit (16) | 128 |

**Crochet Pi circle** ([Dora Does, Pi method](https://doradoes.co.uk/2020/12/19/how-to-crochet-a-circle-using-the-pi-method/)): use the normal crochet starting count (6 for sc, 12 for dc) and double on rounds 2, 4, 8, 16 …:

| Round | 1 | 2 | 3 | 4 | 5–7 | 8 | 9–15 | 16 |
|---|---|---|---|---|---|---|---|---|
| sc sts | 6 | 12 | 12 | 24 | 24 | 48 | 48 | 96 |

The source says larger hooks and relaxed tension reduce curling between doublings, and that the finished piece needs blocking (same source).

**[DERIVED] Fit error of a pure Pi schedule.** Ideal stitch count at round n is `n·I` (I = 6 for sc). Just before a doubling, the fabric has about 50% of the ideal count: round 15 has 48 sts where 90 are ideal, a ratio of 0.53. Right after a doubling the ratio returns to 1.0. Knitted lace and heavy blocking absorb this; dense crochet cups visibly. Encodable options:
- (a) **Pure Pi** for open lace only, with a warning that blocking is required.
- (b) **Shifted Pi:** double at round `round(2^k × 0.75)` so the error is split ±25%.
- (c) **Linear increases** (§1.1) for solid stitches.

**Half-Pi:** the same doubling logic worked in turned rows starting from a semicircle ([The Snugglery](https://thesnugglery.net/how-to-knit-the-half-pi-shawl/)).

### 1.4 Top-down symmetrical triangle

**Construction [RoT, practitioner]:** a pair of increases at the centre spine plus one increase at each edge. In crochet, dc triangles increase **every row**; sc triangles are said to increase **every other row**. Two edge stitches can form a selvedge, and a double increase at the edges gives "wings" that sit better on the shoulders ([Creative Crochet Corner](https://www.creativecrochetcorner.com/post/two-easy-shawl-shapes)). Place a marker in the centre (spine) space from row 2 and move it up each row ([Joanna's Crochet](https://www.joannascrochet.com/2026/02/free-triangle-shawl-crochet-pattern.html)). Knit standard: 4 increases every other row ([Holly Chayes](https://www.hollychayes.com/2013/05/27/shawl-geometry-triangle-with-wings/)).

**Knit wings:** in the second half, increase along the top edge every row instead of every other row ([Holly Chayes](https://www.hollychayes.com/2013/05/27/shawl-geometry-triangle-with-wings/)).

**Row-count formula for a bottom-up/top-down triangle:** `rows = (depth / 2) × 1.4142 × row gauge` ([Holly Chayes](https://www.hollychayes.com/2013/05/27/shawl-geometry-triangle-with-wings/)). "Depth" here is spine length × 2, i.e. the formula is equivalent to `spine depth D / √2 × rG`, which matches the derivation below.

**Design angle:** a 45° angle between the row and the edge gives the balanced shape. Sharper angles make shallow shawls; wider angles make elongated ones ([Make My Day Creative](https://makemydaycreative.com/2015/05/30/how-to-design-crochet-patterns-triangular-shawl-bonus/)).

#### [DERIVED] Exact geometry of the classic top-down triangle

Target: wingspan `2D`, spine depth `D`, a right angle at the top centre T in each half (the top edge is straight, the spine perpendicular to it), a 90° bottom point, and 45° top corners.

- Each half is a right isosceles triangle with legs D. Rows run parallel to its hypotenuse (the lower edge).
- The perpendicular distance from T to the lower edge is `D/√2`, so the **number of rows is `N = D·rG / √2`**.
- Row k lies k·h from T. Its length in one half is `2·k·h`, which is `2·k·h/w` stitches.
- **Increases per row, whole shawl: `I = 4·h/w = 4·stG/rG`.** They are split between the edges and the spine: per half, the edge gets `h/w` and the spine side gets `h/w`.
- **Final row stitch count ≈ `2√2 · D · stG`** (plus spine and edge stitches).

Check against the knit convention: garter stitch has rG ≈ 2 × stG, so `I = 4 × 0.5 = 2` per row = 4 per 2 rows. That matches "4 increases every other row" ([Holly Chayes](https://www.hollychayes.com/2013/05/27/shawl-geometry-triangle-with-wings/)).

**[CONTESTED] Crochet practice versus theory.** A dc at h/w ≈ 1.9 needs I ≈ 7.5 per row, yet many dc patterns add 4 per row plus edge double increases (6). An sc at h/w ≈ 0.9 needs I ≈ 3.6 per row, yet "every other row" is also recommended ([Creative Crochet Corner](https://www.creativecrochetcorner.com/post/two-easy-shawl-shapes)). Under-increasing makes a deeper, narrower shawl, or relies on blocking to stretch the fabric sideways. The engine should compute the theoretical rate, then let the designer choose a "stylised" rate and preview the resulting angle.

#### Worked example A — top-down dc triangle shawl

Assumptions: dc in fingering/sport weight, **blocked** gauge 16 sts × 8 rows = 10 cm, so stG = 1.6 and rG = 0.8. Target: wingspan 160 cm, depth D = 80 cm.

1. Rows: `N = 80 × 0.8 / 1.4142 = 45.25`, **45 rows**.
2. Increases per row: `I = 4 × 1.6 / 0.8 = 8`. Split per row: +2 at each edge and +4 at the spine.
3. Row template (US terms): `Ch 3 (counts as dc), 2 dc in first st [ch-3 + 2 dc into one st = +2 at edge], dc in each dc to spine ch-2 sp, (2 dc, ch 2, 2 dc) in ch-2 sp [+4], dc in each dc to last st, 3 dc in last st [+2]. Turn.`
   Setup row 1: into a ring, `ch 3, 3 dc, ch 2, 4 dc` = 8 dc.
4. Stitch count at row n = 8n dc (ignoring the spine ch-2). Row 45 = **360 dc**. Theory `2√2·80·1.6 = 362` ✓.
5. Consistency check: row 45 spans 360 × 0.625 cm = 225 cm along the two lower edges. The lower-edge length is 2·D·√2 = 226 cm ✓.
6. Stitch multiple: if the border needs a multiple of 6 + 3 per half, adjust the last 1–2 rows with ±2 increases ([Kristin Omdahl](https://www.kristinomdahl.com/crochet-half-circle-shawl-pattern/) describes this last-row adjustment).

Same shawl in sc at 20 sts × 22 rows/10 cm: `I = 4 × 2.0/2.2 = 3.64` per row, `N = 124` rows. **Symmetry constraint:** increases come in pairs (one per half), so only even counts are possible. The schedule becomes "+4 on 4 rows, +2 on 1 row" (average 3.6), with the +2 row alternating between spine-only and edges-only. [DERIVED]

### 1.5 Side-to-side asymmetrical triangle

- Crochet: increase one stitch on the same side every row (practitioner description, via [Annie Design Crochet](https://www.anniedesigncrochet.com/easy-asymmetrical-crochet-lace-shawl-free-pattern/) search summary).
- Knit variant: a double increase on one edge and a single decrease on the other edge gives net +1 per 2 rows. Increasing more often (RS and WS rows) makes the shawl deeper and steeper. Increasing less often (every other RS row) gives a longer wingspan and a shallower, scarf-like shape ([Tonia Knits](https://toniaknits.com/how-to-knit-an-asymmetrical-triangle-shawl/)).
- A long narrow triangle comes from increasing on one edge every row and decreasing on the other every other row ([search summary, A Bee in the Bonnet](https://www.abeeinthebonnet.com/blog/how-to-knit-a-triangle-shawl-for-beginners-4-easy-shapes/)). [RoT]

**[DERIVED] Angle control.** With net growth `g` stitches per row on the sloped edge, the edge angle from the row direction is `θ = atan( h / (g·w) )`. For a right triangle with a 45° slope, `g = h/w`: for dc (h/w ≈ 2) that is +2 sts per row, and for sc (≈ 1) +1 per row. A "long narrow" triangle with angle θ needs `g = h / (w·tan θ)`.

### 1.6 Crescent

- **Knit edge-increase crescent:** garter tab of 7 sts; `K3, yo, k to marker, yo, k3` every row, i.e. +2 per row at the edges with no spine increase ([A Bee in the Bonnet](https://www.abeeinthebonnet.com/blog/easy-crescent-shawl-knitting-formula-free-tutorial/)). Top-down crescents increase 2 per row at the ends; some RS rows use double increases for +4 ([search summary, rhyFlower Knits](https://rhyflowerknits.com/basic-top-down-crescent/)).
- **Wedge crescent ([Holly Chayes](https://www.hollychayes.com/2013/07/29/shawl-geometry-crescents/)):** 8 equal wedges, 4 shaped in one direction and 4 in the other. Top-down it uses 8 single increases per increase row, alternating with plain rows; bottom-up it uses 8 decreases. Bottom-up formula: `rows = row gauge × depth`, `dec rows = rows/2`, `sts decreased = dec rows × 8`, `sts per section = cast-on/8`. Top-down cast-on is 13 sts (4 border + 8 sections + 1 spine).
- **Crochet crescent via short rows:** hdc rows that turn progressively further from the centre build wedges; each 6-short-row section adds one wedge ([search summary of Interweave/Dora Does short-row tutorials](https://doradoes.co.uk/2023/09/20/crochet-short-rows-what-they-are-when-and-how-to-use-them/)).
- **[DERIVED] Classifier for top-down "neck-edge" shawls.** Let `e` = edge increases per side per row, `s` = interior (spine or wedge) increases per row, `r = h/w`.
  - Triangle: `e = r`, `s = 2r` (§1.4).
  - Crescent: `e > r` with `s` small or zero. The top edge grows faster than the depth, so the neck edge curves.
  - Semicircle: `e ≈ 0` with `s = π·r` spread over wedges.
  - "Triangle with wings": `e` switches from `r` to `2r` part-way.

### 1.7 Rectangular stoles, wraps, shawlettes — typical dimensions

| Item | Typical size | Source |
|---|---|---|
| Stole | ≈ 20 × 70 in (51 × 178 cm) | [SewGuide](https://sewguide.com/scarf-shawl-stole-wrap-measurement/) |
| Standard (rectangular) shawl | 30–45 × 70–85 in (76–114 × 178–216 cm) | [SewGuide](https://sewguide.com/scarf-shawl-stole-wrap-measurement/) |
| Triangle scarf/shawl | ≈ 60 in wide × 30 in deep (152 × 76 cm) | [SewGuide](https://sewguide.com/scarf-shawl-stole-wrap-measurement/) |
| Shawl length / depth | 65–85 in (165–215 cm) long; depth 25–30 in (63–76 cm) at the deepest point | [Sivana](https://www.sivanaspirit.com/blogs/sivana/how-long-should-a-shawl-be) |
| Wrap-around wingspan | ≈ wearer's arm span, fingertip to fingertip | [Sivana](https://www.sivanaspirit.com/blogs/sivana/how-long-should-a-shawl-be) |
| Square shawl | 55–70 in square, 64 in "standard" | [Sivana](https://www.sivanaspirit.com/blogs/sivana/how-long-should-a-shawl-be) |
| Half-circle kerchief / shawlette / shawl | Omdahl lists kerchief 36", shawlette 24–30", full shawl 36–40". The dimension measured is not stated (likely radius/depth or wingspan). | [Kristin Omdahl](https://www.kristinomdahl.com/crochet-half-circle-shawl-pattern/) |

**[CONTESTED]** No industry standard for "shawlette" was found. Treat these dimensions as editable defaults. A rectangle stole needs no shaping: `sts = width × stG` (rounded to the stitch multiple) and `rows = length × rG`.

### 1.8 Lace blocking

- **Wet blocking steps:** soak (about 20 min), press water out without wringing, roll in a towel. Thread blocking wires through the edge stitches every few cm, pin along the wires to the schematic measurements, and dry flat ([Crochet Spot](https://www.crochetspot.com/how-to-wet-block-crocheted-lace-with-wires/); soak time from the [Knit Picks lace blocking search summary](https://www.knitpicks.com/learning-center/blocking-lace)).
- Linen needs blocking for a professional finish; acrylic behaves differently ([Crochet Spot](https://www.crochetspot.com/how-to-wet-block-crocheted-lace-with-wires/)).
- **Growth when blocked:** some fibres let a shawl "almost double" when aggressively blocked; metallics and rayon grow less. This comes from a blocking-tutorial search summary, **not verified to one page** [CONTESTED].
- Wet blocking natural fibres increases drape a lot. Steam or heat permanently changes ("kills") acrylic; wool and cotton are more reversible ([Dora Does, drape](https://doradoes.co.uk/2020/01/18/its-all-about-that-drape-bout-that-drape-no-treble-how-to-find-the-right-drape-in-crochet-fabric/)).
- **Encodable rule [DERIVED]:** keep **two gauges**, unblocked and blocked (optionally pinned-stretched). Lace shawls should be computed from the **blocked** gauge. Stitch counts come out the same; the preview shows unblocked versus blocked size.

---

## 2. Garment construction methods in crochet

### 2.1 Comparison

| Construction | Shape logic | Seams | Skill | Fit notes | Source |
|---|---|---|---|---|---|
| **Drop shoulder** | Rectangles: front, back, 2 sleeves | Sides, shoulders, sleeves, underarm | Beginner | Loose; bulk at the underarm; neck shaping optional | [Dora Does](https://doradoes.co.uk/2019/03/17/crochet-garment-making-demystified-6-common-ways-to-construct-a-crochet-sweater/) |
| **Modified drop** | Rectangles plus a squared-out underarm notch | Angled underarm | Beg–Int | Less bulk than plain drop | same |
| **Set-in sleeve** | Curved armhole plus sleeve cap | Curved seams need precision | Int–Adv | Most tailored; no underarm bulk | same; [Sister Mountain set-in](https://www.sistermountain.com/blog/design-knit-set-in-sleeve) |
| **Dolman / batwing** | One T-shaped piece | Minimal (shoulder/top) | Beg–Int | Loose only | [Dora Does](https://doradoes.co.uk/2019/03/17/crochet-garment-making-demystified-6-common-ways-to-construct-a-crochet-sweater/) |
| **Top-down raglan** | Rectangle at the neck; 4 diagonal increase lines | Seamless | Int | Adjustable while working; sporty look | same; [Interweave raglan (search summary)](https://www.interweave.com/article/crochet/fof-plan-top-down-raglan/) |
| **Top-down circular yoke** | Circle-like increases spread around the yoke; split at the underarm | Seamless | Int–Adv | Short rows needed to raise the back neck | [Dora Does top-down](https://doradoes.co.uk/2019/01/29/demystifying-crochet-garment-making-top-down-crochet-sweaters-explained/) |
| **Granny-square / motif** | Grid of motifs | Many joins | Beg | Size set by square size × count; hook size changes square size | [Joy of Motion](https://joyofmotioncrochet.com/granny-square-sweater/), [TL Yarn Crafts search summary](https://tlycblog.com/how-to-crochet-a-colorful-granny-square-cardigan-rose-cardigan/) |
| **Cardigan** (any of the above, fronts split) | Two fronts plus bands | As base construction | Varies | Needs ≥ 5 cm positive ease at the bust to avoid gaping | [Sister Mountain ease](https://www.sistermountain.com/blog/ease-knitting-pattern-design), [Dora Does cardigans](https://doradoes.co.uk/2023/03/02/all-about-crochet-cardigans-6-ways-to-crochet-a-cardigan/) |

Construction-specific ease ([Sister Mountain ease](https://www.sistermountain.com/blog/ease-knitting-pattern-design)) [RoT]:
- Drop shoulder: 15–30 cm positive ease at the bust.
- Set-in sleeve: less ease; negative ease possible.
- Raglan: works with any ease.

### 2.2 Programmatic difficulty ranking [DERIVED from the construction descriptions above]

1. **Rectangle shawl/stole, drop-shoulder panels, dolman rectangle.** Only `sts = W·stG` and `rows = L·rG`, plus optional neck notches. No slope algorithm needed.
2. **Granny-square garments.** Grid layout: `n_squares_around = round(finished circumference / square size)`, and square size = f(rounds, hook). The CYC-style rule "divide target bust by 10 for square size" (5 squares on front + 5 on back) is one designer's layout ([TL Yarn Crafts, search summary](https://tlycblog.com/how-to-crochet-a-colorful-granny-square-cardigan-rose-cardigan/)). Joy of Motion instead changes **square size by hook**: 11.5 cm squares with a 5.5 mm hook versus 14 cm with 6.5 mm, 44 or 76 squares across size groups ([Joy of Motion](https://joyofmotioncrochet.com/granny-square-sweater/)). Discrete sizes mean the ease jumps between sizes.
3. **Top-down raglan.** One linear increase rule on 4 lines, plus underarm chains and a check that front/back and sleeve counts both reach their targets (see Worked example C, which shows why that is not trivial in dc).
4. **Modified drop / drop with neck and sleeve taper.** Adds slope distribution.
5. **Circular yoke.** Increase rounds spaced over the yoke depth; stitch multiples for colourwork; back-neck short rows.
6. **Set-in sleeve.** Two coupled curves: the armhole and the sleeve cap must have matching seam lengths (cap ≈ armhole + 2.5–4 cm of easing; see §4.6). This is the most error-prone to generate.

### 2.3 Top-down yoke mechanics (crochet)

- Start with a chain (or foundation row) sized to the neck. For a raglan, split it into 4 sections (front, back, 2 sleeves) plus corner stitches; for a "square raglan" the count divides by 4 ([search summary, Mary Maxim / Khe-Yo raglan guides](https://www.marymaxim.com/blogs/tutorials/a-beginners-guide-to-crocheting-a-raglan-sweater)).
- **Joining:** work the first row flat and then join, so twists are visible ([Lion Brand mesh raglan CAL](https://www.lionbrand.com/community/blog/mesh-raglan-pullover-crochet-along-starting-chain-and-raglan-increases/)).
- **Raglan increase:** a V-stitch (dc, ch 1, dc) in the corner ch-1 space at each of the 4 corners adds **8 sts per round** ([Lion Brand](https://www.lionbrand.com/community/blog/mesh-raglan-pullover-crochet-along-starting-chain-and-raglan-increases/)). Raglan increases are often every other round (8 sts per increase round); the yoke usually runs 15–20 rounds depending on size and yarn ([search summary, Mary Maxim/Khe-Yo](https://www.marymaxim.com/blogs/tutorials/a-beginners-guide-to-crocheting-a-raglan-sweater)) [RoT].
- **"Cheat" stitches:** compute the stitch count the raglan rate reaches and subtract it from the bust count. The shortfall is made up with underarm cast-on chains ([Interweave "Focus on Fit" raglan, search summary](https://www.interweave.com/article/crochet/fof-plan-top-down-raglan/)).
- **Row gauge controls yoke length.** Many CAL participants changed hooks to balance stitch and row gauge ([Lion Brand](https://www.lionbrand.com/community/blog/mesh-raglan-pullover-crochet-along-starting-chain-and-raglan-increases/)).
- **Split:** once the yoke reaches underarm depth, mark the sleeve stitches. Work across the back, chain for the underarm, skip the sleeve, work across the front, chain, skip the other sleeve. The underarm chains are counted in both body and sleeve totals ([Dora Does top-down](https://doradoes.co.uk/2019/01/29/demystifying-crochet-garment-making-top-down-crochet-sweaters-explained/)).
- **Adjusting fit:** add or remove underarm chains to change the chest; redistribute the split (fewer stitches to the back than the front, fewer to the sleeves); keep increase rounds evenly spread ([Dora Does, adjusting yokes](https://doradoes.co.uk/2019/12/04/how-to-adjust-top-down-yoke-crochet-sweaters-to-fit/)).

---

## 3. Body measurements and sizing

### 3.1 CYC Standard Body Measurements — Women [STD]

Source: [CYC Woman Size](https://www.craftyarncouncil.com/standards/woman-size)

| Measurement | XS | S | M | L | XL |
|---|---|---|---|---|---|
| Chest/bust | 28–30" (71–76) | 32–34" (81–86) | 36–38" (91.5–96.5) | 40–42" (101.5–106.5) | 44–46" (111.5–117) |
| Centre back neck-to-wrist | 26–26½" (66–68.5) | 27–27½" (68.5–70) | 28–28½" (71–72.5) | 29–29½" (73.5–75) | 29–29½" (73.5–75) |
| Back waist length | 16½" (42) | 17" (43) | 17¼" (43.5) | 17½" (44.5) | 17¾" (45) |
| Cross back | 14–14½" (35.5–37) | 14½–15" (37–38) | 15½–16" (39.5–40.5) | 16½–17" (42–43) | 17½" (44.5) |
| Arm length to underarm | 16½" (42) | 17" (43) | 17" (43) | 17½" (44.5) | 17½" (44.5) |
| Upper arm | 9¾" (25) | 10¼" (26) | 11" (28) | 12" (30.5) | 13½" (34.5) |
| Armhole depth | 6–6½" (15.5–16.5) | 6½–7" (16.5–17.5) | 7–7½" (17.5–19) | 7½–8" (19–20.5) | 8–8½" (20.5–21.5) |
| Waist | 23–24" (58.5–61) | 25–26½" (63.5–67.5) | 28–30" (71–76) | 32–34" (81.5–86.5) | 36–38" (91.5–96.5) |
| Hips | 33–34" (83.5–86) | 35–36" (89–91.5) | 38–40" (96.5–101.5) | 42–44" (106.5–111.5) | 46–48" (116.5–122) |

| Measurement | 2X | 3X | 4X | 5X |
|---|---|---|---|---|
| Chest/bust | 48–50" (122–127) | 52–54" (132–137) | 56–58" (142–147) | 60–62" (152–158) |
| Centre back neck-to-wrist | 30–30½" (76.5–77.5) | 30½–31" (77.5–79) | 31½–32" (80–81.5) | 31½–32" (80–81.5) |
| Back waist length | 18" (45.5) | 18" (45.5) | 18½" (47) | 18½" (47) |
| Cross back | 18" (45.5) | 18" (45.5) | 18½" (47) | 18½" (47) |
| Arm length to underarm | 18" (45.5) | 18" (45.5) | 18½" (47) | 18½" (47) |
| Upper arm | 15½" (39.5) | 17" (43) | 18½" (47) | 18½" (49.5)* |
| Armhole depth | 8½–9" (21.5–23) | 9–9½" (23–24) | 9½–10" (24–25.5) | 10–10½" (25.5–26.5) |
| Waist | 40–42" (101.5–106.5) | 44–45" (111.5–114) | 46–47" (116.5–119) | 49–50" (124–127) |
| Hips | 52–53" (132–134.5) | 54–55" (137–139.5) | 56–57" (142–144.5) | 61–62" (155–157) |

**Data-quality warnings** (as the page rendered when fetched):
- \*The 5X upper arm shows 18½" beside 49.5 cm; 49.5 cm = 19½".
- For 2X–5X, the cross back, back waist length and arm length rows are identical (18/18/18½/18½), which looks like a copy error.

Store the values with provenance and validate them. Do not trust them blindly.

### 3.2 CYC — Men [STD]

Source: [CYC Man Size](https://www.craftyarncouncil.com/standards/man-size)

| Measurement | S | M | L | XL | 2X | 3X | 4X | 5X |
|---|---|---|---|---|---|---|---|---|
| Chest (in) | 34–36 | 38–40 | 42–44 | 46–48 | 50–52 | 54–56 | 58–60 | 62–64 |
| Chest (cm) | 86–91.5 | 96.5–101.5 | 106.5–111.5 | 116.5–122 | 127–132 | 137–142 | 147.5–152 | 157.5–162.5 |
| CB neck-to-wrist (cm) | 81–82.5 | 83.5–85 | 86.5–87.5 | 89–90 | 91.5–92.5 | 94–95 | 96.5–97.5 | 99–100.5 |
| "Back waist/hip length" (cm) | 58.5–61 | 63.5–66 | 66–68.5 | 71 | 73.5 | 76 | 76 | 79 |
| Cross back (cm) | 39.5–40.5 | 42–43 | 44.5–45.5 | 45.5–47 | 48–51 | 48–51 | 51–54.5 | 56–57 |
| Arm length to underarm (cm) | 45.5 | 47 | 49.5 | 50.5 | 52 | 52 | 49.5* | 53.5–54.5 |

**Warnings:**
- The page labels the 58–79 cm row "Back Waist Length". Those values are hip-length (garment length) values; treat it as back **hip** length.
- \*4X arm length shows 21" = 53.5 cm, but the page says 49.5 cm.

### 3.3 CYC — Children & Youth [STD]

Source: [CYC Child/Youth](https://www.craftyarncouncil.com/standards/child-youth-sizes)

| Measurement (cm) | 2 | 4 | 6 | 8 | 10 | 12 | 14 | 16 |
|---|---|---|---|---|---|---|---|---|
| Chest | 53 | 58.5 | 63.5 | 67 | 71 | 76 | 80 | 82.5 |
| CB neck-to-wrist | 45.5 | 49.5 | 52 | 56 | 61 | 66 | 68.5 | 71 |
| Back waist length | 21.5 | 24 | 26.5 | 31.5 | 35.5 | 38 | 39.5 | 40.5 |
| Cross back | 23.5 | 25 | 26 | 27 | 28.5 | 30.5 | 31 | 33 |
| Arm length to underarm | 21.5 | 26.5 | 29 | 31.5 | 34.5 | 38 | 40.5 | 42 |
| Upper arm | 17.5 | 19 | 20.5 | 21.5 | 22 | 23 | 23.5 | 24 |
| Armhole depth | 10.5 | 12 | 12.5 | 14 | 15.5 | 16.5 | 17.5 | 19 |
| Waist | 53.5 | 54.5 | 57 | 59.5 | 62 | 63.5 | 67.5 | 69.5 |
| Hips | 56 | 59.5 | 63.5 | 71 | 75 | 80 | 83.5 | 90 |

Inches, in the same order: chest 21, 23, 25, 26½, 28, 30, 31½, 32½ ([CYC](https://www.craftyarncouncil.com/standards/child-youth-sizes)).

### 3.4 CYC — Babies [STD]

Source: [CYC Baby Size](https://www.craftyarncouncil.com/standards/baby-size-chart)

| Measurement | 3 mo | 6 mo | 12 mo | 18 mo | 24 mo |
|---|---|---|---|---|---|
| Chest | 16" (40.5) | 17" (43) | 18" (45.5) | 19" (48) | 20" (50.5) |
| CB neck-to-wrist | 10½" (26.5) | 11½" (29) | 12½" (31.5) | 14" (35.5) | 18" (45.5) |
| Back waist length | 6" (15.5) | 7" (17.5) | 7½" (19) | 8" (20.5) | 8½" (21.5) |
| Cross back | 7¼" (18.5) | 7¾" (19.5) | 8¼" (21) | 8½" (21.5) | 8¾" (22) |
| Arm length to underarm | 6" (15.5) | 6½" (16.5) | 7½" (19) | 8" (20.5) | 8½" (21.5) |
| Upper arm | 5½" (14) | 6" (15.5) | 6½" (16.5) | 7" (17.5) | 7½" (19) |
| Armhole depth | 3¼" (8.5) | 3½" (9) | 3¾" (9.5) | 4" (10) | 4¼" (10.5) |
| Waist | 18" (45.5) | 19" (48) | 20" (50.5) | 20½" (52) | 21" (53.5) |
| Hips | 19" (48) | 20" (50.5) | 20" (50.5) | 21" (53.5) | 22" (56) |

### 3.5 Ease

**CYC Bust/Chest Fit and Ease Chart [STD]** ([CYC body sizing](https://www.craftyarncouncil.com/standards/body-sizing); reproduced by [Lion Brand](https://www.lionbrand.com/community/blog/garment-ease-and-fit/) and [Sister Mountain](https://www.sistermountain.com/blog/ease-knitting-pattern-design)):

| Fit | Ease vs actual bust/chest |
|---|---|
| Very close fitting | −5 to −10 cm (−2 to −4") |
| Close fitting | 0 |
| Classic fit | +5 to +10 cm (+2 to +4") |
| Loose fit | +10 to +15 cm (+4 to +6") |
| Oversized | +15 cm or more (+6"+) |

CYC also advises: "It is always better to have someone else do the measuring" ([CYC body sizing](https://www.craftyarncouncil.com/standards/body-sizing)).

**Ease by garment and location [RoT]:**

| Garment / location | Typical ease | Source |
|---|---|---|
| Cardigan, bust | ≥ +5 cm (prevents gaping when buttoned) | [Sister Mountain](https://www.sistermountain.com/blog/ease-knitting-pattern-design) |
| Layering pieces | +5 to +20 cm depending on what is worn underneath | same |
| Drop-shoulder sweater, bust | +15 to +30 cm | same |
| Set-in sleeve sweater | less positive ease; negative possible | same |
| Raglan | any | same |
| Sleeves / upper arm | usually about +5 cm | same |
| Form-fitting with negative ease | add about 70% of the negative ease as extra length (e.g. 2.5 cm negative ease → +1.9 cm length) | same |
| Proportional ease | larger bodies need more ease for the same visual fit; give a range (e.g. +10 to +20 cm) rather than one number | same |
| Hats | about −5 cm (−2") | [Dora Does ease](https://doradoes.co.uk/2021/09/17/understanding-ease-in-crochet-garments-positive-and-negative-ease-explained/) |
| Hats, by size | −2.5 cm (−1") for head < 46 cm (18"); −5 cm (−2") for head > 46 cm | [Treasurie](https://blog.treasurie.com/crochet-hat-size-guide-charts-printable-templates/) |
| Crochet ribbing / negative-ease pieces | **crochet about 5–10% negative ease (up to 15% for thin yarn in ribbing); knit 10–20%**, because crochet stretches less | [Interweave (search summary)](https://www.interweave.com/article/crochet/garment-ease-crocheters-knitters/) |
| Granny-square cardigans | 0 to +25 cm (0–10") | [TL Yarn Crafts search summary](https://tlycblog.com/how-to-crochet-a-colorful-granny-square-cardigan-rose-cardigan/) |

Dora Does restates the CYC-derived bands as: close = negative to 0, fitted = 0 to +5, classic = +5 to +10, loose = +10 to +15, oversized = +15 or more. It also warns that thick crochet fabric raises the question of measuring the inside versus the outside of the garment when margins are small ([Dora Does ease](https://doradoes.co.uk/2021/09/17/understanding-ease-in-crochet-garments-positive-and-negative-ease-explained/)).

**[CONTESTED]** CustomFit (knit) offered "close, average, relaxed, oversized" presets ([CustomFit search summary](https://customfit.amyherzogdesigns.com/about/?mwl_redirect=true)). The numeric boundaries of each preset vary by vendor.

### 3.6 Choosing size: finished measurements beat size letters

- DROPS/Garnstudio publishes a measurement diagram of **half-widths in cm** per size (e.g. chest width XS 46, S 50, M 54, L 58, XL 63, XXL 69, XXXL 75). Makers are told to lay a favourite garment flat, measure it and pick the closest number, because S/M/L definitions vary by country ([Garnstudio lesson](https://www.garnstudio.com/lesson.php?id=24&cid=19)). [STD for DROPS]
- Always choose from finished measurements, not size labels; at minimum measure bust and bicep ([Dora Does ease](https://doradoes.co.uk/2021/09/17/understanding-ease-in-crochet-garments-positive-and-negative-ease-explained/)).
- Two people with the same bust can need completely different shaping ([Hodgepodge Crochet](https://hodgepodgecrochetcom.wordpress.com/2026/05/21/why-crochet-clothes-dont-fit-and-why-its-usually-not-the-crocheters-fault/)).

### 3.7 What a designer's schematic contains [RoT / tech-editing convention]

- One outline per piece (or per shaped zone for seamless work), with every width and length **in finished (blocked) measurements for all sizes**, written `S (M, L, …)`.
- Widths: bust/chest, hem/hip, waist if shaped, cross back / shoulder, neck width, upper arm, cuff.
- Depths: total length, hem band, length to underarm, armhole depth, neck depth (front and back), shoulder slope, sleeve length, cap height.
- Arrows showing the direction of work, and seam lines.
- Tech editors check that the schematic matches the instructions ([Artisan Tech Editor, tip #18](https://techeditor.co.uk/crochet-designer-resources-toolkit/52-crochet-tech-editing-tips/): "Include a Clear Schematic for Shaped Garments"; tip #27: diagrams for complex shaping; [MadameStitch](https://www.madamestitch.com/professional-services/crochet-technical-editing/): editors verify schematics, charts and grading).

### 3.8 Grading across sizes

**Method ([Sister Mountain grading](https://www.sistermountain.com/blog/grading-knitting-patterns-stitch-row-counts))** [RoT, spreadsheet workflow]:
1. Columns per size: body measurement, ease, finished measurement.
2. `stitches = MROUND(measurement × stitch gauge, multiple) + selvedge`, where `multiple` = the stitch-pattern repeat (e.g. 4 for 2×2 rib).
3. `rows = (length − trim) × row gauge`, rounded to **even** numbers so shaping starts on the correct side.
4. Armhole: `sts to remove per side = (bust sts − shoulder sts) / 2`; initial bind-off 1.5–2.5 cm × stG.
5. Neck: `neck sts = neck width × stG`, `neck rows = neck depth × rG`; initial neck bind-off 30–50% of neck sts.
6. Shoulders: `(shoulder-to-shoulder sts − neck sts) / 2`, split into steps of 2 rows each.
7. **Boolean checks per size** (does the final count equal the target?). "Initial armhole calculations resulted in FALSE readings for nearly all sizes" is normal; fix by changing the rows in each decrease phase, not the total length.
8. "The spreadsheet is simply the foundation" and "will never replace a tech editor."

**Stitch-pattern repeats across sizes ([Kate Atherley via Stitchmastery](https://stitchmastery.com/grading-pattern-repeats-for-garments-and-larger-projects-guest-article-by-kate-atherley/))** [RoT]:
- Pick a motif that fits the smallest size and add background stitches for larger sizes. This works when size differences are modest.
- Add whole repeats for wide size ranges.
- Scale the motif itself.
- Add smaller complementary elements (e.g. 4-, 6- and 8-stitch cables across sizes).
- Place shaping inside small pattern elements; decreasing into a 36-stitch motif gets "very complicated."
- "Telling someone to change their needle size to knit a different size … is not grading" ([Knitter's Review of Atherley](https://www.knittersreview.com/the-beginners-guide-to-writing-knitting-patterns-by-kate-atherley/)).

**Motif garments are graded differently:** by changing hook and therefore square size, plus square count ([Joy of Motion](https://joyofmotioncrochet.com/granny-square-sweater/)). **[CONTESTED]** This conflicts with Atherley's view that changing tool size is not grading. For modular crochet it is established practice, but the fabric changes (drape and density) between sizes.

**Real-body grading, not just scaling:** "A larger size does not just need 'more stitches'". Shoulders, bust placement, armholes and drape must be reshaped ([Hodgepodge Crochet](https://hodgepodgecrochetcom.wordpress.com/2026/05/21/why-crochet-clothes-dont-fit-and-why-its-usually-not-the-crocheters-fault/)). The CYC tables themselves grow non-linearly: cross back grows only about 0.5–1" per size above XL while the bust grows 4" ([CYC Woman](https://www.craftyarncouncil.com/standards/woman-size)).

---

## 4. From schematic to stitches

### 4.1 Core conversions

- Stitches: `S = W_finished × stG`. Rows: `R = H_finished × rG` ([Sister Mountain grading](https://www.sistermountain.com/blog/grading-knitting-patterns-stitch-row-counts)).
- **Foundation chain (US terms) [STD convention via CYC]:** the sc turning chain (ch 1) does not count as a stitch; for dc the ch 3 counts as the first stitch ([CYC How to Read a Crochet Pattern](https://www.craftyarncouncil.com/standards/how-to-read-crochet-pattern)). So the foundation chain = stitches + 1 (sc), +1 (hdc with ch 2 counted, which varies), +2 (dc, working into the 4th chain from the hook). Tech editors must clarify turning-chain conventions ([Artisan Tech Editor tip #25](https://techeditor.co.uk/crochet-designer-resources-toolkit/52-crochet-tech-editing-tips/)).
- **Gauge swatches lie at garment scale:** "A tiny 4-inch square does not tell you how heavy the finished sweater will become" ([Hodgepodge Crochet](https://hodgepodgecrochetcom.wordpress.com/2026/05/21/why-crochet-clothes-dont-fit-and-why-its-usually-not-the-crocheters-fault/)). See §7.

### 4.2 Rounding rules [RoT + DERIVED]

| Quantity | Rule | Source |
|---|---|---|
| Stitch count with a stitch pattern | Round to the nearest `k·m + c` (m = repeat, c = edge/balance sts) | [Sister Mountain grading](https://www.sistermountain.com/blog/grading-knitting-patterns-stitch-row-counts) |
| Tie-break | Round toward the ease intent: up for loose/drop-shoulder, down for fitted. Report the resulting ease. | DERIVED |
| Row counts | Round to even (shaping on RS) | [Sister Mountain grading](https://www.sistermountain.com/blog/grading-knitting-patterns-stitch-row-counts) |
| Symmetric pieces | Stitches to remove per side must be an integer, so `(S_start − S_end)` must be even (or put the extra stitch centrally) | DERIVED |
| Measurement display | Convert cm → in to ¼" | [Sister Mountain grading](https://www.sistermountain.com/blog/grading-knitting-patterns-stitch-row-counts) |
| Grading sanity | Rounded numbers must "make sense" across sizes (monotonic, even steps) | [Artisan Tech Editor tip #8](https://techeditor.co.uk/crochet-designer-resources-toolkit/52-crochet-tech-editing-tips/) |

### 4.3 Distributing increases/decreases evenly **across a row**

- Interval = `current sts ÷ changes`. Example: 60 sts, 6 increases → increase every 10th stitch ([Lion Brand / 10 Rows a Day search summary](https://www.10rowsaday.com/evenly-increase-decrease)).
- When the division leaves a remainder, alternate two adjacent intervals and spread the longer ones out. Example: 75 sts with 8 increases = 5 sections of 9 and 3 sections of 10 ([KnitTools search summary](https://knittoolsapp.com/articles/increase-decrease-evenly/)).
- To centre the changes, divide by `(increases + 1)` so no change lands at the very end of the row ([Little Crafty Cottage search summary](https://littlecraftycottage.com/easy-guide-how-to-increase-stitches-evenly-across-a-row/)).
- **[DERIVED] Algorithm (flat piece, centred):** for `k` changes in `n` sts, put change `j` (0-based) at stitch `floor((j + 0.5) · n / k)`. In the round, shift the offset each round (e.g. by `n/(2k)`) to stagger, as §1.1 recommends.

### 4.4 Distributing shaping **along a slope** (sleeve taper, A-line, V-neck, raglan)

**The Magic Formula (two-rate split)** ([Midnight Purl](https://www.midnightpurl.com/news-notes/taperedsleeves)):
- Shaping events `E = total sts to change ÷ sts per event` (usually 2 = one at each end).
- `R ÷ E = B remainder C` gives: change every `B` rows `(E − C)` times, then every `B + 1` rows `C` times. The two rates may be interleaved.
- Example: 142 rounds, 16 events → 142 ÷ 16 = 8 r 14 → every 8 rounds ×2, every 9 rounds ×14.

**Knitting & Crochet Guild variant with a straight section at the end** ([KCG](https://kcguild.org.uk/learn/design/calculate-increases/)):
- Divide the rows by `(paired increases + 1)`.
- Example: 90 rows, 70 → 100 sts (15 pairs) → 90 ÷ 16 = 5 r 10 → increase every 5 rows ×6 and every 6 rows ×9, which leaves the last 6 rows straight.
- Uses: sleeves, V-necks, raglan armholes, button placement.

**Two-phase curves (armholes, caps)**, e.g. decrease every row for the first part and every 2nd row for the rest ([Sister Mountain set-in sleeve](https://www.sistermountain.com/blog/design-knit-set-in-sleeve)).

**[DERIVED] General slope algorithm (Bresenham).** For `E` events in `R` rows with an optional `lead` and `tail` of plain rows: `row_j = lead + round((j + 1) · (R − lead − tail) / (E + 0.5))`. This spreads events evenly, handles any remainder, and extends naturally to curves by splitting the curve into piecewise-linear segments.

**Crochet-specific caution [DERIVED].** With tall stitches (dc, h ≈ 1.25 cm) there are few rows, so a smooth slope may need a decrease **every** row. When more than 1 stitch per side per row is needed, use:
- stepped edges (slip stitch across, or leave stitches unworked), or
- shorter stitches at row ends: an hdc/sc/sl st "stair" to smooth the edge.

This is standard crochet technique but not formalised in the sources above.

### 4.5 Symmetric left/right shaping

- Cardigan fronts and the two sides of a neck are **mirror images**. Compute one side, then mirror the operations: "dec at beginning of RS row" on the left front becomes "dec at end of RS row" on the right front. [DERIVED]
- With a stitch pattern, mirror the pattern alignment too (Stitch Fiddle Premium offers **chart mirroring** ([Stitch Fiddle, search summary](https://www.stitchfiddle.com/en))).
- Crochet RS/WS asymmetry: turning chains sit on alternate edges, so edge shaping on the "chain" edge versus the "last stitch" edge looks different. A tech editor should require an explicit side for each piece ([CYC How to Read](https://www.craftyarncouncil.com/standards/how-to-read-crochet-pattern) defines "right front / left front" and RS/WS terms).

### 4.6 Set-in sleeve and armhole numbers

Source: [Sister Mountain set-in sleeve](https://www.sistermountain.com/blog/design-knit-set-in-sleeve) [RoT]

- Initial armhole bind-off 1.5–2.5 cm (larger for bigger sizes). The XL example: 2 cm × 2.2 st/cm = 4 sts.
- Stitches to remove per armhole = `(bust width sts − cross back sts) / 2`. Example: (132 − 92)/2 = 20.
- Decrease schedule: every row for about half the shaping, then every 2nd row. XL: 10 rows every row, then 8 rows every other row.
- Upper arm sts = `(upper arm + ease) × stG + 2 selvedge`. Example: (33 + 2.5) × 2.2 = 80.
- **Cap height = armhole depth − 7.5 to 10 cm.** XL: 25.5 − 7.5 = 18 cm = 55 rows.
- **Cap top bind-off = upper-arm width / 4 − 0.5 cm.** Example: 35.5/4 − 0.5 = 8.5 cm = 18 sts.
- Cap decreases per side = `(sts after initial bind-offs − top bind-off) / 2`. Example: (72 − 18)/2 = 27. Distributed with the magic formula: 52 rows ÷ 27 = 1 r 25 → every row ×2, every 2 rows ×25.

Alternative cap-height rules ([search summary: Robin Hunter Designs / Slipped Stitches](http://knittingrobin.blogspot.com/2011/11/sleeve-cap-adjustments-due-to-height.html)) [CONTESTED]:
- cap = armhole depth − 2" (bust < 30"), − 3" (30–48"), − 4" (> 48"); or cap = armhole depth − 1".
- Armhole depth ≈ bust/6 + 5 cm.
- Cap circumference ≈ armhole + 1–1.5" for easing.

Crochet translation [DERIVED]: "bind off" means slip-stitch across n sts at the start of a row, or leave n sts unworked at the end. Knit cap-height rules assume knit row gauge. Because crochet is less stretchy (§7), keep the cap-to-armhole easing at the low end.

### 4.7 Stitch-multiple constraints in practice [DERIVED + sources]

1. Compute the raw count `S* = W × stG`.
2. Candidates: `S_lo = floor-to-multiple(S*)` and `S_hi = ceil-to-multiple(S*)`.
3. Convert back to finished width and ease; pick by the fit-intent rule (§4.2).
4. If neither candidate keeps ease within the CYC band for the chosen fit, offer alternatives: (a) change hook/gauge, (b) add background/edge stitches ([Atherley](https://stitchmastery.com/grading-pattern-repeats-for-garments-and-larger-projects-guest-article-by-kate-atherley/)), (c) use a half repeat at the side seams, (d) use a different motif size.

### Worked example B — Drop-shoulder sweater, bust 96 cm, +10 cm ease

**Assumptions (not standards):** worsted-weight yarn, dc fabric, blocked gauge **15 sts × 8 rows = 10 cm** (stG 1.5, rG 0.8); size roughly CYC M/L ([CYC Woman](https://www.craftyarncouncil.com/standards/woman-size)); stitch pattern repeat 4 + 2; hem ribbing 5 cm.

Note: Sister Mountain recommends 15–30 cm of ease for drop shoulders ([Sister Mountain](https://www.sistermountain.com/blog/ease-knitting-pattern-design)), so 10 cm is at the "classic" end (CYC) and will look less boxy.

**Body panels (front = back)**
1. Finished circumference = 96 + 10 = 106 cm, so each panel is 53 cm wide.
2. Raw stitches = 53 × 1.5 = 79.5.
   - Plain dc: **80 sts** (53.3 cm, ease +10.7).
   - 4 + 2 pattern: candidates 78 (52 cm → ease +8) and 82 (54.7 cm → ease +13.3). Drop shoulder means round toward loose, so **82**. Both stay within CYC classic/loose.
3. Foundation (plain dc): ch 82 (80 + 2); dc in the 4th ch from the hook… The turning ch 3 counts as a stitch, per the [CYC](https://www.craftyarncouncil.com/standards/how-to-read-crochet-pattern) convention.
4. Length: target body length 58 cm including 5 cm rib, so 53 cm × 0.8 = 42.4 → **42 rows** (even).
   - Growth compensation: if a hanging swatch shows 5% vertical growth, `53 / 1.05 = 50.5 cm` × 0.8 → **40 rows** [DERIVED; the growth % must come from the maker's own swatch, §7].
5. Neck (front), assuming neck width 18.5 cm and front depth 8 cm:
   - Neck sts = 18.5 × 1.5 ≈ 28 (keeps shoulders equal: (80 − 28)/2 = **26 sts per shoulder**).
   - Initial centre "bind-off" of 50% of the neck = 14 sts left unworked ([Sister Mountain grading](https://www.sistermountain.com/blog/grading-knitting-patterns-stitch-row-counts): 30–50%). That leaves 7 sts to decrease per side.
   - Neck rows = 8 × 0.8 = 6.4 → 6 rows: decrease 2 sts at the neck edge on the first row, then 1 st on each of the next 5 rows.
   - Back neck: 2 cm, which is 2 rows; leave 24 centre sts unworked ((80 − 24)/2 = 28 per side), then decrease 1 st at each neck edge on each of the 2 rows, leaving 26 sts per shoulder to match the front.
6. Shoulder: a pure drop shoulder has no armhole shaping. The panel top edge is 53 cm, compared with CYC cross back 39.5–43 cm, so the shoulder seam **drops** about (53 − 41)/2 ≈ 6 cm down the arm.

**Sleeves (worked cuff-up, or top-down with decreases)**
7. Armhole depth for a drop shoulder, chosen at 21 cm (CYC M armhole depth 17.5–19 cm plus about 2–3 cm) [RoT/designer choice]. Sleeve top width = 2 × 21 = 42 cm → 42 × 1.5 = **63 sts**. For a symmetric pair of edge decreases an even count is needed, so use 64 (42.7 cm). Upper arm ease = 42.7 − 28 (CYC M upper arm) = +14.7 cm, which is typical for drop shoulders.
8. Sleeve length [DERIVED geometry]: `CB neck-to-wrist − half panel width = 71.75 − 26.5 ≈ 45 cm` (CYC M CBNW 71–72.5 cm). Minus a 5 cm cuff = 40 cm × 0.8 = **32 rows**.
9. Cuff width 26 cm (a loose wrist) → 39 → **40 sts**. Stitches to lose = 64 − 40 = 24, so **12 paired decreases**.
10. KCG magic formula with a straight section: 32 ÷ (12 + 1) = 2 r 6 → 7 intervals of 2 rows and 6 intervals of 3 rows, totalling 14 + 18 = 32 ✓. The last interval is plain rows, so (top-down): "Dec 1 st each end every 2nd row 7 times (50 sts), then every 3rd row 5 times (40 sts); work 3 rows even."
    Verification: 7 × 2 + 5 × 3 = 29 rows plus 3 even = 32 ✓; 64 − 2 × 12 = 40 ✓.
    Top-down the order reverses (decreases from the armhole down), or it is worked cuff-up as increases.

**Summary table for the generator (single size)**

| Piece | Start sts | End sts | Rows | Shaping |
|---|---|---|---|---|
| Back | 80 | 26 + 26 | 42 | back neck in the last 2 rows |
| Front | 80 | 26 + 26 | 42 | neck from row 36 |
| Sleeve ×2 | 40 (cuff-up) | 64 | 32 | inc 1 each end: every 3rd row ×5, every 2nd row ×7 |

**Grading this panel** to XS–5X means repeating steps 1–10 per size from the CYC columns. Rows and neck widths should also be taken per size (the CYC neck-to-wrist and armhole depth values grow). Expect FALSE checks and adjust the phase lengths ([Sister Mountain](https://www.sistermountain.com/blog/grading-knitting-patterns-stitch-row-counts)).

### Worked example C — Top-down dc raglan: why "raglan-only" increases often fall short

**Assumptions:** same gauge (15 × 8 per 10 cm), bust 96, **+8 cm** ease → 104 cm; upper arm 28 + 5 = 33 cm; neck opening 48 cm; yoke depth 20 cm (CYC M armhole depth 17.5–19 plus about 1–2 cm, [CYC](https://www.craftyarncouncil.com/standards/woman-size)); underarm chain U = 6 sts (4 cm).

1. Body sts at the underarm = 104 × 1.5 = **156**. Sleeve sts = 33 × 1.5 = 49.5 → **50**.
2. Underarm chains count in both body and sleeve ([Dora Does](https://doradoes.co.uk/2019/01/29/demystifying-crochet-garment-making-top-down-crochet-sweaters-explained/)). So the yoke must deliver front = back = (156 − 2 × 6)/2 = **72**, and each sleeve = 50 − 6 = **44**. Total at the split = 232.
3. Neck = 48 × 1.5 = 72 sts → front 24, back 24, sleeves 12 each.
4. Yoke rows = 20 × 0.8 = **16 rows**. Raglan +8 per row (+2 per section per row) for 16 rows adds +32 per section: front/back reach 24 + 32 = **56**, short by **16**; sleeves reach 12 + 32 = **44** ✓.
5. Options:
   - (a) **Extra body increases:** +1 at each end of the front and the back (+4 total) on 8 of the 16 rows, spread every other row by Bresenham. Front/back then reach 56 + 16 = 72 ✓.
   - (b) Larger underarm chains would need U = 22 sts (14.7 cm), which also adds 16 sts to each sleeve. Rejected.
   - (c) A deeper yoke would change the armhole fit. Rejected.
   - (d) A different neck split (front/back 32, sleeves 4) would give a very narrow sleeve saddle and pull the raglan lines toward the sleeves.

   This is the "cheat" problem described in [Interweave's raglan planning](https://www.interweave.com/article/crochet/fof-plan-top-down-raglan/) [DERIVED numbers].
6. Checks to encode: every section reaches its target on the same row; per-row increases ≤ what the stitch allows without distortion (a maximum of about 2 per edge per row for dc); the neck is ≥ head circumference minus stretch (see the hard problems section).

---

## 5. Hats

### 5.1 Head circumference [STD]

[CYC Head Circumference](https://www.craftyarncouncil.com/standards/head-circumference-chart):

| Age | in | cm |
|---|---|---|
| Preemie | 9–12 | 23–30.5 |
| Baby | 14–16 | 35.5–40.5 |
| Toddler | 16–18 | 40.5–46 |
| Child | 18–20 | 45.5–51 |
| Tween | 20–22 | 51–56 |
| Adult woman | 21–23 | 53–58.5 |
| Adult man | 22–24 | 56–61 |

CYC gives no hat-height table on that page.

### 5.2 Hat circumference, crown diameter, height [RoT]

[Treasurie](https://blog.treasurie.com/crochet-hat-size-guide-charts-printable-templates/), inches:

| Age | Head | Hat circ | Crown diameter | Length to mid-ear | Length below ear |
|---|---|---|---|---|---|
| Preemie | 12 | 11 | 3.75 | 4.0 | 4.25 |
| Newborn | 14 | 13 | 4.25 | 5 | 5.25 |
| 3–6 mo | 16 | 15 | 5 | 5.5 | 5.75 |
| 6–12 mo | 17 | 16 | 5.25 | 6 | 6.5 |
| 1–3 yr | 18 | 17 | 5.5 | 6 | 6.75 |
| Child 3–6 | 19 | 17 | 5.5 | 6.5 | 7.25 |
| Child 6–10 | 20 | 18 | 5.75 | 7 | 8 |
| Adult S / teen | 21 | 19 | 6.25 | 7 | 8 |
| Adult M | 22 | 20 | 6.5 | 7.5 | 8.5 |
| Adult L | 23 | 21 | 6.75 | 8 | 9 |

[B.Hooked](https://bhookedcrochet.com/2015/09/07/knit-and-crochet-hat-size-chart-and-sizing-guide/) hat lengths (inches): preemie 4, 0–3 mo 5, 3–6 mo 5.5, 6–12 mo 6.5, toddler 7, child 7.5, teen 8, women 8.5, men 9.

**Formula:** `crown diameter = (head circumference − negative ease) / π`. Stop increasing when the crown reaches that diameter, then work even rounds. Treasurie's example: 22" head − 2" = 20" → 6.37" → about 6.25" ([Treasurie search summary](https://blog.treasurie.com/crochet-hat-size-guide-charts-printable-templates/), [American Crochet Association calculator page](https://americancrochetassociation.blog/crochet-hat-size-chart/)).

**[CONTESTED] Negative ease:**

| Value | Source |
|---|---|
| −1" under 18" head, −2" over | [Treasurie](https://blog.treasurie.com/crochet-hat-size-guide-charts-printable-templates/) |
| about −5 cm | [Dora Does](https://doradoes.co.uk/2021/09/17/understanding-ease-in-crochet-garments-positive-and-negative-ease-explained/) |
| "about 2.55 in" | [B.Hooked](https://bhookedcrochet.com/2015/09/07/knit-and-crochet-hat-size-chart-and-sizing-guide/) (odd precision, likely a conversion artefact) |
| 5–10% for crochet | [Interweave](https://www.interweave.com/article/crochet/garment-ease-crocheters-knitters/) |

Stretchy stitches (BLO ribbing, fpdc/bpdc) tolerate more negative ease; solid sc tolerates less.

**Why the flat circle stops at a diameter, not a circumference [DERIVED]:** the flat crown's circumference equals the hat circumference, and the hat then turns down. A crown slightly smaller than hat circ / π makes a beanie; a larger crown makes a beret or slouch.

### Worked example D — Adult woman beanie in hdc

**Assumptions:** head 56 cm (CYC woman 53–58.5); ease −5 cm; hdc gauge 15 sts × 11 rows = 10 cm (w = 0.667 cm, h = 0.909 cm); target height 19 cm (≈ Treasurie adult M mid-ear, 7.5").

1. Hat circumference = 51 cm, crown diameter = 51/π = **16.2 cm**, radius 8.1 cm.
2. Increases per round `I = 2π·h/w = 2π × 0.909/0.667 = 8.57`. Choose **8** (within the Dora Does/Sarah Maker hdc range of 8–10).
3. Crown rounds = 8.1/0.909 = 8.9 → **9 rounds**: 8, 16, 24 … **72 sts**, which is 48 cm (−8 cm, too tight).
4. Target stitches = 51 × 1.5 = 76.5 → 76. Add **+4 evenly in round 10** → 76 sts = 50.7 cm ✓. Alternative: use I = 9 for rounds 1–8 (72 sts) with round 9 at +4, and so on. The engine enumerates candidates and picks the least deviation.
5. Side rounds [RoT/DERIVED]: height measured from crown centre ≈ crown radius + side, so `(19 − 8.1) × 1.1 ≈ 12 rounds` even, then a brim (e.g. 4 rounds of fpdc/bpdc included in the height).
6. Checks: stagger increases (§1.1); if the crown cups at the swatch stage, switch to I = 9.

---

## 6. Free-form, sculptural and "amorphous" design

### 6.1 Freeform crochet (deliberately unstructured)

- Freeform combines crochet and knitting "in a seemingly random" way, "not constrained by patterns, colours, stitches or other limitations." Its roots are in Irish crochet, it rose in the 1960s–70s and revived in the late 20th and early 21st centuries ([Wikipedia](https://en.wikipedia.org/wiki/Freeform_crochet_and_knitting)).
- **Scrumbles:** small pieces joined later. The term was coined by James Walters and Sylvia Cosh in the 1990s. Jenny Dowde calls them "fragments"; Prudence Mapstone calls them "patches" ([Wikipedia](https://en.wikipedia.org/wiki/Freeform_crochet_and_knitting)).
- Other practitioners: Jan Messent, Margaret Hubert, Myra Wood and others ([Wikipedia](https://en.wikipedia.org/wiki/Freeform_crochet_and_knitting)). Mapstone's *Serendipitous Design Techniques for Knitting & Crochet* is regarded by practitioners as the reference work ([search summary, knittingcrochetcrafts.com](https://knittingcrochetcrafts.com/freeform-crochet-and-knitting-also-known-as-scrumbling/); [Mapstone blog](http://prudencemapstone.blogspot.com/)).
- Workshops teach stitches, **layout design, and how to fit and sew scrumbles together** ([Creative Fibre Auckland, search summary](https://creativefibreauckland.wordpress.com/2011/03/19/freeform-crochet-with-prudence-mapstone/)).
- **Implication [DERIVED]:** software should not try to "generate" freeform row by row. It can support it as **layout plus fill**: a garment template (schematic outline) → the user places scrumble regions → the tool tracks area coverage, joins and remaining gaps, and can suggest filler motifs (circles and wedges from §1 at the user's gauge).

### 6.2 Sculptural shaping in crochet

- **Short rows** (turning before the row ends) build wedges for crescents and curves, bust darts, sloped shoulders, heels and amigurumi bellies. Wider or narrower short-row steps change the curve ([Dora Does short rows](https://doradoes.co.uk/2023/09/20/crochet-short-rows-what-they-are-when-and-how-to-use-them/), [Interweave crochet short rows](https://www.interweave.com/article/crochet/how-to-crochet-short-rows/), [Linda Dean](https://www.lindadeancrochet.com/blog/?p=3050)).
- **Hyperbolic / negative curvature:** Daina Taimina (1997) increased in a constant ratio. Her first model added 1 stitch after every 2, which grows exponentially and ruffles heavily. For classroom models she recommends **12:13** (one increase after every 12 sc). Ratios such as 2:1, 3:2 and 4:3 create negative curvature ([search summary citing Taimina / Cabinet Magazine](https://www.cabinetmagazine.org/issues/16/wertheim_henderson_taimina.php), [Crocheting Adventures with Hyperbolic Planes](https://en.wikipedia.org/wiki/Crocheting_Adventures_with_Hyperbolic_Planes)).
- **Unified curvature model [DERIVED].** Let `ΔS` be the stitches added per round and `I_flat = 2π·h/w` (per closed round).
  - `ΔS = I_flat` gives flat.
  - `ΔS < I_flat` gives positive curvature: a cup, bowl, sphere or hat crown turning down. `ΔS = 0` gives a cylinder.
  - `ΔS` proportional to the current stitch count (ratio increases) gives exponential growth, i.e. hyperbolic ruffles.
  - Local short rows add curvature in one direction only.

  This one model covers hats, amigurumi, ruffles and darts.

### 6.3 3D mesh → crochet/knit algorithms (research)

| System | Approach | Relevance / limits |
|---|---|---|
| **Igarashi et al., "Knitting a 3D Model" (Pacific Graphics 2008)** | Manual segmentation into disk-like patches. Each patch is covered by iso-contours at constant intervals from its boundary (Euclidean distance). Sample points are placed on each contour at the **same interval**, adjacent contours are connected to nearest points, **quads = normal stitches, triangles = increase/decrease**. Rows are output in reverse order (centre-out), and a physics preview is run. | Cannot represent concavity parallel to rows, since each row is a closed loop. "Resulting models are often very different from hand-designed knitted animals"; irregular stitches should be concentrated near borders ([PDF](https://www-ui.is.s.u-tokyo.ac.jp/~takeo/papers/yuki_pg08_knit.pdf)). |
| **AmiGo (Edelstein, Peleg, Itzhaky, Ben-Chen, SCF 2022)** | Input: closed triangle mesh plus one seed point. Builds a **Crochet Graph** (row/column parameterisation), segments into crochetable components joined "as you go" (no sewing), outputs sc-based text instructions ([arXiv](https://arxiv.org/abs/2211.01178), [ACM](https://dl.acm.org/doi/10.1145/3559400.3562005)). | The public implementation **does not support branching meshes** (limbs, ears) ([GitHub](https://github.com/karinsifri/AmiGo)). Designed for stuffed toys, not worn garments. |
| **Narayanan et al., "Automatic Machine Knitting of 3D Meshes" (ACM TOG 2018)** | First pipeline from arbitrary meshes to V-bed machine instructions ([ACM](https://dl.acm.org/doi/10.1145/3186265), [ScienceDaily](https://www.sciencedaily.com/releases/2018/03/180329083256.htm)). | Machine-knit constraints; the concepts (time field → courses at row spacing) transfer. |
| **Knit Sketching (Kaspar et al., SIGGRAPH 2021, MIT)** | Starts from **2D cut-and-sew pattern sketches** with annotations: knitting direction, course interfaces, seam placement. Solves a constrained "time process", segments into simple regions, and optimises a stitch graph with an accuracy vs simplicity trade-off ([project page](https://knitsketching.csail.mit.edu/), [ACM](https://dl.acm.org/doi/10.1145/3450626.3459752)). | The closest analogue to "sewing pattern → rows" for garments. Machine knitting only. |
| **Knitting Skeletons (2019)** | CAD tool for shaping and patterning knitted garments ([arXiv](https://arxiv.org/pdf/1904.05681)). | Parametric garment primitives. |
| **Automatic crochet pattern generation from 2D sketching** | Sketch → crochet pattern ([ResearchGate](https://www.researchgate.net/publication/326951972_Automatic_Crochet_Pattern_Generation_from_2D_Sketching)). | Details not reviewed. |

**Algorithm common to all three mesh systems [DERIVED synthesis]:**
1. Define a scalar "time" or "row" field on the surface (distance from a seed or boundary).
2. Extract iso-lines spaced by the **row height h**.
3. Resample each iso-line at spacing **w**.
4. Connect adjacent rows. Stitch-count differences between rows become increases and decreases, **placed evenly** (§4.3).
5. Segment where the field branches or the geometry cannot be crocheted.

For **flat garment panels** this collapses to the schematic method of §4: the "field" is the vertical coordinate, and the iso-lines are horizontal rows whose widths are read off the panel outline.

### 6.4 "Flattening" 3D garments into panels

- Plush-toy research (Plushie, Pillow; [Springer — Pillow](https://link.springer.com/chapter/10.1007/978-3-540-85412-8_1)) converts 3D surfaces into developable 2D patches. Igarashi et al. note that paper-craft and plush systems "transform a 3D surface into multiple 2D developable or quasi-developable patches", whereas knitting needs "a single 1D chain of small cells" ([Igarashi PDF](https://www-ui.is.s.u-tokyo.ac.jp/~takeo/papers/yuki_pg08_knit.pdf)).
- **Crochet advantage [DERIVED]:** crochet panels need not be developable. Increases, decreases and short rows can add curvature *inside* a panel (a bust dart, a shoulder cap), so fewer seams are required than for woven fabric. The trade-off is that hand-crocheters need regular, memorable shaping.

### 6.5 Existing garment-design software

| Tool | What it does | Crochet? | Source |
|---|---|---|---|
| **Knitware Sweaters** (Windows) | Designs sweaters, cardigans, vests and jackets; hand knit, machine knit **or crochet**, any size; body/neck/sleeve shape options, collars, hoods, bands; variable ease from form-fitting to oversized | Yes (stated) | [Software Informer](https://knitware-sweaters.software.informer.com/) (the knitware.com domain now redirects to an unrelated company) |
| **DesignaKnit** (Softbyte) | Hand and machine knitwear CAD: custom sizes, shaping outlines with notation, stitch-symbol charts, text instructions for hand knitters, yarn estimates, interactive row-by-row mode | Knit-oriented | [Softbyte](http://softbyte.co.uk/knitwearpatterndesignsoftwareprogramdesignaknit.htm), [Knitcraft](https://knitcraft.com/software/designaknit/designaknit-software/) |
| **CustomFit** (Amy Herzog) | User body measurements (from scratch or CYC-based) plus a swatched gauge produce a custom sweater pattern; fit presets close/average/relaxed/oversized; men, kids and women with or without waist shaping. **Shut down 15 June 2024.** | Knit | [CustomFit about](https://customfit.amyherzogdesigns.com/about/?mwl_redirect=true), [shutdown notice](http://customfitknits.com/) |
| **Stitch Fiddle** | Browser chart editor: crochet C2C, colourwork, Tunisian, filet and a "freeform" chart type; Premium adds mirroring, error checking and chart → written instructions. **No garment shaping found.** | Charts | [Stitch Fiddle](https://www.stitchfiddle.com/en), [search summary](https://yarnandy.com/using-stitch-fiddle-to-create-crochet-charts/) |
| **DROPS / Garnstudio** | Not software: a consistent size system with half-width cm diagrams per size; users match to their own garments | Knit and crochet patterns | [Garnstudio lesson](https://www.garnstudio.com/lesson.php?id=24&cid=19) |
| **Stitchmastery** | Chart software; hosts Atherley's grading articles | Knit charts | [Stitchmastery](https://stitchmastery.com/grading-pattern-repeats-for-garments-and-larger-projects-guest-article-by-kate-atherley/) |
| **Web calculators** (StitchMath, Stitchsums set-in sleeve, CrochetCalc) | Single-purpose: even distribution, sleeve taper, circles | Mixed | [StitchMath](https://stitchmath.com/calculators/increase-decrease/), [Stitchsums](https://www.stitchsums.com/calculators/set-in-sleeve), [CrochetCalc](https://crochetcalc.com/calculators/crochet-increase-decrease-calculator.html) |

---

## 7. Drape, stretch, weight and growth in crochet fabric

### 7.1 Facts and observations

- Knit fabric (interlocking loops) generally drapes better. Crochet is thicker and more structured at the same yarn weight ([KnitPro](https://www.knitpro.eu/usa/blog/knitting-vs-crochet-explore-for-the-perfect-drape)).
- "Even lightweight crochet has more bulk and less natural drape than knitted fabric." Cotton stands stiffly away from the body; acrylic stretches downward over time ([Hodgepodge Crochet](https://hodgepodgecrochetcom.wordpress.com/2026/05/21/why-crochet-clothes-dont-fit-and-why-its-usually-not-the-crocheters-fault/)).
- Crochet fabric has **less inherent ease than knits but more than woven**; negative ease works best with stretchy fabric ([Interweave search summary](https://www.interweave.com/article/knitting/better-sweaters-understanding-ease/), [Lion Brand](https://www.lionbrand.com/community/blog/knit-vs-crochet-differences-a-beginners-guide/)).
- **Growth.** Gravity pulls long cardigans longer ([Dora Does cardigans](https://doradoes.co.uk/2023/03/02/all-about-crochet-cardigans-6-ways-to-crochet-a-cardigan/)). Machine washing, heat and hanging storage stretch stitches; looser stitches grow more. One designer's sweater grew **2–3 sizes (L → about 2X/3X) after one wash** [ANECDOTE] ([Blue Star Boutique](https://thebluestarboutique.com/2018/08/12/fighting-the-growth-in-your-crochet-garments/)). Superwash wools are prone to lengthwise growth, and a loose acrylic cardigan may drop several inches ([crochets.site](https://crochets.site/resources/choosing-yarn-for-crochet-drape-durability-guide)).
- **Five drape levers** ([Dora Does, drape](https://doradoes.co.uk/2020/01/18/its-all-about-that-drape-bout-that-drape-no-treble-how-to-find-the-right-drape-in-crochet-fabric/)):
  1. Stitch pattern: dense sc is stiff; moss, V-stitch, extended and linked stitches drape.
  2. Hook size and tension: bigger hook and relaxed tension give more drape.
  3. Yarn weight: bulky sc barely moves; fingering sc moves more.
  4. Fibre: mohair is light and mobile; raffia is stiff.
  5. Blocking: wet blocking natural fibres increases drape; steam permanently relaxes acrylic.
- Treble is flowier than dc; BLO work and chain-containing stitch patterns drape more ([Creations by Courtney, search summary](https://creationsbycourtney.com/improve-drape-in-crochet-garments/)).

### 7.2 Designer compensation (encodable) [RoT + DERIVED]

| Issue | Compensation | Basis |
|---|---|---|
| Growth in length | Measure a **washed, blocked, hung (optionally weighted)** swatch. Use its row gauge; reduce the length target by the measured growth %. | Growth sources above; "experiment with your swatch once washed and blocked" ([Dora Does cardigans](https://doradoes.co.uk/2023/03/02/all-about-crochet-cardigans-6-ways-to-crochet-a-cardigan/)). The weighted-swatch % method is DERIVED. |
| Low stretch | Limit negative ease to about 5–10% (ribbing up to 15%); use positive ease for set-in fitted pieces | [Interweave](https://www.interweave.com/article/crochet/garment-ease-crocheters-knitters/) |
| Stiffness | Suggest a larger hook, taller/open stitches or drapey fibres when a dense stitch is chosen for a garment | [Dora Does](https://doradoes.co.uk/2020/01/18/its-all-about-that-drape-bout-that-drape-no-treble-how-to-find-the-right-drape-in-crochet-fabric/) |
| Bulk at seams and underarm | Prefer seamless yoke/raglan, or a modified drop to reduce underarm bulk | [Dora Does constructions](https://doradoes.co.uk/2019/03/17/crochet-garment-making-demystified-6-common-ways-to-construct-a-crochet-sweater/) |
| Thickness | Measure ease on the inside for close fits | [Dora Does ease](https://doradoes.co.uk/2021/09/17/understanding-ease-in-crochet-garments-positive-and-negative-ease-explained/) |
| Weight | Estimate garment mass (yarn g/m × metres from stitch-area density). Warn when weight per area × length is high: heavy long cardigans will grow. | DERIVED |
| Care | Fold, don't hang; gentle wash; flat dry | [Blue Star Boutique](https://thebluestarboutique.com/2018/08/12/fighting-the-growth-in-your-crochet-garments/) |

---

## 8. Professional pattern writing and tech editing

### 8.1 Pattern structure (typical order) [RoT/industry convention]

1. Title, designer, skill level.
2. **Sizes** as `S (M, L, XL, 2XL)`; **finished measurements** in the same order, e.g. "Finished Chest: 36 (40, 44, 48, 52)"; suggested ease ([search summary, pattern-reading guides](https://www.thenicolechase.com/blog/how-to-read-a-crochet-pattern)).
3. **Materials:** yarn (weight, fibre, yardage per size, colourway), hook(s), notions (markers, needle, buttons) ([same](https://www.thenicolechase.com/blog/how-to-read-a-crochet-pattern)).
4. **Gauge:** stitches and rows over 4"/10 cm in the stated stitch, blocked or unblocked stated. Atherley discusses when to give gauge in both stockinette and the stitch pattern ([Knitter's Review / Atherley](https://www.knittersreview.com/the-beginners-guide-to-writing-knitting-patterns-by-kate-atherley/); [Artisan Tech Editor tips #6, #51](https://techeditor.co.uk/crochet-designer-resources-toolkit/52-crochet-tech-editing-tips/)).
5. **Abbreviations:** CYC master list, US terms; define special stitches. CYC also documents US/UK/Canada term differences ([CYC Crochet Abbreviations](https://www.craftyarncouncil.com/standards/crochet-abbreviations)).
6. **Notes:** construction overview, turning-chain convention, RS/WS, how size numbers are shown.
7. **Instructions:** by piece/section, with row stitch counts.
8. **Schematic** with all sizes; **charts** with standard symbols ([Artisan Tech Editor #18, #50](https://techeditor.co.uk/crochet-designer-resources-toolkit/52-crochet-tech-editing-tips/)).
9. Finishing: blocking to schematic measurements, seaming, bands.

### 8.2 Notation conventions [STD — CYC]

Source: [CYC How to Read a Crochet Pattern](https://www.craftyarncouncil.com/standards/how-to-read-crochet-pattern)

- Stitch counts at row end: ": 14 sc" or "(14 sc)".
- `*` marks repeats ("*ch 1, skip next st, dc in next st; rep from * across").
- Brackets give a repeat count: "[sk next dc, shell in next dc] 4 times".
- Parentheses group stitches into one place: "in next dc work (2 dc, ch 3, 2 dc)".
- Turning chains: sc ch 1 does not count; dc ch 3 counts as a stitch.

**[CONTESTED] Size-parenthesis clash.** Parentheses mean both "size alternatives" and "stitches worked into one place". Many publishers use **curly braces or colour-coding** for sizes instead. This is a style-sheet decision, and tech editors enforce consistency ([Artisan Tech Editor #15, #47](https://techeditor.co.uk/crochet-designer-resources-toolkit/52-crochet-tech-editing-tips/); [Tech Editor Hub](https://www.thetecheditorhub.com/learn-to-tech-edit)).

### 8.3 Tech-editor checklist (merged)

Sources: [Artisan Tech Editor 52 tips](https://techeditor.co.uk/crochet-designer-resources-toolkit/52-crochet-tech-editing-tips/), [Tech Editor Hub](https://www.thetecheditorhub.com/learn-to-tech-edit), [MadameStitch](https://www.madamestitch.com/professional-services/crochet-technical-editing/), [Sister Mountain grading](https://www.sistermountain.com/blog/grading-knitting-patterns-stitch-row-counts)

- [ ] Line-by-line read; style sheet applied (abbreviations, capitalisation, punctuation, terminology).
- [ ] **Stitch counts verified on every row that changes count**, and the final counts across all sizes (tips #31, #44).
- [ ] Stitch-pattern maths: repeats fit the counts, including edge stitches (#49).
- [ ] Gauge produces the stated finished measurements for every size.
- [ ] Grading is even and conforms to common sizing standards; rounding makes sense (#8).
- [ ] Size labels consistent (#15).
- [ ] Schematic present and consistent with the instructions; diagrams for complex shaping (#18, #27).
- [ ] Abbreviations all defined and used consistently (#43); US vs UK stated.
- [ ] Turning-chain counting clarified (#25).
- [ ] Charts use standard symbols (#50).
- [ ] Yardage per size plausible.
- [ ] Spreadsheet boolean checks (target equals computed) for every shaping phase ([Sister Mountain](https://www.sistermountain.com/blog/grading-knitting-patterns-stitch-row-counts)).

---

## 9. Encodable rules / algorithms

Everything below is implementable. Each item names its inputs, outputs and the sections that justify it.

### 9.1 Data layer

1. **Measurement tables**: CYC women, men, child/youth, baby and head (§3, §5). Store min and max per range, units, and source URL. Include **validation flags** for the CYC inconsistencies noted in §3.1–3.2.
2. **Ease presets**: CYC five-level chart (§3.5), plus garment- and location-specific overrides (cardigan ≥ +5; drop shoulder +15 to +30; sleeve +5; hat −2.5/−5 cm or 5–10%). Offer proportional ease (a percentage of bust) as an option.
3. **Gauge object**: `{stitch, hook, yarn, stG, rG, blocked: bool, hung_growth_pct, stretch_pct}`. Keep unblocked and blocked variants.
4. **Stitch catalogue**: default h/w ratios (sc ≈ 1.0, hdc ≈ 1.3–1.5, dc ≈ 1.9, tr ≈ 2.6), turning-chain convention (counts or not), foundation offset. Always override with the swatch.

### 9.2 Core maths primitives

```text
sts(width_cm, g)          = width_cm * g.stG
rows(height_cm, g)        = height_cm * g.rG
round_to_multiple(x,m,c)  -> candidates {floor, ceil} of k*m+c ; choose by fit intent
round_even(x)             -> nearest even integer (shaping on RS)
foundation_chain(S, stitch) = S + offset(stitch)   # sc:+1, dc:+2 (ch3 counts)
finished_width(S, g)      = S / g.stG            # back-conversion for reporting ease
```

### 9.3 Distribution algorithms

- **Across a row** (§4.3): positions `floor((j + 0.5)·n/k)`; stagger offset per round for circles.
- **Along a slope** (§4.4): the magic formula `R ÷ E → B r C` gives `(E − C)` times every B and `C` times every B+1; optional `+1` straight tail (KCG); or Bresenham with lead and tail rows.
- **Multi-phase curves**: piecewise-linear segments (armhole: every row, then every 2nd row; cap: magic formula) (§4.6).
- **Mirror**: a left/right transformer that swaps "beginning" and "end" of RS/WS and mirrors chart columns (§4.5).
- **Maximum shaping per row**: if the required stitches per edge per row exceed about `h/w + 1`, switch to stepped shaping (unworked stitches or sl st) or to shorter stitches at the edge.

### 9.4 Shape generators (shawls and flat pieces)

| Shape | Increases per row/round | Rows | Source |
|---|---|---|---|
| Rectangle | 0 | L·rG | §1.7 |
| Circle | `2π·stG/rG` in W wedges, staggered | R·rG | §1.1 |
| Semicircle | `π·stG/rG` | R·rG | §1.2 |
| Pi circle | double on rounds 2^k (optionally shifted ×0.75) | — | §1.3 |
| Top-down triangle | total `4·stG/rG`: edges `stG/rG` each, spine `2·stG/rG`; even-count constraint | `D·rG/√2` | §1.4 |
| Asymmetric triangle | edge net `g = h/(w·tanθ)` | — | §1.5 |
| Crescent | edges `e > stG/rG`, spine ≈ 0; or 8 alternating wedges; or short-row wedges | — | §1.6 |
| Triangle with wings | edges switch from `r` to `2r` at a chosen row | — | §1.4 |
| Hyperbolic ruffle | +1 every n sts (ratio growth) | — | §6.2 |

After computing: round to integers, preview the angle and area, run a **ruffle/cup risk check** that compares the actual stitch count per round with the ideal `n·I` (flag if the deviation exceeds ±15–20%).

### 9.5 Garment engine: schematic → row plan

1. Pick a **construction template** (drop shoulder → modified drop → raglan → yoke → set-in), in order of generation difficulty (§2.2).
2. Build the **schematic** per size from body measurements plus ease, using template formulas:
   - drop shoulder: panel = (bust + ease)/2; sleeve top = 2 × armhole depth; sleeve length = CBNW − panel/2;
   - set-in: cap height = armhole − 7.5–10 cm; top bind-off = upper arm/4 − 0.5 cm;
   - raglan: yoke depth ≈ armhole depth + allowance.
3. Convert each **horizontal line** of the schematic to stitches and each **vertical segment** to rows (§4.1).
4. Apply **stitch-multiple rounding** with the fit-intent rule; report the actual ease (§4.2, §4.7).
5. For each slope, run the **distribution algorithm**; for curves, piecewise phases (§4.4, §4.6).
6. For seamless yokes, solve **section targets**: front/back/sleeve increments must all land on the split row. Insert extra body-only or sleeve-only increases with Bresenham and choose underarm chains (Worked example C).
7. **Mirror** paired pieces (§4.5).
8. **Emit instructions** with row stitch counts and CYC notation (§8.2), plus the schematic and optional chart.
9. **Seam-length reconciliation**: front and back side seams have equal rows; sleeve cap edge ≈ armhole edge + easing; sleeve top width = 2 × drop armhole depth.

### 9.6 Grading engine

- For sizes XS–5X (or baby → youth, men S–5X): take each measurement column → finished measurements (ease absolute or proportional) → run §9.5 per size.
- **Boolean checks** per size and phase (the Sister Mountain approach); auto-repair by adjusting phase lengths while preserving total rows.
- **Cross-size consistency**: stitch counts monotonic; rounding steps even; motif fit per size using Atherley strategies (background stitches, extra repeats, motif scaling). For motif garments: hook/square-size tiers.
- Output: size-array notation `36 (40, 44, …)` or braces; per-size yardage.

### 9.7 Hats

`hatC = head − ease(head)`; `D = hatC/π`; `I = round(2π·stG/rG)` (enumerate I ± 1); `crown rounds = round((D/2)·rG)`; adjust the last increase round to hit `round(hatC·stG)` (multiple-aware); `side rounds = (height − D/2)·rG`, with height from the table (§5).

### 9.8 Fabric-behaviour adjustments

Length targets ÷ (1 + hung growth %); ease caps by stretch %; drape warnings by stitch density and fibre; weight estimate; blocked versus unblocked previews (§7, §1.8).

### 9.9 Curvature sandbox (sculptural / 3D)

- Per-round `ΔS` versus `I_flat` classifier: flat, cup, cylinder or ruffle (§6.2).
- **Surface-of-revolution to rounds** [DERIVED from Igarashi/AmiGo]: given a profile curve r(s) along the arc length s, rounds are at `s_i = i·h` and stitches `S_i = round(2π·r(s_i)/w)`; the difference between consecutive rounds gives increases or decreases, spread evenly and staggered. This covers hats, bags, cups, sleeves-in-the-round and simple amigurumi.
- **Flat panel outline to rows**: sample the outline width at `y_i = i·h`, `S_i = round(W(y_i)/w)`, then smooth the changes into legal shaping events (≤ max per row) with the §9.3 algorithms.
- **Mesh input (advanced)**: distance field from a seed or boundary → iso-lines at h → resample at w → connect rows → inc/dec (the Igarashi/AmiGo pipeline). Restrict to non-branching components or require the user to segment.

---

## 10. Hard problems / open questions

1. **Row gauge is unreliable in crochet.** It depends on how each maker pulls up loops, especially for hdc/dc/tr. Every row-based length and slope rate inherits this error. Mitigation is to require a swatch in the actual stitch and give length targets in cm ("work until piece measures…") alongside row counts. Unsolved: automatic prediction from yarn and hook alone.
2. **Growth under gravity and washing is non-linear and fibre-specific.** One report shows 2–3 sizes of growth after one wash ([Blue Star](https://thebluestarboutique.com/2018/08/12/fighting-the-growth-in-your-crochet-garments/)). A small swatch does not predict garment-scale weight ([Hodgepodge](https://hodgepodgecrochetcom.wordpress.com/2026/05/21/why-crochet-clothes-dont-fit-and-why-its-usually-not-the-crocheters-fault/)). There is no standard test protocol (weight per area, hanging duration).
3. **Theory versus practice in increase rates** (triangle, semicircle, Pi). Published crochet patterns often use rates 30–50% off the geometric ideal and rely on blocking or stylised shapes (§1.2, §1.4). The software must allow "designer intent" overrides and cannot always tell an error from a style.
4. **Drape and silhouette.** Whether a flat schematic hangs as intended depends on fabric stiffness and weight. Without cloth simulation calibrated to crochet structures (no found source provides one), the preview is approximate.
5. **Real-body variation.** CYC tables are averages and contain inconsistencies (§3.1–3.2). The same bust can need different shaping (bust depth, shoulder slope, posture) ([Hodgepodge](https://hodgepodgecrochetcom.wordpress.com/2026/05/21/why-crochet-clothes-dont-fit-and-why-its-usually-not-the-crocheters-fault/)). Custom fit needs more measurements than CYC provides: neck, full bust versus upper bust, shoulder slope, bust point, wrist.
6. **Grading is not pure scaling.** Larger sizes need proportionally different armholes, necks and cross backs ([Hodgepodge](https://hodgepodgecrochetcom.wordpress.com/2026/05/21/why-crochet-clothes-dont-fit-and-why-its-usually-not-the-crocheters-fault/); the non-linear CYC cross back). Which proportions to use is a design judgement, and professionals still require tech editors ([Sister Mountain](https://www.sistermountain.com/blog/grading-knitting-patterns-stitch-row-counts)).
7. **Large stitch-pattern repeats versus shaping.** Deciding how to keep a lace or cable motif intact through armhole, neck and raglan shaping (partial repeats, substituting plain stitches) is aesthetic ([Atherley](https://stitchmastery.com/grading-pattern-repeats-for-garments-and-larger-projects-guest-article-by-kate-atherley/)). It can be rule-assisted but not fully automated.
8. **Negative ease limits** for crochet are only loosely quantified (5–15% per [Interweave](https://www.interweave.com/article/crochet/garment-ease-crocheters-knitters/)) and depend strongly on stitch (BLO rib, post stitches) and fibre.
9. **Set-in sleeve cap fit.** Cap height rules conflict (§4.6), and matching seam lengths with easing depends on the fabric's ability to ease in, which is lower in crochet.
10. **Branching and 3D garments from meshes.** AmiGo's implementation does not handle branching ([GitHub](https://github.com/karinsifri/AmiGo)). Igarashi reports results "often very different from hand-designed" patterns and cannot represent concavity along rows ([PDF](https://www-ui.is.s.u-tokyo.ac.jp/~takeo/papers/yuki_pg08_knit.pdf)). Garment meshes add body collision, drape and seams. No hand-crochet garment-from-mesh system was found.
11. **Human-readable regularity.** Algorithmic increase placement is irregular ("Knitting pattern should be more regular, having irregular stitches only near patch borders", [Igarashi](https://www-ui.is.s.u-tokyo.ac.jp/~takeo/papers/yuki_pg08_knit.pdf)). Balancing geometric fidelity against memorisable repeats is an open trade-off (Knit Sketching exposes this as an accuracy/simplicity parameter, [MIT](https://knitsketching.csail.mit.edu/)).
12. **Freeform is intentionally non-algorithmic.** Software can support layout, coverage and filler suggestions, but "generating" freeform contradicts the practice ([Wikipedia](https://en.wikipedia.org/wiki/Freeform_crochet_and_knitting)).
13. **Blocking growth for lace.** It varies from minimal (metallics) to near-doubling. It must be measured, not predicted.
14. **Notation ambiguity**: parentheses for sizes versus grouped stitches (§8.2). Choose a style sheet and enforce it.
15. **Market precedent is thin.** CustomFit (the best-known measurement-driven generator) closed in 2024 ([notice](http://customfitknits.com/)). Knitware claims crochet support, but its maintained web presence could not be verified. No current, maintained crochet-specific custom-fit garment generator was found in this research. Treat this as an opportunity, and as a warning about complexity.

---

## Appendix A — Source list

**Standards bodies / industry**
- CYC Body Sizing & Ease: https://www.craftyarncouncil.com/standards/body-sizing
- CYC Woman: https://www.craftyarncouncil.com/standards/woman-size
- CYC Man: https://www.craftyarncouncil.com/standards/man-size
- CYC Child/Youth: https://www.craftyarncouncil.com/standards/child-youth-sizes
- CYC Baby: https://www.craftyarncouncil.com/standards/baby-size-chart
- CYC Head: https://www.craftyarncouncil.com/standards/head-circumference-chart
- CYC How to Read a Crochet Pattern: https://www.craftyarncouncil.com/standards/how-to-read-crochet-pattern
- CYC Crochet Abbreviations: https://www.craftyarncouncil.com/standards/crochet-abbreviations
- DROPS size chart lesson: https://www.garnstudio.com/lesson.php?id=24&cid=19

**Design maths / grading / tech editing**
- Sister Mountain — grading: https://www.sistermountain.com/blog/grading-knitting-patterns-stitch-row-counts
- Sister Mountain — ease: https://www.sistermountain.com/blog/ease-knitting-pattern-design
- Sister Mountain — set-in sleeve: https://www.sistermountain.com/blog/design-knit-set-in-sleeve
- Kate Atherley on grading repeats: https://stitchmastery.com/grading-pattern-repeats-for-garments-and-larger-projects-guest-article-by-kate-atherley/
- Knitter's Review of Atherley pattern-writing book: https://www.knittersreview.com/the-beginners-guide-to-writing-knitting-patterns-by-kate-atherley/
- Midnight Purl — magic formula: https://www.midnightpurl.com/news-notes/taperedsleeves
- Knitting & Crochet Guild — calculate increases: https://kcguild.org.uk/learn/design/calculate-increases/
- Artisan Tech Editor — 52 tips: https://techeditor.co.uk/crochet-designer-resources-toolkit/52-crochet-tech-editing-tips/
- Tech Editor Hub: https://www.thetecheditorhub.com/learn-to-tech-edit
- MadameStitch tech editing: https://www.madamestitch.com/professional-services/crochet-technical-editing/
- Lion Brand — ease: https://www.lionbrand.com/community/blog/garment-ease-and-fit/
- Interweave — crochet/knit ease (search summary; page 403): https://www.interweave.com/article/crochet/garment-ease-crocheters-knitters/
- Interweave — top-down raglan planning (search summary; page 403): https://www.interweave.com/article/crochet/fof-plan-top-down-raglan/

**Shawls / circles**
- Dora Does — flat circle formula: https://doradoes.co.uk/2020/12/12/how-to-crochet-a-flat-circle/
- Dora Does — Pi circles: https://doradoes.co.uk/2020/12/19/how-to-crochet-a-circle-using-the-pi-method/
- Sarah Maker — flat circle: https://sarahmaker.com/crochet-flat-circle/
- Holly Chayes — triangle with wings: https://www.hollychayes.com/2013/05/27/shawl-geometry-triangle-with-wings/
- Holly Chayes — crescents: https://www.hollychayes.com/2013/07/29/shawl-geometry-crescents/
- verypink — pi circle: https://verypink.com/2019/08/28/knitting-a-pi-circle/
- Interweave — pi shawl (search summary): https://www.interweave.com/article/knitting/demystifying-the-pi-shawl-create-your-own-one-of-a-kind-circular-shawl/
- Creative Crochet Corner — shawl shapes: https://www.creativecrochetcorner.com/post/two-easy-shawl-shapes
- Make My Day Creative — triangle design: https://makemydaycreative.com/2015/05/30/how-to-design-crochet-patterns-triangular-shawl-bonus/
- Inner Child Crochet — semicircle: https://innerchildcrochet.com/resources/how_to_design/semicircle.html
- Kristin Omdahl — half circle: https://www.kristinomdahl.com/crochet-half-circle-shawl-pattern/
- A Bee in the Bonnet — crescent: https://www.abeeinthebonnet.com/blog/easy-crescent-shawl-knitting-formula-free-tutorial/
- Tonia Knits — asymmetric: https://toniaknits.com/how-to-knit-an-asymmetrical-triangle-shawl/
- SewGuide — dimensions: https://sewguide.com/scarf-shawl-stole-wrap-measurement/
- Sivana — shawl length: https://www.sivanaspirit.com/blogs/sivana/how-long-should-a-shawl-be
- Crochet Spot — wire blocking: https://www.crochetspot.com/how-to-wet-block-crocheted-lace-with-wires/

**Garments / hats / fabric**
- Dora Does — 6 constructions: https://doradoes.co.uk/2019/03/17/crochet-garment-making-demystified-6-common-ways-to-construct-a-crochet-sweater/
- Dora Does — top-down: https://doradoes.co.uk/2019/01/29/demystifying-crochet-garment-making-top-down-crochet-sweaters-explained/
- Dora Does — adjusting yokes: https://doradoes.co.uk/2019/12/04/how-to-adjust-top-down-yoke-crochet-sweaters-to-fit/
- Dora Does — ease: https://doradoes.co.uk/2021/09/17/understanding-ease-in-crochet-garments-positive-and-negative-ease-explained/
- Dora Does — drape: https://doradoes.co.uk/2020/01/18/its-all-about-that-drape-bout-that-drape-no-treble-how-to-find-the-right-drape-in-crochet-fabric/
- Dora Does — cardigans: https://doradoes.co.uk/2023/03/02/all-about-crochet-cardigans-6-ways-to-crochet-a-cardigan/
- Dora Does — short rows: https://doradoes.co.uk/2023/09/20/crochet-short-rows-what-they-are-when-and-how-to-use-them/
- Lion Brand — mesh raglan CAL: https://www.lionbrand.com/community/blog/mesh-raglan-pullover-crochet-along-starting-chain-and-raglan-increases/
- Joy of Motion — granny square sweater: https://joyofmotioncrochet.com/granny-square-sweater/
- Treasurie — hat sizes: https://blog.treasurie.com/crochet-hat-size-guide-charts-printable-templates/
- B.Hooked — hat sizes: https://bhookedcrochet.com/2015/09/07/knit-and-crochet-hat-size-chart-and-sizing-guide/
- Blue Star Boutique — growth: https://thebluestarboutique.com/2018/08/12/fighting-the-growth-in-your-crochet-garments/
- Hodgepodge Crochet — fit: https://hodgepodgecrochetcom.wordpress.com/2026/05/21/why-crochet-clothes-dont-fit-and-why-its-usually-not-the-crocheters-fault/
- KnitPro — drape: https://www.knitpro.eu/usa/blog/knitting-vs-crochet-explore-for-the-perfect-drape

**Freeform / sculptural / computational**
- Wikipedia — Freeform crochet: https://en.wikipedia.org/wiki/Freeform_crochet_and_knitting
- Prudence Mapstone blog: http://prudencemapstone.blogspot.com/
- Cabinet Magazine — Taimina interview: https://www.cabinetmagazine.org/issues/16/wertheim_henderson_taimina.php
- Igarashi et al. 2008 PDF: https://www-ui.is.s.u-tokyo.ac.jp/~takeo/papers/yuki_pg08_knit.pdf
- AmiGo (arXiv): https://arxiv.org/abs/2211.01178 · GitHub: https://github.com/karinsifri/AmiGo
- Narayanan et al. 2018: https://dl.acm.org/doi/10.1145/3186265
- Knit Sketching 2021: https://knitsketching.csail.mit.edu/
- Knitting Skeletons: https://arxiv.org/pdf/1904.05681

**Software**
- Knitware Sweaters: https://knitware-sweaters.software.informer.com/
- DesignaKnit: http://softbyte.co.uk/knitwearpatterndesignsoftwareprogramdesignaknit.htm
- CustomFit (about / shutdown): https://customfit.amyherzogdesigns.com/about/?mwl_redirect=true · http://customfitknits.com/
- Stitch Fiddle: https://www.stitchfiddle.com/en

*Method note:* some claims come from search-engine result summaries because the page itself returned HTTP 403 (Interweave) or was not fetched. These are labelled "search summary" and should be re-verified before being encoded as hard constraints.
