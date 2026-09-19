// KB: core-domain §9; 04 §3.2, 04 §3.3, 04 §3.4, 04 §5.4, 04 §5.6, 04 §5.7, 04 §9.1, 04 §9.8

import { SHAPE_NAMES, evenDistribution, roundOps, shapeGaugeOf, shapeSchedule, type Schedule, type ShapeCode } from './amigurumi.ts';
import { buildPieceGraph, type PieceGraph } from './graph.ts';
import { text, type CoreText } from './messages.ts';
import { withGeneratedTitle } from './pattern-title.ts';
import { libraryFor, resolveStitch } from './stitch-variants.ts';
import { traditionOf, turningChainCountsFor } from './tradition.ts';
import type {
  Anchor,
  LayerEvent,
  NodeId,
  Pattern,
  PatternConventions,
  Piece,
  PieceSection,
  Ring,
  RoundMark,
  ShapeSpec,
  StitchDefId,
  StitchGroup,
  StitchInsertion,
  StitchNode,
} from './types.ts';

export interface PartOptions {
  readonly name: string;
  readonly shape: ShapeSpec;
  readonly stagger: boolean;
  readonly eyes: boolean;
}

export type JoinMethod = 'sewn' | 'continuous';

export interface JoinOptions {
  readonly method: JoinMethod;
  readonly distribute: boolean;
}

// KB: core-domain §2
export type PartCode =
  | 'open-start-piece'
  | 'no-previous-piece'
  | 'previous-piece-broken'
  | 'continuous-closed-end'
  | 'continuous-needs-open-start'
  | 'continuous-count-differs'
  | 'sewn-count-differs'
  | 'round-growth'
  | 'oval-ends-increase'
  | 'internal-error';

export type AmigurumiCode = ShapeCode | PartCode;

export type AmigurumiResult =
  | { readonly ok: true; readonly pattern: Pattern; readonly schedule: Schedule }
  | { readonly ok: false; readonly reason: CoreText<AmigurumiCode> };

const fail = (reason: CoreText<AmigurumiCode>): AmigurumiResult => ({ ok: false, reason });

const OPEN_START: CoreText<AmigurumiCode> = text('open-start-piece');

export function partName(part: PartOptions): string {
  return part.name.trim() || SHAPE_NAMES[part.shape.kind];
}

export function createAmigurumi(pattern: Pattern, part: PartOptions, under3: boolean): AmigurumiResult {
  const planned = shapeSchedule(part.shape, shapeGaugeOf(pattern, part.shape));
  if (!planned.ok) return planned;
  const { schedule } = planned;
  if (schedule.start === 'open') return fail(OPEN_START);

  const name = partName(part);
  const writer = new PieceWriter();
  const marks = sectionMarks(schedule, part.eyes, under3);
  const problem = writeSection(writer, { schedule, stagger: part.stagger, below: null, marks, firstLayer: 1, conventions: pattern.conventions });
  if (problem) return fail(problem);

  const built: Pattern = {
    formatVersion: pattern.formatVersion,
    title: name,
    ...(pattern.notation ? { notation: pattern.notation } : {}),
    ...(pattern.gauge ? { gauge: pattern.gauge } : {}),
    conventions: { ...pattern.conventions, roundEnd: 'spiral' },
    pieces: [writer.piece('p1', name, [sectionOf(part, name, 1)])],
    toy: { under3 },
  };
  // KB: core-domain §1
  const result = withGeneratedTitle(built, pattern, name, Object.values(SHAPE_NAMES));
  return { ok: true, pattern: result, schedule };
}

export function addAmigurumiPart(pattern: Pattern, part: PartOptions, join: JoinOptions, under3: boolean): AmigurumiResult {
  const previous = pattern.pieces.at(-1);
  if (!previous?.sections?.length) {
    return fail(text('no-previous-piece'));
  }
  const planned = shapeSchedule(part.shape, shapeGaugeOf(pattern, part.shape));
  if (!planned.ok) return planned;
  const { schedule } = planned;

  let graph: PieceGraph;
  try {
    graph = buildPieceGraph(pattern, previous, libraryFor(pattern));
  } catch {
    return fail(text('previous-piece-broken'));
  }
  const lastLayer = graph.layers.length - 1;
  const lastCount = graph.layers[lastLayer]!.stitchCount;
  const closedEnd = previous.events.at(-1)?.marks?.includes('close-opening') === true;
  const name = partName(part);
  const marks = sectionMarks(schedule, part.eyes, under3);
  const conventions = { ...pattern.conventions, roundEnd: 'spiral' as const };

  if (join.method === 'continuous') {
    if (closedEnd) return fail(text('continuous-closed-end'));
    if (schedule.start !== 'open') return fail(text('continuous-needs-open-start'));
    const first = schedule.counts[0]!;
    if (first !== lastCount && !join.distribute) {
      return fail(text('continuous-count-differs', { previous: lastCount, first }));
    }
    const writer = new PieceWriter(previous);
    writer.continueFromEnd();
    const problem = writeSection(writer, { schedule, stagger: part.stagger, below: graph.layers[lastLayer]!.positions, marks, firstLayer: lastLayer + 1, conventions });
    if (problem) return fail(problem);
    const piece = writer.piece(previous.id, previous.name, [...previous.sections, sectionOf(part, name, lastLayer + 1)]);
    return { ok: true, pattern: { ...pattern, conventions, pieces: [...pattern.pieces.slice(0, -1), piece], toy: { under3 } }, schedule };
  }

  if (schedule.start === 'open') return fail(OPEN_START);
  const id = `p${1 + Math.max(0, ...pattern.pieces.map((piece) => Number(/\d+$/.exec(piece.id)?.[0] ?? 0)))}`;
  const writer = new PieceWriter();
  const problem = writeSection(writer, { schedule, stagger: part.stagger, below: null, marks, firstLayer: 1, conventions });
  if (problem) return fail(problem);

  const ownLayer = (schedule.end === 'open' ? schedule.counts.length - 1 : markRound(schedule)) + 1;
  const ownCount = schedule.counts[ownLayer - 1]!;
  const target = closedEnd ? closestLayer(graph, ownCount) : lastLayer;
  const targetCount = graph.layers[target]!.stitchCount;
  if (ownCount !== targetCount && !join.distribute) {
    return fail(text('sewn-count-differs', { round: ownLayer, count: ownCount, previousRound: target, previousCount: targetCount }));
  }
  const joined = {
    a: { piece: id, layer: ownLayer },
    b: { piece: previous.id, layer: target },
    ...(ownCount === targetCount ? {} : { distribution: evenDistribution(ownCount, targetCount) }),
  };
  return {
    ok: true,
    pattern: {
      ...pattern,
      conventions,
      pieces: [...pattern.pieces, writer.piece(id, name, [sectionOf(part, name, 1)])],
      joins: [...(pattern.joins ?? []), joined],
      toy: { under3 },
    },
    schedule,
  };
}

function sectionOf(part: PartOptions, name: string, layer: number): PieceSection {
  return { name, layer, shape: part.shape, stagger: part.stagger };
}

/** KB: 04 §5.4 */
function closestLayer(graph: PieceGraph, count: number): number {
  let best = graph.layers.length - 1;
  for (let index = 1; index < graph.layers.length; index += 1) {
    if (Math.abs(graph.layers[index]!.stitchCount - count) <= Math.abs(graph.layers[best]!.stitchCount - count)) best = index;
  }
  return best;
}

/** KB: 04 §4.4, 04 §9.8 */
export function markRound(schedule: Schedule): number {
  const { counts } = schedule;
  const last = counts.length - 1;
  if (schedule.end !== 'closed') return last;
  const max = Math.max(...counts);
  const peak = counts.lastIndexOf(max);
  const small = counts.findIndex((count, i) => i > peak && count <= max / 2);
  return small > 0 ? small - 1 : last;
}

export function sectionMarks(schedule: Schedule, eyes: boolean, under3: boolean): Map<number, RoundMark[]> {
  const marks = new Map<number, RoundMark[]>();
  const atMark: RoundMark[] = [];
  if (eyes) atMark.push(under3 ? 'embroider-eyes' : 'safety-eyes');
  // A flat oval, a sole for instance, is not stuffed.
  if (schedule.start !== 'chain') atMark.push('stuffing');
  if (atMark.length > 0) marks.set(markRound(schedule), atMark);
  if (schedule.end === 'closed') {
    const last = schedule.counts.length - 1;
    marks.set(last, [...(marks.get(last) ?? []), 'close-opening']);
  }
  return marks;
}

const into = (id: NodeId, mode: StitchInsertion): Anchor => ({ into: 'stitch', id, mode });

/** A round is dense when more than this share of its positions increases or decreases. */
const DENSE_SHARE = 0.4;
/** The price of a third stack; any number of seconds stays cheaper. KB: 04 §3.2 */
const STACK_COST = 1000;

interface SectionWrite {
  readonly schedule: Schedule;
  readonly stagger: boolean;
  /** `null`: the section starts with a magic ring. */
  readonly below: readonly NodeId[] | null;
  readonly marks: ReadonlyMap<number, readonly RoundMark[]>;
  readonly firstLayer: number;
  readonly conventions: PatternConventions;
}

function writeSection(writer: PieceWriter, section: SectionWrite): CoreText<AmigurumiCode> | null {
  if (section.schedule.oval && section.below === null) return writeOval(writer, section);
  const { counts, backLoop } = section.schedule;
  let positions: readonly NodeId[] = section.below ?? [];
  // How many increases, or decreases, already stack on this position. KB: 04 §3.2
  let depth = { inc: positions.map(() => 0), dec: positions.map(() => 0) };
  let direction = 0;
  let run = 0;
  for (let i = 0; i < counts.length; i += 1) {
    const count = counts[i]!;
    const loop: StitchInsertion = backLoop.includes(i) ? 'back-loop' : 'both-loops';
    const produced: NodeId[] = [];
    const next = { inc: [] as number[], dec: [] as number[] };
    if (i === 0 && section.below === null) {
      const ring = writer.ring();
      writer.add('ch');
      produced.push(...writer.into(ring, count));
      next.inc.push(...produced.map(() => 0));
      next.dec.push(...produced.map(() => 0));
      direction = 1;
      run = 0;
    } else {
      const sign = Math.sign(count - positions.length);
      run = sign !== 0 && sign === direction ? run + 1 : 0;
      direction = sign;
      // If every stitch of the previous round increases, there is nowhere to stagger to.
      const incDepth = depth.inc.every((d) => d > 0) ? depth.inc.map(() => 0) : depth.inc;
      const deep = sign > 0 ? incDepth : depth.dec;
      // A third stack is forbidden; in a dense round avoid even the second, so the next round still has room. KB: 04 §3.2
      const dense = Math.abs(count - positions.length) > DENSE_SHARE * positions.length;
      const cost = (position: number) => {
        const d = deep[position] ?? 0;
        return d >= 2 ? STACK_COST : dense && d >= 1 ? 1 : 0;
      };
      const ops = roundOps(positions.length, count, section.stagger && run % 2 === 1, cost);
      if (!ops) {
        return text('round-growth', { round: section.firstLayer + i, previous: positions.length, count });
      }
      let p = 0;
      for (const op of ops) {
        if (op === 'sc') {
          produced.push(writer.add('sc', [into(positions[p]!, loop)]));
          next.inc.push(0);
          next.dec.push(0);
          p += 1;
        } else if (op === 'inc') {
          produced.push(...writer.into(into(positions[p]!, loop), 2));
          next.inc.push(incDepth[p]! + 1, incDepth[p]! + 1);
          next.dec.push(0, 0);
          p += 1;
        } else {
          const [def, mode]: [StitchDefId, StitchInsertion] = loop === 'back-loop' ? ['sc2tog', 'back-loop'] : ['invdec', 'front-loop'];
          produced.push(writer.add(def, [into(positions[p]!, mode), into(positions[p + 1]!, mode)]));
          next.inc.push(0);
          next.dec.push(Math.max(depth.dec[p]!, depth.dec[p + 1]!) + 1);
          p += 2;
        }
      }
    }
    positions = produced;
    depth = next;
    const marks = section.marks.get(i);
    writer.event(i === counts.length - 1 ? 'fasten-off' : 'spiral', { statedCount: count, ...(marks?.length ? { marks } : {}) });
  }
  return null;
}

// KB: 04 §3.4, 04 §9.4
function writeOval(writer: PieceWriter, section: SectionWrite): CoreText<AmigurumiCode> | null {
  const { counts, oval } = section.schedule;
  const { chains: L, perEnd, stitch, turningChain: T } = oval!;
  const { conventions } = section;
  const counted = turningChainCountsFor(conventions.turningChainCounts, resolveStitch(stitch)!, traditionOf(conventions), 'round');
  const chains = Array.from({ length: L }, () => writer.add('ch'));
  // The beginning chain is the T chains nearest the hook (the last in yarn order); the rest is the worked foundation.
  const working = chains.slice(0, L - T);
  const W = working.length;
  const other = (id: NodeId): Anchor => ({ into: 'underside', id });

  // A counting beginning chain is the round's first position: the next round's first stitch goes into its top.
  let positions: NodeId[] = counted ? [chains[L - 1]!] : [];
  for (let k = W - 1; k >= 1; k -= 1) positions.push(writer.add(stitch, [into(working[k]!, 'both-loops')]));
  positions.push(...writer.into(into(working[0]!, 'both-loops'), perEnd + 1, stitch));
  for (let k = 1; k <= W - 2; k += 1) positions.push(writer.add(stitch, [other(working[k]!)]));
  positions.push(...writer.into(other(working[W - 1]!), counted ? perEnd - 1 : perEnd, stitch));

  // Built in yarn order: start of end B (c), straight (s), end A (a), straight (s), the rest of end B (a - c).
  const straight = W - 2;
  let end = perEnd + 1;
  let head = counted ? 2 : 1;
  let depth = positions.map(() => 0);
  for (let i = 0; i < counts.length; i += 1) {
    if (i > 0) {
      const P = positions.length;
      const ops = new Map<number, 'sc' | 'inc'>();
      const region = (indices: readonly number[]) => {
        const cost = (j: number) => ((depth[indices[j]!] ?? 0) >= 2 ? STACK_COST : 0);
        const planned = roundOps(indices.length, indices.length + perEnd, section.stagger && i % 2 === 0, cost);
        if (!planned) return false;
        planned.forEach((op, j) => ops.set(indices[j]!, op === 'inc' ? 'inc' : 'sc'));
        return true;
      };
      const endA = Array.from({ length: end }, (_, j) => head + straight + j);
      const endB = [...Array.from({ length: end - head }, (_, j) => P - (end - head) + j), ...Array.from({ length: head }, (_, j) => j)];
      if (!region(endA) || !region(endB)) return text('oval-ends-increase', { round: section.firstLayer + i });
      const produced: NodeId[] = [];
      const next: number[] = [];
      let nextHead = 0;
      positions.forEach((position, p) => {
        const inc = ops.get(p) === 'inc';
        const ids = inc ? writer.into(into(position, 'both-loops'), 2, stitch) : [writer.add(stitch, [into(position, 'both-loops')])];
        produced.push(...ids);
        for (const _ of ids) next.push(inc ? (depth[p] ?? 0) + 1 : 0);
        if (p < head) nextHead += ids.length;
      });
      positions = produced;
      depth = next;
      head = nextHead;
      end += perEnd;
    }
    if (positions.length !== counts[i]) {
      return text('internal-error', { inner: 'oval-round-count', round: section.firstLayer + i, count: positions.length, expected: counts[i]! });
    }
    const marks = section.marks.get(i);
    writer.event(i === counts.length - 1 ? 'fasten-off' : 'spiral', { statedCount: counts[i]!, ...(marks?.length ? { marks } : {}) });
  }
  return null;
}

class PieceWriter {
  readonly #base: Piece | undefined;
  readonly #stitches: StitchNode[];
  readonly #rings: Ring[];
  readonly #groups: StitchGroup[];
  readonly #events: LayerEvent[];
  #next: number;

  constructor(base?: Piece) {
    this.#base = base;
    this.#stitches = [...(base?.stitches ?? [])];
    this.#rings = [...(base?.rings ?? [])];
    this.#groups = [...(base?.groups ?? [])];
    this.#events = [...(base?.events ?? [])];
    const used = [...this.#stitches, ...this.#rings, ...this.#groups, ...(base?.spaces ?? [])].map((item) => Number(/\d+$/.exec(item.id)?.[0] ?? 0));
    this.#next = Math.max(0, ...used) + 1;
  }

  add(def: StitchDefId, anchors: readonly Anchor[] = []): NodeId {
    const id = `n${this.#next++}`;
    this.#stitches.push({ id, def, prev: this.#stitches.at(-1)?.id ?? null, anchors });
    return id;
  }

  ring(): Anchor {
    const node = this.add('magic-ring');
    const id = `r${this.#next++}`;
    this.#rings.push({ id, node });
    return { into: 'ring', id };
  }

  /** `n` stitches into one target; two or more into a stitch make an increase. */
  into(anchor: Anchor, n: number, def: StitchDefId = 'sc'): NodeId[] {
    const ids = Array.from({ length: n }, () => this.add(def, [anchor]));
    if ((anchor.into === 'stitch' || anchor.into === 'underside') && n >= 2) this.#groups.push({ id: `g${this.#next++}`, def: `inc-${n}${def}`, members: ids });
    return ids;
  }

  event(kind: LayerEvent['kind'], extra: Partial<LayerEvent> = {}): void {
    this.#events.push({ after: this.#stitches.at(-1)!.id, kind, ...extra });
  }

  /** Spiral instead of fastening off at the end of the piece: the next section continues from here. */
  continueFromEnd(): void {
    const last = this.#events.at(-1);
    if (last && last.after === this.#stitches.at(-1)?.id) this.#events[this.#events.length - 1] = { ...last, kind: 'spiral' };
  }

  piece(id: string, name: string, sections: readonly PieceSection[]): Piece {
    return {
      id,
      name,
      stitches: [...this.#stitches],
      spaces: [...(this.#base?.spaces ?? [])],
      rings: [...this.#rings],
      groups: [...this.#groups],
      events: [...this.#events],
      skipped: [...(this.#base?.skipped ?? [])],
      ...(this.#base?.corners === undefined ? {} : { corners: this.#base.corners }),
      sections,
    };
  }
}
