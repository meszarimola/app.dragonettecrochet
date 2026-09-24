// KB: 01 §2, 01 §4, 01 §8

import type {
  GroupStitchDef,
  InsertionMode,
  JoinedStitchDef,
  Locale,
  SimpleStitchDef,
  StitchDef,
  StitchDefId,
  StitchTerm,
} from './types.ts';

type Terms = Readonly<Record<Locale, StitchTerm>>;

/** `aliases` are for parsing only, and matching ignores case. KB: 01 §8.5 */
function term(name: string, abbr: string | null = null, aliases: readonly string[] = []): StitchTerm {
  return { name, abbr, aliases };
}

function terms(hu: StitchTerm, us: StitchTerm, gb: StitchTerm): Terms {
  return { hu, 'en-US': us, 'en-GB': gb };
}

// KB: 01 §4.3

const ALL_INSERTIONS: readonly InsertionMode[] = [
  'both-loops',
  'front-loop',
  'back-loop',
  'front-post',
  'back-post',
  'space',
  'ring',
];

const WITHOUT_POST: readonly InsertionMode[] = ['both-loops', 'front-loop', 'back-loop', 'space', 'ring'];

/** A stitch worked across several stitches cannot go into a space or a ring. */
const INTO_STITCHES: readonly InsertionMode[] = ['both-loops', 'front-loop', 'back-loop'];

// KB: core-domain §9; 01 §8.3 rule 12
function heightDefaults(chainHeight: number) {
  return {
    chainHeight,
    turningChain: chainHeight,
    turningChainCounts: chainHeight >= 3,
    roundEnd: 'join-slip',
  } as const;
}

function estimated(value: number) {
  return { value, source: 'estimated' } as const;
}

const NO_HEIGHT = {
  yarnOvers: 0,
  chainHeight: 0,
  turningChain: 0,
  turningChainCounts: false,
  roundEnd: 'join-slip',
  heightFactor: estimated(0),
} as const;

function basic(id: StitchDefId, names: Terms, yarnOvers: number, chainHeight: number, height: number): SimpleStitchDef {
  return {
    id,
    kind: 'basic',
    terms: names,
    yarnOvers,
    ...heightDefaults(chainHeight),
    heightFactor: estimated(height),
    consumes: 1,
    produces: 1,
    producesSpaces: 0,
    workableTop: true,
    insertionModes: ALL_INSERTIONS,
  };
}

export const CHAIN: SimpleStitchDef = {
  id: 'ch',
  kind: 'chain',
  terms: terms(term('láncszem', 'lsz', ['légszem']), term('chain', 'ch'), term('chain', 'ch')),
  yarnOvers: 0,
  // The chain is the unit of height, but it never starts a row, so it has no turning chain.
  chainHeight: 1,
  turningChain: 0,
  turningChainCounts: false,
  roundEnd: 'join-slip',
  heightFactor: estimated(1),
  consumes: 0,
  produces: 1,
  producesSpaces: 0,
  workableTop: true,
  // Made from the loop already on the hook: there is nothing to insert into.
  insertionModes: [],
};

export const SLIP_STITCH: SimpleStitchDef = {
  id: 'sl-st',
  kind: 'slip',
  // "hamispalca" is deliberately not an alias: it is ambiguous, so the editor asks instead.
  terms: terms(term('kúszószem', 'ksz'), term('slip stitch', 'sl st'), term('slip stitch', 'ss')),
  yarnOvers: 0,
  ...heightDefaults(0),
  // KB: 01 §2.3
  heightFactor: estimated(0.2),
  // KB: core-domain §9
  consumes: 1,
  produces: 1,
  producesSpaces: 0,
  workableTop: true,
  insertionModes: WITHOUT_POST,
};

// KB: 01 §2.3 — the triple-treble ratio is extrapolated from the measured ones.

export const SINGLE_CROCHET = basic(
  'sc',
  terms(term('rövidpálca', 'rp', ['kispálca']), term('single crochet', 'sc'), term('double crochet', 'dc')),
  0,
  1,
  1,
);

export const HALF_DOUBLE_CROCHET = basic(
  'hdc',
  terms(
    term('félpálca', 'fp', ['egyráhajtásos félpálca']),
    term('half double crochet', 'hdc'),
    term('half treble', 'htr'),
  ),
  1,
  2,
  1.6,
);

export const DOUBLE_CROCHET = basic(
  'dc',
  terms(term('egyráhajtásos pálca', 'erp', ['nagypálca']), term('double crochet', 'dc'), term('treble', 'tr')),
  1,
  3,
  2.6,
);

export const TREBLE = basic(
  'tr',
  terms(term('kétráhajtásos pálca', 'krp'), term('treble', 'tr'), term('double treble', 'dtr')),
  2,
  4,
  3.9,
);

// KB: 01 §8.5 — there is no confirmed abbreviation, so the name is spelled out.
export const DOUBLE_TREBLE = basic(
  'dtr',
  terms(term('háromráhajtásos pálca'), term('double treble', 'dtr'), term('triple treble', 'trtr')),
  3,
  5,
  4.9,
);

/** Crab stitch: single crochet worked backwards. Edging; it cannot be worked into. KB: 01 §8.2 rule 10 */
export const REVERSE_SINGLE_CROCHET: SimpleStitchDef = {
  ...basic(
    'rev-sc',
    terms(
      term('rákhurok'),
      term('reverse single crochet', 'rev sc', ['crab stitch']),
      term('reverse double crochet', null, ['crab stitch']),
    ),
    0,
    1,
    1,
  ),
  workableTop: false,
  insertionModes: ['both-loops'],
};

// KB: 01 §4.4

function assertCount(n: number, min: number, what: string): void {
  if (!Number.isInteger(n) || n < min) {
    throw new RangeError(`${what}: a részszemek száma legalább ${min} egész szám, nem ${n}`);
  }
}

function assertPart(part: StitchDef, what: string): void {
  if (part.kind !== 'basic' || !part.workableTop) {
    throw new TypeError(`${what}: a részszem csak továbbhorgolható alapszem lehet, nem ${part.id}`);
  }
}

/** `yarnOvers` stays the yarn-overs of ONE part stitch. */
function inherit(part: StitchDef) {
  return {
    yarnOvers: part.yarnOvers,
    chainHeight: part.chainHeight,
    turningChain: part.turningChain,
    turningChainCounts: part.turningChainCounts,
    roundEnd: part.roundEnd,
    heightFactor: part.heightFactor,
  };
}

const INCREASE_TERMS = terms(term('szaporítás'), term('increase', 'inc'), term('increase', 'inc'));
const DECREASE_TERMS = terms(term('fogyasztás'), term('decrease', 'dec'), term('decrease', 'dec'));
const CLUSTER_TERMS = terms(term('fürt'), term('cluster', 'CL'), term('cluster', 'CL'));

/** KB: 01 §5 */
export function increase(part: StitchDef, n: number): GroupStitchDef {
  assertPart(part, 'szaporítás');
  assertCount(n, 2, 'szaporítás');
  return {
    id: `inc-${n}${part.id}`,
    kind: 'group',
    terms: INCREASE_TERMS,
    ...inherit(part),
    consumes: 1,
    produces: n,
    producesSpaces: 0,
    workableTop: true,
    insertionModes: INTO_STITCHES,
    members: Array.from({ length: n }, () => part.id),
  };
}

/** KB: 01 §5 */
export function decrease(part: StitchDef, n: number): JoinedStitchDef {
  assertPart(part, 'fogyasztás');
  assertCount(n, 2, 'fogyasztás');
  return {
    id: `${part.id}${n}tog`,
    kind: 'joined',
    terms: DECREASE_TERMS,
    ...inherit(part),
    consumes: n,
    produces: 1,
    producesSpaces: 0,
    workableTop: true,
    insertionModes: INTO_STITCHES,
    base: 'spread',
    part: part.id,
    parts: n,
    closure: 'partial',
  };
}

/** KB: 01 §4.4 */
export function shell(part: StitchDef, n: number): GroupStitchDef {
  assertPart(part, 'kagyló');
  assertCount(n, 2, 'kagyló');
  return {
    ...increase(part, n),
    id: `shell-${n}${part.id}`,
    terms: terms(term('kagyló'), term('shell', 'sh'), term('shell')),
    insertionModes: ['both-loops', 'front-loop', 'back-loop', 'space'],
  };
}

/** `same` (1 -> 1) or `spread` (n -> 1); the name does not decide, so it is required. KB: 01 §4.4 */
export function cluster(part: StitchDef, n: number, base: 'same' | 'spread'): JoinedStitchDef {
  assertPart(part, 'fürt');
  assertCount(n, 2, 'fürt');
  const joined = base === 'same' ? sameBase(part, n, 'partial') : decrease(part, n);
  return {
    ...joined,
    id: `cl-${n}${part.id}${base === 'spread' ? '-spread' : ''}`,
    terms: CLUSTER_TERMS,
  };
}

/** KB: 01 §8.2 rule 7 */
function sameBase(part: StitchDef, n: number, closure: 'partial' | 'complete' | 'loops'): JoinedStitchDef {
  return {
    ...decrease(part, n),
    consumes: 1,
    insertionModes: WITHOUT_POST,
    base: 'same',
    closure,
  };
}

export const INVISIBLE_DECREASE: JoinedStitchDef = {
  ...decrease(SINGLE_CROCHET, 2),
  id: 'invdec',
  terms: terms(term('láthatatlan fogyasztás'), term('invisible decrease', 'invdec'), term('invisible decrease')),
  // Front loops only; the back loops stay inside the amigurumi. KB: 01 §4.4
  insertionModes: ['front-loop'],
};

export const V_STITCH: GroupStitchDef = {
  ...increase(DOUBLE_CROCHET, 2),
  id: 'v-st-dc',
  terms: terms(term('V-szem'), term('V-stitch', 'V-st'), term('V-stitch')),
  producesSpaces: 1,
  insertionModes: ['both-loops', 'front-loop', 'back-loop', 'space'],
  members: [DOUBLE_CROCHET.id, CHAIN.id, DOUBLE_CROCHET.id],
};

/** KB: 01 §4.4 */
export const PUFF: JoinedStitchDef = {
  ...sameBase(HALF_DOUBLE_CROCHET, 3, 'loops'),
  id: 'puff-3',
  terms: terms(term('puff'), term('puff stitch', 'ps', ['puff']), term('puff stitch')),
};

/** KB: 01 §4.4 */
export const BOBBLE: JoinedStitchDef = {
  ...sameBase(DOUBLE_CROCHET, 5, 'partial'),
  id: 'bobble-5dc',
  terms: terms(term('bogyó'), term('bobble', 'bo'), term('bobble')),
};

/** KB: 01 §4.4 */
export const POPCORN: JoinedStitchDef = {
  ...sameBase(DOUBLE_CROCHET, 5, 'complete'),
  id: 'popcorn-5dc',
  terms: terms(term('popcorn'), term('popcorn', 'pc'), term('popcorn')),
};

/** A picot does not count as a stitch by default. KB: core-domain §9 */
export const PICOT: SimpleStitchDef = {
  id: 'picot',
  kind: 'picot',
  terms: terms(term('pikó'), term('picot', 'p'), term('picot')),
  ...NO_HEIGHT,
  consumes: 0,
  produces: 0,
  producesSpaces: 0,
  workableTop: true,
  insertionModes: [],
};

/** The chain count and the skipped stitches are decided on placement, so there is no `consumes` here. KB: 01 §8.2 rule 11 */
export const CHAIN_SPACE: SimpleStitchDef = {
  id: 'ch-sp',
  kind: 'space',
  terms: terms(term('láncív'), term('chain space', 'ch-sp', ['chain loop', 'ch-lp']), term('chain space', 'ch-sp')),
  ...NO_HEIGHT,
  consumes: 0,
  produces: 0,
  producesSpaces: 1,
  workableTop: false,
  insertionModes: [],
};

/** Not a stitch but an insertion point. KB: 04 §1.1 */
export const MAGIC_RING: SimpleStitchDef = {
  id: 'magic-ring',
  kind: 'ring',
  terms: terms(term('varázskör'), term('magic ring', 'MR'), term('magic ring', 'MR')),
  ...NO_HEIGHT,
  consumes: 0,
  produces: 0,
  producesSpaces: 0,
  workableTop: false,
  insertionModes: [],
};

export type StitchSectionId = 'basic' | 'increase-decrease' | 'compound' | 'structure';

export interface StitchSection {
  readonly id: StitchSectionId;
  readonly stitches: readonly StitchDef[];
  /**
   * A section the palette does not show as a section of its own. Its stitches
   * stay in the library, so a chart that holds one is drawn and named, and the
   * written pattern's key keeps its order. KB: interface.md §74
   */
  readonly offPalette?: boolean;
}

/** In palette order. */
export const STITCH_SECTIONS: readonly StitchSection[] = [
  {
    id: 'basic',
    stitches: [CHAIN, SLIP_STITCH, SINGLE_CROCHET, HALF_DOUBLE_CROCHET, DOUBLE_CROCHET, TREBLE, DOUBLE_TREBLE],
  },
  {
    id: 'increase-decrease',
    stitches: [
      increase(SINGLE_CROCHET, 2),
      increase(DOUBLE_CROCHET, 2),
      decrease(SINGLE_CROCHET, 2),
      decrease(SINGLE_CROCHET, 3),
      decrease(DOUBLE_CROCHET, 2),
      decrease(DOUBLE_CROCHET, 3),
      INVISIBLE_DECREASE,
    ],
  },
  {
    id: 'compound',
    stitches: [
      shell(DOUBLE_CROCHET, 5),
      V_STITCH,
      cluster(DOUBLE_CROCHET, 3, 'same'),
      cluster(DOUBLE_CROCHET, 3, 'spread'),
      PUFF,
      BOBBLE,
      POPCORN,
      PICOT,
      REVERSE_SINGLE_CROCHET,
    ],
  },
  // KB: interface.md §74 — the palette shows these two its own way; the library
  // order stays as it is, because the written pattern's key follows it.
  {
    id: 'structure',
    stitches: [CHAIN_SPACE, MAGIC_RING],
    offPalette: true,
  },
];

export const STITCHES: readonly StitchDef[] = STITCH_SECTIONS.flatMap((section) => section.stitches);

const BY_ID = new Map(STITCHES.map((stitch) => [stitch.id, stitch]));

export function stitchById(id: StitchDefId): StitchDef {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Ismeretlen szem: ${id}`);
  return found;
}
