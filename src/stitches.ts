/*
 * Az alap jelkészlet.
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

export type StitchId = 'chain' | 'single' | 'halfDouble' | 'double';

export interface StitchDef {
  readonly id: StitchId;
  /** Magyar név és rövidítés. */
  readonly hu: string;
  readonly abbrHu: string;
  /** Angol név és rövidítés (CYC). */
  readonly en: string;
  readonly abbrEn: string;
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

export const STITCHES: readonly StitchDef[] = [
  {
    id: 'chain',
    hu: 'Láncszem',
    abbrHu: 'lsz',
    en: 'Chain',
    abbrEn: 'ch',
    key: '1',
    draw(ctx) {
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    },
  },
  {
    id: 'single',
    hu: 'Rövidpálca',
    abbrHu: 'rp',
    en: 'Single crochet',
    abbrEn: 'sc',
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
  {
    id: 'halfDouble',
    hu: 'Félpálca',
    abbrHu: 'fp',
    en: 'Half double crochet',
    abbrEn: 'hdc',
    key: '3',
    draw: stem,
  },
  {
    id: 'double',
    hu: 'Pálca',
    abbrHu: 'p',
    en: 'Double crochet',
    abbrEn: 'dc',
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
];

export function stitchById(id: StitchId): StitchDef {
  const found = STITCHES.find((s) => s.id === id);
  if (!found) throw new Error(`Ismeretlen jel: ${id}`);
  return found;
}
