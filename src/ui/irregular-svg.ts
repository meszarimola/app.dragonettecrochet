// The free-form chart as an SVG document. KB: interface.md §14, §39

import { type Box, isVisible, itemsBox, rowById, unionBox } from '../core/irregular-document.ts';
import { directionOf, ringRadii, spokeAngles } from '../core/irregular-snap.ts';
import {
  type BackgroundImage,
  EXPORT_MARGIN,
  type IrregularItem,
  type IrregularPattern,
  type LegendBlock,
  type PolarGuide,
} from '../core/irregular-types.ts';
import { escapeXml, shapeToSvg } from './chart-svg.ts';
import { itemShapes } from './irregular-glyph.ts';
import { type Shape, type SymbolOptions, shapesBounds } from './symbols.ts';

export interface LegendLine {
  readonly shapes: readonly Shape[];
  readonly text: string;
}

export interface IrregularSvgOptions {
  readonly symbols: SymbolOptions;
  /** The entry's chosen symbol, or null when it keeps the preset's. */
  readonly glyphOf: (keyEntryId: string) => string | null;
  /** Drawn at the legend block's place when the legend is on the image. */
  readonly legend: { readonly block: LegendBlock; readonly lines: readonly LegendLine[] } | null;
  /** Whether the square and circle guides go into the file. */
  readonly guides: boolean;
  /** The tracing photo, already turned into a data URL, when it is to be included. */
  readonly background: { readonly placement: BackgroundImage; readonly href: string } | null;
  /** White, or nothing for a transparent background. */
  readonly paper: string | null;
  /** The ink colour for a stitch with no colour of its own. */
  readonly ink: string;
}

type BoxOptions = Pick<IrregularSvgOptions, 'legend' | 'background' | 'guides'>;

const LEGEND_ICON = 22;
const LEGEND_ROW = 30;
const LEGEND_GAP = 10;
const LEGEND_COLUMN = 190;
const LEGEND_FONT = 13;
// Capitals, digits and the separator run wider than an average letter, and a
// clipped legend line is worse than a little slack.
const CHAR_WIDTH = 8.4;
const STROKE = 2;
const GUIDE_OPACITY = 0.25;
const GRID_LINES = 400;
const FONT = 'font-family="system-ui, sans-serif"';

const num = (value: number): string => (Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '0');

const isFinitePoint = (point: { readonly x: number; readonly y: number }): boolean =>
  Number.isFinite(point.x) && Number.isFinite(point.y);

function isFiniteShape(shape: Shape): boolean {
  switch (shape.kind) {
    case 'line':
      return isFinitePoint(shape.from) && isFinitePoint(shape.to);
    case 'curve':
      return isFinitePoint(shape.from) && isFinitePoint(shape.control) && isFinitePoint(shape.to);
    case 'ellipse':
      return (
        isFinitePoint(shape.center) &&
        Number.isFinite(shape.rx) &&
        Number.isFinite(shape.ry) &&
        Number.isFinite(shape.rotation)
      );
    case 'dot':
      return isFinitePoint(shape.center) && Number.isFinite(shape.r);
  }
}

const isFiniteBox = (box: Box): boolean =>
  Number.isFinite(box.minX) && Number.isFinite(box.minY) && Number.isFinite(box.maxX) && Number.isFinite(box.maxY);

const isFiniteItem = (item: IrregularItem): boolean =>
  Number.isFinite(item.x) &&
  Number.isFinite(item.y) &&
  Number.isFinite(item.width) &&
  Number.isFinite(item.height) &&
  Number.isFinite(item.rotation);

/** The photo is drawn exactly where the canvas draws it, and never when the canvas would skip it. */
function drawsBackground(placement: BackgroundImage): boolean {
  return (
    placement.visible &&
    placement.opacity > 0 &&
    placement.width > 0 &&
    placement.height > 0 &&
    Number.isFinite(placement.x) &&
    Number.isFinite(placement.y) &&
    Number.isFinite(placement.width) &&
    Number.isFinite(placement.height) &&
    Number.isFinite(placement.rotation)
  );
}

function backgroundBox(placement: BackgroundImage): Box {
  const radians = (placement.rotation * Math.PI) / 180;
  const [cos, sin] = [Math.abs(Math.cos(radians)), Math.abs(Math.sin(radians))];
  const halfWidth = (placement.width * cos + placement.height * sin) / 2;
  const halfHeight = (placement.width * sin + placement.height * cos) / 2;
  return {
    minX: placement.x - halfWidth,
    minY: placement.y - halfHeight,
    maxX: placement.x + halfWidth,
    maxY: placement.y + halfHeight,
  };
}

function drawsPolar(polar: PolarGuide): boolean {
  return (
    polar.visible &&
    polar.rings >= 1 &&
    polar.spokes >= 1 &&
    polar.spacing > 0 &&
    isFinitePoint(polar.center) &&
    Number.isFinite(polar.startAngle)
  );
}

function polarBox(polar: PolarGuide): Box {
  const reach = polar.rings * polar.spacing;
  return {
    minX: polar.center.x - reach,
    minY: polar.center.y - reach,
    maxX: polar.center.x + reach,
    maxY: polar.center.y + reach,
  };
}

interface LegendSlot {
  readonly line: LegendLine;
  readonly x: number;
  readonly y: number;
}

function legendSlots(block: LegendBlock, lines: readonly LegendLine[]): LegendSlot[] {
  if (lines.length === 0) return [];
  const columns = block.columns >= 1 && block.columns <= 3 ? block.columns : 1;
  const perColumn = Math.ceil(lines.length / columns);
  const x = Number.isFinite(block.position.x) ? block.position.x : 0;
  const y = Number.isFinite(block.position.y) ? block.position.y : 0;
  return lines.map((line, index) => ({
    line,
    x: x + Math.floor(index / perColumn) * LEGEND_COLUMN,
    y: y + (index % perColumn) * LEGEND_ROW,
  }));
}

function legendBox(slots: readonly LegendSlot[]): Box | null {
  return unionBox(
    slots.map((slot) => ({
      minX: slot.x,
      minY: slot.y - LEGEND_ROW / 2,
      maxX: slot.x + LEGEND_ICON + LEGEND_GAP + CHAR_WIDTH * [...slot.line.text].length,
      maxY: slot.y + LEGEND_ROW / 2,
    })),
  );
}

/** What the picture covers, in chart units, margin included. */
export function irregularBox(pattern: IrregularPattern, options: BoxOptions): Box {
  const parts: Box[] = [];
  const drawn = itemsBox(pattern.items.filter((item) => isVisible(pattern, item) && isFiniteItem(item)));
  if (drawn !== null) parts.push(drawn);
  if (options.background !== null && drawsBackground(options.background.placement)) {
    parts.push(backgroundBox(options.background.placement));
  }
  if (options.guides && drawsPolar(pattern.guides.polar)) parts.push(polarBox(pattern.guides.polar));
  if (options.legend !== null) {
    const legend = legendBox(legendSlots(options.legend.block, options.legend.lines));
    if (legend !== null) parts.push(legend);
  }
  const box = unionBox(parts.filter(isFiniteBox));
  if (box === null) {
    return { minX: -EXPORT_MARGIN, minY: -EXPORT_MARGIN, maxX: EXPORT_MARGIN, maxY: EXPORT_MARGIN };
  }
  return {
    minX: box.minX - EXPORT_MARGIN,
    minY: box.minY - EXPORT_MARGIN,
    maxX: box.maxX + EXPORT_MARGIN,
    maxY: box.maxY + EXPORT_MARGIN,
  };
}

function gridLines(size: number, box: Box): string[] {
  const out: string[] = [];
  const [width, height] = [box.maxX - box.minX, box.maxY - box.minY];
  if (width / size > GRID_LINES || height / size > GRID_LINES) return out;
  for (let x = Math.ceil(box.minX / size) * size; x <= box.maxX; x += size) {
    out.push(`<line x1="${num(x)}" y1="${num(box.minY)}" x2="${num(x)}" y2="${num(box.maxY)}"/>`);
  }
  for (let y = Math.ceil(box.minY / size) * size; y <= box.maxY; y += size) {
    out.push(`<line x1="${num(box.minX)}" y1="${num(y)}" x2="${num(box.maxX)}" y2="${num(y)}"/>`);
  }
  return out;
}

function polarLines(polar: PolarGuide): string[] {
  const out: string[] = [];
  const reach = polar.rings * polar.spacing;
  for (const radius of ringRadii(polar)) {
    out.push(`<circle cx="${num(polar.center.x)}" cy="${num(polar.center.y)}" r="${num(radius)}"/>`);
  }
  for (const angle of spokeAngles(polar)) {
    const direction = directionOf(angle);
    out.push(
      `<line x1="${num(polar.center.x)}" y1="${num(polar.center.y)}" x2="${num(polar.center.x + direction.x * reach)}" y2="${num(polar.center.y + direction.y * reach)}"/>`,
    );
  }
  return out;
}

function guideLines(pattern: IrregularPattern, box: Box): string[] {
  const { grid, polar } = pattern.guides;
  const out: string[] = [];
  if (grid.visible && Number.isFinite(grid.size) && grid.size > 0) out.push(...gridLines(grid.size, box));
  if (drawsPolar(polar)) out.push(...polarLines(polar));
  return out;
}

/** A stitch's own colour, then its row's, then the fallback ink. */
function inkOf(pattern: IrregularPattern, item: IrregularItem, fallback: string): string {
  if (item.color !== null) return item.color;
  return rowById(pattern, item.rowId)?.color ?? fallback;
}

function drawItems(
  pattern: IrregularPattern,
  items: readonly IrregularItem[],
  options: IrregularSvgOptions,
  out: string[],
): void {
  let open: string | null = null;
  for (const item of items) {
    const shapes = itemShapes(item, options.symbols, options.glyphOf(item.keyEntryId)).filter(isFiniteShape);
    if (shapes.length === 0) continue;
    const ink = inkOf(pattern, item, options.ink);
    if (ink !== open) {
      if (open !== null) out.push('</g>');
      out.push(`<g class="ink" stroke="${escapeXml(ink)}" color="${escapeXml(ink)}">`);
      open = ink;
    }
    for (const shape of shapes) out.push(shapeToSvg(shape));
  }
  if (open !== null) out.push('</g>');
}

function drawLegend(block: LegendBlock, lines: readonly LegendLine[], ink: string, out: string[]): void {
  const slots = legendSlots(block, lines);
  if (slots.length === 0) return;
  out.push(`<g data-legend="" ${FONT} font-size="${LEGEND_FONT}" fill="${escapeXml(ink)}">`);
  for (const slot of slots) {
    const shapes = slot.line.shapes.filter(isFiniteShape);
    const bounds = shapesBounds(shapes);
    if (bounds !== null) {
      const width = Math.max(1, bounds.maxX - bounds.minX);
      const height = Math.max(1, bounds.maxY - bounds.minY);
      const fit = Math.min(1, LEGEND_ICON / Math.max(width, height));
      const [midX, midY] = [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2];
      const place = `translate(${num(slot.x + LEGEND_ICON / 2)} ${num(slot.y)}) scale(${num(fit)}) translate(${num(-midX)} ${num(-midY)})`;
      out.push(
        // The document's own stylesheet beats a presentation attribute, so the
        // width that undoes the icon's scale has to be inline.
        `<g class="ink" stroke="${escapeXml(ink)}" color="${escapeXml(ink)}" style="stroke-width:${num(STROKE / fit)}" transform="${place}">${shapes.map(shapeToSvg).join('')}</g>`,
      );
    }
    out.push(
      `<text x="${num(slot.x + LEGEND_ICON + LEGEND_GAP)}" y="${num(slot.y)}" dominant-baseline="middle">${escapeXml(slot.line.text)}</text>`,
    );
  }
  out.push('</g>');
}

/** The whole chart as one SVG document. */
export function irregularSvg(pattern: IrregularPattern, options: IrregularSvgOptions): string {
  const box = irregularBox(pattern, options);
  const width = Math.max(box.maxX - box.minX, 1);
  const height = Math.max(box.maxY - box.minY, 1);
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(width)}" height="${num(height)}" viewBox="${num(box.minX)} ${num(box.minY)} ${num(width)} ${num(height)}" role="img">`,
  ];
  const title = pattern.title.trim();
  if (title !== '') out.push(`<title>${escapeXml(title)}</title>`);
  out.push(
    '<style>.ink{fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.ink .fill{stroke:none;fill:currentColor}</style>',
  );

  if (options.paper !== null) {
    out.push(
      `<rect data-paper="" x="${num(box.minX)}" y="${num(box.minY)}" width="${num(width)}" height="${num(height)}" fill="${escapeXml(options.paper)}"/>`,
    );
  }

  const background = options.background;
  if (background !== null && drawsBackground(background.placement)) {
    const { placement } = background;
    out.push(
      `<image data-background="" href="${escapeXml(background.href)}" x="${num(-placement.width / 2)}" y="${num(-placement.height / 2)}" width="${num(placement.width)}" height="${num(placement.height)}" opacity="${num(Math.min(1, placement.opacity))}" preserveAspectRatio="none" transform="translate(${num(placement.x)} ${num(placement.y)}) rotate(${num(placement.rotation)})"/>`,
    );
  }

  if (options.guides) {
    const lines = guideLines(pattern, box);
    if (lines.length > 0) {
      out.push(
        `<g data-guides="" fill="none" stroke="${escapeXml(options.ink)}" stroke-width="1" opacity="${GUIDE_OPACITY}">`,
        ...lines,
        '</g>',
      );
    }
  }

  const buckets = new Map<string, IrregularItem[]>();
  for (const layer of pattern.layers) if (layer.visible) buckets.set(layer.id, []);
  const loose: IrregularItem[] = [];
  for (const item of pattern.items) {
    if (!isVisible(pattern, item)) continue;
    const bucket = buckets.get(item.layerId);
    if (bucket === undefined) loose.push(item);
    else bucket.push(item);
  }

  if (loose.length > 0) {
    out.push('<g>');
    drawItems(pattern, loose, options, out);
    out.push('</g>');
  }
  for (const layer of pattern.layers) {
    const bucket = buckets.get(layer.id);
    if (bucket === undefined) continue;
    out.push(`<g data-layer="${escapeXml(layer.name)}">`);
    drawItems(pattern, bucket, options, out);
    out.push('</g>');
  }

  if (options.legend !== null) drawLegend(options.legend.block, options.legend.lines, options.ink, out);

  out.push('</svg>');
  return `${out.join('\n')}\n`;
}
