/*
 * Mintasűrűség (gauge) és öltésméret (PQW-859).
 *
 * Az öltés mérete két forrásból jön:
 * - a horgoló mért gauge-profiljából (`gauge-profile.ts`, docs/calibration/);
 * - mérés nélkül a tűméretből, becslésként, tartománnyal (02 §4.2, §8).
 *
 * A gauge-et abban a formában kell mérni, ahogy használjuk: sorokhoz sík
 * próbadarabon, körökhöz csövön vagy lapos körön (README §4.2). Ezért a
 * profilban öltésenként és formánként van mérés, és a becslés a sorhoz és a
 * körhöz más magasság/szélesség arányt használ.
 */

import type { GaugeProfile, StitchGauge, WorkedIn } from './gauge-profile.ts';
import type { Quantity, Range } from './quantity.ts';
import { divide, estimate, inverse, measured, multiply, roundCount } from './quantity.ts';
import type { StitchLibrary } from './stitch-library.ts';
import type { StitchDef } from './types.ts';

/* ---- Gauge mint szám: öltés és sor adott hosszon ---- */

/** Pl. „14 rp × 17 sor = 10 cm” (02 §3.1, §8). */
export interface Gauge {
  readonly stitches: number;
  readonly rows: number;
  readonly overCm: number;
}

/** Ennél nagyobb eltérés már méretet változtat: 20"-on 1" (02 §3.1). */
export const GAUGE_TOLERANCE = 0.05;

export function stitchWidthMm(gauge: Gauge): number {
  return (gauge.overCm * 10) / gauge.stitches;
}

export function rowHeightMm(gauge: Gauge): number {
  return (gauge.overCm * 10) / gauge.rows;
}

/** Öltésszám egy szélességhez, egészre kerekítve; a mintaismétlésre kerekítés máshol történik (02 §8). */
export function stitchesForWidth(widthCm: number, gauge: Gauge): number {
  return Math.round((widthCm * gauge.stitches) / gauge.overCm);
}

export function rowsForHeight(heightCm: number, gauge: Gauge): number {
  return Math.round((heightCm * gauge.rows) / gauge.overCm);
}

/** Szélesség cm-ben (02 §3.3: `width = sts ÷ sts_per_inch`). */
export function widthForStitches(stitches: number, gauge: Gauge): number {
  return (stitches * gauge.overCm) / gauge.stitches;
}

export function heightForRows(rows: number, gauge: Gauge): number {
  return (rows * gauge.overCm) / gauge.rows;
}

/** A sűrűség relatív eltérése a céltól; pozitív, ha sűrűbb (több öltés ugyanazon a hosszon). */
export function gaugeDeviation(actual: Gauge, target: Gauge): { readonly stitches: number; readonly rows: number } {
  const density = (count: number, overCm: number) => count / overCm;
  const relative = (a: number, b: number) => (a - b) / b;
  return {
    stitches: relative(density(actual.stitches, actual.overCm), density(target.stitches, target.overCm)),
    rows: relative(density(actual.rows, actual.overCm), density(target.rows, target.overCm)),
  };
}

/**
 * Egyezik-e az öltés-gauge a céllal a tűrésen belül (02 §8 `gaugeMatches`).
 * A sor-gauge-et nem nézi: azt a hurok emelésével igazítják, nem tűvel (02 §3.5).
 */
export function gaugeMatches(actual: Gauge, target: Gauge, tolerance = GAUGE_TOLERANCE): boolean {
  return Math.abs(gaugeDeviation(actual, target).stitches) <= tolerance;
}

/* ---- Öltésméret mennyiségként ---- */

/** Egységnyi méretből (mm) darab 10 cm-en: öltés/10 cm vagy sor/10 cm. */
export function per10cm(sizeMm: Quantity): Quantity {
  return inverse(100, sizeMm);
}

/** Hány egység fér egy hosszra (mm), egészre kerekítve, tartománnyal. */
export function countForLength(lengthMm: number, unitMm: Quantity): Quantity {
  return roundCount(inverse(lengthMm, unitMm));
}

/**
 * A rövidpálca szélessége a tű átmérőjéhez képest: 1,41 (1,2–1,7). A
 * CYC-táblázatból (öltés/4" ≈ 72 / tű mm) és címkeadatokból (02 §3.4, §4.2).
 */
export const SC_WIDTH_PER_HOOK_MM = estimate(1.41, [1.2, 1.7]);

/** Síkban a rövidpálcás sor magassága a szélességhez képest (02 §3.4, §4.2). */
export const SC_ASPECT_ROWS = estimate(0.8, [0.75, 0.95]);

/**
 * Körben ugyanez. A lapos körhöz kell 6–8 szaporítás, ami 1,0–1,2 hatásos
 * arányt jelent (README §4.2); az alsó határ a síkbeli. A cső mérése írja felül.
 */
export const SC_ASPECT_ROUNDS = estimate(1, [0.75, 1.2]);

/** Más öltés szélessége a rövidpálcáéhoz képest: nagyjából azonos (02 §4.2). */
export const WIDTH_RATIO = estimate(1, [0.9, 1.1]);

/**
 * A láncszem hossza a rövidpálca szélességéhez képest. A láncalap gyakran
 * szorosabb; forrás nélküli becslés, mérendő (02 §4.2, §9 6.).
 */
export const CHAIN_LENGTH_RATIO = estimate(1, [0.8, 1.1]);

/**
 * A valós magasságarány tartománya láncszem-magasság szerint. A könyvtár
 * `heightFactor` értéke a tartományon belül van (README §4.1, 02 §4.2, 01 §2.3).
 */
const HEIGHT_FACTOR_RANGES: Readonly<Partial<Record<number, Range>>> = {
  // Kúszószem: 1–2 mm a rövidpálca 6–8 mm-éhez (01 §2.3), illetve 0,3–0,5 (02 §4.2).
  0: [0.12, 0.5],
  // Rövidpálca: ez a mérték.
  1: [1, 1],
  2: [1.3, 1.7],
  3: [2, 2.6],
  4: [2.7, 3.9],
  5: [4, 4.9],
};

/** A láncszem magassága a sorban: forrás nélküli becslés, mérendő. */
const CHAIN_HEIGHT_RANGE: Range = [0.3, 1];

/**
 * Az öltés valós magassága a rövidpálcához képest, mennyiségként. Becsült
 * könyvtári értéknél tartománnyal; mért vagy címkéről vett értéket változatlanul ad.
 */
export function stitchHeightFactor(def: StitchDef): Quantity {
  const { value, source } = def.heightFactor;
  if (source !== 'estimated') return { value, source, range: null };
  const known = def.kind === 'chain' ? CHAIN_HEIGHT_RANGE : HEIGHT_FACTOR_RANGES[def.chainHeight];
  const [min, max] = known ?? [value * 0.8, value * 1.2];
  return estimate(value, [Math.min(min, value), Math.max(max, value)]);
}

/** Magasság átszámolása egyik öltésről a másikra, pl. rövidpálcás sorból pálcás sor (02 §4.2, §8). */
export function scaleRowHeight(heightMm: Quantity, fromFactor: Quantity, toFactor: Quantity): Quantity {
  return multiply(divide(heightMm, fromFactor), toFactor);
}

/* ---- Öltésméret a profilból vagy a tűből ---- */

export type LayerShape = 'row' | 'round';

/**
 * Honnan jön az öltés mérete, a legmegbízhatóbbtól:
 * - `measured`: ez az öltés ebben a formában mérve;
 * - `profile-stitch`: más öltés ugyanebben a formában mérve, aránnyal átszámolva;
 * - `profile-other-form`: rövidpálca a másik formában mérve (sík vagy kör);
 * - `hook`: nincs használható mérés, a tűméretből becsülve.
 */
export type DimensionBasis = 'measured' | 'profile-stitch' | 'profile-other-form' | 'hook';

export const DIMENSION_BASES: readonly DimensionBasis[] = ['measured', 'profile-stitch', 'profile-other-form', 'hook'];

export interface StitchDimensions {
  /** Sorban a szélesség, körben az öltés része a kerületből. */
  readonly widthMm: Quantity;
  /** Sorban a sor magassága, körben a sugár növekedése. */
  readonly heightMm: Quantity;
  readonly basis: DimensionBasis;
}

export interface GaugeContext {
  readonly library: StitchLibrary;
  /** A horgoló profilja; `null`, ha nincs, és ekkor minden méret becslés. */
  readonly profile: GaugeProfile | null;
  /** A tű, mm. Ha van profil, a profilé számít. */
  readonly hookMm: number;
}

const FORMS: Readonly<Record<LayerShape, readonly WorkedIn[]>> = {
  row: ['rows'],
  // A cső az elsődleges körös gauge, a lapos kör durvább (docs/calibration/README.md).
  round: ['rounds-tube', 'rounds-flat'],
};

const OTHER_FORMS: Readonly<Record<LayerShape, readonly WorkedIn[]>> = {
  row: FORMS.round,
  round: FORMS.row,
};

/** Az összehorgolt öltést a részöltése méri, pl. `sc2tog` → `sc`. */
function measurementKey(def: StitchDef): string {
  return def.kind === 'joined' ? def.part : def.id;
}

function measuredGauge(profile: GaugeProfile | null, key: string, forms: readonly WorkedIn[]): StitchGauge | null {
  const byForm = profile?.perStitch[key];
  if (!byForm) return null;
  for (const form of forms) {
    const gauge = byForm[form];
    if (gauge) return gauge;
  }
  return null;
}

/** A rövidpálca mérete ebben a formában: mérésből, átszámolva vagy a tűből. */
function singleCrochetBase(shape: LayerShape, context: GaugeContext): StitchDimensions {
  const { library, profile } = context;
  const sc = measuredGauge(profile, 'sc', FORMS[shape]);
  if (sc) return { widthMm: measured(sc.widthMm.mean), heightMm: measured(sc.heightMm.mean), basis: 'measured' };

  // Más alapöltés ugyanebben a formában: a magasságarányával visszaszámolva (02 §8 `estimateRowHeightCm`).
  for (const key of Object.keys(profile?.perStitch ?? {})) {
    const def = library.get(key);
    const gauge = def?.kind === 'basic' ? measuredGauge(profile, key, FORMS[shape]) : null;
    if (!def || !gauge) continue;
    return {
      widthMm: multiply(measured(gauge.widthMm.mean), WIDTH_RATIO),
      heightMm: divide(measured(gauge.heightMm.mean), stitchHeightFactor(def)),
      basis: 'profile-stitch',
    };
  }

  const aspect = shape === 'row' ? SC_ASPECT_ROWS : SC_ASPECT_ROUNDS;
  const other = measuredGauge(profile, 'sc', OTHER_FORMS[shape]);
  const widthMm = other
    ? multiply(measured(other.widthMm.mean), WIDTH_RATIO)
    : multiply(measured(profile?.hookMm ?? context.hookMm), SC_WIDTH_PER_HOOK_MM);
  return { widthMm, heightMm: multiply(widthMm, aspect), basis: other ? 'profile-other-form' : 'hook' };
}

/**
 * Egy öltés mérete sorban vagy körben. A pikónak, a láncívnek és a
 * varázskörnek nincs saját mérete: `null`.
 */
export function stitchDimensions(def: StitchDef, shape: LayerShape, context: GaugeContext): StitchDimensions | null {
  if (def.kind === 'picot' || def.kind === 'space' || def.kind === 'ring') return null;

  const own = measuredGauge(context.profile, measurementKey(def), FORMS[shape]);
  if (own) return { widthMm: measured(own.widthMm.mean), heightMm: measured(own.heightMm.mean), basis: 'measured' };

  const base = singleCrochetBase(shape, context);
  const chainLength = context.profile?.chainLengthMm;
  let widthMm: Quantity;
  if (def.kind === 'chain') {
    widthMm = chainLength ? measured(chainLength.mean) : multiply(base.widthMm, CHAIN_LENGTH_RATIO);
  } else {
    widthMm = measurementKey(def) === 'sc' ? base.widthMm : multiply(base.widthMm, WIDTH_RATIO);
  }
  return {
    widthMm,
    heightMm: multiply(base.heightMm, stitchHeightFactor(def)),
    basis: base.basis === 'measured' ? 'profile-stitch' : base.basis,
  };
}
