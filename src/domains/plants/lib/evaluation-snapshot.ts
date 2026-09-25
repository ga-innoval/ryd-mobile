import {
  EVALUATION_SECTION_IDS,
  type EvaluationFormValues,
  type EvaluationSectionId,
} from "./evaluation-schema";

/** Lo que hay guardado de cada sección, en texto, para poder compararlo. */
export type EvaluationSnapshot = Record<EvaluationSectionId, string>;

/**
 * Como `JSON.stringify`, pero con las claves en orden y sin las que valen
 * `undefined`.
 *
 * Las dos cosas son necesarias para comparar: react-hook-form reconstruye
 * objetos por su cuenta —un `reset`, un `useFieldArray`— y el orden de las
 * claves puede cambiar sin que cambie ni un dato; y una opción deseleccionada
 * deja su clave puesta en `undefined`, que es lo mismo que no tenerla. Sin esto,
 * un reordenamiento contaría como cambio y volvería a guardar una sección ya
 * sincronizada, devolviéndola a la cola del push sin motivo.
 */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1));

    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }

  // `JSON.stringify(undefined)` no devuelve texto, y aquí eso es un hueco.
  return JSON.stringify(value) ?? "null";
}

/** La foto de una evaluación entera, sección por sección. */
export function snapshotEvaluation(
  values: EvaluationFormValues,
): EvaluationSnapshot {
  return Object.fromEntries(
    EVALUATION_SECTION_IDS.map((seccion) => [
      seccion,
      stableStringify(values[seccion]),
    ]),
  ) as EvaluationSnapshot;
}

/**
 * Qué secciones han cambiado desde la última vez que se guardaron.
 *
 * Es lo que evita escribir las seis en cada tecla: solo viaja a SQLite la que
 * el evaluador está tocando, y las demás conservan su `syncStatus` y su
 * `syncedAt`.
 */
export function changedSecciones(
  values: EvaluationFormValues,
  snapshot: EvaluationSnapshot,
): EvaluationSectionId[] {
  return EVALUATION_SECTION_IDS.filter(
    (seccion) => stableStringify(values[seccion]) !== snapshot[seccion],
  );
}

/** La foto de después de guardar: solo cambian las secciones que se escribieron. */
export function mergeSnapshot(
  snapshot: EvaluationSnapshot,
  values: EvaluationFormValues,
  secciones: EvaluationSectionId[],
): EvaluationSnapshot {
  const written = Object.fromEntries(
    secciones.map((seccion) => [seccion, stableStringify(values[seccion])]),
  );

  return { ...snapshot, ...written };
}
