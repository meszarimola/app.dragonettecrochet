/*
 * A „Rácsminta” szakasz tartalma (PQW-864): a technikák, az ecsetek, a rács
 * mérete és cellaaránya, az ismétlő egység állapota, a terv kiírása, a fonal
 * színenként, a minta létrehozása, és az ismétlő egység kerete a diagramon.
 *
 * DOM nélküli, ezért a Node is futtatja (tests/ui-grid-chart-view.test.mjs), és a
 * magot `.ts` kiterjesztéssel importálja.
 */

import { generateC2C, planC2C } from '../core/c2c.ts';
import { generateColorwork, planColorwork } from '../core/colorwork.ts';
import { filetRowPositions, generateFilet, planFilet } from '../core/filet.ts';
import { buildPieceGraph } from '../core/graph.ts';
import { article } from '../core/hungarian.ts';
import type { ChartLayout } from '../core/layout.ts';
import { patternSize } from '../core/pattern-size.ts';
import {
  FILLED,
  MAX_COLORS,
  NO_CELL,
  OPEN,
  TECHNIQUE_NAMES,
  TECHNIQUE_STITCH,
  cellCounts,
  cellSize,
  colorLetter,
  detectUnit,
  emptyDraft,
  expandDraft,
  hasGaps,
  mirrorWarning,
  overCarriedRows,
  proportionalRows,
  unitConflicts,
  unitProblem,
  yarnByColor,
  type CellSize,
  type DraftCell,
} from '../core/pixel-chart.ts';
import { bounds, type Quantity } from '../core/quantity.ts';
import { shapeGauge } from '../core/shapes.ts';
import { libraryFor } from '../core/stitch-variants.ts';
import type { GridTechnique, GridUnit, Pattern, PatternColor, ValueSource } from '../core/types.ts';
import type { Choice } from './shapes-view.ts';
import { formatNumber } from './size-view.ts';

/** A szerkesztőben választható technikák; a mozaik még nem készül. */
export type EditorTechnique = Exclude<GridTechnique, 'mosaic'>;

export const EDITOR_TECHNIQUES: readonly EditorTechnique[] = ['filet', 'c2c', 'tapestry', 'graphgan'];

export const TECHNIQUE_CHOICES: readonly Choice<EditorTechnique>[] = EDITOR_TECHNIQUES.map((value) => ({ value, label: TECHNIQUE_NAMES[value] }));

export const DEFAULT_COLORS: readonly PatternColor[] = [
  { name: 'Natúr', hex: '#f3ecdf' },
  { name: 'Bordó', hex: '#8c2f4a' },
];

const MORE_COLORS: readonly PatternColor[] = [
  { name: 'Kék', hex: '#2f5f9e' },
  { name: 'Zöld', hex: '#3f7d4e' },
  { name: 'Mustár', hex: '#c8932e' },
  { name: 'Fekete', hex: '#241f2b' },
  { name: 'Rózsa', hex: '#c86b85' },
  { name: 'Barna', hex: '#7a5a3c' },
];

export const DEFAULT_WIDTH = 12;
export const DEFAULT_HEIGHT = 8;

export interface GridEditorState {
  readonly technique: EditorTechnique;
  /** Sorok alulról, cellák balról; `null`: meg nem adott cella, az ismétlő egység tölti ki. */
  readonly draft: readonly (readonly DraftCell[])[];
  readonly colors: readonly PatternColor[];
  /** A kézzel megjelölt ismétlő egység; `null`: a program keresi. */
  readonly manualUnit: GridUnit | null;
  readonly lettering: boolean;
}

export const usesColors = (technique: EditorTechnique) => technique !== 'filet';

/** Az új rács cellái: filében nyitott háló, színes rácsban az első szín. */
export const defaultFill = (technique: EditorTechnique): number => (technique === 'filet' ? OPEN : 0);

export function defaultState(technique: EditorTechnique = 'filet', width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT): GridEditorState {
  return { technique, draft: emptyDraft(width, height, defaultFill(technique)), colors: DEFAULT_COLORS, manualUnit: null, lettering: false };
}

/** Másik technika: a filé és a színes rács cellái nem vihetők át, a méret és a színek maradnak. */
export function withTechnique(state: GridEditorState, technique: EditorTechnique): GridEditorState {
  if (technique === state.technique) return state;
  const width = state.draft[0]?.length ?? DEFAULT_WIDTH;
  const same = usesColors(technique) === usesColors(state.technique);
  return {
    ...state,
    technique,
    draft: same ? state.draft : emptyDraft(width, state.draft.length, defaultFill(technique)),
    manualUnit: same ? state.manualUnit : null,
  };
}

/** A rács új mérete: a meglévő cellák maradnak, az új cellák meg nem adottak. */
export function resizeDraft(draft: readonly (readonly DraftCell[])[], width: number, height: number): DraftCell[][] {
  return Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => draft[y]?.[x] ?? null));
}

/** A következő új szín, vagy `null`, ha már nincs hely. */
export function nextColor(colors: readonly PatternColor[]): PatternColor | null {
  if (colors.length >= MAX_COLORS) return null;
  return MORE_COLORS.find((color) => !colors.some((other) => other.hex === color.hex)) ?? { name: `${colors.length + 1}. szín`, hex: '#8d819c' };
}

/** Szín törlése: a törölt színű cellák az első megmaradó színt kapják, a későbbi indexek eggyel lejjebb lépnek. */
export function removeColor(state: GridEditorState, index: number): GridEditorState {
  if (state.colors.length <= 1) return state;
  const shift = (cell: DraftCell) => (cell === null ? null : cell === index ? 0 : cell > index ? cell - 1 : cell);
  return {
    ...state,
    colors: state.colors.filter((_, i) => i !== index),
    draft: state.draft.map((row) => row.map(shift)),
  };
}

/* ---- Ecset és cella ---- */

export interface Brush {
  /** A választó értéke. */
  readonly key: string;
  readonly value: DraftCell;
  readonly label: string;
  /** A szín mintája; filében `null`. */
  readonly swatch: string | null;
}

export function brushesFor(state: GridEditorState): Brush[] {
  const unset: Brush = { key: 'unset', value: null, label: 'Törlés: az ismétlésből töltődik', swatch: null };
  if (!usesColors(state.technique)) {
    return [
      { key: 'filled', value: FILLED, label: 'Teli cella', swatch: null },
      { key: 'open', value: OPEN, label: 'Nyitott cella', swatch: null },
      { key: 'none', value: NO_CELL, label: 'Nincs cella (alakítás)', swatch: null },
      unset,
    ];
  }
  return [...state.colors.map((color, i) => ({ key: `color-${i}`, value: i, label: `${colorLetter(i)}: ${color.name}`, swatch: color.hex })), unset];
}

export function valueName(state: GridEditorState, value: DraftCell): string {
  if (value === null) return 'nincs megadva';
  if (!usesColors(state.technique)) return value === FILLED ? 'teli' : value === OPEN ? 'nyitott' : 'nincs cella';
  return `${colorLetter(value)} szín, ${state.colors[value]?.name ?? 'ismeretlen'}`;
}

/** A cella akadálymentes neve: „3. sor, 5. cella: teli”. */
export function cellLabel(state: GridEditorState, x: number, y: number): string {
  return `${y + 1}. sor, ${x + 1}. cella: ${valueName(state, state.draft[y]?.[x] ?? null)}`;
}

export function cellAppearance(state: GridEditorState, value: DraftCell): { readonly className: string; readonly color: string | null } {
  if (value === null) return { className: 'grid-cell grid-cell--unset', color: null };
  if (!usesColors(state.technique)) {
    const kind = value === FILLED ? 'filled' : value === OPEN ? 'open' : 'none';
    return { className: `grid-cell grid-cell--${kind}`, color: null };
  }
  return { className: 'grid-cell grid-cell--color', color: state.colors[value]?.hex ?? null };
}

/** Egy cella mérete a mintasűrűségből: a technika szeme a minta profiljából, profil nélkül becsléssel. */
export function editorCellSize(pattern: Pattern, technique: EditorTechnique): CellSize {
  return cellSize(technique, shapeGauge(pattern, TECHNIQUE_STITCH[technique]));
}

/** A cella képernyőmérete a valós arányban: a hosszabb oldal `base` pixel, a rövidebb legalább `min`. */
export function cellPixels(cell: CellSize, base = 20, min = 8): { readonly width: number; readonly height: number } {
  const ratio = cell.widthCm / cell.heightCm;
  if (!Number.isFinite(ratio) || ratio <= 0) return { width: base, height: base };
  return ratio >= 1
    ? { width: base, height: Math.max(min, Math.round(base / ratio)) }
    : { width: Math.max(min, Math.round(base * ratio)), height: base };
}

/* ---- Ismétlő egység ---- */

export interface UnitState {
  readonly unit: GridUnit | null;
  readonly text: string;
  /** Az egység hibás vagy nem ismerhető fel, pedig van meg nem adott cella. */
  readonly problem: boolean;
}

const cellFrom = (unit: GridUnit) => `${article(unit.y + 1)} ${unit.y + 1}. sor ${unit.x + 1}. cellájától`;

export function unitState(state: GridEditorState): UnitState {
  if (state.manualUnit) {
    const problem = unitProblem(state.draft, state.manualUnit);
    if (problem) return { unit: null, text: problem, problem: true };
    const { width, height } = state.manualUnit;
    const conflicts = unitConflicts(state.draft, state.manualUnit);
    const note = conflicts > 0 ? ` ${conflicts} megadott cella eltér tőle (pl. szegély): ezek maradnak.` : '';
    return { unit: state.manualUnit, text: `Ismétlő egység, kézzel: ${width} × ${height} cella, ${cellFrom(state.manualUnit)}.${note}`, problem: false };
  }
  if (!hasGaps(state.draft)) {
    return {
      unit: null,
      text: 'Minden cella megadott. Elég az első sorokat teljesen megadni, a többinél a sor egy részét: a törölt cellákat a program az ismétlő egységből tölti ki.',
      problem: false,
    };
  }
  const detected = detectUnit(state.draft);
  if (!detected.ok) return { unit: null, text: detected.reason, problem: true };
  const { width, height } = detected.unit;
  return { unit: detected.unit, text: `Ismétlő egység, felismerve: ${width} × ${height} cella. A meg nem adott cellák ebből töltődnek ki.`, problem: false };
}

export type ExpandedCells = { readonly ok: true; readonly cells: number[][] } | { readonly ok: false; readonly reason: string };

/** A kiterjesztett rács: a megadott cellák, a többi az ismétlő egységből. */
export function expandedCells(state: GridEditorState, unit: UnitState = unitState(state)): ExpandedCells {
  if (hasGaps(state.draft) && !unit.unit) {
    return { ok: false, reason: unit.problem ? unit.text : 'Van meg nem adott cella: add meg, vagy jelöld meg az ismétlő egységet.' };
  }
  const width = state.draft[0]?.length ?? 0;
  return { ok: true, cells: expandDraft(state.draft, unit.unit, width, state.draft.length, defaultFill(state.technique)) };
}

/* ---- Terv ---- */

export interface SummaryView {
  readonly size: string;
  readonly details: readonly string[];
  readonly warnings: readonly string[];
  readonly source: string;
}

export type SummaryResult = { readonly ok: true; readonly view: SummaryView } | { readonly ok: false; readonly reason: string };

const cm = (value: number) => formatNumber(value, 1);

/** „a 3., 5. és 7. sor”; hatnál több sornál az első hat. */
function rowList(rows: readonly number[]): string {
  const shown = rows.slice(0, 6).map((row) => `${row}.`);
  const list = shown.length === 1 ? shown[0]! : `${shown.slice(0, -1).join(', ')} és ${shown.at(-1)!}`;
  return `${article(rows[0]!)} ${list}${rows.length > shown.length ? ' és további' : ''} sor`;
}

/** Színenként a cellák száma: „A: 40, B: 12”. */
function perColor(cells: readonly (readonly number[])[], unit: string): string {
  return `${[...cellCounts(cells)]
    .sort((a, b) => a[0] - b[0])
    .map(([color, count]) => `${colorLetter(color)}: ${count}`)
    .join(', ')} ${unit}.`;
}

function sourceText(source: ValueSource): string {
  return source === 'estimated'
    ? 'A méret becslés a tűből: pontosabb, ha a Méret és fonal szakaszban mintasűrűséget adsz meg. A rács cellái is ebben az arányban látszanak.'
    : 'A méret és a cellák aránya a megadott mintasűrűségből.';
}

export function planSummary(pattern: Pattern, state: GridEditorState, mirrored: boolean): SummaryResult {
  const unit = unitState(state);
  const expanded = expandedCells(state, unit);
  if (!expanded.ok) return { ok: false, reason: expanded.reason };
  const { cells } = expanded;
  const width = cells[0]!.length;
  const height = cells.length;
  const warnings: string[] = [];
  const details: string[] = [];
  const mirror = mirrorWarning(cells, state.lettering, mirrored);
  if (mirror) warnings.push(mirror);
  if (unit.unit) details.push(`Ismétlő egység: ${unit.unit.width} × ${unit.unit.height} cella, a teljes ${width} × ${height} cellás rácsra kiterjesztve.`);

  let size: string;
  let source: ValueSource;
  switch (state.technique) {
    case 'filet': {
      const planned = planFilet(pattern, cells);
      if (!planned.ok) return planned;
      const { plan } = planned;
      source = plan.gauge.source;
      size = `Tényleges méret: ${source === 'estimated' ? '≈ ' : ''}${cm(plan.widthCm)} × ${cm(plan.heightCm)} cm, ${plan.rows.length} sor.`;
      details.push(`A legszélesebb sor ${plan.width} cella: 3 × ${plan.width} + 1 = ${filetRowPositions(plan.width)} pozíció.`);
      details.push(`Láncalap: ${plan.foundation.chains} lsz; az első pálca a horogtól számított ${plan.foundation.fromHook}. láncszembe megy.`);
      const open = plan.rows.filter((row) => row.row > 1 && row.start === 'open').map((row) => row.row);
      if (open.length > 0) details.push(`Nyitott cellával kezdődik ${rowList(open)}: a fordulólánc után 2 lsz jön.`);
      const added = plan.rows.filter((row) => row.added > 0).map((row) => row.row);
      if (added.length > 0) details.push(`Szaporítás a sor elején ${rowList(added)} előtt: az előző sor végén láncos hosszabbítás.`);
      const left = plan.rows.filter((row) => row.left > 0).map((row) => row.row);
      if (left.length > 0) details.push(`Meghagyott cellák ${rowList(left)} végén.`);
      break;
    }
    case 'c2c': {
      const planned = planC2C(pattern, cells, state.colors);
      if (!planned.ok) return planned;
      const { plan } = planned;
      source = plan.gauge.source;
      size = `Tényleges méret: ${source === 'estimated' ? '≈ ' : ''}${cm(plan.widthCm)} × ${cm(plan.heightCm)} cm, ${plan.rows.length} átlós sor, ${width * height} csempe.`;
      details.push(`Láncalap: ${plan.foundation.chains} lsz; az első pálca a horogtól számított ${plan.foundation.fromHook}. láncszembe megy.`);
      const firstDecrease = plan.rows.find((row) => row.start === 'decrease' || row.end === 'decrease')?.row;
      details.push(
        firstDecrease === undefined
          ? 'Minden sor szaporít.'
          : `Szaporítás az 1–${firstDecrease - 1}. sorig; utána az az oldal fogy, ahol a méret megvan, a másik még nő.`,
      );
      details.push(`Csempék színenként: ${perColor(cells, 'csempe')}`);
      break;
    }
    default: {
      const planned = planColorwork(pattern, state.technique, cells, state.colors);
      if (!planned.ok) return planned;
      const { plan } = planned;
      source = plan.gauge.source;
      size = `Tényleges méret: ${source === 'estimated' ? '≈ ' : ''}${cm(plan.widthCm)} × ${cm(plan.heightCm)} cm, ${height} sor.`;
      details.push(`Soronként ${width} rp. Láncalap: ${plan.foundation.chains} lsz; az első szem a horogtól számított ${plan.foundation.fromHook}. láncszembe megy.`);
      details.push(`Szemek színenként: ${perColor(cells, 'szem')}`);
      if (state.technique === 'tapestry') {
        const over = overCarriedRows(cells);
        if (over.length > 0) warnings.push(`Tapestryben 3-nál több színt kell vinni ${rowList(over)}ban: ez haladó szint, a szövet merevebb lesz.`);
      }
    }
  }
  if (state.technique !== 'c2c') {
    const cell = editorCellSize(pattern, state.technique);
    details.push(`Négyzet alakú motívumhoz ${proportionalRows(width, cell, 1, 1)} sor kell ${width} cella szélességhez; most ${height} sor.`);
  }
  return { ok: true, view: { size, details, warnings, source: sourceText(source) } };
}

/* ---- Fonal ---- */

function meters(quantity: Quantity): string {
  const [low, high] = bounds(quantity);
  return quantity.range
    ? `≈ ${formatNumber(quantity.value, 0)} m (${formatNumber(low, 0)}–${formatNumber(high, 0)} m)`
    : `${formatNumber(quantity.value, 0)} m`;
}

/** A mostani rácsminta fonala tartalékkal, többszínű rácsnál színenként. Rácsminta nélkül üres. */
export function yarnLines(pattern: Pattern): string[] {
  const piece = pattern.pieces[0];
  const grid = piece?.grid;
  if (!piece || !grid) return [];
  const library = libraryFor(pattern);
  const result = patternSize(pattern, buildPieceGraph(pattern, piece, library), library).yarn;
  if (result.kind === 'missing') {
    return ['Fonalbecsléshez add meg a Méret és fonal szakaszban a próbadarab méretét és tömegét, a fonal hosszát és a gombolyag tömegét.'];
  }
  const total = result.estimate.lengthWithBufferM;
  if (grid.colors.length < 2) return [`Fonal tartalékkal: ${meters(total)}.`];
  const lines = [...yarnByColor(grid.cells, grid.technique, total)].map(
    ([color, quantity]) => `${colorLetter(color)} (${grid.colors[color]?.name ?? ''}): ${meters(quantity)}`,
  );
  if (grid.technique === 'tapestry') lines.push('Tapestryben a szemekben vitt szál miatt több is kellhet: a tartomány felső széle ezzel számol.');
  return lines;
}

/* ---- Létrehozás és betöltés ---- */

export type GenerateResult = { readonly ok: true; readonly pattern: Pattern; readonly message: string } | { readonly ok: false; readonly reason: string };

export function generateFromState(pattern: Pattern, state: GridEditorState): GenerateResult {
  const unit = unitState(state);
  const expanded = expandedCells(state, unit);
  if (!expanded.ok) return expanded;
  const common = { cells: expanded.cells, unit: unit.unit, lettering: state.lettering };
  const done = (result: { ok: true; pattern: Pattern; plan: { rows: readonly unknown[] } } | { ok: false; reason: string }): GenerateResult =>
    result.ok
      ? {
          ok: true,
          pattern: result.pattern,
          message: `${TECHNIQUE_NAMES[state.technique]}: ${result.plan.rows.length} sor elkészült; visszavonással a korábbi minta visszajön.`,
        }
      : result;
  switch (state.technique) {
    case 'filet':
      return done(generateFilet(pattern, common));
    case 'c2c':
      return done(generateC2C(pattern, { ...common, colors: state.colors }));
    default:
      return done(generateColorwork(pattern, { ...common, technique: state.technique, colors: state.colors }));
  }
}

/** A mostani minta rácsa a szerkesztőbe, ha rácsmintából készült. */
export function stateFromPattern(pattern: Pattern): GridEditorState | null {
  const grid = pattern.pieces[0]?.grid;
  if (!grid || grid.technique === 'mosaic') return null;
  return {
    technique: grid.technique,
    draft: grid.cells.map((row) => [...row]),
    colors: grid.colors.length > 0 ? grid.colors : DEFAULT_COLORS,
    manualUnit: grid.unit,
    lettering: grid.lettering,
  };
}

/* ---- Az ismétlő egység a diagramon ---- */

export interface Frame {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

let frameCache: { readonly layout: ChartLayout; readonly pattern: Pattern; readonly mirrored: boolean; readonly frame: Frame | null } | null = null;

/**
 * Az ismétlő egység kerete diagram-koordinátában: az egység sorai, és a sor
 * szemeinek szélessége a cellák arányában. A C2C átlós sorainál nincs keret,
 * ott a rácsszerkesztő mutatja az egységet.
 */
export function unitFrame(pattern: Pattern, layout: ChartLayout, mirrored: boolean): Frame | null {
  if (frameCache && frameCache.layout === layout && frameCache.pattern === pattern && frameCache.mirrored === mirrored) return frameCache.frame;
  const frame = computeFrame(pattern, layout, mirrored);
  frameCache = { layout, pattern, mirrored, frame };
  return frame;
}

function computeFrame(pattern: Pattern, layout: ChartLayout, mirrored: boolean): Frame | null {
  const piece = pattern.pieces[0];
  const grid = piece?.grid;
  if (!piece || !grid?.unit || grid.technique === 'c2c' || grid.technique === 'mosaic') return null;
  const graph = buildPieceGraph(pattern, piece, libraryFor(pattern));
  const { unit, cells } = grid;
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let y = unit.y; y < unit.y + unit.height; y += 1) {
    const layer = graph.layers[y + 1];
    const row = cells[y];
    if (!layer || !row) return null;
    // A sor végi láncos hosszabbítás már a következő sorhoz tartozik.
    const ids = [...layer.stitches];
    while (ids.length > 0 && graph.defs.get(ids[ids.length - 1]!)!.kind === 'chain') ids.pop();
    const nodes = ids.map((id) => layout.nodes.get(id)).filter((node) => node !== undefined);
    const columns = row.flatMap((cell, x) => (cell === NO_CELL ? [] : [x]));
    if (nodes.length === 0 || columns.length === 0) return null;
    const from = columns[0]!;
    const count = columns.length;
    const xs = nodes.map((node) => node.top.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    // Filében a cellahatár az oszlop, színes rácsban két szem között van.
    const step = grid.technique === 'filet' || count < 2 ? 0 : (maxX - minX) / (count - 1) / 2;
    const left = minX - step;
    const right = maxX + step;
    const at = (column: number) => {
      const t = (column - from) / count;
      return left + (mirrored ? 1 - t : t) * (right - left);
    };
    const a = at(Math.max(unit.x, from));
    const b = at(Math.min(unit.x + unit.width, from + count));
    x0 = Math.min(x0, a, b);
    x1 = Math.max(x1, a, b);
    for (const node of nodes) {
      y0 = Math.min(y0, node.top.y, ...node.feet.map((foot) => foot.y));
      y1 = Math.max(y1, node.top.y, ...node.feet.map((foot) => foot.y));
    }
  }
  return Number.isFinite(x0) ? { x0, y0: y0 - 4, x1, y1: y1 + 4 } : null;
}
