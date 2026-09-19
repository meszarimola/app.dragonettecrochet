// The drawing runs bottom-up: the neck point at the bottom, the rows above it.
// KB: core-support §5, core-geometry §11
import type { ChartLayout, NodePlacement, Point } from './layout.ts';
import type { RowShape } from './types.ts';

export interface RowCurve {
  // The spine, or the arc's axis, as an x in the straight layout.
  readonly center: number;
  point(p: Point): Point;
  // Radians, in the canvas angle direction.
  turn(p: Point): number;
}

const MIN_STRETCH = 0.25;
// One column width, duplicated from the layout's own default rather than imported.
const MIN_RADIUS = 24;
const MAX_STRETCH = 6;
const DEG = Math.PI / 180;
const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

// `top` is measured upwards, so it is −y.
interface Band {
  readonly top: number;
  readonly reach: number;
}

// `null` before row 1 exists: the foundation then stays straight.
export function rowCurve(layout: ChartLayout, shape: RowShape): RowCurve | null {
  const byLayer: NodePlacement[][] = [];
  for (const node of layout.nodes.values()) (byLayer[node.layer] ??= []).push(node);
  const first = byLayer[1];
  if (!byLayer[0] || !first || first.length === 0) return null;

  const feet = first.flatMap((node) => (node.role === 'stitch' ? node.feet : []));
  const xs = first.map((node) => node.top.x);
  const center =
    feet.length > 0 ? feet.reduce((sum, p) => sum + p.x, 0) / feet.length : (Math.min(...xs) + Math.max(...xs)) / 2;

  const half = clamp(shape.neckAngle / 2, 5, 175) * DEG;
  const tip = shape.kind === 'chevron' ? clamp(shape.tipAngle / 2, 5, 85) * DEG : 0;
  const radiusFor = (reach: number) =>
    shape.kind === 'arc'
      ? reach / half
      : Math.max(reach * 0.05, (reach * Math.sin(tip) * Math.sin(half + tip)) / Math.sin(half));

  const bands: Band[] = [];
  byLayer.forEach((nodes, layer) => {
    if (!nodes || nodes.length === 0) return;
    const xs = nodes.map((node) => node.top.x);
    bands[layer] = {
      top: Math.max(...nodes.map((node) => -node.top.y)),
      reach: Math.max((Math.max(...xs) - Math.min(...xs)) / 2, 1),
    };
  });

  // Knots are (height measured upwards, radius); the radius is linear in between.
  const knots: [number, number][] = [];
  for (const band of bands) {
    if (!band) continue;
    const last = knots.at(-1);
    if (!last) {
      knots.push([band.top, Math.max(MIN_RADIUS, radiusFor(band.reach))]);
      continue;
    }
    const rise = band.top - last[0];
    if (rise < 1e-6) continue;
    knots.push([band.top, clamp(radiusFor(band.reach), last[1] + rise * MIN_STRETCH, last[1] + rise * MAX_STRETCH)]);
  }

  const radius = (up: number): number => {
    const [v0, r0] = knots[0]!;
    if (up <= v0) return Math.max(r0 / 2, r0 - (v0 - up));
    for (let i = 1; i < knots.length; i += 1) {
      const [v1, r1] = knots[i]!;
      if (up > v1) continue;
      const [va, ra] = knots[i - 1]!;
      return v1 - va < 1e-9 ? r1 : ra + ((up - va) * (r1 - ra)) / (v1 - va);
    }
    const [vn, rn] = knots.at(-1)!;
    return rn + (up - vn);
  };

  if (shape.kind === 'arc') {
    return {
      center,
      point: (p) => {
        const r = radius(-p.y);
        const angle = (p.x - center) / r;
        return { x: center + r * Math.sin(angle), y: -r * Math.cos(angle) };
      },
      turn: (p) => (p.x - center) / radius(-p.y),
    };
  }
  const [sin, cos, cot] = [Math.sin(tip), Math.cos(tip), 1 / Math.tan(tip)];
  return {
    center,
    point: (p) => {
      const r = radius(-p.y);
      const side = p.x >= center ? 1 : -1;
      const along = Math.abs(p.x - center) - r * cot;
      return { x: center + side * (r * cos + along * sin), y: -r * sin + along * cos };
    },
    turn: (p) => (p.x >= center ? Math.atan2(cos, sin) : Math.atan2(-cos, sin)),
  };
}

export function curveLayout(layout: ChartLayout, curve: RowCurve, pad: number): ChartLayout {
  const nodes = new Map<string, NodePlacement>();
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  const include = (p: Point) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  };
  for (const node of layout.nodes.values()) {
    const top = curve.point(node.top);
    const feet = node.feet.map((foot) => curve.point(foot));
    nodes.set(node.id, { ...node, top, feet, angle: node.angle + curve.turn(node.top) });
    include(top);
    feet.forEach(include);
  }
  const layers = layout.layers.map((layer) => ({
    ...layer,
    start: curve.point(layer.start),
    end: curve.point(layer.end),
  }));
  for (const layer of layers.slice(1)) {
    include(layer.start);
    include(layer.end);
  }
  return {
    ...layout,
    nodes,
    layers,
    bounds: { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad },
  };
}

// Maximum deviation from the true line, in chart units.
const FLATNESS = 0.5;
const MAX_DEPTH = 10;

// `top` (`y0`) and `bottom` (`y1`) run left to right; `left` (`x0`) and `right`
// (`x1`) run top to bottom.
export interface CurvedEdges {
  readonly top: Point[];
  readonly bottom: Point[];
  readonly left: Point[];
  readonly right: Point[];
}

// KB: core-support §5
export function curveStrip(x0: number, x1: number, y0: number, y1: number, curve: RowCurve): CurvedEdges {
  const trace = (at: (t: number) => Point, stops: readonly number[]): Point[] => {
    const points = [at(stops[0]!)];
    const refine = (a: number, pa: Point, b: number, pb: Point, depth: number): void => {
      const middle = (a + b) / 2;
      const pm = at(middle);
      if (depth < MAX_DEPTH && Math.hypot(pm.x - (pa.x + pb.x) / 2, pm.y - (pa.y + pb.y) / 2) > FLATNESS) {
        refine(a, pa, middle, pm, depth + 1);
        refine(middle, pm, b, pb, depth + 1);
      } else points.push(pb);
    };
    for (let i = 1; i < stops.length; i += 1) refine(stops[i - 1]!, at(stops[i - 1]!), stops[i]!, at(stops[i]!), 0);
    return points;
  };
  const across = curve.center > x0 && curve.center < x1 ? [x0, curve.center, x1] : [x0, x1];
  return {
    top: trace((x) => curve.point({ x, y: y0 }), across),
    bottom: trace((x) => curve.point({ x, y: y1 }), across),
    left: trace((y) => curve.point({ x: x0, y }), [y0, y1]),
    right: trace((y) => curve.point({ x: x1, y }), [y0, y1]),
  };
}

// Winds top left-to-right, right side down, bottom right-to-left, left side up.
export function outlineOf(edges: { readonly [K in keyof CurvedEdges]: readonly Point[] }): Point[] {
  return [
    ...edges.top,
    ...edges.right.slice(1, -1),
    ...[...edges.bottom].reverse(),
    ...[...edges.left].reverse().slice(1, -1),
  ];
}
