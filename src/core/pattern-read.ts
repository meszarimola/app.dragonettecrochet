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
 * sor végi öltésszámot is összeveti a visszaolvasott gráf számolásával.
 */

import { buildPieceGraph, type PieceGraph } from './graph.ts';
import { modeAsWorked, type Step, type StepTarget } from './pattern-steps.ts';
import { VOCABULARIES, isDecrease, isIncrease, refOf, renderStep, type PhraseKey, type Vocabulary } from './pattern-text.ts';
import type { StitchLibrary } from './stitch-library.ts';
import type {
  Anchor,
  LayerEvent,
  Locale,
  NodeId,
  Pattern,
  PatternConventions,
  Piece,
  Ring,
  Space,
  StitchDef,
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
  const headings = new Set([vocabulary.headings.abbreviations, vocabulary.headings.legend]);
  const pieceBlocks = rest.filter((block) => !headings.has(block[0]!.text));
  if (pieceBlocks.length === 0) throw new ReadFailure(titleBlock[0]!.number, 'A szövegben nincs darab.');

  const pieces = pieceBlocks.map((block, index) =>
    new PieceReader(`p${index + 1}`, block, options, vocabulary, titleBlock[0]!.text).read(),
  );
  return { formatVersion: 1, title: titleBlock[0]!.text, conventions: options.conventions, pieces };
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
];

/** A tétel lépése: az a lépés, amelyet a szövegíró betű szerint így írna ki. */
function parseItem(text: string, line: number, options: ReadOptions, vocabulary: Vocabulary): Step {
  const { library, locale } = options;
  const matches = (step: Step) => {
    try {
      return renderStep(step, library, locale) === text;
    } catch {
      return false;
    }
  };

  if (text.startsWith('[')) {
    const close = text.lastIndexOf(']');
    const times = Number(/\d+/.exec(text.slice(close))?.[0]);
    if (close > 0 && Number.isInteger(times)) {
      const steps = splitItems(text.slice(1, close)).map((item) => parseItem(item, line, options, vocabulary));
      const step: Step = { kind: 'repeat', steps, times };
      if (matches(step)) return step;
    }
    throw new ReadFailure(line, `Nem értelmezhető ismétlés: „${text}”.`);
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
  const modes = MODES.filter((mode) => mode === 'both-loops' || text.includes(vocabulary.mode(mode, '').trim()));

  for (const def of defs) {
    if (def.kind === 'chain' || def.kind === 'space' || def.kind === 'ring') continue;
    if (!text.includes(probe(def, library, locale))) continue;
    for (const { target, into } of targets) {
      for (const mode of modes) {
        if (def.kind === 'group') {
          const step: Step = { kind: 'group', def: def.id, target, mode, into };
          if (matches(step)) return step;
          continue;
        }
        const plain = def.kind === 'basic' || def.kind === 'slip';
        for (const count of new Set([1, n])) {
          if (count > 1 && (!plain || target === 'same')) continue;
          const step: Step = { kind: 'stitch', def: def.id, count, target, mode, into };
          if (matches(step)) return step;
        }
      }
    }
  }
  throw new ReadFailure(line, `Nem értelmezhető tétel: „${text}”.`);
}

/** A szövegrész, amelynek egy öltés tételében mindenképp szerepelnie kell; ezzel szűrjük a jelölteket. */
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
  private foundation: 'chain' | 'ring' = 'chain';
  /** Rétegenként a szöveg sora, az öltésszám hibájához. */
  private readonly layerLines = new Map<number, number>();

  constructor(id: string, lines: readonly Line[], options: ReadOptions, vocabulary: Vocabulary, title: string) {
    this.id = id;
    this.lines = lines;
    this.options = options;
    this.vocabulary = vocabulary;
    this.title = title;
  }

  read(): Piece {
    const [nameLine, foundationLine, ...layerLines] = this.lines;
    if (!foundationLine) throw new ReadFailure(nameLine!.number, 'A darab neve után a láncalap vagy a varázskör következik.');
    this.readFoundation(foundationLine);

    let index = 1;
    layerLines.forEach((line, i) => {
      const header = this.header(line);
      if (header.from !== index) throw new ReadFailure(line.number, `A sorszám nem folytatódik: ${index} helyett ${header.from}.`);
      for (let layer = header.from; layer <= header.to; layer += 1) {
        const isLast = i === layerLines.length - 1 && layer === header.to;
        this.readLayer(layer, header, isLast);
        index += 1;
      }
    });

    const piece = this.piece();
    this.checkCounts(piece);
    return piece;
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
    };
  }

  private graph(): PieceGraph {
    const pattern: Pattern = { formatVersion: 1, title: this.title, conventions: this.options.conventions, pieces: [] };
    return buildPieceGraph(pattern, this.piece(), this.options.library);
  }

  private byKind(kind: StitchDef['kind']): StitchDef {
    const def = [...this.options.library.values()].find((candidate) => candidate.kind === kind);
    if (!def) throw new Error(`A könyvtárban nincs ilyen fajtájú öltés: ${kind}`);
    return def;
  }

  /** Hány öltés kapott célpontot eddig a darabban; a sor széli kihagyás felismeréséhez. */
  private anchoredCount = 0;

  private add(def: StitchDef, anchors: readonly Anchor[]): NodeId {
    if (anchors.length > 0) this.anchoredCount += 1;
    const id = `n${this.stitches.length + 1}`;
    this.stitches.push({ id, def: def.id, prev: this.previous, anchors });
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
    if (!Number.isInteger(count) || count < 1 || line.text !== v.foundation(count)) {
      throw new ReadFailure(line.number, `Láncalapot vagy varázskört vártunk: „${line.text}”.`);
    }
    this.chains(count);
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

    // A sor vége: esemény, öltésszám.
    let body = header.body;
    const slip = this.byKind('slip');
    const endings: [string, LayerEvent['kind'], 'turning-chain' | 'first-stitch' | null][] = [
      [v.closings.turn, 'turn', null],
      [v.closings['fasten-off'], 'fasten-off', null],
      [v.closings.spiral, 'spiral', null],
      [v.join(refOf(slip, locale), 'turning-chain'), 'join-slip', 'turning-chain'],
      [v.join(refOf(slip, locale), 'first-stitch'), 'join-slip', 'first-stitch'],
    ];
    const ending = endings.find(([text]) => body.endsWith(` ${text}`));
    if (ending) body = body.slice(0, -(ending[0].length + 1));
    else if (!isLast) fail('A sor vége hiányzik: fordítás, a kör zárása vagy a fonal elvágása.');

    const countMatch = /^(.*) (\(\d+ [^()]+\))\.$/.exec(body);
    const stated = Number(/\d+/.exec(countMatch?.[2] ?? '')?.[0]);
    if (!countMatch || countMatch[2] !== v.count(stated)) fail('Hiányzik az öltésszám a sor végén, pl. „(15 öltés).”');
    body = countMatch![1]!;

    // Az előző réteg pozíciói a haladási irányban.
    const graph = this.graph();
    const below = graph.layers[graph.layers.length - 1]!;
    const opening = index === 1 ? null : this.events[this.events.length - 1]!;
    const direction = index === 1 ? (this.foundation === 'chain' ? -1 : 1) : opening!.kind === 'turn' ? -1 : 1;
    let working = direction === 1 ? [...below.positions] : [...below.positions].reverse();
    const previousSide = index === 1 ? 'right' : graph.layers[index - 1]!.side;
    const side = opening?.kind === 'turn' ? (previousSide === 'right' ? 'wrong' : 'right') : previousSide;

    // Az 1. sor a láncalapon: a horog felőli láncszemek a fordulólánc.
    let fromHookCounts: StitchDef | null = null;
    if (index === 1 && this.foundation === 'chain') {
      const chain = Number(/\d+/.exec(body)?.[0]);
      const notes: (StitchDef | null)[] = [null, ...[...library.values()].filter((def) => def.kind === 'basic')];
      const prefix = notes
        .map((def) => ({ def, text: v.fromHook(chain, def ? v.skippedChainsCount(def, locale) : null) }))
        .sort((a, b) => b.text.length - a.text.length)
        .find(({ text }) => body.startsWith(text));
      if (!prefix || !Number.isInteger(chain) || chain < 1 || chain > working.length) {
        fail(`Az 1. sor elején azt vártuk, hányadik láncszemtől kezdünk: „${v.fromHook(3, null).trim()}”.`);
      }
      fromHookCounts = prefix!.def;
      body = body.slice(prefix!.text.length);
      working = working.slice(chain - 1);
    }

    const steps = splitItems(body).map((item) => parseItem(item, header.line, this.options, v));
    const turning = steps.find((step): step is Step & { kind: 'turning-chain' } => step.kind === 'turning-chain');
    const textCounts = fromHookCounts !== null || (turning !== undefined && turning.countsAs !== null);

    const state = { cursor: index >= 2 && textCounts ? 1 : 0, last: null as Last };
    const anchoredAtStart = this.anchoredCount;
    if (state.cursor === 1) state.last = { kind: 'stitch', w: 0 };
    const firstNode = this.stitches.length;
    const turningNodes: NodeId[] = [];
    const skips: { positions: NodeId[]; anchoredBefore: number }[] = [];

    const resolve = (target: StepTarget, mode: StitchInsertion, item: string, consumes = 1): Anchor[] => {
      const missing = (what: string) => fail(`${what} ehhez: „${item}”.`);
      switch (target) {
        case 'none':
          return [];
        case 'ring': {
          const ring = this.rings[0];
          return ring ? [{ into: 'ring', id: ring.id }] : missing('Nincs varázskör');
        }
        case 'same':
          if (state.last?.kind !== 'stitch') return missing('Nincs előző öltés');
          return [{ into: 'stitch', id: working[state.last.w]!, mode: modeAsWorked(mode, side) }];
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
          if (state.cursor + consumes > working.length) return missing('Nincs több öltés az előző sorban');
          const anchors = working
            .slice(state.cursor, state.cursor + consumes)
            .map((id): Anchor => ({ into: 'stitch', id, mode: modeAsWorked(mode, side) }));
          state.cursor += consumes;
          state.last = { kind: 'stitch', w: state.cursor - 1 };
          return anchors;
        }
      }
    };

    const apply = (step: Step, item: string): void => {
      switch (step.kind) {
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
          if (state.cursor + step.count > working.length) fail(`Nincs ennyi kihagyható öltés az előző sorban: „${item}”.`);
          skips.push({ positions: working.slice(state.cursor, state.cursor + step.count), anchoredBefore: this.anchoredCount });
          state.cursor += step.count;
          return;
        }
        case 'group': {
          const def = library.get(step.def);
          if (def?.kind !== 'group') return fail(`Ismeretlen összetett öltés: „${item}”.`);
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
            this.add(def, resolve(target, step.mode, item, consumes));
          }
        }
      }
    };
    splitItems(body).forEach((item, i) => apply(steps[i]!, item));

    // A szélső kihagyások szándékosak: a sor elején és végén (03 §10 B8).
    for (const { positions, anchoredBefore } of skips) {
      if (anchoredBefore === anchoredAtStart || anchoredBefore === this.anchoredCount) this.skipped.push(...positions);
    }

    const layerNodes = this.stitches.slice(firstNode).map((node) => node.id);
    const afterTurning = turningNodes.length > 0 ? layerNodes.slice(layerNodes.indexOf(turningNodes[turningNodes.length - 1]!) + 1) : layerNodes;
    const firstStitch = afterTurning.find((id) => library.get(this.node(id).def)?.kind !== 'chain');

    // A fordulólánc a szöveg szerint számít-e; ha eltér a minta beállításától, a sor felülírást kap.
    const hasTurning = turning !== undefined || (index === 1 && this.foundation === 'chain' && working.length < below.positions.length);
    if (hasTurning && firstStitch !== undefined) {
      const firstDef = library.get(this.node(firstStitch).def)!;
      const setting = conventions.turningChainCounts;
      const expected = setting === 'stitch-default' ? firstDef.turningChainCounts : setting;
      if (expected !== textCounts) {
        if (opening === null) fail('Az 1. sor fordulóláncának számolása eltér a minta beállításától.');
        this.events[this.events.length - 1] = { ...opening!, conventions: { ...opening!.conventions, turningChainCounts: textCounts } };
      }
    }

    if (ending?.[1] === 'join-slip') {
      const target = ending[2] === 'turning-chain' ? turningNodes[turningNodes.length - 1] : afterTurning.find((id) => !turningNodes.includes(id));
      if (target === undefined) fail('A kör zárásának nincs célpontja.');
      this.add(slip, [{ into: 'stitch', id: target!, mode: 'both-loops' }]);
    }
    if (ending) {
      this.events.push({ after: this.previous ?? fail('Üres sor.'), kind: ending[1], statedCount: stated });
      if (ending[1] === 'fasten-off') this.previous = null;
    } else {
      this.pendingCount = { index, stated };
    }
  }

  /** Az esemény nélküli utolsó sor öltésszáma; a darab végén vetjük össze. */
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
          `${layer.index}. ${layer.shape === 'row' ? 'sor' : 'kör'}: a szöveg ${stated} öltést ír, a visszaolvasott gráf szerint ${layer.stitchCount}.`,
        );
      }
    }
  }
}
