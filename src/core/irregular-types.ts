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

export interface IrregularGuides {
  readonly grid: { readonly visible: boolean; readonly size: number };
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
}

/** Abstract canvas units: at 100% zoom one unit is one CSS pixel. */
export const DEFAULT_GRID_SIZE = 20;
export const NUDGE_STEP = 1;
export const NUDGE_STEP_LARGE = 10;
export const EXPORT_MARGIN = 20;
