// KB: 01 §6.1, 01 §6.3, 01 §8.4, 03 §2.1, 03 §4.4

import { buildPieceGraph, chainBridges, type LayerInfo, type PieceGraph } from './graph.ts';
import {
  CIRCLE,
  frameCoords,
  frameFor,
  frameNormal,
  framePoint,
  frameSide,
  type Point,
  perimeter,
  type RoundFrame,
} from './polygon.ts';
import { curveLayout, rowCurve } from './row-curve.ts';
import type { StitchLibrary } from './stitch-library.ts';
import type { Anchor, NodeId, Pattern, RoundShape, StitchDef, StitchDefId } from './types.ts';
import { validatePattern } from './validate.ts';

export type { Point, RoundFrame } from './polygon.ts';

export type NodeRole = 'stitch' | 'chain' | 'slip' | 'picot' | 'ring';

export interface NodePlacement {
  readonly id: NodeId;
  readonly def: StitchDefId;
  readonly layer: number;
  readonly side: 'right' | 'wrong';
  readonly role: NodeRole;
  // One foot per anchor, in anchor order; empty for roles without a stem.
  readonly feet: readonly Point[];
  // The top for stemmed nodes, the centre otherwise; anchors point here.
  readonly top: Point;
  // Radians, 0 = horizontal: the row axis at the node, not the (slanted) stem.
  // KB: core-geometry §10
  readonly angle: number;
  readonly size: number;
}

export interface LayerPlacement {
  readonly index: number;
  readonly shape: LayerInfo['shape'];
  readonly side: LayerInfo['side'];
  readonly stitchCount: number;
  // The count printed on the chart, which can differ from stitchCount.
  readonly writtenCount: number;
  // Where the row number is drawn, on the starting side of the row.
  readonly start: Point;
  // Where the stitch count is drawn, at the end of the row.
  readonly end: Point;
}

export interface ChartLayout {
  readonly nodes: ReadonlyMap<NodeId, NodePlacement>;
  // Layer 0 is the foundation chain or the magic ring.
  readonly layers: readonly LayerPlacement[];
  readonly bounds: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number };
  readonly frame?: RoundFrame;
}

export interface LayoutOptions {
  readonly mirror?: boolean;
  readonly columnWidth?: number;
  readonly stemLength?: (chainHeight: number) => number;
  // Lay the rows out straight, ignoring the piece's row shape.
  readonly straight?: boolean;
}

export const DEFAULT_COLUMN = 24;
const defaultStem = (chainHeight: number) => 10 + 8 * chainHeight;
export const ROW_GAP = 6;
const CHAIN_HEIGHT = 12;
const SLIP_HEIGHT = 6;
const TAU = 2 * Math.PI;

const EMPTY: ChartLayout = { nodes: new Map(), layers: [], bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 } };

// KB: core-geometry §12
const DETACHED_RULES = new Set(['future-anchor', 'anchor-layer', 'against-direction', 'turning-chain-placement']);

function detachedNodes(pattern: Pattern, library: StitchLibrary): Set<NodeId> {
  const set = new Set<NodeId>();
  for (const finding of validatePattern(pattern, library)) {
    if (!DETACHED_RULES.has(finding.rule)) continue;
    const nodes = finding.rule === 'against-direction' ? finding.nodes.slice(-1) : finding.nodes.slice(0, 1);
    for (const id of nodes) set.add(id);
  }
  return set;
}

export function layoutPattern(pattern: Pattern, library: StitchLibrary, options: LayoutOptions = {}): ChartLayout {
  const piece = pattern.pieces[0];
  if (!piece || piece.stitches.length === 0) return EMPTY;
  let graph: PieceGraph;
  try {
    graph = buildPieceGraph(pattern, piece, library);
  } catch {
    return EMPTY;
  }
  const W = options.columnWidth ?? DEFAULT_COLUMN;
  const stem = options.stemLength ?? defaultStem;
  const raw = new Layouter(graph, W, stem, detachedNodes(pattern, library)).run();
  const chart = finish(graph, raw, options.mirror ?? false, W);
  // KB: core-geometry §11
  const shape = piece.rowShape;
  if (!shape || options.straight || graph.layers[0]!.shape !== 'row') return chart;
  const curve = rowCurve(finish(graph, raw, options.mirror ?? false, W, false), shape);
  return curve ? curveLayout(chart, curve, W) : chart;
}

interface Item {
  readonly ids: readonly NodeId[];
  // KB: core-geometry §14
  half: number;
  readonly weight: number;
  desired: number | undefined;
}

// KB: core-geometry §14
interface Arc {
  readonly ids: readonly NodeId[];
  // The chord ends on the travel axis: the inner edges of the two anchored stitches.
  readonly start: number;
  readonly end: number;
  readonly rise: number;
  readonly size: number;
}

// KB: core-geometry §10
export function stitchWidths(graph: PieceGraph, W: number): Map<NodeId, number> {
  const widths = new Map<NodeId, number>();
  for (let index = graph.layers.length - 1; index >= 0; index -= 1) {
    for (const id of graph.layers[index]!.stitches) {
      const own = Math.max(W, widths.get(id) ?? 0);
      widths.set(id, own);
      const node = graph.nodes.get(id);
      if (!node) continue;
      const targets: NodeId[] = [];
      for (const anchor of node.anchors) {
        if (anchor.into === 'stitch' || anchor.into === 'underside') targets.push(anchor.id);
        else if (anchor.into === 'space') targets.push(...(graph.spaces.get(anchor.id)?.chains ?? []));
      }
      if (targets.length === 0) continue;
      const share = W / targets.length;
      for (const target of targets) widths.set(target, (widths.get(target) ?? 0) + share);
    }
    if (graph.layers[index]!.shape !== 'row') continue;
    for (const bridge of chainBridges(graph, index)) {
      const extra = bridge.chains.reduce((sum, id) => sum + Math.max(0, (widths.get(id) ?? W) - W), 0);
      if (bridge.bridged.length === 0 || extra <= 0) continue;
      const each = W + extra / bridge.bridged.length;
      for (const id of bridge.bridged) widths.set(id, Math.max(widths.get(id) ?? 0, each));
    }
  }
  return widths;
}

// KB: core-geometry §9
export function isotonic(values: readonly number[], weights: readonly number[]): number[] {
  const blocks: { sum: number; weight: number; count: number }[] = [];
  values.forEach((value, i) => {
    const weight = Math.max(weights[i] ?? 1, 1e-6);
    blocks.push({ sum: value * weight, weight, count: 1 });
    while (blocks.length > 1) {
      const b = blocks[blocks.length - 1]!;
      const a = blocks[blocks.length - 2]!;
      if (a.sum / a.weight <= b.sum / b.weight) break;
      blocks.splice(-2, 2, { sum: a.sum + b.sum, weight: a.weight + b.weight, count: a.count + b.count });
    }
  });
  return blocks.flatMap((block) => Array<number>(block.count).fill(block.sum / block.weight));
}

// KB: core-geometry §9
export function spread(items: readonly Item[]): number[] {
  const offsets: number[] = [];
  items.forEach((item, i) => offsets.push(i === 0 ? 0 : offsets[i - 1]! + items[i - 1]!.half + item.half));
  const known = items.map((item, i) => (item.desired === undefined ? undefined : item.desired - offsets[i]!));
  const z = known.map((value, i) => {
    if (value !== undefined) return value;
    let left = i - 1;
    while (left >= 0 && known[left] === undefined) left -= 1;
    let right = i + 1;
    while (right < known.length && known[right] === undefined) right += 1;
    const l = left >= 0 ? known[left] : undefined;
    const r = right < known.length ? known[right] : undefined;
    if (l !== undefined && r !== undefined) return l + ((r - l) * (i - left)) / (right - left);
    return l ?? r ?? 0;
  });
  return isotonic(
    z,
    items.map((item) => item.weight),
  ).map((value, i) => value + offsets[i]!);
}

interface Raw {
  nodes: Map<NodeId, NodePlacement>;
  layers: LayerPlacement[];
  frame: RoundFrame;
}

// The row-axis angle in rounds, derived from the outward normal's angle.
// `polar` negates the sine for the canvas y-axis, so outward is (cos, -sin)
// and the along-row tangent is (-sin, -cos). This is NOT the outward angle.
function alongRow(normal: number): number {
  return Math.atan2(-Math.cos(normal), -Math.sin(normal));
}

// KB: core-geometry §18
interface CornerRef {
  readonly space: boolean;
  readonly id: string;
}

class Layouter {
  readonly #graph: PieceGraph;
  readonly #W: number;
  readonly #stem: (chainHeight: number) => number;
  readonly #round: boolean;
  #roundShape: RoundShape | undefined;

  // KB: core-geometry §19
  #cone(index: number): boolean {
    return this.#round && this.#roundShape?.kind === 'cone' && index >= 2 && index <= this.#roundShape.throughRound;
  }
  readonly #oval: boolean;
  readonly #frame: RoundFrame;
  // Corners per layer in yarn order; null when they cannot be traced.
  readonly #corners: (readonly CornerRef[] | null)[] = [];
  // KB: core-geometry §18
  #cornerAxes: number[] | null = null;
  readonly #detached: ReadonlySet<NodeId>;
  readonly #nodes = new Map<NodeId, NodePlacement>();
  readonly #layers: LayerPlacement[] = [];
  // x in rows, the perimeter parameter (an angle in a circle) in rounds.
  readonly #axis = new Map<NodeId, number>();
  // Baseline per layer: y in rows, radius in rounds.
  readonly #base: number[] = [];
  // KB: core-geometry §10
  readonly #widths: ReadonlyMap<NodeId, number>;

  constructor(
    graph: PieceGraph,
    W: number,
    stem: (chainHeight: number) => number,
    detached: ReadonlySet<NodeId> = new Set(),
  ) {
    this.#graph = graph;
    this.#W = W;
    // KB: core-geometry §11
    this.#widths = graph.piece.rowShape ? new Map() : stitchWidths(graph, W);
    this.#stem = stem;
    this.#detached = detached;
    this.#round = graph.layers[0]!.shape === 'round';
    this.#roundShape = graph.piece.roundShape;
    this.#oval = this.#round && graph.layers[0]!.undersides.length > 0;
    // KB: core-geometry §19
    this.#frame = this.#round && graph.piece.roundShape?.kind !== 'cone' ? frameFor(graph.piece.corners) : CIRCLE;
  }

  run(): Raw {
    const [foundation, ...rest] = this.#graph.layers;
    this.#foundation(foundation!);
    let direction = 1;
    for (const layer of rest) {
      if (!this.#round && (layer.index === 1 || layer.opening?.kind === 'turn')) direction = -direction;
      this.#layer(layer, this.#round ? 1 : direction);
    }
    return { nodes: this.#nodes, layers: this.#layers, frame: this.#frame };
  }

  #def(id: NodeId): StitchDef {
    return this.#graph.defs.get(id)!;
  }

  #height(id: NodeId): number {
    const def = this.#def(id);
    switch (def.kind) {
      case 'chain':
        return CHAIN_HEIGHT;
      case 'slip':
        return SLIP_HEIGHT;
      case 'picot':
      case 'ring':
      case 'space':
        return 0;
      default:
        return this.#stem(def.chainHeight);
    }
  }

  // Rows: (x, y). Rounds: (inner radius, perimeter parameter), growing
  // counterclockwise; in a flat circle that is radius and angle.
  #point(base: number, axis: number): Point {
    return this.#round ? framePoint(this.#frame, base, axis) : { x: axis, y: base };
  }

  #foundation(layer: LayerInfo): void {
    const side = layer.side;
    const chains = layer.stitches.filter((id) => this.#def(id).kind === 'chain');
    if (this.#round && chains.length > 0 && this.#oval) {
      // KB: core-geometry §19
      const n = layer.stitches.length;
      const half = Math.max(this.#W, (n * this.#W * 0.8) / 2);
      layer.stitches.forEach((id, k) => {
        const axis = (Math.PI * (n - k)) / n;
        this.#axis.set(id, axis);
        this.#place(
          id,
          0,
          side,
          'chain',
          [],
          { x: half * Math.cos(axis), y: 0 },
          0,
          Math.min(this.#W * 0.8, ((2 * half) / n) * 0.9),
        );
      });
      this.#base[0] = half + 8;
    } else if (this.#round && chains.length > 0) {
      // KB: core-geometry §19
      const radius = chains.length === 1 ? 0 : Math.max(6, (chains.length * this.#W * 0.6) / (2 * Math.PI));
      layer.stitches.forEach((id, i) => {
        const axis = Math.PI / 2 + (2 * Math.PI * i) / layer.stitches.length;
        this.#axis.set(id, axis);
        const along = Math.atan2(-Math.cos(axis), -Math.sin(axis));
        // The chain ring stays round even in a polygon.
        this.#place(id, 0, side, 'chain', [], framePoint(CIRCLE, radius, axis), along, this.#W * 0.6);
      });
      this.#base[0] = radius + 8;
    } else if (this.#round) {
      for (const id of layer.stitches) {
        this.#axis.set(id, Math.PI / 2);
        this.#place(id, 0, side, 'ring', [], { x: 0, y: 0 }, 0, 0);
      }
      this.#base[0] = 10;
    } else {
      // KB: core-geometry §17
      let x = 0;
      layer.stitches.forEach((id, i) => {
        const width = this.#widths.get(id);
        const center = width === undefined ? i * this.#W : x + width / 2;
        this.#axis.set(id, center);
        this.#place(id, 0, side, 'chain', [], { x: center, y: 0 }, 0, this.#W * 0.8);
        x += width ?? this.#W;
      });
      this.#base[0] = 0;
    }
    const lastId = layer.stitches.at(-1);
    const last = (lastId === undefined ? undefined : this.#axis.get(lastId)) ?? (layer.stitches.length - 1) * this.#W;
    this.#layers.push({
      index: 0,
      shape: layer.shape,
      side,
      stitchCount: 0,
      // KB: core-geometry §17
      writtenCount: layer.writtenCount,
      start: this.#round ? { x: 0, y: 0 } : { x: -this.#W, y: 0 },
      end: this.#round ? { x: 0, y: 0 } : { x: last + this.#W, y: 0 },
    });
  }

  #anchorAxis(anchor: Anchor): number | undefined {
    if (anchor.into === 'stitch') return this.#axis.get(anchor.id);
    if (anchor.into === 'underside') {
      const axis = this.#axis.get(anchor.id);
      return axis === undefined ? undefined : TAU - axis;
    }
    if (anchor.into === 'ring') return undefined;
    const chains = this.#graph.spaces.get(anchor.id)?.chains ?? [];
    const values = chains.map((id) => this.#axis.get(id)).filter((v): v is number => v !== undefined);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined;
  }

  #layer(layer: LayerInfo, direction: number): void {
    const graph = this.#graph;
    const W = this.#W;
    const below = graph.layers[layer.below]!;
    const turning = new Set(layer.turningChain);

    // KB: core-geometry §15
    const chainSpan = layer.turningChain.length ? this.#stem(layer.turningChain.length) : 0;
    const stitchHeight = Math.max(
      CHAIN_HEIGHT,
      chainSpan,
      ...layer.stitches.filter((id) => !turning.has(id)).map((id) => this.#height(id)),
    );
    // A restarted section builds on the top of the row it names.
    const previousTop = layer.index === 1 ? this.#base[0]! + (this.#round ? 0 : -ROW_GAP) : this.#top(layer.below);
    let base = this.#round ? previousTop + ROW_GAP : previousTop - ROW_GAP;
    this.#base[layer.index] = base;

    // Items in yarn order; the turning chain is one item, a picot rides its host.
    const items: Item[] = [];
    const picots = new Map<NodeId, NodeId>();
    for (const id of layer.stitches) {
      const kind = this.#def(id).kind;
      if (turning.has(id)) {
        if (items.length === 0 || items[0]!.ids[0] !== layer.turningChain[0]) {
          items.unshift({ ids: layer.turningChain, half: W / 2, weight: 1, desired: undefined });
        }
        continue;
      }
      if (kind === 'picot') {
        const host = items[items.length - 1]?.ids.at(-1);
        if (host) picots.set(id, host);
        continue;
      }
      const node = graph.nodes.get(id)!;
      const axes = node.anchors.map((a) => this.#anchorAxis(a)).filter((v): v is number => v !== undefined);
      const anchored = kind !== 'chain' && id !== layer.joinSlip && axes.length > 0;
      const ownHalf = kind === 'chain' ? W * 0.35 : kind === 'slip' ? W * 0.3 : W / 2;
      items.push({
        ids: [id],
        half: Math.max(ownHalf, (this.#widths.get(id) ?? W) / 2),
        weight: anchored ? 1 : 0.01,
        desired: anchored ? axes.reduce((a, b) => a + b, 0) / axes.length : undefined,
      });
    }

    // KB: core-geometry §13
    const skipped = new Set(this.#graph.piece.skipped);
    const arcs: Arc[] = [];
    const structural = new Map<NodeId, readonly NodeId[]>();
    for (const bridge of chainBridges(this.#graph, layer.index)) structural.set(bridge.chains[0]!, bridge.bridged);
    const bridged = below.positions
      .filter((id) => skipped.has(id))
      .map((id) => this.#axis.get(id))
      .filter((value): value is number => value !== undefined)
      .sort((a, b) => direction * (a - b));
    if (bridged.length > 0 || (!this.#round && structural.size > 0)) {
      const loose = (item: Item) =>
        item.desired === undefined && item.ids[0] !== layer.turningChain[0] && this.#def(item.ids[0]!).kind === 'chain';
      let run: Item[] = [];
      let behind: Item | undefined;
      const settle = (ahead: Item | undefined) => {
        if (run.length > 0) {
          const from = behind?.desired;
          const to = ahead?.desired;
          const marks = bridged.filter(
            (at) =>
              (from === undefined || direction * (at - from) > 0) && (to === undefined || direction * (to - at) > 0),
          );
          const gap =
            marks.length > 0 || this.#round
              ? marks
              : (structural.get(run[0]!.ids[0]!) ?? [])
                  .map((id) => this.#axis.get(id))
                  .filter((value): value is number => value !== undefined)
                  .sort((a, b) => direction * (a - b));
          // KB: core-geometry §14
          const space =
            from !== undefined && to !== undefined && behind && ahead
              ? Math.abs(to - from) - behind.half - ahead.half
              : 0;
          if (!this.#round && run.length > gap.length && gap.length > 0 && space > 0) {
            arcs.push(this.#arc(run, from!, direction, space, behind!.half, stitchHeight));
          } else {
            run.forEach((item, i) => {
              if (i < gap.length) item.desired = gap[i]!;
            });
          }
        }
        run = [];
      };
      for (const item of items) {
        if (item.weight === 1) {
          settle(item);
          behind = item;
          continue;
        }
        if (loose(item)) run.push(item);
      }
      settle(undefined);
    }
    const height = stitchHeight + arcs.reduce((most, arc) => Math.max(most, arc.rise), 0);
    const arcOf = new Map<NodeId, Arc>();
    for (const arc of arcs) for (const id of arc.ids) arcOf.set(id, arc);

    // The perimeter at unit inner radius is 2π in a circle, 2n·tan(π/n) in a polygon.
    const around = perimeter(this.#frame, 1);
    const unit = around / TAU;
    const scale = (radius: number) => (this.#round ? 1 / (radius * unit) : 1);
    // KB: core-geometry §19
    if (this.#round && !this.#cone(layer.index)) {
      const width = items.reduce((sum, item) => sum + 2 * item.half, 0);
      base = Math.max(base, width / around - height / 2);
      this.#base[layer.index] = base;
    }
    const k = scale(base + height / 2);
    const scaled: Item[] = items.map((item) => ({
      ...item,
      half: item.half * k,
      desired: item.desired === undefined ? undefined : direction * item.desired,
    }));

    // KB: core-geometry §16
    const stack = scaled.find((item) => item.ids[0] === layer.turningChain[0] && layer.turningChain.length > 0);
    if (stack) {
      const workingFirst = layer.direction === 1 ? below.positions[0] : below.positions[below.positions.length - 1];
      const firstAnchored = scaled.find((item) => item !== stack && item.weight === 1)?.desired;
      const underneath = workingFirst === undefined ? undefined : this.#axis.get(workingFirst);
      if (this.#round && layer.index === 1) stack.desired = this.#oval ? 0 : Math.PI / 2;
      else if (
        layer.turningChainCounts &&
        layer.index >= 2 &&
        underneath !== undefined &&
        firstAnchored !== direction * underneath
      ) {
        stack.desired = direction * underneath;
      } else if (firstAnchored !== undefined) stack.desired = firstAnchored - 2 * stack.half;
      else if (underneath !== undefined)
        stack.desired = direction * underneath - (layer.turningChainCounts ? 0 : 2 * stack.half);
      else stack.desired = 0;
    }
    if (this.#round && scaled.every((item) => item.desired === undefined) && scaled[0]) scaled[0].desired = Math.PI / 2;

    const positions = spread(scaled).map((u) => direction * u);
    scaled.forEach((item, i) => {
      for (const id of item.ids) this.#axis.set(id, positions[i]!);
    });
    if (this.#round && this.#frame.sides >= 3) this.#alignCorners(layer, scaled, positions);

    const side = layer.side;
    const top = this.#round ? base + height : base - height;
    const chainLine = this.#round ? base + stitchHeight : base - stitchHeight;
    const up = (from: number, by: number) => (this.#round ? from + by : from - by);
    for (const item of scaled) {
      const axis = this.#axis.get(item.ids[0]!)!;
      if (item === stack) {
        // KB: core-geometry §15
        const n = item.ids.length;
        const span = chainSpan > 0 ? chainSpan : height;
        const step = n > 1 ? span / (n - 1) : span;
        const stacked = layer.index <= 1 || this.#round;
        const slice = span / n;
        const size = stacked ? Math.min(step * 0.95, W * 0.8) : Math.min(slice * 0.9, W * 0.8);
        item.ids.forEach((id, i) => {
          const offset = stacked ? (i - 0.5) * step : (i + 0.5) * slice;
          const center = this.#point(up(base, offset), axis);
          const normal = frameNormal(this.#frame, axis);
          const along = this.#round ? Math.atan2(-Math.sin(normal), Math.cos(normal)) : Math.PI / 2;
          this.#place(id, layer.index, side, 'chain', [], center, along, size);
        });
        continue;
      }
      const id = item.ids[0]!;
      const def = this.#def(id);
      if (def.kind === 'chain') {
        const arc = arcOf.get(id);
        if (arc) {
          // KB: core-geometry §14
          const width = arc.end - arc.start;
          const u = width === 0 ? 0.5 : Math.min(1, Math.max(0, (axis - arc.start) / width));
          const center = this.#point(up(chainLine, -6 + 4 * arc.rise * u * (1 - u)), axis);
          const slope = width === 0 ? 0 : -(4 * arc.rise * (1 - 2 * u)) / width;
          this.#place(id, layer.index, side, 'chain', [], center, Math.atan(slope), arc.size);
          continue;
        }
        const normal = frameNormal(this.#frame, axis);
        const along = this.#round ? alongRow(normal) : 0;
        this.#place(id, layer.index, side, 'chain', [], this.#point(up(chainLine, -6), axis), along, W * 0.7);
        continue;
      }
      // KB: core-geometry §12
      const feet = this.#detached.has(id)
        ? graph.nodes.get(id)!.anchors.map(() => this.#point(base, axis))
        : graph.nodes.get(id)!.anchors.map((anchor) => this.#foot(anchor, layer.below, base));
      if (def.kind === 'slip') {
        // In rounds a travel or joining slip stitch is drawn where it was worked.
        const center = this.#round && feet[0] ? feet[0] : this.#point(up(base, SLIP_HEIGHT / 2), axis);
        this.#place(id, layer.index, side, 'slip', feet, center, 0, 0);
        continue;
      }
      const along = this.#round ? alongRow(frameNormal(this.#frame, axis)) : 0;
      this.#place(
        id,
        layer.index,
        side,
        'stitch',
        feet,
        this.#point(up(base, this.#stem(def.chainHeight)), axis),
        along,
        0,
      );
    }
    for (const [id, host] of picots) {
      const hostTop = this.#nodes.get(host)!.top;
      const axis = this.#axis.get(host)!;
      this.#axis.set(id, axis);
      const center = this.#round
        ? this.#point(frameCoords(this.#frame, hostTop).r + 8, axis)
        : { x: hostTop.x, y: hostTop.y - 8 };
      this.#place(id, layer.index, side, 'picot', [], center, 0, 0);
    }

    const first = positions[0] ?? 0;
    const last = positions[positions.length - 1] ?? first;
    const margin = W * scale(base + height / 2);
    const middle = up(base, height / 2);
    // KB: core-geometry §18
    const startAxis = this.#round
      ? Math.max(first - direction * margin, frameSide(this.#frame, first)[0])
      : first - direction * margin;
    const shifted = startAxis - (first - direction * margin);
    const endAxis = this.#round
      ? first - direction * (margin + Math.min(2 * margin, Math.PI / 3)) + shifted
      : last + direction * margin;
    this.#layers.push({
      index: layer.index,
      shape: layer.shape,
      side,
      stitchCount: layer.stitchCount,
      writtenCount: layer.writtenCount,
      start: this.#point(middle, startAxis),
      end: this.#point(middle, endAxis),
    });
    this.#tops[layer.index] = top;
  }

  readonly #tops: number[] = [];

  #top(index: number): number {
    return this.#tops[index] ?? this.#base[index] ?? 0;
  }

  // KB: core-geometry §18
  #alignCorners(layer: LayerInfo, items: readonly Item[], positions: number[]): void {
    const refs = this.#cornerRefs(layer);
    this.#corners[layer.index] = refs;
    if (!refs) return;
    const axes = refs.map((ref) =>
      ref.space ? this.#anchorAxis({ into: 'space', id: ref.id }) : this.#axis.get(ref.id),
    );
    if (axes.some((axis) => axis === undefined)) {
      this.#corners[layer.index] = null;
      return;
    }
    const actual = axes as number[];
    const n = this.#frame.sides;
    if (layer.index === 1 || !this.#cornerAxes) {
      const step = TAU / n;
      const first = this.#frame.corner + Math.ceil((actual[0]! - step / 2 - this.#frame.corner) / step) * step;
      this.#cornerAxes = actual.map((_, j) => first + j * step);
    }
    const wanted = this.#cornerAxes;
    this.#spreadSeam(items, positions, refs);
    const knots = [actual[n - 1]! - TAU, ...actual, actual[0]! + TAU];
    const values = [wanted[n - 1]! - TAU, ...wanted, wanted[0]! + TAU];
    if (knots.some((knot, i) => i > 0 && knot <= knots[i - 1]!)) return;
    const map = (u: number): number => {
      if (u <= knots[0]!) return u + values[0]! - knots[0]!;
      for (let i = 1; i < knots.length; i += 1) {
        if (u > knots[i]!) continue;
        const t = (u - knots[i - 1]!) / (knots[i]! - knots[i - 1]!);
        return values[i - 1]! + t * (values[i]! - values[i - 1]!);
      }
      return u + values[values.length - 1]! - knots[knots.length - 1]!;
    };
    items.forEach((item, i) => {
      positions[i] = map(positions[i]!);
      for (const id of item.ids) this.#axis.set(id, positions[i]!);
    });
  }

  // KB: core-geometry §18
  #spreadSeam(items: readonly Item[], positions: number[], refs: readonly CornerRef[]): void {
    const indicesOf = (ref: CornerRef) => {
      const ids = ref.space ? (this.#graph.spaces.get(ref.id)?.chains ?? []) : [ref.id];
      return items.flatMap((item, i) => (item.ids.some((id) => ids.includes(id)) ? [i] : []));
    };
    const tail = indicesOf(refs[refs.length - 1]!);
    const head = indicesOf(refs[0]!);
    if (tail.length === 0 || head.length === 0) return;
    const last = Math.max(...tail);
    const first = Math.min(...head);
    const seam = [
      ...items.flatMap((_, i) => (i > last ? [{ index: i, wrapped: false }] : [])),
      ...items.flatMap((_, i) => (i < first ? [{ index: i, wrapped: true }] : [])),
    ];
    if (seam.length === 0) return;
    const row: Item[] = seam.map(({ index, wrapped }) => ({
      ...items[index]!,
      desired: positions[index]! + (wrapped ? TAU : 0),
    }));
    const from = positions[last]!;
    const to = positions[first]! + TAU;
    const lo = from + items[last]!.half + row[0]!.half;
    const hi = to - items[first]!.half - row[row.length - 1]!.half;
    let placed = spread(row);
    const [a, b] = [placed[0]!, placed[placed.length - 1]!];
    if (hi <= lo) placed = row.map((_, k) => from + ((k + 1) / (row.length + 1)) * (to - from));
    else if (b - a > hi - lo) placed = placed.map((p) => lo + ((p - a) * (hi - lo)) / (b - a));
    else if (a < lo) placed = placed.map((p) => p + lo - a);
    else if (b > hi) placed = placed.map((p) => p - (b - hi));
    seam.forEach(({ index, wrapped }, k) => {
      positions[index] = placed[k]! - (wrapped ? TAU : 0);
    });
  }

  // KB: core-geometry §18
  #cornerRefs(layer: LayerInfo): CornerRef[] | null {
    const graph = this.#graph;
    const n = this.#frame.sides;
    if (layer.index === 1) {
      const spaces: string[] = [];
      for (const id of layer.stitches) {
        const space = graph.spaceOfChain.get(id);
        if (space && !spaces.includes(space.id)) spaces.push(space.id);
      }
      if (spaces.length === n) return spaces.map((id) => ({ space: true, id }));
      const positions = layer.positions;
      if (positions.length === 0 || positions.length % n !== 0) return null;
      const side = positions.length / n;
      return Array.from({ length: n }, (_, j) => ({ space: false, id: positions[(j + 1) * side - 1]! }));
    }
    const previous = this.#corners[layer.index - 1];
    if (!previous) return null;
    const below = graph.layers[layer.index - 1]!;
    const excluded = new Set<NodeId>([
      ...layer.turningChain,
      ...layer.travelSlips,
      ...(layer.joinSlip ? [layer.joinSlip] : []),
    ]);
    const order = (id: NodeId) => graph.order.get(id)!;
    const refs: CornerRef[] = [];
    for (const corner of previous) {
      const children = layer.stitches.filter(
        (id) =>
          !excluded.has(id) &&
          graph.nodes
            .get(id)!
            .anchors.some((anchor) => anchor.into === (corner.space ? 'space' : 'stitch') && anchor.id === corner.id),
      );
      const top = layer.turningChain[layer.turningChain.length - 1];
      if (!corner.space && layer.turningChainCounts && top !== undefined && below.positions[0] === corner.id)
        children.unshift(top);
      if (children.length === 0) return null;
      const from = order(children[0]!);
      const to = order(children[children.length - 1]!);
      const inside: string[] = [];
      for (const id of layer.stitches) {
        const space = graph.spaceOfChain.get(id);
        if (!space || inside.includes(space.id)) continue;
        if (space.chains.every((chain) => order(chain) > from && order(chain) < to)) inside.push(space.id);
      }
      refs.push(
        inside.length > 0
          ? { space: true, id: inside[Math.floor((inside.length - 1) / 2)]! }
          : { space: false, id: children[Math.floor(children.length / 2)]! },
      );
    }
    return refs;
  }

  // The target's column on this layer's baseline — or on that row's top
  // for a stitch worked into an earlier row.
  #foot(anchor: Anchor, below: number, base: number): Point {
    if (anchor.into === 'ring') return { x: 0, y: 0 };
    if (this.#round) {
      // KB: core-geometry §19
      const ids =
        anchor.into === 'stitch' || anchor.into === 'underside'
          ? [anchor.id]
          : (this.#graph.spaces.get(anchor.id)?.chains ?? []);
      const tops = ids.map((id) => this.#nodes.get(id)?.top).filter((p): p is Point => p !== undefined);
      if (tops.length > 0) {
        return {
          x: tops.reduce((sum, p) => sum + p.x, 0) / tops.length,
          y: tops.reduce((sum, p) => sum + p.y, 0) / tops.length,
        };
      }
    }
    const axis = this.#anchorAxis(anchor) ?? 0;
    const target =
      anchor.into === 'stitch' || anchor.into === 'underside'
        ? anchor.id
        : this.#graph.spaces.get(anchor.id)?.chains[0];
    const targetLayer = target === undefined ? below : (this.#graph.layerOf.get(target) ?? below);
    const line = targetLayer >= below ? base : (this.#base[targetLayer + 1] ?? base);
    return this.#point(line, axis);
  }

  // KB: core-geometry §14
  #arc(run: Item[], from: number, direction: number, space: number, before: number, stitchHeight: number): Arc {
    const natural = this.#W * 0.7;
    const n = run.length;
    const slice = space / n;
    const start = from + direction * before;
    run.forEach((item, i) => {
      item.half = Math.min(item.half, slice / 2);
      item.desired = start + direction * (i + 0.5) * slice;
    });
    const missing = n * natural - space;
    const sagitta = missing > 0 ? Math.sqrt((3 * space * missing) / 8) : 0;
    return {
      ids: run.map((item) => item.ids[0]!),
      start,
      end: start + direction * space,
      rise: Math.min(Math.max(sagitta, space * 0.1), stitchHeight / 2, CHAIN_HEIGHT),
      size: Math.min(natural, slice * 0.95),
    };
  }

  #place(
    id: NodeId,
    layer: number,
    side: NodePlacement['side'],
    role: NodeRole,
    feet: readonly Point[],
    top: Point,
    angle: number,
    size: number,
  ): void {
    this.#nodes.set(id, { id, def: this.#graph.nodes.get(id)!.def, layer, side, role, feet, top, angle, size });
  }
}

function finish(graph: PieceGraph, raw: Raw, mirror: boolean, W: number, withPins = true): ChartLayout {
  const offset = (id: NodeId): Point => {
    const pinned = withPins ? graph.nodes.get(id)?.pinned : undefined;
    return pinned ? { x: pinned.x, y: pinned.y } : { x: 0, y: 0 };
  };
  const flip = (p: Point): Point => (mirror ? { x: -p.x, y: p.y } : p);
  const shift = (p: Point, d: Point): Point => flip({ x: p.x + d.x, y: p.y + d.y });

  const nodes = new Map<NodeId, NodePlacement>();
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  const include = (p: Point) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  };

  for (const placement of raw.nodes.values()) {
    const anchors = graph.nodes.get(placement.id)!.anchors;
    const feet = placement.feet.map((foot, i) => {
      const anchor = anchors[i];
      return shift(foot, anchor?.into === 'stitch' ? offset(anchor.id) : { x: 0, y: 0 });
    });
    const top = shift(placement.top, offset(placement.id));
    const angle = mirror ? -placement.angle : placement.angle;
    nodes.set(placement.id, { ...placement, feet, top, angle });
    include(top);
    feet.forEach(include);
  }
  const layers = raw.layers.map((layer) => ({ ...layer, start: flip(layer.start), end: flip(layer.end) }));
  for (const layer of layers.slice(1)) {
    include(layer.start);
    include(layer.end);
  }
  if (nodes.size === 0) return EMPTY;
  const pad = W;
  return {
    nodes,
    layers,
    bounds: { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad },
    ...(raw.frame.sides >= 3 ? { frame: raw.frame } : {}),
  };
}
