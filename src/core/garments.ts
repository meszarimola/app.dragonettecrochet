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
  HAT_SIZES,
  NEGATIVE_EASE_LIMIT,
  NEGATIVE_EASE_MAX,
  bodySizeName,
  hatEase,
  hatSizeName,
  inchToCm,
  mid,
  tableFlags,
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
import { activeProfile, ballLengthM, gaugeContextOf, swatchMassPerArea, type YarnMissing } from './pattern-size.ts';
import { withGeneratedTitle } from './pattern-title.ts';
import { measured, weakestSource } from './quantity.ts';
import { foundationChainLength } from './repeat.ts';
import { DEFAULT_MOTIF, circlePlan, plannedRounds, type RoundPlan } from './round-generator.ts';
import { SHAPE_STITCHES, plannedRows, shapeGauge, type RowShaping, type ShapeGauge, type ShapeRepeat } from './shapes.ts';
import { libraryFor, resolveStitch } from './stitch-variants.ts';
import { traditionOf, turningChainCountsFor } from './tradition.ts';
import type { GarmentKind, GarmentTable, Pattern, PatternGarment, PieceJoin, StitchDefId, Tradition } from './types.ts';
import { validatePattern } from './validate.ts';
import { yarnFromMassPerArea } from './yarn-estimate.ts';

export const GARMENT_KINDS: readonly GarmentKind[] = ['hat', 'drop-shoulder'];

export const GARMENT_NAMES: Readonly<Record<GarmentKind, string>> = {
  hat: 'Sapka',
  'drop-shoulder': 'Ledobott vállú pulóver',
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

export interface GarmentSize {
  readonly id: string;
  readonly name: string;
}

/** A választható méretek a táblázat sorrendjében. */
export function garmentSizes(kind: GarmentKind, table: BodyTableId): GarmentSize[] {
  if (kind === 'hat') return HAT_SIZES.map((size) => ({ id: size.id, name: hatSizeName(size.id, 'hu') }));
  return BODY_TABLES[table].sizes.map((size) => ({ id: size.id, name: bodySizeName(table, size.id, 'hu') }));
}

/** Egy igaz/hamis ellenőrzés (05 §3.8 7. pont, §8.3 utolsó pont). */
export interface GarmentCheck {
  readonly id: string;
  readonly label: string;
  readonly ok: boolean;
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
  readonly warnings: readonly string[];
}

/** A sapka terve a fejből, a bőségből és a szemméretből (05 §9.7); hibánál az ok. */
export function hatPlan(measures: HatMeasures, gauge: { readonly stitchCm: number; readonly rowCm: number }): HatPlan | string {
  const { headCm, easeCm, heightCm, brimCm } = measures;
  if (!(headCm > 0 && headCm <= MAX_GARMENT_CM)) return `A fejkörfogat 0 és ${MAX_GARMENT_CM} cm közötti szám legyen.`;
  const ratio = -easeCm / headCm;
  if (ratio > NEGATIVE_EASE_MAX) {
    return `A negatív bőség legfeljebb a fejkörfogat ${pct(NEGATIVE_EASE_MAX)}%-a lehet (most ${pct(ratio)}%): a horgolt anyag kevéssé nyúlik.`;
  }
  const hatCm = headCm + easeCm;
  const stitches = roundStitches(hatCm / gauge.stitchCm, intentOf(easeCm));
  const radius = hatCm / (2 * Math.PI);
  if (heightCm <= radius) return `A sapka magassága legyen nagyobb a korona sugaránál (${Math.ceil(radius)} cm).`;

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
  if (!best) return 'Ilyen kis körméretnél nem tervezhető korona: adj meg nagyobb fejkörfogatot.';

  const sideRounds = Math.round((heightCm - radius) / gauge.rowCm);
  if (sideRounds < 1) return 'A sapka oldala legalább egy kör legyen: adj meg nagyobb magasságot.';
  const brimRounds = Math.round(Math.max(0, brimCm) / gauge.rowCm);
  const circle = circlePlan(best.I, best.full, true);
  const correction = best.delta > 0 ? evenIncreases(best.I * best.full, best.delta) : null;
  const layout: RoundPlan = {
    first: best.I,
    rounds: [...circle.rounds, ...(correction ? [correction] : []), ...Array.from({ length: sideRounds }, () => Array<number>(stitches).fill(1))],
  };
  const counts = [best.I];
  for (const into of layout.rounds) counts.push(sum(into));
  if (counts.length > MAX_GARMENT_ROWS) return `Legfeljebb ${MAX_GARMENT_ROWS} kör lehet: adj meg kisebb méretet.`;

  const totalRounds = counts.length;
  const finishedHeightCm = totalRounds * gauge.rowCm;
  const checks: GarmentCheck[] = [
    { id: 'crown-target', label: 'A korona utolsó köre a tervezett szemszám', ok: counts[best.crown - 1] === stitches },
    { id: 'crown-doubling', label: 'A korona egyik körében sincs duplázásnál több szaporítás', ok: correction === null || best.delta <= best.I * best.full },
    { id: 'side-count', label: 'Az oldal minden köre a tervezett szemszám', ok: counts.slice(best.crown).every((count) => count === stitches) },
    { id: 'brim', label: 'A perem nem magasabb a sapka oldalánál', ok: brimRounds <= sideRounds },
    { id: 'height', label: 'A kész magasság legfeljebb másfél körrel tér el a tervezettől', ok: Math.abs(finishedHeightCm - heightCm) <= 1.5 * gauge.rowCm },
    { id: 'negative-ease', label: `A negatív bőség legfeljebb ${pct(NEGATIVE_EASE_LIMIT)}%`, ok: ratio <= NEGATIVE_EASE_LIMIT + 1e-9 },
  ];
  const warnings: string[] = [];
  if (ratio > NEGATIVE_EASE_LIMIT + 1e-9) {
    warnings.push(`A negatív bőség ${pct(ratio)}%: horgolt anyagnál ${pct(NEGATIVE_EASE_LIMIT)}% fölött csak nyúlós, bordás szemmel működik (05 §3.5, §7.2).`);
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

/** A sapka méretei a sapkatáblázatból (05 §5.2): a magasság a fül közepéig mért hossz. */
export function hatMeasures(sizeId: string, easeCm: number | null, brimCm: number): HatMeasures | null {
  const size = HAT_SIZES.find((candidate) => candidate.id === sizeId);
  if (!size) return null;
  const headCm = inchToCm(size.headIn);
  return { headCm, easeCm: easeCm ?? hatEase(headCm), heightCm: inchToCm(size.midEarIn), brimCm };
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
  readonly warnings: readonly string[];
}

/** A páros különbségű legközelebbi egész: a két váll így egyforma. */
function nearestWithParity(exact: number, parityOf: number): number {
  const low = Math.floor(exact);
  const candidates = [low - 1, low, low + 1, low + 2].filter((n) => (parityOf - n) % 2 === 0);
  return candidates.reduce((best, n) => (Math.abs(n - exact) < Math.abs(best - exact) ? n : best));
}

/**
 * A ledobott vállú pulóver terve egy méretre (05 §9.5, „B” példa); hibánál az
 * ok. A `minNeck` az előző méret nyaka: a sorozatban a nyak nem lehet kisebb
 * (05 §9.6), ezért ha a párosság miatt kisebb lenne, a legközelebbi nagyobb
 * jó párosságú szám lesz.
 */
export function dropShoulderPlan(
  m: DropShoulderMeasures,
  gauge: { readonly stitchCm: number; readonly rowCm: number },
  start: RowStart,
  repeat: ShapeRepeat | null,
  minNeck = 0,
): DropShoulderPlan | string {
  const { stitchCm, rowCm } = gauge;
  const ratio = -m.easeCm / m.bustCm;
  if (ratio > NEGATIVE_EASE_MAX) {
    return `A negatív bőség legfeljebb a mellbőség ${pct(NEGATIVE_EASE_MAX)}%-a lehet (most ${pct(ratio)}%): a horgolt anyag kevéssé nyúlik.`;
  }
  const intent = intentOf(m.easeCm);
  const halfCm = (m.bustCm + m.easeCm) / 2;
  const exact = halfCm / stitchCm;
  const stitches = repeat ? roundToRepeat(exact, repeat, intent) : roundStitches(exact, intent);
  if (stitches < 8) return 'A hátrész túl keskeny: adj meg nagyobb méretet vagy vékonyabb fonalat.';
  if (stitches > MAX_GARMENT_STITCHES) return `Egy sorban legfeljebb ${MAX_GARMENT_STITCHES} szem lehet: adj meg kisebb méretet vagy vastagabb fonalat.`;
  const foundation = foundationChainLength(stitches, start.turningChain, start.counting, start.tradition);

  const hemRows = roundEven(Math.max(0, m.hemCm) / rowCm);
  const bodyRows = roundEven((m.bodyLengthCm - Math.max(0, m.hemCm)) / rowCm);
  if (bodyRows < 2) return 'A pulóver hossza legyen nagyobb a szegély magasságánál.';
  const rows = hemRows + bodyRows;
  if (rows > MAX_GARMENT_ROWS) return `Legfeljebb ${MAX_GARMENT_ROWS} sor lehet: adj meg kisebb méretet vagy vastagabb fonalat.`;
  const armholeRows = roundEven(m.armholeDepthCm / rowCm);
  if (armholeRows < 2 || armholeRows >= rows) return 'A karöltő mélysége nem fér a pulóver hosszába: adj meg nagyobb hosszt.';
  const sideRows = rows - armholeRows;

  // Nyak: a vállak egyformák, ezért a nyak szemszámának párossága a sorét követi.
  let neck = nearestWithParity(m.neckWidthCm / stitchCm, stitches);
  if (neck < minNeck) neck = minNeck + ((stitches - minNeck) % 2);
  if (neck < 2 || neck > stitches - 4) return 'A nyak szélessége nem fér a hátrész szélességébe: adj meg nagyobb méretet.';
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
  const warnings: string[] = [];
  let cuff = roundEven(m.cuffWidthCm / stitchCm, 'up');
  if (cuff > top) {
    cuff = top;
    warnings.push('A mandzsetta szélesebb lenne az ujj felső élénél, ezért az ujj egyenes.');
  }
  const lengthCm = m.neckToWristCm - halfCm / 2;
  const cuffRows = hemRows;
  const shapedRows = roundEven((lengthCm - Math.max(0, m.hemCm)) / rowCm);
  if (shapedRows < 2) return 'Az ujj túl rövid ehhez a mérethez: ellenőrizd a hátközép–kézfej hosszt.';
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
  if (!schedule || !reversed) return 'Az ujj hosszán nem fér el ennyi szaporítás: adj meg kisebb bőséget vagy hosszabb ujjat.';
  const increaseRows = reversed.map((row) => row + cuffRows);
  const { first: firstIncrease, runs } = shapingRuns(increaseRows);
  const sleeveRows = cuffRows + shapedRows;
  if (sleeveRows > MAX_GARMENT_ROWS) return `Legfeljebb ${MAX_GARMENT_ROWS} sor lehet: adj meg kisebb méretet vagy vastagabb fonalat.`;
  const sleeveFoundation = foundationChainLength(cuff, start.turningChain, start.counting, start.tradition);

  const chestCm = 2 * stitches * stitchCm;
  const upperArmEaseCm = m.upperArmCm === null ? null : top * stitchCm - m.upperArmCm;
  const even = (n: number) => n % 2 === 0;
  const checks: GarmentCheck[] = [
    ...(repeat
      ? [
          {
            id: 'panel-repeat',
            label: `A hátrész és az elejerész szemszáma ${repeat.width} többszöröse + ${repeat.edge}`,
            ok: stitches >= repeat.width + repeat.edge && (stitches - repeat.edge) % repeat.width === 0,
          },
        ]
      : []),
    { id: 'even-rows', label: 'Minden függőleges szakasz páros számú sor', ok: [hemRows, bodyRows, armholeRows, cuffRows, shapedRows].every(even) },
    { id: 'shoulders', label: 'A két váll és a nyak együtt kiadja a sor szemszámát', ok: 2 * shoulder + neck === stitches },
    {
      id: 'neck-shaping',
      label: 'A formázott nyak fogyasztásai kiadják a nyak szemszámát, és a nyak belefér a darabba',
      ok: center + 2 * (first + later) === neck && backCenter + 2 * backRows * backPerRow === neck && frontRows < rows,
    },
    { id: 'sleeve-width', label: 'A mandzsetta szemszáma és a szaporítások kiadják az ujj felső élét', ok: cuff + 2 * increases === top },
    {
      id: 'sleeve-rows',
      label: 'Az ujj szaporítási közei és az egyenes sorok kiadják az ujj sorait',
      ok: sum(schedule.intervals) + schedule.tail === shapedRows && increaseRows.length === increases && (increaseRows.at(-1) ?? 0) <= sleeveRows,
    },
    {
      id: 'armhole-seam',
      label: `Az ujj felső éle és a két karöltő hossza legfeljebb ${SEAM_EASING_CM} cm-rel tér el`,
      ok: Math.abs(top * stitchCm - 2 * armholeRows * rowCm) <= SEAM_EASING_CM,
    },
    { id: 'side-seam', label: 'Az oldalvarrás a karöltő alatt legalább egy sor', ok: sideRows >= 1 },
    { id: 'negative-ease', label: `A negatív bőség legfeljebb ${pct(NEGATIVE_EASE_LIMIT)}%`, ok: ratio <= NEGATIVE_EASE_LIMIT + 1e-9 },
  ];
  if (ratio > NEGATIVE_EASE_LIMIT + 1e-9) {
    warnings.push(`A negatív bőség ${pct(ratio)}%: horgolt anyagnál ${pct(NEGATIVE_EASE_LIMIT)}% fölött csak nyúlós, bordás szemmel működik (05 §3.5, §7.2).`);
  }
  if (upperArmEaseCm !== null && upperArmEaseCm < 5) {
    warnings.push(`A felkaron csak ${Math.round(upperArmEaseCm)} cm a bőség: a szokásos kb. 5 cm (05 §3.5).`);
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
  /** A táblázatban hiányzó, becsült méretek neve. */
  readonly estimated: readonly string[];
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
  options: Pick<GarmentOptions, 'easeCm' | 'hemCm' | 'belowWaistCm'>,
): GradedMeasures | string {
  const size = table.sizes.find((candidate) => candidate.id === sizeId);
  if (!size) return `Ismeretlen méret: ${sizeId}.`;
  const v = size.values;
  const length = v.backWaist ?? v.backHip;
  if (!v.chest || !v.neckToWrist || !length || !v.crossBack) return `A(z) ${sizeId} méretnél hiányzik a táblázatból egy szükséges méret.`;
  const estimated: string[] = [];
  const bustCm = mid(v.chest);
  let armholeDepthCm: number;
  if (v.armholeDepth) armholeDepthCm = mid(v.armholeDepth) * DROP_ARMHOLE_FACTOR;
  else {
    estimated.push('karöltőmélység');
    armholeDepthCm = bustCm / 6 + 5;
  }
  const upperArmCm = v.upperArm ? mid(v.upperArm) : null;
  if (upperArmCm === null) estimated.push('mandzsetta');
  const crossBackCm = mid(v.crossBack);
  const frontNeckDepthCm = 0.2 * armholeDepthCm + 4;
  return {
    measures: {
      bustCm,
      easeCm: options.easeCm ?? 0,
      neckToWristCm: mid(v.neckToWrist),
      upperArmCm,
      armholeDepthCm,
      bodyLengthCm: mid(length) + options.belowWaistCm,
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

export interface SizePlan {
  readonly id: string;
  readonly name: string;
  readonly plan: HatPlan | DropShoulderPlan;
  /** A táblázat gyanús értékei ennél a méretnél (body-sizes.ts). */
  readonly flags: readonly DataFlag[];
  readonly estimated: readonly string[];
  /** A darab(ok) területe, cm². */
  readonly areaCm2: number;
  /** Fonal tartalékkal és gombolyag, ha a profilból becsülhető. */
  readonly yarn: { readonly lengthM: number; readonly balls: number } | null;
}

export interface MonotonicIssue {
  readonly key: string;
  readonly label: string;
  /** A méret, amelyben az érték kisebb, mint az előzőben. */
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

export type GarmentPlanResult = { readonly ok: true; readonly plan: GarmentSeriesPlan } | { readonly ok: false; readonly reason: string };
export type GarmentResult =
  | { readonly ok: true; readonly pattern: Pattern; readonly plan: GarmentSeriesPlan }
  | { readonly ok: false; readonly reason: string };

const fail = (reason: string): { readonly ok: false; readonly reason: string } => ({ ok: false, reason });

/** Mi nem választható: szem, méret, bőség, szegély, ismétlés. */
export function garmentProblem(options: GarmentOptions): string | null {
  if (!GARMENT_STITCHES.includes(options.stitch)) {
    return 'Ehhez a generátorhoz alapszemet válassz: rövidpálca, félpálca, egyráhajtásos vagy kétráhajtásos pálca.';
  }
  const ids = garmentSizes(options.kind, options.table).map((size) => size.id);
  const [from, base, to] = [options.from, options.size, options.to].map((id) => ids.indexOf(id));
  if (base! < 0 || from! < 0 || to! < 0) return 'Válassz méretet a listából.';
  if (!(from! <= base! && base! <= to!)) return 'A méretsorozat a választott méretet is tartalmazza: az első méret ne legyen nagyobb, az utolsó ne legyen kisebb nála.';
  if (options.easeCm !== null && !(Number.isFinite(options.easeCm) && options.easeCm >= -50 && options.easeCm <= 100)) {
    return 'A bőség −50 és 100 cm közötti szám legyen.';
  }
  if (options.kind === 'drop-shoulder' && options.easeCm === null) return 'Add meg a bőséget.';
  if (!(Number.isFinite(options.hemCm) && options.hemCm >= 0 && options.hemCm <= 50)) return 'A szegély magassága 0 és 50 cm közötti szám legyen.';
  if (options.kind === 'drop-shoulder' && !(Number.isFinite(options.belowWaistCm) && options.belowWaistCm >= -30 && options.belowWaistCm <= 100)) {
    return 'A derék alatti hossz −30 és 100 cm közötti szám legyen.';
  }
  if (options.kind === 'drop-shoulder' && options.repeat) {
    const { width, edge } = options.repeat;
    if (!Number.isInteger(width) || width < 1 || width > MAX_REPEAT) return `Az ismétlés szemszáma (X) 1 és ${MAX_REPEAT} közötti egész szám legyen.`;
    if (!Number.isInteger(edge) || edge < 0 || edge > MAX_REPEAT) return `A szélső szemek száma (Y) 0 és ${MAX_REPEAT} közötti egész szám legyen.`;
  }
  return null;
}

/** A sapka szemmérete körben (a korona kör), a pulóveré sorban. */
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

const MONOTONIC: Readonly<Record<GarmentKind, readonly { readonly key: string; readonly label: string }[]>> = {
  hat: [
    { key: 'hatStitches', label: 'a sapka szemszáma' },
    { key: 'totalRounds', label: 'a körök száma' },
  ],
  // Csak szemszámok: az ujj sorai nagyobb méretben csökkenhetnek, mert a szélesebb darabbal a váll lejjebb lóg (05 „B” 8. lépés).
  'drop-shoulder': [
    { key: 'panelStitches', label: 'a hátrész szemszáma' },
    { key: 'neck', label: 'a nyak szemszáma' },
    { key: 'cuffStitches', label: 'a mandzsetta szemszáma' },
    { key: 'sleeveTop', label: 'az ujj felső éle' },
  ],
};

/** A sorozat számai egy méretre; a kulcsok a garment-text.ts szerint. */
function sizeValues(plan: HatPlan | DropShoulderPlan): Record<string, number> {
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
function areaOf(plan: HatPlan | DropShoulderPlan, gauge: ShapeGauge): number {
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
  const all = garmentSizes(options.kind, options.table);
  const ids = all.map((size) => size.id);
  const series = all.slice(ids.indexOf(options.from), ids.indexOf(options.to) + 1);
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
  for (const size of series) {
    let plan: HatPlan | DropShoulderPlan | string;
    let estimated: readonly string[] = [];
    if (options.kind === 'hat') {
      const measures = hatMeasures(size.id, options.easeCm, options.hemCm)!;
      plan = hatPlan(measures, gauge);
    } else {
      const graded = dropShoulderMeasures(BODY_TABLES[options.table], size.id, options);
      if (typeof graded === 'string') return fail(graded);
      estimated = graded.estimated;
      const previous = sizes.at(-1)?.plan;
      plan = dropShoulderPlan(graded.measures, gauge, start, options.repeat, previous?.kind === 'drop-shoulder' ? previous.neck.stitches : 0);
    }
    if (typeof plan === 'string') return fail(series.length > 1 ? `${size.name} méret: ${plan}` : plan);
    const areaCm2 = areaOf(plan, gauge);
    const yarn =
      missing.length === 0 && massPerArea !== null && ballLength !== null && profile?.yarn.ballMassG
        ? yarnFromMassPerArea(measured(massPerArea), areaCm2, { lengthM: ballLength, massG: profile.yarn.ballMassG })
        : null;
    sizes.push({
      id: size.id,
      name: size.name,
      plan,
      flags: flags.filter((flag) => flag.size === size.id),
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
      if (i > 0 && value < values[key]![i - 1]!) monotonic.push({ key, label, size: sizes[i]!.name });
    });
  }
  const checks = sizes.flatMap((size) => size.plan.checks);

  return {
    ok: true,
    plan: {
      kind: options.kind,
      table: options.kind === 'hat' ? 'hat' : options.table,
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
export function dropShoulderJoins(plan: DropShoulderPlan): PieceJoin[] {
  const { stitches, rows, sideRows, armholeRows } = plan.panel;
  const { shoulder } = plan.neck;
  const { top, rows: sleeveRows } = plan.sleeve;
  const half = top / 2;
  const sleeve = (piece: string, backSide: 'left' | 'right', frontSide: 'left' | 'right'): PieceJoin[] => [
    seam(stitchEdge(piece, sleeveRows, 0, half), half, rowsEdge('p1', sideRows + 1, rows, backSide), armholeRows),
    seam(stitchEdge(piece, sleeveRows, half, half), half, rowsEdge('p2', sideRows + 1, rows, frontSide), armholeRows),
    { a: rowsEdge(piece, 1, sleeveRows, 'left'), b: rowsEdge(piece, 1, sleeveRows, 'right') },
  ];
  return [
    { a: stitchEdge('p1', rows, 0, shoulder), b: stitchEdge('p2', rows, stitches - shoulder, shoulder) },
    { a: stitchEdge('p1', rows, stitches - shoulder, shoulder), b: stitchEdge('p2', rows, 0, shoulder) },
    { a: rowsEdge('p1', 1, sideRows, 'left'), b: rowsEdge('p2', 1, sideRows, 'right') },
    { a: rowsEdge('p1', 1, sideRows, 'right'), b: rowsEdge('p2', 1, sideRows, 'left') },
    ...sleeve('p3', 'left', 'right'),
    ...sleeve('p4', 'right', 'left'),
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
  if (size.plan.kind === 'hat') {
    base = { ...base, conventions: { ...base.conventions, roundEnd: 'join-slip' } };
    const motif = { ...DEFAULT_MOTIF, shape: 'circle' as const, stitch: options.stitch, start: 'magic-ring' as const, closing: 'join-slip' as const };
    const piece = plannedRounds(base, motif, size.plan.layout, name);
    if (typeof piece === 'string') return fail(piece);
    result = { ...base, pieces: [piece], garment };
  } else {
    const shoulderPlan = size.plan;
    const total = 2 * shoulderPlan.panel.stitches * shoulderPlan.panel.rows + 2 * shoulderPlan.sleeve.rows * shoulderPlan.sleeve.top;
    if (total > MAX_GARMENT_TOTAL) {
      return fail(`A pulóverben legfeljebb ${MAX_GARMENT_TOTAL.toLocaleString('hu')} szem lehet: válassz kisebb méretet vagy vastagabb fonalat.`);
    }
    const panelCounts = Array<number>(shoulderPlan.panel.rows).fill(shoulderPlan.panel.stitches);
    const flat = panelCounts.map(() => ({ start: 0, end: 0 }));
    const sleeve = sleeveRowsOf(shoulderPlan);
    const pieces = [
      plannedRows(base, options.stitch, panelCounts, flat, PIECE_NAMES.back, 'p1'),
      plannedRows(base, options.stitch, panelCounts, flat, PIECE_NAMES.front, 'p2'),
      plannedRows(base, options.stitch, sleeve.counts, sleeve.shaping, PIECE_NAMES.leftSleeve, 'p3'),
      // A jobb ujj a bal tükörképe (05 §4.5): a sor eleje és vége felcserélődik.
      plannedRows(base, options.stitch, sleeve.counts, mirrorShaping(sleeve.shaping), PIECE_NAMES.rightSleeve, 'p4'),
    ];
    const problem = pieces.find((piece) => typeof piece === 'string');
    if (typeof problem === 'string') return fail(problem);
    result = { ...base, pieces: pieces.filter((piece) => typeof piece !== 'string'), joins: dropShoulderJoins(shoulderPlan), garment };
  }

  result = withGeneratedTitle(result, pattern, name, GENERATED_NAMES);
  const errors = validatePattern(result, libraryFor(result)).filter((finding) => finding.severity === 'error');
  if (errors.length > 0) return fail(`A generált minta nem ment át az ellenőrzőn (${errors[0]!.rule}): ez a program hibája, kérlek, jelezd.`);
  return { ok: true, pattern: result, plan };
}
