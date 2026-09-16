/*
 * A „Méret és fonal” szakasz szövegei (PQW-859), DOM nélkül: kész méret
 * soronként és a teljes darabra, fonalbecslés, a tűméret átváltása, és minden
 * érték mellett az eredete (mért, címkéről, becsült). A becslés mindig
 * tartománnyal jelenik meg; profil nélkül a szakasz ezt külön ki is mondja.
 *
 * A feliratok a felület nyelvén szólnak (PQW-900, src/ui/i18n/sections.ts); a
 * számalak és a mértékegységek mindkét nyelven a magyarok (cm, g, m, mm).
 *
 * A felület a magot `.ts` kiterjesztéssel importálja.
 */

import { hookByMm, isSteelHook, nearestHookSize, type HookSize } from '../core/hook-sizes.ts';
import { yarnWeightOf, type PatternSize } from '../core/pattern-size.ts';
import type { Quantity } from '../core/quantity.ts';
import type { StitchLibrary } from '../core/stitch-library.ts';
import { stitchName } from '../core/stitchText.ts';
import type { GaugeEntry, GaugeForm, PatternGaugeProfile, StitchDefId, ValueSource } from '../core/types.ts';
import { CYC_WEIGHTS } from '../core/yarn-weight.ts';
import { texts, uiLanguage } from './i18n.ts';
import { termsLocale } from './notation.ts';

/** Egy érték eredete a felület nyelvén: „mért”, „címkéről”, „becsült”. */
export function sourceLabel(source: ValueSource): string {
  return texts().sections.size.sources[source];
}

/** A mintasűrűség mérésének formája: „síkban”, „körben”. */
export function formLabel(form: GaugeForm): string {
  return texts().sections.size.forms[form];
}

const formats = new Map<string, Intl.NumberFormat>();

/**
 * Számalak legfeljebb `digits` tizedessel, a FELÜLET nyelve szerint (PQW-905):
 * magyarul tizedesvessző („19,7”), angolul tizedespont („19.7”). A mértékegység
 * (cm, g, m, mm) mindkét nyelven ugyanaz, azt a szótár adja.
 */
export function formatNumber(value: number, digits = 1): string {
  const language = uiLanguage();
  const key = `${language}:${digits}`;
  let format = formats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'hu-HU', { maximumFractionDigits: digits, useGrouping: false });
    formats.set(key, format);
  }
  return format.format(value);
}

export interface ValueText {
  /** Az érték mértékegységgel; becslésnél „≈” előtaggal. */
  readonly value: string;
  readonly source: ValueSource;
  /** A tartomány; pontos értéknél, vagy ha a két határ kerekítve egyezik, `null`. */
  readonly range: string | null;
}

export function quantityText(quantity: Quantity, unit: string, digits: number): ValueText {
  const suffix = unit ? ` ${unit}` : '';
  const value = `${quantity.source === 'estimated' ? '≈ ' : ''}${formatNumber(quantity.value, digits)}${suffix}`;
  if (!quantity.range) return { value, source: quantity.source, range: null };
  const [min, max] = quantity.range.map((bound) => formatNumber(bound, digits));
  return { value, source: quantity.source, range: min === max ? null : `${min}–${max}${suffix}` };
}

/** Cm: 1 cm alatt két tizedes, fölötte egy. */
export function cmText(quantity: Quantity, unit = 'cm'): ValueText {
  return quantityText(quantity, unit, quantity.value < 1 ? 2 : 1);
}

/** Egysoros alak: „≈ 8,5 cm (becsült: 6,5–11,2 cm)”, „8,5 cm (mért)”. */
export function valueLine(text: ValueText): string {
  return `${text.value} (${sourceLabel(text.source)}${text.range ? `: ${text.range}` : ''})`;
}

function hookNames(size: HookSize): string {
  const hook = texts().sections.size.hook;
  return [size.us ? `US ${size.us}` : null, size.oldUk ? hook.oldUk(size.oldUk) : null].filter((part) => part !== null).join(' · ');
}

/** A tű amerikai és régi brit mérete a mm mellé (02 §2); a kulcs mindig a mm. */
export function hookSizesText(mm: number): string {
  const hook = texts().sections.size.hook;
  if (isSteelHook(mm)) return hook.steel;
  const exact = hookByMm(mm);
  if (exact) return hookNames(exact) || hook.none;
  const nearest = nearestHookSize(mm);
  return hook.nonStandard(formatNumber(nearest.mm, 3), hookNames(nearest));
}

export function cycWeightLabel(weight: number): string {
  const entry = CYC_WEIGHTS[weight];
  return entry ? `${weight} – ${entry.name}` : String(weight);
}

export function gaugeStitchName(library: StitchLibrary, id: StitchDefId): string {
  const def = library.get(id);
  return def ? stitchName(def, termsLocale()) : id;
}

/** A profil neve a választóban: fonal, tű, blokkolás. */
export function profileLabel(profile: PatternGaugeProfile): string {
  const words = texts().sections.size.profile;
  const name = profile.yarn.name.trim() || words.unnamedYarn;
  return `${name} · ${formatNumber(profile.hookMm, 2)} mm · ${profile.blocked ? words.blocked : words.unblocked}`;
}

/** Egy érték eredete a mező mellett; ha nincs mit jelölni, `null`. */
export interface Origin {
  readonly text: string;
  readonly source: ValueSource;
}

export interface ProfileOrigins {
  readonly cycWeight: Origin | null;
  readonly metersPer100g: Origin | null;
  readonly ballMassG: Origin | null;
  readonly hookMm: Origin;
  readonly swatch: Origin | null;
}

const origin = (source: ValueSource, text = sourceLabel(source)): Origin => ({ text, source });

/** A profil mezőinek eredete. A vastagság a m/100 g-ből becsült, ha a címkéről nincs megadva. */
export function profileOrigins(profile: PatternGaugeProfile): ProfileOrigins {
  const weight = yarnWeightOf(profile);
  const { widthCm, heightCm, massG } = profile.swatch;
  return {
    cycWeight: !weight
      ? null
      : weight.source === 'estimated'
        ? origin('estimated', texts().sections.size.profile.estimatedFromMeterage(cycWeightLabel(weight.value)))
        : origin('label'),
    metersPer100g: profile.yarn.metersPer100g === null ? null : origin('label'),
    ballMassG: profile.yarn.ballMassG === null ? null : origin('label'),
    hookMm: origin('measured'),
    swatch: widthCm === null && heightCm === null && massG === null ? null : origin('measured'),
  };
}

/** A hiányos gauge-sor megjegyzése, a profil szerinti becsléssel; kitöltött sornál üres. */
export function gaugeEntryNote(entry: GaugeEntry, estimate: { readonly stitchesPer10cm: number; readonly rowsPer10cm: number }): string {
  if (entry.stitchesPer10cm !== null && entry.rowsPer10cm !== null) return '';
  return texts().sections.size.gauge.note(formatNumber(estimate.stitchesPer10cm), formatNumber(estimate.rowsPer10cm), entry.form);
}

export interface ValueRow {
  readonly label: string;
  readonly text: ValueText;
}

export interface LayerRow {
  readonly label: string;
  readonly width: string;
  readonly height: string;
  readonly total: string;
  readonly source: ValueSource;
}

export interface SizeView {
  /** Figyelmeztetés, ha a méret (részben) becslés; mért méretnél `null`. */
  readonly notice: string | null;
  readonly total: readonly ValueRow[];
  readonly totalNote: string | null;
  /** A soronkénti táblázat oszlopai: sor, szélesség, magasság, eddig; az eredet a sor fejlécében. */
  readonly headers: readonly string[];
  readonly layers: readonly LayerRow[];
  readonly yarn: readonly ValueRow[];
  readonly yarnNote: string;
}

export function sizeView(result: PatternSize): SizeView {
  const words = texts().sections.size.result;
  const { size, profile } = result;
  const bases = new Set((size?.layers ?? []).flatMap((layer) => layer.basis));
  let notice: string | null = null;
  if (!profile) {
    notice = words.noProfile(formatNumber(result.hookMm, 2));
  } else if (size?.estimated) {
    const how = (['profile-stitch', 'profile-other-form', 'hook'] as const).filter((basis) => bases.has(basis)).map((basis) => words.basis[basis]);
    notice = words.partial(how.join('; '));
  }

  const total: ValueRow[] = [];
  if (size?.total?.form === 'rows') {
    total.push({ label: words.width, text: cmText(size.total.widthCm) }, { label: words.height, text: cmText(size.total.heightCm) });
  } else if (size?.total?.form === 'circle') {
    total.push({ label: words.diameter, text: cmText(size.total.widthCm) });
  }
  const totalNote = !size ? words.noLayers : !size.total ? words.mixedTotal : null;

  const round = size?.layers[0]?.shape === 'round';
  const headers = words.headers(round);
  const layers = (size?.layers ?? []).map((layer, i) => ({
    label: words.layerLabel(result.layerIndexes[i] ?? i + 1, layer.shape === 'round'),
    width: cmText(layer.widthCm, '').value,
    height: cmText(layer.heightCm, '').value,
    total: cmText(layer.totalHeightCm, '').value,
    source: layer.source,
  }));

  let yarn: ValueRow[] = [];
  let yarnNote: string;
  if (result.yarn.kind === 'estimate') {
    const { estimate, ballMassG, ballLengthM } = result.yarn;
    yarn = [
      { label: words.yarnInPiece, text: quantityText(estimate.massG, 'g', estimate.massG.value < 10 ? 1 : 0) },
      { label: words.lengthWithBuffer, text: quantityText(estimate.lengthWithBufferM, 'm', estimate.lengthWithBufferM.value < 10 ? 1 : 0) },
      { label: words.balls, text: quantityText(estimate.balls, words.ballsUnit, 0) },
    ];
    yarnNote = words.yarnNote(formatNumber(ballMassG, 0), formatNumber(ballLengthM, 0));
  } else {
    yarnNote = words.missingNote(result.yarn.missing.map((missing) => words.missing[missing]).join(', '));
  }

  return { notice, total, totalNote, headers, layers, yarn, yarnNote };
}
