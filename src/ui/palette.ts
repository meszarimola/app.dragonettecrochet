/*
 * A paletta tartalma az öltéskönyvtárból: csoportok, feliratok, gyorsbillentyűk.
 *
 * DOM nélküli, ezért a Node is futtatja (tests/ui-palette.test.mjs), és a
 * magot `.ts` kiterjesztéssel importálja. A gombokat a main.ts rakja ki. Új
 * öltés a könyvtárba kerül (src/core/stitches.ts), és innen magától megjelenik.
 */

import { STITCH_SECTIONS, type StitchSectionId } from '../core/stitches.ts';
import { stitchLabel, stitchName, stitchStructure } from '../core/stitchText.ts';
import type { StitchDef } from '../core/types.ts';

const SECTION_TITLES: Readonly<Record<StitchSectionId, string>> = {
  basic: 'Alapöltések',
  'increase-decrease': 'Szaporítás és fogyasztás',
  compound: 'Összetett öltések',
  structure: 'Láncív és varázskör',
};

/** Gyorsbillentyű a paletta első kilenc öltésének; a többi kattintással vagy Tabbal érhető el. */
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export interface PaletteItem {
  readonly def: StitchDef;
  readonly key: string | null;
  /** Magyar név nagy kezdőbetűvel, rövidítéssel, pl. „Rövidpálca (rp)”. */
  readonly name: string;
  /** Összetett öltésnél a magyar szerkezet, pl. „2 rp egy öltésbe”. */
  readonly structure: string | null;
  /** Amerikai jelöléssel. A választható jelölés a PQW-868 feladata. */
  readonly english: string;
}

export interface PaletteSection {
  readonly id: StitchSectionId;
  readonly title: string;
  readonly items: readonly PaletteItem[];
}

export function buildPalette(): PaletteSection[] {
  let index = 0;
  return STITCH_SECTIONS.map((section) => ({
    id: section.id,
    title: SECTION_TITLES[section.id],
    items: section.stitches.map((def) => ({
      def,
      key: KEYS[index++] ?? null,
      name: capitalize(stitchName(def, 'hu')),
      structure: stitchStructure(def, 'hu'),
      english: stitchLabel(def, 'en-US'),
    })),
  }));
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('hu') + text.slice(1);
}
