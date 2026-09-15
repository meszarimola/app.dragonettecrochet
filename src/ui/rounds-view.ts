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
  MOTIF_NAMES,
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
import { formatNumber } from './size-view.ts';

export interface Choice<T extends string> {
  readonly value: T;
  readonly label: string;
}

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase('hu') + text.slice(1);

/** A határozott névelő egy szó előtt: „a rövidpálca”, „az egyráhajtásos pálca”. */
const withArticle = (word: string) => `${/^[aáeéiíoóöőuúüű]/i.test(word) ? 'az' : 'a'} ${word}`;

export const SHAPE_CHOICES: readonly Choice<MotifShape>[] = MOTIF_SHAPES.map((value) => ({ value, label: MOTIF_NAMES[value] }));

export const STITCH_CHOICES: readonly Choice<string>[] = ROUND_STITCHES.map((value) => ({
  value,
  label: capitalize(stitchById(value).terms.hu.name),
}));

export const START_CHOICES: readonly Choice<RoundStart>[] = [
  { value: 'magic-ring', label: 'Varázskör' },
  { value: 'chain-ring', label: 'Láncgyűrű' },
  { value: 'chain', label: 'Láncszembe (pl. 2 lsz, 6 rp a 2. láncszembe)' },
];

export const CLOSING_CHOICES: readonly Choice<RoundClosing>[] = [
  { value: 'join-slip', label: 'Zárt kör: kúszószem és kezdőlánc' },
  { value: 'spiral', label: 'Spirál körjelölővel' },
];

export const JOG_CHOICES: readonly Choice<JogFix | 'none'>[] = [
  { value: 'none', label: 'Nincs' },
  { value: 'slip-stitch', label: 'Kúszószem az első szem helyett' },
  { value: 'back-loop', label: 'Új szín az első szem hátsó szálába' },
];

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
  const stitch = stitchById(motifStitch(options)).terms.hu.name;
  const aspect = formatNumber(increases.aspect, 2);
  let text: string;
  if (options.shape === 'granny-square') {
    text = 'Sarkonként 3 erp, 2 lsz, 3 erp, oldalanként 3 erp, 1 lsz: a sarkok egymás fölé kerülnek.';
  } else if (options.shape === 'circle') {
    text = `Körönként ${increases.count} szaporítás: 2π × ${aspect} ≈ ${formatNumber(increases.exact, 1)}, páros számra kerekítve.`;
  } else {
    const corners = MOTIF_CORNERS[options.shape]!;
    text = `Körönként kb. ${formatNumber(increases.exact, 1)} szaporítás a ${corners} sarokban, egymás fölé kerülve (2 · ${corners} · tg(π/${corners}) × ${aspect}).`;
  }
  return `${text} ${sourceNote(increases, stitch)}`;
}

function sourceNote(increases: FlatIncreases, stitch: string): string {
  if (increases.source === 'estimated') {
    return `Becslés ${withArticle(stitch)} szokásos körös magasság/szélesség arányából. Pontosabb, ha a Méret és fonal szakaszban megadod a körben mért mintasűrűséget.`;
  }
  const from = increases.from ? stitchById(increases.from).terms.hu.name : stitch;
  const measured = increases.source === 'label' ? 'a címkén megadott körös mintasűrűségéből' : 'körben mért mintasűrűségéből';
  return from === stitch
    ? `${capitalize(withArticle(from))} ${measured}.`
    : `${capitalize(withArticle(from))} ${measured}, ${withArticle(stitch)} arányára átszámolva.`;
}

/** Az állapotsor üzenete a létrehozás után. */
export function generatedMessage(options: MotifOptions): string {
  return `${MOTIF_NAMES[options.shape]}, ${options.rounds} kör elkészült; visszavonással a korábbi minta visszajön.`;
}
