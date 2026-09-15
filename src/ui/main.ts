/*
 * Belépési pont: a szerkesztő állapota és a felület összekötése.
 *
 * A mintát csak a mag műveletei változtatják (src/core/editor.ts); itt csak a
 * visszavonási verem, a kurzor, a kijelölés és a nézet él. Minden változás
 * után újraszámoljuk a célpontokat, az elrendezést és az ellenőrzést, és a
 * mintát a böngészőbe mentjük.
 *
 * A jelölés és a jelstílus (PQW-868) a felület nyelvétől független beállítás:
 * a paletta, a szemnevek, a vászon jelei, az írott minta és az export is ezt
 * követi, a minta pedig mentéskor rögzíti.
 */

import './styles.css';
import { GA_MEASUREMENT_ID } from '../config.js';
import {
  closeRound,
  contextOf,
  defaultCursor,
  deleteLast,
  emptyPattern,
  endRow,
  fillRow,
  liveCheck,
  setPinned,
  setTradition,
  work,
  workIntoSame,
  type EditResult,
  type LiveCheck,
  type Slot,
  type WorkContext,
} from '../core/editor.js';
import { canRedo, canUndo, createHistory, record, redo, undo, type History } from '../core/history.js';
import { chartGrid, type ChartGrid } from '../core/grid.js';
import { layoutPattern, type ChartLayout, type Point } from '../core/layout.js';
import { loadPattern, savePattern } from '../core/pattern-json.js';
import { RULES } from '../core/rules.js';
import {
  copySelection,
  deleteStitches,
  deletionPlan,
  describeByLayer,
  duplicateSelection,
  expandSelection,
  layerSelection,
  nodesInRect,
  pasteFragment,
  rangeSelection,
  selectAll,
  stepFocus,
  toggleUnit,
  type FocusMove,
  type Fragment,
} from '../core/selection.js';
import { libraryFor, resolveStitch } from '../core/stitch-variants.js';
import { stitchName } from '../core/stitchText.js';
import { traditionOf } from '../core/tradition.js';
import type { Locale, NodeId, Pattern, PatternNotation, StitchDef, StitchDefId, Tradition } from '../core/types.js';
import { validatePattern } from '../core/validate.js';
import { Board, type DirectionArrow, type Target } from './board.js';
import { chartSvg } from './chart-svg.js';
import { setupConsentBanner } from './consentBanner.js';
import { askConfirm } from './dialog.js';
import {
  chartStyleLabel,
  notationForTradition,
  readNotation,
  symbolOptionsFor,
  termsLabel,
  textLanguage,
  traditionLabel,
  uiLanguageOf,
  withNotation,
  writeNotation,
} from './notation.js';
import { buildPalette, type PaletteItem } from './palette.js';
import { DEFAULT_PATTERN_TYPE, PATTERN_TYPES, gridKind, isAvailableType, type PatternTypeId } from './pattern-types.js';
import { applyInk, drawCentered, readInk, shapeBounds, stemLength, symbolShapes, type SymbolOptions } from './symbols.js';
import { alignTooltips } from './tooltip.js';
import { writtenView } from './written.js';

function must<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Hiányzó elem a dokumentumban: ${selector}`);
  return el;
}

const canvas = must<HTMLCanvasElement>('#board');
const board = new Board(canvas);
const palette = must<HTMLDivElement>('#palette');
const panel = must<HTMLElement>('#panel');
const toggle = must<HTMLButtonElement>('#panel-toggle');
const hint = must<HTMLParagraphElement>('#hint');
const status = must<HTMLParagraphElement>('#status');
const countField = must<HTMLElement>('#count-field');
const countInput = must<HTMLInputElement>('#chain-count');
const summary = must<HTMLParagraphElement>('#summary');
const findingList = must<HTMLUListElement>('#findings');
const titleInput = must<HTMLInputElement>('#title');
const importFile = must<HTMLInputElement>('#import-file');
const adjust = must<HTMLElement>('#adjust');
const adjustName = must<HTMLParagraphElement>('#adjust-name');
const written = must<HTMLElement>('#written');
const writtenToggle = must<HTMLButtonElement>('#written-toggle');
const writtenText = must<HTMLPreElement>('#written-text');
const writtenNotices = must<HTMLDivElement>('#written-notices');
const termsSelect = must<HTMLSelectElement>('#terms');
const styleSelect = must<HTMLSelectElement>('#chart-style');
const scMarkField = must<HTMLFieldSetElement>('#sc-mark');
const scMarkJis = must<HTMLParagraphElement>('#sc-mark-jis');
const traditionSelect = must<HTMLSelectElement>('#tradition');
const typesNav = must<HTMLElement>('#types');
const typesToggle = must<HTMLButtonElement>('#types-toggle');
const typesList = must<HTMLUListElement>('#types-list');
const errorToggle = must<HTMLButtonElement>('#error-toggle');
const errorCount = must<HTMLElement>('#error-count');
const errorsPop = must<HTMLElement>('#errors');
const exportGrid = must<HTMLInputElement>('#export-grid');

const STORAGE_KEY = 'dc-mintatervezo:minta';
const SETTINGS_KEY = 'dc-mintatervezo:nezet';
const NOTATION_KEY = 'dc-mintatervezo:jeloles';
const WRITTEN_KEY = 'dc-mintatervezo:irott-minta';
const TYPE_KEY = 'dc-mintatervezo:tipus';
const GRID_KEY = 'dc-mintatervezo:racs';
/** Ennél keskenyebb képernyőn a két panel nem fér el egymás mellett. */
const NARROW = window.matchMedia('(width < 48rem)');
const STRUCTURAL_RULES = new Set(['unknown-stitch', 'dangling-reference', 'yarn-path']);

/* ---- Állapot ---- */

let history: History<Pattern> = createHistory(restore());
let tool: StitchDefId | null = null;
let cursor = 0;
/** A felhasználó mozgatta-e a kurzort; ha nem, a kurzor a következő alapértelmezett célpontra ugrik. */
let cursorMoved = false;
let hover: number | null = null;
/** A kijelölés fókusza: az utoljára kijelölt szem; ezt igazítja az igazítás panel. */
let selectedNode: NodeId | null = null;
/** A kijelölt szemek fonalsorrendben, egész egységekkel (PQW-875). */
let selection: readonly NodeId[] = [];
/** A Shift+nyíllal húzott tartomány kezdőszeme. */
let selectionAnchor: NodeId | null = null;
/** A vágólap: a legutóbb másolt szemek újraköthető részletként; csak ebben a lapban él. */
let clipboard: Fragment | null = null;
/** Terület kijelölése húzással (a menüsor kijelölés-gombja). */
let areaMode = false;
/** A húzott kijelölő téglalap, diagram-koordinátában. */
let marquee: { readonly from: Point; readonly to: Point } | null = null;
/** Törlés előtt a törlendőkbe horgolt szemek, amelyeket a vászon kiemel. */
let affected: readonly NodeId[] = [];
let mirror = readMirror();
/** A választott mintatípus; a böngészőben marad. Most csak a „szabályos” aktív. */
let patternType: PatternTypeId = readType();
/** Látszik-e a rács (PQW-874); a böngészőben marad. */
let showGrid = readGrid();
/** A jelölés és a jelstílus; a böngészőben marad. */
let notation = readStoredNotation();
let symbols: SymbolOptions = symbolOptionsFor(notation);
/** Húzás közben a még el nem mentett, igazított minta. */
let preview: Pattern | null = null;

interface Derived {
  readonly pattern: Pattern;
  readonly context: WorkContext;
  readonly layout: ChartLayout;
  readonly check: LiveCheck;
  readonly targets: readonly Target[];
  /** A rács, ha be van kapcsolva (PQW-874). */
  readonly grid: ChartGrid | null;
}

let derived = derive(history.present);

function derive(pattern: Pattern): Derived {
  const context = contextOf(pattern);
  const layout = layoutPattern(pattern, context.library, { mirror, stemLength });
  const check = liveCheck(pattern, context);
  const targets = context.slots.map((slot, i) => ({ point: slotPoint(layout, slot), used: context.used[i] ?? false }));
  const grid = showGrid ? chartGrid(pattern, context.library, gridKindOf(context), context, { mirror, stemLength }) : null;
  return { pattern, context, layout, check, targets, grid };
}

/** A rács típusa a mintatípusból és a darab alakjából (sor vagy kör). */
function gridKindOf(context: WorkContext) {
  return gridKind(patternType, context.graph?.layers[0]?.shape ?? context.shape);
}

/**
 * A most horgolt sor iránynyila: a sor elejéről a haladási irányba (PQW-879).
 * A már megrajzolt sornál a számolt sorelejét és -végét használjuk; a még el
 * nem kezdett 1. sornál a láncalap két vége adja az irányt. Körben nincs nyíl.
 */
function directionArrow(): DirectionArrow | null {
  const { layout, context } = derived;
  if (context.shape === 'round') return null;
  const active = layout.layers.find((layer) => layer.index === context.layer);
  if (active) return { from: active.start, to: active.end };
  // Az 1. sor még nincs a gráfban: a láncalap felől jobbról balra indul (03 §1.2).
  const base = layout.layers.find((layer) => layer.index === 0);
  if (context.layer === 1 && base && base.shape === 'row') return { from: base.end, to: base.start };
  return null;
}

function slotPoint(layout: ChartLayout, slot: Slot): Point {
  const ids = slot.kind === 'stitch' ? [slot.id] : slot.kind === 'space' ? slot.chains : [slot.node];
  const points = ids.map((id) => layout.nodes.get(id)?.top).filter((p): p is Point => p !== undefined);
  if (points.length === 0) return { x: 0, y: 0 };
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  };
}

/* ---- Tárolás ---- */

function restore(): Pattern {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    return emptyPattern();
  }
  if (!saved) return emptyPattern();
  const loaded = loadPattern(saved);
  if (loaded.ok && structuralProblem(loaded.pattern) === null) return loaded.pattern;
  try {
    localStorage.setItem(`${STORAGE_KEY}:hibas`, saved);
  } catch {
    // Ha a tárhely sem írható, a hibás mentést nem tudjuk megőrizni.
  }
  queueMicrotask(() => announce('A böngészőben mentett minta nem tölthető be, ezért új minta indult.'));
  return emptyPattern();
}

function persist(pattern: Pattern): void {
  try {
    localStorage.setItem(STORAGE_KEY, savePattern(withNotation(pattern, notation)));
  } catch {
    announce('A mintát nem sikerült a böngészőbe menteni; JSON-ként mentsd le.');
  }
}

function readMirror(): boolean {
  try {
    return localStorage.getItem(SETTINGS_KEY) === 'tukrozott';
  } catch {
    return false;
  }
}

function readStoredNotation(): PatternNotation {
  const ui = uiLanguageOf(document.documentElement.lang);
  try {
    return readNotation(localStorage.getItem(NOTATION_KEY), ui);
  } catch {
    return readNotation(null, ui);
  }
}

function readType(): PatternTypeId {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(TYPE_KEY);
  } catch {
    return DEFAULT_PATTERN_TYPE;
  }
  return saved && isAvailableType(saved) ? saved : DEFAULT_PATTERN_TYPE;
}

function readGrid(): boolean {
  try {
    return localStorage.getItem(GRID_KEY) !== 'rejtett';
  } catch {
    return true;
  }
}

function structuralProblem(pattern: Pattern): string | null {
  const finding = validatePattern(pattern, libraryFor(pattern)).find((f) => STRUCTURAL_RULES.has(f.rule));
  return finding ? RULES[finding.rule as keyof typeof RULES].message : null;
}

/* ---- Frissítés ---- */

const insetRight = () => (panel.hidden ? 0 : panel.getBoundingClientRect().width);
const insetLeft = () => (typesNav.hidden ? 0 : typesNav.getBoundingClientRect().width);
const fitBoard = () => board.fit(insetRight(), insetLeft());
const showPoint = (point: Point) => board.ensureVisible(point, insetRight(), insetLeft());

function refresh(message?: string): void {
  derived = derive(preview ?? history.present);
  if (!cursorMoved) cursor = defaultCursor(derived.pattern, derived.context, tool);
  // A sor utolsó célpontja után a kurzor a célpontokon kívül áll: ott nem horgol.
  cursor = Math.max(0, Math.min(cursor, derived.targets.length));
  if (selectedNode && !derived.layout.nodes.has(selectedNode)) selectedNode = null;
  // Visszavonás után a már nem létező szemek kiesnek a kijelölésből.
  selection = selection.filter((id) => derived.layout.nodes.has(id));
  draw();
  traditionSelect.value = traditionOf(derived.pattern.conventions);
  updateControls();
  updateWritten();
  if (message !== undefined) announce(message);
}

/** A vászon a már kiszámolt adatokból; a kijelölő téglalap húzásához ennyi elég. */
function draw(): void {
  // Szem nélkül, kijelölés nélkül és teli vágólappal a kurzor a beillesztés helyét mutatja (PQW-875).
  const pasting = tool === null && clipboard !== null && selection.length === 0;
  const aiming = (tool !== null && isTargeted(tool)) || pasting;
  board.setScene({
    layout: derived.layout,
    library: derived.context.library,
    targets: aiming ? derived.targets : [],
    cursor: aiming && derived.targets.length ? cursor : null,
    hover,
    selected: selectedNode,
    selection,
    affected,
    marquee,
    findings: derived.check.findings,
    grid: derived.grid,
    tradition: traditionOf(derived.pattern.conventions),
    direction: tool && isTargeted(tool) ? directionArrow() : null,
    symbols,
  });
}

function isTargeted(id: StitchDefId): boolean {
  const kind = resolveStitch(id)?.kind;
  return kind !== 'chain' && kind !== 'space' && kind !== 'ring' && kind !== 'picot';
}

function commit(result: EditResult, message: string): void {
  if (!result.ok) {
    announce(result.reason);
    return;
  }
  history = record(history, result.pattern);
  cursorMoved = false;
  persist(history.present);
  // Előbb újraszámolunk, hogy az állapotsor már az új mintát írja le.
  refresh();
  announce(`${message} ${progress()}`);
  const point = (tool && isTargeted(tool) ? derived.targets[cursor]?.point : undefined) ?? lastTop();
  if (point) showPoint(point);
}

function lastTop(): Point | undefined {
  const last = derived.pattern.pieces[0]?.stitches.at(-1);
  return last ? derived.layout.nodes.get(last.id)?.top : undefined;
}

function announce(message: string): void {
  status.textContent = message;
}

function layerName(context: WorkContext): string {
  return `${context.layer}. ${context.shape === 'round' ? 'kör' : 'sor'}`;
}

function progress(): string {
  const { context, check } = derived;
  if (!context.graph) return '';
  if (!context.started) return `${capitalize(layerName(context))} következik.`;
  const count = context.graph.layers[context.layer]?.stitchCount ?? 0;
  const rest = check.remaining > 0 ? `, még ${check.remaining} célpont` : '';
  return `${capitalize(layerName(context))}: ${count} szem${rest}.`;
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('hu') + text.slice(1);
}

function describeTarget(index: number): string {
  const slot = derived.context.slots[index];
  if (!slot) return derived.context.slots.length > 0 ? 'A sor végén vagy: nincs több célpont.' : 'Nincs célpont.';
  let what: string;
  if (slot.kind === 'space') what = `láncív (${slot.chains.length} láncszem)`;
  else if (slot.kind === 'ring') what = 'varázskör';
  else {
    const def = derived.context.graph?.defs.get(slot.id);
    what = def ? stitchName(def, notation.terms) : 'szem';
  }
  const used = derived.context.used[index] ? ', már horgoltál bele' : '';
  return `Célpont: ${index + 1}/${derived.context.slots.length}, ${what}${used}.`;
}

/* ---- Vezérlők állapota ---- */

function updateControls(): void {
  const { context, pattern, check } = derived;
  const empty = (pattern.pieces[0]?.stitches.length ?? 0) === 0;
  const def = tool ? resolveStitch(tool) : undefined;
  setDisabled('undo', !canUndo(history));
  setDisabled('redo', !canRedo(history));
  setDisabled('delete-last', empty);
  setDisabled('same', !(def?.kind === 'basic' && !empty));
  const canFill = tool !== null && isTargeted(tool) && context.graph !== null && context.slots.some((_, i) => !context.used[i]);
  setDisabled('fill-row', !canFill);
  setDisabled('end-row', !(context.started && context.shape === 'row'));
  setDisabled('close-round', !(context.started && context.shape === 'round'));
  setDisabled('export-png', empty);
  setDisabled('export-svg', empty);
  setDisabled('delete-selection', selection.length === 0);
  setDisabled('duplicate-selection', selection.length === 0);
  must<HTMLButtonElement>('[data-action="select-area"]').setAttribute('aria-pressed', String(areaMode));
  must<HTMLButtonElement>('[data-action="mirror"]').setAttribute('aria-pressed', String(mirror));
  must<HTMLButtonElement>('[data-action="grid"]').setAttribute('aria-pressed', String(showGrid));
  if (document.activeElement !== titleInput) titleInput.value = pattern.title;

  const layers = context.graph ? context.graph.layers.length - 1 : 0;
  const errors = check.findings.filter((f) => f.severity === 'error').length;
  const warnings = check.findings.length - errors;
  errorCount.textContent =
    check.findings.length === 0
      ? 'Nincs hiba'
      : [errors ? `${errors} hiba` : '', warnings ? `${warnings} figyelmeztetés` : ''].filter(Boolean).join(' · ');
  errorToggle.classList.toggle('has-errors', errors > 0);
  errorToggle.classList.toggle('has-warnings', errors === 0 && warnings > 0);
  const parts = [
    empty ? 'Üres minta: kezdd láncalappal (Láncszem) vagy varázskörrel.' : `${layers} ${context.shape === 'round' ? 'kör' : 'sor'}. ${progress()}`,
    check.findings.length === 0 ? 'Nincs hiba és figyelmeztetés.' : `${errors} hiba, ${warnings} figyelmeztetés.`,
  ];
  summary.textContent = parts.join(' ');

  findingList.replaceChildren(
    ...check.findings.map((finding) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `finding${finding.severity === 'warning' ? ' finding--warning' : ''}`;
      const severity = span('finding__severity', finding.severity === 'error' ? 'Hiba: ' : 'Figyelmeztetés: ');
      const rule = RULES[finding.rule as keyof typeof RULES];
      // A főszöveg a felhasználónak szóló üzenet; a tudásbázis-kód csak lenyitva (PQW-879).
      button.append(severity, rule?.message ?? finding.rule, span('finding__count', ` · ${finding.nodes.length} szem`));
      button.addEventListener('click', () => {
        const first = finding.nodes.find((id) => derived.layout.nodes.has(id));
        if (!first) return;
        selectedNode = first;
        if (tool === null) selection = expandSelection(history.present, [first]);
        closePopover(errorsPop, errorToggle);
        refresh(`Kijelölve a hiba első szeme.`);
        showPoint(derived.layout.nodes.get(first)!.top);
      });
      item.append(button);
      if (rule) {
        const details = document.createElement('details');
        details.className = 'finding__more';
        const more = document.createElement('summary');
        more.textContent = 'Részletek';
        const body = span('finding__ref', `Tudásbázis: ${finding.reference}`);
        details.append(more, body);
        item.append(details);
      }
      return item;
    }),
  );

  const node = selectedNode ? derived.pattern.pieces[0]?.stitches.find((n) => n.id === selectedNode) : undefined;
  adjust.hidden = !node || tool !== null;
  if (node) {
    const nodeDef = derived.context.library.get(node.def);
    adjustName.textContent = `${nodeDef ? capitalize(stitchName(nodeDef, notation.terms)) : node.def}${node.pinned ? ', kézzel igazítva' : ''}`;
  }
}

function setDisabled(action: string, disabled: boolean): void {
  must<HTMLButtonElement>(`[data-action="${action}"]`).disabled = disabled;
}

function span(className: string, text: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return el;
}

/* ---- Írott minta ---- */

function updateWritten(): void {
  // Húzás közben csak a jel helye változik, a szöveg nem.
  if (written.hidden || preview) return;
  const view = writtenView(derived.pattern, derived.context, derived.check, notation.terms);
  const notices = view.kind === 'text' ? view.notices : [view.message];
  writtenNotices.replaceChildren(
    ...notices.map((notice) => {
      const item = document.createElement('p');
      item.className = `written__notice${view.kind === 'message' ? ' written__notice--info' : ''}`;
      item.textContent = notice;
      return item;
    }),
  );
  writtenText.hidden = view.kind !== 'text';
  writtenText.textContent = view.kind === 'text' ? view.text : '';
  writtenText.lang = textLanguage(notation.terms);
  setDisabled('copy-written', view.kind !== 'text');
}

async function copyWritten(): Promise<void> {
  try {
    await navigator.clipboard.writeText(writtenText.textContent ?? '');
    announce('Az írott minta a vágólapra került.');
  } catch {
    const range = document.createRange();
    range.selectNodeContents(writtenText);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    writtenText.focus();
    announce('A másolás nem sikerült; a szöveg ki van jelölve, Ctrl+C-vel másolhatod.');
  }
}

function setOpen(target: HTMLElement, button: HTMLButtonElement, open: boolean): void {
  target.toggleAttribute('hidden', !open);
  button.setAttribute('aria-expanded', String(open));
}

function setWrittenOpen(open: boolean): void {
  setOpen(written, writtenToggle, open);
  try {
    localStorage.setItem(WRITTEN_KEY, open ? 'nyitva' : 'zarva');
  } catch {
    // A panel enélkül is működik, csak az állapota nem marad meg.
  }
  updateWritten();
}

function readWrittenOpen(): boolean {
  try {
    return localStorage.getItem(WRITTEN_KEY) !== 'zarva';
  } catch {
    return true;
  }
}

/* ---- Jelölés és jelstílus ---- */

function applyNotation(next: PatternNotation, message: string): void {
  notation = next;
  symbols = symbolOptionsFor(next);
  try {
    localStorage.setItem(NOTATION_KEY, writeNotation(next));
  } catch {
    // A választás enélkül is érvényes, csak újratöltés után nem marad meg.
  }
  syncNotationControls();
  renderPalette();
  // A kiválasztott szem súgója is az új nevet mutassa.
  select(tool);
  announce(message);
}

function syncNotationControls(): void {
  termsSelect.value = notation.terms;
  styleSelect.value = notation.chartStyle;
  const jis = notation.chartStyle === 'jis';
  scMarkField.hidden = jis;
  scMarkJis.hidden = !jis;
  for (const radio of scMarkField.querySelectorAll<HTMLInputElement>('input[name="sc-mark"]')) {
    radio.checked = radio.value === notation.singleCrochet;
  }
}

termsSelect.addEventListener('change', () => {
  const terms = termsSelect.value as Locale;
  applyNotation({ ...notation, terms }, `Jelölés: ${termsLabel(terms)}.`);
});

styleSelect.addEventListener('change', () => {
  const chartStyle = styleSelect.value as PatternNotation['chartStyle'];
  applyNotation({ ...notation, chartStyle }, `Jelstílus: ${chartStyleLabel(chartStyle)}.`);
});

scMarkField.addEventListener('change', (event) => {
  const singleCrochet = (event.target as HTMLInputElement).value as PatternNotation['singleCrochet'];
  applyNotation({ ...notation, singleCrochet }, `A rövidpálca jele: ${singleCrochet === 'plus' ? '+' : '×'}.`);
});

// Az előbeállítás a mintához tartozik: a számolás a mintában, a jelek a jelölésben változnak (PQW-876).
traditionSelect.addEventListener('change', () => {
  const tradition = traditionSelect.value as Tradition;
  const result = setTradition(history.present, tradition);
  if (!result.ok) return;
  applyNotation(notationForTradition(notation, tradition), '');
  commit(result, `Előbeállítás: ${traditionLabel(tradition)}. A jelek és a számolás is ezt követik.`);
});

/* ---- Paletta ---- */

let items: PaletteItem[] = [];
const ink = readInk(document.documentElement);
const buttons = new Map<StitchDefId, HTMLButtonElement>();

/** A gomb előnézete ugyanazzal a rajzzal készül, mint a vászon, a gombhoz kicsinyítve. */
function drawPreview(def: StitchDef, size: number): HTMLCanvasElement {
  const previewCanvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  previewCanvas.width = Math.round(size * dpr);
  previewCanvas.height = Math.round(size * dpr);
  previewCanvas.style.width = `${size}px`;
  previewCanvas.style.height = `${size}px`;
  previewCanvas.setAttribute('aria-hidden', 'true');

  const ctx = previewCanvas.getContext('2d');
  if (ctx) {
    const shapes = symbolShapes(def, symbols);
    const { minX, minY, maxX, maxY } = shapeBounds(shapes);
    const fit = Math.min(1, (size - 8) / Math.max(maxX - minX, maxY - minY));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(size / 2, size / 2);
    // A vonal a kicsinyítés után is 2 px vastag marad.
    applyInk(ctx, ink, 2 / fit);
    drawCentered(ctx, shapes, fit);
  }
  return previewCanvas;
}

function stitchButton(item: PaletteItem): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'stitch';
  button.setAttribute('aria-pressed', 'false');
  button.append(drawPreview(item.def, 44));

  const label = span('stitch__label', '');
  label.lang = textLanguage(notation.terms);
  label.append(span('stitch__name', item.name));
  if (item.structure) label.append(span('stitch__detail', item.structure));
  button.append(label);

  if (item.key) {
    const key = document.createElement('kbd');
    key.className = 'stitch__key';
    key.textContent = item.key;
    button.append(key);
  }

  // A kiválasztott jelre újra kattintva megszűnik a kijelölés.
  button.addEventListener('click', () => select(tool === item.def.id ? null : item.def.id));
  return button;
}

function select(id: StitchDefId | null): void {
  tool = id;
  hover = null;
  // Szemmel a kattintás horgol: a kijelölés és a terület kijelölése megszűnik (PQW-875).
  if (id) {
    selectedNode = null;
    selection = [];
    selectionAnchor = null;
    areaMode = false;
    document.body.classList.remove('is-selecting');
  }
  for (const [stitchId, button] of buttons) button.setAttribute('aria-pressed', String(stitchId === id));

  const item = items.find((candidate) => candidate.def.id === id);
  const kind = item?.def.kind;
  countField.hidden = kind !== 'chain' && kind !== 'space';
  if (!item) {
    hint.textContent =
      'Válassz szemet. Szem nélkül kattintással szemet jelölsz ki (Shift-tel többet, a sorszámmal a teljes sort), és törölheted, duplikálhatod vagy igazíthatod.';
  }
  else if (kind === 'chain' || kind === 'space') hint.textContent = `${item.name}: Enterrel vagy a vászonra kattintva horgolod, a megadott számú láncszemmel.`;
  else if (kind === 'ring' || kind === 'picot') hint.textContent = `${item.name}: Enterrel vagy a vászonra kattintva horgolod.`;
  else hint.textContent = `${item.name}: nyilakkal választod a célpontot, Enterrel vagy kattintással horgolsz bele.`;
  document.body.classList.toggle('is-armed', item !== undefined);
  refresh();
}

function renderPalette(): void {
  const sections = buildPalette(notation.terms);
  items = sections.flatMap((section) => section.items);
  buttons.clear();
  palette.replaceChildren();
  for (const section of sections) palette.append(paletteSection(section));
}

function paletteSection(section: ReturnType<typeof buildPalette>[number]): HTMLDivElement {
  const group = document.createElement('div');
  group.className = 'palette__section';
  group.setAttribute('role', 'group');
  const title = document.createElement('h3');
  title.className = 'palette__title';
  title.id = `palette-${section.id}`;
  title.textContent = section.title;
  group.setAttribute('aria-labelledby', title.id);
  group.append(title);
  for (const item of section.items) {
    const button = stitchButton(item);
    buttons.set(item.def.id, button);
    group.append(button);
  }
  return group;
}

/* ---- Műveletek ---- */

/** A célpont neve a kérdésekben: „szembe”, „láncszembe”, „láncívbe”, „varázskörbe”. */
function slotWord(slot: Slot): string {
  if (slot.kind === 'space') return 'láncívbe';
  if (slot.kind === 'ring') return 'varázskörbe';
  return derived.context.graph?.defs.get(slot.id)?.kind === 'chain' ? 'láncszembe' : 'szembe';
}

async function workAtCursor(): Promise<void> {
  if (!tool) {
    announce('Előbb válassz szemet a jelkészletből (1–9).');
    return;
  }
  const def = resolveStitch(tool);
  const count = Number(countInput.value);
  const name = def ? capitalize(stitchName(def, notation.terms)) : tool;

  // Láncszem, láncív, varázskör, pikó: célpont nélkül, kérdés nélkül.
  if (!isTargeted(tool)) {
    const message = def?.kind === 'chain' || def?.kind === 'space' ? `${name}: ${count} láncszem.` : `${name} horgolva.`;
    commit(work(history.present, { def: tool, count }, cursor), message);
    return;
  }

  const { context } = derived;
  const idx = cursor;
  const slot = context.slots[idx];

  // Foglalt célpont: nem tesz le csendben szemet, hanem megkérdezi a szaporítást (PQW-879).
  if (slot && context.used[idx]) {
    const yes = await askConfirm({
      message: `Ebbe a ${slotWord(slot)} már horgoltál. Szaporítást szeretnél?`,
      confirmLabel: 'Szaporítás',
    });
    if (!yes) {
      announce('Nem került le szem.');
      return;
    }
    const increase = idx === context.frontier ? workIntoSame(history.present, tool) : work(history.present, { def: tool, count }, idx);
    commit(increase, `${name}: szaporítás.`);
    return;
  }

  // A haladási irány ellen lévő (már mögötted hagyott) szabad célpont: keresztezett szem?
  if (slot && context.frontier >= 0 && idx <= context.frontier) {
    const yes = await askConfirm({
      message: 'Ez a célpont már mögötted van. Keresztezett szemet szeretnél?',
      confirmLabel: 'Keresztezett szem',
    });
    if (!yes) {
      announce('Nem került le szem.');
      return;
    }
    commit(work(history.present, { def: tool, count }, idx, ['crossed']), `${name}: keresztezett szem.`);
    return;
  }

  commit(work(history.present, { def: tool, count }, idx), `${name} horgolva.`);
}

function nudge(dx: number, dy: number): void {
  const node = history.present.pieces[0]?.stitches.find((n) => n.id === selectedNode);
  if (!node) return;
  const x = (node.pinned?.x ?? 0) + (mirror ? -dx : dx);
  const y = (node.pinned?.y ?? 0) + dy;
  commit(setPinned(history.present, node.id, { x, y }), 'Jel eltolva.');
}

function slug(title: string): string {
  const base = title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return base || 'minta';
}

function download(content: Blob | string, filename: string, type: string): void {
  const blob = typeof content === 'string' ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportSvgText(): string {
  const pattern = history.present;
  const library = libraryFor(pattern);
  const root = document.documentElement;
  const token = (name: string) => getComputedStyle(root).getPropertyValue(name).trim();
  const context = contextOf(pattern);
  const grid = {
    grid: chartGrid(pattern, library, gridKindOf(context), context, { mirror, stemLength }),
    colors: { rowA: token('--c-row-a'), rowB: token('--c-row-b'), cell: token('--c-grid'), row: token('--c-grid-row'), strong: token('--c-grid-strong') },
  };
  return chartSvg(pattern, layoutPattern(pattern, library, { mirror, stemLength }), library, {
    tradition: traditionOf(pattern.conventions),
    ...(exportGrid.checked ? { grid } : {}),
    colors: { right: token('--c-ink'), wrong: token('--c-ink-wrong'), text: token('--c-text'), background: token('--c-bg') },
    mirror,
    terms: notation.terms,
    symbols,
  });
}

async function exportPng(): Promise<void> {
  const url = URL.createObjectURL(new Blob([exportSvgText()], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const out = document.createElement('canvas');
    out.width = image.width * 2;
    out.height = image.height * 2;
    out.getContext('2d')?.drawImage(image, 0, 0, out.width, out.height);
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('üres kép');
    download(blob, `${slug(history.present.title)}.png`, 'image/png');
    announce('PNG mentve.');
  } catch {
    announce('A PNG-t nem sikerült elkészíteni; az SVG-export működik.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function importJson(file: File): Promise<void> {
  const loaded = loadPattern(await file.text());
  if (!loaded.ok) {
    announce(`A fájl nem tölthető be: ${loaded.error.message} (${loaded.error.path})`);
    return;
  }
  const problem = structuralProblem(loaded.pattern);
  if (problem) {
    announce(`A fájl szerkezete hibás, ezért nem tölthető be: ${problem}`);
    return;
  }
  selectedNode = null;
  selection = [];
  const recorded = loaded.pattern.notation?.terms;
  const note =
    recorded && recorded !== notation.terms
      ? ` A minta ${termsLabel(recorded)} jelöléssel készült; a nézet a beállításod szerint ${termsLabel(notation.terms)}.`
      : '';
  commit({ ok: true, pattern: loaded.pattern }, `Minta betöltve; visszavonással a korábbi visszajön.${note}`);
  fitBoard();
}

/* ---- Kijelölés, törlés, másolás, beillesztés (PQW-875) ---- */

/** A kijelölés egész egységekre bővítve; a fókusz csak kijelölt szem lehet. */
function setSelection(ids: Iterable<NodeId>, focus: NodeId | null, message?: string): void {
  selection = expandSelection(history.present, ids);
  selectedNode = focus !== null && selection.includes(focus) ? focus : null;
  refresh(message ?? describeSelection());
}

function describeSelection(): string {
  if (selection.length === 0) return 'Nincs kijelölt szem.';
  const def = selectedNode ? derived.context.graph?.defs.get(selectedNode) : undefined;
  const name = def ? `${capitalize(stitchName(def, notation.terms))}. ` : '';
  return `${name}Kijelölve: ${selection.length} szem (${describeByLayer(history.present, selection)}).`;
}

function setAreaMode(on: boolean): void {
  if (on && tool) select(null);
  areaMode = on;
  document.body.classList.toggle('is-selecting', on);
  refresh(on ? 'Terület kijelölése: húzz téglalapot a szemek köré; Shift-tel a kijelöléshez adod.' : 'Terület kijelölése kikapcsolva.');
}

/** Ha más szem is horgol a kijelöltekbe, megmutatja őket, és megkérdezi, törölje-e velük együtt. */
async function deleteSelection(): Promise<void> {
  if (selection.length === 0) {
    announce('Nincs kijelölt szem: kattints egy szemre vagy a sorszámra.');
    return;
  }
  const pattern = history.present;
  const plan = deletionPlan(pattern, selection);
  if (plan.dependents.length > 0) {
    affected = plan.dependents;
    draw();
    const yes = await askConfirm({
      message: `A kijelölt ${plan.selected.length} szembe még ${plan.dependents.length} szem horgol: ${describeByLayer(pattern, plan.dependents)}. A vásznon szaggatott piros keret jelöli őket. Velük együtt törlöd?`,
      confirmLabel: 'Törlés velük együtt',
      cancelLabel: 'Megszakítás',
    });
    affected = [];
    if (!yes) {
      refresh('A törlés megszakítva; a minta nem változott.');
      return;
    }
  }
  const result = deleteStitches(pattern, plan.selected, { withDependents: true });
  if (result.ok) {
    selection = [];
    selectedNode = null;
    selectionAnchor = null;
  }
  commit(result, `${plan.selected.length + plan.dependents.length} szem törölve.`);
}

function copySelected(): void {
  if (selection.length === 0) return announce('Nincs kijelölt szem a másoláshoz.');
  const result = copySelection(history.present, selection);
  if (!result.ok) return announce(result.reason);
  clipboard = result.fragment;
  const where = result.fragment.startsLayer ? `új ${result.fragment.shape === 'round' ? 'körként' : 'sorként'} a minta végére` : 'a kurzortól';
  announce(`${result.fragment.stitches.length} szem a vágólapon. Ctrl+V-vel ${where} illesztheted be.`);
}

function pasteClipboard(): void {
  if (!clipboard) return announce('A vágólap üres: jelölj ki szemeket, és másold ki őket (Ctrl+C).');
  commitInserted(pasteFragment(history.present, clipboard, cursorMoved ? cursor : undefined), `${clipboard.stitches.length} szem beillesztve.`);
}

function duplicateSelected(): void {
  if (selection.length === 0) return announce('Nincs kijelölt szem a duplikáláshoz.');
  commitInserted(duplicateSelection(history.present, selection), `A kijelölés duplikálva (${selection.length} szem).`);
}

/** Szem nélkül a beillesztett szemek lesznek a kijelölés, az újrahasznált fordulólánccal: így a duplikálás ismételhető. */
function commitInserted(result: EditResult, message: string): void {
  const before = new Set(history.present.pieces[0]?.stitches.map((node) => node.id));
  commit(result, message);
  if (!result.ok || tool !== null) return;
  const added = derived.pattern.pieces[0]!.stitches.filter((node) => !before.has(node.id)).map((node) => node.id);
  const graph = derived.context.graph;
  const layer = added[0] === undefined ? undefined : graph?.layerOf.get(added[0]);
  const info = layer === undefined ? undefined : graph?.layers[layer];
  const at = info ? info.stitches.indexOf(added[0]!) : -1;
  const lead = info && at > 0 && at === info.turningChain.length ? info.stitches.slice(0, at) : [];
  selection = expandSelection(derived.pattern, [...lead, ...added]);
  selectedNode = null;
  selectionAnchor = null;
  draw();
  updateControls();
}

const ACTIONS: Record<string, () => void> = {
  undo: () => {
    history = undo(history);
    cursorMoved = false;
    persist(history.present);
    refresh('Visszavonva.');
  },
  redo: () => {
    history = redo(history);
    cursorMoved = false;
    persist(history.present);
    refresh('Újra.');
  },
  'delete-last': () => commit(deleteLast(history.present), 'Az utolsó lépés törölve.'),
  'select-area': () => setAreaMode(!areaMode),
  'delete-selection': () => void deleteSelection(),
  'duplicate-selection': () => duplicateSelected(),
  same: () => (tool ? commit(workIntoSame(history.present, tool), 'Még egy ugyanabba.') : announce('Előbb válassz szemet.')),
  'fill-row': () =>
    tool && isTargeted(tool)
      ? commit(fillRow(history.present, { def: tool, count: Number(countInput.value) }), 'Sor kitöltve.')
      : announce('Előbb válassz célpontba horgolható szemet a sor kitöltéséhez.'),
  'end-row': () => commit(endRow(history.present, tool), 'Sor vége, fordulás.'),
  'close-round': () => commit(closeRound(history.present), 'Kör zárva.'),
  mirror: () => {
    mirror = !mirror;
    try {
      localStorage.setItem(SETTINGS_KEY, mirror ? 'tukrozott' : 'normal');
    } catch {
      // A nézet beállítása enélkül is működik, csak nem marad meg.
    }
    refresh(mirror ? 'Tükrözött nézet balkezeseknek.' : 'Jobbkezes nézet.');
    fitBoard();
  },
  grid: () => {
    showGrid = !showGrid;
    try {
      localStorage.setItem(GRID_KEY, showGrid ? 'lathato' : 'rejtett');
    } catch {
      // A rács enélkül is kapcsolható, csak újratöltés után nem marad meg.
    }
    refresh(showGrid ? 'Rács bekapcsolva.' : 'Rács kikapcsolva.');
  },
  'zoom-in': () => board.zoom(1.25),
  'zoom-out': () => board.zoom(0.8),
  fit: () => fitBoard(),
  'export-json': () => {
    download(savePattern(withNotation(history.present, notation)), `${slug(history.present.title)}.json`, 'application/json');
    announce('JSON mentve.');
  },
  'import-json': () => importFile.click(),
  'export-svg': () => {
    download(exportSvgText(), `${slug(history.present.title)}.svg`, 'image/svg+xml');
    announce('SVG mentve.');
  },
  'export-png': () => void exportPng(),
  'copy-written': () => void copyWritten(),
  'close-written': () => {
    setWrittenOpen(false);
    writtenToggle.focus();
  },
  new: () => {
    selectedNode = null;
    selection = [];
    commit({ ok: true, pattern: emptyPattern() }, 'Új minta; visszavonással a korábbi visszajön.');
    fitBoard();
  },
  unpin: () => selectedNode && commit(setPinned(history.present, selectedNode, null), 'A jel a számolt helyére került.'),
};

document.addEventListener('click', (event) => {
  const target = (event.target as Element).closest<HTMLElement>('[data-action], [data-nudge]');
  if (!target) return;
  if (target.dataset.nudge) {
    const [dx, dy] = target.dataset.nudge.split(',').map(Number);
    nudge(dx ?? 0, dy ?? 0);
    return;
  }
  ACTIONS[target.dataset.action ?? '']?.();
});

importFile.addEventListener('change', () => {
  const file = importFile.files?.[0];
  importFile.value = '';
  if (file) void importJson(file);
});

titleInput.addEventListener('change', () => {
  const title = titleInput.value.trim();
  if (title !== history.present.title) commit({ ok: true, pattern: { ...history.present, title } }, 'A minta neve módosult.');
});

countInput.addEventListener('change', () => refresh());

/* ---- Legördülő menü (hibalista) ---- */

function openPopover(pop: HTMLElement, button: HTMLButtonElement): void {
  pop.hidden = false;
  button.setAttribute('aria-expanded', 'true');
}

function closePopover(pop: HTMLElement, button: HTMLButtonElement): void {
  pop.hidden = true;
  button.setAttribute('aria-expanded', 'false');
}

function togglePopover(pop: HTMLElement, button: HTMLButtonElement): void {
  if (pop.hidden) openPopover(pop, button);
  else closePopover(pop, button);
}

function closeAllPopovers(): void {
  closePopover(errorsPop, errorToggle);
}

errorToggle.addEventListener('click', () => togglePopover(errorsPop, errorToggle));

// A menün kívülre kattintva a hibalista bezárul.
document.addEventListener('click', (event) => {
  if (!(event.target as Element).closest('.menu')) closeAllPopovers();
});

/* ---- Mintatípus (bal oldali menü) ---- */

const TYPE_ICONS: Readonly<Record<PatternTypeId, string>> = {
  regular:
    '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M4 4h12v12H4zM4 8h12M4 12h12M8 4v12M12 4v12"/></svg>',
  filet:
    '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M4 4h12v12H4zM4 8h12M4 12h12M8 4v12M12 4v12"/><path d="M8 8h4v4H8z" fill="currentColor" stroke="none"/></svg>',
  amigurumi:
    '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 10m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0M10 7a3 3 0 0 1 3 3 3 3 0 0 1-5 2M13 10a4.5 4.5 0 0 1-7.5 3.3"/></svg>',
  irregular:
    '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M6 5c3-1 6 0 7 3s-1 6-4 6-6-2-6-5c0-2 1-3 3-4z"/></svg>',
};

function typeIcon(id: PatternTypeId): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = 'type__icon';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = TYPE_ICONS[id];
  return wrap;
}

function renderTypes(): void {
  typesList.replaceChildren(
    ...PATTERN_TYPES.map((type) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'type';
      button.dataset.type = type.id;
      button.disabled = !type.available;
      button.setAttribute('aria-pressed', String(type.available && type.id === patternType));

      button.append(typeIcon(type.id));
      const label = span('type__label', '');
      label.append(span('type__name', type.name), span('type__detail', type.detail));
      button.append(label);
      if (!type.available) button.append(span('type__badge', 'Hamarosan'));
      else button.addEventListener('click', () => selectType(type.id));

      item.append(button);
      return item;
    }),
  );
}

function selectType(id: PatternTypeId): void {
  patternType = id;
  try {
    localStorage.setItem(TYPE_KEY, id);
  } catch {
    // A választás enélkül is érvényes, csak újratöltés után nem marad meg.
  }
  for (const button of typesList.querySelectorAll<HTMLButtonElement>('.type')) {
    button.setAttribute('aria-pressed', String(button.dataset.type === id));
  }
  const type = PATTERN_TYPES.find((candidate) => candidate.id === id);
  // A rács típusa a mintatípussal együtt vált (PQW-874).
  refresh();
  if (type) announce(`Mintatípus: ${type.name}. ${type.detail}`);
}

typesToggle.addEventListener('click', () => setOpen(typesNav, typesToggle, typesNav.hasAttribute('hidden')));

toggle.addEventListener('click', () => {
  const open = panel.hasAttribute('hidden');
  setOpen(panel, toggle, open);
  if (open && NARROW.matches && !written.hidden) setWrittenOpen(false);
});

writtenToggle.addEventListener('click', () => {
  const open = written.hasAttribute('hidden');
  setWrittenOpen(open);
  if (open && NARROW.matches) setOpen(panel, toggle, false);
});

/* ---- Egér és érintés ---- */

type Drag =
  | { readonly kind: 'node'; readonly id: NodeId; readonly start: Point; readonly base: Point; moved: boolean }
  | { readonly kind: 'pan'; last: Point }
  | { readonly kind: 'area'; readonly from: Point; readonly additive: boolean };
let drag: Drag | null = null;

canvas.addEventListener('pointerdown', (event) => {
  canvas.focus({ preventScroll: true });
  // A sorszám önálló célterület: a teljes sort vagy kört jelöli ki, Shift-tel a kijelöléshez adja (PQW-875).
  const label = board.labelAt(event.clientX, event.clientY);
  if (label !== null) {
    if (tool) select(null);
    const layer = derived.layout.layers.find((candidate) => candidate.index === label);
    const ids = layerSelection(history.present, label);
    selectionAnchor = ids[0] ?? null;
    const name = `${label}. ${layer?.shape === 'round' ? 'kör' : 'sor'}`;
    setSelection(event.shiftKey ? [...selection, ...ids] : ids, null, `${name} kijelölve: ${layer?.stitchCount ?? 0} szem.`);
    return;
  }
  if (tool) {
    if (!isTargeted(tool)) {
      void workAtCursor();
      return;
    }
    // A rácson a cella dönt; ahol nincs mibe horgolni, üzenet jön, és nem kerül le szem (PQW-874).
    const aim = board.aimUnder(event.clientX, event.clientY);
    if (typeof aim === 'string') announce(aim);
    const index = typeof aim === 'number' ? aim : null;
    if (index === null) {
      drag = { kind: 'pan', last: { x: event.clientX, y: event.clientY } };
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    cursor = index;
    cursorMoved = true;
    void workAtCursor();
    return;
  }
  const id = board.nodeAt(event.clientX, event.clientY);
  canvas.setPointerCapture(event.pointerId);
  // Terület: a menüsor kijelölés-gombjával, vagy Shift-tel üres helyről húzva.
  if (areaMode || (event.shiftKey && !id)) {
    const from = board.toChart(event.clientX, event.clientY);
    drag = { kind: 'area', from, additive: event.shiftKey };
    marquee = { from, to: from };
    return;
  }
  if (!id) {
    selectedNode = null;
    selection = [];
    selectionAnchor = null;
    drag = { kind: 'pan', last: { x: event.clientX, y: event.clientY } };
    refresh();
    return;
  }
  if (event.shiftKey) {
    selectionAnchor ??= id;
    const next = toggleUnit(history.present, selection, id);
    setSelection(next, next.includes(id) ? id : null);
    return;
  }
  selectionAnchor = id;
  // A már kijelölt szemre kattintva a kijelölés megmarad, így törölhető vagy duplikálható.
  setSelection(selection.includes(id) ? selection : [id], id);
  const pinned = history.present.pieces[0]?.stitches.find((n) => n.id === id)?.pinned;
  drag = { kind: 'node', id, start: board.toChart(event.clientX, event.clientY), base: { x: pinned?.x ?? 0, y: pinned?.y ?? 0 }, moved: false };
});

canvas.addEventListener('pointermove', (event) => {
  if (drag?.kind === 'area') {
    marquee = { from: drag.from, to: board.toChart(event.clientX, event.clientY) };
    draw();
    return;
  }
  if (drag?.kind === 'pan') {
    board.pan(event.clientX - drag.last.x, event.clientY - drag.last.y);
    drag.last = { x: event.clientX, y: event.clientY };
    return;
  }
  if (drag?.kind === 'node') {
    const p = board.toChart(event.clientX, event.clientY);
    const dx = (p.x - drag.start.x) * (mirror ? -1 : 1);
    const result = setPinned(history.present, drag.id, { x: drag.base.x + dx, y: drag.base.y + p.y - drag.start.y });
    if (result.ok) {
      drag.moved = true;
      preview = result.pattern;
      refresh();
    }
    return;
  }
  if (!tool || !isTargeted(tool)) return;
  const aim = board.aimUnder(event.clientX, event.clientY);
  const index = typeof aim === 'number' ? aim : null;
  if (index !== hover) {
    hover = index;
    refresh();
  }
});

function endDrag(event: PointerEvent): void {
  if (drag?.kind === 'area') {
    const { from, additive } = drag;
    const to = marquee?.to ?? from;
    drag = null;
    marquee = null;
    // Húzás nélkül kattintás: a szem kijelölése, üres helyen a kijelölés megszüntetése.
    if (Math.hypot(to.x - from.x, to.y - from.y) * board.scale < 4) {
      const id = board.nodeAt(event.clientX, event.clientY);
      if (id) {
        selectionAnchor = id;
        const next = additive ? toggleUnit(history.present, selection, id) : [id];
        setSelection(next, id);
      } else if (additive) draw();
      else setSelection([], null);
      return;
    }
    const inside = nodesInRect(history.present, derived.layout, from, to);
    setSelection(additive ? [...selection, ...inside] : inside, null, inside.length === 0 ? 'A téglalapban nincs szem.' : undefined);
    return;
  }
  if (drag?.kind === 'node' && drag.moved && preview) {
    const pattern = preview;
    preview = null;
    commit({ ok: true, pattern }, 'Jel eltolva.');
  }
  preview = null;
  drag = null;
}

canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('pointerleave', () => {
  if (hover !== null && !drag) {
    hover = null;
    refresh();
  }
});

canvas.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) board.zoom(event.deltaY < 0 ? 1.1 : 0.9);
    else board.pan(-event.deltaX, -event.deltaY);
  },
  { passive: false },
);

/* ---- Billentyűk ---- */

function moveCursor(step: number): void {
  const { targets } = derived;
  if (targets.length === 0) return;
  cursor = Math.max(0, Math.min(targets.length - 1, cursor + step));
  cursorMoved = true;
  refresh(describeTarget(cursor));
  showPoint(targets[cursor]!.point);
}

/** Billentyűzetes kijelölés: a fókusz a következő szemre, Shift-tel a tartomány a kezdőszemtől (PQW-875). */
function moveFocus(move: FocusMove, extend: boolean): void {
  const focus = stepFocus(history.present, derived.layout, selectedNode ?? selection[selection.length - 1] ?? null, move);
  if (!focus) {
    announce('A minta üres: nincs mit kijelölni.');
    return;
  }
  if (extend) {
    selectionAnchor ??= selectedNode ?? focus;
    setSelection(rangeSelection(history.present, selectionAnchor, focus), focus);
  } else {
    selectionAnchor = focus;
    setSelection([focus], focus);
  }
  const point = derived.layout.nodes.get(focus)?.top;
  if (point) showPoint(point);
}

document.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement;
  // A nyitott párbeszédablak a saját gombjaival és az Esc-kel dolgozik.
  if (target.closest('input, textarea, select, dialog')) return;
  const key = event.key;

  // A nyitott hibalistát az Escape először bezárja, és a fókuszt visszaviszi a gombra.
  if (key === 'Escape' && !errorsPop.hidden) {
    event.preventDefault();
    closeAllPopovers();
    errorToggle.focus();
    return;
  }

  // A nyilak, a Home, az End és az Enter a vásznon vagy az oldal szintjén dolgoznak, gombon nem.
  const onBoard = target === canvas || target === document.body;
  // Az írott minta szövegét a böngésző saját másolása kezeli.
  const inWritten = target.closest('#written') !== null;

  if ((event.ctrlKey || event.metaKey) && !event.altKey) {
    const lower = key.toLowerCase();
    if (lower === 'z') {
      event.preventDefault();
      ACTIONS[event.shiftKey ? 'redo' : 'undo']!();
    } else if (lower === 'y') {
      event.preventDefault();
      ACTIONS.redo!();
    } else if (lower === 'a' && onBoard) {
      event.preventDefault();
      if (tool) select(null);
      setSelection(selectAll(history.present), null);
    } else if (lower === 'c' && !inWritten && selection.length > 0) {
      event.preventDefault();
      copySelected();
    } else if (lower === 'v' && !inWritten) {
      event.preventDefault();
      pasteClipboard();
    } else if (lower === 'd' && !inWritten) {
      event.preventDefault();
      duplicateSelected();
    }
    return;
  }

  if (event.altKey) {
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] };
    const delta = arrows[key];
    if (delta && selectedNode) {
      event.preventDefault();
      nudge(...delta);
    }
    return;
  }

  const { targets } = derived;
  const forward = targets.length > 1 && targets[targets.length - 1]!.point.x < targets[0]!.point.x ? -1 : 1;

  switch (key) {
    case 'Escape':
      select(null);
      selectedNode = null;
      selection = [];
      selectionAnchor = null;
      if (areaMode) setAreaMode(false);
      else refresh();
      return;
    case 'Backspace':
    case 'Delete':
      event.preventDefault();
      // Kijelöléssel a kijelölt szemek, anélkül az utolsó lépés (PQW-875).
      if (selection.length > 0) void deleteSelection();
      else ACTIONS['delete-last']!();
      return;
    case 'f':
    case 'F':
      // Shift+F kitölti a sort, sima F a sor végén fordul (PQW-879).
      ACTIONS[event.shiftKey ? 'fill-row' : 'end-row']!();
      return;
    case 'k':
    case 'K':
      ACTIONS['close-round']!();
      return;
    case 'm':
    case 'M':
      ACTIONS.mirror!();
      return;
    case 'r':
    case 'R':
      ACTIONS.grid!();
      return;
  }

  if (onBoard) {
    // Szem nélkül a nyilak a szemek között jelölnek ki; kijelölés nélkül, teli vágólappal a beillesztés kurzorát viszik (PQW-875).
    const moves: Record<string, FocusMove> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Home: 'first', End: 'last' };
    const move = moves[key];
    if (move && tool === null && (selection.length > 0 || clipboard === null)) {
      event.preventDefault();
      moveFocus(move, event.shiftKey);
      return;
    }
    const steps: Record<string, number> = {
      ArrowRight: forward,
      ArrowLeft: -forward,
      ArrowUp: 1,
      ArrowDown: -1,
      Home: -Infinity,
      End: Infinity,
    };
    if (key in steps) {
      event.preventDefault();
      const step = steps[key]!;
      moveCursor(Number.isFinite(step) ? step : step > 0 ? targets.length : -targets.length);
      return;
    }
    if (key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) ACTIONS.same!();
      else void workAtCursor();
      return;
    }
  }

  const item = items.find((candidate) => candidate.key === key);
  if (item) select(item.def.id);
});

/* ---- Indulás ---- */

syncNotationControls();
renderTypes();
renderPalette();
setOpen(typesNav, typesToggle, !NARROW.matches);
setOpen(panel, toggle, !NARROW.matches);
setOpen(written, writtenToggle, readWrittenOpen() && !NARROW.matches);
select(null);
fitBoard();
alignTooltips(must<HTMLElement>('.tools'));
setupConsentBanner(GA_MEASUREMENT_ID);

// Böngészős tesztekhez (PQW-874): a rács cellái és a sorszámok az ablakban; csak automatizált böngészőben.
if (navigator.webdriver) {
  Object.assign(window, {
    mintatervezoRacs: { layer: () => derived.context.layer, cells: () => board.gridCells(), labels: () => board.labels() },
    // A szemek helye és a kijelölés (PQW-875).
    mintatervezoKijeloles: {
      selection: () => [...selection],
      nodes: () => [...derived.layout.nodes.values()].map((node) => ({ id: node.id, def: node.def, layer: node.layer, ...board.toClient(node.top) })),
    },
  });
}
