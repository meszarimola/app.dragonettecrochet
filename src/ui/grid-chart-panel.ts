/*
 * A „Rácsminta” szakasz (PQW-864, PQW-894): technika, mozaikváltozat, méret,
 * színek és ecset, kép betöltése, a rácsszerkesztő a mintasűrűség szerinti
 * cellaaránnyal, az ismétlő egység (felismerve vagy kézzel), feliratos motívum,
 * a terv és a fonal színenként, és a minta létrehozása.
 *
 * A rács `role="grid"`, bejárható tabindexszel: nyilakkal lépsz, szóközzel vagy
 * Enterrel festesz, Delete-tel törölsz; egérrel húzva több cellát festhetsz. A
 * kezelt billentyűk nem jutnak el a vászon gyorsbillentyűihez.
 *
 * A kép a böngészőben marad: vászonra rajzolva, a rács méretére kicsinyítve
 * olvassuk ki a képpontjait, szerverre semmi nem kerül (a CSP a `blob:` képet
 * engedi).
 *
 * A mezők az index.html-ben vannak. A létrehozás a mintát cseréli, ezért egy
 * lépésben visszavonható. Új tárolókulcs nincs: a rács a lapon él, a
 * létrehozott minta a darabbal menti, és innen visszatölthető.
 */

import { MAX_GRID_SIDE, type DraftCell } from '../core/pixel-chart.js';
import type { Pattern } from '../core/types.js';
import { texts } from './i18n.js';
import {
  MOSAIC_ROW_CHOICES,
  TECHNIQUE_CHOICES,
  brushesFor,
  cellAppearance,
  cellLabel,
  cellPixels,
  defaultState,
  editorCellSize,
  expandedCells,
  generateFromState,
  imageGridSize,
  imageToDraft,
  nextColor,
  planSummary,
  removeColor,
  resizeDraft,
  stateFromPattern,
  unitState,
  usesColors,
  withTechnique,
  yarnLines,
  type EditorTechnique,
  type GridEditorState,
} from './grid-chart-view.js';
import { formatNumber } from './size-view.js';

export interface GridChartPanelHost {
  /** Az új minta a visszavonási veremre, az üzenettel. */
  commit(pattern: Pattern, message: string): void;
  announce(message: string): void;
}

interface Cell {
  readonly x: number;
  readonly y: number;
}

function fill(select: HTMLSelectElement, choices: readonly { readonly value: string; readonly label: string }[]): HTMLSelectElement {
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

export class GridChartPanel {
  readonly #section: HTMLDetailsElement;
  readonly #host: GridChartPanelHost;
  readonly #technique: HTMLSelectElement;
  readonly #mosaicField: HTMLElement;
  readonly #mosaicRows: HTMLSelectElement;
  readonly #width: HTMLInputElement;
  readonly #height: HTMLInputElement;
  readonly #image: HTMLInputElement;
  readonly #ratio: HTMLElement;
  readonly #colorsField: HTMLElement;
  readonly #colors: HTMLElement;
  readonly #colorAdd: HTMLButtonElement;
  readonly #brushes: HTMLElement;
  readonly #board: HTMLElement;
  readonly #manual: HTMLInputElement;
  readonly #unitFields: HTMLElement;
  readonly #unitInputs: readonly HTMLInputElement[];
  readonly #unit: HTMLElement;
  readonly #fill: HTMLButtonElement;
  readonly #lettering: HTMLInputElement;
  readonly #size: HTMLElement;
  readonly #details: HTMLElement;
  readonly #warnings: HTMLElement;
  readonly #source: HTMLElement;
  readonly #yarn: HTMLElement;
  readonly #load: HTMLButtonElement;
  #state: GridEditorState = defaultState();
  #brush: DraftCell = 1;
  #cells: HTMLElement[][] = [];
  #focus: Cell = { x: 0, y: 0 };
  #painting = false;
  #pattern: Pattern | null = null;
  #mirrored = false;
  #shown: string | null = null;
  #pending = 0;

  constructor(section: HTMLDetailsElement, host: GridChartPanelHost) {
    this.#section = section;
    this.#host = host;
    const field = <T extends Element>(id: string): T => {
      const el = section.querySelector<T>(`#${id}`);
      if (!el) throw new Error(`Hiányzó mező: #${id}`);
      return el;
    };
    this.#technique = fill(field('grid-technique'), TECHNIQUE_CHOICES);
    this.#mosaicField = field('grid-mosaic-field');
    this.#mosaicRows = fill(field('grid-mosaic-rows'), MOSAIC_ROW_CHOICES);
    this.#width = field('grid-width');
    this.#height = field('grid-height');
    this.#image = field('grid-image');
    this.#ratio = field('grid-ratio');
    this.#colorsField = field('grid-colors-field');
    this.#colors = field('grid-colors');
    this.#colorAdd = field('grid-color-add');
    this.#brushes = field('grid-brushes');
    this.#board = field('grid-board');
    this.#manual = field('grid-unit-manual');
    this.#unitFields = field('grid-unit-fields');
    this.#unitInputs = ['grid-unit-x', 'grid-unit-y', 'grid-unit-width', 'grid-unit-height'].map((id) => field<HTMLInputElement>(id));
    this.#unit = field('grid-unit');
    this.#fill = field('grid-fill');
    this.#lettering = field('grid-lettering');
    this.#size = field('grid-size');
    this.#details = field('grid-details');
    this.#warnings = field('grid-warnings');
    this.#source = field('grid-source');
    this.#yarn = field('grid-yarn');
    this.#load = field('grid-load');

    // A rács csak az első nyitáskor épül: a késve érkező `toggle` ne írja felül a közben beírt méretet.
    section.addEventListener('toggle', () => {
      if (!section.open) return;
      if (this.#cells.length === 0) this.#rebuild();
      else this.#schedule();
    });
    this.#technique.addEventListener('change', () => {
      const technique = this.#technique.value as EditorTechnique;
      const next = withTechnique(this.#state, technique);
      this.#brush = usesColors(technique) ? Math.min(1, next.colors.length - 1) : 1;
      this.#setState(next, true);
    });
    this.#mosaicRows.addEventListener('change', () => {
      this.#setState({ ...this.#state, mosaicRows: this.#mosaicRows.value === '2' ? 2 : 1 }, true);
    });
    for (const input of [this.#width, this.#height]) input.addEventListener('change', () => this.#resize());
    this.#image.addEventListener('change', () => {
      const file = this.#image.files?.[0];
      if (file) void this.#loadImage(file);
    });
    this.#colorAdd.addEventListener('click', () => {
      const color = nextColor(this.#state.colors, this.#state.technique);
      if (color) this.#setState({ ...this.#state, colors: [...this.#state.colors, color] }, true);
    });
    this.#brushes.addEventListener('change', (event) => {
      const input = event.target as HTMLInputElement;
      const brush = brushesFor(this.#state).find((candidate) => candidate.key === input.value);
      if (brush) this.#brush = brush.value;
    });
    this.#manual.addEventListener('change', () => this.#readUnit());
    for (const input of this.#unitInputs) input.addEventListener('input', () => this.#readUnit());
    this.#lettering.addEventListener('change', () => this.#setState({ ...this.#state, lettering: this.#lettering.checked }));
    this.#fill.addEventListener('click', () => this.#fillFromUnit());
    this.#load.addEventListener('click', () => this.#loadFromPattern());
    field<HTMLButtonElement>('grid-create').addEventListener('click', () => this.#create());

    this.#board.addEventListener('keydown', (event) => this.#onKey(event));
    // A fókusz bármilyen úton kerül egy cellára (Tab, felolvasó, kattintás), a billentyűk arra a cellára vonatkoznak.
    this.#board.addEventListener('focusin', (event) => {
      const cell = this.#cellOf(event.target);
      if (!cell || (cell.x === this.#focus.x && cell.y === this.#focus.y)) return;
      this.#cells[this.#focus.y]?.[this.#focus.x]?.setAttribute('tabindex', '-1');
      this.#focus = cell;
      this.#cells[cell.y]?.[cell.x]?.setAttribute('tabindex', '0');
    });
    this.#board.addEventListener('pointerdown', (event) => {
      const cell = this.#cellOf(event.target);
      if (!cell || event.button !== 0) return;
      event.preventDefault();
      this.#painting = true;
      this.#moveFocus(cell);
      this.#paint(cell, this.#brush);
    });
    this.#board.addEventListener('pointermove', (event) => {
      if (!this.#painting) return;
      const cell = this.#cellOf(document.elementFromPoint(event.clientX, event.clientY));
      if (cell) this.#paint(cell, this.#brush);
    });
    const stop = () => {
      this.#painting = false;
    };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }

  update(pattern: Pattern, mirrored: boolean): void {
    if (pattern === this.#pattern && mirrored === this.#mirrored) return;
    const first = this.#pattern === null;
    this.#pattern = pattern;
    this.#mirrored = mirrored;
    this.#load.disabled = stateFromPattern(pattern) === null;
    if (!this.#section.open) return;
    if (first) this.#rebuild();
    else this.#schedule();
  }

  /** A Filéhorgolás mintatípusnál a szakasz lenyílik. */
  reveal(): void {
    this.#section.open = true;
  }

  /* ---- Állapot ---- */

  #setState(next: GridEditorState, rebuild = false): void {
    this.#state = next;
    if (rebuild) this.#rebuild();
    else this.#schedule();
  }

  #rebuild(): void {
    if (!this.#section.open) return;
    const { draft, technique } = this.#state;
    this.#technique.value = technique;
    this.#mosaicRows.value = String(this.#state.mosaicRows);
    this.#mosaicField.hidden = technique !== 'mosaic';
    // A fókuszban lévő mezőbe épp gépelnek: azt nem írjuk felül.
    const write = (input: HTMLInputElement, value: number) => {
      if (document.activeElement !== input) input.value = String(value);
    };
    write(this.#width, draft[0]?.length ?? 0);
    write(this.#height, draft.length);
    this.#lettering.checked = this.#state.lettering;
    this.#colorsField.hidden = !usesColors(technique);
    this.#renderColors();
    this.#renderBrushes();
    this.#buildBoard();
    this.#shown = null;
    this.#render();
  }

  #schedule(): void {
    if (this.#pending) return;
    this.#pending = requestAnimationFrame(() => {
      this.#pending = 0;
      this.#render();
    });
  }

  #resize(): void {
    const clamp = (input: HTMLInputElement, current: number) => {
      const value = Math.round(Number(input.value));
      return Number.isFinite(value) && value >= 1 ? Math.min(MAX_GRID_SIDE, value) : current;
    };
    const { draft } = this.#state;
    const width = clamp(this.#width, draft[0]?.length ?? 1);
    const height = clamp(this.#height, draft.length);
    this.#focus = { x: Math.min(this.#focus.x, width - 1), y: Math.min(this.#focus.y, height - 1) };
    this.#setState({ ...this.#state, draft: resizeDraft(draft, width, height) }, true);
  }

  /** A kép a megadott szélességre, a mintasűrűség szerinti magasságra kicsinyítve kerül a rácsba (PQW-894). */
  async #loadImage(file: File): Promise<void> {
    if (!this.#pattern) return;
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const size = imageGridSize(image.naturalWidth, image.naturalHeight, this.#state.draft[0]?.length ?? 1, this.#pattern, this.#state);
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('nincs vászon');
      context.drawImage(image, 0, 0, size.width, size.height);
      const pixels = context.getImageData(0, 0, size.width, size.height).data;
      this.#manual.checked = false;
      this.#unitFields.hidden = true;
      this.#focus = { x: 0, y: 0 };
      this.#setState({ ...this.#state, draft: imageToDraft(pixels, size.width, size.height, this.#state), manualUnit: null }, true);
      this.#host.announce(texts().panels.grid.imageLoaded(size.width, size.height));
    } catch {
      this.#host.announce(texts().panels.grid.imageFailed);
    } finally {
      URL.revokeObjectURL(url);
      this.#image.value = '';
    }
  }

  #readUnit(): void {
    this.#unitFields.hidden = !this.#manual.checked;
    if (!this.#manual.checked) {
      this.#setState({ ...this.#state, manualUnit: null });
      return;
    }
    const [x, y, width, height] = this.#unitInputs.map((input) => Math.round(Number(input.value)));
    this.#setState({ ...this.#state, manualUnit: { x: x! - 1, y: y! - 1, width: width!, height: height! } });
  }

  #fillFromUnit(): void {
    const expanded = expandedCells(this.#state);
    if (!expanded.ok) {
      this.#host.announce(expanded.reason);
      return;
    }
    this.#setState({ ...this.#state, draft: expanded.cells }, true);
    this.#host.announce(texts().panels.grid.filledFromUnit);
  }

  #loadFromPattern(): void {
    const loaded = this.#pattern ? stateFromPattern(this.#pattern) : null;
    if (!loaded) return;
    this.#manual.checked = loaded.manualUnit !== null;
    if (loaded.manualUnit) {
      const { x, y, width, height } = loaded.manualUnit;
      [x + 1, y + 1, width, height].forEach((value, i) => (this.#unitInputs[i]!.value = String(value)));
    }
    this.#unitFields.hidden = !this.#manual.checked;
    this.#brush = usesColors(loaded.technique) ? 0 : 1;
    this.#setState(loaded, true);
    this.#host.announce(texts().panels.grid.loadedFromPattern);
  }

  #create(): void {
    if (!this.#pattern) return;
    const result = generateFromState(this.#pattern, this.#state);
    if (!result.ok) {
      this.#host.announce(result.reason);
      return;
    }
    this.#host.commit(result.pattern, result.message);
  }

  /* ---- Színek és ecset ---- */

  #renderColors(): void {
    const t = texts().panels.grid;
    const { colors, technique } = this.#state;
    this.#colors.replaceChildren(
      ...colors.map((color, i) => {
        const item = document.createElement('li');
        item.className = 'grid-chart__color';
        const letter = String.fromCharCode(65 + i);
        const swatch = document.createElement('input');
        swatch.type = 'color';
        swatch.value = color.hex;
        swatch.setAttribute('aria-label', t.colorSwatchLabel(letter));
        swatch.addEventListener('input', () => this.#editColor(i, { hex: swatch.value }));
        const name = document.createElement('input');
        name.type = 'text';
        name.value = color.name;
        name.autocomplete = 'off';
        name.setAttribute('aria-label', t.colorNameLabel(letter));
        name.addEventListener('change', () => this.#editColor(i, { name: name.value.trim() || t.colorFallback(letter) }, true));
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'tool';
        remove.textContent = t.remove;
        remove.setAttribute('aria-label', t.colorRemoveLabel(letter));
        // A mozaik mindig két színnel készül.
        remove.disabled = colors.length <= (technique === 'mosaic' ? 2 : 1);
        remove.addEventListener('click', () => {
          this.#brush = 0;
          this.#setState(removeColor(this.#state, i), true);
        });
        const tag = document.createElement('span');
        tag.className = 'grid-chart__letter';
        tag.textContent = letter;
        tag.setAttribute('aria-hidden', 'true');
        item.append(tag, swatch, name, remove);
        return item;
      }),
    );
    this.#colorAdd.disabled = nextColor(colors, technique) === null;
  }

  #editColor(index: number, patch: { hex?: string; name?: string }, rebuild = false): void {
    const colors = this.#state.colors.map((color, i) => (i === index ? { ...color, ...patch } : color));
    this.#setState({ ...this.#state, colors }, rebuild);
    if (!rebuild) this.#refreshCells();
  }

  #renderBrushes(): void {
    const legend = document.createElement('legend');
    legend.textContent = texts().panels.grid.brushLegend;
    const brushes = brushesFor(this.#state);
    if (!brushes.some((brush) => brush.value === this.#brush)) this.#brush = brushes[0]!.value;
    this.#brushes.replaceChildren(
      legend,
      ...brushes.map((brush) => {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'grid-brush';
        input.value = brush.key;
        input.checked = brush.value === this.#brush;
        const swatch = document.createElement('span');
        swatch.className = `grid-chart__swatch ${cellAppearance(this.#state, brush.value).className}`;
        swatch.setAttribute('aria-hidden', 'true');
        if (brush.swatch) swatch.style.background = brush.swatch;
        label.append(input, swatch, document.createTextNode(` ${brush.label}`));
        return label;
      }),
    );
  }

  /* ---- A rács ---- */

  #buildBoard(): void {
    const { draft, technique, mosaicRows } = this.#state;
    const height = draft.length;
    const width = draft[0]?.length ?? 0;
    const size = this.#pattern ? editorCellSize(this.#pattern, technique, mosaicRows) : { widthCm: 1, heightCm: 1 };
    const pixels = cellPixels(size);
    this.#board.style.setProperty('--cell-width', `${pixels.width}px`);
    this.#board.style.setProperty('--cell-height', `${pixels.height}px`);
    this.#board.setAttribute('aria-rowcount', String(height));
    this.#board.setAttribute('aria-colcount', String(width));
    this.#ratio.textContent = texts().panels.grid.cellRatio(formatNumber(size.widthCm, 1), formatNumber(size.heightCm, 1));

    this.#cells = Array.from({ length: height }, () => []);
    const rows: HTMLElement[] = [];
    for (let y = height - 1; y >= 0; y -= 1) {
      const row = document.createElement('div');
      row.setAttribute('role', 'row');
      row.setAttribute('aria-rowindex', String(height - y));
      row.className = 'grid-chart__row';
      for (let x = 0; x < width; x += 1) {
        const cell = document.createElement('div');
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-colindex', String(x + 1));
        cell.dataset['x'] = String(x);
        cell.dataset['y'] = String(y);
        cell.tabIndex = x === this.#focus.x && y === this.#focus.y ? 0 : -1;
        this.#cells[y]![x] = cell;
        row.append(cell);
      }
      rows.push(row);
    }
    this.#board.replaceChildren(...rows);
    this.#refreshCells();
  }

  #refreshCells(): void {
    const unit = unitState(this.#state).unit;
    this.#cells.forEach((row, y) => row.forEach((_, x) => this.#updateCell({ x, y }, unit)));
  }

  #updateCell({ x, y }: Cell, unit: ReturnType<typeof unitState>['unit']): void {
    const element = this.#cells[y]?.[x];
    if (!element) return;
    const value = this.#state.draft[y]?.[x] ?? null;
    const { className, color } = cellAppearance(this.#state, value);
    const inUnit = unit !== null && x >= unit.x && x < unit.x + unit.width && y >= unit.y && y < unit.y + unit.height;
    element.className = inUnit ? `${className} is-unit` : className;
    element.style.background = color ?? '';
    element.setAttribute('aria-label', `${cellLabel(this.#state, x, y)}${inUnit ? texts().panels.grid.inUnit : ''}`);
  }

  #cellOf(target: EventTarget | Element | null): Cell | null {
    const element = target instanceof Element ? target.closest<HTMLElement>('[data-x]') : null;
    if (!element || !this.#board.contains(element)) return null;
    return { x: Number(element.dataset['x']), y: Number(element.dataset['y']) };
  }

  #moveFocus(cell: Cell): void {
    this.#cells[this.#focus.y]?.[this.#focus.x]?.setAttribute('tabindex', '-1');
    this.#focus = cell;
    const element = this.#cells[cell.y]?.[cell.x];
    if (!element) return;
    element.tabIndex = 0;
    element.focus();
  }

  #paint(cell: Cell, value: DraftCell): void {
    const current = this.#state.draft[cell.y]?.[cell.x];
    if (current === undefined || current === value) return;
    const draft = this.#state.draft.map((row, y) => (y === cell.y ? row.map((old, x) => (x === cell.x ? value : old)) : row));
    this.#state = { ...this.#state, draft };
    this.#updateCell(cell, unitState(this.#state).unit);
    this.#schedule();
  }

  #onKey(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const { x, y } = this.#focus;
    const height = this.#state.draft.length;
    const width = this.#state.draft[0]?.length ?? 0;
    let next: Cell | null = null;
    switch (event.key) {
      case 'ArrowLeft':
        next = { x: Math.max(0, x - 1), y };
        break;
      case 'ArrowRight':
        next = { x: Math.min(width - 1, x + 1), y };
        break;
      // Fent a magasabb sorszámú sor áll.
      case 'ArrowUp':
        next = { x, y: Math.min(height - 1, y + 1) };
        break;
      case 'ArrowDown':
        next = { x, y: Math.max(0, y - 1) };
        break;
      case 'Home':
        next = { x: 0, y };
        break;
      case 'End':
        next = { x: width - 1, y };
        break;
      case 'PageUp':
        next = { x, y: height - 1 };
        break;
      case 'PageDown':
        next = { x, y: 0 };
        break;
      case ' ':
      case 'Enter':
        this.#paint({ x, y }, this.#brush);
        break;
      case 'Delete':
      case 'Backspace':
        this.#paint({ x, y }, null);
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (next) this.#moveFocus(next);
  }

  /* ---- Összegzés ---- */

  #render(): void {
    if (!this.#section.open || !this.#pattern) return;
    this.#refreshCells();
    const unit = unitState(this.#state);
    this.#unit.textContent = unit.text;
    this.#unit.classList.toggle('is-problem', unit.problem);
    this.#fill.disabled = unit.unit === null;

    const summary = planSummary(this.#pattern, this.#state, this.#mirrored);
    const yarn = yarnLines(this.#pattern);
    const key = JSON.stringify([summary, yarn]);
    if (key === this.#shown) return;
    this.#shown = key;
    const list = (element: HTMLElement, items: readonly string[]) =>
      element.replaceChildren(
        ...items.map((text) => {
          const item = document.createElement('li');
          item.textContent = text;
          return item;
        }),
      );
    if (!summary.ok) {
      this.#size.textContent = summary.reason;
      list(this.#details, []);
      list(this.#warnings, []);
      this.#source.textContent = '';
    } else {
      this.#size.textContent = summary.view.size;
      list(this.#details, summary.view.details);
      list(this.#warnings, summary.view.warnings);
      this.#source.textContent = summary.view.source;
    }
    list(this.#yarn, yarn);
  }
}
