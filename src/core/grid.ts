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

/**
 * The grid stands on the board's origin: row 1 at the bottom, its foot on
 * y = 0, and every row above the one before it, left edges in line.
 */
export function gridRect(grid: RectGrid): Rect {
  return { minX: 0, minY: -grid.rows.length * GRID_CELL, maxX: Math.max(0, ...grid.rows) * GRID_CELL, maxY: 0 };
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

export function gridRows(grid: RectGrid): GridRow[] {
  return grid.rows.map((cells, i) => {
    const bottom = 0 - i * GRID_CELL;
    const right = cells * GRID_CELL;
    const number = i + 1;
    const x = number % 2 === 1 ? right + GRID_LABEL_ROOM / 2 : -GRID_LABEL_ROOM / 2;
    return { number, cells, top: bottom - GRID_CELL, bottom, right, label: { x, y: bottom - GRID_CELL / 2 } };
  });
}

/** Whether the point falls in a cell of some row; the edges count as inside. */
export function onGrid(grid: RectGrid, point: Point): boolean {
  const index = Math.ceil(-point.y / GRID_CELL) - 1;
  const row = grid.rows[point.y === 0 ? 0 : index];
  return row !== undefined && point.x >= 0 && point.x <= row * GRID_CELL;
}

/** The grid and its row numbers: what the sheet has to take in. */
export function gridExtent(grid: RectGrid): Rect {
  const rect = gridRect(grid);
  return { ...rect, minX: rect.minX - GRID_LABEL_ROOM, maxX: rect.maxX + GRID_LABEL_ROOM };
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
