// KB: interface.md §1

import { BODY_TABLES_ORDER, GARMENT_EASE, NEGATIVE_EASE_LIMIT, bodySizeName, fitLevelOf, hatSizeName, type BodyTableId } from '../core/body-sizes.ts';
import { sizingLines } from '../core/garment-text.ts';
import {
  BELOW_WAIST_CM,
  DEFAULT_GARMENT,
  DEFAULT_HAT,
  DROP_SHOULDER_EASE,
  GARMENT_KINDS,
  garmentSizes,
  type DropShoulderPlan,
  type GarmentCode,
  type GarmentOptions,
  type GarmentSeriesPlan,
  type HatPlan,
} from '../core/garments.ts';
import type { CoreText } from '../core/messages.ts';
import type { RaglanPlan } from '../core/raglan.ts';
import { stitchById } from '../core/stitches.ts';
import type { GarmentKind, GarmentTable, Locale } from '../core/types.ts';
import { texts, uiLanguage } from './i18n.ts';
import { GARMENT_CORE_TEXTS } from './i18n/core/garment.ts';
import { renderCoreText } from './i18n/core/render.ts';
import type { Choice } from './shapes-view.ts';
import { formatNumber } from './size-view.ts';
import { termsLocale } from './notation.ts';

export { STITCH_CHOICES } from './shapes-view.ts';

export const KIND_CHOICES: readonly Choice<GarmentKind>[] = GARMENT_KINDS.map((value) => ({
  value,
  get label() {
    return texts().panels.garment.names[value];
  },
}));

export const TABLE_CHOICES: readonly Choice<BodyTableId>[] = BODY_TABLES_ORDER.map((value) => ({
  value,
  get label() {
    return texts().panels.garment.tables[value];
  },
}));

export function garmentText(message: CoreText<GarmentCode>): string {
  return renderCoreText(GARMENT_CORE_TEXTS[uiLanguage()], message);
}

export function sizeName(table: GarmentTable, id: string): string {
  const locale: Locale = uiLanguage() === 'en' ? 'en-US' : 'hu';
  return table === 'hat' ? hatSizeName(id, locale) : bodySizeName(table, id, locale);
}

export function sizeChoices(kind: GarmentKind, table: BodyTableId): Choice<string>[] {
  const garmentTable: GarmentTable = kind === 'hat' ? 'hat' : table;
  return garmentSizes(kind, table).map((id) => ({ value: id, label: sizeName(garmentTable, id) }));
}

export interface GarmentFieldState {
  readonly table: boolean;
  readonly belowWaist: boolean;
  readonly neckline: boolean;
  readonly repeat: boolean;
  readonly ribbing: boolean;
}

export function garmentFieldState(kind: GarmentKind): GarmentFieldState {
  const sweater = kind === 'drop-shoulder';
  return {
    table: sweater || kind === 'raglan',
    belowWaist: sweater || kind === 'raglan',
    neckline: sweater,
    repeat: sweater,
    ribbing: sweater || kind === 'raglan',
  };
}

export function easeLabel(kind: GarmentKind): string {
  const labels = texts().panels.garment.easeLabels;
  return kind === 'hat' ? labels.hat : labels.sweater;
}

export function easeNote(kind: GarmentKind): string {
  const t = texts().panels.garment;
  const limit = Math.round(NEGATIVE_EASE_LIMIT * 100);
  if (kind === 'hat') {
    const small = signedNumber(GARMENT_EASE.hatSmallHead, 1);
    const large = signedNumber(GARMENT_EASE.hatLargeHead, 0);
    return t.easeHat(small, large, GARMENT_EASE.hatHeadLimitCm, limit);
  }
  return t.easeSweater(DROP_SHOULDER_EASE[0], DROP_SHOULDER_EASE[1], limit);
}

export function hemLabel(kind: GarmentKind): string {
  const labels = texts().panels.garment.hemLabels;
  return kind === 'hat' ? labels.hat : labels.sweater;
}

export function defaultsFor(kind: GarmentKind, table: BodyTableId): GarmentOptions {
  if (kind === 'hat') return { ...DEFAULT_HAT, table };
  const forKind = (options: GarmentOptions): GarmentOptions => (kind === 'raglan' ? { ...options, kind, easeCm: 8, repeat: null } : options);
  if (table === 'women') return forKind(DEFAULT_GARMENT);
  const ids = garmentSizes(kind, table);
  const middle = ids.includes('M') ? ids.indexOf('M') : Math.floor((ids.length - 1) / 2);
  return forKind({
    ...DEFAULT_GARMENT,
    table,
    size: ids[middle]!,
    from: ids[Math.max(0, middle - 1)]!,
    to: ids[Math.min(ids.length - 1, middle + 1)]!,
    belowWaistCm: BELOW_WAIST_CM[table],
  });
}

export function normalizeGarment(options: GarmentOptions): GarmentOptions {
  const ids = garmentSizes(options.kind, options.table);
  const base = ids.includes(options.size) ? options.size : defaultsFor(options.kind, options.table).size;
  const at = ids.indexOf(base);
  const from = ids.includes(options.from) ? Math.min(ids.indexOf(options.from), at) : at;
  const to = ids.includes(options.to) ? Math.max(ids.indexOf(options.to), at) : at;
  return {
    ...options,
    size: base,
    from: ids[from]!,
    to: ids[to]!,
    repeat: options.kind === 'drop-shoulder' ? options.repeat : null,
  };
}

export interface GarmentView {
  readonly size: string;
  readonly details: readonly string[];
  readonly checks: string;
  readonly failed: readonly string[];
  readonly warnings: readonly string[];
  readonly series: readonly string[];
  readonly source: string;
}

const cm = (value: number) => formatNumber(value, 0);
function signedNumber(value: number, digits: number): string {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumber(Math.abs(value), digits)}`;
}
const signed = (value: number) => signedNumber(value, 0);

export function garmentView(plan: GarmentSeriesPlan, hasProfile: boolean): GarmentView {
  const t = texts().panels.garment;
  const approx = plan.gauge.source === 'estimated' ? '≈ ' : '';
  const base = plan.sizes[plan.base]!;
  const baseName = sizeName(plan.table, base.id);
  const many = plan.sizes.length > 1;
  const details: string[] = [];
  let size: string;
  if (base.plan.kind === 'hat') {
    size = t.hatSize(baseName, approx, cm(base.plan.finishedCm), cm(base.plan.finishedHeightCm), base.plan.counts.length);
    details.push(...hatDetails(base.plan));
  } else if (base.plan.kind === 'raglan') {
    const { finished } = base.plan;
    size = t.raglanSize(baseName, approx, cm(finished.chestCm), cm(finished.lengthCm), base.plan.yokeRounds + base.plan.bodyRoundsBelow);
    details.push(...raglanDetails(base.plan));
  } else {
    const { finished } = base.plan;
    size = t.sweaterSize(baseName, approx, cm(finished.chestCm), cm(finished.lengthCm), cm(finished.sleeveCm));
    details.push(...sweaterDetails(base.plan));
  }
  if (plan.yarnMissing) {
    details.push(t.yarnMissing);
  } else if (base.yarn) {
    details.push(t.yarn(base.yarn.lengthM, base.yarn.balls));
  }

  const prefix = (name: string) => (many ? t.prefix(name) : '');
  // KB: 05 §9.6
  const failed = plan.sizes.flatMap((entry) =>
    entry.plan.checks
      .filter((check) => !check.ok)
      .map((check) =>
        t.failedCheck(
          prefix(sizeName(plan.table, entry.id)),
          garmentText(check.label),
          check.suggestion === undefined ? '' : ` ${garmentText(check.suggestion)}`,
        ),
      ),
  );
  const checks =
    plan.checksPassed === plan.checksTotal
      ? t.allChecks(plan.checksPassed, plan.checksTotal, many ? t.checkSizes(plan.sizes.length) : '')
      : t.someChecks(plan.checksPassed, plan.checksTotal);

  const warnings: string[] = [];
  for (const entry of plan.sizes) {
    const name = sizeName(plan.table, entry.id);
    warnings.push(...entry.plan.warnings.map((warning) => t.warning(prefix(name), garmentText(warning))));
    if (entry.estimated.length > 0) warnings.push(t.estimatedSize(name, entry.estimated.map(garmentText)));
    warnings.push(...entry.flags.map((flag) => t.flag(name, garmentText(flag.note))));
  }
  for (const issue of plan.monotonic) warnings.push(t.monotonic(garmentText(issue.label), sizeName(plan.table, issue.size)));

  const series = sizingLines({ kind: plan.kind, table: plan.table, sizes: plan.sizes.map((entry) => entry.id), base: plan.base, values: plan.values }, termsLocale());
  return { size, details, checks, failed, warnings, series, source: sourceText(plan, hasProfile) };
}

function hatDetails(plan: HatPlan): string[] {
  const t = texts().panels.garment;
  const easePct = Math.round((plan.measures.easeCm / plan.measures.headCm) * 100);
  return [
    t.hatHead(formatNumber(plan.measures.headCm, 1), signed(plan.measures.easeCm), easePct, cm(plan.hatCm), plan.stitches),
    t.hatCrown(plan.crownRounds, plan.increases, formatNumber(plan.exactIncreases, 2)),
    t.hatSide(plan.sideRounds, plan.brimRounds > 0 ? t.hatBrim(plan.brimRounds) : ''),
  ];
}

function raglanDetails(plan: RaglanPlan): string[] {
  const t = texts().panels.garment;
  const { neck, target, finished, measures } = plan;
  return [
    t.raglanNeck(neck.stitches, neck.front, neck.sleeve),
    t.raglanYoke(plan.yokeRounds, plan.bodyRounds.length > 0 ? t.raglanExtra(plan.bodyRounds.length) : ''),
    t.raglanDivide(target.front, target.sleeve, plan.underarm, plan.bodyStitches),
    t.raglanBody(plan.bodyRoundsBelow, plan.hemRounds),
    t.raglanSleeve(plan.sleeve.rounds, plan.sleeve.decreases, plan.sleeve.cuffStitches, plan.sleeve.cuffRounds),
    t.ease(signed(finished.easeCm), t.fits[fitLevelOf(finished.easeCm)], ''),
    t.body(formatNumber(measures.bustCm, 1)),
  ];
}

function sweaterDetails(plan: DropShoulderPlan): string[] {
  const t = texts().panels.garment;
  const { panel, neck, sleeve, finished, measures } = plan;
  const lines = [
    t.panel(
      panel.stitches,
      panel.repeats !== null ? t.panelRepeats(panel.repeats) : '',
      panel.rows,
      panel.hemRows,
      panel.foundation,
      panel.armholeRows,
    ),
    t.shoulder(neck.shoulder, neck.stitches),
    t.neck(neck.front.center, neck.front.first, neck.front.later, neck.back.center),
    t.sleeve(sleeve.cuff, sleeve.top, sleeve.rows, sleeve.increases, sleeve.first !== null ? t.sleeveFirst(sleeve.first) : ''),
    t.ease(
      signed(finished.easeCm),
      t.fits[fitLevelOf(finished.easeCm)],
      finished.easeCm < DROP_SHOULDER_EASE[0] ? t.easeNote(DROP_SHOULDER_EASE[0], DROP_SHOULDER_EASE[1]) : '',
    ),
  ];
  if (finished.upperArmEaseCm !== null) lines.push(t.upperArm(signed(finished.upperArmEaseCm)));
  if (finished.shoulderDropCm !== null && finished.shoulderDropCm > 0) lines.push(t.shoulderDrop(cm(finished.shoulderDropCm)));
  lines.push(t.body(formatNumber(measures.bustCm, 1)));
  return lines;
}

function sourceText(plan: GarmentSeriesPlan, hasProfile: boolean): string {
  const t = texts().panels.garment;
  const form = plan.kind === 'hat' ? t.formRounds : t.formRows;
  const stitch = stitchById(plan.stitch).terms[termsLocale()].name;
  const hookMm = formatNumber(plan.gauge.hookMm, 2);
  let gauge: string;
  switch (plan.gauge.basis) {
    case 'measured':
      gauge = t.gaugeMeasured(stitch, plan.gauge.source === 'label' ? t.gaugeFromLabel : t.gaugeMeasuredIn(form));
      break;
    case 'profile-stitch':
      gauge = t.gaugeProfileStitch(form);
      break;
    case 'profile-other-form':
      gauge = t.gaugeOtherForm(plan.kind === 'hat' ? t.formRows : t.formRounds);
      break;
    case 'hook':
      gauge = hasProfile ? t.gaugeHookProfile(hookMm) : t.gaugeHookNoProfile(hookMm);
      break;
  }
  return `${gauge} ${t.lengthNote}`;
}

export function generatedMessage(plan: GarmentSeriesPlan): string {
  const t = texts().panels.garment;
  const base = plan.sizes[plan.base]!;
  const series = plan.sizes.length > 1 ? t.generatedSeries(plan.sizes.length) : '';
  return t.generated(t.names[plan.kind], sizeName(plan.table, base.id), series);
}
