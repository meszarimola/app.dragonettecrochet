/*
 * A bal oldali mintatípus-menü tartalma (PQW-873).
 *
 * DOM nélküli, ezért a Node is futtatja (tests/ui-pattern-types.test.mjs). A
 * gombokat a main.ts rakja ki. A típus adja a kezdést és a körzárás
 * alapértelmezését; a még el nem készült típusok „hamarosan” jelzéssel,
 * inaktívan látszanak, és mérföldkövenként kapcsolnak be (PQW-861…866).
 *
 * Most csak a „szabályos horgolás” aktív: ez a sík sorok és a kör/motívum
 * (pl. nagymama-négyzet), ami a magban már működik. A többi típus mag-oldali
 * logikája (varázskör-kezdés, spirál körzárás, filé- és formagenerátorok) a
 * saját jegyeikben készül el.
 */

export type PatternTypeId = 'regular' | 'filet' | 'amigurumi' | 'irregular';

export interface PatternType {
  readonly id: PatternTypeId;
  /** A menüpont neve a felület nyelvén. */
  readonly name: string;
  /** Rövid magyarázat: mit ad ez a típus. */
  readonly detail: string;
  /** Bekapcsolt-e; ha nem, „hamarosan” jelzéssel, inaktívan látszik. */
  readonly available: boolean;
}

export const PATTERN_TYPES: readonly PatternType[] = [
  {
    id: 'regular',
    name: 'Szabályos horgolás',
    detail: 'Sík sorok, kör és motívum (pl. nagymama-négyzet).',
    available: true,
  },
  {
    id: 'filet',
    name: 'Filéhorgolás',
    detail: 'Rács tömött és üres kockákkal.',
    available: false,
  },
  {
    id: 'amigurumi',
    name: 'Amigurumi',
    detail: 'Spirál körökben, varázskörrel kezdve.',
    available: false,
  },
  {
    id: 'irregular',
    name: 'Szabálytalan horgolás',
    detail: 'Formázott, amorf darab (pl. ruhadarab, babacipő).',
    available: false,
  },
];

export const DEFAULT_PATTERN_TYPE: PatternTypeId = 'regular';

/** Egy azonosító akkor érvényes, ha szerepel a listában és a típusa bekapcsolt. */
export function isAvailableType(id: string): id is PatternTypeId {
  return PATTERN_TYPES.some((type) => type.id === id && type.available);
}
