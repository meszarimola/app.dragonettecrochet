// KB: core-geometry §28, §29
// KB: 06 §3.2

import { closeRound, contextOf, defaultCursor, endRow, layerSlots, startCursor, withoutStaleSkips, type EditCode, type EditResult, type Slot } from './editor.ts';
import { buildPieceGraph, type PieceGraph } from './graph.ts';
import { modeAsWorked } from './insertion.ts';
import { text, type CoreText } from './messages.ts';
import type { ChartLayout, Point } from './layout.ts';
import { libraryFor } from './stitch-variants.ts';
import type {
  Anchor,
  LayerEvent,
  NodeId,
  Pattern,
  Piece,
  RowConventions,
  StitchDefId,
  StitchFlag,
  StitchInsertion,
  StitchNode,
} from './types.ts';
import { validatePattern } from './validate.ts';

const done = (pattern: Pattern): EditResult => ({ ok: true, pattern });
const refuse = (reason: CoreText<EditCode>): EditResult => ({ ok: false, reason });
const UNCHANGED = { unchanged: true } as const;

function graphOf(pattern: Pattern): PieceGraph | null {
  const piece = pattern.pieces[0];
  if (!piece || piece.stitches.length === 0) return null;
  try {
    return buildPieceGraph(pattern, piece, libraryFor(pattern));
  } catch {
    return null;
  }
}

function withPiece(pattern: Pattern, piece: Piece): Pattern {
  return { ...pattern, pieces: [piece, ...pattern.pieces.slice(1)] };
}


function unitsOf(piece: Piece): Map<NodeId, (readonly NodeId[])[]> {
  const units = new Map<NodeId, (readonly NodeId[])[]>();
  const add = (members: readonly NodeId[]) => {
    for (const id of members) units.set(id, [...(units.get(id) ?? []), members]);
  };
  piece.groups.forEach((group) => add(group.members));
  piece.spaces.forEach((space) => add(space.chains));
  return units;
}

function closeOver(units: Map<NodeId, (readonly NodeId[])[]>, ids: Iterable<NodeId>, into: Set<NodeId>): void {
  const queue = [...ids];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (into.has(id)) continue;
    into.add(id);
    for (const unit of units.get(id) ?? []) queue.push(...unit);
  }
}

export function expandSelection(pattern: Pattern, ids: Iterable<NodeId>): NodeId[] {
  const piece = pattern.pieces[0];
  if (!piece) return [];
  const known = new Set(piece.stitches.map((node) => node.id));
  const chosen = new Set<NodeId>();
  closeOver(unitsOf(piece), [...ids].filter((id) => known.has(id)), chosen);
  return piece.stitches.filter((node) => chosen.has(node.id)).map((node) => node.id);
}

export function toggleUnit(pattern: Pattern, selection: readonly NodeId[], id: NodeId): NodeId[] {
  const unit = expandSelection(pattern, [id]);
  const next = new Set(selection);
  const present = unit.length > 0 && unit.every((member) => next.has(member));
  for (const member of unit) {
    if (present) next.delete(member);
    else next.add(member);
  }
  const piece = pattern.pieces[0];
  return piece ? piece.stitches.filter((node) => next.has(node.id)).map((node) => node.id) : [];
}

export function layerSelection(pattern: Pattern, layer: number): NodeId[] {
  return [...(graphOf(pattern)?.layers[layer]?.stitches ?? [])];
}

export function selectAll(pattern: Pattern): NodeId[] {
  return (pattern.pieces[0]?.stitches ?? []).map((node) => node.id);
}

export function rangeSelection(pattern: Pattern, from: NodeId, to: NodeId): NodeId[] {
  const stitches = pattern.pieces[0]?.stitches ?? [];
  const a = stitches.findIndex((node) => node.id === from);
  const b = stitches.findIndex((node) => node.id === to);
  if (a < 0 || b < 0) return expandSelection(pattern, [from, to]);
  return expandSelection(pattern, stitches.slice(Math.min(a, b), Math.max(a, b) + 1).map((node) => node.id));
}

export function nodesInRect(pattern: Pattern, layout: ChartLayout, a: Point, b: Point): NodeId[] {
  const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
  const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  const inside = [...layout.nodes.values()]
    .filter(({ top }) => top.x >= x0 && top.x <= x1 && top.y >= y0 && top.y <= y1)
    .map((node) => node.id);
  return expandSelection(pattern, inside);
}

export type FocusMove = 'left' | 'right' | 'up' | 'down' | 'first' | 'last';

// Left and right follow the symbol's x, so they stay correct in the mirrored view.
export function stepFocus(pattern: Pattern, layout: ChartLayout, focus: NodeId | null, move: FocusMove): NodeId | null {
  const node = focus ? layout.nodes.get(focus) : undefined;
  const stitches = pattern.pieces[0]?.stitches ?? [];
  if (!node) return [...stitches].reverse().find((candidate) => layout.nodes.has(candidate.id))?.id ?? null;

  const inLayer = (layer: number) => [...layout.nodes.values()].filter((candidate) => candidate.layer === layer);
  switch (move) {
    case 'left':
    case 'right': {
      const row = inLayer(node.layer).sort((p, q) => p.top.x - q.top.x);
      const at = row.findIndex((candidate) => candidate.id === node.id);
      return row[Math.max(0, Math.min(row.length - 1, at + (move === 'right' ? 1 : -1)))]!.id;
    }
    case 'up':
    case 'down': {
      const row = inLayer(node.layer + (move === 'up' ? 1 : -1));
      let best = node;
      let distance = Infinity;
      for (const candidate of row) {
        const d = Math.hypot(candidate.top.x - node.top.x, candidate.top.y - node.top.y);
        if (d < distance) [best, distance] = [candidate, d];
      }
      return best.id;
    }
    case 'first':
    case 'last': {
      const ids = layerSelection(pattern, node.layer).filter((id) => layout.nodes.has(id));
      return (move === 'first' ? ids[0] : ids[ids.length - 1]) ?? node.id;
    }
  }
}

export interface LayerCount {
  readonly layer: number;
  readonly shape: 'row' | 'round';
  readonly count: number;
}

export function describeByLayer(pattern: Pattern, ids: readonly NodeId[]): readonly LayerCount[] {
  const graph = graphOf(pattern);
  if (!graph) return [];
  const counts = new Map<number, number>();
  for (const id of ids) {
    const layer = graph.layerOf.get(id);
    if (layer !== undefined) counts.set(layer, (counts.get(layer) ?? 0) + 1);
  }
  return [...counts]
    .sort(([a], [b]) => a - b)
    .map(([layer, count]): LayerCount => ({ layer, shape: graph.layers[layer]!.shape, count }));
}

function byLayerData(pattern: Pattern, ids: readonly NodeId[]): Record<string, readonly number[] | readonly string[]> {
  const where = describeByLayer(pattern, ids);
  return {
    layers: where.map((entry) => entry.layer),
    shapes: where.map((entry) => entry.shape),
    counts: where.map((entry) => entry.count),
  };
}


export interface DeletionPlan {
  readonly selected: readonly NodeId[];
  readonly dependents: readonly NodeId[];
}

export function deletionPlan(pattern: Pattern, ids: Iterable<NodeId>): DeletionPlan {
  const piece = pattern.pieces[0];
  const selected = expandSelection(pattern, ids);
  if (!piece || selected.length === 0) return { selected, dependents: [] };

  const units = unitsOf(piece);
  const removed = new Set(selected);
  const spaceChains = new Map(piece.spaces.map((space) => [space.id, space.chains]));
  const ringNodes = new Map(piece.rings.map((ring) => [ring.id, ring.node]));
  const hits = (anchor: Anchor) => {
    if (anchor.into === 'stitch') return removed.has(anchor.id);
    if (anchor.into === 'space') return (spaceChains.get(anchor.id) ?? []).some((id) => removed.has(id));
    if (anchor.into === 'underside') return removed.has(anchor.id);
    return removed.has(ringNodes.get(anchor.id) ?? '');
  };
  // Targets lie earlier along the yarn, so one pass is normally enough; the loop is the safety net.
  for (let changed = true; changed; ) {
    changed = false;
    for (const node of piece.stitches) {
      if (removed.has(node.id) || !node.anchors.some(hits)) continue;
      closeOver(units, [node.id], removed);
      changed = true;
    }
  }
  const chosen = new Set(selected);
  const dependents = piece.stitches.filter((node) => removed.has(node.id) && !chosen.has(node.id)).map((node) => node.id);
  return { selected, dependents };
}

export function deleteStitches(pattern: Pattern, ids: Iterable<NodeId>, options: { readonly withDependents?: boolean } = {}): EditResult {
  const piece = pattern.pieces[0];
  const plan = deletionPlan(pattern, ids);
  if (!piece || plan.selected.length === 0) return refuse(text('no-selection'));
  if (plan.dependents.length > 0 && !options.withDependents) {
    return refuse(
      text('has-dependents', { count: plan.dependents.length, ...byLayerData(pattern, plan.dependents), ...UNCHANGED }),
    );
  }
  const remove = new Set([...plan.selected, ...plan.dependents]);
  // KB: core-geometry §27
  return done(withoutStaleSkips(withPiece(pattern, withoutNodes(pattern, piece, remove))));
}

function withoutNodes(pattern: Pattern, piece: Piece, remove: ReadonlySet<NodeId>): Piece {
  const graph = graphOf(pattern);
  const order = new Map(piece.stitches.map((node, i) => [node.id, i]));

  const events: LayerEvent[] = piece.events.filter((event) => !remove.has(event.after));
  const hasEvent = new Set(events.map((event) => event.after));
  for (const event of piece.events) {
    if (!remove.has(event.after)) continue;
    let i = order.get(event.after)! - 1;
    while (i >= 0 && remove.has(piece.stitches[i]!.id)) i -= 1;
    const kept = piece.stitches[i];
    if (!kept || hasEvent.has(kept.id)) continue;
    // Move a row-end event only within the same layer, and never onto a bare turning chain.
    const layer = graph?.layerOf.get(event.after);
    const info = layer === undefined ? undefined : graph?.layers[layer];
    if (graph && (graph.layerOf.get(kept.id) !== layer || info?.turningChain.includes(kept.id) || info?.travelSlips.includes(kept.id))) continue;
    events.push({ ...event, after: kept.id });
    hasEvent.add(kept.id);
  }
  events.sort((a, b) => order.get(a.after)! - order.get(b.after)!);

  const fastenedOff = new Set(events.filter((event) => event.kind === 'fasten-off').map((event) => event.after));
  const kept = piece.stitches.filter((node) => !remove.has(node.id));
  const stitches = kept.map((node, i): StitchNode => {
    const previous = kept[i - 1];
    const prev = previous === undefined || (node.prev === null && fastenedOff.has(previous.id)) ? null : previous.id;
    return node.prev === prev ? node : { ...node, prev };
  });

  return {
    ...piece,
    stitches,
    events,
    groups: piece.groups.filter((group) => group.members.every((id) => !remove.has(id))),
    spaces: piece.spaces.filter((space) => space.chains.every((id) => !remove.has(id))),
    rings: piece.rings.filter((ring) => !remove.has(ring.node)),
    skipped: piece.skipped.filter((id) => !remove.has(id)),
  };
}


export type FragmentAnchor =
  | { readonly kind: 'node'; readonly index: number; readonly mode: StitchInsertion }
  | { readonly kind: 'space'; readonly index: number }
  | { readonly kind: 'ring'; readonly index: number }
  | { readonly kind: 'underside'; readonly index: number }
  | { readonly kind: 'target'; readonly offset: number; readonly into: Slot['kind']; readonly mode: StitchInsertion | null };

export interface FragmentStitch {
  readonly def: StitchDefId;
  readonly anchors: readonly FragmentAnchor[];
  readonly flags?: readonly StitchFlag[];
}

export interface Fragment {
  readonly stitches: readonly FragmentStitch[];
  readonly groups: readonly { readonly def: StitchDefId; readonly members: readonly number[] }[];
  readonly spaces: readonly (readonly number[])[];
  readonly rings: readonly number[];
  readonly events: readonly { readonly after: number; readonly kind: LayerEvent['kind']; readonly conventions?: Partial<RowConventions> }[];
  readonly foundation: boolean;
  readonly startsLayer: boolean;
  readonly shape: 'row' | 'round';
  readonly side: 'right' | 'wrong';
  readonly opening: LayerEvent['kind'] | null;
  readonly travelSlips: number;
  readonly turningChain: number;
  readonly firstStitch: StitchDefId | null;
  readonly span: number | null;
  readonly layers: number;
}

export type CopyCode =
  | 'no-selection'
  | 'copy-broken-pattern'
  | 'copy-layer-outside'
  | 'copy-oval-first-round'
  | 'copy-anchor-unsupported';

export type CopyResult =
  | { readonly ok: true; readonly fragment: Fragment }
  | { readonly ok: false; readonly reason: CoreText<CopyCode> };

const slotKey = (kind: Slot['kind'] | Anchor['into'], id: string) => `${kind}:${id}`;

const OVAL_FIRST_ROUND = text('copy-oval-first-round');

export function copySelection(pattern: Pattern, ids: Iterable<NodeId>): CopyResult {
  const selected = expandSelection(pattern, ids);
  if (selected.length === 0) return { ok: false, reason: text('no-selection') };
  const graph = graphOf(pattern);
  if (!graph) return { ok: false, reason: text('copy-broken-pattern') };
  const { piece } = graph;

  const index = new Map(selected.map((id, i) => [id, i]));
  const layerOf = (id: NodeId) => graph.layerOf.get(id) ?? 0;
  const firstLayer = layerOf(selected[0]!);
  const layer = graph.layers[firstLayer]!;
  const foundation = firstLayer === 0;
  const spaces = piece.spaces.filter((space) => space.chains.every((id) => index.has(id)));
  const spaceIndex = new Map(spaces.map((space, i) => [space.id, i]));
  const rings = piece.rings.filter((ring) => index.has(ring.node));
  const ringIndex = new Map(rings.map((ring, i) => [ring.id, i]));

  const slots = foundation ? [] : layerSlots(graph, firstLayer, graph.layers[firstLayer - 1]!, layer.direction === -1, layer.shape);
  const slotOf = new Map(slots.map((slot, i) => [slotKey(slot.kind, slot.id), i]));

  type Draft = FragmentAnchor | { readonly kind: 'slot'; readonly slot: number; readonly into: Slot['kind']; readonly mode: StitchInsertion | null };
  const drafts: { def: StitchDefId; anchors: Draft[]; flags?: readonly StitchFlag[] }[] = [];
  for (const id of selected) {
    const node = graph.nodes.get(id)!;
    const anchors: Draft[] = [];
    for (const anchor of node.anchors) {
      if (anchor.into === 'stitch' && index.has(anchor.id)) anchors.push({ kind: 'node', index: index.get(anchor.id)!, mode: anchor.mode });
      else if (anchor.into === 'space' && spaceIndex.has(anchor.id)) anchors.push({ kind: 'space', index: spaceIndex.get(anchor.id)! });
      else if (anchor.into === 'ring' && ringIndex.has(anchor.id)) anchors.push({ kind: 'ring', index: ringIndex.get(anchor.id)! });
      else if (anchor.into === 'underside' && index.has(anchor.id)) anchors.push({ kind: 'underside', index: index.get(anchor.id)! });
      else {
        if (layerOf(id) !== firstLayer) {
          return { ok: false, reason: text('copy-layer-outside', { layer: layerOf(id), shape: graph.layers[layerOf(id)]!.shape }) };
        }
        // KB: 04 §3.4
        if (anchor.into === 'underside') return { ok: false, reason: OVAL_FIRST_ROUND };
        const slot = slotOf.get(slotKey(anchor.into, anchor.id));
        if (slot === undefined) {
          return { ok: false, reason: text('copy-anchor-unsupported') };
        }
        anchors.push({ kind: 'slot', slot, into: anchor.into, mode: anchor.into === 'stitch' ? anchor.mode : null });
      }
    }
    drafts.push({ def: node.def, anchors, ...(node.flags ? { flags: node.flags } : {}) });
  }

  const startsLayer = !foundation && layer.stitches[0] === selected[0];
  let lead = 0;
  let travelSlips = 0;
  let turningChain = 0;
  if (startsLayer) {
    while (lead < selected.length && layer.travelSlips.includes(selected[lead]!)) [travelSlips, lead] = [travelSlips + 1, lead + 1];
    while (lead < selected.length && layer.turningChain.includes(selected[lead]!)) [turningChain, lead] = [turningChain + 1, lead + 1];
  }
  const firstStitchNode = startsLayer && layer.firstStitch ? layer.firstStitch : selected.find((id) => graph.defs.get(id)!.kind !== 'chain');
  const firstStitch = firstStitchNode ? graph.nodes.get(firstStitchNode)!.def : null;

  // KB: core-geometry §28
  const used = drafts.flatMap((draft) => draft.anchors).flatMap((anchor) => (anchor.kind === 'slot' ? [anchor.slot] : []));
  let base = used.length > 0 ? Math.min(...used) : 0;
  let span: number | null = null;
  if (startsLayer) {
    const onFoundation = firstLayer === 1 && layer.shape === 'row';
    base = startCursor(pattern, { layer: firstLayer, shape: layer.shape, turningChain: onFoundation ? 0 : layer.turningChain.length, slots }, firstStitch);
    if (layer.stitches.every((id) => index.has(id))) span = slots.length - base;
  }

  const stitches: FragmentStitch[] = drafts.map((draft) => ({
    ...draft,
    anchors: draft.anchors.map((anchor): FragmentAnchor =>
      anchor.kind === 'slot' ? { kind: 'target', offset: anchor.slot - base, into: anchor.into, mode: anchor.mode } : anchor,
    ),
  }));

  const events: Fragment['events'][number][] = [];
  for (let i = 0; i + 1 < selected.length; i += 1) {
    const next = layerOf(selected[i + 1]!);
    if (next === layerOf(selected[i]!)) continue;
    const opening = graph.layers[next]!.opening;
    if (opening) events.push({ after: i, kind: opening.kind, ...(opening.conventions ? { conventions: opening.conventions } : {}) });
  }

  return {
    ok: true,
    fragment: {
      stitches,
      groups: piece.groups
        .filter((group) => group.members.every((id) => index.has(id)))
        .map((group) => ({ def: group.def, members: group.members.map((id) => index.get(id)!) })),
      spaces: spaces.map((space) => space.chains.map((id) => index.get(id)!)),
      rings: rings.map((ring) => index.get(ring.node)!),
      events,
      foundation,
      startsLayer,
      shape: layer.shape,
      side: layer.side,
      opening: layer.opening?.kind ?? null,
      travelSlips,
      turningChain,
      firstStitch,
      span,
      layers: layerOf(selected[selected.length - 1]!) - firstLayer + 1,
    },
  };
}


const STRUCTURAL_RULES = new Set(['unknown-stitch', 'dangling-reference', 'yarn-path', 'group-mismatch']);

function slotWord(kind: Slot['kind']): 'space' | 'ring' | 'stitch' {
  if (kind === 'space') return 'space';
  return kind === 'ring' ? 'ring' : 'stitch';
}

function ids(prefix: string, existing: Iterable<string>): () => string {
  let max = 0;
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  for (const id of existing) {
    const match = pattern.exec(id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return () => `${prefix}${(max += 1)}`;
}

export function pasteFragment(pattern: Pattern, fragment: Fragment, cursor?: number): EditResult {
  const piece = pattern.pieces[0];
  if (!piece) return refuse(text('no-piece'));
  if (fragment.stitches.length === 0) return refuse(text('clipboard-empty'));
  if (fragment.foundation || fragment.rings.length > 0) {
    if (piece.stitches.length > 0) return refuse(text('foundation-needs-empty', { ...UNCHANGED }));
    return assemble(pattern, fragment, [], 0, [], false);
  }
  if (piece.stitches.length === 0) return refuse(text('paste-needs-foundation'));

  let current = pattern;
  let skip = 0;
  let base: number;
  let context = contextOf(current);
  if (fragment.startsLayer) {
    if (context.shape !== fragment.shape) {
      return refuse(text('paste-shape-mismatch', { shape: fragment.shape, ...UNCHANGED }));
    }
    if (context.started) {
      const closed =
        context.shape === 'row'
          ? endRow(current)
          : fragment.opening === 'spiral'
            ? spiral(current)
            : closeRound(current);
      if (!closed.ok) return closed;
      current = closed.pattern;
      context = contextOf(current);
    }
    if (context.layer === 1) {
      // KB: 03 §1.2
      skip = fragment.turningChain;
    } else {
      if (context.turningChain > 0 && fragment.travelSlips > 0) {
        return refuse(text('paste-round-starts-with-slip', { ...UNCHANGED }));
      }
      if (context.turningChain > fragment.turningChain) {
        return refuse(
          text('paste-too-many-chains', {
            shape: fragment.shape,
            present: context.turningChain,
            copied: fragment.turningChain,
            ...UNCHANGED,
          }),
        );
      }
      skip = context.turningChain;
    }
    const turningChain = context.layer === 1 ? 0 : fragment.turningChain;
    base = startCursor(current, { layer: context.layer, shape: context.shape, turningChain, slots: context.slots }, fragment.firstStitch);
    const available = Math.max(0, context.slots.length - base);
    if (fragment.span !== null && available !== fragment.span) {
      return refuse(
        text('paste-span-mismatch', {
          shape: fragment.shape,
          needed: fragment.span + base,
          available: context.slots.length,
          ...UNCHANGED,
        }),
      );
    }
  } else {
    base = cursor ?? defaultCursor(current, context, fragment.firstStitch);
  }

  const targets = fragment.stitches.flatMap((stitch) => stitch.anchors).filter((anchor) => anchor.kind === 'target');
  const resolved: Slot[] = [];
  if (targets.length > 0) {
    const offsets = targets.map((target) => target.offset);
    const first = Math.min(0, ...offsets);
    const need = Math.max(...offsets) - first + 1;
    for (const target of targets) {
      const at = base + target.offset;
      const slot = at >= 0 ? context.slots[at] : undefined;
      if (!slot) {
        return refuse(
          text('paste-not-enough-slots', {
            need,
            available: Math.max(0, context.slots.length - base - first),
            fromLayerStart: fragment.startsLayer,
            shape: fragment.shape,
            ...UNCHANGED,
          }),
        );
      }
      if (slot.kind !== target.into) {
        return refuse(text('paste-slot-kind', { at: at + 1, slot: slotWord(slot.kind), copied: slotWord(target.into), ...UNCHANGED }));
      }
      if (context.used[at]) return refuse(text('paste-slot-used', { at: at + 1, ...UNCHANGED }));
      if (at <= context.frontier) {
        return refuse(text('paste-against-direction', { ...UNCHANGED }));
      }
      resolved.push(slot);
    }
  }

  const reused = skip > 0 ? current.pieces[0]!.stitches.slice(-skip).map((node) => node.id) : [];
  if (reused.length < skip) return refuse(text('paste-no-reuse-slots', { ...UNCHANGED }));
  const skipped = new Map(reused.map((id, k) => [fragment.travelSlips + k, id]));
  // KB: core-geometry §28
  const result = assemble(current, fragment, resolved, skip, [...skipped], context.side !== fragment.side);
  if (!result.ok) return result;

  const library = libraryFor(result.pattern);
  const broken = (candidate: Pattern) => validatePattern(candidate, library).filter((finding) => STRUCTURAL_RULES.has(finding.rule)).length;
  if (broken(result.pattern) > broken(pattern)) return refuse(text('paste-would-break', { ...UNCHANGED }));
  return result;
}

function spiral(pattern: Pattern): EditResult {
  const piece = pattern.pieces[0]!;
  const last = piece.stitches[piece.stitches.length - 1]!;
  return done(withPiece(pattern, { ...piece, events: [...piece.events, { after: last.id, kind: 'spiral' }] }));
}

function assemble(
  pattern: Pattern,
  fragment: Fragment,
  resolved: readonly Slot[],
  skip: number,
  reused: readonly (readonly [number, NodeId])[],
  flip: boolean,
): EditResult {
  const piece = pattern.pieces[0]!;
  const nextNode = ids('n', piece.stitches.map((node) => node.id));
  const nextSpace = ids('s', piece.spaces.map((space) => space.id));
  const nextRing = ids('r', piece.rings.map((ring) => ring.id));
  const nextGroup = ids('g', piece.groups.map((group) => group.id));

  const reuse = new Map(reused);
  const idOf = fragment.stitches.map((_, i) => reuse.get(i) ?? (i >= fragment.travelSlips && i < fragment.travelSlips + skip ? '' : nextNode()));
  const spaceIds = fragment.spaces.map(() => nextSpace());
  const ringIds = fragment.rings.map(() => nextRing());

  let target = 0;
  let prev = piece.stitches[piece.stitches.length - 1]?.id ?? null;
  const side = flip ? 'wrong' : 'right';
  const stitches: StitchNode[] = [];
  fragment.stitches.forEach((stitch, i) => {
    const anchors = stitch.anchors.map((anchor): Anchor => {
      switch (anchor.kind) {
        case 'node':
          return { into: 'stitch', id: idOf[anchor.index]!, mode: modeAsWorked(anchor.mode, side) };
        case 'space':
          return { into: 'space', id: spaceIds[anchor.index]! };
        case 'ring':
          return { into: 'ring', id: ringIds[anchor.index]! };
        case 'underside':
          return { into: 'underside', id: idOf[anchor.index]! };
        case 'target': {
          const slot = resolved[target++]!;
          return slot.kind === 'stitch' ? { into: 'stitch', id: slot.id, mode: modeAsWorked(anchor.mode ?? 'both-loops', side) } : { into: slot.kind, id: slot.id };
        }
      }
    });
    if (reuse.has(i)) return;
    const id = idOf[i]!;
    stitches.push({ id, def: stitch.def, prev, anchors, ...(stitch.flags ? { flags: stitch.flags } : {}) });
    prev = id;
  });

  return done(
    withPiece(pattern, {
      ...piece,
      stitches: [...piece.stitches, ...stitches],
      groups: [...piece.groups, ...fragment.groups.map((group) => ({ id: nextGroup(), def: group.def, members: group.members.map((i) => idOf[i]!) }))],
      spaces: [...piece.spaces, ...fragment.spaces.map((chains, k) => ({ id: spaceIds[k]!, chains: chains.map((i) => idOf[i]!) }))],
      rings: [...piece.rings, ...fragment.rings.map((node, k) => ({ id: ringIds[k]!, node: idOf[node]! }))],
      events: [
        ...piece.events,
        ...fragment.events.map((event) => ({ after: idOf[event.after]!, kind: event.kind, ...(event.conventions ? { conventions: event.conventions } : {}) })),
      ],
    }),
  );
}

export function duplicateSelection(pattern: Pattern, selection: Iterable<NodeId>): EditResult {
  const copied = copySelection(pattern, selection);
  if (!copied.ok) return refuse(copied.reason);
  return pasteFragment(pattern, copied.fragment);
}
