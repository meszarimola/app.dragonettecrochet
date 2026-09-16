/*
 * Ruhadarabok (PQW-866, első rész): sapka és ledobott vállú pulóver
 * testméretből, méretenkénti szabásrajzzal, sortervvel és méretsorozattal. A
 * kész gráfot ugyanaz az ellenőrző, rajz és írott minta dolgozza fel, mint a
 * kézzel horgoltat.
 *
 * - Szabásrajzból sorok (05 §4.1, §4.2, §9.5): minden vízszintes méret szem,
 *   a mintaismétlésre kerekítve a bőség irányába (bő darabnál felfelé); minden
 *   függőleges szakasz páros sorszám; a lejtő a „mágikus képlettel”, egyenes
 *   véggel oszlik el (05 §4.4, garment-math.ts).
 * - Ledobott váll (05 §2.1, §9.5, „B” példa): a hátrész és az elejerész
 *   téglalap, a szélessége a kész körméret fele. Az ujj felső éle a karöltő
 *   mélységének kétszerese, a hossza a hátközép–kézfej hossz mínusz a darab
 *   szélességének fele; mandzsettától felfelé szaporítva. A nyak most
 *   csónaknyak: a vállvarrás a két szélről a vállak szemét varrja, a középső
 *   szemek nyitva maradnak. A formázott nyak fogyasztásait a terv kiszámolja
 *   (05 „B” 5. lépés), de a gráf még nem tudja a két vállat egy darabon belül
 *   külön horgolni: ez nyitott.
 * - A pulóver négy darab (hátrész, elejerész, bal és jobb ujj); a jobb ujj a
 *   bal tükörképe (05 §4.5). A varrások a darabok közti kapcsolások: a váll a
 *   felső sor szakaszai, az oldal és az ujj alja a sorvégek (PQW-889), az ujj
 *   felső éle a karöltő sorvégeibe egyenletes elosztással.
 * - Méretsorozat (05 §3.8, §9.6): a táblázat minden méretére újraszámolunk; a
 *   testméret a CYC tartomány közepe. Méretenként és fázisonként igaz/hamis
 *   ellenőrzés, a méretek között a szemszámok nem csökkenhetnek.
 * - Sapka (05 §5, §9.7, „D” példa): a kész körméret a fej és a (negatív)
 *   bőség összege; a korona lapos kör, a körönkénti szaporítás `2π·h/w`
 *   körüli egész, a jelöltek közül az, amelyiknél a korona köreinek száma a
 *   legközelebb áll a sugárhoz; az utolsó koronakör igazítja a szemszámot.
 *   Utána egyenes oldal, az utolsó köreiben a perem.
 * - A negatív bőség horgolásnál legfeljebb kb. 10% (05 §3.5, §7.2): efölött
 *   figyelmeztetés, 15% fölött a generátor megtagadja.
 *
 * A fordulólánc és a láncalap a minta hagyománya szerint áll (tradition.ts,
 * repeat.ts): N szemhez `N + T` láncszem.
 */

import { evenDistribution } from './amigurumi.ts';
import {
  BODY_TABLES,
  GARMENT_EASE,
  HAT_SIZES,
  NEGATIVE_EASE_LIMIT,
  NEGATIVE_EASE_MAX,
  hatEase,
  inchToCm,
  mid,
  tableFlags,
  type BodySizeCode,
  type BodyTable,
  type BodyTableId,
  type DataFlag,
} from './body-sizes.ts';
import { stitchDimensions } from './gauge.ts';
import {
  evenIncreases,
  intentOf,
  mirrorShaping,
  reversedEventRows,
  roundEven,
  roundStitches,
  roundToRepeat,
  shapingRuns,
  slopeSchedule,
  type ShapingRun,
  type SlopeSchedule,
} from './garment-math.ts';
import { text, type CoreText } from './messages.ts';
import { activeProfile, ballLengthM, gaugeContextOf, swatchMassPerArea, type YarnMissing } from './pattern-size.ts';
import { raglanPiece, raglanPlan, type RaglanMeasures, type RaglanPlan } from './raglan.ts';
import { withGeneratedTitle } from './pattern-title.ts';
import { measured, weakestSource } from './quantity.ts';
import { foundationChainLength } from './repeat.ts';
import { DEFAULT_MOTIF, circlePlan, plannedRounds, type RoundPlan } from './round-generator.ts';
import { SHAPE_STITCHES, plannedRows, plannedSections, shapeGauge, type RowSection, type RowShaping, type ShapeGauge, type ShapeRepeat } from './shapes.ts';
import { libraryFor, resolveStitch } from './stitch-variants.ts';
import { traditionOf, turningChainCountsFor } from './tradition.ts';
import type { GarmentKind, GarmentTable, Pattern, PatternGarment, PieceJoin, StitchDefId, Tradition } from './types.ts';
import { validatePattern } from './validate.ts';
import { yarnFromMassPerArea } from './yarn-estimate.ts';

export const GARMENT_KINDS: readonly GarmentKind[] = ['hat', 'drop-shoulder', 'raglan'];

export const GARMENT_NAMES: Readonly<Record<GarmentKind, string>> = {
  hat: 'Sapka',
  'drop-shoulder': 'Ledobott vállú pulóver',
  raglan: 'Felülről horgolt raglán',
};

export const PIECE_NAMES = { back: 'Hátrész', front: 'Elejerész', leftSleeve: 'Bal ujj', rightSleeve: 'Jobb ujj' } as const;

export const GARMENT_STITCHES: readonly StitchDefId[] = SHAPE_STITCHES;
export const MAX_GARMENT_CM = 200;
/** Egy sorban legfeljebb ennyi szem (shapes.ts `MAX_SHAPE_STITCHES`). */
export const MAX_GARMENT_STITCHES = 500;
export const MAX_GARMENT_ROWS = 400;
/** A létrehozott mintában legfeljebb ennyi szem: nagyobb gráfot a szerkesztő már lassan rajzol. */
export const MAX_GARMENT_TOTAL = 60000;
export const MAX_REPEAT = 50;
/** A ledobott váll karöltője a CYC karöltőmélységnél ennyiszer mélyebb („B” példa: 17,5–19 cm helyett 21 cm). */
export const DROP_ARMHOLE_FACTOR = 1.14;
/** A nyak szélessége a keresztháti szélességből („B” példa: 18,5 cm a kb. 40 cm-hez). */
export const NECK_RATIO = 0.46;
/** A mandzsetta a felkarbőségből („B” példa: 26 cm a 28 cm-hez), és felkarbőség nélkül a mellbőségből. */
export const CUFF_RATIO = 0.93;
export const CUFF_CHEST_RATIO = 0.28;
/** Az ujj felső éle és a két karöltő ennyivel térhet el: ennyi még bedolgozható (05 §4.6, a horgolásnál az alsó érték). */
export const SEAM_EASING_CM = 4;
/** Ledobott vállnál a szokásos bőség, cm (05 §2.1). */
export const DROP_SHOULDER_EASE: readonly [number, number] = [15, 30];
/** A raglán mélysége a karöltőmélységnél ennyivel több (05 §4 „C” példa: 17,5–19 cm helyett 20 cm). */
export const RAGLAN_YOKE_ALLOWANCE_CM = 1.5;

export interface GarmentOptions {
  readonly kind: GarmentKind;
  /** Pulóvernél a testméret-táblázat; sapkánál nem számít. */
  readonly table: BodyTableId;
  /** A gráf mérete. */
  readonly size: string;
  /** A méretsorozat első és utolsó mérete a táblázat sorrendjében; a `size` köztük van. */
  readonly from: string;
  readonly to: string;
  readonly stitch: StitchDefId;
  /** Bőség, cm: pulóvernél a mellbőséghez, sapkánál a fejkörfogathoz; `null`: sapkánál a fejmérettől függő −2,5 vagy −5 cm. */
  readonly easeCm: number | null;
  /** Pulóvernél az alsó szegély és a mandzsetta, sapkánál a perem magassága, cm. */
  readonly hemCm: number;
  /** Pulóvernél a hossz a derék alatt (férfiaknál a csípőig mért háthosszhoz), cm. */
  readonly belowWaistCm: number;
  /** Pulóvernél a hátrész és az elejerész szemszáma „X többszöröse + Y”. */
  readonly repeat: ShapeRepeat | null;
  /**
   * Pulóvernél a nyakkivágás (PQW-901): `boat` csónaknyak, a vállvarrás hagyja
   * nyitva a nyakat; `shaped` formázott, a két váll a nyak két oldalán külön
   * készül, a fonal elvágása után.
   */
  readonly neckline: 'boat' | 'shaped';
  /**
   * Növedék: a mosott, blokkolt, felakasztott próbadarab hosszában ennyi
   * százalékkal nő (05 §7.1, §7.2, §9.8). A hosszakat ezzel osztjuk, hogy a
   * kész darab a tervezett méretű maradjon; 0: nincs korrekció.
   */
  readonly growthPct: number;
}

/** A táblázatonkénti hossz a derék alatt, cm: nőknél a „B” példa 58 cm-es hossza az M mérethez. */
export const BELOW_WAIST_CM: Readonly<Record<BodyTableId, number>> = { women: 14.5, men: 0, child: 8, baby: 4 };

export const DEFAULT_GARMENT: GarmentOptions = {
  kind: 'drop-shoulder',
  table: 'women',
  size: 'M',
  from: 'S',
  to: 'L',
  stitch: 'dc',
  easeCm: 10,
  hemCm: 5,
  belowWaistCm: BELOW_WAIST_CM.women,
  repeat: null,
  neckline: 'shaped',
  growthPct: 0,
};

export const DEFAULT_HAT: GarmentOptions = {
  ...DEFAULT_GARMENT,
  kind: 'hat',
  size: 'adult-m',
  from: 'adult-s',
  to: 'adult-l',
  stitch: 'hdc',
  easeCm: null,
  hemCm: 3,
};

/**
 * A ruhadarabok üzeneteinek kódjai (PQW-904): elutasítás, ellenőrzés és a
 * hozzá tartozó javaslat, figyelmeztetés, becsült méret és a méretsorozat
 * monotonitása. A mag csak kódot és nyers adatot ad; a mondatot a felület
 * állítja össze (`src/ui/i18n/core/garment.ts`). A szűk unió őrzi, hogy a
 * szótárból ne maradhasson ki kód. A testméret-táblázat gyanúi ugyanebbe a
 * szótárba tartoznak, ezért a `BodySizeCode` is része az uniónak.
 */
export type GarmentCode =
  // Választás és tartomány (`garmentProblem`).
  | 'stitch-choice'
  | 'pick-size'
  | 'series-range'
  | 'ease-range'
  | 'ease-required'
  | 'hem-range'
  | 'growth-range'
  | 'below-waist-range'
  | 'repeat-width'
  | 'repeat-edge'
  // A táblázat mérete és a méretenkénti elutasítás.
  | 'unknown-size'
  | 'missing-measure'
  | 'size-problem'
  // Sapka.
  | 'head-range'
  | 'negative-ease-head'
  | 'hat-height'
  | 'hat-crown'
  | 'hat-side'
  | 'max-rounds'
  // Ledobott vállú pulóver.
  | 'negative-ease-bust'
  | 'panel-narrow'
  | 'max-stitches'
  | 'body-length-hem'
  | 'max-rows'
  | 'armhole-fit'
  | 'neck-fit'
  | 'sleeve-short'
  | 'sleeve-increases'
  | 'max-total-sweater'
  | 'max-total-raglan'
  // Felülről horgolt raglán.
  | 'underarm-long'
  | 'sleeve-narrow'
  | 'yoke-min'
  | 'yoke-sleeve-many'
  | 'yoke-sleeve-few'
  | 'neck-small'
  | 'body-short-gauge'
  | 'yoke-body-many'
  | 'body-short'
  | 'body-length-yoke'
  // Program- és gráfhiba.
  | 'internal-error'
  | 'piece-error'
  // Figyelmeztetések.
  | 'negative-ease-warning'
  | 'cuff-wide'
  | 'upper-arm-ease'
  | 'raglan-extra-rounds'
  // A táblázatból hiányzó, becsült méretek.
  | 'estimated-armhole-depth'
  | 'estimated-cuff'
  | 'estimated-upper-arm'
  // Ellenőrzések és javaslatok: sapka.
  | 'check-crown-target'
  | 'check-crown-doubling'
  | 'check-side-count'
  | 'check-brim'
  | 'check-height'
  | 'check-negative-ease'
  // Ellenőrzések és javaslatok: pulóver.
  | 'check-panel-repeat'
  | 'check-even-rows'
  | 'suggest-even-rows'
  | 'check-shoulders'
  | 'check-neck-shaping'
  | 'suggest-neck-shaping'
  | 'check-sleeve-width'
  | 'check-sleeve-rows'
  | 'suggest-sleeve-rows'
  | 'check-armhole-seam'
  | 'suggest-armhole-seam'
  | 'check-side-seam'
  | 'suggest-side-seam'
  | 'suggest-negative-ease-bust'
  // Ellenőrzések és javaslatok: raglán.
  | 'check-raglan-sections'
  | 'suggest-raglan-sections'
  | 'check-raglan-growth'
  | 'suggest-raglan-growth'
  | 'check-raglan-underarm'
  | 'check-raglan-neck'
  | 'check-even-rounds'
  | 'suggest-negative-ease-raglan'
  // A méretsorozat monotonitása.
  | 'monotonic-hat-stitches'
  | 'monotonic-rounds'
  | 'monotonic-raglan-body'
  | 'monotonic-raglan-sleeve'
  | 'monotonic-neck'
  | 'monotonic-panel'
  | 'monotonic-cuff'
  | 'monotonic-sleeve-top'
  | BodySizeCode;

/** Üzenet-e a visszatérés: a terv és a darab helyett kód és adat. */
export function isGarmentText(value: object): value is CoreText<GarmentCode> {
  return 'code' in value;
}

/**
 * A sor- és a körgenerátor hibája a ruhadarab üzenetébe (`piece-error`): a
 * kódját és az adatait a szótár a saját területének szövegével írja ki. A
 * körgenerátor még kész mondattal utasít el; az addig `message`-ként utazik.
 */
function pieceProblem(problem: string | CoreText): CoreText<GarmentCode> {
  return typeof problem === 'string' ? text('piece-error', { message: problem }) : text('piece-error', { inner: problem.code, ...(problem.data ?? {}) });
}

/** A választható méretek azonosítója a táblázat sorrendjében; a nevet a felület adja. */
export function garmentSizes(kind: GarmentKind, table: BodyTableId): string[] {
  if (kind === 'hat') return HAT_SIZES.map((size) => size.id);
  return BODY_TABLES[table].sizes.map((size) => size.id);
}

/** Egy igaz/hamis ellenőrzés (05 §3.8 7. pont, §8.3 utolsó pont). */
export interface GarmentCheck {
  readonly id: string;
  readonly label: CoreText<GarmentCode>;
  readonly ok: boolean;
  /** Mit érdemes állítani, ha hamis (05 §9.6: a fázisok hosszát igazítjuk, nem a teljes hosszt). */
  readonly suggestion?: CoreText<GarmentCode>;
}

const pct = (ratio: number) => Math.round(ratio * 100);
const sum = (values: readonly number[]) => values.reduce((total, n) => total + n, 0);

/* ---- Sapka ---- */

export interface HatMeasures {
  readonly headCm: number;
  readonly easeCm: number;
  readonly heightCm: number;
  readonly brimCm: number;
}

export interface HatPlan {
  readonly kind: 'hat';
  readonly measures: HatMeasures;
  /** A kész körméret terve: fej + bőség, cm. */
  readonly hatCm: number;
  /** A körönkénti szaporítás elméletileg (`2π·h/w`) és választva. */
  readonly exactIncreases: number;
  readonly increases: number;
  /** A korona utolsó köre és az oldal szemszáma. */
  readonly stitches: number;
  /** Körönként a szemszám; a 0. elem az 1. kör. */
  readonly counts: readonly number[];
  readonly layout: RoundPlan;
  /** A korona körei, az igazító körrel együtt. */
  readonly crownRounds: number;
  readonly sideRounds: number;
  readonly brimRounds: number;
  readonly finishedCm: number;
  readonly finishedHeightCm: number;
  readonly checks: readonly GarmentCheck[];
  readonly warnings: readonly CoreText<GarmentCode>[];
}

/** A sapka terve a fejből, a bőségből és a szemméretből (05 §9.7); hibánál az ok kódja. */
export function hatPlan(measures: HatMeasures, gauge: { readonly stitchCm: number; readonly rowCm: number }): HatPlan | CoreText<GarmentCode> {
  const { headCm, easeCm, heightCm, brimCm } = measures;
  if (!(headCm > 0 && headCm <= MAX_GARMENT_CM)) return text('head-range', { max: MAX_GARMENT_CM });
  const ratio = -easeCm / headCm;
  if (ratio > NEGATIVE_EASE_MAX) {
    return text('negative-ease-head', { limit: pct(NEGATIVE_EASE_MAX), actual: pct(ratio) });
  }
  const hatCm = headCm + easeCm;
  const stitches = roundStitches(hatCm / gauge.stitchCm, intentOf(easeCm));
  const radius = hatCm / (2 * Math.PI);
  if (heightCm <= radius) return text('hat-height', { radius: Math.ceil(radius) });

  const exact = (2 * Math.PI * gauge.rowCm) / gauge.stitchCm;
  const ideal = radius / gauge.rowCm;
  let best: { I: number; full: number; delta: number; crown: number; score: readonly [number, number] } | null = null;
  const nearest = Math.round(exact);
  for (const I of [nearest - 1, nearest, nearest + 1]) {
    if (I < 3 || I > stitches) continue;
    const full = Math.floor(stitches / I);
    const delta = stitches - I * full;
    const crown = full + (delta > 0 ? 1 : 0);
    const score = [Math.abs(crown - ideal), Math.abs(I - exact)] as const;
    const better = !best || score[0] < best.score[0] - 1e-9 || (Math.abs(score[0] - best.score[0]) <= 1e-9 && score[1] < best.score[1]);
    if (better) best = { I, full, delta, crown, score };
  }
  if (!best) return text('hat-crown');

  const sideRounds = Math.round((heightCm - radius) / gauge.rowCm);
  if (sideRounds < 1) return text('hat-side');
  const brimRounds = Math.round(Math.max(0, brimCm) / gauge.rowCm);
  const circle = circlePlan(best.I, best.full, true);
  const correction = best.delta > 0 ? evenIncreases(best.I * best.full, best.delta) : null;
  const layout: RoundPlan = {
    first: best.I,
    rounds: [...circle.rounds, ...(correction ? [correction] : []), ...Array.from({ length: sideRounds }, () => Array<number>(stitches).fill(1))],
  };
  const counts = [best.I];
  for (const into of layout.rounds) counts.push(sum(into));
  if (counts.length > MAX_GARMENT_ROWS) return text('max-rounds', { max: MAX_GARMENT_ROWS });

  const totalRounds = counts.length;
  const finishedHeightCm = totalRounds * gauge.rowCm;
  const checks: GarmentCheck[] = [
    { id: 'crown-target', label: text('check-crown-target'), ok: counts[best.crown - 1] === stitches },
    { id: 'crown-doubling', label: text('check-crown-doubling'), ok: correction === null || best.delta <= best.I * best.full },
    { id: 'side-count', label: text('check-side-count'), ok: counts.slice(best.crown).every((count) => count === stitches) },
    { id: 'brim', label: text('check-brim'), ok: brimRounds <= sideRounds },
    { id: 'height', label: text('check-height'), ok: Math.abs(finishedHeightCm - heightCm) <= 1.5 * gauge.rowCm },
    { id: 'negative-ease', label: text('check-negative-ease', { limit: pct(NEGATIVE_EASE_LIMIT) }), ok: ratio <= NEGATIVE_EASE_LIMIT + 1e-9 },
  ];
  const warnings: CoreText<GarmentCode>[] = [];
  if (ratio > NEGATIVE_EASE_LIMIT + 1e-9) {
    warnings.push(text('negative-ease-warning', { actual: pct(ratio), limit: pct(NEGATIVE_EASE_LIMIT) }));
  }
  return {
    kind: 'hat',
    measures,
    hatCm,
    exactIncreases: exact,
    increases: best.I,
    stitches,
    counts,
    layout,
    crownRounds: best.crown,
    sideRounds,
    brimRounds,
    finishedCm: stitches * gauge.stitchCm,
    finishedHeightCm,
    checks,
    warnings,
  };
}

/** A növedékkel csökkentett hossz (05 §7.2, §9.8): a felakasztott próbadarab nyúlása. */
export function withoutGrowth(lengthCm: number, growthPct: number): number {
  return Number.isFinite(growthPct) && growthPct > 0 ? lengthCm / (1 + growthPct / 100) : lengthCm;
}

/** A sapka méretei a sapkatáblázatból (05 §5.2): a magasság a fül közepéig mért hossz, a növedékkel csökkentve. */
export function hatMeasures(sizeId: string, easeCm: number | null, brimCm: number, growthPct = 0): HatMeasures | null {
  const size = HAT_SIZES.find((candidate) => candidate.id === sizeId);
  if (!size) return null;
  const headCm = inchToCm(size.headIn);
  return { headCm, easeCm: easeCm ?? hatEase(headCm), heightCm: withoutGrowth(inchToCm(size.midEarIn), growthPct), brimCm };
}

/* ---- Ledobott vállú pulóver ---- */

export interface DropShoulderMeasures {
  readonly bustCm: number;
  readonly easeCm: number;
  readonly neckToWristCm: number;
  readonly upperArmCm: number | null;
  /** A ledobott váll karöltőjének mélysége (a CYC értéknél mélyebb). */
  readonly armholeDepthCm: number;
  /** A teljes hossz a vállvarrástól, a szegéllyel. */
  readonly bodyLengthCm: number;
  /** Az alsó szegély és a mandzsetta magassága. */
  readonly hemCm: number;
  readonly neckWidthCm: number;
  readonly frontNeckDepthCm: number;
  readonly backNeckDepthCm: number;
  readonly cuffWidthCm: number;
  readonly crossBackCm: number | null;
}

/** A sor első szemének adatai a láncalaphoz: fordulólánc, számít-e, hagyomány. */
export interface RowStart {
  readonly turningChain: number;
  readonly counting: boolean;
  readonly tradition: Tradition;
}

export interface DropShoulderPlan {
  readonly kind: 'drop-shoulder';
  readonly measures: DropShoulderMeasures;
  readonly panel: {
    /** A szem pontos értéke a kerekítés előtt. */
    readonly exact: number;
    readonly stitches: number;
    readonly repeats: number | null;
    readonly foundation: number;
    readonly hemRows: number;
    readonly bodyRows: number;
    readonly rows: number;
    readonly armholeRows: number;
    /** Az oldalvarrás sorai: a karöltő alatt. */
    readonly sideRows: number;
  };
  readonly neck: {
    readonly stitches: number;
    readonly shoulder: number;
    /** A formázott nyak (05 „B” 5. lépés): középen meghagyott szemek, oldalanként az első sor és a további sorok fogyasztása. */
    readonly front: { readonly center: number; readonly perSide: number; readonly first: number; readonly later: number; readonly rows: number };
    readonly back: { readonly center: number; readonly rows: number; readonly perRow: number };
  };
  readonly sleeve: {
    readonly top: number;
    readonly cuff: number;
    readonly foundation: number;
    readonly cuffRows: number;
    readonly shapedRows: number;
    readonly rows: number;
    /** Szaporítások párban (mindkét szélen 1-1). */
    readonly increases: number;
    /** A lejtő fentről lefelé, a „B” példa leírása szerint. */
    readonly schedule: SlopeSchedule;
    /** A szaporító sorok a mandzsettától, 1-től, a mandzsetta soraival együtt számolva. */
    readonly increaseRows: readonly number[];
    readonly first: number | null;
    readonly runs: readonly ShapingRun[];
    readonly lengthCm: number;
  };
  readonly finished: {
    readonly chestCm: number;
    readonly easeCm: number;
    readonly lengthCm: number;
    readonly sleeveCm: number;
    readonly upperArmEaseCm: number | null;
    /** A vállvarrás ennyivel lóg le a vállról a karra (05 „B” 6. lépés). */
    readonly shoulderDropCm: number | null;
  };
  readonly checks: readonly GarmentCheck[];
  readonly warnings: readonly CoreText<GarmentCode>[];
}

/** A páros különbségű legközelebbi egész: a két váll így egyforma. */
function nearestWithParity(exact: number, parityOf: number): number {
  const low = Math.floor(exact);
  const candidates = [low - 1, low, low + 1, low + 2].filter((n) => (parityOf - n) % 2 === 0);
  return candidates.reduce((best, n) => (Math.abs(n - exact) < Math.abs(best - exact) ? n : best));
}

/**
 * A ledobott vállú pulóver terve egy méretre (05 §9.5, „B” példa); hibánál az
 * ok kódja. A `minNeck` az előző méret nyaka: a sorozatban a nyak nem lehet
 * kisebb (05 §9.6), ezért ha a párosság miatt kisebb lenne, a legközelebbi
 * nagyobb jó párosságú szám lesz.
 */
export function dropShoulderPlan(
  m: DropShoulderMeasures,
  gauge: { readonly stitchCm: number; readonly rowCm: number },
  start: RowStart,
  repeat: ShapeRepeat | null,
  minNeck = 0,
): DropShoulderPlan | CoreText<GarmentCode> {
  const { stitchCm, rowCm } = gauge;
  const ratio = -m.easeCm / m.bustCm;
  if (ratio > NEGATIVE_EASE_MAX) {
    return text('negative-ease-bust', { limit: pct(NEGATIVE_EASE_MAX), actual: pct(ratio) });
  }
  const intent = intentOf(m.easeCm);
  const halfCm = (m.bustCm + m.easeCm) / 2;
  const exact = halfCm / stitchCm;
  const stitches = repeat ? roundToRepeat(exact, repeat, intent) : roundStitches(exact, intent);
  if (stitches < 8) return text('panel-narrow');
  if (stitches > MAX_GARMENT_STITCHES) return text('max-stitches', { max: MAX_GARMENT_STITCHES });
  const foundation = foundationChainLength(stitches, start.turningChain, start.counting, start.tradition);

  const hemRows = roundEven(Math.max(0, m.hemCm) / rowCm);
  const bodyRows = roundEven((m.bodyLengthCm - Math.max(0, m.hemCm)) / rowCm);
  if (bodyRows < 2) return text('body-length-hem');
  const rows = hemRows + bodyRows;
  if (rows > MAX_GARMENT_ROWS) return text('max-rows', { max: MAX_GARMENT_ROWS });
  const armholeRows = roundEven(m.armholeDepthCm / rowCm);
  if (armholeRows < 2 || armholeRows >= rows) return text('armhole-fit');
  const sideRows = rows - armholeRows;

  // Nyak: a vállak egyformák, ezért a nyak szemszámának párossága a sorét követi.
  let neck = nearestWithParity(m.neckWidthCm / stitchCm, stitches);
  if (neck < minNeck) neck = minNeck + ((stitches - minNeck) % 2);
  if (neck < 2 || neck > stitches - 4) return text('neck-fit');
  const shoulder = (stitches - neck) / 2;
  const center = nearestWithParity(neck / 2, neck);
  const perSide = (neck - center) / 2;
  const frontRows = roundEven(m.frontNeckDepthCm / rowCm);
  const later = Math.min(Math.max(0, perSide - 1), Math.max(0, frontRows - 1));
  const first = perSide - later;
  const backRows = Math.min(roundEven(m.backNeckDepthCm / rowCm), Math.floor(neck / 2));
  const backPerRow = backRows > 0 ? 1 : 0;
  const backCenter = neck - 2 * backRows * backPerRow;

  // Ujj: a felső él a karöltő kétszerese, a mandzsetta és a felső él páros, hogy a szaporítás párban jöjjön (05 „B” 7–9.).
  const top = roundEven((2 * m.armholeDepthCm) / stitchCm, 'up');
  const warnings: CoreText<GarmentCode>[] = [];
  let cuff = roundEven(m.cuffWidthCm / stitchCm, 'up');
  if (cuff > top) {
    cuff = top;
    warnings.push(text('cuff-wide'));
  }
  const lengthCm = m.neckToWristCm - halfCm / 2;
  const cuffRows = hemRows;
  const shapedRows = roundEven((lengthCm - Math.max(0, m.hemCm)) / rowCm);
  if (shapedRows < 2) return text('sleeve-short');
  const increases = (top - cuff) / 2;
  let schedule = slopeSchedule(shapedRows, increases, true);
  let reversed = schedule ? reversedEventRows(schedule, shapedRows) : null;
  if (!reversed) {
    // Ha az első szakasz egyetlen sor lenne, a szaporítás a 2. sortól oszlik el: így is legfeljebb soronként 1-1 (05 §4.4).
    const shifted = slopeSchedule(shapedRows - 1, increases, true);
    if (shifted) {
      schedule = { ...shifted, intervals: [shifted.intervals[0]! + 1, ...shifted.intervals.slice(1)] };
      reversed = reversedEventRows(schedule, shapedRows);
    }
  }
  if (!schedule || !reversed) return text('sleeve-increases');
  const increaseRows = reversed.map((row) => row + cuffRows);
  const { first: firstIncrease, runs } = shapingRuns(increaseRows);
  const sleeveRows = cuffRows + shapedRows;
  if (sleeveRows > MAX_GARMENT_ROWS) return text('max-rows', { max: MAX_GARMENT_ROWS });
  const sleeveFoundation = foundationChainLength(cuff, start.turningChain, start.counting, start.tradition);

  const chestCm = 2 * stitches * stitchCm;
  const upperArmEaseCm = m.upperArmCm === null ? null : top * stitchCm - m.upperArmCm;
  const even = (n: number) => n % 2 === 0;
  const checks: GarmentCheck[] = [
    ...(repeat
      ? [
          {
            id: 'panel-repeat',
            label: text('check-panel-repeat', { width: repeat.width, edge: repeat.edge }),
            ok: stitches >= repeat.width + repeat.edge && (stitches - repeat.edge) % repeat.width === 0,
          },
        ]
      : []),
    {
      id: 'even-rows',
      label: text('check-even-rows'),
      ok: [hemRows, bodyRows, armholeRows, cuffRows, shapedRows].every(even),
      suggestion: text('suggest-even-rows'),
    },
    { id: 'shoulders', label: text('check-shoulders'), ok: 2 * shoulder + neck === stitches },
    {
      id: 'neck-shaping',
      label: text('check-neck-shaping'),
      ok: center + 2 * (first + later) === neck && backCenter + 2 * backRows * backPerRow === neck && frontRows < rows,
      suggestion: text('suggest-neck-shaping'),
    },
    { id: 'sleeve-width', label: text('check-sleeve-width'), ok: cuff + 2 * increases === top },
    {
      id: 'sleeve-rows',
      label: text('check-sleeve-rows'),
      ok: sum(schedule.intervals) + schedule.tail === shapedRows && increaseRows.length === increases && (increaseRows.at(-1) ?? 0) <= sleeveRows,
      suggestion: text('suggest-sleeve-rows'),
    },
    {
      id: 'armhole-seam',
      label: text('check-armhole-seam', { limit: SEAM_EASING_CM }),
      ok: Math.abs(top * stitchCm - 2 * armholeRows * rowCm) <= SEAM_EASING_CM,
      suggestion: text('suggest-armhole-seam', { off: Math.round(Math.abs(top * stitchCm - 2 * armholeRows * rowCm)) }),
    },
    {
      id: 'side-seam',
      label: text('check-side-seam'),
      ok: sideRows >= 1,
      suggestion: text('suggest-side-seam'),
    },
    {
      id: 'negative-ease',
      label: text('check-negative-ease', { limit: pct(NEGATIVE_EASE_LIMIT) }),
      ok: ratio <= NEGATIVE_EASE_LIMIT + 1e-9,
      suggestion: text('suggest-negative-ease-bust', { cm: Math.floor(NEGATIVE_EASE_LIMIT * m.bustCm) }),
    },
  ];
  if (ratio > NEGATIVE_EASE_LIMIT + 1e-9) {
    warnings.push(text('negative-ease-warning', { actual: pct(ratio), limit: pct(NEGATIVE_EASE_LIMIT) }));
  }
  if (upperArmEaseCm !== null && upperArmEaseCm < 5) {
    warnings.push(text('upper-arm-ease', { ease: Math.round(upperArmEaseCm) }));
  }

  return {
    kind: 'drop-shoulder',
    measures: m,
    panel: { exact, stitches, repeats: repeat ? (stitches - repeat.edge) / repeat.width : null, foundation, hemRows, bodyRows, rows, armholeRows, sideRows },
    neck: {
      stitches: neck,
      shoulder,
      front: { center, perSide, first, later, rows: frontRows },
      back: { center: backCenter, rows: backRows, perRow: backPerRow },
    },
    sleeve: {
      top,
      cuff,
      foundation: sleeveFoundation,
      cuffRows,
      shapedRows,
      rows: sleeveRows,
      increases,
      schedule,
      increaseRows,
      first: firstIncrease,
      runs,
      lengthCm,
    },
    finished: {
      chestCm,
      easeCm: chestCm - m.bustCm,
      lengthCm: rows * rowCm,
      sleeveCm: sleeveRows * rowCm,
      upperArmEaseCm,
      shoulderDropCm: m.crossBackCm === null ? null : (stitches * stitchCm - m.crossBackCm) / 2,
    },
    checks,
    warnings,
  };
}

export interface GradedMeasures {
  readonly measures: DropShoulderMeasures;
  /** A táblázatban hiányzó, becsült méretek kódja; a nevet a felület adja. */
  readonly estimated: readonly CoreText<GarmentCode>[];
}

/**
 * A pulóver méretei a táblázat egy méretéből (05 §3.8, §9.6): a tartomány
 * közepe, a ledobott váll karöltője a CYC értéknél mélyebb, a nyak a
 * keresztháti szélességből, a mandzsetta a felkarból, a hossz a derékig mért
 * háthossz és a derék alatti hossz összege. A hiányzó méreteket becsüljük.
 */
export function dropShoulderMeasures(
  table: BodyTable,
  sizeId: string,
  options: Pick<GarmentOptions, 'easeCm' | 'hemCm' | 'belowWaistCm'> & { readonly growthPct?: number },
): GradedMeasures | CoreText<GarmentCode> {
  const size = table.sizes.find((candidate) => candidate.id === sizeId);
  if (!size) return text('unknown-size', { size: sizeId });
  const v = size.values;
  const length = v.backWaist ?? v.backHip;
  if (!v.chest || !v.neckToWrist || !length || !v.crossBack) return text('missing-measure', { size: sizeId });
  const estimated: CoreText<GarmentCode>[] = [];
  const bustCm = mid(v.chest);
  let armholeDepthCm: number;
  if (v.armholeDepth) armholeDepthCm = mid(v.armholeDepth) * DROP_ARMHOLE_FACTOR;
  else {
    estimated.push(text('estimated-armhole-depth'));
    armholeDepthCm = bustCm / 6 + 5;
  }
  const upperArmCm = v.upperArm ? mid(v.upperArm) : null;
  if (upperArmCm === null) estimated.push(text('estimated-cuff'));
  const crossBackCm = mid(v.crossBack);
  const frontNeckDepthCm = 0.2 * armholeDepthCm + 4;
  return {
    measures: {
      bustCm,
      easeCm: options.easeCm ?? 0,
      neckToWristCm: mid(v.neckToWrist),
      upperArmCm,
      armholeDepthCm,
      // A hosszt a növedék csökkenti: a mosott, blokkolt, felakasztott próbadarab nyúlása (05 §7.2).
      bodyLengthCm: withoutGrowth(mid(length) + options.belowWaistCm, options.growthPct ?? 0),
      hemCm: options.hemCm,
      neckWidthCm: NECK_RATIO * crossBackCm,
      frontNeckDepthCm,
      backNeckDepthCm: frontNeckDepthCm / 4,
      cuffWidthCm: upperArmCm === null ? CUFF_CHEST_RATIO * bustCm : CUFF_RATIO * upperArmCm,
      crossBackCm,
    },
    estimated,
  };
}

/* ---- Méretsorozat ---- */

/** Egy méret terve: sapka, ledobott vállú pulóver vagy raglán. */
export type GarmentSizePlan = HatPlan | DropShoulderPlan | RaglanPlan;

export interface SizePlan {
  readonly id: string;
  readonly plan: GarmentSizePlan;
  /** A táblázat gyanús értékei ennél a méretnél (body-sizes.ts). */
  readonly flags: readonly DataFlag[];
  readonly estimated: readonly CoreText<GarmentCode>[];
  /** A darab(ok) területe, cm². */
  readonly areaCm2: number;
  /** Fonal tartalékkal és gombolyag, ha a profilból becsülhető. */
  readonly yarn: { readonly lengthM: number; readonly balls: number } | null;
}

export interface MonotonicIssue {
  readonly key: string;
  readonly label: CoreText<GarmentCode>;
  /** A méret azonosítója, amelyben az érték kisebb, mint az előzőben. */
  readonly size: string;
}

export interface GarmentSeriesPlan {
  readonly kind: GarmentKind;
  readonly table: GarmentTable;
  readonly stitch: StitchDefId;
  readonly gauge: ShapeGauge;
  readonly sizes: readonly SizePlan[];
  /** A gráf méretének indexe a `sizes`-ban. */
  readonly base: number;
  readonly monotonic: readonly MonotonicIssue[];
  readonly checksPassed: number;
  readonly checksTotal: number;
  /** Miért nincs fonalbecslés; `null`, ha van. */
  readonly yarnMissing: readonly YarnMissing[] | null;
  /** A sorozat számai a mintába (types.ts `PatternGarment`). */
  readonly values: Readonly<Record<string, readonly number[]>>;
}

export type GarmentPlanResult =
  | { readonly ok: true; readonly plan: GarmentSeriesPlan }
  | { readonly ok: false; readonly reason: CoreText<GarmentCode> };
export type GarmentResult =
  | { readonly ok: true; readonly pattern: Pattern; readonly plan: GarmentSeriesPlan }
  | { readonly ok: false; readonly reason: CoreText<GarmentCode> };

const fail = (reason: CoreText<GarmentCode>): { readonly ok: false; readonly reason: CoreText<GarmentCode> } => ({ ok: false, reason });

/** Mi nem választható: szem, méret, bőség, szegély, ismétlés. */
export function garmentProblem(options: GarmentOptions): CoreText<GarmentCode> | null {
  if (!GARMENT_STITCHES.includes(options.stitch)) {
    return text('stitch-choice');
  }
  const ids = garmentSizes(options.kind, options.table);
  const [from, base, to] = [options.from, options.size, options.to].map((id) => ids.indexOf(id));
  if (base! < 0 || from! < 0 || to! < 0) return text('pick-size');
  if (!(from! <= base! && base! <= to!)) return text('series-range');
  if (options.easeCm !== null && !(Number.isFinite(options.easeCm) && options.easeCm >= -50 && options.easeCm <= 100)) {
    return text('ease-range');
  }
  if (options.kind === 'drop-shoulder' && options.easeCm === null) return text('ease-required');
  if (!(Number.isFinite(options.hemCm) && options.hemCm >= 0 && options.hemCm <= 50)) return text('hem-range');
  if (!(Number.isFinite(options.growthPct) && options.growthPct >= 0 && options.growthPct <= 50)) return text('growth-range');
  if (options.kind === 'drop-shoulder' && !(Number.isFinite(options.belowWaistCm) && options.belowWaistCm >= -30 && options.belowWaistCm <= 100)) {
    return text('below-waist-range');
  }
  if (options.kind === 'drop-shoulder' && options.repeat) {
    const { width, edge } = options.repeat;
    if (!Number.isInteger(width) || width < 1 || width > MAX_REPEAT) return text('repeat-width', { max: MAX_REPEAT });
    if (!Number.isInteger(edge) || edge < 0 || edge > MAX_REPEAT) return text('repeat-edge', { max: MAX_REPEAT });
  }
  return null;
}

/**
 * A raglán méretei a táblázat egy méretéből (05 §2.3, §4 „C” példa): a nyak a
 * keresztháti szélességből, a raglán mélysége a karöltőmélységből, a hónaljlánc
 * a felkar hatoda. A hiányzó méreteket becsüljük.
 */
export function raglanMeasures(
  table: BodyTable,
  sizeId: string,
  options: Pick<GarmentOptions, 'easeCm' | 'hemCm' | 'belowWaistCm'> & { readonly growthPct?: number },
): { readonly measures: RaglanMeasures; readonly estimated: readonly CoreText<GarmentCode>[] } | CoreText<GarmentCode> {
  const size = table.sizes.find((candidate) => candidate.id === sizeId);
  if (!size) return text('unknown-size', { size: sizeId });
  const v = size.values;
  const length = v.backWaist ?? v.backHip;
  if (!v.chest || !length || !v.crossBack) return text('missing-measure', { size: sizeId });
  const estimated: CoreText<GarmentCode>[] = [];
  const bustCm = mid(v.chest);
  let armholeDepthCm: number;
  if (v.armholeDepth) armholeDepthCm = mid(v.armholeDepth);
  else {
    estimated.push(text('estimated-armhole-depth'));
    armholeDepthCm = bustCm / 6 + 5;
  }
  const upperArmCm = v.upperArm ? mid(v.upperArm) + GARMENT_EASE.sleeve : null;
  if (upperArmCm === null) estimated.push(text('estimated-upper-arm'));
  return {
    measures: {
      bustCm,
      easeCm: options.easeCm ?? 0,
      upperArmCm,
      // A nyak körmérete a keresztháti szélességből (05 §2.3): a váll szélességének kb. 1,2-szerese.
      neckCm: NECK_RATIO * mid(v.crossBack) * 2.6,
      // A raglán mélysége a karöltőnél kb. 1–2 cm-rel több (05 §4 „C” példa).
      yokeDepthCm: armholeDepthCm + RAGLAN_YOKE_ALLOWANCE_CM,
      underarmCm: (upperArmCm ?? bustCm / 3) / 8,
      bodyLengthCm: withoutGrowth(mid(length) + options.belowWaistCm, options.growthPct ?? 0),
      hemCm: options.hemCm,
    },
    estimated,
  };
}

/** A sapka és a raglán szemmérete körben, a ledobott vállú pulóveré sorban. */
function garmentGauge(pattern: Pattern, kind: GarmentKind, stitch: StitchDefId): ShapeGauge {
  if (kind === 'drop-shoulder') return shapeGauge(pattern, stitch);
  const def = resolveStitch(stitch) ?? resolveStitch('sc')!;
  const context = gaugeContextOf(pattern, libraryFor(pattern));
  const size = stitchDimensions(def, 'round', context)!;
  return {
    stitchCm: size.widthMm.value / 10,
    rowCm: size.heightMm.value / 10,
    source: weakestSource([size.widthMm.source, size.heightMm.source]),
    basis: size.basis,
    hookMm: context.hookMm,
  };
}

const MONOTONIC: Readonly<Record<GarmentKind, readonly { readonly key: string; readonly label: CoreText<GarmentCode> }[]>> = {
  hat: [
    { key: 'hatStitches', label: text('monotonic-hat-stitches') },
    { key: 'totalRounds', label: text('monotonic-rounds') },
  ],
  raglan: [
    { key: 'raglanBody', label: text('monotonic-raglan-body') },
    { key: 'raglanSleeve', label: text('monotonic-raglan-sleeve') },
    { key: 'raglanNeck', label: text('monotonic-neck') },
  ],
  // Csak szemszámok: az ujj sorai nagyobb méretben csökkenhetnek, mert a szélesebb darabbal a váll lejjebb lóg (05 „B” 8. lépés).
  'drop-shoulder': [
    { key: 'panelStitches', label: text('monotonic-panel') },
    { key: 'neck', label: text('monotonic-neck') },
    { key: 'cuffStitches', label: text('monotonic-cuff') },
    { key: 'sleeveTop', label: text('monotonic-sleeve-top') },
  ],
};

/** A sorozat számai egy méretre; a kulcsok a garment-text.ts szerint. */
function sizeValues(plan: GarmentSizePlan): Record<string, number> {
  if (plan.kind === 'raglan') {
    return {
      raglanChestCm: Math.round(plan.finished.chestCm),
      raglanLengthCm: Math.round(plan.finished.lengthCm),
      raglanNeck: plan.neck.stitches,
      raglanNeckFront: plan.neck.front,
      raglanNeckSleeve: plan.neck.sleeve,
      raglanRounds: plan.yokeRounds,
      raglanBodyRounds: plan.bodyRounds.length,
      raglanBody: plan.bodyStitches,
      raglanSleeve: plan.sleeveStitches,
      raglanUnderarm: plan.underarm,
      raglanFront: plan.target.front,
      raglanTargetSleeve: plan.target.sleeve,
      raglanBelowRounds: plan.bodyRoundsBelow,
      raglanHemRounds: plan.hemRounds,
    };
  }
  if (plan.kind === 'hat') {
    return {
      hatCm: Math.round(plan.finishedCm),
      heightCm: Math.round(plan.finishedHeightCm),
      increases: plan.increases,
      crownRounds: plan.crownRounds,
      hatStitches: plan.stitches,
      sideRounds: plan.sideRounds,
      brimRounds: plan.brimRounds,
      totalRounds: plan.counts.length,
    };
  }
  const [a, b] = plan.sleeve.runs.length === 2 ? plan.sleeve.runs : [undefined, plan.sleeve.runs[0]];
  return {
    chestCm: Math.round(plan.finished.chestCm),
    lengthCm: Math.round(plan.finished.lengthCm),
    sleeveCm: Math.round(plan.finished.sleeveCm),
    panelStitches: plan.panel.stitches,
    panelFoundation: plan.panel.foundation,
    panelRows: plan.panel.rows,
    hemRows: plan.panel.hemRows,
    armholeRows: plan.panel.armholeRows,
    shoulder: plan.neck.shoulder,
    neck: plan.neck.stitches,
    sleeveFoundation: plan.sleeve.foundation,
    cuffStitches: plan.sleeve.cuff,
    sleeveTop: plan.sleeve.top,
    sleeveRows: plan.sleeve.rows,
    cuffRows: plan.sleeve.cuffRows,
    firstIncrease: plan.sleeve.first ?? 0,
    everyA: a?.every ?? 0,
    timesA: a?.times ?? 0,
    everyB: b?.every ?? 0,
    timesB: b?.times ?? 0,
  };
}

/** A darab(ok) területe a fonalhoz, cm². */
function areaOf(plan: GarmentSizePlan, gauge: ShapeGauge): number {
  if (plan.kind === 'raglan') {
    // A vállrész csonka kúp palástja, a törzs henger, az ujjak henger a hónaljtól a kézfejig.
    const yoke = ((plan.neck.stitches + plan.bodyStitches) / 2) * gauge.stitchCm * plan.yokeRounds * gauge.rowCm;
    const body = plan.bodyStitches * gauge.stitchCm * plan.bodyRoundsBelow * gauge.rowCm;
    const sleeves = 2 * plan.sleeveStitches * gauge.stitchCm * plan.yokeRounds * gauge.rowCm;
    return yoke + body + sleeves;
  }
  if (plan.kind === 'hat') {
    const crownRadius = plan.crownRounds * gauge.rowCm;
    return Math.PI * crownRadius ** 2 + plan.stitches * gauge.stitchCm * plan.sideRounds * gauge.rowCm;
  }
  const panel = plan.panel.stitches * gauge.stitchCm * plan.panel.rows * gauge.rowCm;
  const sleeve = ((plan.sleeve.cuff + plan.sleeve.top) / 2) * gauge.stitchCm * plan.sleeve.rows * gauge.rowCm;
  return 2 * panel + 2 * sleeve;
}

/** A méretsorozat terve a minta mintasűrűségével; a gráfot a `generateGarment` építi. */
export function planGarment(pattern: Pattern, options: GarmentOptions): GarmentPlanResult {
  const problem = garmentProblem(options);
  if (problem) return fail(problem);
  const gauge = garmentGauge(pattern, options.kind, options.stitch);
  const def = resolveStitch(options.stitch)!;
  const tradition = traditionOf(pattern.conventions);
  const start: RowStart = {
    turningChain: def.turningChain,
    counting: turningChainCountsFor(pattern.conventions.turningChainCounts, def, tradition, 'row'),
    tradition,
  };
  const ids = garmentSizes(options.kind, options.table);
  const series = ids.slice(ids.indexOf(options.from), ids.indexOf(options.to) + 1);
  const table: GarmentTable = options.kind === 'hat' ? 'hat' : options.table;
  const flags = options.kind === 'hat' ? [] : tableFlags(BODY_TABLES[options.table]);

  const profile = activeProfile(pattern);
  const massPerArea = profile ? swatchMassPerArea(profile) : null;
  const ballLength = profile ? ballLengthM(profile) : null;
  const missing: YarnMissing[] = [];
  if (!profile) missing.push('profile');
  else {
    if (massPerArea === null) missing.push('swatch');
    if (profile.yarn.metersPer100g === null) missing.push('meterage');
    if (profile.yarn.ballMassG === null) missing.push('ball');
  }

  const sizes: SizePlan[] = [];
  for (const id of series) {
    let plan: GarmentSizePlan | CoreText<GarmentCode>;
    let estimated: readonly CoreText<GarmentCode>[] = [];
    if (options.kind === 'hat') {
      const measures = hatMeasures(id, options.easeCm, options.hemCm, options.growthPct)!;
      plan = hatPlan(measures, gauge);
    } else if (options.kind === 'raglan') {
      const graded = raglanMeasures(BODY_TABLES[options.table], id, options);
      if (isGarmentText(graded)) return fail(graded);
      estimated = graded.estimated;
      plan = raglanPlan(graded.measures, gauge);
    } else {
      const graded = dropShoulderMeasures(BODY_TABLES[options.table], id, options);
      if (isGarmentText(graded)) return fail(graded);
      estimated = graded.estimated;
      const previous = sizes.at(-1)?.plan;
      plan = dropShoulderPlan(graded.measures, gauge, start, options.repeat, previous?.kind === 'drop-shoulder' ? previous.neck.stitches : 0);
    }
    // Sorozatban az elutasítás megmondja, melyik méretnél akadt el; a méret nevét a felület teszi bele.
    if (isGarmentText(plan)) {
      return fail(series.length > 1 ? text('size-problem', { size: id, table, inner: plan.code, ...(plan.data ?? {}) }) : plan);
    }
    const areaCm2 = areaOf(plan, gauge);
    const yarn =
      missing.length === 0 && massPerArea !== null && ballLength !== null && profile?.yarn.ballMassG
        ? yarnFromMassPerArea(measured(massPerArea), areaCm2, { lengthM: ballLength, massG: profile.yarn.ballMassG })
        : null;
    sizes.push({
      id,
      plan,
      flags: flags.filter((flag) => flag.size === id),
      estimated,
      areaCm2,
      yarn: yarn ? { lengthM: Math.round(yarn.lengthWithBufferM.value), balls: yarn.balls.value } : null,
    });
  }

  const perSize = sizes.map((size) => sizeValues(size.plan));
  const values: Record<string, number[]> = {};
  for (const key of Object.keys(perSize[0]!)) values[key] = perSize.map((entry) => entry[key]!);
  if (sizes.every((size) => size.yarn)) {
    values['yarnM'] = sizes.map((size) => size.yarn!.lengthM);
    values['balls'] = sizes.map((size) => size.yarn!.balls);
  }

  const monotonic: MonotonicIssue[] = [];
  for (const { key, label } of MONOTONIC[options.kind]) {
    values[key]!.forEach((value, i) => {
      if (i > 0 && value < values[key]![i - 1]!) monotonic.push({ key, label, size: sizes[i]!.id });
    });
  }
  const checks = sizes.flatMap((size) => size.plan.checks);

  return {
    ok: true,
    plan: {
      kind: options.kind,
      table,
      stitch: options.stitch,
      gauge,
      sizes,
      base: sizes.findIndex((size) => size.id === options.size),
      monotonic,
      checksPassed: checks.filter((check) => check.ok).length,
      checksTotal: checks.length,
      yarnMissing: missing.length === 0 ? null : missing,
      values,
    },
  };
}

/* ---- Gráfépítés ---- */

const stitchEdge = (piece: string, layer: number, from: number, count: number) => ({ piece, layer, stitches: { from, count } });
const rowsEdge = (piece: string, from: number, to: number, side: 'left' | 'right') => ({ piece, layer: from, rows: { to, side } });

/** Két szél varrása; eltérő hossznál egyenletes elosztással. */
function seam(a: PieceJoin['a'], countA: number, b: PieceJoin['b'], countB: number): PieceJoin {
  return countA === countB ? { a, b } : { a, b, distribution: evenDistribution(countA, countB) };
}

/**
 * A pulóver varrásai (05 §9.5 9. pont). A darabokat színükkel egymás felé
 * fordítva varrjuk, ezért a hátrész bal széle az elejerész jobb szélére kerül,
 * és a hátrész sorának eleje az elejerész sorának végére.
 */
export function dropShoulderJoins(plan: DropShoulderPlan, neckline: GarmentOptions['neckline'] = 'boat'): PieceJoin[] {
  const { stitches, rows, armholeRows } = plan.panel;
  const { shoulder } = plan.neck;
  const { top, rows: sleeveRows } = plan.sleeve;
  const half = top / 2;
  const shaped = neckline === 'shaped';
  // Formázott nyaknál a darab a megosztásig egy szakasz, fölötte a vállak. A karöltő mindkét darabon ugyanott
  // kezdődik (a felső éltől számítva), ezért az oldalvarrás hossza egyforma; a karöltő a törzs tetejéig tart (PQW-901).
  const bodyRows = (part: 'front' | 'back') => (shaped ? neckSplitRow(plan, part) : rows);
  const sideRows = rows - armholeRows;
  const sleeve = (piece: string, backSide: 'left' | 'right', frontSide: 'left' | 'right'): PieceJoin[] => [
    seam(stitchEdge(piece, sleeveRows, 0, half), half, rowsEdge('p1', sideRows + 1, bodyRows('back'), backSide), bodyRows('back') - sideRows),
    seam(stitchEdge(piece, sleeveRows, half, half), half, rowsEdge('p2', sideRows + 1, bodyRows('front'), frontSide), bodyRows('front') - sideRows),
    { a: rowsEdge(piece, 1, sleeveRows, 'left'), b: rowsEdge(piece, 1, sleeveRows, 'right') },
  ];
  // Formázott nyaknál a váll egy-egy teljes sor a szakasza tetején; csónaknyaknál a felső sor egy szakasza.
  const shoulderSeams: PieceJoin[] = shaped
    ? [
        { a: stitchEdge('p1', neckSplitRow(plan, 'back') + plan.neck.back.rows, 0, shoulder), b: stitchEdge('p2', rows + plan.neck.front.rows, 0, shoulder) },
        { a: stitchEdge('p1', rows + plan.neck.back.rows, 0, shoulder), b: stitchEdge('p2', neckSplitRow(plan, 'front') + plan.neck.front.rows, 0, shoulder) },
      ]
    : [
        { a: stitchEdge('p1', rows, 0, shoulder), b: stitchEdge('p2', rows, stitches - shoulder, shoulder) },
        { a: stitchEdge('p1', rows, stitches - shoulder, shoulder), b: stitchEdge('p2', rows, 0, shoulder) },
      ];
  return [
    ...shoulderSeams,
    { a: rowsEdge('p1', 1, sideRows, 'left'), b: rowsEdge('p2', 1, sideRows, 'right') },
    { a: rowsEdge('p1', 1, sideRows, 'right'), b: rowsEdge('p2', 1, sideRows, 'left') },
    ...sleeve('p3', 'left', 'right'),
    ...sleeve('p4', 'right', 'left'),
  ];
}

/** A formázott nyakkivágás megosztási sora: a váll alakítása e fölött készül (PQW-901). */
export function neckSplitRow(plan: DropShoulderPlan, part: 'front' | 'back'): number {
  return plan.panel.rows - (part === 'front' ? plan.neck.front.rows : plan.neck.back.rows);
}

/**
 * A hátrész és az elejerész sorai formázott nyakkivágással (PQW-901): a
 * megosztásig egy szakasz, fölötte a két váll. A váll belső élén fogy a nyak:
 * elöl az első sorban több szem, utána soronként egy; hátul soronként egy. A
 * két váll közötti szemek a nyak közepén maradnak.
 */
export function panelSections(plan: DropShoulderPlan, part: 'front' | 'back'): RowSection[] {
  const { stitches } = plan.panel;
  const { shoulder } = plan.neck;
  const neck =
    part === 'front'
      ? plan.neck.front
      : {
          center: plan.neck.back.center,
          perSide: plan.neck.back.rows * plan.neck.back.perRow,
          first: plan.neck.back.perRow,
          later: Math.max(0, plan.neck.back.rows - 1),
          rows: plan.neck.back.rows,
        };
  const split = neckSplitRow(plan, part);
  const span = shoulder + neck.perSide;
  // A váll belső éle a sor vége az egyik, a sor eleje a másik oldalon.
  const shoulderRows = (inner: 'start' | 'end') => {
    const counts: number[] = [];
    const shaping: RowShaping[] = [];
    for (let k = 0; k < neck.rows; k += 1) {
      const change = k === 0 ? -neck.first : k <= neck.later ? -1 : 0;
      shaping.push(inner === 'end' ? { start: 0, end: change } : { start: change, end: 0 });
      counts.push((k === 0 ? span : counts[k - 1]!) + change);
    }
    return { counts, shaping };
  };
  const firstShoulder = shoulderRows('end');
  const secondShoulder = shoulderRows('start');
  return [
    { counts: Array<number>(split).fill(stitches), shaping: Array.from({ length: split }, () => ({ start: 0, end: 0 })) },
    { over: split, from: 0, span, counts: firstShoulder.counts, shaping: firstShoulder.shaping },
    { name: 'A másik váll', over: split, from: span + neck.center, span, counts: secondShoulder.counts, shaping: secondShoulder.shaping },
  ];
}

/** Az ujj sorainak szemszáma és alakítása a mandzsettától. */
export function sleeveRowsOf(plan: DropShoulderPlan): { readonly counts: number[]; readonly shaping: RowShaping[] } {
  const increase = new Set(plan.sleeve.increaseRows);
  const shaping: RowShaping[] = [];
  const counts: number[] = [];
  for (let row = 1; row <= plan.sleeve.rows; row += 1) {
    const change = increase.has(row) ? 1 : 0;
    shaping.push({ start: change, end: change });
    counts.push(row === 1 ? plan.sleeve.cuff : counts[row - 2]! + 2 * change);
  }
  return { counts, shaping };
}

const GENERATED_NAMES = [...Object.values(GARMENT_NAMES)];

/**
 * Új minta a ruhadarabból, a választott méret gráfjával és a méretsorozattal.
 * A mintából a címet (ha nem generált), a jelölést, a profilokat és a
 * konvenciókat veszi át.
 */
export function generateGarment(pattern: Pattern, options: GarmentOptions): GarmentResult {
  const planned = planGarment(pattern, options);
  if (!planned.ok) return planned;
  const { plan } = planned;
  const size = plan.sizes[plan.base]!;
  const name = GARMENT_NAMES[options.kind];
  const { joins: _joins, garment: _garment, toy: _toy, ...rest } = pattern;
  let base: Pattern = { ...rest, pieces: [] };
  const garment: PatternGarment = { kind: plan.kind, table: plan.table, sizes: plan.sizes.map((entry) => entry.id), base: plan.base, values: plan.values };

  let result: Pattern;
  if (size.plan.kind === 'raglan') {
    base = { ...base, conventions: { ...base.conventions, roundEnd: 'join-slip' } };
    const total = size.plan.bodyStitches * (size.plan.yokeRounds + size.plan.bodyRoundsBelow);
    if (total > MAX_GARMENT_TOTAL) {
      return fail(text('max-total-raglan', { max: MAX_GARMENT_TOTAL }));
    }
    const piece = raglanPiece(base, options.stitch, size.plan, name);
    if (isGarmentText(piece)) return fail(piece);
    result = { ...base, pieces: [piece], garment };
  } else if (size.plan.kind === 'hat') {
    base = { ...base, conventions: { ...base.conventions, roundEnd: 'join-slip' } };
    const motif = { ...DEFAULT_MOTIF, shape: 'circle' as const, stitch: options.stitch, start: 'magic-ring' as const, closing: 'join-slip' as const };
    const piece = plannedRounds(base, motif, size.plan.layout, name);
    if (typeof piece === 'string') return fail(pieceProblem(piece));
    result = { ...base, pieces: [piece], garment };
  } else {
    const shoulderPlan = size.plan;
    const total = 2 * shoulderPlan.panel.stitches * shoulderPlan.panel.rows + 2 * shoulderPlan.sleeve.rows * shoulderPlan.sleeve.top;
    if (total > MAX_GARMENT_TOTAL) {
      return fail(text('max-total-sweater', { max: MAX_GARMENT_TOTAL }));
    }
    const panelCounts = Array<number>(shoulderPlan.panel.rows).fill(shoulderPlan.panel.stitches);
    const flat = panelCounts.map(() => ({ start: 0, end: 0 }));
    const sleeve = sleeveRowsOf(shoulderPlan);
    // Formázott nyaknál a darab két vállal folytatódik a megosztás fölött (PQW-901).
    const shaped = options.neckline === 'shaped' && shoulderPlan.neck.front.rows > 0 && shoulderPlan.neck.back.rows > 0;
    const panel = (part: 'front' | 'back', pieceName: string, id: string) =>
      shaped
        ? plannedSections(base, options.stitch, panelSections(shoulderPlan, part), pieceName, id)
        : plannedRows(base, options.stitch, panelCounts, flat, pieceName, id);
    const pieces = [
      panel('back', PIECE_NAMES.back, 'p1'),
      panel('front', PIECE_NAMES.front, 'p2'),
      plannedRows(base, options.stitch, sleeve.counts, sleeve.shaping, PIECE_NAMES.leftSleeve, 'p3'),
      // A jobb ujj a bal tükörképe (05 §4.5): a sor eleje és vége felcserélődik.
      plannedRows(base, options.stitch, sleeve.counts, mirrorShaping(sleeve.shaping), PIECE_NAMES.rightSleeve, 'p4'),
    ];
    const built: Piece[] = [];
    for (const piece of pieces) {
      if ('code' in piece) return fail(pieceProblem(piece));
      built.push(piece);
    }
    result = {
      ...base,
      pieces: built,
      joins: dropShoulderJoins(shoulderPlan, shaped ? 'shaped' : 'boat'),
      garment,
    };
  }

  result = withGeneratedTitle(result, pattern, name, GENERATED_NAMES);
  const errors = validatePattern(result, libraryFor(result)).filter((finding) => finding.severity === 'error');
  if (errors.length > 0) return fail(text('internal-error', { rule: errors[0]!.rule }));
  return { ok: true, pattern: result, plan };
}
