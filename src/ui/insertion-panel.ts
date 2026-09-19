// KB: interface.md §24

import type { Locale, StitchDef, StitchInsertion } from '../core/types.js';
import { texts } from './i18n.js';
import { type InsertionChoice, insertionChoice } from './insertion-view.js';
import { textLanguage } from './notation.js';

export class InsertionPanel {
  readonly #field: HTMLFieldSetElement;
  readonly #options: HTMLElement;
  readonly #written: HTMLElement;
  #preferred: StitchInsertion = 'both-loops';
  #def: StitchDef | undefined;
  #terms: Locale = 'hu';
  #choice: InsertionChoice | null = null;

  constructor(field: HTMLFieldSetElement) {
    this.#field = field;
    this.#options = field.querySelector<HTMLElement>('.insertion__options')!;
    this.#written = field.querySelector<HTMLElement>('.insertion__written')!;
    field.addEventListener('change', (event) => {
      const input = event.target as HTMLInputElement;
      if (input.name !== 'insertion') return;
      this.#preferred = input.value as StitchInsertion;
      this.#choice = insertionChoice(this.#def, this.#preferred, this.#terms);
      this.#showWritten();
    });
  }

  get insertion(): StitchInsertion | undefined {
    return this.#choice?.selected;
  }

  // KB: interface.md §8 — rebuild only on a real change, or the focus is lost.
  update(def: StitchDef | undefined, terms: Locale): void {
    this.#def = def;
    this.#terms = terms;
    this.#choice = insertionChoice(def, this.#preferred, terms);
    this.#field.hidden = this.#choice === null;
    if (!this.#choice) {
      this.#options.replaceChildren();
      return;
    }
    const { selected } = this.#choice;
    this.#options.replaceChildren(
      ...this.#choice.options.map(({ mode, label }) => {
        const wrapper = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'insertion';
        input.value = mode;
        input.checked = mode === selected;
        wrapper.append(input, ` ${label}`);
        return wrapper;
      }),
    );
    this.#showWritten();
  }

  #showWritten(): void {
    const written = this.#choice?.written ?? null;
    this.#written.hidden = written === null;
    if (written === null) return;
    const sample = document.createElement('span');
    sample.lang = textLanguage(this.#terms);
    sample.textContent = written;
    this.#written.replaceChildren(texts().sections.insertion.written, sample);
  }
}
