/*
 * Saját öltés-minták a gráf tesztjeihez, a src/core/types.ts felületén.
 *
 * Nem a valódi öltéskönyvtár (az a PQW-867-ben készül), csak annyi, amennyi a
 * kidolgozott példákhoz kell. Az értékek a jóváhagyott szókészletet követik
 * (docs/stitch-vocabulary-proposal.md §1–2, K1, K2).
 */

import { createStitchLibrary } from '../../src/core/stitch-library.ts';
import type { GroupStitchDef, JoinedStitchDef, SimpleStitchDef, StitchDef, StitchTerm } from '../../src/core/types.ts';

const term = (name: string, abbr: string | null): StitchTerm => ({ name, abbr, aliases: [] });

interface Names {
  readonly hu: readonly [string, string | null];
  readonly us: readonly [string, string | null];
  readonly uk: readonly [string, string | null];
}

function simple(
  id: string,
  kind: SimpleStitchDef['kind'],
  names: Names,
  mechanics: { yarnOvers: number; chainHeight: number; consumes: number; produces: number; workableTop?: boolean },
): SimpleStitchDef {
  return {
    id,
    kind,
    terms: { hu: term(...names.hu), 'en-US': term(...names.us), 'en-GB': term(...names.uk) },
    yarnOvers: mechanics.yarnOvers,
    chainHeight: mechanics.chainHeight,
    turningChain: mechanics.chainHeight,
    // K1: rövidpálcánál és félpálcánál nem számít, egyráhajtásos pálcától igen.
    turningChainCounts: mechanics.chainHeight >= 3,
    // K2: rövidpálcánál spirál, egyráhajtásos pálcától zárt kör.
    roundEnd: mechanics.chainHeight >= 3 ? 'join-slip' : 'spiral',
    heightFactor: { value: Math.max(mechanics.chainHeight, 0.2), source: 'estimated' },
    consumes: mechanics.consumes,
    produces: mechanics.produces,
    producesSpaces: 0,
    workableTop: mechanics.workableTop ?? true,
    insertionModes: ['both-loops', 'front-loop', 'back-loop', 'front-post', 'back-post', 'space', 'ring'],
  };
}

const basicStitch = (id: string, names: Names, yarnOvers: number, chainHeight: number) =>
  simple(id, 'basic', names, { yarnOvers, chainHeight, consumes: 1, produces: 1 });

export const ch = simple(
  'ch',
  'chain',
  { hu: ['láncszem', 'lsz'], us: ['chain', 'ch'], uk: ['chain', 'ch'] },
  { yarnOvers: 0, chainHeight: 1, consumes: 0, produces: 1 },
);
export const slSt = simple(
  'sl-st',
  'slip',
  { hu: ['kúszószem', 'ksz'], us: ['slip stitch', 'sl st'], uk: ['slip stitch', 'ss'] },
  { yarnOvers: 0, chainHeight: 0, consumes: 1, produces: 1 },
);
export const magicRing = simple(
  'mr',
  'ring',
  { hu: ['varázskör', null], us: ['magic ring', 'MR'], uk: ['magic ring', 'MR'] },
  { yarnOvers: 0, chainHeight: 0, consumes: 0, produces: 1 },
);
export const sc = basicStitch('sc', { hu: ['rövidpálca', 'rp'], us: ['single crochet', 'sc'], uk: ['double crochet', 'dc'] }, 0, 1);
export const hdc = basicStitch('hdc', { hu: ['félpálca', 'fp'], us: ['half double crochet', 'hdc'], uk: ['half treble', 'htr'] }, 1, 2);
export const dc = basicStitch('dc', { hu: ['egyráhajtásos pálca', 'erp'], us: ['double crochet', 'dc'], uk: ['treble', 'tr'] }, 1, 3);
export const tr = basicStitch('tr', { hu: ['kétráhajtásos pálca', 'krp'], us: ['treble', 'tr'], uk: ['double treble', 'dtr'] }, 2, 4);
export const revSc = simple(
  'rev-sc',
  'basic',
  { hu: ['rákhurok', null], us: ['reverse single crochet', 'rev sc'], uk: ['crab stitch', null] },
  { yarnOvers: 0, chainHeight: 1, consumes: 1, produces: 1, workableTop: false },
);

function together(id: string, parts: number, names: Names): JoinedStitchDef {
  return { ...dc, id, kind: 'joined', terms: simple(id, 'basic', names, dc).terms, consumes: parts, base: 'spread', part: 'dc', parts };
}

export const dc2tog = together('dc2tog', 2, {
  hu: ['fogyasztás', null],
  us: ['double crochet two together', 'dc2tog'],
  uk: ['treble two together', 'tr2tog'],
});
export const dc3tog = together('dc3tog', 3, {
  hu: ['fogyasztás', null],
  us: ['double crochet three together', 'dc3tog'],
  uk: ['treble three together', 'tr3tog'],
});

function group(id: string, base: SimpleStitchDef, members: readonly string[], names: Names): GroupStitchDef {
  const stitches = members.filter((member) => member !== 'ch').length;
  return {
    ...base,
    id,
    kind: 'group',
    terms: simple(id, 'basic', names, base).terms,
    produces: stitches,
    producesSpaces: members.length - stitches,
    members,
  };
}

export const hdcInc = group('hdc-inc', hdc, ['hdc', 'hdc'], { hu: ['szaporítás', null], us: ['increase', 'inc'], uk: ['increase', 'inc'] });
export const dcInc = group('dc-inc', dc, ['dc', 'dc'], { hu: ['szaporítás', null], us: ['increase', 'inc'], uk: ['increase', 'inc'] });
export const dc3In1 = group('dc-3in1', dc, ['dc', 'dc', 'dc'], {
  hu: ['szaporítás', null],
  us: ['3 double crochet in same stitch', null],
  uk: ['3 treble in same stitch', null],
});
export const shell5dc = group('shell-5dc', dc, ['dc', 'dc', 'dc', 'dc', 'dc'], {
  hu: ['kagyló', null],
  us: ['shell', 'sh'],
  uk: ['shell', null],
});
export const vStitch = group('v-stitch', dc, ['dc', 'ch', 'dc'], { hu: ['V-öltés', null], us: ['V-stitch', 'V-st'], uk: ['V-stitch', null] });

export const TEST_STITCHES: readonly StitchDef[] = [
  ch,
  slSt,
  magicRing,
  sc,
  hdc,
  dc,
  tr,
  revSc,
  dc2tog,
  dc3tog,
  hdcInc,
  dcInc,
  dc3In1,
  shell5dc,
  vStitch,
];

export const testLibrary = createStitchLibrary(TEST_STITCHES);
