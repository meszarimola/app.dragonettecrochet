/*
 * Az írott minta panel magassága (PQW-885). A panel a fejlécétől (csak a cím
 * és a gombok látszanak) a teljes munkaterületig állítható: húzással és az
 * elválasztón billentyűzettel. A számolás képpontban történik, a DOM nélkül.
 */

/** A panel magasságának tartománya képpontban: `min` a fejléc, `max` a munkaterület. */
export interface SizeRange {
  readonly min: number;
  readonly max: number;
}

/** A nyilak lépése és a PageUp/PageDown lépése a munkaterület százalékában. */
const STEP = 5;
const PAGE = 25;
/** Ha a húzás ennyivel a fejléc alá ér, elengedéskor a panel lecsukódik. */
export const COLLAPSE_DISTANCE = 40;

export function clampSize(size: number, range: SizeRange): number {
  return Math.min(range.max, Math.max(Math.min(range.min, range.max), size));
}

/** A magasság a munkaterület százalékában, egészre kerekítve (`aria-valuenow`). */
export function percentOf(size: number, range: SizeRange): number {
  return range.max > 0 ? Math.round((clampSize(size, range) / range.max) * 100) : 0;
}

/** A panel a teljes munkaterületet elfoglalja-e (fél képpont tűréssel a kerekítés miatt). */
export function isFull(size: number, range: SizeRange): boolean {
  return size >= range.max - 1;
}

/**
 * Az elválasztón lenyomott billentyű utáni magasság, vagy `null`, ha a
 * billentyű nem állít. Fel és jobbra nő, le és balra csökken; a lépés a
 * munkaterület 5 %-os osztásaira kerekít, így a felolvasott érték is kerek.
 */
export function keySize(key: string, size: number, range: SizeRange): number | null {
  if (range.max <= 0) return null;
  const percent = (size / range.max) * 100;
  // A böngésző 1/64 képpontra kerekíti a magasságot: a fél képpontnyi eltérés még ugyanaz az osztás.
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

/** Húzás közben a magasság: az elválasztó felfelé mozdulása (`rise`, képpont) növeli. */
export function dragSize(start: number, rise: number, range: SizeRange): number {
  return clampSize(start + rise, range);
}

/** Elengedéskor lecsukódik-e a panel: a húzás jóval a fejléc alá ért. */
export function dragCollapses(start: number, rise: number, range: SizeRange): boolean {
  return start + rise < range.min - COLLAPSE_DISTANCE;
}

/**
 * Az állapotsor helye (PQW-883, PQW-885): a panel fölött áll. Ha ott nem fér
 * el, mert a panel majdnem a teljes munkaterület, a panel teteje ad neki
 * helyet (`lift`), így az állapotsor sem a panel fejlécét, sem a vászon fölé
 * lógva a menüsort nem takarja. `block` az állapotsor alsó távolsága a
 * munkaterület aljától.
 */
export function statusPlace(panel: number, status: number, stage: number): { readonly block: number; readonly lift: number } {
  const lift = Math.max(0, Math.min(panel, panel + status - stage));
  return { block: panel - lift, lift };
}
