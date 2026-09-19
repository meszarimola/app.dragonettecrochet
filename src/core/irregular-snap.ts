// Guides and snapping for the free-form chart. KB: core-geometry §51

import { isVisible, normalizeAngle } from './irregular-document.ts';
import type { IrregularItem, IrregularPattern, Point, PolarGuide } from './irregular-types.ts';

/** Degrees clockwise from straight up, so the number reads like an item's rotation. */
export function angleFromCenter(center: Point, point: Point): number {
  return normalizeAngle((Math.atan2(point.x - center.x, center.y - point.y) * 180) / Math.PI);
}

/** The unit vector a spoke at this angle points along. */
export function directionOf(angle: number): Point {
  const radians = (angle * Math.PI) / 180;
  return { x: Math.sin(radians), y: -Math.cos(radians) };
}

export function ringRadii(polar: PolarGuide): number[] {
  return Array.from({ length: polar.rings }, (_, index) => (index + 1) * polar.spacing);
}

export function spokeAngles(polar: PolarGuide): number[] {
  const step = 360 / polar.spokes;
  return Array.from({ length: polar.spokes }, (_, index) => normalizeAngle(polar.startAngle + index * step));
}

/**
 * Where a stitch would sit on the circle guide: the nearest ring crossed with
 * the nearest spoke. Inside half a ring of the middle, the middle itself.
 */
export function polarPoint(polar: PolarGuide, point: Point): Point {
  const distance = Math.hypot(point.x - polar.center.x, point.y - polar.center.y);
  const ring = Math.min(polar.rings, Math.round(distance / polar.spacing));
  const radius = ring * polar.spacing;
  if (radius === 0) return polar.center;
  const step = 360 / polar.spokes;
  const raw = angleFromCenter(polar.center, point);
  const angle = polar.startAngle + Math.round((raw - polar.startAngle) / step) * step;
  const direction = directionOf(angle);
  return { x: polar.center.x + direction.x * radius, y: polar.center.y + direction.y * radius };
}

/**
 * What another stitch offers to snap to: its middle, and the two ends of its
 * own upright axis, so stitches stack the way they are crocheted.
 */
export function itemAnchors(item: IrregularItem): Point[] {
  const radians = (item.rotation * Math.PI) / 180;
  const half = item.height / 2;
  const [dx, dy] = [Math.sin(radians) * half, Math.cos(radians) * half];
  return [
    { x: item.x, y: item.y },
    { x: item.x + dx, y: item.y - dy },
    { x: item.x - dx, y: item.y + dy },
  ];
}

/**
 * The nearest snap target, or the point untouched.
 *
 * A visible guide is a lattice: every point has a crossing, so it always takes
 * the stitch — otherwise a wide grid would catch some clicks and drop others.
 * A neighbouring stitch is a single point, so it only takes the stitch from
 * within `tolerance`, and then only if it is nearer than the guide. The
 * tolerance is in chart units, so the caller divides the screen distance by the
 * zoom and snapping feels the same however far in you are.
 */
export interface SnapOptions {
  /** How near a single point has to be, in chart units, to take the stitch. */
  readonly tolerance: number;
  /** The stitches being dragged: they do not snap to themselves. */
  readonly skip?: ReadonlySet<string>;
  /** False when the grid is on but too fine to be drawn at this zoom. */
  readonly gridDrawn?: boolean;
}

export function snapPoint(pattern: IrregularPattern, point: Point, options: SnapOptions): Point {
  if (!pattern.guides.snap) return point;
  const { tolerance, skip } = options;
  let best = point;
  let nearest = Number.POSITIVE_INFINITY;
  const offer = (candidate: Point, reach: number): void => {
    const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
    if (distance < nearest && distance <= reach) {
      best = candidate;
      nearest = distance;
    }
  };
  const { grid, polar } = pattern.guides;
  if (grid.visible && (options.gridDrawn ?? true)) {
    const crossing = { x: Math.round(point.x / grid.size) * grid.size, y: Math.round(point.y / grid.size) * grid.size };
    offer(crossing, Number.POSITIVE_INFINITY);
  }
  if (polar.visible) offer(polarPoint(polar, point), Number.POSITIVE_INFINITY);
  for (const item of pattern.items) {
    if (skip?.has(item.id) === true || !isVisible(pattern, item)) continue;
    for (const anchor of itemAnchors(item)) offer(anchor, tolerance);
  }
  return best;
}

/** How far a stitch turns so its top points away from the middle of the circle guide. */
export function radialRotation(polar: PolarGuide, point: Point): number {
  return angleFromCenter(polar.center, point);
}
