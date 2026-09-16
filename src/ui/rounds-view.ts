/*
 * A „Kör és motívum” szakasz tartalma (PQW-861): a választható formák,
 * szemek, kezdések és körvégek, a mezők állapota a formához, és a szaporítás
 * magyarázata az eredetével (mért, átszámolt vagy becsült).
 *
 * DOM nélküli, ezért a Node is futtatja (tests/ui-rounds-view.test.mjs), és a
 * magot `.ts` kiterjesztéssel importálja.
 */

import {
  MOTIF_CORNERS,
  MOTIF_SHAPES,
  ROUND_STITCHES,
  motifStitch,
  type JogFix,
  type MotifOptions,
  type MotifShape,
  type RoundClosing,
  type RoundStart,
} from '../core/round-generator.ts';
import type { FlatIncreases } from '../core/rounds.ts';
import { stitchById } from '../core/stitches.ts';
import { texts } from './i18n.ts';
import { formatNumber } from './size-view.ts';
import { termsLocale } from './notation.ts';

export interface Choice<T extends string> {
  readonly value: T;
  readonly label: string;
}

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase('hu') + text.slice(1);

export const SHAPE_CHOICES: readonly Choice<MotifShape>[] = MOTIF_SHAPES.map((value) => ({
  value,
  get label() {
    return texts().panels.round.names[value];
  },
}));

export const STITCH_CHOICES: readonly Choice<string>[] = ROUND_STITCHES.map((value) => ({
  value,
  get label() {
    return capitalize(stitchById(value).terms[termsLocale()].name);
  },
}));

export const START_CHOICES: readonly Choice<RoundStart>[] = (['magic-ring', 'chain-ring', 'chain'] as const).map((value) => ({
  value,
  get label() {
    return texts().panels.round.starts[value];
  },
}));

export const CLOSING_CHOICES: readonly Choice<RoundClosing>[] = (['join-slip', 'spiral'] as const).map((value) => ({
  value,
  get label() {
    return texts().panels.round.closings[value];
  },
}));

export const JOG_CHOICES: readonly Choice<JogFix | 'none'>[] = (['none', 'slip-stitch', 'back-loop'] as const).map((value) => ({
  value,
  get label() {
    return texts().panels.round.jogs[value];
  },
}));

/** Melyik mező állítható a választott formánál. */
export interface FieldState {
  readonly stitch: boolean;
  readonly chainStart: boolean;
  readonly closing: boolean;
  readonly stagger: boolean;
  readonly jogFix: boolean;
}

export function fieldState(options: MotifOptions): FieldState {
  const granny = options.shape === 'granny-square';
  return {
    stitch: !granny,
    chainStart: !granny,
    closing: !granny,
    stagger: options.shape === 'circle',
    jogFix: !granny && options.closing === 'spiral' && options.colorEvery > 0,
  };
}

/**
 * A választás a formához igazítva: a nagymama-négyzet egyráhajtásos pálcás,
 * zárt körös, és varázskörrel vagy láncgyűrűvel kezdődik; lépcsőjavítás csak
 * spirálban, színváltással van.
 */
export function normalizeMotif(options: MotifOptions): MotifOptions {
  const granny = options.shape === 'granny-square';
  const next: MotifOptions = granny
    ? { ...options, stitch: 'dc', closing: 'join-slip', start: options.start === 'chain' ? 'magic-ring' : options.start }
    : options;
  return fieldState(next).jogFix ? next : { ...next, jogFix: null };
}

/** A szaporítás magyarázata a formához, az eredetével. */
export function increaseNote(increases: FlatIncreases, options: MotifOptions): string {
  const t = texts().panels.round;
  const stitch = stitchById(motifStitch(options)).terms[termsLocale()].name;
  const aspect = formatNumber(increases.aspect, 2);
  let text: string;
  if (options.shape === 'granny-square') {
    text = t.granny;
  } else if (options.shape === 'circle') {
    text = t.circleIncreases(increases.count, aspect, formatNumber(increases.exact, 1));
  } else {
    const corners = MOTIF_CORNERS[options.shape]!;
    text = t.polygonIncreases(formatNumber(increases.exact, 1), corners, aspect);
  }
  return `${text} ${sourceNote(increases, stitch)}`;
}

function sourceNote(increases: FlatIncreases, stitch: string): string {
  const t = texts().panels.round;
  if (increases.source === 'estimated') return t.estimated(stitch);
  const from = increases.from ? stitchById(increases.from).terms[termsLocale()].name : stitch;
  const measured = increases.source === 'label' ? t.fromLabel : t.fromMeasured;
  return from === stitch ? t.sameStitch(from, measured) : t.convertedStitch(from, measured, stitch);
}

/** Az állapotsor üzenete a létrehozás után. */
export function generatedMessage(options: MotifOptions): string {
  const t = texts().panels.round;
  return t.generated(t.names[options.shape], options.rounds);
}
