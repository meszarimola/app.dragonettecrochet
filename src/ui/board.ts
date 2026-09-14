/*
 * A vászon: méretezés, a lerakott jelek tárolása, újrarajzolás.
 *
 * A jelek koordinátáit CSS-pixelben tároljuk, a vászon bal felső sarkához
 * képest. A HiDPI-felbontást a kontextus léptékezése intézi, így a rajzoló
 * kód nem tud a képernyő pixelsűrűségéről.
 */

import { stitchById } from '../core/stitches.js';
import type { StitchDefId } from '../core/types.js';
import {
  DEFAULT_SYMBOL_OPTIONS,
  applyInk,
  drawCentered,
  readInk,
  symbolShapes,
  type Shape,
  type SymbolOptions,
} from './symbols.js';

export interface PlacedStitch {
  readonly id: StitchDefId;
  /** CSS-pixel a vászon bal felső sarkához képest. */
  readonly x: number;
  readonly y: number;
}

export class Board {
  readonly #canvas: HTMLCanvasElement;
  readonly #ctx: CanvasRenderingContext2D;
  readonly #placed: PlacedStitch[] = [];
  readonly #options: SymbolOptions;
  /** A jel geometriája öltésenként egyszer számolódik. */
  readonly #shapes = new Map<StitchDefId, readonly Shape[]>();
  readonly #ink: string;

  constructor(canvas: HTMLCanvasElement, options: SymbolOptions = DEFAULT_SYMBOL_OPTIONS) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('A 2D vászon-kontextus nem érhető el.');

    this.#canvas = canvas;
    this.#ctx = ctx;
    this.#options = options;
    this.#ink = readInk(canvas);

    new ResizeObserver(() => this.#resize()).observe(canvas);
    this.#resize();
  }

  get count(): number {
    return this.#placed.length;
  }

  /** Lerak egy jelet oda, ahová az egérmutató mutat (ablak-koordinátában). */
  place(id: StitchDefId, clientX: number, clientY: number): void {
    const rect = this.#canvas.getBoundingClientRect();
    this.#placed.push({ id, x: clientX - rect.left, y: clientY - rect.top });
    this.render();
  }

  render(): void {
    const ctx = this.#ctx;
    const { width, height } = this.#canvas.getBoundingClientRect();

    ctx.clearRect(0, 0, width, height);
    applyInk(ctx, this.#ink, 2);

    for (const stitch of this.#placed) {
      ctx.save();
      ctx.translate(stitch.x, stitch.y);
      drawCentered(ctx, this.#shapesOf(stitch.id));
      ctx.restore();
    }
  }

  #shapesOf(id: StitchDefId): readonly Shape[] {
    let shapes = this.#shapes.get(id);
    if (!shapes) {
      shapes = symbolShapes(stitchById(id), this.#options);
      this.#shapes.set(id, shapes);
    }
    return shapes;
  }

  /*
   * A vászon rajzfelülete a tényleges pixelekben méreteződik, a kontextust
   * pedig visszaléptékezzük CSS-pixelre. A transzformáció beállítása törli a
   * tartalmat, ezért a végén újra kell rajzolni.
   */
  #resize(): void {
    const { width, height } = this.#canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.#canvas.width = Math.round(width * dpr);
    this.#canvas.height = Math.round(height * dpr);
    this.#ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.render();
  }
}
