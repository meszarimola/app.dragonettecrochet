/*
 * A diagram elrendezése a gráfból: hely, irány, legyező, összefutás, sorszám,
 * színe és visszája. Tiszta függvény, böngésző nélkül.
 *
 * Konvenciók (01 §6.1, §6.3, §8.4; 03 §2.1, §4.4):
 * - A jel talpa ott van, ahová horgolták: az alatta lévő szem oszlopában. A
 *   szaporítás szárai egy talpból legyezőben nyílnak, a fogyasztás szárai egy
 *   tetőbe futnak — ez magától adódik, mert a talp a célpont, a tető a saját
 *   oszlop.
 * - Sorban a jelek függőlegesek, a sorok alulról felfelé, kígyózva haladnak:
 *   jobbkezesnek az 1. sor jobbról balra; a sorszám a sor kezdő oldalán áll.
 * - A sormagasság a sor legmagasabb szeméből jön; egy sor jelei közös
 *   talpvonalon állnak.
 * - Körben a jelek sugárirányúak, a körök a középből az óramutatóval
 *   ellentétesen haladnak.
 * - Sokszögben (négyzet, hatszög, nyolcszög, nagymama-négyzet) a körök a
 *   sokszög oldalai mentén haladnak, a jelek az oldalra merőlegesek, a
 *   sarokcsoportok a sarkokban, egymás fölött ülnek (polygon.ts, PQW-888). A
 *   körök távolsága itt is a jelek magasságából jön; a sokszög kerülete
 *   nagyobb a köréhez képest, ezért a jelek nem torlódnak.
 * - Tükrözött nézetben (balkezeseknek) minden vízszintesen tükröződik (01 §8.4 szabály 22).
 *
 * Stabil szerkesztés közben (06 §5.3 2. pont): egy réteg csak az alatta lévő
 * rétegtől és a saját szemeitől függ, ezért új szem csak a saját sorát
 * rendezheti át, a korábbi sorokat nem.
 *
 * Egy sor oszlopai: minden szem oda szeretne kerülni, ahová horgolták, de a
 * fonal sorrendjében, legalább fél-fél szélességnyi távolságra egymástól. Ezt
 * súlyozott monoton regresszió adja (pool adjacent violators): a legyező a
 * célpontja köré, a fogyasztás a célpontjai közé kerül, a láncszemek a
 * szomszédaik közé.
 */

import { placeBorder } from './border.ts';
import { buildPieceGraph, type LayerInfo, type PieceGraph } from './graph.ts';
import { CIRCLE, frameCoords, frameFor, frameNormal, framePoint, frameSide, perimeter, type Point, type RoundFrame } from './polygon.ts';
import { curveLayout, rowCurve } from './row-curve.ts';
import type { StitchLibrary } from './stitch-library.ts';
import type { Anchor, NodeId, Pattern, StitchDef, StitchDefId } from './types.ts';
import { validatePattern } from './validate.ts';

export type { Point, RoundFrame } from './polygon.ts';

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
  /** A szemszám helye a sor végén. */
  readonly end: Point;
}

export interface ChartLayout {
  readonly nodes: ReadonlyMap<NodeId, NodePlacement>;
  /** Rétegenként, a 0. (láncalap vagy varázskör) is. */
  readonly layers: readonly LayerPlacement[];
  readonly bounds: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number };
  /** Sokszögben horgolt darabnál az alakja (PQW-888); sorban és lapos körben hiányzik. */
  readonly frame?: RoundFrame;
}

export interface LayoutOptions {
  /** Balkezes, tükrözött nézet. */
  readonly mirror?: boolean;
  /** Egy szem oszlopszélessége. */
  readonly columnWidth?: number;
  /** A szár hossza láncszem-magasságból; a felület a jelrajzéval adja át (src/ui/symbols.ts). */
  readonly stemLength?: (chainHeight: number) => number;
  /** Egyenes sorok a darab íves alakja helyett (PQW-893); a rács ebből számol, és maga görbíti. */
  readonly straight?: boolean;
}

export const DEFAULT_COLUMN = 24;
const defaultStem = (chainHeight: number) => 10 + 8 * chainHeight;
/** Hézag két sor között, és a láncszem magassága a sorban. */
export const ROW_GAP = 6;
const CHAIN_HEIGHT = 12;
const SLIP_HEIGHT = 6;
const TAU = 2 * Math.PI;

const EMPTY: ChartLayout = { nodes: new Map(), layers: [], bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 } };

/**
 * A hibás célpontú szemek (elrontott vagy félrehorgolt), amelyeknek a szárát a
 * saját oszlopában, normál méretben rajzoljuk, nem a távoli célpontig nyújtva:
 * a később készülő, korábbi sorba vagy a haladási irány ellen mutató célpont
 * (PQW-879). A szabályozott, jelölt nyúlás (keresztezett, hosszú szem, relief)
 * ezekhez nem tartozik, mert az ellenőrző sem jelzi hibának.
 */
const DETACHED_RULES = new Set(['future-anchor', 'anchor-layer', 'against-direction', 'turning-chain-placement']);

/** A hibás célpontú szemek azonosítói az ellenőrző találataiból. */
function detachedNodes(pattern: Pattern, library: StitchLibrary): Set<NodeId> {
  const set = new Set<NodeId>();
  for (const finding of validatePattern(pattern, library)) {
    if (!DETACHED_RULES.has(finding.rule)) continue;
    // A haladási irány elleni találat a megelőző (helyes) szemet is felsorolja; a hibás az utolsó.
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
  // A szegély a sorok köré kerül (PQW-889): a sorok után, a helyük ismeretében.
  placeBorder(graph, raw.nodes, raw.layers, W, stem);
  const chart = finish(graph, raw, options.mirror ?? false, W);
  // Sorban horgolt kendő (PQW-893): az egyenes elrendezés íven vagy megtörve (row-curve.ts), a kézi igazítás nélküli helyekből.
  const shape = piece.rowShape;
  if (!shape || options.straight || graph.layers[0]!.shape !== 'row') return chart;
  const curve = rowCurve(finish(graph, raw, options.mirror ?? false, W, false), shape);
  return curve ? curveLayout(chart, curve, W) : chart;
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
  frame: RoundFrame;
}

/** A kör egy sarka: a szem vagy a láncív, amelybe a következő kör sarokcsoportja kerül. */
interface CornerRef {
  readonly space: boolean;
  readonly id: string;
}

class Layouter {
  readonly #graph: PieceGraph;
  readonly #W: number;
  readonly #stem: (chainHeight: number) => number;
  readonly #round: boolean;
  /** Ovális kezdés (PQW-890): a láncalap egyenesen, az 1. kör a két oldalán. */
  readonly #oval: boolean;
  /** A körben horgolt darab alakja: kör vagy sokszög. */
  readonly #frame: RoundFrame;
  /** Sokszögben rétegenként a sarkok, a fonal sorrendjében; ha nem követhetők, `null`. */
  readonly #corners: (readonly CornerRef[] | null)[] = [];
  /** A sarkok helye a kerület menti paraméterben, az 1. körtől rögzítve. */
  #cornerAxes: number[] | null = null;
  /** Hibás célpontú szemek: a száruk a saját oszlopukban, normál méretben áll. */
  readonly #detached: ReadonlySet<NodeId>;
  readonly #nodes = new Map<NodeId, NodePlacement>();
  readonly #layers: LayerPlacement[] = [];
  /** Sorban a vízszintes oszlop, körben a szög (radián). */
  readonly #axis = new Map<NodeId, number>();
  /** Rétegenként a talpvonal: sorban y, körben sugár. */
  readonly #base: number[] = [];

  constructor(graph: PieceGraph, W: number, stem: (chainHeight: number) => number, detached: ReadonlySet<NodeId> = new Set()) {
    this.#graph = graph;
    this.#W = W;
    this.#stem = stem;
    this.#detached = detached;
    this.#round = graph.layers[0]!.shape === 'round';
    this.#oval = this.#round && graph.layers[0]!.undersides.length > 0;
    this.#frame = this.#round ? frameFor(graph.piece.corners) : CIRCLE;
  }

  run(): Raw {
    const [foundation, ...rest] = this.#graph.layers;
    this.#foundation(foundation!);
    let direction = 1;
    for (const layer of rest) {
      if (layer.border) continue;
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

  /**
   * Sorban (x, y), körben (belső sugár, kerület menti paraméter) → pont; a
   * paraméter az óramutatóval ellentétesen nő. Lapos körben ez a sugár és a szög.
   */
  #point(base: number, axis: number): Point {
    return this.#round ? framePoint(this.#frame, base, axis) : { x: axis, y: base };
  }

  #foundation(layer: LayerInfo): void {
    const side = layer.side;
    const chains = layer.stitches.filter((id) => this.#def(id).kind === 'chain');
    if (this.#round && chains.length > 0 && this.#oval) {
      // Ovális (PQW-890): a láncalap egyenesen a közepén. A paraméter a horogtól távolodva nő (0-tól π-ig),
      // a láncszem másik oldala a tükörképe (π-től 2π-ig), így az 1. kör körbeér a láncalap két oldalán.
      const n = layer.stitches.length;
      const half = Math.max(this.#W, (n * this.#W * 0.8) / 2);
      layer.stitches.forEach((id, k) => {
        const axis = (Math.PI * (n - k)) / n;
        this.#axis.set(id, axis);
        this.#place(id, 0, side, 'chain', [], { x: half * Math.cos(axis), y: 0 }, 0, Math.min(this.#W * 0.8, ((2 * half) / n) * 0.9));
      });
      this.#base[0] = half + 8;
    } else if (this.#round && chains.length > 0) {
      // Láncgyűrű: a láncszemek kis körön a középpont körül; a „2 lsz” kezdés egyetlen láncszeme középen (PQW-861).
      const radius = chains.length === 1 ? 0 : Math.max(6, (chains.length * this.#W * 0.6) / (2 * Math.PI));
      layer.stitches.forEach((id, i) => {
        const axis = Math.PI / 2 + (2 * Math.PI * i) / layer.stitches.length;
        this.#axis.set(id, axis);
        const along = Math.atan2(-Math.cos(axis), -Math.sin(axis));
        // A láncgyűrű sokszögben is kerek.
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

    // Körben a paraméter a kör közepének kerületén mérve; a kör legalább akkora, hogy kiférjen.
    // Az egységnyi belső sugár kerülete körben 2π, sokszögben 2n · tg(π/n).
    const around = perimeter(this.#frame, 1);
    const unit = around / TAU;
    const scale = (radius: number) => (this.#round ? 1 / (radius * unit) : 1);
    if (this.#round) {
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

    // A fordulólánc helye: a számító az alatta lévő szem oszlopában, a nem számító az első szem mellett kívül.
    const stack = scaled.find((item) => item.ids[0] === layer.turningChain[0] && layer.turningChain.length > 0);
    if (stack) {
      const workingFirst = layer.direction === 1 ? below.positions[0] : below.positions[below.positions.length - 1];
      const firstAnchored = scaled.find((item) => item !== stack && item.weight === 1)?.desired;
      const underneath = workingFirst === undefined ? undefined : this.#axis.get(workingFirst);
      if (this.#round && layer.index === 1) stack.desired = this.#oval ? 0 : Math.PI / 2;
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
    if (this.#round && this.#frame.sides >= 3) this.#alignCorners(layer, scaled, positions);

    const side = layer.side;
    const top = this.#round ? base + height : base - height;
    const up = (from: number, by: number) => (this.#round ? from + by : from - by);
    for (const item of scaled) {
      const axis = this.#axis.get(item.ids[0]!)!;
      if (item === stack) {
        const step = height / item.ids.length;
        item.ids.forEach((id, i) => {
          const center = this.#point(up(base, (i + 0.5) * step), axis);
          const normal = frameNormal(this.#frame, axis);
          const along = this.#round ? Math.atan2(-Math.sin(normal), Math.cos(normal)) : Math.PI / 2;
          this.#place(id, layer.index, side, 'chain', [], center, along, Math.min(step * 0.95, W * 0.8));
        });
        continue;
      }
      const id = item.ids[0]!;
      const def = this.#def(id);
      if (def.kind === 'chain') {
        // A láncszem a kör mentén fekszik: sokszögben az oldallal párhuzamosan.
        const normal = frameNormal(this.#frame, axis);
        const along = this.#round ? Math.atan2(-Math.cos(normal), -Math.sin(normal)) : 0;
        this.#place(id, layer.index, side, 'chain', [], this.#point(up(top, -6), axis), along, W * 0.7);
        continue;
      }
      // A hibás célpontú szem talpa a saját oszlopában, ennek a sornak a talpvonalán:
      // a jel normál méretben, a helyén marad, a karjai nem nyúlnak a távoli célpontig (PQW-879).
      const feet = this.#detached.has(id)
        ? graph.nodes.get(id)!.anchors.map(() => this.#point(base, axis))
        : graph.nodes.get(id)!.anchors.map((anchor) => this.#foot(anchor, layer.index, base));
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
        ? this.#point(frameCoords(this.#frame, hostTop).r + 8, axis)
        : { x: hostTop.x, y: hostTop.y - 8 };
      this.#place(id, layer.index, side, 'picot', [], center, 0, 0);
    }

    const first = positions[0] ?? 0;
    const last = positions[positions.length - 1] ?? first;
    const margin = W * scale(base + height / 2);
    const middle = up(base, height / 2);
    // Sokszögben a körszám a kör első szemének oldalán marad: így a körszámok egymás fölött, elkülönülve állnak (PQW-888).
    const startAxis = this.#round ? Math.max(first - direction * margin, frameSide(this.#frame, first)[0]) : first - direction * margin;
    const shifted = startAxis - (first - direction * margin);
    // Körben a kör vége a kezdete mellé ér: a szemszám a körszám mögé kerül, hogy ne takarják egymást (PQW-861).
    const endAxis = this.#round ? first - direction * (margin + Math.min(2 * margin, Math.PI / 3)) + shifted : last + direction * margin;
    this.#layers.push({
      index: layer.index,
      shape: layer.shape,
      side,
      stitchCount: layer.stitchCount,
      start: this.#point(middle, startAxis),
      end: this.#point(middle, endAxis),
    });
    this.#tops[layer.index] = top;
  }

  readonly #tops: number[] = [];

  #top(index: number): number {
    return this.#tops[index] ?? this.#base[index] ?? 0;
  }

  /**
   * Sokszögben a kör sarkai a sokszög sarkaiba kerülnek (PQW-888): a kör helyei
   * sarokról sarokra lineárisan igazodnak, a sorrendjük és az arányuk marad.
   * Az 1. körben a sarkok a saját szerkezetéből jönnek, utána az előző kör
   * sarkaiból; így a réteg csak önmagától és az alatta lévőtől függ (06 §5.3).
   */
  #alignCorners(layer: LayerInfo, items: readonly Item[], positions: number[]): void {
    const refs = this.#cornerRefs(layer);
    this.#corners[layer.index] = refs;
    if (!refs) return;
    const axes = refs.map((ref) => (ref.space ? this.#anchorAxis({ into: 'space', id: ref.id }) : this.#axis.get(ref.id)));
    if (axes.some((axis) => axis === undefined)) {
      this.#corners[layer.index] = null;
      return;
    }
    const actual = axes as number[];
    const n = this.#frame.sides;
    if (layer.index === 1 || !this.#cornerAxes) {
      // Az 1. kör első sarka a hozzá legközelebbi sokszögsarokba; a többi sorban utána.
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

  /**
   * A kör eleje és vége ugyanarra az oldalra esik, az utolsó és az első sarok
   * közé. A sor menti elosztás ezt nem látja, ezért a kör eleje hátrafelé, a
   * vége előrefelé csúszhat, és a két vég egymásra kerül. Ha így van, ezen az
   * oldalon a két sarok között újra szétosztjuk a helyeket.
   */
  #spreadSeam(items: readonly Item[], positions: number[], refs: readonly CornerRef[]): void {
    // A sarok elemei: a sarokszem, vagy a sarokív láncszemei.
    const indicesOf = (ref: CornerRef) => {
      const ids = ref.space ? (this.#graph.spaces.get(ref.id)?.chains ?? []) : [ref.id];
      return items.flatMap((item, i) => (item.ids.some((id) => ids.includes(id)) ? [i] : []));
    };
    const tail = indicesOf(refs[refs.length - 1]!);
    const head = indicesOf(refs[0]!);
    if (tail.length === 0 || head.length === 0) return;
    const last = Math.max(...tail);
    const first = Math.min(...head);
    // A varrat: az utolsó sarok utáni, majd a kör elején az első sarok előtti elemek.
    const seam = [
      ...items.flatMap((_, i) => (i > last ? [{ index: i, wrapped: false }] : [])),
      ...items.flatMap((_, i) => (i < first ? [{ index: i, wrapped: true }] : [])),
    ];
    if (seam.length === 0) return;
    const row: Item[] = seam.map(({ index, wrapped }) => ({ ...items[index]!, desired: positions[index]! + (wrapped ? TAU : 0) }));
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

  /**
   * A kör sarkai. Az 1. körben a láncívek, ha éppen annyi van, ahány sarok
   * (nagymama-négyzet); különben a pozíciók egyenlő oldalakra osztva, mindegyik
   * oldal a sarokszemmel végződik (round-generator.ts `polygonPlan`). Később
   * az előző kör sarkába horgolt csoport közepe: a csoporton belüli láncív
   * (nagymama-négyzet), vagy a középső szem.
   */
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
    const excluded = new Set<NodeId>([...layer.turningChain, ...layer.travelSlips, ...(layer.joinSlip ? [layer.joinSlip] : [])]);
    const order = (id: NodeId) => graph.order.get(id)!;
    const refs: CornerRef[] = [];
    for (const corner of previous) {
      const children = layer.stitches.filter(
        (id) =>
          !excluded.has(id) &&
          graph.nodes.get(id)!.anchors.some((anchor) => anchor.into === (corner.space ? 'space' : 'stitch') && anchor.id === corner.id),
      );
      // A számító kezdőlánc az előző kör első pozíciójába horgolt szemnek számít.
      const top = layer.turningChain[layer.turningChain.length - 1];
      if (!corner.space && layer.turningChainCounts && top !== undefined && below.positions[0] === corner.id) children.unshift(top);
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

  /** A talp: a célpont oszlopa ennek a rétegnek a talpvonalán; korábbi sorba horgolt szemnél annak a sornak a tetején. */
  #foot(anchor: Anchor, index: number, base: number): Point {
    if (anchor.into === 'ring') return { x: 0, y: 0 };
    if (this.#round) {
      // Körben a kör sugara a helyigénnyel nő, ezért a talp a célpont valódi helyén van, nem a talpkörön.
      const ids = anchor.into === 'stitch' || anchor.into === 'underside' ? [anchor.id] : (this.#graph.spaces.get(anchor.id)?.chains ?? []);
      const tops = ids.map((id) => this.#nodes.get(id)?.top).filter((p): p is Point => p !== undefined);
      if (tops.length > 0) {
        return { x: tops.reduce((sum, p) => sum + p.x, 0) / tops.length, y: tops.reduce((sum, p) => sum + p.y, 0) / tops.length };
      }
    }
    const axis = this.#anchorAxis(anchor) ?? 0;
    const target = anchor.into === 'stitch' || anchor.into === 'underside' ? anchor.id : this.#graph.spaces.get(anchor.id)?.chains[0];
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
