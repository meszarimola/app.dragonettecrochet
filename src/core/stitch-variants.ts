// KB: core-domain §4

import { createStitchLibrary, type StitchLibrary } from './stitch-library.ts';
import { STITCHES, cluster, decrease, increase, shell } from './stitches.ts';
import type { Pattern, StitchDef, StitchDefId } from './types.ts';

const BY_ID = new Map(STITCHES.map((def) => [def.id, def]));

const MAX_PARTS = 12;

function partOf(id: string): StitchDef | undefined {
  const def = BY_ID.get(id);
  return def?.kind === 'basic' && def.workableTop ? def : undefined;
}

function count(text: string): number | undefined {
  const n = Number(text);
  return Number.isInteger(n) && n >= 2 && n <= MAX_PARTS ? n : undefined;
}

export function resolveStitch(id: StitchDefId): StitchDef | undefined {
  const known = BY_ID.get(id);
  if (known) return known;

  let match = /^(inc|shell)-(\d+)([a-z]+)$/.exec(id);
  if (match) {
    const part = partOf(match[3]!);
    const n = count(match[2]!);
    if (!part || n === undefined) return undefined;
    return match[1] === 'inc' ? increase(part, n) : shell(part, n);
  }

  match = /^([a-z]+)(\d+)tog$/.exec(id);
  if (match) {
    const part = partOf(match[1]!);
    const n = count(match[2]!);
    return part && n !== undefined ? decrease(part, n) : undefined;
  }

  match = /^cl-(\d+)([a-z]+)(-spread)?$/.exec(id);
  if (match) {
    const part = partOf(match[2]!);
    const n = count(match[1]!);
    return part && n !== undefined ? cluster(part, n, match[3] ? 'spread' : 'same') : undefined;
  }

  return undefined;
}

export function libraryFor(pattern: Pattern): StitchLibrary {
  const extra = new Map<StitchDefId, StitchDef>();
  for (const piece of pattern.pieces) {
    const ids = [...piece.stitches.map((node) => node.def), ...piece.groups.map((group) => group.def)];
    for (const id of ids) {
      if (BY_ID.has(id) || extra.has(id)) continue;
      const def = resolveStitch(id);
      if (def) extra.set(id, def);
    }
  }
  return createStitchLibrary([...STITCHES, ...extra.values()]);
}
