// KB: 02 §8; 05 §1.1, 05 §1.2, 05 §1.3, 05 §1.4, 05 §1.5, 05 §1.6, 05 §1.7, 05 §1.8, 05 §9.4

import { type DimensionBasis, stitchDimensions } from './gauge.ts';
import { buildPieceGraph } from './graph.ts';
import { type CoreText, text } from './messages.ts';
import { activeProfile, gaugeContextOf } from './pattern-size.ts';
import { withGeneratedTitle } from './pattern-title.ts';
import { weakestSource } from './quantity.ts';
import { circlePlan, DEFAULT_MOTIF, MOTIF_NAMES, plannedRounds, type RoundPlan } from './round-generator.ts';
import { flatIncreases } from './rounds.ts';
import {
  DEFAULT_SHAPE,
  generateShape,
  planShape,
  SHAPE_NAMES,
  SHAPE_STITCHES,
  type ShapeCode,
  type ShapeRepeat,
  shapeGauge,
} from './shapes.ts';
import { libraryFor, resolveStitch } from './stitch-variants.ts';
import { skippedChains, traditionOf, turningChainCountsFor } from './tradition.ts';
import type {
  Anchor,
  LayerEvent,
  NodeId,
  Pattern,
  Piece,
  StitchDef,
  StitchDefId,
  StitchGroup,
  StitchNode,
  ValueSource,
} from './types.ts';
import { validatePattern } from './validate.ts';

export type ShawlKind =
  | 'triangle'
  | 'asymmetric-triangle'
  | 'crescent'
  | 'semicircle'
  | 'circle'
  | 'pi'
  | 'shifted-pi'
  | 'stole';
export type RateChoice = 'theory' | 'custom';

export const SHAWL_KINDS: readonly ShawlKind[] = [
  'triangle',
  'asymmetric-triangle',
  'crescent',
  'semicircle',
  'circle',
  'pi',
  'shifted-pi',
  'stole',
];

export const SHAWL_NAMES: Readonly<Record<ShawlKind, string>> = {
  triangle: 'Fentről induló háromszög',
  'asymmetric-triangle': 'Aszimmetrikus háromszög',
  crescent: 'Félhold',
  semicircle: 'Félkör',
  circle: 'Kör',
  pi: 'Pi-kendő',
  'shifted-pi': 'Eltolt Pi-kendő',
  stole: 'Téglalap stóla',
};

export const ROUND_SHAWLS: readonly ShawlKind[] = ['circle', 'pi', 'shifted-pi'];
/** Increases come in pairs, and the edging repeat counts per half. */
export const SYMMETRIC_SHAWLS: readonly ShawlKind[] = ['triangle', 'crescent'];

export const SHAWL_STITCHES: readonly StitchDefId[] = SHAPE_STITCHES;
export const MAX_SHAWL_CM = 300;
export const MAX_SHAWL_ROWS = 250;
export const MAX_SHAWL_STITCHES = 1200;
/** A bigger graph gets slow to draw in the editor. */
export const MAX_SHAWL_TOTAL = 30000;
export const MAX_SHAWL_RATE = 24;
export const MAX_INTO_ONE = 12;
/** KB: 03 §10 F27 */
export const MAX_PER_STITCH = 2;
/** KB: 05 §9.4 */
export const DEVIATION_LIMIT = 0.15;
export const MAX_EDGING = 50;

/** KB: 02 §8 — for lace it has to be measured. */
export interface ShawlBlocking {
  readonly widthPct: number;
  readonly heightPct: number;
}

export const DEFAULT_BLOCKING: ShawlBlocking = { widthPct: 10, heightPct: 5 };

export interface ShawlOptions {
  readonly kind: ShawlKind;
  readonly stitch: StitchDefId;
  /** Spine for a triangle and a crescent, the straight edge for an asymmetric triangle, the radius for a semicircle, circle and Pi shawl, the width for a stole. */
  readonly sizeCm: number;
  readonly lengthCm: number;
  readonly rate: RateChoice;
  /** Whole-row increase for a triangle, one edge for an asymmetric triangle, per edge for a crescent, per row for a semicircle, per round for a circle; for a Pi shawl the stitch count of round 1. */
  readonly customRate: number;
  /** KB: 05 §1.4 */
  readonly wings: boolean;
  readonly edging: ShapeRepeat | null;
  readonly blocking: ShawlBlocking;
}

export const DEFAULT_SHAWL: ShawlOptions = {
  kind: 'triangle',
  stitch: 'dc',
  sizeCm: 40,
  lengthCm: 150,
  rate: 'theory',
  customRate: 8,
  wings: false,
  edging: null,
  blocking: DEFAULT_BLOCKING,
};

export interface ShawlGauge {
  readonly stitchCm: number;
  readonly rowCm: number;
  readonly source: ValueSource;
  readonly basis: DimensionBasis;
  readonly hookMm: number;
  /** Whether the gauge was measured after blocking (the profile says so); without a profile it was not. */
  readonly blocked: boolean;
}

function shawlGauge(pattern: Pattern, kind: ShawlKind, stitch: StitchDefId): ShawlGauge {
  const blocked = activeProfile(pattern)?.blocked ?? false;
  if (!ROUND_SHAWLS.includes(kind)) return { ...shapeGauge(pattern, stitch), blocked };
  const def = resolveStitch(stitch) ?? resolveStitch('sc')!;
  const context = gaugeContextOf(pattern, libraryFor(pattern));
  const size = stitchDimensions(def, 'round', context)!;
  return {
    stitchCm: size.widthMm.value / 10,
    rowCm: size.heightMm.value / 10,
    source: weakestSource([size.widthMm.source, size.heightMm.source]),
    basis: size.basis,
    hookMm: context.hookMm,
    blocked,
  };
}

export type ShawlWarningKind = 'cupping' | 'ruffling' | 'narrow' | 'wide' | 'pi-blocking';

export interface ShawlWarning {
  readonly kind: ShawlWarningKind;
  readonly ratio: number;
}

export interface ShawlPlan {
  readonly kind: ShawlKind;
  readonly stitch: StitchDefId;
  readonly worked: 'rows' | 'rounds';
  readonly gauge: ShawlGauge;
  readonly counts: readonly number[];
  /** Row 1's stitch count, and from row 2 the stitches worked into the previous row's positions, in working order. */
  readonly layout: RoundPlan;
  readonly theoryRate: number;
  readonly chosenRate: number;
  /** Per half per row, on the edge and on the spine for a symmetric shawl; on the edge for an asymmetric one. */
  readonly edgeRate: number;
  readonly spineRate: number;
  /** `null` without wings. */
  readonly wingsFromRow: number | null;
  readonly edging: { readonly repeats: number; readonly change: number } | null;
  readonly ratio: { readonly min: number; readonly max: number } | null;
  readonly warnings: readonly ShawlWarning[];
}

// KB: core-domain §2
export type ShawlCode =
  | 'shawl-basic-stitch-only'
  | 'shawl-size-range'
  | 'shawl-length-range'
  | 'shawl-rate-range'
  | 'shawl-edging-width-range'
  | 'shawl-edging-edge-range'
  | 'shawl-blocking-range'
  | 'shawl-min-rows'
  | 'shawl-max-rows'
  | 'shawl-max-stitches'
  | 'shawl-max-total'
  | 'shawl-first-row-into-one'
  | 'shawl-min-rows-depth'
  | 'shawl-max-rows-depth'
  | 'shawl-min-rows-edge'
  | 'shawl-max-rows-edge'
  | 'shawl-min-rows-radius'
  | 'shawl-max-rows-radius'
  | 'shawl-double-limit'
  | 'shawl-min-rounds-radius'
  | 'shawl-max-rounds-radius'
  | 'shawl-edging-rows'
  | 'shawl-edging-round'
  | 'shawl-row-plan-mismatch'
  | 'shawl-too-many-into-one'
  | ShapeCode;

export type ShawlText = CoreText<ShawlCode>;

export type ShawlPlanResult =
  | { readonly ok: true; readonly plan: ShawlPlan }
  | { readonly ok: false; readonly reason: ShawlText };
export type ShawlResult =
  | { readonly ok: true; readonly pattern: Pattern; readonly plan: ShawlPlan }
  | { readonly ok: false; readonly reason: ShawlText };

const fail = (reason: ShawlText): { readonly ok: false; readonly reason: ShawlText } => ({ ok: false, reason });

export function shawlProblem(options: ShawlOptions): ShawlText | null {
  const cm = (value: number) => Number.isFinite(value) && value > 0 && value <= MAX_SHAWL_CM;
  if (!SHAWL_STITCHES.includes(options.stitch)) {
    return text('shawl-basic-stitch-only');
  }
  if (!cm(options.sizeCm)) return text('shawl-size-range', { max: MAX_SHAWL_CM });
  if (options.kind === 'stole' && !cm(options.lengthCm)) return text('shawl-length-range', { max: MAX_SHAWL_CM });
  if (options.kind !== 'stole' && options.rate === 'custom') {
    const rate = options.customRate;
    if (!(Number.isFinite(rate) && rate > 0 && rate <= MAX_SHAWL_RATE))
      return text('shawl-rate-range', { max: MAX_SHAWL_RATE });
  }
  if (options.edging) {
    const { width, edge } = options.edging;
    if (!Number.isInteger(width) || width < 1 || width > MAX_EDGING)
      return text('shawl-edging-width-range', { max: MAX_EDGING });
    if (!Number.isInteger(edge) || edge < 0 || edge > MAX_EDGING)
      return text('shawl-edging-edge-range', { max: MAX_EDGING });
  }
  const { widthPct, heightPct } = options.blocking;
  if (![widthPct, heightPct].every((pct) => Number.isFinite(pct) && pct > -50 && pct <= 100)) {
    return text('shawl-blocking-range');
  }
  return null;
}

/** Error diffusion: up to row k, `avg · k` rounded to a multiple of `step`; per row the difference. */
function schedule(avg: number, rows: number, step: number): number[] {
  const upTo = (k: number) => step * Math.round((avg * k) / step + 1e-9);
  return Array.from({ length: rows }, (_, k) => (k === 0 ? 0 : upTo(k) - upTo(k - 1)));
}

function spread(p: number, m: number, shift: number): number[] {
  const into = Array<number>(p).fill(1 + Math.floor(m / p));
  const rest = m % p;
  for (let j = 0; j < rest; j += 1) into[Math.floor(((j + shift) * p) / rest)]! += 1;
  return into;
}

/** At most 2 per stitch. KB: 03 §10 F27 */
function place(into: number[], from: number, dir: 1 | -1, total: number): void {
  let left = total;
  for (let i = from; left > 0; i += dir) {
    const add = Math.min(MAX_PER_STITCH, left);
    into[Math.min(into.length - 1, Math.max(0, i))]! += add;
    left -= add;
  }
}

function symmetricInto(p: number, e: number, s: number): number[] {
  const into = Array<number>(p).fill(1);
  place(into, 0, 1, e);
  place(into, p - 1, -1, e);
  place(into, p / 2 - 1, -1, s / 2);
  place(into, p / 2, 1, s / 2);
  return into;
}

function edgingCandidates(count: number, repeat: ShapeRepeat): number[] {
  const base = (((repeat.edge - count) % repeat.width) + repeat.width) % repeat.width;
  return [base, base - repeat.width, base + repeat.width, base - 2 * repeat.width]
    .filter((d, i, all) => all.indexOf(d) === i)
    .sort((a, b) => Math.abs(a) - Math.abs(b) || b - a);
}

const repeatsOf = (count: number, repeat: ShapeRepeat) => Math.round((count - repeat.edge) / repeat.width);

/** On a failed attempt the previous values are restored. */
function distributeTail(rows: number, d: number, apply: (k: number, delta: number) => boolean): boolean {
  let left = d;
  for (let k = rows - 1; k >= 1 && left !== 0; k -= 1) {
    const delta = Math.sign(left) * Math.min(MAX_PER_STITCH, Math.abs(left));
    if (!apply(k, delta)) return false;
    left -= delta;
  }
  return left === 0;
}

const countsOf = (layout: RoundPlan) => {
  const counts = [layout.first];
  for (const into of layout.rounds) counts.push(into.reduce((sum, n) => sum + n, 0));
  return counts;
};

export function planShawl(pattern: Pattern, options: ShawlOptions): ShawlPlanResult {
  const problem = shawlProblem(options);
  if (problem) return fail(problem);
  const gauge = shawlGauge(pattern, options.kind, options.stitch);
  const def = resolveStitch(options.stitch)!;
  // Only rows matter here; a shawl in rounds is built by the round generator.
  const counting = turningChainCountsFor(
    pattern.conventions.turningChainCounts,
    def,
    traditionOf(pattern.conventions),
    'row',
  );
  const r = gauge.rowCm / gauge.stitchCm;
  const custom = options.rate === 'custom';

  let planned: Omit<ShawlPlan, 'kind' | 'stitch' | 'gauge' | 'counts' | 'warnings'> | ShawlText;
  switch (options.kind) {
    case 'triangle':
    case 'crescent':
      planned = symmetricPlan(options, gauge, r, custom);
      break;
    case 'asymmetric-triangle':
      planned = asymmetricPlan(options, gauge, r, custom);
      break;
    case 'semicircle':
      planned = semicirclePlan(options, gauge, r, custom);
      break;
    case 'circle':
    case 'pi':
    case 'shifted-pi':
      planned = roundPlan(pattern, options, gauge, def, custom);
      break;
    case 'stole':
      planned = stolePlan(pattern, options);
      break;
  }
  if ('code' in planned) return fail(planned);

  const counts = countsOf(planned.layout);
  const rows = counts.length;
  // KB: core-domain §2
  const shape = planned.worked === 'rounds' ? 'round' : 'row';
  if (rows < 2) return fail(text('shawl-min-rows', { rows: 2, shape }));
  if (rows > MAX_SHAWL_ROWS) return fail(text('shawl-max-rows', { max: MAX_SHAWL_ROWS, shape }));
  if (Math.max(...counts) > MAX_SHAWL_STITCHES) {
    return fail(text('shawl-max-stitches', { max: MAX_SHAWL_STITCHES, shape }));
  }
  if (counts.reduce((sum, n) => sum + n, 0) > MAX_SHAWL_TOTAL) {
    return fail(text('shawl-max-total'));
  }
  // Row 1 goes into a single chain; with a counting turning chain one of the stitches is that chain. KB: core-domain §5
  if (planned.worked === 'rows' && options.kind !== 'stole' && counts[0]! - (counting ? 1 : 0) > MAX_INTO_ONE) {
    return fail(text('shawl-first-row-into-one', { max: MAX_INTO_ONE }));
  }

  return {
    ok: true,
    plan: {
      ...planned,
      kind: options.kind,
      stitch: options.stitch,
      gauge,
      counts,
      warnings: warningsOf(options.kind, planned),
    },
  };
}

type PlanBody = Omit<ShawlPlan, 'kind' | 'stitch' | 'gauge' | 'counts' | 'warnings'>;

/** KB: 05 §1.4, 05 §1.6 */
function symmetricPlan(options: ShawlOptions, gauge: ShawlGauge, r: number, custom: boolean): PlanBody | ShawlText {
  const triangle = options.kind === 'triangle';
  const theoryRate = triangle ? 4 * r : 2 * r;
  const chosenRate = custom ? options.customRate : theoryRate;
  // The spine angle against the row: a quarter of the row per half for a triangle, no spine increase for a crescent.
  const spineHalf = triangle ? chosenRate / 4 : 0;
  const rows = Math.round(
    (options.sizeCm * Math.sin(Math.atan2(gauge.rowCm, spineHalf * gauge.stitchCm))) / gauge.rowCm,
  );
  if (rows < 2) return text('shawl-min-rows-depth');
  if (rows > MAX_SHAWL_ROWS) return text('shawl-max-rows-depth', { max: MAX_SHAWL_ROWS });

  const edges: number[] = [];
  const spine: number[] = [];
  if (triangle) {
    let toEdges = false;
    for (const total of schedule(chosenRate, rows, 2)) {
      if (total % 4 === 0) {
        edges.push(total / 4);
        spine.push(total / 2);
      } else {
        // KB: 05 §1.4
        const m = (total - 2) / 4;
        toEdges = !toEdges;
        edges.push(toEdges ? m + 1 : m);
        spine.push(toEdges ? 2 * m : 2 * m + 2);
      }
    }
  } else {
    edges.push(...schedule(chosenRate, rows, 1));
    spine.push(...Array<number>(rows).fill(0));
  }
  const wingsFromRow = triangle && options.wings ? Math.floor(rows / 2) + 1 : null;
  if (wingsFromRow !== null) for (let k = wingsFromRow - 1; k < rows; k += 1) edges[k]! *= 2;

  // The average rate per half after row 1, before the wings and the edging fit: this is what gives the angle.
  const plain = wingsFromRow === null ? rows : wingsFromRow - 1;
  const average = (values: readonly number[], fallback: number) =>
    plain > 1 ? values.slice(1, plain).reduce((sum, v) => sum + v, 0) / (plain - 1) : fallback;
  const edgeRate = average(edges, triangle ? chosenRate / 4 : chosenRate);
  const spineRate = triangle ? average(spine, chosenRate / 2) / 2 : 0;

  const first = Math.max(2, 2 * Math.round(triangle ? chosenRate / 2 : chosenRate));
  const lastHalf = () => (first + edges.reduce((sum, e) => sum + 2 * e, 0) + spine.reduce((sum, s) => sum + s, 0)) / 2;
  const edging = tailEdging(
    options,
    rows,
    lastHalf,
    (k, delta) => {
      // The per-half change goes on the edge, or on half the spine if it does not fit there.
      if (edges[k]! + delta >= 0) edges[k]! += delta;
      else if (spine[k]! + 2 * delta >= 0) spine[k]! += 2 * delta;
      else return false;
      return true;
    },
    () => [...edges, ...spine],
    (saved) => {
      edges.splice(0, rows, ...saved.slice(0, rows));
      spine.splice(0, rows, ...saved.slice(rows));
    },
  );
  if (edging !== null && 'code' in edging) return edging;

  const rounds: number[][] = [];
  let p = first;
  for (let k = 1; k < rows; k += 1) {
    rounds.push(symmetricInto(p, edges[k]!, spine[k]!));
    p += 2 * edges[k]! + spine[k]!;
  }
  return {
    worked: 'rows',
    layout: { first, rounds },
    theoryRate,
    chosenRate,
    edgeRate,
    spineRate,
    wingsFromRow,
    edging,
    ratio: null,
  };
}

/** KB: 05 §1.5 */
function asymmetricPlan(options: ShawlOptions, gauge: ShawlGauge, r: number, custom: boolean): PlanBody | ShawlText {
  const theoryRate = r;
  const chosenRate = custom ? options.customRate : theoryRate;
  const rows = Math.round(options.sizeCm / gauge.rowCm);
  if (rows < 2) return text('shawl-min-rows-edge');
  if (rows > MAX_SHAWL_ROWS) return text('shawl-max-rows-edge', { max: MAX_SHAWL_ROWS });
  const grow = schedule(chosenRate, rows, 1);
  const first = Math.max(2, Math.round(chosenRate) + 1);
  const last = () => first + grow.reduce((sum, g) => sum + g, 0);
  const edging = tailEdging(
    options,
    rows,
    last,
    (k, delta) => {
      if (grow[k]! + delta < 0) return false;
      grow[k]! += delta;
      return true;
    },
    () => [...grow],
    (saved) => grow.splice(0, rows, ...saved),
  );
  if (edging !== null && 'code' in edging) return edging;

  const rounds: number[][] = [];
  let p = first;
  for (let k = 1; k < rows; k += 1) {
    const into = Array<number>(p).fill(1);
    // The sloping edge is the left one: at the start of even rows and the end of odd ones.
    if ((k + 1) % 2 === 0) place(into, 0, 1, grow[k]!);
    else place(into, p - 1, -1, grow[k]!);
    rounds.push(into);
    p += grow[k]!;
  }
  return {
    worked: 'rows',
    layout: { first, rounds },
    theoryRate,
    chosenRate,
    edgeRate: (last() - first) / (rows - 1),
    spineRate: 0,
    wingsFromRow: null,
    edging,
    ratio: null,
  };
}

function tailEdging(
  options: ShawlOptions,
  rows: number,
  last: () => number,
  apply: (k: number, delta: number) => boolean,
  save: () => number[],
  restore: (saved: number[]) => void,
): ShawlPlan['edging'] | ShawlText {
  if (!options.edging) return null;
  for (const d of edgingCandidates(last(), options.edging)) {
    const saved = save();
    if (distributeTail(rows, d, apply)) return { repeats: repeatsOf(last(), options.edging), change: d };
    restore(saved);
  }
  return text('shawl-edging-rows');
}

/** KB: 05 §1.2 */
function semicirclePlan(options: ShawlOptions, gauge: ShawlGauge, r: number, custom: boolean): PlanBody | ShawlText {
  const theoryRate = Math.PI * r;
  const chosenRate = custom ? options.customRate : theoryRate;
  const rows = Math.round(options.sizeCm / gauge.rowCm);
  if (rows < 2) return text('shawl-min-rows-radius');
  if (rows > MAX_SHAWL_ROWS) return text('shawl-max-rows-radius', { max: MAX_SHAWL_ROWS });
  const first = Math.max(2, Math.round(chosenRate));
  const grow = schedule(chosenRate, rows, 1);
  const last = () => first + grow.reduce((sum, g) => sum + g, 0);
  // The change fits into the last row in one go: the row spreads it evenly.
  const edging = tailEdging(
    options,
    rows,
    last,
    (k, delta) => {
      if (grow[k]! + delta < 0) return false;
      grow[k]! += delta;
      return true;
    },
    () => [...grow],
    (saved) => grow.splice(0, rows, ...saved),
  );
  if (edging !== null && 'code' in edging) return edging;

  const rounds: number[][] = [];
  let p = first;
  for (let k = 1; k < rows; k += 1) {
    if (grow[k]! > p) return text('shawl-double-limit');
    rounds.push(spread(p, grow[k]!, k % 2 === 0 ? 0 : 0.5));
    p += grow[k]!;
  }
  const counts = countsOf({ first, rounds });
  return {
    worked: 'rows',
    layout: { first, rounds },
    theoryRate,
    chosenRate,
    edgeRate: 0,
    spineRate: 0,
    wingsFromRow: null,
    edging,
    ratio: ratioOf(counts, theoryRate),
  };
}

function ratioOf(counts: readonly number[], ideal: number): ShawlPlan['ratio'] {
  const ratios = counts.slice(1).map((count, i) => count / ((i + 2) * ideal));
  return { min: Math.min(...ratios), max: Math.max(...ratios) };
}

/** KB: 05 §1.1, 05 §1.3 */
function roundPlan(
  pattern: Pattern,
  options: ShawlOptions,
  gauge: ShawlGauge,
  def: StitchDef,
  custom: boolean,
): PlanBody | ShawlText {
  const increases = flatIncreases(def, gaugeContextOf(pattern, libraryFor(pattern)));
  const theoryRate = increases.exact;
  const chosenRate = custom ? Math.max(3, Math.round(options.customRate)) : increases.count;
  const rounds = Math.round(options.sizeCm / gauge.rowCm);
  if (rounds < 2) return text('shawl-min-rounds-radius');
  if (rounds > MAX_SHAWL_ROWS) return text('shawl-max-rounds-radius', { max: MAX_SHAWL_ROWS });
  let layout: RoundPlan;
  if (options.kind === 'circle') layout = circlePlan(chosenRate, rounds, true);
  else {
    const doubling = piRounds(options.kind === 'shifted-pi', rounds);
    const plan: number[][] = [];
    let p = chosenRate;
    for (let k = 2; k <= rounds; k += 1) {
      plan.push(Array<number>(p).fill(doubling.has(k) ? 2 : 1));
      if (doubling.has(k)) p *= 2;
    }
    layout = { first: chosenRate, rounds: plan };
  }

  let edging: ShawlPlan['edging'] = null;
  if (options.edging) {
    const counts = countsOf(layout);
    const last = counts.at(-1)!;
    const previous = counts.at(-2)!;
    const grow = last - previous;
    // The last round adjusts in one go, up to doubling.
    const d = edgingCandidates(last, options.edging).find((change) => grow + change >= 0 && grow + change <= previous);
    if (d === undefined) return text('shawl-edging-round');
    layout = { first: layout.first, rounds: [...layout.rounds.slice(0, -1), spread(previous, grow + d, 0.5)] };
    edging = { repeats: repeatsOf(last + d, options.edging), change: d };
  }
  return {
    worked: 'rounds',
    layout,
    theoryRate,
    chosenRate,
    edgeRate: 0,
    spineRate: 0,
    wingsFromRow: null,
    edging,
    ratio: ratioOf(countsOf(layout), theoryRate),
  };
}

/** KB: 05 §1.3 */
export function piRounds(shifted: boolean, rounds: number): Set<number> {
  const result = new Set<number>();
  for (let k = 1; 2 ** k * (shifted ? 0.75 : 1) <= rounds; k += 1)
    result.add(Math.round(2 ** k * (shifted ? 0.75 : 1)));
  return result;
}

/** KB: 05 §1.7 */
function stolePlan(pattern: Pattern, options: ShawlOptions): PlanBody | ShawlText {
  const planned = planShape(pattern, stoleShape(options));
  if (!planned.ok) return planned.reason;
  const { counts, repeats } = planned.plan;
  return {
    worked: 'rows',
    layout: { first: counts[0]!, rounds: counts.slice(1).map((count) => Array<number>(count).fill(1)) },
    theoryRate: 0,
    chosenRate: 0,
    edgeRate: 0,
    spineRate: 0,
    wingsFromRow: null,
    edging: options.edging && repeats !== null ? { repeats, change: 0 } : null,
    ratio: null,
  };
}

const stoleShape = (options: ShawlOptions) => ({
  ...DEFAULT_SHAPE,
  shape: 'rectangle' as const,
  stitch: options.stitch,
  widthCm: options.sizeCm,
  heightCm: options.lengthCm,
  repeat: options.edging,
  rounding: 'nearest' as const,
});

/** KB: 05 §9.4 */
function warningsOf(kind: ShawlKind, plan: PlanBody): ShawlWarning[] {
  const warnings: ShawlWarning[] = [];
  if (plan.ratio) {
    if (kind === 'pi' || kind === 'shifted-pi') {
      if (plan.ratio.min < 1 - DEVIATION_LIMIT || plan.ratio.max > 1 + DEVIATION_LIMIT)
        warnings.push({ kind: 'pi-blocking', ratio: plan.ratio.min });
    } else if (plan.ratio.min < 1 - DEVIATION_LIMIT) warnings.push({ kind: 'cupping', ratio: plan.ratio.min });
    else if (plan.ratio.max > 1 + DEVIATION_LIMIT) warnings.push({ kind: 'ruffling', ratio: plan.ratio.max });
  } else if (kind === 'triangle' && plan.theoryRate > 0) {
    // The average increase over the whole row (two edges, both halves of the spine) against the theoretical rate.
    const ratio = (2 * plan.edgeRate + 2 * plan.spineRate) / plan.theoryRate;
    if (ratio < 1 - DEVIATION_LIMIT) warnings.push({ kind: 'narrow', ratio });
    else if (ratio > 1 + DEVIATION_LIMIT) warnings.push({ kind: 'wide', ratio });
  }
  return warnings;
}

export interface ShawlGeometry {
  readonly widthCm: number;
  readonly depthCm: number;
  /** Outline points in cm; y grows downwards and the top-left corner is (0, 0). */
  readonly outline: readonly (readonly [number, number])[];
  readonly neckAngleDeg: number | null;
  readonly tipAngleDeg: number | null;
  readonly spineCm: number;
}

export interface ShawlSizes {
  /** Which state was measured: blocked with a profile, unblocked without one. */
  readonly measured: 'blocked' | 'unblocked';
  readonly blocked: ShawlGeometry;
  readonly unblocked: ShawlGeometry;
}

const degrees = (radians: number) => (radians * 180) / Math.PI;

export function shawlSizes(plan: ShawlPlan, blocking: ShawlBlocking): ShawlSizes {
  const w = 1 + blocking.widthPct / 100;
  const h = 1 + blocking.heightPct / 100;
  const { stitchCm, rowCm } = plan.gauge;
  const measured = shawlGeometry(plan, stitchCm, rowCm);
  if (plan.gauge.blocked)
    return { measured: 'blocked', blocked: measured, unblocked: shawlGeometry(plan, stitchCm / w, rowCm / h) };
  return { measured: 'unblocked', unblocked: measured, blocked: shawlGeometry(plan, stitchCm * w, rowCm * h) };
}

export function shawlGeometry(plan: ShawlPlan, stitchCm: number, rowCm: number): ShawlGeometry {
  const rows = plan.counts.length;
  const last = plan.counts.at(-1)!;
  const framed = (
    points: [number, number][],
    extra: Omit<ShawlGeometry, 'widthCm' | 'depthCm' | 'outline'>,
  ): ShawlGeometry => {
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const [minX, minY] = [Math.min(...xs), Math.min(...ys)];
    return {
      widthCm: Math.max(...xs) - minX,
      depthCm: Math.max(...ys) - minY,
      outline: points.map(([x, y]) => [x - minX, y - minY] as const),
      ...extra,
    };
  };
  switch (plan.kind) {
    case 'triangle':
    case 'crescent': {
      // Per half the row runs from the spine to the edge: the spine end moves in by `spineRate·w` per row, the edge end out by `edgeRate·w`.
      const spine: [number, number] = [-plan.spineRate * stitchCm * rows, rowCm * rows];
      const edge: [number, number] = [plan.edgeRate * stitchCm * rows, rowCm * rows];
      // Rotated so that the spine points straight down.
      const turn = Math.atan2(spine[0], spine[1]);
      const rotate = ([x, y]: [number, number]): [number, number] => [
        x * Math.cos(turn) - y * Math.sin(turn),
        x * Math.sin(turn) + y * Math.cos(turn),
      ];
      const tip = rotate(edge);
      const bottom = rotate(spine);
      const thetaSpine = Math.atan2(rowCm, plan.spineRate * stitchCm);
      const thetaEdge = Math.atan2(rowCm, plan.edgeRate * stitchCm);
      return framed([[0, 0], tip, bottom, [-tip[0], tip[1]]], {
        neckAngleDeg: 2 * (180 - degrees(thetaSpine) - degrees(thetaEdge)),
        tipAngleDeg: 2 * degrees(thetaSpine),
        spineCm: Math.hypot(...bottom),
      });
    }
    case 'asymmetric-triangle':
      return framed(
        [
          [0, 0],
          [plan.counts[0]! * stitchCm, 0],
          [last * stitchCm, rows * rowCm],
          [0, rows * rowCm],
        ],
        {
          neckAngleDeg: null,
          tipAngleDeg: degrees(Math.atan2(rowCm, plan.edgeRate * stitchCm)),
          spineCm: rows * rowCm,
        },
      );
    case 'semicircle':
    case 'circle':
    case 'pi':
    case 'shifted-pi': {
      const radius = rows * rowCm;
      const half = plan.kind === 'semicircle';
      const steps = half ? 24 : 48;
      const points = Array.from({ length: steps + 1 }, (_, i): [number, number] => {
        const angle = (Math.PI * (half ? 1 : 2) * i) / steps;
        return [radius * Math.cos(angle), radius * Math.sin(angle)];
      });
      return framed(half ? points : points.slice(0, -1), { neckAngleDeg: null, tipAngleDeg: null, spineCm: radius });
    }
    case 'stole':
      return framed(
        [
          [0, 0],
          [plan.counts[0]! * stitchCm, 0],
          [plan.counts[0]! * stitchCm, rows * rowCm],
          [0, rows * rowCm],
        ],
        { neckAngleDeg: null, tipAngleDeg: null, spineCm: rows * rowCm },
      );
  }
}

const both = (id: NodeId): Anchor => ({ into: 'stitch', id, mode: 'both-loops' });

function turnedRows(pattern: Pattern, def: StitchDef, layout: RoundPlan, name: string): Piece | ShawlText {
  const stitches: StitchNode[] = [];
  const groups: StitchGroup[] = [];
  const events: LayerEvent[] = [];
  let previous: NodeId | null = null;
  const add = (id: StitchDef['id'], anchors: readonly Anchor[] = []): NodeId => {
    const node = `n${stitches.length + 1}`;
    stitches.push({ id: node, def: id, prev: previous, anchors });
    previous = node;
    return node;
  };
  const chains = (count: number) => Array.from({ length: count }, () => add('ch'));
  const into = (target: NodeId, n: number): NodeId[] => {
    const ids = Array.from({ length: n }, () => add(def.id, [both(target)]));
    if (n >= 2) groups.push({ id: `g${groups.length + 1}`, def: `inc-${n}${def.id}`, members: ids });
    return ids;
  };

  const tradition = traditionOf(pattern.conventions);
  const counting = turningChainCountsFor(pattern.conventions.turningChainCounts, def, tradition, 'row');
  // KB: core-domain §5; 03 §1.2
  const skipped = skippedChains(def.turningChain, counting);
  const foundation = chains(1 + skipped);
  const target = foundation[0]!;
  let below = into(target, layout.first);

  for (const [i, plan] of layout.rounds.entries()) {
    events.push({ after: previous!, kind: 'turn' });
    // The turning chain is laid down because it gives height, but it is not a target. KB: core-domain §17
    chains(def.turningChain);
    const working = [...below].reverse();
    // KB: core-domain §2
    if (plan.length !== working.length) return text('shawl-row-plan-mismatch', { row: i + 2 });
    const made: NodeId[] = [];
    for (const [w, n] of plan.entries()) {
      // KB: core-domain §17
      const extra = n;
      if (extra > MAX_INTO_ONE) return text('shawl-too-many-into-one', { row: i + 2, count: extra });
      if (extra > 0) made.push(...into(working[w]!, extra));
    }
    // KB: core-domain §17
    below = [...made];
  }
  events.push({ after: previous!, kind: 'fasten-off' });
  return { id: 'p1', name, stitches, spaces: [], rings: [], groups, events, skipped: [] };
}

function withStatedCounts(pattern: Pattern, piece: Piece, counts: readonly number[]): Piece | ShawlText {
  const whole = { ...pattern, pieces: [piece] };
  const graph = buildPieceGraph(whole, piece, libraryFor(whole));
  const stated = new Map<NodeId, number>();
  for (const layer of graph.layers.slice(1)) {
    if (layer.stitchCount !== counts[layer.index - 1]) {
      // KB: core-domain §2
      return text('internal-error', { row: layer.index, shape: layer.shape === 'round' ? 'round' : 'row' });
    }
    if (layer.closing) stated.set(layer.closing.after, layer.writtenCount);
  }
  return {
    ...piece,
    events: piece.events.map((event) =>
      stated.has(event.after) ? { ...event, statedCount: stated.get(event.after)! } : event,
    ),
  };
}

const tenth = (value: number) => Math.round(value * 10) / 10;

/** KB: 05 §1.4, 05 §1.6 */
function withRowShape(piece: Piece, plan: ShawlPlan): Piece {
  const { neckAngleDeg, tipAngleDeg } = shawlGeometry(plan, plan.gauge.stitchCm, plan.gauge.rowCm);
  switch (plan.kind) {
    case 'semicircle':
      return { ...piece, rowShape: { kind: 'arc', neckAngle: 180 } };
    case 'crescent':
      return { ...piece, rowShape: { kind: 'arc', neckAngle: tenth(neckAngleDeg ?? 180) } };
    case 'triangle':
      return {
        ...piece,
        rowShape: { kind: 'chevron', neckAngle: tenth(neckAngleDeg ?? 180), tipAngle: tenth(tipAngleDeg ?? 90) },
      };
    default:
      return piece;
  }
}

// KB: core-domain §1
export function generateShawl(pattern: Pattern, options: ShawlOptions): ShawlResult {
  const planned = planShawl(pattern, options);
  if (!planned.ok) return planned;
  const { plan } = planned;
  const name = SHAWL_NAMES[options.kind];
  const def = resolveStitch(options.stitch)!;

  let result: Pattern;
  if (options.kind === 'stole') {
    const shape = generateShape(pattern, stoleShape(options));
    if (!shape.ok) return fail(shape.reason);
    result = { ...shape.pattern, pieces: shape.pattern.pieces.map((piece) => ({ ...piece, name })) };
  } else {
    const base: Pattern = { ...pattern, pieces: [] };
    // The round generator still returns a finished Hungarian sentence on some branches; a shawl never reaches them, so they are taken as an internal error. KB: core-domain §2
    let piece: Piece | string | ShawlText;
    let conventions = pattern.conventions;
    if (plan.worked === 'rounds') {
      const options = {
        ...DEFAULT_MOTIF,
        shape: 'circle' as const,
        stitch: plan.stitch,
        start: 'magic-ring' as const,
        closing: 'join-slip' as const,
      };
      piece = plannedRounds(base, options, plan.layout, name);
      conventions = { ...conventions, roundEnd: 'join-slip' };
    } else piece = turnedRows(base, def, plan.layout, name);
    if (typeof piece === 'string') return fail(text('internal-error'));
    if ('code' in piece) return fail(piece);
    const stated = withStatedCounts({ ...base, conventions }, piece, plan.counts);
    if ('code' in stated) return fail(stated);
    result = { ...base, conventions, pieces: [withRowShape(stated, plan)] };
  }

  result = withGeneratedTitle(result, pattern, name, [
    ...Object.values(SHAWL_NAMES),
    ...Object.values(SHAPE_NAMES),
    ...Object.values(MOTIF_NAMES),
  ]);
  const errors = validatePattern(result, libraryFor(result)).filter((finding) => finding.severity === 'error');
  if (errors.length > 0) return fail(text('internal-error', { rule: errors[0]!.rule }));
  return { ok: true, pattern: result, plan };
}
