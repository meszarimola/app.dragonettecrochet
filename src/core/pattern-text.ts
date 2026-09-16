/*
 * Az írott minta szövege a lépéssorból (pattern-steps.ts), magyarul, amerikai
 * és brit jelöléssel.
 *
 * - Egy mintán belül egyetlen jelölés van: minden név és rövidítés a választott
 *   jelölés `StitchDef.terms` bejegyzéséből jön, az `aliases` soha
 *   (01 §8.5 szabály 24–25).
 * - A brit szöveg ugyanaz a sablon, mint az amerikai, csak a brit nevekkel
 *   (egy fokkal eltolva) és a „miss” szóval. Az angol címsorok megnevezik a
 *   rendszert („US terms”, „UK terms”); a felületi kapcsoló a PQW-868.
 * - A sor végén a szemszám áll, ahogy a gráf számolja (06 §5.3 pont 1).
 * - Az egymás utáni azonos sorok egy sorba kerülnek („2–21. sor”, 04 §9.8).
 * - Rövidítéslista és jelmagyarázat csak a mintában ténylegesen használt
 *   szemekkel és rövidítésekkel (01 §8.5 szabály 27).
 *
 * A kifejezéseket a visszaolvasó (pattern-read.ts) is innen veszi, így a kettő
 * nem térhet el.
 */

import { sizingLines } from './garment-text.ts';
import { article, dative, times } from './hungarian.ts';
import { writtenPieces, type Step, type StepTarget, type WrittenBorder, type WrittenLayer, type WrittenPiece } from './pattern-steps.ts';
import type { StitchLibrary } from './stitch-library.ts';
import { stitchLabel, stitchStructure } from './stitchText.ts';
import { colorLetter } from './pixel-chart.ts';
import type { GridTechnique, JoinEdge, Locale, Pattern, RoundMark, StitchDef, StitchDefId, StitchInsertion } from './types.ts';

/** A szín betűje előtt a névelő: „az A”, „az E”, „az F”, máskor „a” (az A–H betűkre). */
const colorArticle = (letter: string) => ('AEF'.includes(letter) ? 'az' : 'a');

/* ---- Szókészlet ---- */

/** Helyhatározók; a `next` csak szaporításnál íródik ki, máskor a kurzor következő pozíciója az alapértelmezés. */
export type PhraseKey = 'next-stitch' | 'next-chain' | 'same-stitch' | 'same-chain' | 'next-space' | 'same-space' | 'ring' | 'chain-ring';

export interface Vocabulary {
  /** Angol jelölésnél a rendszer neve, amely a címsorokban mindig ott áll; magyarul nincs. */
  readonly system: string | null;
  readonly headings: { readonly abbreviations: string; readonly legend: string; readonly assembly: string; readonly sizes: string };
  readonly layer: { readonly row: (from: number, to: number) => string; readonly round: (from: number, to: number) => string };
  readonly foundation: (chains: number) => string;
  readonly ring: string;
  /** A láncgyűrű kezdősora a kúszószem rövidítésével (PQW-861). */
  readonly chainRing: (chains: number, slip: string) => string;
  /** Körben a szemszám: „(18)” (04 §5.9). */
  readonly roundCount: (n: number) => string;
  /** Körben az ismétlés: „(1 rp, szap.) ×6”; egyszavas tételnél zárójel nélkül: „szap. ×6”. */
  readonly roundRepeat: (inner: string, n: number) => string;
  /** Körben a kétszemes szaporítás rövid alakja és jelentése a rövidítéslistában. */
  readonly increase: { readonly abbr: string; readonly meaning: (part: string) => string };
  /** Spirálban a darab elején, egyszer: zárás nélkül, körjelölővel (04 §2). */
  readonly spiral: string;
  readonly colorChange: string;
  readonly jogFix: (fix: 'slip-stitch' | 'back-loop', slip: string) => string;
  /**
   * A láncalapra horgolt 1. sor eleje (PQW-895): „hagyj ki 2 láncszemet, majd ”. A kihagyott
   * láncszemek száma a horogtól számított első munkált láncszem sorszáma mínusz 1.
   */
  readonly skipChains: (n: number) => string;
  /** Az 1. sor, ha minden megmaradt láncszembe pontosan egy szem kerül: „minden láncszembe 1 rp”. */
  readonly eachChain: (item: string) => string;
  /** Az ovális 1. körében a láncszemek másik oldalára fordulás (PQW-890); utána kettőspont, a tételek vessző nélkül folytatódnak. */
  readonly otherSide: string;
  /** A PQW-895 előtti 1. sor eleje; csak a régi szövegek visszaolvasásához. */
  readonly fromHook: (chain: number, note: string | null) => string;
  /** A PQW-895 előtti megjegyzés a kihagyott láncszemekről: „1 erp-nek számítanak”; csak visszaolvasáshoz. */
  readonly skippedChainsCount: (def: StitchDef, locale: Locale) => string;
  readonly count: (n: number) => string;
  readonly chain: (n: number) => string;
  readonly skip: (n: number, what: 'stitch' | 'chain' | 'space') => string;
  readonly turningChain: (n: number, note: string) => string;
  readonly turningChainNotCounted: string;
  readonly turningChainCounts: (def: StitchDef, locale: Locale) => string;
  readonly repeat: (inner: string, n: number) => string;
  readonly quantity: (count: number, ref: string) => string;
  readonly decrease: (n: number, part: StitchDef, locale: Locale) => string;
  readonly phrases: Readonly<Record<PhraseKey, string>>;
  /**
   * A beszúrási mód a hivatkozáson (PQW-869): magyarul `(hsz)`/`(esz)` utótag, reliefnél
   * egyráhajtásos pálcán `Eerp`/`Herp`, máshol a mód neve; angolul `BLO`/`FLO` utótag,
   * reliefnél `FP`/`BP` előtag.
   */
  readonly mode: (mode: StitchInsertion, text: string) => string;
  /** Amiről az értelmezés felismeri a módot egy tételben. */
  readonly modeMarks: Readonly<Record<Exclude<StitchInsertion, 'both-loops'>, readonly string[]>>;
  readonly closings: { readonly turn: string; readonly 'fasten-off': string };
  readonly join: (slip: string, to: 'turning-chain' | 'first-stitch') => string;
  /** Nem szemnévből jövő rövidítések, ha a szövegben előfordulnak. */
  readonly general: readonly { readonly abbr: string; readonly meaning: string; readonly used: RegExp }[];
  /** A kör utáni jelölések mondata (PQW-863, 04 §5.6, §5.7, §9.8). */
  readonly marks: Readonly<Record<RoundMark, string>>;
  /** A folytatólagosan kapcsolt rész sora az első köre előtt. */
  readonly section: (name: string) => string;
  /**
   * Az elvágott fonal után újrakezdett szakasz sora (PQW-901): a neve és a
   * sor, amely fölött folytatódik. A visszaolvasó ebből tudja, hol folytassa.
   */
  readonly resumeSection: (name: string, row: number) => string;
  /** A korábbi sorba horgolt hosszú szem helye (mozaik, filé sor végi szaporítás, PQW-894). */
  readonly down: (depth: number) => string;
  /** Rácsos technikák (PQW-864): színek, kezdőszín, színváltás, a technika megjegyzése, színek soronként. */
  readonly colorwork: {
    readonly colors: (items: readonly { readonly letter: string; readonly name: string }[]) => string;
    readonly start: (letter: string) => string;
    /** Az előző szem utolsó ráhajtásánál (03 §6, §10 G35). */
    readonly change: (letter: string) => string;
    readonly note: Readonly<Partial<Record<GridTechnique, string>>>;
    readonly rowsHeading: (technique: GridTechnique) => string;
    readonly run: (count: number, letter: string) => string;
  };
  /** Az összevarrás sora az „Összeállítás” alatt (04 §5.4). */
  readonly sewing: (a: SewnEdge, b: SewnEdge, distributed: boolean) => string;
  /** A szegély köre a sorok után (PQW-862, 03 §7.1); a `prefix`-ről ismeri fel a visszaolvasó. */
  readonly border: {
    readonly prefix: string;
    readonly text: (parts: BorderParts) => string;
    /** Ferde élű darab, csúcs vagy ismétléshez igazított szegély (PQW-898). */
    readonly shaped: (parts: ShapedBorderParts) => string;
    /** Az igazítás ismétlése a szövegből; ha nincs benne, `null`. */
    readonly readRepeat: (text: string) => { readonly width: number; readonly edge: number } | null;
  };
}

/** A ferde élű vagy igazított szegély egy éle a szövegben (PQW-898). */
export interface ShapedBorderEdge {
  /** 2 sarok, vagy 1 a csúcsnál. */
  readonly corners: 1 | 2;
  /** A sarkok közötti szemek, pl. „28 rp”; ha nincs, `null`. */
  readonly stitches: string | null;
  /** Igazítás: +n szembe 2 szem, −n kihagyott szem. */
  readonly adjusted: number;
}

export interface ShapedBorderSide {
  readonly perRow: string;
  /** A lépcsők meghagyott szemeibe horgolt szemek; ha nincs, `null`. */
  readonly exposed: string | null;
  /** Az eggyel több (+) vagy kevesebb (−) szemet kapó sorvégek száma. */
  readonly adjusted: number;
  readonly total: string;
}

export interface ShapedBorderParts {
  readonly turning: string;
  readonly corner: string;
  /** Két szem egy szembe, pl. „2 rp”. */
  readonly double: string;
  readonly top: ShapedBorderEdge;
  readonly bottom: ShapedBorderEdge;
  readonly sides: readonly [ShapedBorderSide, ShapedBorderSide];
  readonly repeat: { readonly width: number; readonly edge: number } | null;
  readonly count: string;
  readonly join: string;
}

/**
 * Egy összevarrt szél a szövegben: a darab neve, a kör és a szemszáma; a sor
 * egy szakaszánál a szemek 1-től, sorvégeknél az utolsó sor és a szél, a
 * szemszám ilyenkor a sorok száma (PQW-866).
 */
export interface SewnEdge {
  readonly name: string;
  readonly layer: number;
  readonly count: number;
  /** A darab szakasza, ha a sorszám önmagában nem egyértelmű (két váll, PQW-901). */
  readonly section?: string;
  readonly stitches?: { readonly from: number; readonly to: number };
  readonly rows?: { readonly to: number; readonly side: 'left' | 'right' };
}

/** A szegély sorának kiírt részei, mennyiséggel együtt: „3 rp”, „(288 szem)”. */
export interface BorderParts {
  readonly turning: string;
  readonly corner: string;
  readonly top: string;
  readonly bottom: string;
  readonly perRow: string;
  readonly side: string;
  readonly count: string;
  readonly join: string;
}

const HU: Vocabulary = {
  system: null,
  headings: { abbreviations: 'Rövidítések', legend: 'Jelmagyarázat', assembly: 'Összeállítás', sizes: 'Méretek' },
  layer: {
    row: (from, to) => `${range(from, to)}. sor`,
    round: (from, to) => `${range(from, to)}. kör`,
  },
  foundation: (chains) => `Láncalap: ${chains} lsz.`,
  ring: 'Varázskör.',
  chainRing: (chains, slip) => `Láncgyűrű: ${chains} lsz, 1 ${slip}-szel gyűrűvé zárva.`,
  roundCount: (n) => `(${n})`,
  roundRepeat: (inner, n) => `${inner.includes(' ') ? `(${inner})` : inner} ×${n}`,
  increase: { abbr: 'szap.', meaning: (part) => `szaporítás (2 ${part} egy szembe)` },
  spiral: 'Spirálban, zárás nélkül: a kör első szemébe tegyél körjelölőt, és körönként vidd feljebb.',
  colorChange: 'Színváltás: a következő kör új színnel.',
  jogFix: (fix, slip) =>
    fix === 'slip-stitch'
      ? `Lépcsőjavítás: a következő kör első szeme helyett 1 ${slip}.`
      : 'Lépcsőjavítás: az új színt a következő kör első szemének hátsó szálába kapcsold be.',
  skipChains: (n) => `hagyj ki ${n} láncszemet, majd `,
  eachChain: (item) => `minden láncszembe ${item}`,
  otherSide: 'a láncszemek másik oldalán vissza:',
  fromHook: (chain, note) => `a horogtól számított ${chain}. láncszemtől kezdve${note ? ` (${note})` : ''} `,
  skippedChainsCount: (def, locale) => `a kihagyott láncszemek 1 ${huDative(def, locale)} számítanak`,
  count: (n) => `(${n} szem)`,
  chain: (n) => `${n} lsz`,
  skip: (n, what) => `${n} ${what === 'stitch' ? 'szem' : what === 'chain' ? 'láncszem' : 'láncív'} kihagyása`,
  turningChain: (n, note) => `${n} lsz (${note})`,
  turningChainNotCounted: 'nem számít szemnek',
  turningChainCounts: (def, locale) => `1 ${huDative(def, locale)} számít`,
  repeat: (inner, n) => `[${inner}] ${times(n)}`,
  quantity: (count, ref) => `${count} ${ref}`,
  decrease: (n, part, locale) => `${n} ${refOf(part, locale)} összehorgolása`,
  phrases: {
    'next-stitch': 'a következő szembe',
    'next-chain': 'a következő láncszembe',
    'same-stitch': 'ugyanabba a szembe',
    'same-chain': 'ugyanabba a láncszembe',
    'next-space': 'a következő láncívbe',
    'same-space': 'ugyanabba a láncívbe',
    ring: 'a varázskörbe',
    'chain-ring': 'a gyűrűbe',
  },
  mode: (mode, text) => {
    if (mode === 'both-loops') return text;
    // Az E- és H- előtag csak az egyráhajtásos pálcánál igazolt (szókészlet §3, [S38]); máshol a relief kiírva.
    const post = mode === 'front-post' || mode === 'back-post' ? /^(\d+ )?erp$/.exec(text) : null;
    if (post) return `${post[1] ?? ''}${mode === 'front-post' ? 'E' : 'H'}erp`;
    return `${text} (${HU_MODES[mode]})`;
  },
  modeMarks: {
    'back-loop': ['(hsz)'],
    'front-loop': ['(esz)'],
    'front-post': ['Eerp', '(első relief)'],
    'back-post': ['Herp', '(hátsó relief)'],
  },
  closings: { turn: 'Fordítás.', 'fasten-off': 'A fonal elvágása.' },
  join: (slip, to) => `Kör zárása: 1 ${slip} ${to === 'turning-chain' ? 'a kezdőlánc tetejébe' : 'az első szembe'}.`,
  general: [
    { abbr: 'Eerp', meaning: 'első relief egyráhajtásos pálca (elölről hurkolt)', used: /\bEerp\b/ },
    // Az „esz” nem szerepel a szókészletben (§3: nincs forrás); jóváhagyásra vár (PQW-869).
    { abbr: 'esz', meaning: 'első szálba', used: /\(esz\)/ },
    { abbr: 'Herp', meaning: 'hátsó relief egyráhajtásos pálca (hátulról hurkolt)', used: /\bHerp\b/ },
    { abbr: 'hsz', meaning: 'hátsó szálba', used: /\(hsz\)/ },
  ],
  // Új magyar mondatok, jóváhagyásra várnak (PQW-863).
  marks: {
    'safety-eyes': 'Tedd be a biztonsági szemeket.',
    'embroider-eyes': 'Hímezd ki a szemeket: 3 év alatti gyereknek szánt játékba nem kerülhet biztonsági szem.',
    stuffing: 'Kezdd el a tömést, és a nyílás bezárásáig tömd tovább.',
    'close-opening': 'A fonalat fűzd át a maradék szemek első szálán, és húzd össze a nyílást.',
  },
  section: (name) => `${name}, folytatólagosan:`,
  resumeSection: (name, row) => `${name} (${article(row)} ${row}. sor fölött):`,
  // Új magyar mondatok, jóváhagyásra várnak (PQW-864, PQW-894).
  down: (depth) => `${depth} sorral lejjebb`,
  colorwork: {
    colors: (items) => `Színek: ${items.map((item) => `${item.letter} – ${item.name}`).join(', ')}.`,
    start: (letter) => `Kezdés ${colorArticle(letter)} ${letter} színnel.`,
    change: (letter) => `(az utolsó ráhajtásnál válts ${colorArticle(letter)} ${letter} színre)`,
    note: {
      tapestry:
        'A nem használt színeket a szemekben vidd: a színoldali sorban a munka mögött, a visszai sorban előtte tartsd, hogy a szemek eltakarják.',
      graphgan: 'Színenként külön gombolyagot használj; a nem használt színt ne vidd a hátoldalon, mert átlátszik.',
      c2c: 'Csempe: 3 lsz és 3 erp. Színváltáskor az előző csempe utolsó pálcáját az új színnel fejezd be.',
      mosaic:
        'Mozaik: soronként egy szín. A más színű cellánál 1 lsz és 1 szem kihagyása; a lejjebb horgolt pálca a láncszem mögött a kihagyott szembe megy. A nem használt fonalat a sor szélén vidd fel.',
    },
    rowsHeading: (technique) =>
      technique === 'c2c' ? 'Színek csempénként, a haladási irányban:' : 'Színek szemenként, a haladási irányban:',
    run: (count, letter) => `${count} ${letter}`,
  },
  sewing: (a, b, distributed) => `Varrás: ${huSewnEdge(a)} → ${huSewnEdge(b)}${distributed ? ', a szemeket egyenletesen elosztva' : ''}.`,
  border: {
    prefix: 'Szegély: ',
    text: (p) =>
      `Szegély: ${p.turning}, felső él: ${p.corner} a sarokszembe, ${p.top}, ${p.corner} a sarokszembe; ` +
      `oldal: soronként ${p.perRow} a sor végére (${p.side}); ` +
      `alsó él: ${p.corner} a sarokba, ${p.bottom} a láncalap láncszemeibe, ${p.corner} a sarokba; ` +
      `másik oldal: soronként ${p.perRow} a sor végére (${p.side}) ${p.count}. ${p.join}`,
    shaped: (p) => {
      const adjust = (n: number) =>
        n > 0 ? ` (${n} szembe ${p.double}, egyenletesen elosztva)` : n < 0 ? ` (${-n} szem kihagyásával, egyenletesen elosztva)` : '';
      const top =
        p.top.corners === 1
          ? `${p.corner} a csúcsszembe`
          : [`${p.corner} a sarokszembe`, ...(p.top.stitches ? [`${p.top.stitches}${adjust(p.top.adjusted)}`] : []), `${p.corner} a sarokszembe`].join(', ');
      const bottom =
        p.bottom.corners === 1
          ? `${p.corner} a láncalap láncszemébe`
          : [
              `${p.corner} a sarokba`,
              ...(p.bottom.stitches ? [`${p.bottom.stitches}${adjust(p.bottom.adjusted)} a láncalap láncszemeibe`] : []),
              `${p.corner} a sarokba`,
            ].join(', ');
      const side = (s: ShapedBorderSide) =>
        `soronként ${s.perRow} a sor végére` +
        (s.exposed ? `, ${s.exposed} a lépcsők meghagyott szemeibe` : '') +
        (s.adjusted ? `, ${Math.abs(s.adjusted)} sorvégbe eggyel ${s.adjusted > 0 ? 'több' : 'kevesebb'}, egyenletesen elosztva` : '') +
        ` (${s.total})`;
      const repeat = p.repeat ? `, a következő sor ismétléséhez igazítva (élenként ${p.repeat.width} többszöröse + ${p.repeat.edge})` : '';
      return `Szegély: ${p.turning}, felső él: ${top}; oldal: ${side(p.sides[0])}; alsó él: ${bottom}; másik oldal: ${side(p.sides[1])}${repeat} ${p.count}. ${p.join}`;
    },
    readRepeat: (text) => {
      const match = /\(élenként (\d+) többszöröse \+ (\d+)\)/.exec(text);
      return match ? { width: Number(match[1]), edge: Number(match[2]) } : null;
    },
  },
};

/** A beszúrási módok a jóváhagyott szókészlet §3 szerint; az „esz” jóváhagyásra vár (PQW-869). */
const HU_MODES: Readonly<Record<Exclude<StitchInsertion, 'both-loops'>, string>> = {
  'back-loop': 'hsz',
  'front-loop': 'esz',
  'front-post': 'első relief',
  'back-post': 'hátsó relief',
};

function english(skipWord: string, skipVerb: string, skipMeaning: string, system: string, color: string): Vocabulary {
  return {
    // Az amerikai és a brit „dc” mást jelent, ezért a rendszer neve mindkét címsorban ott áll (PQW-868).
    system,
    headings: { abbreviations: `Abbreviations (${system})`, legend: `Stitch key (${system})`, assembly: 'Assembly', sizes: 'Sizes' },
    layer: {
      row: (from, to) => `${from === to ? 'Row' : 'Rows'} ${range(from, to)}`,
      round: (from, to) => `${from === to ? 'Rnd' : 'Rnds'} ${range(from, to)}`,
    },
    foundation: (chains) => `Foundation: ch ${chains}.`,
    ring: 'Magic ring.',
    chainRing: (chains, slip) => `Chain ring: ch ${chains}, join with ${slip} to form a ring.`,
    roundCount: (n) => `(${n})`,
    roundRepeat: (inner, n) => `${inner.includes(' ') ? `(${inner})` : inner} x${n}`,
    increase: { abbr: 'inc', meaning: (part) => `increase (2 ${part} in same st)` },
    spiral: 'Work in a continuous spiral; do not join. Place a marker in first st of rnd and move it up each rnd.',
    colorChange: `Change to new ${color} for next rnd.`,
    jogFix: (fix, slip) =>
      fix === 'slip-stitch' ? `Jog fix: work first st of next rnd as ${slip}.` : `Jog fix: join new ${color} in back loop of first st of next rnd.`,
    // Az 1. sor elején a kihagyás kiírt igével áll, ahogy a tulajdonos kérte: „skip 2 ch”, britül „miss 2 ch” (PQW-895).
    skipChains: (n) => `${skipVerb} ${n} ch, `,
    eachChain: (item) => `${item} in each ch across`,
    otherSide: 'working back along the other side of the chain:',
    fromHook: (chain, note) => `Starting in ${ordinal(chain)} ch from hook${note ? ` (${note})` : ''}, `,
    skippedChainsCount: (def, locale) => `skipped ch count as 1 ${refOf(def, locale)}`,
    count: (n) => `(${n} ${n === 1 ? 'st' : 'sts'})`,
    chain: (n) => `ch ${n}`,
    skip: (n, what) =>
      `${skipWord} ${n} ${what === 'stitch' ? (n === 1 ? 'st' : 'sts') : what === 'chain' ? 'ch' : n === 1 ? 'ch-sp' : 'ch-sps'}`,
    turningChain: (n, note) => `ch ${n} (${note})`,
    turningChainNotCounted: 'does not count as a st',
    turningChainCounts: (def, locale) => `counts as 1 ${refOf(def, locale)}`,
    repeat: (inner, n) => `[${inner}] ${n} times`,
    quantity: (count, ref) => (count === 1 ? ref : `${count} ${ref}`),
    decrease: (n, part, locale) => {
      const { name, abbr } = part.terms[locale];
      return abbr ? `${abbr}${n}tog` : `${n} ${name} together`;
    },
    phrases: {
      'next-stitch': 'in next st',
      'next-chain': 'in next ch',
      'same-stitch': 'in same st',
      'same-chain': 'in same ch',
      'next-space': 'in next ch-sp',
      'same-space': 'in same ch-sp',
      ring: 'in ring',
      'chain-ring': 'in ring',
    },
    mode: (mode, text) => {
      if (mode === 'back-loop') return `${text} BLO`;
      if (mode === 'front-loop') return `${text} FLO`;
      if (mode === 'front-post' || mode === 'back-post') return text.replace(/^(\d+ )?/, `$1${mode === 'front-post' ? 'FP' : 'BP'}`);
      return text;
    },
    modeMarks: { 'back-loop': ['BLO'], 'front-loop': ['FLO'], 'front-post': ['FP'], 'back-post': ['BP'] },
    closings: { turn: 'Turn.', 'fasten-off': 'Fasten off.' },
    join: (slip, to) => `Join with ${slip} to ${to === 'turning-chain' ? 'top of beg ch' : 'first st'}.`,
    general: [
      { abbr: 'beg', meaning: 'beginning', used: /\bbeg\b/ },
      { abbr: 'BLO', meaning: 'back loop only', used: /\bBLO\b/ },
      { abbr: 'BP', meaning: 'back post', used: /\bBP/ },
      { abbr: 'FLO', meaning: 'front loop only', used: /\bFLO\b/ },
      { abbr: 'FP', meaning: 'front post', used: /\bFP/ },
      { abbr: skipWord, meaning: skipMeaning, used: new RegExp(`\\b${skipWord}\\b`) },
      { abbr: 'st(s)', meaning: 'stitch(es)', used: /\bsts?\b/ },
      { abbr: 'tog', meaning: 'together', used: /\dtog\b/ },
      { abbr: 'yo', meaning: 'yarn over', used: /\byo\b/ },
    ],
    marks: {
      'safety-eyes': 'Insert safety eyes.',
      'embroider-eyes': 'Embroider the eyes: no safety eyes in toys for children under 3.',
      stuffing: 'Begin stuffing and keep stuffing until closed.',
      'close-opening': 'Weave the tail through the front loops of the remaining sts and pull tight.',
    },
    section: (name) => `${name}, worked continuously:`,
    resumeSection: (name, row) => `${name} (worked over row ${row}):`,
    down: (depth) => `in st ${depth} rows below`,
    colorwork: {
      colors: (items) => `Colors: ${items.map((item) => `${item.letter} – ${item.name}`).join(', ')}.`,
      start: (letter) => `Start with ${color} ${letter}.`,
      change: (letter) => `(change to ${letter} in last yo)`,
      note: {
        tapestry: 'Carry the unused colors inside the stitches: behind the work on RS rows, in front of it on WS rows.',
        graphgan: `Use a separate bobbin for each ${color} block; do not carry ${color}s across the back.`,
        c2c: `Tile: ch 3 and 3 dc. To change ${color}, finish the last dc of the previous tile with the new ${color}.`,
        mosaic: `Mosaic: one ${color} per row. For a cell of the other ${color}, ch 1 and skip 1 st; a dropped st goes into the skipped st behind the ch. Carry the unused yarn up the side.`,
      },
      rowsHeading: (technique) =>
        technique === 'c2c' ? `Tile ${color}s per row, in working order:` : `Stitch ${color}s per row, in working order:`,
      run: (count, letter) => `${count} ${letter}`,
    },
    sewing: (a, b, distributed) => `Sew: ${enSewnEdge(a)} to ${enSewnEdge(b)}${distributed ? ', easing sts evenly' : ''}.`,
    border: {
      prefix: 'Border: ',
      text: (p) =>
        `Border: ${p.turning}, top edge: ${p.corner} in corner st, ${p.top}, ${p.corner} in corner st; ` +
        `side: ${p.perRow} in each row end (${p.side}); ` +
        `bottom edge: ${p.corner} in corner, ${p.bottom} along foundation ch, ${p.corner} in corner; ` +
        `other side: ${p.perRow} in each row end (${p.side}) ${p.count}. ${p.join}`,
      shaped: (p) => {
        const skipping = `${skipVerb}${skipVerb.endsWith('p') ? 'ping' : 'ing'}`;
        const adjust = (n: number) => (n > 0 ? ` (${p.double} in ${n} of them, spaced evenly)` : n < 0 ? ` (${skipping} ${-n} sts, spaced evenly)` : '');
        const top =
          p.top.corners === 1
            ? `${p.corner} in top st`
            : [`${p.corner} in corner st`, ...(p.top.stitches ? [`${p.top.stitches}${adjust(p.top.adjusted)}`] : []), `${p.corner} in corner st`].join(', ');
        const bottom =
          p.bottom.corners === 1
            ? `${p.corner} in foundation ch`
            : [`${p.corner} in corner`, ...(p.bottom.stitches ? [`${p.bottom.stitches}${adjust(p.bottom.adjusted)} along foundation ch`] : []), `${p.corner} in corner`].join(
                ', ',
              );
        const side = (s: ShapedBorderSide) =>
          `${s.perRow} in each row end` +
          (s.exposed ? `, ${s.exposed} in unworked sts of the steps` : '') +
          (s.adjusted ? `, ${Math.abs(s.adjusted)} row ends with one ${s.adjusted > 0 ? 'more' : 'fewer'}, spaced evenly` : '') +
          ` (${s.total})`;
        const repeat = p.repeat ? `, adjusted for the next round's repeat (multiple of ${p.repeat.width} + ${p.repeat.edge} per edge)` : '';
        return `Border: ${p.turning}, top edge: ${top}; side: ${side(p.sides[0])}; bottom edge: ${bottom}; other side: ${side(p.sides[1])}${repeat} ${p.count}. ${p.join}`;
      },
      readRepeat: (text) => {
        const match = /\(multiple of (\d+) \+ (\d+) per edge\)/.exec(text);
        return match ? { width: Number(match[1]), edge: Number(match[2]) } : null;
      },
    },
  };
}

// A brit „miss” a 01 §3.1 szerint szerkesztői következtetés [E]; a brit kimenet még nincs jóváhagyva.
export const VOCABULARIES: Readonly<Record<Locale, Vocabulary>> = {
  hu: HU,
  'en-US': english('sk', 'skip', 'skip', 'US terms', 'color'),
  'en-GB': english('miss', 'miss', 'miss (skip)', 'UK terms', 'colour'),
};

function range(from: number, to: number): string {
  return from === to ? `${from}` : `${from}–${to}`;
}

/** „Hátrész, 1–30. sor bal széle (30 sorvég)”, „Hátrész, 46. sor 1–26. szeme (26)”, „Fej, 12. kör (36)”. */
function huSewnEdge(edge: SewnEdge): string {
  const where = `${edge.name}${edge.section === undefined ? '' : `, ${edge.section}`}`;
  if (edge.rows) return `${where}, ${range(edge.layer, edge.rows.to)}. sor ${edge.rows.side === 'left' ? 'bal' : 'jobb'} széle (${edge.count} sorvég)`;
  if (edge.stitches) return `${where}, ${edge.layer}. sor ${range(edge.stitches.from, edge.stitches.to)}. szeme (${edge.count})`;
  return `${where}, ${edge.layer}. kör (${edge.count})`;
}

function enSewnEdge(edge: SewnEdge): string {
  const where = `${edge.name}${edge.section === undefined ? '' : `, ${edge.section}`}`;
  if (edge.rows) return `${where}, ${edge.layer === edge.rows.to ? 'Row' : 'Rows'} ${range(edge.layer, edge.rows.to)}, ${edge.rows.side} edge (${edge.count} row ends)`;
  if (edge.stitches) return `${where}, Row ${edge.layer}, sts ${range(edge.stitches.from, edge.stitches.to)} (${edge.count})`;
  return `${where}, Rnd ${edge.layer} (${edge.count})`;
}

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/* ---- Szemnevek ---- */

/**
 * A kiírt beszúrási mód: a szem egyetlen megengedett módja nem kerül ki, mert a
 * szem neve már tartalmazza, pl. a láthatatlan fogyasztás az első szálakba (PQW-863).
 */
export function shownMode(def: StitchDef, mode: StitchInsertion): StitchInsertion {
  return def.insertionModes.length === 1 && def.insertionModes[0] === mode ? 'both-loops' : mode;
}

/** Hivatkozás egy szemre a szövegben: a rövidítés, ha van, különben a név. */
export function refOf(def: StitchDef, locale: Locale): string {
  const { name, abbr } = def.terms[locale];
  return abbr ?? name;
}

export function isIncrease(def: StitchDef): boolean {
  return def.kind === 'group' && def.terms['en-US'].name === 'increase';
}

export function isDecrease(def: StitchDef): boolean {
  return def.kind === 'joined' && def.terms['en-US'].name === 'decrease';
}

function huDative(def: StitchDef, locale: Locale): string {
  const { name, abbr } = def.terms[locale];
  return abbr ? dative(abbr, true) : dative(name, false);
}

/**
 * Egy összetett szem neve a sorban. Ha a könyvtárban több szemnek is ez a
 * neve (pl. a kétféle fürt), a szerkezet zárójelben mellette áll, hogy a
 * visszaolvasás egyértelmű legyen.
 */
export function itemName(def: StitchDef, locale: Locale, library: StitchLibrary): string {
  const ref = refOf(def, locale);
  const clash = [...library.values()].some(
    (other) => other.id !== def.id && !isIncrease(other) && !isDecrease(other) && refOf(other, locale) === ref,
  );
  const structure = clash ? stitchStructure(def, locale) : null;
  return structure ? `${ref} (${structure})` : ref;
}

/* ---- A minta szövege ---- */

export interface Abbreviation {
  readonly abbr: string;
  readonly meaning: string;
}

export interface LegendEntry {
  readonly def: StitchDefId;
  /** „szaporítás: 2 erp egy szembe”. A jelet a felület rajzolja az azonosító alapján. */
  readonly label: string;
}

export interface WrittenPatternText {
  readonly locale: Locale;
  readonly title: string;
  readonly abbreviations: readonly Abbreviation[];
  readonly legend: readonly LegendEntry[];
  readonly pieces: readonly { readonly name: string; readonly lines: readonly string[] }[];
  /** Az összevarrások sorai (PQW-863); a folytatólagos kapcsolás a darab sorai között áll. */
  readonly assembly: readonly string[];
  /** A ruhadarab méretsorozata „S (M, L)” alakban (PQW-866); más mintában üres. */
  readonly sizes: readonly string[];
}

/** Az írott minta: rövidítéslista, jelmagyarázat és darabonként a sorok. */
export function writePattern(pattern: Pattern, library: StitchLibrary, locale: Locale): WrittenPatternText {
  const vocabulary = VOCABULARIES[locale];
  const used = new Map<string, StitchDef>();
  const written = writtenPieces(pattern, library);
  const shortIncrease = shortIncreaseOf(written, library);
  const renderer = new Renderer(library, locale, used, shortIncrease);
  const pieces = written.map((piece) => ({ name: piece.name, lines: renderer.piece(piece) }));
  const edge = ({ piece: id, layer, stitches, rows }: JoinEdge): SewnEdge => {
    const index = pattern.pieces.findIndex((piece) => piece.id === id);
    const name = pattern.pieces[index]?.name ?? id;
    const written_ = written[index];
    // A varrás a kiírt sorszámot mondja; az újrakezdett szakaszban ez nem a réteg sorszáma, ezért a szakasz neve is kell (PQW-901).
    const rowOf = (at: number) => written_?.layers.find((candidate) => candidate.index === at)?.row ?? at;
    // A szakasz neve csak akkor kell, ha a sorszám önmagában nem egyértelmű: két szakasz ugyanazzal a számmal (PQW-901).
    const ambiguous = written_?.layers.some((candidate) => candidate.index !== layer && candidate.row === rowOf(layer)) === true;
    const sections = (written_?.sections ?? []).filter((section) => section.layer <= layer);
    const section = ambiguous && sections.length > 0 ? sections[sections.length - 1]!.name : undefined;
    const named = section === undefined ? {} : { section };
    if (stitches) {
      return { name, layer: rowOf(layer), count: stitches.count, ...named, stitches: { from: stitches.from + 1, to: stitches.from + stitches.count } };
    }
    if (rows) return { name, layer: rowOf(layer), count: rows.to - layer + 1, ...named, rows: { to: rowOf(rows.to), side: rows.side } };
    return { name, layer: rowOf(layer), count: written_?.layers.find((candidate) => candidate.index === layer)?.stitchCount ?? 0, ...named };
  };
  const assembly = (pattern.joins ?? []).map((join) => vocabulary.sewing(edge(join.a), edge(join.b), join.distribution !== undefined));

  const text = pieces.flatMap((piece) => piece.lines).join('\n');
  const abbreviations = new Map<string, string>();
  for (const def of used.values()) {
    const { name, abbr } = def.terms[locale];
    if (abbr) abbreviations.set(abbr, name);
  }
  const shortDef = shortIncrease === null ? undefined : library.get(shortIncrease);
  const increasePart = renderer.shortIncreaseUsed && shortDef?.kind === 'group' ? library.get(shortDef.members[0]!) : undefined;
  if (increasePart) abbreviations.set(vocabulary.increase.abbr, vocabulary.increase.meaning(refOf(increasePart, locale)));
  for (const { abbr, meaning, used: pattern } of vocabulary.general) if (pattern.test(text)) abbreviations.set(abbr, meaning);

  return {
    locale,
    title: pattern.title,
    abbreviations: [...abbreviations]
      .map(([abbr, meaning]) => ({ abbr, meaning }))
      .sort((a, b) => a.abbr.localeCompare(b.abbr, locale, { sensitivity: 'base' })),
    legend: legendOf(pattern, library, locale),
    pieces,
    assembly,
    sizes: pattern.garment ? sizingLines(pattern.garment, locale) : [],
  };
}

/** A teljes szöveg: cím, rövidítések, jelmagyarázat, darabok, üres sorral elválasztva. */
export function formatWrittenPattern(written: WrittenPatternText): string {
  const { headings } = VOCABULARIES[written.locale];
  const blocks: string[][] = [[written.title]];
  // A méretek a cím után állnak (05 §8.1).
  if (written.sizes.length > 0) blocks.push([headings.sizes, ...written.sizes]);
  if (written.abbreviations.length > 0) {
    blocks.push([headings.abbreviations, ...written.abbreviations.map(({ abbr, meaning }) => `${abbr} – ${meaning}`)]);
  }
  if (written.legend.length > 0) blocks.push([headings.legend, ...written.legend.map((entry) => entry.label)]);
  for (const piece of written.pieces) blocks.push([piece.name, ...piece.lines]);
  if (written.assembly.length > 0) blocks.push([headings.assembly, ...written.assembly]);
  return `${blocks.map((block) => block.join('\n')).join('\n\n')}\n`;
}

/** A mintában használt szemek a könyvtár sorrendjében: önálló szemek, csoportok, és a láncív, ha horgolnak bele. */
export function legendOf(pattern: Pattern, library: StitchLibrary, locale: Locale): LegendEntry[] {
  const ids = new Set<StitchDefId>();
  for (const piece of pattern.pieces) {
    const members = new Set(piece.groups.flatMap((group) => group.members));
    for (const node of piece.stitches) if (!members.has(node.id)) ids.add(node.def);
    for (const group of piece.groups) ids.add(group.def);
    if (piece.stitches.some((node) => node.anchors.some((anchor) => anchor.into === 'space'))) {
      for (const def of library.values()) if (def.kind === 'space') ids.add(def.id);
    }
  }
  return [...library.values()].filter((def) => ids.has(def.id)).map((def) => ({ def: def.id, label: legendLabel(def, library, locale) }));
}

/** A fogyasztás a jelmagyarázatban ugyanúgy szerepel, mint a sorokban, hogy egy mintán belül egy kifejezés legyen. */
function legendLabel(def: StitchDef, library: StitchLibrary, locale: Locale): string {
  if (locale !== 'hu' || def.kind !== 'joined' || !isDecrease(def)) return stitchLabel(def, locale);
  const part = library.get(def.part);
  return part ? `${def.terms.hu.name}: ${VOCABULARIES.hu.decrease(def.parts, part, locale)}` : stitchLabel(def, locale);
}

/**
 * A körökben „szap.” rövid alakkal írható szaporítás: ha a körökben egyetlen
 * fajta kétszemes szaporítás szerepel, különben `null`, és a szaporítás
 * kiírva áll (04 §5.9).
 */
export function shortIncreaseOf(pieces: readonly WrittenPiece[], library: StitchLibrary): StitchDefId | null {
  const ids = new Set<StitchDefId>();
  const visit = (steps: readonly Step[]) => {
    for (const step of steps) {
      if (step.kind === 'repeat') visit(step.steps);
      if (step.kind !== 'group') continue;
      const def = library.get(step.def);
      if (def?.kind === 'group' && isIncrease(def) && def.members.length === 2) ids.add(def.id);
    }
  };
  for (const piece of pieces) for (const layer of piece.layers) if (layer.shape === 'round') visit(layer.steps);
  return ids.size === 1 ? [...ids][0]! : null;
}

/** Hol áll a tétel: körben a rövidebb alak, és a „szap.” jelentése (04 §5.9). */
export interface StepContext {
  readonly round?: boolean;
  readonly shortIncrease?: StitchDefId | null;
}

/** Egyetlen lépés szövege; a visszaolvasó ezzel ellenőrzi, hogy egy tételt pontosan így írnánk-e ki. */
export function renderStep(step: Step, library: StitchLibrary, locale: Locale, context: StepContext = {}): string {
  const renderer = new Renderer(library, locale, new Map(), context.shortIncrease ?? null);
  renderer.round = context.round === true;
  return renderer.step(step);
}

/** A szegély sora; a visszaolvasó ezzel ellenőrzi, hogy a szegélyt pontosan így írnánk-e ki (PQW-862). */
export function renderBorder(border: WrittenBorder, library: StitchLibrary, locale: Locale): string {
  return new Renderer(library, locale, new Map()).border(border);
}

class Renderer {
  private readonly library: StitchLibrary;
  private readonly locale: Locale;
  private readonly vocabulary: Vocabulary;
  private readonly used: Map<string, StitchDef>;
  private readonly shortIncrease: StitchDefId | null;
  /** Körben a rövidebb alak: „(1 rp, szap.) ×6 (18)” (04 §5.9). */
  round = false;
  /** Szerepelt-e a „szap.”, hogy a rövidítéslistába kerüljön. */
  shortIncreaseUsed = false;

  constructor(library: StitchLibrary, locale: Locale, used: Map<string, StitchDef>, shortIncrease: StitchDefId | null = null) {
    this.library = library;
    this.locale = locale;
    this.vocabulary = VOCABULARIES[locale];
    this.used = used;
    this.shortIncrease = shortIncrease;
  }

  piece(piece: WrittenPiece): string[] {
    const v = this.vocabulary;
    let start: string;
    if (piece.foundation.kind === 'chain') {
      this.use(this.byKind('chain'));
      start = v.foundation(piece.foundation.count);
    } else if (piece.foundation.kind === 'chain-ring') {
      const slip = this.byKind('slip');
      this.use(this.byKind('chain'));
      this.use(slip);
      start = v.chainRing(piece.foundation.count, refOf(slip, this.locale));
    } else start = v.ring;
    const lines = [start];
    if (piece.layers.some((layer) => layer.closing === 'spiral')) lines.push(v.spiral);
    const { colorwork } = piece;
    if (colorwork) {
      lines.push(v.colorwork.colors(colorwork.colors.map((color, i) => ({ letter: colorLetter(i), name: color.name }))));
      lines.push(v.colorwork.start(colorLetter(colorwork.startColor)));
      const note = v.colorwork.note[colorwork.technique];
      if (note) lines.push(note);
    }

    const bodies = piece.layers.map((layer) => this.body(layer));
    // A folytatólagosan kapcsolt rész neve az első köre előtt; ott az azonos körök összevonása is megszakad.
    const sections = new Map(piece.sections.filter((section) => section.layer > 1).map((section) => [section.layer, section]));
    for (let i = 0; i < piece.layers.length; ) {
      let j = i;
      while (
        j + 1 < piece.layers.length &&
        bodies[j + 1] === bodies[i] &&
        piece.layers[j + 1]!.shape === piece.layers[i]!.shape &&
        !sections.has(piece.layers[j + 1]!.index)
      ) {
        j += 1;
      }
      const { shape, index, row } = piece.layers[i]!;
      const section = sections.get(index);
      // Az újrakezdett szakasz neve megmondja, melyik sor fölött folytatódik (PQW-901).
      if (section !== undefined) lines.push(section.over === undefined ? v.section(section.name) : v.resumeSection(section.name, section.over));
      const label = shape === 'row' ? v.layer.row(row, piece.layers[j]!.row) : v.layer.round(row, piece.layers[j]!.row);
      lines.push(`${label}: ${bodies[i]}`);
      i = j + 1;
    }
    if (colorwork && colorwork.rows.length > 0) {
      lines.push(v.colorwork.rowsHeading(colorwork.technique));
      colorwork.rows.forEach((runs, i) => {
        lines.push(`${v.layer.row(i + 1, i + 1)}: ${runs.map((run) => v.colorwork.run(run.count, colorLetter(run.color))).join(', ')}`);
      });
    }
    if (piece.border) lines.push(this.border(piece.border));
    return lines;
  }

  /** A szegély köre: sarkonként 3 szem, a felső élen szemenként, az oldalon sorvégenként, a láncalap mentén láncszemenként (03 §7.1). */
  border({ stitch, counts }: WrittenBorder): string {
    const v = this.vocabulary;
    const def = this.def(stitch);
    const slip = this.byKind('slip');
    for (const used of [def, this.byKind('chain'), slip]) this.use(used);
    const quantity = (n: number) => v.quantity(n, refOf(def, this.locale));
    const [first, second] = counts.sides;
    // A téglalap szövege változatlan; a sarkok közötti szem nélküli él (csúcs, két szemes él) a ferde élű szöveget kapja.
    const regular =
      counts.topCorners === 2 &&
      counts.bottomCorners === 2 &&
      counts.top > 0 &&
      counts.bottom > 0 &&
      counts.repeat === null &&
      counts.sides.every((side) => side.exposed === 0 && side.adjusted === 0) &&
      first.total === second.total;
    if (!regular) {
      // Ferde élű darab, csúcs vagy ismétléshez igazított szegély (PQW-898).
      const edge = (corners: 1 | 2, stitches: number, adjusted: number) => ({ corners, stitches: stitches > 0 ? quantity(stitches) : null, adjusted });
      const side = (s: (typeof counts.sides)[number]) => ({
        perRow: quantity(counts.perRow),
        exposed: s.exposed > 0 ? quantity(s.exposed) : null,
        adjusted: s.adjusted,
        total: quantity(s.total),
      });
      return v.border.shaped({
        turning: v.turningChain(def.turningChain, v.turningChainNotCounted),
        corner: quantity(counts.corner),
        double: quantity(2),
        top: edge(counts.topCorners, counts.top, counts.topAdjusted),
        bottom: edge(counts.bottomCorners, counts.bottom, counts.bottomAdjusted),
        sides: [side(first), side(second)],
        repeat: counts.repeat,
        count: v.count(counts.total),
        join: v.join(refOf(slip, this.locale), 'first-stitch'),
      });
    }
    return v.border.text({
      turning: v.turningChain(def.turningChain, v.turningChainNotCounted),
      corner: quantity(counts.corner),
      top: quantity(counts.top),
      bottom: quantity(counts.bottom),
      perRow: quantity(counts.perRow),
      side: quantity(counts.side),
      count: v.count(counts.total),
      join: v.join(refOf(slip, this.locale), 'first-stitch'),
    });
  }

  /** Egy sor a címke nélkül: „15 fp (15 szem). Fordítás.” */
  body(layer: WrittenLayer): string {
    const v = this.vocabulary;
    this.round = layer.shape === 'round';
    let prefix = '';
    let items: string;
    // A láncalapra horgolt 1. sor: „hagyj ki 2 láncszemet, majd minden láncszembe 1 rp” (PQW-895).
    // A kihagyott láncszemek számításáról nincs megjegyzés; a későbbi sorok fordulólánca mondja meg.
    const [only] = layer.steps;
    if (layer.fromHook) {
      const skipped = layer.fromHook.chain - 1;
      if (skipped > 0) {
        this.use(this.byKind('chain'));
        prefix = v.skipChains(skipped);
      }
    }
    if (layer.fromHook?.eachChain && only?.kind === 'stitch') items = v.eachChain(this.step({ ...only, count: 1 }));
    else items = this.steps(layer.steps);
    let text = `${prefix}${items} ${this.round ? v.roundCount(layer.stitchCount) : v.count(layer.stitchCount)}.`;
    const slip = this.byKind('slip');
    if (layer.closing === 'join-slip') {
      this.use(slip);
      text += ` ${v.join(refOf(slip, this.locale), layer.joinTo!)}`;
    } else if (layer.closing === 'turn' || layer.closing === 'fasten-off') {
      // A spirál a darab elején egyszer szerepel (`Vocabulary.spiral`), körönként nincs kiírva.
      text += ` ${v.closings[layer.closing]}`;
    }
    if (layer.colorChange) text += ` ${v.colorChange}`;
    if (layer.jogFix) {
      if (layer.jogFix === 'slip-stitch') this.use(slip);
      text += ` ${v.jogFix(layer.jogFix, refOf(slip, this.locale))}`;
    }
    for (const mark of layer.marks) text += ` ${v.marks[mark]}`;
    return text;
  }

  steps(steps: readonly Step[]): string {
    // A „másik oldal” mondata kettősponttal végződik: utána vessző nélkül folytatódik (PQW-890).
    return steps.map((step, i) => `${i === 0 ? '' : steps[i - 1]!.kind === 'other-side' ? ' ' : ', '}${this.step(step)}`).join('');
  }

  step(step: Step): string {
    const text = this.stepText(step);
    return 'changeTo' in step && step.changeTo !== undefined ? `${text} ${this.vocabulary.colorwork.change(colorLetter(step.changeTo))}` : text;
  }

  private stepText(step: Step): string {
    const v = this.vocabulary;
    switch (step.kind) {
      case 'chain':
        this.use(this.byKind('chain'));
        return v.chain(step.count);
      case 'skip':
        if (step.what === 'chain') this.use(this.byKind('chain'));
        if (step.what === 'space') this.use(this.byKind('space'));
        return v.skip(step.count, step.what);
      case 'turning-chain': {
        this.use(this.byKind('chain'));
        const counts = step.countsAs === null ? null : this.def(step.countsAs);
        if (counts) this.use(counts);
        return v.turningChain(step.count, counts ? v.turningChainCounts(counts, this.locale) : v.turningChainNotCounted);
      }
      case 'other-side':
        return v.otherSide;
      case 'repeat':
        return this.round ? v.roundRepeat(this.steps(step.steps), step.times) : v.repeat(this.steps(step.steps), step.times);
      case 'stitch': {
        const def = this.def(step.def);
        let text: string;
        if (isDecrease(def) && def.kind === 'joined') {
          const part = this.def(def.part);
          this.use(part);
          text = v.decrease(def.parts, part, this.locale);
        } else if (def.kind === 'basic' || def.kind === 'slip') {
          this.use(def);
          text = v.quantity(step.count, refOf(def, this.locale));
        } else {
          this.use(def);
          text = itemName(def, this.locale, this.library);
        }
        const place = step.target === 'down' ? ` ${v.down(step.depth ?? 2)}` : this.phrase(step.target, step.into, false);
        return `${v.mode(shownMode(def, step.mode), text)}${place}`;
      }
      case 'group': {
        const def = this.def(step.def);
        if (isIncrease(def) && def.kind === 'group') {
          const part = this.def(def.members[0]!);
          this.use(part);
          if (this.round && def.id === this.shortIncrease && step.target === 'next') {
            this.shortIncreaseUsed = true;
            return v.mode(step.mode, v.increase.abbr);
          }
          const text = v.quantity(def.members.length, refOf(part, this.locale));
          return `${v.mode(step.mode, text)}${this.phrase(step.target, step.into, true)}`;
        }
        this.use(def);
        return `${v.mode(step.mode, itemName(def, this.locale, this.library))}${this.phrase(step.target, step.into, false)}`;
      }
    }
  }

  private phrase(target: StepTarget, into: 'stitch' | 'chain', explicitNext: boolean): string {
    const { phrases } = this.vocabulary;
    switch (target) {
      case 'none':
      case 'down':
        return '';
      case 'next':
        return explicitNext ? ` ${phrases[into === 'chain' ? 'next-chain' : 'next-stitch']}` : '';
      case 'same':
        return ` ${phrases[into === 'chain' ? 'same-chain' : 'same-stitch']}`;
      case 'ring':
        // A varázskör neve kiírva szerepel („a varázskörbe”, „in ring”), rövidítése nem kerül a listára.
        return ` ${phrases.ring}`;
      case 'chain-ring':
        return ` ${phrases['chain-ring']}`;
      default:
        this.use(this.byKind('space'));
        return ` ${phrases[target]}`;
    }
  }

  private def(id: StitchDefId): StitchDef {
    const def = this.library.get(id);
    if (!def) throw new Error(`Ismeretlen szem: ${id}`);
    return def;
  }

  private byKind(kind: StitchDef['kind']): StitchDef {
    const def = [...this.library.values()].find((candidate) => candidate.kind === kind);
    if (!def) throw new Error(`A könyvtárban nincs ilyen fajtájú szem: ${kind}`);
    return def;
  }

  private use(def: StitchDef): void {
    this.used.set(def.id, def);
  }
}
