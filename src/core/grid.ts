/*
 * A rács a vásznon (PQW-874): a szemek helyei cellaként, hogy a diagramon
 * könnyebb legyen tájékozódni, számolni és célozni.
 *
 * A rács a számolt elrendezésből jön (layout.ts), nem fordítva: a cellák a
 * pozíciók helyén állnak, a sávok a sorok és körök talp- és tetővonalát
 * követik. A kézi igazítás csak a rajzon változtat, ezért a rács az igazítás
 * nélküli elrendezésből készül, és nem mozdul vele.
 *
 * A rács típusa a mintatípustól függ (src/ui/pattern-types.ts):
 * - sorrács: soronként egy sáv, a cellák a sor pozícióinál;
 * - koncentrikus rács: körönként egy körgyűrű, a cellák a kör pozícióinál;
 *   sokszögben (négyzet, hatszög, nyolcszög, nagymama-négyzet) a gyűrű is
 *   sokszög, egyenes oldalakkal (polygon.ts, PQW-888);
 * - cellás rács (filé): egyforma szélességű cellák; ez csak az alap, a
 *   teljes változat a PQW-864-ben készül;
 * - szöveges nézet (amigurumi): nincs rács, az írott minta az elsődleges
 *   (PQW-863).
 *
 * Célzás: a készülő sor célpontjai (editor.ts `slots`) két cellából is
 * elérhetők: az alsó sorban a saját cellájukból, a készülő sorban a fölöttük
 * lévőből. Minden más cellában nincs mibe horgolni; ilyenkor érthető üzenet
 * jön, és nem kerül le szem.
 */

import type { WorkContext } from './editor.ts';
import { article } from './hungarian.ts';
import { layoutPattern, type ChartLayout, type LayoutOptions, type NodePlacement, type Point } from './layout.ts';
import { CIRCLE, frameCoords, framePoint, outline, type RoundFrame } from './polygon.ts';
import type { StitchLibrary } from './stitch-library.ts';
import type { NodeId, Pattern } from './types.ts';

export type GridKind = 'rows' | 'rounds' | 'cells' | 'text';

/** Az 5. és a 10. vonal hangsúlyosabb. */
export type Emphasis = 'none' | 'five' | 'ten';

/**
 * Sorban téglalap, körben körcikk; a szög az óramutatóval ellentétesen nő, mint a layout.ts-ben.
 * Sokszögben a körcikk a sokszög alakját követi: `r` a belső sugár, `a` a kerület menti paraméter.
 */
export type GridArea =
  | { readonly kind: 'rect'; readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number }
  | {
      readonly kind: 'sector';
      readonly r0: number;
      readonly r1: number;
      readonly a0: number;
      readonly a1: number;
      /** Sokszögben az alak; körben hiányzik. */
      readonly frame?: RoundFrame;
    };

export interface GridBand {
  /** A sor vagy kör száma; a 0. a láncalap vagy a varázskör. */
  readonly layer: number;
  readonly side: 'right' | 'wrong';
  readonly stitchCount: number;
  /** Váltakozó sorszín. */
  readonly tone: 0 | 1;
  /** A sáv felső (körben külső) vonalának hangsúlya. */
  readonly emphasis: Emphasis;
  /** A most készülő sor sávja. */
  readonly working: boolean;
  readonly area: GridArea;
}

export interface GridCell {
  readonly layer: number;
  /** A cella helye a soron belül, a sor elejétől számolva (0-tól). */
  readonly index: number;
  /** A pozíció szeme; a készülő sor célpont fölötti cellájánál `null`. */
  readonly node: NodeId | null;
  /** A célpont indexe (editor.ts `slots`), ha ide horgolhatsz; különben `null`. */
  readonly slot: number | null;
  readonly center: Point;
  readonly area: GridArea;
  /** A cella záró oldalvonalának hangsúlya: minden 5. és 10. cella után. */
  readonly emphasis: Emphasis;
}

export interface ChartGrid {
  readonly kind: GridKind;
  readonly shape: 'row' | 'round';
  /** A készülő sor vagy kör száma. */
  readonly layer: number;
  readonly bands: readonly GridBand[];
  readonly cells: readonly GridCell[];
  readonly bounds: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number };
}

/** A layout.ts alapértelmezett oszlopszélessége és sorközének fele. */
const DEFAULT_COLUMN = 24;
const HALF_GAP = 3;
/** A láncszem és a varázskör kiterjedése a középpontjától. */
const CHAIN_REACH = 6;
const RING_REACH = 8;
const TAU = 2 * Math.PI;

export function emphasisOf(n: number): Emphasis {
  if (n > 0 && n % 10 === 0) return 'ten';
  if (n > 0 && n % 5 === 0) return 'five';
  return 'none';
}

/**
 * A rács a mintából. A `context` a szerkesztő célpontjait adja (editor.ts
 * `contextOf`); a `kind` a mintatípusból jön.
 */
export function chartGrid(
  pattern: Pattern,
  library: StitchLibrary,
  kind: GridKind,
  context: WorkContext,
  options: LayoutOptions = {},
): ChartGrid {
  const empty: ChartGrid = {
    kind,
    shape: context.shape,
    layer: context.layer,
    bands: [],
    cells: [],
    bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
  };
  const graph = context.graph;
  if (kind === 'text' || !graph) return empty;
  const layout = layoutPattern(withoutPins(pattern), library, options);
  if (layout.nodes.size === 0) return empty;

  // A szegély (PQW-889) nem sor: a sorok rácsa nélküle készül, és a szegély a darab körüli sávokat kapja.
  const borderIndex = graph.layers.findIndex((layer) => layer.border);
  const layers = borderIndex < 0 ? graph.layers : graph.layers.slice(0, borderIndex);
  const input: Input = {
    layout,
    context: borderIndex < 0 ? context : { ...context, layer: borderIndex, slots: [] },
    W: options.columnWidth ?? DEFAULT_COLUMN,
    uniform: kind === 'cells',
    byLayer: groupByLayer(layout),
    positions: layers.map((layer) => layer.positions),
    counts: layers.map((layer) => layer.stitchCount),
    frame: layout.frame ?? CIRCLE,
  };
  const round = graph.layers[0]!.shape === 'round';
  const { bands, cells } = round ? roundGrid(input) : rowGrid(input);
  if (borderIndex >= 0 && !round) bands.push(...borderBands(layout, borderIndex, graph.layers[borderIndex]!.stitchCount, bands));
  return { kind, shape: round ? 'round' : 'row', layer: context.layer, bands, cells, bounds: boundsOf(bands, cells) };
}

/** A szegély sávjai a sorok rácsa körül: felül, alul és a két oldalon, a szegély szemeinek kiterjedéséig (PQW-889). */
function borderBands(layout: ChartLayout, index: number, stitchCount: number, rows: readonly GridBand[]): GridBand[] {
  const points = [...layout.nodes.values()].filter((node) => node.layer === index).flatMap((node) => [node.top, ...node.feet]);
  if (points.length === 0 || rows.length === 0) return [];
  const inner = boundsOf(rows, []);
  const x0 = Math.min(inner.minX, ...points.map((p) => p.x)) - HALF_GAP;
  const x1 = Math.max(inner.maxX, ...points.map((p) => p.x)) + HALF_GAP;
  const y0 = Math.min(inner.minY, ...points.map((p) => p.y)) - HALF_GAP;
  const y1 = Math.max(inner.maxY, ...points.map((p) => p.y)) + HALF_GAP;
  const side = layout.layers[index]?.side ?? 'right';
  const band = (area: { x0: number; x1: number; y0: number; y1: number }): GridBand => ({
    layer: index,
    side,
    stitchCount,
    tone: (index % 2) as 0 | 1,
    emphasis: 'none',
    working: false,
    area: { kind: 'rect', ...area },
  });
  return [
    band({ x0, x1, y0, y1: inner.minY }),
    band({ x0, x1, y0: inner.maxY, y1 }),
    band({ x0, x1: inner.minX, y0: inner.minY, y1: inner.maxY }),
    band({ x0: inner.maxX, x1, y0: inner.minY, y1: inner.maxY }),
  ];
}

function withoutPins(pattern: Pattern): Pattern {
  const piece = pattern.pieces[0];
  if (!piece || !piece.stitches.some((node) => node.pinned)) return pattern;
  const stitches = piece.stitches.map((node) => {
    if (!node.pinned) return node;
    const { pinned: _, ...rest } = node;
    return rest;
  });
  return { ...pattern, pieces: [{ ...piece, stitches }, ...pattern.pieces.slice(1)] };
}

interface Input {
  readonly layout: ChartLayout;
  readonly context: WorkContext;
  readonly W: number;
  readonly uniform: boolean;
  readonly byLayer: readonly (readonly NodePlacement[])[];
  readonly positions: readonly (readonly NodeId[])[];
  readonly counts: readonly number[];
  /** Körben a darab alakja: kör vagy sokszög. */
  readonly frame: RoundFrame;
}

/** Egy oszlop a cellák számolásához: hely a haladás tengelyén (sorban x, körben szög). */
interface Column {
  readonly at: number;
  readonly node: NodeId | null;
  readonly slot: number | null;
  /** A sor elejétől számolt sorrend. */
  readonly order: number;
}

function groupByLayer(layout: ChartLayout): NodePlacement[][] {
  const groups: NodePlacement[][] = [];
  for (const node of layout.nodes.values()) (groups[node.layer] ??= []).push(node);
  return groups;
}

/** A célpontok szemei: szemnél maga, láncívnél a láncszemei, varázskörnél a gyűrű. */
function slotNodes(context: WorkContext): Map<NodeId, number> {
  const map = new Map<NodeId, number>();
  context.slots.forEach((slot, i) => {
    const ids = slot.kind === 'stitch' ? [slot.id] : slot.kind === 'space' ? slot.chains : [slot.node];
    for (const id of ids) if (!map.has(id)) map.set(id, i);
  });
  return map;
}

/** A célpont helye: a szemei tetejének átlaga, mint a vásznon (main.ts). */
function slotPoint(layout: ChartLayout, context: WorkContext, index: number): Point | undefined {
  const slot = context.slots[index]!;
  const ids = slot.kind === 'stitch' ? [slot.id] : slot.kind === 'space' ? slot.chains : [slot.node];
  const points = ids.map((id) => layout.nodes.get(id)?.top).filter((p): p is Point => p !== undefined);
  if (points.length === 0) return undefined;
  return { x: points.reduce((s, p) => s + p.x, 0) / points.length, y: points.reduce((s, p) => s + p.y, 0) / points.length };
}

/**
 * Egy réteg oszlopai: a saját pozíciói, a célpontok sorában pedig azok a
 * célpontszemek is, amelyek máshol állnak (a láncalap be nem horgolt vége
 * az 1. sor fordulóláncába kerül, mégis célpont marad).
 */
function layerColumns(input: Input, layer: number, axis: (p: Point) => number): Column[] {
  const { layout, context } = input;
  const slots = layer === context.layer - 1 ? slotNodes(context) : new Map<NodeId, number>();
  const columns: Column[] = [];
  const seen = new Set<NodeId>();
  (input.positions[layer] ?? []).forEach((id, order) => {
    const node = layout.nodes.get(id);
    if (!node) return;
    seen.add(id);
    columns.push({ at: axis(node.top), node: id, slot: slots.get(id) ?? null, order });
  });
  for (const [id, slot] of slots) {
    const node = layout.nodes.get(id);
    if (seen.has(id) || !node) continue;
    const at = axis(node.top);
    // Az egymás fölötti láncszemek egy oszlopot adnak: az elsőre célzunk.
    if (columns.some((column) => Math.abs(column.at - at) < 1e-6)) continue;
    columns.push({ at, node: id, slot, order: columns.length });
  }
  return columns;
}

/** A készülő sor oszlopai: célpontonként egy, a célpont fölött. */
function workingColumns(input: Input, axis: (p: Point) => number | undefined): Column[] {
  const columns: Column[] = [];
  input.context.slots.forEach((_, slot) => {
    const point = slotPoint(input.layout, input.context, slot);
    const at = point ? axis(point) : undefined;
    if (at === undefined) return;
    columns.push({ at, node: null, slot, order: slot });
  });
  return columns;
}

/* ---- Sorrács ---- */

function rowGrid(input: Input): { bands: GridBand[]; cells: GridCell[] } {
  const { layout, context, W, byLayer } = input;
  const last = input.positions.length - 1;
  const working = context.layer;
  const nodes = (layer: number) => byLayer[layer] ?? [];

  // Felfelé a y csökken. A tető a legmagasabb jel, a talpvonal a legfelső talppont.
  const topOf = (layer: number) => Math.min(...nodes(layer).map((n) => n.top.y - (n.role === 'chain' ? CHAIN_REACH : 0)));
  const bottomOf = (layer: number) => Math.max(...nodes(layer).map((n) => n.top.y + (n.role === 'chain' ? CHAIN_REACH : 0)));
  const baseOf = (layer: number) => {
    const feet = nodes(layer).flatMap((n) => n.feet.map((foot) => foot.y));
    return feet.length > 0 ? Math.min(...feet) : undefined;
  };
  // A sáv alsó vonala: két sor között a sorköz közepe.
  const lower: number[] = [];
  for (let layer = 0; layer <= last; layer += 1) {
    const base = layer === 0 ? undefined : baseOf(layer);
    lower[layer] =
      layer === 0 ? bottomOf(0) + HALF_GAP : base !== undefined ? base + HALF_GAP : topOf(layer - 1) - HALF_GAP;
  }
  const upper = (layer: number) => (layer < last ? lower[layer + 1]! : topOf(layer) - HALF_GAP);

  const bands: GridBand[] = [];
  const cells: GridCell[] = [];
  const addBand = (layer: number, y0: number, y1: number, columns: Column[], extraX: number[], fromStart: 1 | -1) => {
    const spans = input.uniform ? columns.map((c) => [c.at - W / 2, c.at + W / 2] as const) : spansOf(columns, W / 2);
    const xs = [...extraX.flatMap((x) => [x - W / 2, x + W / 2]), ...spans.flat()];
    if (xs.length === 0) return;
    const side = layout.layers[layer]?.side ?? (layer % 2 === 1 ? 'right' : 'wrong');
    bands.push({
      layer,
      side,
      stitchCount: input.counts[layer] ?? 0,
      tone: (layer % 2) as 0 | 1,
      emphasis: emphasisOf(layer),
      working: layer === working,
      area: { kind: 'rect', x0: Math.min(...xs), x1: Math.max(...xs), y0, y1 },
    });
    // A sor elejétől számolt helyek: a haladási irányban.
    const ranked = columns.map((column, i) => ({ column, span: spans[i]! })).sort((a, b) => fromStart * (a.column.at - b.column.at));
    ranked.forEach(({ column, span }, index) => {
      cells.push({
        layer,
        index,
        node: column.node,
        slot: column.slot,
        center: { x: column.at, y: (y0 + y1) / 2 },
        area: { kind: 'rect', x0: span[0], x1: span[1], y0, y1 },
        emphasis: emphasisOf(index + 1),
      });
    });
  };

  const axisX = (p: Point) => p.x;
  for (let layer = 0; layer <= last; layer += 1) {
    const placement = layout.layers[layer];
    // A sor eleje: ahol a sorszám áll. A láncalapnál az 1. sor kezdő oldala.
    const fromStart: 1 | -1 = placement && layer > 0 ? (placement.start.x <= placement.end.x ? 1 : -1) : startOfFirstRow(layout);
    const columns = layer === working ? workingColumns(input, axisX) : layerColumns(input, layer, axisX);
    addBand(layer, upper(layer), lower[layer]!, columns, nodes(layer).map((n) => n.top.x), fromStart);
  }
  if (working > last && context.slots.length > 0) {
    const y1 = upper(last);
    const height = Math.max(DEFAULT_COLUMN, lower[last]! - y1);
    const columns = workingColumns(input, axisX);
    const fromStart: 1 | -1 = columns.length > 1 && columns[0]!.at > columns[columns.length - 1]!.at ? -1 : 1;
    addBand(working, y1 - height, y1, columns, [], fromStart);
  }
  return { bands, cells };
}

/** Az 1. sor haladási iránya: a láncalap két vége közül a sor eleje felől. */
function startOfFirstRow(layout: ChartLayout): 1 | -1 {
  const first = layout.layers[1];
  if (first) return first.start.x <= first.end.x ? 1 : -1;
  const base = layout.layers[0];
  // Az 1. sor a láncalap `end` felőli végéről indul (layout.ts, 03 §1.2).
  return base && base.end.x > base.start.x ? -1 : 1;
}

/** Oszloponként a cella két széle: a szomszédokig félúton, a szélen legfeljebb fél oszlop. */
function spansOf(columns: readonly Column[], half: number): (readonly [number, number])[] {
  const sorted = columns.map((column, i) => ({ at: column.at, i })).sort((a, b) => a.at - b.at);
  const result: (readonly [number, number])[] = [];
  sorted.forEach(({ at, i }, k) => {
    const prev = sorted[k - 1]?.at;
    const next = sorted[k + 1]?.at;
    const edge = (gap: number | undefined) => (gap !== undefined && gap > 1e-6 ? Math.min(half, gap / 2) : half);
    const left = prev !== undefined ? (at - prev) / 2 : edge(next === undefined ? undefined : next - at);
    const right = next !== undefined ? (next - at) / 2 : edge(prev === undefined ? undefined : at - prev);
    result[i] = [at - left, at + right];
  });
  return result;
}

/* ---- Koncentrikus rács ---- */

const normalize = (angle: number) => ((angle % TAU) + TAU) % TAU;
/** A pont kerület menti paramétere; a középpontban 0, mint a szög. */
const aroundOf = (frame: RoundFrame, p: Point) => {
  const { u } = frameCoords(frame, p);
  return Number.isNaN(u) ? 0 : u;
};

function roundGrid(input: Input): { bands: GridBand[]; cells: GridCell[] } {
  const { layout, context, byLayer, frame } = input;
  const last = input.positions.length - 1;
  const working = context.layer;
  const shaped = frame.sides >= 3 ? { frame } : {};
  const reach = (n: NodePlacement) => (n.role === 'ring' ? RING_REACH : n.role === 'chain' ? CHAIN_REACH : 0);
  const outerOf = (layer: number) => Math.max(0, ...(byLayer[layer] ?? []).map((n) => frameCoords(frame, n.top).r + reach(n)));

  const bands: GridBand[] = [];
  const cells: GridCell[] = [];
  const addBand = (layer: number, r0: number, r1: number, columns: Column[]) => {
    const side = layout.layers[layer]?.side ?? 'right';
    bands.push({
      layer,
      side,
      stitchCount: input.counts[layer] ?? 0,
      tone: (layer % 2) as 0 | 1,
      emphasis: emphasisOf(layer),
      working: layer === working,
      area: { kind: 'sector', r0, r1, a0: 0, a1: TAU, ...shaped },
    });
    const arcs = arcsOf(columns);
    columns.forEach((column, i) => {
      const [a0, a1] = arcs[i]!;
      const full = a1 - a0 >= TAU - 1e-9;
      cells.push({
        layer,
        index: column.order,
        node: column.node,
        slot: column.slot,
        center: full && r0 === 0 ? { x: 0, y: 0 } : framePoint(frame, (r0 + r1) / 2, column.at),
        area: { kind: 'sector', r0, r1, a0, a1, ...shaped },
        emphasis: emphasisOf(column.order + 1),
      });
    });
  };

  // A varázskörbe horgolt célpontnak nincs iránya: a cella a teljes kör.
  const slotAngle = (p: Point) => (frameCoords(frame, p).r < 1e-6 ? Number.NaN : aroundOf(frame, p));
  const around = (p: Point) => aroundOf(frame, p);
  let r0 = 0;
  let width = DEFAULT_COLUMN;
  for (let layer = 0; layer <= last; layer += 1) {
    const r1 = Math.max(r0 + CHAIN_REACH, outerOf(layer) + HALF_GAP);
    const columns = layer === working ? workingColumns(input, slotAngle) : layerColumns(input, layer, around);
    addBand(layer, r0, r1, columns);
    width = r1 - r0;
    r0 = r1;
  }
  if (working > last && context.slots.length > 0) {
    addBand(working, r0, r0 + Math.max(DEFAULT_COLUMN, width), workingColumns(input, slotAngle));
  }
  return { bands, cells };
}

/** Oszloponként a körcikk két szöge: a szomszédokig félúton; egyetlen oszlopnál a teljes kör. */
function arcsOf(columns: readonly Column[]): (readonly [number, number])[] {
  const sorted = columns.map((column, i) => ({ at: column.at, i })).sort((a, b) => a.at - b.at);
  const result: (readonly [number, number])[] = [];
  const n = sorted.length;
  sorted.forEach(({ at, i }, k) => {
    if (n === 1 || Number.isNaN(at)) {
      result[i] = Number.isNaN(at) ? [0, TAU] : [at - Math.PI, at + Math.PI];
      return;
    }
    const prev = k === 0 ? sorted[n - 1]!.at - TAU : sorted[k - 1]!.at;
    const next = k === n - 1 ? sorted[0]!.at + TAU : sorted[k + 1]!.at;
    result[i] = [at - (at - prev) / 2, at + (next - at) / 2];
  });
  return result;
}

/* ---- Befoglaló téglalap ---- */

function boundsOf(bands: readonly GridBand[], cells: readonly GridCell[]): ChartGrid['bounds'] {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const { area } of [...bands, ...cells]) {
    if (area.kind === 'rect') {
      minX = Math.min(minX, area.x0);
      maxX = Math.max(maxX, area.x1);
      minY = Math.min(minY, area.y0);
      maxY = Math.max(maxY, area.y1);
    } else {
      // Sokszögben a csúcsok adják a szélét, körben a sugár.
      const corners = area.frame ? outline(area.frame, area.r1) : [];
      const xs = corners.length > 0 ? corners.map((p) => p.x) : [-area.r1, area.r1];
      const ys = corners.length > 0 ? corners.map((p) => p.y) : [-area.r1, area.r1];
      minX = Math.min(minX, ...xs);
      maxX = Math.max(maxX, ...xs);
      minY = Math.min(minY, ...ys);
      maxY = Math.max(maxY, ...ys);
    }
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
}

/**
 * A rajz és a bekapcsolt rács közös befoglaló téglalapja (PQW-887): a rács a
 * készülő sor vagy kör sávjával körben nagyobb a rajznál, ezért az illesztés
 * és az export ekkora részt mutat.
 */
export function chartBounds(layout: ChartLayout, grid: ChartGrid | null | undefined): ChartLayout['bounds'] {
  if (!grid || grid.bands.length === 0) return layout.bounds;
  if (layout.nodes.size === 0) return grid.bounds;
  return {
    minX: Math.min(layout.bounds.minX, grid.bounds.minX),
    minY: Math.min(layout.bounds.minY, grid.bounds.minY),
    maxX: Math.max(layout.bounds.maxX, grid.bounds.maxX),
    maxY: Math.max(layout.bounds.maxY, grid.bounds.maxY),
  };
}

/* ---- Találat és célzás ---- */

export function contains(area: GridArea, p: Point): boolean {
  if (area.kind === 'rect') return p.x >= area.x0 && p.x <= area.x1 && p.y >= area.y0 && p.y <= area.y1;
  const frame = area.frame ?? CIRCLE;
  const { r } = frameCoords(frame, p);
  if (r < area.r0 || r > area.r1) return false;
  if (area.a1 - area.a0 >= TAU - 1e-9) return true;
  return normalize(aroundOf(frame, p) - area.a0) <= area.a1 - area.a0;
}

export type GridHit =
  | { readonly kind: 'cell'; readonly band: GridBand; readonly cell: GridCell }
  | { readonly kind: 'band'; readonly band: GridBand }
  | null;

/** Melyik sáv és cella van a ponton; a készülő sor sávja elöl. */
export function gridHit(grid: ChartGrid, p: Point): GridHit {
  const bands = [...grid.bands].sort((a, b) => Number(b.working) - Number(a.working));
  for (const band of bands) {
    if (!contains(band.area, p)) continue;
    const cell = grid.cells.find((candidate) => candidate.layer === band.layer && contains(candidate.area, p));
    return cell ? { kind: 'cell', band, cell } : { kind: 'band', band };
  }
  return null;
}

export type GridAim =
  | { readonly kind: 'target'; readonly slot: number }
  | { readonly kind: 'refused'; readonly message: string };

/** Mi történik a kattintásra: célpont, vagy üzenet arról, miért nincs itt mibe horgolni. */
export function aimAt(grid: ChartGrid, hit: Exclude<GridHit, null>): GridAim {
  if (hit.kind === 'cell' && hit.cell.slot !== null) return { kind: 'target', slot: hit.cell.slot };
  const round = grid.shape === 'round';
  const current = grid.layer;
  const layer = hit.band.layer;
  const name = (n: number) => (n === 0 ? (round ? 'a varázskör' : 'a láncalap') : `${article(n)} ${n}. ${round ? 'kör' : 'sor'}`);
  const into = (n: number) => (n === 0 && round ? 'a varázskörbe' : `${name(n)} szemeibe`);
  const refused = (message: string): GridAim => ({ kind: 'refused', message: `${message} Nem került le szem.` });

  if (layer >= current) return refused('Ebben a cellában nincs mibe horgolni: alatta nincs szem.');
  if (layer === current - 1) return refused('Ide nem horgolhatsz: ez a hely nem célpont (például nem számító fordulólánc).');
  return refused(`Ez ${name(layer)} egyik helye. Most ${name(current)} készül: csak ${into(current - 1)} horgolhatsz.`);
}
