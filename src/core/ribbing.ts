/*
 * Bordás szegély és perem relief szemekkel (PQW-909; 01 §2.2 [S25], §4.3, 03 §7.1).
 *
 * A bordázat váltakozó első és hátsó relief szem: a szem az alatta lévő sor
 * szemének pálcája köré kapaszkodik, a tetejét nem használja fel, ezért a
 * szemszám nem változik (01 §4.3). A beszúrási mód a meglévő `Anchor.mode`
 * mezőbe kerül (PQW-869), a rajz és az írott minta már tudja jelölni.
 *
 * - **A borda oszlop.** A gráf a színoldali módot tárolja, ezért egy oszlop
 *   minden sorában ugyanaz a tárolt mód: a szem a célpontja oszlopát viszi
 *   tovább. Visszai soron a horgoló felől ez megfordul (insertion.ts), így az
 *   írott minta soronként helyesen mond Eerp-et, illetve Herp-et.
 * - **A fordulólánc nem lehet relief szem**, ezért a bordás sor fordulólánca
 *   nem számít szemnek (graph.ts), és egy láncszemmel rövidebb: pálcánál 2 lsz
 *   [S25]. A relief szem alacsonyabb is az alapszeménél (01 §4.3).
 * - **Láncszem köré nem lehet relief szemet horgolni.** A számító fordulólánc
 *   tetejére ezért sima szem kerül. Fordulás után ez a sor utolsó szeme: éppen
 *   az a szem, amelyet [S25] a bordás sor végén félpálcaként ír. A sor saját
 *   szemével dolgozunk, hogy a sor magassága egyöntetű maradjon (03 §2.3).
 * - **Körben** a bordázat akkor záródik, ha a szemszám az ismétlés
 *   kétszeresének többszöröse.
 *
 * Csak egyráhajtásos pálcával: az Eerp és a Herp az egyetlen jóváhagyott
 * relief szempár a szókészletben (01 §4.2), és a forrás is erre szól. Más
 * szemre a generátor pontos okkal nemet mond, nem talál ki rá jelölést.
 */

import { buildPieceGraph } from './graph.ts';
import { text, type CoreText } from './messages.ts';
import type { StitchLibrary } from './stitch-library.ts';
import type { Anchor, LayerEvent, NodeId, Pattern, Piece, StitchDef, StitchDefId, StitchInsertion, StitchNode } from './types.ts';

/** A bordázat szeme; az Eerp/Herp az egyetlen jóváhagyott relief szempár (01 §4.2). */
export const RIBBING_STITCH: StitchDefId = 'dc';
export const MAX_RIBBING_ROWS = 20;
export const MAX_RIBBING_WIDTH = 6;

/**
 * A bordázat elutasításának kódjai (PQW-904): a mag kódot és adatot ad, a
 * mondatot a felület állítja össze (`src/ui/i18n/core/shape.ts`).
 */
export type RibbingCode =
  | 'ribbing-rows-range'
  | 'ribbing-width-range'
  | 'ribbing-stitch-missing'
  | 'ribbing-needs-row'
  | 'ribbing-after-join'
  | 'ribbing-spiral'
  | 'ribbing-after-turn'
  | 'ribbing-round-multiple'
  | 'ribbing-needs-post-stitch';

export type RibbingText = CoreText<RibbingCode>;

export interface RibbingOptions {
  /** Hány sor, illetve kör bordázat. */
  readonly rows: number;
  /** Az ismétlés fele: ennyi első relief, majd ennyi hátsó relief (1×1, 2×2). */
  readonly width: number;
}

export const DEFAULT_RIBBING: RibbingOptions = { rows: 2, width: 1 };

/** Mi nem választható: tartományon kívüli sorszám vagy bordaszélesség. */
export function ribbingProblem(options: RibbingOptions): RibbingText | null {
  if (!Number.isInteger(options.rows) || options.rows < 1 || options.rows > MAX_RIBBING_ROWS) {
    return text('ribbing-rows-range', { max: MAX_RIBBING_ROWS });
  }
  if (!Number.isInteger(options.width) || options.width < 1 || options.width > MAX_RIBBING_WIDTH) {
    return text('ribbing-width-range', { max: MAX_RIBBING_WIDTH });
  }
  return null;
}

/** Van-e pálcája, amely köré horgolni lehet: a láncszemnek, a kúszószemnek és a rákhuroknak nincs. */
export function hasPost(def: StitchDef | undefined): boolean {
  return def?.kind === 'basic' && def.insertionModes.includes('front-post');
}

/*
 * A bordázat szabályai egy helyen (PQW-909, PQW-913). A generátorok (ruhadarab) és a `appendRibbing` is
 * ezeket használja, hogy a kétféle úton készült bordázat ne csúszhasson el egymástól.
 */

/** A borda oszlopának módja: `width` szemenként vált első és hátsó relief között. */
export function ribbingColumnMode(column: number, width: number): StitchInsertion {
  return Math.floor(column / width) % 2 === 0 ? 'front-post' : 'back-post';
}

/**
 * A bordás sor fordulólánca egy láncszemmel rövidebb: a relief szem alacsonyabb az alapszeménél, és
 * láncszem nem állhat relief szem helyett (01 §2.2 [S25], §4.3).
 */
export function ribbedTurningChain(def: StitchDef): number {
  return Math.max(1, def.turningChain - 1);
}

/**
 * A bordás sort megnyitó esemény: a fordulólánc nem számít szemnek. A sort megnyitó eseményen adjuk meg,
 * így a minta konvenciója változatlan marad, és csak a bordás sorokra vonatkozik (graph.ts).
 */
export function ribbedOpening(event: LayerEvent): LayerEvent {
  return { ...event, conventions: { ...event.conventions, turningChainCounts: false } };
}

/**
 * Bordázat a darab utolsó sora vagy köre fölé (PQW-909). Sík darabon a
 * fordulás után sorokban, körben horgolt darabon a kör zárása után körökben.
 * Ha nem horgolható rá, az ok.
 */
export function appendRibbing(pattern: Pattern, piece: Piece, library: StitchLibrary, options: RibbingOptions): Piece | RibbingText {
  const problem = ribbingProblem(options);
  if (problem !== null) return problem;
  const def = library.get(RIBBING_STITCH);
  if (!def) return text('ribbing-stitch-missing');

  const graph = buildPieceGraph(pattern, piece, library);
  const last = graph.layers[graph.layers.length - 1];
  if (!last || last.index === 0) return text('ribbing-needs-row');

  const round = last.shape === 'round';
  if (round && last.closing?.kind !== 'join-slip') return text('ribbing-after-join');
  // A sorokban horgolt darab a fonal elvágásával ér véget; a bordázat hozzáfűzésekor fordulás lesz belőle.
  if (!round && last.closing?.kind !== 'turn' && last.closing?.kind !== 'fasten-off') {
    return text('ribbing-after-turn');
  }

  const unit = 2 * options.width;
  if (round && last.positions.length % unit !== 0) {
    const nearest = Math.max(unit, Math.round(last.positions.length / unit) * unit);
    return text('ribbing-round-multiple', { unit, count: last.positions.length, nearest });
  }
  if (!last.positions.some((id) => hasPost(graph.defs.get(id)))) {
    return text('ribbing-needs-post-stitch');
  }

  const stitches: StitchNode[] = [...piece.stitches];
  const events: LayerEvent[] = [...piece.events];
  /*
   * A bordás sor fordulólánca nem számít szemnek: láncszem nem állhat relief szem helyett (01 §2.2 [S25]).
   * A sort megnyitó esemény mondja meg, így a minta konvenciója változatlan marad, és csak a bordás sorokra
   * vonatkozik (graph.ts); a visszaolvasó ugyanezt írja vissza a szövegből (pattern-read.ts).
   */
  const opensRib = ribbedOpening;
  // A darab a fonal elvágásával ért véget: a bordázat hozzáfűzésekor fordulás lesz belőle, a fonal nincs elvágva.
  const ended = events[events.length - 1];
  if (ended) events[events.length - 1] = opensRib(!round && ended.kind === 'fasten-off' ? { ...ended, kind: 'turn' } : ended);
  const numberOf = (ids: readonly string[], prefix: string) =>
    Math.max(0, ...ids.map((id) => (new RegExp(`^${prefix}(\\d+)$`).exec(id) ? Number(id.slice(prefix.length)) : 0)));
  let nextNode = numberOf(
    stitches.map((node) => node.id),
    'n',
  );
  const add = (defId: StitchDefId, anchors: readonly Anchor[]): NodeId => {
    nextNode += 1;
    const id = `n${nextNode}`;
    stitches.push({ id, def: defId, prev: stitches[stitches.length - 1]?.id ?? null, anchors });
    return id;
  };

  // A borda oszlopai: a szem a célpontja oszlopát viszi tovább, így a bordák végigfutnak a darabon.
  const column = new Map<NodeId, number>();
  last.positions.forEach((id, k) => column.set(id, k));
  const modeOf = (id: NodeId): StitchInsertion => ribbingColumnMode(column.get(id) ?? 0, options.width);
  /** A darab régi szemeinél a könyvtár dönt; a bordázat saját szemei mind pálcások. */
  const postable = (id: NodeId) => (graph.defs.has(id) ? hasPost(graph.defs.get(id)) : true);

  const turning = ribbedTurningChain(def);

  let below: readonly NodeId[] = last.positions;
  for (let r = 0; r < options.rows; r += 1) {
    for (let i = 0; i < turning; i += 1) add('ch', []);
    // Fordulás után a sor a másik végéről halad; körben a kör sorrendjében.
    const working = round ? [...below] : [...below].reverse();
    const made: NodeId[] = [];
    for (const target of working) {
      // Láncszem köré nem megy relief szem: oda sima szem kerül (a számító fordulólánc teteje, [S25]).
      const mode: StitchInsertion = postable(target) ? modeOf(target) : 'both-loops';
      const id = add(def.id, [{ into: 'stitch', id: target, mode }]);
      column.set(id, column.get(target) ?? 0);
      made.push(id);
    }
    const last_ = r === options.rows - 1;
    if (round) {
      const join = add('sl-st', [{ into: 'stitch', id: made[0]!, mode: 'both-loops' }]);
      const event: LayerEvent = { after: join, kind: 'join-slip', statedCount: made.length };
      events.push(last_ ? event : opensRib(event));
    } else {
      const event: LayerEvent = { after: made[made.length - 1]!, kind: last_ ? 'fasten-off' : 'turn' };
      events.push(last_ ? event : opensRib(event));
    }
    below = made;
  }

  return { ...piece, stitches, events };
}
