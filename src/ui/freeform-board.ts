import type { FreeformChart } from '../core/freeform.ts';
import { stitchById } from '../core/stitches.ts';
import { applyInk, drawCentered, type SymbolOptions, symbolShapes } from './symbols.ts';

/** How much larger a stitch is drawn on the canvas than in its own symbol units. */
export const STITCH_SCALE = 1.5;

export class FreeformBoard {
  private chart: FreeformChart | null = null;
  private symbols: SymbolOptions = { singleCrochet: 'plus' };
  private readonly canvas: HTMLCanvasElement;
  private readonly ink: string;

  constructor(canvas: HTMLCanvasElement, ink: string, onPlace: (x: number, y: number) => void) {
    this.canvas = canvas;
    this.ink = ink;
    canvas.addEventListener('click', (event) => {
      const box = canvas.getBoundingClientRect();
      onPlace(event.clientX - box.left, event.clientY - box.top);
    });
    new ResizeObserver(() => this.draw()).observe(canvas);
  }

  show(chart: FreeformChart | null, symbols: SymbolOptions): void {
    this.chart = chart;
    this.symbols = symbols;
    this.canvas.hidden = chart === null;
    this.draw();
  }

  private draw(): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx || this.chart === null) return;
    const dpr = window.devicePixelRatio || 1;
    const { clientWidth, clientHeight } = this.canvas;
    const [width, height] = [Math.round(clientWidth * dpr), Math.round(clientHeight * dpr)];
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, clientWidth, clientHeight);
    for (const placed of this.chart.stitches) {
      ctx.save();
      ctx.translate(placed.x, placed.y);
      applyInk(ctx, this.ink, 2 / STITCH_SCALE);
      drawCentered(ctx, symbolShapes(stitchById(placed.stitch), this.symbols), STITCH_SCALE);
      ctx.restore();
    }
  }
}
