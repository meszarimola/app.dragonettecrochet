// KB: 05 §4, core-support §8
import type { RowShaping, ShapeRepeat } from './shapes.ts';

export type RoundingIntent = 'up' | 'down' | 'nearest';

const EPSILON = 1e-9;

function roundBy(x: number, intent: RoundingIntent): number {
  if (intent === 'up') return Math.ceil(x - EPSILON);
  if (intent === 'down') return Math.floor(x + EPSILON);
  return Math.floor(x + 0.5);
}

// KB: 05 §4.2
export function intentOf(easeCm: number): RoundingIntent {
  return easeCm < 0 ? 'down' : 'up';
}

export function roundStitches(exact: number, intent: RoundingIntent): number {
  return roundBy(exact, intent);
}

// KB: 05 §4.7
export function roundToRepeat(exact: number, repeat: ShapeRepeat, intent: RoundingIntent): number {
  const k = roundBy((exact - repeat.edge) / repeat.width, intent);
  return Math.max(1, k) * repeat.width + repeat.edge;
}

// KB: 05 §4.2
export function roundEven(x: number, intent: RoundingIntent = 'nearest'): number {
  return 2 * roundBy(x / 2, intent);
}

// A shaping event falls on the LAST row of its interval, and shorter intervals
// come first.
// KB: 05 §4.4
export interface SlopeSchedule {
  readonly intervals: readonly number[];
  readonly tail: number;
  readonly every: number;
  readonly remainder: number;
}

// `null` when fewer than one row would fall in an interval.
export function slopeSchedule(rows: number, events: number, straightTail: boolean): SlopeSchedule | null {
  if (events <= 0) return { intervals: [], tail: rows, every: 0, remainder: 0 };
  const parts = straightTail ? events + 1 : events;
  const every = Math.floor(rows / parts);
  const remainder = rows - every * parts;
  if (every < 1) return null;
  const all = [...Array<number>(parts - remainder).fill(every), ...Array<number>(remainder).fill(every + 1)];
  return straightTail
    ? { intervals: all.slice(0, -1), tail: all.at(-1)!, every, remainder }
    : { intervals: all, tail: 0, every, remainder };
}

// Row numbers are 1-based, counted downwards from the top of the section.
export function eventRows(schedule: SlopeSchedule): number[] {
  const rows: number[] = [];
  let at = 0;
  for (const interval of schedule.intervals) {
    at += interval;
    rows.push(at);
  }
  return rows;
}

// The same schedule for a piece worked from the other end. `null` when a shaping
// event would land on row 1.
// KB: core-support §8
export function reversedEventRows(schedule: SlopeSchedule, rows: number): number[] | null {
  const down = eventRows(schedule);
  if (down.some((row) => row < 2)) return null;
  return down.map((row) => rows + 2 - row).sort((a, b) => a - b);
}

export interface ShapingRun {
  readonly every: number;
  readonly times: number;
}

// `first` is an absolute row number; the runs that follow it are gaps between rows.
export function shapingRuns(rows: readonly number[]): { readonly first: number | null; readonly runs: readonly ShapingRun[] } {
  if (rows.length === 0) return { first: null, runs: [] };
  const runs: ShapingRun[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const every = rows[i]! - rows[i - 1]!;
    const last = runs.at(-1);
    if (last && last.every === every) runs[runs.length - 1] = { every, times: last.times + 1 };
    else runs.push({ every, times: 1 });
  }
  return { first: rows[0]!, runs };
}

// Positions are 0-based.
// KB: 05 §4.3
export function evenPositions(p: number, m: number): number[] {
  return Array.from({ length: m }, (_, j) => Math.floor(((j + 0.5) * p) / m));
}

export function evenIncreases(p: number, m: number): number[] | null {
  if (m < 0 || m > p) return null;
  const into = Array<number>(p).fill(1);
  for (const position of evenPositions(p, m)) into[position]! += 1;
  return into;
}

// KB: 05 §4.5, §9.3
export function mirrorShaping(shaping: readonly RowShaping[]): RowShaping[] {
  return shaping.map((row) => ({ start: row.end, end: row.start }));
}
