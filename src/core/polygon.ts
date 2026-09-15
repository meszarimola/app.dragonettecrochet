/*
 * A körben horgolt darab alakja (PQW-888): kör, vagy szabályos sokszög.
 *
 * A körök elrendezése (layout.ts) és a koncentrikus rács (grid.ts) két
 * számmal írja le a helyet: a belső sugárral és a kerület menti paraméterrel.
 * - Körben a belső sugár a sugár, a paraméter a szög.
 * - Sokszögben a belső sugár az apotéma (a középpont távolsága az oldaltól), a
 *   paraméter a sarkokban egyezik a szöggel, az oldalakon egyenletesen halad.
 *   Így az egymás fölé horgolt sarokcsoportok ugyanabba a sarokba kerülnek, és
 *   az oldalak egyenesek (03 §8, 04 §6.1).
 *
 * A sokszög felső oldala vízszintes, a kör a felső oldal közepéről indul. Ez
 * az állás tükrözve önmaga, ezért a balkezes nézetnek nem kell külön alak.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface RoundFrame {
  /** A sarkok száma; körben 0. */
  readonly sides: number;
  /** Az első sarok szöge radiánban, az óramutatóval ellentétesen; körben 0. */
  readonly corner: number;
}

export const CIRCLE: RoundFrame = { sides: 0, corner: 0 };

const TAU = 2 * Math.PI;
const normalize = (angle: number) => ((angle % TAU) + TAU) % TAU;
const polar = (r: number, a: number): Point => ({ x: r * Math.cos(a), y: -r * Math.sin(a) });

/** A darab alakja a sarkok számából; három sarok alatt kör. */
export function frameFor(corners: number | undefined): RoundFrame {
  if (corners === undefined || !Number.isInteger(corners) || corners < 3) return CIRCLE;
  return { sides: corners, corner: Math.PI / 2 + Math.PI / corners };
}

const isPolygon = (frame: RoundFrame) => frame.sides >= 3;

/** Az oldal, amelyen a paraméter áll: a kezdő sarok szöge. */
function sideStart(frame: RoundFrame, u: number): number {
  const step = TAU / frame.sides;
  return frame.corner + Math.floor((u - frame.corner) / step) * step;
}

/** Az oldal két végének paramétere, amelyen `u` áll, `u`-val azonos körülfordulásban; körben nincs oldal. */
export function frameSide(frame: RoundFrame, u: number): readonly [number, number] {
  if (!isPolygon(frame)) return [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];
  const start = sideStart(frame, u);
  return [start, start + TAU / frame.sides];
}

/** A pont `r` belső sugáron, `u` paraméternél. */
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

/** A pont belső sugara és paramétere; a paraméter a [0, 2π) tartományban, a középpontban `NaN`. */
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

/** Kifelé mutató irány a paraméternél (szög): körben maga a szög, sokszögben az oldal normálisa. */
export function frameNormal(frame: RoundFrame, u: number): number {
  return isPolygon(frame) ? sideStart(frame, u) + Math.PI / frame.sides : u;
}

/** A kerület `r` belső sugáron: körben 2πr, sokszögben 2n · tg(π/n) · r (04 §6.1). */
export function perimeter(frame: RoundFrame, r: number): number {
  return isPolygon(frame) ? 2 * frame.sides * Math.tan(Math.PI / frame.sides) * r : TAU * r;
}

/** A sokszög csúcsai `r` belső sugáron, az első saroktól; körben üres. */
export function outline(frame: RoundFrame, r: number): Point[] {
  if (!isPolygon(frame)) return [];
  const R = r / Math.cos(Math.PI / frame.sides);
  return Array.from({ length: frame.sides }, (_, j) => polar(R, frame.corner + (TAU * j) / frame.sides));
}
