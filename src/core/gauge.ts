// KB: 02 §3.1, 02 §4.2, 02 §4.3, 02 §8

import type { GaugeProfile, StitchGauge, WorkedIn } from './gauge-profile.ts';
import type { Quantity, Range } from './quantity.ts';
import { divide, estimate, fromLabel, inverse, measured, multiply, roundCount } from './quantity.ts';
import type { StitchLibrary } from './stitch-library.ts';
import type { StitchDef } from './types.ts';

export interface Gauge {
  readonly stitches: number;
  readonly rows: number;
  readonly overCm: number;
}

// KB: 02 §3.1
export const GAUGE_TOLERANCE = 0.05;

export function stitchWidthMm(gauge: Gauge): number {
  return (gauge.overCm * 10) / gauge.stitches;
}

export function rowHeightMm(gauge: Gauge): number {
  return (gauge.overCm * 10) / gauge.rows;
}

export function stitchesForWidth(widthCm: number, gauge: Gauge): number {
  return Math.round((widthCm * gauge.stitches) / gauge.overCm);
}

export function rowsForHeight(heightCm: number, gauge: Gauge): number {
  return Math.round((heightCm * gauge.rows) / gauge.overCm);
}

export function widthForStitches(stitches: number, gauge: Gauge): number {
  return (stitches * gauge.overCm) / gauge.stitches;
}

export function heightForRows(rows: number, gauge: Gauge): number {
  return (rows * gauge.overCm) / gauge.rows;
}

export function gaugeDeviation(actual: Gauge, target: Gauge): { readonly stitches: number; readonly rows: number } {
  const density = (count: number, overCm: number) => count / overCm;
  const relative = (a: number, b: number) => (a - b) / b;
  return {
    stitches: relative(density(actual.stitches, actual.overCm), density(target.stitches, target.overCm)),
    rows: relative(density(actual.rows, actual.overCm), density(target.rows, target.overCm)),
  };
}

// Stitch gauge only: row gauge is adjusted by the loop, not by the hook. KB: 02 §3.5, 02 §8
export function gaugeMatches(actual: Gauge, target: Gauge, tolerance = GAUGE_TOLERANCE): boolean {
  return Math.abs(gaugeDeviation(actual, target).stitches) <= tolerance;
}

export function per10cm(sizeMm: Quantity): Quantity {
  return inverse(100, sizeMm);
}

export function countForLength(lengthMm: number, unitMm: Quantity): Quantity {
  return roundCount(inverse(lengthMm, unitMm));
}

// KB: 02 §3.4, 02 §4.2
export const SC_WIDTH_PER_HOOK_MM = estimate(1.41, [1.2, 1.7]);

// KB: 02 §3.4, 02 §4.2
export const SC_ASPECT_ROWS = estimate(0.8, [0.75, 0.95]);

// KB: 02 §4.2, 02 §4.3
export const SC_ASPECT_ROUNDS = estimate(1, [0.75, 1.2]);

// KB: 02 §4.2
export const WIDTH_RATIO = estimate(1, [0.9, 1.1]);

// Unsourced estimate, still to be measured. KB: 02 §4.2, 02 §9
export const CHAIN_LENGTH_RATIO = estimate(1, [0.8, 1.1]);

// KB: 01 §2.3, 02 §4.2
const HEIGHT_FACTOR_RANGES: Readonly<Partial<Record<number, Range>>> = {
  0: [0.12, 0.5],
  // 1 = single crochet: the reference every other height is measured against.
  1: [1, 1],
  2: [1.3, 1.7],
  3: [2, 2.6],
  4: [2.7, 3.9],
  5: [4, 4.9],
};

// Unsourced estimate, still to be measured. KB: 02 §9
const CHAIN_HEIGHT_RANGE: Range = [0.3, 1];

export function stitchHeightFactor(def: StitchDef): Quantity {
  const { value, source } = def.heightFactor;
  if (source !== 'estimated') return { value, source, range: null };
  const known = def.kind === 'chain' ? CHAIN_HEIGHT_RANGE : HEIGHT_FACTOR_RANGES[def.chainHeight];
  const [min, max] = known ?? [value * 0.8, value * 1.2];
  return estimate(value, [Math.min(min, value), Math.max(max, value)]);
}

export function scaleRowHeight(heightMm: Quantity, fromFactor: Quantity, toFactor: Quantity): Quantity {
  return multiply(divide(heightMm, fromFactor), toFactor);
}

export type LayerShape = 'row' | 'round';

// Ordered most reliable first; DIMENSION_BASES and the size report rely on that order.
export type DimensionBasis = 'measured' | 'profile-stitch' | 'profile-other-form' | 'hook';

export const DIMENSION_BASES: readonly DimensionBasis[] = ['measured', 'profile-stitch', 'profile-other-form', 'hook'];

export interface StitchDimensions {
  readonly widthMm: Quantity;
  readonly heightMm: Quantity;
  readonly basis: DimensionBasis;
}

export interface GaugeContext {
  readonly library: StitchLibrary;
  readonly profile: GaugeProfile | null;
  /** If a profile exists, its own hookMm wins over this one. */
  readonly hookMm: number;
}

const FORMS: Readonly<Record<LayerShape, readonly WorkedIn[]>> = {
  row: ['rows'],
  // The tube is the primary round gauge; the flat circle is coarser. KB: 02 §4.3
  round: ['rounds-tube', 'rounds-flat'],
};

const OTHER_FORMS: Readonly<Record<LayerShape, readonly WorkedIn[]>> = {
  row: FORMS.round,
  round: FORMS.row,
};

function measurementKey(def: StitchDef): string {
  return def.kind === 'joined' ? def.part : def.id;
}

function fromGauge(gauge: StitchGauge, value: number): Quantity {
  return gauge.source === 'label' ? fromLabel(value) : measured(value);
}

function measuredGauge(profile: GaugeProfile | null, key: string, forms: readonly WorkedIn[]): StitchGauge | null {
  const byForm = profile?.perStitch[key];
  if (!byForm) return null;
  for (const form of forms) {
    const gauge = byForm[form];
    if (gauge) return gauge;
  }
  return null;
}

function singleCrochetBase(shape: LayerShape, context: GaugeContext): StitchDimensions {
  const { library, profile } = context;
  const sc = measuredGauge(profile, 'sc', FORMS[shape]);
  if (sc)
    return { widthMm: fromGauge(sc, sc.widthMm.mean), heightMm: fromGauge(sc, sc.heightMm.mean), basis: 'measured' };

  // KB: 02 §8
  for (const key of Object.keys(profile?.perStitch ?? {})) {
    const def = library.get(key);
    const gauge = def?.kind === 'basic' ? measuredGauge(profile, key, FORMS[shape]) : null;
    if (!def || !gauge) continue;
    return {
      widthMm: multiply(fromGauge(gauge, gauge.widthMm.mean), WIDTH_RATIO),
      heightMm: divide(fromGauge(gauge, gauge.heightMm.mean), stitchHeightFactor(def)),
      basis: 'profile-stitch',
    };
  }

  const aspect = shape === 'row' ? SC_ASPECT_ROWS : SC_ASPECT_ROUNDS;
  const other = measuredGauge(profile, 'sc', OTHER_FORMS[shape]);
  const widthMm = other
    ? multiply(fromGauge(other, other.widthMm.mean), WIDTH_RATIO)
    : multiply(measured(profile?.hookMm ?? context.hookMm), SC_WIDTH_PER_HOOK_MM);
  return { widthMm, heightMm: multiply(widthMm, aspect), basis: other ? 'profile-other-form' : 'hook' };
}

export function stitchDimensions(def: StitchDef, shape: LayerShape, context: GaugeContext): StitchDimensions | null {
  if (def.kind === 'picot' || def.kind === 'space' || def.kind === 'ring') return null;

  const own = measuredGauge(context.profile, measurementKey(def), FORMS[shape]);
  if (own)
    return {
      widthMm: fromGauge(own, own.widthMm.mean),
      heightMm: fromGauge(own, own.heightMm.mean),
      basis: 'measured',
    };

  const base = singleCrochetBase(shape, context);
  const chainLength = context.profile?.chainLengthMm;
  let widthMm: Quantity;
  if (def.kind === 'chain') {
    widthMm = chainLength ? measured(chainLength.mean) : multiply(base.widthMm, CHAIN_LENGTH_RATIO);
  } else {
    widthMm = measurementKey(def) === 'sc' ? base.widthMm : multiply(base.widthMm, WIDTH_RATIO);
  }
  return {
    widthMm,
    heightMm: multiply(base.heightMm, stitchHeightFactor(def)),
    basis: base.basis === 'measured' ? 'profile-stitch' : base.basis,
  };
}
