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

/**
 * Cómo se escribe un calibre: la parte entera y su fracción, aparte, porque la
 * columna las pinta de distinto tamaño.
 */
export type CribaCalibreLabel = {
  whole: string;
  frac: string;
  /** Las dos juntas, para leerlo y para el lector de pantalla. */
  label: string;
};

/**
 * Los tres calibres grandes, en el orden en que se agregan.
 *
 * Catálogo fijo y finito: no se eligen, se destapan de uno en uno, así que el
 * botón puede decir cuál viene y la numeración no depende de nadie.
 */
export const CRIBA_EXTRA_CALIBRES: CribaCalibreLabel[] = [
  { whole: "1", frac: "1/8", label: "1 1/8" },
  { whole: "1", frac: "1/4", label: "1 1/4" },
  { whole: "1", frac: "1/2", label: "1 1/2" },
];

/**
 * La etiqueta del calibre que ocupa esa posición.
 *
 * **Los nueve de siempre son dieciseisavos** —8/16 a 16/16— y por eso la
 * columna enseña el denominador: sin él, saltar de «16» a «1 1/8» parece cambiar
 * de sistema de medida, cuando es la misma escala pasando de la unidad.
 */
export function cribaCalibreLabel(index: number): CribaCalibreLabel {
  const fijo = CRIBA_CALIBRES[index];
  if (fijo !== undefined) {
    return { whole: String(fijo), frac: "/16", label: `${fijo}/16` };
  }

  return (
    CRIBA_EXTRA_CALIBRES[index - CRIBA_CALIBRES.length] ?? {
      whole: String(index + 1),
      frac: "",
      label: String(index + 1),
    }
  );
}

/** Cuántos renglones puede llegar a tener la tabla. */
export const CRIBA_MAX_CALIBRES =
  CRIBA_CALIBRES.length + CRIBA_EXTRA_CALIBRES.length;

/**
 * **Agregar no pide que el anterior esté completo**, al revés que Brix y
 * Rendimiento: aquí los nueve renglones nacen vacíos y dejar huecos es normal,
 * así que exigirlo solo en los extra sería una regla que no se parece a nada de
 * lo que hay encima.
 */
export function canAddCribaCalibre(calibres: CribaCalibre[]): boolean {
  return calibres.length < CRIBA_MAX_CALIBRES;
}

/** Solo se descarta el último, y nunca uno de los nueve fijos: la tabla no
 *  puede quedar con huecos en medio. */
export function canRemoveCribaCalibre(calibres: CribaCalibre[]): boolean {
  return calibres.length > CRIBA_CALIBRES.length;
}

/** Suficiente para "2500.5"; lo que pase de ahí es un error de tecleo. */
const MAX_INPUT_LENGTH = 7;

/**
 * El tope que fijó el negocio para un solo calibre, en gramos: 4 kg.
 *
 * **Es error, no aviso.** Antes avisaba en ámbar a partir de 1 kg —un número que
 * nadie había confirmado—; ahora el límite es suyo y pasarlo impide dar la
 * evaluación por terminada.
 */
export const CRIBA_MAX_CALIBRE_WEIGHT = 4_000;

/**
 * Lo que puede pesar una baya, en gramos. Fuera de ahí el promedio no puede ser
 * cierto: es error, y casi siempre un punto decimal de más o de menos.
 */
export const CRIBA_AVERAGE_RANGE = { min: 0.5, max: 30 } as const;

/**
 * Los dos pesos de muestra del negocio, en gramos: 1.5 kg en plantación
 * experimental y 2.5 kg en semiexperimental. La nota del pie de la sección los
 * explica, y la suma de los nueve calibres tiene que dar uno de los dos.
 */
export const CRIBA_SAMPLE_WEIGHTS: readonly number[] = [1_500, 2_500];

/**
 * Lo que se admite de diferencia al comparar la suma con uno de esos pesos.
 *
 * No es holgura de báscula, es aritmética: sumar nueve decimales en coma
 * flotante da 1500.0000000000002 con muchísima frecuencia —probado sobre
 * 200 000 repartos al azar, el 44 % no daba 1500 exacto—, así que una igualdad
 * estricta avisaría en capturas perfectamente correctas.
 */
const SAMPLE_TOLERANCE = 0.05;

const matchesSampleWeight = (weight: number): boolean =>
  CRIBA_SAMPLE_WEIGHTS.some(
    (target) => Math.abs(weight - target) < SAMPLE_TOLERANCE,
  );

const largestSampleWeight = Math.max(...CRIBA_SAMPLE_WEIGHTS);

export type CribaCalibreSummary = {
  /** El calibre al que corresponde la fila, del 8 al 16. */
  label: CribaCalibreLabel;
  /** Uno de los tres grandes que se agregan a mano: cuenta para la muestra,
   *  pero no para el avance. */
  isExtra: boolean;
  /** Peso de todo lo que cayó en ese calibre; `null` si no se ha capturado. */
  total: number | null;
  average: number | null;
  /** 0 g: el calibre se pesó y no tenía fruta, así que no hay promedio. */
  noFruit: boolean;
  complete: boolean;
  /** Imposible: el promedio por baya fuera de `CRIBA_AVERAGE_RANGE`. */
  averageOutOfRange: boolean;
  /** Imposible: una baya no puede pesar más que todo su calibre. */
  overTotal: boolean;
  /** Se pasa de `CRIBA_MAX_CALIBRE_WEIGHT`: no cabría en la muestra. */
  totalOutOfRange: boolean;
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
  /** La suma no es ninguno de los `CRIBA_SAMPLE_WEIGHTS`. */
  sampleOutOfRange: boolean;
  /** Cuántos de los **nueve fijos** están completos. Los extra no entran: son
   *  trabajo de más, no un hueco. */
  completeCount: number;
  /** Cuántos calibres grandes se han agregado, de `CRIBA_EXTRA_CALIBRES`. */
  extrasCount: number;
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
 * - **Los pesos que no cuadran solo avisan.** Un calibre de un kilo, o una
 *   muestra que no pesa ni 1.5 ni 2.5 kg, no caben en lo que la nota describe,
 *   pero la captura vale igual: quien decide si se puede guardar es el esquema,
 *   y ninguno de los dos entra en él.
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
  // Sobre los renglones que haya y no sobre el catálogo fijo: a los nueve se
  // les pueden agregar hasta tres calibres grandes.
  const values = calibres.map((calibre) => ({
    total: parseDecimalText(calibre?.total ?? ""),
    average: parseDecimalText(calibre?.average ?? ""),
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
      label: cribaCalibreLabel(index),
      isExtra: index >= CRIBA_CALIBRES.length,
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
      totalOutOfRange:
        index !== typingIndex &&
        total !== null &&
        total > CRIBA_MAX_CALIBRE_WEIGHT,
      // Un calibre pesado en 0 g no tiene bayas que pesar, así que su promedio
      // vacío no entra: lo que falta no es lo que no puede ser.
      averageOutOfRange:
        index !== typingIndex &&
        average !== null &&
        (average < CRIBA_AVERAGE_RANGE.min ||
          average > CRIBA_AVERAGE_RANGE.max),
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
    // Dos cautelas para no regañar a media captura, porque la suma crece
    // mientras se llenan los calibres y casi nunca vale ninguno de los dos
    // pesos por el camino:
    //
    // - Solo se juzga cuando ya no puede arreglarse sola: o la suma se pasó del
    //   mayor de los dos, o están los nueve calibres pesados y ya no va a
    //   crecer más.
    // - Callado mientras se teclea **cualquier** calibre, y no solo el que suma
    //   de más: el peso a medio escribir ya va dentro de la suma, así que
    //   camino de "250" el "2500" intermedio dispararía el aviso.
    sampleOutOfRange:
      typingIndex === null &&
      sampleWeight !== null &&
      !matchesSampleWeight(sampleWeight) &&
      (sampleWeight > largestSampleWeight + SAMPLE_TOLERANCE ||
        values.every(({ total }) => total !== null)),
    // **Los extra no mueven el denominador**: la muestra sigue siendo de nueve
    // calibres y agregar uno no puede hacer que el avance retroceda, que es lo
    // único que una barra no puede hacer.
    completeCount: summaries.filter(
      (calibre) => !calibre.isExtra && calibre.complete,
    ).length,
    extrasCount: Math.max(0, summaries.length - CRIBA_CALIBRES.length),
  };
}

/** Las cinco reglas que marcan algo; ninguna bloquea el guardado. */
export type CribaWarning =
  | "totalOutOfRange"
  | "averageOutOfRange"
  | "sampleOutOfRange"
  | "overTotal"
  | "belowPrevious";

/**
 * Cuáles son datos imposibles y no algo fuera de lo habitual.
 *
 * Tres de las cinco: una baya no pesa más que todo lo que cayó en su calibre, un
 * calibre no pasa de 4 kg y una baya no pesa menos de 0.5 g ni más de 30 g. Se
 * pintan en rojo e impiden dar la evaluación por terminada —ver
 * `evaluation-errors.ts`—.
 *
 * Las otras dos siguen siendo avisos ámbar y la captura vale igual, porque no
 * dependen de un número que el negocio haya fijado: el peso de muestra que no
 * cuadra y el promedio que rompe la progresión de calibres.
 */
export function isCribaError(warning: CribaWarning): boolean {
  return (
    warning === "overTotal" ||
    warning === "totalOutOfRange" ||
    warning === "averageOutOfRange"
  );
}

/**
 * El aviso que toca enseñar, uno solo y por este orden.
 *
 * De uno en uno y no los cuatro juntos porque se arrastran: un calibre con un
 * kilo de más desbarata también la suma de la muestra, así que enseñar las dos
 * cosas es contar dos veces el mismo error. Arreglado el primero, aparece el
 * siguiente si sigue ahí.
 *
 * Primero el error, que es lo único imposible. Después las magnitudes de la
 * columna de pesos totales —el calibre desmedido y la muestra que no cuadra—, y
 * al final la progresión de los promedios.
 */
export function firstCribaWarning(summary: CribaSummary): CribaWarning | null {
  if (summary.calibres.some((calibre) => calibre.overTotal)) return "overTotal";
  if (summary.calibres.some((calibre) => calibre.totalOutOfRange)) {
    return "totalOutOfRange";
  }
  if (summary.calibres.some((calibre) => calibre.averageOutOfRange)) {
    return "averageOutOfRange";
  }
  if (summary.sampleOutOfRange) return "sampleOutOfRange";
  if (summary.calibres.some((calibre) => calibre.belowPrevious)) {
    return "belowPrevious";
  }

  return null;
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

/**
 * Lo que la cabecera dice de los calibres: cuántos de los nueve van, y aparte
 * cuántos extra se han agregado.
 *
 * Aparte y no sumados **porque los extra no mueven el denominador**: contarlos
 * dentro haría que agregar uno bajara el avance, que es lo único que una barra
 * no puede hacer. Vacío mientras no haya nada que contar: con la sección recién
 * abierta no hay noticia que dar.
 */
export function cribaCalibresLabel(summary: CribaSummary): string {
  const partes: string[] = [];

  if (summary.completeCount > 0) {
    partes.push(
      `${summary.completeCount} de ${CRIBA_CALIBRES.length} calibres`,
    );
  }
  if (summary.extrasCount > 0) {
    partes.push(
      summary.extrasCount === 1
        ? "1 calibre extra"
        : `${summary.extrasCount} calibres extra`,
    );
  }

  return partes.join(" · ");
}
