// A round's circumference is its position count: a chain adds width even where it does not
// count as a stitch (the arches of a granny square's last round).
// KB: 04 §0, 04 §2, 04 §3.2, 04 §6.1, 04 §8, 04 §9.0, 04 §9.6
// KB: core-geometry §34

import { stitchDimensions, type GaugeContext } from './gauge.ts';
import type { LayerInfo, PieceGraph } from './graph.ts';
import { isPostMode } from './insertion.ts';
import { gaugeContextOf } from './pattern-size.ts';
import type { RuleId } from './rules.ts';
import type { StitchLibrary } from './stitch-library.ts';
import type { NodeId, Pattern, PatternConventions, StitchDef, StitchDefId, ValueSource } from './types.ts';

// KB: 01 §2.3, 04 §1.2, 04 §9.0 — the library's row height ratio over-increases in the round.
export const ROUND_ASPECT: Readonly<Record<StitchDefId, number>> = { sc: 1, hdc: 1.35, dc: 2, tr: 2.5, dtr: 3 };

// KB: 04 §8
export const CUPPING_RATIO = 0.85;
export const RUFFLING_RATIO = 1.3;

// KB: 04 §9.6
export const STACK_LIMIT = 3;

// KB: core-geometry §39
export function roundEndFor(setting: PatternConventions['roundEnd'], amigurumi: boolean): 'join-slip' | 'spiral' {
  if (setting !== 'stitch-default') return setting;
  return amigurumi ? 'spiral' : 'join-slip';
}

export interface FlatIncreases {
  readonly exact: number;
  readonly count: number;
  readonly aspect: number;
  readonly from: StitchDefId | null;
  readonly source: ValueSource;
}

export function baseStitchOf(def: StitchDef): StitchDefId {
  if (def.kind === 'joined') return def.part;
  if (def.kind === 'group') return def.members.find((member) => member !== 'ch') ?? def.id;
  return def.id;
}

// KB: 04 §1.2
export function niceIncreases(exact: number): number {
  return Math.max(4, 2 * Math.round(exact / 2));
}

export function flatIncreases(def: StitchDef, context: GaugeContext, corners?: number): FlatIncreases {
  const id = baseStitchOf(def);
  const nominal = ROUND_ASPECT[id] ?? context.library.get(id)?.heightFactor.value ?? 1;
  let aspect = nominal;
  let from: StitchDefId | null = null;
  let source: ValueSource = 'estimated';

  const own = measuredAspect(id, context);
  if (own) {
    ({ aspect, source } = own);
    from = id;
  } else {
    for (const other of Object.keys(ROUND_ASPECT)) {
      const found = measuredAspect(other, context);
      if (!found) continue;
      aspect = (found.aspect * nominal) / ROUND_ASPECT[other]!;
      from = other;
      source = found.source;
      break;
    }
  }
  const factor = corners !== undefined && corners >= 3 ? 2 * corners * Math.tan(Math.PI / corners) : 2 * Math.PI;
  const exact = factor * aspect;
  return { exact, count: niceIncreases(exact), aspect, from, source };
}

function measuredAspect(id: StitchDefId, context: GaugeContext): { aspect: number; source: ValueSource } | null {
  const def = context.library.get(id);
  const size = def ? stitchDimensions(def, 'round', context) : null;
  if (!size || size.basis !== 'measured' || size.widthMm.value <= 0) return null;
  const source: ValueSource = size.widthMm.source === 'label' || size.heightMm.source === 'label' ? 'label' : 'measured';
  return { aspect: size.heightMm.value / size.widthMm.value, source };
}

export interface RoundFinding {
  readonly rule: RuleId;
  readonly nodes: readonly NodeId[];
}

export function roundFindings(pattern: Pattern, graph: PieceGraph, library: StitchLibrary): RoundFinding[] {
  const findings: RoundFinding[] = [];
  for (const event of graph.piece.events) {
    if (event.kind === 'spiral' && event.colorChange && !event.jogFix) findings.push({ rule: 'spiral-color-jog', nodes: [event.after] });
  }
  const { layers } = graph;
  if (layers[0]?.shape !== 'round') return findings;

  const complete = (index: number) => index >= 1 && layers[index]?.shape === 'round' && layers[index]!.closing !== null;
  const corners = graph.piece.corners;
  const context = gaugeContextOf(pattern, library);
  const ratios: (number | undefined)[] = [];

  for (let index = 2; index < layers.length; index += 1) {
    if (!complete(index) || !complete(index - 1)) continue;
    const layer = layers[index]!;
    // KB: core-geometry §36
    const previous = layer.basePositions?.length ?? layers[index - 1]!.positionCount;
    const count = layer.positionCount;
    if (previous > 0 && (count > 2 * previous || 2 * count < previous)) findings.push({ rule: 'round-growth', nodes: worked(graph, layer) });
    const def = tallest(graph, layer, library);
    // KB: core-geometry §35
    const ribbed = layer.stitches.some((id) =>
      graph.nodes.get(id)!.anchors.some((anchor) => anchor.into === 'stitch' && isPostMode(anchor.mode)),
    );
    if (def && !ribbed) ratios[index] = (count - previous) / flatIncreases(def, context, corners).exact;
  }

  // KB: core-geometry §35
  const solid = (graph.piece.sections?.length ?? 0) > 0 || pattern.garment?.kind === 'hat' || pattern.garment?.kind === 'raglan';
  for (const run of solid ? [] : runs(ratios, (ratio) => ratio < CUPPING_RATIO, 2)) {
    findings.push({ rule: 'round-cupping', nodes: run.flatMap((index) => worked(graph, layers[index]!)) });
  }
  for (const run of runs(ratios, (ratio) => ratio > RUFFLING_RATIO, 1)) {
    findings.push({ rule: 'round-ruffling', nodes: run.flatMap((index) => worked(graph, layers[index]!)) });
  }
  if (corners === undefined) findings.push(...stackedIncreases(graph, complete));
  return findings;
}

function worked(graph: PieceGraph, layer: LayerInfo): NodeId[] {
  return layer.stitches.filter(
    (id) => graph.defs.get(id)!.kind !== 'chain' && id !== layer.joinSlip && !layer.travelSlips.includes(id),
  );
}

function tallest(graph: PieceGraph, layer: LayerInfo, library: StitchLibrary): StitchDef | undefined {
  let best: StitchDef | undefined;
  for (const id of worked(graph, layer)) {
    const def = graph.defs.get(id)!;
    if (def.kind !== 'basic' && def.kind !== 'joined' && def.kind !== 'group') continue;
    const base = library.get(baseStitchOf(def));
    if (base && (!best || base.chainHeight > best.chainHeight)) best = base;
  }
  return best;
}

function runs(values: readonly (number | undefined)[], test: (value: number) => boolean, min: number): number[][] {
  const result: number[][] = [];
  let current: number[] = [];
  const flush = () => {
    if (current.length >= min) result.push(current);
    current = [];
  };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value !== undefined && test(value)) current.push(index);
    else flush();
  }
  flush();
  return result;
}

interface Increase {
  readonly anchor: NodeId;
  readonly members: readonly NodeId[];
}

// KB: 01 §8.3, 03 §1.1 — a counting turning chain forms an increase with the stitch beside it.
function increasesOf(graph: PieceGraph, layer: LayerInfo, below: LayerInfo): Increase[] {
  const inLayer = new Set(layer.stitches);
  const byAnchor = new Map<NodeId, NodeId[]>();
  const grouped = new Set<NodeId>();
  for (const group of graph.piece.groups) {
    const def = graph.defs.get(group.members[0]!);
    if (!def || !inLayer.has(group.members[0]!)) continue;
    const nodes = group.members.map((id) => graph.nodes.get(id)!);
    const anchor = nodes[0]!.anchors[0];
    const same = nodes.every((node) => node.def === nodes[0]!.def && node.anchors.length === 1);
    if (!same || anchor?.into !== 'stitch' || group.members.length < 2) continue;
    byAnchor.set(anchor.id, [...group.members]);
    for (const id of group.members) grouped.add(id);
  }
  const first = below.positions[0];
  const top = layer.turningChain[layer.turningChain.length - 1];
  if (layer.turningChainCounts && first !== undefined && top !== undefined) {
    const extra = worked(graph, layer).filter((id) => {
      const anchor = graph.nodes.get(id)!.anchors[0];
      return !grouped.has(id) && anchor?.into === 'stitch' && anchor.id === first;
    });
    const group = byAnchor.get(first);
    if (group) byAnchor.set(first, [top, ...group]);
    else if (extra.length > 0) byAnchor.set(first, [top, ...extra]);
  }
  return [...byAnchor].map(([anchor, members]) => ({ anchor, members }));
}

// KB: 04 §3.2
// KB: core-geometry §49
function stackedIncreases(graph: PieceGraph, complete: (index: number) => boolean): RoundFinding[] {
  const findings: RoundFinding[] = [];
  let previous = new Map<NodeId, number>();
  let previousAll = false;
  let inRun = false;
  for (let index = 1; index < graph.layers.length; index += 1) {
    const layer = graph.layers[index]!;
    if (!complete(index)) {
      previous = new Map();
      previousAll = false;
      inRun = false;
      continue;
    }
    // KB: core-geometry §49
    if (index === 1 && graph.layers[0]!.undersides.length > 0) {
      previous = new Map();
      previousAll = false;
      continue;
    }
    const depths = new Map<NodeId, number>();
    const deep: NodeId[] = [];
    for (const increase of increasesOf(graph, layer, graph.layers[index - 1]!)) {
      const parent = previousAll ? undefined : previous.get(increase.anchor);
      const depth = parent === undefined ? 1 : parent + 1;
      for (const id of increase.members) depths.set(id, depth);
      if (depth >= STACK_LIMIT) deep.push(...increase.members.filter((id) => graph.defs.get(id)!.kind !== 'chain'));
    }
    if (deep.length > 0 && !inRun) findings.push({ rule: 'stacked-increases', nodes: deep });
    inRun = deep.length > 0;
    previousAll = layer.positions.length > 0 && layer.positions.every((id) => depths.has(id));
    previous = depths;
  }
  return findings;
}
