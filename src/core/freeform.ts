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
  return boundedShift(
    chart.stitches.filter(({ id }) => ids.has(id)),
    dx,
    dy,
    size,
  );
}

function boundedShift(stitches: readonly PlacedStitch[], dx: number, dy: number, size: Size): [number, number] {
  if (stitches.length === 0) return [0, 0];
  const xs = stitches.map(({ x }) => x);
  const ys = stitches.map(({ y }) => y);
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
export function pasteStitches(chart: FreeformChart, copied: readonly PlacedStitch[], step: number, size: Size): Pasted {
  const [forwardX, forwardY] = boundedShift(copied, step, step, size);
  const [backX, backY] = boundedShift(copied, -step, -step, size);
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

export type Arrangement = 'row' | 'circle' | 'fan';

/** A stitch's half size on the board, upright: the centre is `halfHeight` above its foot. */
export interface Extent {
  readonly halfWidth: number;
  readonly halfHeight: number;
}

export interface ArrangeOptions {
  /** Circle: from the centre to the feet. Fan: from the shared point to the feet. */
  readonly radius: number;
  /** Fan only: the spread from the first stitch to the last, in radians. */
  readonly angle: number;
}

/** The space between two neighbouring stitches of a row. */
export const ROW_GAP = 4;

interface Sized {
  readonly stitch: PlacedStitch;
  readonly size: Extent;
}

/**
 * Lays the selected stitches out around the middle of where they stand, keeping
 * their stitch and size. A row stands them upright, foot to foot, left to right;
 * a circle stands them on a whole circle, feet in and tops out, clockwise from
 * the top; a fan points their feet at one shared point under them and keeps them
 * `radius` away from it, so the feet do not cover each other.
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
  const ordered = arrangement === 'circle' ? byAngle(chosen, middle) : byX(chosen);
  const items = ordered.map((stitch) => ({ stitch, size: extent(stitch) }));
  const placed =
    arrangement === 'row'
      ? row(items, middle)
      : arrangement === 'circle'
        ? circle(items, middle, options.radius)
        : fan(items, middle, options);
  const next = new Map(placed.map((stitch) => [stitch.id, stitch]));
  return { ...chart, stitches: chart.stitches.map((stitch) => next.get(stitch.id) ?? stitch) };
}

function byX(stitches: readonly PlacedStitch[]): PlacedStitch[] {
  return [...stitches].sort((a, b) => a.x - b.x || a.y - b.y);
}

/** Clockwise from the top, so a circle arranged again keeps its order. */
function byAngle(stitches: readonly PlacedStitch[], center: Point): PlacedStitch[] {
  const from = ({ x, y }: PlacedStitch): number =>
    (Math.atan2(y - center.y, x - center.x) + Math.PI * 2.5) % (Math.PI * 2);
  return [...stitches].sort((a, b) => from(a) - from(b) || a.x - b.x);
}

function tallest(items: readonly Sized[]): number {
  return Math.max(...items.map(({ size }) => size.halfHeight));
}

function row(items: readonly Sized[], middle: Point): PlacedStitch[] {
  const width = items.reduce((sum, { size }) => sum + size.halfWidth * 2, 0) + ROW_GAP * (items.length - 1);
  const foot = middle.y + tallest(items);
  let left = middle.x - width / 2;
  return items.map(({ stitch, size }) => {
    const x = left + size.halfWidth;
    left += size.halfWidth * 2 + ROW_GAP;
    return { ...stitch, x, y: foot - size.halfHeight, rotation: 0 };
  });
}

/** Stands the stitch with its foot `radius` from `center` and its top along `direction` (0 = right, clockwise). */
function standOut({ stitch, size }: Sized, center: Point, radius: number, direction: number): PlacedStitch {
  const reach = radius + size.halfHeight;
  return {
    ...stitch,
    x: center.x + Math.cos(direction) * reach,
    y: center.y + Math.sin(direction) * reach,
    rotation: direction + Math.PI / 2,
  };
}

function circle(items: readonly Sized[], center: Point, radius: number): PlacedStitch[] {
  const step = (Math.PI * 2) / items.length;
  return items.map((item, i) => standOut(item, center, radius, -Math.PI / 2 + step * i));
}

function fan(items: readonly Sized[], middle: Point, { radius, angle }: ArrangeOptions): PlacedStitch[] {
  const point = { x: middle.x, y: middle.y + radius + tallest(items) };
  const spread = items.length > 1 ? angle : 0;
  const step = items.length > 1 ? spread / (items.length - 1) : 0;
  return items.map((item, i) => standOut(item, point, radius, -Math.PI / 2 - spread / 2 + step * i));
}
