/*
 * The per-layer breakdown sentence, shared by the editor's core messages and by
 * the status line and the delete dialog.
 *
 * KB: dictionaries.md §3
 */

import type { LayerCount } from '../../../core/selection.ts';

/** In rounds layer 0 is named after the kind of start, not numbered. KB: interface.md §33 */
export const huLayer = (layer: number, round: boolean): string =>
  round ? (layer === 0 ? 'varázskör' : `${layer}. kör`) : `${layer + 1}. sor`;

export const enLayer = (layer: number, round: boolean): string =>
  round ? (layer === 0 ? 'magic ring' : `round ${layer}`) : `row ${layer + 1}`;

export const huStitches = (count: number): string => `${count} szem`;

export const enStitches = (count: number): string => `${count} ${count === 1 ? 'stitch' : 'stitches'}`;

export const huLayerCounts = (where: readonly LayerCount[], fallback?: number): string =>
  where.length === 0
    ? fallback === undefined
      ? ''
      : huStitches(fallback)
    : where.map((entry) => `${huLayer(entry.layer, entry.shape === 'round')}: ${huStitches(entry.count)}`).join(', ');

export const enLayerCounts = (where: readonly LayerCount[], fallback?: number): string =>
  where.length === 0
    ? fallback === undefined
      ? ''
      : enStitches(fallback)
    : where.map((entry) => `${enLayer(entry.layer, entry.shape === 'round')}: ${enStitches(entry.count)}`).join(', ');
