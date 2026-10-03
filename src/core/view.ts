import type { Point, Rect, Size } from './freeform.ts';

/**
 * How the board is looked at: `zoom` screen pixels per board unit, and `origin`
 * the board point in the top left corner of the screen. The board itself is the
 * sheet, the drawing area at 100%; the view only ever shows part of it.
 */
export interface View {
  readonly zoom: number;
  readonly origin: Point;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;
/** What the zoom buttons step through; the wheel goes anywhere in between. */
export const ZOOM_STEPS: readonly number[] = [1, 1.25, 1.5, 2, 3, 4, 6, 8];

export const DEFAULT_VIEW: View = { zoom: 1, origin: { x: 0, y: 0 } };

export function toBoard(view: View, screen: Point): Point {
  return { x: view.origin.x + screen.x / view.zoom, y: view.origin.y + screen.y / view.zoom };
}

export function toScreen(view: View, board: Point): Point {
  return { x: (board.x - view.origin.x) * view.zoom, y: (board.y - view.origin.y) * view.zoom };
}

/** The part of the sheet on screen, in board units. */
export function visibleRect(view: View, sheet: Size): Rect {
  return {
    minX: view.origin.x,
    minY: view.origin.y,
    maxX: view.origin.x + sheet.width / view.zoom,
    maxY: view.origin.y + sheet.height / view.zoom,
  };
}

/** The zoom kept between the limits, and the view kept on the sheet. */
export function clampView(view: View, sheet: Size): View {
  const zoom = Number.isFinite(view.zoom) ? Math.min(Math.max(view.zoom, MIN_ZOOM), MAX_ZOOM) : MIN_ZOOM;
  const limit = (at: number, length: number): number =>
    Number.isFinite(at) ? Math.min(Math.max(at, 0), Math.max(0, length - length / zoom)) : 0;
  return { zoom, origin: { x: limit(view.origin.x, sheet.width), y: limit(view.origin.y, sheet.height) } };
}

/** Zooms to `zoom`, keeping the board point under `anchor` (a screen point) where it is. */
export function zoomAt(view: View, zoom: number, anchor: Point, sheet: Size): View {
  const held = toBoard(view, anchor);
  const next = clampView({ ...view, zoom }, sheet).zoom;
  return clampView({ zoom: next, origin: { x: held.x - anchor.x / next, y: held.y - anchor.y / next } }, sheet);
}

/** The next step up (`1`) or down (`-1`) from `zoom`, which need not be a step itself. */
export function zoomStep(zoom: number, direction: 1 | -1): number {
  const EPSILON = 1e-6;
  if (direction === 1) return ZOOM_STEPS.find((step) => step > zoom + EPSILON) ?? MAX_ZOOM;
  return [...ZOOM_STEPS].reverse().find((step) => step < zoom - EPSILON) ?? MIN_ZOOM;
}

/** Moves the view by a screen distance: the sheet follows the pointer. */
export function panBy(view: View, dx: number, dy: number, sheet: Size): View {
  return clampView(
    { zoom: view.zoom, origin: { x: view.origin.x - dx / view.zoom, y: view.origin.y - dy / view.zoom } },
    sheet,
  );
}
