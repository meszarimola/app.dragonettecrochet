// Turning a placed free-form symbol into drawable shapes. KB: interface.md §21, §22

import type { IrregularItem } from '../core/irregular-types.ts';
import { stitchById } from '../core/stitches.ts';
import type { StitchDef, StitchInsertion } from '../core/types.ts';
import { type Point, type Shape, type SymbolOptions, shapesBounds, stretchShapes, symbolShapes } from './symbols.ts';

export interface NaturalGlyph {
  readonly shapes: readonly Shape[];
  readonly center: Point;
  readonly width: number;
  readonly height: number;
}

const cache = new Map<string, NaturalGlyph | null>();

function cacheKey(keyEntryId: string, insertion: StitchInsertion, options: SymbolOptions): string {
  return `${keyEntryId}|${insertion}|${options.style ?? 'cyc'}|${options.singleCrochet}`;
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
): NaturalGlyph | null {
  const key = cacheKey(keyEntryId, insertion, options);
  const known = cache.get(key);
  if (known !== undefined) return known;
  const glyph = buildGlyph(keyEntryId, insertion, options);
  cache.set(key, glyph);
  return glyph;
}

function buildGlyph(keyEntryId: string, insertion: StitchInsertion, options: SymbolOptions): NaturalGlyph | null {
  const def = stitchById(keyEntryId);
  if (def === undefined) return null;
  const shapes = symbolShapes(def, optionsFor(def, insertion, options));
  const bounds = shapesBounds(shapes);
  if (bounds === null) return null;
  return {
    shapes,
    center: { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 },
    width: Math.max(1, bounds.maxX - bounds.minX),
    height: Math.max(1, bounds.maxY - bounds.minY),
  };
}

/** The size a freshly placed symbol takes: the glyph's own size at 100% zoom. */
export function naturalSize(
  keyEntryId: string,
  insertion: StitchInsertion,
  options: SymbolOptions,
): { width: number; height: number } {
  const glyph = naturalGlyph(keyEntryId, insertion, options);
  return glyph === null ? { width: 20, height: 20 } : { width: glyph.width, height: glyph.height };
}

export function itemShapes(item: IrregularItem, options: SymbolOptions): readonly Shape[] {
  const glyph = naturalGlyph(item.keyEntryId, item.insertion, options);
  if (glyph === null) return [];
  const scale = {
    x: (item.flipX ? -1 : 1) * (item.width / glyph.width),
    y: (item.flipY ? -1 : 1) * (item.height / glyph.height),
  };
  return stretchShapes(glyph.shapes, glyph.center, scale, (item.rotation * Math.PI) / 180, { x: item.x, y: item.y });
}

export function clearGlyphCache(): void {
  cache.clear();
}
