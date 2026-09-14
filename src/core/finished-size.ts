/*
 * Kész méret sorokból és körökből (PQW-859).
 *
 * Soronként a szélesség az öltések szélességének összege, a magasság a
 * legmagasabb öltésé (02 §8, megvalósítási megjegyzések). Körben a
 * „szélesség” a kör kerülete, a magasság a sugár növekedése: minden kör
 * nagyjából egy körmagasságnyit ad a sugárhoz (02 §4.3).
 *
 * Minden érték eredetet és becslésnél tartományt kap. A darab eredete a
 * leggyengébb értékéé, így profil nélkül a méret egyértelműen becslés.
 */

import type { DimensionBasis, GaugeContext, LayerShape, StitchDimensions } from './gauge.ts';
import { DIMENSION_BASES, GAUGE_TOLERANCE, stitchDimensions } from './gauge.ts';
import type { Quantity } from './quantity.ts';
import { maximum, multiply, scale, sum, weakestSource } from './quantity.ts';
import type { StitchDefId, ValueSource } from './types.ts';

export interface LayerInput {
  readonly shape: LayerShape;
  /** A sor vagy kör pozícióinak öltése sorrendben, láncszemmel együtt. */
  readonly stitches: readonly StitchDefId[];
}

export interface LayerSize {
  readonly shape: LayerShape;
  /** Sorban a sor szélessége, körben a kör kerülete, cm. */
  readonly widthCm: Quantity;
  /** Sorban a sor magassága, körben a sugár növekedése, cm. */
  readonly heightCm: Quantity;
  /** Sorban a darab magassága eddig, körben a sugár eddig, cm. */
  readonly totalHeightCm: Quantity;
  readonly source: ValueSource;
  /** A sor öltéseinek mérete honnan jön, a legmegbízhatóbbtól. */
  readonly basis: readonly DimensionBasis[];
}

export interface PieceTotal {
  /** `rows`: sorokban horgolt darab; `circle`: lapos kör. */
  readonly form: 'rows' | 'circle';
  /** Soroknál a legszélesebb sor, körnél az átmérő, cm. */
  readonly widthCm: Quantity;
  /** Soroknál a sorok magasságának összege, körnél az átmérő, cm. */
  readonly heightCm: Quantity;
  readonly areaCm2: Quantity;
}

export interface PieceSize {
  readonly layers: readonly LayerSize[];
  /** A teljes darab. `null`, ha nincs sor, vagy a darab sorokat és köröket is tartalmaz. */
  readonly total: PieceTotal | null;
  readonly source: ValueSource;
  /** Van-e becsült érték a méretben. Profil nélkül mindig igaz. */
  readonly estimated: boolean;
}

function toCm(quantityMm: Quantity): Quantity {
  return scale(quantityMm, 0.1);
}

export function pieceSize(layers: readonly LayerInput[], context: GaugeContext): PieceSize {
  const sizes: LayerSize[] = [];
  let totalHeightMm = sum([]);

  for (const layer of layers) {
    const dimensions: StitchDimensions[] = [];
    for (const id of layer.stitches) {
      const def = context.library.get(id);
      if (!def) throw new RangeError(`Ismeretlen öltés: ${id}.`);
      const size = stitchDimensions(def, layer.shape, context);
      if (size) dimensions.push(size);
    }
    const widthMm = sum(dimensions.map((size) => size.widthMm));
    const heightMm = maximum(dimensions.map((size) => size.heightMm));
    totalHeightMm = sum([totalHeightMm, heightMm]);
    sizes.push({
      shape: layer.shape,
      widthCm: toCm(widthMm),
      heightCm: toCm(heightMm),
      totalHeightCm: toCm(totalHeightMm),
      source: weakestSource([widthMm.source, heightMm.source]),
      basis: DIMENSION_BASES.filter((basis) => dimensions.some((size) => size.basis === basis)),
    });
  }

  const total = pieceTotal(sizes);
  const source = weakestSource([
    ...sizes.map((size) => size.source),
    ...(total ? [total.widthCm.source, total.heightCm.source, total.areaCm2.source] : []),
  ]);
  return { layers: sizes, total, source, estimated: source === 'estimated' };
}

function pieceTotal(layers: readonly LayerSize[]): PieceTotal | null {
  const last = layers.at(-1);
  if (!last) return null;
  if (layers.every((layer) => layer.shape === 'row')) {
    return {
      form: 'rows',
      widthCm: maximum(layers.map((layer) => layer.widthCm)),
      heightCm: last.totalHeightCm,
      areaCm2: sum(layers.map((layer) => multiply(layer.widthCm, layer.heightCm))),
    };
  }
  if (layers.every((layer) => layer.shape === 'round')) {
    const radius = last.totalHeightCm;
    const diameter = scale(radius, 2);
    return { form: 'circle', widthCm: diameter, heightCm: diameter, areaCm2: scale(multiply(radius, radius), Math.PI) };
  }
  return null;
}

export interface SizeDeviation {
  readonly meanMm: number;
  /** `(átlag − jósolt) / jósolt`. */
  readonly deviation: number;
  readonly withinTolerance: boolean;
}

/**
 * A jósolt méret eltérése a kész darabon mérttől (docs/calibration/README.md,
 * „Worked-example format”). Tűrésen belül, ha legfeljebb 5 % (PQW-859).
 */
export function sizeDeviation(predictedMm: number, readingsMm: readonly number[], tolerance = GAUGE_TOLERANCE): SizeDeviation {
  if (readingsMm.length === 0) throw new RangeError('Legalább egy leolvasást vártunk.');
  const meanMm = readingsMm.reduce((total, value) => total + value, 0) / readingsMm.length;
  const deviation = (meanMm - predictedMm) / predictedMm;
  return { meanMm, deviation, withinTolerance: Math.abs(deviation) <= tolerance };
}
