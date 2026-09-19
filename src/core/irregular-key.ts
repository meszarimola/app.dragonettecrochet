// The pattern's own stitch key (jelkulcs). KB: 01 §6.1, 01 §8.5

import { nextId } from './irregular-document.ts';
import { type IrregularPattern, isStitch, type StitchKeyEntry } from './irregular-types.ts';
import { STITCHES } from './stitches.ts';
import { stitchLabel, stitchName } from './stitchText.ts';
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

/** True once anything in the key departs from the preset, which the interface calls "Saját". */
export function hasOverrides(pattern: IrregularPattern): boolean {
  return keyEntries(pattern).some(
    (entry) =>
      isCustom(entry) ||
      entry.glyphOverride !== null ||
      entry.abbreviationOverride !== null ||
      entry.labelOverride !== null,
  );
}

export function emptyEntry(id: string, stitch: string | null): StitchKeyEntry {
  return {
    id,
    stitch,
    // An entry names a stitch or names itself; a nameless one cannot be written back.
    customName: stitch === null ? id : null,
    glyphOverride: null,
    abbreviationOverride: null,
    labelOverride: null,
  };
}

export type EntryPatch = Partial<
  Pick<StitchKeyEntry, 'glyphOverride' | 'abbreviationOverride' | 'labelOverride' | 'customName'>
>;

/** An entry that says nothing the library does not is dropped, so the file stays quiet. */
export function updateKeyEntry(pattern: IrregularPattern, id: string, patch: EntryPatch): IrregularPattern {
  const existing = keyEntry(pattern, id);
  const base = existing ?? emptyEntry(id, findStitch(id) === undefined ? null : id);
  const next: StitchKeyEntry = { ...base, ...patch };
  if (
    existing !== undefined &&
    existing.glyphOverride === next.glyphOverride &&
    existing.abbreviationOverride === next.abbreviationOverride &&
    existing.labelOverride === next.labelOverride &&
    existing.customName === next.customName
  ) {
    return pattern;
  }
  const others = keyEntries(pattern).filter((entry) => entry.id !== id);
  const keep =
    isCustom(next) || next.glyphOverride !== null || next.abbreviationOverride !== null || next.labelOverride !== null;
  // Clearing an override that was never there changes nothing, and must not become an undo step.
  if (existing === undefined && !keep) return pattern;
  return { ...pattern, stitchKey: keep ? [...others, next] : others };
}

/**
 * A stitch of the crocheter's own, for what no library entry covers (FR-KEY-4).
 * The key panel offers it from the next stage, once the palette grows a group
 * to place one from; the model and its rules belong with the rest of the key.
 */
export function addCustomEntry(
  pattern: IrregularPattern,
  name: string,
  glyph: string,
): { pattern: IrregularPattern; id: string } {
  const id = nextId(
    'k',
    keyEntries(pattern).map((entry) => entry.id),
  );
  const entry: StitchKeyEntry = {
    id,
    stitch: null,
    customName: name,
    glyphOverride: glyph,
    abbreviationOverride: null,
    labelOverride: null,
  };
  return { pattern: { ...pattern, stitchKey: [...keyEntries(pattern), entry] }, id };
}

/** Removes an entry, and with it every stitch drawn from it. */
export function removeCustomEntry(pattern: IrregularPattern, id: string): IrregularPattern {
  const entry = keyEntry(pattern, id);
  if (entry === undefined || !isCustom(entry)) return pattern;
  return {
    ...pattern,
    stitchKey: keyEntries(pattern).filter((candidate) => candidate.id !== id),
    items: pattern.items.filter((item) => !isStitch(item) || item.keyEntryId !== id),
  };
}

/** "Visszaállítás az előbeállításra": the overrides go, the crocheter's own entries stay. */
export function resetToPreset(pattern: IrregularPattern): IrregularPattern {
  const kept = keyEntries(pattern).filter(isCustom);
  if (kept.length === keyEntries(pattern).length) return pattern;
  return { ...pattern, stitchKey: kept };
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

export function entryLabel(pattern: IrregularPattern, keyEntryId: string, terms: Locale): string {
  const entry = keyEntry(pattern, keyEntryId);
  if (entry !== undefined && entry.labelOverride !== null) return entry.labelOverride;
  if (entry !== undefined && entry.customName !== null) return entry.customName;
  const def = findStitch(keyEntryId);
  return def === undefined ? keyEntryId : stitchLabel(def, terms);
}

export function entryAbbreviation(pattern: IrregularPattern, keyEntryId: string, terms: Locale): string | null {
  const entry = keyEntry(pattern, keyEntryId);
  if (entry !== undefined && entry.abbreviationOverride !== null) return entry.abbreviationOverride;
  const def = findStitch(keyEntryId);
  return def === undefined ? null : def.terms[terms].abbr;
}

export interface KeyUsage {
  readonly keyEntryId: string;
  readonly count: number;
}

/**
 * What the legend lists: every key entry a stitch is drawn from, in the order
 * the palette shows them, with the crocheter's own entries last. Hidden rows
 * count too, so hiding a row never silently shortens the legend.
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
