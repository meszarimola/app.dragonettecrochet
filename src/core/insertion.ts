/*
 * Beszúrási mód lerakáskor (PQW-869): mindkét szál, első szál, hátsó szál,
 * első relief, hátsó relief (szókészlet §3, 01 §4.3).
 *
 * Két nézet van, és mindkettőnek megvan a helye:
 * - a horgoló felől nézett mód: ezt választja a felhasználó, ezt írja az
 *   írott minta, és a szem `insertionModes` listája is így érti;
 * - a színoldali mód: ezt tárolja az `Anchor.mode`, és ezt mutatja a diagram.
 *
 * Visszai soron a kettő eltér: a szálak és a relief megfordulnak (03 §2.1,
 * 01 §8.4 szabály 21). A megfordítás önmaga inverze, ezért ugyanaz a
 * függvény visz át mindkét irányba.
 */

import type { InsertionMode, Layer, NodeId, Piece, StitchDef, StitchInsertion } from './types.ts';

/** A szembe szúrás módjai a választó sorrendjében. */
export const STITCH_INSERTIONS: readonly StitchInsertion[] = ['both-loops', 'front-loop', 'back-loop', 'front-post', 'back-post'];

/** A módok magyar neve a szókészlet §3 szerint, kis kezdőbetűvel. */
export const INSERTION_NAMES: Readonly<Record<StitchInsertion, string>> = {
  'both-loops': 'mindkét szál',
  'front-loop': 'első szál',
  'back-loop': 'hátsó szál',
  'front-post': 'első relief',
  'back-post': 'hátsó relief',
};

const FLIPPED: Readonly<Record<StitchInsertion, StitchInsertion>> = {
  'both-loops': 'both-loops',
  'front-loop': 'back-loop',
  'back-loop': 'front-loop',
  'front-post': 'back-post',
  'back-post': 'front-post',
};

export function isStitchInsertion(mode: InsertionMode): mode is StitchInsertion {
  return mode !== 'space' && mode !== 'ring';
}

/**
 * Relief (a szem pálcája köré horgolt) mód-e. A megfordítás az első és a hátsó
 * reliefet egymásba viszi, ezért a tárolt és a horgoló felőli módra egyaránt
 * ugyanaz az eredmény.
 */
export function isPostMode(mode: StitchInsertion): boolean {
  return mode === 'front-post' || mode === 'back-post';
}

/**
 * A horgoló felől nézett és a színoldali mód átváltása: visszai soron a
 * szálak és a relief megfordulnak. Mindkét irányba ugyanaz.
 */
export function modeAsWorked(mode: StitchInsertion, side: Layer['side']): StitchInsertion {
  return side === 'wrong' ? FLIPPED[mode] : mode;
}

/** A szem által megengedett, szembe szúró módok a választó sorrendjében. */
export function stitchInsertions(def: StitchDef): StitchInsertion[] {
  return STITCH_INSERTIONS.filter((mode) => def.insertionModes.includes(mode));
}

/**
 * A lerakáskor érvényes mód, a horgoló felől: a kért, ha a szem megengedi,
 * különben a szem alapértelmezése. `undefined`, ha a szem nem szúrható szembe.
 */
export function effectiveInsertion(def: StitchDef, requested: StitchInsertion | null | undefined): StitchInsertion | undefined {
  const allowed = stitchInsertions(def);
  return requested && allowed.includes(requested) ? requested : allowed[0];
}

/**
 * A darab szemeinek színoldali módja a rajzhoz: az első szembe szúrt célpont
 * módja. A láncívbe és gyűrűbe horgolt szem nincs benne, annak nincs jelölése.
 */
export function nodeInsertions(piece: Piece | undefined): Map<NodeId, StitchInsertion> {
  const modes = new Map<NodeId, StitchInsertion>();
  for (const node of piece?.stitches ?? []) {
    const anchor = node.anchors.find((candidate) => candidate.into === 'stitch');
    if (anchor?.into === 'stitch') modes.set(node.id, anchor.mode);
  }
  return modes;
}
