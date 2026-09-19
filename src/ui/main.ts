// KB: interface.md §2

import './styles.css';
import { GA_MEASUREMENT_ID } from '../config.js';
import {
  canCloseRound,
  canEndRound,
  canEndRow,
  canJoinChainRing,
  closeRound,
  contextOf,
  defaultCursor,
  deleteLast,
  type EditorMode,
  type EditResult,
  emptyPattern,
  endRoundSpiral,
  endRow,
  fillRow,
  insertChain,
  type LiveCheck,
  liveCheck,
  onFoundationChain,
  pieceFinished,
  setPinned,
  setTradition,
  type WorkContext,
  withoutStaleSkips,
  work,
  workIntoGap,
  workIntoSame,
} from '../core/editor.js';
import { type ChartGrid, chartGrid, type GridSeam, targetPoint } from '../core/grid.js';
import { canRedo, canUndo, createHistory, type History, record, redo, undo } from '../core/history.js';
import { nodeInsertions } from '../core/insertion.js';
import { isIrregularJson } from '../core/irregular-json.js';
import { NUDGE_STEP, NUDGE_STEP_LARGE } from '../core/irregular-types.js';
import { type ChartLayout, layoutPattern, type Point } from '../core/layout.js';
import { loadPattern, savePattern } from '../core/pattern-json.js';
import { aspectStem, gaugeContextOf } from '../core/pattern-size.js';
import { roundEndFor } from '../core/rounds.js';
import {
  copySelection,
  deleteStitches,
  deletionPlan,
  describeByLayer,
  duplicateSelection,
  expandSelection,
  type FocusMove,
  type Fragment,
  layerSelection,
  nodesInRect,
  pasteFragment,
  rangeSelection,
  selectAll,
  stepFocus,
  toggleUnit,
} from '../core/selection.js';
import { libraryFor, resolveStitch } from '../core/stitch-variants.js';
import { stitchName } from '../core/stitchText.js';
import { traditionOf } from '../core/tradition.js';
import type {
  Finding,
  Locale,
  NodeId,
  Pattern,
  PatternNotation,
  StitchDef,
  StitchDefId,
  Tradition,
} from '../core/types.js';
import { validatePattern } from '../core/validate.js';
import { AmigurumiPanel } from './amigurumi-panel.js';
import { type Area, Board, type DirectionArrow, type Target } from './board.js';
import { chartSvg } from './chart-svg.js';
import { setupConsentBanner } from './consentBanner.js';
import { askConfirm } from './dialog.js';
import { GarmentPanel } from './garment-panel.js';
import { GridChartPanel } from './grid-chart-panel.js';
import { spikeNodes, unitFrames } from './grid-chart-view.js';
import { EDITOR_CORE_TEXTS } from './i18n/core/editor.js';
import { JSON_CORE_TEXTS } from './i18n/core/json.js';
import { renderCoreText } from './i18n/core/render.js';
import { RULE_TEXTS, type RuleText } from './i18n/rules.js';
import {
  applyStaticTexts,
  homeUrl,
  resolveUiLanguage,
  setUiLanguage,
  texts,
  type UiLanguage,
  uiLanguage,
  urlWithLanguage,
} from './i18n.js';
import { InsertionPanel } from './insertion-panel.js';
import { insertionSuffix } from './insertion-view.js';
import { IrregularEditor } from './irregular-editor.js';
import {
  chartStyleLabel,
  defaultNotation,
  notationForTradition,
  readNotation,
  setTermsLocale,
  symbolOptionsFor,
  termsLabel,
  textLanguage,
  traditionLabel,
  withNotation,
  writeNotation,
} from './notation.js';
import { buildPalette, type PaletteItem } from './palette.js';
import {
  DEFAULT_PATTERN_TYPE,
  gridKind,
  isAvailableType,
  PATTERN_TYPES,
  type PatternTypeId,
  writtenShareFor,
} from './pattern-types.js';
import { currentPlatform, modifierCombo, modifierName } from './platform.js';
import { RoundsPanel } from './rounds-panel.js';
import { relabelSelects } from './select-labels.js';
import { ShapesPanel } from './shapes-panel.js';
import { ShawlsPanel } from './shawls-panel.js';
import { SizePanel } from './size-panel.js';
import {
  applyInk,
  drawCentered,
  readInk,
  type SymbolOptions,
  shapeBounds,
  stemLength,
  symbolShapes,
} from './symbols.js';
import { alignTooltips } from './tooltip.js';
import { writtenView } from './written.js';
import { dragCollapses, dragSize, isFull, keySize, percentOf, type SizeRange, statusPlace } from './written-size.js';

function must<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Hiányzó elem a dokumentumban: ${selector}`);
  return el;
}

const canvas = must<HTMLCanvasElement>('#board');
const irregularCanvas = must<HTMLCanvasElement>('#board-irregular');
const board = new Board(canvas);
const palette = must<HTMLDivElement>('#palette');
const panel = must<HTMLElement>('#panel');
const toggle = must<HTMLButtonElement>('#panel-toggle');
const hint = must<HTMLParagraphElement>('#hint');
const status = must<HTMLParagraphElement>('#status');
const alertBox = must<HTMLParagraphElement>('#alert');
const countField = must<HTMLElement>('#count-field');
const countInput = must<HTMLInputElement>('#chain-count');
const summary = must<HTMLParagraphElement>('#summary');
const findingList = must<HTMLUListElement>('#findings');
const titleInput = must<HTMLInputElement>('#title');
const importFile = must<HTMLInputElement>('#import-file');
const adjust = must<HTMLElement>('#adjust');
const adjustName = must<HTMLParagraphElement>('#adjust-name');
const stage = must<HTMLElement>('.stage');
const written = must<HTMLElement>('#written');
const writtenToggle = must<HTMLButtonElement>('#written-toggle');
const writtenText = must<HTMLPreElement>('#written-text');
const writtenNotices = must<HTMLDivElement>('#written-notices');
const writtenBody = must<HTMLDivElement>('#written-body');
const writtenGrip = must<HTMLDivElement>('#written-grip');
const writtenFull = must<HTMLButtonElement>('#written-full');
const termsSelect = must<HTMLSelectElement>('#terms');
const styleSelect = must<HTMLSelectElement>('#chart-style');
const traditionSelect = must<HTMLSelectElement>('#tradition');
const typesNav = must<HTMLElement>('#types');
const typesToggle = must<HTMLButtonElement>('#types-toggle');
const typesList = must<HTMLUListElement>('#types-list');
const errorToggle = must<HTMLButtonElement>('#error-toggle');
const errorCount = must<HTMLElement>('#error-count');
const errorsPop = must<HTMLElement>('#errors');
const fileToggle = must<HTMLButtonElement>('#file-toggle');
const filePop = must<HTMLElement>('#file-pop');
const exportGrid = must<HTMLInputElement>('#export-grid');
const insertionPanel = new InsertionPanel(must<HTMLFieldSetElement>('#insertion'));
const languageSelect = document.querySelector<HTMLSelectElement>('#ui-language');
const homeLink = document.querySelector<HTMLAnchorElement>('#home-link, .home');

const STORAGE_KEY = 'dc-mintatervezo:minta';
const NOTATION_KEY = 'dc-mintatervezo:jeloles';
const WRITTEN_KEY = 'dc-mintatervezo:irott-minta';
const TYPE_KEY = 'dc-mintatervezo:tipus';
const GRID_KEY = 'dc-mintatervezo:racs';
// KB: interface.md §5
const TYPES_KEY = 'dc-mintatervezo:mintatipus';
const LANG_KEY = 'dc-mintatervezo:nyelv';
// Below this width the two panels do not fit side by side.
const NARROW = window.matchMedia('(width < 48rem)');
const STRUCTURAL_RULES = new Set(['unknown-stitch', 'dangling-reference', 'yarn-path']);

// KB: interface.md §4 — this block must run before the state: restoring the pattern and the
// notation default already use the interface language.
const startLanguage = resolveUiLanguage(location.search, storedUiLanguage(), document.documentElement.lang);
setUiLanguage(startLanguage);
document.documentElement.lang = startLanguage;
applyStaticTexts(document, texts().markup);
showModifierNames();
if (homeLink) homeLink.href = homeUrl(startLanguage);

type Message = string | readonly (string | Node)[];

const NAME_SLOT = '\u0001';

// KB: interface.md §3
function withStitchName(sentence: (name: string) => string, name: string, marked = true): readonly (string | Node)[] {
  const parts = marked ? sentence(NAME_SLOT).split(NAME_SLOT) : [];
  if (parts.length < 2) return [sentence(name)];
  const nodes: (string | Node)[] = [parts[0]!];
  for (const part of parts.slice(1)) {
    const element = document.createElement('span');
    element.lang = textLanguage(notation.terms);
    element.textContent = name;
    nodes.push(element, part);
  }
  return nodes;
}

let history: History<Pattern> = createHistory(restore());
let tool: StitchDefId | null = null;
let cursor = 0;
let cursorMoved = false;
let hover: number | null = null;
let seam: GridSeam | null = null;
let selectedNode: NodeId | null = null;
let selection: readonly NodeId[] = [];
let selectionAnchor: NodeId | null = null;
let clipboard: Fragment | null = null;
let areaMode = false;
let marquee: { readonly from: Point; readonly to: Point } | null = null;
let affected: readonly NodeId[] = [];
// KB: interface.md §30
const mirror = false;
let patternType: PatternTypeId = readType();
let showGrid = readGrid();
// KB: interface.md §5 — not persisted; that would need a new key.
let aspect = false;
let notation = readStoredNotation();
let symbols: SymbolOptions = symbolOptionsFor(notation);
let preview: Pattern | null = null;

interface Derived {
  readonly pattern: Pattern;
  readonly context: WorkContext;
  readonly layout: ChartLayout;
  readonly check: LiveCheck;
  readonly targets: readonly Target[];
  readonly grid: ChartGrid | null;
}

let derived = derive(history.present);

function derive(pattern: Pattern): Derived {
  const context = contextOf(pattern, editorMode());
  const stem = stemFor(pattern, context);
  const layout = layoutPattern(pattern, context.library, { mirror, stemLength: stem });
  const check = liveCheck(pattern, context);
  const targets = context.slots.map((_, i) => ({ point: targetPoint(layout, context, i) ?? { x: 0, y: 0 } }));
  const grid = showGrid
    ? chartGrid(pattern, context.library, gridKindOf(context), context, { mirror, stemLength: stem })
    : null;
  return { pattern, context, layout, check, targets, grid };
}

function stemFor(pattern: Pattern, context: WorkContext): (chainHeight: number) => number {
  if (!aspect) return stemLength;
  return aspectStem(gaugeContextOf(pattern, context.library), context.graph?.layers[0]?.shape ?? context.shape);
}

function gridKindOf(context: WorkContext) {
  return gridKind(patternType, context.graph?.layers[0]?.shape ?? context.shape);
}

// KB: interface.md §18
function directionArrow(): DirectionArrow | null {
  const { layout, context } = derived;
  if (context.shape === 'round') return null;
  const active = layout.layers.find((layer) => layer.index === context.layer);
  if (active) return { from: active.start, to: active.end };
  // KB: 03 §1.2 — row 1 is not in the graph yet; it starts from the foundation, right to left.
  const base = layout.layers.find((layer) => layer.index === 0);
  if (context.layer === 1 && base && base.shape === 'row') return { from: base.end, to: base.start };
  // KB: interface.md §18 — a just-opened row is not in the layout either; reverse the row below.
  const below = layout.layers.find((layer) => layer.index === context.layer - 1);
  if (below && below.shape === 'row') return { from: below.end, to: below.start };
  return null;
}

// KB: interface.md §18, §19 — reference identity is the key; do not replace it with a copy.
let turnedOn: Pattern | null = null;

function nextRowMarker(): { text: string; layer: number } | null {
  const { context } = derived;
  if (!context.graph || context.started || context.turningChain > 0 || pieceFinished(context.graph)) return null;
  if (onFoundationChain(context) && turnedOn !== history.present) return null;
  return { text: capitalize(layerName(context)), layer: context.layer };
}

function editorMode(): EditorMode {
  return { roundsOnChain: patternType === 'amigurumi' };
}

function restore(): Pattern {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    return emptyPattern();
  }
  if (!saved) return emptyPattern();
  const loaded = loadPattern(saved);
  if (loaded.ok && structuralProblem(loaded.pattern) === null) return withoutStaleSkips(loaded.pattern);
  try {
    localStorage.setItem(`${STORAGE_KEY}:hibas`, saved);
  } catch {
    // KB: interface.md §5
  }
  queueMicrotask(() => announce(texts().messages.storage.broken));
  return emptyPattern();
}

function persist(pattern: Pattern): void {
  try {
    localStorage.setItem(STORAGE_KEY, savePattern(withNotation(pattern, notation)));
  } catch {
    announce(texts().messages.storage.saveFailed);
  }
}

function storedNotation(): string | null {
  try {
    return localStorage.getItem(NOTATION_KEY);
  } catch {
    return null;
  }
}

function readStoredNotation(): PatternNotation {
  return readNotation(storedNotation(), uiLanguage());
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

function ruleText(rule: string): RuleText | undefined {
  return (RULE_TEXTS[uiLanguage()] as Readonly<Record<string, RuleText | undefined>>)[rule];
}

function structuralProblem(pattern: Pattern): string | null {
  const finding = validatePattern(pattern, libraryFor(pattern)).find((f) => STRUCTURAL_RULES.has(f.rule));
  return finding ? (ruleText(finding.rule)?.message ?? finding.rule) : null;
}

const insetRight = () => (panel.hidden ? 0 : panel.getBoundingClientRect().width);
const insetLeft = () => (typesNav.hidden ? 0 : typesNav.getBoundingClientRect().width);
const insetBottom = () =>
  written.hidden ? 0 : Math.max(0, canvas.getBoundingClientRect().bottom - written.getBoundingClientRect().top);
const fitBoard = () => board.fit(insetRight(), insetLeft(), insetBottom());
// The free-form editor is built when the type is first chosen (PQW-963).
let irregular: IrregularEditor | null = null;
const showPoint = (point: Point) => board.ensureVisible(point, insetRight(), insetLeft(), insetBottom());

function visibleArea(): Area {
  const { width, height } = canvas.getBoundingClientRect();
  return { left: insetLeft(), top: 0, right: width - insetRight(), bottom: height - insetBottom() };
}

const cursorPoint = (): Point | undefined => (tool && isTargeted(tool) ? derived.targets[cursor]?.point : undefined);

function refresh(message?: Message): void {
  // KB: interface.md §9 — the free-form type draws itself; the regular pipeline stays out of it.
  if (irregular?.active === true) {
    irregular.refresh();
    if (message !== undefined) announce(message);
    return;
  }
  derived = derive(preview ?? history.present);
  if (!cursorMoved) cursor = defaultCursor(derived.pattern, derived.context, tool);
  // Past the row's last target the cursor sits outside the list, where it does not crochet.
  cursor = Math.max(0, Math.min(cursor, derived.targets.length));
  if (selectedNode && !derived.layout.nodes.has(selectedNode)) selectedNode = null;
  selection = selection.filter((id) => derived.layout.nodes.has(id));
  draw();
  traditionSelect.value = traditionOf(derived.pattern.conventions);
  updateControls();
  updateWritten();
  sizePanel.update(derived.pattern, derived.context.graph, derived.context.library);
  roundsPanel.update(derived.pattern);
  shapesPanel.update(derived.pattern);
  shawlsPanel.update(derived.pattern);
  garmentPanel.update(derived.pattern);
  // KB: interface.md §9 — a disabled type has no panel at all.
  amigurumiPanel?.update(derived.pattern);
  gridPanel?.update(derived.pattern, mirror);
  if (message !== undefined) announce(message);
}

// KB: decisions.md §4, interface.md §20
const HIGHLIGHT_MS = 5000;
let highlighted: readonly NodeId[] = [];
let highlightTimer: ReturnType<typeof setTimeout> | undefined;

function highlightFinding(nodes: readonly NodeId[]): void {
  clearTimeout(highlightTimer);
  highlighted = nodes;
  draw();
  highlightTimer = setTimeout(() => {
    highlighted = [];
    draw();
  }, HIGHLIGHT_MS);
}

function draw(): void {
  const pasting = tool === null && clipboard !== null && selection.length === 0;
  const aiming = (tool !== null && isTargeted(tool)) || pasting;
  // KB: interface.md §15
  board.setInsets(insetLeft(), insetRight());
  board.setScene({
    layout: derived.layout,
    library: derived.context.library,
    targets: aiming ? derived.targets : [],
    hover,
    seam: seam?.at ?? null,
    selected: selectedNode,
    selection,
    affected,
    marquee,
    highlight: highlighted,
    grid: derived.grid,
    tradition: traditionOf(derived.pattern.conventions),
    // KB: interface.md §18 — not tied to stitch selection; it must show right after a turn.
    direction: directionArrow(),
    nextRow: nextRowMarker(),
    symbols,
    insertions: nodeInsertions(derived.pattern.pieces[0]),
    unitFrames: unitFrames(derived.pattern, derived.layout, mirror),
    spikes: spikeNodes(derived.pattern),
  });
}

function isTargeted(id: StitchDefId): boolean {
  const kind = resolveStitch(id)?.kind;
  return kind !== 'chain' && kind !== 'space' && kind !== 'ring' && kind !== 'picot';
}

// KB: interface.md §28
function isPlaced(id: StitchDefId): boolean {
  const kind = resolveStitch(id)?.kind;
  return isTargeted(id) || kind === 'chain' || kind === 'space';
}

function withProgress(message: Message): Message {
  const tail = progress();
  if (typeof message === 'string') {
    if (message === '') return tail;
    return tail === '' ? message : `${message} ${tail}`;
  }
  return tail === '' ? message : [...message, ` ${tail}`];
}

function commit(result: EditResult, message: Message): void {
  if (!result.ok) {
    announce(renderCoreText(EDITOR_CORE_TEXTS[uiLanguage()], result.reason));
    return;
  }
  // KB: interface.md §19 — an unchanged pattern (a turn on the foundation) is not an undo step.
  if (result.pattern === history.present) {
    announce(withProgress(message));
    return;
  }
  history = record(history, result.pattern);
  cursorMoved = false;
  persist(history.present);
  // Recompute first, so the status line already describes the new pattern.
  refresh();
  announce(withProgress(message));
  const point = cursorPoint() ?? lastTop();
  if (point) showPoint(point);
}

function lastTop(): Point | undefined {
  const last = derived.pattern.pieces[0]?.stitches.at(-1);
  return last ? derived.layout.nodes.get(last.id)?.top : undefined;
}

// KB: decisions.md §4, interface.md §20
function announce(message: Message): void {
  if (typeof message === 'string') status.textContent = message;
  else status.replaceChildren(...message);
}

function layerName(context: WorkContext): string {
  return texts().messages.layer.name(context.layer, context.shape === 'round' || context.oval);
}

function progress(): string {
  const { context, check } = derived;
  if (!context.graph) return '';
  if (pieceFinished(context.graph)) return '';
  const progressTexts = texts().messages.progress;
  if (!context.started) return progressTexts.next(capitalize(layerName(context)));
  const count = context.graph.layers[context.layer]?.writtenCount ?? 0;
  const rest = check.remaining > 0 ? progressTexts.remaining(check.remaining) : '';
  return `${progressTexts.current(capitalize(layerName(context)), count, rest)}${roundEndHint(context, check)}`;
}

function roundEndHint(context: WorkContext, check: LiveCheck): string {
  if (check.remaining > 0 || !canEndRound(context) || context.slots.some((slot) => slot.kind === 'ring')) return '';
  return roundEndFor(derived.pattern.conventions.roundEnd, patternType === 'amigurumi') === 'spiral'
    ? texts().messages.progress.spiralHint
    : texts().messages.progress.closeHint;
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('hu') + text.slice(1);
}

function describeTarget(index: number): Message {
  const target = texts().messages.target;
  const slot = derived.context.slots[index];
  if (!slot) return derived.context.slots.length > 0 ? target.rowEnd : target.none;
  let what: string;
  // KB: interface.md §3
  let named = false;
  if (slot.kind === 'space') what = target.space(slot.chains.length);
  else if (slot.kind === 'ring') what = target.ring;
  else if (slot.kind === 'underside') what = target.underside;
  else {
    const def = derived.context.graph?.defs.get(slot.id);
    what = def ? stitchName(def, notation.terms) : target.stitch;
    named = def !== undefined;
  }
  const used = derived.context.used[index] ? target.used : '';
  return withStitchName((name) => target.at(index + 1, derived.context.slots.length, name, used), what, named);
}

// KB: interface.md §20
const ALERT_MS = 3000;
let alertTimer: ReturnType<typeof setTimeout> | undefined;
let shownWarnings = '';

function showNewWarning(findings: readonly Finding[]): void {
  const warnings = findings.filter((finding) => finding.severity === 'warning');
  const key = warnings.map((finding) => `${finding.rule}:${finding.nodes.join(',')}`).join('|');
  if (key === shownWarnings) return;
  shownWarnings = key;
  clearTimeout(alertTimer);
  const first = warnings[0];
  if (!first) {
    alertBox.hidden = true;
    return;
  }
  // The dictionary label already ends in a colon; do not add another.
  showToast(`${texts().messages.findings.warning}${ruleText(first.rule)?.message ?? first.rule}`);
}

function showToast(text: string): void {
  if (text.trim() === '') return;
  clearTimeout(alertTimer);
  alertBox.textContent = text;
  alertBox.hidden = false;
  alertTimer = setTimeout(() => {
    alertBox.hidden = true;
  }, ALERT_MS);
}

function updateControls(): void {
  if (irregular !== null && irregular.active) {
    updateIrregularControls(irregular);
    return;
  }
  const { context, pattern, check } = derived;
  const empty = (pattern.pieces[0]?.stitches.length ?? 0) === 0;
  setDisabled('undo', !canUndo(history));
  setDisabled('redo', !canRedo(history));
  const canFill =
    tool !== null && isTargeted(tool) && context.graph !== null && context.slots.some((_, i) => !context.used[i]);
  setDisabled('fill-row', !canFill);
  setDisabled('end-row', !canEndRow(context));
  setDisabled('close-round', !canCloseRound(pattern, context));
  setDisabled('spiral-round', !canEndRound(context));
  setDisabled('export-png', empty);
  setDisabled('export-svg', empty);
  setDisabled('delete-selection', selection.length === 0);
  setDisabled('duplicate-selection', selection.length === 0);
  must<HTMLButtonElement>('[data-action="select-area"]').setAttribute('aria-pressed', String(areaMode));
  must<HTMLButtonElement>('[data-action="grid"]').setAttribute('aria-pressed', String(showGrid));
  if (document.activeElement !== titleInput) titleInput.value = pattern.title;

  const layers = context.graph ? context.graph.layers.length - 1 : 0;
  const errors = check.findings.filter((f) => f.severity === 'error').length;
  const warnings = check.findings.length - errors;
  showNewWarning(check.findings);
  const errorBar = texts().messages.errorBar;
  errorCount.textContent =
    check.findings.length === 0
      ? errorBar.none
      : [errors ? errorBar.errors(errors) : '', warnings ? errorBar.warnings(warnings) : '']
          .filter(Boolean)
          .join(' · ');
  errorToggle.classList.toggle('has-errors', errors > 0);
  errorToggle.classList.toggle('has-warnings', errors === 0 && warnings > 0);
  const summaryTexts = texts().messages.summary;
  const parts = [
    empty ? summaryTexts.empty : `${texts().messages.layer.count(layers, context.shape === 'round')}. ${progress()}`,
    check.findings.length === 0 ? summaryTexts.clean : summaryTexts.counts(errors, warnings),
  ];
  summary.textContent = parts.join(' ');

  findingList.replaceChildren(
    ...check.findings.map((finding) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `finding${finding.severity === 'warning' ? ' finding--warning' : ''}`;
      const findings = texts().messages.findings;
      const severity = span('finding__severity', finding.severity === 'error' ? findings.error : findings.warning);
      const rule = ruleText(finding.rule);
      // KB: decisions.md §3
      button.append(
        severity,
        rule?.message ?? finding.rule,
        span('finding__count', findings.nodes(finding.nodes.length)),
      );
      button.addEventListener('click', () => {
        const first = finding.nodes.find((id) => derived.layout.nodes.has(id));
        if (!first) return;
        // KB: interface.md §20
        closePopover(errorsPop, errorToggle);
        showPoint(derived.layout.nodes.get(first)!.top);
        highlightFinding(finding.nodes);
        announce(findings.marked);
      });
      item.append(button);
      return item;
    }),
  );

  const node = selectedNode ? derived.pattern.pieces[0]?.stitches.find((n) => n.id === selectedNode) : undefined;
  adjust.hidden = !node || tool !== null;
  if (node) {
    const nodeDef = derived.context.library.get(node.def);
    // KB: interface.md §3
    const name = document.createElement('span');
    name.lang = textLanguage(notation.terms);
    name.textContent = nodeDef ? capitalize(stitchName(nodeDef, notation.terms)) : node.def;
    adjustName.replaceChildren(name, ...(node.pinned ? [texts().messages.adjust.pinned] : []));
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

function setHint(message: Message): void {
  if (typeof message === 'string') hint.textContent = message;
  else hint.replaceChildren(...message);
}

function updateWritten(): void {
  // While dragging only the symbol's position changes, not the text.
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
    announce(texts().messages.written.copied);
  } catch {
    const range = document.createRange();
    range.selectNodeContents(writtenText);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    writtenText.focus();
    announce(texts().messages.written.copyFailed);
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
    // KB: interface.md §5
  }
  updateWritten();
}

// KB: interface.md §10 — closed by default, and never opened on an empty pattern, stored state or not.
function readWrittenOpen(): boolean {
  if ((history.present.pieces[0]?.stitches.length ?? 0) === 0) return false;
  try {
    const stored = localStorage.getItem(WRITTEN_KEY);
    if (stored !== null) return stored !== 'zarva';
  } catch {
    // KB: interface.md §5
  }
  return false;
}

// KB: interface.md §5, §13 — `null` means the stylesheet's default; the share lives only in the page.
let writtenShare: number | null = null;
let writtenBefore: number | null = null;

function setStyle(element: HTMLElement, name: string, value: string): void {
  if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
}

function writtenRange(): SizeRange {
  const style = getComputedStyle(written);
  const lift = parseFloat(style.paddingBlockStart) || 0;
  const top = writtenBody.getBoundingClientRect().top - written.getBoundingClientRect().top;
  return { min: top - lift + (parseFloat(style.paddingBlockEnd) || 0), max: canvas.getBoundingClientRect().height };
}

function applyWrittenShare(share: number | null): void {
  writtenShare = share;
  if (share === null) written.style.removeProperty('--written-size');
  else written.style.setProperty('--written-size', `${(share * 100).toFixed(3)}%`);
  syncWrittenSize();
}

function resizeWritten(size: number): void {
  const { max } = writtenRange();
  writtenBefore = null;
  applyWrittenShare(max > 0 ? size / max : null);
}

function syncWrittenSize(): void {
  const stageSize = canvas.getBoundingClientRect().height;
  if (written.hidden) {
    setStyle(stage, '--written-block', '0px');
    return;
  }
  const range = writtenRange();
  setStyle(written, '--written-min', `${range.min}px`);
  const size = written.getBoundingClientRect().height;
  const place = statusPlace(size, status.getBoundingClientRect().height, stageSize);
  setStyle(stage, '--written-block', `${place.block}px`);
  setStyle(written, '--written-lift', `${place.lift}px`);
  const percent = percentOf(size, range);
  writtenGrip.setAttribute('aria-valuemin', String(percentOf(range.min, range)));
  writtenGrip.setAttribute('aria-valuenow', String(percent));
  writtenGrip.setAttribute('aria-valuetext', texts().messages.written.sizeValue(percent));
  const label = isFull(size, range) ? texts().messages.written.back : texts().messages.written.full;
  if (writtenFull.textContent !== label) writtenFull.textContent = label;
}

function toggleWrittenFull(): void {
  if (isFull(written.getBoundingClientRect().height, writtenRange())) {
    applyWrittenShare(writtenBefore);
    writtenBefore = null;
    announce(texts().messages.written.restored);
  } else {
    writtenBefore = writtenShare;
    applyWrittenShare(1);
    announce(texts().messages.written.fullscreen);
  }
}

function applyNotation(next: PatternNotation, message: string): void {
  notation = next;
  symbols = symbolOptionsFor(next);
  try {
    localStorage.setItem(NOTATION_KEY, writeNotation(next));
  } catch {
    // KB: interface.md §5
  }
  syncNotationControls();
  renderPalette();
  select(tool);
  irregular?.applyNotation();
  announce(message);
}

function syncNotationControls(): void {
  // KB: interface.md §2, §6
  setTermsLocale(notation.terms);
  relabelSelects(document);
  termsSelect.value = notation.terms;
  styleSelect.value = notation.chartStyle;
}

termsSelect.addEventListener('change', () => {
  const terms = termsSelect.value as Locale;
  applyNotation({ ...notation, terms }, texts().messages.notation.terms(termsLabel(terms)));
});

styleSelect.addEventListener('change', () => {
  const chartStyle = styleSelect.value as PatternNotation['chartStyle'];
  applyNotation({ ...notation, chartStyle }, texts().messages.notation.chartStyle(chartStyleLabel(chartStyle)));
});

// The preset belongs to the pattern: counting changes in the pattern, symbols in the notation.
traditionSelect.addEventListener('change', () => {
  const tradition = traditionSelect.value as Tradition;
  const result = setTradition(history.present, tradition);
  if (!result.ok) return;
  applyNotation(notationForTradition(notation, tradition), '');
  commit(result, texts().messages.notation.tradition(traditionLabel(tradition)));
});

// KB: interface.md §4, §5
function changeLanguage(language: UiLanguage): void {
  setUiLanguage(language);
  rememberLanguage(language);
  document.documentElement.lang = language;
  applyStaticTexts(document, texts().markup);
  showModifierNames();
  if (homeLink) homeLink.href = homeUrl(language);
  // `history` here is the editor's undo stack, hence the fully qualified browser one.
  window.history.replaceState(window.history.state, '', urlWithLanguage(location.href, language));
  // KB: interface.md §2 — a stored notation wins; only the default follows the language.
  if (storedNotation() === null) {
    notation = defaultNotation(language);
    symbols = symbolOptionsFor(notation);
  }
  syncNotationControls();
  renderTypes();
  renderPalette();
  select(tool);
  syncWrittenSize();
  irregular?.refresh();
  announce(texts().messages.language.changed);
}

if (languageSelect) {
  languageSelect.value = startLanguage;
  languageSelect.addEventListener('change', () => changeLanguage(languageSelect.value === 'en' ? 'en' : 'hu'));
}

let items: PaletteItem[] = [];
const ink = readInk(document.documentElement);
const buttons = new Map<StitchDefId, HTMLButtonElement>();

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
    // Keeps a 2 px line after the scale-down.
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

  // KB: interface.md §11
  if (item.key) {
    const key = document.createElement('kbd');
    key.className = 'stitch__key';
    key.textContent = modifierCombo(item.key, currentPlatform());
    button.append(key);
  }

  button.addEventListener('click', () => select(tool === item.def.id ? null : item.def.id));
  return button;
}

function select(id: StitchDefId | null): void {
  tool = id;
  hover = null;
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
  insertionPanel.update(item?.def, notation.terms);
  const hints = texts().messages.hint;
  if (irregular?.active === true && !item) setHint(texts().irregular.hint);
  else if (!item) setHint(hints.none);
  else if (kind === 'chain' || kind === 'space') setHint(withStitchName(hints.chain, item.name));
  else if (kind === 'ring' || kind === 'picot') setHint(withStitchName(hints.simple, item.name));
  else setHint(withStitchName(hints.targeted, item.name));
  document.body.classList.toggle('is-armed', item !== undefined);
  irregular?.setStitch(id);
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

async function workAtCursor(): Promise<void> {
  const messages = texts().messages;
  if (!tool) {
    announce(messages.work.needStitch);
    return;
  }
  const def = resolveStitch(tool);
  const count = Number(countInput.value);
  const name = def ? capitalize(stitchName(def, notation.terms)) : tool;
  const named = def !== undefined;

  if (!isTargeted(tool)) {
    const message =
      def?.kind === 'chain' || def?.kind === 'space'
        ? withStitchName((label) => messages.work.chains(label, count), name, named)
        : withStitchName(messages.work.worked, name, named);
    commit(work(history.present, { def: tool, count }, cursor), message);
    return;
  }

  const { context } = derived;
  const idx = cursor;
  const slot = context.slots[idx];

  // KB: interface.md §28
  if (slot && context.used[idx]) {
    const same = workIntoSame(history.present, tool, idx, editorMode());
    const increase = same.ok
      ? same
      : work(history.present, { def: tool, count, insertion: insertionPanel.insertion }, idx, [], editorMode());
    commit(increase, withStitchName(messages.work.increase, name, named));
    return;
  }

  // KB: interface.md §28
  const mode = slot?.kind === 'stitch' ? insertionSuffix(insertionPanel.insertion) : '';
  commit(
    work(history.present, { def: tool, count, insertion: insertionPanel.insertion }, idx, [], editorMode()),
    withStitchName((label) => messages.work.workedInto(label, mode), name, named),
  );
}

function nudge(dx: number, dy: number): void {
  const node = history.present.pieces[0]?.stitches.find((n) => n.id === selectedNode);
  if (!node) return;
  const x = (node.pinned?.x ?? 0) + (mirror ? -dx : dx);
  const y = (node.pinned?.y ?? 0) + dy;
  commit(setPinned(history.present, node.id, { x, y }), texts().messages.work.nudged);
}

function slug(title: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return base || texts().messages.file.fallbackName;
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
  const context = contextOf(pattern, editorMode());
  const stem = stemFor(pattern, context);
  const grid = {
    grid: chartGrid(pattern, library, gridKindOf(context), context, { mirror, stemLength: stem }),
    colors: {
      rowA: token('--c-row-a'),
      rowB: token('--c-row-b'),
      cell: token('--c-grid'),
      row: token('--c-grid-row'),
      strong: token('--c-grid-strong'),
    },
  };
  const layout = layoutPattern(pattern, library, { mirror, stemLength: stem });
  return chartSvg(pattern, layout, library, {
    tradition: traditionOf(pattern.conventions),
    unitFrames: unitFrames(pattern, layout, mirror),
    spikes: spikeNodes(pattern),
    ...(exportGrid.checked ? { grid } : {}),
    colors: {
      right: token('--c-ink'),
      wrong: token('--c-ink-wrong'),
      text: token('--c-text'),
      background: token('--c-bg'),
    },
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
    announce(texts().messages.file.pngSaved);
  } catch {
    announce(texts().messages.file.pngFailed);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function importJson(file: File): Promise<void> {
  const file_ = texts().messages.file;
  const source = await file.text();
  // The file decides the type, not the type the file (PQW-963). The switch waits
  // until the file has actually loaded, so a broken one leaves the view alone.
  if (isIrregularJson(source)) {
    if (ensureIrregular().importJson(source) && patternType !== 'irregular') selectType('irregular');
    return;
  }
  const loaded = loadPattern(source);
  if (!loaded.ok) {
    announce(file_.loadFailed(renderCoreText(JSON_CORE_TEXTS[uiLanguage()], loaded.error.message), loaded.error.path));
    return;
  }
  const problem = structuralProblem(loaded.pattern);
  if (problem) {
    announce(file_.brokenStructure(problem));
    return;
  }
  if (patternType === 'irregular') selectType(DEFAULT_PATTERN_TYPE);
  selectedNode = null;
  selection = [];
  const recorded = loaded.pattern.notation?.terms;
  const note =
    recorded && recorded !== notation.terms ? file_.notationNote(termsLabel(recorded), termsLabel(notation.terms)) : '';
  commit({ ok: true, pattern: loaded.pattern }, file_.loaded(note));
  fitBoard();
}

function setSelection(ids: Iterable<NodeId>, focus: NodeId | null, message?: Message): void {
  selection = expandSelection(history.present, ids);
  selectedNode = focus !== null && selection.includes(focus) ? focus : null;
  refresh(message ?? describeSelection());
}

function describeSelection(): Message {
  const selectionTexts = texts().messages.selection;
  if (selection.length === 0) return selectionTexts.none;
  const def = selectedNode ? derived.context.graph?.defs.get(selectedNode) : undefined;
  const count = selectionTexts.count(selection.length, describeByLayer(history.present, selection));
  if (!def) return count;
  // KB: interface.md §3
  return [...withStitchName(selectionTexts.focus, capitalize(stitchName(def, notation.terms))), count];
}

function setAreaMode(on: boolean): void {
  if (on && tool) select(null);
  areaMode = on;
  document.body.classList.toggle('is-selecting', on);
  refresh(on ? texts().messages.selection.areaOn : texts().messages.selection.areaOff);
}

async function deleteSelection(): Promise<void> {
  const messages = texts().messages;
  if (selection.length === 0) {
    announce(messages.selection.needSelection);
    return;
  }
  const pattern = history.present;
  const plan = deletionPlan(pattern, selection);
  if (plan.dependents.length > 0) {
    affected = plan.dependents;
    draw();
    const yes = await askConfirm({
      message: messages.dialog.deleteQuestion(
        plan.selected.length,
        plan.dependents.length,
        describeByLayer(pattern, plan.dependents),
      ),
      confirmLabel: messages.dialog.deleteConfirm,
      cancelLabel: messages.dialog.cancel,
    });
    affected = [];
    if (!yes) {
      refresh(messages.selection.deleteCancelled);
      return;
    }
  }
  const result = deleteStitches(pattern, plan.selected, { withDependents: true });
  if (result.ok) {
    selection = [];
    selectedNode = null;
    selectionAnchor = null;
  }
  commit(result, messages.selection.deleted(plan.selected.length + plan.dependents.length));
}

function copySelected(): void {
  const selectionTexts = texts().messages.selection;
  if (selection.length === 0) return announce(selectionTexts.nothingToCopy);
  const result = copySelection(history.present, selection);
  if (!result.ok) return announce(renderCoreText(EDITOR_CORE_TEXTS[uiLanguage()], result.reason));
  clipboard = result.fragment;
  const where = result.fragment.startsLayer
    ? selectionTexts.asLayer(result.fragment.shape === 'round')
    : selectionTexts.atCursor;
  announce(selectionTexts.copied(result.fragment.stitches.length, where));
}

function pasteClipboard(): void {
  const selectionTexts = texts().messages.selection;
  if (!clipboard) return announce(selectionTexts.clipboardEmpty);
  commitInserted(
    pasteFragment(history.present, clipboard, cursorMoved ? cursor : undefined),
    selectionTexts.pasted(clipboard.stitches.length),
  );
}

function duplicateSelected(): void {
  const selectionTexts = texts().messages.selection;
  if (selection.length === 0) return announce(selectionTexts.nothingToDuplicate);
  commitInserted(duplicateSelection(history.present, selection), selectionTexts.duplicated(selection.length));
}

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

// KB: interface.md §11 — letters by key, so a Hungarian layout behaves like an English one.
//
// Anything this editor does not use must still be swallowed: the regular pattern
// is only hidden, not gone, and a stray Alt+F or Enter would crochet into it.
function irregularKey(editor: IrregularEditor, event: KeyboardEvent, key: string, onBoard: boolean): boolean {
  if ((event.ctrlKey || event.metaKey) && !event.altKey) {
    const lower = key.toLowerCase();
    // Undo and redo go through the shared actions, which route themselves.
    if (lower === 'z' || lower === 'y') return false;
    const commands: Record<string, () => void> = {
      a: () => editor.selectAll(),
      c: () => editor.copySelection(),
      x: () => editor.cutSelection(),
      v: () => editor.paste(),
      d: () => editor.duplicateSelection(),
    };
    const command = commands[lower];
    if (command === undefined) return false;
    event.preventDefault();
    command();
    return true;
  }
  if (event.altKey) {
    // The palette digits and the grid are shared; filling, turning, closing and
    // spiralling belong to rows, which this type does not have.
    return !(/^Digit[1-9]$/.test(event.code) || event.code === 'KeyR');
  }
  if (key === 'Escape') {
    editor.clearSelection();
    if (tool !== null) select(null);
    return true;
  }
  if (key === 'Delete' || key === 'Backspace') {
    event.preventDefault();
    editor.deleteSelection();
    return true;
  }
  // KB: interface.md §44 — with an arc selected the digits are its stitch count.
  if (/^[0-9]$/.test(key) && editor.selectedArc !== null && !event.shiftKey) {
    event.preventDefault();
    editor.typeArcCount(key);
    return true;
  }
  if (!onBoard) return false;
  const step = event.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
  const nudges: Record<string, readonly [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  };
  const move = nudges[key];
  if (move !== undefined) {
    event.preventDefault();
    editor.nudge(move[0], move[1]);
    return true;
  }
  // These move the target cursor and crochet in the regular type. Here they do nothing.
  return key === 'Home' || key === 'End' || key === 'Enter';
}

// Holding Space pans, as it does in the regular type.
document.addEventListener('keydown', (event) => {
  if (event.code === 'Space' && !(event.target as HTMLElement).closest('input, textarea, select')) {
    irregular?.setSpaceDown(true);
  }
});
document.addEventListener('keyup', (event) => {
  if (event.code === 'Space') irregular?.setSpaceDown(false);
});
window.addEventListener('blur', () => irregular?.setSpaceDown(false));

const ACTIONS: Record<string, () => void> = {
  undo: () => {
    if (irregular?.active === true) return irregular.undo();
    history = undo(history);
    cursorMoved = false;
    persist(history.present);
    refresh(texts().messages.work.undo);
  },
  redo: () => {
    if (irregular?.active === true) return irregular.redo();
    history = redo(history);
    cursorMoved = false;
    persist(history.present);
    refresh(texts().messages.work.redo);
  },
  'delete-last': () => commit(deleteLast(history.present), texts().messages.work.deleteLast),
  'select-area': () => (irregular?.active === true ? select(null) : setAreaMode(!areaMode)),
  'chain-arc': () => irregular?.toggleArcTool(),
  'delete-selection': () => (irregular?.active === true ? irregular.deleteSelection() : void deleteSelection()),
  'duplicate-selection': () => (irregular?.active === true ? irregular.duplicateSelection() : duplicateSelected()),
  same: () =>
    tool
      ? commit(workIntoSame(history.present, tool), texts().messages.work.sameAgain)
      : announce(texts().messages.work.needStitchShort),
  'fill-row': () =>
    tool && isTargeted(tool)
      ? commit(
          fillRow(
            history.present,
            { def: tool, count: Number(countInput.value), insertion: insertionPanel.insertion },
            editorMode(),
          ),
          texts().messages.work.fillRow(insertionSuffix(insertionPanel.insertion)),
        )
      : announce(texts().messages.work.needTargetStitch),
  // KB: interface.md §18, §20
  'end-row': () => {
    commit(
      endRow(history.present),
      onFoundationChain(derived.context) ? texts().messages.work.foundationDone : texts().messages.work.rowEnd,
    );
    // KB: interface.md §19
    turnedOn = history.present;
    draw();
  },
  'close-round': () =>
    commit(
      closeRound(history.present),
      canJoinChainRing(history.present) ? texts().messages.work.chainRing : texts().messages.work.roundClosed,
    ),
  'spiral-round': () => commit(endRoundSpiral(history.present), texts().messages.work.spiral),
  grid: () => {
    if (irregular?.active === true) return irregular.toggleGrid();
    showGrid = !showGrid;
    try {
      localStorage.setItem(GRID_KEY, showGrid ? 'lathato' : 'rejtett');
    } catch {
      // KB: interface.md §5
    }
    refresh(showGrid ? texts().messages.view.gridOn : texts().messages.view.gridOff);
  },
  'zoom-in': () => (irregular?.active === true ? irregular.zoom(1.25) : board.zoom(1.25)),
  'zoom-out': () => (irregular?.active === true ? irregular.zoom(0.8) : board.zoom(0.8)),
  fit: () => (irregular?.active === true ? irregular.fit() : fitBoard()),
  'export-json': () => {
    if (irregular?.active === true) {
      download(irregular.exportJson(), `${slug(irregular.title)}.json`, 'application/json');
      announce(texts().messages.file.jsonSaved);
      return;
    }
    download(
      savePattern(withNotation(history.present, notation)),
      `${slug(history.present.title)}.json`,
      'application/json',
    );
    announce(texts().messages.file.jsonSaved);
  },
  'import-json': () => importFile.click(),
  'export-svg': () => {
    download(exportSvgText(), `${slug(history.present.title)}.svg`, 'image/svg+xml');
    announce(texts().messages.file.svgSaved);
  },
  'export-png': () => void exportPng(),
  'copy-written': () => void copyWritten(),
  'written-full': () => toggleWrittenFull(),
  'close-written': () => {
    setWrittenOpen(false);
    writtenToggle.focus();
  },
  new: () => {
    if (irregular?.active === true) return irregular.newPattern();
    selectedNode = null;
    selection = [];
    // KB: interface.md §29 — the profiles follow the crocheter into the new pattern.
    const gauge = history.present.gauge;
    // KB: interface.md §20 — no toast; the live region still gets the empty pattern's sentence.
    commit({ ok: true, pattern: { ...emptyPattern(), ...(gauge ? { gauge } : {}) } }, texts().messages.summary.empty);
    // KB: interface.md §10 — visibility only; the stored open state is deliberately left alone.
    setOpen(written, writtenToggle, false);
    fitBoard();
  },
  unpin: () => selectedNode && commit(setPinned(history.present, selectedNode, null), texts().messages.work.unpinned),
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
  if (irregular?.active === true) {
    irregular.setTitle(title);
    return;
  }
  // KB: interface.md §29
  if (title !== history.present.title) {
    commit(
      { ok: true, pattern: { ...history.present, title, titleGenerated: false } },
      texts().messages.work.titleChanged,
    );
  }
});

countInput.addEventListener('change', () => refresh());

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
  closePopover(filePop, fileToggle);
}

errorToggle.addEventListener('click', () => togglePopover(errorsPop, errorToggle));

fileToggle.addEventListener('click', () => {
  const opening = filePop.hidden;
  closeAllPopovers();
  if (opening) {
    openPopover(filePop, fileToggle);
    filePop.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }
});

filePop.addEventListener('click', (event) => {
  if ((event.target as Element).closest('button')) closePopover(filePop, fileToggle);
});

document.addEventListener('click', (event) => {
  if (!(event.target as Element).closest('.menu')) closeAllPopovers();
});

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

      button.dataset.tip = type.detail;
      button.append(typeIcon(type.id));
      const label = span('type__label', '');
      label.append(span('type__name', type.name));
      // The badge goes BELOW the name, inside the label box: beside it, it overlapped in a narrow bar.
      if (!type.available) label.append(span('type__badge', texts().sections.types.soon));
      else button.addEventListener('click', () => selectType(type.id));
      button.append(label);

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
    // KB: interface.md §5
  }
  for (const button of typesList.querySelectorAll<HTMLButtonElement>('.type')) {
    button.setAttribute('aria-pressed', String(button.dataset.type === id));
  }
  const type = PATTERN_TYPES.find((candidate) => candidate.id === id);
  if (id === 'irregular') {
    const editor = ensureIrregular();
    showIrregularView(true);
    editor.mount();
    editor.setStitch(tool);
    if (tool === null) setHint(texts().irregular.hint);
  } else {
    irregular?.unmount();
    showIrregularView(false);
  }
  refresh();
  showTypeView(id);
  if (type) announce(texts().messages.types.selected(type.name, type.detail));
}

typesToggle.addEventListener('click', () => {
  const open = typesNav.hasAttribute('hidden');
  setOpen(typesNav, typesToggle, open);
  rememberTypesOpen(open);
  // The canvas fits around the bar's width, so closing it needs a refit.
  fitBoard();
});

toggle.addEventListener('click', () => {
  const open = panel.hasAttribute('hidden');
  setOpen(panel, toggle, open);
  if (open && NARROW.matches && !written.hidden) setWrittenOpen(false);
});

writtenToggle.addEventListener('click', () => {
  const open = written.hasAttribute('hidden');
  setWrittenOpen(open);
  // KB: interface.md §10
  if (open && writtenShare === null) applyWrittenShare(writtenShareFor(patternType, NARROW.matches));
  if (open && NARROW.matches) setOpen(panel, toggle, false);
});

// KB: interface.md §13 — pointer, touch and keyboard.
let gripDrag: {
  readonly pointer: number;
  readonly y: number;
  readonly size: number;
  readonly share: number | null;
} | null = null;

writtenGrip.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  writtenGrip.setPointerCapture(event.pointerId);
  gripDrag = {
    pointer: event.pointerId,
    y: event.clientY,
    size: written.getBoundingClientRect().height,
    share: writtenShare,
  };
});

writtenGrip.addEventListener('pointermove', (event) => {
  if (gripDrag?.pointer !== event.pointerId) return;
  resizeWritten(dragSize(gripDrag.size, gripDrag.y - event.clientY, writtenRange()));
});

function endGripDrag(event: PointerEvent): void {
  if (gripDrag?.pointer !== event.pointerId) return;
  const drag = gripDrag;
  gripDrag = null;
  if (event.type !== 'pointerup' || !dragCollapses(drag.size, drag.y - event.clientY, writtenRange())) return;
  applyWrittenShare(drag.share);
  setWrittenOpen(false);
  writtenToggle.focus();
}
writtenGrip.addEventListener('pointerup', endGripDrag);
writtenGrip.addEventListener('pointercancel', endGripDrag);

writtenGrip.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const size = keySize(event.key, written.getBoundingClientRect().height, writtenRange());
  if (size === null) return;
  // On the separator the arrows, Home and End size the panel, not the canvas cursor.
  event.preventDefault();
  event.stopPropagation();
  resizeWritten(size);
});

type Drag =
  | { readonly kind: 'node'; readonly id: NodeId; readonly start: Point; readonly base: Point; moved: boolean }
  | { readonly kind: 'pan'; last: Point }
  | { readonly kind: 'area'; readonly from: Point; readonly additive: boolean };
let drag: Drag | null = null;

canvas.addEventListener('pointerdown', (event) => {
  canvas.focus({ preventScroll: true });
  // KB: interface.md §16
  const label = board.labelAt(event.clientX, event.clientY);
  if (label !== null) {
    if (tool) select(null);
    const layer = derived.layout.layers.find((candidate) => candidate.index === label);
    const ids = layerSelection(history.present, label);
    selectionAnchor = ids[0] ?? null;
    const name = texts().messages.layer.name(label, layer?.shape === 'round');
    setSelection(
      event.shiftKey ? [...selection, ...ids] : ids,
      null,
      texts().messages.selection.layer(name, layer?.writtenCount ?? 0),
    );
    return;
  }
  // KB: interface.md §28
  const insert = board.seamUnder(event.clientX, event.clientY);
  if (insert) {
    commit(insertChain(history.present, insert), texts().messages.work.chainInserted);
    seam = null;
    return;
  }
  // KB: interface.md §28
  const gap = tool && isTargeted(tool) ? board.gapUnder(event.clientX, event.clientY) : null;
  if (gap && tool) {
    const into = { def: tool, count: Number(countInput.value), insertion: insertionPanel.insertion };
    commit(workIntoGap(history.present, gap.layer, gap.into, into, editorMode()), texts().messages.work.gapFilled);
    return;
  }
  if (tool) {
    if (!isPlaced(tool)) {
      void workAtCursor();
      return;
    }
    // KB: interface.md §28
    const aim = board.aimUnder(event.clientX, event.clientY);
    if (typeof aim === 'string') announce(aim);
    const index = typeof aim === 'number' ? aim : null;
    if (index === null) {
      // KB: interface.md §28
      if (isTargeted(tool)) {
        drag = { kind: 'pan', last: { x: event.clientX, y: event.clientY } };
        canvas.setPointerCapture(event.pointerId);
        return;
      }
      void workAtCursor();
      return;
    }
    cursor = index;
    cursorMoved = true;
    void workAtCursor();
    return;
  }
  const id = board.nodeAt(event.clientX, event.clientY);
  canvas.setPointerCapture(event.pointerId);
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
  // Clicking an already selected stitch keeps the selection, so it stays deletable and duplicable.
  setSelection(selection.includes(id) ? selection : [id], id);
  const pinned = history.present.pieces[0]?.stitches.find((n) => n.id === id)?.pinned;
  drag = {
    kind: 'node',
    id,
    start: board.toChart(event.clientX, event.clientY),
    base: { x: pinned?.x ?? 0, y: pinned?.y ?? 0 },
    moved: false,
  };
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
  const nextSeam = board.seamUnder(event.clientX, event.clientY);
  if ((nextSeam?.at.x ?? null) !== (seam?.at.x ?? null)) {
    seam = nextSeam;
    refresh();
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
    setSelection(
      additive ? [...selection, ...inside] : inside,
      null,
      inside.length === 0 ? texts().messages.selection.emptyRect : undefined,
    );
    return;
  }
  if (drag?.kind === 'node' && drag.moved && preview) {
    const pattern = preview;
    preview = null;
    commit({ ok: true, pattern }, texts().messages.work.nudged);
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

function moveCursor(step: number): void {
  const { targets } = derived;
  if (targets.length === 0) return;
  cursor = Math.max(0, Math.min(targets.length - 1, cursor + step));
  cursorMoved = true;
  refresh(describeTarget(cursor));
  showPoint(targets[cursor]!.point);
}

function moveFocus(move: FocusMove, extend: boolean): void {
  const focus = stepFocus(
    history.present,
    derived.layout,
    selectedNode ?? selection[selection.length - 1] ?? null,
    move,
  );
  if (!focus) {
    announce(texts().messages.selection.emptyPattern);
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
  // In a text field the browser's default wins, with one exception: Enter in the chain-count field
  // crochets, which is what the palette hint promises.
  const chainCountEnter =
    target === countInput && event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.altKey;
  if (target.closest('input, textarea, select, dialog') && !chainCountEnter) return;
  if (chainCountEnter) {
    event.preventDefault();
    void workAtCursor();
    return;
  }
  const key = event.key;

  // Escape closes an open menu first and returns the focus to its button.
  const openMenu = [
    { pop: errorsPop, button: errorToggle },
    { pop: filePop, button: fileToggle },
  ].find((menu) => !menu.pop.hidden);
  if (key === 'Escape' && openMenu) {
    event.preventDefault();
    closeAllPopovers();
    openMenu.button.focus();
    return;
  }

  const onBoard = target === canvas || target === irregularCanvas || target === document.body;
  // The written pattern's text is left to the browser's own copy handling.
  const inWritten = target.closest('#written') !== null;

  if (irregular !== null && irregular.active && irregularKey(irregular, event, key, onBoard)) return;

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
    } else if (lower === 'c' && !inWritten) {
      // Runs without a selection too, so `copySelected` can say there is nothing to copy;
      // the condition used to swallow the key silently and copying looked broken.
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
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-2, 0],
      ArrowRight: [2, 0],
      ArrowUp: [0, -2],
      ArrowDown: [0, 2],
    };
    const delta = arrows[key];
    if (delta && selectedNode) {
      event.preventDefault();
      nudge(...delta);
      return;
    }
    // KB: interface.md §11
    const commands: Record<string, () => void> = {
      KeyF: () => ACTIONS[event.shiftKey ? 'fill-row' : 'end-row']!(),
      KeyK: () => ACTIONS['close-round']!(),
      KeyS: () => ACTIONS['spiral-round']!(),
      KeyR: () => ACTIONS.grid!(),
    };
    const command = commands[event.code];
    if (command) {
      event.preventDefault();
      command();
      return;
    }
    const digit = /^Digit([1-9])$/.exec(event.code)?.[1];
    const item = digit === undefined ? undefined : items.find((candidate) => candidate.key === digit);
    if (item) {
      event.preventDefault();
      select(item.def.id);
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
      if (selection.length > 0) void deleteSelection();
      else ACTIONS['delete-last']!();
      return;
  }

  if (onBoard) {
    const moves: Record<string, FocusMove> = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down',
      Home: 'first',
      End: 'last',
    };
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
});

const sizePanel = new SizePanel(must<HTMLDetailsElement>('#section-size'), {
  commit: (pattern, message) => commit({ ok: true, pattern }, message),
  announce,
  setAspect: (on) => {
    aspect = on;
    refresh(on ? texts().messages.view.aspectOn : texts().messages.view.aspectOff);
    fitBoard();
  },
});

const roundsPanel = new RoundsPanel(must<HTMLDetailsElement>('#section-rounds'), {
  commit: (pattern, message) => {
    selectedNode = null;
    selection = [];
    commit({ ok: true, pattern }, message);
    fitBoard();
  },
  announce,
});

const shapesPanel = new ShapesPanel(must<HTMLDetailsElement>('#section-shape'), {
  commit: (pattern, message) => {
    selectedNode = null;
    selection = [];
    commit({ ok: true, pattern }, message);
    fitBoard();
  },
  announce,
});

const shawlsPanel = new ShawlsPanel(must<HTMLDetailsElement>('#section-shawl'), {
  commit: (pattern, message) => {
    selectedNode = null;
    selection = [];
    commit({ ok: true, pattern }, message);
    fitBoard();
  },
  announce,
});

const garmentPanel = new GarmentPanel(must<HTMLDetailsElement>('#section-garment'), {
  commit: (pattern, message) => {
    selectedNode = null;
    selection = [];
    commit({ ok: true, pattern }, message);
    fitBoard();
  },
  announce,
});

// KB: interface.md §9
function panelFor<T>(type: PatternTypeId, selector: string, build: (section: HTMLDetailsElement) => T): T | null {
  const section = must<HTMLDetailsElement>(selector);
  if (isAvailableType(type)) return build(section);
  section.hidden = true;
  return null;
}

const amigurumiPanel = panelFor(
  'amigurumi',
  '#section-amigurumi',
  (section) =>
    new AmigurumiPanel(section, {
      commit: (pattern, message) => {
        selectedNode = null;
        selection = [];
        commit({ ok: true, pattern }, message);
        fitBoard();
      },
      announce,
    }),
);

const gridPanel = panelFor(
  'filet',
  '#section-grid',
  (section) =>
    new GridChartPanel(section, {
      commit: (pattern, message) => {
        selectedNode = null;
        selection = [];
        commit({ ok: true, pattern }, message);
        fitBoard();
      },
      announce,
    }),
);

const irregularSections = {
  properties: must<HTMLDetailsElement>('#section-irregular'),
  rows: must<HTMLDetailsElement>('#section-irregular-rows'),
  layers: must<HTMLDetailsElement>('#section-irregular-layers'),
  key: must<HTMLDetailsElement>('#section-irregular-key'),
};

function ensureIrregular(): IrregularEditor {
  if (irregular !== null) return irregular;
  irregular = new IrregularEditor(irregularCanvas, irregularSections, {
    announce,
    symbols: () => symbols,
    notation: () => notation,
    insets: () => ({ left: insetLeft(), right: insetRight(), bottom: insetBottom() }),
    notationNote: (recorded, shown) => texts().messages.file.notationNote(termsLabel(recorded), termsLabel(shown)),
    armStitch: (id) => select(id),
    terms: () => notation.terms,
    refreshControls: () => {
      if (irregular !== null) updateIrregularControls(irregular);
    },
  });
  return irregular;
}

function updateIrregularControls(editor: IrregularEditor): void {
  setDisabled('undo', !editor.canUndo);
  setDisabled('redo', !editor.canRedo);
  setDisabled('delete-selection', editor.selectionSize === 0);
  setDisabled('duplicate-selection', editor.selectionSize === 0);
  must<HTMLButtonElement>('[data-action="select-area"]').setAttribute(
    'aria-pressed',
    String(tool === null && !editor.arcArmed),
  );
  must<HTMLButtonElement>('[data-action="chain-arc"]').setAttribute('aria-pressed', String(editor.arcArmed));
  must<HTMLButtonElement>('[data-action="grid"]').setAttribute('aria-pressed', String(editor.gridVisible));
  if (document.activeElement !== titleInput) titleInput.value = editor.title;
  const issues = editor.issues();
  const errorBar = texts().messages.errorBar;
  errorCount.textContent = issues.length === 0 ? errorBar.none : errorBar.warnings(issues.length);
  errorToggle.classList.remove('has-errors');
  errorToggle.classList.toggle('has-warnings', issues.length > 0);
  summary.textContent = issues.length === 0 ? errorBar.none : '';
  findingList.replaceChildren(
    ...issues.map((text) => {
      const entry = document.createElement('li');
      entry.className = 'finding';
      entry.textContent = text;
      return entry;
    }),
  );
}

// KB: interface.md §9 — the free-form type brings its own canvas, so the two never paint over each other.
function showIrregularView(on: boolean): void {
  canvas.hidden = on;
  irregularCanvas.hidden = !on;
  must<HTMLElement>('#tools-row').hidden = on;
  must<HTMLElement>('#tools-irregular').hidden = !on;
  writtenToggle.hidden = on;
  if (on) setOpen(written, writtenToggle, false);
  // The free-form image and print output arrives with its own ticket; until then it would save the wrong chart.
  setDisabled('export-png', on);
  setDisabled('export-svg', on);
}

// KB: interface.md §10
function showTypeView(id: PatternTypeId): void {
  if (id === 'filet') gridPanel?.reveal();
  const share = writtenShareFor(id, NARROW.matches);
  if (share === null) return;
  // KB: interface.md §10 — the panel opens only from its own button; this just sets the proportion.
  if (!written.hidden) applyWrittenShare(share);
  amigurumiPanel?.reveal();
}

syncNotationControls();
renderTypes();
renderPalette();
setOpen(typesNav, typesToggle, readTypesOpen() && !NARROW.matches);
setOpen(panel, toggle, !NARROW.matches);
setOpen(written, writtenToggle, readWrittenOpen() && !NARROW.matches);
showTypeView(patternType);
if (patternType === 'irregular') {
  const startupEditor = ensureIrregular();
  showIrregularView(true);
  startupEditor.mount();
}

// KB: decisions.md §5
must<HTMLElement>('#version').textContent = `v${__APP_VERSION__}`;
select(null);
fitBoard();

// KB: interface.md §13
let shownArea = visibleArea();
function realign(): void {
  syncWrittenSize();
  const area = visibleArea();
  if (area.bottom - area.top < 1) return;
  const before = shownArea;
  shownArea = area;
  const point = cursorPoint();
  if (point) showPoint(point);
  else if (board.patternWithin(before) && !board.patternWithin(shownArea)) fitBoard();
}
const realignObserver = new ResizeObserver(realign);
realignObserver.observe(canvas);
realignObserver.observe(written);
// A new status message only repositions the status line; it never moves the view.
new ResizeObserver(syncWrittenSize).observe(status);

alignTooltips(must<HTMLElement>('.tools'));
setupConsentBanner(GA_MEASUREMENT_ID);

// KB: interface.md §31
if (navigator.webdriver) {
  Object.assign(window, {
    mintatervezoRacs: {
      layer: () => derived.context.layer,
      cells: () => board.gridCells(),
      bounds: () => board.gridBounds(),
      labels: () => board.labels(),
      labelBoxes: () => board.labelBoxes(),
      arrowBox: () => board.arrowBox(),
      highlight: () => [...highlighted],
      stitchBoxes: () => board.stitchBoxes(),
      cursor: () => {
        const point = cursorPoint();
        return point ? board.toClient(point) : null;
      },
    },
    mintatervezoKijeloles: {
      selection: () => [...selection],
      nodes: () =>
        [...derived.layout.nodes.values()].map((node) => ({
          id: node.id,
          def: node.def,
          layer: node.layer,
          ...board.toClient(node.top),
        })),
    },
  });
}

// KB: interface.md §5
function storedUiLanguage(): string | null {
  try {
    return localStorage.getItem(LANG_KEY);
  } catch {
    return null;
  }
}

function rememberLanguage(language: UiLanguage): void {
  try {
    localStorage.setItem(LANG_KEY, language);
  } catch {
    // KB: interface.md §5
  }
}

// KB: interface.md §11 — the dictionary writes "Alt" everywhere; correct it once, after substitution.
function showModifierNames(): void {
  const name = modifierName(currentPlatform());
  if (name === 'Alt') return;
  for (const element of document.querySelectorAll<HTMLElement>('[data-tip*="Alt+"]')) {
    element.dataset['tip'] = element.dataset['tip']!.replaceAll('Alt+', name);
  }
  for (const key of document.querySelectorAll('kbd')) {
    if (key.textContent === 'Alt') key.textContent = name;
  }
}

// KB: interface.md §5
function readTypesOpen(): boolean {
  try {
    return localStorage.getItem(TYPES_KEY) !== 'zarva';
  } catch {
    return true;
  }
}

function rememberTypesOpen(open: boolean): void {
  try {
    localStorage.setItem(TYPES_KEY, open ? 'nyitva' : 'zarva');
  } catch {
    // KB: interface.md §5
  }
}
