/*
 * Fordítási próba: a gráf-tesztek öltés-mintái és kidolgozott példái a
 * src/core/types.ts felületén épülnek. Nem fut; az `npm run check`
 * ellenőrzi (tsconfig.core.json), a fixture-öket is, amelyeket importál.
 */

import { WORKED_EXAMPLES } from './fixtures/examples.ts';
import { TEST_STITCHES } from './fixtures/stitch-defs.ts';
import type { Pattern, StitchDef } from '../src/core/types.ts';

export const examples: Pattern[] = Object.values(WORKED_EXAMPLES).map((make) => make().pattern);
export const stitches: readonly StitchDef[] = TEST_STITCHES;
