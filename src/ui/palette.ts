// KB: interface.md §1, §2, §53

import { STITCH_SECTIONS, type StitchSectionId } from '../core/stitches.ts';
import { stitchName, stitchStructure } from '../core/stitchText.ts';
import type { Locale, StitchDef } from '../core/types.ts';
import { PALETTE_SHORT_LABELS } from './i18n/palette.ts';
import { texts } from './i18n.ts';

// KB: interface.md §11
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export interface PaletteItem {
  readonly def: StitchDef;
  readonly key: string | null;
  readonly name: string;
  /** What the dense grid prints: the abbreviation of the notation, or a shortened name. KB: interface.md §53 */
  readonly short: string;
  readonly structure: string | null;
}

export interface PaletteSection {
  readonly id: StitchSectionId;
  readonly title: string;
  readonly items: readonly PaletteItem[];
}

export function buildPalette(terms: Locale = 'hu'): PaletteSection[] {
  const titles = texts().sections.palette.titles;
  let index = 0;
  return STITCH_SECTIONS.map((section) => ({
    id: section.id,
    title: titles[section.id],
    items: section.stitches.map((def) => ({
      def,
      key: KEYS[index++] ?? null,
      name: capitalize(stitchName(def, terms), terms),
      short: shortLabel(def, terms),
      structure: stitchStructure(def, terms),
    })),
  }));
}

function shortLabel(def: StitchDef, terms: Locale): string {
  return def.terms[terms].abbr ?? PALETTE_SHORT_LABELS[terms][def.id] ?? def.terms[terms].name;
}

function capitalize(text: string, terms: Locale): string {
  return text.charAt(0).toLocaleUpperCase(terms) + text.slice(1);
}
