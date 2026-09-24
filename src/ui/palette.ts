// KB: interface.md §1, §2, §53

import { MAGIC_RING, STITCH_SECTIONS, type StitchSectionId } from '../core/stitches.ts';
import { stitchName, stitchStructure } from '../core/stitchText.ts';
import type { Locale, StitchDef } from '../core/types.ts';
import { texts } from './i18n.ts';

// KB: interface.md §11
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export interface PaletteItem {
  readonly def: StitchDef;
  readonly key: string | null;
  readonly name: string;
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
  // KB: interface.md §74 — the magic ring is shown among the compound stitches,
  // and the chain space not at all: the chain arc tool draws it.
  const shown = (section: (typeof STITCH_SECTIONS)[number]): readonly StitchDef[] =>
    section.id === 'compound' ? [...section.stitches, MAGIC_RING] : section.stitches;
  return STITCH_SECTIONS.filter((section) => section.offPalette !== true).map((section) => ({
    id: section.id,
    title: titles[section.id],
    items: shown(section).map((def) => ({
      def,
      key: KEYS[index++] ?? null,
      name: capitalize(stitchName(def, terms), terms),
      structure: stitchStructure(def, terms),
    })),
  }));
}

function capitalize(text: string, terms: Locale): string {
  return text.charAt(0).toLocaleUpperCase(terms) + text.slice(1);
}
