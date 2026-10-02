// KB: interface.md §2

import './styles.css';
import { emptyChart, type FreeformChart, placeStitch } from '../core/freeform.ts';
import type { ChartStyle, StitchDef, StitchDefId } from '../core/types.ts';
import { FreeformBoard } from './freeform-board.ts';
import {
  applyStaticTexts,
  homeUrl,
  resolveUiLanguage,
  setUiLanguage,
  texts,
  type UiLanguage,
  uiLanguage,
  urlWithLanguage,
} from './i18n.ts';
import { CHART_STYLES, readChartStyle, symbolOptionsFor, termsFor, writeChartStyle } from './notation.ts';
import { buildPalette, type PaletteItem, type PaletteSection } from './palette.ts';
import { currentPlatform, modifierCombo } from './platform.ts';
import { applyInk, drawCentered, readAccent, readInk, shapeBounds, symbolShapes } from './symbols.ts';
import { alignTooltips } from './tooltip.ts';

const NOTATION_KEY = 'dc-mintatervezo:jeloles';
const LANG_KEY = 'dc-mintatervezo:nyelv';

function must<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el;
}

const palette = must<HTMLDivElement>('#palette');
const styleSelect = must<HTMLSelectElement>('#chart-style');
const languageSelect = must<HTMLSelectElement>('#ui-language');
const homeLink = must<HTMLAnchorElement>('#home-link');
const newButton = must<HTMLButtonElement>('#new-chart');
const selectButton = must<HTMLButtonElement>('#select-tool');

let chartStyle: ChartStyle = readChartStyle(read(NOTATION_KEY));
let chart: FreeformChart | null = null;
let tool: StitchDefId | null = null;
let selecting = false;
let items: PaletteItem[] = [];
const buttons = new Map<StitchDefId, HTMLButtonElement>();
const ink = readInk(document.documentElement);

const board = new FreeformBoard(must<HTMLCanvasElement>('#board'), ink, readAccent(document.documentElement), {
  place: ({ x, y }) => {
    if (chart === null || tool === null) return;
    chart = placeStitch(chart, tool, x, y);
    board.show(chart, symbolOptionsFor(chartStyle));
  },
  change: (next) => {
    chart = next;
    board.show(chart, symbolOptionsFor(chartStyle));
  },
});

selectButton.addEventListener('click', () => setSelecting(!selecting));

// KB: interface.md §4 — the language is settled before anything is rendered.
applyLanguage(resolveUiLanguage(location.search, read(LANG_KEY), document.documentElement.lang));
languageSelect.value = uiLanguage();
styleSelect.value = chartStyle;
must<HTMLElement>('#version').textContent = `v${__APP_VERSION__}`;
alignTooltips(must<HTMLElement>('.tools'));

newButton.addEventListener('click', () => {
  chart = emptyChart();
  board.show(chart, symbolOptionsFor(chartStyle));
  selectButton.disabled = false;
  renderPalette();
});

styleSelect.addEventListener('change', () => {
  const chosen = styleSelect.value as ChartStyle;
  if (!CHART_STYLES.includes(chosen)) return;
  chartStyle = chosen;
  write(NOTATION_KEY, writeChartStyle(read(NOTATION_KEY), chartStyle));
  renderPalette();
  board.show(chart, symbolOptionsFor(chartStyle));
});

languageSelect.addEventListener('change', () => {
  const language: UiLanguage = languageSelect.value === 'hu' ? 'hu' : 'en';
  write(LANG_KEY, language);
  applyLanguage(language);
  window.history.replaceState(window.history.state, '', urlWithLanguage(location.href, language));
});

// KB: interface.md §11 — by key code, so a Hungarian layout behaves like an English one.
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    // A select box closes on its own Escape; that one is not meant for the chart.
    if (board.dragging || event.target instanceof HTMLSelectElement) return;
    if (tool !== null) select(null);
    else if (board.selected.size > 0) board.clearSelection();
    return;
  }
  if (chart === null || !event.altKey || event.ctrlKey || event.metaKey) return;
  const digit = /^Digit([1-9])$/.exec(event.code)?.[1];
  const item = digit === undefined ? undefined : items.find((candidate) => candidate.key === digit);
  if (item === undefined) return;
  event.preventDefault();
  select(item.def.id);
});

function applyLanguage(language: UiLanguage): void {
  setUiLanguage(language);
  document.documentElement.lang = language;
  applyStaticTexts(document, texts().markup);
  homeLink.href = homeUrl(language);
  renderPalette();
}

function select(id: StitchDefId | null): void {
  if (chart === null) return;
  tool = id;
  for (const [stitchId, button] of buttons) button.setAttribute('aria-pressed', String(stitchId === id));
  document.body.classList.toggle('is-armed', id !== null);
  if (id !== null) {
    buttons.get(id)?.scrollIntoView({ block: 'nearest' });
    setSelecting(false);
  }
}

/** Selecting and placing exclude each other: arming one puts the other down. */
function setSelecting(on: boolean): void {
  if (chart === null) return;
  selecting = on;
  selectButton.setAttribute('aria-pressed', String(on));
  board.setMode(on ? 'select' : 'place');
  if (on && tool !== null) select(null);
}

function renderPalette(): void {
  const sections = buildPalette(termsFor(uiLanguage()));
  items = sections.flatMap((section) => section.items);
  buttons.clear();
  palette.replaceChildren(...sections.map(paletteSection));
  select(tool);
}

function paletteSection(section: PaletteSection): HTMLElement {
  const group = document.createElement('section');
  group.className = 'palette__section';
  group.id = `palette-${section.id}`;

  const title = document.createElement('h3');
  title.className = 'palette__title';
  title.id = `palette-${section.id}-title`;
  title.textContent = section.title;

  const list = document.createElement('div');
  list.className = 'palette__grid';
  list.setAttribute('role', 'group');
  list.setAttribute('aria-labelledby', title.id);
  for (const item of section.items) {
    const button = stitchButton(item);
    buttons.set(item.def.id, button);
    list.append(button);
  }
  group.append(title, list);
  return group;
}

/*
 * The structure line under the name is what tells the four "decrease" stitches
 * apart, and the tooltip repeats both. KB: interface.md §53, §56
 */
function stitchButton(item: PaletteItem): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'stitch';
  button.disabled = chart === null;
  button.setAttribute('aria-pressed', 'false');
  button.dataset.tip = item.structure ? `${item.name}: ${item.structure}` : item.name;
  button.addEventListener('click', () => select(tool === item.def.id ? null : item.def.id));
  button.append(preview(item.def, 32), span('stitch__name', item.name));
  if (item.structure) button.append(span('stitch__detail', item.structure));
  if (item.key) {
    const key = document.createElement('kbd');
    key.className = 'stitch__key';
    key.textContent = modifierCombo(item.key, currentPlatform());
    button.append(key);
  }
  return button;
}

function preview(def: StitchDef, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const shapes = symbolShapes(def, symbolOptionsFor(chartStyle));
    const { minX, minY, maxX, maxY } = shapeBounds(shapes);
    const fit = Math.min(1, (size - 8) / Math.max(maxX - minX, maxY - minY));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(size / 2, size / 2);
    // Keeps a 2 px line after the scale-down.
    applyInk(ctx, ink, 2 / fit);
    drawCentered(ctx, shapes, fit);
  }
  return canvas;
}

function span(className: string, text: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return el;
}

// KB: interface.md §5 — storage can be unavailable; the app then simply forgets.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // KB: interface.md §5
  }
}
