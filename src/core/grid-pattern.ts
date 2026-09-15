/*
 * A rácsos technikák közös gráfírója (PQW-864): a filé, a C2C és a színes
 * rácsok ugyanígy rakják össze a darabot, és ugyanazon az ellenőrzőn
 * mennek át, mint a kézzel horgolt minta.
 *
 * - A szemek a fonal útján, az azonosítók sorrendben (`n1`, `n2`…).
 * - A szín a szemen áll; az első szín (0) nem íródik ki, így a mentés és az
 *   összevetés (canonical.ts) egyforma marad.
 * - A sor végi szemszám a gráf számolása (06 §5.3 V3).
 */

import { buildPieceGraph } from './graph.ts';
import { article } from './hungarian.ts';
import { TECHNIQUE_NAMES } from './pixel-chart.ts';
import { MOTIF_NAMES } from './round-generator.ts';
import { SHAPE_NAMES } from './shapes.ts';
import { libraryFor } from './stitch-variants.ts';
import type { Anchor, LayerEvent, NodeId, Pattern, Piece, PieceGrid, Space, StitchDefId, StitchNode } from './types.ts';
import { validatePattern } from './validate.ts';

export type GridResult = { readonly ok: true; readonly pattern: Pattern } | { readonly ok: false; readonly reason: string };

export const fail = (reason: string): { readonly ok: false; readonly reason: string } => ({ ok: false, reason });

/** Beszúrás egy szembe vagy láncszembe, mindkét szálba. */
export const intoStitch = (id: NodeId): Anchor => ({ into: 'stitch', id, mode: 'both-loops' });

export const intoSpace = (id: string): Anchor => ({ into: 'space', id });

export class GridWriter {
  readonly stitches: StitchNode[] = [];
  readonly spaces: Space[] = [];
  readonly events: LayerEvent[] = [];
  readonly skipped: NodeId[] = [];
  #previous: NodeId | null = null;

  add(def: StitchDefId, anchors: readonly Anchor[] = [], color = 0): NodeId {
    const id = `n${this.stitches.length + 1}`;
    this.stitches.push({ id, def, prev: this.#previous, anchors, ...(color > 0 ? { color } : {}) });
    this.#previous = id;
    return id;
  }

  chains(count: number, color = 0): NodeId[] {
    return Array.from({ length: count }, () => this.add('ch', [], color));
  }

  /** Láncszemek, amelyeket a következő sor láncívként vagy egyenként használ; az azonosítója is. */
  space(count: number, color = 0): { readonly id: string; readonly chains: NodeId[] } {
    const chains = this.chains(count, color);
    const id = `s${this.spaces.length + 1}`;
    this.spaces.push({ id, chains });
    return { id, chains };
  }

  /** A már lerakott láncszemek láncívként (pl. a C2C-csempe fordulólánca). */
  spaceOf(chains: readonly NodeId[]): string {
    const id = `s${this.spaces.length + 1}`;
    this.spaces.push({ id, chains });
    return id;
  }

  event(kind: LayerEvent['kind']): void {
    this.events.push({ after: this.#previous!, kind });
  }
}

/** A darab a gráfból és a rácsmintából, a sor végi szemszámmal. */
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
  for (const layer of graph.layers.slice(1)) if (layer.closing) stated.set(layer.closing.after, layer.stitchCount);
  return { ...piece, events: piece.events.map((event) => ({ ...event, statedCount: stated.get(event.after)! })) };
}

/**
 * Az új minta a darabbal: a cím marad, ha nem az alapértelmezett vagy egy
 * generátor adta; a jelölés, a profilok és a konvenciók megmaradnak. A
 * generált minta nem hozhat hibát az ellenőrzőben.
 */
export function finishGridPattern(pattern: Pattern, piece: Piece): GridResult {
  const generated = new Set<string>([...Object.values(SHAPE_NAMES), ...Object.values(MOTIF_NAMES), ...Object.values(TECHNIQUE_NAMES)]);
  const untitled = pattern.title.trim() === '' || pattern.title === 'Új minta' || generated.has(pattern.title);
  const result: Pattern = { ...pattern, title: untitled ? piece.name : pattern.title, pieces: [piece] };
  const errors = validatePattern(result, libraryFor(result)).filter((finding) => finding.severity === 'error');
  if (errors.length > 0) return fail(`A generált minta nem ment át az ellenőrzőn (${errors[0]!.rule}): ez a program hibája, kérlek, jelezd.`);
  return { ok: true, pattern: result };
}

/** „A 3. sor”, „Az 5. sor”: nagybetűs határozott névelővel. */
export function rowName(row: number): string {
  const word = article(row);
  return `${word.charAt(0).toUpperCase()}${word.slice(1)} ${row}. sor`;
}
