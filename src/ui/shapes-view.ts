// KB: interface.md §1

import {
  FLAT_SHAPES,
  type FlatShape,
  type RepeatRounding,
  rowExtents,
  SHAPE_STITCHES,
  type ShapeMeasure,
  type ShapeOptions,
  type ShapePlan,
  type ShapeText,
} from '../core/shapes.ts';
import { stitchById } from '../core/stitches.ts';
import { renderCoreText } from './i18n/core/render.ts';
import { SHAPE_CORE_TEXTS } from './i18n/core/shape.ts';
import { texts, uiLanguage } from './i18n.ts';
import { termsLocale } from './notation.ts';
import { formatNumber } from './size-view.ts';

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

export const ROUNDING_CHOICES: readonly Choice<RepeatRounding>[] = (['nearest', 'up', 'down'] as const).map(
  (value) => ({
    value,
    get label() {
      return texts().panels.shape.roundings[value];
    },
  }),
);

export function shapeReason(reason: ShapeText): string {
  return renderCoreText(SHAPE_CORE_TEXTS[uiLanguage()], reason);
}

export interface ShapeFieldState {
  readonly topWidth: boolean;
  readonly measure: boolean;
  readonly height: boolean;
  readonly angle: boolean;
  readonly repeat: boolean;
  readonly ribbing: boolean;
  readonly ribbingFields: boolean;
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
    ribbing: true,
    ribbingFields: Boolean(options.ribbing),
  };
}

export function widthLabel(shape: FlatShape): string {
  const labels = texts().panels.shape.widthLabels;
  if (shape === 'rectangle') return labels.rectangle;
  return shape === 'diamond' ? labels.diamond : labels.other;
}

export function normalizeShape(options: ShapeOptions): ShapeOptions {
  // Copy only when something must be cleared: an unchanged choice stays the same object,
  // which is what the panels compare against to decide whether to re-render.
  return options.shape === 'rectangle' ? options : { ...options, repeat: null };
}

const cm = (value: number) => formatNumber(value, 1);

export interface ShapeView {
  readonly size: string;
  readonly details: readonly string[];
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
  readonly width: number;
  readonly height: number;
  readonly points: string;
}

const round = (value: number) => Math.round(value * 100) / 100;

export function shapeOutline(plan: ShapePlan): ShapeOutline {
  const extents = rowExtents(plan);
  const { stitchCm, rowCm } = plan.gauge;
  const minLeft = Math.min(...extents.map((row) => row.left));
  const maxRight = Math.max(...extents.map((row) => row.right));
  const rows = extents.length;
  const x = (stitches: number) => (stitches - minLeft) * stitchCm;
  const y = (row: number) => (rows - row) * rowCm;
  const left: string[] = [];
  const right: string[] = [];
  extents.forEach((row, k) => {
    left.push(`${round(x(row.left))},${round(y(k))}`, `${round(x(row.left))},${round(y(k + 1))}`);
    right.push(`${round(x(row.right))},${round(y(k))}`, `${round(x(row.right))},${round(y(k + 1))}`);
  });
  return {
    width: round((maxRight - minLeft) * stitchCm),
    height: round(rows * rowCm),
    points: [...left, ...right.reverse()].join(' '),
  };
}

export function generatedMessage(options: ShapeOptions, plan: ShapePlan): string {
  const t = texts().panels.shape;
  const rows = plan.counts.length + (options.ribbing?.rows ?? 0);
  return t.generated(t.names[options.shape], rows);
}
