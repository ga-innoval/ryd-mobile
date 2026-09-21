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
  /** Una marca por lectura, para señalar su campo. */
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

/**
 * Deja solo lo que puede formar una lectura: dígitos y un separador decimal.
 *
 * La coma se convierte en punto porque según el teclado sale una u otra, y así
 * lo guardado siempre se puede leer como número.
 */
export function sanitizeBrixInput(text: string): string {
  const [integer, ...decimals] = text
    .replace(/,/g, ".")
    .replace(/[^0-9.]/g, "")
    .split(".");
  const joined =
    decimals.length > 0 ? `${integer}.${decimals.join("")}` : integer;

  return joined.slice(0, MAX_INPUT_LENGTH);
}

/** `null` si está vacía o aún no es un número ("." a medio escribir). */
export function parseBrixReading(text: string): number | null {
  if (text.trim() === "") return null;

  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

export function isBrixOutOfRange(value: number): boolean {
  return value < BRIX_EXPECTED_RANGE.min || value > BRIX_EXPECTED_RANGE.max;
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
 */
export function summarizeBrixCorte(readings: string[]): BrixCorteSummary {
  const values = Array.from({ length: BRIX_READINGS_PER_CORTE }, (_, index) =>
    parseBrixReading(readings[index] ?? ""),
  );
  const outOfRange = values.map(
    (value) => value !== null && isBrixOutOfRange(value),
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
 * Solo se agrega un corte cuando el último ya tiene alguna lectura, para que no
 * se acumulen cortes vacíos.
 */
export function canAddBrixCorte(cortes: BrixCorte[]): boolean {
  const last = cortes[cortes.length - 1];

  return (
    last !== undefined &&
    last.readings.some((reading) => parseBrixReading(reading) !== null)
  );
}

/**
 * Solo se descarta el último, para que la numeración siga siendo consecutiva,
 * y nunca el único: siempre queda un corte donde capturar.
 */
export function canRemoveBrixCorte(cortes: BrixCorte[]): boolean {
  return cortes.length > 1;
}

export function removeLastBrixCorte(cortes: BrixCorte[]): BrixCorte[] {
  return canRemoveBrixCorte(cortes) ? cortes.slice(0, -1) : cortes;
}

/** Cambia una lectura sin tocar las demás ni el array recibido. */
export function setBrixReading(
  cortes: BrixCorte[],
  corteIndex: number,
  readingIndex: number,
  text: string,
): BrixCorte[] {
  return cortes.map((corte, index) =>
    index === corteIndex
      ? {
          readings: corte.readings.map((reading, i) =>
            i === readingIndex ? text : reading,
          ),
        }
      : corte,
  );
}

/**
 * Solo para mostrar. Dos decimales fijos, y no "hasta dos", para que los
 * resultados queden alineados en sus columnas.
 *
 * No basta con `toFixed(2)`: redondea el número binario, no el decimal. 59.725
 * se guarda como 59.72499… y saldría "59.72", distinto de la cuenta a mano o de
 * Excel. Pasarlo a centésimas y limpiar ese ruido antes de redondear da 59.73.
 */
export function formatBrix(value: number | null): string {
  if (value === null) return "—";

  const hundredths = Math.round(Number((value * 100).toFixed(6)));
  return (hundredths / 100).toFixed(2);
}
