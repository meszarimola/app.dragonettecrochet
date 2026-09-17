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
 * - A számító fordulólánc alatti alapláncszem a 0. réteg utolsó pozíciója
 *   marad: a fordulólánc „áll” rajta (PQW-891, tradition.ts).
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
import { stitchTurningChainCounts, traditionOf } from './tradition.ts';
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
  /**
   * A láncalap láncszemei, amelyeknek a másik oldalába is horgol az 1. kör (az
   * ovális kezdés, 04 §3.4, PQW-890), fonalsorrendben; csak a 0. rétegen, máskor üres.
   */
  readonly undersides: readonly NodeId[];
}

/**
 * Egy sor két széle: az eleje a fordulólánc teteje (ennek híján az első
 * pozíció), a vége az utolsó pozíció. A ruhadarabok sorvégi varrásához kell
 * (amigurumi.ts `sewnEdge`, PQW-866).
 */
export function rowEdges(layer: LayerInfo): { readonly start: NodeId; readonly end: NodeId } | null {
  const start = layer.turningChain[layer.turningChain.length - 1] ?? layer.positions[0];
  const end = layer.positions[layer.positions.length - 1];
  return start === undefined || end === undefined ? null : { start, end };
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
  // Az ovális 1. köre (PQW-890) a láncszemek másik oldalába is horgol: kör akkor is, ha a darab ott véget ér.
  const firstRoundOnChain =
    foundation === 'chain' &&
    !chainRing &&
    segments.length > 0 &&
    (roundEvent(eventAfter.get(segments[0]!.at(-1)!.id)) || segments[0]!.some((node) => node.anchors.some((anchor) => anchor.into === 'underside')));
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
        if (anchor.into === 'stitch' || anchor.into === 'underside') anchored.add(anchor.id);
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
      /*
       * Az „alapláncszem” fogalma megszűnt (PQW-924): a láncalap elején a
       * táblázat szerinti láncszemeket hagyjuk ki, és nincs külön, a láncalaphoz
       * sorolt láncszem a fordulólánc alatt.
       */
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
      const targets = anchor.into === 'stitch' || anchor.into === 'underside' ? [anchor.id] : anchor.into === 'space' ? (spaces.get(anchor.id)?.chains ?? []) : [];
      for (const target of targets) if ((segmentOf.get(target) ?? 0) < layer) workedInto.add(target);
    }
  }

  const { conventions } = pattern;
  const layers: LayerInfo[] = [];
  const layerOf = new Map<NodeId, number>();

  // Az ovális kezdés (PQW-890): a láncalap láncszemeinek másik oldala is célpont.
  const undersideTargets = new Set(stitches.flatMap((node) => node.anchors.flatMap((anchor) => (anchor.into === 'underside' ? [anchor.id] : []))));
  const foundationIds = foundationNodes.map((node) => node.id);
  const foundationLast = foundationNodes[foundationNodes.length - 1];
  layers.push({
    piece: piece.id,
    index: 0,
    below: 0,
    row: 0,
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
    undersides: foundationIds.filter((id) => undersideTargets.has(id)),
  });
  for (const id of foundationIds) layerOf.set(id, 0);

  segments.forEach((segment, segmentIndex) => {
    const index = segmentIndex + 1;
    const opening = layers[index - 1]!.closing;
    // Elvágott fonal után a szakasz a megadott sor fölött folytatódik (PQW-901): a nyakkivágás két oldalán a két váll.
    const resume = opening?.kind === 'fasten-off' ? opening.resume : undefined;
    const below = resume !== undefined && resume.layer >= 0 && resume.layer < index ? resume.layer : index - 1;
    // Két forrásból horgoló kör (PQW-908): a második réteg pozíciói a `below` pozíciói után jönnek.
    const alsoBelow = resume?.with !== undefined && resume.with > below && resume.with < index ? resume.with : undefined;
    const previous = layers[below]!;
    const last = segment[segment.length - 1]!;
    const closing = eventAfter.get(last.id) ?? null;

    let head = 0;
    const travelSlips: NodeId[] = [];
    if (opening?.kind === 'join-slip' || opening?.kind === 'turn') {
      // A záratlan kör végén álló kúszószem még nem záró szem, hanem továbbvezetés (pl. a láncgyűrű kúszószeme).
      while (head < segment.length && kindOf(segment[head]!) === 'slip' && (segment[head] !== last || closing === null)) {
        travelSlips.push(segment[head]!.id);
        head += 1;
      }
      // Fordulás után a sor eleji kúszószem csak akkor továbbvezetés, ha fordulólánc követi (filé sor eleji fogyasztás,
      // PQW-894). Ha láncív jön utána, a kúszószem a sor része (C2C: kúszószemek a csempén át a láncívbe).
      const next = segment[head];
      const turning = next !== undefined && kindOf(next) === 'chain' && !spaceOfChain.has(next.id);
      if (opening.kind === 'turn' && !turning) {
        head = 0;
        travelSlips.length = 0;
      }
    }
    const turningChain: NodeId[] = [];
    /*
     * A fordulólánc után kezdődő láncív már a sor része: filében a nyitott
     * cellás sor eleje „3 lsz, 2 lsz” (03 §5.2). Az 1. sorban a láncalap végén
     * álló láncív sem fordulólánc: a C2C csempéjének nyitó három láncszeme
     * `ch-3 space`, amibe a következő sor csempéje horgol (03 §5.5).
     */
    const startsSpace = (node: StitchNode) => spaceOfChain.get(node.id)?.chains[0] === node.id;
    while (
      head < segment.length &&
      kindOf(segment[head]!) === 'chain' &&
      !((turningChain.length > 0 || index === 1) && startsSpace(segment[head]!))
    ) {
      turningChain.push(segment[head]!.id);
      head += 1;
    }
    // A sort kezdő szem dönti el a fordulólánc magasságát; a lejjebb horgolt hosszú szem nem ilyen (mozaik, PQW-894).
    const rest = segment.slice(head).filter((node) => kindOf(node) !== 'chain');
    const firstStitch = (rest.find((node) => !node.flags?.includes('spike')) ?? rest[0])?.id ?? null;
    // A zárt kör utolsó szeme a záró kúszószem. Ha a kör után a fonal elvágásával másik szakasznál folytatódik
    // a munka (PQW-908: a raglán ujja), ugyanaz a kúszószem viszi a fonal elvágását is: attól még záró szem.
    const joined = closing?.kind === 'join-slip' || (closing?.kind === 'fasten-off' && closing.resume !== undefined);
    const joinSlip = joined && kindOf(last) === 'slip' ? last.id : null;

    let shape: Layer['shape'];
    if (opening === null) shape = roundStart ? 'round' : 'row';
    else if (opening.kind === 'turn') shape = 'row';
    else if (opening.kind === 'fasten-off') shape = previous.shape;
    else shape = 'round';

    // Az újrakezdett szakasz a megadott sor fölött ugyanúgy indul, mint fordulás után: a másik oldaláról halad.
    // A két forrásból horgoló kör (PQW-908) viszont körben folytatódik: ugyanabban az irányban, ugyanazzal az oldallal.
    const resumedRound = resume?.with !== undefined;
    const side: Layer['side'] =
      (opening?.kind === 'turn' || resume !== undefined) && !resumedRound ? (previous.side === 'right' ? 'wrong' : 'right') : previous.side;

    let direction: 1 | -1;
    if (index === 1) direction = foundation === 'chain' && !roundStart ? -1 : 1;
    else direction = (opening?.kind === 'turn' || resume !== undefined) && !resumedRound ? -1 : 1;

    let turningChainCounts = false;
    if (turningChain.length > 0) {
      const setting = opening?.conventions?.turningChainCounts ?? conventions.turningChainCounts;
      turningChainCounts =
        setting === 'stitch-default'
          ? firstStitch !== null && stitchTurningChainCounts(defs.get(firstStitch)!, traditionOf(conventions), shape)
          : setting;
    }

    const turningSet = new Set(turningChain);
    const slipSet = new Set(travelSlips);
    if (joinSlip) slipSet.add(joinSlip);

    /*
     * Sorban a fordulólánc nem szem (PQW-924): sem a szemszámba, sem a sor
     * pozícióiba nem számít bele. A sor szemszáma a ténylegesen belehorgolt
     * szemek száma, a következő sor pedig minden szembe horgol egyet.
     *
     * Körben a kezdőlánc („3 lsz = 1 pálca”) változatlanul szem marad: arról a
     * tulajdonos szabálya nem szól, és a szemkönyvtár alapértelmezése dönti el.
     */
    const startingChainCounts = shape === 'round' && turningChainCounts;
    let stitchCount = startingChainCounts ? 1 : 0;
    let positionCount = stitchCount;
    const positions: NodeId[] = startingChainCounts ? [turningChain[turningChain.length - 1]!] : [];
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
      below,
      ...(alsoBelow === undefined
        ? {}
        : { alsoBelow, basePositions: baseRing(layers[below]!, layers[alsoBelow]!, segment, defs, new Set(piece.skipped)) }),
      // A kiírt sorszám az alatta lévő sorét követi: az újrakezdett szakaszban ezért indul újra (PQW-901).
      row: previous.row + 1,
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
      undersides: [],
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
      ({ piece: pieceId, index, below, row, shape, stitches, stitchCount, positionCount, side }) => ({
        piece: pieceId,
        index,
        below,
        row,
        shape,
        stitches,
        stitchCount,
        positionCount,
        side,
      }),
    ),
  );
}

/**
 * A kétforrású kör alapgyűrűje (PQW-908). A raglán ujja a vállrész kihagyott szemeibe és a
 * szétosztás hónaljláncába kapaszkodik: ez a kettő a hónaljnál összeér, a köztük lévő testszemek
 * pedig nem részei a csőnek. A futamokat szerkezetileg választjuk ki (kihagyott szemek, illetve
 * láncszemek), a horgolt szemek csak azt döntik el, *melyik* futamról van szó — így az ellenőrző
 * továbbra is észreveszi, ha a kör a saját gyűrűjén belül ugrik át egy szemet.
 */
function baseRing(
  below: LayerInfo,
  also: LayerInfo,
  segment: readonly StitchNode[],
  defs: Map<NodeId, StitchDef>,
  skipped: ReadonlySet<NodeId>,
): NodeId[] {
  const targets = new Set<NodeId>();
  for (const node of segment) for (const anchor of node.anchors) if (anchor.into === 'stitch') targets.add(anchor.id);
  const run = (positions: readonly NodeId[], member: (id: NodeId) => boolean) => {
    const at = positions.findIndex((id) => targets.has(id) && member(id));
    if (at < 0) return [];
    let from = at;
    let to = at;
    while (from > 0 && member(positions[from - 1]!)) from -= 1;
    while (to < positions.length - 1 && member(positions[to + 1]!)) to += 1;
    return positions.slice(from, to + 1);
  };
  return [...run(below.positions, (id) => skipped.has(id)), ...run(also.positions, (id) => defs.get(id)!.kind === 'chain')];
}
