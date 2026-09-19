// KB: 01 §6.1, 03 §2.1, 03 §10 I42; interface.md §1, §14

import { type ChartGrid, chartBounds } from '../core/grid.ts';
import { nodeInsertions } from '../core/insertion.ts';
import type { ChartLayout } from '../core/layout.ts';
import { VOCABULARIES } from '../core/pattern-text.ts';
import type { StitchLibrary } from '../core/stitch-library.ts';
import { stitchLabel } from '../core/stitchText.ts';
import type { Locale, Pattern, StitchDef, StitchInsertion, Tradition } from '../core/types.ts';
import { chartLabels, rowCaptions } from './chart-labels.ts';
import { gridPaths, LINE_WIDTH } from './grid-paths.ts';
import { texts } from './i18n.ts';
import { chartStyleLabel, termsLabel, textLanguage } from './notation.ts';
import {
  DEFAULT_SYMBOL_OPTIONS,
  placedShapes,
  type Shape,
  type SymbolOptions,
  shapeBounds,
  symbolShapes,
} from './symbols.ts';

export interface ChartColors {
  readonly right: string;
  readonly wrong: string;
  readonly text: string;
  readonly background: string;
}

export interface GridColors {
  readonly rowA: string;
  readonly rowB: string;
  readonly cell: string;
  readonly row: string;
  readonly strong: string;
}

export interface ChartSvgOptions {
  readonly colors: ChartColors;
  readonly mirror?: boolean;
  readonly terms?: Locale;
  readonly symbols?: SymbolOptions;
  readonly grid?: { readonly grid: ChartGrid; readonly colors: GridColors };
  readonly tradition?: Tradition;
  readonly unitFrames?: readonly {
    readonly x0: number;
    readonly y0: number;
    readonly x1: number;
    readonly y1: number;
  }[];
  readonly spikes?: ReadonlySet<string>;
}

const MARGIN = 24;
const TITLE = 36;
const LEGEND_ROW = 34;
const LEGEND_ICON = 26;
const LABEL_HEIGHT = 16;
const FONT = 'font-family="Karla, system-ui, -apple-system, \'Segoe UI\', sans-serif"';

const num = (value: number) => String(Math.round(value * 100) / 100);

export function escapeXml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
}

export function shapeToSvg(shape: Shape): string {
  switch (shape.kind) {
    case 'line':
      return `<line x1="${num(shape.from.x)}" y1="${num(shape.from.y)}" x2="${num(shape.to.x)}" y2="${num(shape.to.y)}"/>`;
    case 'curve':
      return `<path d="M${num(shape.from.x)} ${num(shape.from.y)}Q${num(shape.control.x)} ${num(shape.control.y)} ${num(shape.to.x)} ${num(shape.to.y)}"/>`;
    case 'ellipse': {
      const rotate = shape.rotation
        ? ` transform="rotate(${num((shape.rotation * 180) / Math.PI)} ${num(shape.center.x)} ${num(shape.center.y)})"`
        : '';
      return `<ellipse cx="${num(shape.center.x)}" cy="${num(shape.center.y)}" rx="${num(shape.rx)}" ry="${num(shape.ry)}"${rotate}/>`;
    }
    case 'dot':
      return `<circle class="fill" cx="${num(shape.center.x)}" cy="${num(shape.center.y)}" r="${num(shape.r)}"/>`;
  }
}

export function legendStitches(pattern: Pattern, library: StitchLibrary): StitchDef[] {
  const piece = pattern.pieces[0];
  const seen = new Map<string, StitchDef>();
  if (!piece) return [];
  const groupOf = new Map(piece.groups.flatMap((group) => group.members.map((id) => [id, group.def] as const)));
  for (const node of piece.stitches) {
    const id = groupOf.get(node.id) ?? node.def;
    const def = library.get(id);
    if (def && !seen.has(id)) seen.set(id, def);
  }
  if (piece.spaces.length > 0) {
    const space = library.get('ch-sp');
    if (space) seen.set(space.id, space);
  }
  return [...seen.values()];
}

export function legendInsertions(
  pattern: Pattern,
  library: StitchLibrary,
): { readonly def: StitchDef; readonly mode: StitchInsertion }[] {
  const piece = pattern.pieces[0];
  const modes = nodeInsertions(piece);
  const seen = new Map<string, { readonly def: StitchDef; readonly mode: StitchInsertion }>();
  for (const node of piece?.stitches ?? []) {
    const mode = modes.get(node.id);
    const def = library.get(node.def);
    if (!mode || mode === 'both-loops' || !def || def.kind === 'slip' || !def.insertionModes.includes(mode)) continue;
    const key = `${def.id}/${mode}`;
    if (!seen.has(key)) seen.set(key, { def, mode });
  }
  return [...seen.values()];
}

export function chartSvg(
  pattern: Pattern,
  layout: ChartLayout,
  library: StitchLibrary,
  options: ChartSvgOptions,
): string {
  const { colors } = options;
  const terms = options.terms ?? 'hu';
  const symbols = options.symbols ?? DEFAULT_SYMBOL_OPTIONS;
  const grid = options.grid && options.grid.grid.bands.length > 0 ? options.grid : undefined;
  const system = VOCABULARIES[terms].system;
  const captions = chartLabels(options.tradition ?? 'cyc');
  const repeat = captions.repeat(pattern.conventions.repeat);
  const bounds = chartBounds(layout, grid?.grid);
  const chartWidth = Math.max(bounds.maxX - bounds.minX, 0);
  const chartHeight = Math.max(bounds.maxY - bounds.minY, 0);
  const legend = legendStitches(pattern, library);
  const labels = legend.map((def) => stitchLabel(def, terms));
  const marked = legendInsertions(pattern, library);
  const chart = texts().sections.chart;
  const modeNames = texts().sections.insertion.names;
  const markedLabels = marked.map(({ def, mode }) => [stitchLabel(def, terms), modeNames[mode]] as const);
  const insertions = nodeInsertions(pattern.pieces[0]);
  const keys: [string, string][] = [
    [colors.right, chart.rightSide],
    [colors.wrong, chart.wrongSide],
  ];
  const notes = [
    chart.notation(termsLabel(terms), chartStyleLabel(symbols.style ?? 'cyc')),
    captions.note,
    ...(repeat ? [chart.repeat(repeat)] : []),
    ...(marked.length > 0 ? [chart.insertions] : []),
    ...(grid ? [chart.grid] : []),
    ...((options.unitFrames ?? []).length > 0 ? [chart.unitFrame] : []),
    ...([...layout.nodes.keys()].some((id) => options.spikes?.has(id)) ? [chart.spike] : []),
    ...(options.mirror ? [chart.mirror] : []),
  ];
  const legendRows = legend.length + marked.length + keys.length + notes.length;
  // KB: interface.md §17
  const textWidth =
    LEGEND_ICON +
    12 +
    7.4 *
      Math.max(
        ...labels.map((l) => l.length),
        ...markedLabels.map(([stitch, mode]) => stitch.length + mode.length + 3),
        ...notes.map((n) => n.length),
      );
  // KB: interface.md §17
  const rows = rowCaptions(layout, options.tradition ?? 'cyc');
  const labelRoom = rows.length === 0 ? 0 : Math.max(...rows.map((row) => 7.4 * row.text.length + 10)) + 12;
  const drawWidth = chartWidth + 2 * labelRoom;
  const width = Math.max(drawWidth, textWidth, 360) + 2 * MARGIN;
  const legendTop = MARGIN + TITLE + chartHeight + MARGIN;
  const height = legendTop + 28 + legendRows * LEGEND_ROW + MARGIN;

  const ox = MARGIN + (width - 2 * MARGIN - drawWidth) / 2 + labelRoom - bounds.minX;
  const oy = MARGIN + TITLE - bounds.minY;

  const out: string[] = [];
  const title = pattern.title.trim() || chart.untitled;
  const gridAttribute = grid ? ` data-grid="${grid.grid.kind}"` : '';
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(width)}" height="${num(height)}" viewBox="0 0 ${num(width)} ${num(height)}" role="img" aria-labelledby="chart-title" data-terms="${terms}" data-chart-style="${symbols.style ?? 'cyc'}"${gridAttribute}>`,
    `<title id="chart-title">${escapeXml(chart.title(title))}</title>`,
    `<style>.ink{fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.ink .fill{stroke:none;fill:currentColor}</style>`,
    `<rect width="100%" height="100%" fill="${colors.background}"/>`,
    `<text x="${MARGIN}" y="${MARGIN + 20}" ${FONT} font-size="20" fill="${colors.text}">${escapeXml(title)}</text>`,
    `<g transform="translate(${num(ox)} ${num(oy)})">`,
  );

  if (grid) {
    const { bands, lines } = gridPaths(grid.grid);
    const c = grid.colors;
    const stroke = { cell: c.cell, row: c.row, five: c.strong, ten: c.strong };
    out.push('<g class="grid">');
    for (const band of bands) {
      out.push(
        `<path d="${band.d}" fill="${band.tone === 0 ? c.rowA : c.rowB}"${band.evenOdd ? ' fill-rule="evenodd"' : ''}/>`,
      );
    }
    for (const line of lines) {
      const dash = line.dashed ? ' stroke-dasharray="4 3"' : '';
      out.push(
        `<path d="${line.d}" fill="none" stroke="${stroke[line.weight]}" stroke-width="${LINE_WIDTH[line.weight]}"${dash}/>`,
      );
    }
    out.push('</g>');
  }

  for (const { x0, y0, x1, y1 } of options.unitFrames ?? []) {
    out.push(
      `<rect data-unit-frame="" x="${num(x0)}" y="${num(y0)}" width="${num(x1 - x0)}" height="${num(y1 - y0)}" fill="${colors.text}" fill-opacity="0.06" stroke="${colors.text}" stroke-width="2" stroke-dasharray="6 4"/>`,
    );
  }

  for (const side of ['right', 'wrong'] as const) {
    const color = colors[side];
    out.push(`<g class="ink" stroke="${color}" color="${color}" data-side="${side}">`);
    for (const node of layout.nodes.values()) {
      const def = library.get(node.def);
      if (node.side !== side || !def) continue;
      const insertion = insertions.get(node.id);
      for (const shape of placedShapes(def, node, insertion ? { ...symbols, insertion } : symbols))
        out.push(shapeToSvg(shape));
      const foot = options.spikes?.has(node.id) ? node.feet[0] : undefined;
      if (foot) out.push(`<circle class="fill" data-spike="" cx="${num(foot.x)}" cy="${num(foot.y)}" r="3.5"/>`);
    }
    out.push('</g>');
  }

  // KB: interface.md §14
  out.push(`<g ${FONT} font-size="12" fill="${colors.text}" dominant-baseline="middle">`);
  for (const caption of rows) {
    const labelWidth = 7.4 * caption.text.length + 10;
    const x0 = caption.rightwards ? bounds.maxX + 12 : bounds.minX - 12 - labelWidth;
    out.push(
      `<rect x="${num(x0)}" y="${num(caption.end.y - LABEL_HEIGHT / 2)}" width="${num(labelWidth)}" height="${LABEL_HEIGHT}" rx="4" fill="${colors[caption.side]}"/>`,
      `<text x="${num(x0 + labelWidth / 2)}" y="${num(caption.end.y)}" text-anchor="middle" font-weight="700" fill="${colors.background}">${escapeXml(caption.text)}</text>`,
    );
  }
  out.push('</g></g>');

  out.push(`<g ${FONT} font-size="13" fill="${colors.text}">`);
  const heading = system ? chart.legendWith(system) : chart.legend;
  out.push(`<text x="${MARGIN}" y="${num(legendTop + 14)}" font-weight="700">${heading}</text>`);
  let y = legendTop + 28;
  const iconCenter = (row: number) => ({ x: MARGIN + LEGEND_ICON / 2, y: row + LEGEND_ROW / 2 });

  const legendIcon = (shapes: readonly Shape[], label: string, row: number) => {
    const b = shapeBounds(shapes);
    const k = Math.min(1, LEGEND_ICON / Math.max(b.maxX - b.minX, b.maxY - b.minY, 1));
    const c = iconCenter(row);
    const tx = c.x - (k * (b.minX + b.maxX)) / 2;
    const ty = c.y - (k * (b.minY + b.maxY)) / 2;
    out.push(
      `<g class="ink" stroke="${colors.right}" color="${colors.right}" transform="translate(${num(tx)} ${num(ty)}) scale(${num(k)})" stroke-width="${num(2 / k)}">${shapes.map(shapeToSvg).join('')}</g>`,
      `<text x="${MARGIN + LEGEND_ICON + 12}" y="${num(c.y)}" dominant-baseline="middle">${label}</text>`,
    );
  };

  legend.forEach((def, i) => {
    const shapes = symbolShapes(def, symbols);
    const b = shapeBounds(shapes);
    const k = Math.min(1, LEGEND_ICON / Math.max(b.maxX - b.minX, b.maxY - b.minY, 1));
    const c = iconCenter(y);
    const tx = c.x - (k * (b.minX + b.maxX)) / 2;
    const ty = c.y - (k * (b.minY + b.maxY)) / 2;
    out.push(
      `<g class="ink" stroke="${colors.right}" color="${colors.right}" transform="translate(${num(tx)} ${num(ty)}) scale(${num(k)})" stroke-width="${num(2 / k)}">${shapes.map(shapeToSvg).join('')}</g>`,
      `<text x="${MARGIN + LEGEND_ICON + 12}" y="${num(c.y)}" dominant-baseline="middle" lang="${textLanguage(terms)}">${escapeXml(labels[i]!)}</text>`,
    );
    y += LEGEND_ROW;
  });

  marked.forEach(({ def, mode }, i) => {
    const [stitch, modeName] = markedLabels[i]!;
    legendIcon(
      symbolShapes(def, { ...symbols, insertion: mode }),
      `<tspan lang="${textLanguage(terms)}">${escapeXml(stitch)}</tspan> – ${escapeXml(modeName)}`,
      y,
    );
    y += LEGEND_ROW;
  });

  for (const [color, label] of keys) {
    const c = iconCenter(y);
    out.push(
      `<line x1="${MARGIN}" y1="${num(c.y)}" x2="${MARGIN + LEGEND_ICON}" y2="${num(c.y)}" stroke="${color}" stroke-width="4"/>`,
      `<text x="${MARGIN + LEGEND_ICON + 12}" y="${num(c.y)}" dominant-baseline="middle">${escapeXml(label)}</text>`,
    );
    y += LEGEND_ROW;
  }
  for (const note of notes) {
    out.push(`<text x="${MARGIN}" y="${num(iconCenter(y).y)}" dominant-baseline="middle">${escapeXml(note)}</text>`);
    y += LEGEND_ROW;
  }
  out.push('</g></svg>');
  return `${out.join('\n')}\n`;
}
