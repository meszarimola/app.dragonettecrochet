/*
 * A „Ruhadarab” szakasz tartalma (PQW-866): a választható ruhadarabok,
 * táblázatok és méretek, a mezők alapértéke, a választott méret terve, az
 * ellenőrzések összesítése, a figyelmeztetések (a táblázat gyanús adatai is)
 * és a méretsorozat szövege, ahogy az írott mintába kerül.
 *
 * DOM nélküli, ezért a Node is futtatja (tests/ui-garment-view.test.mjs), és a
 * magot `.ts` kiterjesztéssel importálja.
 */

import { BODY_TABLES_ORDER, GARMENT_EASE, NEGATIVE_EASE_LIMIT, fitLevelOf, type BodyTableId } from '../core/body-sizes.ts';
import { sizingLines } from '../core/garment-text.ts';
import {
  BELOW_WAIST_CM,
  DEFAULT_GARMENT,
  DEFAULT_HAT,
  DROP_SHOULDER_EASE,
  GARMENT_KINDS,
  garmentSizes,
  type DropShoulderPlan,
  type GarmentOptions,
  type GarmentSeriesPlan,
  type HatPlan,
} from '../core/garments.ts';
import type { RaglanPlan } from '../core/raglan.ts';
import { stitchById } from '../core/stitches.ts';
import type { GarmentKind } from '../core/types.ts';
import { texts } from './i18n.ts';
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

export function sizeChoices(kind: GarmentKind, table: BodyTableId): Choice<string>[] {
  return garmentSizes(kind, table).map((size) => ({ value: size.id, label: size.name }));
}

/** Melyik mező látszik: a táblázat, a derék alatti hossz és a mintaismétlés csak a pulóvernél. */
export interface GarmentFieldState {
  readonly table: boolean;
  readonly belowWaist: boolean;
  /** A nyakkivágás választása csak pulóvernél (PQW-901). */
  readonly neckline: boolean;
  readonly repeat: boolean;
}

export function garmentFieldState(kind: GarmentKind): GarmentFieldState {
  const sweater = kind === 'drop-shoulder';
  // A raglán is testméret-táblázatból dolgozik, de a nyakat és a mintaismétlést maga adja (PQW-901).
  return { table: sweater || kind === 'raglan', belowWaist: sweater || kind === 'raglan', neckline: sweater, repeat: sweater };
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

/**
 * A mezők alapértéke a ruhadarabhoz és a táblázathoz: a méret a táblázat
 * közepe (vagy az M), a sorozat a szomszédos méretekkel.
 */
export function defaultsFor(kind: GarmentKind, table: BodyTableId): GarmentOptions {
  if (kind === 'hat') return { ...DEFAULT_HAT, table };
  // A raglán bősége a „C” példa szerinti +8 cm; a nyakkivágást és a mintaismétlést nem használja.
  const forKind = (options: GarmentOptions): GarmentOptions => (kind === 'raglan' ? { ...options, kind, easeCm: 8, repeat: null } : options);
  if (table === 'women') return forKind(DEFAULT_GARMENT);
  const ids = garmentSizes(kind, table).map((size) => size.id);
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

/** A választás összhangba hozva: a sorozat mindig tartalmazza a rajz méretét; a mintaismétlés csak pulóvernél. */
export function normalizeGarment(options: GarmentOptions): GarmentOptions {
  const ids = garmentSizes(options.kind, options.table).map((size) => size.id);
  const base = ids.includes(options.size) ? options.size : defaultsFor(options.kind, options.table).size;
  const at = ids.indexOf(base);
  const from = ids.includes(options.from) ? Math.min(ids.indexOf(options.from), at) : at;
  const to = ids.includes(options.to) ? Math.max(ids.indexOf(options.to), at) : at;
  return {
    ...options,
    size: base,
    from: ids[from]!,
    to: ids[to]!,
    // A mintaismétlés csak a ledobott vállú pulóvernél számít (PQW-866, PQW-901).
    repeat: options.kind === 'drop-shoulder' ? options.repeat : null,
  };
}

export interface GarmentView {
  /** A rajz méretének kész mérete; becslésnél „≈”. */
  readonly size: string;
  readonly details: readonly string[];
  /** „24/24 ellenőrzés igaz, 3 méret.” */
  readonly checks: string;
  /** A hamis ellenőrzések, méretenként. */
  readonly failed: readonly string[];
  readonly warnings: readonly string[];
  /** A méretsorozat sorai, ahogy az írott mintába kerülnek. */
  readonly series: readonly string[];
  readonly source: string;
}

const cm = (value: number) => formatNumber(value, 0);
/** Előjeles szám nyomdai mínuszjellel: „+11”, „−2,5”. */
function signedNumber(value: number, digits: number): string {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumber(Math.abs(value), digits)}`;
}
const signed = (value: number) => signedNumber(value, 0);

export function garmentView(plan: GarmentSeriesPlan, hasProfile: boolean): GarmentView {
  const t = texts().panels.garment;
  const approx = plan.gauge.source === 'estimated' ? '≈ ' : '';
  const base = plan.sizes[plan.base]!;
  const many = plan.sizes.length > 1;
  const details: string[] = [];
  let size: string;
  if (base.plan.kind === 'hat') {
    size = t.hatSize(base.name, approx, cm(base.plan.finishedCm), cm(base.plan.finishedHeightCm), base.plan.counts.length);
    details.push(...hatDetails(base.plan));
  } else if (base.plan.kind === 'raglan') {
    const { finished } = base.plan;
    size = t.raglanSize(base.name, approx, cm(finished.chestCm), cm(finished.lengthCm), base.plan.yokeRounds + base.plan.bodyRoundsBelow);
    details.push(...raglanDetails(base.plan));
  } else {
    const { finished } = base.plan;
    size = t.sweaterSize(base.name, approx, cm(finished.chestCm), cm(finished.lengthCm), cm(finished.sleeveCm));
    details.push(...sweaterDetails(base.plan));
  }
  if (plan.yarnMissing) {
    details.push(t.yarnMissing);
  } else if (base.yarn) {
    details.push(t.yarn(base.yarn.lengthM, base.yarn.balls));
  }

  const prefix = (name: string) => (many ? t.prefix(name) : '');
  // A hamis ellenőrzés mellé javaslat is jár, ha van (05 §9.6, PQW-901).
  const failed = plan.sizes.flatMap((entry) =>
    entry.plan.checks
      .filter((check) => !check.ok)
      .map((check) => t.failedCheck(prefix(entry.name), check.label, check.suggestion === undefined ? '' : ` ${check.suggestion}`)),
  );
  const checks =
    plan.checksPassed === plan.checksTotal
      ? t.allChecks(plan.checksPassed, plan.checksTotal, many ? t.checkSizes(plan.sizes.length) : '')
      : t.someChecks(plan.checksPassed, plan.checksTotal);

  const warnings: string[] = [];
  for (const entry of plan.sizes) {
    warnings.push(...entry.plan.warnings.map((warning) => t.warning(prefix(entry.name), warning)));
    if (entry.estimated.length > 0) warnings.push(t.estimatedSize(entry.name, entry.estimated));
    warnings.push(...entry.flags.map((flag) => t.flag(entry.name, flag.note)));
  }
  for (const issue of plan.monotonic) warnings.push(t.monotonic(issue.label, issue.size));

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

/** Az állapotsor üzenete a létrehozás után. */
export function generatedMessage(plan: GarmentSeriesPlan): string {
  const t = texts().panels.garment;
  const base = plan.sizes[plan.base]!;
  const series = plan.sizes.length > 1 ? t.generatedSeries(plan.sizes.length) : '';
  return t.generated(t.names[plan.kind], base.name, series);
}
