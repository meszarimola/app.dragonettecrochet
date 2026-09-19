// Row and round operations on the free-form chart. KB: core-geometry §29

import { nextId } from './irregular-document.ts';
import type { IrregularItem, IrregularPattern, IrregularRow, RowDirection, RowKind } from './irregular-types.ts';

export type RowPatch = Partial<Pick<IrregularRow, 'kind' | 'direction' | 'color' | 'visible' | 'locked'>>;

const ROW_WAYS: readonly RowDirection[] = ['ltr', 'rtl'];
const ROUND_WAYS: readonly RowDirection[] = ['cw', 'ccw'];

/** Changing the kind carries the direction with it: a round has no left to right. */
function directionFor(kind: RowKind, direction: RowDirection): RowDirection {
  const allowed = kind === 'round' ? ROUND_WAYS : ROW_WAYS;
  if (allowed.includes(direction)) return direction;
  return kind === 'round' ? 'ccw' : 'ltr';
}

export type RowStitches = 'delete' | 'move';

/** A row's number is its place in the list, so nothing stores it. */
export function rowNumber(pattern: IrregularPattern, rowId: string): number {
  return pattern.rows.findIndex((row) => row.id === rowId) + 1;
}

export function itemsOfRow(pattern: IrregularPattern, rowId: string): IrregularItem[] {
  return pattern.items.filter((item) => item.rowId === rowId);
}

export function addRow(pattern: IrregularPattern, kind?: RowKind): { pattern: IrregularPattern; id: string } {
  return insertRowAt(pattern, pattern.rows.length, kind);
}

export function insertRowAfterActive(
  pattern: IrregularPattern,
  kind?: RowKind,
): { pattern: IrregularPattern; id: string } {
  const active = pattern.rows.findIndex((row) => row.id === pattern.activeRowId);
  return insertRowAt(pattern, active < 0 ? pattern.rows.length : active + 1, kind);
}

export function deleteRow(pattern: IrregularPattern, rowId: string, stitches: RowStitches): IrregularPattern {
  const index = pattern.rows.findIndex((row) => row.id === rowId);
  if (index < 0 || pattern.rows.length < 2) return pattern;
  const neighbour = pattern.rows[index > 0 ? index - 1 : index + 1];
  if (neighbour === undefined) return pattern;
  const items =
    stitches === 'move'
      ? pattern.items.map((item) => (item.rowId === rowId ? { ...item, rowId: neighbour.id } : item))
      : pattern.items.filter((item) => item.rowId !== rowId);
  const rows = pattern.rows.filter((row) => row.id !== rowId);
  return {
    ...pattern,
    rows: withTidyOrders(rows, items),
    items,
    activeRowId: pattern.activeRowId === rowId ? neighbour.id : pattern.activeRowId,
  };
}

export function reorderRows(pattern: IrregularPattern, rowId: string, toIndex: number): IrregularPattern {
  const from = pattern.rows.findIndex((row) => row.id === rowId);
  const moved = pattern.rows[from];
  if (moved === undefined) return pattern;
  const to = Math.min(Math.max(Math.trunc(toIndex), 0), pattern.rows.length - 1);
  if (to === from) return pattern;
  const rest = pattern.rows.filter((_, index) => index !== from);
  return { ...pattern, rows: [...rest.slice(0, to), moved, ...rest.slice(to)] };
}

export function setActiveRow(pattern: IrregularPattern, rowId: string): IrregularPattern {
  if (rowId === pattern.activeRowId) return pattern;
  if (!pattern.rows.some((row) => row.id === rowId)) return pattern;
  return { ...pattern, activeRowId: rowId };
}

export function updateRow(pattern: IrregularPattern, rowId: string, patch: RowPatch): IrregularPattern {
  const current = pattern.rows.find((row) => row.id === rowId);
  if (current === undefined) return pattern;
  const merged = { ...current, ...patch };
  const next: IrregularRow = { ...merged, direction: directionFor(merged.kind, merged.direction) };
  if (
    next.kind === current.kind &&
    next.direction === current.direction &&
    next.color === current.color &&
    next.visible === current.visible &&
    next.locked === current.locked
  ) {
    return pattern;
  }
  return { ...pattern, rows: pattern.rows.map((row) => (row.id === rowId ? next : row)) };
}

export function moveItemsToRow(pattern: IrregularPattern, ids: Iterable<string>, rowId: string): IrregularPattern {
  const chosen = new Set(ids);
  if (chosen.size === 0 || !pattern.rows.some((row) => row.id === rowId)) return pattern;
  let moved = false;
  const items = pattern.items.map((item) => {
    if (!chosen.has(item.id) || item.rowId === rowId) return item;
    moved = true;
    return { ...item, rowId };
  });
  if (!moved) return pattern;
  return { ...pattern, rows: withTidyOrders(pattern.rows, items), items };
}

function insertRowAt(
  pattern: IrregularPattern,
  at: number,
  kind: RowKind | undefined,
): { pattern: IrregularPattern; id: string } {
  const id = nextId(
    'r',
    pattern.rows.map((row) => row.id),
  );
  const before = pattern.rows.slice(0, at);
  const previous = before[before.length - 1];
  const chosen = kind ?? previous?.kind ?? 'row';
  const row: IrregularRow = {
    id,
    kind: chosen,
    direction: directionAfter(before, chosen),
    color: null,
    visible: true,
    locked: false,
  };
  return { pattern: { ...pattern, rows: [...before, row, ...pattern.rows.slice(at)] }, id };
}

/** A row turns the work over; a round keeps going the way the rounds before it went. */
function directionAfter(before: readonly IrregularRow[], kind: RowKind): RowDirection {
  for (let index = before.length - 1; index >= 0; index -= 1) {
    const row = before[index];
    if (row === undefined || row.kind !== kind) continue;
    if (kind === 'round') return row.direction;
    return row.direction === 'rtl' ? 'ltr' : 'rtl';
  }
  return kind === 'round' ? 'ccw' : 'ltr';
}

/**
 * An explicit order names the stitches of its own row and no others, so ids that
 * left are dropped and ids that arrived join at the end. Rows left on `auto`
 * read their order off the positions elsewhere.
 */
function withTidyOrders(rows: readonly IrregularRow[], items: readonly IrregularItem[]): readonly IrregularRow[] {
  let changed = false;
  const tidied = rows.map((row) => {
    const order = row.order;
    if (order === undefined || order === 'auto') return row;
    const own = items.filter((item) => item.rowId === row.id).map((item) => item.id);
    const kept = order.filter((id) => own.includes(id));
    const arrived = own.filter((id) => !kept.includes(id));
    if (kept.length === order.length && arrived.length === 0) return row;
    changed = true;
    return { ...row, order: [...kept, ...arrived] };
  });
  return changed ? tidied : rows;
}
