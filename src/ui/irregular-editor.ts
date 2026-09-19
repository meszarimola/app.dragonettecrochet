// The free-form chart editor (PQW-963). KB: interface.md §1, §9, §19

import { canRedo, canUndo, createHistory, type History, record, redo, undo } from '../core/history.ts';
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
  itemsOf,
  moveItems,
  pasteItems,
  rotateItems,
  rowById,
  setGrid,
  setTitle,
  updateItems,
  withIrregularNotation,
} from '../core/irregular-document.ts';
import { isIrregularJson, loadIrregular, saveIrregular } from '../core/irregular-json.ts';
import type { IrregularItem, IrregularPattern, Point } from '../core/irregular-types.ts';
import { stitchById } from '../core/stitches.ts';
import { stitchName } from '../core/stitchText.ts';
import type { PatternNotation, StitchDefId } from '../core/types.ts';
import { IRREGULAR_JSON_CORE_TEXTS } from './i18n/core/irregular-json.ts';
import { renderCoreText } from './i18n/core/render.ts';
import { texts, uiLanguage } from './i18n.ts';
import { FreeBoard, type HandleId } from './irregular-board.ts';
import { itemShapes, naturalSize } from './irregular-glyph.ts';
import { IrregularPanel } from './irregular-panel.ts';
import type { Shape, SymbolOptions } from './symbols.ts';

export const IRREGULAR_STORAGE_KEY = 'dc-mintatervezo:minta-szabalytalan';
export const IRREGULAR_PREFS_KEY = 'dc-mintatervezo:szabalytalan-beallitasok';

const ROTATE_SNAP = 15;
const MIN_SIZE = 2;

interface Preferences {
  readonly rectPartial: boolean;
}

const DEFAULT_PREFERENCES: Preferences = { rectPartial: true };

export interface IrregularHost {
  announce(message: string): void;
  symbols(): SymbolOptions;
  notation(): PatternNotation;
  insets(): { left: number; right: number; bottom: number };
  refreshControls(): void;
}

type Drag =
  | { kind: 'move'; last: Point; moved: boolean }
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
    const value = (parsed as Record<string, unknown>)['rectPartial'];
    return { rectPartial: typeof value === 'boolean' ? value : DEFAULT_PREFERENCES.rectPartial };
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
  readonly #host: IrregularHost;
  #history: History<IrregularPattern>;
  #draft: IrregularPattern | null = null;
  #selection = new Set<string>();
  #stitch: StitchDefId | null = null;
  #drag: Drag | null = null;
  #preferences = readPreferences();
  #clipboard: readonly IrregularItem[] = [];
  #lastDuplicate: Point | null = null;
  #pointer: Point | null = null;
  #hoverCapable = false;
  #mounted = false;
  #spaceDown = false;

  constructor(canvas: HTMLCanvasElement, section: HTMLDetailsElement, host: IrregularHost) {
    this.#canvas = canvas;
    this.#host = host;
    this.#board = new FreeBoard(canvas);
    this.#history = createHistory(this.#restore());
    this.#panel = new IrregularPanel(section, {
      patch: (patch) => this.#patch(patch),
      align: (mode) => this.#align(mode),
      distribute: (axis) => this.#distribute(axis),
      flip: (axis) => this.#flip(axis),
      setRectPartial: (partial) => {
        this.#preferences = { rectPartial: partial };
        this.#persistPreferences();
      },
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
    this.#applyNotation();
    this.refresh();
    this.#board.fit(this.#host.insets().bottom);
  }

  unmount(): void {
    this.#mounted = false;
    this.#draft = null;
    this.#drag = null;
    this.#panel.hide();
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
      localStorage.setItem(IRREGULAR_STORAGE_KEY, saveIrregular(this.#history.present));
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

  #commit(next: IrregularPattern, message?: string): void {
    this.#draft = null;
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
    this.refresh();
  }

  toggleGrid(): void {
    this.#commit(setGrid(this.#history.present, !this.gridVisible));
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
    this.#selection = new Set(pattern.items.filter((item) => this.#reachable(item)).map((item) => item.id));
    this.refresh();
    this.#host.announce(texts().irregular.selected(this.#selection.size));
  }

  clearSelection(): void {
    if (this.#selection.size === 0 && this.#stitch === null) return;
    this.#selection.clear();
    this.refresh();
  }

  deleteSelection(): void {
    const count = this.#selection.size;
    if (count === 0) return;
    const next = deleteItems(this.#history.present, this.#selection);
    this.#selection.clear();
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
    this.#selection = new Set(made.ids);
    this.#commit(made.pattern, texts().irregular.pasted(made.ids.length));
  }

  nudge(dx: number, dy: number): void {
    if (this.#selection.size === 0) return;
    this.#commit(moveItems(this.#history.present, this.#selection, dx, dy));
  }

  rotateSelection(degrees: number): void {
    if (this.#selection.size === 0) return;
    const pivot = this.#selection.size === 1 ? null : this.#selectionCenter();
    this.#commit(rotateItems(this.#history.present, this.#selection, degrees, pivot));
  }

  #selectionCenter(): Point | null {
    const box = this.#board.selectionBox();
    return box === null ? null : { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
  }

  #patch(patch: ItemPatch): void {
    if (this.#selection.size === 0) return;
    this.#commit(updateItems(this.#history.present, this.#selection, patch));
  }

  #align(mode: AlignMode): void {
    this.#commit(alignItems(this.#history.present, this.#selection, mode), texts().irregular.aligned);
  }

  #distribute(axis: DistributeAxis): void {
    this.#commit(distributeItems(this.#history.present, this.#selection, axis), texts().irregular.spread);
  }

  #flip(axis: FlipAxis): void {
    this.#commit(flipItems(this.#history.present, this.#selection, axis));
  }

  // -- file ----------------------------------------------------------------

  exportJson(): string {
    return saveIrregular(withIrregularNotation(this.#history.present, this.#host.notation()));
  }

  /** `false` means the file belongs to another pattern type and nothing changed. */
  importJson(source: string): boolean {
    if (!isIrregularJson(source)) {
      this.#host.announce(texts().irregular.wrongFileKind);
      return false;
    }
    const loaded = loadIrregular(source);
    if (!loaded.ok) {
      const message = renderCoreText(IRREGULAR_JSON_CORE_TEXTS[uiLanguage()], loaded.error.message);
      this.#host.announce(texts().messages.file.loadFailed(message, loaded.error.path));
      return true;
    }
    this.#selection.clear();
    this.#commit(loaded.pattern, texts().messages.file.loaded(''));
    this.#board.fit(this.#host.insets().bottom);
    return true;
  }

  applyNotation(): void {
    this.#applyNotation();
    this.refresh();
  }

  #applyNotation(): void {
    const next = withIrregularNotation(this.#history.present, this.#host.notation());
    if (next !== this.#history.present) this.#history = { ...this.#history, present: next };
  }

  // -- drawing -------------------------------------------------------------

  refresh(): void {
    if (!this.#mounted) return;
    const pattern = this.pattern;
    this.#board.setScene({
      pattern,
      symbols: this.#host.symbols(),
      selection: this.#selection,
      marquee: this.#drag?.kind === 'marquee' ? { from: this.#drag.from, to: this.#drag.to } : null,
      ghost: this.#ghost(),
      hover: null,
    });
    this.#panel.update(itemsOf(pattern, this.#selection), this.#preferences.rectPartial, pattern.items.length);
    this.#host.refreshControls();
  }

  #ghost(): readonly Shape[] | null {
    const stitch = this.#stitch;
    const at = this.#pointer;
    if (stitch === null || at === null || !this.#hoverCapable || this.#drag !== null) return null;
    const size = naturalSize(stitch, 'both-loops', this.#host.symbols());
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
        rotation: 0,
        flipX: false,
        flipY: false,
      },
      this.#host.symbols(),
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
      this.refresh();
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

    const handle = this.#board.handleAt(event.clientX, event.clientY);
    if (handle !== null) {
      this.#startHandle(handle, point);
      return;
    }

    if (this.#stitch !== null) {
      this.#place(point);
      return;
    }

    const hit = this.#board.itemAt(event.clientX, event.clientY);
    const additive = event.shiftKey || event.metaKey || (event.ctrlKey && !this.#isApple());
    if (hit !== null) {
      if (additive) {
        if (this.#selection.has(hit)) this.#selection.delete(hit);
        else this.#selection.add(hit);
      } else if (!this.#selection.has(hit)) {
        this.#selection = new Set([hit]);
      }
      this.#drag = { kind: 'move', last: point, moved: false };
      this.refresh();
      return;
    }

    if (!additive) this.#selection.clear();
    this.#drag = { kind: 'marquee', from: point, to: point, additive };
    this.refresh();
  }

  #isApple(): boolean {
    return /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
  }

  #place(point: Point): void {
    const stitch = this.#stitch;
    if (stitch === null) return;
    const size = naturalSize(stitch, 'both-loops', this.#host.symbols());
    const made = addStitch(this.#history.present, {
      keyEntryId: stitch,
      x: point.x,
      y: point.y,
      width: size.width,
      height: size.height,
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
      if (this.#stitch !== null && this.#hoverCapable) this.refresh();
      return;
    }
    switch (drag.kind) {
      case 'pan':
        this.#board.pan(event.clientX - drag.last.x, event.clientY - drag.last.y);
        drag.last = { x: event.clientX, y: event.clientY };
        return;
      case 'move': {
        const moved = moveItems(this.pattern, this.#selection, point.x - drag.last.x, point.y - drag.last.y);
        drag.last = point;
        drag.moved = true;
        this.#draft = moved;
        this.refresh();
        return;
      }
      case 'marquee':
        drag.to = point;
        this.refresh();
        return;
      case 'scale':
        this.#draft = this.#scaled(drag, point, event.shiftKey);
        this.refresh();
        return;
      case 'rotate': {
        const turn = angleOf(drag.center, point) - drag.startAngle;
        const step = event.shiftKey ? Math.round(turn / ROTATE_SNAP) * ROTATE_SNAP : turn;
        this.#draft = rotateItems(
          this.#history.present,
          this.#selection,
          step,
          drag.base.length === 1 ? null : drag.center,
        );
        this.refresh();
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
    const box = this.#board.selectionBox();
    if (box === null) return this.#history.present;
    const spanX = Math.max(Math.abs(drag.start.x - drag.anchor.x), MIN_SIZE);
    const spanY = Math.max(Math.abs(drag.start.y - drag.anchor.y), MIN_SIZE);
    const kx = horizontal ? Math.abs(point.x - drag.anchor.x) / spanX : 1;
    const ky = vertical ? Math.abs(point.y - drag.anchor.y) / spanY : 1;
    // KB: interface.md §21 — several stitches keep their shape, so one factor drives both axes.
    const k = Math.max(MIN_SIZE / 100, horizontal && vertical ? Math.min(kx, ky) : Math.max(kx, ky));
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

  #onUp(): void {
    const drag = this.#drag;
    if (drag === null) return;
    if (drag.kind === 'marquee') {
      const ids = this.#board.itemsInRect(drag.from, drag.to, this.#preferences.rectPartial);
      if (drag.additive) for (const id of ids) this.#selection.add(id);
      else this.#selection = new Set(ids);
      this.#drag = null;
      this.refresh();
      if (ids.length > 0) this.#host.announce(texts().irregular.selected(this.#selection.size));
      return;
    }
    const draft = this.#draft;
    this.#drag = null;
    if (draft === null) {
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
