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

/** Which side of an open shape the stitches stand on, or of a circle. */
export type ShapeSide = 'left' | 'right' | 'outside' | 'inside';

/**
 * The shape a row was arranged on and remembers. `bulge` follows the chain
 * arc's convention: the signed distance the middle stands off the chord, on the
 * left of start → end.
 */
export type RowLine =
  | {
      readonly shape: 'line';
      readonly start: Point;
      readonly end: Point;
      readonly side: ShapeSide;
      readonly perpendicular: boolean;
    }
  | {
      readonly shape: 'arc';
      readonly start: Point;
      readonly end: Point;
      readonly bulge: number;
      readonly side: ShapeSide;
      readonly perpendicular: boolean;
    }
  | {
      readonly shape: 'circle';
      readonly center: Point;
      readonly radius: number;
      readonly startAngle: number;
      readonly side: ShapeSide;
      readonly perpendicular: boolean;
    };

export type RowLineShape = RowLine['shape'];

export interface IrregularRow {
  readonly id: string;
  readonly kind: RowKind;
  readonly direction: RowDirection;
  readonly color: string | null;
  readonly visible: boolean;
  readonly locked: boolean;
  /** `auto` reads the order off the positions; a list is the crocheter's own. */
  readonly order?: 'auto' | readonly string[];
  /** Absent until the row has been arranged on a shape. */
  readonly line?: RowLine;
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

/**
 * Everything on the chart that is not a stitch: a row number, a round's start
 * marker, a repeat bracket, a piece of free text, an arrow. One kind with a
 * discriminator rather than five item types — one reader branch, one drawing
 * pass, one panel block. Annotations never count as stitches (D12).
 */
export type NoteKind = 'label' | 'marker' | 'bracket' | 'text' | 'arrow';

export interface AnnotationItem extends Transform {
  readonly id: string;
  readonly kind: 'annotation';
  readonly note: NoteKind;
  readonly rowId: string;
  readonly layerId: string;
  readonly color: string | null;
  /** What it says. A label composes its own text from the row it follows. */
  readonly text: string;
  readonly fontSize: number;
  /** The row a label or a start marker belongs to, so it follows that row. */
  readonly linkedRowId?: string;
  /** A label may carry the row's direction as an arrow. */
  readonly withArrow?: boolean;
  /** A start marker may be dotted rather than solid. */
  readonly dotted?: boolean;
}

export type IrregularItem = StitchItem | AnnotationItem;

export const DEFAULT_FONT_SIZE = 16;
export const FONT_SIZE_RANGE = { min: 6, max: 96 } as const;

export function isStitch(item: IrregularItem): item is StitchItem {
  return item.kind === 'stitch';
}

export function isAnnotation(item: IrregularItem): item is AnnotationItem {
  return item.kind === 'annotation';
}

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

/**
 * A run of stitches generated from a path, which stays editable: move an end,
 * change the bulge or the count and the members are laid out again.
 * `memberIds` is the run in working order.
 */
export interface ChainArcGroup {
  readonly id: string;
  readonly kind: 'chainArc';
  readonly rowId: string;
  readonly layerId: string;
  readonly keyEntryId: string;
  readonly shape: ArcShape;
  readonly start: Point;
  readonly end: Point;
  /** How far the middle of the arc stands off the chord, in chart units; the sign picks the side. */
  readonly bulge: number;
  readonly count: number;
  readonly memberIds: readonly string[];
}

export type ArcShape = 'arc' | 'straight';

/**
 * Stitches radiating from one point. In `spread` mode `origin` is the shared
 * base point they are all worked into; in `converge` it is the shared top point
 * they meet at, and the base points lie on an arc of radius `length` around it.
 */
export interface FanGroup {
  readonly id: string;
  readonly kind: 'fan';
  readonly rowId: string;
  readonly layerId: string;
  readonly keyEntryId: string;
  readonly mode: FanMode;
  readonly origin: Point;
  /** Where the middle of the fan points, degrees clockwise from up. */
  readonly direction: number;
  /** The angle between the two outer stitches. */
  readonly spreadAngle: number;
  readonly length: number;
  readonly count: number;
  readonly memberIds: readonly string[];
}

export type FanMode = 'spread' | 'converge';

export type IrregularGroup = ChainArcGroup | FanGroup;

/** Where one member of a group sits and how big it is drawn. */
export interface MemberShape {
  readonly at: Point;
  readonly rotation: number;
  readonly width: number;
  readonly height: number;
}

/** What the interface measured for a glyph at its natural size. */
export interface GlyphSize {
  readonly width: number;
  readonly height: number;
}

/**
 * A photo traced over. The bytes live outside the pattern, in the browser's own
 * store, so a big picture can never break the pattern's autosave; only the
 * placement is part of the chart.
 */
export interface BackgroundImage {
  readonly id: string;
  /** The centre of the image on the chart. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
  /** How solid it is drawn, 0 to 1. */
  readonly opacity: number;
  readonly visible: boolean;
  readonly locked: boolean;
  /** Off by default: a tracing photo has no place in the finished chart. */
  readonly inExport: boolean;
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
  /** Absent while the pattern has no parametric group. */
  readonly groups?: readonly IrregularGroup[];
  /** There is always exactly one active row and one active layer. */
  readonly activeRowId: string;
  readonly activeLayerId: string;
  readonly guides: IrregularGuides;
  /** Absent while the pattern is happy with the preset. */
  readonly stitchKey?: readonly StitchKeyEntry[];
  readonly legend?: LegendBlock;
  readonly background?: BackgroundImage;
}

/** Abstract canvas units: at 100% zoom one unit is one CSS pixel. */
// KB: interface.md §63 — the square grid and the circle guide share one size, the row spacing.
export const DEFAULT_GRID_SIZE = 40;
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
export const DEFAULT_ARC_COUNT = 5;
export const ARC_COUNT_RANGE = { min: 2, max: 200 } as const;
/** The preset bulge, as a share of the chord. KB: core-geometry §52 */
export const DEFAULT_ARC_BULGE = 0.25;
export const DEFAULT_BACKGROUND_OPACITY = 0.4;
export const DEFAULT_FAN_COUNT = 5;
/** Its own range: a fan is not an arc, and one must not silently set the other. */
export const FAN_COUNT_RANGE = { min: 2, max: 200 } as const;
export const DEFAULT_FAN_SPREAD = 120;
export const FAN_SPREAD_RANGE = { min: 5, max: 350 } as const;
export const FAN_LENGTH_RANGE = { min: 4, max: 2000 } as const;
/** How far a point may stand off a shape and still count as lying on it. */
export const FIT_TOLERANCE = 6;
export const NUDGE_STEP = 1;
export const NUDGE_STEP_LARGE = 10;
export const EXPORT_MARGIN = 20;
