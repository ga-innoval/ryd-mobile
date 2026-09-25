import type { RespuestaRecord } from "../types";
import {
  buildEvaluationDefaults,
  evaluationSchema,
  type EvaluationFormValues,
} from "./evaluation-schema";

/**
 * Rehidrata el formulario con lo que hay guardado en `respuestas`.
 *
 * Arranca de una evaluación en blanco y superpone lo capturado, en vez de
 * construirla desde las filas: una sección que nadie tocó no tiene fila, y la
 * pantalla necesita igualmente su estructura vacía —los nueve calibres, el
 * primer corte— para poder pintarla.
 *
 * **El payload se valida pero no se usa parseado.** El esquema de cada sección
 * convierte el texto en números, y el formulario necesita el texto tal como se
 * tecleó; así que `safeParse` sirve solo de portero y lo que entra es el
 * payload crudo.
 *
 * Una sección cuyo payload no encaja con el esquema —una opción retirada del
 * catálogo, un formato viejo— se muestra en blanco. **La fila no se toca**, así
 * que el dato sigue en SQLite y se puede recuperar; lo que no hace es reventar
 * la pantalla en el campo. El día que los catálogos cambien de verdad, esto
 * pide una versión en el payload.
 */
export function buildEvaluationFromRespuestas(
  respuestas: RespuestaRecord[],
): EvaluationFormValues {
  // El cast se queda confinado aquí: en un recorrido no hay forma de atar el
  // tipo de cada payload al `id` de su sección, que es lo que sí hace
  // `saveRespuesta` al guardar, donde la sección se conoce una a una.
  const values: Record<string, unknown> = buildEvaluationDefaults();

  for (const { seccion, payload } of respuestas) {
    const schema = evaluationSchema.shape[seccion];

    // Una sección que ya no existe en el formulario: se ignora, no se borra.
    if (!schema) continue;
    if (!schema.safeParse(payload).success) continue;

    values[seccion] = {
      ...(values[seccion] as object),
      ...(payload as object),
    };
  }

  return values as EvaluationFormValues;
}
