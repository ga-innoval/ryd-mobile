import { z } from "zod";
import {
  decimalTextSchema,
  formatDecimal,
  formatGrouped,
  parseDecimalText,
  sanitizeDecimalText,
} from "./decimal-text";
import type { CribaCalibre } from "../types";

/**
 * Catálogo fijo del negocio, "criba": la muestra se pasa por la criba y queda
 * separada en nueve calibres, del 8 al 16. De cada uno se pesa todo lo que
 * cayó y una baya promedio.
 */
export const CRIBA_CALIBRES = [8, 9, 10, 11, 12, 13, 14, 15, 16] as const;

/** Suficiente para "2500.5"; lo que pase de ahí es un error de tecleo. */
const MAX_INPUT_LENGTH = 7;

export type CribaCalibreSummary = {
  /** El calibre al que corresponde la fila, del 8 al 16. */
  calibre: number;
  /** Peso de todo lo que cayó en ese calibre; `null` si no se ha capturado. */
  total: number | null;
  average: number | null;
  /** 0 g: el calibre se pesó y no tenía fruta, así que no hay promedio. */
  noFruit: boolean;
  complete: boolean;
  /** Imposible: una baya no puede pesar más que todo su calibre. */
  overTotal: boolean;
  /**
   * Incoherente: la criba separa por tamaño, así que la baya de un calibre no
   * puede pesar menos que la de uno más pequeño.
   */
  belowPrevious: boolean;
  /** Qué parte de la muestra es este calibre, en %; `null` si no hay peso. */
  share: number | null;
};

export type CribaSummary = {
  calibres: CribaCalibreSummary[];
  /** La suma de los pesos capturados; `null` mientras no haya ninguno. */
  sampleWeight: number | null;
  completeCount: number;
};

/** Los nueve calibres en blanco, en orden. */
export function createCribaCalibres(): CribaCalibre[] {
  return CRIBA_CALIBRES.map(() => ({ total: "", average: "" }));
}

/** Un calibre completo: sus dos pesos, tal como se guardan. */
export const cribaCalibreSchema = z.object({
  total: decimalTextSchema,
  average: decimalTextSchema,
});

/** Deja solo lo que puede formar un peso: dígitos y un separador decimal. */
export function sanitizeCribaInput(text: string): string {
  return sanitizeDecimalText(text, MAX_INPUT_LENGTH);
}

/**
 * El peso de la muestra y lo que aporta cada calibre.
 *
 * Tres cosas que no son obvias:
 *
 * - **Vacío no es cero, pero 0 g sí significa algo.** Un calibre sin capturar
 *   no entra en ninguna cuenta; uno con 0 g se pesó y no tenía fruta, así que
 *   cuenta como completo sin promedio: no hay bayas que pesar.
 * - **El peso de la muestra es la suma de lo capturado**, no un dato aparte, y
 *   la distribución de cada calibre es su parte de esa suma. Mientras no haya
 *   ningún peso, las dos cosas quedan vacías en vez de en cero.
 * - `typingIndex` es el calibre que se está tecleando: no avisa hasta que se
 *   deja de teclear, como las lecturas de Brix. Al corregir un peso total con
 *   el promedio ya escrito, el primer dígito es menor que el promedio y el
 *   aviso saldría para irse a la tecla siguiente. Tampoco entra en la cadena
 *   del promedio creciente: si entrara, teclear un 9 camino de 5.2 haría saltar
 *   el aviso en el calibre siguiente.
 */
export function summarizeCriba(
  calibres: CribaCalibre[],
  typingIndex: number | null = null,
): CribaSummary {
  const values = CRIBA_CALIBRES.map((_, index) => ({
    total: parseDecimalText(calibres[index]?.total ?? ""),
    average: parseDecimalText(calibres[index]?.average ?? ""),
  }));

  const weights = values.flatMap(({ total }) =>
    total === null ? [] : [total],
  );
  const sampleWeight = weights.length
    ? weights.reduce((sum, weight) => sum + weight, 0)
    : null;

  // El promedio por baya sube con el calibre, que es lo que la criba separa. Se
  // compara con el último capturado y no con el de al lado: un calibre sin
  // promedio —sin capturar, o con 0 g— no rompe la cadena ni sirve de
  // referencia.
  let previousAverage: number | null = null;
  const belowPrevious = values.map(({ average }, index) => {
    if (index === typingIndex || average === null) return false;

    const below = previousAverage !== null && average < previousAverage;
    previousAverage = average;

    return below;
  });

  const summaries = values.map(({ total, average }, index) => {
    const noFruit = total === 0;

    return {
      calibre: CRIBA_CALIBRES[index],
      total,
      average,
      noFruit,
      complete: total !== null && (noFruit || average !== null),
      overTotal:
        index !== typingIndex &&
        total !== null &&
        !noFruit &&
        average !== null &&
        average > total,
      belowPrevious: belowPrevious[index],
      share:
        total !== null && sampleWeight !== null && sampleWeight > 0
          ? (total / sampleWeight) * 100
          : null,
    };
  });

  return {
    calibres: summaries,
    sampleWeight,
    completeCount: summaries.filter((calibre) => calibre.complete).length,
  };
}

/** Los gramos como se muestran: un decimal fijo y los miles separados. */
export function formatGrams(value: number | null): string {
  if (value === null) return "—";

  return formatGrouped(value, 1);
}

/** La distribución como se muestra: un decimal fijo y el signo separado. */
export function formatShare(value: number | null): string {
  if (value === null) return "—";

  return `${formatDecimal(value, 1)} %`;
}
