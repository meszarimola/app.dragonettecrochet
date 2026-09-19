// The free-form drawing surface. KB: interface.md §1, §15

import { arcAt } from '../core/irregular-arc.ts';
import { type Box, isSelectable, isVisible, itemBox, itemsBox, rowById } from '../core/irregular-document.ts';
import { directionOf, ringRadii, spokeAngles } from '../core/irregular-snap.ts';
import type {
  ArcShape,
  Point as ChartPoint,
  IrregularItem,
  IrregularPattern,
  LegendBlock,
  PolarGuide,
} from '../core/irregular-types.ts';
import { itemShapes, naturalGlyph } from './irregular-glyph.ts';
import {
  applyInk,
  drawCentered,
  drawShapes,
  type Point,
  type Shape,
  type SymbolOptions,
  shapesBounds,
} from './symbols.ts';

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
const HIT_SLACK = 6;
const HANDLE = 8;
const HANDLE_HIT = 14;
const HANDLE_MIN_HIT = 4;
const ROTATE_ARM = 26;
const GRID_LIMIT = 400;
const POLAR_KNOB = 5;
const POLAR_FADE = 0.55;
const FADED = 0.28;
const ORDER_FONT = 11;
const LEGEND_ICON = 22;
const LEGEND_ROW = 30;
const LEGEND_GAP = 10;
const LEGEND_COLUMN = 190;

export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate';

export type ArcHandleId = 'start' | 'end' | 'bulge';

/** Enough of a chain arc to draw its path: the group itself, or one being drawn. */
export interface ArcPath {
  readonly shape: ArcShape;
  readonly start: ChartPoint;
  readonly end: ChartPoint;
  readonly bulge: number;
}

const ARC_SAMPLES = 48;

export interface Marquee {
  readonly from: Point;
  readonly to: Point;
}

export interface LegendEntry {
  readonly keyEntryId: string;
  readonly text: string;
  readonly glyph: string | null;
}

export interface LegendView {
  readonly block: LegendBlock;
  readonly entries: readonly LegendEntry[];
}

export interface FreeScene {
  readonly pattern: IrregularPattern;
  readonly symbols: SymbolOptions;
  readonly selection: ReadonlySet<string>;
  readonly marquee: Marquee | null;
  readonly ghost: readonly Shape[] | null;
  readonly hover: string | null;
  /** The key entry's chosen symbol, or `null` when it keeps the preset's. */
  readonly glyphOf: (keyEntryId: string) => string | null;
  readonly fadeOthers: boolean;
  /** Item ids of the active row in crochet order, when the overlay is on. */
  readonly order: readonly string[] | null;
  /** The selected chain arc's path, so its ends and bulge can be grabbed. */
  readonly arc: ArcPath | null;
  /** The arc being drawn right now, drawn but not yet grabbable. */
  readonly arcPreview: ArcPath | null;
  readonly legend: LegendView | null;
}

interface View {
  scale: number;
  x: number;
  y: number;
}

function token(element: Element, name: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim();
}

function boxCenter(box: Box): Point {
  return { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
}

export class FreeBoard {
  readonly #canvas: HTMLCanvasElement;
  readonly #ctx: CanvasRenderingContext2D;
  readonly #view: View = { scale: 1, x: 0, y: 0 };
  #scene: FreeScene | null = null;
  #insets = { left: 0, right: 0 };

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('The 2D canvas context is unavailable.');
    this.#canvas = canvas;
    this.#ctx = ctx;
    new ResizeObserver(() => this.#resize()).observe(canvas);
    this.#resize();
  }

  get scale(): number {
    return this.#view.scale;
  }

  setScene(scene: FreeScene): void {
    this.#scene = scene;
    this.render();
  }

  setInsets(left: number, right: number): void {
    if (this.#insets.left === left && this.#insets.right === right) return;
    this.#insets = { left, right };
    this.render();
  }

  toChart(clientX: number, clientY: number): Point {
    const rect = this.#canvas.getBoundingClientRect();
    const { scale, x, y } = this.#view;
    return { x: (clientX - rect.left - x) / scale, y: (clientY - rect.top - y) / scale };
  }

  toClient(p: Point): Point {
    const rect = this.#canvas.getBoundingClientRect();
    return {
      x: p.x * this.#view.scale + this.#view.x + rect.left,
      y: p.y * this.#view.scale + this.#view.y + rect.top,
    };
  }

  #toScreen(p: Point): Point {
    return { x: p.x * this.#view.scale + this.#view.x, y: p.y * this.#view.scale + this.#view.y };
  }

  /** Zooming keeps the point under the pointer where it is. */
  zoomAt(factor: number, clientX: number, clientY: number): void {
    const rect = this.#canvas.getBoundingClientRect();
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.#view.scale * factor));
    const k = scale / this.#view.scale;
    if (k === 1) return;
    const [px, py] = [clientX - rect.left, clientY - rect.top];
    this.#view.x = px - (px - this.#view.x) * k;
    this.#view.y = py - (py - this.#view.y) * k;
    this.#view.scale = scale;
    this.render();
  }

  zoom(factor: number): void {
    const rect = this.#canvas.getBoundingClientRect();
    this.zoomAt(factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  pan(dx: number, dy: number): void {
    this.#view.x += dx;
    this.#view.y += dy;
    this.render();
  }

  fit(insetBottom = 0): void {
    const { width, height } = this.#canvas.getBoundingClientRect();
    const roomY = height - insetBottom;
    if (roomY < 1) return;
    const box = this.#contentBox();
    const room = Math.max(width - this.#insets.left - this.#insets.right, 120);
    if (box === null) {
      Object.assign(this.#view, { scale: 1, x: this.#insets.left + room / 2, y: roomY / 2 });
      this.render();
      return;
    }
    const drawWidth = Math.max(box.maxX - box.minX, 1);
    const drawHeight = Math.max(box.maxY - box.minY, 1);
    const scale = Math.min(2, Math.max(MIN_SCALE, Math.min((room - 80) / drawWidth, (roomY - 80) / drawHeight)));
    this.#view.scale = scale;
    this.#view.x = this.#insets.left + (room - drawWidth * scale) / 2 - box.minX * scale;
    this.#view.y = (roomY - drawHeight * scale) / 2 - box.minY * scale;
    this.render();
  }

  #contentBox(): Box | null {
    const scene = this.#scene;
    if (scene === null) return null;
    const box = itemsBox(scene.pattern.items.filter((item) => isVisible(scene.pattern, item)));
    const polar = scene.pattern.guides.polar;
    if (!polar.visible) return box;
    const reach = polar.rings * polar.spacing;
    const circle: Box = {
      minX: polar.center.x - reach,
      maxX: polar.center.x + reach,
      minY: polar.center.y - reach,
      maxY: polar.center.y + reach,
    };
    if (box === null) return circle;
    return {
      minX: Math.min(box.minX, circle.minX),
      maxX: Math.max(box.maxX, circle.maxX),
      minY: Math.min(box.minY, circle.minY),
      maxY: Math.max(box.maxY, circle.maxY),
    };
  }

  /** The chart point in the middle of the free part of the canvas. */
  viewCenter(insetBottom = 0): Point {
    const { width, height } = this.#canvas.getBoundingClientRect();
    const room = Math.max(width - this.#insets.left - this.#insets.right, 120);
    const { scale, x, y } = this.#view;
    return {
      x: (this.#insets.left + room / 2 - x) / scale,
      y: ((height - insetBottom) / 2 - y) / scale,
    };
  }

  onScreen(point: Point, insetBottom = 0): boolean {
    const { width, height } = this.#canvas.getBoundingClientRect();
    const screen = this.#toScreen(point);
    return (
      screen.x >= this.#insets.left &&
      screen.x <= width - this.#insets.right &&
      screen.y >= 0 &&
      screen.y <= height - insetBottom
    );
  }

  /**
   * Whether the click landed on the circle guide's middle knob. A stitch drawn
   * over the middle — a magic ring's first stitch — wins, because the stitches
   * are the drawing and the guide sits behind them.
   */
  polarCenterAt(clientX: number, clientY: number): boolean {
    const scene = this.#scene;
    if (scene === null || !scene.pattern.guides.polar.visible) return false;
    if (this.itemAt(clientX, clientY) !== null) return false;
    const rect = this.#canvas.getBoundingClientRect();
    const screen = this.#toScreen(scene.pattern.guides.polar.center);
    return (
      Math.abs(screen.x - (clientX - rect.left)) <= HANDLE_HIT &&
      Math.abs(screen.y - (clientY - rect.top)) <= HANDLE_HIT
    );
  }

  #drawPolar(polar: PolarGuide, color: string, accent: string): void {
    const ctx = this.#ctx;
    const scale = this.#view.scale;
    const reach = polar.rings * polar.spacing;
    ctx.save();
    ctx.globalAlpha = POLAR_FADE;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1 / scale;
    ctx.beginPath();
    for (const radius of ringRadii(polar)) {
      ctx.moveTo(polar.center.x + radius, polar.center.y);
      ctx.arc(polar.center.x, polar.center.y, radius, 0, Math.PI * 2);
    }
    for (const angle of spokeAngles(polar)) {
      const direction = directionOf(angle);
      ctx.moveTo(polar.center.x, polar.center.y);
      ctx.lineTo(polar.center.x + direction.x * reach, polar.center.y + direction.y * reach);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(polar.center.x, polar.center.y, POLAR_KNOB / scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Topmost first, so a click takes what the eye takes. */
  #reachable(): IrregularItem[] {
    const scene = this.#scene;
    if (scene === null) return [];
    const order = new Map(scene.pattern.layers.map((layer, index) => [layer.id, index]));
    return scene.pattern.items
      .filter((item) => isSelectable(scene.pattern, item))
      .map((item, index) => ({ item, index, layer: order.get(item.layerId) ?? 0 }))
      .sort((a, b) => b.layer - a.layer || b.index - a.index)
      .map((entry) => entry.item);
  }

  itemAt(clientX: number, clientY: number): string | null {
    const point = this.toChart(clientX, clientY);
    const slack = HIT_SLACK / this.#view.scale;
    for (const item of this.#reachable()) {
      const box = itemBox(item);
      if (
        point.x >= box.minX - slack &&
        point.x <= box.maxX + slack &&
        point.y >= box.minY - slack &&
        point.y <= box.maxY + slack
      ) {
        return item.id;
      }
    }
    return null;
  }

  itemsInRect(from: Point, to: Point, partial: boolean): string[] {
    const rect = {
      minX: Math.min(from.x, to.x),
      minY: Math.min(from.y, to.y),
      maxX: Math.max(from.x, to.x),
      maxY: Math.max(from.y, to.y),
    };
    return this.#reachable()
      .filter((item) => {
        const box = itemBox(item);
        if (partial) {
          return box.minX <= rect.maxX && box.maxX >= rect.minX && box.minY <= rect.maxY && box.maxY >= rect.minY;
        }
        return box.minX >= rect.minX && box.maxX <= rect.maxX && box.minY >= rect.minY && box.maxY <= rect.maxY;
      })
      .map((item) => item.id);
  }

  selectionBox(): Box | null {
    const scene = this.#scene;
    if (scene === null || scene.selection.size === 0) return null;
    return itemsBox(scene.pattern.items.filter((item) => scene.selection.has(item.id)));
  }

  #handlePoints(box: Box): ReadonlyMap<HandleId, Point> {
    const mid = boxCenter(box);
    const points = new Map<HandleId, Point>([
      ['nw', { x: box.minX, y: box.minY }],
      ['n', { x: mid.x, y: box.minY }],
      ['ne', { x: box.maxX, y: box.minY }],
      ['e', { x: box.maxX, y: mid.y }],
      ['se', { x: box.maxX, y: box.maxY }],
      ['s', { x: mid.x, y: box.maxY }],
      ['sw', { x: box.minX, y: box.maxY }],
      ['w', { x: box.minX, y: mid.y }],
    ]);
    const top = this.#toScreen({ x: mid.x, y: box.minY });
    points.set('rotate', { x: mid.x, y: (top.y - ROTATE_ARM - this.#view.y) / this.#view.scale });
    return points;
  }

  /**
   * A thin stitch is barely wider than a handle, so a fixed hit box would cover
   * the whole thing and every drag would resize instead of move. The reach
   * therefore never grows past a third of the box, leaving the middle free.
   * The rotate arm stands outside the box and keeps the full reach.
   */
  handleAt(clientX: number, clientY: number): HandleId | null {
    const box = this.selectionBox();
    if (box === null) return null;
    const rect = this.#canvas.getBoundingClientRect();
    const [px, py] = [clientX - rect.left, clientY - rect.top];
    const scale = this.#view.scale;
    const reachX = Math.min(HANDLE_HIT, Math.max(HANDLE_MIN_HIT, ((box.maxX - box.minX) * scale) / 3));
    const reachY = Math.min(HANDLE_HIT, Math.max(HANDLE_MIN_HIT, ((box.maxY - box.minY) * scale) / 3));
    for (const [id, point] of this.#handlePoints(box)) {
      const screen = this.#toScreen(point);
      const [nearX, nearY] = id === 'rotate' ? [HANDLE_HIT, HANDLE_HIT] : [reachX, reachY];
      if (Math.abs(screen.x - px) <= nearX && Math.abs(screen.y - py) <= nearY) return id;
    }
    return null;
  }

  render(): void {
    const ctx = this.#ctx;
    const canvas = this.#canvas;
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const scene = this.#scene;
    if (scene === null) return;

    const colors = {
      ink: token(canvas, '--c-ink'),
      accent: token(canvas, '--c-accent'),
      grid: token(canvas, '--c-grid'),
      background: token(canvas, '--c-bg'),
    };
    const { scale, x, y } = this.#view;

    if (scene.pattern.guides.grid.visible) this.#drawGrid(scene.pattern.guides.grid.size, colors.grid, width, height);

    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * x, dpr * y);
    const line = Math.max(1.2, 2 / scale);
    if (scene.pattern.guides.polar.visible) this.#drawPolar(scene.pattern.guides.polar, colors.grid, colors.accent);
    const order = new Map(scene.pattern.layers.map((layer, index) => [layer.id, index]));
    const drawable = scene.pattern.items
      .filter((item) => isVisible(scene.pattern, item))
      .map((item, index) => ({ item, index, layer: order.get(item.layerId) ?? 0 }))
      .sort((a, b) => a.layer - b.layer || a.index - b.index);

    for (const { item } of drawable) {
      const dim = scene.fadeOthers && item.rowId !== scene.pattern.activeRowId;
      ctx.globalAlpha = dim ? FADED : 1;
      applyInk(ctx, this.#inkOf(scene.pattern, item, colors.ink), line);
      drawShapes(ctx, itemShapes(item, scene.symbols, scene.glyphOf(item.keyEntryId)));
    }
    ctx.globalAlpha = 1;

    if (scene.legend !== null && scene.legend.block.visible) {
      this.#drawLegend(scene, scene.legend, colors.ink, line);
    }

    if (scene.ghost !== null) {
      ctx.globalAlpha = 0.45;
      applyInk(ctx, colors.accent, line);
      drawShapes(ctx, scene.ghost);
      ctx.globalAlpha = 1;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.#drawOrder(scene, colors.accent);
    if (scene.arcPreview !== null) this.#drawArcPath(scene.arcPreview, colors.accent, false);
    if (scene.arc !== null) this.#drawArcPath(scene.arc, colors.accent, true);
    this.#drawSelection(colors.accent);
    this.#drawMarquee(scene.marquee, colors.accent);
  }

  /** The numbers stay the same size however far you zoom out, as the row labels do. */
  #drawOrder(scene: FreeScene, color: string): void {
    const order = scene.order;
    if (order === null || order.length === 0) return;
    const ctx = this.#ctx;
    const byId = new Map(scene.pattern.items.map((item) => [item.id, item]));
    ctx.save();
    ctx.font = `${ORDER_FONT}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    order.forEach((id, index) => {
      const item = byId.get(id);
      if (item === undefined || !isVisible(scene.pattern, item)) return;
      const box = itemBox(item);
      const at = this.#toScreen({ x: item.x, y: box.minY });
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(at.x, at.y - ORDER_FONT, ORDER_FONT * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.fillText(String(index + 1), at.x, at.y - ORDER_FONT);
    });
    ctx.restore();
  }

  #drawLegend(scene: FreeScene, legend: LegendView, ink: string, line: number): void {
    const ctx = this.#ctx;
    const { block, entries } = legend;
    if (entries.length === 0) return;
    const perColumn = Math.ceil(entries.length / block.columns);
    ctx.save();
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    entries.forEach((entry, index) => {
      const column = Math.floor(index / perColumn);
      const row = index % perColumn;
      const x = block.position.x + column * LEGEND_COLUMN;
      const y = block.position.y + row * LEGEND_ROW;
      const glyph = naturalGlyph(entry.keyEntryId, 'both-loops', scene.symbols, entry.glyph);
      if (glyph !== null) {
        const bounds = shapesBounds(glyph.shapes);
        if (bounds !== null) {
          const fit = Math.min(1, LEGEND_ICON / Math.max(glyph.width, glyph.height));
          ctx.save();
          ctx.translate(x + LEGEND_ICON / 2, y);
          applyInk(ctx, ink, line / fit);
          drawCentered(ctx, glyph.shapes, fit);
          ctx.restore();
        }
      }
      ctx.fillStyle = ink;
      ctx.fillText(entry.text, x + LEGEND_ICON + LEGEND_GAP, y);
    });
    ctx.restore();
  }

  #inkOf(pattern: IrregularPattern, item: IrregularItem, fallback: string): string {
    if (item.color !== null) return item.color;
    return rowById(pattern, item.rowId)?.color ?? fallback;
  }

  /**
   * Whether the square grid is drawn at this zoom. Too fine to see is too fine
   * to snap to: an invisible lattice must not quietly move a stitch.
   */
  gridDrawn(): boolean {
    const scene = this.#scene;
    if (scene === null || !scene.pattern.guides.grid.visible) return false;
    const { width, height } = this.#canvas.getBoundingClientRect();
    const step = scene.pattern.guides.grid.size * this.#view.scale;
    return step >= 4 && width / step <= GRID_LIMIT && height / step <= GRID_LIMIT;
  }

  #drawGrid(size: number, color: string, width: number, height: number): void {
    const ctx = this.#ctx;
    const { scale, x, y } = this.#view;
    const step = size * scale;
    if (step < 4 || width / step > GRID_LIMIT || height / step > GRID_LIMIT) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let px = x % step; px < width; px += step) {
      ctx.moveTo(Math.round(px) + 0.5, 0);
      ctx.lineTo(Math.round(px) + 0.5, height);
    }
    for (let py = y % step; py < height; py += step) {
      ctx.moveTo(0, Math.round(py) + 0.5);
      ctx.lineTo(width, Math.round(py) + 0.5);
    }
    ctx.stroke();
    ctx.restore();
  }

  #drawSelection(color: string): void {
    const box = this.selectionBox();
    if (box === null) return;
    const ctx = this.#ctx;
    const a = this.#toScreen({ x: box.minX, y: box.minY });
    const b = this.#toScreen({ x: box.maxX, y: box.maxY });
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.setLineDash([]);
    const points = this.#handlePoints(box);
    const rotate = points.get('rotate');
    if (rotate !== undefined) {
      const top = this.#toScreen({ x: (box.minX + box.maxX) / 2, y: box.minY });
      const arm = this.#toScreen(rotate);
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(arm.x, arm.y);
      ctx.stroke();
    }
    ctx.fillStyle = color;
    for (const point of points.values()) {
      const screen = this.#toScreen(point);
      ctx.fillRect(screen.x - HANDLE / 2, screen.y - HANDLE / 2, HANDLE, HANDLE);
    }
    ctx.restore();
  }

  /** Where the three grips of an arc sit, in chart units. */
  #arcHandles(arc: ArcPath): ReadonlyMap<ArcHandleId, ChartPoint> {
    return new Map<ArcHandleId, ChartPoint>([
      ['start', arc.start],
      ['end', arc.end],
      ['bulge', arcAt(arc, 0.5).at],
    ]);
  }

  arcHandleAt(clientX: number, clientY: number): ArcHandleId | null {
    const scene = this.#scene;
    if (scene === null || scene.arc === null) return null;
    const rect = this.#canvas.getBoundingClientRect();
    const [px, py] = [clientX - rect.left, clientY - rect.top];
    for (const [id, point] of this.#arcHandles(scene.arc)) {
      const screen = this.#toScreen(point);
      if (Math.abs(screen.x - px) <= HANDLE_HIT && Math.abs(screen.y - py) <= HANDLE_HIT) return id;
    }
    return null;
  }

  #drawArcPath(arc: ArcPath, color: string, grips: boolean): void {
    const ctx = this.#ctx;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = grips ? 0.7 : 0.45;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    for (let step = 0; step <= ARC_SAMPLES; step += 1) {
      const screen = this.#toScreen(arcAt(arc, step / ARC_SAMPLES).at);
      if (step === 0) ctx.moveTo(screen.x, screen.y);
      else ctx.lineTo(screen.x, screen.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    if (grips) {
      ctx.fillStyle = color;
      for (const point of this.#arcHandles(arc).values()) {
        const screen = this.#toScreen(point);
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, HANDLE / 2 + 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  #drawMarquee(marquee: Marquee | null, color: string): void {
    if (marquee === null) return;
    const ctx = this.#ctx;
    const a = this.#toScreen(marquee.from);
    const b = this.#toScreen(marquee.to);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.1;
    ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    ctx.restore();
  }

  #resize(): void {
    const { width, height } = this.#canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.#canvas.width = Math.round(width * dpr);
    this.#canvas.height = Math.round(height * dpr);
    this.render();
  }
}
