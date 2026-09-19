// KB: 03 §5.5, 03 §6, 03 §10 G33, 03 §10 G35
// KB: core-geometry §42, §54

import { buildPieceGraph, spacePositions } from './graph.ts';
import { fail, finishGridPattern, gridPiece, GridWriter, intoSpace, intoStitch, type GridPatternCode } from './grid-pattern.ts';
import { text, type CoreText } from './messages.ts';
import { TECHNIQUE_NAMES, c2cTileRows, cellSize, colorChartProblem, type CellSize, type ChartCode, type ChartRows } from './pixel-chart.ts';
import { foundationChainLength } from './repeat.ts';
import { shapeGauge, type ShapeGauge } from './shapes.ts';
import { libraryFor, resolveStitch } from './stitch-variants.ts';
import { firstChainFromHook, skippedChains, traditionOf, turningChainCountsFor } from './tradition.ts';
import type { GridUnit, NodeId, Pattern, PatternColor, Piece } from './types.ts';

export const C2C_STITCH = 'dc';
const SLIP = 'sl-st';
export const TILE_STITCHES = 3;

// KB: 03 §5.5, 03 §10 G33
export const c2cRowCount = (width: number, height: number) => width + height - 1;

export const tilesInRow = (row: number, width: number, height: number) => Math.min(row, width, height, width + height - row);

export interface C2CTile {
  // `x` counts from the left, `y` from the bottom, both 0-based.
  readonly x: number;
  readonly y: number;
  readonly color: number;
}

export type EdgeKind = 'increase' | 'decrease';

export interface C2CRow {
  readonly row: number;
  readonly tiles: readonly C2CTile[];
  readonly start: EdgeKind;
  readonly end: EdgeKind;
}

export interface C2CPlan {
  readonly width: number;
  readonly height: number;
  readonly rows: readonly C2CRow[];
  readonly foundation: { readonly chains: number; readonly fromHook: number };
  readonly gauge: ShapeGauge;
  readonly tile: CellSize;
  readonly widthCm: number;
  readonly heightCm: number;
}

export type C2CCode = 'c2c-turning-chain' | 'c2c-repeated-increase';

export type C2CPlanResult = { readonly ok: true; readonly plan: C2CPlan } | { readonly ok: false; readonly reason: CoreText<C2CCode | ChartCode> };
export type C2CResult =
  | { readonly ok: true; readonly pattern: Pattern; readonly plan: C2CPlan }
  | { readonly ok: false; readonly reason: CoreText<C2CCode | ChartCode | GridPatternCode> };

export interface C2COptions {
  readonly cells: ChartRows;
  readonly colors: readonly PatternColor[];
  readonly unit: GridUnit | null;
  readonly lettering: boolean;
}

export function planC2C(pattern: Pattern, cells: ChartRows, colors: readonly PatternColor[]): C2CPlanResult {
  const problem = colorChartProblem(cells, colors);
  if (problem) return fail(problem);
  const def = resolveStitch(C2C_STITCH)!;
  const tradition = traditionOf(pattern.conventions);
  if (!turningChainCountsFor(pattern.conventions.turningChainCounts, def, tradition, 'row')) {
    return fail(text('c2c-turning-chain'));
  }

  const height = cells.length;
  const width = cells[0]!.length;
  const rows: C2CRow[] = c2cTileRows(width, height).map((tileRow, i) => ({
    row: i + 1,
    tiles: tileRow.tiles.map(({ x, y }) => ({ x, y, color: cells[y]![x]! })),
    start: tileRow.start,
    end: tileRow.end,
  }));

  const gauge = shapeGauge(pattern, C2C_STITCH);
  const size = cellSize('c2c', gauge);
  return {
    ok: true,
    plan: {
      width,
      height,
      rows,
      foundation: {
        chains: foundationChainLength(TILE_STITCHES, def.turningChain, true, tradition),
        fromHook: firstChainFromHook(def.turningChain, true, tradition),
      },
      gauge,
      tile: size,
      widthCm: width * size.widthCm,
      heightCm: height * size.heightCm,
    },
  };
}

interface BuiltTile {
  // The tile's chain space; the next diagonal row's tile is worked into it.
  readonly space: string;
  readonly stitches: readonly NodeId[];
}

function buildC2C(pattern: Pattern, plan: C2CPlan): GridWriter {
  const writer = new GridWriter();
  const tradition = traditionOf(pattern.conventions);
  const turningChain = resolveStitch(C2C_STITCH)!.turningChain;

  const first = plan.rows[0]!.tiles[0]!;
  // KB: core-geometry §42
  const worked = foundationChainLength(TILE_STITCHES, turningChain, true, tradition) - skippedChains(turningChain, true);
  const base = [...writer.chains(worked, first.color)].reverse();
  const firstSpace = writer.spaceOf(writer.chains(turningChain, first.color));
  // The first tile sits at the END of the worked foundation chain.
  const offset = worked - TILE_STITCHES;
  const firstStitches = base.slice(offset).map((id) => writer.add(C2C_STITCH, [intoStitch(id)], first.color));
  let previous: BuiltTile[] = [{ space: firstSpace, stitches: firstStitches }];

  for (const row of plan.rows.slice(1)) {
    const built: BuiltTile[] = [];
    let tiles = row.tiles;
    writer.event('turn');
    if (row.start === 'increase') {
      // KB: core-geometry §45
      const tile = tiles[0]!;
      const base = [...writer.chains(TILE_STITCHES, tile.color)].reverse();
      const space = writer.spaceOf(writer.chains(turningChain, tile.color));
      const stitches = base.map((id) => writer.add(C2C_STITCH, [intoStitch(id)], tile.color));
      built.push({ space, stitches });
      tiles = tiles.slice(1);
    }
    const under = [...previous].reverse();
    tiles.forEach((tile, i) => {
      const below = under[i]!;
      if (i === 0 && row.start === 'decrease') {
        for (const id of [...below.stitches].reverse()) writer.add(SLIP, [intoStitch(id)], tile.color);
      }
      writer.add(SLIP, [intoSpace(below.space)], tile.color);
      const space = writer.space(TILE_STITCHES, tile.color).id;
      const stitches = Array.from({ length: TILE_STITCHES }, () => writer.add(C2C_STITCH, [intoSpace(below.space)], tile.color));
      built.push({ space, stitches });
    });
    previous = built;
  }
  writer.event('fasten-off');
  markUnused(pattern, writer);
  return writer;
}

// KB: 03 §10 B8
function markUnused(pattern: Pattern, writer: GridWriter): void {
  const piece: Piece = {
    id: 'p1',
    name: '',
    stitches: writer.stitches,
    spaces: writer.spaces,
    rings: [],
    groups: [],
    events: writer.events,
    skipped: [],
  };
  const whole = { ...pattern, pieces: [piece] };
  const graph = buildPieceGraph(whole, piece, libraryFor(whole));
  const used = new Set<NodeId>();
  for (const node of piece.stitches) {
    for (const anchor of node.anchors) {
      if (anchor.into === 'stitch') used.add(anchor.id);
      if (anchor.into !== 'space') continue;
      const below = graph.layers[graph.layerOf.get(node.id)! - 1]!;
      for (const id of spacePositions(below, graph.spaces.get(anchor.id)!)) used.add(id);
    }
  }
  writer.skipped.push(...graph.layers.slice(1, -1).flatMap((layer) => layer.positions.filter((id) => !used.has(id))));
}

export function generateC2C(pattern: Pattern, options: C2COptions): C2CResult {
  const planned = planC2C(pattern, options.cells, options.colors);
  if (!planned.ok) return planned;
  const { plan } = planned;
  const base: Pattern = { ...pattern, pieces: [] };
  const writer = buildC2C(base, plan);
  const piece = gridPiece(base, TECHNIQUE_NAMES.c2c, writer, {
    technique: 'c2c',
    cells: options.cells.map((row) => [...row]),
    colors: [...options.colors],
    unit: options.unit,
    lettering: options.lettering,
  });
  const finished = finishGridPattern(base, piece);
  if (finished.ok) return { ok: true, pattern: finished.pattern, plan };
  // KB: core-geometry §46
  const rule = finished.reason.data?.['rule'];
  if (rule === 'foundation-chain' || rule === 'anchor-layer') return fail(text('c2c-repeated-increase'));
  return finished;
}
