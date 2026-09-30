import type { PostcosechaRespuestaRecord } from "./db/postcosecha-respuestas.repository";
import {
  buildPostcosechaDefaults,
  postcosechaSchema,
  type PostcosechaFormValues,
} from "./postcosecha-schema";

/**
 * Rehidrata el formulario con lo que hay guardado de una evaluación.
 *
 * Arranca de una evaluación en blanco y superpone lo capturado, en vez de
 * construirla desde las filas: una sección que nadie tocó no tiene fila, y la
 * pantalla necesita igualmente su estructura vacía para poder pintarla.
 *
 * **El payload se valida pero no se usa parseado**: `safeParse` sirve solo de
 * portero y lo que entra es el payload crudo. Aquí los dos serían iguales —no
 * hay conversión de texto a número, como sí la hay en tratamiento—, pero usar la
 * salida parseada dejaría que un `z.coerce` futuro reescribiera en silencio lo
 * que el evaluador capturó.
 *
 * Una sección cuyo payload no encaja con el esquema —una opción retirada del
 * catálogo, un formato viejo— se muestra en blanco. **La fila no se toca**, así
 * que el dato sigue en SQLite y se puede recuperar; lo que no hace es reventar
 * la pantalla en el campo.
 *
 * Quien llama ya filtró por `(plantId, evalId)`: aquí no se comprueba de quién
 * son las filas.
 */
export function buildPostcosechaFromRespuestas(
  respuestas: PostcosechaRespuestaRecord[],
): PostcosechaFormValues {
  // El cast se queda confinado aquí: en un recorrido no hay forma de atar el
  // tipo de cada payload al `id` de su sección, que es lo que sí hace
  // `savePostcosechaRespuesta` al guardar, donde la sección se conoce una a una.
  const values: Record<string, unknown> = buildPostcosechaDefaults();

  for (const { seccion, payload } of respuestas) {
    const schema = postcosechaSchema.shape[seccion];

    // Una sección que ya no existe en el formulario: se ignora, no se borra.
    if (!schema) continue;
    if (!schema.safeParse(payload).success) continue;

    values[seccion] = {
      ...(values[seccion] as object),
      ...(payload as object),
    };
  }

  return values as PostcosechaFormValues;
}
