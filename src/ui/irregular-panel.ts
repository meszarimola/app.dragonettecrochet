// The free-form editor's properties panel. KB: interface.md §7, §8

import type { AlignMode, DistributeAxis, FlipAxis, ItemPatch } from '../core/irregular-document.ts';
import type { IrregularItem } from '../core/irregular-types.ts';
import { stitchById } from '../core/stitches.ts';
import type { StitchInsertion } from '../core/types.ts';
import { texts } from './i18n.ts';

export interface IrregularPanelHost {
  patch(patch: ItemPatch): void;
  align(mode: AlignMode): void;
  distribute(axis: DistributeAxis): void;
  flip(axis: FlipAxis): void;
  setRectPartial(partial: boolean): void;
}

const INSERTIONS: readonly StitchInsertion[] = ['both-loops', 'front-loop', 'back-loop', 'front-post', 'back-post'];
const DEFAULT_COLOR = '#000000';

function must<T extends Element>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (found === null) throw new Error(`Missing element: ${selector}`);
  return found;
}

function option(value: string, label: string): HTMLOptionElement {
  const element = document.createElement('option');
  element.value = value;
  element.textContent = label;
  return element;
}

/** One value when every selected stitch agrees, otherwise nothing to show. */
function shared<T>(items: readonly IrregularItem[], read: (item: IrregularItem) => T): T | null {
  const first = items[0];
  if (first === undefined) return null;
  const value = read(first);
  return items.every((item) => read(item) === value) ? value : null;
}

function allowedInsertions(items: readonly IrregularItem[]): StitchInsertion[] {
  return INSERTIONS.filter((mode) =>
    items.every((item) => stitchById(item.keyEntryId)?.insertionModes.includes(mode) ?? false),
  );
}

export class IrregularPanel {
  readonly #section: HTMLDetailsElement;
  readonly #host: IrregularPanelHost;
  readonly #empty: HTMLElement;
  readonly #fields: HTMLElement;
  readonly #count: HTMLElement;
  readonly #x: HTMLInputElement;
  readonly #y: HTMLInputElement;
  readonly #width: HTMLInputElement;
  readonly #height: HTMLInputElement;
  readonly #ratio: HTMLInputElement;
  readonly #rotation: HTMLInputElement;
  readonly #insertion: HTMLSelectElement;
  readonly #insertionField: HTMLElement;
  readonly #color: HTMLInputElement;
  readonly #rectMode: HTMLSelectElement;
  #items: readonly IrregularItem[] = [];

  constructor(section: HTMLDetailsElement, host: IrregularPanelHost) {
    this.#section = section;
    this.#host = host;
    this.#empty = must<HTMLElement>(section, '#props-empty');
    this.#fields = must<HTMLElement>(section, '#props-fields');
    this.#count = must<HTMLElement>(section, '#props-count');
    this.#x = must<HTMLInputElement>(section, '#prop-x');
    this.#y = must<HTMLInputElement>(section, '#prop-y');
    this.#width = must<HTMLInputElement>(section, '#prop-width');
    this.#height = must<HTMLInputElement>(section, '#prop-height');
    this.#ratio = must<HTMLInputElement>(section, '#prop-ratio');
    this.#rotation = must<HTMLInputElement>(section, '#prop-rotation');
    this.#insertion = must<HTMLSelectElement>(section, '#prop-insertion');
    this.#insertionField = must<HTMLElement>(section, '#prop-insertion').closest('p') ?? this.#fields;
    this.#color = must<HTMLInputElement>(section, '#prop-color');
    this.#rectMode = must<HTMLSelectElement>(section, '#prop-rect-mode');
    this.#listen();
  }

  #listen(): void {
    this.#x.addEventListener('change', () => this.#number(this.#x, (value) => this.#host.patch({ x: value })));
    this.#y.addEventListener('change', () => this.#number(this.#y, (value) => this.#host.patch({ y: value })));
    this.#width.addEventListener('change', () => this.#number(this.#width, (value) => this.#resize('width', value)));
    this.#height.addEventListener('change', () => this.#number(this.#height, (value) => this.#resize('height', value)));
    this.#rotation.addEventListener('change', () =>
      this.#number(this.#rotation, (value) => this.#host.patch({ rotation: ((value % 360) + 360) % 360 })),
    );
    this.#insertion.addEventListener('change', () => {
      const mode = INSERTIONS.find((candidate) => candidate === this.#insertion.value);
      if (mode !== undefined) this.#host.patch({ insertion: mode });
    });
    this.#color.addEventListener('change', () => this.#host.patch({ color: this.#color.value }));
    must<HTMLButtonElement>(this.#section, '#prop-color-clear').addEventListener('click', () =>
      this.#host.patch({ color: null }),
    );
    must<HTMLButtonElement>(this.#section, '#prop-flip-h').addEventListener('click', () =>
      this.#host.flip('horizontal'),
    );
    must<HTMLButtonElement>(this.#section, '#prop-flip-v').addEventListener('click', () => this.#host.flip('vertical'));
    this.#section.addEventListener('click', (event) => {
      const target = (event.target as Element).closest<HTMLElement>('[data-align], [data-distribute]');
      if (target === null) return;
      const align = target.dataset['align'];
      if (align !== undefined) this.#host.align(align as AlignMode);
      const spread = target.dataset['distribute'];
      if (spread !== undefined) this.#host.distribute(spread as DistributeAxis);
    });
    this.#rectMode.addEventListener('change', () => this.#host.setRectPartial(this.#rectMode.value === 'partial'));
  }

  #number(input: HTMLInputElement, apply: (value: number) => void): void {
    const value = Number(input.value);
    if (Number.isFinite(value)) apply(value);
  }

  /** With proportions kept, the other side follows the one you typed. */
  #resize(side: 'width' | 'height', value: number): void {
    if (value <= 0) return;
    if (!this.#ratio.checked) {
      this.#host.patch(side === 'width' ? { width: value } : { height: value });
      return;
    }
    const first = this.#items[0];
    if (first === undefined) return;
    const current = side === 'width' ? first.width : first.height;
    if (current <= 0) return;
    const k = value / current;
    this.#host.patch(
      side === 'width' ? { width: value, height: first.height * k } : { height: value, width: first.width * k },
    );
  }

  reveal(): void {
    this.#section.hidden = false;
    this.#section.open = true;
  }

  hide(): void {
    this.#section.hidden = true;
  }

  update(items: readonly IrregularItem[], rectPartial: boolean, total: number): void {
    this.#items = items;
    const words = texts().irregular;
    this.#rectMode.replaceChildren(option('partial', words.rectPartial), option('full', words.rectFull));
    this.#rectMode.value = rectPartial ? 'partial' : 'full';
    this.#count.textContent = items.length === 0 ? words.selectedNone : words.selected(items.length);
    this.#empty.hidden = items.length > 0;
    this.#fields.hidden = items.length === 0;
    if (items.length === 0) {
      this.#count.textContent = total === 0 ? '' : words.selectedNone;
      return;
    }
    this.#setNumber(
      this.#x,
      shared(items, (item) => Math.round(item.x)),
    );
    this.#setNumber(
      this.#y,
      shared(items, (item) => Math.round(item.y)),
    );
    this.#setNumber(
      this.#width,
      shared(items, (item) => Math.round(item.width)),
    );
    this.#setNumber(
      this.#height,
      shared(items, (item) => Math.round(item.height)),
    );
    this.#setNumber(
      this.#rotation,
      shared(items, (item) => Math.round(item.rotation)),
    );
    this.#color.value = shared(items, (item) => item.color) ?? DEFAULT_COLOR;
    this.#updateInsertion(items);
  }

  #updateInsertion(items: readonly IrregularItem[]): void {
    const names = texts().sections.insertion.names;
    const allowed = allowedInsertions(items);
    this.#insertionField.hidden = allowed.length < 2;
    if (allowed.length < 2) return;
    this.#insertion.replaceChildren(...allowed.map((mode) => option(mode, names[mode])));
    const mode = shared(items, (item) => item.insertion);
    this.#insertion.value = mode ?? '';
  }

  #setNumber(input: HTMLInputElement, value: number | null): void {
    input.value = value === null ? '' : String(value);
    input.placeholder = value === null ? '—' : '';
  }
}
