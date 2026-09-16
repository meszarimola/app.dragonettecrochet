/*
 * Filéhorgolás (PQW-864): a teli és nyitott cellás rácsból szemgráf, 3 szemes
 * hálóval (03 §5.2, 01 §4.4).
 *
 * - Teli cella: 3 erp; nyitott cella: 1 erp, 2 lsz, 2 kihagyás. A szomszédos
 *   cellák közös oszlopon osztoznak, ezért N cellás sor 3N + 1 pozíció
 *   (03 §10 G32).
 * - A sor első oszlopa a fordulólánc, ha a minta konvenciója szerint számít
 *   szemnek (tradition.ts); különben egy pálca az alsó sor első pozíciójába. A
 *   láncalap `foundationChainLength(3N + 1, …)`: a számító fordulólánc egy
 *   alapláncszemen áll (PQW-891), ezért teli kezdésnél 3N + 4, és az első
 *   pálca a horogtól számított 5. láncszembe megy. Nyitott kezdésnél az első
 *   cella 2 láncszeme a láncalap folytatása: 3N + 6, és az első pálca a 9.
 *   láncszembe megy. A tudásbázis CYC-forrása (03 §5.2) még alapláncszem
 *   nélkül számol: 3N + 3 és 4., illetve 3N + 5 és 8. A későbbi sorokban
 *   nyitott kezdésnél a fordulólánc után a cella 2 láncszeme jön („3 lsz,
 *   2 lsz”).
 * - A sor a haladási irányban halad: a páratlan sorok jobbról balra (01 §8.4).
 * - Alakítás egész cellánként (03 §10 F30): a sor elején szaporítás az előző
 *   sor végén 3 láncszemes hosszabbítással cellánként, a sor végén fogyasztás
 *   meghagyott cellákkal. A sor eleji fogyasztás (kúszószemekkel át) és a sor
 *   végi szaporítás még nem készül: ilyenkor érthető ok jön.
 */

import { finishGridPattern, fail, gridPiece, GridWriter, intoStitch, type GridPatternCode } from './grid-pattern.ts';
import { text, type CoreText } from './messages.ts';
import { FILLED, MAX_GRID_SIDE, NO_CELL, OPEN, TECHNIQUE_NAMES, type ChartRows } from './pixel-chart.ts';
import { foundationChainLength } from './repeat.ts';
import { shapeGauge, type ShapeGauge } from './shapes.ts';
import { resolveStitch } from './stitch-variants.ts';
import { firstChainFromHook, traditionOf, turningChainCountsFor } from './tradition.ts';
import type { GridUnit, NodeId, Pattern } from './types.ts';

/** A filé oszlopa és teli cellája. */
export const FILET_STITCH = 'dc';

/** N cellás sor pozíciószáma: a cellák közös oszlopon osztoznak (03 §5.2). */
export const filetRowPositions = (cells: number) => 3 * cells + 1;

export interface FiletRow {
  /** A sor száma, 1-től. */
  readonly row: number;
  /** A cellák a haladási irányban: 1 teli, 0 nyitott. */
  readonly cells: readonly number[];
  readonly positions: number;
  /** A sor első cellája. */
  readonly start: 'filled' | 'open';
  /** A sor elején hozzáadott cellák: az előző sor végén láncos hosszabbítás. */
  readonly added: number;
  /** A sor végén meghagyott cellák. */
  readonly left: number;
  /** A sor elején elhagyott cellák: kúszószemekkel át (PQW-894). */
  readonly removed: number;
  /** A sor végén hozzáadott nyitott cellák: 2 lsz és lejjebb horgolt háromráhajtásos pálca (PQW-894). */
  readonly extended: number;
}

export interface FiletPlan {
  readonly rows: readonly FiletRow[];
  /** A láncalap a fordulólánccal, és az 1. sor első pálcája a horogtól számított hányadik láncszembe megy. */
  readonly foundation: { readonly chains: number; readonly fromHook: number };
  readonly turningChain: number;
  readonly turningChainCounts: boolean;
  /** A legszélesebb sor cellái. */
  readonly width: number;
  readonly gauge: ShapeGauge;
  readonly widthCm: number;
  readonly heightCm: number;
}

/** A filé üzenetei kódként (PQW-904); a mondat és a sor neve a felületé. */
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

export type FiletPlanResult = { readonly ok: true; readonly plan: FiletPlan } | { readonly ok: false; readonly reason: CoreText<FiletCode> };
export type FiletResult =
  | { readonly ok: true; readonly pattern: Pattern; readonly plan: FiletPlan }
  | { readonly ok: false; readonly reason: CoreText<FiletCode | GridPatternCode> };

export interface FiletOptions {
  /** A kiterjesztett rács: sorok alulról, cellák balról; 1 teli, 0 nyitott, −1 nincs cella. */
  readonly cells: ChartRows;
  readonly unit: GridUnit | null;
  readonly lettering: boolean;
}

/** A sor terve a rácsból; a rács hibájánál az ok. */
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
    // A páratlan sor jobbról balra halad (01 §8.4).
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
      if (extended > 0) {
        // A sor végi új cella a fordulólánc alatti szembe horgolt hosszú pálcán áll (PQW-894).
        if (!counting) return fail(text('filet-extend-counting', { row }));
        if (working.slice(working.length - extended).some((cell) => cell !== OPEN)) {
          return fail(text('filet-extend-open', { row }));
        }
        // A hosszú pálca a két sorral lejjebbi sor végébe kapaszkodik; ha az előző sor eleji
        // fogyasztással kezdődött, ott nincs mibe: a sor vége beljebb került (PQW-902).
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
  // Számító fordulóláncnál a nyitott első cella 2 láncszeme a láncalap folytatása (03 §5.2).
  const merged = counting && first.start === 'open';
  const gauge = shapeGauge(pattern, FILET_STITCH);
  const widest = Math.max(...rows.map((row) => row.cells.length));
  return {
    ok: true,
    plan: {
      rows,
      foundation: {
        chains: foundationChainLength(first.positions, def.turningChain, counting, tradition) + (merged ? 2 : 0),
        fromHook: firstChainFromHook(def.turningChain, counting, tradition) + (merged ? 4 : 0),
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

/** A sorok szemgráfja a terv szerint. */
function buildFilet(pattern: Pattern, plan: FiletPlan): GridWriter {
  const writer = new GridWriter();
  const tradition = traditionOf(pattern.conventions);
  const { turningChain, turningChainCounts: counting } = plan;
  const first = plan.rows[0]!;
  const worked = foundationChainLength(first.positions, turningChain, counting, tradition) - turningChain;
  // Soronként a pozíciók a fonal sorrendjében; a 0. a láncalap horgolt része.
  const history: NodeId[][] = [writer.chains(worked)];
  let below: NodeId[] = history[0]!;

  plan.rows.forEach((row, k) => {
    const working = [...below].reverse();
    // Sor eleji fogyasztás: kúszószemek a cellák fölött; számító fordulóláncnál az oszlopba is, arra áll a fordulólánc.
    const seat = 3 * row.removed;
    for (let w = 0; w < seat + (counting && row.removed > 0 ? 1 : 0); w += 1) writer.add('sl-st', [intoStitch(working[w]!)]);
    // Az első cella kitöltő pozíciója: az 1. sorban a láncalapon a fordulólánc után.
    const start = k === 0 ? worked - 3 * row.cells.length : seat + 1;
    const turning = writer.chains(turningChain);
    const produced: NodeId[] = [counting ? turning[turning.length - 1]! : writer.add(FILET_STITCH, [intoStitch(working[seat]!)])];
    const regular = row.cells.length - row.extended;
    row.cells.forEach((cell, c) => {
      const base = start + 3 * c;
      if (c >= regular) {
        // Sor végi szaporítás: 2 lsz és háromráhajtásos pálca az előző sor fordulólánca alatti szembe (PQW-894).
        const beneath = history[k - 1]!;
        produced.push(...writer.space(2).chains);
        produced.push(writer.add('dtr', [intoStitch(beneath[beneath.length - 1]!)], 0, ['spike']));
        return;
      }
      if (cell === FILLED) {
        produced.push(writer.add(FILET_STITCH, [intoStitch(working[base]!)]), writer.add(FILET_STITCH, [intoStitch(working[base + 1]!)]));
      } else {
        produced.push(...writer.space(2).chains);
        writer.skipped.push(working[base]!, working[base + 1]!);
      }
      produced.push(writer.add(FILET_STITCH, [intoStitch(working[base + 2]!)]));
    });
    // A sor végén meghagyott cellák (03 §10 F30).
    if (row.extended === 0) writer.skipped.push(...working.slice(start + 3 * row.cells.length));
    const next = plan.rows[k + 1];
    if (next && next.added > 0) produced.push(...writer.space(3 * next.added).chains);
    writer.event(next ? 'turn' : 'fasten-off');
    history.push(produced);
    below = produced;
  });
  return writer;
}

/** Új filéminta a rácsból; a rácsminta a darabbal mentődik. */
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
