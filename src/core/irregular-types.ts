// The free-form chart document. KB: core-domain §8, core-domain §11

import type { PatternNotation, StitchInsertion } from './types.ts';

/** Rises on every backwards-incompatible change, independently of the regular pattern. */
export const IRREGULAR_FORMAT_VERSION = 1;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export type RowKind = 'row' | 'round';

/** `ltr`/`rtl` belong to a row, `cw`/`ccw` to a round. */
export type RowDirection = 'ltr' | 'rtl' | 'cw' | 'ccw';

export interface IrregularRow {
  readonly id: string;
  readonly kind: RowKind;
  readonly direction: RowDirection;
  readonly color: string | null;
  readonly visible: boolean;
  readonly locked: boolean;
  /** `auto` reads the order off the positions; a list is the crocheter's own. */
  readonly order?: 'auto' | readonly string[];
}

export interface IrregularLayer {
  readonly id: string;
  readonly name: string;
  readonly visible: boolean;
  readonly locked: boolean;
}

/**
 * `x`/`y` is the centre of the glyph box and `rotation` is in degrees, both as
 * StitchFiddle presents them. The y axis points down, as it does on the canvas.
 */
export interface Transform {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
  readonly flipX: boolean;
  readonly flipY: boolean;
}

/**
 * `keyEntryId` is a `StitchDefId` for a stitch from the library. A custom key
 * entry brings its own id, so one field covers both.
 */
export interface StitchItem extends Transform {
  readonly id: string;
  readonly kind: 'stitch';
  readonly keyEntryId: string;
  readonly insertion: StitchInsertion;
  readonly rowId: string;
  readonly layerId: string;
  readonly color: string | null;
}

export type IrregularItem = StitchItem;

/**
 * One line of the pattern's own stitch key. An entry exists only when it says
 * something the library does not: an override, or a stitch of the crocheter's
 * own. Everything else follows the notation, so a pattern that accepts the
 * preset carries no key at all.
 */
export interface StitchKeyEntry {
  readonly id: string;
  /** The library stitch this stands for, or `null` for one of the crocheter's own. */
  readonly stitch: string | null;
  readonly customName: string | null;
  readonly glyphOverride: string | null;
  readonly abbreviationOverride: string | null;
  readonly labelOverride: string | null;
}

export interface LegendBlock {
  readonly visible: boolean;
  readonly position: Point;
  readonly columns: 1 | 2 | 3;
  readonly showCounts: boolean;
}

/**
 * The circle guide. `startAngle` and the spoke angles are degrees clockwise
 * from straight up, the same convention as an item's rotation.
 */
export interface PolarGuide {
  readonly visible: boolean;
  readonly center: Point;
  readonly rings: number;
  readonly spacing: number;
  readonly spokes: number;
  readonly startAngle: number;
}

export interface IrregularGuides {
  readonly grid: { readonly visible: boolean; readonly size: number };
  readonly polar: PolarGuide;
  readonly snap: boolean;
}

export interface IrregularPattern {
  readonly formatVersion: number;
  readonly type: 'irregular';
  readonly title: string;
  readonly titleGenerated?: boolean;
  readonly notation?: PatternNotation;
  readonly rows: readonly IrregularRow[];
  readonly layers: readonly IrregularLayer[];
  readonly items: readonly IrregularItem[];
  /** There is always exactly one active row and one active layer. */
  readonly activeRowId: string;
  readonly activeLayerId: string;
  readonly guides: IrregularGuides;
  /** Absent while the pattern is happy with the preset. */
  readonly stitchKey?: readonly StitchKeyEntry[];
  readonly legend?: LegendBlock;
}

/** Abstract canvas units: at 100% zoom one unit is one CSS pixel. */
export const DEFAULT_GRID_SIZE = 20;
export const GRID_SIZE_RANGE = { min: 2, max: 200 } as const;
export const DEFAULT_POLAR: PolarGuide = {
  visible: false,
  center: { x: 0, y: 0 },
  rings: 8,
  spacing: 40,
  spokes: 12,
  startAngle: 0,
};
export const POLAR_RANGE = {
  rings: { min: 1, max: 60 },
  spacing: { min: 4, max: 400 },
  spokes: { min: 1, max: 180 },
} as const;
export const NUDGE_STEP = 1;
export const NUDGE_STEP_LARGE = 10;
export const EXPORT_MARGIN = 20;
