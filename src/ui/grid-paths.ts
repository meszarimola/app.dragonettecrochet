/*
 * A rács rajza útvonalakként (PQW-874): ugyanebből rajzol a vászon
 * (`Path2D`) és az SVG-export, ezért a kettő nem térhet el.
 *
 * DOM nélküli, ezért a Node is futtatja (tests/ui-grid-paths.test.mjs), és a
 * magot `.ts` kiterjesztéssel importálja.
 *
 * Vonalak: a cellák oldalvonala halvány; a sorok és körök határa erősebb;
 * minden 5. vonal még erősebb, minden 10. a legerősebb. A készülő, még üres
 * sor vonalai szaggatottak. Rajzolási sorrend: a gyengébb vonal előbb, hogy
 * a hangsúlyos vonalat ne takarja el.
 *
 * Sokszögben horgolt darabnál a gyűrűk egyenes oldalú sokszögek, a
 * cellavonalak a sokszög paraméterét követik (PQW-888).
 */

import type { ChartGrid, Emphasis, GridArea } from '../core/grid.ts';
import { CIRCLE, framePoint, outline } from '../core/polygon.ts';

export type LineWeight = 'cell' | 'row' | 'five' | 'ten';

export interface BandPath {
  readonly d: string;
  readonly tone: 0 | 1;
  /** Körgyűrűnél a belső kör kivágása miatt `evenodd` kitöltés kell. */
  readonly evenOdd: boolean;
}

export interface LinePath {
  readonly d: string;
  readonly weight: LineWeight;
  readonly dashed: boolean;
}

export interface GridPaths {
  readonly bands: readonly BandPath[];
  readonly lines: readonly LinePath[];
}

/** Képernyőpixelben: a nagyítástól függetlenül ilyen vastag a vonal. */
export const LINE_WIDTH: Readonly<Record<LineWeight, number>> = { cell: 1, row: 1, five: 2, ten: 3 };

const ORDER: readonly LineWeight[] = ['cell', 'row', 'five', 'ten'];
const num = (value: number) => String(Math.round(value * 100) / 100);
const TAU = 2 * Math.PI;

const rowWeight = (emphasis: Emphasis): LineWeight => (emphasis === 'none' ? 'row' : emphasis);
const cellWeight = (emphasis: Emphasis): LineWeight => (emphasis === 'none' ? 'cell' : emphasis);

function circle(r: number): string {
  return `M${num(r)} 0A${num(r)} ${num(r)} 0 1 0 ${num(-r)} 0A${num(r)} ${num(r)} 0 1 0 ${num(r)} 0Z`;
}

type Sector = Extract<GridArea, { kind: 'sector' }>;

/** A gyűrű egyik széle: körben kör, sokszögben a csúcsokat összekötő zárt vonal. */
function ring(area: Sector, r: number): string {
  const corners = area.frame ? outline(area.frame, r) : [];
  if (corners.length === 0) return circle(r);
  return `${corners.map((p, i) => `${i === 0 ? 'M' : 'L'}${num(p.x)} ${num(p.y)}`).join('')}Z`;
}

function radial(area: Sector, r0: number, r1: number, a: number): string {
  const frame = area.frame ?? CIRCLE;
  const [from, to] = [framePoint(frame, r0, a), framePoint(frame, r1, a)];
  return `M${num(from.x)} ${num(from.y)}L${num(to.x)} ${num(to.y)}`;
}

const isFull = (area: Sector) => area.a1 - area.a0 >= TAU - 1e-9;

export function gridPaths(grid: ChartGrid): GridPaths {
  const bands: BandPath[] = [];
  const lines: LinePath[] = [];

  for (const band of grid.bands) {
    const dashed = band.working;
    const { area } = band;
    if (area.kind === 'rect') {
      const { x0, x1, y0, y1 } = area;
      bands.push({ d: `M${num(x0)} ${num(y0)}H${num(x1)}V${num(y1)}H${num(x0)}Z`, tone: band.tone, evenOdd: false });
      lines.push(
        { d: `M${num(x0)} ${num(y1)}H${num(x1)}`, weight: 'row', dashed },
        { d: `M${num(x0)} ${num(y0)}V${num(y1)}M${num(x1)} ${num(y0)}V${num(y1)}`, weight: 'row', dashed },
        { d: `M${num(x0)} ${num(y0)}H${num(x1)}`, weight: rowWeight(band.emphasis), dashed },
      );
    } else {
      const inner = area.r0 > 0 ? ring(area, area.r0) : '';
      bands.push({ d: `${ring(area, area.r1)}${inner}`, tone: band.tone, evenOdd: inner !== '' });
      if (inner) lines.push({ d: inner, weight: 'row', dashed });
      lines.push({ d: ring(area, area.r1), weight: rowWeight(band.emphasis), dashed });
    }
  }

  for (const cell of grid.cells) {
    const band = grid.bands.find((candidate) => candidate.layer === cell.layer);
    const dashed = band?.working ?? false;
    const { area } = cell;
    if (area.kind === 'rect') {
      // A sáv szélén a sáv vonala zár; a cella csak a belső oldalvonalat adja.
      if (band?.area.kind === 'rect' && area.x1 >= band.area.x1 - 1e-6) continue;
      lines.push({ d: `M${num(area.x1)} ${num(area.y0)}V${num(area.y1)}`, weight: cellWeight(cell.emphasis), dashed });
    } else if (!isFull(area)) {
      lines.push({ d: radial(area, area.r0, area.r1, area.a1), weight: cellWeight(cell.emphasis), dashed });
    }
  }

  lines.sort((a, b) => ORDER.indexOf(a.weight) - ORDER.indexOf(b.weight));
  return { bands, lines };
}
