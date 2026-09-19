// KB: core-domain §24; 01 §8.2 rule 11, 01 §8.4 rule 21, 03 §1.3, 03 §2.1, 06 §5.3

import { buildPieceGraph, type PieceGraph, spacePositions } from './graph.ts';
import { modeAsWorked } from './insertion.ts';
import { type CoreData, type CoreText, nested, text } from './messages.ts';
import { type ColorRun, gridColorRows } from './pixel-chart.ts';
import type { StitchLibrary } from './stitch-library.ts';
import { skippedChains, traditionOf } from './tradition.ts';
import type {
  Anchor,
  GridTechnique,
  LayerEvent,
  NodeId,
  Pattern,
  PatternColor,
  Piece,
  RoundMark,
  StitchDef,
  StitchDefId,
  StitchInsertion,
  Tradition,
} from './types.ts';

/** KB: 03 §5.6 */
export type StepTarget = 'next' | 'same' | 'next-space' | 'same-space' | 'ring' | 'chain-ring' | 'none' | 'down';

/** KB: 03 §6, 03 §10 G35 */
interface ColorChange {
  readonly changeTo?: number;
}

export type Step =
  | ({
      readonly kind: 'stitch';
      readonly def: StitchDefId;
      readonly count: number;
      readonly target: StepTarget;
      /** Insertion as seen from the crocheter: already flipped on a wrong-side row. */
      readonly mode: StitchInsertion;
      readonly into: 'stitch' | 'chain';
      /** For a `down` target: how many rows lower (2 or 3). */
      readonly depth?: number;
    } & ColorChange)
  | ({
      readonly kind: 'group';
      readonly def: StitchDefId;
      readonly target: StepTarget;
      readonly mode: StitchInsertion;
      readonly into: 'stitch' | 'chain';
    } & ColorChange)
  | ({ readonly kind: 'chain'; readonly count: number } & ColorChange)
  | { readonly kind: 'skip'; readonly count: number; readonly what: 'stitch' | 'chain' | 'space' }
  | ({ readonly kind: 'turning-chain'; readonly count: number; readonly countsAs: StitchDefId | null } & ColorChange)
  | { readonly kind: 'repeat'; readonly steps: readonly Step[]; readonly times: number }
  /** KB: 04 §3.4 */
  | { readonly kind: 'other-side' };

export interface WrittenLayer {
  readonly index: number;
  /** KB: core-domain §12 */
  readonly row: number;
  readonly shape: 'row' | 'round';
  readonly side: 'right' | 'wrong';
  readonly fromHook: {
    readonly chain: number;
    readonly countsAs: StitchDefId | null;
    /** With a counting turning chain the chain space and the skipped chains belong to the foundation. Otherwise 0. KB: 03 §5.2 */
    readonly chains: number;
    /** After the skip, exactly one stitch into every remaining chain, as a single item. */
    readonly eachChain: boolean;
  } | null;
  readonly steps: readonly Step[];
  /** KB: core-domain §10 */
  readonly writtenCount: number;
  readonly closing: LayerEvent['kind'] | null;
  readonly joinTo: 'turning-chain' | 'first-stitch' | null;
  readonly colorChange: boolean;
  readonly jogFix: LayerEvent['jogFix'] | null;
  /** KB: 04 §5.6, 04 §5.7 */
  readonly marks: readonly RoundMark[];
}

export interface WrittenPiece {
  readonly name: string;
  readonly foundation:
    | { readonly kind: 'chain'; readonly count: number }
    | { readonly kind: 'ring' }
    | { readonly kind: 'chain-ring'; readonly count: number };
  readonly layers: readonly WrittenLayer[];
  /** `over` says which row a section resumed after a fasten-off continues above. KB: core-domain §12 */
  readonly sections: readonly { readonly name: string; readonly layer: number; readonly over?: number }[];
  readonly colorwork: {
    readonly technique: GridTechnique;
    readonly colors: readonly PatternColor[];
    readonly startColor: number;
    readonly rows: readonly (readonly ColorRun[])[];
  } | null;
}

// KB: core-domain §2
export type UnsupportedCode =
  | 'underside-place'
  | 'underside-backwards'
  | 'space-misplaced'
  | 'space-backwards'
  | 'stitch-misplaced'
  | 'stitch-backwards'
  | 'crossed'
  | 'group-start'
  | 'group-chains'
  | 'group-target'
  | 'chain-run'
  | 'stitch-kind'
  | 'decrease-targets'
  | 'decrease-used'
  | 'anchor-count'
  | 'join-target';

// KB: core-domain §2
export type WrittenCode = 'needs-foundation' | 'foundation-event' | 'layer-unsupported' | UnsupportedCode;

export class WrittenPatternError extends Error {
  readonly code: WrittenCode;
  readonly data: CoreData | undefined;
  readonly nodes: readonly NodeId[];

  constructor(message: CoreText<WrittenCode>, nodes: readonly NodeId[] = []) {
    // The `Error.message` is the code itself, so the developer log stays readable.
    super(message.code);
    this.code = message.code;
    this.data = message.data;
    this.nodes = nodes;
  }

  get coreText(): CoreText<WrittenCode> {
    return this.data === undefined ? { code: this.code } : { code: this.code, data: this.data };
  }
}

/** `nested()`'s code is generic; in this area the narrow code set applies. */
function wrap(code: WrittenCode, inner: CoreText): CoreText<WrittenCode> {
  return nested(code, inner) as CoreText<WrittenCode>;
}

export function writtenPieces(pattern: Pattern, library: StitchLibrary): WrittenPiece[] {
  return pattern.pieces.map((piece) => writtenPiece(pattern, piece, library));
}

function writtenPiece(pattern: Pattern, piece: Piece, library: StitchLibrary): WrittenPiece {
  const graph = buildPieceGraph(pattern, piece, library);
  const base = graph.layers[0]!;
  const first = base.stitches[0];
  if (first === undefined) throw new WrittenPatternError(text('needs-foundation'));
  const onChain = graph.defs.get(first)!.kind === 'chain';
  // Closing a chain ring is the only event that can sit on the foundation.
  const chainRing = onChain && base.shape === 'round' && base.closing?.kind === 'join-slip';
  if (base.closing !== null && !chainRing)
    throw new WrittenPatternError(text('foundation-event'), [base.closing.after]);

  const row1 = graph.layers[1];
  const kind: WrittenPiece['foundation']['kind'] = chainRing ? 'chain-ring' : onChain ? 'chain' : 'ring';
  const layers = graph.layers
    .slice(1)
    .map((_, i) => writtenLayer(graph, i + 1, kind, library, traditionOf(pattern.conventions)));
  const foundation: WrittenPiece['foundation'] = chainRing
    ? { kind: 'chain-ring', count: base.stitches.length }
    : onChain
      ? {
          kind: 'chain',
          count: base.stitches.length + (row1?.turningChain.length ?? 0) + (layers[0]?.fromHook?.chains ?? 0),
        }
      : { kind: 'ring' };
  const sections: WrittenPiece['sections'] = [
    ...(piece.sections ?? []).map(({ name, layer }) => ({ name, layer })),
    ...graph.layers.flatMap((candidate) => {
      const resume = candidate.opening?.kind === 'fasten-off' ? candidate.opening.resume : undefined;
      return resume?.name === undefined
        ? []
        : [{ name: resume.name, layer: candidate.index, over: graph.layers[candidate.below]!.row }];
    }),
  ];
  const grid = piece.grid;
  const colorwork: WrittenPiece['colorwork'] =
    grid && grid.colors.length > 1
      ? {
          technique: grid.technique,
          colors: grid.colors,
          startColor: piece.stitches[0]?.color ?? 0,
          rows: gridColorRows(grid.technique, grid.cells),
        }
      : null;
  return { name: piece.name, foundation, layers, sections, colorwork };
}

/** Seen from the crocheter: on a wrong-side row the loops and the post side flip. KB: 01 §8.4 rule 21 */
export { modeAsWorked };

export function countsAsOf(def: StitchDef): StitchDefId {
  return def.kind === 'joined' ? def.part : def.id;
}

type Last = { readonly kind: 'stitch'; readonly w: number } | { readonly kind: 'space'; readonly id: string } | null;

function writtenLayer(
  graph: PieceGraph,
  index: number,
  start: WrittenPiece['foundation']['kind'],
  library: StitchLibrary,
  _tradition: Tradition,
): WrittenLayer {
  const layer = graph.layers[index]!;
  const below = graph.layers[layer.below]!;
  // KB: 04 §3.4
  const oval = index === 1 && below.undersides.length > 0;
  // KB: core-domain §12
  const base = layer.basePositions ?? below.positions;
  const front = layer.direction === 1 && !oval ? base : [...base].reverse();
  const working = oval ? [...front, ...below.positions] : front;
  const workingIndex = new Map(front.map((id, w) => [id, w]));
  const undersideIndex = new Map<NodeId, number>(oval ? below.positions.map((id, k) => [id, front.length + k]) : []);
  let otherSide = false;
  const defOf = (id: NodeId) => graph.defs.get(id)!;
  // KB: core-domain §10, core-domain §17
  const countsAs = layer.firstStitch !== null && layer.turningChainCounts ? countsAsOf(defOf(layer.firstStitch)) : null;
  const hookRow = index === 1 && start === 'chain';
  const ringSpace = start === 'chain-ring' ? graph.spaceOfChain.get(graph.layers[0]!.stitches[0]!)?.id : undefined;

  const steps: Step[] = [];
  // After a turn the leading slip stitches travel over the cells, so the cursor starts at the beginning of the row. KB: 03 §5.2
  const slipsFirst = layer.opening?.kind === 'turn' && layer.travelSlips.length > 0;
  // KB: core-domain §17
  const cursorStart = !slipsFirst && layer.shape === 'round' && index >= 2 && layer.turningChainCounts ? 1 : 0;
  let cursor = cursorStart;
  let last: Last = cursorStart === 1 ? { kind: 'stitch', w: 0 } : null;

  const skip = (from: number, to: number) => {
    if (to <= from) return;
    const allChains = working.slice(from, to).every((id) => defOf(id).kind === 'chain');
    steps.push({ kind: 'skip', count: to - from, what: allChains ? 'chain' : 'stitch' });
  };

  const classify = (
    anchor: Anchor,
    owner: NodeId,
  ): { target: StepTarget; mode: StitchInsertion; into: 'stitch' | 'chain' } => {
    if (anchor.into === 'ring') return { target: 'ring', mode: 'both-loops', into: 'stitch' };
    if (anchor.into === 'underside') {
      const w = undersideIndex.get(anchor.id);
      // The far chain's other side is wrapped by the end increase, so no separate step is written for it.
      if (w === undefined || w === front.length) throw unsupported('underside-place', owner);
      if (!otherSide) {
        steps.push({ kind: 'other-side' });
        otherSide = true;
        last = null;
        cursor = Math.max(cursor, front.length + 1);
      }
      if (last?.kind === 'stitch' && last.w === w) return { target: 'same', mode: 'both-loops', into: 'chain' };
      if (w < cursor) throw unsupported('underside-backwards', owner);
      skip(cursor, w);
      cursor = w + 1;
      last = { kind: 'stitch', w };
      return { target: 'next', mode: 'both-loops', into: 'chain' };
    }
    if (anchor.into === 'space') {
      if (anchor.id === ringSpace) return { target: 'chain-ring', mode: 'both-loops', into: 'stitch' };
      const chains = spacePositions(below, graph.spaces.get(anchor.id)!).map((id) => workingIndex.get(id));
      if (chains.some((w) => w === undefined)) throw unsupported('space-misplaced', owner);
      const min = Math.min(...(chains as number[]));
      const max = Math.max(...(chains as number[]));
      let target: StepTarget;
      if (last?.kind === 'space' && last.id === anchor.id) target = 'same-space';
      else if (min >= cursor) {
        const passed = new Set<string>();
        for (let w = cursor; w < min; w += 1) {
          const space = graph.spaceOfChain.get(working[w]!);
          if (space) passed.add(space.id);
        }
        if (passed.size > 0) steps.push({ kind: 'skip', count: passed.size, what: 'space' });
        target = 'next-space';
        cursor = max + 1;
      } else throw unsupported('space-backwards', owner);
      last = { kind: 'space', id: anchor.id };
      return { target, mode: 'both-loops', into: 'stitch' };
    }

    const w = workingIndex.get(anchor.id);
    if (w === undefined) throw unsupported('stitch-misplaced', owner);
    const mode = modeAsWorked(anchor.mode, layer.side);
    const into = defOf(anchor.id).kind === 'chain' ? 'chain' : 'stitch';
    if (last?.kind === 'stitch' && last.w === w) return { target: 'same', mode, into };
    if (w < cursor) throw unsupported('stitch-backwards', owner);
    skip(cursor, w);
    cursor = w + 1;
    last = { kind: 'stitch', w };
    return { target: 'next', mode, into };
  };

  // KB: core-domain §2
  const unsupported = (reason: UnsupportedCode, node: NodeId) =>
    new WrittenPatternError(wrap('layer-unsupported', text(reason, { index, shape: layer.shape })), [node]);

  // KB: 03 §6, 03 §10 G35
  const colorOf = (nodeId: NodeId) => graph.nodes.get(nodeId)!.color ?? 0;
  const markChange = (color: number) => {
    for (let k = steps.length - 1; k >= 0; k -= 1) {
      const step = steps[k]!;
      if (step.kind === 'skip' || step.kind === 'other-side') continue;
      if (step.kind !== 'repeat') steps[k] = { ...step, changeTo: color };
      return;
    }
  };

  const handled = new Set<NodeId>();
  const stitches = layer.stitches;
  for (let i = 0; i < stitches.length; i += 1) {
    const id = stitches[i]!;
    const previousNode = graph.nodes.get(id)!.prev;
    if (previousNode !== null && colorOf(previousNode) !== colorOf(id)) markChange(colorOf(id));
    // The chain ring's slip stitch is part of the start and is described by the chain-ring row.
    if (
      handled.has(id) ||
      id === layer.joinSlip ||
      (ringSpace !== undefined && index === 1 && layer.travelSlips.includes(id))
    )
      continue;
    const node = graph.nodes.get(id)!;
    const def = defOf(id);
    if (node.flags?.includes('crossed')) throw unsupported('crossed', id);

    if (layer.turningChain.includes(id)) {
      for (const chain of layer.turningChain) handled.add(chain);
      if (!hookRow) steps.push({ kind: 'turning-chain', count: layer.turningChain.length, countsAs });
      // After the travelling slip stitches the turning chain stands on the last position crossed.
      if (slipsFirst) last = { kind: 'stitch', w: cursor - 1 };
      continue;
    }

    const group = graph.groupOf.get(id);
    if (group) {
      if (group.members[0] !== id) throw unsupported('group-start', id);
      for (const member of group.members) handled.add(member);
      const chains = group.members.filter((member) => defOf(member).kind === 'chain');
      if (chains.some((chain) => graph.spaceOfChain.get(chain)?.chains.every((c) => chains.includes(c)) !== true)) {
        throw unsupported('group-chains', id);
      }
      const anchored = group.members
        .map((member) => graph.nodes.get(member)!)
        .find((member) => member.anchors.length > 0);
      if (!anchored || anchored.anchors.length !== 1) throw unsupported('group-target', id);
      steps.push({ kind: 'group', def: group.def, ...classify(anchored.anchors[0]!, id) });
      continue;
    }

    switch (def.kind) {
      case 'chain': {
        const run = [id];
        while (
          i + 1 < stitches.length &&
          defOf(stitches[i + 1]!).kind === 'chain' &&
          !graph.groupOf.has(stitches[i + 1]!)
        ) {
          i += 1;
          run.push(stitches[i]!);
        }
        // KB: core-domain §25
        const spaces = new Set(
          run.map((chain) => graph.spaceOfChain.get(chain)).filter((space) => space !== undefined),
        );
        if (spaces.size > 1) throw unsupported('chain-run', id);
        const space = [...spaces][0];
        if (space && (space.chains.length !== run.length || !run.every((chain) => space.chains.includes(chain)))) {
          throw unsupported('chain-run', id);
        }
        steps.push({ kind: 'chain', count: run.length });
        break;
      }
      case 'picot':
        steps.push({ kind: 'stitch', def: def.id, count: 1, target: 'none', mode: 'both-loops', into: 'stitch' });
        break;
      case 'ring':
      case 'space':
      case 'group':
        throw unsupported('stitch-kind', id);
      default: {
        const anchor = node.anchors[0];
        const depth = anchor?.into === 'stitch' ? index - (graph.layerOf.get(anchor.id) ?? index) : 0;
        if (node.flags?.includes('spike') && anchor?.into === 'stitch' && node.anchors.length === 1 && depth >= 2) {
          // In mosaic the spike passes over the skipped chain above it, so the cursor steps over that too. KB: 03 §5.6
          if (cursor < working.length && graph.piece.skipped.includes(working[cursor]!)) cursor += 1;
          last = null;
          steps.push({
            kind: 'stitch',
            def: def.id,
            count: 1,
            target: 'down',
            depth,
            mode: modeAsWorked(anchor.mode, layer.side),
            into: 'stitch',
          });
          break;
        }
        if (def.kind === 'joined' && def.base === 'spread') {
          const ws = node.anchors.map((anchor) => (anchor.into === 'stitch' ? workingIndex.get(anchor.id) : undefined));
          const start = ws[0];
          const consecutive = start !== undefined && ws.every((w, k) => w === start + k);
          if (!consecutive || ws.length !== def.consumes) throw unsupported('decrease-targets', id);
          const first = classify(node.anchors[0]!, id);
          if (first.target !== 'next') throw unsupported('decrease-used', id);
          cursor = start + ws.length;
          last = { kind: 'stitch', w: cursor - 1 };
          steps.push({ kind: 'stitch', def: def.id, count: 1, ...first });
          break;
        }
        if (node.anchors.length !== 1) throw unsupported('anchor-count', id);
        steps.push({ kind: 'stitch', def: def.id, count: 1, ...classify(node.anchors[0]!, id) });
      }
    }
  }

  // KB: 03 §6
  const lastNode = stitches[stitches.length - 1];
  if (lastNode !== undefined) {
    const next = graph.piece.stitches[graph.order.get(lastNode)! + 1];
    if (next && next.prev === lastNode && colorOf(next.id) !== colorOf(lastNode)) markChange(colorOf(next.id));
  }

  // KB: 03 §10 B8
  const skippedAtEnd = working.map((id, w) => (w >= cursor && graph.piece.skipped.includes(id) ? w : -1));
  const lastSkipped = Math.max(-1, ...skippedAtEnd);
  if (lastSkipped >= cursor) skip(cursor, lastSkipped + 1);

  let joinTo: WrittenLayer['joinTo'] = null;
  if (layer.closing?.kind === 'join-slip') {
    const join = layer.joinSlip === null ? undefined : graph.nodes.get(layer.joinSlip);
    const anchor = join?.anchors[0];
    if (!join || join.anchors.length !== 1 || anchor?.into !== 'stitch' || anchor.id !== layer.positions[0]) {
      throw unsupported('join-target', layer.closing.after);
    }
    joinTo = layer.turningChainCounts ? 'turning-chain' : 'first-stitch';
  }

  // KB: 03 §5.2
  let leadChains = 0;
  let leadSkipped = 0;
  const [firstStep, secondStep] = steps;
  if (
    hookRow &&
    countsAs !== null &&
    firstStep?.kind === 'chain' &&
    secondStep?.kind === 'skip' &&
    secondStep.what === 'chain'
  ) {
    leadChains = firstStep.count;
    leadSkipped = secondStep.count;
    steps.splice(0, 2);
  }

  const written = foldRepeats(mergeSteps(steps, library), layer.shape === 'round');
  // Into every remaining chain one basic or slip stitch, with no color change.
  const [only] = written;
  const onlyKind = only?.kind === 'stitch' ? library.get(only.def)?.kind : undefined;
  const eachChain =
    hookRow &&
    written.length === 1 &&
    only?.kind === 'stitch' &&
    (onlyKind === 'basic' || onlyKind === 'slip') &&
    only.target === 'next' &&
    only.into === 'chain' &&
    only.changeTo === undefined &&
    only.count === working.length - cursorStart - leadSkipped;

  return {
    index,
    row: layer.row,
    shape: layer.shape,
    side: layer.side,
    fromHook: hookRow
      ? {
          // KB: core-domain §5
          chain: skippedChains(layer.turningChain.length, layer.turningChainCounts) + 1 + leadChains + leadSkipped,
          countsAs,
          chains: leadChains,
          eachChain,
        }
      : null,
    steps: written,
    writtenCount: layer.writtenCount,
    closing: layer.closing?.kind ?? null,
    joinTo,
    colorChange: layer.closing?.colorChange === true,
    jogFix: layer.closing?.jogFix ?? null,
    marks: layer.closing?.marks ?? [],
  };
}

export function mergeSteps(steps: readonly Step[], library: StitchLibrary): Step[] {
  const merged: Step[] = [];
  for (const step of steps) {
    const previous = merged.at(-1);
    if (previous?.kind === 'skip' && step.kind === 'skip' && previous.what === step.what) {
      merged[merged.length - 1] = { ...previous, count: previous.count + step.count };
      continue;
    }
    // A color change starts a new item: the change sits at the item's last stitch.
    if (
      previous?.kind === 'stitch' &&
      step.kind === 'stitch' &&
      previous.changeTo === undefined &&
      sameRun(previous, step, library)
    ) {
      merged[merged.length - 1] = {
        ...previous,
        count: previous.count + step.count,
        ...(step.changeTo === undefined ? {} : { changeTo: step.changeTo }),
      };
      continue;
    }
    merged.push(step);
  }
  return merged;
}

function sameRun(a: Step & { kind: 'stitch' }, b: Step & { kind: 'stitch' }, library: StitchLibrary): boolean {
  const kind = library.get(a.def)?.kind;
  if (a.def !== b.def || a.mode !== b.mode || (kind !== 'basic' && kind !== 'slip')) return false;
  if (a.target === 'down') return b.target === 'down' && a.depth === b.depth;
  if (a.target === 'next') return b.target === 'next';
  if (a.target === 'next-space' || a.target === 'same-space') return b.target === 'same-space';
  return (a.target === 'ring' || a.target === 'chain-ring') && b.target === a.target;
}

// KB: core-domain §26; 03 §2.3, 03 §4.2, 04 §3.2
export function foldRepeats(steps: readonly Step[], preferEarly = false): Step[] {
  const keys = steps.map((step) => JSON.stringify(step));
  const n = steps.length;
  let best: Candidate | null = null;

  for (let period = 1; period * 2 <= n; period += 1) {
    for (let start = 0; start + period * 2 <= n; start += 1) {
      let count = 1;
      while (start + (count + 1) * period <= n && sameBlock(keys, start, start + count * period, period)) count += 1;
      if (count < 2) continue;
      const candidate = {
        start,
        period,
        times: count,
        saved: period * (count - 1),
        endsWithSkip: steps[start + period - 1]!.kind === 'skip',
        endsWithChain: steps[start + period - 1]!.kind === 'chain',
        startsSame: startsInSameTarget(steps[start]!),
      };
      if (!best || better(candidate, best, preferEarly)) best = candidate;
    }
  }
  if (!best) return [...steps];

  const end = best.start + best.period * best.times;
  return [
    ...foldRepeats(steps.slice(0, best.start), preferEarly),
    { kind: 'repeat', steps: steps.slice(best.start, best.start + best.period), times: best.times },
    ...foldRepeats(steps.slice(end), preferEarly),
  ];
}

function sameBlock(keys: readonly string[], a: number, b: number, period: number): boolean {
  for (let k = 0; k < period; k += 1) if (keys[a + k] !== keys[b + k]) return false;
  return true;
}

interface Candidate {
  readonly start: number;
  readonly period: number;
  readonly times: number;
  readonly saved: number;
  readonly endsWithSkip: boolean;
  readonly endsWithChain: boolean;
  readonly startsSame: boolean;
}

function startsInSameTarget(step: Step): boolean {
  return (step.kind === 'stitch' || step.kind === 'group') && (step.target === 'same' || step.target === 'same-space');
}

function better(a: Candidate, b: Candidate, preferEarly: boolean): boolean {
  if (a.saved !== b.saved) return a.saved > b.saved;
  if (a.endsWithSkip !== b.endsWithSkip) return !a.endsWithSkip;
  // KB: 03 §8
  if (preferEarly && a.startsSame !== b.startsSame) return !a.startsSame;
  if (preferEarly && a.endsWithChain !== b.endsWithChain) return a.endsWithChain;
  if (a.start !== b.start) return preferEarly ? a.start < b.start : a.start > b.start;
  return a.period < b.period;
}
