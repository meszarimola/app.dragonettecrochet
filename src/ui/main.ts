// KB: interface.md §2

import './styles.css';
import {
  type Arrangement,
  allInside,
  arrangeStitches,
  boundedMove,
  chartFromJson,
  chartToJson,
  copyStitches,
  deleteStitches,
  emptyChart,
  type Facing,
  type FreeformChart,
  MAX_COUNT,
  MIN_COUNT,
  moveStitches,
  type PlacedStitch,
  pasteStitches,
  placeStitches,
  sameChart,
} from '../core/freeform.ts';
import { gridHome, gridRect, onGrid, rectGrid } from '../core/grid.ts';
import { amend, canRedo, canUndo, createHistory, type History, record, redo, undo } from '../core/history.ts';
import {
  MAX_SHAPING,
  MIN_SHAPING,
  SHAPING_PARTS,
  type Shaping,
  STITCH_SECTIONS,
  shapingStitch,
} from '../core/stitches.ts';
import type { ChartStyle, StitchDef, StitchDefId } from '../core/types.ts';
import { DEFAULT_VIEW, MAX_ZOOM, MIN_ZOOM, viewFromJson } from '../core/view.ts';
import { type BoardMode, FreeformBoard } from './freeform-board.ts';
import { bindGridDialog } from './grid-dialog.ts';
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
import { bindNewMenu } from './new-menu.ts';
import { CHART_STYLES, readChartStyle, symbolOptionsFor, termsFor, writeChartStyle } from './notation.ts';
import { AngleDial, bindPair } from './number-input.ts';
import {
  buildPalette,
  DEFAULT_SHAPING,
  type PaletteItem,
  type PaletteSection,
  partLabel,
  type ShapingChoices,
} from './palette.ts';
import { currentPlatform, historyCommand, modifierCombo, zoomCommand } from './platform.ts';
import { applyInk, drawCentered, readAccent, readInk, shapeBounds, symbolShapes } from './symbols.ts';
import { alignTooltips } from './tooltip.ts';

const NOTATION_KEY = 'dc-mintatervezo:jeloles';
const LANG_KEY = 'dc-mintatervezo:nyelv';
const CHART_KEY = 'dc-mintatervezo:minta';
const VIEW_KEY = 'dc-mintatervezo:nezet';

function must<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el;
}

const palette = must<HTMLDivElement>('#palette');
const styleSelect = must<HTMLSelectElement>('#chart-style');
const languageSelect = must<HTMLSelectElement>('#ui-language');
const homeLink = must<HTMLAnchorElement>('#home-link');
const undoButton = must<HTMLButtonElement>('#undo');
const redoButton = must<HTMLButtonElement>('#redo');
const selectButton = must<HTMLButtonElement>('#select-tool');
const duplicateButton = must<HTMLButtonElement>('#duplicate-selection');
const deleteButton = must<HTMLButtonElement>('#delete-selection');
const zoomOutButton = must<HTMLButtonElement>('#zoom-out');
const zoomResetButton = must<HTMLButtonElement>('#zoom-reset');
const zoomInButton = must<HTMLButtonElement>('#zoom-in');
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
const placeCountSetting = must<HTMLElement>('#place-count-setting');
const placePartsSetting = must<HTMLElement>('#place-parts-setting');
const PASTE_STEP = 20;
// KB: interface.md §85 — the "In a row" arrangement's default spacing.
const PLACE_GAP = Number(must<HTMLInputElement>('#arrange-gap').defaultValue);
const COUNTED = new Set(STITCH_SECTIONS.find(({ id }) => id === 'basic')?.stitches.map(({ id }) => id));

let chartStyle: ChartStyle = readChartStyle(read(NOTATION_KEY));
let chart: FreeformChart | null = null;
let tool: StitchDefId | Shaping | null = null;
let shaping: ShapingChoices = DEFAULT_SHAPING;
let mode: BoardMode = 'place';
let percent = new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 0 });
let spaceHeld = false;
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
let storedChart: FreeformChart | null = null;
let items: PaletteItem[] = [];
const buttons = new Map<StitchDefId | Shaping, HTMLButtonElement>();
const ink = readInk(document.documentElement);

const board = new FreeformBoard(must<HTMLCanvasElement>('#board'), ink, readAccent(document.documentElement), {
  place: (point) => {
    const stitch = armedStitch();
    if (chart === null || stitch === null) return;
    // KB: interface.md §89 — on a regular design only the grid takes a stitch.
    const grid = chart.grid;
    if (grid !== undefined && !onGrid(grid, point)) return;
    const n = COUNTED.has(stitch) ? placeCount.value : 1;
    const extent = (placed: PlacedStitch) => board.extentOf(placed);
    const bounds = grid === undefined ? board.sheet() : gridRect(grid);
    const placed = placeStitches(chart, stitch, point, n, extent, PLACE_GAP, bounds);
    if (placed === null) return;
    chart = placed.chart;
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
  viewChanged: (view) => {
    showZoom();
    write(VIEW_KEY, JSON.stringify(view), session);
  },
});

undoButton.addEventListener('click', () => step(undo));
redoButton.addEventListener('click', () => step(redo));
selectButton.addEventListener('click', () => setMode(mode === 'select' ? 'place' : 'select'));
zoomInButton.addEventListener('click', () => board.zoomStep(1));
zoomOutButton.addEventListener('click', () => board.zoomStep(-1));
zoomResetButton.addEventListener('click', () => board.resetView());
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
const placeCountRange = must<HTMLInputElement>('#place-count-range');
placeCountRange.min = String(MIN_COUNT);
placeCountRange.max = String(MAX_COUNT);
must<HTMLInputElement>('#place-count').maxLength = String(MAX_COUNT).length;
const placeCount = bindPair(placeCountRange, must<HTMLInputElement>('#place-count'), () => {}, true);
const placePartsRange = must<HTMLInputElement>('#place-parts-range');
placePartsRange.min = String(MIN_SHAPING);
placePartsRange.max = String(MAX_SHAPING);
must<HTMLInputElement>('#place-parts').maxLength = String(MAX_SHAPING).length;
bindPair(
  placePartsRange,
  must<HTMLInputElement>('#place-parts'),
  (n) => {
    shaping = { ...shaping, n };
    renderShapingTiles();
  },
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
  const [dx, dy] = boundedMove(next, ids, 0, 0, board.sheet());
  const result = moveStitches(next, ids, dx, dy);
  if (!allInside(result, ids, board.sheet())) return false;
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
  if (next.present.selection.size > 0) setMode('select');
  board.show(chart, symbolOptionsFor(chartStyle), next.present.selection);
  showOptions();
  return true;
}

function setHistory(next: History<Snapshot>): void {
  history = next;
  undoButton.disabled = !canUndo(history);
  redoButton.disabled = !canRedo(history);
  // A selection drag amends on every frame without changing the chart.
  if (history.present.chart === storedChart) return;
  storedChart = history.present.chart;
  write(CHART_KEY, chartToJson(storedChart), session);
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
  // KB: interface.md §87
  const ids = new Set(copied.map(({ id }) => id));
  const onScreen = allInside({ stitches: copied, nextId: 0 }, ids, board.visible());
  const pasted = pasteStitches(chart, copied, PASTE_STEP, onScreen ? board.visible() : board.sheet());
  chart = pasted.chart;
  setMode('select');
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

bindNewMenu(
  {
    root: must<HTMLElement>('#new-menu-root'),
    button: must<HTMLButtonElement>('#new-chart'),
    menu: must<HTMLElement>('#new-menu'),
    freeform: must<HTMLButtonElement>('#new-freeform'),
    regular: must<HTMLButtonElement>('#new-regular'),
    submenu: must<HTMLElement>('#new-regular-menu'),
    shapes: ['#new-rectangular', '#new-granny', '#new-triangle', '#new-semicircle', '#new-circle'].map((id) =>
      must<HTMLButtonElement>(id),
    ),
    rectangular: must<HTMLButtonElement>('#new-rectangular'),
  },
  {
    freeform: () => {
      if (!board.dragging) open(emptyChart());
    },
    rectangular: () => {
      if (!board.dragging) openGridDialog();
    },
  },
);

const gridDialog = must<HTMLDialogElement>('#grid-dialog');
const openGridDialog = bindGridDialog(
  {
    dialog: gridDialog,
    stitches: must<HTMLInputElement>('#grid-stitches'),
    rows: must<HTMLInputElement>('#grid-rows'),
    stitchesError: must<HTMLElement>('#grid-stitches-error'),
    rowsError: must<HTMLElement>('#grid-rows-error'),
    create: must<HTMLButtonElement>('#grid-create'),
    cancel: must<HTMLButtonElement>('#grid-cancel'),
  },
  (stitches, rows) => {
    const grid = rectGrid(stitches, rows);
    open({ ...emptyChart(), grid });
    // Only now: a board hidden until the first chart has no size to measure.
    board.showView(gridHome(grid, board.size()));
  },
);

// KB: interface.md §5 — the last chart, and where it was looked at, survive a reload of the tab.
const saved = chartFromJson(read(CHART_KEY, session));
if (saved !== null) open(saved, viewFromJson(read(VIEW_KEY, session)) ?? DEFAULT_VIEW);

function open(next: FreeformChart, view = DEFAULT_VIEW): void {
  const blank = chart === null || chart.stitches.length === 0;
  chart = next;
  board.show(chart, symbolOptionsFor(chartStyle));
  const fresh = { chart, selection: new Set<number>() };
  if (history === null) setHistory(createHistory(fresh));
  else setHistory(blank && !canRedo(history) ? amend(history, fresh) : record(history, fresh));
  selectButton.disabled = false;
  board.showView(view);
  showZoom();
  renderPalette();
}

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
  // The open dialog owns the keyboard; its Escape closes it and nothing else.
  if (gridDialog.open) return;
  if (event.key === 'Escape') {
    // A select box closes on its own Escape; that one is not meant for the chart.
    if (board.dragging || inField(event.target)) return;
    if (tool !== null) select(null);
    else if (board.selected.size > 0) board.clearSelection();
    return;
  }
  if (chart === null) return;
  // KB: interface.md §87 — only over the drawing, so Space still presses a focused button.
  if (event.code === 'Space' && board.hovered && !inField(event.target)) {
    event.preventDefault();
    spaceHeld = true;
    board.holdPan(true);
    return;
  }
  // Only over the drawing: elsewhere the keys still zoom the page, which some readers need.
  if ((event.ctrlKey || event.metaKey) && !event.altKey && board.hovered) {
    const zoom = zoomCommand(event);
    if (zoom !== null) {
      // The browser would zoom the whole page instead.
      event.preventDefault();
      if (zoom === 'reset') board.resetView();
      else board.zoomStep(zoom === 'in' ? 1 : -1);
      return;
    }
  }
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
  select(item.shaping ?? item.def.id);
});

document.addEventListener('keyup', (event) => {
  if (event.code !== 'Space' || !spaceHeld) return;
  // A focused button would take the release as a press.
  event.preventDefault();
  releaseSpace();
});
window.addEventListener('blur', () => releaseSpace());

function releaseSpace(): void {
  spaceHeld = false;
  board.holdPan(false);
}

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
  percent = new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 0 });
  showZoom();
}

function isShaping(id: StitchDefId | Shaping | null): id is Shaping {
  return id === 'increase' || id === 'decrease';
}

/** The stitch a click lays: the armed tile's, built from its menu and count for an increase or a decrease. */
function armedStitch(): StitchDefId | null {
  if (!isShaping(tool)) return tool;
  return shapingStitch(tool, shaping.parts[tool], shaping.n).id;
}

function select(id: StitchDefId | Shaping | null): void {
  if (chart === null) return;
  tool = id;
  for (const [entry, button] of buttons) button.setAttribute('aria-pressed', String(entry === id));
  document.body.classList.toggle('is-armed', id !== null);
  placeCountSetting.hidden = id === null || !COUNTED.has(id);
  placePartsSetting.hidden = !isShaping(id);
  placeOptions.hidden = placeCountSetting.hidden && placePartsSetting.hidden;
  if (id !== null) {
    buttons.get(id)?.scrollIntoView({ block: 'nearest' });
    setMode('place');
  }
}

/** Selecting and placing exclude each other: arming one puts the other down. */
function setMode(next: BoardMode): void {
  if (chart === null) return;
  mode = next;
  selectButton.setAttribute('aria-pressed', String(next === 'select'));
  board.setMode(next);
  if (next !== 'place' && tool !== null) select(null);
}

function showZoom(): void {
  const zoom = board.zoom;
  zoomResetButton.textContent = percent.format(zoom);
  zoomResetButton.setAttribute('aria-label', `${texts().markup.zoomResetLabel} (${percent.format(zoom)})`);
  zoomInButton.disabled = chart === null || zoom >= MAX_ZOOM;
  zoomOutButton.disabled = chart === null || zoom <= MIN_ZOOM;
  zoomResetButton.disabled = chart === null;
}

function renderPalette(): void {
  const sections = buildPalette(termsFor(uiLanguage()), shaping);
  items = sections.flatMap((section) => section.items);
  buttons.clear();
  palette.replaceChildren(...sections.map(paletteSection));
  select(tool);
}

/** Redraws the increase and decrease tiles in place, so a menu or a field in use keeps its focus. KB: interface.md §8 */
function renderShapingTiles(): void {
  items = buildPalette(termsFor(uiLanguage()), shaping).flatMap((section) => section.items);
  for (const item of items) {
    const button = item.shaping === null ? undefined : buttons.get(item.shaping);
    if (button !== undefined) fillButton(button, item);
  }
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
    const entry = item.shaping ?? item.def.id;
    const button = stitchButton(item, entry);
    buttons.set(entry, button);
    if (item.shaping === null) {
      list.append(button);
      continue;
    }
    const row = document.createElement('div');
    row.className = 'palette__shaping';
    row.append(button, partMenu(item.shaping));
    list.append(row);
  }
  group.append(title, list);
  return group;
}

/** The menu under an increase or a decrease tile; a choice arms the tile. KB: interface.md §86 */
function partMenu(kind: Shaping): HTMLSelectElement {
  const menu = document.createElement('select');
  menu.className = 'palette__part';
  menu.id = `palette-${kind}-part`;
  menu.disabled = chart === null;
  menu.setAttribute('aria-label', texts().sections.palette.shapingPart[kind]);
  const terms = termsFor(uiLanguage());
  for (const part of SHAPING_PARTS) {
    const option = document.createElement('option');
    option.value = part.id;
    option.textContent = partLabel(part, terms);
    menu.append(option);
  }
  menu.value = shaping.parts[kind].id;
  menu.addEventListener('change', () => {
    const part = SHAPING_PARTS.find(({ id }) => id === menu.value);
    if (part === undefined) return;
    shaping = { ...shaping, parts: { ...shaping.parts, [kind]: part } };
    renderShapingTiles();
    select(kind);
  });
  return menu;
}

/*
 * The structure line under the name is what tells the decreases apart, and the
 * tooltip repeats both. KB: interface.md §53, §56
 */
function stitchButton(item: PaletteItem, entry: StitchDefId | Shaping): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = item.shaping === null ? 'stitch' : 'stitch stitch--shaping';
  button.disabled = chart === null;
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => select(tool === entry ? null : entry));
  fillButton(button, item);
  return button;
}

function fillButton(button: HTMLButtonElement, item: PaletteItem): void {
  button.dataset.tip = item.structure ? `${item.name}: ${item.structure}` : item.name;
  button.replaceChildren(preview(item.def, 32), span('stitch__name', item.name));
  if (item.structure) button.append(span('stitch__detail', item.structure));
  if (item.key) {
    const key = document.createElement('kbd');
    key.className = 'stitch__key';
    key.textContent = modifierCombo(item.key, currentPlatform());
    button.append(key);
  }
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
function read(key: string, storage = () => localStorage): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string, storage = () => localStorage): void {
  try {
    storage().setItem(key, value);
  } catch {
    // KB: interface.md §5
  }
}

function session(): Storage {
  return sessionStorage;
}
