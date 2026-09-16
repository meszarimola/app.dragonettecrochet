/*
 * Mozaik (PQW-894): a kétszínű rácsból rövidpálcás sorok, a kihagyott szemekbe
 * lejjebb horgolt pálcával (03 §5.6, §6, §10 G34).
 *
 * - Soronként egy szín, a két szín rácssoronként váltakozik. Az 1. rácssor az
 *   alapsor: minden cellája az A szín.
 * - Egysoros változat: egy rácssor egy horgolt sor. A sor színével egyező
 *   cella rövidpálca; ha alatta az előző sor kihagyott, egyráhajtásos pálca 2
 *   sorral lejjebb, a kihagyott szembe. A más színű cella 1 lsz és 1 szem
 *   kihagyása: ott az alatta lévő sor látszik.
 * - Kétsoros változat: egy rácssor két horgolt sor ugyanazzal a színnel; a
 *   második sor megismétli a kihagyásokat, a lejjebb horgolt szem kétráhajtásos
 *   pálca 3 sorral lejjebb.
 * - A lejjebb horgolt szem jelölt hosszú szem (`spike`): az ellenőrző csak így,
 *   csak korábban kihagyott szembe és legfeljebb 3 sorral lejjebb engedi
 *   (03 §10 C17).
 * - A sor két szélső cellája mindig a sor színe, ott nincs kihagyás. Két
 *   kihagyás nem kerülhet egymás fölé, mert a kihagyás alatt az előző sor
 *   szemének kell látszania.
 * - A láncalap és a fordulólánc a hagyomány függvényeiből jön (tradition.ts,
 *   repeat.ts, PQW-891).
 */

import { fail, finishGridPattern, gridPiece, GridWriter, intoStitch, type GridPatternCode } from './grid-pattern.ts';
import { text, type CoreText } from './messages.ts';
import { TECHNIQUE_NAMES, cellSize, colorChartProblem, type CellSize, type ChartCode, type ChartRows } from './pixel-chart.ts';
import { foundationChainLength } from './repeat.ts';
import { shapeGauge, type ShapeGauge } from './shapes.ts';
import { resolveStitch } from './stitch-variants.ts';
import { firstChainFromHook, traditionOf, turningChainCountsFor } from './tradition.ts';
import type { GridUnit, NodeId, Pattern, PatternColor } from './types.ts';

/** Hány horgolt sor egy rácssor: egysoros vagy kétsoros mozaik. */
export type MosaicRows = 1 | 2;

export const MOSAIC_STITCH = 'sc';

/** A lejjebb horgolt szem a mélység szerint: 2 sorral lejjebb egyráhajtásos, 3 sorral kétráhajtásos pálca (03 §5.6). */
export const DROP_STITCH: Readonly<Record<2 | 3, string>> = { 2: 'dc', 3: 'tr' };

export type MosaicCell = 'stitch' | 'drop' | 'skip';

export interface MosaicRow {
  /** A horgolt sor száma, 1-től. */
  readonly row: number;
  /** A rácssor, amelyhez tartozik. */
  readonly chartRow: number;
  readonly color: number;
  /** A cellák a haladási irányban. */
  readonly cells: readonly MosaicCell[];
}

export interface MosaicPlan {
  readonly variant: MosaicRows;
  readonly width: number;
  readonly rows: readonly MosaicRow[];
  /** A lejjebb horgolt szem mélysége. */
  readonly depth: 2 | 3;
  /** A láncalap a fordulólánccal, és az első szem a horogtól számított hányadik láncszembe megy. */
  readonly foundation: { readonly chains: number; readonly fromHook: number };
  readonly turningChain: number;
  readonly turningChainCounts: boolean;
  readonly gauge: ShapeGauge;
  readonly cell: CellSize;
  readonly widthCm: number;
  readonly heightCm: number;
  /** A lejjebb horgolt szemek száma. */
  readonly drops: number;
}

/** A mozaik üzenetei kódként (PQW-904); a szín szava, a névelő és a ragozás a felületé. */
export type MosaicCode = 'mosaic-two-colors' | 'mosaic-min-width' | 'mosaic-base-row' | 'mosaic-edge-colors' | 'mosaic-stacked-skip';

export type MosaicPlanResult = { readonly ok: true; readonly plan: MosaicPlan } | { readonly ok: false; readonly reason: CoreText<MosaicCode | ChartCode> };
export type MosaicResult =
  | { readonly ok: true; readonly pattern: Pattern; readonly plan: MosaicPlan }
  | { readonly ok: false; readonly reason: CoreText<MosaicCode | ChartCode | GridPatternCode> };

export interface MosaicOptions {
  /** A rács: sorok alulról, cellák balról; a cella a szín indexe (0 vagy 1). */
  readonly cells: ChartRows;
  readonly colors: readonly PatternColor[];
  readonly variant: MosaicRows;
  readonly unit: GridUnit | null;
  readonly lettering: boolean;
}

/** A rácssor színe: a páratlan sor az A, a páros a B szín. */
export const mosaicRowColor = (chartRow: number) => (chartRow - 1) % 2;

/** Mi nem horgolható mozaikként; `null`, ha a rács jó. A szín az indexével megy, a szó a szótáré. */
export function mosaicProblem(cells: ChartRows, colors: readonly PatternColor[]): CoreText<MosaicCode | ChartCode> | null {
  const problem = colorChartProblem(cells, colors);
  if (problem) return problem;
  if (colors.length !== 2) return text('mosaic-two-colors');
  const width = cells[0]!.length;
  if (width < 3) return text('mosaic-min-width');
  for (let y = 0; y < cells.length; y += 1) {
    const chartRow = y + 1;
    const own = mosaicRowColor(chartRow);
    const row = cells[y]!;
    if (chartRow === 1 && row.some((cell) => cell !== own)) return text('mosaic-base-row', { color: own });
    if (row[0] !== own || row[width - 1] !== own) return text('mosaic-edge-colors', { row: chartRow, color: own });
    if (chartRow >= 2) {
      const below = cells[y - 1]!;
      const x = row.findIndex((cell, i) => cell !== own && below[i] !== mosaicRowColor(chartRow - 1));
      if (x >= 0) return text('mosaic-stacked-skip', { row: chartRow, cell: x + 1 });
    }
  }
  return null;
}

export function planMosaic(pattern: Pattern, cells: ChartRows, colors: readonly PatternColor[], variant: MosaicRows): MosaicPlanResult {
  const problem = mosaicProblem(cells, colors);
  if (problem) return fail(problem);
  const def = resolveStitch(MOSAIC_STITCH)!;
  const tradition = traditionOf(pattern.conventions);
  const counting = turningChainCountsFor(pattern.conventions.turningChainCounts, def, tradition, 'row');
  const width = cells[0]!.length;
  const depth: 2 | 3 = variant === 1 ? 2 : 3;

  const rows: MosaicRow[] = [];
  let drops = 0;
  cells.forEach((line, y) => {
    const chartRow = y + 1;
    const own = mosaicRowColor(chartRow);
    const kinds: MosaicCell[] = line.map((cell, x) =>
      cell !== own ? 'skip' : chartRow > 1 && cells[y - 1]![x] !== mosaicRowColor(chartRow - 1) ? 'drop' : 'stitch',
    );
    for (let pass = 0; pass < variant; pass += 1) {
      // A kétsoros változat második sora a lejjebb horgolt szembe már sima rövidpálcát horgol.
      const chart = pass === 0 ? kinds : kinds.map((kind) => (kind === 'drop' ? 'stitch' : kind));
      drops += chart.filter((kind) => kind === 'drop').length;
      const row = rows.length + 1;
      // A páratlan sor jobbról balra halad (01 §8.4).
      rows.push({ row, chartRow, color: own, cells: row % 2 === 0 ? chart : [...chart].reverse() });
    }
  });

  const gauge = shapeGauge(pattern, MOSAIC_STITCH);
  const cell = cellSize('mosaic', gauge);
  return {
    ok: true,
    plan: {
      variant,
      width,
      rows,
      depth,
      foundation: {
        chains: foundationChainLength(width, def.turningChain, counting, tradition),
        fromHook: firstChainFromHook(def.turningChain, counting, tradition),
      },
      turningChain: def.turningChain,
      turningChainCounts: counting,
      gauge,
      cell,
      widthCm: width * cell.widthCm,
      heightCm: rows.length * cell.heightCm,
      drops,
    },
  };
}

function buildMosaic(pattern: Pattern, plan: MosaicPlan): GridWriter {
  const writer = new GridWriter();
  const tradition = traditionOf(pattern.conventions);
  const { turningChain, turningChainCounts: counting, width, depth } = plan;
  const worked = foundationChainLength(width, turningChain, counting, tradition) - turningChain;
  // Számító fordulóláncnál ő az első cella.
  const first = counting ? 1 : 0;
  // Soronként a pozíciók a fonal sorrendjében; a 0. a láncalap horgolt része.
  const history: NodeId[][] = [writer.chains(worked, plan.rows[0]!.color)];

  plan.rows.forEach((row, k) => {
    const working = [...history[k]!].reverse();
    const start = k === 0 ? worked - (width - first) : first;
    const under = (c: number) => working[start + c - first]!;
    const turning = writer.chains(turningChain, row.color);
    const produced: NodeId[] = counting ? [turning[turning.length - 1]!] : [];
    for (let c = first; c < width; c += 1) {
      const kind = row.cells[c]!;
      if (kind === 'skip') {
        // Az egymás melletti kihagyások egy láncívet adnak: „2 lsz, 2 szem kihagyása”.
        let end = c;
        while (end + 1 < width && row.cells[end + 1] === 'skip') end += 1;
        produced.push(...writer.space(end - c + 1, row.color).chains);
        for (let j = c; j <= end; j += 1) writer.skipped.push(under(j));
        c = end;
        continue;
      }
      if (kind === 'drop') {
        // A célpont ugyanabban az oszlopban, `depth` sorral lejjebb; páratlan mélységnél a sor iránya fordított.
        const source = history[k + 1 - depth]!;
        const target = depth % 2 === 0 ? source[c]! : source[width - 1 - c]!;
        writer.skipped.push(under(c));
        produced.push(writer.add(DROP_STITCH[depth], [intoStitch(target)], row.color, ['spike']));
        continue;
      }
      produced.push(writer.add(MOSAIC_STITCH, [intoStitch(under(c))], row.color));
    }
    writer.event(k < plan.rows.length - 1 ? 'turn' : 'fasten-off');
    history.push(produced);
  });
  return writer;
}

/** Új mozaikminta a rácsból; a rácsminta a darabbal mentődik. */
export function generateMosaic(pattern: Pattern, options: MosaicOptions): MosaicResult {
  const planned = planMosaic(pattern, options.cells, options.colors, options.variant);
  if (!planned.ok) return planned;
  const { plan } = planned;
  const base: Pattern = { ...pattern, pieces: [] };
  const writer = buildMosaic(base, plan);
  const piece = gridPiece(base, TECHNIQUE_NAMES.mosaic, writer, {
    technique: 'mosaic',
    cells: options.cells.map((row) => [...row]),
    colors: [...options.colors],
    unit: options.unit,
    lettering: options.lettering,
    mosaicRows: options.variant,
  });
  const finished = finishGridPattern(base, piece);
  return finished.ok ? { ok: true, pattern: finished.pattern, plan } : finished;
}

/**
 * Horgolható mozaikrács egy tetszőleges kétszínű rácsból (pl. betöltött kép):
 * az 1. sor és a sorok széle a sor színe, és ahol két kihagyás kerülne egymás
 * fölé, a felső a sor színét kapja.
 */
export function repairMosaic(cells: ChartRows): number[][] {
  const rows: number[][] = [];
  cells.forEach((line, y) => {
    const own = mosaicRowColor(y + 1);
    const below = rows[y - 1];
    rows.push(
      line.map((cell, x) => {
        const color = cell === 0 || cell === 1 ? cell : own;
        if (y === 0 || x === 0 || x === line.length - 1) return own;
        return color !== own && below && below[x] !== mosaicRowColor(y) ? own : color;
      }),
    );
  });
  return rows;
}
