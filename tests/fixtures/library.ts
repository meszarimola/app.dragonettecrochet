/*
 * The stitch library the graph tests use: the real one, plus two variants that
 * the palette does not offer but the builder can produce for any n.
 */

import { createStitchLibrary } from '../../src/core/stitch-library.ts';
import { DOUBLE_CROCHET, HALF_DOUBLE_CROCHET, STITCHES, increase } from '../../src/core/stitches.ts';

/** Two half double crochet into one stitch. */
export const HALF_DOUBLE_INCREASE = increase(HALF_DOUBLE_CROCHET, 2);

/** Three double crochet into one stitch: the chevron peak and the shell edge. */
export const DOUBLE_INCREASE_3 = increase(DOUBLE_CROCHET, 3);

export const testLibrary = createStitchLibrary([...STITCHES, HALF_DOUBLE_INCREASE, DOUBLE_INCREASE_3]);
