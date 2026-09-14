/*
 * Az öltéskönyvtár, ahogy a gráf és az ellenőrző látja: azonosító → definíció.
 *
 * A gráf nem tud a konkrét öltéslistáról; a PQW-867 könyvtára ugyanígy,
 * `StitchDef` tömbként adható át. A tesztek saját öltés-mintákkal dolgoznak.
 */

import type { StitchDef, StitchDefId } from './types.ts';

export type StitchLibrary = ReadonlyMap<StitchDefId, StitchDef>;

export function createStitchLibrary(defs: readonly StitchDef[]): StitchLibrary {
  const library = new Map<StitchDefId, StitchDef>();
  for (const def of defs) {
    if (library.has(def.id)) throw new Error(`Kétszer szereplő öltés-azonosító: ${def.id}`);
    library.set(def.id, def);
  }
  return library;
}
