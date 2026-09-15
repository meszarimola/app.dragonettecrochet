# 04 — Crochet in the Round: Flat Circles, 3D Shaping, Amigurumi

Research report for the crochet pattern designer knowledge base.
Compiled 2026-09-14. US terminology throughout (sc = single crochet, hdc = half double, dc = double, tr = treble; UK names are one step "taller").

**Evidence labels used in this document**

- **[CONSENSUS]**: stated the same way by several independent reputable sources.
- **[RULE OF THUMB]**: widely used heuristic; works in practice but is an approximation.
- **[CONTESTED]**: sources disagree, or it depends on gauge, tension or handedness.
- **[DERIVED]**: my own derivation from standard geometry, checked numerically with a throwaway script during research (not kept in the repo). It is not a quoted claim, so validate it against real swatches before treating it as fact.

Every quoted claim carries its source URL inline. A consolidated source list is at the end.

---

## 0. Core geometric model (read this first)

The whole topic rests on one model, and every generator below uses it.

- A crochet round is a closed strip of stitches. Each stitch has a **width `w`** (along the round) and a **height `h`** (across rounds). With gauge `g_s` stitches/cm and `g_r` rows/cm, `w = 1/g_s` and `h = 1/g_r`.
- For a fabric worked outward from a point, round *k* sits at a distance of about `k·h` from the start, measured along the fabric.
- The shape is fully determined by how the **stitch count per round `S_k`** changes with *k*:
  - For a flat disc, the circumference is `2π·k·h`, so `S_k = 2π·k·h/w` and the number of increases per round is constant: **Δ = 2π·h/w**.
  - Δ below that value gives a cone or cup (positive curvature). Δ equal to it gives a flat disc. Δ above it gives ruffles (negative, hyperbolic curvature). Δ = 0 gives a tube or cylinder. Negative Δ (decreases) closes the shape.

Sources for the 2π rule: ReveDreams, which says "To be flat, a one-unit increase in the radius of the disk (i.e., an additional round) must be accompanied by a 2π-unit increase in the circumference" (https://www.revedreams.com/crochet/yarncrochet/single-crochet-shaping-1-cones-ruffles/); Dora Does (https://doradoes.co.uk/2020/12/12/how-to-crochet-a-flat-circle/); Just Be Crafty (https://justbcrafty.com/how-to-crochet-a-flat-circle/).

**[DERIVED] Discrete Gauss–Bonnet check (useful for validation code).**
For a surface of revolution worked in rounds, the total Gaussian curvature enclosed by round *k* is approximately

`K_enclosed(k) ≈ 2π − Δ_k · (w/h)`

where Δ_k = S_{k+1} − S_k. Reading the result:

- Flat disc: Δ = 2πh/w, so K = 0.
- Cone with Δ = 3 sc: K ≈ 3.28 rad, concentrated at the tip.
- Closed sphere: 4π in total.
- Hyperbolic (Δ grows each round): K becomes increasingly negative.

This follows from Gauss–Bonnet together with the fact that, for a surface of revolution, ∮κ_g ds = dC/ds. It gives a program a single scalar per round for "cupping versus ruffling" diagnostics (§8, §9).

---

## 1. Starting rounds

### 1.1 Magic ring (adjustable ring) vs chain ring  [CONSENSUS]

| Method | How | Pros | Cons | Use |
|---|---|---|---|---|
| Magic ring (MR, magic circle) | Wrap the yarn into a loop, work round 1 into the loop, then pull the tail to close it | "no hole in the centre of your starting round" (PlanetJune, https://www.planetjune.com/blog/amigurumi-help/how-to-crochet-a-magic-ring/) | Fiddly to learn; can loosen with slippery yarn (secure by knotting or weaving the tail) (PlanetJune, same URL) | Amigurumi: "essential for amigurumi (no stuffing can poke through)" (https://crochetcalc.com/articles/how-to-crochet-in-the-round.html) |
| "ch 2, n sc in 2nd ch from hook" | Round 1 is worked into a single chain | Easy | Slightly visible centre hole (PlanetJune; crochetcalc) | Acceptable when the centre is not seen |
| Chain ring (ch n, sl st to form ring) | Round 1 is worked into the ring | Simplest, and traditional for motifs | Visible hole | Doilies, mandalas, granny squares (https://crochetcalc.com/articles/how-to-crochet-in-the-round.html; Yarnspirations granny: ch 4 start, https://www.yarnspirations.com/blogs/how-to/guide-to-granny-crochet-squares-circles-hearts-stripes-and-more) |

The magic ring does not count as a stitch. Taller first-round stitches need a turning chain: ch 1 for sc, ch 2 for hdc, and so on (PlanetJune, URL above).

**Encoding note:** a "start" node has type ∈ {MR, ch-ring(n), ch-2}. The MR and ch-2 starts both yield S_1 round-1 stitches into a single point. A ch-ring(n) start has an initial hole of circumference ≈ n chain widths, which is effectively a round 0 of n stitches.

### 1.2 Starting count and increases per round, by stitch height

| Stitch | Commonly quoted start = Δ per round | Sources | Ideal 2π·h/w using a typical aspect ratio [DERIVED] |
|---|---|---|---|
| sc | **6** (Dora Does: "6–7"; ReveDreams gauge: 7–8 flat) | Shelley Husband https://shelleyhusbandcrochet.com/the-secret-crochet-circle-formula-and-how-to-tweak-it/; Pulled Stitch http://pulledstitch.blogspot.com/2021/11/how-to-crochet-circles-bowls-and-spheres.html; Dora Does https://doradoes.co.uk/2020/12/12/how-to-crochet-a-flat-circle/; ReveDreams (URL above) | h/w = 1.0 → 6.28; h/w = 0.9 → 5.65 |
| hdc | **8** (Dora: 8–10) | Pulled Stitch; Dora Does; Just Be Crafty https://justbcrafty.com/how-to-crochet-a-flat-circle/ | h/w ≈ 1.3–1.4 → 8.2–8.8 |
| dc | **12** (Dora: 10–12) | Shelley Husband; Pulled Stitch; crochetcalc | h/w ≈ 2 → 12.6 |
| tr | **15–16** (Dora: 14–18) | Shelley Husband (16); Pulled Stitch (15); Dora Does | h/w ≈ 2.4–2.6 → 15–16.3 |

**Why these numbers.** Δ = 2π·(h/w). An sc is "about the same width and height, or slightly wider than they are tall" (The Unknown Orchard, http://theunknownorchard.blogspot.com/2015/08/understanding-spherical-crochet-and.html), which gives ≈ 6. A dc is about twice as tall as it is wide, which gives ≈ 12. Just Be Crafty frames it as "a flat circle needs as many increases per round as the stitch has height" (in sc-height units × 6) (https://justbcrafty.com/how-to-crochet-a-flat-circle/).

**Gauge-based method (Dora Does).** Compute diameter from row height × rounds, circumference = π·d, stitches = circumference ÷ stitch width, then divide by rounds. At 20 st / 20 rows per 10 cm over 5 rounds this gives ≈ 6.28 (https://doradoes.co.uk/2020/12/12/how-to-crochet-a-flat-circle/).

**[CONTESTED] Why the numbers vary.** Crocheters who turn their rounds, work loosely, or use yarn-over versus yarn-under get different aspect ratios (Dora Does). ReveDreams found 5–6 increases cupped, 7–8 lay flat, 9 began crowding and 10 ruffled, all in their own sc gauge (https://www.revedreams.com/crochet/yarncrochet/single-crochet-shaping-1-cones-ruffles/).

Pulled Stitch reports that an hdc **sphere** works better starting from 7 rather than 8 (http://pulledstitch.blogspot.com/2021/11/how-to-crochet-circles-bowls-and-spheres.html). Amigurumi uses 6 almost universally because stuffed 3D pieces tolerate small errors, and 6 divides nicely.

**Implementation rule:** do not hard-code 6/8/12. Compute `Δ_flat = 2π·h/w` from the stitch type's aspect ratio, which the user can override from a gauge swatch. Then round to a "nice" integer: 6 for sc, 8 for hdc, 12 for dc, 15 or 16 for tr.

---

## 2. Joined rounds vs continuous spiral

| | Joined (sl st to first st, ch up) | Continuous spiral |
|---|---|---|
| Structure | Each round is closed; the start of each round is marked by the sl st plus turning chain | One helical strip; no joins |
| Pros | "Easy to track progress"; rounds stay level; clean color changes (Joanna's Crochet https://www.joannascrochet.com/2025/10/spiral-vs-joined-rounds-explained-which.html; crochet.com https://www.crochet.com/learning-center/joining-round-vs-magic-circle) | "Completely seamless", faster, no chain-up gaps (Joanna's Crochet) |
| Cons | Visible seam; "each round's join sits slightly to the right (for right-handed crocheters) of the previous round's join", so the seam slants or drifts; chain-ups can leave gaps (Joanna's Crochet) | "must use a stitch marker"; color changes jog; small height step where the round starts (Joanna's Crochet; crochetcalc https://crochetcalc.com/articles/how-to-crochet-in-the-round.html) |
| Default for | dc and taller work, granny motifs, mandalas, hats with rib bands (crochetcalc; Joanna's Crochet) | sc work, especially amigurumi (crochetcalc; Joanna's Crochet) |

**Stitch marker practice [CONSENSUS].** Put a marker in the first stitch of each round and move it up when you reach it (crochetcalc, URL above).

**Spiral drift [CONSENSUS].** "While working in spiral, the first stitch of each round drifts a bit to the right". Amigurumi-style crochet always has a skew, because each stitch sits slightly behind the same stitch on the round below (PlanetJune / search summary of https://www.planetjune.com/blog/amigurumi-help/resizing-amigurumi/ and related PlanetJune tutorials).

The skew direction reverses for left-handers (Joanna's Crochet). Yarn-under versus yarn-over changes the stitch shape too: yarn-under gives tighter, X-like stitches (https://crochets.site/resources/yarn-under-vs-yarn-over-amigurumi-stitch-slant-twist-tension-handedness). **[CONTESTED]** Sources disagree on how much yarn-under changes the slant.

**Color-change jog fixes (spiral) [CONSENSUS on method, RULE OF THUMB on result]:**

1. **Standard invisible change.** Complete the last stitch of the old color by pulling the new color through the last 2 loops.
2. **Slip-stitch jog fix (Crochet Arcade).** Do step 1, then "Make a slip stitch instead of making a single crochet in the first stitch of the round in new colour." Repeat at each stripe. It reduces the jog but does not remove it (https://www.crochetarcade.co.uk/jogless-stripes-color-change-for-single-crochet-worked-in-a-spiral/; also Littlejohn's Yarn https://littlejohnsyarn.com/crochet-jogless-stripes-in-1-minute-amigurumi-hacks/).
3. **BLO/FLO lock (The Nicole Chase).** Join the new color in the back loop only of the first stitch. Work around. At that stitch, work through the unworked front loop plus the remaining loops. This "shifts the round's starting point by one stitch" and works best for blocks of 2+ rounds (https://www.thenicolechase.com/blog/color-changes).

**Encoding note:** a spiral pattern is still counted in logical rounds. The generator should:
- insert a `marker` at the round start;
- when a color changes at a round boundary, offer `jogFix ∈ {none, slst, bloLock}`;
- shift the logical start by +1 stitch after `slst` or `bloLock`.

---

## 3. Increase distribution

### 3.1 Base progression (sc, 6-start)  [CONSENSUS]

`Rk: (sc (k−2), inc) x6 (6k)` for k ≥ 3. R1 = 6 sc in MR; R2 = inc x6 (12).

| Rnd | Instruction | Count |
|---|---|---|
| 1 | 6 sc in MR | 6 |
| 2 | inc x6 | 12 |
| 3 | (sc, inc) x6 | 18 |
| 4 | (2 sc, inc) x6 | 24 |
| 5 | (3 sc, inc) x6 | 30 |
| 6 | (4 sc, inc) x6 | 36 |
| 7 | (5 sc, inc) x6 | 42 |
| k | (k−2 sc, inc) x6 | 6k |

Sources: Supergurumi https://www.supergurumi.com/crochet-shapes-crochet-balls-and-spheres; Octopus Crochet https://octopuscrochet.com/what-is-gauge-in-crochet-and-how-to-use-it-for-amigurumi/; hookabee https://hookabee.com/2015/08/24/how-to-prevent-increase-and-decrease-lines-on-your-amigurumi/.

For a generic start `s` (dc = 12, etc.), round k has `s·k` stitches and each repeat is `(k−2 st, inc)`. Shelley Husband gives the same approach: "Double the stitches in Round 2, then increase by 1 additional stitch in each repeat per round" (https://shelleyhusbandcrochet.com/the-secret-crochet-circle-formula-and-how-to-tweak-it/).

### 3.2 Why it becomes a hexagon, and the stagger fix  [CONSENSUS]

Stacked increases "create visible seams" and "six stacked increases create six angles and sides" (hookabee, URL above; Henlo Home https://henlohome.com/help-my-crochet-circles-look-like-hexagons/).

The fix is to offset the increase position on alternate rounds. hookabee's canonical version:

| Rnd | Staggered instruction | Count |
|---|---|---|
| 1 | 6 sc in MR | 6 |
| 2 | inc x6 | 12 |
| 3 | (inc, 1 sc) x6 | 18 |
| **4** | **1 sc, (inc, 2 sc) x5, inc, 1 sc** | 24 |
| 5 | (inc, 3 sc) x6 | 30 |
| **6** | **2 sc, (inc, 4 sc) x5, inc, 2 sc** | 36 |
| 7 | (inc, 5 sc) x6 | 42 |
| **8** | **3 sc, (inc, 6 sc) x5, inc, 3 sc** | 48 |

The rule (Henlo Home): on a round with an even number *g* of sc between increases, start with g/2 sc, then work the normal repeat, and finish with the remaining g/2 sc. The increases therefore zig-zag, giving "what looks like 12 increase areas" instead of 6 points (Fox Creations / search summary, https://foxcreations.com.au/amigurumi-101/how-to-crochet-a-perfect-circle-with-staggered-increases/).

"and she laughs" gives an 8-start variant with the same logic: R4 `*sc, inc, sc*`, R6 `*2sc, inc, 2sc*` (https://www.andshelaughsblog.com/crocheting-perfect-circle-staggered-increases-decreases/).

Shelley Husband also flags a separate problem in sc: the spiral "whorl" or "spiral arms". Stacked increases in a spiral form curved arms, which again is fixed by rotating the increase position (URL above).

The generator script output in §9.1 reproduces hookabee's table exactly.

**[RULE OF THUMB] Stronger smoothing.** Random or rotating offsets (not just half-shifts) look even rounder. CrochetPARADE's sphere generator "distributes increases/decreases to reduce symmetric bulges, especially near the poles" (https://www.crochetparade.org/Manual.html).

### 3.3 Decreases  [CONSENSUS]

Decreases mirror increases: `Rk: (sc (m−2), dec) x6` takes 6m stitches down to 6(m−1). Examples:

- Crafting Happiness egg: `(dec, sc 2) x6 (18)`, `(dec, sc) x6 (12)`, `dec x6 (6)` (https://craftinghappiness.com/free-crochet-easter-egg-shape-pattern-in-3-sizes/).
- Supergurumi: "6 decreases per round until there are only 6 stitches left" (https://www.supergurumi.com/crochet-shapes-crochet-balls-and-spheres).

Stagger decreases the same way; staggering "keep[s] the holes between stitches smaller since the decreases aren't stacked" ("and she laughs", URL above).

For amigurumi, use the **invisible decrease**: insert into the front loops only of the next 2 stitches, yarn over, pull through both front loops, then complete the sc. It avoids the bump and gap of a both-loops sc2tog, which "become[s] more obvious once stuffing is inside" (All About Ami https://www.allaboutami.com/invisibledecrease/; Hello Yellow Yarn https://helloyellowyarn.com/2016/02/12/tutorial-invisible-decrease-in-crochet/; search summary of the Cilla Crochets and Nomad Knot tutorials).

Finish by closing the last 6 stitches: cut the yarn, weave the tail through the front loops of the remaining stitches, and pull tight. This is standard practice across the sphere tutorials above.

### 3.4 Ovals started on a chain  [CONSENSUS on structure; counts vary]

Structure: chain *L*. Work along one side of the chain, put several stitches in the end chain (turning around the end), work back along the underside of the chain, then increase at the other end. After that, increases only happen at the two curved ends, and the straight sides grow by +1 stitch per round between increase groups. Sources: Treasurie https://blog.treasurie.com/how-to-crochet-an-oval/; All About Ami https://www.allaboutami.com/foundationchain/; bHooked https://bhookedcrochet.com/2017/07/02/crochet-oval/.

Treasurie sc oval (ch 5):

| Rnd | Instruction | Count |
|---|---|---|
| 1 | 3 sc in 2nd ch from hook, sc 2, 3 sc in last ch, rotate, sc 2 | 16 (as published) |
| 2 | (2 sc in each of next 3, sc 2) x2 | 22 |
| 3 | ((inc, sc) x3, sc 2) x2 | 28 |
| 4 | ((inc, sc 2) x3, sc 2 [+1 per round]) x2 | 34 |

This is a +6 per round rule with 3 increases per end, and straight sides +1 per round (https://blog.treasurie.com/how-to-crochet-an-oval/). The count arithmetic in the published round 1 appears to include the end stitches differently; the program should recompute counts itself rather than trust published totals.

All About Ami (amigurumi head): ch 7; R1: 6 sc in back loops of the chain, turn, 6 sc in front loops = 12; R2: (sc, inc) x6 = 18 (https://www.allaboutami.com/foundationchain/). In amigurumi practice the ends are often worked as "3 sc in end ch", which gives `2(L−1) + 4` stitches in round 1 **[RULE OF THUMB]**.

bHooked dc oval: ch 11; R1 = 20; R2 = 28; R3 = 44; R4 = 58; R5 = 72; then **+14 per round**, with the spacing between increases +1 each round (https://bhookedcrochet.com/2017/07/02/crochet-oval/). Increases at the two ends ≈ 2 × (half a dc circle's 12), consistent with §1.2.

**[DERIVED] Oval rule.** An oval equals two half-circles joined by straight sides of length `L_straight`. At each end, add Δ_flat/2 increases per round (3 for sc, 6–7 for dc). The straight-side stitch counts stay constant, apart from the +1 per round shift caused by the end stitches migrating.

---

## 4. 3D primitives and stitch-count formulas

Notation: `g_s` stitches/cm, `g_r` rows/cm, `w = 1/g_s`, `h = 1/g_r`, target diameter `D` (cm).

### 4.1 Tube / cylinder  [CONSENSUS]

"If you crochet as many stitches as in the previous round, you crochet a tube" (Supergurumi cones https://www.supergurumi.com/how-to-crochet-cones-in-spiral-rounds).

- Stitches = `round(π·D·g_s)`. For amigurumi, round to a multiple of 6 so it can grow from a 6-start base.
- Height = `even_rounds / g_r`.
- A closed cylinder = flat disc (Δ = 6/round up to S) + **1 BLO round** (for a crisp bottom edge) + even rounds.

Pulled Stitch's bowl follows this pattern: make a flat circle, then work "into the back loop only" without increases for the sides (http://pulledstitch.blogspot.com/2021/11/how-to-crochet-circles-bowls-and-spheres.html). PlanetJune notes BLO is used where "you turn a sharp corner from the base of the pot to begin the sides" (https://www.planetjune.com/blog/tutorial-better-blo-stitches-for-amigurumi/).

### 4.2 Cone  [CONSENSUS on structure, DERIVED angle]

"The math of a cone is that the circumference and height have a linear relationship – you add the same number of stitches to each round. Increasing by 1 to 4 stitches per round produces a cone" (search summary of Shiny Happy World https://www.shinyhappyworld.com/2010/11/crochet-cone-shapes-amigurumi.html and Supergurumi).

Supergurumi examples (start 6 sc):

| Δ per round | R2 | R3 | R4 |
|---|---|---|---|
| 1 | inc, 5 sc (7) | inc, 6 sc (8) | inc, 7 sc (9) |
| 2 | (inc, 2 sc) x2 (8) | (inc, 3 sc) x2 (10) | (inc, 4 sc) x2 (12) |
| 3 | (inc, sc) x3 (9) | (inc, 2 sc) x3 (12) | (inc, 3 sc) x3 (15) |
| 5 | 5 inc, sc (11) | (inc, sc) x5, sc (16) | (inc, 2 sc) x5, sc (21) |

Source: https://www.supergurumi.com/how-to-crochet-cones-in-spiral-rounds. With Δ = 6 you get a flat circle or hexagon (same source).

Fractional Δ is achieved by alternating. Examples: "alternating adding 2 and 3 stitches to each round (effectively 2.5)", or "2 stitches to most rounds but only a single stitch to every fourth round (1.75)". An equivalent approach is "6 increases every N rounds", which gives Δ = 6/N (search summary, Shiny Happy World / Two Little C's http://two-little-cs.blogspot.com/2015/04/day-11-crocheting-cones.html).

**[DERIVED] Cone half-angle.** Each row advances `h` along the slant and adds `Δ·w` of circumference, so `sin α = Δ·w / (2π·h)`. For sc with h/w = 1:

| Δ/round | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| half-angle α | 9.2° | 18.6° | 28.5° | 39.5° | 52.7° | 72.7° (≈ flat; imperfect because 6 < 2π) |

Inverse, used to design a cone of base diameter `D` and slant height `L`: `Δ = 2π·(h/w)·sin α` with `sin α = (D/2)/L`, rounds = `L·g_r`.

### 4.3 Sphere  [CONSENSUS on structure; CONTESTED on even-round count]

**Amigurumi standard ("6n ball").** Supergurumi: increase by 6 per round up to the desired size, then "crochet as many rounds as you needed for the circle plus 1 more round" even, then decrease by 6 per round down to 6 (https://www.supergurumi.com/crochet-shapes-crochet-balls-and-spheres).

| k increase rounds | Max stitches | Even rounds (k+1) | Decrease rounds (k−1, then close) | Total rounds |
|---|---|---|---|---|
| 4 (small) | 24 | 5 | 3 | 12 |
| 5 (medium) | 30 | 6 | 4 | 15 |
| 6 | 36 | 7 | 5 | 18 |

Sources: Supergurumi (small peaks at 24 with R5–9 even, medium at 30 with R6–11 even). Pulled Stitch states it more simply: "Work a flat circle to achieve your desired diameter. Work the same number of rounds again even, without increase. Decrease by the same number of rounds" (http://pulledstitch.blogspot.com/2021/11/how-to-crochet-circles-bowls-and-spheres.html).

**[CONTESTED]** Other writers recommend "only 3 to 4 plain rounds for a medium sphere" (search summary of MrsCrochetWorld / Zamiguz pages, https://mrscrochetworld.com/blogs/crochet-blog/how-to-crochet-a-perfect-sphere-amigurumi-ball-formula-2026). FiberTools' reference sphere uses 6 up to 36, then 1 even round, then 5 down. It explicitly states that the schedules "do not guarantee a finished geometric shape" (https://fibertools.app/amigurumi-shapes). Fewer even rounds give an oblate "bun"; tight stuffing rounds it out.

**[DERIVED] Why k to k+1 even rounds is right for square sc.** A 6k ball has equator circumference `6k·w`, so `D = 6k·w/π`. A true sphere's pole-to-pole meridian is `πD/2 = 3k·w`, which for h = w is **3k rows**. The Supergurumi schedule has k + (k+1) + (k−1) = **3k** rounds. So the rule "max round of 6n stitches → about n (or n+1) even rounds" is exactly the rows-per-meridian constraint for a square stitch.

If stitches are shorter than they are wide (h < w), you need *more* rounds, and vice versa. The general relation is `total_rounds ≈ 3k·(g_r/g_s)`.

**Exact (sine) sphere [CONSENSUS among math sources].** Avtanski's Crochet Sphere Calculator and its re-implementation by bookworm3x4 use:

- Rows: `n = round(πD/2 · g_r)`
- Angle for row i: `θ_i = π(i/n − 1/(2n))`
- Row radius: `r_i = (D/2)·sin θ_i`
- Stitches in row i: `s_i = round(sin((2i−1)/(D·g_r)) · π·D·g_s)`
- Adjusted diameter after rounding: `d' = n · 2/(π·g_r)`
- Quality of fit: r² between actual and ideal circumferences

Sources: https://bookworm3x4.github.io/crochet-sphere-calculator/sphere_math.html; Avtanski original http://avtanski.net/projects/crochet (input: circumference in stitches; also the "Crochet Lathe" for arbitrary profiles). The Unknown Orchard explains the same sine schedule: "the heights change at a different rate depending on what part of the circle they are on" (http://theunknownorchard.blogspot.com/2015/08/understanding-spherical-crochet-and.html). Crocheo gives `max_stitches = π × diameter × stitches_per_cm` (https://crocheo.net/blog/crochet-spheres).

The sine schedule increases fastest near the pole and has **no flat-disc phase**. The 6n ball has a flat bottom of k rounds, then a cylindrical band, and relies on stuffing to round it. Both are legitimate; the sine schedule is geometrically truer, and the 6n ball is easier to read and memorise.

### 4.4 Worked example: a 6 cm ball in DK yarn

**Gauge.** Octopus Crochet measured a 5-round sc amigurumi gauge circle (6/12/18/24/30) in DK cotton blend on a 3.5 mm hook at **5 cm wide** (https://octopuscrochet.com/what-is-gauge-in-crochet-and-how-to-use-it-for-amigurumi/). Tiny Curl recommends 2.25–2.75 mm for DK amigurumi, which would make it smaller (https://www.tinycurl.co/amigurumi-hook-size/).

[DERIVED] from that gauge circle:
- radius 2.5 cm over 5 rounds → `h ≈ 0.5 cm`, `g_r ≈ 2.0 rows/cm`;
- round 5 = 30 st over π·5 cm = 15.7 cm → `g_s ≈ 1.9 st/cm`.

**Standard 6n method.** `max = π·6·1.9 ≈ 35.8 → 36 = 6×6`, so k = 6.

```
R1: 6 sc in MR (6)
R2: inc x6 (12)
R3: (sc, inc) x6 (18)
R4: sc, (inc, 2 sc) x5, inc, sc (24)          <- staggered
R5: (3 sc, inc) x6 (30)
R6: 2 sc, (inc, 4 sc) x5, inc, 2 sc (36)      <- staggered
R7–R13: sc around (36)  [7 rounds = k+1]
R14: (4 sc, dec) x6 (30)
R15: sc, (dec, 2 sc) x5, dec, sc (24)          <- staggered
   (insert safety eyes / start stuffing around here)
R16: (sc, dec) x6 (18)
R17: dec x6 (12)
R18: dec x6 (6). Fasten off, close through front loops.
```

**Erratum (PQW-863).** The R15–R17 instructions above are one round ahead of their stitch counts: `sc, (dec, 2 sc) x5, dec, sc` turns 24 stitches into 18, not 30 into 24. The counts (30, 24, 18, 12, 6) are right. The designer writes R15 `sc, (invdec, 3 sc) x5, invdec, 2 sc (24)`, R16 `(2 sc, invdec) x6 (18)` and R17 `(invdec, sc) x6 (12)`. For this gauge the §9.2 formula `E = round(3k·g_r/g_s) − (2k − 1)` gives 8 even rounds, not 7; the designer rounds toward the consensus k + 1 and moves away from it only by whole rounds.

18 rounds in total. Check: ideal meridian rows = `πD/2·g_r = π·6/2·2.0 = 18.85`, so this matches within one round. Implied equator diameter = 36/(π·1.9) = 6.03 cm ✔.

**Sine method for the same ball** (computed during research): n = 19 rows, ideal counts

`3, 9, 14, 20, 24, 28, 31, 34, 35, 36, 35, 34, 31, 28, 24, 20, 14, 9, 3`

For crocheting, replace the 3-stitch poles with a 6 sc MR and clamp the second row to ≥ 12 (a doubling is the maximum per round). A crochetable version is: `6, 12, 16, 20, 24, 28, 31, 34, 35, 36, 35, 34, 31, 28, 24, 20, 16, 12, 6`. Every Δ ≤ S (max doubling), and decreases ≤ S/2.

### 4.5 Hemisphere, bowl and cup  [DERIVED + CONSENSUS]

- Bowl or cup = flat disc + walls. Pulled Stitch uses BLO for a sharp base edge, then even rounds for the walls (http://pulledstitch.blogspot.com/2021/11/how-to-crochet-circles-bowls-and-spheres.html).
- Rounded hemisphere (hat crown, dome, amigurumi head top) = the first half of the sphere: k increase rounds + about **k/2 even rounds** for square sc. The quarter-meridian is 1.5k rows, of which the increase phase uses k. Equivalently, use the first ⌈n/2⌉ rows of the sine schedule. [DERIVED]
- Tapered cup = increase rounds followed by rounds at Δ ≈ 1–3 (a cone section) instead of Δ = 0.

### 4.6 Ellipsoid / egg  [CONSENSUS on practice, DERIVED on exact]

Practice: "The number of even rounds between the last increase round and the first decrease round controls how elongated or spherical the shape is — more even rounds = taller" (search summary of the egg pattern results).

Crafting Happiness egg: R1–5 increase to 30; **R6–12 seven even rounds**; then *slow* decreases of −3 per round (27, 24, 21, 18, 15, 12). Using −3 instead of −6 per round makes a long, tapering end. The asymmetry comes from different decrease rates (https://craftinghappiness.com/free-crochet-easter-egg-shape-pattern-in-3-sizes/).

Knot Trying: make the second-to-last round of an egg in BLO (or BPsc) to give a flat base that stands (https://www.knottrying.com/blog/give-your-amigurumi-a-flat-base).

[DERIVED] Exact egg or ellipsoid = **surface of revolution**:

1. Define a profile `r(s)` parametrised by meridian arc length *s* (for an ellipsoid with semi-axes a (equatorial) and c (polar): `r = a·sin t`, `z = c·cos t`, reparametrised by arc length).
2. Sample rows at `s_i = (i − ½)·h`.
3. Set `S_i = round(2π·r(s_i)·g_s)`.

This is exactly what Avtanski's Crochet Lathe and CrochetPARADE's axially-symmetric tool do: "drag control points of the profile curve", and the tool "generates a stitch-count schedule that follows it" (https://www.crochetparade.org/Manual.html).

### 4.7 Torus  [DERIVED — no authoritative crochet source found]

Common amigurumi donuts are made as **two flat annuli** (top and bottom) sewn together and stuffed (search summary: Pops de Milk https://www.popsdemilk.com/blog/donut-amigurumi-crochet-pattern-video; Rose and Lily https://www.roseandlilyamigurumi.com/2022/01/crochet-donut-free-crochet-pattern.html). Those are not true tori.

A true torus worked in rounds around the minor circle:
- start on a foundation chain ring at the inner equator of circumference 2π(R−a);
- round at minor angle φ has `S = round(2π(R − a·cos φ)·g_s)`;
- number of rounds = `2π·a·g_r`;
- the last round is joined to the foundation chain.

Example, R = 4 cm, a = 1.5 cm, g = 2/cm: 19 rounds, counts `31, 32, 35, 40, 46, 52, 58, 63, 67, 69, 69, 67, 63, 58, 52, 46, 40, 35, 32`.

Note that the torus has regions of negative curvature (the inner half), where Δ > Δ_flat. This is the same "over-increasing" as hyperbolic crochet (§4.8).

### 4.8 Hyperbolic plane (Daina Taimina): over-increasing  [CONSENSUS]

Taimina made the first usable crocheted hyperbolic plane models in 1997 (Cabinet interview https://www.cabinetmagazine.org/issues/16/wertheim_henderson_taimina.php; AMS Mathematical Imagery https://www.ams.org/publicoutreach/math-imagery/taimina). The generative rule, in her words: "increasing crochet stitches in certain ratio (for example, crochet five, increase in sixth)" (Bridges 2022 gallery https://gallery.bridgesmathart.org/exhibitions/2022-bridges-conference/daina).

- Her first model increased 1 stitch after every 2, which grew exponentially and became very ruffled. "For classroom use the best is to use the ratio 12:13" (AMS / search summary).
- "The ratio must remain the same throughout" (search summary).
- Start Crochet uses the notation `x = n + 1`: low growth (inc every 5th–6th st) gives gentle lettuce ruffles; every 2nd–3rd gives pronounced ruffles; doubling every stitch gives brain-coral density (https://startcrochet.com/ultimate-beginners-guide-to-hyperbolic-crochet/).

**[DERIVED]** With ratio N:(N+1), `S_k = S_0·(1+1/N)^k`. For a hyperbolic plane of curvature radius R, the circumference grows like `e^{r/R}`, so `(1 + 1/N) = e^{h/R}`, which gives **R ≈ N·h** for large N. Larger N means a flatter-looking, larger-radius plane.

Growth from 12 stitches: N = 2 gives 12 → 91 → 692 → 39 903 stitches at rows 0/5/10/20; N = 5 gives 12 → 30 → 74 → 460; N = 12 gives 12 → 18 → 27 → 59.

**Designer relevance.** Any row where `S_{k+1}/S_k` is constant and > 1 while `S_k` is large produces a ruffle. The editor should label that as "hyperbolic/ruffle" rather than an error only if the user intends it.

---

## 5. Amigurumi practices

### 5.1 Tight gauge and hook choice  [CONSENSUS]

- Use a hook 1–2 sizes (≈ 2 mm) smaller than the ball band recommends: "Take the smallest recommended hook size and subtract 2 mm" (Tiny Curl https://www.tinycurl.co/amigurumi-hook-size/).
- Tiny Curl table: DK standard 4.5–5.5 mm → amigurumi 2.25–2.75 mm; worsted 5.5–6.5 → 2.75–3.75; chunky 6.5–9 → 4–5 (same URL).
- PlanetJune fabric test: work a few rounds, "push some fibrefill stuffing behind your work". If "stitches stretch open too much and the fibrefill is clearly visible," go down a size; if you "cannot easily insert the hook," go up (https://www.planetjune.com/blog/amigurumi-help/resizing-amigurumi/).
- Amigurumi gauge is measured as a **5-round sc circle diameter**, not a 10 cm square (Octopus Crochet, URL above).
- Work into both loops by default for "a firm fabric with minimal holes" (PlanetJune https://www.planetjune.com/blog/front-loops-back-loops-both-loops/).

### 5.2 Loop choice changes shape  [CONSENSUS]

- **BLO** gives "noticeably taller stitches", a thinner fabric, "sharp corners or ridges", and leaves front loops as "attachment points to crochet back into later".
- **FLO** gives shorter fabric that stretches more when stuffed, with larger gaps at increases and decreases.

Both points are from PlanetJune (https://www.planetjune.com/blog/front-loops-back-loops-both-loops/). BLO rounds are looser, so the corner loses firmness. PlanetJune's "better BLO" and "jogless BLO round" tutorials address the holes and the jog (https://www.planetjune.com/blog/tutorial-better-blo-stitches-for-amigurumi/).

**Flat bottom recipe:** increase to the base size, work 1 round BLO, then continue even for the walls. For eggs, make the second-to-last round BLO or BPsc (Knot Trying, URL above).

### 5.3 Invisible decrease

See §3.3.

### 5.4 Joining parts

- **Sewing.** An open piece (last round not closed) is whip-stitched onto a closed piece. This is common practice; standard in patterns generally, and not individually sourced here.
- **Join-as-you-go.** Crochet the next part directly into the last round (or front loops) of the previous part. AmiGo uses this so "no additional sewing is required" (https://ar5iv.labs.arxiv.org/html/2211.01178). BLO rounds leave loops for this purpose (PlanetJune, URL above).

### 5.5 Color changes in spirals

See §2.

### 5.6 Stuffing  [RULE OF THUMB — limited sourcing]

- Stuff firmly, and before the opening becomes too small; typically after the first decrease rounds (see the worked example).
- Tight fabric plus firm stuffing is what rounds a 6n ball. Very large pieces need proportionally much more stuffing: "A piece that's 50% larger in width and height is … closer to 2–3 times more stuffing" (Crochet Girl Pau https://crochetgirlpau.com/how-to-scale-amigurumi-patterns/).
- If stuffing shows, reduce stuffing firmness or tighten the gauge (Octopus Crochet; PlanetJune).

### 5.7 Safety eyes and toy safety (EU/US)  [CONSENSUS on principles; verify exact numbers with the standards]

- Safety eyes (post + locking washer) must be inserted **before the piece is closed**, typically before the last decrease rounds. This is standard practice.
- PlanetJune scaling example: doubling a toy's size means doubling eye size "from 8mm to 15mm" (https://www.planetjune.com/blog/amigurumi-help/resizing-amigurumi/).
- **EU:** handmade toys that are sold are toys under the Toy Safety Directive, tested to **EN 71**. EN 71-1 tension test: attached small parts on soft toys must withstand **90 N** (≈ 9 kg) for 10 s. Centexbel describes the tension test (EN71-1 §8.4) at https://www.centexbel.be/en/problem-solving/testing/tension-test-according-en71-1-ss84. Mecmesin says "small parts attached to the plush must withstand a 90 N tension test" (https://www.mecmesin.com/publications/toy-testing-attachment-strength-safety-standards). A lower **50 N for parts ≤ 6 mm** was reported only in a secondary search summary; treat it as unverified.
- EN 71-1 is stricter than ASTM on some items, for example cord length ≤ 22 cm for under-3 toys (JJR Lab https://www.jjrlab.com/news/what-are-the-differences-between-en-71-and-astm-f963.html).
- EU labelling: CE mark, manufacturer name and address, batch number, age warnings (crochets.site https://crochets.site/resources/amigurumi-safety-compliance-en71-cpsia-rules-testing-labels-explained).
- **US:** CPSIA + ASTM F963 (currently F963-23). Small-parts cylinder per 16 CFR 1501: **1.25 in wide × 2.25 in deep**. Small parts are banned for under-3s. Ages 3–6 need the "CHOKING HAZARD — Small parts. Not for children under 3 yrs." warning (ComplianceGate https://www.compliancegate.com/small-parts-regulations-warnings-united-states/).
- Use-and-abuse procedures are in 16 CFR 1500.51 (0–18 months) and 1500.52 (18–36 months) (same source). The exact US lbf tension values were **not verified** in this research.
- Other US requirements: third-party testing plus a Children's Product Certificate for toys for ages ≤ 12; lead ≤ 100 ppm substrate and ≤ 90 ppm coatings; phthalates ≤ 0.1%; permanent tracking label. Small-batch registration does **not** waive ASTM F963 small-parts testing (ShieldMyShop https://www.shieldmyshop.com/blog/2026-06-15-selling-handmade-toys-etsy-astm-f963-toy-safety-testing-cpc-rules).
- **Practical designer rule:** "Plastic eyes are almost never acceptable for 0–36 months; use embroidered features instead" (crochets.site, URL above; ShieldMyShop agrees).

### 5.8 Sizing: finished size from yarn weight and round count  [RULE OF THUMB + DERIVED]

**Linear size scales with stitch size.** PlanetJune: worsted/3.5 mm versus bulky/4.5 mm is about 3/4 versus full size; doubled strands with a larger hook give ≈ 1.5×; thicker yarn doubled can reach ≈ 2× (https://www.planetjune.com/blog/amigurumi-help/resizing-amigurumi/).

**Scale factor = pattern gauge ÷ your gauge.** Yarn quantity scales with the square of the linear factor (Crochet Girl Pau https://crochetgirlpau.com/how-to-scale-amigurumi-patterns/).

Crochet Girl Pau gauge reference (sc, stitches per 4 in / 10 cm): fingering 22–26, sport 20–24, DK 17–20, worsted 14–18, bulky 11–14, super bulky 8–11, jumbo 6–9. These are general figures; amigurumi-tight gauge is usually denser.

[DERIVED] Size formulas:
- **Flat piece:** diameter after k rounds ≈ `2·k·h`.
- **6n ball:** `D ≈ 6k/(π·g_s) ≈ 1.91·k·w`.
- **Cylinder:** height = `rounds·h`.
- **Figure height** = Σ over stacked parts (head diameter + body height + …), minus overlaps where parts are joined.

With the DK gauge above (w ≈ 0.53 cm, h ≈ 0.5 cm), each +6 increase round adds ≈ 1 cm to a ball's diameter.

### 5.9 Written pattern format  [CONSENSUS]

The standard line format is:

`Rnd N: <instruction sequence> (<total stitches>)`

- Repeats go in parentheses or asterisks with a multiplier: `(sc, inc) x6 (18)`, `*sc 2, dec* x6 (18)`.
- A range covers identical rounds: `Rnd 7–13: sc around (36)`.
- Loop qualifiers: `16 sc blo (16)`.

Examples: hookabee `3 sc, (inc, 6 sc) x5, inc, 3 sc (48)`; Knot Trying `R17: 16 sc blo (16)`. AmiGo's machine output folds repeats at three levels (rows, sequences, stitches), for example `rows 2-3: (sc, inc, 2sc)*3` (https://ar5iv.labs.arxiv.org/html/2211.01178).

---

## 6. Polygons in rounds

### 6.1 General rule  [DERIVED, confirmed by ReveDreams numbers]

For a regular n-gon worked from the centre, each round moves the apothem out by h. Perimeter `P = 2n·a·tan(π/n)`, so the flat increases per round are:

**Δ_n = 2n·tan(π/n) · (h/w)**

| Shape | Δ per round (h/w = 1) | ReveDreams "apothem formula" |
|---|---|---|
| triangle | 10.39 | 10.4 |
| square | 8.00 | 8 |
| pentagon | 7.27 | 7.3 |
| hexagon | 6.93 | 6.9 |
| octagon | 6.63 | 6.6 |
| circle (n → ∞) | 6.28 | — |

ReveDreams source: https://www.revedreams.com/crochet/yarncrochet/single-crochet-shaping-3-polygons/.

**Corners concentrate increases.** All Δ_n stitches are added at the n corners, in equal groups of Δ_n/n per corner, and they are deliberately **stacked** (the opposite of a circle). This is why a circle with stacked increases turns into a hexagon (§3.2): 6 stacked groups of +1 is a hexagon rule.

### 6.2 Squares  [CONSENSUS]

- **sc square:** R1 = 8 sc in MR. Each corner is `(sc, ch 2, sc)` in the corner, or `3 sc in corner st`. That is +2 per corner, so **+8 per round** (Nicki's Homemade Crafts https://www.nickishomemadecrafts.com/crochet-solid-granny-square/; Crochet Bits search summary). Start with multiples of 4.
- ReveDreams: squares use "3sc into corners" throughout (URL above).
- **Classic granny square (dc):** ch 4; R1 = `3 dc, ch 2` ×4 (12 dc). Corners are `(3 dc, ch 2, 3 dc)` in each corner space; sides get `3 dc` clusters in each space (often separated by ch 1). Each round adds one cluster per side (Yarnspirations https://www.yarnspirations.com/blogs/how-to/guide-to-granny-crochet-squares-circles-hearts-stripes-and-more).
  - [DERIVED] Per round: 4 corners × 3 dc = +12 dc, plus chain spaces. Consistent with Δ_4 = 8·(h/w) ≈ 8·1.5 for a clustered dc fabric; granny fabric is porous, so the chains absorb the difference.

### 6.3 Hexagons and pentagons

- **Hexagon (sc):** Δ ≈ 6.9, so "Make two 2sc increase rounds for every one 3sc increase round", starting from 6 (ReveDreams). Averages (6+6+12)/3 = 8 per round; ReveDreams reports that it works "reasonably well".
- **Granny hexagon:** starts with 12 dc (2 per side) with chain corners (Yarnspirations).
- **Pentagon (sc):** Δ ≈ 7.3. Start 5 sc in MR, 3 sc in each; next round 2 sc in the centre of each 3-sc group; next round 3 sc in the second of each 2-sc group; alternate, ending on a 3-sc round (ReveDreams).
- **Octagon:** mixed approach, with chains added in corners for definition (ReveDreams).
- **[CONTESTED/practical]** If even +1 per corner is too many for flatness (triangles and squares at some aspect ratios), use chains in corners or mixed stitch heights (ReveDreams).

---

## 7. Computational and academic work

### 7.1 AmiGo — Edelstein, Peleg, Itzhaky, Ben-Chen (SCF '22, 7th ACM Symposium on Computational Fabrication, Seattle, 2022)

Links: arXiv https://arxiv.org/abs/2211.01178 (HTML: https://ar5iv.labs.arxiv.org/html/2211.01178); ACM https://dl.acm.org/doi/10.1145/3559400.3562005; code https://github.com/karinsifri/AmiGo.

- **Input:** closed triangle mesh M, a seed vertex s, and a stitch width w.
- **Stitch assumption:** single crochet only, treated as an "approximately square stitch". Row edges and column edges should both have length w, so **h = w**.
- **Rows.** `f(v) = geodesic distance d(v, s)`; "the isolines of f are rows". Rows are sampled at intervals of w, from the seed (row 0 = a point) to the farthest point.
- **Columns / ordering.** A second function g orders stitches within a row. It is obtained by minimising `∫ |⟨J∇f, ∇g⟩ − 1|²` (J = 90° rotation), so g advances at unit speed along the rows. Sampling (f, g) on a 2D grid of spacing w gives stitch positions, which are projected to the mesh.
- **Column edges between consecutive rows** are computed with **Dynamic Time Warping (DTW)**, minimising the sum of 3D distances of the coupling. The stitch count per row is effectively `row_length / w`.
- **Increases and decreases.** If x > 1 stitches of row i couple to one stitch of row i+1, that is `dec(x)`; one-to-many is `inc(x)`. A transducer emits the instructions, and loop folding compresses repeats.
- **Branching.** Where f has saddle points or multiple maxima (limbs, ears), the surface is cut along saddle isolines into segments. The segments form a DAG, which is topologically sorted, and each segment is crocheted onto the last row of the previous one (join-as-you-go).
- **Curvature pre-processing.** Regions with positive Gaussian and negative mean curvature ("craters") are smoothed with conformal mean curvature flow. In regions of negative Gaussian curvature the sampling rate is adjusted via `h(x) = tanh(−x/α)/2 + 1`, with α = 10.
- **Creases** can be added with FLO/BLO rows.
- **Results:** 11 models, 30–60 rows, 365–3670 stitches, runtime 0.2–6.9 min. Outputs resemble the inputs more closely than Igarashi 2008 or Guo 2020.
- **Limitations:** closed surfaces only; thin segments are dropped; low resolution breaks symmetry; a single seed gives limited control. The public repo notes that "Branching meshes are not supported yet" (https://github.com/karinsifri/AmiGo). CLI parameter `--stitch_size`, e.g. 0.04 in mesh units.

**Takeaway for the designer:** rows are geodesic level sets spaced h apart; each row's stitch count is its length ÷ w; increases and decreases are the coupling between neighbouring rows. This is the general form of §0. For surfaces of revolution it reduces to the sine/lathe schedule.

### 7.2 Igarashi, Igarashi & Suzuki — "Knitting a 3D Model" (Computer Graphics Forum / Pacific Graphics 2008)

Links: https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1467-8659.2008.01318.x; PDF https://www-ui.is.s.u-tokyo.ac.jp/~takeo/papers/yuki_pg08_knit.pdf; project page https://www.is.ocha.ac.jp/~yuki/knit/index-e.html.

The method covers the surface with "parallel winding strips of constant width", then "samples the strip at constant intervals" to convert it into a knitting or crochet pattern. [From the PDF summary: strip width ≈ stitch height, sample spacing ≈ stitch width.] It targets rotund animal models, needs manual segmentation, and results often differ visually from the input (as characterised by the AmiGo paper). The companion work is "Knitty" (2008, sketch-based modelling of knitted animals).

### 7.3 Guo, Lin, Narayanan, McCann — "Representing Crochet with Stitch Meshes" (SCF '20)

Links: https://dl.acm.org/doi/10.1145/3424630.3425409; https://history.siggraph.org/learning/representing-crochet-with-stitch-meshes-by-guo-lin-narayanan-and-mccann/.

The paper extends Yuksel et al.'s 2012 stitch meshes (tile faces carrying yarn geometry, connected along typed edges) to crochet. It adds a new face vocabulary based on the Craft Yarn Council chart symbols, and edge types reflecting crochet's "single leading loop". This enables yarn-level visualisation and simulation. It is a representation, not a pattern generator from shapes.

### 7.4 Seitz, Lincke, Rein, Hirschfeld — "Language and Tool Support for 3D Crochet Patterns: Virtual Crochet with a Graph Structure" (HPI Technical Report 137, 2021)

Link: http://www.hpi.uni-potsdam.de/hirschfeld/publications/media/SeitzLinckeReinHirschfeld_2021_LanguageAndToolSupportFor3DCrochetPatternsVirtualCrochetWithAGraphStructure_HPI137.pdf (ResearchGate https://www.researchgate.net/publication/354744046_Language_and_tool_support_for_3D_crochet_patterns).

It contains a domain analysis of crochet, a **graph structure used as a DSL** (stitches as nodes, with connections to the previous stitch and to the parent stitch or stitches) and a projectional editor prototype. Related: "Digital Crochet: Toward a Visual Language for Pattern Description" (Onward! / SPLASH 2022, https://dl.acm.org/doi/10.1145/3563835.3567657). The PDF was too large to fetch, so stitch-dimension constants are not verified.

### 7.5 CrochetPARADE — Crochet PAttern Renderer, Analyzer, and DEbugger

Links: https://www.crochetparade.org/; manual https://www.crochetparade.org/Manual.html; code https://github.com/crochetparade/CrochetPARADE (GPLv3; primary repository on Codeberg).

- **Language:** each line is a row or round. `ring` = magic ring. `sc2inc`, `sc2tog` are generic `stitchNinc` / `stitchNtog`. `ss` joins. `DEF:` defines custom stitches, including `Copy(sc, height, width)` for custom dimensions (e.g. `narrow_sc=Copy(sc,1,0.8)`).
- **Simulation:** a physics-like, force-directed spring model. Connections have target lengths in chain-length units. It iterates (default 500 iterations, learning rate 0.1, inflate/repulsion, viscous relaxation) and "converges to within 10% of the requested stitch lengths". It flags overly loose or tight stitches.
- **Tools:** a sphere generator (circumference 7–1200 stitches, continuous rounds, distributes increases to "reduce symmetric bulges, especially near the poles"), and an axially-symmetric profile-curve editor that generates stitch-count schedules. Exports: charts, SVG, 3D files for Blender.

**Designer takeaway:** a spring-relaxation preview (target edge length = stitch w along rows and h across rows) is a cheap, proven way to show cupping, ruffling and polygonal artefacts before anyone crochets.

### 7.6 Avtanski — Crochet Sphere Calculator and Crochet Lathe (2012)

Links: http://avtanski.net/projects/crochet; math re-derivation https://bookworm3x4.github.io/crochet-sphere-calculator/sphere_math.html.

The sine-schedule sphere (formulas in §4.3) and a lathe tool: draw a profile and get a pattern for a surface of revolution. Both are cited by AmiGo.

### 7.7 Other work (secondary, abstracts only)

- **Nakjan et al. 2018**, "Automatic Crochet Pattern Generation from 2D Sketching" (IEEE; https://ieeexplore.ieee.org/document/8426123/). The user sketches dolls from 2D geometric primitives, which are converted to 3D shapes and then to amigurumi instructions (per the AmiGo related-work section).
- **Çapunaman et al. 2017.** UV-parameterisation-based stitch inference (cited in AmiGo).
- **Storck, Feldmann, Fiedler, Kyosev 2023**, "Numerical Optimization of Polygon Tessellation for Generating Machine-producible Crochet Patterns", Tekstilec (https://journals.uni-lj.si/tekstilec/article/view/15468). Tessellates 2D convex polygons into stitches under the increase/decrease constraints of the CroMat crochet machine.
- **Henderson & Taimina.** Hyperbolic crochet models (§4.8); annular-strip construction inspired by Thurston and Beltrami (Cabinet interview, URL above).

**Common assumptions across the literature:**
1. sc is approximately square (AmiGo explicitly; Unknown Orchard "about the same width and height, or slightly wider").
2. Rows are equidistant level sets, spaced by stitch height.
3. Stitch count = row length ÷ stitch width.
4. Increases and decreases come from matching adjacent rows (DTW in AmiGo; simple differences in lathe tools).
5. Stuffing is ignored or assumed to restore the intended geometry.

None of these works models yarn stretch under stuffing beyond CrochetPARADE's approximate 10% tolerance.

---

## 8. Common realism problems

| Problem | Cause | Detection (numeric) | Fix | Sources |
|---|---|---|---|---|
| **Cupping** (bowl-like when meant to be flat) | Too few increases: Δ < Δ_flat | Δ/Δ_flat < ≈ 0.85; K_enclosed > 0 and growing | Add increases; repeat earlier increase rounds; go up a hook size for outer rounds | CyCrochet https://cycrochet.com/article/cupping-and-other-problems-when-crocheting-a-round-circle; Shelley Husband; crochetcalc; Elephant Sun Dog https://www.elephantsundog.co.uk/2019/09/making-crochet-circle-troubleshooters.html |
| **Ruffling** (wavy "lettuce") | Too many increases: Δ > Δ_flat | Δ/Δ_flat > ≈ 1.3; K_enclosed < 0 | Work 1–2 rounds without increases, then resume; go down a hook size; check the count | Shelley Husband ("Skip increases for 1-2 rounds until flatness returns"); crochetcalc; catherinecrochets https://catherinecrochets.com/why-is-my-crochet-circle-curling/ |
| **Polygon / hexagon look** | Increases stacked in the same positions | Increase position offset identical round to round | Stagger (§3.2) | hookabee; Henlo Home; Fox Creations |
| **Visible increase / decrease lines; spiral arms** | Stacking plus the natural stitch skew in spirals | Same as above | Stagger; invisible decrease | hookabee; Shelley Husband; "and she laughs" |
| **Spiral drift / seam slant** | Each stitch sits slightly offset; joins migrate right (right-handers) | Inherent | Accept; use a marker; for joined rounds, turn each round or accept the diagonal seam | Joanna's Crochet; PlanetJune |
| **Color jog** | Spiral step at the round start | Color change at a round boundary in a spiral | sl st fix or BLO lock | Crochet Arcade; The Nicole Chase |
| **Large-circle ruffle despite a correct Δ** | Tension drift and accumulated rounding | Many rounds (> ≈ 15) | Stop increasing early or space increases; block | Dora Does |
| **Lumpy / flattened sphere** | Too few or too many even rounds; stacked decreases; uneven stuffing | Total rounds vs `πD/2·g_r` | Use the sine schedule or k+1 even rounds; stagger; stuff firmly and evenly | Supergurumi; Crocheo; Unknown Orchard |

The thresholds (0.85 / 1.3) are **[RULE OF THUMB, DERIVED]**. They come from ReveDreams' observations in sc: 5–6 cup, 7–8 flat, 9 crowding, 10 ruffle, i.e. flat ≈ 7.5 → cup below ≈ 0.8×, ruffle above ≈ 1.3× (https://www.revedreams.com/crochet/yarncrochet/single-crochet-shaping-1-cones-ruffles/). Fabric is forgiving within about ±10–15%.

---

## 9. Encodable rules / algorithms

Each rule below is written so a program can implement it directly. Units: `w`, `h` in cm; counts are integers.

### 9.0 Stitch model

```
StitchSpec { name, heightRatio h/w, turningChain }
defaults: sc 1.0 (range 0.85–1.0), hdc 1.35, dc 2.0, tr 2.5   // overridable by gauge
Gauge { stPerCm g_s, rowsPerCm g_r }  -> w = 1/g_s, h = 1/g_r
deltaFlat(stitch) = 2π · h/w
niceStart: sc→6, hdc→8, dc→12, tr→16 (or round(deltaFlat))
```

Counting invariants, checked for every round:

```
prevConsumed = Σ over ops: sc→1, inc(k)→1, dec(k)→k, sl st→1, skip→1
produced     = Σ over ops: sc→1, inc(k)→k, dec(k)→1, ch-sp→(as defined)
```

- prevConsumed must equal S_{k−1} (the whole previous round is worked exactly once, for closed rounds).
- produced = S_k.
- An increase can produce at most 2 stitches per stitch in normal amigurumi (inc = 2 in 1), so **S_k ≤ 2·S_{k−1}**. A dec combines 2 (rarely 3), so **S_k ≥ S_{k−1}/2**.

### 9.1 `generateCircleRounds(stitch, rounds, start = niceStart(stitch), stagger = true)`

```
R1: `${start} ${stitch} in MR` (start)
R2: `inc x${start}` (2·start)
for k ≥ 3:
   g = k − 2                       // stitches between increases
   total = start·k
   if stagger and k is even and g ≥ 2:
        a = floor(g/2); b = g − a
        `${a} st, (inc, ${g} st) x${start−1}, inc, ${b} st` (total)
   else:
        `(${g} st, inc) x${start}` (total)
```

Verified output: R4 `1 sc, (inc, 2 sc) x5, inc, 1 sc (24)` … R8 `3 sc, (inc, 6 sc) x5, inc, 3 sc (48)`. This exactly matches hookabee.

A better general variant is `distribute(S_prev, nInc, offset)`. It places increases at positions `round((j + φ)·S_prev/nInc)` for j = 0..nInc−1, with phase φ = 0.5 on alternating rounds, or φ = (k·0.618) mod 1 using a golden-ratio rotation for maximum spread. The same function handles decreases.

### 9.2 `generateSphere(D_cm, gauge, mode = "sine" | "6n", stagger = true)`

**6n mode:**

```
k = max(2, round(π·D·g_s / 6))
rounds = inc 1..k (6k), even × E, dec k−1..1, close
E = round(3k·(g_r/g_s)) − (2k − 1)      // = k+1 when g_r = g_s
```

Report the actual diameter `6k/(π·g_s)`.

**Sine mode:**

```
n = round(πD/2 · g_r)
S_i = round(π·D·g_s · sin(π(i − ½)/n))
then post-process:
   S_1 = max(S_1, 6)
   S_i ≤ 2·S_{i−1}
   S_i ≥ ceil(S_{i−1}/2)
   last row ≥ 6, then close
   smooth any non-monotone blip
```

Then emit each row with `distribute()` (staggered). Report fit r² as in bookworm3x4.

Worked check: D = 6, g_s = 1.9, g_r = 2.0 gives 6n: k = 6, E = 7, 18 rounds. Sine: n = 19, peak 36.

### 9.3 `generateRevolution(profile r(s), gauge)` — lathe (eggs, bodies, vases, hemispheres, torus)

```
L = arc length of profile
n = round(L·g_r)
s_i = (i − ½)·L/n
S_i = round(2π·r(s_i)·g_s)
apply the clamps from 9.2
start = MR if r(0) ≈ 0, else a chain ring of S_0
end   = close if r(L) ≈ 0, else leave open (for joining/sewing)
```

Special cases:
- **Cylinder:** r = const, so every round has S = round(πD·g_s).
- **Cone** (base D, slant L): `Δ = 2π(h/w)·(D/2)/L` per round. Fractional Δ is spread with an error accumulator (Bresenham): add `floor(acc += Δ)` increases per round.
- **Hemisphere:** first ⌈n/2⌉ rows of the sphere.
- **Flat base:** mark the transition round (where the profile turns ≥ ~60°) as BLO.

### 9.4 `generateOval(chainLen L, stitch, rounds)`

```
R1 = (L−1) st along chain, (endInc) in last ch, (L−2) st along underside, (endInc−1) in first ch
endInc = 3 for sc (4 for dc per bHooked)
each later round: Δ_flat/2 increases spread evenly over each curved end
straight segments unchanged except for the natural +1 shift per round
```

Validate totals by recomputation.

### 9.5 `generatePolygon(nSides, stitch, rounds)`

```
Δ = 2·n·tan(π/n)·(h/w)
per corner: c = Δ/n
if c is an integer: stack c extra stitches at each corner every round
else: alternate corner groups (e.g. hexagon sc: 2-in-1, 2-in-1, 3-in-1 cycle)
      or add ch-sp corners (granny style)
do NOT stagger (corners must stack)
```

### 9.6 Validation / diagnostics — `analyzeRounds(S[], stitch, gauge, intent)`

```
Δ_k   = S_{k+1} − S_k
ρ_k   = Δ_k / deltaFlat
K_enc(k) = 2π − Δ_k·(w/h)                         // [DERIVED Gauss–Bonnet]
radius_k = S_k·w / (2π)                            // implied 3D radius if rotationally symmetric

intent = flat: ρ < 0.85 for ≥ 2 consecutive rounds → "CUPPING"
               ρ > 1.3                             → "RUFFLING"
intent = 3D:   |radius_{k+1} − radius_k| > h       → "IMPOSSIBLE SLOPE" (the fabric would need to be longer than a row to span the change)
               this implies ρ must stay in [−1, 1] relative to deltaFlat
               for a smooth surface of revolution
```

Further checks:
- Constant ratio `S_{k+1}/S_k = c > 1` over many rounds → "HYPERBOLIC/RUFFLE (exponential growth)", with estimated `R ≈ h/ln(c)`.
- Increase positions identical (mod S) for ≥ 3 consecutive rounds → "STACKED INCREASES → polygon / visible lines". Suggest stagger.
- Spiral with a color change at the round start → suggest a jog fix.
- Closed shapes with stuffing and an age tag of < 36 months → forbid safety eyes and beads; suggest embroidered features.

### 9.7 Size estimation — `estimateSize(parts)`

```
flat disc diameter ≈ 2·rounds·h
ball diameter      ≈ S_max·w/π
tube height        ≈ rounds·h
figure height      ≈ Σ stacked part heights − joint overlaps (≈ 1–2 rows per joint, rule of thumb)
yarn ∝ total stitches · (stitch yarn length); scales with (scale factor)^2
```

Scale an existing pattern by gauge ratio (Crochet Girl Pau): `newSize = oldSize · (g_pattern / g_user)`.

### 9.8 Pattern text emission

- `Rnd {k}: {ops} ({S_k})`.
- Fold identical consecutive rounds into `Rnd a–b`.
- Fold repeats as `(…) x n`, with a remainder prefix and suffix for staggered rounds.
- Loop qualifiers `blo` / `flo`.
- `sc`, `inc`, `dec` (invisible dec recommended for amigurumi), `MR`, `sl st`, `ch`.
- Mark "insert safety eyes" and "begin stuffing" at the round where the remaining opening is ≈ 1/2 of S_max. [RULE OF THUMB]

---

## 10. Consensus vs rules of thumb vs contested (summary)

**Consensus**
- Flatness requires Δ ≈ 2π·h/w per round, which gives ≈ 6 for sc and ≈ 12 for dc.
- The magic ring is preferred for amigurumi.
- Spiral rounds are the default for sc amigurumi, and joined rounds for dc and motifs.
- Stacked increases give polygons, and staggering fixes it.
- Use the invisible decrease for amigurumi.
- Cones come from Δ < 6 constant; tubes from Δ = 0; hyperbolic from a constant ratio.
- Squares add +8 per round for sc (+2 per corner).
- EN 71 and ASTM F963/CPSIA apply to sold toys; no plastic eyes under 36 months.

**Rules of thumb**
- hdc starts with 8, tr with 15–16.
- A 6n ball needs k+1 even rounds.
- Hook 2 mm below the band recommendation for amigurumi.
- Cup/ruffle thresholds of ≈ 0.85× and 1.3×.
- Egg = extra even rounds + slow (−3) decreases.
- BLO round for a flat base.

**Contested / variable**
- sc aspect ratio: square versus slightly wider than tall. sc flat Δ reported as 6 (most sources), 6–7 (Dora Does) or 7–8 (ReveDreams).
- Even rounds in a sphere: k+1 (Supergurumi), k (Pulled Stitch), 3–4 (MrsCrochetWorld), 1 (FiberTools).
- Whether staggering alone removes spiral arms.
- Yarn-under versus yarn-over effect on slant.
- Exact US tension-test lbf values (not verified here). The EN 71 50 N small-part figure is from a secondary source only.

---

## Sources (fetched or cited)

1. ReveDreams — sc shaping 1 (cones to ruffles): https://www.revedreams.com/crochet/yarncrochet/single-crochet-shaping-1-cones-ruffles/
2. ReveDreams — sc shaping 3 (polygons): https://www.revedreams.com/crochet/yarncrochet/single-crochet-shaping-3-polygons/
3. Dora Does — flat circle in any stitch: https://doradoes.co.uk/2020/12/12/how-to-crochet-a-flat-circle/
4. Shelley Husband — circle formula: https://shelleyhusbandcrochet.com/the-secret-crochet-circle-formula-and-how-to-tweak-it/
5. The Pulled Stitch — circles, bowls, spheres: http://pulledstitch.blogspot.com/2021/11/how-to-crochet-circles-bowls-and-spheres.html
6. Just Be Crafty — flat circle: https://justbcrafty.com/how-to-crochet-a-flat-circle/
7. crochetcalc — crochet in the round: https://crochetcalc.com/articles/how-to-crochet-in-the-round.html
8. PlanetJune — magic ring: https://www.planetjune.com/blog/amigurumi-help/how-to-crochet-a-magic-ring/
9. PlanetJune — resizing amigurumi: https://www.planetjune.com/blog/amigurumi-help/resizing-amigurumi/
10. PlanetJune — front/back/both loops: https://www.planetjune.com/blog/front-loops-back-loops-both-loops/
11. PlanetJune — better BLO: https://www.planetjune.com/blog/tutorial-better-blo-stitches-for-amigurumi/
12. Joanna's Crochet — spiral vs joined: https://www.joannascrochet.com/2025/10/spiral-vs-joined-rounds-explained-which.html
13. crochet.com — joining vs magic circle: https://www.crochet.com/learning-center/joining-round-vs-magic-circle
14. hookabee — preventing increase lines: https://hookabee.com/2015/08/24/how-to-prevent-increase-and-decrease-lines-on-your-amigurumi/
15. Henlo Home — circles look like hexagons: https://henlohome.com/help-my-crochet-circles-look-like-hexagons/
16. and she laughs — staggered increases/decreases: https://www.andshelaughsblog.com/crocheting-perfect-circle-staggered-increases-decreases/
17. Fox Creations — staggered increases: https://foxcreations.com.au/amigurumi-101/how-to-crochet-a-perfect-circle-with-staggered-increases/
18. Supergurumi — balls and spheres: https://www.supergurumi.com/crochet-shapes-crochet-balls-and-spheres
19. Supergurumi — cones: https://www.supergurumi.com/how-to-crochet-cones-in-spiral-rounds
20. Shiny Happy World — cones: https://www.shinyhappyworld.com/2010/11/crochet-cone-shapes-amigurumi.html
21. Crocheo — sphere math: https://crocheo.net/blog/crochet-spheres
22. bookworm3x4 — sphere calculator math: https://bookworm3x4.github.io/crochet-sphere-calculator/sphere_math.html
23. Avtanski — crochet sphere calculator / lathe: http://avtanski.net/projects/crochet
24. The Unknown Orchard — spherical crochet: http://theunknownorchard.blogspot.com/2015/08/understanding-spherical-crochet-and.html
25. FiberTools — amigurumi shapes: https://fibertools.app/amigurumi-shapes
26. Crafting Happiness — egg in 3 sizes: https://craftinghappiness.com/free-crochet-easter-egg-shape-pattern-in-3-sizes/
27. Knot Trying — flat base: https://www.knottrying.com/blog/give-your-amigurumi-a-flat-base
28. Treasurie — oval: https://blog.treasurie.com/how-to-crochet-an-oval/
29. All About Ami — around a foundation chain: https://www.allaboutami.com/foundationchain/
30. All About Ami — invisible decrease: https://www.allaboutami.com/invisibledecrease/
31. bHooked — oval chart: https://bhookedcrochet.com/2017/07/02/crochet-oval/
32. Hello Yellow Yarn — invisible decrease: https://helloyellowyarn.com/2016/02/12/tutorial-invisible-decrease-in-crochet/
33. Crochet Arcade — jogless stripes in spiral: https://www.crochetarcade.co.uk/jogless-stripes-color-change-for-single-crochet-worked-in-a-spiral/
34. The Nicole Chase — invisible color change: https://www.thenicolechase.com/blog/color-changes
35. Littlejohn's Yarn — jogless stripes: https://littlejohnsyarn.com/crochet-jogless-stripes-in-1-minute-amigurumi-hacks/
36. Octopus Crochet — amigurumi gauge: https://octopuscrochet.com/what-is-gauge-in-crochet-and-how-to-use-it-for-amigurumi/
37. Tiny Curl — amigurumi hook size: https://www.tinycurl.co/amigurumi-hook-size/
38. Crochet Girl Pau — scaling amigurumi: https://crochetgirlpau.com/how-to-scale-amigurumi-patterns/
39. Nicki's Homemade Crafts — solid granny square: https://www.nickishomemadecrafts.com/crochet-solid-granny-square/
40. Yarnspirations — granny guide: https://www.yarnspirations.com/blogs/how-to/guide-to-granny-crochet-squares-circles-hearts-stripes-and-more
41. Cabinet — interview with Henderson & Taimina: https://www.cabinetmagazine.org/issues/16/wertheim_henderson_taimina.php
42. AMS Mathematical Imagery — Taimina: https://www.ams.org/publicoutreach/math-imagery/taimina
43. Bridges 2022 gallery — Taimina: https://gallery.bridgesmathart.org/exhibitions/2022-bridges-conference/daina
44. Start Crochet — hyperbolic crochet: https://startcrochet.com/ultimate-beginners-guide-to-hyperbolic-crochet/
45. AmiGo (arXiv / ar5iv / ACM / GitHub): https://arxiv.org/abs/2211.01178 , https://ar5iv.labs.arxiv.org/html/2211.01178 , https://dl.acm.org/doi/10.1145/3559400.3562005 , https://github.com/karinsifri/AmiGo
46. Igarashi et al. 2008 — Knitting a 3D Model: https://onlinelibrary.wiley.com/doi/abs/10.1111/j.1467-8659.2008.01318.x , https://www-ui.is.s.u-tokyo.ac.jp/~takeo/papers/yuki_pg08_knit.pdf
47. Guo et al. 2020 — Representing Crochet with Stitch Meshes: https://dl.acm.org/doi/10.1145/3424630.3425409 , https://history.siggraph.org/learning/representing-crochet-with-stitch-meshes-by-guo-lin-narayanan-and-mccann/
48. Seitz et al. 2021 — Language and tool support for 3D crochet patterns: http://www.hpi.uni-potsdam.de/hirschfeld/publications/media/SeitzLinckeReinHirschfeld_2021_LanguageAndToolSupportFor3DCrochetPatternsVirtualCrochetWithAGraphStructure_HPI137.pdf
49. Digital Crochet (SPLASH Onward! 2022): https://dl.acm.org/doi/10.1145/3563835.3567657
50. CrochetPARADE — site, manual, repo: https://www.crochetparade.org/ , https://www.crochetparade.org/Manual.html , https://github.com/crochetparade/CrochetPARADE
51. Nakjan et al. 2018 — Automatic Crochet Pattern Generation from 2D Sketching: https://ieeexplore.ieee.org/document/8426123/
52. Storck et al. 2023 — Polygon tessellation crochet (Tekstilec): https://journals.uni-lj.si/tekstilec/article/view/15468
53. crochets.site — amigurumi EN71/CPSIA compliance: https://crochets.site/resources/amigurumi-safety-compliance-en71-cpsia-rules-testing-labels-explained
54. crochets.site — yarn under vs yarn over: https://crochets.site/resources/yarn-under-vs-yarn-over-amigurumi-stitch-slant-twist-tension-handedness
55. Centexbel — EN71-1 §8.4 tension test: https://www.centexbel.be/en/problem-solving/testing/tension-test-according-en71-1-ss84
56. Mecmesin — toy attachment strength: https://www.mecmesin.com/publications/toy-testing-attachment-strength-safety-standards
57. JJR Lab — EN 71 vs ASTM F963: https://www.jjrlab.com/news/what-are-the-differences-between-en-71-and-astm-f963.html
58. ComplianceGate — US small parts: https://www.compliancegate.com/small-parts-regulations-warnings-united-states/
59. ShieldMyShop — ASTM F963 for handmade toys (2026): https://www.shieldmyshop.com/blog/2026-06-15-selling-handmade-toys-etsy-astm-f963-toy-safety-testing-cpc-rules
60. CyCrochet — cupping: https://cycrochet.com/article/cupping-and-other-problems-when-crocheting-a-round-circle
61. Elephant Sun Dog — circle troubleshooting: https://www.elephantsundog.co.uk/2019/09/making-crochet-circle-troubleshooters.html
62. Catherine Crochets — circle curling: https://catherinecrochets.com/why-is-my-crochet-circle-curling/
63. Two Little C's — cones: http://two-little-cs.blogspot.com/2015/04/day-11-crocheting-cones.html

*Source caveat:* some claims were taken from search-result summaries rather than full page reads. These are marked "search summary", and the 50 N figure and the Fox Creations wording are among them. The ACM full-text and some PDFs (AmiGo arXiv PDF, Seitz, NC Art Museum reef guide) were blocked or too large. AmiGo details come from the ar5iv HTML rendering of the same paper.
