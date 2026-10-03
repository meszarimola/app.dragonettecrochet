// KB: interface.md §2

import './styles.css';
import {
  type Arrangement,
  allInside,
  arrangeStitches,
  boundedMove,
  copyStitches,
  deleteStitches,
  emptyChart,
  type Facing,
  type FreeformChart,
  moveStitches,
  type PlacedStitch,
  pasteStitches,
  placeStitches,
  sameChart,
} from '../core/freeform.ts';
import { amend, canRedo, canUndo, createHistory, type History, record, redo, undo } from '../core/history.ts';
import { STITCH_SECTIONS } from '../core/stitches.ts';
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
import { AngleDial, bindPair } from './number-input.ts';
import { buildPalette, type PaletteItem, type PaletteSection } from './palette.ts';
import { currentPlatform, historyCommand, modifierCombo } from './platform.ts';
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
const undoButton = must<HTMLButtonElement>('#undo');
const redoButton = must<HTMLButtonElement>('#redo');
const selectButton = must<HTMLButtonElement>('#select-tool');
const duplicateButton = must<HTMLButtonElement>('#duplicate-selection');
const deleteButton = must<HTMLButtonElement>('#delete-selection');
const arrangePanel = must<HTMLElement>('#arrange');
const arrangeButtons: Readonly<Record<Arrangement, HTMLButtonElement>> = {
  row: must<HTMLButtonElement>('#arrange-row'),
  around: must<HTMLButtonElement>('#arrange-around'),
};
const arrangeOptions: Readonly<Record<Arrangement, HTMLElement>> = {
  row: must<HTMLElement>('#arrange-row-options'),
  around: must<HTMLElement>('#arrange-around-options'),
};
const angleDial = new AngleDial(
  must<HTMLElement>('#arrange-dial'),
  must<HTMLElement>('#arrange-angle-handle'),
  must<HTMLInputElement>('#arrange-angle'),
  must<SVGPathElement>('#arrange-dial-arc'),
  () => rearrange('around'),
);
const facingButtons: Readonly<Record<Facing, HTMLButtonElement>> = {
  feet: must<HTMLButtonElement>('#arrange-facing-feet'),
  tops: must<HTMLButtonElement>('#arrange-facing-tops'),
};
const placeOptions = must<HTMLElement>('#place-options');
const PASTE_STEP = 20;
// KB: interface.md §85 — the "In a row" arrangement's default spacing.
const PLACE_GAP = 4;
const COUNTED = new Set(STITCH_SECTIONS.find(({ id }) => id === 'basic')?.stitches.map(({ id }) => id));

let chartStyle: ChartStyle = readChartStyle(read(NOTATION_KEY));
let chart: FreeformChart | null = null;
let tool: StitchDefId | null = null;
let selecting = false;
let clipboard: readonly PlacedStitch[] = [];
let facing: Facing = 'feet';
// KB: interface.md §83
let arranged: {
  readonly arrangement: Arrangement;
  readonly ids: ReadonlySet<number>;
  readonly base: FreeformChart;
  readonly result: FreeformChart;
} | null = null;
interface Snapshot {
  readonly chart: FreeformChart;
  readonly selection: ReadonlySet<number>;
}
// KB: core-support §9
let history: History<Snapshot> | null = null;
let items: PaletteItem[] = [];
const buttons = new Map<StitchDefId, HTMLButtonElement>();
const ink = readInk(document.documentElement);

const board = new FreeformBoard(must<HTMLCanvasElement>('#board'), ink, readAccent(document.documentElement), {
  place: ({ x, y }) => {
    if (chart === null || tool === null) return;
    const before = chart.nextId;
    const n = COUNTED.has(tool) ? placeCount.value : 1;
    const next = placeStitches(chart, tool, x, y, n, (placed) => board.extentOf(placed), PLACE_GAP);
    const ids = new Set(next.stitches.filter(({ id }) => id >= before).map(({ id }) => id));
    const [dx, dy] = boundedMove(next, ids, 0, 0, board.size());
    chart = moveStitches(next, ids, dx, dy);
    board.show(chart, symbolOptionsFor(chartStyle));
    commit();
  },
  change: (next) => {
    if (arranged !== null && chart === arranged.result) follow(next);
    chart = next;
    board.show(chart, symbolOptionsFor(chartStyle));
  },
  settled: () => commit(),
  selectionChanged: (count) => {
    duplicateButton.disabled = count === 0;
    deleteButton.disabled = count === 0;
    arrangePanel.hidden = count === 0;
    if (arranged !== null && !sameSet(arranged.ids, board.selected)) arranged = null;
    showOptions();
    if (history !== null && history.present.chart === chart) {
      setHistory(amend(history, { chart, selection: new Set(board.selected) }));
    }
  },
});

undoButton.addEventListener('click', () => step(undo));
redoButton.addEventListener('click', () => step(redo));
selectButton.addEventListener('click', () => setSelecting(!selecting));
duplicateButton.addEventListener('click', () => duplicateSelection());
deleteButton.addEventListener('click', () => deleteSelection());
arrangeButtons.row.addEventListener('click', () => {
  arrange('row');
});
arrangeButtons.around.addEventListener('click', () => {
  arrange('around');
});
for (const side of ['feet', 'tops'] as const) {
  facingButtons[side].addEventListener('click', () => {
    if (side === facing || arranged?.arrangement !== 'around') return;
    const was = facing;
    facing = side;
    if (!arrange('around')) facing = was;
    showFacing();
  });
}

function showFacing(): void {
  for (const side of ['feet', 'tops'] as const)
    facingButtons[side].setAttribute('aria-pressed', String(side === facing));
}
const gap = bindPair(must<HTMLInputElement>('#arrange-gap-range'), must<HTMLInputElement>('#arrange-gap'), () =>
  rearrange('row'),
);
const placeCount = bindPair(
  must<HTMLInputElement>('#place-count-range'),
  must<HTMLInputElement>('#place-count'),
  () => {},
  true,
);
const radius = bindPair(
  must<HTMLInputElement>('#arrange-radius-range'),
  must<HTMLInputElement>('#arrange-radius'),
  () => rearrange('around'),
);

/** Whether the arrangement was taken. */
function arrange(arrangement: Arrangement): boolean {
  if (chart === null || board.selected.size === 0 || board.dragging) return false;
  const ids = new Set(board.selected);
  const base = arranged !== null && untouchedSince(arranged) ? arranged.base : chart;
  const options = {
    gap: gap.value,
    radius: radius.value,
    angle: (angleDial.value * Math.PI) / 180,
    facing,
  };
  const next = arrangeStitches(base, ids, arrangement, (placed) => board.extentOf(placed), options);
  const [dx, dy] = boundedMove(next, ids, 0, 0, board.size());
  const result = moveStitches(next, ids, dx, dy);
  if (!allInside(result, ids, board.size())) return false;
  const continued = arranged !== null && base === arranged.base;
  chart = result;
  arranged = { arrangement, ids, base, result };
  showOptions();
  board.show(chart, symbolOptionsFor(chartStyle));
  commit(continued);
  return true;
}

function rearrange(arrangement: Arrangement): void {
  if (arranged?.arrangement === arrangement && untouchedSince(arranged)) arrange(arrangement);
}

/**
 * A plain move of the arranged stitches carries the chart the arrangement
 * started from along with them; anything else ends the arrangement. KB: interface.md §83
 */
function follow(next: FreeformChart): void {
  if (arranged === null) return;
  const shift = shiftBetween(arranged.result, next, arranged.ids);
  arranged =
    shift === null
      ? null
      : { ...arranged, base: moveStitches(arranged.base, arranged.ids, shift[0], shift[1]), result: next };
  showOptions();
}

/** The one shift that takes every given stitch from `from` to `to`, turn and size kept; `null` for anything else. */
function shiftBetween(from: FreeformChart, to: FreeformChart, ids: ReadonlySet<number>): [number, number] | null {
  if (from.stitches.length !== to.stitches.length) return null;
  let shift: [number, number] | null = null;
  for (const [i, before] of from.stitches.entries()) {
    const after = to.stitches[i];
    if (after === undefined || after.id !== before.id) return null;
    if (!ids.has(before.id)) {
      if (after !== before) return null;
      continue;
    }
    if (after.rotation !== before.rotation || after.scale !== before.scale) return null;
    const [dx, dy] = [after.x - before.x, after.y - before.y];
    shift ??= [dx, dy];
    if (Math.abs(shift[0] - dx) > 1e-9 || Math.abs(shift[1] - dy) > 1e-9) return null;
  }
  return shift ?? [0, 0];
}

function showOptions(): void {
  for (const arrangement of ['row', 'around'] as const) {
    const on = arranged?.arrangement === arrangement;
    arrangeOptions[arrangement].hidden = !on;
    arrangeButtons[arrangement].setAttribute('aria-pressed', String(on));
  }
}

/**
 * Records the chart as it now stands; `continued` folds it into the last step,
 * so one arrangement and all its settings undo together. KB: core-support §9
 */
function commit(continued = false): void {
  if (history === null || chart === null) return;
  const next = { chart, selection: new Set(board.selected) };
  if (continued || sameChart(chart, history.present.chart)) setHistory(amend(history, next));
  else setHistory(record(history, next));
}

/** The selection goes back with the chart; an arrangement in progress ends. */
function step(move: (history: History<Snapshot>) => History<Snapshot>): boolean {
  if (history === null || board.dragging) return false;
  const next = move(history);
  if (next === history) return false;
  setHistory(next);
  arranged = null;
  chart = next.present.chart;
  if (next.present.selection.size > 0) setSelecting(true);
  board.show(chart, symbolOptionsFor(chartStyle), next.present.selection);
  showOptions();
  return true;
}

function setHistory(next: History<Snapshot>): void {
  history = next;
  undoButton.disabled = !canUndo(history);
  redoButton.disabled = !canRedo(history);
}

function untouchedSince({ ids, result }: NonNullable<typeof arranged>): boolean {
  return chart === result && sameSet(ids, board.selected);
}

function sameSet(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  return a.size === b.size && [...a].every((id) => b.has(id));
}

/** Each returns whether it acted, so a shortcut that did nothing leaves the browser its own. KB: interface.md §11 */
function deleteSelection(): boolean {
  if (chart === null || board.selected.size === 0 || board.dragging) return false;
  chart = deleteStitches(chart, board.selected);
  board.show(chart, symbolOptionsFor(chartStyle));
  commit();
  return true;
}

function copySelection(): boolean {
  if (chart === null || board.selected.size === 0 || board.dragging) return false;
  clipboard = copyStitches(chart, board.selected);
  return true;
}

/** The copies are what the next paste starts from, so repeated pastes walk on instead of piling up. */
function paste(copied: readonly PlacedStitch[]): readonly PlacedStitch[] | null {
  if (chart === null || copied.length === 0 || board.dragging) return null;
  const pasted = pasteStitches(chart, copied, PASTE_STEP, board.size());
  chart = pasted.chart;
  setSelecting(true);
  board.show(chart, symbolOptionsFor(chartStyle), pasted.ids);
  commit();
  return pasted.copied;
}

function pasteClipboard(): boolean {
  const copied = paste(clipboard);
  if (copied === null) return false;
  clipboard = copied;
  return true;
}

function duplicateSelection(): boolean {
  if (chart === null || board.selected.size === 0) return false;
  return paste(copyStitches(chart, board.selected)) !== null;
}

// KB: interface.md §4 — the language is settled before anything is rendered.
applyLanguage(resolveUiLanguage(location.search, read(LANG_KEY), document.documentElement.lang));
languageSelect.value = uiLanguage();
styleSelect.value = chartStyle;
must<HTMLElement>('#version').textContent = `v${__APP_VERSION__}`;
alignTooltips(must<HTMLElement>('.tools'));
// KB: interface.md §83
if (navigator.webdriver) Object.assign(window, { dcFreeformChart: () => chart });

newButton.addEventListener('click', () => {
  if (board.dragging) return;
  const blank = chart === null || chart.stitches.length === 0;
  chart = emptyChart();
  board.show(chart, symbolOptionsFor(chartStyle));
  const fresh = { chart, selection: new Set<number>() };
  if (history === null) setHistory(createHistory(fresh));
  else setHistory(blank && !canRedo(history) ? amend(history, fresh) : record(history, fresh));
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
    if (board.dragging || inField(event.target)) return;
    if (tool !== null) select(null);
    else if (board.selected.size > 0) board.clearSelection();
    return;
  }
  if (chart === null) return;
  if ((event.ctrlKey || event.metaKey) && !event.altKey && !inText(event.target)) {
    const command = historyCommand(event);
    if (command !== null) {
      // Ctrl/⌘ + Y is the browser's history page even when there is nothing to redo.
      event.preventDefault();
      step(command === 'undo' ? undo : redo);
      return;
    }
  }
  const inSelect = inField(event.target);
  if (!inSelect && (event.key === 'Delete' || event.key === 'Backspace')) {
    if (deleteSelection()) event.preventDefault();
    return;
  }
  if (event.ctrlKey || event.metaKey) {
    if (inSelect || event.altKey || event.shiftKey) return;
    const command: Record<string, () => boolean> = {
      KeyC: copySelection,
      KeyV: pasteClipboard,
      KeyD: duplicateSelection,
    };
    if (command[event.code]?.() === true) event.preventDefault();
    return;
  }
  if (!event.altKey) return;
  const digit = /^Digit([1-9])$/.exec(event.code)?.[1];
  const item = digit === undefined ? undefined : items.find((candidate) => candidate.key === digit);
  if (item === undefined) return;
  event.preventDefault();
  select(item.def.id);
});

/** A typed field keeps Ctrl/⌘ + Z for its own text. */
function inText(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement && target.type === 'text';
}

/** A select box, a typed field and the dial's handle keep their own keys. */
function inField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLSelectElement ||
    target instanceof HTMLInputElement ||
    (target instanceof Element && target.getAttribute('role') === 'slider')
  );
}

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
  placeOptions.hidden = id === null || !COUNTED.has(id);
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
