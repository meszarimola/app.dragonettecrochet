/*
 * A rétegenkénti bontás mondata: „2. sor: 1 szem, 3. sor: 1 szem” (PQW-904).
 *
 * A mag rétegszámot, alakot és darabszámot ad (`LayerCount`, selection.ts), a
 * mondat a felületé. Két helyen kell ugyanaz a szöveg: a szerkesztő magüzeneteiben
 * (`core/editor.ts`) és az állapotsor, illetve a törlés párbeszédének mondataiban
 * (`i18n/messages.ts`). Ezért lakik külön, levélmodulban: a `messages.ts` nem
 * importálhatja a szerkesztő szótárát, mert az a `notation.ts`-en át visszamutatna
 * az `i18n.ts`-re, és körkörös importot csinálna.
 *
 * Futásidejű függése nincs, csak típust hoz be, ezért a Node is futtatja.
 */

import type { LayerCount } from '../../../core/selection.ts';

/** „2. sor”, „3. kör”; a 0. réteg a láncalap vagy a varázskör. */
export const huLayer = (layer: number, round: boolean): string =>
  layer === 0 ? (round ? 'varázskör' : 'láncalap') : `${layer}. ${round ? 'kör' : 'sor'}`;

export const enLayer = (layer: number, round: boolean): string =>
  layer === 0 ? (round ? 'magic ring' : 'foundation chain') : `${round ? 'round' : 'row'} ${layer}`;

export const huStitches = (count: number): string => `${count} szem`;

export const enStitches = (count: number): string => `${count} ${count === 1 ? 'stitch' : 'stitches'}`;

/**
 * A bontás mondata. Üres listánál — a minta szerkezete ismeretlen, ezért a mag
 * nem tud rétegeket mondani — a `fallback` szemszáma áll a helyén; `fallback`
 * nélkül üres marad, ahogy a szerkesztő üzeneteiben.
 */
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
