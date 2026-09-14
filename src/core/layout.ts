/*
 * A diagram elrendezése a gráfból: hely, irány, legyező, összefutás, sorszám,
 * színe és visszája. Tiszta függvény, böngésző nélkül.
 *
 * Konvenciók (01 §6.1, §6.3, §8.4; 03 §2.1, §4.4):
 * - A jel talpa ott van, ahová horgolták: az alatta lévő öltés oszlopában. A
 *   szaporítás szárai egy talpból legyezőben nyílnak, a fogyasztás szárai egy
 *   tetőbe futnak — ez magától adódik, mert a talp a célpont, a tető a saját
 *   oszlop.
 * - Sorban a jelek függőlegesek, a sorok alulról felfelé, kígyózva haladnak:
 *   jobbkezesnek az 1. sor jobbról balra; a sorszám a sor kezdő oldalán áll.
 * - A sormagasság a sor legmagasabb öltéséből jön; egy sor jelei közös
 *   talpvonalon állnak.
 * - Körben a jelek sugárirányúak, a körök a középből az óramutatóval
 *   ellentétesen haladnak. Ez egyszerű elrendezés; a körnézet finomítása később jön.
 * - Tükrözött nézetben (balkezeseknek) minden vízszintesen tükröződik (01 §8.4 szabály 22).
 *
 * Stabil szerkesztés közben (06 §5.3 2. pont): egy réteg csak az alatta lévő
 * rétegtől és a saját öltéseitől függ, ezért új öltés csak a saját sorát
 * rendezheti át, a korábbi sorokat nem.
 *
 * Egy sor oszlopai: minden öltés oda szeretne kerülni, ahová horgolták, de a
 * fonal sorrendjében, legalább fél-fél szélességnyi távolságra egymástól. Ezt
 * súlyozott monoton regresszió adja (pool adjacent violators): a legyező a
 * célpontja köré, a fogyasztás a célpontjai közé kerül, a láncszemek a
 * szomszédaik közé.
 */

import { buildPieceGraph, type LayerInfo, type PieceGraph } from './graph.ts';
import type { StitchLibrary } from './stitch-library.ts';
import type { Anchor, NodeId, Pattern, StitchDef, StitchDefId } from './types.ts';

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Hogyan rajzolandó a csomópont: szárral, láncszemként, pontként, pikóként vagy gyűrűként. */
export type NodeRole = 'stitch' | 'chain' | 'slip' | 'picot' | 'ring';

export interface NodePlacement {
  readonly id: NodeId;
  readonly def: StitchDefId;
  readonly layer: number;
  readonly side: 'right' | 'wrong';
  readonly role: NodeRole;
  /** Szárnál a beszúrási pontok, célpontonként egy; a többinél üres. */
  readonly feet: readonly Point[];
  /** Szárnál a tető; a többinél a középpont. Ide mutat, ami ebbe horgol. */
  readonly top: Point;
  /** Láncszemnél a hossztengely szöge radiánban (0 = vízszintes). */
  readonly angle: number;
  /** Láncszemnél a hossza. */
  readonly size: number;
}

export interface LayerPlacement {
  readonly index: number;
  readonly shape: LayerInfo['shape'];
  readonly side: LayerInfo['side'];
  readonly stitchCount: number;
  /** A sorszám helye a sor kezdő oldalán. */
  readonly start: Point;
  /** Az öltésszám helye a sor végén. */
  readonly end: Point;
}

export interface ChartLayout {
  readonly nodes: ReadonlyMap<NodeId, NodePlacement>;
  /** Rétegenként, a 0. (láncalap vagy varázskör) is. */
  readonly layers: readonly LayerPlacement[];
  readonly bounds: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number };
}

export interface LayoutOptions {
  /** Balkezes, tükrözött nézet. */
  readonly mirror?: boolean;
  /** Egy öltés oszlopszélessége. */
  readonly columnWidth?: number;
  /** A szár hossza láncszem-magasságból; a felület a jelrajzéval adja át (src/ui/symbols.ts). */
  readonly stemLength?: (chainHeight: number) => number;
}

const DEFAULT_COLUMN = 24;
const defaultStem = (chainHeight: number) => 10 + 8 * chainHeight;
/** Hézag két sor között, és a láncszem magassága a sorban. */
const ROW_GAP = 6;
const CHAIN_HEIGHT = 12;
const SLIP_HEIGHT = 6;

const EMPTY: ChartLayout = { nodes: new Map(), layers: [], bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 } };

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
  const raw = new Layouter(graph, W, stem).run();
  return finish(graph, raw, options.mirror ?? false, W);
}

/* ---- Egy sor oszlopai ---- */

interface Item {
  readonly ids: readonly NodeId[];
  readonly half: number;
  readonly weight: number;
  desired: number | undefined;
}

/** Súlyozott monoton (nem csökkenő) regresszió. */
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

/**
 * Az elemek helye a haladás tengelyén: a kívánt helyükhöz a lehető
 * legközelebb, sorrendben, a félszélességek összegénél nem közelebb.
 */
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
  return isotonic(z, items.map((item) => item.weight)).map((value, i) => value + offsets[i]!);
}

/* ---- Rétegek ---- */

interface Raw {
  nodes: Map<NodeId, NodePlacement>;
  layers: LayerPlacement[];
}

class Layouter {
  readonly #graph: PieceGraph;
  readonly #W: number;
  readonly #stem: (chainHeight: number) => number;
  readonly #round: boolean;
  readonly #nodes = new Map<NodeId, NodePlacement>();
  readonly #layers: LayerPlacement[] = [];
  /** Sorban a vízszintes oszlop, körben a szög (radián). */
  readonly #axis = new Map<NodeId, number>();
  /** Rétegenként a talpvonal: sorban y, körben sugár. */
  readonly #base: number[] = [];

  constructor(graph: PieceGraph, W: number, stem: (chainHeight: number) => number) {
    this.#graph = graph;
    this.#W = W;
    this.#stem = stem;
    this.#round = graph.layers[0]!.shape === 'round';
  }

  run(): Raw {
    const [foundation, ...rest] = this.#graph.layers;
    this.#foundation(foundation!);
    let direction = 1;
    for (const layer of rest) {
      if (!this.#round && (layer.index === 1 || layer.opening?.kind === 'turn')) direction = -direction;
      this.#layer(layer, this.#round ? 1 : direction);
    }
    return { nodes: this.#nodes, layers: this.#layers };
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

  /** Sorban (x, y), körben (sugár, szög) → pont; a szög az óramutatóval ellentétesen nő. */
  #point(base: number, axis: number): Point {
    return this.#round ? { x: base * Math.cos(axis), y: -base * Math.sin(axis) } : { x: axis, y: base };
  }

  #foundation(layer: LayerInfo): void {
    const side = layer.side;
    if (this.#round) {
      for (const id of layer.stitches) {
        this.#axis.set(id, Math.PI / 2);
        this.#place(id, 0, side, 'ring', [], { x: 0, y: 0 }, 0, 0);
      }
      this.#base[0] = 10;
    } else {
      layer.stitches.forEach((id, i) => {
        this.#axis.set(id, i * this.#W);
        this.#place(id, 0, side, 'chain', [], { x: i * this.#W, y: 0 }, 0, this.#W * 0.8);
      });
      this.#base[0] = 0;
    }
    const last = (layer.stitches.length - 1) * this.#W;
    this.#layers.push({
      index: 0,
      shape: layer.shape,
      side,
      stitchCount: 0,
      start: this.#round ? { x: 0, y: 0 } : { x: -this.#W, y: 0 },
      end: this.#round ? { x: 0, y: 0 } : { x: last + this.#W, y: 0 },
    });
  }

  #anchorAxis(anchor: Anchor): number | undefined {
    if (anchor.into === 'stitch') return this.#axis.get(anchor.id);
    if (anchor.into === 'ring') return undefined;
    const chains = this.#graph.spaces.get(anchor.id)?.chains ?? [];
    const values = chains.map((id) => this.#axis.get(id)).filter((v): v is number => v !== undefined);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined;
  }

  #layer(layer: LayerInfo, direction: number): void {
    const graph = this.#graph;
    const W = this.#W;
    const below = graph.layers[layer.index - 1]!;
    const turning = new Set(layer.turningChain);

    const height = Math.max(
      CHAIN_HEIGHT,
      layer.turningChain.length ? this.#stem(layer.turningChain.length) : 0,
      ...layer.stitches.filter((id) => !turning.has(id)).map((id) => this.#height(id)),
    );
    const previousTop = layer.index === 1 ? this.#base[0]! + (this.#round ? 0 : -ROW_GAP) : this.#top(layer.index - 1);
    let base = this.#round ? previousTop + ROW_GAP : previousTop - ROW_GAP;
    this.#base[layer.index] = base;

    // Elemek a fonal sorrendjében; a fordulólánc egy oszlop, a pikó az előző elemen ül.
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
      items.push({
        ids: [id],
        half: kind === 'chain' ? W * 0.35 : kind === 'slip' ? W * 0.3 : W / 2,
        weight: anchored ? 1 : 0.01,
        desired: anchored ? axes.reduce((a, b) => a + b, 0) / axes.length : undefined,
      });
    }

    // Körben a szögek a talpvonal sugarán mérve; a kör legalább akkora, hogy kiférjen.
    const scale = (radius: number) => (this.#round ? 1 / radius : 1);
    if (this.#round) {
      const width = items.reduce((sum, item) => sum + 2 * item.half, 0);
      base = Math.max(base, width / (2 * Math.PI) - height / 2);
      this.#base[layer.index] = base;
    }
    const k = scale(base + height / 2);
    const scaled: Item[] = items.map((item) => ({
      ...item,
      half: item.half * k,
      desired: item.desired === undefined ? undefined : direction * item.desired,
    }));

    // A fordulólánc helye: a számító az alatta lévő öltés oszlopában, a nem számító az első öltés mellett kívül.
    const stack = scaled.find((item) => item.ids[0] === layer.turningChain[0] && layer.turningChain.length > 0);
    if (stack) {
      const workingFirst = layer.direction === 1 ? below.positions[0] : below.positions[below.positions.length - 1];
      const firstAnchored = scaled.find((item) => item !== stack && item.weight === 1)?.desired;
      const underneath = workingFirst === undefined ? undefined : this.#axis.get(workingFirst);
      if (this.#round && layer.index === 1) stack.desired = Math.PI / 2;
      else if (layer.turningChainCounts && layer.index >= 2 && underneath !== undefined) stack.desired = direction * underneath;
      else if (firstAnchored !== undefined) stack.desired = firstAnchored - 2 * stack.half;
      else if (underneath !== undefined) stack.desired = direction * underneath - (layer.turningChainCounts ? 0 : 2 * stack.half);
      else stack.desired = 0;
    }
    if (this.#round && scaled.every((item) => item.desired === undefined) && scaled[0]) scaled[0].desired = Math.PI / 2;

    const positions = spread(scaled).map((u) => direction * u);
    scaled.forEach((item, i) => {
      for (const id of item.ids) this.#axis.set(id, positions[i]!);
    });

    const side = layer.side;
    const top = this.#round ? base + height : base - height;
    const up = (from: number, by: number) => (this.#round ? from + by : from - by);
    for (const item of scaled) {
      const axis = this.#axis.get(item.ids[0]!)!;
      if (item === stack) {
        const step = height / item.ids.length;
        item.ids.forEach((id, i) => {
          const center = this.#point(up(base, (i + 0.5) * step), axis);
          const along = this.#round ? Math.atan2(-Math.sin(axis), Math.cos(axis)) : Math.PI / 2;
          this.#place(id, layer.index, side, 'chain', [], center, along, Math.min(step * 0.95, W * 0.8));
        });
        continue;
      }
      const id = item.ids[0]!;
      const def = this.#def(id);
      if (def.kind === 'chain') {
        const along = this.#round ? Math.atan2(-Math.cos(axis), -Math.sin(axis)) : 0;
        this.#place(id, layer.index, side, 'chain', [], this.#point(up(top, -6), axis), along, W * 0.7);
        continue;
      }
      const feet = graph.nodes.get(id)!.anchors.map((anchor) => this.#foot(anchor, layer.index, base));
      if (def.kind === 'slip') {
        // Körben a továbbvezető és a záró kúszószem ott látszik, ahová horgolták.
        const center = this.#round && feet[0] ? feet[0] : this.#point(up(base, SLIP_HEIGHT / 2), axis);
        this.#place(id, layer.index, side, 'slip', feet, center, 0, 0);
        continue;
      }
      this.#place(id, layer.index, side, 'stitch', feet, this.#point(up(base, this.#stem(def.chainHeight)), axis), 0, 0);
    }
    for (const [id, host] of picots) {
      const hostTop = this.#nodes.get(host)!.top;
      const axis = this.#axis.get(host)!;
      this.#axis.set(id, axis);
      const center = this.#round
        ? this.#point(Math.hypot(hostTop.x, hostTop.y) + 8, axis)
        : { x: hostTop.x, y: hostTop.y - 8 };
      this.#place(id, layer.index, side, 'picot', [], center, 0, 0);
    }

    const first = positions[0] ?? 0;
    const last = positions[positions.length - 1] ?? first;
    const margin = W * scale(base + height / 2);
    const middle = up(base, height / 2);
    this.#layers.push({
      index: layer.index,
      shape: layer.shape,
      side,
      stitchCount: layer.stitchCount,
      start: this.#point(middle, first - direction * margin),
      end: this.#point(middle, last + direction * margin),
    });
    this.#tops[layer.index] = top;
  }

  readonly #tops: number[] = [];

  #top(index: number): number {
    return this.#tops[index] ?? this.#base[index] ?? 0;
  }

  /** A talp: a célpont oszlopa ennek a rétegnek a talpvonalán; korábbi sorba horgolt öltésnél annak a sornak a tetején. */
  #foot(anchor: Anchor, index: number, base: number): Point {
    if (anchor.into === 'ring') return { x: 0, y: 0 };
    if (this.#round) {
      // Körben a kör sugara a helyigénnyel nő, ezért a talp a célpont valódi helyén van, nem a talpkörön.
      const ids = anchor.into === 'stitch' ? [anchor.id] : (this.#graph.spaces.get(anchor.id)?.chains ?? []);
      const tops = ids.map((id) => this.#nodes.get(id)?.top).filter((p): p is Point => p !== undefined);
      if (tops.length > 0) {
        return { x: tops.reduce((sum, p) => sum + p.x, 0) / tops.length, y: tops.reduce((sum, p) => sum + p.y, 0) / tops.length };
      }
    }
    const axis = this.#anchorAxis(anchor) ?? 0;
    const target = anchor.into === 'stitch' ? anchor.id : this.#graph.spaces.get(anchor.id)?.chains[0];
    const targetLayer = target === undefined ? index - 1 : (this.#graph.layerOf.get(target) ?? index - 1);
    const line = targetLayer >= index - 1 ? base : (this.#base[targetLayer + 1] ?? base);
    return this.#point(line, axis);
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

/* ---- Kézi igazítás, tükrözés, befoglaló téglalap ---- */

function finish(graph: PieceGraph, raw: Raw, mirror: boolean, W: number): ChartLayout {
  const offset = (id: NodeId): Point => {
    const pinned = graph.nodes.get(id)?.pinned;
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
  return { nodes, layers, bounds: { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad } };
}
