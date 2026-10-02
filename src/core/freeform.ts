import type { StitchDefId } from './types.ts';

export interface PlacedStitch {
  readonly id: number;
  readonly stitch: StitchDefId;
  readonly x: number;
  readonly y: number;
  /** Radians, clockwise on screen. */
  readonly rotation: number;
  readonly scale: number;
}

export interface FreeformChart {
  readonly stitches: readonly PlacedStitch[];
  readonly nextId: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Rect {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** A selection's frame: a rectangle around `center`, turned by `angle`. */
export interface Frame {
  readonly center: Point;
  readonly angle: number;
  readonly halfWidth: number;
  readonly halfHeight: number;
}

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 4;

export function emptyChart(): FreeformChart {
  return { stitches: [], nextId: 1 };
}

export function placeStitch(chart: FreeformChart, stitch: StitchDefId, x: number, y: number): FreeformChart {
  return {
    stitches: [...chart.stitches, { id: chart.nextId, stitch, x, y, rotation: 0, scale: 1 }],
    nextId: chart.nextId + 1,
  };
}

/** The stitch whose reach covers the point; of several, the one placed last. */
export function stitchAt(chart: FreeformChart, point: Point, reach: (placed: PlacedStitch) => number): number | null {
  for (let i = chart.stitches.length - 1; i >= 0; i -= 1) {
    const placed = chart.stitches[i];
    if (placed !== undefined && Math.hypot(placed.x - point.x, placed.y - point.y) <= reach(placed)) return placed.id;
  }
  return null;
}

export function rectOf(from: Point, to: Point): Rect {
  return {
    minX: Math.min(from.x, to.x),
    minY: Math.min(from.y, to.y),
    maxX: Math.max(from.x, to.x),
    maxY: Math.max(from.y, to.y),
  };
}

/** The stitches whose centre lies inside the rectangle, given by any two opposite corners. */
export function stitchesIn(chart: FreeformChart, from: Point, to: Point): number[] {
  const rect = rectOf(from, to);
  return chart.stitches
    .filter(({ x, y }) => x >= rect.minX && x <= rect.maxX && y >= rect.minY && y <= rect.maxY)
    .map(({ id }) => id);
}

export function turn(vector: Point, angle: number): Point {
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  return { x: vector.x * cos - vector.y * sin, y: vector.x * sin + vector.y * cos };
}

/**
 * The frame around the selected stitches, each counted with its reach. It is
 * turned with the stitches when they all share one turn — which a selection
 * turned together does — and upright otherwise.
 */
export function selectionFrame(
  chart: FreeformChart,
  ids: ReadonlySet<number>,
  reach: (placed: PlacedStitch) => number,
): Frame | null {
  const chosen = chart.stitches.filter(({ id }) => ids.has(id));
  const first = chosen[0];
  if (first === undefined) return null;
  const shared = chosen.every(({ rotation }) => sameAngle(rotation, first.rotation));
  const angle = shared ? first.rotation : 0;
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const placed of chosen) {
    const local = turn(placed, -angle);
    const r = reach(placed);
    minX = Math.min(minX, local.x - r);
    minY = Math.min(minY, local.y - r);
    maxX = Math.max(maxX, local.x + r);
    maxY = Math.max(maxY, local.y + r);
  }
  return {
    center: turn({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 }, angle),
    angle,
    halfWidth: (maxX - minX) / 2,
    halfHeight: (maxY - minY) / 2,
  };
}

function sameAngle(a: number, b: number): boolean {
  const difference = Math.abs(a - b) % (Math.PI * 2);
  return Math.min(difference, Math.PI * 2 - difference) < 1e-9;
}

/** Whether every selected stitch's centre is on the board. */
export function allInside(chart: FreeformChart, ids: ReadonlySet<number>, size: Size): boolean {
  return chart.stitches.every(
    ({ id, x, y }) => !ids.has(id) || (x >= 0 && x <= size.width && y >= 0 && y <= size.height),
  );
}

/** The part of a move that keeps every selected centre on the board: it stops at the edge, it does not refuse. */
export function boundedMove(
  chart: FreeformChart,
  ids: ReadonlySet<number>,
  dx: number,
  dy: number,
  size: Size,
): [number, number] {
  const chosen = chart.stitches.filter(({ id }) => ids.has(id));
  if (chosen.length === 0) return [0, 0];
  const xs = chosen.map(({ x }) => x);
  const ys = chosen.map(({ y }) => y);
  return [
    clamp(dx, -Math.min(...xs), size.width - Math.max(...xs)),
    clamp(dy, -Math.min(...ys), size.height - Math.max(...ys)),
  ];
}

/** The part of a resize that keeps every selected stitch between MIN_SCALE and MAX_SCALE. */
export function boundedFactor(chart: FreeformChart, ids: ReadonlySet<number>, factor: number): number {
  const scales = chart.stitches.filter(({ id }) => ids.has(id)).map(({ scale }) => scale);
  if (scales.length === 0) return 1;
  return clamp(factor, MIN_SCALE / Math.min(...scales), MAX_SCALE / Math.max(...scales));
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

export function moveStitches(chart: FreeformChart, ids: ReadonlySet<number>, dx: number, dy: number): FreeformChart {
  return {
    ...chart,
    stitches: chart.stitches.map((placed) =>
      ids.has(placed.id) ? { ...placed, x: placed.x + dx, y: placed.y + dy } : placed,
    ),
  };
}

/** Turns the selected stitches around `center`: each moves along its circle and turns by the same angle. */
export function rotateStitches(
  chart: FreeformChart,
  ids: ReadonlySet<number>,
  center: Point,
  angle: number,
): FreeformChart {
  return {
    ...chart,
    stitches: chart.stitches.map((placed) => {
      if (!ids.has(placed.id)) return placed;
      const offset = turn({ x: placed.x - center.x, y: placed.y - center.y }, angle);
      return { ...placed, x: center.x + offset.x, y: center.y + offset.y, rotation: placed.rotation + angle };
    }),
  };
}

/** Resizes the selected stitches about `center`: the stitches and the gaps between them grow by the same factor. */
export function scaleStitches(
  chart: FreeformChart,
  ids: ReadonlySet<number>,
  center: Point,
  factor: number,
): FreeformChart {
  return {
    ...chart,
    stitches: chart.stitches.map((placed) =>
      ids.has(placed.id)
        ? {
            ...placed,
            x: center.x + (placed.x - center.x) * factor,
            y: center.y + (placed.y - center.y) * factor,
            scale: placed.scale * factor,
          }
        : placed,
    ),
  };
}
