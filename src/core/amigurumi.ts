// KB: 04 §0, 04 §4, 04 §5.2, 04 §5.8, 04 §8, 04 §9.0, 04 §9.2, 04 §9.3, 04 §9.6, 04 §9.7

import { stitchDimensions } from './gauge.ts';
import { buildPieceGraph, type PieceGraph, rowEdges } from './graph.ts';
import { type CoreText, text } from './messages.ts';
import { gaugeContextOf } from './pattern-size.ts';
import { CUPPING_RATIO, flatIncreases, niceIncreases, RUFFLING_RATIO } from './rounds.ts';
import type { RuleId } from './rules.ts';
import type { StitchLibrary } from './stitch-library.ts';
import { libraryFor, resolveStitch } from './stitch-variants.ts';
import type {
  JoinEdge,
  NodeId,
  OvalStitch,
  Pattern,
  Piece,
  PieceEnd,
  PieceId,
  ProfilePoint,
  ShapeSpec,
  ValueSource,
} from './types.ts';

export interface RoundGauge {
  readonly stitchesPerCm: number;
  readonly roundsPerCm: number;
  readonly source: ValueSource;
  /** Hook diameter in mm, for the thickness of a flat piece. KB: 02 §1.6 */
  readonly hookMm: number;
}

// KB: 04 §1.2
export function roundGaugeOf(pattern: Pattern, stitch: OvalStitch = 'sc'): RoundGauge {
  const context = gaugeContextOf(pattern, libraryFor(pattern));
  const def = resolveStitch(stitch)!;
  const size = stitchDimensions(def, 'round', context)!;
  const label = size.widthMm.source === 'label' || size.heightMm.source === 'label';
  const heightMm = stitch === 'sc' ? size.heightMm.value : size.widthMm.value * flatIncreases(def, context).aspect;
  return {
    stitchesPerCm: 10 / size.widthMm.value,
    roundsPerCm: 10 / heightMm,
    source: size.basis !== 'measured' ? 'estimated' : label ? 'label' : 'measured',
    hookMm: context.hookMm,
  };
}

export function ovalStitchOf(spec: ShapeSpec): OvalStitch {
  return spec.kind === 'oval' ? (spec.stitch ?? 'sc') : 'sc';
}

/** The oval uses its own stitch's gauge; every other shape uses single crochet. */
export function shapeGaugeOf(pattern: Pattern, spec: ShapeSpec, sc: RoundGauge = roundGaugeOf(pattern)): RoundGauge {
  const stitch = ovalStitchOf(spec);
  return stitch === 'sc' ? sc : roundGaugeOf(pattern, stitch);
}

/** KB: 04 §0 */
export function flatRate(gauge: RoundGauge): number {
  return (2 * Math.PI * gauge.stitchesPerCm) / gauge.roundsPerCm;
}

/** KB: 04 §0 */
export function startCount(gauge: RoundGauge): number {
  return niceIncreases(flatRate(gauge));
}

// KB: core-domain §20
export const SHAPE_NAMES: Readonly<Record<ShapeSpec['kind'], string>> = {
  sphere: 'Gömb',
  hemisphere: 'Félgömb',
  egg: 'Tojás',
  cylinder: 'Henger',
  cone: 'Kúp',
  revolution: 'Forgástest',
  oval: 'Ovális',
};

export const OVAL_STITCHES: readonly OvalStitch[] = ['sc', 'hdc', 'dc', 'tr'];

// KB: 02 §1.6
const AMIGURUMI_HOOK_RATIO = 1.4;

/** KB: 02 §1.6 */
export function fabricThicknessCm(hookMm: number): number {
  return (2 * hookMm) / AMIGURUMI_HOOK_RATIO / 10;
}

export const MAX_SIZE_CM = 100;
export const MAX_SHAPE_ROUNDS = 120;
/** At most twice the flat value. */
export const MAX_CONE_INCREASES = 12;
/** KB: 04 §9.3 */
export const SHARP_TURN_DEG = 60;
/** KB: 04 §9.6 */
export const TUBE_RATIO = 0.15;
/** KB: 04 §4.6 */
export const EGG_LOWER_SHARE = 0.45;

// KB: core-domain §2
export type ShapeCode =
  | 'size-range'
  | 'cone-increases-range'
  | 'oval-length'
  | 'profile-points'
  | 'profile-range'
  | 'profile-same-points'
  | 'profile-zero-radius'
  | 'too-many-rounds'
  | 'join-count-differs'
  | 'distribution-mismatch';

/** KB: core-domain §2 */
export type SizeField = 'diameter' | 'height' | 'length' | 'width';

/** `null` when the shape can be made. */
export function shapeProblem(spec: ShapeSpec): CoreText<ShapeCode> | null {
  const size = (value: number, field: SizeField) =>
    Number.isFinite(value) && value > 0 && value <= MAX_SIZE_CM
      ? null
      : text('size-range', { field, max: MAX_SIZE_CM });
  switch (spec.kind) {
    case 'sphere':
    case 'hemisphere':
      return size(spec.diameterCm, 'diameter');
    case 'egg':
    case 'cylinder':
      return size(spec.diameterCm, 'diameter') ?? size(spec.heightCm, 'height');
    case 'cone': {
      const { increases } = spec;
      if (increases !== null && !(Number.isFinite(increases) && increases > 0 && increases <= MAX_CONE_INCREASES)) {
        return text('cone-increases-range', { max: MAX_CONE_INCREASES });
      }
      return size(spec.diameterCm, 'diameter') ?? (increases === null ? size(spec.heightCm, 'height') : null);
    }
    case 'oval': {
      const problem = size(spec.lengthCm, 'length') ?? size(spec.widthCm, 'width');
      if (problem) return problem;
      return spec.lengthCm < spec.widthCm ? text('oval-length') : null;
    }
    case 'revolution': {
      if (spec.profile.length < 2) return text('profile-points');
      const valid = (point: ProfilePoint) =>
        Number.isFinite(point.radiusCm) &&
        point.radiusCm >= 0 &&
        point.radiusCm <= MAX_SIZE_CM &&
        Number.isFinite(point.heightCm) &&
        Math.abs(point.heightCm) <= MAX_SIZE_CM;
      if (!spec.profile.every(valid)) return text('profile-range', { max: MAX_SIZE_CM });
      if (arcLengths(spec.profile).at(-1)! <= 0) return text('profile-same-points');
      if (spec.profile.every((point) => point.radiusCm === 0)) return text('profile-zero-radius');
      return null;
    }
  }
}

export interface Schedule {
  readonly counts: readonly number[];
  /** Magic ring, the open edge of a previous section, or a foundation chain (oval). */
  readonly start: 'ring' | 'open' | 'chain';
  readonly end: PieceEnd;
  /** Rounds worked into the back loop (0-based): the round after a sharp turn. KB: 04 §9.3 */
  readonly backLoop: readonly number[];
  readonly widthCm: number;
  readonly heightCm: number;
  readonly oval?: {
    readonly chains: number;
    readonly perEnd: number;
    readonly widthCm: number;
    readonly stitch: OvalStitch;
    readonly turningChain: number;
  };
}

export type ScheduleResult =
  | { readonly ok: true; readonly schedule: Schedule }
  | { readonly ok: false; readonly reason: CoreText<ShapeCode> };

export function shapeSchedule(spec: ShapeSpec, gauge: RoundGauge): ScheduleResult {
  const problem = shapeProblem(spec);
  if (problem) return { ok: false, reason: problem };
  const schedule = buildSchedule(spec, gauge);
  if (schedule.counts.length > MAX_SHAPE_ROUNDS) {
    return { ok: false, reason: text('too-many-rounds', { rounds: schedule.counts.length, max: MAX_SHAPE_ROUNDS }) };
  }
  return { ok: true, schedule };
}

function buildSchedule(spec: ShapeSpec, gauge: RoundGauge): Schedule {
  const s = startCount(gauge);
  switch (spec.kind) {
    case 'sphere':
      return spec.method === '6n'
        ? sphereSixN(spec.diameterCm, gauge, s)
        : sphereSine(spec.diameterCm, gauge, s, false, 'closed');
    case 'hemisphere':
      return spec.method === '6n'
        ? hemisphereSixN(spec.diameterCm, gauge, s, spec.top)
        : sphereSine(spec.diameterCm, gauge, s, true, spec.top);
    case 'egg':
      return revolution(eggProfile(spec.diameterCm, spec.heightCm), 'closed', 'closed', gauge, s, 'sphere');
    case 'cylinder': {
      const r = spec.diameterCm / 2;
      const profile = [
        { radiusCm: r, heightCm: 0 },
        { radiusCm: r, heightCm: spec.heightCm },
      ];
      return revolution(profile, spec.bottom, spec.top, gauge, s, 'hold');
    }
    case 'cone':
      return cone(spec, gauge, s);
    case 'revolution':
      return revolution(spec.profile, spec.bottom, spec.top, gauge, s, 'hold');
    case 'oval':
      return oval(spec, gauge, s);
  }
}

// KB: 04 §3.4, 04 §9.4; 02 §1.6
function oval(spec: Extract<ShapeSpec, { kind: 'oval' }>, gauge: RoundGauge, s: number): Schedule {
  const stitch = ovalStitchOf(spec);
  const perEnd = s / 2;
  const rounds = Math.max(1, Math.round((spec.widthCm / 2) * gauge.roundsPerCm));
  const widthCm = (2 * rounds) / gauge.roundsPerCm;
  const straight = Math.max(1, Math.round((spec.lengthCm - widthCm) * gauge.stitchesPerCm));
  const worked = straight + 1;
  const turningChain = resolveStitch(stitch)!.turningChain;
  const counts = Array.from({ length: rounds }, (_, k) => 2 * worked - 2 + 2 * perEnd * (k + 1));
  const lengthCm = widthCm + straight / gauge.stitchesPerCm;
  return {
    counts,
    start: 'chain',
    end: 'open',
    backLoop: [],
    widthCm: lengthCm,
    heightCm: fabricThicknessCm(gauge.hookMm),
    oval: { chains: worked + turningChain, perEnd, widthCm, stitch, turningChain },
  };
}

/** Moves off `consensus` only when `exact` differs by a whole round. KB: 04 §9.2 */
export function towardConsensus(consensus: number, exact: number): number {
  return exact >= consensus ? Math.floor(exact) : Math.ceil(exact);
}

function sixN(diameterCm: number, gauge: RoundGauge, s: number) {
  const k = Math.max(2, Math.round((Math.PI * diameterCm * gauge.stitchesPerCm) / s));
  return {
    k,
    aspect: gauge.roundsPerCm / gauge.stitchesPerCm,
    up: Array.from({ length: k }, (_, i) => s * (i + 1)),
    widthCm: (s * k) / (Math.PI * gauge.stitchesPerCm),
  };
}

function sphereSixN(diameterCm: number, gauge: RoundGauge, s: number): Schedule {
  const { k, aspect, up, widthCm } = sixN(diameterCm, gauge, s);
  const even = Math.max(1, towardConsensus(k + 1, ((s * k) / 2) * aspect - (2 * k - 1)));
  const counts = [...up, ...Array<number>(even).fill(s * k), ...up.slice(0, -1).reverse()];
  // KB: 04 §4.3
  return { counts, start: 'ring', end: 'closed', backLoop: [], widthCm, heightCm: widthCm };
}

function hemisphereSixN(diameterCm: number, gauge: RoundGauge, s: number, top: PieceEnd): Schedule {
  const { k, aspect, up, widthCm } = sixN(diameterCm, gauge, s);
  const even = Math.max(0, towardConsensus(Math.round(k / 2), ((s * k) / 4) * aspect - k));
  const counts = [...up, ...Array<number>(even).fill(s * k)];
  const backLoop: number[] = [];
  if (top === 'closed') closeFlat(counts, backLoop, s, true);
  return { counts, start: 'ring', end: top, backLoop, widthCm, heightCm: widthCm / 2 };
}

function sphereSine(diameterCm: number, gauge: RoundGauge, s: number, half: boolean, top: PieceEnd): Schedule {
  const n = Math.max(3, Math.round(((Math.PI * diameterCm) / 2) * gauge.roundsPerCm));
  const equator = Math.PI * diameterCm * gauge.stitchesPerCm;
  const ideal = Array.from({ length: n }, (_, i) =>
    Math.max(1, Math.round(equator * Math.sin((Math.PI * (i + 0.5)) / n))),
  );
  const rows = half ? Math.ceil(n / 2) : n;
  let lifted = liftStart(ideal, s, 'sphere');
  if (!half) lifted = liftEnd(lifted, s, 'sphere');
  const counts = clampGrowth(lifted.slice(0, rows));
  const backLoop: number[] = [];
  if (half && top === 'closed') closeFlat(counts, backLoop, s, true);
  // KB: 04 §4.3
  const diameter = (2 * n) / (Math.PI * gauge.roundsPerCm);
  return {
    counts: clampGrowth(counts),
    start: 'ring',
    end: half ? top : 'closed',
    backLoop,
    widthCm: Math.max(...counts.slice(0, rows)) / (Math.PI * gauge.stitchesPerCm),
    heightCm: half ? (diameter * rows) / n : diameter,
  };
}

function cone(spec: Extract<ShapeSpec, { kind: 'cone' }>, gauge: RoundGauge, s: number): Schedule {
  const h = 1 / gauge.roundsPerCm;
  const radius = spec.diameterCm / 2;
  const base = Math.max(s, Math.round(Math.PI * spec.diameterCm * gauge.stitchesPerCm));
  let n: number;
  let step: number;
  let heightCm: number;
  if (spec.increases !== null) {
    step = spec.increases;
    n = Math.max(2, Math.ceil((base - s) / step) + 1);
    heightCm = Math.sqrt(Math.max(0, (n * h) ** 2 - radius ** 2));
  } else {
    const slant = Math.hypot(spec.heightCm, radius);
    n = Math.max(2, Math.round(slant * gauge.roundsPerCm));
    step = (base - s) / (n - 1);
    heightCm = (spec.heightCm * n * h) / slant;
  }
  const counts = Array.from({ length: n }, (_, i) => Math.min(base, s + Math.round(step * i)));
  counts[n - 1] = base;
  const backLoop: number[] = [];
  // From a sloping wall into a flat base the turn is always sharp.
  if (spec.top === 'closed') closeFlat(counts, backLoop, s, true);
  return {
    counts: clampGrowth(counts),
    start: 'ring',
    end: spec.top,
    backLoop,
    widthCm: base / (Math.PI * gauge.stitchesPerCm),
    heightCm,
  };
}

/** KB: 04 §4.6 */
export function eggProfile(diameterCm: number, heightCm: number, steps = 24): ProfilePoint[] {
  const a = diameterCm / 2;
  const lower = EGG_LOWER_SHARE * heightCm;
  const upper = heightCm - lower;
  const points: ProfilePoint[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = ((Math.PI / 2) * i) / steps;
    points.push({ radiusCm: a * Math.sin(t), heightCm: lower * (1 - Math.cos(t)) });
  }
  for (let i = 1; i <= steps; i += 1) {
    const t = ((Math.PI / 2) * i) / steps;
    points.push({ radiusCm: i === steps ? 0 : a * Math.cos(t), heightCm: lower + upper * Math.sin(t) });
  }
  return points;
}

function arcLengths(profile: readonly ProfilePoint[]): number[] {
  const lengths = [0];
  for (let i = 1; i < profile.length; i += 1) {
    const [a, b] = [profile[i - 1]!, profile[i]!];
    lengths.push(lengths[i - 1]! + Math.hypot(b.radiusCm - a.radiusCm, b.heightCm - a.heightCm));
  }
  return lengths;
}

function angleDeg(ax: number, ay: number, bx: number, by: number): number {
  const length = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (length === 0) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / length))) * 180) / Math.PI;
}

/** `lift` raises the pole: `sphere` doubles and smooths as for the sphere, `hold` keeps the pole count until the profile catches up, so a pointed end does not grow too fast. KB: 04 §9.3 */
function revolution(
  profile: readonly ProfilePoint[],
  bottom: PieceEnd,
  top: PieceEnd,
  gauge: RoundGauge,
  s: number,
  lift: 'sphere' | 'hold',
): Schedule {
  const lengths = arcLengths(profile);
  const total = lengths.at(-1)!;
  const n = Math.max(1, Math.round(total * gauge.roundsPerCm));
  const sample = (i: number) => ((i + 0.5) * total) / n;
  const radiusAt = (distance: number) => {
    let j = 1;
    while (j < lengths.length - 1 && lengths[j]! < distance) j += 1;
    const [a, b] = [profile[j - 1]!, profile[j]!];
    const span = lengths[j]! - lengths[j - 1]!;
    const t = span > 0 ? (distance - lengths[j - 1]!) / span : 0;
    return a.radiusCm + t * (b.radiusCm - a.radiusCm);
  };
  const ideal = Array.from({ length: n }, (_, i) =>
    Math.max(1, Math.round(2 * Math.PI * radiusAt(sample(i)) * gauge.stitchesPerCm)),
  );

  const pole = (radius: number) => 2 * Math.PI * radius * gauge.stitchesPerCm < s / 2;
  const first = profile[0]!;
  const last = profile.at(-1)!;
  const startPole = pole(first.radiusCm);
  const endPole = pole(last.radiusCm);
  let counts = ideal;
  if (startPole) counts = liftStart(counts, s, lift);
  if (endPole) counts = liftEnd(counts, s, lift);

  const sharp = new Set<number>();
  for (let j = 1; j + 1 < profile.length; j += 1) {
    const [a, b, c] = [profile[j - 1]!, profile[j]!, profile[j + 1]!];
    const turn = angleDeg(
      b.radiusCm - a.radiusCm,
      b.heightCm - a.heightCm,
      c.radiusCm - b.radiusCm,
      c.heightCm - b.heightCm,
    );
    if (turn < SHARP_TURN_DEG) continue;
    const index = counts.findIndex((_, i) => sample(i) >= lengths[j]!);
    if (index > 0) sharp.add(index);
  }

  const disc = !startPole && bottom === 'closed' ? flatUp(counts[0]!, s) : [];
  const backLoop = [...sharp].map((i) => i + disc.length);
  const second = profile[1]!;
  if (
    disc.length > 0 &&
    angleDeg(second.radiusCm - first.radiusCm, second.heightCm - first.heightCm, 1, 0) >= SHARP_TURN_DEG
  ) {
    backLoop.push(disc.length);
  }
  const all = [...disc, ...counts];
  if (!endPole && top === 'closed') {
    const before = profile.at(-2)!;
    const steep = angleDeg(last.radiusCm - before.radiusCm, last.heightCm - before.heightCm, -1, 0) >= SHARP_TURN_DEG;
    closeFlat(all, backLoop, s, steep);
  }

  const heights = profile.map((point) => point.heightCm);
  const span = Math.max(...heights) - Math.min(...heights);
  return {
    counts: clampGrowth(all),
    start: startPole || bottom === 'closed' ? 'ring' : 'open',
    end: endPole || top === 'closed' ? 'closed' : 'open',
    backLoop: [...new Set(backLoop)].sort((a, b) => a - b),
    widthCm: Math.max(...all) / (Math.PI * gauge.stitchesPerCm),
    heightCm: (span * n) / gauge.roundsPerCm / total,
  };
}

export function flatUp(target: number, s: number): number[] {
  const counts: number[] = [];
  for (let count = s; count < target; count += s) counts.push(count);
  counts.push(target);
  return counts;
}

export function flatDown(from: number, s: number): number[] {
  if (from <= s) return [];
  const counts: number[] = [];
  for (let count = from - s; count > s; count -= s) counts.push(count);
  counts.push(s);
  return counts;
}

/** If the turn is sharp, the first decrease round goes into the back loop. KB: 04 §9.3 */
function closeFlat(counts: number[], backLoop: number[], s: number, steep: boolean): void {
  const down = flatDown(counts.at(-1)!, s);
  if (down.length === 0) return;
  if (steep) backLoop.push(counts.length);
  counts.push(...down);
}

/** KB: 04 §4.4, 04 §9.2 */
export function liftStart(ideal: readonly number[], s: number, rule: 'sphere' | 'hold'): number[] {
  const counts = [...ideal];
  if (counts.length === 0 || counts[0]! >= s) return counts;
  counts[0] = s;
  if (rule === 'hold') {
    for (let i = 1; i < counts.length && ideal[i]! < counts[i - 1]! && ideal[i]! >= ideal[i - 1]!; i += 1)
      counts[i] = counts[i - 1]!;
    return counts;
  }
  const lifted = counts.map((_, i) => i === 0);
  if (counts.length > 1) {
    const ratio = ideal[1]! / Math.max(1, ideal[0]!);
    const second = Math.max(ideal[1]!, Math.min(2 * counts[0]!, Math.round(counts[0]! * ratio)));
    lifted[1] = second !== ideal[1];
    counts[1] = second;
  }
  for (let i = 2; i + 1 < counts.length && lifted[i - 1]; i += 1) {
    const before = counts[i]! - counts[i - 1]!;
    const after = counts[i + 1]! - counts[i]!;
    if (after <= 0 || before >= after) break;
    counts[i] = Math.round((counts[i - 1]! + counts[i + 1]!) / 2);
    lifted[i] = true;
  }
  return counts;
}

export function liftEnd(counts: readonly number[], s: number, rule: 'sphere' | 'hold'): number[] {
  return liftStart([...counts].reverse(), s, rule).reverse();
}

/** KB: 04 §9.0 */
export function clampGrowth(counts: readonly number[]): number[] {
  const result: number[] = [];
  for (const count of counts) {
    const previous = result.at(-1);
    result.push(
      previous === undefined ? Math.max(1, count) : Math.min(2 * previous, Math.max(Math.ceil(previous / 2), count)),
    );
  }
  return result;
}

export type RoundOp = 'sc' | 'inc' | 'dec';

/** Bresenham. KB: 03 §3.4 */
export function spread(total: number, parts: number): number[] {
  const lengths: number[] = [];
  let previous = 0;
  for (let j = 1; j <= parts; j += 1) {
    const end = Math.round((j * total) / parts);
    lengths.push(end - previous);
    previous = end;
  }
  return lengths;
}

// KB: core-domain §21; 04 §3.1, 04 §3.2, 04 §3.3, 04 §9.1, 04 §9.6
export function roundOps(
  previous: number,
  next: number,
  staggered: boolean,
  cost: (position: number) => number = () => 0,
): RoundOp[] | null {
  const change = next - previous;
  if (previous < 1 || next < 1) return null;
  if (change === 0) return Array<RoundOp>(previous).fill('sc');
  const increasing = change > 0;
  const count = Math.abs(change);
  if (increasing ? count > previous : 2 * count > previous) return null;

  const op: RoundOp = increasing ? 'inc' : 'dec';
  const width = increasing ? 1 : 2;
  const lengths = spread(previous, count);
  const starts = lengths.map((_, j) => lengths.slice(0, j).reduce((sum, length) => sum + length, 0));
  const price = (at: number) =>
    Array.from({ length: width }, (_, k) => cost(at + k)).reduce((sum, value) => sum + value, 0);
  const preferred = (length: number) => (staggered ? Math.floor((length - width) / 2) : length - width);
  const cheapest = (from: number, to: number, target: number) => {
    let best = Math.min(to, Math.max(from, target));
    for (let at = from; at <= to; at += 1) {
      const better =
        price(at) < price(best) || (price(at) === price(best) && Math.abs(at - target) < Math.abs(best - target));
      if (better) best = at;
    }
    return best;
  };
  const build = (chosen: readonly number[]) => {
    const ops: RoundOp[] = [];
    let hits = 0;
    for (let position = 0, k = 0; position < previous; ) {
      if (chosen[k] === position) {
        ops.push(op);
        hits += price(position);
        position += width;
        k += 1;
      } else {
        ops.push('sc');
        position += 1;
      }
    }
    return { ops, hits };
  };

  let best = build(lengths.map((length, j) => starts[j]! + preferred(length)));
  for (let d = 0; best.hits > 0 && d < Math.max(...lengths); d += 1) {
    const option = build(lengths.map((length, j) => starts[j]! + Math.max(0, length - width - d)));
    if (option.hits < best.hits) best = option;
  }
  if (best.hits > 0) {
    const option = build(
      lengths.map((length, j) => cheapest(starts[j]!, starts[j]! + length - width, starts[j]! + preferred(length))),
    );
    if (option.hits < best.hits) best = option;
  }
  if (best.hits > 0) {
    // In a dense round no segment has a cheap spot: take the lowest total cost over the whole round, drifting a little off the targets.
    const option = build(
      placeByCost(
        previous,
        lengths.map((length, j) => starts[j]! + preferred(length)),
        width,
        price,
      ),
    );
    if (option.hits < best.hits) best = option;
  }
  return best.ops;
}

/** What one position of distance from the target costs: a cheaper spot is worth this much extra distance. */
const DISTANCE_COST = 0.05;

// Dynamic programming: at each operation, the best place found so far for the previous one.
function placeByCost(
  previous: number,
  targets: readonly number[],
  width: number,
  price: (at: number) => number,
): number[] {
  const n = targets.length;
  const rows: { readonly value: Float64Array; readonly back: Int32Array }[] = [];
  for (let j = 0; j < n; j += 1) {
    const value = new Float64Array(previous).fill(Number.POSITIVE_INFINITY);
    const back = new Int32Array(previous).fill(-1);
    let before = j === 0 ? 0 : Number.POSITIVE_INFINITY;
    let beforeAt = -1;
    for (let at = j * width; at <= previous - width * (n - j); at += 1) {
      if (j > 0) {
        const candidate = rows[j - 1]!.value[at - width]!;
        if (candidate < before) {
          before = candidate;
          beforeAt = at - width;
        }
      }
      if (!Number.isFinite(before)) continue;
      value[at] = before + price(at) + DISTANCE_COST * Math.abs(at - targets[j]!);
      back[at] = beforeAt;
    }
    rows.push({ value, back });
  }
  const last = rows[n - 1]!.value;
  let at = 0;
  for (let c = 1; c < previous; c += 1) if (last[c]! < last[at]!) at = c;
  const chosen: number[] = [];
  for (let j = n - 1; j >= 0; j -= 1) {
    chosen.unshift(at);
    at = rows[j]!.back[at]!;
  }
  return chosen;
}

export type Curvature = 'flat' | 'cupping' | 'tube' | 'ruffled' | 'closing';

export interface RoundDiagnosis {
  readonly round: number;
  readonly count: number;
  readonly change: number;
  /** KB: 04 §9.6 */
  readonly ratio: number;
  readonly curvature: Curvature;
}

export function curvatureOf(ratio: number): Curvature {
  if (ratio > RUFFLING_RATIO) return 'ruffled';
  if (ratio >= CUPPING_RATIO) return 'flat';
  if (ratio > TUBE_RATIO) return 'cupping';
  if (ratio >= -TUBE_RATIO) return 'tube';
  return 'closing';
}

/** With an open start, round 1 counts against the previous edge (`before`). KB: 04 §8, 04 §9.6 */
export function diagnoseRounds(counts: readonly number[], gauge: RoundGauge, before = 0): RoundDiagnosis[] {
  const flat = flatRate(gauge);
  return counts.map((count, i) => {
    const change = count - (i === 0 ? before : counts[i - 1]!);
    const ratio = change / flat;
    return { round: i + 1, count, change, ratio, curvature: curvatureOf(ratio) };
  });
}

export function evenDistribution(a: number, b: number): number[] {
  return spread(Math.max(a, b), Math.min(a, b));
}

export function distributionProblem(
  a: number,
  b: number,
  distribution: readonly number[] | undefined,
): CoreText<ShapeCode> | null {
  if (distribution === undefined) {
    return a === b ? null : text('join-count-differs', { a, b });
  }
  const small = Math.min(a, b);
  const large = Math.max(a, b);
  const valid =
    distribution.length === small &&
    distribution.every((n) => Number.isInteger(n) && n >= 1) &&
    distribution.reduce((sum, n) => sum + n, 0) === large;
  return valid ? null : text('distribution-mismatch', { small, large });
}

export interface PieceShape {
  readonly piece: PieceId;
  readonly name: string;
  readonly widthCm: number;
  readonly heightCm: number;
  readonly sections: readonly { readonly name: string; readonly layer: number; readonly schedule: Schedule }[];
}

/** With a continuous join the transition round counts as one extra round when the stitch count changes. */
export function pieceShapes(pattern: Pattern, gauge: RoundGauge = roundGaugeOf(pattern)): PieceShape[] {
  const shapes: PieceShape[] = [];
  for (const piece of pattern.pieces) {
    const sections: PieceShape['sections'][number][] = [];
    let heightCm = 0;
    for (const section of piece.sections ?? []) {
      const planned = shapeSchedule(section.shape, shapeGaugeOf(pattern, section.shape, gauge));
      if (!planned.ok) continue;
      const previous = sections.at(-1)?.schedule.counts.at(-1);
      if (previous !== undefined && previous !== planned.schedule.counts[0]) heightCm += 1 / gauge.roundsPerCm;
      heightCm += planned.schedule.heightCm;
      sections.push({ name: section.name, layer: section.layer, schedule: planned.schedule });
    }
    if (sections.length === 0) continue;
    const widthCm = Math.max(...sections.map((section) => section.schedule.widthCm));
    shapes.push({ piece: piece.id, name: piece.name, widthCm, heightCm, sections });
  }
  return shapes;
}

/** Spherical cap height: how deep an `R`-radius part sinks into an `a`-radius edge. */
export function capHeight(R: number, a: number): number {
  return a >= R ? R : R - Math.sqrt(R * R - a * a);
}

export interface FigureSize {
  readonly parts: readonly PieceShape[];
  readonly widthCm: number;
  /** KB: 04 §9.7 */
  readonly heightCm: number;
}

// KB: 04 §5.8, 04 §9.7
export function figureSize(pattern: Pattern, gauge: RoundGauge = roundGaugeOf(pattern)): FigureSize | null {
  const parts = pieceShapes(pattern, gauge);
  if (parts.length === 0) return null;
  const byPiece = new Map(parts.map((part) => [part.piece, part]));
  const library = libraryFor(pattern);
  const w = 1 / gauge.stitchesPerCm;

  const edges: { a: PieceId; b: PieceId; overlap: number }[] = [];
  for (const join of pattern.joins ?? []) {
    const ends = [join.a, join.b].map((edge) => edgeInfo(pattern, edge, library));
    const [a, b] = ends;
    const partA = byPiece.get(join.a.piece);
    const partB = byPiece.get(join.b.piece);
    if (!a || !b || !partA || !partB) continue;
    const rim = (Math.min(a.count, b.count) * w) / (2 * Math.PI);
    let overlap = 0;
    if (!a.openRim) overlap += capHeight(partA.widthCm / 2, rim);
    if (!b.openRim) overlap += capHeight(partB.widthCm / 2, rim);
    edges.push({ a: join.a.piece, b: join.b.piece, overlap });
  }

  let heightCm = 0;
  const walk = (piece: PieceId, visited: Set<PieceId>, sum: number) => {
    heightCm = Math.max(heightCm, sum);
    for (const edge of edges) {
      const next = edge.a === piece ? edge.b : edge.b === piece ? edge.a : null;
      if (next === null || visited.has(next)) continue;
      walk(next, new Set([...visited, next]), sum + byPiece.get(next)!.heightCm - edge.overlap);
    }
  };
  for (const part of parts) walk(part.piece, new Set([part.piece]), part.heightCm);
  return { parts, widthCm: Math.max(...parts.map((part) => part.widthCm)), heightCm };
}

interface EdgeInfo {
  readonly count: number;
  readonly stitches: readonly NodeId[];
  readonly openRim: boolean;
}

function graphOf(pattern: Pattern, piece: Piece, library: StitchLibrary): PieceGraph | null {
  try {
    return buildPieceGraph(pattern, piece, library);
  } catch {
    return null;
  }
}

function edgeInfo(pattern: Pattern, edge: JoinEdge, library: StitchLibrary): EdgeInfo | null {
  const piece = pattern.pieces.find((candidate) => candidate.id === edge.piece);
  const graph = piece ? graphOf(pattern, piece, library) : null;
  const layer = graph?.layers[edge.layer];
  if (!piece || !graph || !layer || edge.layer < 1) return null;
  // A garment seam: a run of one row, or the row ends down one side.
  if (edge.stitches) {
    const { from, count } = edge.stitches;
    if (
      layer.shape !== 'row' ||
      !Number.isInteger(from) ||
      from < 0 ||
      count < 1 ||
      from + count > layer.positions.length
    )
      return null;
    return { count, stitches: layer.positions.slice(from, from + count), openRim: false };
  }
  if (edge.rows) {
    const { to, side } = edge.rows;
    if (to < edge.layer || to >= graph.layers.length) return null;
    const ends: NodeId[] = [];
    for (const row of graph.layers.slice(edge.layer, to + 1)) {
      const edges = row.shape === 'row' ? rowEdges(row) : null;
      if (!edges) return null;
      // KB: 01 §8.4
      const startSide = row.side === 'right' ? 'right' : 'left';
      ends.push(side === startSide ? edges.start : edges.end);
    }
    return { count: ends.length, stitches: ends, openRim: false };
  }
  const last = edge.layer === graph.layers.length - 1;
  const closed = layer.closing?.marks?.includes('close-opening') === true;
  return { count: layer.stitchCount, stitches: layer.stitches, openRim: last && !closed };
}

export interface PatternFinding {
  readonly rule: RuleId;
  readonly piece: PieceId;
  readonly nodes: readonly NodeId[];
}

// KB: 04 §5.4, 04 §5.7, 04 §9.6
export function amigurumiFindings(pattern: Pattern, library: StitchLibrary): PatternFinding[] {
  const findings: PatternFinding[] = [];
  for (const join of pattern.joins ?? []) {
    const a = edgeInfo(pattern, join.a, library);
    const b = edgeInfo(pattern, join.b, library);
    if (!a || !b) {
      findings.push({ rule: 'join-edge', piece: join.a.piece, nodes: a?.stitches ?? [] });
      continue;
    }
    if (distributionProblem(a.count, b.count, join.distribution) !== null) {
      findings.push({ rule: 'join-count', piece: join.a.piece, nodes: a.stitches });
    }
  }
  if (pattern.toy?.under3) {
    for (const piece of pattern.pieces) {
      const eyes = piece.events.filter((event) => event.marks?.includes('safety-eyes')).map((event) => event.after);
      if (eyes.length > 0) findings.push({ rule: 'toy-safety-eyes', piece: piece.id, nodes: eyes });
    }
  }
  return findings;
}
