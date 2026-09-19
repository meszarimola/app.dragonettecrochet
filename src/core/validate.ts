// KB: core-domain §16

import { amigurumiFindings } from './amigurumi.ts';
import { buildPieceGraph, spacePositions, type LayerInfo, type PieceGraph } from './graph.ts';
import { isPostMode, modeAsWorked } from './insertion.ts';
import { MAX_CARRIED_COLORS } from './pixel-chart.ts';
import { roundFindings } from './rounds.ts';
import { RULES, type RuleId } from './rules.ts';
import type { StitchLibrary } from './stitch-library.ts';
import { skippedChains } from './tradition.ts';
import type { Anchor, Finding, NodeId, Pattern, Piece, PieceId, StitchNode } from './types.ts';

export function validatePattern(pattern: Pattern, library: StitchLibrary): Finding[] {
  const findings = pattern.pieces.flatMap((piece) => validatePiece(pattern, piece, library));
  for (const finding of amigurumiFindings(pattern, library)) findings.push(makeFinding(finding.rule, finding.piece, finding.nodes));
  return findings;
}

type Report = (rule: RuleId, nodes: readonly NodeId[]) => void;

/** KB: 03 §5.6 */
export const MAX_SPIKE_DEPTH = 3;

export function makeFinding(rule: RuleId, piece: PieceId, nodes: readonly NodeId[]): Finding {
  const { severity, reference } = RULES[rule];
  return { severity, rule, reference, piece, nodes: [...new Set(nodes)] };
}

function validatePiece(pattern: Pattern, piece: Piece, library: StitchLibrary): Finding[] {
  const findings: Finding[] = [];
  const report: Report = (rule, nodes) => findings.push(makeFinding(rule, piece.id, nodes));

  checkStructure(piece, library, report);
  if (findings.length > 0) return findings;

  const graph = buildPieceGraph(pattern, piece, library);
  checkGroups(graph, library, report);
  checkInsertions(graph, library, report);
  const invalidAnchors = checkFutureAnchors(graph, report);
  // A bad resume makes every later rule misleading, because the graph falls back to the previous row. KB: core-domain §12
  for (let index = 1; index < graph.layers.length; index += 1) {
    const opening = graph.layers[index]!.opening;
    const resume = opening?.kind === 'fasten-off' ? opening.resume : undefined;
    // KB: core-domain §12
    const twoSource = resume?.with !== undefined;
    const target = resume === undefined ? null : graph.layers[resume.layer];
    const badTarget = resume !== undefined && (resume.layer < 1 || resume.layer >= index || target === undefined);
    const badShape = !badTarget && resume !== undefined && target!.shape !== (twoSource ? 'round' : 'row');
    const badWith = twoSource && !(resume!.with! > resume!.layer && resume!.with! < index && graph.layers[resume!.with!]!.shape === 'round');
    if (resume !== undefined && (badTarget || badShape || badWith)) report('resume-layer', [opening!.after]);
  }
  if (findings.length > 0) return findings;

  for (let index = 1; index < graph.layers.length; index += 1) {
    // The oval's round 1 works into both sides of the chains, so it has its own walk. KB: 04 §3.4
    if (index === 1 && graph.layers[0]!.undersides.length > 0) checkChainSides(graph, index, invalidAnchors, report);
    else checkLayer(pattern, graph, index, invalidAnchors, report, () => findings.length);
  }
  for (const finding of roundFindings(pattern, graph, library)) report(finding.rule, finding.nodes);
  // KB: 03 §5.3, 03 §10 G36
  if (piece.grid?.technique === 'tapestry') {
    for (const layer of graph.layers.slice(1)) {
      const colors = new Set(layer.stitches.map((id) => graph.nodes.get(id)!.color ?? 0));
      if (colors.size > MAX_CARRIED_COLORS) report('carried-colors', layer.stitches);
    }
  }
  return findings;
}

const anchorKey = (anchor: Anchor) => `${anchor.into}:${anchor.id}`;
const anchorRef = (node: NodeId, index: number) => `${node}#${index}`;

function checkStructure(piece: Piece, library: StitchLibrary, report: Report): void {
  const nodeIds = new Set<NodeId>();
  for (const node of piece.stitches) {
    if (nodeIds.has(node.id)) report('dangling-reference', [node.id]);
    nodeIds.add(node.id);
  }
  const spaceIds = new Set(piece.spaces.map((space) => space.id));
  const ringIds = new Set(piece.rings.map((ring) => ring.id));
  if (spaceIds.size !== piece.spaces.length || ringIds.size !== piece.rings.length) report('dangling-reference', []);
  if (new Set(piece.groups.map((group) => group.id)).size !== piece.groups.length) report('dangling-reference', []);

  const kindOf = (id: NodeId) => library.get(piece.stitches.find((node) => node.id === id)?.def ?? '')?.kind;

  for (const node of piece.stitches) {
    const def = library.get(node.def);
    if (!def || def.kind === 'group' || def.kind === 'space') report('unknown-stitch', [node.id]);
    for (const anchor of node.anchors) {
      const exists =
        anchor.into === 'stitch' || anchor.into === 'underside' ? nodeIds.has(anchor.id) : anchor.into === 'space' ? spaceIds.has(anchor.id) : ringIds.has(anchor.id);
      if (!exists) report('dangling-reference', [node.id]);
    }
  }
  for (const space of piece.spaces) {
    if (space.chains.length === 0) report('dangling-reference', []);
    for (const chain of space.chains) if (kindOf(chain) !== 'chain') report('dangling-reference', nodeIds.has(chain) ? [chain] : []);
  }
  for (const ring of piece.rings) if (kindOf(ring.node) !== 'ring') report('dangling-reference', nodeIds.has(ring.node) ? [ring.node] : []);
  for (const group of piece.groups) {
    if (library.get(group.def)?.kind !== 'group') report('unknown-stitch', group.members.filter((id) => nodeIds.has(id)));
    if (group.members.some((id) => !nodeIds.has(id))) report('dangling-reference', group.members.filter((id) => nodeIds.has(id)));
  }
  const eventNodes = new Set<NodeId>();
  for (const event of piece.events) {
    if (!nodeIds.has(event.after)) report('dangling-reference', []);
    else if (eventNodes.has(event.after)) report('yarn-path', [event.after]);
    eventNodes.add(event.after);
  }
  for (const id of piece.skipped) if (!nodeIds.has(id)) report('dangling-reference', []);

  if (nodeIds.size !== piece.stitches.length) return;
  const fastenedOff = new Set(piece.events.filter((event) => event.kind === 'fasten-off').map((event) => event.after));
  piece.stitches.forEach((node, index) => {
    const previous = piece.stitches[index - 1];
    const valid = previous
      ? node.prev === previous.id || (node.prev === null && fastenedOff.has(previous.id))
      : node.prev === null;
    if (!valid) report('yarn-path', [node.id]);
  });
}

function checkGroups(graph: PieceGraph, library: StitchLibrary, report: Report): void {
  for (const group of graph.piece.groups) {
    const def = library.get(group.def);
    const members = group.members.map((id) => graph.nodes.get(id)!);
    const expected = def?.kind === 'group' ? def.members : [];
    const sameDefs = members.length === expected.length && members.every((node, i) => node.def === expected[i]);
    const consecutive = members.every((node, i) => i === 0 || graph.order.get(node.id) === graph.order.get(members[i - 1]!.id)! + 1);
    const anchored = members.filter((node) => graph.defs.get(node.id)!.kind !== 'chain');
    const keys = new Set(anchored.map((node) => (node.anchors.length === 1 ? anchorKey(node.anchors[0]!) : '')));
    const oneTarget = keys.size === 1 && !keys.has('');
    if (!sameDefs || !consecutive || !oneTarget) report('group-mismatch', group.members);
  }
}

/** The allowed modes are seen from the crocheter, the graph stores the right-side mode, so a wrong-side row is compared reversed. For a compound stitch the group's list counts too. */
function checkInsertions(graph: PieceGraph, library: StitchLibrary, report: Report): void {
  const groupDef = new Map(graph.piece.groups.flatMap((group) => group.members.map((id) => [id, library.get(group.def)] as const)));
  for (const node of graph.piece.stitches) {
    const side = graph.layers[graph.layerOf.get(node.id) ?? 0]?.side ?? 'right';
    const defs = [graph.defs.get(node.id), groupDef.get(node.id)];
    const invalid = node.anchors.some(
      (anchor) => anchor.into === 'stitch' && defs.some((def) => def && !def.insertionModes.includes(modeAsWorked(anchor.mode, side))),
    );
    if (invalid) report('insertion-mode', [node.id]);
  }
}

function checkFutureAnchors(graph: PieceGraph, report: Report): Set<string> {
  const invalid = new Set<string>();
  for (const node of graph.piece.stitches) {
    const own = graph.order.get(node.id)!;
    node.anchors.forEach((anchor, index) => {
      let target: number;
      if (anchor.into === 'stitch' || anchor.into === 'underside') target = graph.order.get(anchor.id)!;
      else if (anchor.into === 'space') target = Math.max(...graph.spaces.get(anchor.id)!.chains.map((id) => graph.order.get(id)!));
      else target = graph.order.get(graph.rings.get(anchor.id)!.node)!;
      if (target >= own) {
        report('future-anchor', [node.id]);
        invalid.add(anchorRef(node.id, index));
      }
    });
  }
  return invalid;
}

interface Entry {
  readonly node: StitchNode;
  readonly anchor: Anchor;
  /** Numbered along the working direction (0 = the first position the layer reaches). */
  readonly min: number;
  readonly max: number;
}

function checkLayer(
  pattern: Pattern,
  graph: PieceGraph,
  index: number,
  invalidAnchors: ReadonlySet<string>,
  report: Report,
  findingCount: () => number,
): void {
  const layer = graph.layers[index]!;
  const below = graph.layers[layer.below]!;
  // KB: core-domain §12
  const alsoBelow = layer.alsoBelow === undefined ? null : graph.layers[layer.alsoBelow]!;
  const basePositions = layer.basePositions ?? (alsoBelow === null ? below.positions : [...below.positions, ...alsoBelow.positions]);
  const length = basePositions.length;
  const positionIndex = new Map(basePositions.map((id, i) => [id, i]));
  const toWorking = (i: number) => (layer.direction === 1 ? i : length - 1 - i);
  const belowTurning = new Set(below.turningChain);
  // In a round the top of the beginning chain stays a target (the closing slip stitch goes there); in a row the turning chain does not.
  const turningTop = below.turningChainCounts ? below.turningChain[below.turningChain.length - 1] : undefined;
  const kind = (id: NodeId) => graph.defs.get(id)!.kind;

  let layerInvalid = false;
  const entries: Entry[] = [];

  for (const id of layer.stitches) {
    if (id === layer.joinSlip) continue;
    const node = graph.nodes.get(id)!;
    const def = graph.defs.get(id)!;
    const expected = def.kind === 'chain' || def.kind === 'ring' ? 0 : def.consumes;
    if (node.anchors.length > 1 && def.kind !== 'joined') report('unmarked-decrease', [id]);
    else if (node.anchors.length !== expected) report('anchor-count', [id]);

    node.anchors.forEach((anchor, anchorIndex) => {
      if (invalidAnchors.has(anchorRef(id, anchorIndex))) {
        layerInvalid = true;
        return;
      }
      const targets =
        anchor.into === 'stitch'
          ? [anchor.id]
          : anchor.into === 'space'
            ? graph.spaces.get(anchor.id)!.chains
            : [graph.rings.get(anchor.id)!.node];
      const targetLayer = graph.layerOf.get(targets[0]!) ?? -1;

      // Only the TOP of the turning chain is a target; its lower chains are not. KB: core-domain §17
      const intoTurning = belowTurning.has(anchor.id) && anchor.id !== turningTop;
      if (anchor.into === 'stitch' && intoTurning) {
        report('turning-chain-placement', [id, anchor.id]);
        layerInvalid = true;
        return;
      }
      if (targetLayer < layer.below && node.flags?.includes('spike')) {
        // KB: 03 §5.6, 03 §10 C17, G34
        if (index - targetLayer > MAX_SPIKE_DEPTH) {
          report('spike-depth', [id]);
          layerInvalid = true;
          return;
        }
        if (!workedBetween(graph, targets, targetLayer, index)) return;
      }
      const positions = anchor.into === 'space' ? spacePositions(below, graph.spaces.get(anchor.id)!) : targets;
      const indices = positions.map((target) => positionIndex.get(target));
      const fromSource = targetLayer === layer.below || (layer.alsoBelow !== undefined && targetLayer === layer.alsoBelow);
      if (!fromSource || indices.some((i) => i === undefined)) {
        report('anchor-layer', [id]);
        layerInvalid = true;
        return;
      }
      if (anchor.into === 'stitch' && !graph.defs.get(anchor.id)!.workableTop) report('unworkable-top', [id]);
      const working = (indices as number[]).map(toWorking);
      entries.push({ node, anchor, min: Math.min(...working), max: Math.max(...working) });
    });
  }

  // Several stitches in one stitch only as a marked group; a chain space or a ring takes any number. KB: 03 §10 C14, 01 §8.2 rule 11
  const byTarget = new Map<NodeId, Set<StitchNode>>();
  for (const entry of entries) {
    if (entry.anchor.into !== 'stitch') continue;
    const set = byTarget.get(entry.anchor.id) ?? new Set();
    set.add(entry.node);
    byTarget.set(entry.anchor.id, set);
  }
  for (const nodes of byTarget.values()) {
    if (nodes.size < 2) continue;
    const groups = new Set([...nodes].map((node) => graph.groupOf.get(node.id)));
    if (groups.size !== 1 || groups.has(undefined)) {
      report('unmarked-increase', [...nodes].sort((a, b) => graph.order.get(a.id)! - graph.order.get(b.id)!).map((node) => node.id));
    }
  }

  checkCountsAndChains(graph, index, report);
  if (layerInvalid || entries.length === 0) return;

  const walkStart = findingCount();
  const skipped = new Set(graph.piece.skipped);
  // KB: core-domain §17; 03 §1.3
  const optional = layer.shape === 'round' && index >= 2 && layer.turningChainCounts ? 0 : -1;
  const positionAt = (w: number) => basePositions[layer.direction === 1 ? w : length - 1 - w]!;
  const gap = (from: number, to: number) => {
    let count = 0;
    for (let w = from; w <= to; w += 1) if (w !== optional && !covered[w] && !skipped.has(positionAt(w))) count += 1;
    return count;
  };
  const firstEntry = entries.find((entry) => !layer.travelSlips.includes(entry.node.id));
  const singleKey = (node: StitchNode) => (node.anchors.length === 1 ? anchorKey(node.anchors[0]!) : null);

  const fan = (node: StitchNode) => {
    const key = singleKey(node);
    if (key === null) return 1;
    const at = layer.stitches.indexOf(node.id);
    const run = [node.id];
    for (const step of [-1, 1]) {
      for (let i = at + step; i >= 0 && i < layer.stitches.length; i += step) {
        const other = layer.stitches[i]!;
        if (kind(other) === 'chain') continue;
        if (other === layer.joinSlip || singleKey(graph.nodes.get(other)!) !== key) break;
        run.push(other);
      }
    }
    // A counting turning chain at the start of the row is part of the fan (half a shell: 3 ch + 2 dc).
    const withTurningChain = layer.turningChainCounts && firstEntry && firstEntry.min === 0 && run.includes(firstEntry.node.id);
    return run.length + (withTurningChain ? 1 : 0);
  };
  const chainsBetween = (a: StitchNode, b: StitchNode) => {
    const from = layer.stitches.indexOf(a.id);
    const to = layer.stitches.indexOf(b.id);
    return layer.stitches.slice(from + 1, to).filter((id) => kind(id) === 'chain' && !layer.turningChain.includes(id)).length;
  };

  const covered = new Array<boolean>(length).fill(false);
  const gaps: { before: StitchNode; after: StitchNode; from: number; to: number }[] = [];
  let frontier = -1;
  let previous: Entry | null = null;
  for (const entry of entries) {
    const exempt =
      entry.node.flags?.includes('crossed') === true ||
      (entry.anchor.into === 'stitch' && (entry.anchor.mode === 'front-post' || entry.anchor.mode === 'back-post'));
    if (previous) {
      const sameNode = previous.node === entry.node;
      const backwards = sameNode ? entry.min <= previous.max : entry.max < frontier;
      if (backwards) {
        if (!exempt) report('against-direction', [previous.node.id, entry.node.id]);
        for (let w = entry.min; w <= entry.max; w += 1) covered[w] = true;
        continue;
      }
      const from = (sameNode ? previous.max : frontier) + 1;
      if (!exempt && from <= entry.min - 1) gaps.push({ before: previous.node, after: entry.node, from, to: entry.min - 1 });
    }
    for (let w = entry.min; w <= entry.max; w += 1) covered[w] = true;
    frontier = Math.max(frontier, entry.max);
    previous = entry;
  }

  // Gaps are checked after the walk: a crossed or backwards stitch can still fill one.
  for (const { before, after, from, to } of gaps) {
    const skippedCount = gap(from, to);
    if (skippedCount === 0) continue;
    if (before === after) {
      report('reach', [after.id]);
      continue;
    }
    const chains = chainsBetween(before, after);
    const fanBefore = fan(before);
    const fanAfter = fan(after);
    const bridged =
      skippedCount <= chains + 1 ||
      Math.max(fanBefore, fanAfter) >= skippedCount + 1 ||
      fanBefore - 1 + fanAfter - 1 + chains >= skippedCount;
    if (!bridged) report('reach', [before.id, after.id]);
    else if (skippedCount === 1 && chains === 0 && fanBefore === 1 && fanAfter === 1) {
      report('reach-single', [before.id, after.id]);
    }
  }

  // KB: core-domain §12
  const elsewhere = new Set<NodeId>();
  let shared = false;
  if (graph.piece.events.some((event) => event.kind === 'fasten-off' && event.resume !== undefined)) {
    // KB: core-domain §12
    const sourceOf = (other: LayerInfo) =>
      other.below === layer.below || (layer.alsoBelow !== undefined && other.below === layer.alsoBelow);
    for (const other of graph.layers) {
      if (other.index !== index && other.below === layer.below) shared = true;
      if (other.index === index || !sourceOf(other)) continue;
      let first = Number.POSITIVE_INFINITY;
      for (const id of other.stitches) {
        for (const anchor of graph.nodes.get(id)!.anchors) {
          if (anchor.into === 'space') for (const chain of graph.spaces.get(anchor.id)!.chains) elsewhere.add(chain);
          else if (anchor.into !== 'ring') elsewhere.add(anchor.id);
          if (anchor.into !== 'stitch') continue;
          const at = positionIndex.get(anchor.id);
          if (at !== undefined) first = Math.min(first, toWorking(at));
        }
      }
      // KB: 03 §1.3
      if (other.turningChainCounts && Number.isFinite(first) && first >= 1) elsewhere.add(positionAt(first - 1));
    }
  }

  // KB: core-domain §17
  const belowTop = below.shape === 'row' ? turningTop : undefined;

  // The middle of the row is the reach rule's job. KB: 03 §10 B8, C15
  const first = entries[0]!.min;
  // KB: core-domain §17
  const seat = layer.turningChainCounts && (layer.shape === 'row' || shared) ? first - 1 : -1;
  for (let w = 0; w < length; w += 1) {
    if (covered[w] || (w > first && w < frontier) || w === optional || w === seat) continue;
    if (positionAt(w) === belowTop) continue;
    if (!skipped.has(positionAt(w)) && !elsewhere.has(positionAt(w))) report('unused-position', [positionAt(w)]);
  }

  const repeat = pattern.conventions.repeat;
  if (repeat && layer.shape === 'row' && findingCount() === walkStart) {
    // KB: core-domain §17
    const own = layer.positionCount - (layer.turningChainCounts && layer.shape === 'row' ? 1 : 0);
    if (length - (belowTop === undefined ? 0 : 1) !== own) report('repeat-balance', layer.stitches);
  }
}

/** KB: 03 §10 C17 */
function workedBetween(graph: PieceGraph, targets: readonly NodeId[], fromLayer: number, toLayer: number): boolean {
  const targetSet = new Set(targets);
  for (let index = fromLayer + 1; index < toLayer; index += 1) {
    for (const id of graph.layers[index]!.stitches) {
      for (const anchor of graph.nodes.get(id)!.anchors) {
        const hit =
          anchor.into === 'stitch' ? targetSet.has(anchor.id) : anchor.into === 'space' && graph.spaces.get(anchor.id)!.chains.some((c) => targetSet.has(c));
        if (hit) return true;
      }
    }
  }
  return false;
}

function checkCountsAndChains(graph: PieceGraph, index: number, report: Report): void {
  const layer = graph.layers[index]!;
  const below = graph.layers[index - 1]!;
  const kind = (id: NodeId) => graph.defs.get(id)!.kind;

  if (layer.closing?.statedCount !== undefined && layer.closing.statedCount !== layer.writtenCount) {
    report('stated-count', [layer.closing.after]);
  }

  if (layer.closing?.kind === 'join-slip') {
    const join = graph.nodes.get(layer.closing.after)!;
    const anchor = join.anchors[0];
    const valid =
      layer.joinSlip !== null && join.anchors.length === 1 && anchor?.into === 'stitch' && anchor.id === layer.positions[0];
    if (!valid) report('round-join', [join.id]);
  }

  const firstStitch = layer.firstStitch;
  if (firstStitch !== null) {
    const expected = graph.defs.get(firstStitch)!.turningChain;
    // Round 1 worked into a chain ring or a chain is a round, not a row on a foundation chain.
    const onChain = index === 1 && below.shape === 'row' && below.stitches.length > 0 && kind(below.stitches[0]!) === 'chain';
    if (onChain) {
      // KB: core-domain §5; 03 §1.2, 03 §5.5
      const skipped = skippedChains(expected, layer.turningChainCounts);
      const leading = layer.stitches.slice(0, layer.stitches.indexOf(firstStitch)).filter((id) => kind(id) === 'chain');
      if (leading.length !== skipped) report('foundation-chain', [...leading, firstStitch]);
    } else {
      const startsWithChain =
        layer.opening?.kind === 'turn' || layer.opening?.kind === 'join-slip' || (index === 1 && below.shape === 'round');
      // A post stitch is shorter than its base, so a ribbed row starts one chain short. KB: 01 §2.2, 01 §4.3
      const post = layer.stitches.some((id) =>
        graph.nodes.get(id)!.anchors.some((anchor) => anchor.into === 'stitch' && isPostMode(anchor.mode)),
      );
      const fits = layer.turningChain.length === expected || (post && layer.turningChain.length === expected - 1);
      if (startsWithChain && !fits) {
        report('turning-chain-height', layer.turningChain.length > 0 ? layer.turningChain : [firstStitch]);
      }
    }
  }

  // KB: 03 §10 C18
  const trailing: NodeId[] = [];
  for (let i = layer.stitches.length - 1; i >= 0; i -= 1) {
    const id = layer.stitches[i]!;
    if (kind(id) !== 'chain' || layer.turningChain.includes(id)) break;
    trailing.unshift(id);
  }
  // A deliberately skipped chain is bridged by the next row's chain. KB: 03 §5.2
  const skipped = new Set(graph.piece.skipped);
  if (trailing.length > 0 && !trailing.some((id) => isWorkedInto(graph, id) || skipped.has(id))) report('floating-chain', trailing);
}

function isWorkedInto(graph: PieceGraph, chain: NodeId): boolean {
  const space = graph.spaceOfChain.get(chain);
  return graph.piece.stitches.some((node) =>
    node.anchors.some((anchor) => (anchor.into === 'stitch' ? anchor.id === chain : anchor.into === 'space' && anchor.id === space?.id)),
  );
}

// KB: core-domain §18

/** The far chain's other side may be left out, because the increase at the end wraps around it. KB: 04 §3.4, 04 §9.4 */
function checkChainSides(graph: PieceGraph, index: number, invalidAnchors: ReadonlySet<string>, report: Report): void {
  const layer = graph.layers[index]!;
  const chains = graph.layers[0]!.positions;
  const W = chains.length;
  // First away from the hook (the reverse of yarn order), then back along the other side.
  const working = new Map<string, number>();
  [...chains].reverse().forEach((id, w) => working.set(`stitch:${id}`, w));
  chains.forEach((id, k) => working.set(`underside:${id}`, W + k));
  const chainAt = (w: number) => (w < W ? chains[W - 1 - w]! : chains[w - W]!);

  const used = new Map<number, NodeId[]>();
  let previous: { readonly node: NodeId; readonly w: number } | null = null;
  let invalid = false;
  for (const id of layer.stitches) {
    if (layer.turningChain.includes(id) || id === layer.joinSlip) continue;
    const node = graph.nodes.get(id)!;
    const def = graph.defs.get(id)!;
    if (node.anchors.length !== (def.kind === 'chain' ? 0 : def.consumes)) report('anchor-count', [id]);
    node.anchors.forEach((anchor, anchorIndex) => {
      if (invalidAnchors.has(anchorRef(id, anchorIndex))) {
        invalid = true;
        return;
      }
      const w = working.get(anchorKey(anchor));
      if (w === undefined) {
        report('anchor-layer', [id]);
        invalid = true;
        return;
      }
      if (previous !== null && w < previous.w) report('against-direction', [previous.node, id]);
      used.set(w, [...(used.get(w) ?? []), id]);
      previous = { node: id, w };
    });
  }

  checkCountsAndChains(graph, index, report);
  if (invalid) return;
  for (let w = 0; w < 2 * W; w += 1) {
    const worked = used.get(w) ?? [];
    if (worked.length === 0) {
      // The far chain (first in yarn order) may have its other side left out.
      if (w !== W) report('unused-position', [chainAt(w)]);
      continue;
    }
    const groups = new Set(worked.map((node) => graph.groupOf.get(node)));
    if (worked.length > 1 && (groups.size !== 1 || groups.has(undefined))) report('unmarked-increase', worked);
  }
}
