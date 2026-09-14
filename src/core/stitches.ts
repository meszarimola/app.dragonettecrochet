/*
 * A prototípus négy öltése: azonosító, magyar és angol név, rövidítés.
 *
 * Átmeneti lista: a PQW-867 öltéskönyvtára váltja fel a types.ts `StitchDef`
 * felületére építve. A jel rajza és a gyorsbillentyű a felülethez tartozik,
 * ezért a src/ui/symbols.ts-ben van.
 */

export type StitchId = 'chain' | 'single' | 'halfDouble' | 'double';

export interface PrototypeStitch {
  readonly id: StitchId;
  /** Magyar név és rövidítés. */
  readonly hu: string;
  readonly abbrHu: string;
  /** Angol név és rövidítés (CYC). */
  readonly en: string;
  readonly abbrEn: string;
}

export const STITCHES: readonly PrototypeStitch[] = [
  { id: 'chain', hu: 'Láncszem', abbrHu: 'lsz', en: 'Chain', abbrEn: 'ch' },
  { id: 'single', hu: 'Rövidpálca', abbrHu: 'rp', en: 'Single crochet', abbrEn: 'sc' },
  { id: 'halfDouble', hu: 'Félpálca', abbrHu: 'fp', en: 'Half double crochet', abbrEn: 'hdc' },
  { id: 'double', hu: 'Pálca', abbrHu: 'p', en: 'Double crochet', abbrEn: 'dc' },
];

export function stitchById(id: StitchId): PrototypeStitch {
  const found = STITCHES.find((s) => s.id === id);
  if (!found) throw new Error(`Ismeretlen jel: ${id}`);
  return found;
}
