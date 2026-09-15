/*
 * A minta számolási hagyománya (PQW-876): a fordulólánc és a láncalap.
 *
 * - CYC: a fordulólánc egyráhajtásos pálcától számít szemnek (szókészlet K1);
 *   számító fordulóláncnál N szemhez `N + T − 1` láncszem kell, és az 1. sor
 *   első szeme a horogtól számított `T + 1`. láncszembe megy (01 §8.3 szabály 15).
 * - Japán: a fordulólánc (立ち上がり) a félpálcától felfelé számít szemnek, a
 *   rövidpálcáé nem. A számító fordulólánc egy alapláncszemen „áll”, ezért az
 *   1. sor első szeme a `T + 2`. láncszembe megy (félpálca a 4., pálca az 5.,
 *   kétráhajtásos a 6., háromráhajtásos a 7.), és N szemhez `N + T` láncszem
 *   kell (01 §2.2, §3.3; japán források a tudásbázisban).
 *
 * A gráf, az ellenőrző, a szerkesztő, az írott minta és a visszaolvasó is
 * innen veszi a szabályt, így nem térhetnek el egymástól.
 */

import type { PatternConventions, RowConventions, StitchDef, Tradition } from './types.ts';

export const TRADITIONS: readonly Tradition[] = ['cyc', 'japanese'];

/** A minta hagyománya; a PQW-876 előtti mentésben nincs megadva, az CYC. */
export function traditionOf(conventions: PatternConventions): Tradition {
  return conventions.tradition ?? 'cyc';
}

/** A sort kezdő szem alapértelmezése: számít-e a fordulólánca szemnek. */
export function stitchTurningChainCounts(def: StitchDef, tradition: Tradition): boolean {
  return tradition === 'japanese' ? def.turningChain >= 2 : def.turningChainCounts;
}

/** A beállításból (`stitch-default` vagy kifejezett érték) és a sort kezdő szemből. */
export function turningChainCountsFor(
  setting: RowConventions['turningChainCounts'],
  def: StitchDef,
  tradition: Tradition,
): boolean {
  return setting === 'stitch-default' ? stitchTurningChainCounts(def, tradition) : setting;
}

/** Áll-e a láncalapon a fordulólánc egy alapláncszemen: japán hagyományban, számító fordulóláncnál. */
export function hasBaseChain(turningChainCounts: boolean, tradition: Tradition): boolean {
  return tradition === 'japanese' && turningChainCounts;
}

/** Az 1. sor első szeme a horogtól számított hányadik láncszembe megy. */
export function firstChainFromHook(turningChain: number, turningChainCounts: boolean, tradition: Tradition): number {
  return turningChain + (hasBaseChain(turningChainCounts, tradition) ? 2 : 1);
}

/** A konvenciók az új hagyománnyal. A `cyc` nem íródik ki, így a régi mentések változatlanok maradnak. */
export function withTradition(conventions: PatternConventions, tradition: Tradition): PatternConventions {
  const rest = Object.fromEntries(Object.entries(conventions).filter(([key]) => key !== 'tradition')) as unknown as PatternConventions;
  return tradition === 'cyc' ? rest : { ...rest, tradition };
}
