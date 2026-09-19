// KB: 01 §4.4, 01 §8.4, 03 §5.2, 03 §10 F30, 03 §10 G32
// KB: core-geometry §42

import { fail, finishGridPattern, type GridPatternCode, GridWriter, gridPiece, intoStitch } from './grid-pattern.ts';
import { type CoreText, text } from './messages.ts';
import { type ChartRows, FILLED, MAX_GRID_SIDE, NO_CELL, OPEN, TECHNIQUE_NAMES } from './pixel-chart.ts';
import { foundationChainLength } from './repeat.ts';
import { type ShapeGauge, shapeGauge } from './shapes.ts';
import { resolveStitch } from './stitch-variants.ts';
import { firstChainFromHook, traditionOf, turningChainCountsFor } from './tradition.ts';
import type { GridUnit, NodeId, Pattern } from './types.ts';

export const FILET_STITCH = 'dc';

// KB: 03 §5.2, 03 §10 G32
export const filetRowPositions = (cells: number) => 3 * cells + 1;

export interface FiletRow {
  readonly row: number;
  readonly cells: readonly number[];
  readonly positions: number;
  readonly start: 'filled' | 'open';
  // The four shaping counts are in THIS row's working direction: `added` and `removed` at the
  // row start, `left` and `extended` at the row end. KB: 03 §10 F30
  readonly added: number;
  readonly left: number;
  readonly removed: number;
  readonly extended: number;
}

export interface FiletPlan {
  readonly rows: readonly FiletRow[];
  readonly foundation: { readonly chains: number; readonly fromHook: number };
  readonly turningChain: number;
  readonly turningChainCounts: boolean;
  readonly width: number;
  readonly gauge: ShapeGauge;
  readonly widthCm: number;
  readonly heightCm: number;
}

export type FiletCode =
  | 'filet-no-rows'
  | 'filet-too-many-rows'
  | 'filet-ragged'
  | 'filet-cell-kind'
  | 'filet-empty-row'
  | 'filet-gap-row'
  | 'filet-extend-counting'
  | 'filet-extend-open'
  | 'filet-extend-reach';

export type FiletPlanResult =
  | { readonly ok: true; readonly plan: FiletPlan }
  | { readonly ok: false; readonly reason: CoreText<FiletCode> };
export type FiletResult =
  | { readonly ok: true; readonly pattern: Pattern; readonly plan: FiletPlan }
  | { readonly ok: false; readonly reason: CoreText<FiletCode | GridPatternCode> };

export interface FiletOptions {
  readonly cells: ChartRows;
  readonly unit: GridUnit | null;
  readonly lettering: boolean;
}

export function planFilet(pattern: Pattern, cells: ChartRows): FiletPlanResult {
  if (cells.length === 0) return fail(text('filet-no-rows'));
  if (cells.length > MAX_GRID_SIDE) return fail(text('filet-too-many-rows', { max: MAX_GRID_SIDE }));
  const width = cells[0]!.length;
  if (width === 0 || width > MAX_GRID_SIDE || cells.some((row) => row.length !== width)) {
    return fail(text('filet-ragged', { max: MAX_GRID_SIDE }));
  }
  if (cells.some((row) => row.some((cell) => cell !== FILLED && cell !== OPEN && cell !== NO_CELL))) {
    return fail(text('filet-cell-kind'));
  }

  const extents: { from: number; to: number }[] = [];
  for (let y = 0; y < cells.length; y += 1) {
    const xs = cells[y]!.flatMap((cell, x) => (cell === NO_CELL ? [] : [x]));
    if (xs.length === 0) return fail(text('filet-empty-row', { row: y + 1 }));
    const from = xs[0]!;
    const to = xs[xs.length - 1]!;
    if (to - from + 1 !== xs.length) return fail(text('filet-gap-row', { row: y + 1 }));
    extents.push({ from, to });
  }

  const def = resolveStitch(FILET_STITCH)!;
  const tradition = traditionOf(pattern.conventions);
  const counting = turningChainCountsFor(pattern.conventions.turningChainCounts, def, tradition, 'row');
  const rows: FiletRow[] = [];
  for (let y = 0; y < cells.length; y += 1) {
    const row = y + 1;
    const { from, to } = extents[y]!;
    // KB: 01 §8.4
    const leftToRight = row % 2 === 0;
    const line = cells[y]!.slice(from, to + 1);
    const working = leftToRight ? line : [...line].reverse();
    let added = 0;
    let left = 0;
    let removed = 0;
    let extended = 0;
    if (y > 0) {
      const previous = extents[y - 1]!;
      const startDelta = leftToRight ? previous.from - from : to - previous.to;
      const endDelta = leftToRight ? to - previous.to : previous.from - from;
      added = Math.max(0, startDelta);
      removed = Math.max(0, -startDelta);
      left = Math.max(0, -endDelta);
      extended = Math.max(0, endDelta);
      // KB: core-geometry §43
      if (extended > 0) {
        if (!counting) return fail(text('filet-extend-counting', { row }));
        if (working.slice(working.length - extended).some((cell) => cell !== OPEN)) {
          return fail(text('filet-extend-open', { row }));
        }
        if (rows[y - 1]!.removed > 0) {
          return fail(text('filet-extend-reach', { row }));
        }
      }
    }
    rows.push({
      row,
      cells: working,
      positions: filetRowPositions(working.length),
      start: working[0] === FILLED ? 'filled' : 'open',
      added,
      left,
      removed,
      extended,
    });
  }

  const first = rows[0]!;
  // KB: core-geometry §42
  const gauge = shapeGauge(pattern, FILET_STITCH);
  const widest = Math.max(...rows.map((row) => row.cells.length));
  return {
    ok: true,
    plan: {
      rows,
      foundation: {
        chains: foundationChainLength(first.positions, def.turningChain, counting, tradition),
        fromHook: firstChainFromHook(def.turningChain, counting, tradition),
      },
      turningChain: def.turningChain,
      turningChainCounts: counting,
      width: widest,
      gauge,
      widthCm: filetRowPositions(widest) * gauge.stitchCm,
      heightCm: rows.length * gauge.rowCm,
    },
  };
}

function buildFilet(pattern: Pattern, plan: FiletPlan): GridWriter {
  const writer = new GridWriter();
  const tradition = traditionOf(pattern.conventions);
  const { turningChain, turningChainCounts: counting } = plan;
  const first = plan.rows[0]!;
  const worked = foundationChainLength(first.positions, turningChain, counting, tradition) - turningChain;
  // `history[k]` holds row k's positions in yarn order; `history[0]` is the worked foundation chain.
  const history: NodeId[][] = [writer.chains(worked)];
  let below: NodeId[] = history[0]!;

  plan.rows.forEach((row, k) => {
    const working = [...below].reverse();
    const seat = 3 * row.removed;
    // KB: core-geometry §42
    for (let w = 0; w < seat; w += 1) writer.add('sl-st', [intoStitch(working[w]!)]);
    // Row 1's cells sit at the END of the worked foundation chain.
    const start = k === 0 ? worked - 3 * row.cells.length : seat + 1;
    writer.chains(turningChain);
    const produced: NodeId[] = [writer.add(FILET_STITCH, [intoStitch(working[seat]!)])];
    const regular = row.cells.length - row.extended;
    row.cells.forEach((cell, c) => {
      const base = start + 3 * c;
      if (c >= regular) return;
      if (cell === FILLED) {
        produced.push(
          writer.add(FILET_STITCH, [intoStitch(working[base]!)]),
          writer.add(FILET_STITCH, [intoStitch(working[base + 1]!)]),
        );
      } else {
        produced.push(...writer.space(2).chains);
        writer.skipped.push(working[base]!, working[base + 1]!);
      }
      produced.push(writer.add(FILET_STITCH, [intoStitch(working[base + 2]!)]));
    });
    // KB: 03 §10 F30
    if (row.extended === 0) writer.skipped.push(...working.slice(start + 3 * row.cells.length));
    // KB: core-geometry §44
    const next = plan.rows[k + 1];
    const tail = 3 * (row.extended + (next?.added ?? 0));
    if (tail > 0) produced.push(...writer.space(tail).chains);
    writer.event(next ? 'turn' : 'fasten-off');
    history.push(produced);
    below = produced;
  });
  return writer;
}

export function generateFilet(pattern: Pattern, options: FiletOptions): FiletResult {
  const planned = planFilet(pattern, options.cells);
  if (!planned.ok) return planned;
  const { plan } = planned;
  const base: Pattern = { ...pattern, pieces: [] };
  const writer = buildFilet(base, plan);
  const piece = gridPiece(base, TECHNIQUE_NAMES.filet, writer, {
    technique: 'filet',
    cells: options.cells.map((row) => [...row]),
    colors: [],
    unit: options.unit,
    lettering: options.lettering,
  });
  const finished = finishGridPattern(base, piece);
  return finished.ok ? { ok: true, pattern: finished.pattern, plan } : finished;
}
