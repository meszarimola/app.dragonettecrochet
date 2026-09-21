// The pattern's own stitch key (jelkulcs). KB: 01 §6.1, 01 §8.5

import { type IrregularPattern, isStitch, type StitchKeyEntry } from './irregular-types.ts';
import { STITCHES } from './stitches.ts';
import { stitchName } from './stitchText.ts';
import type { Locale, StitchDef } from './types.ts';

const BY_ID = new Map(STITCHES.map((stitch) => [stitch.id, stitch]));

/** `stitchById` throws; a key entry may name a stitch this build does not have. */
export function findStitch(id: string): StitchDef | undefined {
  return BY_ID.get(id);
}

export function keyEntries(pattern: IrregularPattern): readonly StitchKeyEntry[] {
  return pattern.stitchKey ?? [];
}

export function keyEntry(pattern: IrregularPattern, id: string): StitchKeyEntry | undefined {
  return keyEntries(pattern).find((entry) => entry.id === id);
}

export function isCustom(entry: StitchKeyEntry): boolean {
  return entry.stitch === null;
}

export function entryGlyph(pattern: IrregularPattern, keyEntryId: string): string | null {
  return keyEntry(pattern, keyEntryId)?.glyphOverride ?? null;
}

export function entryName(pattern: IrregularPattern, keyEntryId: string, terms: Locale): string {
  const entry = keyEntry(pattern, keyEntryId);
  if (entry !== undefined && entry.customName !== null) return entry.customName;
  const def = findStitch(keyEntryId);
  return def === undefined ? keyEntryId : stitchName(def, terms);
}

export interface KeyUsage {
  readonly keyEntryId: string;
  readonly count: number;
}

/**
 * Every key entry a stitch is drawn from, in the order the palette shows them,
 * with the crocheter's own entries last. Hidden rows count too.
 */
export function keyUsage(pattern: IrregularPattern): KeyUsage[] {
  const counts = new Map<string, number>();
  for (const item of pattern.items) {
    if (isStitch(item)) counts.set(item.keyEntryId, (counts.get(item.keyEntryId) ?? 0) + 1);
  }
  const order = new Map(STITCHES.map((stitch, index) => [stitch.id, index]));
  return [...counts.entries()]
    .map(([keyEntryId, count]) => ({ keyEntryId, count }))
    .sort((a, b) => (order.get(a.keyEntryId) ?? STITCHES.length) - (order.get(b.keyEntryId) ?? STITCHES.length));
}

/**
 * Two entries drawn with one glyph make the chart ambiguous. The caller resolves
 * each entry to its glyph, because what a glyph *is* belongs to the view.
 */
export function sharedGlyphs(
  pattern: IrregularPattern,
  glyphOf: (keyEntryId: string) => string,
): { readonly glyph: string; readonly keyEntryIds: readonly string[] }[] {
  const byGlyph = new Map<string, string[]>();
  for (const { keyEntryId } of keyUsage(pattern)) {
    const glyph = glyphOf(keyEntryId);
    byGlyph.set(glyph, [...(byGlyph.get(glyph) ?? []), keyEntryId]);
  }
  return [...byGlyph.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([glyph, keyEntryIds]) => ({ glyph, keyEntryIds }));
}
