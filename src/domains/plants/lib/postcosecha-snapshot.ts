import {
  changedSections,
  mergeSections,
  snapshotSections,
  type SectionSnapshot,
} from "./section-snapshot";
import {
  POSTCOSECHA_SECTION_IDS,
  type PostcosechaFormValues,
  type PostcosechaSectionId,
} from "./postcosecha-schema";

/**
 * La comparación de la encuesta de post-cosecha, atada a sus dos secciones.
 *
 * Hermana de `evaluation-snapshot.ts` y con la misma forma: la mecánica vive en
 * `section-snapshot.ts` y aquí solo se le pone la lista y el tipo. El
 * `PostcosechaSectionId` de las firmas es lo que impide colar una sección de
 * tratamiento — las dos encuestas tienen una sección llamada `comentarios` y sin
 * el tipo nadie avisaría.
 */

/** Lo que hay guardado de cada sección, en texto, para poder compararlo. */
export type PostcosechaSnapshot = SectionSnapshot<PostcosechaSectionId>;

/** La foto de una evaluación entera, sección por sección. */
export function snapshotPostcosecha(
  values: PostcosechaFormValues,
): PostcosechaSnapshot {
  return snapshotSections(POSTCOSECHA_SECTION_IDS, values);
}

/**
 * Qué secciones han cambiado desde la última vez que se guardaron.
 *
 * Es lo que evita escribir las dos en cada tecla, y también lo que hace que
 * abrir una evaluación y salir sin tocar nada **no** escriba ninguna fila: los
 * defaults comparados contra los defaults no dan cambio.
 */
export function changedSeccionesPostcosecha(
  values: PostcosechaFormValues,
  snapshot: PostcosechaSnapshot,
): PostcosechaSectionId[] {
  return changedSections(POSTCOSECHA_SECTION_IDS, values, snapshot);
}

/** La foto de después de guardar: solo cambian las secciones que se escribieron. */
export function mergePostcosechaSnapshot(
  snapshot: PostcosechaSnapshot,
  values: PostcosechaFormValues,
  secciones: PostcosechaSectionId[],
): PostcosechaSnapshot {
  return mergeSections(snapshot, values, secciones);
}
