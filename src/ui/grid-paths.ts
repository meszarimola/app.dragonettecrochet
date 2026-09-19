// KB: interface.md §1, §14, §27

import type { ChartGrid, Emphasis, GridArea } from '../core/grid.ts';
import { CIRCLE, framePoint, outline, type Point } from '../core/polygon.ts';
import { outlineOf } from '../core/row-curve.ts';

export type LineWeight = 'cell' | 'row' | 'five' | 'ten';

export interface BandPath {
  readonly d: string;
  readonly tone: 0 | 1;
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

// Screen pixels: the line keeps this width at any zoom.
export const LINE_WIDTH: Readonly<Record<LineWeight, number>> = { cell: 1, row: 1, five: 2, ten: 3 };

const ORDER: readonly LineWeight[] = ['cell', 'row', 'five', 'ten'];
const num = (value: number) => String(Math.round(value * 100) / 100);
const TAU = 2 * Math.PI;

const rowWeight = (emphasis: Emphasis): LineWeight => (emphasis === 'none' ? 'row' : emphasis);

function circle(r: number): string {
  return `M${num(r)} 0A${num(r)} ${num(r)} 0 1 0 ${num(-r)} 0A${num(r)} ${num(r)} 0 1 0 ${num(r)} 0Z`;
}

type Sector = Extract<GridArea, { kind: 'sector' }>;

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

const polyline = (points: readonly Point[]) =>
  points.map((p, i) => `${i === 0 ? 'M' : 'L'}${num(p.x)} ${num(p.y)}`).join('');

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
    } else if (area.kind === 'strip') {
      bands.push({ d: `${polyline(outlineOf(area))}Z`, tone: band.tone, evenOdd: false });
      lines.push(
        { d: polyline(area.bottom), weight: 'row', dashed },
        { d: `${polyline(area.left)}${polyline(area.right)}`, weight: 'row', dashed },
        { d: polyline(area.top), weight: rowWeight(band.emphasis), dashed },
      );
    } else {
      const inner = area.r0 > 0 ? ring(area, area.r0) : '';
      bands.push({ d: `${ring(area, area.r1)}${inner}`, tone: band.tone, evenOdd: inner !== '' });
      if (inner) lines.push({ d: inner, weight: 'row', dashed });
      lines.push({ d: ring(area, area.r1), weight: rowWeight(band.emphasis), dashed });
    }
  }

  for (const cell of grid.cells) {
    // KB: interface.md §27
    if (cell.layer === 0) continue;
    const band = grid.bands.find((candidate) => candidate.layer === cell.layer);
    const dashed = band?.working ?? false;
    // KB: interface.md §27 — always 'cell', never a counting emphasis.
    const weight: LineWeight = 'cell';
    const { area } = cell;
    if (area.kind === 'rect') {
      // The band's own outline closes the cell at the band edge; drop the duplicate line.
      if (band?.area.kind === 'rect' && area.x1 >= band.area.x1 - 1e-6) continue;
      lines.push({ d: `M${num(area.x1)} ${num(area.y0)}V${num(area.y1)}`, weight, dashed });
    } else if (area.kind === 'strip') {
      // As above: the band's outline closes the cell at the band edge.
      const end = area.top.at(-1)!;
      const edge = band?.area.kind === 'strip' ? band.area.top.at(-1) : undefined;
      if (edge && Math.hypot(edge.x - end.x, edge.y - end.y) < 1e-6) continue;
      lines.push({ d: polyline(area.right), weight, dashed });
    } else if (!isFull(area)) {
      lines.push({ d: radial(area, area.r0, area.r1, area.a1), weight, dashed });
    }
  }

  lines.sort((a, b) => ORDER.indexOf(a.weight) - ORDER.indexOf(b.weight));
  return { bands, lines };
}
