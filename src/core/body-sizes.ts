// KB: core-domain §7; 05 §3, 05 §5, 05 §9.1

import { text, type CoreText } from './messages.ts';
import type { Locale } from './types.ts';

export type BodyTableId = 'women' | 'men' | 'child' | 'baby';

export const BODY_TABLES_ORDER: readonly BodyTableId[] = ['women', 'men', 'child', 'baby'];

export type BodyMeasure =
  | 'chest'
  | 'neckToWrist'
  | 'backWaist'
  | 'backHip'
  | 'crossBack'
  | 'armLength'
  | 'upperArm'
  | 'armholeDepth'
  | 'waist'
  | 'hips';

export type Range = readonly [min: number, max: number];

export interface BodyValue {
  readonly cm: Range;
  readonly inch?: Range;
}

export interface BodySize {
  readonly id: string;
  readonly values: Readonly<Partial<Record<BodyMeasure, BodyValue>>>;
}

export interface BodyTable {
  readonly id: BodyTableId;
  readonly name: string;
  readonly source: string;
  readonly measures: readonly BodyMeasure[];
  readonly sizes: readonly BodySize[];
  readonly notes: readonly string[];
}

type Cell = number | Range | null;

const range = (cell: number | Range): Range => (typeof cell === 'number' ? [cell, cell] : cell);

function table(
  id: BodyTableId,
  name: string,
  source: string,
  sizeIds: readonly string[],
  rows: readonly { readonly measure: BodyMeasure; readonly cm: readonly Cell[]; readonly inch?: readonly Cell[] }[],
  notes: readonly string[] = [],
): BodyTable {
  const sizes = sizeIds.map((sizeId, i) => {
    const values: Partial<Record<BodyMeasure, BodyValue>> = {};
    for (const row of rows) {
      const cm = row.cm[i];
      if (cm === null || cm === undefined) continue;
      const inch = row.inch?.[i];
      values[row.measure] = { cm: range(cm), ...(inch === null || inch === undefined ? {} : { inch: range(inch) }) };
    }
    return { id: sizeId, values };
  });
  return { id, name, source, measures: rows.map((row) => row.measure), sizes, notes };
}

// KB: 05 §3.1
export const WOMEN = table(
  'women',
  'Női',
  'https://www.craftyarncouncil.com/standards/woman-size',
  ['XS', 'S', 'M', 'L', 'XL', '2X', '3X', '4X', '5X'],
  [
    {
      measure: 'chest',
      cm: [[71, 76], [81, 86], [91.5, 96.5], [101.5, 106.5], [111.5, 117], [122, 127], [132, 137], [142, 147], [152, 158]],
      inch: [[28, 30], [32, 34], [36, 38], [40, 42], [44, 46], [48, 50], [52, 54], [56, 58], [60, 62]],
    },
    {
      measure: 'neckToWrist',
      cm: [[66, 68.5], [68.5, 70], [71, 72.5], [73.5, 75], [73.5, 75], [76.5, 77.5], [77.5, 79], [80, 81.5], [80, 81.5]],
      inch: [[26, 26.5], [27, 27.5], [28, 28.5], [29, 29.5], [29, 29.5], [30, 30.5], [30.5, 31], [31.5, 32], [31.5, 32]],
    },
    {
      measure: 'backWaist',
      cm: [42, 43, 43.5, 44.5, 45, 45.5, 45.5, 47, 47],
      inch: [16.5, 17, 17.25, 17.5, 17.75, 18, 18, 18.5, 18.5],
    },
    {
      measure: 'crossBack',
      cm: [[35.5, 37], [37, 38], [39.5, 40.5], [42, 43], 44.5, 45.5, 45.5, 47, 47],
      inch: [[14, 14.5], [14.5, 15], [15.5, 16], [16.5, 17], 17.5, 18, 18, 18.5, 18.5],
    },
    {
      measure: 'armLength',
      cm: [42, 43, 43, 44.5, 44.5, 45.5, 45.5, 47, 47],
      inch: [16.5, 17, 17, 17.5, 17.5, 18, 18, 18.5, 18.5],
    },
    {
      measure: 'upperArm',
      cm: [25, 26, 28, 30.5, 34.5, 39.5, 43, 47, 49.5],
      inch: [9.75, 10.25, 11, 12, 13.5, 15.5, 17, 18.5, 18.5],
    },
    {
      measure: 'armholeDepth',
      cm: [[15.5, 16.5], [16.5, 17.5], [17.5, 19], [19, 20.5], [20.5, 21.5], [21.5, 23], [23, 24], [24, 25.5], [25.5, 26.5]],
      inch: [[6, 6.5], [6.5, 7], [7, 7.5], [7.5, 8], [8, 8.5], [8.5, 9], [9, 9.5], [9.5, 10], [10, 10.5]],
    },
    {
      measure: 'waist',
      cm: [[58.5, 61], [63.5, 67.5], [71, 76], [81.5, 86.5], [91.5, 96.5], [101.5, 106.5], [111.5, 114], [116.5, 119], [124, 127]],
      inch: [[23, 24], [25, 26.5], [28, 30], [32, 34], [36, 38], [40, 42], [44, 45], [46, 47], [49, 50]],
    },
    {
      measure: 'hips',
      cm: [[83.5, 86], [89, 91.5], [96.5, 101.5], [106.5, 111.5], [116.5, 122], [132, 134.5], [137, 139.5], [142, 144.5], [155, 157]],
      inch: [[33, 34], [35, 36], [38, 40], [42, 44], [46, 48], [52, 53], [54, 55], [56, 57], [61, 62]],
    },
  ],
);

// KB: 05 §3.2
export const MEN = table(
  'men',
  'Férfi',
  'https://www.craftyarncouncil.com/standards/man-size',
  ['S', 'M', 'L', 'XL', '2X', '3X', '4X', '5X'],
  [
    {
      measure: 'chest',
      cm: [[86, 91.5], [96.5, 101.5], [106.5, 111.5], [116.5, 122], [127, 132], [137, 142], [147.5, 152], [157.5, 162.5]],
      inch: [[34, 36], [38, 40], [42, 44], [46, 48], [50, 52], [54, 56], [58, 60], [62, 64]],
    },
    { measure: 'neckToWrist', cm: [[81, 82.5], [83.5, 85], [86.5, 87.5], [89, 90], [91.5, 92.5], [94, 95], [96.5, 97.5], [99, 100.5]] },
    { measure: 'backHip', cm: [[58.5, 61], [63.5, 66], [66, 68.5], 71, 73.5, 76, 76, 79] },
    { measure: 'crossBack', cm: [[39.5, 40.5], [42, 43], [44.5, 45.5], [45.5, 47], [48, 51], [48, 51], [51, 54.5], [56, 57]] },
    // KB: 05 §3.2 — the source prints 49.5 cm beside 21", and 21" is 53.5 cm.
    { measure: 'armLength', cm: [45.5, 47, 49.5, 50.5, 52, 52, 49.5, [53.5, 54.5]], inch: [null, null, null, null, null, null, 21, null] },
  ],
  [
    'A forrás a csípőig mért háthosszt „háthossz a derékig” néven közli; az értékek a csípőig mért hossznak felelnek meg (05 §3.2).',
    'A felkarbőség és a karöltőmélység hiányzik: a karöltő a mellbőségből becsült (mellbőség/6 + 5 cm, 05 §4.6).',
  ],
);

// KB: 05 §3.3
export const CHILD = table(
  'child',
  'Gyerek',
  'https://www.craftyarncouncil.com/standards/child-youth-sizes',
  ['2', '4', '6', '8', '10', '12', '14', '16'],
  [
    { measure: 'chest', cm: [53, 58.5, 63.5, 67, 71, 76, 80, 82.5], inch: [21, 23, 25, 26.5, 28, 30, 31.5, 32.5] },
    { measure: 'neckToWrist', cm: [45.5, 49.5, 52, 56, 61, 66, 68.5, 71] },
    { measure: 'backWaist', cm: [21.5, 24, 26.5, 31.5, 35.5, 38, 39.5, 40.5] },
    { measure: 'crossBack', cm: [23.5, 25, 26, 27, 28.5, 30.5, 31, 33] },
    { measure: 'armLength', cm: [21.5, 26.5, 29, 31.5, 34.5, 38, 40.5, 42] },
    { measure: 'upperArm', cm: [17.5, 19, 20.5, 21.5, 22, 23, 23.5, 24] },
    { measure: 'armholeDepth', cm: [10.5, 12, 12.5, 14, 15.5, 16.5, 17.5, 19] },
    { measure: 'waist', cm: [53.5, 54.5, 57, 59.5, 62, 63.5, 67.5, 69.5] },
    { measure: 'hips', cm: [56, 59.5, 63.5, 71, 75, 80, 83.5, 90] },
  ],
);

// KB: 05 §3.4
export const BABY = table(
  'baby',
  'Baba',
  'https://www.craftyarncouncil.com/standards/baby-size-chart',
  ['3', '6', '12', '18', '24'],
  [
    { measure: 'chest', cm: [40.5, 43, 45.5, 48, 50.5], inch: [16, 17, 18, 19, 20] },
    { measure: 'neckToWrist', cm: [26.5, 29, 31.5, 35.5, 45.5], inch: [10.5, 11.5, 12.5, 14, 18] },
    { measure: 'backWaist', cm: [15.5, 17.5, 19, 20.5, 21.5], inch: [6, 7, 7.5, 8, 8.5] },
    { measure: 'crossBack', cm: [18.5, 19.5, 21, 21.5, 22], inch: [7.25, 7.75, 8.25, 8.5, 8.75] },
    { measure: 'armLength', cm: [15.5, 16.5, 19, 20.5, 21.5], inch: [6, 6.5, 7.5, 8, 8.5] },
    { measure: 'upperArm', cm: [14, 15.5, 16.5, 17.5, 19], inch: [5.5, 6, 6.5, 7, 7.5] },
    { measure: 'armholeDepth', cm: [8.5, 9, 9.5, 10, 10.5], inch: [3.25, 3.5, 3.75, 4, 4.25] },
    { measure: 'waist', cm: [45.5, 48, 50.5, 52, 53.5], inch: [18, 19, 20, 20.5, 21] },
    { measure: 'hips', cm: [48, 50.5, 50.5, 53.5, 56], inch: [19, 20, 20, 21, 22] },
  ],
);

export const BODY_TABLES: Readonly<Record<BodyTableId, BodyTable>> = { women: WOMEN, men: MEN, child: CHILD, baby: BABY };

export function mid(value: BodyValue): number {
  return (value.cm[0] + value.cm[1]) / 2;
}

export function bodySizeName(tableId: BodyTableId, sizeId: string, locale: Locale): string {
  const en = locale !== 'hu';
  if (tableId === 'child') return en ? `${sizeId} yrs` : `${sizeId} év`;
  if (tableId === 'baby') return en ? `${sizeId} mo` : `${sizeId} hó`;
  return sizeId;
}

export type DataFlagKind = 'inch-mismatch' | 'not-monotonic' | 'identical-rows';

export type BodySizeCode = 'flag-inch-mismatch' | 'flag-not-monotonic' | 'flag-identical-rows';

export interface DataFlag {
  readonly size: string;
  readonly measure: BodyMeasure;
  readonly kind: DataFlagKind;
  readonly note: CoreText<BodySizeCode>;
}

// KB: 05 §3.1 — the source rounds to at most ~1.2 cm, so anything larger is its own error.
export const INCH_TOLERANCE_CM = 1.5;
// KB: 05 §3.1
export const IDENTICAL_RUN = 3;

// KB: 05 §3.1, 05 §9.1
export function tableFlags(bodyTable: BodyTable): DataFlag[] {
  const flags: DataFlag[] = [];
  const seen = new Set<string>();
  const push = (flag: DataFlag) => {
    const key = `${flag.size}|${flag.measure}|${flag.kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    flags.push(flag);
  };
  const { sizes, measures } = bodyTable;

  for (const measure of measures) {
    sizes.forEach((size, i) => {
      const value = size.values[measure];
      if (!value) return;
      if (value.inch) {
        const off = Math.max(Math.abs(value.cm[0] - value.inch[0] * 2.54), Math.abs(value.cm[1] - value.inch[1] * 2.54));
        if (off > INCH_TOLERANCE_CM) {
          const converted: Range = [inchToCm(value.inch[0]), inchToCm(value.inch[1])];
          push({
            size: size.id,
            measure,
            kind: 'inch-mismatch',
            note: text('flag-inch-mismatch', { measure, inch: value.inch, converted, cm: value.cm }),
          });
        }
      }
      const previous = i > 0 ? sizes[i - 1]!.values[measure] : undefined;
      if (previous && (value.cm[0] < previous.cm[0] - 1e-9 || value.cm[1] < previous.cm[1] - 1e-9)) {
        push({
          size: size.id,
          measure,
          kind: 'not-monotonic',
          note: text('flag-not-monotonic', { measure, cm: value.cm, previous: previous.cm }),
        });
      }
    });
  }

  const same = (a: BodyValue | undefined, b: BodyValue | undefined) => a !== undefined && b !== undefined && a.cm[0] === b.cm[0] && a.cm[1] === b.cm[1];
  for (let p = 0; p < measures.length; p += 1) {
    for (let q = p + 1; q < measures.length; q += 1) {
      const [m1, m2] = [measures[p]!, measures[q]!];
      let start = 0;
      for (let i = 0; i <= sizes.length; i += 1) {
        if (i < sizes.length && same(sizes[i]!.values[m1], sizes[i]!.values[m2])) continue;
        if (i - start >= IDENTICAL_RUN) {
          for (let j = start; j < i; j += 1) {
            for (const [measure, other] of [[m1, m2], [m2, m1]] as const) {
              push({
                size: sizes[j]!.id,
                measure,
                kind: 'identical-rows',
                note: text('flag-identical-rows', { measure, other, from: sizes[start]!.id, to: sizes[i - 1]!.id }),
              });
            }
          }
        }
        start = i + 1;
      }
    }
  }
  return flags;
}

// KB: 05 §3.5, 05 §7.2

export type FitLevel = 'very-close' | 'close' | 'classic' | 'loose' | 'oversized';

export const FIT_EASE: Readonly<Record<FitLevel, { readonly name: string; readonly min: number; readonly max: number | null }>> = {
  'very-close': { name: 'nagyon testhezálló', min: -10, max: -5 },
  close: { name: 'testhezálló', min: 0, max: 0 },
  classic: { name: 'klasszikus', min: 5, max: 10 },
  loose: { name: 'bő', min: 10, max: 15 },
  oversized: { name: 'túlméretes', min: 15, max: null },
};

// KB: 05 §2.1, 05 §3.5, 05 §5.2, 05 §7.2
export const GARMENT_EASE = {
  dropShoulderBust: [15, 30] as Range,
  cardiganBustMin: 5,
  sleeve: 5,
  // KB: 05 §3.5, 05 §5.2
  hatSmallHead: -2.5,
  hatLargeHead: -5,
  hatHeadLimitCm: 46,
};

// KB: 05 §3.5, 05 §7.2
export const NEGATIVE_EASE_LIMIT = 0.1;
// KB: 05 §3.5 — above this the generator refuses.
export const NEGATIVE_EASE_MAX = 0.15;

// KB: 05 §3.5, 05 §7.2
export function hatEase(headCm: number): number {
  const rule = headCm < GARMENT_EASE.hatHeadLimitCm ? GARMENT_EASE.hatSmallHead : GARMENT_EASE.hatLargeHead;
  return Math.max(rule, Math.round(-NEGATIVE_EASE_LIMIT * headCm * 10) / 10);
}

// KB: 05 §3.5 — a value between two bands goes to the nearer one.
export function fitLevelOf(easeCm: number): FitLevel {
  if (easeCm < -2.5) return 'very-close';
  if (easeCm < 2.5) return 'close';
  if (easeCm < 10) return 'classic';
  if (easeCm < 15) return 'loose';
  return 'oversized';
}

export interface HeadRange {
  readonly id: string;
  readonly name: string;
  readonly cm: Range;
  readonly inch: Range;
}

// KB: 05 §5.1
export const HEAD_CIRCUMFERENCE: readonly HeadRange[] = [
  { id: 'preemie', name: 'Koraszülött', cm: [23, 30.5], inch: [9, 12] },
  { id: 'baby', name: 'Baba', cm: [35.5, 40.5], inch: [14, 16] },
  { id: 'toddler', name: 'Kisgyerek', cm: [40.5, 46], inch: [16, 18] },
  { id: 'child', name: 'Gyerek', cm: [45.5, 51], inch: [18, 20] },
  { id: 'tween', name: 'Kiskamasz', cm: [51, 56], inch: [20, 22] },
  { id: 'woman', name: 'Felnőtt nő', cm: [53, 58.5], inch: [21, 23] },
  { id: 'man', name: 'Felnőtt férfi', cm: [56, 61], inch: [22, 24] },
];

export const HEAD_SOURCE = 'https://www.craftyarncouncil.com/standards/head-circumference-chart';
export const HAT_SOURCE = 'https://blog.treasurie.com/crochet-hat-size-guide-charts-printable-templates/';

export interface HatSize {
  readonly id: string;
  readonly name: string;
  readonly nameEn: string;
  readonly headIn: number;
  readonly hatIn: number;
  readonly crownIn: number;
  readonly midEarIn: number;
  readonly belowEarIn: number;
}

// KB: 05 §5.2
export const HAT_SIZES: readonly HatSize[] = [
  { id: 'preemie', name: 'Koraszülött', nameEn: 'Preemie', headIn: 12, hatIn: 11, crownIn: 3.75, midEarIn: 4, belowEarIn: 4.25 },
  { id: 'newborn', name: 'Újszülött', nameEn: 'Newborn', headIn: 14, hatIn: 13, crownIn: 4.25, midEarIn: 5, belowEarIn: 5.25 },
  { id: '3-6m', name: '3–6 hónap', nameEn: '3–6 mo', headIn: 16, hatIn: 15, crownIn: 5, midEarIn: 5.5, belowEarIn: 5.75 },
  { id: '6-12m', name: '6–12 hónap', nameEn: '6–12 mo', headIn: 17, hatIn: 16, crownIn: 5.25, midEarIn: 6, belowEarIn: 6.5 },
  { id: '1-3y', name: '1–3 év', nameEn: '1–3 yrs', headIn: 18, hatIn: 17, crownIn: 5.5, midEarIn: 6, belowEarIn: 6.75 },
  { id: '3-6y', name: 'Gyerek 3–6 év', nameEn: 'Child 3–6', headIn: 19, hatIn: 17, crownIn: 5.5, midEarIn: 6.5, belowEarIn: 7.25 },
  { id: '6-10y', name: 'Gyerek 6–10 év', nameEn: 'Child 6–10', headIn: 20, hatIn: 18, crownIn: 5.75, midEarIn: 7, belowEarIn: 8 },
  { id: 'adult-s', name: 'Felnőtt S', nameEn: 'Adult S', headIn: 21, hatIn: 19, crownIn: 6.25, midEarIn: 7, belowEarIn: 8 },
  { id: 'adult-m', name: 'Felnőtt M', nameEn: 'Adult M', headIn: 22, hatIn: 20, crownIn: 6.5, midEarIn: 7.5, belowEarIn: 8.5 },
  { id: 'adult-l', name: 'Felnőtt L', nameEn: 'Adult L', headIn: 23, hatIn: 21, crownIn: 6.75, midEarIn: 8, belowEarIn: 9 },
];

export const inchToCm = (inch: number): number => Math.round(inch * 2.54 * 10) / 10;

export function hatSizeName(sizeId: string, locale: Locale): string {
  const size = HAT_SIZES.find((candidate) => candidate.id === sizeId);
  if (!size) return sizeId;
  return locale === 'hu' ? size.name : size.nameEn;
}
