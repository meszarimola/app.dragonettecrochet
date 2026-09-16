/*
 * A „Forma” szakasz tartalma (PQW-862): a választható formák és szemek, a
 * mezők állapota a formához, a terv kiírása a tényleges mérettel és a
 * mintasűrűség eredetével, és az előnézet körvonala.
 *
 * DOM nélküli, ezért a Node is futtatja (tests/ui-shapes-view.test.mjs), és a
 * magot `.ts` kiterjesztéssel importálja.
 */

import {
  FLAT_SHAPES,
  SHAPE_STITCHES,
  rowExtents,
  type FlatShape,
  type RepeatRounding,
  type ShapeMeasure,
  type ShapeOptions,
  type ShapePlan,
} from '../core/shapes.ts';
import { stitchById } from '../core/stitches.ts';
import type { PieceBorder } from '../core/types.ts';
import { texts } from './i18n.ts';
import { formatNumber } from './size-view.ts';
import { termsLocale } from './notation.ts';

export interface Choice<T extends string> {
  readonly value: T;
  readonly label: string;
}

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase('hu') + text.slice(1);

export const SHAPE_CHOICES: readonly Choice<FlatShape>[] = FLAT_SHAPES.map((value) => ({
  value,
  get label() {
    return texts().panels.shape.names[value];
  },
}));

export const STITCH_CHOICES: readonly Choice<string>[] = SHAPE_STITCHES.map((value) => ({
  value,
  get label() {
    return capitalize(stitchById(value).terms[termsLocale()].name);
  },
}));

export const MEASURE_CHOICES: readonly Choice<ShapeMeasure>[] = [
  {
    value: 'height',
    get label() {
      return texts().panels.shape.measures.height;
    },
  },
  {
    value: 'angle',
    get label() {
      return texts().panels.shape.measures.angle;
    },
  },
];

export const ROUNDING_CHOICES: readonly Choice<RepeatRounding>[] = (['nearest', 'up', 'down'] as const).map((value) => ({
  value,
  get label() {
    return texts().panels.shape.roundings[value];
  },
}));

/** A félpálcás sorvégre jutó szegélyszem: a források vitatják (03 §7.1). */
export const HDC_ROW_END_CHOICES: readonly Choice<`${PieceBorder['hdcRowEnd']}`>[] = [
  {
    value: '2',
    get label() {
      return texts().panels.shape.rowEndStitches(2);
    },
  },
  {
    value: '1',
    get label() {
      return texts().panels.shape.rowEndStitches(1);
    },
  },
];

/** Melyik mező látszik a választott formánál. */
export interface ShapeFieldState {
  readonly topWidth: boolean;
  readonly measure: boolean;
  readonly height: boolean;
  readonly angle: boolean;
  readonly repeat: boolean;
  readonly border: boolean;
  readonly hdcRowEnd: boolean;
  /** Igazítás a következő szegélysor ismétléséhez (PQW-898). */
  readonly borderRepeat: boolean;
}

export function shapeFieldState(options: ShapeOptions): ShapeFieldState {
  const rectangle = options.shape === 'rectangle';
  const byAngle = !rectangle && options.measure === 'angle';
  return {
    topWidth: options.shape === 'trapezoid',
    measure: !rectangle,
    height: !byAngle,
    angle: byAngle,
    repeat: rectangle,
    // Szegély minden forma köré (PQW-898).
    border: true,
    hdcRowEnd: options.border !== null && options.stitch === 'hdc',
    borderRepeat: options.border !== null,
  };
}

/** A szélesség mezőjének felirata a formához. */
export function widthLabel(shape: FlatShape): string {
  const labels = texts().panels.shape.widthLabels;
  if (shape === 'rectangle') return labels.rectangle;
  return shape === 'diamond' ? labels.diamond : labels.other;
}

/** A választás a formához igazítva: mintaismétlés most csak téglalapnál van; szegély minden formánál (PQW-898). */
export function normalizeShape(options: ShapeOptions): ShapeOptions {
  return options.shape === 'rectangle' ? options : { ...options, repeat: null };
}

const cm = (value: number) => formatNumber(value, 1);

export interface ShapeView {
  /** A tényleges méret és a sorok száma; becslésnél „≈” előtaggal. */
  readonly size: string;
  readonly details: readonly string[];
  /** Honnan jön a szemméret; profil nélkül a becslés jelzése. */
  readonly source: string;
}

export function shapeView(plan: ShapePlan, options: ShapeOptions, hasProfile: boolean): ShapeView {
  const t = texts().panels.shape;
  const approx = plan.gauge.source === 'estimated' ? '≈ ' : '';
  const rows = plan.counts.length;
  const first = plan.counts[0]!;
  const last = plan.counts.at(-1)!;
  const size = t.actualSize(approx, cm(plan.widthCm), cm(plan.heightCm), rows);

  const details: string[] = [];
  if (plan.shape === 'rectangle') details.push(t.perRow(first));
  else if (plan.shape === 'diamond') details.push(t.diamondRows(first, Math.max(...plan.counts), last));
  else details.push(t.bottomTop(first, cm(plan.bottomWidthCm), last, cm(plan.topWidthCm), approx));
  if (plan.repeats !== null && options.repeat) {
    details.push(t.repeat(options.repeat.width, options.repeat.edge, plan.repeats));
  }
  if (plan.angleDeg !== null) {
    const apex = plan.shape === 'isosceles-triangle' ? t.apexAngle(formatNumber(2 * plan.angleDeg, 0)) : '';
    details.push(t.edgeAngle(formatNumber(plan.angleDeg, 0), apex));
    details.push(t.evenShaping);
  }
  if (plan.chainExtensionRows.length > 0) details.push(t.chainExtension(plan.chainExtensionRows));
  if (plan.unworkedRows.length > 0) details.push(t.unworkedRows(plan.unworkedRows));
  if (plan.border && plan.borderedCm) {
    // A szegély rövidpálcájának mérete akkor is lehet becslés, ha a darab szeme mért.
    const borderApprox = plan.borderedCm.source === 'estimated' ? '≈ ' : '';
    const exposed = plan.border.sides[0].exposed + plan.border.sides[1].exposed;
    const extras = [
      ...(exposed > 0 ? [t.borderExposed(exposed)] : []),
      ...(plan.border.repeat ? [t.borderRepeat(plan.border.repeat.width, plan.border.repeat.edge)] : []),
    ];
    details.push(
      t.border(
        plan.border.total,
        plan.border.corner,
        plan.border.perRow,
        extras.map((extra) => `, ${extra}`).join(''),
        borderApprox,
        cm(plan.borderedCm.widthCm),
        cm(plan.borderedCm.heightCm),
      ),
    );
  }

  const stitch = stitchById(plan.stitch).terms[termsLocale()].name;
  const hookMm = formatNumber(plan.gauge.hookMm, 2);
  let source: string;
  switch (plan.gauge.basis) {
    case 'measured':
      source = t.gaugeMeasured(stitch, plan.gauge.source === 'label' ? t.gaugeFromLabel : t.gaugeFromRows);
      break;
    case 'profile-stitch':
      source = t.gaugeProfileStitch(stitch);
      break;
    case 'profile-other-form':
      source = t.gaugeOtherForm;
      break;
    case 'hook':
      source = hasProfile ? t.gaugeHookProfile(hookMm) : t.gaugeHookNoProfile(hookMm);
      break;
  }
  return { size, details, source };
}

export interface ShapeOutline {
  /** Az előnézet mérete cm-ben, a szegéllyel együtt. */
  readonly width: number;
  readonly height: number;
  /** A lépcsős körvonal pontjai cm-ben, SVG-sorrendben (y lefelé nő). */
  readonly points: string;
  /** A szegély vastagsága cm-ben; szegély nélkül 0. */
  readonly border: number;
  /** A szegély sávjának külső körvonala SVG-sorrendben (PQW-898); szegély nélkül üres. */
  readonly frame: string;
}

const round = (value: number) => Math.round(value * 100) / 100;

type Pair = readonly [number, number];

/** Konvex burok (monoton lánc). */
function convexHull(points: readonly Pair[]): Pair[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pair, a: Pair, b: Pair) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: readonly Pair[]) => {
    const hull: Pair[] = [];
    for (const p of list) {
      while (hull.length >= 2 && cross(hull[hull.length - 2]!, hull[hull.length - 1]!, p) <= 0) hull.pop();
      hull.push(p);
    }
    hull.pop();
    return hull;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

/** A szegély sávjának külső széle: a forma konvex burka a szegély vastagságával kifelé tolva, levágott sarkokkal. */
function borderFrame(points: readonly Pair[], border: number): string {
  if (border <= 0 || points.length < 3) return '';
  const hull = convexHull(points);
  const cx = hull.reduce((sum, p) => sum + p[0], 0) / hull.length;
  const cy = hull.reduce((sum, p) => sum + p[1], 0) / hull.length;
  const pushed: Pair[] = [];
  hull.forEach((p, i) => {
    for (const [a, b] of [
      [hull[(i + hull.length - 1) % hull.length]!, p],
      [p, hull[(i + 1) % hull.length]!],
    ] as const) {
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      let [nx, ny] = [(b[1] - a[1]) / length, -(b[0] - a[0]) / length];
      if (nx * (p[0] - cx) + ny * (p[1] - cy) < 0) [nx, ny] = [-nx, -ny];
      pushed.push([p[0] + nx * border, p[1] + ny * border]);
    }
  });
  return convexHull(pushed)
    .map(([x, y]) => `${round(x)},${round(y)}`)
    .join(' ');
}

/** A forma körvonala soronként lépcsősen, ahogy a sorok széle áll (shapes.ts `rowExtents`). */
export function shapeOutline(plan: ShapePlan): ShapeOutline {
  const extents = rowExtents(plan);
  const { stitchCm, rowCm } = plan.gauge;
  const border = plan.borderedCm ? (plan.borderedCm.heightCm - plan.heightCm) / 2 : 0;
  const minLeft = Math.min(...extents.map((row) => row.left));
  const maxRight = Math.max(...extents.map((row) => row.right));
  const rows = extents.length;
  const x = (stitches: number) => border + (stitches - minLeft) * stitchCm;
  const y = (row: number) => border + (rows - row) * rowCm;
  const left: string[] = [];
  const right: string[] = [];
  const corners: Pair[] = [];
  extents.forEach((row, k) => {
    left.push(`${round(x(row.left))},${round(y(k))}`, `${round(x(row.left))},${round(y(k + 1))}`);
    right.push(`${round(x(row.right))},${round(y(k))}`, `${round(x(row.right))},${round(y(k + 1))}`);
    for (const edge of [row.left, row.right]) corners.push([x(edge), y(k)], [x(edge), y(k + 1)]);
  });
  return {
    width: round((maxRight - minLeft) * stitchCm + 2 * border),
    height: round(rows * rowCm + 2 * border),
    points: [...left, ...right.reverse()].join(' '),
    border: round(border),
    frame: borderFrame(corners, border),
  };
}

/** Az állapotsor üzenete a létrehozás után; szegéllyel a szegély is (PQW-897). */
export function generatedMessage(options: ShapeOptions, plan: ShapePlan): string {
  const t = texts().panels.shape;
  return t.generated(t.names[options.shape], plan.counts.length, Boolean(plan.border));
}
