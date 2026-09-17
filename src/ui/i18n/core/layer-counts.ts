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

/**
 * „2. sor”, „3. kör”.
 *
 * Sorokban a láncalap az 1. sor (PQW-923, tulajdonosi döntés): a szemeit
 * horgolás közben is használjuk, ezért nem külön néven, hanem sorként szerepel.
 * A rá következő sor így a 2., vagyis a kiírt sorszám a réteg indexénél eggyel
 * nagyobb.
 *
 * Körben a számozás változatlan: a varázskör, a láncgyűrű és az ovális kezdés a
 * mai nevén marad, hogy a kész amigurumi minták körszámai ne csússzanak el. Ott
 * a 0. réteg neve a kezdés fajtájából jön, nem sorszámból.
 */
export const huLayer = (layer: number, round: boolean): string =>
  round ? (layer === 0 ? 'varázskör' : `${layer}. kör`) : `${layer + 1}. sor`;

export const enLayer = (layer: number, round: boolean): string =>
  round ? (layer === 0 ? 'magic ring' : `round ${layer}`) : `row ${layer + 1}`;

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
