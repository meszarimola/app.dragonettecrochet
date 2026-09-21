// KB: interface.md §1, §9

import type { GridKind } from '../core/grid.ts';
import { texts } from './i18n.ts';

export type PatternTypeId = 'regular' | 'filet' | 'amigurumi' | 'irregular';

export interface PatternType {
  readonly id: PatternTypeId;
  readonly name: string;
  readonly detail: string;
  readonly available: boolean;
}

// The getters resolve at read time, so the list follows a language change without rebuilding.
const patternType = (id: PatternTypeId, available: boolean): PatternType => ({
  id,
  available,
  get name(): string {
    return texts().sections.types.menu[id].name;
  },
  get detail(): string {
    return texts().sections.types.menu[id].detail;
  },
});

// KB: interface.md §56 — the free-form designer leads the menu (PQW-990).
export const PATTERN_TYPES: readonly PatternType[] = [
  patternType('irregular', true),
  patternType('regular', true),
  // KB: interface.md §9 — disabled, not withdrawn.
  patternType('filet', false),
  patternType('amigurumi', false),
];

export const DEFAULT_PATTERN_TYPE: PatternTypeId = 'regular';

export const AMIGURUMI_WRITTEN_SHARE = 0.7;

// KB: interface.md §10
export function writtenShareFor(type: PatternTypeId, narrow: boolean): number | null {
  if (type !== 'amigurumi') return null;
  return narrow ? 1 : AMIGURUMI_WRITTEN_SHARE;
}

// KB: interface.md §10
export function gridKind(type: PatternTypeId, shape: 'row' | 'round'): GridKind {
  if (type === 'filet') return 'cells';
  if (type === 'amigurumi') return 'text';
  return shape === 'round' ? 'rounds' : 'rows';
}

export function isAvailableType(id: string): id is PatternTypeId {
  return PATTERN_TYPES.some((type) => type.id === id && type.available);
}
