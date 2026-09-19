// KB: core-geometry §29
// KB: 06 §5.3

import { buildPieceGraph, type LayerInfo, type PieceGraph } from './graph.ts';
import { effectiveInsertion, modeAsWorked, stitchInsertions } from './insertion.ts';
import { type CoreText, text } from './messages.ts';
import type { StitchLibrary } from './stitch-library.ts';
import { libraryFor, resolveStitch } from './stitch-variants.ts';
import { increase, shell } from './stitches.ts';
import { firstChainFromHook, traditionOf, turningChainCountsFor, withTradition } from './tradition.ts';
import type {
  Anchor,
  Finding,
  NodeId,
  Pattern,
  PatternConventions,
  Piece,
  RingId,
  SpaceId,
  StitchDef,
  StitchDefId,
  StitchFlag,
  StitchInsertion,
  StitchNode,
  Tradition,
} from './types.ts';
import { validatePattern } from './validate.ts';

/** KB: 03 §10 A4, 03 §10 B10, 03 §10 B11 */
export const DEFAULT_CONVENTIONS: PatternConventions = {
  turningChainCounts: 'stitch-default',
  roundEnd: 'stitch-default',
  picotCounts: false,
  joinSlipStitchCounts: false,
  chainCounts: true,
};

export function emptyPattern(title = 'Új minta'): Pattern {
  return {
    formatVersion: 1,
    title,
    conventions: DEFAULT_CONVENTIONS,
    pieces: [{ id: 'p1', name: 'Darab', stitches: [], spaces: [], rings: [], groups: [], events: [], skipped: [] }],
  };
}

export type EditCode =
  | 'tradition-unchanged'
  | 'unknown-stitch'
  | 'ring-only-at-start'
  | 'chain-count-range'
  | 'space-needs-row'
  | 'needs-foundation'
  | 'picot-after-row-end'
  | 'row-end-reached'
  | 'no-slots'
  | 'needs-adjacent-stitches'
  | 'stitch-not-into-stitch'
  | 'insertion-not-allowed'
  | 'stitch-not-into-space'
  | 'stitch-not-into-ring'
  | 'same-needs-basic'
  | 'same-no-stitch'
  | 'same-single-anchor'
  | 'same-wrong-target'
  | 'same-other-group'
  | 'same-other-stitch'
  | 'fill-needs-targeted'
  | 'fill-no-free-slot'
  | 'row-empty'
  | 'no-turn-in-round'
  | 'ring-needs-chains'
  | 'insert-needs-chain-base'
  | 'insert-at-turning-chain'
  | 'gap-needs-basic'
  | 'gap-not-free'
  | 'round-empty'
  | 'no-close-in-row'
  | 'round-no-first-stitch'
  | 'no-spiral-in-row'
  | 'pattern-empty'
  | 'no-such-node'
  | 'no-selection'
  | 'has-dependents'
  | 'no-piece'
  | 'clipboard-empty'
  | 'foundation-needs-empty'
  | 'paste-needs-foundation'
  | 'paste-shape-mismatch'
  | 'paste-round-starts-with-slip'
  | 'paste-too-many-chains'
  | 'paste-span-mismatch'
  | 'paste-not-enough-slots'
  | 'paste-slot-kind'
  | 'paste-slot-used'
  | 'paste-against-direction'
  | 'paste-no-reuse-slots'
  | 'paste-would-break'
  | 'copy-broken-pattern'
  | 'copy-layer-outside'
  | 'copy-oval-first-round'
  | 'copy-anchor-unsupported';

export type EditResult =
  | { readonly ok: true; readonly pattern: Pattern }
  | { readonly ok: false; readonly reason: CoreText<EditCode> };

const done = (pattern: Pattern): EditResult => ({ ok: true, pattern });
const refuse = (reason: CoreText<EditCode>): EditResult => ({ ok: false, reason });

export function setTradition(pattern: Pattern, tradition: Tradition): EditResult {
  if (traditionOf(pattern.conventions) === tradition) return refuse(text('tradition-unchanged'));
  return done({ ...pattern, conventions: withTradition(pattern.conventions, tradition) });
}

function pieceOf(pattern: Pattern): Piece {
  const piece = pattern.pieces[0];
  if (!piece) throw new Error('A mintában nincs darab.');
  return piece;
}

function withPiece(pattern: Pattern, piece: Piece): Pattern {
  return { ...pattern, pieces: [piece, ...pattern.pieces.slice(1)] };
}

export type Slot =
  | { readonly kind: 'stitch'; readonly id: NodeId }
  | { readonly kind: 'space'; readonly id: SpaceId; readonly chains: readonly NodeId[] }
  | { readonly kind: 'ring'; readonly id: RingId; readonly node: NodeId }
  | { readonly kind: 'underside'; readonly id: NodeId };

export interface EditorMode {
  /** The first layer on a foundation chain is a round — an oval. KB: 04 §3.4 */
  readonly roundsOnChain?: boolean;
}

export interface WorkContext {
  readonly library: StitchLibrary;
  readonly graph: PieceGraph | null;
  /** The layer the next stitch goes into; it may not exist in the graph yet. */
  readonly layer: number;
  readonly shape: LayerInfo['shape'];
  readonly side: LayerInfo['side'];
  readonly slots: readonly Slot[];
  readonly used: readonly boolean[];
  /** Index of the last target already worked into, or −1. */
  readonly frontier: number;
  readonly turningChain: number;
  /** Whether the layer has a stitch beyond its turning chain. */
  readonly started: boolean;
  readonly oval: boolean;
}

const slotKey = (slot: Slot) => `${slot.kind}:${slot.id}`;
const anchorKey = (anchor: Anchor) => `${anchor.into}:${anchor.id}`;

export function pieceFinished(graph: PieceGraph | null): boolean {
  const last = graph?.layers.at(-1);
  if (!last || last.index === 0 || !last.closing) return false;
  return last.closing.kind === 'fasten-off';
}

export function contextOf(pattern: Pattern, mode: EditorMode = {}): WorkContext {
  const library = libraryFor(pattern);
  const piece = pieceOf(pattern);
  const empty: WorkContext = {
    library,
    graph: null,
    layer: 0,
    shape: 'row',
    side: 'right',
    slots: [],
    used: [],
    frontier: -1,
    turningChain: 0,
    started: false,
    oval: false,
  };
  if (piece.stitches.length === 0) return empty;

  let graph: PieceGraph;
  try {
    graph = buildPieceGraph(pattern, piece, library);
  } catch {
    return empty;
  }
  const last = graph.layers[graph.layers.length - 1]!;

  let layer: number;
  let below: LayerInfo;
  let reversed: boolean;
  let shape: LayerInfo['shape'];
  if (last.closing !== null) {
    layer = last.index + 1;
    below = last;
    reversed = last.closing.kind === 'turn';
    shape = last.closing.kind === 'turn' ? 'row' : last.closing.kind === 'fasten-off' ? last.shape : 'round';
  } else if (last.index === 0) {
    layer = 1;
    below = last;
    shape = last.shape;
    reversed = shape === 'row';
  } else {
    layer = last.index;
    below = graph.layers[last.index - 1]!;
    reversed = last.direction === -1;
    shape = last.shape;
  }

  // KB: 04 §3.4
  const plainChain =
    below.closing === null &&
    below.stitches.length > 0 &&
    below.stitches.every((id) => graph.defs.get(id)!.kind === 'chain');
  const oval =
    layer === 1 && below.index === 0 && (below.undersides.length > 0 || (mode.roundsOnChain === true && plainChain));
  const slots = oval ? ovalSlots(graph, below) : layerSlots(graph, layer, below, reversed, shape);

  const current = graph.layers[layer];
  const side =
    current?.side ?? (below.closing?.kind === 'turn' ? (below.side === 'right' ? 'wrong' : 'right') : below.side);
  const worked = new Set<string>();
  for (const id of current?.stitches ?? []) {
    for (const anchor of graph.nodes.get(id)!.anchors) worked.add(anchorKey(anchor));
  }
  const used = slots.map((slot) => worked.has(slotKey(slot)));
  const turningChain = current?.turningChain.length ?? 0;
  // KB: core-geometry §23
  if (turningChain > 0 && shape === 'row' && layer > 1 && current?.turningChainCounts && used.length > 0)
    used[0] = true;
  const frontier = used.lastIndexOf(true);
  const started = (current?.stitches.length ?? 0) > turningChain;

  return { library, graph, layer, shape, side, slots, used, frontier, turningChain, started, oval };
}

// KB: 04 §3.4
function ovalSlots(graph: PieceGraph, below: LayerInfo): Slot[] {
  const current = graph.layers[1];
  const tail = current?.turningChain ?? [];
  const front = [...below.positions, ...tail].reverse().map((id): Slot => ({ kind: 'stitch', id }));
  if ((current?.stitches.length ?? 0) <= tail.length) return front;
  return [...front, ...below.positions.slice(1).map((id): Slot => ({ kind: 'underside', id }))];
}

export function layerSlots(
  graph: PieceGraph,
  layer: number,
  below: LayerInfo,
  reversed: boolean,
  shape: LayerInfo['shape'],
): Slot[] {
  // KB: core-geometry §22
  const foundationTail =
    layer === 1 && below.index === 0 && shape === 'row' ? (graph.layers[1]?.turningChain ?? []) : [];
  const positions = [...below.positions, ...foundationTail];
  const ordered = reversed ? positions.reverse() : positions;
  const slots: Slot[] = [];
  for (const id of ordered) {
    const space = graph.spaceOfChain.get(id);
    if (space) {
      if (!slots.some((slot) => slot.kind === 'space' && slot.id === space.id)) {
        slots.push({ kind: 'space', id: space.id, chains: space.chains });
      }
      continue;
    }
    const ring = [...graph.rings.values()].find((candidate) => candidate.node === id);
    slots.push(ring ? { kind: 'ring', id: ring.id, node: id } : { kind: 'stitch', id });
  }
  return slots;
}

// KB: 03 §1.2, 03 §1.3
export function defaultCursor(pattern: Pattern, context: WorkContext, tool: StitchDefId | null): number {
  const { slots, frontier, used } = context;
  if (slots.length === 0) return 0;
  // Every stitch of a round goes into the magic ring, so the cursor stays on it.
  if (frontier >= 0) {
    if (slots[frontier]!.kind === 'ring') return frontier;
    // KB: core-geometry §27
    const bridged = new Set(pieceOf(pattern).skipped);
    let next = frontier + 1;
    while (next < slots.length && (used[next] || bridged.has(slots[next]!.id))) next += 1;
    return next;
  }
  return startCursor(pattern, context, tool);
}

// KB: 03 §1.2, 03 §1.3
export function startCursor(
  pattern: Pattern,
  start: Pick<WorkContext, 'layer' | 'shape' | 'turningChain' | 'slots'> & { readonly oval?: boolean },
  tool: StitchDefId | null,
): number {
  const { slots } = start;
  if (slots.length === 0) return 0;
  const def = tool ? resolveStitch(tool) : undefined;
  // KB: 04 §3.4
  if (start.oval && start.layer === 1 && start.turningChain === 0)
    return Math.min(def ? def.turningChain : 1, slots.length - 1);
  const tradition = traditionOf(pattern.conventions);
  const counts =
    def !== undefined && turningChainCountsFor(pattern.conventions.turningChainCounts, def, tradition, start.shape);
  const foundationChain = start.layer === 1 && start.shape === 'row' && start.turningChain === 0;
  // Chains are numbered from the hook starting at 1; targets are numbered from 0.
  if (foundationChain)
    return Math.min(def ? firstChainFromHook(def.turningChain, counts, tradition) - 1 : 1, slots.length - 1);

  // KB: core-geometry §23
  if (start.turningChain > 0 && counts && slots.length > 1) return 1;
  return 0;
}

function nextId(prefix: string, ids: Iterable<string>): string {
  let max = 0;
  for (const id of ids) {
    const match = new RegExp(`^${prefix}(\\d+)$`).exec(id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}${max + 1}`;
}

function append(piece: Piece, nodes: readonly Omit<StitchNode, 'id' | 'prev'>[]): { piece: Piece; ids: NodeId[] } {
  const stitches = [...piece.stitches];
  const ids: NodeId[] = [];
  for (const node of nodes) {
    const id = nextId(
      'n',
      stitches.map((stitch) => stitch.id),
    );
    const prev = stitches[stitches.length - 1]?.id ?? null;
    stitches.push({ id, prev, ...node });
    ids.push(id);
  }
  return { piece: { ...piece, stitches }, ids };
}

// KB: core-geometry §26
function fabricIndex(piece: Piece, context: WorkContext, cursor: number): number {
  const { graph } = context;
  const layer = graph?.layers[context.layer];
  if (!graph || !layer) return piece.stitches.length;
  const slotIndex = new Map(context.slots.map((slot, i) => [slotKey(slot), i]));
  const reach = (id: NodeId): number => {
    const found = (graph.nodes.get(id)?.anchors ?? []).map((anchor) => slotIndex.get(anchorKey(anchor)));
    const known = found.filter((value): value is number => value !== undefined);
    // An element with no target (turning chain, chain, picot) reaches nowhere and stays put.
    return known.length > 0 ? Math.max(...known) : -1;
  };
  const ahead = layer.stitches.find((id) => reach(id) > cursor);
  const index = ahead === undefined ? -1 : piece.stitches.findIndex((node) => node.id === ahead);
  return index < 0 ? piece.stitches.length : index;
}

function insertAt(
  piece: Piece,
  index: number,
  nodes: readonly Omit<StitchNode, 'id' | 'prev'>[],
): { piece: Piece; ids: NodeId[] } {
  if (index >= piece.stitches.length) return append(piece, nodes);
  const taken = piece.stitches.map((node) => node.id);
  const ids: NodeId[] = [];
  const made = nodes.map((node): StitchNode => {
    const id = nextId('n', taken);
    taken.push(id);
    ids.push(id);
    return { id, prev: null, ...node };
  });
  const list = [...piece.stitches.slice(0, index), ...made, ...piece.stitches.slice(index)];
  // The first stitch after a fasten-off keeps `prev: null`; every other points at the one before it in the array.
  const cut = new Set(piece.events.filter((event) => event.kind === 'fasten-off').map((event) => event.after));
  const stitches = list.map((node, i): StitchNode => {
    const previous = list[i - 1];
    const prev = previous === undefined || cut.has(previous.id) ? null : previous.id;
    return node.prev === prev ? node : { ...node, prev };
  });
  return { piece: { ...piece, stitches }, ids };
}

export interface Tool {
  readonly def: StitchDefId;
  readonly count: number;
  /** KB: core-geometry §28 */
  readonly insertion?: StitchInsertion | undefined;
}

/** More than this is a typo, not a pattern. */
const MAX_CHAINS = 500;

function hasEventAfterLast(piece: Piece): boolean {
  const last = piece.stitches[piece.stitches.length - 1];
  return last !== undefined && piece.events.some((event) => event.after === last.id);
}

export function work(
  pattern: Pattern,
  tool: Tool,
  cursor: number,
  flags: readonly StitchFlag[] = [],
  mode: EditorMode = {},
): EditResult {
  const def = resolveStitch(tool.def);
  if (!def) return refuse(text('unknown-stitch', { id: tool.def }));
  const marks = flags.length > 0 ? { flags } : {};
  const piece = pieceOf(pattern);

  if (def.kind === 'ring') {
    if (piece.stitches.length > 0) return refuse(text('ring-only-at-start'));
    const { piece: next, ids } = append(piece, [{ def: def.id, anchors: [] }]);
    return done(withPiece(pattern, { ...next, rings: [{ id: 'r1', node: ids[0]! }] }));
  }

  if (def.kind === 'chain' || def.kind === 'space') {
    const count = Math.trunc(tool.count);
    if (!(count >= 1 && count <= MAX_CHAINS)) return refuse(text('chain-count-range', { min: 1, max: MAX_CHAINS }));
    if (def.kind === 'space' && piece.stitches.length === 0) return refuse(text('space-needs-row'));
    const nodes = Array.from({ length: count }, () => ({ def: 'ch', anchors: [] }));
    // KB: core-geometry §27
    const covered = coveredByChains(pattern, piece, cursor, count, mode);
    const { piece: next, ids } = insertAt(piece, covered.at, nodes);
    const withSkips = { ...next, skipped: covered.skipped };
    if (def.kind === 'chain') return done(withPiece(pattern, withSkips));
    const space = {
      id: nextId(
        's',
        piece.spaces.map((s) => s.id),
      ),
      chains: ids,
    };
    return done(withPiece(pattern, { ...withSkips, spaces: [...withSkips.spaces, space] }));
  }

  if (piece.stitches.length === 0) return refuse(text('needs-foundation'));

  if (def.kind === 'picot') {
    if (hasEventAfterLast(piece)) return refuse(text('picot-after-row-end'));
    return done(withPiece(pattern, append(piece, [{ def: def.id, anchors: [] }]).piece));
  }

  const context = contextOf(pattern, mode);

  // KB: core-geometry §23
  const turnsInto = turningChainCountsFor(
    pattern.conventions.turningChainCounts,
    def,
    traditionOf(pattern.conventions),
    'row',
  );
  if (startsTurnedRow(context) && def.kind === 'basic' && def.turningChain > 0 && turnsInto) {
    const nodes = Array.from({ length: def.turningChain }, () => ({ def: 'ch' as StitchDefId, anchors: [] }));
    return done(withPiece(pattern, append(piece, nodes).piece));
  }

  const first = context.slots[cursor];
  if (!first) {
    return refuse(text(context.slots.length > 0 ? 'row-end-reached' : 'no-slots'));
  }
  const at = fabricIndex(piece, context, cursor);

  if (def.kind === 'joined' && def.base === 'spread') {
    const slots = context.slots.slice(cursor, cursor + def.consumes);
    if (slots.length < def.consumes || slots.some((slot) => slot.kind !== 'stitch')) {
      return refuse(text('needs-adjacent-stitches', { count: def.consumes }));
    }
    const mode = stitchModeFor(def, tool.insertion, context.side);
    if ('code' in mode) return refuse(mode);
    const anchors = slots.map((slot): Anchor => ({ into: 'stitch', id: slot.id, mode: mode.mode }));
    return done(
      withPiece(pattern, clearSkips(insertAt(piece, at, [{ def: def.id, anchors, ...marks }]).piece, anchors)),
    );
  }

  const anchor = anchorFor(def, first, tool.insertion, context.side);
  if ('code' in anchor) return refuse(anchor);

  if (def.kind === 'group') {
    const members = def.members.map((member) => ({
      def: member,
      anchors: resolveStitch(member)?.kind === 'chain' ? [] : [anchor],
    }));
    const { piece: next, ids } = insertAt(piece, at, members);
    const group = {
      id: nextId(
        'g',
        piece.groups.map((g) => g.id),
      ),
      def: def.id,
      members: ids,
    };
    let spaces = next.spaces;
    const chains = ids.filter((_, i) => members[i]!.anchors.length === 0);
    if (def.producesSpaces > 0 && chains.length > 0) {
      spaces = [
        ...spaces,
        {
          id: nextId(
            's',
            spaces.map((s) => s.id),
          ),
          chains,
        },
      ];
    }
    return done(withPiece(pattern, clearSkips({ ...next, groups: [...next.groups, group], spaces }, [anchor])));
  }

  const worked = insertAt(piece, at, [{ def: def.id, anchors: [anchor], ...marks }]).piece;
  return done(withPiece(pattern, clearSkips(worked, [anchor])));
}

// KB: core-geometry §27
function clearSkips(piece: Piece, anchors: readonly Anchor[]): Piece {
  if (piece.skipped.length === 0) return piece;
  const worked = new Set(anchors.map((anchor) => anchor.id));
  const skipped = piece.skipped.filter((id) => !worked.has(id));
  return skipped.length === piece.skipped.length ? piece : { ...piece, skipped };
}

// KB: core-geometry §27
function coveredByChains(
  pattern: Pattern,
  piece: Piece,
  cursor: number,
  count: number,
  mode: EditorMode,
): { at: number; skipped: readonly NodeId[] } {
  const context = contextOf(pattern, mode);
  if (!context.graph || context.slots.length === 0) return { at: piece.stitches.length, skipped: piece.skipped };
  const clean = pieceOf(withoutStaleSkips(pattern));
  const at = fabricIndex(piece, context, cursor);
  // A chain bridges forward only: behind the working edge or on a used target it just follows the stitch.
  if (cursor <= context.frontier || context.used[cursor] !== false) return { at, skipped: clean.skipped };
  const already = new Set(clean.skipped);
  const skipped: NodeId[] = [...clean.skipped];
  for (let i = cursor; i < context.slots.length && skipped.length - clean.skipped.length < count; i += 1) {
    const slot = context.slots[i]!;
    if (context.used[i] || slot.kind !== 'stitch' || already.has(slot.id)) continue;
    skipped.push(slot.id);
  }
  return { at, skipped };
}

function stitchModeFor(
  def: StitchDef,
  requested: StitchInsertion | undefined,
  side: LayerInfo['side'],
): { readonly mode: StitchInsertion } | CoreText<EditCode> {
  const allowed = stitchInsertions(def);
  const mode = effectiveInsertion(def, requested);
  if (!mode) return text('stitch-not-into-stitch', { stitch: def.id });
  if (requested && requested !== mode) {
    return text('insertion-not-allowed', { stitch: def.id, requested, allowed });
  }
  return { mode: modeAsWorked(mode, side) };
}

function anchorFor(
  def: StitchDef,
  slot: Slot,
  requested: StitchInsertion | undefined,
  side: LayerInfo['side'],
): Anchor | CoreText<EditCode> {
  switch (slot.kind) {
    case 'stitch': {
      const mode = stitchModeFor(def, requested, side);
      return 'code' in mode ? mode : { into: 'stitch', id: slot.id, mode: mode.mode };
    }
    case 'space':
      return def.insertionModes.includes('space')
        ? { into: 'space', id: slot.id }
        : text('stitch-not-into-space', { stitch: def.id });
    case 'ring':
      return def.insertionModes.includes('ring')
        ? { into: 'ring', id: slot.id }
        : text('stitch-not-into-ring', { stitch: def.id });
    case 'underside': {
      // KB: 04 §3.4
      const mode = stitchModeFor(def, requested, side);
      return 'code' in mode ? mode : { into: 'underside', id: slot.id };
    }
  }
}

// KB: 01 §8.2
export function workIntoSame(pattern: Pattern, defId: StitchDefId, cursor?: number, mode: EditorMode = {}): EditResult {
  const piece = pieceOf(pattern);
  const part = resolveStitch(defId);
  const last = piece.stitches[piece.stitches.length - 1];
  if (!part || part.kind !== 'basic' || !part.workableTop) return refuse(text('same-needs-basic'));
  const host = cursor === undefined ? last : hostAt(pattern, piece, cursor, mode);
  if (!host || (host === last && hasEventAfterLast(piece))) return refuse(text('same-no-stitch'));
  const anchor = host.anchors[0];
  if (!anchor || host.anchors.length !== 1) return refuse(text('same-single-anchor'));

  // KB: 03 §10 C14
  const behind = piece.groups.find((candidate) => candidate.members.includes(host.id))?.members.at(-1) ?? host.id;
  const appended = insertAt(piece, piece.stitches.findIndex((node) => node.id === behind) + 1, [
    { def: part.id, anchors: [anchor] },
  ]);
  if (anchor.into !== 'stitch' && anchor.into !== 'underside') {
    if (!part.insertionModes.includes(anchor.into)) return refuse(text('same-wrong-target'));
    return done(withPiece(pattern, appended.piece));
  }

  const group = piece.groups.find((candidate) => candidate.members.includes(host.id));
  if (group) {
    const members = piece.stitches.filter((node) => group.members.includes(node.id));
    if (members.some((node) => node.def !== part.id)) return refuse(text('same-other-group'));
    const n = members.length + 1;
    const def = group.def.startsWith('shell-') ? shell(part, n) : increase(part, n);
    const groups = appended.piece.groups.map((g) =>
      g.id === group.id ? { ...g, def: def.id, members: [...g.members, appended.ids[0]!] } : g,
    );
    return done(withPiece(pattern, { ...appended.piece, groups }));
  }

  if (host.def !== part.id) return refuse(text('same-other-stitch'));
  const def = increase(part, 2);
  const created = {
    id: nextId(
      'g',
      piece.groups.map((g) => g.id),
    ),
    def: def.id,
    members: [host.id, appended.ids[0]!],
  };
  return done(withPiece(pattern, { ...appended.piece, groups: [...appended.piece.groups, created] }));
}

function hostAt(pattern: Pattern, piece: Piece, cursor: number, mode: EditorMode): StitchNode | undefined {
  const context = contextOf(pattern, mode);
  const slot = context.slots[cursor];
  const layer = context.graph?.layers[context.layer];
  if (!slot || !layer || !context.graph) return undefined;
  const key = slotKey(slot);
  const into = layer.stitches.filter((id) =>
    context.graph!.nodes.get(id)!.anchors.some((anchor) => anchorKey(anchor) === key),
  );
  const id = into.at(-1);
  return piece.stitches.find((node) => node.id === id);
}

// KB: core-geometry §29
export function fillRow(pattern: Pattern, tool: Tool, mode: EditorMode = {}): EditResult {
  const def = resolveStitch(tool.def);
  if (!def) return refuse(text('unknown-stitch', { id: tool.def }));
  if (def.kind === 'chain' || def.kind === 'space' || def.kind === 'ring' || def.kind === 'picot') {
    return refuse(text('fill-needs-targeted'));
  }
  let current = pattern;
  let placed = 0;
  // Each step moves the frontier forward, so the loop terminates; the guard is only a brake.
  for (let guard = 0; guard < 5000; guard += 1) {
    const context = contextOf(current, mode);
    if (context.slots.length === 0) break;
    let index = context.frontier >= 0 ? context.frontier + 1 : defaultCursor(current, context, tool.def);
    while (index < context.slots.length && context.used[index]) index += 1;
    if (index >= context.slots.length) break;
    const result = work(current, tool, index, [], mode);
    if (!result.ok) break;
    current = result.pattern;
    placed += 1;
  }
  if (placed === 0) return refuse(text('fill-no-free-slot'));
  return done(current);
}

export function onFoundationChain(context: WorkContext): boolean {
  return (
    context.graph !== null &&
    context.layer === 1 &&
    context.shape === 'row' &&
    !context.started &&
    context.turningChain === 0
  );
}

// KB: core-geometry §23
export function startsTurnedRow(context: WorkContext): boolean {
  return (
    context.graph !== null &&
    context.shape === 'row' &&
    context.layer > 1 &&
    !context.started &&
    context.turningChain === 0
  );
}

export function canEndRow(context: WorkContext): boolean {
  return (context.started && context.shape === 'row') || onFoundationChain(context);
}

// KB: 01 §8.3, 03 §1.2, core-geometry §23
export function endRow(pattern: Pattern): EditResult {
  const piece = pieceOf(pattern);
  const context = contextOf(pattern);
  if (onFoundationChain(context)) return done(pattern);
  if (!context.graph || !context.started) return refuse(text('row-empty'));
  if (context.shape === 'round') return refuse(text('no-turn-in-round'));
  const last = piece.stitches[piece.stitches.length - 1]!;
  return done(withPiece(pattern, { ...piece, events: [...piece.events, { after: last.id, kind: 'turn' }] }));
}

// KB: core-geometry §26
export function insertChain(
  pattern: Pattern,
  between: { readonly left: NodeId | null; readonly right: NodeId | null },
): EditResult {
  const piece = pieceOf(pattern);
  const context = contextOf(pattern);
  const base = context.graph?.layers[0];
  if (!base || base.shape !== 'row' || base.stitches.length === 0) return refuse(text('insert-needs-chain-base'));

  const at = (id: NodeId | null) => (id === null ? -1 : piece.stitches.findIndex((node) => node.id === id));
  const [left, right] = [at(between.left), at(between.right)];
  const known = [left, right].filter((index) => index >= 0);
  if (known.length === 0) return refuse(text('insert-needs-chain-base'));

  let index: number;
  if (known.length === 2) index = Math.max(left, right);
  else {
    // KB: 03 §1.2
    const only = known[0]!;
    if (piece.stitches[only]!.id !== base.stitches[0]) return refuse(text('insert-at-turning-chain'));
    index = only;
  }
  return done(withPiece(pattern, insertAt(piece, index, [{ def: 'ch', anchors: [] }]).piece));
}

// KB: core-geometry §26
export function workIntoGap(
  pattern: Pattern,
  layer: number,
  into: NodeId,
  tool: Tool,
  mode: EditorMode = {},
): EditResult {
  const def = resolveStitch(tool.def);
  if (!def) return refuse(text('unknown-stitch', { id: tool.def }));
  if (def.kind !== 'basic') return refuse(text('gap-needs-basic'));

  const piece = pieceOf(pattern);
  const context = contextOf(pattern, mode);
  const graph = context.graph;
  const row = graph?.layers[layer];
  const below = graph?.layers[layer - 1];
  if (!graph || !row || !below || row.shape !== 'row') return refuse(text('gap-not-free'));

  const slots = layerSlots(graph, layer, below, row.direction === -1, row.shape);
  const place = slots.findIndex((slot) => slot.kind === 'stitch' && slot.id === into);
  const worked = new Set(row.stitches.flatMap((id) => graph.nodes.get(id)!.anchors.map((anchor) => anchorKey(anchor))));
  if (place < 0 || worked.has(slotKey(slots[place]!))) return refuse(text('gap-not-free'));

  const anchor = anchorFor(def, slots[place]!, tool.insertion, row.side);
  if ('code' in anchor) return refuse(anchor);

  const index = new Map(slots.map((slot, i) => [slotKey(slot), i]));
  const reach = (id: NodeId): number => {
    const found = (graph.nodes.get(id)?.anchors ?? []).map((candidate) => index.get(anchorKey(candidate)));
    const known = found.filter((value): value is number => value !== undefined);
    return known.length > 0 ? Math.max(...known) : -1;
  };
  const ahead = row.stitches.find((id) => reach(id) > place);
  const at =
    ahead === undefined
      ? piece.stitches.findIndex((node) => node.id === row.stitches[row.stitches.length - 1]) + 1
      : piece.stitches.findIndex((node) => node.id === ahead);
  return done(
    withPiece(pattern, clearSkips(insertAt(piece, at, [{ def: def.id, anchors: [anchor] }]).piece, [anchor])),
  );
}

/** KB: 04 §1.1 */
export const MIN_RING_CHAINS = 3;

export function canJoinChainRing(pattern: Pattern): boolean {
  const piece = pieceOf(pattern);
  return (
    piece.stitches.length >= MIN_RING_CHAINS &&
    piece.stitches.every((node) => node.def === 'ch') &&
    piece.spaces.length === 0 &&
    piece.events.length === 0
  );
}

// KB: 04 §1.1
export function canEndRound(context: WorkContext): boolean {
  const layer = context.graph?.layers[context.layer];
  if (!context.graph || !context.started || !layer || layer.positions.length === 0 || layer.closing !== null)
    return false;
  if (context.shape === 'round') return true;
  const { graph } = context;
  const base = graph.layers[0]!;
  // KB: core-geometry §21
  const targets = new Set(
    layer.stitches.flatMap((id) =>
      graph.nodes.get(id)!.anchors.map((anchor) => (anchor.into === 'stitch' ? anchor.id : '')),
    ),
  );
  return (
    context.layer === 1 &&
    targets.size === 1 &&
    targets.has(base.stitches[0]!) &&
    base.stitches.every((id) => graph.defs.get(id)!.kind === 'chain')
  );
}

export function canCloseRound(pattern: Pattern, context: WorkContext = contextOf(pattern)): boolean {
  return canJoinChainRing(pattern) || canEndRound(context);
}

// KB: 06 §5.3
export function closeRound(pattern: Pattern): EditResult {
  const piece = pieceOf(pattern);
  if (canJoinChainRing(pattern)) return joinChainRing(pattern);
  const context = contextOf(pattern);
  const onlyChains = piece.stitches.length > 0 && piece.stitches.every((node) => node.def === 'ch');
  if (onlyChains && piece.stitches.length < MIN_RING_CHAINS) {
    return refuse(text('ring-needs-chains', { min: MIN_RING_CHAINS }));
  }
  if (!context.graph || !context.started) return refuse(text('round-empty'));
  if (!canEndRound(context)) return refuse(text('no-close-in-row'));
  const layer = context.graph.layers[context.layer]!;
  const first = context.shape === 'round' ? layer.positions[0] : roundOnChainStart(pattern, context.graph, layer);
  if (!first) return refuse(text('round-no-first-stitch'));

  const { piece: next, ids } = append(piece, [
    { def: 'sl-st', anchors: [{ into: 'stitch', id: first, mode: 'both-loops' }] },
  ]);
  return done(withPiece(pattern, { ...next, events: [...next.events, { after: ids[0]!, kind: 'join-slip' }] }));
}

// KB: core-geometry §21
function roundOnChainStart(pattern: Pattern, graph: PieceGraph, layer: LayerInfo): NodeId | undefined {
  const def = layer.firstStitch === null ? undefined : graph.defs.get(layer.firstStitch);
  const { conventions } = pattern;
  const counts =
    def !== undefined && turningChainCountsFor(conventions.turningChainCounts, def, traditionOf(conventions), 'round');
  return counts ? layer.turningChain.at(-1) : layer.positions.find((id) => !layer.turningChain.includes(id));
}

// KB: 04 §1.1
function joinChainRing(pattern: Pattern): EditResult {
  const piece = pieceOf(pattern);
  const chains = piece.stitches.map((node) => node.id);
  const { piece: next } = append(piece, [
    { def: 'sl-st', anchors: [{ into: 'stitch', id: chains[0]!, mode: 'both-loops' }] },
  ]);
  const ring = {
    id: nextId(
      's',
      piece.spaces.map((space) => space.id),
    ),
    chains,
  };
  return done(
    withPiece(pattern, { ...next, spaces: [ring], events: [{ after: chains[chains.length - 1]!, kind: 'join-slip' }] }),
  );
}

// KB: 04 §2
export function endRoundSpiral(pattern: Pattern): EditResult {
  const piece = pieceOf(pattern);
  const context = contextOf(pattern);
  if (!context.graph || !context.started) return refuse(text('round-empty'));
  if (!canEndRound(context)) return refuse(text('no-spiral-in-row'));
  const last = piece.stitches[piece.stitches.length - 1]!;
  return done(withPiece(pattern, { ...piece, events: [...piece.events, { after: last.id, kind: 'spiral' }] }));
}

// The chain ring's slip stitch also dissolves the ring; the chains stay.
export function deleteLast(pattern: Pattern): EditResult {
  const piece = pieceOf(pattern);
  const last = piece.stitches[piece.stitches.length - 1];
  if (!last) return refuse(text('pattern-empty'));

  const event = piece.events.find((candidate) => candidate.after === last.id);
  if (event && event.kind !== 'join-slip') {
    return done(withPiece(pattern, { ...piece, events: piece.events.filter((e) => e !== event) }));
  }

  let remove = new Set([last.id]);
  const group = piece.groups.find((candidate) => candidate.members.includes(last.id));
  const space = piece.spaces.find((candidate) => candidate.chains.includes(last.id));
  if (group) remove = new Set(group.members);
  else if (space) remove = new Set(space.chains);

  const before = piece.stitches.slice(0, -1);
  const ringJoin =
    last.def === 'sl-st' && before.length > 0 && before.every((node) => node.def === 'ch')
      ? piece.events.find((candidate) => candidate.after === last.prev && candidate.kind === 'join-slip')
      : undefined;

  const stitches = piece.stitches.filter((node) => !remove.has(node.id));
  const result = done(
    withPiece(pattern, {
      ...piece,
      stitches,
      events: piece.events.filter((e) => !remove.has(e.after) && e !== ringJoin),
      groups: piece.groups.filter((g) => g.members.every((id) => !remove.has(id))),
      spaces: piece.spaces
        .filter((s) => !ringJoin || !s.chains.includes(ringJoin.after))
        .map((s) => ({ ...s, chains: s.chains.filter((id) => !remove.has(id)) }))
        .filter((s) => s.chains.length > 0),
      rings: piece.rings.filter((r) => !remove.has(r.node)),
      skipped: piece.skipped.filter((id) => !remove.has(id)),
    }),
  );
  return result.ok ? done(withoutStaleSkips(result.pattern)) : result;
}

// KB: core-geometry §27
export function withoutStaleSkips(pattern: Pattern): Pattern {
  const piece = pieceOf(pattern);
  if (piece.skipped.length === 0) return pattern;
  const context = contextOf(pattern);
  const layer = context.graph?.layers[context.layer];
  if (!layer || !context.graph) return pattern;

  const index = new Map(context.slots.map((slot, i) => [slotKey(slot), i]));
  const at = new Map(context.slots.map((slot, i) => [slot.id, i]));
  const marks = piece.skipped.filter((id) => at.has(id)).sort((a, b) => at.get(a)! - at.get(b)!);
  if (marks.length === 0) return pattern;

  const kept = new Set<NodeId>();
  let run = 0;
  let behind = -1;
  const claim = (ahead: number) => {
    for (const id of marks) {
      if (run === 0) break;
      const where = at.get(id)!;
      if (where <= behind || where >= ahead || kept.has(id)) continue;
      kept.add(id);
      run -= 1;
    }
    run = 0;
  };
  for (const id of layer.stitches) {
    const reach = (context.graph.nodes.get(id)?.anchors ?? [])
      .map((anchor) => index.get(anchorKey(anchor)))
      .filter((value): value is number => value !== undefined);
    if (reach.length > 0) {
      claim(Math.min(...reach));
      behind = Math.max(...reach);
      continue;
    }
    if (context.graph.defs.get(id)?.kind === 'chain' && !layer.turningChain.includes(id)) run += 1;
  }
  claim(context.slots.length);

  const skipped = piece.skipped.filter((id) => !at.has(id) || kept.has(id));
  return skipped.length === piece.skipped.length ? pattern : withPiece(pattern, { ...piece, skipped });
}

/** A manual offset from the computed place; `null` resets it. Never changes the topology. */
export function setPinned(
  pattern: Pattern,
  id: NodeId,
  offset: { readonly x: number; readonly y: number } | null,
): EditResult {
  const piece = pieceOf(pattern);
  if (!piece.stitches.some((node) => node.id === id)) return refuse(text('no-such-node', { id }));
  const stitches = piece.stitches.map((node) => {
    if (node.id !== id) return node;
    const { pinned: _, ...rest } = node;
    return offset && (offset.x !== 0 || offset.y !== 0)
      ? { ...rest, pinned: { x: Math.round(offset.x * 10) / 10, y: Math.round(offset.y * 10) / 10, rotation: 0 } }
      : rest;
  });
  return done(withPiece(pattern, { ...piece, stitches }));
}

export interface LiveCheck {
  readonly findings: readonly Finding[];
  /** Targets still free in the unfinished layer; findings about them are suppressed. */
  readonly remaining: number;
}

// In an unfinished row these findings only mean the row is not done yet.
const PENDING_RULES = new Set(['unused-position', 'turning-chain-placement', 'repeat-balance', 'floating-chain']);

export function liveCheck(pattern: Pattern, context: WorkContext = contextOf(pattern)): LiveCheck {
  const findings = validatePattern(pattern, context.library);
  const graph = context.graph;
  const open = graph !== null && context.started && graph.layers[context.layer]?.closing === null;
  if (!open) return { findings, remaining: 0 };

  const slotIndex = new Map<NodeId, number>();
  context.slots.forEach((slot, i) => {
    if (slot.kind === 'stitch' || slot.kind === 'underside') slotIndex.set(slot.id, i);
    else if (slot.kind === 'space') for (const chain of slot.chains) slotIndex.set(chain, i);
    else if (slot.kind === 'ring') slotIndex.set(slot.node, i);
  });
  const inLayer = new Set(graph.layers[context.layer]!.stitches);
  // KB: 04 §3.4
  const ovalStart = context.oval && context.layer === 1 && graph.layers[0]!.undersides.length === 0;
  const pending = (finding: Finding) => {
    if (ovalStart && finding.rule === 'foundation-chain') return true;
    if (!PENDING_RULES.has(finding.rule)) return false;
    return finding.nodes.every((id) => inLayer.has(id) || (slotIndex.get(id) ?? -1) > context.frontier);
  };

  const remaining = context.used.filter((used, i) => !used && i > context.frontier).length;
  return { findings: findings.filter((finding) => !pending(finding)), remaining };
}
