/*
 * A jelek rajza és gyorsbillentyűje öltésenként.
 *
 * A jelek a Craft Yarn Council nemzetközi horgolt jelöléseit követik, mert a
 * minták angolul is megjelennek. Minden jel a saját, origó-középpontú
 * koordinátarendszerébe rajzol, nagyjából egy 26×30 egységes dobozba: így
 * ugyanaz a függvény szolgálja ki a vásznat és a paletta kis előnézetét is,
 * csak a hívó transzformációja tér el.
 *
 * A rajzoló függvények nem állítanak színt és vonalvastagságot — azt a hívó
 * adja meg, hogy a nagyítás és a téma egy helyen legyen szabályozható.
 */

import type { StitchId } from '../core/stitches.js';

export interface StitchSymbol {
  /** Gyorsbillentyű a palettához. */
  readonly key: string;
  readonly draw: (ctx: CanvasRenderingContext2D) => void;
}

/** Függőleges szár — a fél- és az egész pálca közös alapja. */
function stem(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.lineTo(0, 13);
  ctx.stroke();

  // Felső keresztvonal.
  ctx.beginPath();
  ctx.moveTo(-8, -13);
  ctx.lineTo(8, -13);
  ctx.stroke();
}

/** Minden öltésnek van jele: a `Record` miatt egy hiányzó jel típushiba. */
export const SYMBOLS: Readonly<Record<StitchId, StitchSymbol>> = {
  chain: {
    key: '1',
    draw(ctx) {
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    },
  },
  single: {
    key: '2',
    draw(ctx) {
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(0, 9);
      ctx.moveTo(-9, 0);
      ctx.lineTo(9, 0);
      ctx.stroke();
    },
  },
  halfDouble: {
    key: '3',
    draw: stem,
  },
  double: {
    key: '4',
    draw(ctx) {
      stem(ctx);

      // Egy ferde áthúzás a száron — ez különbözteti meg a félpálcától.
      ctx.beginPath();
      ctx.moveTo(-6, 4);
      ctx.lineTo(6, -4);
      ctx.stroke();
    },
  },
};
