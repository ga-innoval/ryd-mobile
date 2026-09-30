import {
  changedSections,
  mergeSections,
  snapshotSections,
  type SectionSnapshot,
} from "./section-snapshot";
import {
  EVALUATION_SECTION_IDS,
  type EvaluationFormValues,
  type EvaluationSectionId,
} from "./evaluation-schema";

/**
 * La comparación de la encuesta de tratamiento, atada a sus seis secciones.
 *
 * La mecánica —el orden de las claves, los `undefined` que no cuentan— vive en
 * `section-snapshot.ts`, porque post-cosecha necesita la misma sobre otras
 * secciones. Aquí solo se le pone la lista y el tipo: el `EvaluationSectionId`
 * de las firmas es lo que impide pasarle por error una sección de la otra
 * encuesta.
 */

/** Lo que hay guardado de cada sección, en texto, para poder compararlo. */
export type EvaluationSnapshot = SectionSnapshot<EvaluationSectionId>;

/** La foto de una evaluación entera, sección por sección. */
export function snapshotEvaluation(
  values: EvaluationFormValues,
): EvaluationSnapshot {
  return snapshotSections(EVALUATION_SECTION_IDS, values);
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
  return changedSections(EVALUATION_SECTION_IDS, values, snapshot);
}

/** La foto de después de guardar: solo cambian las secciones que se escribieron. */
export function mergeSnapshot(
  snapshot: EvaluationSnapshot,
  values: EvaluationFormValues,
  secciones: EvaluationSectionId[],
): EvaluationSnapshot {
  return mergeSections(snapshot, values, secciones);
}
