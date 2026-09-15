/*
 * A szemgráf ellenőrzője.
 *
 * Minden találat egy `RULES`-beli szabályhoz tartozik, onnan kapja a
 * súlyosságot és a tudásbázis-hivatkozást (src/core/rules.ts).
 *
 * Sorrend és elnyomás, hogy egy hibára egy találat jöjjön:
 * 1. Szerkezet (ismeretlen szem, nem létező hivatkozás, fonal útja). Ha ez
 *    hibás, a darab rétegei nem számolhatók, a többi ellenőrzés nem fut.
 * 2. Célpontok. Ha egy réteg valamelyik célpontja érvénytelen (később készülő,
 *    rossz sorba mutató, nem számító fordulóláncba horgolt), annál a
 *    rétegnél a sorrendre, az ugrásra, a felhasználásra és az ismétlésre
 *    épülő szabályok nem futnak: azok csak ennek a hibának a következményei
 *    lennének.
 * 3. Rétegenként a felhasználás, a sorrend, a láncalap, a számok; végül a
 *    magasság figyelmeztetései.
 */

import { buildPieceGraph, type LayerInfo, type PieceGraph } from './graph.ts';
import { modeAsWorked } from './insertion.ts';
import { roundFindings } from './rounds.ts';
import { RULES, type RuleId } from './rules.ts';
import type { StitchLibrary } from './stitch-library.ts';
import { hasBaseChain, traditionOf } from './tradition.ts';
import type { Anchor, Finding, NodeId, Pattern, Piece, PieceId, StitchNode } from './types.ts';

export function validatePattern(pattern: Pattern, library: StitchLibrary): Finding[] {
  return pattern.pieces.flatMap((piece) => validatePiece(pattern, piece, library));
}

type Report = (rule: RuleId, nodes: readonly NodeId[]) => void;

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
  for (let index = 1; index < graph.layers.length; index += 1) {
    checkLayer(pattern, graph, index, invalidAnchors, report, () => findings.length);
  }
  checkHeights(graph, invalidAnchors, report);
  // Körök: növekedés, kunkorodás, fodrosodás, egymás fölé kerülő szaporítás, spirál lépcsője (PQW-861).
  for (const finding of roundFindings(pattern, graph, library)) report(finding.rule, finding.nodes);
  return findings;
}

const anchorKey = (anchor: Anchor) => `${anchor.into}:${anchor.id}`;
const anchorRef = (node: NodeId, index: number) => `${node}#${index}`;

/* ---- 1. Szerkezet ---- */

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
        anchor.into === 'stitch' ? nodeIds.has(anchor.id) : anchor.into === 'space' ? spaceIds.has(anchor.id) : ringIds.has(anchor.id);
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

/* ---- 2. Csoportok és célpontok ---- */

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

/** A később készülő célpontok (06 V1). Visszaadja az érvénytelen célpontokat `csomópont#index` alakban. */
/**
 * A beszúrási mód a szem megengedett módjai közül való-e (PQW-869). A lista a
 * horgoló felől érti a módot, a gráf a színoldalit tárolja, ezért visszai soron
 * megfordítva vetjük össze. Összetett szemnél a csoport listája is számít.
 */
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
      if (anchor.into === 'stitch') target = graph.order.get(anchor.id)!;
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

/* ---- 3. Rétegenként ---- */

interface Entry {
  readonly node: StitchNode;
  readonly anchor: Anchor;
  /** A célpont a haladási irányban számozva (0 = az első pozíció, amelyet a réteg elér). */
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
  const below = graph.layers[index - 1]!;
  const layer = graph.layers[index]!;
  const length = below.positions.length;
  const positionIndex = new Map(below.positions.map((id, i) => [id, i]));
  const toWorking = (i: number) => (layer.direction === 1 ? i : length - 1 - i);
  const belowTurning = new Set(below.turningChain);
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

      if (anchor.into === 'stitch' && belowTurning.has(anchor.id) && anchor.id !== turningTop) {
        report('turning-chain-placement', [id, anchor.id]);
        layerInvalid = true;
        return;
      }
      if (targetLayer < index - 1 && node.flags?.includes('spike') && !workedBetween(graph, targets, targetLayer, index)) {
        return; // Hosszú szem: nem az előző sor pozícióját használja fel.
      }
      const indices = targets.map((target) => positionIndex.get(target));
      if (targetLayer !== index - 1 || indices.some((i) => i === undefined)) {
        report('anchor-layer', [id]);
        layerInvalid = true;
        return;
      }
      if (anchor.into === 'stitch' && !graph.defs.get(anchor.id)!.workableTop) report('unworkable-top', [id]);
      const working = (indices as number[]).map(toWorking);
      entries.push({ node, anchor, min: Math.min(...working), max: Math.max(...working) });
    });
  }

  // Több szem egy szemben: csak jelölt csoportként (03 §10 C14). Láncívbe és gyűrűbe bármennyi mehet (01 §8.2 szabály 11).
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
  // Ha a sor fordulólánca számít, az alatta lévő szem (a sor első pozíciója) kimaradhat (03 §1.3). Japán
  // hagyományban az 1. sorban is: ott a fordulólánc alatti alapláncszem (01 §8.3 szabály 15).
  const baseChain = index === 1 && below.shape === 'row' && hasBaseChain(layer.turningChainCounts, traditionOf(pattern.conventions));
  const optional = (index >= 2 || baseChain) && layer.turningChainCounts ? 0 : -1;
  const positionAt = (w: number) => below.positions[layer.direction === 1 ? w : length - 1 - w]!;
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
    // A számító fordulólánc a sor elején a legyező része (pl. kagyló fele: 3 lsz + 2 erp).
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

  // Az ugrásokat a bejárás után nézzük: egy keresztezett vagy visszafelé horgolt szem kitöltheti a rést.
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

  // Számító fordulólánc: a következő sor utolsó szeme a tetejébe megy (03 §10 A4).
  const topWorking = turningTop !== undefined && layer.direction === -1 && below.shape === 'row' ? length - 1 : -1;
  if (topWorking >= 0 && !covered[topWorking]) report('turning-chain-placement', [previous!.node.id, turningTop!]);

  // Felhasználatlan pozíciók a sor két szélén; a sor belsejét az ugrás szabálya nézi (03 §10 B8, C15).
  const first = entries[0]!.min;
  for (let w = 0; w < length; w += 1) {
    if (covered[w] || (w > first && w < frontier) || w === optional || w === topWorking) continue;
    if (!skipped.has(positionAt(w))) report('unused-position', [positionAt(w)]);
  }

  const repeat = pattern.conventions.repeat;
  if (repeat && layer.shape === 'row' && findingCount() === walkStart) {
    // A japán alapláncszem már a láncalap pozíciója, ezért ott nem adódik hozzá.
    const consumed = length + (index === 1 && layer.turningChainCounts && !baseChain ? 1 : 0);
    if (consumed !== layer.positionCount) report('repeat-balance', layer.stitches);
  }
}

/** Van-e a hosszú szem célpontja és a mostani sor között olyan sor, amely a célpontba horgolt (03 §10 C17). */
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

  if (layer.closing?.statedCount !== undefined && layer.closing.statedCount !== layer.stitchCount) {
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
    // A láncgyűrűbe és a láncszembe horgolt 1. kör kör, nem láncalapra horgolt sor: ott a kezdőlánc magasságát nézzük.
    const onChain = index === 1 && below.shape === 'row' && below.stitches.length > 0 && kind(below.stitches[0]!) === 'chain';
    if (onChain) {
      if (layer.turningChain.length !== expected) report('foundation-chain', [...layer.turningChain, firstStitch]);
    } else {
      const startsWithChain =
        layer.opening?.kind === 'turn' || layer.opening?.kind === 'join-slip' || (index === 1 && below.shape === 'round');
      if (startsWithChain && layer.turningChain.length !== expected) {
        report('turning-chain-height', layer.turningChain.length > 0 ? layer.turningChain : [firstStitch]);
      }
    }
  }

  // Lógó lánc: a réteg végén álló láncszemek, amelyekbe semmi nem horgol (03 §10 C18).
  const trailing: NodeId[] = [];
  for (let i = layer.stitches.length - 1; i >= 0; i -= 1) {
    const id = layer.stitches[i]!;
    if (kind(id) !== 'chain' || layer.turningChain.includes(id)) break;
    trailing.unshift(id);
  }
  if (trailing.length > 0 && !trailing.some((id) => isWorkedInto(graph, id))) report('floating-chain', trailing);
}

function isWorkedInto(graph: PieceGraph, chain: NodeId): boolean {
  const space = graph.spaceOfChain.get(chain);
  return graph.piece.stitches.some((node) =>
    node.anchors.some((anchor) => (anchor.into === 'stitch' ? anchor.id === chain : anchor.into === 'space' && anchor.id === space?.id)),
  );
}

/* ---- 4. Magasság ---- */

/**
 * Halmozott magasság láncszem-egységben (01 §8.1 szabály 1): a szem
 * magassága és annak a célpontnak a halmozott magassága, amelybe horgolták.
 * Ha egy sor szemei különböző magasak, a következő 1–3 sornak ki kell
 * egyenlítenie, vagyis egy sorban minden szemnek azonos halmozott
 * magasságra kell érnie (03 §10 D19, 03 §2.3).
 */
function checkHeights(graph: PieceGraph, invalidAnchors: ReadonlySet<string>, report: Report): void {
  const height = new Map<NodeId, number>();
  const counting = (layer: LayerInfo) =>
    layer.stitches.filter((id) => {
      const kind = graph.defs.get(id)!.kind;
      return kind !== 'chain' && kind !== 'picot' && kind !== 'ring' && id !== layer.joinSlip && !layer.travelSlips.includes(id);
    });

  for (const id of graph.layers[0]!.stitches) height.set(id, 0);
  graph.layers.forEach((layer, index) => {
    if (index === 0) return;
    const below = graph.layers[index - 1]!;
    for (const id of counting(layer)) {
      const node = graph.nodes.get(id)!;
      let base = 0;
      node.anchors.forEach((anchor, anchorIndex) => {
        if (invalidAnchors.has(anchorRef(id, anchorIndex))) return;
        const targets = anchor.into === 'stitch' ? [anchor.id] : anchor.into === 'space' ? graph.spaces.get(anchor.id)!.chains : [];
        for (const target of targets) base = Math.max(base, height.get(target) ?? 0);
      });
      height.set(id, base + graph.defs.get(id)!.chainHeight);
    }
    if (layer.turningChainCounts) {
      const basePosition = index === 1 ? undefined : below.positions[layer.direction === 1 ? 0 : below.positions.length - 1];
      const top = (basePosition === undefined ? 0 : (height.get(basePosition) ?? 0)) + layer.turningChain.length;
      for (const id of layer.turningChain) height.set(id, top);
    }
    const rowTop = Math.max(0, ...counting(layer).map((id) => height.get(id)!));
    for (const id of layer.stitches) if (!height.has(id)) height.set(id, rowTop);
  });

  const levels = (layer: LayerInfo, values: (id: NodeId) => number) => {
    const set = new Set(counting(layer).map(values));
    if (layer.turningChainCounts) set.add(values(layer.turningChain[layer.turningChain.length - 1]!));
    return set;
  };
  const own = (id: NodeId) =>
    graph.layers[graph.layerOf.get(id)!]!.turningChain.includes(id)
      ? graph.layers[graph.layerOf.get(id)!]!.turningChain.length
      : graph.defs.get(id)!.chainHeight;

  graph.layers.forEach((layer, index) => {
    if (index === 0 || layer.shape !== 'row' || levels(layer, own).size < 2) return;
    for (let later = index; later <= index + 3 && later < graph.layers.length; later += 1) {
      const candidate = graph.layers[later]!;
      if (candidate.shape !== 'row') break;
      if (levels(candidate, (id) => height.get(id)!).size === 1) return;
    }
    report('mixed-heights', counting(layer));
  });
}
