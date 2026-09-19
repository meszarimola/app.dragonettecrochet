// The free-form chart editor (PQW-963). KB: interface.md §1, §9, §19

import { canRedo, canUndo, createHistory, type History, record, redo, undo } from '../core/history.ts';
import { bulgeThrough, presetBulge } from '../core/irregular-arc.ts';
import {
  type AlignMode,
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
  itemsBox,
  itemsOf,
  moveItems,
  type PolarPatch,
  pasteItems,
  rotateItems,
  rowById,
  setGrid,
  setGridSize,
  setPolar,
  setSnap,
  setTitle,
  updateItems,
  withIrregularNotation,
} from '../core/irregular-document.ts';
import {
  addChainArc,
  type ChainArcPatch,
  clampCount,
  explodeGroups,
  forgetBrokenGroups,
  type GlyphSize,
  groupById,
  groupOfItem,
  groupsOf,
  holdsWholeGroups,
  relayoutGroup,
  reseatGroups,
  translateGroups,
  updateChainArc,
  withWholeGroups,
} from '../core/irregular-groups.ts';
import { isIrregularJson, loadIrregular, saveIrregular } from '../core/irregular-json.ts';
import {
  entryGlyph,
  entryLabel,
  entryName,
  keyUsage,
  resetToPreset,
  sharedGlyphs,
  updateKeyEntry,
} from '../core/irregular-key.ts';
import {
  addLayer,
  deleteLayer,
  type LayerPatch,
  moveItemsToLayer,
  reorderLayers,
  setActiveLayer,
  updateLayer,
} from '../core/irregular-layers.ts';
import {
  isManualOrder,
  moveInOrder,
  orderPosition,
  resetOrder,
  rowOrder,
  setOrderPosition,
} from '../core/irregular-order.ts';
import {
  addRow,
  deleteRow,
  insertRowAfterActive,
  moveItemsToRow,
  type RowPatch,
  type RowStitches,
  reorderRows,
  setActiveRow,
  updateRow,
} from '../core/irregular-rows.ts';
import { radialRotation, snapPoint } from '../core/irregular-snap.ts';
import {
  type ChainArcGroup,
  DEFAULT_ARC_BULGE,
  DEFAULT_ARC_COUNT,
  type IrregularItem,
  type IrregularPattern,
  type LegendBlock,
  type Point,
  type RowKind,
} from '../core/irregular-types.ts';
import { stitchById } from '../core/stitches.ts';
import { stitchName } from '../core/stitchText.ts';
import type { Locale, PatternNotation, StitchDefId } from '../core/types.ts';
import { IRREGULAR_JSON_CORE_TEXTS } from './i18n/core/irregular-json.ts';
import { renderCoreText } from './i18n/core/render.ts';
import { texts, uiLanguage } from './i18n.ts';
import { type ArcHandleId, type ArcPath, FreeBoard, type HandleId, type LegendEntry } from './irregular-board.ts';
import { drawnGlyph, itemShapes, naturalSize } from './irregular-glyph.ts';
import { IrregularKeyPanel } from './irregular-key-panel.ts';
import { IrregularLayersPanel } from './irregular-layers-panel.ts';
import { IrregularPanel } from './irregular-panel.ts';
import { IrregularRowsPanel, rowName } from './irregular-rows-panel.ts';
import type { Shape, SymbolOptions } from './symbols.ts';

export const IRREGULAR_STORAGE_KEY = 'dc-mintatervezo:minta-szabalytalan';
export const IRREGULAR_PREFS_KEY = 'dc-mintatervezo:szabalytalan-beallitasok';

const ROTATE_SNAP = 15;
/** The chain arc is made of chains; the key decides what a chain looks like. */
const ARC_STITCH = 'ch';
/** How long a typed digit waits for the next one before it stands alone. */
const ARC_TYPING_GAP = 900;
const MIN_SIZE = 2;

interface Preferences {
  readonly rectPartial: boolean;
  readonly radial: boolean;
  readonly fadeOthers: boolean;
  readonly showOrder: boolean;
}

const DEFAULT_PREFERENCES: Preferences = { rectPartial: true, radial: false, fadeOthers: false, showOrder: false };
/** How near, in screen pixels, a snap target has to be to take the point. */
const SNAP_REACH = 10;

const DEFAULT_LEGEND: LegendBlock = {
  visible: false,
  position: { x: 0, y: 0 },
  columns: 1,
  showCounts: false,
};

export interface IrregularSections {
  readonly properties: HTMLDetailsElement;
  readonly rows: HTMLDetailsElement;
  readonly layers: HTMLDetailsElement;
  readonly key: HTMLDetailsElement;
}

export interface IrregularHost {
  announce(message: string): void;
  symbols(): SymbolOptions;
  notation(): PatternNotation;
  insets(): { left: number; right: number; bottom: number };
  notationNote(recorded: Locale, shown: Locale): string;
  terms(): Locale;
  refreshControls(): void;
  /** Lets the editor lay the palette's stitch down when another tool takes over. */
  armStitch(id: StitchDefId | null): void;
}

type Drag =
  | { kind: 'move'; from: Point; anchor: Point; drop: string | null }
  | { kind: 'polar'; from: Point; center: Point }
  | { kind: 'arc-draw'; from: Point; to: Point }
  | { kind: 'arc-grip'; id: string; grip: ArcHandleId }
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
      fadeOthers: flag('fadeOthers'),
      showOrder: flag('showOrder'),
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
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
  readonly #keyPanel: IrregularKeyPanel;
  readonly #host: IrregularHost;
  #history: History<IrregularPattern>;
  #draft: IrregularPattern | null = null;
  #selection = new Set<string>();
  #stitch: StitchDefId | null = null;
  #arcTool = false;
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
      setFadeOthers: (on) => this.#setPreference({ fadeOthers: on }),
      setShowOrder: (on) => this.#setPreference({ showOrder: on }),
      moveInOrder: (delta) => this.#moveInOrder(delta),
      setOrderPlace: (place) => this.#setOrderPlace(place),
      resetOrder: () => this.#resetOrder(),
    });
    this.#layersPanel = new IrregularLayersPanel(sections.layers, {
      addLayer: () => this.#addLayer(),
      deleteLayer: (layerId) => this.#deleteLayer(layerId),
      activate: (layerId) => this.#commit(setActiveLayer(this.#history.present, layerId)),
      update: (layerId, patch) => this.#updateLayer(layerId, patch),
      reorder: (layerId, toIndex) => this.#commit(reorderLayers(this.#history.present, layerId, toIndex)),
      moveSelection: (layerId) => this.#moveSelectionToLayer(layerId),
    });
    this.#keyPanel = new IrregularKeyPanel(sections.key, {
      setGlyph: (id, glyph) => this.#setGlyph(id, glyph),
      setAbbreviation: (id, value) => this.#commitKey(id, { abbreviationOverride: value }),
      setLabel: (id, value) => this.#commitKey(id, { labelOverride: value }),
      resetKey: () => this.#commit(resetToPreset(this.#history.present), texts().irregular.keyReset),
      setLegend: (patch) => this.#setLegend(patch),
    });
    this.#panel = new IrregularPanel(sections.properties, {
      patch: (patch) => this.#patch(patch),
      align: (mode) => this.#align(mode),
      distribute: (axis) => this.#distribute(axis),
      flip: (axis) => this.#flip(axis),
      setRectPartial: (partial) => this.#setPreference({ rectPartial: partial }),
      setGridSize: (size) => this.#commit(setGridSize(this.#history.present, size)),
      setSnap: (on) => this.#commit(setSnap(this.#history.present, on)),
      setPolar: (patch) => this.#setPolar(patch),
      setRadial: (on) => this.#setPreference({ radial: on }),
      setArcCount: (count) => this.setArcCount(count),
      setArcShape: (shape) => this.setArcShape(shape),
      setArcBulge: (bulge) => this.setArcBulge(bulge),
      explodeArc: () => this.explodeSelectedArc(),
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
    this.#panel.reveal();
    this.#rowsPanel.reveal();
    this.#layersPanel.reveal();
    this.#keyPanel.reveal();
    this.refresh();
    this.#board.fit(this.#host.insets().bottom);
  }

  unmount(): void {
    this.#mounted = false;
    this.#draft = null;
    this.#drag = null;
    this.#panel.hide();
    this.#rowsPanel.hide();
    this.#layersPanel.hide();
    this.#keyPanel.hide();
  }

  #setPreference(patch: Partial<Preferences>): void {
    this.#preferences = { ...this.#preferences, ...patch };
    this.#persistPreferences();
    this.refresh();
  }

  // -- structure -----------------------------------------------------------

  get legend(): LegendBlock {
    return this.#history.present.legend ?? DEFAULT_LEGEND;
  }

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

  #moveInOrder(delta: number): void {
    const id = this.#onlySelected();
    if (id === null) return;
    const item = this.#history.present.items.find((candidate) => candidate.id === id);
    if (item === undefined) return;
    this.#commit(moveInOrder(this.#history.present, item.rowId, id, delta));
  }

  #setOrderPlace(place: number): void {
    const id = this.#onlySelected();
    const rowId = this.#rowOfSelection();
    if (id === null || rowId === null) return;
    this.#commit(setOrderPosition(this.#history.present, rowId, id, place));
  }

  #resetOrder(): void {
    const rowId = this.#rowOfSelection() ?? this.#history.present.activeRowId;
    this.#commit(resetOrder(this.#history.present, rowId), texts().irregular.orderReset);
  }

  #orderPlace(pattern: IrregularPattern, rowId: string): number | null {
    const id = this.#onlySelected();
    return id === null ? null : orderPosition(pattern, rowId, id);
  }

  #rowOfSelection(): string | null {
    const id = this.#onlySelected();
    if (id === null) return null;
    return this.#history.present.items.find((candidate) => candidate.id === id)?.rowId ?? null;
  }

  #commitKey(id: string, patch: { abbreviationOverride?: string | null; labelOverride?: string | null }): void {
    this.#commit(updateKeyEntry(this.#history.present, id, patch));
  }

  /**
   * A stitch stores the size it is drawn at, measured from its symbol. Give it a
   * different symbol and the stored size still belongs to the old one, so the new
   * symbol would be squeezed into the old one's box. Each stitch keeps the stretch
   * the crocheter gave it and takes the new symbol's proportions.
   */
  #setGlyph(id: string, glyph: string | null): void {
    const pattern = this.#history.present;
    const next = updateKeyEntry(pattern, id, { glyphOverride: glyph });
    if (next === pattern) return;
    const symbols = this.#host.symbols();
    const was = entryGlyph(pattern, id);
    const now = entryGlyph(next, id);
    const items = next.items.map((item) => {
      if (item.keyEntryId !== id) return item;
      const before = naturalSize(item.keyEntryId, item.insertion, symbols, was);
      const after = naturalSize(item.keyEntryId, item.insertion, symbols, now);
      return {
        ...item,
        width: (item.width / before.width) * after.width,
        height: (item.height / before.height) * after.height,
      };
    });
    // KB: interface.md §41 — an arc is drawn from the key too, so it is laid out again.
    let redrawn: IrregularPattern = { ...next, items };
    for (const group of groupsOf(redrawn)) {
      if (group.keyEntryId !== id) continue;
      redrawn = relayoutGroup(redrawn, group.id, naturalSize(id, 'both-loops', symbols, now));
    }
    this.#commit(redrawn);
  }

  #setLegend(patch: Partial<LegendBlock>): void {
    const current = this.legend;
    // The first time it is actually shown it drops below the drawing, not on top of it.
    const untouched = current.position.x === 0 && current.position.y === 0;
    const showing = patch.visible === true && !current.visible;
    const position = showing && untouched ? this.#legendHome() : (patch.position ?? current.position);
    this.#commit({ ...this.#history.present, legend: { ...current, ...patch, position } });
  }

  #legendHome(): Point {
    const box = itemsBox(this.#history.present.items);
    return box === null ? { x: 0, y: 0 } : { x: box.minX, y: box.maxY + 60 };
  }

  /**
   * One symbol standing for two stitches makes the chart ambiguous: "•" is a slip
   * stitch in one reference chart and a chain in another. KB: 01 §6.1
   */
  issues(): string[] {
    const pattern = this.#history.present;
    const terms = this.#host.terms();
    const words = texts().irregular;
    return sharedGlyphs(pattern, (id) => drawnGlyph(id, entryGlyph(pattern, id))).flatMap((clash) => {
      const [first, second] = clash.keyEntryIds;
      if (first === undefined || second === undefined) return [];
      return [words.sharedGlyph(entryName(pattern, first, terms), entryName(pattern, second, terms))];
    });
  }

  #legendEntries(): LegendEntry[] {
    const pattern = this.#history.present;
    const terms = this.#host.terms();
    const showCounts = this.legend.showCounts;
    return keyUsage(pattern).map((usage) => ({
      keyEntryId: usage.keyEntryId,
      glyph: entryGlyph(pattern, usage.keyEntryId),
      text: showCounts
        ? `${entryLabel(pattern, usage.keyEntryId, terms)} · ${usage.count}`
        : entryLabel(pattern, usage.keyEntryId, terms),
    }));
  }

  // -- storage -------------------------------------------------------------

  #restore(): IrregularPattern {
    const fresh = this.#empty();
    try {
      const saved = localStorage.getItem(IRREGULAR_STORAGE_KEY);
      if (saved === null) return fresh;
      const loaded = loadIrregular(saved);
      return loaded.ok ? loaded.pattern : fresh;
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
    const next = reseatGroups(candidate);
    if (next !== this.#history.present) {
      this.#history = record(this.#history, next);
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
    this.#stitch = id;
    if (id !== null) this.#arcTool = false;
    this.refresh();
  }

  get arcArmed(): boolean {
    return this.#arcTool;
  }

  /** The chain arc the selection holds, when it holds exactly one and nothing else. */
  get selectedArc(): ChainArcGroup | null {
    const groups = groupsOf(this.pattern).filter((group) =>
      group.memberIds.some((member) => this.#selection.has(member)),
    );
    const only = groups.length === 1 ? groups[0] : undefined;
    if (only === undefined || only.memberIds.length !== this.#selection.size) return null;
    return only.memberIds.every((member) => this.#selection.has(member)) ? only : null;
  }

  toggleArcTool(): void {
    this.#arcTool = !this.#arcTool;
    if (this.#arcTool) {
      this.#stitch = null;
      this.#host.armStitch(null);
    }
    this.refresh();
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
    this.setArcCount(wanted);
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

  explodeSelectedArc(): void {
    const arc = this.selectedArc;
    if (arc === null) return;
    this.#commit(explodeGroups(this.#history.present, [arc.id]), texts().irregular.arcExploded(arc.count));
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
  #setPolar(patch: PolarPatch): void {
    const current = this.#history.present.guides.polar;
    const arriving = patch.visible === true && !current.visible;
    const room = this.#host.insets().bottom;
    const home = arriving && !this.#board.onScreen(current.center, room) ? this.#board.viewCenter(room) : undefined;
    this.#commit(setPolar(this.#history.present, home === undefined ? patch : { ...patch, center: home }));
  }

  /** The nearest guide or neighbouring stitch, measured in chart units. */
  #snap(point: Point, skip?: ReadonlySet<string>): Point {
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
    this.#commit(loaded.pattern, file.loaded(note));
    this.#board.fit(this.#host.insets().bottom);
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
    const committed = this.#history.present;
    const orderRow = this.#rowOfSelection() ?? committed.activeRowId;
    this.#board.setScene({
      pattern,
      symbols: this.#host.symbols(),
      selection: this.#selection,
      marquee: this.#drag?.kind === 'marquee' ? { from: this.#drag.from, to: this.#drag.to } : null,
      ghost: this.#ghost(),
      hover: null,
      glyphOf: (keyEntryId) => entryGlyph(pattern, keyEntryId),
      fadeOthers: this.#preferences.fadeOthers,
      order: this.#preferences.showOrder ? rowOrder(pattern, orderRow) : null,
      arc: this.selectedArc,
      arcPreview: this.#arcPreview(),
      legend: { block: this.legend, entries: this.#legendEntries() },
    });
    this.#panel.update(itemsOf(pattern, this.#selection), this.#preferences.rectPartial, pattern.items.length);
    this.#panel.updateArc(this.selectedArc);
  }

  refresh(): void {
    this.#refreshScene();
    if (!this.#mounted) return;
    const committed = this.#history.present;
    const orderRow = this.#rowOfSelection() ?? committed.activeRowId;
    this.#rowsPanel.update(committed, {
      fadeOthers: this.#preferences.fadeOthers,
      showOrder: this.#preferences.showOrder,
      selectionSize: this.#selection.size,
      manualOrder: isManualOrder(committed, orderRow),
      orderPlace: this.#orderPlace(committed, orderRow),
    });
    this.#panel.updateGuides(committed.guides, this.#preferences.radial);
    this.#layersPanel.update(committed, this.#selection.size);
    this.#keyPanel.update(committed, this.#host.terms(), this.#host.symbols(), this.legend);
    this.#host.refreshControls();
  }

  /** The dashed path that follows the pointer while an arc is being drawn. */
  #arcPreview(): ArcPath | null {
    const drag = this.#drag;
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
    this.#canvas.addEventListener('pointerdown', (event) => {
      if (!this.#mounted) return;
      this.#onDown(event);
    });
    this.#canvas.addEventListener('pointermove', (event) => {
      if (!this.#mounted) return;
      this.#onMove(event);
    });
    this.#canvas.addEventListener('pointerup', () => {
      if (!this.#mounted) return;
      this.#onUp();
    });
    this.#canvas.addEventListener('pointercancel', () => {
      if (!this.#mounted) return;
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

  setSpaceDown(down: boolean): void {
    this.#spaceDown = down;
  }

  #onDown(event: PointerEvent): void {
    this.#canvas.focus({ preventScroll: true });
    this.#canvas.setPointerCapture(event.pointerId);
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
    const armed = this.selectedArc;
    if (grip !== null && armed !== null) {
      this.#drag = { kind: 'arc-grip', id: armed.id, grip };
      return;
    }

    const handle = this.#board.handleAt(event.clientX, event.clientY);
    if (handle !== null) {
      this.#startHandle(handle, point);
      return;
    }

    if (this.#arcTool) {
      this.#drag = { kind: 'arc-draw', from: point, to: point };
      return;
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
    const def = stitchById(stitch);
    const row = made.pattern.rows.findIndex((candidate) => candidate.id === made.pattern.activeRowId) + 1;
    const name = def === undefined ? stitch : stitchName(def, this.#host.notation().terms);
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

  #onMove(event: PointerEvent): void {
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
        // KB: interface.md §43 — holding ⌘ or Ctrl while dragging puts snapping aside.
        const free = event.metaKey || event.ctrlKey;
        const landing = free ? null : this.#snap({ x: drag.anchor.x + rawX, y: drag.anchor.y + rawY }, this.#selection);
        const [dx, dy] = [
          landing === null ? rawX : landing.x - drag.anchor.x,
          landing === null ? rawY : landing.y - drag.anchor.y,
        ];
        this.#draft = this.#shifted(moveItems(this.#history.present, this.#selection, dx, dy), dx, dy);
        this.#refreshScene();
        return;
      }
      case 'arc-draw':
        drag.to = point;
        this.#refreshScene();
        return;
      case 'arc-grip': {
        this.#draft = this.#grippedArc(drag, this.#snap(point, this.#selection));
        this.#refreshScene();
        return;
      }
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

  /** What the arc becomes while one of its three grips is being dragged. */
  #grippedArc(drag: Extract<Drag, { kind: 'arc-grip' }>, point: Point): IrregularPattern {
    const arc = groupById(this.#history.present, drag.id);
    if (arc === undefined || arc.kind !== 'chainArc') return this.#history.present;
    const patch: ChainArcPatch =
      drag.grip === 'bulge'
        ? { bulge: bulgeThrough(arc.start, arc.end, point) }
        : drag.grip === 'start'
          ? { start: point }
          : { end: point };
    return updateChainArc(this.#history.present, arc.id, patch, this.#arcGlyph(arc.keyEntryId));
  }

  /** A press and a drag give the two ends; the preset bulge bows it to the left. */
  #finishArcDraw(drag: Extract<Drag, { kind: 'arc-draw' }>): void {
    const start = this.#snap(drag.from);
    const end = this.#snap(drag.to);
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

  #onUp(): void {
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
    if (drag.kind === 'arc-draw') {
      this.#drag = null;
      this.#draft = null;
      this.#finishArcDraw(drag);
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
