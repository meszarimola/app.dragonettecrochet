// The stitch order within one row of the free-form chart. KB: core-geometry §29

import { rowById } from './irregular-document.ts';
import {
  type IrregularItem,
  type IrregularPattern,
  type IrregularRow,
  isStitch,
  type Point,
  type RowDirection,
} from './irregular-types.ts';

const TURN = Math.PI * 2;

/** Annotations sit on a row but are not worked, so they are not in its order. */
function rowItems(pattern: IrregularPattern, rowId: string): IrregularItem[] {
  return pattern.items.filter((item) => isStitch(item) && item.rowId === rowId);
}

/** The centre of the round is the centre of its own stitches. */
function centreOf(items: readonly IrregularItem[]): Point {
  const total = items.reduce((sum, item) => ({ x: sum.x + item.x, y: sum.y + item.y }), { x: 0, y: 0 });
  return { x: total.x / items.length, y: total.y / items.length };
}

/**
 * The angle from 12 o'clock, growing the way the round runs. The y axis points
 * down, so a stitch above the centre has a negative `dy` and `-dy` is its rise.
 */
function roundAngle(item: IrregularItem, centre: Point, direction: RowDirection): number {
  const dx = item.x - centre.x;
  const dy = item.y - centre.y;
  const across = direction === 'ccw' ? -dx : dx;
  const angle = Math.atan2(across, -dy);
  return angle < 0 ? angle + TURN : angle;
}

interface Placed {
  readonly id: string;
  readonly key: number;
  readonly x: number;
  readonly y: number;
  readonly index: number;
}

function automaticOrder(pattern: IrregularPattern, row: IrregularRow): string[] {
  const items = rowItems(pattern, row.id);
  if (items.length === 0) return [];
  const centre = row.kind === 'round' ? centreOf(items) : null;
  const placed: Placed[] = items.map((item, index) => ({
    id: item.id,
    key: centre === null ? (row.direction === 'rtl' ? -item.x : item.x) : roundAngle(item, centre, row.direction),
    x: item.x,
    y: item.y,
    index,
  }));
  // Stitches that coincide fall back on the order they were drawn in, so the order is total.
  placed.sort((a, b) => a.key - b.key || a.y - b.y || a.x - b.x || a.index - b.index);
  return placed.map((entry) => entry.id);
}

/**
 * Where a stitch missing from the explicit order belongs: right after the
 * nearest earlier stitch of the automatic order that the explicit order holds,
 * or before the nearest later one when there is nothing earlier.
 */
function insertionPoint(automatic: readonly string[], place: number, result: readonly string[]): number {
  for (let earlier = place - 1; earlier >= 0; earlier -= 1) {
    const at = result.indexOf(automatic[earlier]);
    if (at >= 0) return at + 1;
  }
  for (let later = place + 1; later < automatic.length; later += 1) {
    const at = result.indexOf(automatic[later]);
    if (at >= 0) return at;
  }
  return result.length;
}

function merge(automatic: readonly string[], explicit: readonly string[]): string[] {
  const inRow = new Set(automatic);
  const taken = new Set<string>();
  const result: string[] = [];
  for (const id of explicit) {
    if (!inRow.has(id) || taken.has(id)) continue;
    taken.add(id);
    result.push(id);
  }
  for (const [place, id] of automatic.entries()) {
    if (taken.has(id)) continue;
    taken.add(id);
    result.splice(insertionPoint(automatic, place, result), 0, id);
  }
  return result;
}

export function rowOrder(pattern: IrregularPattern, rowId: string): string[] {
  const row = rowById(pattern, rowId);
  if (row === undefined) return [];
  const automatic = automaticOrder(pattern, row);
  const explicit = row.order;
  if (explicit === undefined || explicit === 'auto') return automatic;
  return merge(automatic, explicit);
}

export function isManualOrder(pattern: IrregularPattern, rowId: string): boolean {
  const order = rowById(pattern, rowId)?.order;
  return order !== undefined && order !== 'auto';
}

export function orderPosition(pattern: IrregularPattern, rowId: string, itemId: string): number | null {
  const place = rowOrder(pattern, rowId).indexOf(itemId);
  return place < 0 ? null : place + 1;
}

function sameOrder(current: IrregularRow['order'], next: readonly string[]): boolean {
  if (current === undefined || current === 'auto') return false;
  return current.length === next.length && current.every((id, place) => id === next[place]);
}

function withOrder(pattern: IrregularPattern, rowId: string, order: readonly string[]): IrregularPattern {
  return {
    ...pattern,
    rows: pattern.rows.map((row) => (row.id === rowId ? { ...row, order } : row)),
  };
}

export function setManualOrder(pattern: IrregularPattern, rowId: string, ids: readonly string[]): IrregularPattern {
  const row = rowById(pattern, rowId);
  if (row === undefined) return pattern;
  const order = [...ids];
  if (sameOrder(row.order, order)) return pattern;
  return withOrder(pattern, rowId, order);
}

export function resetOrder(pattern: IrregularPattern, rowId: string): IrregularPattern {
  const row = rowById(pattern, rowId);
  if (row === undefined || row.order === undefined) return pattern;
  return {
    ...pattern,
    rows: pattern.rows.map((candidate) => {
      if (candidate.id !== rowId) return candidate;
      const { order: _order, ...rest } = candidate;
      return rest;
    }),
  };
}

function placeAt(
  pattern: IrregularPattern,
  rowId: string,
  current: readonly string[],
  from: number,
  to: number,
): IrregularPattern {
  const target = Math.min(Math.max(to, 0), current.length - 1);
  if (target === from) return pattern;
  const next = [...current];
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return withOrder(pattern, rowId, next);
}

export function moveInOrder(pattern: IrregularPattern, rowId: string, itemId: string, delta: number): IrregularPattern {
  const current = rowOrder(pattern, rowId);
  const place = current.indexOf(itemId);
  if (place < 0) return pattern;
  return placeAt(pattern, rowId, current, place, place + delta);
}

export function setOrderPosition(
  pattern: IrregularPattern,
  rowId: string,
  itemId: string,
  position: number,
): IrregularPattern {
  const current = rowOrder(pattern, rowId);
  const place = current.indexOf(itemId);
  if (place < 0) return pattern;
  return placeAt(pattern, rowId, current, place, Math.round(position) - 1);
}
