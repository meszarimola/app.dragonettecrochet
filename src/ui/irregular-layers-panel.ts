// The free-form editor's layers panel. KB: interface.md §7, §39, §59

import type { BackgroundPatch } from '../core/irregular-document.ts';
import { itemsOfLayer, type LayerPatch } from '../core/irregular-layers.ts';
import type { BackgroundImage, IrregularLayer, IrregularPattern } from '../core/irregular-types.ts';
import { texts } from './i18n.ts';
import { toggleButton } from './irregular-rows-panel.ts';

export interface LayersPanelHost {
  addLayer(): void;
  deleteLayer(layerId: string): void;
  activate(layerId: string): void;
  update(layerId: string, patch: LayerPatch): void;
  reorder(layerId: string, toIndex: number): void;
  moveSelection(layerId: string): void;
  patchBackground(patch: BackgroundPatch): void;
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
  readonly #name: HTMLInputElement;
  #active = '';
  #layerIds: readonly string[] = [];
  /** The background picture is picked like a layer, but it is not one of the pattern's layers. */
  #backgroundPicked = false;
  #background: BackgroundImage | null = null;
  #selectionSize = 0;

  constructor(section: HTMLDetailsElement, host: LayersPanelHost) {
    this.#section = section;
    this.#host = host;
    this.#list = must<HTMLUListElement>(section, '#layers-list');
    this.#name = must<HTMLInputElement>(section, '#layer-name');
    must<HTMLButtonElement>(section, '#layer-new').addEventListener('click', () => this.#host.addLayer());
    must<HTMLButtonElement>(section, '#layer-delete').addEventListener('click', () =>
      this.#host.deleteLayer(this.#active),
    );
    must<HTMLButtonElement>(section, '#layer-move-items').addEventListener('click', () =>
      this.#host.moveSelection(this.#active),
    );
    // The list reads top down while the array runs bottom up, so up is a higher index.
    must<HTMLButtonElement>(section, '#layer-up').addEventListener('click', () => this.#step(1));
    must<HTMLButtonElement>(section, '#layer-down').addEventListener('click', () => this.#step(-1));
    this.#name.addEventListener('change', () => this.#host.update(this.#active, { name: this.#name.value.trim() }));
    this.#list.addEventListener('click', (event) => this.#onList(event));
    must<HTMLButtonElement>(section, '#layer-bg-pick').addEventListener('click', () => {
      this.#backgroundPicked = true;
      this.#show();
    });
    must<HTMLButtonElement>(section, '#layer-bg-visible').addEventListener('click', () => {
      if (this.#background !== null) this.#host.patchBackground({ visible: !this.#background.visible });
    });
    must<HTMLButtonElement>(section, '#layer-bg-locked').addEventListener('click', () => {
      if (this.#background !== null) this.#host.patchBackground({ locked: !this.#background.locked });
    });
  }

  #step(delta: number): void {
    const index = this.#layerIds.indexOf(this.#active);
    if (index >= 0) this.#host.reorder(this.#active, index + delta);
  }

  #onList(event: MouseEvent): void {
    const target = (event.target as Element).closest<HTMLElement>('[data-layer-act]');
    const layer = (event.target as Element).closest<HTMLElement>('[data-layer]')?.dataset['layer'];
    if (layer === undefined || target === null) return;
    const action = target.dataset['layerAct'];
    if (action === 'pick') {
      this.#backgroundPicked = false;
      this.#host.activate(layer);
      this.#show();
    }
    if (action === 'visible') this.#host.update(layer, { visible: target.getAttribute('aria-pressed') !== 'true' });
    if (action === 'locked') this.#host.update(layer, { locked: target.getAttribute('aria-pressed') !== 'true' });
  }

  reveal(): void {
    this.#section.hidden = false;
  }

  hide(): void {
    this.#section.hidden = true;
  }

  update(pattern: IrregularPattern, selectionSize: number, background: BackgroundImage | null): void {
    this.#active = pattern.activeLayerId;
    this.#layerIds = pattern.layers.map((layer) => layer.id);
    this.#background = background;
    // The list reads top down, so the topmost layer comes first.
    const shown = [...pattern.layers].reverse();
    this.#list.replaceChildren(...shown.map((layer) => this.#entry(pattern, layer)));
    this.#selectionSize = selectionSize;
    const active = pattern.layers.find((layer) => layer.id === this.#active);
    if (document.activeElement !== this.#name) this.#name.value = active?.name ?? '';
    const words = texts().irregular;
    const visible = must<HTMLButtonElement>(this.#section, '#layer-bg-visible');
    const locked = must<HTMLButtonElement>(this.#section, '#layer-bg-locked');
    visible.setAttribute('aria-pressed', String(background?.visible ?? true));
    locked.setAttribute('aria-pressed', String(background?.locked ?? false));
    visible.disabled = background === null;
    locked.disabled = background === null;
    must<HTMLElement>(this.#section, '#layer-bg-state').textContent =
      background === null ? words.bgNone : words.bgPicture;
    must<HTMLElement>(this.#section, '#layer-bg-thumb').classList.toggle('has-picture', background !== null);
    this.#show();
  }

  /** The footer acts on the active layer, so while the background is picked it has nothing to act on. */
  #show(): void {
    const index = this.#layerIds.indexOf(this.#active);
    const off = this.#backgroundPicked;
    must<HTMLButtonElement>(this.#section, '#layer-up').disabled = off || index === this.#layerIds.length - 1;
    must<HTMLButtonElement>(this.#section, '#layer-down').disabled = off || index <= 0;
    must<HTMLButtonElement>(this.#section, '#layer-delete').disabled = off || this.#layerIds.length < 2;
    must<HTMLButtonElement>(this.#section, '#layer-move-items').disabled = off || this.#selectionSize === 0;
    for (const pick of this.#list.querySelectorAll<HTMLElement>('[data-layer-act="pick"]')) {
      const on =
        !this.#backgroundPicked && pick.closest<HTMLElement>('[data-layer]')?.dataset['layer'] === this.#active;
      pick.setAttribute('aria-pressed', String(on));
      pick.closest('li')?.classList.toggle('is-active', on);
    }
    const bgPick = must<HTMLButtonElement>(this.#section, '#layer-bg-pick');
    bgPick.setAttribute('aria-pressed', String(this.#backgroundPicked));
    must<HTMLElement>(this.#section, '#layer-bg').classList.toggle('is-active', this.#backgroundPicked);
    must<HTMLElement>(this.#section, '#layer-active').hidden = this.#backgroundPicked;
    must<HTMLElement>(this.#section, '#props-background').hidden = !this.#backgroundPicked;
  }

  #entry(pattern: IrregularPattern, layer: IrregularLayer): HTMLLIElement {
    const words = texts().irregular;
    const item = element('li', 'rows__row');
    item.dataset['layer'] = layer.id;
    const pick = element('button', 'rows__pick');
    pick.type = 'button';
    pick.dataset['layerAct'] = 'pick';
    pick.append(
      element('span', 'rows__number', layer.name),
      element('span', 'rows__count', words.rowCount(itemsOfLayer(pattern, layer.id))),
    );
    item.append(
      toggleButton('visible', layer.visible, words.toggleVisible, 'layerAct'),
      toggleButton('locked', layer.locked, words.toggleLocked, 'layerAct'),
      pick,
    );
    return item;
  }
}
