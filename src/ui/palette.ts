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
  /** Set on the two tiles whose stitch is chosen from a menu. */
  readonly shaping: Shaping | null;
}

export interface PaletteSection {
  readonly id: StitchSectionId;
  readonly title: string;
  readonly items: readonly PaletteItem[];
}

export interface ShapingChoice {
  readonly part: StitchDef;
  readonly n: number;
}

export type ShapingChoices = Readonly<Record<Shaping, ShapingChoice>>;

export const DEFAULT_SHAPING: ShapingChoices = {
  decrease: { part: SINGLE_CROCHET, n: MIN_SHAPING },
  increase: { part: SINGLE_CROCHET, n: MIN_SHAPING },
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
        ...SHAPINGS.map((kind) => item(shapingStitch(kind, shaping[kind].part, shaping[kind].n), kind)),
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

/** What a part is called in the menu: its abbreviation, or its name where it has none. */
export function partLabel(part: StitchDef, terms: Locale): string {
  const { name, abbr } = part.terms[terms];
  // KB: interface.md §53 — a shortened name, never an invented abbreviation.
  return abbr ?? name.split(' ')[0] ?? name;
}

function capitalize(text: string, terms: Locale): string {
  return text.charAt(0).toLocaleUpperCase(terms) + text.slice(1);
}
