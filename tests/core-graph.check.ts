/*
 * Fordítási próba: a gráf-tesztek kidolgozott példái a src/core/types.ts
 * felületén épülnek. Nem fut; az `npm run check` ellenőrzi
 * (tsconfig.core.json), a fixture-öket is, amelyeket importál.
 */

import { WORKED_EXAMPLES } from './fixtures/examples.ts';
import { testLibrary } from './fixtures/library.ts';
import type { StitchLibrary } from '../src/core/stitch-library.ts';
import type { Pattern } from '../src/core/types.ts';

export const examples: Pattern[] = Object.values(WORKED_EXAMPLES).map((make) => make().pattern);
export const library: StitchLibrary = testLibrary;
