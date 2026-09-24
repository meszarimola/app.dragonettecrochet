// The geometry of a granny square round. KB: core-geometry §55

import { normalizeAngle } from './irregular-document.ts';
import type { GlyphSize, GrannyRoundGroup, MemberShape, Point } from './irregular-types.ts';

const CORNER_TOLERANCE = 1e-6;

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function memberCount(count: number): number {
  return Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
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
  const corner = offset < CORNER_TOLERANCE * Math.max(1, side) || side - offset < CORNER_TOLERANCE * Math.max(1, side);
  const at: Point = [
    { x: -half + offset, y: -half },
    { x: half, y: -half + offset },
    { x: half - offset, y: half },
    { x: -half, y: half - offset },
  ][index] ?? { x: 0, y: 0 };
  if (!corner) return { at, angle: index * 90 };
  const atCorner = side - offset < CORNER_TOLERANCE * Math.max(1, side) ? index + 1 : index;
  const cornerPoint: Point =
    [
      { x: -half, y: -half },
      { x: half, y: -half },
      { x: half, y: half },
      { x: -half, y: half },
    ][atCorner % 4] ?? at;
  return { at: cornerPoint, angle: normalizeAngle(atCorner * 90 - 45) };
}

/**
 * Where the stitches of a granny round sit. Each keeps its glyph's natural size,
 * so no stitch is ever stretched to fill the square; only the gaps between them
 * change with the count.
 */
export function grannyShapes(
  group: Pick<GrannyRoundGroup, 'center' | 'inner' | 'count' | 'radial'>,
  glyph: GlyphSize,
): MemberShape[] {
  const count = memberCount(group.count);
  if (count === 0) return [];
  const width = finite(glyph.width, 0);
  const height = finite(glyph.height, 0);
  const center = { x: finite(group.center.x, 0), y: finite(group.center.y, 0) };
  const half = Math.max(0, finite(group.inner, 0)) + height / 2;
  const step = (8 * half) / count;
  return Array.from({ length: count }, (_, index) => {
    const stop = squareStop(half, index * step);
    return {
      at: { x: center.x + stop.at.x, y: center.y + stop.at.y },
      rotation: group.radial ? stop.angle : 0,
      width,
      height,
    };
  });
}

/** Where the next round starts: one natural stitch height outside this one. */
export function grannyOuter(group: Pick<GrannyRoundGroup, 'inner'>, glyph: GlyphSize): number {
  return Math.max(0, finite(group.inner, 0)) + Math.max(0, finite(glyph.height, 0));
}

/**
 * The background of one round, as the round generator's chart drew it: a square
 * band between the round's base and its top, and one cell per stitch, split by
 * a line halfway between two stitches. KB: core-geometry §56
 */
export interface GrannyBand {
  readonly tone: 0 | 1;
  readonly outer: readonly Point[];
  /** Absent for the first round, whose band reaches the centre. */
  readonly inner: readonly Point[] | null;
  readonly dividers: readonly (readonly [Point, Point])[];
}

function squareCorners(center: Point, half: number): Point[] {
  return [
    { x: center.x - half, y: center.y - half },
    { x: center.x + half, y: center.y - half },
    { x: center.x + half, y: center.y + half },
    { x: center.x - half, y: center.y + half },
  ];
}

export function grannyBand(
  group: Pick<GrannyRoundGroup, 'center' | 'inner' | 'count'>,
  glyph: GlyphSize,
  tone: 0 | 1,
): GrannyBand {
  const center = { x: finite(group.center.x, 0), y: finite(group.center.y, 0) };
  const inner = Math.max(0, finite(group.inner, 0));
  const outer = grannyOuter(group, glyph);
  const count = memberCount(group.count);
  const on = (half: number, share: number): Point => {
    if (half <= 0) return center;
    const stop = squareStop(half, share * 8 * half);
    return { x: center.x + stop.at.x, y: center.y + stop.at.y };
  };
  const dividers: (readonly [Point, Point])[] =
    count < 2
      ? []
      : Array.from({ length: count }, (_, index) => {
          const share = (index + 0.5) / count;
          return [on(inner, share), on(outer, share)] as const;
        });
  return {
    tone,
    outer: squareCorners(center, outer),
    inner: inner > 0 ? squareCorners(center, inner) : null,
    dividers,
  };
}
