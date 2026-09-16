/*
 * Tapestry és graphgan (PQW-864): a színes rácsból rövidpálcás sorok,
 * cellánként egy szem (03 §5.3, §5.4).
 *
 * - Egy cella egy rövidpálca. A sor a haladási irányban halad: a páratlan
 *   sorok jobbról balra (01 §8.4, 03 §5.4).
 * - A láncalap és a fordulólánc a hagyomány függvényeiből jön (tradition.ts,
 *   repeat.ts). Ha a fordulólánc szemnek számít, ő a sor első cellája.
 * - A szem színe a cella színe. A színváltás az előző szem utolsó
 *   ráhajtásánál történik, a sor első szeménél az előző sor utolsó szeménél
 *   (03 §6, §10 G35): ezt az írott minta írja ki.
 * - Tapestry: a nem használt színt a szemekben viszed; soronként 3-nál több
 *   szín haladó szint, erre az ellenőrző figyelmeztet (03 §5.3, §10 G36).
 *   Graphgan: színenként külön gombolyag, a hátoldalon nem viszed (03 §5.4).
 */

import { fail, finishGridPattern, gridPiece, GridWriter, intoStitch, type GridPatternCode } from './grid-pattern.ts';
import { text, type CoreText } from './messages.ts';
import { TECHNIQUE_NAMES, cellSize, colorChartProblem, type CellSize, type ChartCode, type ChartRows } from './pixel-chart.ts';
import { foundationChainLength } from './repeat.ts';
import { shapeGauge, type ShapeGauge } from './shapes.ts';
import { resolveStitch } from './stitch-variants.ts';
import { firstChainFromHook, traditionOf, turningChainCountsFor } from './tradition.ts';
import type { GridUnit, NodeId, Pattern, PatternColor } from './types.ts';

export type ColorworkTechnique = 'tapestry' | 'graphgan';

export const COLORWORK_STITCH = 'sc';

export interface ColorworkRow {
  readonly row: number;
  /** A cellák színe a haladási irányban. */
  readonly cells: readonly number[];
}

export interface ColorworkPlan {
  readonly technique: ColorworkTechnique;
  readonly width: number;
  readonly rows: readonly ColorworkRow[];
  /** A láncalap a fordulólánccal, és az első szem a horogtól számított hányadik láncszembe megy. */
  readonly foundation: { readonly chains: number; readonly fromHook: number };
  readonly turningChain: number;
  readonly turningChainCounts: boolean;
  readonly gauge: ShapeGauge;
  readonly cell: CellSize;
  readonly widthCm: number;
  readonly heightCm: number;
}

/** A tapestry és a graphgan saját üzenete (PQW-904); a mondat a felületé. */
export type ColorworkCode = 'colorwork-min-width';

export type ColorworkPlanResult =
  | { readonly ok: true; readonly plan: ColorworkPlan }
  | { readonly ok: false; readonly reason: CoreText<ColorworkCode | ChartCode> };
export type ColorworkResult =
  | { readonly ok: true; readonly pattern: Pattern; readonly plan: ColorworkPlan }
  | { readonly ok: false; readonly reason: CoreText<ColorworkCode | ChartCode | GridPatternCode> };

export interface ColorworkOptions {
  readonly technique: ColorworkTechnique;
  /** A kiterjesztett rács: sorok alulról, cellák balról; a cella a szín indexe. */
  readonly cells: ChartRows;
  readonly colors: readonly PatternColor[];
  readonly unit: GridUnit | null;
  readonly lettering: boolean;
}

export function planColorwork(pattern: Pattern, technique: ColorworkTechnique, cells: ChartRows, colors: readonly PatternColor[]): ColorworkPlanResult {
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
  const worked = foundationChainLength(width, turningChain, counting, tradition) - turningChain;
  // Számító fordulóláncnál ő az első cella: a sor többi szeme a cellák száma mínusz egy.
  const first = counting ? 1 : 0;
  let below: NodeId[] = writer.chains(worked, plan.rows[0]!.cells[0]);

  plan.rows.forEach((row, k) => {
    const working = [...below].reverse();
    // Japán hagyományban a számító fordulólánc egy alapláncszemen áll (tradition.ts); a későbbi sorokban az előző sor tetején.
    const start = k === 0 ? worked - (width - first) : first;
    const turning = writer.chains(turningChain, row.cells[0]);
    const produced: NodeId[] = counting ? [turning[turning.length - 1]!] : [];
    for (let c = first; c < width; c += 1) {
      produced.push(writer.add(COLORWORK_STITCH, [intoStitch(working[start + c - first]!)], row.cells[c]));
    }
    writer.event(k < plan.rows.length - 1 ? 'turn' : 'fasten-off');
    below = produced;
  });
  return writer;
}

/** Új tapestry- vagy graphganminta a rácsból; a rácsminta a darabbal mentődik. */
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
