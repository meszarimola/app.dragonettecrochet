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
import { effectiveInsertion, modeAsWorked, stitchInsertions } from './insertion.ts';
import { text, type CoreText } from './messages.ts';
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

/** Az új minta konvenciói: a jóváhagyott szókészlet alapértelmezései (K1, K2, D7), a láncszemek a PQW-940 szerint. */
export const DEFAULT_CONVENTIONS: PatternConventions = {
  turningChainCounts: 'stitch-default',
  roundEnd: 'stitch-default',
  picotCounts: false,
  joinSlipStitchCounts: false,
  chainCounts: true,
};

export function emptyPattern(title = 'Új minta'): Pattern {
  return {
    formatVersion: 1,
    title,
    conventions: DEFAULT_CONVENTIONS,
    pieces: [{ id: 'p1', name: 'Darab', stitches: [], spaces: [], rings: [], groups: [], events: [], skipped: [] }],
  };
}

/**
 * A szerkesztő elutasításainak kódjai (PQW-904): a mag nem mondatot ad, hanem
 * kódot és adatot, a mondat a felület szótárában készül
 * (`src/ui/i18n/core/editor.ts`).
 *
 * A kijelölés (selection.ts) ugyanezt az `EditResult`-ot adja a törlésre és a
 * beillesztésre, ezért azok kódjai is ebben az unióban állnak; a másolás
 * szűkebb készlete a `CopyCode` (selection.ts), amely ennek részhalmaza.
 */
export type EditCode =
  /* ---- Szerkesztő ---- */
  | 'tradition-unchanged'
  | 'unknown-stitch'
  | 'ring-only-at-start'
  | 'chain-count-range'
  | 'space-needs-row'
  | 'needs-foundation'
  | 'picot-after-row-end'
  | 'row-end-reached'
  | 'no-slots'
  | 'needs-adjacent-stitches'
  | 'stitch-not-into-stitch'
  | 'insertion-not-allowed'
  | 'stitch-not-into-space'
  | 'stitch-not-into-ring'
  | 'same-needs-basic'
  | 'same-no-stitch'
  | 'same-single-anchor'
  | 'same-wrong-target'
  | 'same-other-group'
  | 'same-other-stitch'
  | 'fill-needs-targeted'
  | 'fill-no-free-slot'
  | 'row-empty'
  | 'no-turn-in-round'
  | 'ring-needs-chains'
  | 'round-empty'
  | 'no-close-in-row'
  | 'round-no-first-stitch'
  | 'no-spiral-in-row'
  | 'pattern-empty'
  | 'no-such-node'
  /* ---- Kijelölés: törlés és beillesztés (selection.ts) ---- */
  | 'no-selection'
  | 'has-dependents'
  | 'no-piece'
  | 'clipboard-empty'
  | 'foundation-needs-empty'
  | 'paste-needs-foundation'
  | 'paste-shape-mismatch'
  | 'paste-round-starts-with-slip'
  | 'paste-too-many-chains'
  | 'paste-span-mismatch'
  | 'paste-not-enough-slots'
  | 'paste-slot-kind'
  | 'paste-slot-used'
  | 'paste-against-direction'
  | 'paste-no-reuse-slots'
  | 'paste-would-break'
  /* ---- Kijelölés: másolás (selection.ts `CopyCode`) ---- */
  | 'copy-broken-pattern'
  | 'copy-layer-outside'
  | 'copy-oval-first-round'
  | 'copy-anchor-unsupported';

export type EditResult =
  | { readonly ok: true; readonly pattern: Pattern }
  | { readonly ok: false; readonly reason: CoreText<EditCode> };

const done = (pattern: Pattern): EditResult => ({ ok: true, pattern });
const refuse = (reason: CoreText<EditCode>): EditResult => ({ ok: false, reason });

/**
 * A minta számolási hagyománya (PQW-876). A szemek és a célpontok nem
 * változnak, csak a számolásuk: a fordulólánc, a láncalap és az ellenőrzés az
 * új szabály szerint megy (tradition.ts).
 */
export function setTradition(pattern: Pattern, tradition: Tradition): EditResult {
  if (traditionOf(pattern.conventions) === tradition) return refuse(text('tradition-unchanged'));
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

/** Egy célpont az előző rétegben: szem vagy láncszem, láncív, varázskör, vagy az ovális láncszemének másik oldala. */
export type Slot =
  | { readonly kind: 'stitch'; readonly id: NodeId }
  | { readonly kind: 'space'; readonly id: SpaceId; readonly chains: readonly NodeId[] }
  | { readonly kind: 'ring'; readonly id: RingId; readonly node: NodeId }
  | { readonly kind: 'underside'; readonly id: NodeId };

/** A szerkesztő módja a mintatípusból (PQW-899). */
export interface EditorMode {
  /**
   * A láncalapra horgolt 1. réteg kör, pl. amigurumiban: ovális, amely a
   * legtávolabbi láncszem után a láncszemek másik oldalán halad vissza.
   */
  readonly roundsOnChain?: boolean;
}

export interface WorkContext {
  readonly library: StitchLibrary;
  /** `null`, ha a darab üres. */
  readonly graph: PieceGraph | null;
  /** A réteg, amelybe a következő szem kerül; lehet, hogy még nincs a gráfban. */
  readonly layer: number;
  readonly shape: LayerInfo['shape'];
  /** A réteg oldala: visszai soron a horgoló felől választott mód a tárolásban megfordul (PQW-869). */
  readonly side: LayerInfo['side'];
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
  /** Az ovális 1. köre a láncalapon (PQW-899): a célpontok a láncszemek másik oldalán folytatódnak. */
  readonly oval: boolean;
}

const slotKey = (slot: Slot) => `${slot.kind}:${slot.id}`;
const anchorKey = (anchor: Anchor) => `${anchor.into}:${anchor.id}`;

/**
 * A darab lezárult-e (PQW-897): az utolsó réteg után a fonal elvágása. Utána
 * nincs következő sor vagy kör.
 */
export function pieceFinished(graph: PieceGraph | null): boolean {
  const last = graph?.layers.at(-1);
  if (!last || last.index === 0 || !last.closing) return false;
  return last.closing.kind === 'fasten-off';
}

export function contextOf(pattern: Pattern, mode: EditorMode = {}): WorkContext {
  const library = libraryFor(pattern);
  const piece = pieceOf(pattern);
  const empty: WorkContext = {
    library,
    graph: null,
    layer: 0,
    shape: 'row',
    side: 'right',
    slots: [],
    used: [],
    frontier: -1,
    turningChain: 0,
    started: false,
    oval: false,
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

  // Az ovális 1. köre (PQW-899): már horgol a láncszemek másik oldalába, vagy a mintatípus szerint a láncalapon kör indul.
  // A láncgyűrű (zárt láncalap) és a varázskör nem ovális.
  const plainChain = below.closing === null && below.stitches.length > 0 && below.stitches.every((id) => graph.defs.get(id)!.kind === 'chain');
  const oval = layer === 1 && below.index === 0 && (below.undersides.length > 0 || (mode.roundsOnChain === true && plainChain));
  const slots = oval ? ovalSlots(graph, below) : layerSlots(graph, layer, below, reversed, shape);

  const current = graph.layers[layer];
  // A még meg nem kezdett réteg oldala a gráf szabálya szerint: fordulás után a másik oldal (graph.ts).
  const side = current?.side ?? (below.closing?.kind === 'turn' ? (below.side === 'right' ? 'wrong' : 'right') : below.side);
  const worked = new Set<string>();
  for (const id of current?.stitches ?? []) {
    for (const anchor of graph.nodes.get(id)!.anchors) worked.add(anchorKey(anchor));
  }
  const used = slots.map((slot) => worked.has(slotKey(slot)));
  const frontier = used.lastIndexOf(true);
  const turningChain = current?.turningChain.length ?? 0;
  const started = (current?.stitches.length ?? 0) > turningChain;

  return { library, graph, layer, shape, side, slots, used, frontier, turningChain, started, oval };
}

/**
 * Az ovális 1. körének célpontjai (04 §3.4, PQW-899): elöl a horogtól
 * távolodva minden láncszem (a kezdőlánccal együtt, hogy a sorszámok ne
 * tolódjanak el), utána a láncszemek másik oldala a horog felé, a
 * legtávolabbi láncszem nélkül: a vég szaporítása körbeér rajta. A másik oldal
 * az első szem után jelenik meg, addig nem tudni, melyik a kezdőlánc.
 */
function ovalSlots(graph: PieceGraph, below: LayerInfo): Slot[] {
  const current = graph.layers[1];
  const tail = current?.turningChain ?? [];
  const front = [...below.positions, ...tail].reverse().map((id): Slot => ({ kind: 'stitch', id }));
  if ((current?.stitches.length ?? 0) <= tail.length) return front;
  return [...front, ...below.positions.slice(1).map((id): Slot => ({ kind: 'underside', id }))];
}

/**
 * Egy réteg célpontjai a haladási irányban: az alatta lévő réteg horgolható
 * pozíciói, a láncív egy célpontként, a varázskör csomópontja gyűrűként. A
 * másolás (selection.ts) egy már megrajzolt réteghez is ebből számol.
 */
export function layerSlots(graph: PieceGraph, layer: number, below: LayerInfo, reversed: boolean, shape: LayerInfo['shape']): Slot[] {
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
  return slots;
}

/**
 * Hová mutasson a kurzor, ha a felhasználó nem mozgatta: az utolsó
 * felhasznált célpont utánra. Új sor elején a láncalapon a fordulólánc után
 * következő láncszemre (03 §1.2; számító fordulóláncnál az alapláncszem
 * miatt eggyel később, tradition.ts), egyébként a számító fordulólánc alatti
 * szemet átugorva (03 §1.3).
 */
export function defaultCursor(pattern: Pattern, context: WorkContext, tool: StitchDefId | null): number {
  const { slots, frontier, used } = context;
  if (slots.length === 0) return 0;
  // A varázskörbe a teljes kör horgol; máskor a következő szabad célpontra ugrunk a
  // haladási irányban, a foglaltakat átugorva (PQW-879); a sor végén a célpontokon kívülre.
  if (frontier >= 0) {
    if (slots[frontier]!.kind === 'ring') return frontier;
    /*
     * A lánccal áthidalt helyeken is túllépünk (PQW-936): a munka már elhaladt
     * fölöttük, oda szemet tenni ellentmondás lenne. Enélkül az Enter a
     * láncszemek MÖGÉ tett volna, és a lánc otthon nélkül maradt volna.
     */
    const bridged = new Set(pieceOf(pattern).skipped);
    let next = frontier + 1;
    while (next < slots.length && (used[next] || bridged.has(slots[next]!.id))) next += 1;
    return next;
  }
  return startCursor(pattern, context, tool);
}

/**
 * A réteg első szemének célpontja, amíg a rétegben még nincs szem: a
 * láncalapon a fordulólánc utáni láncszem, egyébként a számító fordulólánc
 * alatti szem utáni célpont. A beillesztés (selection.ts) ehhez igazítja a
 * másolt sort, a forrásban és a célban is.
 */
export function startCursor(
  pattern: Pattern,
  start: Pick<WorkContext, 'layer' | 'shape' | 'turningChain' | 'slots'> & { readonly oval?: boolean },
  tool: StitchDefId | null,
): number {
  const { slots } = start;
  if (slots.length === 0) return 0;
  const def = tool ? resolveStitch(tool) : undefined;
  // Az ovális 1. köre kör (PQW-899): alapláncszem nélkül, a kezdőlánc utáni láncszembe (rövidpálcánál a 2. a horogtól).
  if (start.oval && start.layer === 1 && start.turningChain === 0) return Math.min(def ? def.turningChain : 1, slots.length - 1);
  const tradition = traditionOf(pattern.conventions);
  const counts = def !== undefined && turningChainCountsFor(pattern.conventions.turningChainCounts, def, tradition, start.shape);
  const foundationChain = start.layer === 1 && start.shape === 'row' && start.turningChain === 0;
  // A horogtól számított láncszem 1-től, a célpont 0-tól számozott.
  if (foundationChain) return Math.min(def ? firstChainFromHook(def.turningChain, counts, tradition) - 1 : 1, slots.length - 1);

  /*
   * A fordulólánc az első pozíción ül — körben a kezdőlánc, sorban a sor első
   * szemének helyén álló lánc (PQW-944) —, oda már nem horgolunk: a kurzor a
   * második célpontra lép.
   */
  if (start.turningChain > 0 && counts && slots.length > 1) return 1;
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

/**
 * Hol a helye az új szemnek a fonal sorrendjében (PQW-933).
 *
 * A tulajdonos szava: „ez mintakészítés, nem aktuális horgolás, tehát szabadon
 * lehet visszafele módosítani.” Aki mintát alkot, nem sorban halad: kihagy egy
 * helyet és később pótolja, vagy visszamegy egy korábbi szembe szaporítani.
 *
 * Az így hozzáadott szem a KELME sorrendjébe kerül, a célpontja mellé — nem a
 * lista végére. Enélkül a fonal sorrendje elvált a kelme sorrendjétől, és a
 * rajz azt követte: a mérés szerint a rés pótlásakor az új szem a sor végére
 * ugrott (x=132 a saját 156 helyett), az előtte lévőt pedig maga előtt tolta
 * és megdöntötte (talp 132, tető 156). Az ellenőrző ugyanezt „a haladási
 * irány ellen” hibának látta, az írott minta pedig visszafelé olvasta a sort.
 *
 * A szabály: az új szem a sor első olyan szeme ELÉ kerül, amely már messzebbre
 * ér nála. Előre haladva ilyen nincs, tehát a sor vége a helye — vagyis
 * pontosan a régi hozzáfűzés.
 */
function fabricIndex(piece: Piece, context: WorkContext, cursor: number): number {
  const { graph } = context;
  const layer = graph?.layers[context.layer];
  if (!graph || !layer) return piece.stitches.length;
  const slotIndex = new Map(context.slots.map((slot, i) => [slotKey(slot), i]));
  const reach = (id: NodeId): number => {
    const found = (graph.nodes.get(id)?.anchors ?? []).map((anchor) => slotIndex.get(anchorKey(anchor)));
    const known = found.filter((value): value is number => value !== undefined);
    // Célpont nélküli elem (fordulólánc, láncszem, pikó) nem ér sehová: a helyén marad.
    return known.length > 0 ? Math.max(...known) : -1;
  };
  const ahead = layer.stitches.find((id) => reach(id) > cursor);
  const index = ahead === undefined ? -1 : piece.stitches.findIndex((node) => node.id === ahead);
  return index < 0 ? piece.stitches.length : index;
}

/** Új szemek a fonal útjának adott pontjára; a `prev` lánc a tömb sorrendjéből újraszövődik (validate.ts). */
function insertAt(
  piece: Piece,
  index: number,
  nodes: readonly Omit<StitchNode, 'id' | 'prev'>[],
): { piece: Piece; ids: NodeId[] } {
  if (index >= piece.stitches.length) return append(piece, nodes);
  const taken = piece.stitches.map((node) => node.id);
  const ids: NodeId[] = [];
  const made = nodes.map((node): StitchNode => {
    const id = nextId('n', taken);
    taken.push(id);
    ids.push(id);
    return { id, prev: null, ...node };
  });
  const list = [...piece.stitches.slice(0, index), ...made, ...piece.stitches.slice(index)];
  // Az elvágás utáni szakasz eleje `prev: null` marad; minden más a tömbbeli előzőjére mutat.
  const cut = new Set(piece.events.filter((event) => event.kind === 'fasten-off').map((event) => event.after));
  const stitches = list.map((node, i): StitchNode => {
    const previous = list[i - 1];
    const prev = previous === undefined || cut.has(previous.id) ? null : previous.id;
    return node.prev === prev ? node : { ...node, prev };
  });
  return { piece: { ...piece, stitches }, ids };
}

/* ---- Műveletek ---- */

export interface Tool {
  readonly def: StitchDefId;
  /** Láncszemnél és láncívnél a láncszemek száma. */
  readonly count: number;
  /**
   * A beszúrási mód a horgoló felől (PQW-869); hiányában a szem alapértelmezése.
   * Csak szembe horgolásnál számít, láncívbe és varázskörbe nem.
   */
  readonly insertion?: StitchInsertion | undefined;
}

/** Ennyi láncszem készülhet egy lépésben; ennél több elírás, nem minta. */
const MAX_CHAINS = 500;

function hasEventAfterLast(piece: Piece): boolean {
  const last = piece.stitches[piece.stitches.length - 1];
  return last !== undefined && piece.events.some((event) => event.after === last.id);
}

/**
 * A kiválasztott eszközzel horgol a `cursor` célpontba (láncszemnél és
 * varázskörnél célpont nélkül). A `flags` a keresztezett vagy hosszú szemet
 * jelöli: a haladási irány elleni célpontnál ezzel válik érvényessé a szem.
 */
export function work(pattern: Pattern, tool: Tool, cursor: number, flags: readonly StitchFlag[] = [], mode: EditorMode = {}): EditResult {
  const def = resolveStitch(tool.def);
  if (!def) return refuse(text('unknown-stitch', { id: tool.def }));
  const marks = flags.length > 0 ? { flags } : {};
  const piece = pieceOf(pattern);

  if (def.kind === 'ring') {
    if (piece.stitches.length > 0) return refuse(text('ring-only-at-start'));
    const { piece: next, ids } = append(piece, [{ def: def.id, anchors: [] }]);
    return done(withPiece(pattern, { ...next, rings: [{ id: 'r1', node: ids[0]! }] }));
  }

  if (def.kind === 'chain' || def.kind === 'space') {
    const count = Math.trunc(tool.count);
    if (!(count >= 1 && count <= MAX_CHAINS)) return refuse(text('chain-count-range', { min: 1, max: MAX_CHAINS }));
    if (def.kind === 'space' && piece.stitches.length === 0) return refuse(text('space-needs-row'));
    const nodes = Array.from({ length: count }, () => ({ def: 'ch', anchors: [] }));
    /*
     * A láncszem is oda kerül, ahová a horgoló mutat (PQW-935). Célpontja
     * nincs, helye viszont van: a megkattintott oszlopokat FOGLALJA EL, és
     * ezzel az alattuk lévő szemeket kihagyja. Ezt jegyezzük fel — ebből tudja
     * a rajz, hová tegye, az írott minta pedig, hogy „hagyj ki N szemet”.
     */
    const covered = coveredByChains(pattern, piece, cursor, count, mode);
    const { piece: next, ids } = insertAt(piece, covered.at, nodes);
    const withSkips = { ...next, skipped: covered.skipped };
    if (def.kind === 'chain') return done(withPiece(pattern, withSkips));
    const space = { id: nextId('s', piece.spaces.map((s) => s.id)), chains: ids };
    return done(withPiece(pattern, { ...withSkips, spaces: [...withSkips.spaces, space] }));
  }

  if (piece.stitches.length === 0) return refuse(text('needs-foundation'));

  if (def.kind === 'picot') {
    if (hasEventAfterLast(piece)) return refuse(text('picot-after-row-end'));
    return done(withPiece(pattern, append(piece, [{ def: def.id, anchors: [] }]).piece));
  }

  const context = contextOf(pattern, mode);

  /*
   * A fordult sor első szeme MAGA a fordulólánc (PQW-944): a program a szem
   * magasságának megfelelő láncszemet teszi le helyette — rövidpálcánál 1,
   * félpálcánál 2, egyráhajtásos pálcánál 3 —, és az a sor első szemének
   * helyére áll. Csak az elsőre vonatkozik; onnantól az kerül le, amit a
   * horgoló választ.
   *
   * Csak az ALAPSZEMEKRE (rövidpálca, félpálca, pálcák) vonatkozik: a
   * fogyasztás, a csokor és a kagyló alakít, azt nem cseréljük láncra — ott a
   * horgoló maga teszi le a láncot. A láncalapra horgolt 1. sor is kimarad:
   * ott a fordulólánc a láncalap végéből lesz, aszerint, hányadik láncszembe
   * megy az első szem (PQW-891). Ha a minta szerint a fordulólánc nem szem
   * (`turningChainCounts: false`), akkor sem áll szem helyére.
   */
  const turnsInto = turningChainCountsFor(pattern.conventions.turningChainCounts, def, traditionOf(pattern.conventions), 'row');
  if (startsTurnedRow(context) && def.kind === 'basic' && def.turningChain > 0 && turnsInto) {
    const nodes = Array.from({ length: def.turningChain }, () => ({ def: 'ch' as StitchDefId, anchors: [] }));
    return done(withPiece(pattern, append(piece, nodes).piece));
  }

  const first = context.slots[cursor];
  if (!first) {
    return refuse(text(context.slots.length > 0 ? 'row-end-reached' : 'no-slots'));
  }
  // A szem a kelme sorrendjébe kerül, nem a lista végére (PQW-933).
  const at = fabricIndex(piece, context, cursor);

  if (def.kind === 'joined' && def.base === 'spread') {
    const slots = context.slots.slice(cursor, cursor + def.consumes);
    if (slots.length < def.consumes || slots.some((slot) => slot.kind !== 'stitch')) {
      return refuse(text('needs-adjacent-stitches', { count: def.consumes }));
    }
    const mode = stitchModeFor(def, tool.insertion, context.side);
    if ('code' in mode) return refuse(mode);
    const anchors = slots.map((slot): Anchor => ({ into: 'stitch', id: slot.id, mode: mode.mode }));
    return done(withPiece(pattern, clearSkips(insertAt(piece, at, [{ def: def.id, anchors, ...marks }]).piece, anchors)));
  }

  const anchor = anchorFor(def, first, tool.insertion, context.side);
  if ('code' in anchor) return refuse(anchor);

  if (def.kind === 'group') {
    const members = def.members.map((member) => ({
      def: member,
      anchors: resolveStitch(member)?.kind === 'chain' ? [] : [anchor],
    }));
    const { piece: next, ids } = insertAt(piece, at, members);
    const group = { id: nextId('g', piece.groups.map((g) => g.id)), def: def.id, members: ids };
    let spaces = next.spaces;
    const chains = ids.filter((_, i) => members[i]!.anchors.length === 0);
    if (def.producesSpaces > 0 && chains.length > 0) {
      spaces = [...spaces, { id: nextId('s', spaces.map((s) => s.id)), chains }];
    }
    return done(withPiece(pattern, clearSkips({ ...next, groups: [...next.groups, group], spaces }, [anchor])));
  }

  const worked = insertAt(piece, at, [{ def: def.id, anchors: [anchor], ...marks }]).piece;
  return done(withPiece(pattern, clearSkips(worked, [anchor])));
}

/** Amibe szem kerül, az nem kihagyott többé (PQW-935): a két állapot kizárja egymást. */
function clearSkips(piece: Piece, anchors: readonly Anchor[]): Piece {
  if (piece.skipped.length === 0) return piece;
  const worked = new Set(anchors.map((anchor) => anchor.id));
  const skipped = piece.skipped.filter((id) => !worked.has(id));
  return skipped.length === piece.skipped.length ? piece : { ...piece, skipped };
}

/**
 * Hová kerülnek a láncszemek, és mit takarnak el (PQW-935).
 *
 * A tulajdonos jelentése: a láncszem mindig a sor végére került, akárhová
 * kattintott — mérve a 9. és a 6. célpontra állított kurzorral bitre ugyanoda.
 * Szó szerint: „azt vártam volna, hogy ha a másodikba klikkelek… akkor abba a
 * cellába tegye a láncszemet.”
 *
 * A láncszemnek nincs célpontja, helye viszont van: annyi oszlopot foglal el,
 * ahány láncszem készül, a megkattintott oszloptól kezdve. Az ezek alatt lévő
 * szemek KIHAGYOTTAK — a lánc áthidalja őket. Ezt a `skipped` őrzi, ebből
 * számol a rajz (layout.ts) és az írott minta.
 *
 * A láncalapon és az alapértelmezett kurzoron ez semmit nem változtat: ott a
 * lánc marad a sor végén, ahogy eddig.
 */
function coveredByChains(
  pattern: Pattern,
  piece: Piece,
  cursor: number,
  count: number,
  mode: EditorMode,
): { at: number; skipped: readonly NodeId[] } {
  const context = contextOf(pattern, mode);
  if (!context.graph || context.slots.length === 0) return { at: piece.stitches.length, skipped: piece.skipped };
  /*
   * Előbb takarítás (PQW-939). A korábbi verziókból örökölt minta gazdátlan
   * jelöléseket hordozhat: olyan helyeket, amelyek fölül a láncszemet azóta
   * törölték. A mérés szerint két ilyen árva jelölés elég volt ahhoz, hogy a
   * horgoló által megmutatott oszlop helyett (x=84) a lánc közvetlenül az
   * előtte lévő szem mellé kerüljön (x=132) — a tulajdonos: „a 2. sor utolsó
   * láncszemét azt közvetlenül az erp után teszi… pedig kihagytam cellákat”.
   *
   * Így a minta minden szerkesztéssel tisztul, nem csak törléskor.
   */
  const clean = pieceOf(withoutStaleSkips(pattern));
  const at = fabricIndex(piece, context, cursor);
  // A lánc csak ELŐRE hidal át: a munkaél mögé visszanyúlva vagy foglalt célponton csak követi a szemet.
  if (cursor <= context.frontier || context.used[cursor] !== false) return { at, skipped: clean.skipped };
  // A kurzortól a következő `count` SZABAD és még el nem foglalt hely: két lánc nem ülhet egy oszlopban.
  const already = new Set(clean.skipped);
  const skipped: NodeId[] = [...clean.skipped];
  for (let i = cursor; i < context.slots.length && skipped.length - clean.skipped.length < count; i += 1) {
    const slot = context.slots[i]!;
    if (context.used[i] || slot.kind !== 'stitch' || already.has(slot.id)) continue;
    skipped.push(slot.id);
  }
  return { at, skipped };
}

/**
 * A tárolt, színoldali mód a horgoló felől kértből, vagy érthető ok, ha a szem
 * így nem horgolható (PQW-869).
 */
function stitchModeFor(
  def: StitchDef,
  requested: StitchInsertion | undefined,
  side: LayerInfo['side'],
): { readonly mode: StitchInsertion } | CoreText<EditCode> {
  const allowed = stitchInsertions(def);
  const mode = effectiveInsertion(def, requested);
  // A szem AZONOSÍTÓJA megy át; a nevét a felület adja a JELÖLÉS nyelvén (PQW-868, PQW-904).
  if (!mode) return text('stitch-not-into-stitch', { stitch: def.id });
  if (requested && requested !== mode) {
    return text('insertion-not-allowed', { stitch: def.id, requested, allowed });
  }
  return { mode: modeAsWorked(mode, side) };
}

function anchorFor(def: StitchDef, slot: Slot, requested: StitchInsertion | undefined, side: LayerInfo['side']): Anchor | CoreText<EditCode> {
  switch (slot.kind) {
    case 'stitch': {
      const mode = stitchModeFor(def, requested, side);
      return 'code' in mode ? mode : { into: 'stitch', id: slot.id, mode: mode.mode };
    }
    case 'space':
      return def.insertionModes.includes('space') ? { into: 'space', id: slot.id } : text('stitch-not-into-space', { stitch: def.id });
    case 'ring':
      return def.insertionModes.includes('ring') ? { into: 'ring', id: slot.id } : text('stitch-not-into-ring', { stitch: def.id });
    case 'underside': {
      // A láncszem másik oldala szembe horgolható szemet kér; szálat nem választunk (PQW-899).
      const mode = stitchModeFor(def, requested, side);
      return 'code' in mode ? mode : { into: 'underside', id: slot.id };
    }
  }
}

/**
 * Még egy szem ugyanabba a célpontba, mint az utolsó: egy szemből
 * szaporítás lesz, a szaporításból vagy kagylóból eggyel nagyobb. Láncívbe és
 * varázskörbe csoport nélkül is mehet több szem (01 §8.2 szabály 11).
 */
export function workIntoSame(pattern: Pattern, defId: StitchDefId, cursor?: number, mode: EditorMode = {}): EditResult {
  const piece = pieceOf(pattern);
  const part = resolveStitch(defId);
  const last = piece.stitches[piece.stitches.length - 1];
  if (!part || part.kind !== 'basic' || !part.workableTop) return refuse(text('same-needs-basic'));
  // A szaporítás abba a szembe megy, amelyikbe a horgoló kattintott (PQW-933); kurzor nélkül az utolsóba.
  const host = cursor === undefined ? last : hostAt(pattern, piece, cursor, mode);
  if (!host || (host === last && hasEventAfterLast(piece))) return refuse(text('same-no-stitch'));
  const anchor = host.anchors[0];
  if (!anchor || host.anchors.length !== 1) return refuse(text('same-single-anchor'));

  // A csoport tagjai egymás után állnak (03 §10 C14): az új szem a célpontjában lévők mögé kerül.
  const behind = piece.groups.find((candidate) => candidate.members.includes(host.id))?.members.at(-1) ?? host.id;
  const appended = insertAt(piece, piece.stitches.findIndex((node) => node.id === behind) + 1, [{ def: part.id, anchors: [anchor] }]);
  // A láncszem másik oldalába horgolt szemből ugyanúgy szaporítás lesz, mint a szembe horgoltból (PQW-899).
  if (anchor.into !== 'stitch' && anchor.into !== 'underside') {
    if (!part.insertionModes.includes(anchor.into)) return refuse(text('same-wrong-target'));
    return done(withPiece(pattern, appended.piece));
  }

  const group = piece.groups.find((candidate) => candidate.members.includes(host.id));
  if (group) {
    const members = piece.stitches.filter((node) => group.members.includes(node.id));
    if (members.some((node) => node.def !== part.id)) return refuse(text('same-other-group'));
    const n = members.length + 1;
    const def = group.def.startsWith('shell-') ? shell(part, n) : increase(part, n);
    const groups = appended.piece.groups.map((g) =>
      g.id === group.id ? { ...g, def: def.id, members: [...g.members, appended.ids[0]!] } : g,
    );
    return done(withPiece(pattern, { ...appended.piece, groups }));
  }

  if (host.def !== part.id) return refuse(text('same-other-stitch'));
  const def = increase(part, 2);
  const created = { id: nextId('g', piece.groups.map((g) => g.id)), def: def.id, members: [host.id, appended.ids[0]!] };
  return done(withPiece(pattern, { ...appended.piece, groups: [...appended.piece.groups, created] }));
}

/** A megkattintott célpontba horgolt utolsó szem: a szaporítás gazdája (PQW-933). */
function hostAt(pattern: Pattern, piece: Piece, cursor: number, mode: EditorMode): StitchNode | undefined {
  const context = contextOf(pattern, mode);
  const slot = context.slots[cursor];
  const layer = context.graph?.layers[context.layer];
  if (!slot || !layer || !context.graph) return undefined;
  const key = slotKey(slot);
  const into = layer.stitches.filter((id) => context.graph!.nodes.get(id)!.anchors.some((anchor) => anchorKey(anchor) === key));
  const id = into.at(-1);
  return piece.stitches.find((node) => node.id === id);
}

/**
 * Sor kitöltése: a kiválasztott szemmel a sor összes szabad célpontját
 * kitölti a haladási irányban, egyetlen mintában (PQW-879). Így egyetlen
 * lépésben visszavonható. Csak célpontba horgolható szemmel megy; láncszem,
 * láncív, varázskör és pikó nem tölt sort.
 */
export function fillRow(pattern: Pattern, tool: Tool, mode: EditorMode = {}): EditResult {
  const def = resolveStitch(tool.def);
  if (!def) return refuse(text('unknown-stitch', { id: tool.def }));
  if (def.kind === 'chain' || def.kind === 'space' || def.kind === 'ring' || def.kind === 'picot') {
    return refuse(text('fill-needs-targeted'));
  }
  let current = pattern;
  let placed = 0;
  // Minden lépés eggyel előbbre viszi a frontiert, ezért a ciklus véges; a fék csak biztonság.
  for (let guard = 0; guard < 5000; guard += 1) {
    const context = contextOf(current, mode);
    if (context.slots.length === 0) break;
    let index = context.frontier >= 0 ? context.frontier + 1 : defaultCursor(current, context, tool.def);
    while (index < context.slots.length && context.used[index]) index += 1;
    if (index >= context.slots.length) break;
    const result = work(current, tool, index, [], mode);
    if (!result.ok) break;
    current = result.pattern;
    placed += 1;
  }
  if (placed === 0) return refuse(text('fill-no-free-slot'));
  return done(current);
}

/** Csak a láncalap kész, az 1. sor még nem kezdődött: a láncalap utáni fordulás. */
export function onFoundationChain(context: WorkContext): boolean {
  return context.graph !== null && context.layer === 1 && context.shape === 'row' && !context.started && context.turningChain === 0;
}

/**
 * A fordult sor legelején állunk-e: a sorban még nincs se szem, se fordulólánc
 * (PQW-944). A láncalapra horgolt 1. sor nem ilyen: ott a fordulólánc a
 * láncalap végéből lesz.
 */
export function startsTurnedRow(context: WorkContext): boolean {
  return context.graph !== null && context.shape === 'row' && context.layer > 1 && !context.started && context.turningChain === 0;
}

/** Fordulhat-e most a munka: a sorban van szem, vagy a láncalap kész (PQW-891). */
export function canEndRow(context: WorkContext): boolean {
  return (context.started && context.shape === 'row') || onFoundationChain(context);
}

/**
 * Sor vége és fordulás. A fordulás MAGA nem rak le láncszemet (PQW-944): a
 * fordulóláncot a sor első szeme hozza magával, a saját magasságában, és a
 * helyére áll (01 §8.3 szabály 12). Így fordulás után a készülő sor rácsa
 * teljes magasságában látszik, és nem lóg a szövet mellé egy magányos lánc.
 *
 * A láncalap után a fordulás a minta szerkezetében már benne van (az 1. sor
 * visszafelé halad, a fordulólánc a láncalap vége), ezért ott a minta nem
 * változik, az 1. sor következik (PQW-891).
 */
export function endRow(pattern: Pattern): EditResult {
  const piece = pieceOf(pattern);
  const context = contextOf(pattern);
  if (onFoundationChain(context)) return done(pattern);
  if (!context.graph || !context.started) return refuse(text('row-empty'));
  if (context.shape === 'round') return refuse(text('no-turn-in-round'));
  const last = piece.stitches[piece.stitches.length - 1]!;
  return done(withPiece(pattern, { ...piece, events: [...piece.events, { after: last.id, kind: 'turn' }] }));
}

/** Ennyi láncszemből lehet láncgyűrű; kevesebbnél a „2 lsz, 6 rp a 2. láncszembe” kezdés való. */
export const MIN_RING_CHAINS = 3;

/** Láncgyűrű zárható-e: a darab csak láncszemekből áll, láncív és esemény nélkül (04 §1.1). */
export function canJoinChainRing(pattern: Pattern): boolean {
  const piece = pieceOf(pattern);
  return (
    piece.stitches.length >= MIN_RING_CHAINS &&
    piece.stitches.every((node) => node.def === 'ch') &&
    piece.spaces.length === 0 &&
    piece.events.length === 0
  );
}

/**
 * Véget érhet-e most a kör, kúszószemmel vagy spirálban: körben, ha már van
 * szeme, és a láncszembe horgolt 1. kör után is („2 lsz, 6 rp a 2.
 * láncszembe”, 04 §1.1), amelyet a zárás tesz körré (PQW-861).
 */
export function canEndRound(context: WorkContext): boolean {
  const layer = context.graph?.layers[context.layer];
  if (!context.graph || !context.started || !layer || layer.positions.length === 0 || layer.closing !== null) return false;
  if (context.shape === 'round') return true;
  const { graph } = context;
  const base = graph.layers[0]!;
  // Zárás előtt a gráf sornak látja, és számító fordulóláncnál alapláncszemet is vehet a láncalapba: ezért nem a
  // láncalap pozícióit számoljuk, hanem azt nézzük, hogy minden szem a legelső láncszembe megy („2 lsz, 6 rp a 2. láncszembe”).
  const targets = new Set(layer.stitches.flatMap((id) => graph.nodes.get(id)!.anchors.map((anchor) => (anchor.into === 'stitch' ? anchor.id : ''))));
  return (
    context.layer === 1 &&
    targets.size === 1 &&
    targets.has(base.stitches[0]!) &&
    base.stitches.every((id) => graph.defs.get(id)!.kind === 'chain')
  );
}

/** A kör zárása gombja: láncgyűrű a láncszemekből, vagy a kör zárása. */
export function canCloseRound(pattern: Pattern, context: WorkContext = contextOf(pattern)): boolean {
  return canJoinChainRing(pattern) || canEndRound(context);
}

/**
 * A kör zárása kúszószemmel a kör első pozíciójába: az első szembe vagy a
 * kezdőlánc tetejébe (06 §5.3 V4). Ha a darab még csak láncszem, a zárás
 * láncgyűrűt ad (PQW-861).
 */
export function closeRound(pattern: Pattern): EditResult {
  const piece = pieceOf(pattern);
  if (canJoinChainRing(pattern)) return joinChainRing(pattern);
  const context = contextOf(pattern);
  const onlyChains = piece.stitches.length > 0 && piece.stitches.every((node) => node.def === 'ch');
  if (onlyChains && piece.stitches.length < MIN_RING_CHAINS) {
    return refuse(text('ring-needs-chains', { min: MIN_RING_CHAINS }));
  }
  if (!context.graph || !context.started) return refuse(text('round-empty'));
  if (!canEndRound(context)) return refuse(text('no-close-in-row'));
  const layer = context.graph.layers[context.layer]!;
  const first = context.shape === 'round' ? layer.positions[0] : roundOnChainStart(pattern, context.graph, layer);
  if (!first) return refuse(text('round-no-first-stitch'));

  const { piece: next, ids } = append(piece, [
    { def: 'sl-st', anchors: [{ into: 'stitch', id: first, mode: 'both-loops' }] },
  ]);
  return done(withPiece(pattern, { ...next, events: [...next.events, { after: ids[0]!, kind: 'join-slip' }] }));
}

/**
 * A láncszembe horgolt 1. kör első pozíciója a zárás előtt. A gráf ekkor még
 * sornak látja, ezért a kezdőlánc számolását a kör szabálya szerint nézzük
 * (tradition.ts): így a záró kúszószem a lezárt kör első pozíciójába megy.
 */
function roundOnChainStart(pattern: Pattern, graph: PieceGraph, layer: LayerInfo): NodeId | undefined {
  const def = layer.firstStitch === null ? undefined : graph.defs.get(layer.firstStitch);
  const { conventions } = pattern;
  const counts = def !== undefined && turningChainCountsFor(conventions.turningChainCounts, def, traditionOf(conventions), 'round');
  return counts ? layer.turningChain.at(-1) : layer.positions.find((id) => !layer.turningChain.includes(id));
}

/**
 * Láncgyűrű (04 §1.1): kúszószem az első láncszembe, a láncszemekből egy
 * láncív, amelybe az 1. kör horgol. A zárás eseménye az utolsó láncszem után
 * áll; a kúszószem az 1. kör továbbvezetése (graph.ts).
 */
function joinChainRing(pattern: Pattern): EditResult {
  const piece = pieceOf(pattern);
  const chains = piece.stitches.map((node) => node.id);
  const { piece: next } = append(piece, [{ def: 'sl-st', anchors: [{ into: 'stitch', id: chains[0]!, mode: 'both-loops' }] }]);
  const ring = { id: nextId('s', piece.spaces.map((space) => space.id)), chains };
  return done(withPiece(pattern, { ...next, spaces: [ring], events: [{ after: chains[chains.length - 1]!, kind: 'join-slip' }] }));
}

/**
 * A kör vége spirálban: a következő kör zárás nélkül folytatódik, a kör első
 * szemét körjelölő jelöli (04 §2). A lépcsőt a színváltásnál az ellenőrző jelzi.
 */
export function endRoundSpiral(pattern: Pattern): EditResult {
  const piece = pieceOf(pattern);
  const context = contextOf(pattern);
  if (!context.graph || !context.started) return refuse(text('round-empty'));
  if (!canEndRound(context)) return refuse(text('no-spiral-in-row'));
  const last = piece.stitches[piece.stitches.length - 1]!;
  return done(withPiece(pattern, { ...piece, events: [...piece.events, { after: last.id, kind: 'spiral' }] }));
}

/**
 * Az utolsó lépés törlése: a sor vége (a körzáró kúszószemmel), a teljes
 * csoport, a teljes láncív, vagy egy szem. A láncgyűrű kúszószemével a gyűrű
 * is felbomlik, a láncszemek maradnak.
 */
export function deleteLast(pattern: Pattern): EditResult {
  const piece = pieceOf(pattern);
  const last = piece.stitches[piece.stitches.length - 1];
  if (!last) return refuse(text('pattern-empty'));

  const event = piece.events.find((candidate) => candidate.after === last.id);
  if (event && event.kind !== 'join-slip') {
    return done(withPiece(pattern, { ...piece, events: piece.events.filter((e) => e !== event) }));
  }

  let remove = new Set([last.id]);
  const group = piece.groups.find((candidate) => candidate.members.includes(last.id));
  const space = piece.spaces.find((candidate) => candidate.chains.includes(last.id));
  if (group) remove = new Set(group.members);
  else if (space) remove = new Set(space.chains);

  const before = piece.stitches.slice(0, -1);
  const ringJoin =
    last.def === 'sl-st' && before.length > 0 && before.every((node) => node.def === 'ch')
      ? piece.events.find((candidate) => candidate.after === last.prev && candidate.kind === 'join-slip')
      : undefined;

  const stitches = piece.stitches.filter((node) => !remove.has(node.id));
  const result = done(
    withPiece(pattern, {
      ...piece,
      stitches,
      events: piece.events.filter((e) => !remove.has(e.after) && e !== ringJoin),
      groups: piece.groups.filter((g) => g.members.every((id) => !remove.has(id))),
      spaces: piece.spaces
        .filter((s) => !ringJoin || !s.chains.includes(ringJoin.after))
        .map((s) => ({ ...s, chains: s.chains.filter((id) => !remove.has(id)) }))
        .filter((s) => s.chains.length > 0),
      rings: piece.rings.filter((r) => !remove.has(r.node)),
      skipped: piece.skipped.filter((id) => !remove.has(id)),
    }),
  );
  return result.ok ? done(withoutStaleSkips(result.pattern)) : result;
}

/**
 * A gazdátlan kihagyások eldobása (PQW-938).
 *
 * Egy hely akkor számít áthidaltnak, ha VAN fölötte láncszem. Törléskor a
 * láncszem eltűnik, a jelölés viszont az alatta lévő SZEMRE mutat, amit nem
 * törölt senki — így a jelölés ott maradt gazdátlanul. A tulajdonos ezt látta:
 * egyetlen láncszemet tett le, és az a sor túlsó felére került, mert a rajz
 * árva jelölések közé osztotta szét.
 *
 * A szabály: két szem között annyi jelölés maradhat, ahány láncszem áll ott;
 * a fölös a haladási irány szerinti végéről esik ki. A korábbi sorok
 * jelöléseihez nem nyúlunk.
 */
export function withoutStaleSkips(pattern: Pattern): Pattern {
  const piece = pieceOf(pattern);
  if (piece.skipped.length === 0) return pattern;
  const context = contextOf(pattern);
  const layer = context.graph?.layers[context.layer];
  if (!layer || !context.graph) return pattern;

  const index = new Map(context.slots.map((slot, i) => [slotKey(slot), i]));
  const at = new Map(context.slots.map((slot, i) => [slot.id, i]));
  const marks = piece.skipped.filter((id) => at.has(id)).sort((a, b) => at.get(a)! - at.get(b)!);
  if (marks.length === 0) return pattern;

  const kept = new Set<NodeId>();
  let run = 0;
  let behind = -1;
  const claim = (ahead: number) => {
    for (const id of marks) {
      if (run === 0) break;
      const where = at.get(id)!;
      if (where <= behind || where >= ahead || kept.has(id)) continue;
      kept.add(id);
      run -= 1;
    }
    run = 0;
  };
  for (const id of layer.stitches) {
    const reach = (context.graph.nodes.get(id)?.anchors ?? [])
      .map((anchor) => index.get(anchorKey(anchor)))
      .filter((value): value is number => value !== undefined);
    if (reach.length > 0) {
      claim(Math.min(...reach));
      behind = Math.max(...reach);
      continue;
    }
    if (context.graph.defs.get(id)?.kind === 'chain' && !layer.turningChain.includes(id)) run += 1;
  }
  claim(context.slots.length);

  const skipped = piece.skipped.filter((id) => !at.has(id) || kept.has(id));
  return skipped.length === piece.skipped.length ? pattern : withPiece(pattern, { ...piece, skipped });
}

/** Kézi igazítás: eltolás a számolt helyhez képest. `null` visszaállítja. A topológián nem változtat. */
export function setPinned(pattern: Pattern, id: NodeId, offset: { readonly x: number; readonly y: number } | null): EditResult {
  const piece = pieceOf(pattern);
  if (!piece.stitches.some((node) => node.id === id)) return refuse(text('no-such-node', { id }));
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
    // Az ovális láncszeme kétszer célpont: a másik oldala a későbbi, ezért addig „még nincs kész” (PQW-899).
    if (slot.kind === 'stitch' || slot.kind === 'underside') slotIndex.set(slot.id, i);
    else if (slot.kind === 'space') for (const chain of slot.chains) slotIndex.set(chain, i);
    else if (slot.kind === 'ring') slotIndex.set(slot.node, i);
  });
  const inLayer = new Set(graph.layers[context.layer]!.stitches);
  // Az ovális 1. köre (PQW-899): amíg a másik oldalon nincs szem, a kör sornak látszik, a kezdése
  // pedig hibásnak (a sor a fordulólánc alapláncszemét is átugorja, a kör nem). A másik oldal első
  // szemével a gráf körnek látja, és a jelzés magától elmúlik.
  const ovalStart = context.oval && context.layer === 1 && graph.layers[0]!.undersides.length === 0;
  const pending = (finding: Finding) => {
    if (ovalStart && finding.rule === 'foundation-chain') return true;
    if (!PENDING_RULES.has(finding.rule)) return false;
    return finding.nodes.every((id) => inLayer.has(id) || (slotIndex.get(id) ?? -1) > context.frontier);
  };

  const remaining = context.used.filter((used, i) => !used && i > context.frontier).length;
  return { findings: findings.filter((finding) => !pending(finding)), remaining };
}
