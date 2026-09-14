/*
 * A paletta tartalma az öltéskönyvtárból: csoportok, feliratok, gyorsbillentyűk.
 *
 * DOM nélküli, ezért a Node is futtatja (tests/ui-palette.test.mjs), és a
 * magot `.ts` kiterjesztéssel importálja. A gombokat a main.ts rakja ki. Új
 * öltés a könyvtárba kerül (src/core/stitches.ts), és innen magától megjelenik.
 *
 * Az öltésnevek a választott jelöléssel szerepelnek (PQW-868), a csoportcímek
 * a felület nyelvén.
 */

import { STITCH_SECTIONS, type StitchSectionId } from '../core/stitches.ts';
import { stitchName, stitchStructure } from '../core/stitchText.ts';
import type { Locale, StitchDef } from '../core/types.ts';

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
  /** A név a jelöléssel, nagy kezdőbetűvel, rövidítéssel, pl. „Rövidpálca (rp)”, „Single crochet (sc)”. */
  readonly name: string;
  /** Összetett öltésnél a szerkezet a jelöléssel, pl. „2 rp egy öltésbe”. */
  readonly structure: string | null;
}

export interface PaletteSection {
  readonly id: StitchSectionId;
  readonly title: string;
  readonly items: readonly PaletteItem[];
}

export function buildPalette(terms: Locale = 'hu'): PaletteSection[] {
  let index = 0;
  return STITCH_SECTIONS.map((section) => ({
    id: section.id,
    title: SECTION_TITLES[section.id],
    items: section.stitches.map((def) => ({
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
