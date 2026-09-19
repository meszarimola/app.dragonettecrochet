// KB: 02 §1, core-support §3
import type { Quantity, Range } from './quantity.ts';
import { estimate } from './quantity.ts';

export type CycWeight = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

// `null` marks an open end of a table range ("≤ 6", "≥ 15").
export type OpenRange = readonly [min: number | null, max: number | null];

// KB: 02 §1.1
export interface CycWeightClass {
  readonly weight: CycWeight;
  readonly name: string;
  readonly gaugeStitch: 'sc' | 'dc';
  readonly stitchesPer4in: OpenRange;
  readonly hookMm: OpenRange;
}

export const CYC_WEIGHTS: readonly CycWeightClass[] = [
  { weight: 0, name: 'Lace', gaugeStitch: 'dc', stitchesPer4in: [32, 42], hookMm: [1.4, 2.25] },
  { weight: 1, name: 'Super Fine', gaugeStitch: 'sc', stitchesPer4in: [21, 32], hookMm: [2.25, 3.5] },
  { weight: 2, name: 'Fine', gaugeStitch: 'sc', stitchesPer4in: [16, 20], hookMm: [3.5, 4.5] },
  { weight: 3, name: 'Light', gaugeStitch: 'sc', stitchesPer4in: [12, 17], hookMm: [4.5, 5.5] },
  { weight: 4, name: 'Medium', gaugeStitch: 'sc', stitchesPer4in: [11, 14], hookMm: [5.5, 6.5] },
  { weight: 5, name: 'Bulky', gaugeStitch: 'sc', stitchesPer4in: [8, 11], hookMm: [6.5, 9] },
  { weight: 6, name: 'Super Bulky', gaugeStitch: 'sc', stitchesPer4in: [7, 9], hookMm: [9, 15] },
  { weight: 7, name: 'Jumbo', gaugeStitch: 'sc', stitchesPer4in: [null, 6], hookMm: [15, null] },
];

export function cycWeightClass(weight: CycWeight): CycWeightClass {
  return CYC_WEIGHTS[weight];
}

export const INCH_CM = 2.54;

// KB: 02 §8
export function per10cmFromPer4in(count: number): number {
  return (count * 10) / (4 * INCH_CM);
}

// `null` for a category with an open-ended gauge range (Jumbo).
export function cycGaugePer10cm(weight: CycWeight): { readonly stitch: 'sc' | 'dc'; readonly perTenCm: Quantity } | null {
  const { gaugeStitch, stitchesPer4in } = cycWeightClass(weight);
  const [min, max] = stitchesPer4in;
  if (min === null || max === null) return null;
  const range: Range = [per10cmFromPer4in(min), per10cmFromPer4in(max)];
  return { stitch: gaugeStitch, perTenCm: estimate((range[0] + range[1]) / 2, range) };
}

export function metersPer100g(lengthM: number, massG: number): number {
  return (lengthM / massG) * 100;
}

// KB: 02 §1.4
export interface MeterageClass {
  readonly weight: CycWeight;
  readonly candidates: readonly CycWeight[];
  readonly source: 'estimated';
}

// Lower bounds in m/100 g, in descending order: the first match wins.
const METERAGE_CLASSES: readonly { readonly min: number; readonly weight: CycWeight; readonly candidates: readonly CycWeight[] }[] = [
  { min: 600, weight: 0, candidates: [0] },
  { min: 350, weight: 1, candidates: [1] },
  { min: 280, weight: 2, candidates: [2] },
  { min: 210, weight: 3, candidates: [3] },
  { min: 150, weight: 4, candidates: [4] },
  { min: 110, weight: 4, candidates: [4, 5] },
  { min: 80, weight: 5, candidates: [5] },
  { min: 40, weight: 6, candidates: [6] },
  { min: 0, weight: 7, candidates: [7] },
];

// KB: 02 §1.4, core-support §3
export function classifyByMeterage(m100: number): MeterageClass {
  if (!(m100 > 0)) throw new RangeError(`Pozitív m/100 g értéket vártunk: ${m100}.`);
  const match = METERAGE_CLASSES.find((entry) => m100 >= entry.min) ?? METERAGE_CLASSES[METERAGE_CLASSES.length - 1];
  return { weight: match.weight, candidates: match.candidates, source: 'estimated' };
}

// "2/28" is two plies of Nm 28, so Nm 14. `null` when the label does not parse.
// KB: 02 §1.5
export function parseMetricCount(label: string): number | null {
  const match = /^\s*(?:(\d+)\s*\/\s*)?(\d+(?:[.,]\d+)?)\s*$/.exec(label);
  if (!match) return null;
  const plies = match[1] ? Number(match[1]) : 1;
  const single = Number(match[2].replace(',', '.'));
  if (plies < 1 || single <= 0) return null;
  return single / plies;
}

export function metersPer100gFromNm(nm: number): number {
  return 100 * nm;
}

// KB: 02 §1.5
export function texFromNm(nm: number): number {
  return 1000 / nm;
}
