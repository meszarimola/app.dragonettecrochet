// KB: interface.md §13

export interface SizeRange {
  readonly min: number;
  readonly max: number;
}

const STEP = 5;
const PAGE = 25;
export const COLLAPSE_DISTANCE = 40;

export function clampSize(size: number, range: SizeRange): number {
  return Math.min(range.max, Math.max(Math.min(range.min, range.max), size));
}

export function percentOf(size: number, range: SizeRange): number {
  return range.max > 0 ? Math.round((clampSize(size, range) / range.max) * 100) : 0;
}

export function isFull(size: number, range: SizeRange): boolean {
  return size >= range.max - 1;
}

export function keySize(key: string, size: number, range: SizeRange): number | null {
  if (range.max <= 0) return null;
  const percent = (size / range.max) * 100;
  // The browser rounds the height to 1/64 px, so half a pixel is still the same division.
  const slack = 50 / range.max;
  const up = (step: number) => ((Math.floor((percent + slack) / step) + 1) * step * range.max) / 100;
  const down = (step: number) => ((Math.ceil((percent - slack) / step) - 1) * step * range.max) / 100;
  switch (key) {
    case 'ArrowUp':
    case 'ArrowRight':
      return clampSize(up(STEP), range);
    case 'ArrowDown':
    case 'ArrowLeft':
      return clampSize(down(STEP), range);
    case 'PageUp':
      return clampSize(up(PAGE), range);
    case 'PageDown':
      return clampSize(down(PAGE), range);
    case 'Home':
      return range.min;
    case 'End':
      return range.max;
    default:
      return null;
  }
}

export function dragSize(start: number, rise: number, range: SizeRange): number {
  return clampSize(start + rise, range);
}

export function dragCollapses(start: number, rise: number, range: SizeRange): boolean {
  return start + rise < range.min - COLLAPSE_DISTANCE;
}

// KB: interface.md §13
export function statusPlace(panel: number, status: number, stage: number): { readonly block: number; readonly lift: number } {
  const lift = Math.max(0, Math.min(panel, panel + status - stage));
  return { block: panel - lift, lift };
}
