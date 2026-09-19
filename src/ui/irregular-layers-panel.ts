// The free-form editor's layers panel. KB: interface.md §7, §39

import { itemsOfLayer, type LayerPatch } from '../core/irregular-layers.ts';
import type { IrregularLayer, IrregularPattern } from '../core/irregular-types.ts';
import { texts } from './i18n.ts';

export interface LayersPanelHost {
  addLayer(): void;
  deleteLayer(layerId: string): void;
  activate(layerId: string): void;
  update(layerId: string, patch: LayerPatch): void;
  reorder(layerId: string, toIndex: number): void;
  moveSelection(layerId: string): void;
}

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

export class IrregularLayersPanel {
  readonly #section: HTMLDetailsElement;
  readonly #host: LayersPanelHost;
  readonly #list: HTMLUListElement;
  #active = '';

  constructor(section: HTMLDetailsElement, host: LayersPanelHost) {
    this.#section = section;
    this.#host = host;
    this.#list = must<HTMLUListElement>(section, '#layers-list');
    must<HTMLButtonElement>(section, '#layer-new').addEventListener('click', () => this.#host.addLayer());
    must<HTMLButtonElement>(section, '#layer-delete').addEventListener('click', () =>
      this.#host.deleteLayer(this.#active),
    );
    must<HTMLButtonElement>(section, '#layer-move-items').addEventListener('click', () =>
      this.#host.moveSelection(this.#active),
    );
    this.#list.addEventListener('click', (event) => this.#onList(event));
    this.#list.addEventListener('change', (event) => {
      const input = event.target as HTMLInputElement;
      const layer = input.closest<HTMLElement>('[data-layer]')?.dataset['layer'];
      if (layer !== undefined && input.classList.contains('layers__name')) {
        this.#host.update(layer, { name: input.value.trim() });
      }
    });
  }

  #onList(event: MouseEvent): void {
    const target = (event.target as Element).closest<HTMLElement>('[data-layer-act]');
    const layer = (event.target as Element).closest<HTMLElement>('[data-layer]')?.dataset['layer'];
    if (layer === undefined || target === null) return;
    const action = target.dataset['layerAct'];
    if (action === 'pick') this.#host.activate(layer);
    if (action === 'visible') this.#host.update(layer, { visible: target.getAttribute('aria-pressed') !== 'true' });
    if (action === 'locked') this.#host.update(layer, { locked: target.getAttribute('aria-pressed') !== 'true' });
    if (action === 'up' || action === 'down') {
      // The list is drawn top down while the array runs bottom up, so up means a higher index.
      const index = Number(target.dataset['index'] ?? '0');
      this.#host.reorder(layer, action === 'up' ? index + 1 : index - 1);
    }
  }

  reveal(): void {
    this.#section.hidden = false;
  }

  hide(): void {
    this.#section.hidden = true;
  }

  update(pattern: IrregularPattern, selectionSize: number): void {
    this.#active = pattern.activeLayerId;
    // Rebuilding would throw away the name field under the cursor, and the focus with it.
    if (!this.#list.contains(document.activeElement)) {
      // The list reads top down, so the topmost layer comes first.
      const shown = [...pattern.layers].reverse();
      this.#list.replaceChildren(...shown.map((layer) => this.#entry(pattern, layer)));
    }
    must<HTMLButtonElement>(this.#section, '#layer-delete').disabled = pattern.layers.length < 2;
    must<HTMLButtonElement>(this.#section, '#layer-move-items').disabled = selectionSize === 0;
  }

  #entry(pattern: IrregularPattern, layer: IrregularLayer): HTMLLIElement {
    const words = texts().irregular;
    const index = pattern.layers.findIndex((candidate) => candidate.id === layer.id);
    const item = element('li', 'rows__row');
    item.dataset['layer'] = layer.id;
    const pick = element('button', 'rows__pick');
    pick.type = 'button';
    pick.dataset['layerAct'] = 'pick';
    pick.setAttribute('aria-pressed', String(layer.id === pattern.activeLayerId));
    pick.append(element('span', 'rows__count', words.rowCount(itemsOfLayer(pattern, layer.id))));
    const name = document.createElement('input');
    name.className = 'layers__name';
    name.type = 'text';
    name.value = layer.name;
    name.setAttribute('aria-label', words.layerName);
    item.append(name, pick);
    item.append(
      this.#toggle('visible', layer.visible, words.toggleVisible),
      this.#toggle('locked', layer.locked, words.toggleLocked),
      this.#step('up', index, words.moveUp, index === pattern.layers.length - 1),
      this.#step('down', index, words.moveDown, index === 0),
    );
    return item;
  }

  #toggle(action: string, on: boolean, label: string): HTMLButtonElement {
    const button = element('button', 'rows__toggle', on ? '●' : '○');
    button.type = 'button';
    button.dataset['layerAct'] = action;
    button.setAttribute('aria-pressed', String(on));
    button.setAttribute('aria-label', label);
    return button;
  }

  #step(action: 'up' | 'down', index: number, label: string, disabled: boolean): HTMLButtonElement {
    const button = element('button', 'rows__toggle', action === 'up' ? '↑' : '↓');
    button.type = 'button';
    button.dataset['layerAct'] = action;
    button.dataset['index'] = String(index);
    button.setAttribute('aria-label', label);
    button.disabled = disabled;
    return button;
  }
}
