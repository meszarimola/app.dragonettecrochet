/*
 * Visszavonás és újra: állapotok verme.
 *
 * Az állapot megváltoztathatatlan (a minta sima JSON-objektum, a szerkesztő
 * műveletei újat adnak), ezért elég a korábbi állapotokat eltenni. Az új
 * változás törli az újra-vermet, mint minden szerkesztőben.
 */

export interface History<T> {
  readonly past: readonly T[];
  readonly present: T;
  readonly future: readonly T[];
}

/** Ennyi lépés vonható vissza; a legrégebbi kiesik. */
export const HISTORY_LIMIT = 200;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/** Új állapot. Ha azonos a mostanival, nem lesz belőle lépés. */
export function record<T>(history: History<T>, next: T): History<T> {
  if (Object.is(next, history.present)) return history;
  const past = [...history.past, history.present];
  return { past: past.slice(Math.max(0, past.length - HISTORY_LIMIT)), present: next, future: [] };
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past[history.past.length - 1];
  if (previous === undefined) return history;
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}

export function redo<T>(history: History<T>): History<T> {
  const [next, ...future] = history.future;
  if (next === undefined) return history;
  return { past: [...history.past, history.present], present: next, future };
}

export const canUndo = (history: History<unknown>): boolean => history.past.length > 0;
export const canRedo = (history: History<unknown>): boolean => history.future.length > 0;
