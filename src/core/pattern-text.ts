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

import { dative, times } from './hungarian.ts';
import { writtenPieces, type Step, type StepTarget, type WrittenBorder, type WrittenLayer, type WrittenPiece } from './pattern-steps.ts';
import type { StitchLibrary } from './stitch-library.ts';
import { stitchLabel, stitchStructure } from './stitchText.ts';
import type { Locale, Pattern, StitchDef, StitchDefId, StitchInsertion } from './types.ts';

/* ---- Szókészlet ---- */

/** Helyhatározók; a `next` csak szaporításnál íródik ki, máskor a kurzor következő pozíciója az alapértelmezés. */
export type PhraseKey = 'next-stitch' | 'next-chain' | 'same-stitch' | 'same-chain' | 'next-space' | 'same-space' | 'ring' | 'chain-ring';

export interface Vocabulary {
  /** Angol jelölésnél a rendszer neve, amely a címsorokban mindig ott áll; magyarul nincs. */
  readonly system: string | null;
  readonly headings: { readonly abbreviations: string; readonly legend: string };
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
  readonly fromHook: (chain: number, note: string | null) => string;
  /** Az 1. sor kihagyott láncszemei mint szem: „1 erp-nek számítanak”. */
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
  /** A szegély köre a sorok után (PQW-862, 03 §7.1); a `prefix`-ről ismeri fel a visszaolvasó. */
  readonly border: { readonly prefix: string; readonly text: (parts: BorderParts) => string };
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
  headings: { abbreviations: 'Rövidítések', legend: 'Jelmagyarázat' },
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
  border: {
    prefix: 'Szegély: ',
    text: (p) =>
      `Szegély: ${p.turning}, felső él: ${p.corner} a sarokszembe, ${p.top}, ${p.corner} a sarokszembe; ` +
      `oldal: soronként ${p.perRow} a sor végére (${p.side}); ` +
      `alsó él: ${p.corner} a sarokba, ${p.bottom} a láncalap láncszemeibe, ${p.corner} a sarokba; ` +
      `másik oldal: soronként ${p.perRow} a sor végére (${p.side}) ${p.count}. ${p.join}`,
  },
};

/** A beszúrási módok a jóváhagyott szókészlet §3 szerint; az „esz” jóváhagyásra vár (PQW-869). */
const HU_MODES: Readonly<Record<Exclude<StitchInsertion, 'both-loops'>, string>> = {
  'back-loop': 'hsz',
  'front-loop': 'esz',
  'front-post': 'első relief',
  'back-post': 'hátsó relief',
};

function english(skipWord: string, skipMeaning: string, system: string, color: string): Vocabulary {
  return {
    // Az amerikai és a brit „dc” mást jelent, ezért a rendszer neve mindkét címsorban ott áll (PQW-868).
    system,
    headings: { abbreviations: `Abbreviations (${system})`, legend: `Stitch key (${system})` },
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
    ],
    border: {
      prefix: 'Border: ',
      text: (p) =>
        `Border: ${p.turning}, top edge: ${p.corner} in corner st, ${p.top}, ${p.corner} in corner st; ` +
        `side: ${p.perRow} in each row end (${p.side}); ` +
        `bottom edge: ${p.corner} in corner, ${p.bottom} along foundation ch, ${p.corner} in corner; ` +
        `other side: ${p.perRow} in each row end (${p.side}) ${p.count}. ${p.join}`,
    },
  };
}

// A brit „miss” a 01 §3.1 szerint szerkesztői következtetés [E]; a brit kimenet még nincs jóváhagyva.
export const VOCABULARIES: Readonly<Record<Locale, Vocabulary>> = {
  hu: HU,
  'en-US': english('sk', 'skip', 'US terms', 'color'),
  'en-GB': english('miss', 'miss (skip)', 'UK terms', 'colour'),
};

function range(from: number, to: number): string {
  return from === to ? `${from}` : `${from}–${to}`;
}

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/* ---- Szemnevek ---- */

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
}

/** Az írott minta: rövidítéslista, jelmagyarázat és darabonként a sorok. */
export function writePattern(pattern: Pattern, library: StitchLibrary, locale: Locale): WrittenPatternText {
  const vocabulary = VOCABULARIES[locale];
  const used = new Map<string, StitchDef>();
  const written = writtenPieces(pattern, library);
  const shortIncrease = shortIncreaseOf(written, library);
  const renderer = new Renderer(library, locale, used, shortIncrease);
  const pieces = written.map((piece) => ({ name: piece.name, lines: renderer.piece(piece) }));

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
  };
}

/** A teljes szöveg: cím, rövidítések, jelmagyarázat, darabok, üres sorral elválasztva. */
export function formatWrittenPattern(written: WrittenPatternText): string {
  const { headings } = VOCABULARIES[written.locale];
  const blocks: string[][] = [[written.title]];
  if (written.abbreviations.length > 0) {
    blocks.push([headings.abbreviations, ...written.abbreviations.map(({ abbr, meaning }) => `${abbr} – ${meaning}`)]);
  }
  if (written.legend.length > 0) blocks.push([headings.legend, ...written.legend.map((entry) => entry.label)]);
  for (const piece of written.pieces) blocks.push([piece.name, ...piece.lines]);
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

    const bodies = piece.layers.map((layer) => this.body(layer));
    for (let i = 0; i < piece.layers.length; ) {
      let j = i;
      while (j + 1 < piece.layers.length && bodies[j + 1] === bodies[i] && piece.layers[j + 1]!.shape === piece.layers[i]!.shape) j += 1;
      const { shape, index } = piece.layers[i]!;
      const label = shape === 'row' ? v.layer.row(index, piece.layers[j]!.index) : v.layer.round(index, piece.layers[j]!.index);
      lines.push(`${label}: ${bodies[i]}`);
      i = j + 1;
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
    if (layer.fromHook) {
      const counts = layer.fromHook.countsAs === null ? null : this.def(layer.fromHook.countsAs);
      if (counts) this.use(counts);
      prefix = v.fromHook(layer.fromHook.chain, counts ? v.skippedChainsCount(counts, this.locale) : null);
    }
    const items = this.steps(layer.steps);
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
    return text;
  }

  steps(steps: readonly Step[]): string {
    return steps.map((step) => this.step(step)).join(', ');
  }

  step(step: Step): string {
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
        return `${v.mode(step.mode, text)}${this.phrase(step.target, step.into, false)}`;
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
