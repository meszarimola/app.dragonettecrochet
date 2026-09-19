// An annotation as geometry: a label, a marker, a bracket, free text or an arrow.
// KB: interface.md §22, §39

import { type AnnotationItem, DEFAULT_FONT_SIZE, FONT_SIZE_RANGE, type NoteKind } from '../core/irregular-types.ts';
import { type Point, type Shape, stretchShapes } from './symbols.ts';

/** A piece of text to draw, in chart units, already placed and turned. */
export interface NoteText {
  readonly at: Point;
  readonly text: string;
  readonly size: number;
  /** Degrees clockwise from up, as the item's rotation. */
  readonly rotation: number;
  readonly anchor: 'start' | 'middle' | 'end';
}

export interface NoteDrawing {
  readonly shapes: readonly Shape[];
  readonly texts: readonly NoteText[];
}

interface LocalText {
  readonly at: Point;
  readonly text: string;
  readonly size: number;
  readonly anchor: NoteText['anchor'];
}

interface LocalDrawing {
  readonly shapes: readonly Shape[];
  readonly texts: readonly LocalText[];
}

const ORIGIN: Point = { x: 0, y: 0 };
const MIN_SPAN = 1;

const MARKER_DASHES = 4;
/** A gap as a share of a dash. */
const DASH_GAP = 0.5;
/** How far a bracket's end hook reaches in, as a share of the half width. */
const HOOK_REACH = 0.25;
const HEAD_ANGLE = 25;
const HEAD_SHARE = 0.2;
/** Chart units: past this a longer arrow keeps the same head. */
const HEAD_MAX = 14;
/** How far a bracket's text stands off the tip, in font sizes. */
const TEXT_GAP = 0.7;

/** Starting boxes, in font sizes. */
const TEXT_LINE = 1.25;
const MARKER_THICK = 0.5;
const MARKER_LONG = 2;
const BRACKET_WIDE = 6;
const BRACKET_DEEP = 1.5;
const ARROW_LONG = 4;
/**
 * A rough advance width per character. Real metrics need a canvas, and this
 * only decides the box a fresh annotation is born with.
 */
const ADVANCE = 0.55;

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function span(value: number): number {
  return Number.isFinite(value) && value > MIN_SPAN ? value : MIN_SPAN;
}

function sizeOf(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_FONT_SIZE;
  return Math.min(FONT_SIZE_RANGE.max, Math.max(FONT_SIZE_RANGE.min, value));
}

function cleanText(text: string): string {
  return typeof text === 'string' ? text.trim() : '';
}

function stroke(from: Point, to: Point): Shape {
  return { kind: 'line', role: 'stem', from, to };
}

function arc(from: Point, control: Point, to: Point): Shape {
  return { kind: 'curve', role: 'stem', from, control, to };
}

function firstPoint(shape: Shape): Point {
  switch (shape.kind) {
    case 'line':
    case 'curve':
      return shape.from;
    case 'ellipse':
    case 'dot':
      return shape.center;
  }
}

function markerShapes(height: number, dotted: boolean): Shape[] {
  const half = height / 2;
  if (!dotted) return [stroke({ x: 0, y: -half }, { x: 0, y: half })];
  const dash = height / (MARKER_DASHES + (MARKER_DASHES - 1) * DASH_GAP);
  const step = dash * (1 + DASH_GAP);
  return Array.from({ length: MARKER_DASHES }, (_, index) => {
    const start = -half + index * step;
    return stroke({ x: 0, y: start }, { x: 0, y: start + dash });
  });
}

function bracketShapes(width: number, height: number): Shape[] {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const hook = Math.min(halfWidth * HOOK_REACH, halfHeight);
  const tip = { x: 0, y: -halfHeight };
  return [
    arc({ x: -halfWidth, y: halfHeight }, { x: -halfWidth, y: 0 }, { x: -halfWidth + hook, y: 0 }),
    arc({ x: -halfWidth + hook, y: 0 }, ORIGIN, tip),
    arc({ x: halfWidth, y: halfHeight }, { x: halfWidth, y: 0 }, { x: halfWidth - hook, y: 0 }),
    arc({ x: halfWidth - hook, y: 0 }, ORIGIN, tip),
  ];
}

function arrowShapes(width: number): Shape[] {
  const half = width / 2;
  const tip = { x: half, y: 0 };
  const head = Math.min(width * HEAD_SHARE, HEAD_MAX);
  const radians = (HEAD_ANGLE * Math.PI) / 180;
  const back = half - Math.cos(radians) * head;
  const side = Math.sin(radians) * head;
  return [stroke({ x: -half, y: 0 }, tip), stroke(tip, { x: back, y: -side }), stroke(tip, { x: back, y: side })];
}

function centredText(text: string, size: number): LocalText[] {
  return text === '' ? [] : [{ at: ORIGIN, text, size, anchor: 'middle' }];
}

function textBeyondTip(text: string, size: number, height: number): LocalText[] {
  if (text === '') return [];
  return [{ at: { x: 0, y: -height / 2 - size * TEXT_GAP }, text, size, anchor: 'middle' }];
}

function localDrawing(item: AnnotationItem): LocalDrawing {
  const width = span(item.width);
  const height = span(item.height);
  const size = sizeOf(item.fontSize);
  const text = cleanText(item.text);
  switch (item.note) {
    case 'text':
    case 'label':
      return { shapes: [], texts: centredText(text, size) };
    case 'marker':
      return { shapes: markerShapes(height, item.dotted === true), texts: [] };
    case 'bracket':
      return { shapes: bracketShapes(width, height), texts: textBeyondTip(text, size, height) };
    case 'arrow':
      return { shapes: arrowShapes(width), texts: [] };
    default:
      return { shapes: [], texts: [] };
  }
}

function place(local: LocalDrawing, item: AnnotationItem): NoteDrawing {
  const rotation = finiteOr(item.rotation, 0);
  const scale = { x: item.flipX ? -1 : 1, y: item.flipY ? -1 : 1 };
  const at = { x: finiteOr(item.x, 0), y: finiteOr(item.y, 0) };
  // The text anchors ride along as sizeless dots, so one placement serves both.
  const anchors = local.texts.map((text): Shape => ({ kind: 'dot', role: 'dot', center: text.at, r: 0 }));
  const moved = stretchShapes([...local.shapes, ...anchors], ORIGIN, scale, (rotation * Math.PI) / 180, at);
  const count = local.shapes.length;
  return {
    shapes: moved.slice(0, count),
    texts: local.texts.map((text, index) => ({ ...text, at: firstPoint(moved[count + index]), rotation })),
  };
}

/** Everything an annotation needs drawn, whatever kind it is. */
export function noteDrawing(item: AnnotationItem): NoteDrawing {
  return place(localDrawing(item), item);
}

/** How big a box the annotation wants, so a fresh one is born the right size. */
export function noteSize(note: NoteKind, text: string, fontSize: number): { width: number; height: number } {
  const size = sizeOf(fontSize);
  const written = Math.max(1, cleanText(text).length) * size * ADVANCE;
  switch (note) {
    case 'marker':
      return { width: size * MARKER_THICK, height: size * MARKER_LONG };
    case 'bracket':
      return { width: size * BRACKET_WIDE, height: size * BRACKET_DEEP };
    case 'arrow':
      return { width: size * ARROW_LONG, height: size * TEXT_LINE };
    default:
      return { width: written, height: size * TEXT_LINE };
  }
}
