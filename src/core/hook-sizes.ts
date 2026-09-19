// KB: 02 §2.1, 02 §2.2

import type { Quantity } from './quantity.ts';
import { estimate } from './quantity.ts';

export interface HookSize {
  readonly mm: number;
  readonly us: string | null;
  readonly oldUk: string | null;
}

export const HOOK_SIZES: readonly HookSize[] = [
  { mm: 2, us: null, oldUk: '14' },
  { mm: 2.25, us: 'B-1', oldUk: '13' },
  { mm: 2.5, us: null, oldUk: '12' },
  { mm: 2.75, us: 'C-2', oldUk: null },
  { mm: 3, us: null, oldUk: '11' },
  { mm: 3.125, us: 'D', oldUk: null },
  { mm: 3.25, us: 'D-3', oldUk: '10' },
  { mm: 3.5, us: 'E-4', oldUk: '9' },
  { mm: 3.75, us: 'F-5', oldUk: null },
  { mm: 4, us: 'G-6', oldUk: '8' },
  { mm: 4.25, us: 'G', oldUk: null },
  { mm: 4.5, us: '7', oldUk: '7' },
  { mm: 5, us: 'H-8', oldUk: '6' },
  { mm: 5.25, us: 'I', oldUk: null },
  { mm: 5.5, us: 'I-9', oldUk: '5' },
  { mm: 5.75, us: 'J', oldUk: null },
  { mm: 6, us: 'J-10', oldUk: '4' },
  { mm: 6.5, us: 'K-10½', oldUk: '3' },
  { mm: 7, us: null, oldUk: '2' },
  { mm: 8, us: 'L-11', oldUk: '0' },
  { mm: 9, us: 'M/N-13', oldUk: '00' },
  { mm: 10, us: 'N/P-15', oldUk: '000' },
  // KB: 02 §2.1 — there is no agreed US label for 12 mm.
  { mm: 11.5, us: 'P-16', oldUk: null },
  { mm: 12, us: null, oldUk: null },
  { mm: 15, us: 'P/Q', oldUk: null },
  { mm: 15.75, us: 'Q', oldUk: null },
  { mm: 16, us: 'Q', oldUk: null },
  { mm: 19, us: 'S', oldUk: null },
  { mm: 25, us: 'T/U/X', oldUk: null },
  { mm: 30, us: 'T/X', oldUk: null },
];

const MM_EPSILON = 1e-6;

export function hookByMm(mm: number): HookSize | null {
  return HOOK_SIZES.find((size) => Math.abs(size.mm - mm) < MM_EPSILON) ?? null;
}

export function nearestHookSize(mm: number): HookSize {
  let nearest = HOOK_SIZES[0];
  for (const size of HOOK_SIZES) if (Math.abs(size.mm - mm) < Math.abs(nearest.mm - mm)) nearest = size;
  return nearest;
}

function usTokens(label: string): string[] {
  return label
    .toUpperCase()
    .replace(/\s*(?:½|1\/2)/g, '.5')
    .replace(/([A-Z])(\d)/g, '$1 $2')
    .split(/[\s/-]+/)
    .filter((token) => token !== '')
    .map((token) => (/^\d+(?:\.\d+)?$/.test(token) ? String(Number(token)) : token));
}

// One US label can fit several hooks (G is 4 and 4.25 mm), so every match is returned. KB: 02 §2.1
export function mmFromUs(label: string): readonly number[] {
  const wanted = usTokens(label);
  if (wanted.length === 0) return [];
  return HOOK_SIZES.filter((size) => {
    if (size.us === null) return false;
    const tokens = usTokens(size.us);
    return wanted.every((token) => tokens.includes(token));
  }).map((size) => size.mm);
}

// `0`, `00` and `000` are three different hooks, so old-UK sizes stay strings. KB: 02 §2.1
export function mmFromOldUk(label: string): number | null {
  const wanted = label.trim();
  return HOOK_SIZES.find((size) => size.oldUk === wanted)?.mm ?? null;
}

// KB: 02 §2.2
export function isSteelHook(mm: number): boolean {
  return mm < 2;
}

interface SteelSeries {
  readonly source: string;
  readonly mm: Readonly<Record<string, readonly number[]>>;
}

// KB: 02 §2.2 — the ambiguous CYC second-row values (4/0 = 1.75, 12 = 0.60) are left out.
export const STEEL_HOOK_SERIES: readonly SteelSeries[] = [
  {
    source: '02 §2.2 A sor: magyar táblázat, a CYC első oszlopa',
    mm: {
      '00': [3.5],
      '0': [3.25],
      '1': [2.75],
      '2': [2.25],
      '3': [2.1],
      '4': [2],
      '5': [1.9],
      '6': [1.8],
      '7': [1.65],
      '8': [1.5],
      '9': [1.4],
      '10': [1.3],
      '11': [1.1],
      '12': [1],
      '13': [0.85],
      '14': [0.75],
    },
  },
  {
    source: '02 §2.2 a CYC második sora',
    mm: {
      '00': [2.7],
      '0': [2.55],
      '1': [2.35],
      '2': [2.2],
      '5': [1.7],
      '6': [1.6],
      '7': [1.5],
      '8': [1.4],
      '9': [1.25],
      '10': [1.15],
      '11': [1.05],
      '12': [1],
      '13': [0.85],
      '14': [0.9, 0.75],
    },
  },
  {
    source: '02 §2.2 crochetcalc',
    mm: { '4': [1.65], '5': [1.4], '6': [1.3], '7': [1.1], '8': [1], '10': [0.85], '12': [0.75], '14': [0.6] },
  },
  { source: '02 §2.2 Clover (keresési kivonat)', mm: { '0': [1.75] } },
];

// KB: 02 §2.2, 02 §9
export function mmFromUsSteel(label: string): Quantity | null {
  const wanted = label.trim();
  const values = STEEL_HOOK_SERIES.flatMap((series) =>
    Object.hasOwn(series.mm, wanted) ? (series.mm[wanted] ?? []) : [],
  );
  if (values.length === 0) return null;
  return estimate(values[0], [Math.min(...values), Math.max(...values)]);
}
