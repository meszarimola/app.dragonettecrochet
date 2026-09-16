/*
 * A ruhadarabok magüzenetei mondattá (PQW-904).
 *
 * A mag (garments.ts, raglan.ts, body-sizes.ts) kódot és nyers adatot ad
 * (`CoreText<GarmentCode>`); a mondat itt készül, a felület nyelvén. A magyar
 * ág betűre a mai szöveg: ez átvezetés, nem újrafogalmazás.
 *
 * Ami a felületé, nem a magé:
 * - a méret neve: a mag azonosítót ad (`adult-m`, `8`), a nevet a
 *   `hatSizeName`/`bodySizeName` adja a felület nyelvéből képzett `Locale`-lal;
 * - a mértéknév: a mag a mérés azonosítóját adja, a nevet itteni táblázat;
 * - a számok alakja: magyarul tizedesvessző és `hu` csoportosítás, angolul
 *   tizedespont;
 * - a nagybetűsítés és a névelő: azt a panelek szótára teszi hozzá
 *   (`i18n/panels.ts` `monotonic`, `failedCheck`, `flag`).
 *
 * DOM nélküli, ezért a Node is futtatja, és a magot `.ts` kiterjesztéssel
 * importálja.
 */

import { bodySizeName, hatSizeName, type BodyMeasure, type BodyTableId } from '../../../core/body-sizes.ts';
import type { GarmentCode } from '../../../core/garments.ts';
import type { CoreData } from '../../../core/messages.ts';
import type { GarmentTable, Locale } from '../../../core/types.ts';
import { list, num, renderCoreText, str, type CoreDictionary, type CoreEntry } from './render.ts';
import { SHAPE_CORE_TEXTS } from './shape.ts';

/* ---- Mértéknevek: a mag a mérés azonosítóját adja ---- */

const HU_MEASURES: Readonly<Record<BodyMeasure, string>> = {
  chest: 'mellbőség',
  neckToWrist: 'hátközép a nyaktól a kézfejig',
  backWaist: 'háthossz a derékig',
  backHip: 'háthossz a csípőig',
  crossBack: 'keresztháti szélesség',
  armLength: 'karhossz a hónaljtól',
  upperArm: 'felkarbőség',
  armholeDepth: 'karöltőmélység',
  waist: 'derékbőség',
  hips: 'csípőbőség',
};

const EN_MEASURES: Readonly<Record<BodyMeasure, string>> = {
  chest: 'bust',
  neckToWrist: 'centre back to cuff',
  backWaist: 'back waist length',
  backHip: 'back hip length',
  crossBack: 'cross back',
  armLength: 'arm length from the underarm',
  upperArm: 'upper arm',
  armholeDepth: 'armhole depth',
  waist: 'waist',
  hips: 'hips',
};

const measure = (data: CoreData, key: string, names: Readonly<Record<BodyMeasure, string>>): string =>
  names[str(data, key) as BodyMeasure] ?? str(data, key);

/* ---- Számok és tartományok nyelvenként ---- */

const huNumber = (value: string | number): string => String(value).replace('.', ',');

const range = (data: CoreData, key: string, format: (value: string | number) => string): string => {
  const [min, max] = list(data, key);
  if (min === undefined) return '';
  return min === max ? format(min) : `${format(min)}–${format(max ?? min)}`;
};

const huRange = (data: CoreData, key: string) => range(data, key, huNumber);
const enRange = (data: CoreData, key: string) => range(data, key, String);

/** A méret neve a mondatba: a mag azonosítót és a táblázat fajtáját adja. */
function sizeName(data: CoreData, locale: Locale): string {
  const id = str(data, 'size');
  const table = str(data, 'table') as GarmentTable;
  return table === 'hat' ? hatSizeName(id, locale) : bodySizeName(table as BodyTableId, id, locale);
}

/** A beágyazott üzenet: a méretenkénti elutasításban az elutasítás oka. */
function inner(data: CoreData, language: 'hu' | 'en'): string {
  return renderCoreText(GARMENT_CORE_TEXTS[language], { code: str(data, 'inner') as GarmentCode, data });
}

/**
 * A darab építőjének hibája: a sorgenerátor kódját a forma szótára írja ki, a
 * körgenerátor pedig — amíg nem áll kódra — kész mondatot ad (`message`).
 */
function pieceProblem(data: CoreData, language: 'hu' | 'en'): string {
  const message = str(data, 'message');
  if (message !== '') return message;
  return renderCoreText(SHAPE_CORE_TEXTS[language], { code: str(data, 'inner'), data });
}

const hu: Readonly<Record<GarmentCode, CoreEntry>> = {
  /* Választás és tartomány */
  'stitch-choice': 'Ehhez a generátorhoz alapszemet válassz: rövidpálca, félpálca, egyráhajtásos vagy kétráhajtásos pálca.',
  'pick-size': 'Válassz méretet a listából.',
  'series-range': 'A méretsorozat a választott méretet is tartalmazza: az első méret ne legyen nagyobb, az utolsó ne legyen kisebb nála.',
  'ease-range': 'A bőség −50 és 100 cm közötti szám legyen.',
  'ease-required': 'Add meg a bőséget.',
  'hem-range': 'A szegély magassága 0 és 50 cm közötti szám legyen.',
  'growth-range': 'A növedék 0 és 50% közötti szám legyen.',
  'below-waist-range': 'A derék alatti hossz −30 és 100 cm közötti szám legyen.',
  'repeat-width': (d) => `Az ismétlés szemszáma (X) 1 és ${num(d, 'max')} közötti egész szám legyen.`,
  'repeat-edge': (d) => `A szélső szemek száma (Y) 0 és ${num(d, 'max')} közötti egész szám legyen.`,

  /* A táblázat mérete és a méretenkénti elutasítás */
  'unknown-size': (d) => `Ismeretlen méret: ${str(d, 'size')}.`,
  'missing-measure': (d) => `A(z) ${str(d, 'size')} méretnél hiányzik a táblázatból egy szükséges méret.`,
  'size-problem': (d) => `${sizeName(d, 'hu')} méret: ${inner(d, 'hu')}`,

  /* Sapka */
  'head-range': (d) => `A fejkörfogat 0 és ${num(d, 'max')} cm közötti szám legyen.`,
  'negative-ease-head': (d) => `A negatív bőség legfeljebb a fejkörfogat ${num(d, 'limit')}%-a lehet (most ${num(d, 'actual')}%): a horgolt anyag kevéssé nyúlik.`,
  'hat-height': (d) => `A sapka magassága legyen nagyobb a korona sugaránál (${num(d, 'radius')} cm).`,
  'hat-crown': 'Ilyen kis körméretnél nem tervezhető korona: adj meg nagyobb fejkörfogatot.',
  'hat-side': 'A sapka oldala legalább egy kör legyen: adj meg nagyobb magasságot.',
  'max-rounds': (d) => `Legfeljebb ${num(d, 'max')} kör lehet: adj meg kisebb méretet.`,

  /* Ledobott vállú pulóver */
  'negative-ease-bust': (d) => `A negatív bőség legfeljebb a mellbőség ${num(d, 'limit')}%-a lehet (most ${num(d, 'actual')}%): a horgolt anyag kevéssé nyúlik.`,
  'panel-narrow': 'A hátrész túl keskeny: adj meg nagyobb méretet vagy vékonyabb fonalat.',
  'max-stitches': (d) => `Egy sorban legfeljebb ${num(d, 'max')} szem lehet: adj meg kisebb méretet vagy vastagabb fonalat.`,
  'body-length-hem': 'A pulóver hossza legyen nagyobb a szegély magasságánál.',
  'max-rows': (d) => `Legfeljebb ${num(d, 'max')} sor lehet: adj meg kisebb méretet vagy vastagabb fonalat.`,
  'armhole-fit': 'A karöltő mélysége nem fér a pulóver hosszába: adj meg nagyobb hosszt.',
  'neck-fit': 'A nyak szélessége nem fér a hátrész szélességébe: adj meg nagyobb méretet.',
  'sleeve-short': 'Az ujj túl rövid ehhez a mérethez: ellenőrizd a hátközép–kézfej hosszt.',
  'sleeve-increases': 'Az ujj hosszán nem fér el ennyi szaporítás: adj meg kisebb bőséget vagy hosszabb ujjat.',
  'max-total-sweater': (d) => `A pulóverben legfeljebb ${num(d, 'max').toLocaleString('hu')} szem lehet: válassz kisebb méretet vagy vastagabb fonalat.`,
  'max-total-raglan': (d) => `A raglánban legfeljebb ${num(d, 'max').toLocaleString('hu')} szem lehet: válassz kisebb méretet vagy vastagabb fonalat.`,

  /* Felülről horgolt raglán */
  'underarm-long': 'A hónaljlánc túl hosszú ehhez a mellbőséghez: adj meg rövidebb hónaljláncot.',
  'sleeve-narrow': 'Az ujj túl keskeny ehhez a hónaljlánchoz: adj meg rövidebb hónaljláncot.',
  'yoke-min': 'A raglán mélysége legalább két kör legyen: adj meg nagyobb raglánmélységet.',
  'yoke-sleeve-many': 'A raglán mélysége ennél a méretnél túl sok szemet ad az ujjnak: adj meg sekélyebb raglánt vagy bővebb ujjat.',
  'yoke-sleeve-few': 'A raglán mélysége ennél a méretnél túl kevés szemet ad az ujjnak: adj meg mélyebb raglánt vagy szűkebb ujjat.',
  'neck-small': 'A nyak szemszáma túl kicsi a négy szakaszhoz: adj meg nagyobb nyakbőséget.',
  'body-short-gauge':
    'A törzs hiányzó szemei nem férnek el a raglánkörökben: adj meg mélyebb raglánt, vagy mérd meg a ' +
    'körben horgolt mintasűrűséget a Méret és fonal szakaszban, mert a becsült sormagasságból kevés kör jön ki.',
  'yoke-body-many': 'A raglán mélysége ennél a méretnél túl sok szemet ad a törzsnek: adj meg sekélyebb raglánt vagy kisebb bőséget.',
  'body-short': 'A törzs hiányzó szemei nem férnek el a raglánkörökben: adj meg mélyebb raglánt vagy kisebb bőséget.',
  'body-length-yoke': 'A pulóver hossza legyen nagyobb a raglán mélységénél.',

  /* Program- és gráfhiba: a `rule` mondja meg, melyik lépésnél akadt el. */
  'internal-error': (d) => {
    const rule = str(d, 'rule');
    if (rule === 'raglan-stitch') return 'Ismeretlen szem a raglánhoz: ez a program hibája, kérlek, jelezd.';
    if (rule === 'raglan-neck-round') return 'A nyak köre nem a terv szerinti: ez a program hibája, kérlek, jelezd.';
    if (rule === 'raglan-round-plan') return `A(z) ${num(d, 'round')}. kör terve nem illik az előző körhöz: ez a program hibája, kérlek, jelezd.`;
    if (rule === 'raglan-divide') return 'A szétosztás köre nem a terv szerinti: ez a program hibája, kérlek, jelezd.';
    // Az ellenőrző szabályai sokan vannak: a szabály azonosítója a mondatba kerül.
    return `A generált minta nem ment át az ellenőrzőn (${rule}): ez a program hibája, kérlek, jelezd.`;
  },
  'piece-error': (d) => pieceProblem(d, 'hu'),

  /* Figyelmeztetések */
  'negative-ease-warning': (d) =>
    `A negatív bőség ${num(d, 'actual')}%: horgolt anyagnál ${num(d, 'limit')}% fölött csak nyúlós, bordás szemmel működik (05 §3.5, §7.2).`,
  'cuff-wide': 'A mandzsetta szélesebb lenne az ujj felső élénél, ezért az ujj egyenes.',
  'upper-arm-ease': (d) => `A felkaron csak ${num(d, 'ease')} cm a bőség: a szokásos kb. 5 cm (05 §3.5).`,
  'raglan-extra-rounds': (d) =>
    `A sarkok szaporítása ${num(d, 'missing')} szemmel kevesebbet ad a törzsnek, mint kell: ${num(d, 'rounds')} körben külön törzsszaporítás is van (05 §4 „C” példa).`,

  /* A táblázatból hiányzó, becsült méretek */
  'estimated-armhole-depth': 'karöltőmélység',
  'estimated-cuff': 'mandzsetta',
  'estimated-upper-arm': 'felkarbőség',

  /* Ellenőrzések és javaslatok: sapka */
  'check-crown-target': 'A korona utolsó köre a tervezett szemszám',
  'check-crown-doubling': 'A korona egyik körében sincs duplázásnál több szaporítás',
  'check-side-count': 'Az oldal minden köre a tervezett szemszám',
  'check-brim': 'A perem nem magasabb a sapka oldalánál',
  'check-height': 'A kész magasság legfeljebb másfél körrel tér el a tervezettől',
  'check-negative-ease': (d) => `A negatív bőség legfeljebb ${num(d, 'limit')}%`,

  /* Ellenőrzések és javaslatok: pulóver */
  'check-panel-repeat': (d) => `A hátrész és az elejerész szemszáma ${num(d, 'width')} többszöröse + ${num(d, 'edge')}`,
  'check-even-rows': 'Minden függőleges szakasz páros számú sor',
  'suggest-even-rows': 'Állíts a szegély magasságán vagy a hosszon fél sornyit: a szakaszok páros sorszámra kerekednek.',
  'check-shoulders': 'A két váll és a nyak együtt kiadja a sor szemszámát',
  'check-neck-shaping': 'A formázott nyak fogyasztásai kiadják a nyak szemszámát, és a nyak belefér a darabba',
  'suggest-neck-shaping': 'Adj nagyobb hosszt, vagy válassz csónaknyakat: a nyak mélysége nem fér a darabba.',
  'check-sleeve-width': 'A mandzsetta szemszáma és a szaporítások kiadják az ujj felső élét',
  'check-sleeve-rows': 'Az ujj szaporítási közei és az egyenes sorok kiadják az ujj sorait',
  'suggest-sleeve-rows': 'Adj hosszabb ujjat vagy kisebb bőséget: ennyi szaporítás nem fér el ennyi sorban.',
  'check-armhole-seam': (d) => `Az ujj felső éle és a két karöltő hossza legfeljebb ${num(d, 'limit')} cm-rel tér el`,
  'suggest-armhole-seam': (d) => `A karöltő mélységét vagy az ujj felső élét igazítsd: most ${num(d, 'off')} cm az eltérés.`,
  'check-side-seam': 'Az oldalvarrás a karöltő alatt legalább egy sor',
  'suggest-side-seam': 'Adj nagyobb hosszt, vagy sekélyebb karöltőt: a karöltő az egész darabot elfoglalja.',
  'suggest-negative-ease-bust': (d) => `A negatív bőség legfeljebb ${num(d, 'cm')} cm lehet ekkora mellbőségnél: a horgolt anyag ennél kevésbé nyúlik.`,

  /* Ellenőrzések és javaslatok: raglán */
  'check-raglan-sections': 'Az elő, a hát és az ujjak egyszerre érik el a célszemszámot a szétosztásnál',
  'suggest-raglan-sections': 'Állíts a raglán mélységén vagy a nyak bőségén: a szakaszok nem ugyanannyi kör alatt telnek be.',
  'check-raglan-growth': (d) => `Egy szakasz körönként legfeljebb ${num(d, 'max')} szemmel nő`,
  'suggest-raglan-growth': 'Adj mélyebb raglánt: így kevesebb külön törzsszaporítás kell körönként.',
  'check-raglan-underarm': 'A hónaljlánc a törzsbe és az ujjba is beleszámít',
  'check-raglan-neck': 'A nyak négy szakasza kiadja a nyak szemszámát',
  'check-even-rounds': 'A raglán és a törzs körszáma páros',
  'suggest-negative-ease-raglan': (d) => `A negatív bőség legfeljebb ${num(d, 'cm')} cm lehet ekkora mellbőségnél.`,

  /* A méretsorozat monotonitása: a névelőt és a nagybetűt a panel teszi hozzá. */
  'monotonic-hat-stitches': 'a sapka szemszáma',
  'monotonic-rounds': 'a körök száma',
  'monotonic-raglan-body': 'a törzs szemszáma',
  'monotonic-raglan-sleeve': 'az ujj szemszáma',
  'monotonic-neck': 'a nyak szemszáma',
  'monotonic-panel': 'a hátrész szemszáma',
  'monotonic-cuff': 'a mandzsetta szemszáma',
  'monotonic-sleeve-top': 'az ujj felső éle',

  /* A testméret-táblázat gyanús adatai */
  'flag-inch-mismatch': (d) =>
    `${measure(d, 'measure', HU_MEASURES)}: ${huRange(d, 'inch')}" = ${huRange(d, 'converted')} cm, a táblázatban ${huRange(d, 'cm')} cm.`,
  'flag-not-monotonic': (d) =>
    `${measure(d, 'measure', HU_MEASURES)}: ${huRange(d, 'cm')} cm, kisebb, mint az előző méreté (${huRange(d, 'previous')} cm).`,
  'flag-identical-rows': (d) =>
    `${measure(d, 'measure', HU_MEASURES)} és ${measure(d, 'other', HU_MEASURES)}: ${str(d, 'from')}–${str(d, 'to')} méretben azonos, valószínűleg másolási hiba.`,
};

const en: Readonly<Record<GarmentCode, CoreEntry>> = {
  /* Választás és tartomány */
  'stitch-choice': 'For this generator choose a basic stitch: single, half double, double or treble crochet.',
  'pick-size': 'Choose a size from the list.',
  'series-range': 'The size range has to contain the chosen size: the first size must not be larger and the last one not smaller than it.',
  'ease-range': 'The ease must be a number between −50 and 100 cm.',
  'ease-required': 'Give the ease.',
  'hem-range': 'The height of the hem must be a number between 0 and 50 cm.',
  'growth-range': 'The growth must be a number between 0 and 50%.',
  'below-waist-range': 'The length below the waist must be a number between −30 and 100 cm.',
  'repeat-width': (d) => `The stitch count of the repeat (X) must be a whole number between 1 and ${num(d, 'max')}.`,
  'repeat-edge': (d) => `The number of edge stitches (Y) must be a whole number between 0 and ${num(d, 'max')}.`,

  /* A táblázat mérete és a méretenkénti elutasítás */
  'unknown-size': (d) => `Unknown size: ${str(d, 'size')}.`,
  'missing-measure': (d) => `A measurement needed at size ${str(d, 'size')} is missing from the table.`,
  'size-problem': (d) => `Size ${sizeName(d, 'en-US')}: ${inner(d, 'en')}`,

  /* Sapka */
  'head-range': (d) => `The head circumference must be a number between 0 and ${num(d, 'max')} cm.`,
  'negative-ease-head': (d) =>
    `The negative ease can be at most ${num(d, 'limit')}% of the head circumference (now ${num(d, 'actual')}%): crochet fabric stretches little.`,
  'hat-height': (d) => `The height of the hat must be greater than the radius of the crown (${num(d, 'radius')} cm).`,
  'hat-crown': 'No crown can be planned for a circumference this small: give a larger head circumference.',
  'hat-side': 'The side of the hat must be at least one round: give a greater height.',
  'max-rounds': (d) => `There can be at most ${num(d, 'max')} rounds: give a smaller size.`,

  /* Ledobott vállú pulóver */
  'negative-ease-bust': (d) =>
    `The negative ease can be at most ${num(d, 'limit')}% of the bust (now ${num(d, 'actual')}%): crochet fabric stretches little.`,
  'panel-narrow': 'The back is too narrow: give a larger size or a thinner yarn.',
  'max-stitches': (d) => `A row can have at most ${num(d, 'max')} stitches: give a smaller size or a thicker yarn.`,
  'body-length-hem': 'The length of the sweater must be greater than the height of the hem.',
  'max-rows': (d) => `There can be at most ${num(d, 'max')} rows: give a smaller size or a thicker yarn.`,
  'armhole-fit': 'The armhole depth does not fit into the length of the sweater: give a greater length.',
  'neck-fit': 'The width of the neck does not fit into the width of the back: give a larger size.',
  'sleeve-short': 'The sleeve is too short for this size: check the centre back to cuff length.',
  'sleeve-increases': 'This many increases do not fit into the length of the sleeve: give less ease or a longer sleeve.',
  'max-total-sweater': (d) => `The sweater can have at most ${num(d, 'max').toLocaleString('en')} stitches: choose a smaller size or a thicker yarn.`,
  'max-total-raglan': (d) => `The raglan can have at most ${num(d, 'max').toLocaleString('en')} stitches: choose a smaller size or a thicker yarn.`,

  /* Felülről horgolt raglán */
  'underarm-long': 'The underarm chain is too long for this bust: give a shorter underarm chain.',
  'sleeve-narrow': 'The sleeve is too narrow for this underarm chain: give a shorter underarm chain.',
  'yoke-min': 'The raglan depth must be at least two rounds: give a greater raglan depth.',
  'yoke-sleeve-many': 'At this size the raglan depth gives the sleeve too many stitches: give a shallower raglan or a wider sleeve.',
  'yoke-sleeve-few': 'At this size the raglan depth gives the sleeve too few stitches: give a deeper raglan or a narrower sleeve.',
  'neck-small': 'The stitch count of the neck is too small for the four sections: give a larger neck circumference.',
  'body-short-gauge':
    'The stitches missing from the body do not fit into the raglan rounds: give a deeper raglan, or measure the gauge ' +
    'worked in the round in the Size and yarn section, because the estimated row height gives too few rounds.',
  'yoke-body-many': 'At this size the raglan depth gives the body too many stitches: give a shallower raglan or less ease.',
  'body-short': 'The stitches missing from the body do not fit into the raglan rounds: give a deeper raglan or less ease.',
  'body-length-yoke': 'The length of the sweater must be greater than the raglan depth.',

  /* Program- és gráfhiba */
  'internal-error': (d) => {
    const rule = str(d, 'rule');
    if (rule === 'raglan-stitch') return 'Unknown stitch for the raglan: this is a bug in the program, please report it.';
    if (rule === 'raglan-neck-round') return 'The neck round does not follow the plan: this is a bug in the program, please report it.';
    if (rule === 'raglan-round-plan') {
      return `The plan of round ${num(d, 'round')} does not fit the previous round: this is a bug in the program, please report it.`;
    }
    if (rule === 'raglan-divide') return 'The divide round does not follow the plan: this is a bug in the program, please report it.';
    return `The generated pattern did not pass the checker (${rule}): this is a bug in the program, please report it.`;
  },
  'piece-error': (d) => pieceProblem(d, 'en'),

  /* Figyelmeztetések */
  'negative-ease-warning': (d) =>
    `The negative ease is ${num(d, 'actual')}%: in crochet fabric above ${num(d, 'limit')}% it only works with a stretchy, ribbed stitch (05 §3.5, §7.2).`,
  'cuff-wide': 'The cuff would be wider than the top of the sleeve, so the sleeve is straight.',
  'upper-arm-ease': (d) => `There is only ${num(d, 'ease')} cm of ease at the upper arm: about 5 cm is usual (05 §3.5).`,
  'raglan-extra-rounds': (d) =>
    `The increases at the corners give the body ${num(d, 'missing')} stitches fewer than needed: in ${num(d, 'rounds')} rounds the front and back also get their own increases (05 §4, worked example C).`,

  /* A táblázatból hiányzó, becsült méretek */
  'estimated-armhole-depth': 'armhole depth',
  'estimated-cuff': 'cuff',
  'estimated-upper-arm': 'upper arm',

  /* Ellenőrzések és javaslatok: sapka */
  'check-crown-target': 'The last round of the crown has the planned stitch count',
  'check-crown-doubling': 'No round of the crown increases by more than doubling',
  'check-side-count': 'Every round of the side has the planned stitch count',
  'check-brim': 'The brim is not taller than the side of the hat',
  'check-height': 'The finished height differs from the planned one by at most one and a half rounds',
  'check-negative-ease': (d) => `The negative ease is at most ${num(d, 'limit')}%`,

  /* Ellenőrzések és javaslatok: pulóver */
  'check-panel-repeat': (d) => `The stitch count of the back and the front is a multiple of ${num(d, 'width')} plus ${num(d, 'edge')}`,
  'check-even-rows': 'Every vertical section has an even number of rows',
  'suggest-even-rows': 'Adjust the height of the hem or the length by half a row: the sections round to an even number of rows.',
  'check-shoulders': 'The two shoulders and the neck together give the stitch count of the row',
  'check-neck-shaping': 'The decreases of the shaped neck give the stitch count of the neck, and the neck fits into the piece',
  'suggest-neck-shaping': 'Give a greater length, or choose a boat neck: the depth of the neck does not fit into the piece.',
  'check-sleeve-width': 'The stitch count of the cuff and the increases give the top of the sleeve',
  'check-sleeve-rows': 'The increase intervals and the straight rows give the rows of the sleeve',
  'suggest-sleeve-rows': 'Give a longer sleeve or less ease: this many increases do not fit into this many rows.',
  'check-armhole-seam': (d) => `The top of the sleeve and the two armholes differ in length by at most ${num(d, 'limit')} cm`,
  'suggest-armhole-seam': (d) => `Adjust the armhole depth or the top of the sleeve: the difference is now ${num(d, 'off')} cm.`,
  'check-side-seam': 'The side seam below the armhole is at least one row',
  'suggest-side-seam': 'Give a greater length, or a shallower armhole: the armhole takes up the whole piece.',
  'suggest-negative-ease-bust': (d) => `The negative ease can be at most ${num(d, 'cm')} cm at this bust: crochet fabric stretches less than that.`,

  /* Ellenőrzések és javaslatok: raglán */
  'check-raglan-sections': 'The front, the back and the sleeves reach their target stitch count at the divide at the same time',
  'suggest-raglan-sections': 'Adjust the raglan depth or the neck circumference: the sections do not fill up in the same number of rounds.',
  'check-raglan-growth': (d) => `A section grows by at most ${num(d, 'max')} stitches per round`,
  'suggest-raglan-growth': 'Give a deeper raglan: then fewer separate body increases are needed per round.',
  'check-raglan-underarm': 'The underarm chain counts into both the body and the sleeve',
  'check-raglan-neck': 'The four sections of the neck give the stitch count of the neck',
  'check-even-rounds': 'The raglan and the body have an even number of rounds',
  'suggest-negative-ease-raglan': (d) => `The negative ease can be at most ${num(d, 'cm')} cm at this bust.`,

  /* A méretsorozat monotonitása */
  'monotonic-hat-stitches': 'the stitch count of the hat',
  'monotonic-rounds': 'the number of rounds',
  'monotonic-raglan-body': 'the stitch count of the body',
  'monotonic-raglan-sleeve': 'the stitch count of the sleeve',
  'monotonic-neck': 'the stitch count of the neck',
  'monotonic-panel': 'the stitch count of the back',
  'monotonic-cuff': 'the stitch count of the cuff',
  'monotonic-sleeve-top': 'the top of the sleeve',

  /* A testméret-táblázat gyanús adatai */
  'flag-inch-mismatch': (d) =>
    `${measure(d, 'measure', EN_MEASURES)}: ${enRange(d, 'inch')}" = ${enRange(d, 'converted')} cm, the table has ${enRange(d, 'cm')} cm.`,
  'flag-not-monotonic': (d) => `${measure(d, 'measure', EN_MEASURES)}: ${enRange(d, 'cm')} cm, smaller than at the previous size (${enRange(d, 'previous')} cm).`,
  'flag-identical-rows': (d) =>
    `${measure(d, 'measure', EN_MEASURES)} and ${measure(d, 'other', EN_MEASURES)}: identical in sizes ${str(d, 'from')}–${str(d, 'to')}, probably a copying error.`,
};

export const GARMENT_CORE_TEXTS: CoreDictionary<GarmentCode> = { hu, en };
