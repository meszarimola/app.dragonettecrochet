// The shape a row sits on, and moving whole rows about. KB: core-geometry §29

import { type Box, itemBox, rowById, unionBox } from './irregular-document.ts';
import { itemsOfRow } from './irregular-rows.ts';
import { type IrregularPattern, type IrregularRow, isStitch, type Point, type RowLine } from './irregular-types.ts';

const MIN_RADIUS = 1;
const ORIGIN: Point = { x: 0, y: 0 };

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function finitePoint(point: Point): Point {
  return { x: finite(point.x), y: finite(point.y) };
}

function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

function shiftPoint(point: Point, shift: Point): Point {
  return { x: point.x + shift.x, y: point.y + shift.y };
}

/** With y growing downward this unit vector points to the left of start → end. */
function leftNormal(start: Point, end: Point): Point | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length === 0) return null;
  return { x: dy / length, y: -dx / length };
}

function chordMiddle(start: Point, end: Point): Point {
  const from = finitePoint(start);
  const to = finitePoint(end);
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
}

export function rowLine(pattern: IrregularPattern, rowId: string): RowLine | undefined {
  return rowById(pattern, rowId)?.line;
}

/** Puts a shape on a row, or takes it off. Returns the same pattern when nothing changes. */
export function setRowLine(pattern: IrregularPattern, rowId: string, line: RowLine | null): IrregularPattern {
  const row = rowById(pattern, rowId);
  if (row === undefined) return pattern;
  const current = row.line;
  if (line === null) {
    if (current === undefined) return pattern;
    const { line: _dropped, ...rest } = row;
    return withRow(pattern, rest);
  }
  if (current !== undefined && sameLine(current, line)) return pattern;
  return withRow(pattern, { ...row, line });
}

/** Moves a row's shape by an offset, for dragging a row line on the canvas. */
export function moveRowLine(pattern: IrregularPattern, rowId: string, dx: number, dy: number): IrregularPattern {
  const row = rowById(pattern, rowId);
  const line = row?.line;
  if (row === undefined || line === undefined || row.locked) return pattern;
  const shift: Point = { x: finite(dx), y: finite(dy) };
  if (shift.x === 0 && shift.y === 0) return pattern;
  return withRow(pattern, { ...row, line: shiftedLine(line, shift) });
}

/** Every item of a row, plus the row's line, moved together. */
export function moveRow(pattern: IrregularPattern, rowId: string, dx: number, dy: number): IrregularPattern {
  const row = rowById(pattern, rowId);
  if (row === undefined || row.locked) return pattern;
  return applyMoves(pattern, [{ rowId: row.id, shift: { x: finite(dx), y: finite(dy) } }]);
}

/** How far apart two shapes stand, measured the way even spacing moves them. */
export function lineOffset(line: RowLine, distance: number): RowLine {
  const step = finite(distance);
  if (step === 0) return line;
  if (line.shape === 'circle') {
    const radius = Math.max(0, finite(line.radius) + step);
    return radius === line.radius ? line : { ...line, radius };
  }
  const normal = leftNormal(line.start, line.end);
  if (normal === null) return line;
  return shiftedLine(line, { x: normal.x * step, y: normal.y * step });
}

export type RowSpacingCode = 'no-rows' | 'round-without-line' | 'nothing-to-move';

export interface RowSpacingResult {
  readonly pattern: IrregularPattern;
  /** The rows that could not be moved, with the reason, for the interface to word. */
  readonly skipped: readonly { readonly rowId: string; readonly code: RowSpacingCode }[];
}

/**
 * Places the given rows `spacing` apart in row order, their stitches moving with
 * them. The first row given stays put and the rest step away from it.
 */
export function spaceRows(pattern: IrregularPattern, rowIds: readonly string[], spacing: number): RowSpacingResult {
  const chosen = rowsInOrder(pattern, rowIds);
  const anchor = chosen[0];
  if (anchor === undefined || chosen.length < 2) {
    return { pattern, skipped: [{ rowId: anchor?.id ?? '', code: 'no-rows' }] };
  }
  const following = chosen.slice(1);
  if (!Number.isFinite(spacing)) {
    const stalled: RowSpacingResult['skipped'] = following.map((row) => ({ rowId: row.id, code: 'nothing-to-move' }));
    return { pattern, skipped: stalled };
  }
  const reference = referenceOf(pattern, anchor);
  const moves: RowMove[] = [];
  const skipped: { rowId: string; code: RowSpacingCode }[] = [];
  let previous = rowBox(pattern, anchor);
  let placed = 0;
  for (const row of following) {
    const line = row.line;
    if (row.locked || (line === undefined && itemsOfRow(pattern, row.id).filter(isStitch).length === 0)) {
      skipped.push({ rowId: row.id, code: 'nothing-to-move' });
      continue;
    }
    if (line === undefined && row.kind === 'round') {
      skipped.push({ rowId: row.id, code: 'round-without-line' });
      continue;
    }
    const move =
      line === undefined
        ? boxMove(pattern, row, previous, spacing)
        : lineMove(row, line, reference, (placed + 1) * spacing);
    if (move === null) {
      skipped.push({ rowId: row.id, code: 'nothing-to-move' });
      continue;
    }
    moves.push(move);
    previous = movedBox(pattern, row, move);
    placed += 1;
  }
  return { pattern: applyMoves(pattern, moves), skipped };
}

export type RowAlign = 'start' | 'center' | 'end' | 'concentric';

/** Aligns the given rows at their start, middle or end, or makes rounds concentric. */
export function alignRows(pattern: IrregularPattern, rowIds: readonly string[], mode: RowAlign): IrregularPattern {
  const chosen = rowsInOrder(pattern, rowIds);
  if (chosen.length < 2) return pattern;
  if (mode === 'concentric') return concentric(pattern, chosen);
  const boxes = new Map<string, Box>();
  for (const row of chosen) {
    const box = rowBox(pattern, row);
    if (box !== null) boxes.set(row.id, box);
  }
  const total = unionBox([...boxes.values()]);
  if (total === null) return pattern;
  const moves: RowMove[] = [];
  for (const row of chosen) {
    const box = boxes.get(row.id);
    if (row.locked || box === undefined) continue;
    moves.push({ rowId: row.id, shift: { x: alignShift(mode, box, total), y: 0 } });
  }
  return applyMoves(pattern, moves);
}

function alignShift(mode: Exclude<RowAlign, 'concentric'>, own: Box, total: Box): number {
  switch (mode) {
    case 'start':
      return total.minX - own.minX;
    case 'end':
      return total.maxX - own.maxX;
    case 'center':
      return (total.minX + total.maxX) / 2 - (own.minX + own.maxX) / 2;
  }
}

function concentric(pattern: IrregularPattern, chosen: readonly IrregularRow[]): IrregularPattern {
  const rounds = chosen.filter((row) => row.kind === 'round');
  const first = rounds[0];
  if (first === undefined) return pattern;
  const target = roundCentre(pattern, first);
  if (target === null) return pattern;
  const moves: RowMove[] = [];
  for (const row of rounds.slice(1)) {
    const centre = roundCentre(pattern, row);
    if (row.locked || centre === null) continue;
    moves.push({ rowId: row.id, shift: { x: target.x - centre.x, y: target.y - centre.y } });
  }
  return applyMoves(pattern, moves);
}

/** A round is centred on its circle when it has one, and on its own extent otherwise. */
function roundCentre(pattern: IrregularPattern, row: IrregularRow): Point | null {
  const line = row.line;
  if (line !== undefined && line.shape === 'circle') return finitePoint(line.center);
  const box = rowBox(pattern, row);
  if (box === null) return null;
  return { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
}

function rowsInOrder(pattern: IrregularPattern, rowIds: readonly string[]): IrregularRow[] {
  const wanted = new Set(rowIds);
  return pattern.rows.filter((row) => wanted.has(row.id));
}

/** What the rows that follow measure their distance from. */
interface Reference {
  readonly at: Point;
  /** The circle the rounds that follow become concentric with, when the first row has one. */
  readonly circle: { readonly center: Point; readonly radius: number } | null;
  /**
   * The one direction every row steps along. Each row's own left normal would
   * point the other way on a turned row, and flat crochet turns every row, so
   * the rows would land on alternating sides of the first one.
   */
  readonly normal: Point | null;
}

function referenceOf(pattern: IrregularPattern, anchor: IrregularRow): Reference {
  const line = anchor.line;
  if (line !== undefined) {
    if (line.shape === 'circle') {
      const center = finitePoint(line.center);
      return { at: center, circle: { center, radius: positiveRadius(line.radius) }, normal: null };
    }
    return { at: chordMiddle(line.start, line.end), circle: null, normal: leftNormal(line.start, line.end) };
  }
  const box = rowBox(pattern, anchor);
  if (box === null) return { at: ORIGIN, circle: null, normal: null };
  return {
    at: { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 },
    circle: null,
    normal: null,
  };
}

/** The file refuses a radius of zero, so a shrinking circle stops just short of it. */
function positiveRadius(radius: number): number {
  return Math.max(MIN_RADIUS, finite(radius));
}

function lineMove(row: IrregularRow, line: RowLine, reference: Reference, target: number): RowMove | null {
  if (line.shape === 'circle') {
    const circle = reference.circle;
    const center = finitePoint(line.center);
    if (circle === null) {
      return {
        rowId: row.id,
        shift: ORIGIN,
        line: { ...line, center, radius: positiveRadius(finite(line.radius) + target) },
      };
    }
    return {
      rowId: row.id,
      shift: { x: circle.center.x - center.x, y: circle.center.y - center.y },
      line: { ...line, center: circle.center, radius: positiveRadius(circle.radius + target) },
    };
  }
  // A shape nobody can read has no place to go, whatever the reference says.
  const own = leftNormal(line.start, line.end);
  if (own === null) return null;
  // The reference decides the direction; a turned row must not step the other way.
  const normal = reference.normal ?? own;
  const middle = chordMiddle(line.start, line.end);
  const stands = (middle.x - reference.at.x) * normal.x + (middle.y - reference.at.y) * normal.y;
  const delta = target - stands;
  return { rowId: row.id, shift: { x: normal.x * delta, y: normal.y * delta } };
}

function boxMove(pattern: IrregularPattern, row: IrregularRow, previous: Box | null, step: number): RowMove | null {
  const own = rowBox(pattern, row);
  if (own === null || previous === null) return null;
  return { rowId: row.id, shift: { x: 0, y: previous.maxY + step - own.minY } };
}

interface RowMove {
  readonly rowId: string;
  readonly shift: Point;
  /** The shape the row ends up on, where the move changed more than its place. */
  readonly line?: RowLine;
}

/**
 * One pass over the pattern for a whole set of row moves, so a row that ends up
 * where it started leaves the pattern — and the editor's undo stack — untouched.
 */
function applyMoves(pattern: IrregularPattern, moves: readonly RowMove[]): IrregularPattern {
  const shifts = new Map<string, Point>();
  const lines = new Map<string, RowLine>();
  for (const move of moves) {
    const row = rowById(pattern, move.rowId);
    if (row === undefined) continue;
    const current = row.line;
    const next = move.line ?? (current === undefined ? undefined : shiftedLine(current, move.shift));
    if (next !== undefined && (current === undefined || !sameLine(current, next))) lines.set(row.id, next);
    if (move.shift.x !== 0 || move.shift.y !== 0) shifts.set(row.id, move.shift);
  }
  if (lines.size === 0 && shifts.size === 0) return pattern;
  let stirred = false;
  const items = pattern.items.map((item) => {
    const shift = shifts.get(item.rowId);
    if (shift === undefined) return item;
    stirred = true;
    return { ...item, x: item.x + shift.x, y: item.y + shift.y };
  });
  if (lines.size === 0 && !stirred) return pattern;
  const rows =
    lines.size === 0
      ? pattern.rows
      : pattern.rows.map((row) => {
          const line = lines.get(row.id);
          return line === undefined ? row : { ...row, line };
        });
  return { ...pattern, rows, items: stirred ? items : pattern.items };
}

function withRow(pattern: IrregularPattern, next: IrregularRow): IrregularPattern {
  return { ...pattern, rows: pattern.rows.map((row) => (row.id === next.id ? next : row)) };
}

function shiftedLine(line: RowLine, shift: Point): RowLine {
  if (shift.x === 0 && shift.y === 0) return line;
  if (line.shape === 'circle') return { ...line, center: shiftPoint(line.center, shift) };
  return { ...line, start: shiftPoint(line.start, shift), end: shiftPoint(line.end, shift) };
}

function sameLine(a: RowLine, b: RowLine): boolean {
  if (a.side !== b.side || a.perpendicular !== b.perpendicular) return false;
  if (a.shape === 'circle' || b.shape === 'circle') {
    return (
      a.shape === 'circle' &&
      b.shape === 'circle' &&
      samePoint(a.center, b.center) &&
      a.radius === b.radius &&
      a.startAngle === b.startAngle
    );
  }
  if (!samePoint(a.start, b.start) || !samePoint(a.end, b.end)) return false;
  if (a.shape === 'arc' || b.shape === 'arc') return a.shape === 'arc' && b.shape === 'arc' && a.bulge === b.bulge;
  return true;
}

/** The upright box around a line, taking an arc through its middle. */
function lineBox(line: RowLine): Box {
  if (line.shape === 'circle') {
    const center = finitePoint(line.center);
    const radius = Math.abs(finite(line.radius));
    return { minX: center.x - radius, minY: center.y - radius, maxX: center.x + radius, maxY: center.y + radius };
  }
  const corners = [finitePoint(line.start), finitePoint(line.end)];
  if (line.shape === 'arc') {
    const normal = leftNormal(line.start, line.end);
    const middle = chordMiddle(line.start, line.end);
    const bulge = finite(line.bulge);
    if (normal !== null) corners.push({ x: middle.x + normal.x * bulge, y: middle.y + normal.y * bulge });
  }
  return {
    minX: Math.min(...corners.map((corner) => corner.x)),
    minY: Math.min(...corners.map((corner) => corner.y)),
    maxX: Math.max(...corners.map((corner) => corner.x)),
    maxY: Math.max(...corners.map((corner) => corner.y)),
  };
}

function shiftedBox(box: Box, shift: Point): Box {
  return {
    minX: box.minX + shift.x,
    minY: box.minY + shift.y,
    maxX: box.maxX + shift.x,
    maxY: box.maxY + shift.y,
  };
}

/** Where a row stands: its stitches and its line together, once the move is done. */
function movedBox(pattern: IrregularPattern, row: IrregularRow, move: RowMove): Box | null {
  const boxes: Box[] = [];
  const stitches = unionBox(itemsOfRow(pattern, row.id).filter(isStitch).map(itemBox));
  if (stitches !== null) boxes.push(shiftedBox(stitches, move.shift));
  const line = move.line ?? (row.line === undefined ? undefined : shiftedLine(row.line, move.shift));
  if (line !== undefined) boxes.push(lineBox(line));
  return unionBox(boxes);
}

function rowBox(pattern: IrregularPattern, row: IrregularRow): Box | null {
  return movedBox(pattern, row, { rowId: row.id, shift: ORIGIN });
}
