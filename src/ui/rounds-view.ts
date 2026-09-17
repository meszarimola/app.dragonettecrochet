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
  /** Még nem érhető el: a lista mutatja, de nem választható (PQW-925). */
  readonly soon?: boolean;
}

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase('hu') + text.slice(1);

/**
 * Ideiglenesen kikapcsolt motívumok (PQW-925). A nagymama-négyzet az átvételi
 * tesztelés első köréig nem választható: előbb a szabályos horgolás egyszerű
 * útját tesszük rendbe. A generátor kódja a helyén marad; a visszakapcsolás
 * ennyi: üres lista.
 */
export const DISABLED_MOTIFS: readonly MotifShape[] = ['granny-square'];

/**
 * A kikapcsolt motívum felirata a MEGLÉVŐ szótárkulcsot használja
 * (`sections.types.soon`), ugyanazt, amit a mintatípusok „hamarosan” jelvénye
 * — így magyarul és angolul is helyes, új szöveg nélkül.
 */
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
  /** Bordás perem a kör végén (PQW-909); csak kúszószemes zárásnál. */
  readonly ribbing: boolean;
  /** A bordázat körei és egysége; csak bekapcsolt bordázatnál. */
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
    // A bordás perem a kör zárása után kezdődik: spirálban nincs honnan indulnia (PQW-909).
    ribbing: options.closing === 'join-slip',
    ribbingFields: options.closing === 'join-slip' && Boolean(options.ribbing),
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
  const chosen = fieldState(next).ribbing ? next : { ...next, ribbing: null };
  return fieldState(chosen).jogFix ? chosen : { ...chosen, jogFix: null };
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
  // A bordás perem körei is elkészültek: az állapotsor a tényleges körszámot mondja (PQW-909).
  return t.generated(t.names[options.shape], options.rounds + (options.ribbing?.rows ?? 0));
}
