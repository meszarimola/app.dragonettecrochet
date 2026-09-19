// KB: core-support §6
import { buildPieceGraph } from './graph.ts';
import { text, type CoreText } from './messages.ts';
import { TECHNIQUE_NAMES } from './pixel-chart.ts';
import { MOTIF_NAMES } from './round-generator.ts';
import { SHAPE_NAMES } from './shapes.ts';
import { libraryFor } from './stitch-variants.ts';
import type { Anchor, LayerEvent, NodeId, Pattern, Piece, PieceGrid, Space, StitchDefId, StitchFlag, StitchNode } from './types.ts';
import { validatePattern } from './validate.ts';
import { withGeneratedTitle } from './pattern-title.ts';

export type GridPatternCode = 'pattern-invalid';

export type GridResult = { readonly ok: true; readonly pattern: Pattern } | { readonly ok: false; readonly reason: CoreText<GridPatternCode> };

// KB: core-domain §2
export const fail = <Code extends string>(reason: CoreText<Code>): { readonly ok: false; readonly reason: CoreText<Code> } => ({ ok: false, reason });

export const intoStitch = (id: NodeId): Anchor => ({ into: 'stitch', id, mode: 'both-loops' });

export const intoSpace = (id: string): Anchor => ({ into: 'space', id });

export class GridWriter {
  readonly stitches: StitchNode[] = [];
  readonly spaces: Space[] = [];
  readonly events: LayerEvent[] = [];
  readonly skipped: NodeId[] = [];
  #previous: NodeId | null = null;

  // Colour 0 is the first colour and is left out of the node.
  add(def: StitchDefId, anchors: readonly Anchor[] = [], color = 0, flags: readonly StitchFlag[] = []): NodeId {
    const id = `n${this.stitches.length + 1}`;
    this.stitches.push({
      id,
      def,
      prev: this.#previous,
      anchors,
      ...(flags.length > 0 ? { flags } : {}),
      ...(color > 0 ? { color } : {}),
    });
    this.#previous = id;
    return id;
  }

  chains(count: number, color = 0): NodeId[] {
    return Array.from({ length: count }, () => this.add('ch', [], color));
  }

  space(count: number, color = 0): { readonly id: string; readonly chains: NodeId[] } {
    const chains = this.chains(count, color);
    const id = `s${this.spaces.length + 1}`;
    this.spaces.push({ id, chains });
    return { id, chains };
  }

  spaceOf(chains: readonly NodeId[]): string {
    const id = `s${this.spaces.length + 1}`;
    this.spaces.push({ id, chains });
    return id;
  }

  event(kind: LayerEvent['kind']): void {
    this.events.push({ after: this.#previous!, kind });
  }
}

// KB: 06 §5.3 V3
export function gridPiece(pattern: Pattern, name: string, writer: GridWriter, grid: PieceGrid): Piece {
  const piece: Piece = {
    id: 'p1',
    name,
    stitches: writer.stitches,
    spaces: writer.spaces,
    rings: [],
    groups: [],
    events: writer.events,
    skipped: writer.skipped,
    grid,
  };
  const whole = { ...pattern, pieces: [piece] };
  const graph = buildPieceGraph(whole, piece, libraryFor(whole));
  const stated = new Map<NodeId, number>();
  for (const layer of graph.layers.slice(1)) if (layer.closing) stated.set(layer.closing.after, layer.writtenCount);
  return { ...piece, events: piece.events.map((event) => ({ ...event, statedCount: stated.get(event.after)! })) };
}

// KB: core-support §6, core-domain §1
export function finishGridPattern(pattern: Pattern, piece: Piece): GridResult {
  const generated = [...Object.values(SHAPE_NAMES), ...Object.values(MOTIF_NAMES), ...Object.values(TECHNIQUE_NAMES)];
  const result = withGeneratedTitle({ ...pattern, pieces: [piece] }, pattern, piece.name, generated);
  const errors = validatePattern(result, libraryFor(result)).filter((finding) => finding.severity === 'error');
  if (errors.length > 0) return fail(text('pattern-invalid', { rule: errors[0]!.rule }));
  return { ok: true, pattern: result };
}
