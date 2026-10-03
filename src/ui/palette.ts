// KB: interface.md §1, §2, §53, §86

import {
  INVISIBLE_DECREASE,
  MAGIC_RING,
  MIN_SHAPING,
  type Shaping,
  SINGLE_CROCHET,
  STITCH_SECTIONS,
  type StitchSectionId,
  shapingStitch,
} from '../core/stitches.ts';
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
  readonly shaping: Shaping | null;
}

export interface PaletteSection {
  readonly id: StitchSectionId;
  readonly title: string;
  readonly items: readonly PaletteItem[];
}

/** Each tile has its own part; the one count serves both. KB: interface.md §86 */
export interface ShapingChoices {
  readonly parts: Readonly<Record<Shaping, StitchDef>>;
  readonly n: number;
}

export const DEFAULT_SHAPING: ShapingChoices = {
  parts: { decrease: SINGLE_CROCHET, increase: SINGLE_CROCHET },
  n: MIN_SHAPING,
};

/** Decrease first, as the owner listed them. KB: interface.md §86 */
export const SHAPINGS: readonly Shaping[] = ['decrease', 'increase'];

export function buildPalette(terms: Locale = 'hu', shaping: ShapingChoices = DEFAULT_SHAPING): PaletteSection[] {
  const titles = texts().sections.palette.titles;
  let index = 0;
  const item = (def: StitchDef, kind: Shaping | null = null): PaletteItem => ({
    def,
    key: KEYS[index++] ?? null,
    name: capitalize(stitchName(def, terms), terms),
    structure: stitchStructure(def, terms),
    shaping: kind,
  });
  // KB: interface.md §74 — the magic ring is shown among the compound stitches,
  // and the chain space not at all.
  const shown = (section: (typeof STITCH_SECTIONS)[number]): PaletteItem[] => {
    if (section.id === 'compound') return [...section.stitches, MAGIC_RING].map((def) => item(def));
    if (section.id === 'increase-decrease') {
      return [
        ...SHAPINGS.map((kind) => item(shapingStitch(kind, shaping.parts[kind], shaping.n), kind)),
        item(INVISIBLE_DECREASE),
      ];
    }
    return section.stitches.map((def) => item(def));
  };
  return STITCH_SECTIONS.filter((section) => section.offPalette !== true).map((section) => ({
    id: section.id,
    title: titles[section.id],
    items: shown(section),
  }));
}

/** What a part is called in the menu: its whole name. KB: interface.md §86 */
export function partLabel(part: StitchDef, terms: Locale): string {
  return capitalize(part.terms[terms].name, terms);
}

function capitalize(text: string, terms: Locale): string {
  return text.charAt(0).toLocaleUpperCase(terms) + text.slice(1);
}
