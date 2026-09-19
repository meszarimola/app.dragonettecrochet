// KB: 03 §5.3, §5.4, core-support §10
import { fail, finishGridPattern, type GridPatternCode, GridWriter, gridPiece, intoStitch } from './grid-pattern.ts';
import { type CoreText, text } from './messages.ts';
import {
  type CellSize,
  type ChartCode,
  type ChartRows,
  cellSize,
  colorChartProblem,
  TECHNIQUE_NAMES,
} from './pixel-chart.ts';
import { foundationChainLength } from './repeat.ts';
import { type ShapeGauge, shapeGauge } from './shapes.ts';
import { resolveStitch } from './stitch-variants.ts';
import { firstChainFromHook, skippedChains, traditionOf, turningChainCountsFor } from './tradition.ts';
import type { GridUnit, NodeId, Pattern, PatternColor } from './types.ts';

export type ColorworkTechnique = 'tapestry' | 'graphgan';

export const COLORWORK_STITCH = 'sc';

export interface ColorworkRow {
  readonly row: number;
  // Colours in the direction of travel, not left to right: odd rows are reversed.
  readonly cells: readonly number[];
}

export interface ColorworkPlan {
  readonly technique: ColorworkTechnique;
  readonly width: number;
  readonly rows: readonly ColorworkRow[];
  // `fromHook` counts chains from the hook, starting at 1.
  readonly foundation: { readonly chains: number; readonly fromHook: number };
  readonly turningChain: number;
  readonly turningChainCounts: boolean;
  readonly gauge: ShapeGauge;
  readonly cell: CellSize;
  readonly widthCm: number;
  readonly heightCm: number;
}

// KB: core-domain §2
export type ColorworkCode = 'colorwork-min-width';

export type ColorworkPlanResult =
  | { readonly ok: true; readonly plan: ColorworkPlan }
  | { readonly ok: false; readonly reason: CoreText<ColorworkCode | ChartCode> };
export type ColorworkResult =
  | { readonly ok: true; readonly pattern: Pattern; readonly plan: ColorworkPlan }
  | { readonly ok: false; readonly reason: CoreText<ColorworkCode | ChartCode | GridPatternCode> };

export interface ColorworkOptions {
  readonly technique: ColorworkTechnique;
  // Rows from the bottom, cells from the left; a cell is an index into `colors`.
  readonly cells: ChartRows;
  readonly colors: readonly PatternColor[];
  readonly unit: GridUnit | null;
  readonly lettering: boolean;
}

export function planColorwork(
  pattern: Pattern,
  technique: ColorworkTechnique,
  cells: ChartRows,
  colors: readonly PatternColor[],
): ColorworkPlanResult {
  const problem = colorChartProblem(cells, colors);
  if (problem) return fail(problem);
  const def = resolveStitch(COLORWORK_STITCH)!;
  const tradition = traditionOf(pattern.conventions);
  const counting = turningChainCountsFor(pattern.conventions.turningChainCounts, def, tradition, 'row');
  const width = cells[0]!.length;
  if (counting && width < 2) return fail(text('colorwork-min-width'));

  const gauge = shapeGauge(pattern, COLORWORK_STITCH);
  const cell = cellSize(technique, gauge);
  return {
    ok: true,
    plan: {
      technique,
      width,
      rows: cells.map((line, y) => ({ row: y + 1, cells: (y + 1) % 2 === 0 ? [...line] : [...line].reverse() })),
      foundation: {
        chains: foundationChainLength(width, def.turningChain, counting, tradition),
        fromHook: firstChainFromHook(def.turningChain, counting, tradition),
      },
      turningChain: def.turningChain,
      turningChainCounts: counting,
      gauge,
      cell,
      widthCm: width * cell.widthCm,
      heightCm: cells.length * cell.heightCm,
    },
  };
}

function buildColorwork(pattern: Pattern, plan: ColorworkPlan): GridWriter {
  const writer = new GridWriter();
  const tradition = traditionOf(pattern.conventions);
  const { turningChain, turningChainCounts: counting, width } = plan;
  // KB: core-geometry §1, §42
  const skipped = skippedChains(turningChain, counting);
  const worked = foundationChainLength(width, turningChain, counting, tradition) - skipped;
  // The turning chain is never a cell: every cell gets a real stitch.
  const first = 0;
  let below: NodeId[] = writer.chains(worked, plan.rows[0]!.cells[0]);

  plan.rows.forEach((row, k) => {
    const working = [...below].reverse();
    const start = k === 0 ? worked - (width - first) : first;
    writer.chains(k === 0 ? skipped : turningChain, row.cells[0]);
    const produced: NodeId[] = [];
    for (let c = first; c < width; c += 1) {
      produced.push(writer.add(COLORWORK_STITCH, [intoStitch(working[start + c - first]!)], row.cells[c]));
    }
    writer.event(k < plan.rows.length - 1 ? 'turn' : 'fasten-off');
    below = produced;
  });
  return writer;
}

// KB: core-domain §13
export function generateColorwork(pattern: Pattern, options: ColorworkOptions): ColorworkResult {
  const planned = planColorwork(pattern, options.technique, options.cells, options.colors);
  if (!planned.ok) return planned;
  const { plan } = planned;
  const base: Pattern = { ...pattern, pieces: [] };
  const writer = buildColorwork(base, plan);
  const piece = gridPiece(base, TECHNIQUE_NAMES[options.technique], writer, {
    technique: options.technique,
    cells: options.cells.map((row) => [...row]),
    colors: [...options.colors],
    unit: options.unit,
    lettering: options.lettering,
  });
  const finished = finishGridPattern(base, piece);
  return finished.ok ? { ok: true, pattern: finished.pattern, plan } : finished;
}
