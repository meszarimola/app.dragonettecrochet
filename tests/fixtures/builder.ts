/*
 * Builds a `Piece` for the tests one stitch at a time, following the yarn path,
 * and assigns the ids.
 */

import type {
  Anchor,
  LayerEvent,
  NodeId,
  Pattern,
  PatternConventions,
  Piece,
  RingId,
  RowConventions,
  Space,
  SpaceId,
  StitchDefId,
  StitchFlag,
  StitchGroup,
  StitchNode,
} from '../../src/core/types.ts';

/** A stitch id (both loops), a chain space, a ring, or a whole target. */
export type Target = NodeId | { readonly space: SpaceId } | { readonly ring: RingId } | Anchor;

function toAnchor(target: Target): Anchor {
  if (typeof target === 'string') return { into: 'stitch', id: target, mode: 'both-loops' };
  if ('into' in target) return target;
  if ('space' in target) return { into: 'space', id: target.space };
  return { into: 'ring', id: target.ring };
}

export class PieceBuilder {
  readonly id: string;
  readonly name: string;
  private readonly stitches: StitchNode[] = [];
  private readonly spaces: Space[] = [];
  private readonly rings: { id: RingId; node: NodeId }[] = [];
  private readonly groups: StitchGroup[] = [];
  private readonly events: LayerEvent[] = [];
  private readonly skipped: NodeId[] = [];
  private previous: NodeId | null = null;
  private counter = 0;

  constructor(id = 'p1', name = 'Darab') {
    this.id = id;
    this.name = name;
  }

  /** The stitch worked most recently. */
  get last(): NodeId {
    if (this.previous === null) throw new Error('Még nincs szem.');
    return this.previous;
  }

  stitch(def: StitchDefId, ...targets: Target[]): NodeId {
    return this.stitchWith(def, targets);
  }

  stitchWith(def: StitchDefId, targets: readonly Target[], flags?: readonly StitchFlag[]): NodeId {
    this.counter += 1;
    const id = `n${this.counter}`;
    this.stitches.push({
      id,
      def,
      prev: this.previous,
      anchors: targets.map(toAnchor),
      ...(flags ? { flags } : {}),
    });
    this.previous = id;
    return id;
  }

  chain(count = 1): NodeId[] {
    return Array.from({ length: count }, () => this.stitch('ch'));
  }

  /** `count` chains, and one chain space made from them. */
  chainSpace(count: number): SpaceId {
    return this.space(this.chain(count));
  }

  space(chains: readonly NodeId[]): SpaceId {
    const id = `s${this.spaces.length + 1}`;
    this.spaces.push({ id, chains });
    return id;
  }

  ring(): RingId {
    const node = this.stitch('magic-ring');
    const id = `r${this.rings.length + 1}`;
    this.rings.push({ id, node });
    return id;
  }

  /** Stitches worked into the same target as one group, such as a shell. */
  inSame(def: StitchDefId, members: readonly StitchDefId[], target: Target): NodeId[] {
    const ids = members.map((member) => (member === 'ch' ? this.stitch('ch') : this.stitch(member, target)));
    this.group(def, ids);
    return ids;
  }

  group(def: StitchDefId, members: readonly NodeId[]): void {
    this.groups.push({ id: `g${this.groups.length + 1}`, def, members });
  }

  event(kind: LayerEvent['kind'], statedCount?: number, conventions?: Partial<RowConventions>): void {
    this.events.push({
      after: this.last,
      kind,
      ...(statedCount === undefined ? {} : { statedCount }),
      ...(conventions ? { conventions } : {}),
    });
    if (kind === 'fasten-off') this.previous = null;
  }

  skip(...ids: NodeId[]): void {
    this.skipped.push(...ids);
  }

  build(): Piece {
    return {
      id: this.id,
      name: this.name,
      stitches: [...this.stitches],
      spaces: [...this.spaces],
      rings: [...this.rings],
      groups: [...this.groups],
      events: [...this.events],
      skipped: [...this.skipped],
    };
  }
}

/** Rewrites one stitch in a finished pattern: how the deliberately broken variants are made. */
export function editNode(
  pattern: Pattern,
  id: NodeId,
  patch: { readonly def?: StitchDefId; readonly anchors?: readonly Target[]; readonly prev?: NodeId | null },
): Pattern {
  let found = false;
  const pieces = pattern.pieces.map((piece) => ({
    ...piece,
    stitches: piece.stitches.map((node) => {
      if (node.id !== id) return node;
      found = true;
      return {
        ...node,
        ...(patch.def === undefined ? {} : { def: patch.def }),
        ...(patch.anchors === undefined ? {} : { anchors: patch.anchors.map(toAnchor) }),
        ...(patch.prev === undefined ? {} : { prev: patch.prev }),
      };
    }),
  }));
  if (!found) throw new Error(`Nincs ilyen szem: ${id}`);
  return { ...pattern, pieces };
}

export function editPiece(pattern: Pattern, edit: (piece: Piece) => Piece): Pattern {
  return { ...pattern, pieces: pattern.pieces.map(edit) };
}

export const DEFAULT_CONVENTIONS: PatternConventions = {
  turningChainCounts: 'stitch-default',
  roundEnd: 'stitch-default',
  picotCounts: false,
  joinSlipStitchCounts: false,
  chainCounts: true,
};

export function patternOf(title: string, pieces: readonly Piece[], conventions: Partial<PatternConventions> = {}): Pattern {
  return { formatVersion: 1, title, conventions: { ...DEFAULT_CONVENTIONS, ...conventions }, pieces };
}
