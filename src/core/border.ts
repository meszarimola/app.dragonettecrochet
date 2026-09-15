/*
 * Szegély a sorokban horgolt darab körül (PQW-862; 03 §7.1, §10 H38).
 *
 * - A felső élen szemenként 1, a láncalap mentén láncszemenként 1 szem.
 * - Az oldalakon sorvégenként a sor szeméhez illő szám: rövidpálcás sorvégre 1,
 *   pálcásra 2, kétráhajtásosra 3. A félpálcáé vitatott (1 vagy 2), ezért a
 *   darab tárolja.
 * - A négy sarokba 3 szem kerül a sarokszem helyett, sarkonként tehát 2-vel
 *   több. Összesen `2·W + 2·Σ sorvégi szám + 4·2` (03 §7.1 H).
 *
 * A szegély most csak egyenes oldalú darab köré készül: minden sor ugyanannyi
 * szem, kihagyott szem nélkül, és a sorok egyforma magasak. A gráfban nincs
 * csomópontja: a sorvégbe horgolt szem célpontját a gráf még nem ismeri, ezért
 * a vászon és a kész méret nem mutatja, csak az írott minta és a Forma szakasz.
 */

import type { PieceGraph } from './graph.ts';
import type { PieceBorder, StitchDef } from './types.ts';

/** Ennyi szem kerül egy sarokba (03 §7.1). */
export const BORDER_CORNER = 3;

export const DEFAULT_BORDER: PieceBorder = { stitch: 'sc', hdcRowEnd: 2 };

/** A két sarok között legalább egy szem maradjon a felső és az alsó élen. */
export const MIN_BORDER_WIDTH = 3;

/** Hány szegélyszem jut egy sorvégre a sor szeme szerint: rövidpálca 1, félpálca 1 vagy 2, pálca 2, kétráhajtásos 3. */
export function rowEndStitches(def: StitchDef, hdcRowEnd: PieceBorder['hdcRowEnd']): number {
  if (def.chainHeight <= 1) return 1;
  if (def.chainHeight === 2) return hdcRowEnd;
  return def.chainHeight - 1;
}

export interface BorderCounts {
  /** A felső él szemei a két sarok között. */
  readonly top: number;
  /** A láncalap menti szemek a két sarok között. */
  readonly bottom: number;
  /** Sorvégenként ennyi szem. */
  readonly perRow: number;
  readonly rows: number;
  /** Egy oldal szemei: `perRow · rows`. */
  readonly side: number;
  /** Egy sarok szemei. */
  readonly corner: number;
  /** A teljes szegély szemszáma. */
  readonly total: number;
}

/** A szegély szemei `topWidth` és `bottomWidth` szemes élekkel, `rows` sorral (03 §7.1 H). */
export function borderCounts(topWidth: number, bottomWidth: number, rows: number, perRow: number): BorderCounts {
  const top = topWidth - 2;
  const bottom = bottomWidth - 2;
  const side = perRow * rows;
  return { top, bottom, perRow, rows, side, corner: BORDER_CORNER, total: top + bottom + 2 * side + 4 * BORDER_CORNER };
}

export type BorderResult = { readonly ok: true; readonly counts: BorderCounts } | { readonly ok: false; readonly reason: string };

/** A darab szegélye a gráf soraiból; ha a darab köré most nem készíthető, az ok. */
export function borderOf(graph: PieceGraph, border: PieceBorder): BorderResult {
  const fail = (reason: string): BorderResult => ({ ok: false, reason });
  if (border.stitch !== 'sc') return fail('A szegély most csak rövidpálcás lehet.');
  const rows = graph.layers.slice(1);
  if (rows.length === 0) return fail('A szegélyhez legalább egy sor kell.');
  if (graph.layers.some((layer) => layer.shape !== 'row')) return fail('A szegély most csak sorokban horgolt darab köré készül.');
  const width = rows[0]!.stitchCount;
  if (graph.piece.skipped.length > 0 || rows.some((layer) => layer.stitchCount !== width)) {
    return fail('A szegély most csak egyenes oldalú darab köré készül: minden sorban ugyanannyi szem legyen.');
  }
  if (width < MIN_BORDER_WIDTH) return fail(`A szegélyhez a sorban legalább ${MIN_BORDER_WIDTH} szem kell.`);
  const perRow = rows.map((layer) => (layer.firstStitch === null ? Number.NaN : rowEndStitches(graph.defs.get(layer.firstStitch)!, border.hdcRowEnd)));
  if (perRow.some(Number.isNaN) || new Set(perRow).size !== 1) return fail('A szegély most csak egyforma magas sorok köré készül.');
  return { ok: true, counts: borderCounts(width, width, rows.length, perRow[0]!) };
}
