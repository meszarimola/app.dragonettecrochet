// KB: interface.md §14, §15, §16

import { aimAt, type ChartGrid, chartBounds, type GridSeam, gridHit, seamAt } from '../core/grid.js';
import type { ChartLayout, NodePlacement, Point } from '../core/layout.js';
import type { StitchLibrary } from '../core/stitch-library.js';
import type { NodeId, StitchInsertion, Tradition } from '../core/types.js';
import { rowCaptions } from './chart-labels.js';
import { type GridPaths, gridPaths, LINE_WIDTH } from './grid-paths.js';
import { gridCoreText } from './i18n/core/grid.js';
import { applyInk, drawShapes, placedShapes, type SymbolOptions, shapesBounds } from './symbols.js';

export interface Target {
  readonly point: Point;
}

export interface DirectionArrow {
  readonly from: Point;
  readonly to: Point;
}

export interface Scene {
  readonly layout: ChartLayout;
  readonly library: StitchLibrary;
  readonly targets: readonly Target[];
  readonly hover: number | null;
  readonly seam?: GridSeam['at'] | null;
  readonly selected: NodeId | null;
  readonly selection?: readonly NodeId[];
  readonly affected?: readonly NodeId[];
  readonly marquee?: { readonly from: Point; readonly to: Point } | null;
  // KB: decisions.md §4, interface.md §20 — the chart is clean unless the user asks.
  readonly highlight?: readonly NodeId[] | null;
  readonly direction: DirectionArrow | null;
  // KB: interface.md §18
  readonly nextRow?: { readonly text: string; readonly layer: number } | null;
  readonly symbols: SymbolOptions;
  // KB: interface.md §22 — the stored, right-side mode.
  readonly insertions?: ReadonlyMap<NodeId, StitchInsertion>;
  readonly grid: ChartGrid | null;
  readonly tradition?: Tradition;
  readonly unitFrames?: readonly {
    readonly x0: number;
    readonly y0: number;
    readonly x1: number;
    readonly y1: number;
  }[];
  readonly spikes?: ReadonlySet<NodeId>;
}

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface Area {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

interface View {
  scale: number;
  x: number;
  y: number;
}

// KB: interface.md §15 — canvas pixels, because the label does not scale with the drawing.
interface Label {
  readonly layer: number;
  readonly text: string;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

const MIN_SCALE = 0.3;
const MAX_SCALE = 4;
const MIN_FIT_SCALE = 0.05;
const HIT = 16;
const LABEL_HEIGHT = 16;
const LABEL_GAP = 12;
// KB: interface.md §16 — WCAG 2.5.8 minimum target size.
const MIN_TARGET = 24;

function token(element: Element, name: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim();
}

export class Board {
  readonly #canvas: HTMLCanvasElement;
  readonly #ctx: CanvasRenderingContext2D;
  readonly #view: View = { scale: 1.5, x: 40, y: 200 };
  #scene: Scene | null = null;
  #labels: Label[] = [];
  #arrowBounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  #insets = { left: 0, right: 0 };
  #paths: { readonly grid: ChartGrid; readonly paths: GridPaths } | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('A 2D vászon-kontextus nem érhető el.');
    this.#canvas = canvas;
    this.#ctx = ctx;
    new ResizeObserver(() => this.#resize()).observe(canvas);
    this.#resize();
  }

  get scale(): number {
    return this.#view.scale;
  }

  setScene(scene: Scene): void {
    this.#scene = scene;
    this.render();
  }

  // KB: interface.md §15
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
    const s = this.#toScreen(p);
    return { x: s.x + rect.left, y: s.y + rect.top };
  }

  #toScreen(p: Point): Point {
    const { scale, x, y } = this.#view;
    return { x: p.x * scale + x, y: p.y * scale + y };
  }

  targetAt(clientX: number, clientY: number): number | null {
    const targets = this.#scene?.targets ?? [];
    return this.#nearest(
      clientX,
      clientY,
      targets.map((target) => target.point),
    );
  }

  // KB: interface.md §28
  aimUnder(clientX: number, clientY: number): number | string | null {
    const grid = this.#scene?.grid;
    if (grid) {
      const hit = gridHit(grid, this.toChart(clientX, clientY));
      if (hit) {
        const aim = aimAt(grid, hit);
        return aim.kind === 'target' ? aim.slot : gridCoreText(aim.message);
      }
    }
    return this.targetAt(clientX, clientY);
  }

  // KB: interface.md §28
  gapUnder(clientX: number, clientY: number): { layer: number; into: NodeId } | null {
    const grid = this.#scene?.grid;
    if (!grid) return null;
    const hit = gridHit(grid, this.toChart(clientX, clientY));
    return hit?.kind === 'cell' && hit.cell.gap ? { layer: hit.cell.layer, into: hit.cell.gap } : null;
  }

  // KB: interface.md §28
  seamUnder(clientX: number, clientY: number): GridSeam | null {
    const grid = this.#scene?.grid;
    return grid ? seamAt(grid, this.toChart(clientX, clientY)) : null;
  }

  labelAt(clientX: number, clientY: number): number | null {
    const rect = this.#canvas.getBoundingClientRect();
    const p = { x: clientX - rect.left, y: clientY - rect.top };
    const inside = (l: Label) => p.x >= l.x0 && p.x <= l.x1 && p.y >= l.y0 && p.y <= l.y1;
    // KB: interface.md §16
    const pad = (size: number) => Math.max(0, (MIN_TARGET - size) / 2);
    const label = this.#labels.find((l) => {
      const [px, py] = [pad(l.x1 - l.x0), pad(l.y1 - l.y0)];
      return p.x >= l.x0 - px && p.x <= l.x1 + px && p.y >= l.y0 - py && p.y <= l.y1 + py;
    });
    if (!label) return null;
    // KB: interface.md §16 — outside the label's own box, a grid hit wins.
    const grid = this.#scene?.grid;
    if (!inside(label) && grid && gridHit(grid, this.toChart(clientX, clientY))) return null;
    return label.layer;
  }

  labels(): { layer: number; x: number; y: number }[] {
    const rect = this.#canvas.getBoundingClientRect();
    return this.#labels.map((l) => ({
      layer: l.layer,
      x: rect.left + (l.x0 + l.x1) / 2,
      y: rect.top + (l.y0 + l.y1) / 2,
    }));
  }

  #clientRect(b: { minX: number; minY: number; maxX: number; maxY: number }): Rect {
    const a = this.toClient({ x: b.minX, y: b.minY });
    const c = this.toClient({ x: b.maxX, y: b.maxY });
    return { left: Math.min(a.x, c.x), top: Math.min(a.y, c.y), right: Math.max(a.x, c.x), bottom: Math.max(a.y, c.y) };
  }

  labelBoxes(): (Rect & { layer: number; text: string })[] {
    const rect = this.#canvas.getBoundingClientRect();
    return this.#labels.map((l) => ({
      layer: l.layer,
      text: l.text,
      left: rect.left + l.x0,
      top: rect.top + l.y0,
      right: rect.left + l.x1,
      bottom: rect.top + l.y1,
    }));
  }

  #nodeBounds(node: NodePlacement): { minX: number; minY: number; maxX: number; maxY: number } | null {
    const scene = this.#scene;
    const def = scene?.library.get(node.def);
    if (!scene || !def) return null;
    const insertion = scene.insertions?.get(node.id);
    return shapesBounds(placedShapes(def, node, insertion ? { ...scene.symbols, insertion } : scene.symbols));
  }

  arrowBox(): Rect | null {
    return this.#arrowBounds ? this.#clientRect(this.#arrowBounds) : null;
  }

  stitchBoxes(): (Rect & { id: NodeId; layer: number })[] {
    const scene = this.#scene;
    if (!scene) return [];
    const boxes: (Rect & { id: NodeId; layer: number })[] = [];
    for (const node of scene.layout.nodes.values()) {
      const bounds = this.#nodeBounds(node);
      if (bounds) boxes.push({ id: node.id, layer: node.layer, ...this.#clientRect(bounds) });
    }
    return boxes;
  }

  gridCells(): { layer: number; index: number; slot: number | null; x: number; y: number }[] {
    const cells = this.#scene?.grid?.cells ?? [];
    return cells.map((cell) => ({
      layer: cell.layer,
      index: cell.index,
      slot: cell.slot,
      ...this.toClient(cell.center),
    }));
  }

  nodeAt(clientX: number, clientY: number): NodeId | null {
    const nodes = [...(this.#scene?.layout.nodes.values() ?? [])];
    const index = this.#nearest(
      clientX,
      clientY,
      nodes.map((node) => node.top),
    );
    return index === null ? null : nodes[index]!.id;
  }

  #nearest(clientX: number, clientY: number, points: readonly Point[]): number | null {
    const p = this.toChart(clientX, clientY);
    let best: number | null = null;
    let bestDistance = HIT / this.#view.scale;
    points.forEach((point, i) => {
      const distance = Math.hypot(point.x - p.x, point.y - p.y);
      if (distance <= bestDistance) {
        best = i;
        bestDistance = distance;
      }
    });
    return best;
  }

  zoom(factor: number): void {
    const { width, height } = this.#canvas.getBoundingClientRect();
    // KB: interface.md §15 — fitting may go below the smallest step; zooming out must not snap back.
    const scale = Math.min(MAX_SCALE, Math.max(Math.min(MIN_SCALE, this.#view.scale), this.#view.scale * factor));
    const k = scale / this.#view.scale;
    this.#view.x = width / 2 - (width / 2 - this.#view.x) * k;
    this.#view.y = height / 2 - (height / 2 - this.#view.y) * k;
    this.#view.scale = scale;
    this.render();
  }

  gridBounds(): { left: number; top: number; right: number; bottom: number } | null {
    const grid = this.#scene?.grid;
    if (!grid || grid.bands.length === 0) return null;
    const a = this.toClient({ x: grid.bounds.minX, y: grid.bounds.minY });
    const b = this.toClient({ x: grid.bounds.maxX, y: grid.bounds.maxY });
    return { left: Math.min(a.x, b.x), top: Math.min(a.y, b.y), right: Math.max(a.x, b.x), bottom: Math.max(a.y, b.y) };
  }

  // KB: interface.md §15
  fit(insetRight = 0, insetLeft = 0, insetBottom = 0): void {
    const layout = this.#scene?.layout;
    const { width, height } = this.#canvas.getBoundingClientRect();
    const roomY = height - insetBottom;
    // KB: interface.md §13 — nothing to fit behind a panel covering the whole stage.
    if (roomY < 1) return;
    if (!layout || layout.nodes.size === 0) {
      Object.assign(this.#view, { scale: 1.5, x: insetLeft + 200, y: roomY * 0.7 });
      this.render();
      return;
    }
    const { minX, minY, maxX, maxY } = chartBounds(layout, this.#scene?.grid);
    const room = Math.max(width - insetRight - insetLeft, 120);
    // KB: interface.md §15 — subtract the caption room from the band, never add it to the bounds.
    const labelRoom =
      this.#labels.length === 0 ? 0 : this.#labels.reduce((max, l) => Math.max(max, l.x1 - l.x0), 0) + LABEL_GAP;
    const marginY = Math.min(72, roomY / 2);
    const scale = Math.min(
      2,
      Math.max(MIN_FIT_SCALE, Math.min((room - 48 - 2 * labelRoom) / (maxX - minX), (roomY - marginY) / (maxY - minY))),
    );
    this.#view.scale = scale;
    this.#view.x = insetLeft + (room - (maxX - minX) * scale) / 2 - minX * scale;
    this.#view.y = (roomY - (maxY - minY) * scale) / 2 - minY * scale;
    this.render();
  }

  // Pans only when the point is outside the visible band, so the chart does not jump while editing.
  ensureVisible(point: Point, insetRight = 0, insetLeft = 0, insetBottom = 0): void {
    const { width, height } = this.#canvas.getBoundingClientRect();
    const roomY = height - insetBottom;
    if (roomY < 1) return;
    const s = this.#toScreen(point);
    // At most half the visible band, or in a narrow band the point bounces between the two edges.
    const padX = Math.min(48, Math.max(0, (width - insetRight - insetLeft) / 2));
    const padY = Math.min(48, roomY / 2);
    let dx = 0;
    let dy = 0;
    if (s.x < insetLeft + padX) dx = insetLeft + padX - s.x;
    else if (s.x > width - insetRight - padX) dx = width - insetRight - padX - s.x;
    if (s.y < padY) dy = padY - s.y;
    else if (s.y > roomY - padY) dy = roomY - padY - s.y;
    if (dx === 0 && dy === 0) return;
    this.#view.x += dx;
    this.#view.y += dy;
    this.render();
  }

  patternWithin(area: Area): boolean {
    const layout = this.#scene?.layout;
    if (!layout || layout.nodes.size === 0) return false;
    const { minX, minY, maxX, maxY } = chartBounds(layout, this.#scene?.grid);
    const a = this.#toScreen({ x: minX, y: minY });
    const b = this.#toScreen({ x: maxX, y: maxY });
    return (
      Math.min(a.x, b.x) >= area.left &&
      Math.max(a.x, b.x) <= area.right &&
      Math.min(a.y, b.y) >= area.top &&
      Math.max(a.y, b.y) <= area.bottom
    );
  }

  pan(dx: number, dy: number): void {
    this.#view.x += dx;
    this.#view.y += dy;
    this.render();
  }

  render(): void {
    const ctx = this.#ctx;
    const canvas = this.#canvas;
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const scene = this.#scene;
    this.#arrowBounds = null;
    if (!scene) return;

    const { scale, x, y } = this.#view;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * x, dpr * y);
    const colors = {
      right: token(canvas, '--c-ink'),
      wrong: token(canvas, '--c-ink-wrong'),
      accent: token(canvas, '--c-accent'),
      error: token(canvas, '--c-error'),
      warning: token(canvas, '--c-warning'),
      muted: token(canvas, '--c-muted'),
      text: token(canvas, '--c-text'),
      background: token(canvas, '--c-bg'),
    };
    const line = Math.max(1.5, 1 / scale);

    if (scene.grid) this.#drawGrid(scene.grid, scale);
    for (const { x0, y0, x1, y1 } of scene.unitFrames ?? []) {
      applyInk(ctx, colors.accent, Math.max(2, 2 / scale));
      ctx.globalAlpha = 0.08;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.globalAlpha = 1;
      ctx.setLineDash([6 / scale, 4 / scale]);
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      ctx.setLineDash([]);
    }

    for (const node of scene.layout.nodes.values()) {
      const def = scene.library.get(node.def);
      if (!def) continue;
      applyInk(ctx, colors[node.side], line);
      const insertion = scene.insertions?.get(node.id);
      drawShapes(ctx, placedShapes(def, node, insertion ? { ...scene.symbols, insertion } : scene.symbols));
      const foot = scene.spikes?.has(node.id) ? node.feet[0] : undefined;
      if (foot) {
        ctx.beginPath();
        ctx.arc(foot.x, foot.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // KB: interface.md §15 — the transform is reset because the label is NOT scaled with the drawing.
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = '700 12px Karla, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    this.#labels = [];
    const bounds = scene.layout.bounds;
    // KB: interface.md §15 — the widths come from the interface; the CSS variable is not readable in px.
    const { left: safeStart, right: safeEnd } = this.#insets;
    const chartLeft = this.#toScreen({ x: bounds.minX, y: 0 }).x;
    const chartRight = this.#toScreen({ x: bounds.maxX, y: 0 }).x;
    // KB: interface.md §15, §18 — the row numbers AND the next-row marker both go through this.
    const drawPill = (layer: number, text: string, rightwards: boolean, y: number, fill: string, dy = 0): void => {
      const labelWidth = ctx.measureText(text).width + 10;
      const screen = this.#toScreen({ x: rightwards ? bounds.maxX : bounds.minX, y });
      const anchor = { x: screen.x, y: screen.y + dy };
      const wanted = rightwards ? anchor.x + LABEL_GAP : anchor.x - LABEL_GAP - labelWidth;
      const lo = safeStart + 4;
      const hi = Math.max(lo, width - safeEnd - labelWidth - 4);
      const hugged = Math.min(Math.max(wanted, lo), hi);
      // KB: interface.md §15 — covering is forbidden, overflowing is allowed.
      const x0 = hugged + labelWidth > chartLeft && hugged < chartRight ? wanted : hugged;
      const label: Label = {
        layer,
        text,
        x0,
        x1: x0 + labelWidth,
        y0: anchor.y - LABEL_HEIGHT / 2,
        y1: anchor.y + LABEL_HEIGHT / 2,
      };
      this.#labels.push(label);
      applyInk(ctx, fill, 1);
      ctx.beginPath();
      ctx.roundRect(label.x0, label.y0, labelWidth, LABEL_HEIGHT, 4);
      ctx.fill();
      applyInk(ctx, colors.background, 1);
      ctx.textAlign = 'center';
      ctx.fillText(text, (label.x0 + label.x1) / 2, anchor.y);
    };

    // KB: interface.md §14
    for (const { layer, text, rightwards, side, end } of rowCaptions(scene.layout, scene.tradition ?? 'cyc')) {
      drawPill(layer, text, rightwards, end.y, colors[side]);
    }

    // KB: interface.md §18
    if (scene.nextRow && scene.direction) {
      const { from, to } = scene.direction;
      const leftwards = to.x < from.x;
      const text = leftwards ? `← ${scene.nextRow.text}` : `${scene.nextRow.text} →`;
      // KB: interface.md §18 — lifted by one label height; the unstarted row has no height yet.
      drawPill(
        scene.nextRow.layer,
        text,
        from.x >= (bounds.minX + bounds.maxX) / 2,
        from.y,
        colors.accent,
        -(LABEL_HEIGHT + 4),
      );
    }
    ctx.restore();

    this.#arrowBounds = null;

    // KB: decisions.md §4, interface.md §20
    if (scene.highlight?.length) {
      applyInk(ctx, colors.error, Math.max(2, 1.5 / scale));
      ctx.setLineDash([4, 3]);
      for (const id of scene.highlight) {
        const node = scene.layout.nodes.get(id);
        if (!node) continue;
        ctx.beginPath();
        ctx.arc(node.top.x, node.top.y, 12, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // Solid for the selection, dashed for the stitches a delete would take with it: not colour alone.
    applyInk(ctx, colors.accent, Math.max(1.5, 1 / scale));
    for (const id of scene.selection ?? []) {
      const node = scene.layout.nodes.get(id);
      if (node) ctx.strokeRect(node.top.x - 11, node.top.y - 11, 22, 22);
    }
    applyInk(ctx, colors.error, Math.max(2, 1.5 / scale));
    ctx.setLineDash([4, 3]);
    for (const id of scene.affected ?? []) {
      const node = scene.layout.nodes.get(id);
      if (node) ctx.strokeRect(node.top.x - 13, node.top.y - 13, 26, 26);
    }
    ctx.setLineDash([]);

    if (scene.selected) {
      const node = scene.layout.nodes.get(scene.selected);
      if (node) {
        applyInk(ctx, colors.accent, Math.max(2, 1.5 / scale));
        ctx.strokeRect(node.top.x - 14, node.top.y - 14, 28, 28);
      }
    }

    if (scene.marquee) {
      const { from, to } = scene.marquee;
      applyInk(ctx, colors.accent, Math.max(1.5, 1.5 / scale));
      ctx.setLineDash([5 / scale, 4 / scale]);
      ctx.strokeRect(Math.min(from.x, to.x), Math.min(from.y, to.y), Math.abs(to.x - from.x), Math.abs(to.y - from.y));
      ctx.setLineDash([]);
    }

    // KB: decisions.md §4, interface.md §28
    if (scene.seam) {
      applyInk(ctx, colors.accent, Math.max(2.5, 2 / scale));
      ctx.beginPath();
      ctx.moveTo(scene.seam.x, scene.seam.y0);
      ctx.lineTo(scene.seam.x, scene.seam.y1);
      ctx.stroke();
    }

    const hovered = scene.hover === null ? undefined : scene.targets[scene.hover];
    if (hovered) {
      applyInk(ctx, colors.accent, Math.max(1.5, 1 / scale));
      ctx.beginPath();
      ctx.arc(hovered.point.x, hovered.point.y, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  #drawGrid(grid: ChartGrid, scale: number): void {
    const ctx = this.#ctx;
    const canvas = this.#canvas;
    if (this.#paths?.grid !== grid) this.#paths = { grid, paths: gridPaths(grid) };
    const { bands, lines } = this.#paths.paths;
    const tones = [token(canvas, '--c-row-a'), token(canvas, '--c-row-b')];
    for (const band of bands) {
      applyInk(ctx, tones[band.tone]!, 1);
      ctx.fill(new Path2D(band.d), band.evenOdd ? 'evenodd' : 'nonzero');
    }
    const strong = token(canvas, '--c-grid-strong');
    const stroke = { cell: token(canvas, '--c-grid'), row: token(canvas, '--c-grid-row'), five: strong, ten: strong };
    for (const path of lines) {
      applyInk(ctx, stroke[path.weight], LINE_WIDTH[path.weight] / scale);
      ctx.setLineDash(path.dashed ? [4 / scale, 3 / scale] : []);
      ctx.stroke(new Path2D(path.d));
    }
    ctx.setLineDash([]);
  }

  #resize(): void {
    const { width, height } = this.#canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.#canvas.width = Math.round(width * dpr);
    this.#canvas.height = Math.round(height * dpr);
    this.render();
  }
}
