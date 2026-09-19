import type { Point, Shape } from './symbols.ts';

export type PageSize = 'a4' | 'letter';
export type PageOrientation = 'auto' | 'portrait' | 'landscape';

export interface PdfPage {
  /** Shapes in chart units; the writer scales and tiles them. */
  readonly shapes: readonly Shape[];
  readonly lineWidth: number;
}

export interface PdfOptions {
  readonly title: string;
  readonly size: PageSize;
  readonly orientation: PageOrientation;
  /** How many pages across and down the chart is spread over. */
  readonly across: number;
  readonly down: number;
}

export interface PdfBox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

const A4 = [595.28, 841.89] as const;
const LETTER = [612, 792] as const;

const MAX_SIDE = 10;
const MARGIN = 28;
const TITLE_BAND = 24;
const TITLE_SIZE = 12;
const MARKER_SIZE = 10;
const OVERLAP = 12;
const KAPPA = 0.5523;
const LIMIT = 1e6;
const DIGIT_WIDTH = 0.556;
const PERIOD_WIDTH = 0.278;

interface Paper {
  readonly width: number;
  readonly height: number;
}

interface Extent {
  readonly width: number;
  readonly height: number;
}

interface Plan {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly stepX: number;
  readonly stepY: number;
}

type Arc = readonly [number, number, number, number, number, number];

function num(value: number): string {
  const clamped = Math.min(LIMIT, Math.max(-LIMIT, value));
  const rounded = Math.round(clamped * 1e6) / 1e6;
  return String(rounded === 0 ? 0 : rounded);
}

function finite(...values: number[]): boolean {
  return values.every((value) => Number.isFinite(value));
}

function gridSide(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_SIDE, Math.max(1, Math.floor(value)));
}

/** How many pages the document will have, for the interface to say so before writing it. */
export function pageCount(options: PdfOptions): number {
  return gridSide(options.across) * gridSide(options.down);
}

function extent(lo: number, hi: number): readonly [number, number] {
  if (!finite(lo, hi)) return [0, 0];
  return lo <= hi ? [lo, hi] : [hi, lo];
}

function paperOf(size: PageSize, landscape: boolean): Paper {
  const [short, long] = size === 'letter' ? LETTER : A4;
  return landscape ? { width: long, height: short } : { width: short, height: long };
}

function fitChart(paper: Paper, across: number, down: number, chart: Extent): Plan {
  const contentWidth = Math.max(paper.width - 2 * MARGIN, 1);
  const contentHeight = Math.max(paper.height - 2 * MARGIN - TITLE_BAND, 1);
  const overlap = across > 1 || down > 1 ? Math.min(OVERLAP, contentWidth / 2, contentHeight / 2) : 0;
  const spanWidth = across * contentWidth - (across - 1) * overlap;
  const spanHeight = down * contentHeight - (down - 1) * overlap;
  const byWidth = chart.width > 0 ? spanWidth / chart.width : Number.POSITIVE_INFINITY;
  const byHeight = chart.height > 0 ? spanHeight / chart.height : Number.POSITIVE_INFINITY;
  const wanted = Math.min(byWidth, byHeight);
  const scale = Number.isFinite(wanted) && wanted > 0 ? wanted : 1;
  return {
    scale,
    offsetX: (spanWidth - chart.width * scale) / 2,
    offsetY: (spanHeight - chart.height * scale) / 2,
    stepX: contentWidth - overlap,
    stepY: contentHeight - overlap,
  };
}

function landscapeFits(size: PageSize, across: number, down: number, chart: Extent): boolean {
  const upright = fitChart(paperOf(size, false), across, down, chart).scale;
  const sideways = fitChart(paperOf(size, true), across, down, chart).scale;
  return sideways > upright;
}

function curveOps(from: Point, control: Point, to: Point): string {
  const lead = { x: from.x + (2 / 3) * (control.x - from.x), y: from.y + (2 / 3) * (control.y - from.y) };
  const trail = { x: to.x + (2 / 3) * (control.x - to.x), y: to.y + (2 / 3) * (control.y - to.y) };
  return `${num(from.x)} ${num(from.y)} m ${num(lead.x)} ${num(lead.y)} ${num(trail.x)} ${num(trail.y)} ${num(to.x)} ${num(to.y)} c S`;
}

function ringOps(center: Point, rx: number, ry: number, rotation: number, paint: 'S' | 'f'): string {
  const a = Math.abs(rx);
  const b = Math.abs(ry);
  const turn = Number.isFinite(rotation) ? rotation : 0;
  if (!finite(center.x, center.y, a, b) || (a === 0 && b === 0)) return '';
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const at = (x: number, y: number) => `${num(center.x + x * cos - y * sin)} ${num(center.y + x * sin + y * cos)}`;
  const kx = KAPPA * a;
  const ky = KAPPA * b;
  const arcs: readonly Arc[] = [
    [a, ky, kx, b, 0, b],
    [-kx, b, -a, ky, -a, 0],
    [-a, -ky, -kx, -b, 0, -b],
    [kx, -b, a, -ky, a, 0],
  ];
  const curves = arcs.map(([x1, y1, x2, y2, x3, y3]) => `${at(x1, y1)} ${at(x2, y2)} ${at(x3, y3)} c`);
  return `${at(a, 0)} m ${curves.join(' ')} h ${paint}`;
}

function shapeToPdf(shape: Shape): string {
  switch (shape.kind) {
    case 'line':
      if (!finite(shape.from.x, shape.from.y, shape.to.x, shape.to.y)) return '';
      return `${num(shape.from.x)} ${num(shape.from.y)} m ${num(shape.to.x)} ${num(shape.to.y)} l S`;
    case 'curve':
      if (!finite(shape.from.x, shape.from.y, shape.control.x, shape.control.y, shape.to.x, shape.to.y)) return '';
      return curveOps(shape.from, shape.control, shape.to);
    case 'ellipse':
      return ringOps(shape.center, shape.rx, shape.ry, shape.rotation, 'S');
    case 'dot':
      return ringOps(shape.center, shape.r, shape.r, 0, 'f');
  }
}

/*
 * Helvetica is drawn through WinAnsiEncoding, which has no ő or ű. They take
 * four of its undefined codes, named in the /Differences array of the font.
 * The rest of the table is the WinAnsi code for a character Latin-1 lacks.
 */
const EXTRA = new Map<number, number>([
  [0x0150, 143],
  [0x0151, 129],
  [0x0170, 144],
  [0x0171, 141],
  [0x2013, 150],
  [0x2014, 151],
  [0x2018, 145],
  [0x2019, 146],
  [0x201c, 147],
  [0x201d, 148],
  [0x2026, 133],
]);

const DIFFERENCES = '[129 /ohungarumlaut 141 /uhungarumlaut 143 /Ohungarumlaut 144 /Uhungarumlaut]';

function winAnsi(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 32;
    if (code < 32) bytes.push(32);
    else if (code <= 126 || (code >= 160 && code <= 255)) bytes.push(code);
    else bytes.push(EXTRA.get(code) ?? 63);
  }
  return bytes;
}

function octal(byte: number): string {
  return `\\${byte.toString(8).padStart(3, '0')}`;
}

function literal(bytes: readonly number[]): string {
  const out = bytes.map((byte) => {
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) return `\\${String.fromCharCode(byte)}`;
    return byte < 32 || byte > 126 ? octal(byte) : String.fromCharCode(byte);
  });
  return `(${out.join('')})`;
}

function utf16Literal(text: string): string {
  const out = ['\\376\\377'];
  for (let i = 0; i < text.length; i += 1) {
    const unit = text.charCodeAt(i);
    out.push(octal((unit >> 8) & 0xff), octal(unit & 0xff));
  }
  return `(${out.join('')})`;
}

function textOps(text: string, x: number, y: number, fontSize: number): string {
  return `BT /F1 ${num(fontSize)} Tf 1 0 0 1 ${num(x)} ${num(y)} Tm ${literal(winAnsi(text))} Tj ET`;
}

function markerWidth(marker: string, fontSize: number): number {
  let em = 0;
  for (const char of marker) em += char === '.' ? PERIOD_WIDTH : DIGIT_WIDTH;
  return em * fontSize;
}

/** The finished document's bytes. */
export function writePdf(page: PdfPage, box: PdfBox, options: PdfOptions): Uint8Array {
  const across = gridSide(options.across);
  const down = gridSide(options.down);
  const size: PageSize = options.size === 'letter' ? 'letter' : 'a4';
  const [minX, maxX] = extent(box.minX, box.maxX);
  const [minY, maxY] = extent(box.minY, box.maxY);
  const chart: Extent = { width: maxX - minX, height: maxY - minY };
  const landscape =
    options.orientation === 'landscape' ||
    (options.orientation !== 'portrait' && landscapeFits(size, across, down, chart));
  const paper = paperOf(size, landscape);
  const plan = fitChart(paper, across, down, chart);
  const title = options.title || '';
  const stroke = Number.isFinite(page.lineWidth) && page.lineWidth > 0 ? page.lineWidth : 1;
  const drawing = page.shapes
    .map(shapeToPdf)
    .filter((ops) => ops.length > 0)
    .join('\n');
  const baseline = paper.height - MARGIN - TITLE_SIZE;
  const tiled = across > 1 || down > 1;

  const streams: string[] = [];
  for (let row = 0; row < down; row += 1) {
    for (let column = 0; column < across; column += 1) {
      const shiftX = MARGIN + plan.offsetX - minX * plan.scale - column * plan.stepX;
      const shiftY = paper.height - MARGIN - TITLE_BAND - plan.offsetY + minY * plan.scale + row * plan.stepY;
      const lines = ['0 g 0 G', textOps(title, MARGIN, baseline, TITLE_SIZE)];
      if (tiled) {
        const marker = `${row + 1}.${column + 1}`;
        const x = paper.width - MARGIN - markerWidth(marker, MARKER_SIZE);
        lines.push(textOps(marker, x, baseline, MARKER_SIZE));
      }
      lines.push(
        'q',
        `${num(plan.scale)} 0 0 ${num(-plan.scale)} ${num(shiftX)} ${num(shiftY)} cm`,
        `${num(stroke)} w 1 J 1 j`,
      );
      if (drawing.length > 0) lines.push(drawing);
      lines.push('Q');
      streams.push(lines.join('\n'));
    }
  }

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (text: string) => {
    const bytes = encoder.encode(text);
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (body: string) => {
    offsets.push(length);
    push(`${offsets.length} 0 obj\n${body}\nendobj\n`);
  };

  const kids = streams.map((_, index) => `${5 + 2 * index} 0 R`).join(' ');
  const media = `[0 0 ${num(paper.width)} ${num(paper.height)}]`;

  push('%PDF-1.4\n');
  object('<< /Type /Catalog /Pages 2 0 R >>');
  object(`<< /Type /Pages /Kids [${kids}] /Count ${streams.length} >>`);
  object(
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding << /Type /Encoding /BaseEncoding /WinAnsiEncoding /Differences ${DIFFERENCES} >> >>`,
  );
  object(`<< /Title ${utf16Literal(title)} >>`);
  for (const [index, stream] of streams.entries()) {
    object(
      `<< /Type /Page /Parent 2 0 R /MediaBox ${media} /Resources << /Font << /F1 3 0 R >> >> /Contents ${6 + 2 * index} 0 R >>`,
    );
    object(`<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`);
  }

  const startxref = length;
  const tableSize = offsets.length + 1;
  const table = offsets.map((at) => `${String(at).padStart(10, '0')} 00000 n \n`).join('');
  push(`xref\n0 ${tableSize}\n0000000000 65535 f \n${table}`);
  push(`trailer\n<< /Size ${tableSize} /Root 1 0 R /Info 4 0 R >>\nstartxref\n${startxref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}
