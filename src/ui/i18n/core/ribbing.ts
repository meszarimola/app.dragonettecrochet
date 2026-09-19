/*
 * Ribbing messages, spread into the Shape, the Round-and-motif and the garment
 * dictionaries.
 *
 * KB: dictionaries.md §4
 */

import type { RibbingCode } from '../../../core/ribbing.ts';
import { num } from './render.ts';
import type { CoreEntry } from './render.ts';

type RibbingEntries = Readonly<Record<RibbingCode, CoreEntry>>;

export const RIBBING_HU: RibbingEntries = {
  'ribbing-rows-range': (data) => `A bordázat sorainak száma 1 és ${num(data, 'max')} között lehet.`,
  'ribbing-width-range': (data) => `A bordázat egysége 1 és ${num(data, 'max')} szem között lehet.`,
  'ribbing-stitch-missing': 'A bordázat szeme nincs a könyvtárban.',
  'ribbing-needs-row': 'A bordázat kész sorra vagy körre épül: előbb horgolj legalább egy sort.',
  'ribbing-after-join': 'A bordás perem a kör zárása (kúszószem) után kezdődik.',
  'ribbing-spiral': 'A bordás perem a kör zárása után kezdődik: spirálban nem készül, válaszd a kúszószemes zárást.',
  'ribbing-after-turn': 'A bordás szegély a sor fordulása után kezdődik.',
  'ribbing-round-multiple': (data) =>
    `Körben a bordázat akkor záródik, ha a szemszám ${num(data, 'unit')} többszöröse: most ${num(data, 'count')} szem van, ` +
    `a legközelebbi jó szám ${num(data, 'nearest')}.`,
  'ribbing-needs-post-stitch':
    'A relief szem a szemek pálcája köré kapaszkodik: ezen a soron nincs pálcás szem, ezért nem horgolható rá bordázat.',
};

export const RIBBING_EN: RibbingEntries = {
  'ribbing-rows-range': (data) => `The number of ribbing rows can be between 1 and ${num(data, 'max')}.`,
  'ribbing-width-range': (data) => `The ribbing unit can be between 1 and ${num(data, 'max')} stitches.`,
  'ribbing-stitch-missing': 'The stitch of the ribbing is not in the library.',
  'ribbing-needs-row': 'Ribbing is built onto a finished row or round: work at least one row first.',
  'ribbing-after-join': 'A ribbed edge starts after the round is joined with a slip stitch.',
  'ribbing-spiral': 'A ribbed edge starts after the round is joined: it cannot be made in a spiral, choose the slip stitch join.',
  'ribbing-after-turn': 'A ribbed edging starts after the turn of the row.',
  'ribbing-round-multiple': (data) =>
    `In the round, ribbing closes when the stitch count is a multiple of ${num(data, 'unit')}: there are ${num(data, 'count')} stitches now, ` +
    `the nearest suitable number is ${num(data, 'nearest')}.`,
  'ribbing-needs-post-stitch':
    'A post stitch wraps around the post of a stitch: this row has no posted stitch, so ribbing cannot be worked onto it.',
};
