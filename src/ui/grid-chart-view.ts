// KB: interface.md §1

import { C2C_STITCH, generateC2C, planC2C } from '../core/c2c.ts';
import { generateColorwork, planColorwork } from '../core/colorwork.ts';
import { filetRowPositions, generateFilet, planFilet } from '../core/filet.ts';
import { buildPieceGraph } from '../core/graph.ts';
import type { ChartLayout } from '../core/layout.ts';
import type { CoreText } from '../core/messages.ts';
import { generateMosaic, type MosaicRows, planMosaic, repairMosaic } from '../core/mosaic.ts';
import { patternSize } from '../core/pattern-size.ts';
import {
  type CellSize,
  c2cTileRows,
  cellCounts,
  cellSize,
  colorLetter,
  type DraftCell,
  detectUnit,
  emptyDraft,
  expandDraft,
  FILLED,
  hasGaps,
  MAX_COLORS,
  MAX_GRID_SIDE,
  mirrorWarning,
  NO_CELL,
  OPEN,
  overCarriedRows,
  proportionalRows,
  TECHNIQUE_STITCH,
  unitConflicts,
  unitProblem,
  yarnByColor,
} from '../core/pixel-chart.ts';
import { bounds, type Quantity } from '../core/quantity.ts';
import { shapeGauge } from '../core/shapes.ts';
import { libraryFor } from '../core/stitch-variants.ts';
import type { GridTechnique, GridUnit, Pattern, PatternColor, ValueSource } from '../core/types.ts';
import { type GridCoreCode, gridCoreText } from './i18n/core/grid.ts';
import { texts } from './i18n.ts';
import type { Choice } from './shapes-view.ts';
import { formatNumber } from './size-view.ts';

export type EditorTechnique = GridTechnique;

export const EDITOR_TECHNIQUES: readonly EditorTechnique[] = ['filet', 'c2c', 'tapestry', 'graphgan', 'mosaic'];

export const TECHNIQUE_CHOICES: readonly Choice<EditorTechnique>[] = EDITOR_TECHNIQUES.map((value) => ({
  value,
  get label() {
    return texts().panels.grid.techniques[value];
  },
}));

export const MOSAIC_ROW_CHOICES: readonly Choice<'1' | '2'>[] = [
  {
    value: '1',
    get label() {
      return texts().panels.grid.mosaicRows.one;
    },
  },
  {
    value: '2',
    get label() {
      return texts().panels.grid.mosaicRows.two;
    },
  },
];

// KB: interface.md §25
type ColorKey = 'natural' | 'burgundy' | 'blue' | 'green' | 'mustard' | 'black' | 'rose' | 'brown';

const color = (key: ColorKey, hex: string): PatternColor => ({ id: key, hex });

export function colorLabel(entry: PatternColor | undefined, fallback = ''): string {
  if (!entry) return fallback;
  // The group holds a function (`numbered`) beside the names, so check the type after reading.
  const names: Readonly<Record<string, unknown>> = texts().panels.grid.colors;
  const named = entry.id === undefined ? undefined : names[entry.id];
  return (typeof named === 'string' ? named : undefined) ?? entry.name ?? fallback;
}

export const DEFAULT_COLORS: readonly PatternColor[] = [color('natural', '#f3ecdf'), color('burgundy', '#8c2f4a')];

const MORE_COLORS: readonly PatternColor[] = [
  color('blue', '#2f5f9e'),
  color('green', '#3f7d4e'),
  color('mustard', '#c8932e'),
  color('black', '#241f2b'),
  color('rose', '#c86b85'),
  color('brown', '#7a5a3c'),
];

export const DEFAULT_WIDTH = 12;
export const DEFAULT_HEIGHT = 8;

export interface GridEditorState {
  readonly technique: EditorTechnique;
  // KB: interface.md §24 — rows run bottom-up; `null` is a cell the repeat unit fills.
  readonly draft: readonly (readonly DraftCell[])[];
  readonly colors: readonly PatternColor[];
  readonly manualUnit: GridUnit | null;
  readonly lettering: boolean;
  readonly mosaicRows: MosaicRows;
}

export const usesColors = (technique: EditorTechnique) => technique !== 'filet';

export const defaultFill = (technique: EditorTechnique): number => (technique === 'filet' ? OPEN : 0);

export function defaultDraft(technique: EditorTechnique, width: number, height: number): DraftCell[][] {
  if (technique !== 'mosaic') return emptyDraft(width, height, defaultFill(technique));
  return Array.from({ length: height }, (_, y) => Array.from({ length: width }, () => y % 2));
}

export function defaultState(
  technique: EditorTechnique = 'filet',
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
): GridEditorState {
  return {
    technique,
    draft: defaultDraft(technique, width, height),
    colors: DEFAULT_COLORS,
    manualUnit: null,
    lettering: false,
    mosaicRows: 1,
  };
}

export function withTechnique(state: GridEditorState, technique: EditorTechnique): GridEditorState {
  if (technique === state.technique) return state;
  const width = state.draft[0]?.length ?? DEFAULT_WIDTH;
  const same = usesColors(technique) === usesColors(state.technique) && technique !== 'mosaic';
  const colors =
    technique === 'mosaic' ? (state.colors.length >= 2 ? state.colors.slice(0, 2) : DEFAULT_COLORS) : state.colors;
  return {
    ...state,
    technique,
    colors,
    draft: same ? state.draft : defaultDraft(technique, width, state.draft.length),
    manualUnit: same ? state.manualUnit : null,
  };
}

export function resizeDraft(draft: readonly (readonly DraftCell[])[], width: number, height: number): DraftCell[][] {
  return Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => draft[y]?.[x] ?? null));
}

export function nextColor(
  colors: readonly PatternColor[],
  technique: EditorTechnique = 'tapestry',
): PatternColor | null {
  if (colors.length >= (technique === 'mosaic' ? 2 : MAX_COLORS)) return null;
  return (
    MORE_COLORS.find((candidate) => !colors.some((other) => other.hex === candidate.hex)) ?? {
      // KB: interface.md §25 — no id here; the branch is effectively unreachable.
      name: texts().panels.grid.colors.numbered(colors.length + 1),
      hex: '#8d819c',
    }
  );
}

export function removeColor(state: GridEditorState, index: number): GridEditorState {
  if (state.colors.length <= 1) return state;
  const shift = (cell: DraftCell) => (cell === null ? null : cell === index ? 0 : cell > index ? cell - 1 : cell);
  return {
    ...state,
    colors: state.colors.filter((_, i) => i !== index),
    draft: state.draft.map((row) => row.map(shift)),
  };
}

export interface Brush {
  readonly key: string;
  readonly value: DraftCell;
  readonly label: string;
  readonly swatch: string | null;
}

export function brushesFor(state: GridEditorState): Brush[] {
  const t = texts().panels.grid.brushes;
  const unset: Brush = { key: 'unset', value: null, label: t.unset, swatch: null };
  if (!usesColors(state.technique)) {
    return [
      { key: 'filled', value: FILLED, label: t.filled, swatch: null },
      { key: 'open', value: OPEN, label: t.open, swatch: null },
      { key: 'none', value: NO_CELL, label: t.none, swatch: null },
      unset,
    ];
  }
  return [
    ...state.colors.map((entry, i) => ({
      key: `color-${i}`,
      value: i,
      label: t.color(colorLetter(i), colorLabel(entry)),
      swatch: entry.hex,
    })),
    unset,
  ];
}

export function valueName(state: GridEditorState, value: DraftCell): string {
  const t = texts().panels.grid.values;
  if (value === null) return t.unset;
  if (!usesColors(state.technique)) return value === FILLED ? t.filled : value === OPEN ? t.open : t.none;
  return t.color(colorLetter(value), colorLabel(state.colors[value], t.unknown));
}

export function cellLabel(state: GridEditorState, x: number, y: number): string {
  return texts().panels.grid.cellLabel(y + 1, x + 1, valueName(state, state.draft[y]?.[x] ?? null));
}

export function cellAppearance(
  state: GridEditorState,
  value: DraftCell,
): { readonly className: string; readonly color: string | null } {
  if (value === null) return { className: 'grid-cell grid-cell--unset', color: null };
  if (!usesColors(state.technique)) {
    const kind = value === FILLED ? 'filled' : value === OPEN ? 'open' : 'none';
    return { className: `grid-cell grid-cell--${kind}`, color: null };
  }
  return { className: 'grid-cell grid-cell--color', color: state.colors[value]?.hex ?? null };
}

export function editorCellSize(pattern: Pattern, technique: EditorTechnique, mosaicRows: MosaicRows = 1): CellSize {
  const size = cellSize(technique, shapeGauge(pattern, TECHNIQUE_STITCH[technique]));
  return technique === 'mosaic' ? { widthCm: size.widthCm, heightCm: size.heightCm * mosaicRows } : size;
}

export function cellPixels(cell: CellSize, base = 20, min = 8): { readonly width: number; readonly height: number } {
  const ratio = cell.widthCm / cell.heightCm;
  if (!Number.isFinite(ratio) || ratio <= 0) return { width: base, height: base };
  return ratio >= 1
    ? { width: base, height: Math.max(min, Math.round(base / ratio)) }
    : { width: Math.max(min, Math.round(base * ratio)), height: base };
}

const clampSide = (value: number) => Math.min(MAX_GRID_SIDE, Math.max(1, Math.round(value)));

// KB: 03 §5.1; interface.md §26
export function imageGridSize(
  imageWidth: number,
  imageHeight: number,
  width: number,
  pattern: Pattern,
  state: GridEditorState,
): { readonly width: number; readonly height: number } {
  const cells = clampSide(width);
  const cell = editorCellSize(pattern, state.technique, state.mosaicRows);
  return { width: cells, height: clampSide(proportionalRows(cells, cell, imageWidth, imageHeight)) };
}

const rgb = (hex: string): [number, number, number] =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

export function imageToDraft(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
  state: GridEditorState,
): number[][] {
  const pixel = (x: number, y: number): [number, number, number] => {
    const i = (y * width + x) * 4;
    const alpha = (pixels[i + 3] ?? 255) / 255;
    return [0, 1, 2].map((c) => (pixels[i + c] ?? 255) * alpha + 255 * (1 - alpha)) as [number, number, number];
  };
  // KB: interface.md §24 — the grid runs bottom-up, the image top-down.
  const source = (x: number, row: number) => pixel(x, height - 1 - row);
  if (!usesColors(state.technique)) {
    const lightness = ([r, g, b]: [number, number, number]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
    let total = 0;
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) total += lightness(pixel(x, y));
    const threshold = total / (width * height);
    return Array.from({ length: height }, (_, row) =>
      Array.from({ length: width }, (_, x) => (lightness(source(x, row)) < threshold ? FILLED : OPEN)),
    );
  }
  const palette = state.colors.map((color) => rgb(color.hex));
  const nearest = (color: [number, number, number]) => {
    let best = 0;
    let distance = Infinity;
    palette.forEach((candidate, i) => {
      const d = candidate.reduce((sum, value, c) => sum + (value - color[c]!) ** 2, 0);
      if (d < distance) [best, distance] = [i, d];
    });
    return best;
  };
  const cells = Array.from({ length: height }, (_, row) =>
    Array.from({ length: width }, (_, x) => nearest(source(x, row))),
  );
  return state.technique === 'mosaic' ? repairMosaic(cells) : cells;
}

export interface UnitState {
  readonly unit: GridUnit | null;
  readonly text: string;
  readonly problem: boolean;
}

const cellFrom = (unit: GridUnit) => texts().panels.grid.unitFrom(unit.y + 1, unit.x + 1);

export function unitState(state: GridEditorState): UnitState {
  const t = texts().panels.grid;
  if (state.manualUnit) {
    const problem = unitProblem(state.draft, state.manualUnit);
    if (problem) return { unit: null, text: gridCoreText(problem), problem: true };
    const { width, height } = state.manualUnit;
    const conflicts = unitConflicts(state.draft, state.manualUnit);
    const note = conflicts > 0 ? t.unitConflicts(conflicts) : '';
    return {
      unit: state.manualUnit,
      text: t.manualUnit(width, height, cellFrom(state.manualUnit), note),
      problem: false,
    };
  }
  if (!hasGaps(state.draft)) {
    return { unit: null, text: t.allCellsSet, problem: false };
  }
  const detected = detectUnit(state.draft);
  if (!detected.ok) return { unit: null, text: gridCoreText(detected.reason), problem: true };
  const { width, height } = detected.unit;
  return { unit: detected.unit, text: t.detectedUnit(width, height), problem: false };
}

export type ExpandedCells =
  | { readonly ok: true; readonly cells: number[][] }
  | { readonly ok: false; readonly reason: string };

export function expandedCells(state: GridEditorState, unit: UnitState = unitState(state)): ExpandedCells {
  if (hasGaps(state.draft) && !unit.unit) {
    return { ok: false, reason: unit.problem ? unit.text : texts().panels.grid.missingCells };
  }
  const width = state.draft[0]?.length ?? 0;
  return {
    ok: true,
    cells: expandDraft(state.draft, unit.unit, width, state.draft.length, defaultFill(state.technique)),
  };
}

export interface SummaryView {
  readonly size: string;
  readonly details: readonly string[];
  readonly warnings: readonly string[];
  readonly source: string;
}

export type SummaryResult =
  | { readonly ok: true; readonly view: SummaryView }
  | { readonly ok: false; readonly reason: string };

const cm = (value: number) => formatNumber(value, 1);

function perColor(cells: readonly (readonly number[])[], unit: string): string {
  const t = texts().panels.grid;
  return `${[...cellCounts(cells)]
    .sort((a, b) => a[0] - b[0])
    .map(([color, count]) => t.perColor(colorLetter(color), count))
    .join(', ')} ${unit}.`;
}

function sourceText(source: ValueSource): string {
  const t = texts().panels.grid;
  return source === 'estimated' ? t.sourceEstimated : t.sourceMeasured;
}

export function planSummary(pattern: Pattern, state: GridEditorState, mirrored: boolean): SummaryResult {
  const t = texts().panels.grid;
  const unit = unitState(state);
  const expanded = expandedCells(state, unit);
  if (!expanded.ok) return { ok: false, reason: expanded.reason };
  const { cells } = expanded;
  const width = cells[0]!.length;
  const height = cells.length;
  const warnings: string[] = [];
  const details: string[] = [];
  const mirror = mirrorWarning(cells, state.lettering, mirrored);
  if (mirror) warnings.push(gridCoreText(mirror));
  if (unit.unit) details.push(t.unitDetail(unit.unit.width, unit.unit.height, width, height));

  let size: string;
  let source: ValueSource;
  switch (state.technique) {
    case 'filet': {
      const planned = planFilet(pattern, cells);
      if (!planned.ok) return { ok: false, reason: gridCoreText(planned.reason) };
      const { plan } = planned;
      source = plan.gauge.source;
      size = t.actualSize(source === 'estimated' ? '≈ ' : '', cm(plan.widthCm), cm(plan.heightCm), plan.rows.length);
      details.push(t.filetPositions(plan.width, filetRowPositions(plan.width)));
      details.push(t.filetFoundation(plan.foundation.chains, plan.foundation.fromHook));
      const open = plan.rows.filter((row) => row.row > 1 && row.start === 'open').map((row) => row.row);
      if (open.length > 0) details.push(t.openStartRows(open));
      const added = plan.rows.filter((row) => row.added > 0).map((row) => row.row);
      if (added.length > 0) details.push(t.addedRows(added));
      const left = plan.rows.filter((row) => row.left > 0).map((row) => row.row);
      if (left.length > 0) details.push(t.leftRows(left));
      const removed = plan.rows.filter((row) => row.removed > 0).map((row) => row.row);
      if (removed.length > 0) details.push(t.removedRows(removed));
      const extended = plan.rows.filter((row) => row.extended > 0).map((row) => row.row);
      if (extended.length > 0) details.push(t.extendedRows(extended));
      break;
    }
    case 'c2c': {
      const planned = planC2C(pattern, cells, state.colors);
      if (!planned.ok) return { ok: false, reason: gridCoreText(planned.reason) };
      const { plan } = planned;
      source = plan.gauge.source;
      size = t.c2cSize(
        source === 'estimated' ? '≈ ' : '',
        cm(plan.widthCm),
        cm(plan.heightCm),
        plan.rows.length,
        width * height,
      );
      details.push(t.filetFoundation(plan.foundation.chains, plan.foundation.fromHook));
      const firstDecrease = plan.rows.find((row) => row.start === 'decrease' || row.end === 'decrease')?.row;
      details.push(firstDecrease === undefined ? t.allIncrease : t.increaseUntil(firstDecrease - 1));
      details.push(t.tilesPerColor(perColor(cells, t.tileUnit)));
      break;
    }
    case 'mosaic': {
      const planned = planMosaic(pattern, cells, state.colors, state.mosaicRows);
      if (!planned.ok) return { ok: false, reason: gridCoreText(planned.reason) };
      const { plan } = planned;
      source = plan.gauge.source;
      size = t.mosaicSize(
        source === 'estimated' ? '≈ ' : '',
        cm(plan.widthCm),
        cm(plan.heightCm),
        plan.rows.length,
        height,
      );
      const long = plan.depth === 2 ? t.mosaicDepthDc : t.mosaicDepthTr;
      details.push(t.mosaic(plan.variant === 1 ? t.mosaicVariantOne : t.mosaicVariantTwo, long, plan.drops));
      details.push(t.mosaicRow(width, plan.foundation.chains, plan.foundation.fromHook));
      break;
    }
    default: {
      const planned = planColorwork(pattern, state.technique, cells, state.colors);
      if (!planned.ok) return { ok: false, reason: gridCoreText(planned.reason) };
      const { plan } = planned;
      source = plan.gauge.source;
      size = t.colorworkSize(source === 'estimated' ? '≈ ' : '', cm(plan.widthCm), cm(plan.heightCm), height);
      details.push(t.colorworkRow(width, plan.foundation.chains, plan.foundation.fromHook));
      details.push(t.stitchesPerColor(perColor(cells, t.stitchUnit)));
      if (state.technique === 'tapestry') {
        const over = overCarriedRows(cells);
        if (over.length > 0) warnings.push(t.tapestryCarry(over));
      }
    }
  }
  if (state.technique !== 'c2c') {
    const cell = editorCellSize(pattern, state.technique, state.mosaicRows);
    details.push(t.squareMotif(proportionalRows(width, cell, 1, 1), width, height));
  }
  return { ok: true, view: { size, details, warnings, source: sourceText(source) } };
}

function meters(quantity: Quantity): string {
  const t = texts().panels.grid;
  const [low, high] = bounds(quantity);
  return quantity.range
    ? t.yarnRange(formatNumber(quantity.value, 0), formatNumber(low, 0), formatNumber(high, 0))
    : t.yarnExact(formatNumber(quantity.value, 0));
}

export function yarnLines(pattern: Pattern): string[] {
  const t = texts().panels.grid;
  const piece = pattern.pieces[0];
  const grid = piece?.grid;
  if (!piece || !grid) return [];
  const library = libraryFor(pattern);
  const result = patternSize(pattern, buildPieceGraph(pattern, piece, library), library).yarn;
  if (result.kind === 'missing') return [t.yarnMissing];
  const total = result.estimate.lengthWithBufferM;
  if (grid.colors.length < 2) return [t.yarnTotal(meters(total))];
  const lines = [...yarnByColor(grid.cells, grid.technique, total)].map(([color, quantity]) =>
    t.yarnColor(colorLetter(color), colorLabel(grid.colors[color]), meters(quantity)),
  );
  if (grid.technique === 'tapestry') lines.push(t.yarnTapestry);
  return lines;
}

export type GenerateResult =
  | { readonly ok: true; readonly pattern: Pattern; readonly message: string }
  | { readonly ok: false; readonly reason: string };

export function generateFromState(pattern: Pattern, state: GridEditorState): GenerateResult {
  const t = texts().panels.grid;
  const unit = unitState(state);
  const expanded = expandedCells(state, unit);
  if (!expanded.ok) return expanded;
  const common = { cells: expanded.cells, unit: unit.unit, lettering: state.lettering };
  const done = (
    result:
      | { ok: true; pattern: Pattern; plan: { rows: readonly unknown[] } }
      | { ok: false; reason: CoreText<GridCoreCode> },
  ): GenerateResult =>
    result.ok
      ? {
          ok: true,
          pattern: result.pattern,
          message: t.generated(t.techniques[state.technique], result.plan.rows.length),
        }
      : { ok: false, reason: gridCoreText(result.reason) };
  switch (state.technique) {
    case 'filet':
      return done(generateFilet(pattern, common));
    case 'c2c':
      return done(generateC2C(pattern, { ...common, colors: state.colors }));
    case 'mosaic':
      return done(generateMosaic(pattern, { ...common, colors: state.colors, variant: state.mosaicRows }));
    default:
      return done(generateColorwork(pattern, { ...common, technique: state.technique, colors: state.colors }));
  }
}

export function stateFromPattern(pattern: Pattern): GridEditorState | null {
  const grid = pattern.pieces[0]?.grid;
  if (!grid) return null;
  return {
    technique: grid.technique,
    draft: grid.cells.map((row) => [...row]),
    colors: grid.colors.length > 0 ? grid.colors : DEFAULT_COLORS,
    manualUnit: grid.unit,
    lettering: grid.lettering,
    mosaicRows: grid.mosaicRows ?? 1,
  };
}

export interface Frame {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

let frameCache: {
  readonly layout: ChartLayout;
  readonly pattern: Pattern;
  readonly mirrored: boolean;
  readonly frames: Frame[];
} | null = null;

// KB: interface.md §27
export function unitFrames(pattern: Pattern, layout: ChartLayout, mirrored: boolean): Frame[] {
  if (frameCache && frameCache.layout === layout && frameCache.pattern === pattern && frameCache.mirrored === mirrored)
    return frameCache.frames;
  const frames = computeFrames(pattern, layout, mirrored);
  frameCache = { layout, pattern, mirrored, frames };
  return frames;
}

type Box = { x0: number; y0: number; x1: number; y1: number };

const around = (box: Box, points: readonly { readonly x: number; readonly y: number }[]) => {
  for (const point of points) {
    box.x0 = Math.min(box.x0, point.x);
    box.x1 = Math.max(box.x1, point.x);
    box.y0 = Math.min(box.y0, point.y);
    box.y1 = Math.max(box.y1, point.y);
  }
};

function computeFrames(pattern: Pattern, layout: ChartLayout, mirrored: boolean): Frame[] {
  const piece = pattern.pieces[0];
  const grid = piece?.grid;
  if (!piece || !grid?.unit) return [];
  const graph = buildPieceGraph(pattern, piece, libraryFor(pattern));
  const { unit, cells } = grid;
  const inUnit = (x: number, y: number) =>
    x >= unit.x && x < unit.x + unit.width && y >= unit.y && y < unit.y + unit.height;

  if (grid.technique === 'c2c') {
    const frames: Frame[] = [];
    c2cTileRows(cells[0]?.length ?? 0, cells.length).forEach((row, i) => {
      const layer = graph.layers[i + 1];
      if (!layer) return;
      const stitches = layer.stitches.filter((id) => graph.defs.get(id)!.id === C2C_STITCH);
      row.tiles.forEach((tile, t) => {
        if (!inUnit(tile.x, tile.y)) return;
        const box: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
        for (const id of stitches.slice(3 * t, 3 * t + 3)) {
          const node = layout.nodes.get(id);
          if (node) around(box, [node.top, ...node.feet]);
        }
        if (Number.isFinite(box.x0)) frames.push({ x0: box.x0 - 4, y0: box.y0 - 4, x1: box.x1 + 4, y1: box.y1 + 4 });
      });
    });
    return frames;
  }

  const perRow = grid.technique === 'mosaic' ? (grid.mosaicRows ?? 1) : 1;
  const spikes = spikeNodes(pattern);
  let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
  for (let y = unit.y; y < unit.y + unit.height; y += 1) {
    const row = cells[y];
    if (!row) return [];
    for (let pass = 0; pass < perRow; pass += 1) {
      const layer = graph.layers[y * perRow + pass + 1];
      if (!layer) return [];
      const ids = [...layer.stitches];
      while (ids.length > 0 && graph.defs.get(ids[ids.length - 1]!)!.kind === 'chain') ids.pop();
      const nodes = ids.map((id) => layout.nodes.get(id)).filter((node) => node !== undefined);
      const columns = row.flatMap((cell, x) => (cell === NO_CELL ? [] : [x]));
      if (nodes.length === 0 || columns.length === 0) return [];
      const from = columns[0]!;
      const count = columns.length;
      const xs = nodes.map((node) => node.top.x);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const step = grid.technique === 'filet' || count < 2 ? 0 : (maxX - minX) / (count - 1) / 2;
      const at = (column: number) => {
        const t = (column - from) / count;
        return minX - step + (mirrored ? 1 - t : t) * (maxX - minX + 2 * step);
      };
      const a = at(Math.max(unit.x, from));
      const b = at(Math.min(unit.x + unit.width, from + count));
      x0 = Math.min(x0, a, b);
      x1 = Math.max(x1, a, b);
      for (const node of nodes) {
        const feet = spikes.has(node.id) ? [] : node.feet.map((foot) => foot.y);
        y0 = Math.min(y0, node.top.y, ...feet);
        y1 = Math.max(y1, node.top.y, ...feet);
      }
    }
  }
  return Number.isFinite(x0) && Number.isFinite(y0) ? [{ x0, y0: y0 - 4, x1, y1: y1 + 4 }] : [];
}

export function spikeNodes(pattern: Pattern): ReadonlySet<string> {
  return new Set(
    (pattern.pieces[0]?.stitches ?? []).filter((node) => node.flags?.includes('spike')).map((node) => node.id),
  );
}
