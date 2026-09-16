/*
 * A jelölés és a jelstílus beállítása (PQW-868).
 *
 * - A felület nyelve és a minta jelölése két független beállítás. A jelölés
 *   alapértelmezése a felület nyelvéből jön: magyar felületen magyar, angol
 *   felületen amerikai. A mentett választás ettől függetlenül érvényes.
 * - A választás csak megjelenítés: a gráf nem változik, a minta mentéskor és
 *   exportkor rögzíti, milyen jelöléssel készült (`Pattern.notation`).
 * - A japán (JIS) jelstílusban a rövidpálca jele mindig ×, ezért ott a + és ×
 *   választása nem érvényes (symbols.ts).
 * - Az előbeállítás (PQW-876) a mintához tartozik: a japán a JIS jeleket, a ×
 *   rövidpálcát és a japán számolást (src/core/tradition.ts) együtt kapcsolja be.
 *
 * DOM nélküli, ezért a Node is futtatja (tests/ui-notation.test.mjs), és a
 * magot `.ts` kiterjesztéssel importálja.
 */

import { VOCABULARIES } from '../core/pattern-text.ts';
import type { ChartStyle, Locale, Pattern, PatternNotation, Tradition } from '../core/types.ts';
import { texts } from './i18n.ts';
import type { SymbolOptions } from './symbols.ts';

/** A felület nyelve; az angol felület fordítása a PQW-853. */
export type UiLanguage = 'hu' | 'en';

export const TERMS: readonly Locale[] = ['hu', 'en-US', 'en-GB'];
export const CHART_STYLES: readonly ChartStyle[] = ['cyc', 'jis'];
const SINGLE_CROCHET: readonly PatternNotation['singleCrochet'][] = ['plus', 'cross'];

/** A `<html lang>` értékéből: `en`, `en-GB` → angol, minden más magyar. */
export function uiLanguageOf(lang: string): UiLanguage {
  return /^en\b/i.test(lang) ? 'en' : 'hu';
}

export function defaultNotation(ui: UiLanguage): PatternNotation {
  return { terms: ui === 'en' ? 'en-US' : 'hu', chartStyle: 'cyc', singleCrochet: 'plus' };
}

/** A böngészőben tárolt beállítás; ami hiányzik vagy érvénytelen, az az alapértelmezés. */
export function readNotation(stored: string | null, ui: UiLanguage): PatternNotation {
  const defaults = defaultNotation(ui);
  let raw: unknown = null;
  try {
    raw = stored === null ? null : JSON.parse(stored);
  } catch {
    return defaults;
  }
  if (typeof raw !== 'object' || raw === null) return defaults;
  const value = raw as Record<string, unknown>;
  return {
    terms: pick(value['terms'], TERMS, defaults.terms),
    chartStyle: pick(value['chartStyle'], CHART_STYLES, defaults.chartStyle),
    singleCrochet: pick(value['singleCrochet'], SINGLE_CROCHET, defaults.singleCrochet),
  };
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function writeNotation(notation: PatternNotation): string {
  const { terms, chartStyle, singleCrochet } = notation;
  return JSON.stringify({ terms, chartStyle, singleCrochet });
}

/** A jelrajz beállítása a jelölésből. */
export function symbolOptionsFor(notation: PatternNotation): SymbolOptions {
  return { singleCrochet: notation.singleCrochet, style: notation.chartStyle };
}

/** A minta a jelöléssel, amellyel mentjük vagy exportáljuk. */
export function withNotation(pattern: Pattern, notation: PatternNotation): Pattern {
  const { terms, chartStyle, singleCrochet } = notation;
  return { ...pattern, notation: { terms, chartStyle, singleCrochet } };
}

/** A szöveg nyelve a `lang` attribútumhoz. */
export function textLanguage(terms: Locale): 'hu' | 'en' {
  return terms === 'hu' ? 'hu' : 'en';
}

/*
 * A szemnevek nyelve (PQW-900): a felület nyelvétől függetlenül a JELÖLÉS adja
 * (PQW-868), ezért nem a szótárból jön. A nézetek DOM nélküli, tiszta
 * függvények, és a választólisták feliratai modulszintű állandók, ezért a
 * mostani jelölést — a felület nyelvéhez hasonlóan — modulszintű állapot őrzi.
 * A `main.ts` a `syncNotationControls`-ban állítja, tehát minden jelölésváltás
 * után a listák és a mondatok a helyes szemnevet mutatják.
 */
let currentTerms: Locale = 'hu';

/** A szemnevek mostani nyelve; alapértelmezésben magyar. */
export function termsLocale(): Locale {
  return currentTerms;
}

export function setTermsLocale(terms: Locale): void {
  currentTerms = terms;
}

/** „amerikai angol (US terms)”: angol jelölésnél a rendszer neve mindig ott áll. */
export function termsLabel(terms: Locale): string {
  const name = texts().sections.notation.terms[terms];
  const system = VOCABULARIES[terms].system;
  return system ? `${name} (${system})` : name;
}

export function chartStyleLabel(style: ChartStyle): string {
  return texts().sections.notation.chartStyles[style];
}

/** Az előbeállítás jelei: japánnál JIS és ×, nemzetközinél CYC és +. A szövegjelölés marad. */
export function notationForTradition(notation: PatternNotation, tradition: Tradition): PatternNotation {
  return tradition === 'japanese'
    ? { ...notation, chartStyle: 'jis', singleCrochet: 'cross' }
    : { ...notation, chartStyle: 'cyc', singleCrochet: 'plus' };
}

export function traditionLabel(tradition: Tradition): string {
  return texts().sections.notation.traditions[tradition];
}
