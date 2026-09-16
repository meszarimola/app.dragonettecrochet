/*
 * A magból jövő üzenetek mondattá alakítása (PQW-904).
 *
 * A mag kódot és adatot ad (`CoreText`, src/core/messages.ts); a mondat itt, a
 * felület nyelvén készül. Területenként egy szótárfájl áll a szomszédban, és
 * mindegyik a saját kódunióját tölti ki: ha a magban új kód születik, a szótár
 * fordítási hibát ad, amíg nincs meg mindkét nyelven.
 *
 * A névelő, a ragozás és a sor/kör szava is ide tartozik: a magban csak
 * rétegszám és `shape` van. A magyar nyelvtani segédeket ezért a felület
 * hívja (`hungarian.ts`), nem a mag.
 *
 * DOM nélküli, ezért a Node is futtatja.
 */

import type { CoreData, CoreText, CoreValue } from '../../../core/messages.ts';
import type { Dictionary } from '../../i18n.ts';

/** Egy kód szövege: fix mondat, vagy az adatból összerakott mondat. */
export type CoreEntry = string | ((data: CoreData) => string);

/** Egy terület szótára: minden kódhoz tartozik szöveg, mindkét nyelven. */
export type CoreDictionary<Code extends string> = Dictionary<Readonly<Record<Code, CoreEntry>>>;

/** A mondat a mostani nyelven; ismeretlen kódnál maga a kód, hogy ne dőljön el a felület. */
export function renderCoreText<Code extends string>(
  dictionary: Readonly<Record<Code, CoreEntry>>,
  message: CoreText<Code>,
): string {
  const entry = dictionary[message.code];
  if (entry === undefined) return message.code;
  return typeof entry === 'string' ? entry : entry(message.data ?? {});
}

/* ---- Olvasók: az adat mezői típushelyesen, kész alapértelmezéssel ---- */

export function num(data: CoreData, key: string, fallback = 0): number {
  const value: CoreValue | undefined = data[key];
  return typeof value === 'number' ? value : fallback;
}

export function str(data: CoreData, key: string, fallback = ''): string {
  const value: CoreValue | undefined = data[key];
  return typeof value === 'string' ? value : fallback;
}

export function bool(data: CoreData, key: string): boolean {
  return data[key] === true;
}

export function list(data: CoreData, key: string): readonly (string | number)[] {
  const value: CoreValue | undefined = data[key];
  return Array.isArray(value) ? (value as readonly (string | number)[]) : [];
}

/** Sorban vagy körben készült-e: a mag `shape` mezője dönti el, a szó a szótáré. */
export function isRound(data: CoreData, key = 'shape'): boolean {
  return str(data, key) === 'round';
}
