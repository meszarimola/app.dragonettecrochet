/*
 * Kendőformák (PQW-865): fentről induló háromszög (szárnyakkal is),
 * aszimmetrikus háromszög, félhold és félkör fordított sorokban; kör, Pi-kendő
 * és eltolt Pi-kendő körökben; téglalap stóla. A kész gráfot ugyanaz az
 * ellenőrző, rajz és írott minta dolgozza fel, mint a kézzel horgoltat.
 *
 * - A soronkénti szaporítás a szem magasság/szélesség arányával (h/w) arányos
 *   (05 §1.1). Fentről induló háromszögnél az egész sorra `4·h/w`: élenként
 *   `h/w`, a gerincen `2·h/w`, és a sorok száma `D/(√2·h)` (05 §1.4).
 *   Félkörnél soronként `π·h/w` (05 §1.2), körnél a körös arányból `2π·h/w`
 *   (rounds.ts). Aszimmetrikus háromszögnél az egyik él soronként `h/w`-vel
 *   nő, ez 45° (05 §1.5). Félholdnál csak a széleken szaporítunk, élenként
 *   `2·h/w`-vel (05 §1.6, a kötött félhold soronkénti +1 élenként lustakötésnél).
 * - A tervező a saját arányát is választhatja (05 §1.2, §1.4, README §4.7). A
 *   terv ekkor a kapott szöget és méretet adja, és ha az arány 15%-nál többel
 *   eltér az ideálistól, figyelmeztet, de nem tagad meg (05 §9.4).
 * - Páros szimmetria (05 §1.4): a szimmetrikus kendőben a szaporítás párban
 *   jön. A tört arányt a sorok között hibaösszegzéssel osztjuk el; a +2-es sor
 *   felváltva a széleken és a gerincen van.
 * - Pi-kendő (05 §1.3): a 2., 4., 8., 16. … körben duplázás; az eltolt
 *   változatban a `round(2^k · 0,75)`. körben, így az eltérés kb. ±25%.
 * - Az utolsó sor a szegély „X többszöröse + Y” ismétléséhez igazodik (05 §1.4
 *   „A” 6. lépés, §1.2): a szimmetrikus kendőben félenként, az utolsó sorokban
 *   soronként legfeljebb ±2 szaporítással félenként.
 * - Blokkolt és blokkolatlan méret (05 §1.8): a profil jelöli, melyik a mért,
 *   a másikat a megadott blokkolási nyúlással számoljuk (02 §8). Csipkénél a
 *   blokkolt mintasűrűségből érdemes számolni.
 *
 * A sorban horgolt kendő egyetlen láncszembe horgolt 1. sorral kezdődik. A
 * fordulólánc és a láncalap a minta hagyománya szerint áll (tradition.ts);
 * minden sor és kör végén a mintában megadott szemszám a gráf számolása.
 */

import { stitchDimensions, type DimensionBasis } from './gauge.ts';
import { buildPieceGraph } from './graph.ts';
import { text, type CoreText } from './messages.ts';
import { activeProfile, gaugeContextOf } from './pattern-size.ts';
import { weakestSource } from './quantity.ts';
import { DEFAULT_MOTIF, MOTIF_NAMES, circlePlan, plannedRounds, type RoundPlan } from './round-generator.ts';
import { flatIncreases } from './rounds.ts';
import { DEFAULT_SHAPE, SHAPE_NAMES, SHAPE_STITCHES, generateShape, planShape, shapeGauge, type ShapeCode, type ShapeRepeat } from './shapes.ts';
import { libraryFor, resolveStitch } from './stitch-variants.ts';
import { hasBaseChain, traditionOf, turningChainCountsFor } from './tradition.ts';
import type { Anchor, LayerEvent, NodeId, Pattern, Piece, StitchDef, StitchDefId, StitchGroup, StitchNode, ValueSource } from './types.ts';
import { validatePattern } from './validate.ts';
import { withGeneratedTitle } from './pattern-title.ts';

export type ShawlKind = 'triangle' | 'asymmetric-triangle' | 'crescent' | 'semicircle' | 'circle' | 'pi' | 'shifted-pi' | 'stole';
export type RateChoice = 'theory' | 'custom';

export const SHAWL_KINDS: readonly ShawlKind[] = ['triangle', 'asymmetric-triangle', 'crescent', 'semicircle', 'circle', 'pi', 'shifted-pi', 'stole'];

export const SHAWL_NAMES: Readonly<Record<ShawlKind, string>> = {
  triangle: 'Fentről induló háromszög',
  'asymmetric-triangle': 'Aszimmetrikus háromszög',
  crescent: 'Félhold',
  semicircle: 'Félkör',
  circle: 'Kör',
  pi: 'Pi-kendő',
  'shifted-pi': 'Eltolt Pi-kendő',
  stole: 'Téglalap stóla',
};

/** Körökben horgolt kendők; a többi fordított sorokban. */
export const ROUND_SHAWLS: readonly ShawlKind[] = ['circle', 'pi', 'shifted-pi'];
/** A szimmetrikus kendők: a szaporítás párban jön, a szegély ismétlése félenként számít. */
export const SYMMETRIC_SHAWLS: readonly ShawlKind[] = ['triangle', 'crescent'];

export const SHAWL_STITCHES: readonly StitchDefId[] = SHAPE_STITCHES;
export const MAX_SHAWL_CM = 300;
export const MAX_SHAWL_ROWS = 250;
/** Egy sorban vagy körben legfeljebb ennyi szem. */
export const MAX_SHAWL_STITCHES = 1200;
/** Az egész kendőben legfeljebb ennyi szem: nagyobb gráfot a szerkesztő már lassan rajzol. */
export const MAX_SHAWL_TOTAL = 30000;
/** A választott arány felső határa soronként vagy körönként. */
export const MAX_SHAWL_RATE = 24;
/** Egy láncszembe vagy szembe legfeljebb ennyi szem kerülhet egy csoportban (stitch-variants.ts). */
export const MAX_INTO_ONE = 12;
/** Élen és gerincen szemenként legfeljebb ennyi szaporítás (03 §10 F27). */
export const MAX_PER_STITCH = 2;
/** Az ideálistól ennél nagyobb eltérés figyelmeztet (05 §9.4: ±15–20%). */
export const DEVIATION_LIMIT = 0.15;
export const MAX_EDGING = 50;

/** A blokkolás nyúlása százalékban: szélességben és magasságban (02 §8 BLOCK_GROWTH; csipkénél mérni kell). */
export interface ShawlBlocking {
  readonly widthPct: number;
  readonly heightPct: number;
}

export const DEFAULT_BLOCKING: ShawlBlocking = { widthPct: 10, heightPct: 5 };

export interface ShawlOptions {
  readonly kind: ShawlKind;
  readonly stitch: StitchDefId;
  /**
   * A fő méret, cm: háromszögnél és félholdnál a gerinc hossza, aszimmetrikus
   * háromszögnél az egyenes él, félkörnél, körnél és Pi-kendőnél a sugár,
   * stólánál a szélesség.
   */
  readonly sizeCm: number;
  /** A stóla hossza, cm. */
  readonly lengthCm: number;
  readonly rate: RateChoice;
  /**
   * A választott arány: háromszögnél a sor összes szaporítása, aszimmetrikus
   * háromszögnél az egyik él szaporítása, félholdnál élenként, félkörnél
   * soronként, körnél körönként; Pi-kendőnél az 1. kör szemszáma.
   */
  readonly customRate: number;
  /** Háromszögnél a második felében a széleken dupla szaporítás (05 §1.4). */
  readonly wings: boolean;
  /** Az utolsó sor „X többszöröse + Y”; szimmetrikus kendőben félenként. */
  readonly edging: ShapeRepeat | null;
  readonly blocking: ShawlBlocking;
}

export const DEFAULT_SHAWL: ShawlOptions = {
  kind: 'triangle',
  stitch: 'dc',
  sizeCm: 40,
  lengthCm: 150,
  rate: 'theory',
  customRate: 8,
  wings: false,
  edging: null,
  blocking: DEFAULT_BLOCKING,
};

/* ---- Mintasűrűség ---- */

export interface ShawlGauge {
  /** Egy szem szélessége, cm. */
  readonly stitchCm: number;
  /** Egy sor magassága, körben a sugár növekedése körönként, cm. */
  readonly rowCm: number;
  readonly source: ValueSource;
  readonly basis: DimensionBasis;
  readonly hookMm: number;
  /** A mintasűrűség blokkolás után mért-e (a profil jelöli); profil nélkül nem. */
  readonly blocked: boolean;
}

function shawlGauge(pattern: Pattern, kind: ShawlKind, stitch: StitchDefId): ShawlGauge {
  const blocked = activeProfile(pattern)?.blocked ?? false;
  if (!ROUND_SHAWLS.includes(kind)) return { ...shapeGauge(pattern, stitch), blocked };
  const def = resolveStitch(stitch) ?? resolveStitch('sc')!;
  const context = gaugeContextOf(pattern, libraryFor(pattern));
  const size = stitchDimensions(def, 'round', context)!;
  return {
    stitchCm: size.widthMm.value / 10,
    rowCm: size.heightMm.value / 10,
    source: weakestSource([size.widthMm.source, size.heightMm.source]),
    basis: size.basis,
    hookMm: context.hookMm,
    blocked,
  };
}

/* ---- Terv ---- */

export type ShawlWarningKind = 'cupping' | 'ruffling' | 'narrow' | 'wide' | 'pi-blocking';

export interface ShawlWarning {
  readonly kind: ShawlWarningKind;
  /** A tényleges és az ideális szemszám aránya (kör, félkör, Pi), illetve a választott és az elméleti arány. */
  readonly ratio: number;
}

export interface ShawlPlan {
  readonly kind: ShawlKind;
  readonly stitch: StitchDefId;
  readonly worked: 'rows' | 'rounds';
  readonly gauge: ShawlGauge;
  /** Soronként vagy körönként a szemszám; a 0. elem az 1. sor. */
  readonly counts: readonly number[];
  /** Az 1. sor szemszáma, és a 2. sortól az előző sor pozícióiba horgolt szemek a haladási irányban. */
  readonly layout: RoundPlan;
  /** Az elméleti arány (lásd `ShawlOptions.customRate`); stólánál 0. */
  readonly theoryRate: number;
  /** A választott arány: elméletinél sorban a pontos, körben a kerekített érték. */
  readonly chosenRate: number;
  /** Szimmetrikus kendőben félenként soronként átlagosan az élen és a gerincen; aszimmetrikusnál az élen. */
  readonly edgeRate: number;
  readonly spineRate: number;
  /** Ettől a sortól dupla a szélek szaporítása; szárnyak nélkül `null`. */
  readonly wingsFromRow: number | null;
  /** Az utolsó sor igazítása: az ismétlések száma és a változás a szemszámban (szimmetrikusnál félenként). */
  readonly edging: { readonly repeats: number; readonly change: number } | null;
  /** Körben és félkörben a sor/kör szemszáma az ideálishoz képest, legkisebb és legnagyobb; más formánál `null`. */
  readonly ratio: { readonly min: number; readonly max: number } | null;
  readonly warnings: readonly ShawlWarning[];
}

/**
 * A kendő elutasításának kódjai (PQW-904): a mag kódot és adatot ad, a mondatot
 * a felület állítja össze (`src/ui/i18n/core/shape.ts`). A sor és a kör szava is
 * a felületé: a mag az adatban `shape: 'row' | 'round'` értéket ad.
 *
 * A stóla a sík téglalapból készül, ezért a forma kódjai is idetartoznak
 * (`ShapeCode`, benne a szegély kódjaival és az `internal-error`-ral).
 */
export type ShawlCode =
  | 'shawl-basic-stitch-only'
  | 'shawl-size-range'
  | 'shawl-length-range'
  | 'shawl-rate-range'
  | 'shawl-edging-width-range'
  | 'shawl-edging-edge-range'
  | 'shawl-blocking-range'
  | 'shawl-min-rows'
  | 'shawl-max-rows'
  | 'shawl-max-stitches'
  | 'shawl-max-total'
  | 'shawl-first-row-into-one'
  | 'shawl-min-rows-depth'
  | 'shawl-max-rows-depth'
  | 'shawl-min-rows-edge'
  | 'shawl-max-rows-edge'
  | 'shawl-min-rows-radius'
  | 'shawl-max-rows-radius'
  | 'shawl-double-limit'
  | 'shawl-min-rounds-radius'
  | 'shawl-max-rounds-radius'
  | 'shawl-edging-rows'
  | 'shawl-edging-round'
  | 'shawl-row-plan-mismatch'
  | 'shawl-too-many-into-one'
  | ShapeCode;

export type ShawlText = CoreText<ShawlCode>;

export type ShawlPlanResult = { readonly ok: true; readonly plan: ShawlPlan } | { readonly ok: false; readonly reason: ShawlText };
export type ShawlResult = { readonly ok: true; readonly pattern: Pattern; readonly plan: ShawlPlan } | { readonly ok: false; readonly reason: ShawlText };

const fail = (reason: ShawlText): { readonly ok: false; readonly reason: ShawlText } => ({ ok: false, reason });

/** Mi nem választható: hiányzó vagy tartományon kívüli méret, arány, ismétlés vagy nyúlás. */
export function shawlProblem(options: ShawlOptions): ShawlText | null {
  const cm = (value: number) => Number.isFinite(value) && value > 0 && value <= MAX_SHAWL_CM;
  if (!SHAWL_STITCHES.includes(options.stitch)) {
    return text('shawl-basic-stitch-only');
  }
  if (!cm(options.sizeCm)) return text('shawl-size-range', { max: MAX_SHAWL_CM });
  if (options.kind === 'stole' && !cm(options.lengthCm)) return text('shawl-length-range', { max: MAX_SHAWL_CM });
  if (options.kind !== 'stole' && options.rate === 'custom') {
    const rate = options.customRate;
    if (!(Number.isFinite(rate) && rate > 0 && rate <= MAX_SHAWL_RATE)) return text('shawl-rate-range', { max: MAX_SHAWL_RATE });
  }
  if (options.edging) {
    const { width, edge } = options.edging;
    if (!Number.isInteger(width) || width < 1 || width > MAX_EDGING) return text('shawl-edging-width-range', { max: MAX_EDGING });
    if (!Number.isInteger(edge) || edge < 0 || edge > MAX_EDGING) return text('shawl-edging-edge-range', { max: MAX_EDGING });
  }
  const { widthPct, heightPct } = options.blocking;
  if (![widthPct, heightPct].every((pct) => Number.isFinite(pct) && pct > -50 && pct <= 100)) {
    return text('shawl-blocking-range');
  }
  return null;
}

/** Hibaösszegzés: a k-adik sorig (0-tól) `avg · k`, `step` többszörösére kerekítve; soronként a különbség. */
function schedule(avg: number, rows: number, step: number): number[] {
  const upTo = (k: number) => step * Math.round((avg * k) / step + 1e-9);
  return Array.from({ length: rows }, (_, k) => (k === 0 ? 0 : upTo(k) - upTo(k - 1)));
}

/** `m` szaporítás egyenletesen `p` pozíción, `shift` (0–1) eltolással. */
function spread(p: number, m: number, shift: number): number[] {
  const into = Array<number>(p).fill(1 + Math.floor(m / p));
  const rest = m % p;
  for (let j = 0; j < rest; j += 1) into[Math.floor(((j + shift) * p) / rest)]! += 1;
  return into;
}

/** A szaporítás egy élen vagy a gerinc egyik oldalán: `from`-tól `dir` irányban, szemenként legfeljebb 2. */
function place(into: number[], from: number, dir: 1 | -1, total: number): void {
  let left = total;
  for (let i = from; left > 0; i += dir) {
    const add = Math.min(MAX_PER_STITCH, left);
    into[Math.min(into.length - 1, Math.max(0, i))]! += add;
    left -= add;
  }
}

/** Szimmetrikus sor: `e` szaporítás mindkét élen, `s` (páros) a gerincen, felezve a két középső szem felé. */
function symmetricInto(p: number, e: number, s: number): number[] {
  const into = Array<number>(p).fill(1);
  place(into, 0, 1, e);
  place(into, p - 1, -1, e);
  place(into, p / 2 - 1, -1, s / 2);
  place(into, p / 2, 1, s / 2);
  return into;
}

/** Az utolsó sor változásának jelöltjei, a legkisebbtől: `count + d ≡ edge (mod width)`. */
function edgingCandidates(count: number, repeat: ShapeRepeat): number[] {
  const base = (((repeat.edge - count) % repeat.width) + repeat.width) % repeat.width;
  return [base, base - repeat.width, base + repeat.width, base - 2 * repeat.width]
    .filter((d, i, all) => all.indexOf(d) === i)
    .sort((a, b) => Math.abs(a) - Math.abs(b) || b - a);
}

/** Az ismétlések száma: `(count − Y) / X`. */
const repeatsOf = (count: number, repeat: ShapeRepeat) => Math.round((count - repeat.edge) / repeat.width);

/**
 * `d` elosztása az utolsó sorokon soronként legfeljebb ±2-vel: `apply(k, delta)`
 * a k-adik sor (0-tól) változtatása, `false`, ha ott nem megy. Sikertelen
 * kísérletnél az előző értékek visszaállnak (`restore`).
 */
function distributeTail(rows: number, d: number, apply: (k: number, delta: number) => boolean): boolean {
  let left = d;
  for (let k = rows - 1; k >= 1 && left !== 0; k -= 1) {
    const delta = Math.sign(left) * Math.min(MAX_PER_STITCH, Math.abs(left));
    if (!apply(k, delta)) return false;
    left -= delta;
  }
  return left === 0;
}

const countsOf = (layout: RoundPlan) => {
  const counts = [layout.first];
  for (const into of layout.rounds) counts.push(into.reduce((sum, n) => sum + n, 0));
  return counts;
};

/** A forma terve a minta mintasűrűségével; a gráfot a `generateShawl` építi. */
export function planShawl(pattern: Pattern, options: ShawlOptions): ShawlPlanResult {
  const problem = shawlProblem(options);
  if (problem) return fail(problem);
  const gauge = shawlGauge(pattern, options.kind, options.stitch);
  const def = resolveStitch(options.stitch)!;
  // Csak a sorban horgolt kendőknél számít (az 1. sor szemszáma); a körös kendő a körgenerátorral épül.
  const counting = turningChainCountsFor(pattern.conventions.turningChainCounts, def, traditionOf(pattern.conventions), 'row');
  const r = gauge.rowCm / gauge.stitchCm;
  const custom = options.rate === 'custom';

  let planned: Omit<ShawlPlan, 'kind' | 'stitch' | 'gauge' | 'counts' | 'warnings'> | ShawlText;
  switch (options.kind) {
    case 'triangle':
    case 'crescent':
      planned = symmetricPlan(options, gauge, r, custom);
      break;
    case 'asymmetric-triangle':
      planned = asymmetricPlan(options, gauge, r, custom);
      break;
    case 'semicircle':
      planned = semicirclePlan(options, gauge, r, custom);
      break;
    case 'circle':
    case 'pi':
    case 'shifted-pi':
      planned = roundPlan(pattern, options, gauge, def, custom);
      break;
    case 'stole':
      planned = stolePlan(pattern, options);
      break;
  }
  if ('code' in planned) return fail(planned);

  const counts = countsOf(planned.layout);
  const rows = counts.length;
  // A sor és a kör szava a felületé: a mag az adatban a nyers `shape`-et adja (PQW-904).
  const shape = planned.worked === 'rounds' ? 'round' : 'row';
  if (rows < 2) return fail(text('shawl-min-rows', { rows: 2, shape }));
  if (rows > MAX_SHAWL_ROWS) return fail(text('shawl-max-rows', { max: MAX_SHAWL_ROWS, shape }));
  if (Math.max(...counts) > MAX_SHAWL_STITCHES) {
    return fail(text('shawl-max-stitches', { max: MAX_SHAWL_STITCHES, shape }));
  }
  if (counts.reduce((sum, n) => sum + n, 0) > MAX_SHAWL_TOTAL) {
    return fail(text('shawl-max-total'));
  }
  // Sorban az 1. sor egyetlen láncszembe megy; számító fordulóláncnál az egyik szem a fordulólánc.
  if (planned.worked === 'rows' && options.kind !== 'stole' && counts[0]! - (counting ? 1 : 0) > MAX_INTO_ONE) {
    return fail(text('shawl-first-row-into-one', { max: MAX_INTO_ONE }));
  }

  return { ok: true, plan: { ...planned, kind: options.kind, stitch: options.stitch, gauge, counts, warnings: warningsOf(options.kind, planned) } };
}

type PlanBody = Omit<ShawlPlan, 'kind' | 'stitch' | 'gauge' | 'counts' | 'warnings'>;

/** Fentről induló háromszög és félhold (05 §1.4, §1.6). */
function symmetricPlan(options: ShawlOptions, gauge: ShawlGauge, r: number, custom: boolean): PlanBody | ShawlText {
  const triangle = options.kind === 'triangle';
  const theoryRate = triangle ? 4 * r : 2 * r;
  const chosenRate = custom ? options.customRate : theoryRate;
  // A gerinc szöge a sorhoz: háromszögnél a sor negyede félenként, félholdnál nincs gerincszaporítás.
  const spineHalf = triangle ? chosenRate / 4 : 0;
  const rows = Math.round((options.sizeCm * Math.sin(Math.atan2(gauge.rowCm, spineHalf * gauge.stitchCm))) / gauge.rowCm);
  if (rows < 2) return text('shawl-min-rows-depth');
  if (rows > MAX_SHAWL_ROWS) return text('shawl-max-rows-depth', { max: MAX_SHAWL_ROWS });

  const edges: number[] = [];
  const spine: number[] = [];
  if (triangle) {
    let toEdges = false;
    for (const total of schedule(chosenRate, rows, 2)) {
      if (total % 4 === 0) {
        edges.push(total / 4);
        spine.push(total / 2);
      } else {
        // A +2-es maradék felváltva a széleken és a gerincen (05 §1.4 „A”).
        const m = (total - 2) / 4;
        toEdges = !toEdges;
        edges.push(toEdges ? m + 1 : m);
        spine.push(toEdges ? 2 * m : 2 * m + 2);
      }
    }
  } else {
    edges.push(...schedule(chosenRate, rows, 1));
    spine.push(...Array<number>(rows).fill(0));
  }
  const wingsFromRow = triangle && options.wings ? Math.floor(rows / 2) + 1 : null;
  if (wingsFromRow !== null) for (let k = wingsFromRow - 1; k < rows; k += 1) edges[k]! *= 2;

  // Az átlagos arány félenként az 1. sor után, a szárnyak és a szegélyhez igazítás előtt: ebből jön a szög.
  const plain = wingsFromRow === null ? rows : wingsFromRow - 1;
  const average = (values: readonly number[], fallback: number) =>
    plain > 1 ? values.slice(1, plain).reduce((sum, v) => sum + v, 0) / (plain - 1) : fallback;
  const edgeRate = average(edges, triangle ? chosenRate / 4 : chosenRate);
  const spineRate = triangle ? average(spine, chosenRate / 2) / 2 : 0;

  const first = Math.max(2, 2 * Math.round(triangle ? chosenRate / 2 : chosenRate));
  const lastHalf = () => (first + edges.reduce((sum, e) => sum + 2 * e, 0) + spine.reduce((sum, s) => sum + s, 0)) / 2;
  const edging = tailEdging(
    options,
    rows,
    lastHalf,
    (k, delta) => {
      // A félenkénti változás az élre, ha ott nem fér, a gerinc felére.
      if (edges[k]! + delta >= 0) edges[k]! += delta;
      else if (spine[k]! + 2 * delta >= 0) spine[k]! += 2 * delta;
      else return false;
      return true;
    },
    () => [...edges, ...spine],
    (saved) => {
      edges.splice(0, rows, ...saved.slice(0, rows));
      spine.splice(0, rows, ...saved.slice(rows));
    },
  );
  if (edging !== null && 'code' in edging) return edging;

  const rounds: number[][] = [];
  let p = first;
  for (let k = 1; k < rows; k += 1) {
    rounds.push(symmetricInto(p, edges[k]!, spine[k]!));
    p += 2 * edges[k]! + spine[k]!;
  }
  return {
    worked: 'rows',
    layout: { first, rounds },
    theoryRate,
    chosenRate,
    edgeRate,
    spineRate,
    wingsFromRow,
    edging,
    ratio: null,
  };
}

/** Aszimmetrikus háromszög oldalról oldalra: az egyik él soronként nő (05 §1.5). */
function asymmetricPlan(options: ShawlOptions, gauge: ShawlGauge, r: number, custom: boolean): PlanBody | ShawlText {
  const theoryRate = r;
  const chosenRate = custom ? options.customRate : theoryRate;
  const rows = Math.round(options.sizeCm / gauge.rowCm);
  if (rows < 2) return text('shawl-min-rows-edge');
  if (rows > MAX_SHAWL_ROWS) return text('shawl-max-rows-edge', { max: MAX_SHAWL_ROWS });
  const grow = schedule(chosenRate, rows, 1);
  const first = Math.max(2, Math.round(chosenRate) + 1);
  const last = () => first + grow.reduce((sum, g) => sum + g, 0);
  const edging = tailEdging(options, rows, last, (k, delta) => {
    if (grow[k]! + delta < 0) return false;
    grow[k]! += delta;
    return true;
  }, () => [...grow], (saved) => grow.splice(0, rows, ...saved));
  if (edging !== null && 'code' in edging) return edging;

  const rounds: number[][] = [];
  let p = first;
  for (let k = 1; k < rows; k += 1) {
    const into = Array<number>(p).fill(1);
    // A ferde él a bal oldali: a páros sorok elején, a páratlanok végén (shapes.ts `startEdge`).
    if ((k + 1) % 2 === 0) place(into, 0, 1, grow[k]!);
    else place(into, p - 1, -1, grow[k]!);
    rounds.push(into);
    p += grow[k]!;
  }
  return {
    worked: 'rows',
    layout: { first, rounds },
    theoryRate,
    chosenRate,
    edgeRate: (last() - first) / (rows - 1),
    spineRate: 0,
    wingsFromRow: null,
    edging,
    ratio: null,
  };
}

/** Az utolsó sorok igazítása egy összesített szemszámhoz; hibánál az ok. */
function tailEdging(
  options: ShawlOptions,
  rows: number,
  last: () => number,
  apply: (k: number, delta: number) => boolean,
  save: () => number[],
  restore: (saved: number[]) => void,
): ShawlPlan['edging'] | ShawlText {
  if (!options.edging) return null;
  for (const d of edgingCandidates(last(), options.edging)) {
    const saved = save();
    if (distributeTail(rows, d, apply)) return { repeats: repeatsOf(last(), options.edging), change: d };
    restore(saved);
  }
  return text('shawl-edging-rows');
}

/** Félkör fordított sorokban (05 §1.2): soronként egyenletesen, soronként eltolva. */
function semicirclePlan(options: ShawlOptions, gauge: ShawlGauge, r: number, custom: boolean): PlanBody | ShawlText {
  const theoryRate = Math.PI * r;
  const chosenRate = custom ? options.customRate : theoryRate;
  const rows = Math.round(options.sizeCm / gauge.rowCm);
  if (rows < 2) return text('shawl-min-rows-radius');
  if (rows > MAX_SHAWL_ROWS) return text('shawl-max-rows-radius', { max: MAX_SHAWL_ROWS });
  const first = Math.max(2, Math.round(chosenRate));
  const grow = schedule(chosenRate, rows, 1);
  const last = () => first + grow.reduce((sum, g) => sum + g, 0);
  // A változás az utolsó sorban egyben is elfér: a sor egyenletesen osztja el.
  const edging = tailEdging(options, rows, last, (k, delta) => {
    if (grow[k]! + delta < 0) return false;
    grow[k]! += delta;
    return true;
  }, () => [...grow], (saved) => grow.splice(0, rows, ...saved));
  if (edging !== null && 'code' in edging) return edging;

  const rounds: number[][] = [];
  let p = first;
  for (let k = 1; k < rows; k += 1) {
    if (grow[k]! > p) return text('shawl-double-limit');
    rounds.push(spread(p, grow[k]!, k % 2 === 0 ? 0 : 0.5));
    p += grow[k]!;
  }
  const counts = countsOf({ first, rounds });
  return {
    worked: 'rows',
    layout: { first, rounds },
    theoryRate,
    chosenRate,
    edgeRate: 0,
    spineRate: 0,
    wingsFromRow: null,
    edging,
    ratio: ratioOf(counts, theoryRate),
  };
}

/** A sor vagy kör szemszáma az ideális `k · I`-hez képest, legkisebb és legnagyobb, a 2. sortól. */
function ratioOf(counts: readonly number[], ideal: number): ShawlPlan['ratio'] {
  const ratios = counts.slice(1).map((count, i) => count / ((i + 2) * ideal));
  return { min: Math.min(...ratios), max: Math.max(...ratios) };
}

/** Kör és Pi-kendő körökben, varázskörből (05 §1.1, §1.3). */
function roundPlan(pattern: Pattern, options: ShawlOptions, gauge: ShawlGauge, def: StitchDef, custom: boolean): PlanBody | ShawlText {
  const increases = flatIncreases(def, gaugeContextOf(pattern, libraryFor(pattern)));
  const theoryRate = increases.exact;
  const chosenRate = custom ? Math.max(3, Math.round(options.customRate)) : increases.count;
  const rounds = Math.round(options.sizeCm / gauge.rowCm);
  if (rounds < 2) return text('shawl-min-rounds-radius');
  if (rounds > MAX_SHAWL_ROWS) return text('shawl-max-rounds-radius', { max: MAX_SHAWL_ROWS });
  let layout: RoundPlan;
  if (options.kind === 'circle') layout = circlePlan(chosenRate, rounds, true);
  else {
    const doubling = piRounds(options.kind === 'shifted-pi', rounds);
    const plan: number[][] = [];
    let p = chosenRate;
    for (let k = 2; k <= rounds; k += 1) {
      plan.push(Array<number>(p).fill(doubling.has(k) ? 2 : 1));
      if (doubling.has(k)) p *= 2;
    }
    layout = { first: chosenRate, rounds: plan };
  }

  let edging: ShawlPlan['edging'] = null;
  if (options.edging) {
    const counts = countsOf(layout);
    const last = counts.at(-1)!;
    const previous = counts.at(-2)!;
    const grow = last - previous;
    // Az utolsó kör egyben igazodik, legfeljebb duplázásig.
    const d = edgingCandidates(last, options.edging).find((change) => grow + change >= 0 && grow + change <= previous);
    if (d === undefined) return text('shawl-edging-round');
    layout = { first: layout.first, rounds: [...layout.rounds.slice(0, -1), spread(previous, grow + d, 0.5)] };
    edging = { repeats: repeatsOf(last + d, options.edging), change: d };
  }
  return {
    worked: 'rounds',
    layout,
    theoryRate,
    chosenRate,
    edgeRate: 0,
    spineRate: 0,
    wingsFromRow: null,
    edging,
    ratio: ratioOf(countsOf(layout), theoryRate),
  };
}

/** A duplázó körök: 2, 4, 8, 16 …; eltolva `round(2^k · 0,75)`: 2, 3, 6, 12 … (05 §1.3). */
export function piRounds(shifted: boolean, rounds: number): Set<number> {
  const result = new Set<number>();
  for (let k = 1; 2 ** k * (shifted ? 0.75 : 1) <= rounds; k += 1) result.add(Math.round(2 ** k * (shifted ? 0.75 : 1)));
  return result;
}

/** Téglalap stóla (05 §1.7): a sík formák téglalapja, az ismétléssel a szélességen. */
function stolePlan(pattern: Pattern, options: ShawlOptions): PlanBody | ShawlText {
  const planned = planShape(pattern, stoleShape(options));
  if (!planned.ok) return planned.reason;
  const { counts, repeats } = planned.plan;
  return {
    worked: 'rows',
    layout: { first: counts[0]!, rounds: counts.slice(1).map((count) => Array<number>(count).fill(1)) },
    theoryRate: 0,
    chosenRate: 0,
    edgeRate: 0,
    spineRate: 0,
    wingsFromRow: null,
    edging: options.edging && repeats !== null ? { repeats, change: 0 } : null,
    ratio: null,
  };
}

const stoleShape = (options: ShawlOptions) => ({
  ...DEFAULT_SHAPE,
  shape: 'rectangle' as const,
  stitch: options.stitch,
  widthCm: options.sizeCm,
  heightCm: options.lengthCm,
  repeat: options.edging,
  rounding: 'nearest' as const,
  border: null,
});

/** Figyelmeztetés az ideálistól 15%-nál nagyobb eltérésre (05 §9.4); nem hiba. */
function warningsOf(kind: ShawlKind, plan: PlanBody): ShawlWarning[] {
  const warnings: ShawlWarning[] = [];
  if (plan.ratio) {
    if (kind === 'pi' || kind === 'shifted-pi') {
      if (plan.ratio.min < 1 - DEVIATION_LIMIT || plan.ratio.max > 1 + DEVIATION_LIMIT) warnings.push({ kind: 'pi-blocking', ratio: plan.ratio.min });
    } else if (plan.ratio.min < 1 - DEVIATION_LIMIT) warnings.push({ kind: 'cupping', ratio: plan.ratio.min });
    else if (plan.ratio.max > 1 + DEVIATION_LIMIT) warnings.push({ kind: 'ruffling', ratio: plan.ratio.max });
  } else if (kind === 'triangle' && plan.theoryRate > 0) {
    // Az egész sor átlagos szaporítása (két él, a gerinc két fele) az elméletihez képest.
    const ratio = (2 * plan.edgeRate + 2 * plan.spineRate) / plan.theoryRate;
    if (ratio < 1 - DEVIATION_LIMIT) warnings.push({ kind: 'narrow', ratio });
    else if (ratio > 1 + DEVIATION_LIMIT) warnings.push({ kind: 'wide', ratio });
  }
  return warnings;
}

/* ---- Méret és alak ---- */

export interface ShawlGeometry {
  /** A legszélesebb kiterjedés és a mélység, cm. */
  readonly widthCm: number;
  readonly depthCm: number;
  /** A körvonal pontjai cm-ben, y lefelé nő; a bal felső sarok a (0, 0). */
  readonly outline: readonly (readonly [number, number])[];
  /** Háromszögnél és félholdnál a nyakél két felének szöge (egyenes nyakélnél 180°). */
  readonly neckAngleDeg: number | null;
  /** Háromszögnél és félholdnál az alsó csúcs szöge; aszimmetrikusnál a ferde él szöge a sorhoz. */
  readonly tipAngleDeg: number | null;
  /** A gerinc vagy az egyenes él hossza, cm; körben és félkörben a sugár. */
  readonly spineCm: number;
}

export interface ShawlSizes {
  /** Melyik a mért: a profil szerint blokkolt, profil nélkül blokkolatlan. */
  readonly measured: 'blocked' | 'unblocked';
  readonly blocked: ShawlGeometry;
  readonly unblocked: ShawlGeometry;
}

const degrees = (radians: number) => (radians * 180) / Math.PI;

/** A kendő mérete blokkolva és blokkolatlanul: a mért állapot a mintasűrűségből, a másik a nyúlással. */
export function shawlSizes(plan: ShawlPlan, blocking: ShawlBlocking): ShawlSizes {
  const w = 1 + blocking.widthPct / 100;
  const h = 1 + blocking.heightPct / 100;
  const { stitchCm, rowCm } = plan.gauge;
  const measured = shawlGeometry(plan, stitchCm, rowCm);
  if (plan.gauge.blocked) return { measured: 'blocked', blocked: measured, unblocked: shawlGeometry(plan, stitchCm / w, rowCm / h) };
  return { measured: 'unblocked', unblocked: measured, blocked: shawlGeometry(plan, stitchCm * w, rowCm * h) };
}

/** A kendő körvonala és mérete egy szemmérettel. */
export function shawlGeometry(plan: ShawlPlan, stitchCm: number, rowCm: number): ShawlGeometry {
  const rows = plan.counts.length;
  const last = plan.counts.at(-1)!;
  const framed = (points: [number, number][], extra: Omit<ShawlGeometry, 'widthCm' | 'depthCm' | 'outline'>): ShawlGeometry => {
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const [minX, minY] = [Math.min(...xs), Math.min(...ys)];
    return {
      widthCm: Math.max(...xs) - minX,
      depthCm: Math.max(...ys) - minY,
      outline: points.map(([x, y]) => [x - minX, y - minY] as const),
      ...extra,
    };
  };
  switch (plan.kind) {
    case 'triangle':
    case 'crescent': {
      // Félenként a sor a gerinctől az élig: a gerinc vége soronként `spineRate·w`-vel befelé, az élé `edgeRate·w`-vel kifelé tolódik.
      const spine: [number, number] = [-plan.spineRate * stitchCm * rows, rowCm * rows];
      const edge: [number, number] = [plan.edgeRate * stitchCm * rows, rowCm * rows];
      // Úgy forgatjuk, hogy a gerinc függőlegesen lefelé álljon.
      const turn = Math.atan2(spine[0], spine[1]);
      const rotate = ([x, y]: [number, number]): [number, number] => [x * Math.cos(turn) - y * Math.sin(turn), x * Math.sin(turn) + y * Math.cos(turn)];
      const tip = rotate(edge);
      const bottom = rotate(spine);
      const thetaSpine = Math.atan2(rowCm, plan.spineRate * stitchCm);
      const thetaEdge = Math.atan2(rowCm, plan.edgeRate * stitchCm);
      return framed([[0, 0], tip, bottom, [-tip[0], tip[1]]], {
        neckAngleDeg: 2 * (180 - degrees(thetaSpine) - degrees(thetaEdge)),
        tipAngleDeg: 2 * degrees(thetaSpine),
        spineCm: Math.hypot(...bottom),
      });
    }
    case 'asymmetric-triangle':
      return framed(
        [
          [0, 0],
          [plan.counts[0]! * stitchCm, 0],
          [last * stitchCm, rows * rowCm],
          [0, rows * rowCm],
        ],
        { neckAngleDeg: null, tipAngleDeg: degrees(Math.atan2(rowCm, plan.edgeRate * stitchCm)), spineCm: rows * rowCm },
      );
    case 'semicircle':
    case 'circle':
    case 'pi':
    case 'shifted-pi': {
      const radius = rows * rowCm;
      const half = plan.kind === 'semicircle';
      const steps = half ? 24 : 48;
      const points = Array.from({ length: steps + 1 }, (_, i): [number, number] => {
        const angle = (Math.PI * (half ? 1 : 2) * i) / steps;
        return [radius * Math.cos(angle), radius * Math.sin(angle)];
      });
      return framed(half ? points : points.slice(0, -1), { neckAngleDeg: null, tipAngleDeg: null, spineCm: radius });
    }
    case 'stole':
      return framed(
        [
          [0, 0],
          [plan.counts[0]! * stitchCm, 0],
          [plan.counts[0]! * stitchCm, rows * rowCm],
          [0, rows * rowCm],
        ],
        { neckAngleDeg: null, tipAngleDeg: null, spineCm: rows * rowCm },
      );
  }
}

/* ---- Gráfépítés ---- */

const both = (id: NodeId): Anchor => ({ into: 'stitch', id, mode: 'both-loops' });

/** Fordított sorok a tervből: láncalap egy célláncszemmel, a 2. sortól az előző sor pozícióiba. */
function turnedRows(pattern: Pattern, def: StitchDef, layout: RoundPlan, name: string): Piece | ShawlText {
  const stitches: StitchNode[] = [];
  const groups: StitchGroup[] = [];
  const events: LayerEvent[] = [];
  let previous: NodeId | null = null;
  const add = (id: StitchDef['id'], anchors: readonly Anchor[] = []): NodeId => {
    const node = `n${stitches.length + 1}`;
    stitches.push({ id: node, def: id, prev: previous, anchors });
    previous = node;
    return node;
  };
  const chains = (count: number) => Array.from({ length: count }, () => add('ch'));
  const into = (target: NodeId, n: number): NodeId[] => {
    const ids = Array.from({ length: n }, () => add(def.id, [both(target)]));
    if (n >= 2) groups.push({ id: `g${groups.length + 1}`, def: `inc-${n}${def.id}`, members: ids });
    return ids;
  };

  const tradition = traditionOf(pattern.conventions);
  const counting = turningChainCountsFor(pattern.conventions.turningChainCounts, def, tradition, 'row');
  const baseChain = hasBaseChain(counting, tradition);
  // Láncalap: a célláncszem, számító fordulóláncnál az alapláncszem, és az 1. sor fordulólánca (03 §1.2, PQW-891).
  const worked = 1 + (baseChain ? 1 : 0);
  const foundation = chains(worked + def.turningChain);
  const target = foundation.slice(0, worked).reverse()[baseChain ? 1 : 0]!;
  let turningTop = foundation.at(-1)!;
  let below = [...(counting ? [turningTop] : []), ...into(target, layout.first - (counting ? 1 : 0))];

  for (const [i, plan] of layout.rounds.entries()) {
    events.push({ after: previous!, kind: 'turn' });
    turningTop = chains(def.turningChain).at(-1)!;
    const working = [...below].reverse();
    // A magyar névelő a felületé: a mag csak a sor számát adja (PQW-904).
    if (plan.length !== working.length) return text('shawl-row-plan-mismatch', { row: i + 2 });
    const made: NodeId[] = [];
    for (const [w, n] of plan.entries()) {
      // A számító fordulólánc az első pozíción ül: oda eggyel kevesebb szem megy.
      const extra = w === 0 && counting ? n - 1 : n;
      if (extra > MAX_INTO_ONE) return text('shawl-too-many-into-one', { row: i + 2, count: extra });
      if (extra > 0) made.push(...into(working[w]!, extra));
    }
    below = [...(counting ? [turningTop] : []), ...made];
  }
  events.push({ after: previous!, kind: 'fasten-off' });
  return { id: 'p1', name, stitches, spaces: [], rings: [], groups, events, skipped: [] };
}

/** A sor végi eseményekbe a gráf szerinti szemszám; a tervtől eltérő sornál az ok. */
function withStatedCounts(pattern: Pattern, piece: Piece, counts: readonly number[]): Piece | ShawlText {
  const whole = { ...pattern, pieces: [piece] };
  const graph = buildPieceGraph(whole, piece, libraryFor(whole));
  const stated = new Map<NodeId, number>();
  for (const layer of graph.layers.slice(1)) {
    if (layer.stitchCount !== counts[layer.index - 1]) {
      // A sor/kör szava és a névelő a felületé: a mag a sorszámot és a `shape`-et adja.
      return text('internal-error', { row: layer.index, shape: layer.shape === 'round' ? 'round' : 'row' });
    }
    if (layer.closing) stated.set(layer.closing.after, layer.stitchCount);
  }
  return { ...piece, events: piece.events.map((event) => (stated.has(event.after) ? { ...event, statedCount: stated.get(event.after)! } : event)) };
}

const tenth = (value: number) => Math.round(value * 10) / 10;

/**
 * A rajz alakja (PQW-893): a félkör és a félhold sorai íven, a fentről induló
 * háromszögé a gerincnél megtörve, a terv szögeivel (row-curve.ts).
 */
function withRowShape(piece: Piece, plan: ShawlPlan): Piece {
  const { neckAngleDeg, tipAngleDeg } = shawlGeometry(plan, plan.gauge.stitchCm, plan.gauge.rowCm);
  switch (plan.kind) {
    case 'semicircle':
      return { ...piece, rowShape: { kind: 'arc', neckAngle: 180 } };
    case 'crescent':
      return { ...piece, rowShape: { kind: 'arc', neckAngle: tenth(neckAngleDeg ?? 180) } };
    case 'triangle':
      return { ...piece, rowShape: { kind: 'chevron', neckAngle: tenth(neckAngleDeg ?? 180), tipAngle: tenth(tipAngleDeg ?? 90) } };
    default:
      return piece;
  }
}

/**
 * Új minta a kendőből. A mintából a címet (ha nem az alapértelmezett vagy egy
 * generátor adta), a jelölést, a profilokat és a konvenciókat veszi át.
 */
export function generateShawl(pattern: Pattern, options: ShawlOptions): ShawlResult {
  const planned = planShawl(pattern, options);
  if (!planned.ok) return planned;
  const { plan } = planned;
  const name = SHAWL_NAMES[options.kind];
  const def = resolveStitch(options.stitch)!;

  let result: Pattern;
  if (options.kind === 'stole') {
    const shape = generateShape(pattern, stoleShape(options));
    if (!shape.ok) return fail(shape.reason);
    result = { ...shape.pattern, pieces: shape.pattern.pieces.map((piece) => ({ ...piece, name })) };
  } else {
    const base: Pattern = { ...pattern, pieces: [] };
    // A `plannedRounds` még magyar mondatot ad (round-generator.ts átmeneti `legacyReason`-je,
    // PQW-904). A kendő ezeket az ágakat nem éri el (varázskörrel kezd, és a kész körterv
    // legfeljebb duplázik), ezért belső hibaként vesszük át; ha a kör kódjai is megvannak, a
    // szegély mintájára `nested()` lesz belőle.
    let piece: Piece | string | ShawlText;
    let conventions = pattern.conventions;
    if (plan.worked === 'rounds') {
      const options = { ...DEFAULT_MOTIF, shape: 'circle' as const, stitch: plan.stitch, start: 'magic-ring' as const, closing: 'join-slip' as const };
      piece = plannedRounds(base, options, plan.layout, name);
      conventions = { ...conventions, roundEnd: 'join-slip' };
    } else piece = turnedRows(base, def, plan.layout, name);
    if (typeof piece === 'string') return fail(text('internal-error'));
    if ('code' in piece) return fail(piece);
    const stated = withStatedCounts({ ...base, conventions }, piece, plan.counts);
    if ('code' in stated) return fail(stated);
    result = { ...base, conventions, pieces: [withRowShape(stated, plan)] };
  }

  result = withGeneratedTitle(result, pattern, name, [...Object.values(SHAWL_NAMES), ...Object.values(SHAPE_NAMES), ...Object.values(MOTIF_NAMES)]);
  const errors = validatePattern(result, libraryFor(result)).filter((finding) => finding.severity === 'error');
  if (errors.length > 0) return fail(text('internal-error', { rule: errors[0]!.rule }));
  return { ok: true, pattern: result, plan };
}
