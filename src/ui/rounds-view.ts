// KB: interface.md §1

import {
  type JogFix,
  MOTIF_CORNERS,
  MOTIF_SHAPES,
  type MotifOptions,
  type MotifShape,
  motifStitch,
  ROUND_STITCHES,
  type RoundClosing,
  type RoundStart,
} from '../core/round-generator.ts';
import type { FlatIncreases } from '../core/rounds.ts';
import { stitchById } from '../core/stitches.ts';
import { texts } from './i18n.ts';
import { termsLocale } from './notation.ts';
import { formatNumber } from './size-view.ts';

export interface Choice<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly soon?: boolean;
}

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase('hu') + text.slice(1);

// KB: interface.md §9
export const DISABLED_MOTIFS: readonly MotifShape[] = ['granny-square'];

export const SHAPE_CHOICES: readonly Choice<MotifShape>[] = MOTIF_SHAPES.map((value) => ({
  value,
  soon: DISABLED_MOTIFS.includes(value),
  get label() {
    const name = texts().panels.round.names[value];
    return DISABLED_MOTIFS.includes(value) ? `${name} — ${texts().sections.types.soon}` : name;
  },
}));

export const STITCH_CHOICES: readonly Choice<string>[] = ROUND_STITCHES.map((value) => ({
  value,
  get label() {
    return capitalize(stitchById(value).terms[termsLocale()].name);
  },
}));

export const START_CHOICES: readonly Choice<RoundStart>[] = (['magic-ring', 'chain-ring', 'chain'] as const).map(
  (value) => ({
    value,
    get label() {
      return texts().panels.round.starts[value];
    },
  }),
);

export const CLOSING_CHOICES: readonly Choice<RoundClosing>[] = (['join-slip', 'spiral'] as const).map((value) => ({
  value,
  get label() {
    return texts().panels.round.closings[value];
  },
}));

export const JOG_CHOICES: readonly Choice<JogFix | 'none'>[] = (['none', 'slip-stitch', 'back-loop'] as const).map(
  (value) => ({
    value,
    get label() {
      return texts().panels.round.jogs[value];
    },
  }),
);

export interface FieldState {
  readonly stitch: boolean;
  readonly chainStart: boolean;
  readonly closing: boolean;
  readonly stagger: boolean;
  readonly jogFix: boolean;
  readonly ribbing: boolean;
  readonly ribbingFields: boolean;
}

export function fieldState(options: MotifOptions): FieldState {
  const granny = options.shape === 'granny-square';
  return {
    stitch: !granny,
    chainStart: !granny,
    closing: !granny,
    stagger: options.shape === 'circle',
    jogFix: !granny && options.closing === 'spiral' && options.colorEvery > 0,
    // Ribbing starts after the round is joined; a spiral has no place for it to start from.
    ribbing: options.closing === 'join-slip',
    ribbingFields: options.closing === 'join-slip' && Boolean(options.ribbing),
  };
}

export function normalizeMotif(options: MotifOptions): MotifOptions {
  const granny = options.shape === 'granny-square';
  const next: MotifOptions = granny
    ? {
        ...options,
        stitch: 'dc',
        closing: 'join-slip',
        start: options.start === 'chain' ? 'magic-ring' : options.start,
      }
    : options;
  const chosen = fieldState(next).ribbing ? next : { ...next, ribbing: null };
  return fieldState(chosen).jogFix ? chosen : { ...chosen, jogFix: null };
}

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

export function generatedMessage(options: MotifOptions): string {
  const t = texts().panels.round;
  return t.generated(t.names[options.shape], options.rounds + (options.ribbing?.rows ?? 0));
}
