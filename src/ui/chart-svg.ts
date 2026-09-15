/*
 * A diagram SVG-ként, jelmagyarázattal: ebből készül az SVG- és a PNG-export.
 *
 * DOM nélküli, ezért a Node is futtatja (tests/ui-chart-svg.test.mjs), és a
 * magot `.ts` kiterjesztéssel importálja. A diagram a jeleket a színoldali
 * látványban mutatja (01 §6.1), a sorszám a sor kezdő oldalán, a szemszám a
 * végén áll, a színoldali és a visszai sorok színe eltér (03 §2.1, §10 I42).
 *
 * A jelmagyarázat a választott jelöléssel és jelstílussal készül, és megnevezi
 * őket; angol jelölésnél a rendszert is („US terms”, „UK terms”, PQW-868).
 *
 * A rács (PQW-874) választhatóan kerül az exportba, ugyanazzal a rajzzal,
 * mint a vásznon (src/ui/grid-paths.ts).
 *
 * A sorszám és a szemszám felirata a minta hagyományát követi, japánban
 * „18目”, az ismétlés „6目1模様” (src/ui/chart-labels.ts, PQW-876).
 */

import { chartBounds, type ChartGrid } from '../core/grid.ts';
import type { ChartLayout } from '../core/layout.ts';
import { VOCABULARIES } from '../core/pattern-text.ts';
import type { StitchLibrary } from '../core/stitch-library.ts';
import { stitchLabel } from '../core/stitchText.ts';
import type { Locale, Pattern, StitchDef, Tradition } from '../core/types.ts';
import { chartLabels } from './chart-labels.ts';
import { gridPaths, LINE_WIDTH } from './grid-paths.ts';
import { chartStyleLabel, textLanguage, termsLabel } from './notation.ts';
import { DEFAULT_SYMBOL_OPTIONS, placedShapes, shapeBounds, symbolShapes, type Shape, type SymbolOptions } from './symbols.ts';

export interface ChartColors {
  readonly right: string;
  readonly wrong: string;
  readonly text: string;
  readonly background: string;
}

/** A rács színei: a két váltakozó sorszín, a cellavonal, a sorhatár és a hangsúlyos vonal. */
export interface GridColors {
  readonly rowA: string;
  readonly rowB: string;
  readonly cell: string;
  readonly row: string;
  readonly strong: string;
}

export interface ChartSvgOptions {
  readonly colors: ChartColors;
  /** Tükrözött nézet; a jelmagyarázat megjegyzi. */
  readonly mirror?: boolean;
  /** A jelmagyarázat jelölése; hiányában magyar. */
  readonly terms?: Locale;
  /** A jelek stílusa és a rövidpálca jele; hiányában CYC és +. */
  readonly symbols?: SymbolOptions;
  /** A rács az exportban (PQW-874); hiányában rács nélkül. */
  readonly grid?: { readonly grid: ChartGrid; readonly colors: GridColors };
  /** A minta hagyománya a feliratokhoz (PQW-876); hiányában CYC. */
  readonly tradition?: Tradition;
}

const MARGIN = 24;
const TITLE = 36;
const LEGEND_ROW = 34;
const LEGEND_ICON = 26;
const LABEL_HEIGHT = 16;
const FONT = "font-family=\"Karla, system-ui, -apple-system, 'Segoe UI', sans-serif\"";

const num = (value: number) => String(Math.round(value * 100) / 100);

export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
}

export function shapeToSvg(shape: Shape): string {
  switch (shape.kind) {
    case 'line':
      return `<line x1="${num(shape.from.x)}" y1="${num(shape.from.y)}" x2="${num(shape.to.x)}" y2="${num(shape.to.y)}"/>`;
    case 'curve':
      return `<path d="M${num(shape.from.x)} ${num(shape.from.y)}Q${num(shape.control.x)} ${num(shape.control.y)} ${num(shape.to.x)} ${num(shape.to.y)}"/>`;
    case 'ellipse': {
      const rotate = shape.rotation ? ` transform="rotate(${num((shape.rotation * 180) / Math.PI)} ${num(shape.center.x)} ${num(shape.center.y)})"` : '';
      return `<ellipse cx="${num(shape.center.x)}" cy="${num(shape.center.y)}" rx="${num(shape.rx)}" ry="${num(shape.ry)}"${rotate}/>`;
    }
    case 'dot':
      return `<circle class="fill" cx="${num(shape.center.x)}" cy="${num(shape.center.y)}" r="${num(shape.r)}"/>`;
  }
}

/** A jelmagyarázat szemei az első előfordulás sorrendjében; a csoport tagjai helyett maga a csoport. */
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

export function chartSvg(pattern: Pattern, layout: ChartLayout, library: StitchLibrary, options: ChartSvgOptions): string {
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
  const keys: [string, string][] = [
    [colors.right, 'Színoldali sor'],
    [colors.wrong, 'Visszai sor'],
  ];
  const notes = [
    `Jelölés: ${termsLabel(terms)}; jelek: ${chartStyleLabel(symbols.style ?? 'cyc')}.`,
    captions.note,
    ...(repeat ? [`Ismétlés: ${repeat}.`] : []),
    ...(grid ? ['Rács: váltakozó sávok, minden 5. és 10. vonal vastagabb.'] : []),
    ...(options.mirror ? ['Tükrözött nézet balkezeseknek.'] : []),
  ];
  const legendRows = legend.length + keys.length + notes.length;
  // A felirat szélessége becslés: 13 px-es betűnél karakterenként legfeljebb kb. 7,4 px.
  const textWidth = LEGEND_ICON + 12 + 7.4 * Math.max(...labels.map((l) => l.length), ...notes.map((n) => n.length));
  const width = Math.max(chartWidth, textWidth, 360) + 2 * MARGIN;
  const legendTop = MARGIN + TITLE + chartHeight + MARGIN;
  const height = legendTop + 28 + legendRows * LEGEND_ROW + MARGIN;

  const ox = MARGIN + (width - 2 * MARGIN - chartWidth) / 2 - bounds.minX;
  const oy = MARGIN + TITLE - bounds.minY;

  const out: string[] = [];
  const title = pattern.title.trim() || 'Minta';
  const gridAttribute = grid ? ` data-grid="${grid.grid.kind}"` : '';
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(width)}" height="${num(height)}" viewBox="0 0 ${num(width)} ${num(height)}" role="img" aria-labelledby="chart-title" data-terms="${terms}" data-chart-style="${symbols.style ?? 'cyc'}"${gridAttribute}>`,
    `<title id="chart-title">${escapeXml(title)} — horgolásminta-diagram</title>`,
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
      out.push(`<path d="${band.d}" fill="${band.tone === 0 ? c.rowA : c.rowB}"${band.evenOdd ? ' fill-rule="evenodd"' : ''}/>`);
    }
    for (const line of lines) {
      const dash = line.dashed ? ' stroke-dasharray="4 3"' : '';
      out.push(`<path d="${line.d}" fill="none" stroke="${stroke[line.weight]}" stroke-width="${LINE_WIDTH[line.weight]}"${dash}/>`);
    }
    out.push('</g>');
  }

  for (const side of ['right', 'wrong'] as const) {
    const color = colors[side];
    out.push(`<g class="ink" stroke="${color}" color="${color}" data-side="${side}">`);
    for (const node of layout.nodes.values()) {
      const def = library.get(node.def);
      if (node.side !== side || !def) continue;
      for (const shape of placedShapes(def, node, symbols)) out.push(shapeToSvg(shape));
    }
    out.push('</g>');
  }

  // A sorszám a sor színével teli címkén, világos betűvel, mint a vásznon.
  out.push(`<g ${FONT} font-size="12" fill="${colors.text}" dominant-baseline="middle">`);
  for (const layer of layout.layers) {
    if (layer.index === 0) continue;
    const rightwards = layer.start.x <= layer.end.x;
    const labelWidth = 7.4 * captions.layer(layer.index).length + 10;
    const x0 = rightwards ? layer.start.x + 4 - labelWidth : layer.start.x - 4;
    const endAnchor = rightwards ? 'start' : 'end';
    out.push(
      `<rect x="${num(x0)}" y="${num(layer.start.y - LABEL_HEIGHT / 2)}" width="${num(labelWidth)}" height="${LABEL_HEIGHT}" rx="4" fill="${colors[layer.side]}"/>`,
      `<text x="${num(x0 + labelWidth / 2)}" y="${num(layer.start.y)}" text-anchor="middle" font-weight="700" fill="${colors.background}">${escapeXml(captions.layer(layer.index))}</text>`,
      `<text x="${num(layer.end.x)}" y="${num(layer.end.y)}" text-anchor="${endAnchor}">${escapeXml(captions.count(layer.stitchCount))}</text>`,
    );
  }
  out.push('</g></g>');

  out.push(`<g ${FONT} font-size="13" fill="${colors.text}">`);
  const heading = system ? `Jelmagyarázat (${system})` : 'Jelmagyarázat';
  out.push(`<text x="${MARGIN}" y="${num(legendTop + 14)}" font-weight="700">${heading}</text>`);
  let y = legendTop + 28;
  const iconCenter = (row: number) => ({ x: MARGIN + LEGEND_ICON / 2, y: row + LEGEND_ROW / 2 });

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
