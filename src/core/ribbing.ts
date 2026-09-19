// KB: 01 §2.2, 01 §4.2, 01 §4.3, 03 §2.3, 03 §7.1
// KB: core-geometry §47, §59

import { buildPieceGraph, type LayerInfo } from './graph.ts';
import { type CoreText, text } from './messages.ts';
import type { StitchLibrary } from './stitch-library.ts';
import type {
  Anchor,
  LayerEvent,
  NodeId,
  Pattern,
  Piece,
  StitchDef,
  StitchDefId,
  StitchInsertion,
  StitchNode,
} from './types.ts';

// KB: 01 §4.2
export const RIBBING_STITCH: StitchDefId = 'dc';
export const MAX_RIBBING_ROWS = 20;
export const MAX_RIBBING_WIDTH = 6;

export type RibbingCode =
  | 'ribbing-rows-range'
  | 'ribbing-width-range'
  | 'ribbing-stitch-missing'
  | 'ribbing-needs-row'
  | 'ribbing-after-join'
  | 'ribbing-spiral'
  | 'ribbing-after-turn'
  | 'ribbing-round-multiple'
  | 'ribbing-needs-post-stitch';

export type RibbingText = CoreText<RibbingCode>;

export interface RibbingOptions {
  readonly rows: number;
  // `width` is HALF the repeat: that many front-post stitches, then that many back-post.
  readonly width: number;
}

export const DEFAULT_RIBBING: RibbingOptions = { rows: 2, width: 1 };

export function ribbingProblem(options: RibbingOptions): RibbingText | null {
  if (!Number.isInteger(options.rows) || options.rows < 1 || options.rows > MAX_RIBBING_ROWS) {
    return text('ribbing-rows-range', { max: MAX_RIBBING_ROWS });
  }
  if (!Number.isInteger(options.width) || options.width < 1 || options.width > MAX_RIBBING_WIDTH) {
    return text('ribbing-width-range', { max: MAX_RIBBING_WIDTH });
  }
  return null;
}

export function hasPost(def: StitchDef | undefined): boolean {
  return def?.kind === 'basic' && def.insertionModes.includes('front-post');
}

// KB: core-geometry §47
export function ribbingColumnMode(column: number, width: number): StitchInsertion {
  return Math.floor(column / width) % 2 === 0 ? 'front-post' : 'back-post';
}

// KB: 01 §2.2, 01 §4.3
export function ribbedTurningChain(def: StitchDef): number {
  return Math.max(1, def.turningChain - 1);
}

export function ribbedOpening(event: LayerEvent): LayerEvent {
  return { ...event, conventions: { ...event.conventions, turningChainCounts: false } };
}

export function appendRibbing(
  pattern: Pattern,
  piece: Piece,
  library: StitchLibrary,
  options: RibbingOptions,
): Piece | RibbingText {
  const problem = ribbingProblem(options);
  if (problem !== null) return problem;
  const def = library.get(RIBBING_STITCH);
  if (!def) return text('ribbing-stitch-missing');

  const graph = buildPieceGraph(pattern, piece, library);
  const found = graph.layers[graph.layers.length - 1];
  if (!found || found.index === 0) return text('ribbing-needs-row');
  // KB: core-geometry §48
  const top =
    found.shape === 'row' && found.turningChainCounts ? found.turningChain[found.turningChain.length - 1] : undefined;
  const last: LayerInfo =
    top === undefined ? found : { ...found, positions: found.positions.filter((id) => id !== top) };

  const round = last.shape === 'round';
  if (round && last.closing?.kind !== 'join-slip') return text('ribbing-after-join');
  // A flat piece ends with a fasten-off; appending ribbing rewrites that event into a turn.
  if (!round && last.closing?.kind !== 'turn' && last.closing?.kind !== 'fasten-off') {
    return text('ribbing-after-turn');
  }

  const unit = 2 * options.width;
  if (round && last.positions.length % unit !== 0) {
    const nearest = Math.max(unit, Math.round(last.positions.length / unit) * unit);
    return text('ribbing-round-multiple', { unit, count: last.positions.length, nearest });
  }
  if (!last.positions.some((id) => hasPost(graph.defs.get(id)))) {
    return text('ribbing-needs-post-stitch');
  }

  const stitches: StitchNode[] = [...piece.stitches];
  const events: LayerEvent[] = [...piece.events];
  const opensRib = ribbedOpening;
  const ended = events[events.length - 1];
  if (ended)
    events[events.length - 1] = opensRib(!round && ended.kind === 'fasten-off' ? { ...ended, kind: 'turn' } : ended);
  const numberOf = (ids: readonly string[], prefix: string) =>
    Math.max(0, ...ids.map((id) => (new RegExp(`^${prefix}(\\d+)$`).exec(id) ? Number(id.slice(prefix.length)) : 0)));
  let nextNode = numberOf(
    stitches.map((node) => node.id),
    'n',
  );
  const add = (defId: StitchDefId, anchors: readonly Anchor[]): NodeId => {
    nextNode += 1;
    const id = `n${nextNode}`;
    stitches.push({ id, def: defId, prev: stitches[stitches.length - 1]?.id ?? null, anchors });
    return id;
  };

  // KB: core-geometry §50
  const column = new Map<NodeId, number>();
  last.positions.forEach((id, k) => column.set(id, k));
  const modeOf = (id: NodeId): StitchInsertion => ribbingColumnMode(column.get(id) ?? 0, options.width);
  const postable = (id: NodeId) => (graph.defs.has(id) ? hasPost(graph.defs.get(id)) : true);

  const turning = ribbedTurningChain(def);

  let below: readonly NodeId[] = last.positions;
  for (let r = 0; r < options.rows; r += 1) {
    for (let i = 0; i < turning; i += 1) add('ch', []);
    // KB: 01 §8.4
    const working = round ? [...below] : [...below].reverse();
    const made: NodeId[] = [];
    for (const target of working) {
      // KB: 01 §4.3
      const mode: StitchInsertion = postable(target) ? modeOf(target) : 'both-loops';
      const id = add(def.id, [{ into: 'stitch', id: target, mode }]);
      column.set(id, column.get(target) ?? 0);
      made.push(id);
    }
    const last_ = r === options.rows - 1;
    if (round) {
      const join = add('sl-st', [{ into: 'stitch', id: made[0]!, mode: 'both-loops' }]);
      const event: LayerEvent = { after: join, kind: 'join-slip', statedCount: made.length };
      events.push(last_ ? event : opensRib(event));
    } else {
      const event: LayerEvent = { after: made[made.length - 1]!, kind: last_ ? 'fasten-off' : 'turn' };
      events.push(last_ ? event : opensRib(event));
    }
    below = made;
  }

  return { ...piece, stitches, events };
}
