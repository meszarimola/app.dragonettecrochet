// KB: 01 §8.5, 04 §5.9, 04 §9.8, 06 §5.3

import { sizingLines } from './garment-text.ts';
import { article, dative, times } from './hungarian.ts';
import { type Step, type StepTarget, type WrittenLayer, type WrittenPiece, writtenPieces } from './pattern-steps.ts';
import { colorLetter } from './pixel-chart.ts';
import type { StitchLibrary } from './stitch-library.ts';
import { stitchLabel, stitchStructure } from './stitchText.ts';
import type {
  GridTechnique,
  JoinEdge,
  Locale,
  Pattern,
  RoundMark,
  StitchDef,
  StitchDefId,
  StitchInsertion,
} from './types.ts';

/** KB: core-domain §3 */
const colorArticle = (letter: string) => ('AEF'.includes(letter) ? 'az' : 'a');

/** `next` is written only for an increase; elsewhere the cursor's next position is the default. */
export type PhraseKey =
  | 'next-stitch'
  | 'next-chain'
  | 'same-stitch'
  | 'same-chain'
  | 'next-space'
  | 'same-space'
  | 'ring'
  | 'chain-ring';

export interface Vocabulary {
  /** The system name that always stands in the English headings; Hungarian has none. */
  readonly system: string | null;
  readonly headings: {
    readonly abbreviations: string;
    readonly legend: string;
    readonly assembly: string;
    readonly sizes: string;
  };
  readonly layer: {
    readonly row: (from: number, to: number) => string;
    readonly round: (from: number, to: number) => string;
  };
  readonly foundation: (chains: number) => string;
  readonly ring: string;
  readonly chainRing: (chains: number, slip: string) => string;
  /** KB: 04 §5.9 */
  readonly roundCount: (n: number) => string;
  /** KB: 04 §5.9 */
  readonly roundRepeat: (inner: string, n: number) => string;
  readonly increase: { readonly abbr: string; readonly meaning: (part: string) => string };
  /** KB: 04 §2 */
  readonly spiral: string;
  readonly colorChange: string;
  readonly jogFix: (fix: 'slip-stitch' | 'back-loop', slip: string) => string;
  /** The number of skipped chains is the index of the first worked chain from the hook, minus 1. KB: 03 §1.2 */
  readonly skipChains: (n: number) => string;
  readonly eachChain: (item: string) => string;
  /** Followed by a colon; the items continue after it without a comma. KB: 04 §3.4 */
  readonly otherSide: string;
  /** Kept only for reading back older texts. KB: core-domain §11 */
  readonly fromHook: (chain: number, note: string | null) => string;
  /** Kept only for reading back older texts. KB: core-domain §11 */
  readonly skippedChainsCount: (def: StitchDef, locale: Locale) => string;
  /** An older text is refused, not silently reinterpreted. KB: core-domain §5 */
  readonly legacyTurningChain: string;
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
  /** KB: 01 §4.3 */
  readonly mode: (mode: StitchInsertion, text: string) => string;
  readonly modeMarks: Readonly<Record<Exclude<StitchInsertion, 'both-loops'>, readonly string[]>>;
  readonly closings: { readonly turn: string; readonly 'fasten-off': string };
  readonly join: (slip: string, to: 'turning-chain' | 'first-stitch') => string;
  readonly general: readonly { readonly abbr: string; readonly meaning: string; readonly used: RegExp }[];
  /** KB: 04 §5.6, 04 §5.7, 04 §9.8 */
  readonly marks: Readonly<Record<RoundMark, string>>;
  readonly section: (name: string) => string;
  /** The reader uses this to know where to resume. KB: core-domain §12 */
  readonly resumeSection: (name: string, row: number) => string;
  /** KB: 03 §5.6 */
  readonly down: (depth: number) => string;
  readonly colorwork: {
    readonly colors: (items: readonly { readonly letter: string; readonly name: string }[]) => string;
    /** A name the user typed is not translated. */
    readonly colorNames: Readonly<Record<string, string>>;
    readonly start: (letter: string) => string;
    /** KB: 03 §6, 03 §10 G35 */
    readonly change: (letter: string) => string;
    readonly note: Readonly<Partial<Record<GridTechnique, string>>>;
    readonly rowsHeading: (technique: GridTechnique) => string;
    readonly run: (count: number, letter: string) => string;
  };
  /** KB: 04 §5.4 */
  readonly sewing: (a: SewnEdge, b: SewnEdge, distributed: boolean) => string;
}

/** For row ends the stitch count is the number of rows. KB: 04 §5.4 */
export interface SewnEdge {
  readonly name: string;
  readonly layer: number;
  readonly count: number;
  /** Needed when the row number alone is ambiguous (two shoulders). KB: core-domain §12 */
  readonly section?: string;
  readonly stitches?: { readonly from: number; readonly to: number };
  readonly rows?: { readonly to: number; readonly side: 'left' | 'right' };
}

const HU: Vocabulary = {
  system: null,
  headings: { abbreviations: 'Rövidítések', legend: 'Jelmagyarázat', assembly: 'Összeállítás', sizes: 'Méretek' },
  layer: {
    // KB: core-domain §22
    row: (from, to) => `${range(from + 1, to + 1)}. sor`,
    // In rounds the numbering is unchanged.
    round: (from, to) => `${range(from, to)}. kör`,
  },
  foundation: (chains) => `1. sor – alapsor: ${chains} lsz.`,
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
  legacyTurningChain:
    'Ez a sor a korábbi szabály szerint készült: a sor eleji láncszemeket szemnek számolja, amit ez a verzió már nem ismer. Írd át a sort a mai alakra („hagyj ki 2 láncszemet, majd …”), vagy generáld újra a mintát.',
  count: (n) => `(${n} szem)`,
  chain: (n) => `${n} lsz`,
  skip: (n, what) => `${n} ${what === 'stitch' ? 'szem' : what === 'chain' ? 'láncszem' : 'láncív'} kihagyása`,
  turningChain: (n, note) => `${n} lsz (${note})`,
  // KB: core-domain §5
  turningChainNotCounted: 'fordulólánc',
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
    // The E- and H- prefix is only attested for double crochet; elsewhere the post stitch is spelled out. KB: 01 §4.3
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
    // KB: core-domain §23
    { abbr: 'esz', meaning: 'első szálba', used: /\(esz\)/ },
    { abbr: 'Herp', meaning: 'hátsó relief egyráhajtásos pálca (hátulról hurkolt)', used: /\bHerp\b/ },
    { abbr: 'hsz', meaning: 'hátsó szálba', used: /\(hsz\)/ },
  ],
  // KB: core-domain §23
  marks: {
    'safety-eyes': 'Tedd be a biztonsági szemeket.',
    'embroider-eyes': 'Hímezd ki a szemeket: 3 év alatti gyereknek szánt játékba nem kerülhet biztonsági szem.',
    stuffing: 'Kezdd el a tömést, és a nyílás bezárásáig tömd tovább.',
    'close-opening': 'A fonalat fűzd át a maradék szemek első szálán, és húzd össze a nyílást.',
  },
  section: (name) => `${name}, folytatólagosan:`,
  // KB: core-domain §22
  resumeSection: (name, row) => `${name} (${article(row + 1)} ${row + 1}. sor fölött):`,
  // KB: core-domain §23
  down: (depth) => `${depth} sorral lejjebb`,
  colorwork: {
    colors: (items) => `Színek: ${items.map((item) => `${item.letter} – ${item.name}`).join(', ')}.`,
    colorNames: {
      natural: 'Natúr',
      burgundy: 'Bordó',
      blue: 'Kék',
      green: 'Zöld',
      mustard: 'Mustár',
      black: 'Fekete',
      rose: 'Rózsa',
      brown: 'Barna',
    },
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
  sewing: (a, b, distributed) =>
    `Varrás: ${huSewnEdge(a)} → ${huSewnEdge(b)}${distributed ? ', a szemeket egyenletesen elosztva' : ''}.`,
};

/** KB: core-domain §23 */
const HU_MODES: Readonly<Record<Exclude<StitchInsertion, 'both-loops'>, string>> = {
  'back-loop': 'hsz',
  'front-loop': 'esz',
  'front-post': 'első relief',
  'back-post': 'hátsó relief',
};

function english(skipWord: string, skipVerb: string, skipMeaning: string, system: string, color: string): Vocabulary {
  return {
    // US and UK "dc" mean different stitches, so the system name stands in both headings.
    system,
    headings: {
      abbreviations: `Abbreviations (${system})`,
      legend: `Stitch key (${system})`,
      assembly: 'Assembly',
      sizes: 'Sizes',
    },
    layer: {
      // KB: core-domain §22
      row: (from, to) => `${from === to ? 'Row' : 'Rows'} ${range(from + 1, to + 1)}`,
      // In rounds the numbering is unchanged.
      round: (from, to) => `${from === to ? 'Rnd' : 'Rnds'} ${range(from, to)}`,
    },
    foundation: (chains) => `Row 1 – foundation: ch ${chains}.`,
    ring: 'Magic ring.',
    chainRing: (chains, slip) => `Chain ring: ch ${chains}, join with ${slip} to form a ring.`,
    roundCount: (n) => `(${n})`,
    roundRepeat: (inner, n) => `${inner.includes(' ') ? `(${inner})` : inner} x${n}`,
    increase: { abbr: 'inc', meaning: (part) => `increase (2 ${part} in same st)` },
    spiral: 'Work in a continuous spiral; do not join. Place a marker in first st of rnd and move it up each rnd.',
    colorChange: `Change to new ${color} for next rnd.`,
    jogFix: (fix, slip) =>
      fix === 'slip-stitch'
        ? `Jog fix: work first st of next rnd as ${slip}.`
        : `Jog fix: join new ${color} in back loop of first st of next rnd.`,
    // KB: core-domain §23 — the owner asked for the skip to be spelled out as a verb.
    skipChains: (n) => `${skipVerb} ${n} ch, `,
    eachChain: (item) => `${item} in each ch across`,
    otherSide: 'working back along the other side of the chain:',
    fromHook: (chain, note) => `Starting in ${ordinal(chain)} ch from hook${note ? ` (${note})` : ''}, `,
    skippedChainsCount: (def, locale) => `skipped ch count as 1 ${refOf(def, locale)}`,
    legacyTurningChain:
      'This row was written under the earlier rule, where the chains at the start of a row counted as a stitch; this version no longer reads that. Rewrite the row in the current form ("skip 2 ch, …"), or generate the pattern again.',
    count: (n) => `(${n} ${n === 1 ? 'st' : 'sts'})`,
    chain: (n) => `ch ${n}`,
    skip: (n, what) =>
      `${skipWord} ${n} ${what === 'stitch' ? (n === 1 ? 'st' : 'sts') : what === 'chain' ? 'ch' : n === 1 ? 'ch-sp' : 'ch-sps'}`,
    turningChain: (n, note) => `ch ${n} (${note})`,
    turningChainNotCounted: 'turning chain',
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
      if (mode === 'front-post' || mode === 'back-post')
        return text.replace(/^(\d+ )?/, `$1${mode === 'front-post' ? 'FP' : 'BP'}`);
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
    // KB: core-domain §22
    resumeSection: (name, row) => `${name} (worked over row ${row + 1}):`,
    down: (depth) => `in st ${depth} rows below`,
    colorwork: {
      colors: (items) => `Colors: ${items.map((item) => `${item.letter} – ${item.name}`).join(', ')}.`,
      colorNames: {
        natural: 'Natural',
        burgundy: 'Burgundy',
        blue: 'Blue',
        green: 'Green',
        mustard: 'Mustard',
        black: 'Black',
        rose: 'Rose',
        brown: 'Brown',
      },
      start: (letter) => `Start with ${color} ${letter}.`,
      change: (letter) => `(change to ${letter} in last yo)`,
      note: {
        tapestry: 'Carry the unused colors inside the stitches: behind the work on RS rows, in front of it on WS rows.',
        graphgan: `Use a separate bobbin for each ${color} block; do not carry ${color}s across the back.`,
        c2c: `Tile: ch 3 and 3 dc. To change ${color}, finish the last dc of the previous tile with the new ${color}.`,
        mosaic: `Mosaic: one ${color} per row. For a cell of the other ${color}, ch 1 and skip 1 st; a dropped st goes into the skipped st behind the ch. Carry the unused yarn up the side.`,
      },
      rowsHeading: (technique) =>
        technique === 'c2c'
          ? `Tile ${color}s per row, in working order:`
          : `Stitch ${color}s per row, in working order:`,
      run: (count, letter) => `${count} ${letter}`,
    },
    sewing: (a, b, distributed) =>
      `Sew: ${enSewnEdge(a)} to ${enSewnEdge(b)}${distributed ? ', easing sts evenly' : ''}.`,
  };
}

// The British "miss" is an editorial inference, and the British output is not approved yet. KB: 01 §3.1
export const VOCABULARIES: Readonly<Record<Locale, Vocabulary>> = {
  hu: HU,
  'en-US': english('sk', 'skip', 'skip', 'US terms', 'color'),
  'en-GB': english('miss', 'miss', 'miss (skip)', 'UK terms', 'colour'),
};

function range(from: number, to: number): string {
  return from === to ? `${from}` : `${from}–${to}`;
}

function huSewnEdge(edge: SewnEdge): string {
  const where = `${edge.name}${edge.section === undefined ? '' : `, ${edge.section}`}`;
  if (edge.rows)
    return `${where}, ${range(edge.layer, edge.rows.to)}. sor ${edge.rows.side === 'left' ? 'bal' : 'jobb'} széle (${edge.count} sorvég)`;
  if (edge.stitches)
    return `${where}, ${edge.layer}. sor ${range(edge.stitches.from, edge.stitches.to)}. szeme (${edge.count})`;
  return `${where}, ${edge.layer}. kör (${edge.count})`;
}

function enSewnEdge(edge: SewnEdge): string {
  const where = `${edge.name}${edge.section === undefined ? '' : `, ${edge.section}`}`;
  if (edge.rows)
    return `${where}, ${edge.layer === edge.rows.to ? 'Row' : 'Rows'} ${range(edge.layer, edge.rows.to)}, ${edge.rows.side} edge (${edge.count} row ends)`;
  if (edge.stitches)
    return `${where}, Row ${edge.layer}, sts ${range(edge.stitches.from, edge.stitches.to)} (${edge.count})`;
  return `${where}, Rnd ${edge.layer} (${edge.count})`;
}

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** A stitch's single allowed mode is not written out: its name already says it. */
export function shownMode(def: StitchDef, mode: StitchInsertion): StitchInsertion {
  return def.insertionModes.length === 1 && def.insertionModes[0] === mode ? 'both-loops' : mode;
}

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

/** If several stitches in the library share a name (the two kinds of cluster), the structure is added in brackets so reading back stays unambiguous. */
export function itemName(def: StitchDef, locale: Locale, library: StitchLibrary): string {
  const ref = refOf(def, locale);
  const clash = [...library.values()].some(
    (other) => other.id !== def.id && !isIncrease(other) && !isDecrease(other) && refOf(other, locale) === ref,
  );
  const structure = clash ? stitchStructure(def, locale) : null;
  return structure ? `${ref} (${structure})` : ref;
}

export interface Abbreviation {
  readonly abbr: string;
  readonly meaning: string;
}

export interface LegendEntry {
  readonly def: StitchDefId;
  readonly label: string;
}

export interface WrittenPatternText {
  readonly locale: Locale;
  readonly title: string;
  readonly abbreviations: readonly Abbreviation[];
  readonly legend: readonly LegendEntry[];
  readonly pieces: readonly { readonly name: string; readonly lines: readonly string[] }[];
  readonly assembly: readonly string[];
  readonly sizes: readonly string[];
}

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
    // KB: core-domain §12
    const rowOf = (at: number) => written_?.layers.find((candidate) => candidate.index === at)?.row ?? at;
    // KB: core-domain §12
    const ambiguous =
      written_?.layers.some((candidate) => candidate.index !== layer && candidate.row === rowOf(layer)) === true;
    const sections = (written_?.sections ?? []).filter((section) => section.layer <= layer);
    const section = ambiguous && sections.length > 0 ? sections[sections.length - 1]!.name : undefined;
    const named = section === undefined ? {} : { section };
    if (stitches) {
      return {
        name,
        layer: rowOf(layer),
        count: stitches.count,
        ...named,
        stitches: { from: stitches.from + 1, to: stitches.from + stitches.count },
      };
    }
    if (rows)
      return {
        name,
        layer: rowOf(layer),
        count: rows.to - layer + 1,
        ...named,
        rows: { to: rowOf(rows.to), side: rows.side },
      };
    return {
      name,
      layer: rowOf(layer),
      count: written_?.layers.find((candidate) => candidate.index === layer)?.writtenCount ?? 0,
      ...named,
    };
  };
  const assembly = (pattern.joins ?? []).map((join) =>
    vocabulary.sewing(edge(join.a), edge(join.b), join.distribution !== undefined),
  );

  const text = pieces.flatMap((piece) => piece.lines).join('\n');
  const abbreviations = new Map<string, string>();
  for (const def of used.values()) {
    const { name, abbr } = def.terms[locale];
    if (abbr) abbreviations.set(abbr, name);
  }
  const shortDef = shortIncrease === null ? undefined : library.get(shortIncrease);
  const increasePart =
    renderer.shortIncreaseUsed && shortDef?.kind === 'group' ? library.get(shortDef.members[0]!) : undefined;
  if (increasePart)
    abbreviations.set(vocabulary.increase.abbr, vocabulary.increase.meaning(refOf(increasePart, locale)));
  for (const { abbr, meaning, used: pattern } of vocabulary.general)
    if (pattern.test(text)) abbreviations.set(abbr, meaning);

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

export function formatWrittenPattern(written: WrittenPatternText): string {
  const { headings } = VOCABULARIES[written.locale];
  const blocks: string[][] = [[written.title]];
  // KB: 05 §8.1
  if (written.sizes.length > 0) blocks.push([headings.sizes, ...written.sizes]);
  if (written.abbreviations.length > 0) {
    blocks.push([headings.abbreviations, ...written.abbreviations.map(({ abbr, meaning }) => `${abbr} – ${meaning}`)]);
  }
  if (written.legend.length > 0) blocks.push([headings.legend, ...written.legend.map((entry) => entry.label)]);
  for (const piece of written.pieces) blocks.push([piece.name, ...piece.lines]);
  if (written.assembly.length > 0) blocks.push([headings.assembly, ...written.assembly]);
  return `${blocks.map((block) => block.join('\n')).join('\n\n')}\n`;
}

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
  return [...library.values()]
    .filter((def) => ids.has(def.id))
    .map((def) => ({ def: def.id, label: legendLabel(def, library, locale) }));
}

/** One pattern, one wording: the decrease reads the same in the key as in the rows. */
function legendLabel(def: StitchDef, library: StitchLibrary, locale: Locale): string {
  if (locale !== 'hu' || def.kind !== 'joined' || !isDecrease(def)) return stitchLabel(def, locale);
  const part = library.get(def.part);
  return part ? `${def.terms.hu.name}: ${VOCABULARIES.hu.decrease(def.parts, part, locale)}` : stitchLabel(def, locale);
}

/** `null` when the rounds hold more than one kind of two-stitch increase; then it is spelled out. KB: 04 §5.9 */
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

/** KB: 04 §5.9 */
export interface StepContext {
  readonly round?: boolean;
  readonly shortIncrease?: StitchDefId | null;
}

/** The reader uses this to check that it would write an item exactly this way. */
export function renderStep(step: Step, library: StitchLibrary, locale: Locale, context: StepContext = {}): string {
  const renderer = new Renderer(library, locale, new Map(), context.shortIncrease ?? null);
  renderer.round = context.round === true;
  return renderer.step(step);
}

class Renderer {
  private readonly library: StitchLibrary;
  private readonly locale: Locale;
  private readonly vocabulary: Vocabulary;
  private readonly used: Map<string, StitchDef>;
  private readonly shortIncrease: StitchDefId | null;
  /** KB: 04 §5.9 */
  round = false;
  shortIncreaseUsed = false;

  constructor(
    library: StitchLibrary,
    locale: Locale,
    used: Map<string, StitchDef>,
    shortIncrease: StitchDefId | null = null,
  ) {
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
      // A built-in color's name follows the notation language; a name the user typed stays as written.
      lines.push(
        v.colorwork.colors(
          colorwork.colors.map((color, i) => ({
            letter: colorLetter(i),
            name:
              (color.id === undefined ? undefined : v.colorwork.colorNames[color.id]) ?? color.name ?? colorLetter(i),
          })),
        ),
      );
      lines.push(v.colorwork.start(colorLetter(colorwork.startColor)));
      const note = v.colorwork.note[colorwork.technique];
      if (note) lines.push(note);
    }

    const bodies = piece.layers.map((layer) => this.body(layer));
    // The continuous section's name goes before its first round, and identical rounds stop being merged there.
    const sections = new Map(
      piece.sections.filter((section) => section.layer > 1).map((section) => [section.layer, section]),
    );
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
      // KB: core-domain §12
      if (section !== undefined)
        lines.push(section.over === undefined ? v.section(section.name) : v.resumeSection(section.name, section.over));
      const label = shape === 'row' ? v.layer.row(row, piece.layers[j]!.row) : v.layer.round(row, piece.layers[j]!.row);
      lines.push(`${label}: ${bodies[i]}`);
      i = j + 1;
    }
    if (colorwork && colorwork.rows.length > 0) {
      lines.push(v.colorwork.rowsHeading(colorwork.technique));
      colorwork.rows.forEach((runs, i) => {
        lines.push(
          `${v.layer.row(i + 1, i + 1)}: ${runs.map((run) => v.colorwork.run(run.count, colorLetter(run.color))).join(', ')}`,
        );
      });
    }
    return lines;
  }

  body(layer: WrittenLayer): string {
    const v = this.vocabulary;
    this.round = layer.shape === 'round';
    let prefix = '';
    let items: string;
    // The chain count is not explained here; the turning chain of the later rows says it. KB: 03 §1.2
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
    let text = `${prefix}${items} ${this.round ? v.roundCount(layer.writtenCount) : v.count(layer.writtenCount)}.`;
    const slip = this.byKind('slip');
    if (layer.closing === 'join-slip') {
      this.use(slip);
      text += ` ${v.join(refOf(slip, this.locale), layer.joinTo!)}`;
    } else if (layer.closing === 'turn' || layer.closing === 'fasten-off') {
      // The spiral note appears once at the start of the piece, not per round.
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
    // The "other side" sentence ends with a colon: the items continue after it without a comma. KB: 04 §3.4
    return steps
      .map((step, i) => `${i === 0 ? '' : steps[i - 1]!.kind === 'other-side' ? ' ' : ', '}${this.step(step)}`)
      .join('');
  }

  step(step: Step): string {
    const text = this.stepText(step);
    return 'changeTo' in step && step.changeTo !== undefined
      ? `${text} ${this.vocabulary.colorwork.change(colorLetter(step.changeTo))}`
      : text;
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
        return v.turningChain(
          step.count,
          counts ? v.turningChainCounts(counts, this.locale) : v.turningChainNotCounted,
        );
      }
      case 'other-side':
        return v.otherSide;
      case 'repeat':
        return this.round
          ? v.roundRepeat(this.steps(step.steps), step.times)
          : v.repeat(this.steps(step.steps), step.times);
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
        const place =
          step.target === 'down' ? ` ${v.down(step.depth ?? 2)}` : this.phrase(step.target, step.into, false);
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
        // The magic ring is spelled out, so its abbreviation never reaches the list.
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
