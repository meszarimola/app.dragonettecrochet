/*
 * A fordulólánc és a láncalap számolása (PQW-876, PQW-891).
 *
 * - Sorban a fordulólánc a sor első szeme helyett áll, és egy alapláncszemen
 *   „áll” (tulajdonosi javítás, PQW-891): rövidpálcánál 1, félpálcánál 2,
 *   egyráhajtásos pálcánál 3 láncszem. Az 1. sor első szeme a horogtól
 *   számított `T + 2`. láncszembe megy (rövidpálca a 3., félpálca a 4., pálca
 *   az 5.), N szemhez `N + T` láncszem kell, és a következő sorok utolsó szeme
 *   az előző fordulólánc tetejébe megy.
 * - Körben a kezdőlánc a szemkönyvtár alapértelmezését követi: az
 *   egyráhajtásos pálcától számít szemnek (szókészlet K1), a körgenerátorok
 *   ezzel dolgoznak.
 * - Japán hagyomány: a fordulólánc (立ち上がり) a félpálcától felfelé számít
 *   szemnek, a rövidpálcáé nem; a számító fordulólánc ugyanúgy egy
 *   alapláncszemen áll (01 §2.2, §3.3; japán források a tudásbázisban).
 *
 * A gráf, az ellenőrző, a szerkesztő, a generátorok, az írott minta és a
 * visszaolvasó is innen veszi a szabályt, így nem térhetnek el egymástól.
 */

import type { Layer, PatternConventions, RowConventions, StitchDef, Tradition } from './types.ts';

export const TRADITIONS: readonly Tradition[] = ['cyc', 'japanese'];

/** A minta hagyománya; a PQW-876 előtti mentésben nincs megadva, az CYC. */
export function traditionOf(conventions: PatternConventions): Tradition {
  return conventions.tradition ?? 'cyc';
}

/** A sort vagy kört kezdő szem alapértelmezése: számít-e a fordulólánca (körben a kezdőlánca) szemnek. */
export function stitchTurningChainCounts(def: StitchDef, tradition: Tradition, shape: Layer['shape']): boolean {
  if (tradition === 'japanese') return def.turningChain >= 2;
  return shape === 'row' ? def.turningChain >= 1 : def.turningChainCounts;
}

/** A beállításból (`stitch-default` vagy kifejezett érték) és a sort vagy kört kezdő szemből. */
export function turningChainCountsFor(
  setting: RowConventions['turningChainCounts'],
  def: StitchDef,
  tradition: Tradition,
  shape: Layer['shape'],
): boolean {
  return setting === 'stitch-default' ? stitchTurningChainCounts(def, tradition, shape) : setting;
}

/**
 * Áll-e a láncalapon a fordulólánc egy alapláncszemen: számító fordulóláncnál
 * mindig (PQW-891). A hagyomány már nem dönt róla, csak arról, hogy a
 * fordulólánc számít-e; a paraméter a meglévő hívások miatt marad.
 */
export function hasBaseChain(turningChainCounts: boolean, _tradition: Tradition): boolean {
  return turningChainCounts;
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
