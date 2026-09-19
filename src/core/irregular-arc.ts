// The geometry of a chain arc. KB: core-geometry §52

import { normalizeAngle } from './irregular-document.ts';
import { angleFromCenter, directionOf } from './irregular-snap.ts';
import { type ChainArcGroup, DEFAULT_ARC_BULGE, type Point } from './irregular-types.ts';

/** A stitch position along the path, with the angle its path axis should take. */
export interface ArcStop {
  readonly at: Point;
  /** Tangent direction at this point, degrees clockwise from up. */
  readonly angle: number;
}

const ORIGIN: Point = { x: 0, y: 0 };

/** Under this share of the chord the radius runs away and the chord is the honest answer. */
const FLAT = 1e-9;

type Path =
  | { readonly kind: 'point'; readonly at: Point }
  | { readonly kind: 'straight'; readonly from: Point; readonly direction: Point; readonly length: number }
  | {
      readonly kind: 'arc';
      readonly center: Point;
      readonly radius: number;
      readonly from: number;
      readonly sweep: number;
    };

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function finitePoint(point: Point): Point {
  return { x: finite(point.x, 0), y: finite(point.y, 0) };
}

/** Degrees clockwise from up for a direction rather than for a position. */
function angleOf(direction: Point): number {
  return angleFromCenter(ORIGIN, direction);
}

/** With y growing downward this points to the left of the direction of travel. */
function leftNormal(direction: Point): Point {
  return { x: direction.y, y: -direction.x };
}

function straightPath(from: Point, direction: Point, length: number): Path {
  return { kind: 'straight', from, direction, length };
}

function pathOf(group: Pick<ChainArcGroup, 'shape' | 'start' | 'end' | 'bulge'>): Path {
  const start = finitePoint(group.start);
  const end = finitePoint(group.end);
  const [dx, dy] = [end.x - start.x, end.y - start.y];
  const chord = Math.hypot(dx, dy);
  if (!Number.isFinite(chord) || chord === 0) return { kind: 'point', at: start };
  const direction = { x: dx / chord, y: dy / chord };
  const bulge = group.shape === 'arc' ? finite(group.bulge, 0) : 0;
  const sagitta = Math.abs(bulge);
  if (sagitta <= chord * FLAT) return straightPath(start, direction, chord);
  const half = chord / 2;
  const radius = (half * half + sagitta * sagitta) / (2 * sagitta);
  if (!Number.isFinite(radius)) return straightPath(start, direction, chord);
  const middle = { x: start.x + dx / 2, y: start.y + dy / 2 };
  const normal = leftNormal(direction);
  const side = bulge < 0 ? -1 : 1;
  const reach = side * (sagitta - radius);
  const center = { x: middle.x + normal.x * reach, y: middle.y + normal.y * reach };
  const sweep = (side * 2 * Math.atan2(half, radius - sagitta) * 180) / Math.PI;
  return { kind: 'arc', center, radius, from: angleFromCenter(center, start), sweep };
}

function stopAt(path: Path, t: number): ArcStop {
  const along = finite(t, 0);
  if (path.kind === 'point') return { at: path.at, angle: 0 };
  if (path.kind === 'straight') {
    const distance = along * path.length;
    return {
      at: { x: path.from.x + path.direction.x * distance, y: path.from.y + path.direction.y * distance },
      angle: angleOf(path.direction),
    };
  }
  const angle = path.from + along * path.sweep;
  const outward = directionOf(angle);
  return {
    at: { x: path.center.x + outward.x * path.radius, y: path.center.y + outward.y * path.radius },
    angle: normalizeAngle(angle + (path.sweep < 0 ? -90 : 90)),
  };
}

/** The signed distance the middle of the arc stands off the chord, for a preset share of the chord. */
export function presetBulge(start: Point, end: Point, share = DEFAULT_ARC_BULGE): number {
  const from = finitePoint(start);
  const to = finitePoint(end);
  const chord = Math.hypot(to.x - from.x, to.y - from.y);
  return finite(chord * finite(share, DEFAULT_ARC_BULGE), 0);
}

/** Total length of the path the stitches sit on. */
export function arcLength(group: Pick<ChainArcGroup, 'shape' | 'start' | 'end' | 'bulge'>): number {
  const path = pathOf(group);
  if (path.kind === 'point') return 0;
  if (path.kind === 'straight') return path.length;
  return (path.radius * Math.abs(path.sweep) * Math.PI) / 180;
}

/** The point a fraction `t` (0..1 by arc length) along the path, and the tangent there. */
export function arcAt(group: Pick<ChainArcGroup, 'shape' | 'start' | 'end' | 'bulge'>, t: number): ArcStop {
  return stopAt(pathOf(group), t);
}

/**
 * Where the `count` stitches go: evenly spaced by arc length, inset half a
 * spacing at each end, in working order from `start` to `end`.
 */
export function arcStops(group: Pick<ChainArcGroup, 'shape' | 'start' | 'end' | 'bulge' | 'count'>): ArcStop[] {
  const count = Number.isFinite(group.count) ? Math.max(0, Math.round(group.count)) : 0;
  const path = pathOf(group);
  return Array.from({ length: count }, (_, index) => stopAt(path, (index + 0.5) / count));
}

/** Where the handle that adjusts the bulge is drawn: the middle of the path. */
export function arcHandle(group: Pick<ChainArcGroup, 'shape' | 'start' | 'end' | 'bulge'>): Point {
  return stopAt(pathOf(group), 0.5).at;
}

/** The bulge that would make the arc pass through `through`. Dragging past the chord flips the side. */
export function bulgeThrough(start: Point, end: Point, through: Point): number {
  const from = finitePoint(start);
  const to = finitePoint(end);
  const point = finitePoint(through);
  const [dx, dy] = [to.x - from.x, to.y - from.y];
  const chord = Math.hypot(dx, dy);
  if (!Number.isFinite(chord) || chord === 0) return 0;
  const normal = leftNormal({ x: dx / chord, y: dy / chord });
  const middle = { x: from.x + dx / 2, y: from.y + dy / 2 };
  return finite((point.x - middle.x) * normal.x + (point.y - middle.y) * normal.y, 0);
}
