// KB: core-domain §8; 06 §5.2

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

/** KB: 01 §6 */
export type ChartStyle = 'cyc' | 'jis';
