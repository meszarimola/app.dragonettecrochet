/*
 * A vászon: a számolt elrendezés kirajzolása, a nézet (nagyítás, eltolás) és
 * a találatkeresés.
 *
 * A diagram koordinátái a src/core/layout.ts egységében vannak; a képernyőre
 * a nézet léptéke és eltolása viszi, a HiDPI-felbontást a kontextus
 * léptékezése intézi. A vászon nem tud a mintáról, csak a jelenetről, amelyet a
 * main.ts ad át.
 */

import type { ChartLayout, Point } from '../core/layout.js';
import type { StitchLibrary } from '../core/stitch-library.js';
import type { Finding, NodeId } from '../core/types.js';
import { applyInk, drawShapes, placedShapes, type SymbolOptions } from './symbols.js';

export interface Target {
  readonly point: Point;
  readonly used: boolean;
}

export interface Scene {
  readonly layout: ChartLayout;
  readonly library: StitchLibrary;
  readonly targets: readonly Target[];
  readonly cursor: number | null;
  readonly hover: number | null;
  readonly selected: NodeId | null;
  readonly findings: readonly Finding[];
  /** A jelek stílusa és a rövidpálca jele (PQW-868). */
  readonly symbols: SymbolOptions;
}

interface View {
  scale: number;
  x: number;
  y: number;
}

const MIN_SCALE = 0.3;
const MAX_SCALE = 4;
/** Ennyi képernyőpixelen belül talál a kattintás célpontot vagy jelet. */
const HIT = 16;

function token(element: Element, name: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim();
}

export class Board {
  readonly #canvas: HTMLCanvasElement;
  readonly #ctx: CanvasRenderingContext2D;
  readonly #view: View = { scale: 1.5, x: 40, y: 200 };
  #scene: Scene | null = null;

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

  /** Ablak-koordinátából diagram-koordináta. */
  toChart(clientX: number, clientY: number): Point {
    const rect = this.#canvas.getBoundingClientRect();
    const { scale, x, y } = this.#view;
    return { x: (clientX - rect.left - x) / scale, y: (clientY - rect.top - y) / scale };
  }

  #toScreen(p: Point): Point {
    const { scale, x, y } = this.#view;
    return { x: p.x * scale + x, y: p.y * scale + y };
  }

  /** A legközelebbi célpont indexe a mutató alatt. */
  targetAt(clientX: number, clientY: number): number | null {
    const targets = this.#scene?.targets ?? [];
    return this.#nearest(clientX, clientY, targets.map((target) => target.point));
  }

  /** A legközelebbi jel a mutató alatt (a teteje vagy a középpontja). */
  nodeAt(clientX: number, clientY: number): NodeId | null {
    const nodes = [...(this.#scene?.layout.nodes.values() ?? [])];
    const index = this.#nearest(clientX, clientY, nodes.map((node) => node.top));
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
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.#view.scale * factor));
    const k = scale / this.#view.scale;
    this.#view.x = width / 2 - (width / 2 - this.#view.x) * k;
    this.#view.y = height / 2 - (height / 2 - this.#view.y) * k;
    this.#view.scale = scale;
    this.render();
  }

  /** Az egész minta a látható részbe; `insetRight` és `insetLeft` a vászon fölött nyitott panelek szélessége. */
  fit(insetRight = 0, insetLeft = 0): void {
    const layout = this.#scene?.layout;
    const { width, height } = this.#canvas.getBoundingClientRect();
    if (!layout || layout.nodes.size === 0) {
      Object.assign(this.#view, { scale: 1.5, x: insetLeft + 60, y: height * 0.7 });
      this.render();
      return;
    }
    const { minX, minY, maxX, maxY } = layout.bounds;
    const room = Math.max(width - insetRight - insetLeft, 120);
    const scale = Math.min(2, Math.max(MIN_SCALE, Math.min((room - 48) / (maxX - minX), (height - 72) / (maxY - minY))));
    this.#view.scale = scale;
    this.#view.x = insetLeft + (room - (maxX - minX) * scale) / 2 - minX * scale;
    this.#view.y = (height - (maxY - minY) * scale) / 2 - minY * scale;
    this.render();
  }

  /** Csak akkor tol a nézeten, ha a pont kilóg a látható részből; így szerkesztés közben a diagram nem ugrál. */
  ensureVisible(point: Point, insetRight = 0, insetLeft = 0): void {
    const { width, height } = this.#canvas.getBoundingClientRect();
    const s = this.#toScreen(point);
    const pad = 48;
    let dx = 0;
    let dy = 0;
    if (s.x < insetLeft + pad) dx = insetLeft + pad - s.x;
    else if (s.x > width - insetRight - pad) dx = width - insetRight - pad - s.x;
    if (s.y < pad) dy = pad - s.y;
    else if (s.y > height - pad) dy = height - pad - s.y;
    if (dx === 0 && dy === 0) return;
    this.#view.x += dx;
    this.#view.y += dy;
    this.render();
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
    };
    const line = Math.max(1.5, 1 / scale);

    for (const node of scene.layout.nodes.values()) {
      const def = scene.library.get(node.def);
      if (!def) continue;
      applyInk(ctx, colors[node.side], line);
      drawShapes(ctx, placedShapes(def, node, scene.symbols));
    }

    ctx.font = `700 12px Karla, system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    for (const layer of scene.layout.layers) {
      if (layer.index === 0) continue;
      const rightwards = layer.start.x <= layer.end.x;
      applyInk(ctx, colors[layer.side], line);
      ctx.textAlign = rightwards ? 'right' : 'left';
      ctx.fillText(String(layer.index), layer.start.x, layer.start.y);
      applyInk(ctx, colors.muted, line);
      ctx.textAlign = rightwards ? 'left' : 'right';
      ctx.fillText(`(${layer.stitchCount})`, layer.end.x, layer.end.y);
    }

    // Hibák és figyelmeztetések a jelen: a hiba teli, a figyelmeztetés szaggatott karika, nem csak színben tér el.
    for (const finding of scene.findings) {
      const error = finding.severity === 'error';
      applyInk(ctx, error ? colors.error : colors.warning, Math.max(2, 1.5 / scale));
      ctx.setLineDash(error ? [] : [4, 3]);
      for (const id of finding.nodes) {
        const node = scene.layout.nodes.get(id);
        if (!node) continue;
        ctx.beginPath();
        ctx.arc(node.top.x, node.top.y, 12, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    if (scene.selected) {
      const node = scene.layout.nodes.get(scene.selected);
      if (node) {
        applyInk(ctx, colors.accent, Math.max(2, 1.5 / scale));
        ctx.strokeRect(node.top.x - 14, node.top.y - 14, 28, 28);
      }
    }

    scene.targets.forEach((target, i) => {
      if (target.used && i !== scene.cursor && i !== scene.hover) return;
      ctx.beginPath();
      if (i === scene.cursor) {
        applyInk(ctx, colors.accent, Math.max(2.5, 2 / scale));
        ctx.globalAlpha = 0.25;
        ctx.arc(target.point.x, target.point.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.stroke();
      } else if (i === scene.hover) {
        applyInk(ctx, colors.accent, Math.max(1.5, 1 / scale));
        ctx.arc(target.point.x, target.point.y, 8, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        applyInk(ctx, colors.accent, line);
        ctx.arc(target.point.x, target.point.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  #resize(): void {
    const { width, height } = this.#canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.#canvas.width = Math.round(width * dpr);
    this.#canvas.height = Math.round(height * dpr);
    this.render();
  }
}
