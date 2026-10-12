import type { BatchResult } from "../api/types";
import type { SentPostcosechaKey } from "./db/postcosecha-respuestas.repository";
import type { SentRespuestaKey } from "./db/respuestas.repository";

/**
 * Qué hacer con cada sección que viajó, una vez que el servidor contestó.
 *
 * Tres destinos y no dos, porque «no salió» se parte en dos cosas distintas:
 * lo que se puede reintentar y lo que no va a cambiar por reintentarlo.
 */
export type PushOutcome<K> = {
  /** Llegó: a marcar `synced`. */
  synced: K[];
  /** Rechazado y sin vuelta: a marcar `rejected_closed`. */
  rejected: K[];
  /**
   * Se queda pendiente. **No hay nada que escribir**: la fila ya está así, que
   * es justo lo que hace que el siguiente envío la recoja sin reconciliar nada.
   */
  retry: K[];
  /**
   * Resultados que no corresponden a nada de lo que se mandó, duplicados
   * incluidos. Se cuentan y se ignoran: una entrada de más no puede hundir un
   * lote donde todo lo demás salió bien.
   */
  stray: number;
};

/**
 * Los códigos que **sacan la fila de la cola**. Hoy, uno.
 *
 * El servidor lo devuelve por tres puertas distintas —la encuesta cerrada de la
 * plantación, la plantación dada de baja y el tratamiento dado de baja—, y usa
 * el mismo código porque desde la vista del evaluador es la misma situación: el
 * dato no entra hasta que un administrador cambie algo.
 *
 * **Lo que no esté aquí se reintenta**, incluido un `error` sin código. Al revés
 * —tratar cualquier `error` como terminal— un código nuevo del servidor
 * enterraría capturas en un estado del que nadie las saca. El precio de esta
 * elección está anotado en el contrato: un registro con forma inválida tampoco
 * tiene código, y ese sí se reintentaría para siempre.
 */
export const TERMINAL_REJECTIONS: readonly string[] = ["encuesta_cerrada"];

/**
 * **Empareja por llave natural, nunca por posición del arreglo.** Un servidor
 * que reordene, que conteste de menos o que meta una entrada de más no puede
 * acabar marcando una sección por otra — y eso es silencioso e irreparable: la
 * sección marcada se da por enviada y nadie la vuelve a mandar.
 *
 * Lo que el servidor **no contestó cuenta como fallo**, no como éxito. Es la
 * diferencia entre reintentar un dato y perderlo.
 */
const reconcile = <K>(
  sent: readonly K[],
  results: readonly BatchResult[],
  keyOfSent: (record: K) => string,
  keyOfResult: (result: BatchResult) => string,
): PushOutcome<K> => {
  const byKey = new Map<string, BatchResult>();
  for (const result of results) {
    // El primero gana: con dos veredictos para la misma llave no hay forma de
    // saber cuál es el bueno, y el segundo se cuenta como sobrante.
    const key = keyOfResult(result);
    if (!byKey.has(key)) byKey.set(key, result);
  }

  const outcome: PushOutcome<K> = {
    synced: [],
    rejected: [],
    retry: [],
    stray: 0,
  };
  let matched = 0;

  for (const record of sent) {
    const result = byKey.get(keyOfSent(record));

    if (result === undefined) {
      outcome.retry.push(record);
      continue;
    }

    matched += 1;

    if (result.status === "ok") {
      outcome.synced.push(record);
    } else if (result.code && TERMINAL_REJECTIONS.includes(result.code)) {
      outcome.rejected.push(record);
    } else {
      outcome.retry.push(record);
    }
  }

  outcome.stray = results.length - matched;

  return outcome;
};

/**
 * Las dos mitades de la llave viven juntas a propósito: del lado de la tablet
 * la sección es de un `tratamientoId` y del lado del servidor de un
 * `evaluacion_id`, y son **el mismo id con dos nombres**. Separarlas haría que
 * el desajuste solo se viera leyendo dos archivos.
 */
export const reconcileRespuestas = (
  sent: readonly SentRespuestaKey[],
  results: readonly BatchResult[],
): PushOutcome<SentRespuestaKey> =>
  reconcile(
    sent,
    results,
    (record) => `${record.tratamientoId}:${record.seccion}`,
    (result) => `${String(result.evaluacion_id)}:${String(result.seccion)}`,
  );

/** Lo mismo con la llave de tres partes: `plantId` es allá `plantacion_id`. */
export const reconcilePostcosecha = (
  sent: readonly SentPostcosechaKey[],
  results: readonly BatchResult[],
): PushOutcome<SentPostcosechaKey> =>
  reconcile(
    sent,
    results,
    (record) => `${record.plantId}:${record.evalId}:${record.seccion}`,
    (result) =>
      `${String(result.plantacion_id)}:${String(result.eval_id)}:${String(
        result.seccion,
      )}`,
  );
