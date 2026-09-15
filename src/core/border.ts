/*
 * Szegély a sorokban horgolt darab körül (PQW-862, PQW-889; 03 §7.1, §10 H38).
 *
 * - A felső élen szemenként 1, a láncalap mentén láncszemenként 1 szem.
 * - Az oldalakon sorvégenként a sor szeméhez illő szám: rövidpálcás sorvégre 1,
 *   pálcásra 2, kétráhajtásosra 3. A félpálcáé vitatott (1 vagy 2), ezért a
 *   darab tárolja; a tulajdonos döntése szerint az alapértelmezés 2.
 * - A négy sarokba 3 szem kerül a sarokszem helyett, sarkonként tehát 2-vel
 *   több. Összesen `2·W + 2·Σ sorvégi szám + 4·2` (03 §7.1 H).
 *
 * A szegély a gráfban réteg (PQW-889): az utolsó sor fordulása után egy kör,
 * amely a felső él szemeibe, a sorvégekbe (`row-end` célpont, a sor szélső
 * szeme) és a láncalap láncszemeibe horgol, és kúszószemmel az első szemébe
 * záródik. A gráf a sorvégbe horgolt szemekről ismeri fel. A PQW-889 előtti
 * mentésben csak a választás van (`Piece.border`); ott az írott minta a
 * sorokból számol.
 *
 * Most csak egyenes oldalú darab köré készül: minden sor ugyanannyi szem,
 * kihagyott szem nélkül, és a láncalap is ennyi láncszem.
 */

import { buildPieceGraph, type LayerInfo, type PieceGraph } from './graph.ts';
import type { LayerPlacement, NodePlacement, Point } from './layout.ts';
import type { StitchLibrary } from './stitch-library.ts';
import type { Anchor, LayerEvent, NodeId, Pattern, Piece, PieceBorder, StitchDef, StitchGroup, StitchNode } from './types.ts';

/** Ennyi szem kerül egy sarokba (03 §7.1). */
export const BORDER_CORNER = 3;

export const DEFAULT_BORDER: PieceBorder = { stitch: 'sc', hdcRowEnd: 2 };

/** A két sarok között legalább egy szem maradjon a felső és az alsó élen. */
export const MIN_BORDER_WIDTH = 3;

/** Hány szegélyszem jut egy sorvégre a sor szeme szerint: rövidpálca 1, félpálca 1 vagy 2, pálca 2, kétráhajtásos 3. */
export function rowEndStitches(def: StitchDef, hdcRowEnd: PieceBorder['hdcRowEnd']): number {
  if (def.chainHeight <= 1) return 1;
  if (def.chainHeight === 2) return hdcRowEnd;
  return def.chainHeight - 1;
}

export interface BorderCounts {
  /** A felső él szemei a két sarok között. */
  readonly top: number;
  /** A láncalap menti szemek a két sarok között. */
  readonly bottom: number;
  /** Sorvégenként ennyi szem. */
  readonly perRow: number;
  readonly rows: number;
  /** Egy oldal szemei: `perRow · rows`. */
  readonly side: number;
  /** Egy sarok szemei. */
  readonly corner: number;
  /** A teljes szegély szemszáma. */
  readonly total: number;
}

/** A szegély szemei `topWidth` és `bottomWidth` szemes élekkel, `rows` sorral (03 §7.1 H). */
export function borderCounts(topWidth: number, bottomWidth: number, rows: number, perRow: number): BorderCounts {
  const top = topWidth - 2;
  const bottom = bottomWidth - 2;
  const side = perRow * rows;
  return { top, bottom, perRow, rows, side, corner: BORDER_CORNER, total: top + bottom + 2 * side + 4 * BORDER_CORNER };
}

export type BorderResult = { readonly ok: true; readonly counts: BorderCounts } | { readonly ok: false; readonly reason: string };

const fail = (reason: string): BorderResult => ({ ok: false, reason });

/** A szegély rétegének indexe a gráfban, vagy −1, ha nincs (PQW-889). */
export function borderLayerIndex(graph: PieceGraph): number {
  return graph.layers.findIndex((layer) => layer.border);
}

/** A darab szegélye a gráf soraiból (a szegély rétege nélkül); ha a darab köré most nem készíthető, az ok. */
export function borderOf(graph: PieceGraph, border: PieceBorder): BorderResult {
  if (border.stitch !== 'sc') return fail('A szegély most csak rövidpálcás lehet.');
  const rows = graph.layers.slice(1).filter((layer) => !layer.border);
  if (rows.length === 0) return fail('A szegélyhez legalább egy sor kell.');
  if ([graph.layers[0]!, ...rows].some((layer) => layer.shape !== 'row')) return fail('A szegély most csak sorokban horgolt darab köré készül.');
  const width = rows[0]!.stitchCount;
  if (graph.piece.skipped.length > 0 || rows.some((layer) => layer.stitchCount !== width)) {
    return fail('A szegély most csak egyenes oldalú darab köré készül: minden sorban ugyanannyi szem legyen.');
  }
  if (width < MIN_BORDER_WIDTH) return fail(`A szegélyhez a sorban legalább ${MIN_BORDER_WIDTH} szem kell.`);
  const perRow = rows.map((layer) => (layer.firstStitch === null ? Number.NaN : rowEndStitches(graph.defs.get(layer.firstStitch)!, border.hdcRowEnd)));
  if (perRow.some(Number.isNaN) || new Set(perRow).size !== 1) return fail('A szegély most csak egyforma magas sorok köré készül.');
  return { ok: true, counts: borderCounts(width, width, rows.length, perRow[0]!) };
}

/**
 * Egy sor két széle, a sorvég célpontja (PQW-889): az eleje a fordulólánc
 * teteje (ennek híján az első pozíció), a vége az utolsó pozíció.
 */
export function rowEdges(layer: LayerInfo): { readonly start: NodeId; readonly end: NodeId } | null {
  const start = layer.turningChain[layer.turningChain.length - 1] ?? layer.positions[0];
  const end = layer.positions[layer.positions.length - 1];
  return start === undefined || end === undefined ? null : { start, end };
}

/** A szegély egy lépése a horgolás sorrendjében. */
export type BorderStep =
  | { readonly kind: 'corner'; readonly target: NodeId }
  | { readonly kind: 'edge'; readonly target: NodeId }
  | { readonly kind: 'row-end'; readonly target: NodeId; readonly row: number; readonly count: number };

/**
 * A szabályos szegély lépései a `lastRow`. sor után (03 §7.1): az utolsó sor
 * végétől a felső élen visszafelé, le az utolsó sor elejének oldalán (sorvégenként),
 * a láncalap mentén, és fel a másik oldalon. A sarokszembe 3 szem megy.
 *
 * Az r. sor az utolsó sor elejének oldalán az elejével áll, ha az utolsó sortól
 * páros számú sorra van; a láncalapon az 1. sor eleje a horog felőli végen
 * áll (graph.ts).
 */
export function borderSteps(graph: PieceGraph, lastRow: number, border: PieceBorder): BorderStep[] | string {
  const base = graph.layers[0]!;
  const rows = graph.layers.slice(1, lastRow + 1);
  if (rows.length === 0) return 'A szegélyhez legalább egy sor kell.';
  if (base.shape !== 'row' || rows.some((layer) => layer.shape !== 'row' || layer.border)) {
    return 'A szegély most csak sorokban horgolt darab köré készül.';
  }
  const top = rows[rows.length - 1]!.positions;
  if (top.length < MIN_BORDER_WIDTH) return `A szegélyhez a sorban legalább ${MIN_BORDER_WIDTH} szem kell.`;
  if (base.stitches.length !== top.length || rows.some((layer) => layer.positions.length !== top.length)) {
    return 'A szegély most csak egyenes oldalú darab köré készül: minden sorban ugyanannyi szem legyen.';
  }
  const edges = rows.map(rowEdges);
  const perRow = rows.map((layer) => (layer.firstStitch === null ? Number.NaN : rowEndStitches(graph.defs.get(layer.firstStitch)!, border.hdcRowEnd)));
  if (edges.some((edge) => edge === null) || perRow.some(Number.isNaN)) return 'A szegélyhez minden sorban kell szem.';

  const R = rows.length;
  const edge = (r: number, sameAsLast: boolean) => {
    const { start, end } = edges[r - 1]!;
    return (R - r) % 2 === 0 === sameAsLast ? start : end;
  };
  const steps: BorderStep[] = [];
  const along = (ids: readonly NodeId[]) => {
    steps.push({ kind: 'corner', target: ids[0]! });
    for (const id of ids.slice(1, -1)) steps.push({ kind: 'edge', target: id });
    steps.push({ kind: 'corner', target: ids[ids.length - 1]! });
  };
  along([...top].reverse());
  for (let r = R; r >= 1; r -= 1) steps.push({ kind: 'row-end', target: edge(r, true), row: r, count: perRow[r - 1]! });
  along((R - 1) % 2 === 0 ? [...base.stitches].reverse() : [...base.stitches]);
  for (let r = 1; r <= R; r += 1) steps.push({ kind: 'row-end', target: edge(r, false), row: r, count: perRow[r - 1]! });
  return steps;
}

/** A lépések célpontjai szemenként, a horgolás sorrendjében: `into:id`. */
function stepKeys(steps: readonly BorderStep[]): string[] {
  return steps.flatMap((step) => {
    if (step.kind === 'corner') return Array.from({ length: BORDER_CORNER }, () => `stitch:${step.target}`);
    if (step.kind === 'edge') return [`stitch:${step.target}`];
    return Array.from({ length: step.count }, () => `row-end:${step.target}`);
  });
}

/**
 * A szegély hozzáfűzve a darabhoz (PQW-889): 1 lsz, a lépések szerint a
 * rövidpálcák (a sarok 3 rp-je szaporításként), végül kúszószem az első
 * szemébe, a megadott szemszámmal. A darab utolsó sora fordulással ér véget.
 */
export function appendBorder(pattern: Pattern, piece: Piece, library: StitchLibrary, border: PieceBorder): Piece | string {
  if (border.stitch !== 'sc') return 'A szegély most csak rövidpálcás lehet.';
  const last = piece.stitches[piece.stitches.length - 1];
  if (!last || piece.events.find((event) => event.after === last.id)?.kind !== 'turn') return 'A szegély az utolsó sor fordulása után kezdődik.';
  const graph = buildPieceGraph(pattern, piece, library);
  if (borderLayerIndex(graph) >= 0) return 'A darabnak már van szegélye.';
  const counts = borderOf(graph, border);
  if (!counts.ok) return counts.reason;
  const steps = borderSteps(graph, graph.layers.length - 1, border);
  if (typeof steps === 'string') return steps;
  const sc = library.get(border.stitch);
  if (!sc) return 'A szegély szeme nincs a könyvtárban.';

  const stitches: StitchNode[] = [...piece.stitches];
  const groups: StitchGroup[] = [...piece.groups];
  const numberOf = (ids: readonly string[], prefix: string) =>
    Math.max(0, ...ids.map((id) => (new RegExp(`^${prefix}(\\d+)$`).exec(id) ? Number(id.slice(prefix.length)) : 0)));
  let nextNode = numberOf(stitches.map((node) => node.id), 'n');
  let nextGroup = numberOf(groups.map((group) => group.id), 'g');
  const add = (def: string, anchors: readonly Anchor[]): NodeId => {
    nextNode += 1;
    const id = `n${nextNode}`;
    stitches.push({ id, def, prev: stitches[stitches.length - 1]?.id ?? null, anchors });
    return id;
  };
  const into = (id: NodeId): Anchor => ({ into: 'stitch', id, mode: 'both-loops' });

  for (let i = 0; i < sc.turningChain; i += 1) add('ch', []);
  let first: NodeId | undefined;
  for (const step of steps) {
    if (step.kind === 'row-end') {
      for (let k = 0; k < step.count; k += 1) {
        const id = add(sc.id, [{ into: 'row-end', id: step.target }]);
        first ??= id;
      }
    } else if (step.kind === 'edge') {
      const id = add(sc.id, [into(step.target)]);
      first ??= id;
    } else {
      const members = Array.from({ length: BORDER_CORNER }, () => add(sc.id, [into(step.target)]));
      first ??= members[0];
      nextGroup += 1;
      groups.push({ id: `g${nextGroup}`, def: `inc-${BORDER_CORNER}${sc.id}`, members });
    }
  }
  const join = add('sl-st', [into(first!)]);
  const events: LayerEvent[] = [...piece.events, { after: join, kind: 'join-slip', statedCount: counts.counts.total }];
  return { ...piece, stitches, groups, events, border };
}

/**
 * A gráf szegélyrétege a szabályos szegély-e (PQW-889): pontosan a lépések
 * szerinti célpontokba, rövidpálcával, 1 lsz-es kezdéssel és kúszószemes
 * zárással. Ha igen, a szemszámok az írott mintához; ha nem, az ok.
 */
export function borderOfLayer(graph: PieceGraph, index: number, border: PieceBorder): BorderResult {
  const counts = borderOf(graph, border);
  if (!counts.ok) return counts;
  const steps = borderSteps(graph, index - 1, border);
  if (typeof steps === 'string') return fail(steps);
  const layer = graph.layers[index]!;
  const body = layer.stitches.filter((id) => !layer.turningChain.includes(id) && id !== layer.joinSlip);
  const actual = body.map((id) => {
    const node = graph.nodes.get(id)!;
    return node.def === border.stitch && node.anchors.length === 1 ? `${node.anchors[0]!.into}:${node.anchors[0]!.id}` : '?';
  });
  const regular =
    layer.turningChain.length === (graph.defs.get(body[0] ?? '')?.turningChain ?? -1) &&
    layer.closing?.kind === 'join-slip' &&
    layer.joinSlip !== null &&
    actual.join(' ') === stepKeys(steps).join(' ');
  return regular ? counts : fail('A szegély eltér a szabályos szegélytől (sarkonként 3, sorvégenként a sor szeme szerint), ezért még nem írható ki.');
}

/* ---- Elhelyezés a darab körül ---- */

/** A láncszem kiterjedése a középpontjától, mint a layout.ts-ben. */
const CHAIN_REACH = 6;

/**
 * A szegély rétegének helye a már elhelyezett sorok körül (PQW-889). A felső
 * él szemei a sor tetején felfelé, a láncalapéi lefelé, a sorvégbe horgolt
 * szemek a sor szélén kifelé állnak, a sor magasságában elosztva; a sarok
 * 3 szeme legyezőben fordul. A sorokban horgolt darabot a layout.ts rakja ki,
 * ez csak hozzáteszi a szegélyt.
 */
export function placeBorder(
  graph: PieceGraph,
  nodes: Map<NodeId, NodePlacement>,
  layers: LayerPlacement[],
  W: number,
  stem: (chainHeight: number) => number,
): void {
  const index = borderLayerIndex(graph);
  if (index < 0 || graph.layers[0]!.shape !== 'row') return;
  const layer = graph.layers[index]!;
  const placed = [...nodes.values()].filter((node) => node.layer < index);
  if (placed.length === 0) return;
  const xs = placed.map((node) => node.top.x);
  const center = (Math.min(...xs) + Math.max(...xs)) / 2;
  const outward = (x: number) => (x >= center ? 1 : -1);
  const length = stem(layer.firstStitch ? graph.defs.get(layer.firstStitch)!.chainHeight : 1);

  const bands = new Map<number, { bottom: number; top: number; left: number; right: number }>();
  const band = (row: number) => {
    let found = bands.get(row);
    if (!found) {
      const own = placed.filter((node) => node.layer === row);
      found = {
        bottom: Math.max(...own.flatMap((node) => [node.top.y, ...node.feet.map((foot) => foot.y)])),
        top: Math.min(...own.map((node) => node.top.y)),
        left: Math.min(...own.map((node) => node.top.x)),
        right: Math.max(...own.map((node) => node.top.x)),
      };
      bands.set(row, found);
    }
    return found;
  };

  const body = layer.stitches.filter((id) => !layer.turningChain.includes(id) && id !== layer.joinSlip);
  const keyOf = (id: NodeId) => {
    const anchor = graph.nodes.get(id)!.anchors[0];
    return anchor ? `${anchor.into}:${anchor.id}` : '';
  };
  const sameTarget = new Map<string, NodeId[]>();
  for (const id of body) sameTarget.set(keyOf(id), [...(sameTarget.get(keyOf(id)) ?? []), id]);

  const place = (id: NodeId, role: NodePlacement['role'], feet: readonly Point[], top: Point, angle = 0, size = 0) => {
    nodes.set(id, { id, def: graph.nodes.get(id)!.def, layer: index, side: layer.side, role, feet, top, angle, size });
  };

  body.forEach((id, position) => {
    const anchor = graph.nodes.get(id)!.anchors[0];
    const target = anchor && anchor.into !== 'space' && anchor.into !== 'ring' ? nodes.get(anchor.id) : undefined;
    if (!anchor || !target) return;
    const group = sameTarget.get(keyOf(id))!;
    const k = group.indexOf(id);
    const n = group.length;
    if (anchor.into === 'row-end') {
      const row = graph.layerOf.get(anchor.id) ?? 1;
      const { bottom, top, left, right } = band(row);
      const s = outward(target.top.x);
      const y = bottom + ((k + 1) / (n + 1)) * (top - bottom);
      const foot = { x: (s > 0 ? right : left) + (s * W) / 2, y };
      place(id, 'stitch', [foot], { x: foot.x + s * length, y });
      return;
    }
    const down = graph.layerOf.get(anchor.id) === 0;
    const v = down ? 1 : -1;
    const foot = down ? { x: target.top.x, y: target.top.y + CHAIN_REACH } : target.top;
    if (n === 1) {
      place(id, 'stitch', [foot], { x: foot.x, y: foot.y + v * length });
      return;
    }
    // Sarok: legyező a vízszintes (kifelé) és a függőleges között. Ha utána az oldal jön, a függőlegestől indul.
    const after = body[position + n - k];
    const toSide = after !== undefined && graph.nodes.get(after)!.anchors[0]?.into === 'row-end';
    const t = k / (n - 1);
    const angle = ((toSide ? t : 1 - t) * Math.PI) / 2;
    const s = outward(target.top.x);
    place(id, 'stitch', [foot], { x: foot.x + s * Math.sin(angle) * length, y: foot.y + v * Math.cos(angle) * length });
  });

  const first = body[0] === undefined ? undefined : nodes.get(body[0]);
  if (!first) return;
  const firstFoot = first.feet[0] ?? first.top;
  const s = outward(firstFoot.x);
  layer.turningChain.forEach((id, i) => {
    place(id, 'chain', [], { x: firstFoot.x + s * W * (0.9 + 0.6 * i), y: firstFoot.y - W * 0.6 }, Math.PI / 2, W * 0.6);
  });
  if (layer.joinSlip) place(layer.joinSlip, 'slip', [first.top], { x: first.top.x + s * 6, y: first.top.y - 6 });
  const label = { x: firstFoot.x + s * W * 1.8, y: firstFoot.y - W };
  layers[index] = { index, shape: layer.shape, side: layer.side, stitchCount: layer.stitchCount, start: label, end: { x: label.x + s * W, y: label.y } };
}
