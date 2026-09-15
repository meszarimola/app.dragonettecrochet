/*
 * A szemkönyvtár: minden szem és összetett szem adatként.
 *
 * Itt van minden, ami a számoláshoz, a jel rajzához és a szöveghez kell, a
 * src/core/types.ts `StitchDef` felülete szerint. A nevek a jóváhagyott
 * szókészletből jönnek (docs/stitch-vocabulary-proposal.md), a számok a
 * tudásbázisból (01 §2, §4, §8).
 *
 * Az összetett szemeket építőfüggvény készíti a részszemből. Így a
 * magasság, a fordulólánc és a körzárás mindig a részszemmel egyezik, és
 * bármilyen n megadható. A könyvtárban a gyakori változatok szerepelnek, a
 * paletta ezekből épül.
 */

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

/**
 * Egy jelölés neve. Az `aliases` csak értelmezéshez kell; a kis- és nagybetűt
 * az értelmezés nem különbözteti meg, ezért az „RP” alakot nem soroljuk fel
 * (szókészlet D5).
 */
function term(name: string, abbr: string | null = null, aliases: readonly string[] = []): StitchTerm {
  return { name, abbr, aliases };
}

function terms(hu: StitchTerm, us: StitchTerm, gb: StitchTerm): Terms {
  return { hu, 'en-US': us, 'en-GB': gb };
}

/* ---- Beszúrási módok (01 §4.3) ---- */

const ALL_INSERTIONS: readonly InsertionMode[] = [
  'both-loops',
  'front-loop',
  'back-loop',
  'front-post',
  'back-post',
  'space',
  'ring',
];

/** Kúszószem és egy alapba horgolt összetett szem: relief nélkül. */
const WITHOUT_POST: readonly InsertionMode[] = ['both-loops', 'front-loop', 'back-loop', 'space', 'ring'];

/** Több szemen át horgolt szem: csak szembe szúrható. */
const INTO_STITCHES: readonly InsertionMode[] = ['both-loops', 'front-loop', 'back-loop'];

/* ---- Alapértelmezések ---- */

/**
 * A láncszem-magasságból következő alapértelmezések:
 * - a fordulólánc a sort kezdő szem láncszem-magassága (01 §8.3 szabály 12):
 *   rövidpálcánál 1, félpálcánál 2, egyráhajtásos pálcánál 3 láncszem;
 * - a `turningChainCounts` a kör kezdőláncáé: egyráhajtásos pálcától számít
 *   szemnek, alatta nem (szókészlet K1). Sorban a fordulólánc minden szemnél
 *   számít, és alapláncszemen áll (PQW-891); ezt a tradition.ts dönti el;
 * - a körzárás zárt kör: a spirál az amigurumi mintatípusból jön, nem a szem
 *   magasságából (szókészlet K2, tulajdonosi döntés, PQW-892, rounds.ts).
 */
function heightDefaults(chainHeight: number) {
  return {
    chainHeight,
    turningChain: chainHeight,
    turningChainCounts: chainHeight >= 3,
    roundEnd: 'join-slip',
  } as const;
}

/** Becsült valós magasság a rövidpálcához képest; a gauge-profil felülírja (README §4.1). */
function estimated(value: number) {
  return { value, source: 'estimated' } as const;
}

/** Nem szerkezeti elem (pikó, láncív, varázskör): nincs saját magassága és fordulólánca. */
const NO_HEIGHT = {
  yarnOvers: 0,
  chainHeight: 0,
  turningChain: 0,
  turningChainCounts: false,
  roundEnd: 'join-slip',
  heightFactor: estimated(0),
} as const;

/* ---- Alapszemek (szókészlet §1) ---- */

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
  // A láncszem a magasság mértékegysége, de sort nem kezd, ezért nincs fordulólánca.
  chainHeight: 1,
  turningChain: 0,
  turningChainCounts: false,
  roundEnd: 'join-slip',
  heightFactor: estimated(1),
  consumes: 0,
  produces: 1,
  producesSpaces: 0,
  workableTop: true,
  // A horgon lévő hurokból készül, semmibe nem szúrunk bele.
  insertionModes: [],
};

export const SLIP_STITCH: SimpleStitchDef = {
  id: 'sl-st',
  kind: 'slip',
  // A „hamispálca” szándékosan nincs itt: kétértelmű, rákérdezünk (szókészlet D1).
  terms: terms(term('kúszószem', 'ksz'), term('slip stitch', 'sl st'), term('slip stitch', 'ss')),
  yarnOvers: 0,
  ...heightDefaults(0),
  // 01 §2.3: 1–2 mm a rövidpálca 6–8 mm-éhez képest.
  heightFactor: estimated(0.2),
  // Illesztésnél és továbbvezetésnél mintánként kikapcsolható a számolása (szókészlet D7).
  consumes: 1,
  produces: 1,
  producesSpaces: 0,
  workableTop: true,
  insertionModes: WITHOUT_POST,
};

/*
 * A valós magasságarányok a 01 §2.3 mért középértékei (rp 1, fp 1,6, erp 2,6,
 * krp 3,9). A háromráhajtásos pálcáé ebből továbbvezetett becslés.
 */

export const SINGLE_CROCHET = basic(
  'sc',
  terms(term('rövidpálca', 'rp', ['kispálca']), term('single crochet', 'sc'), term('double crochet', 'dc')),
  0,
  1,
  1,
);

export const HALF_DOUBLE_CROCHET = basic(
  'hdc',
  terms(term('félpálca', 'fp', ['egyráhajtásos félpálca']), term('half double crochet', 'hdc'), term('half treble', 'htr')),
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

// A „hrp” rövidítés nincs megerősítve, ezért a név kiírva szerepel (szókészlet D4).
export const DOUBLE_TREBLE = basic(
  'dtr',
  terms(term('háromráhajtásos pálca'), term('double treble', 'dtr'), term('triple treble', 'trtr')),
  3,
  5,
  4.9,
);

/** A rákhurok: rövidpálca visszafelé. Szegély, a tetejébe nem lehet horgolni (01 §8.2 szabály 10). */
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

/* ---- Összetett szemek építőfüggvényei (szókészlet §2, 01 §4.4) ---- */

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

/** A részszemtől örökölt tulajdonságok. A `yarnOvers` egy részszem ráhajtásait jelenti. */
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

/** Szaporítás: n szem egy szembe, 1 → n (01 §5). */
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

/** Fogyasztás: n szemből egy, n → 1 (01 §5). */
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

/** Kagyló: n szem egy szembe vagy láncívbe, 1 → n (01 §4.4). */
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

/** Fürt. Egy szembe (`same`, 1 → 1) vagy n szemen át (`spread`, n → 1); a név nem dönti el (szókészlet D6). */
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

/** Egy szembe horgolt részszemek egy tetővel: 1 → 1 (01 §8.2 szabály 7). */
function sameBase(part: StitchDef, n: number, closure: 'partial' | 'complete' | 'loops'): JoinedStitchDef {
  return {
    ...decrease(part, n),
    consumes: 1,
    insertionModes: WITHOUT_POST,
    base: 'same',
    closure,
  };
}

/* ---- A könyvtár ---- */

export const INVISIBLE_DECREASE: JoinedStitchDef = {
  ...decrease(SINGLE_CROCHET, 2),
  id: 'invdec',
  terms: terms(
    term('láthatatlan fogyasztás'),
    term('invisible decrease', 'invdec'),
    term('invisible decrease'),
  ),
  // Az első szálakba szúrunk, a hátsók az amigurumi belsejében maradnak (01 §4.4).
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

/** Puff: csak felhúzott hurkok, félpálca magasságú (01 §4.4). */
export const PUFF: JoinedStitchDef = {
  ...sameBase(HALF_DOUBLE_CROCHET, 3, 'loops'),
  id: 'puff-3',
  terms: terms(term('puff'), term('puff stitch', 'ps', ['puff']), term('puff stitch')),
};

/** Bogyó: félig kész egyráhajtásos pálcák egy szembe, egy tetővel (01 §4.4). */
export const BOBBLE: JoinedStitchDef = {
  ...sameBase(DOUBLE_CROCHET, 5, 'partial'),
  id: 'bobble-5dc',
  terms: terms(term('bogyó'), term('bobble', 'bo'), term('bobble')),
};

/** Popcorn: teljes egyráhajtásos pálcák egy szembe, utólag összezárva (01 §4.4). */
export const POPCORN: JoinedStitchDef = {
  ...sameBase(DOUBLE_CROCHET, 5, 'complete'),
  id: 'popcorn-5dc',
  terms: terms(term('popcorn'), term('popcorn', 'pc'), term('popcorn')),
};

/** Háromláncszemes pikó. Díszítés, alapból nem számít szemnek (szókészlet D7). */
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

/**
 * Láncív. A láncszemek száma és a kihagyott szemek a lerakáskor dőlnek el
 * („ch k, sk m”), ezért itt nincs fogyasztás; a következő sor egyetlen
 * célpontként kezeli (01 §8.2 szabály 11).
 */
export const CHAIN_SPACE: SimpleStitchDef = {
  id: 'ch-sp',
  kind: 'space',
  terms: terms(
    term('láncív'),
    term('chain space', 'ch-sp', ['chain loop', 'ch-lp']),
    term('chain space', 'ch-sp'),
  ),
  ...NO_HEIGHT,
  consumes: 0,
  produces: 0,
  producesSpaces: 1,
  workableTop: false,
  insertionModes: [],
};

/** Varázskör. Nem szem, hanem egy beszúrási pont (04 §1.1). */
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
}

/** A könyvtár csoportokban, a paletta sorrendjében. */
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
  {
    id: 'structure',
    stitches: [CHAIN_SPACE, MAGIC_RING],
  },
];

export const STITCHES: readonly StitchDef[] = STITCH_SECTIONS.flatMap((section) => section.stitches);

const BY_ID = new Map(STITCHES.map((stitch) => [stitch.id, stitch]));

export function stitchById(id: StitchDefId): StitchDef {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Ismeretlen szem: ${id}`);
  return found;
}
