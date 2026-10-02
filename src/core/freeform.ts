import type { StitchDefId } from './types.ts';

export interface PlacedStitch {
  readonly id: number;
  readonly stitch: StitchDefId;
  readonly x: number;
  readonly y: number;
  /** Radians, clockwise on screen. */
  readonly rotation: number;
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

export function emptyChart(): FreeformChart {
  return { stitches: [], nextId: 1 };
}

export function placeStitch(chart: FreeformChart, stitch: StitchDefId, x: number, y: number): FreeformChart {
  return {
    stitches: [...chart.stitches, { id: chart.nextId, stitch, x, y, rotation: 0 }],
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

/** The middle of the selected centres' bounding box: the point a selection turns around. */
export function selectionCenter(chart: FreeformChart, ids: ReadonlySet<number>): Point | null {
  const chosen = chart.stitches.filter(({ id }) => ids.has(id));
  if (chosen.length === 0) return null;
  const xs = chosen.map(({ x }) => x);
  const ys = chosen.map(({ y }) => y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

export interface Size {
  readonly width: number;
  readonly height: number;
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
  const clamp = (value: number, low: number, high: number): number => Math.min(Math.max(value, low), high);
  return [
    clamp(dx, -Math.min(...xs), size.width - Math.max(...xs)),
    clamp(dy, -Math.min(...ys), size.height - Math.max(...ys)),
  ];
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
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  return {
    ...chart,
    stitches: chart.stitches.map((placed) => {
      if (!ids.has(placed.id)) return placed;
      const [dx, dy] = [placed.x - center.x, placed.y - center.y];
      return {
        ...placed,
        x: center.x + dx * cos - dy * sin,
        y: center.y + dx * sin + dy * cos,
        rotation: placed.rotation + angle,
      };
    }),
  };
}
