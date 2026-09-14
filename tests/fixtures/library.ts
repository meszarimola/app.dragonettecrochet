/*
 * A gráf tesztjeinek öltéskönyvtára: a valódi könyvtár (src/core/stitches.ts,
 * PQW-867), kiegészítve két változattal, amely a palettán nem szerepel, de az
 * építőfüggvény bármilyen n-re elkészíti.
 */

import { createStitchLibrary } from '../../src/core/stitch-library.ts';
import { DOUBLE_CROCHET, HALF_DOUBLE_CROCHET, STITCHES, increase } from '../../src/core/stitches.ts';

/** Két félpálca egy öltésbe: `inc-2hdc`. */
export const HALF_DOUBLE_INCREASE = increase(HALF_DOUBLE_CROCHET, 2);

/** Három egyráhajtásos pálca egy öltésbe, a cikcakk csúcsa és a kagyló szélső fele: `inc-3dc`. */
export const DOUBLE_INCREASE_3 = increase(DOUBLE_CROCHET, 3);

export const testLibrary = createStitchLibrary([...STITCHES, HALF_DOUBLE_INCREASE, DOUBLE_INCREASE_3]);
