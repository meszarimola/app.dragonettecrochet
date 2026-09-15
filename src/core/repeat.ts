/*
 * Láncalap és „X többszöröse + Y” számítása a konvenciókból.
 *
 * A két vitatott konvenciót a minta kifejezetten tárolja, sosem feltételezzük
 * csendben (README §4.3, §4.4).
 */

import type { RepeatSpec } from './types.ts';

/**
 * Láncalap N szemhez, T láncszemes fordulólánccal (03 §1.2, 01 §8.3 szabály 15):
 * `N + T`, ha a fordulólánc nem számít szemnek, és `N + T − 1`, ha számít.
 * Az első szem mindkét esetben a horogtól számított `T + 1`. láncszembe megy.
 */
export function foundationChainLength(stitches: number, turningChain: number, turningChainCounts: boolean): number {
  return stitches + turningChain - (turningChainCounts ? 1 : 0);
}

export interface RepeatCounts {
  /** A láncalap hossza a fordulólánccal. */
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
): RepeatCounts {
  const multiple = spec.repeatWidth * repeats + spec.edgeStitches;
  const workedChains = spec.turningChainIncluded ? multiple - turningChain : multiple;
  return {
    chains: workedChains + turningChain,
    workedChains,
    firstRowPositions: workedChains + (turningChainCounts ? 1 : 0),
  };
}
