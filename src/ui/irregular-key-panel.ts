// The free-form pattern's own stitch key and its legend block. KB: interface.md §39

import {
  entryAbbreviation,
  entryGlyph,
  entryLabel,
  entryName,
  hasOverrides,
  type KeyUsage,
  keyUsage,
} from '../core/irregular-key.ts';
import type { IrregularPattern, LegendBlock } from '../core/irregular-types.ts';
import type { Locale } from '../core/types.ts';
import { texts } from './i18n.ts';
import { naturalGlyph } from './irregular-glyph.ts';
import { ALTERNATIVE_GLYPHS, applyInk, drawCentered, readInk, type SymbolOptions } from './symbols.ts';

export interface KeyPanelHost {
  setGlyph(keyEntryId: string, glyph: string | null): void;
  setAbbreviation(keyEntryId: string, value: string | null): void;
  setLabel(keyEntryId: string, value: string | null): void;
  resetKey(): void;
  setLegend(patch: Partial<LegendBlock>): void;
  addCustom(name: string, abbreviation: string, glyph: string): void;
}

const PREVIEW = 34;
const COLUMNS: readonly (1 | 2 | 3)[] = [1, 2, 3];

function must<T extends Element>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (found === null) throw new Error(`Missing element: ${selector}`);
  return found;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const made = document.createElement(tag);
  if (className) made.className = className;
  if (text) made.textContent = text;
  return made;
}

function option(value: string, label: string): HTMLOptionElement {
  const made = document.createElement('option');
  made.value = value;
  made.textContent = label;
  return made;
}

export class IrregularKeyPanel {
  readonly #section: HTMLDetailsElement;
  readonly #host: KeyPanelHost;
  readonly #list: HTMLUListElement;
  readonly #onImage: HTMLInputElement;
  readonly #columns: HTMLSelectElement;
  readonly #counts: HTMLInputElement;
  readonly #preset: HTMLElement;
  #ink = '#000';

  constructor(section: HTMLDetailsElement, host: KeyPanelHost) {
    this.#section = section;
    this.#host = host;
    this.#list = must<HTMLUListElement>(section, '#key-list');
    this.#onImage = must<HTMLInputElement>(section, '#legend-on-image');
    this.#columns = must<HTMLSelectElement>(section, '#legend-columns');
    this.#counts = must<HTMLInputElement>(section, '#legend-counts');
    this.#preset = must<HTMLElement>(section, '#key-preset');
    must<HTMLButtonElement>(section, '#key-reset').addEventListener('click', () => this.#host.resetKey());
    this.#onImage.addEventListener('change', () => this.#host.setLegend({ visible: this.#onImage.checked }));
    this.#counts.addEventListener('change', () => this.#host.setLegend({ showCounts: this.#counts.checked }));
    this.#columns.addEventListener('change', () => {
      const columns = COLUMNS.find((candidate) => String(candidate) === this.#columns.value);
      if (columns !== undefined) this.#host.setLegend({ columns });
    });
    this.#list.addEventListener('change', (event) => this.#onChange(event));
    const name = must<HTMLInputElement>(section, '#key-custom-name');
    const abbreviation = must<HTMLInputElement>(section, '#key-custom-abbr');
    const glyph = must<HTMLSelectElement>(section, '#key-custom-glyph');
    glyph.replaceChildren(
      ...ALTERNATIVE_GLYPHS.map((id) => {
        const choice = document.createElement('option');
        choice.value = id;
        choice.textContent = texts().irregular.glyph[id];
        return choice;
      }),
    );
    must<HTMLButtonElement>(section, '#key-custom-add').addEventListener('click', () => {
      const wanted = name.value.trim();
      // A stitch with no name could never be told apart in the legend.
      if (wanted === '') {
        name.focus();
        return;
      }
      this.#host.addCustom(wanted, abbreviation.value.trim(), glyph.value);
      name.value = '';
      abbreviation.value = '';
    });
  }

  #onChange(event: Event): void {
    const field = event.target as HTMLInputElement | HTMLSelectElement;
    const id = field.closest<HTMLElement>('[data-entry]')?.dataset['entry'];
    if (id === undefined) return;
    const value = field.value.trim();
    if (field.classList.contains('key__glyph')) this.#host.setGlyph(id, value === '' ? null : value);
    if (field.classList.contains('key__abbr')) this.#host.setAbbreviation(id, value === '' ? null : value);
    if (field.classList.contains('key__label')) this.#host.setLabel(id, value === '' ? null : value);
  }

  reveal(): void {
    this.#section.hidden = false;
  }

  hide(): void {
    this.#section.hidden = true;
  }

  update(pattern: IrregularPattern, terms: Locale, symbols: SymbolOptions, legend: LegendBlock): void {
    this.#ink = readInk(document.documentElement);
    this.#preset.textContent = hasOverrides(pattern) ? texts().irregular.presetCustom : '';
    const used = keyUsage(pattern);
    const words = texts().irregular;
    // Rebuilding would throw away the field under the cursor, and the focus with it.
    if (!this.#list.contains(document.activeElement)) {
      if (used.length === 0) {
        this.#list.replaceChildren(element('li', 'panel__note', words.keyEmpty));
      } else {
        this.#list.replaceChildren(...used.map((usage) => this.#entry(pattern, usage, terms, symbols)));
      }
    }
    if (document.activeElement !== this.#onImage) this.#onImage.checked = legend.visible;
    if (document.activeElement !== this.#counts) this.#counts.checked = legend.showCounts;
    if (document.activeElement !== this.#columns) {
      this.#columns.replaceChildren(...COLUMNS.map((one) => option(String(one), String(one))));
      this.#columns.value = String(legend.columns);
    }
  }

  #entry(pattern: IrregularPattern, usage: KeyUsage, terms: Locale, symbols: SymbolOptions): HTMLLIElement {
    const words = texts().irregular;
    const id = usage.keyEntryId;
    const item = element('li', 'key__row');
    item.dataset['entry'] = id;
    const glyph = entryGlyph(pattern, id);
    item.append(this.#preview(id, symbols, glyph));
    item.append(element('span', 'key__name', `${entryName(pattern, id, terms)} · ${usage.count}`));

    const select = document.createElement('select');
    select.className = 'key__glyph';
    select.setAttribute('aria-label', words.keyGlyphDefault);
    select.replaceChildren(
      option('', words.keyGlyphDefault),
      ...ALTERNATIVE_GLYPHS.map((one) => option(one, words.glyph[one])),
    );
    select.value = glyph ?? '';
    item.append(select);

    item.append(this.#field('key__abbr', entryAbbreviation(pattern, id, terms) ?? '', words.keyAbbrPlaceholder));
    item.append(this.#field('key__label', entryLabel(pattern, id, terms), words.keyLabelPlaceholder));
    return item;
  }

  #field(className: string, value: string, label: string): HTMLInputElement {
    const input = document.createElement('input');
    input.className = className;
    input.type = 'text';
    input.value = value;
    input.placeholder = label;
    input.setAttribute('aria-label', label);
    return input;
  }

  #preview(keyEntryId: string, symbols: SymbolOptions, glyph: string | null): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(PREVIEW * dpr);
    canvas.height = Math.round(PREVIEW * dpr);
    canvas.style.inlineSize = `${PREVIEW}px`;
    canvas.style.blockSize = `${PREVIEW}px`;
    canvas.className = 'key__preview';
    canvas.setAttribute('aria-hidden', 'true');
    const ctx = canvas.getContext('2d');
    const measured = naturalGlyph(keyEntryId, 'both-loops', symbols, glyph);
    if (ctx !== null && measured !== null) {
      const fit = Math.min(1, (PREVIEW - 8) / Math.max(measured.width, measured.height));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(PREVIEW / 2, PREVIEW / 2);
      // Keeps a 2 px line after the scale-down, as the palette preview does.
      applyInk(ctx, this.#ink, 2 / fit);
      drawCentered(ctx, measured.shapes, fit);
    }
    return canvas;
  }
}
