// The geometry of a fan: where each stitch of a fan group sits and how big it is drawn.

import { normalizeAngle } from './irregular-document.ts';
import { directionOf } from './irregular-snap.ts';
import type { FanGroup, GlyphSize, MemberShape, Point } from './irregular-types.ts';

/** In `converge` the stitches hang the other way round from the shared point. */
const CONVERGE_TURN = 180;

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function finitePoint(point: Point): Point {
  return { x: finite(point.x, 0), y: finite(point.y, 0) };
}

function memberCount(count: number): number {
  return Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
}

/**
 * The angle of every ray, in stable order from one outer stitch to the other.
 * A single stitch takes the fan's own direction.
 */
export function fanAngles(group: Pick<FanGroup, 'direction' | 'spreadAngle' | 'count'>): number[] {
  const count = memberCount(group.count);
  const direction = finite(group.direction, 0);
  const spread = finite(group.spreadAngle, 0);
  if (count === 1) return [normalizeAngle(direction)];
  const step = count > 1 ? spread / (count - 1) : 0;
  return Array.from({ length: count }, (_, index) => normalizeAngle(direction - spread / 2 + index * step));
}

/** A stitch stretched to `length` keeps the glyph's proportions; a glyph that cannot be scaled keeps its own size. */
export function memberSize(glyph: GlyphSize, length: number): Pick<MemberShape, 'width' | 'height'> {
  const width = finite(glyph.width, 0);
  const height = finite(glyph.height, 0);
  const stretched = finite(length, 0);
  // A glyph with no height of its own has no proportions to keep, but a stitch
  // with no height cannot be seen: the length still decides how tall it is.
  if (height <= 0) return { width, height: stretched };
  return { width: width * (stretched / height), height: stretched };
}

/**
 * Where the members of a fan sit. In `spread` every base point is `origin`; in
 * `converge` every top point is, and the bases lie a `length` away around it.
 */
export function fanShapes(
  group: Pick<FanGroup, 'mode' | 'origin' | 'direction' | 'spreadAngle' | 'length' | 'count'>,
  glyph: GlyphSize,
): MemberShape[] {
  const origin = finitePoint(group.origin);
  const length = finite(group.length, 0);
  const size = memberSize(glyph, length);
  const turn = group.mode === 'converge' ? CONVERGE_TURN : 0;
  return fanAngles(group).map((angle) => {
    const along = directionOf(angle);
    return {
      at: { x: origin.x + along.x * (length / 2), y: origin.y + along.y * (length / 2) },
      rotation: normalizeAngle(angle + turn),
      width: size.width,
      height: size.height,
    };
  });
}
