import type { InsertionMode, Layer, NodeId, Piece, StitchDef, StitchInsertion } from './types.ts';

export const STITCH_INSERTIONS: readonly StitchInsertion[] = [
  'both-loops',
  'front-loop',
  'back-loop',
  'front-post',
  'back-post',
];

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

export function isPostMode(mode: StitchInsertion): boolean {
  return mode === 'front-post' || mode === 'back-post';
}

// Converts either way between the crocheter's view and the stored right-side
// view: the flip is its own inverse, so there is no second function.
// KB: 03 §2.1, 01 §4.3, core-geometry §2
export function modeAsWorked(mode: StitchInsertion, side: Layer['side']): StitchInsertion {
  return side === 'wrong' ? FLIPPED[mode] : mode;
}

export function stitchInsertions(def: StitchDef): StitchInsertion[] {
  return STITCH_INSERTIONS.filter((mode) => def.insertionModes.includes(mode));
}

export function effectiveInsertion(
  def: StitchDef,
  requested: StitchInsertion | null | undefined,
): StitchInsertion | undefined {
  const allowed = stitchInsertions(def);
  return requested && allowed.includes(requested) ? requested : allowed[0];
}

// KB: core-geometry §2
export function nodeInsertions(piece: Piece | undefined): Map<NodeId, StitchInsertion> {
  const modes = new Map<NodeId, StitchInsertion>();
  for (const node of piece?.stitches ?? []) {
    const anchor = node.anchors.find((candidate) => candidate.into === 'stitch');
    if (anchor?.into === 'stitch') modes.set(node.id, anchor.mode);
  }
  return modes;
}
