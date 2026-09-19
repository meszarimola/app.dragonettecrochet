// KB: interface.md §1

import type { JoinMethod, PartOptions } from '../core/amigurumi-generator.ts';
import {
  OVAL_STITCHES,
  diagnoseRounds,
  figureSize,
  shapeSchedule,
  type Curvature,
  type RoundDiagnosis,
  type RoundGauge,
  type Schedule,
} from '../core/amigurumi.ts';
import { resolveStitch } from '../core/stitch-variants.ts';
import type { OvalStitch, Pattern, PieceEnd, ProfilePoint, ShapeSpec, SphereMethod } from '../core/types.ts';
import { texts } from './i18n.ts';
import { amigurumiCoreText } from './i18n/core/amigurumi.ts';
import type { Choice } from './rounds-view.ts';
import { formatNumber } from './size-view.ts';
import { termsLocale } from './notation.ts';

export type ShapeKind = ShapeSpec['kind'];

const KINDS: readonly ShapeKind[] = ['sphere', 'hemisphere', 'egg', 'cylinder', 'cone', 'revolution', 'oval'];

export const SHAPE_CHOICES: readonly Choice<ShapeKind>[] = KINDS.map((value) => ({
  value,
  get label() {
    const t = texts().panels.amigurumi;
    return value === 'revolution' ? t.revolution : t.names[value];
  },
}));

export const METHOD_CHOICES: readonly Choice<SphereMethod>[] = (['6n', 'sine'] as const).map((value) => ({
  value,
  get label() {
    return texts().panels.amigurumi.methods[value];
  },
}));

export const BOTTOM_CHOICES: readonly Choice<PieceEnd>[] = (['closed', 'open'] as const).map((value) => ({
  value,
  get label() {
    return texts().panels.amigurumi.bottoms[value];
  },
}));

export const TOP_CHOICES: readonly Choice<PieceEnd>[] = (['closed', 'open'] as const).map((value) => ({
  value,
  get label() {
    return texts().panels.amigurumi.tops[value];
  },
}));

// KB: interface.md §2 — the name follows the notation, not the interface language.
export const STITCH_CHOICES: readonly Choice<OvalStitch>[] = OVAL_STITCHES.map((value) => {
  return {
    value,
    get label() {
      const name = resolveStitch(value)!.terms[termsLocale()].name;
      return name.charAt(0).toLocaleUpperCase('hu') + name.slice(1);
    },
  };
});

export const JOIN_CHOICES: readonly Choice<JoinMethod>[] = (['sewn', 'continuous'] as const).map((value) => ({
  value,
  get label() {
    return texts().panels.amigurumi.joins[value];
  },
}));

// KB: 04 §8, §9.6; interface.md §32
export const CURVATURE_NAMES: Readonly<Record<Curvature, string>> = {
  get flat() {
    return texts().panels.amigurumi.curvatures.flat;
  },
  get cupping() {
    return texts().panels.amigurumi.curvatures.cupping;
  },
  get tube() {
    return texts().panels.amigurumi.curvatures.tube;
  },
  get ruffled() {
    return texts().panels.amigurumi.curvatures.ruffled;
  },
  get closing() {
    return texts().panels.amigurumi.curvatures.closing;
  },
};

export interface AmigurumiForm {
  readonly name: string;
  readonly shape: ShapeKind;
  readonly method: SphereMethod;
  readonly diameter: string;
  readonly height: string;
  readonly length: string;
  readonly width: string;
  readonly stitch: OvalStitch;
  readonly increases: string;
  readonly profile: string;
  readonly bottom: PieceEnd;
  readonly top: PieceEnd;
  readonly stagger: boolean;
  readonly eyes: boolean;
  readonly under3: boolean;
  readonly join: JoinMethod;
  readonly distribute: boolean;
}

export interface FieldState {
  readonly method: boolean;
  readonly diameter: boolean;
  readonly height: boolean;
  readonly length: boolean;
  readonly width: boolean;
  readonly stitch: boolean;
  readonly increases: boolean;
  readonly profile: boolean;
  readonly bottom: boolean;
  readonly top: boolean;
}

export function fieldState(shape: ShapeKind): FieldState {
  return {
    method: shape === 'sphere' || shape === 'hemisphere',
    diameter: shape !== 'revolution' && shape !== 'oval',
    height: shape === 'egg' || shape === 'cylinder' || shape === 'cone',
    length: shape === 'oval',
    width: shape === 'oval',
    stitch: shape === 'oval',
    increases: shape === 'cone',
    profile: shape === 'revolution',
    bottom: shape === 'cylinder' || shape === 'revolution',
    top: shape === 'hemisphere' || shape === 'cylinder' || shape === 'cone' || shape === 'revolution',
  };
}

export function parseNumber(text: string): number {
  const trimmed = text.trim().replace(',', '.');
  return trimmed === '' ? Number.NaN : Number(trimmed);
}

export function parseProfile(text: string): ProfilePoint[] | string {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const points: ProfilePoint[] = [];
  for (const [index, line] of lines.entries()) {
    const parts = line.split(/[\s;]+/);
    const [radiusCm, heightCm] = parts.map(parseNumber);
    if (parts.length !== 2 || !Number.isFinite(radiusCm) || !Number.isFinite(heightCm)) {
      return texts().panels.amigurumi.profileLine(index + 1);
    }
    points.push({ radiusCm: radiusCm!, heightCm: heightCm! });
  }
  return points;
}

export function shapeOf(form: AmigurumiForm): ShapeSpec | string {
  const diameterCm = parseNumber(form.diameter);
  const heightCm = parseNumber(form.height);
  switch (form.shape) {
    case 'sphere':
      return { kind: 'sphere', diameterCm, method: form.method };
    case 'hemisphere':
      return { kind: 'hemisphere', diameterCm, method: form.method, top: form.top };
    case 'egg':
      return { kind: 'egg', diameterCm, heightCm };
    case 'cylinder':
      return { kind: 'cylinder', diameterCm, heightCm, bottom: form.bottom, top: form.top };
    case 'cone': {
      const increases = form.increases.trim() === '' ? null : parseNumber(form.increases);
      if (increases !== null && !Number.isFinite(increases)) return texts().panels.amigurumi.coneIncreases;
      return { kind: 'cone', diameterCm, heightCm: increases === null ? heightCm : Number.isFinite(heightCm) ? heightCm : 1, increases, top: form.top };
    }
    case 'revolution': {
      const profile = parseProfile(form.profile);
      if (typeof profile === 'string') return profile;
      return { kind: 'revolution', profile, bottom: form.bottom, top: form.top };
    }
    case 'oval':
      // KB: interface.md §29 — the default stitch stays unwritten, so old and new saves match.
      return { kind: 'oval', lengthCm: parseNumber(form.length), widthCm: parseNumber(form.width), ...(form.stitch === 'sc' ? {} : { stitch: form.stitch }) };
  }
}

export function partOf(form: AmigurumiForm): PartOptions | string {
  const shape = shapeOf(form);
  if (typeof shape === 'string') return shape;
  return { name: form.name, shape, stagger: form.stagger, eyes: form.eyes };
}

export function partLabel(part: PartOptions): string {
  return part.name.trim() || texts().panels.amigurumi.names[part.shape.kind];
}

export function curvatureRuns(diagnoses: readonly RoundDiagnosis[]): { from: number; to: number; curvature: Curvature }[] {
  const runs: { from: number; to: number; curvature: Curvature }[] = [];
  for (const diagnosis of diagnoses) {
    const last = runs.at(-1);
    if (last && last.curvature === diagnosis.curvature) last.to = diagnosis.round;
    else runs.push({ from: diagnosis.round, to: diagnosis.round, curvature: diagnosis.curvature });
  }
  return runs;
}

const cm = (value: number) => formatNumber(value, 1);

export function scheduleSummary(schedule: Schedule, gauge: RoundGauge): string {
  const t = texts().panels.amigurumi;
  const { counts } = schedule;
  const before = schedule.start === 'ring' ? 0 : schedule.oval ? counts[0]! - 2 * schedule.oval.perEnd : counts[0]!;
  const measures = schedule.oval
    ? t.ovalMeasures(cm(schedule.widthCm), cm(schedule.oval.widthCm), schedule.oval.chains)
    : t.shapeMeasures(cm(schedule.widthCm), cm(schedule.heightCm));
  const runs = curvatureRuns(diagnoseRounds(counts, gauge, before));
  const parts = [
    t.counts(counts.length, Math.max(...counts), measures),
    t.curvatureLine(runs.map((run) => t.curvatureRun(run.from, run.to, t.curvatures[run.curvature])).join(', ')),
  ];
  if (schedule.backLoop.length > 0) {
    parts.push(t.backLoop(schedule.backLoop.map((index) => index + 1)));
  }
  if (schedule.start === 'open') parts.push(t.openStart);
  return parts.join(' ');
}

export function previewNote(form: AmigurumiForm, gauge: RoundGauge, gaugeOf: (shape: ShapeSpec) => RoundGauge = () => gauge): string {
  const shape = shapeOf(form);
  if (typeof shape === 'string') return shape;
  const own = gaugeOf(shape);
  const planned = shapeSchedule(shape, own);
  return planned.ok ? scheduleSummary(planned.schedule, own) : amigurumiCoreText(planned.reason);
}

export function gaugeNote(gauge: RoundGauge): string {
  const t = texts().panels.amigurumi;
  const density = t.density(formatNumber(gauge.stitchesPerCm * 10, 1), formatNumber(gauge.roundsPerCm * 10, 1));
  if (gauge.source === 'estimated') return t.gaugeEstimated(density);
  return t.gaugeMeasured(gauge.source === 'label' ? t.gaugeFromLabel : t.gaugeFromRounds, density);
}

export function figureNote(pattern: Pattern, gauge: RoundGauge): string | null {
  const t = texts().panels.amigurumi;
  const size = figureSize(pattern, gauge);
  if (!size) return null;
  const parts = size.parts.flatMap((part) =>
    part.sections.map((section, i) => {
      const schedule = section.schedule;
      const measures = schedule.oval
        ? t.flatOval(cm(schedule.widthCm), cm(schedule.oval.widthCm))
        : t.partMeasures(cm(schedule.widthCm), cm(schedule.heightCm));
      return i === 0 ? t.part(section.name, measures) : t.continuedPart(section.name, measures);
    }),
  );
  return t.figure(parts.join(', '), cm(size.heightCm), cm(size.widthCm));
}

export function safetyNote(under3: boolean): string | null {
  return under3 ? texts().panels.amigurumi.safety : null;
}

export function createdMessage(name: string): string {
  return texts().panels.amigurumi.created(name);
}

export function addedMessage(name: string, join: JoinMethod): string {
  return texts().panels.amigurumi.added(name, join);
}
