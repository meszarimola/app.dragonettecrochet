// KB: interface.md §91

import { type FreeformChart, type PlacedStitch, type SeatedCell, unseated } from './freeform.ts';
import { type Cell, GRID_CELL, type RowHeights, rowBottoms } from './grid.ts';
import { CHAIN, findStitch } from './stitches.ts';
import type { StitchDefId } from './types.ts';

/**
 * A symbol's ink at scale 1, upright: its width and height, and how far its
 * foot lies below the point it is drawn around — the ink need not be centred.
 */
export interface Footprint {
  readonly width: number;
  readonly height: number;
  readonly drop: number;
}

export type NaturalSize = (placed: PlacedStitch) => Footprint;

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
function fitScale({ width }: Footprint, cell: SeatedCell): number {
  return width > 0 ? Math.min(1, (cell.span * GRID_CELL) / width) : 1;
}

/** The room above a row's tallest stitch, so its top never meets the foot of the row above. KB: interface.md §91 */
export const ROW_GAP = 8;

/** A chain's middle, as a share of the row below the gap: the middle of its upper half. KB: interface.md §91 */
export const CHAIN_RISE = 0.75;

/** How far a seated chain's ink middle stands above its row's line: as `CHAIN_RISE` says, but never into the gap. */
function chainLift(rowHeight: number, inkHeight: number): number {
  const room = rowHeight - ROW_GAP;
  return Math.min(CHAIN_RISE * room, room - inkHeight / 2);
}

/** A row is as tall as its tallest seated stitch and the gap above it, and never less than a cell. */
export function rowHeights(chart: FreeformChart, size: NaturalSize): RowHeights {
  const heights = (chart.grid?.rows ?? []).map(() => GRID_CELL);
  for (const placed of chart.stitches) {
    const { cell } = placed;
    const current = cell === undefined ? undefined : heights[cell.row];
    if (cell === undefined || current === undefined) continue;
    const ink = size(placed);
    heights[cell.row] = Math.max(current, ink.height * fitScale(ink, cell) + ROW_GAP);
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
    cell !== undefined && spans.some((span) => overlap(cell, span));
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

function overlap(a: SeatedCell, b: SeatedCell): boolean {
  return a.row === b.row && a.col < b.col + b.span && b.col < a.col + a.span;
}

/**
 * The cells a stitch of `span` cells is dropped into from where it stands: the
 * row its middle is in, the columns its middle is nearest to. A point off the
 * grid goes to the nearest row and column — a stitch is never dropped off it.
 * `null` where no row is wide enough.
 */
export function nearestCells(
  grid: NonNullable<FreeformChart['grid']>,
  point: { readonly x: number; readonly y: number },
  span: number,
  heights?: RowHeights,
): SeatedCell | null {
  const bottoms = rowBottoms(grid, heights);
  const last = grid.rows.length - 1;
  let row = bottoms.findIndex((bottom, i) => point.y <= bottom && point.y >= (bottoms[i + 1] ?? -Infinity));
  if (row === -1) row = point.y > 0 ? 0 : last;
  const cells = grid.rows[row];
  if (cells === undefined || span > cells) return null;
  const col = Math.min(Math.max(Math.round(point.x / GRID_CELL - span / 2), 0), cells - span);
  return { row, col, span };
}

/**
 * Drops the given stitches into the cells nearest to where they stand; a
 * seated stitch whose cells they land on gives way, and of the dropped ones
 * landing on each other the later stays. Positions follow from `seat`.
 */
export function dropInGrid(chart: FreeformChart, ids: ReadonlySet<number>, heights?: RowHeights): FreeformChart {
  const grid = chart.grid;
  if (grid === undefined || ids.size === 0) return chart;
  const landed = new Map<number, SeatedCell>();
  const covered = new Set<number>();
  for (const placed of chart.stitches) {
    if (!ids.has(placed.id)) continue;
    const cell = nearestCells(grid, placed, cellSpan(placed.stitch), heights);
    if (cell === null) continue;
    for (const [id, other] of landed) {
      if (!overlap(cell, other)) continue;
      landed.delete(id);
      covered.add(id);
    }
    landed.set(placed.id, cell);
  }
  if (landed.size === 0) return chart;
  const taken = [...landed.values()];
  const givesWay = ({ id, cell }: PlacedStitch): boolean =>
    covered.has(id) || (!ids.has(id) && cell !== undefined && taken.some((span) => overlap(cell, span)));
  const stitches = chart.stitches
    .filter((placed) => !givesWay(placed))
    .map((placed) => {
      const cell = landed.get(placed.id);
      return cell === undefined ? placed : { ...placed, cell };
    });
  return { ...chart, stitches };
}

/**
 * Puts every seated stitch where its cells say: in the middle of them, its foot
 * on the row's bottom line — a chain in the middle of the row's upper half —
 * upright, shrunk to their width if it is wider. The chart itself comes back
 * when nothing moved. KB: interface.md §91
 */
export function seat(chart: FreeformChart, size: NaturalSize): FreeformChart {
  const grid = chart.grid;
  if (grid === undefined) return chart;
  const heights = rowHeights(chart, size);
  const bottoms = rowBottoms(grid, heights);
  let moved = false;
  const stitches = chart.stitches.map((placed) => {
    const { cell } = placed;
    if (cell === undefined) return placed;
    const bottom = bottoms[cell.row];
    if (bottom === undefined) {
      moved = true;
      return unseated(placed);
    }
    const ink = size(placed);
    const scale = fitScale(ink, cell);
    const x = (cell.col + cell.span / 2) * GRID_CELL;
    const row = heights[cell.row] ?? GRID_CELL;
    const y =
      placed.stitch === CHAIN.id
        ? bottom - chainLift(row, ink.height * scale) + (ink.height / 2 - ink.drop) * scale
        : bottom - ink.drop * scale;
    if (placed.x === x && placed.y === y && placed.rotation === 0 && placed.scale === scale) return placed;
    moved = true;
    return { ...placed, x, y, rotation: 0, scale };
  });
  return moved ? { ...chart, stitches } : chart;
}
