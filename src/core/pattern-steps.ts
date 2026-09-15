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

import { buildPieceGraph, type PieceGraph } from './graph.ts';
import type { StitchLibrary } from './stitch-library.ts';
import { hasBaseChain, traditionOf } from './tradition.ts';
import type { Anchor, LayerEvent, NodeId, Pattern, Piece, StitchDef, StitchDefId, StitchInsertion, Tradition } from './types.ts';

export type StepTarget = 'next' | 'same' | 'next-space' | 'same-space' | 'ring' | 'chain-ring' | 'none';

export type Step =
  | {
      readonly kind: 'stitch';
      readonly def: StitchDefId;
      readonly count: number;
      readonly target: StepTarget;
      /** A horgoló felől nézett beszúrás: visszai soron már megfordítva. */
      readonly mode: StitchInsertion;
      /** Láncszembe vagy szembe megy; csak a kiírt helyhatározóhoz kell. */
      readonly into: 'stitch' | 'chain';
    }
  | {
      readonly kind: 'group';
      readonly def: StitchDefId;
      readonly target: StepTarget;
      readonly mode: StitchInsertion;
      readonly into: 'stitch' | 'chain';
    }
  | { readonly kind: 'chain'; readonly count: number }
  | { readonly kind: 'skip'; readonly count: number; readonly what: 'stitch' | 'chain' | 'space' }
  | { readonly kind: 'turning-chain'; readonly count: number; readonly countsAs: StitchDefId | null }
  | { readonly kind: 'repeat'; readonly steps: readonly Step[]; readonly times: number };

export interface WrittenLayer {
  readonly index: number;
  readonly shape: 'row' | 'round';
  readonly side: 'right' | 'wrong';
  /** Az 1. sor a láncalapon: a horogtól számított hányadik láncszemnél kezd, és mit ér a kihagyott rész. */
  readonly fromHook: { readonly chain: number; readonly countsAs: StitchDefId | null } | null;
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
}

export interface WrittenPiece {
  readonly name: string;
  readonly foundation:
    | { readonly kind: 'chain'; readonly count: number }
    | { readonly kind: 'ring' }
    | { readonly kind: 'chain-ring'; readonly count: number };
  readonly layers: readonly WrittenLayer[];
}

/** A gráf olyan része, amelyet az írott minta még nem tud kifejezni. */
export class WrittenPatternError extends Error {
  readonly nodes: readonly NodeId[];

  constructor(message: string, nodes: readonly NodeId[] = []) {
    super(message);
    this.nodes = nodes;
  }
}

export function writtenPieces(pattern: Pattern, library: StitchLibrary): WrittenPiece[] {
  return pattern.pieces.map((piece) => writtenPiece(pattern, piece, library));
}

function writtenPiece(pattern: Pattern, piece: Piece, library: StitchLibrary): WrittenPiece {
  const graph = buildPieceGraph(pattern, piece, library);
  const base = graph.layers[0]!;
  const first = base.stitches[0];
  if (first === undefined) throw new WrittenPatternError('A minta láncalappal vagy varázskörrel kezdődik; enélkül még nem írható ki.');
  const onChain = graph.defs.get(first)!.kind === 'chain';
  // A láncgyűrű zárása az egyetlen esemény, amely a láncalapon állhat (PQW-861).
  const chainRing = onChain && base.shape === 'round' && base.closing?.kind === 'join-slip';
  if (base.closing !== null && !chainRing) throw new WrittenPatternError('A láncalapon lévő esemény még nem írható ki.', [base.closing.after]);

  const row1 = graph.layers[1];
  const foundation: WrittenPiece['foundation'] = chainRing
    ? { kind: 'chain-ring', count: base.stitches.length }
    : onChain
      ? { kind: 'chain', count: base.stitches.length + (row1?.turningChain.length ?? 0) }
      : { kind: 'ring' };

  const layers = graph.layers
    .slice(1)
    .map((_, i) => writtenLayer(graph, i + 1, foundation.kind, library, traditionOf(pattern.conventions)));
  return { name: piece.name, foundation, layers };
}

const FLIPPED: Readonly<Record<StitchInsertion, StitchInsertion>> = {
  'both-loops': 'both-loops',
  'front-loop': 'back-loop',
  'back-loop': 'front-loop',
  'front-post': 'back-post',
  'back-post': 'front-post',
};

/** A horgoló felől nézett beszúrás: visszai soron a szálak és a relief megfordulnak. */
export function modeAsWorked(mode: StitchInsertion, side: 'right' | 'wrong'): StitchInsertion {
  return side === 'wrong' ? FLIPPED[mode] : mode;
}

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
  const below = graph.layers[index - 1]!;
  const working = layer.direction === 1 ? below.positions : [...below.positions].reverse();
  const workingIndex = new Map(working.map((id, w) => [id, w]));
  const defOf = (id: NodeId) => graph.defs.get(id)!;
  const countsAs = layer.firstStitch !== null && layer.turningChainCounts ? countsAsOf(defOf(layer.firstStitch)) : null;
  const hookRow = index === 1 && start === 'chain';
  const ringSpace = start === 'chain-ring' ? graph.spaceOfChain.get(graph.layers[0]!.stitches[0]!)?.id : undefined;
  // Japán hagyományban az 1. sor fordulólánca egy alapláncszemen áll; abba nem horgolunk (01 §8.3 szabály 15).
  const baseChain = hookRow && hasBaseChain(layer.turningChainCounts, tradition);

  const steps: Step[] = [];
  const cursorStart = (index >= 2 || baseChain) && layer.turningChainCounts ? 1 : 0;
  let cursor = cursorStart;
  let last: Last = cursorStart === 1 ? { kind: 'stitch', w: 0 } : null;

  const skip = (from: number, to: number) => {
    if (to <= from) return;
    const allChains = working.slice(from, to).every((id) => defOf(id).kind === 'chain');
    steps.push({ kind: 'skip', count: to - from, what: allChains ? 'chain' : 'stitch' });
  };

  const classify = (anchor: Anchor, owner: NodeId): { target: StepTarget; mode: StitchInsertion; into: 'stitch' | 'chain' } => {
    if (anchor.into === 'ring') return { target: 'ring', mode: 'both-loops', into: 'stitch' };
    if (anchor.into === 'space') {
      if (anchor.id === ringSpace) return { target: 'chain-ring', mode: 'both-loops', into: 'stitch' };
      const chains = graph.spaces.get(anchor.id)!.chains.map((id) => workingIndex.get(id));
      if (chains.some((w) => w === undefined)) throw unsupported('olyan láncívbe kapaszkodik, amely nincs a megfelelő helyen', owner);
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
      } else throw unsupported('a haladási iránnyal szemben lévő láncívbe kapaszkodik', owner);
      last = { kind: 'space', id: anchor.id };
      return { target, mode: 'both-loops', into: 'stitch' };
    }

    const w = workingIndex.get(anchor.id);
    if (w === undefined) throw unsupported('olyan szembe kapaszkodik, amely nincs a megfelelő helyen', owner);
    const mode = modeAsWorked(anchor.mode, layer.side);
    const into = defOf(anchor.id).kind === 'chain' ? 'chain' : 'stitch';
    if (last?.kind === 'stitch' && last.w === w) return { target: 'same', mode, into };
    if (w < cursor) throw unsupported('a haladási iránnyal szemben lévő szembe kapaszkodik', owner);
    skip(cursor, w);
    cursor = w + 1;
    last = { kind: 'stitch', w };
    return { target: 'next', mode, into };
  };

  const unit = layer.shape === 'round' ? 'kör' : 'sor';
  const unsupported = (reason: string, node: NodeId) =>
    new WrittenPatternError(`A(z) ${index}. ${unit} ${reason}.`, [node]);

  const handled = new Set<NodeId>();
  const stitches = layer.stitches;
  for (let i = 0; i < stitches.length; i += 1) {
    const id = stitches[i]!;
    // A láncgyűrű kúszószeme a kezdés része, a láncgyűrű sora írja le.
    if (handled.has(id) || id === layer.joinSlip || (ringSpace !== undefined && index === 1 && layer.travelSlips.includes(id))) continue;
    const node = graph.nodes.get(id)!;
    const def = defOf(id);
    if (node.flags && node.flags.length > 0) throw unsupported('keresztezett vagy hosszú szemet tartalmaz', id);

    if (layer.turningChain.includes(id)) {
      for (const chain of layer.turningChain) handled.add(chain);
      if (!hookRow) steps.push({ kind: 'turning-chain', count: layer.turningChain.length, countsAs });
      continue;
    }

    const group = graph.groupOf.get(id);
    if (group) {
      if (group.members[0] !== id) throw unsupported('a csoport nem az első tagjával kezdődik', id);
      for (const member of group.members) handled.add(member);
      const chains = group.members.filter((member) => defOf(member).kind === 'chain');
      if (chains.some((chain) => graph.spaceOfChain.get(chain)?.chains.every((c) => chains.includes(c)) !== true)) {
        throw unsupported('a csoport láncszemei nem láncívet adnak', id);
      }
      const anchored = group.members.map((member) => graph.nodes.get(member)!).find((member) => member.anchors.length > 0);
      if (!anchored || anchored.anchors.length !== 1) throw unsupported('a csoport célpontja nem egyértelmű', id);
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
          throw unsupported('a sor közbeni láncszemek nem pontosan egy láncívet adnak', id);
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
        throw unsupported('ez a szemfajta itt nem állhat', id);
      default: {
        if (def.kind === 'joined' && def.base === 'spread') {
          const ws = node.anchors.map((anchor) => (anchor.into === 'stitch' ? workingIndex.get(anchor.id) : undefined));
          const start = ws[0];
          const consecutive = start !== undefined && ws.every((w, k) => w === start + k);
          if (!consecutive || ws.length !== def.consumes) throw unsupported('a fogyasztás célpontjai nem egymás utániak', id);
          const first = classify(node.anchors[0]!, id);
          if (first.target !== 'next') throw unsupported('a fogyasztás egy már használt szemből indul', id);
          cursor = start + ws.length;
          last = { kind: 'stitch', w: cursor - 1 };
          steps.push({ kind: 'stitch', def: def.id, count: 1, ...first });
          break;
        }
        if (node.anchors.length !== 1) throw unsupported('a szemnek nem egy célpontja van', id);
        steps.push({ kind: 'stitch', def: def.id, count: 1, ...classify(node.anchors[0]!, id) });
      }
    }
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
      throw unsupported('a kör zárása nem a kör első pozíciójába megy', layer.closing.after);
    }
    joinTo = layer.turningChainCounts ? 'turning-chain' : 'first-stitch';
  }

  return {
    index,
    shape: layer.shape,
    side: layer.side,
    fromHook: hookRow ? { chain: layer.turningChain.length + (baseChain ? 2 : 1), countsAs } : null,
    steps: foldRepeats(mergeSteps(steps, library), layer.shape === 'round'),
    stitchCount: layer.stitchCount,
    closing: layer.closing?.kind ?? null,
    joinTo,
    colorChange: layer.closing?.colorChange === true,
    jogFix: layer.closing?.jogFix ?? null,
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
    if (previous?.kind === 'stitch' && step.kind === 'stitch' && sameRun(previous, step, library)) {
      merged[merged.length - 1] = { ...previous, count: previous.count + step.count };
      continue;
    }
    merged.push(step);
  }
  return merged;
}

function sameRun(a: Step & { kind: 'stitch' }, b: Step & { kind: 'stitch' }, library: StitchLibrary): boolean {
  const kind = library.get(a.def)?.kind;
  if (a.def !== b.def || a.mode !== b.mode || (kind !== 'basic' && kind !== 'slip')) return false;
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
