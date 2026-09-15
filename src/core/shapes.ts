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

import { MIN_BORDER_WIDTH, borderCounts, rowEndStitches, type BorderCounts } from './border.ts';
import { stitchDimensions, type DimensionBasis } from './gauge.ts';
import { buildPieceGraph } from './graph.ts';
import { gaugeContextOf } from './pattern-size.ts';
import { weakestSource } from './quantity.ts';
import { repeatCounts } from './repeat.ts';
import { MOTIF_NAMES } from './round-generator.ts';
import { libraryFor, resolveStitch } from './stitch-variants.ts';
import { hasBaseChain, traditionOf, turningChainCountsFor } from './tradition.ts';
import type {
  Anchor,
  LayerEvent,
  NodeId,
  Pattern,
  Piece,
  PieceBorder,
  RepeatSpec,
  Space,
  StitchDef,
  StitchDefId,
  StitchGroup,
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
  /** Szegély a darab körül; csak téglalapnál. */
  readonly border: PieceBorder | null;
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
  border: null,
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
  readonly border: BorderCounts | null;
  /** A méret a szegéllyel együtt, cm, a rövidpálca méretének eredetével is; szegély nélkül `null`. */
  readonly borderedCm: { readonly widthCm: number; readonly heightCm: number; readonly source: ValueSource } | null;
}

export type ShapePlanResult = { readonly ok: true; readonly plan: ShapePlan } | { readonly ok: false; readonly reason: string };
export type ShapeResult =
  | { readonly ok: true; readonly pattern: Pattern; readonly plan: ShapePlan }
  | { readonly ok: false; readonly reason: string };

const fail = (reason: string): { readonly ok: false; readonly reason: string } => ({ ok: false, reason });

/** Mi nem választható: hiányzó vagy tartományon kívüli méret, a formához nem illő mintaismétlés vagy szegély. */
export function shapeProblem(options: ShapeOptions): string | null {
  const cm = (value: number) => Number.isFinite(value) && value > 0 && value <= MAX_SHAPE_CM;
  if (!SHAPE_STITCHES.includes(options.stitch)) {
    return 'Ehhez a generátorhoz alapszemet válassz: rövidpálca, félpálca, egyráhajtásos vagy kétráhajtásos pálca.';
  }
  if (!cm(options.widthCm)) return `A szélesség 0 és ${MAX_SHAPE_CM} cm közötti szám legyen.`;
  if (options.shape === 'rectangle' || options.measure === 'height') {
    if (!cm(options.heightCm)) return `A magasság 0 és ${MAX_SHAPE_CM} cm közötti szám legyen.`;
  } else if (!(Number.isFinite(options.angleDeg) && options.angleDeg >= 1 && options.angleDeg <= 89)) {
    return 'Az él szöge 1° és 89° közötti szám legyen.';
  }
  if (options.shape === 'trapezoid' && !(Number.isFinite(options.topWidthCm) && options.topWidthCm >= 0 && options.topWidthCm <= MAX_SHAPE_CM)) {
    return `A felső él 0 és ${MAX_SHAPE_CM} cm közötti szám legyen.`;
  }
  if (options.repeat) {
    if (options.shape !== 'rectangle') return 'Mintaismétlés most csak téglalapnál választható.';
    const { width, edge } = options.repeat;
    if (!Number.isInteger(width) || width < 1 || width > MAX_REPEAT) return `Az ismétlés szemszáma (X) 1 és ${MAX_REPEAT} közötti egész szám legyen.`;
    if (!Number.isInteger(edge) || edge < 0 || edge > MAX_REPEAT) return `A szélső szemek száma (Y) 0 és ${MAX_REPEAT} közötti egész szám legyen.`;
  }
  if (options.border) {
    if (options.shape !== 'rectangle') return 'Szegély most csak téglalap köré készül.';
    if (options.border.stitch !== 'sc') return 'A szegély most csak rövidpálcás lehet.';
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
  if (base < minCount) return fail(`Ilyen keskeny formához legalább ${minCount} szem kell: adj meg nagyobb szélességet.`);
  if (base > MAX_SHAPE_STITCHES) return fail(`Egy sorban legfeljebb ${MAX_SHAPE_STITCHES} szem lehet: adj meg kisebb szélességet.`);

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
        if (byAngle && d === 0) return fail('A trapéz két éle egyforma hosszú lenne: adj meg magasságot, vagy más felső élt.');
      }
      rows = rowsFor(byAngle ? heightFromRun(Math.abs(d) * gauge.stitchCm) : options.heightCm);
      edge = (k) => line(d, rows - 1, k);
      minRows = d === 0 ? 1 : 2;
      break;
    }
    case 'diamond': {
      first = smallest(base);
      const d = (base - first) / 2;
      if (d === 0) return fail('A rombuszhoz szélesebb forma kell: adj meg nagyobb szélességet.');
      rows = rowsFor(byAngle ? 2 * heightFromRun(d * gauge.stitchCm) : options.heightCm);
      const middle = Math.floor((rows - 1) / 2);
      edge = (k) => (k <= middle ? line(d, middle, k) : line(d, rows - 1 - middle, rows - 1 - k));
      minRows = 3;
      break;
    }
  }
  if (rows < minRows) return fail(`Ehhez a formához legalább ${minRows} sor kell: adj meg nagyobb magasságot, vagy meredekebb élt.`);
  if (rows > MAX_SHAPE_ROWS) return fail(`Legfeljebb ${MAX_SHAPE_ROWS} sor lehet: adj meg kisebb magasságot, vagy laposabb élt.`);

  const offsets = Array.from({ length: rows }, (_, k) => edge(k));
  let shaping: RowShaping[];
  if (options.shape === 'right-triangle') {
    // A ferde él a bal oldali: a páros sorok elején, a páratlanok végén.
    const changes = edgeChanges(offsets, 'left');
    if (!changes) return fail('Ilyen meredek élt ennyi sorban nem lehet horgolni: adj meg nagyobb magasságot.');
    shaping = changes.map((change, k) => (startEdge(k + 1) === 'left' ? { start: change, end: 0 } : { start: 0, end: change }));
  } else shaping = symmetricShaping(offsets);

  const counts: number[] = [];
  shaping.forEach((row, k) => counts.push(k === 0 ? first : counts[k - 1]! + row.start + row.end));
  if (counts.some((count) => count < minCount)) return fail('Ilyen meredek élt ennyi sorban nem lehet horgolni: adj meg nagyobb magasságot.');
  if (counts.some((count) => count > MAX_SHAPE_STITCHES)) return fail(`Egy sorban legfeljebb ${MAX_SHAPE_STITCHES} szem lehet: adj meg kisebb méretet.`);

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

  let border: BorderCounts | null = null;
  let borderedCm: ShapePlan['borderedCm'] = null;
  if (options.border) {
    if (base < MIN_BORDER_WIDTH) return fail(`A szegélyhez a sorban legalább ${MIN_BORDER_WIDTH} szem kell: adj meg nagyobb szélességet.`);
    border = borderCounts(base, base, rows, rowEndStitches(def, options.border.hdcRowEnd));
    // A szegély rövidpálcás köre minden oldalon egy rövidpálcás sor magasságát adja.
    const sc = shapeGauge(pattern, 'sc');
    borderedCm = {
      widthCm: widest * gauge.stitchCm + 2 * sc.rowCm,
      heightCm: heightCm + 2 * sc.rowCm,
      source: weakestSource([gauge.source, sc.source]),
    };
  }

  return {
    ok: true,
    plan: {
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
      border,
      borderedCm,
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

const both = (id: NodeId): Anchor => ({ into: 'stitch', id, mode: 'both-loops' });

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

  chains(count: number): NodeId[] {
    return Array.from({ length: count }, () => this.add('ch'));
  }

  /** Láncos hosszabbítás a sor végén: a láncszemek egy láncívet adnak, a következő sor egyenként horgol beléjük. */
  extension(count: number): NodeId[] {
    const chains = this.chains(count);
    this.spaces.push({ id: `s${this.spaces.length + 1}`, chains });
    return chains;
  }

  /** `n` szem egy célpontba; kettőtől szaporításként. */
  into(def: StitchDef, target: NodeId, n: number): NodeId[] {
    const ids = Array.from({ length: n }, () => this.add(def.id, [both(target)]));
    if (n >= 2) this.groups.push({ id: `g${this.groups.length + 1}`, def: `inc-${n}${def.id}`, members: ids });
    return ids;
  }

  unit(def: StitchDef, working: readonly NodeId[], unit: Unit): NodeId[] {
    if (unit.kind === 'inc') return this.into(def, working[unit.w]!, unit.n);
    return [this.add(`${def.id}${unit.n}tog`, working.slice(unit.from, unit.from + unit.n).map(both))];
  }

  /**
   * Egy sor az előző sor pozícióiba (`working`: a haladási irányban). A
   * `seat`: a sor számító fordulólánca az első pozíción ül, abba alapból nem
   * horgolunk (03 §1.3). Visszaadja a sor új szemeit a fonal sorrendjében,
   * vagy az okot, ha a sor ehhez túl keskeny.
   */
  row(def: StitchDef, working: readonly NodeId[], seat: boolean, shaping: RowShaping, row: number): NodeId[] | string {
    const tooNarrow = `A(z) ${row}. sor túl keskeny ehhez az alakításhoz: adj meg nagyobb méretet vagy laposabb élt.`;
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
    if (seated > 0) produced.push(...this.into(def, working[0]!, seated));
    if (head) produced.push(...this.unit(def, working, head));
    for (let w = lo; w <= hi; w += 1) produced.push(this.add(def.id, [both(working[w]!)]));
    if (tail) produced.push(...this.unit(def, working, tail));
    this.skipped.push(...working.slice(hi + 1, hi + 1 + leave));
    return produced;
  }

  event(kind: LayerEvent['kind']): void {
    this.events.push({ after: this.previous!, kind });
  }
}

/** A sorok szemgráfja a terv szerint; hiba esetén az ok. */
function buildRows(pattern: Pattern, plan: ShapePlan, bordered: boolean): RowWriter | string {
  const writer = new RowWriter();
  const def = resolveStitch(plan.stitch)!;
  const tradition = traditionOf(pattern.conventions);
  const counting = turningChainCountsFor(pattern.conventions.turningChainCounts, def, tradition, 'row');
  const baseChain = hasBaseChain(counting, tradition);
  const rows = plan.counts.length;

  // Láncalap: az 1. sor láncszemei, számító fordulóláncnál az alapláncszem, és az 1. sor fordulólánca (03 §1.2, PQW-891).
  const worked = plan.counts[0]! - (counting ? 1 : 0) + (baseChain ? 1 : 0);
  const foundation = writer.chains(worked + def.turningChain);
  let below = foundation.slice(0, worked);
  let turningTop = foundation[foundation.length - 1]!;

  for (let k = 0; k < rows; k += 1) {
    if (k > 0) turningTop = writer.chains(def.turningChain).at(-1)!;
    const shaping = plan.shaping[k]!;
    // A sok szemes szaporítás a sor elején az előző sor láncos hosszabbítása: ebben a sorban már sima.
    const own = { start: shaping.start > MAX_EDGE_CHANGE ? 0 : shaping.start, end: shaping.end };
    const made = writer.row(def, [...below].reverse(), k === 0 ? baseChain : counting, own, k + 1);
    if (typeof made === 'string') return made;
    below = [...(counting ? [turningTop] : []), ...made];
    const next = plan.shaping[k + 1];
    if (next && next.start > MAX_EDGE_CHANGE) below.push(...writer.extension(next.start));
    writer.event(k < rows - 1 || bordered ? 'turn' : 'fasten-off');
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
  const conventions = options.repeat
    ? {
        ...pattern.conventions,
        repeat: {
          repeatWidth: options.repeat.width,
          edgeStitches: options.repeat.edge,
          turningChainIncluded: pattern.conventions.repeat?.turningChainIncluded ?? false,
        },
      }
    : pattern.conventions;
  const base: Pattern = { ...pattern, conventions, pieces: [] };
  const built = buildRows(base, plan, options.border !== null);
  if (typeof built === 'string') return fail(built);

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
    ...(options.border ? { border: options.border } : {}),
  };
  const stated = withStatedCounts(base, piece, plan);
  if (typeof stated === 'string') return fail(stated);

  const result = withGeneratedTitle({ ...base, pieces: [stated] }, pattern, name, [...Object.values(SHAPE_NAMES), ...Object.values(MOTIF_NAMES)]);
  const errors = validatePattern(result, libraryFor(result)).filter((finding) => finding.severity === 'error');
  if (errors.length > 0) return fail(`A generált minta nem ment át az ellenőrzőn (${errors[0]!.rule}): ez a program hibája, kérlek, jelezd.`);
  return { ok: true, pattern: result, plan };
}

/**
 * A sor végi eseményekbe a gráf szerinti szemszám. A láncos hosszabbítás
 * láncszemei a minta számolása szerint számítanak a sor szemszámába (PQW-870):
 * alapból a belehorgoltak, és számító fordulóláncnál az utolsó láncszemen a
 * fordulólánc ül, abba nem horgolunk. A többi szemnek a tervvel egyeznie kell.
 */
function withStatedCounts(pattern: Pattern, piece: Piece, plan: ShapePlan): Piece | string {
  const whole = { ...pattern, pieces: [piece] };
  const graph = buildPieceGraph(whole, piece, libraryFor(whole));
  const extension = new Set(piece.spaces.flatMap((space) => space.chains));
  const anchored = new Set(piece.stitches.flatMap((node) => node.anchors.flatMap((anchor) => (anchor.into === 'stitch' ? [anchor.id] : []))));
  const { chainCounts } = pattern.conventions;
  const stated = new Map<NodeId, number>();
  for (const layer of graph.layers.slice(1)) {
    const chains = layer.stitches.filter((id) => extension.has(id));
    const counted = chainCounts === true ? chains.length : chainCounts === false ? 0 : chains.filter((id) => anchored.has(id)).length;
    if (layer.stitchCount - counted !== plan.counts[layer.index - 1]) {
      return `A(z) ${layer.index}. sor szemszáma nem a terv szerinti: ez a program hibája, kérlek, jelezd.`;
    }
    if (layer.closing) stated.set(layer.closing.after, layer.stitchCount);
  }
  return { ...piece, events: piece.events.map((event) => ({ ...event, statedCount: stated.get(event.after)! })) };
}
