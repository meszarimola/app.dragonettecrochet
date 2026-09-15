/*
 * A szerkesztő műveletei a gráfon, böngésző nélkül.
 *
 * Nem helyet választunk, hanem célpontot: az előző sor egy pozícióját, egy
 * láncívet vagy a varázskört, amelybe a következő szem megy (06 §5.3). Minden
 * művelet új mintát ad, a régit nem módosítja, így a visszavonás a korábbi
 * minták verme (history.ts).
 *
 * A szerkesztő egy darabot szerkeszt, a minta első darabját. Nem kezeli még:
 * láncszem nélküli alapsort, láncszemgyűrűs kezdést, a fonal elvágását és új
 * fonalszakaszt, hosszú szemet korábbi sorba — ezeket a gráf sem, vagy csak
 * részben kezeli.
 */

import { buildPieceGraph, type LayerInfo, type PieceGraph } from './graph.ts';
import type { StitchLibrary } from './stitch-library.ts';
import { increase, shell } from './stitches.ts';
import { libraryFor, resolveStitch } from './stitch-variants.ts';
import { firstChainFromHook, traditionOf, turningChainCountsFor, withTradition } from './tradition.ts';
import type {
  Anchor,
  Finding,
  NodeId,
  Pattern,
  PatternConventions,
  Piece,
  RingId,
  SpaceId,
  StitchDef,
  StitchDefId,
  StitchFlag,
  StitchInsertion,
  StitchNode,
  Tradition,
} from './types.ts';
import { validatePattern } from './validate.ts';

/** Az új minta konvenciói: a jóváhagyott szókészlet alapértelmezései (K1, K2, D7), a láncszemek a PQW-870 szerint. */
export const DEFAULT_CONVENTIONS: PatternConventions = {
  turningChainCounts: 'stitch-default',
  roundEnd: 'stitch-default',
  picotCounts: false,
  joinSlipStitchCounts: false,
  chainCounts: 'worked-into',
};

export function emptyPattern(title = 'Új minta'): Pattern {
  return {
    formatVersion: 1,
    title,
    conventions: DEFAULT_CONVENTIONS,
    pieces: [{ id: 'p1', name: 'Darab', stitches: [], spaces: [], rings: [], groups: [], events: [], skipped: [] }],
  };
}

export type EditResult = { readonly ok: true; readonly pattern: Pattern } | { readonly ok: false; readonly reason: string };

const done = (pattern: Pattern): EditResult => ({ ok: true, pattern });
const refuse = (reason: string): EditResult => ({ ok: false, reason });

/**
 * A minta számolási hagyománya (PQW-876). A szemek és a célpontok nem
 * változnak, csak a számolásuk: a fordulólánc, a láncalap és az ellenőrzés az
 * új szabály szerint megy (tradition.ts).
 */
export function setTradition(pattern: Pattern, tradition: Tradition): EditResult {
  if (traditionOf(pattern.conventions) === tradition) return refuse('A minta már ezt a hagyományt követi.');
  return done({ ...pattern, conventions: withTradition(pattern.conventions, tradition) });
}

function pieceOf(pattern: Pattern): Piece {
  const piece = pattern.pieces[0];
  if (!piece) throw new Error('A mintában nincs darab.');
  return piece;
}

function withPiece(pattern: Pattern, piece: Piece): Pattern {
  return { ...pattern, pieces: [piece, ...pattern.pieces.slice(1)] };
}

/* ---- Célpontok ---- */

/** Egy célpont az előző rétegben: szem vagy láncszem, láncív, varázskör. */
export type Slot =
  | { readonly kind: 'stitch'; readonly id: NodeId }
  | { readonly kind: 'space'; readonly id: SpaceId; readonly chains: readonly NodeId[] }
  | { readonly kind: 'ring'; readonly id: RingId; readonly node: NodeId };

export interface WorkContext {
  readonly library: StitchLibrary;
  /** `null`, ha a darab üres. */
  readonly graph: PieceGraph | null;
  /** A réteg, amelybe a következő szem kerül; lehet, hogy még nincs a gráfban. */
  readonly layer: number;
  readonly shape: LayerInfo['shape'];
  /** A célpontok a haladási irányban. */
  readonly slots: readonly Slot[];
  /** Melyik célpontba horgolt már a réteg. */
  readonly used: readonly boolean[];
  /** Az utolsó felhasznált célpont indexe, vagy −1. */
  readonly frontier: number;
  /** A réteg eleji láncszemek száma (fordulólánc vagy kezdőlánc). */
  readonly turningChain: number;
  /** Van-e már szem a rétegben a fordulóláncon kívül. */
  readonly started: boolean;
}

const slotKey = (slot: Slot) => `${slot.kind}:${slot.id}`;
const anchorKey = (anchor: Anchor) => `${anchor.into}:${anchor.id}`;

export function contextOf(pattern: Pattern): WorkContext {
  const library = libraryFor(pattern);
  const piece = pieceOf(pattern);
  const empty: WorkContext = {
    library,
    graph: null,
    layer: 0,
    shape: 'row',
    slots: [],
    used: [],
    frontier: -1,
    turningChain: 0,
    started: false,
  };
  if (piece.stitches.length === 0) return empty;

  let graph: PieceGraph;
  try {
    graph = buildPieceGraph(pattern, piece, library);
  } catch {
    return empty;
  }
  const last = graph.layers[graph.layers.length - 1]!;

  let layer: number;
  let below: LayerInfo;
  let reversed: boolean;
  let shape: LayerInfo['shape'];
  if (last.closing !== null) {
    layer = last.index + 1;
    below = last;
    reversed = last.closing.kind === 'turn';
    shape = last.closing.kind === 'turn' ? 'row' : last.closing.kind === 'fasten-off' ? last.shape : 'round';
  } else if (last.index === 0) {
    layer = 1;
    below = last;
    shape = last.shape;
    reversed = shape === 'row';
  } else {
    layer = last.index;
    below = graph.layers[last.index - 1]!;
    reversed = last.direction === -1;
    shape = last.shape;
  }

  // Az 1. sor a láncalapba horgol. A gráf a be nem horgolt láncalap-véget az
  // 1. sor fordulóláncának számolja; célpontként mégis megtartjuk, hogy a
  // célpontok sorszáma horgolás közben ne tolódjon el (a horogtól számítva).
  const foundationTail =
    layer === 1 && below.index === 0 && shape === 'row' ? (graph.layers[1]?.turningChain ?? []) : [];
  const positions = [...below.positions, ...foundationTail];
  const ordered = reversed ? positions.reverse() : positions;
  const slots: Slot[] = [];
  for (const id of ordered) {
    const space = graph.spaceOfChain.get(id);
    if (space) {
      if (!slots.some((slot) => slot.kind === 'space' && slot.id === space.id)) {
        slots.push({ kind: 'space', id: space.id, chains: space.chains });
      }
      continue;
    }
    const ring = [...graph.rings.values()].find((candidate) => candidate.node === id);
    slots.push(ring ? { kind: 'ring', id: ring.id, node: id } : { kind: 'stitch', id });
  }

  const current = graph.layers[layer];
  const worked = new Set<string>();
  for (const id of current?.stitches ?? []) {
    for (const anchor of graph.nodes.get(id)!.anchors) worked.add(anchorKey(anchor));
  }
  const used = slots.map((slot) => worked.has(slotKey(slot)));
  const frontier = used.lastIndexOf(true);
  const turningChain = current?.turningChain.length ?? 0;
  const started = (current?.stitches.length ?? 0) > turningChain;

  return { library, graph, layer, shape, slots, used, frontier, turningChain, started };
}

/**
 * Hová mutasson a kurzor, ha a felhasználó nem mozgatta: az utolsó
 * felhasznált célpont utánra. Új sor elején a láncalapon a fordulólánc után
 * következő láncszemre (03 §1.2; japán hagyományban számító fordulóláncnál
 * eggyel később, tradition.ts), egyébként a számító fordulólánc alatti
 * szemet átugorva (03 §1.3).
 */
export function defaultCursor(pattern: Pattern, context: WorkContext, tool: StitchDefId | null): number {
  const { slots, frontier, used } = context;
  if (slots.length === 0) return 0;
  // A varázskörbe a teljes kör horgol; máskor a következő szabad célpontra ugrunk a
  // haladási irányban, a foglaltakat átugorva (PQW-879); a sor végén a célpontokon kívülre.
  if (frontier >= 0) {
    if (slots[frontier]!.kind === 'ring') return frontier;
    let next = frontier + 1;
    while (next < slots.length && used[next]) next += 1;
    return next;
  }

  const def = tool ? resolveStitch(tool) : undefined;
  const tradition = traditionOf(pattern.conventions);
  const counts = def !== undefined && turningChainCountsFor(pattern.conventions.turningChainCounts, def, tradition);
  const foundationChain = context.layer === 1 && context.shape === 'row' && context.turningChain === 0;
  // A horogtól számított láncszem 1-től, a célpont 0-tól számozott.
  if (foundationChain) return Math.min(def ? firstChainFromHook(def.turningChain, counts, tradition) - 1 : 1, slots.length - 1);

  if (context.turningChain > 0 && counts && slots.length > 1) return 1;
  return 0;
}

/* ---- Azonosítók ---- */

function nextId(prefix: string, ids: Iterable<string>): string {
  let max = 0;
  for (const id of ids) {
    const match = new RegExp(`^${prefix}(\\d+)$`).exec(id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}${max + 1}`;
}

/** Új szemek a fonal végére; az azonosítókat és a `prev` láncot ez osztja ki. */
function append(piece: Piece, nodes: readonly Omit<StitchNode, 'id' | 'prev'>[]): { piece: Piece; ids: NodeId[] } {
  const stitches = [...piece.stitches];
  const ids: NodeId[] = [];
  for (const node of nodes) {
    const id = nextId('n', stitches.map((stitch) => stitch.id));
    const prev = stitches[stitches.length - 1]?.id ?? null;
    stitches.push({ id, prev, ...node });
    ids.push(id);
  }
  return { piece: { ...piece, stitches }, ids };
}

/* ---- Műveletek ---- */

export interface Tool {
  readonly def: StitchDefId;
  /** Láncszemnél és láncívnél a láncszemek száma. */
  readonly count: number;
}

function hasEventAfterLast(piece: Piece): boolean {
  const last = piece.stitches[piece.stitches.length - 1];
  return last !== undefined && piece.events.some((event) => event.after === last.id);
}

/**
 * A kiválasztott eszközzel horgol a `cursor` célpontba (láncszemnél és
 * varázskörnél célpont nélkül). A `flags` a keresztezett vagy hosszú szemet
 * jelöli: a haladási irány elleni célpontnál ezzel válik érvényessé a szem.
 */
export function work(pattern: Pattern, tool: Tool, cursor: number, flags: readonly StitchFlag[] = []): EditResult {
  const def = resolveStitch(tool.def);
  if (!def) return refuse(`Ismeretlen szem: ${tool.def}`);
  const marks = flags.length > 0 ? { flags } : {};
  const piece = pieceOf(pattern);

  if (def.kind === 'ring') {
    if (piece.stitches.length > 0) return refuse('Varázskör csak a minta elején lehet.');
    const { piece: next, ids } = append(piece, [{ def: def.id, anchors: [] }]);
    return done(withPiece(pattern, { ...next, rings: [{ id: 'r1', node: ids[0]! }] }));
  }

  if (def.kind === 'chain' || def.kind === 'space') {
    const count = Math.trunc(tool.count);
    if (!(count >= 1 && count <= 500)) return refuse('A láncszemek száma 1 és 500 között lehet.');
    if (def.kind === 'space' && piece.stitches.length === 0) return refuse('A láncív egy sorban készül: előbb láncalap kell.');
    const { piece: next, ids } = append(
      piece,
      Array.from({ length: count }, () => ({ def: 'ch', anchors: [] })),
    );
    if (def.kind === 'chain') return done(withPiece(pattern, next));
    const space = { id: nextId('s', piece.spaces.map((s) => s.id)), chains: ids };
    return done(withPiece(pattern, { ...next, spaces: [...next.spaces, space] }));
  }

  if (piece.stitches.length === 0) return refuse('Előbb láncalap vagy varázskör kell.');

  if (def.kind === 'picot') {
    if (hasEventAfterLast(piece)) return refuse('A pikó egy szem tetejére kerül; a sor már véget ért.');
    return done(withPiece(pattern, append(piece, [{ def: def.id, anchors: [] }]).piece));
  }

  const context = contextOf(pattern);
  const first = context.slots[cursor];
  if (!first) {
    return refuse(
      context.slots.length > 0
        ? 'A sor végére értél: fordulj (F), zárd a kört (K), vagy válassz célpontot a nyilakkal.'
        : 'Nincs célpont: ebben a sorban nincs hová horgolni.',
    );
  }

  if (def.kind === 'joined' && def.base === 'spread') {
    const slots = context.slots.slice(cursor, cursor + def.consumes);
    if (slots.length < def.consumes || slots.some((slot) => slot.kind !== 'stitch')) {
      return refuse(`Ehhez ${def.consumes} egymás melletti szem kell a célponttól.`);
    }
    const mode = stitchMode(def);
    if (!mode) return refuse('Ez a szem nem horgolható szembe.');
    const anchors = slots.map((slot): Anchor => ({ into: 'stitch', id: slot.id, mode }));
    return done(withPiece(pattern, append(piece, [{ def: def.id, anchors, ...marks }]).piece));
  }

  const anchor = anchorFor(def, first);
  if (typeof anchor === 'string') return refuse(anchor);

  if (def.kind === 'group') {
    const members = def.members.map((member) => ({
      def: member,
      anchors: resolveStitch(member)?.kind === 'chain' ? [] : [anchor],
    }));
    const { piece: next, ids } = append(piece, members);
    const group = { id: nextId('g', piece.groups.map((g) => g.id)), def: def.id, members: ids };
    let spaces = next.spaces;
    const chains = ids.filter((_, i) => members[i]!.anchors.length === 0);
    if (def.producesSpaces > 0 && chains.length > 0) {
      spaces = [...spaces, { id: nextId('s', spaces.map((s) => s.id)), chains }];
    }
    return done(withPiece(pattern, { ...next, groups: [...next.groups, group], spaces }));
  }

  return done(withPiece(pattern, append(piece, [{ def: def.id, anchors: [anchor], ...marks }]).piece));
}

function stitchMode(def: StitchDef): StitchInsertion | undefined {
  return def.insertionModes.find((mode): mode is StitchInsertion => mode !== 'space' && mode !== 'ring');
}

function anchorFor(def: StitchDef, slot: Slot): Anchor | string {
  const name = def.terms.hu.name;
  switch (slot.kind) {
    case 'stitch': {
      const mode = stitchMode(def);
      return mode ? { into: 'stitch', id: slot.id, mode } : `A(z) ${name} nem horgolható szembe.`;
    }
    case 'space':
      return def.insertionModes.includes('space') ? { into: 'space', id: slot.id } : `A(z) ${name} nem horgolható láncívbe.`;
    case 'ring':
      return def.insertionModes.includes('ring') ? { into: 'ring', id: slot.id } : `A(z) ${name} nem horgolható varázskörbe.`;
  }
}

/**
 * Még egy szem ugyanabba a célpontba, mint az utolsó: egy szemből
 * szaporítás lesz, a szaporításból vagy kagylóból eggyel nagyobb. Láncívbe és
 * varázskörbe csoport nélkül is mehet több szem (01 §8.2 szabály 11).
 */
export function workIntoSame(pattern: Pattern, defId: StitchDefId): EditResult {
  const piece = pieceOf(pattern);
  const part = resolveStitch(defId);
  const last = piece.stitches[piece.stitches.length - 1];
  if (!part || part.kind !== 'basic' || !part.workableTop) return refuse('Ugyanabba csak alapszem horgolható még egyszer.');
  if (!last || hasEventAfterLast(piece)) return refuse('Nincs szem ebben a sorban, amelynek a célpontjába horgolni lehetne.');
  const anchor = last.anchors[0];
  if (!anchor || last.anchors.length !== 1) return refuse('Az utolsó szemnek nincs egyetlen célpontja.');

  const appended = append(piece, [{ def: part.id, anchors: [anchor] }]);
  if (anchor.into !== 'stitch') {
    if (!part.insertionModes.includes(anchor.into)) return refuse('Ez a szem ide nem horgolható.');
    return done(withPiece(pattern, appended.piece));
  }

  const group = piece.groups.find((candidate) => candidate.members.includes(last.id));
  if (group) {
    const members = piece.stitches.filter((node) => group.members.includes(node.id));
    if (members.some((node) => node.def !== part.id)) return refuse('Az utolsó csoport más szemekből áll.');
    const n = members.length + 1;
    const def = group.def.startsWith('shell-') ? shell(part, n) : increase(part, n);
    const groups = appended.piece.groups.map((g) =>
      g.id === group.id ? { ...g, def: def.id, members: [...g.members, appended.ids[0]!] } : g,
    );
    return done(withPiece(pattern, { ...appended.piece, groups }));
  }

  if (last.def !== part.id) return refuse('Az utolsó szem nem ugyanez a szem.');
  const def = increase(part, 2);
  const created = { id: nextId('g', piece.groups.map((g) => g.id)), def: def.id, members: [last.id, appended.ids[0]!] };
  return done(withPiece(pattern, { ...appended.piece, groups: [...appended.piece.groups, created] }));
}

/**
 * Sor kitöltése: a kiválasztott szemmel a sor összes szabad célpontját
 * kitölti a haladási irányban, egyetlen mintában (PQW-879). Így egyetlen
 * lépésben visszavonható. Csak célpontba horgolható szemmel megy; láncszem,
 * láncív, varázskör és pikó nem tölt sort.
 */
export function fillRow(pattern: Pattern, tool: Tool): EditResult {
  const def = resolveStitch(tool.def);
  if (!def) return refuse(`Ismeretlen szem: ${tool.def}`);
  if (def.kind === 'chain' || def.kind === 'space' || def.kind === 'ring' || def.kind === 'picot') {
    return refuse('Ezzel a szemmel nem lehet sort kitölteni: válassz célpontba horgolható szemet.');
  }
  let current = pattern;
  let placed = 0;
  // Minden lépés eggyel előbbre viszi a frontiert, ezért a ciklus véges; a fék csak biztonság.
  for (let guard = 0; guard < 5000; guard += 1) {
    const context = contextOf(current);
    if (context.slots.length === 0) break;
    let index = context.frontier >= 0 ? context.frontier + 1 : defaultCursor(current, context, tool.def);
    while (index < context.slots.length && context.used[index]) index += 1;
    if (index >= context.slots.length) break;
    const result = work(current, tool, index);
    if (!result.ok) break;
    current = result.pattern;
    placed += 1;
  }
  if (placed === 0) return refuse('Ebben a sorban nincs szabad célpont a kitöltéshez.');
  return done(current);
}

/** Sor vége és fordulás, utána a fordulólánc a kiválasztott szem magasságában (01 §8.3 szabály 12). */
export function endRow(pattern: Pattern, tool: StitchDefId | null): EditResult {
  const piece = pieceOf(pattern);
  const context = contextOf(pattern);
  if (!context.graph || !context.started) return refuse('Ebben a sorban még nincs szem.');
  if (context.shape === 'round') return refuse('Körben nem fordulunk: zárd a kört.');
  const last = piece.stitches[piece.stitches.length - 1]!;
  let next: Piece = { ...piece, events: [...piece.events, { after: last.id, kind: 'turn' }] };
  const chains = tool ? (resolveStitch(tool)?.turningChain ?? 0) : 0;
  if (chains > 0) next = append(next, Array.from({ length: chains }, () => ({ def: 'ch', anchors: [] }))).piece;
  return done(withPiece(pattern, next));
}

/** A kör zárása kúszószemmel a kör első pozíciójába: az első szembe vagy a kezdőlánc tetejébe (06 §5.3 V4). */
export function closeRound(pattern: Pattern): EditResult {
  const piece = pieceOf(pattern);
  const context = contextOf(pattern);
  if (!context.graph || !context.started) return refuse('Ebben a körben még nincs szem.');
  if (context.shape !== 'round') return refuse('Sorban nincs körzárás: a sor végén fordulunk.');
  const layer = context.graph.layers[context.layer]!;
  const first = layer.positions[0];
  if (!first) return refuse('A körnek nincs első szeme, amelybe zárni lehetne.');

  const { piece: next, ids } = append(piece, [
    { def: 'sl-st', anchors: [{ into: 'stitch', id: first, mode: 'both-loops' }] },
  ]);
  return done(withPiece(pattern, { ...next, events: [...next.events, { after: ids[0]!, kind: 'join-slip' }] }));
}

/**
 * Az utolsó lépés törlése: a sor vége (a körzáró kúszószemmel), a teljes
 * csoport, a teljes láncív, vagy egy szem.
 */
export function deleteLast(pattern: Pattern): EditResult {
  const piece = pieceOf(pattern);
  const last = piece.stitches[piece.stitches.length - 1];
  if (!last) return refuse('A minta üres.');

  const event = piece.events.find((candidate) => candidate.after === last.id);
  if (event && event.kind !== 'join-slip') {
    return done(withPiece(pattern, { ...piece, events: piece.events.filter((e) => e !== event) }));
  }

  let remove = new Set([last.id]);
  const group = piece.groups.find((candidate) => candidate.members.includes(last.id));
  const space = piece.spaces.find((candidate) => candidate.chains.includes(last.id));
  if (group) remove = new Set(group.members);
  else if (space) remove = new Set(space.chains);

  const stitches = piece.stitches.filter((node) => !remove.has(node.id));
  return done(
    withPiece(pattern, {
      ...piece,
      stitches,
      events: piece.events.filter((e) => !remove.has(e.after)),
      groups: piece.groups.filter((g) => g.members.every((id) => !remove.has(id))),
      spaces: piece.spaces
        .map((s) => ({ ...s, chains: s.chains.filter((id) => !remove.has(id)) }))
        .filter((s) => s.chains.length > 0),
      rings: piece.rings.filter((r) => !remove.has(r.node)),
      skipped: piece.skipped.filter((id) => !remove.has(id)),
    }),
  );
}

/** Kézi igazítás: eltolás a számolt helyhez képest. `null` visszaállítja. A topológián nem változtat. */
export function setPinned(pattern: Pattern, id: NodeId, offset: { readonly x: number; readonly y: number } | null): EditResult {
  const piece = pieceOf(pattern);
  if (!piece.stitches.some((node) => node.id === id)) return refuse(`Nincs ilyen szem: ${id}`);
  const stitches = piece.stitches.map((node) => {
    if (node.id !== id) return node;
    const { pinned: _, ...rest } = node;
    return offset && (offset.x !== 0 || offset.y !== 0)
      ? { ...rest, pinned: { x: Math.round(offset.x * 10) / 10, y: Math.round(offset.y * 10) / 10, rotation: 0 } }
      : rest;
  });
  return done(withPiece(pattern, { ...piece, stitches }));
}

/* ---- Élő ellenőrzés ---- */

export interface LiveCheck {
  readonly findings: readonly Finding[];
  /** A félkész sor célpontjai, amelyek még hátravannak; ezekre nem jelzünk hibát. */
  readonly remaining: number;
}

/** Ezek a szabályok egy félkész sorban csak azt jelzik, hogy a sor még nincs kész. */
const PENDING_RULES = new Set(['unused-position', 'turning-chain-placement', 'repeat-balance', 'floating-chain']);

/**
 * Az ellenőrző találatai, a félkész utolsó sor „még nincs kész” jelzései
 * nélkül: a sor végén felhasználatlan pozíció, a fordulólánc tetejébe még nem
 * horgolt utolsó szem, az ismétlés egyensúlya és a sor végi láncszemek.
 */
export function liveCheck(pattern: Pattern, context: WorkContext = contextOf(pattern)): LiveCheck {
  const findings = validatePattern(pattern, context.library);
  const graph = context.graph;
  const open = graph !== null && context.started && graph.layers[context.layer]?.closing === null;
  if (!open) return { findings, remaining: 0 };

  const slotIndex = new Map<NodeId, number>();
  context.slots.forEach((slot, i) => {
    if (slot.kind === 'stitch') slotIndex.set(slot.id, i);
    else if (slot.kind === 'space') for (const chain of slot.chains) slotIndex.set(chain, i);
    else slotIndex.set(slot.node, i);
  });
  const inLayer = new Set(graph.layers[context.layer]!.stitches);
  const pending = (finding: Finding) => {
    if (!PENDING_RULES.has(finding.rule)) return false;
    return finding.nodes.every((id) => inLayer.has(id) || (slotIndex.get(id) ?? -1) > context.frontier);
  };

  const remaining = context.used.filter((used, i) => !used && i > context.frontier).length;
  return { findings: findings.filter((finding) => !pending(finding)), remaining };
}
