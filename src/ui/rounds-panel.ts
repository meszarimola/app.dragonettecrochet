/*
 * A „Kör és motívum” szakasz (PQW-861): forma, szem, kezdés, körszám,
 * körvég, eltolt szaporítás és színváltás, a szaporítás magyarázata, és a
 * minta létrehozása.
 *
 * A mezők az index.html-ben vannak. A létrehozás a mintát cseréli, ezért
 * visszavonható; új tárolókulcs nincs, a választás csak a lapon él. A szakasz
 * csak nyitva számol, mert a vászon egérmozgásra is frissít.
 */

import { generateMotif, motifIncreases, motifProblem, type MotifOptions } from '../core/round-generator.js';
import type { Pattern } from '../core/types.js';
import { amigurumiCoreText } from './i18n/core/amigurumi.js';
import {
  CLOSING_CHOICES,
  JOG_CHOICES,
  SHAPE_CHOICES,
  START_CHOICES,
  STITCH_CHOICES,
  fieldState,
  generatedMessage,
  increaseNote,
  normalizeMotif,
  type Choice,
} from './rounds-view.js';

export interface RoundsPanelHost {
  /** Az új minta a visszavonási veremre, az üzenettel. */
  commit(pattern: Pattern, message: string): void;
  announce(message: string): void;
}

export class RoundsPanel {
  readonly #section: HTMLDetailsElement;
  readonly #host: RoundsPanelHost;
  readonly #shape: HTMLSelectElement;
  readonly #stitch: HTMLSelectElement;
  readonly #start: HTMLSelectElement;
  readonly #count: HTMLInputElement;
  readonly #closing: HTMLSelectElement;
  readonly #stagger: HTMLInputElement;
  readonly #colors: HTMLInputElement;
  readonly #jog: HTMLSelectElement;
  readonly #note: HTMLElement;
  #pattern: Pattern | null = null;
  #shown: string | null = null;

  constructor(section: HTMLDetailsElement, host: RoundsPanelHost) {
    this.#section = section;
    this.#host = host;
    const field = <T extends HTMLElement>(id: string): T => {
      const el = section.querySelector<T>(`#${id}`);
      if (!el) throw new Error(`Hiányzó mező: #${id}`);
      return el;
    };
    this.#shape = fill(field('rounds-shape'), SHAPE_CHOICES);
    this.#stitch = fill(field('rounds-stitch'), STITCH_CHOICES);
    this.#start = fill(field('rounds-start'), START_CHOICES);
    this.#count = field('rounds-count');
    this.#closing = fill(field('rounds-closing'), CLOSING_CHOICES);
    this.#stagger = field('rounds-stagger');
    this.#colors = field('rounds-colors');
    this.#jog = fill(field('rounds-jog'), JOG_CHOICES);
    this.#note = field('rounds-note');

    section.addEventListener('toggle', () => this.#render());
    for (const input of [this.#shape, this.#stitch, this.#start, this.#count, this.#closing, this.#stagger, this.#colors, this.#jog]) {
      input.addEventListener('change', () => this.#render());
    }
    field<HTMLButtonElement>('rounds-create').addEventListener('click', () => this.#create());
  }

  update(pattern: Pattern): void {
    if (pattern === this.#pattern) return;
    this.#pattern = pattern;
    if (this.#section.open) this.#render();
  }

  #options(): MotifOptions {
    const whole = (input: HTMLInputElement) => (input.value.trim() === '' ? Number.NaN : Number(input.value));
    return normalizeMotif({
      shape: this.#shape.value as MotifOptions['shape'],
      stitch: this.#stitch.value,
      rounds: whole(this.#count),
      start: this.#start.value as MotifOptions['start'],
      closing: this.#closing.value as MotifOptions['closing'],
      stagger: this.#stagger.checked,
      colorEvery: whole(this.#colors),
      jogFix: this.#jog.value === 'none' ? null : (this.#jog.value as MotifOptions['jogFix']),
    });
  }

  #render(): void {
    if (!this.#section.open || !this.#pattern) return;
    const options = this.#options();
    const state = fieldState(options);
    // A formához nem illő választás a mezőkben is látszik: a nagymama-négyzet pálcás, zárt kör.
    this.#stitch.value = options.stitch;
    this.#start.value = options.start;
    this.#closing.value = options.closing;
    this.#stitch.disabled = !state.stitch;
    this.#closing.disabled = !state.closing;
    this.#stagger.disabled = !state.stagger;
    this.#jog.disabled = !state.jogFix;
    const chainStart = this.#start.querySelector<HTMLOptionElement>('option[value="chain"]');
    if (chainStart) chainStart.disabled = !state.chainStart;

    const problem = motifProblem(options);
    const text = problem ? amigurumiCoreText(problem) : increaseNote(motifIncreases(this.#pattern, options), options);
    if (text !== this.#shown) {
      this.#note.textContent = text;
      this.#shown = text;
    }
  }

  #create(): void {
    if (!this.#pattern) return;
    const options = this.#options();
    const result = generateMotif(this.#pattern, options);
    if (!result.ok) {
      this.#host.announce(amigurumiCoreText(result.reason));
      return;
    }
    this.#host.commit(result.pattern, generatedMessage(options));
  }
}

function fill<T extends string>(select: HTMLSelectElement, choices: readonly Choice<T>[]): HTMLSelectElement {
  select.replaceChildren(
    ...choices.map((choice) => {
      const option = document.createElement('option');
      option.value = choice.value;
      option.textContent = choice.label;
      return option;
    }),
  );
  return select;
}
