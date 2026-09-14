# 06 — Crochet Software, Formal Models, DSLs, Datasets & Expert-Knowledge Capture

Research for: Dragonette Crochet pattern designer (app.dragonettecrochet.com, vanilla TypeScript + canvas)
Date of research: 2026-09-14
Scope: existing tools, formal notations/DSLs, academic models, a recommended data model, a protocol for capturing an experienced crocheter's empirical knowledge, and public data sources.

---

## 0. How to read this report

- **Facts** are tagged with a source ID such as **[S12]**. Each ID maps to exactly one URL in the source list (§9). Where a claim comes only from a search-engine snippet rather than a page I fetched and read, it is marked *(snippet)* and should be re-checked before anyone relies on it. That matters most for prices.
- **Synthesis / recommendations** (my own reasoning, not claims made by a source) sit in blocks marked **▶ Synthesis**.
- **Research limits:**
  - The session's web-search quota ran out near the end. A few items could not be verified: "Crochet.Design" (no product by that name was found), Ravelry's developer API terms (they sit behind a login), and one 2026 Springer paper (paywalled).
  - Several ACM Digital Library full texts returned HTTP 403. Where that happened I used the arXiv or preprint version, or the ACM abstract.

---

## 1. Executive summary

1. **No commercial tool treats crochet as a stitch graph.** The mainstream tools fall into two groups:
   - **Grid/pixel editors:** Stitch Fiddle, Chart Minder, Hookchart's grids [S5][S6][S9][S10][S12].
   - **Free symbol-placement drawing tools:** Crochet Charts, the Crochet Chart iOS app, Adobe Illustrator with crochet fonts [S7][S8][S13][S61].

   In both groups the tool "has no understanding of" which stitch is worked into which. Seitz et al. put it this way: in chart editors "the arrangement of stitch symbols is purely graphical" [S20].
2. **The stitch-graph idea is well established in research and open-source DSLs**, and all versions share the same core: nodes are stitches or insertion points, with a *sequence* ("previous"/"next") edge and one or more *insertion*/"anchor"/"parent" edges.
   - CrochetPARADE: top/bottom nodes plus attachments [S2][S3]
   - Digital Crochet (Seitz et al., Onward! 2022): insertion-point nodes with previous / insertion / slip-stitch edges [S20]
   - AmiGo: a Crochet Graph with row and column edges [S16]
   - stitch-grapher: NEXT and PARENT edges [S22]
   - KnitPick's KnitGraph for knitting [S27]
3. **CrochetPARADE is the most complete open implementation.** It has a grammar, a parser, validation, a 3D physics layout, loose/tight stitch detection, and SVG chart export [S1][S2].
   - Licensing: the code is GPLv3, the manual is CC BY-NC-SA, and the grammar itself is public domain [S2].
   - ▶ The grammar is a good import/export target, but embedding its code in a closed-source product would bring GPL obligations.
4. **LLMs are unreliable crochet generators.**
   - In CrochetBench (Notre Dame, 2025), the best model compiled only 52.1% of *single steps* into valid CrochetPARADE code. Closed models "rarely exceed 6% project-level compilation success" [S4].
   - Popular tests show stitch-count mismatches between parts that must be joined (a 30-stitch cap on a 16-stitch stem), flattened spheres, and missing assembly steps [S44][S43].
   - ▶ A validator-first architecture, where every generated or parsed pattern is checked against the stitch graph, is the main way to stand apart from these tools.
5. **Gauge-driven geometry is a solved problem mathematically, but it needs calibration data.**
   - A flat disc needs about 2πH/W extra stitches per round, where H and W are stitch height and width. For square stitches that gives the familiar "6 increases per round" [S51].
   - Spheres need 2πS·sin(Hℓ/S)/W stitches at round ℓ for a sphere of radius S [S51].
   - These models are "quite sensitive" to real stitch height and width, and a *tube* swatch is recommended for work in the round [S51].
   - ▶ So the crocheter's empirical knowledge is most valuable as **measured per-stitch height and width per yarn and hook**, plus **rules about when theory and practice diverge**.
6. **Proven elicitation methods exist.**
   - Cognitive Task Analysis: interviews, think-aloud, Critical Decision Method [S55][S56]
   - Video-based "expert learner" craft elicitation (Wood et al.) [S54]
   - Think-aloud studies with professional crochet designers [S20]
   - The pattern-tester and tech-editor workflow already used across the industry [S58][S59]

---

## 2. Existing crochet / knitting design software

### 2.1 Comparison table

| Tool | Platform | Underlying model | Crochet-specific capabilities | Written instructions | Pricing (verify) | Open source? |
|---|---|---|---|---|---|---|
| **Stitch Fiddle** | Web (plus Android/iOS) | Grid; also lets you "place individual crochet stitch symbols on a grid" or "draw and arrange stitches more freely" [S5 (snippet)] | Stitch aspect ratio can match gauge; photo-to-grid; yarn colorways; progress tracker [S6]. In 2016 it had only 21 symbols and no custom symbols [S8] (it has grown since) | Row-by-row written instructions (paid) [S6], generated from grid colours, not stitch topology | Free basic tier; Premium about $33/year prepaid, non-renewing [S5 (snippet)] | No |
| **Crochet Charts** (Stitch Works Software) | Desktop (Win/Mac/Linux) | Free symbol placement; wedge lines for round charts [S7] | 109 stitches/symbols, custom stitch library, grouping, row/round numbering, export to PDF/SVG/JPG/PNG/TIFF/BMP [S7] | No | Free | Yes: GPLv3 since Sept 2015; development stopped in 2015 [S7] |
| **Chart Minder** | Web | Square grid [S10] | Colourwork, "rainbow crochet", gauge calculator, measurements update to gauge, stitch-view preview [S9][S10] | Not documented | Free; Pro about £1.25/month billed annually [S9 (snippet)] | No |
| **Hookchart** | Android (tablet-first) | Square and radial (round) grids; each symbol can be freely rotated [S12] | 10 standard symbols; fill a whole row/round; duplicate a round; Premium adds symmetry/mandala mode, "automatic even increases and decreases around a round", and custom symbols [S12] | "Written pattern and notes" field (apparently manual) [S12] | Free; Premium as lifetime or yearly [S12] | No |
| **Crochet Chart** (iOS) | iPhone/iPad | Free placement with circle/rectangle/oval/spiral guides and rotation snaps [S13] | 70+ symbols incl. Tunisian and Brioche; PDF with legend [S13] | Not described [S13] | Freemium; Pro unlocks everything [S13] | No |
| **Adobe Illustrator + crochet symbol fonts/brushes** | Desktop | Pure vector drawing | Full freedom; many designers use it; symbols drawn or taken from fonts such as StitchinCrochet ($3–6) [S8][S61] | No | Adobe subscription | No |
| **knitCompanion** | iOS/Android | PDF pattern overlay plus trackers (not a design tool) | Row/position tracking, counters, "at the same time" reminders, markup [S11 (snippet)] | Reads existing PDFs | Free Basics; paid about $9.99/year [S11 (snippet)] | No |
| **CrochetPARADE** | Web (runs locally in the browser) | **Stitch graph + physics simulation** [S1][S2] | Grammar; validation; 2D/3D render; loose/tight stitch detection; SVG symbol chart export; GLTF/DOT export [S1][S2] | The DSL *is* the written form; plain-text export [S2] | Free | Yes: GPLv3 code, CC BY-NC-SA manual, public-domain grammar [S2] |
| **Amigurumio** | Web | Parametric templates: mix-and-match heads, ears, bodies, limbs [S14] | Colour customisation; proportional pieces [S14] | PDF pattern by e-mail [S14] | Free PDF; premium colour PDF [S14] | No |
| **AmiGo** (research) | Python | Crochet Graph from a 3D mesh [S15][S16] | Mesh → amigurumi sc/inc/dec; join-as-you-go segmentation [S16] | Text "folded" stitch instructions [S15] | Free | Code CC BY-NC-SA 4.0 (non-commercial); "branching meshes are not supported yet" in the repo [S15] |
| **StitchFlow** (research, UIST '25) | Motion sensor + GUI | Tracks stitches in real time from hand gestures [S47] | View/edit/combine designs [S47] | Exports "written patterns, crochet charts, or interactive flows" [S47] | n/a | n/a |
| **Digital Crochet editor** (research, Onward! '22) | Prototype | Visual graph language [S20] | 2D editing + 3D force layout; auto-completion of repeats [S20] | — | n/a | n/a |
| **AI "crochet pattern generators"** (Pokecut, LightX, OpenArt, Vondy, etc.) | Web | Image generation or LLM text | Pokecut: "preview detailed pattern images" [S46]; Vondy claims "stitch-by-stitch instructions" [S46b (snippet)] | Unvalidated LLM text | Mostly free/freemium | No |
| **Stitchly** | Mobile | Cross-stitch grid [S62] | None: it is a **cross-stitch** app, not crochet [S62] | — | One-time purchase [S62] | No |
| **Knitting references:** Stitch Maps, EnvisioKnit, Knotty | Web/desktop/Racket | Stitch Maps: gridless, geometry-aware charts [S30]. EnvisioKnit: parses written stitch text into charts [S29]. Knotty: DSL with Knitspeak import/export [S28] | Knitting only | Knotty outputs HTML with an interactive chart plus written instructions [S28] | — | Knotty: GPL-3.0 [S28] |

**Not found / unverified:**
- "Crochet.Design": no product by that name turned up in searches.
- "Ravelry pattern tools": no pattern design or charting tool from Ravelry turned up. The Ravelry API exposes pattern *metadata* only (§6.1).

### 2.2 Notes per tool

- **Crochet Charts (Stitch Works).**
  - Edie Eckman, a professional crochet designer, praised the freeform placement and 109 stitches but found "sporadic support and updates" and said it lacks "features needed to be a robust choice for the professional crochet designer" [S8].
  - The GitHub README says it was left in the state it was in when development stopped in 2015 [S7].
  - ▶ Worth studying as a symbol library and UI reference (it is GPLv3, so do not copy the code into a closed product).
- **Professional designer needs, according to Eckman:**
  - Handling "stitch height variations, directional changes, and organic curves".
  - Grouping, rotation, multiple colours, and robust symbol libraries [S8].
- **Illustrator workflow.** Designers value the freedom to "manipulate, rotate, and place" symbols "without constraint" and to build custom stitches [S61].
  - ▶ This is the bar for chart quality that professionals will compare against. A structured tool has to produce equally beautiful charts while adding correctness.
- **Hookchart** is the only consumer app found that advertises *automatic even distribution of increases/decreases around a round* [S12]. That is a first step toward stitch semantics, but it still sits on a radial grid.

### 2.3 AI-generated crochet patterns: known failures and why

- **Viral examples.** In 2023 crocheters shared results from ChatGPT patterns: a "walrus" that turned out "narwhal-ish", "shockingly very accurate while still being very, very wrong", and animals with eyes "at least half the size of their body" [S43 (snippet)][S45 (snippet)].
- **Systematic hobbyist test (AB Crafty, ChatGPT vs Gemini)** [S44]:
  - *Stitch-count mismatch at a join:* the mushroom cap ended with 30 stitches but the stem top with 16, and there were no instructions for joining them.
  - *Proportion errors:* the ball had "only 2 middle rows of 24 stitches", so it flattened into "a macaron or a coin pocket".
  - *Correct counts, wrong shape:* Gemini's mushroom counts were "mathematically correct" but the result looked like "a doorknob".
  - *Missing information:* which yarn colour to sew with; forgotten constraints (the catnip cat toy).
- **Academic benchmark: CrochetBench** (Li, Huang, Chawla, University of Notre Dame, arXiv 2511.09483) [S4]:
  - The dataset has 6,085 Yarnspirations patterns. Four tasks: stitch recognition, instruction selection, instruction generation, and NL→CrochetPARADE DSL translation.
  - Stitch recognition: best F1 was 0.61 (Claude Sonnet 4).
  - Instruction generation: best BLEU was 0.048.
  - DSL translation, step level: at best 52.1% of outputs compiled.
  - DSL translation, project level: closed models "rarely exceed 6%" compilation success. "Syntax errors (e.g., undefined stitches, malformed brackets) dominate in open models."
- **Why it fails.** "A language AI doesn't know how to crochet. It only knows how humans talk about crochet" [S43 (snippet)]. Crochet correctness depends on exact arithmetic ratios and spatial reasoning [S44].

> **▶ Synthesis — implications for Dragonette**
> - Never ship LLM output without running it through the stitch-graph validator and the geometry predictor.
> - If an LLM is used at all, keep it in narrow roles: drafting prose (intro text, finishing notes), translating HU↔EN phrasing, or suggesting a DSL fragment that is then compiled and validated. That mirrors CrochetBench's "executable evaluation" idea [S4].
> - "Our patterns are computed and checked, not guessed" is a credible market position given the public backlash [S43][S45].

---

## 3. Formal languages, DSLs, notations

### 3.1 CrochetPARADE (Crochet PAttern Renderer, Analyzer, and DEbugger)

**Facts (from the manual [S2] and the GitHub manual [S3]):**

- **Purpose.** The grammar is meant to avoid "the ambiguities encountered with instructions in plain English". It parses and checks patterns, builds a virtual model, and renders it in 3D. It identifies overly loose or tight stitches and exports an SVG symbol chart plus an SVG of stitch connections labelled by type, row, and position [S1].
- **Stitches:** `ch sc hdc dc tr dtr trtr ss` [S2].
- **Modifiers:**
  - loop choice: `scbl`, `scfl`
  - post stitches: `fpdc`, `bpdc`
  - increases and decreases: `sc2inc`, `sc2tog`
  - skip `sk`, `turn`, `picot3` [S2]
- **Repeats:** `10*sc`, `3*[sc,dc]`, `[10sc,turn]*3` [S2]
- **Rows.** One line = one row/round; `turn` must be the last element of a row; `...` continues a line [S2].
- **Labels and anchors:**
  ```
  5ch.A,dc,2ch,2sc@A        # .A labels a group, @A works into it
  @[2,10]                   # row 2, stitch 10
  @[-1,3]                   # previous row, stitch 3
  @[@+1]                    # one stitch after the last attachment point
  .A!  .A^  @A~  @A[;1]     # skip border stitches / attach to the post / reverse order / set order
  ```
  When stitches are spread over a labelled group, "hidden nodes will be created in between" if the positions do not match existing nodes [S3].
- **Custom stitches:**
  ```
  DEF: p=3ch,ss@5[%,-4]                # alias (picot)
  DEF: narrow_sc=Copy(sc,1,0.8)        # copy with modified height
  DEF: name=&comment^top_nodes:bottom_nodes~attachments:other_nodes:connections
  ```
  - "Top nodes" are "the top of a crochet stitch" where "the hook is inserted".
  - "Bottom nodes" are "the attachment points … which are the top nodes of other stitches previously made".
  - Connections are "a pair of node names separated by a `-`, with a length value in between" [S3].
  - ▶ So each stitch is a small sub-graph of nodes joined by edges with **rest lengths**. That is effectively a spring model, although the manual does not name the solver [S3].
- **Layout engine parameters (`DOT:`):** `iterations` (default 500), `start` (random seed), `inflate` (repulsion between distant nodes), `learning_rate`, `viscous_iterations`. Node positions can be pinned [S2].
- **Validation errors enforced:**
  - labelled groups must be adjacent stitches
  - attachments must refer to already-crocheted stitches
  - `turn` must come last in a row
  - relative attachments need prior initialisation [S2]
- **Exports:** SVG chart, GLTF (Blender), DOT graph, plain text [S2].
- **Implementation:** JavaScript with SVG.js and three.js; runs locally; the main repository is on Codeberg [S1]. Large patterns with "(tens of) thousands of stitches can take minutes or more to calculate" [S3].
- **Licence:** code GPLv3; manual CC BY-NC-SA; grammar public domain [S2].

### 3.2 Digital Crochet: a visual graph-based language (Seitz, Rein, Lincke, Hirschfeld, Onward! 2022)

**Facts [S20]** (preprint read in full):

- **Motivation.**
  - Existing notations "are either ambiguous or limited in their expressiveness".
  - Grid "crochet graphs" (filet/colour grids) cannot express much.
  - Symbol charts define insertion points only "through the visual cue of the direction of the stitch symbol", so "many charts include ambiguities".
- **Nodes are *insertion points*, not stitches.** "A stitch ties loops together, but the stitch itself may not always result in a loop that can serve as an insertion point (for example … a slip stitch)." For each stitch that creates an insertion point, the node stores the stitch type.
- **Three edge types:**
  - **previous**: points to the previously created insertion point; each node has exactly one outgoing previous edge
  - **insertion**: points to the insertion point(s) the current stitch goes into
  - **slip-stitch**: a slip stitch is a single edge, since it adds no height and creates no new insertion point
- **Chains** are one node plus a previous edge, with no insertion edge.
- **Increases** = several nodes with insertion edges into the *same* point.
- **Decreases** = one node with *several* outgoing insertion edges.
- **Hole nodes** represent chain spaces or rings, so stitches worked "into the hole, not into the chain stitches" are modelled correctly.
- **Placeholder nodes** mark open connection points in partial/reusable patterns (e.g. a 5-dc shell).
- **Rows and rounds are unified as "layers".** "Rows or rounds are not relevant for the reproduction of a pattern" and the structure does not change. The layer number is a node property.
- **Edges are ordered**, so the yarn track can be traced unambiguously through "intersection nodes".
- **Crochetability rule:** a node N is crochetable if a yarn track leads from the initial node to N "so that none of the nodes along the path uses node N as an insertion point … no step in the pattern uses an insertion point that is only created in the future."
- **Think-aloud study** with 6 professional designers recruited through the myboshi designer pool (formative survey sent to 200 designers, 25 responded):
  - All six found a published-style star chart "very well-arranged", yet the stitch-by-stitch walk-through exposed three flaws: missing insertion points, an unspecific round closure, and a missing slip stitch.
  - Designers wanted **stitch counts per layer, clear layer numbering, reminders to change layer, user-defined repeat units**, and they valued **auto-completion** of repeated layers.
  - The 3D force layout was disorienting ("the movement of the pattern caused by the force-based layout made it difficult for users to orient themselves") and is "only an approximation" of the real shape.
- **Stated limitations:** no colour/yarn change yet; linear editing makes early corrections costly; copy/paste needs graph-aware re-anchoring.
- A related earlier work by the same group proposes a "graph structure as a domain-specific language, along with a projectional editor prototype" [S21 (snippet)].

### 3.3 Other crochet grammars and parsers on GitHub

| Project | Language | Model | Notes |
|---|---|---|---|
| **stitch-grapher** [S22] | Java | Nodes: id, type, row, position, direction, height. Edges: **NEXT** (working order) and **PARENT** (worked-into) | Parses `3sc`, `(sc, inc)x6`, `inc`, `dec`, `ch`, `mr`; 6 stitch types; renders 2D/3D; MIT |
| **christel (CPL)** [S23] | Ruby (Treetop PEG grammar) | Sequence of stitch runs | `10 ch, 4 sc`; `6 sc in ring, slst`; `#` comments; GPLv3; spec "not settled", low activity |
| **Crochendo** [S24 (snippet)] | — | Text parser + progress tracker | Parses raw-text instructions and tracks progress |

Example in stitch-grapher's syntax, the classic 6-round flat disc as users actually write it:
```
mr 6sc
(inc)x6
(sc, inc)x6
(2sc, inc)x6
```

### 3.4 Knitting languages worth borrowing from

- **Knitout** is a *low-level, machine-independent* knitting instruction format.
  - Operations: `knit`, `tuck`, `split`, `xfer`, `rack`, `in/out/inhook/outhook`, `drop`, `miss`.
  - Needles are addressed as `f10`, `b3`.
  - By design it has "no flow-control, abstractions, or grouping primitives" [S25].
  ```
  ;!knitout-2
  inhook 5
  tuck - f10 5
  tuck - f8 5
  tuck - f6 5
  ```
- **KnitScript** (UIST 2023) is a Python-like DSL that compiles to Knitout and keeps a "comprehensive virtual model of knitting machines" [S26].
  - ▶ The lesson is **layering**: a low-level exact representation (Knitout, like our stitch graph) plus a high-level authoring language (KnitScript, like our written-pattern DSL).
- **KnitGraph / KnitPick** (Hofmann et al., UIST 2019) turns hand-knitting texture patterns into KnitGraphs, which can be output as machine or hand instructions [S27].
  - It includes **"a measured and photographed data set of 472 knitted textures"** and shape-editing algorithms (KnitCarving, KnitPatching).
  - ▶ This is the closest precedent for a calibration dataset built from real swatches (§5).
- **Knotty** is a Typed Racket DSL. It imports and exports **Knitspeak** and produces HTML with an interactive chart plus written instructions [S28].
- **EnvisioKnit** parses written stitch text into a draft chart and reports errors [S29].
- **Stitch Maps** (JC Briar) is a gridless chart: the program models "how decreases and increases and cables … affect the shape of the rows and columns" and places the symbols accordingly [S30].
  - ▶ This is the knitting counterpart of what a realistic crochet chart renderer should do.

### 3.5 Symbol standards and machine-readable resources

- **CYC (Craft Yarn Council) crochet chart symbols.**
  - The symbol key covers ch, sl st, sc, hdc, dc, tr, dtr, sc2tog, dc2tog, and the 5-dc shell, among others. "Each symbol represents a stitch as it looks on the right side of the work" [S32 (snippet)].
  - Guo et al. built their crochet stitch-mesh vocabulary on the CYC list [S17].
- **CYC abbreviations master list** [S33]:
  - A two-column HTML table (Abbreviation | Description), about 70+ entries, with sections for Tunisian crochet and US/UK/Canada terms.
  - "These definitions reflect U.S. crochet terminology."
  - No JSON or other machine-readable version was found. ▶ It is easy to transcribe, but check permission first.
- **CYC downloadable symbols page** [S34] offers EPS and JPG files, mainly for yarn-weight and difficulty logos. **No explicit licence text** appears on the page; contact is info@craftyarncouncil.com.
- **cyc-svgs** (GitHub, leifrogers) [S35]:
  - SVG reproductions of CYC knit *and crochet* symbols: chain, slip stitch, sc/hdc/dc/tr/dtr, clusters, popcorn, shell, picot, post stitches.
  - Shipped as `dist/knitSymbols.json` plus individual SVGs.
  - Build code is MIT. The repo *states* "The CYC permits free use with attribution" and asks for the credit line "Source: Craft Yarn Council of America's www.YarnStandards.com". ▶ That is the repo's claim, not a CYC licence document, so verify with CYC before commercial use.
- **JIS / Japanese charts.**
  - Japanese symbols are reportedly standardised in the textile division (L) of the Japanese Industrial Standards [S36b (snippet)].
  - Japanese charts show the fabric "as viewed from the fabric's front". On wrong-side rows a front-post symbol therefore means you *work* a back-post stitch [S36].
  - ▶ This is a key rendering rule: **symbol = appearance on the RS; the written instruction must be derived from which side is facing.**
- **Hungarian terms** (one HU source) [S37]:

  | Abbreviation | Hungarian | US equivalent |
  |---|---|---|
  | lsz | láncszem | ch |
  | rp | rövidpálca | sc |
  | fp | félpálca | hdc |
  | erp | egyráhajtásos pálca | dc |
  | krp | kétráhajtásos pálca | tr |
  | hp | hamispálca | sl st |
  | flsz | forduló láncszem | turning chain |
  | rh | ráhajtás | yarn over |

  Also: szaporítás = increase, fogyasztás = decrease; square brackets mark repeats and "x10" gives the repeat count [S37].
  ▶ Other HU sources probably use different abbreviations (e.g. "ep", "kp"). The product owner should fix one canonical HU vocabulary plus a list of accepted aliases for parsing.
- **Wikipedia "List of crochet stitches"** has sections for basic stitches (US/UK name pairs), increasing/decreasing, and other abbreviated stitches, with short notes such as "Insert hook into front loops of next 2 stitches, YO pull through 2 loops…". Licence CC BY-SA 4.0 [S38].
- **Wikidata** has items for *crocheting* (Q208386), *crochet hook* (Q2090202), *crocheted lace* (Q3182600), *crocheter* (Q23375738) and similar, but **no items for individual crochet stitches** were returned. "Crochet stitch" exists only as an alias on *knitting stitch* (Q24879106) [S39].
  - ▶ There is room to contribute stitch items, but Wikidata cannot be relied on as a stitch ontology today.

---

## 4. Academic research on crochet computation

### 4.1 Paper summaries and their data structures

| Paper | Venue / year | Representation | Key points |
|---|---|---|---|
| **Stitch Meshes for Modeling Knitted Clothing with Yarn-Level Detail** (Yuksel, Kaldor, James, Marschner) [S19] | SIGGRAPH / TOG 2012 | Polygon mesh → finer **stitch mesh**; each face is assigned a stitch type; yarn curves come from faces; yarn-level relaxation simulation | The foundation for later stitch-mesh work |
| **Representing Crochet with Stitch Meshes** (Guo, Lin, Narayanan, McCann) [S17][S18] | SIGGRAPH 2020 poster; SCF 2020 | New face (tile) vocabulary for crochet based on the CYC symbol list; edges labelled by the yarns crossing them | Crochet differs from knitting: one active loop on the hook, and stitches "anchor loops" in earlier stitches. Tiles can be used for manual design and semi-automatic generation from 3D models [S18 (snippet)] |
| **AmiGo: Computational Design of Amigurumi Crochet Patterns** (Edelstein, Peleg, Itzhaky, Ben-Chen) [S16] | SCF 2022 | **Crochet Graph G = (S, R ∪ C)**: vertex (i,j) = base of stitch j in row i; row edges R link consecutive stitches; column edges C link rows | Rows are level sets of geodesic distance from a user seed point; stitch width w sets sampling. 1:1 column edge = sc, x:1 = inc(x), 1:x = dec(x). Saddle-point segmentation + join-as-you-go. Limits: closed surfaces only; no regions with negative mean + positive Gaussian curvature; thin parts are skipped |
| **Language and tool support for 3D crochet patterns: virtual crochet with a graph structure** (Seitz et al.) [S21 (snippet)] | ~2021 | Graph DSL + projectional editor | Predecessor of Digital Crochet |
| **Digital Crochet** (Seitz et al.) [S20] | Onward! 2022 | Insertion-point graph (previous / insertion / slip-stitch edges; hole and placeholder nodes) | See §3.2 |
| **Numerical Optimization of Polygon Tessellation for Generating Machine-producible Crochet Patterns** (Storck, Feldmann, Fiedler, Kyosev) [S53] | Tekstilec 2023 | Polygon tessellation into stitches, constrained by the CroMat crochet *machine* prototype | Automatically generates valid flat patterns for convex polygons using increases and decreases |
| **CrochetBench** (Li, Huang, Chawla) [S4] | arXiv Nov 2025 | CrochetPARADE DSL as an executable target | §2.3 |
| **StitchFlow** (Marciniak, Lertjaturaphat, Bianchi) [S47] | UIST 2025 | Motion-sensor stitch tracking → editable design | 8-crocheter study: preserves creative flow. Participants used "undo stitch" 0–17 times and physically frogged about 6.4 stitches on average [S68 (snippet)] |
| **texTile** (Del Valle, Jacobs, Yu) [S48] | DIS 2025 | Granny-square tiles + 3D-printed TPU connectors; pattern library, viewer, re-assembly plan | Custom tile layouts fitted to body measurements |
| **Hybrid Crochet** [S49] | TEI 2024 | Integrating digitally fabricated and electronic materials with crochet | HCI context |
| **CT2Yarn** (Luo, Umetani) [S50] | arXiv, 7 Sept 2026 | Continuous yarn centreline (ordered 3D points) reconstructed from micro-CT of 18 crochet samples | Enables elastic-rod simulation and stitch-pattern extraction; tight crochet degrades reconstruction. ▶ A possible future source of ground-truth geometry |
| **Crocheting Mathematics** (Kekkonen) [S51] | arXiv Aug 2025 | Continuous surfaces approximated by rounds of height H and stitches of width W | Formulas for disc, sphere, hyperbolic plane, Enneper surface; gauge sensitivity; tube swatch (§4.2) |
| **Hyperbolic crochet** (Taimina) [S52] | 1997 onwards | Constant increase ratio | First usable hyperbolic plane model (1997). First models increased 1 stitch after every 2; a 12:13 ratio is recommended for classrooms [S52 (snippet)] |
| **Yarn-level simulation / real-time knit rendering** [S64] | TOG 2014; 2025 | Yarn crossings with sliding; real-time stitch-mesh → yarn + fibre rendering | ▶ Beyond Dragonette's current needs; relevant only for a future "realistic preview" |

### 4.2 Geometry formulas usable directly (from [S51])

- **Flat disc.** Circumference at round ℓ = 2π(ℓH) ⇒ stitches N(ℓ) ≈ 2πℓH / W, i.e. about **2πH/W added per round**. With H ≈ W and π ≈ 3 this gives "6 stitches into a ring, add 6 stitches on every round". The added count "depends linearly on the height–width ratio".
- **Sphere of radius S.** N(ℓ) = (2πS / W) · sin(Hℓ / S), computed up to the equator ℓ ≤ πS/H and then mirrored. A sphere adds *fewer* stitches than a disc.
- **Hyperbolic plane.** C = 2πS·sinh(R/S) ⇒ *more* stitches than a disc.
- **Gauge sensitivity.** "If … the edge … does not curve enough … your stitches are too tall"; too short gives too much curvature.
- **Measurement advice.** "Make a test tube to measure the height and width of your stitches; because the model is worked in rounds, a tube will give more accurate measurements than a traditional flat swatch." Use low-stretch yarn and a smaller hook for consistency.

**Approximate stitch heights** (blog-level sources, not measurements; *(snippet)*):
- sc ≈ 6–8 mm, hdc ≈ 10–12 mm, dc ≈ 16–20 mm, tr ≈ 24–30 mm (yarn/hook unspecified).
- Turning chains: ch1 for sc, ch2 for hdc, ch3 for dc, ch4 for tr.
- "Some crocheters use different chain counts because personal tension affects what looks right" [S60 (snippet)].
- ▶ These spreads are exactly why a calibration dataset is needed.

### 4.3 Common core across the models

> **▶ Synthesis**
> Every serious model ends up with the same structure:
> - An **ordered sequence** of work (the yarn path): previous/NEXT/row edges.
> - **Insertion (anchor) relations** to earlier material: insertion/PARENT/column/bottom-node edges. Increases appear as many children on one anchor; decreases as one child with many anchors.
> - **Special insertion targets** that are not stitch tops: chain spaces, rings, posts, front/back loops. Seitz uses "hole nodes"; CrochetPARADE uses labelled groups with hidden nodes and post modifiers.
> - **Rows/rounds as derived or annotated structure**, not the primary structure (Seitz "layers", AmiGo level sets).
> - **Metric properties per stitch type** (height, and sometimes width or edge rest length) that drive layout (CrochetPARADE connection lengths, AmiGo stitch width w, Kekkonen H/W).
>
> Where they differ:
> - CrochetPARADE models *sub-stitch* nodes (top/bottom), which suits physics.
> - Seitz models *insertion points*, which handles slip stitches and spaces cleanly.
> - stitch-grapher and AmiGo use *one node per stitch*, which is simplest for text generation.

---

## 5. Recommended data model for a realistic crochet designer

> **▶ Everything in §5 is synthesis**, grounded in §3–§4. The team should treat it as a proposal.

### 5.1 Design principles

1. **The stitch graph is the single source of truth.** Symbol charts, written text (HU/EN), stitch counts, yardage estimates and 3D previews are all *views* derived from it. This avoids the "purely graphical" trap [S20].
2. **Separate topology from geometry.** Topology is gauge-independent (what is worked into what). Geometry is computed from topology plus a **calibration profile** (yarn × hook × crocheter × stitch type). Layout positions are cached results, except where the user pins them manually for chart beautification.
3. **Rows and rounds are derived plus annotated.** Store a `layer` id per stitch and the *join/turn/spiral* events, as Seitz's "layers" do [S20]. Recompute counts on every edit.
4. **The validator always runs.** Every edit, import or generated pattern is checked, the way CrochetPARADE validates before rendering [S2].
5. **Round-trip text.** Written patterns parse into an instruction AST, which elaborates into the graph; the graph compresses back into an AST and renders to text. Tests enforce `parse(render(g)) ≅ g`.
6. **Interoperability.** Offer import/export of the public-domain CrochetPARADE grammar [S2] as a debugging and interchange format, without embedding the GPL code.

### 5.2 TypeScript-like sketch

```ts
// ---------- Vocabulary (the data-driven stitch library) ----------
type Locale = 'en-US' | 'en-GB' | 'hu';

interface StitchDef {
  id: string;                          // 'sc', 'hdc', 'dc', 'sc2tog', 'dc5shell', 'picot3', 'mr'
  names: Record<Locale, string>;       // { 'en-US': 'single crochet', 'en-GB': 'double crochet', hu: 'rövidpálca' }
  abbr:  Record<Locale, string[]>;     // first = canonical for output; the rest = accepted aliases for parsing
  symbol: { cyc?: SymbolRef; jis?: SymbolRef; custom?: SymbolRef };
  kind: 'chain' | 'slip' | 'basic' | 'cluster' | 'decrease' | 'increase-group' | 'composite';
  // Mechanics ("recipe") — lets us generate step-by-step tutorials and check definitions
  yarnOversBeforeInsert: number;       // dc = 1, tr = 2
  insertCount: number;                 // how many insertion points it consumes: sc = 1, sc2tog = 2, ch = 0
  producesTops: number;                // new insertion points created: ch = 1, sc = 1, slip = 0 (per Seitz), 5-dc shell = 5
  pullThroughSequence: number[];       // dc: [2,2]; hdc: [3]; sc: [2]
  // Nominal geometry in "sc units" — only a prior; replaced by calibration data
  nominal: { height: number; width: number; turningChain?: number };
  composite?: InstructionAST;          // e.g. picot3 = ch3, sl st into 3rd ch from hook
}

type InsertionMode =
  | 'both-loops' | 'front-loop' | 'back-loop' | 'third-loop'
  | 'front-post' | 'back-post'
  | 'space'      // chain space / hole (Seitz "hole node")
  | 'ring'       // magic ring
  | 'between';   // between stitches

// ---------- Topology ----------
type NodeId = string;

interface StitchNode {
  id: NodeId;
  def: string;                          // StitchDef.id
  prev: NodeId | null;                  // sequence edge (yarn path); exactly one, except the start node
  anchors: Anchor[];                    // insertion edges, ordered; [] for chains
  yarn: YarnRef;                        // colour / yarn change happens on the node where it is introduced
  layer: LayerId;                       // derived + annotated (row/round index)
  side: 'RS' | 'WS';                    // derived from turn events — drives JIS/CYC symbol vs worked-stitch rules
  pinned?: { x: number; y: number; rot: number };  // manual chart beautification only
  tags?: string[];                      // 'marker', 'round-start', 'seam', designer notes
}

interface Anchor {
  target: NodeId | SpaceId | RingId;
  mode: InsertionMode;
  order: number;                        // ordering needed for decreases & unambiguous yarn tracking
}

interface Space { id: SpaceId; boundary: NodeId[]; }   // e.g. a ch-3 space; stitches anchor to the space, not the chains

interface LayerEvent {                  // how one layer ends and the next starts
  after: NodeId;
  kind: 'turn' | 'join-slip' | 'spiral' | 'fasten-off' | 'join-piece';
  turningChainCounts?: boolean;         // does the tch count as a stitch? (designer convention — must be explicit)
}

interface Piece {                       // amigurumi parts, motifs, panels
  id: string; name: Record<Locale, string>;
  nodes: Map<NodeId, StitchNode>;
  spaces: Map<SpaceId, Space>;
  events: LayerEvent[];
  joins: PieceJoin[];                   // cross-piece anchoring (join-as-you-go, sewing edges)
}

interface Pattern {
  pieces: Piece[];
  vocabulary: StitchDef[];              // built-in + custom
  conventions: { terminology: 'US' | 'UK' | 'HU'; chartStandard: 'CYC' | 'JIS' };
  gauge: GaugeProfileId;                // which calibration to lay out with
  meta: { title; sizes; yarns; hook; difficulty /* CYC project levels */ };
}

// ---------- Geometry / calibration ----------
interface GaugeSample {                 // one measured row of the calibration dataset (§6)
  crocheterId: string; yarnId: string; hookMm: number; stitch: string;
  workedIn: 'rows' | 'rounds-tube' | 'rounds-flat';
  heightMm: { mean: number; sd: number; n: number };
  widthMm:  { mean: number; sd: number; n: number };
  yarnPerStitchCm?: number;             // for yardage estimates
  blocked: boolean; photoIds: string[]; date: string; notes?: string;
}
interface GaugeProfile { id: string; perStitch: Record<string, { h: number; w: number; yarnCm?: number }>; source: GaugeSample[]; }
```

### 5.3 Derived views and algorithms

1. **Layer and stitch counts.**
   - Count per layer = Σ `producesTops` of the nodes in that layer.
   - Consumed = Σ `insertCount` of anchors into the previous layer.
   - Display "(18)" after each row, as designers asked in [S20].
2. **Geometry layout (chart and preview).**
   - *Initial analytic placement.*
     - Rounds: radius r(ℓ) = Σ heights of layers ≤ ℓ; angle from the anchor's angle, spreading children evenly.
     - Rows: x from the anchor, y = cumulative height.
   - *Relaxation.* Treat sequence edges (rest length = w) and anchor edges (rest length = h of the child stitch) as springs, then minimise energy, in the spirit of CrochetPARADE's connection lengths and iterations [S2][S3].
   - *Keep the layout stable while editing.* Seitz's users found force layouts that move around disorienting [S20]. Warm-start from previous positions and freeze old layers.
   - *Strain = actual length / rest length.* Flag "too tight" (< 0.85) and "too loose / ruffling" (> 1.15). Thresholds should come from calibration. Same idea as CrochetPARADE's loose/tight detection [S1].
3. **Curvature predictor (for amigurumi and shaped pieces).** Compare N(ℓ) with the flat-disc expectation 2πℓH/W [S51]:
   - ratio ≈ 1 → flat
   - ratio < 1 → cup/sphere (predict the radius S by solving N = 2πS·sin(Hℓ/S)/W)
   - ratio > 1 → ruffle/hyperbolic

   This catches the "flattened ball" LLM failure [S44] automatically.
4. **Symbol chart rendering.**
   - Draw each symbol at its node position, rotated along the anchor edge, which is the convention charts rely on [S20].
   - Choose symbol variants by insertion mode: a closed base when worked into the same stitch, an open fan when worked into a space (▶ standard chart convention; verify against the CYC/JIS keys).
   - Use RS-appearance semantics for post stitches on WS rows (JIS) [S36].
5. **Written instructions (EN/HU).**
   - Graph → per-layer token sequence → **compression**: run-length encoding (`5 sc`), then minimal-period repeat detection (`*sc, inc; rep from * 6 times` or `(sc, inc) x6`), then "in next st / in same st / in ch-sp" phrases from the anchor relations.
   - Then a locale template engine with a per-locale grammar:
     - Hungarian word order and suffix agreement ("a következő szembe", "a láncszemívbe") need a small morphology layer and must be reviewed by the HU crocheter.
     - EN-US vs EN-GB swaps stitch names (sc ↔ dc) [S38].
6. **Parsing written patterns (round trip).**
   - PEG grammar (e.g. Peggy or a hand-written parser): lexicon from `StitchDef.abbr` aliases; repeats `[]`, `()`, `*…rep`, `xN`; counts `(12)`; targets `in next st`, `in same st`, `in ch-sp`, `in ring`, `blo/flo`, `fp/bp`.
   - The *elaborator* moves a cursor over the previous layer's unworked tops. Default anchor = next unworked top. Pointer rules cover `sk`, `same st`, and spaces.
   - Compare the stated count `(n)` with the computed one and report ambiguity rather than guessing.
7. **Validation rules (initial set).**

   | # | Rule | Source / rationale |
   |---|---|---|
   | V1 | No anchor may point to a node created later in yarn order ("crochetability") | [S20] |
   | V2 | Each non-start node has exactly one `prev`; the yarn path is a single track per yarn segment | [S20] |
   | V3 | Stated stitch count = computed count per layer | Tech-editor checklist item "stitch counts … match" [S58] |
   | V4 | Layer closure is explicit (join sl st vs spiral) and the round start is marked | Designers flagged a missing closing sl st and a missing round-start indicator [S20] |
   | V5 | Turning chain counts or doesn't: explicit per pattern and consistent | ▶ Common source of ±1 errors; conventions differ [S60] |
   | V6 | Pieces that are joined have compatible edge counts, or a join instruction exists | LLM failure 30 vs 16 [S44] |
   | V7 | Post-stitch/loop symbols vs worked stitch are consistent with RS/WS | [S36] |
   | V8 | Attachments into labelled groups/spaces must be contiguous stitches | [S2] |
   | V9 | Curvature and strain warnings (§5.3.2–3) | [S51][S1] |
   | V10 | Abbreviations are defined in the pattern's legend; one terminology per pattern | CYC: "always refer to the pattern key" [S32 (snippet)]; [S33] |
   | V11 | Crocheter-derived empirical rules (§6), e.g. "dc increases in round 1 of a flat circle: 12, not 6" | To be elicited; each rule stores provenance |

---

## 6. Capturing the crocheter's empirical (tacit) knowledge

### 6.1 What the literature says (facts)

- **Cognitive Task Analysis (CTA)** "uses a variety of interview and observation strategies to capture a description of the explicit and implicit knowledge that experts use". The most frequent techniques are "structured and semi-structured one-to-one interviews, group interviews, real-time or retrospective 'think-aloud' protocols, analyses of previous incidents and observations of task performance" [S56 (snippet)].
- **Critical Decision Method** (Hoffman, Crandall, Shadbolt 1998): "multiple-pass event retrospection guided by probe questions" [S55 (snippet)].
- **Craft-specific elicitation** (Wood, Rust, Horne 2009, *International Journal of Design*) [S54]:
  - An **"expert learner"** (a skilled maker from a neighbouring craft) sits between the master and the novices.
  - **Systematic video recording** is followed by **event logs, flow charts and worksheets** built from the video "to help identify tacit elements".
  - Rather than making all tacit knowledge explicit, they built **"bridges"**: explicit task descriptions that get learners far enough to engage with the expert knowledge themselves.
- **Ethnography of skill** locates craft knowledge in both artefacts and practice. One study pairs 110 museum mittens (1876–1969) with the experience of knitting copies [S57 (snippet)].
- **Think-aloud with crochet designers** (Seitz et al.) had designers walk a chart "stitch by stitch" aloud. Flaws invisible "at first glance" surfaced, and follow-up interviews produced concrete feature requirements [S20].
- **Measured-swatch datasets** have precedent in knitting: KnitPick's 472 measured and photographed textures [S27]. Kekkonen recommends a tube swatch for round work and documents how models fail under wrong gauge [S51].
- **Industry QA practice** [S58][S59]:
  - *Pattern testing:* "a group of testers follow a draft pattern while they each make the finished item".
  - *Feedback forms* ask for gauge, finished dimensions, adjustments made, and clarity; some designers use Google Forms.
  - *Tech editors* check stitch counts, abbreviations, consistency and measurements, and editing should happen *before* testing.
  - Testers are the "maker's eye"; tech editors make sure "the technical details are solid".

### 6.2 Proposed protocol for Dragonette (▶ synthesis)

**Roles:**
- **E**: the expert crocheter.
- **K**: a knowledge engineer or developer; ideally a moderately skilled crocheter, as in the "expert learner" model [S54].
- **T**: 3–6 external pattern testers (later phases).

**Phase 0 — Vocabulary and conventions workshop (1–2 sessions, ~2 h each)**
- Go through the CYC abbreviation list [S33], the CYC/JIS symbol keys [S32][S36] and the HU glossary [S37].
- For each stitch, E states:
  - canonical HU/EN names and abbreviations, plus accepted aliases
  - the yarn-over / pull-through recipe
  - consumes and produces counts
  - whether the turning chain counts
  - preferred chart symbol variants
- Output: a reviewed `StitchDef` JSON library with provenance fields.

**Phase 1 — Semi-structured interviews + Critical Decision Method (3–4 sessions)**
- Prompts:
  - "Tell me about a pattern of yours (or one you tested) that didn't come out as written. What did you notice first? What did you change? How did you know?" (CDM multi-pass [S55])
  - "When do you *not* follow the 6-increase rule?"
  - "How do you hide the increase line/seam?"
  - "When does a dc round ruffle for you?"
  - "What do you do at colour changes?"
  - "How do you decide magic ring vs chain ring?"
- Record audio, transcribe, and code each statement into **candidate rules** (template below).

**Phase 2 — Think-aloud while crocheting (video)**
- E crochets from (a) a published pattern, (b) a Dragonette-generated pattern, and (c) a symbol chart, **verbalising continuously** [S56][S20].
- Camera top-down on hands and work, plus a second camera on the pattern. Stitch markers mark round starts.
- K produces an **event log** with timestamps: hesitations, re-reads, counting, frogging, "I would do X instead" [S54].
- Every hesitation is either a *rendering/clarity issue* (fix the text generator) or a *domain rule* (add to the rule base).

**Phase 3 — Swatch calibration dataset (the core empirical asset)**

Per combination {crocheter, yarn (brand, line, weight class, fibre), hook mm, stitch type}:

1. **Flat swatch (rows).** Foundation ch 25; work 20 rows of the stitch (turning chain per the agreed convention). **Tube swatch (rounds).** 24–30 stitches around, 15 rounds, as Kekkonen recommends for round work [S51].
2. **Measure the central 10 stitches × 10 rows**, away from edges. Measure width and height with a ruler or calliper. Record:
   - three measurements each (mean and SD)
   - unblocked, then after a wet or steam block (flag which)
   - relaxed on a flat surface, not stretched
3. **Photograph** top-down on a cutting mat with a cm grid plus a colour/scale card. Fix the camera height; RS and WS; filename encodes the sample ID. (Precedent: measured *and photographed* datasets [S27].)
4. **Yarn consumption.** Weigh the swatch and the remaining ball on a 0.01 g scale, or measure yarn length before and after. Derive cm per stitch for yardage estimation.
5. **Log context:** hook brand and material, time of day and fatigue, tension notes, left or right handed.
6. **Store as `GaugeSample`** rows (§5.2). Derive `GaugeProfile`s: h/w per stitch *relative to sc* as well as absolute. Relative ratios probably transfer across yarns better (▶ hypothesis to test).

*Minimum viable matrix:* 1 crocheter × 3 yarns (e.g. fingering/DK/aran cotton or acrylic) × 2 hooks each × {ch, sl st, sc, hdc, dc, tr, sc-blo, sc2tog, inc} = 54 samples. At ~20–30 min each that is roughly 20–25 hours of crocheting.

**Phase 4 — Worked-example corpus (prediction vs reality)**
- Dragonette generates small **diagnostic pieces**, each targeting one model assumption:
  - flat disc in sc/hdc/dc (6/8/12 inc variants)
  - sphere Ø 5 cm and 8 cm from the sphere formula [S51]
  - cylinder with decrease distributions
  - row swatch mixing sc/dc heights
  - granny/shell motif with chain spaces
  - a two-piece join (mismatched counts deliberately included as a negative test)
- E makes each piece and fills in a **discrepancy report**:
  - predicted vs measured diameter, height, curvature (flat / cup / ruffle)
  - photos
  - "where did you deviate from the instructions?"
  - clarity rating 1–5 per round
  - free text
- Every discrepancy becomes one of: (a) a calibration update, (b) a new validation or generation rule, or (c) a text-generation fix.
- ▶ Keep the corpus versioned as regression tests: when the layout model changes, re-predict every item and compare with the stored measurements.

**Phase 5 — Rule codification and review**

Each rule is stored as:
```yaml
id: R-017
statement: "In a flat dc circle, round 1 has 12 dc (ch3 counts as 1) and each round adds 12."
scope: { stitch: dc, construction: flat-round }
kind: generation-default | validation-warning | validation-error | text-style
rationale: "Stitch height ≈ 2× width → 2πH/W ≈ 12 (Kekkonen formula)"
provenance: { source: interview-2026-10-02 / think-aloud-session-3, expert: E }
confidence: high | medium | low
tests: [WE-004-disc-dc]     # worked-example IDs that confirm it
counterexamples: []
status: draft | reviewed | active | retired
```
- Monthly review: E accepts, edits or retires rules, and every rule needs at least one passing worked example before it becomes `active`.

**Phase 6 — External tester loop (pre-launch and ongoing)**
- Run the industry flow on patterns authored in Dragonette: tech-edit checklist *before* testers [S58][S59]; testers then use a structured feedback form (gauge achieved, finished dimensions, modifications, clarity per section, errors found with row numbers) [S58].
- ▶ Build this form into the product ("Tester mode"). It becomes a continuous stream of worked examples from many crocheters, broadening calibration beyond one expert's hands.

**Expert review checklist for generated patterns (draft)**
1. Materials, hook, gauge statement (stitches × rows per 10 cm, stitch used, blocked?) present.
2. Terminology declared (US/UK/HU); every abbreviation in the legend.
3. Every row/round: stitch count, start marker/turning, closure (sl st / spiral / turn).
4. Increases/decreases evenly distributed and staggered where a seam line matters.
5. Chain spaces vs stitches unambiguous ("into ch-3 sp" vs "into 3rd ch").
6. Colour changes: where and how (last yarn over of the previous stitch).
7. Pieces: join counts match; sewing/join instructions; stuffing and safety-eye timing; turning right side out.
8. Chart matches text exactly (same counts, same insertion points); RS/WS symbol semantics.
9. Finished dimensions predicted and stated with tolerance.
10. Photos/diagrams for non-standard stitches.

---

## 7. Public data sources

### 7.1 Ravelry API

- **Access.** A free developer account at ravelry.com/pro/developer. Create an app with "basic authentication: read only access" (username/password key pair) [S40][S42].
- **Content.** "knit and crochet patterns and their attributes (such as ratings, yarn type, needle type, price, photos, and author/designer info), yarn data (… brand, ratings, texture, price, yardage, fiber type), author information, shop locations" [S42].
- **Pattern fields** exposed through the ravelRy client include [S40]:
  - `craft, gauge, gauge_divisor, gauge_pattern, row_gauge, gauge_description`
  - `yardage, yardage_max, yarn_weight, yarn_weight_description, pattern_needle_sizes`
  - `pattern_categories, pattern_attributes, difficulty_average, difficulty_count, rating_average, projects_count, favorites_count`
  - `free, price, currency, downloadable, sizes_available, notes, notes_html, pattern_author, photos, packs, printings`
- **What it does *not* provide:** the pattern instructions themselves. PDFs belong to designers.
- **Terms.** The public Terms of Service contain **no explicit clauses on API use, scraping or data mining** (as read) [S41]. On patterns:
  - designers "represent and warrant" that they hold the copyright
  - buyers get "a non-commercial, perpetual license for personal use"
  - users may not create "derivative works based on any pattern that you do not own unless … explicitly granted a license" [S41]
  - The developer API licence itself is behind a login and **was not verified**. Read it before building on the data.
- ▶ **Useful for:**
  - distributions of gauge vs yarn weight, and yardage vs category/size (priors for estimates)
  - attribute taxonomies (`pattern_attributes`, `pattern_categories`) for tagging
  - difficulty calibration
  - integration: "publish to Ravelry" / "import my yarn stash"
- ▶ **Not a training source for instructions.**

### 7.2 Standards and reference pages

- **CYC:** crochet chart symbols [S32], abbreviations [S33], downloadable symbols (EPS/JPG, no explicit licence text) [S34], and the 2018 standards PDF bundle [S32b]. Also project levels and yarn weight system pages (listed in the search results, not fetched).
- **cyc-svgs** for ready-made SVG symbols (confirm attribution terms) [S35].
- **Wikipedia** list of crochet stitches, CC BY-SA 4.0 (attribution + share-alike on derived text) [S38].
- **Wikidata:** no per-stitch items [S39].

### 7.3 Pattern corpora and licensing caveats

- **CrochetBench:** 6,085 Yarnspirations patterns. The authors release "only structured JSON annotations generated with GPT, reference URLs to the original sources, and parsing and annotation scripts". Non-commercial academic use only [S4].
  - ▶ Fine for internal benchmarking of a parser. Not a commercial training or distribution set.
- **CrochetPARADE example patterns:** licensing follows the project (GPLv3 code, CC BY-NC-SA manual) [S2]. Check per example.
- **AmiGo outputs and code:** CC BY-NC-SA 4.0 [S15].
- ▶ **General caution.** Free patterns online are still copyrighted by default. Ravelry's ToS explicitly bars derivative works without a licence [S41]. The safest corpora are:
  1. patterns authored by the Dragonette expert herself
  2. patterns licensed from designers who opt in
  3. synthetic patterns from Dragonette's own generator, validated by worked examples

---

## 8. Open questions for the product owner

1. **Scope of constructions for v1.** Flat rows, flat rounds, amigurumi spirals, motifs/granny squares, garments with shaping? This decides which validation rules and layout modes ship first.
2. **Terminology and standards.**
   - Which HU abbreviation set is canonical (e.g. "erp" vs "ep" for egyráhajtásos pálca)?
   - Is EN-UK output needed alongside EN-US?
   - CYC-style or JIS-style symbols by default?
3. **Chart editing philosophy.** Must the chart stay fully free-placement like Illustrator [S61], or may the layout be computed from the graph with manual nudges (`pinned`)? How much should manual beautification be allowed to diverge from computed geometry?
4. **Turning-chain convention** (counts as a stitch or not) and **round closure style** (join vs spiral) as defaults. Is this per pattern, or a user preference?
5. **Written-pattern import.** How important is parsing *other designers'* patterns vs round-tripping Dragonette's own output? (Messy real-world text is a large, open-ended effort.)
6. **AI features.** Should any LLM be used, given the brand risk [S43][S44] and the benchmark results [S4]? If yes, only behind the validator?
7. **Calibration ownership.**
   - One expert's hands, or crowd-sourced calibration from users/testers?
   - Will users be able to enter their own gauge profile ("my tension")?
8. **Budget for Phase 3–4 crocheting time.** Roughly 20–25 hours for the minimum swatch matrix plus about 15–30 small worked examples. Who pays for or schedules the expert's time and the yarn?
9. **Licensing posture.**
   - Is the product closed-source? That affects reuse of GPL code (Crochet Charts, CrochetPARADE) and non-commercial research code (AmiGo, CrochetBench).
   - Should Dragonette offer CrochetPARADE-grammar export for interoperability?
10. **CYC symbol usage.** Should we ask CYC in writing for permission to use their symbols (or cyc-svgs derivatives) in a commercial app, or draw our own symbol set?
11. **Ravelry integration.** Is publishing/linking to Ravelry a goal? That needs the developer API licence reviewed.
12. **3D preview.** Is a realistic 3D preview a v1 differentiator or later? Seitz's designers loved it but got disoriented, and force layouts only approximate shape [S20].
13. **Tester mode.** Should Dragonette host the pattern-testing workflow (tester calls, feedback forms, discrepancy reports), making the product the knowledge-capture pipeline itself?

---

## 9. Sources

| ID | URL | Used for |
|---|---|---|
| S1 | https://github.com/crochetparade/CrochetPARADE | CrochetPARADE features, tech stack, licence |
| S2 | https://www.crochetparade.org/Manual.html | Grammar, DEF, DOT parameters, validation, exports, licences |
| S3 | https://github.com/stassev/CrochetPARADE/blob/main/Manual.md | Raw stitch grammar (top/bottom nodes, connection lengths), hidden nodes, performance |
| S4 | https://arxiv.org/html/2511.09483v1 | CrochetBench tasks, dataset, results, licence |
| S5 | https://www.stitchfiddle.com/en/premium/pricing | Stitch Fiddle pricing (snippet) and modes |
| S6 | https://www.willowcrochet.com/stitch-fiddle-features-for-crochet-colorwork/ | Stitch Fiddle features, free vs paid |
| S7 | https://github.com/StitchworksSoftware/CrochetCharts | Crochet Charts features, GPLv3, dormant since 2015 |
| S8 | https://www.edieeckman.com/2016/07/31/in-search-of-crochet-charting-software-part-2/ | Professional review of charting software |
| S9 | https://www.chart-minder.com/ (Pro: https://www.chart-minder.com/pro) | Chart Minder features and pricing (snippet) |
| S10 | https://chart-minder.tawk.help/article/overview | Chart Minder grid model |
| S11 | https://apps.apple.com/us/app/knitcompanion-knitting-more/id1058142783 | knitCompanion features/pricing (snippet) |
| S12 | https://play.google.com/store/apps/details?id=com.hookchart.hookchart&hl=en_US | Hookchart features |
| S13 | https://www.knitting-chart.com/crochet-chart/ | Crochet Chart (iOS) features |
| S14 | https://amigurum.io/ | Amigurumio generator |
| S15 | https://github.com/karinsifri/AmiGo | AmiGo code, licence, limitations |
| S16 | https://arxiv.org/abs/2211.01178 (full text: https://ar5iv.labs.arxiv.org/html/2211.01178) | AmiGo Crochet Graph |
| S17 | https://history.siggraph.org/learning/representing-crochet-with-stitch-meshes-by-guo-lin-narayanan-and-mccann/ | Crochet stitch meshes poster |
| S18 | https://dl.acm.org/doi/fullHtml/10.1145/3424630.3425409 | Crochet stitch meshes SCF 2020 (snippet; full text 403) |
| S19 | https://history.siggraph.org/learning/stitch-meshes-for-modeling-knitted-clothing-with-yarn-level-detail-by-yuksel-kaldor-james-and-marschner/ (also https://www.cemyuksel.com/research/stitchmeshes/) | Yuksel stitch meshes |
| S20 | https://patrickrein.de/publications/SeitzReinLinckeHirschfeld_2022_DigitalCrochet_preprint.pdf (ACM: https://dl.acm.org/doi/10.1145/3563835.3567657) | Digital Crochet graph language, user study |
| S21 | https://www.researchgate.net/publication/354744046_Language_and_tool_support_for_3D_crochet_patterns | Earlier graph DSL (snippet) |
| S22 | https://github.com/bilgesucakir/stitch-grapher | NEXT/PARENT graph parser |
| S23 | https://github.com/fwolfst/christel | CPL Treetop grammar |
| S24 | https://github.com/charln2/Crochendo | Text parser/progress tracker (snippet) |
| S25 | https://textiles-lab.github.io/knitout/knitout.html | Knitout spec |
| S26 | https://dl.acm.org/doi/fullHtml/10.1145/3586183.3606789 (also https://pypi.org/project/knit-script/) | KnitScript |
| S27 | https://par.nsf.gov/biblio/10191362-knitpicking-textures-programming-modifying-complex-knitted-textures-machine-hand-knitting | KnitPick / KnitGraph, 472-swatch dataset |
| S28 | https://github.com/t0mpr1c3/knotty | Knotty DSL, Knitspeak |
| S29 | https://www.envisioknit.com/manual/chart-from-instructions/ | EnvisioKnit text→chart parsing |
| S30 | https://www.interweave.com/article/knitting/a-fresh-take-on-knitting-charts/ | Stitch Maps gridless charts |
| S32 | https://www.craftyarncouncil.com/standards/crochet-chart-symbols | CYC symbols (snippet) |
| S32b | https://media.craftyarncouncil.com/sites/default/files/images/standards/CYC_YarnStandards-2018-11-06.pdf | CYC standards PDF (listed, not fetched) |
| S33 | https://www.craftyarncouncil.com/standards/crochet-abbreviations | CYC abbreviations list |
| S34 | https://www.craftyarncouncil.com/standards/downloadable-symbols | CYC downloads, no licence text |
| S35 | https://github.com/leifrogers/cyc-svgs | SVG symbol set, licence claims |
| S36 | https://www.ronique.net/en/blogs/guide_to_japanese_crochet_charts/guide_003 | Japanese chart RS-view semantics |
| S36b | https://www.crochetingforprofit.com/understanding-japanese-crochet-symbols/ | JIS standardisation claim (snippet; source among the search results) |
| S37 | https://nokondesign.hu/horgolas-jelek-utmutato/ | Hungarian terms/abbreviations |
| S38 | https://en.wikipedia.org/wiki/List_of_crochet_stitches | Stitch list structure, CC BY-SA |
| S39 | https://www.wikidata.org/w/api.php?action=wbsearchentities&search=crochet&language=en&format=json&limit=30 | Wikidata crochet items |
| S40 | https://cran.r-project.org/web/packages/ravelRy/readme/README.html | Ravelry pattern fields, auth |
| S41 | https://www.ravelry.com/about/terms | Ravelry ToS pattern clauses |
| S42 | https://github.com/walkerkq/ravelRy | Ravelry API content description |
| S43 | https://www.cnn.com/2023/07/08/us/chatgpt-crochet-patterns-artifical-intelligence-cec/index.html | ChatGPT crochet failures (snippet; page returned 451) |
| S44 | https://abcrafty.com/ai-crochet-patterns/ | ChatGPT vs Gemini failure modes |
| S45 | https://futurism.com/the-byte/chatgpt-crochet-patterns-disturbing | ChatGPT crochet coverage (snippet) |
| S46 | https://www.pokecut.com/ai-image-generator/ai-crochet-pattern-generator | AI image-based "pattern" generator (snippet) |
| S46b | https://vondy.com/ai-crochet-pattern-generator--lEp24gXT | Vondy claims (snippet) |
| S47 | https://make.kaist.ac.kr/project/2025-stitchflow (ACM: https://dl.acm.org/doi/10.1145/3746059.3747715) | StitchFlow |
| S48 | https://dl.acm.org/doi/10.1145/3715336.3735819 | texTile (DIS 2025) |
| S49 | https://dl.acm.org/doi/10.1145/3623509.3635257 | Hybrid Crochet (TEI 2024) |
| S50 | https://arxiv.org/html/2609.06950v1 | CT2Yarn |
| S51 | https://arxiv.org/pdf/2508.10597 | Crocheting Mathematics: formulas, tube swatch, gauge sensitivity |
| S52 | https://pi.math.cornell.edu/~dtaimina/hypplanes.htm (also https://arbitrarilyclosecom.wordpress.com/2020/05/12/mathartchallenge-day-56-hyperbolic-crochet-all-credit-to-daina-taimina/) | Taimina hyperbolic crochet (snippet) |
| S53 | https://journals.uni-lj.si/tekstilec/article/view/15468 | Polygon tessellation crochet patterns |
| S54 | http://www.ijdesign.org/index.php/IJDesign/article/view/559/275 | Wood et al., tacit craft knowledge capture |
| S55 | https://journals.sagepub.com/doi/10.1518/001872098779480442 | Critical Decision Method (snippet) |
| S56 | https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8903544/ | CTA methods overview (snippet) |
| S57 | https://nomadit.co.uk/conference/sief2021/paper/59764 | Ethnography of skill, mittens (snippet) |
| S58 | https://startcrochet.com/crochet-pattern-testing/ | Pattern testing process, feedback forms, tech edit (snippet) |
| S59 | https://gosadi.com/blog/working-with-pattern-testers-a-guide-for-new-knit-crochet-designers/ | Testers vs tech editors (snippet) |
| S60 | https://stitchandhound.com/blog/crochet-stitch-height-chart (also https://www.bygoldenberry.com/blog/crochet-turning-chain) | Approximate stitch heights, turning chains (snippet) |
| S61 | https://yarnandy.com/whats-great-about-using-adobe-illustrator-for-crochet-charts/ (also https://www.edieeckman.com/2018/03/12/draw-crochet-symbols-illustrator/) | Illustrator workflows (snippet) |
| S62 | https://stitchly.com/ | Stitchly is a cross-stitch app |
| S63 | https://link.springer.com/article/10.1007/s12193-026-00478-3 | "Embodied knowledge as a design probe in a user-centered design study of a sonification system for crochet" (2026; title only, paywalled — worth obtaining) |
| S64 | https://dl.acm.org/doi/10.1145/2661229.2661279 (also https://www.physicsbasedanimation.com/2025/06/18/real-time-knit-deformation-and-rendering/) | Yarn-level simulation; real-time knit rendering (snippet) |
| S68 | https://dl.acm.org/doi/10.1145/3746059.3747715 | StitchFlow usage numbers (snippet) |

Further leads not fetched (titles only, from search results):
- "A Graph Model and a Layout Algorithm for Knitting Patterns" — https://arxiv.org/html/2406.13800
- "Knittable Stitch Meshes" — https://www.researchgate.net/publication/330547347_Knittable_Stitch_Meshes
- "Methods to Capture and Model Craftsmen's Tacit Knowledge in Traditional Designs" — https://link.springer.com/chapter/10.1007/978-981-10-3518-0_51
- "Tacit Knowledge Sharing for … ICH Crafts" — https://www.mdpi.com/2071-1050/15/20/14955
- "Intertwined Practices: Computational Approaches for Handmade Textile Craft" (UIST 2025 adjunct) — https://doi.org/10.1145/3746058.3758463
