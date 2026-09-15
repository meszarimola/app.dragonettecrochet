/*
 * A szemkönyvtár, ahogy a gráf és az ellenőrző látja: azonosító → definíció.
 *
 * A gráf nem tud a konkrét szemlistáról: a könyvtár `StitchDef` tömbből épül,
 * rendesen a src/core/stitches.ts `STITCHES` listájából. A tesztek is ezt a
 * valódi könyvtárat használják, kiegészítve a palettán nem szereplő
 * változatokkal (tests/fixtures/library.ts).
 */

import type { StitchDef, StitchDefId } from './types.ts';

export type StitchLibrary = ReadonlyMap<StitchDefId, StitchDef>;

export function createStitchLibrary(defs: readonly StitchDef[]): StitchLibrary {
  const library = new Map<StitchDefId, StitchDef>();
  for (const def of defs) {
    if (library.has(def.id)) throw new Error(`Kétszer szereplő szemazonosító: ${def.id}`);
    library.set(def.id, def);
  }
  return library;
}
