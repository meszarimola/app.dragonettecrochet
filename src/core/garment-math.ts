/*
 * A szabásrajz számolásának alapjai (PQW-866, 05 §4, §9.2, §9.3):
 *
 * - A vízszintes méret szemszáma a mintaismétlésre (`k·X + Y`) kerekítve, a
 *   kívánt bőség irányába: bő darabnál felfelé, testhezállónál lefelé (05 §4.2,
 *   §4.7).
 * - A függőleges szakasz sorszáma páros, hogy az alakítás mindig ugyanazon az
 *   oldalon kezdődjön (05 §4.2).
 * - A lejtő elosztása a „mágikus képlettel” (05 §4.4): `R ÷ E = B maradék C`,
 *   azaz `(E − C)` alkalommal `B`, `C` alkalommal `B + 1` soronként. Az
 *   egyenes véggel (Knitting & Crochet Guild) a sorokat `E + 1` részre
 *   osztjuk, és az utolsó rész egyenes.
 * - Bal és jobb darab: a sor eleje és vége felcserélődik (05 §4.5, §9.3).
 */

import type { RowShaping, ShapeRepeat } from './shapes.ts';

export type RoundingIntent = 'up' | 'down' | 'nearest';

const EPSILON = 1e-9;

function roundBy(x: number, intent: RoundingIntent): number {
  if (intent === 'up') return Math.ceil(x - EPSILON);
  if (intent === 'down') return Math.floor(x + EPSILON);
  return Math.floor(x + 0.5);
}

/** A bőség iránya: pozitív bőségnél felfelé, negatívnál lefelé kerekítünk (05 §4.2). */
export function intentOf(easeCm: number): RoundingIntent {
  return easeCm < 0 ? 'down' : 'up';
}

/** Egész szemszám a kívánt irányba. */
export function roundStitches(exact: number, intent: RoundingIntent): number {
  return roundBy(exact, intent);
}

/** A `k·X + Y` szemszám a kívánt irányba, legalább egy ismétléssel (05 §4.7). */
export function roundToRepeat(exact: number, repeat: ShapeRepeat, intent: RoundingIntent): number {
  const k = roundBy((exact - repeat.edge) / repeat.width, intent);
  return Math.max(1, k) * repeat.width + repeat.edge;
}

/** Páros szám a kívánt irányba; `nearest`-nél a döntetlen felfelé (05 §4.2). */
export function roundEven(x: number, intent: RoundingIntent = 'nearest'): number {
  return 2 * roundBy(x / 2, intent);
}

export interface SlopeSchedule {
  /** A változások közti szakaszok hossza sorban, a változás a szakasz utolsó sorában; a rövidebbek előbb. */
  readonly intervals: readonly number[];
  /** Egyenes sorok a végén: az egyenes végű változatnál az utolsó szakasz, különben 0. */
  readonly tail: number;
  /** `B`: a rövidebb szakasz. */
  readonly every: number;
  /** `C`: a `B + 1` hosszú szakaszok száma. */
  readonly remainder: number;
}

/**
 * `events` változás `rows` sorban (05 §4.4). `straightTail`: a sorok `E + 1`
 * részre oszlanak, az utolsó rész egyenes (KCG). `null`, ha egy szakaszra
 * kevesebb mint egy sor jutna.
 */
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

/** A változások sorai fentről lefelé haladva, 1-től: a szakaszok végei. */
export function eventRows(schedule: SlopeSchedule): number[] {
  const rows: number[] = [];
  let at = 0;
  for (const interval of schedule.intervals) {
    at += interval;
    rows.push(at);
  }
  return rows;
}

/**
 * A fentről lefelé tervezett változások sorai a másik irányból horgolva (pl.
 * az ujj a mandzsettától): a fentről `d`. sor szűkítése alulról a `rows + 2 − d`.
 * sor szaporítása, növekvő sorrendben. `null`, ha egy változás az 1. sorra esne.
 */
export function reversedEventRows(schedule: SlopeSchedule, rows: number): number[] | null {
  const down = eventRows(schedule);
  if (down.some((row) => row < 2)) return null;
  return down.map((row) => rows + 2 - row).sort((a, b) => a - b);
}

/** Egymás utáni azonos közök: „3. soronként 5 alkalommal”. */
export interface ShapingRun {
  readonly every: number;
  readonly times: number;
}

/**
 * A változások leírása az első változás sora után: az egymás utáni azonos
 * közök csoportjai. Az első változás külön áll (`first`).
 */
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

/** `m` változás `p` szem között egyenletesen, középre igazítva (05 §4.3): a `j`. a `floor((j + 0,5) · p / m)`. pozíción. */
export function evenPositions(p: number, m: number): number[] {
  return Array.from({ length: m }, (_, j) => Math.floor(((j + 0.5) * p) / m));
}

/** Szemenként hány szem megy az előző kör `p` pozíciójába, ha `m` szaporítás van (legfeljebb duplázás). */
export function evenIncreases(p: number, m: number): number[] | null {
  if (m < 0 || m > p) return null;
  const into = Array<number>(p).fill(1);
  for (const position of evenPositions(p, m)) into[position]! += 1;
  return into;
}

/** A tükrözött darab alakítása: a sor eleje és vége felcserélődik (05 §4.5, §9.3). */
export function mirrorShaping(shaping: readonly RowShaping[]): RowShaping[] {
  return shaping.map((row) => ({ start: row.end, end: row.start }));
}
