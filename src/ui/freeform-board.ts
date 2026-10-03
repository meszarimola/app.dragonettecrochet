import {
  allInside,
  boundedFactor,
  boundedMove,
  type Extent,
  type Frame,
  type FreeformChart,
  frameHolds,
  moveStitches,
  type PlacedStitch,
  type Point,
  type Rect,
  rectOf,
  rotateStitches,
  scaleStitches,
  selectionFrame,
  stitchAt,
  stitchesIn,
  turn,
} from '../core/freeform.ts';
import { GRID_CELL, gridExtent, gridHome, gridRows, type RectGrid, type RowHeights } from '../core/grid.ts';
import { type NaturalSize, rowHeights } from '../core/seat.ts';
import { stitchById } from '../core/stitches.ts';
import {
  clampView,
  DEFAULT_VIEW,
  panBy,
  sheetOf,
  toBoard,
  type View,
  visibleRect,
  zoomAt,
  zoomStep,
} from '../core/view.ts';
import { applyInk, drawCentered, type Shape, type SymbolOptions, shapeBounds, symbolShapes } from './symbols.ts';

/** How much larger a stitch is drawn on the canvas than in its own symbol units. */
export const STITCH_SCALE = 1.5;
/** A stitch is never harder to hit than this, however small its symbol. */
const MIN_REACH = 8;
const FRAME_PAD = 6;
const HANDLE_GAP = 22;
const HANDLE_R = 6;
const CORNER = 8;
const HANDLE_HIT = HANDLE_R + 4;
/** Below this many pixels a press is a click, not a drag: mouse jitter must not move a stitch. */
const DRAG_SLOP = 3;
/** A placing click that wobbles this far is still a click: a finger drifts further than a mouse. */
const PAN_SLOP_MOUSE = 8;
const PAN_SLOP_TOUCH = 16;
/** How fast the wheel zooms: a mouse notch is about 100, a trackpad pinch reports far less. */
const WHEEL_RATE = 0.002;
const PINCH_RATE = 0.01;
const PINCH_LIMIT = 50;
const GRID_ALPHA = 0.28;
/** In board units, so the row numbers grow and shrink with the grid. */
const GRID_LABEL_SIZE = 14;
/** The corners in frame space, clockwise from the top left. */
const CORNERS: readonly Point[] = [
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
];

export type BoardMode = 'place' | 'select';

export interface BoardHost {
  place(point: Point): void;
  /** Called live on every pointer move of a drag. */
  change(chart: FreeformChart): void;
  /** Called once a move, a turn or a resize is let go: the whole drag is one change. */
  settled(): void;
  /** Called whenever the selected set changes, not only its size. */
  selectionChanged(count: number): void;
  /** A pan as well as a zoom. */
  viewChanged(view: View): void;
}

type Drag =
  | {
      readonly kind: 'move';
      readonly start: Point;
      readonly base: FreeformChart;
      /** A plain press on a stitch of a larger selection: it narrows to this one if the press stays a click. */
      readonly narrowTo: number | null;
      moved: boolean;
    }
  | {
      readonly kind: 'rotate';
      /** The frame at the press: while the drag lasts it is this frame turned, whatever the stitches' own turns. */
      readonly frame: Frame;
      readonly side: -1 | 1;
      readonly startAngle: number;
      readonly base: FreeformChart;
      angle: number;
    }
  | {
      readonly kind: 'scale';
      readonly center: Point;
      /** The unit vector from the centre to the grabbed corner. */
      readonly axis: Point;
      readonly length: number;
      /** The part of `length` that is frame padding, which does not grow with the stitches. */
      readonly pad: number;
      readonly base: FreeformChart;
    }
  | { readonly kind: 'area'; readonly start: Point; current: Point; readonly base: ReadonlySet<number> }
  /**
   * Screen points, moved step by step from the current view, so a zoom in the
   * middle of a pan is kept. Until it leaves `slop` it is still a placing click.
   */
  | { readonly kind: 'pan'; last: Point; moved: boolean; readonly slop: number };

/** The selection frame as it is drawn, with its handles in board coordinates. */
interface Handles {
  readonly frame: Frame;
  readonly rotate: Point;
  /** -1: the rotation handle stands above the frame (in frame space), 1: below it. */
  readonly side: -1 | 1;
  readonly corners: readonly Point[];
}

export class FreeformBoard {
  private chart: FreeformChart | null = null;
  private symbols: SymbolOptions = { singleCrochet: 'plus' };
  private mode: BoardMode = 'place';
  private selection = new Set<number>();
  private notified: string | null = null;
  private drag: Drag | null = null;
  private view: View = DEFAULT_VIEW;
  /** Space is held: any press moves the view, whatever the mode. */
  private panHeld = false;
  /** A pan ended under a press that will still fire a click; that click places nothing. */
  private swallowClick = false;
  private pointerOver = false;
  private gestureBase = 1;
  private labelFont: string | null = null;
  private heights: { readonly chart: FreeformChart; readonly heights: RowHeights } | null = null;
  private readonly shapes = new Map<string, { shapes: Shape[]; reach: number; extent: Extent }>();
  private readonly canvas: HTMLCanvasElement;
  private readonly ink: string;
  private readonly accent: string;
  private readonly host: BoardHost;

  constructor(canvas: HTMLCanvasElement, ink: string, accent: string, host: BoardHost) {
    this.canvas = canvas;
    this.ink = ink;
    this.accent = accent;
    this.host = host;
    // A click, not a press: a pinch or a scroll that never became a click places nothing.
    canvas.addEventListener('click', (event) => {
      if (this.swallowClick) this.swallowClick = false;
      else if (this.mode === 'place' && this.chart !== null && !this.panHeld) this.host.place(this.point(event));
    });
    canvas.addEventListener('pointerdown', (event) => this.down(event));
    canvas.addEventListener('pointermove', (event) => this.moveTo(event));
    canvas.addEventListener('pointerup', () => this.up(false));
    canvas.addEventListener('wheel', (event) => this.wheel(event), { passive: false });
    canvas.addEventListener('gesturestart', (event) => this.gesture(event, true));
    canvas.addEventListener('gesturechange', (event) => this.gesture(event, false));
    canvas.addEventListener('pointerenter', () => {
      this.pointerOver = true;
    });
    canvas.addEventListener('pointerleave', () => {
      this.pointerOver = false;
    });
    canvas.addEventListener('pointercancel', () => this.up(true));
    // Ctrl + click on a Mac is the context menu; here it adds to the selection.
    canvas.addEventListener('contextmenu', (event) => {
      if (this.mode === 'select') event.preventDefault();
    });
    new ResizeObserver(() => this.draw()).observe(canvas);
  }

  /** With `selection`, the board selects exactly those stitches, in the same redraw. */
  show(chart: FreeformChart | null, symbols: SymbolOptions, selection?: ReadonlySet<number>): void {
    if (selection !== undefined && this.drag === null) this.selection = new Set(selection);
    if (chart !== this.chart && chart !== null) {
      const ids = new Set(chart.stitches.map(({ id }) => id));
      for (const id of this.selection) if (!ids.has(id)) this.selection.delete(id);
    }
    if (symbols.style !== this.symbols.style || symbols.singleCrochet !== this.symbols.singleCrochet) {
      this.shapes.clear();
      this.heights = null;
    }
    this.chart = chart;
    this.symbols = symbols;
    this.canvas.hidden = chart === null;
    this.draw();
  }

  setMode(mode: BoardMode): void {
    this.mode = mode;
    this.drag = null;
    if (mode === 'place') this.selection.clear();
    this.canvas.style.cursor = '';
    this.draw();
  }

  /** While on, a press anywhere moves the view; letting go gives the mode back. */
  holdPan(on: boolean): void {
    if (on === this.panHeld) return;
    this.panHeld = on;
    if (!this.dragging) this.canvas.style.cursor = on ? 'grab' : '';
  }

  get zoom(): number {
    return this.view.zoom;
  }

  /** Zooms about the middle of the screen, or about `anchor`, a screen point. */
  zoomTo(zoom: number, anchor?: Point): void {
    const { width, height } = this.size();
    this.setView(zoomAt(this.view, zoom, anchor ?? { x: width / 2, y: height / 2 }, this.size(), this.sheet()));
  }

  /** Back to 100% where the chart starts: the sheet's home corner at the top left, or a grid's row 1 at the bottom left. */
  resetView(): void {
    this.setView(this.home());
  }

  /** Measured on the board as it is now shown: a hidden board has no size. KB: interface.md §89 */
  home(): View {
    const grid = this.chart?.grid;
    return grid === undefined ? DEFAULT_VIEW : gridHome(grid, this.size());
  }

  showView(view: View): void {
    this.setView(view);
  }

  zoomStep(direction: 1 | -1): void {
    this.zoomTo(zoomStep(this.view.zoom, direction));
  }

  private setView(view: View): void {
    const next = clampView(view, this.size(), this.sheet());
    if (next.zoom === this.view.zoom && next.origin.x === this.view.origin.x && next.origin.y === this.view.origin.y)
      return;
    this.view = next;
    this.host.viewChanged(next);
    this.draw();
  }

  private wheel(event: WheelEvent): void {
    if (this.chart === null) return;
    event.preventDefault();
    const delta = event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1);
    // A trackpad pinch arrives as a wheel with Ctrl held and small steps; Ctrl + a mouse notch is still a notch.
    const rate = event.ctrlKey && Math.abs(delta) < PINCH_LIMIT ? PINCH_RATE : WHEEL_RATE;
    this.zoomTo(this.view.zoom * Math.exp(-delta * rate), this.screenPoint(event));
  }

  /** Safari reports a trackpad pinch as gesture events with a scale, not as a wheel. */
  private gesture(event: Event, start: boolean): void {
    if (this.chart === null) return;
    event.preventDefault();
    const { scale, clientX, clientY } = event as Event & { scale: number; clientX: number; clientY: number };
    if (start) this.gestureBase = this.view.zoom;
    const box = this.canvas.getBoundingClientRect();
    this.zoomTo(this.gestureBase * scale, { x: clientX - box.left, y: clientY - box.top });
  }

  clearSelection(): void {
    if (this.drag !== null) return;
    this.selection.clear();
    this.draw();
  }

  get selected(): ReadonlySet<number> {
    return this.selection;
  }

  /** A press that may still turn out to be a placing click is not a drag yet. */
  get dragging(): boolean {
    return this.drag !== null && !(this.drag.kind === 'pan' && !this.drag.moved);
  }

  get hovered(): boolean {
    return this.pointerOver;
  }

  /** The board point under the pointer. */
  private point(event: MouseEvent): Point {
    return toBoard(this.view, this.screenPoint(event));
  }

  private screenPoint(event: MouseEvent): Point {
    const box = this.canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  /** A length on screen, in board units. */
  private px(length: number): number {
    return length / this.view.zoom;
  }

  /** The canvas's own size in screen pixels. */
  size(): { width: number; height: number } {
    return { width: this.canvas.clientWidth, height: this.canvas.clientHeight };
  }

  /** In board units. KB: interface.md §87 */
  sheet(): Rect {
    const grid = this.chart?.grid;
    const points: Point[] = [...(this.chart?.stitches ?? [])];
    if (grid !== undefined) {
      const { minX, minY, maxX, maxY } = gridExtent(grid, this.rowHeights());
      points.push({ x: minX, y: minY }, { x: maxX, y: maxY });
    }
    return sheetOf(this.size(), points);
  }

  /** What is on screen, in board units. */
  visible(): Rect {
    return visibleRect(this.view, this.size());
  }

  private down(event: PointerEvent): void {
    // A pan whose click never came (a touch that moved, a release off the canvas) must not eat this press's click.
    this.swallowClick = false;
    if (this.chart !== null && event.isPrimary && this.drag === null) {
      const middle = event.button === 1;
      // KB: interface.md §87
      if (middle || (event.button === 0 && (this.mode === 'place' || this.panHeld))) {
        // The middle button would otherwise start the browser's own scrolling.
        if (middle) event.preventDefault();
        const moved = middle || this.panHeld;
        // Even a Space pan that never moved: Space may be let go before the button is.
        this.swallowClick = this.panHeld && !middle;
        this.canvas.setPointerCapture?.(event.pointerId);
        const slop = event.pointerType === 'mouse' ? PAN_SLOP_MOUSE : PAN_SLOP_TOUCH;
        this.drag = { kind: 'pan', last: this.screenPoint(event), moved, slop };
        if (moved) this.canvas.style.cursor = 'grabbing';
        return;
      }
    }
    // A Mac may report Ctrl + click as the secondary button.
    const primary = event.button === 0 || (event.button === 2 && event.ctrlKey);
    if (this.mode !== 'select' || this.chart === null || !primary || !event.isPrimary) return;
    const point = this.point(event);
    this.canvas.setPointerCapture?.(event.pointerId);
    const chart = this.chart;
    const reach = (placed: PlacedStitch): number => this.reachOf(placed);
    const hit = stitchAt(chart, point, reach);
    const onSelected = hit !== null && this.selection.has(hit);
    const handles = this.handles();
    if (handles !== null) {
      const { frame } = handles;
      if (distance(point, handles.rotate) <= this.px(HANDLE_HIT)) {
        const startAngle = angleOf(frame.center, point);
        this.drag = { kind: 'rotate', frame, side: handles.side, startAngle, base: chart, angle: 0 };
        return;
      }
      const corner = handles.corners.find((at) => distance(point, at) <= this.px(HANDLE_HIT));
      // On a small frame a corner's reach covers the stitch itself; the press then means the stitch.
      if (corner !== undefined && !(onSelected && distance(point, frame.center) < distance(point, corner))) {
        const offset = { x: corner.x - frame.center.x, y: corner.y - frame.center.y };
        const length = Math.max(1, Math.hypot(offset.x, offset.y));
        const local = turn(offset, -frame.angle);
        const pad = (FRAME_PAD * (Math.abs(local.x) + Math.abs(local.y))) / length;
        const axis = { x: offset.x / length, y: offset.y / length };
        this.drag = { kind: 'scale', center: frame.center, axis, length, pad, base: chart };
        return;
      }
    }
    const adding = event.shiftKey || event.ctrlKey || event.metaKey;
    // KB: interface §64
    if (!adding && !onSelected && handles !== null && frameHolds(handles.frame, point)) {
      this.drag = { kind: 'move', start: point, base: chart, narrowTo: null, moved: false };
      return;
    }
    if (hit !== null) {
      if (adding && onSelected) {
        this.selection.delete(hit);
        this.draw();
        return;
      }
      const narrowTo = !adding && onSelected && this.selection.size > 1 ? hit : null;
      if (adding) this.selection.add(hit);
      else if (!onSelected) this.selection = new Set([hit]);
      this.drag = { kind: 'move', start: point, base: chart, narrowTo, moved: false };
      this.draw();
      return;
    }
    if (!adding) this.selection.clear();
    this.drag = { kind: 'area', start: point, current: point, base: new Set(this.selection) };
    this.draw();
  }

  private moveTo(event: PointerEvent): void {
    const drag = this.drag;
    if (drag?.kind === 'pan') {
      const at = this.screenPoint(event);
      if (!drag.moved) {
        if (distance(at, drag.last) < drag.slop) return;
        drag.moved = true;
        this.swallowClick = true;
        this.canvas.style.cursor = 'grabbing';
      }
      this.setView(panBy(this.view, at.x - drag.last.x, at.y - drag.last.y, this.size(), this.sheet()));
      drag.last = at;
      return;
    }
    const point = this.point(event);
    if (drag === null) {
      this.hover(point, event.shiftKey || event.ctrlKey || event.metaKey);
      return;
    }
    if (drag.kind === 'move') {
      if (!drag.moved && distance(point, drag.start) < this.px(DRAG_SLOP)) return;
      drag.moved = true;
      const [dx, dy] = boundedMove(
        drag.base,
        this.selection,
        point.x - drag.start.x,
        point.y - drag.start.y,
        this.sheet(),
      );
      this.host.change(moveStitches(drag.base, this.selection, dx, dy));
    } else if (drag.kind === 'rotate') {
      const angle = angleOf(drag.frame.center, point) - drag.startAngle;
      const turned = rotateStitches(drag.base, this.selection, drag.frame.center, angle);
      if (this.fits(turned)) {
        drag.angle = angle;
        this.host.change(turned);
      }
    } else if (drag.kind === 'scale') {
      // Along the corner's diagonal, so the corner stays under the pointer and crossing the centre does not flip it.
      const along = (point.x - drag.center.x) * drag.axis.x + (point.y - drag.center.y) * drag.axis.y;
      const wanted = (along - drag.pad) / Math.max(1, drag.length - drag.pad);
      const scaled = scaleStitches(
        drag.base,
        this.selection,
        drag.center,
        boundedFactor(drag.base, this.selection, wanted),
      );
      if (this.fits(scaled)) this.host.change(scaled);
    } else if (this.chart !== null) {
      drag.current = point;
      const inside = distance(point, drag.start) < this.px(DRAG_SLOP) ? [] : stitchesIn(this.chart, drag.start, point);
      this.selection = new Set([...drag.base, ...inside]);
      this.draw();
    }
  }

  /** A turn or a resize that would carry a stitch off the board is not taken; the last one that fits stays. */
  private fits(next: FreeformChart): boolean {
    return allInside(next, this.selection, this.sheet());
  }

  private up(cancelled: boolean): void {
    const drag = this.drag;
    if (drag === null) return;
    this.drag = null;
    if (drag.kind === 'pan') {
      this.canvas.style.cursor = this.panHeld ? 'grab' : '';
      if (cancelled) this.swallowClick = false;
      return;
    }
    // A gesture the browser took over is undone, not left half-way.
    if (cancelled && drag.kind !== 'area') this.host.change(drag.base);
    else if (drag.kind !== 'area') this.host.settled();
    if (drag.kind === 'move' && !cancelled && !drag.moved && drag.narrowTo !== null) {
      this.selection = new Set([drag.narrowTo]);
    }
    this.draw();
  }

  private hover(point: Point, adding: boolean): void {
    if (this.mode !== 'select' || this.chart === null || this.panHeld) return;
    const handles = this.handles();
    if (handles !== null && distance(point, handles.rotate) <= this.px(HANDLE_HIT)) {
      this.canvas.style.cursor = 'grab';
      return;
    }
    const corner = handles?.corners.find((at) => distance(point, at) <= this.px(HANDLE_HIT));
    if (handles !== null && corner !== undefined) {
      // On screen, whatever the frame's turn: down-right and up-left share one diagonal.
      const { center } = handles.frame;
      const sameSign = (corner.x - center.x) * (corner.y - center.y) > 0;
      this.canvas.style.cursor = sameSign ? 'nwse-resize' : 'nesw-resize';
      return;
    }
    const inFrame = !adding && handles !== null && frameHolds(handles.frame, point);
    const hit = inFrame ? null : stitchAt(this.chart, point, (placed) => this.reachOf(placed));
    this.canvas.style.cursor = inFrame || hit !== null ? 'move' : '';
  }

  private symbolOf(placed: PlacedStitch): { shapes: Shape[]; reach: number; extent: Extent } {
    let found = this.shapes.get(placed.stitch);
    if (found === undefined) {
      const shapes = symbolShapes(stitchById(placed.stitch), this.symbols);
      const { minX, minY, maxX, maxY } = shapeBounds(shapes);
      const reach = Math.max(MIN_REACH, (Math.max(maxX - minX, maxY - minY) / 2) * STITCH_SCALE);
      // KB: interface.md §23 — measured from where the symbol is drawn to its exact ink.
      const exact = shapeBounds(shapes, true);
      const [cx, cy] = [(minX + maxX) / 2, (minY + maxY) / 2];
      const extent = {
        halfWidth: Math.max(cx - exact.minX, exact.maxX - cx) * STITCH_SCALE,
        halfHeight: Math.max(cy - exact.minY, exact.maxY - cy) * STITCH_SCALE,
      };
      found = { shapes, reach, extent };
      this.shapes.set(placed.stitch, found);
    }
    return found;
  }

  /** The stitch's half size as drawn, upright. */
  extentOf(placed: PlacedStitch): Extent {
    const { halfWidth, halfHeight } = this.symbolOf(placed).extent;
    return { halfWidth: halfWidth * placed.scale, halfHeight: halfHeight * placed.scale };
  }

  /** The stitch's half size at its symbol's own size, whatever it is scaled to. */
  readonly naturalSize: NaturalSize = (placed) => this.symbolOf(placed).extent;

  /** Worked out once per chart: the sheet and the drawing ask for it on every frame. */
  rowHeights(): RowHeights | undefined {
    const chart = this.chart;
    if (chart?.grid === undefined) return undefined;
    if (this.heights?.chart !== chart) this.heights = { chart, heights: rowHeights(chart, this.naturalSize) };
    return this.heights.heights;
  }

  private reachOf(placed: PlacedStitch): number {
    return Math.max(MIN_REACH, this.symbolOf(placed).reach * placed.scale);
  }

  /**
   * The rotation handle stands above the frame, and drops below it where above
   * would leave the board. While a turn is dragged, the frame is the one at the
   * press turned by the drag, and the handle keeps its side.
   */
  private handles(): Handles | null {
    if (this.chart === null) return null;
    const drag = this.drag;
    const frame =
      drag?.kind === 'rotate'
        ? { ...drag.frame, angle: drag.frame.angle + drag.angle }
        : selectionFrame(this.chart, this.selection, (placed) => this.reachOf(placed) + FRAME_PAD);
    if (frame === null) return null;
    const at = (local: Point): Point => {
      const offset = turn(local, frame.angle);
      return { x: frame.center.x + offset.x, y: frame.center.y + offset.y };
    };
    const seen = this.visible();
    const [hit, gap] = [this.px(HANDLE_HIT), this.px(HANDLE_GAP)];
    const onScreen = (p: Point): boolean =>
      p.x >= seen.minX + hit && p.y >= seen.minY + hit && p.x <= seen.maxX - hit && p.y <= seen.maxY - hit;
    const above = at({ x: 0, y: -(frame.halfHeight + gap) });
    const side = drag?.kind === 'rotate' ? drag.side : onScreen(above) ? -1 : 1;
    return {
      frame,
      rotate: side === -1 ? above : at({ x: 0, y: frame.halfHeight + gap }),
      side,
      corners: CORNERS.map(({ x, y }) => at({ x: x * frame.halfWidth, y: y * frame.halfHeight })),
    };
  }

  private draw(): void {
    const drag = this.drag;
    const settled = drag?.kind === 'rotate' || drag?.kind === 'scale' || (drag?.kind === 'move' && drag.moved);
    const selected = settled ? this.notified : this.selectionKey();
    if (this.notified !== selected) {
      this.notified = selected;
      this.host.selectionChanged(this.selection.size);
    }
    this.canvas.dataset['selected'] = String(this.selection.size);
    this.canvas.dataset['stitches'] = String(this.chart?.stitches.length ?? 0);
    const ctx = this.canvas.getContext('2d');
    if (!ctx || this.chart === null) return;
    const dpr = window.devicePixelRatio || 1;
    const { width: cssWidth, height: cssHeight } = this.size();
    const [width, height] = [Math.round(cssWidth * dpr), Math.round(cssHeight * dpr)];
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    this.view = clampView(this.view, { width: cssWidth, height: cssHeight }, this.sheet());
    const { zoom, origin } = this.view;
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, -origin.x * dpr * zoom, -origin.y * dpr * zoom);
    if (this.chart.grid !== undefined) this.drawGrid(ctx, this.chart.grid);
    for (const placed of this.chart.stitches) {
      const scale = STITCH_SCALE * placed.scale;
      ctx.save();
      ctx.translate(placed.x, placed.y);
      ctx.rotate(placed.rotation);
      applyInk(ctx, this.selection.has(placed.id) ? this.accent : this.ink, 2 / scale);
      drawCentered(ctx, this.symbolOf(placed).shapes, scale);
      ctx.restore();
    }
    this.drawFrame(ctx);
    if (this.drag?.kind === 'area') {
      ctx.save();
      applyInk(ctx, this.accent, this.px(1));
      ctx.setLineDash([this.px(4), this.px(3)]);
      const { minX, minY, maxX, maxY } = rectOf(this.drag.start, this.drag.current);
      ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
      ctx.restore();
    }
  }

  /** Only the rows on screen are drawn: a grid can have 500 rows of 200 cells. */
  private drawGrid(ctx: CanvasRenderingContext2D, grid: RectGrid): void {
    const seen = this.visible();
    const rows = gridRows(grid, this.rowHeights(), seen.minY, seen.maxY);
    // KB: interface.md §89 — every line centred on a device pixel, and drawn once.
    const { zoom, origin } = this.view;
    const scale = zoom * (window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(scale / zoom));
    const half = width % 2 === 1 ? 0.5 : 0;
    const snap = (at: number, from: number): number => from + (Math.round((at - from) * scale) + half) / scale;
    ctx.save();
    applyInk(ctx, this.ink, width / scale);
    ctx.lineCap = 'butt';
    ctx.globalAlpha = GRID_ALPHA;
    const lines = new Map<number, number>();
    for (const { top, bottom, right } of rows) {
      for (const y of [top, bottom]) lines.set(y, Math.max(lines.get(y) ?? 0, right));
    }
    ctx.beginPath();
    for (const [y, right] of lines) {
      ctx.moveTo(snap(0, origin.x), snap(y, origin.y));
      ctx.lineTo(snap(right, origin.x), snap(y, origin.y));
    }
    for (const { top, bottom, cells } of rows) {
      const [y0, y1] = [snap(top, origin.y), snap(bottom, origin.y)];
      for (let i = 0; i <= cells; i += 1) {
        const x = snap(i * GRID_CELL, origin.x);
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y1);
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    this.labelFont ??= `${GRID_LABEL_SIZE}px ${getComputedStyle(this.canvas).fontFamily}`;
    ctx.font = this.labelFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const { number, label } of rows) ctx.fillText(String(number), label.x, label.y);
    ctx.restore();
  }

  private selectionKey(): string {
    return [...this.selection].sort((a, b) => a - b).join(',');
  }

  /** Drawn in frame space, so the frame, its corners and the handle all turn with the stitches. */
  private drawFrame(ctx: CanvasRenderingContext2D): void {
    const handles = this.handles();
    if (handles === null) return;
    const { center, angle, halfWidth: hw, halfHeight: hh } = handles.frame;
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(angle);
    applyInk(ctx, this.accent, this.px(1));
    ctx.setLineDash([this.px(4), this.px(3)]);
    ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);
    ctx.setLineDash([]);
    const edge = handles.side * hh;
    const knob = handles.side * (hh + this.px(HANDLE_GAP));
    ctx.beginPath();
    ctx.moveTo(0, edge);
    ctx.lineTo(0, knob);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, knob, this.px(HANDLE_R), 0, Math.PI * 2);
    ctx.fill();
    const corner = this.px(CORNER);
    for (const { x, y } of CORNERS) ctx.fillRect(x * hw - corner / 2, y * hh - corner / 2, corner, corner);
    ctx.restore();
  }
}

function angleOf(center: Point, point: Point): number {
  return Math.atan2(point.y - center.y, point.x - center.x);
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
