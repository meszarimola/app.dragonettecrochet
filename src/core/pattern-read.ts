/*
 * A program saját írott mintájának visszaolvasása gráffá (06 §5.3 pont 6).
 *
 * Nem általános mintaértelmező: a pattern-text.ts kimenetét olvassa, és minden
 * tételt csak akkor fogad el, ha a szövegíró pontosan így írná ki. Ezért a
 * szöveg és az olvasás nem térhet el egymástól: amit a szövegíró más szóval
 * írna, azt a beolvasó hibának jelzi.
 *
 * A célpontok jelentése a pattern-steps.ts kurzoros megállapodása. A mintában
 * nem szereplő beállításokat (fordulólánc alapértelmezése, pikó és kúszószem
 * számolása, ismétlés) a hívó adja meg; ha egy sor fordulólánca eltér a
 * beállítástól, a sor felülírást kap.
 *
 * Eltérés esetén a hiba a szöveg sorszámát és a hibás részt nevezi meg, és a
 * sor végi szemszámot is összeveti a visszaolvasott gráf számolásával.
 */

import { appendBorder, borderOf } from './border.ts';
import { buildPieceGraph, type PieceGraph } from './graph.ts';
import { isStitchInsertion } from './insertion.ts';
import { modeAsWorked, type Step, type StepTarget } from './pattern-steps.ts';
import {
  VOCABULARIES,
  isDecrease,
  isIncrease,
  refOf,
  renderBorder,
  renderStep,
  type PhraseKey,
  type StepContext,
  type Vocabulary,
} from './pattern-text.ts';
import type { StitchLibrary } from './stitch-library.ts';
import { traditionOf, turningChainCountsFor } from './tradition.ts';
import type {
  Anchor,
  LayerEvent,
  Locale,
  NodeId,
  Pattern,
  PatternConventions,
  Piece,
  PieceBorder,
  Ring,
  RoundMark,
  Space,
  SpaceId,
  StitchDef,
  StitchDefId,
  StitchFlag,
  StitchGroup,
  StitchInsertion,
  StitchNode,
} from './types.ts';

export interface ReadOptions {
  readonly library: StitchLibrary;
  readonly locale: Locale;
  readonly conventions: PatternConventions;
}

export interface ReadError {
  /** A szöveg sora, 1-től számozva. */
  readonly line: number;
  readonly message: string;
}

export type ReadResult = { readonly ok: true; readonly pattern: Pattern } | { readonly ok: false; readonly error: ReadError };

class ReadFailure extends Error {
  readonly line: number;

  constructor(line: number, message: string) {
    super(message);
    this.line = line;
  }
}

export function readPattern(text: string, options: ReadOptions): ReadResult {
  try {
    return { ok: true, pattern: read(text, options) };
  } catch (error) {
    if (error instanceof ReadFailure) return { ok: false, error: { line: error.line, message: error.message } };
    throw error;
  }
}

interface Line {
  readonly number: number;
  readonly text: string;
}

function read(text: string, options: ReadOptions): Pattern {
  const vocabulary = VOCABULARIES[options.locale];
  const blocks: Line[][] = [];
  let current: Line[] = [];
  text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .forEach((raw, index) => {
      const line = raw.trim();
      if (line === '') {
        if (current.length > 0) blocks.push(current);
        current = [];
      } else current.push({ number: index + 1, text: line });
    });
  if (current.length > 0) blocks.push(current);

  const [titleBlock, ...rest] = blocks;
  if (!titleBlock || titleBlock.length !== 1) throw new ReadFailure(titleBlock?.[1]?.number ?? 1, 'A szöveg első bekezdése a minta címe, egyetlen sorban.');
  // Az összeállítás (PQW-863) nem darab; az összevarrásokat nem olvassuk vissza.
  const headings = new Set([vocabulary.headings.abbreviations, vocabulary.headings.legend, vocabulary.headings.assembly]);
  const pieceBlocks = rest.filter((block) => !headings.has(block[0]!.text));
  if (pieceBlocks.length === 0) throw new ReadFailure(titleBlock[0]!.number, 'A szövegben nincs darab.');
  const abbreviations = rest.find((block) => block[0]!.text === vocabulary.headings.abbreviations);
  const shortIncrease = abbreviations ? shortIncreaseFrom(abbreviations, options, vocabulary) : null;

  const pieces = pieceBlocks.map((block, index) =>
    new PieceReader(`p${index + 1}`, block, options, vocabulary, titleBlock[0]!.text, shortIncrease).read(),
  );
  return { formatVersion: 1, title: titleBlock[0]!.text, conventions: options.conventions, pieces };
}

/**
 * A körök „szap.” rövid alakjának jelentése a rövidítéslistából: melyik
 * kétszemes szaporítás (pattern-text.ts `shortIncreaseOf`).
 */
function shortIncreaseFrom(block: readonly Line[], options: ReadOptions, vocabulary: Vocabulary): StitchDefId | null {
  const prefix = `${vocabulary.increase.abbr} – `;
  const line = block.find((candidate) => candidate.text.startsWith(prefix));
  if (!line) return null;
  const meaning = line.text.slice(prefix.length);
  for (const def of options.library.values()) {
    if (def.kind !== 'group' || !isIncrease(def) || def.members.length !== 2) continue;
    const part = options.library.get(def.members[0]!);
    if (part && vocabulary.increase.meaning(refOf(part, options.locale)) === meaning) return def.id;
  }
  throw new ReadFailure(line.number, `Ismeretlen szaporítás a rövidítések között: „${line.text}”.`);
}

/* ---- Tételek ---- */

/** A tételek vesszővel elválasztva; a zárójelen belüli vessző nem választ el. */
function splitItems(text: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (char === '(' || char === '[') depth += 1;
    else if (char === ')' || char === ']') depth -= 1;
    else if (depth === 0 && char === ',' && text[i + 1] === ' ') {
      items.push(text.slice(start, i));
      start = i + 2;
    }
  }
  items.push(text.slice(start));
  return items;
}

const MODES: readonly StitchInsertion[] = ['both-loops', 'back-loop', 'front-loop', 'front-post', 'back-post'];

const PHRASE_TARGETS: readonly { readonly key: PhraseKey; readonly target: StepTarget; readonly into: 'stitch' | 'chain' }[] = [
  { key: 'next-stitch', target: 'next', into: 'stitch' },
  { key: 'next-chain', target: 'next', into: 'chain' },
  { key: 'same-stitch', target: 'same', into: 'stitch' },
  { key: 'same-chain', target: 'same', into: 'chain' },
  { key: 'next-space', target: 'next-space', into: 'stitch' },
  { key: 'same-space', target: 'same-space', into: 'stitch' },
  { key: 'ring', target: 'ring', into: 'stitch' },
  { key: 'chain-ring', target: 'chain-ring', into: 'stitch' },
];

/** A tétel lépése: az a lépés, amelyet a szövegíró betű szerint így írna ki. */
/** Hány sorral lejjebb mehet a hosszú szem (03 §5, pattern-steps.ts). */
const DOWN_DEPTHS = [2, 3];

function parseItem(text: string, line: number, options: ReadOptions, vocabulary: Vocabulary, context: StepContext = {}): Step {
  const { library, locale } = options;
  const matches = (step: Step) => {
    try {
      return renderStep(step, library, locale, context) === text;
    } catch {
      return false;
    }
  };

  // Körben az ismétlés „(1 rp, szap.) ×6” vagy „szap. ×6” (04 §5.9).
  const roundRepeat = context.round ? /^(?:\((.*)\)|(\S+)) [×x](\d+)$/.exec(text) : null;
  if (roundRepeat) {
    const inner = roundRepeat[1] ?? roundRepeat[2]!;
    const steps = splitItems(inner).map((item) => parseItem(item, line, options, vocabulary, context));
    const step: Step = { kind: 'repeat', steps, times: Number(roundRepeat[3]) };
    if (matches(step)) return step;
    throw new ReadFailure(line, `Nem értelmezhető ismétlés: „${text}”.`);
  }

  if (text.startsWith('[')) {
    const close = text.lastIndexOf(']');
    const times = Number(/\d+/.exec(text.slice(close))?.[0]);
    if (close > 0 && Number.isInteger(times)) {
      const steps = splitItems(text.slice(1, close)).map((item) => parseItem(item, line, options, vocabulary, context));
      const step: Step = { kind: 'repeat', steps, times };
      if (matches(step)) return step;
    }
    throw new ReadFailure(line, `Nem értelmezhető ismétlés: „${text}”.`);
  }

  if (context.round && context.shortIncrease) {
    for (const mode of MODES) {
      const step: Step = { kind: 'group', def: context.shortIncrease, target: 'next', mode, into: 'stitch' };
      if (matches(step)) return step;
    }
  }

  const n = Number(/\d+/.exec(text)?.[0] ?? 1);
  const defs = [...library.values()];
  const simple: Step[] = [
    { kind: 'chain', count: n },
    { kind: 'skip', count: n, what: 'stitch' },
    { kind: 'skip', count: n, what: 'chain' },
    { kind: 'skip', count: n, what: 'space' },
    { kind: 'turning-chain', count: n, countsAs: null },
    ...defs.filter((def) => def.kind === 'basic').map((def): Step => ({ kind: 'turning-chain', count: n, countsAs: def.id })),
  ];
  const found = simple.find(matches);
  if (found) return found;

  const targets: { target: StepTarget; into: 'stitch' | 'chain' }[] = PHRASE_TARGETS.filter(({ key }) =>
    text.endsWith(` ${vocabulary.phrases[key]}`),
  );
  targets.push({ target: 'next', into: 'stitch' }, { target: 'none', into: 'stitch' });
  // Lejjebb horgolt hosszú szem (mozaik, filé sor végi szaporítás; PQW-894, PQW-902): „… 2 sorral lejjebb”.
  const downDepth = DOWN_DEPTHS.find((depth) => text.endsWith(` ${vocabulary.down(depth)}`));
  if (downDepth !== undefined) targets.unshift({ target: 'down', into: 'stitch' });
  const modes = MODES.filter((mode) => mode === 'both-loops' || vocabulary.modeMarks[mode].some((mark) => text.includes(mark)));

  for (const def of defs) {
    if (def.kind === 'chain' || def.kind === 'space' || def.kind === 'ring') continue;
    if (!text.includes(probe(def, library, locale))) continue;
    // Az egyetlen módú szem módja nincs kiírva (pattern-text.ts `shownMode`), pl. a láthatatlan fogyasztásé.
    const only = def.insertionModes.length === 1 ? def.insertionModes[0]! : null;
    const defModes = only !== null && isStitchInsertion(only) ? [only] : modes;
    for (const { target, into } of targets) {
      for (const mode of defModes) {
        if (def.kind === 'group') {
          const step: Step = { kind: 'group', def: def.id, target, mode, into };
          if (matches(step)) return step;
          continue;
        }
        const plain = def.kind === 'basic' || def.kind === 'slip';
        for (const count of new Set([1, n])) {
          if (count > 1 && (!plain || target === 'same')) continue;
          const step: Step =
            target === 'down' && downDepth !== undefined
              ? { kind: 'stitch', def: def.id, count, target, mode, into, depth: downDepth }
              : { kind: 'stitch', def: def.id, count, target, mode, into };
          if (matches(step)) return step;
        }
      }
    }
  }
  throw new ReadFailure(line, `Nem értelmezhető tétel: „${text}”.`);
}

/** A szövegrész, amelynek egy szem tételében mindenképp szerepelnie kell; ezzel szűrjük a jelölteket. */
function probe(def: StitchDef, library: StitchLibrary, locale: Locale): string {
  if (def.kind === 'group' && isIncrease(def)) return refOf(library.get(def.members[0]!) ?? def, locale);
  if (def.kind === 'joined' && isDecrease(def)) return locale === 'hu' ? refOf(library.get(def.part) ?? def, locale) : 'tog';
  return refOf(def, locale);
}

/* ---- Darab ---- */

type Last = { readonly kind: 'stitch'; readonly w: number } | { readonly kind: 'space'; readonly id: string } | null;

interface LayerHeader {
  readonly line: number;
  readonly shape: 'row' | 'round';
  readonly from: number;
  readonly to: number;
  readonly body: string;
}

class PieceReader {
  private readonly id: string;
  private readonly lines: readonly Line[];
  private readonly options: ReadOptions;
  private readonly vocabulary: Vocabulary;
  private readonly title: string;

  private readonly stitches: StitchNode[] = [];
  private readonly spaces: Space[] = [];
  private readonly rings: Ring[] = [];
  private readonly groups: StitchGroup[] = [];
  private readonly events: LayerEvent[] = [];
  private readonly skipped: NodeId[] = [];
  private previous: NodeId | null = null;
  private foundation: 'chain' | 'ring' | 'chain-ring' = 'chain';
  /** A láncgyűrű láncíve, amelybe az 1. kör horgol. */
  private ringSpace: SpaceId | null = null;
  /** A darab spirálban halad: a kör vége kiírás nélkül is spirál (pattern-text.ts). */
  private spiral = false;
  /** A darab szegélye, ha a szöveg utolsó sora a szegély (PQW-862). */
  private border: PieceBorder | null = null;
  private readonly shortIncrease: StitchDefId | null;
  /** Rétegenként a szöveg sora, a szemszám hibájához. */
  private readonly layerLines = new Map<number, number>();

  constructor(
    id: string,
    lines: readonly Line[],
    options: ReadOptions,
    vocabulary: Vocabulary,
    title: string,
    shortIncrease: StitchDefId | null = null,
  ) {
    this.id = id;
    this.lines = lines;
    this.options = options;
    this.vocabulary = vocabulary;
    this.title = title;
    this.shortIncrease = shortIncrease;
  }

  read(): Piece {
    const [nameLine, foundationLine, ...rest] = this.lines;
    if (!foundationLine) throw new ReadFailure(nameLine!.number, 'A darab neve után a láncalap vagy a varázskör következik.');
    this.readFoundation(foundationLine);
    this.spiral = rest[0]?.text === this.vocabulary.spiral;
    const body = this.spiral ? rest.slice(1) : rest;
    const borderLine = body.at(-1)?.text.startsWith(this.vocabulary.border.prefix) ? body.at(-1) : undefined;
    // A folytatólagosan kapcsolt rész neve (PQW-863) nem kör; a részeket nem olvassuk vissza.
    const sectionSuffix = this.vocabulary.section('');
    const layerLines = (borderLine ? body.slice(0, -1) : body).filter(
      (line) => !(line.text.endsWith(sectionSuffix) && line.text.length > sectionSuffix.length && !line.text.includes(': ')),
    );

    // A kiírt sorszám az újrakezdett szakaszban újraindul (PQW-901), a gráf rétegei viszont sorban állnak.
    const layerOfRow = new Map<number, number>();
    let graphIndex = 1;
    let expectedRow = 1;
    layerLines.forEach((line, i) => {
      const resume = this.resumeHeading(line);
      if (resume !== null) {
        const target = layerOfRow.get(resume.row);
        if (target === undefined) throw new ReadFailure(line.number, `Nincs ilyen sor: ${resume.row}.`);
        const last = this.events[this.events.length - 1];
        if (last?.kind !== 'fasten-off') throw new ReadFailure(line.number, 'Az új szakasz előtt a fonalat el kell vágni.');
        this.events[this.events.length - 1] = { ...last, resume: { layer: target, name: resume.name } };
        this.pendingResume = target;
        expectedRow = resume.row + 1;
        return;
      }
      const header = this.header(line);
      if (header.from !== expectedRow) throw new ReadFailure(line.number, `A sorszám nem folytatódik: ${expectedRow} helyett ${header.from}.`);
      for (let row = header.from; row <= header.to; row += 1) {
        const isLast = i === layerLines.length - 1 && row === header.to;
        // Két szakasz sorszáma egyezhet; a sor a legkorábbi rétegre mutat, amely így számozódik.
        if (!layerOfRow.has(row)) layerOfRow.set(row, graphIndex);
        this.readLayer(graphIndex, header, isLast);
        graphIndex += 1;
        expectedRow = row + 1;
      }
    });

    if (borderLine) this.readBorder(borderLine);
    const piece = this.withBorder(this.piece(), borderLine);
    this.checkCounts(piece);
    return piece;
  }

  /**
   * A szegély sora pontosan az-e, amit a sorokból számolva kiírnánk. A
   * félpálcás sorvégi szám (1 vagy 2) a szövegből derül ki; más szemnél a kettő
   * ugyanazt a szöveget adja, ott az alapértelmezés marad.
   */
  private readBorder(line: Line): void {
    const graph = this.graph();
    // Az ismétléshez igazított szegély (PQW-898) a szövegben jelöli az ismétlést.
    const repeat = this.vocabulary.border.readRepeat(line.text);
    for (const hdcRowEnd of [2, 1] as const) {
      const border: PieceBorder = { stitch: 'sc', hdcRowEnd, ...(repeat ? { repeat } : {}) };
      const result = borderOf(graph, border);
      if (result.ok && renderBorder({ stitch: border.stitch, counts: result.counts }, this.options.library, this.options.locale) === line.text) {
        this.border = border;
        return;
      }
    }
    throw new ReadFailure(line.number, `Nem értelmezhető szegély: „${line.text}”.`);
  }

  /** A szegély rétege a sorok után, a szövegből kiderült választás szerint (PQW-889). */
  private withBorder(piece: Piece, line: Line | undefined): Piece {
    if (!this.border || !line) return piece;
    const pattern: Pattern = { formatVersion: 1, title: this.title, conventions: this.options.conventions, pieces: [] };
    const bordered = appendBorder(pattern, piece, this.options.library, this.border);
    if (typeof bordered === 'string') throw new ReadFailure(line.number, bordered);
    return bordered;
  }

  private piece(): Piece {
    return {
      id: this.id,
      name: this.lines[0]!.text,
      stitches: [...this.stitches],
      spaces: [...this.spaces],
      rings: [...this.rings],
      groups: [...this.groups],
      events: [...this.events],
      skipped: [...this.skipped],
      ...(this.border ? { border: this.border } : {}),
    };
  }

  private graph(): PieceGraph {
    const pattern: Pattern = { formatVersion: 1, title: this.title, conventions: this.options.conventions, pieces: [] };
    return buildPieceGraph(pattern, this.piece(), this.options.library);
  }

  private byKind(kind: StitchDef['kind']): StitchDef {
    const def = [...this.options.library.values()].find((candidate) => candidate.kind === kind);
    if (!def) throw new Error(`A könyvtárban nincs ilyen fajtájú szem: ${kind}`);
    return def;
  }

  /** Hány szem kapott célpontot eddig a darabban; a sor széli kihagyás felismeréséhez. */
  private anchoredCount = 0;

  private add(def: StitchDef, anchors: readonly Anchor[], flags: readonly StitchFlag[] = []): NodeId {
    if (anchors.length > 0) this.anchoredCount += 1;
    const id = `n${this.stitches.length + 1}`;
    this.stitches.push({ id, def: def.id, prev: this.previous, anchors, ...(flags.length > 0 ? { flags } : {}) });
    this.previous = id;
    return id;
  }

  private chains(count: number): NodeId[] {
    const chain = this.byKind('chain');
    return Array.from({ length: count }, () => this.add(chain, []));
  }

  private readFoundation(line: Line): void {
    const v = this.vocabulary;
    if (line.text === v.ring) {
      this.foundation = 'ring';
      const node = this.add(this.byKind('ring'), []);
      this.rings.push({ id: `r${this.rings.length + 1}`, node });
      return;
    }
    const count = Number(/\d+/.exec(line.text)?.[0]);
    if (Number.isInteger(count) && count >= 1 && line.text === v.chainRing(count, refOf(this.byKind('slip'), this.options.locale))) {
      // Láncgyűrű: a zárás eseménye az utolsó láncszem után; a kúszószem az 1. körrel együtt kerül be.
      this.foundation = 'chain-ring';
      const chains = this.chains(count);
      this.ringSpace = `s${this.spaces.length + 1}`;
      this.spaces.push({ id: this.ringSpace, chains });
      this.events.push({ after: chains[chains.length - 1]!, kind: 'join-slip' });
      return;
    }
    if (!Number.isInteger(count) || count < 1 || line.text !== v.foundation(count)) {
      throw new ReadFailure(line.number, `Láncalapot vagy varázskört vártunk: „${line.text}”.`);
    }
    this.chains(count);
  }

  /** Az újrakezdett szakasz alatti réteg, amíg a következő sor fel nem használja (PQW-901). */
  private pendingResume: number | null = null;

  /**
   * Az elvágott fonal utáni szakasz sora: a neve és a sor, amely fölött
   * folytatódik (PQW-901). Csak akkor fogadjuk el, ha a szövegíró pontosan
   * így írná ki.
   */
  private resumeHeading(line: Line): { readonly name: string; readonly row: number } | null {
    const open = line.text.lastIndexOf(' (');
    if (open <= 0) return null;
    const name = line.text.slice(0, open);
    const row = Number(/\d+/.exec(line.text.slice(open))?.[0]);
    return Number.isInteger(row) && this.vocabulary.resumeSection(name, row) === line.text ? { name, row } : null;
  }

  private header(line: Line): LayerHeader {
    const colon = line.text.indexOf(': ');
    const label = colon < 0 ? '' : line.text.slice(0, colon);
    const numbers = [...label.matchAll(/\d+/g)].map((match) => Number(match[0]));
    const from = numbers[0] ?? NaN;
    const to = numbers[1] ?? from;
    const v = this.vocabulary.layer;
    const shape = label === v.row(from, to) ? 'row' : label === v.round(from, to) ? 'round' : null;
    if (shape === null || to < from) throw new ReadFailure(line.number, `Nem értelmezhető sorkezdet: „${line.text}”.`);
    return { line: line.number, shape, from, to, body: line.text.slice(colon + 2) };
  }

  private readLayer(index: number, header: LayerHeader, isLast: boolean): void {
    const v = this.vocabulary;
    const { library, locale, conventions } = this.options;
    const fail = (message: string): never => {
      throw new ReadFailure(header.line, message);
    };
    this.layerLines.set(index, header.line);

    // A sor vége: lépcsőjavítás, színváltás, esemény, szemszám (a kiírás fordított sorrendjében).
    let body = header.body;
    // A jelölések a sor legvégén, a kiírás sorrendjében (PQW-863).
    const roundMarks: RoundMark[] = [];
    for (let found = true; found; ) {
      found = false;
      for (const [mark, text] of Object.entries(v.marks) as [RoundMark, string][]) {
        if (!body.endsWith(` ${text}`)) continue;
        body = body.slice(0, -(text.length + 1));
        roundMarks.unshift(mark);
        found = true;
      }
    }
    const slip = this.byKind('slip');
    const slipRef = refOf(slip, locale);
    let jogFix: LayerEvent['jogFix'];
    for (const fix of ['slip-stitch', 'back-loop'] as const) {
      const text = v.jogFix(fix, slipRef);
      if (!body.endsWith(` ${text}`)) continue;
      body = body.slice(0, -(text.length + 1));
      jogFix = fix;
    }
    const colorChange = body.endsWith(` ${v.colorChange}`);
    if (colorChange) body = body.slice(0, -(v.colorChange.length + 1));
    const marks = {
      ...(colorChange ? { colorChange: true } : {}),
      ...(jogFix ? { jogFix } : {}),
      ...(roundMarks.length > 0 ? { marks: roundMarks } : {}),
    };

    const endings: [string, LayerEvent['kind'], 'turning-chain' | 'first-stitch' | null][] = [
      [v.closings.turn, 'turn', null],
      [v.closings['fasten-off'], 'fasten-off', null],
      [v.join(slipRef, 'turning-chain'), 'join-slip', 'turning-chain'],
      [v.join(slipRef, 'first-stitch'), 'join-slip', 'first-stitch'],
    ];
    const ending = endings.find(([text]) => body.endsWith(` ${text}`));
    const round = header.shape === 'round';
    // Spirálban a kör vége nincs kiírva; a darab elején álló megjegyzés mondja meg (04 §2).
    const spiralEnd = !ending && round && this.spiral && !isLast;
    if (ending) body = body.slice(0, -(ending[0].length + 1));
    else if (!spiralEnd && !isLast) fail('A sor vége hiányzik: fordítás, a kör zárása vagy a fonal elvágása.');

    const countMatch = /^(.*) (\(\d+(?: [^()]+)?\))\.$/.exec(body);
    const stated = Number(/\d+/.exec(countMatch?.[2] ?? '')?.[0]);
    if (!countMatch || countMatch[2] !== (round ? v.roundCount(stated) : v.count(stated))) {
      fail(round ? 'Hiányzik a szemszám a kör végén, pl. „(18).”' : 'Hiányzik a szemszám a sor végén, pl. „(15 szem).”');
    }
    body = countMatch![1]!;

    // Az előző réteg pozíciói a haladási irányban.
    const graph = this.graph();
    // Újrakezdett szakaszban a megadott sor fölött folytatjuk (PQW-901).
    const resumed = this.pendingResume;
    this.pendingResume = null;
    const below = graph.layers[resumed ?? graph.layers.length - 1]!;
    const opening = index === 1 ? (this.foundation === 'chain-ring' ? this.events[0]! : null) : this.events[this.events.length - 1]!;
    const direction = index === 1 ? (this.foundation === 'chain' ? -1 : 1) : resumed !== null || opening!.kind === 'turn' ? -1 : 1;
    // A láncgyűrű kúszószeme az első láncszembe: a fonal útján az 1. kör első szeme (graph.ts).
    if (index === 1 && this.foundation === 'chain-ring') this.add(slip, [{ into: 'stitch', id: this.stitches[0]!.id, mode: 'both-loops' }]);
    let working = direction === 1 ? [...below.positions] : [...below.positions].reverse();
    const previousSide = index === 1 ? 'right' : below.side;
    const side = resumed !== null || opening?.kind === 'turn' ? (previousSide === 'right' ? 'wrong' : 'right') : previousSide;

    // Az 1. sor a láncalapon: a horog felőli láncszemek a fordulólánc.
    let fromHookCounts: StitchDef | null = null;
    // Az új 1. sor (PQW-895) nem írja ki, számít-e a fordulólánc: ilyenkor a minta beállítása dönt.
    let countsFromSettings = false;
    let eachChain = false;
    if (index === 1 && this.foundation === 'chain') {
      const n = Number(/\d+/.exec(body)?.[0]);
      // A PQW-895 előtti szöveg: „a horogtól számított 3. láncszemtől kezdve (a kihagyott láncszemek 1 rp-nek számítanak) ”.
      const notes: (StitchDef | null)[] = [null, ...[...library.values()].filter((def) => def.kind === 'basic')];
      const legacy = notes
        .map((def) => ({ def, text: v.fromHook(n, def ? v.skippedChainsCount(def, locale) : null) }))
        .sort((a, b) => b.text.length - a.text.length)
        .find(({ text }) => body.startsWith(text));
      let chain = 1;
      if (Number.isInteger(n) && body.startsWith(v.skipChains(n))) {
        chain = n + 1;
        body = body.slice(v.skipChains(n).length);
        countsFromSettings = true;
      } else if (legacy) {
        chain = n;
        fromHookCounts = legacy.def;
        body = body.slice(legacy.text.length);
      } else countsFromSettings = true;
      if (chain < 1 || chain > working.length) {
        fail(`Az 1. sor elején azt vártuk, hány láncszemet hagyunk ki: „${v.skipChains(2).trim()}”.`);
      }
      working = working.slice(chain - 1);
      const [before, after] = v.eachChain('\u0000').split('\u0000') as [string, string];
      eachChain = body.startsWith(before) && body.endsWith(after) && body.length > before.length + after.length;
      if (eachChain) body = body.slice(before.length, body.length - after.length);
    }

    const context: StepContext = { round, shortIncrease: this.shortIncrease };
    // Az ovális 1. köre (PQW-890): „…, a láncszemek másik oldalán vissza: 4 rp, …”; a mondat a következő tétel elején áll.
    const items = splitItems(body).flatMap((item) => (item.startsWith(`${v.otherSide} `) ? [v.otherSide, item.slice(v.otherSide.length + 1)] : [item]));
    const steps = items.map((item): Step => (item === v.otherSide ? { kind: 'other-side' } : parseItem(item, header.line, this.options, v, context)));
    if (eachChain) {
      // „minden láncszembe 1 rp”: egyetlen szem, a megmaradt láncszemek mindegyikébe egy.
      const [only] = steps;
      if (steps.length !== 1 || only?.kind !== 'stitch' || only.count !== 1 || only.target !== 'next') {
        fail(`Nem értelmezhető tétel: „${v.eachChain(body)}”.`);
      }
      steps[0] = { ...(only as Step & { kind: 'stitch' }), count: working.length };
    }
    const turning = steps.find((step): step is Step & { kind: 'turning-chain' } => step.kind === 'turning-chain');
    const textCounts = fromHookCounts !== null || (turning !== undefined && turning.countsAs !== null);

    const state = { cursor: index >= 2 && textCounts ? 1 : 0, last: null as Last, otherSide: false };
    // A láncszemek másik oldalán a célpont a láncszem másik oldala (PQW-890).
    const anchorOf = (id: NodeId, mode: StitchInsertion): Anchor => (state.otherSide ? { into: 'underside', id } : { into: 'stitch', id, mode: modeAsWorked(mode, side) });
    const anchoredAtStart = this.anchoredCount;
    if (state.cursor === 1) state.last = { kind: 'stitch', w: 0 };
    const firstNode = this.stitches.length;
    const turningNodes: NodeId[] = [];
    const skips: { positions: NodeId[]; anchoredBefore: number }[] = [];

    const resolve = (target: StepTarget, mode: StitchInsertion, item: string, consumes = 1, depth = 2): Anchor[] => {
      const missing = (what: string) => fail(`${what} ehhez: „${item}”.`);
      switch (target) {
        case 'none':
          return [];
        case 'down': {
          // Lejjebb horgolt hosszú szem (mozaik, filé sor végi szaporítás; PQW-894, PQW-902): a `depth`
          // sorral lejjebbi réteg szeme a kurzor oszlopában. A páratlan mélységű sor fordítva halad, és a
          // sor végi szaporításnál a kurzor már a sor végén jár: ott a lejjebbi sor utolsó szeme a célpont.
          const deeper = graph.layers[index - depth];
          if (!deeper || deeper.positions.length === 0) return missing(`Nincs ${depth} sorral lejjebbi sor`);
          // Minden sor az előzővel szemben halad: a `depth` sorral lejjebbi sor a mostani haladási
          // irányban `depth` páros számánál a fonal sorrendjében áll, páratlannál fordítva.
          const line = (direction === -1) === (depth % 2 === 1) ? [...deeper.positions].reverse() : [...deeper.positions];
          const at = Math.min(state.cursor, line.length - 1);
          // A mozaikban a lejjebb horgolt szem a fölötte kihagyott láncszem helyén halad át (pattern-steps.ts).
          if (state.cursor < working.length && this.skipped.includes(working[state.cursor]!)) state.cursor += 1;
          state.last = null;
          return [{ into: 'stitch', id: line[at]!, mode: modeAsWorked(mode, side) }];
        }
        case 'ring':
        case 'chain-ring': {
          // Angolul a varázskör és a láncgyűrű is „in ring”: a kezdés dönt.
          if (this.ringSpace !== null) return [{ into: 'space', id: this.ringSpace }];
          const ring = this.rings[0];
          return ring ? [{ into: 'ring', id: ring.id }] : missing('Nincs varázskör');
        }
        case 'same':
          if (state.last?.kind !== 'stitch') return missing('Nincs előző szem');
          return [anchorOf(working[state.last.w]!, mode)];
        case 'same-space':
          if (state.last?.kind !== 'space') return missing('Nincs előző láncív');
          return [{ into: 'space', id: state.last.id }];
        case 'next-space': {
          for (let w = state.cursor; w < working.length; w += 1) {
            const space = graph.spaceOfChain.get(working[w]!);
            if (!space) continue;
            state.cursor = Math.max(...space.chains.map((chain) => working.indexOf(chain))) + 1;
            state.last = { kind: 'space', id: space.id };
            return [{ into: 'space', id: space.id }];
          }
          return missing('Nincs következő láncív');
        }
        case 'next': {
          if (state.cursor + consumes > working.length) return missing('Nincs több szem az előző sorban');
          const anchors = working
            .slice(state.cursor, state.cursor + consumes)
            .map((id) => anchorOf(id, mode));
          state.cursor += consumes;
          state.last = { kind: 'stitch', w: state.cursor - 1 };
          return anchors;
        }
      }
    };

    const apply = (step: Step, item: string): void => {
      switch (step.kind) {
        case 'other-side':
          // A láncszemek másik oldalán vissza: a legtávolabbi láncszem másik oldala nélkül, a horog felé (PQW-890).
          if (index !== 1 || this.foundation !== 'chain' || state.otherSide) return fail(`Nem értelmezhető tétel: „${item}”.`);
          state.otherSide = true;
          working = [...working].reverse().slice(1);
          state.cursor = 0;
          state.last = null;
          return;
        case 'repeat':
          for (let t = 0; t < step.times; t += 1) step.steps.forEach((inner) => apply(inner, item));
          return;
        case 'turning-chain':
          turningNodes.push(...this.chains(step.count));
          return;
        case 'chain':
          this.spaces.push({ id: `s${this.spaces.length + 1}`, chains: this.chains(step.count) });
          return;
        case 'skip': {
          if (step.what === 'space') {
            // Láncív kihagyása: a kurzor a következő láncíven túlra lép, célpont nélkül.
            for (let k = 0; k < step.count; k += 1) {
              const w = working.findIndex((id, i) => i >= state.cursor && graph.spaceOfChain.has(id));
              if (w < 0) fail(`Nincs kihagyható láncív: „${item}”.`);
              const space = graph.spaceOfChain.get(working[w]!)!;
              state.cursor = Math.max(...space.chains.map((chain) => working.indexOf(chain))) + 1;
            }
            return;
          }
          if (state.cursor + step.count > working.length) fail(`Nincs ennyi kihagyható szem az előző sorban: „${item}”.`);
          skips.push({ positions: working.slice(state.cursor, state.cursor + step.count), anchoredBefore: this.anchoredCount });
          state.cursor += step.count;
          return;
        }
        case 'group': {
          const def = library.get(step.def);
          if (def?.kind !== 'group') return fail(`Ismeretlen összetett szem: „${item}”.`);
          const anchor = resolve(step.target, step.mode, item);
          const members = def.members.map((memberId) => {
            const member = library.get(memberId)!;
            return this.add(member, member.kind === 'chain' ? [] : anchor);
          });
          this.groups.push({ id: `g${this.groups.length + 1}`, def: def.id, members });
          const chainMembers = members.filter((id) => library.get(this.node(id).def)?.kind === 'chain');
          if (chainMembers.length > 0) this.spaces.push({ id: `s${this.spaces.length + 1}`, chains: chainMembers });
          return;
        }
        case 'stitch': {
          const def = library.get(step.def)!;
          for (let c = 0; c < step.count; c += 1) {
            const target = c > 0 && step.target === 'next-space' ? 'same-space' : step.target;
            const consumes = def.kind === 'joined' && def.base === 'spread' ? def.consumes : 1;
            // A lejjebb horgolt szem jelölt: ettől érvényes a korábbi sorba nyúló célpont (PQW-894, PQW-902).
            this.add(def, resolve(target, step.mode, item, consumes, step.depth ?? 2), target === 'down' ? ['spike'] : []);
          }
        }
      }
    };
    items.forEach((item, i) => apply(steps[i]!, item));

    // A szélső kihagyások szándékosak: a sor elején és végén (03 §10 B8). Az újrakezdett szakasz eleji kihagyás
    // viszont csak odavezet, ahol a szakasz kezdődik: azokat a szemeket a másik szakasz dolgozza fel (PQW-901).
    for (const { positions, anchoredBefore } of skips) {
      const navigation = resumed !== null && anchoredBefore === anchoredAtStart;
      if (!navigation && (anchoredBefore === anchoredAtStart || anchoredBefore === this.anchoredCount)) this.skipped.push(...positions);
    }

    const layerNodes = this.stitches.slice(firstNode).map((node) => node.id);
    const afterTurning = turningNodes.length > 0 ? layerNodes.slice(layerNodes.indexOf(turningNodes[turningNodes.length - 1]!) + 1) : layerNodes;
    const firstStitch = afterTurning.find((id) => library.get(this.node(id).def)?.kind !== 'chain');

    // A fordulólánc a szöveg szerint számít-e; ha eltér a minta beállításától, a sor felülírást kap.
    const hasTurning = turning !== undefined || (index === 1 && this.foundation === 'chain' && working.length < below.positions.length);
    if (hasTurning && firstStitch !== undefined) {
      const firstDef = library.get(this.node(firstStitch).def)!;
      const expected = turningChainCountsFor(conventions.turningChainCounts, firstDef, traditionOf(conventions), round ? 'round' : 'row');
      if (expected !== textCounts && !countsFromSettings) {
        if (opening === null) fail('Az 1. sor fordulóláncának számolása eltér a minta beállításától.');
        this.events[this.events.length - 1] = { ...opening!, conventions: { ...opening!.conventions, turningChainCounts: textCounts } };
      }
    }

    if (ending?.[1] === 'join-slip') {
      // A láncszembe horgolt 1. körben a kezdőlánc a láncalap vége (graph.ts).
      const hookChain = index === 1 && this.foundation === 'chain' ? this.stitches[firstNode - 1]?.id : undefined;
      const target =
        ending[2] === 'turning-chain'
          ? (turningNodes[turningNodes.length - 1] ?? hookChain)
          : afterTurning.find((id) => !turningNodes.includes(id));
      if (target === undefined) fail('A kör zárásának nincs célpontja.');
      this.add(slip, [{ into: 'stitch', id: target!, mode: 'both-loops' }]);
    }
    if (ending || spiralEnd) {
      this.events.push({ after: this.previous ?? fail('Üres sor.'), kind: ending ? ending[1] : 'spiral', statedCount: stated, ...marks });
      if (ending?.[1] === 'fasten-off') this.previous = null;
    } else {
      this.pendingCount = { index, stated };
    }
  }

  /** Az esemény nélküli utolsó sor szemszáma; a darab végén vetjük össze. */
  private pendingCount: { index: number; stated: number } | null = null;

  private node(id: NodeId): StitchNode {
    return this.stitches[Number(id.slice(1)) - 1]!;
  }

  private checkCounts(piece: Piece): void {
    const pattern: Pattern = { formatVersion: 1, title: this.title, conventions: this.options.conventions, pieces: [piece] };
    const graph = buildPieceGraph(pattern, piece, this.options.library);
    for (const layer of graph.layers.slice(1)) {
      const stated = layer.closing?.statedCount ?? (this.pendingCount?.index === layer.index ? this.pendingCount.stated : undefined);
      if (stated !== undefined && stated !== layer.stitchCount) {
        throw new ReadFailure(
          this.layerLines.get(layer.index) ?? 0,
          `${layer.index}. ${layer.shape === 'row' ? 'sor' : 'kör'}: a szöveg ${stated} szemet ír, a visszaolvasott gráf szerint ${layer.stitchCount}.`,
        );
      }
    }
  }
}
