/*
 * A „Beszúrás” választó tartalma a Szemek szakaszban (PQW-869), DOM nélkül:
 * a kiválasztott szem megengedett módjai, a feliratok, az érvényes mód és az,
 * hogyan kerül a mód az írott mintába.
 *
 * A mód a horgoló felől értendő; a tárolásban visszai soron megfordul
 * (src/core/insertion.ts). A Node is futtatja (tests/ui-insertion-view.test.mjs),
 * ezért a magot `.ts` kiterjesztéssel importálja.
 */

import { effectiveInsertion, stitchInsertions } from '../core/insertion.ts';
import { VOCABULARIES, refOf } from '../core/pattern-text.ts';
import type { Locale, StitchDef, StitchInsertion } from '../core/types.ts';
import { texts, uiLanguage } from './i18n.ts';

export interface InsertionOption {
  readonly mode: StitchInsertion;
  /** A mód neve nagy kezdőbetűvel, pl. „Hátsó szál”. */
  readonly label: string;
}

export interface InsertionChoice {
  readonly options: readonly InsertionOption[];
  /** Az érvényes mód: a választott, ha a szem megengedi, különben a szem alapértelmezése. */
  readonly selected: StitchInsertion;
  /**
   * Alapszemnél és kúszószemnél így kerül a szem az írott mintába a választott
   * jelöléssel, pl. „rp (hsz)”, „sc BLO”, „Eerp”; összetett szemnél `null`.
   */
  readonly written: string | null;
}

/**
 * A választó tartalma, vagy `null`, ha nincs mit választani: nincs szem, a
 * szem nem szúrható szembe (láncszem, láncív, varázskör, pikó), vagy csak egy
 * módja van (pl. láthatatlan fogyasztás, rákhurok).
 */
export function insertionChoice(def: StitchDef | undefined, preferred: StitchInsertion, terms: Locale): InsertionChoice | null {
  if (!def) return null;
  const allowed = stitchInsertions(def);
  const selected = effectiveInsertion(def, preferred);
  if (allowed.length < 2 || !selected) return null;
  const plain = def.kind === 'basic' || def.kind === 'slip';
  const names = texts().sections.insertion.names;
  return {
    options: allowed.map((mode) => ({ mode, label: capitalize(names[mode]) })),
    selected,
    written: plain ? VOCABULARIES[terms].mode(selected, refOf(def, terms)) : null,
  };
}

/** Az állapotsor üzenetének kiegészítése lerakáskor: mindkét szálnál üres, máskor pl. „, hátsó szál”. */
export function insertionSuffix(mode: StitchInsertion | undefined): string {
  return mode && mode !== 'both-loops' ? `, ${texts().sections.insertion.names[mode]}` : '';
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase(uiLanguage()) + text.slice(1);
}
