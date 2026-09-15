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
  /** Igazítás a következő szegélysor ismétléséhez (PQW-898). */
  readonly borderRepeat: boolean;
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
    // Szegély minden forma köré (PQW-898).
    border: true,
    hdcRowEnd: options.border !== null && options.stitch === 'hdc',
    borderRepeat: options.border !== null,
  };
}

/** A szélesség mezőjének felirata a formához. */
export function widthLabel(shape: FlatShape): string {
  if (shape === 'rectangle') return 'Szélesség, cm';
  return shape === 'diamond' ? 'Legszélesebb sor, cm' : 'Alsó él, cm';
}

/** A választás a formához igazítva: mintaismétlés most csak téglalapnál van; szegély minden formánál (PQW-898). */
export function normalizeShape(options: ShapeOptions): ShapeOptions {
  return options.shape === 'rectangle' ? options : { ...options, repeat: null };
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
    const exposed = plan.border.sides[0].exposed + plan.border.sides[1].exposed;
    const extras = [
      ...(exposed > 0 ? [`a lépcsők meghagyott szemeibe ${exposed}`] : []),
      ...(plan.border.repeat ? [`élenként ${plan.border.repeat.width} többszöröse + ${plan.border.repeat.edge}`] : []),
    ];
    details.push(
      `Szegély: ${plan.border.total} rp körben, sarkonként ${plan.border.corner}, sorvégenként ${plan.border.perRow}${extras.map((extra) => `, ${extra}`).join('')}; ` +
        `a szegéllyel ${borderApprox}${cm(plan.borderedCm.widthCm)} × ${cm(plan.borderedCm.heightCm)} cm. ` +
        'A diagramon, a rácson és a kész méretben is látszik.',
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
  /** A szegély sávjának külső körvonala SVG-sorrendben (PQW-898); szegély nélkül üres. */
  readonly frame: string;
}

const round = (value: number) => Math.round(value * 100) / 100;

type Pair = readonly [number, number];

/** Konvex burok (monoton lánc). */
function convexHull(points: readonly Pair[]): Pair[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pair, a: Pair, b: Pair) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: readonly Pair[]) => {
    const hull: Pair[] = [];
    for (const p of list) {
      while (hull.length >= 2 && cross(hull[hull.length - 2]!, hull[hull.length - 1]!, p) <= 0) hull.pop();
      hull.push(p);
    }
    hull.pop();
    return hull;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

/** A szegély sávjának külső széle: a forma konvex burka a szegély vastagságával kifelé tolva, levágott sarkokkal. */
function borderFrame(points: readonly Pair[], border: number): string {
  if (border <= 0 || points.length < 3) return '';
  const hull = convexHull(points);
  const cx = hull.reduce((sum, p) => sum + p[0], 0) / hull.length;
  const cy = hull.reduce((sum, p) => sum + p[1], 0) / hull.length;
  const pushed: Pair[] = [];
  hull.forEach((p, i) => {
    for (const [a, b] of [
      [hull[(i + hull.length - 1) % hull.length]!, p],
      [p, hull[(i + 1) % hull.length]!],
    ] as const) {
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      let [nx, ny] = [(b[1] - a[1]) / length, -(b[0] - a[0]) / length];
      if (nx * (p[0] - cx) + ny * (p[1] - cy) < 0) [nx, ny] = [-nx, -ny];
      pushed.push([p[0] + nx * border, p[1] + ny * border]);
    }
  });
  return convexHull(pushed)
    .map(([x, y]) => `${round(x)},${round(y)}`)
    .join(' ');
}

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
  const corners: Pair[] = [];
  extents.forEach((row, k) => {
    left.push(`${round(x(row.left))},${round(y(k))}`, `${round(x(row.left))},${round(y(k + 1))}`);
    right.push(`${round(x(row.right))},${round(y(k))}`, `${round(x(row.right))},${round(y(k + 1))}`);
    for (const edge of [row.left, row.right]) corners.push([x(edge), y(k)], [x(edge), y(k + 1)]);
  });
  return {
    width: round((maxRight - minLeft) * stitchCm + 2 * border),
    height: round(rows * rowCm + 2 * border),
    points: [...left, ...right.reverse()].join(' '),
    border: round(border),
    frame: borderFrame(corners, border),
  };
}

/** Az állapotsor üzenete a létrehozás után; szegéllyel a szegély is (PQW-897). */
export function generatedMessage(options: ShapeOptions, plan: ShapePlan): string {
  const done = plan.border ? 'sor és szegély' : 'sor';
  return `${SHAPE_NAMES[options.shape]}, ${plan.counts.length} ${done} elkészült; visszavonással a korábbi minta visszajön.`;
}
