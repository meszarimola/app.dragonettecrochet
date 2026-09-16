/*
 * A rácsminta (PQW-864): a filé, a C2C, a tapestry, a graphgan és a mozaik
 * közös rácsa, mielőtt szemgráf lesz belőle.
 *
 * - A sorok alulról felfelé, a cellák balról jobbra állnak, a diagram
 *   (színoldal) nézetében: a 0. sor az 1. sor (03 §5.2, §5.4).
 * - Filében a cella 1 (teli), 0 (nyitott) vagy −1 (nincs cella: alakítás);
 *   színes rácsban a szín indexe a darab színlistájában.
 * - A tervező rácsában lehet meg nem adott cella (`null`). Elég az első 4–5
 *   sort teljesen megadni, utána a sor egy részét: az ismétlő egységet a
 *   program felismeri vagy megjelölteti, és kiterjeszti a teljes szélességre és
 *   magasságra (tulajdonosi pontosítás, 2026-09-15).
 * - A cella aránya a mintasűrűségből jön, nem állandó (03 §5.1, §10 G31).
 */

import { text, type CoreText } from './messages.ts';
import { estimate, scale, type Quantity } from './quantity.ts';
import type { GridTechnique, GridUnit, PatternColor, StitchDefId } from './types.ts';

export type DraftCell = number | null;
export type DraftRows = readonly (readonly DraftCell[])[];
export type ChartRows = readonly (readonly number[])[];

export const FILLED = 1;
export const OPEN = 0;
export const NO_CELL = -1;

export const GRID_TECHNIQUES: readonly GridTechnique[] = ['filet', 'c2c', 'tapestry', 'graphgan', 'mosaic'];

export const TECHNIQUE_NAMES: Readonly<Record<GridTechnique, string>> = {
  filet: 'Filé',
  c2c: 'Sarokból sarokba (C2C)',
  tapestry: 'Tapestry',
  graphgan: 'Graphgan',
  mosaic: 'Mozaik',
};

/** A technika alapszeme: a filé és a C2C pálcás, a képpontos rácsok rövidpálcásak (03 §5.2–5.6). */
export const TECHNIQUE_STITCH: Readonly<Record<GridTechnique, StitchDefId>> = {
  filet: 'dc',
  c2c: 'dc',
  tapestry: 'sc',
  graphgan: 'sc',
  mosaic: 'sc',
};

/** A rács egy oldala legfeljebb ennyi cella. */
export const MAX_GRID_SIDE = 80;
/** Tapestryben soronként legfeljebb ennyi vitt szín ajánlott; több haladó szint (03 §5.3, §10 G36). */
export const MAX_CARRIED_COLORS = 3;

/**
 * A rácsminta üzenetei kódként (PQW-904): a mag az azonosítót és az értékeket
 * adja, a mondat a felület szótárában készül (src/ui/i18n/core/grid.ts). A
 * névelő és a ragozás is ott van, itt csak sor- és cellaszám.
 */
export type ChartCode =
  | 'unit-empty-grid'
  | 'unit-not-found'
  | 'unit-incomplete'
  | 'unit-size'
  | 'unit-outside'
  | 'mirror-lettering'
  | 'mirror-asymmetric'
  | 'chart-no-rows'
  | 'chart-size'
  | 'chart-no-colors'
  | 'chart-too-many-colors'
  | 'chart-color-index';

/* ---- Méret és arány ---- */

/** Egy szem mérete sorban: szélesség és sormagasság, cm. */
export interface StitchSize {
  readonly stitchCm: number;
  readonly rowCm: number;
}

export interface CellSize {
  readonly widthCm: number;
  readonly heightCm: number;
}

/**
 * Egy cella mérete a szem méretéből.
 * - Filé: 3 pozíció széles, 1 sor magas (03 §5.2).
 * - C2C: a csempe 3 pálca széles és egy pálca magas, és átlósan fekszik,
 *   ezért a rácson a két irány átlaga; közel négyzet (03 §5.5, becslés).
 * - Tapestry, graphgan, mozaik: egy cella egy rövidpálca (03 §5.3, §5.4).
 */
export function cellSize(technique: GridTechnique, stitch: StitchSize): CellSize {
  switch (technique) {
    case 'filet':
      return { widthCm: 3 * stitch.stitchCm, heightCm: stitch.rowCm };
    case 'c2c': {
      const side = (3 * stitch.stitchCm + stitch.rowCm) / 2;
      return { widthCm: side, heightCm: side };
    }
    default:
      return { widthCm: stitch.stitchCm, heightCm: stitch.rowCm };
  }
}

/**
 * Hány sor kell, hogy a `width` cella széles motívum a valós arányában álljon:
 * `sorok = W × (sormérték / szemmérték) × (H / W)`, ahol a sormérték és a
 * szemmérték 10 cm-re jutó darabszám (03 §5.1, §10 G31).
 */
export function proportionalRows(width: number, cell: CellSize, trueWidth: number, trueHeight: number): number {
  return Math.max(1, Math.round(width * (cell.widthCm / cell.heightCm) * (trueHeight / trueWidth)));
}

/** A rács új méretre, a legközelebbi cellával: a motívum arányának javításához (03 §10 G31). */
export function resample<T>(rows: readonly (readonly T[])[], width: number, height: number): T[][] {
  const sourceHeight = rows.length;
  return Array.from({ length: height }, (_, y) => {
    const source = rows[Math.min(sourceHeight - 1, Math.floor(((y + 0.5) * sourceHeight) / height))]!;
    return Array.from({ length: width }, (_, x) => source[Math.min(source.length - 1, Math.floor(((x + 0.5) * source.length) / width))]!);
  });
}

/** Üres tervezőrács: minden cella ugyanaz, vagy meg nem adott. */
export function emptyDraft(width: number, height: number, fill: DraftCell = null): DraftCell[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
}

/* ---- Ismétlő egység ---- */

export type UnitResult = { readonly ok: true; readonly unit: GridUnit } | { readonly ok: false; readonly reason: CoreText<ChartCode> };

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** A sor ismert értéke osztályonként (x mod p); ha egy osztályban eltérés van, `null`. */
function residues(row: readonly DraftCell[], p: number): (DraftCell | undefined)[] | null {
  const known: (DraftCell | undefined)[] = Array.from({ length: p }, () => undefined);
  for (let x = 0; x < row.length; x += 1) {
    const value = row[x];
    if (value === null || value === undefined) continue;
    const r = x % p;
    if (known[r] === undefined) known[r] = value;
    else if (known[r] !== value) return null;
  }
  return known;
}

/** Legalább két teljes ismétlés látszik egymás mellett: a sor első 2p cellája megadott. */
const twoPeriods = (row: readonly DraftCell[], p: number) => row.length >= 2 * p && row.slice(0, 2 * p).every((cell) => cell !== null);

/**
 * Az ismétlő egység felismerése a megadott cellákból: a legkisebb vízszintes
 * p és függőleges q, amellyel minden megadott cella egyezik, és legalább két
 * teljes ismétlés látszik belőle. Az egység a bal alsó sarokban kezdődik.
 * Ha nincs kisebb ismétlődés, vagy az egység nem teljes, az ok.
 */
export function detectUnit(draft: DraftRows): UnitResult {
  const height = draft.length;
  const width = Math.max(0, ...draft.map((row) => row.length));
  if (width === 0 || height === 0) return { ok: false, reason: text('unit-empty-grid') };

  let p = width;
  for (let candidate = 1; candidate < width; candidate += 1) {
    if (!draft.every((row) => residues(row, candidate) !== null)) continue;
    if (!draft.some((row) => twoPeriods(row, candidate))) continue;
    p = candidate;
    break;
  }
  const rowsBy = draft.map((row) => residues(row, p)!);
  const complete = (y: number) => rowsBy[y]!.every((value) => value !== undefined);

  let q = height;
  for (let candidate = 1; candidate < height; candidate += 1) {
    const classes: (DraftCell | undefined)[][] = Array.from({ length: candidate }, () => Array.from({ length: p }, () => undefined));
    let consistent = true;
    rowsBy.forEach((known, y) => {
      known.forEach((value, r) => {
        if (value === undefined) return;
        const cls = classes[y % candidate]!;
        if (cls[r] === undefined) cls[r] = value;
        else if (cls[r] !== value) consistent = false;
      });
    });
    if (!consistent) continue;
    if (2 * candidate > height || !Array.from({ length: candidate }, (_, y) => complete(y) && complete(y + candidate)).every(Boolean)) continue;
    q = candidate;
    break;
  }

  if (p === width && q === height) return { ok: false, reason: text('unit-not-found') };
  const unit: GridUnit = { x: 0, y: 0, width: p, height: q };
  const missing = unitGaps(draft, unit);
  if (missing) return { ok: false, reason: missing };
  return { ok: true, unit };
}

/** Az egység cellái: az egységen belüli megadott cella, vagy az első megadott cella ugyanabban az osztályban. */
function unitCells(draft: DraftRows, unit: GridUnit): DraftCell[][] {
  const cells: DraftCell[][] = Array.from({ length: unit.height }, (_, j) =>
    Array.from({ length: unit.width }, (_, i) => draft[unit.y + j]?.[unit.x + i] ?? null),
  );
  draft.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value === null) return;
      const line = cells[mod(y - unit.y, unit.height)]!;
      const i = mod(x - unit.x, unit.width);
      if (line[i] === null) line[i] = value;
    });
  });
  return cells;
}

/** Mi hiányzik az egységből; `null`, ha minden cellája megadott vagy kikövetkeztethető. */
function unitGaps(draft: DraftRows, unit: GridUnit): CoreText<ChartCode> | null {
  const cells = unitCells(draft, unit);
  for (let j = 0; j < unit.height; j += 1) {
    for (let i = 0; i < unit.width; i += 1) {
      if (cells[j]![i] === null) {
        return text('unit-incomplete', { width: unit.width, height: unit.height, row: unit.y + j + 1, cell: unit.x + i + 1 });
      }
    }
  }
  return null;
}

/** A kézzel megjelölt egység hibája: a rácson kívül esik, vagy nem teljes. */
export function unitProblem(draft: DraftRows, unit: GridUnit): CoreText<ChartCode> | null {
  const height = draft.length;
  const width = Math.max(0, ...draft.map((row) => row.length));
  const whole = (n: number) => Number.isInteger(n);
  if (![unit.x, unit.y, unit.width, unit.height].every(whole) || unit.width < 1 || unit.height < 1) return text('unit-size');
  if (unit.x < 0 || unit.y < 0 || unit.x + unit.width > width || unit.y + unit.height > height) return text('unit-outside');
  return unitGaps(draft, unit);
}

/** Hány megadott cella tér el az egységtől; ezek a kiterjesztésben megmaradnak (pl. szegély). */
export function unitConflicts(draft: DraftRows, unit: GridUnit): number {
  const cells = unitCells(draft, unit);
  let count = 0;
  draft.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== null && cells[mod(y - unit.y, unit.height)]![mod(x - unit.x, unit.width)] !== value) count += 1;
    });
  });
  return count;
}

/**
 * A rács kiterjesztése `width` × `height` cellára: a megadott cellák maradnak,
 * a többi az ismétlő egységből jön. Egység nélkül minden cellának megadottnak
 * kell lennie; a hiányzót `fill` tölti ki.
 */
export function expandDraft(draft: DraftRows, unit: GridUnit | null, width: number, height: number, fill = 0): number[][] {
  const cells = unit ? unitCells(draft, unit) : null;
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      const given = draft[y]?.[x];
      if (given !== null && given !== undefined) return given;
      if (!cells || !unit) return fill;
      return cells[mod(y - unit.y, unit.height)]![mod(x - unit.x, unit.width)] ?? fill;
    }),
  );
}

/** Van-e meg nem adott cella. */
export function hasGaps(draft: DraftRows): boolean {
  return draft.some((row) => row.some((cell) => cell === null));
}

/* ---- Tükrözés ---- */

/** A rács tükörképe: balkezes horgolásnál a motívum fordítva áll (03 §2.1). */
export function mirrorRows<T>(rows: readonly (readonly T[])[]): T[][] {
  return rows.map((row) => [...row].reverse());
}

/** Tükörszimmetrikus-e a motívum a függőleges tengelyre. */
export function isMirrorSymmetric(rows: ChartRows): boolean {
  return rows.every((row) => row.every((cell, x) => cell === row[row.length - 1 - x]));
}

/** Figyelmeztetés tükrözött nézetben: a felirat fordítva olvasható, az aszimmetrikus motívum megfordul. */
export function mirrorWarning(rows: ChartRows, lettering: boolean, mirrored: boolean): CoreText<ChartCode> | null {
  if (!mirrored) return null;
  if (lettering) return text('mirror-lettering');
  if (!isMirrorSymmetric(rows)) return text('mirror-asymmetric');
  return null;
}

/* ---- Színek és fonal ---- */

/** Legfeljebb ennyi szín: az írott minta A–H betűkkel jelöli. */
export const MAX_COLORS = 8;

/** A szín betűje az írott mintában: A, B, C… */
export const colorLetter = (index: number) => String.fromCharCode(65 + index);

/** Hiba a színes rácsban: méret, színlista, színindex. */
export function colorChartProblem(cells: ChartRows, colors: readonly PatternColor[]): CoreText<ChartCode> | null {
  if (cells.length === 0) return text('chart-no-rows');
  const width = cells[0]!.length;
  if (cells.length > MAX_GRID_SIDE || width === 0 || width > MAX_GRID_SIDE || cells.some((row) => row.length !== width)) {
    return text('chart-size', { max: MAX_GRID_SIDE });
  }
  if (colors.length === 0) return text('chart-no-colors');
  if (colors.length > MAX_COLORS) return text('chart-too-many-colors', { max: MAX_COLORS });
  if (cells.some((row) => row.some((cell) => !Number.isInteger(cell) || cell < 0 || cell >= colors.length))) return text('chart-color-index');
  return null;
}

export interface TileRow {
  /** A csempék cellái a haladási irányban: balról és alulról, 0-tól. */
  readonly tiles: readonly { readonly x: number; readonly y: number }[];
  /** A kezdő oldal: új csempe, vagy kúszószemekkel át. */
  readonly start: 'increase' | 'decrease';
  /** A záró oldal: az utolsó csempe megvan, vagy elmarad. */
  readonly end: 'increase' | 'decrease';
}

/**
 * C2C: a csempék soronként (03 §5.5, §10 G33). A kép jobb alsó sarkából indul,
 * és a bal felsőben ér véget. A páros sor a jobb élen (a magasság irányában), a
 * páratlan az alsó élen (a szélesség irányában) kezd. A kezdő oldalon új
 * csempe, amíg azon az oldalon a méret nincs meg; a sor többi csempéje az
 * előző sor csempéire kerül fordított sorrendben, és a záró oldalon az utolsó
 * elmarad, ha ott a méret megvan.
 */
export function c2cTileRows(width: number, height: number): TileRow[] {
  // A `u` a jobb széltől, a `v` alulról számol.
  const inside = (u: number, v: number) => u >= 0 && v >= 0 && u < width && v < height;
  const cell = ({ u, v }: { u: number; v: number }) => ({ x: width - 1 - u, y: v });
  let previous = [{ u: 0, v: 0 }];
  const rows: TileRow[] = [{ tiles: [cell(previous[0]!)], start: 'increase', end: 'increase' }];
  for (let row = 2; row <= width + height - 1; row += 1) {
    const fromRight = row % 2 === 0;
    const fresh = fromRight ? { u: 0, v: row - 1 } : { u: row - 1, v: 0 };
    const placed: { u: number; v: number }[] = [];
    const start = inside(fresh.u, fresh.v) ? 'increase' : 'decrease';
    if (start === 'increase') placed.push(fresh);
    let end: TileRow['end'] = 'increase';
    [...previous].reverse().forEach((under, i, all) => {
      const next = fromRight ? { u: under.u + 1, v: under.v } : { u: under.u, v: under.v + 1 };
      if (inside(next.u, next.v)) placed.push(next);
      else if (i === all.length - 1) end = 'decrease';
      else throw new Error(`C2C: a(z) ${row}. sor közepén kiesne egy csempe.`);
    });
    rows.push({ tiles: placed.map(cell), start, end });
    previous = placed;
  }
  return rows;
}

export interface ColorRun {
  readonly color: number;
  readonly count: number;
}

/**
 * A színek soronként a haladási irányban, az egymás utáni azonos színek
 * összevonva: C2C-ben csempénként, tapestryben és graphganban szemenként (a
 * páratlan sor jobbról balra). Filében és mozaikban üres.
 */
export function gridColorRows(technique: GridTechnique, cells: ChartRows): ColorRun[][] {
  const runs = (colors: readonly number[]) =>
    colors.reduce<ColorRun[]>((list, color) => {
      const last = list[list.length - 1];
      if (last && last.color === color) list[list.length - 1] = { color, count: last.count + 1 };
      else list.push({ color, count: 1 });
      return list;
    }, []);
  const width = cells[0]?.length ?? 0;
  if (width === 0) return [];
  if (technique === 'c2c') return c2cTileRows(width, cells.length).map((row) => runs(row.tiles.map(({ x, y }) => cells[y]![x]!)));
  if (technique === 'tapestry' || technique === 'graphgan') return cells.map((line, y) => runs((y + 1) % 2 === 0 ? line : [...line].reverse()));
  return [];
}

/** Cellák száma színenként (filében teli és nyitott szerint); a „nincs cella” kimarad. */
export function cellCounts(rows: ChartRows): Map<number, number> {
  const counts = new Map<number, number>();
  for (const row of rows) for (const cell of row) if (cell !== NO_CELL) counts.set(cell, (counts.get(cell) ?? 0) + 1);
  return counts;
}

/** A sor színei, első előfordulásuk sorrendjében. */
export function rowColors(row: readonly number[]): number[] {
  return [...new Set(row.filter((cell) => cell !== NO_CELL))];
}

/** Azok a sorok (1-től), amelyekben tapestryben 3-nál több színt kell vinni (03 §5.3, §10 G36). */
export function overCarriedRows(rows: ChartRows): number[] {
  return rows.flatMap((row, y) => (rowColors(row).length > MAX_CARRIED_COLORS ? [y + 1] : []));
}

/**
 * A fonal színenként a teljes becslésből, a cellák arányában. Tapestryben a
 * vitt szál többletet ad, amelyet a cellaarány nem tartalmaz, ezért ott a
 * becslés alsó határ: a tartomány felfelé 25 %-kal nyílik (becslés).
 */
export function yarnByColor(rows: ChartRows, technique: GridTechnique, total: Quantity): Map<number, Quantity> {
  const counts = cellCounts(rows);
  const cells = [...counts.values()].reduce((sum, n) => sum + n, 0);
  const result = new Map<number, Quantity>();
  if (cells === 0) return result;
  for (const [color, n] of [...counts].sort((a, b) => a[0] - b[0])) {
    const share = scale(total, n / cells);
    if (technique !== 'tapestry') {
      result.set(color, share);
      continue;
    }
    const low = share.range ? share.range[0] : share.value;
    const high = (share.range ? share.range[1] : share.value) * 1.25;
    result.set(color, estimate(share.value, [low, high]));
  }
  return result;
}
