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
 * se mire. Hoy son dos:
 *
 * - **Criba**, el promedio por baya mayor que el peso total de su calibre: una
 *   baya no pesa más que todo lo que cayó en su calibre.
 * - **Rendimiento**, kilogramos cosechados con el conteo de racimos en cero: la
 *   fruta salió de algún sitio. Que el conteo esté **sin capturar** no entra
 *   aquí: eso es un dato que falta, no uno imposible, y avisa en ámbar.
 *
 * Los otros cuatro avisos siguen siendo avisos hasta que el negocio confirme
 * sus números —cuánta diferencia se le admite a la muestra, a partir de qué
 * peso un calibre es imposible y no solo raro, y el rango real de Brix—.
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
  const errors: EvaluationSectionId[] = [];

  // Sin `typingIndex`: esto no describe lo que se está tecleando sino lo que
  // hay capturado. Quien quiera silencio mientras se escribe se lo da por su
  // lado, mirando valores ya reposados.
  if (summarizeCriba(values.criba.calibres).calibres.some((c) => c.overTotal)) {
    errors.push("criba");
  }

  if (
    summarizeRendimiento(values.rendimiento.cortes).cortes.some(
      (c) => c.zeroRacimos,
    )
  ) {
    errors.push("rendimiento");
  }

  return errors;
}
