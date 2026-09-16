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

import type { RepeatSpec, Tradition } from '../core/types.ts';
import { texts } from './i18n.ts';

export interface ChartLabels {
  /** A sorszám vagy körszám a sor kezdő oldalán. */
  readonly layer: (index: number) => string;
  /** A szemszám a sor végén. */
  readonly count: (stitches: number) => string;
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
      repeat: (spec) => (spec ? `${spec.repeatWidth}目1模様` : null),
      note: chart.japaneseNote,
    };
  }
  return {
    layer: (index) => String(index),
    count: (stitches) => `(${stitches})`,
    repeat: () => null,
    note: chart.cycNote,
  };
}
