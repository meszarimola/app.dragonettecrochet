/*
 * Fizikai mennyiség eredettel és tartománnyal (PQW-859).
 *
 * Minden méret jelöli, honnan jön: mért, címkéről vett vagy becsült
 * (`ValueSource`, README §2 „Calibration”). A becslés mindig tartománnyal
 * jár, mert egyetlen szám hamis pontosságot mutatna (02 §8, megvalósítási
 * megjegyzések; README §6).
 *
 * A műveletek nemnegatív mennyiségekre szólnak, így a tartomány határai a
 * határok szorzatából, illetve hányadosából jönnek. Az eredmény eredete a
 * leggyengébb bemenetéé: amiben becslés van, az becslés.
 */

import type { Sourced, ValueSource } from './types.ts';

export type Range = readonly [min: number, max: number];

export interface Quantity extends Sourced<number> {
  /** A valószínű tartomány. Becslésnél mindig van; mért és címkéről vett értéknél `null`. */
  readonly range: Range | null;
}

const RELIABILITY: Readonly<Record<ValueSource, number>> = { measured: 2, label: 1, estimated: 0 };

/** A leggyengébb eredet. Üres listára `measured`: nincs, ami gyengítené. */
export function weakestSource(sources: readonly ValueSource[]): ValueSource {
  let weakest: ValueSource = 'measured';
  for (const source of sources) if (RELIABILITY[source] < RELIABILITY[weakest]) weakest = source;
  return weakest;
}

/** Mért vagy pontosan megadott érték. */
export function measured(value: number): Quantity {
  return { value, source: 'measured', range: null };
}

export function fromLabel(value: number): Quantity {
  return { value, source: 'label', range: null };
}

/** Becsült érték; a tartománynak tartalmaznia kell az értéket. */
export function estimate(value: number, range: Range): Quantity {
  if (!(range[0] <= value && value <= range[1])) {
    throw new RangeError(`A becslés (${value}) a tartományán kívül esik: ${range[0]}–${range[1]}.`);
  }
  return { value, source: 'estimated', range };
}

/** A tartomány, pontos értéknél az érték maga mindkét határként. */
export function bounds(quantity: Quantity): Range {
  return quantity.range ?? [quantity.value, quantity.value];
}

function combine(value: number, range: Range, parts: readonly Quantity[]): Quantity {
  const exact = parts.every((part) => part.range === null);
  return { value, source: weakestSource(parts.map((part) => part.source)), range: exact ? null : range };
}

export function multiply(a: Quantity, b: Quantity): Quantity {
  const [aMin, aMax] = bounds(a);
  const [bMin, bMax] = bounds(b);
  return combine(a.value * b.value, [aMin * bMin, aMax * bMax], [a, b]);
}

export function divide(a: Quantity, b: Quantity): Quantity {
  const [aMin, aMax] = bounds(a);
  const [bMin, bMax] = bounds(b);
  return combine(a.value / b.value, [aMin / bMax, aMax / bMin], [a, b]);
}

/** Pontos, nemnegatív szorzóval, pl. mm → cm. Az eredet nem változik. */
export function scale(quantity: Quantity, factor: number): Quantity {
  const [min, max] = bounds(quantity);
  return combine(quantity.value * factor, [min * factor, max * factor], [quantity]);
}

/** `numerator / quantity`, pl. öltésszélességből öltés/10 cm. */
export function inverse(numerator: number, quantity: Quantity): Quantity {
  const [min, max] = bounds(quantity);
  return combine(numerator / quantity.value, [numerator / max, numerator / min], [quantity]);
}

/** Összeg; üres listára pontos nulla. */
export function sum(quantities: readonly Quantity[]): Quantity {
  let value = 0;
  let min = 0;
  let max = 0;
  for (const quantity of quantities) {
    const [low, high] = bounds(quantity);
    value += quantity.value;
    min += low;
    max += high;
  }
  return combine(value, [min, max], quantities);
}

/** A legnagyobb, pl. a sor magassága a legmagasabb öltéséé; üres listára pontos nulla. */
export function maximum(quantities: readonly Quantity[]): Quantity {
  if (quantities.length === 0) return sum([]);
  const value = Math.max(...quantities.map((quantity) => quantity.value));
  const min = Math.max(...quantities.map((quantity) => bounds(quantity)[0]));
  const max = Math.max(...quantities.map((quantity) => bounds(quantity)[1]));
  return combine(value, [min, max], quantities);
}

/** Darabszámra kerekítve, a határokkal együtt. */
export function roundCount(quantity: Quantity): Quantity {
  const [min, max] = bounds(quantity);
  return combine(Math.round(quantity.value), [Math.round(min), Math.round(max)], [quantity]);
}
