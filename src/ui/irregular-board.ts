// The free-form drawing surface. KB: interface.md §1, §15

import { type Box, isSelectable, isVisible, itemBox, itemsBox, rowById } from '../core/irregular-document.ts';
import type { IrregularItem, IrregularPattern } from '../core/irregular-types.ts';
import { itemShapes } from './irregular-glyph.ts';
import { applyInk, drawShapes, type Point, type Shape, type SymbolOptions } from './symbols.ts';

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
const HIT_SLACK = 6;
const HANDLE = 8;
const HANDLE_HIT = 14;
const ROTATE_ARM = 26;
const GRID_LIMIT = 400;

export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate';

export interface Marquee {
  readonly from: Point;
  readonly to: Point;
}

export interface FreeScene {
  readonly pattern: IrregularPattern;
  readonly symbols: SymbolOptions;
  readonly selection: ReadonlySet<string>;
  readonly marquee: Marquee | null;
  readonly ghost: readonly Shape[] | null;
  readonly hover: string | null;
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
    return itemsBox(scene.pattern.items.filter((item) => isVisible(scene.pattern, item)));
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

  handleAt(clientX: number, clientY: number): HandleId | null {
    const box = this.selectionBox();
    if (box === null) return null;
    const rect = this.#canvas.getBoundingClientRect();
    const [px, py] = [clientX - rect.left, clientY - rect.top];
    for (const [id, point] of this.#handlePoints(box)) {
      const screen = this.#toScreen(point);
      if (Math.abs(screen.x - px) <= HANDLE_HIT && Math.abs(screen.y - py) <= HANDLE_HIT) return id;
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
    const order = new Map(scene.pattern.layers.map((layer, index) => [layer.id, index]));
    const drawable = scene.pattern.items
      .filter((item) => isVisible(scene.pattern, item))
      .map((item, index) => ({ item, index, layer: order.get(item.layerId) ?? 0 }))
      .sort((a, b) => a.layer - b.layer || a.index - b.index);

    for (const { item } of drawable) {
      applyInk(ctx, this.#inkOf(scene.pattern, item, colors.ink), line);
      drawShapes(ctx, itemShapes(item, scene.symbols));
    }

    if (scene.ghost !== null) {
      ctx.globalAlpha = 0.45;
      applyInk(ctx, colors.accent, line);
      drawShapes(ctx, scene.ghost);
      ctx.globalAlpha = 1;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.#drawSelection(colors.accent);
    this.#drawMarquee(scene.marquee, colors.accent);
  }

  #inkOf(pattern: IrregularPattern, item: IrregularItem, fallback: string): string {
    if (item.color !== null) return item.color;
    return rowById(pattern, item.rowId)?.color ?? fallback;
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
