/*
 * Szegély a sorokban horgolt darab körül (PQW-862, PQW-889, PQW-898; 03 §7.1, §10 H38–H39).
 *
 * - A felső élen szemenként 1, a láncalap mentén láncszemenként 1 szem.
 * - Az oldalakon sorvégenként a sor szeméhez illő szám: rövidpálcás sorvégre 1,
 *   pálcásra 2, kétráhajtásosra 3. A félpálcáé vitatott (1 vagy 2), ezért a
 *   darab tárolja; a tulajdonos döntése szerint az alapértelmezés 2.
 * - Ferde élű darabnál (háromszög, trapéz, rombusz; PQW-898) az oldal a
 *   sorvégek mellett a lépcsők kitett szemeit is követi: a sor azon szélső
 *   szemeibe, amelyekbe a következő sor nem horgolt (meghagyott szemek), 1-1
 *   szem kerül.
 * - A felső él és a láncalap két végén 3 szem a sarokszembe; ha az él egyetlen
 *   szem (a háromszög csúcsa), ott egy sarok van. Téglalapnál összesen
 *   `2·W + 2·Σ sorvégi szám + 4·2` (03 §7.1 H).
 * - Igazítás a következő szegélysor „X többszöröse + Y” ismétléséhez (03 §7.1 H,
 *   §10 H39): a sarkok közötti élek szemszáma a legközelebbi ilyen számra áll
 *   (félúton felfelé). A különbség egyenletesen elosztva: az oldalon a
 *   sorvégeken ±1, a felső élen és a láncalapon 2 szem egy szembe, illetve
 *   kihagyott szem (03 §3.4).
 *
 * A szegély a gráfban réteg (PQW-889): az utolsó sor fordulása után egy kör,
 * amely a felső él szemeibe, a sorvégekbe (`row-end` célpont, a sor szélső
 * szeme), a lépcsők szemeibe és a láncalap láncszemeibe horgol, és kúszószemmel
 * az első szemébe záródik. A gráf a sorvégbe horgolt szemekről ismeri fel. A
 * PQW-889 előtti mentésben csak a választás van (`Piece.border`); ott az írott
 * minta a sorokból számol.
 *
 * Láncos hosszabbítással (nagyon meredeken) szélesedő él köré is készül (PQW-902):
 * a hosszabbítás láncszemei az élen állnak, mindegyik egy szegélyszemet kap, mint
 * a láncalap láncszemei. A simán alakított ferde élen a hosszabb élre jutó pótlás
 * az arány-módszerből jön (03 §7.1): az él hossza soronként `hypot(sorvég, eltolás)`,
 * és a többlet egyenletesen oszlik el a sorvégek között.
 */

import { buildPieceGraph, type LayerInfo, type PieceGraph } from './graph.ts';
import type { LayerPlacement, NodePlacement, Point } from './layout.ts';
import type { StitchLibrary } from './stitch-library.ts';
import type { Anchor, BorderRepeat, LayerEvent, NodeId, Pattern, Piece, PieceBorder, StitchDef, StitchGroup, StitchNode } from './types.ts';

/** Ennyi szem kerül egy sarokba (03 §7.1). */
export const BORDER_CORNER = 3;

export const DEFAULT_BORDER: PieceBorder = { stitch: 'sc', hdcRowEnd: 2 };

/** Hány szegélyszem jut egy sorvégre a sor szeme szerint: rövidpálca 1, félpálca 1 vagy 2, pálca 2, kétráhajtásos 3. */
export function rowEndStitches(def: StitchDef, hdcRowEnd: PieceBorder['hdcRowEnd']): number {
  if (def.chainHeight <= 1) return 1;
  if (def.chainHeight === 2) return hdcRowEnd;
  return def.chainHeight - 1;
}

/** A szegély egyik oldala a sarkok között. */
export interface BorderSide {
  /** A sorvégekbe horgolt szemek. */
  readonly rowEnds: number;
  /** A lépcsők meghagyott szemeibe horgolt szemek (PQW-898). */
  readonly exposed: number;
  /** Az igazítás miatt eggyel több (+) vagy kevesebb (−) szemet kapó sorvégek száma. */
  readonly adjusted: number;
  readonly total: number;
}

export interface BorderCounts {
  /** A felső él szemei a sarkok között. */
  readonly top: number;
  /** A láncalap menti szemek a sarkok között. */
  readonly bottom: number;
  /** Sorvégenként ennyi szem (az 1. sor szeme szerint). */
  readonly perRow: number;
  readonly rows: number;
  /** Az első oldal szemei; téglalapnál `perRow · rows`. */
  readonly side: number;
  /** Egy sarok szemei. */
  readonly corner: number;
  /** A teljes szegély szemszáma. */
  readonly total: number;
  /** A két oldal: a felső él után lefelé, és a láncalap után felfelé. */
  readonly sides: readonly [BorderSide, BorderSide];
  /** A felső él és a láncalap sarkainak száma: 2, vagy 1 a csúcsnál. */
  readonly topCorners: 1 | 2;
  readonly bottomCorners: 1 | 2;
  /** Az igazítás a felső élen és a láncalapon: +n szembe 2 szem, −n kihagyott szem. */
  readonly topAdjusted: number;
  readonly bottomAdjusted: number;
  /** A következő szegélysor ismétlése, amelyhez az élek igazodnak; hiányában `null`. */
  readonly repeat: BorderRepeat | null;
}

/** A szegély szemei `topWidth` és `bottomWidth` szemes élekkel, `rows` sorral, egyenes oldalakkal (03 §7.1 H). */
export function borderCounts(topWidth: number, bottomWidth: number, rows: number, perRow: number): BorderCounts {
  const top = topWidth - 2;
  const bottom = bottomWidth - 2;
  const side = perRow * rows;
  const sideCounts: BorderSide = { rowEnds: side, exposed: 0, adjusted: 0, total: side };
  return {
    top,
    bottom,
    perRow,
    rows,
    side,
    corner: BORDER_CORNER,
    total: top + bottom + 2 * side + 4 * BORDER_CORNER,
    sides: [sideCounts, sideCounts],
    topCorners: 2,
    bottomCorners: 2,
    topAdjusted: 0,
    bottomAdjusted: 0,
    repeat: null,
  };
}

export type BorderResult = { readonly ok: true; readonly counts: BorderCounts } | { readonly ok: false; readonly reason: string };

const fail = (reason: string): BorderResult => ({ ok: false, reason });

/** A szegély rétegének indexe a gráfban, vagy −1, ha nincs (PQW-889). */
export function borderLayerIndex(graph: PieceGraph): number {
  return graph.layers.findIndex((layer) => layer.border);
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

/** A szegély egy lépése a horgolás sorrendjében; az él szeme 0, 1 vagy 2 szemet kaphat (igazítás). */
export type BorderStep =
  | { readonly kind: 'corner'; readonly target: NodeId }
  | { readonly kind: 'edge'; readonly target: NodeId; readonly count: number }
  | { readonly kind: 'row-end'; readonly target: NodeId; readonly row: number; readonly count: number };

interface BorderPlan {
  readonly steps: readonly BorderStep[];
  readonly counts: BorderCounts;
}

/** Egy lépés szemszáma: a sarok 3. */
const stepCount = (step: BorderStep) => (step.kind === 'corner' ? BORDER_CORNER : step.count);

/** Az ismétléshez kellő változás: `n + d ≡ Y (mod X)`, a legkisebb |d|, félúton felfelé. */
function repeatDelta(n: number, repeat: BorderRepeat): number {
  const up = (((repeat.edge - n) % repeat.width) + repeat.width) % repeat.width;
  const down = up - repeat.width;
  return up === 0 ? 0 : -down < up ? down : up;
}

/** `m` egyenletesen elosztott index `length` elem közül. */
function evenly(length: number, m: number): number[] {
  return Array.from({ length: m }, (_, j) => Math.floor(((j + 0.5) * length) / m));
}

/**
 * A szegély terve a `lastRow`. sor után (03 §7.1): az utolsó sor végétől a
 * felső élen visszafelé, le az utolsó sor elejének oldalán (sorvégenként, a
 * lépcsők meghagyott szemeivel), a láncalap mentén, és fel a másik oldalon.
 *
 * Az r. sor az utolsó sor elejének oldalán az elejével áll, ha az utolsó sortól
 * páros számú sorra van; a láncalapon az 1. sor eleje a horog felőli végen
 * áll (graph.ts).
 */
function borderPlan(graph: PieceGraph, lastRow: number, border: PieceBorder): BorderPlan | string {
  if (border.stitch !== 'sc') return 'A szegély most csak rövidpálcás lehet.';
  const base = graph.layers[0]!;
  const rows = graph.layers.slice(1, lastRow + 1);
  if (rows.length === 0) return 'A szegélyhez legalább egy sor kell.';
  if (base.shape !== 'row' || rows.some((layer) => layer.shape !== 'row' || layer.border)) {
    return 'A szegély most csak sorokban horgolt darab köré készül.';
  }
  const top = rows[rows.length - 1]!.positions;
  if (top.length === 0 || base.stitches.length === 0) return 'A szegélyhez minden sorban kell szem.';
  const edges = rows.map(rowEdges);
  const perRow = rows.map((layer) => (layer.firstStitch === null ? Number.NaN : rowEndStitches(graph.defs.get(layer.firstStitch)!, border.hdcRowEnd)));
  if (edges.some((edge) => edge === null) || perRow.some(Number.isNaN)) return 'A szegélyhez minden sorban kell szem.';

  // A sorok szemei, amelyeket egy későbbi sor fed: belehorgolt, vagy a számító fordulólánca ül rajta (03 §1.3,
  // layout.ts). A többi szélső szem kitett: a lépcső teteje.
  const worked = new Set<NodeId>();
  for (const node of graph.nodes.values()) {
    const layer = graph.layerOf.get(node.id);
    if (layer === undefined || layer < 1 || layer > lastRow) continue;
    for (const anchor of node.anchors) {
      if (anchor.into === 'stitch') worked.add(anchor.id);
      else if (anchor.into === 'space') for (const chain of graph.spaces.get(anchor.id)?.chains ?? []) worked.add(chain);
    }
  }
  rows.forEach((layer, i) => {
    const below = i === 0 ? null : rows[i - 1]!;
    if (!below || !layer.turningChainCounts) return;
    const seat = layer.direction === 1 ? below.positions[0] : below.positions[below.positions.length - 1];
    if (seat !== undefined) worked.add(seat);
  });
  /** Az r. sorhoz tartozó lépcsőszemek száma mindkét szélen (az arány-módszerhez, PQW-902). */
  const exposedCount = (r: number): number => (r >= 1 && r <= rows.length ? exposed(r, true).length + exposed(r, false).length : 0);

  /** Az r. sor meghagyott szemei a sor elején vagy végén, a széltől befelé haladva. */
  const exposed = (r: number, atStart: boolean): NodeId[] => {
    const positions = rows[r - 1]!.positions;
    const run: NodeId[] = [];
    if (atStart) for (let i = 0; i < positions.length && !worked.has(positions[i]!); i += 1) run.push(positions[i]!);
    else for (let i = positions.length - 1; i >= 0 && !worked.has(positions[i]!); i -= 1) run.push(positions[i]!);
    return run;
  };

  /**
   * Az r. sor végén álló láncos hosszabbítás láncszemei fonalsorrendben
   * (PQW-902): a sor utolsó pozíciói, amelyek egy láncívhez tartoznak. A
   * következő sor ezekbe horgol, a külső hurkuk pedig az élen marad.
   */
  const extension = (r: number): NodeId[] => {
    const positions = rows[r - 1]!.positions;
    const chains: NodeId[] = [];
    for (let i = positions.length - 1; i >= 0 && graph.spaceOfChain.has(positions[i]!); i -= 1) chains.unshift(positions[i]!);
    return chains;
  };
  /** A sor két széle: a vége a láncos hosszabbítás előtti utolsó pozíció (PQW-902). */
  const edgeOf = (r: number): { start: NodeId; end: NodeId } => {
    const { start, end } = edges[r - 1]!;
    const chains = extension(r);
    if (chains.length === 0) return { start, end };
    const positions = rows[r - 1]!.positions;
    return { start, end: positions[positions.length - 1 - chains.length] ?? start };
  };

  const R = rows.length;
  /** Az r. sor eleje az utolsó sor elejének oldalán (az „A” oldalon) áll-e. */
  const startOnA = (r: number) => (R - r) % 2 === 0;
  const along = (ids: readonly NodeId[]): BorderStep[] =>
    ids.length === 1
      ? [{ kind: 'corner', target: ids[0]! }]
      : [
          { kind: 'corner', target: ids[0]! },
          ...ids.slice(1, -1).map((target): BorderStep => ({ kind: 'edge', target, count: 1 })),
          { kind: 'corner', target: ids[ids.length - 1]! },
        ];

  const topSteps = along([...top].reverse());
  const sideA: BorderStep[] = [];
  for (let r = R; r >= 1; r -= 1) {
    const { start, end } = edgeOf(r);
    // Lefelé haladva a sor végi láncos hosszabbítás kívülről befelé következik, a sorvég előtt (PQW-902).
    if (!startOnA(r)) for (const target of [...extension(r)].reverse()) sideA.push({ kind: 'edge', target, count: 1 });
    sideA.push({ kind: 'row-end', target: startOnA(r) ? start : end, row: r, count: perRow[r - 1]! });
    // Lefelé: az alatta lévő sor lépcsője a széltől befelé meghagyott szemekkel, belülről kifelé.
    if (r > 1) for (const target of exposed(r - 1, startOnA(r - 1)).reverse()) sideA.push({ kind: 'edge', target, count: 1 });
  }
  const bottomSteps = along((R - 1) % 2 === 0 ? [...base.stitches].reverse() : [...base.stitches]);
  const sideB: BorderStep[] = [];
  for (let r = 1; r <= R; r += 1) {
    const { start, end } = edgeOf(r);
    sideB.push({ kind: 'row-end', target: startOnA(r) ? end : start, row: r, count: perRow[r - 1]! });
    // Felfelé haladva a sor végi láncos hosszabbítás a sorvég után, befelé kifelé következik (PQW-902).
    if (startOnA(r)) for (const target of extension(r)) sideB.push({ kind: 'edge', target, count: 1 });
    // Felfelé: a sor lépcsője kívülről befelé.
    if (r < R) for (const target of exposed(r, !startOnA(r))) sideB.push({ kind: 'edge', target, count: 1 });
  }

  /**
   * A ferde él hosszabb, mint a sorok magassága: a pótlás az arány-módszerből
   * (03 §7.1, PQW-902). Soronként az él hossza szegélyszemekben mérve
   * `hypot(sorvégre jutó szem, oldalirányú eltolás)`; az összegük és a sorvégek
   * összegének különbsége oszlik el egyenletesen a sorvégek között. A lépcsős
   * élen a kitett szemek és a láncos hosszabbítás már külön szemet kapnak,
   * ezért ott nincs pótlás.
   */
  const ratioAllowance = (steps: BorderStep[]): void => {
    const ends = steps.flatMap((step, i) => (step.kind === 'row-end' ? [i] : []));
    if (ends.length === 0) return;
    let ideal = 0;
    let plain = 0;
    for (const i of ends) {
      const step = steps[i] as Extract<BorderStep, { kind: 'row-end' }>;
      const previous = rows[step.row - 2];
      const current = rows[step.row - 1]!;
      // A sor szemszámának változása, amennyit a lépcső és a hosszabbítás nem magyaráz: a sima alakítás eltolása.
      const change = previous ? Math.abs(current.positions.length - previous.positions.length) : 0;
      const stairs = exposedCount(step.row) + extension(step.row).length + (previous ? extension(step.row - 1).length : 0);
      const shift = Math.max(0, change - stairs) / 2;
      ideal += Math.hypot(step.count, shift);
      plain += step.count;
    }
    const extra = Math.round(ideal) - plain;
    if (extra <= 0) return;
    for (const k of evenly(ends.length, Math.min(extra, ends.length))) {
      const step = steps[ends[k]!] as Extract<BorderStep, { kind: 'row-end' }>;
      steps[ends[k]!] = { ...step, count: step.count + 1 };
    }
  };
  ratioAllowance(sideA);
  ratioAllowance(sideB);

  // Igazítás a következő szegélysor ismétléséhez: élenként a sarkok közötti szemszám.
  const adjusted = { top: 0, bottom: 0, sideA: 0, sideB: 0 };
  const alignEdge = (steps: BorderStep[]): number => {
    const middle = steps.flatMap((step, i) => (step.kind === 'edge' ? [i] : []));
    const n = middle.reduce((sum, i) => sum + stepCount(steps[i]!), 0);
    const delta = border.repeat && n > 0 ? repeatDelta(n, border.repeat) : 0;
    const chosen = evenly(middle.length, Math.min(Math.abs(delta), middle.length));
    for (const k of chosen) steps[middle[k]!] = { ...(steps[middle[k]!] as Extract<BorderStep, { kind: 'edge' }>), count: delta > 0 ? 2 : 0 };
    return Math.sign(delta) * chosen.length;
  };
  const alignSide = (steps: BorderStep[]): number => {
    const ends = steps.flatMap((step, i) => (step.kind === 'row-end' ? [i] : []));
    const n = steps.reduce((sum, step) => sum + stepCount(step), 0);
    const delta = border.repeat && n > 0 ? repeatDelta(n, border.repeat) : 0;
    const chosen = evenly(ends.length, Math.min(Math.abs(delta), ends.length));
    for (const k of chosen) {
      const step = steps[ends[k]!] as Extract<BorderStep, { kind: 'row-end' }>;
      steps[ends[k]!] = { ...step, count: Math.max(0, step.count + Math.sign(delta)) };
    }
    return Math.sign(delta) * chosen.length;
  };
  if (border.repeat) {
    adjusted.top = alignEdge(topSteps);
    adjusted.sideA = alignSide(sideA);
    adjusted.bottom = alignEdge(bottomSteps);
    adjusted.sideB = alignSide(sideB);
  }

  const sum = (steps: readonly BorderStep[], kind?: BorderStep['kind']) =>
    steps.reduce((total, step) => total + (kind === undefined || step.kind === kind ? stepCount(step) : 0), 0);
  const sideOf = (steps: readonly BorderStep[], change: number): BorderSide => ({
    rowEnds: sum(steps, 'row-end'),
    exposed: sum(steps, 'edge'),
    adjusted: change,
    total: sum(steps),
  });
  const steps = [...topSteps, ...sideA, ...bottomSteps, ...sideB];
  const sides: [BorderSide, BorderSide] = [sideOf(sideA, adjusted.sideA), sideOf(sideB, adjusted.sideB)];
  return {
    steps,
    counts: {
      top: sum(topSteps, 'edge'),
      bottom: sum(bottomSteps, 'edge'),
      perRow: perRow[0]!,
      rows: R,
      side: sides[0].total,
      corner: BORDER_CORNER,
      total: sum(steps),
      sides,
      topCorners: topSteps.filter((step) => step.kind === 'corner').length as 1 | 2,
      bottomCorners: bottomSteps.filter((step) => step.kind === 'corner').length as 1 | 2,
      topAdjusted: adjusted.top,
      bottomAdjusted: adjusted.bottom,
      repeat: border.repeat ?? null,
    },
  };
}

/** A szabályos szegély lépései a `lastRow`. sor után; ha a darab köré most nem készíthető, az ok. */
export function borderSteps(graph: PieceGraph, lastRow: number, border: PieceBorder): BorderStep[] | string {
  const plan = borderPlan(graph, lastRow, border);
  return typeof plan === 'string' ? plan : [...plan.steps];
}

/** A darab szegélye a gráf soraiból (a szegély rétege nélkül); ha a darab köré most nem készíthető, az ok. */
export function borderOf(graph: PieceGraph, border: PieceBorder): BorderResult {
  const index = borderLayerIndex(graph);
  const plan = borderPlan(graph, index >= 0 ? index - 1 : graph.layers.length - 1, border);
  return typeof plan === 'string' ? fail(plan) : { ok: true, counts: plan.counts };
}

/** A lépések célpontjai szemenként, a horgolás sorrendjében: `into:id`. */
function stepKeys(steps: readonly BorderStep[]): string[] {
  return steps.flatMap((step) => Array.from({ length: stepCount(step) }, () => `${step.kind === 'row-end' ? 'row-end' : 'stitch'}:${step.target}`));
}

/**
 * A szegély hozzáfűzve a darabhoz (PQW-889): 1 lsz, a lépések szerint a
 * rövidpálcák (a sarok 3 rp-je és az igazítás 2 rp-je szaporításként), végül
 * kúszószem az első szemébe, a megadott szemszámmal. A darab utolsó sora
 * fordulással ér véget.
 */
export function appendBorder(pattern: Pattern, piece: Piece, library: StitchLibrary, border: PieceBorder): Piece | string {
  if (border.stitch !== 'sc') return 'A szegély most csak rövidpálcás lehet.';
  const last = piece.stitches[piece.stitches.length - 1];
  if (!last || piece.events.find((event) => event.after === last.id)?.kind !== 'turn') return 'A szegély az utolsó sor fordulása után kezdődik.';
  const graph = buildPieceGraph(pattern, piece, library);
  if (borderLayerIndex(graph) >= 0) return 'A darabnak már van szegélye.';
  const plan = borderPlan(graph, graph.layers.length - 1, border);
  if (typeof plan === 'string') return plan;
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
  for (const step of plan.steps) {
    const count = stepCount(step);
    if (count === 0) continue;
    const anchor: Anchor = step.kind === 'row-end' ? { into: 'row-end', id: step.target } : into(step.target);
    const members = Array.from({ length: count }, () => add(sc.id, [anchor]));
    first ??= members[0];
    // Egy szembe horgolt több szem szaporítás; a sorvégbe horgoltak nem.
    if (step.kind !== 'row-end' && count > 1) {
      nextGroup += 1;
      groups.push({ id: `g${nextGroup}`, def: `inc-${count}${sc.id}`, members });
    }
  }
  const join = add('sl-st', [into(first!)]);
  const events: LayerEvent[] = [...piece.events, { after: join, kind: 'join-slip', statedCount: plan.counts.total }];
  return { ...piece, stitches, groups, events, border };
}

/**
 * A gráf szegélyrétege a szabályos szegély-e (PQW-889): pontosan a lépések
 * szerinti célpontokba, rövidpálcával, 1 lsz-es kezdéssel és kúszószemes
 * zárással. Ha igen, a szemszámok az írott mintához; ha nem, az ok.
 */
export function borderOfLayer(graph: PieceGraph, index: number, border: PieceBorder): BorderResult {
  const plan = borderPlan(graph, index - 1, border);
  if (typeof plan === 'string') return fail(plan);
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
    actual.join(' ') === stepKeys(plan.steps).join(' ');
  return regular
    ? { ok: true, counts: plan.counts }
    : fail('A szegély eltér a szabályos szegélytől (sarkonként 3, sorvégenként a sor szeme szerint), ezért még nem írható ki.');
}

/* ---- Elhelyezés a darab körül ---- */

/** A láncszem kiterjedése a középpontjától, mint a layout.ts-ben. */
const CHAIN_REACH = 6;

/**
 * A szegély rétegének helye a már elhelyezett sorok körül (PQW-889). A felső
 * él és a lépcsők szemei a sor tetején felfelé, a láncalapéi lefelé, a
 * sorvégbe horgolt szemek a sor szélén kifelé állnak, a sor magasságában
 * elosztva; a sarok 3 szeme legyezőben fordul. A sorokban horgolt darabot a
 * layout.ts rakja ki, ez csak hozzáteszi a szegélyt. A szegély nem sor: a
 * helye „szegély” feliratot kap, sorszámot nem (PQW-897).
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
    if (n < BORDER_CORNER) {
      // Az igazítás 2 szeme egy szembe (PQW-898): kis V a szem fölött, illetve alatt.
      const spread = ((k - (n - 1) / 2) * W) / 2;
      place(id, 'stitch', [foot], { x: foot.x + spread, y: foot.y + v * length });
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
  layers[index] = {
    index,
    shape: layer.shape,
    side: layer.side,
    stitchCount: layer.stitchCount,
    start: label,
    end: { x: label.x + s * W, y: label.y },
    border: true,
  };
}
