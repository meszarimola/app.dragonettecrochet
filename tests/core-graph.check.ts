/*
 * A compile-time probe: the graph tests' worked examples are built through the
 * core's public types. It never runs; `npm run check` exercises it through
 * tsconfig.core.json, along with the fixtures it imports.
 */

import type { StitchLibrary } from '../src/core/stitch-library.ts';
import type { Pattern } from '../src/core/types.ts';
import { WORKED_EXAMPLES } from './fixtures/examples.ts';
import { testLibrary } from './fixtures/library.ts';

export const examples: Pattern[] = Object.values(WORKED_EXAMPLES).map((make) => make().pattern);
export const library: StitchLibrary = testLibrary;
