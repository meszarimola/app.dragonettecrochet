// The granny square's rounds panel. KB: interface.md §68

import { clampGrannyCount } from '../core/irregular-groups.ts';
import { DEFAULT_GRANNY_COUNT } from '../core/irregular-types.ts';
import { texts } from './i18n.ts';

export interface GrannyPanelHost {
  addRound(count: number): void;
  setCount(roundId: string, count: number): void;
  removeLast(): void;
  setRadial(on: boolean): void;
}

export interface GrannyView {
  /** The stitch armed on the palette, or `null` while none is. KB: interface.md §70 */
  readonly stitch: string | null;
  readonly radial: boolean;
}

export interface GrannyRoundView {
  readonly id: string;
  readonly count: number;
  readonly stitch: string;
}

function must<T extends Element>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (found === null) throw new Error(`Missing element: ${selector}`);
  return found;
}

export class GrannyPanel {
  readonly #section: HTMLElement;
  readonly #host: GrannyPanelHost;
  readonly #list: HTMLOListElement;
  readonly #count: HTMLInputElement;
  readonly #remove: HTMLButtonElement;
  readonly #empty: HTMLElement;
  readonly #add: HTMLButtonElement;
  readonly #radial: HTMLInputElement;
  readonly #hint: HTMLElement;

  constructor(section: HTMLElement, host: GrannyPanelHost) {
    this.#section = section;
    this.#host = host;
    this.#list = must(section, '#granny-rounds');
    this.#count = must(section, '#granny-count');
    this.#remove = must(section, '#granny-remove');
    this.#empty = must(section, '#granny-empty');
    this.#add = must(section, '#granny-add');
    this.#radial = must(section, '#granny-radial');
    this.#hint = must(section, '#granny-stitch');
    this.#count.value = String(DEFAULT_GRANNY_COUNT);
    this.#add.addEventListener('click', () => this.#addRound());
    this.#radial.addEventListener('change', () => this.#host.setRadial(this.#radial.checked));
    this.#count.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      this.#addRound();
    });
    this.#remove.addEventListener('click', () => this.#host.removeLast());
    this.#list.addEventListener('change', (event) => {
      const input = event.target as HTMLInputElement;
      const roundId = input.dataset['round'];
      if (roundId === undefined || input.value.trim() === '') return;
      this.#host.setCount(roundId, clampGrannyCount(Number(input.value)));
    });
  }

  show(on: boolean): void {
    this.#section.hidden = !on;
  }

  update(rounds: readonly GrannyRoundView[], view: GrannyView): void {
    const words = texts().irregular;
    this.#empty.hidden = rounds.length > 0;
    this.#remove.disabled = rounds.length === 0;
    // KB: interface.md §70 — without a stitch from the palette there is nothing to put in a round.
    this.#add.disabled = view.stitch === null;
    this.#hint.textContent = view.stitch === null ? words.grannyPickStitch : words.grannyStitchArmed(view.stitch);
    if (document.activeElement !== this.#radial) this.#radial.checked = view.radial;
    const focused =
      document.activeElement instanceof HTMLInputElement ? document.activeElement.dataset['round'] : undefined;
    this.#list.replaceChildren(
      ...rounds.map((round, index) => {
        const item = document.createElement('li');
        item.className = 'granny__round';
        const id = `granny-round-${round.id}`;
        const label = document.createElement('label');
        label.htmlFor = id;
        label.className = 'granny__name';
        label.textContent = words.grannyRoundName(index + 1);
        const input = document.createElement('input');
        input.id = id;
        input.type = 'number';
        input.min = '1';
        input.max = '400';
        input.step = '1';
        input.inputMode = 'numeric';
        input.value = String(round.count);
        input.dataset['round'] = round.id;
        const stitch = document.createElement('span');
        stitch.className = 'granny__stitch';
        stitch.textContent = words.grannyRoundStitch(round.stitch);
        item.append(label, input, stitch);
        return item;
      }),
    );
    if (focused !== undefined) this.#list.querySelector<HTMLInputElement>(`[data-round="${focused}"]`)?.focus();
  }

  #addRound(): void {
    if (this.#add.disabled || this.#count.value.trim() === '') return;
    this.#host.addRound(clampGrannyCount(Number(this.#count.value)));
  }
}
