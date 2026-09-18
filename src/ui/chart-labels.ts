/*
 * A diagram feliratai a minta hagyománya szerint (PQW-876): sorszám, szemszám
 * és ismétlés, számokkal.
 *
 * - CYC: a sorszám a sor kezdő oldalán, a sor végén zárójelben a szemszám
 *   (03 §2.1).
 * - Japán: a sorszám ugyanott, a szemszám „目” egységgel („18目”), az ismétlés
 *   „11目1模様” alakban (01 §6.2). A japán szó csak a számok mellett áll; a
 *   jelmagyarázat és a felület magyar marad, és a megjegyzés megmagyarázza.
 *
 * DOM nélküli, ezért a Node is futtatja (tests/ui-chart-labels.test.mjs), és a
 * magot `.ts` kiterjesztéssel importálja.
 */

import type { ChartLayout, Point } from '../core/layout.ts';
import type { RepeatSpec, Tradition } from '../core/types.ts';
import { texts } from './i18n.ts';

export interface ChartLabels {
  /** A sorszám vagy körszám a sor kezdő oldalán. */
  readonly layer: (index: number) => string;
  /** A szemszám a sor végén. */
  readonly count: (stitches: number) => string;
  /**
   * A sor felirata a rajz mellett, a sor végénél (PQW-916): a réteg neve és a
   * szemszáma, „1. sor (12)”, „Láncalap (12)”, japánul „1. sor 12目”. A nevet a
   * felület szótára adja, a szemszám alakját a hagyomány. `null` szemszámmal
   * csak a név áll ott: a varázskörnek nincs értelmes szemszáma.
   */
  readonly rowLabel: (layer: number, round: boolean, stitches: number | null) => string;
  /** Az ismétlés felirata; ha a mintának nincs ismétlése, vagy a hagyomány nem írja a diagramra, `null`. */
  readonly repeat: (spec: RepeatSpec | undefined) => string | null;
  /** A jelmagyarázat megjegyzése a feliratokról. */
  readonly note: string;
}

/**
 * A feliratok a hagyomány szerint. A japán szám és egység (18目, 縁編み) a
 * jelöléshez tartozik, ezért nem fordul; a megjegyzés a felület nyelvén szól
 * (PQW-900), és mindkét nyelven megmagyarázza a japán egységeket.
 */
export function chartLabels(tradition: Tradition): ChartLabels {
  const chart = texts().sections.chart;
  if (tradition === 'japanese') {
    return {
      layer: (index) => String(index),
      count: (stitches) => `${stitches}目`,
      rowLabel: (layer, round, stitches) => (stitches === null ? chart.layerName(layer, round) : `${chart.layerName(layer, round)} ${stitches}目`),
      repeat: (spec) => (spec ? `${spec.repeatWidth}目1模様` : null),
      note: chart.japaneseNote,
    };
  }
  return {
    layer: (index) => String(index),
    count: (stitches) => `(${stitches})`,
    rowLabel: (layer, round, stitches) => (stitches === null ? chart.layerName(layer, round) : `${chart.layerName(layer, round)} (${stitches})`),
    repeat: () => null,
    note: chart.cycNote,
  };
}

/** Egy sorfelirat a rajzon: melyik réteghez tartozik, mit mond, és hol a sor vége. */
export interface RowCaption {
  readonly layer: number;
  readonly text: string;
  /** A sor vége jobbra esik-e: a felirat ezen az oldalon áll. */
  readonly rightwards: boolean;
  /** A sor színoldala: a címke ezzel a színnel teli. */
  readonly side: 'right' | 'wrong';
  /** A sor vége diagram-koordinátában; a felirat ehhez igazodik. */
  readonly end: Point;
}

/**
 * A rajz sorfeliratai: melyik réteg kap feliratot, és milyen szöveggel (PQW-923).
 *
 * A tervező vászna és az SVG-export (így az abból rasterizált PNG is) ugyanezt
 * használja, hogy a kettő ne mondhasson mást — korábban az export a szemszámot
 * külön, a mintára írta. Csak az elhelyezés marad külön: a vásznon a felirat
 * fix képpontos, az exportban a rajzzal együtt méreteződik.
 *
 * Felirata annak van, amiben már van szem. A most megnyitott sor a
 * fordulóláncától még nem sor: a jelei ott vannak, a szemszáma mégis 0.
 */
export function rowCaptions(layout: ChartLayout, tradition: Tradition): RowCaption[] {
  const captions = chartLabels(tradition);
  const drawn = new Map<number, number>();
  for (const node of layout.nodes.values()) drawn.set(node.layer, (drawn.get(node.layer) ?? 0) + 1);
  const out: RowCaption[] = [];
  for (const layer of layout.layers) {
    const count = drawn.get(layer.index) ?? 0;
    if (count === 0) continue;
    if (layer.index > 0 && layer.stitchCount === 0) continue;
    const round = layer.shape === 'round';
    // A láncalap szemszámát a mag nem tartja nyilván (a 0. réteg 0-t mond), a rajz a saját jeleiből számolja.
    const stitches = layer.index === 0 ? (round ? null : count) : layer.writtenCount;
    out.push({
      layer: layer.index,
      text: captions.rowLabel(layer.index, round, stitches),
      rightwards: layer.start.x <= layer.end.x,
      side: layer.side,
      end: layer.end,
    });
  }
  return out;
}
