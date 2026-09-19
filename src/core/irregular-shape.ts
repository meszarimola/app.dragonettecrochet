// The shape a row is arranged on: where its stitches stand and which shape the stitches themselves describe.

import { arcAt, arcLength, bulgeThrough, presetBulge } from './irregular-arc.ts';
import { normalizeAngle } from './irregular-document.ts';
import { angleFromCenter, directionOf } from './irregular-snap.ts';
import {
  type ChainArcGroup,
  FIT_TOLERANCE,
  type IrregularItem,
  type Point,
  type RowLine,
  type RowLineShape,
} from './irregular-types.ts';

/** A place on a shape: where a stitch's base goes and which way the shape runs there. */
export interface ShapeStop {
  readonly at: Point;
  /** The shape's own direction there, degrees clockwise from up. */
  readonly along: number;
}

type OpenShape = Exclude<RowLine, { shape: 'circle' }>;
type CircleShape = Extract<RowLine, { shape: 'circle' }>;
type ArcPath = Pick<ChainArcGroup, 'shape' | 'start' | 'end' | 'bulge'>;

/** The fitted circle a run of points lies on, before it is cut down to an arc. */
interface FittedCircle {
  readonly center: Point;
  readonly radius: number;
}

/** The stretch of a circle the points actually cover, clockwise from `from`. */
interface AngularRun {
  readonly from: number;
  readonly span: number;
}

const QUARTER_TURN = 90;
const FULL_TURN = 360;

/** Nearer than this and two base points are the same place, so their stitches share one position. */
const COINCIDENT = 1e-6;

/**
 * At or above this much of a turn the points have closed into a circle; below it
 * an arc describes them better and leaves the gap they left alone.
 */
const CIRCLE_SPAN = 300;

/** A circle fit needs a centre the points actually determine; a collinear run does not give one. */
const SINGULAR = 1e-12;

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function finitePoint(point: Point): Point {
  return { x: finite(point.x, 0), y: finite(point.y, 0) };
}

function settledAngle(value: number): number {
  return normalizeAngle(finite(value, 0));
}

function radiusOf(shape: CircleShape): number {
  return Math.abs(finite(shape.radius, 0));
}

function arcPathOf(shape: OpenShape): ArcPath {
  const start = finitePoint(shape.start);
  const end = finitePoint(shape.end);
  if (shape.shape === 'arc') return { shape: 'arc', start, end, bulge: finite(shape.bulge, 0) };
  return { shape: 'straight', start, end, bulge: 0 };
}

function distanceBetween(from: Point, to: Point): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

/** The length of the shape a row sits on. */
export function shapeLength(shape: RowLine): number {
  if (shape.shape === 'circle') return 2 * Math.PI * radiusOf(shape);
  return finite(arcLength(arcPathOf(shape)), 0);
}

/** The point a fraction `t` (0..1 by length) along the shape, and its direction there. */
export function shapeAt(shape: RowLine, t: number): ShapeStop {
  const along = finite(t, 0);
  if (shape.shape === 'circle') {
    const center = finitePoint(shape.center);
    const radius = radiusOf(shape);
    const turned = settledAngle(settledAngle(shape.startAngle) + along * FULL_TURN);
    const outward = directionOf(turned);
    return {
      at: { x: center.x + outward.x * radius, y: center.y + outward.y * radius },
      along: settledAngle(turned + QUARTER_TURN),
    };
  }
  const stop = arcAt(arcPathOf(shape), along);
  return { at: finitePoint(stop.at), along: settledAngle(stop.angle) };
}

/**
 * Where `count` stitches go, in stitch order. On an open shape the first sits
 * at the start and the last at the end, evenly spaced between. On a circle they
 * are spread all the way round from the start angle, so the last does not land
 * on the first.
 */
export function shapeStops(shape: RowLine, count: number): ShapeStop[] {
  const total = Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
  if (total < 1) return [];
  if (shape.shape === 'circle') return Array.from({ length: total }, (_, index) => shapeAt(shape, index / total));
  if (total === 1) return [shapeAt(shape, 0)];
  return Array.from({ length: total }, (_, index) => shapeAt(shape, index / (total - 1)));
}

/**
 * How far a stitch turns to stand on the shape: perpendicular to it, on `side`.
 *
 * A circle is walked clockwise, so the left of the way it runs is already the
 * way out of it — which is why one quarter turn off the direction answers for
 * every shape, and `outside` reads the same as `left`.
 */
export function shapeRotation(shape: RowLine, stop: ShapeStop): number {
  const along = settledAngle(stop.along);
  const towardsCenter = shape.side === 'right' || shape.side === 'inside';
  return settledAngle(along + (towardsCenter ? QUARTER_TURN : -QUARTER_TURN));
}

/** The base point of an item, which is what arranging places. */
export function basePoint(item: Pick<IrregularItem, 'x' | 'y' | 'rotation' | 'height'>): Point {
  const radians = (settledAngle(item.rotation) * Math.PI) / 180;
  const half = finite(item.height, 0) / 2;
  return {
    x: finite(item.x, 0) - Math.sin(radians) * half,
    y: finite(item.y, 0) + Math.cos(radians) * half,
  };
}

/** The centre a stitch of this rotation and height takes when its base lands on `base`. */
function centerOver(base: Point, rotation: number, height: number): Point {
  const radians = (rotation * Math.PI) / 180;
  const half = height / 2;
  return { x: base.x + Math.sin(radians) * half, y: base.y - Math.cos(radians) * half };
}

/**
 * Lays the items along the shape by their BASE points, in the order given, and
 * returns them moved. Items whose base points already coincide (a fan worked
 * into one stitch) take one position together. When `shape.perpendicular` is
 * false each item keeps its own rotation.
 */
export function placeOnShape(items: readonly IrregularItem[], shape: RowLine): IrregularItem[] {
  if (items.length === 0) return [];
  const anchors: Point[] = [];
  const slots = items.map((item) => {
    const base = basePoint(item);
    const found = anchors.findIndex((anchor) => distanceBetween(anchor, base) <= COINCIDENT);
    if (found >= 0) return found;
    anchors.push(base);
    return anchors.length - 1;
  });
  const stops = shapeStops(shape, anchors.length);
  return items.map((item, index) => {
    const stop = stops[slots[index]];
    if (stop === undefined) return item;
    const rotation = shape.perpendicular ? shapeRotation(shape, stop) : settledAngle(item.rotation);
    const at = centerOver(stop.at, rotation, finite(item.height, 0));
    return { ...item, x: at.x, y: at.y, rotation };
  });
}

function usablePoints(points: readonly Point[]): Point[] {
  return points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function hasTwoDistinct(points: readonly Point[]): boolean {
  const first = points[0];
  if (first === undefined) return false;
  return points.some((point) => distanceBetween(first, point) > COINCIDENT);
}

function centroid(points: readonly Point[]): Point {
  const sum = points.reduce((total, point) => ({ x: total.x + point.x, y: total.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/** The pair of points standing furthest apart, running in the direction the row was worked. */
function widestPair(points: readonly Point[]): { start: Point; end: Point } | null {
  let widest = 0;
  let from = points[0];
  let to = points[0];
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const distance = distanceBetween(points[i], points[j]);
      if (distance > widest) {
        widest = distance;
        from = points[i];
        to = points[j];
      }
    }
  }
  if (!(widest > 0)) return null;
  return orientedBy(points[0], from, to);
}

function orientedBy(first: Point, from: Point, to: Point): { start: Point; end: Point } {
  if (distanceBetween(first, from) <= distanceBetween(first, to)) return { start: from, end: to };
  return { start: to, end: from };
}

/** The total-least-squares line through the points, spanning them from extreme to extreme. */
function lineThrough(points: readonly Point[]): OpenShape | null {
  const middle = centroid(points);
  let xx = 0;
  let xy = 0;
  let yy = 0;
  for (const point of points) {
    const dx = point.x - middle.x;
    const dy = point.y - middle.y;
    xx += dx * dx;
    xy += dx * dy;
    yy += dy * dy;
  }
  if (!(xx + yy > 0)) return null;
  const theta = 0.5 * Math.atan2(2 * xy, xx - yy);
  let direction = { x: Math.cos(theta), y: Math.sin(theta) };
  const first = points[0];
  const last = points[points.length - 1];
  if ((last.x - first.x) * direction.x + (last.y - first.y) * direction.y < 0) {
    direction = { x: -direction.x, y: -direction.y };
  }
  let nearest = Number.POSITIVE_INFINITY;
  let furthest = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    const along = (point.x - middle.x) * direction.x + (point.y - middle.y) * direction.y;
    nearest = Math.min(nearest, along);
    furthest = Math.max(furthest, along);
  }
  if (!Number.isFinite(nearest) || !Number.isFinite(furthest)) return null;
  return {
    shape: 'line',
    start: { x: middle.x + direction.x * nearest, y: middle.y + direction.y * nearest },
    end: { x: middle.x + direction.x * furthest, y: middle.y + direction.y * furthest },
    side: 'left',
    perpendicular: true,
  };
}

function onLine(points: readonly Point[], line: OpenShape, tolerance: number): boolean {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) return points.every((point) => distanceBetween(line.start, point) <= tolerance);
  const nx = dy / length;
  const ny = -dx / length;
  return points.every((point) => Math.abs((point.x - line.start.x) * nx + (point.y - line.start.y) * ny) <= tolerance);
}

/** The algebraic (Kasa) circle fit: a linear least squares in the squared radius. */
function circleThrough(points: readonly Point[]): FittedCircle | null {
  const middle = centroid(points);
  let uu = 0;
  let uv = 0;
  let vv = 0;
  let uuu = 0;
  let vvv = 0;
  let uvv = 0;
  let vuu = 0;
  for (const point of points) {
    const u = point.x - middle.x;
    const v = point.y - middle.y;
    uu += u * u;
    uv += u * v;
    vv += v * v;
    uuu += u * u * u;
    vvv += v * v * v;
    uvv += u * v * v;
    vuu += v * u * u;
  }
  const spread = uu + vv;
  const determinant = uu * vv - uv * uv;
  if (!(spread > 0) || Math.abs(determinant) <= SINGULAR * spread * spread) return null;
  const bu = (uuu + uvv) / 2;
  const bv = (vvv + vuu) / 2;
  const u = (bu * vv - bv * uv) / determinant;
  const v = (uu * bv - uv * bu) / determinant;
  const radius = Math.sqrt(u * u + v * v + spread / points.length);
  const center = { x: middle.x + u, y: middle.y + v };
  if (!Number.isFinite(radius) || !(radius > 0)) return null;
  if (!Number.isFinite(center.x) || !Number.isFinite(center.y)) return null;
  return { center, radius };
}

function onCircle(points: readonly Point[], circle: FittedCircle, tolerance: number): boolean {
  return points.every((point) => Math.abs(distanceBetween(circle.center, point) - circle.radius) <= tolerance);
}

function pointOn(circle: FittedCircle, at: number): Point {
  const outward = directionOf(settledAngle(at));
  return { x: circle.center.x + outward.x * circle.radius, y: circle.center.y + outward.y * circle.radius };
}

/** The run the points cover is everything but the widest gap they leave. */
function angularRun(points: readonly Point[], center: Point): AngularRun {
  const angles = points.map((point) => angleFromCenter(center, point)).sort((a, b) => a - b);
  let gap = FULL_TURN - (angles[angles.length - 1] - angles[0]);
  let from = angles[0];
  for (let index = 1; index < angles.length; index += 1) {
    const between = angles[index] - angles[index - 1];
    if (between > gap) {
      gap = between;
      from = angles[index];
    }
  }
  return { from, span: FULL_TURN - gap };
}

function arcOver(points: readonly Point[], circle: FittedCircle, run: AngularRun, tolerance: number): RowLine | null {
  if (!(run.span > 0)) return null;
  const ends = orientedBy(points[0], pointOn(circle, run.from), pointOn(circle, run.from + run.span));
  const bulge = bulgeThrough(ends.start, ends.end, pointOn(circle, run.from + run.span / 2));
  if (!Number.isFinite(bulge) || Math.abs(bulge) <= tolerance) return null;
  return { shape: 'arc', start: ends.start, end: ends.end, bulge, side: 'left', perpendicular: true };
}

/**
 * Fits a line, an arc and a circle to the points and returns the simplest that
 * fits within `tolerance`, or nothing when none does. Line first, then arc,
 * then circle.
 */
export function fitShape(points: readonly Point[], tolerance = FIT_TOLERANCE): RowLine | null {
  const usable = usablePoints(points);
  if (!hasTwoDistinct(usable)) return null;
  const reach = Number.isFinite(tolerance) && tolerance >= 0 ? tolerance : FIT_TOLERANCE;
  const line = lineThrough(usable);
  if (line !== null && onLine(usable, line, reach)) return line;
  const circle = circleThrough(usable);
  if (circle === null || !onCircle(usable, circle, reach)) return null;
  const run = angularRun(usable, circle.center);
  if (run.span < CIRCLE_SPAN) return arcOver(usable, circle, run, reach);
  return {
    shape: 'circle',
    center: circle.center,
    radius: circle.radius,
    startAngle: angleFromCenter(circle.center, usable[0]),
    side: 'outside',
    perpendicular: true,
  };
}

/** The shape a fresh arrange starts from, taken from where the stitches are now. */
export function suggestShape(points: readonly Point[], shape: RowLineShape): RowLine | null {
  const usable = usablePoints(points);
  if (!hasTwoDistinct(usable)) return null;
  if (shape === 'circle') {
    const center = centroid(usable);
    const radius = usable.reduce((total, point) => total + distanceBetween(center, point), 0) / usable.length;
    if (!Number.isFinite(radius) || !(radius > 0)) return null;
    return {
      shape: 'circle',
      center,
      radius,
      startAngle: angleFromCenter(center, usable[0]),
      side: 'outside',
      perpendicular: true,
    };
  }
  const ends = widestPair(usable);
  if (ends === null) return null;
  if (shape === 'arc') {
    return {
      shape: 'arc',
      start: ends.start,
      end: ends.end,
      bulge: presetBulge(ends.start, ends.end),
      side: 'left',
      perpendicular: true,
    };
  }
  return { shape: 'line', start: ends.start, end: ends.end, side: 'left', perpendicular: true };
}
