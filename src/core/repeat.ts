import { skippedChains } from './tradition.ts';
import type { RepeatSpec, Tradition } from './types.ts';

// KB: 03 §1.2
export function foundationChainLength(
  stitches: number,
  turningChain: number,
  turningChainCounts: boolean,
  _tradition: Tradition = 'cyc',
): number {
  return stitches + skippedChains(turningChain, turningChainCounts);
}

export interface RepeatCounts {
  // KB: core-geometry §1
  readonly chains: number;
  readonly workedChains: number;
  // KB: 03 §4.2, core-geometry §1
  readonly firstRowPositions: number;
}

// KB: 03 §4.1
export function repeatCounts(
  spec: RepeatSpec,
  repeats: number,
  turningChain: number,
  turningChainCounts: boolean,
  _tradition: Tradition = 'cyc',
): RepeatCounts {
  const multiple = spec.repeatWidth * repeats + spec.edgeStitches;
  const workedChains = spec.turningChainIncluded ? multiple - turningChain : multiple;
  return {
    chains: workedChains + skippedChains(turningChain, turningChainCounts),
    workedChains,
    firstRowPositions: workedChains,
  };
}
