/**
 * Comparar lo que hay en un formulario contra lo último que se escribió, sección
 * por sección.
 *
 * Vive aparte y en genérico porque lo usan dos encuestas con secciones
 * distintas: la de tratamiento (seis) y la de post-cosecha (dos). Lo que
 * comparten no es la lista de secciones sino **cómo se comparan**, que es lo
 * delicado: de dos copias de esta comparación saldrían dos criterios de "esto
 * cambió" y uno de los dos acabaría reescribiendo secciones que nadie tocó.
 *
 * Nadie llama a esto directamente: cada encuesta tiene su envoltorio tipado
 * —`evaluation-snapshot.ts` y `postcosecha-snapshot.ts`— que le ata su lista de
 * secciones. Así `mergeSections` no puede recibir una sección de la otra
 * encuesta sin que deje de compilar.
 */

/** Lo que hay guardado de cada sección, en texto, para poder compararlo. */
export type SectionSnapshot<K extends string> = Record<K, string>;

/** Los valores de una encuesta: una entrada por sección, y lo que haya dentro
 *  es cosa de cada una. */
type SectionValues<K extends string> = Record<K, unknown>;

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

/** La foto de una encuesta entera, sección por sección. */
export function snapshotSections<K extends string>(
  ids: readonly K[],
  values: SectionValues<K>,
): SectionSnapshot<K> {
  return Object.fromEntries(
    ids.map((seccion) => [seccion, stableStringify(values[seccion])]),
  ) as SectionSnapshot<K>;
}

/** Qué secciones han cambiado desde la última vez que se guardaron. */
export function changedSections<K extends string>(
  ids: readonly K[],
  values: SectionValues<K>,
  snapshot: SectionSnapshot<K>,
): K[] {
  return ids.filter(
    (seccion) => stableStringify(values[seccion]) !== snapshot[seccion],
  );
}

/** La foto de después de guardar: solo cambian las secciones que se escribieron. */
export function mergeSections<K extends string>(
  snapshot: SectionSnapshot<K>,
  values: SectionValues<K>,
  secciones: readonly K[],
): SectionSnapshot<K> {
  const written = Object.fromEntries(
    secciones.map((seccion) => [seccion, stableStringify(values[seccion])]),
  );

  return { ...snapshot, ...written };
}
