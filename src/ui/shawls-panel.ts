// KB: interface.md §7

import { activeProfile } from '../core/pattern-size.js';
import { generateShawl, planShawl, type ShawlOptions, shawlSizes } from '../core/shawls.js';
import type { Pattern } from '../core/types.js';
import type { Choice } from './shapes-view.js';
import {
  edgingLabel,
  generatedMessage,
  KIND_CHOICES,
  normalizeShawl,
  RATE_CHOICES,
  rateLabel,
  type ShawlOutline,
  STITCH_CHOICES,
  shawlFieldState,
  shawlOutline,
  shawlReason,
  shawlView,
  sizeLabel,
} from './shawls-view.js';

export interface ShawlsPanelHost {
  commit(pattern: Pattern, message: string): void;
  announce(message: string): void;
}

const SVG = 'http://www.w3.org/2000/svg';

function decimal(input: HTMLInputElement): number {
  const text = input.value.trim().replace(',', '.');
  return text === '' ? Number.NaN : Number(text);
}

export class ShawlsPanel {
  readonly #section: HTMLDetailsElement;
  readonly #host: ShawlsPanelHost;
  readonly #kind: HTMLSelectElement;
  readonly #stitch: HTMLSelectElement;
  readonly #size: HTMLInputElement;
  readonly #sizeLabel: HTMLElement;
  readonly #length: HTMLInputElement;
  readonly #rate: HTMLSelectElement;
  readonly #custom: HTMLInputElement;
  readonly #customLabel: HTMLElement;
  readonly #wings: HTMLInputElement;
  readonly #edging: HTMLInputElement;
  readonly #edgingLabel: HTMLElement;
  readonly #edgingX: HTMLInputElement;
  readonly #edgingY: HTMLInputElement;
  readonly #blockWidth: HTMLInputElement;
  readonly #blockHeight: HTMLInputElement;
  readonly #groups: Readonly<Record<'length' | 'rate' | 'custom' | 'wings', HTMLElement>>;
  readonly #result: HTMLElement;
  readonly #details: HTMLElement;
  readonly #warnings: HTMLElement;
  readonly #source: HTMLElement;
  readonly #previewBox: HTMLElement;
  readonly #preview: SVGSVGElement;
  #pattern: Pattern | null = null;
  #shown: string | null = null;

  constructor(section: HTMLDetailsElement, host: ShawlsPanelHost) {
    this.#section = section;
    this.#host = host;
    const field = <T extends Element>(id: string): T => {
      const el = section.querySelector<T>(`#${id}`);
      if (!el) throw new Error(`Hiányzó mező: #${id}`);
      return el;
    };
    this.#kind = fill(field('shawl-kind'), KIND_CHOICES);
    this.#stitch = fill(field('shawl-stitch'), STITCH_CHOICES);
    this.#stitch.value = 'dc';
    this.#size = field('shawl-size');
    this.#sizeLabel = field('shawl-size-label');
    this.#length = field('shawl-length');
    this.#rate = fill(field('shawl-rate'), RATE_CHOICES);
    this.#custom = field('shawl-custom');
    this.#customLabel = field('shawl-custom-label');
    this.#wings = field('shawl-wings');
    this.#edging = field('shawl-edging');
    this.#edgingLabel = field('shawl-edging-label');
    this.#edgingX = field('shawl-edging-x');
    this.#edgingY = field('shawl-edging-y');
    this.#blockWidth = field('shawl-block-width');
    this.#blockHeight = field('shawl-block-height');
    this.#groups = {
      length: field('shawl-length-field'),
      rate: field('shawl-rate-fields'),
      custom: field('shawl-custom-field'),
      wings: field('shawl-wings-field'),
    };
    this.#result = field('shawl-result');
    this.#details = field('shawl-details');
    this.#warnings = field('shawl-warnings');
    this.#source = field('shawl-source');
    this.#previewBox = field('shawl-preview-box');
    this.#preview = field('shawl-preview');

    section.addEventListener('toggle', () => this.#render());
    for (const input of [this.#kind, this.#stitch, this.#rate, this.#wings, this.#edging]) {
      input.addEventListener('change', () => this.#render());
    }
    for (const input of [
      this.#size,
      this.#length,
      this.#custom,
      this.#edgingX,
      this.#edgingY,
      this.#blockWidth,
      this.#blockHeight,
    ]) {
      input.addEventListener('input', () => this.#render());
    }
    field<HTMLButtonElement>('shawl-create').addEventListener('click', () => this.#create());
  }

  update(pattern: Pattern): void {
    if (pattern === this.#pattern) return;
    this.#pattern = pattern;
    if (this.#section.open) this.#render();
  }

  #options(): ShawlOptions {
    return normalizeShawl({
      kind: this.#kind.value as ShawlOptions['kind'],
      stitch: this.#stitch.value,
      sizeCm: decimal(this.#size),
      lengthCm: decimal(this.#length),
      rate: this.#rate.value as ShawlOptions['rate'],
      customRate: decimal(this.#custom),
      wings: this.#wings.checked,
      edging: this.#edging.checked ? { width: decimal(this.#edgingX), edge: decimal(this.#edgingY) } : null,
      blocking: { widthPct: decimal(this.#blockWidth), heightPct: decimal(this.#blockHeight) },
    });
  }

  #render(): void {
    if (!this.#section.open || !this.#pattern) return;
    const options = this.#options();
    const state = shawlFieldState(options);
    this.#sizeLabel.textContent = sizeLabel(options.kind);
    this.#customLabel.textContent = rateLabel(options.kind);
    this.#edgingLabel.textContent = edgingLabel(options.kind);
    for (const [key, group] of Object.entries(this.#groups)) group.hidden = !state[key as keyof typeof state];
    for (const input of [this.#edgingX, this.#edgingY]) input.disabled = !this.#edging.checked;

    const planned = planShawl(this.#pattern, options);
    const sizes = planned.ok ? shawlSizes(planned.plan, options.blocking) : null;
    const view =
      planned.ok && sizes ? shawlView(planned.plan, options, sizes, activeProfile(this.#pattern) !== null) : null;
    const outline = sizes ? shawlOutline(sizes) : null;
    const reason = planned.ok ? null : shawlReason(planned.reason);
    const key = JSON.stringify([planned.ok ? view : reason, outline]);
    if (key === this.#shown) return;
    this.#shown = key;

    if (!planned.ok || !view) {
      this.#result.textContent = reason ?? '';
      this.#details.replaceChildren();
      this.#warnings.replaceChildren();
      this.#source.textContent = '';
      this.#draw(null);
      return;
    }
    this.#result.textContent = view.size;
    this.#details.replaceChildren(...view.details.map(item));
    this.#warnings.replaceChildren(...view.warnings.map(item));
    this.#source.textContent = view.source;
    this.#draw(outline);
  }

  #draw(outline: ShawlOutline | null): void {
    this.#previewBox.hidden = outline === null;
    if (!outline) {
      this.#preview.replaceChildren();
      return;
    }
    this.#preview.setAttribute('viewBox', `0 0 ${outline.width} ${outline.height}`);
    const polygon = (points: string, className: string) => {
      const shape = document.createElementNS(SVG, 'polygon');
      shape.setAttribute('points', points);
      shape.setAttribute('class', className);
      shape.setAttribute('vector-effect', 'non-scaling-stroke');
      return shape;
    };
    this.#preview.replaceChildren(
      polygon(outline.blocked, 'shape__piece'),
      polygon(outline.unblocked, 'shawl__unblocked'),
    );
  }

  #create(): void {
    if (!this.#pattern) return;
    const result = generateShawl(this.#pattern, this.#options());
    if (!result.ok) {
      this.#host.announce(shawlReason(result.reason));
      return;
    }
    this.#host.commit(result.pattern, generatedMessage(result.plan));
  }
}

function item(text: string): HTMLLIElement {
  const element = document.createElement('li');
  element.textContent = text;
  return element;
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
