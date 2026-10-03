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

export function sameChart(a: FreeformChart, b: FreeformChart): boolean {
  return (
    a === b ||
    (a.nextId === b.nextId &&
      a.stitches.length === b.stitches.length &&
      a.stitches.every((placed, i) => {
        const other = b.stitches[i];
        return (
          other !== undefined &&
          placed.id === other.id &&
          placed.stitch === other.stitch &&
          placed.x === other.x &&
          placed.y === other.y &&
          placed.rotation === other.rotation &&
          placed.scale === other.scale
        );
      }))
  );
}

export function placeStitch(chart: FreeformChart, stitch: StitchDefId, x: number, y: number): FreeformChart {
  return {
    stitches: [...chart.stitches, { id: chart.nextId, stitch, x, y, rotation: 0, scale: 1 }],
    nextId: chart.nextId + 1,
  };
}

export const MIN_COUNT = 1;
export const MAX_COUNT = 10;

/**
 * `count` of one stitch side by side, upright and `gap` apart, centred on the
 * point and shifted back on the board past an edge; a count outside 1–10 is
 * taken at the nearer end. `null` for a row wider or taller than the board.
 * KB: interface.md §85
 */
export function placeStitches(
  chart: FreeformChart,
  stitch: StitchDefId,
  point: Point,
  count: number,
  extent: (placed: PlacedStitch) => Extent,
  gap: number,
  bounds: Rect,
): { readonly chart: FreeformChart; readonly ids: ReadonlySet<number> } | null {
  const n = Number.isFinite(count) ? Math.min(Math.max(Math.trunc(count), MIN_COUNT), MAX_COUNT) : MIN_COUNT;
  const added = Array.from({ length: n }, (_, i): PlacedStitch => {
    return { id: chart.nextId + i, stitch, x: point.x, y: point.y, rotation: 0, scale: 1 };
  });
  const ids = new Set(added.map(({ id }) => id));
  const laid = { stitches: [...chart.stitches, ...added], nextId: chart.nextId + n };
  const row = n === 1 ? laid : arrangeStitches(laid, ids, 'row', extent, { gap, radius: 0, angle: 0, facing: 'feet' });
  const [dx, dy] = boundedMove(row, ids, 0, 0, bounds);
  const next = moveStitches(row, ids, dx, dy);
  return allInside(next, ids, bounds) ? { chart: next, ids } : null;
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

export function frameHolds(frame: Frame, point: Point): boolean {
  const local = turn({ x: point.x - frame.center.x, y: point.y - frame.center.y }, -frame.angle);
  return Math.abs(local.x) <= frame.halfWidth && Math.abs(local.y) <= frame.halfHeight;
}

function sameAngle(a: number, b: number): boolean {
  const difference = Math.abs(a - b) % (Math.PI * 2);
  return Math.min(difference, Math.PI * 2 - difference) < 1e-9;
}

/** Whether every selected stitch's centre is on the board. */
export function allInside(chart: FreeformChart, ids: ReadonlySet<number>, bounds: Rect): boolean {
  return chart.stitches.every(
    ({ id, x, y }) => !ids.has(id) || (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY),
  );
}

/** The part of a move that keeps every selected centre on the board: it stops at the edge, it does not refuse. */
export function boundedMove(
  chart: FreeformChart,
  ids: ReadonlySet<number>,
  dx: number,
  dy: number,
  bounds: Rect,
): [number, number] {
  return boundedShift(
    chart.stitches.filter(({ id }) => ids.has(id)),
    dx,
    dy,
    bounds,
  );
}

function boundedShift(stitches: readonly PlacedStitch[], dx: number, dy: number, bounds: Rect): [number, number] {
  if (stitches.length === 0) return [0, 0];
  const xs = stitches.map(({ x }) => x);
  const ys = stitches.map(({ y }) => y);
  return [
    clamp(dx, bounds.minX - Math.min(...xs), bounds.maxX - Math.max(...xs)),
    clamp(dy, bounds.minY - Math.min(...ys), bounds.maxY - Math.max(...ys)),
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

export function deleteStitches(chart: FreeformChart, ids: ReadonlySet<number>): FreeformChart {
  return { ...chart, stitches: chart.stitches.filter(({ id }) => !ids.has(id)) };
}

/** The selected stitches as they stand, for a later paste. */
export function copyStitches(chart: FreeformChart, ids: ReadonlySet<number>): PlacedStitch[] {
  return chart.stitches.filter(({ id }) => ids.has(id));
}

export interface Pasted {
  readonly chart: FreeformChart;
  /** The new stitches' ids: what a paste selects. */
  readonly ids: ReadonlySet<number>;
  /** The copies as placed, so the next paste lands one more step away. */
  readonly copied: readonly PlacedStitch[];
}

/**
 * Places copies of `copied` one step down and to the right, with new ids, turns
 * and sizes kept. Where the board's edge leaves no room for the step, the copy
 * goes the other way on that axis, so it never lands on what it copies.
 */
export function pasteStitches(
  chart: FreeformChart,
  copied: readonly PlacedStitch[],
  step: number,
  bounds: Rect,
): Pasted {
  const [forwardX, forwardY] = boundedShift(copied, step, step, bounds);
  const [backX, backY] = boundedShift(copied, -step, -step, bounds);
  const sx = Math.abs(forwardX) >= Math.abs(backX) ? forwardX : backX;
  const sy = Math.abs(forwardY) >= Math.abs(backY) ? forwardY : backY;
  const pasted = copied.map((placed, index) => ({
    ...placed,
    id: chart.nextId + index,
    x: placed.x + sx,
    y: placed.y + sy,
  }));
  return {
    chart: { stitches: [...chart.stitches, ...pasted], nextId: chart.nextId + pasted.length },
    ids: new Set(pasted.map(({ id }) => id)),
    copied: pasted,
  };
}

export type Arrangement = 'row' | 'around';

/** A stitch's half size on the board, upright: the centre is `halfHeight` above its foot. */
export interface Extent {
  readonly halfWidth: number;
  readonly halfHeight: number;
}

export interface ArrangeOptions {
  /** Row: the space between two neighbouring stitches. */
  readonly gap: number;
  /** Around: from the shared point to the end of each stitch that faces it. */
  readonly radius: number;
  /** Around: the spread from the first stitch to the last, in radians. */
  readonly angle: number;
  /** Around: which end of the stitches faces the shared point. */
  readonly facing: Facing;
}

export type Facing = 'feet' | 'tops';

interface Sized {
  readonly stitch: PlacedStitch;
  readonly size: Extent;
}

/**
 * Lays the selected stitches out around the middle of where they stand, keeping
 * their stitch and size and taking them left to right. A row stands them upright,
 * foot to foot, `gap` apart. Around points their feet — or their tops — at one
 * shared point and keeps that end `radius` away from it, so the ends do not cover
 * each other, spread over `angle` — but never wider than evenly all the way
 * round, so the first and the last never meet. KB: interface.md §83
 */
export function arrangeStitches(
  chart: FreeformChart,
  ids: ReadonlySet<number>,
  arrangement: Arrangement,
  extent: (placed: PlacedStitch) => Extent,
  options: ArrangeOptions,
): FreeformChart {
  const chosen = chart.stitches.filter(({ id }) => ids.has(id));
  if (chosen.length === 0) return chart;
  const middle = {
    x: chosen.reduce((sum, { x }) => sum + x, 0) / chosen.length,
    y: chosen.reduce((sum, { y }) => sum + y, 0) / chosen.length,
  };
  const items = [...chosen].sort((a, b) => a.x - b.x || a.y - b.y).map((stitch) => ({ stitch, size: extent(stitch) }));
  const placed = arrangement === 'row' ? row(items, middle, options.gap) : around(items, middle, options);
  const next = new Map(placed.map((stitch) => [stitch.id, stitch]));
  return { ...chart, stitches: chart.stitches.map((stitch) => next.get(stitch.id) ?? stitch) };
}

function row(items: readonly Sized[], middle: Point, gap: number): PlacedStitch[] {
  const width = items.reduce((sum, { size }) => sum + size.halfWidth * 2, 0) + gap * (items.length - 1);
  const foot = middle.y + Math.max(...items.map(({ size }) => size.halfHeight));
  let left = middle.x - width / 2;
  return items.map(({ stitch, size }) => {
    const x = left + size.halfWidth;
    left += size.halfWidth * 2 + gap;
    return { ...stitch, x, y: foot - size.halfHeight, rotation: 0 };
  });
}

/**
 * The stitches' centres are centred on `middle`, whatever the spread. With the
 * tops facing the point the layout is the feet one mirrored top to bottom.
 */
function around(items: readonly Sized[], middle: Point, { radius, angle, facing }: ArrangeOptions): PlacedStitch[] {
  const n = items.length;
  const step = n > 1 ? Math.min(angle / (n - 1), (Math.PI * 2) / n) : 0;
  const first = -Math.PI / 2 - (step * (n - 1)) / 2;
  const mirror = facing === 'tops' ? -1 : 1;
  const stood = items.map(({ stitch, size }, i) => {
    const direction = first + step * i;
    const reach = radius + size.halfHeight;
    return {
      ...stitch,
      x: Math.cos(direction) * reach,
      y: mirror * Math.sin(direction) * reach,
      rotation: mirror * (direction + Math.PI / 2),
    };
  });
  const xs = stood.map(({ x }) => x);
  const ys = stood.map(({ y }) => y);
  const dx = middle.x - (Math.min(...xs) + Math.max(...xs)) / 2;
  const dy = middle.y - (Math.min(...ys) + Math.max(...ys)) / 2;
  return stood.map((stitch) => ({ ...stitch, x: stitch.x + dx, y: stitch.y + dy }));
}
