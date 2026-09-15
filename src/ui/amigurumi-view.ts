/*
 * Az „Amigurumi” szakasz tartalma (PQW-863): a formák és a mezőik, a forma a
 * mezők szövegéből, a körterv összefoglalója a görbülettel és a mérettel, a
 * mintasűrűség eredete, a figura részei és magassága.
 *
 * DOM nélküli, ezért a Node is futtatja (tests/ui-amigurumi-view.test.mjs), és a
 * magot `.ts` kiterjesztéssel importálja.
 */

import type { JoinMethod, PartOptions } from '../core/amigurumi-generator.ts';
import {
  SHAPE_NAMES,
  diagnoseRounds,
  figureSize,
  shapeSchedule,
  type Curvature,
  type RoundDiagnosis,
  type RoundGauge,
  type Schedule,
} from '../core/amigurumi.ts';
import type { Pattern, PieceEnd, ProfilePoint, ShapeSpec, SphereMethod } from '../core/types.ts';
import type { Choice } from './rounds-view.ts';
import { formatNumber } from './size-view.ts';

export type ShapeKind = ShapeSpec['kind'];

const KINDS: readonly ShapeKind[] = ['sphere', 'hemisphere', 'egg', 'cylinder', 'cone', 'revolution', 'oval'];

export const SHAPE_CHOICES: readonly Choice<ShapeKind>[] = KINDS.map((value) => ({
  value,
  label: value === 'revolution' ? 'Forgástest (profilból)' : SHAPE_NAMES[value],
}));

export const METHOD_CHOICES: readonly Choice<SphereMethod>[] = [
  { value: '6n', label: '6n: hatosával szaporítva, egyenes körökkel' },
  { value: 'sine', label: 'Szinuszos: a valódi gömbhöz közelebb' },
];

export const BOTTOM_CHOICES: readonly Choice<PieceEnd>[] = [
  { value: 'closed', label: 'Zárt: varázskör, lapos alj' },
  { value: 'open', label: 'Nyitott: az előző rész szélébe horgolva' },
];

export const TOP_CHOICES: readonly Choice<PieceEnd>[] = [
  { value: 'closed', label: 'Zárt: összehúzva vagy lapos tetővel' },
  { value: 'open', label: 'Nyitott: varráshoz vagy folytatáshoz' },
];

export const JOIN_CHOICES: readonly Choice<JoinMethod>[] = [
  { value: 'sewn', label: 'Varrva' },
  { value: 'continuous', label: 'Folytatólagosan' },
];

/** A görbület neve körönként (04 §8, §9.6). A „fogyó (záródik)” új kifejezés, jóváhagyásra vár. */
export const CURVATURE_NAMES: Readonly<Record<Curvature, string>> = {
  flat: 'lapos',
  cupping: 'kunkorodó',
  tube: 'henger',
  ruffled: 'fodros',
  closing: 'fogyó (záródik)',
};

/** A mezők értéke, ahogy a felületen áll: a számok szövegként, tizedesvesszővel is. */
export interface AmigurumiForm {
  readonly name: string;
  readonly shape: ShapeKind;
  readonly method: SphereMethod;
  readonly diameter: string;
  readonly height: string;
  /** Az ovális hossza és szélessége (PQW-890). */
  readonly length: string;
  readonly width: string;
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

/** Melyik mező tartozik a formához. */
export interface FieldState {
  readonly method: boolean;
  readonly diameter: boolean;
  readonly height: boolean;
  readonly length: boolean;
  readonly width: boolean;
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
    increases: shape === 'cone',
    profile: shape === 'revolution',
    bottom: shape === 'cylinder' || shape === 'revolution',
    top: shape === 'hemisphere' || shape === 'cylinder' || shape === 'cone' || shape === 'revolution',
  };
}

/** Szám a mező szövegéből, tizedesvesszővel is; üresen vagy hibásan `NaN`. */
export function parseNumber(text: string): number {
  const trimmed = text.trim().replace(',', '.');
  return trimmed === '' ? Number.NaN : Number(trimmed);
}

/** A profil soronként „sugár magasság” cm-ben (pl. „2,5 4”); hiba esetén az üzenet. */
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
      return `A profil ${index + 1}. sorában két szám kell, szóközzel elválasztva: sugár és magasság cm-ben (pl. „2,5 4”).`;
    }
    points.push({ radiusCm: radiusCm!, heightCm: heightCm! });
  }
  return points;
}

/** A forma a mezőkből; hiba esetén az üzenet. A méret határait a mag nézi (`shapeProblem`). */
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
      if (increases !== null && !Number.isFinite(increases)) return 'A körönkénti szaporítás szám legyen, pl. 2,5, vagy hagyd üresen.';
      return { kind: 'cone', diameterCm, heightCm: increases === null ? heightCm : Number.isFinite(heightCm) ? heightCm : 1, increases, top: form.top };
    }
    case 'revolution': {
      const profile = parseProfile(form.profile);
      if (typeof profile === 'string') return profile;
      return { kind: 'revolution', profile, bottom: form.bottom, top: form.top };
    }
    case 'oval':
      return { kind: 'oval', lengthCm: parseNumber(form.length), widthCm: parseNumber(form.width) };
  }
}

export function partOf(form: AmigurumiForm): PartOptions | string {
  const shape = shapeOf(form);
  if (typeof shape === 'string') return shape;
  return { name: form.name, shape, stagger: form.stagger, eyes: form.eyes };
}

/** Az egymás utáni azonos görbületű körök: „1–6. kör lapos”. */
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
const range = (from: number, to: number) => (from === to ? `${from}.` : `${from}–${to}.`);

/** A körterv összefoglalója: körszám, méret, görbület körönként, a hátsó szálas körök. */
export function scheduleSummary(schedule: Schedule, gauge: RoundGauge): string {
  const { counts } = schedule;
  // Az ovális 1. köre lapos kezdés: a görbület a végek körönkénti szaporításához mérve (PQW-890).
  const before = schedule.start === 'ring' ? 0 : schedule.oval ? counts[0]! - 2 * schedule.oval.perEnd : counts[0]!;
  const measures = schedule.oval
    ? `hossz kb. ${cm(schedule.widthCm)} cm, szélesség kb. ${cm(schedule.oval.widthCm)} cm, ${schedule.oval.chains} láncszemből`
    : `szélesség kb. ${cm(schedule.widthCm)} cm, magasság kb. ${cm(schedule.heightCm)} cm`;
  const runs = curvatureRuns(diagnoseRounds(counts, gauge, before));
  const parts = [
    `${counts.length} kör, legfeljebb ${Math.max(...counts)} szem; ${measures}.`,
    `Görbület: ${runs.map((run) => `${range(run.from, run.to)} kör ${CURVATURE_NAMES[run.curvature]}`).join(', ')}.`,
  ];
  if (schedule.backLoop.length > 0) {
    parts.push(`Hátsó szálba (éles törés): ${schedule.backLoop.map((index) => `${index + 1}.`).join(', ')} kör.`);
  }
  if (schedule.start === 'open') parts.push('Nyitott kezdés: csak folytatólagosan, egy előző rész nyitott végéhez kapcsolható.');
  return parts.join(' ');
}

/** A forma előnézete a mezőkből: az összefoglaló, vagy mi a gond. */
export function previewNote(form: AmigurumiForm, gauge: RoundGauge): string {
  const shape = shapeOf(form);
  if (typeof shape === 'string') return shape;
  const planned = shapeSchedule(shape, gauge);
  return planned.ok ? scheduleSummary(planned.schedule, gauge) : planned.reason;
}

/** Honnan jön a körszám és a szaporítás. */
export function gaugeNote(gauge: RoundGauge): string {
  const density = `${formatNumber(gauge.stitchesPerCm * 10, 1)} szem és ${formatNumber(gauge.roundsPerCm * 10, 1)} kör 10 cm-en`;
  if (gauge.source === 'estimated') {
    return `Becslés a tűből: ${density}. Amigurumihoz szoros horgolás kell, kb. két tűmérettel kisebb tűvel. Pontosabb, ha a Méret és fonal szakaszban megadod a rövidpálca körben mért mintasűrűségét.`;
  }
  return `${gauge.source === 'label' ? 'A címkén megadott' : 'A körben mért'} mintasűrűségből: ${density}.`;
}

/** A minta részei és a figura magassága; ha nincs rész, `null`. */
export function figureNote(pattern: Pattern, gauge: RoundGauge): string | null {
  const size = figureSize(pattern, gauge);
  if (!size) return null;
  const parts = size.parts.flatMap((part) =>
    part.sections.map((section, i) => {
      const schedule = section.schedule;
      const measures = `${cm(schedule.widthCm)} × ${cm(schedule.heightCm)} cm`;
      return i === 0 ? `${section.name} (${measures})` : `${section.name} folytatólagosan (${measures})`;
    }),
  );
  return `A minta részei: ${parts.join(', ')}. A figura magassága kb. ${cm(size.heightCm)} cm, szélessége kb. ${cm(size.widthCm)} cm (becslés, kitömve).`;
}

export function safetyNote(under3: boolean): string | null {
  return under3 ? '3 év alatti gyereknek szánt játékba nem kerülhet biztonsági szem vagy gyöngy: a minta hímzett szemet ír.' : null;
}

export function createdMessage(name: string): string {
  return `${name} elkészült; visszavonással a korábbi minta visszajön.`;
}

export function addedMessage(name: string, join: JoinMethod): string {
  return `${name} hozzáadva, ${join === 'sewn' ? 'varrva' : 'folytatólagosan'}; visszavonással a korábbi minta visszajön.`;
}
