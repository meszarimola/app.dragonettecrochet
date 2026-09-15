/*
 * A szemgráfból számolt sorok és körök (rétegek).
 *
 * A sor nincs eltárolva: a szemek sorrendjéből és a sor végi eseményekből
 * számoljuk (06 §5.1 elv 3, 06 §3.2 „layers”). Egy darab rétegei:
 * - 0. réteg: a láncalap vagy a varázskör;
 * - utána minden réteg az előző esemény utáni szemtől a következő esemény
 *   szeméig tart.
 *
 * Megállapodások, amelyekre az ellenőrző épít:
 * - A láncalap végén a be nem horgolt láncszemek az 1. sor fordulólánca, ezért
 *   az 1. réteghez tartoznak, nem a 0.-hoz (03 §1.2: a láncalap `N + T`).
 * - Japán hagyományban a számító fordulólánc alatti alapláncszem a 0. réteg
 *   utolsó pozíciója marad: a fordulólánc „áll” rajta (01 §8.3, tradition.ts).
 * - Később a sor elején álló láncszemek a fordulólánc vagy a kezdőlánc; a
 *   fordulás eseménye után következnek.
 * - Zárt körben a kör eleji kúszószemek a továbbvezetés, a záró kúszószem az
 *   esemény szeme; mindkettő a `joinSlipStitchCounts` szerint számít (D7).
 * - A számító fordulólánc egy szem, és egyetlen horgolható pozíciója a
 *   teteje, vagyis az utolsó láncszeme (03 §1.3). A nem számító fordulóláncba
 *   nem horgolunk (03 §10 A4).
 * - A többi láncszem mindig pozíció. A szemszámba a `chainCounts` szerint
 *   számít: alapból akkor, ha egy későbbi réteg beléjük horgol, egyenként
 *   vagy láncívként; a díszlánc nem (03 §10 B10, PQW-870). A 0. réteg
 *   szemszáma mindig 0.
 *
 * - Körben kezdődik a darab a varázskörrel, a láncgyűrűvel és a láncszembe
 *   horgolt, körként zárt 1. körrel (PQW-861); ilyenkor a 0. réteg is kör.
 *
 * Nem kezeli még: láncszem nélküli alapsort (foundation stitches, 03 §1.4), a
 * darabok összekapcsolását.
 */

import type { StitchLibrary } from './stitch-library.ts';
import { hasBaseChain, stitchTurningChainCounts, traditionOf, turningChainCountsFor } from './tradition.ts';
import type {
  Layer,
  LayerEvent,
  NodeId,
  Pattern,
  Piece,
  Ring,
  RingId,
  Space,
  SpaceId,
  StitchDef,
  StitchGroup,
  StitchNode,
} from './types.ts';

/** Egy réteg a gráfból számolva, az ellenőrzőhöz szükséges részletekkel. */
export interface LayerInfo extends Layer {
  /** A fordulólánc vagy a kezdőlánc láncszemei a fonal sorrendjében. */
  readonly turningChain: readonly NodeId[];
  readonly turningChainCounts: boolean;
  /** Az esemény, amely a réteget megnyitja; a 0. és az 1. rétegnél `null`. */
  readonly opening: LayerEvent | null;
  /** Az esemény a réteg utolsó szeme után; ha a darab esemény nélkül ér véget, `null`. */
  readonly closing: LayerEvent | null;
  /** Kúszószemek a zárt kör elején, amelyekkel a fonal a kezdőhelyre jut. */
  readonly travelSlips: readonly NodeId[];
  /** A kört záró kúszószem. */
  readonly joinSlip: NodeId | null;
  /** A sor első nem láncszem szeme a fordulólánc után; ez dönti el a fordulólánc magasságát. */
  readonly firstStitch: NodeId | null;
  /**
   * Haladási irány az előző réteg fonalsorrendjéhez képest: fordulás után és
   * a láncalapra `-1`, körben és a varázskörre `1` (01 §8.4 szabály 19–20).
   */
  readonly direction: 1 | -1;
  /** A következő réteg horgolható pozíciói a réteg fonalsorrendjében; a számító fordulólánc teteje elöl. */
  readonly positions: readonly NodeId[];
}

export interface PieceGraph {
  readonly piece: Piece;
  readonly nodes: ReadonlyMap<NodeId, StitchNode>;
  /** A szem helye a fonal útján (0-tól). */
  readonly order: ReadonlyMap<NodeId, number>;
  readonly defs: ReadonlyMap<NodeId, StitchDef>;
  readonly spaces: ReadonlyMap<SpaceId, Space>;
  readonly rings: ReadonlyMap<RingId, Ring>;
  readonly spaceOfChain: ReadonlyMap<NodeId, Space>;
  readonly groupOf: ReadonlyMap<NodeId, StitchGroup>;
  readonly layerOf: ReadonlyMap<NodeId, number>;
  readonly layers: readonly LayerInfo[];
}

/**
 * A darab gráfja rétegekkel. Szerkezetileg érvényes darabot vár (minden
 * hivatkozás létezik, minden szem a könyvtárban van); ezt a
 * `validatePattern` ellenőrzi előbb.
 */
export function buildPieceGraph(pattern: Pattern, piece: Piece, library: StitchLibrary): PieceGraph {
  const nodes = new Map(piece.stitches.map((node) => [node.id, node]));
  const order = new Map(piece.stitches.map((node, index) => [node.id, index]));
  const defs = new Map<NodeId, StitchDef>();
  for (const node of piece.stitches) {
    const def = library.get(node.def);
    if (!def) throw new Error(`Ismeretlen szem: ${node.def} (${node.id})`);
    defs.set(node.id, def);
  }
  const kindOf = (node: StitchNode) => defs.get(node.id)!.kind;

  const spaces = new Map(piece.spaces.map((space) => [space.id, space]));
  const rings = new Map(piece.rings.map((ring) => [ring.id, ring]));
  const spaceOfChain = new Map<NodeId, Space>();
  for (const space of piece.spaces) for (const chain of space.chains) spaceOfChain.set(chain, space);
  const groupOf = new Map<NodeId, StitchGroup>();
  for (const group of piece.groups) for (const member of group.members) groupOf.set(member, group);
  const eventAfter = new Map(piece.events.map((event) => [event.after, event]));

  // A 0. réteg: a varázskör, vagy a darab eleji láncszemek.
  const stitches = piece.stitches;
  let cursor = 0;
  let foundation: 'chain' | 'ring' | 'none' = 'none';
  const foundationNodes: StitchNode[] = [];
  if (stitches.length > 0 && kindOf(stitches[0]!) === 'ring') {
    foundation = 'ring';
    foundationNodes.push(stitches[0]!);
    cursor = 1;
  } else {
    while (cursor < stitches.length && kindOf(stitches[cursor]!) === 'chain') {
      foundationNodes.push(stitches[cursor]!);
      cursor += 1;
      if (eventAfter.has(stitches[cursor - 1]!.id)) break;
    }
    if (foundationNodes.length > 0) foundation = 'chain';
  }

  const segments: StitchNode[][] = [];
  let current: StitchNode[] = [];
  for (; cursor < stitches.length; cursor += 1) {
    const node = stitches[cursor]!;
    current.push(node);
    if (eventAfter.has(node.id)) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length > 0) segments.push(current);

  // Körben kezdődik a darab (PQW-861): varázskörrel; láncgyűrűvel, azaz a
  // kúszószemmel gyűrűvé zárt láncszemekkel (a zárás eseménye az utolsó
  // láncszem után áll, a kúszószem az 1. kör továbbvezetése); vagy a láncszembe
  // horgolt 1. körrel („2 lsz, 6 rp a 2. láncszembe”), amelyet kör zár.
  const roundEvent = (event: LayerEvent | undefined) => event?.kind === 'join-slip' || event?.kind === 'spiral';
  const chainRing = foundation === 'chain' && eventAfter.get(foundationNodes[foundationNodes.length - 1]!.id)?.kind === 'join-slip';
  const firstRoundOnChain = foundation === 'chain' && !chainRing && segments.length > 0 && roundEvent(eventAfter.get(segments[0]!.at(-1)!.id));
  const roundStart = foundation === 'ring' || chainRing || firstRoundOnChain;

  // Az 1. sor fordulólánca a láncalap végén: amibe az 1. sor nem horgol. A 2. sor
  // horgolhat a tetejébe, ha számít, ezért csak az 1. sor célpontjait nézzük.
  if (foundation === 'chain' && !chainRing && segments.length > 0) {
    const anchored = new Set<NodeId>();
    // A kört záró kúszószem a kezdőlánc tetejébe mehet: az nem az 1. kör célpontja.
    const segmentEnd = segments[0]!.at(-1)!;
    const closingSlip = kindOf(segmentEnd) === 'slip' && eventAfter.get(segmentEnd.id)?.kind === 'join-slip' ? segmentEnd : undefined;
    for (const node of segments[0]!) {
      if (node === closingSlip) continue;
      for (const anchor of node.anchors) {
        if (anchor.into === 'stitch') anchored.add(anchor.id);
        if (anchor.into === 'space') for (const chain of spaces.get(anchor.id)?.chains ?? []) anchored.add(chain);
      }
    }
    if (foundationNodes.some((node) => anchored.has(node.id))) {
      const trailing: StitchNode[] = [];
      while (foundationNodes.length > 0 && !anchored.has(foundationNodes[foundationNodes.length - 1]!.id)) {
        trailing.unshift(foundationNodes.pop()!);
      }
      // A láncalap felőli, szándékosan kihagyott láncszemek a láncalap részei: filében a nyitott cellával
      // kezdődő 1. sor alatt (03 §5.2). A horog felőli végén a meghagyott fordulólánc-tető a sorhoz tartozik.
      const skipped = new Set(piece.skipped);
      while (trailing.length > 0 && skipped.has(trailing[0]!.id)) foundationNodes.push(trailing.shift()!);
      // Japán hagyományban a számító fordulólánc egy alapláncszemen áll: az a láncalap része marad.
      const tradition = traditionOf(pattern.conventions);
      const first = segments[0]!.find((node) => kindOf(node) !== 'chain');
      const counts =
        first !== undefined && turningChainCountsFor(pattern.conventions.turningChainCounts, defs.get(first.id)!, tradition);
      // A láncszembe horgolt 1. körben nincs alapláncszem: a kör egyetlen láncszembe megy.
      if (!firstRoundOnChain && hasBaseChain(counts, tradition) && trailing.length >= 2) foundationNodes.push(trailing.shift()!);
      segments[0] = [...trailing, ...segments[0]!];
    }
  }

  // Amibe egy későbbi réteg horgol: a láncszem egyenként, a láncív minden láncszeme egészben (PQW-870).
  const segmentOf = new Map<NodeId, number>();
  segments.forEach((segment, i) => {
    for (const node of segment) segmentOf.set(node.id, i + 1);
  });
  const workedInto = new Set<NodeId>();
  for (const node of stitches) {
    const layer = segmentOf.get(node.id) ?? 0;
    for (const anchor of node.anchors) {
      const targets = anchor.into === 'stitch' ? [anchor.id] : anchor.into === 'space' ? (spaces.get(anchor.id)?.chains ?? []) : [];
      for (const target of targets) if ((segmentOf.get(target) ?? 0) < layer) workedInto.add(target);
    }
  }

  const { conventions } = pattern;
  const layers: LayerInfo[] = [];
  const layerOf = new Map<NodeId, number>();

  const foundationIds = foundationNodes.map((node) => node.id);
  const foundationLast = foundationNodes[foundationNodes.length - 1];
  layers.push({
    piece: piece.id,
    index: 0,
    shape: roundStart ? 'round' : 'row',
    stitches: foundationIds,
    stitchCount: 0,
    positionCount: foundationIds.length,
    side: 'right',
    turningChain: [],
    turningChainCounts: false,
    opening: null,
    closing: foundationLast ? (eventAfter.get(foundationLast.id) ?? null) : null,
    travelSlips: [],
    joinSlip: null,
    firstStitch: null,
    direction: 1,
    positions: foundationIds,
  });
  for (const id of foundationIds) layerOf.set(id, 0);

  segments.forEach((segment, segmentIndex) => {
    const index = segmentIndex + 1;
    const previous = layers[index - 1]!;
    const opening = previous.closing;
    const last = segment[segment.length - 1]!;
    const closing = eventAfter.get(last.id) ?? null;

    let head = 0;
    const travelSlips: NodeId[] = [];
    if (opening?.kind === 'join-slip') {
      // A záratlan kör végén álló kúszószem még nem záró szem, hanem továbbvezetés (pl. a láncgyűrű kúszószeme).
      while (head < segment.length && kindOf(segment[head]!) === 'slip' && (segment[head] !== last || closing === null)) {
        travelSlips.push(segment[head]!.id);
        head += 1;
      }
    }
    const turningChain: NodeId[] = [];
    // A fordulólánc után kezdődő láncív már a sor része: filében a nyitott cellás sor eleje „3 lsz, 2 lsz” (03 §5.2).
    const startsSpace = (node: StitchNode) => spaceOfChain.get(node.id)?.chains[0] === node.id;
    while (head < segment.length && kindOf(segment[head]!) === 'chain' && !(turningChain.length > 0 && startsSpace(segment[head]!))) {
      turningChain.push(segment[head]!.id);
      head += 1;
    }
    const firstStitch = segment.slice(head).find((node) => kindOf(node) !== 'chain')?.id ?? null;
    const joinSlip = closing?.kind === 'join-slip' && kindOf(last) === 'slip' ? last.id : null;

    let shape: Layer['shape'];
    if (opening === null) shape = roundStart ? 'round' : 'row';
    else if (opening.kind === 'turn') shape = 'row';
    else if (opening.kind === 'fasten-off') shape = previous.shape;
    else shape = 'round';

    const side: Layer['side'] =
      opening?.kind === 'turn' ? (previous.side === 'right' ? 'wrong' : 'right') : previous.side;

    let direction: 1 | -1;
    if (index === 1) direction = foundation === 'chain' && !roundStart ? -1 : 1;
    else direction = opening?.kind === 'turn' ? -1 : 1;

    let turningChainCounts = false;
    if (turningChain.length > 0) {
      const setting = opening?.conventions?.turningChainCounts ?? conventions.turningChainCounts;
      turningChainCounts =
        setting === 'stitch-default'
          ? firstStitch !== null && stitchTurningChainCounts(defs.get(firstStitch)!, traditionOf(conventions))
          : setting;
    }

    const turningSet = new Set(turningChain);
    const slipSet = new Set(travelSlips);
    if (joinSlip) slipSet.add(joinSlip);

    let stitchCount = turningChainCounts ? 1 : 0;
    let positionCount = stitchCount;
    const positions: NodeId[] = turningChainCounts ? [turningChain[turningChain.length - 1]!] : [];
    for (const node of segment) {
      if (turningSet.has(node.id)) continue;
      if (slipSet.has(node.id)) {
        const counted = conventions.joinSlipStitchCounts ? 1 : 0;
        stitchCount += counted;
        positionCount += counted;
        continue;
      }
      const def = defs.get(node.id)!;
      switch (def.kind) {
        case 'chain':
          if (conventions.chainCounts === true || (conventions.chainCounts === 'worked-into' && workedInto.has(node.id))) {
            stitchCount += 1;
          }
          positionCount += 1;
          positions.push(node.id);
          break;
        case 'ring':
          positionCount += 1;
          positions.push(node.id);
          break;
        case 'picot':
          if (conventions.picotCounts) {
            stitchCount += 1;
            positionCount += 1;
            positions.push(node.id);
          }
          break;
        default:
          stitchCount += def.produces;
          positionCount += def.produces;
          positions.push(node.id);
      }
    }

    const ids = segment.map((node) => node.id);
    for (const id of ids) layerOf.set(id, index);
    layers.push({
      piece: piece.id,
      index,
      shape,
      stitches: ids,
      stitchCount,
      positionCount,
      side,
      turningChain,
      turningChainCounts,
      opening,
      closing,
      travelSlips,
      joinSlip,
      firstStitch,
      direction,
      positions,
    });
  });

  return { piece, nodes, order, defs, spaces, rings, spaceOfChain, groupOf, layerOf, layers };
}

/**
 * A láncív horgolható pozíciói az alatta lévő rétegben. A számító
 * fordulóláncból álló láncívnek (a C2C-csempe láncíve, 03 §5.5) egyetlen
 * pozíciója van: a fordulólánc teteje (03 §1.3).
 */
export function spacePositions(below: LayerInfo, space: Space): readonly NodeId[] {
  const { turningChain } = below;
  const whole =
    below.turningChainCounts && space.chains.length === turningChain.length && space.chains.every((id, i) => id === turningChain[i]);
  return whole ? [turningChain[turningChain.length - 1]!] : space.chains;
}

/** A minta összes rétege darabonként, a `types.ts` `Layer` alakjában. */
export function computeLayers(pattern: Pattern, library: StitchLibrary): Layer[] {
  return pattern.pieces.flatMap((piece) =>
    buildPieceGraph(pattern, piece, library).layers.map(
      ({ piece: pieceId, index, shape, stitches, stitchCount, positionCount, side }) => ({
        piece: pieceId,
        index,
        shape,
        stitches,
        stitchCount,
        positionCount,
        side,
      }),
    ),
  );
}
