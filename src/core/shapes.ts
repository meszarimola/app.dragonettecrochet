/*
 * Sík formák sorokban, cm-ből (PQW-862): téglalap, derékszögű és egyenlő szárú
 * háromszög, trapéz, rombusz. A kész gráfot ugyanaz az ellenőrző, rajz és írott
 * minta dolgozza fel, mint a kézzel horgoltat.
 *
 * - Szem és sor a mintasűrűségből (03 §3.1): a szélesség osztva egy szem
 *   szélességével, a magasság egy sor magasságával. A szemméret a minta
 *   profiljából jön, profil nélkül becslés (gauge.ts), és ezt a terv jelöli.
 * - Mintaismétlésnél a téglalap szemszáma „X többszöröse + Y” (03 §4.1): a
 *   legközelebbi, vagy a kívánt bőség irányába felfelé, illetve lefelé
 *   kerekítve (05 §4.2).
 * - Ferde él (03 §3.2): az él a k-adik sorig `round(D · k / (R − 1))` szemmel
 *   tolódik, ez a sorok közti egyenletes, Bresenham-féle elosztás (03 §3.4,
 *   05 §4.4). Szögből a magasság a vízszintes eltolás osztva tg θ-val, ahol θ
 *   az él szöge a függőlegestől.
 * - Szimmetrikus formában a két él ugyanúgy tolódik, ezért a sorok szemszáma
 *   páros számmal változik (03 §3.2 D, 05 §4.2).
 * - Élenként soronként legfeljebb 2 szaporítás vagy fogyasztás (03 §10 F27): 3
 *   szem egy szembe, illetve 3 szem összehorgolása. Ha több kell, a sor elején a
 *   szaporítás láncos hosszabbítás (az előző sor végén láncszemek, a sor ezekbe
 *   is horgol), a sor végén a fogyasztás meghagyott szemekkel lépcsős él
 *   (05 §4.4). Ami így nem fér a sorba, az ugyanazon az élen a szomszédos sorba
 *   kerül, ahol ez a módszer alkalmazható.
 *
 * A fordulólánc a sort kezdő szem magasságában áll, és a minta konvenciója
 * szerint számít szemnek vagy nem (tradition.ts). Minden sor végén a mintában
 * megadott szemszám a gráf számolása (06 §5.3 V3).
 */

import { stitchDimensions, type DimensionBasis } from './gauge.ts';
import { buildPieceGraph } from './graph.ts';
import { text, type CoreText } from './messages.ts';
import { gaugeContextOf } from './pattern-size.ts';
import { weakestSource } from './quantity.ts';
import { repeatCounts } from './repeat.ts';
import {
  appendRibbing,
  ribbedOpening,
  ribbedTurningChain,
  ribbingColumnMode,
  ribbingProblem,
  type RibbingCode,
  type RibbingOptions,
} from './ribbing.ts';
import { MOTIF_NAMES } from './round-generator.ts';
import { libraryFor, resolveStitch } from './stitch-variants.ts';
import { skippedChains, traditionOf, turningChainCountsFor } from './tradition.ts';
import type {
  Anchor,
  LayerEvent,
  NodeId,
  Pattern,
  Piece,
  RepeatSpec,
  Space,
  StitchDef,
  StitchDefId,
  StitchGroup,
  StitchInsertion,
  StitchNode,
  ValueSource,
} from './types.ts';
import { validatePattern } from './validate.ts';
import { withGeneratedTitle } from './pattern-title.ts';

export type FlatShape = 'rectangle' | 'right-triangle' | 'isosceles-triangle' | 'trapezoid' | 'diamond';
export type ShapeMeasure = 'height' | 'angle';
export type RepeatRounding = 'nearest' | 'up' | 'down';

export const FLAT_SHAPES: readonly FlatShape[] = ['rectangle', 'right-triangle', 'isosceles-triangle', 'trapezoid', 'diamond'];

export const SHAPE_NAMES: Readonly<Record<FlatShape, string>> = {
  rectangle: 'Téglalap',
  'right-triangle': 'Derékszögű háromszög',
  'isosceles-triangle': 'Egyenlő szárú háromszög',
  trapezoid: 'Trapéz',
  diamond: 'Rombusz',
};

/** A generátor alapszemei. */
export const SHAPE_STITCHES: readonly StitchDefId[] = ['sc', 'hdc', 'dc', 'tr'];
export const MAX_SHAPE_CM = 300;
export const MAX_SHAPE_ROWS = 400;
/** Egy sorban legfeljebb ennyi szem; a szerkesztő láncszemszámának felső határa is ennyi. */
export const MAX_SHAPE_STITCHES = 500;
/** Élenként soronként legfeljebb ennyi szaporítás vagy fogyasztás egy szembe, illetve összehorgolva (03 §10 F27). */
export const MAX_EDGE_CHANGE = 2;
export const MAX_REPEAT = 50;

export interface ShapeRepeat {
  /** X: egy ismétlés szemei. */
  readonly width: number;
  /** Y: a szélek kiegyenlítő szemei. */
  readonly edge: number;
}

export interface ShapeOptions {
  readonly shape: FlatShape;
  readonly stitch: StitchDefId;
  /** Az alsó él, rombusznál a legszélesebb sor, cm. */
  readonly widthCm: number;
  /** A magasság megadva, vagy az él szögéből számolva; téglalapnál mindig a magasság. */
  readonly measure: ShapeMeasure;
  readonly heightCm: number;
  /** A ferde él szöge a függőlegestől, fokban (03 §3.2). */
  readonly angleDeg: number;
  /** A trapéz felső éle, cm. */
  readonly topWidthCm: number;
  /** „X többszöröse + Y”; csak téglalapnál. */
  readonly repeat: ShapeRepeat | null;
  readonly rounding: RepeatRounding;
  /** Bordás szegély a felső élen, relief szemmel (PQW-909). */
  readonly ribbing?: RibbingOptions | null;
}

export const DEFAULT_SHAPE: ShapeOptions = {
  shape: 'rectangle',
  stitch: 'hdc',
  widthCm: 20,
  measure: 'height',
  heightCm: 30,
  angleDeg: 45,
  topWidthCm: 10,
  repeat: null,
  rounding: 'nearest',
  ribbing: null,
};

/* ---- Mintasűrűség ---- */

export interface ShapeGauge {
  /** Egy szem szélessége sorban, cm. */
  readonly stitchCm: number;
  /** Egy sor magassága, cm. */
  readonly rowCm: number;
  /** A leggyengébb eredet: profil nélkül becslés. */
  readonly source: ValueSource;
  readonly basis: DimensionBasis;
  /** A tű, amelyből profil nélkül becsülünk, mm. */
  readonly hookMm: number;
}

/** A szem mérete sorban a minta kiválasztott profiljából, profil nélkül becsléssel. */
export function shapeGauge(pattern: Pattern, stitch: StitchDefId): ShapeGauge {
  const def = resolveStitch(stitch) ?? resolveStitch('sc')!;
  const context = gaugeContextOf(pattern, libraryFor(pattern));
  const size = stitchDimensions(def, 'row', context)!;
  return {
    stitchCm: size.widthMm.value / 10,
    rowCm: size.heightMm.value / 10,
    source: weakestSource([size.widthMm.source, size.heightMm.source]),
    basis: size.basis,
    hookMm: context.hookMm,
  };
}

/* ---- Terv ---- */

/** Egy sor elején és végén a változás az előző sorhoz képest: pozitív szaporítás, negatív fogyasztás. */
export interface RowShaping {
  readonly start: number;
  readonly end: number;
}

export interface ShapePlan {
  readonly shape: FlatShape;
  readonly stitch: StitchDefId;
  readonly gauge: ShapeGauge;
  /** Soronként a szemszám láncos hosszabbítás nélkül; a 0. elem az 1. sor. */
  readonly counts: readonly number[];
  /** Soronként az alakítás; az 1. soré mindig 0. */
  readonly shaping: readonly RowShaping[];
  /** A legszélesebb sor, cm. */
  readonly widthCm: number;
  readonly heightCm: number;
  readonly bottomWidthCm: number;
  readonly topWidthCm: number;
  /** A ferde él tényleges szöge a függőlegestől, fokban; téglalapnál `null`. */
  readonly angleDeg: number | null;
  /** Mintaismétlésnél az ismétlések száma, különben `null`. */
  readonly repeats: number | null;
  /** Azok a sorok (1-től), amelyek végén láncos hosszabbítás van. */
  readonly chainExtensionRows: readonly number[];
  /** Azok a sorok (1-től), amelyek végén szemek maradnak meghagyva. */
  readonly unworkedRows: readonly number[];
}

/**
 * A forma elutasításának kódjai (PQW-904): a mag kódot és adatot ad, a mondatot
 * a felület állítja össze (`src/ui/i18n/core/shape.ts`).
 *
 * Az `internal-error` a „ez a program hibája” esetek közös kódja: `rule` a
 * megbukott ellenőrzési szabály, `row` (és `shape`) a tervtől eltérő sor, adat
 * nélkül a hiányos sorterv.
 */
export type ShapeCode =
  | 'shape-basic-stitch-only'
  | 'shape-width-range'
  | 'shape-height-range'
  | 'shape-angle-range'
  | 'shape-top-width-range'
  | 'shape-repeat-rectangle-only'
  | 'shape-repeat-width-range'
  | 'shape-repeat-edge-range'
  | 'shape-too-narrow'
  | 'shape-max-stitches-width'
  | 'shape-max-stitches-size'
  | 'shape-trapezoid-equal-edges'
  | 'shape-diamond-too-narrow'
  | 'shape-min-rows'
  | 'shape-max-rows'
  | 'shape-too-steep'
  | 'shape-row-too-narrow'
  | 'internal-error'
  | RibbingCode;

export type ShapeText = CoreText<ShapeCode>;

export type ShapePlanResult = { readonly ok: true; readonly plan: ShapePlan } | { readonly ok: false; readonly reason: ShapeText };
export type ShapeResult =
  | { readonly ok: true; readonly pattern: Pattern; readonly plan: ShapePlan }
  | { readonly ok: false; readonly reason: ShapeText };

const fail = (reason: ShapeText): { readonly ok: false; readonly reason: ShapeText } => ({ ok: false, reason });

/** Mi nem választható: hiányzó vagy tartományon kívüli méret, a formához nem illő mintaismétlés. */
export function shapeProblem(options: ShapeOptions): ShapeText | null {
  const cm = (value: number) => Number.isFinite(value) && value > 0 && value <= MAX_SHAPE_CM;
  if (!SHAPE_STITCHES.includes(options.stitch)) {
    return text('shape-basic-stitch-only');
  }
  if (options.ribbing) {
    const ribbing = ribbingProblem(options.ribbing);
    if (ribbing !== null) return ribbing;
  }
  if (!cm(options.widthCm)) return text('shape-width-range', { max: MAX_SHAPE_CM });
  if (options.shape === 'rectangle' || options.measure === 'height') {
    if (!cm(options.heightCm)) return text('shape-height-range', { max: MAX_SHAPE_CM });
  } else if (!(Number.isFinite(options.angleDeg) && options.angleDeg >= 1 && options.angleDeg <= 89)) {
    return text('shape-angle-range');
  }
  if (options.shape === 'trapezoid' && !(Number.isFinite(options.topWidthCm) && options.topWidthCm >= 0 && options.topWidthCm <= MAX_SHAPE_CM)) {
    return text('shape-top-width-range', { max: MAX_SHAPE_CM });
  }
  if (options.repeat) {
    if (options.shape !== 'rectangle') return text('shape-repeat-rectangle-only');
    const { width, edge } = options.repeat;
    if (!Number.isInteger(width) || width < 1 || width > MAX_REPEAT) return text('shape-repeat-width-range', { max: MAX_REPEAT });
    if (!Number.isInteger(edge) || edge < 0 || edge > MAX_REPEAT) return text('shape-repeat-edge-range', { max: MAX_REPEAT });
  }
  return null;
}

/** Kerekítés a nullától távolabbi egészre félnél; a lebegőpontos zajt elnyeli. */
const roundAway = (x: number) => Math.sign(x) * Math.round(Math.abs(x) + 1e-9);

/** Az él eltolása a k-adik sorig egyenesen: `D · k / steps`, egészre kerekítve (03 §3.4). */
const line = (d: number, steps: number, k: number) => (steps === 0 ? d : roundAway((d * k) / steps));

type Edge = 'right' | 'left';

/** Az 1. sor a láncalap végéről indul: a páratlan sorok a jobb, a párosak a bal élen kezdődnek (01 §8.4). */
const startEdge = (row: number): Edge => (row % 2 === 1 ? 'right' : 'left');

/**
 * Egy él (a derékszögű háromszög ferde éle) soronkénti változása úgy, hogy
 * legfeljebb 2 kerüljön egy szembe (03 §10 F27). A sor elején a szaporítás, a
 * sor végén a fogyasztás lehet több (láncos hosszabbítás, meghagyott szemek);
 * ami máshol több, az ugyanazon az élen a szomszédos sorba kerül. `null`, ha
 * nincs hová tenni.
 */
function edgeChanges(offsets: readonly number[], edge: Edge): number[] | null {
  const rows = offsets.length;
  const delta = offsets.map((value, k) => (k === 0 ? 0 : value - offsets[k - 1]!));
  const role = (k: number) => (startEdge(k + 1) === edge ? 'start' : 'end');
  const tooMany = (k: number) =>
    (delta[k]! > MAX_EDGE_CHANGE && role(k) === 'end') || (delta[k]! < -MAX_EDGE_CHANGE && role(k) === 'start');
  for (let guard = 0; guard <= 4 * rows; guard += 1) {
    const k = delta.findIndex((_, i) => i > 0 && tooMany(i));
    if (k < 0) return delta;
    const sign = Math.sign(delta[k]!);
    const excess = delta[k]! - sign * MAX_EDGE_CHANGE;
    delta[k] = sign * MAX_EDGE_CHANGE;
    // A szaporítás a következő sor elejére, a fogyasztás az előző sor végére kerül; a széleken a másik irányba.
    const to = (sign > 0 ? [k + 1, k - 1] : [k - 1, k + 1]).find((i) => i >= 1 && i < rows);
    if (to === undefined) return null;
    delta[to] += excess;
  }
  return null;
}

/**
 * Szimmetrikus formában mindkét él ugyanazt a célt követi, és a sor teljes
 * változása a két cél összege, tehát páros (03 §3.2 D, 05 §4.2). Ha az egyik
 * élre több jutna, mint amennyi ott egy szembe fér (a sor végén szaporítás, a
 * sor elején fogyasztás), a többlet ugyanebben a sorban a másik élre kerül,
 * ahol láncos hosszabbítással vagy meghagyott szemekkel megoldható; a
 * következő sorban az élek szerepe cserélődik, és a lemaradás kiegyenlítődik.
 */
function symmetricShaping(offsets: readonly number[]): RowShaping[] {
  const shaping: RowShaping[] = [{ start: 0, end: 0 }];
  const current: Record<Edge, number> = { right: 0, left: 0 };
  for (let k = 1; k < offsets.length; k += 1) {
    const first = startEdge(k + 1);
    const last: Edge = first === 'right' ? 'left' : 'right';
    let start = offsets[k]! - current[first];
    let end = offsets[k]! - current[last];
    if (end > MAX_EDGE_CHANGE) {
      start += end - MAX_EDGE_CHANGE;
      end = MAX_EDGE_CHANGE;
    }
    if (start < -MAX_EDGE_CHANGE) {
      end += start + MAX_EDGE_CHANGE;
      start = -MAX_EDGE_CHANGE;
    }
    current[first] += start;
    current[last] += end;
    shaping.push({ start, end });
  }
  return shaping;
}

/** A téglalap szemszáma „X többszöröse + Y”-ra kerekítve (03 §4.1, 05 §4.2). */
function repeatWidth(
  pattern: Pattern,
  options: ShapeOptions,
  def: StitchDef,
  counting: boolean,
  exact: number,
  minCount: number,
): { readonly stitches: number; readonly repeats: number } {
  const { width, edge } = options.repeat!;
  const spec: RepeatSpec = { repeatWidth: width, edgeStitches: edge, turningChainIncluded: pattern.conventions.repeat?.turningChainIncluded ?? false };
  const tradition = traditionOf(pattern.conventions);
  const at = (n: number) => repeatCounts(spec, n, def.turningChain, counting, tradition).firstRowPositions;
  const n0 = (exact - at(0)) / width;
  let n = options.rounding === 'up' ? Math.ceil(n0 - 1e-9) : options.rounding === 'down' ? Math.floor(n0 + 1e-9) : Math.floor(n0 + 0.5);
  n = Math.max(1, n);
  while (at(n) < minCount) n += 1;
  return { stitches: at(n), repeats: n };
}

/** A forma soronkénti terve a minta mintasűrűségével; a gráfot a `generateShape` építi. */
export function planShape(pattern: Pattern, options: ShapeOptions): ShapePlanResult {
  const problem = shapeProblem(options);
  if (problem) return fail(problem);
  const def = resolveStitch(options.stitch)!;
  const gauge = shapeGauge(pattern, options.stitch);
  const counting = turningChainCountsFor(pattern.conventions.turningChainCounts, def, traditionOf(pattern.conventions), 'row');
  const minCount = counting ? 2 : 1;
  /** A legkisebb sor, amelybe az élek páros változással eljutnak: a szemszám párossága nem változik. */
  const smallest = (n: number) => ((n - minCount) % 2 === 0 ? minCount : minCount + 1);
  const exact = (cm: number) => cm / gauge.stitchCm;
  const rowsFor = (cm: number) => Math.round(cm / gauge.rowCm);
  const heightFromRun = (runCm: number) => runCm / Math.tan((options.angleDeg * Math.PI) / 180);
  const byAngle = options.measure === 'angle' && options.shape !== 'rectangle';

  let base: number;
  let repeats: number | null = null;
  if (options.repeat) {
    ({ stitches: base, repeats } = repeatWidth(pattern, options, def, counting, exact(options.widthCm), minCount));
  } else base = Math.round(exact(options.widthCm));
  if (base < minCount) return fail(text('shape-too-narrow', { min: minCount }));
  if (base > MAX_SHAPE_STITCHES) return fail(text('shape-max-stitches-width', { max: MAX_SHAPE_STITCHES }));

  let rows: number;
  /** Az él eltolása a k-adik sorig: szimmetrikus formában mindkét élé, a derékszögű háromszögben a ferde élé. */
  let edge: (k: number) => number = () => 0;
  let first = base;
  let minRows = 1;
  switch (options.shape) {
    case 'rectangle':
      rows = rowsFor(options.heightCm);
      break;
    case 'right-triangle': {
      const d = minCount - base;
      rows = rowsFor(byAngle ? heightFromRun(-d * gauge.stitchCm) : options.heightCm);
      edge = (k) => line(d, rows - 1, k);
      minRows = 2;
      break;
    }
    case 'isosceles-triangle':
    case 'trapezoid': {
      let d = (smallest(base) - base) / 2;
      if (options.shape === 'trapezoid') {
        d = Math.max(d, roundAway((Math.round(exact(options.topWidthCm)) - base) / 2));
        if (byAngle && d === 0) return fail(text('shape-trapezoid-equal-edges'));
      }
      rows = rowsFor(byAngle ? heightFromRun(Math.abs(d) * gauge.stitchCm) : options.heightCm);
      edge = (k) => line(d, rows - 1, k);
      minRows = d === 0 ? 1 : 2;
      break;
    }
    case 'diamond': {
      first = smallest(base);
      const d = (base - first) / 2;
      if (d === 0) return fail(text('shape-diamond-too-narrow'));
      rows = rowsFor(byAngle ? 2 * heightFromRun(d * gauge.stitchCm) : options.heightCm);
      const middle = Math.floor((rows - 1) / 2);
      edge = (k) => (k <= middle ? line(d, middle, k) : line(d, rows - 1 - middle, rows - 1 - k));
      minRows = 3;
      break;
    }
  }
  if (rows < minRows) return fail(text('shape-min-rows', { rows: minRows }));
  if (rows > MAX_SHAPE_ROWS) return fail(text('shape-max-rows', { max: MAX_SHAPE_ROWS }));

  const offsets = Array.from({ length: rows }, (_, k) => edge(k));
  let shaping: RowShaping[];
  if (options.shape === 'right-triangle') {
    // A ferde él a bal oldali: a páros sorok elején, a páratlanok végén.
    const changes = edgeChanges(offsets, 'left');
    if (!changes) return fail(text('shape-too-steep'));
    shaping = changes.map((change, k) => (startEdge(k + 1) === 'left' ? { start: change, end: 0 } : { start: 0, end: change }));
  } else shaping = symmetricShaping(offsets);

  const counts: number[] = [];
  shaping.forEach((row, k) => counts.push(k === 0 ? first : counts[k - 1]! + row.start + row.end));
  if (counts.some((count) => count < minCount)) return fail(text('shape-too-steep'));
  if (counts.some((count) => count > MAX_SHAPE_STITCHES)) return fail(text('shape-max-stitches-size', { max: MAX_SHAPE_STITCHES }));

  const widest = Math.max(...counts);
  const heightCm = rows * gauge.rowCm;
  let angleDeg: number | null = null;
  if (options.shape !== 'rectangle') {
    // A ferde él vízszintes eltolása és magassága; rombusznál a szélesedő fél.
    const edges = options.shape === 'right-triangle' ? 1 : 2;
    const riseRows = options.shape === 'diamond' ? counts.indexOf(widest) + 1 : rows;
    const run = (Math.abs(options.shape === 'diamond' ? widest - counts[0]! : counts[0]! - counts[rows - 1]!) / edges) * gauge.stitchCm;
    angleDeg = (Math.atan2(run, riseRows * gauge.rowCm) * 180) / Math.PI;
  }

  const plan: ShapePlan = {
    shape: options.shape,
    stitch: options.stitch,
    gauge,
    counts,
    shaping,
    widthCm: widest * gauge.stitchCm,
    heightCm,
    bottomWidthCm: counts[0]! * gauge.stitchCm,
    topWidthCm: counts[rows - 1]! * gauge.stitchCm,
    angleDeg,
    repeats,
    chainExtensionRows: shaping.flatMap((row, k) => (row.start > MAX_EDGE_CHANGE ? [k] : [])),
    unworkedRows: shaping.flatMap((row, k) => (row.end < -MAX_EDGE_CHANGE ? [k + 1] : [])),
  };
  return { ok: true, plan };
}

/** A minta konvenciói a formához: mintaismétlésnél az „X többszöröse + Y” a minta konvenciója lesz. */
function shapeConventions(pattern: Pattern, options: ShapeOptions): Pattern['conventions'] {
  if (!options.repeat) return pattern.conventions;
  return {
    ...pattern.conventions,
    repeat: {
      repeatWidth: options.repeat.width,
      edgeStitches: options.repeat.edge,
      turningChainIncluded: pattern.conventions.repeat?.turningChainIncluded ?? false,
    },
  };
}

/**
 * Soronként a sor két széle szemben, a diagram szerint balról jobbra; az 1.
 * sor bal széle a 0. A páratlan sorok a jobb szélen kezdődnek (01 §8.4), így a
 * sor elejének változása ott, a végéé a bal szélen látszik. Az előnézet
 * körvonala ebből készül.
 */
export function rowExtents(plan: ShapePlan): { readonly left: number; readonly right: number }[] {
  let left = 0;
  let right = plan.counts[0]!;
  return plan.shaping.map((row, k) => {
    if (k > 0) {
      const [atRight, atLeft] = startEdge(k + 1) === 'right' ? [row.start, row.end] : [row.end, row.start];
      right += atRight;
      left -= atLeft;
    }
    return { left, right };
  });
}

/* ---- Gráfépítés ---- */

type Unit = { readonly kind: 'inc'; readonly w: number; readonly n: number } | { readonly kind: 'tog'; readonly from: number; readonly n: number };

class RowWriter {
  readonly stitches: StitchNode[] = [];
  readonly spaces: Space[] = [];
  readonly groups: StitchGroup[] = [];
  readonly events: LayerEvent[] = [];
  readonly skipped: NodeId[] = [];
  private previous: NodeId | null = null;

  add(def: StitchDefId, anchors: readonly Anchor[] = []): NodeId {
    const id = `n${this.stitches.length + 1}`;
    this.stitches.push({ id, def, prev: this.previous, anchors });
    this.previous = id;
    return id;
  }

  /** A láncszemek azonosítói: relief szem nem mehet láncszem köré, ezért a bordázatnak tudnia kell róluk. */
  readonly chainIds = new Set<NodeId>();

  chains(count: number): NodeId[] {
    return Array.from({ length: count }, () => {
      const id = this.add('ch');
      this.chainIds.add(id);
      return id;
    });
  }

  /** Láncos hosszabbítás a sor végén: a láncszemek egy láncívet adnak, a következő sor egyenként horgol beléjük. */
  extension(count: number): NodeId[] {
    const chains = this.chains(count);
    this.spaces.push({ id: `s${this.spaces.length + 1}`, chains });
    return chains;
  }

  /** `n` szem egy célpontba; kettőtől szaporításként. A mód alapból mindkét szál; bordázatnál relief (PQW-913). */
  into(def: StitchDef, target: NodeId, n: number, mode: StitchInsertion = 'both-loops'): NodeId[] {
    const ids = Array.from({ length: n }, () => this.add(def.id, [{ into: 'stitch', id: target, mode }]));
    if (n >= 2) this.groups.push({ id: `g${this.groups.length + 1}`, def: `inc-${n}${def.id}`, members: ids });
    return ids;
  }

  unit(def: StitchDef, working: readonly NodeId[], unit: Unit, mode: StitchInsertion = 'both-loops'): NodeId[] {
    if (unit.kind === 'inc') return this.into(def, working[unit.w]!, unit.n, mode);
    return [
      this.add(
        `${def.id}${unit.n}tog`,
        working.slice(unit.from, unit.from + unit.n).map((id): Anchor => ({ into: 'stitch', id, mode })),
      ),
    ];
  }

  /**
   * Egy sor az előző sor pozícióiba (`working`: a haladási irányban). A
   * `seat`: a sor számító fordulólánca az első pozíción ül, abba alapból nem
   * horgolunk (03 §1.3). Visszaadja a sor új szemeit a fonal sorrendjében,
   * vagy az okot, ha a sor ehhez túl keskeny.
   */
  row(
    def: StitchDef,
    working: readonly NodeId[],
    seat: boolean,
    shaping: RowShaping,
    row: number,
    /** A beszúrási mód a haladási irány szerinti pozícióhoz; bordás sorban relief (PQW-913). */
    mode?: (column: number) => StitchInsertion,
  ): NodeId[] | ShapeText {
    const at = (column: number): StitchInsertion => mode?.(column) ?? 'both-loops';
    // A magyar névelő a felületé: a mag csak a sor számát adja (PQW-904).
    const tooNarrow = text('shape-row-too-narrow', { row });
    let lo = seat ? 1 : 0;
    let hi = working.length - 1;
    let seated = 0;
    let head: Unit | null = null;
    let tail: Unit | null = null;
    let leave = 0;

    if (shaping.start > 0 && seat) seated = shaping.start;
    else if (shaping.start > 0) head = { kind: 'inc', w: lo++, n: shaping.start + 1 };
    else if (shaping.start < 0) {
      head = { kind: 'tog', from: lo, n: 1 - shaping.start };
      lo += head.n;
    }
    if (shaping.end > 0) tail = { kind: 'inc', w: hi--, n: shaping.end + 1 };
    else if (shaping.end < -MAX_EDGE_CHANGE) {
      leave = -shaping.end;
      hi -= leave;
    } else if (shaping.end < 0) {
      tail = { kind: 'tog', from: hi + shaping.end, n: 1 - shaping.end };
      hi -= tail.n;
    }

    if (hi - lo + 1 === -1 && head && tail && head.kind === tail.kind) {
      // Keskeny sorban a két él egy szemben találkozik: egy szaporítás vagy egy összehorgolás (a forma csúcsa).
      head = head.kind === 'inc' ? { kind: 'inc', w: head.w, n: head.n + tail.n - 1 } : { kind: 'tog', from: head.from, n: head.n + tail.n - 1 };
      tail = null;
      hi = lo - 1;
    }
    if (hi - lo + 1 < 0 || lo > working.length) return tooNarrow;
    if ([head, tail].some((unit) => unit !== null && unit.n > 12)) return tooNarrow;

    const produced: NodeId[] = [];
    if (seated > 0) produced.push(...this.into(def, working[0]!, seated, at(0)));
    if (head) produced.push(...this.unit(def, working, head, at(head.kind === 'inc' ? head.w : head.from)));
    for (let w = lo; w <= hi; w += 1) produced.push(this.add(def.id, [{ into: 'stitch', id: working[w]!, mode: at(w) }]));
    if (tail) produced.push(...this.unit(def, working, tail, at(tail.kind === 'inc' ? tail.w : tail.from)));
    this.skipped.push(...working.slice(hi + 1, hi + 1 + leave));
    return produced;
  }

  event(kind: LayerEvent['kind'], resume?: LayerEvent['resume']): void {
    this.events.push({ after: this.previous!, kind, ...(resume ? { resume } : {}) });
    // A fonal elvágása után új fonalszakasz kezdődik: a következő szem előzmény nélküli (06 §5.3 V2).
    if (kind === 'fasten-off') this.previous = null;
  }
}

/** A sorok szemgráfja a szemszámokból és az alakításból; hiba esetén az ok. */
function buildRows(
  pattern: Pattern,
  stitch: StitchDefId,
  counts: readonly number[],
  shapingRows: readonly RowShaping[],
  /** Bordázat az alsó szegély sorain (PQW-913); az 1. sor sima marad. */
  ribbing: RibbingOptions | null = null,
): RowWriter | ShapeText {
  const writer = new RowWriter();
  const def = resolveStitch(stitch)!;
  const tradition = traditionOf(pattern.conventions);
  const counting = turningChainCountsFor(pattern.conventions.turningChainCounts, def, tradition, 'row');
  const rows = counts.length;

  // Láncalap: a sor szemei és a kihagyott láncszemek; minden láncszembe egy szem megy (03 §1.2, PQW-924).
  const worked = counts[0]!;
  const foundation = writer.chains(worked + skippedChains(def.turningChain, counting));
  let below = foundation.slice(0, worked);

  /*
   * A bordázat az alsó szegély sorain (PQW-913): az 1. sor sima marad, mert a láncalap köré nem lehet relief
   * szemet horgolni. A bordás sor fordulólánca rövidebb, és sorban a fordulóláncnak nincs ülő pozíciója (PQW-924); a
   * relief mód a célpont oszlopát követi, így a bordák felfelé végigfutnak.
   */
  const ribUntil = ribbing === null ? 0 : Math.min(rows, 1 + ribbing.rows);
  const column = new Map<NodeId, number>();
  for (let k = 0; k < rows; k += 1) {
    const ribbed = ribbing !== null && k + 1 >= 2 && k + 1 <= ribUntil;
    if (ribbed) {
      const opening = writer.events[writer.events.length - 1];
      if (opening) writer.events[writer.events.length - 1] = ribbedOpening(opening);
      writer.chains(ribbedTurningChain(def));
    } else if (k > 0) writer.chains(def.turningChain);
    const shaping = shapingRows[k]!;
    // A sok szemes szaporítás a sor elején az előző sor láncos hosszabbítása: ebben a sorban már sima.
    const own = { start: shaping.start > MAX_EDGE_CHANGE ? 0 : shaping.start, end: shaping.end };
    const working = [...below].reverse();
    if (ribbed && column.size === 0) working.forEach((node, i) => column.set(node, i));
    const mode =
      ribbed && ribbing !== null
        ? (w: number) => {
            const target = working[w]!;
            // Láncszem köré sima szem megy: a láncos hosszabbítás ilyen.
            return writer.chainIds.has(target) ? ('both-loops' as const) : ribbingColumnMode(column.get(target) ?? 0, ribbing.width);
          }
        : undefined;
    /*
     * Sorban nincs „ülőhely” a fordulóláncnak (PQW-924): az alatta lévő sor
     * minden szemébe kerül egy szem, a fordulólánc csak magasságot ad.
     */
    const made = writer.row(def, working, false, own, k + 1, mode);
    if (!Array.isArray(made)) return made;
    if (ribbed) made.forEach((node, i) => column.set(node, column.get(working[i]!) ?? 0));
    // A fordulólánc teteje nem célpont: a következő sor az előző sor szemeibe horgol (PQW-924).
    below = [...made];
    const next = shapingRows[k + 1];
    if (next && next.start > MAX_EDGE_CHANGE) below.push(...writer.extension(next.start));
    writer.event(k < rows - 1 ? 'turn' : 'fasten-off');
  }
  return writer;
}

/**
 * Új minta a formából. A mintából a címet (ha nem az alapértelmezett vagy egy
 * generátor adta), a jelölést, a profilokat és a konvenciókat veszi át;
 * mintaismétlésnél az „X többszöröse + Y” a minta konvenciója lesz.
 */
export function generateShape(pattern: Pattern, options: ShapeOptions): ShapeResult {
  const planned = planShape(pattern, options);
  if (!planned.ok) return planned;
  const { plan } = planned;
  const base: Pattern = { ...pattern, conventions: shapeConventions(pattern, options), pieces: [] };
  const built = buildRows(base, plan.stitch, plan.counts, plan.shaping);
  if (!(built instanceof RowWriter)) return fail(built);

  const name = SHAPE_NAMES[options.shape];
  const piece: Piece = {
    id: 'p1',
    name,
    stitches: built.stitches,
    spaces: built.spaces,
    rings: [],
    groups: built.groups,
    events: built.events,
    skipped: built.skipped,
  };
  const stated = withStatedCounts(base, piece, plan.counts);
  if ('code' in stated) return fail(stated);
  const rowsPattern: Pattern = { ...base, pieces: [stated] };
  // A bordás szegély a felső élen, a sorok után (PQW-909).
  const ribbed = options.ribbing ? appendRibbing(rowsPattern, stated, libraryFor(rowsPattern), options.ribbing) : stated;
  if ('code' in ribbed) return fail(ribbed);

  const result = withGeneratedTitle({ ...base, pieces: [ribbed] }, pattern, name, [...Object.values(SHAPE_NAMES), ...Object.values(MOTIF_NAMES)]);
  const errors = validatePattern(result, libraryFor(result)).filter((finding) => finding.severity === 'error');
  if (errors.length > 0) return fail(text('internal-error', { rule: errors[0]!.rule }));
  return { ok: true, pattern: result, plan };
}

/**
 * A sor végi eseményekbe a gráf szerinti szemszám. A láncos hosszabbítás
 * láncszemei a minta számolása szerint számítanak a sor szemszámába (PQW-870):
 * alapból a belehorgoltak, és számító fordulóláncnál az utolsó láncszemen a
 * fordulólánc ül, abba nem horgolunk. A többi szemnek a tervvel egyeznie kell.
 */
function withStatedCounts(pattern: Pattern, piece: Piece, counts: readonly number[]): Piece | ShapeText {
  const whole = { ...pattern, pieces: [piece] };
  const graph = buildPieceGraph(whole, piece, libraryFor(whole));
  const extension = new Set(piece.spaces.flatMap((space) => space.chains));
  const anchored = new Set(piece.stitches.flatMap((node) => node.anchors.flatMap((anchor) => (anchor.into === 'stitch' ? [anchor.id] : []))));
  const stated = new Map<NodeId, number>();
  for (const layer of graph.layers.slice(1)) {
    // A `stitchCount` a szerkezeté: a belehorgolt bővítőlánc szem, a többi nem (PQW-940).
    const counted = layer.stitches.filter((id) => extension.has(id) && anchored.has(id)).length;
    if (layer.stitchCount - counted !== counts[layer.index - 1]) {
      return text('internal-error', { row: layer.index });
    }
    if (layer.closing) stated.set(layer.closing.after, layer.writtenCount);
  }
  return { ...piece, events: piece.events.map((event) => ({ ...event, statedCount: stated.get(event.after)! })) };
}

/**
 * Sorokban horgolt darab kész szemszámokból és alakításból (PQW-866): a
 * ruhadarab részeit (hátrész, elejerész, ujj) a ruhadarab-generátor tervezi,
 * a gráfot ez építi, ugyanúgy, mint a Forma szakasz sorait. A `counts[k]` az
 * előző sor szemszáma a `shaping[k]` változással. A sorvégi szemszám a gráf
 * számolása; hibánál az ok.
 */
/** Egy szakasz sorai: hol folytatódik, hol kezdődik az alatta lévő soron, és soronként a szemszám (PQW-901). */
export interface RowSection {
  /** A szakasz neve az írott mintában; az első szakasznak nincs. */
  readonly name?: string;
  /** Melyik sor fölött folytatódik (1-től); az első szakasznak nincs. */
  readonly over?: number;
  /** Hány pozíciót hagyunk ki az alatta lévő sor elején, a haladási irányban. */
  readonly from?: number;
  /** Hány pozícióra terjed ki a szakasz első sora; hiányában a sor végéig. */
  readonly span?: number;
  /** Soronként a szemszám; a 0. elem a szakasz első sora. */
  readonly counts: readonly number[];
  readonly shaping: readonly RowShaping[];
}

/**
 * Sorokban horgolt darab több szakaszból (PQW-901): a fonal elvágása után a
 * munka a megadott sor fölött, más helyről folytatódik. Így lesz egy darabon
 * belül a nyakkivágás két oldalán a két váll. Amelyik pozíciót egyik szakasz
 * sem használja fel, az szándékosan kihagyott: ez a nyak közepe.
 */
export function plannedSections(
  pattern: Pattern,
  stitch: StitchDefId,
  sections: readonly RowSection[],
  name: string,
  id = 'p1',
  /** Bordázat az alsó szegély sorain (PQW-913): csak az első szakaszban, a darab alján. */
  ribbing: RibbingOptions | null = null,
): Piece | ShapeText {
  const broken = text('internal-error');
  if (sections.length === 0 || sections.some((section) => section.counts.length === 0 || section.counts.length !== section.shaping.length)) return broken;
  const base: Pattern = { ...pattern, pieces: [] };
  const writer = new RowWriter();
  const def = resolveStitch(stitch)!;
  const tradition = traditionOf(base.conventions);
  const counting = turningChainCountsFor(base.conventions.turningChainCounts, def, tradition, 'row');

  // Rétegenként a pozíciók a fonal sorrendjében; a 0. a láncalap.
  const positions: NodeId[][] = [];
  let layer = 0;
  /** A bordázat oszlopai: a szem a célpontja oszlopát viszi tovább, így a bordák felfelé végigfutnak. */
  const ribColumn = new Map<NodeId, number>();

  for (const [s, section] of sections.entries()) {
    let below: NodeId[];
    if (s === 0) {
      // Láncalap: a sor szemei és a kihagyott láncszemek (03 §1.2, PQW-924).
      const worked = section.counts[0]!;
      const foundation = writer.chains(worked + skippedChains(def.turningChain, counting));
      positions[0] = foundation.slice(0, worked);
      below = [...positions[0]!];
    } else {
      const over = section.over ?? 0;
      if (over < 1 || over > layer || positions[over] === undefined) return broken;
      below = [...positions[over]!];
    }
    for (let k = 0; k < section.counts.length; k += 1) {
      // A bordázat a darab alján van: csak az első szakasz 2. sorától, mert a láncalap köré nem megy relief szem.
      const ribbed = ribbing !== null && s === 0 && k + 1 >= 2 && k + 1 <= Math.min(section.counts.length, 1 + ribbing.rows);
      if (ribbed) {
        const opening = writer.events[writer.events.length - 1];
        if (opening) writer.events[writer.events.length - 1] = ribbedOpening(opening);
        writer.chains(ribbedTurningChain(def));
      } else if (s > 0 || k > 0) writer.chains(def.turningChain);
      // A szakasz első sora az alatta lévő sor egy szakaszán dolgozik; a többi sora a saját előző során.
      const from = k === 0 ? Math.max(0, section.from ?? 0) : 0;
      const span = k === 0 ? section.span : undefined;
      const working = [...below].reverse().slice(from, span === undefined ? undefined : from + span);
      if (ribbed && ribColumn.size === 0) working.forEach((node, i) => ribColumn.set(node, i));
      const mode =
        ribbed && ribbing !== null
          ? (w: number) => {
              const target = working[w]!;
              return writer.chainIds.has(target) ? ('both-loops' as const) : ribbingColumnMode(ribColumn.get(target) ?? 0, ribbing.width);
            }
          : undefined;
      // Sorban nincs „ülőhely” a fordulóláncnak (PQW-924).
      const made = writer.row(def, working, false, section.shaping[k]!, layer + 1, mode);
      if (!Array.isArray(made)) return made;
      if (ribbed) made.forEach((node, i) => ribColumn.set(node, ribColumn.get(working[i]!) ?? 0));
      // A fordulólánc teteje nem célpont: a következő sor az előző sor szemeibe horgol (PQW-924).
    below = [...made];
      layer += 1;
      positions[layer] = below;
      if (k < section.counts.length - 1) {
        writer.event('turn');
        continue;
      }
      // A következő szakasz vagy az imént befejezett sor fölött folytatódik (akkor csak fordítunk, az első váll),
      // vagy máshol: ilyenkor a fonalat elvágjuk, és az elvágás mondja meg, hol folytatódik (PQW-901).
      const next = sections[s + 1];
      if (next === undefined) writer.event('fasten-off');
      else if ((next.over ?? 0) === layer) writer.event('turn');
      else writer.event('fasten-off', { layer: next.over ?? 0, ...(next.name === undefined ? {} : { name: next.name }) });
    }
  }

  // A megosztott sorban egyik szakasz által sem használt pozíciók: a nyak közepe (03 §10 B8). A szakasz első
  // pozíciója a fordulóláncát tartja, abba nem horgolunk: az nem kihagyott szem (03 §1.3).
  const used = new Set<NodeId>();
  for (const node of writer.stitches) for (const anchor of node.anchors) if (anchor.into === 'stitch') used.add(anchor.id);
  const seats = new Set<NodeId>();
  if (counting) {
    for (const section of sections) {
      if (section.over === undefined) continue;
      const seat = [...(positions[section.over] ?? [])].reverse()[Math.max(0, section.from ?? 0)];
      if (seat !== undefined) seats.add(seat);
    }
  }
  const shared = new Set(
    sections.flatMap((section) => (section.over === undefined ? [] : (positions[section.over] ?? []).filter((node) => !seats.has(node)))),
  );
  const piece: Piece = {
    id,
    name,
    stitches: writer.stitches,
    spaces: writer.spaces,
    rings: [],
    groups: writer.groups,
    events: writer.events,
    // A sor végén meghagyott szemeket a sorépítő már felvette: a lista egyszer sorolja őket.
    skipped: [...new Set([...writer.skipped, ...[...shared].filter((node) => !used.has(node))])],
  };
  return withStatedCounts(base, piece, sections.flatMap((section) => section.counts));
}

export function plannedRows(
  pattern: Pattern,
  stitch: StitchDefId,
  counts: readonly number[],
  shaping: readonly RowShaping[],
  name: string,
  id = 'p1',
  /** Bordázat az alsó szegély, illetve a mandzsetta sorain (PQW-913). */
  ribbing: RibbingOptions | null = null,
): Piece | ShapeText {
  if (counts.length === 0 || shaping.length !== counts.length) return text('internal-error');
  const base: Pattern = { ...pattern, pieces: [] };
  const built = buildRows(base, stitch, counts, shaping, ribbing);
  if (!(built instanceof RowWriter)) return built;
  const piece: Piece = {
    id,
    name,
    stitches: built.stitches,
    spaces: built.spaces,
    rings: [],
    groups: built.groups,
    events: built.events,
    skipped: built.skipped,
  };
  return withStatedCounts(base, piece, counts);
}
