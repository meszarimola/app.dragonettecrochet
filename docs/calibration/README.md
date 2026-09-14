# Calibration — swatch sheet and worked-example log

Linear: PQW-860 (first half: the forms and the data format). Consumer of the
data: PQW-859 (gauge profile and finished size).

The one input the designer cannot derive is how the owner's hands turn yarn
and hook into fabric: stitch width, row height per stitch type, flat versus
round, blocked versus unblocked (`../knowledge-base/02-yarn-hook-gauge.md` §9,
knowledge-base README §6). This folder holds the forms the owner fills in and
the format that stores the results, so the gauge profile can load them without
re-interpretation.

| File | Language | What |
|---|---|---|
| [`meresi-lap.md`](meresi-lap.md) | Hungarian | Measurement sheet, one per swatch, with the first swatch plan and the measuring rules |
| [`tesztdarab-jegyzokonyv.md`](tesztdarab-jegyzokonyv.md) | Hungarian | Worked-example log, one per test piece |
| [`schema/gauge-sample.schema.json`](schema/gauge-sample.schema.json) | — | JSON Schema of one measured swatch |
| [`schema/worked-example.schema.json`](schema/worked-example.schema.json) | — | JSON Schema of one worked example |
| [`examples/`](examples/) | — | Filled-in files with **invented** values, for reading and for the loader's tests |

The two forms are Hungarian because the owner fills them in; this
specification is English per the repository rules. Every field on the forms
shows its JSON key, so transcription is mechanical.

## Workflow

1. Crochet a swatch from the plan in `meresi-lap.md`.
2. Measure it unblocked, photograph it, fill in sections 1–5.
3. Block it, let it dry fully, measure, photograph and weigh it again
   (sections 6–7).
4. Transcribe the sheet into `GS-….json` and validate it against the schema.
5. The PQW-859 loader derives the values below and builds the profiles.

Worked examples follow the protocol in `06 §6.2` phase 4: development fills in
the pattern and the prediction before the owner crochets; the owner adds the
measurements, shape and notes; the discrepancy decision is made together.

## Identifiers

| What | Format | Notes |
|---|---|---|
| Swatch | `GS-YYYYMMDD-NN` | *gauge sample*; the date of the first measurement, `NN` a running number for that day. File name = id + `.json`. |
| Worked example | `WE-NNN` | Same prefix as `06 §6.2`; the rule register cites these ids in `tests`. |
| Yarn | `yarn.id` | Lowercase ASCII slug of brand and line. Another colour or dye lot of the same yarn keeps the id; colour and lot are separate fields. |
| Crocheter | `crocheter.id` | `owner` for the owner; testers get their own ids later (`06 §6.2` phase 6). |
| Photo | `<id>-<elotte\|utana>-<szin\|visszaje>.jpg` | E.g. `GS-20260915-01-utana-szin.jpg`. The loader does not parse names; the JSON lists every file. |

**Stitch ids** follow the knowledge base and `06 §5.2` (`ch`, `slst`, `sc`,
`hdc`, `dc`, `tr`). The Hungarian names and abbreviations on the forms are the
ones approved in [`../stitch-vocabulary-proposal.md`](../stitch-vocabulary-proposal.md)
(PQW-867, 2026-09-14). That document does not fix code ids, and the prototype
still uses `single` / `halfDouble` / `double`. When the stitch library code
(PQW-867) lands with different ids, it aligns the enum in the schema and the
example files in the same PR.

**Insertion** is a separate field (`both-loops`, `back-loop`, `front-loop`), as
`InsertionMode` in `06 §5.2`: back-loop single crochet is `sc` + `back-loop`,
not a stitch of its own.

## Gauge sample format

Schema: [`schema/gauge-sample.schema.json`](schema/gauge-sample.schema.json).
Examples: [`examples/gauge-sample.rows.example.json`](examples/gauge-sample.rows.example.json),
[`examples/gauge-sample.rounds-tube.example.json`](examples/gauge-sample.rounds-tube.example.json).

Conventions:

- **Units:** millimetres and grams, dot as decimal separator. The paper sheet
  uses a decimal comma: `58,5` is transcribed as `58.5`.
- **Unknown is `null`**, never a guess. The loader treats a missing value as
  missing, and falls back to an estimate flagged as such.
- **Raw readings only.** Means, standard deviations, per-10 cm values and
  ratios are derived by the loader, so a typo is fixed in one place.
- **No unknown keys** (`additionalProperties: false`), so typos in
  transcription fail validation instead of vanishing.

### Top level

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | `1` | Bumped on a breaking change; the loader rejects versions it does not know. |
| `id`, `date` | string | See identifiers; `date` is ISO `YYYY-MM-DD`. |
| `crocheter` | `{ id, handedness }` | `handedness`: `right`, `left` or `null`. |
| `yarn` | object | `id`, `brand`, `line`, `colour`, `dyeLot`, `fibre[] { material, percent }`, `cycWeight` (0–7, from the label), `label { lengthM, massG, hookMmMin, hookMmMax }`. Label values carry provenance `label` in the profile. |
| `hook` | `{ mm, brand, material }` | `mm` as stamped on the hook (`02 §9` item 9). |
| `stitch` | `{ id, insertion }` | See above. |
| `construction` | object | Depends on `workedIn`, table below. |
| `measurements` | array, 1–2 entries | One per state; when there are two, the first is `unblocked`, the second `blocked`. |
| `context` | `{ timeOfDay, fatigue, tensionNotes }` | `06 §6.2` phase 3 step 5. `fatigue` 1–5. |
| `notes` | string or `null` | |

### `construction`

| `workedIn` | Hungarian | Required fields | Measurement block |
|---|---|---|---|
| `rows` | síkban, sorokban | `foundationChains`, `rows`, `turningChain { chains, countsAsStitch }` | `grid` |
| `rounds-tube` | csőben, körökben | `stitchesPerRound`, `rounds`, `start`, `roundJoin` | `grid` |
| `rounds-flat` | lapos kör | `rounds`, `lastRoundStitches`, `start`, `roundJoin` | `circle` |
| `chain` | láncszemsor | `chains` (and `stitch.id` must be `ch`) | `chain` |

`start` is `magic-ring` or `chain-ring`; `roundJoin` is `spiral` or `joined`.
`06 §5.2` has the first three values; `chain` is added for the foundation-chain
supplement (`02 §9` item 6). `turningChain.countsAsStitch` is recorded because
it changes the stitch count and must never be assumed (knowledge-base README
§4.3).

### `measurements[]`

| Field | Type | Notes |
|---|---|---|
| `state` | `unblocked` \| `blocked` | |
| `blocking` | `null` or `{ method, dryHours, pinned }` | `null` exactly when unblocked. `method`: `wet`, `steam`, `spray`. |
| `tool` | `ruler` \| `calliper` \| `tape` | |
| `grid` | `{ stitchesSpanned, rowsSpanned, widthMm[], heightMm[] }` | `rows` and `rounds-tube`. Spans are 10 on the sheet; a different span is allowed and recorded. |
| `circle` | `{ diameterMm[], shape }` | `rounds-flat`. `shape`: `flat`, `cupping`, `ruffling`. |
| `chain` | `{ lengthMm[] }` | `chain`. |
| `swatch` | `{ widthMm, heightMm, massG, scaleResolutionG }` | Whole piece. Tube: `widthMm` is the flattened width. Flat circle: width and height `null`, the area comes from the diameter. |
| `photos` | `[{ file, side }]` | `side`: `rs` (színe) or `ws` (visszája). |
| `notes` | string or `null` | |

Every reading array (`widthMm`, `heightMm`, `diameterMm`, `lengthMm`) has at
least three values. Exactly one of `grid`, `circle`, `chain` is present, and it
must match `construction.workedIn`; the schema enforces both.

## Derived values (computed by the loader)

Per measurement entry, `mean` and the sample standard deviation `sd` (n − 1)
are taken over the readings.

| Value | Formula | Basis |
|---|---|---|
| Stitch width, mm | `mean(grid.widthMm) / grid.stitchesSpanned` | `02 §8` `stitchWidthMm` |
| Row height, mm | `mean(grid.heightMm) / grid.rowsSpanned` | `02 §8` `rowHeightMm` |
| Stitches / 10 cm, rows / 10 cm | `100 / width`, `100 / height` | |
| Aspect h/w | `row height / stitch width` | `02 §3.4`, README §4.2 |
| Flat circle: round height, mm | `mean(circle.diameterMm) / 2 / construction.rounds` | radius grows by about one row height per round, `02 §4.3` |
| Flat circle: stitch width, mm | `π · mean(circle.diameterMm) / construction.lastRoundStitches` | outer edge |
| Chain length, mm per chain | `mean(chain.lengthMm) / construction.chains` | `02 §9` item 6; compare with the stitch width of the same yarn, hook and state |
| Swatch area, cm² | rows: `w · h / 100`; tube: `2 · w · h / 100`; flat circle: `π · mean(D)² / 400` | |
| Mass per area, g/cm² | `swatch.massG / area` | `02 §6.5` |
| Blocking change | `(blocked − unblocked) / unblocked`, width and height separately | `02 §3.7` |
| Yarn per stitch, cm | `g/cm² · (width · height / 100) · label.lengthM / label.massG · 100` | fills `GaugeSample.yarnPerStitchCm`; only when the label is known |
| Drift warning | `(max − min) / mean > 5 %` on any reading array | `02 §3.1` tolerance, `02 §9` item 10 |

The flat circle is a rough source: the ring and the first rounds are not full
height. The tube is the primary round gauge (`06 §4.2`); the circle is kept
because it also records whether the actual increase rate lies flat, cups or
ruffles.

The two open questions of PQW-860 come straight out of these values:

- **How much taller is dc than sc?** `rowHeight(dc) / rowHeight(sc)`, same
  yarn, hook, `workedIn` and state.
- **How much do flat and round sc differ?** `aspect(sc, rows)` versus
  `aspect(sc, rounds-tube)`, same yarn, hook and state.

## Mapping to `GaugeSample` and `GaugeProfile` (`06 §5.2`)

One file yields one `GaugeSample` per measurement entry:

| `GaugeSample` | Source |
|---|---|
| `crocheterId` | `crocheter.id` |
| `yarnId` | `yarn.id` |
| `hookMm` | `hook.mm` |
| `stitch` | `stitch.id`; `stitch.insertion` is part of the key when it is not `both-loops` |
| `workedIn` | `construction.workedIn` |
| `widthMm { mean, sd, n }` | derived stitch width (grid or circle) |
| `heightMm { mean, sd, n }` | derived row height (grid or circle) |
| `yarnPerStitchCm` | derived, see above |
| `blocked` | `state === 'blocked'` |
| `photoIds` | `photos[].file` |
| `date`, `notes` | `date`; `notes` joined with the measurement's `notes` |

What the profile needs beyond the sketch in `06 §5.2`:

- **Grouping:** one `GaugeProfile` per `crocheter.id` × `yarn.id` × `hook.mm` ×
  state (blocked or not).
- **Construction mode in the key.** The sketch's
  `perStitch: Record<stitch, { h, w }>` has no room for flat versus round, but
  gauge must be measured in the mode it is used for (README §4.2). PQW-859
  should key it as `perStitch[stitch][workedIn]`.
- **Extra per-profile values:** mass per area, chain length, blocking change,
  flat-circle shape.
- **Provenance on every value:** `measured` for values from these files.
  Anything the profile lacks falls back to the estimates in `02 §8`, flagged
  `estimated` and shown with a range (PQW-859).
- **Several samples with the same key** are pooled: all readings together,
  `n` counts readings.

## Worked-example format

Schema: [`schema/worked-example.schema.json`](schema/worked-example.schema.json).
Example: [`examples/worked-example.example.json`](examples/worked-example.example.json).

| Field | Type | Notes |
|---|---|---|
| `schemaVersion`, `id`, `date` | | `id` is `WE-NNN`. |
| `status` | `predicted` \| `measured` \| `evaluated` | The log is filled in stages. `measured` requires `measurements` and `shape`; `evaluated` also requires `actions`. |
| `crocheterId` | string | |
| `roadmapStep` | `{ milestone, ticket }` | `ticket` is `PQW-…` or `null`. |
| `purpose` | string | Which model assumption the piece tests. |
| `pattern` | `{ title, source, designerVersion, file, summary }` | `source`: `generated` or `manual`. `designerVersion` (commit or app version) and `file` let the prediction be recomputed later. |
| `materials` | `{ yarnId, hookMm, gaugeProfileId }` | `gaugeProfileId: null` means the prediction was an estimate without a profile. |
| `predictions[]` | `{ dimension, label, valueMm, rangeMm, basis }` | `dimension` is a slug (`diameter`, `height`, `width`, `circumference`, …); `basis`: `measured`, `label`, `estimated` (`02 §8`). |
| `predictedShape` | `flat` \| `cupping` \| `ruffling` \| `other` \| `null` | |
| `measurements[]` | `{ dimension, state, valuesMm[] }` | At least three readings; `dimension` matches a prediction. |
| `shape`, `shapeNotes` | | Same enum as `predictedShape`. |
| `massG` | number or `null` | Checks the yarn estimate. |
| `photos[]` | `{ file, caption }` | |
| `deviations[]` | `{ where, what, why }` | Where the owner departed from the instructions. |
| `clarity[]` | `{ where, rating, note }` | `rating` 1–5 per row or round (`06 §6.2` phase 4). |
| `actions[]` | `{ about, kind, ref, note }` | `kind`: `calibration`, `rule`, `text-fix`, `none`. `ref`: a rule id (`R-…`), ticket (`PQW-…`) or swatch (`GS-…`). |
| `notes` | string or `null` | |

Derived, not stored: `deviation = (mean(valuesMm) − valueMm) / valueMm` per
dimension and state, and **within tolerance** when `|deviation| ≤ 5 %`
(PQW-859 acceptance criterion). The stored prediction is the one the designer
showed at the time; the regression use in `06 §6.2` recomputes it from
`pattern` and compares it with the stored measurements.

## Open

- **Final stitch ids:** PQW-867 (see above).
- **Where real data and photos live.** JSON is small and belongs in git; photos
  are several MB each. Decide before the first transcription: a data folder in
  this repository, or photos outside git with only the file names in the JSON.
- **Increase and decrease supplement.** The knowledge base gives no
  measurement protocol for them; the schema has no field yet. Define it with
  the owner, then extend the schema (new `schemaVersion` only if existing files
  break).
- **Rule register** — the second half of PQW-860.
- **Not on this sheet:** hung growth for garments and colourwork gauge
  (knowledge-base README §6 items 5 and 9). They are not needed until garments
  and tapestry are on the roadmap.
