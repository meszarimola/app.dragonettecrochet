/*
 * A jelek paraméteres rajza.
 *
 * A jel az öltéskönyvtár adataiból számolódik, nem öltésenként kézzel
 * (01 §6.1, §8.1 szabály 2, §8.4 szabály 18 és 23):
 * - a szár hossza a láncszem-magasságból jön;
 * - a ferde vonalak száma a ráhajtásokból, a félpálca kivételével, amely sima T;
 * - a szaporítás és a kagyló szárai közös talpból indulnak, a fogyasztás
 *   szárai közös tetőbe futnak;
 * - a relief és az első vagy hátsó szál jelölése a talpon van;
 * - a rövidpálca + vagy ×, beállítás szerint (szókészlet K3);
 * - japán (JIS) stílusban a rövidpálca mindig ×, és a hátsó szál egyenes
 *   vonal a talp alatt (01 §6.2, §8.4 szabály 23). A többi jel a két
 *   jelkulcsban azonos alakú.
 *
 * A rajz két lépés. A `symbolShapes` csak geometriát ad (vonal, ív, ellipszis,
 * pont), ezért böngésző nélkül tesztelhető; a `drawShapes` rajzolja vászonra.
 * Az origó a jel talppontja, az y lefelé nő, a szár tehát negatív y felé
 * halad. A színt a `--c-ink` design token adja, a vonalvastagságot a hívó.
 *
 * A Node is futtatja (tests/ui-symbols.test.mjs), ezért a magot `.ts`
 * kiterjesztéssel importálja.
 */

import { stitchById } from '../core/stitches.ts';
import type { ChartStyle, GroupStitchDef, InsertionMode, JoinedStitchDef, StitchDef } from '../core/types.ts';

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A talpon jelölt beszúrási módok. Mindkét szál, láncív és gyűrű jelölés nélküli. */
export type InsertionMark = 'front-loop' | 'back-loop' | 'front-post' | 'back-post';

/** Mit ábrázol egy alakzat. A tesztek szerepek szerint számolnak. */
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
      /** Másodfokú Bézier-görbe vezérlőpontja. */
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
  /** A rövidpálca jele: + vagy × (szókészlet K3). JIS stílusban nem számít, ott mindig ×. */
  readonly singleCrochet: 'plus' | 'cross';
  /** A jelkulcs; hiányában CYC (PQW-868). */
  readonly style?: ChartStyle;
  /** Beszúrási mód. Hiányában az öltés alapértelmezése, az `insertionModes` első eleme. */
  readonly insertion?: InsertionMode;
}

export const DEFAULT_SYMBOL_OPTIONS: SymbolOptions = { singleCrochet: 'plus' };

/* ---- Méretek, a jel saját egységében ---- */

const STEM_BASE = 10;
const STEM_STEP = 8;
const BAR_HALF = 7;
const HATCH_HALF = 5;
const HATCH_SLANT = 2.5;
const HATCH_GAP = 6;
/** Összetett jelben rövidebb ferde vonal, hogy ne folyjon össze a szomszéd száréval. */
const HATCH_HALF_COMPACT = 3.5;
/** A rövidpálca keresztvonalának fél hossza a szárhoz képest: egyedül, illetve összetett jelben. */
const ARM_SINGLE = 0.5;
const ARM_COMPACT = 0.35;
/** Legyező: szomszédos szárak szöge fokban, és a teljes nyílás felső határa. */
const FAN_STEP = 26;
const FAN_MAX = 70;
/** Több öltésen át horgolt öltés talppontjainak távolsága. */
const SPREAD_GAP = 14;
/** Egy öltésbe horgolt, egy tetőbe záródó részöltések kidomborodása. */
const LENS_GAP = 10;
const CHAIN_RX = 9;
const CHAIN_RY = 5;
const SMALL_CHAIN_RX = 4.5;
const SMALL_CHAIN_RY = 2.75;
const SLIP_R = 3.5;
const RING_R = 10;
const PICOT_R = 5.5;
const ARCH_R = 13;
/** A JIS hátsó szál vonala: fél hossz, és mennyivel a talp alatt. */
const JIS_LOOP_HALF = 6;
const JIS_LOOP_DROP = 4;

const FOOT: Point = { x: 0, y: 0 };
const UP: Point = { x: 0, y: -1 };
const RIGHT: Point = { x: 1, y: 0 };

/** A szár hossza: a láncszem-magassággal egyenesen arányosan nő (01 §8.1 szabály 1). */
export function stemLength(chainHeight: number): number {
  return STEM_BASE + STEM_STEP * chainHeight;
}

/**
 * Ferde vonalak egy száron: a ráhajtások száma. A félpálcának is van egy
 * ráhajtása, de a jele sima T; a ferde vonal az egyráhajtásos pálcától
 * jelenik meg (01 §6.1, §8.1 szabály 1–2).
 */
export function hatchCount(def: StitchDef): number {
  return def.chainHeight >= 3 ? def.yarnOvers : 0;
}

/* ---- Vektorok ---- */

function add(...points: Point[]): Point {
  return points.reduce((sum, p) => ({ x: sum.x + p.x, y: sum.y + p.y }), { x: 0, y: 0 });
}

function scale(p: Point, k: number): Point {
  return { x: p.x * k, y: p.y * k };
}

function unit(p: Point): Point {
  return scale(p, 1 / Math.hypot(p.x, p.y));
}

/** Merőleges a haladási irányra; felfelé mutató szárnál jobbra. */
function normal(t: Point): Point {
  return { x: -t.y, y: t.x };
}

/** Az irány szöge a vászon forgatási irányában (0 = vízszintes). */
function rotationOf(direction: Point): number {
  return Math.atan2(direction.y, direction.x);
}

/* ---- Szárak ---- */

/** Egy szár alakja, és rajta egy pont az érintővel a 0 (talp) – 1 (tető) paraméter mentén. */
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
    // A ferde vonalak távolságához elég a húr hossza.
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

/**
 * Egy öltés a száron. Rövidpálca-magasságig kereszt, fölötte szár, igény
 * szerint tetővonal, és a ráhajtásonkénti ferde vonalak a szár közepén.
 * Összetett jelben (`compact`) a kereszt és a ferde vonalak rövidebbek.
 */
function drawStitch(out: Shape[], part: StitchDef, stem: Stem, options: SymbolOptions, withBar: boolean, compact: boolean): void {
  if (part.chainHeight <= 1) {
    const { point: mid, tangent } = stem.at(0.5);
    const across = normal(tangent);
    const half = stem.length * (compact ? ARM_COMPACT : ARM_SINGLE);

    if (options.singleCrochet === 'plus' && options.style !== 'jis') {
      out.push(stem.shape, line('cross', add(mid, scale(across, -half)), add(mid, scale(across, half))));
    } else {
      const rising = add(tangent, across);
      const falling = add(tangent, scale(across, -1));
      out.push(
        line('cross', add(mid, scale(rising, -half)), add(mid, scale(rising, half))),
        line('cross', add(mid, scale(falling, -half)), add(mid, scale(falling, half))),
      );
    }
    return;
  }

  out.push(stem.shape);

  if (withBar) {
    const top = stem.at(1);
    out.push(bar(top.point, normal(top.tangent)));
  }

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

/** n egységirány a talpból felfelé, balról jobbra legyezőben. */
function fan(n: number): Point[] {
  const step = n > 1 ? Math.min(FAN_STEP, FAN_MAX / (n - 1)) : 0;
  return Array.from({ length: n }, (_, i) => {
    const angle = ((i - (n - 1) / 2) * step * Math.PI) / 180;
    return { x: Math.sin(angle), y: -Math.cos(angle) };
  });
}

/* ---- Fajták ---- */

/** Szaporítás, kagyló, V-öltés: minden szár a közös talpból indul (01 §8.4 szabály 18). */
function drawGroup(out: Shape[], def: GroupStitchDef, options: SymbolOptions): Point[] {
  const members = def.members.map(stitchById);
  const reach = Math.max(...members.filter((m) => m.kind !== 'chain').map((m) => stemLength(m.chainHeight)));

  fan(members.length).forEach((direction, i) => {
    const member = members[i]!;
    if (member.kind === 'chain') {
      // A tagok közti láncszem a szárak között, a tetők alatt (V-öltés, 01 §4.4).
      const along = normal(scale(direction, -1));
      out.push(chainOval(scale(direction, reach * 0.8), SMALL_CHAIN_RX, SMALL_CHAIN_RY, rotationOf(along)));
    } else {
      drawStitch(out, member, lineStem(FOOT, scale(direction, stemLength(member.chainHeight))), options, true, true);
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
    // Fogyasztás: külön talpakból egy tetőbe futó szárak (01 §8.4 szabály 18).
    const feet = Array.from({ length: n }, (_, i) => ({ x: (i - (n - 1) / 2) * SPREAD_GAP, y: 0 }));
    for (const foot of feet) drawStitch(out, part, lineStem(foot, top), options, false, true);
    if (part.chainHeight >= 2) out.push(bar(top, RIGHT));
    return feet;
  }

  if (def.closure === 'complete') {
    // Popcorn: teljes szárak legyezőben, a tetejük köré rajzolt zárással (01 §6.1).
    const tops = fan(n).map((direction) => scale(direction, length));
    for (const end of tops) drawStitch(out, part, lineStem(FOOT, end), options, false, true);

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

  // Fürt, bogyó, puff: egy talpból kidomborodó és egy tetőbe visszafutó szárak.
  for (let i = 0; i < n; i++) {
    const control = { x: 2 * (i - (n - 1) / 2) * LENS_GAP, y: top.y / 2 };
    drawStitch(out, part, curveStem(FOOT, control, top), options, false, true);
  }
  if (part.chainHeight >= 2) out.push(bar(top, RIGHT));
  return [FOOT];
}

/** Láncszemek körben a talp fölött, vagy ívben a talp körül. */
function chainsOnCircle(out: Shape[], center: Point, radius: number, degrees: readonly number[]): void {
  for (const deg of degrees) {
    const angle = (deg * Math.PI) / 180;
    const point = add(center, { x: radius * Math.cos(angle), y: -radius * Math.sin(angle) });
    const tangent = { x: -Math.sin(angle), y: -Math.cos(angle) };
    out.push(chainOval(point, SMALL_CHAIN_RX, SMALL_CHAIN_RY, rotationOf(tangent)));
  }
}

/** A rákhurok hullámvonala a jel fölött (01 §8.4 szabály 23). */
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

/**
 * A beszúrás jele a talpon (01 §6.1, §8.4 szabály 23):
 * első szál: a talp egy „u” belsejében; hátsó szál: a talp egy fordított „u”
 * tetején; relief: kampó a talpnál, elöl jobbra, hátul balra nyílik.
 * JIS stílusban a hátsó szál vízszintes vonal a jel alatt (01 §6.2). Az első
 * szál JIS-jelére nincs forrásunk, ezért az a CYC-ív marad.
 */
function insertionMark(mode: InsertionMark, foot: Point, style: ChartStyle = 'cyc'): Shape {
  if (mode === 'back-loop' && style === 'jis') {
    return line(mode, add(foot, { x: -JIS_LOOP_HALF, y: JIS_LOOP_DROP }), add(foot, { x: JIS_LOOP_HALF, y: JIS_LOOP_DROP }));
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

/* ---- Nyilvános felület ---- */

/** Egy öltés jelének alakzatai. Nem megengedett beszúrási módra hibát dob. */
export function symbolShapes(def: StitchDef, options: SymbolOptions = DEFAULT_SYMBOL_OPTIONS): Shape[] {
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
      drawStitch(out, def, lineStem(FOOT, top), options, true, false);
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
      // Háromláncszemes pikó: láncszemgyűrű, alul a záró kúszószemmel.
      const center = { x: 0, y: -PICOT_R - SLIP_R };
      chainsOnCircle(out, center, PICOT_R, [90, 210, 330]);
      out.push({ kind: 'dot', role: 'dot', center: add(center, { x: 0, y: PICOT_R }), r: SLIP_R * 0.7 });
      break;
    }
    case 'space':
      // A láncív a kihagyott öltések fölött ível át (01 §4.4).
      chainsOnCircle(out, FOOT, ARCH_R, [150, 90, 30]);
      break;
    case 'ring':
      out.push({ kind: 'ellipse', role: 'ring', center: { x: 0, y: -RING_R }, rx: RING_R, ry: RING_R, rotation: 0 });
      break;
  }

  const insertion = options.insertion ?? def.insertionModes[0];
  if (insertion !== undefined) {
    if (!def.insertionModes.includes(insertion)) {
      throw new RangeError(`${def.id}: nem megengedett beszúrási mód: ${insertion}`);
    }
    if (isMark(insertion)) for (const foot of feet) out.push(insertionMark(insertion, foot, options.style));
  }

  return out;
}

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** A jel befoglaló téglalapja. A görbéknél a vezérlőpontot is beveszi, így inkább nagyobb. */
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

/* ---- A diagramon: talp és tető a számolt elrendezésből (PQW-857) ---- */

/** Egy csomópont helye a diagramon; a src/core/layout.ts `NodePlacement` részhalmaza. */
export interface Placement {
  readonly role: 'stitch' | 'chain' | 'slip' | 'picot' | 'ring';
  readonly feet: readonly Point[];
  readonly top: Point;
  readonly angle: number;
  readonly size: number;
}

/** Az alakzatok elforgatva, léptékezve és eltolva; a forgatás a vászon irányában. */
export function transformShapes(shapes: readonly Shape[], rotation: number, k: number, offset: Point): Shape[] {
  const [cos, sin] = [Math.cos(rotation), Math.sin(rotation)];
  const map = (p: Point): Point => ({ x: offset.x + k * (p.x * cos - p.y * sin), y: offset.y + k * (p.x * sin + p.y * cos) });
  return shapes.map((shape): Shape => {
    switch (shape.kind) {
      case 'line':
        return { ...shape, from: map(shape.from), to: map(shape.to) };
      case 'curve':
        return { ...shape, from: map(shape.from), control: map(shape.control), to: map(shape.to) };
      case 'ellipse':
        return { ...shape, center: map(shape.center), rx: shape.rx * k, ry: shape.ry * k, rotation: shape.rotation + rotation };
      case 'dot':
        return { ...shape, center: map(shape.center), r: shape.r * k };
    }
  });
}

/**
 * A jel a diagram helyén. A szár a talptól a tetőig tart, így a szaporítás
 * tagjai közös talpból legyezőben, a fogyasztás szárai külön talpakból egy
 * tetőbe futnak (01 §8.4 szabály 18). A láncszem a megadott irányban és
 * hosszban, a kúszószem pont, a varázskör kör.
 */
export function placedShapes(def: StitchDef, placement: Placement, options: SymbolOptions = DEFAULT_SYMBOL_OPTIONS): Shape[] {
  const { top } = placement;
  switch (placement.role) {
    case 'chain': {
      const rx = Math.min(CHAIN_RX, placement.size / 2);
      return [chainOval(top, rx, (rx * CHAIN_RY) / CHAIN_RX, placement.angle)];
    }
    case 'slip':
      return [{ kind: 'dot', role: 'dot', center: top, r: SLIP_R }];
    case 'ring':
      return [{ kind: 'ellipse', role: 'ring', center: top, rx: RING_R, ry: RING_R, rotation: 0 }];
    case 'picot':
      return transformShapes(symbolShapes(def, options), 0, 1, add(top, { x: 0, y: PICOT_R + SLIP_R }));
    case 'stitch':
      break;
  }

  const part = def.kind === 'joined' ? stitchById(def.part) : def;
  const feet = placement.feet.length > 0 ? placement.feet : [add(top, { x: 0, y: stemLength(part.chainHeight) })];
  const insertion = options.insertion ?? def.insertionModes[0];
  const mark = insertion !== undefined && isMark(insertion) ? insertion : null;
  const out: Shape[] = [];

  if (def.kind === 'joined' && def.base === 'spread') {
    for (const foot of feet) drawStitch(out, part, lineStem(foot, top), options, false, true);
    const mean = scale(add(...feet), 1 / feet.length);
    if (part.chainHeight >= 2) out.push(bar(top, normal(unit(add(top, scale(mean, -1))))));
  } else if (def.kind === 'basic') {
    drawStitch(out, def, lineStem(feet[0]!, top), options, true, false);
    if (!def.workableTop) tilde(out, top);
  } else {
    // Egy alapba horgolt összetett jel: a kész jel a talp–tető irányba forgatva.
    const foot = feet[0]!;
    const delta = add(top, scale(foot, -1));
    const rotation = Math.atan2(delta.x, -delta.y);
    const k = Math.hypot(delta.x, delta.y) / stemLength(part.chainHeight);
    return transformShapes(symbolShapes(def, options), rotation, k, foot);
  }

  if (mark) for (const foot of feet) out.push(insertionMark(mark, foot, options.style));
  return out;
}

/* ---- Vászon ---- */

/** A jelek tintaszíne a `--c-ink` design tokenből. Konkrét szín a kódban nincs. */
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

/**
 * A jel a befoglaló téglalapja közepével az origóra igazítva, `fit` léptékkel:
 * a vászon a kattintás helyére, a paletta a gomb közepére teszi.
 */
export function drawCentered(ctx: CanvasRenderingContext2D, shapes: readonly Shape[], fit = 1): void {
  const { minX, minY, maxX, maxY } = shapeBounds(shapes);
  ctx.save();
  ctx.scale(fit, fit);
  ctx.translate(-(minX + maxX) / 2, -(minY + maxY) / 2);
  drawShapes(ctx, shapes);
  ctx.restore();
}
