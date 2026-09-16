/*
 * Az írott minta nyelvfüggetlen lépéssora a gráfból (06 §5.3 pont 5).
 *
 * Rétegenként végigmegyünk a szemeken a fonal útján, és mindegyiket egy
 * lépéssé alakítjuk, amely az előző réteg pozícióihoz képest mondja meg, hová
 * megy. A szöveg (pattern-text.ts) ebből készül, a visszaolvasás
 * (pattern-read.ts) ugyanezt a jelentést olvassa vissza.
 *
 * A célpont jelentése egy kurzorhoz kötött, amely az előző réteg pozícióin
 * halad a haladási irányban:
 * - `next`: a kurzor alatti pozíció, utána a kurzor továbblép. Kiírva nincs
 *   helyhatározó: „5 rp” öt egymás utáni pozícióba megy.
 * - `same`: ugyanaz a pozíció, mint az előző célpont. Ha a sor fordulólánca
 *   számít, a sor elején ez a fordulólánc alatti szem (03 §1.3), és a kurzor
 *   ezért az 1. pozíción kezd.
 * - `next-space`: az első láncív a kurzortól; a közbeeső szemeket kihagyjuk,
 *   ahogy a minták is írják („3 erp a következő láncívbe”).
 * - `same-space`, `ring`: az előző láncív, illetve a varázskör.
 * - `chain-ring`: a láncgyűrű (PQW-861).
 * - `none`: nem horgolunk bele semmibe (pikó).
 *
 * Megállapodások a visszaolvasáshoz:
 * - A sor közbeni láncszemek mindig egy láncívet adnak (01 §8.2 szabály 11).
 * - Visszai soron az első és a hátsó szál, illetve a relief megfordul, mert a
 *   gráf a színoldali látványt tárolja (03 §2.1, 01 §8.4 szabály 21).
 *
 * Nem írható ki még: keresztezett és hosszú szem, több célpontú szem
 * fogyasztáson kívül, láncalap nélküli darab, darabok összekapcsolása.
 */

import { borderLayerIndex, borderOf, borderOfLayer, type BorderCounts } from './border.ts';
import { buildPieceGraph, spacePositions, type PieceGraph } from './graph.ts';
import { modeAsWorked } from './insertion.ts';
import { nested, text, type CoreData, type CoreText } from './messages.ts';
import type { StitchLibrary } from './stitch-library.ts';
import { hasBaseChain, traditionOf } from './tradition.ts';
import { gridColorRows, type ColorRun } from './pixel-chart.ts';
import type {
  Anchor,
  GridTechnique,
  LayerEvent,
  NodeId,
  Pattern,
  PatternColor,
  Piece,
  RoundMark,
  StitchDef,
  StitchDefId,
  StitchInsertion,
  Tradition,
} from './types.ts';

/** A `down`: hosszú szem korábbi sorba (PQW-894); a lépés `depth` mezője mondja meg, hány sorral lejjebb. */
export type StepTarget = 'next' | 'same' | 'next-space' | 'same-space' | 'ring' | 'chain-ring' | 'none' | 'down';

/** A szín, amelyre a lépés utolsó szemének utolsó ráhajtásánál váltasz (03 §6, §10 G35, PQW-864). */
interface ColorChange {
  readonly changeTo?: number;
}

export type Step =
  | ({
      readonly kind: 'stitch';
      readonly def: StitchDefId;
      readonly count: number;
      readonly target: StepTarget;
      /** A horgoló felől nézett beszúrás: visszai soron már megfordítva. */
      readonly mode: StitchInsertion;
      /** Láncszembe vagy szembe megy; csak a kiírt helyhatározóhoz kell. */
      readonly into: 'stitch' | 'chain';
      /** `down` célpontnál: hány sorral lejjebb (2 vagy 3). */
      readonly depth?: number;
    } & ColorChange)
  | ({
      readonly kind: 'group';
      readonly def: StitchDefId;
      readonly target: StepTarget;
      readonly mode: StitchInsertion;
      readonly into: 'stitch' | 'chain';
    } & ColorChange)
  | ({ readonly kind: 'chain'; readonly count: number } & ColorChange)
  | { readonly kind: 'skip'; readonly count: number; readonly what: 'stitch' | 'chain' | 'space' }
  | ({ readonly kind: 'turning-chain'; readonly count: number; readonly countsAs: StitchDefId | null } & ColorChange)
  | { readonly kind: 'repeat'; readonly steps: readonly Step[]; readonly times: number }
  /** Az ovális 1. körében a láncszemek másik oldalára fordulás (PQW-890). */
  | { readonly kind: 'other-side' };

export interface WrittenLayer {
  /** A réteg sorszáma a gráfban; ez azonosítja a réteget. */
  readonly index: number;
  /** A kiírt sorszám: az újrakezdett szakaszban újraindul (PQW-901). */
  readonly row: number;
  readonly shape: 'row' | 'round';
  readonly side: 'right' | 'wrong';
  /** Az 1. sor a láncalapon: a horogtól számított hányadik láncszemnél kezd, és mit ér a kihagyott rész. */
  readonly fromHook: {
    readonly chain: number;
    readonly countsAs: StitchDefId | null;
    /**
     * A láncalap folytatásaként kiírt sor eleji láncszemek: számító
     * fordulóláncnál a láncív és a kihagyott láncszemek a láncalapba kerülnek
     * (filé nyitott kezdés: 3N + 6 lsz, a 9. láncszemtől, 03 §5.2, PQW-891). Máskor 0.
     */
    readonly chains: number;
    /**
     * A kihagyás után minden megmaradt láncszembe pontosan egy szem kerül, sorban,
     * egyetlen tételben: „minden láncszembe 1 rp” (PQW-895).
     */
    readonly eachChain: boolean;
  } | null;
  readonly steps: readonly Step[];
  /** Szemszám, ahogy a gráf számolja (graph.ts). */
  readonly stitchCount: number;
  readonly closing: LayerEvent['kind'] | null;
  /** A kört záró kúszószem célpontja. */
  readonly joinTo: 'turning-chain' | 'first-stitch' | null;
  /** A következő kör új színnel kezdődik (PQW-861). */
  readonly colorChange: boolean;
  /** A spirál lépcsőjavítása a színváltásnál. */
  readonly jogFix: LayerEvent['jogFix'] | null;
  /** Jelölések a kör után: szem, tömés, a nyílás összehúzása (PQW-863). */
  readonly marks: readonly RoundMark[];
}

export interface WrittenPiece {
  readonly name: string;
  readonly foundation:
    | { readonly kind: 'chain'; readonly count: number }
    | { readonly kind: 'ring' }
    | { readonly kind: 'chain-ring'; readonly count: number };
  readonly layers: readonly WrittenLayer[];
  /**
   * A darab részei (PQW-863): a folytatólagosan kapcsolt rész neve az első
   * köre előtt áll. Az elvágott fonal után újrakezdett szakasznál (PQW-901) az
   * `over` mondja meg, melyik sor fölött folytatódik.
   */
  readonly sections: readonly { readonly name: string; readonly layer: number; readonly over?: number }[];
  /** A szegély a sorok után, a sorokból számolva (PQW-862); szegély nélkül `null`. */
  readonly border: WrittenBorder | null;
  /** Többszínű rácsmintánál (PQW-864) a színek, a kezdőszín és a színek soronként; máskor `null`. */
  readonly colorwork: {
    readonly technique: GridTechnique;
    readonly colors: readonly PatternColor[];
    readonly startColor: number;
    readonly rows: readonly (readonly ColorRun[])[];
  } | null;
}

export interface WrittenBorder {
  readonly stitch: StitchDefId;
  readonly counts: BorderCounts;
}

/**
 * Amit egy sorról vagy körről nem tudunk kiírni (PQW-904): a mondat vége. A
 * sorszám, a sor/kör szava és a névelő a `layer-unsupported` burkolóé, tehát a
 * felület szótáráé — a mag csak azt mondja meg, MI a baj.
 */
export type UnsupportedCode =
  | 'row-end-stitch'
  | 'underside-place'
  | 'underside-backwards'
  | 'space-misplaced'
  | 'space-backwards'
  | 'stitch-misplaced'
  | 'stitch-backwards'
  | 'crossed'
  | 'group-start'
  | 'group-chains'
  | 'group-target'
  | 'chain-run'
  | 'stitch-kind'
  | 'decrease-targets'
  | 'decrease-used'
  | 'anchor-count'
  | 'join-target';

/**
 * Az írott minta hibái kódként; a mondatot a felület szótára írja
 * (`src/ui/i18n/core/written.ts`).
 *
 * - `layer-unsupported`: a sorra vagy körre mutató burkoló; az adatában az
 *   `inner` egy `UnsupportedCode`, az `index` a sorszám, a `shape` a sor/kör.
 * - `border-failed`: a szegély indoka a `border.ts`-ből jön, beágyazva; annak
 *   szövegét a szegély szótára adja (`src/ui/i18n/core/shape.ts`).
 */
export type WrittenCode = 'needs-foundation' | 'foundation-event' | 'border-failed' | 'border-missing' | 'layer-unsupported' | UnsupportedCode;

/** A gráf olyan része, amelyet az írott minta még nem tud kifejezni. */
export class WrittenPatternError extends Error {
  readonly code: WrittenCode;
  readonly data: CoreData | undefined;
  readonly nodes: readonly NodeId[];

  constructor(message: CoreText<WrittenCode>, nodes: readonly NodeId[] = []) {
    // Az `Error.message` maga a kód: a fejlesztői napló így is olvasható marad.
    super(message.code);
    this.code = message.code;
    this.data = message.data;
    this.nodes = nodes;
  }

  /** A hiba kódja és adata egy üzenetként, a felület szótárának. */
  get coreText(): CoreText<WrittenCode> {
    return this.data === undefined ? { code: this.code } : { code: this.code, data: this.data };
  }
}

/** A `nested()` kódja általános; ezen a területen a szűk kódkészlet érvényes. */
function wrap(code: WrittenCode, inner: CoreText): CoreText<WrittenCode> {
  return nested(code, inner) as CoreText<WrittenCode>;
}

export function writtenPieces(pattern: Pattern, library: StitchLibrary): WrittenPiece[] {
  return pattern.pieces.map((piece) => writtenPiece(pattern, piece, library));
}

function writtenPiece(pattern: Pattern, piece: Piece, library: StitchLibrary): WrittenPiece {
  const graph = buildPieceGraph(pattern, piece, library);
  const base = graph.layers[0]!;
  const first = base.stitches[0];
  if (first === undefined) throw new WrittenPatternError(text('needs-foundation'));
  const onChain = graph.defs.get(first)!.kind === 'chain';
  // A láncgyűrű zárása az egyetlen esemény, amely a láncalapon állhat (PQW-861).
  const chainRing = onChain && base.shape === 'round' && base.closing?.kind === 'join-slip';
  if (base.closing !== null && !chainRing) throw new WrittenPatternError(text('foundation-event'), [base.closing.after]);

  const row1 = graph.layers[1];
  const kind: WrittenPiece['foundation']['kind'] = chainRing ? 'chain-ring' : onChain ? 'chain' : 'ring';
  // A szegély rétege (PQW-889) nem sor: a szegély mondata írja le.
  const borderIndex = borderLayerIndex(graph);
  const layers = graph.layers
    .slice(1)
    .flatMap((layer, i) => (layer.border ? [] : [writtenLayer(graph, i + 1, kind, library, traditionOf(pattern.conventions))]));
  const foundation: WrittenPiece['foundation'] = chainRing
    ? { kind: 'chain-ring', count: base.stitches.length }
    : onChain
      ? { kind: 'chain', count: base.stitches.length + (row1?.turningChain.length ?? 0) + (layers[0]?.fromHook?.chains ?? 0) }
      : { kind: 'ring' };
  let border: WrittenBorder | null = null;
  if (piece.border) {
    // A PQW-889 előtti mentésben a szegélynek még nincs rétege: ott a sorokból számolunk.
    const result = borderIndex >= 0 ? borderOfLayer(graph, borderIndex, piece.border) : borderOf(graph, piece.border);
    // A szegély indoka a border.ts kódja; a szövegét a szegély szótára adja.
    if (!result.ok) throw new WrittenPatternError(wrap('border-failed', result.reason));
    border = { stitch: piece.border.stitch, counts: result.counts };
  } else if (borderIndex >= 0) {
    throw new WrittenPatternError(text('border-missing'), graph.layers[borderIndex]!.stitches);
  }
  const sections: WrittenPiece['sections'] = [
    ...(piece.sections ?? []).map(({ name, layer }) => ({ name, layer })),
    // Elvágott fonal után új szakasz (PQW-901): a neve és a sor, amely fölött folytatódik.
    ...graph.layers.flatMap((candidate) => {
      const resume = candidate.opening?.kind === 'fasten-off' ? candidate.opening.resume : undefined;
      return resume?.name === undefined ? [] : [{ name: resume.name, layer: candidate.index, over: graph.layers[candidate.below]!.row }];
    }),
  ];
  const grid = piece.grid;
  const colorwork: WrittenPiece['colorwork'] =
    grid && grid.colors.length > 1
      ? { technique: grid.technique, colors: grid.colors, startColor: piece.stitches[0]?.color ?? 0, rows: gridColorRows(grid.technique, grid.cells) }
      : null;
  return { name: piece.name, foundation, layers, border, sections, colorwork };
}

/** A horgoló felől nézett beszúrás: visszai soron a szálak és a relief megfordulnak (insertion.ts). */
export { modeAsWorked };

/** Aminek a számító fordulólánc számít: a sort kezdő szem, összetett szemnél a részszeme. */
export function countsAsOf(def: StitchDef): StitchDefId {
  return def.kind === 'joined' ? def.part : def.id;
}

type Last = { readonly kind: 'stitch'; readonly w: number } | { readonly kind: 'space'; readonly id: string } | null;

function writtenLayer(
  graph: PieceGraph,
  index: number,
  start: WrittenPiece['foundation']['kind'],
  library: StitchLibrary,
  tradition: Tradition,
): WrittenLayer {
  const layer = graph.layers[index]!;
  // Alapból az előző sor; elvágott fonal után a megadott sor fölött folytatódik (PQW-901).
  const below = graph.layers[layer.below]!;
  // Az ovális 1. köre (PQW-890): elöl a horogtól távolodva, utána a láncszemek másik oldalán vissza.
  const oval = index === 1 && below.undersides.length > 0;
  // A kétforrású kör (PQW-908: a raglán ujja) a saját alapgyűrűjén halad: a vállrész kihagyott
  // szemein és a hónaljláncon, nem az alatta lévő teljes körön.
  const base = layer.basePositions ?? below.positions;
  const front = layer.direction === 1 && !oval ? base : [...base].reverse();
  const working = oval ? [...front, ...below.positions] : front;
  const workingIndex = new Map(front.map((id, w) => [id, w]));
  const undersideIndex = new Map<NodeId, number>(oval ? below.positions.map((id, k) => [id, front.length + k]) : []);
  let otherSide = false;
  const defOf = (id: NodeId) => graph.defs.get(id)!;
  const countsAs = layer.firstStitch !== null && layer.turningChainCounts ? countsAsOf(defOf(layer.firstStitch)) : null;
  const hookRow = index === 1 && start === 'chain';
  const ringSpace = start === 'chain-ring' ? graph.spaceOfChain.get(graph.layers[0]!.stitches[0]!)?.id : undefined;
  // Az 1. sor számító fordulólánca egy alapláncszemen áll; abba nem horgolunk (PQW-891). A láncszembe horgolt 1. körben nincs ilyen.
  const baseChain = hookRow && layer.shape === 'row' && hasBaseChain(layer.turningChainCounts, tradition);

  const steps: Step[] = [];
  // Fordulás után a sor eleji kúszószemek a cellák fölött haladnak (filé fogyasztás, PQW-894): a kurzor a sor elejéről indul.
  const slipsFirst = layer.opening?.kind === 'turn' && layer.travelSlips.length > 0;
  const cursorStart = !slipsFirst && (index >= 2 || baseChain) && layer.turningChainCounts ? 1 : 0;
  let cursor = cursorStart;
  let last: Last = cursorStart === 1 ? { kind: 'stitch', w: 0 } : null;

  const skip = (from: number, to: number) => {
    if (to <= from) return;
    const allChains = working.slice(from, to).every((id) => defOf(id).kind === 'chain');
    steps.push({ kind: 'skip', count: to - from, what: allChains ? 'chain' : 'stitch' });
  };

  const classify = (anchor: Anchor, owner: NodeId): { target: StepTarget; mode: StitchInsertion; into: 'stitch' | 'chain' } => {
    if (anchor.into === 'ring') return { target: 'ring', mode: 'both-loops', into: 'stitch' };
    if (anchor.into === 'row-end') throw unsupported('row-end-stitch', owner);
    if (anchor.into === 'underside') {
      const w = undersideIndex.get(anchor.id);
      // A legtávolabbi láncszem másik oldalát a vége körbeéri: arra külön lépés nem íródik ki.
      if (w === undefined || w === front.length) throw unsupported('underside-place', owner);
      if (!otherSide) {
        steps.push({ kind: 'other-side' });
        otherSide = true;
        last = null;
        cursor = Math.max(cursor, front.length + 1);
      }
      if (last?.kind === 'stitch' && last.w === w) return { target: 'same', mode: 'both-loops', into: 'chain' };
      if (w < cursor) throw unsupported('underside-backwards', owner);
      skip(cursor, w);
      cursor = w + 1;
      last = { kind: 'stitch', w };
      return { target: 'next', mode: 'both-loops', into: 'chain' };
    }
    if (anchor.into === 'space') {
      if (anchor.id === ringSpace) return { target: 'chain-ring', mode: 'both-loops', into: 'stitch' };
      const chains = spacePositions(below, graph.spaces.get(anchor.id)!).map((id) => workingIndex.get(id));
      if (chains.some((w) => w === undefined)) throw unsupported('space-misplaced', owner);
      const min = Math.min(...(chains as number[]));
      const max = Math.max(...(chains as number[]));
      let target: StepTarget;
      if (last?.kind === 'space' && last.id === anchor.id) target = 'same-space';
      else if (min >= cursor) {
        const passed = new Set<string>();
        for (let w = cursor; w < min; w += 1) {
          const space = graph.spaceOfChain.get(working[w]!);
          if (space) passed.add(space.id);
        }
        if (passed.size > 0) steps.push({ kind: 'skip', count: passed.size, what: 'space' });
        target = 'next-space';
        cursor = max + 1;
      } else throw unsupported('space-backwards', owner);
      last = { kind: 'space', id: anchor.id };
      return { target, mode: 'both-loops', into: 'stitch' };
    }

    const w = workingIndex.get(anchor.id);
    if (w === undefined) throw unsupported('stitch-misplaced', owner);
    const mode = modeAsWorked(anchor.mode, layer.side);
    const into = defOf(anchor.id).kind === 'chain' ? 'chain' : 'stitch';
    if (last?.kind === 'stitch' && last.w === w) return { target: 'same', mode, into };
    if (w < cursor) throw unsupported('stitch-backwards', owner);
    skip(cursor, w);
    cursor = w + 1;
    last = { kind: 'stitch', w };
    return { target: 'next', mode, into };
  };

  // A sorszám és a sor/kör szava adat marad: a mondatot a felület szótára rakja össze.
  const unsupported = (reason: UnsupportedCode, node: NodeId) =>
    new WrittenPatternError(wrap('layer-unsupported', text(reason, { index, shape: layer.shape })), [node]);

  // Színváltás: az előző szem utolsó ráhajtásánál, vagyis az előző lépésnél (03 §6, §10 G35).
  const colorOf = (nodeId: NodeId) => graph.nodes.get(nodeId)!.color ?? 0;
  const markChange = (color: number) => {
    for (let k = steps.length - 1; k >= 0; k -= 1) {
      const step = steps[k]!;
      if (step.kind === 'skip' || step.kind === 'other-side') continue;
      if (step.kind !== 'repeat') steps[k] = { ...step, changeTo: color };
      return;
    }
  };

  const handled = new Set<NodeId>();
  const stitches = layer.stitches;
  for (let i = 0; i < stitches.length; i += 1) {
    const id = stitches[i]!;
    const previousNode = graph.nodes.get(id)!.prev;
    if (previousNode !== null && colorOf(previousNode) !== colorOf(id)) markChange(colorOf(id));
    // A láncgyűrű kúszószeme a kezdés része, a láncgyűrű sora írja le.
    if (handled.has(id) || id === layer.joinSlip || (ringSpace !== undefined && index === 1 && layer.travelSlips.includes(id))) continue;
    const node = graph.nodes.get(id)!;
    const def = defOf(id);
    if (node.flags?.includes('crossed')) throw unsupported('crossed', id);

    if (layer.turningChain.includes(id)) {
      for (const chain of layer.turningChain) handled.add(chain);
      if (!hookRow) steps.push({ kind: 'turning-chain', count: layer.turningChain.length, countsAs });
      // A kúszószemek után a fordulólánc az utolsó átkúszott pozíción áll.
      if (slipsFirst) last = { kind: 'stitch', w: cursor - 1 };
      continue;
    }

    const group = graph.groupOf.get(id);
    if (group) {
      if (group.members[0] !== id) throw unsupported('group-start', id);
      for (const member of group.members) handled.add(member);
      const chains = group.members.filter((member) => defOf(member).kind === 'chain');
      if (chains.some((chain) => graph.spaceOfChain.get(chain)?.chains.every((c) => chains.includes(c)) !== true)) {
        throw unsupported('group-chains', id);
      }
      const anchored = group.members.map((member) => graph.nodes.get(member)!).find((member) => member.anchors.length > 0);
      if (!anchored || anchored.anchors.length !== 1) throw unsupported('group-target', id);
      steps.push({ kind: 'group', def: group.def, ...classify(anchored.anchors[0]!, id) });
      continue;
    }

    switch (def.kind) {
      case 'chain': {
        const run = [id];
        while (i + 1 < stitches.length && defOf(stitches[i + 1]!).kind === 'chain' && !graph.groupOf.has(stitches[i + 1]!)) {
          i += 1;
          run.push(stitches[i]!);
        }
        const space = graph.spaceOfChain.get(id);
        if (!space || space.chains.length !== run.length || !run.every((chain) => space.chains.includes(chain))) {
          throw unsupported('chain-run', id);
        }
        steps.push({ kind: 'chain', count: run.length });
        break;
      }
      case 'picot':
        steps.push({ kind: 'stitch', def: def.id, count: 1, target: 'none', mode: 'both-loops', into: 'stitch' });
        break;
      case 'ring':
      case 'space':
      case 'group':
        throw unsupported('stitch-kind', id);
      default: {
        const anchor = node.anchors[0];
        const depth = anchor?.into === 'stitch' ? index - (graph.layerOf.get(anchor.id) ?? index) : 0;
        if (node.flags?.includes('spike') && anchor?.into === 'stitch' && node.anchors.length === 1 && depth >= 2) {
          // Hosszú szem korábbi sorba (mozaik, filé sor végi szaporítás, PQW-894). A mozaikban a fölötte kihagyott
          // láncszem helyén halad át, ezért a kurzor azon is továbblép.
          if (cursor < working.length && graph.piece.skipped.includes(working[cursor]!)) cursor += 1;
          last = null;
          steps.push({ kind: 'stitch', def: def.id, count: 1, target: 'down', depth, mode: modeAsWorked(anchor.mode, layer.side), into: 'stitch' });
          break;
        }
        if (def.kind === 'joined' && def.base === 'spread') {
          const ws = node.anchors.map((anchor) => (anchor.into === 'stitch' ? workingIndex.get(anchor.id) : undefined));
          const start = ws[0];
          const consecutive = start !== undefined && ws.every((w, k) => w === start + k);
          if (!consecutive || ws.length !== def.consumes) throw unsupported('decrease-targets', id);
          const first = classify(node.anchors[0]!, id);
          if (first.target !== 'next') throw unsupported('decrease-used', id);
          cursor = start + ws.length;
          last = { kind: 'stitch', w: cursor - 1 };
          steps.push({ kind: 'stitch', def: def.id, count: 1, ...first });
          break;
        }
        if (node.anchors.length !== 1) throw unsupported('anchor-count', id);
        steps.push({ kind: 'stitch', def: def.id, count: 1, ...classify(node.anchors[0]!, id) });
      }
    }
  }

  // A következő sor első szeme más színű: a sor utolsó szeménél váltasz (03 §6).
  const lastNode = stitches[stitches.length - 1];
  if (lastNode !== undefined) {
    const next = graph.piece.stitches[graph.order.get(lastNode)! + 1];
    if (next && next.prev === lastNode && colorOf(next.id) !== colorOf(lastNode)) markChange(colorOf(next.id));
  }

  // Kihagyás a sor végén: csak a szándékosan kihagyott szemekig (03 §10 B8).
  const skippedAtEnd = working.map((id, w) => (w >= cursor && graph.piece.skipped.includes(id) ? w : -1));
  const lastSkipped = Math.max(-1, ...skippedAtEnd);
  if (lastSkipped >= cursor) skip(cursor, lastSkipped + 1);

  let joinTo: WrittenLayer['joinTo'] = null;
  if (layer.closing?.kind === 'join-slip') {
    const join = layer.joinSlip === null ? undefined : graph.nodes.get(layer.joinSlip);
    const anchor = join?.anchors[0];
    if (!join || join.anchors.length !== 1 || anchor?.into !== 'stitch' || anchor.id !== layer.positions[0]) {
      throw unsupported('join-target', layer.closing.after);
    }
    joinTo = layer.turningChainCounts ? 'turning-chain' : 'first-stitch';
  }

  // Számító fordulóláncnál a sor eleji láncív és a kihagyott láncszemek a láncalap folytatása (filé nyitott kezdés, 03 §5.2).
  let leadChains = 0;
  let leadSkipped = 0;
  const [firstStep, secondStep] = steps;
  if (hookRow && countsAs !== null && firstStep?.kind === 'chain' && secondStep?.kind === 'skip' && secondStep.what === 'chain') {
    leadChains = firstStep.count;
    leadSkipped = secondStep.count;
    steps.splice(0, 2);
  }

  const written = foldRepeats(mergeSteps(steps, library), layer.shape === 'round');
  // Minden megmaradt láncszembe egy alapszem vagy kúszószem, színváltás nélkül (PQW-895).
  const [only] = written;
  const onlyKind = only?.kind === 'stitch' ? library.get(only.def)?.kind : undefined;
  const eachChain =
    hookRow &&
    written.length === 1 &&
    only?.kind === 'stitch' &&
    (onlyKind === 'basic' || onlyKind === 'slip') &&
    only.target === 'next' &&
    only.into === 'chain' &&
    only.changeTo === undefined &&
    only.count === working.length - cursorStart - leadSkipped;

  return {
    index,
    row: layer.row,
    shape: layer.shape,
    side: layer.side,
    fromHook: hookRow
      ? { chain: layer.turningChain.length + (baseChain ? 2 : 1) + leadChains + leadSkipped, countsAs, chains: leadChains, eachChain }
      : null,
    steps: written,
    stitchCount: layer.stitchCount,
    closing: layer.closing?.kind ?? null,
    joinTo,
    colorChange: layer.closing?.colorChange === true,
    jogFix: layer.closing?.jogFix ?? null,
    marks: layer.closing?.marks ?? [],
  };
}

/* ---- Összevonás és ismétlés ---- */

/** Összevonás: „rp, rp, rp” → „3 rp”; egy láncívbe vagy a varázskörbe horgolt szemek egy tételbe. */
export function mergeSteps(steps: readonly Step[], library: StitchLibrary): Step[] {
  const merged: Step[] = [];
  for (const step of steps) {
    const previous = merged.at(-1);
    if (previous?.kind === 'skip' && step.kind === 'skip' && previous.what === step.what) {
      merged[merged.length - 1] = { ...previous, count: previous.count + step.count };
      continue;
    }
    // Színváltás után új tétel kezdődik: a váltás a tétel utolsó szeménél áll.
    if (previous?.kind === 'stitch' && step.kind === 'stitch' && previous.changeTo === undefined && sameRun(previous, step, library)) {
      merged[merged.length - 1] = {
        ...previous,
        count: previous.count + step.count,
        ...(step.changeTo === undefined ? {} : { changeTo: step.changeTo }),
      };
      continue;
    }
    merged.push(step);
  }
  return merged;
}

function sameRun(a: Step & { kind: 'stitch' }, b: Step & { kind: 'stitch' }, library: StitchLibrary): boolean {
  const kind = library.get(a.def)?.kind;
  if (a.def !== b.def || a.mode !== b.mode || (kind !== 'basic' && kind !== 'slip')) return false;
  if (a.target === 'down') return b.target === 'down' && a.depth === b.depth;
  if (a.target === 'next') return b.target === 'next';
  if (a.target === 'next-space' || a.target === 'same-space') return b.target === 'same-space';
  return (a.target === 'ring' || a.target === 'chain-ring') && b.target === a.target;
}

/**
 * A legrövidebb ismétlődő egység: az a szomszédos ismétlés, amely a legtöbb
 * lépést takarítja meg. Egyenlő megtakarításnál az az egység nyer, amely nem
 * kihagyással végződik, aztán a későbbi kezdetű: így a szélső szemek az
 * ismétlés előtt állnak, ahogy a minták írják (03 §2.3, §4.2). Körben
 * (`preferEarly`) előbb a láncszemmel záruló egység nyer, aztán a korábbi
 * kezdetű, így a félbemaradt ismétlés a végére kerül: „1 rp, (szap., 2 rp) ×5,
 * szap., 1 rp” (04 §3.2). Az ismétlés
 * előtti és utáni részben tovább keresünk; egymásba ágyazott ismétlés nincs.
 */
export function foldRepeats(steps: readonly Step[], preferEarly = false): Step[] {
  const keys = steps.map((step) => JSON.stringify(step));
  const n = steps.length;
  let best: Candidate | null = null;

  for (let period = 1; period * 2 <= n; period += 1) {
    for (let start = 0; start + period * 2 <= n; start += 1) {
      let count = 1;
      while (start + (count + 1) * period <= n && sameBlock(keys, start, start + count * period, period)) count += 1;
      if (count < 2) continue;
      const candidate = {
        start,
        period,
        times: count,
        saved: period * (count - 1),
        endsWithSkip: steps[start + period - 1]!.kind === 'skip',
        endsWithChain: steps[start + period - 1]!.kind === 'chain',
        startsSame: startsInSameTarget(steps[start]!),
      };
      if (!best || better(candidate, best, preferEarly)) best = candidate;
    }
  }
  if (!best) return [...steps];

  const end = best.start + best.period * best.times;
  return [
    ...foldRepeats(steps.slice(0, best.start), preferEarly),
    { kind: 'repeat', steps: steps.slice(best.start, best.start + best.period), times: best.times },
    ...foldRepeats(steps.slice(end), preferEarly),
  ];
}

function sameBlock(keys: readonly string[], a: number, b: number, period: number): boolean {
  for (let k = 0; k < period; k += 1) if (keys[a + k] !== keys[b + k]) return false;
  return true;
}

interface Candidate {
  readonly start: number;
  readonly period: number;
  readonly times: number;
  readonly saved: number;
  readonly endsWithSkip: boolean;
  readonly endsWithChain: boolean;
  readonly startsSame: boolean;
}

/** A lépés egy már megkezdett célpontba megy („ugyanabba a láncívbe”): ott nem kezdődhet ismétlés körben. */
function startsInSameTarget(step: Step): boolean {
  return (step.kind === 'stitch' || step.kind === 'group') && (step.target === 'same' || step.target === 'same-space');
}

function better(a: Candidate, b: Candidate, preferEarly: boolean): boolean {
  if (a.saved !== b.saved) return a.saved > b.saved;
  if (a.endsWithSkip !== b.endsWithSkip) return !a.endsWithSkip;
  // Körben az egység új célpontnál kezdődik, és láncszemmel zárul: „(3 erp, 2 lsz) ×3” (03 §8).
  if (preferEarly && a.startsSame !== b.startsSame) return !a.startsSame;
  if (preferEarly && a.endsWithChain !== b.endsWithChain) return a.endsWithChain;
  if (a.start !== b.start) return preferEarly ? a.start < b.start : a.start > b.start;
  return a.period < b.period;
}
