/*
 * Az „Amigurumi” szakasz (PQW-863): a rész neve, a forma és a mérete, az
 * eltolás, a szem helye és a játékbiztonság, a körterv előnézete; új minta egy
 * részből, vagy új rész hozzáadása varrva vagy folytatólagosan.
 *
 * A mezők az index.html-ben vannak. A létrehozás és a hozzáadás a mintát
 * cseréli, ezért visszavonható; új tárolókulcs nincs, a választás csak a lapon
 * él. A szakasz csak nyitva számol, mert a vászon egérmozgásra is frissít.
 */

import { addAmigurumiPart, createAmigurumi, partName } from '../core/amigurumi-generator.js';
import { roundGaugeOf } from '../core/amigurumi.js';
import type { Pattern } from '../core/types.js';
import {
  BOTTOM_CHOICES,
  JOIN_CHOICES,
  METHOD_CHOICES,
  SHAPE_CHOICES,
  TOP_CHOICES,
  addedMessage,
  createdMessage,
  fieldState,
  figureNote,
  gaugeNote,
  partOf,
  previewNote,
  safetyNote,
  type AmigurumiForm,
  type FieldState,
} from './amigurumi-view.js';
import type { Choice } from './rounds-view.js';

export interface AmigurumiPanelHost {
  /** Az új minta a visszavonási veremre, az üzenettel. */
  commit(pattern: Pattern, message: string): void;
  announce(message: string): void;
}

export class AmigurumiPanel {
  readonly #section: HTMLDetailsElement;
  readonly #host: AmigurumiPanelHost;
  readonly #name: HTMLInputElement;
  readonly #shape: HTMLSelectElement;
  readonly #method: HTMLSelectElement;
  readonly #diameter: HTMLInputElement;
  readonly #height: HTMLInputElement;
  readonly #increases: HTMLInputElement;
  readonly #profile: HTMLTextAreaElement;
  readonly #bottom: HTMLSelectElement;
  readonly #top: HTMLSelectElement;
  readonly #stagger: HTMLInputElement;
  readonly #eyes: HTMLInputElement;
  readonly #under3: HTMLInputElement;
  readonly #join: HTMLSelectElement;
  readonly #distribute: HTMLInputElement;
  readonly #gauge: HTMLElement;
  readonly #summary: HTMLElement;
  readonly #safety: HTMLElement;
  readonly #figure: HTMLElement;
  #pattern: Pattern | null = null;

  constructor(section: HTMLDetailsElement, host: AmigurumiPanelHost) {
    this.#section = section;
    this.#host = host;
    const field = <T extends HTMLElement>(id: string): T => {
      const el = section.querySelector<T>(`#${id}`);
      if (!el) throw new Error(`Hiányzó mező: #${id}`);
      return el;
    };
    this.#name = field('amigurumi-name');
    this.#shape = fill(field('amigurumi-shape'), SHAPE_CHOICES);
    this.#method = fill(field('amigurumi-method'), METHOD_CHOICES);
    this.#diameter = field('amigurumi-diameter');
    this.#height = field('amigurumi-height');
    this.#increases = field('amigurumi-increases');
    this.#profile = field('amigurumi-profile');
    this.#bottom = fill(field('amigurumi-bottom'), BOTTOM_CHOICES);
    this.#top = fill(field('amigurumi-top'), TOP_CHOICES);
    this.#stagger = field('amigurumi-stagger');
    this.#eyes = field('amigurumi-eyes');
    this.#under3 = field('amigurumi-under3');
    this.#join = fill(field('amigurumi-join'), JOIN_CHOICES);
    this.#distribute = field('amigurumi-distribute');
    this.#gauge = field('amigurumi-gauge');
    this.#summary = field('amigurumi-summary');
    this.#safety = field('amigurumi-safety');
    this.#figure = field('amigurumi-figure');

    section.addEventListener('toggle', () => this.#render());
    section.addEventListener('input', () => this.#render());
    section.addEventListener('change', () => this.#render());
    field<HTMLButtonElement>('amigurumi-create').addEventListener('click', () => this.#create());
    field<HTMLButtonElement>('amigurumi-add').addEventListener('click', () => this.#add());
  }

  /** A szakasz lenyitása, pl. az amigurumi mintatípus kiválasztásakor. */
  reveal(): void {
    this.#section.open = true;
  }

  update(pattern: Pattern): void {
    if (pattern === this.#pattern) return;
    this.#pattern = pattern;
    if (this.#section.open) this.#render();
  }

  #form(): AmigurumiForm {
    return {
      name: this.#name.value,
      shape: this.#shape.value as AmigurumiForm['shape'],
      method: this.#method.value as AmigurumiForm['method'],
      diameter: this.#diameter.value,
      height: this.#height.value,
      increases: this.#increases.value,
      profile: this.#profile.value,
      bottom: this.#bottom.value as AmigurumiForm['bottom'],
      top: this.#top.value as AmigurumiForm['top'],
      stagger: this.#stagger.checked,
      eyes: this.#eyes.checked,
      under3: this.#under3.checked,
      join: this.#join.value as AmigurumiForm['join'],
      distribute: this.#distribute.checked,
    };
  }

  #render(): void {
    if (!this.#section.open || !this.#pattern) return;
    const form = this.#form();
    const state = fieldState(form.shape);
    for (const el of this.#section.querySelectorAll<HTMLElement>('[data-field]')) {
      const shown = state[el.dataset['field'] as keyof FieldState];
      if (el.hidden === shown) el.hidden = !shown;
    }
    const gauge = roundGaugeOf(this.#pattern);
    setText(this.#gauge, gaugeNote(gauge));
    setText(this.#summary, previewNote(form, gauge));
    setOptional(this.#safety, safetyNote(form.under3));
    setOptional(this.#figure, figureNote(this.#pattern, gauge));
  }

  #create(): void {
    if (!this.#pattern) return;
    const form = this.#form();
    const part = partOf(form);
    if (typeof part === 'string') return this.#host.announce(part);
    const result = createAmigurumi(this.#pattern, part, form.under3);
    if (!result.ok) return this.#host.announce(result.reason);
    this.#host.commit(result.pattern, createdMessage(partName(part)));
  }

  #add(): void {
    if (!this.#pattern) return;
    const form = this.#form();
    const part = partOf(form);
    if (typeof part === 'string') return this.#host.announce(part);
    const result = addAmigurumiPart(this.#pattern, part, { method: form.join, distribute: form.distribute }, form.under3);
    if (!result.ok) return this.#host.announce(result.reason);
    this.#host.commit(result.pattern, addedMessage(partName(part), form.join));
  }
}

function setText(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

function setOptional(el: HTMLElement, text: string | null): void {
  el.hidden = text === null;
  setText(el, text ?? '');
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
