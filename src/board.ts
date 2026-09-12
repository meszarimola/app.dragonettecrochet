/*
 * A vászon: méretezés, a lerakott jelek tárolása, újrarajzolás.
 *
 * A jelek koordinátáit CSS-pixelben tároljuk, a vászon bal felső sarkához
 * képest. A HiDPI-felbontást a kontextus léptékezése intézi, így a rajzoló
 * kód nem tud a képernyő pixelsűrűségéről.
 */

import type { StitchId } from './stitches.js';
import { stitchById } from './stitches.js';

export interface PlacedStitch {
  readonly id: StitchId;
  /** CSS-pixel a vászon bal felső sarkához képest. */
  readonly x: number;
  readonly y: number;
}

export class Board {
  readonly #canvas: HTMLCanvasElement;
  readonly #ctx: CanvasRenderingContext2D;
  readonly #placed: PlacedStitch[] = [];
  #ink = '#241f2b';

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('A 2D vászon-kontextus nem érhető el.');

    this.#canvas = canvas;
    this.#ctx = ctx;

    // A tintaszín a design tokenből jön, hogy ne legyen konkrét hex a kódban.
    const token = getComputedStyle(canvas).getPropertyValue('--c-ink').trim();
    if (token) this.#ink = token;

    new ResizeObserver(() => this.#resize()).observe(canvas);
    this.#resize();
  }

  get count(): number {
    return this.#placed.length;
  }

  /** Lerak egy jelet oda, ahová az egérmutató mutat (ablak-koordinátában). */
  place(id: StitchId, clientX: number, clientY: number): void {
    const rect = this.#canvas.getBoundingClientRect();
    this.#placed.push({ id, x: clientX - rect.left, y: clientY - rect.top });
    this.render();
  }

  render(): void {
    const ctx = this.#ctx;
    const { width, height } = this.#canvas.getBoundingClientRect();

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = this.#ink;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stitch of this.#placed) {
      ctx.save();
      ctx.translate(stitch.x, stitch.y);
      stitchById(stitch.id).draw(ctx);
      ctx.restore();
    }
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
