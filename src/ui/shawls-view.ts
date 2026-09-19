// KB: interface.md §1

import {
  DEVIATION_LIMIT,
  piRounds,
  type RateChoice,
  ROUND_SHAWLS,
  SHAWL_KINDS,
  type ShawlGeometry,
  type ShawlKind,
  type ShawlOptions,
  type ShawlPlan,
  type ShawlSizes,
  type ShawlText,
  type ShawlWarning,
  SYMMETRIC_SHAWLS,
} from '../core/shawls.ts';
import { stitchById } from '../core/stitches.ts';
import { renderCoreText } from './i18n/core/render.ts';
import { SHAPE_CORE_TEXTS } from './i18n/core/shape.ts';
import { texts, uiLanguage } from './i18n.ts';
import { termsLocale } from './notation.ts';
import type { Choice } from './shapes-view.ts';
import { formatNumber } from './size-view.ts';

export { STITCH_CHOICES } from './shapes-view.ts';

export const KIND_CHOICES: readonly Choice<ShawlKind>[] = SHAWL_KINDS.map((value) => ({
  value,
  get label() {
    return texts().panels.shawl.names[value];
  },
}));

export const RATE_CHOICES: readonly Choice<RateChoice>[] = (['theory', 'custom'] as const).map((value) => ({
  value,
  get label() {
    return texts().panels.shawl.rates[value];
  },
}));

export function shawlReason(reason: ShawlText): string {
  return renderCoreText(SHAPE_CORE_TEXTS[uiLanguage()], reason);
}

export interface ShawlFieldState {
  readonly length: boolean;
  readonly rate: boolean;
  readonly custom: boolean;
  readonly wings: boolean;
}

export function shawlFieldState(options: ShawlOptions): ShawlFieldState {
  const stole = options.kind === 'stole';
  return {
    length: stole,
    rate: !stole,
    custom: !stole && options.rate === 'custom',
    wings: options.kind === 'triangle',
  };
}

export function sizeLabel(kind: ShawlKind): string {
  const labels = texts().panels.shawl.sizeLabels;
  switch (kind) {
    case 'triangle':
    case 'crescent':
      return labels.spine;
    case 'asymmetric-triangle':
      return labels.straightEdge;
    case 'stole':
      return labels.width;
    default:
      return labels.radius;
  }
}

export function rateLabel(kind: ShawlKind): string {
  return texts().panels.shawl.rateLabels[kind];
}

export function edgingLabel(kind: ShawlKind): string {
  const t = texts().panels.shawl;
  const what = ROUND_SHAWLS.includes(kind)
    ? t.edgingWhat.round
    : kind === 'stole'
      ? t.edgingWhat.row
      : t.edgingWhat.lastRow;
  return t.edgingLabel(what, SYMMETRIC_SHAWLS.includes(kind));
}

export function normalizeShawl(options: ShawlOptions): ShawlOptions {
  return {
    ...options,
    wings: options.kind === 'triangle' && options.wings,
    rate: options.kind === 'stole' ? 'theory' : options.rate,
  };
}

const cm = (value: number) => formatNumber(value, 0);
const rate = (value: number) => formatNumber(value, value >= 10 ? 1 : 2);
const percent = (ratio: number) => formatNumber(ratio * 100, 0);
const angle = (value: number) => formatNumber(value, 0);

export interface ShawlView {
  readonly size: string;
  readonly details: readonly string[];
  readonly warnings: readonly string[];
  readonly source: string;
}

const dimensions = (geometry: ShawlGeometry, kind: ShawlKind) =>
  kind === 'semicircle' || ROUND_SHAWLS.includes(kind)
    ? texts().panels.shawl.diameterSize(cm(geometry.widthCm))
    : texts().panels.shawl.boxSize(cm(geometry.widthCm), cm(geometry.depthCm));

export function shawlView(plan: ShawlPlan, options: ShawlOptions, sizes: ShawlSizes, hasProfile: boolean): ShawlView {
  const t = texts().panels.shawl;
  const approx = plan.gauge.source === 'estimated' ? '≈ ' : '';
  const rows = plan.counts.length;
  const noun = plan.worked === 'rounds' ? t.roundNoun : t.rowNoun;
  const [measured, other] =
    sizes.measured === 'blocked' ? [sizes.blocked, sizes.unblocked] : [sizes.unblocked, sizes.blocked];
  const [measuredName, otherName] =
    sizes.measured === 'blocked' ? [t.blockedName, t.unblockedName] : [t.unblockedName, t.blockedName];
  const size = t.sizeLine(
    measuredName,
    approx,
    dimensions(measured, plan.kind),
    otherName,
    dimensions(other, plan.kind),
    rows,
    noun,
  );

  const details: string[] = [];
  const first = plan.counts[0]!;
  const last = plan.counts.at(-1)!;
  details.push(t.firstLast(noun, first, last));
  const symmetric = SYMMETRIC_SHAWLS.includes(plan.kind);
  switch (plan.kind) {
    case 'triangle':
      details.push(
        t.triangleRate(rate(plan.theoryRate), rate(plan.chosenRate), rate(plan.edgeRate), rate(2 * plan.spineRate)),
      );
      break;
    case 'crescent':
      details.push(t.crescentRate(rate(plan.theoryRate), rate(plan.chosenRate)));
      break;
    case 'asymmetric-triangle':
      details.push(t.asymmetricRate(rate(plan.theoryRate), rate(plan.chosenRate)));
      break;
    case 'semicircle':
      details.push(t.semicircleRate(rate(plan.theoryRate), rate(plan.chosenRate)));
      break;
    case 'circle':
      details.push(t.circleRate(rate(plan.theoryRate), rate(plan.chosenRate)));
      break;
    case 'pi':
    case 'shifted-pi': {
      details.push(t.piDoubling([...piRounds(plan.kind === 'shifted-pi', rows)].sort((a, b) => a - b)));
      break;
    }
    case 'stole':
      details.push(t.stoleNote);
      break;
  }
  if (measured.neckAngleDeg !== null && measured.tipAngleDeg !== null) {
    details.push(t.neckAngle(angle(measured.neckAngleDeg), angle(measured.tipAngleDeg)));
  } else if (measured.tipAngleDeg !== null) {
    details.push(t.edgeAngle(angle(measured.tipAngleDeg)));
  }
  if (plan.wingsFromRow !== null) details.push(t.wings(plan.wingsFromRow));
  if (plan.ratio && plan.kind !== 'stole') {
    details.push(
      t.ratio(plan.worked === 'rounds' ? t.ratioRounds : t.ratioRows, percent(plan.ratio.min), percent(plan.ratio.max)),
    );
  }
  if (plan.edging && options.edging) {
    const { width, edge } = options.edging;
    const change =
      plan.edging.change === 0
        ? t.edgingNoChange
        : t.edgingChange(plan.edging.change > 0 ? '+' : '−', Math.abs(plan.edging.change), symmetric);
    details.push(t.edging(width, edge, symmetric, plan.edging.repeats, change));
  }

  const warnings = plan.warnings.map(warningText);

  const stitch = stitchById(plan.stitch).terms[termsLocale()].name;
  const gauge = gaugeText(plan, stitch, hasProfile);
  const state = sizes.measured === 'blocked' ? t.blockedState : t.unblockedState;
  return { size, details, warnings, source: `${gauge} ${state}` };
}

function warningText(warning: ShawlWarning): string {
  const t = texts().panels.shawl;
  const pct = percent(warning.ratio);
  const limit = percent(DEVIATION_LIMIT);
  const note = t.warningNote;
  switch (warning.kind) {
    case 'cupping':
      return t.cupping(pct, limit, note);
    case 'ruffling':
      return t.ruffling(pct, limit, note);
    case 'narrow':
      return t.narrow(pct, note);
    case 'wide':
      return t.wide(pct, note);
    case 'pi-blocking':
      return t.piBlocking(pct, note);
  }
}

function gaugeText(plan: ShawlPlan, stitch: string, hasProfile: boolean): string {
  const t = texts().panels.shawl;
  const form = plan.worked === 'rounds' ? t.formRounds : t.formRows;
  const hookMm = formatNumber(plan.gauge.hookMm, 2);
  switch (plan.gauge.basis) {
    case 'measured':
      return t.gaugeMeasured(stitch, plan.gauge.source === 'label' ? t.gaugeFromLabel : t.gaugeForm(form));
    case 'profile-stitch':
      return t.gaugeProfileStitch(form);
    case 'profile-other-form':
      return t.gaugeOtherForm(plan.worked === 'rounds' ? t.formRows : t.formRounds);
    case 'hook':
      return hasProfile ? t.gaugeHookProfile(hookMm) : t.gaugeHookNoProfile(hookMm);
  }
}

export interface ShawlOutline {
  readonly width: number;
  readonly height: number;
  readonly blocked: string;
  readonly unblocked: string;
}

const round = (value: number) => Math.round(value * 100) / 100;

export function shawlOutline(sizes: ShawlSizes): ShawlOutline {
  const width = Math.max(sizes.blocked.widthCm, sizes.unblocked.widthCm);
  const height = Math.max(sizes.blocked.depthCm, sizes.unblocked.depthCm);
  const points = (geometry: ShawlGeometry) =>
    geometry.outline.map(([x, y]) => `${round(x + (width - geometry.widthCm) / 2)},${round(y)}`).join(' ');
  return {
    width: round(width),
    height: round(height),
    blocked: points(sizes.blocked),
    unblocked: points(sizes.unblocked),
  };
}

export function generatedMessage(plan: ShawlPlan): string {
  const t = texts().panels.shawl;
  return t.generated(t.names[plan.kind], plan.counts.length, plan.worked === 'rounds' ? t.roundNoun : t.rowNoun);
}
