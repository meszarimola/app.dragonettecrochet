// KB: core-domain §8, core-domain §11; 06 §5.1, 06 §5.2

/** UK names are shifted by one step from the US ones. KB: 01 §8.5 */
export type Locale = 'hu' | 'en-US' | 'en-GB';

export type ValueSource = 'measured' | 'label' | 'estimated';

export interface Sourced<T> {
  readonly value: T;
  readonly source: ValueSource;
}

export type StitchDefId = string;

export interface StitchTerm {
  readonly name: string;
  /** `null` = no approved abbreviation, and the name is spelled out. KB: 01 §8.5 */
  readonly abbr: string | null;
  /** Accepted on input, never printed. KB: 01 §8.5 rule 25 */
  readonly aliases: readonly string[];
}

/** KB: 01 §4.3 */
export type StitchInsertion = 'both-loops' | 'front-loop' | 'back-loop' | 'front-post' | 'back-post';

/** KB: 06 §5.2 */
export type InsertionMode = StitchInsertion | 'space' | 'ring';

/** Decides how many graph nodes a stitch becomes and how it is checked. KB: 01 §4.4, 06 §5.2 */
export type StitchKind = 'chain' | 'slip' | 'basic' | 'joined' | 'group' | 'picot' | 'space' | 'ring';

interface StitchDefBase {
  readonly id: StitchDefId;
  readonly terms: Readonly<Record<Locale, StitchTerm>>;
  /** Also the number of slashes on the symbol, except hdc. KB: 01 §8.1 rules 1-2 */
  readonly yarnOvers: number;
  /** A turning-chain and symbol-stem convention, not a physical ratio. KB: 01 §8.1 rule 1 */
  readonly chainHeight: number;
  /** KB: 01 §8.3 rule 12 */
  readonly turningChain: number;
  /** Rounds only: in rows every turning chain counts. KB: 01 §8.3 rule 13 */
  readonly turningChainCounts: boolean;
  /** KB: core-domain §9 */
  readonly roundEnd: 'join-slip' | 'spiral';
  readonly heightFactor: Sourced<number>;
  /** KB: 01 §4.1, 01 §8.2 */
  readonly consumes: number;
  readonly produces: number;
  /** KB: 01 §8.2 rule 7 */
  readonly producesSpaces: number;
  /** A crab stitch cannot be worked into. KB: 01 §8.2 rule 10 */
  readonly workableTop: boolean;
  /** The first one is the default. */
  readonly insertionModes: readonly InsertionMode[];
}

export interface SimpleStitchDef extends StitchDefBase {
  readonly kind: Exclude<StitchKind, 'joined' | 'group'>;
}

export interface JoinedStitchDef extends StitchDefBase {
  readonly kind: 'joined';
  /** Required because "cluster" can mean either. KB: 01 §8.2 rule 8 */
  readonly base: 'same' | 'spread';
  readonly part: StitchDefId;
  readonly parts: number;
  /** A bobble and a popcorn have the same structure; only this differs. Absent = `partial`. KB: 01 §4.4 */
  readonly closure?: 'partial' | 'complete' | 'loops';
}

export interface GroupStitchDef extends StitchDefBase {
  readonly kind: 'group';
  readonly members: readonly StitchDefId[];
}

export type StitchDef = SimpleStitchDef | JoinedStitchDef | GroupStitchDef;

export type NodeId = string;
export type SpaceId = string;
export type RingId = string;
export type GroupId = string;
export type PieceId = string;

/** The target decides which insertions are possible: a chain space takes no back loop. */
export type Anchor =
  | { readonly into: 'stitch'; readonly id: NodeId; readonly mode: StitchInsertion }
  | { readonly into: 'space'; readonly id: SpaceId }
  | { readonly into: 'ring'; readonly id: RingId }
  /** The oval's round 1 runs down one side of the foundation chain and back along the other. KB: 04 §3.4 */
  | { readonly into: 'underside'; readonly id: NodeId };

/** Deliberate exceptions the checker does not report. KB: 03 §10 C13, C17 */
export type StitchFlag = 'crossed' | 'spike';

export interface StitchNode {
  readonly id: NodeId;
  readonly def: StitchDefId;
  /** KB: 06 §5.3 V2 */
  readonly prev: NodeId | null;
  /** In insertion order. */
  readonly anchors: readonly Anchor[];
  readonly flags?: readonly StitchFlag[];
  /** Cosmetic only: it never changes the topology. */
  readonly pinned?: { readonly x: number; readonly y: number; readonly rotation: number };
  /** Index into `PieceGrid.colors`. KB: 03 §6, 03 §10 G35 */
  readonly color?: number;
}

/** KB: 01 §8.2 rule 11 */
export interface Space {
  readonly id: SpaceId;
  readonly chains: readonly NodeId[];
}

export interface Ring {
  readonly id: RingId;
  readonly node: NodeId;
}

/** Without a group, several stitches in one target is an error. KB: 03 §10 C14 */
export interface StitchGroup {
  readonly id: GroupId;
  readonly def: StitchDefId;
  readonly members: readonly NodeId[];
}

export interface RowConventions {
  /** KB: core-domain §5; 01 §8.3 rules 13-15 */
  readonly turningChainCounts: 'stitch-default' | boolean;
}

/** KB: 01 §2.2, 01 §3.3, 01 §8.3 rules 13, 15 */
export type Tradition = 'cyc' | 'japanese';

/** KB: 03 §4.1 */
export interface RepeatSpec {
  readonly repeatWidth: number;
  readonly edgeStitches: number;
  readonly turningChainIncluded: boolean;
}

export interface PatternConventions extends RowConventions {
  /** KB: core-domain §9; 06 §5.3 V4 */
  readonly roundEnd: 'stitch-default' | 'join-slip' | 'spiral';
  readonly picotCounts: boolean;
  readonly joinSlipStitchCounts: boolean;
  /** KB: core-domain §9; 03 §4.3, 03 §10 B10 */
  readonly chainCounts: 'worked-into' | boolean;
  readonly tradition?: Tradition;
  readonly repeat?: RepeatSpec;
}

export interface LayerEvent {
  readonly after: NodeId;
  readonly kind: 'turn' | 'join-slip' | 'spiral' | 'fasten-off';
  /** KB: 06 §5.3 V3 */
  readonly statedCount?: number;
  readonly conventions?: Partial<RowConventions>;
  readonly colorChange?: boolean;
  /** Instruction only: it does not change the graph. KB: 04 §2 */
  readonly jogFix?: 'slip-stitch' | 'back-loop';
  readonly marks?: readonly RoundMark[];
  /** Only meaningful on a `fasten-off` event. KB: core-domain §12 */
  readonly resume?: {
    readonly layer: number;
    readonly name?: string;
    /** Rounds only, and only a layer after `layer`. KB: core-domain §12 */
    readonly with?: number;
  };
}

export interface Piece {
  readonly id: PieceId;
  readonly name: string;
  /** In working order. KB: 06 §5.3 V1 */
  readonly stitches: readonly StitchNode[];
  readonly spaces: readonly Space[];
  readonly rings: readonly Ring[];
  readonly groups: readonly StitchGroup[];
  readonly events: readonly LayerEvent[];
  /** KB: 03 §10 B8 */
  readonly skipped: readonly NodeId[];
  /** The corner increases stack deliberately. Absent = the round piece is a circle. KB: 04 §6.1 */
  readonly corners?: number;
  /** Drawing only; the shawl generator supplies it. KB: core-domain §13; 05 §1 */
  readonly rowShape?: RowShape;
  /** Drawing only; `throughRound` is the last cone round. KB: core-domain §13; 05 §2.3 */
  readonly roundShape?: RoundShape;
  /** A 3D piece: cupping is intentional, so the checker stays quiet. KB: 04 §4 */
  readonly sections?: readonly PieceSection[];
  /** Saved with the piece, so the technique's rules survive a save. KB: core-domain §13; 03 §5 */
  readonly grid?: PieceGrid;
}

/** KB: 03 §5 */
export type GridTechnique = 'filet' | 'c2c' | 'tapestry' | 'graphgan' | 'mosaic';

/** A built-in color carries a language-independent `id`; a name the user typed is never translated. */
export interface PatternColor {
  readonly id?: string;
  readonly name?: string;
  readonly hex: string;
}

export interface GridUnit {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PieceGrid {
  readonly technique: GridTechnique;
  /** Rows bottom-up, cells left-to-right, seen from the right side. Filet: 1 filled, 0 open, -1 no cell; a color grid holds an index into `colors`. */
  readonly cells: readonly (readonly number[])[];
  readonly colors: readonly PatternColor[];
  readonly unit: GridUnit | null;
  /** Lettering warns in the mirrored view. */
  readonly lettering: boolean;
  /** KB: 03 §5.6 */
  readonly mosaicRows?: 1 | 2;
}

/** Angles in degrees. KB: 05 §1.4, 05 §1.6 */
export type RowShape =
  | { readonly kind: 'arc'; readonly neckAngle: number }
  | { readonly kind: 'chevron'; readonly neckAngle: number; readonly tipAngle: number };

export type RoundShape = { readonly kind: 'cone'; readonly throughRound: number };

/** KB: 01 §6 */
export type ChartStyle = 'cyc' | 'jis';

/** Display only: the graph does not change with it. */
export interface PatternNotation {
  readonly terms: Locale;
  readonly chartStyle: ChartStyle;
  /** KB: 01 §6.1 */
  readonly singleCrochet: 'plus' | 'cross';
}

export type GaugeForm = 'rows' | 'rounds';

/** `null` = not filled in yet; such a row does not count towards the size. */
export interface GaugeEntry {
  readonly stitch: StitchDefId;
  readonly form: GaugeForm;
  readonly stitchesPer10cm: number | null;
  readonly rowsPer10cm: number | null;
  readonly source: Extract<ValueSource, 'measured' | 'label'>;
}

/** Unknown is `null`, never an estimate: the core does the estimating. */
export interface PatternGaugeProfile {
  readonly id: string;
  readonly yarn: {
    readonly name: string;
    readonly cycWeight: number | null;
    readonly metersPer100g: number | null;
    readonly ballMassG: number | null;
  };
  readonly hookMm: number;
  readonly blocked: boolean;
  readonly gauges: readonly GaugeEntry[];
  readonly swatch: { readonly widthCm: number | null; readonly heightCm: number | null; readonly massG: number | null };
}

export interface PatternGauge {
  /** `null`: no profile, so every size is an estimate. */
  readonly active: string | null;
  readonly profiles: readonly PatternGaugeProfile[];
}

/** `formatVersion` rises on every backwards-incompatible change. KB: core-domain §11 */
export interface Pattern {
  readonly formatVersion: 1;
  readonly title: string;
  readonly titleGenerated?: boolean;
  readonly notation?: PatternNotation;
  readonly gauge?: PatternGauge;
  readonly conventions: PatternConventions;
  readonly pieces: readonly Piece[];
  readonly joins?: readonly PieceJoin[];
  /** KB: 04 §5.7 */
  readonly toy?: { readonly under3: boolean };
  readonly garment?: PatternGarment;
}

export type GarmentKind = 'hat' | 'drop-shoulder' | 'raglan';

export type GarmentTable = 'women' | 'men' | 'child' | 'baby' | 'hat';

/** The numbers are frozen at creation time, so the written text never drifts. KB: 05 §3.8, 05 §8.1, 05 §9.6 */
export interface PatternGarment {
  readonly kind: GarmentKind;
  readonly table: GarmentTable;
  readonly sizes: readonly string[];
  readonly base: number;
  readonly values: Readonly<Record<string, readonly number[]>>;
}

export type PieceEnd = 'open' | 'closed';

/** KB: 04 §4.3 */
export type SphereMethod = '6n' | 'sine';

/** KB: 04 §9.3 */
export interface ProfilePoint {
  readonly radiusCm: number;
  readonly heightCm: number;
}

/** In cm, as the user gave it; the core derives the round plan. `bottom: open` only on a continuously attached section. KB: 04 §4 */
export type ShapeSpec =
  | { readonly kind: 'sphere'; readonly diameterCm: number; readonly method: SphereMethod }
  | { readonly kind: 'hemisphere'; readonly diameterCm: number; readonly method: SphereMethod; readonly top: PieceEnd }
  | { readonly kind: 'egg'; readonly diameterCm: number; readonly heightCm: number }
  | {
      readonly kind: 'cylinder';
      readonly diameterCm: number;
      readonly heightCm: number;
      readonly bottom: PieceEnd;
      readonly top: PieceEnd;
    }
  | {
      readonly kind: 'cone';
      readonly diameterCm: number;
      /** Ignored when `increases` is given. */
      readonly heightCm: number;
      /** Per round, fractions allowed; `null` derives it from the height. */
      readonly increases: number | null;
      readonly top: PieceEnd;
    }
  | {
      readonly kind: 'revolution';
      readonly profile: readonly ProfilePoint[];
      readonly bottom: PieceEnd;
      readonly top: PieceEnd;
    }
  /** KB: 04 §3.4, 04 §9.4 */
  | { readonly kind: 'oval'; readonly lengthCm: number; readonly widthCm: number; readonly stitch?: OvalStitch };

export type OvalStitch = 'sc' | 'hdc' | 'dc' | 'tr';

export interface PieceSection {
  readonly name: string;
  /** 1-based; a continuously attached section starts after the previous one. */
  readonly layer: number;
  readonly shape: ShapeSpec;
  readonly stagger: boolean;
}

/** KB: 04 §5.6, 04 §5.7, 04 §9.8 */
export type RoundMark = 'safety-eyes' | 'embroider-eyes' | 'stuffing' | 'close-opening';

/** `layer` alone = the whole round; `stitches` = a run of that row; `rows` = row ends down one side, and then the seam's stitch count is the number of rows. KB: 04 §5.4 */
export interface JoinEdge {
  readonly piece: PieceId;
  readonly layer: number;
  readonly stitches?: { readonly from: number; readonly count: number };
  readonly rows?: { readonly to: number; readonly side: 'left' | 'right' };
}

/** Without `distribution`, differing edge counts are an error. A continuous attachment is one piece with several sections instead. KB: 04 §5.4 */
export interface PieceJoin {
  readonly a: JoinEdge;
  readonly b: JoinEdge;
  readonly distribution?: readonly number[];
}

export interface Layer {
  readonly piece: PieceId;
  /** The foundation chain or magic ring is 0; the rest are numbered from 1. */
  readonly index: number;
  /** Normally `index - 1`; after a fasten-off the section may resume elsewhere. KB: core-domain §12 */
  readonly below: number;
  /** A second source layer, worked after `below`'s positions. KB: core-domain §12 */
  readonly alsoBelow?: number;
  /** Only on a two-source round: the tube sits on its own positions, not on the whole round. KB: core-domain §12 */
  readonly basePositions?: readonly NodeId[];
  /** Normally `index`; it restarts in a resumed section, so two sections can share a number. KB: core-domain §12 */
  readonly row: number;
  readonly shape: 'row' | 'round';
  readonly stitches: readonly NodeId[];
  /** KB: core-domain §10 */
  readonly stitchCount: number;
  /** KB: core-domain §10 */
  readonly writtenCount: number;
  readonly positionCount: number;
  /** KB: 01 §8.4 rule 19 */
  readonly side: 'right' | 'wrong';
}

export interface Finding {
  /** `warning`: doable, but probably not intended. */
  readonly severity: 'error' | 'warning';
  readonly rule: string;
  readonly reference: string;
  readonly piece: PieceId;
  readonly nodes: readonly NodeId[];
}
