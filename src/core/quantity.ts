// Every operation here assumes a non-negative quantity.
// KB: core-support §1
import type { Sourced, ValueSource } from './types.ts';

export type Range = readonly [min: number, max: number];

export interface Quantity extends Sourced<number> {
  // `null` marks an exact value; an estimate always has a range.
  readonly range: Range | null;
}

const RELIABILITY: Readonly<Record<ValueSource, number>> = { measured: 2, label: 1, estimated: 0 };

// An empty list is `measured`: there is nothing to weaken it.
export function weakestSource(sources: readonly ValueSource[]): ValueSource {
  let weakest: ValueSource = 'measured';
  for (const source of sources) if (RELIABILITY[source] < RELIABILITY[weakest]) weakest = source;
  return weakest;
}

export function measured(value: number): Quantity {
  return { value, source: 'measured', range: null };
}

export function fromLabel(value: number): Quantity {
  return { value, source: 'label', range: null };
}

export function estimate(value: number, range: Range): Quantity {
  if (!(range[0] <= value && value <= range[1])) {
    throw new RangeError(`A becslés (${value}) a tartományán kívül esik: ${range[0]}–${range[1]}.`);
  }
  return { value, source: 'estimated', range };
}

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

// The factor must be non-negative, or the bounds swap.
export function scale(quantity: Quantity, factor: number): Quantity {
  const [min, max] = bounds(quantity);
  return combine(quantity.value * factor, [min * factor, max * factor], [quantity]);
}

export function inverse(numerator: number, quantity: Quantity): Quantity {
  const [min, max] = bounds(quantity);
  return combine(numerator / quantity.value, [numerator / max, numerator / min], [quantity]);
}

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

export function maximum(quantities: readonly Quantity[]): Quantity {
  if (quantities.length === 0) return sum([]);
  const value = Math.max(...quantities.map((quantity) => quantity.value));
  const min = Math.max(...quantities.map((quantity) => bounds(quantity)[0]));
  const max = Math.max(...quantities.map((quantity) => bounds(quantity)[1]));
  return combine(value, [min, max], quantities);
}

export function roundCount(quantity: Quantity): Quantity {
  const [min, max] = bounds(quantity);
  return combine(Math.round(quantity.value), [Math.round(min), Math.round(max)], [quantity]);
}
