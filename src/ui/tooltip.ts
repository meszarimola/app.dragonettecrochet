// KB: interface.md §12

const HALF_WIDTH = 176;

export type TipAlign = 'start' | 'center' | 'end';

export function tipAlign(center: number, viewport: number, half = HALF_WIDTH): TipAlign {
  if (center < half) return 'start';
  if (center > viewport - half) return 'end';
  return 'center';
}

export function alignTooltips(root: HTMLElement): void {
  const update = (): void => {
    const viewport = document.documentElement.clientWidth;
    for (const tool of root.querySelectorAll<HTMLElement>('[data-tip]')) {
      const box = tool.getBoundingClientRect();
      tool.dataset.tipAlign = tipAlign(box.left + box.width / 2, viewport);
    }
  };
  update();
  new ResizeObserver(update).observe(root);
}
