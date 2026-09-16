/*
 * A „Beszúrás” választó a Szemek szakaszban (PQW-869): natív rádiógombok,
 * ezért billentyűzettel a Tab és a nyilak kezelik, a képernyőolvasó a
 * csoport nevével és a mód nevével olvassa fel. A tartalom az
 * insertion-view.ts-ből jön.
 */

import type { Locale, StitchDef, StitchInsertion } from '../core/types.js';
import { texts } from './i18n.js';
import { insertionChoice, type InsertionChoice } from './insertion-view.js';
import { textLanguage } from './notation.js';

export class InsertionPanel {
  readonly #field: HTMLFieldSetElement;
  readonly #options: HTMLElement;
  readonly #written: HTMLElement;
  /** A legutóbb választott mód; másik szemnél is ez érvényes, ha az a szem megengedi. */
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

  /** A lerakáskor érvényes mód a horgoló felől; `undefined`, ha a szemnek nincs választható módja. */
  get insertion(): StitchInsertion | undefined {
    return this.#choice?.selected;
  }

  /** A kiválasztott szem vagy a jelölés változott: a gombok csak ekkor épülnek újra, a fókusz így nem vész el. */
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
