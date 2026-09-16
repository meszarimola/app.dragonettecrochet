/*
 * A paletta tartalma a szemkönyvtárból: csoportok, feliratok, gyorsbillentyűk.
 *
 * DOM nélküli, ezért a Node is futtatja (tests/ui-palette.test.mjs), és a
 * magot `.ts` kiterjesztéssel importálja. A gombokat a main.ts rakja ki. Új
 * szem a könyvtárba kerül (src/core/stitches.ts), és innen magától megjelenik.
 *
 * A szemnevek a választott jelöléssel szerepelnek (PQW-868), a csoportcímek
 * a felület nyelvén.
 */

import { STITCH_SECTIONS, type StitchSectionId } from '../core/stitches.ts';
import { stitchName, stitchStructure } from '../core/stitchText.ts';
import type { Locale, StitchDef } from '../core/types.ts';
import { texts } from './i18n.ts';

/**
 * Gyorsbillentyű a paletta első kilenc szemének (PQW-911): a szám `Alt`-tal
 * együtt választ, mert egyetlen karakter nem lehet parancs. A többi szem
 * kattintással vagy Tabbal érhető el.
 */
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export interface PaletteItem {
  readonly def: StitchDef;
  /** A szám az `Alt`-kombinációhoz, pl. `1` az `Alt`+`1`-hez; kilenc fölött `null`. */
  readonly key: string | null;
  /** A név a jelöléssel, nagy kezdőbetűvel, rövidítéssel, pl. „Rövidpálca (rp)”, „Single crochet (sc)”. */
  readonly name: string;
  /** Összetett szemnél a szerkezet a jelöléssel, pl. „2 rp egy szembe”. */
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
      structure: stitchStructure(def, terms),
    })),
  }));
}

function capitalize(text: string, terms: Locale): string {
  return text.charAt(0).toLocaleUpperCase(terms) + text.slice(1);
}
