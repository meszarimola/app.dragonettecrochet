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
  canCloseRound,
  canEndRound,
  canEndRow,
  canJoinChainRing,
  closeRound,
  contextOf,
  defaultCursor,
  deleteLast,
  emptyPattern,
  endRoundSpiral,
  endRow,
  fillRow,
  liveCheck,
  onFoundationChain,
  setPinned,
  setTradition,
  work,
  workIntoSame,
  type EditResult,
  type EditorMode,
  type LiveCheck,
  type Slot,
  type WorkContext,
} from '../core/editor.js';
import { canRedo, canUndo, createHistory, record, redo, undo, type History } from '../core/history.js';
import { chartGrid, targetPoint, type ChartGrid } from '../core/grid.js';
import { layoutPattern, type ChartLayout, type Point } from '../core/layout.js';
import { pieceFinished } from '../core/editor.js';
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
import type { Finding, Locale, NodeId, Pattern, PatternNotation, StitchDef, StitchDefId, Tradition } from '../core/types.js';
import { validatePattern } from '../core/validate.js';
import { Board, type Area, type DirectionArrow, type Target } from './board.js';
import { chartSvg } from './chart-svg.js';
import { setupConsentBanner } from './consentBanner.js';
import { askConfirm } from './dialog.js';
import { applyStaticTexts, homeUrl, resolveUiLanguage, setUiLanguage, texts, uiLanguage, urlWithLanguage, type UiLanguage } from './i18n.js';
import { currentPlatform, modifierCombo, modifierName } from './platform.js';
import { EDITOR_CORE_TEXTS } from './i18n/core/editor.js';
import { JSON_CORE_TEXTS } from './i18n/core/json.js';
import { renderCoreText } from './i18n/core/render.js';
import { RULE_TEXTS, type RuleText } from './i18n/rules.js';
import {
  chartStyleLabel,
  defaultNotation,
  notationForTradition,
  readNotation,
  symbolOptionsFor,
  setTermsLocale,
  termsLabel,
  textLanguage,
  traditionLabel,
  withNotation,
  writeNotation,
} from './notation.js';
import { relabelSelects } from './select-labels.js';
import { buildPalette, type PaletteItem } from './palette.js';
import { InsertionPanel } from './insertion-panel.js';
import { insertionSuffix } from './insertion-view.js';
import { nodeInsertions } from '../core/insertion.js';
import { AmigurumiPanel } from './amigurumi-panel.js';
import { GridChartPanel } from './grid-chart-panel.js';
import { spikeNodes, unitFrames } from './grid-chart-view.js';
import { RoundsPanel } from './rounds-panel.js';
import { ShapesPanel } from './shapes-panel.js';
import { ShawlsPanel } from './shawls-panel.js';
import { GarmentPanel } from './garment-panel.js';
import { SizePanel } from './size-panel.js';
import { DEFAULT_PATTERN_TYPE, PATTERN_TYPES, gridKind, isAvailableType, writtenShareFor, type PatternTypeId } from './pattern-types.js';
import { applyInk, drawCentered, readInk, shapeBounds, stemLength, symbolShapes, type SymbolOptions } from './symbols.js';
import { alignTooltips } from './tooltip.js';
import { writtenView } from './written.js';
import { dragCollapses, dragSize, isFull, keySize, percentOf, statusPlace, type SizeRange } from './written-size.js';

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
const scMarkField = must<HTMLFieldSetElement>('#sc-mark');
const scMarkJis = must<HTMLParagraphElement>('#sc-mark-jis');
const traditionSelect = must<HTMLSelectElement>('#tradition');
const typesNav = must<HTMLElement>('#types');
const typesToggle = must<HTMLButtonElement>('#types-toggle');
const typesList = must<HTMLUListElement>('#types-list');
const errorToggle = must<HTMLButtonElement>('#error-toggle');
const errorCount = must<HTMLElement>('#error-count');
const errorsPop = must<HTMLElement>('#errors');
/** A fájlműveletek lenyíló menüje (PQW-911): mentés, betöltés, képexport. */
const fileToggle = must<HTMLButtonElement>('#file-toggle');
const filePop = must<HTMLElement>('#file-pop');
const exportGrid = must<HTMLInputElement>('#export-grid');
/** A beszúrási mód a kiválasztott szemhez (PQW-869). */
const insertionPanel = new InsertionPanel(must<HTMLFieldSetElement>('#insertion'));
/** A felület nyelvének választója és a főoldal linkje (PQW-900); régebbi jelölésben hiányozhatnak. */
const languageSelect = document.querySelector<HTMLSelectElement>('#ui-language');
const homeLink = document.querySelector<HTMLAnchorElement>('#home-link, .home');

const STORAGE_KEY = 'dc-mintatervezo:minta';
const NOTATION_KEY = 'dc-mintatervezo:jeloles';
const WRITTEN_KEY = 'dc-mintatervezo:irott-minta';
const TYPE_KEY = 'dc-mintatervezo:tipus';
const GRID_KEY = 'dc-mintatervezo:racs';
/** A mintatípus-sáv nyitott-e (PQW-912): a választás a következő megnyitásig él. */
const TYPES_KEY = 'dc-mintatervezo:mintatipus';
/** A választott felületi nyelv (PQW-906): működési beállítás, nem követés. */
const LANG_KEY = 'dc-mintatervezo:nyelv';
/** Ennél keskenyebb képernyőn a két panel nem fér el egymás mellett. */
const NARROW = window.matchMedia('(width < 48rem)');
const STRUCTURAL_RULES = new Set(['unknown-stitch', 'dangling-reference', 'yarn-path']);

/* ---- A felület nyelve (PQW-900) ---- */

/**
 * Induláskor a `?lang` paraméter dönt, enélkül a dokumentum nyelve. A statikus
 * feliratok, a főoldal linkje és a nyelvválasztó is ezt követik. Ennek a
 * blokknak az állapot előtt kell lefutnia: a mentett minta betöltése és a
 * jelölés alapértelmezése már a felület nyelvét használja.
 */
const startLanguage = resolveUiLanguage(location.search, storedUiLanguage(), document.documentElement.lang);
setUiLanguage(startLanguage);
document.documentElement.lang = startLanguage;
applyStaticTexts(document, texts().markup);
  showModifierNames();
if (homeLink) homeLink.href = homeUrl(startLanguage);

/** Az állapotsor üzenete: sima szöveg, vagy elemek, ha szemnevet tartalmaz (PQW-853). */
type Message = string | readonly (string | Node)[];

/** A helyőrző, amelynek a helyére a szemnév saját `lang` attribútumú eleme kerül. */
const NAME_SLOT = '\u0001';

/**
 * A mondat a szemnevével: a szemnév saját `lang` attribútumot kap, mert a
 * jelölés nyelve a felület nyelvétől független (PQW-853, PQW-868). Jelöletlen
 * névnél (pl. „szem”, „varázskör”) a mondat egyetlen szövegdarab marad.
 */
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
/*
 * A tükrözött nézet kapcsolója kikerült a felületről (PQW-911): nem adott
 * valódi balkezes nézetet, ezért félrevezető volt. A rajzoló és az export
 * `mirror` paramétere megmarad — a mag tudja tükrözve is kirakni a mintát —,
 * a felület viszont mindig egyenesen kéri.
 */
const mirror = false;
/** A választott mintatípus; a böngészőben marad. Most csak a „szabályos” aktív. */
let patternType: PatternTypeId = readType();
/** Látszik-e a rács (PQW-874); a böngészőben marad. */
let showGrid = readGrid();
/** Arányhelyes nézet (PQW-859). Újratöltés után nem marad meg: az új tárolókulcsot igényelne. */
let aspect = false;
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
  const context = contextOf(pattern, editorMode());
  const stem = stemFor(pattern, context);
  const layout = layoutPattern(pattern, context.library, { mirror, stemLength: stem });
  const check = liveCheck(pattern, context);
  const targets = context.slots.map((_, i) => ({ point: targetPoint(layout, context, i) ?? { x: 0, y: 0 }, used: context.used[i] ?? false }));
  const grid = showGrid ? chartGrid(pattern, context.library, gridKindOf(context), context, { mirror, stemLength: stem }) : null;
  return { pattern, context, layout, check, targets, grid };
}

/** A szár hossza: arányhelyes nézetben a profil (profil nélkül a becslés) szemarányából, különben a jelrajzé. */
function stemFor(pattern: Pattern, context: WorkContext): (chainHeight: number) => number {
  if (!aspect) return stemLength;
  return aspectStem(gaugeContextOf(pattern, context.library), context.graph?.layers[0]?.shape ?? context.shape);
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

/**
 * A szerkesztő módja: amigurumiban a láncalapon kör indul, ovális is (PQW-899);
 * a szegély gombbal a célpontok a darab kerületén futnak (PQW-902).
 */
function editorMode(): EditorMode {
  return { roundsOnChain: patternType === 'amigurumi' };
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

/** A böngészőben tárolt jelölés nyers értéke; `null`, ha nincs, vagy nem olvasható. */
function storedNotation(): string | null {
  try {
    return localStorage.getItem(NOTATION_KEY);
  } catch {
    return null;
  }
}

/** A mentett jelölés; enélkül az alapértelmezés a felület nyelvéből (PQW-868). */
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

/**
 * Az ellenőrző szabályának szövege a felület nyelvén (PQW-900): a magyar ág a
 * magé (src/core/rules.ts), az angol a szótáré. A `finding.rule` sztring, ezért
 * ismeretlen szabálynál nincs szöveg; ilyenkor a hívó az azonosítót mutatja.
 */
function ruleText(rule: string): RuleText | undefined {
  return (RULE_TEXTS[uiLanguage()] as Readonly<Record<string, RuleText | undefined>>)[rule];
}

function structuralProblem(pattern: Pattern): string | null {
  const finding = validatePattern(pattern, libraryFor(pattern)).find((f) => STRUCTURAL_RULES.has(f.rule));
  return finding ? (ruleText(finding.rule)?.message ?? finding.rule) : null;
}

/* ---- Frissítés ---- */

const insetRight = () => (panel.hidden ? 0 : panel.getBoundingClientRect().width);
const insetLeft = () => (typesNav.hidden ? 0 : typesNav.getBoundingClientRect().width);
// Az írott minta a vászon alján: a lenyitott panel magassága alsó takarás (PQW-883).
const insetBottom = () => (written.hidden ? 0 : Math.max(0, canvas.getBoundingClientRect().bottom - written.getBoundingClientRect().top));
const fitBoard = () => board.fit(insetRight(), insetLeft(), insetBottom());
const showPoint = (point: Point) => board.ensureVisible(point, insetRight(), insetLeft(), insetBottom());

/** A vászon takarás nélküli része, vászon-koordinátában. */
function visibleArea(): Area {
  const { width, height } = canvas.getBoundingClientRect();
  return { left: insetLeft(), top: 0, right: width - insetRight(), bottom: height - insetBottom() };
}

/** A kurzor célpontja, ha a kiválasztott szem célpontba horgol. */
const cursorPoint = (): Point | undefined => (tool && isTargeted(tool) ? derived.targets[cursor]?.point : undefined);

function refresh(message?: Message): void {
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
  sizePanel.update(derived.pattern, derived.context.graph, derived.context.library);
  roundsPanel.update(derived.pattern);
  shapesPanel.update(derived.pattern);
  shawlsPanel.update(derived.pattern);
  garmentPanel.update(derived.pattern);
  // Kikapcsolt horgolásfajtánál a panel nem is épült meg (PQW-925).
  amigurumiPanel?.update(derived.pattern);
  gridPanel?.update(derived.pattern, mirror);
  if (message !== undefined) announce(message);
}

/** A vászon a már kiszámolt adatokból; a kijelölő téglalap húzásához ennyi elég. */
function draw(): void {
  // Szem nélkül, kijelölés nélkül és teli vágólappal a kurzor a beillesztés helyét mutatja (PQW-875).
  const pasting = tool === null && clipboard !== null && selection.length === 0;
  const aiming = (tool !== null && isTargeted(tool)) || pasting;
  // A sorfeliratok a nyitott oldalsávok között maradnak (PQW-916); a méretüket innen tudja a vászon.
  board.setInsets(insetLeft(), insetRight());
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
    insertions: nodeInsertions(derived.pattern.pieces[0]),
    // A rácsminta ismétlő egysége kerettel (PQW-864, C2C-ben csempénként), a lejjebb horgolt szem talpa (PQW-894).
    unitFrames: unitFrames(derived.pattern, derived.layout, mirror),
    spikes: spikeNodes(derived.pattern),
  });
}

function isTargeted(id: StitchDefId): boolean {
  const kind = resolveStitch(id)?.kind;
  return kind !== 'chain' && kind !== 'space' && kind !== 'ring' && kind !== 'picot';
}

/** Az üzenet a haladás mondatával kiegészítve. */
function withProgress(message: Message): Message {
  return typeof message === 'string' ? `${message} ${progress()}` : [...message, ` ${progress()}`];
}

function commit(result: EditResult, message: Message): void {
  if (!result.ok) {
    announce(renderCoreText(EDITOR_CORE_TEXTS[uiLanguage()], result.reason));
    return;
  }
  // A minta nem változott (pl. fordulás a láncalap után): nincs visszavonható lépés, csak az üzenet.
  if (result.pattern === history.present) {
    announce(withProgress(message));
    return;
  }
  history = record(history, result.pattern);
  cursorMoved = false;
  persist(history.present);
  // Előbb újraszámolunk, hogy az állapotsor már az új mintát írja le.
  refresh();
  announce(withProgress(message));
  const point = cursorPoint() ?? lastTop();
  if (point) showPoint(point);
}

function lastTop(): Point | undefined {
  const last = derived.pattern.pieces[0]?.stitches.at(-1);
  return last ? derived.layout.nodes.get(last.id)?.top : undefined;
}

function announce(message: Message): void {
  if (typeof message === 'string') status.textContent = message;
  else status.replaceChildren(...message);
  /*
   * A vászon fölött nincs többé lebegő szöveg (PQW-916), ezért a művelet
   * eredményének nem maradt látható nyoma: a fordulás után a képernyőn semmi
   * nem történt (PQW-924). A művelet visszajelzése mostantól a felül
   * felbukkanó dobozban is megjelenik, és három másodperc után magától
   * eltűnik — a rejtett élő régió a képernyőolvasóé marad.
   */
  showToast(status.textContent ?? '');
}

function layerName(context: WorkContext): string {
  // Az ovális 1. köre kör akkor is, amíg a másik oldalon nincs szem, és a gráf még sornak látja (PQW-902).
  return texts().messages.layer.name(context.layer, context.shape === 'round' || context.oval);
}

function progress(): string {
  const { context, check } = derived;
  if (!context.graph) return '';
  // A lezárt darab (a fonal elvágása vagy a kész szegély) után nincs következő sor vagy kör (PQW-897).
  if (pieceFinished(context.graph)) return '';
  const progressTexts = texts().messages.progress;
  if (!context.started) return progressTexts.next(capitalize(layerName(context)));
  const count = context.graph.layers[context.layer]?.stitchCount ?? 0;
  const rest = check.remaining > 0 ? progressTexts.remaining(check.remaining) : '';
  return `${progressTexts.current(capitalize(layerName(context)), count, rest)}${roundEndHint(context, check)}`;
}

/**
 * A kör végén a zárás alapértelmezése a mintatípusból (PQW-892): amigurumiban
 * spirál, máshol zárt kör. A varázskörbe horgolt körnél nincs „utolsó
 * célpont”, ott nem javasolunk.
 */
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
  // Csak a szemnév kap `lang` attribútumot; a láncív és a varázskör a felület nyelvén van.
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

/* ---- Felbukkanó figyelmeztetés ---- */

/** Ameddig a felbukkanó doboz látszik (PQW-923). */
const ALERT_MS = 3000;
let alertTimer: ReturnType<typeof setTimeout> | undefined;
/** A legutóbb megmutatott figyelmeztetések; csak a változásra villan fel a doboz. */
let shownWarnings = '';

/**
 * Új figyelmeztetésnél a doboz felbukkan a vászon tetején, és három másodperc
 * után magától eltűnik (PQW-923). A menüsor jobb szélén lévő tartós jelző
 * marad: ott bármikor visszanézhető, mi a baj. Udvarias élő régió, ezért nem
 * szakítja félbe a képernyőolvasót.
 */
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
  // A szótári címke már tartalmazza a kettőspontot („Figyelmeztetés: ”), ezért itt nem teszünk hozzá újat.
  showToast(`${texts().messages.findings.warning}${ruleText(first.rule)?.message ?? first.rule}`);
}

/** A felül felbukkanó doboz: három másodpercre megmutat egy üzenetet (PQW-923, PQW-924). */
function showToast(text: string): void {
  if (text.trim() === '') return;
  clearTimeout(alertTimer);
  alertBox.textContent = text;
  alertBox.hidden = false;
  alertTimer = setTimeout(() => {
    alertBox.hidden = true;
  }, ALERT_MS);
}

/* ---- Vezérlők állapota ---- */

function updateControls(): void {
  const { context, pattern, check } = derived;
  const empty = (pattern.pieces[0]?.stitches.length ?? 0) === 0;
  setDisabled('undo', !canUndo(history));
  setDisabled('redo', !canRedo(history));
  const canFill = tool !== null && isTargeted(tool) && context.graph !== null && context.slots.some((_, i) => !context.used[i]);
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
      : [errors ? errorBar.errors(errors) : '', warnings ? errorBar.warnings(warnings) : ''].filter(Boolean).join(' · ');
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
      // A főszöveg a felhasználónak szóló üzenet; a tudásbázis-kód csak lenyitva (PQW-879).
      button.append(severity, rule?.message ?? finding.rule, span('finding__count', findings.nodes(finding.nodes.length)));
      button.addEventListener('click', () => {
        const first = finding.nodes.find((id) => derived.layout.nodes.has(id));
        if (!first) return;
        /*
         * A figyelmeztetésre kattintva odagörgetünk, de nem jelölünk ki
         * (PQW-923): a kiemelő négyzet zsúfolttá tette a rajzot, és a szem
         * helyét a szaggatott karika úgyis mutatja.
         */
        closePopover(errorsPop, errorToggle);
        showPoint(derived.layout.nodes.get(first)!.top);
      });
      item.append(button);
      if (rule) {
        const details = document.createElement('details');
        details.className = 'finding__more';
        const more = document.createElement('summary');
        more.textContent = findings.details;
        const body = span('finding__ref', findings.reference(finding.reference));
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
    // A szem neve a jelölés nyelvén, saját lang attribútummal (PQW-853); a magyar utótag kívül marad.
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

/** A jelkészlet súgója; a szemnév saját `lang` attribútummal (PQW-853). */
function setHint(message: Message): void {
  if (typeof message === 'string') hint.textContent = message;
  else hint.replaceChildren(...message);
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
    // A panel enélkül is működik, csak az állapota nem marad meg.
  }
  updateWritten();
}

/**
 * A panel nyitott-e induláskor: a megjegyzett állapot, ennek hiányában CSUKVA
 * (PQW-911). Üres mintán úgyis csak annyit írna ki, hogy nincs mit kiírni, és
 * a vászon közepére sem lehetne kattintani (PQW-891). Az amigurumi a
 * típusválasztáskor maga nyitja ki.
 */
function readWrittenOpen(): boolean {
  // Üres mintán a panel akkor sem nyílik ki, ha a tárolt állapot „nyitva”
  // (PQW-915): üresen úgyis csak annyit írna ki, hogy nincs mit kiírni. A
  // PQW-911 csak az alapértelmezést állította csukottra, a tárolt állapotot nem.
  if ((history.present.pieces[0]?.stitches.length ?? 0) === 0) return false;
  try {
    const stored = localStorage.getItem(WRITTEN_KEY);
    if (stored !== null) return stored !== 'zarva';
  } catch {
    // A tárolás nélkül csukva indulunk.
  }
  return false;
}

/* ---- Az írott minta magassága (PQW-885) ---- */

/**
 * A panel magassága a munkaterület hányadában, vagy `null`: az alapértelmezés
 * (styles.css: legfeljebb 22rem, alacsony ablakban a munkaterület fele). Csak
 * a lapon belül él; újratöltés után az alapértelmezés jön.
 */
let writtenShare: number | null = null;
/** A „Teljes nézet” előtti hányad; a „Vissza” ide áll. */
let writtenBefore: number | null = null;

function setStyle(element: HTMLElement, name: string, value: string): void {
  if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
}

/** A panel magasságának tartománya: a fejléctől (a szövegtörzs tetejéig) a teljes munkaterületig. */
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

/** Húzás és billentyű után; a „Vissza” ezután az alapértelmezésre áll. */
function resizeWritten(size: number): void {
  const { max } = writtenRange();
  writtenBefore = null;
  applyWrittenShare(max > 0 ? size / max : null);
}

/** Az állapotsor helye, a legkisebb magasság, az elválasztó értéke és a gomb felirata a panel mostani méretéhez. */
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
  // A szemnevek a jelölést követik, a listák feliratai a nyelvet és a jelölést (PQW-900).
  setTermsLocale(notation.terms);
  relabelSelects(document);
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
  applyNotation({ ...notation, terms }, texts().messages.notation.terms(termsLabel(terms)));
});

styleSelect.addEventListener('change', () => {
  const chartStyle = styleSelect.value as PatternNotation['chartStyle'];
  applyNotation({ ...notation, chartStyle }, texts().messages.notation.chartStyle(chartStyleLabel(chartStyle)));
});

scMarkField.addEventListener('change', (event) => {
  const singleCrochet = (event.target as HTMLInputElement).value as PatternNotation['singleCrochet'];
  applyNotation({ ...notation, singleCrochet }, texts().messages.notation.singleCrochet(singleCrochet === 'plus' ? '+' : '×'));
});

// Az előbeállítás a mintához tartozik: a számolás a mintában, a jelek a jelölésben változnak (PQW-876).
traditionSelect.addEventListener('change', () => {
  const tradition = traditionSelect.value as Tradition;
  const result = setTradition(history.present, tradition);
  if (!result.ok) return;
  applyNotation(notationForTradition(notation, tradition), '');
  commit(result, texts().messages.notation.tradition(traditionLabel(tradition)));
});

/* ---- A felület nyelve (PQW-900) ---- */

/**
 * Nyelvváltás a lapon belül: a statikus feliratok, a főoldal linkje, a címsor
 * `?lang` paramétere és az egész felület (paletta, mintatípusok, panelek,
 * állapotsor) az új nyelven. Új tárolókulcsot nem vezetünk be; a választást a
 * címsor őrzi, így a link megosztható és újratölthető.
 */
function changeLanguage(language: UiLanguage): void {
  setUiLanguage(language);
  rememberLanguage(language);
  document.documentElement.lang = language;
  applyStaticTexts(document, texts().markup);
  showModifierNames();
  if (homeLink) homeLink.href = homeUrl(language);
  // Itt a `history` a szerkesztő visszavonási verme, ezért a böngészőé kiírva.
  window.history.replaceState(window.history.state, '', urlWithLanguage(location.href, language));
  // A jelölés alapértelmezése a felület nyelvéből jön, a mentett választás marad (PQW-868).
  if (storedNotation() === null) {
    notation = defaultNotation(language);
    symbols = symbolOptionsFor(notation);
  }
  syncNotationControls();
  renderTypes();
  renderPalette();
  // A `select` a súgót és a beszúrási panelt, a benne lévő `refresh` a vásznat,
  // a panelek szövegeit, az összefoglalót és a hibalistát rajzolja újra.
  select(tool);
  syncWrittenSize();
  announce(texts().messages.language.changed);
}

if (languageSelect) {
  languageSelect.value = startLanguage;
  languageSelect.addEventListener('change', () => changeLanguage(languageSelect.value === 'en' ? 'en' : 'hu'));
}

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

  // A gyorsbillentyű `Alt`-tal szól, mert egyetlen karakter nem lehet parancs;
  // a felirata Mac gépen ⌥, máshol Alt (PQW-911).
  if (item.key) {
    const key = document.createElement('kbd');
    key.className = 'stitch__key';
    key.textContent = modifierCombo(item.key, currentPlatform());
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
  insertionPanel.update(item?.def, notation.terms);
  const hints = texts().messages.hint;
  if (!item) setHint(hints.none);
  else if (kind === 'chain' || kind === 'space') setHint(withStitchName(hints.chain, item.name));
  else if (kind === 'ring' || kind === 'picot') setHint(withStitchName(hints.simple, item.name));
  else setHint(withStitchName(hints.targeted, item.name));
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
  const words = texts().messages.slot;
  if (slot.kind === 'space') return words.space;
  if (slot.kind === 'ring') return words.ring;
  return derived.context.graph?.defs.get(slot.id)?.kind === 'chain' ? words.chain : words.stitch;
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
  // Ismeretlen szemnél az azonosító áll az üzenetben: annak nincs nyelve.
  const named = def !== undefined;

  // Láncszem, láncív, varázskör, pikó: célpont nélkül, kérdés nélkül.
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

  // Foglalt célpont: nem tesz le csendben szemet, hanem megkérdezi a szaporítást (PQW-879).
  if (slot && context.used[idx]) {
    const yes = await askConfirm({
      message: messages.dialog.increaseQuestion(slotWord(slot)),
      confirmLabel: messages.dialog.increaseConfirm,
    });
    if (!yes) {
      announce(messages.work.nothingPlaced);
      return;
    }
    const increase = idx === context.frontier ? workIntoSame(history.present, tool) : work(history.present, { def: tool, count, insertion: insertionPanel.insertion }, idx, [], editorMode());
    commit(increase, withStitchName(messages.work.increase, name, named));
    return;
  }

  // A haladási irány ellen lévő (már mögötted hagyott) szabad célpont: keresztezett szem?
  if (slot && context.frontier >= 0 && idx <= context.frontier) {
    const yes = await askConfirm({
      message: messages.dialog.crossedQuestion,
      confirmLabel: messages.dialog.crossedConfirm,
    });
    if (!yes) {
      announce(messages.work.nothingPlaced);
      return;
    }
    commit(
      work(history.present, { def: tool, count, insertion: insertionPanel.insertion }, idx, ['crossed'], editorMode()),
      withStitchName(messages.work.crossed, name, named),
    );
    return;
  }

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
  const base = title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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
    colors: { rowA: token('--c-row-a'), rowB: token('--c-row-b'), cell: token('--c-grid'), row: token('--c-grid-row'), strong: token('--c-grid-strong') },
  };
  const layout = layoutPattern(pattern, library, { mirror, stemLength: stem });
  return chartSvg(pattern, layout, library, {
    tradition: traditionOf(pattern.conventions),
    unitFrames: unitFrames(pattern, layout, mirror),
    spikes: spikeNodes(pattern),
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
    announce(texts().messages.file.pngSaved);
  } catch {
    announce(texts().messages.file.pngFailed);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function importJson(file: File): Promise<void> {
  const file_ = texts().messages.file;
  const loaded = loadPattern(await file.text());
  if (!loaded.ok) {
    announce(file_.loadFailed(renderCoreText(JSON_CORE_TEXTS[uiLanguage()], loaded.error.message), loaded.error.path));
    return;
  }
  const problem = structuralProblem(loaded.pattern);
  if (problem) {
    announce(file_.brokenStructure(problem));
    return;
  }
  selectedNode = null;
  selection = [];
  const recorded = loaded.pattern.notation?.terms;
  const note = recorded && recorded !== notation.terms ? file_.notationNote(termsLabel(recorded), termsLabel(notation.terms)) : '';
  commit({ ok: true, pattern: loaded.pattern }, file_.loaded(note));
  fitBoard();
}

/* ---- Kijelölés, törlés, másolás, beillesztés (PQW-875) ---- */

/** A kijelölés egész egységekre bővítve; a fókusz csak kijelölt szem lehet. */
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
  // A fókuszban lévő szem neve a jelölés nyelvén, saját `lang` attribútummal (PQW-853).
  return [...withStitchName(selectionTexts.focus, capitalize(stitchName(def, notation.terms))), count];
}

function setAreaMode(on: boolean): void {
  if (on && tool) select(null);
  areaMode = on;
  document.body.classList.toggle('is-selecting', on);
  refresh(on ? texts().messages.selection.areaOn : texts().messages.selection.areaOff);
}

/** Ha más szem is horgol a kijelöltekbe, megmutatja őket, és megkérdezi, törölje-e velük együtt. */
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
      message: messages.dialog.deleteQuestion(plan.selected.length, plan.dependents.length, describeByLayer(pattern, plan.dependents)),
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
  const where = result.fragment.startsLayer ? selectionTexts.asLayer(result.fragment.shape === 'round') : selectionTexts.atCursor;
  announce(selectionTexts.copied(result.fragment.stitches.length, where));
}

function pasteClipboard(): void {
  const selectionTexts = texts().messages.selection;
  if (!clipboard) return announce(selectionTexts.clipboardEmpty);
  commitInserted(pasteFragment(history.present, clipboard, cursorMoved ? cursor : undefined), selectionTexts.pasted(clipboard.stitches.length));
}

function duplicateSelected(): void {
  const selectionTexts = texts().messages.selection;
  if (selection.length === 0) return announce(selectionTexts.nothingToDuplicate);
  commitInserted(duplicateSelection(history.present, selection), selectionTexts.duplicated(selection.length));
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
    refresh(texts().messages.work.undo);
  },
  redo: () => {
    history = redo(history);
    cursorMoved = false;
    persist(history.present);
    refresh(texts().messages.work.redo);
  },
  'delete-last': () => commit(deleteLast(history.present), texts().messages.work.deleteLast),
  'select-area': () => setAreaMode(!areaMode),
  'delete-selection': () => void deleteSelection(),
  'duplicate-selection': () => duplicateSelected(),
  same: () =>
    tool ? commit(workIntoSame(history.present, tool), texts().messages.work.sameAgain) : announce(texts().messages.work.needStitchShort),
  'fill-row': () =>
    tool && isTargeted(tool)
      ? commit(
          fillRow(history.present, { def: tool, count: Number(countInput.value), insertion: insertionPanel.insertion }, editorMode()),
          texts().messages.work.fillRow(insertionSuffix(insertionPanel.insertion)),
        )
      : announce(texts().messages.work.needTargetStitch),
  'end-row': () =>
    commit(
      endRow(history.present, tool),
      onFoundationChain(derived.context) ? texts().messages.work.foundationDone : texts().messages.work.rowEnd,
    ),
  'close-round': () =>
    commit(
      closeRound(history.present),
      canJoinChainRing(history.present) ? texts().messages.work.chainRing : texts().messages.work.roundClosed,
    ),
  'spiral-round': () => commit(endRoundSpiral(history.present), texts().messages.work.spiral),
  grid: () => {
    showGrid = !showGrid;
    try {
      localStorage.setItem(GRID_KEY, showGrid ? 'lathato' : 'rejtett');
    } catch {
      // A rács enélkül is kapcsolható, csak újratöltés után nem marad meg.
    }
    refresh(showGrid ? texts().messages.view.gridOn : texts().messages.view.gridOff);
  },
  'zoom-in': () => board.zoom(1.25),
  'zoom-out': () => board.zoom(0.8),
  fit: () => fitBoard(),
  'export-json': () => {
    download(savePattern(withNotation(history.present, notation)), `${slug(history.present.title)}.json`, 'application/json');
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
    selectedNode = null;
    selection = [];
    // A profilok a horgolóhoz tartoznak, nem a mintához: az új mintába is átkerülnek (PQW-859).
    const gauge = history.present.gauge;
    commit({ ok: true, pattern: { ...emptyPattern(), ...(gauge ? { gauge } : {}) } }, texts().messages.work.newPattern);
    /*
     * Az új minta üres, ezért a panel csukódjon (PQW-915). A tárolt állapotot
     * szándékosan NEM írjuk át: ha a felhasználó legközelebb kinyitja, a
     * választása megmarad. A `setOpen` csak a láthatóságot állítja.
     */
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
  // A kézzel írt cím saját cím: a generátor nem írja felül (PQW-896).
  if (title !== history.present.title) {
    commit({ ok: true, pattern: { ...history.present, title, titleGenerated: false } }, texts().messages.work.titleChanged);
  }
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
  closePopover(filePop, fileToggle);
}

errorToggle.addEventListener('click', () => togglePopover(errorsPop, errorToggle));

fileToggle.addEventListener('click', () => {
  const opening = filePop.hidden;
  closeAllPopovers();
  if (opening) {
    openPopover(filePop, fileToggle);
    // Billentyűzettel is járható: a nyitás után az első művelet kapja a fókuszt.
    filePop.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }
});

// A menüből kiválasztott művelet után a menü csukódjon, hogy ne takarja a vásznat.
filePop.addEventListener('click', (event) => {
  if ((event.target as Element).closest('button')) closePopover(filePop, fileToggle);
});

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

      // A magyarázat tooltipben áll, hogy a kártyán csak a név maradjon (PQW-911).
      button.dataset.tip = type.detail;
      button.append(typeIcon(type.id));
      const label = span('type__label', '');
      label.append(span('type__name', type.name));
      // A „hamarosan” jelvény a név ALATT, a feliratdobozon belül (PQW-912): a
      // keskeny sávban a név mellé nem fért el, és rárajzolódott a névre.
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
    // A választás enélkül is érvényes, csak újratöltés után nem marad meg.
  }
  for (const button of typesList.querySelectorAll<HTMLButtonElement>('.type')) {
    button.setAttribute('aria-pressed', String(button.dataset.type === id));
  }
  const type = PATTERN_TYPES.find((candidate) => candidate.id === id);
  // A rács típusa a mintatípussal együtt vált (PQW-874).
  refresh();
  showTypeView(id);
  if (type) announce(texts().messages.types.selected(type.name, type.detail));
}

typesToggle.addEventListener('click', () => {
  const open = typesNav.hasAttribute('hidden');
  setOpen(typesNav, typesToggle, open);
  rememberTypesOpen(open);
  // A vászon a sáv szélességéhez igazodik, ezért a csukás után újra be kell illeszteni.
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
  /*
   * A típushoz tartozó méretarány a nyitás pillanatában érvényesül (PQW-912):
   * amigurumiban a szöveg az elsődleges nézet, de a panelt a felhasználó nyitja.
   * Csak akkor szól bele, ha nincs saját magasság — amit a felhasználó az
   * elválasztóval beállított, azt nem vesszük el tőle.
   */
  if (open && writtenShare === null) applyWrittenShare(writtenShareFor(patternType, NARROW.matches));
  if (open && NARROW.matches) setOpen(panel, toggle, false);
});

/* Az elválasztó egérrel, érintéssel és billentyűzettel (PQW-885). */
let gripDrag: { readonly pointer: number; readonly y: number; readonly size: number; readonly share: number | null } | null = null;

writtenGrip.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  writtenGrip.setPointerCapture(event.pointerId);
  gripDrag = { pointer: event.pointerId, y: event.clientY, size: written.getBoundingClientRect().height, share: writtenShare };
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
  // A fejléc alá húzott panel lecsukódik, és újranyitáskor a húzás előtti magasságot kapja.
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
  // Itt a nyilak, a Home és az End a panel magasságát állítják, nem a vászon kurzorát.
  event.preventDefault();
  event.stopPropagation();
  resizeWritten(size);
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
    const name = texts().messages.layer.name(label, layer?.shape === 'round');
    setSelection(event.shiftKey ? [...selection, ...ids] : ids, null, texts().messages.selection.layer(name, layer?.stitchCount ?? 0));
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
    setSelection(additive ? [...selection, ...inside] : inside, null, inside.length === 0 ? texts().messages.selection.emptyRect : undefined);
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
  // A nyitott párbeszédablak a saját gombjaival és az Esc-kel dolgozik.
  /*
   * A szövegmezőkben a böngésző alapértelmezése az úr (PQW-911) — egyetlen
   * kivétellel: a láncszemszám mezőjében az Enter horgol (PQW-915). A
   * jelkészlet súgója ezt ígéri („Enterrel vagy a vászonra kattintva
   * horgolod”), és enélkül a billentyűzetes használat megszakad: a felhasználó
   * beírja a számot, megnyomja az Entert, és nem történik semmi.
   */
  const chainCountEnter = target === countInput && event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.altKey;
  if (target.closest('input, textarea, select, dialog') && !chainCountEnter) return;
  if (chainCountEnter) {
    event.preventDefault();
    void workAtCursor();
    return;
  }
  const key = event.key;

  // A nyitott hibalistát az Escape először bezárja, és a fókuszt visszaviszi a gombra.
  // A nyitott lenyílót az Escape bezárja, és a fókuszt visszaviszi a gombjára (PQW-911).
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
    } else if (lower === 'c' && !inWritten) {
      // Kijelölés nélkül is ide fut (PQW-911): a `copySelected` megmondja, hogy
      // nincs mit másolni. Korábban a feltétel némán elnyelte a billentyűt, és
      // úgy tűnt, mintha a másolás nem működne.
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
      return;
    }
    /*
     * A parancsok `Alt`-tal szólnak (PQW-911): egyetlen karakter nem lehet
     * parancs, a `Ctrl`/`Cmd`+szám pedig a böngésző lapváltása. A billentyű
     * fizikai helyét nézzük (`code`), mert macOS-en az `Alt`+betű más karaktert
     * ad. Szövegmezőben ez az ág el sem indul: a kezelő fent kilép.
     */
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
      // Kijelöléssel a kijelölt szemek, anélkül az utolsó lépés (PQW-875).
      if (selection.length > 0) void deleteSelection();
      else ACTIONS['delete-last']!();
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

});

/* ---- Méret és fonal (PQW-859) ---- */

const sizePanel = new SizePanel(must<HTMLDetailsElement>('#section-size'), {
  commit: (pattern, message) => commit({ ok: true, pattern }, message),
  announce,
  setAspect: (on) => {
    aspect = on;
    refresh(on ? texts().messages.view.aspectOn : texts().messages.view.aspectOff);
    fitBoard();
  },
});

/* ---- Kör és motívum (PQW-861) ---- */

const roundsPanel = new RoundsPanel(must<HTMLDetailsElement>('#section-rounds'), {
  commit: (pattern, message) => {
    selectedNode = null;
    selection = [];
    commit({ ok: true, pattern }, message);
    fitBoard();
  },
  announce,
});

/* ---- Forma (PQW-862) ---- */

const shapesPanel = new ShapesPanel(must<HTMLDetailsElement>('#section-shape'), {
  commit: (pattern, message) => {
    selectedNode = null;
    selection = [];
    commit({ ok: true, pattern }, message);
    fitBoard();
  },
  announce,
});

/* ---- Kendő (PQW-865) ---- */

const shawlsPanel = new ShawlsPanel(must<HTMLDetailsElement>('#section-shawl'), {
  commit: (pattern, message) => {
    selectedNode = null;
    selection = [];
    commit({ ok: true, pattern }, message);
    fitBoard();
  },
  announce,
});

/* ---- Ruhadarab (PQW-866) ---- */

const garmentPanel = new GarmentPanel(must<HTMLDetailsElement>('#section-garment'), {
  commit: (pattern, message) => {
    selectedNode = null;
    selection = [];
    commit({ ok: true, pattern }, message);
    fitBoard();
  },
  announce,
});

/* ---- Kikapcsolt horgolásfajták (PQW-925) ---- */

/**
 * Egy mintatípushoz tartozó panel csak akkor épül meg, ha a típus be van
 * kapcsolva (PQW-925). Kikapcsolt típusnál a szakasz elrejtve, a panel pedig
 * `null`: így a kikapcsolt horgolásfajta kódútvonala futás közben
 * elérhetetlen, miközben a fájlok a helyükön maradnak. A visszakapcsolás a
 * `pattern-types.ts` listájában egy `true`.
 */
function panelFor<T>(type: PatternTypeId, selector: string, build: (section: HTMLDetailsElement) => T): T | null {
  const section = must<HTMLDetailsElement>(selector);
  if (isAvailableType(type)) return build(section);
  section.hidden = true;
  return null;
}

/* ---- Amigurumi (PQW-863) ---- */

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

/* ---- Rácsminta (PQW-864) ---- */

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

/**
 * Amigurumiban az írott minta az elsődleges nézet: a panel nagyban nyílik, és az Amigurumi szakasz lenyílik.
 * Filéhorgolásnál a Rácsminta szakasz nyílik le (PQW-864).
 */
function showTypeView(id: PatternTypeId): void {
  if (id === 'filet') gridPanel?.reveal();
  const share = writtenShareFor(id, NARROW.matches);
  if (share === null) return;
  /*
   * Az írott minta panel csak a saját gombjára nyílik (PQW-912). A típusváltás
   * eddig felnyitotta — így ugrott fel új minta kezdésekor is —, most csak a
   * helyes arányt adja meg, ha a felhasználó már kinyitotta. Amigurumiban a
   * szöveg továbbra is az elsődleges nézet, de a felhasználó dönt róla.
   */
  if (!written.hidden) applyWrittenShare(share);
  amigurumiPanel?.reveal();
}

/* ---- Indulás ---- */

syncNotationControls();
renderTypes();
renderPalette();
setOpen(typesNav, typesToggle, readTypesOpen() && !NARROW.matches);
setOpen(panel, toggle, !NARROW.matches);
setOpen(written, writtenToggle, readWrittenOpen() && !NARROW.matches);
showTypeView(patternType);

// A futó verzió a sarokban (PQW-903): a `package.json` verziója, build időben beégetve.
must<HTMLElement>('#version').textContent = `v${__APP_VERSION__}`;
select(null);
fitBoard();

/*
 * Az írott minta nyitásakor, csukásakor és átméretezéskor a nézet igazodik
 * (PQW-883): a kurzor a takarás fölé kerül; kurzor nélkül újra illesztünk, ha
 * eddig az egész minta látszott, most viszont takarásba kerülne. Az állapotsor
 * a panel fölé kerül (`--written-block`). Ha a panel a teljes munkaterületet
 * elfedi, a vászon nem igazodik (PQW-885).
 */
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
// Az állapotsor új üzenete csak a helyét állítja, a nézetet nem mozdítja.
new ResizeObserver(syncWrittenSize).observe(status);

alignTooltips(must<HTMLElement>('.tools'));
setupConsentBanner(GA_MEASUREMENT_ID);

// Böngészős tesztekhez (PQW-874, PQW-883): a rács cellái, a sorszámok és a kurzor célpontja az ablakban; csak automatizált böngészőben.
if (navigator.webdriver) {
  Object.assign(window, {
    mintatervezoRacs: {
      layer: () => derived.context.layer,
      cells: () => board.gridCells(),
      // A rács befoglaló téglalapja (PQW-887).
      bounds: () => board.gridBounds(),
      labels: () => board.labels(),
      // A sorfelirat, a nyíl és a szemek befoglaló téglalapja: az átfedést mérni kell, nem szemre nézni (PQW-916).
      labelBoxes: () => board.labelBoxes(),
      arrowBox: () => board.arrowBox(),
      stitchBoxes: () => board.stitchBoxes(),
      cursor: () => {
        const point = cursorPoint();
        return point ? board.toClient(point) : null;
      },
    },
    // A szemek helye és a kijelölés (PQW-875).
    mintatervezoKijeloles: {
      selection: () => [...selection],
      nodes: () => [...derived.layout.nodes.values()].map((node) => ({ id: node.id, def: node.def, layer: node.layer, ...board.toClient(node.top) })),
    },
  });
}

/*
 * A választott nyelv megőrzése (PQW-906). Működési beállítás: nem azonosítja a
 * látogatót, ezért a süti-sáv elutasítása mellett is él. Privát ablakban vagy
 * letiltott tárolásnál a hívás dobhat, ilyenkor a tervező alapnyelven indul.
 */
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
    // A nyelv enélkül is átáll, csak a következő megnyitáskor nem marad meg.
  }
}

/*
 * A módosító neve a rendszer szerint (PQW-911): a Macen nincs „Alt” feliratú
 * billentyű, ott ez az Option (⌥). A billentyűkezelés ettől nem változik, csak
 * amit a felhasználó olvas: a tooltipek és a „Billentyűk” lista jelölései.
 * A szótár mindenhol „Alt”-ot ír, itt cseréljük egyszer, a behelyettesítés után.
 */
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

/*
 * A mintatípus-sáv nyitott állapota a következő megnyitásig (PQW-912). Ugyanaz a
 * minta, mint a nyelvnél: működési beállítás, `try/catch`-ben, mert privát
 * ablakban a tárolás dobhat — ilyenkor a sáv az ablakszélesség szerint indul.
 */
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
    // A sáv enélkül is nyitható, csak az állapota nem marad meg.
  }
}
