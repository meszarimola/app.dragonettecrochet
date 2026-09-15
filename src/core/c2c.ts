/*
 * Sarokból sarokba (C2C, PQW-864): a színes rácsból átlós sorok csempékkel
 * (03 §5.5, §10 G33).
 *
 * - Egy rácscella egy csempe: 3 lsz és 3 erp. A kép jobb alsó sarkából indul,
 *   és a bal felsőben ér véget; W × H rács W + H − 1 átlós sor, összesen
 *   W × H csempe, a d. átlóban `min(d, W, H, W + H − d)`.
 * - Az 1. sor: 7 lsz, 3 erp a horogtól számított 5. láncszemtől, mert a
 *   fordulólánc alapláncszemen áll (PQW-891; a tudásbázis forrása alapláncszem
 *   nélkül 6 lsz-t és a 4. láncszemet írja). A láncalap a hagyomány
 *   függvényeiből jön (tradition.ts, repeat.ts).
 * - A sor kezdő oldala minden sorban vált: a páros sor a jobb élen (a
 *   magasság irányában), a páratlan az alsó élen (a szélesség irányában)
 *   kezd. A kezdő oldalon szaporítás, amíg azon az oldalon a méret nincs meg:
 *   az előző sor végén 3 lsz, fordulás, 3 lsz, 3 erp a láncszemekbe (együtt
 *   „6 lsz, 3 erp a 4. láncszemtől”). Utána fogyasztás: 3 ksz a pálcákon át.
 *   A záró oldalon az utolsó csempe elmarad, ha ott a méret megvan. A két
 *   oldal egymástól függetlenül vált (03 §5.5).
 * - A többi csempe: 1 ksz az előző sor csempéjének láncívébe, 3 lsz, 3 erp
 *   ugyanabba a láncívbe. A csempék pálcáiba nem horgolunk, ezért azok
 *   szándékosan kihagyottak.
 * - A csempe minden szeme a cella színe; az írott minta a színváltást az előző
 *   szem utolsó ráhajtásánál írja (03 §6).
 */

import { buildPieceGraph, spacePositions } from './graph.ts';
import { fail, finishGridPattern, gridPiece, GridWriter, intoSpace, intoStitch } from './grid-pattern.ts';
import { TECHNIQUE_NAMES, c2cTileRows, cellSize, colorChartProblem, type CellSize, type ChartRows } from './pixel-chart.ts';
import { foundationChainLength } from './repeat.ts';
import { shapeGauge, type ShapeGauge } from './shapes.ts';
import { libraryFor, resolveStitch } from './stitch-variants.ts';
import { firstChainFromHook, traditionOf, turningChainCountsFor } from './tradition.ts';
import type { GridUnit, NodeId, Pattern, PatternColor, Piece } from './types.ts';

export const C2C_STITCH = 'dc';
const SLIP = 'sl-st';
/** A csempe pálcái. */
export const TILE_STITCHES = 3;

/** W × H rács átlós sorai (03 §5.5). */
export const c2cRowCount = (width: number, height: number) => width + height - 1;

/** A d. átló csempéi (1-től, 03 §5.5). */
export const tilesInRow = (row: number, width: number, height: number) => Math.min(row, width, height, width + height - row);

export interface C2CTile {
  /** A cella: balról és alulról, 0-tól. */
  readonly x: number;
  readonly y: number;
  readonly color: number;
}

export type EdgeKind = 'increase' | 'decrease';

export interface C2CRow {
  readonly row: number;
  /** A csempék a haladási irányban. */
  readonly tiles: readonly C2CTile[];
  /** A kezdő oldal: új csempe, vagy kúszószemekkel át. */
  readonly start: EdgeKind;
  /** A záró oldal: az utolsó csempe megvan, vagy elmarad. */
  readonly end: EdgeKind;
}

export interface C2CPlan {
  readonly width: number;
  readonly height: number;
  readonly rows: readonly C2CRow[];
  /** A láncalap a fordulólánccal, és az első pálca a horogtól számított hányadik láncszembe megy. */
  readonly foundation: { readonly chains: number; readonly fromHook: number };
  readonly gauge: ShapeGauge;
  readonly tile: CellSize;
  readonly widthCm: number;
  readonly heightCm: number;
}

export type C2CPlanResult = { readonly ok: true; readonly plan: C2CPlan } | { readonly ok: false; readonly reason: string };
export type C2CResult = { readonly ok: true; readonly pattern: Pattern; readonly plan: C2CPlan } | { readonly ok: false; readonly reason: string };

export interface C2COptions {
  /** A kiterjesztett rács: sorok alulról, cellák balról; a cella a szín indexe. */
  readonly cells: ChartRows;
  readonly colors: readonly PatternColor[];
  readonly unit: GridUnit | null;
  readonly lettering: boolean;
}

/** A csempék soronként a rácsból (pixel-chart.ts `c2cTileRows`), a cella színével. */
export function planC2C(pattern: Pattern, cells: ChartRows, colors: readonly PatternColor[]): C2CPlanResult {
  const problem = colorChartProblem(cells, colors);
  if (problem) return fail(problem);
  const def = resolveStitch(C2C_STITCH)!;
  const tradition = traditionOf(pattern.conventions);
  if (!turningChainCountsFor(pattern.conventions.turningChainCounts, def, tradition, 'row')) {
    return fail('A C2C-csempe 3 láncszeme az első pálca helyett áll: a mintában a pálca fordulóláncának szemnek kell számítania.');
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
        chains: foundationChainLength(1 + TILE_STITCHES, def.turningChain, true, tradition),
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
  /** A csempe láncíve: ebbe horgol a következő sor csempéje. */
  readonly space: string;
  readonly stitches: readonly NodeId[];
}

function buildC2C(pattern: Pattern, plan: C2CPlan): GridWriter {
  const writer = new GridWriter();
  const tradition = traditionOf(pattern.conventions);
  const turningChain = resolveStitch(C2C_STITCH)!.turningChain;

  const first = plan.rows[0]!.tiles[0]!;
  const worked = foundationChainLength(1 + TILE_STITCHES, turningChain, true, tradition) - turningChain;
  const base = [...writer.chains(worked, first.color)].reverse();
  const firstSpace = writer.spaceOf(writer.chains(turningChain, first.color));
  // Japán hagyományban a fordulólánc egy alapláncszemen áll: az első pálca eggyel később kezd (tradition.ts).
  const offset = worked - TILE_STITCHES;
  const firstStitches = base.slice(offset).map((id) => writer.add(C2C_STITCH, [intoStitch(id)], first.color));
  let previous: BuiltTile[] = [{ space: firstSpace, stitches: firstStitches }];

  for (const row of plan.rows.slice(1)) {
    const built: BuiltTile[] = [];
    let tiles = row.tiles;
    // Szaporítás: az előző sor végén 3 lsz az új csempe színével, erre áll az új csempe.
    const extension = row.start === 'increase' ? writer.space(TILE_STITCHES, tiles[0]!.color).chains : null;
    writer.event('turn');
    if (extension) {
      const tile = tiles[0]!;
      const space = writer.spaceOf(writer.chains(turningChain, tile.color));
      const stitches = [...extension].reverse().map((id) => writer.add(C2C_STITCH, [intoStitch(id)], tile.color));
      built.push({ space, stitches });
      tiles = tiles.slice(1);
    }
    const under = [...previous].reverse();
    tiles.forEach((tile, i) => {
      const below = under[i]!;
      // Fogyasztás: kúszószemekkel át az első csempe pálcáin.
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

/** A következő sor által fel nem használt pozíciók szándékosan kihagyottak: a csempék pálcái és a fogyasztó oldal láncíve. */
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

/** Új C2C-minta a rácsból; a rácsminta a darabbal mentődik. */
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
  return finished.ok ? { ok: true, pattern: finished.pattern, plan } : finished;
}
