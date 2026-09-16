/*
 * A minta címe generáláskor (PQW-896): a „Minta létrehozása” minden
 * generátorban a generált forma nevét adja címnek, hacsak a felhasználó nem
 * adott saját címet.
 *
 * Hogy a cím generált-e, azt a minta tárolja (`Pattern.titleGenerated`): a
 * generátor igazra, a „Minta neve” mező szerkesztése hamisra állítja. A
 * PQW-896 előtti mentésben nincs jelölve; ott generáltnak számít az üres és az
 * alapértelmezett cím, a darab neve (a generátorok a darabot a forma nevével
 * nevezik el) és a generátor ismert neve.
 */

import type { Pattern } from './types.ts';

/** Az új, üres minta címe (editor.ts `emptyPattern`). */
export const DEFAULT_TITLE = 'Új minta';

/** A felhasználó adott-e saját címet; a `generatedNames` a jelölés nélküli, régi mentéshez kell. */
export function hasOwnTitle(pattern: Pattern, generatedNames: Iterable<string> = []): boolean {
  const title = pattern.title.trim();
  if (title === '') return false;
  if (pattern.titleGenerated !== undefined) return !pattern.titleGenerated;
  if (title === DEFAULT_TITLE || pattern.pieces.some((piece) => piece.name === pattern.title)) return false;
  return ![...generatedNames].includes(pattern.title);
}

/**
 * A generált minta a címmel: a saját cím marad, különben a forma neve lesz a
 * cím, generáltként jelölve. A `source` a generálás előtti minta.
 */
export function withGeneratedTitle(result: Pattern, source: Pattern, name: string, generatedNames: Iterable<string> = []): Pattern {
  const { titleGenerated: _, ...rest } = result;
  if (!hasOwnTitle(source, generatedNames)) return { ...rest, title: name, titleGenerated: true };
  return { ...rest, title: source.title, ...(source.titleGenerated === false ? { titleGenerated: false } : {}) };
}
