// Copying stitches around a centre: the circular repeat of the free-form chart.

import { itemsOf, nextId, normalizeAngle } from './irregular-document.ts';
import type { IrregularItem, IrregularPattern, Point } from './irregular-types.ts';

export interface RepeatSpec {
  readonly center: Point;
  /** Total copies including the original. */
  readonly count: number;
  /** The arc the copies spread over, in degrees. 360 closes the circle. */
  readonly range: number;
}

export interface RepeatResult {
  readonly pattern: IrregularPattern;
  /** The ids of the new copies, in the order they were made. */
  readonly ids: readonly string[];
}

export const REPEAT_COUNT_RANGE: { readonly min: number; readonly max: number } = { min: 2, max: 64 };
export const REPEAT_RANGE_LIMITS: { readonly min: number; readonly max: number } = { min: 1, max: 360 };

/** Fewer than the smallest count is the original standing alone, which is nothing to copy. */
function copyCount(count: number): number {
  if (!Number.isFinite(count)) return 1;
  const whole = Math.round(count);
  if (whole < REPEAT_COUNT_RANGE.min) return 1;
  return Math.min(REPEAT_COUNT_RANGE.max, whole);
}

function isFinitePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

/** The angles the copies are turned by, not counting the original's zero. */
export function repeatAngles(spec: RepeatSpec): number[] {
  const copies = copyCount(spec.count);
  if (copies < REPEAT_COUNT_RANGE.min || !Number.isFinite(spec.range)) return [];
  const range = Math.min(REPEAT_RANGE_LIMITS.max, Math.max(REPEAT_RANGE_LIMITS.min, spec.range));
  // A full circle divides by the copies, so the last one stops a step short of
  // the original; a shorter arc divides by the gaps, so it ends on the arc's end.
  const step = range === REPEAT_RANGE_LIMITS.max ? range / copies : range / (copies - 1);
  return Array.from({ length: copies - 1 }, (_, index) => normalizeAngle(step * (index + 1)));
}

/**
 * Copies the given items around the centre. Returns the same pattern when there
 * is nothing to do. Each copy turns with its place, so a stitch that pointed
 * away from the centre still does. A copy of a group member is a plain stitch:
 * a turned recipe is a new recipe, and a group gains no member from a repeat.
 */
export function circularRepeat(pattern: IrregularPattern, ids: ReadonlySet<string>, spec: RepeatSpec): RepeatResult {
  const angles = repeatAngles(spec);
  const chosen = itemsOf(pattern, ids);
  if (angles.length === 0 || chosen.length === 0 || !isFinitePoint(spec.center)) return { pattern, ids: [] };
  const { center } = spec;
  const taken = pattern.items.map((item) => item.id);
  const copies: IrregularItem[] = [];
  const made: string[] = [];
  for (const angle of angles) {
    const radians = (angle * Math.PI) / 180;
    const [cos, sin] = [Math.cos(radians), Math.sin(radians)];
    for (const item of chosen) {
      const id = nextId('i', [...taken, ...made]);
      made.push(id);
      const [dx, dy] = [item.x - center.x, item.y - center.y];
      copies.push({
        ...item,
        id,
        rotation: normalizeAngle(item.rotation + angle),
        x: center.x + dx * cos - dy * sin,
        y: center.y + dx * sin + dy * cos,
      });
    }
  }
  return { pattern: { ...pattern, items: [...pattern.items, ...copies] }, ids: made };
}
