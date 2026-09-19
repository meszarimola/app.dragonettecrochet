// KB: 03 §2.1, 01 §6.2; interface.md §1, §3

import type { ChartLayout, Point } from '../core/layout.ts';
import type { RepeatSpec, Tradition } from '../core/types.ts';
import { texts } from './i18n.ts';

export interface ChartLabels {
  readonly layer: (index: number) => string;
  readonly count: (stitches: number) => string;
  readonly rowLabel: (layer: number, round: boolean, stitches: number | null) => string;
  readonly repeat: (spec: RepeatSpec | undefined) => string | null;
  readonly note: string;
}

export function chartLabels(tradition: Tradition): ChartLabels {
  const chart = texts().sections.chart;
  if (tradition === 'japanese') {
    return {
      layer: (index) => String(index),
      count: (stitches) => `${stitches}目`,
      rowLabel: (layer, round, stitches) =>
        stitches === null ? chart.layerName(layer, round) : `${chart.layerName(layer, round)} ${stitches}目`,
      repeat: (spec) => (spec ? `${spec.repeatWidth}目1模様` : null),
      note: chart.japaneseNote,
    };
  }
  return {
    layer: (index) => String(index),
    count: (stitches) => `(${stitches})`,
    rowLabel: (layer, round, stitches) =>
      stitches === null ? chart.layerName(layer, round) : `${chart.layerName(layer, round)} (${stitches})`,
    repeat: () => null,
    note: chart.cycNote,
  };
}

export interface RowCaption {
  readonly layer: number;
  readonly text: string;
  readonly rightwards: boolean;
  readonly side: 'right' | 'wrong';
  readonly end: Point;
}

// KB: interface.md §14
export function rowCaptions(layout: ChartLayout, tradition: Tradition): RowCaption[] {
  const captions = chartLabels(tradition);
  const drawn = new Map<number, number>();
  for (const node of layout.nodes.values()) drawn.set(node.layer, (drawn.get(node.layer) ?? 0) + 1);
  const out: RowCaption[] = [];
  for (const layer of layout.layers) {
    const count = drawn.get(layer.index) ?? 0;
    if (count === 0) continue;
    if (layer.index > 0 && layer.writtenCount === 0) continue;
    const round = layer.shape === 'round';
    const stitches = layer.index === 0 && round ? null : layer.writtenCount;
    out.push({
      layer: layer.index,
      text: captions.rowLabel(layer.index, round, stitches),
      rightwards: layer.start.x <= layer.end.x,
      side: layer.side,
      end: layer.end,
    });
  }
  return out;
}
