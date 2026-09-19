// The free-form editor's rows and rounds panel. KB: interface.md §7, §39

import type { RowPatch, RowStitches } from '../core/irregular-rows.ts';
import { itemsOfRow, rowNumber } from '../core/irregular-rows.ts';
import type { IrregularPattern, IrregularRow, RowDirection, RowKind } from '../core/irregular-types.ts';
import { texts } from './i18n.ts';

export interface RowsPanelHost {
  addRow(kind: RowKind): void;
  insertRow(): void;
  deleteRow(rowId: string, stitches: RowStitches): void;
  activate(rowId: string): void;
  update(rowId: string, patch: RowPatch): void;
  reorder(rowId: string, toIndex: number): void;
  selectRow(rowId: string): void;
  moveSelection(rowId: string): void;
  setFadeOthers(on: boolean): void;
  setShowOrder(on: boolean): void;
  moveInOrder(delta: number): void;
  resetOrder(): void;
}

export interface RowsView {
  readonly fadeOthers: boolean;
  readonly showOrder: boolean;
  readonly selectionSize: number;
  readonly manualOrder: boolean;
}

const KINDS: readonly RowKind[] = ['row', 'round'];
const ROW_DIRECTIONS: readonly RowDirection[] = ['ltr', 'rtl'];
const ROUND_DIRECTIONS: readonly RowDirection[] = ['ccw', 'cw'];
const DEFAULT_COLOR = '#000000';

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

export function directionLabel(direction: RowDirection): string {
  const words = texts().irregular;
  switch (direction) {
    case 'ltr':
      return words.dirLtr;
    case 'rtl':
      return words.dirRtl;
    case 'cw':
      return words.dirCw;
    case 'ccw':
      return words.dirCcw;
  }
}

const ARROWS: Readonly<Record<RowDirection, string>> = { ltr: '→', rtl: '←', cw: '↻', ccw: '↺' };

export function rowName(pattern: IrregularPattern, rowId: string): string {
  const row = pattern.rows.find((candidate) => candidate.id === rowId);
  return texts().irregular.rowName(rowNumber(pattern, rowId), row?.kind === 'round');
}

export class IrregularRowsPanel {
  readonly #section: HTMLDetailsElement;
  readonly #host: RowsPanelHost;
  readonly #list: HTMLUListElement;
  readonly #kind: HTMLSelectElement;
  readonly #direction: HTMLSelectElement;
  readonly #color: HTMLInputElement;
  readonly #fade: HTMLInputElement;
  readonly #showOrder: HTMLInputElement;
  readonly #orderControls: HTMLElement;
  readonly #note: HTMLElement;

  constructor(section: HTMLDetailsElement, host: RowsPanelHost) {
    this.#section = section;
    this.#host = host;
    this.#list = must<HTMLUListElement>(section, '#rows-list');
    this.#kind = must<HTMLSelectElement>(section, '#row-kind');
    this.#direction = must<HTMLSelectElement>(section, '#row-direction');
    this.#color = must<HTMLInputElement>(section, '#row-color');
    this.#fade = must<HTMLInputElement>(section, '#row-fade');
    this.#showOrder = must<HTMLInputElement>(section, '#row-order-overlay');
    this.#orderControls = must<HTMLElement>(section, '#order-controls');
    this.#note = must<HTMLElement>(section, '#rows-note');
    this.#listen();
  }

  #active = '';

  #listen(): void {
    must<HTMLButtonElement>(this.#section, '#row-new').addEventListener('click', () => this.#host.addRow('row'));
    must<HTMLButtonElement>(this.#section, '#row-new-round').addEventListener('click', () =>
      this.#host.addRow('round'),
    );
    must<HTMLButtonElement>(this.#section, '#row-insert').addEventListener('click', () => this.#host.insertRow());
    must<HTMLButtonElement>(this.#section, '#row-select').addEventListener('click', () =>
      this.#host.selectRow(this.#active),
    );
    must<HTMLButtonElement>(this.#section, '#row-move-items').addEventListener('click', () =>
      this.#host.moveSelection(this.#active),
    );
    must<HTMLButtonElement>(this.#section, '#row-delete').addEventListener('click', () =>
      this.#host.deleteRow(this.#active, 'delete'),
    );
    must<HTMLButtonElement>(this.#section, '#row-delete-keep').addEventListener('click', () =>
      this.#host.deleteRow(this.#active, 'move'),
    );
    must<HTMLButtonElement>(this.#section, '#row-color-clear').addEventListener('click', () =>
      this.#host.update(this.#active, { color: null }),
    );
    this.#color.addEventListener('change', () => this.#host.update(this.#active, { color: this.#color.value }));
    this.#kind.addEventListener('change', () => {
      const kind = KINDS.find((candidate) => candidate === this.#kind.value);
      if (kind !== undefined) this.#host.update(this.#active, { kind });
    });
    this.#direction.addEventListener('change', () => {
      const all: readonly RowDirection[] = [...ROW_DIRECTIONS, ...ROUND_DIRECTIONS];
      const direction = all.find((candidate) => candidate === this.#direction.value);
      if (direction !== undefined) this.#host.update(this.#active, { direction });
    });
    this.#fade.addEventListener('change', () => this.#host.setFadeOthers(this.#fade.checked));
    this.#showOrder.addEventListener('change', () => this.#host.setShowOrder(this.#showOrder.checked));
    must<HTMLButtonElement>(this.#section, '#order-earlier').addEventListener('click', () =>
      this.#host.moveInOrder(-1),
    );
    must<HTMLButtonElement>(this.#section, '#order-later').addEventListener('click', () => this.#host.moveInOrder(1));
    must<HTMLButtonElement>(this.#section, '#order-reset').addEventListener('click', () => this.#host.resetOrder());
    this.#list.addEventListener('click', (event) => this.#onList(event));
  }

  #onList(event: MouseEvent): void {
    const target = (event.target as Element).closest<HTMLElement>('[data-row-act]');
    const row = (event.target as Element).closest<HTMLElement>('[data-row]')?.dataset['row'];
    if (row === undefined) return;
    const action = target?.dataset['rowAct'];
    if (action === undefined) return;
    if (action === 'pick') this.#host.activate(row);
    if (action === 'visible') this.#host.update(row, { visible: target?.getAttribute('aria-pressed') !== 'true' });
    if (action === 'locked') this.#host.update(row, { locked: target?.getAttribute('aria-pressed') !== 'true' });
    if (action === 'up' || action === 'down') {
      const index = Number(target?.dataset['index'] ?? '0');
      this.#host.reorder(row, action === 'up' ? index - 1 : index + 1);
    }
  }

  #opened = false;

  // Opened once, the first time this type is chosen; after that the crocheter decides.
  reveal(): void {
    this.#section.hidden = false;
    if (this.#opened) return;
    this.#opened = true;
    this.#section.open = true;
  }

  hide(): void {
    this.#section.hidden = true;
  }

  update(pattern: IrregularPattern, view: RowsView): void {
    this.#active = pattern.activeRowId;
    const words = texts().irregular;
    this.#list.replaceChildren(...pattern.rows.map((row, index) => this.#entry(pattern, row, index)));
    const active = pattern.rows.find((row) => row.id === pattern.activeRowId);
    this.#kind.replaceChildren(option('row', words.kindRow), option('round', words.kindRound));
    if (active !== undefined) this.#kind.value = active.kind;
    const directions = active?.kind === 'round' ? ROUND_DIRECTIONS : ROW_DIRECTIONS;
    this.#direction.replaceChildren(...directions.map((one) => option(one, directionLabel(one))));
    if (active !== undefined) this.#direction.value = active.direction;
    if (document.activeElement !== this.#color) this.#color.value = active?.color ?? DEFAULT_COLOR;
    this.#fade.checked = view.fadeOthers;
    this.#showOrder.checked = view.showOrder;
    this.#orderControls.hidden = view.selectionSize !== 1;
    must<HTMLButtonElement>(this.#section, '#row-move-items').disabled = view.selectionSize === 0;
    must<HTMLButtonElement>(this.#section, '#row-delete').disabled = pattern.rows.length < 2;
    must<HTMLButtonElement>(this.#section, '#row-delete-keep').disabled = pattern.rows.length < 2;
    this.#note.textContent = view.manualOrder ? words.orderManual : '';
  }

  #entry(pattern: IrregularPattern, row: IrregularRow, index: number): HTMLLIElement {
    const words = texts().irregular;
    const item = element('li', 'rows__row');
    item.dataset['row'] = row.id;
    const pick = element('button', 'rows__pick');
    pick.type = 'button';
    pick.dataset['rowAct'] = 'pick';
    pick.setAttribute('aria-pressed', String(row.id === pattern.activeRowId));
    const swatch = element('span', 'rows__swatch');
    swatch.style.background = row.color ?? 'currentColor';
    pick.append(
      element('span', 'rows__number', words.rowName(index + 1, row.kind === 'round')),
      swatch,
      element('span', 'rows__arrow', ARROWS[row.direction]),
      element('span', 'rows__count', words.rowCount(itemsOfRow(pattern, row.id).length)),
    );
    item.append(
      pick,
      this.#toggle('visible', row.visible, words.toggleVisible),
      this.#toggle('locked', row.locked, words.toggleLocked),
    );
    item.append(
      this.#step('up', index, words.moveUp, index === 0),
      this.#step('down', index, words.moveDown, index === pattern.rows.length - 1),
    );
    return item;
  }

  #toggle(action: string, on: boolean, label: string): HTMLButtonElement {
    const button = element('button', 'rows__toggle', on ? '●' : '○');
    button.type = 'button';
    button.dataset['rowAct'] = action;
    button.setAttribute('aria-pressed', String(on));
    button.setAttribute('aria-label', label);
    return button;
  }

  #step(action: 'up' | 'down', index: number, label: string, disabled: boolean): HTMLButtonElement {
    const button = element('button', 'rows__toggle', action === 'up' ? '↑' : '↓');
    button.type = 'button';
    button.dataset['rowAct'] = action;
    button.dataset['index'] = String(index);
    button.setAttribute('aria-label', label);
    button.disabled = disabled;
    return button;
  }
}
