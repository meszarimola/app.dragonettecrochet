/*
 * A jobb oldali generátorpanelek szövegei (PQW-900): a választólisták
 * feliratai, a mezőfeliratok, a tervek kiírása, a figyelmeztetések és az
 * állapotsor üzenetei a létrehozás után.
 *
 * Területenként csoportosítva: `shape` (Forma), `shawl` (Kendő), `round` (Kör
 * és motívum), `amigurumi`, `grid` (Rácsminta), `garment` (Ruhadarab).
 *
 * Amit NEM fordítunk:
 * - a szemnevek: azok a minta jelöléséből jönnek (PQW-868,
 *   `stitchById(...).terms`), nem a felület nyelvéből. A mondatok ezért a
 *   szemnevet paraméterként kapják;
 * - a mértékegységek (cm, g, m, mm, °) és a számalak: mindkét nyelven a maiak
 *   (`formatNumber`, magyar tizedesvessző).
 *
 * A magyar ág betűre a mai szöveg: a böngészős és a Node tesztek erre néznek.
 * A paraméteres mondatok függvények, a fix szövegek sztringek; a két nyelv
 * kulcskészlete, fajtája és paraméterszáma azonos (tests/ui-i18n.test.mjs),
 * ezért az egyik nyelven nem használt paraméter neve aláhúzással kezdődik.
 *
 * A magyar nyelvtani segédek (névelő, toldalékolás) csak a magyar ágon élnek.
 * DOM nélküli, ezért a Node is futtatja, és a magot `.ts` kiterjesztéssel
 * importálja.
 */

import { article } from '../../core/hungarian.ts';
import type { BodyTableId, FitLevel } from '../../core/body-sizes.ts';
import type { JoinMethod } from '../../core/amigurumi-generator.ts';
import type { Curvature } from '../../core/amigurumi.ts';
import type { JogFix, MotifShape, RoundClosing, RoundStart } from '../../core/round-generator.ts';
import type { FlatShape, RepeatRounding, ShapeMeasure } from '../../core/shapes.ts';
import type { ShawlKind } from '../../core/shawls.ts';
import type { GarmentKind, GridTechnique, PieceEnd, ShapeSpec, SphereMethod } from '../../core/types.ts';
import type { Dictionary } from '../i18n.ts';

/** Az amigurumi formái; a „forgástest” a profilból készül. */
type ShapeKind = ShapeSpec['kind'];

export interface PanelTexts {
  readonly shape: {
    readonly names: Readonly<Record<FlatShape, string>>;
    readonly measures: Readonly<Record<ShapeMeasure, string>>;
    readonly roundings: Readonly<Record<RepeatRounding, string>>;
    /** A sorvégre jutó szegélyszem választása: „2 rp”. */
    readonly rowEndStitches: (count: number) => string;
    readonly widthLabels: {
      readonly rectangle: string;
      readonly diamond: string;
      readonly other: string;
    };
    readonly actualSize: (approx: string, width: string, height: string, rows: number) => string;
    readonly perRow: (stitches: number) => string;
    readonly diamondRows: (first: number, widest: number, last: number) => string;
    readonly bottomTop: (first: number, bottomCm: string, last: number, topCm: string, approx: string) => string;
    readonly repeat: (width: number, edge: number, repeats: number) => string;
    readonly edgeAngle: (angle: string, apex: string) => string;
    readonly apexAngle: (angle: string) => string;
    readonly evenShaping: string;
    readonly chainExtension: (rows: readonly number[]) => string;
    readonly unworkedRows: (rows: readonly number[]) => string;
    readonly border: (total: number, corner: number, perRow: number, extras: string, approx: string, width: string, height: string) => string;
    readonly borderExposed: (count: number) => string;
    readonly borderRepeat: (width: number, edge: number) => string;
    readonly gaugeMeasured: (stitch: string, basis: string) => string;
    readonly gaugeFromLabel: string;
    readonly gaugeFromRows: string;
    readonly gaugeProfileStitch: (stitch: string) => string;
    readonly gaugeOtherForm: string;
    readonly gaugeHookProfile: (hookMm: string) => string;
    readonly gaugeHookNoProfile: (hookMm: string) => string;
    readonly generated: (name: string, rows: number, withBorder: boolean) => string;
  };
  readonly shawl: {
    readonly names: Readonly<Record<ShawlKind, string>>;
    readonly rates: { readonly theory: string; readonly custom: string };
    readonly sizeLabels: {
      readonly spine: string;
      readonly straightEdge: string;
      readonly width: string;
      readonly radius: string;
    };
    readonly rateLabels: Readonly<Record<ShawlKind, string>>;
    readonly edgingWhat: { readonly round: string; readonly row: string; readonly lastRow: string };
    readonly edgingLabel: (what: string, symmetric: boolean) => string;
    readonly blockedName: string;
    readonly unblockedName: string;
    readonly roundNoun: string;
    readonly rowNoun: string;
    readonly diameterSize: (width: string) => string;
    readonly boxSize: (width: string, depth: string) => string;
    readonly sizeLine: (measuredName: string, approx: string, measured: string, otherName: string, other: string, rows: number, noun: string) => string;
    readonly firstLast: (noun: string, first: number, last: number) => string;
    readonly triangleRate: (theory: string, chosen: string, edge: string, spine: string) => string;
    readonly crescentRate: (theory: string, chosen: string) => string;
    readonly asymmetricRate: (theory: string, chosen: string) => string;
    readonly semicircleRate: (theory: string, chosen: string) => string;
    readonly circleRate: (theory: string, chosen: string) => string;
    readonly piDoubling: (rounds: readonly number[]) => string;
    readonly stoleNote: string;
    readonly neckAngle: (neck: string, tip: string) => string;
    readonly edgeAngle: (angle: string) => string;
    readonly wings: (row: number) => string;
    readonly ratio: (worked: string, min: string, max: string) => string;
    readonly ratioRounds: string;
    readonly ratioRows: string;
    readonly edging: (width: number, edge: number, symmetric: boolean, repeats: number, change: string) => string;
    readonly edgingNoChange: string;
    readonly edgingChange: (sign: string, count: number, symmetric: boolean) => string;
    readonly warningNote: string;
    readonly cupping: (percent: string, limit: string, note: string) => string;
    readonly ruffling: (percent: string, limit: string, note: string) => string;
    readonly narrow: (percent: string, note: string) => string;
    readonly wide: (percent: string, note: string) => string;
    readonly piBlocking: (percent: string, note: string) => string;
    readonly gaugeMeasured: (stitch: string, basis: string) => string;
    readonly gaugeFromLabel: string;
    readonly gaugeForm: (form: string) => string;
    readonly formRounds: string;
    readonly formRows: string;
    readonly gaugeProfileStitch: (form: string) => string;
    readonly gaugeOtherForm: (form: string) => string;
    readonly gaugeHookProfile: (hookMm: string) => string;
    readonly gaugeHookNoProfile: (hookMm: string) => string;
    readonly blockedState: string;
    readonly unblockedState: string;
    readonly generated: (name: string, rows: number, noun: string) => string;
  };
  readonly round: {
    readonly names: Readonly<Record<MotifShape, string>>;
    readonly starts: Readonly<Record<RoundStart, string>>;
    readonly closings: Readonly<Record<RoundClosing, string>>;
    readonly jogs: Readonly<Record<JogFix | 'none', string>>;
    readonly granny: string;
    readonly circleIncreases: (count: number, aspect: string, exact: string) => string;
    readonly polygonIncreases: (exact: string, corners: number, aspect: string) => string;
    readonly estimated: (stitch: string) => string;
    readonly fromLabel: string;
    readonly fromMeasured: string;
    readonly sameStitch: (stitch: string, measured: string) => string;
    readonly convertedStitch: (from: string, measured: string, stitch: string) => string;
    readonly generated: (name: string, rounds: number) => string;
  };
  readonly amigurumi: {
    readonly names: Readonly<Record<ShapeKind, string>>;
    readonly revolution: string;
    readonly methods: Readonly<Record<SphereMethod, string>>;
    readonly bottoms: Readonly<Record<PieceEnd, string>>;
    readonly tops: Readonly<Record<PieceEnd, string>>;
    readonly joins: Readonly<Record<JoinMethod, string>>;
    readonly curvatures: Readonly<Record<Curvature, string>>;
    readonly profileLine: (line: number) => string;
    readonly coneIncreases: string;
    readonly ovalMeasures: (length: string, width: string, chains: number) => string;
    readonly shapeMeasures: (width: string, height: string) => string;
    readonly counts: (rounds: number, stitches: number, measures: string) => string;
    readonly curvatureRun: (from: number, to: number, curvature: string) => string;
    readonly curvatureLine: (runs: string) => string;
    readonly backLoop: (rounds: readonly number[]) => string;
    readonly openStart: string;
    readonly density: (stitches: string, rounds: string) => string;
    readonly gaugeEstimated: (density: string) => string;
    readonly gaugeMeasured: (basis: string, density: string) => string;
    readonly gaugeFromLabel: string;
    readonly gaugeFromRounds: string;
    readonly flatOval: (length: string, width: string) => string;
    readonly partMeasures: (width: string, height: string) => string;
    readonly part: (name: string, measures: string) => string;
    readonly continuedPart: (name: string, measures: string) => string;
    readonly figure: (parts: string, height: string, width: string) => string;
    readonly safety: string;
    readonly created: (name: string) => string;
    readonly added: (name: string, join: JoinMethod) => string;
  };
  readonly grid: {
    readonly techniques: Readonly<Record<GridTechnique, string>>;
    readonly mosaicRows: { readonly one: string; readonly two: string };
    readonly colors: {
      readonly natural: string;
      readonly burgundy: string;
      readonly blue: string;
      readonly green: string;
      readonly mustard: string;
      readonly black: string;
      readonly rose: string;
      readonly brown: string;
      readonly numbered: (index: number) => string;
    };
    readonly brushes: {
      readonly unset: string;
      readonly filled: string;
      readonly open: string;
      readonly none: string;
      readonly color: (letter: string, name: string) => string;
    };
    readonly values: {
      readonly unset: string;
      readonly filled: string;
      readonly open: string;
      readonly none: string;
      readonly unknown: string;
      readonly color: (letter: string, name: string) => string;
    };
    readonly cellLabel: (row: number, cell: number, value: string) => string;
    readonly inUnit: string;
    readonly unitFrom: (row: number, cell: number) => string;
    readonly manualUnit: (width: number, height: number, from: string, note: string) => string;
    readonly unitConflicts: (count: number) => string;
    readonly allCellsSet: string;
    readonly detectedUnit: (width: number, height: number) => string;
    readonly missingCells: string;
    readonly unitDetail: (width: number, height: number, gridWidth: number, gridHeight: number) => string;
    readonly actualSize: (approx: string, width: string, height: string, rows: number) => string;
    readonly c2cSize: (approx: string, width: string, height: string, rows: number, tiles: number) => string;
    readonly mosaicSize: (approx: string, width: string, height: string, rows: number, gridRows: number) => string;
    readonly colorworkSize: (approx: string, width: string, height: string, rows: number) => string;
    readonly filetPositions: (cells: number, positions: number) => string;
    readonly filetFoundation: (chains: number, fromHook: number) => string;
    readonly foundation: (chains: number, fromHook: number) => string;
    readonly openStartRows: (rows: readonly number[]) => string;
    readonly addedRows: (rows: readonly number[]) => string;
    readonly leftRows: (rows: readonly number[]) => string;
    readonly removedRows: (rows: readonly number[]) => string;
    readonly extendedRows: (rows: readonly number[]) => string;
    readonly allIncrease: string;
    readonly increaseUntil: (row: number) => string;
    readonly tilesPerColor: (counts: string) => string;
    readonly stitchesPerColor: (counts: string) => string;
    readonly tileUnit: string;
    readonly stitchUnit: string;
    readonly perColor: (letter: string, count: number) => string;
    readonly mosaicDepthDc: string;
    readonly mosaicDepthTr: string;
    readonly mosaicVariantOne: string;
    readonly mosaicVariantTwo: string;
    readonly mosaic: (variant: string, long: string, drops: number) => string;
    readonly mosaicRow: (stitches: number, chains: number, fromHook: number) => string;
    readonly colorworkRow: (stitches: number, chains: number, fromHook: number) => string;
    readonly tapestryCarry: (rows: readonly number[]) => string;
    readonly squareMotif: (rows: number, cells: number, actual: number) => string;
    readonly sourceEstimated: string;
    readonly sourceMeasured: string;
    readonly yarnMissing: string;
    readonly yarnRange: (value: string, low: string, high: string) => string;
    readonly yarnExact: (value: string) => string;
    readonly yarnTotal: (meters: string) => string;
    readonly yarnColor: (letter: string, name: string, meters: string) => string;
    readonly yarnTapestry: string;
    readonly generated: (technique: string, rows: number) => string;
    readonly imageLoaded: (width: number, height: number) => string;
    readonly imageFailed: string;
    readonly filledFromUnit: string;
    readonly loadedFromPattern: string;
    readonly brushLegend: string;
    readonly colorSwatchLabel: (letter: string) => string;
    readonly colorNameLabel: (letter: string) => string;
    readonly colorRemoveLabel: (letter: string) => string;
    readonly colorFallback: (letter: string) => string;
    readonly remove: string;
    readonly cellRatio: (width: string, height: string) => string;
  };
  readonly garment: {
    readonly names: Readonly<Record<GarmentKind, string>>;
    readonly tables: Readonly<Record<BodyTableId, string>>;
    readonly fits: Readonly<Record<FitLevel, string>>;
    readonly easeLabels: { readonly hat: string; readonly sweater: string };
    readonly hemLabels: { readonly hat: string; readonly sweater: string };
    readonly easeHat: (small: string, large: string, limitCm: number, limit: number) => string;
    readonly easeSweater: (from: number, to: number, limit: number) => string;
    readonly hatSize: (name: string, approx: string, circumference: string, height: string, rounds: number) => string;
    readonly sweaterSize: (name: string, approx: string, chest: string, length: string, sleeve: string) => string;
    readonly yarnMissing: string;
    readonly yarn: (meters: number, balls: number) => string;
    readonly prefix: (name: string) => string;
    readonly failedCheck: (prefix: string, label: string) => string;
    readonly allChecks: (passed: number, total: number, sizes: string) => string;
    readonly checkSizes: (count: number) => string;
    readonly someChecks: (passed: number, total: number) => string;
    readonly warning: (prefix: string, warning: string) => string;
    readonly estimatedSize: (name: string, missing: readonly string[]) => string;
    readonly flag: (name: string, note: string) => string;
    readonly monotonic: (label: string, size: string) => string;
    readonly hatHead: (head: string, ease: string, percent: number, hat: string, stitches: number) => string;
    readonly hatCrown: (rounds: number, increases: number, exact: string) => string;
    readonly hatSide: (rounds: number, brim: string) => string;
    readonly hatBrim: (rounds: number) => string;
    readonly panel: (stitches: number, repeats: string, rows: number, hemRows: number, foundation: number, armholeRows: number) => string;
    readonly panelRepeats: (repeats: number) => string;
    readonly shoulder: (shoulder: number, stitches: number) => string;
    readonly neck: (center: number, first: number, later: number, back: number) => string;
    readonly sleeve: (cuff: number, top: number, rows: number, increases: number, first: string) => string;
    readonly sleeveFirst: (row: number) => string;
    readonly ease: (ease: string, fit: string, note: string) => string;
    readonly easeNote: (from: number, to: number) => string;
    readonly upperArm: (ease: string) => string;
    readonly shoulderDrop: (drop: string) => string;
    readonly body: (bust: string) => string;
    readonly formRounds: string;
    readonly formRows: string;
    readonly gaugeMeasured: (stitch: string, basis: string) => string;
    readonly gaugeFromLabel: string;
    readonly gaugeMeasuredIn: (form: string) => string;
    readonly gaugeProfileStitch: (form: string) => string;
    readonly gaugeOtherForm: (form: string) => string;
    readonly gaugeHookProfile: (hookMm: string) => string;
    readonly gaugeHookNoProfile: (hookMm: string) => string;
    readonly lengthNote: string;
    readonly generated: (name: string, size: string, series: string) => string;
    readonly generatedSeries: (count: number) => string;
  };
}

/* ---- Magyar nyelvtani segédek: csak a magyar ágon ---- */

const huCapitalize = (text: string): string => text.charAt(0).toLocaleUpperCase('hu') + text.slice(1);

/** A határozott névelő egy szó előtt: „a félpálca”, „az egyráhajtásos pálca”. */
const huArticle = (word: string): string => `${/^[aáeéiíoóöőuúüű]/i.test(word) ? 'az' : 'a'} ${word}`;

/** „a 3., 5. és 7. sor”; hatnál több sornál az első hat. */
function huRowList(rows: readonly number[]): string {
  const shown = rows.slice(0, 6).map((row) => `${row}.`);
  const list = shown.length === 1 ? shown[0]! : `${shown.slice(0, -1).join(', ')} és ${shown.at(-1)!}`;
  return `${article(rows[0]!)} ${list}${rows.length > shown.length ? ' és további' : ''} sor`;
}

/* ---- Angol segédek ---- */

const enCapitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** „rows 3, 5 and 7”, „row 3”; hatnál több sornál az első hat. */
function enRowList(rows: readonly number[]): string {
  const shown = rows.slice(0, 6).map((row) => `${row}`);
  const list = shown.length === 1 ? shown[0]! : `${shown.slice(0, -1).join(', ')} and ${shown.at(-1)!}`;
  const more = rows.length > shown.length;
  return `${shown.length === 1 && !more ? 'row' : 'rows'} ${list}${more ? ' and more' : ''}`;
}

const hu: PanelTexts = {
  shape: {
    names: {
      rectangle: 'Téglalap',
      'right-triangle': 'Derékszögű háromszög',
      'isosceles-triangle': 'Egyenlő szárú háromszög',
      trapezoid: 'Trapéz',
      diamond: 'Rombusz',
    },
    measures: { height: 'Magasság', angle: 'Az él szöge' },
    roundings: { nearest: 'A legközelebbi többszörösre', up: 'Felfelé: bővebb', down: 'Lefelé: szűkebb' },
    rowEndStitches: (count) => `${count} rp`,
    widthLabels: { rectangle: 'Szélesség, cm', diamond: 'Legszélesebb sor, cm', other: 'Alsó él, cm' },
    actualSize: (approx, width, height, rows) => `Tényleges méret: ${approx}${width} × ${height} cm, ${rows} sor.`,
    perRow: (stitches) => `Soronként ${stitches} szem.`,
    diamondRows: (first, widest, last) => `${first} szemről a legszélesebb sorig ${widest} szemre, onnan vissza ${last} szemre.`,
    bottomTop: (first, bottomCm, last, topCm, approx) =>
      `Az alsó sor ${first} szem (${approx}${bottomCm} cm), a felső ${last} szem (${approx}${topCm} cm).`,
    repeat: (width, edge, repeats) => `Mintaismétlés: ${width} többszöröse + ${edge}, ${repeats} ismétlés.`,
    edgeAngle: (angle, apex) => `Az él szöge a függőlegestől kb. ${angle}°${apex}.`,
    apexAngle: (angle) => `, a csúcsszög kb. ${angle}°`,
    evenShaping: 'A szaporítás és a fogyasztás egyenletesen elosztva, élenként soronként legfeljebb 2 egy szembe.',
    chainExtension: (rows) => `Láncos hosszabbítás ${huRowList(rows)} végén.`,
    unworkedRows: (rows) => `Meghagyott szemek ${huRowList(rows)} végén: lépcsős él.`,
    border: (total, corner, perRow, extras, approx, width, height) =>
      `Szegély: ${total} rp körben, sarkonként ${corner}, sorvégenként ${perRow}${extras}; ` +
      `a szegéllyel ${approx}${width} × ${height} cm. A diagramon, a rácson és a kész méretben is látszik.`,
    borderExposed: (count) => `a lépcsők meghagyott szemeibe ${count}`,
    borderRepeat: (width, edge) => `élenként ${width} többszöröse + ${edge}`,
    gaugeMeasured: (stitch, basis) => `${huCapitalize(huArticle(stitch))} ${basis} mintasűrűségéből.`,
    gaugeFromLabel: 'címkén megadott',
    gaugeFromRows: 'síkban mért',
    gaugeProfileStitch: (stitch) =>
      `Becslés: a profil más szemének síkban mért mintasűrűségéből átszámolva. Pontosabb, ha ${huArticle(stitch)} mintasűrűségét is megadod a Méret és fonal szakaszban.`,
    gaugeOtherForm: 'Becslés: a körben mért mintasűrűségből átszámolva. Pontosabb, ha síkban is mérsz, és a Méret és fonal szakaszban megadod.',
    gaugeHookProfile: (hookMm) => `Becslés a profil ${hookMm} mm-es tűjéből, mert nincs mért mintasűrűség. Pontosabb, ha a Méret és fonal szakaszban megadod.`,
    gaugeHookNoProfile: (hookMm) =>
      `Nincs profil: a méret becslés ${hookMm} mm-es tűből. Pontosabb, ha próbadarabot mérsz, és a Méret és fonal szakaszban profilként megadod.`,
    generated: (name, rows, withBorder) => `${name}, ${rows} ${withBorder ? 'sor és szegély' : 'sor'} elkészült; visszavonással a korábbi minta visszajön.`,
  },
  shawl: {
    names: {
      triangle: 'Fentről induló háromszög',
      'asymmetric-triangle': 'Aszimmetrikus háromszög',
      crescent: 'Félhold',
      semicircle: 'Félkör',
      circle: 'Kör',
      pi: 'Pi-kendő',
      'shifted-pi': 'Eltolt Pi-kendő',
      stole: 'Téglalap stóla',
    },
    rates: { theory: 'Elméleti, a mintasűrűségből', custom: 'Saját arány' },
    sizeLabels: { spine: 'Mélység a gerincen, cm', straightEdge: 'Az egyenes él, cm', width: 'Szélesség, cm', radius: 'Sugár, cm' },
    rateLabels: {
      triangle: 'Szaporítás soronként, az egész sorra',
      'asymmetric-triangle': 'Szaporítás soronként a ferde élen',
      crescent: 'Szaporítás soronként, élenként',
      semicircle: 'Szaporítás soronként',
      circle: 'Szaporítás körönként',
      pi: 'Szem az 1. körben',
      'shifted-pi': 'Szem az 1. körben',
      stole: 'Szem az 1. körben',
    },
    edgingWhat: { round: 'Az utolsó kör', row: 'A sor', lastRow: 'Az utolsó sor' },
    edgingLabel: (what, symmetric) => `${what} a szegély ismétléséhez: „X többszöröse + Y”${symmetric ? ', félenként' : ''}`,
    blockedName: 'blokkolva',
    unblockedName: 'blokkolás nélkül',
    roundNoun: 'kör',
    rowNoun: 'sor',
    diameterSize: (width) => `${width} cm átmérő`,
    boxSize: (width, depth) => `${width} × ${depth} cm`,
    sizeLine: (measuredName, approx, measured, otherName, other, rows, noun) =>
      `${huCapitalize(measuredName)} ${approx}${measured}, ${otherName} ≈ ${other}; ${rows} ${noun}.`,
    firstLast: (noun, first, last) => `Az 1. ${noun} ${first} szem, az utolsó ${last} szem.`,
    triangleRate: (theory, chosen, edge, spine) =>
      `Szaporítás soronként: elméletileg ${theory} (4 · h/w), választva ${chosen}; élenként átlagosan ${edge}, a gerincen ${spine}, mindig párban.`,
    crescentRate: (theory, chosen) => `Szaporítás soronként élenként: elméletileg ${theory} (2 · h/w), választva ${chosen}; a gerincen nincs.`,
    asymmetricRate: (theory, chosen) => `Szaporítás soronként a ferde élen: 45°-hoz ${theory} (h/w), választva ${chosen}.`,
    semicircleRate: (theory, chosen) => `Szaporítás soronként egyenletesen elosztva: elméletileg ${theory} (π · h/w), választva ${chosen}.`,
    circleRate: (theory, chosen) => `Szaporítás körönként, eltolva: elméletileg ${theory} (2π · h/w), választva ${chosen}.`,
    piDoubling: (rounds) => {
      const list = rounds.map((round) => `${round}.`);
      return `Duplázás ${article(rounds[0]!)} ${list.join(', ')} körben, közte sima körök.`;
    },
    stoleNote: 'Alakítás nélkül, soronként ugyanannyi szem.',
    neckAngle: (neck, tip) => `A nyakél szöge kb. ${neck}° (egyenes nyakélnél 180°), az alsó csúcsé kb. ${tip}°.`,
    edgeAngle: (angle) => `A ferde él szöge a sorhoz kb. ${angle}°.`,
    wings: (row) => `Szárnyak: ${article(row)} ${row}. sortól a széleken dupla szaporítás.`,
    ratio: (worked, min, max) => `${worked} szemszáma az ideálishoz képest ${min}–${max}%.`,
    ratioRounds: 'A körök',
    ratioRows: 'A sorok',
    edging: (width, edge, symmetric, repeats, change) =>
      `Szegélyhez: ${width} többszöröse + ${edge}${symmetric ? ' félenként' : ''}, ${repeats} ismétlés (${change}).`,
    edgingNoChange: 'változtatás nélkül',
    edgingChange: (sign, count, symmetric) => `${sign}${count} szem${symmetric ? ' félenként' : ''}`,
    warningNote: 'Ez figyelmeztetés, nem hiba.',
    cupping: (percent, limit, note) =>
      `Kunkorodhat: a szemszám az ideálisnak csak kb. ${percent}%-a (${limit}%-nál nagyobb eltérés). ${note} Blokkolással sokszor kisimítható, vagy válassz több szaporítást.`,
    ruffling: (percent, limit, note) =>
      `Fodrosodhat: a szemszám az ideális kb. ${percent}%-a (${limit}%-nál nagyobb eltérés). ${note} Válassz kevesebb szaporítást, ha lapos darabot szeretnél.`,
    narrow: (percent, note) =>
      `A választott szaporítás az elméletinek kb. ${percent}%-a: a kendő mélyebb és keskenyebb lesz, a nyakél lefelé hajlik. ${note} Sok kiadott minta blokkolással nyújtja szélesre.`,
    wide: (percent, note) =>
      `A választott szaporítás az elméletinek kb. ${percent}%-a: a kendő laposabb és szélesebb lesz, a nyakél felfelé ível, a szél fodrosodhat. ${note}`,
    piBlocking: (percent, note) =>
      `A duplázás előtti körben a szemszám az ideálisnak csak kb. ${percent}%-a: tömör szemmel kunkorodik, ezért blokkolt csipkénél működik jól. ${note}`,
    gaugeMeasured: (stitch, basis) => `${huCapitalize(huArticle(stitch))} ${basis} mintasűrűségéből.`,
    gaugeFromLabel: 'címkén megadott',
    gaugeForm: (form) => `${form} mért`,
    formRounds: 'körben',
    formRows: 'síkban',
    gaugeProfileStitch: (form) => `Becslés: a profil más szemének ${form} mért mintasűrűségéből átszámolva.`,
    gaugeOtherForm: (form) => `Becslés: a ${form} mért mintasűrűségből átszámolva.`,
    gaugeHookProfile: (hookMm) => `Becslés a profil ${hookMm} mm-es tűjéből, mert nincs mért mintasűrűség.`,
    gaugeHookNoProfile: (hookMm) => `Nincs profil: a méret becslés ${hookMm} mm-es tűből. Pontosabb, ha a Méret és fonal szakaszban profilt adsz meg.`,
    blockedState: 'A profil blokkolva mért: a blokkolás nélküli méret a megadott nyúlással becsült.',
    unblockedState: 'A mintasűrűség blokkolás nélküli: a blokkolt méret a megadott nyúlással becsült. Csipkénél blokkolt próbadarabot mérj.',
    generated: (name, rows, noun) => `${name}, ${rows} ${noun} elkészült; visszavonással a korábbi minta visszajön.`,
  },
  round: {
    names: {
      circle: 'Lapos kör',
      square: 'Négyzet',
      hexagon: 'Hatszög',
      octagon: 'Nyolcszög',
      'granny-square': 'Nagymama-négyzet',
    },
    starts: {
      'magic-ring': 'Varázskör',
      'chain-ring': 'Láncgyűrű',
      chain: 'Láncszembe (pl. 2 lsz, 6 rp a 2. láncszembe)',
    },
    closings: { 'join-slip': 'Zárt kör: kúszószem és kezdőlánc', spiral: 'Spirál körjelölővel' },
    jogs: {
      none: 'Nincs',
      'slip-stitch': 'Kúszószem az első szem helyett',
      'back-loop': 'Új szín az első szem hátsó szálába',
    },
    granny: 'Sarkonként 3 erp, 2 lsz, 3 erp, oldalanként 3 erp, 1 lsz: a sarkok egymás fölé kerülnek.',
    circleIncreases: (count, aspect, exact) => `Körönként ${count} szaporítás: 2π × ${aspect} ≈ ${exact}, páros számra kerekítve.`,
    polygonIncreases: (exact, corners, aspect) =>
      `Körönként kb. ${exact} szaporítás a ${corners} sarokban, egymás fölé kerülve (2 · ${corners} · tg(π/${corners}) × ${aspect}).`,
    estimated: (stitch) =>
      `Becslés ${huArticle(stitch)} szokásos körös magasság/szélesség arányából. Pontosabb, ha a Méret és fonal szakaszban megadod a körben mért mintasűrűséget.`,
    fromLabel: 'a címkén megadott körös mintasűrűségéből',
    fromMeasured: 'körben mért mintasűrűségéből',
    sameStitch: (stitch, measured) => `${huCapitalize(huArticle(stitch))} ${measured}.`,
    convertedStitch: (from, measured, stitch) => `${huCapitalize(huArticle(from))} ${measured}, ${huArticle(stitch)} arányára átszámolva.`,
    generated: (name, rounds) => `${name}, ${rounds} kör elkészült; visszavonással a korábbi minta visszajön.`,
  },
  amigurumi: {
    names: {
      sphere: 'Gömb',
      hemisphere: 'Félgömb',
      egg: 'Tojás',
      cylinder: 'Henger',
      cone: 'Kúp',
      revolution: 'Forgástest',
      oval: 'Ovális',
    },
    revolution: 'Forgástest (profilból)',
    methods: { '6n': '6n: hatosával szaporítva, egyenes körökkel', sine: 'Szinuszos: a valódi gömbhöz közelebb' },
    bottoms: { closed: 'Zárt: varázskör, lapos alj', open: 'Nyitott: az előző rész szélébe horgolva' },
    tops: { closed: 'Zárt: összehúzva vagy lapos tetővel', open: 'Nyitott: varráshoz vagy folytatáshoz' },
    joins: { sewn: 'Varrva', continuous: 'Folytatólagosan' },
    curvatures: { flat: 'lapos', cupping: 'kunkorodó', tube: 'henger', ruffled: 'fodros', closing: 'fogyó (záródik)' },
    profileLine: (line) => `A profil ${line}. sorában két szám kell, szóközzel elválasztva: sugár és magasság cm-ben (pl. „2,5 4”).`,
    coneIncreases: 'A körönkénti szaporítás szám legyen, pl. 2,5, vagy hagyd üresen.',
    ovalMeasures: (length, width, chains) => `hossz kb. ${length} cm, szélesség kb. ${width} cm, ${chains} láncszemből`,
    shapeMeasures: (width, height) => `szélesség kb. ${width} cm, magasság kb. ${height} cm`,
    counts: (rounds, stitches, measures) => `${rounds} kör, legfeljebb ${stitches} szem; ${measures}.`,
    curvatureRun: (from, to, curvature) => `${from === to ? `${from}.` : `${from}–${to}.`} kör ${curvature}`,
    curvatureLine: (runs) => `Görbület: ${runs}.`,
    backLoop: (rounds) => `Hátsó szálba (éles törés): ${rounds.map((round) => `${round}.`).join(', ')} kör.`,
    openStart: 'Nyitott kezdés: csak folytatólagosan, egy előző rész nyitott végéhez kapcsolható.',
    density: (stitches, rounds) => `${stitches} szem és ${rounds} kör 10 cm-en`,
    gaugeEstimated: (density) =>
      `Becslés a tűből: ${density}. Amigurumihoz szoros horgolás kell, kb. két tűmérettel kisebb tűvel. Pontosabb, ha a Méret és fonal szakaszban megadod a rövidpálca körben mért mintasűrűségét.`,
    gaugeMeasured: (basis, density) => `${basis} mintasűrűségből: ${density}.`,
    gaugeFromLabel: 'A címkén megadott',
    gaugeFromRounds: 'A körben mért',
    flatOval: (length, width) => `${length} × ${width} cm, lapos`,
    partMeasures: (width, height) => `${width} × ${height} cm`,
    part: (name, measures) => `${name} (${measures})`,
    continuedPart: (name, measures) => `${name} folytatólagosan (${measures})`,
    figure: (parts, height, width) =>
      `A minta részei: ${parts}. A figura magassága kb. ${height} cm, szélessége kb. ${width} cm (becslés, kitömve).`,
    safety: '3 év alatti gyereknek szánt játékba nem kerülhet biztonsági szem vagy gyöngy: a minta hímzett szemet ír.',
    created: (name) => `${name} elkészült; visszavonással a korábbi minta visszajön.`,
    added: (name, join) => `${name} hozzáadva, ${join === 'sewn' ? 'varrva' : 'folytatólagosan'}; visszavonással a korábbi minta visszajön.`,
  },
  grid: {
    techniques: {
      filet: 'Filé',
      c2c: 'Sarokból sarokba (C2C)',
      tapestry: 'Tapestry',
      graphgan: 'Graphgan',
      mosaic: 'Mozaik',
    },
    mosaicRows: { one: 'Egysoros: rácssoronként egy sor', two: 'Kétsoros: rácssoronként két sor' },
    colors: {
      natural: 'Natúr',
      burgundy: 'Bordó',
      blue: 'Kék',
      green: 'Zöld',
      mustard: 'Mustár',
      black: 'Fekete',
      rose: 'Rózsa',
      brown: 'Barna',
      numbered: (index) => `${index}. szín`,
    },
    brushes: {
      unset: 'Törlés: az ismétlésből töltődik',
      filled: 'Teli cella',
      open: 'Nyitott cella',
      none: 'Nincs cella (alakítás)',
      color: (letter, name) => `${letter}: ${name}`,
    },
    values: {
      unset: 'nincs megadva',
      filled: 'teli',
      open: 'nyitott',
      none: 'nincs cella',
      unknown: 'ismeretlen',
      color: (letter, name) => `${letter} szín, ${name}`,
    },
    cellLabel: (row, cell, value) => `${row}. sor, ${cell}. cella: ${value}`,
    inUnit: ', ismétlő egység',
    unitFrom: (row, cell) => `${article(row)} ${row}. sor ${cell}. cellájától`,
    manualUnit: (width, height, from, note) => `Ismétlő egység, kézzel: ${width} × ${height} cella, ${from}.${note}`,
    unitConflicts: (count) => ` ${count} megadott cella eltér tőle (pl. szegély): ezek maradnak.`,
    allCellsSet:
      'Minden cella megadott. Elég az első sorokat teljesen megadni, a többinél a sor egy részét: a törölt cellákat a program az ismétlő egységből tölti ki.',
    detectedUnit: (width, height) => `Ismétlő egység, felismerve: ${width} × ${height} cella. A meg nem adott cellák ebből töltődnek ki.`,
    missingCells: 'Van meg nem adott cella: add meg, vagy jelöld meg az ismétlő egységet.',
    unitDetail: (width, height, gridWidth, gridHeight) =>
      `Ismétlő egység: ${width} × ${height} cella, a teljes ${gridWidth} × ${gridHeight} cellás rácsra kiterjesztve.`,
    actualSize: (approx, width, height, rows) => `Tényleges méret: ${approx}${width} × ${height} cm, ${rows} sor.`,
    c2cSize: (approx, width, height, rows, tiles) => `Tényleges méret: ${approx}${width} × ${height} cm, ${rows} átlós sor, ${tiles} csempe.`,
    mosaicSize: (approx, width, height, rows, gridRows) => `Tényleges méret: ${approx}${width} × ${height} cm, ${rows} sor (${gridRows} rácssor).`,
    colorworkSize: (approx, width, height, rows) => `Tényleges méret: ${approx}${width} × ${height} cm, ${rows} sor.`,
    filetPositions: (cells, positions) => `A legszélesebb sor ${cells} cella: 3 × ${cells} + 1 = ${positions} pozíció.`,
    filetFoundation: (chains, fromHook) => `Láncalap: ${chains} lsz; az első pálca a horogtól számított ${fromHook}. láncszembe megy.`,
    foundation: (chains, fromHook) => `Láncalap: ${chains} lsz; az első szem a horogtól számított ${fromHook}. láncszembe megy.`,
    openStartRows: (rows) => `Nyitott cellával kezdődik ${huRowList(rows)}: a fordulólánc után 2 lsz jön.`,
    addedRows: (rows) => `Szaporítás a sor elején ${huRowList(rows)} előtt: az előző sor végén láncos hosszabbítás.`,
    leftRows: (rows) => `Meghagyott cellák ${huRowList(rows)} végén.`,
    removedRows: (rows) => `Fogyasztás a sor elején ${huRowList(rows)}ban: kúszószemek a cellák fölött.`,
    extendedRows: (rows) => `Szaporítás a sor végén ${huRowList(rows)}ban: 2 lsz és háromráhajtásos pálca 2 sorral lejjebb.`,
    allIncrease: 'Minden sor szaporít.',
    increaseUntil: (row) => `Szaporítás az 1–${row}. sorig; utána az az oldal fogy, ahol a méret megvan, a másik még nő.`,
    tilesPerColor: (counts) => `Csempék színenként: ${counts}`,
    stitchesPerColor: (counts) => `Szemek színenként: ${counts}`,
    tileUnit: 'csempe',
    stitchUnit: 'szem',
    perColor: (letter, count) => `${letter}: ${count}`,
    mosaicDepthDc: 'egyráhajtásos pálca 2',
    mosaicDepthTr: 'kétráhajtásos pálca 3',
    mosaicVariantOne: 'Egysoros',
    mosaicVariantTwo: 'Kétsoros',
    mosaic: (variant, long, drops) => `${variant} mozaik: a lejjebb horgolt szem ${long} sorral lejjebb, összesen ${drops}.`,
    mosaicRow: (stitches, chains, fromHook) =>
      `Soronként ${stitches} szem. Láncalap: ${chains} lsz; az első szem a horogtól számított ${fromHook}. láncszembe megy.`,
    colorworkRow: (stitches, chains, fromHook) =>
      `Soronként ${stitches} rp. Láncalap: ${chains} lsz; az első szem a horogtól számított ${fromHook}. láncszembe megy.`,
    tapestryCarry: (rows) => `Tapestryben 3-nál több színt kell vinni ${huRowList(rows)}ban: ez haladó szint, a szövet merevebb lesz.`,
    squareMotif: (rows, cells, actual) => `Négyzet alakú motívumhoz ${rows} sor kell ${cells} cella szélességhez; most ${actual} sor.`,
    sourceEstimated:
      'A méret becslés a tűből: pontosabb, ha a Méret és fonal szakaszban mintasűrűséget adsz meg. A rács cellái is ebben az arányban látszanak.',
    sourceMeasured: 'A méret és a cellák aránya a megadott mintasűrűségből.',
    yarnMissing: 'Fonalbecsléshez add meg a Méret és fonal szakaszban a próbadarab méretét és tömegét, a fonal hosszát és a gombolyag tömegét.',
    yarnRange: (value, low, high) => `≈ ${value} m (${low}–${high} m)`,
    yarnExact: (value) => `${value} m`,
    yarnTotal: (meters) => `Fonal tartalékkal: ${meters}.`,
    yarnColor: (letter, name, meters) => `${letter} (${name}): ${meters}`,
    yarnTapestry: 'Tapestryben a szemekben vitt szál miatt több is kellhet: a tartomány felső széle ezzel számol.',
    generated: (technique, rows) => `${technique}: ${rows} sor elkészült; visszavonással a korábbi minta visszajön.`,
    imageLoaded: (width, height) => `A kép betöltve: ${width} × ${height} cella, a mintasűrűség arányában.`,
    imageFailed: 'A képet nem sikerült betölteni: PNG, JPEG, GIF vagy WebP fájlt válassz.',
    filledFromUnit: 'A meg nem adott cellák kitöltve az ismétlő egységből.',
    loadedFromPattern: 'A mostani minta rácsa betöltve a szerkesztőbe.',
    brushLegend: 'Ecset',
    colorSwatchLabel: (letter) => `${letter} szín színe`,
    colorNameLabel: (letter) => `${letter} szín neve`,
    colorRemoveLabel: (letter) => `${letter} szín törlése`,
    colorFallback: (letter) => `${letter} szín`,
    remove: 'Törlés',
    cellRatio: (width, height) =>
      `Egy cella ${width} × ${height} cm: a rács a mintasűrűség arányában látszik. Fent a legfelső sor, alul az 1. sor.`,
  },
  garment: {
    names: { hat: 'Sapka', 'drop-shoulder': 'Ledobott vállú pulóver' },
    tables: { women: 'Női', men: 'Férfi', child: 'Gyerek', baby: 'Baba' },
    fits: {
      'very-close': 'nagyon testhezálló',
      close: 'testhezálló',
      classic: 'klasszikus',
      loose: 'bő',
      oversized: 'túlméretes',
    },
    easeLabels: { hat: 'Bőség a fejkörfogathoz, cm', sweater: 'Bőség a mellbőséghez, cm' },
    hemLabels: { hat: 'Perem, cm', sweater: 'Szegély és mandzsetta, cm' },
    easeHat: (small, large, limitCm, limit) =>
      `Üresen a fejmérettől függ: ${limitCm} cm alatt ${small} cm, fölötte ${large} cm. Horgolt anyagnál a negatív bőség legfeljebb kb. ${limit}%.`,
    easeSweater: (from, to, limit) => `Ledobott vállnál ${from}–${to} cm bőség a szokásos. Horgolt anyagnál a negatív bőség legfeljebb kb. ${limit}%.`,
    hatSize: (name, approx, circumference, height, rounds) =>
      `${name}: kész körméret ${approx}${circumference} cm, magasság ${approx}${height} cm; ${rounds} kör.`,
    sweaterSize: (name, approx, chest, length, sleeve) =>
      `${name}: kész mellbőség ${approx}${chest} cm, hossz ${approx}${length} cm, ujjhossz ${approx}${sleeve} cm.`,
    yarnMissing: 'Fonalbecsléshez add meg a Méret és fonal szakaszban a próbadarab méretét és tömegét, a fonal hosszát és a gombolyag tömegét.',
    yarn: (meters, balls) => `Fonal tartalékkal: kb. ${meters} m, ${balls} gombolyag.`,
    prefix: (name) => `${name}: `,
    failedCheck: (prefix, label) => `${prefix}${label}: hamis.`,
    allChecks: (passed, total, sizes) => `Minden ellenőrzés igaz: ${passed}/${total}${sizes}.`,
    checkSizes: (count) => `, ${count} méret`,
    someChecks: (passed, total) => `${passed}/${total} ellenőrzés igaz; a hamisak lent.`,
    warning: (prefix, warning) => `${prefix}${warning}`,
    estimatedSize: (name, missing) => `${name}: a táblázatban nincs ${missing.join(' és ')}, ezért becsült.`,
    flag: (name, note) => `A táblázat gyanús adata (${name}): ${note}`,
    monotonic: (label, size) => `${huCapitalize(label)} ${huArticle(size)} méretnél kisebb, mint az előzőben.`,
    hatHead: (head, ease, percent, hat, stitches) =>
      `Fejkörfogat ${head} cm, bőség ${ease} cm (${percent}%): a sapka ${hat} cm, ${stitches} szem.`,
    hatCrown: (rounds, increases, exact) =>
      `Korona: ${rounds} kör, körönként ${increases} szaporítás (elméletileg ${exact}), az utolsó körben igazítva.`,
    hatSide: (rounds, brim) => `Oldal: ${rounds} kör egyenesen${brim}.`,
    hatBrim: (rounds) => `, ebből az utolsó ${rounds} kör a perem`,
    panel: (stitches, repeats, rows, hemRows, foundation, armholeRows) =>
      `Hátrész és elejerész: ${stitches} szem${repeats}, ${rows} sor, ebből ${hemRows} sor szegély; láncalap ${foundation} lsz. A karöltő az utolsó ${armholeRows} sor.`,
    panelRepeats: (repeats) => ` (${repeats} ismétlés)`,
    shoulder: (shoulder, stitches) => `Váll: szélenként ${shoulder} szem; a középső ${stitches} szem csónaknyakként nyitva marad.`,
    neck: (center, first, later, back) =>
      `Formázott nyak (még csak terv, a gráf csónaknyakkal készül): középen ${center} szem, oldalanként ${first} szem az első sorban, utána ${later} sorban 1-1; hátul középen ${back} szem.`,
    sleeve: (cuff, top, rows, increases, first) =>
      `Ujj: ${cuff} szemről ${top} szemre, ${rows} sor; ${increases} szaporítás mindkét szélen${first}.`,
    sleeveFirst: (row) => `, az elsővel ${huArticle(`${row}.`)} sorban`,
    ease: (ease, fit, note) => `Bőség: ${ease} cm (${fit})${note}.`,
    easeNote: (from, to) => `; ledobott vállnál ${from}–${to} cm a szokásos, ennyivel testhezállóbb`,
    upperArm: (ease) => `A felkaron ${ease} cm a bőség.`,
    shoulderDrop: (drop) => `A vállvarrás kb. ${drop} cm-rel lóg le a karra.`,
    body: (bust) => `Testméret: mellbőség ${bust} cm, a táblázat tartományának közepe.`,
    formRounds: 'körben',
    formRows: 'síkban',
    gaugeMeasured: (stitch, basis) => `${huCapitalize(huArticle(stitch))} ${basis} mintasűrűségéből.`,
    gaugeFromLabel: 'címkén megadott',
    gaugeMeasuredIn: (form) => `${form} mért`,
    gaugeProfileStitch: (form) => `Becslés: a profil más szemének ${form} mért mintasűrűségéből átszámolva.`,
    gaugeOtherForm: (form) => `Becslés: a ${form} mért mintasűrűségből átszámolva.`,
    gaugeHookProfile: (hookMm) => `Becslés a profil ${hookMm} mm-es tűjéből, mert nincs mért mintasűrűség.`,
    gaugeHookNoProfile: (hookMm) => `Nincs profil: a méret becslés ${hookMm} mm-es tűből. Pontosabb, ha a Méret és fonal szakaszban profilt adsz meg.`,
    lengthNote: 'A hosszt mosott, blokkolt és felakasztott próbadarabból érdemes mérni, mert a horgolt anyag hosszában nő.',
    generated: (name, size, series) => `${name}, ${size} méret${series} elkészült; visszavonással a korábbi minta visszajön.`,
    generatedSeries: (count) => ` (${count} méretes sorozattal)`,
  },
};

const en: PanelTexts = {
  shape: {
    names: {
      rectangle: 'Rectangle',
      'right-triangle': 'Right triangle',
      'isosceles-triangle': 'Isosceles triangle',
      trapezoid: 'Trapezoid',
      diamond: 'Rhombus',
    },
    measures: { height: 'Height', angle: 'Angle of the edge' },
    roundings: { nearest: 'To the nearest multiple', up: 'Up: wider', down: 'Down: narrower' },
    rowEndStitches: (count) => `${count} sc`,
    widthLabels: { rectangle: 'Width, cm', diamond: 'Widest row, cm', other: 'Bottom edge, cm' },
    actualSize: (approx, width, height, rows) => `Finished size: ${approx}${width} × ${height} cm, ${rows} rows.`,
    perRow: (stitches) => `${stitches} stitches per row.`,
    diamondRows: (first, widest, last) => `From ${first} stitches to ${widest} at the widest row, then back to ${last}.`,
    bottomTop: (first, bottomCm, last, topCm, approx) =>
      `The bottom row is ${first} stitches (${approx}${bottomCm} cm), the top ${last} stitches (${approx}${topCm} cm).`,
    repeat: (width, edge, repeats) => `Stitch repeat: a multiple of ${width} plus ${edge}, ${repeats} repeats.`,
    edgeAngle: (angle, apex) => `The edge is about ${angle}° from the vertical${apex}.`,
    apexAngle: (angle) => `, the apex angle about ${angle}°`,
    evenShaping: 'Increases and decreases spread evenly, at most 2 into one stitch per edge and row.',
    chainExtension: (rows) => `Chain extension at the end of ${enRowList(rows)}.`,
    unworkedRows: (rows) => `Stitches left unworked at the end of ${enRowList(rows)}: a stepped edge.`,
    border: (total, corner, perRow, extras, approx, width, height) =>
      `Border: ${total} sc around, ${corner} into each corner, ${perRow} per row end${extras}; ` +
      `with the border ${approx}${width} × ${height} cm. It shows on the chart, on the grid and in the finished size.`,
    borderExposed: (count) => `${count} into the stitches left by the steps`,
    borderRepeat: (width, edge) => `a multiple of ${width} plus ${edge} per edge`,
    gaugeMeasured: (stitch, basis) => `From the ${basis} gauge of ${stitch}.`,
    gaugeFromLabel: 'gauge given on the label',
    gaugeFromRows: 'gauge measured in rows',
    gaugeProfileStitch: (stitch) =>
      `Estimate: converted from the flat gauge of another stitch in the profile. It is more accurate if you also give the gauge of ${stitch} in the Size and yarn section.`,
    gaugeOtherForm:
      'Estimate: converted from the gauge measured in the round. It is more accurate if you also measure flat and give it in the Size and yarn section.',
    gaugeHookProfile: (hookMm) =>
      `Estimate from the ${hookMm} mm hook of the profile, because there is no measured gauge. It is more accurate if you give it in the Size and yarn section.`,
    gaugeHookNoProfile: (hookMm) =>
      `No profile: the size is an estimate from a ${hookMm} mm hook. It is more accurate if you measure a swatch and add it as a profile in the Size and yarn section.`,
    generated: (name, rows, withBorder) => `${name}: ${rows} ${withBorder ? 'rows and the border' : 'rows'} done; undo brings the previous one back.`,
  },
  shawl: {
    names: {
      triangle: 'Top-down triangle',
      'asymmetric-triangle': 'Asymmetric triangle',
      crescent: 'Crescent',
      semicircle: 'Semicircle',
      circle: 'Circle',
      pi: 'Pi shawl',
      'shifted-pi': 'Shifted Pi shawl',
      stole: 'Rectangular stole',
    },
    rates: { theory: 'Theoretical, from the gauge', custom: 'Own rate' },
    sizeLabels: { spine: 'Depth at the spine, cm', straightEdge: 'The straight edge, cm', width: 'Width, cm', radius: 'Radius, cm' },
    rateLabels: {
      triangle: 'Increases per row, across the whole row',
      'asymmetric-triangle': 'Increases per row on the sloped edge',
      crescent: 'Increases per row, per edge',
      semicircle: 'Increases per row',
      circle: 'Increases per round',
      pi: 'Stitches in round 1',
      'shifted-pi': 'Stitches in round 1',
      stole: 'Stitches in round 1',
    },
    edgingWhat: { round: 'The last round', row: 'The row', lastRow: 'The last row' },
    edgingLabel: (what, symmetric) => `${what} to fit the edging repeat: “a multiple of X plus Y”${symmetric ? ', per half' : ''}`,
    blockedName: 'blocked',
    unblockedName: 'unblocked',
    roundNoun: 'rounds',
    rowNoun: 'rows',
    diameterSize: (width) => `${width} cm across`,
    boxSize: (width, depth) => `${width} × ${depth} cm`,
    sizeLine: (measuredName, approx, measured, otherName, other, rows, noun) =>
      `${enCapitalize(measuredName)} ${approx}${measured}, ${otherName} ≈ ${other}; ${rows} ${noun}.`,
    firstLast: (noun, first, last) => `The first ${noun === 'rounds' ? 'round' : 'row'} has ${first} stitches, the last ${last}.`,
    triangleRate: (theory, chosen, edge, spine) =>
      `Increases per row: ${theory} in theory (4 · h/w), ${chosen} chosen; ${edge} per edge on average, ${spine} at the spine, always in pairs.`,
    crescentRate: (theory, chosen) => `Increases per row and edge: ${theory} in theory (2 · h/w), ${chosen} chosen; none at the spine.`,
    asymmetricRate: (theory, chosen) => `Increases per row on the sloped edge: ${theory} for 45° (h/w), ${chosen} chosen.`,
    semicircleRate: (theory, chosen) => `Increases per row, spread evenly: ${theory} in theory (π · h/w), ${chosen} chosen.`,
    circleRate: (theory, chosen) => `Increases per round, staggered: ${theory} in theory (2π · h/w), ${chosen} chosen.`,
    piDoubling: (rounds) => `Doubling in rounds ${rounds.join(', ')}, with plain rounds between.`,
    stoleNote: 'No shaping, the same stitch count in every row.',
    neckAngle: (neck, tip) => `The neck edge is about ${neck}° (180° for a straight neck edge), the bottom tip about ${tip}°.`,
    edgeAngle: (angle) => `The sloped edge is about ${angle}° to the row.`,
    wings: (row) => `Wings: double increases at the edges from row ${row}.`,
    ratio: (worked, min, max) => `${worked} stitch counts are ${min}–${max}% of the ideal.`,
    ratioRounds: 'The round',
    ratioRows: 'The row',
    edging: (width, edge, symmetric, repeats, change) =>
      `For the edging: a multiple of ${width} plus ${edge}${symmetric ? ' per half' : ''}, ${repeats} repeats (${change}).`,
    edgingNoChange: 'no change',
    edgingChange: (sign, count, symmetric) => `${sign}${count} stitches${symmetric ? ' per half' : ''}`,
    warningNote: 'This is a warning, not an error.',
    cupping: (percent, limit, note) =>
      `It may cup: the stitch count is only about ${percent}% of the ideal (more than ${limit}% off). ${note} Blocking often smooths it out, or choose more increases.`,
    ruffling: (percent, limit, note) =>
      `It may ruffle: the stitch count is about ${percent}% of the ideal (more than ${limit}% off). ${note} Choose fewer increases if you want a flat piece.`,
    narrow: (percent, note) =>
      `The chosen increase rate is about ${percent}% of the theoretical: the shawl will be deeper and narrower, and the neck edge curves down. ${note} Many published patterns block it out wide.`,
    wide: (percent, note) =>
      `The chosen increase rate is about ${percent}% of the theoretical: the shawl will be flatter and wider, the neck edge curves up and the edge may ruffle. ${note}`,
    piBlocking: (percent, note) =>
      `In the round before a doubling the stitch count is only about ${percent}% of the ideal: it cups in a solid stitch, so it works best in blocked lace. ${note}`,
    gaugeMeasured: (stitch, basis) => `From the ${basis} gauge of ${stitch}.`,
    gaugeFromLabel: 'gauge given on the label',
    gaugeForm: (form) => `gauge measured ${form}`,
    formRounds: 'in the round',
    formRows: 'flat',
    gaugeProfileStitch: (form) => `Estimate: converted from the gauge of another stitch in the profile, measured ${form}.`,
    gaugeOtherForm: (form) => `Estimate: converted from the gauge measured ${form}.`,
    gaugeHookProfile: (hookMm) => `Estimate from the ${hookMm} mm hook of the profile, because there is no measured gauge.`,
    gaugeHookNoProfile: (hookMm) =>
      `No profile: the size is an estimate from a ${hookMm} mm hook. It is more accurate if you add a profile in the Size and yarn section.`,
    blockedState: 'The profile was measured blocked: the unblocked size is estimated with the stretch you gave.',
    unblockedState: 'The gauge is unblocked: the blocked size is estimated with the stretch you gave. For lace, measure a blocked swatch.',
    generated: (name, rows, noun) => `${name}: ${rows} ${noun} done; undo brings the previous one back.`,
  },
  round: {
    names: {
      circle: 'Flat circle',
      square: 'Square',
      hexagon: 'Hexagon',
      octagon: 'Octagon',
      'granny-square': 'Granny square',
    },
    starts: {
      'magic-ring': 'Magic ring',
      'chain-ring': 'Chain ring',
      chain: 'Into a chain (e.g. 2 ch, 6 sc into the 2nd chain)',
    },
    closings: { 'join-slip': 'Joined round: slip stitch and turning chain', spiral: 'Spiral with a stitch marker' },
    jogs: {
      none: 'None',
      'slip-stitch': 'Slip stitch instead of the first stitch',
      'back-loop': 'New colour into the back loop of the first stitch',
    },
    granny: '3 dc, 2 ch, 3 dc into each corner, 3 dc and 1 ch along the sides: the corners stack above each other.',
    circleIncreases: (count, aspect, exact) => `${count} increases per round: 2π × ${aspect} ≈ ${exact}, rounded to an even number.`,
    polygonIncreases: (exact, corners, aspect) =>
      `About ${exact} increases per round in the ${corners} corners, stacked above each other (2 · ${corners} · tan(π/${corners}) × ${aspect}).`,
    estimated: (stitch) =>
      `Estimate from the usual height/width ratio of ${stitch} in the round. It is more accurate if you give the gauge measured in the round in the Size and yarn section.`,
    fromLabel: 'gauge in the round given on the label',
    fromMeasured: 'gauge measured in the round',
    sameStitch: (stitch, measured) => `From the ${measured} of ${stitch}.`,
    convertedStitch: (from, measured, stitch) => `From the ${measured} of ${from}, converted to the ratio of ${stitch}.`,
    generated: (name, rounds) => `${name}: ${rounds} rounds done; undo brings the previous one back.`,
  },
  amigurumi: {
    names: {
      sphere: 'Sphere',
      hemisphere: 'Hemisphere',
      egg: 'Egg',
      cylinder: 'Cylinder',
      cone: 'Cone',
      revolution: 'Solid of revolution',
      oval: 'Oval',
    },
    revolution: 'Solid of revolution (from a profile)',
    methods: { '6n': '6n: increasing by six, with straight rounds', sine: 'Sine: closer to a true sphere' },
    bottoms: { closed: 'Closed: magic ring, flat bottom', open: 'Open: worked into the edge of the previous piece' },
    tops: { closed: 'Closed: gathered or with a flat top', open: 'Open: for sewing or continuing' },
    joins: { sewn: 'Sewn', continuous: 'Worked on' },
    curvatures: { flat: 'flat', cupping: 'cupping', tube: 'tube', ruffled: 'ruffled', closing: 'decreasing (closing)' },
    profileLine: (line) => `Line ${line} of the profile needs two numbers separated by a space: radius and height in cm (e.g. “2.5 4”).`,
    coneIncreases: 'The increases per round must be a number, e.g. 2.5, or leave it empty.',
    ovalMeasures: (length, width, chains) => `length about ${length} cm, width about ${width} cm, from ${chains} chains`,
    shapeMeasures: (width, height) => `width about ${width} cm, height about ${height} cm`,
    counts: (rounds, stitches, measures) => `${rounds} rounds, at most ${stitches} stitches; ${measures}.`,
    curvatureRun: (from, to, curvature) => `${from === to ? `round ${from}` : `rounds ${from}–${to}`} ${curvature}`,
    curvatureLine: (runs) => `Curvature: ${runs}.`,
    backLoop: (rounds) => `Into the back loop (sharp fold): ${rounds.length === 1 ? 'round' : 'rounds'} ${rounds.join(', ')}.`,
    openStart: 'Open start: only as a continuation, joined to the open end of a previous piece.',
    density: (stitches, rounds) => `${stitches} stitches and ${rounds} rounds over 10 cm`,
    gaugeEstimated: (density) =>
      `Estimate from the hook: ${density}. Amigurumi needs tight crochet, with a hook about two sizes smaller. It is more accurate if you give the single crochet gauge measured in the round in the Size and yarn section.`,
    gaugeMeasured: (basis, density) => `From the ${basis} gauge: ${density}.`,
    gaugeFromLabel: 'label',
    gaugeFromRounds: 'in the round',
    flatOval: (length, width) => `${length} × ${width} cm, flat`,
    partMeasures: (width, height) => `${width} × ${height} cm`,
    part: (name, measures) => `${name} (${measures})`,
    continuedPart: (name, measures) => `${name} worked on (${measures})`,
    figure: (parts, height, width) =>
      `Pieces of the pattern: ${parts}. The figure is about ${height} cm tall and ${width} cm wide (estimate, stuffed).`,
    safety: 'A toy for a child under 3 must not have safety eyes or beads: the pattern writes embroidered eyes.',
    created: (name) => `${name} done; undo brings the previous one back.`,
    added: (name, join) => `${name} added, ${join === 'sewn' ? 'sewn' : 'worked on'}; undo brings the previous one back.`,
  },
  grid: {
    techniques: {
      filet: 'Filet',
      c2c: 'Corner-to-corner (C2C)',
      tapestry: 'Tapestry',
      graphgan: 'Graphgan',
      mosaic: 'Mosaic',
    },
    mosaicRows: { one: 'Single row: one row per grid row', two: 'Double row: two rows per grid row' },
    colors: {
      natural: 'Natural',
      burgundy: 'Burgundy',
      blue: 'Blue',
      green: 'Green',
      mustard: 'Mustard',
      black: 'Black',
      rose: 'Rose',
      brown: 'Brown',
      numbered: (index) => `Colour ${index}`,
    },
    brushes: {
      unset: 'Erase: filled from the repeat',
      filled: 'Filled cell',
      open: 'Open cell',
      none: 'No cell (shaping)',
      color: (letter, name) => `${letter}: ${name}`,
    },
    values: {
      unset: 'not set',
      filled: 'filled',
      open: 'open',
      none: 'no cell',
      unknown: 'unknown',
      color: (letter, name) => `colour ${letter}, ${name}`,
    },
    cellLabel: (row, cell, value) => `row ${row}, cell ${cell}: ${value}`,
    inUnit: ', repeating unit',
    unitFrom: (row, cell) => `from row ${row}, cell ${cell}`,
    manualUnit: (width, height, from, note) => `Repeating unit, by hand: ${width} × ${height} cells, ${from}.${note}`,
    unitConflicts: (count) => ` ${count} cells you set differ from it (e.g. a border): those stay.`,
    allCellsSet:
      'Every cell is set. It is enough to fill in the first rows completely and only part of the later rows: the program fills the erased cells from the repeating unit.',
    detectedUnit: (width, height) => `Repeating unit, recognised: ${width} × ${height} cells. The cells left unset are filled from it.`,
    missingCells: 'There are cells left unset: fill them in, or mark the repeating unit.',
    unitDetail: (width, height, gridWidth, gridHeight) =>
      `Repeating unit: ${width} × ${height} cells, extended over the whole ${gridWidth} × ${gridHeight} cell grid.`,
    actualSize: (approx, width, height, rows) => `Finished size: ${approx}${width} × ${height} cm, ${rows} rows.`,
    c2cSize: (approx, width, height, rows, tiles) => `Finished size: ${approx}${width} × ${height} cm, ${rows} diagonal rows, ${tiles} tiles.`,
    mosaicSize: (approx, width, height, rows, gridRows) => `Finished size: ${approx}${width} × ${height} cm, ${rows} rows (${gridRows} grid rows).`,
    colorworkSize: (approx, width, height, rows) => `Finished size: ${approx}${width} × ${height} cm, ${rows} rows.`,
    filetPositions: (cells, positions) => `The widest row is ${cells} cells: 3 × ${cells} + 1 = ${positions} positions.`,
    filetFoundation: (chains, fromHook) => `Foundation chain: ${chains} ch; the first double crochet goes into chain ${fromHook} from the hook.`,
    foundation: (chains, fromHook) => `Foundation chain: ${chains} ch; the first stitch goes into chain ${fromHook} from the hook.`,
    openStartRows: (rows) => `Starts with an open cell in ${enRowList(rows)}: 2 ch after the turning chain.`,
    addedRows: (rows) => `Increase at the start of ${enRowList(rows)}: a chain extension at the end of the previous row.`,
    leftRows: (rows) => `Cells left unworked at the end of ${enRowList(rows)}.`,
    removedRows: (rows) => `Decrease at the start of ${enRowList(rows)}: slip stitches over the cells.`,
    extendedRows: (rows) => `Increase at the end of ${enRowList(rows)}: 2 ch and a treble 2 rows below.`,
    allIncrease: 'Every row increases.',
    increaseUntil: (row) => `Increases up to row ${row}; after that the side that has reached its size decreases while the other still grows.`,
    tilesPerColor: (counts) => `Tiles per colour: ${counts}`,
    stitchesPerColor: (counts) => `Stitches per colour: ${counts}`,
    tileUnit: 'tiles',
    stitchUnit: 'stitches',
    perColor: (letter, count) => `${letter}: ${count}`,
    mosaicDepthDc: 'a double crochet 2',
    mosaicDepthTr: 'a treble 3',
    mosaicVariantOne: 'Single row',
    mosaicVariantTwo: 'Double row',
    mosaic: (variant, long, drops) => `${variant} mosaic: the dropped stitch is ${long} rows below, ${drops} in total.`,
    mosaicRow: (stitches, chains, fromHook) =>
      `${stitches} stitches per row. Foundation chain: ${chains} ch; the first stitch goes into chain ${fromHook} from the hook.`,
    colorworkRow: (stitches, chains, fromHook) =>
      `${stitches} sc per row. Foundation chain: ${chains} ch; the first stitch goes into chain ${fromHook} from the hook.`,
    tapestryCarry: (rows) => `Tapestry carries more than 3 colours in ${enRowList(rows)}: this is an advanced level, and the fabric gets stiffer.`,
    squareMotif: (rows, cells, actual) => `A square motif needs ${rows} rows for a width of ${cells} cells; this one has ${actual}.`,
    sourceEstimated:
      'The size is an estimate from the hook: it is more accurate if you give a gauge in the Size and yarn section. The grid cells are shown in that ratio too.',
    sourceMeasured: 'The size and the ratio of the cells come from the gauge you gave.',
    yarnMissing:
      'For a yarn estimate, give the size and weight of the swatch, the length of the yarn and the weight of the ball in the Size and yarn section.',
    yarnRange: (value, low, high) => `≈ ${value} m (${low}–${high} m)`,
    yarnExact: (value) => `${value} m`,
    yarnTotal: (meters) => `Yarn with a reserve: ${meters}.`,
    yarnColor: (letter, name, meters) => `${letter} (${name}): ${meters}`,
    yarnTapestry: 'Tapestry may need more because of the yarn carried inside the stitches: the top of the range allows for that.',
    generated: (technique, rows) => `${technique}: ${rows} rows done; undo brings the previous one back.`,
    imageLoaded: (width, height) => `Image loaded: ${width} × ${height} cells, in the ratio of the gauge.`,
    imageFailed: 'The image could not be loaded: choose a PNG, JPEG, GIF or WebP file.',
    filledFromUnit: 'The cells left unset are filled from the repeating unit.',
    loadedFromPattern: 'The grid of the current pattern is loaded into the editor.',
    brushLegend: 'Brush',
    colorSwatchLabel: (letter) => `Colour of ${letter}`,
    colorNameLabel: (letter) => `Name of colour ${letter}`,
    colorRemoveLabel: (letter) => `Delete colour ${letter}`,
    colorFallback: (letter) => `Colour ${letter}`,
    remove: 'Delete',
    cellRatio: (width, height) =>
      `One cell is ${width} × ${height} cm: the grid is shown in the ratio of the gauge. The top row is at the top, row 1 at the bottom.`,
  },
  garment: {
    names: { hat: 'Hat', 'drop-shoulder': 'Drop-shoulder sweater' },
    tables: { women: 'Women', men: 'Men', child: 'Child', baby: 'Baby' },
    fits: {
      'very-close': 'very close-fitting',
      close: 'close-fitting',
      classic: 'classic',
      loose: 'loose',
      oversized: 'oversized',
    },
    easeLabels: { hat: 'Ease at the head circumference, cm', sweater: 'Ease at the bust, cm' },
    hemLabels: { hat: 'Brim, cm', sweater: 'Hem and cuff, cm' },
    easeHat: (small, large, limitCm, limit) =>
      `Left empty it follows the head size: ${small} cm below ${limitCm} cm, ${large} cm above. In crochet fabric the negative ease is at most about ${limit}%.`,
    easeSweater: (from, to, limit) =>
      `A drop shoulder usually has ${from}–${to} cm of ease. In crochet fabric the negative ease is at most about ${limit}%.`,
    hatSize: (name, approx, circumference, height, rounds) =>
      `${name}: finished circumference ${approx}${circumference} cm, height ${approx}${height} cm; ${rounds} rounds.`,
    sweaterSize: (name, approx, chest, length, sleeve) =>
      `${name}: finished bust ${approx}${chest} cm, length ${approx}${length} cm, sleeve length ${approx}${sleeve} cm.`,
    yarnMissing:
      'For a yarn estimate, give the size and weight of the swatch, the length of the yarn and the weight of the ball in the Size and yarn section.',
    yarn: (meters, balls) => `Yarn with a reserve: about ${meters} m, ${balls} balls.`,
    prefix: (name) => `${name}: `,
    failedCheck: (prefix, label) => `${prefix}${label}: false.`,
    allChecks: (passed, total, sizes) => `Every check is true: ${passed}/${total}${sizes}.`,
    checkSizes: (count) => `, ${count} sizes`,
    someChecks: (passed, total) => `${passed}/${total} checks are true; the false ones are below.`,
    warning: (prefix, warning) => `${prefix}${warning}`,
    estimatedSize: (name, missing) => `${name}: the table has no ${missing.join(' and ')}, so it is estimated.`,
    flag: (name, note) => `Suspicious data in the table (${name}): ${note}`,
    monotonic: (label, size) => `${enCapitalize(label)} is smaller at size ${size} than in the previous one.`,
    hatHead: (head, ease, percent, hat, stitches) =>
      `Head circumference ${head} cm, ease ${ease} cm (${percent}%): the hat is ${hat} cm, ${stitches} stitches.`,
    hatCrown: (rounds, increases, exact) =>
      `Crown: ${rounds} rounds, ${increases} increases per round (${exact} in theory), adjusted in the last round.`,
    hatSide: (rounds, brim) => `Side: ${rounds} rounds straight${brim}.`,
    hatBrim: (rounds) => `, of which the last ${rounds} rounds are the brim`,
    panel: (stitches, repeats, rows, hemRows, foundation, armholeRows) =>
      `Back and front: ${stitches} stitches${repeats}, ${rows} rows, of which ${hemRows} rows are the hem; foundation chain ${foundation} ch. The armhole is the last ${armholeRows} rows.`,
    panelRepeats: (repeats) => ` (${repeats} repeats)`,
    shoulder: (shoulder, stitches) => `Shoulder: ${shoulder} stitches at each edge; the middle ${stitches} stitches stay open as a boat neck.`,
    neck: (center, first, later, back) =>
      `Shaped neck (a plan only, the graph is made with a boat neck): ${center} stitches at the centre, ${first} stitches on each side in the first row, then 1 in each of ${later} rows; ${back} stitches at the centre back.`,
    sleeve: (cuff, top, rows, increases, first) =>
      `Sleeve: from ${cuff} stitches to ${top} stitches, ${rows} rows; ${increases} increases at both edges${first}.`,
    sleeveFirst: (row) => `, the first in row ${row}`,
    ease: (ease, fit, note) => `Ease: ${ease} cm (${fit})${note}.`,
    easeNote: (from, to) => `; a drop shoulder usually has ${from}–${to} cm, so this is that much closer-fitting`,
    upperArm: (ease) => `The ease at the upper arm is ${ease} cm.`,
    shoulderDrop: (drop) => `The shoulder seam drops about ${drop} cm onto the arm.`,
    body: (bust) => `Body measurement: bust ${bust} cm, the middle of the range in the table.`,
    formRounds: 'in the round',
    formRows: 'flat',
    gaugeMeasured: (stitch, basis) => `From the ${basis} gauge of ${stitch}.`,
    gaugeFromLabel: 'label',
    gaugeMeasuredIn: (form) => `measured ${form}`,
    gaugeProfileStitch: (form) => `Estimate: converted from the gauge of another stitch in the profile, measured ${form}.`,
    gaugeOtherForm: (form) => `Estimate: converted from the gauge measured ${form}.`,
    gaugeHookProfile: (hookMm) => `Estimate from the ${hookMm} mm hook of the profile, because there is no measured gauge.`,
    gaugeHookNoProfile: (hookMm) =>
      `No profile: the size is an estimate from a ${hookMm} mm hook. It is more accurate if you add a profile in the Size and yarn section.`,
    lengthNote: 'It is worth measuring the length from a washed, blocked and hung swatch, because crochet fabric grows lengthways.',
    generated: (name, size, series) => `${name}, size ${size}${series} done; undo brings the previous one back.`,
    generatedSeries: (count) => ` (with a ${count} size range)`,
  },
};

export const PANEL_TEXTS = { hu, en } satisfies Dictionary<PanelTexts>;
