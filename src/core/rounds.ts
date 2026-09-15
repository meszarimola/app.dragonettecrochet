/*
 * Körök geometriája (PQW-861): a lapos darabhoz kellő szaporítás a
 * kör-mintasűrűségből, és a befejezett körök ellenőrzése.
 *
 * Az alapmodell (04 §0): a formát a kör pozíciószámának körönkénti növekedése
 * adja. Lapos körben Δ = 2π · h/w, ahol h a kör magassága és w a szem
 * szélessége; szabályos sokszögben Δ = 2n · tg(π/n) · h/w (04 §6.1).
 *
 * A körös h/w arány, a legmegbízhatóbbtól:
 * - a szem saját, körben mért mintasűrűsége a profilból;
 * - egy másik alapszem körben mért aránya, a szokásos körös arányokkal
 *   átszámolva;
 * - mérés nélkül a szokásos körös arány (04 §1.2, §9.0): rp 1, fp 1,35, erp 2,
 *   krp 2,5; a háromráhajtásos pálcáé ebből továbbvezetett becslés. Ez adja a
 *   bevett 6, 8, 12 és 16 szaporítást. A szemkönyvtár sorbeli magasságaránya
 *   (01 §2.3) körben túl sok szaporítást adna, ezért itt nem azt használjuk.
 *
 * Az ellenőrzés csak befejezett körökön fut (a kör után esemény áll), hogy a
 * félkész kör ne jelezzen:
 * - egy körben legfeljebb duplázás vagy felezés (04 §9.0);
 * - kunkorodás: legalább két egymás utáni körben a szaporítás a lapos érték
 *   ~85%-a alatt; fodrosodás: ~130%-a fölött (04 §8, §9.6);
 * - három vagy több körön egymás fölé kerülő szaporítás; sokszögben nem, ott a
 *   sarkok szándékosan egymás fölött vannak (04 §3.2, §6.1);
 * - spirálban színváltás lépcsőjavítás nélkül (04 §2).
 *
 * A kör kerülete a pozíciók száma: a láncszem is szélességet ad, akkor is, ha a
 * szemszámba nem számít (a nagymama-négyzet utolsó körének ívei).
 */

import { stitchDimensions, type GaugeContext } from './gauge.ts';
import type { LayerInfo, PieceGraph } from './graph.ts';
import { gaugeContextOf } from './pattern-size.ts';
import type { RuleId } from './rules.ts';
import type { StitchLibrary } from './stitch-library.ts';
import type { NodeId, Pattern, PatternConventions, StitchDef, StitchDefId, ValueSource } from './types.ts';

/** A szokásos körös magasság/szélesség arány mérés nélkül (04 §1.2, §9.0). */
export const ROUND_ASPECT: Readonly<Record<StitchDefId, number>> = { sc: 1, hdc: 1.35, dc: 2, tr: 2.5, dtr: 3 };

/** A lapos érték alatti arány, amely alatt a kör kunkorodik, és fölötti, amely fölött fodrosodik (04 §8). */
export const CUPPING_RATIO = 0.85;
export const RUFFLING_RATIO = 1.3;

/** Ennyi körön át egymás fölé kerülő szaporítás már sokszögletű kört ad (04 §9.6). */
export const STACK_LIMIT = 3;

/**
 * A kör vége a minta beállításából. `stitch-default`: a mintatípus dönt, nem a
 * szem magassága; amigurumiban spirál, minden más körben zárt kör kúszószemmel
 * és kezdőlánccal (szókészlet K2, tulajdonosi döntés, PQW-892). A kifejezetten
 * megadott zárás marad.
 */
export function roundEndFor(setting: PatternConventions['roundEnd'], amigurumi: boolean): 'join-slip' | 'spiral' {
  if (setting !== 'stitch-default') return setting;
  return amigurumi ? 'spiral' : 'join-slip';
}

export interface FlatIncreases {
  /** A lapos darabhoz kellő szaporítás körönként, kerekítés nélkül. */
  readonly exact: number;
  /** Páros egészre kerekítve, legalább 4: rövidpálcánál 6, pálcánál 12. */
  readonly count: number;
  /** A körös magasság/szélesség arány. */
  readonly aspect: number;
  /** A szem, amelynek körben mért mintasűrűségéből az arány jön; becslésnél `null`. */
  readonly from: StitchDefId | null;
  readonly source: ValueSource;
}

/** A szem magasságát adó alapszem: összetett szemnél a részszem. */
export function baseStitchOf(def: StitchDef): StitchDefId {
  if (def.kind === 'joined') return def.part;
  if (def.kind === 'group') return def.members.find((member) => member !== 'ch') ?? def.id;
  return def.id;
}

/** Páros egészre kerekítve, legalább 4 (04 §1.2: 6, 8, 12, 15–16). */
export function niceIncreases(exact: number): number {
  return Math.max(4, 2 * Math.round(exact / 2));
}

/** A lapos körhöz (vagy `corners` sarkú sokszöghöz) kellő szaporítás körönként. */
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

/** A szem körben mért aránya a profilból, ha van. */
function measuredAspect(id: StitchDefId, context: GaugeContext): { aspect: number; source: ValueSource } | null {
  const def = context.library.get(id);
  const size = def ? stitchDimensions(def, 'round', context) : null;
  if (!size || size.basis !== 'measured' || size.widthMm.value <= 0) return null;
  const source: ValueSource = size.widthMm.source === 'label' || size.heightMm.source === 'label' ? 'label' : 'measured';
  return { aspect: size.heightMm.value / size.widthMm.value, source };
}

/* ---- Ellenőrzés ---- */

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
    const previous = layers[index - 1]!.positionCount;
    const count = layer.positionCount;
    if (previous > 0 && (count > 2 * previous || 2 * count < previous)) findings.push({ rule: 'round-growth', nodes: worked(graph, layer) });
    const def = tallest(graph, layer, library);
    if (def) ratios[index] = (count - previous) / flatIncreases(def, context, corners).exact;
  }

  // A részekből készült térbeli forma (amigurumi, PQW-863) szándékosan kunkorodik: ott nem jelez.
  const solid = (graph.piece.sections?.length ?? 0) > 0;
  for (const run of solid ? [] : runs(ratios, (ratio) => ratio < CUPPING_RATIO, 2)) {
    findings.push({ rule: 'round-cupping', nodes: run.flatMap((index) => worked(graph, layers[index]!)) });
  }
  for (const run of runs(ratios, (ratio) => ratio > RUFFLING_RATIO, 1)) {
    findings.push({ rule: 'round-ruffling', nodes: run.flatMap((index) => worked(graph, layers[index]!)) });
  }
  if (corners === undefined) findings.push(...stackedIncreases(graph, complete));
  return findings;
}

/** A kör horgolt szemei, a kezdőlánc, a továbbvezető és a záró kúszószem nélkül. */
function worked(graph: PieceGraph, layer: LayerInfo): NodeId[] {
  return layer.stitches.filter(
    (id) => graph.defs.get(id)!.kind !== 'chain' && id !== layer.joinSlip && !layer.travelSlips.includes(id),
  );
}

/** A kör legmagasabb szemének alapszeme: ez adja a kör magasságát. */
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

/** Az egymás utáni körök sorozatai, amelyekben a feltétel teljesül, legalább `min` hosszan. */
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
  /** Az előző kör pozíciója, amelybe a szaporítás megy. */
  readonly anchor: NodeId;
  /** A szaporítás szemei, a következő kör pozícióiként. */
  readonly members: readonly NodeId[];
}

/**
 * A kör szaporításai: az egy szembe horgolt, azonos szemekből álló csoportok,
 * és a számító kezdőlánc az alatta lévő szembe horgolt szemmel együtt.
 */
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

/**
 * Egymás fölé kerülő szaporítás (04 §3.2): a szaporítás az előző kör egy
 * szaporításának szemébe megy. Ha az előző kör minden szeme szaporítás (pl. a
 * 2. kör: 6 szaporítás), onnan nem számolunk tovább, mert ott nincs hová
 * eltolni. Sorozatonként egy találat, az első olyan kör szemeivel, ahol a
 * láncolat eléri a határt.
 */
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
