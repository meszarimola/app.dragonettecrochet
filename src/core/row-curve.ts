/*
 * Íves és megtört sorok (PQW-893): a sorokban horgolt kendő rajza a valós
 * alakjában. A félkör és a félhold sorai íven, a fentről induló háromszög sorai
 * a gerincnél megtörve állnak.
 *
 * Az egyenes elrendezésből (layout.ts) indulunk, és pontonként leképezzük: a
 * sor menti távolság az íven, illetve a sor két felén ugyanannyi marad, így a
 * szemek szélessége, a legyező és az összefutás nem változik. A sor sugara (a
 * megtört sor távolsága a nyak pontjától) a sor szélességéből jön, hogy az ív a
 * darab nyakszögét fogja át: félkörnél 180°-ot, félholdnál kevesebbet
 * (05 §1.2, §1.6). A megtört sor két fele a gerinccel a darab alsó csúcsának
 * felét zárja be, fentről induló háromszögnél 45°-ot, így a két fél a gerincnél
 * derékszöget alkot (05 §1.4). A rajz a diagram szokása szerint alulról felfelé
 * halad: a nyak pontja alul, a sorok fölötte.
 *
 * A sor sugara csak a saját és az alatta lévő sorok szélességétől függ, ezért
 * új szem csak a saját sorát rendezi át (06 §5.3). A sorok közti hézag nem
 * nyúlik, a sor magassága igen: ha a diagram aránya eltér a valóstól, a szár
 * nyúlik vagy rövidül, az alak marad. Arányhelyes nézetben (PQW-859) és az
 * elméleti szaporításnál a szár is a valós hosszú.
 */

import type { ChartLayout, NodePlacement, Point } from './layout.ts';
import type { RowShape } from './types.ts';

export interface RowCurve {
  /** A gerinc, illetve az ív középvonala az egyenes elrendezésben (x). */
  readonly center: number;
  /** Az egyenes elrendezés pontja az íves rajzon. */
  point(p: Point): Point;
  /** A sor irányának elfordulása a ponton, radiánban (a vászon szögirányában). */
  turn(p: Point): number;
}

/** A sor magasságának nyújtása ezek között marad. */
const MIN_STRETCH = 0.25;
/** A láncalap legkisebb sugara: a layout.ts alapértelmezett oszlopszélessége. */
const MIN_RADIUS = 24;
const MAX_STRETCH = 6;
const DEG = Math.PI / 180;
const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

/**
 * Egy réteg az egyenes elrendezésben: a tetővonala felfelé mérve, és a fél
 * szélessége. A sor a fordulólánc oszlopa miatt felváltva egy-két oszloppal a
 * közép egyik oldalára tolódik; a teljes szélességből számolva az ív így is
 * pontosan a nyakszöget fogja át.
 */
interface Band {
  readonly top: number;
  readonly reach: number;
}

/**
 * Az íves leképezés egy egyenes elrendezésből, kézi igazítás nélkül. Ha még
 * nincs 1. sor, `null`: a láncalap egyenesen marad.
 */
export function rowCurve(layout: ChartLayout, shape: RowShape): RowCurve | null {
  const byLayer: NodePlacement[][] = [];
  for (const node of layout.nodes.values()) (byLayer[node.layer] ??= []).push(node);
  const first = byLayer[1];
  if (!byLayer[0] || !first || first.length === 0) return null;

  // A közép: az 1. sor egy láncszembe horgolt szemeinek talpa; ha nincs, az 1. sor közepe.
  const feet = first.flatMap((node) => (node.role === 'stitch' ? node.feet : []));
  const xs = first.map((node) => node.top.x);
  const center = feet.length > 0 ? feet.reduce((sum, p) => sum + p.x, 0) / feet.length : (Math.min(...xs) + Math.max(...xs)) / 2;

  const half = clamp(shape.neckAngle / 2, 5, 175) * DEG;
  const tip = shape.kind === 'chevron' ? clamp(shape.tipAngle / 2, 5, 85) * DEG : 0;
  /** A sor középvonalának kívánt sugara a sor fél szélességéből. */
  const radiusFor = (reach: number) =>
    shape.kind === 'arc' ? reach / half : Math.max(reach * 0.05, (reach * Math.sin(tip) * Math.sin(half + tip)) / Math.sin(half));

  // Felfelé mérve (−y) rétegenként: a tetővonal és a fél szélesség.
  const bands: Band[] = [];
  byLayer.forEach((nodes, layer) => {
    if (!nodes || nodes.length === 0) return;
    const xs = nodes.map((node) => node.top.x);
    bands[layer] = { top: Math.max(...nodes.map((node) => -node.top.y)), reach: Math.max((Math.max(...xs) - Math.min(...xs)) / 2, 1) };
  });

  // Csomópontok (felfelé mért hely, sugár) a tetővonalakon: ott a sor a kívánt sugáron fekszik, közöttük a sugár
  // egyenletesen nő. A sor így csak a saját és az alatta lévő tetővonal közé esik, és nem lendül túl a sorok között.
  const knots: [number, number][] = [];
  for (const band of bands) {
    if (!band) continue;
    const last = knots.at(-1);
    // A láncalap néhány láncszem: legalább egy oszlopnyi sugáron, hogy az alatta lévő rácssáv ne forduljon át a középponton.
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
    // Kupola: a középpont a (center, 0) pontban, a sor az ív mentén, a sor menti távolsággal.
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
  // Megtört sor: a jobb fele a gerinctől (sin β, cos β) irányban lefelé-kifelé, a normálisa (cos β, −sin β).
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

/** Az elrendezés az íves rajzon: talpak, tetők, a láncszemek iránya, a sor- és szemszámok helye, a befoglaló téglalap. */
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
  const layers = layout.layers.map((layer) => ({ ...layer, start: curve.point(layer.start), end: curve.point(layer.end) }));
  for (const layer of layers.slice(1)) {
    include(layer.start);
    include(layer.end);
  }
  return { ...layout, nodes, layers, bounds: { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad } };
}

/** A töréspontok legfeljebb ennyivel térnek el az igazi ívtől, a diagram egységében. */
const FLATNESS = 0.5;
const MAX_DEPTH = 10;

/** Egy téglalap négy széle az íves rajzon, töréspontokkal. */
export interface CurvedEdges {
  /** A felső (`y0`) és az alsó (`y1`) széle balról jobbra. */
  readonly top: Point[];
  readonly bottom: Point[];
  /** A bal (`x0`) és a jobb (`x1`) széle fentről lefelé. */
  readonly left: Point[];
  readonly right: Point[];
}

/**
 * Egy téglalap (a rács sávja vagy cellája) az íves rajzon. A szakaszokat addig
 * felezzük, amíg a húr fél egységen belül követi az igazi vonalat: a sor menti
 * szél ív, az oldala a középpont közelében, kis sugáron szintén görbül. A
 * megtört sornál a gerincen is van töréspont.
 */
export function curveStrip(x0: number, x1: number, y0: number, y1: number, curve: RowCurve): CurvedEdges {
  /** Töréspontok `from`-tól `to`-ig a `t ↦ pont` vonalon, a megadott belső töréspontokkal. */
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

/** A négy szél zárt sokszögként: fent balról jobbra, a jobb oldal lefelé, lent jobbról balra, a bal oldal felfelé. */
export function outlineOf(edges: { readonly [K in keyof CurvedEdges]: readonly Point[] }): Point[] {
  return [...edges.top, ...edges.right.slice(1, -1), ...[...edges.bottom].reverse(), ...[...edges.left].reverse().slice(1, -1)];
}
