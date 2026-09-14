# Crochet Knowledge Base — 01: Stitches (Anatomy, Heights, Widths, Notation)

Research report for a web-based crochet stitch-chart designer. US terminology is used throughout unless stated otherwise.

**Evidence labels used in this document**

| Label | Meaning |
|---|---|
| **[C]** | Consensus: several independent reputable sources agree, including standards bodies (Craft Yarn Council = CYC). |
| **[R]** | Rule of thumb: widely repeated designer practice, not a strict standard. Real results vary with the crocheter, yarn and hook. |
| **[X]** | Contested: sources disagree, or conventions differ by designer, region or tradition. Software should make these configurable. |
| **[E]** | Editor inference: derived by this report from cited data (arithmetic, synthesis) or from general practice where I couldn't find a direct citation. Treat as a hypothesis to validate. |

Source tags such as [S1] are Markdown reference links. The full URL list is in the **Sources** section at the end.

---

## 1. Basic stitch anatomy

### 1.1 What a crochet stitch physically is
- Crochet completes each stitch before starting the next, with one active loop on the hook. Knitting keeps many stitches live at once. **[C]** [S20]
- The chain is the basic building block: you pull a loop through the loop already on the hook, and repeat. **[C]** [S20]
- Designing Vashti (a tech editor): "the chain stitch is crochet's unit of measure". Heights of tall stitches are expressed in chains. **[C/R]** [S13]

### 1.2 Parts of a stitch

| Part | Description | Source |
|---|---|---|
| **Top "V"** | Two loops on top of the stitch, which look like a sideways "v" from above. By default the hook goes under both. | [S7], [S8] |
| **Front loop (FL)** | The top loop nearer to you as the work faces you. | [S8], [S7] |
| **Back loop (BL)** | The top loop farther from you. | [S8], [S7] |
| **Third loop** | A horizontal bar below the V. Only hdc and taller stitches have one, because it is made by the yarn-over. On an hdc it sits on the back. Working into it pushes the V forward as a braid-like ridge. | [S7], [S9] |
| **Post / body** | The vertical part that gives the stitch its height. It is very short on sc and long on dtr. It sits slightly to one side of the stitch top. | [S7], [S8] |
| **Space between stitches** | The gap between posts. Some patterns insert the hook here, for example granny squares. | [S7] |
| **"Golden loop"** | The first loop pulled up after inserting the hook. Its height largely sets the stitch height and row gauge. | [S7], [S14] |
| **Slant** | Stitches lean naturally, and taller stitches lean more, which produces zig-zag rows. | [S7] |

- **[C]** For an hdc worked flat, the "third loop" is on the back of the fabric as you look at the row [S9]. Dora Does also names a "front third loop" on the front (really the yarn-over bar seen from the other side) [S7].
- **[R]** For tall stitches the loop-height technique matters more than hook size. Vashti describes "Lifters, Riders, and Yankers": the same stitch gauge can come with different row gauges [S14].

---

## 2. Stitch heights and turning chains

### 2.1 Consensus turning-chain table (US terms)

| Stitch (US) | Yarn-overs before insertion | Standard turning chain (tch) | Tch counts as a stitch? (most common US convention) |
|---|---|---|---|
| slip stitch | 0 | 0 | n/a |
| single crochet | 0 | 1 | **No** |
| half double crochet | 1 | 2 | **Varies** (US often no; Japanese yes) |
| double crochet | 1 | 3 | **Usually yes** |
| treble | 2 | 4 | **Usually yes** |
| double treble | 3 | 5 | Usually yes |
| triple treble | 4 | 6 | Usually yes |

Sources: [S3] (Wikipedia list: sl st 0, sc 1, hdc 2, dc 3, tr 4, dtr 5), [S5] (Edie Eckman), [S10] (byGoldenberry), [S11] (Joanna's Crochet), [S12] (Sigoni Macaroni), [S13] (trtr = 6 chains), [S4] (CYC "How to read").

- **[C]** The user's belief is confirmed on the chain-equivalent scale: sl st ≈ 0, sc ≈ 1, hdc ≈ 2, dc ≈ 3. Each extra yarn-over adds one chain of height: tr 4, dtr 5, trtr 6. [S3], [S10], [S13]
- **[C]** CYC: for sc, the ch-1 turning chain "does not count as a stitch" and "just disappears". For dc and taller, the turning chain counts as the first stitch. [S4]
- **[C]** CYC: a sc row is never worked into the skipped chain ("It is gone forever!"). For dc, the skipped chains count as the first stitch. [S4]

### 2.2 Disagreements and variants **[X]**

| Point | Positions | Sources |
|---|---|---|
| Does the hdc ch-2 count? | Sigoni Macaroni: **no** (work the first hdc into the first st). Edie Eckman: "sometimes". Japanese convention: **yes**, the 立ち上がり ch-2 counts as the first hdc. | [S12], [S5], [S21] |
| ch-2 instead of ch-3 for dc | Many modern designers use **ch 2 that does NOT count**, then dc into the first stitch, to avoid the gap that ch-3 plus a skipped stitch leaves. | [S12], [S22] |
| ch-1 for hdc, ch-2 for dc | Some crocheters use one chain fewer because the standard counts leave loose edges. | [S23] (search summary) |
| ch-3 taller than the dc | Vashti found her ch-3 was taller than her dc. Her fix is to pull up a taller loop so the dc really is 3 chains tall. | [S14] |
| Hungarian: when to chain | One Hungarian author makes the soremelés (turning chain) at the **end** of a row instead of the start, and notes some people chain only 2 for erp (dc). | [S24] |
| Post-stitch rows | Edie Eckman starts FPdc/BPdc rib rows with **ch-2** and ends with an hdc (neither is a post stitch). | [S25] |

**Foundation chain arithmetic (Edie Eckman) [C]** [S5]

| Row 1 made of | Tch counted? | Foundation chains for N stitches | First stitch goes into |
|---|---|---|---|
| sc | no | N + 1 | 2nd ch from hook |
| hdc | no | N + 2 | 3rd ch from hook |
| hdc | yes | N + 1 | 3rd ch from hook (the tch plus base chain act as st 1) |
| dc | no | N + 3 | 4th ch from hook |
| dc | yes | N + 2 | 4th ch from hook |

- Stitchsums gives the simplified form "stitches + tch" (sc +1, hdc +2, dc +3, tr +4; a 100-st dc project needs 103 ch) [S15]. Under the "tch counted" convention the counts agree with Eckman's "not counted" rows, because the skipped chains become stitch 1. **[E]**
- **[E]** Japanese convention: hdc uses the 4th ch from hook and dc the 5th [S21]. That is the standing chains, plus one base chain that counts as st 1, plus one.

### 2.3 Real measured heights (not just chain counts)

**Measured heights, worsted weight, 5.0 mm hook (Joanna's Crochet)** [S11]

| Stitch | Height per row | Ratio to sc (midpoints) **[E]** | mm per chain-equivalent **[E]** |
|---|---|---|---|
| sl st | ~1–2 mm | ~0.2 | — |
| sc | ~6–8 mm | 1.0 | 7 / 1 = 7.0 |
| hdc | ~10–12 mm | ~1.6 | 11 / 2 = 5.5 |
| dc | ~16–20 mm | ~2.6 | 18 / 3 = 6.0 |
| tr | ~24–30 mm | ~3.9 | 27 / 4 = 6.75 |

**Other height claims**
- **[X]** Several sources say a dc is only about **2×** as tall as a sc, not 3×:
  - Joanna's Crochet: each step "roughly doubles" [S11].
  - Hungarian sources: erp (dc) = "kétszer olyan magas, mint a rövidpálca", krp (tr) = 3× rp [S26], [S27].
  - Wikipedia: sc ≈ 2 knit stitches tall and dc ≈ 4, which gives dc/sc ≈ 2 [S20].
  - A web summary gives sc ≈ ¼ inch and dc ≈ ½ inch in worsted [S23].
  - Ronique's Japanese chart guide says hdc ≈ 2×, dc ≈ 3×, tr ≈ 4× sc [S28]. That matches chain counts.
- **[E] Reconciliation.** Joanna's data (the only real mm data found) fits a model where **one chain-equivalent ≈ 5.5–7 mm in worsted** and **sc ≈ 1 chain**. The chain scale (0/1/2/3/4) is therefore a reasonable linear model, with dc/sc ≈ 2.6. The "2×" statements are rough and don't agree with each other. The hdc comes out a bit short and tall stitches a bit tall per chain. Recommendation: model height as `h(stitch) = k_ch × chainEquiv(stitch)` with a per-user calibration factor, and optionally a per-stitch correction.

**Width**
- **[R]** Harrisville Designs: sc and dc "look identical horizontally, and should have the same stitch per inch gauge". Width is roughly independent of stitch height. [S29]
- **[C]** CYC gives crochet gauge in **sc per 4 in (10 cm)** for each yarn weight (table below) [S30].

| CYC weight | sc per 4 in | Hook (mm) | Width per sc **[E]** |
|---|---|---|---|
| 0 Lace | 32–42 **dc** | 2.25 mm | ~2.4–3.2 mm |
| 1 Super Fine | 21–32 | 2.25–3.5 | ~3.2–4.8 mm |
| 2 Fine | 16–20 | 3.5–4.5 | ~5.1–6.4 mm |
| 3 Light | 12–17 | 4.5–5.5 | ~6.0–8.5 mm |
| 4 Medium | 11–14 | 5.5–6.5 | ~7.3–9.2 mm |
| 5 Bulky | 8–11 | 6.5–9 | ~9.2–12.7 mm |
| 6 Super Bulky | 7–9 | 9–15 | ~11.3–14.5 mm |
| 7 Jumbo | ≤6 | ≥15 | ≥17 mm |

Width per sc = 101.6 mm ÷ stitch count.

**Aspect ratio (height ÷ width)**
- **[E]** For worsted, sc h/w ≈ 7 mm ÷ 8.3 mm ≈ **0.85**, so sc is slightly wider than tall and close to square. dc h/w ≈ 18 ÷ 8.3 ≈ **2.2**. (Joanna's heights at 5 mm combined with CYC worsted widths.)
- **[X]** Stitchsums publishes h:w ratios of sc 1.0–1.2, hdc ~1.0, dc ~0.7, tr ~0.5, with the text "stitches are wider than tall" for dc [S15]. This appears **inverted or garbled**: taller stitches can't have a smaller height-to-width ratio at constant width. Its general point is valid: a square-pixel chart distorts the finished shape.
- **[R]** Swapping dc for sc means adding roughly 30–50% more rows (web summary, low reliability) [S23]. With an actual row-height ratio of 2.6, the true factor for the same height is 2.6× the rows. **[E]**

---

## 3. Terminology: US vs UK vs Hungarian vs Japanese

### 3.1 US/Canada ↔ UK (CYC) **[C]** [S2]

| US / Canada | UK / AUS / Europe |
|---|---|
| slip stitch (sl st) | slip stitch (ss) |
| **single crochet (sc)** | **double crochet (dc)** ← the classic trap |
| half double crochet (hdc) | half treble (htr) |
| **double crochet (dc)** | **treble (tr)** |
| treble (tr) | double treble (dtr) |
| double treble (dtr) | triple treble (trtr) |
| triple treble (trtr) | quadruple treble (qtr) **[E]** (by the shift rule; not in the CYC table) |
| gauge | tension |
| yarn over (yo) | yarn over hook (yoh) / "yarn round hook" (yrh) [S31] |
| skip | miss **[E]** (common UK usage, not in fetched sources) |

- **[C] The trap.** "dc" and "tr" exist in both systems but mean different stitches. UK names are shifted one step: the UK name counts loops pulled through rather than yarn-overs. A pattern containing "sc", "hdc" or "sl st" is US. One containing "htr" or "ss" is UK. One using only dc/tr is ambiguous. [S2], [S20]
- Wikipedia notes one system is used across Europe, Australia, India and elsewhere, and the other in the US and Canada. [S20]

### 3.2 Hungarian terminology

| US | Hungarian (main) | Abbrev. | Synonyms and regional variants | Sources |
|---|---|---|---|---|
| slip knot | kezdőcsomó / csúszócsomó / kezdő hurok | — | "csúszószem" is also used for the slip knot | [S27], [S32] |
| chain | **láncszem** | lsz (also LSZ) | "légszem" appears once in [S26] ("4 légszemmel") | [S33], [S26], [S27] |
| chain row / foundation | kezdő láncsor, láncszemsor | lsz | "50 lsz" | [S24] |
| slip stitch | **kúszószem** | ksz | **hamispálca (hp)**, **hamis kispálca** | [S27], [S32], [S34], [S35] |
| single crochet | **rövidpálca** | rp | **kispálca** (same stitch: "ugyanazt jelenti") | [S35], [S36] |
| half double | **félpálca** | fp | **also sometimes called hamispálca** | [S24], [S34] |
| double crochet | **egyráhajtásos pálca** | erp | **nagypálca** ("ezek a megnevezések nem állandóak") | [S35], [S27] |
| treble | **kétráhajtásos pálca** | krp | — | [S27], [S33] |
| double treble | háromráhajtásos pálca | (hrp? unverified) | [S37] summary mentions it with 5 turning chains | [S37] |
| yarn over | ráhajtás | rh | — | [S33] |
| turning chain | forduló láncszem / soremelés | flsz | — | [S33], [S24] |
| back loop | hátsó szálba | hsz | — | [S32] |
| front post dc | elölről hurkolt (domború) egyráhajtásos pálca / első relief | **Eerp** | "relief pálca" | [S38] |
| back post dc | hátulról hurkolt egyráhajtásos pálca / hátsó relief | **Herp** | — | [S38], [S37] |
| magic ring | varázskör | — | — | [S24] |
| "waistcoat / knit stitch" (center-post sc) | búzaszem | — | — | [S32] |

**[X] Hungarian contested points**
1. **"Hamispálca" is ambiguous.** Zöld Pamuk: "Általában hamispálca alatt vagy a kúszószemet vagy a félpálcát értjük". The author recommends dropping the "hamis" names. [S34] Sources split:
   - Horgoljmagadnak and Bármitartó: hamispálca = slip stitch [S27], [S32].
   - Hol vetted? Én csináltam: fp (félpálca) is also called hamispálca [S24].
   - Magyarhorgolás uses HP for the slip stitch [S26].
   - **Software should never emit "hamispálca" without disambiguation.** Prefer "kúszószem (ksz)".
2. **Heights.** Hungarian beginner sources state erp = 2× rp and krp = 3× rp. They also give turning chains of 1/2/3/4 (rp/fp/erp/krp), which implies 1:3:4 [S26], [S27]. The chain counts match international practice [S3].
3. **Case and abbreviations.** Upper case (RP, ERP) and lower case (rp, erp) both occur [S26], [S27]. Abbreviations for tr+ and for post stitches are less standardized.
4. **Symbols.** Nokon Design notes that a Hungarian chart symbol has more horizontal lines for more yarn-overs ("minél több ráhajtás, annál több vízszintes vonal") and that square brackets mark repeats ("a szögletes zárójel ismétlést jelöl"). [S33]

### 3.3 Japanese terminology (for JIS-style charts)

| US | Japanese | Standing chain (立ち上がり) | Counts as st? | Sources |
|---|---|---|---|---|
| chain | 鎖編み (kusari-ami) | — | — | [S39], [S40] |
| slip stitch | 引き抜き編み (hikinuki-ami) | — | — | [S39], [S40] |
| sc | 細編み / こま編み (koma-ami) | 1 | **No** | [S21], [S41] |
| hdc | 中長編み (chūnaga-ami) | 2 | **Yes** | [S21], [S41] |
| dc | 長編み (naga-ami) | 3 | **Yes** | [S21], [S41] |
| tr | 長々編み (naganaga-ami) | 4 | Yes | [S41] |
| dtr | 三つ巻き長編み **[E]** | 5 | Yes | general JIS practice; unverified |

- **[C]** JIS L 0201:1995 is the Japanese Industrial Standard for knitting and crochet stitch symbols. It covers only a basic subset, and hobby publications use more symbols than the standard defines. [S42]

---

## 4. Stitch variants and compound stitches: structure and consume/produce model

### 4.1 Definitions for the counting model **[E]**
- **consumes (c):** the number of distinct stitch positions of the previous row this element uses up. That means stitches it is worked into, plus stitches deliberately skipped as part of the element's definition. A chain space counts as one position when worked "in sp".
- **produces (p):** the number of new countable positions the element leaves for the next row. By convention patterns count stitches, not chains, unless a chain counts as a stitch. For tops that are hard to work into, a separate `workable` flag is recommended.
- Row stitch count after row = Σ p. The row is valid when Σ c = stitch count of the previous row (or the number of positions actually available).

### 4.2 Per-stitch data table (basic and extended stitches)

| US name | UK name | Hungarian | Abbrev (CYC) | YOs | Height (ch-eq) | Typical tch | Tch counts? | Consumes | Produces | Symbol (CYC/JIS) | Sources |
|---|---|---|---|---|---|---|---|---|---|---|---|
| chain | chain | láncszem | ch | 0 (1 yo pulled through 1 loop) | 1 (unit) | — | in foundation: each ch is a base position | 0 | 1 ch (or part of 1 ch-sp) | open oval | [S1], [S16], [S20] |
| slip stitch | slip stitch (ss) | kúszószem / hamispálca* | sl st | 0 | ~0 (1–2 mm) | 0 | — | 1 | 1 (rarely worked into; often not counted when used for joins or travel) **[X]** | small **filled dot** (some keys use an open or small oval) **[X]** | [S1], [S11], [S28] |
| single crochet | double crochet (dc) | rövidpálca / kispálca | sc | 0 | 1 | ch 1 | **No** | 1 | 1 | **+** or **×** (both common) | [S1], [S4], [S28], [S43] |
| extended sc | extended dc | — | esc (exsc) | 0 (+1 ch step) | ~1.5–2 (≈ hdc) **[R]** | ch 1–2 **[E]** | pattern-dependent | 1 | 1 | usually sc/hdc symbol with a mark; pattern key **[E]** | [S2], [S44] |
| half double | half treble (htr) | félpálca | hdc | 1 | 2 | ch 2 | **[X]** US often no / JP yes | 1 | 1 | **T** (a stem with a bar on top) | [S1], [S16], [S12], [S21] |
| double crochet | treble (tr) | egyráhajtásos pálca | dc | 1 | 3 | ch 3 (alt. ch 2 not counted) | **Usually yes** **[X]** | 1 | 1 | **T with 1 diagonal hatch** across the stem | [S16], [S4], [S12] |
| treble | double treble (dtr) | kétráhajtásos pálca | tr | 2 | 4 | ch 4 | Usually yes | 1 | 1 | T with **2** hatches | [S16], [S3] |
| double treble | triple treble (trtr) | háromráhajtásos pálca | dtr | 3 | 5 | ch 5 | Usually yes | 1 | 1 | T with **3** hatches | [S3], [S2] |
| triple treble | quadruple treble **[E]** | négyráhajtásos pálca **[E]** | trtr | 4 | 6 | ch 6 | Usually yes | 1 | 1 | T with **4** hatches **[E]** | [S2], [S13] |

\* See §3.2 on the ambiguity of "hamispálca".

### 4.3 Stitch variants (placement variants of a base stitch)

| Variant | Abbrev | Structure / behaviour | Height | Consumes → Produces | Symbol | Sources |
|---|---|---|---|---|---|---|
| Foundation sc / hdc / dc | fsc, fhdc, fdc | Each stitch makes its own base chain and a stitch together. The work grows sideways, stacked vertically. Stretchier than chain + row 1. | same as base stitch | **0 → 1** (plus it creates 1 base ch). Replaces "ch N + row 1 of N stitches". | base symbol drawn with a ch oval at its foot **[E]** | [S45], [S46] |
| Front loop only | FLO / FL | Hook under the front loop only. The back loop is left as a horizontal line on the back. | ≈ base | 1 → 1 | small arc at the base (Yarnspirations: stitch "sits inside a u" for FL); JIS keys often use a straight bar | [S2], [S16], [S47] |
| Back loop only | BLO / BL / tbl | Hook under the back loop only. The front loop is left as a ridge on the front; produces ribbing. | ≈ base | 1 → 1 | inverted-u arc at the base (stitch sits "on top of the hump of an inverted u"); JIS: horizontal line under the symbol | [S16], [S28], [S47] |
| Third loop (hdc) | 3rd lp / "camel st" | Hook under the yarn-over bar behind the V. The V pops forward. | ≈ hdc | 1 → 1 | hdc T with a mark per key **[E]** | [S9], [S7] |
| Front post | FPsc/FPhdc/FPdc/FPtr | Hook goes front→back→front around the post of the stitch below. The stitch is raised toward you. That stitch's top loops stay unworked. | ≈ base, often a little shorter **[R]** | 1 → 1; rib patterns keep the count (e.g. 10 sts stay 10) | base symbol with a **hook curving around the stem at its foot**, opening toward the front | [S2], [S16], [S25], [S48] |
| Back post | BPsc…BPtr | Hook goes back→front→back. The stitch recedes. After turning, a BP stitch shows as FP. | ≈ base | 1 → 1 | mirrored hook at the foot | [S25], [S48] |
| Spike / long sc | sp sc, "long sc" | sc worked 1–4+ rows below. The loop is pulled up to current row height and wraps over the stitches below. | spans N+1 rows visually; occupies 1 row | 1 → 1 (count unchanged) | sc symbol with an elongated stem reaching down N rows **[E]** | [S49], [S50] |
| Extended (any) | esc, ehdc, edc, etr | After pulling up the loop: yo, pull through 1 (an extra chain), then finish as normal. | ≈ +0.5–1 ch **[R]** | 1 → 1 | per key | [S2], [S44] |
| Linked dc (ltr, etc.) | ldc | The first "yo" is replaced by pulling a loop through the horizontal bar of the previous stitch. No gaps; denser fabric, close to sc density with dc drape. | = dc | 1 → 1 | dc symbol joined to its neighbour mid-stem **[E]** | [S51] |
| Crossed dc | X-dc | Skip 1, dc in the next, dc in the skipped stitch, working around the first dc. Needs an even count; rows start and end with a plain dc. | = dc | **2 → 2** | two dc symbols crossing | [S52] |
| Crab stitch / reverse sc | rev sc | sc worked left→right (for right-handers). Rope-like edge that is hard to work into, so it is an **edging only**. | ≈ sc | 1 → 1 (**not workable**) | sc symbol with a tilde above it (JIS) | [S53], [S54], [S43] |

### 4.4 Compound stitches (increases, decreases, texture, lace)

| Compound | Construction | Consumes → Produces | Net | Height | Chart depiction | Sources |
|---|---|---|---|---|---|---|
| **n sts in same st (increase)** | e.g. "2 sc in next st" | 1 → n | +(n−1) | base | stems **start at the same point** at the bottom | [S3], [S55] |
| **sc2tog** | Pull up a loop in each of 2 sts (3 loops on hook), yo, pull through all | 2 → 1 | −1 | sc | stems start at different stitches and **converge at the top** | [S2], [S55] |
| **sc3tog** | same over 3 sts | 3 → 1 | −2 | sc | 3 converging stems | [S1], [S2] |
| **Invisible decrease (invdec)** | Insert into the **front loop** of st 1 and st 2 (3 loops on hook), yo through 2, yo through 2. Unworked back loops are hidden inside amigurumi. | 2 → 1 | −1 | sc | sc2tog symbol + FLO marks **[E]** | [S56], [S57] |
| **dc2tog / dc3tog / tr2tog** | Work each dc up to the last step (2 loops left per stitch), across N different sts, then yo through all | N → 1 | −(N−1) | dc (tr) | N hatched stems converging at the top | [S1], [S2], [S58] |
| **Cluster (CL)** | Partial stitches closed together into one top. The term is used both for "over N sts" (= dcNtog) **and** for "N in one st". **[X]** | over N sts: N → 1. In 1 st: **1 → 1** (count does not decrease) | −(N−1) or 0 | base | CYC lists "3-dc cluster" separately from dc3tog; always check the key | [S58], [S59], [S1] |
| **Bobble (bo)** | 3–5 partial dc **in one st**, closed (5-dc bobble: 6 loops on hook). Usually worked on WS rows, surrounded by sc. | 1 → 1 | 0 | ≈ dc | converging stems from a single base (per key) | [S60], [S1] |
| **Puff (ps / puff)** | Repeated (yo, insert in same st, pull up loop). 5 insertions give **11 loops**, 3 give 7, then yo through all. Loops = 2k+1. | 1 → 1 | 0 | ≈ hdc | elongated oval(s) on a common base (CYC "3-hdc cluster/puff st/bobble" share one entry) | [S60], [S1] |
| **Popcorn (pc)** | 5 **complete** dc in one st. Drop the loop, insert into the first dc, pull the loop through. Can pop to the front or the back. | 1 → 1 | 0 | ≥ dc (tallest of the three) | dc stems topped with an **oval** ("5-dc popcorn") | [S60], [S1] |
| **Shell (sh)** | n dc (or tr) in the same st or sp, e.g. 5-dc shell or "(3 dc, ch 2, 3 dc)". Usually flanked by skipped sts, e.g. "sk 2, 5 dc in next, sk 2, sc in next". | 1 → n (with flanking skips: 1+2k → n) | varies | dc | stems **fanning out from one base point** | [S16], [S61], [S62] |
| **Fan** | A large shell, often with chains between the dc | as shell | varies | dc/tr | as shell **[E]** | [S62] |
| **V-stitch (V-st)** | (dc, ch 1, dc) in the same st | 1 → 2 dc + 1 ch-sp | +1 st (+sp) | dc | two dc stems in a V from one base, with a ch oval between | [S61] |
| **Picot (p)** | "ch 3, sl st (or sc) in 3rd ch from hook" | 0 → 0 **[X]** (decorative bump). Some patterns list picots as elements of the count. | 0 | ~1–2 ch loop | small closed ring of ch ovals ("ch-3 picot") | [S63], [S1] |
| **Chain space (ch-sp)** | "ch k, sk m" | m → 1 space made of k chains | depends | ~1 row | chain ovals arching over the skipped positions | [S2], [S64] |
| **Chain loop / ch-lp** | a longer chain arch (e.g. ch 5) | as ch-sp | — | — | arch of ovals | [S2] |
| **Solomon's / love knot** | An elongated chain locked with a sc through its back strand. Loop height ½" to >2". Worked in pairs that form diamonds; the next row sc's into the knot points. | Doesn't fit the grid model: **0 → 1 knot point** per knot, anchored every 2 knots **[E]** | — | freely set | elongated oval + sc mark **[E]** | [S65], [S66] |
| **Filet open mesh** | "dc, ch 2, sk 2, dc" (grid square = dc + 2 ch) | 3 → 3 positions (1 dc + 2 ch) | 0 | dc | empty grid square | [S67], [S68] |
| **Filet block** | 3 dc: "2 dc in sp + 1 dc" or dc in each st | 3 → 3 | 0 | dc | filled grid square | [S67] |

**Filet rules [C]** [S67], [S68]
- Row width in stitches = 3 × squares + 1.
- Adjacent blocks share edge stitches: 2 blocks = 7 dc.
- Open-first row: start with ch 5 (= dc + ch 2). Solid-first row: start with ch 3.
- Foundation for an open-first row = 3 × blocks + 5.

### 4.5 Tunisian crochet (brief; separate model)
- **[C]** Each row has a **forward pass** that picks loops up onto the hook, right→left for right-handers, and a **return pass** that works them off left→right. Forward + return = one row. **The work is never turned**; the RS always faces you. A long hook is used. [S69], [S70]
- **[C]** Return pass: yo, pull through 1 loop, then repeat (yo, pull through 2) to the end. [S70]
- **[C]** Tunisian simple stitch (tss): insert under the next front vertical bar, pull up a loop. The first edge bar is skipped. The last stitch goes under both strands of the edge loop. Each stitch shows 2 vertical and 3 horizontal bars. [S69], [S70]
- **[E]** Counting model: forward pass consumes 1 vertical bar and adds 1 loop to the hook, and the return pass closes them. Stitch count per row = loops picked up. Heights don't use the ch-equivalent scale; tss is roughly square-ish, and Tunisian fabric is known for biasing/curl. **Software should treat Tunisian as a separate mode.**
- CYC Tunisian abbreviations: tss, tks, tps, tfs, trs, tslst, tsc, thdc, tdc, ttr, etss, ttw, FwP, RetP. [S2]

---

## 5. Increases and decreases: count arithmetic

| Operation | Pattern text | Consumes | Produces | Δ count | Sources |
|---|---|---|---|---|---|
| Increase (2 in same) | "2 sc in next st" / "inc" | 1 | 2 | +1 | [S3], [S2] |
| Increase (3 in same) | "3 sc in next st" | 1 | 3 | +2 | [S3] |
| Generic increase | n sts in same st | 1 | n | +(n−1) | [S3] |
| Chain increase | "ch 1" between stitches (worked into on the next row) | 0 | 1 (if the next row works into it) | +1 | **[E]** |
| Standard decrease | sc2tog / hdc2tog / dc2tog / tr2tog | 2 | 1 | −1 | [S2], [S3] |
| 3-together | sc3tog / dc3tog | 3 | 1 | −2 | [S1], [S3] |
| Invisible decrease | invdec (FL of 2 sts) | 2 | 1 | −1 | [S56] |
| Skip decrease | "sk next st" | 1 | 0 | −1 | [S2] (sk); [S57] notes it leaves a gap |
| Cluster in one st | "3-dc Cl in next st" | 1 | 1 | 0 | [S58] |

Wikipedia definitions **[C]** [S3]:
- Increase: "two or more stitches worked into the same spot (stitch); adding to the total amount of stitches".
- Decrease: "one stitch worked across two or more spots (stitches); subtracting from the total amount of stitches".
- Abbreviations: inc, dec, st2tog, st3tog.

---

## 6. Chart symbols

### 6.1 CYC standard symbol set **[C]** [S1], [S16]
CYC's key sentence: "each symbol represents a stitch as it looks on the right side of the work." Patterns must always include a key [S1]. The CYC set covers:
- ch, sl st, sc, hdc, dc, tr, dtr
- sc2tog, sc3tog, dc2tog, dc3tog
- 3-dc cluster, 3-hdc cluster/puff st/bobble, 5-dc popcorn, 5-dc shell, ch-3 picot
- FPdc, BPdc
- worked in back loop only, worked in front loop only

Two notes on this set:
- CYC notes that sc symbols "vary in common use" (+ vs ×). [S1]
- The original CYC PDF [S71] couldn't be machine-read. The shape descriptions below come from Yarnspirations [S16], Ronique (JIS) [S28], Dancing Barefoot [S43] and Nokon Design [S33].

| Stitch | Shape | Encoding logic |
|---|---|---|
| ch | open **oval** ("looks a lot like a chain stitch") | unit |
| sl st | small **dot** (usually filled) **[X]** some keys draw a small oval or open circle | ~0 height |
| sc | **+** or **×** | short, no stem |
| hdc | **T** (stem + top bar) | stem = height |
| dc | T + **1** diagonal hatch across the stem | hatches = yarn-overs |
| tr | T + **2** hatches | |
| dtr | T + **3** hatches | |
| decrease / tog | several stems starting at **different** base stitches and **meeting at one top point** | many→1 |
| increase / shell | several stems starting from **the same base point** and fanning out | 1→many |
| popcorn | stems closed with an oval at the top | |
| puff | elongated loop/oval shapes | |
| post stitch | a **hook** drawn at the foot of the stem, wrapping the post; direction shows FP vs BP | |
| FLO / BLO | small arc at the base: stitch sits **inside a "u"** = FLO; **on top of an inverted u** = BLO | JIS: straight line |
| crab st | sc symbol with a **tilde** above | [S43] |
| ch-sp / loops | chain ovals following their arch | |

- **[C]** "The number of horizontal lines crossing a symbol indicates yarn overs": dc = 1 hatch, tr = 2. [S16] The same principle in Hungarian: "minél több ráhajtás, annál több vízszintes vonal". [S33]
- **[C]** "Multiple vertical lines that come together at a point on top are crochet-together stitches, whereas multiple vertical lines that come out of the same point at the bottom are shell stitches." [S16]
- **[C]** Same-stitch increases are "a group of stitches where the stem of each symbol starts at the same stitch". Decreases have stems that "start at different stitches, but they all lead to the same point". "A stitch directly above another stitch means that's where you work it." [S47]
- **[C]** Symbols are international: a chart can be followed regardless of the pattern's language. [S47], [S20], [S72]
- **[E] Orientation.** Symbol stems point from the insertion point (base) toward the top of the new stitch.
  - In rows, stems are vertical.
  - In rounds, stems point radially away from the center, with bases on the previous round.
  - A stitch worked into a chain **space** (not a specific chain) is conventionally drawn with its base under the chain arch rather than touching one oval. This is JIS/general practice; I couldn't find an explicit citation.
- **[C]** Stitch charts use idealized, square-ish cells. Real stitches differ in shape, so the finished item doesn't look exactly like the chart. [S47]

### 6.2 Japanese (JIS) charts
- **[C]** JIS-style charts show the fabric as seen from the RS: "what you see on the page is what the finished work looks like". [S73]
- Read from the bottom up and right to left for RS rows. Odd rows go R→L, even rows L→R. [S73]
- JIS charts use "one symbol = one stitch". Rounds go counterclockwise from the center. The magic ring is marked わ. Repeats are bracketed with notes such as "１１目１模様" (11 sts = 1 repeat). [S43]
- sc appears as × or +, and BLO as a straight line above or below the symbol. [S43], [S28]
- Ronique: supplementary text always accompanies symbols that can't convey the method on their own. Charts also include attach-yarn and cut-yarn symbols. [S28]

### 6.3 Reading direction
- **Rows (right-handed) [C]** [S74], [S47]:
  - Row 1 / RS rows: read **right → left**. The row number sits on the right edge.
  - WS rows: read **left → right**. The row number sits on the left edge.
  - Rows are worked bottom to top, and the turning chain is drawn at the start of each row.
- **Rounds (right-handed) [C]** [S16], [S47], [S74], [S43]: start at the center and read **counterclockwise**, without turning unless instructed.
- **Left-handed [C with caveat]:**
  - Rows are worked left → right, and rounds **clockwise**. [S47], [S75]
  - Dummies says lefties reverse the direction but "rounds still follow counterclockwise reading while being worked clockwise", meaning the chart reading and the physical work direction differ. [S74]
  - **[X]** Annie's Attic describes righties as working "to the left (clockwise)" and lefties "to the right (counterclockwise)". This is the reverse of every other source, probably because it is described from a different viewpoint (e.g. from the back). Treat as a wording inconsistency. [S76]
- **Left-handed practicalities [C]:**
  - Symbol charts are drawn for right-handers. Lefties make the same stitches as a mirror image. [S75]
  - Directional or asymmetric designs, colorwork, tapestry and **filet with text** must be mirrored first, otherwise the image comes out reversed. [S75], [S76]
  - Flat pieces worked in rows look the same for both hands. Pieces worked in rounds look different. [S76]
  - Written directions such as "join in upper right corner" must be swapped. [S76]

---

## 7. Abbreviations and written-instruction syntax

### 7.1 CYC master list (US terms) **[C]** [S2]

| Group | Abbreviations |
|---|---|
| General | alt, approx, beg, bet, CC, MC, cont, foll, m, pm, sm/sl m, pat/patt, prev, rem, rep, rnd, RS, WS, st, sts, tog, sk, sp, lp, dec, inc |
| Basic stitches | ch, sl st, sc, hdc, dc, tr, dtr, trtr, yo, yoh |
| Chain references | "ch-" = refers to a chain or space previously made (e.g. ch-3 sp); ch-sp = chain space; tch / t-ch = turning chain |
| Loops | BL/BLO, FL/FLO, tbl (through back loop) |
| Post | BP, FP, BPsc, BPhdc, BPdc, BPtr, BPdtr, FPsc, FPhdc, FPdc, FPtr, FPdtr |
| Decreases | sc2tog, hdc2tog, dc2tog, tr2tog |
| Extended | esc, ehdc, edc, etr |
| Compound | bo (bobble), CL (cluster), pc (popcorn), ps/puff, sh (shell) |
| Tunisian | tss, tks, tps, tfs, trs, tslst, tsc, thdc, tdc, ttr, etss, ttw, FwP, RetP |
| Units | " / in, cm, g, m, mm, oz, yd |

- **[C] Hyphen convention.** "ch 3" (space, no hyphen) is an **action**: make 3 chains. "ch-3" (hyphenated) is a **reference** to an existing ch-3 or ch-3 space. This follows the CYC "ch-" definition [S2].

### 7.2 Syntax **[C]** [S2], [S4]

| Token | Meaning |
|---|---|
| `*` | "repeat instructions following the asterisk as directed", e.g. "rep from * across" / "to last st". |
| `* … *` or `** … **` | Repeat what is between the asterisks as directed. `**` is used for complex repeats where the last repetition ends differently. |
| `[ ]` and `{ }` | "work instructions within brackets as many times as directed", e.g. "[sk next dc, shell in next dc] 4 times". |
| `( )` | "work instructions within parentheses **as many times as directed** or **all in same stitch/space**", e.g. "(2 dc, ch 3, 2 dc) in next st". Also used for end-of-row stitch counts, e.g. "(14 sc)". |
| stitch count at row end | "14 sc" or "(14 sc)". [S4] |
| `sk` | skip (UK: miss) |
| `sp` / `ch-sp` | space / chain space |
| `tog` | together (decrease/cluster) |
| `in same st` / `in next st` | insertion target |
| `turn` | turn the work (rows) |
| `join with sl st to top of beg ch` | close a round **[E]** (common phrasing) |

- **[C]** A pattern may define special abbreviations or stitches (e.g. "Shell (Sh): (3 dc, ch 2, 3 dc) in indicated st or sp") at the beginning. Always check the pattern notes. [S2], [S62]
- **[C]** Whether turning chains and chain spaces count as stitches must be stated per pattern. There is no universal rule. [S12], [S64], [S10]
- Hungarian syntax: square brackets mark repeats ("a szögletes zárójel ismétlést jelöl"). [S33]

---

## 8. Encodable rules

Crisp rules a pattern designer program can enforce or suggest. Each is tagged with its evidence level; **[X]** rules should be user-configurable.

### 8.1 Stitch model
1. **[C]** Every stitch type has `yarnOvers` and `chainHeight`, stored as an explicit table:
   - sl st 0
   - sc 1
   - hdc 2
   - dc 3
   - tr 4
   - dtr 5
   - trtr 6
   - Note: hdc and dc both have 1 yo and differ in how the loops are finished. Don't derive height from yo count alone. From dc upward, chainHeight = yarnOvers + 2. [S3], [S13]
2. **[C]** Chart hatch count = yarn-overs: dc 1, tr 2, dtr 3, trtr 4. hdc = plain T; sc = + or × (user-selectable); ch = oval; sl st = dot. [S16], [S33]
3. **[E]** Physical height = `chainHeight × k_ch`. Default `k_ch` ≈ 6–7 mm for worsted on a 5 mm hook [S11], calibrated per user from gauge.
   - Optional correction factors (measured ÷ chain model): sc ×1.0, hdc ×0.85, dc ×0.9, tr ×1.0, sl st ≈ 0.2 of sc.
4. **[R]** Width per stitch is independent of stitch type [S29]. Default width = 101.6 mm ÷ (CYC sc count per 4 in for the yarn weight) [S30].
5. **[E]** Aspect-ratio warning for charts: render cells at a real h/w ratio (sc ≈ 0.85, hdc ≈ 1.3, dc ≈ 2.2 in worsted). Warn when a square-pixel design will distort. [S15], [S11], [S30]

### 8.2 Counting (consume/produce)
6. **[E]** Each element declares `consumes` (positions of the previous row) and `produces` (countable positions for the next row). A row is valid iff Σconsumes = available positions of the previous row. The new row count = Σproduces.
7. **[C]** Consume/produce defaults:
   - n-in-same-st: 1 → n
   - Xntog / decrease cluster: n → 1
   - bobble / puff / popcorn / in-one-st cluster: 1 → 1
   - shell of n: 1 → n
   - V-st: 1 → 2 st + 1 sp
   - FLO / BLO / FP / BP / spike / extended / linked / 3rd-loop: 1 → 1
   - crossed pair: 2 → 2
   - sk: 1 → 0
   - "ch k, sk m": m → 1 space (k ch)
   - invdec: 2 → 1
   - fsc / fhdc / fdc: 0 → 1 (and creates a base chain)
   - Sources: [S3], [S56], [S58], [S60], [S61], [S52], [S50], [S45]
8. **[X]** The term "cluster" is ambiguous (in one st vs over n sts). Require an explicit `base: same | spread(n)` field; never infer it from the name. [S58], [S59]
9. **[X]** Picots default to 0 → 0 (decorative) but can be toggled to count as elements. [S63]
10. **[C]** Crab stitch (rev sc) produces non-workable tops. Mark it as terminal/edging and warn if a later row tries to work into it. [S53], [S54]
11. **[C]** Chain spaces are one insertion target when a stitch is worked "in sp". Any number of stitches may go into one space. Working into individual chains of the arch must be explicit. [S2], [S64]

### 8.3 Turning chains and foundations
12. **[C]** Default turning chain = the chain height of the **first stitch of the next row**: sc 1, hdc 2, dc 3, tr 4, dtr 5, trtr 6. [S3], [S10]
13. **[X]** "Turning chain counts as stitch" is a per-pattern setting.
    - Defaults: sc = false, hdc = false (US) / true (JP), dc+ = true. [S4], [S12], [S21]
    - Offer the "ch 2 not counted for dc" variant. [S12], [S22]
14. **[C]** If the tch counts, the first stitch of the row goes into the **second** stitch (the first is skipped) and the last stitch goes into the top of the previous tch. If not counted, the first stitch goes into the first stitch. [S12], [S4]
15. **[C]** Foundation chain for N stitches in row 1:
    - sc: N + 1, first st in the 2nd ch from hook
    - hdc (not counted): N + 2, 3rd ch
    - dc (not counted): N + 3, 4th ch; dc (counted): N + 2, 4th ch
    - General: N + tch if not counted, N + tch − 1 if counted; first st into the (tch + 1)th ch from hook
    - Sources: [S5], [S15]
16. **[C]** Foundation stitches (fsc/fhdc/fdc) replace "ch N + row 1" 1:1 and need no turning-chain allowance. [S45], [S46]
17. **[C]** Filet: width = 3 × squares + 1 stitches.
    - Adjacent blocks share edges.
    - Open square = dc + ch 2; block = 3 dc.
    - Start an open-first row with ch 5, a solid-first row with ch 3.
    - Foundation (open-first) = 3 × squares + 5.
    - Sources: [S67], [S68]

### 8.4 Chart geometry and reading
18. **[C]** In an increase the stems share one base point. In a decrease/tog the stems share one top point. A symbol placed directly above another is worked into it. [S16], [S47]
19. **[C]** Rows: RS (odd) rows are read right→left with the number on the right; WS rows left→right with the number on the left. Rows are drawn bottom→top. [S74], [S73]
20. **[C]** Rounds start at the center and run counterclockwise for right-handers without turning (unless specified). A left-handed view mirrors to clockwise. [S47], [S16], [S75]
21. **[C]** Charts depict the RS. When worked flat, a BP stitch on a WS row appears as FP on the RS, so the program should convert FP/BP when translating chart to written text on WS rows. [S1], [S25]
22. **[C]** Mirror-mode option for left-handers. Warn that asymmetric, text, filet or colorwork charts must be mirrored. [S75], [S76]
23. **[E]** Post-stitch symbol = base symbol + hook at the foot (FP/BP orientation). FLO/BLO = arc (CYC) or bar (JIS) at the foot. Rev sc = sc + tilde. [S16], [S43], [S28]

### 8.5 Terminology and text
24. **[C]** Maintain a terminology map per stitch: US ↔ UK (shift by one: US sc = UK dc, US dc = UK tr, …) ↔ HU ↔ JP.
    - When exporting UK, never emit "sc", "hdc" or "sl st".
    - When importing, detect the dialect: "sc"/"hdc" → US; "htr"/"ss" → UK; dc/tr only → ambiguous, ask the user.
    - Sources: [S2]
25. **[X]** Hungarian export: use kúszószem (ksz) for sl st and félpálca (fp) for hdc. Avoid "hamispálca" (ambiguous). rövidpálca (rp) ≡ kispálca. [S34], [S35]
26. **[C]** Written syntax generator:
    - `*…; rep from * N times/across` for repeats
    - `[…] N times` for grouped repeats
    - `(…) in same st/sp` for multiple stitches in one base
    - `(N sts)` stitch count at row end
    - `ch-N sp` (hyphenated) for references; `ch N` for actions
    - Sources: [S2], [S4]
27. **[C]** Every pattern needs a symbol and abbreviation key listing any non-CYC stitches. [S1], [S2]
28. **[C]** Tunisian is a separate mode: no turning, forward + return pass = 1 row, return starts with "yo, through 1". [S69], [S70]


---

## Sources

1. [S1]: https://www.craftyarncouncil.com/standards/crochet-chart-symbols — CYC Crochet Chart Symbols
2. [S2]: https://www.craftyarncouncil.com/standards/crochet-abbreviations — CYC Crochet Abbreviations Master List (incl. US/UK table, Tunisian, symbols * [ ] ( ))
3. [S3]: https://en.wikipedia.org/wiki/List_of_crochet_stitches — Wikipedia, List of crochet stitches
4. [S4]: https://www.craftyarncouncil.com/standards/how-to-read-crochet-pattern — CYC How to Read a Crochet Pattern
5. [S5]: https://www.edieeckman.com/2020/05/08/how-many-foundation-chains-do-i-need/ — Edie Eckman, foundation chains
6. [S7]: https://doradoes.co.uk/2020/11/21/the-anatomy-of-a-crochet-stitch/ — Dora Does, anatomy of a crochet stitch
7. [S8]: https://marlybird.com/blog/crochet-stitch-anatomy/ — Marly Bird, stitch anatomy (via search summary)
8. [S9]: https://raffamusadesigns.com/crochet-hdc-third-loop/ — Raffamusa Designs, hdc third loop (via search summary)
9. [S10]: https://www.bygoldenberry.com/blog/crochet-turning-chain — byGoldenberry turning chain chart
10. [S11]: https://www.joannascrochet.com/2025/11/crochet-stitch-height-guide-comparison.html — Joanna's Crochet, stitch height guide (mm data)
11. [S12]: https://www.sigonimacaroni.com/does-the-turning-chain-count-as-a-stitch/ — Sigoni Macaroni, does the turning chain count
12. [S13]: https://www.designingvashti.com/crochet-stitch-equivalents-issue-2/ — Designing Vashti, stitch equivalents
13. [S14]: https://crochetpatterncompanion.blogspot.com/2011/03/how-to-take-control-of-double-crochet.html — Vashti's Crochet Pattern Companion, dc height
14. [S15]: https://www.stitchsums.com/articles/crochet-pattern-math — Stitchsums, crochet pattern maths
15. [S16]: https://www.yarnspirations.com/en-row/blogs/how-to/how-to-read-crochet-chart-symbols — Yarnspirations, reading chart symbols
16. [S20]: https://en.wikipedia.org/wiki/Crochet — Wikipedia, Crochet
17. [S21]: https://ronique.jp/en/free_recipes-how_to_crochet/beg_ch/ — Ronique (JP), standing chains compared
18. [S22]: https://www.kheyo.com/understanding-double-crochet-is-double-crochet-chain-2-or-3/ — ch 2 vs ch 3 for dc (via search summary)
19. [S23]: https://www.crochet365knittoo.com/crochet-stitch-heights/ — Crochet 365 Knit Too, stitch heights (search summary; exact attribution of the sc ¼" / dc ½" numbers and the 1-ch-fewer variant among [S23] and https://secretyarnery.com/blogs/blog/resize-crochet-projects-with-gauge-math-2026-guide is uncertain — low reliability)
20. [S24]: https://holvettedencsinaltam.hu/horgolas-alapjai-kisokos/ — Hol vetted? Én csináltam, horgolás alapjai kisokos (HU)
21. [S25]: https://www.edieeckman.com/2018/11/13/front-post-back-post-double-crochet/ — Edie Eckman, FPdc/BPdc
22. [S26]: https://magyarhorgolas.blogspot.com/p/horgolas-alapjai-kezdoknek.html — Horgolásról csak magyarul (HU)
23. [S27]: https://horgoljmagadnak.hu/horgolas-alapok-alap-palcak-a-horgolasban/ — Horgoljmagadnak, alap pálcák (HU)
24. [S28]: https://www.ronique.net/en/blogs/guide_to_japanese_crochet_charts/guide_002 — Ronique, essential Japanese symbols
25. [S29]: https://harrisville.com/blogs/crocheting/single-and-double-crochet — Harrisville Designs, single and double crochet
26. [S30]: https://www.craftyarncouncil.com/standards/yarn-weight-system — CYC Standard Yarn Weight System
27. [S31]: https://simply-yarn.com/guides/how-to-crochet/how-to-do-tunisian-crochet — Simply Yarn (formerly Gathered), Tunisian crochet ("yrh" usage)
28. [S32]: https://www.barmitarto.hu/palca-tipusok-horgolasa-kezdoknek — Bármitartó, pálca típusok (HU)
29. [S33]: https://nokondesign.hu/horgolas-jelek-utmutato/ — Nokon Design, horgolás jelek (HU)
30. [S34]: http://zoldpamuk.blogspot.com/2014/08/zavar-hamispalca-korul.html — Zöld Pamuk, "Zavar a hamispálca körül" (HU)
31. [S35]: https://cirmi-hobbija.blogspot.com/2011/10/palcatitkok.html — Cirmi hobbija, Pálcatitkok (HU)
32. [S36]: https://horgoljmagadnak.hu/rovidpalca-horgolas-alapjai-kezdoknek/ — Horgoljmagadnak, rövidpálca (HU; via search summary)
33. [S37]: https://www.fonallak.hu/horgolas-alapjai-6-resz-egyrahajtasos-palca-97 — Fonallak (HU; via search summary on relief/háromráhajtásos — low reliability)
34. [S38]: https://kreativeshobby.hu/index.php/2016/04/28/az-elso-relief-horgolasa/ — Kreatív+Hobby, első relief (HU)
35. [S39]: https://crocheandme.blogspot.com/2019/05/6-basic-crochet-stithes.html — Crochet and Me (JP), basic stitches
36. [S40]: https://ronique.jp/en/free_recipes-how_to_crochet/symbol_slip_stitch/ — Ronique (JP), slip stitch symbol
37. [S41]: https://yumekomade.com/basics/basics1/ — YUMEKOmade (JP), counting standing chains (via search summary)
38. [S42]: https://www.southerngoose.com/post/jis-l-0201-1995-letter-symbols-for-knitting-stitch — Southern Goose, JIS L 0201:1995
39. [S43]: https://dancingbarefoot.wordpress.com/2010/02/01/tutorial-lesson-3a-crochet/ — Dancing Barefoot, Japanese crochet chart lesson
40. [S44]: https://www.mooglyblog.com/extended-single-crochet-esc-or-exsc/ — Moogly, extended sc (via search summary)
41. [S45]: https://www.mooglyblog.com/foundation-single-crochet-fsc/ — Moogly, foundation single crochet
42. [S46]: https://theunraveledmitten.com/2018/11/09/foundation-crochet-stitches/ — The Unraveled Mitten, foundation stitches (via search summary)
43. [S47]: https://simply-yarn.com/guides/how-to-crochet/how-to-read-crochet-charts — Simply Yarn (formerly Gathered), how to read crochet charts
44. [S48]: https://joyofmotioncrochet.com/double-crochet-front-and-back-post-ribbing/ — Joy of Motion, FP/BP ribbing (count maintained; via search summary)
45. [S49]: https://www.dummies.com/crafts/crocheting/stitches/how-to-crochet-spikes/ — Dummies, spikes (via search summary)
46. [S50]: https://www.acrochetedsimplicity.com/how-to-crochet-spike-stitch-step-by-step-tutorial/ — A Crocheted Simplicity, spike stitch
47. [S51]: https://joyofmotioncrochet.com/linked-double-crochet/ — Joy of Motion, linked dc (via search summary)
48. [S52]: https://hearthookhome.com/crossed-double-crochet-stitch-tutorial/ — Heart Hook Home, crossed dc (via search summary)
49. [S53]: https://www.mooglyblog.com/reverse-single-crochet-crab-stitch/ — Moogly, reverse sc
50. [S54]: https://hearthookhome.com/the-crab-stitch-crochet-stitch-video-tutorial/ — Heart Hook Home, crab stitch (via search summary)
51. [S55]: https://clubcrochet.com/lessons/chapter-5/ — Club Crochet, decreasing (via search summary)
52. [S56]: https://www.planetjune.com/blog/amigurumi-help/invisible-decrease/ — PlanetJune, invisible decrease
53. [S57]: https://craftinghappiness.com/the-regular-vs-invisible-decrease-in-amigurumi/ — Crafting Happiness, regular vs invisible decrease (via search summary)
54. [S58]: https://www.yarnspirations.com/blogs/how-to/how-to-crochet-clusters — Yarnspirations, clusters
55. [S59]: https://daisyfarmcrafts.com/dc2tog-cluster-stitch/ — Daisy Farm Crafts, dc2tog cluster (via search summary)
56. [S60]: https://sarahmaker.com/puff-bobble-popcorn/ — Sarah Maker, puff vs bobble vs popcorn
57. [S61]: https://www.dummies.com/article/home-auto-hobbies/crafts/knitting-crocheting/how-to-crochet-the-v-stitch-and-shell-stitch-197618/ — Dummies, V-stitch and shell
58. [S62]: https://en.wikipedia.org/wiki/Shell_stitch — Wikipedia, Shell stitch (via search summary)
59. [S63]: https://www.kristinomdahl.com/chain-3-picot-tutorial-single-crochet-vs-slip-stitch-demo-plus-charts-plus-free-pattern/ — Kristin Omdahl, ch-3 picot
60. [S64]: https://www.crochetspot.com/what-is-a-chain-space-ch-sp/ — Crochet Spot, chain space (via search summary)
61. [S65]: https://www.mooglyblog.com/love-knot-solomons-knot-crochet/ — Moogly / Linda Dean, love knot (via search summary)
62. [S66]: https://hearthookhome.com/solomons-knot-crochet-stitch-tutorial/ — Heart Hook Home, Solomon's knot (via search summary)
63. [S67]: https://blog.treasurie.com/filet-crochet-pattern-and-chart-tutorial/ — Treasurie, filet crochet
64. [S68]: https://www.yarnspirations.com/blogs/how-to/filet-crochet-patterns-and-guides — Yarnspirations, filet (3× boxes + 1; via search summary)
65. [S69]: https://theunraveledmitten.com/2020/11/13/tunisian-crochet-tutorial-for-beginners/ — The Unraveled Mitten, Tunisian basics (via search summary)
66. [S70]: https://simply-yarn.com/guides/how-to-crochet/how-to-do-tunisian-crochet — Simply Yarn, Tunisian crochet
67. [S71]: https://media.craftyarncouncil.com/files/CYCACrochetChartSymbols.pdf — CYC chart symbol PDF (graphics not machine-readable)
68. [S72]: https://www.craftyarncouncil.com/standards/downloadable-symbols — CYC downloadable symbols
69. [S73]: https://www.kayliebooks.com/how-to-read-japanese-crochet-diagrams/ — Kayliebooks / Ronique guide 1, reading JIS charts (via search summary)
70. [S74]: https://www.dummies.com/article/home-auto-hobbies/crafts/knitting-crocheting/how-to-follow-a-stitch-diagram-in-crochet-197712/ — Dummies, following a stitch diagram
71. [S75]: https://www.yarnspirations.com/blogs/how-to/ultimate-guide-to-left-handed-crochet — Yarnspirations, left-handed crochet (via search summary)
72. [S76]: https://www.anniesattic.com/stitch-guide/crochet-guide/crochet-how-tos/help-for-left-handed-crocheters — Annie's Attic, help for left-handed crocheters

[S1]: https://www.craftyarncouncil.com/standards/crochet-chart-symbols
[S2]: https://www.craftyarncouncil.com/standards/crochet-abbreviations
[S3]: https://en.wikipedia.org/wiki/List_of_crochet_stitches
[S4]: https://www.craftyarncouncil.com/standards/how-to-read-crochet-pattern
[S5]: https://www.edieeckman.com/2020/05/08/how-many-foundation-chains-do-i-need/
[S7]: https://doradoes.co.uk/2020/11/21/the-anatomy-of-a-crochet-stitch/
[S8]: https://marlybird.com/blog/crochet-stitch-anatomy/
[S9]: https://raffamusadesigns.com/crochet-hdc-third-loop/
[S10]: https://www.bygoldenberry.com/blog/crochet-turning-chain
[S11]: https://www.joannascrochet.com/2025/11/crochet-stitch-height-guide-comparison.html
[S12]: https://www.sigonimacaroni.com/does-the-turning-chain-count-as-a-stitch/
[S13]: https://www.designingvashti.com/crochet-stitch-equivalents-issue-2/
[S14]: https://crochetpatterncompanion.blogspot.com/2011/03/how-to-take-control-of-double-crochet.html
[S15]: https://www.stitchsums.com/articles/crochet-pattern-math
[S16]: https://www.yarnspirations.com/en-row/blogs/how-to/how-to-read-crochet-chart-symbols
[S20]: https://en.wikipedia.org/wiki/Crochet
[S21]: https://ronique.jp/en/free_recipes-how_to_crochet/beg_ch/
[S22]: https://www.kheyo.com/understanding-double-crochet-is-double-crochet-chain-2-or-3/
[S23]: https://www.crochet365knittoo.com/crochet-stitch-heights/
[S24]: https://holvettedencsinaltam.hu/horgolas-alapjai-kisokos/
[S25]: https://www.edieeckman.com/2018/11/13/front-post-back-post-double-crochet/
[S26]: https://magyarhorgolas.blogspot.com/p/horgolas-alapjai-kezdoknek.html
[S27]: https://horgoljmagadnak.hu/horgolas-alapok-alap-palcak-a-horgolasban/
[S28]: https://www.ronique.net/en/blogs/guide_to_japanese_crochet_charts/guide_002
[S29]: https://harrisville.com/blogs/crocheting/single-and-double-crochet
[S30]: https://www.craftyarncouncil.com/standards/yarn-weight-system
[S31]: https://simply-yarn.com/guides/how-to-crochet/how-to-do-tunisian-crochet
[S32]: https://www.barmitarto.hu/palca-tipusok-horgolasa-kezdoknek
[S33]: https://nokondesign.hu/horgolas-jelek-utmutato/
[S34]: http://zoldpamuk.blogspot.com/2014/08/zavar-hamispalca-korul.html
[S35]: https://cirmi-hobbija.blogspot.com/2011/10/palcatitkok.html
[S36]: https://horgoljmagadnak.hu/rovidpalca-horgolas-alapjai-kezdoknek/
[S37]: https://www.fonallak.hu/horgolas-alapjai-6-resz-egyrahajtasos-palca-97
[S38]: https://kreativeshobby.hu/index.php/2016/04/28/az-elso-relief-horgolasa/
[S39]: https://crocheandme.blogspot.com/2019/05/6-basic-crochet-stithes.html
[S40]: https://ronique.jp/en/free_recipes-how_to_crochet/symbol_slip_stitch/
[S41]: https://yumekomade.com/basics/basics1/
[S42]: https://www.southerngoose.com/post/jis-l-0201-1995-letter-symbols-for-knitting-stitch
[S43]: https://dancingbarefoot.wordpress.com/2010/02/01/tutorial-lesson-3a-crochet/
[S44]: https://www.mooglyblog.com/extended-single-crochet-esc-or-exsc/
[S45]: https://www.mooglyblog.com/foundation-single-crochet-fsc/
[S46]: https://theunraveledmitten.com/2018/11/09/foundation-crochet-stitches/
[S47]: https://simply-yarn.com/guides/how-to-crochet/how-to-read-crochet-charts
[S48]: https://joyofmotioncrochet.com/double-crochet-front-and-back-post-ribbing/
[S49]: https://www.dummies.com/crafts/crocheting/stitches/how-to-crochet-spikes/
[S50]: https://www.acrochetedsimplicity.com/how-to-crochet-spike-stitch-step-by-step-tutorial/
[S51]: https://joyofmotioncrochet.com/linked-double-crochet/
[S52]: https://hearthookhome.com/crossed-double-crochet-stitch-tutorial/
[S53]: https://www.mooglyblog.com/reverse-single-crochet-crab-stitch/
[S54]: https://hearthookhome.com/the-crab-stitch-crochet-stitch-video-tutorial/
[S55]: https://clubcrochet.com/lessons/chapter-5/
[S56]: https://www.planetjune.com/blog/amigurumi-help/invisible-decrease/
[S57]: https://craftinghappiness.com/the-regular-vs-invisible-decrease-in-amigurumi/
[S58]: https://www.yarnspirations.com/blogs/how-to/how-to-crochet-clusters
[S59]: https://daisyfarmcrafts.com/dc2tog-cluster-stitch/
[S60]: https://sarahmaker.com/puff-bobble-popcorn/
[S61]: https://www.dummies.com/article/home-auto-hobbies/crafts/knitting-crocheting/how-to-crochet-the-v-stitch-and-shell-stitch-197618/
[S62]: https://en.wikipedia.org/wiki/Shell_stitch
[S63]: https://www.kristinomdahl.com/chain-3-picot-tutorial-single-crochet-vs-slip-stitch-demo-plus-charts-plus-free-pattern/
[S64]: https://www.crochetspot.com/what-is-a-chain-space-ch-sp/
[S65]: https://www.mooglyblog.com/love-knot-solomons-knot-crochet/
[S66]: https://hearthookhome.com/solomons-knot-crochet-stitch-tutorial/
[S67]: https://blog.treasurie.com/filet-crochet-pattern-and-chart-tutorial/
[S68]: https://www.yarnspirations.com/blogs/how-to/filet-crochet-patterns-and-guides
[S69]: https://theunraveledmitten.com/2020/11/13/tunisian-crochet-tutorial-for-beginners/
[S70]: https://simply-yarn.com/guides/how-to-crochet/how-to-do-tunisian-crochet
[S71]: https://media.craftyarncouncil.com/files/CYCACrochetChartSymbols.pdf
[S72]: https://www.craftyarncouncil.com/standards/downloadable-symbols
[S73]: https://www.kayliebooks.com/how-to-read-japanese-crochet-diagrams/
[S74]: https://www.dummies.com/article/home-auto-hobbies/crafts/knitting-crocheting/how-to-follow-a-stitch-diagram-in-crochet-197712/
[S75]: https://www.yarnspirations.com/blogs/how-to/ultimate-guide-to-left-handed-crochet
[S76]: https://www.anniesattic.com/stitch-guide/crochet-guide/crochet-how-tos/help-for-left-handed-crocheters

**Method note:** Sources marked "via search summary" were seen only as search-result snippets, not full-page fetches. Claims resting only on them are lower confidence. The CYC symbol PDF could not be rendered, so symbol shapes come from secondary guides that agree with each other.
