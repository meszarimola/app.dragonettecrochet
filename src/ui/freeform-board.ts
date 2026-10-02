import {
  allInside,
  boundedMove,
  type FreeformChart,
  moveStitches,
  type PlacedStitch,
  type Point,
  type Rect,
  rectOf,
  rotateStitches,
  selectionCenter,
  stitchAt,
  stitchesIn,
} from '../core/freeform.ts';
import { stitchById } from '../core/stitches.ts';
import { applyInk, drawCentered, type Shape, type SymbolOptions, shapeBounds, symbolShapes } from './symbols.ts';

/** How much larger a stitch is drawn on the canvas than in its own symbol units. */
export const STITCH_SCALE = 1.5;
/** A stitch is never harder to hit than this, however small its symbol. */
const MIN_REACH = 8;
const FRAME_PAD = 6;
const HANDLE_GAP = 22;
const HANDLE_R = 6;
const HANDLE_HIT = HANDLE_R + 4;
/** Below this many pixels a press is a click, not a drag: mouse jitter must not move a stitch. */
const DRAG_SLOP = 3;

export type BoardMode = 'place' | 'select';

export interface BoardHost {
  place(point: Point): void;
  /** Called live on every pointer move of a drag. */
  change(chart: FreeformChart): void;
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
  | { readonly kind: 'rotate'; readonly center: Point; readonly startAngle: number; readonly base: FreeformChart }
  | { readonly kind: 'area'; readonly start: Point; current: Point; readonly base: ReadonlySet<number> };

interface Frame {
  readonly rect: Rect;
  readonly handle: Point;
  /** Where the line to the handle leaves the frame. */
  readonly stem: number;
}

export class FreeformBoard {
  private chart: FreeformChart | null = null;
  private symbols: SymbolOptions = { singleCrochet: 'plus' };
  private mode: BoardMode = 'place';
  private selection = new Set<number>();
  private drag: Drag | null = null;
  private readonly shapes = new Map<string, { shapes: Shape[]; reach: number }>();
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
      if (this.mode === 'place' && this.chart !== null) this.host.place(this.point(event));
    });
    canvas.addEventListener('pointerdown', (event) => this.down(event));
    canvas.addEventListener('pointermove', (event) => this.moveTo(event));
    canvas.addEventListener('pointerup', () => this.up(false));
    canvas.addEventListener('pointercancel', () => this.up(true));
    new ResizeObserver(() => this.draw()).observe(canvas);
  }

  show(chart: FreeformChart | null, symbols: SymbolOptions): void {
    if (chart !== this.chart && chart !== null) {
      const ids = new Set(chart.stitches.map(({ id }) => id));
      for (const id of this.selection) if (!ids.has(id)) this.selection.delete(id);
    }
    if (symbols.style !== this.symbols.style || symbols.singleCrochet !== this.symbols.singleCrochet) {
      this.shapes.clear();
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

  clearSelection(): void {
    if (this.drag !== null) return;
    this.selection.clear();
    this.draw();
  }

  get selected(): ReadonlySet<number> {
    return this.selection;
  }

  get dragging(): boolean {
    return this.drag !== null;
  }

  private point(event: MouseEvent): Point {
    const box = this.canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  private size(): { width: number; height: number } {
    return { width: this.canvas.clientWidth, height: this.canvas.clientHeight };
  }

  private down(event: PointerEvent): void {
    if (this.mode !== 'select' || this.chart === null || event.button !== 0 || !event.isPrimary) return;
    const point = this.point(event);
    this.canvas.setPointerCapture?.(event.pointerId);
    const chart = this.chart;
    const frame = this.frame();
    if (frame !== null && distance(point, frame.handle) <= HANDLE_HIT) {
      const center = selectionCenter(chart, this.selection);
      if (center !== null) {
        this.drag = { kind: 'rotate', center, startAngle: angleOf(center, point), base: chart };
        return;
      }
    }
    const hit = stitchAt(chart, point, (placed) => this.reachOf(placed));
    if (hit !== null) {
      if (event.shiftKey && this.selection.has(hit)) {
        this.selection.delete(hit);
        this.draw();
        return;
      }
      const narrowTo = !event.shiftKey && this.selection.has(hit) && this.selection.size > 1 ? hit : null;
      if (event.shiftKey) this.selection.add(hit);
      else if (!this.selection.has(hit)) this.selection = new Set([hit]);
      this.drag = { kind: 'move', start: point, base: chart, narrowTo, moved: false };
      this.draw();
      return;
    }
    if (!event.shiftKey) this.selection.clear();
    this.drag = { kind: 'area', start: point, current: point, base: new Set(this.selection) };
    this.draw();
  }

  private moveTo(event: PointerEvent): void {
    const point = this.point(event);
    const drag = this.drag;
    if (drag === null) {
      this.hover(point);
      return;
    }
    if (drag.kind === 'move') {
      if (!drag.moved && distance(point, drag.start) < DRAG_SLOP) return;
      drag.moved = true;
      const [dx, dy] = boundedMove(
        drag.base,
        this.selection,
        point.x - drag.start.x,
        point.y - drag.start.y,
        this.size(),
      );
      this.host.change(moveStitches(drag.base, this.selection, dx, dy));
    } else if (drag.kind === 'rotate') {
      const angle = angleOf(drag.center, point) - drag.startAngle;
      const turned = rotateStitches(drag.base, this.selection, drag.center, angle);
      // A turn that would carry a stitch off the board is not taken; the last one that fits stays.
      if (allInside(turned, this.selection, this.size())) this.host.change(turned);
    } else if (this.chart !== null) {
      drag.current = point;
      const inside = distance(point, drag.start) < DRAG_SLOP ? [] : stitchesIn(this.chart, drag.start, point);
      this.selection = new Set([...drag.base, ...inside]);
      this.draw();
    }
  }

  private up(cancelled: boolean): void {
    const drag = this.drag;
    if (drag === null) return;
    this.drag = null;
    if (drag.kind === 'move' && !cancelled && !drag.moved && drag.narrowTo !== null) {
      this.selection = new Set([drag.narrowTo]);
    }
    this.draw();
  }

  private hover(point: Point): void {
    if (this.mode !== 'select' || this.chart === null) return;
    const frame = this.frame();
    if (frame !== null && distance(point, frame.handle) <= HANDLE_HIT) {
      this.canvas.style.cursor = 'grab';
      return;
    }
    const hit = stitchAt(this.chart, point, (placed) => this.reachOf(placed));
    this.canvas.style.cursor = hit === null ? '' : 'move';
  }

  private symbolOf(placed: PlacedStitch): { shapes: Shape[]; reach: number } {
    let found = this.shapes.get(placed.stitch);
    if (found === undefined) {
      const shapes = symbolShapes(stitchById(placed.stitch), this.symbols);
      const { minX, minY, maxX, maxY } = shapeBounds(shapes);
      const reach = Math.max(MIN_REACH, (Math.max(maxX - minX, maxY - minY) / 2) * STITCH_SCALE);
      found = { shapes, reach };
      this.shapes.set(placed.stitch, found);
    }
    return found;
  }

  private reachOf(placed: PlacedStitch): number {
    return this.symbolOf(placed).reach;
  }

  /** The frame around the selected stitches with its rotation handle, which drops below when the top is too near. */
  private frame(): Frame | null {
    if (this.chart === null || this.selection.size === 0) return null;
    let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const placed of this.chart.stitches) {
      if (!this.selection.has(placed.id)) continue;
      const reach = this.reachOf(placed) + FRAME_PAD;
      minX = Math.min(minX, placed.x - reach);
      minY = Math.min(minY, placed.y - reach);
      maxX = Math.max(maxX, placed.x + reach);
      maxY = Math.max(maxY, placed.y + reach);
    }
    if (minX === Infinity) return null;
    const x = (minX + maxX) / 2;
    const above = minY - HANDLE_GAP;
    return above >= HANDLE_HIT
      ? { rect: { minX, minY, maxX, maxY }, handle: { x, y: above }, stem: minY }
      : { rect: { minX, minY, maxX, maxY }, handle: { x, y: maxY + HANDLE_GAP }, stem: maxY };
  }

  private draw(): void {
    this.canvas.dataset['selected'] = String(this.selection.size);
    const ctx = this.canvas.getContext('2d');
    if (!ctx || this.chart === null) return;
    const dpr = window.devicePixelRatio || 1;
    const { width: cssWidth, height: cssHeight } = this.size();
    const [width, height] = [Math.round(cssWidth * dpr), Math.round(cssHeight * dpr)];
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    for (const placed of this.chart.stitches) {
      ctx.save();
      ctx.translate(placed.x, placed.y);
      ctx.rotate(placed.rotation);
      applyInk(ctx, this.selection.has(placed.id) ? this.accent : this.ink, 2 / STITCH_SCALE);
      drawCentered(ctx, this.symbolOf(placed).shapes, STITCH_SCALE);
      ctx.restore();
    }
    this.drawFrame(ctx);
    if (this.drag?.kind === 'area') {
      ctx.save();
      applyInk(ctx, this.accent, 1);
      ctx.setLineDash([4, 3]);
      const { minX, minY, maxX, maxY } = rectOf(this.drag.start, this.drag.current);
      ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
      ctx.restore();
    }
  }

  private drawFrame(ctx: CanvasRenderingContext2D): void {
    const frame = this.frame();
    if (frame === null) return;
    const { rect, handle, stem } = frame;
    ctx.save();
    applyInk(ctx, this.accent, 1);
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(rect.minX, rect.minY, rect.maxX - rect.minX, rect.maxY - rect.minY);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(handle.x, stem);
    ctx.lineTo(handle.x, handle.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(handle.x, handle.y, HANDLE_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function angleOf(center: Point, point: Point): number {
  return Math.atan2(point.y - center.y, point.x - center.x);
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
