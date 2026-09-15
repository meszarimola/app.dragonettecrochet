/*
 * A „Méret és fonal” szakasz szövegei (PQW-859), DOM nélkül: kész méret
 * soronként és a teljes darabra, fonalbecslés, a tűméret átváltása, és minden
 * érték mellett az eredete (mért, címkéről, becsült). A becslés mindig
 * tartománnyal jelenik meg; profil nélkül a szakasz ezt külön ki is mondja.
 *
 * A felület a magot `.ts` kiterjesztéssel importálja.
 */

import type { DimensionBasis } from '../core/gauge.ts';
import { hookByMm, isSteelHook, nearestHookSize, type HookSize } from '../core/hook-sizes.ts';
import { yarnWeightOf, type PatternSize, type YarnMissing } from '../core/pattern-size.ts';
import type { Quantity } from '../core/quantity.ts';
import type { StitchLibrary } from '../core/stitch-library.ts';
import { stitchName } from '../core/stitchText.ts';
import type { GaugeEntry, GaugeForm, PatternGaugeProfile, StitchDefId, ValueSource } from '../core/types.ts';
import { CYC_WEIGHTS } from '../core/yarn-weight.ts';

export const SOURCE_LABELS: Readonly<Record<ValueSource, string>> = {
  measured: 'mért',
  label: 'címkéről',
  estimated: 'becsült',
};

export const FORM_LABELS: Readonly<Record<GaugeForm, string>> = { rows: 'síkban', rounds: 'körben' };

const formats = new Map<number, Intl.NumberFormat>();

/** Magyar számalak tizedesvesszővel, legfeljebb `digits` tizedessel. */
export function formatNumber(value: number, digits = 1): string {
  let format = formats.get(digits);
  if (!format) {
    format = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: digits, useGrouping: false });
    formats.set(digits, format);
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
  return `${text.value} (${SOURCE_LABELS[text.source]}${text.range ? `: ${text.range}` : ''})`;
}

function hookNames(size: HookSize): string {
  return [size.us ? `US ${size.us}` : null, size.oldUk ? `régi UK ${size.oldUk}` : null].filter((part) => part !== null).join(' · ');
}

/** A tű amerikai és régi brit mérete a mm mellé (02 §2); a kulcs mindig a mm. */
export function hookSizesText(mm: number): string {
  if (isSteelHook(mm)) return 'Acéltű: az amerikai számozás gyártónként eltér, a mm a mérvadó.';
  const exact = hookByMm(mm);
  if (exact) return hookNames(exact) || 'Nincs amerikai és régi brit megfelelője.';
  const nearest = nearestHookSize(mm);
  const names = hookNames(nearest);
  return `Nem szabványos méret; a legközelebbi ${formatNumber(nearest.mm, 3)} mm${names ? ` (${names})` : ''}.`;
}

export function cycWeightLabel(weight: number): string {
  const entry = CYC_WEIGHTS[weight];
  return entry ? `${weight} – ${entry.name}` : String(weight);
}

export function gaugeStitchName(library: StitchLibrary, id: StitchDefId): string {
  const def = library.get(id);
  return def ? stitchName(def, 'hu') : id;
}

/** A profil neve a választóban: fonal, tű, blokkolás. */
export function profileLabel(profile: PatternGaugeProfile): string {
  const name = profile.yarn.name.trim() || 'Névtelen fonal';
  return `${name} · ${formatNumber(profile.hookMm, 2)} mm · ${profile.blocked ? 'blokkolva' : 'blokkolás nélkül'}`;
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

const origin = (source: ValueSource, text = SOURCE_LABELS[source]): Origin => ({ text, source });

/** A profil mezőinek eredete. A vastagság a m/100 g-ből becsült, ha a címkéről nincs megadva. */
export function profileOrigins(profile: PatternGaugeProfile): ProfileOrigins {
  const weight = yarnWeightOf(profile);
  const { widthCm, heightCm, massG } = profile.swatch;
  return {
    cycWeight: !weight
      ? null
      : weight.source === 'estimated'
        ? origin('estimated', `becsült a m/100 g-ből: ${cycWeightLabel(weight.value)}`)
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
  const layer = entry.form === 'rows' ? 'sor' : 'kör';
  return (
    `Hiányos, a méretbe még nem számít. Becslés ehhez a profilhoz: ` +
    `${formatNumber(estimate.stitchesPer10cm)} szem és ${formatNumber(estimate.rowsPer10cm)} ${layer} 10 cm-en.`
  );
}

const BASIS_TEXT: Readonly<Record<Exclude<DimensionBasis, 'measured'>, string>> = {
  'profile-stitch': 'a nem mért szemek más mért szemből átszámolva',
  'profile-other-form': 'a másik formában mért rövidpálcából',
  hook: 'a tűméretből',
};

const MISSING_TEXT: Readonly<Record<YarnMissing, string>> = {
  profile: 'egy profil a próbadarab tömegével',
  swatch: 'a próbadarab szélessége, magassága és tömege',
  meterage: 'a fonal m/100 g értéke',
  ball: 'egy gombolyag tömege',
  size: 'a darab teljes mérete',
};

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
  const { size, profile } = result;
  const bases = new Set((size?.layers ?? []).flatMap((layer) => layer.basis));
  let notice: string | null = null;
  if (!profile) {
    notice =
      `Nincs profil: a méret becslés ${formatNumber(result.hookMm, 2)} mm-es tűből, tartománnyal. ` +
      'Pontosabb lesz, ha próbadarabot mérsz, és profilként megadod.';
  } else if (size?.estimated) {
    const how = (['profile-stitch', 'profile-other-form', 'hook'] as const).filter((basis) => bases.has(basis)).map((basis) => BASIS_TEXT[basis]);
    notice = `A méret egy része becslés${how.length > 0 ? ` (${how.join('; ')})` : ''}, tartománnyal.`;
  }

  const total: ValueRow[] = [];
  if (size?.total?.form === 'rows') {
    total.push({ label: 'Szélesség', text: cmText(size.total.widthCm) }, { label: 'Magasság', text: cmText(size.total.heightCm) });
  } else if (size?.total?.form === 'circle') {
    total.push({ label: 'Átmérő', text: cmText(size.total.widthCm) });
  }
  const totalNote = !size
    ? 'Még nincs sor vagy kör: kezdd láncalappal vagy varázskörrel, és horgolj legalább egy sort.'
    : !size.total
      ? 'Sorokból és körökből álló darab teljes mérete még nem számolható; soronként lent látszik.'
      : null;

  const round = size?.layers[0]?.shape === 'round';
  const headers = round ? ['Kör', 'Kerület, cm', 'Magasság, cm', 'Sugár, cm'] : ['Sor', 'Szélesség, cm', 'Magasság, cm', 'Eddig, cm'];
  const layers = (size?.layers ?? []).map((layer, i) => ({
    label: `${result.layerIndexes[i] ?? i + 1}. ${layer.shape === 'round' ? 'kör' : 'sor'}`,
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
      { label: 'Fonal a darabban', text: quantityText(estimate.massG, 'g', estimate.massG.value < 10 ? 1 : 0) },
      { label: 'Hossz tartalékkal', text: quantityText(estimate.lengthWithBufferM, 'm', estimate.lengthWithBufferM.value < 10 ? 1 : 0) },
      { label: 'Gombolyag', text: quantityText(estimate.balls, 'db', 0) },
    ];
    yarnNote =
      `Egy gombolyag ${formatNumber(ballMassG, 0)} g, ${formatNumber(ballLengthM, 0)} m. ` +
      'A próbadarab tömegéből, 10–15 % tartalékkal, egész gombolyagra felfelé kerekítve.';
  } else {
    yarnNote = `A fonalbecsléshez hiányzik: ${result.yarn.missing.map((missing) => MISSING_TEXT[missing]).join(', ')}.`;
  }

  return { notice, total, totalNote, headers, layers, yarn, yarnNote };
}
