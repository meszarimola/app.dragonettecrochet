/*
 * Láncalap és „X többszöröse + Y” számítása a konvenciókból.
 *
 * A két vitatott konvenciót a minta kifejezetten tárolja, sosem feltételezzük
 * csendben (README §4.3, §4.4).
 */

import { hasBaseChain } from './tradition.ts';
import type { RepeatSpec, Tradition } from './types.ts';

/**
 * Láncalap N szemhez, T láncszemes fordulólánccal (03 §1.2, 01 §8.3 szabály 15):
 * `N + T`, ha a fordulólánc nem számít szemnek, és `N + T − 1`, ha számít.
 * Az első szem mindkét esetben a horogtól számított `T + 1`. láncszembe megy.
 * Japán hagyományban a számító fordulólánc egy alapláncszemen áll, ezért ott
 * is `N + T`, és az első szem a `T + 2`. láncszembe megy (tradition.ts).
 */
export function foundationChainLength(
  stitches: number,
  turningChain: number,
  turningChainCounts: boolean,
  tradition: Tradition = 'cyc',
): number {
  return stitches + turningChain - (turningChainCounts && !hasBaseChain(turningChainCounts, tradition) ? 1 : 0);
}

export interface RepeatCounts {
  /** A láncalap hossza a fordulólánccal, japán hagyományban az alapláncszemmel is. */
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
  tradition: Tradition = 'cyc',
): RepeatCounts {
  const multiple = spec.repeatWidth * repeats + spec.edgeStitches;
  const workedChains = spec.turningChainIncluded ? multiple - turningChain : multiple;
  return {
    chains: workedChains + turningChain + (hasBaseChain(turningChainCounts, tradition) ? 1 : 0),
    workedChains,
    firstRowPositions: workedChains + (turningChainCounts ? 1 : 0),
  };
}
