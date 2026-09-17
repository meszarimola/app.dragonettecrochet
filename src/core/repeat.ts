/*
 * Láncalap és „X többszöröse + Y” számítása a konvenciókból.
 *
 * A két vitatott konvenciót a minta kifejezetten tárolja, sosem feltételezzük
 * csendben (README §4.3, §4.4).
 */

import type { RepeatSpec, Tradition } from './types.ts';

/**
 * Láncalap N szemhez, T láncszemes fordulólánccal (03 §1.2): `N + T`.
 *
 * A hossz a PQW-924-ben sem változott, csak a kihagyás (`tradition.ts`,
 * `firstChainFromHook`): a tulajdonos sálája 39 rövidpálcás sorhoz 40
 * láncszem, 20 félpálcás sorhoz 22. Az „alapláncszem” fogalma megszűnt, ezért
 * a hosszból nincs több levonás vagy hozzáadás.
 */
export function foundationChainLength(
  stitches: number,
  turningChain: number,
  /*
   * A hossz a PQW-924 óta egyikükön sem múlik, de a paraméterek maradnak: hat
   * hívó és a tesztek adják őket, és a kihagyás szabálya (`firstChainFromHook`)
   * továbbra is mindkettőt használja.
   */
  _turningChainCounts: boolean,
  _tradition: Tradition = 'cyc',
): number {
  return stitches + turningChain;
}

export interface RepeatCounts {
  /**
   * A láncalap hossza: a kihagyott láncszemek és a beledolgozottak együtt.
   * Ugyanabból a kihagyásból számol, mint a `foundationChainLength` — a kettő
   * korábban elcsúszott egymástól (PQW-924).
   */
  readonly chains: number;
  /** A láncalap láncszemei, amelyekbe az 1. sor horgol. */
  readonly workedChains: number;
  /**
   * Az 1. sor pozíciószáma: a felhasznált láncszemek, és ha a fordulólánc
   * számít, eggyel több. Kiegyensúlyozott mintában ennyi helyet ad a sor
   * (03 §4.2).
   */
  readonly firstRowPositions: number;
}

/**
 * „X többszöröse + Y” n ismétléssel (03 §4.1, README §4.4). Ha a
 * `turningChainIncluded` igaz, a fordulólánc már benne van az Y-ban; ha
 * hamis, a fordulólánc hozzáadódik.
 */
export function repeatCounts(
  spec: RepeatSpec,
  repeats: number,
  turningChain: number,
  turningChainCounts: boolean,
  _tradition: Tradition = 'cyc',
): RepeatCounts {
  const multiple = spec.repeatWidth * repeats + spec.edgeStitches;
  const workedChains = spec.turningChainIncluded ? multiple - turningChain : multiple;
  return {
    chains: workedChains + turningChain,
    workedChains,
    firstRowPositions: workedChains + (turningChainCounts ? 1 : 0),
  };
}
