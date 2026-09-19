// KB: interface.md §1, §22, §24 — here the mode is the crocheter's; stored it flips on a wrong-side row.

import { effectiveInsertion, stitchInsertions } from '../core/insertion.ts';
import { refOf, VOCABULARIES } from '../core/pattern-text.ts';
import type { Locale, StitchDef, StitchInsertion } from '../core/types.ts';
import { texts, uiLanguage } from './i18n.ts';

export interface InsertionOption {
  readonly mode: StitchInsertion;
  readonly label: string;
}

export interface InsertionChoice {
  readonly options: readonly InsertionOption[];
  readonly selected: StitchInsertion;
  readonly written: string | null;
}

export function insertionChoice(
  def: StitchDef | undefined,
  preferred: StitchInsertion,
  terms: Locale,
): InsertionChoice | null {
  if (!def) return null;
  const allowed = stitchInsertions(def);
  const selected = effectiveInsertion(def, preferred);
  if (allowed.length < 2 || !selected) return null;
  const plain = def.kind === 'basic' || def.kind === 'slip';
  const names = texts().sections.insertion.names;
  return {
    options: allowed.map((mode) => ({ mode, label: capitalize(names[mode]) })),
    selected,
    written: plain ? VOCABULARIES[terms].mode(selected, refOf(def, terms)) : null,
  };
}

export function insertionSuffix(mode: StitchInsertion | undefined): string {
  return mode && mode !== 'both-loops' ? `, ${texts().sections.insertion.names[mode]}` : '';
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase(uiLanguage()) + text.slice(1);
}
