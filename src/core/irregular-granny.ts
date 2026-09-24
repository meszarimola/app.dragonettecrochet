// The grid of a granny square: its rounds, their cells and their bands. KB: core-geometry §55

import { GRANNY_COUNT_RANGE, type IrregularPattern, type Point } from './irregular-types.ts';

const CORNER_TOLERANCE = 1e-6;

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * A spot on the square of half-side `half`, `distance` along its outline from
 * the top-left corner, clockwise. The angle points outwards: straight out of a
 * side, and diagonally out of a corner.
 */
export function squareStop(half: number, distance: number): { at: Point; angle: number } {
  const side = 2 * half;
  const perimeter = 4 * side;
  const along = perimeter > 0 ? ((distance % perimeter) + perimeter) % perimeter : 0;
  const index = side > 0 ? Math.min(3, Math.floor(along / side)) : 0;
  const offset = along - index * side;
  const slack = CORNER_TOLERANCE * Math.max(1, side);
  const corner = offset < slack || side - offset < slack;
  const at: Point = [
    { x: -half + offset, y: -half },
    { x: half, y: -half + offset },
    { x: half - offset, y: half },
    { x: -half, y: half - offset },
  ][index] ?? { x: 0, y: 0 };
  if (!corner) return { at, angle: index * 90 };
  const atCorner = (side - offset < slack ? index + 1 : index) % 4;
  const cornerPoint: Point =
    [
      { x: -half, y: -half },
      { x: half, y: -half },
      { x: half, y: half },
      { x: -half, y: half },
    ][atCorner] ?? at;
  return { at: cornerPoint, angle: (atCorner * 90 + 315) % 360 };
}

/** One whole number the grid count field accepts. */
export function clampGrannyCount(count: number): number {
  if (!Number.isFinite(count)) return GRANNY_COUNT_RANGE.min;
  return Math.min(GRANNY_COUNT_RANGE.max, Math.max(GRANNY_COUNT_RANGE.min, Math.round(count)));
}

/** One round of the grid: the band between two squares, cut into `cells` cells. */
export interface GrannyRing {
  readonly rowId: string;
  /** Counted from the middle outwards, starting at 1. */
  readonly round: number;
  readonly cells: number;
  readonly inner: number;
  readonly outer: number;
}

/** A place a stitch can go: the middle of one cell, with the way it faces. */
export interface GrannyCell {
  readonly rowId: string;
  readonly index: number;
  readonly at: Point;
  readonly angle: number;
}

/**
 * The rounds of a granny square, middle outwards. Every round is one `step`
 * deep, so a round's depth never depends on what was put in it.
 */
export function grannyRings(pattern: IrregularPattern, step: number): GrannyRing[] {
  if (pattern.motif !== 'granny-square') return [];
  const depth = Math.max(1, finite(step, 1));
  const rings: GrannyRing[] = [];
  for (const row of pattern.rows) {
    if (row.cells === undefined) continue;
    const round = rings.length + 1;
    rings.push({
      rowId: row.id,
      round,
      cells: Math.max(1, Math.round(row.cells)),
      inner: (round - 1) * depth,
      outer: round * depth,
    });
  }
  return rings;
}

export function grannyRing(pattern: IrregularPattern, step: number, rowId: string): GrannyRing | undefined {
  return grannyRings(pattern, step).find((ring) => ring.rowId === rowId);
}

/**
 * Where each cell of a round sits: on the middle square of its band, the first
 * on the top-left corner and the rest clockwise. A count divisible by four puts
 * one cell on each corner.
 */
export function grannyCells(ring: GrannyRing): GrannyCell[] {
  const half = (ring.inner + ring.outer) / 2;
  const step = (8 * half) / ring.cells;
  return Array.from({ length: ring.cells }, (_, index) => {
    const stop = squareStop(half, index * step);
    return { rowId: ring.rowId, index, at: stop.at, angle: stop.angle };
  });
}

/** Every cell of the square, middle outwards. */
export function grannyCellsOf(pattern: IrregularPattern, step: number): GrannyCell[] {
  return grannyRings(pattern, step).flatMap((ring) => grannyCells(ring));
}

/**
 * The round a point falls in. A round's band is the ring between two squares
 * about the middle, so how far out a point is, is its larger coordinate. A point
 * beyond the last round belongs to no round. KB: interface.md §72
 */
export function grannyRingAt(pattern: IrregularPattern, step: number, point: Point): GrannyRing | undefined {
  const reach = Math.max(Math.abs(point.x), Math.abs(point.y));
  return grannyRings(pattern, step).find((ring) => reach >= ring.inner && reach <= ring.outer);
}

/**
 * The background of one round, as the round generator's chart drew it: a square
 * band between the round's two squares, split by a line between two cells.
 * KB: core-geometry §56
 */
export interface GrannyBand {
  readonly tone: 0 | 1;
  readonly outer: readonly Point[];
  /** Absent for the first round, whose band reaches the middle. */
  readonly inner: readonly Point[] | null;
  readonly dividers: readonly (readonly [Point, Point])[];
}

function squareCorners(half: number): Point[] {
  return [
    { x: -half, y: -half },
    { x: half, y: -half },
    { x: half, y: half },
    { x: -half, y: half },
  ];
}

export function grannyBands(pattern: IrregularPattern, step: number): GrannyBand[] {
  return grannyRings(pattern, step).map((ring, index) => {
    const on = (half: number, share: number): Point =>
      half <= 0 ? { x: 0, y: 0 } : squareStop(half, share * 8 * half).at;
    const dividers =
      ring.cells < 2
        ? []
        : Array.from({ length: ring.cells }, (_, cell) => {
            const share = (cell + 0.5) / ring.cells;
            return [on(ring.inner, share), on(ring.outer, share)] as const;
          });
    return {
      tone: (index % 2 === 0 ? 0 : 1) as 0 | 1,
      outer: squareCorners(ring.outer),
      inner: ring.inner > 0 ? squareCorners(ring.inner) : null,
      dividers,
    };
  });
}
