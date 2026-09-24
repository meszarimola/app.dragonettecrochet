// The free-form editor's rows and rounds panel. KB: interface.md §7, §39

import { rowCount } from '../core/irregular-document.ts';
import type { RowAlign } from '../core/irregular-rowline.ts';
import type { RowPatch, RowStitches } from '../core/irregular-rows.ts';
import { rowNumber } from '../core/irregular-rows.ts';
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
  spaceRows(spacing: number): void;
  alignRows(mode: RowAlign): void;
  setCells(rowId: string, cells: number): void;
  setGrannyRadial(on: boolean): void;
}

export interface RowsView {
  readonly selectionSize: number;
  /** A granny square is rounds of cells: no kind, no direction, a grid count instead. KB: interface.md §71 */
  readonly granny: boolean;
  readonly grannyRadial: boolean;
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
  readonly #radial: HTMLInputElement;

  constructor(section: HTMLDetailsElement, host: RowsPanelHost) {
    this.#section = section;
    this.#host = host;
    this.#list = must<HTMLUListElement>(section, '#rows-list');
    this.#kind = must<HTMLSelectElement>(section, '#row-kind');
    this.#direction = must<HTMLSelectElement>(section, '#row-direction');
    this.#color = must<HTMLInputElement>(section, '#row-color');
    this.#radial = must<HTMLInputElement>(section, '#row-radial');
    this.#listen();
  }

  #active = '';

  #listen(): void {
    const spacing = must<HTMLInputElement>(this.#section, '#row-spacing');
    must<HTMLButtonElement>(this.#section, '#rows-space').addEventListener('click', () => {
      const value = Number(spacing.value);
      if (Number.isFinite(value)) this.#host.spaceRows(value);
    });
    this.#section.addEventListener('click', (event) => {
      const mode = (event.target as Element).closest<HTMLElement>('[data-row-align]')?.dataset['rowAlign'];
      if (mode !== undefined) this.#host.alignRows(mode as RowAlign);
    });
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
    this.#radial.addEventListener('change', () => this.#host.setGrannyRadial(this.#radial.checked));
    this.#kind.addEventListener('change', () => {
      const kind = KINDS.find((candidate) => candidate === this.#kind.value);
      if (kind !== undefined) this.#host.update(this.#active, { kind });
    });
    this.#direction.addEventListener('change', () => {
      const all: readonly RowDirection[] = [...ROW_DIRECTIONS, ...ROUND_DIRECTIONS];
      const direction = all.find((candidate) => candidate === this.#direction.value);
      if (direction !== undefined) this.#host.update(this.#active, { direction });
    });
    this.#list.addEventListener('click', (event) => this.#onList(event));
    // KB: interface.md §72 — the grid count is a counter in the round's own line.
    this.#list.addEventListener('change', (event) => {
      const input = event.target as HTMLInputElement;
      const row = input.dataset['cellsOf'];
      if (row === undefined || input.value.trim() === '') return;
      this.#host.setCells(row, Number(input.value));
    });
    must<HTMLButtonElement>(this.#section, '#row-up').addEventListener('click', () => this.#step(-1));
    must<HTMLButtonElement>(this.#section, '#row-down').addEventListener('click', () => this.#step(1));
    const more = must<HTMLButtonElement>(this.#section, '#rows-more-toggle');
    const moreBox = must<HTMLElement>(this.#section, '#rows-more');
    more.addEventListener('click', () => {
      moreBox.hidden = !moreBox.hidden;
      more.setAttribute('aria-expanded', String(!moreBox.hidden));
    });
  }

  #rowIds: readonly string[] = [];

  #step(delta: number): void {
    const index = this.#rowIds.indexOf(this.#active);
    if (index < 0) return;
    this.#host.reorder(this.#active, index + delta);
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
    // KB: interface.md §63 — before the first stitch there is no row to show yet.
    // A granny square's rounds are the grid, so they stand before any stitch (§71).
    const blank = !view.granny && pattern.items.length === 0 && pattern.rows.length === 1;
    this.#grannyFields(view);
    must<HTMLElement>(this.#section, '#rows-empty').hidden = !blank;
    must<HTMLElement>(this.#section, '#rows-body').hidden = blank;
    this.#active = pattern.activeRowId;
    this.#rowIds = pattern.rows.map((row) => row.id);
    const index = this.#rowIds.indexOf(this.#active);
    must<HTMLButtonElement>(this.#section, '#row-up').disabled = index <= 0;
    must<HTMLButtonElement>(this.#section, '#row-down').disabled = index < 0 || index === this.#rowIds.length - 1;
    const words = texts().irregular;
    this.#list.replaceChildren(...pattern.rows.map((row, index) => this.#entry(pattern, row, index)));
    const active = pattern.rows.find((row) => row.id === pattern.activeRowId);
    this.#kind.replaceChildren(option('row', words.kindRow), option('round', words.kindRound));
    if (active !== undefined) this.#kind.value = active.kind;
    const directions = active?.kind === 'round' ? ROUND_DIRECTIONS : ROW_DIRECTIONS;
    this.#direction.replaceChildren(...directions.map((one) => option(one, directionLabel(one))));
    if (active !== undefined) this.#direction.value = active.direction;
    if (document.activeElement !== this.#color) this.#color.value = active?.color ?? DEFAULT_COLOR;
    must<HTMLButtonElement>(this.#section, '#row-move-items').disabled = view.selectionSize === 0;
    must<HTMLButtonElement>(this.#section, '#row-delete').disabled = pattern.rows.length < 2;
    // KB: interface.md §61 — a row with no stitches is not a row yet, so no new one opens after it.
    // A new row goes to the end, an inserted one after the active row.
    const empty = (row: IrregularRow | undefined): boolean => row === undefined || rowCount(pattern, row.id) === 0;
    const lastEmpty = empty(pattern.rows.at(-1));
    must<HTMLButtonElement>(this.#section, '#row-new').disabled = lastEmpty;
    // A granny round is empty by design until the crocheter puts stitches in it.
    must<HTMLButtonElement>(this.#section, '#row-new-round').disabled = lastEmpty && !view.granny;
    must<HTMLButtonElement>(this.#section, '#row-insert').disabled = empty(active);
    must<HTMLButtonElement>(this.#section, '#row-delete-keep').disabled = pattern.rows.length < 2;
  }

  /** In a granny square the kind and the direction say nothing; the grid count does. */
  #grannyFields(view: RowsView): void {
    const words = texts().irregular;
    must<HTMLElement>(this.#section, '#row-kind-fields').hidden = view.granny;
    must<HTMLElement>(this.#section, '#row-radial-field').hidden = !view.granny;
    must<HTMLElement>(this.#section, '#rows-together').hidden = view.granny;
    must<HTMLButtonElement>(this.#section, '#row-new').hidden = view.granny;
    must<HTMLButtonElement>(this.#section, '#row-new-round').classList.toggle('is-wide', view.granny);
    must<HTMLElement>(this.#section, '.panel__title').textContent = view.granny
      ? words.grannyRoundsTitle
      : texts().markup.sectionRowsTitle;
    if (view.granny && document.activeElement !== this.#radial) this.#radial.checked = view.grannyRadial;
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
      // A granny round has no working direction to show: its cells are a grid (§71).
      element('span', 'rows__arrow', row.cells === undefined ? ARROWS[row.direction] : ''),
      element('span', 'rows__count', words.rowCount(rowCount(pattern, row.id))),
    );
    item.classList.toggle('is-active', row.id === pattern.activeRowId);
    item.append(
      toggleButton('visible', row.visible, words.toggleVisible, 'rowAct'),
      toggleButton('locked', row.locked, words.toggleLocked, 'rowAct'),
      pick,
    );
    // KB: interface.md §72 — a granny round carries its grid count in its own line.
    if (row.cells !== undefined) item.append(this.#cellsField(row, index));
    return item;
  }

  #cellsField(row: IrregularRow, index: number): HTMLInputElement {
    const cells = element('input', 'rows__cells');
    cells.type = 'number';
    cells.min = '1';
    cells.max = '400';
    cells.step = '1';
    cells.inputMode = 'numeric';
    cells.value = String(row.cells ?? '');
    cells.dataset['cellsOf'] = row.id;
    cells.setAttribute('aria-label', texts().irregular.grannyCellsOf(index + 1));
    return cells;
  }
}

const EYE = 'M2 10s3-5.5 8-5.5 8 5.5 8 5.5-3 5.5-8 5.5S2 10 2 10zM10 7.7a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6z';
const LOCK = 'M5 9h10v8H5zM7 9V6.5a3 3 0 0 1 6 0V9';

/** The eye and the lock of a list entry; pressed means shown or locked. KB: interface.md §59 */
export function toggleButton(action: 'visible' | 'locked', on: boolean, label: string, key: string): HTMLButtonElement {
  const button = element('button', 'rows__toggle');
  button.type = 'button';
  button.dataset[key] = action;
  button.setAttribute('aria-pressed', String(on));
  button.setAttribute('aria-label', label);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', action === 'visible' ? EYE : LOCK);
  svg.append(path);
  button.append(svg);
  return button;
}
