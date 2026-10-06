import { brixHasError } from "./brix";
import { summarizeCriba } from "./criba";
import { summarizeRendimiento } from "./rendimiento";
import type {
  EvaluationFormValues,
  EvaluationSectionId,
} from "./evaluation-schema";

/**
 * Las secciones con algún dato **imposible**, no solo raro.
 *
 * La diferencia con los avisos ámbar es esa: un aviso dice que algo se sale de
 * lo habitual y la captura vale igual —el rango de Brix, la muestra que no pesa
 * 1.5 ni 2.5 kg—; un error dice que el dato no puede ser cierto, se mire como
 * se mire. Están repartidos en tres secciones:
 *
 * - **Brix**, una lectura fuera de `BRIX_VALID_RANGE` (14.5–30 °Brix).
 * - **Criba**, el promedio por baya mayor que el peso total de su calibre —una
 *   baya no pesa más que todo lo que cayó en su calibre—, un calibre que pasa
 *   de 4 kg, y un promedio por baya fuera de 0.5–30 g.
 * - **Rendimiento**, kilogramos cosechados con el conteo de racimos en cero —la
 *   fruta salió de algún sitio—, y los dos rangos que fijó el negocio: de 1 a
 *   500 racimos y un peso mayor que cero y menor que 500 kg. Que un dato esté
 *   **sin capturar** no entra aquí: eso es un dato que falta, no uno imposible.
 *
 * Los números los fijó el negocio; hasta entonces eran avisos ámbar sobre
 * rangos sin confirmar. Siguen siendo avisos los dos que no dependen de un
 * número suyo: el peso de muestra que no cuadra y el promedio que rompe la
 * progresión de calibres.
 *
 * **Un error no impide guardar.** SQLite es la libreta del evaluador y ahí cabe
 * todo; lo que impide es dar el tratamiento por terminado y mandarlo. Por eso
 * esto devuelve secciones y no un booleano: quien lo lea decide qué enseñar.
 *
 * Recibe los valores del formulario —no un resumen ya calculado— para que sirva
 * igual con lo que hay en pantalla y con lo que se lee de `respuestas`, que es
 * la misma forma tras pasar por `buildEvaluationFromRespuestas`.
 */
export function evaluationErrors(
  values: EvaluationFormValues,
): EvaluationSectionId[] {
  return ERROR_SECTIONS.filter((seccion) =>
    seccionHasError(seccion, values[seccion]),
  );
}

/**
 * Las únicas secciones que pueden traer un error. Que sean tres —y no las seis—
 * es lo que deja preguntarlo fila a fila en `respuestas` sin reconstruir la
 * evaluación entera: cada regla cabe dentro de su propia sección.
 */
export const ERROR_SECTIONS = ["brix", "criba", "rendimiento"] as const;

type ErrorSection = (typeof ERROR_SECTIONS)[number];

/**
 * Si el contenido de una sección trae un dato imposible.
 *
 * Recibe el payload como `unknown` porque también se le pregunta por lo que sale
 * de SQLite, que es texto libre hasta que alguien lo valida: lo que no encaje
 * con la forma esperada no es un error, es algo que esta regla no sabe leer, y
 * se responde que no.
 */
export function seccionHasError(seccion: string, payload: unknown): boolean {
  // Sin `typingIndex`: esto no describe lo que se está tecleando sino lo que
  // hay capturado. Quien quiera silencio mientras se escribe se lo da por su
  // lado, mirando valores ya reposados.
  if (seccion === "brix") return brixHasError(payload);

  if (seccion === "criba") {
    const calibres = (payload as EvaluationFormValues["criba"] | undefined)
      ?.calibres;
    if (!Array.isArray(calibres)) return false;

    return summarizeCriba(calibres).calibres.some(
      (c) => c.overTotal || c.totalOutOfRange || c.averageOutOfRange,
    );
  }

  if (seccion === "rendimiento") {
    const cortes = (payload as EvaluationFormValues["rendimiento"] | undefined)
      ?.cortes;
    if (!Array.isArray(cortes)) return false;

    return summarizeRendimiento(cortes).cortes.some(
      (c) => c.zeroRacimos || c.racimosOutOfRange || c.kilogramosOutOfRange,
    );
  }

  return false;
}

export type { ErrorSection };
