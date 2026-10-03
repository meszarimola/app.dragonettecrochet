// KB: interface.md §89

import type { Point, Rect, Size } from './freeform.ts';
import type { View } from './view.ts';

/**
 * The rectangular design's guide grid: how many cells each row has, row 1
 * first. Every row has the same count for now; a row of its own count is what
 * increases and decreases will need.
 */
export interface RectGrid {
  readonly rows: readonly number[];
}

/** A cell's side, in board units. */
export const GRID_CELL = 40;
/** The room beside the grid that holds the row numbers. */
export const GRID_LABEL_ROOM = 40;
const HOME_PAD = 24;

export const MIN_GRID = 1;
export const MAX_GRID_STITCHES = 200;
export const MAX_GRID_ROWS = 500;
export const DEFAULT_GRID_STITCHES = 20;
export const DEFAULT_GRID_ROWS = 20;

export type GridCountCode =
  | 'grid-count-empty'
  | 'grid-count-not-whole'
  | 'grid-count-too-small'
  | 'grid-count-too-large';

export type GridCount =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly code: GridCountCode };

/** A count typed into a field: a whole number between MIN_GRID and `max`. */
export function readGridCount(text: string, max: number): GridCount {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: false, code: 'grid-count-empty' };
  if (!/^\d+$/.test(trimmed)) return { ok: false, code: 'grid-count-not-whole' };
  const value = Number(trimmed);
  if (value < MIN_GRID) return { ok: false, code: 'grid-count-too-small' };
  if (value > max) return { ok: false, code: 'grid-count-too-large' };
  return { ok: true, value };
}

export function rectGrid(stitches: number, rows: number): RectGrid {
  return { rows: Array.from({ length: rows }, () => stitches) };
}

/** Each row's height, row 1 first; without them every row is one cell. KB: interface.md §91 */
export type RowHeights = readonly number[];

/**
 * The grid stands on the board's origin: row 1 at the bottom, its foot on
 * y = 0, and every row above the one before it, left edges in line.
 */
export function gridRect(grid: RectGrid, heights?: RowHeights): Rect {
  const top = gridRows(grid, heights).at(-1)?.top ?? 0;
  return { minX: 0, minY: top, maxX: Math.max(0, ...grid.rows) * GRID_CELL, maxY: 0 };
}

export interface GridRow {
  /** Counted from 1, bottom up. */
  readonly number: number;
  readonly cells: number;
  readonly top: number;
  readonly bottom: number;
  readonly right: number;
  /** Where the row number stands: an odd row starts on the right, an even one on the left. KB: interface.md §89 */
  readonly label: Point;
}

/** With `minY` and `maxY`, only the rows that reach into that band; the others are skipped, not built. */
export function gridRows(grid: RectGrid, heights?: RowHeights, minY = -Infinity, maxY = Infinity): GridRow[] {
  const rows: GridRow[] = [];
  let bottom = 0;
  for (let i = 0; i < grid.rows.length && bottom >= minY; i += 1) {
    const top = bottom - (heights?.[i] ?? GRID_CELL);
    if (top <= maxY) {
      const cells = grid.rows[i] ?? 0;
      const right = cells * GRID_CELL;
      const number = i + 1;
      const x = number % 2 === 1 ? right + GRID_LABEL_ROOM / 2 : -GRID_LABEL_ROOM / 2;
      rows.push({ number, cells, top, bottom, right, label: { x, y: (top + bottom) / 2 } });
    }
    bottom = top;
  }
  return rows;
}

export interface Cell {
  /** Counted from 0, bottom up. */
  readonly row: number;
  /** Counted from 0, left to right. */
  readonly col: number;
}

/** The cell the point falls in; an edge belongs to the cell below it or to its left. `null` off the grid. */
export function cellAt(grid: RectGrid, point: Point, heights?: RowHeights): Cell | null {
  const row = gridRows(grid, heights, point.y, point.y)[0];
  if (row === undefined || point.x < 0 || point.x > row.right) return null;
  return { row: row.number - 1, col: Math.min(row.cells - 1, Math.floor(point.x / GRID_CELL)) };
}

/** The grid and its row numbers: what the sheet has to take in. */
export function gridExtent(grid: RectGrid, heights?: RowHeights): Rect {
  const rect = gridRect(grid, heights);
  return { ...rect, minX: rect.minX - GRID_LABEL_ROOM, maxX: rect.maxX + GRID_LABEL_ROOM };
}

/** The bottom edge of every row, row 1 first; row 1's is y = 0. */
export function rowBottoms(grid: RectGrid, heights?: RowHeights): number[] {
  return gridRows(grid, heights).map(({ bottom }) => bottom);
}

/** The view a new grid opens on: 100%, row 1 and its row numbers in the bottom left of the screen. */
export function gridHome(grid: RectGrid, screen: Size): View {
  const extent = gridExtent(grid);
  return { zoom: 1, origin: { x: extent.minX - HOME_PAD, y: extent.maxY + HOME_PAD - screen.height } };
}

/** A stored grid, or `null` for anything that is not one. */
export function gridFrom(value: unknown): RectGrid | null {
  if (typeof value !== 'object' || value === null) return null;
  const { rows } = value as Record<string, unknown>;
  if (!Array.isArray(rows) || rows.length < MIN_GRID || rows.length > MAX_GRID_ROWS) return null;
  const whole = (n: unknown): n is number =>
    typeof n === 'number' && Number.isInteger(n) && n >= MIN_GRID && n <= MAX_GRID_STITCHES;
  return rows.every(whole) ? { rows: [...rows] } : null;
}
