/*
 * The free-form chart editor's own strings (PQW-963). The static labels of its
 * panel live in markup.ts; what the editor says while you work lives here.
 *
 * KB: dictionaries.md §1
 */

import type { Dictionary } from '../i18n.ts';

const enStitches = (count: number): string => `${count} ${count === 1 ? 'stitch' : 'stitches'}`;

export const IRREGULAR_TEXTS = {
  hu: {
    newTitle: 'Új szabálytalan minta',
    layerDrawing: 'Mintarajz',
    layerLabels: 'Feliratok',
    placed: (stitch: string, row: number, total: number): string => `${stitch}, ${row}. sor. ${total} szem.`,
    selected: (count: number): string => `${count} szem kijelölve.`,
    selectedNone: 'Nincs kijelölt szem.',
    deleted: (count: number): string => `${count} szem törölve.`,
    duplicated: (count: number): string => `${count} szem másolva.`,
    pasted: (count: number): string => `${count} szem beillesztve.`,
    copied: (count: number): string => `${count} szem a vágólapon.`,
    aligned: 'Igazítva.',
    spread: 'Egyenletesen elosztva.',
    moved: (count: number): string => `${count} szem áthelyezve.`,
    emptied: 'Új szabálytalan minta indult.',
    rectPartial: 'A részben lefedett elemek is',
    rectFull: 'Csak a teljesen bekerített elemek',
    wrongFileKind: 'Ez a fájl szabályos horgolás mintája. Válts át a Szabályos horgolás típusra, és ott töltsd be.',
    hint: 'Válassz szemet, és kattints a rajzlapra. Kijelöléshez kattints egy szemre, vagy húzz téglalapot.',
  },
  en: {
    newTitle: 'New free-form pattern',
    layerDrawing: 'Chart',
    layerLabels: 'Labels',
    placed: (stitch: string, row: number, total: number): string =>
      `${stitch}, row ${row}. ${enStitches(total)}.`,
    selected: (count: number): string => `${enStitches(count)} selected.`,
    selectedNone: 'No stitch is selected.',
    deleted: (count: number): string => `${enStitches(count)} deleted.`,
    duplicated: (count: number): string => `${enStitches(count)} duplicated.`,
    pasted: (count: number): string => `${enStitches(count)} pasted.`,
    copied: (count: number): string => `${enStitches(count)} on the clipboard.`,
    aligned: 'Aligned.',
    spread: 'Spread evenly.',
    moved: (count: number): string => `${enStitches(count)} moved.`,
    emptied: 'A new free-form pattern was started.',
    rectPartial: 'Include partly covered objects',
    rectFull: 'Only fully enclosed objects',
    wrongFileKind: 'This file is a regular crochet pattern. Switch to the Regular crochet type and load it there.',
    hint: 'Pick a stitch and click the drawing area. To select, click a stitch or drag a rectangle.',
  },
} satisfies Dictionary<unknown>;
