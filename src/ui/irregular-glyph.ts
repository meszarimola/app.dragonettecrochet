// Turning a placed free-form symbol into drawable shapes. KB: interface.md §21, §22, §39

import { findStitch } from '../core/irregular-key.ts';
import type { IrregularItem } from '../core/irregular-types.ts';
import type { StitchDef, StitchInsertion } from '../core/types.ts';
import {
  ALTERNATIVE_GLYPHS,
  type AlternativeGlyphId,
  alternativeGlyphShapes,
  type Point,
  type Shape,
  type SymbolOptions,
  shapesBounds,
  stretchShapes,
  symbolShapes,
} from './symbols.ts';

export interface NaturalGlyph {
  readonly shapes: readonly Shape[];
  readonly center: Point;
  readonly width: number;
  readonly height: number;
}

const cache = new Map<string, NaturalGlyph | null>();

export function isAlternativeGlyph(id: string): id is AlternativeGlyphId {
  return (ALTERNATIVE_GLYPHS as readonly string[]).includes(id);
}

function cacheKey(
  keyEntryId: string,
  insertion: StitchInsertion,
  options: SymbolOptions,
  glyph: string | null,
): string {
  return `${keyEntryId}|${insertion}|${options.style ?? 'cyc'}|${options.singleCrochet}|${glyph ?? ''}`;
}

function optionsFor(def: StitchDef, insertion: StitchInsertion, options: SymbolOptions): SymbolOptions {
  // symbolShapes refuses a mode the stitch does not offer, so ask for it only when it does.
  return def.insertionModes.includes(insertion) ? { ...options, insertion } : options;
}

/** The glyph in its own units, upright, as the palette draws it. */
export function naturalGlyph(
  keyEntryId: string,
  insertion: StitchInsertion,
  options: SymbolOptions,
  glyphOverride: string | null = null,
): NaturalGlyph | null {
  const key = cacheKey(keyEntryId, insertion, options, glyphOverride);
  const known = cache.get(key);
  if (known !== undefined) return known;
  const glyph = buildGlyph(keyEntryId, insertion, options, glyphOverride);
  cache.set(key, glyph);
  return glyph;
}

function measured(shapes: Shape[]): NaturalGlyph | null {
  const bounds = shapesBounds(shapes);
  if (bounds === null) return null;
  return {
    shapes,
    center: { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 },
    width: Math.max(1, bounds.maxX - bounds.minX),
    height: Math.max(1, bounds.maxY - bounds.minY),
  };
}

function buildGlyph(
  keyEntryId: string,
  insertion: StitchInsertion,
  options: SymbolOptions,
  glyphOverride: string | null,
): NaturalGlyph | null {
  // The key wins: a pattern may draw any stitch with any symbol it chooses.
  if (glyphOverride !== null && isAlternativeGlyph(glyphOverride)) {
    return measured(alternativeGlyphShapes(glyphOverride));
  }
  const def = findStitch(keyEntryId);
  if (def === undefined) return null;
  return measured(symbolShapes(def, optionsFor(def, insertion, options)));
}

/** The size a freshly placed symbol takes: the glyph's own size at 100% zoom. */
export function naturalSize(
  keyEntryId: string,
  insertion: StitchInsertion,
  options: SymbolOptions,
  glyphOverride: string | null = null,
): { width: number; height: number } {
  const glyph = naturalGlyph(keyEntryId, insertion, options, glyphOverride);
  return glyph === null ? { width: 20, height: 20 } : { width: glyph.width, height: glyph.height };
}

export function itemShapes(
  item: IrregularItem,
  options: SymbolOptions,
  glyphOverride: string | null = null,
): readonly Shape[] {
  const glyph = naturalGlyph(item.keyEntryId, item.insertion, options, glyphOverride);
  if (glyph === null) return [];
  const scale = {
    x: (item.flipX ? -1 : 1) * (item.width / glyph.width),
    y: (item.flipY ? -1 : 1) * (item.height / glyph.height),
  };
  return stretchShapes(glyph.shapes, glyph.center, scale, (item.rotation * Math.PI) / 180, { x: item.x, y: item.y });
}

/**
 * Two stitches drawn with one symbol make a chart ambiguous, and the check has to
 * compare what is *drawn*, not what the entries are called. The library's own
 * symbols never collide with each other, so only the alternatives need naming: a
 * chain's oval and a slip stitch's dot have a symbol here that an override can
 * also name.
 */
const PRESET_GLYPH: Readonly<Record<string, AlternativeGlyphId>> = {
  ch: 'oval',
  'sl-st': 'dot',
};

export function drawnGlyph(keyEntryId: string, glyphOverride: string | null): string {
  if (glyphOverride !== null) return glyphOverride;
  return PRESET_GLYPH[keyEntryId] ?? `preset:${keyEntryId}`;
}

export function clearGlyphCache(): void {
  cache.clear();
}
