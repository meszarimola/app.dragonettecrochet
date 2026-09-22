// The free-form chart editor (PQW-963). KB: interface.md §1, §9, §19

import { canRedo, canUndo, createHistory, type History, record, redo, undo } from '../core/history.ts';
import { bulgeThrough, presetBulge } from '../core/irregular-arc.ts';
import {
  type AlignMode,
  addNote,
  addStitch,
  alignItems,
  type DistributeAxis,
  deleteItems,
  distributeItems,
  duplicateItems,
  duplicateOffset,
  emptyIrregularPattern,
  type FlipAxis,
  flipItems,
  type ItemPatch,
  isSelectable,
  isVisible,
  itemBox,
  itemsOf,
  moveItems,
  type NotePatch,
  type PolarPatch,
  pasteItems,
  patchBackground,
  rotateItems,
  rowById,
  setBackground,
  setGrid,
  setGridSize,
  setPolar,
  setSnap,
  setTitle,
  updateItems,
  updateNotes,
  withIrregularNotation,
} from '../core/irregular-document.ts';
import {
  addChainArc,
  addFan,
  type ChainArcPatch,
  clampCount,
  clampFanCount,
  clampSpread,
  explodeGroups,
  type FanPatch,
  forgetBrokenGroups,
  type GlyphSize,
  groupById,
  groupOfItem,
  groupsOf,
  holdsWholeGroups,
  reseatGroups,
  translateGroups,
  updateChainArc,
  updateFan,
  withWholeGroups,
} from '../core/irregular-groups.ts';
import { isIrregularJson, loadIrregular, saveIrregular } from '../core/irregular-json.ts';
import { entryGlyph, entryName, sharedGlyphs } from '../core/irregular-key.ts';
import {
  addLayer,
  deleteLayer,
  type LayerPatch,
  moveItemsToLayer,
  reorderLayers,
  setActiveLayer,
  updateLayer,
} from '../core/irregular-layers.ts';
import { rowOrder } from '../core/irregular-order.ts';
import { alignRows, type RowAlign, rowLine, setRowLine, spaceRows } from '../core/irregular-rowline.ts';
import {
  addRow,
  deleteRow,
  insertRowAfterActive,
  itemsOfRow,
  moveItemsToRow,
  type RowPatch,
  type RowStitches,
  reorderRows,
  rowNumber,
  setActiveRow,
  updateRow,
} from '../core/irregular-rows.ts';
import { basePoint, fitShape, placeOnShape, suggestShape } from '../core/irregular-shape.ts';
import { angleFromCenter, radialRotation, snapPoint } from '../core/irregular-snap.ts';
import {
  type AnnotationItem,
  type BackgroundImage,
  type ChainArcGroup,
  DEFAULT_ARC_BULGE,
  DEFAULT_ARC_COUNT,
  DEFAULT_BACKGROUND_OPACITY,
  DEFAULT_FAN_COUNT,
  DEFAULT_FAN_SPREAD,
  DEFAULT_FONT_SIZE,
  FAN_LENGTH_RANGE,
  type FanGroup,
  type IrregularGroup,
  type IrregularItem,
  type IrregularPattern,
  isStitch,
  type NoteKind,
  type Point,
  type RowDirection,
  type RowKind,
  type RowLine,
  type RowLineShape,
  type ShapeSide,
} from '../core/irregular-types.ts';
import type { Locale, PatternNotation, StitchDefId } from '../core/types.ts';
import { type BackgroundStoreCode, getBackground, pruneBackgrounds, putBackground } from './background-store.ts';
import { IRREGULAR_JSON_CORE_TEXTS } from './i18n/core/irregular-json.ts';
import { renderCoreText } from './i18n/core/render.ts';
import { texts, uiLanguage } from './i18n.ts';
import { type ArcHandleId, FreeBoard, type GroupPath, type HandleId, rowLinePath } from './irregular-board.ts';
import { drawnGlyph, itemShapes, naturalSize } from './irregular-glyph.ts';
import { IrregularLayersPanel } from './irregular-layers-panel.ts';
import { noteDrawing, noteSize } from './irregular-note.ts';
import { IrregularPanel } from './irregular-panel.ts';
import { IrregularRowsPanel, rowName } from './irregular-rows-panel.ts';
import { type IrregularSvgOptions, irregularBox, irregularSvg } from './irregular-svg.ts';
import {
  type PageOrientation,
  type PageSize,
  MAX_SIDE as PDF_MAX_SIDE,
  type PdfText,
  pageCount,
  writePdf,
} from './pdf.ts';
import type { Shape, SymbolOptions } from './symbols.ts';

export const IRREGULAR_STORAGE_KEY = 'dc-mintatervezo:minta-szabalytalan';
export const IRREGULAR_PREFS_KEY = 'dc-mintatervezo:szabalytalan-beallitasok';

const ROTATE_SNAP = 15;
/** The chain arc is made of chains; the key decides what a chain looks like. */
const ARC_STITCH = 'ch';

/** The PDF writer takes at most ten pages on a side; the panel agrees with it. */
function clampSide(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(PDF_MAX_SIDE, Math.max(1, Math.round(value)));
}

/** How far a row's number stands from its first stitch. */
const LABEL_GAP = 18;
/** Below this a drag is a click, and the annotation takes its natural size. */
const MIN_NOTE_SPAN = 8;
const ROW_ARROW: Record<RowDirection, string> = { ltr: '→', rtl: '←', cw: '↻', ccw: '↺' };
/** A fan is a shell by default, and a shell is made of double crochets. */
const FAN_STITCH = 'dc';
/** How long a typed digit waits for the next one before it stands alone. */
const ARC_TYPING_GAP = 900;
const MIN_SIZE = 2;

interface Preferences {
  readonly rectPartial: boolean;
  readonly radial: boolean;
  readonly perpendicular: boolean;
}

const DEFAULT_PREFERENCES: Preferences = {
  rectPartial: true,
  radial: false,
  perpendicular: true,
};
/** Turning the stitches to the other side of a shape. */
const OTHER_SIDE: Record<ShapeSide, ShapeSide> = {
  left: 'right',
  right: 'left',
  outside: 'inside',
  inside: 'outside',
};

function centerOf(points: readonly Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce((total, point) => ({ x: total.x + point.x, y: total.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function topPoint(item: IrregularItem): Point {
  const radians = (item.rotation * Math.PI) / 180;
  return { x: item.x + Math.sin(radians) * (item.height / 2), y: item.y - Math.cos(radians) * (item.height / 2) };
}
/** How near, in screen pixels, a snap target has to be to take the point. */
const SNAP_REACH = 10;

export interface IrregularSections {
  readonly properties: HTMLDetailsElement;
  readonly rows: HTMLDetailsElement;
  readonly layers: HTMLDetailsElement;
}

export interface IrregularHost {
  announce(message: string): void;
  symbols(): SymbolOptions;
  notation(): PatternNotation;
  insets(): { left: number; right: number; bottom: number };
  notationNote(recorded: Locale, shown: Locale): string;
  terms(): Locale;
  refreshControls(): void;
  /** Whether the guides go into the picture, from the shared export setting. */
  gridInExport(): boolean;
  ink(): string;
  /** A picture the SVG can carry inside itself. */
  imageHref(picture: HTMLImageElement): string;
  savePdf(): void;
  /** Lets the editor lay the palette's stitch down when another tool takes over. */
  armStitch(id: StitchDefId | null): void;
}

type Drag =
  | { kind: 'move'; from: Point; anchor: Point; drop: string | null }
  | { kind: 'polar'; from: Point; center: Point }
  | { kind: 'background'; from: Point; at: Point }
  | { kind: 'note-draw'; note: NoteKind; from: Point; to: Point }
  /** `free` is what the key said while drawing, so the commit matches the preview. */
  | { kind: 'arc-draw'; from: Point; to: Point; free: boolean }
  | { kind: 'fan-draw'; from: Point; to: Point; free: boolean }
  | { kind: 'arc-grip'; id: string; grip: ArcHandleId }
  | { kind: 'rowline-grip'; rowId: string; grip: ArcHandleId }
  | { kind: 'pan'; last: Point }
  | { kind: 'marquee'; from: Point; to: Point; additive: boolean }
  | { kind: 'scale'; handle: HandleId; start: Point; base: readonly IrregularItem[]; anchor: Point }
  | { kind: 'rotate'; center: Point; startAngle: number; base: readonly IrregularItem[] };

function readPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(IRREGULAR_PREFS_KEY);
    if (raw === null) return DEFAULT_PREFERENCES;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PREFERENCES;
    const stored = parsed as Record<string, unknown>;
    const flag = (name: keyof Preferences): boolean =>
      typeof stored[name] === 'boolean' ? (stored[name] as boolean) : DEFAULT_PREFERENCES[name];
    return {
      rectPartial: flag('rectPartial'),
      radial: flag('radial'),
      perpendicular: flag('perpendicular'),
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/**
 * A file from before PQW-1015 keeps two sizes, a small square and a wide ring
 * step; the two guides share one now, the ring step. KB: interface.md §63
 */
function oneGuideSize(pattern: IrregularPattern): IrregularPattern {
  const { grid, polar } = pattern.guides;
  return grid.size === polar.spacing ? pattern : setGridSize(pattern, polar.spacing);
}

function angleOf(center: Point, point: Point): number {
  return (Math.atan2(point.y - center.y, point.x - center.x) * 180) / Math.PI;
}

export class IrregularEditor {
  readonly #canvas: HTMLCanvasElement;
  readonly #board: FreeBoard;
  readonly #panel: IrregularPanel;
  readonly #rowsPanel: IrregularRowsPanel;
  readonly #layersPanel: IrregularLayersPanel;
  readonly #host: IrregularHost;
  #history: History<IrregularPattern>;
  #draft: IrregularPattern | null = null;
  #selection = new Set<string>();
  /** A key entry id: a library stitch, or one the crocheter made up. */
  #stitch: string | null = null;
  #arcTool = false;
  #fanTool = false;
  #fanCount = DEFAULT_FAN_COUNT;
  #fanSpread = DEFAULT_FAN_SPREAD;
  #fanMode: FanGroup['mode'] = 'spread';
  #fanStitch = FAN_STITCH;
  #arcCount = DEFAULT_ARC_COUNT;
  #arcTyped = 0;
  #arcTypedText = '';
  #drag: Drag | null = null;
  #preferences = readPreferences();
  #clipboard: readonly IrregularItem[] = [];
  #lastDuplicate: Point | null = null;
  #pointer: Point | null = null;
  #hoverCapable = false;
  #mounted = false;
  #spaceDown = false;

  constructor(canvas: HTMLCanvasElement, sections: IrregularSections, host: IrregularHost) {
    this.#canvas = canvas;
    this.#host = host;
    this.#board = new FreeBoard(canvas);
    this.#history = createHistory(this.#restore());
    this.#rowsPanel = new IrregularRowsPanel(sections.rows, {
      addRow: (kind) => this.#addRow(kind),
      insertRow: () => this.#insertRow(),
      deleteRow: (rowId, stitches) => this.#deleteRow(rowId, stitches),
      activate: (rowId) => this.#activateRow(rowId),
      update: (rowId, patch) => this.#updateRow(rowId, patch),
      reorder: (rowId, toIndex) => this.#commit(reorderRows(this.#history.present, rowId, toIndex)),
      selectRow: (rowId) => this.selectRow(rowId),
      moveSelection: (rowId) => this.#moveSelectionToRow(rowId),
      spaceRows: (spacing) => this.spaceRows(spacing),
      alignRows: (mode) => this.alignRows(mode),
    });
    this.#layersPanel = new IrregularLayersPanel(sections.layers, {
      addLayer: () => this.#addLayer(),
      deleteLayer: (layerId) => this.#deleteLayer(layerId),
      activate: (layerId) => this.#commit(setActiveLayer(this.#history.present, layerId)),
      update: (layerId, patch) => this.#updateLayer(layerId, patch),
      reorder: (layerId, toIndex) => this.#commit(reorderLayers(this.#history.present, layerId, toIndex)),
      moveSelection: (layerId) => this.#moveSelectionToLayer(layerId),
      patchBackground: (patch) => this.#commit(patchBackground(this.#history.present, patch)),
    });
    this.#panel = new IrregularPanel(sections.properties, {
      patch: (patch) => this.#patch(patch),
      align: (mode) => this.#align(mode),
      distribute: (axis) => this.#distribute(axis),
      flip: (axis) => this.#flip(axis),
      setRectPartial: (partial) => this.#setPreference({ rectPartial: partial }),
      setGridSize: (size) => this.#setGuideSize(size),
      setSnap: (on) => this.#commit(setSnap(this.#history.present, on)),
      setPolar: (patch) => this.#setPolar(patch),
      setRadial: (on) => this.#setPreference({ radial: on }),
      setArcCount: (count) => this.setArcCount(count),
      setArcShape: (shape) => this.setArcShape(shape),
      setArcBulge: (bulge) => this.setArcBulge(bulge),
      explodeArc: () => this.explodeSelectedGroup(),
      setFanCount: (count) => this.setFanCount(count),
      setFanSpread: (angle) => this.setFanSpread(angle),
      setFanLength: (length) => this.setFanLength(length),
      setFanMode: (mode) => this.setFanMode(mode),
      arrange: (kind) => this.arrange(kind),
      evenOut: () => this.evenOut(),
      flipArrangeSide: () => this.flipArrangeSide(),
      setPerpendicular: (on) => this.setPerpendicular(on),
      clearRowLine: () => this.clearRowLine(),
      loadBackground: () => this.pickBackground(),
      removeBackground: () => this.removeBackground(),
      patchBackground: (patch) => this.#commit(patchBackground(this.#history.present, patch)),
      setExport: (patch) => this.setExport(patch),
      savePdf: () => this.#host.savePdf(),
      patchNotes: (patch) => this.patchNotes(patch),
      numberRows: () => this.numberRows(),
      addStartMarker: () => this.addStartMarker(),
    });
    this.#hoverCapable = window.matchMedia('(hover: hover)').matches;
    this.#listen();
  }

  get active(): boolean {
    return this.#mounted;
  }

  get pattern(): IrregularPattern {
    return this.#draft ?? this.#history.present;
  }

  get title(): string {
    return this.#history.present.title;
  }

  get gridVisible(): boolean {
    return this.#history.present.guides.grid.visible;
  }

  get canUndo(): boolean {
    return canUndo(this.#history);
  }

  get canRedo(): boolean {
    return canRedo(this.#history);
  }

  get stitchTotal(): number {
    return this.#history.present.items.length;
  }

  get selectionSize(): number {
    return this.#selection.size;
  }

  mount(): void {
    this.#mounted = true;
    void this.#restoreBackground();
    this.#panel.reveal();
    this.#rowsPanel.reveal();
    this.#layersPanel.reveal();
    this.refresh();
    this.#board.fit(this.#host.insets().bottom);
  }

  unmount(): void {
    this.#mounted = false;
    // A finger still down when the view closes would look like one half of a
    // pinch forever, and single-finger drawing would never work again.
    this.#touches.clear();
    this.#pinch = null;
    this.#draft = null;
    this.#drag = null;
    this.#panel.hide();
    this.#rowsPanel.hide();
    this.#layersPanel.hide();
  }

  #setPreference(patch: Partial<Preferences>): void {
    this.#preferences = { ...this.#preferences, ...patch };
    this.#persistPreferences();
    this.refresh();
  }

  // -- structure -----------------------------------------------------------

  #addRow(kind: RowKind): void {
    const made = addRow(this.#history.present, kind);
    this.#commit(setActiveRow(made.pattern, made.id), texts().irregular.rowAdded(rowName(made.pattern, made.id)));
  }

  #insertRow(): void {
    const made = insertRowAfterActive(this.#history.present);
    this.#commit(setActiveRow(made.pattern, made.id), texts().irregular.rowAdded(rowName(made.pattern, made.id)));
  }

  #deleteRow(rowId: string, stitches: RowStitches): void {
    const words = texts().irregular;
    if (this.#history.present.rows.length < 2) {
      this.#host.announce(words.rowOnlyOne);
      return;
    }
    const name = rowName(this.#history.present, rowId);
    const next = deleteRow(this.#history.present, rowId, stitches);
    this.#setSelection([]);
    this.#commit(next, words.rowRemoved(name));
  }

  #activateRow(rowId: string): void {
    const next = setActiveRow(this.#history.present, rowId);
    this.#commit(next, texts().irregular.rowActivated(rowName(next, rowId)));
  }

  #updateRow(rowId: string, patch: RowPatch): void {
    this.#commit(updateRow(this.#history.present, rowId, patch));
  }

  selectRow(rowId: string): void {
    const ids = this.#history.present.items.filter((item) => item.rowId === rowId).map((item) => item.id);
    this.#setSelection(ids);
    this.refresh();
    this.#host.announce(texts().irregular.selected(ids.length));
  }

  #moveSelectionToRow(rowId: string): void {
    const count = this.#selection.size;
    if (count === 0) return;
    const next = moveItemsToRow(this.#history.present, this.#selection, rowId);
    this.#commit(next, texts().irregular.itemsMovedToRow(count, rowName(next, rowId)));
  }

  #addLayer(): void {
    const words = texts().irregular;
    const name = `${words.layerName} ${this.#history.present.layers.length + 1}`;
    const made = addLayer(this.#history.present, name);
    this.#commit(setActiveLayer(made.pattern, made.id), words.layerAdded(name));
  }

  #deleteLayer(layerId: string): void {
    if (this.#history.present.layers.length < 2) {
      this.#host.announce(texts().irregular.layerOnlyOne);
      return;
    }
    this.#setSelection([]);
    this.#commit(deleteLayer(this.#history.present, layerId));
  }

  #updateLayer(layerId: string, patch: LayerPatch): void {
    this.#commit(updateLayer(this.#history.present, layerId, patch));
  }

  #moveSelectionToLayer(layerId: string): void {
    const count = this.#selection.size;
    if (count === 0) return;
    const next = moveItemsToLayer(this.#history.present, this.#selection, layerId);
    const layer = next.layers.find((candidate) => candidate.id === layerId);
    this.#commit(next, texts().irregular.itemsMovedToLayer(count, layer?.name ?? ''));
  }

  #onlySelected(): string | null {
    if (this.#selection.size !== 1) return null;
    const [id] = [...this.#selection];
    return id ?? null;
  }

  #rowOfSelection(): string | null {
    const id = this.#onlySelected();
    if (id === null) return null;
    return this.#history.present.items.find((candidate) => candidate.id === id)?.rowId ?? null;
  }

  /**
   * One symbol standing for two stitches makes the chart ambiguous: "•" is a slip
   * stitch in one reference chart and a chain in another. KB: 01 §6.1
   */
  issues(): string[] {
    const pattern = this.#history.present;
    const terms = this.#host.terms();
    const words = texts().irregular;
    const clashes = sharedGlyphs(pattern, (id) => drawnGlyph(id, entryGlyph(pattern, id))).flatMap((clash) => {
      const [first, second] = clash.keyEntryIds;
      if (first === undefined || second === undefined) return [];
      return [words.sharedGlyph(entryName(pattern, first, terms), entryName(pattern, second, terms))];
    });
    const trouble = this.backgroundTrouble;
    // A fresh pattern is one empty row by design; only a later one is a mistake.
    const empty =
      pattern.rows.length < 2
        ? []
        : pattern.rows
            .filter((row) => pattern.items.every((item) => item.rowId !== row.id))
            .map((row) => words.rowEmpty(rowName(pattern, row.id)));
    const hidden = pattern.items.some((item) => !isVisible(pattern, item)) ? [words.hiddenNotExported] : [];
    return [...clashes, ...empty, ...hidden, ...(trouble === null ? [] : [trouble])];
  }

  // -- storage -------------------------------------------------------------

  #restore(): IrregularPattern {
    const fresh = this.#empty();
    try {
      const saved = localStorage.getItem(IRREGULAR_STORAGE_KEY);
      if (saved === null) return fresh;
      const loaded = loadIrregular(saved);
      return loaded.ok ? oneGuideSize(loaded.pattern) : fresh;
    } catch {
      return fresh;
    }
  }

  #empty(): IrregularPattern {
    const words = texts().irregular;
    return emptyIrregularPattern({
      title: words.newTitle,
      layerNames: [words.layerDrawing, words.layerLabels],
    });
  }

  #persist(): void {
    try {
      localStorage.setItem(IRREGULAR_STORAGE_KEY, saveIrregular(this.#withNotation()));
    } catch {
      this.#host.announce(texts().messages.storage.saveFailed);
    }
  }

  #persistPreferences(): void {
    try {
      localStorage.setItem(IRREGULAR_PREFS_KEY, JSON.stringify(this.#preferences));
    } catch {
      // A browser that refuses storage still draws; the preference simply does not survive.
    }
  }

  // -- history -------------------------------------------------------------

  #commit(candidate: IrregularPattern, message?: string): void {
    this.#draft = null;
    const next = this.#refreshLabels(reseatGroups(candidate));
    if (next !== this.#history.present) {
      this.#history = record(this.#history, next);
      this.#pruneSelection();
      this.#persist();
    }
    this.refresh();
    if (message !== undefined) this.#host.announce(message);
  }

  undo(): void {
    this.#history = undo(this.#history);
    this.#pruneSelection();
    this.#persist();
    this.refresh();
  }

  redo(): void {
    this.#history = redo(this.#history);
    this.#pruneSelection();
    this.#persist();
    this.refresh();
  }

  /** Replacing the selection forgets the repeat step; duplicating keeps it. */
  #setSelection(ids: Iterable<string>): void {
    this.#selection = new Set(ids);
    this.#lastDuplicate = null;
  }

  #pruneSelection(): void {
    const live = new Set(this.#history.present.items.map((item) => item.id));
    for (const id of [...this.#selection]) if (!live.has(id)) this.#selection.delete(id);
  }

  // -- actions -------------------------------------------------------------

  newPattern(): void {
    this.#selection.clear();
    this.#history = createHistory(this.#empty());
    this.#persist();
    this.refresh();
    this.#board.fit(this.#host.insets().bottom);
    this.#host.announce(texts().irregular.emptied);
  }

  setStitch(id: StitchDefId | null): void {
    // Arming the palette lays every drawing tool down, or the canvas would keep
    // drawing groups while the palette claimed a stitch was waiting.
    if (id !== null) {
      this.#arcTool = false;
      this.#fanTool = false;
      this.#note = null;
    }
    this.#stitch = id;
    this.refresh();
  }

  get arcArmed(): boolean {
    return this.#arcTool;
  }

  get selectedArc(): ChainArcGroup | null {
    const group = this.selectedGroup;
    return group?.kind === 'chainArc' ? group : null;
  }

  get selectedFan(): FanGroup | null {
    const group = this.selectedGroup;
    return group?.kind === 'fan' ? group : null;
  }

  /** The group the selection holds, when it holds exactly one and nothing else. */
  get selectedGroup(): IrregularGroup | null {
    const groups = groupsOf(this.pattern).filter((group) =>
      group.memberIds.some((member) => this.#selection.has(member)),
    );
    const only = groups.length === 1 ? groups[0] : undefined;
    if (only === undefined || only.memberIds.length !== this.#selection.size) return null;
    return only.memberIds.every((member) => this.#selection.has(member)) ? only : null;
  }

  toggleArcTool(): void {
    this.#setTool(this.#arcTool ? 'none' : 'arc');
  }

  toggleFanTool(): void {
    this.#setTool(this.#fanTool ? 'none' : 'fan');
  }

  get fanArmed(): boolean {
    return this.#fanTool;
  }

  /** One drawing tool at a time, and arming one lays the palette's stitch down. */
  #setTool(tool: 'none' | 'arc' | 'fan'): void {
    this.#arcTool = tool === 'arc';
    this.#fanTool = tool === 'fan';
    this.#note = null;
    if (tool !== 'none') {
      this.#stitch = null;
      this.#host.armStitch(null);
    }
    this.refresh();
  }

  setFanCount(count: number): void {
    this.#fanCount = clampFanCount(count);
    if (this.selectedFan === null) return;
    this.#patchFan({ count: this.#fanCount }, texts().irregular.fanCount(this.#fanCount));
  }

  setFanSpread(angle: number): void {
    this.#fanSpread = clampSpread(angle);
    this.#patchFan({ spreadAngle: this.#fanSpread });
  }

  setFanLength(length: number): void {
    this.#patchFan({ length });
  }

  setFanMode(mode: FanGroup['mode']): void {
    this.#fanMode = mode;
    this.#patchFan({ mode });
  }

  #patchFan(patch: FanPatch, message?: string): void {
    const fan = this.selectedFan;
    if (fan === null) return;
    const next = updateFan(this.#history.present, fan.id, patch, this.#fanGlyph(fan.keyEntryId));
    const group = groupById(next, fan.id);
    if (group !== undefined) this.#selection = new Set(group.memberIds);
    this.#commit(next, message);
  }

  /** A fan stretches its glyph to the length, so it is measured at its natural size. */
  #fanGlyph(keyEntryId: string): GlyphSize {
    return naturalSize(keyEntryId, 'both-loops', this.#host.symbols(), entryGlyph(this.#history.present, keyEntryId));
  }

  #finishFanDraw(drag: Extract<Drag, { kind: 'fan-draw' }>): void {
    const origin = this.#snap(drag.from, undefined, drag.free);
    const reach = drag.to;
    const length = Math.hypot(reach.x - origin.x, reach.y - origin.y);
    if (length < FAN_LENGTH_RANGE.min) {
      this.refresh();
      return;
    }
    const pattern = this.#history.present;
    const keyEntryId = this.#fanStitch;
    const made = addFan(
      pattern,
      {
        rowId: pattern.activeRowId,
        layerId: pattern.activeLayerId,
        keyEntryId,
        mode: this.#fanMode,
        origin,
        direction: angleFromCenter(origin, reach),
        spreadAngle: this.#fanSpread,
        length,
        count: this.#fanCount,
      },
      this.#fanGlyph(keyEntryId),
    );
    const group = groupById(made.pattern, made.id);
    this.#setSelection(group === undefined ? [] : group.memberIds);
    const row = made.pattern.rows.findIndex((candidate) => candidate.id === pattern.activeRowId) + 1;
    this.#commit(made.pattern, texts().irregular.fanAdded(this.#fanCount, row));
  }

  /** The size the arc's chains are drawn at, measured from the key's own symbol. */
  #arcGlyph(keyEntryId: string): GlyphSize {
    return naturalSize(keyEntryId, 'both-loops', this.#host.symbols(), entryGlyph(this.#history.present, keyEntryId));
  }

  setArcCount(count: number): void {
    const arc = this.selectedArc;
    const wanted = clampCount(count);
    this.#arcCount = wanted;
    if (arc === null || arc.count === wanted) return;
    const next = updateChainArc(this.#history.present, arc.id, { count: wanted }, this.#arcGlyph(arc.keyEntryId));
    const group = groupById(next, arc.id);
    if (group !== undefined) this.#selection = new Set(group.memberIds);
    this.#commit(next, texts().irregular.arcCount(wanted));
  }

  /**
   * Digits typed one after the other build one number, so "1" then "2" is
   * twelve; a pause starts a new one. KB: interface.md §44
   */
  typeArcCount(digit: string): void {
    const now = Date.now();
    const fresh = now - this.#arcTyped > ARC_TYPING_GAP;
    this.#arcTyped = now;
    this.#arcTypedText = `${fresh ? '' : this.#arcTypedText}${digit}`;
    const wanted = Number(this.#arcTypedText);
    if (!Number.isFinite(wanted)) return;
    if (this.selectedFan !== null) this.setFanCount(wanted);
    else this.setArcCount(wanted);
  }

  setArcShape(shape: ChainArcGroup['shape']): void {
    this.#patchArc({ shape });
  }

  setArcBulge(bulge: number): void {
    this.#patchArc({ bulge });
  }

  #patchArc(patch: ChainArcPatch): void {
    const arc = this.selectedArc;
    if (arc === null) return;
    const next = updateChainArc(this.#history.present, arc.id, patch, this.#arcGlyph(arc.keyEntryId));
    const group = groupById(next, arc.id);
    if (group !== undefined) this.#selection = new Set(group.memberIds);
    this.#commit(next);
  }

  explodeSelectedGroup(): void {
    const group = this.selectedGroup;
    if (group === null) return;
    const words = texts().irregular;
    const said = group.kind === 'fan' ? words.fanExploded(group.count) : words.arcExploded(group.count);
    this.#commit(explodeGroups(this.#history.present, [group.id]), said);
  }

  /**
   * A group describes how its stitches were made. Editing one of them on its own
   * makes that description a lie, so the group is forgotten and the stitches stay.
   * KB: interface.md §44
   */
  #loose(pattern: IrregularPattern): IrregularPattern {
    const ids = new Set<string>();
    for (const id of this.#selection) {
      const group = groupOfItem(this.#history.present, id);
      if (group !== undefined) ids.add(group.id);
    }
    return ids.size === 0 ? pattern : explodeGroups(pattern, ids);
  }

  /** Moving a whole group carries its path; moving part of one breaks it up. */
  #shifted(pattern: IrregularPattern, dx: number, dy: number): IrregularPattern {
    if (holdsWholeGroups(this.#history.present, this.#selection)) {
      return translateGroups(pattern, this.#selection, dx, dy);
    }
    return this.#loose(pattern);
  }

  toggleGrid(): void {
    this.#commit(setGrid(this.#history.present, !this.gridVisible));
  }

  /**
   * Switching the circle guide on brings it where you are looking, unless its
   * middle is already on screen — otherwise the guide would be drawn off-canvas.
   */
  /** KB: interface.md §63 — one size for both guides, so a square and a ring step match. */
  #setGuideSize(size: number): void {
    const sized = setGridSize(this.#history.present, size);
    this.#commit(setPolar(sized, { spacing: sized.guides.grid.size }));
  }

  #setPolar(patch: PolarPatch): void {
    const current = this.#history.present.guides.polar;
    const arriving = patch.visible === true && !current.visible;
    const room = this.#host.insets().bottom;
    const home = arriving && !this.#board.onScreen(current.center, room) ? this.#board.viewCenter(room) : undefined;
    // A circle guide switched on takes the grid's size, so the two stay in proportion.
    const sized = arriving ? { ...patch, spacing: this.#history.present.guides.grid.size } : patch;
    this.#commit(setPolar(this.#history.present, home === undefined ? sized : { ...sized, center: home }));
  }

  /**
   * Holding the key means "not this one": nothing snaps while it is down, in
   * every gesture, not only while dragging something that already exists.
   * KB: interface.md §43
   */
  #free = false;

  /**
   * Touch and pen always report no modifier, so a pointer may only raise the
   * flag, never lower it: on a tablet with a keyboard the finger would otherwise
   * undo what the held key just said.
   */
  #readFree(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') return;
    this.#setFree(event.metaKey || event.ctrlKey);
  }

  #setFree(down: boolean): void {
    if (this.#free === down) return;
    this.#free = down;
    // Only the ghost shows the difference, and only when a stitch is armed.
    if (this.#stitch !== null) this.#refreshScene();
  }

  /** The nearest guide or neighbouring stitch, measured in chart units. */
  #snap(point: Point, skip?: ReadonlySet<string>, free = this.#free): Point {
    if (free) return point;
    return snapPoint(this.#history.present, point, {
      tolerance: SNAP_REACH / this.#board.scale,
      ...(skip === undefined ? {} : { skip }),
      gridDrawn: this.#board.gridDrawn(),
    });
  }

  /** What a stitch dropped here is turned to: away from the middle of the circle guide. */
  #placedRotation(point: Point): number {
    const polar = this.#history.present.guides.polar;
    if (!this.#preferences.radial || !polar.visible) return 0;
    return radialRotation(polar, point);
  }

  zoom(factor: number): void {
    this.#board.zoom(factor);
  }

  fit(): void {
    this.#board.fit(this.#host.insets().bottom);
  }

  setInsets(left: number, right: number): void {
    this.#board.setInsets(left, right);
  }

  setTitle(title: string): void {
    this.#commit(setTitle(this.#history.present, title));
  }

  selectAll(): void {
    const pattern = this.#history.present;
    this.#setSelection(pattern.items.filter((item) => this.#reachable(item)).map((item) => item.id));
    this.refresh();
    this.#host.announce(texts().irregular.selected(this.#selection.size));
  }

  clearSelection(): void {
    if (this.#selection.size === 0 && this.#stitch === null) return;
    this.#setSelection([]);
    this.refresh();
  }

  deleteSelection(): void {
    const count = this.#selection.size;
    if (count === 0) return;
    const next = forgetBrokenGroups(deleteItems(this.#history.present, this.#selection));
    this.#setSelection([]);
    this.#commit(next, texts().irregular.deleted(count));
  }

  duplicateSelection(): void {
    if (this.#selection.size === 0) return;
    const chosen = itemsOf(this.#history.present, this.#selection);
    // Pressing it again repeats the last step, so a linear repeat comes quickly.
    const offset = this.#lastDuplicate ?? duplicateOffset(chosen);
    const made = duplicateItems(this.#history.present, this.#selection, offset);
    this.#lastDuplicate = offset;
    this.#selection = new Set(made.ids);
    this.#commit(made.pattern, texts().irregular.duplicated(made.ids.length));
  }

  copySelection(): void {
    if (this.#selection.size === 0) return;
    this.#clipboard = itemsOf(this.#history.present, this.#selection);
    this.#host.announce(texts().irregular.copied(this.#clipboard.length));
  }

  cutSelection(): void {
    if (this.#selection.size === 0) return;
    this.#clipboard = itemsOf(this.#history.present, this.#selection);
    this.deleteSelection();
  }

  paste(): void {
    if (this.#clipboard.length === 0) return;
    const at = this.#pointer;
    const first = this.#clipboard[0];
    const offset = at !== null && first !== undefined ? { x: at.x - first.x, y: at.y - first.y } : { x: 10, y: 10 };
    const made = pasteItems(this.#history.present, this.#clipboard, offset);
    this.#setSelection(made.ids);
    this.#commit(made.pattern, texts().irregular.pasted(made.ids.length));
  }

  nudge(dx: number, dy: number): void {
    if (this.#selection.size === 0) return;
    this.#commit(this.#shifted(moveItems(this.#history.present, this.#selection, dx, dy), dx, dy));
  }

  rotateSelection(degrees: number): void {
    if (this.#selection.size === 0) return;
    const pivot = this.#selection.size === 1 ? null : this.#selectionCenter();
    this.#commit(this.#loose(rotateItems(this.#history.present, this.#selection, degrees, pivot)));
  }

  #selectionCenter(): Point | null {
    const box = this.#board.selectionBox();
    return box === null ? null : { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
  }

  #patch(patch: ItemPatch): void {
    if (this.#selection.size === 0) return;
    this.#commit(this.#loose(updateItems(this.#history.present, this.#selection, patch)));
  }

  #align(mode: AlignMode): void {
    const next = this.#loose(alignItems(this.#history.present, this.#selection, mode));
    this.#commit(next, next === this.#history.present ? undefined : texts().irregular.aligned);
  }

  #distribute(axis: DistributeAxis): void {
    const next = this.#loose(distributeItems(this.#history.present, this.#selection, axis));
    this.#commit(next, next === this.#history.present ? undefined : texts().irregular.spread);
  }

  #flip(axis: FlipAxis): void {
    this.#commit(this.#loose(flipItems(this.#history.present, this.#selection, axis)));
  }

  // -- background image --------------------------------------------------------

  #image: { id: string; picture: HTMLImageElement } | null = null;
  #backgroundTrouble: BackgroundStoreCode | null = null;

  #backgroundView(): { placement: BackgroundImage; image: CanvasImageSource } | null {
    const placement = this.pattern.background;
    const loaded = this.#image;
    if (placement === undefined || loaded === null || loaded.id !== placement.id) return null;
    return { placement, image: loaded.picture };
  }

  /** The warning the issues list shows when the picture could not be kept. */
  get backgroundTrouble(): string | null {
    if (this.#backgroundTrouble === null) return null;
    return texts().irregular.bgTrouble[this.#backgroundTrouble];
  }

  pickBackground(): void {
    const chooser = document.createElement('input');
    chooser.type = 'file';
    chooser.accept = 'image/png,image/jpeg';
    chooser.addEventListener('change', () => {
      const file = chooser.files?.[0];
      if (file !== undefined) void this.loadBackground(file);
    });
    chooser.click();
  }

  /**
   * The picture's bytes go to the browser's own store, never into the pattern's
   * autosave slot: a photo is megabytes and the slot is not. KB: interface.md §47
   */
  async loadBackground(file: Blob): Promise<void> {
    const stored = await putBackground(file);
    if (!stored.ok) {
      this.#backgroundTrouble = stored.error.code;
      this.refresh();
      this.#host.announce(texts().irregular.bgTrouble[stored.error.code]);
      return;
    }
    const picture = await this.#decode(file);
    if (picture === null) {
      this.#backgroundTrouble = 'failed';
      this.refresh();
      return;
    }
    this.#backgroundTrouble = null;
    this.#image = { id: stored.id, picture };
    const middle = this.#board.viewCenter(this.#host.insets().bottom);
    const next = setBackground(this.#history.present, {
      id: stored.id,
      x: middle.x,
      y: middle.y,
      width: picture.naturalWidth,
      height: picture.naturalHeight,
      rotation: 0,
      opacity: DEFAULT_BACKGROUND_OPACITY,
      visible: true,
      locked: false,
      inExport: false,
    });
    this.#commit(next, texts().irregular.bgLoaded);
    this.#board.fit(this.#host.insets().bottom);
    void pruneBackgrounds(this.#keptBackgrounds());
  }

  /**
   * The picture's bytes are not deleted here: removing is undoable, and a blob
   * thrown away on the way out could not come back. They go when nothing in the
   * history points at them any more. KB: interface.md §47
   */
  removeBackground(): void {
    const current = this.#history.present.background;
    if (current === undefined) return;
    this.#image = null;
    this.#backgroundTrouble = null;
    this.#commit(setBackground(this.#history.present, null), texts().irregular.bgRemoved);
  }

  /** Every picture the undo history can still reach. */
  #keptBackgrounds(): string[] {
    const ids = new Set<string>();
    for (const state of [...this.#history.past, this.#history.present, ...this.#history.future]) {
      const id = state.background?.id;
      if (id !== undefined) ids.add(id);
    }
    return [...ids];
  }

  /** A pattern file dropped on the canvas loads, the same as through the menu. */
  async #dropPattern(file: Blob): Promise<void> {
    const source = await file.text();
    if (isIrregularJson(source)) this.importJson(source);
  }

  #decode(blob: Blob): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const picture = new Image();
      const url = URL.createObjectURL(blob);
      picture.addEventListener('load', () => {
        URL.revokeObjectURL(url);
        resolve(picture);
      });
      picture.addEventListener('error', () => {
        URL.revokeObjectURL(url);
        resolve(null);
      });
      picture.src = url;
    });
  }

  /** Brings the stored picture back after a reload, so a traced chart opens as it was. */
  async #restoreBackground(): Promise<void> {
    const placement = this.#history.present.background;
    if (placement === undefined || this.#image?.id === placement.id) return;
    const found = await getBackground(placement.id);
    if (!found.ok) {
      this.#backgroundTrouble = found.error.code;
      this.refresh();
      return;
    }
    const picture = await this.#decode(found.blob);
    if (picture === null) return;
    this.#image = { id: placement.id, picture };
    this.refresh();
  }

  // -- arranging -----------------------------------------------------------

  /**
   * What an arrange acts on: the selection when there is one, otherwise the
   * whole active row. Always in crochet order, because that is the order the
   * stitches are laid down in. KB: core-geometry §53
   */
  #arrangeTargets(): { items: IrregularItem[]; rowId: string; wholeRow: boolean } {
    const pattern = this.#history.present;
    const rowId = this.#rowOfSelection() ?? pattern.activeRowId;
    const order = rowOrder(pattern, rowId);
    const inRow = itemsOfRow(pattern, rowId).filter((item) => isStitch(item) && isSelectable(pattern, item));
    const chosen = this.#selection.size === 0 ? inRow : inRow.filter((item) => this.#selection.has(item.id));
    const byId = new Map(chosen.map((item) => [item.id, item]));
    const items: IrregularItem[] = [];
    for (const id of order) {
      const item = byId.get(id);
      if (item !== undefined) items.push(item);
    }
    for (const item of chosen) if (!order.includes(item.id)) items.push(item);
    return { items, rowId, wholeRow: items.length === inRow.length && inRow.length > 0 };
  }

  arrange(kind: RowLineShape | 'fan'): void {
    const target = this.#arrangeTargets();
    if (target.items.length < 2) {
      this.#host.announce(texts().irregular.tooFewToArrange);
      return;
    }
    if (kind === 'fan') {
      this.#arrangeIntoFan(target.items, target.rowId);
      return;
    }
    const shape = suggestShape(target.items.map(basePoint), kind);
    if (shape === null) {
      this.#host.announce(texts().irregular.noShapeFits);
      return;
    }
    this.#applyShape(target, { ...shape, perpendicular: this.#preferences.perpendicular });
  }

  evenOut(): void {
    const target = this.#arrangeTargets();
    if (target.items.length < 2) {
      this.#host.announce(texts().irregular.tooFewToArrange);
      return;
    }
    // A row that remembers a shape is evened out onto that one, not onto a new fit.
    const stored = rowLine(this.#history.present, target.rowId);
    const shape = stored ?? fitShape(target.items.map(basePoint));
    if (shape === undefined || shape === null) {
      this.#host.announce(texts().irregular.noShapeFits);
      return;
    }
    this.#applyShape(target, shape, texts().irregular.evenedOut(target.items.length));
  }

  flipArrangeSide(): void {
    const target = this.#arrangeTargets();
    const stored = rowLine(this.#history.present, target.rowId);
    if (stored === undefined || target.items.length < 2) {
      this.#host.announce(texts().irregular.noShapeFits);
      return;
    }
    const side = OTHER_SIDE[stored.side];
    this.#applyShape(target, { ...stored, side });
  }

  clearRowLine(): void {
    const rowId = this.#rowOfSelection() ?? this.#history.present.activeRowId;
    if (rowLine(this.#history.present, rowId) === undefined) return;
    this.#commit(setRowLine(this.#history.present, rowId, null), texts().irregular.rowLineCleared);
  }

  setPerpendicular(on: boolean): void {
    this.#setPreference({ perpendicular: on });
  }

  get rowLineShown(): boolean {
    const rowId = this.#rowOfSelection() ?? this.#history.present.activeRowId;
    return rowLine(this.#history.present, rowId) !== undefined;
  }

  /** Moves the stitches onto the shape, and lets a whole row remember it. */
  #applyShape(
    target: { items: IrregularItem[]; rowId: string; wholeRow: boolean },
    shape: RowLine,
    message?: string,
  ): void {
    const placed = placeOnShape(target.items, shape);
    const byId = new Map(placed.map((item) => [item.id, item]));
    const moved: IrregularPattern = {
      ...this.#history.present,
      items: this.#history.present.items.map((item) => byId.get(item.id) ?? item),
    };
    const loosened = this.#looseIds(
      target.items.map((item) => item.id),
      moved,
    );
    const next = target.wholeRow ? setRowLine(loosened, target.rowId, shape) : loosened;
    this.#commit(next, message ?? texts().irregular.arranged(target.items.length));
  }

  /** FR-ARRANGE-8: one kind of stitch becomes a real fan, so it stays editable. */
  #arrangeIntoFan(items: IrregularItem[], rowId: string): void {
    const first = items[0];
    if (first === undefined) return;
    const oneKind = isStitch(first) && items.every((item) => isStitch(item) && item.keyEntryId === first.keyEntryId);
    const bases = items.map(basePoint);
    const origin = centerOf(bases);
    const tops = items.map((item) => topPoint(item));
    const direction = angleFromCenter(origin, centerOf(tops));
    const length = items.reduce((sum, item) => sum + item.height, 0) / items.length;
    if (!oneKind) {
      const shape: RowLine = {
        shape: 'arc',
        start: bases[0] ?? origin,
        end: bases[bases.length - 1] ?? origin,
        bulge: 0,
        side: 'left',
        perpendicular: this.#preferences.perpendicular,
      };
      this.#applyShape({ items, rowId, wholeRow: false }, shape);
      return;
    }
    const gone = forgetBrokenGroups(deleteItems(this.#history.present, new Set(items.map((item) => item.id))));
    const made = addFan(
      gone,
      {
        rowId,
        layerId: first.layerId,
        keyEntryId: first.keyEntryId,
        mode: 'spread',
        origin,
        direction,
        spreadAngle: this.#fanSpread,
        length,
        count: items.length,
      },
      this.#fanGlyph(first.keyEntryId),
    );
    const group = groupById(made.pattern, made.id);
    this.#setSelection(group === undefined ? [] : group.memberIds);
    this.#commit(made.pattern, texts().irregular.arranged(items.length));
  }

  spaceRows(spacing: number): void {
    const pattern = this.#history.present;
    const ids = pattern.rows.map((row) => row.id);
    const result = spaceRows(pattern, ids, spacing);
    const words = texts().irregular;
    const skippedRound = result.skipped.some((entry) => entry.code === 'round-without-line');
    if (result.pattern === pattern) {
      // Nothing moved, and there are several reasons for that: name the right one.
      this.#host.announce(skippedRound ? words.roundNeedsLine : words.rowsAlreadySpaced);
      return;
    }
    // The first row is the anchor and never moves, so it is not one of the moved.
    const moved = Math.max(0, ids.length - result.skipped.length - 1);
    this.#commit(result.pattern, skippedRound ? words.roundNeedsLine : words.rowsSpaced(moved));
  }

  alignRows(mode: RowAlign): void {
    const pattern = this.#history.present;
    const ids = pattern.rows.map((row) => row.id);
    const next = alignRows(pattern, ids, mode);
    this.#commit(next, next === pattern ? undefined : texts().irregular.rowsAligned);
  }

  /** Arranging moves stitches on their own, so any group they were in is forgotten. */
  #looseIds(ids: readonly string[], pattern: IrregularPattern): IrregularPattern {
    const groups = new Set<string>();
    for (const id of ids) {
      const group = groupOfItem(this.#history.present, id);
      if (group !== undefined) groups.add(group.id);
    }
    return groups.size === 0 ? pattern : explodeGroups(pattern, groups);
  }

  // -- annotations -------------------------------------------------------------

  #note: NoteKind | null = null;

  get noteArmed(): NoteKind | null {
    return this.#note;
  }

  toggleNoteTool(note: NoteKind): void {
    const wanted = this.#note === note ? null : note;
    this.#note = wanted;
    if (wanted !== null) {
      this.#arcTool = false;
      this.#fanTool = false;
      this.#stitch = null;
      this.#host.armStitch(null);
    }
    this.refresh();
  }

  /** The annotations the selection holds, when it holds only annotations. */
  get selectedNotes(): AnnotationItem[] {
    const chosen = itemsOf(this.#history.present, this.#selection);
    const notes = chosen.filter((item): item is AnnotationItem => !isStitch(item));
    return notes.length === chosen.length ? notes : [];
  }

  patchNotes(patch: NotePatch): void {
    if (this.#selection.size === 0) return;
    this.#commit(updateNotes(this.#history.present, this.#selection, patch));
  }

  /** What a row's label says: its number, and its direction when asked for. */
  #labelText(pattern: IrregularPattern, rowId: string, withArrow: boolean): string {
    const row = rowById(pattern, rowId);
    const number = rowNumber(pattern, rowId);
    const words = texts().irregular;
    if (row === undefined || !withArrow) return words.rowLabel(number, '');
    const arrow = ROW_ARROW[row.direction];
    return row.direction === 'rtl' ? words.rowLabelBefore(number, arrow) : words.rowLabel(number, arrow);
  }

  /** FR-ANN-1: one label per row, beside the row's first stitch. */
  numberRows(): void {
    let pattern = this.#history.present;
    let made = 0;
    for (const row of pattern.rows) {
      if (pattern.items.some((item) => !isStitch(item) && item.note === 'label' && item.linkedRowId === row.id)) {
        continue;
      }
      const first = rowOrder(pattern, row.id)
        .map((id) => pattern.items.find((item) => item.id === id))
        .find((item) => item !== undefined && isStitch(item));
      const box = first === undefined ? null : itemBox(first);
      const at = box === null ? { x: 0, y: 0 } : { x: box.minX - LABEL_GAP, y: (box.minY + box.maxY) / 2 };
      const text = this.#labelText(pattern, row.id, true);
      const size = noteSize('label', text, DEFAULT_FONT_SIZE);
      pattern = addNote(pattern, {
        note: 'label',
        rowId: row.id,
        x: at.x,
        y: at.y,
        width: size.width,
        height: size.height,
        text,
        linkedRowId: row.id,
        withArrow: true,
      }).pattern;
      made += 1;
    }
    if (made === 0) return;
    this.#commit(pattern, texts().irregular.notesNumbered(made));
  }

  /** FR-ANN-3: a short marker where a round starts. */
  addStartMarker(): void {
    const pattern = this.#history.present;
    const row = rowById(pattern, pattern.activeRowId);
    if (row?.kind !== 'round') {
      this.#host.announce(texts().irregular.startMarkerNeedsRound);
      return;
    }
    const first = rowOrder(pattern, row.id)
      .map((id) => pattern.items.find((item) => item.id === id))
      .find((item) => item !== undefined && isStitch(item));
    const box = first === undefined ? null : itemBox(first);
    const at =
      box === null
        ? this.#board.viewCenter(this.#host.insets().bottom)
        : { x: (box.minX + box.maxX) / 2, y: box.minY - LABEL_GAP };
    const size = noteSize('marker', '', DEFAULT_FONT_SIZE);
    const made = addNote(pattern, {
      note: 'marker',
      rowId: row.id,
      x: at.x,
      y: at.y,
      width: size.width,
      height: size.height,
      text: '',
      linkedRowId: row.id,
      dotted: true,
    });
    this.#setSelection([made.id]);
    this.#commit(made.pattern, texts().irregular.startMarkerAdded);
  }

  /** Labels follow their row: the number and the arrow are rebuilt on every commit. */
  #refreshLabels(pattern: IrregularPattern): IrregularPattern {
    let changed = false;
    const items = pattern.items.map((item) => {
      if (isStitch(item) || item.note !== 'label' || item.linkedRowId === undefined) return item;
      if (rowById(pattern, item.linkedRowId) === undefined) return item;
      const text = this.#labelText(pattern, item.linkedRowId, item.withArrow === true);
      if (text === item.text) return item;
      changed = true;
      return { ...item, text };
    });
    return changed ? { ...pattern, items } : pattern;
  }

  #placeNote(note: NoteKind, rawFrom: Point, rawTo: Point): void {
    const pattern = this.#history.present;
    const [from, to] = [this.#snap(rawFrom), this.#snap(rawTo)];
    const spread = Math.hypot(to.x - from.x, to.y - from.y);
    // KB: interface.md §40 — no dialog asks for the words. The annotation lands
    // and the panel's text field takes the focus, so typing goes straight in.
    const text = '';
    const size = noteSize(note, text, DEFAULT_FONT_SIZE);
    const wide = note === 'text' || spread < MIN_NOTE_SPAN ? size.width : spread;
    const made = addNote(pattern, {
      note,
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2,
      width: wide,
      height: size.height,
      text,
      rotation: spread < MIN_NOTE_SPAN ? 0 : angleFromCenter(from, to) - 90,
    });
    this.#setSelection([made.id]);
    this.#commit(made.pattern, texts().irregular.noteAdded);
    if (note === 'text' || note === 'bracket') this.#panel.focusNoteText();
  }

  // -- export ----------------------------------------------------------------

  #export = {
    scale: 2,
    transparent: false,
    size: 'a4' as PageSize,
    orientation: 'auto' as PageOrientation,
    across: 1,
    down: 1,
  };

  setExport(patch: Partial<typeof this.export>): void {
    const next = { ...this.#export, ...patch };
    // The writer clamps the page grid; the panel must show what the file will get.
    this.#export = {
      ...next,
      across: clampSide(next.across),
      down: clampSide(next.down),
      scale: [1, 2, 4].includes(next.scale) ? next.scale : 2,
    };
    this.refresh();
  }

  get export(): {
    scale: number;
    transparent: boolean;
    size: PageSize;
    orientation: PageOrientation;
    across: number;
    down: number;
  } {
    return this.#export;
  }

  get exportEmpty(): boolean {
    const pattern = this.#history.present;
    return !pattern.items.some((item) => isVisible(pattern, item));
  }

  /** Everything the two vector outputs need, gathered in one place. */
  #svgOptions(): IrregularSvgOptions {
    const pattern = this.#history.present;
    const placement = pattern.background;
    const loaded = this.#image;
    const photo =
      placement !== undefined && placement.inExport && loaded !== null && loaded.id === placement.id
        ? { placement, href: this.#host.imageHref(loaded.picture) }
        : null;
    return {
      symbols: this.#host.symbols(),
      glyphOf: (keyEntryId) => entryGlyph(pattern, keyEntryId),
      guides: this.#host.gridInExport(),
      background: photo,
      paper: this.#export.transparent ? null : '#ffffff',
      ink: this.#host.ink(),
    };
  }

  exportSvg(): string {
    return irregularSvg(this.#history.present, this.#svgOptions());
  }

  /** The chart as one flat run of shapes, which is all the PDF writer needs. */
  exportPdf(): Uint8Array {
    const pattern = this.#history.present;
    const symbols = this.#host.symbols();
    // The colours come with the stitches: a chart that tells rounds apart by
    // colour must not print black.
    const runs: { shapes: Shape[]; color: string | null }[] = [];
    const words: PdfText[] = [];
    for (const item of pattern.items) {
      if (!isVisible(pattern, item)) continue;
      const color = item.color ?? rowById(pattern, item.rowId)?.color ?? null;
      const last = runs[runs.length - 1];
      let shapes: Shape[];
      if (isStitch(item)) {
        shapes = [...itemShapes(item, symbols, entryGlyph(pattern, item.keyEntryId))];
      } else {
        const drawing = noteDrawing(item);
        shapes = [...drawing.shapes];
        // A row's number is words, not strokes; the print needs them too.
        for (const piece of drawing.texts) words.push({ ...piece, color });
      }
      if (last !== undefined && last.color === color) last.shapes.push(...shapes);
      else runs.push({ shapes, color });
    }
    const box = irregularBox(pattern, { background: null, guides: false });
    return writePdf({ shapes: [], runs, texts: words, lineWidth: 1.6 }, box, {
      title: pattern.title,
      size: this.#export.size,
      orientation: this.#export.orientation,
      across: this.#export.across,
      down: this.#export.down,
    });
  }

  get pdfPages(): number {
    return pageCount({
      title: '',
      size: this.#export.size,
      orientation: this.#export.orientation,
      across: this.#export.across,
      down: this.#export.down,
    });
  }

  // -- file ----------------------------------------------------------------

  exportJson(): string {
    return saveIrregular(this.#withNotation());
  }

  /** `true` only when the pattern really was loaded, so the caller can hold off switching type. */
  importJson(source: string): boolean {
    if (!isIrregularJson(source)) {
      this.#host.announce(texts().irregular.wrongFileKind);
      return false;
    }
    const loaded = loadIrregular(source);
    if (!loaded.ok) {
      const message = renderCoreText(IRREGULAR_JSON_CORE_TEXTS[uiLanguage()], loaded.error.message);
      this.#host.announce(texts().messages.file.loadFailed(message, loaded.error.path));
      return false;
    }
    const file = texts().messages.file;
    const recorded = loaded.pattern.notation?.terms;
    const shown = this.#host.notation().terms;
    const note = recorded !== undefined && recorded !== shown ? this.#host.notationNote(recorded, shown) : '';
    this.#setSelection([]);
    this.#image = null;
    this.#backgroundTrouble = null;
    this.#commit(oneGuideSize(loaded.pattern), file.loaded(note));
    // A file may name a tracing photo this browser has; fetch it before fitting.
    void this.#restoreBackground().then(() => this.#board.fit(this.#host.insets().bottom));
    return true;
  }

  applyNotation(): void {
    this.#persist();
    this.refresh();
  }

  #withNotation(): IrregularPattern {
    return withIrregularNotation(this.#history.present, this.#host.notation());
  }

  // -- drawing -------------------------------------------------------------

  /**
   * The drawing alone. A pointer move redraws dozens of times a second, and
   * rebuilding the row, layer and key lists that often costs a canvas per key
   * entry and a forced style read each time.
   */
  #refreshScene(): void {
    if (!this.#mounted) return;
    const room = this.#host.insets();
    this.#board.setInsets(room.left, room.right);
    const pattern = this.pattern;
    this.#board.setScene({
      pattern,
      symbols: this.#host.symbols(),
      selection: this.#selection,
      marquee: this.#drag?.kind === 'marquee' ? { from: this.#drag.from, to: this.#drag.to } : null,
      ghost: this.#ghost(),
      hover: null,
      glyphOf: (keyEntryId) => entryGlyph(pattern, keyEntryId),
      arc: this.selectedGroup,
      arcPreview: this.#drawingPreview(),
      rowLine: this.#activeRowLine(),
      background: this.#backgroundView(),
    });
    this.#panel.update(itemsOf(pattern, this.#selection), this.#preferences.rectPartial, pattern.items.length);
    this.#panel.updateArc(this.selectedArc);
    this.#panel.updateFan(this.selectedFan);
    this.#panel.updateBackground(this.#history.present.background ?? null, this.#image?.picture.naturalWidth ?? 0);
    this.#panel.updateExport(this.#export);
    this.#panel.updateNotes(this.selectedNotes);
    this.#panel.updateArrange({
      shown: this.#arrangeTargets().items.length >= 2,
      perpendicular: this.#preferences.perpendicular,
      hasRowLine: this.rowLineShown,
    });
  }

  refresh(): void {
    this.#refreshScene();
    if (!this.#mounted) return;
    const committed = this.#history.present;
    this.#rowsPanel.update(committed, { selectionSize: this.#selection.size });
    this.#panel.updateGuides(committed.guides, this.#preferences.radial);
    this.#layersPanel.update(committed, this.#selection.size, committed.background ?? null);
    this.#host.refreshControls();
  }

  /** The shape the active row remembers, drawn as a thin guide behind the work. */
  #activeRowLine(): GroupPath | null {
    const pattern = this.pattern;
    const rowId = this.#rowOfSelection() ?? pattern.activeRowId;
    const line = rowLine(pattern, rowId);
    return line === undefined ? null : rowLinePath(line);
  }

  /** The dashed path that follows the pointer while a group is being drawn. */
  #drawingPreview(): GroupPath | null {
    const drag = this.#drag;
    if (drag?.kind === 'fan-draw') {
      const origin = this.#snap(drag.from);
      const length = Math.hypot(drag.to.x - origin.x, drag.to.y - origin.y);
      if (length < FAN_LENGTH_RANGE.min) return null;
      return {
        mode: this.#fanMode,
        origin,
        direction: angleFromCenter(origin, drag.to),
        spreadAngle: this.#fanSpread,
        length,
        count: this.#fanCount,
      };
    }
    if (drag?.kind !== 'arc-draw') return null;
    const [start, end] = [this.#snap(drag.from), this.#snap(drag.to)];
    if (start.x === end.x && start.y === end.y) return null;
    return { shape: 'arc', start, end, bulge: presetBulge(start, end, DEFAULT_ARC_BULGE) };
  }

  #ghost(): readonly Shape[] | null {
    const stitch = this.#stitch;
    const pointer = this.#pointer;
    if (stitch === null || pointer === null || !this.#hoverCapable || this.#drag !== null) return null;
    // The ghost sits where the stitch would land, snapping and turn included.
    const at = this.#snap(pointer);
    const glyph = entryGlyph(this.pattern, stitch);
    const size = naturalSize(stitch, 'both-loops', this.#host.symbols(), glyph);
    return itemShapes(
      {
        id: 'ghost',
        kind: 'stitch',
        keyEntryId: stitch,
        insertion: 'both-loops',
        rowId: this.pattern.activeRowId,
        layerId: this.pattern.activeLayerId,
        color: null,
        x: at.x,
        y: at.y,
        width: size.width,
        height: size.height,
        rotation: this.#placedRotation(at),
        flipX: false,
        flipY: false,
      },
      this.#host.symbols(),
      glyph,
    );
  }

  #reachable(item: IrregularItem): boolean {
    const pattern = this.#history.present;
    const row = rowById(pattern, item.rowId);
    const layer = pattern.layers.find((candidate) => candidate.id === item.layerId);
    if (row !== undefined && (!row.visible || row.locked)) return false;
    return !(layer !== undefined && (!layer.visible || layer.locked));
  }

  // -- pointer -------------------------------------------------------------

  #listen(): void {
    // Dropping a picture on the drawing area loads it, which is how a photo
    // usually arrives. KB: interface.md §47
    this.#canvas.addEventListener('dragover', (event) => {
      if (event.dataTransfer?.types.includes('Files') === true) event.preventDefault();
    });
    this.#canvas.addEventListener('drop', (event) => {
      const file = event.dataTransfer?.files[0];
      if (file === undefined) return;
      // Whatever was dropped, the browser must not open it over the editor.
      event.preventDefault();
      if (file.type.startsWith('image/')) void this.loadBackground(file);
      else void this.#dropPattern(file);
    });
    this.#canvas.addEventListener('pointerdown', (event) => {
      if (!this.#mounted) return;
      this.#onDown(event);
    });
    this.#canvas.addEventListener('pointermove', (event) => {
      if (!this.#mounted) return;
      this.#onMove(event);
    });
    this.#canvas.addEventListener('pointerup', (event) => {
      if (!this.#mounted) return;
      this.#onUp(event);
    });
    this.#canvas.addEventListener('pointercancel', (event) => {
      if (!this.#mounted) return;
      this.#touches.delete(event.pointerId);
      this.#pinch = null;
      this.#endDrag();
    });
    this.#canvas.addEventListener('pointerleave', () => {
      if (!this.#mounted) return;
      this.#pointer = null;
      this.#refreshScene();
    });
    this.#canvas.addEventListener(
      'wheel',
      (event) => {
        if (!this.#mounted) return;
        event.preventDefault();
        if (event.ctrlKey || event.metaKey)
          this.#board.zoomAt(event.deltaY < 0 ? 1.1 : 0.9, event.clientX, event.clientY);
        else this.#board.pan(-event.deltaX, -event.deltaY);
      },
      { passive: false },
    );
  }

  /** The key can go down before or after the pointer, so both report it. */
  setFreeDown(down: boolean): void {
    this.#setFree(down);
  }

  setSpaceDown(down: boolean): void {
    this.#spaceDown = down;
  }

  /**
   * Two fingers zoom and pan; one finger uses whatever tool is armed. A second
   * finger arriving mid-drag cancels that drag, so a pinch never leaves a
   * half-made stitch behind. KB: interface.md §50
   */
  #touches = new Map<number, Point>();
  #pinch: { gap: number; middle: Point } | null = null;
  /** What the first finger found, so a second finger can put it all back. */
  #beforeTouch: { steps: number; selection: Set<string> } | null = null;

  #onDown(event: PointerEvent): void {
    this.#readFree(event);
    this.#canvas.focus({ preventScroll: true });
    this.#canvas.setPointerCapture(event.pointerId);
    if (event.pointerType === 'touch') {
      this.#touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (this.#touches.size === 2) {
        this.#startPinch();
        return;
      }
      if (this.#touches.size > 2) return;
      // The first finger acts at once, because waiting to see whether a second
      // one is coming would make every tap feel slow. If one does come, what the
      // first finger did is put back. KB: interface.md §50
      this.#beforeTouch = { steps: this.#history.past.length, selection: new Set(this.#selection) };
    }
    const point = this.#board.toChart(event.clientX, event.clientY);
    this.#pointer = point;

    if (event.button === 1 || this.#spaceDown) {
      this.#drag = { kind: 'pan', last: { x: event.clientX, y: event.clientY } };
      return;
    }
    if (event.button !== 0) return;

    /*
     * An arc's own grips come before everything else. They sit on the corners of
     * its selection box, and resizing an arc only breaks it up, so the endpoint
     * is what the hand was reaching for. They also beat the armed tool, which
     * stays armed, so the arc just drawn can be nudged without laying it down.
     * KB: interface.md §44
     */
    const grip = this.#board.arcHandleAt(event.clientX, event.clientY);
    const armed = this.selectedGroup;
    if (grip !== null && armed !== null) {
      this.#drag = { kind: 'arc-grip', id: armed.id, grip };
      return;
    }

    // The row line is a guide behind the work, so its grips come after the
    // selection's own but before anything that would start a new drawing.
    const lineGrip = this.#board.rowLineGripAt(event.clientX, event.clientY);
    if (lineGrip !== null && this.selectedGroup === null) {
      this.#drag = {
        kind: 'rowline-grip',
        rowId: this.#rowOfSelection() ?? this.#history.present.activeRowId,
        grip: lineGrip,
      };
      return;
    }

    const handle = this.#board.handleAt(event.clientX, event.clientY);
    if (handle !== null) {
      this.#startHandle(handle, point);
      return;
    }

    if (this.#note !== null) {
      this.#drag = { kind: 'note-draw', note: this.#note, from: point, to: point };
      return;
    }

    if (this.#arcTool) {
      this.#drag = { kind: 'arc-draw', from: point, to: point, free: this.#free };
      return;
    }

    if (this.#fanTool) {
      this.#drag = { kind: 'fan-draw', from: point, to: point, free: this.#free };
      return;
    }

    // The photo is behind everything, so it is grabbed only when nothing else was.
    if (
      this.#stitch === null &&
      !this.#arcTool &&
      !this.#fanTool &&
      // The circle guide's knob often sits over the photo; it wins.
      !this.#board.polarCenterAt(event.clientX, event.clientY) &&
      this.#board.backgroundAt(event.clientX, event.clientY)
    ) {
      const placement = this.#history.present.background;
      if (placement !== undefined) {
        this.#drag = { kind: 'background', from: point, at: { x: placement.x, y: placement.y } };
        return;
      }
    }

    // The circle guide's knob is only grabbable while no stitch is waiting to be placed.
    if (this.#stitch === null && this.#board.polarCenterAt(event.clientX, event.clientY)) {
      this.#drag = { kind: 'polar', from: point, center: this.#history.present.guides.polar.center };
      return;
    }

    if (this.#stitch !== null) {
      this.#place(point);
      return;
    }

    const hit = this.#board.itemAt(event.clientX, event.clientY);
    const additive = event.shiftKey || event.metaKey || (event.ctrlKey && !this.#isApple());
    if (hit !== null) {
      // KB: interface.md §43 — taking a stitch back out of the selection waits
      // for the pointer to come up, so ⌘ can also mean "drag without snapping".
      let drop: string | null = null;
      if (additive) {
        if (this.#selection.has(hit)) drop = hit;
        else this.#selection.add(hit);
      } else if (!this.#selection.has(hit)) {
        // KB: interface.md §44 — touching one stitch of a group takes the group.
        this.#setSelection(withWholeGroups(this.#history.present, [hit]));
      }
      const anchor = itemsOf(this.#history.present, this.#selection).find((item) => item.id === hit);
      this.#drag = {
        kind: 'move',
        from: point,
        anchor: anchor === undefined ? point : { x: anchor.x, y: anchor.y },
        drop,
      };
      this.refresh();
      return;
    }

    if (!additive) this.#setSelection([]);
    this.#drag = { kind: 'marquee', from: point, to: point, additive };
    this.refresh();
  }

  #isApple(): boolean {
    return /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
  }

  #place(raw: Point): void {
    const stitch = this.#stitch;
    if (stitch === null) return;
    const point = this.#snap(raw);
    const glyph = entryGlyph(this.#history.present, stitch);
    const size = naturalSize(stitch, 'both-loops', this.#host.symbols(), glyph);
    const made = addStitch(this.#history.present, {
      keyEntryId: stitch,
      x: point.x,
      y: point.y,
      width: size.width,
      height: size.height,
      rotation: this.#placedRotation(point),
      insertion: 'both-loops',
    });
    const row = made.pattern.rows.findIndex((candidate) => candidate.id === made.pattern.activeRowId) + 1;
    // A stitch of the crocheter's own has no library entry, so the key names it.
    const name = entryName(made.pattern, stitch, this.#host.terms());
    this.#commit(made.pattern, texts().irregular.placed(name, row, made.pattern.items.length));
  }

  #startHandle(handle: HandleId, point: Point): void {
    const base = itemsOf(this.#history.present, this.#selection);
    const box = this.#board.selectionBox();
    if (box === null) return;
    if (handle === 'rotate') {
      const center = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
      this.#drag = { kind: 'rotate', center, startAngle: angleOf(center, point), base };
      return;
    }
    const anchor = {
      x: handle.includes('w') ? box.maxX : box.minX,
      y: handle.includes('n') ? box.maxY : box.minY,
    };
    this.#drag = { kind: 'scale', handle, start: point, base, anchor };
  }

  /**
   * A pinch takes back whatever the first finger did on its way down — a placed
   * stitch, a cleared or changed selection — so zooming never draws.
   */
  #startPinch(): void {
    this.#endDrag();
    const before = this.#beforeTouch;
    this.#beforeTouch = null;
    if (before !== null) {
      while (this.#history.past.length > before.steps) this.#history = undo(this.#history);
      this.#selection = before.selection;
      this.#persist();
      this.refresh();
    }
    this.#pinch = this.#pinchOf();
  }

  #pinchOf(): { gap: number; middle: Point } | null {
    const [first, second] = [...this.#touches.values()];
    if (first === undefined || second === undefined) return null;
    return {
      gap: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
      middle: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
    };
  }

  #onMove(event: PointerEvent): void {
    this.#readFree(event);
    if (event.pointerType === 'touch' && this.#touches.has(event.pointerId)) {
      this.#touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const was = this.#pinch;
      if (this.#touches.size >= 2 && was !== null) {
        const now = this.#pinchOf();
        if (now === null) return;
        this.#board.zoomAndPan(now.gap / was.gap, was.middle, now.middle);
        this.#pinch = now;
        return;
      }
    }
    const point = this.#board.toChart(event.clientX, event.clientY);
    this.#pointer = point;
    const drag = this.#drag;
    if (drag === null) {
      if (this.#stitch !== null && this.#hoverCapable) this.#refreshScene();
      return;
    }
    switch (drag.kind) {
      case 'pan':
        this.#board.pan(event.clientX - drag.last.x, event.clientY - drag.last.y);
        drag.last = { x: event.clientX, y: event.clientY };
        return;
      case 'move': {
        const [rawX, rawY] = [point.x - drag.from.x, point.y - drag.from.y];
        const landing = this.#snap({ x: drag.anchor.x + rawX, y: drag.anchor.y + rawY }, this.#selection);
        const [dx, dy] = [landing.x - drag.anchor.x, landing.y - drag.anchor.y];
        this.#draft = this.#shifted(moveItems(this.#history.present, this.#selection, dx, dy), dx, dy);
        this.#refreshScene();
        return;
      }
      case 'arc-draw':
      case 'fan-draw':
        drag.free = this.#free;
        drag.to = point;
        this.#refreshScene();
        return;
      case 'note-draw':
        drag.to = point;
        this.#refreshScene();
        return;
      case 'arc-grip': {
        this.#draft = this.#grippedArc(drag, this.#snap(point, this.#selection));
        this.#refreshScene();
        return;
      }
      case 'rowline-grip': {
        this.#draft = this.#grippedRowLine(drag, this.#snap(point, this.#selection));
        this.#refreshScene();
        return;
      }
      case 'background':
        this.#draft = patchBackground(this.#history.present, {
          x: drag.at.x + (point.x - drag.from.x),
          y: drag.at.y + (point.y - drag.from.y),
        });
        this.#refreshScene();
        return;
      case 'polar':
        this.#draft = setPolar(this.#history.present, {
          center: { x: drag.center.x + (point.x - drag.from.x), y: drag.center.y + (point.y - drag.from.y) },
        });
        this.#refreshScene();
        return;
      case 'marquee':
        drag.to = point;
        this.#refreshScene();
        return;
      case 'scale':
        this.#draft = this.#loose(this.#scaled(drag, point, event.shiftKey));
        this.#refreshScene();
        return;
      case 'rotate': {
        const turn = angleOf(drag.center, point) - drag.startAngle;
        const step = event.shiftKey ? Math.round(turn / ROTATE_SNAP) * ROTATE_SNAP : turn;
        this.#draft = this.#loose(
          rotateItems(this.#history.present, this.#selection, step, drag.base.length === 1 ? null : drag.center),
        );
        this.#refreshScene();
        return;
      }
    }
  }

  /**
   * A lone stitch stretches along its own axes, so a turned glyph still grows
   * taller rather than sideways. Several stitches scale as one block.
   */
  #scaled(drag: Extract<Drag, { kind: 'scale' }>, point: Point, keepRatio: boolean): IrregularPattern {
    const single = drag.base.length === 1 ? drag.base[0] : undefined;
    const horizontal = drag.handle.includes('e') || drag.handle.includes('w');
    const vertical = drag.handle.includes('n') || drag.handle.includes('s');
    if (single !== undefined) {
      const radians = (-single.rotation * Math.PI) / 180;
      const [cos, sin] = [Math.cos(radians), Math.sin(radians)];
      const [dx, dy] = [point.x - drag.start.x, point.y - drag.start.y];
      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;
      const signX = drag.handle.includes('w') ? -1 : 1;
      const signY = drag.handle.includes('n') ? -1 : 1;
      let width = horizontal ? Math.max(MIN_SIZE, single.width + signX * localX) : single.width;
      let height = vertical ? Math.max(MIN_SIZE, single.height + signY * localY) : single.height;
      if (keepRatio && horizontal && vertical) {
        const k = Math.max(width / single.width, height / single.height);
        width = single.width * k;
        height = single.height * k;
      }
      return updateItems(this.#history.present, this.#selection, { width, height });
    }
    const spanX = Math.max(Math.abs(drag.start.x - drag.anchor.x), MIN_SIZE);
    const spanY = Math.max(Math.abs(drag.start.y - drag.anchor.y), MIN_SIZE);
    const kx = horizontal ? Math.abs(point.x - drag.anchor.x) / spanX : 1;
    const ky = vertical ? Math.abs(point.y - drag.anchor.y) / spanY : 1;
    // KB: interface.md §21 — several stitches keep their shape, so one factor drives both axes.
    const along = horizontal && vertical ? Math.min(kx, ky) : horizontal ? kx : ky;
    const k = Math.max(MIN_SIZE / 100, along);
    const moved = drag.base.map((item) => ({
      ...item,
      x: drag.anchor.x + (item.x - drag.anchor.x) * k,
      y: drag.anchor.y + (item.y - drag.anchor.y) * k,
      width: item.width * k,
      height: item.height * k,
    }));
    const byId = new Map(moved.map((item) => [item.id, item]));
    return {
      ...this.#history.present,
      items: this.#history.present.items.map((item) => byId.get(item.id) ?? item),
    };
  }

  /**
   * Reshaping a row line changes the line alone; the stitches follow only when
   * "Egyenletessé tesz" is pressed. KB: interface.md §46
   */
  #grippedRowLine(drag: Extract<Drag, { kind: 'rowline-grip' }>, point: Point): IrregularPattern {
    const pattern = this.#history.present;
    const line = rowLine(pattern, drag.rowId);
    if (line === undefined) return pattern;
    if (line.shape === 'circle') {
      const next =
        drag.grip === 'origin'
          ? { ...line, center: point }
          : { ...line, radius: Math.max(1, Math.hypot(point.x - line.center.x, point.y - line.center.y)) };
      return setRowLine(pattern, drag.rowId, next);
    }
    const next =
      drag.grip === 'bulge' && line.shape === 'arc'
        ? { ...line, bulge: bulgeThrough(line.start, line.end, point) }
        : drag.grip === 'start'
          ? { ...line, start: point }
          : { ...line, end: point };
    return setRowLine(pattern, drag.rowId, next);
  }

  /** What the arc becomes while one of its three grips is being dragged. */
  #grippedArc(drag: Extract<Drag, { kind: 'arc-grip' }>, point: Point): IrregularPattern {
    const group = groupById(this.#history.present, drag.id);
    if (group === undefined) return this.#history.present;
    if (group.kind === 'fan') {
      const patch: FanPatch =
        drag.grip === 'origin'
          ? { origin: point }
          : {
              direction: angleFromCenter(group.origin, point),
              length: Math.hypot(point.x - group.origin.x, point.y - group.origin.y),
            };
      return updateFan(this.#history.present, group.id, patch, this.#fanGlyph(group.keyEntryId));
    }
    const patch: ChainArcPatch =
      drag.grip === 'bulge'
        ? { bulge: bulgeThrough(group.start, group.end, point) }
        : drag.grip === 'start'
          ? { start: point }
          : { end: point };
    return updateChainArc(this.#history.present, group.id, patch, this.#arcGlyph(group.keyEntryId));
  }

  /** A press and a drag give the two ends; the preset bulge bows it to the left. */
  #finishArcDraw(drag: Extract<Drag, { kind: 'arc-draw' }>): void {
    const start = this.#snap(drag.from, undefined, drag.free);
    const end = this.#snap(drag.to, undefined, drag.free);
    if (start.x === end.x && start.y === end.y) {
      this.refresh();
      return;
    }
    const keyEntryId = ARC_STITCH;
    const pattern = this.#history.present;
    const made = addChainArc(
      pattern,
      {
        rowId: pattern.activeRowId,
        layerId: pattern.activeLayerId,
        keyEntryId,
        shape: 'arc',
        start,
        end,
        bulge: presetBulge(start, end, DEFAULT_ARC_BULGE),
        count: this.#arcCount,
      },
      this.#arcGlyph(keyEntryId),
    );
    const group = groupById(made.pattern, made.id);
    this.#setSelection(group === undefined ? [] : group.memberIds);
    const row = made.pattern.rows.findIndex((candidate) => candidate.id === pattern.activeRowId) + 1;
    this.#commit(made.pattern, texts().irregular.arcAdded(this.#arcCount, row));
  }

  #onUp(event?: PointerEvent): void {
    if (event !== undefined && event.pointerType === 'touch') {
      this.#touches.delete(event.pointerId);
      this.#beforeTouch = null;
      if (this.#pinch !== null) {
        // Lifting one of three fingers leaves a different pair, so the gesture
        // is re-seeded rather than measured against the pair that just changed.
        this.#pinch = this.#touches.size >= 2 ? this.#pinchOf() : null;
        if (this.#pinch === null) this.#endDrag();
        return;
      }
    }
    const drag = this.#drag;
    if (drag === null) return;
    if (drag.kind === 'marquee') {
      const ids = this.#board.itemsInRect(drag.from, drag.to, this.#preferences.rectPartial);
      if (drag.additive) for (const id of ids) this.#selection.add(id);
      else this.#setSelection(ids);
      this.#drag = null;
      this.refresh();
      if (ids.length > 0) this.#host.announce(texts().irregular.selected(this.#selection.size));
      return;
    }
    if (drag.kind === 'note-draw') {
      this.#drag = null;
      this.#draft = null;
      this.#placeNote(drag.note, drag.from, drag.to);
      return;
    }
    if (drag.kind === 'arc-draw' || drag.kind === 'fan-draw') {
      this.#drag = null;
      this.#draft = null;
      if (drag.kind === 'arc-draw') this.#finishArcDraw(drag);
      else this.#finishFanDraw(drag);
      return;
    }
    const draft = this.#draft;
    this.#drag = null;
    if (draft === null) {
      if (drag.kind === 'move' && drag.drop !== null) this.#selection.delete(drag.drop);
      this.refresh();
      return;
    }
    if (drag.kind === 'move') {
      this.#lastDuplicate = null;
      this.#commit(draft, texts().irregular.moved(this.#selection.size));
      return;
    }
    this.#commit(draft);
  }

  #endDrag(): void {
    this.#drag = null;
    this.#draft = null;
    this.refresh();
  }
}
