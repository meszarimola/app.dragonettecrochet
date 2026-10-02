// KB: interface.md §1, §2

import type { ChartStyle, Locale } from '../core/types.ts';
import type { SymbolOptions } from './symbols.ts';

export type UiLanguage = 'hu' | 'en';

export const CHART_STYLES: readonly ChartStyle[] = ['cyc', 'jis'];

export function termsFor(ui: UiLanguage): Locale {
  return ui === 'en' ? 'en-US' : 'hu';
}

function parseStored(stored: string | null): Record<string, unknown> {
  try {
    const value = stored === null ? null : (JSON.parse(stored) as unknown);
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** Reads the chart style out of the stored notation; anything unreadable is CYC. */
export function readChartStyle(stored: string | null): ChartStyle {
  const chartStyle = parseStored(stored)['chartStyle'];
  return CHART_STYLES.includes(chartStyle as ChartStyle) ? (chartStyle as ChartStyle) : 'cyc';
}

/**
 * Writes the chart style into the stored notation, keeping whatever else it
 * holds — the terms chosen before PQW-1141 survive a rollback.
 */
export function writeChartStyle(stored: string | null, chartStyle: ChartStyle): string {
  return JSON.stringify({
    ...parseStored(stored),
    chartStyle,
    singleCrochet: symbolOptionsFor(chartStyle).singleCrochet,
  });
}

// KB: interface.md §21
export function symbolOptionsFor(chartStyle: ChartStyle): SymbolOptions {
  return { singleCrochet: chartStyle === 'jis' ? 'cross' : 'plus', style: chartStyle };
}
