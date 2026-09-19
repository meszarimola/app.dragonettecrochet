// Rows run bottom-up and cells left-to-right in the right-side (chart) view: index 0 is row 1.
// KB: 03 §5.1, 03 §5.2, 03 §5.4, 03 §10 G31
// KB: core-geometry §40

import { type CoreText, text } from './messages.ts';
import { estimate, type Quantity, scale } from './quantity.ts';
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

// KB: 03 §5.2, 03 §5.3, 03 §5.4, 03 §5.5, 03 §5.6
export const TECHNIQUE_STITCH: Readonly<Record<GridTechnique, StitchDefId>> = {
  filet: 'dc',
  c2c: 'dc',
  tapestry: 'sc',
  graphgan: 'sc',
  mosaic: 'sc',
};

export const MAX_GRID_SIDE = 80;
// KB: 03 §5.3, 03 §10 G36
export const MAX_CARRIED_COLORS = 3;

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

export interface StitchSize {
  readonly stitchCm: number;
  readonly rowCm: number;
}

export interface CellSize {
  readonly widthCm: number;
  readonly heightCm: number;
}

// KB: 03 §5.2, 03 §5.3, 03 §5.4, 03 §5.5
// KB: core-geometry §41
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

// KB: 03 §5.1, 03 §10 G31
export function proportionalRows(width: number, cell: CellSize, trueWidth: number, trueHeight: number): number {
  return Math.max(1, Math.round(width * (cell.widthCm / cell.heightCm) * (trueHeight / trueWidth)));
}

// KB: 03 §10 G31
export function resample<T>(rows: readonly (readonly T[])[], width: number, height: number): T[][] {
  const sourceHeight = rows.length;
  return Array.from({ length: height }, (_, y) => {
    const source = rows[Math.min(sourceHeight - 1, Math.floor(((y + 0.5) * sourceHeight) / height))]!;
    return Array.from(
      { length: width },
      (_, x) => source[Math.min(source.length - 1, Math.floor(((x + 0.5) * source.length) / width))]!,
    );
  });
}

export function emptyDraft(width: number, height: number, fill: DraftCell = null): DraftCell[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
}

export type UnitResult =
  | { readonly ok: true; readonly unit: GridUnit }
  | { readonly ok: false; readonly reason: CoreText<ChartCode> };

const mod = (a: number, n: number) => ((a % n) + n) % n;

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

const twoPeriods = (row: readonly DraftCell[], p: number) =>
  row.length >= 2 * p && row.slice(0, 2 * p).every((cell) => cell !== null);

// KB: core-geometry §40
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
    const classes: (DraftCell | undefined)[][] = Array.from({ length: candidate }, () =>
      Array.from({ length: p }, () => undefined),
    );
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
    if (
      2 * candidate > height ||
      !Array.from({ length: candidate }, (_, y) => complete(y) && complete(y + candidate)).every(Boolean)
    )
      continue;
    q = candidate;
    break;
  }

  if (p === width && q === height) return { ok: false, reason: text('unit-not-found') };
  const unit: GridUnit = { x: 0, y: 0, width: p, height: q };
  const missing = unitGaps(draft, unit);
  if (missing) return { ok: false, reason: missing };
  return { ok: true, unit };
}

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

function unitGaps(draft: DraftRows, unit: GridUnit): CoreText<ChartCode> | null {
  const cells = unitCells(draft, unit);
  for (let j = 0; j < unit.height; j += 1) {
    for (let i = 0; i < unit.width; i += 1) {
      if (cells[j]![i] === null) {
        return text('unit-incomplete', {
          width: unit.width,
          height: unit.height,
          row: unit.y + j + 1,
          cell: unit.x + i + 1,
        });
      }
    }
  }
  return null;
}

export function unitProblem(draft: DraftRows, unit: GridUnit): CoreText<ChartCode> | null {
  const height = draft.length;
  const width = Math.max(0, ...draft.map((row) => row.length));
  const whole = (n: number) => Number.isInteger(n);
  if (![unit.x, unit.y, unit.width, unit.height].every(whole) || unit.width < 1 || unit.height < 1)
    return text('unit-size');
  if (unit.x < 0 || unit.y < 0 || unit.x + unit.width > width || unit.y + unit.height > height)
    return text('unit-outside');
  return unitGaps(draft, unit);
}

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

export function expandDraft(
  draft: DraftRows,
  unit: GridUnit | null,
  width: number,
  height: number,
  fill = 0,
): number[][] {
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

export function hasGaps(draft: DraftRows): boolean {
  return draft.some((row) => row.some((cell) => cell === null));
}

// KB: 03 §2.1
export function mirrorRows<T>(rows: readonly (readonly T[])[]): T[][] {
  return rows.map((row) => [...row].reverse());
}

export function isMirrorSymmetric(rows: ChartRows): boolean {
  return rows.every((row) => row.every((cell, x) => cell === row[row.length - 1 - x]));
}

export function mirrorWarning(rows: ChartRows, lettering: boolean, mirrored: boolean): CoreText<ChartCode> | null {
  if (!mirrored) return null;
  if (lettering) return text('mirror-lettering');
  if (!isMirrorSymmetric(rows)) return text('mirror-asymmetric');
  return null;
}

// 8 because the written pattern labels the colours A-H.
export const MAX_COLORS = 8;

export const colorLetter = (index: number) => String.fromCharCode(65 + index);

export function colorChartProblem(cells: ChartRows, colors: readonly PatternColor[]): CoreText<ChartCode> | null {
  if (cells.length === 0) return text('chart-no-rows');
  const width = cells[0]!.length;
  if (
    cells.length > MAX_GRID_SIDE ||
    width === 0 ||
    width > MAX_GRID_SIDE ||
    cells.some((row) => row.length !== width)
  ) {
    return text('chart-size', { max: MAX_GRID_SIDE });
  }
  if (colors.length === 0) return text('chart-no-colors');
  if (colors.length > MAX_COLORS) return text('chart-too-many-colors', { max: MAX_COLORS });
  if (cells.some((row) => row.some((cell) => !Number.isInteger(cell) || cell < 0 || cell >= colors.length)))
    return text('chart-color-index');
  return null;
}

export interface TileRow {
  // `x` counts from the left, `y` from the bottom, both 0-based.
  readonly tiles: readonly { readonly x: number; readonly y: number }[];
  readonly start: 'increase' | 'decrease';
  readonly end: 'increase' | 'decrease';
}

// KB: 03 §5.5, 03 §10 G33
export function c2cTileRows(width: number, height: number): TileRow[] {
  // `u` counts from the right edge, `v` from the bottom.
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

// KB: 01 §8.4
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
  if (technique === 'c2c')
    return c2cTileRows(width, cells.length).map((row) => runs(row.tiles.map(({ x, y }) => cells[y]![x]!)));
  if (technique === 'tapestry' || technique === 'graphgan')
    return cells.map((line, y) => runs((y + 1) % 2 === 0 ? line : [...line].reverse()));
  return [];
}

export function cellCounts(rows: ChartRows): Map<number, number> {
  const counts = new Map<number, number>();
  for (const row of rows) for (const cell of row) if (cell !== NO_CELL) counts.set(cell, (counts.get(cell) ?? 0) + 1);
  return counts;
}

export function rowColors(row: readonly number[]): number[] {
  return [...new Set(row.filter((cell) => cell !== NO_CELL))];
}

// KB: 03 §5.3, 03 §10 G36
export function overCarriedRows(rows: ChartRows): number[] {
  return rows.flatMap((row, y) => (rowColors(row).length > MAX_CARRIED_COLORS ? [y + 1] : []));
}

// KB: core-geometry §41
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
