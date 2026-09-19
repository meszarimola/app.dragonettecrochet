// KB: interface.md §1, §2

import { VOCABULARIES } from '../core/pattern-text.ts';
import type { ChartStyle, Locale, Pattern, PatternNotation, Tradition } from '../core/types.ts';
import { texts } from './i18n.ts';
import type { SymbolOptions } from './symbols.ts';

export type UiLanguage = 'hu' | 'en';

export const TERMS: readonly Locale[] = ['hu', 'en-US', 'en-GB'];
export const CHART_STYLES: readonly ChartStyle[] = ['cyc', 'jis'];
// KB: interface.md §21
export function singleCrochetFor(chartStyle: ChartStyle): PatternNotation['singleCrochet'] {
  return chartStyle === 'jis' ? 'cross' : 'plus';
}

export function uiLanguageOf(lang: string): UiLanguage {
  return /^en\b/i.test(lang) ? 'en' : 'hu';
}

export function defaultNotation(ui: UiLanguage): PatternNotation {
  return { terms: ui === 'en' ? 'en-US' : 'hu', chartStyle: 'cyc', singleCrochet: singleCrochetFor('cyc') };
}

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
  const chartStyle = pick(value['chartStyle'], CHART_STYLES, defaults.chartStyle);
  return {
    terms: pick(value['terms'], TERMS, defaults.terms),
    chartStyle,
    // KB: interface.md §21 — never read back from storage.
    singleCrochet: singleCrochetFor(chartStyle),
  };
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function writeNotation(notation: PatternNotation): string {
  const { terms, chartStyle, singleCrochet } = notation;
  return JSON.stringify({ terms, chartStyle, singleCrochet });
}

export function symbolOptionsFor(notation: PatternNotation): SymbolOptions {
  return { singleCrochet: notation.singleCrochet, style: notation.chartStyle };
}

export function withNotation(pattern: Pattern, notation: PatternNotation): Pattern {
  const { terms, chartStyle, singleCrochet } = notation;
  return { ...pattern, notation: { terms, chartStyle, singleCrochet } };
}

export function textLanguage(terms: Locale): 'hu' | 'en' {
  return terms === 'hu' ? 'hu' : 'en';
}

// KB: interface.md §2 — module state, set from `syncNotationControls`.
let currentTerms: Locale = 'hu';

export function termsLocale(): Locale {
  return currentTerms;
}

export function setTermsLocale(terms: Locale): void {
  currentTerms = terms;
}

export function termsLabel(terms: Locale): string {
  const name = texts().sections.notation.terms[terms];
  const system = VOCABULARIES[terms].system;
  return system ? `${name} (${system})` : name;
}

export function chartStyleLabel(style: ChartStyle): string {
  return texts().sections.notation.chartStyles[style];
}

export function notationForTradition(notation: PatternNotation, tradition: Tradition): PatternNotation {
  const chartStyle: ChartStyle = tradition === 'japanese' ? 'jis' : 'cyc';
  return { ...notation, chartStyle, singleCrochet: singleCrochetFor(chartStyle) };
}

export function traditionLabel(tradition: Tradition): string {
  return texts().sections.notation.traditions[tradition];
}
