import type { Point, Rect, Size } from './freeform.ts';

/**
 * How the board is looked at: `zoom` screen pixels per board unit, and `origin`
 * the board point in the top left corner of the screen. At the default view a
 * board point is the screen point. `screen` below is the canvas's own size.
 * KB: interface.md §87
 */
export interface View {
  readonly zoom: number;
  readonly origin: Point;
}

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 8;
/** What the zoom buttons step through; the wheel goes anywhere in between. */
export const ZOOM_STEPS: readonly number[] = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8];

export const DEFAULT_VIEW: View = { zoom: 1, origin: { x: 0, y: 0 } };

/** The sheet: the default view and one more screen on every side of it. */
export function sheetOf(screen: Size): Rect {
  return { minX: -screen.width, minY: -screen.height, maxX: screen.width * 2, maxY: screen.height * 2 };
}

export function toBoard(view: View, at: Point): Point {
  return { x: view.origin.x + at.x / view.zoom, y: view.origin.y + at.y / view.zoom };
}

export function toScreen(view: View, board: Point): Point {
  return { x: (board.x - view.origin.x) * view.zoom, y: (board.y - view.origin.y) * view.zoom };
}

/** The part of the sheet on screen, in board units. */
export function visibleRect(view: View, screen: Size): Rect {
  return {
    minX: view.origin.x,
    minY: view.origin.y,
    maxX: view.origin.x + screen.width / view.zoom,
    maxY: view.origin.y + screen.height / view.zoom,
  };
}

/** The zoom kept between the limits, and what is on screen kept on the sheet. */
export function clampView(view: View, screen: Size): View {
  const zoom = Number.isFinite(view.zoom) ? Math.min(Math.max(view.zoom, MIN_ZOOM), MAX_ZOOM) : 1;
  const sheet = sheetOf(screen);
  const limit = (at: number, low: number, high: number, length: number): number =>
    Number.isFinite(at) ? Math.min(Math.max(at, low), Math.max(low, high - length / zoom)) : 0;
  return {
    zoom,
    origin: {
      x: limit(view.origin.x, sheet.minX, sheet.maxX, screen.width),
      y: limit(view.origin.y, sheet.minY, sheet.maxY, screen.height),
    },
  };
}

/** Zooms to `zoom`, keeping the board point under `anchor` (a screen point) where it is. */
export function zoomAt(view: View, zoom: number, anchor: Point, screen: Size): View {
  const held = toBoard(view, anchor);
  const next = clampView({ ...view, zoom }, screen).zoom;
  return clampView({ zoom: next, origin: { x: held.x - anchor.x / next, y: held.y - anchor.y / next } }, screen);
}

/** The next step up (`1`) or down (`-1`) from `zoom`, which need not be a step itself. */
export function zoomStep(zoom: number, direction: 1 | -1): number {
  const EPSILON = 1e-6;
  if (direction === 1) return ZOOM_STEPS.find((step) => step > zoom + EPSILON) ?? MAX_ZOOM;
  return [...ZOOM_STEPS].reverse().find((step) => step < zoom - EPSILON) ?? MIN_ZOOM;
}

/** Moves the view by a screen distance: the sheet follows the pointer. */
export function panBy(view: View, dx: number, dy: number, screen: Size): View {
  return clampView(
    { zoom: view.zoom, origin: { x: view.origin.x - dx / view.zoom, y: view.origin.y - dy / view.zoom } },
    screen,
  );
}
