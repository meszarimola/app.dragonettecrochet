// Edit operations on the free-form chart document. KB: core-geometry §29

import {
  type AnnotationItem,
  type BackgroundImage,
  DEFAULT_FONT_SIZE,
  DEFAULT_GRID_SIZE,
  DEFAULT_POLAR,
  FONT_SIZE_RANGE,
  GRID_SIZE_RANGE,
  IRREGULAR_FORMAT_VERSION,
  type IrregularItem,
  type IrregularLayer,
  type IrregularPattern,
  type IrregularRow,
  isStitch,
  type NoteKind,
  POLAR_RANGE,
  type Point,
  type PolarGuide,
  type StitchItem,
  type Transform,
} from './irregular-types.ts';
import type { PatternNotation, StitchInsertion } from './types.ts';

const SINGLE_DUPLICATE_GAP = 10;

export function nextId(prefix: string, ids: Iterable<string>): string {
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  let max = 0;
  for (const id of ids) {
    const match = pattern.exec(id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}${max + 1}`;
}

export interface EmptyOptions {
  readonly title: string;
  /** The two starting layers, bottom first. The names come from the interface. */
  readonly layerNames: readonly [string, string];
}

export function emptyIrregularPattern(options: EmptyOptions): IrregularPattern {
  const [drawing, labels] = options.layerNames;
  return {
    formatVersion: IRREGULAR_FORMAT_VERSION,
    type: 'irregular',
    title: options.title,
    rows: [{ id: 'r1', kind: 'row', direction: 'ltr', color: null, visible: true, locked: false }],
    layers: [
      { id: 'l1', name: drawing, visible: true, locked: false },
      { id: 'l2', name: labels, visible: true, locked: false },
    ],
    items: [],
    activeRowId: 'r1',
    activeLayerId: 'l1',
    guides: { grid: { visible: false, size: DEFAULT_GRID_SIZE }, polar: DEFAULT_POLAR, snap: false },
  };
}

export interface StitchSpec {
  readonly keyEntryId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly insertion: StitchInsertion;
  readonly rotation?: number;
}

export function addStitch(pattern: IrregularPattern, spec: StitchSpec): { pattern: IrregularPattern; id: string } {
  const id = nextId(
    'i',
    pattern.items.map((item) => item.id),
  );
  const item: StitchItem = {
    id,
    kind: 'stitch',
    keyEntryId: spec.keyEntryId,
    insertion: spec.insertion,
    rowId: pattern.activeRowId,
    layerId: pattern.activeLayerId,
    color: null,
    x: spec.x,
    y: spec.y,
    width: spec.width,
    height: spec.height,
    rotation: normalizeAngle(spec.rotation ?? 0),
    flipX: false,
    flipY: false,
  };
  return { pattern: { ...pattern, items: [...pattern.items, item] }, id };
}

export type ItemPatch = Partial<Transform> & {
  readonly color?: string | null;
  readonly insertion?: StitchInsertion;
  readonly rowId?: string;
  readonly layerId?: string;
};

export function updateItems(pattern: IrregularPattern, ids: Iterable<string>, patch: ItemPatch): IrregularPattern {
  const chosen = new Set(ids);
  if (chosen.size === 0) return pattern;
  return {
    ...pattern,
    items: pattern.items.map((item) => (chosen.has(item.id) ? { ...item, ...patch } : item)),
  };
}

export function moveItems(pattern: IrregularPattern, ids: Iterable<string>, dx: number, dy: number): IrregularPattern {
  const chosen = new Set(ids);
  if (chosen.size === 0 || (dx === 0 && dy === 0)) return pattern;
  return {
    ...pattern,
    items: pattern.items.map((item) => (chosen.has(item.id) ? { ...item, x: item.x + dx, y: item.y + dy } : item)),
  };
}

/** A single item turns about its own centre; several turn about `pivot`. */
export function rotateItems(
  pattern: IrregularPattern,
  ids: Iterable<string>,
  degrees: number,
  pivot: Point | null,
): IrregularPattern {
  const chosen = new Set(ids);
  if (chosen.size === 0 || degrees === 0) return pattern;
  const radians = (degrees * Math.PI) / 180;
  const [cos, sin] = [Math.cos(radians), Math.sin(radians)];
  return {
    ...pattern,
    items: pattern.items.map((item) => {
      if (!chosen.has(item.id)) return item;
      const rotation = normalizeAngle(item.rotation + degrees);
      if (pivot === null) return { ...item, rotation };
      const [dx, dy] = [item.x - pivot.x, item.y - pivot.y];
      return {
        ...item,
        rotation,
        x: pivot.x + dx * cos - dy * sin,
        y: pivot.y + dx * sin + dy * cos,
      };
    }),
  };
}

export function normalizeAngle(degrees: number): number {
  const turned = degrees % 360;
  // The `+ 0` folds a negative zero back to zero, so a turn of nothing compares equal to none.
  return turned < 0 ? turned + 360 : turned + 0;
}

export function deleteItems(pattern: IrregularPattern, ids: Iterable<string>): IrregularPattern {
  const chosen = new Set(ids);
  if (chosen.size === 0) return pattern;
  const items = pattern.items.filter((item) => !chosen.has(item.id));
  return items.length === pattern.items.length ? pattern : { ...pattern, items };
}

export interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** The upright box around a turned glyph box. */
export function itemBox(item: IrregularItem): Box {
  const radians = (item.rotation * Math.PI) / 180;
  const [cos, sin] = [Math.abs(Math.cos(radians)), Math.abs(Math.sin(radians))];
  const halfWidth = (item.width * cos + item.height * sin) / 2;
  const halfHeight = (item.width * sin + item.height * cos) / 2;
  return {
    minX: item.x - halfWidth,
    minY: item.y - halfHeight,
    maxX: item.x + halfWidth,
    maxY: item.y + halfHeight,
  };
}

export function unionBox(boxes: readonly Box[]): Box | null {
  if (boxes.length === 0) return null;
  return boxes.reduce((total, box) => ({
    minX: Math.min(total.minX, box.minX),
    minY: Math.min(total.minY, box.minY),
    maxX: Math.max(total.maxX, box.maxX),
    maxY: Math.max(total.maxY, box.maxY),
  }));
}

export function itemsBox(items: readonly IrregularItem[]): Box | null {
  return unionBox(items.map(itemBox));
}

export function itemsOf(pattern: IrregularPattern, ids: Iterable<string>): IrregularItem[] {
  const chosen = new Set(ids);
  return pattern.items.filter((item) => chosen.has(item.id));
}

/**
 * The copy lands to the right of the selection, one whole run further along, so
 * a repeated row keeps its rhythm: the step is the mean centre-to-centre spacing
 * times the number of stitches. A single stitch, or a stack with no spacing to
 * read, steps by its own width and a small gap instead.
 */
export function duplicateOffset(items: readonly IrregularItem[]): Point {
  const box = itemsBox(items);
  if (box === null) return { x: 0, y: 0 };
  const width = box.maxX - box.minX;
  const fallback = { x: width + SINGLE_DUPLICATE_GAP, y: 0 };
  if (items.length < 2) return fallback;
  const centers = items.map((item) => item.x);
  const span = Math.max(...centers) - Math.min(...centers);
  if (span <= 0) return fallback;
  return { x: (span / (items.length - 1)) * items.length, y: 0 };
}

export function duplicateItems(
  pattern: IrregularPattern,
  ids: Iterable<string>,
  offset: Point,
): { pattern: IrregularPattern; ids: string[] } {
  const chosen = itemsOf(pattern, ids);
  if (chosen.length === 0) return { pattern, ids: [] };
  const taken = pattern.items.map((item) => item.id);
  const copies: IrregularItem[] = [];
  const made: string[] = [];
  for (const item of chosen) {
    const id = nextId('i', [...taken, ...made]);
    made.push(id);
    copies.push(unlinked({ ...item, id, x: item.x + offset.x, y: item.y + offset.y }));
  }
  return { pattern: { ...pattern, items: [...pattern.items, ...copies] }, ids: made };
}

/** Pasted stitches join the active row and layer, keeping their arrangement. */
export function pasteItems(
  pattern: IrregularPattern,
  items: readonly IrregularItem[],
  offset: Point,
): { pattern: IrregularPattern; ids: string[] } {
  if (items.length === 0) return { pattern, ids: [] };
  const taken = pattern.items.map((item) => item.id);
  const made: string[] = [];
  const copies = items.map((item) => {
    const id = nextId('i', [...taken, ...made]);
    made.push(id);
    return unlinked({
      ...item,
      id,
      rowId: pattern.activeRowId,
      layerId: pattern.activeLayerId,
      x: item.x + offset.x,
      y: item.y + offset.y,
    });
  });
  return { pattern: { ...pattern, items: [...pattern.items, ...copies] }, ids: made };
}

/**
 * A copied row number must not keep naming the row it was copied from, or it
 * would sit on one row and forever read another's number.
 */
function unlinked(item: IrregularItem): IrregularItem {
  if (isStitch(item) || item.linkedRowId === undefined) return item;
  const { linkedRowId: _gone, ...rest } = item;
  return rest;
}

export type FlipAxis = 'horizontal' | 'vertical';

/** Mirroring turns the arrangement over too, not only each glyph. */
export function flipItems(pattern: IrregularPattern, ids: Iterable<string>, axis: FlipAxis): IrregularPattern {
  const chosen = new Set(ids);
  const box = itemsBox(itemsOf(pattern, chosen));
  if (box === null) return pattern;
  const centerX = (box.minX + box.maxX) / 2;
  const centerY = (box.minY + box.maxY) / 2;
  return {
    ...pattern,
    items: pattern.items.map((item) => {
      if (!chosen.has(item.id)) return item;
      if (axis === 'horizontal') {
        return { ...item, x: 2 * centerX - item.x, flipX: !item.flipX, rotation: normalizeAngle(-item.rotation) };
      }
      return { ...item, y: 2 * centerY - item.y, flipY: !item.flipY, rotation: normalizeAngle(-item.rotation) };
    }),
  };
}

export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

export function alignItems(pattern: IrregularPattern, ids: Iterable<string>, mode: AlignMode): IrregularPattern {
  const chosen = itemsOf(pattern, ids);
  const box = itemsBox(chosen);
  if (box === null || chosen.length < 2) return pattern;
  const moves = new Map<string, Point>();
  for (const item of chosen) {
    const own = itemBox(item);
    const shift = alignShift(mode, own, box);
    moves.set(item.id, shift);
  }
  return {
    ...pattern,
    items: pattern.items.map((item) => {
      const shift = moves.get(item.id);
      return shift === undefined ? item : { ...item, x: item.x + shift.x, y: item.y + shift.y };
    }),
  };
}

function alignShift(mode: AlignMode, own: Box, box: Box): Point {
  switch (mode) {
    case 'left':
      return { x: box.minX - own.minX, y: 0 };
    case 'right':
      return { x: box.maxX - own.maxX, y: 0 };
    case 'center':
      return { x: (box.minX + box.maxX) / 2 - (own.minX + own.maxX) / 2, y: 0 };
    case 'top':
      return { x: 0, y: box.minY - own.minY };
    case 'bottom':
      return { x: 0, y: box.maxY - own.maxY };
    case 'middle':
      return { x: 0, y: (box.minY + box.maxY) / 2 - (own.minY + own.maxY) / 2 };
  }
}

export type DistributeAxis = 'horizontal' | 'vertical';

/** The outermost two stay put and the rest spread evenly between them. */
export function distributeItems(
  pattern: IrregularPattern,
  ids: Iterable<string>,
  axis: DistributeAxis,
): IrregularPattern {
  const chosen = itemsOf(pattern, ids);
  if (chosen.length < 3) return pattern;
  const horizontal = axis === 'horizontal';
  const sorted = [...chosen].sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === undefined || last === undefined) return pattern;
  const from = horizontal ? first.x : first.y;
  const to = horizontal ? last.x : last.y;
  const step = (to - from) / (sorted.length - 1);
  const places = new Map<string, number>();
  sorted.forEach((item, index) => places.set(item.id, from + step * index));
  return {
    ...pattern,
    items: pattern.items.map((item) => {
      const place = places.get(item.id);
      if (place === undefined) return item;
      return horizontal ? { ...item, x: place } : { ...item, y: place };
    }),
  };
}

export function setTitle(pattern: IrregularPattern, title: string): IrregularPattern {
  if (title === pattern.title) return pattern;
  const { titleGenerated: _generated, ...rest } = pattern;
  return { ...rest, title };
}

export function withIrregularNotation(pattern: IrregularPattern, notation: PatternNotation): IrregularPattern {
  return { ...pattern, notation };
}

export type BackgroundPatch = Partial<Omit<BackgroundImage, 'id'>>;

export function setBackground(pattern: IrregularPattern, background: BackgroundImage | null): IrregularPattern {
  if (background === null) {
    if (pattern.background === undefined) return pattern;
    const { background: _gone, ...rest } = pattern;
    return rest;
  }
  return { ...pattern, background };
}

export function patchBackground(pattern: IrregularPattern, patch: BackgroundPatch): IrregularPattern {
  const current = pattern.background;
  if (current === undefined) return pattern;
  const next: BackgroundImage = {
    ...current,
    x: finiteOr(patch.x, current.x),
    y: finiteOr(patch.y, current.y),
    width: Math.max(1, finiteOr(patch.width, current.width)),
    height: Math.max(1, finiteOr(patch.height, current.height)),
    rotation: normalizeAngle(finiteOr(patch.rotation, current.rotation)),
    opacity: clamp(finiteOr(patch.opacity, current.opacity), 0, 1),
    visible: patch.visible ?? current.visible,
    locked: patch.locked ?? current.locked,
    inExport: patch.inExport ?? current.inExport,
  };
  if (sameBackground(current, next)) return pattern;
  return { ...pattern, background: next };
}

function sameBackground(a: BackgroundImage, b: BackgroundImage): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.rotation === b.rotation &&
    a.opacity === b.opacity &&
    a.visible === b.visible &&
    a.locked === b.locked &&
    a.inExport === b.inExport
  );
}

export function setGrid(pattern: IrregularPattern, visible: boolean): IrregularPattern {
  if (pattern.guides.grid.visible === visible) return pattern;
  return { ...pattern, guides: { ...pattern.guides, grid: { ...pattern.guides.grid, visible } } };
}

export function setGridSize(pattern: IrregularPattern, size: number): IrregularPattern {
  const wanted = clamp(Math.round(size), GRID_SIZE_RANGE.min, GRID_SIZE_RANGE.max);
  if (pattern.guides.grid.size === wanted) return pattern;
  return { ...pattern, guides: { ...pattern.guides, grid: { ...pattern.guides.grid, size: wanted } } };
}

export function setSnap(pattern: IrregularPattern, snap: boolean): IrregularPattern {
  if (pattern.guides.snap === snap) return pattern;
  return { ...pattern, guides: { ...pattern.guides, snap } };
}

export type PolarPatch = Partial<Omit<PolarGuide, 'center'>> & { readonly center?: Point };

export function setPolar(pattern: IrregularPattern, patch: PolarPatch): IrregularPattern {
  const current = pattern.guides.polar;
  const next: PolarGuide = {
    visible: patch.visible ?? current.visible,
    center: patch.center ?? current.center,
    rings: clamp(Math.round(patch.rings ?? current.rings), POLAR_RANGE.rings.min, POLAR_RANGE.rings.max),
    spacing: clamp(patch.spacing ?? current.spacing, POLAR_RANGE.spacing.min, POLAR_RANGE.spacing.max),
    spokes: clamp(Math.round(patch.spokes ?? current.spokes), POLAR_RANGE.spokes.min, POLAR_RANGE.spokes.max),
    startAngle: normalizeAngle(finiteOr(patch.startAngle ?? current.startAngle, 0)),
  };
  if (samePolar(current, next)) return pattern;
  return { ...pattern, guides: { ...pattern.guides, polar: next } };
}

function samePolar(a: PolarGuide, b: PolarGuide): boolean {
  return (
    a.visible === b.visible &&
    a.center.x === b.center.x &&
    a.center.y === b.center.y &&
    a.rings === b.rings &&
    a.spacing === b.spacing &&
    a.spokes === b.spokes &&
    a.startAngle === b.startAngle
  );
}

function finiteOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function rowById(pattern: IrregularPattern, id: string): IrregularRow | undefined {
  return pattern.rows.find((row) => row.id === id);
}

export function layerById(pattern: IrregularPattern, id: string): IrregularLayer | undefined {
  return pattern.layers.find((layer) => layer.id === id);
}

/** KB: 03 §10 — every placed symbol is one stitch, compound glyphs included. */
/** Annotations never count as stitches (D12), so a row's number stays honest. */
export function rowCount(pattern: IrregularPattern, rowId: string): number {
  return pattern.items.reduce((total, item) => (isStitch(item) && item.rowId === rowId ? total + 1 : total), 0);
}

export function stitchCount(pattern: IrregularPattern): number {
  return pattern.items.reduce((total, item) => (isStitch(item) ? total + 1 : total), 0);
}

export interface NoteSpec {
  readonly note: NoteKind;
  /** The row it lives on, so hiding that row hides it too. The active one by default. */
  readonly rowId?: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly text: string;
  readonly fontSize?: number;
  readonly rotation?: number;
  readonly linkedRowId?: string;
  readonly withArrow?: boolean;
  readonly dotted?: boolean;
}

export function addNote(pattern: IrregularPattern, spec: NoteSpec): { pattern: IrregularPattern; id: string } {
  const id = nextId(
    'n',
    pattern.items.map((item) => item.id),
  );
  const item: AnnotationItem = {
    id,
    kind: 'annotation',
    note: spec.note,
    rowId: spec.rowId ?? pattern.activeRowId,
    layerId: pattern.activeLayerId,
    color: null,
    text: spec.text,
    fontSize: clamp(spec.fontSize ?? DEFAULT_FONT_SIZE, FONT_SIZE_RANGE.min, FONT_SIZE_RANGE.max),
    x: spec.x,
    y: spec.y,
    width: Math.max(1, spec.width),
    height: Math.max(1, spec.height),
    rotation: normalizeAngle(spec.rotation ?? 0),
    flipX: false,
    flipY: false,
    ...(spec.linkedRowId === undefined ? {} : { linkedRowId: spec.linkedRowId }),
    ...(spec.withArrow === undefined ? {} : { withArrow: spec.withArrow }),
    ...(spec.dotted === undefined ? {} : { dotted: spec.dotted }),
  };
  return { pattern: { ...pattern, items: [...pattern.items, item] }, id };
}

export type NotePatch = Partial<Pick<AnnotationItem, 'text' | 'fontSize' | 'withArrow' | 'dotted'>>;

export function updateNotes(pattern: IrregularPattern, ids: ReadonlySet<string>, patch: NotePatch): IrregularPattern {
  let changed = false;
  const items = pattern.items.map((item) => {
    if (!ids.has(item.id) || isStitch(item)) return item;
    const next: AnnotationItem = {
      ...item,
      text: patch.text ?? item.text,
      fontSize: clamp(patch.fontSize ?? item.fontSize, FONT_SIZE_RANGE.min, FONT_SIZE_RANGE.max),
      ...(patch.withArrow === undefined ? {} : { withArrow: patch.withArrow }),
      ...(patch.dotted === undefined ? {} : { dotted: patch.dotted }),
    };
    const same =
      next.text === item.text &&
      next.fontSize === item.fontSize &&
      next.withArrow === item.withArrow &&
      next.dotted === item.dotted;
    if (same) return item;
    changed = true;
    return next;
  });
  return changed ? { ...pattern, items } : pattern;
}

/** Hidden or locked rows and layers keep their stitches out of reach. */
export function isSelectable(pattern: IrregularPattern, item: IrregularItem): boolean {
  const row = rowById(pattern, item.rowId);
  const layer = layerById(pattern, item.layerId);
  if (row !== undefined && (!row.visible || row.locked)) return false;
  return !(layer !== undefined && (!layer.visible || layer.locked));
}

export function isVisible(pattern: IrregularPattern, item: IrregularItem): boolean {
  const row = rowById(pattern, item.rowId);
  const layer = layerById(pattern, item.layerId);
  return (row === undefined || row.visible) && (layer === undefined || layer.visible);
}
