/*
 * The compact label a basic stitch shows in the palette grid when its notation
 * has no approved abbreviation: a shortened name, never an invented
 * abbreviation. It is keyed by the notation, not by the interface language.
 *
 * KB: 01 §8.5; interface.md §2, §53
 */

import type { Locale, StitchDefId } from '../../core/types.ts';

export const PALETTE_SHORT_LABELS: Readonly<Record<Locale, Readonly<Partial<Record<StitchDefId, string>>>>> = {
  hu: { dtr: 'háromráhajtásos' },
  'en-US': {},
  'en-GB': {},
};
