// KB: core-geometry §20, §21, §22
// KB: 03 §1.2, 03 §1.3, 03 §10 A4, 03 §10 B10, 04 §1.1, 04 §3.4, 06 §3.2, 06 §5.1

import type { StitchLibrary } from './stitch-library.ts';
import { stitchTurningChainCounts, traditionOf } from './tradition.ts';
import type {
  Layer,
  LayerEvent,
  NodeId,
  Pattern,
  Piece,
  Ring,
  RingId,
  Space,
  SpaceId,
  StitchDef,
  StitchGroup,
  StitchNode,
} from './types.ts';

export interface LayerInfo extends Layer {
  readonly turningChain: readonly NodeId[];
  readonly turningChainCounts: boolean;
  readonly opening: LayerEvent | null;
  readonly closing: LayerEvent | null;
  readonly travelSlips: readonly NodeId[];
  readonly joinSlip: NodeId | null;
  readonly firstStitch: NodeId | null;
  /** -1 after a turn and on the foundation chain, 1 in the round. KB: 01 §8.4 */
  readonly direction: 1 | -1;
  readonly positions: readonly NodeId[];
  /** Only on layer 0; empty on every other layer. KB: 04 §3.4 */
  readonly undersides: readonly NodeId[];
}

export function rowEdges(layer: LayerInfo): { readonly start: NodeId; readonly end: NodeId } | null {
  const start = layer.turningChain[layer.turningChain.length - 1] ?? layer.positions[0];
  const end = layer.positions[layer.positions.length - 1];
  return start === undefined || end === undefined ? null : { start, end };
}

export interface PieceGraph {
  readonly piece: Piece;
  readonly nodes: ReadonlyMap<NodeId, StitchNode>;
  readonly order: ReadonlyMap<NodeId, number>;
  readonly defs: ReadonlyMap<NodeId, StitchDef>;
  readonly spaces: ReadonlyMap<SpaceId, Space>;
  readonly rings: ReadonlyMap<RingId, Ring>;
  readonly spaceOfChain: ReadonlyMap<NodeId, Space>;
  readonly groupOf: ReadonlyMap<NodeId, StitchGroup>;
  readonly layerOf: ReadonlyMap<NodeId, number>;
  readonly layers: readonly LayerInfo[];
}

/** Expects a structurally valid piece; `validatePattern` checks that first. */
export function buildPieceGraph(pattern: Pattern, piece: Piece, library: StitchLibrary): PieceGraph {
  const nodes = new Map(piece.stitches.map((node) => [node.id, node]));
  const order = new Map(piece.stitches.map((node, index) => [node.id, index]));
  const defs = new Map<NodeId, StitchDef>();
  for (const node of piece.stitches) {
    const def = library.get(node.def);
    if (!def) throw new Error(`Ismeretlen szem: ${node.def} (${node.id})`);
    defs.set(node.id, def);
  }
  const kindOf = (node: StitchNode) => defs.get(node.id)!.kind;

  const spaces = new Map(piece.spaces.map((space) => [space.id, space]));
  const rings = new Map(piece.rings.map((ring) => [ring.id, ring]));
  const spaceOfChain = new Map<NodeId, Space>();
  for (const space of piece.spaces) for (const chain of space.chains) spaceOfChain.set(chain, space);
  const groupOf = new Map<NodeId, StitchGroup>();
  for (const group of piece.groups) for (const member of group.members) groupOf.set(member, group);
  const eventAfter = new Map(piece.events.map((event) => [event.after, event]));

  const stitches = piece.stitches;
  let cursor = 0;
  let foundation: 'chain' | 'ring' | 'none' = 'none';
  const foundationNodes: StitchNode[] = [];
  if (stitches.length > 0 && kindOf(stitches[0]!) === 'ring') {
    foundation = 'ring';
    foundationNodes.push(stitches[0]!);
    cursor = 1;
  } else {
    while (cursor < stitches.length && kindOf(stitches[cursor]!) === 'chain') {
      foundationNodes.push(stitches[cursor]!);
      cursor += 1;
      if (eventAfter.has(stitches[cursor - 1]!.id)) break;
    }
    if (foundationNodes.length > 0) foundation = 'chain';
  }

  const segments: StitchNode[][] = [];
  let current: StitchNode[] = [];
  for (; cursor < stitches.length; cursor += 1) {
    const node = stitches[cursor]!;
    current.push(node);
    if (eventAfter.has(node.id)) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length > 0) segments.push(current);

  // KB: 04 §1.1, core-geometry §21
  const roundEvent = (event: LayerEvent | undefined) => event?.kind === 'join-slip' || event?.kind === 'spiral';
  const chainRing =
    foundation === 'chain' && eventAfter.get(foundationNodes[foundationNodes.length - 1]!.id)?.kind === 'join-slip';
  // KB: 04 §3.4
  const firstRoundOnChain =
    foundation === 'chain' &&
    !chainRing &&
    segments.length > 0 &&
    (roundEvent(eventAfter.get(segments[0]!.at(-1)!.id)) ||
      segments[0]!.some((node) => node.anchors.some((anchor) => anchor.into === 'underside')));
  const roundStart = foundation === 'ring' || chainRing || firstRoundOnChain;

  // KB: 03 §1.2
  if (foundation === 'chain' && !chainRing && segments.length > 0) {
    const anchored = new Set<NodeId>();
    const segmentEnd = segments[0]!.at(-1)!;
    const closingSlip =
      kindOf(segmentEnd) === 'slip' && eventAfter.get(segmentEnd.id)?.kind === 'join-slip' ? segmentEnd : undefined;
    for (const node of segments[0]!) {
      if (node === closingSlip) continue;
      for (const anchor of node.anchors) {
        if (anchor.into === 'stitch' || anchor.into === 'underside') anchored.add(anchor.id);
        if (anchor.into === 'space') for (const chain of spaces.get(anchor.id)?.chains ?? []) anchored.add(chain);
      }
    }
    if (foundationNodes.some((node) => anchored.has(node.id))) {
      const trailing: StitchNode[] = [];
      while (foundationNodes.length > 0 && !anchored.has(foundationNodes[foundationNodes.length - 1]!.id)) {
        trailing.unshift(foundationNodes.pop()!);
      }
      // KB: 03 §5.2
      const skipped = new Set(piece.skipped);
      while (trailing.length > 0 && skipped.has(trailing[0]!.id)) foundationNodes.push(trailing.shift()!);
      // KB: core-geometry §22
      segments[0] = [...trailing, ...segments[0]!];
    }
  }

  // KB: 03 §10 B10
  const segmentOf = new Map<NodeId, number>();
  segments.forEach((segment, i) => {
    for (const node of segment) segmentOf.set(node.id, i + 1);
  });
  const workedInto = new Set<NodeId>();
  for (const node of stitches) {
    const layer = segmentOf.get(node.id) ?? 0;
    for (const anchor of node.anchors) {
      const targets =
        anchor.into === 'stitch' || anchor.into === 'underside'
          ? [anchor.id]
          : anchor.into === 'space'
            ? (spaces.get(anchor.id)?.chains ?? [])
            : [];
      for (const target of targets) if ((segmentOf.get(target) ?? 0) < layer) workedInto.add(target);
    }
  }

  const { conventions } = pattern;
  const layers: LayerInfo[] = [];
  const layerOf = new Map<NodeId, number>();

  const undersideTargets = new Set(
    stitches.flatMap((node) => node.anchors.flatMap((anchor) => (anchor.into === 'underside' ? [anchor.id] : []))),
  );
  const foundationIds = foundationNodes.map((node) => node.id);
  const foundationLast = foundationNodes[foundationNodes.length - 1];
  layers.push({
    piece: piece.id,
    index: 0,
    below: 0,
    row: 0,
    shape: roundStart ? 'round' : 'row',
    stitches: foundationIds,
    stitchCount: 0,
    writtenCount: 0,
    positionCount: foundationIds.length,
    side: 'right',
    turningChain: [],
    turningChainCounts: false,
    opening: null,
    closing: foundationLast ? (eventAfter.get(foundationLast.id) ?? null) : null,
    travelSlips: [],
    joinSlip: null,
    firstStitch: null,
    direction: 1,
    positions: foundationIds,
    undersides: foundationIds.filter((id) => undersideTargets.has(id)),
  });
  for (const id of foundationIds) layerOf.set(id, 0);

  segments.forEach((segment, segmentIndex) => {
    const index = segmentIndex + 1;
    const opening = layers[index - 1]!.closing;
    // KB: core-geometry §25
    const resume = opening?.kind === 'fasten-off' ? opening.resume : undefined;
    const below = resume !== undefined && resume.layer >= 0 && resume.layer < index ? resume.layer : index - 1;
    const alsoBelow =
      resume?.with !== undefined && resume.with > below && resume.with < index ? resume.with : undefined;
    const previous = layers[below]!;
    const last = segment[segment.length - 1]!;
    const closing = eventAfter.get(last.id) ?? null;

    let head = 0;
    const travelSlips: NodeId[] = [];
    if (opening?.kind === 'join-slip' || opening?.kind === 'turn') {
      // KB: core-geometry §21
      while (
        head < segment.length &&
        kindOf(segment[head]!) === 'slip' &&
        (segment[head] !== last || closing === null)
      ) {
        travelSlips.push(segment[head]!.id);
        head += 1;
      }
      const next = segment[head];
      const turning = next !== undefined && kindOf(next) === 'chain' && !spaceOfChain.has(next.id);
      if (opening.kind === 'turn' && !turning) {
        head = 0;
        travelSlips.length = 0;
      }
    }
    const turningChain: NodeId[] = [];
    // KB: 03 §5.2, 03 §5.5
    const startsSpace = (node: StitchNode) => spaceOfChain.get(node.id)?.chains[0] === node.id;
    while (
      head < segment.length &&
      kindOf(segment[head]!) === 'chain' &&
      !((turningChain.length > 0 || index === 1) && startsSpace(segment[head]!))
    ) {
      turningChain.push(segment[head]!.id);
      head += 1;
    }
    // KB: 03 §1.1, 03 §10 C17
    const rest = segment.slice(head).filter((node) => kindOf(node) !== 'chain');
    const firstStitch = (rest.find((node) => !node.flags?.includes('spike')) ?? rest[0])?.id ?? null;
    // KB: core-geometry §25
    const joined = closing?.kind === 'join-slip' || (closing?.kind === 'fasten-off' && closing.resume !== undefined);
    const joinSlip = joined && kindOf(last) === 'slip' ? last.id : null;

    let shape: Layer['shape'];
    if (opening === null) shape = roundStart ? 'round' : 'row';
    else if (opening.kind === 'turn') shape = 'row';
    else if (opening.kind === 'fasten-off') shape = previous.shape;
    else shape = 'round';

    const resumedRound = resume?.with !== undefined;
    const side: Layer['side'] =
      (opening?.kind === 'turn' || resume !== undefined) && !resumedRound
        ? previous.side === 'right'
          ? 'wrong'
          : 'right'
        : previous.side;

    let direction: 1 | -1;
    if (index === 1) direction = foundation === 'chain' && !roundStart ? -1 : 1;
    else direction = (opening?.kind === 'turn' || resume !== undefined) && !resumedRound ? -1 : 1;

    let turningChainCounts = false;
    if (turningChain.length > 0) {
      const setting = opening?.conventions?.turningChainCounts ?? conventions.turningChainCounts;
      turningChainCounts =
        setting === 'stitch-default'
          ? firstStitch !== null
            ? stitchTurningChainCounts(defs.get(firstStitch)!, traditionOf(conventions), shape)
            : // KB: core-geometry §23
              shape === 'row' && index >= 2
          : setting;
    }

    const turningSet = new Set(turningChain);
    const slipSet = new Set(travelSlips);
    if (joinSlip) slipSet.add(joinSlip);

    // KB: core-geometry §23
    const startingChainCounts = shape === 'round' && turningChainCounts;
    const startingChainIsPosition = turningChainCounts;
    let stitchCount = startingChainCounts ? 1 : 0;
    let positionCount = startingChainIsPosition ? 1 : 0;
    let writtenCount = turningChainCounts ? 1 : 0;
    const positions: NodeId[] = startingChainIsPosition ? [turningChain[turningChain.length - 1]!] : [];
    for (const node of segment) {
      if (turningSet.has(node.id)) continue;
      if (slipSet.has(node.id)) {
        const counted = conventions.joinSlipStitchCounts ? 1 : 0;
        stitchCount += counted;
        positionCount += counted;
        writtenCount += counted;
        continue;
      }
      const def = defs.get(node.id)!;
      switch (def.kind) {
        case 'chain':
          if (workedInto.has(node.id)) stitchCount += 1;
          if (
            conventions.chainCounts === true ||
            (conventions.chainCounts === 'worked-into' && workedInto.has(node.id))
          ) {
            writtenCount += 1;
          }
          positionCount += 1;
          positions.push(node.id);
          break;
        case 'ring':
          positionCount += 1;
          positions.push(node.id);
          break;
        case 'picot':
          if (conventions.picotCounts) {
            stitchCount += 1;
            writtenCount += 1;
            positionCount += 1;
            positions.push(node.id);
          }
          break;
        default:
          stitchCount += def.produces;
          positionCount += def.produces;
          writtenCount += def.produces;
          positions.push(node.id);
      }
    }

    const ids = segment.map((node) => node.id);
    for (const id of ids) layerOf.set(id, index);
    layers.push({
      piece: piece.id,
      index,
      below,
      ...(alsoBelow === undefined
        ? {}
        : {
            alsoBelow,
            basePositions: baseRing(layers[below]!, layers[alsoBelow]!, segment, defs, new Set(piece.skipped)),
          }),
      // KB: core-geometry §25
      row: previous.row + 1,
      shape,
      stitches: ids,
      stitchCount,
      writtenCount,
      positionCount,
      side,
      turningChain,
      turningChainCounts,
      opening,
      closing,
      travelSlips,
      joinSlip,
      firstStitch,
      direction,
      positions,
      undersides: [],
    });
  });

  // KB: core-geometry §22
  const base = layers[0];
  if (base !== undefined && base.shape === 'row') {
    const risen = (layers[1]?.turningChain.length ?? 0) > 0 ? 1 : 0;
    layers[0] = { ...base, writtenCount: base.positionCount + risen };
  }

  return { piece, nodes, order, defs, spaces, rings, spaceOfChain, groupOf, layerOf, layers };
}

/** KB: 03 §1.3, 03 §5.5 */
export function spacePositions(below: LayerInfo, space: Space): readonly NodeId[] {
  const { turningChain } = below;
  const whole =
    below.turningChainCounts &&
    space.chains.length === turningChain.length &&
    space.chains.every((id, i) => id === turningChain[i]);
  return whole ? [turningChain[turningChain.length - 1]!] : space.chains;
}

export interface ChainBridge {
  readonly chains: readonly NodeId[];
  readonly bridged: readonly NodeId[];
}

// KB: core-geometry §24
export function chainBridges(graph: PieceGraph, index: number): ChainBridge[] {
  const layer = graph.layers[index];
  const below = layer === undefined ? undefined : graph.layers[layer.below];
  if (!layer || !below || index === 0) return [];
  const turning = new Set(layer.turningChain);
  const seat = new Map<NodeId, number>();
  below.positions.forEach((id, at) => seat.set(id, at));
  const seatsOf = (id: NodeId): number[] => {
    const node = graph.nodes.get(id);
    if (!node) return [];
    const targets: NodeId[] = [];
    for (const anchor of node.anchors) {
      if (anchor.into === 'stitch' || anchor.into === 'underside') targets.push(anchor.id);
      else if (anchor.into === 'space') targets.push(...(graph.spaces.get(anchor.id)?.chains ?? []));
    }
    return targets.map((target) => seat.get(target)).filter((at): at is number => at !== undefined);
  };

  const bridges: ChainBridge[] = [];
  let run: NodeId[] = [];
  let behind: number[] = [];
  for (const id of layer.stitches) {
    if (turning.has(id)) continue;
    const kind = graph.defs.get(id)?.kind;
    if (kind === 'chain') {
      run.push(id);
      continue;
    }
    // A picot sits on the stitch before it and does not break the chain run.
    if (kind === 'picot') continue;
    const ahead = seatsOf(id);
    if (run.length > 0 && behind.length > 0 && ahead.length > 0) {
      // The inner edges of the gap, whichever direction the row runs.
      const [from, to] =
        Math.max(...behind) < Math.min(...ahead)
          ? [Math.max(...behind), Math.min(...ahead)]
          : [Math.max(...ahead), Math.min(...behind)];
      const bridged = below.positions.slice(from + 1, to);
      if (bridged.length > 0) bridges.push({ chains: run, bridged });
    }
    run = [];
    if (ahead.length > 0) behind = ahead;
  }
  return bridges;
}

export function computeLayers(pattern: Pattern, library: StitchLibrary): Layer[] {
  return pattern.pieces.flatMap((piece) =>
    buildPieceGraph(pattern, piece, library).layers.map(
      ({ piece: pieceId, index, below, row, shape, stitches, stitchCount, writtenCount, positionCount, side }) => ({
        piece: pieceId,
        index,
        below,
        row,
        shape,
        stitches,
        stitchCount,
        writtenCount,
        positionCount,
        side,
      }),
    ),
  );
}

// KB: core-geometry §25
function baseRing(
  below: LayerInfo,
  also: LayerInfo,
  segment: readonly StitchNode[],
  defs: Map<NodeId, StitchDef>,
  skipped: ReadonlySet<NodeId>,
): NodeId[] {
  const targets = new Set<NodeId>();
  for (const node of segment) for (const anchor of node.anchors) if (anchor.into === 'stitch') targets.add(anchor.id);
  const run = (positions: readonly NodeId[], member: (id: NodeId) => boolean) => {
    const at = positions.findIndex((id) => targets.has(id) && member(id));
    if (at < 0) return [];
    let from = at;
    let to = at;
    while (from > 0 && member(positions[from - 1]!)) from -= 1;
    while (to < positions.length - 1 && member(positions[to + 1]!)) to += 1;
    return positions.slice(from, to + 1);
  };
  return [
    ...run(below.positions, (id) => skipped.has(id)),
    ...run(also.positions, (id) => defs.get(id)!.kind === 'chain'),
  ];
}
