import {
  allInside,
  boundedFactor,
  boundedMove,
  type Frame,
  type FreeformChart,
  moveStitches,
  type PlacedStitch,
  type Point,
  rectOf,
  rotateStitches,
  scaleStitches,
  selectionFrame,
  stitchAt,
  stitchesIn,
  turn,
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
const CORNER = 8;
const HANDLE_HIT = HANDLE_R + 4;
/** Below this many pixels a press is a click, not a drag: mouse jitter must not move a stitch. */
const DRAG_SLOP = 3;
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
  | { readonly kind: 'area'; readonly start: Point; current: Point; readonly base: ReadonlySet<number> };

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
    // Ctrl + click on a Mac is the context menu; here it adds to the selection.
    canvas.addEventListener('contextmenu', (event) => {
      if (this.mode === 'select') event.preventDefault();
    });
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
    // A Mac may report Ctrl + click as the secondary button.
    const primary = event.button === 0 || (event.button === 2 && event.ctrlKey);
    if (this.mode !== 'select' || this.chart === null || !primary || !event.isPrimary) return;
    const point = this.point(event);
    this.canvas.setPointerCapture?.(event.pointerId);
    const chart = this.chart;
    const reach = (placed: PlacedStitch): number => this.reachOf(placed);
    const hit = stitchAt(chart, point, reach);
    const handles = this.handles();
    if (handles !== null) {
      const { frame } = handles;
      if (distance(point, handles.rotate) <= HANDLE_HIT) {
        const startAngle = angleOf(frame.center, point);
        this.drag = { kind: 'rotate', frame, side: handles.side, startAngle, base: chart, angle: 0 };
        return;
      }
      const corner = handles.corners.find((at) => distance(point, at) <= HANDLE_HIT);
      // On a small frame a corner's reach covers the stitch itself; the press then means the stitch.
      const onSelected = hit !== null && this.selection.has(hit);
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
    if (hit !== null) {
      if (adding && this.selection.has(hit)) {
        this.selection.delete(hit);
        this.draw();
        return;
      }
      const narrowTo = !adding && this.selection.has(hit) && this.selection.size > 1 ? hit : null;
      if (adding) this.selection.add(hit);
      else if (!this.selection.has(hit)) this.selection = new Set([hit]);
      this.drag = { kind: 'move', start: point, base: chart, narrowTo, moved: false };
      this.draw();
      return;
    }
    if (!adding) this.selection.clear();
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
      const inside = distance(point, drag.start) < DRAG_SLOP ? [] : stitchesIn(this.chart, drag.start, point);
      this.selection = new Set([...drag.base, ...inside]);
      this.draw();
    }
  }

  /** A turn or a resize that would carry a stitch off the board is not taken; the last one that fits stays. */
  private fits(next: FreeformChart): boolean {
    return allInside(next, this.selection, this.size());
  }

  private up(cancelled: boolean): void {
    const drag = this.drag;
    if (drag === null) return;
    this.drag = null;
    // A gesture the browser took over is undone, not left half-way.
    if (cancelled && drag.kind !== 'area') this.host.change(drag.base);
    if (drag.kind === 'move' && !cancelled && !drag.moved && drag.narrowTo !== null) {
      this.selection = new Set([drag.narrowTo]);
    }
    this.draw();
  }

  private hover(point: Point): void {
    if (this.mode !== 'select' || this.chart === null) return;
    const handles = this.handles();
    if (handles !== null && distance(point, handles.rotate) <= HANDLE_HIT) {
      this.canvas.style.cursor = 'grab';
      return;
    }
    const corner = handles?.corners.find((at) => distance(point, at) <= HANDLE_HIT);
    if (handles !== null && corner !== undefined) {
      // On screen, whatever the frame's turn: down-right and up-left share one diagonal.
      const { center } = handles.frame;
      const sameSign = (corner.x - center.x) * (corner.y - center.y) > 0;
      this.canvas.style.cursor = sameSign ? 'nwse-resize' : 'nesw-resize';
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
    const { width, height } = this.size();
    const onBoard = (p: Point): boolean =>
      p.x >= HANDLE_HIT && p.y >= HANDLE_HIT && p.x <= width - HANDLE_HIT && p.y <= height - HANDLE_HIT;
    const above = at({ x: 0, y: -(frame.halfHeight + HANDLE_GAP) });
    const side = drag?.kind === 'rotate' ? drag.side : onBoard(above) ? -1 : 1;
    return {
      frame,
      rotate: side === -1 ? above : at({ x: 0, y: frame.halfHeight + HANDLE_GAP }),
      side,
      corners: CORNERS.map(({ x, y }) => at({ x: x * frame.halfWidth, y: y * frame.halfHeight })),
    };
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
      applyInk(ctx, this.accent, 1);
      ctx.setLineDash([4, 3]);
      const { minX, minY, maxX, maxY } = rectOf(this.drag.start, this.drag.current);
      ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
      ctx.restore();
    }
  }

  /** Drawn in frame space, so the frame, its corners and the handle all turn with the stitches. */
  private drawFrame(ctx: CanvasRenderingContext2D): void {
    const handles = this.handles();
    if (handles === null) return;
    const { center, angle, halfWidth: hw, halfHeight: hh } = handles.frame;
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(angle);
    applyInk(ctx, this.accent, 1);
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);
    ctx.setLineDash([]);
    const edge = handles.side * hh;
    const knob = handles.side * (hh + HANDLE_GAP);
    ctx.beginPath();
    ctx.moveTo(0, edge);
    ctx.lineTo(0, knob);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, knob, HANDLE_R, 0, Math.PI * 2);
    ctx.fill();
    for (const { x, y } of CORNERS) ctx.fillRect(x * hw - CORNER / 2, y * hh - CORNER / 2, CORNER, CORNER);
    ctx.restore();
  }
}

function angleOf(center: Point, point: Point): number {
  return Math.atan2(point.y - center.y, point.x - center.x);
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
