// KB: 02 §4.2, 02 §6.5, 02 §8

import { type LayerInput, type PieceSize, pieceSize } from './finished-size.ts';
import { type GaugeContext, type LayerShape, stitchDimensions } from './gauge.ts';
import type { GaugeProfile, StitchGauge, WorkedIn } from './gauge-profile.ts';
import type { PieceGraph } from './graph.ts';
import { DEFAULT_COLUMN, ROW_GAP } from './layout.ts';
import { measured } from './quantity.ts';
import type { StitchLibrary } from './stitch-library.ts';
import type {
  GaugeForm,
  Pattern,
  PatternGauge,
  PatternGaugeProfile,
  Sourced,
  StitchDef,
  StitchDefId,
} from './types.ts';
import { type YarnEstimate, yarnFromMassPerArea } from './yarn-estimate.ts';
import { classifyByMeterage } from './yarn-weight.ts';

export const DEFAULT_HOOK_MM = 4;

// The round gauge is entered as a tube measurement, the primary round gauge. KB: 02 §4.3
const WORKED_IN: Readonly<Record<GaugeForm, WorkedIn>> = { rows: 'rows', rounds: 'rounds-tube' };

export function activeProfile(pattern: Pattern): PatternGaugeProfile | null {
  const gauge = pattern.gauge;
  if (!gauge || gauge.active === null) return null;
  return gauge.profiles.find((profile) => profile.id === gauge.active) ?? null;
}

export function swatchMassPerArea(profile: PatternGaugeProfile): number | null {
  const { widthCm, heightCm, massG } = profile.swatch;
  return widthCm !== null && heightCm !== null && massG !== null ? massG / (widthCm * heightCm) : null;
}

export function ballLengthM(profile: PatternGaugeProfile): number | null {
  const { metersPer100g, ballMassG } = profile.yarn;
  return metersPer100g !== null && ballMassG !== null ? (metersPer100g * ballMassG) / 100 : null;
}

// KB: 02 §1.4
export function yarnWeightOf(profile: PatternGaugeProfile): Sourced<number> | null {
  const { cycWeight, metersPer100g } = profile.yarn;
  if (cycWeight !== null) return { value: cycWeight, source: 'label' };
  if (metersPer100g !== null) return { value: classifyByMeterage(metersPer100g).weight, source: 'estimated' };
  return null;
}

const single = (mean: number) => ({ mean, sd: 0, n: 1 });

export function gaugeProfileOf(profile: PatternGaugeProfile): GaugeProfile {
  const massPerArea = swatchMassPerArea(profile);
  const perStitch: Record<string, Partial<Record<WorkedIn, StitchGauge>>> = {};
  for (const entry of profile.gauges) {
    if (entry.stitchesPer10cm === null || entry.rowsPer10cm === null) continue;
    perStitch[entry.stitch] = {
      ...perStitch[entry.stitch],
      [WORKED_IN[entry.form]]: {
        source: entry.source,
        widthMm: single(100 / entry.stitchesPer10cm),
        heightMm: single(100 / entry.rowsPer10cm),
        massPerAreaGPerCm2: massPerArea,
        yarnPerStitchCm: null,
        shape: null,
        blockingChange: null,
        samples: [],
      },
    };
  }
  const { name, metersPer100g, ballMassG } = profile.yarn;
  return {
    id: profile.id,
    crocheterId: 'owner',
    yarn: {
      id: profile.id,
      name,
      fibre: [],
      cycWeight: yarnWeightOf(profile),
      metersPer100g: metersPer100g === null ? null : { value: metersPer100g, source: 'label' },
      label: { lengthM: ballLengthM(profile), massG: ballMassG },
    },
    hookMm: profile.hookMm,
    blocked: profile.blocked,
    perStitch,
    chainLengthMm: null,
    samples: [],
  };
}

export function gaugeContextOf(pattern: Pattern, library: StitchLibrary): GaugeContext {
  const profile = activeProfile(pattern);
  return { library, profile: profile ? gaugeProfileOf(profile) : null, hookMm: profile?.hookMm ?? DEFAULT_HOOK_MM };
}

// Layer 0 (foundation chain, magic ring) and anything that adds no width are left out. KB: 03 §1.2, 04 §9.7
export function sizeLayers(graph: PieceGraph): SizeLayer[] {
  const layers: SizeLayer[] = [];
  for (const layer of graph.layers.slice(1)) {
    const skipped = new Set<string>([
      ...layer.turningChain,
      ...layer.travelSlips,
      ...(layer.joinSlip ? [layer.joinSlip] : []),
    ]);
    const stitches: StitchDefId[] = [];
    const first = layer.firstStitch ? graph.defs.get(layer.firstStitch) : undefined;
    if (layer.shape === 'round' && layer.turningChainCounts && layer.turningChain.length > 0 && first)
      stitches.push(first.id);
    for (const id of layer.stitches) {
      const def = graph.defs.get(id);
      if (def && !skipped.has(id)) stitches.push(def.id);
    }
    if (stitches.length > 0) layers.push({ index: layer.index, shape: layer.shape, stitches });
  }
  return layers;
}

export interface SizeLayer extends LayerInput {
  readonly index: number;
}

export type YarnMissing = 'profile' | 'swatch' | 'meterage' | 'ball' | 'size';

export type YarnResult =
  | {
      readonly kind: 'estimate';
      readonly estimate: YarnEstimate;
      readonly ballMassG: number;
      readonly ballLengthM: number;
    }
  | { readonly kind: 'missing'; readonly missing: readonly YarnMissing[] };

export interface PatternSize {
  readonly profile: PatternGaugeProfile | null;
  readonly hookMm: number;
  readonly layerIndexes: readonly number[];
  readonly size: PieceSize | null;
  readonly yarn: YarnResult;
}

// KB: 02 §6.5
export function patternSize(pattern: Pattern, graph: PieceGraph | null, library: StitchLibrary): PatternSize {
  const context = gaugeContextOf(pattern, library);
  const profile = activeProfile(pattern);
  const layers = graph ? sizeLayers(graph) : [];
  const rows = layers.length > 0 ? pieceSize(layers, context) : null;
  const size = rows;

  const missing: YarnMissing[] = [];
  const massPerArea = profile ? swatchMassPerArea(profile) : null;
  const ballLength = profile ? ballLengthM(profile) : null;
  if (!profile) missing.push('profile');
  else {
    if (massPerArea === null) missing.push('swatch');
    if (profile.yarn.metersPer100g === null) missing.push('meterage');
    if (profile.yarn.ballMassG === null) missing.push('ball');
  }
  if (!size?.total) missing.push('size');

  const yarn: YarnResult =
    missing.length === 0 &&
    profile &&
    massPerArea !== null &&
    ballLength !== null &&
    profile.yarn.ballMassG !== null &&
    size?.total
      ? {
          kind: 'estimate',
          estimate: yarnFromMassPerArea(measured(massPerArea), size.total.areaCm2, {
            lengthM: ballLength,
            massG: profile.yarn.ballMassG,
          }),
          ballMassG: profile.yarn.ballMassG,
          ballLengthM: ballLength,
        }
      : { kind: 'missing', missing };
  return { profile, hookMm: context.hookMm, layerIndexes: layers.map((layer) => layer.index), size, yarn };
}

function gaugeOf(pattern: Pattern): PatternGauge {
  return pattern.gauge ?? { active: null, profiles: [] };
}

export function newProfile(pattern: Pattern): PatternGaugeProfile {
  const ids = new Set(gaugeOf(pattern).profiles.map((profile) => profile.id));
  let n = 1;
  while (ids.has(`p${n}`)) n += 1;
  return {
    id: `p${n}`,
    yarn: { name: '', cycWeight: null, metersPer100g: null, ballMassG: null },
    hookMm: activeProfile(pattern)?.hookMm ?? DEFAULT_HOOK_MM,
    blocked: false,
    gauges: [],
    swatch: { widthCm: null, heightCm: null, massG: null },
  };
}

export function withProfile(pattern: Pattern, profile: PatternGaugeProfile): Pattern {
  const { profiles } = gaugeOf(pattern);
  const exists = profiles.some((candidate) => candidate.id === profile.id);
  const next = exists
    ? profiles.map((candidate) => (candidate.id === profile.id ? profile : candidate))
    : [...profiles, profile];
  return { ...pattern, gauge: { active: profile.id, profiles: next } };
}

export function withActiveProfile(pattern: Pattern, id: string | null): Pattern {
  const gauge = gaugeOf(pattern);
  if (id !== null && !gauge.profiles.some((profile) => profile.id === id))
    throw new RangeError(`Nincs ilyen profil: ${id}.`);
  return { ...pattern, gauge: { ...gauge, active: id } };
}

export function withoutProfile(pattern: Pattern, id: string): Pattern {
  const gauge = gaugeOf(pattern);
  const profiles = gauge.profiles.filter((profile) => profile.id !== id);
  const { gauge: _, ...rest } = pattern;
  if (profiles.length === 0) return rest;
  return { ...rest, gauge: { active: gauge.active === id ? null : gauge.active, profiles } };
}

const oneDecimal = (value: number) => Math.round(value * 10) / 10;

export function estimatedGauge(
  profile: PatternGaugeProfile,
  library: StitchLibrary,
  stitch: StitchDefId,
  form: GaugeForm,
): { readonly stitchesPer10cm: number; readonly rowsPer10cm: number } {
  const def = library.get(stitch);
  const context: GaugeContext = { library, profile: gaugeProfileOf(profile), hookMm: profile.hookMm };
  const dimensions = def ? stitchDimensions(def, form === 'rows' ? 'row' : 'round', context) : null;
  if (!dimensions) throw new RangeError(`Nem mérhető szem: ${stitch}.`);
  return {
    stitchesPer10cm: oneDecimal(100 / dimensions.widthMm.value),
    rowsPer10cm: oneDecimal(100 / dimensions.heightMm.value),
  };
}

// Floor so the symbol stays readable.
const MIN_STEM = 4;

// KB: core-domain §6
export function aspectStem(
  context: GaugeContext,
  shape: LayerShape,
  columnWidth = DEFAULT_COLUMN,
): (chainHeight: number) => number {
  const sc = context.library.get('sc');
  const base = sc ? stitchDimensions(sc, shape, context) : null;
  if (!base) throw new RangeError('A könyvtárban nincs rövidpálca.');
  const perMm = columnWidth / base.widthMm.value;

  const byHeight = new Map<number, StitchDef>();
  for (const def of context.library.values()) {
    if (def.kind === 'basic' && !byHeight.has(def.chainHeight)) byHeight.set(def.chainHeight, def);
  }
  const cache = new Map<number, number>();
  return (chainHeight) => {
    let stem = cache.get(chainHeight);
    if (stem === undefined) {
      const def = byHeight.get(chainHeight);
      const heightMm = def
        ? (stitchDimensions(def, shape, context)?.heightMm.value ?? base.heightMm.value * chainHeight)
        : base.heightMm.value * chainHeight;
      stem = Math.max(MIN_STEM, heightMm * perMm - ROW_GAP);
      cache.set(chainHeight, stem);
    }
    return stem;
  };
}
