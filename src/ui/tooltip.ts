/*
 * A menüsor ikongombjainak tooltipje (PQW-882). A megjelenítést a CSS végzi
 * (`:hover`, `:focus-visible`), így inaktív gombon is működik. Ez a modul csak
 * azt dönti el, merre igazodjon a felirat, hogy ne lógjon ki az ablakból.
 */

/** A tooltip legnagyobb szélességének (22rem) fele, képpontban. */
const HALF_WIDTH = 176;

export type TipAlign = 'start' | 'center' | 'end';

/** A gomb közepe és az ablak szélessége alapján az igazítás. */
export function tipAlign(center: number, viewport: number, half = HALF_WIDTH): TipAlign {
  if (center < half) return 'start';
  if (center > viewport - half) return 'end';
  return 'center';
}

/** A `data-tip` gombok igazítása most, és minden átméretezés után. */
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
