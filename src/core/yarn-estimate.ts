// Any consistent set of units works; the metric names are only the default case.
// KB: 02 §6.5, core-support §2
import type { Quantity } from './quantity.ts';
import { bounds, estimate, fromLabel, measured, multiply, scale } from './quantity.ts';

// As printed on the label: one ball's length and weight.
export interface YarnLabel {
  readonly lengthM: number;
  readonly massG: number;
}

// KB: 02 §6.5
export const DEFAULT_BUFFER = estimate(0.1, [0.1, 0.15]);

export interface YarnEstimate {
  readonly massG: Quantity;
  readonly lengthM: Quantity;
  readonly lengthWithBufferM: Quantity;
  readonly balls: Quantity;
}

export function massPerArea(massG: number, areaCm2: number): number {
  return massG / areaCm2;
}

// The epsilon keeps floating-point error from buying a spare ball.
export function ballsNeeded(lengthM: number, ballLengthM: number): number {
  return Math.ceil(lengthM / ballLengthM - 1e-9);
}

function asQuantity(value: Quantity | number): Quantity {
  return typeof value === 'number' ? measured(value) : value;
}

// A plain number argument is taken as an exact, measured value.
export function yarnFromMassPerArea(
  massPerAreaGPerCm2: Quantity | number,
  projectAreaCm2: Quantity | number,
  label: YarnLabel,
  buffer: Quantity = DEFAULT_BUFFER,
): YarnEstimate {
  const massG = multiply(asQuantity(massPerAreaGPerCm2), asQuantity(projectAreaCm2));
  const lengthM = multiply(massG, fromLabel(label.lengthM / label.massG));
  const [bufferMin, bufferMax] = bounds(buffer);
  const factor: Quantity = { value: 1 + buffer.value, source: buffer.source, range: buffer.range && [1 + bufferMin, 1 + bufferMax] };
  const lengthWithBufferM = multiply(lengthM, factor);
  const perBall = scale(lengthWithBufferM, 1 / label.lengthM);
  const [ballsMin, ballsMax] = bounds(perBall);
  return {
    massG,
    lengthM,
    lengthWithBufferM,
    balls: {
      value: ballsNeeded(lengthWithBufferM.value, label.lengthM),
      source: perBall.source,
      range: perBall.range && [ballsNeeded(ballsMin, 1), ballsNeeded(ballsMax, 1)],
    },
  };
}

// KB: 02 §6.5
export function yarnFromSwatch(
  swatch: { readonly massG: number; readonly areaCm2: number },
  projectAreaCm2: Quantity | number,
  label: YarnLabel,
  buffer: Quantity = DEFAULT_BUFFER,
): YarnEstimate {
  return yarnFromMassPerArea(massPerArea(swatch.massG, swatch.areaCm2), projectAreaCm2, label, buffer);
}
