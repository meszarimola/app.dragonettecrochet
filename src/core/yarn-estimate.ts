/*
 * Fonalbecslés a próbadarab tömegéből (PQW-859).
 *
 * A lemért próbadarab az egyetlen megbízható adat arról, mennyi fonal jut egy
 * területre; a közzétett arányok háromszorosan is eltérnek (02 §6.2, §6.5).
 * Menet: g/cm² × a darab területe → g; × a címke m/g aránya → m; + tartalék;
 * gombolyagszám felfelé kerekítve (02 §6.5, §8 `yarnFromSwatch`).
 *
 * A számolás mértékegységtől független, csak következetes legyen: a metrikus
 * alapeset cm², g és m, de hüvelyk² és yard is működik.
 */

import type { Quantity } from './quantity.ts';
import { bounds, estimate, fromLabel, measured, multiply, scale } from './quantity.ts';

export interface YarnLabel {
  /** Egy gombolyag hossza, m. */
  readonly lengthM: number;
  /** Egy gombolyag tömege, g. */
  readonly massG: number;
}

/** Tartalék a gauge-eltérésre, a próbadarabra és a hibákra: 10–15 % (02 §6.5). */
export const DEFAULT_BUFFER = estimate(0.1, [0.1, 0.15]);

export interface YarnEstimate {
  /** A darab tömege tartalék nélkül, g. */
  readonly massG: Quantity;
  /** A fonal hossza tartalék nélkül, m. */
  readonly lengthM: Quantity;
  /** A fonal hossza tartalékkal, m. */
  readonly lengthWithBufferM: Quantity;
  /** Gombolyag, felfelé kerekítve. */
  readonly balls: Quantity;
}

/** g/cm² a próbadarab tömegéből és területéből. */
export function massPerArea(massG: number, areaCm2: number): number {
  return massG / areaCm2;
}

/** Egész gombolyag; a lebegőpontos hiba ne adjon egy fölösleges gombolyagot. */
export function ballsNeeded(lengthM: number, ballLengthM: number): number {
  return Math.ceil(lengthM / ballLengthM - 1e-9);
}

function asQuantity(value: Quantity | number): Quantity {
  return typeof value === 'number' ? measured(value) : value;
}

/**
 * Fonal a területre jutó tömegből. A szám bemenet pontos érték (a mért
 * próbadarab vagy a megadott méret); a becsült terület tartománya
 * továbbvivődik.
 */
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

/** Fonal a lemért próbadarabból (02 §6.5). */
export function yarnFromSwatch(
  swatch: { readonly massG: number; readonly areaCm2: number },
  projectAreaCm2: Quantity | number,
  label: YarnLabel,
  buffer: Quantity = DEFAULT_BUFFER,
): YarnEstimate {
  return yarnFromMassPerArea(massPerArea(swatch.massG, swatch.areaCm2), projectAreaCm2, label, buffer);
}
