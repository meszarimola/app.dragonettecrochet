/*
 * A Forma, a Kendő és a szegély magból jövő üzenetei mondattá (PQW-904).
 *
 * A mag kódot és adatot ad (`ShapeCode`, `ShawlCode`, `BorderCode`), a mondat
 * itt készül. A magyar ág betűre a mai szöveg: ez átvezetés, nem
 * újrafogalmazás, ezért a magyar felület megjelenése nem változik.
 *
 * Ami a magban nincs, és itt kerül a mondatba:
 * - a sor és a kör szava: a mag `shape: 'row' | 'round'` értéket ad (`isRound`);
 * - a magyar névelő: a mai szöveg „A(z)” alakja marad, mert a megjelenés egy
 *   karakterrel sem változhat;
 * - a határok és a sorszámok: a magban az adat mezői, itt a mondat helyén.
 *
 * Az `internal-error` a „ez a program hibája” esetek közös kódja: `rule` a
 * megbukott szabály, `row` (és `shape`) a tervtől eltérő sor vagy kör, adat
 * nélkül a hiányos sorterv.
 *
 * A szegély kódjaira (`border-`) az írott minta hibája is hivatkozik
 * (pattern-steps.ts, `nested`), ezért azok a kódok itt is megvannak.
 *
 * DOM nélküli, ezért a Node is futtatja.
 */

import type { BorderCode } from '../../../core/border.ts';
import type { CoreData } from '../../../core/messages.ts';
import type { ShapeCode } from '../../../core/shapes.ts';
import type { ShawlCode } from '../../../core/shawls.ts';
import { isRound, num, str, type CoreDictionary, type CoreEntry } from './render.ts';

/** A három terület kódkészlete együtt; a kendő a stólához a forma kódjait is használja. */
type ShapeCoreCode = ShapeCode | ShawlCode | BorderCode;

type Entries = Readonly<Record<ShapeCoreCode, CoreEntry>>;

/** A sor vagy a kör szava magyarul: a mag csak a `shape`-et adja. */
const huNoun = (data: CoreData): string => (isRound(data) ? 'kör' : 'sor');

const hu: Entries = {
  /* ---- Szegély ---- */
  'border-single-crochet-only': 'A szegély most csak rövidpálcás lehet.',
  'border-needs-row': 'A szegélyhez legalább egy sor kell.',
  'border-rows-only': 'A szegély most csak sorokban horgolt darab köré készül.',
  'border-needs-stitches': 'A szegélyhez minden sorban kell szem.',
  'border-not-regular': 'A szegély eltér a szabályos szegélytől (sarkonként 3, sorvégenként a sor szeme szerint), ezért még nem írható ki.',
  'border-after-turn': 'A szegély az utolsó sor fordulása után kezdődik.',
  'border-already': 'A darabnak már van szegélye.',
  'border-stitch-missing': 'A szegély szeme nincs a könyvtárban.',

  /* ---- Forma ---- */
  'shape-basic-stitch-only': 'Ehhez a generátorhoz alapszemet válassz: rövidpálca, félpálca, egyráhajtásos vagy kétráhajtásos pálca.',
  'shape-width-range': (data) => `A szélesség 0 és ${num(data, 'max')} cm közötti szám legyen.`,
  'shape-height-range': (data) => `A magasság 0 és ${num(data, 'max')} cm közötti szám legyen.`,
  'shape-angle-range': 'Az él szöge 1° és 89° közötti szám legyen.',
  'shape-top-width-range': (data) => `A felső él 0 és ${num(data, 'max')} cm közötti szám legyen.`,
  'shape-repeat-rectangle-only': 'Mintaismétlés most csak téglalapnál választható.',
  'shape-repeat-width-range': (data) => `Az ismétlés szemszáma (X) 1 és ${num(data, 'max')} közötti egész szám legyen.`,
  'shape-repeat-edge-range': (data) => `A szélső szemek száma (Y) 0 és ${num(data, 'max')} közötti egész szám legyen.`,
  'shape-border-repeat-width-range': (data) => `A szegélysor ismétlésének szemszáma (X) 1 és ${num(data, 'max')} közötti egész szám legyen.`,
  'shape-border-repeat-edge-range': (data) =>
    `A szegélysor élenkénti kiegyenlítő szemeinek száma (Y) 0 és ${num(data, 'max')} közötti egész szám legyen.`,
  'shape-too-narrow': (data) => `Ilyen keskeny formához legalább ${num(data, 'min')} szem kell: adj meg nagyobb szélességet.`,
  'shape-max-stitches-width': (data) => `Egy sorban legfeljebb ${num(data, 'max')} szem lehet: adj meg kisebb szélességet.`,
  'shape-max-stitches-size': (data) => `Egy sorban legfeljebb ${num(data, 'max')} szem lehet: adj meg kisebb méretet.`,
  'shape-trapezoid-equal-edges': 'A trapéz két éle egyforma hosszú lenne: adj meg magasságot, vagy más felső élt.',
  'shape-diamond-too-narrow': 'A rombuszhoz szélesebb forma kell: adj meg nagyobb szélességet.',
  'shape-min-rows': (data) => `Ehhez a formához legalább ${num(data, 'rows')} sor kell: adj meg nagyobb magasságot, vagy meredekebb élt.`,
  'shape-max-rows': (data) => `Legfeljebb ${num(data, 'max')} sor lehet: adj meg kisebb magasságot, vagy laposabb élt.`,
  'shape-too-steep': 'Ilyen meredek élt ennyi sorban nem lehet horgolni: adj meg nagyobb magasságot.',
  'shape-row-too-narrow': (data) => `A(z) ${num(data, 'row')}. sor túl keskeny ehhez az alakításhoz: adj meg nagyobb méretet vagy laposabb élt.`,

  /* ---- Kendő ---- */
  'shawl-basic-stitch-only': 'Ehhez a generátorhoz alapszemet válassz: rövidpálca, félpálca, egyráhajtásos vagy kétráhajtásos pálca.',
  'shawl-size-range': (data) => `A méret 0 és ${num(data, 'max')} cm közötti szám legyen.`,
  'shawl-length-range': (data) => `A hossz 0 és ${num(data, 'max')} cm közötti szám legyen.`,
  'shawl-rate-range': (data) => `A választott szaporítás 0-nál nagyobb, legfeljebb ${num(data, 'max')} legyen.`,
  'shawl-edging-width-range': (data) => `Az ismétlés szemszáma (X) 1 és ${num(data, 'max')} közötti egész szám legyen.`,
  'shawl-edging-edge-range': (data) => `A szélső szemek száma (Y) 0 és ${num(data, 'max')} közötti egész szám legyen.`,
  'shawl-blocking-range': 'A blokkolási nyúlás −50 és 100% közötti szám legyen.',
  'shawl-min-rows': (data) => `Ehhez a kendőhöz legalább ${num(data, 'rows')} ${huNoun(data)} kell: adj meg nagyobb méretet.`,
  'shawl-max-rows': (data) => `Legfeljebb ${num(data, 'max')} ${huNoun(data)} lehet: adj meg kisebb méretet.`,
  'shawl-max-stitches': (data) => `${isRound(data) ? 'Egy körben' : 'Egy sorban'} legfeljebb ${num(data, 'max')} szem lehet: adj meg kisebb méretet.`,
  'shawl-max-total': 'A kendőben legfeljebb 30 000 szem lehet: adj meg kisebb méretet vagy vastagabb fonalat.',
  'shawl-first-row-into-one': (data) => `Az 1. sor egy láncszembe megy, abba legfeljebb ${num(data, 'max')} szem fér: válassz kisebb szaporítást.`,
  'shawl-min-rows-depth': 'Ehhez a kendőhöz legalább 2 sor kell: adj meg nagyobb mélységet.',
  'shawl-max-rows-depth': (data) => `Legfeljebb ${num(data, 'max')} sor lehet: adj meg kisebb mélységet.`,
  'shawl-min-rows-edge': 'Ehhez a kendőhöz legalább 2 sor kell: adj meg hosszabb élt.',
  'shawl-max-rows-edge': (data) => `Legfeljebb ${num(data, 'max')} sor lehet: adj meg rövidebb élt.`,
  'shawl-min-rows-radius': 'Ehhez a kendőhöz legalább 2 sor kell: adj meg nagyobb sugarat.',
  'shawl-max-rows-radius': (data) => `Legfeljebb ${num(data, 'max')} sor lehet: adj meg kisebb sugarat.`,
  'shawl-double-limit': 'Egy sorban legfeljebb duplázni lehet: válassz kisebb szaporítást.',
  'shawl-min-rounds-radius': 'Ehhez a kendőhöz legalább 2 kör kell: adj meg nagyobb sugarat.',
  'shawl-max-rounds-radius': (data) => `Legfeljebb ${num(data, 'max')} kör lehet: adj meg kisebb sugarat.`,
  'shawl-edging-rows': 'Az utolsó sor nem igazítható ehhez a szegélyhez: válassz kisebb ismétlést, vagy több sort.',
  'shawl-edging-round': 'Az utolsó kör nem igazítható ehhez a szegélyhez: válassz kisebb ismétlést.',
  'shawl-row-plan-mismatch': (data) => `A(z) ${num(data, 'row')}. sor terve nem illik az előző sorhoz: ez a program hibája, kérlek, jelezd.`,
  'shawl-too-many-into-one': (data) =>
    `A(z) ${num(data, 'row')}. sorban egy szembe ${num(data, 'count')} szem kerülne: válassz kisebb szaporítást, vagy nagyobb méretet.`,

  /* ---- Közös belső hiba ---- */
  'internal-error': (data) => {
    const rule = str(data, 'rule');
    if (rule !== '') return `A generált minta nem ment át az ellenőrzőn (${rule}): ez a program hibája, kérlek, jelezd.`;
    const row = num(data, 'row');
    if (row > 0) return `A(z) ${row}. ${huNoun(data)} szemszáma nem a terv szerinti: ez a program hibája, kérlek, jelezd.`;
    return 'A sorok terve hiányos: ez a program hibája, kérlek, jelezd.';
  },
};

const en: Entries = {
  /* ---- Border ---- */
  'border-single-crochet-only': 'The border can only be single crochet for now.',
  'border-needs-row': 'A border needs at least one row.',
  'border-rows-only': 'The border is only made around a piece worked in rows for now.',
  'border-needs-stitches': 'Every row needs stitches for the border.',
  'border-not-regular': 'The border differs from the regular border (3 into each corner, per row end by the stitch of the row), so it cannot be written out yet.',
  'border-after-turn': 'The border starts after the turn of the last row.',
  'border-already': 'The piece already has a border.',
  'border-stitch-missing': 'The stitch of the border is not in the library.',

  /* ---- Shape ---- */
  'shape-basic-stitch-only': 'Choose a basic stitch for this generator: single, half double, double or treble crochet.',
  'shape-width-range': (data) => `The width should be a number between 0 and ${num(data, 'max')} cm.`,
  'shape-height-range': (data) => `The height should be a number between 0 and ${num(data, 'max')} cm.`,
  'shape-angle-range': 'The angle of the edge should be a number between 1° and 89°.',
  'shape-top-width-range': (data) => `The top edge should be a number between 0 and ${num(data, 'max')} cm.`,
  'shape-repeat-rectangle-only': 'A stitch repeat can only be chosen for a rectangle for now.',
  'shape-repeat-width-range': (data) => `The stitch count of the repeat (X) should be a whole number between 1 and ${num(data, 'max')}.`,
  'shape-repeat-edge-range': (data) => `The number of edge stitches (Y) should be a whole number between 0 and ${num(data, 'max')}.`,
  'shape-border-repeat-width-range': (data) => `The stitch count of the border row repeat (X) should be a whole number between 1 and ${num(data, 'max')}.`,
  'shape-border-repeat-edge-range': (data) =>
    `The number of balancing stitches per edge in the border row (Y) should be a whole number between 0 and ${num(data, 'max')}.`,
  'shape-too-narrow': (data) => `Such a narrow shape needs at least ${num(data, 'min')} stitches: give a larger width.`,
  'shape-max-stitches-width': (data) => `A row can have at most ${num(data, 'max')} stitches: give a smaller width.`,
  'shape-max-stitches-size': (data) => `A row can have at most ${num(data, 'max')} stitches: give a smaller size.`,
  'shape-trapezoid-equal-edges': 'The two edges of the trapezoid would be the same length: give a height, or a different top edge.',
  'shape-diamond-too-narrow': 'A rhombus needs a wider shape: give a larger width.',
  'shape-min-rows': (data) => `This shape needs at least ${num(data, 'rows')} rows: give a larger height, or a steeper edge.`,
  'shape-max-rows': (data) => `There can be at most ${num(data, 'max')} rows: give a smaller height, or a flatter edge.`,
  'shape-too-steep': 'Such a steep edge cannot be crocheted in this many rows: give a larger height.',
  'shape-row-too-narrow': (data) => `Row ${num(data, 'row')} is too narrow for this shaping: give a larger size or a flatter edge.`,

  /* ---- Shawl ---- */
  'shawl-basic-stitch-only': 'Choose a basic stitch for this generator: single, half double, double or treble crochet.',
  'shawl-size-range': (data) => `The size should be a number between 0 and ${num(data, 'max')} cm.`,
  'shawl-length-range': (data) => `The length should be a number between 0 and ${num(data, 'max')} cm.`,
  'shawl-rate-range': (data) => `The chosen increase rate should be greater than 0 and at most ${num(data, 'max')}.`,
  'shawl-edging-width-range': (data) => `The stitch count of the repeat (X) should be a whole number between 1 and ${num(data, 'max')}.`,
  'shawl-edging-edge-range': (data) => `The number of edge stitches (Y) should be a whole number between 0 and ${num(data, 'max')}.`,
  'shawl-blocking-range': 'The blocking stretch should be a number between −50 and 100%.',
  'shawl-min-rows': (data) => `This shawl needs at least ${num(data, 'rows')} ${isRound(data) ? 'rounds' : 'rows'}: give a larger size.`,
  'shawl-max-rows': (data) => `There can be at most ${num(data, 'max')} ${isRound(data) ? 'rounds' : 'rows'}: give a smaller size.`,
  'shawl-max-stitches': (data) =>
    `${isRound(data) ? 'A round' : 'A row'} can have at most ${num(data, 'max')} stitches: give a smaller size.`,
  'shawl-max-total': 'The shawl can have at most 30,000 stitches: give a smaller size or a thicker yarn.',
  'shawl-first-row-into-one': (data) =>
    `Row 1 goes into a single chain, which fits at most ${num(data, 'max')} stitches: choose a smaller increase rate.`,
  'shawl-min-rows-depth': 'This shawl needs at least 2 rows: give a larger depth.',
  'shawl-max-rows-depth': (data) => `There can be at most ${num(data, 'max')} rows: give a smaller depth.`,
  'shawl-min-rows-edge': 'This shawl needs at least 2 rows: give a longer edge.',
  'shawl-max-rows-edge': (data) => `There can be at most ${num(data, 'max')} rows: give a shorter edge.`,
  'shawl-min-rows-radius': 'This shawl needs at least 2 rows: give a larger radius.',
  'shawl-max-rows-radius': (data) => `There can be at most ${num(data, 'max')} rows: give a smaller radius.`,
  'shawl-double-limit': 'A row can at most double: choose a smaller increase rate.',
  'shawl-min-rounds-radius': 'This shawl needs at least 2 rounds: give a larger radius.',
  'shawl-max-rounds-radius': (data) => `There can be at most ${num(data, 'max')} rounds: give a smaller radius.`,
  'shawl-edging-rows': 'The last row cannot be fitted to this edging: choose a smaller repeat, or more rows.',
  'shawl-edging-round': 'The last round cannot be fitted to this edging: choose a smaller repeat.',
  'shawl-row-plan-mismatch': (data) => `The plan of row ${num(data, 'row')} does not fit the previous row: this is a bug, please report it.`,
  'shawl-too-many-into-one': (data) =>
    `Row ${num(data, 'row')} would put ${num(data, 'count')} stitches into one stitch: choose a smaller increase rate, or a larger size.`,

  /* ---- Shared internal error ---- */
  'internal-error': (data) => {
    const rule = str(data, 'rule');
    if (rule !== '') return `The generated pattern did not pass the checker (${rule}): this is a bug, please report it.`;
    const row = num(data, 'row');
    if (row > 0) return `${isRound(data) ? 'Round' : 'Row'} ${row} does not have the planned stitch count: this is a bug, please report it.`;
    return 'The row plan is incomplete: this is a bug, please report it.';
  },
};

export const SHAPE_CORE_TEXTS: CoreDictionary<ShapeCode | ShawlCode | BorderCode> = { hu, en };
