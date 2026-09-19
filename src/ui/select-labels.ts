// KB: interface.md §6

import {
  SHAPE_CHOICES as AMIGURUMI_SHAPE_CHOICES,
  STITCH_CHOICES as AMIGURUMI_STITCH_CHOICES,
  BOTTOM_CHOICES,
  JOIN_CHOICES,
  METHOD_CHOICES,
  TOP_CHOICES,
} from './amigurumi-view.ts';
import {
  KIND_CHOICES as GARMENT_KIND_CHOICES,
  STITCH_CHOICES as GARMENT_STITCH_CHOICES,
  TABLE_CHOICES,
} from './garment-view.ts';
import { MOSAIC_ROW_CHOICES, TECHNIQUE_CHOICES } from './grid-chart-view.ts';
import {
  CLOSING_CHOICES,
  JOG_CHOICES,
  SHAPE_CHOICES as ROUNDS_SHAPE_CHOICES,
  STITCH_CHOICES as ROUNDS_STITCH_CHOICES,
  START_CHOICES,
} from './rounds-view.ts';
import { MEASURE_CHOICES, ROUNDING_CHOICES, SHAPE_CHOICES, STITCH_CHOICES } from './shapes-view.ts';
import {
  RATE_CHOICES,
  KIND_CHOICES as SHAWL_KIND_CHOICES,
  STITCH_CHOICES as SHAWL_STITCH_CHOICES,
} from './shawls-view.ts';

interface Labelled {
  readonly value: string;
  readonly label: string;
}

const CHOICES: Readonly<Record<string, readonly Labelled[]>> = {
  'shape-kind': SHAPE_CHOICES,
  'shape-stitch': STITCH_CHOICES,
  'shape-measure': MEASURE_CHOICES,
  'shape-rounding': ROUNDING_CHOICES,
  'shawl-kind': SHAWL_KIND_CHOICES,
  'shawl-stitch': SHAWL_STITCH_CHOICES,
  'shawl-rate': RATE_CHOICES,
  'rounds-shape': ROUNDS_SHAPE_CHOICES,
  'rounds-stitch': ROUNDS_STITCH_CHOICES,
  'rounds-start': START_CHOICES,
  'rounds-closing': CLOSING_CHOICES,
  'rounds-jog': JOG_CHOICES,
  'amigurumi-shape': AMIGURUMI_SHAPE_CHOICES,
  'amigurumi-method': METHOD_CHOICES,
  'amigurumi-stitch': AMIGURUMI_STITCH_CHOICES,
  'amigurumi-bottom': BOTTOM_CHOICES,
  'amigurumi-top': TOP_CHOICES,
  'amigurumi-join': JOIN_CHOICES,
  'garment-kind': GARMENT_KIND_CHOICES,
  'garment-table': TABLE_CHOICES,
  'garment-stitch': GARMENT_STITCH_CHOICES,
  'grid-technique': TECHNIQUE_CHOICES,
  'grid-mosaic-rows': MOSAIC_ROW_CHOICES,
};

export function relabelSelects(root: ParentNode): void {
  for (const [id, choices] of Object.entries(CHOICES)) {
    const select = root.querySelector<HTMLSelectElement>(`#${id}`);
    if (!select) continue;
    const labels = new Map(choices.map((choice) => [choice.value, choice.label]));
    for (const option of Array.from(select.options)) {
      const label = labels.get(option.value);
      if (label !== undefined) option.textContent = label;
    }
  }
}
