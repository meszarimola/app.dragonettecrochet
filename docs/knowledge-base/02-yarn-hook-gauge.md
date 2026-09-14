# 02 — Yarn, Hooks, Gauge, Physical Dimensions & Yarn Consumption

Research knowledge base for a crochet stitch-chart designer. Compiled 2026-09-14.

**How to read this document**

Every claim carries a source tag such as [S1]. The full URLs are listed in the **Source index** at the end. Each claim is also labelled with how much to trust it:

- **STANDARD**: published by a standards body (Craft Yarn Council) or a textile-unit definition.
- **MANUFACTURER**: a yarn label or manufacturer spec.
- **RULE OF THUMB**: designer or teacher guidance, not measured.
- **DERIVED**: my own arithmetic or fit on the cited data. Not published anywhere; treat it as a default that needs calibration.
- **CONTESTED**: sources disagree, or the evidence is weak.
- **(search excerpt)**: the page itself could not be fetched (403/500), so the claim comes from the search engine's excerpt of it. Confidence is lower.

---

## 1. Yarn weight systems

### 1.1 Craft Yarn Council (CYC) Standard Yarn Weight System — STANDARD [S1][S5]

| CYC # | Name | Common yarn types (US) | Knit gauge (sts / 4 in, stockinette) | Knit needle (mm) | **Crochet gauge (sc / 4 in)** | **Crochet hook (mm)** | **Crochet hook (US)** |
|---|---|---|---|---|---|---|---|
| 0 | Lace | Fingering, 10-count crochet thread | 33–40** | 1.5–2.25 | **32–42 dc**** | Steel 1.6–1.4 mm; regular 2.25 mm | Steel 6, 7, 8; regular B-1 |
| 1 | Super Fine | Sock, fingering, baby | 27–32 | 2.25–3.25 | **21–32** | 2.25–3.5 | B-1 to E-4 |
| 2 | Fine | Sport, baby | 23–26 | 3.25–3.75 | **16–20** | 3.5–4.5 | E-4 to 7 |
| 3 | Light | DK, light worsted | 21–24 | 3.75–4.5 | **12–17** | 4.5–5.5 | 7 to I-9 |
| 4 | Medium | Worsted, afghan, aran | 16–20 | 4.5–5.5 | **11–14** | 5.5–6.5 | I-9 to K-10½ |
| 5 | Bulky | Chunky, craft, rug | 12–15 | 5.5–8 | **8–11** | 6.5–9 | K-10½ to M-13 |
| 6 | Super Bulky | Super bulky, roving | 7–11 | 8–12.75 | **7–9** | 9–15 | M-13 to Q |
| 7 | Jumbo | Jumbo, roving | ≤6 | ≥12.75 | **≤6** | ≥15 | Q and larger |

CYC footnotes, verbatim or near-verbatim [S1]:
- "GUIDELINES ONLY: The above reflect the most commonly used gauges." The ranges describe typical yarns; they are not tolerances.
- Lace-weight yarns "are usually knitted or crocheted on larger needles and hooks to create lacy, openwork patterns". This is why category 0 is gauged in **dc**, not sc.
- "Steel crochet hooks are sized differently from regular hooks—the higher the number, the smaller the hook."
- Crochet gauge is given in **single crochet over 4 in**; knit gauge is stockinette over 4 in [S5].
- Wikipedia's copy of the table lists Super Bulky crochet gauge as **5–9 sc**, not 7–9 [S8]. **CONTESTED**: treat CYC [S1] as canonical.

### 1.2 Wraps per inch (WPI)

**CYC WPI table — STANDARD** [S4]. CYC says it is "based on WPI information shared by industry experts", including Woolery and Ravelry.

| CYC # | WPI |
|---|---|
| 0 Lace | 30–40+ |
| 1 Super Fine | 14–30 |
| 2 Fine | 12–18 |
| 3 Light | 11–15 |
| 4 Medium | 9–12 |
| 5 Bulky | 6–9 |
| 6 Super Bulky | 5–6 |
| 7 Jumbo | 1–4 |

How to measure (CYC) [S4]:
1. Wrap the yarn around a pencil, "snug, and the wraps should lay side by side without any over lapping, or large gaps".
2. Count wraps in 1 inch, measuring in a few places.
3. Caveat: "WPI is subjective, and results will vary depending on how tightly the yarn is wrapped. Always work up a gauge swatch."

**Ravelry's name-based WPI** [S6]:

| Ravelry weight | UK/AU/NZ ply | WPI | Knit gauge / 4 in |
|---|---|---|---|
| Cobweb | 1 ply | — | — |
| Lace | 2 ply | — | 32–34 |
| Light fingering | 3 ply | — | 32 |
| Fingering | 4 ply | 14 | 28 |
| Sport | 5 ply | 12 | 24–26 |
| DK | 8 ply | 11 | 22 |
| Worsted | 10 ply | 9 | 20 |
| Aran | 10 ply | 8 | 18 |
| Bulky | 12 ply | 7 | 14–15 |
| Super Bulky | — | 5–6 | 7–12 |
| Jumbo | — | 0–4 | 0–6 |

Note that Ravelry's CYC-number column is offset from CYC's own. Ravelry files "Sport" under 1 and "DK" under 2, and so on [S6]. **CONTESTED**. When importing Ravelry data, map by name and WPI, not by number.

An alternative WPI chart from a dyer's own experience ("most accurate with yarn that is made mostly of wool") [S12]:
- Lace >23
- Fingering 18–23
- Sport 16–17
- DK 12–15
- Worsted/Aran 9–11
- Bulky 7–8
- Super bulky <7

**CONTESTED** against CYC.

### 1.3 International names and ply — RULE OF THUMB

| US name | UK name | AU/NZ ply | CYC # |
|---|---|---|---|
| Lace / cobweb | 1–2 ply | 1–2 ply | 0 |
| Fingering / sock | 4 ply | 4 ply | 1 |
| Sport | 5 ply ("sport") | 5 ply | 2 |
| DK / light worsted | DK | 8 ply | 3 |
| Worsted | Aran (overlaps) | 10 ply | 4 |
| Aran | Aran | 10 ply | 4 |
| Bulky / chunky | Chunky | 12 ply | 5 |
| Super bulky | Super chunky | 14+ ply | 6 |
| Jumbo | Jumbo | — | 7 |

Sources: [S6][S49]. "Ply" in UK/AU usage is a thickness name, not the actual strand count [S6][S49].

### 1.4 Classifying yarn by meterage (m per 100 g)

The label always gives mass and length. Hungarian retailer Butika notes that the length of 100 g of yarn most accurately indicates thickness: longer means thinner [S13].

**Published ranges (they disagree):**

| Category | Wikipedia [S7] m/100 g | Paper Moon Knits [S11] yd/100 g (→ m) | Purple Lamb [S12] yd/100 g (→ m) | yarn.com (search excerpt) [S52] yd/100 g |
|---|---|---|---|---|
| Lace (0) | >800 | 550–800 (503–732) | — | 600+ |
| Fingering (1) | 500–600 | 380–460 (347–421) | 380–600 (347–549) | 380–600 |
| Sport (2) | — | 300–360 (274–329) | — | 300–380 |
| DK (3) | — | 240–280 (219–256) | 230–300 (210–274) | 230–300 |
| Worsted (4) | 120–200 | 200–240 (183–219) | 170–230 (155–210) | 170–230 |
| Aran (4) | — | 120–180 (110–165) | (in worsted) | (in worsted) |
| Bulky (5) | — | 100–120 (91–110) | 100–170 (91–155) | 100–170 |
| Super bulky (6) | <100 | <100 (<91) | — | — |

(1 yd = 0.9144 m.)

**Butika.hu (Hungarian) ranges** [S13]:
- Lace/fingering 600–800 m/100 g
- Fine 400–480
- Sport/light DK 300–400
- DK 240–300
- Worsted 200–240
- Aran 120–160
- Chunky 110–130
- Jumbo <100

The needle sizes on that page are labelled *kötőtű* (knitting needle), not crochet hook [S13].

**CONTESTED points**
- Categories overlap and dyers disagree: "One dyer may call a skein sport weight, while another calls the same skein light DK" [S11].
- Meterage is a proxy for diameter only when fibre density and loft are similar. Airy, brushed, chainette, or mohair yarns are much fatter per gram than smooth, dense cotton [S12 caveat; see also DERIVED §1.6].

**Normalising label data — STANDARD arithmetic** [S11]:
- `m_per_100g = length_m / mass_g × 100`
- For a 50 g ball, multiply the length by 2.
- 3.5 oz ≈ 100 g and 4 oz ≈ 113 g.

**Suggested classifier (DERIVED).** A pragmatic single-valued scale, taking midpoints of the overlapping sources above. It is not a standard and must be overridable.

| m/100 g | Suggested class |
|---|---|
| ≥ 600 | 0 Lace |
| 350–599 | 1 Super fine (fingering/sock) |
| 280–349 | 2 Fine (sport) |
| 210–279 | 3 Light (DK) |
| 150–209 | 4 Medium (worsted) |
| 110–149 | 4 Medium (aran) → 5 boundary |
| 80–109 | 5 Bulky |
| 40–79 | 6 Super bulky |
| < 40 | 7 Jumbo |

### 1.5 Industrial count systems (European labels, cones, thread)

STANDARD [S9][S10]:

| System | Type | Definition | Relation to m/100 g |
|---|---|---|---|
| **Nm** (metric count) | indirect (length per mass) | km per kg = **m per g** (search excerpt [S10]) | `m_per_100g = 100 × Nm` |
| Plied Nm "2/28" | indirect | 2 plies of Nm 28 → resultant **Nm 14** [S10] | `Nm_resultant = Nm_single / plies` |
| **tex** | direct (mass per length) | g per 1000 m [S9] | `tex = 1000 / Nm` |
| dtex | direct | g per 10 000 m [S9] | `dtex = 10000 / Nm` |
| denier | direct | g per 9000 m [S9] | `den = 9000 / Nm` |
| **Ne** (English cotton count) | indirect | number of 840-yd hanks per lb [S9] | `Ne = Nm / 1.69` [S10] |
| Worsted count (NeK) | indirect | number of 560-yd hanks per lb [S9] | `NeK = Nm / 1.129` (DERIVED from definition) |
| yd/lb ↔ m/kg | — | m/kg = yd/lb × 2.016; yd/lb = m/kg × 0.496 [S10] | — |

**Worked example.** A cone labelled "Nm 2/8":
- Nm = 8 / 2 = 4, which is 4 m/g, which is **400 m/100 g**.
- That classifies as fingering (Paper Moon) or light DK (Butika). **CONTESTED boundary.**
- tex = 1000 / 4 = 250.

### 1.6 Yarn diameter estimates — DERIVED

- Diameter from WPI: `d_mm ≈ 25.4 / WPI`. For example, 9 WPI is about 1/9 in, or about 2.8 mm (search excerpt, arithmetic [S51]). Snug wrapping compresses the yarn, so this is a *compressed* diameter.
- Diameter from meterage: for yarns of equal bulk density, `d ∝ 1/√(m per g)`. I fitted **`WPI ≈ 0.67 × √(m_per_100g)`** to Ravelry's name WPIs and typical meterage:
  - DK 250 m → 10.6 (Ravelry says 11)
  - Worsted 200 m → 9.5 (Ravelry 9)
  - Fingering 400 m → 13.4 (Ravelry 14)
  - Bulky 100 m → 6.7 (Ravelry 7)
  - It fails for lace: 800 m → 19, while CYC says 30+.
  - Use it only as a fallback when WPI is unknown.
- Hook diameter vs yarn diameter (fitted on the CYC hook ranges vs CYC WPI ranges):
  - Worsted: 9–12 WPI → d 2.1–2.8 mm; hook 5.5–6.5 mm; ratio ≈ 2.3.
  - Fingering: d 0.85–1.8 mm; hook 2.25–3.5 mm; ratio ≈ 2.
  - Bulky: d 2.8–4.2 mm; hook 6.5–9 mm; ratio ≈ 2.2.
  - **Standard fabric: hook_mm ≈ 2.2 × d_mm.**
  - **Amigurumi: hook_mm ≈ 1.3–1.5 × d_mm** (PlanetJune worsted with a 3.5 mm hook [S34]).
- In the Storck et al. model of crocheted fabric, stitch spacing is L = 5 mm, with a 4 mm hook and 0.5 mm yarn. They say "thicker yarns also require larger stitches". Their geometric model stays free of yarn interpenetrations only up to a **yarn diameter : stitch size ratio of about 1/10** [S30].

### 1.7 Crochet thread (cotton thread sizes)

- Common sizes are 3, 5, 10, 20 and 30, available in steps of 10 up to 100 (the finest). **Higher number = thinner thread** [S3].
- Size 3 and 5 thread is about as thick as sport or fingering yarn (search excerpt [S48]).
- CYC places "10-count crochet thread" in Lace (0), with steel hooks 6–8 (1.6–1.4 mm) [S1].
- Recommended hooks (search excerpt [S48]):
  - #20: 1.15–1.25 mm
  - #30 and #40: 1.0 mm
  - #60 and #80: 0.75 mm
- Thread-to-hook mapping from crochetcalc [S17], which conflicts in details:
  - Size 5 → 1.65–1.40 mm
  - Size 10 → 1.30–1.10 mm
  - Size 20 → 1.00 mm
  - Size 30 → 0.85 mm
  - Size 40 → 0.75 mm
  - Size 50–70 → 0.60 mm
- **CONTESTED**: size 10 is given as 1.1–1.3 mm in [S17] but 1.4–1.6 mm in [S1].
- Ball meterage is brand-specific. For size 10, Aunt Lydia's Classic 10 is 2730 yd and Red Heart Classic 10 is 1000 yd, though ball masses differ (search excerpt [S48]).

### 1.8 Hungarian terminology

Search budget ran out, so this list is partial.

| Hungarian | English | Source |
|---|---|---|
| horgolótű | crochet hook | [S14][S16] |
| fém horgolótű | metal (steel) hook, for thin yarns | [S14] |
| alumínium horgolótű | aluminium hook, for thicker yarns | [S14] |
| kötőtű | knitting needle | [S13] |
| fonal / fonalvastagság | yarn / yarn thickness (weight) | [S13][S15] |
| sor | row. Example gauge: "5.5 rövidpálca x 6.5 sor = 10 cm x 10 cm" | [S15] |
| láncszem | chain (ch) | [S16] |
| kúszószem | slip stitch (sl st) | [S16] |
| rövidpálca | single crochet (US sc / UK dc) | [S16] |
| félpálca / egyráhajtásos félpálca | half double crochet (US hdc) | [S16], search excerpt [S53] |
| egyráhajtásos pálca | double crochet (US dc / UK tr). "Twice the height of rövidpálca", 3 turning ch | [S16] |
| kétráhajtásos pálca | treble (US tr). "Three times the height of rövidpálca", 4 turning ch | [S16] |
| ráhajtás | yarn over | [S16] |
| csúszócsomó / kezdőcsomó | slip knot | [S16] |
| minta | pattern | [S16] |

- **CONTESTED**: one search excerpt listed *kispálca* as single crochet and *rövidpálca* as a separate "short stitch" (search excerpt [S54]). Regional and older Hungarian usage varies. Confirm with a Hungarian native pattern source before hard-coding.
- Hungarian retailers describe yarn by **m/100 g**, 50 g and 100 g units, and a suggested hook/needle size in mm [S13].
- A Hungarian blogger notes that metric hooks jump from 10 mm straight to 12 mm, so an 11.5 mm hook is hard to buy [S15].

---

## 2. Hook sizes

### 2.1 Regular (yarn) hooks: mm ↔ US ↔ old UK/Canadian

- **Metric mm is the canonical key.** Hook size is defined by shaft diameter [S18].
- US designations come from CYC [S2].
- UK/Canadian old numbers come from crochetcalc [S17]. The 2.0/2.5/3.0/4.0/5.0/6.0 mm points are corroborated by vintage-chart search excerpts [S19].

| mm | US (CYC) | Old UK / Canadian | Notes |
|---|---|---|---|
| 2.00 | — | 14 | |
| 2.25 | B-1 | 13 | |
| 2.50 | — | 12 | |
| 2.75 | C-2 | — | |
| 3.00 | — | 11 | |
| 3.125 | D | — | [S2] |
| 3.25 | D-3 | 10 | |
| 3.50 | E-4 | 9 | |
| 3.75 | F-5 | — | |
| 4.00 | G-6 | 8 | |
| 4.25 | G | — | [S2]. Wikipedia: "4 (or 4.25 mm … depending on the brand)" [S18] |
| 4.50 | 7 | 7 | |
| 5.00 | H-8 | 6 | |
| 5.25 | I | — | [S2] |
| 5.50 | I-9 | 5 | |
| 5.75 | J | — | [S2] |
| 6.00 | J-10 | 4 | |
| 6.50 | K-10½ | 3 | |
| 7.00 | — | 2 | |
| 8.00 | L-11 | 0 | |
| 9.00 | M/N-13 | 00 | crochetcalc lists M/13 [S17] |
| 10.00 | N/P-15 | 000 | crochetcalc lists N/15 [S17] |
| 11.50 | P-16 | — | crochetcalc lists 12 mm as O/16 [S17]: **CONTESTED** |
| 12.00 | — | — | |
| 15.00 | P/Q | — | |
| 15.75 | Q | — | |
| 16.00 | Q | — | |
| 19.00 | S | — | |
| 25.00 | T/U/X | — | |
| 30.00 | T/X | — | |

Rules:
- US letters and numbers increase with size.
- **Old UK numbers decrease as size increases**, the reverse of US [S17].
- Japanese sizing exists (0.75–19 mm charts, e.g. [S17]'s sibling charts) but was not extracted.
- Standardisation matched hooks to metric sizes during the 20th century [S18]. Historically "each manufacturer had its own sizing system", and "significant differences between manufacturers" persist [S19].

### 2.2 Steel (thread) hooks

- Steel hooks are hooks under about 2 mm; hooks of 2 mm or more are "yarn/regular hooks" [S18].
- CYC: the smallest steel hook is **#14 = 0.9 mm** and the largest is **00 = 2.7 mm** [S2]. Higher number = smaller hook.

**Scheme A** is the common "US steel" series. Source: Hungarian table [S14], which matches CYC's first steel column [S3].

| US steel | mm | UK steel (old) |
|---|---|---|
| 00 | 3.50 | — |
| 0 | 3.25 | 0 |
| 1 | 2.75 | 1 |
| 2 | 2.25 | 1½ |
| 3 | 2.10 | 2 |
| 4 | 2.00 | 2½ |
| 5 | 1.90 | 3 |
| 6 | 1.80 | 3½ |
| 7 | 1.65 | 4 |
| 8 | 1.50 | 4½ |
| 9 | 1.40 | 5 |
| 10 | 1.30 | 5½ |
| 11 | 1.10 | 6 |
| 12 | 1.00 | 6½ |
| 13 | 0.85 | 7 |
| 14 | 0.75 | — |

**Brand conflicts. CONTESTED.** Always store and display mm.
- CYC's steel table lists a second series alongside the first [S3]: 00 = 2.70, 0 = 2.55, 1 = 2.35, 2 = 2.20, 4/0 = 1.75, 5 = 1.70, 6 = 1.60, 7 = 1.50, 8 = 1.40, 9 = 1.25, 10 = 1.15, 11 = 1.05, 12 = 1.00, 13 = 0.85, 14 = 0.90/0.75, 12 = 0.60.
- crochetcalc's steel table is different again [S17]: 4 = 1.65, 5 = 1.40, 6 = 1.30, 7 = 1.10, 8 = 1.00, 10 = 0.85, 12 = 0.75, 14 = 0.60.
- A Susan Bates steel **#0 is 3.25 mm**, while a Clover steel **#0 is 1.75 mm** (search excerpt [S17-family, easycrochet/crochetcalc]).
- The Antique Pattern Library notes 1.40 mm is "US 9 in Boye" but maps differently in other brands [S19].

---

## 3. Gauge

### 3.1 Definitions — STANDARD / encyclopaedic

- "A gauge is the number of stitches/rows per inch (or centimeter) of a crochet or knitted item" [S20].
- **Stitch gauge** = stitches ÷ measured width. **Row gauge** = rows ÷ measured height [S20].
- Crochet gauge is affected by tension, stitch type, yarn weight, yarn type, hook size, and "whether the swatch has been/is meant to be blocked" [S20].
- **Tolerance**: gauge "should match to better than 5%, corresponding to 1" of ease in a 20" width" [S20].
- Pattern notation is usually "N sts and R rows = 4 in / 10 cm in [stitch]". DROPS uses "stitches x rows = 10 x 10 cm" (search excerpt [S21-family, garnstudio]).
- Pattern hook sizes are "a recommended starting point, not a rule" [S23].

### 3.2 Making and measuring a crochet swatch — consensus

1. **Use the exact yarn, hook, and stitch pattern of the project** [S24]. If the pattern gives several gauges for different stitch patterns, make a swatch for each [S21].
2. **Size**:
   - Yarnspirations: chain enough for 5–6 in (12.5–15 cm) across and work to a square [S21].
   - TL Yarn Crafts: "approximately 6 x 6 inches" [S23].
   - Sarah Maker: at least 6 in square [S24].
   - Wikipedia: 4×4 in, "preferably 6–8" square" [S20].
   - The Endless Skein: 8 in square when the swatch will also be used for yardage [S40].
   - Starting-chain count = pattern gauge × desired swatch width. Example: 14 sts / 4 in → 21 sts for 6 in [S24]. Lion Brand's example: 16 sts / 4 in → 24 sts [S22].
3. **Ignore edges**. Start counting "a few stitches in from the edge (as the size of your edge stitches may be distorted)" [S22]. Measure in the centre [S24].
4. **Wash and block the swatch the way the finished item will be treated**, let it dry fully, then measure [S22][S24][S29]. The Endless Skein measures both before and after washing [S40].
5. **Measure stitches horizontally and rows vertically over 4 in** (some patterns use 2 in or 1 in) [S21].
6. Measure in a second location. If the readings differ, tension varied across the swatch [S27].
7. **Adjust**:
   - Too many stitches (swatch too small) → larger hook.
   - Too few stitches (swatch too big) → smaller hook [S21][S22][S25].
   - Change the hook in **0.5 mm increments** when the difference is small [S23]. "Half a millimetre is often enough to close a small gap" [S27].

### 3.3 Why small gauge errors matter — worked examples from sources

- Yarnspirations [S21]: the pattern gauge is 15 dc = 4 in. A crocheter who gets 14 dc turns a Medium (40 in bust) into about **43 in**.
- TL Yarn Crafts [S23]: the pattern is 13 sts / 4 in. Getting 14 sts makes a 52 in garment "closer to 48 in".
- crochetcalc [S27]: 140 stitches measure 35 / 40 / 46.7 in at 16 / 14 / 12 sts per 4 in (`width = sts ÷ sts_per_inch`).

### 3.4 Gauge differs by stitch type

- The **stitch** (width) gauge of sc, hdc and dc in the same yarn and hook is broadly similar. The **row** gauge differs strongly, because taller stitches need fewer rows [S25-family search excerpt, desertblossomcrafts]. An example dc swatch gave **14 dc and 7 rows = 4 in** (search excerpt).
- Theoretical height ladder, in chains, from turning-chain convention:

  | Stitch | Turning chains |
  |---|---|
  | sc | 1 |
  | hdc | 2 |
  | dc | 3 |
  | tr | 4 |
  | dtr | 5 |
  | trtr | 6 |

  Sources: [S31]; search excerpt [S32]. Designing Vashti says dc is "theoretically" 3 chains, and that "the chain stitch is crochet's unit of measure" [S31].
- Relative to sc height, Hungarian teaching sources give: hdc halfway between sc and dc (so about 1.5×), **dc = 2 × sc**, **tr = 3 × sc** [S16]; search excerpt [S53].
- **CONTESTED**: the turning-chain ladder (1:2:3:4) and the sc-height ladder (1:1.5:2:3) are not the same scale. A sc is taller than a single chain, and turning-chain counts are a convention that varies by designer.

**Measured sc proportions from manufacturer gauges — MANUFACTURER data, DERIVED ratios**

| Yarn (label) | Hook | Gauge | Stitch width | Row height | row h / st w | st w / hook | row h / hook |
|---|---|---|---|---|---|---|---|
| Red Heart Super Saver (worsted/aran, acrylic, 333 m / 198 g) [S43] | 5.5 mm | 12 sc × 15 rows / 4 in | 8.47 mm | 6.77 mm | **0.80** | 1.54 | 1.23 |
| Lion Brand Pound of Love (worsted, acrylic) (search excerpt [S44]) | 6 mm | 14 sc × 18 rows / 4 in | 7.26 mm | 5.64 mm | **0.78** | 1.21 | 0.94 |
| Lion Brand Wool-Ease Thick & Quick (super bulky) (search excerpt [S45]) | 9 mm | 6.6 sc × 8 rows / 4 in | 15.4 mm | 12.7 mm | **0.82** | 1.71 | 1.41 |
| Sarah Maker example [S24] | — | 14 sc × 17 rows / 4 in | 7.26 mm | 5.98 mm | **0.82** | — | — |
| Jo to the World example [S25] | — | 13 sc × 14 rows / 4 in | 7.82 mm | 7.26 mm | **0.93** | — | — |
| Storck et al. lab sample [S30] | 4 mm | L = 5 mm stitch spacing | 5 mm | — | — | 1.25 | — |

Notes:
- A Scheepjes Catona tension of 26 sts × 36 rows / 10 cm "using 3 mm needles" gives h/w 0.72 (search excerpt [S46]). It is unclear whether that is a crochet or knit tension, so it is excluded from the fit.
- Red Heart's hook size is listed as 5.5 mm by Ravelry [S43] and 5 mm by some retailers (search excerpt).

**DERIVED conclusions**
- **sc row height ≈ 0.8 × sc stitch width** (range 0.78–0.93). Single crochet is slightly wider than tall.
- **sc stitch width ≈ 1.2–1.7 × hook diameter** (central value about 1.4). **sc row height ≈ 0.95–1.4 × hook diameter.**
- **sc height is NOT the hook circumference.** Circumference (π × d) is 17 mm on a 5.5 mm hook, against a measured 6.8 mm row. Circumference relates to the *yarn length* in a loop (§6.4), not to height.
- **dc row height ≈ 2.0 × dc stitch width** from the 14 dc × 7 rows example. Combined with sc h/w 0.8, this gives dc ≈ 2.5 × sc height, which sits above the "2×" teaching rule. **CONTESTED. Default dc = 2.0–2.5 × sc; measure.**
- The Yarnspirations illustration of "15 dc = 4 in and 12 rows = 4 in" [S21] implies dc h/w of only 1.25. It is probably not a real dc row gauge. **Do not use it as data.**

**CYC-consistent gauge ≈ inverse hook size — DERIVED from [S1].** Pair the tight end of each crochet gauge range with the small end of its hook range, and the product *sc per 4 in × hook mm* comes out almost constant:

| Cat. | sc/4 in × hook mm (tight end) | (loose end) |
|---|---|---|
| 1 | 32 × 2.25 = 72 | 21 × 3.5 = 73.5 |
| 2 | 20 × 3.5 = 70 | 16 × 4.5 = 72 |
| 3 | 17 × 4.5 = 76.5 | 12 × 5.5 = 66 |
| 4 | 14 × 5.5 = 77 | 11 × 6.5 = 71.5 |
| 5 | 11 × 6.5 = 71.5 | 8 × 9 = 72 |
| 6 | 9 × 9 = 81 | 7 × 15 = 105 (model breaks down) |

⇒ **sc per 4 in ≈ 72 / hook_mm** (±8%) for categories 1–5. Equivalently, **sc stitch width ≈ 1.41 × hook_mm**, which agrees with the label data above.

Caveat: CYC lists independent ranges, so this pairing is an assumption.

### 3.5 Hook size change → gauge change

- **RULE OF THUMB (search excerpt, unattributed, from a result set including crochetcalc and nickishomemadecrafts):** "each hook size up or down changes your gauge by roughly one stitch per 4 inches". Another source says one hook size shifts gauge by "about half a stitch per inch (2 stitches per 4 inches)". **CONTESTED, low confidence.**
- **DERIVED proportional model** (consistent with §3.4): stitch width ∝ hook diameter.
  - A 0.5 mm step at a 5 mm hook changes stitch width by about 10%.
  - At 12 sc / 4 in, that is about 1.1–1.2 stitches per 4 in, matching the "≈1 st / 4 in" rule.
  - At 20 sc / 4 in on a 3.5 mm hook, a 0.5 mm step is about 14%, or roughly 2.5–3 sts / 4 in.
- **Hook size does not scale row height the same way.** Row height depends heavily on how far the crocheter lifts the working loop (the "golden loop"). TL Yarn Crafts and Sarah Maker recommend adjusting row gauge through the golden loop rather than the hook [S23][S24][S26]:
  - Too few rows means stitches are too tall: keep the loop closer to the work.
  - Too many rows: let the loop rise slightly [S23].
- When changing the number of yarn strands (amigurumi), PlanetJune uses a hook "at least 1.7x the size (in mm)" of the single-strand hook [S34].

### 3.6 Tension variation between crocheters

- "Some crocheters naturally work tightly, others more loosely". Grip style (pencil or knife) and mood affect tension [S24].
- Zeens and Roger classify "golden loop" styles [S26]:
  - **Yankers** pull the loop tight down to the work, giving short stitches.
  - **Riders** keep the hook level; "arguably the most balanced".
  - **Lifters** lift the hook upward, giving taller stitches.
  - Row-height mismatches often come from this style rather than from the yarn or hook.
- PlanetJune's experiment [S33]: a smaller hook at normal tension (C 2.75 mm) and a larger hook at forced tight tension (E 3.5 mm) produced pieces that "look and feel almost exactly the same" in size, stiffness and gaps. **Tension and hook size are interchangeable levers.**
- ⇒ No program can predict an individual's gauge from yarn and hook alone. See §9.

### 3.7 Fibre and yarn structure effects

Sources: [S42][S28][S29]; mohair search excerpt [S47].

| Fibre | Elasticity / memory | Drape | Stitch definition | Blocking response | Design implications |
|---|---|---|---|---|---|
| Wool | High elasticity; "retains its blocked shape" [S42] | medium | good | "respond well to all styles of blocking" [S29]; grows **≈5–10% on wet block, mostly widthways** [S28]; felts in hot water [S42] | Fitted garments; measure blocked gauge |
| Superwash wool | — | more | — | "may grow even more" than wool [S28] | Allow for growth |
| Alpaca | Medium [S42] | "beautiful drape" [S42] | Softened by halo [S42] | Few % change on blocking, but drapes and grows in wear [S28] | Avoid heavy, long pieces without allowance |
| Cotton | Low; "prone to sagging over time" [S42] | drapey, dense | "Sharp" definition [S42] | "hardy and can be resistant to blocking – wet blocking will give best effects" [S29]; **shrinks ≈2–5%, mainly in length** [S28] | Amigurumi (holds shape stuffed, search excerpt [S42-family]), dishcloths, summer tops; avoid fitted pieces [S42] |
| Linen | Low | high | sharp | Little growth; can lose length when washed [S28] | — |
| Bamboo | Low | "silky drape" | sharp | — | Lightweight garments [S42] |
| Acrylic | Medium; holds shape [S42] | low–medium | good | "minimal change" [S28]; steam carefully, too much heat makes it "break" (melt, i.e. "killing") [S29] | Toys, blankets; blocking hardly changes gauge |
| Mohair (and brushed yarns) | — | airy | **Halo obscures stitches**; counting and finding insertion points is hard; frogging is "often impossible" because fibres matt (search excerpt [S47]) | — | Use looser gauge and a larger hook; avoid dense stitch-textured charts; simple stitches only |

Blocking caveats:
- "blocking can increase the size of an item by a small amount (depending on the stitch pattern), but it cannot generally make an item smaller" [S29].
- Designers should state whether a gauge is **blocked or unblocked**, especially for lace [S29].
- Blocking is directional: stitch (width) and row (length) gauge change by different amounts [S28].
- "On wool it can change gauge enough to alter a size" [S27].
- **Lace growth is not quantified in the sources found. CONTESTED / measure.** Open lace typically gains much more than solid fabric, but no reputable number was retrieved.

---

## 4. Physical stitch dimensions

### 4.1 What research exists

**Storck, Gerber, Steenbock & Kyosev, "Topology based modelling of crochet structures"**, *Journal of Industrial Textiles* 52 (2022), DOI 10.1177/15280837221139250 [S30]:
- It notes that crocheted textiles "receive scarce scientific study". This is one of very few quantitative sources.
- Samples used a **4 mm hook** and **~0.5 mm yarn**. Average stitch length and spacing was **L = 5 mm**. Five samples were made and unravelled to measure yarn length.
- Slip-stitch unit-cell key-point relations: next-stitch offset **1.85 × L** in x; **1.23 × H** in y (Eqs. 4, 6). H (height) and D (depth) are free inputs.
- Real yarn tension "pulls the loops tighter and thus stretches the textile in height while narrowing it in width". The idealised model is wider and shorter than real fabric.
- **Yarn length:**
  - Small sample (4 ch + 2 sc rows + 1 sl-st row): model **700 mm** vs measured **533 ± 32 mm**.
  - Larger sample: model **4026 mm** vs measured **3621 ± 110 mm**.
  - The idealised geometry overestimates yarn by roughly 11–31%, because real tension shortens yarn per stitch.
- The model stays free of interpenetrations up to a yarn diameter / stitch size ratio of about **1/10**. Interpenetration counts rise sharply from a ratio of 6/50 to 9/50.

No published formula relating hook diameter to sc height was found. Designer practice relies on swatches.

### 4.2 Consolidated dimension model — DERIVED; calibrate per crocheter

Let `d` = hook diameter in mm.

| Quantity | Default | Plausible range | Basis |
|---|---|---|---|
| sc stitch width `w_sc` | 1.41 d | 1.2 – 1.7 d | CYC fit + labels (§3.4) |
| sc row height `h_sc` | 0.80 w_sc (≈1.13 d) | 0.75 – 0.95 w_sc | labels (§3.4) |
| hdc row height | 1.5 h_sc | 1.3 – 1.7 | Hungarian teaching rule [S16]/[S53] |
| dc row height | 2.0 h_sc | 2.0 – 2.5 | [S16]; 14 dc × 7 rows example |
| tr row height | 3.0 h_sc | 2.7 – 3.3 | [S16] |
| dtr row height | 4.0 h_sc | — | extrapolated from ladder [S31] |
| hdc / dc / tr stitch width | ≈ w_sc | 0.9 – 1.1 w_sc | "main difference … is row gauge" (search excerpt) |
| chain length (along foundation) | ≈ w_sc | foundation chains often tighter; many designers use a larger hook for the chain | RULE OF THUMB, unsourced here: measure |
| slip stitch height | ≈ 0.3–0.5 h_sc | — | unsourced estimate: measure |

**Estimating row gauge for other stitches from a sc gauge** (worked example, DERIVED):
- The swatch is 12 sc × 15 rows / 10.16 cm, so h_sc = 6.77 mm.
- dc row ≈ 13.5 mm (range 13.5–16.9) → ≈ 7.5 dc rows / 10 cm (range 6–7.5).
- hdc row ≈ 10.2 mm → ≈ 9.8 rows / 10 cm.
- tr row ≈ 20.3 mm → ≈ 4.9 rows / 10 cm.

**Worked example (from hook only, no swatch, DERIVED):**
- Hook 4.0 mm, sc.
- w ≈ 5.64 mm → 17.7 sc / 10 cm.
- h ≈ 4.5 mm → 22 rows / 10 cm.
- A 50 cm wide panel ≈ 89 sc. Mark this as "estimate — swatch required".

### 4.3 Rounds (amigurumi and circles)

- For a flat circle in sc, round *r* conventionally has 6r (or 8r, 10r…) stitches. The circumference of round r ≈ stitch count × w.
- Radius grows by about h_sc per round.
- With 6 sts per round, circumference/radius = 6 w / h ≈ 6 / 0.8 = 7.5 > 2π. This is why the 6-increase circle stays flat: extra stitch width is absorbed by the stitches leaning.
- Flatness validation belongs in the stitch-construction research file.
- Sphere estimate for amigurumi: widest round N sts → unstuffed diameter ≈ N × w / π.
  - Example: 36 sts × 5 mm → ≈ 57 mm (DERIVED).
  - Stuffing stretches this by an unquantified amount. **Measure.**

---

## 5. Amigurumi gauge

- **Use a hook 1–2 sizes smaller than the label.** It tightens stitches so stuffing does not show. For example, try 3.5–4.0 mm when the label suggests 5.0 mm. Gauge per se "is not critical for amigurumi; tension is what matters" (search excerpt, Lion Brand / community sources [S33-family]).
- PlanetJune experiment with Caron Simply Soft (light worsted) [S33]:
  - H 5 mm gave "floppy" fabric, too loose.
  - E 3.5 mm (her standard) was "much firmer" and "holds its shape".
  - C 2.75 mm was "even firmer … very solid", and the smallest hook usable without splitting plies.
  - A smaller hook gives "a smaller and firmer crocheted piece, with tighter stitches and smaller gaps".
  - A smaller hook beats forced tight tension (same result, no hand strain).
- **PlanetJune starting hooks per weight** [S34]:

  | Weight | Hook | vs CYC minimum hook |
  |---|---|---|
  | DK (#3) | C 2.75 mm | 4.5 → ×0.61 |
  | Worsted (#4) | E 3.5 mm | 5.5 → ×0.64 |
  | Bulky (#5) | G-7 4.5 mm | 6.5 → ×0.69 |

  DERIVED: **amigurumi hook ≈ 0.6–0.7 × CYC minimum recommended hook.**
- Tests for hook suitability [S34]: push fibrefill behind the work.
  - If "stitches stretch open too much", go down a hook size.
  - If you "cannot easily insert the hook", go up.
- **Finished-size scaling** [S34]:
  - The same pattern in worsted (E hook) is about **3/4 the size** of bulky (G hook).
  - Two strands of worsted on an I 5.5 mm hook (vs one strand on E 3.5 mm) came out **44% larger** and used **2.7× more yarn**.
  - Two strands of a thicker yarn plus a much larger hook give about **2×** size.
  - Doubling strands generally gives "about 1.5 times the size".
- **Physical consistency check (DERIVED):** linear size ∝ stitch width ∝ hook mm. Worsted 3.5 / bulky 4.5 = 0.78, matching PlanetJune's "≈3/4". Yarn use scales roughly with size² (surface): 1.44² = 2.07. The measured 2.7× also reflects the doubled strand's extra mass per stitch.
- Tight-gauge sc estimate for amigurumi (DERIVED, measure): worsted on 3.5 mm → w ≈ 4.9 mm, about 20 sc / 10 cm.

---

## 6. Yarn consumption

### 6.1 Per-stitch and per-area evidence

**Interweave experiment (search excerpt [S35])**, same yarn, crochet vs knit:
- **sc**: 19 g covered 35.94 sq in → **1.89 sq in/g** (0.529 g/sq in).
- **dc**: 38 g covered 91 sq in → **2.39 sq in/g** (0.418 g/sq in).
- ⇒ per unit area, dc uses about **21% less yarn** than sc.

Other claims:
- "a project worked in Single Crochet will use approximately 30% more yarn than a project of the same dimensions worked in Stockinette" (search excerpt [S50]). Another excerpt says sc uses "nearly 40% more" than stockinette. **CONTESTED: 30–40%.**
- Ordering per area: **sc > hdc > dc > tr**. "Crochet becomes more efficient as the stitches get taller" (search excerpts [S50]).
- One excerpt reports a 2 × 6 in swatch where hdc used 13 in less than sc and dc used 38 in less than hdc. The fetched page it seemed to belong to contained only *illustrative* numbers (sc 25 g, hdc 20 g, dc 18 g, tr 16 g) [S55]. **Unverified; do not use as data.**
- Per *stitch*, taller stitches use more yarn; per *area*, they use less [S55].
- Storck et al. (§4.1): measured hand-crocheted yarn is 76–90% of the idealised-geometry length [S30].
- Gauge alone does not reveal yarn consumption: identical squares in different stitches use different yardage [S36].

### 6.2 Area-based yardage rates (published, conflicting)

| Source | Basis | Rate | Metric equivalent |
|---|---|---|---|
| crochetcalc [S37] | worsted, "overlap between a dense dc and an easy hdc" | **0.38 yd/sq in** | 5.4 m per 100 cm² |
| crochetcalc [S37] | DK/sport | 0.48 yd/sq in | 6.8 m / 100 cm² |
| crochetcalc [S37] | bulky | 0.275 yd/sq in | 3.9 m / 100 cm² |
| Petals to Picots worked example [S36] | 6×6 in swatch = 18 g; yarn 220 yd/100 g | 0.5 g/sq in → **1.1 yd/sq in** | 15.6 m / 100 cm² |
| Handy Little Me [S38] | throw 50×60 = 3000 sq in: 1500–2500 yd | 0.5–0.83 yd/sq in | 7.1–11.8 m / 100 cm² |
| Worsted blanket excerpt [S38-family] | throw 1800–2400 yd | 0.6–0.8 yd/sq in | 8.5–11.3 m / 100 cm² |
| Secret Yarnery [S39] | throw 1750–3750 yd | 0.58–1.25 yd/sq in | — |

(1 yd/sq in = 0.1417 m/cm².)

**CONTESTED.** Rates differ by about 3×. Petals to Picots explains why: charts assume different stitches, hooks, fluffiness and tension [S36]. The swatch-weighing method (§6.5) is the only reliable approach.

**DERIVED cross-check.** With the loop heuristic in §6.4, a worsted sc fabric at the Red Heart label gauge works out to about **0.59 yd/sq in (8.4 m per 100 cm²)**, in the middle of the community range.

### 6.3 Published project tables

**Blanket sizes** (crochetcalc [S37]):

| Type | in | cm |
|---|---|---|
| Lovey | 12×12 | 30×30 |
| Cradle | 14×30 | 36×76 |
| Stroller | 30×36 | 76×91 |
| Baby | 30×40 | 76×102 |
| Receiving | 34×40 | 86×102 |
| Crib/toddler | 42×52 | 107×132 |
| Lap | 48×60 | 122×152 |
| Throw | 50×60 | 127×152 |
| Twin | 66×90 | 168×229 |
| Full | 80×90 | 203×229 |
| Queen | 90×100 | 229×254 |
| King | 108×108 | 274×274 |

Handy Little Me gives slightly different sizes, e.g. queen 90×90 and king 108×90 to 108×100 [S38]. **CONTESTED; minor.**

**Blanket yardage** (crochetcalc [S37]; likely low, see §6.2):

| Blanket | Area sq in | DK/sport yd | Worsted yd | Bulky yd |
|---|---|---|---|---|
| Lovey | 144 | 80 | 60 | 40 |
| Stroller | 1080 | 540 | 420 | 300 |
| Baby | 1200 | 600 | 460 | 330 |
| Throw | 3000 | 1400 | 1100 | 800 |
| Twin | 5940 | 2800 | 2200 | 1650 |
| Queen | 9000 | 4300 | 3400 | 2500 |
| King | 11664 | 5500 | 4400 | 3200 |

Handy Little Me general guidelines [S38]:
- Small baby blanket 600–1000 yd
- Large baby blanket 1000–1500 yd
- Throw/lapghan 1500–2500 yd
- Twin 2500–3500 yd
- Queen/king 3500+ yd

Worsted blanket excerpt [S38-family]: baby 700–1000 yd, throw 1800–2400, twin 3200–4000, queen 4800–6000. By weight: DK needs about **+25%** vs worsted; bulky about **−35%**.

Handy Little Me skein counts [S38] (skein size unstated, so low utility):

| Blanket | Worsted | Bulky | Super bulky |
|---|---|---|---|
| Baby | 2–3 | 4–6 | 6–8 |
| Throw | 6–9 | 8–12 | 12–15 |
| Twin | 12–16 | 15–20 | 18–25 |
| Queen | 18–24 | 20–25 | 25–30 |
| King | 22–30 | 25–30 | 30–35 |

**Other projects** (Secret Yarnery [S39], weight-agnostic "starting points, not promises"):

| Project | Yardage |
|---|---|
| Adult scarf | 250–600 yd |
| Hat | 120–300 yd |
| Baby blanket | 800–1600 yd |
| Throw | 1750–3750 yd |
| Adult sweater | 1000–3500 yd |
| Amigurumi | ≤200–400 yd |

- Garment-by-size-by-weight tables were **not retrieved** (search budget exhausted). This is a gap.

**Stitch-pattern adjustments** [S37]:
- Textured stitches (basketweave, bobble): **+15–25%**.
- Granny squares: about **+10%** vs solid fabric.
- Lacy stitches use less; dense and textured stitches use more [S38].

### 6.4 Per-stitch yarn length model — DERIVED; calibrate

A simple loop model: each yarn-over pulled up forms a loop about one hook circumference long (π d), plus the vertical legs.

| Stitch | Yarn length heuristic | 5.5 mm hook, h_sc = 6.8 mm |
|---|---|---|
| ch | ≈ π d + w (≈ 3–4.5 d) | ≈ 25 mm (placeholder) |
| sl st | ≈ ch + small | ≈ 25–30 mm (placeholder) |
| sc | **≈ 2 h_sc + 2 π d** (≈ 8.5–9 d) | **≈ 48 mm** |
| hdc | ≈ 1.25–1.35 × sc | ≈ 60–65 mm |
| dc | ≈ 1.6 × sc | ≈ 77 mm |
| tr | ≈ 2.1–2.4 × sc | ≈ 100–115 mm |

How the numbers were derived:
- The dc factor comes from the Interweave area ratio (dc uses 0.79× sc per area) combined with a dc row of about 2× the sc row: 2 × 0.79 ≈ 1.6.
- hdc and tr factors are interpolated or extrapolated from that.
- The model reproduces about **33 mm per stitch** for Storck's 4 mm hook sample: 533 mm over about 16 stitches (mixed ch/sc/sl st) [S30].
- At the Red Heart gauge it gives 0.59 yd/sq in, inside the published community range (§6.2).
- Expected accuracy is ±30% before calibration.

### 6.5 Recommended estimation method: weigh a swatch — consensus [S36][S40]

1. Crochet a swatch of at least 4 in square, preferably 6–8 in [S40], in the project stitch, then wash and block it [S40].
2. `g_per_area = swatch_mass_g / (swatch_w × swatch_h)`
3. `project_g = g_per_area × project_area` (sum the panel areas; for garments, approximate each piece as rectangles [S40]).
4. `project_m = project_g × (label_m / label_g)`
5. Apply a buffer, then round up to whole balls.

**Worked example (Petals to Picots [S36]):**
- Throw 50×60 in = 3000 sq in. Swatch 6×6 = 36 sq in = 18 g → 0.5 g/sq in.
- 1500 g × 2.2 yd/g = 3300 yd; × 1.10 buffer = **3630 yd ≈ 17 skeins**.

**Worked example (The Endless Skein [S40]):**
- Scarf 72×8 = 576 sq in at 0.344 g/sq in ≈ 198 g.
- Plus fringe: 6 strands/in × 8 in × 2 ends × 3 in ≈ 8 yd.
- A sweater approximated as rectangles: sleeves (5×24)×4 = 480 sq in; body ((9+15)×22)×2 = 1056 sq in; total 1536 sq in → 528 g.

**Metric worked example (DERIVED from the method):**
- A 15 × 15 cm blocked swatch weighs 14.2 g → 0.0631 g/cm².
- Blanket 100 × 130 cm = 13 000 cm² → 820 g.
- Yarn 200 m / 100 g → 1640 m; × 1.10 = 1804 m → 10 balls of 100 g (2000 m).

**Extra-allowance percentages (published)**

| Source | Allowance |
|---|---|
| Lion Brand [S41] | "add at least 10% extra … gauge differences, swatching, and mistakes", and buy all from one dye lot |
| Petals to Picots [S36] | 10% |
| Secret Yarnery [S39] | 10–15% cushion |
| crochetcalc [S37] | ~15% (swatch, joins, dye-lot insurance) |
| Blanket excerpt [S38-family] | at least 1 extra ball; 2 extra for queen/king |

---

## 7. Other yarn characteristics that affect design

- **Elasticity and memory**: wool is elastic and holds a blocked shape. Cotton, linen and bamboo have low elasticity, and cotton sags over time [S42]. Crochet fabric is less stretchy than knit, so fitted crochet garments in low-elasticity fibres need ease.
- **Drape**: for fluid drape, choose cotton, silk, linen or bamboo (search excerpt [S42-family]). Alpaca drapes and grows [S42][S28]. Taller, open stitches (dc, tr, lace) drape more than dense sc (RULE OF THUMB).
- **Stitch definition**: smooth, low-crimp, mercerised cotton gives sharp definition, best for textured and post stitches and for colourwork. Halo fibres (mohair, alpaca) blur stitches [S42]; mohair also makes counting and frogging hard (search excerpt [S47]).
- **Dye lots**: "A dye lot is the specific production batch in which a group of yarn skeins were dyed together" [S41]. Lots differ because of fibre uptake and dye-bath conditions (temperature, water minerals, pH, timing, dye-to-fibre ratio) [S41]. A half-shade difference shows as a stripe across large flat areas (search excerpt [S41-family]).
  - Buy all yarn at once from one lot, plus at least 10% [S41].
  - If lots must mix, alternate: "Work two rows with skein A, then two rows with skein B" [S41].
  - "No dye lot" yarns exist, e.g. Red Heart Super Saver solids (search excerpt [S43-family]).
- **Colour changes**: yardage per colour = stitch count per colour × yarn-per-stitch (§6.4). Carried or tapestry colourwork also consumes carried strands (roughly the full row width per carried colour; RULE OF THUMB, unsourced here). Changing colour affects gauge in tapestry crochet. Swatch the colourwork itself.

---

## 8. Encodable rules and formulas

Conventions: lengths in mm unless noted. `Gauge = { sts: number, rows: number, overCm: number, stitch: 'sc'|'hdc'|'dc'|'tr'|..., blocked: boolean }`.

```ts
// ---------- Units & label data (STANDARD arithmetic) ----------
const IN = 25.4;                                   // mm
const YD = 0.9144;                                 // m
metersPer100g(lengthM, massG)       = lengthM / massG * 100
nmFromMetersPer100g(m100)           = m100 / 100                 // Nm = m/g
texFromNm(nm) = 1000 / nm;  denierFromNm(nm) = 9000 / nm;  neFromNm(nm) = nm / 1.69
resultantNm("2/28")                 = 28 / 2                     // plied notation
gaugePer10cm(stsPer4in)             = stsPer4in * 100 / 101.6

// ---------- Classification ----------
classifyByWPI(wpi)          // CYC table §1.2; overlapping ranges -> return candidates[]
classifyByMeterage(m100)    // §1.4 suggested thresholds; return {class, confidence:'low'}
estimateWPI(m100)           = 0.67 * Math.sqrt(m100)       // DERIVED, fails for lace/airy yarns
yarnDiameterMm(wpi)         = 25.4 / wpi                   // compressed diameter
recommendedHookRangeMm(cyc) // CYC table §1.1
suggestHookMm(yarnDiaMm, purpose) =
    purpose === 'amigurumi' ? 1.4 * yarnDiaMm : 2.2 * yarnDiaMm   // DERIVED
amigurumiHookMm(cyc)        = 0.65 * cycMinHookMm(cyc)     // DERIVED from PlanetJune [S34]

// ---------- Hook conversion (lookup tables §2) ----------
hookToUS(mm) / usToMm(label) / hookToOldUK(mm)   // canonical key = mm; warn on brand-specific steel sizes
isSteelHook(mm)             = mm < 2.0

// ---------- Gauge -> dimensions ----------
stitchWidthMm(g)            = g.overCm * 10 / g.sts
rowHeightMm(g)              = g.overCm * 10 / g.rows
stitchesForWidth(widthCm, g) = Math.round(widthCm * g.sts / g.overCm)   // round to pattern multiple elsewhere
rowsForHeight(heightCm, g)   = Math.round(heightCm * g.rows / g.overCm)
widthForStitches(n, g)       = n * g.overCm / g.sts                     // cm
gaugeMatches(measured, target, tol = 0.05)                               // Wikipedia 5% rule [S20]
    = Math.abs(measured.sts/measured.overCm - target.sts/target.overCm)
      / (target.sts/target.overCm) <= tol

// ---------- Default geometry when no swatch exists (DERIVED, flag as estimate) ----------
STITCH_HEIGHT_FACTOR = { slst: 0.4, sc: 1.0, hdc: 1.5, dc: 2.0 /*2.0–2.5*/, tr: 3.0, dtr: 4.0 }
estimateScWidthMm(hookMm)         = 1.41 * hookMm            // range 1.2–1.7
estimateScRowHeightMm(hookMm)     = 0.80 * estimateScWidthMm(hookMm)
estimateRowHeightCm(stitch, g)    // g may be an sc gauge or same-stitch gauge
    = g.stitch === stitch ? rowHeightMm(g)/10
      : rowHeightMm(g)/10 * STITCH_HEIGHT_FACTOR[stitch] / STITCH_HEIGHT_FACTOR[g.stitch]
estimateGaugeFromHook(hookMm, stitch='sc') =
    { sts: 101.6/estimateScWidthMm(hookMm), rows: 101.6/(estimateScRowHeightMm(hookMm)*STITCH_HEIGHT_FACTOR[stitch]),
      overCm: 10.16, stitch, blocked:false, estimated:true }
cycGaugeFromHook(hookMm)          = 72 / hookMm              // sc per 4 in, CYC fit, cats 1–5
gaugeAfterHookChange(g, oldMm, newMm) =                       // proportional model; widths only
    { ...g, sts: g.sts * oldMm / newMm, rows: g.rows /* row height: keep, flag uncertain */ }

// ---------- Blocking ----------
BLOCK_GROWTH = { wool:{w:+0.075,h:+0.03}, superwash:{w:+0.10,h:+0.05}, alpaca:{w:+0.03,h:+0.03},
                 cotton:{w:0,h:-0.035}, linen:{w:0,h:-0.03}, acrylic:{w:0,h:0}, lace:'measure' }
applyBlocking(dimsCm, fiber)      // DERIVED from ranges [S28]; lace & mohair -> require swatch

// ---------- Rounds / amigurumi ----------
roundCircumferenceMm(sts, g)      = sts * stitchWidthMm(g)
unstuffedSphereDiameterMm(maxSts, g) = maxSts * stitchWidthMm(g) / Math.PI
scaleAmigurumi(size, fromHookMm, toHookMm) = size * toHookMm / fromHookMm   // ≈3/4 bulky→worsted [S34]
doubledStrandHookMm(hookMm)       = 1.7 * hookMm                             // [S34]

// ---------- Yarn consumption ----------
YARN_PER_STITCH_FACTOR = { ch: 3.5, slst: 4.5, sc: 8.7, hdc: 11.3, dc: 13.9, tr: 19.5 }  // × hookMm → mm, DERIVED ±30%
yarnPerStitchMm(stitch, hookMm, calib = 1) = YARN_PER_STITCH_FACTOR[stitch] * hookMm * calib
chartYarnM(chart, hookMm, calib)  = Σ over cells yarnPerStitchMm(cell.stitch, hookMm, calib) / 1000
yarnFromSwatch(swatchG, swatchWcm, swatchHcm, projectAreaCm2, labelM, labelG, buffer = 0.10)
    = swatchG / (swatchWcm*swatchHcm) * projectAreaCm2 * (labelM/labelG) * (1 + buffer)   // [S36][S40]
calibrationFactor(measuredSwatchG, labelM, labelG, swatchChart, hookMm)
    = (measuredSwatchG * labelM/labelG) / chartYarnM(swatchChart, hookMm, 1)
ballsNeeded(meters, labelM)       = Math.ceil(meters / labelM)
TEXTURE_ALLOWANCE = { solid: 0, granny: 0.10, textured: 0.20 /*0.15–0.25*/ }   // [S37]
DEFAULT_BUFFER = 0.10 /* 0.10–0.15 */                                          // [S41][S39][S37]

// ---------- Validation / warnings ----------
warnIfHookOutsideCYC(cyc, hookMm)       // amigurumi exempt: expect 0.6–0.7× min
warnIfGaugeImplausible(g, hookMm)       // stitch width outside 1.0–2.0 × hookMm
warnMixedDyeLots(balls)                  // suggest alternating 2 rows each [S41]
warnHaloYarnWithTexture(fiber, chart)    // mohair/alpaca + post stitches/bobbles -> poor definition
```

Implementation notes:
- Store every physical quantity with a **provenance flag**: `measured | label | estimated`. Show estimates with a range, not a single number.
- Stitch width is roughly constant across sc/hdc/dc in the same yarn and hook. **Row height is stitch-specific**, so a chart mixing stitch heights in one row needs its row height set by the tallest stitch, with short stitches padded by chains per the construction rules.
- Round every computed stitch count to the pattern repeat multiple, plus edge stitches.

---

## 9. What must be measured from the real crocheter

These parameters cannot be reliably derived from yarn label plus hook. The app should ask for a swatch, or offer calibrate-later with clearly flagged estimates.

1. **Stitch gauge in the actual stitch pattern**, with the chosen yarn and hook: sts per 10 cm, measured in the centre of a blocked swatch of at least 15 cm [S20][S21][S22][S24]. It depends on personal tension, grip and loop style [S24][S26]. Label gauges are for "average" tension and sc only.
2. **Row gauge per stitch type** (sc, hdc, dc, tr, each if used). Row height depends on how the golden loop is lifted and varies more between people than stitch width [S23][S26]. The sc:hdc:dc:tr height ratios are contested (§3.4).
3. **Blocked vs unblocked gauge and dimensional change**: measure before and after washing and blocking [S40]. Especially needed for wool (+5–10% width), superwash, alpaca (grows in wear), cotton (shrinks in length), and **all lace**, where growth is unquantified [S28][S29].
4. **Swatch mass** (grams, over a known area): the only reliable yarn-per-area figure. Published rates differ by about 3× [S36][S37][S38]. It also calibrates the per-stitch yarn model.
5. **Actual yarn meterage** when the label is missing (weigh plus measure a length), and **WPI** for unlabeled or fluffy yarn. WPI is subjective [S4]. Meterage-based classification fails for airy yarns [S11][S12].
6. **Foundation chain length vs stitch width**: many crocheters chain tighter than they stitch. Measure a chain of N.
7. **Round gauge for amigurumi and circles**: stitches per cm along the circumference and rounds per cm, measured on a worked flat circle. For stuffed pieces, also measure the finished dimension after stuffing, since stretch is unquantified [S33][S34].
8. **Colourwork gauge** (tapestry or carried strands), if used; it differs from single-colour gauge.
9. **The actual hook's mm size**, for steel and vintage hooks: US steel numbers map to different mm by brand [S3][S17][S19]. Read the mm stamp or use a gauge tool.
10. **Consistency drift**: a second measurement elsewhere on the swatch, and ideally a re-check partway through a large project. Tension varies across a swatch and with mood [S24][S27].

---

## 10. Gaps and open questions

- DROPS/Garnstudio yarn groups A–F (m per 50 g and substitution rules) could not be fetched (403).
- Interweave's experiment page returned 403; only search-excerpt numbers are used.
- There are no rigorous measured tables of yarn length per sc/hdc/dc/tr; §6.4 is derived.
- There are no quantified crochet lace blocking growth figures.
- Garment yardage by size and yarn weight was not retrieved.
- Japanese hook sizes were not extracted.
- The Hungarian *kispálca* / *rövidpálca* mapping needs native-source confirmation.

---

## Source index

| Tag | Source | URL |
|---|---|---|
| S1 | Craft Yarn Council — Standard Yarn Weight System | https://www.craftyarncouncil.com/standards/yarn-weight-system |
| S2 | Craft Yarn Council — Hooks & Needles | https://www.craftyarncouncil.com/standards/hooks-and-needles |
| S3 | Craft Yarn Council — Steel Crochet Hook & Crochet Thread Sizes | https://www.craftyarncouncil.com/standards/steel-crochet-hook-crochet-thread-sizes |
| S4 | Craft Yarn Council — How to Measure WPI | https://www.craftyarncouncil.com/standards/how-measure-wraps-inch-wpi |
| S5 | Craft Yarn Council blog — YDKWYDK guide to yarn weights | https://www.craftyarncouncil.com/blog/ydkwydk-guide-yarn-weights |
| S6 | Ravelry — Yarn weights help | https://www.ravelry.com/help/yarn/weights |
| S7 | Wikipedia — Yarn weight | https://en.wikipedia.org/wiki/Yarn_weight |
| S8 | Wikipedia — List of yarns for crochet and knitting | https://en.wikipedia.org/wiki/List_of_yarns_for_crochet_and_knitting |
| S9 | Wikipedia — Units of textile measurement | https://en.wikipedia.org/wiki/Units_of_textile_measurement |
| S10 | Kniterate support — Yarn count and converting yarn counts (search excerpt; also incatops.com Nm article) | https://support.kniterate.com/hc/en-us/articles/360005872257-Yarn-count-and-converting-yarn-counts |
| S11 | Paper Moon Knits — Yarn weight category vs yardage | https://www.papermoonknits.com/musings/math-mondays-yarn-weight-category-vs-yardage |
| S12 | Purple Lamb Fiber Arts — Nerding out about yarn weights and measures | https://www.purplelambfiberarts.com/nerding-out-about-yarn-weights-and-measures/ |
| S13 | Butika.hu — Fonalak vastagsága | https://www.butika.hu/blog/cikkek/fonalak-vastagsaga |
| S14 | Tanulj horgolni! — Horgolótű méretek | https://tanulj-horgolni.blogspot.com/p/horgolotu-meretek.html |
| S15 | Tanulj horgolni! — Fonalvastagság | https://tanulj-horgolni.blogspot.com/p/fonalvastagsag.html |
| S16 | Horgolj magadnak — Alap pálcák a horgolásban | https://horgoljmagadnak.hu/horgolas-alapok-alap-palcak-a-horgolasban/ |
| S17 | CrochetCalc — Crochet hook size chart (mm/US/UK, steel) | https://crochetcalc.com/articles/crochet-hook-size-chart.html |
| S18 | Wikipedia — Crochet hook | https://en.wikipedia.org/wiki/Crochet_hook |
| S19 | Antique Pattern Library — Vintage crochet hook size chart | https://www.antiquepatternlibrary.org/vintagehooks.htm |
| S20 | Wikipedia — Gauge (textile crafts) | https://en.wikipedia.org/wiki/Gauge_(textile_crafts) |
| S21 | Yarnspirations — How to Measure Crochet Gauge | https://www.yarnspirations.com/blogs/how-to/how-to-measure-crochet-gauge |
| S22 | Lion Brand — Gauge Swatch 101 | https://www.lionbrand.com/community/blog/gauge-swatch-101-how-to-make-and-measure-your-swatch/ |
| S23 | TL Yarn Crafts — Crochet gauge: what it is and why it matters | https://tlycblog.com/crochet-gauge-what-is-it-and-why-it-matters/ |
| S24 | Sarah Maker — How to Measure Crochet Gauge | https://sarahmaker.com/crochet-gauge/ |
| S25 | Jo to the World Creations — Crochet Gauge guide (also desertblossomcrafts.com/crochet-gauge-swatch/ via search excerpt) | https://jototheworld.com/crochet-gauge |
| S26 | Zeens and Roger — Crochet tension: how to get gauge for garments | https://zeensandroger.com/2022/03/21/crochet-tension-how-to-get-gauge-for-your-garments/ |
| S27 | CrochetCalc — Crochet gauge guide | https://crochetcalc.com/articles/crochet-gauge-guide.html |
| S28 | KnitCalcs — Blocking shrinkage predictor | https://knitcalcs.uk/finishing/blocking-shrinkage-predictor/ |
| S29 | Dora Does — Blocking explained | https://doradoes.co.uk/2020/02/22/blocking-explained-when-and-how-to-block-crochet-projects/ |
| S30 | Storck, Gerber, Steenbock, Kyosev (2022) "Topology based modelling of crochet structures", J. Industrial Textiles 52, DOI 10.1177/15280837221139250 | https://www.hsbi.de/publikationsserver/download/2181/2182/15280837221139250.pdf |
| S31 | Designing Vashti — Crochet stitch equivalents | https://www.designingvashti.com/crochet-stitch-equivalents-issue-2/ |
| S32 | Oombawka Design — Recommended number of turning chains (search excerpt) | https://oombawkadesigncrochet.com/recommended-number-of-turning-chains/ |
| S33 | PlanetJune — Stitch tension in amigurumi: an investigation | https://www.planetjune.com/blog/stitch-tension-in-amigurumi-an-investigation/ |
| S34 | PlanetJune — Resizing amigurumi | https://www.planetjune.com/blog/amigurumi-help/resizing-amigurumi/ |
| S35 | Interweave — Yarn usage for knitting vs crochet: a science experiment (search excerpt; page 403) | https://www.interweave.com/article/knitting/yarn-usage-knitting-vs-crochet-experiment/ |
| S36 | Petals to Picots — Why blanket yardage estimates disagree / yardage calculator | https://www.petalstopicots.com/yardage-calculator/ |
| S37 | CrochetCalc — Crochet blanket size guide | https://crochetcalc.com/articles/crochet-blanket-size-guide.html |
| S38 | Handy Little Me — Crochet blanket sizes + how much yarn (search-excerpt family also includes christacodesign.com, caydo.com) | https://www.handylittleme.com/crochet-blanket-sizes-and-how-much-yarn/ |
| S39 | Secret Yarnery — How much yarn do I need? Crochet yardage guide 2026 | https://secretyarnery.com/blogs/blog/how-much-yarn-do-i-need-crochet-yardage-guide-2026 |
| S40 | The Endless Skein — How to estimate yarn for a project | https://theendlessskein.com/pages/how-to-estimate-yarn-for-a-project |
| S41 | Lion Brand — Yarn dye lots explained | https://www.lionbrand.com/community/blog/yarn-dye-lots-explained-for-consistent-color-projects/ |
| S42 | Lion Brand — Yarn fiber properties: a crafter's complete guide | https://www.lionbrand.com/community/blog/yarn-fiber-properties-a-crafters-complete-guide/ |
| S43 | Ravelry — Red Heart Super Saver (Solids) | https://www.ravelry.com/yarns/library/red-heart-super-saver-solids |
| S44 | Lion Brand — Pound of Love (search excerpt) | https://www.lionbrand.com/products/pound-of-love-yarn |
| S45 | Lion Brand — Wool-Ease Thick & Quick (search excerpt) | https://www.lionbrand.com/products/wool-ease-thick-and-quick-yarn |
| S46 | Rito.com — Scheepjes Catona (search excerpt) | https://rito.com/751-scheepjes-catona |
| S47 | Zeens and Roger — Top tips for working with mohair (search excerpt) | https://zeensandroger.com/2022/01/04/8-top-tips-for-working-with-mohair-yarn/ |
| S48 | Aabhar Creations — Crochet thread and steel hook sizes (search excerpt; also crochet-news.com) | https://aabharcreations.com/crochet-thread-size-and-steel-hook-size/ |
| S49 | Handy Little Me — Yarn weight chart | https://www.handylittleme.com/yarn-weights-beginners-guide/ |
| S50 | Yarn Over Hook — Crochet vs knitting yarn usage (search excerpt; page 403; also craftsy.com) | https://yarnoverhook.com/crochet-vs-knitting-yarn-usage/ |
| S51 | Sarah Maker — Yarn weights guide (search excerpt for WPI→diameter arithmetic) | https://sarahmaker.com/yarn-weights-guide/ |
| S52 | Yarn.com (WEBS) — Yarn weight chart (search excerpt) | https://www.yarn.com/blogs/the-yarn-diary/yarn-weight-chart-knitting |
| S53 | Tarkafirka blog — Horgolás: kezdés, pálcák, fordulás (search excerpt) | https://tarkafirka.blog.hu/2012/09/26/horgolas_kezdes_palcak_fordulas |
| S54 | Magyar horgolás — Horgolás alapjai kezdőknek (search excerpt) | https://magyarhorgolas.blogspot.com/p/horgolas-alapjai-kezdoknek.html |
| S55 | Catherine Crochets — Which crochet stitches use the most yarn? | https://catherinecrochets.com/which-crochet-stitches-use-the-most-yarn/ |
