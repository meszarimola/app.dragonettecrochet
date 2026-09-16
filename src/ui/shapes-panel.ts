/*
 * A „Forma” szakasz (PQW-862): forma, szem, méretek cm-ben vagy az él szögével,
 * téglalapnál mintaismétlés és szegély, előnézet a tényleges mérettel, és a
 * minta létrehozása.
 *
 * A mezők az index.html-ben vannak. A létrehozás a mintát cseréli, ezért egy
 * lépésben visszavonható; új tárolókulcs nincs, a választás csak a lapon él. A
 * szakasz csak nyitva számol, mert a vászon egérmozgásra is frissít.
 */

import { activeProfile } from '../core/pattern-size.js';
import { generateShape, planShape, type ShapeOptions } from '../core/shapes.js';
import type { Pattern, PieceBorder } from '../core/types.js';
import {
  HDC_ROW_END_CHOICES,
  MEASURE_CHOICES,
  ROUNDING_CHOICES,
  SHAPE_CHOICES,
  STITCH_CHOICES,
  generatedMessage,
  normalizeShape,
  shapeFieldState,
  shapeOutline,
  shapeReason,
  shapeView,
  widthLabel,
  type Choice,
  type ShapeOutline,
} from './shapes-view.js';

export interface ShapesPanelHost {
  /** Az új minta a visszavonási veremre, az üzenettel. */
  commit(pattern: Pattern, message: string): void;
  announce(message: string): void;
}

const SVG = 'http://www.w3.org/2000/svg';

/** A szám a mezőből; tizedesvesszőt és -pontot is elfogad. Üres vagy érvénytelen mezőre `NaN`: az okot a mag adja. */
function decimal(input: HTMLInputElement): number {
  const text = input.value.trim().replace(',', '.');
  return text === '' ? Number.NaN : Number(text);
}

export class ShapesPanel {
  readonly #section: HTMLDetailsElement;
  readonly #host: ShapesPanelHost;
  readonly #kind: HTMLSelectElement;
  readonly #stitch: HTMLSelectElement;
  readonly #width: HTMLInputElement;
  readonly #widthLabel: HTMLElement;
  readonly #top: HTMLInputElement;
  readonly #measure: HTMLSelectElement;
  readonly #height: HTMLInputElement;
  readonly #angle: HTMLInputElement;
  readonly #repeat: HTMLInputElement;
  readonly #repeatX: HTMLInputElement;
  readonly #repeatY: HTMLInputElement;
  readonly #rounding: HTMLSelectElement;
  readonly #border: HTMLInputElement;
  readonly #hdcRowEnd: HTMLSelectElement;
  readonly #borderRepeat: HTMLInputElement;
  readonly #borderX: HTMLInputElement;
  readonly #borderY: HTMLInputElement;
  readonly #ribbing: HTMLInputElement;
  readonly #ribbingRows: HTMLInputElement;
  readonly #ribbingWidth: HTMLInputElement;
  readonly #groups: Readonly<
    Record<'top' | 'measure' | 'height' | 'angle' | 'repeat' | 'border' | 'hdcRowEnd' | 'borderRepeat' | 'ribbing' | 'ribbingFields', HTMLElement>
  >;
  readonly #size: HTMLElement;
  readonly #details: HTMLElement;
  readonly #source: HTMLElement;
  readonly #previewBox: HTMLElement;
  readonly #preview: SVGSVGElement;
  #pattern: Pattern | null = null;
  #shown: string | null = null;

  constructor(section: HTMLDetailsElement, host: ShapesPanelHost) {
    this.#section = section;
    this.#host = host;
    const field = <T extends Element>(id: string): T => {
      const el = section.querySelector<T>(`#${id}`);
      if (!el) throw new Error(`Hiányzó mező: #${id}`);
      return el;
    };
    this.#kind = fill(field('shape-kind'), SHAPE_CHOICES);
    this.#stitch = fill(field('shape-stitch'), STITCH_CHOICES);
    this.#stitch.value = 'hdc';
    this.#width = field('shape-width');
    this.#widthLabel = field('shape-width-label');
    this.#top = field('shape-top');
    this.#measure = fill(field('shape-measure'), MEASURE_CHOICES);
    this.#height = field('shape-height');
    this.#angle = field('shape-angle');
    this.#repeat = field('shape-repeat');
    this.#repeatX = field('shape-repeat-x');
    this.#repeatY = field('shape-repeat-y');
    this.#rounding = fill(field('shape-rounding'), ROUNDING_CHOICES);
    this.#border = field('shape-border');
    this.#hdcRowEnd = fill(field('shape-hdc-row-end'), HDC_ROW_END_CHOICES);
    this.#borderRepeat = field('shape-border-repeat');
    this.#borderX = field('shape-border-x');
    this.#borderY = field('shape-border-y');
    this.#ribbing = field('shape-ribbing');
    this.#ribbingRows = field('shape-ribbing-rows');
    this.#ribbingWidth = field('shape-ribbing-width');
    this.#groups = {
      top: field('shape-top-field'),
      measure: field('shape-measure-field'),
      height: field('shape-height-field'),
      angle: field('shape-angle-field'),
      repeat: field('shape-repeat-fields'),
      border: field('shape-border-fields'),
      hdcRowEnd: field('shape-hdc-field'),
      borderRepeat: field('shape-border-repeat-field'),
      ribbing: field('shape-ribbing-fields'),
      ribbingFields: field('shape-ribbing-pair'),
    };
    this.#size = field('shape-size');
    this.#details = field('shape-details');
    this.#source = field('shape-source');
    this.#previewBox = field('shape-preview-box');
    this.#preview = field('shape-preview');

    section.addEventListener('toggle', () => this.#render());
    for (const input of [
      this.#kind,
      this.#stitch,
      this.#measure,
      this.#repeat,
      this.#rounding,
      this.#border,
      this.#hdcRowEnd,
      this.#borderRepeat,
      this.#ribbing,
    ]) {
      input.addEventListener('change', () => this.#render());
    }
    for (const input of [
      this.#width,
      this.#top,
      this.#height,
      this.#angle,
      this.#repeatX,
      this.#repeatY,
      this.#borderX,
      this.#borderY,
      this.#ribbingRows,
      this.#ribbingWidth,
    ]) {
      input.addEventListener('input', () => this.#render());
    }
    field<HTMLButtonElement>('shape-create').addEventListener('click', () => this.#create());
  }

  update(pattern: Pattern): void {
    if (pattern === this.#pattern) return;
    this.#pattern = pattern;
    if (this.#section.open) this.#render();
  }

  #options(): ShapeOptions {
    const repeat = this.#borderRepeat.checked ? { repeat: { width: decimal(this.#borderX), edge: decimal(this.#borderY) } } : {};
    const border: PieceBorder | null = this.#border.checked ? { stitch: 'sc', hdcRowEnd: this.#hdcRowEnd.value === '1' ? 1 : 2, ...repeat } : null;
    // Bordás szegély a felső élen (PQW-909); a körbefutó szegéllyel együtt nem választható.
    const ribbing = this.#ribbing.checked ? { rows: decimal(this.#ribbingRows), width: decimal(this.#ribbingWidth) } : null;
    return normalizeShape({
      ribbing,
      shape: this.#kind.value as ShapeOptions['shape'],
      stitch: this.#stitch.value,
      widthCm: decimal(this.#width),
      measure: this.#measure.value as ShapeOptions['measure'],
      heightCm: decimal(this.#height),
      angleDeg: decimal(this.#angle),
      topWidthCm: decimal(this.#top),
      repeat: this.#repeat.checked ? { width: decimal(this.#repeatX), edge: decimal(this.#repeatY) } : null,
      rounding: this.#rounding.value as ShapeOptions['rounding'],
      border,
    });
  }

  #render(): void {
    if (!this.#section.open || !this.#pattern) return;
    const options = this.#options();
    const state = shapeFieldState(options);
    this.#widthLabel.textContent = widthLabel(options.shape);
    for (const [key, group] of Object.entries(this.#groups)) group.hidden = !state[key as keyof typeof state];
    for (const input of [this.#repeatX, this.#repeatY, this.#rounding]) input.disabled = !this.#repeat.checked;
    for (const input of [this.#borderX, this.#borderY]) input.disabled = !this.#borderRepeat.checked;
    for (const input of [this.#ribbingRows, this.#ribbingWidth]) input.disabled = !this.#ribbing.checked;

    const planned = planShape(this.#pattern, options);
    const view = planned.ok ? shapeView(planned.plan, options, activeProfile(this.#pattern) !== null) : null;
    // Az indok mondata a felületé (PQW-904): a mag kódot és adatot ad.
    const reason = planned.ok ? null : shapeReason(planned.reason);
    const key = JSON.stringify([planned.ok ? view : reason, planned.ok ? shapeOutline(planned.plan) : null]);
    if (key === this.#shown) return;
    this.#shown = key;

    if (!planned.ok || !view) {
      this.#size.textContent = reason ?? '';
      this.#details.replaceChildren();
      this.#source.textContent = '';
      this.#draw(null);
      return;
    }
    this.#size.textContent = view.size;
    this.#details.replaceChildren(
      ...view.details.map((text) => {
        const item = document.createElement('li');
        item.textContent = text;
        return item;
      }),
    );
    this.#source.textContent = view.source;
    this.#draw(shapeOutline(planned.plan));
  }

  /** Az előnézet: a forma lépcsős körvonala a tényleges arányban, szegéllyel a szegély sávja is. */
  #draw(outline: ShapeOutline | null): void {
    this.#previewBox.hidden = outline === null;
    if (!outline) {
      this.#preview.replaceChildren();
      return;
    }
    this.#preview.setAttribute('viewBox', `0 0 ${outline.width} ${outline.height}`);
    const shapes: SVGElement[] = [];
    if (outline.frame) {
      // A szegély sávja a forma körvonalát követi, ferde élnél is (PQW-898).
      const frame = document.createElementNS(SVG, 'polygon');
      frame.setAttribute('points', outline.frame);
      frame.setAttribute('class', 'shape__border');
      frame.setAttribute('vector-effect', 'non-scaling-stroke');
      shapes.push(frame);
    }
    const piece = document.createElementNS(SVG, 'polygon');
    piece.setAttribute('points', outline.points);
    piece.setAttribute('class', 'shape__piece');
    piece.setAttribute('vector-effect', 'non-scaling-stroke');
    shapes.push(piece);
    this.#preview.replaceChildren(...shapes);
  }

  #create(): void {
    if (!this.#pattern) return;
    const options = this.#options();
    const result = generateShape(this.#pattern, options);
    if (!result.ok) {
      this.#host.announce(shapeReason(result.reason));
      return;
    }
    this.#host.commit(result.pattern, generatedMessage(options, result.plan));
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
