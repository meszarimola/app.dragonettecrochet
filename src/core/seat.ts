// KB: interface.md §91

import { type Extent, type FreeformChart, type PlacedStitch, type SeatedCell, unseated } from './freeform.ts';
import { type Cell, GRID_CELL, type RowHeights, rowBottoms } from './grid.ts';
import { findStitch } from './stitches.ts';
import type { StitchDefId } from './types.ts';

/** A stitch's upright half size at scale 1, as drawn. */
export type NaturalSize = (placed: PlacedStitch) => Extent;

/** As many cells as the symbol has parts: a shell of five is five cells, a basic stitch one. */
export function cellSpan(stitch: StitchDefId): number {
  const def = findStitch(stitch);
  if (def?.kind === 'group') return def.members.length;
  if (def?.kind === 'joined') return def.parts;
  return 1;
}

/** An odd row (index 0, 2, …) is worked from the right, where its number stands; an even row from the left. */
export function workDirection(row: number): -1 | 1 {
  return row % 2 === 0 ? -1 : 1;
}

/**
 * The cells `count` stitches of `span` cells take, from the clicked column in
 * the row's working direction. The first is pushed back to fit inside the
 * row; the others stop at the row's end.
 */
export function spansFrom(cells: number, at: Cell, span: number, count: number): SeatedCell[] {
  if (span > cells) return [];
  const direction = workDirection(at.row);
  let col = Math.min(Math.max(direction === 1 ? at.col : at.col - span + 1, 0), cells - span);
  const spans: SeatedCell[] = [];
  for (let i = 0; i < count && col >= 0 && col + span <= cells; i += 1) {
    spans.push({ row: at.row, col, span });
    col += direction * span;
  }
  return spans;
}

/** The scale that keeps a symbol within the width of its cells; never larger than its own size. */
function fitScale(placed: PlacedStitch, cell: SeatedCell, size: NaturalSize): number {
  const width = size(placed).halfWidth * 2;
  return width > 0 ? Math.min(1, (cell.span * GRID_CELL) / width) : 1;
}

/** A row is as tall as its tallest seated stitch, and never less than a cell. */
export function rowHeights(chart: FreeformChart, size: NaturalSize): RowHeights {
  const heights = (chart.grid?.rows ?? []).map(() => GRID_CELL);
  for (const placed of chart.stitches) {
    const { cell } = placed;
    const current = cell === undefined ? undefined : heights[cell.row];
    if (cell === undefined || current === undefined) continue;
    heights[cell.row] = Math.max(current, size(placed).halfHeight * 2 * fitScale(placed, cell, size));
  }
  return heights;
}

/**
 * Lays `count` new stitches into the grid from the clicked cell; a seated
 * stitch whose cells they cover gives way. `null` where nothing fits. The new
 * stitches still have to be `seat`ed.
 */
export function placeInGrid(
  chart: FreeformChart,
  stitch: StitchDefId,
  at: Cell,
  count: number,
): { readonly chart: FreeformChart; readonly ids: ReadonlySet<number> } | null {
  const cells = chart.grid?.rows[at.row];
  if (cells === undefined) return null;
  const spans = spansFrom(cells, at, cellSpan(stitch), count);
  if (spans.length === 0) return null;
  const covered = (cell: SeatedCell | undefined): boolean =>
    cell !== undefined &&
    spans.some(({ row, col, span }) => cell.row === row && cell.col < col + span && col < cell.col + cell.span);
  const added = spans.map(
    (cell, i): PlacedStitch => ({ id: chart.nextId + i, stitch, x: 0, y: 0, rotation: 0, scale: 1, cell }),
  );
  return {
    chart: {
      ...chart,
      stitches: [...chart.stitches.filter(({ cell }) => !covered(cell)), ...added],
      nextId: chart.nextId + added.length,
    },
    ids: new Set(added.map(({ id }) => id)),
  };
}

/**
 * Puts every seated stitch where its cells say: in the middle of them, its foot
 * on the row's bottom line, upright, shrunk to their width if it is wider.
 * The chart itself comes back when nothing moved.
 */
export function seat(chart: FreeformChart, size: NaturalSize): FreeformChart {
  const grid = chart.grid;
  if (grid === undefined) return chart;
  const bottoms = rowBottoms(grid, rowHeights(chart, size));
  let moved = false;
  const stitches = chart.stitches.map((placed) => {
    const { cell } = placed;
    if (cell === undefined) return placed;
    const bottom = bottoms[cell.row];
    if (bottom === undefined) {
      moved = true;
      return unseated(placed);
    }
    const scale = fitScale(placed, cell, size);
    const x = (cell.col + cell.span / 2) * GRID_CELL;
    const y = bottom - size(placed).halfHeight * scale;
    if (placed.x === x && placed.y === y && placed.rotation === 0 && placed.scale === scale) return placed;
    moved = true;
    return { ...placed, x, y, rotation: 0, scale };
  });
  return moved ? { ...chart, stitches } : chart;
}
