/*
 * A „Ruhadarab” szakasz tartalma (PQW-866): a választható ruhadarabok,
 * táblázatok és méretek, a mezők alapértéke, a választott méret terve, az
 * ellenőrzések összesítése, a figyelmeztetések (a táblázat gyanús adatai is)
 * és a méretsorozat szövege, ahogy az írott mintába kerül.
 *
 * DOM nélküli, ezért a Node is futtatja (tests/ui-garment-view.test.mjs), és a
 * magot `.ts` kiterjesztéssel importálja.
 */

import { BODY_TABLES, BODY_TABLES_ORDER, FIT_EASE, GARMENT_EASE, NEGATIVE_EASE_LIMIT, fitLevelOf, type BodyTableId } from '../core/body-sizes.ts';
import { sizingLines } from '../core/garment-text.ts';
import {
  BELOW_WAIST_CM,
  DEFAULT_GARMENT,
  DEFAULT_HAT,
  DROP_SHOULDER_EASE,
  GARMENT_KINDS,
  GARMENT_NAMES,
  garmentSizes,
  type DropShoulderPlan,
  type GarmentOptions,
  type GarmentSeriesPlan,
  type HatPlan,
} from '../core/garments.ts';
import type { RaglanPlan } from '../core/raglan.ts';
import { stitchById } from '../core/stitches.ts';
import type { GarmentKind } from '../core/types.ts';
import type { Choice } from './shapes-view.ts';
import { formatNumber } from './size-view.ts';

export { STITCH_CHOICES } from './shapes-view.ts';

export const KIND_CHOICES: readonly Choice<GarmentKind>[] = GARMENT_KINDS.map((value) => ({ value, label: GARMENT_NAMES[value] }));

export const TABLE_CHOICES: readonly Choice<BodyTableId>[] = BODY_TABLES_ORDER.map((value) => ({ value, label: BODY_TABLES[value].name }));

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
  return kind === 'hat' ? 'Bőség a fejkörfogathoz, cm' : 'Bőség a mellbőséghez, cm';
}

export function easeNote(kind: GarmentKind): string {
  const limit = Math.round(NEGATIVE_EASE_LIMIT * 100);
  if (kind === 'hat') {
    const small = signedNumber(GARMENT_EASE.hatSmallHead, 1);
    const large = signedNumber(GARMENT_EASE.hatLargeHead, 0);
    return `Üresen a fejmérettől függ: ${GARMENT_EASE.hatHeadLimitCm} cm alatt ${small} cm, fölötte ${large} cm. Horgolt anyagnál a negatív bőség legfeljebb kb. ${limit}%.`;
  }
  return `Ledobott vállnál ${DROP_SHOULDER_EASE[0]}–${DROP_SHOULDER_EASE[1]} cm bőség a szokásos. Horgolt anyagnál a negatív bőség legfeljebb kb. ${limit}%.`;
}

export function hemLabel(kind: GarmentKind): string {
  return kind === 'hat' ? 'Perem, cm' : 'Szegély és mandzsetta, cm';
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
const withArticle = (word: string) => `${/^[aáeéiíoóöőuúüű]/i.test(word) ? 'az' : 'a'} ${word}`;
const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase('hu') + text.slice(1);

export function garmentView(plan: GarmentSeriesPlan, hasProfile: boolean): GarmentView {
  const approx = plan.gauge.source === 'estimated' ? '≈ ' : '';
  const base = plan.sizes[plan.base]!;
  const many = plan.sizes.length > 1;
  const details: string[] = [];
  let size: string;
  if (base.plan.kind === 'hat') {
    size = `${base.name}: kész körméret ${approx}${cm(base.plan.finishedCm)} cm, magasság ${approx}${cm(base.plan.finishedHeightCm)} cm; ${base.plan.counts.length} kör.`;
    details.push(...hatDetails(base.plan));
  } else if (base.plan.kind === 'raglan') {
    const { finished } = base.plan;
    size = `${base.name}: kész mellbőség ${approx}${cm(finished.chestCm)} cm, hossz ${approx}${cm(finished.lengthCm)} cm; ${base.plan.yokeRounds + base.plan.bodyRoundsBelow} kör.`;
    details.push(...raglanDetails(base.plan));
  } else {
    const { finished } = base.plan;
    size = `${base.name}: kész mellbőség ${approx}${cm(finished.chestCm)} cm, hossz ${approx}${cm(finished.lengthCm)} cm, ujjhossz ${approx}${cm(finished.sleeveCm)} cm.`;
    details.push(...sweaterDetails(base.plan));
  }
  if (plan.yarnMissing) {
    details.push('Fonalbecsléshez add meg a Méret és fonal szakaszban a próbadarab méretét és tömegét, a fonal hosszát és a gombolyag tömegét.');
  } else if (base.yarn) {
    details.push(`Fonal tartalékkal: kb. ${base.yarn.lengthM} m, ${base.yarn.balls} gombolyag.`);
  }

  const prefix = (name: string) => (many ? `${name}: ` : '');
  // A hamis ellenőrzés mellé javaslat is jár, ha van (05 §9.6).
  const failed = plan.sizes.flatMap((entry) =>
    entry.plan.checks
      .filter((check) => !check.ok)
      .map((check) => `${prefix(entry.name)}${check.label}: hamis.${check.suggestion === undefined ? '' : ` ${check.suggestion}`}`),
  );
  const checks =
    plan.checksPassed === plan.checksTotal
      ? `Minden ellenőrzés igaz: ${plan.checksPassed}/${plan.checksTotal}${many ? `, ${plan.sizes.length} méret` : ''}.`
      : `${plan.checksPassed}/${plan.checksTotal} ellenőrzés igaz; a hamisak lent.`;

  const warnings: string[] = [];
  for (const entry of plan.sizes) {
    warnings.push(...entry.plan.warnings.map((warning) => `${prefix(entry.name)}${warning}`));
    if (entry.estimated.length > 0) warnings.push(`${entry.name}: a táblázatban nincs ${entry.estimated.join(' és ')}, ezért becsült.`);
    warnings.push(...entry.flags.map((flag) => `A táblázat gyanús adata (${entry.name}): ${flag.note}`));
  }
  for (const issue of plan.monotonic) warnings.push(`${capitalize(issue.label)} ${withArticle(issue.size)} méretnél kisebb, mint az előzőben.`);

  const series = sizingLines({ kind: plan.kind, table: plan.table, sizes: plan.sizes.map((entry) => entry.id), base: plan.base, values: plan.values }, 'hu');
  return { size, details, checks, failed, warnings, series, source: sourceText(plan, hasProfile) };
}

function hatDetails(plan: HatPlan): string[] {
  const easePct = Math.round((plan.measures.easeCm / plan.measures.headCm) * 100);
  return [
    `Fejkörfogat ${formatNumber(plan.measures.headCm, 1)} cm, bőség ${signed(plan.measures.easeCm)} cm (${easePct}%): a sapka ${cm(plan.hatCm)} cm, ${plan.stitches} szem.`,
    `Korona: ${plan.crownRounds} kör, körönként ${plan.increases} szaporítás (elméletileg ${formatNumber(plan.exactIncreases, 2)}), az utolsó körben igazítva.`,
    `Oldal: ${plan.sideRounds} kör egyenesen${plan.brimRounds > 0 ? `, ebből az utolsó ${plan.brimRounds} kör a perem` : ''}.`,
  ];
}

function raglanDetails(plan: RaglanPlan): string[] {
  const { neck, target, finished, measures } = plan;
  const lines = [
    `Nyak: ${neck.stitches} szem körbe zárva; elöl és hátul ${neck.front} szem, ujjanként ${neck.sleeve} szem.`,
    `Raglán: ${plan.yokeRounds} kör, körönként a négy raglánvonal mellett 2-2 szaporítás${
      plan.bodyRounds.length > 0 ? `, és ${plan.bodyRounds.length} körben az elején és a hátán külön szaporítás is` : ''
    }.`,
    `Szétosztás: elöl és hátul ${target.front} szem, ujjanként ${target.sleeve} szem, a hónaljlánc ${plan.underarm} szem; a törzs ${plan.bodyStitches} szem.`,
    `Törzs: ${plan.bodyRoundsBelow} kör a szétosztástól, ebből az utolsó ${plan.hemRounds} kör a szegély. Az ujjak a hónaljlánc és a kihagyott szemek mentén külön készülnek: azokat a rajz még nem tartalmazza.`,
    `Bőség: ${signed(finished.easeCm)} cm (${FIT_EASE[fitLevelOf(finished.easeCm)].name}).`,
  ];
  lines.push(`Testméret: mellbőség ${formatNumber(measures.bustCm, 1)} cm, a táblázat tartományának közepe.`);
  return lines;
}

function sweaterDetails(plan: DropShoulderPlan): string[] {
  const { panel, neck, sleeve, finished, measures } = plan;
  const lines = [
    `Hátrész és elejerész: ${panel.stitches} szem${panel.repeats !== null ? ` (${panel.repeats} ismétlés)` : ''}, ${panel.rows} sor, ebből ${panel.hemRows} sor szegély; láncalap ${panel.foundation} lsz. A karöltő az utolsó ${panel.armholeRows} sor.`,
    `Váll: szélenként ${neck.shoulder} szem; a nyak ${neck.stitches} szem.`,
    `Formázott nyak: elöl középen ${neck.front.center} szem marad, oldalanként ${neck.front.first} szem fogy az első sorban, utána ${neck.front.later} sorban 1-1; hátul középen ${neck.back.center} szem, ${neck.back.rows} sorban. Csónaknyaknál a vállvarrás hagyja nyitva a nyakat.`,
    `Ujj: ${sleeve.cuff} szemről ${sleeve.top} szemre, ${sleeve.rows} sor; ${sleeve.increases} szaporítás mindkét szélen${sleeve.first !== null ? `, az elsővel ${withArticle(`${sleeve.first}.`)} sorban` : ''}.`,
    `Bőség: ${signed(finished.easeCm)} cm (${FIT_EASE[fitLevelOf(finished.easeCm)].name})${
      finished.easeCm < DROP_SHOULDER_EASE[0] ? `; ledobott vállnál ${DROP_SHOULDER_EASE[0]}–${DROP_SHOULDER_EASE[1]} cm a szokásos, ennyivel testhezállóbb` : ''
    }.`,
  ];
  if (finished.upperArmEaseCm !== null) lines.push(`A felkaron ${signed(finished.upperArmEaseCm)} cm a bőség.`);
  if (finished.shoulderDropCm !== null && finished.shoulderDropCm > 0) lines.push(`A vállvarrás kb. ${cm(finished.shoulderDropCm)} cm-rel lóg le a karra.`);
  lines.push(`Testméret: mellbőség ${formatNumber(measures.bustCm, 1)} cm, a táblázat tartományának közepe.`);
  return lines;
}

function sourceText(plan: GarmentSeriesPlan, hasProfile: boolean): string {
  const form = plan.kind === 'hat' ? 'körben' : 'síkban';
  const stitch = stitchById(plan.stitch).terms.hu.name;
  let gauge: string;
  switch (plan.gauge.basis) {
    case 'measured':
      gauge = `${capitalize(withArticle(stitch))} ${plan.gauge.source === 'label' ? 'címkén megadott' : `${form} mért`} mintasűrűségéből.`;
      break;
    case 'profile-stitch':
      gauge = `Becslés: a profil más szemének ${form} mért mintasűrűségéből átszámolva.`;
      break;
    case 'profile-other-form':
      gauge = `Becslés: a ${plan.kind === 'hat' ? 'síkban' : 'körben'} mért mintasűrűségből átszámolva.`;
      break;
    case 'hook':
      gauge = hasProfile
        ? `Becslés a profil ${formatNumber(plan.gauge.hookMm, 2)} mm-es tűjéből, mert nincs mért mintasűrűség.`
        : `Nincs profil: a méret becslés ${formatNumber(plan.gauge.hookMm, 2)} mm-es tűből. Pontosabb, ha a Méret és fonal szakaszban profilt adsz meg.`;
      break;
  }
  return `${gauge} A hosszt mosott, blokkolt és felakasztott próbadarabból érdemes mérni, mert a horgolt anyag hosszában nő.`;
}

/** Az állapotsor üzenete a létrehozás után. */
export function generatedMessage(plan: GarmentSeriesPlan): string {
  const base = plan.sizes[plan.base]!;
  const series = plan.sizes.length > 1 ? ` (${plan.sizes.length} méretes sorozattal)` : '';
  return `${GARMENT_NAMES[plan.kind]}, ${base.name} méret${series} elkészült; visszavonással a korábbi minta visszajön.`;
}
