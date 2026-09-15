/*
 * A „Forma” szakasz tartalma (PQW-862): a választható formák és szemek, a
 * mezők állapota a formához, a terv kiírása a tényleges mérettel és a
 * mintasűrűség eredetével, és az előnézet körvonala.
 *
 * DOM nélküli, ezért a Node is futtatja (tests/ui-shapes-view.test.mjs), és a
 * magot `.ts` kiterjesztéssel importálja.
 */

import { article } from '../core/hungarian.ts';
import {
  FLAT_SHAPES,
  SHAPE_NAMES,
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
import { formatNumber } from './size-view.ts';

export interface Choice<T extends string> {
  readonly value: T;
  readonly label: string;
}

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase('hu') + text.slice(1);

/** A határozott névelő egy szó előtt: „a félpálca”, „az egyráhajtásos pálca”. */
const withArticle = (word: string) => `${/^[aáeéiíoóöőuúüű]/i.test(word) ? 'az' : 'a'} ${word}`;

export const SHAPE_CHOICES: readonly Choice<FlatShape>[] = FLAT_SHAPES.map((value) => ({ value, label: SHAPE_NAMES[value] }));

export const STITCH_CHOICES: readonly Choice<string>[] = SHAPE_STITCHES.map((value) => ({
  value,
  label: capitalize(stitchById(value).terms.hu.name),
}));

export const MEASURE_CHOICES: readonly Choice<ShapeMeasure>[] = [
  { value: 'height', label: 'Magasság' },
  { value: 'angle', label: 'Az él szöge' },
];

export const ROUNDING_CHOICES: readonly Choice<RepeatRounding>[] = [
  { value: 'nearest', label: 'A legközelebbi többszörösre' },
  { value: 'up', label: 'Felfelé: bővebb' },
  { value: 'down', label: 'Lefelé: szűkebb' },
];

/** A félpálcás sorvégre jutó szegélyszem: a források vitatják (03 §7.1). */
export const HDC_ROW_END_CHOICES: readonly Choice<`${PieceBorder['hdcRowEnd']}`>[] = [
  { value: '2', label: '2 rp' },
  { value: '1', label: '1 rp' },
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
    border: rectangle,
    hdcRowEnd: rectangle && options.border !== null && options.stitch === 'hdc',
  };
}

/** A szélesség mezőjének felirata a formához. */
export function widthLabel(shape: FlatShape): string {
  if (shape === 'rectangle') return 'Szélesség, cm';
  return shape === 'diamond' ? 'Legszélesebb sor, cm' : 'Alsó él, cm';
}

/** A választás a formához igazítva: mintaismétlés és szegély most csak téglalapnál van. */
export function normalizeShape(options: ShapeOptions): ShapeOptions {
  return options.shape === 'rectangle' ? options : { ...options, repeat: null, border: null };
}

const cm = (value: number) => formatNumber(value, 1);

/** „a 3., 5. és 7. sor”; hatnál több sornál az első hat. */
function rowList(rows: readonly number[]): string {
  const shown = rows.slice(0, 6).map((row) => `${row}.`);
  const list = shown.length === 1 ? shown[0]! : `${shown.slice(0, -1).join(', ')} és ${shown.at(-1)!}`;
  return `${article(rows[0]!)} ${list}${rows.length > shown.length ? ' és további' : ''} sor`;
}

export interface ShapeView {
  /** A tényleges méret és a sorok száma; becslésnél „≈” előtaggal. */
  readonly size: string;
  readonly details: readonly string[];
  /** Honnan jön a szemméret; profil nélkül a becslés jelzése. */
  readonly source: string;
}

export function shapeView(plan: ShapePlan, options: ShapeOptions, hasProfile: boolean): ShapeView {
  const approx = plan.gauge.source === 'estimated' ? '≈ ' : '';
  const rows = plan.counts.length;
  const first = plan.counts[0]!;
  const last = plan.counts.at(-1)!;
  const size = `Tényleges méret: ${approx}${cm(plan.widthCm)} × ${cm(plan.heightCm)} cm, ${rows} sor.`;

  const details: string[] = [];
  if (plan.shape === 'rectangle') details.push(`Soronként ${first} szem.`);
  else if (plan.shape === 'diamond') details.push(`${first} szemről a legszélesebb sorig ${Math.max(...plan.counts)} szemre, onnan vissza ${last} szemre.`);
  else details.push(`Az alsó sor ${first} szem (${approx}${cm(plan.bottomWidthCm)} cm), a felső ${last} szem (${approx}${cm(plan.topWidthCm)} cm).`);
  if (plan.repeats !== null && options.repeat) {
    details.push(`Mintaismétlés: ${options.repeat.width} többszöröse + ${options.repeat.edge}, ${plan.repeats} ismétlés.`);
  }
  if (plan.angleDeg !== null) {
    const apex = plan.shape === 'isosceles-triangle' ? `, a csúcsszög kb. ${formatNumber(2 * plan.angleDeg, 0)}°` : '';
    details.push(`Az él szöge a függőlegestől kb. ${formatNumber(plan.angleDeg, 0)}°${apex}.`);
    details.push('A szaporítás és a fogyasztás egyenletesen elosztva, élenként soronként legfeljebb 2 egy szembe.');
  }
  if (plan.chainExtensionRows.length > 0) details.push(`Láncos hosszabbítás ${rowList(plan.chainExtensionRows)} végén.`);
  if (plan.unworkedRows.length > 0) details.push(`Meghagyott szemek ${rowList(plan.unworkedRows)} végén: lépcsős él.`);
  if (plan.border && plan.borderedCm) {
    // A szegély rövidpálcájának mérete akkor is lehet becslés, ha a darab szeme mért.
    const borderApprox = plan.borderedCm.source === 'estimated' ? '≈ ' : '';
    details.push(
      `Szegély: ${plan.border.total} rp körben, sarkonként ${plan.border.corner}, sorvégenként ${plan.border.perRow}; ` +
        `a szegéllyel ${borderApprox}${cm(plan.borderedCm.widthCm)} × ${cm(plan.borderedCm.heightCm)} cm. ` +
        'Az írott mintában áll, a diagramon még nem látszik.',
    );
  }

  const stitch = stitchById(plan.stitch).terms.hu.name;
  let source: string;
  switch (plan.gauge.basis) {
    case 'measured':
      source = `${capitalize(withArticle(stitch))} ${plan.gauge.source === 'label' ? 'címkén megadott' : 'síkban mért'} mintasűrűségéből.`;
      break;
    case 'profile-stitch':
      source = `Becslés: a profil más szemének síkban mért mintasűrűségéből átszámolva. Pontosabb, ha ${withArticle(stitch)} mintasűrűségét is megadod a Méret és fonal szakaszban.`;
      break;
    case 'profile-other-form':
      source = 'Becslés: a körben mért mintasűrűségből átszámolva. Pontosabb, ha síkban is mérsz, és a Méret és fonal szakaszban megadod.';
      break;
    case 'hook':
      source = hasProfile
        ? `Becslés a profil ${formatNumber(plan.gauge.hookMm, 2)} mm-es tűjéből, mert nincs mért mintasűrűség. Pontosabb, ha a Méret és fonal szakaszban megadod.`
        : `Nincs profil: a méret becslés ${formatNumber(plan.gauge.hookMm, 2)} mm-es tűből. Pontosabb, ha próbadarabot mérsz, és a Méret és fonal szakaszban profilként megadod.`;
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
}

const round = (value: number) => Math.round(value * 100) / 100;

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
  extents.forEach((row, k) => {
    left.push(`${round(x(row.left))},${round(y(k))}`, `${round(x(row.left))},${round(y(k + 1))}`);
    right.push(`${round(x(row.right))},${round(y(k))}`, `${round(x(row.right))},${round(y(k + 1))}`);
  });
  return {
    width: round((maxRight - minLeft) * stitchCm + 2 * border),
    height: round(rows * rowCm + 2 * border),
    points: [...left, ...right.reverse()].join(' '),
    border: round(border),
  };
}

/** Az állapotsor üzenete a létrehozás után. */
export function generatedMessage(options: ShapeOptions, plan: ShapePlan): string {
  return `${SHAPE_NAMES[options.shape]}, ${plan.counts.length} sor elkészült; visszavonással a korábbi minta visszajön.`;
}
