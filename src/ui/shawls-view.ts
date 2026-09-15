/*
 * A „Kendő” szakasz tartalma (PQW-865): a választható kendők, a mezők a
 * formához, a terv kiírása a kapott szöggel, a blokkolt és a blokkolatlan
 * mérettel, a figyelmeztetések és az előnézet körvonalai.
 *
 * DOM nélküli, ezért a Node is futtatja (tests/ui-shawls-view.test.mjs), és a
 * magot `.ts` kiterjesztéssel importálja.
 */

import { article } from '../core/hungarian.ts';
import {
  DEVIATION_LIMIT,
  ROUND_SHAWLS,
  SHAWL_KINDS,
  SHAWL_NAMES,
  SYMMETRIC_SHAWLS,
  piRounds,
  type RateChoice,
  type ShawlGeometry,
  type ShawlKind,
  type ShawlOptions,
  type ShawlPlan,
  type ShawlSizes,
  type ShawlWarning,
} from '../core/shawls.ts';
import { stitchById } from '../core/stitches.ts';
import type { Choice } from './shapes-view.ts';
import { formatNumber } from './size-view.ts';

export { STITCH_CHOICES } from './shapes-view.ts';

export const KIND_CHOICES: readonly Choice<ShawlKind>[] = SHAWL_KINDS.map((value) => ({ value, label: SHAWL_NAMES[value] }));

export const RATE_CHOICES: readonly Choice<RateChoice>[] = [
  { value: 'theory', label: 'Elméleti, a mintasűrűségből' },
  { value: 'custom', label: 'Saját arány' },
];

/** Melyik mező látszik a választott kendőnél. */
export interface ShawlFieldState {
  readonly length: boolean;
  readonly rate: boolean;
  readonly custom: boolean;
  readonly wings: boolean;
}

export function shawlFieldState(options: ShawlOptions): ShawlFieldState {
  const stole = options.kind === 'stole';
  return { length: stole, rate: !stole, custom: !stole && options.rate === 'custom', wings: options.kind === 'triangle' };
}

/** A fő méret mezőjének felirata. */
export function sizeLabel(kind: ShawlKind): string {
  switch (kind) {
    case 'triangle':
    case 'crescent':
      return 'Mélység a gerincen, cm';
    case 'asymmetric-triangle':
      return 'Az egyenes él, cm';
    case 'stole':
      return 'Szélesség, cm';
    default:
      return 'Sugár, cm';
  }
}

/** A saját arány mezőjének felirata: mire vonatkozik a szám. */
export function rateLabel(kind: ShawlKind): string {
  switch (kind) {
    case 'triangle':
      return 'Szaporítás soronként, az egész sorra';
    case 'asymmetric-triangle':
      return 'Szaporítás soronként a ferde élen';
    case 'crescent':
      return 'Szaporítás soronként, élenként';
    case 'semicircle':
      return 'Szaporítás soronként';
    case 'circle':
      return 'Szaporítás körönként';
    default:
      return 'Szem az 1. körben';
  }
}

/** A szegélyhez igazítás felirata: a szimmetrikus kendőben félenként. */
export function edgingLabel(kind: ShawlKind): string {
  const what = ROUND_SHAWLS.includes(kind) ? 'Az utolsó kör' : kind === 'stole' ? 'A sor' : 'Az utolsó sor';
  return `${what} a szegély ismétléséhez: „X többszöröse + Y”${SYMMETRIC_SHAWLS.includes(kind) ? ', félenként' : ''}`;
}

/** A választás a kendőhöz igazítva: a szárnyak csak háromszögnél, a saját arány a stólánál nem számít. */
export function normalizeShawl(options: ShawlOptions): ShawlOptions {
  return {
    ...options,
    wings: options.kind === 'triangle' && options.wings,
    rate: options.kind === 'stole' ? 'theory' : options.rate,
  };
}

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase('hu') + text.slice(1);
const cm = (value: number) => formatNumber(value, 0);
const rate = (value: number) => formatNumber(value, value >= 10 ? 1 : 2);
const percent = (ratio: number) => formatNumber(ratio * 100, 0);
const angle = (value: number) => formatNumber(value, 0);

export interface ShawlView {
  /** A blokkolt és a blokkolatlan méret, a sorok száma; becslésnél „≈”. */
  readonly size: string;
  readonly details: readonly string[];
  /** Kunkorodás, fodrosodás, szög: figyelmeztetés, nem hiba. */
  readonly warnings: readonly string[];
  /** Honnan jön a szemméret, és melyik méret mért. */
  readonly source: string;
}

const dimensions = (geometry: ShawlGeometry, kind: ShawlKind) =>
  kind === 'semicircle' || ROUND_SHAWLS.includes(kind)
    ? `${cm(geometry.widthCm)} cm átmérő`
    : `${cm(geometry.widthCm)} × ${cm(geometry.depthCm)} cm`;

export function shawlView(plan: ShawlPlan, options: ShawlOptions, sizes: ShawlSizes, hasProfile: boolean): ShawlView {
  const approx = plan.gauge.source === 'estimated' ? '≈ ' : '';
  const rows = plan.counts.length;
  const noun = plan.worked === 'rounds' ? 'kör' : 'sor';
  // A nem mért állapot mindig becslés a nyúlásból.
  const [measured, other] = sizes.measured === 'blocked' ? [sizes.blocked, sizes.unblocked] : [sizes.unblocked, sizes.blocked];
  const [measuredName, otherName] = sizes.measured === 'blocked' ? ['blokkolva', 'blokkolás nélkül'] : ['blokkolás nélkül', 'blokkolva'];
  const size = `${capitalize(measuredName)} ${approx}${dimensions(measured, plan.kind)}, ${otherName} ≈ ${dimensions(other, plan.kind)}; ${rows} ${noun}.`;

  const details: string[] = [];
  const first = plan.counts[0]!;
  const last = plan.counts.at(-1)!;
  details.push(`Az 1. ${noun} ${first} szem, az utolsó ${last} szem.`);
  const symmetric = SYMMETRIC_SHAWLS.includes(plan.kind);
  switch (plan.kind) {
    case 'triangle':
      details.push(
        `Szaporítás soronként: elméletileg ${rate(plan.theoryRate)} (4 · h/w), választva ${rate(plan.chosenRate)}; ` +
          `élenként átlagosan ${rate(plan.edgeRate)}, a gerincen ${rate(2 * plan.spineRate)}, mindig párban.`,
      );
      break;
    case 'crescent':
      details.push(`Szaporítás soronként élenként: elméletileg ${rate(plan.theoryRate)} (2 · h/w), választva ${rate(plan.chosenRate)}; a gerincen nincs.`);
      break;
    case 'asymmetric-triangle':
      details.push(`Szaporítás soronként a ferde élen: 45°-hoz ${rate(plan.theoryRate)} (h/w), választva ${rate(plan.chosenRate)}.`);
      break;
    case 'semicircle':
      details.push(`Szaporítás soronként egyenletesen elosztva: elméletileg ${rate(plan.theoryRate)} (π · h/w), választva ${rate(plan.chosenRate)}.`);
      break;
    case 'circle':
      details.push(`Szaporítás körönként, eltolva: elméletileg ${rate(plan.theoryRate)} (2π · h/w), választva ${rate(plan.chosenRate)}.`);
      break;
    case 'pi':
    case 'shifted-pi': {
      const doubling = [...piRounds(plan.kind === 'shifted-pi', rows)].sort((a, b) => a - b).map((round) => `${round}.`);
      details.push(`Duplázás ${article(Number.parseInt(doubling[0]!, 10))} ${doubling.join(', ')} körben, közte sima körök.`);
      break;
    }
    case 'stole':
      details.push('Alakítás nélkül, soronként ugyanannyi szem.');
      break;
  }
  if (measured.neckAngleDeg !== null && measured.tipAngleDeg !== null) {
    details.push(`A nyakél szöge kb. ${angle(measured.neckAngleDeg)}° (egyenes nyakélnél 180°), az alsó csúcsé kb. ${angle(measured.tipAngleDeg)}°.`);
  } else if (measured.tipAngleDeg !== null) {
    details.push(`A ferde él szöge a sorhoz kb. ${angle(measured.tipAngleDeg)}°.`);
  }
  if (plan.wingsFromRow !== null) details.push(`Szárnyak: ${article(plan.wingsFromRow)} ${plan.wingsFromRow}. sortól a széleken dupla szaporítás.`);
  if (plan.ratio && plan.kind !== 'stole') {
    details.push(`${plan.worked === 'rounds' ? 'A körök' : 'A sorok'} szemszáma az ideálishoz képest ${percent(plan.ratio.min)}–${percent(plan.ratio.max)}%.`);
  }
  if (plan.edging && options.edging) {
    const { width, edge } = options.edging;
    const change = plan.edging.change === 0 ? 'változtatás nélkül' : `${plan.edging.change > 0 ? '+' : '−'}${Math.abs(plan.edging.change)} szem${symmetric ? ' félenként' : ''}`;
    details.push(`Szegélyhez: ${width} többszöröse + ${edge}${symmetric ? ' félenként' : ''}, ${plan.edging.repeats} ismétlés (${change}).`);
  }

  const warnings = plan.warnings.map(warningText);

  const stitch = stitchById(plan.stitch).terms.hu.name;
  const gauge = gaugeText(plan, stitch, hasProfile);
  const state =
    sizes.measured === 'blocked'
      ? 'A profil blokkolva mért: a blokkolás nélküli méret a megadott nyúlással becsült.'
      : 'A mintasűrűség blokkolás nélküli: a blokkolt méret a megadott nyúlással becsült. Csipkénél blokkolt próbadarabot mérj.';
  return { size, details, warnings, source: `${gauge} ${state}` };
}

function warningText(warning: ShawlWarning): string {
  const pct = percent(warning.ratio);
  const note = 'Ez figyelmeztetés, nem hiba.';
  switch (warning.kind) {
    case 'cupping':
      return `Kunkorodhat: a szemszám az ideálisnak csak kb. ${pct}%-a (${percent(DEVIATION_LIMIT)}%-nál nagyobb eltérés). ${note} Blokkolással sokszor kisimítható, vagy válassz több szaporítást.`;
    case 'ruffling':
      return `Fodrosodhat: a szemszám az ideális kb. ${pct}%-a (${percent(DEVIATION_LIMIT)}%-nál nagyobb eltérés). ${note} Válassz kevesebb szaporítást, ha lapos darabot szeretnél.`;
    case 'narrow':
      return `A választott szaporítás az elméletinek kb. ${pct}%-a: a kendő mélyebb és keskenyebb lesz, a nyakél lefelé hajlik. ${note} Sok kiadott minta blokkolással nyújtja szélesre.`;
    case 'wide':
      return `A választott szaporítás az elméletinek kb. ${pct}%-a: a kendő laposabb és szélesebb lesz, a nyakél felfelé ível, a szél fodrosodhat. ${note}`;
    case 'pi-blocking':
      return `A duplázás előtti körben a szemszám az ideálisnak csak kb. ${pct}%-a: tömör szemmel kunkorodik, ezért blokkolt csipkénél működik jól. ${note}`;
  }
}

const withArticle = (word: string) => `${/^[aáeéiíoóöőuúüű]/i.test(word) ? 'az' : 'a'} ${word}`;

function gaugeText(plan: ShawlPlan, stitch: string, hasProfile: boolean): string {
  const form = plan.worked === 'rounds' ? 'körben' : 'síkban';
  switch (plan.gauge.basis) {
    case 'measured':
      return `${capitalize(withArticle(stitch))} ${plan.gauge.source === 'label' ? 'címkén megadott' : `${form} mért`} mintasűrűségéből.`;
    case 'profile-stitch':
      return `Becslés: a profil más szemének ${form} mért mintasűrűségéből átszámolva.`;
    case 'profile-other-form':
      return `Becslés: a ${plan.worked === 'rounds' ? 'síkban' : 'körben'} mért mintasűrűségből átszámolva.`;
    case 'hook':
      return hasProfile
        ? `Becslés a profil ${formatNumber(plan.gauge.hookMm, 2)} mm-es tűjéből, mert nincs mért mintasűrűség.`
        : `Nincs profil: a méret becslés ${formatNumber(plan.gauge.hookMm, 2)} mm-es tűből. Pontosabb, ha a Méret és fonal szakaszban profilt adsz meg.`;
  }
}

export interface ShawlOutline {
  /** Az előnézet mérete cm-ben: a blokkolt és a blokkolatlan körvonal közül a nagyobb. */
  readonly width: number;
  readonly height: number;
  /** A két körvonal pontjai SVG-sorrendben, középre igazítva. */
  readonly blocked: string;
  readonly unblocked: string;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Az előnézet: a blokkolt körvonal teli, a blokkolatlan szaggatott; a kettő a felső szél közepéhez igazítva. */
export function shawlOutline(sizes: ShawlSizes): ShawlOutline {
  const width = Math.max(sizes.blocked.widthCm, sizes.unblocked.widthCm);
  const height = Math.max(sizes.blocked.depthCm, sizes.unblocked.depthCm);
  const points = (geometry: ShawlGeometry) =>
    geometry.outline.map(([x, y]) => `${round(x + (width - geometry.widthCm) / 2)},${round(y)}`).join(' ');
  return { width: round(width), height: round(height), blocked: points(sizes.blocked), unblocked: points(sizes.unblocked) };
}

/** Az állapotsor üzenete a létrehozás után. */
export function generatedMessage(plan: ShawlPlan): string {
  return `${SHAWL_NAMES[plan.kind]}, ${plan.counts.length} ${plan.worked === 'rounds' ? 'kör' : 'sor'} elkészült; visszavonással a korábbi minta visszajön.`;
}
