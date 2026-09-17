/*
 * A rácsos terület magból jövő üzenetei (PQW-904): a rács célzása (grid.ts), a
 * rácsminta (pixel-chart.ts), a filé, a mozaik, a C2C és a színes rácsok.
 *
 * A mag kódot és adatot ad (`CoreText`), a mondat itt készül. A magyar névelő
 * (`article`), a ragozás („…ban”, „…szemeibe”), a sor és a kör szava, a
 * „varázskör”/„láncalap” és a szín szava is ide tartozik: a magban csak
 * rétegszám, sorszám, cellaszám, színindex és `shape` van.
 *
 * A magyar ág betűre a korábbi magbeli szöveg: a magyar felület nem változik.
 *
 * DOM nélküli, ezért a Node is futtatja.
 */

import type { C2CCode } from '../../../core/c2c.ts';
import type { ColorworkCode } from '../../../core/colorwork.ts';
import type { FiletCode } from '../../../core/filet.ts';
import type { GridAimCode } from '../../../core/grid.ts';
import type { GridPatternCode } from '../../../core/grid-pattern.ts';
import { article } from '../../../core/hungarian.ts';
import type { CoreText } from '../../../core/messages.ts';
import type { MosaicCode } from '../../../core/mosaic.ts';
import { colorLetter, type ChartCode } from '../../../core/pixel-chart.ts';
import { uiLanguage } from '../../i18n.ts';
import { isRound, num, renderCoreText, str, type CoreDictionary } from './render.ts';

/** A terület minden kódja: ha a magban új születik, a szótár fordítási hibát ad. */
export type GridCoreCode = GridAimCode | GridPatternCode | ChartCode | FiletCode | MosaicCode | C2CCode | ColorworkCode;

/* ---- Magyar nyelvtan: a névelő, a sor neve és a szín szava ---- */

/**
 * A rács sorának neve: „A 3. sor”, „Az 5. sor”, nagybetűs határozott névelővel.
 *
 * A rács a horgolt sorokat számozza 1-től, a láncalap viszont maga az 1. sor
 * (PQW-923), ezért a kiírt szám eggyel nagyobb — így a rács üzenete ugyanazt a
 * sort nevezi meg, mint a rajz felirata és az írott minta.
 */
const gridRow = (row: number): number => row + 1;

function huRow(row: number): string {
  const shown = gridRow(row);
  const word = article(shown);
  return `${word.charAt(0).toUpperCase()}${word.slice(1)} ${shown}. sor`;
}

/** „az A szín”, „a B szín”: a mag a szín indexét adja. */
const huColor = (index: number) => `${index === 0 ? 'az' : 'a'} ${colorLetter(index)} szín`;

/**
 * A réteg neve a mondat közepén: „a varázskör”, „az 1. sor”, „a 3. kör”.
 *
 * Sorokban a láncalap az 1. sor (PQW-923), ezért a kiírt szám a réteg indexénél
 * eggyel nagyobb. Körben a számozás változatlan, és a körös kezdés a nevén áll.
 */
function huLayer(layer: number, round: boolean, start: string): string {
  if (round) return layer === 0 ? (start === 'ring' ? 'a varázskör' : 'a láncalap') : `${article(layer)} ${layer}. kör`;
  // A `row` itt már a kiírt sorszám (a réteg indexe + 1), ezért nem megy rajta a `gridRow`.
  const row = layer + 1;
  return `${article(row)} ${row}. sor`;
}

/** Hova horgolhatsz: a varázskörbe, különben a réteg szemeibe. */
const huInto = (layer: number, round: boolean, start: string) =>
  layer === 0 && start === 'ring' ? 'a varázskörbe' : `${huLayer(layer, round, start)} szemeibe`;

/** A közös utótag: a kattintás nem rakott le szemet. */
const HU_NOTHING = 'Nem került le szem.';
const EN_NOTHING = 'No stitch was worked.';

const enLayer = (layer: number, round: boolean, start: string) =>
  round
    ? layer === 0
      ? start === 'ring'
        ? 'the magic ring'
        : 'the foundation chain'
      : `round ${layer}`
    : `row ${layer + 1}`;

const enInto = (layer: number, round: boolean, start: string) =>
  layer === 0 && start === 'ring' ? 'into the magic ring' : `into the stitches of ${enLayer(layer, round, start)}`;

const capitalize = (value: string) => `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

export const GRID_CORE_TEXTS: CoreDictionary<GridCoreCode> = {
  hu: {
    /* ---- Célzás a rácson (grid.ts) ---- */
    'aim-no-stitch': `Ebben a cellában nincs mibe horgolni: alatta nincs szem. ${HU_NOTHING}`,
    'aim-not-target': `Ide nem horgolhatsz: ez a hely nem célpont (például nem számító fordulólánc). ${HU_NOTHING}`,
    'aim-other-layer': (data) => {
      const round = isRound(data);
      const start = str(data, 'start');
      const [layer, current] = [num(data, 'layer'), num(data, 'current')];
      const here = huLayer(layer, round, start);
      const working = huLayer(current, round, start);
      return `Ez ${here} egyik helye. Most ${working} készül: csak ${huInto(current - 1, round, start)} horgolhatsz. ${HU_NOTHING}`;
    },

    /* ---- A generált minta (grid-pattern.ts) ---- */
    'pattern-invalid': (data) => `A generált minta nem ment át az ellenőrzőn (${str(data, 'rule')}): ez a program hibája, kérlek, jelezd.`,

    /* ---- Ismétlő egység és rács (pixel-chart.ts) ---- */
    'unit-empty-grid': 'A rács üres: adj meg legalább egy sort.',
    'unit-not-found': 'Nem találtam ismétlődést: rajzolj legalább két teljes ismétlést, vagy jelöld meg az ismétlő egységet.',
    'unit-incomplete': (data) => {
      const row = num(data, 'row');
      return `Az ismétlő egység (${num(data, 'width')} × ${num(data, 'height')} cella) nem teljes: add meg ${article(gridRow(row))} ${gridRow(row)}. sor ${num(data, 'cell')}. celláját.`;
    },
    'unit-size': 'Az ismétlő egység mérete és helye pozitív egész szám legyen.',
    'unit-outside': 'Az ismétlő egység a megadott rácson belül legyen.',
    'mirror-lettering':
      'Tükrözött nézet: a feliratos motívumban a betűk fordítva állnak. Balkezes horgolásnál a rácsot tükrözd, hogy a felirat olvasható maradjon.',
    'mirror-asymmetric': 'Tükrözött nézet: a motívum nem szimmetrikus, ezért balkezes horgolásnál fordítva áll.',
    'chart-no-rows': 'Adj meg legalább egy sort.',
    'chart-size': (data) => `A rács legfeljebb ${num(data, 'max')} × ${num(data, 'max')} cella, és minden sora egyforma széles legyen.`,
    'chart-no-colors': 'Adj meg legalább egy színt.',
    'chart-too-many-colors': (data) => `Legfeljebb ${num(data, 'max')} szín lehet.`,
    'chart-color-index': 'Minden cellának a színlista egyik színe legyen.',

    /* ---- Filé (filet.ts) ---- */
    'filet-no-rows': 'Adj meg legalább egy sort.',
    'filet-too-many-rows': (data) => `Legfeljebb ${num(data, 'max')} sor lehet.`,
    'filet-ragged': (data) => `Minden sor ugyanannyi cella legyen, legfeljebb ${num(data, 'max')}.`,
    'filet-cell-kind': 'Filében a cella teli, nyitott vagy üres hely lehet.',
    'filet-empty-row': (data) => `${huRow(num(data, 'row'))}ban nincs cella: a filé minden sora legalább egy cella.`,
    'filet-gap-row': (data) => `${huRow(num(data, 'row'))}ban a cellák között üres hely van: a filé sora folytonos.`,
    'filet-extend-counting': (data) => `${huRow(num(data, 'row'))} végi szaporításhoz a fordulóláncnak szemnek kell számítania.`,
    'filet-extend-open': (data) =>
      `${huRow(num(data, 'row'))} végén az új cella csak nyitott lehet (2 lsz és hosszú pálca): rajzold nyitottnak, és a teli cellát a következő sorban töltsd ki.`,
    'filet-extend-reach': (data) =>
      `${huRow(num(data, 'row'))} végén a szaporítás nem éri el a két sorral lejjebbi szemet, mert az előző sor eleji fogyasztással kezdődött: told el egy sorral.`,

    /* ---- Mozaik (mosaic.ts) ---- */
    'mosaic-two-colors': 'A mozaik két színnel készül: a sorok színe váltakozik.',
    'mosaic-min-width': 'A mozaik sora legalább 3 cella: a két szélső cella mindig a sor színe.',
    'mosaic-base-row': (data) => `Az 1. sor az alapsor: minden cellája ${huColor(num(data, 'color'))} legyen.`,
    'mosaic-edge-colors': (data) => `${huRow(num(data, 'row'))} két szélső cellája ${huColor(num(data, 'color'))} legyen: a sor szélén nincs kihagyás.`,
    'mosaic-stacked-skip': (data) =>
      `${huRow(num(data, 'row'))} ${num(data, 'cell')}. cellája alatt is kihagyás van: mozaikban két kihagyás nem kerülhet egymás fölé.`,

    /* ---- C2C és színes rácsok ---- */
    'c2c-turning-chain': 'A C2C-csempe 3 láncszeme az első pálca helyett áll: a mintában a pálca fordulóláncának szemnek kell számítania.',
    'c2c-repeated-increase':
      'Ez a C2C-alakzat egyelőre nem készíthető el: a program a csempék láncívét még nem tudja minden alakzatban helyesen felépíteni. Ma az 1 × 1 és a 2 × 1 méret működik.',
    'colorwork-min-width': 'Ha a fordulólánc szemnek számít, a sor legalább 2 cella legyen.',
  },
  en: {
    'aim-no-stitch': `There is nothing to work into in this cell: there is no stitch below it. ${EN_NOTHING}`,
    'aim-not-target': `You cannot work here: this spot is not a target (a turning chain that does not count, for example). ${EN_NOTHING}`,
    'aim-other-layer': (data) => {
      const round = isRound(data);
      const start = str(data, 'start');
      const [layer, current] = [num(data, 'layer'), num(data, 'current')];
      const working = capitalize(enLayer(current, round, start));
      return `This is a spot in ${enLayer(layer, round, start)}. ${working} is being worked: you can only work ${enInto(current - 1, round, start)}. ${EN_NOTHING}`;
    },

    'pattern-invalid': (data) => `The generated pattern did not pass the checker (${str(data, 'rule')}): this is a bug in the program, please report it.`,

    'unit-empty-grid': 'The grid is empty: give at least one row.',
    'unit-not-found': 'No repeat found: draw at least two full repeats, or mark the repeating unit.',
    'unit-incomplete': (data) =>
      `The repeating unit (${num(data, 'width')} × ${num(data, 'height')} cells) is not complete: give cell ${num(data, 'cell')} of row ${gridRow(num(data, 'row'))}.`,
    'unit-size': 'The size and the position of the repeating unit must be positive whole numbers.',
    'unit-outside': 'The repeating unit must be inside the grid you gave.',
    'mirror-lettering':
      'Mirrored view: in a motif with lettering the letters are reversed. For left-handed crochet mirror the grid so that the lettering stays readable.',
    'mirror-asymmetric': 'Mirrored view: the motif is not symmetric, so in left-handed crochet it is reversed.',
    'chart-no-rows': 'Give at least one row.',
    'chart-size': (data) => `The grid is at most ${num(data, 'max')} × ${num(data, 'max')} cells, and every row must be the same width.`,
    'chart-no-colors': 'Give at least one colour.',
    'chart-too-many-colors': (data) => `At most ${num(data, 'max')} colours are allowed.`,
    'chart-color-index': 'Every cell must be one of the colours in the colour list.',

    'filet-no-rows': 'Give at least one row.',
    'filet-too-many-rows': (data) => `At most ${num(data, 'max')} rows are allowed.`,
    'filet-ragged': (data) => `Every row must have the same number of cells, at most ${num(data, 'max')}.`,
    'filet-cell-kind': 'In filet a cell can be filled, open or an empty space.',
    'filet-empty-row': (data) => `Row ${gridRow(num(data, 'row'))} has no cells: every filet row is at least one cell.`,
    'filet-gap-row': (data) => `There is an empty space between the cells of row ${gridRow(num(data, 'row'))}: a filet row is continuous.`,
    'filet-extend-counting': (data) => `For an increase at the end of row ${gridRow(num(data, 'row'))} the turning chain has to count as a stitch.`,
    'filet-extend-open': (data) =>
      `The new cell at the end of row ${gridRow(num(data, 'row'))} can only be open (2 ch and a long stitch): draw it open, and fill the solid cell in the next row.`,
    'filet-extend-reach': (data) =>
      `The increase at the end of row ${gridRow(num(data, 'row'))} does not reach the stitch two rows below, because the previous row started with a decrease: move it one row.`,

    'mosaic-two-colors': 'Mosaic is worked with two colours: the colour of the rows alternates.',
    'mosaic-min-width': 'A mosaic row is at least 3 cells: the two outer cells are always the colour of the row.',
    'mosaic-base-row': (data) => `Row 1 is the base row: every cell must be colour ${colorLetter(num(data, 'color'))}.`,
    'mosaic-edge-colors': (data) =>
      `The two outer cells of row ${gridRow(num(data, 'row'))} must be colour ${colorLetter(num(data, 'color'))}: there is no skip at the edge of a row.`,
    'mosaic-stacked-skip': (data) =>
      `There is a skip under cell ${num(data, 'cell')} of row ${gridRow(num(data, 'row'))} as well: in mosaic two skips cannot sit on top of each other.`,

    'c2c-turning-chain':
      'The 3 chains of a C2C tile stand in place of the first double crochet: in the pattern the turning chain of the double crochet has to count as a stitch.',
    'c2c-repeated-increase':
      'This C2C shape cannot be made yet: the program cannot build the chain space of the tiles correctly in every shape. For now 1 × 1 and 2 × 1 work.',
    'colorwork-min-width': 'If the turning chain counts as a stitch, a row must be at least 2 cells.',
  },
};

/** A magból jövő rácsos üzenet mondata a felület mostani nyelvén. */
export function gridCoreText(message: CoreText<GridCoreCode>): string {
  return renderCoreText(GRID_CORE_TEXTS[uiLanguage()], message);
}
