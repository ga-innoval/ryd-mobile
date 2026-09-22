import { z } from "zod";
import {
  decimalTextSchema,
  formatDecimal,
  parseDecimalText,
  sanitizeDecimalText,
} from "./decimal-text";
import type { BrixCorte } from "../types";

/**
 * Catálogo fijo del negocio, "5.3 Brix": por corte se hacen diez lecturas de
 * refractómetro, que se agrupan en cinco pares. Cada par da un resultado, de
 * R1 a R5.
 */
export const BRIX_READINGS_PER_CORTE = 10;
export const BRIX_PAIRS_PER_CORTE = BRIX_READINGS_PER_CORTE / 2;

/**
 * Lecturas que se aceptan sin avisar.
 *
 * **Supuesto de diseño, falta confirmarlo con agronomía.** Lo que de verdad
 * atrapa es el punto decimal olvidado (184 en vez de 18.4). Fuera del rango se
 * avisa, pero la lectura cuenta igual: podría ser real, y descartarla en
 * silencio sería peor que mostrar un promedio raro.
 */
export const BRIX_EXPECTED_RANGE = { min: 5, max: 35 } as const;

/** Suficiente para "18.25"; lo que pase de ahí es un error de tecleo. */
const MAX_INPUT_LENGTH = 6;

export type BrixPairSummary = {
  /** `null` si falta alguna de sus dos lecturas: nunca se toma como cero. */
  value: number | null;
  outOfRange: boolean;
};

export type BrixCorteSummary = {
  pairs: BrixPairSummary[];
  /** Media de los R que existen; `null` si todavía no hay ninguno. */
  average: number | null;
  /** Lecturas capturadas, de 0 a 10. */
  filled: number;
  complete: boolean;
  /** Una marca por lectura, para señalar su campo; nunca la que se teclea. */
  outOfRange: boolean[];
  /** Índice de la primera lectura fuera de rango, para el aviso. */
  firstOutOfRange: number | null;
};

export type BrixSummary = {
  cortes: BrixCorteSummary[];
  /** Media de todos los R capturados, de todos los cortes. */
  average: number | null;
  /** Cortes con al menos una lectura. */
  capturedCount: number;
};

export function createBrixCorte(): BrixCorte {
  return {
    readings: Array.from({ length: BRIX_READINGS_PER_CORTE }, () => ""),
  };
}

/** Deja solo lo que puede formar una lectura: dígitos y un separador decimal. */
export function sanitizeBrixInput(text: string): string {
  return sanitizeDecimalText(text, MAX_INPUT_LENGTH);
}

/**
 * El rango habitual, como esquema para el **aviso**, no para el guardado.
 *
 * Va aparte del esquema del formulario y así debe seguir: una lectura fuera
 * de rango se avisa pero cuenta igual (ver `BRIX_EXPECTED_RANGE`). Metido en el
 * resolver, se convertiría en un error que impediría guardar una lectura que
 * podría ser real.
 */
export const brixReadingRangeSchema = z
  .number()
  .min(BRIX_EXPECTED_RANGE.min)
  .max(BRIX_EXPECTED_RANGE.max);

/** Un corte completo: sus diez lecturas, en orden. */
export const brixCorteSchema = z.object({
  readings: z.array(decimalTextSchema).length(BRIX_READINGS_PER_CORTE),
});

/** `null` si está vacía o aún no es un número ("." a medio escribir). */
export function parseBrixReading(text: string): number | null {
  return parseDecimalText(text);
}

export function isBrixOutOfRange(value: number): boolean {
  return !brixReadingRangeSchema.safeParse(value).success;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function presentValues(pairs: BrixPairSummary[]): number[] {
  return pairs.flatMap((pair) => (pair.value === null ? [] : [pair.value]));
}

/**
 * R1 = (L1 + L2) / 2, …, R5 = (L9 + L10) / 2, y el promedio del corte.
 *
 * Nada se redondea aquí: los dos decimales son cosa de `formatBrix`, al
 * mostrar. Un resultado sin su par completo queda vacío y no entra en el
 * promedio, que se hace solo con los que existen.
 *
 * `typingIndex` es la lectura que se está tecleando: cuenta para los
 * resultados, pero no se marca fuera de rango hasta que se deja de teclear. A
 * medio escribir casi siempre lo está —«1» camino de «14.5»—, y el aviso
 * saldría y se iría a cada tecla.
 */
export function summarizeBrixCorte(
  readings: string[],
  typingIndex: number | null = null,
): BrixCorteSummary {
  const values = Array.from({ length: BRIX_READINGS_PER_CORTE }, (_, index) =>
    parseBrixReading(readings[index] ?? ""),
  );
  const outOfRange = values.map(
    (value, index) =>
      index !== typingIndex && value !== null && isBrixOutOfRange(value),
  );

  const pairs = Array.from({ length: BRIX_PAIRS_PER_CORTE }, (_, index) => {
    const first = values[index * 2];
    const second = values[index * 2 + 1];

    return {
      value: first !== null && second !== null ? (first + second) / 2 : null,
      outOfRange: outOfRange[index * 2] || outOfRange[index * 2 + 1],
    };
  });

  const filled = values.filter((value) => value !== null).length;
  const firstOutOfRange = outOfRange.indexOf(true);

  return {
    pairs,
    average: mean(presentValues(pairs)),
    filled,
    complete: filled === BRIX_READINGS_PER_CORTE,
    outOfRange,
    firstOutOfRange: firstOutOfRange === -1 ? null : firstOutOfRange,
  };
}

/**
 * El Brix promedio es la media de **todos los R** capturados, no la media de
 * los promedios de cada corte. Con cortes completos da lo mismo; con uno a
 * medias, promediar promedios le daría a ese corte el mismo peso que a uno de
 * cinco resultados.
 */
export function summarizeBrix(cortes: BrixCorte[]): BrixSummary {
  const summaries = cortes.map((corte) => summarizeBrixCorte(corte.readings));

  return {
    cortes: summaries,
    average: mean(summaries.flatMap((corte) => presentValues(corte.pairs))),
    capturedCount: summaries.filter((corte) => corte.filled > 0).length,
  };
}

/**
 * Solo se agrega un corte cuando el último ya tiene sus diez lecturas: se
 * termina uno antes de empezar el siguiente.
 *
 * El «completo» es el de `summarizeBrixCorte`, el mismo que marca la cabecera
 * con «10 de 10 lecturas», para que el botón aparezca justo cuando ella lo da
 * por completo. Recorre siempre las diez posiciones: un arreglo más corto no
 * pasa por completo.
 */
export function canAddBrixCorte(cortes: BrixCorte[]): boolean {
  const last = cortes[cortes.length - 1];

  return last !== undefined && summarizeBrixCorte(last.readings).complete;
}

/**
 * Solo se descarta el último, para que la numeración siga siendo consecutiva,
 * y nunca el único: siempre queda un corte donde capturar.
 */
export function canRemoveBrixCorte(cortes: BrixCorte[]): boolean {
  return cortes.length > 1;
}

/** Solo para mostrar: dos decimales fijos, y un guion cuando no hay valor. */
export function formatBrix(value: number | null): string {
  if (value === null) return "—";

  return formatDecimal(value, 2);
}
