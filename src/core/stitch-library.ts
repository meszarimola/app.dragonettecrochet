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
