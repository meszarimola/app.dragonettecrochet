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
  type ShapeText,
} from '../core/shapes.ts';
import { stitchById } from '../core/stitches.ts';
import { texts, uiLanguage } from './i18n.ts';
import { renderCoreText } from './i18n/core/render.ts';
import { SHAPE_CORE_TEXTS } from './i18n/core/shape.ts';
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

/**
 * A mag indoka mondattá a felület nyelvén (PQW-904): a mag kódot és adatot ad,
 * a névelő, a ragozás és a sor/kör szava itt kerül a mondatba.
 */
export function shapeReason(reason: ShapeText): string {
  return renderCoreText(SHAPE_CORE_TEXTS[uiLanguage()], reason);
}

/** Melyik mező látszik a választott formánál. */
export interface ShapeFieldState {
  readonly topWidth: boolean;
  readonly measure: boolean;
  readonly height: boolean;
  readonly angle: boolean;
  readonly repeat: boolean;
  /** Bordás szegély a felső élen (PQW-909). */
  readonly ribbing: boolean;
  /** A bordázat sorai és egysége; csak bekapcsolt bordázatnál. */
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

/** A szélesség mezőjének felirata a formához. */
export function widthLabel(shape: FlatShape): string {
  const labels = texts().panels.shape.widthLabels;
  if (shape === 'rectangle') return labels.rectangle;
  return shape === 'diamond' ? labels.diamond : labels.other;
}

/** A választás a formához igazítva: mintaismétlés most csak téglalapnál van. */
export function normalizeShape(options: ShapeOptions): ShapeOptions {
  // Csak akkor másolunk, ha tényleg törölni kell: a változatlan választás ugyanaz az objektum marad.
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
  /** Az előnézet mérete cm-ben. */
  readonly width: number;
  readonly height: number;
  /** A lépcsős körvonal pontjai cm-ben, SVG-sorrendben (y lefelé nő). */
  readonly points: string;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** A forma körvonala soronként lépcsősen, ahogy a sorok széle áll (shapes.ts `rowExtents`). */
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

/** Az állapotsor üzenete a létrehozás után. */
export function generatedMessage(options: ShapeOptions, plan: ShapePlan): string {
  const t = texts().panels.shape;
  // A bordás szegély sorai is elkészültek: az állapotsor a tényleges sorszámot mondja (PQW-909).
  const rows = plan.counts.length + (options.ribbing?.rows ?? 0);
  return t.generated(t.names[options.shape], rows);
}
