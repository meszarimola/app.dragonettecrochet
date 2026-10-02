import type { StitchDefId } from './types.ts';

export interface PlacedStitch {
  readonly id: number;
  readonly stitch: StitchDefId;
  readonly x: number;
  readonly y: number;
}

export interface FreeformChart {
  readonly stitches: readonly PlacedStitch[];
  readonly nextId: number;
}

export function emptyChart(): FreeformChart {
  return { stitches: [], nextId: 1 };
}

export function placeStitch(chart: FreeformChart, stitch: StitchDefId, x: number, y: number): FreeformChart {
  return {
    stitches: [...chart.stitches, { id: chart.nextId, stitch, x, y }],
    nextId: chart.nextId + 1,
  };
}
