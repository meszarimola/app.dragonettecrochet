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

import { buildPieceGraph, type LayerInfo, type PieceGraph } from './graph.ts';
import { CIRCLE, frameCoords, frameFor, frameNormal, framePoint, frameSide, perimeter, type Point, type RoundFrame } from './polygon.ts';
import { curveLayout, rowCurve } from './row-curve.ts';
import type { StitchLibrary } from './stitch-library.ts';
import type { Anchor, NodeId, Pattern, RoundShape, StitchDef, StitchDefId } from './types.ts';
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
  /**
   * A sor menti tengely szöge radiánban a csomópont helyén (0 = vízszintes):
   * láncszemnél egyben a hossztengelye. Szárnál a jel ehhez igazítja a
   * kereszt- és a tetővonalát, nem a (szaporításnál ferde) szárhoz (PQW-931).
   */
  readonly angle: number;
  /** Láncszemnél a hossza. */
  readonly size: number;
}

export interface LayerPlacement {
  readonly index: number;
  readonly shape: LayerInfo['shape'];
  readonly side: LayerInfo['side'];
  readonly stitchCount: number;
  /** A kiírt szemszám: a rajz felirata ezt mutatja (PQW-940). */
  readonly writtenCount: number;
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
  /** Az ív a saját láncszemeit összébb húzza, ezért ez állítható (PQW-951). */
  half: number;
  readonly weight: number;
  desired: number | undefined;
}

/** Egy láncív a rajzon: a láncszemei a húr fölé emelkednek (PQW-951). */
interface Arc {
  readonly ids: readonly NodeId[];
  /** A húr két vége a haladás tengelyén: a két rögzített szem belső széle. */
  readonly start: number;
  readonly end: number;
  /** Az ív magassága a húr fölött. */
  readonly rise: number;
  /** A tömörödött láncszemjel hossza. */
  readonly size: number;
}

/**
 * Mennyi helyet kér egy szem a rajzon (PQW-931).
 *
 * A tulajdonos elvárása: *„az első sorban lévő négyzetnek feleljen meg a
 * második sorban 3 négyzet, ha 3-at szaporítok”*, és *„az a láncszem, ahova a
 * szaporítás csatlakozik, ahogy adom hozzá a szaporítást és szélesedik, úgy
 * csúszzon az ő négyzetének közepére”*.
 *
 * Ehhez egy szemnek annyi hely kell, amennyit a BELE horgolt szemek együtt
 * elfoglalnak. Felfelé összegzünk: a legfelső sor szemei egy oszlopot kérnek,
 * lejjebb mindenki a rá épülők igényének összegét, de legalább egy oszlopot.
 *
 * A fogyasztás (egy szem több célponttal) az igényét ELOSZTJA a célpontjai
 * között: különben mindegyik alatt teljes szélességgel jelenne meg, és a sor
 * fölöslegesen szétnyílna.
 *
 * Ez a szándékolt ára a tulajdonosi döntésnek: egy szem hozzáadása mostantól a
 * KORÁBBI sorokat is átrendezi, mert az alatta lévő szem igénye megnő. A
 * korábbi garancia (06 §5.3 2. pont) ezzel megszűnt.
 */
export function stitchWidths(graph: PieceGraph, W: number): Map<NodeId, number> {
  const widths = new Map<NodeId, number>();
  // Felülről lefelé: mire egy szemhez érünk, a rá épülők igénye már összegyűlt.
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
      /*
       * EGY SZINTRE nézünk, nem a teljes részfára: a szem a saját alapigényét
       * (`W`) adja tovább, nem a már felhalmozott szélességét.
       *
       * Mérés mutatta meg, miért: a teljes részfa összegzésével az alsó sorok
       * olyan szélesek lettek, mint a legfelsők, és a legyező alakú kendő
       * téglalappá lapult — a félkör 180° helyett 157°-ot fogott át. A
       * tulajdonos kérése viszont egy szintről szól: „az első sorban lévő
       * négyzetnek feleljen meg a második sorban 3 négyzet, ha 3-at
       * szaporítok.” Ehhez elég, ha a szem a KÖZVETLENÜL beléje horgolt
       * szemek számával szélesedik.
       */
      const share = W / targets.length;
      for (const target of targets) widths.set(target, (widths.get(target) ?? 0) + share);
    }
  }
  return widths;
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

/**
 * A sor menti tengely szöge körben, a kifelé mutató `normal` irány szögéből. A
 * `polar` a vászon lefelé növő y-ához negálja a szinuszt, ezért kifelé (cos,
 * −sin) mutat, a sor menti érintő pedig (−sin, −cos). Ez NEM a kifelé mutató
 * irány szöge, amellyel a fordulólánc-köteg áll: azt összekeverve körben
 * minden jel elfordul.
 */
function alongRow(normal: number): number {
  return Math.atan2(-Math.cos(normal), -Math.sin(normal));
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
  #roundShape: RoundShape | undefined;

  /** Kúpos kör-e a réteg (PQW-908): a 2. körtől a megadott körig. */
  #cone(index: number): boolean {
    return this.#round && this.#roundShape?.kind === 'cone' && index >= 2 && index <= this.#roundShape.throughRound;
  }
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
  /** Szemenként a kért szélesség: a bele horgolt szemek igényének összege (PQW-931). */
  readonly #widths: ReadonlyMap<NodeId, number>;

  constructor(graph: PieceGraph, W: number, stem: (chainHeight: number) => number, detached: ReadonlySet<NodeId> = new Set()) {
    this.#graph = graph;
    this.#W = W;
    /*
     * A széthúzás csak a KÉZZEL horgolt rajzra vonatkozik (PQW-931). Az íves
     * sorú, generált darab (kendő) elrendezése maradjon bitre azonos: a
     * tulajdonos az UAT első körében a szabályos horgolást teszi rendbe, a
     * kendő geometriáján nem dolgozunk. Üres térkép = mindenki az alapigényét
     * kéri, vagyis a korábbi viselkedés.
     */
    this.#widths = graph.piece.rowShape ? new Map() : stitchWidths(graph, W);
    this.#stem = stem;
    this.#detached = detached;
    this.#round = graph.layers[0]!.shape === 'round';
    this.#roundShape = graph.piece.roundShape;
    this.#oval = this.#round && graph.layers[0]!.undersides.length > 0;
    // A kúp (PQW-908: a raglán vállrésze) kör alapú: a négy raglánvonal szaporítási pont, nem motívumsarok.
    // Sarkos keretre húzva a rajz négyzetté torzulna, pedig a darab a valóságban körbefutó cső.
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
      /*
       * A láncalap NEM fix rácson áll (PQW-931): minden láncszem annyi helyet
       * kap, amennyit a bele horgolt szemek együtt kérnek, és a saját,
       * kiszélesedett sávjának KÖZEPÉN áll. Ez a tulajdonos kérése: ahogy a
       * szaporítás nő, a láncszem csússzon a négyzete közepére, és fölötte
       * annyi négyzet legyen, ahány szem belekerült.
       */
      let x = 0;
      layer.stitches.forEach((id, i) => {
        const width = this.#widths.get(id);
        // Széthúzás nélkül a régi, fix rács — így az íves darab rajza sem mozdul.
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
      // A láncalap kiírt szemszáma a gráfé: a megmaradt láncszemei és a fordulólánc oszlopa (PQW-942).
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

    /*
     * A fordulólánc SAJÁT magassága: azé a szemé, amelyik helyett áll (PQW-934).
     * Nem a sor legmagasabb szeméé — a sor később megnőhet, a fordulólánc
     * viszont marad, ami volt.
     */
    const chainSpan = layer.turningChain.length ? this.#stem(layer.turningChain.length) : 0;
    const stitchHeight = Math.max(
      CHAIN_HEIGHT,
      chainSpan,
      ...layer.stitches.filter((id) => !turning.has(id)).map((id) => this.#height(id)),
    );
    // Az újrakezdett szakasz az alatta megadott sor tetejére épül (PQW-901).
    const previousTop = layer.index === 1 ? this.#base[0]! + (this.#round ? 0 : -ROW_GAP) : this.#top(layer.below);
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
      // A kért szélesség legalább a jel sajátja, de a bele horgolt szemek igénye tágíthatja (PQW-931).
      const ownHalf = kind === 'chain' ? W * 0.35 : kind === 'slip' ? W * 0.3 : W / 2;
      items.push({
        ids: [id],
        half: Math.max(ownHalf, (this.#widths.get(id) ?? W) / 2),
        weight: anchored ? 1 : 0.01,
        desired: anchored ? axes.reduce((a, b) => a + b, 0) / axes.length : undefined,
      });
    }

    /*
     * A láncszem helye: az általa áthidalt, kihagyott szem oszlopa (PQW-935).
     *
     * A láncszemnek nincs célpontja, ezért eddig a szomszédai közé
     * interpolálódott — a sor végén pedig egyszerűen az utolsó szem mellé
     * került, akárhová tette a horgoló. A tulajdonos: „azt vártam volna, hogy
     * ha a másodikba klikkelek… akkor abba a cellába tegye a láncszemet.”
     *
     * A kihagyott szemeket (`piece.skipped`) a szerkesztő jegyzi fel, amikor a
     * lánc áthidalja őket. A hozzárendelés a fonal sorrendjében megy: minden
     * láncszem a soron következő olyan kihagyott szem fölé kerül, amelyik már
     * az előtte lévő szem mögött van. Ahol nincs ilyen, minden marad a régiben.
     */
    const skipped = new Set(this.#graph.piece.skipped);
    const arcs: Arc[] = [];
    const bridged = below.positions
      .filter((id) => skipped.has(id))
      .map((id) => this.#axis.get(id))
      .filter((value): value is number => value !== undefined)
      .sort((a, b) => direction * (a - b));
    if (bridged.length > 0) {
      const loose = (item: Item) =>
        item.desired === undefined && item.ids[0] !== layer.turningChain[0] && this.#def(item.ids[0]!).kind === 'chain';
      /*
       * A párosítás RÉSENKÉNT megy, nem a sor elejétől végigszámolva (PQW-936).
       *
       * Az első változat egyetlen mutatóval haladt végig a soron, ezért ha egy
       * résben más volt a láncszemek és az áthidalt szemek száma — mert egybe
       * utóbb mégis szem került, vagy két láncsor ugyanarra a helyre nyúlt —,
       * onnantól MINDEN későbbi láncszem elcsúszott, a legvégén pedig hely
       * híján visszaesett az előtte lévő szem mellé. A tulajdonos ezt látta:
       * „köti a láncszemet a következő cellához az erp után”, és jól mondta,
       * hogy ez ismétlődő mintában újra és újra előjön.
       *
       * Két szem közötti rést csak az ő áthidalt szemeik érintik, ezért egy rés
       * hibája nem gyűrűzik tovább. Kevesebb láncszem középre kerül, több
       * egyenletesen oszlik el a rés fölött.
       */
      let run: Item[] = [];
      let behind: Item | undefined;
      const settle = (ahead: Item | undefined) => {
        if (run.length > 0) {
          const from = behind?.desired;
          const to = ahead?.desired;
          const gap = bridged.filter(
            (at) => (from === undefined || direction * (at - from) > 0) && (to === undefined || direction * (to - at) > 0),
          );
          /*
           * TÖBB LÁNCSZEM, MINT AHÁNY SZEMET ÁTHIDAL: ez az ÍV (PQW-951).
           *
           * A tulajdonos a kagylós mintát rajzolta: egy rövidpálca, 5 láncszem,
           * és a következő rövidpálca az alsó sor 5. szemébe — alul 3 kihagyott
           * szem, felül 5 láncszem. „ha beillesztem a következő rövidpálcát,
           * akkor ilyen csúnyán adja ki a mintakészítő.”
           *
           * Azért csúnya, mert a láncszemek csak akkor kaptak helyet, ha jutott
           * nekik áthidalt szem: 5-ből 3. A maradék kettő a szomszéd rövidpálca
           * oszlopába sodródott, és KITOLTA onnan — a mérés szerint a sor első
           * szeme x=564 helyett 587,6-ra került, vagyis a kelme szélén kívülre.
           *
           * A valóságban nem a pálca mozdul, hanem a lánc ível. Ezért a rés
           * két rögzített szeme közötti helyet a láncszemek EGYÜTT kapják meg:
           * annyifelé osztva, ahányan vannak, és a jelük ennyire tömörödik. Ami
           * így sem fér el vízszintesen, az fölfelé megy (`#arc`).
           */
          const space =
            from !== undefined && to !== undefined && behind && ahead ? Math.abs(to - from) - behind.half - ahead.half : 0;
          if (!this.#round && run.length > gap.length && gap.length > 0 && space > 0) {
            arcs.push(this.#arc(run, from!, direction, space, behind!.half, stitchHeight));
          } else {
            /*
             * A rés ELSŐ jelöléseit vesszük, nem a közepét (PQW-938). A
             * láncszemek a kurzortól egymás után foglalják el a helyeket, tehát
             * az elsők az övék. Ha árva jelölés maradna a résben, a szétosztás
             * a sor túlsó felére dobta volna a láncszemet — a tulajdonos pont
             * ezt látta.
             */
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
    // Az ív a sorból nyúlik fölfelé, ezért a sor magassága befogadja.
    const height = stitchHeight + arcs.reduce((most, arc) => Math.max(most, arc.rise), 0);
    const arcOf = new Map<NodeId, Arc>();
    for (const arc of arcs) for (const id of arc.ids) arcOf.set(id, arc);

    // Körben a paraméter a kör közepének kerületén mérve; a kör legalább akkora, hogy kiférjen.
    // Az egységnyi belső sugár kerülete körben 2π, sokszögben 2n · tg(π/n).
    const around = perimeter(this.#frame, 1);
    const unit = around / TAU;
    const scale = (radius: number) => (this.#round ? 1 / (radius * unit) : 1);
    // Lapos körnél a sugár akkorára nő, hogy a kör szemei kiférjenek a kerületén. A kúp (PQW-908: a raglán
    // vállrésze) ennél lassabban nő: ott a sugarat a kelme adja (az előző kör teteje), a kör pedig kiterítve
    // körcikket ad, mint a valóságban. Az 1. kör mindig a kerületéből indul, különben nem lenne mihez mérni.
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

    /*
     * A fordulólánc helye: az első szem mellett kívül. Sorban a fordulólánc nem
     * szem (PQW-924), ezért nem ül az alatta lévő szem oszlopában; körben a
     * kezdőlánc továbbra is a saját pozícióján áll.
     */
    const stack = scaled.find((item) => item.ids[0] === layer.turningChain[0] && layer.turningChain.length > 0);
    if (stack) {
      const workingFirst = layer.direction === 1 ? below.positions[0] : below.positions[below.positions.length - 1];
      const firstAnchored = scaled.find((item) => item !== stack && item.weight === 1)?.desired;
      const underneath = workingFirst === undefined ? undefined : this.#axis.get(workingFirst);
      if (this.#round && layer.index === 1) stack.desired = this.#oval ? 0 : Math.PI / 2;
      /*
       * A fordulólánc a sor első célpontjának oszlopában áll (PQW-944), sorban
       * és körben is — feltéve, hogy a sor tényleg kihagyja azt a helyet.
       * A korábbi szabály szerint készült minták (a generátorok mai kimenete)
       * oda horgolják az első szemüket, ezért ott a lánc a szövet mellé marad,
       * különben két jel kerülne egy oszlopba.
       */
      else if (layer.turningChainCounts && layer.index >= 2 && underneath !== undefined && firstAnchored !== direction * underneath) {
        stack.desired = direction * underneath;
      } else if (firstAnchored !== undefined) stack.desired = firstAnchored - 2 * stack.half;
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
    // A lapos láncszem ott marad, ahol eddig: a sor szemeinek tetején (PQW-951).
    const chainLine = this.#round ? base + stitchHeight : base - stitchHeight;
    const up = (from: number, by: number) => (this.#round ? from + by : from - by);
    for (const item of scaled) {
      const axis = this.#axis.get(item.ids[0]!)!;
      if (item === stack) {
        /*
         * A fordulólánc ÁTNYÚLIK a sorhatáron (PQW-931). A tulajdonos szava:
         * „a három elemes függőleges láncnak az alsó szeme az 1. sorhoz (alsó
         * sor) tartozik, a másik kettő tartozik a felső sorhoz.” Korábban mind
         * a sor saját sávjában állt, ezért a lánctalpba horgoláskor az egész
         * köteg együtt ugrott fel.
         *
         * A lépésköz zárt alakban adódik, nem becsülve. Két kikötés van:
         * a köteg TETEJE elér a SAJÁT magasságáig (a fordulólánc a sort kezdő
         * szem helyett áll, tehát olyan magas, mint az a szem), és az ELSŐ
         * láncszem teteje pont a sorhatáron ül, vagyis maga a láncszem az
         * alatta lévő sorban van. Ebből: n elem, az i-edik közepe
         * `base + (i - 0.5) * step`, a két kikötés együtt `step = span / (n - 1)`.
         *
         * Így három láncszemnél egy kerül alulra és kettő felülre; kettőnél
         * (félpálca) egy-egy; egynél (rövidpálca) a lánc az alsó sorban áll.
         *
         * A mérce a fordulólánc SAJÁT magassága, nem a soré (PQW-934). A
         * tulajdonos jelentése: a rövidpálcával kezdett sorba tett első pálca
         * megnövelte a sort, és a fordulólánc lecsúszott vele — mérve y=1,0-ről
         * 5,0-re, ahol a jele már kilógott az alsó sáv aljából (a sáv 9-ig tart,
         * a 19,2 magas láncszem 14,6-ig ért). Szó szerint: „az eredeti helyzete
         * jó volt, nem kell magasságot állítani, hiszen ő a rövidpálca
         * magassága lesz — helyesen.”
         */
        const n = item.ids.length;
        const span = chainSpan > 0 ? chainSpan : height;
        const step = n > 1 ? span / (n - 1) : span;
        /*
         * A LÁNCALAP fordulólánca félig az alsó sorban áll: onnan indul a
         * munka, a legalsó láncszeme maga a láncalap vége. A fordult soré
         * viszont teljesen a saját sorában (PQW-946) — a tulajdonos: „a 3. sor
         * teljesen különálló”.
         */
        /*
         * A LÁNCALAP fordulólánca félig az alsó sorban áll: onnan indul a
         * munka, a legalsó láncszeme maga a láncalap vége.
         *
         * A fordult sor lánca viszont a JELÉVEL EGYÜTT a saját sorában marad
         * (PQW-947), egymást nem takarva (PQW-948). Ezért ott a fordulólánc
         * magasságát OSZTJUK szét: n láncszem mindegyike a magasság n-ed
         * részét kapja, a jele alig kisebb ennél — így az alsó a sor
         * talpvonalán ül, a felső a tetején, és látszik köztük a rés. A
         * tulajdonos két jelentése: „még mindig kilóg a 3. sor cellájából”, és
         * „bármi ami egy karikánál több, összecsúszik”.
         */
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
          /*
           * Az ív (PQW-951): a láncszem a húr fölé emelkedik, és a saját
           * érintőjéhez fordul. A görbe parabola, mert a kiemelés zárt
           * alakban adódik belőle: a húr közepén `rise`, a két végén nulla.
           */
          const width = arc.end - arc.start;
          const u = width === 0 ? 0.5 : Math.min(1, Math.max(0, (axis - arc.start) / width));
          const center = this.#point(up(chainLine, -6 + 4 * arc.rise * u * (1 - u)), axis);
          const slope = width === 0 ? 0 : -(4 * arc.rise * (1 - 2 * u)) / width;
          this.#place(id, layer.index, side, 'chain', [], center, Math.atan(slope), arc.size);
          continue;
        }
        // A láncszem a kör mentén fekszik: sokszögben az oldallal párhuzamosan.
        const normal = frameNormal(this.#frame, axis);
        const along = this.#round ? alongRow(normal) : 0;
        this.#place(id, layer.index, side, 'chain', [], this.#point(up(chainLine, -6), axis), along, W * 0.7);
        continue;
      }
      // A hibás célpontú szem talpa a saját oszlopában, ennek a sornak a talpvonalán:
      // a jel normál méretben, a helyén marad, a karjai nem nyúlnak a távoli célpontig (PQW-879).
      const feet = this.#detached.has(id)
        ? graph.nodes.get(id)!.anchors.map(() => this.#point(base, axis))
        : graph.nodes.get(id)!.anchors.map((anchor) => this.#foot(anchor, layer.below, base));
      if (def.kind === 'slip') {
        // Körben a továbbvezető és a záró kúszószem ott látszik, ahová horgolták.
        const center = this.#round && feet[0] ? feet[0] : this.#point(up(base, SLIP_HEIGHT / 2), axis);
        this.#place(id, layer.index, side, 'slip', feet, center, 0, 0);
        continue;
      }
      /*
       * A sor tengelye a szem helyén: a jel ehhez igazítja a keresztvonalát és
       * a tetővonalát. Szaporításnál a szár megdől (a talp a célpont
       * oszlopában, a tető a saját pozíciójában), és ha a kereszt a szárhoz
       * igazodna, a rövidpálca + jele ×-szé fordulna (PQW-931).
       */
      const along = this.#round ? alongRow(frameNormal(this.#frame, axis)) : 0;
      this.#place(id, layer.index, side, 'stitch', feet, this.#point(up(base, this.#stem(def.chainHeight)), axis), along, 0);
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
  #foot(anchor: Anchor, below: number, base: number): Point {
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
    const targetLayer = target === undefined ? below : (this.#graph.layerOf.get(target) ?? below);
    const line = targetLayer >= below ? base : (this.#base[targetLayer + 1] ?? base);
    return this.#point(line, axis);
  }

  /**
   * Egy láncív elrendezése (PQW-951): a láncszemek a két rögzített szem
   * közötti helyet EGYENLŐEN osztják el, és ami vízszintesen nem fér el, az
   * fölfelé megy.
   *
   * A tulajdonos döntése: *„a pálca nem mozdul, a láncszemek tömörödnek, lapos
   * íven mennek körbe”*. Ezért a szomszédok helyét soha nem vesszük el: a
   * láncszemek féltávolsága a rés n-ed részére csökken, a jelük ugyanennyire.
   *
   * Az emelés a HIÁNYBÓL adódik, nem díszként: n láncszem természetes hossza
   * `n · 0,7W`; amivel ez a húrnál hosszabb, annyival domborodik. Parabolánál a
   * többlethossz `8h²/3c`, ebből `h = √(3·c·hiány/8)`. A tulajdonos „lapos”
   * ívet kért, ezért a magasság legfeljebb a sor feléig ér — ami így sem fér
   * el, azt a tömörödés veszi fel.
   */
  #arc(run: Item[], from: number, direction: number, space: number, before: number, stitchHeight: number): Arc {
    const n = run.length;
    const slice = space / n;
    const start = from + direction * before;
    run.forEach((item, i) => {
      item.half = Math.min(item.half, slice / 2);
      item.desired = start + direction * (i + 0.5) * slice;
    });
    const natural = this.#W * 0.7;
    const missing = n * natural - space;
    const sagitta = missing > 0 ? Math.sqrt((3 * space * missing) / 8) : 0;
    return {
      ids: run.map((item) => item.ids[0]!),
      start,
      end: start + direction * space,
      rise: Math.min(sagitta, stitchHeight / 2, CHAIN_HEIGHT),
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
