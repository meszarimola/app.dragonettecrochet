export interface Point {
  readonly x: number;
  readonly y: number;
}

// A position in a round is (inner radius, along-round parameter): the radius and the
// angle in a circle, the apothem and a corner-matching parameter in a polygon.
// `sides: 0` is a circle; canvas y grows downward, so angles run counter-clockwise.
// KB: core-support §4, core-geometry §18, §19
export interface RoundFrame {
  readonly sides: number;
  readonly corner: number;
}

export const CIRCLE: RoundFrame = { sides: 0, corner: 0 };

const TAU = 2 * Math.PI;
const normalize = (angle: number) => ((angle % TAU) + TAU) % TAU;
const polar = (r: number, a: number): Point => ({ x: r * Math.cos(a), y: -r * Math.sin(a) });

export function frameFor(corners: number | undefined): RoundFrame {
  if (corners === undefined || !Number.isInteger(corners) || corners < 3) return CIRCLE;
  return { sides: corners, corner: Math.PI / 2 + Math.PI / corners };
}

const isPolygon = (frame: RoundFrame) => frame.sides >= 3;

function sideStart(frame: RoundFrame, u: number): number {
  const step = TAU / frame.sides;
  return frame.corner + Math.floor((u - frame.corner) / step) * step;
}

// A circle has no side: the interval returned then contains every parameter.
export function frameSide(frame: RoundFrame, u: number): readonly [number, number] {
  if (!isPolygon(frame)) return [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];
  const start = sideStart(frame, u);
  return [start, start + TAU / frame.sides];
}

export function framePoint(frame: RoundFrame, r: number, u: number): Point {
  if (!isPolygon(frame)) return polar(r, u);
  const step = TAU / frame.sides;
  const start = sideStart(frame, u);
  const t = (u - start) / step;
  const R = r / Math.cos(step / 2);
  const a = polar(R, start);
  const b = polar(R, start + step);
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

// `u` is in [0, 2π), and `NaN` at the centre.
export function frameCoords(frame: RoundFrame, p: Point): { readonly r: number; readonly u: number } {
  const angle = normalize(Math.atan2(-p.y, p.x));
  if (!isPolygon(frame)) {
    const r = Math.hypot(p.x, p.y);
    return { r, u: r < 1e-9 ? Number.NaN : angle };
  }
  const step = TAU / frame.sides;
  const start = frame.corner + Math.floor(normalize(angle - frame.corner) / step) * step;
  const normal = start + step / 2;
  const r = p.x * Math.cos(normal) - p.y * Math.sin(normal);
  if (r < 1e-9) return { r: 0, u: Number.NaN };
  const half = r * Math.tan(step / 2);
  const along = -p.x * Math.sin(normal) - p.y * Math.cos(normal);
  return { r, u: normalize(start + ((along + half) / (2 * half)) * step) };
}

export function frameNormal(frame: RoundFrame, u: number): number {
  return isPolygon(frame) ? sideStart(frame, u) + Math.PI / frame.sides : u;
}

// KB: 04 §6.1, core-geometry §19
export function perimeter(frame: RoundFrame, r: number): number {
  return isPolygon(frame) ? 2 * frame.sides * Math.tan(Math.PI / frame.sides) * r : TAU * r;
}

// Empty for a circle.
export function outline(frame: RoundFrame, r: number): Point[] {
  if (!isPolygon(frame)) return [];
  const R = r / Math.cos(Math.PI / frame.sides);
  return Array.from({ length: frame.sides }, (_, j) => polar(R, frame.corner + (TAU * j) / frame.sides));
}
