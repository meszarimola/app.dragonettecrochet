// KB: 01 §2.2, 01 §3.3, 01 §8.3, 03 §1.2, 03 §1.3

import type { Layer, PatternConventions, RowConventions, StitchDef, Tradition } from './types.ts';

export const TRADITIONS: readonly Tradition[] = ['cyc', 'japanese'];

export function traditionOf(conventions: PatternConventions): Tradition {
  return conventions.tradition ?? 'cyc';
}

export function stitchTurningChainCounts(def: StitchDef, tradition: Tradition, shape: Layer['shape']): boolean {
  if (tradition === 'japanese') return def.turningChain >= 2;
  return shape === 'row' ? def.turningChain >= 1 : def.turningChainCounts;
}

export function turningChainCountsFor(
  setting: RowConventions['turningChainCounts'],
  def: StitchDef,
  tradition: Tradition,
  shape: Layer['shape'],
): boolean {
  return setting === 'stitch-default' ? stitchTurningChainCounts(def, tradition, shape) : setting;
}

// KB: core-domain §5; 03 §1.2
export function skippedChains(turningChain: number, turningChainCounts: boolean): number {
  return turningChainCounts ? Math.max(2, turningChain) : turningChain;
}

export function firstChainFromHook(turningChain: number, turningChainCounts: boolean, _tradition: Tradition): number {
  return skippedChains(turningChain, turningChainCounts) + 1;
}

export function withTradition(conventions: PatternConventions, tradition: Tradition): PatternConventions {
  const rest = Object.fromEntries(
    Object.entries(conventions).filter(([key]) => key !== 'tradition'),
  ) as unknown as PatternConventions;
  return tradition === 'cyc' ? rest : { ...rest, tradition };
}
