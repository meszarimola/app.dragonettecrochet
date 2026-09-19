// KB: 01 §6.1, §6.2, §8.1, §8.4; interface.md §1, §21, §22

import { stitchById } from '../core/stitches.ts';
import type { ChartStyle, GroupStitchDef, InsertionMode, JoinedStitchDef, StitchDef } from '../core/types.ts';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export type InsertionMark = 'front-loop' | 'back-loop' | 'front-post' | 'back-post';

export type ShapeRole =
  | 'stem'
  | 'bar'
  | 'hatch'
  | 'cross'
  | 'chain'
  | 'dot'
  | 'ring'
  | 'closure'
  | 'tilde'
  | InsertionMark;

export type Shape =
  | { readonly kind: 'line'; readonly role: ShapeRole; readonly from: Point; readonly to: Point }
  | {
      readonly kind: 'curve';
      readonly role: ShapeRole;
      readonly from: Point;
      readonly control: Point;
      readonly to: Point;
    }
  | {
      readonly kind: 'ellipse';
      readonly role: ShapeRole;
      readonly center: Point;
      readonly rx: number;
      readonly ry: number;
      readonly rotation: number;
    }
  | { readonly kind: 'dot'; readonly role: ShapeRole; readonly center: Point; readonly r: number };

export interface SymbolOptions {
  readonly singleCrochet: 'plus' | 'cross';
  readonly style?: ChartStyle;
  readonly insertion?: InsertionMode;
}

export const DEFAULT_SYMBOL_OPTIONS: SymbolOptions = { singleCrochet: 'plus' };

const STEM_BASE = 10;
const STEM_STEP = 8;
const BAR_HALF = 7;
const HATCH_HALF = 5;
const HATCH_SLANT = 2.5;
const HATCH_GAP = 6;
const HATCH_HALF_COMPACT = 3.5;
const ARM_SINGLE = 0.5;
const ARM_COMPACT = 0.35;
const FAN_STEP = 26;
const FAN_MAX = 70;
const SPREAD_GAP = 14;
const LENS_GAP = 10;
const CHAIN_RX = 9;
const CHAIN_RY = 5;
const SMALL_CHAIN_RX = 4.5;
const SMALL_CHAIN_RY = 2.75;
const SLIP_R = 3.5;
const RING_R = 10;
const PICOT_R = 5.5;
const ARCH_R = 13;
const JIS_LOOP_HALF = 6;
const JIS_LOOP_DROP = 4;

const FOOT: Point = { x: 0, y: 0 };
const UP: Point = { x: 0, y: -1 };
const RIGHT: Point = { x: 1, y: 0 };

// KB: 01 §8.1
export function stemLength(chainHeight: number): number {
  return STEM_BASE + STEM_STEP * chainHeight;
}

// KB: 01 §6.1, §8.1
export function hatchCount(def: StitchDef): number {
  return def.chainHeight >= 3 ? def.yarnOvers : 0;
}

function add(...points: Point[]): Point {
  return points.reduce((sum, p) => ({ x: sum.x + p.x, y: sum.y + p.y }), { x: 0, y: 0 });
}

function scale(p: Point, k: number): Point {
  return { x: p.x * k, y: p.y * k };
}

function unit(p: Point): Point {
  return scale(p, 1 / Math.hypot(p.x, p.y));
}

function normal(t: Point): Point {
  return { x: -t.y, y: t.x };
}

function rowUp(across: Point): Point {
  return { x: across.y, y: -across.x };
}

function rotationOf(direction: Point): number {
  return Math.atan2(direction.y, direction.x);
}

interface Stem {
  readonly shape: Shape;
  readonly length: number;
  at(u: number): { readonly point: Point; readonly tangent: Point };
}

function lineStem(from: Point, to: Point): Stem {
  const delta = add(to, scale(from, -1));
  const tangent = unit(delta);
  return {
    shape: { kind: 'line', role: 'stem', from, to },
    length: Math.hypot(delta.x, delta.y),
    at: (u) => ({ point: add(from, scale(delta, u)), tangent }),
  };
}

function curveStem(from: Point, control: Point, to: Point): Stem {
  return {
    shape: { kind: 'curve', role: 'stem', from, control, to },
    length: Math.hypot(to.x - from.x, to.y - from.y),
    at: (u) => ({
      point: add(scale(from, (1 - u) ** 2), scale(control, 2 * u * (1 - u)), scale(to, u ** 2)),
      tangent: unit(add(scale(add(control, scale(from, -1)), 2 * (1 - u)), scale(add(to, scale(control, -1)), 2 * u))),
    }),
  };
}

function line(role: ShapeRole, from: Point, to: Point): Shape {
  return { kind: 'line', role, from, to };
}

function bar(at: Point, across: Point): Shape {
  return line('bar', add(at, scale(across, -BAR_HALF)), add(at, scale(across, BAR_HALF)));
}

function chainOval(center: Point, rx: number, ry: number, rotation: number): Shape {
  return { kind: 'ellipse', role: 'chain', center, rx, ry, rotation };
}

// KB: interface.md §21 — `across` is the ROW axis at this point, and the cross and bar follow it.
function drawStitch(
  out: Shape[],
  part: StitchDef,
  stem: Stem,
  across: Point,
  options: SymbolOptions,
  withBar: boolean,
  compact: boolean,
): void {
  if (part.chainHeight <= 1) {
    const { point: mid } = stem.at(0.5);
    const half = stem.length * (compact ? ARM_COMPACT : ARM_SINGLE);

    if (options.singleCrochet === 'plus' && options.style !== 'jis') {
      out.push(stem.shape, line('cross', add(mid, scale(across, -half)), add(mid, scale(across, half))));
    } else {
      const up = rowUp(across);
      const rising = add(up, across);
      const falling = add(up, scale(across, -1));
      out.push(
        line('cross', add(mid, scale(rising, -half)), add(mid, scale(rising, half))),
        line('cross', add(mid, scale(falling, -half)), add(mid, scale(falling, half))),
      );
    }
    return;
  }

  out.push(stem.shape);

  if (withBar) out.push(bar(stem.at(1).point, across));

  const hatches = hatchCount(part);
  const hatchHalf = compact ? HATCH_HALF_COMPACT : HATCH_HALF;
  for (let i = 0; i < hatches; i++) {
    const { point, tangent } = stem.at(0.5 + ((i - (hatches - 1) / 2) * HATCH_GAP) / stem.length);
    const across = normal(tangent);
    out.push(
      line(
        'hatch',
        add(point, scale(across, -hatchHalf), scale(tangent, -HATCH_SLANT)),
        add(point, scale(across, hatchHalf), scale(tangent, HATCH_SLANT)),
      ),
    );
  }
}

function fan(n: number): Point[] {
  const step = n > 1 ? Math.min(FAN_STEP, FAN_MAX / (n - 1)) : 0;
  return Array.from({ length: n }, (_, i) => {
    const angle = ((i - (n - 1) / 2) * step * Math.PI) / 180;
    return { x: Math.sin(angle), y: -Math.cos(angle) };
  });
}

// KB: 01 §8.4
function drawGroup(out: Shape[], def: GroupStitchDef, options: SymbolOptions): Point[] {
  const members = def.members.map(stitchById);
  const reach = Math.max(...members.filter((m) => m.kind !== 'chain').map((m) => stemLength(m.chainHeight)));

  fan(members.length).forEach((direction, i) => {
    const member = members[i]!;
    if (member.kind === 'chain') {
      const along = normal(scale(direction, -1));
      out.push(chainOval(scale(direction, reach * 0.8), SMALL_CHAIN_RX, SMALL_CHAIN_RY, rotationOf(along)));
    } else {
      drawStitch(
        out,
        member,
        lineStem(FOOT, scale(direction, stemLength(member.chainHeight))),
        RIGHT,
        options,
        true,
        true,
      );
    }
  });

  return [FOOT];
}

function drawJoined(out: Shape[], def: JoinedStitchDef, options: SymbolOptions): Point[] {
  const part = stitchById(def.part);
  const length = stemLength(part.chainHeight);
  const top = scale(UP, length);
  const n = def.parts;

  if (def.base === 'spread') {
    const feet = Array.from({ length: n }, (_, i) => ({ x: (i - (n - 1) / 2) * SPREAD_GAP, y: 0 }));
    for (const foot of feet) drawStitch(out, part, lineStem(foot, top), RIGHT, options, false, true);
    if (part.chainHeight >= 2) out.push(bar(top, RIGHT));
    return feet;
  }

  if (def.closure === 'complete') {
    const tops = fan(n).map((direction) => scale(direction, length));
    for (const end of tops) drawStitch(out, part, lineStem(FOOT, end), RIGHT, options, false, true);

    const xs = tops.map((p) => p.x);
    const ys = tops.map((p) => p.y);
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    out.push({
      kind: 'ellipse',
      role: 'closure',
      center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
      rx: (maxX - minX) / 2 + 4,
      ry: (maxY - minY) / 2 + 4,
      rotation: 0,
    });
    return [FOOT];
  }

  for (let i = 0; i < n; i++) {
    const control = { x: 2 * (i - (n - 1) / 2) * LENS_GAP, y: top.y / 2 };
    drawStitch(out, part, curveStem(FOOT, control, top), RIGHT, options, false, true);
  }
  if (part.chainHeight >= 2) out.push(bar(top, RIGHT));
  return [FOOT];
}

function chainsOnCircle(out: Shape[], center: Point, radius: number, degrees: readonly number[]): void {
  for (const deg of degrees) {
    const angle = (deg * Math.PI) / 180;
    const point = add(center, { x: radius * Math.cos(angle), y: -radius * Math.sin(angle) });
    const tangent = { x: -Math.sin(angle), y: -Math.cos(angle) };
    out.push(chainOval(point, SMALL_CHAIN_RX, SMALL_CHAIN_RY, rotationOf(tangent)));
  }
}

// KB: 01 §8.4
function tilde(out: Shape[], above: Point): void {
  const at = add(above, scale(UP, 5));
  out.push(
    { kind: 'curve', role: 'tilde', from: add(at, { x: -6, y: 0 }), control: add(at, { x: -3, y: -4 }), to: at },
    { kind: 'curve', role: 'tilde', from: at, control: add(at, { x: 3, y: 4 }), to: add(at, { x: 6, y: 0 }) },
  );
}

const MARKS: readonly InsertionMode[] = ['front-loop', 'back-loop', 'front-post', 'back-post'];

function isMark(mode: InsertionMode): mode is InsertionMark {
  return MARKS.includes(mode);
}

// KB: 01 §6.1, §6.2, §8.4; interface.md §32
function insertionMark(mode: InsertionMark, foot: Point, style: ChartStyle = 'cyc'): Shape {
  if (mode === 'back-loop' && style === 'jis') {
    return line(
      mode,
      add(foot, { x: -JIS_LOOP_HALF, y: JIS_LOOP_DROP }),
      add(foot, { x: JIS_LOOP_HALF, y: JIS_LOOP_DROP }),
    );
  }

  const curve = (from: Point, control: Point, to: Point): Shape => ({
    kind: 'curve',
    role: mode,
    from: add(foot, from),
    control: add(foot, control),
    to: add(foot, to),
  });

  switch (mode) {
    case 'front-loop':
      return curve({ x: -5, y: -3 }, { x: 0, y: 9 }, { x: 5, y: -3 });
    case 'back-loop':
      return curve({ x: -5, y: 6 }, { x: 0, y: -4 }, { x: 5, y: 6 });
    case 'front-post':
      return curve({ x: 0, y: 0 }, { x: 3, y: 6 }, { x: 6, y: 0 });
    case 'back-post':
      return curve({ x: 0, y: 0 }, { x: -3, y: 6 }, { x: -6, y: 0 });
  }
}

// KB: 01 §6.2 — the JIS glyph is drawn from lines, with no font dependency.
function ringShapes(center: Point, style: ChartStyle = 'cyc'): Shape[] {
  if (style !== 'jis') return [{ kind: 'ellipse', role: 'ring', center, rx: RING_R, ry: RING_R, rotation: 0 }];
  const at = (x: number, y: number): Point => add(center, scale({ x, y }, RING_R / 10));
  const curve = (from: Point, control: Point, to: Point): Shape => ({ kind: 'curve', role: 'ring', from, control, to });
  return [
    line('ring', at(-3, -9), at(-3, 9)),
    line('ring', at(-8, -4), at(0, -5)),
    line('ring', at(0, -5), at(-8, 5)),
    curve(at(-5, 1), at(4, -10), at(8, 1)),
    curve(at(8, 1), at(9, 10), at(-1, 8)),
  ];
}

// KB: interface.md §22 — this entry point does reject a mode the stitch does not allow.
export function symbolShapes(def: StitchDef, options: SymbolOptions = DEFAULT_SYMBOL_OPTIONS): Shape[] {
  const { shapes, feet } = symbolBody(def, options);
  const insertion = options.insertion ?? def.insertionModes[0];
  if (insertion !== undefined) {
    if (!def.insertionModes.includes(insertion)) {
      throw new RangeError(`${def.id}: nem megengedett beszúrási mód: ${insertion}`);
    }
    if (isMark(insertion)) for (const foot of feet) shapes.push(insertionMark(insertion, foot, options.style));
  }
  return shapes;
}

function symbolBody(def: StitchDef, options: SymbolOptions): { shapes: Shape[]; feet: Point[] } {
  const out: Shape[] = [];
  let feet: Point[] = [FOOT];

  switch (def.kind) {
    case 'chain':
      out.push(chainOval({ x: 0, y: -CHAIN_RY }, CHAIN_RX, CHAIN_RY, 0));
      break;
    case 'slip':
      out.push({ kind: 'dot', role: 'dot', center: { x: 0, y: -SLIP_R }, r: SLIP_R });
      break;
    case 'basic': {
      const top = scale(UP, stemLength(def.chainHeight));
      drawStitch(out, def, lineStem(FOOT, top), RIGHT, options, true, false);
      if (!def.workableTop) tilde(out, top);
      break;
    }
    case 'group':
      feet = drawGroup(out, def, options);
      break;
    case 'joined':
      feet = drawJoined(out, def, options);
      break;
    case 'picot': {
      const center = { x: 0, y: -PICOT_R - SLIP_R };
      chainsOnCircle(out, center, PICOT_R, [90, 210, 330]);
      out.push({ kind: 'dot', role: 'dot', center: add(center, { x: 0, y: PICOT_R }), r: SLIP_R * 0.7 });
      break;
    }
    case 'space':
      chainsOnCircle(out, FOOT, ARCH_R, [150, 90, 30]);
      break;
    case 'ring':
      out.push(...ringShapes({ x: 0, y: -RING_R }, options.style));
      break;
  }

  return { shapes: out, feet };
}

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

// KB: interface.md §23
export function shapeBounds(shapes: readonly Shape[]): Bounds {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  const include = (p: Point, pad = 0): void => {
    minX = Math.min(minX, p.x - pad);
    minY = Math.min(minY, p.y - pad);
    maxX = Math.max(maxX, p.x + pad);
    maxY = Math.max(maxY, p.y + pad);
  };

  for (const shape of shapes) {
    switch (shape.kind) {
      case 'line':
        include(shape.from);
        include(shape.to);
        break;
      case 'curve':
        include(shape.from);
        include(shape.control);
        include(shape.to);
        break;
      case 'ellipse':
        include(shape.center, Math.max(shape.rx, shape.ry));
        break;
      case 'dot':
        include(shape.center, shape.r);
        break;
    }
  }

  return shapes.length ? { minX, minY, maxX, maxY } : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
}

export interface Placement {
  readonly role: 'stitch' | 'chain' | 'slip' | 'picot' | 'ring';
  readonly feet: readonly Point[];
  readonly top: Point;
  readonly angle: number;
  readonly size: number;
}

/**
 * Maps a glyph from its own box onto a placed one: scale about `center`, then
 * turn, then land on `offset`. `scale.x` and `scale.y` may differ, so the whole
 * glyph stretches with the symbol. KB: 01 §8.1
 *
 * An ellipse is scaled along its own axes, which is exact while it sits square
 * to the glyph and a close approximation once it does not. A mirror negates its
 * own angle as well, which a plain turn does not.
 */
export function stretchShapes(
  shapes: readonly Shape[],
  center: Point,
  scale: Point,
  rotation: number,
  offset: Point,
): Shape[] {
  const [cos, sin] = [Math.cos(rotation), Math.sin(rotation)];
  const map = (p: Point): Point => {
    const [dx, dy] = [(p.x - center.x) * scale.x, (p.y - center.y) * scale.y];
    return { x: offset.x + dx * cos - dy * sin, y: offset.y + dx * sin + dy * cos };
  };
  const [kx, ky] = [Math.abs(scale.x), Math.abs(scale.y)];
  const mirrored = scale.x * scale.y < 0;
  return shapes.map((shape): Shape => {
    switch (shape.kind) {
      case 'line':
        return { ...shape, from: map(shape.from), to: map(shape.to) };
      case 'curve':
        return { ...shape, from: map(shape.from), control: map(shape.control), to: map(shape.to) };
      case 'ellipse':
        return {
          ...shape,
          center: map(shape.center),
          rx: shape.rx * kx,
          ry: shape.ry * ky,
          rotation: mirrored ? rotation - shape.rotation : rotation + shape.rotation,
        };
      case 'dot':
        return { ...shape, center: map(shape.center), r: shape.r * Math.min(kx, ky) };
    }
  });
}

export function transformShapes(shapes: readonly Shape[], rotation: number, k: number, offset: Point): Shape[] {
  const [cos, sin] = [Math.cos(rotation), Math.sin(rotation)];
  const map = (p: Point): Point => ({
    x: offset.x + k * (p.x * cos - p.y * sin),
    y: offset.y + k * (p.x * sin + p.y * cos),
  });
  return shapes.map((shape): Shape => {
    switch (shape.kind) {
      case 'line':
        return { ...shape, from: map(shape.from), to: map(shape.to) };
      case 'curve':
        return { ...shape, from: map(shape.from), control: map(shape.control), to: map(shape.to) };
      case 'ellipse':
        return {
          ...shape,
          center: map(shape.center),
          rx: shape.rx * k,
          ry: shape.ry * k,
          rotation: shape.rotation + rotation,
        };
      case 'dot':
        return { ...shape, center: map(shape.center), r: shape.r * k };
    }
  });
}

// KB: 01 §8.4; interface.md §22
export function placedShapes(
  def: StitchDef,
  placement: Placement,
  options: SymbolOptions = DEFAULT_SYMBOL_OPTIONS,
): Shape[] {
  const { top } = placement;
  switch (placement.role) {
    case 'chain': {
      const rx = Math.min(CHAIN_RX, placement.size / 2);
      return [chainOval(top, rx, (rx * CHAIN_RY) / CHAIN_RX, placement.angle)];
    }
    case 'slip':
      return [{ kind: 'dot', role: 'dot', center: top, r: SLIP_R }];
    case 'ring':
      return ringShapes(top, options.style);
    case 'picot':
      return transformShapes(symbolBody(def, options).shapes, 0, 1, add(top, { x: 0, y: PICOT_R + SLIP_R }));
    case 'stitch':
      break;
  }

  const part = def.kind === 'joined' ? stitchById(def.part) : def;
  // KB: interface.md §21
  const across = { x: Math.cos(placement.angle), y: Math.sin(placement.angle) };
  const feet = placement.feet.length > 0 ? placement.feet : [add(top, { x: 0, y: stemLength(part.chainHeight) })];
  const insertion = options.insertion ?? def.insertionModes[0];
  const mark = insertion !== undefined && isMark(insertion) ? insertion : null;
  const out: Shape[] = [];

  if (def.kind === 'joined' && def.base === 'spread') {
    for (const foot of feet) drawStitch(out, part, lineStem(foot, top), across, options, false, true);
    if (part.chainHeight >= 2) out.push(bar(top, across));
  } else if (def.kind === 'basic') {
    drawStitch(out, def, lineStem(feet[0]!, top), across, options, true, false);
    if (!def.workableTop) tilde(out, top);
  } else {
    const foot = feet[0]!;
    const delta = add(top, scale(foot, -1));
    const rotation = Math.atan2(delta.x, -delta.y);
    const k = Math.hypot(delta.x, delta.y) / stemLength(part.chainHeight);
    const body = symbolBody(def, options);
    if (mark) for (const at of body.feet) body.shapes.push(insertionMark(mark, at, options.style));
    return transformShapes(body.shapes, rotation, k, foot);
  }

  if (mark) for (const foot of feet) out.push(insertionMark(mark, foot, options.style));
  return out;
}

// KB: interface.md §23
export function shapesBounds(
  shapes: readonly Shape[],
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const shape of shapes) {
    switch (shape.kind) {
      case 'line':
        add(shape.from.x, shape.from.y);
        add(shape.to.x, shape.to.y);
        break;
      case 'curve':
        add(shape.from.x, shape.from.y);
        add(shape.control.x, shape.control.y);
        add(shape.to.x, shape.to.y);
        break;
      case 'ellipse': {
        const [c, s] = [Math.cos(shape.rotation), Math.sin(shape.rotation)];
        const halfX = Math.hypot(shape.rx * c, shape.ry * s);
        const halfY = Math.hypot(shape.rx * s, shape.ry * c);
        add(shape.center.x - halfX, shape.center.y - halfY);
        add(shape.center.x + halfX, shape.center.y + halfY);
        break;
      }
      case 'dot':
        add(shape.center.x - shape.r, shape.center.y - shape.r);
        add(shape.center.x + shape.r, shape.center.y + shape.r);
        break;
    }
  }
  return minX === Infinity ? null : { minX, minY, maxX, maxY };
}

export function readInk(element: Element): string {
  return getComputedStyle(element).getPropertyValue('--c-ink').trim();
}

export function applyInk(ctx: CanvasRenderingContext2D, ink: string, lineWidth: number): void {
  if (ink) {
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
  }
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

export function drawShapes(ctx: CanvasRenderingContext2D, shapes: readonly Shape[]): void {
  for (const shape of shapes) {
    ctx.beginPath();
    switch (shape.kind) {
      case 'line':
        ctx.moveTo(shape.from.x, shape.from.y);
        ctx.lineTo(shape.to.x, shape.to.y);
        ctx.stroke();
        break;
      case 'curve':
        ctx.moveTo(shape.from.x, shape.from.y);
        ctx.quadraticCurveTo(shape.control.x, shape.control.y, shape.to.x, shape.to.y);
        ctx.stroke();
        break;
      case 'ellipse':
        ctx.ellipse(shape.center.x, shape.center.y, shape.rx, shape.ry, shape.rotation, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'dot':
        ctx.arc(shape.center.x, shape.center.y, shape.r, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
  }
}

export function drawCentered(ctx: CanvasRenderingContext2D, shapes: readonly Shape[], fit = 1): void {
  const { minX, minY, maxX, maxY } = shapeBounds(shapes);
  ctx.save();
  ctx.scale(fit, fit);
  ctx.translate(-(minX + maxX) / 2, -(minY + maxY) / 2);
  drawShapes(ctx, shapes);
  ctx.restore();
}
